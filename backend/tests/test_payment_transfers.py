from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase, TestCase, main
from unittest.mock import AsyncMock, Mock, patch

from app.models.enums import PaymentDirection, PaymentKind
from app.models.banking import Payment
from app.models.reference import Bank, Company, CompanyBankAccount
from app.schemas.payments import PaymentCreateRequest
from app.services.payments import (
    create_payment,
    delete_payment,
    create_payments_batch,
    PaymentValidationError,
    get_transfer_counterpart,
    has_explicit_transfer_counterpart,
    is_company_transfer_payload,
    link_explicit_transfer_pairs,
    payloads_are_transfer_counterparts,
    resolve_amount_eur,
    resolve_payment_payload,
    sync_transfer_counterpart,
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


class FakeScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeRateDb:
    def __init__(self, rates):
        self.rates = list(rates)

    async def execute(self, stmt):
        return FakeScalarResult(self.rates.pop(0))


class PaymentExchangeRateTests(IsolatedAsyncioTestCase):
    async def test_resolve_amount_eur_converts_rub_using_booking_date_rate(self):
        db = FakeRateDb([None, SimpleNamespace(id=7, rate_value=Decimal("100.00000000"))])

        amount_eur, exchange_rate_id = await resolve_amount_eur(
            db,
            amount_original=Decimal("250.00"),
            currency_code="RUB",
            booking_date=date(2026, 4, 14),
        )

        assert amount_eur == Decimal("2.50")
        assert exchange_rate_id == 7

    async def test_resolve_amount_eur_converts_usd_through_rub_rates(self):
        db = FakeRateDb([
            None,
            None,
            SimpleNamespace(id=11, rate_value=Decimal("100.00000000")),
            SimpleNamespace(id=12, rate_value=Decimal("90.00000000")),
        ])

        amount_eur, exchange_rate_id = await resolve_amount_eur(
            db,
            amount_original=Decimal("10.00"),
            currency_code="USD",
            booking_date=date(2026, 4, 16),
        )

        assert amount_eur == Decimal("9.00")
        assert exchange_rate_id == 12

    async def test_resolve_amount_eur_requires_rate_for_payment_date(self):
        db = FakeRateDb([None, None, None])

        with self.assertRaises(PaymentValidationError):
            await resolve_amount_eur(
                db,
                amount_original=Decimal("10.00"),
                currency_code="USD",
                booking_date=date(2026, 4, 16),
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

    async def test_sync_transfer_counterpart_for_incoming_payment_creates_outgoing_counterpart(self):
        added = []
        db = SimpleNamespace(add=Mock(side_effect=added.append), flush=AsyncMock())
        payload = make_payload(payment_direction=PaymentDirection.INCOMING)
        payment = Payment(id=100)
        resolved = {
            "company": SimpleNamespace(id=1, legal_name="Company A", short_name="A"),
            "company_bank_account": SimpleNamespace(id=10, company_id=1),
            "related_company": SimpleNamespace(id=2, legal_name="Company B", short_name="B"),
            "related_company_bank_account": SimpleNamespace(id=20, company_id=2),
            "client": None,
            "counterparty": None,
            "currency_code": "EUR",
            "amount_eur": Decimal("100.00"),
        }

        with (
            patch("app.services.payments.upsert_transfer_counterpart_breakdown", new=AsyncMock()),
            patch("app.services.payments.delete_payment_attachments", new=AsyncMock()),
        ):
            await sync_transfer_counterpart(
                db,
                payment=payment,
                payload=payload,
                resolved=resolved,
                old_transfer_counterpart=None,
            )

        assert len(added) == 1
        counterpart = added[0]
        assert counterpart.company_id == 2
        assert counterpart.company_bank_account_id == 20
        assert counterpart.related_company_id == 1
        assert counterpart.payment_direction == PaymentDirection.OUTGOING
        assert counterpart.amount_original == Decimal("100.00")
        assert counterpart.amount_eur == Decimal("100.00")

    async def test_create_payments_batch_does_not_auto_sync_explicit_transfer_pair(self):
        payload = make_payload()
        counterpart = make_counterpart_payload()

        left = SimpleNamespace(id=1, transfer_pair_id=None)
        right = SimpleNamespace(id=2, transfer_pair_id=None)
        db = SimpleNamespace(flush=AsyncMock())

        with patch("app.services.payments.create_payment", new=AsyncMock(side_effect=[left, right])) as create_mock:
            payments = await create_payments_batch(db, [payload, counterpart])

        assert payments == [left, right]
        assert left.transfer_pair_id == 2
        assert right.transfer_pair_id == 1
        db.flush.assert_awaited_once()
        assert create_mock.await_args_list[0].kwargs["sync_counterpart"] is False
        assert create_mock.await_args_list[1].kwargs["sync_counterpart"] is False

    async def test_create_payments_batch_auto_syncs_unpaired_transfer_payload(self):
        payload = make_payload()

        payment = SimpleNamespace(id=1, transfer_pair_id=None)
        db = SimpleNamespace(flush=AsyncMock())

        with patch("app.services.payments.create_payment", new=AsyncMock(return_value=payment)) as create_mock:
            payments = await create_payments_batch(db, [payload])

        assert payments == [payment]
        assert payment.transfer_pair_id is None
        db.flush.assert_awaited_once()
        assert create_mock.await_args.kwargs["sync_counterpart"] is True

    async def test_delete_payment_can_delete_transfer_counterpart(self):
        payment = SimpleNamespace(id=10, transfer_pair_id=20)
        counterpart = SimpleNamespace(id=20, transfer_pair_id=10)
        db = SimpleNamespace(get=AsyncMock(side_effect=[payment, counterpart]), flush=AsyncMock())

        with patch("app.services.payments.delete_payment_record", new=AsyncMock()) as delete_record:
            await delete_payment(db, 10, delete_counterpart=True)

        assert payment.transfer_pair_id is None
        assert counterpart.transfer_pair_id is None
        assert delete_record.await_args_list[0].args == (db, payment)
        assert delete_record.await_args_list[1].args == (db, counterpart)

    async def test_delete_payment_keeps_transfer_counterpart_by_default(self):
        payment = SimpleNamespace(id=10, transfer_pair_id=20)
        counterpart = SimpleNamespace(id=20, transfer_pair_id=10)
        db = SimpleNamespace(get=AsyncMock(side_effect=[payment, counterpart]), flush=AsyncMock())

        with patch("app.services.payments.delete_payment_record", new=AsyncMock()) as delete_record:
            await delete_payment(db, 10)

        assert payment.transfer_pair_id is None
        assert counterpart.transfer_pair_id is None
        delete_record.assert_awaited_once_with(db, payment)

    async def test_get_transfer_counterpart_rejects_inconsistent_link(self):
        payment = SimpleNamespace(id=10, transfer_pair_id=20)
        counterpart = SimpleNamespace(id=20, transfer_pair_id=None)
        db = SimpleNamespace(get=AsyncMock(return_value=counterpart))

        with self.assertRaises(PaymentValidationError):
            await get_transfer_counterpart(db, payment)

    def test_link_explicit_transfer_pairs_sets_bidirectional_ids(self):
        left = SimpleNamespace(id=10, transfer_pair_id=None)
        right = SimpleNamespace(id=20, transfer_pair_id=None)

        link_explicit_transfer_pairs([make_payload(), make_counterpart_payload()], [left, right])

        assert left.transfer_pair_id == 20
        assert right.transfer_pair_id == 10


if __name__ == "__main__":
    main()
