from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase, TestCase, main
from unittest.mock import AsyncMock, Mock, patch

from app.models.enums import PaymentDirection, PaymentKind
from app.models.reference import Bank, Company, CompanyBankAccount
from app.schemas.payments import PaymentCreateRequest
from app.services.payments import (
    create_payment,
    delete_payment,
    create_payments_batch,
    PaymentValidationError,
    has_explicit_transfer_counterpart,
    is_company_transfer_payload,
    payloads_are_transfer_counterparts,
    resolve_payment_payload,
)


def make_payload(**overrides):
    data = {
        "company_bank_account_id": 10,
        "booking_date": date(2026, 5, 27),
        "value_date": date(2026, 5, 27),
        "transaction_date": date(2026, 5, 27),
        "amount_original": Decimal("100.00"),
        "amount_eur": Decimal("100.00"),
        "currency_code": "EUR",
        "payment_direction": PaymentDirection.OUTGOING,
        "related_company_id": 2,
        "related_company_bank_account_id": 20,
        "vat_amount_eur": Decimal("0"),
        "own_expense_amount_eur": Decimal("0"),
        "company_commission_amount_eur": Decimal("0"),
        "client_balance_effect_eur": Decimal("0"),
    }
    data.update(overrides)
    return PaymentCreateRequest(**data)


def make_counterpart_payload(**overrides):
    data = {
        "company_bank_account_id": 20,
        "payment_direction": PaymentDirection.INCOMING,
        "related_company_id": 1,
        "related_company_bank_account_id": 10,
    }
    data.update(overrides)
    return make_payload(**data)


class FakeReferenceDb:
    def __init__(self):
        self.company = Company(id=1, legal_name="Asgarda OU", short_name="Asgarda")
        self.bank = Bank(id=1, name="Citadele")
        self.source_account = CompanyBankAccount(
            id=10,
            company_id=1,
            bank_id=1,
            currency_code="EUR",
            is_active=True,
        )
        self.target_account = CompanyBankAccount(
            id=20,
            company_id=1,
            bank_id=1,
            currency_code="EUR",
            is_active=True,
        )

    async def get(self, model, item_id):
        items = {
            (CompanyBankAccount, 10): self.source_account,
            (CompanyBankAccount, 20): self.target_account,
            (Company, 1): self.company,
            (Bank, 1): self.bank,
        }
        return items.get((model, item_id))


class PaymentTransferPayloadTests(TestCase):
    def test_company_transfer_payload_requires_target_account_and_no_client_party(self):
        assert is_company_transfer_payload(make_payload())
        assert not is_company_transfer_payload(make_payload(related_company_bank_account_id=None))
        assert not is_company_transfer_payload(make_payload(client_id=5))
        assert not is_company_transfer_payload(make_payload(counterparty_name="Vendor"))

    def test_payloads_are_transfer_counterparts_when_accounts_and_direction_are_swapped(self):
        assert payloads_are_transfer_counterparts(make_payload(), make_counterpart_payload())
        assert has_explicit_transfer_counterpart([make_payload(), make_counterpart_payload()], 0)
        assert has_explicit_transfer_counterpart([make_payload(), make_counterpart_payload()], 1)

    def test_payloads_are_not_counterparts_for_same_account_or_client_rows(self):
        assert not payloads_are_transfer_counterparts(
            make_payload(),
            make_counterpart_payload(company_bank_account_id=10, related_company_bank_account_id=10),
        )
        assert not payloads_are_transfer_counterparts(
            make_payload(client_id=5),
            make_counterpart_payload(client_id=5),
        )


class PaymentTransferServiceTests(IsolatedAsyncioTestCase):

    async def test_resolve_payment_payload_allows_same_company_different_bank_account_transfer(self):
        payload = make_payload(related_company_id=1)

        resolved = await resolve_payment_payload(FakeReferenceDb(), payload)

        assert resolved["company"].id == 1
        assert resolved["related_company"].id == 1
        assert resolved["company_bank_account"].id == 10
        assert resolved["related_company_bank_account"].id == 20

    async def test_resolve_payment_payload_rejects_same_company_without_target_account(self):
        payload = make_payload(related_company_id=1, related_company_bank_account_id=None)

        with self.assertRaises(PaymentValidationError):
            await resolve_payment_payload(FakeReferenceDb(), payload)

    async def test_create_payment_syncs_counterpart_for_single_transfer_payload(self):
        db = SimpleNamespace(add=Mock(), flush=AsyncMock())
        payload = make_payload()
        resolved = {
            "company": SimpleNamespace(id=1),
            "company_bank_account": SimpleNamespace(id=10),
            "related_company": SimpleNamespace(id=2),
            "related_company_bank_account": SimpleNamespace(id=20, company_id=2),
            "client": None,
            "counterparty": None,
            "counterparty_name": None,
            "payment_kind": PaymentKind.EXPENSE,
            "currency_code": "EUR",
            "amount_eur": Decimal("100.00"),
        }

        with (
            patch("app.services.payments.resolve_payment_payload", new=AsyncMock(return_value=resolved)),
            patch("app.services.payments.validate_financial_breakdown"),
            patch("app.services.payments.upsert_payment_financial_breakdown", new=AsyncMock()),
            patch("app.services.payments.replace_payment_attachments", new=AsyncMock()),
            patch("app.services.payments.sync_transfer_counterpart", new=AsyncMock()) as sync_counterpart,
        ):
            payment = await create_payment(db, payload)

        assert payment.company_bank_account_id == 10
        sync_counterpart.assert_awaited_once()
        assert sync_counterpart.await_args.kwargs["old_transfer_counterpart"] is None

    async def test_create_payments_batch_does_not_auto_sync_explicit_transfer_pair(self):
        payload = make_payload()
        counterpart = make_counterpart_payload()

        with patch("app.services.payments.create_payment", new=AsyncMock(side_effect=["left", "right"])) as create_mock:
            payments = await create_payments_batch(SimpleNamespace(), [payload, counterpart])

        assert payments == ["left", "right"]
        assert create_mock.await_args_list[0].kwargs["sync_counterpart"] is False
        assert create_mock.await_args_list[1].kwargs["sync_counterpart"] is False

    async def test_create_payments_batch_auto_syncs_unpaired_transfer_payload(self):
        payload = make_payload()

        with patch("app.services.payments.create_payment", new=AsyncMock(return_value="payment")) as create_mock:
            payments = await create_payments_batch(SimpleNamespace(), [payload])

        assert payments == ["payment"]
        assert create_mock.await_args.kwargs["sync_counterpart"] is True

    async def test_delete_payment_can_delete_transfer_counterpart(self):
        db = SimpleNamespace(get=AsyncMock())
        payment = SimpleNamespace(id=10)
        counterpart = SimpleNamespace(id=20)
        db.get.return_value = payment

        with (
            patch("app.services.payments.find_transfer_counterpart", new=AsyncMock(return_value=counterpart)) as find_counterpart,
            patch("app.services.payments.delete_payment_record", new=AsyncMock()) as delete_record,
        ):
            await delete_payment(db, 10, delete_counterpart=True)

        find_counterpart.assert_awaited_once_with(db, payment)
        assert delete_record.await_args_list[0].args == (db, payment)
        assert delete_record.await_args_list[1].args == (db, counterpart)

    async def test_delete_payment_keeps_transfer_counterpart_by_default(self):
        db = SimpleNamespace(get=AsyncMock())
        payment = SimpleNamespace(id=10)
        db.get.return_value = payment

        with (
            patch("app.services.payments.find_transfer_counterpart", new=AsyncMock()) as find_counterpart,
            patch("app.services.payments.delete_payment_record", new=AsyncMock()) as delete_record,
        ):
            await delete_payment(db, 10)

        find_counterpart.assert_not_awaited()
        delete_record.assert_awaited_once_with(db, payment)


if __name__ == "__main__":
    main()
