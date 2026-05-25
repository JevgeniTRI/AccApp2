from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.banking import PaymentAttachment
from app.models.enums import PaymentDirection
from app.schemas.payments import (
    PaymentBatchCreateRequest,
    PaymentBatchCreateResponse,
    BankAccountBalanceResponse,
    PaymentAttachmentSummary,
    PaymentCreateRequest,
    PaymentCreateResponse,
    PaymentDetailResponse,
    PaymentFiltersMetaResponse,
    PaymentListResponse,
    PaymentRow,
)
from app.services.payments import (
    PaymentValidationError,
    create_payment,
    create_payments_batch,
    delete_payment,
    get_earliest_payment_booking_date,
    get_bank_account_balance,
    get_payment_detail,
    list_payments,
    update_payment,
)
from app.services.payment_exports import (
    build_payments_pdf,
    build_payments_xlsx,
    describe_export_period,
    payment_export_filename,
    prepare_payment_export_rows,
)


router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("", response_model=PaymentListResponse)
async def get_payments(
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
    company_id: int | None = None,
    bank_id: int | None = None,
    currency_code: str | None = None,
    client_id: int | None = None,
    include_incoming: bool = True,
    include_outgoing: bool = True,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> PaymentListResponse:
    total, rows = await list_payments(
        db,
        date_from=date_from,
        date_to=date_to,
        search=search,
        company_id=company_id,
        bank_id=bank_id,
        currency_code=currency_code,
        client_id=client_id,
        include_incoming=include_incoming,
        include_outgoing=include_outgoing,
        limit=limit,
        offset=offset,
    )

    items = []
    for row in rows:
        signed_amount = row["amount_original"]
        if row["payment_direction"] == PaymentDirection.OUTGOING:
            signed_amount = Decimal("-1") * row["amount_original"]

        items.append(
            PaymentRow(
                id=row["id"],
                booking_date=row["booking_date"],
                value_date=row["value_date"],
                transaction_date=row["transaction_date"],
                company={"id": row["company_id"], "name": row["company_name"]},
                related_company={"id": row["related_company_id"], "name": row["related_company_name"]},
                bank={"id": row["bank_id"], "name": row["bank_name"]},
                counterparty={"id": row["counterparty_id"], "name": row["counterparty_name"]},
                client={"id": row["client_id"], "name": row["client_name"]},
                amount_original=row["amount_original"],
                signed_amount=signed_amount,
                amount_eur=row["amount_eur"],
                currency_code=row["currency_code"],
                vat_amount_eur=row["vat_amount_eur"],
                own_expense_amount_eur=row["own_expense_amount_eur"],
                own_expense_currency_code=row["own_expense_currency_code"],
                income_expense_eur=row["company_commission_amount_eur"],
                company_commission_currency_code=row["company_commission_currency_code"],
                client_balance_effect_eur=row["net_client_balance_effect_eur"],
                client_balance_effect_currency_code=row["client_balance_effect_currency_code"],
                payment_direction=row["payment_direction"],
                payment_kind=row["payment_kind"],
                status=row["status"],
                payment_reference=row["payment_reference"],
                payment_purpose=row["payment_purpose"],
                notes=row["notes"],
                attachments=[
                    PaymentAttachmentSummary(
                        id=attachment["id"],
                        file_name=attachment["file_name"],
                        content_type=attachment["content_type"],
                        file_size=attachment["file_size"],
                    )
                    for attachment in row["attachments"]
                ],
                created_at=row["created_at"],
            )
        )

    return PaymentListResponse(total=total, items=items)


@router.get("/meta", response_model=PaymentFiltersMetaResponse)
async def get_payments_meta(db: AsyncSession = Depends(get_db)) -> PaymentFiltersMetaResponse:
    earliest_booking_date = await get_earliest_payment_booking_date(db)
    return PaymentFiltersMetaResponse(earliest_booking_date=earliest_booking_date)


@router.get("/export/{export_format}")
async def export_payments(
    export_format: str,
    date_from: date | None = None,
    date_to: date | None = None,
    search: str | None = None,
    company_id: int | None = None,
    bank_id: int | None = None,
    currency_code: str | None = None,
    client_id: int | None = None,
    include_incoming: bool = True,
    include_outgoing: bool = True,
    db: AsyncSession = Depends(get_db),
) -> Response:
    _, rows = await list_payments(
        db,
        date_from=date_from,
        date_to=date_to,
        search=search,
        company_id=company_id,
        bank_id=bank_id,
        currency_code=currency_code,
        client_id=client_id,
        include_incoming=include_incoming,
        include_outgoing=include_outgoing,
        limit=10000,
        offset=0,
    )
    export_rows = prepare_payment_export_rows(rows)

    if export_format == "excel":
        content = build_payments_xlsx(export_rows)
        filename = payment_export_filename("xlsx")
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    elif export_format == "pdf":
        try:
            content = build_payments_pdf(
                export_rows,
                title="Платежи",
                subtitle=describe_export_period(date_from, date_to),
            )
        except RuntimeError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        filename = payment_export_filename("pdf")
        media_type = "application/pdf"
    else:
        raise HTTPException(status_code=400, detail="Unsupported export format")

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("", response_model=PaymentCreateResponse, status_code=201)
async def post_payment(payload: PaymentCreateRequest, db: AsyncSession = Depends(get_db)) -> PaymentCreateResponse:
    try:
        payment = await create_payment(db, payload)
        await db.commit()
    except PaymentValidationError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create payment") from exc

    return PaymentCreateResponse(
        id=payment.id,
        payment_kind=payment.payment_kind,
        payment_direction=payment.payment_direction,
        company_bank_account_id=payment.company_bank_account_id,
    )


@router.get("/bank-accounts/{company_bank_account_id}/balance", response_model=BankAccountBalanceResponse)
async def get_payment_bank_account_balance(
    company_bank_account_id: int,
    db: AsyncSession = Depends(get_db),
) -> BankAccountBalanceResponse:
    try:
        balance = await get_bank_account_balance(db, company_bank_account_id)
    except PaymentValidationError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return BankAccountBalanceResponse(**balance)


@router.get("/{payment_id}", response_model=PaymentDetailResponse)
async def get_payment(payment_id: int, db: AsyncSession = Depends(get_db)) -> PaymentDetailResponse:
    try:
        payment = await get_payment_detail(db, payment_id)
    except PaymentValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if payment is None:
        raise HTTPException(status_code=404, detail="Payment not found")

    return payment


@router.put("/{payment_id}", response_model=PaymentCreateResponse)
async def put_payment(
    payment_id: int,
    payload: PaymentCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> PaymentCreateResponse:
    try:
        payment = await update_payment(db, payment_id, payload)
        await db.commit()
    except PaymentValidationError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update payment") from exc

    return PaymentCreateResponse(
        id=payment.id,
        payment_kind=payment.payment_kind,
        payment_direction=payment.payment_direction,
        company_bank_account_id=payment.company_bank_account_id,
    )


@router.delete("/{payment_id}", status_code=204)
async def delete_payment_endpoint(payment_id: int, db: AsyncSession = Depends(get_db)) -> None:
    try:
        await delete_payment(db, payment_id)
        await db.commit()
    except PaymentValidationError as exc:
        await db.rollback()
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete payment") from exc


@router.post("/batch", response_model=PaymentBatchCreateResponse, status_code=201)
async def post_payments_batch(
    payload: PaymentBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> PaymentBatchCreateResponse:
    try:
        payments = await create_payments_batch(db, payload.items)
        await db.commit()
    except PaymentValidationError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create payments") from exc

    return PaymentBatchCreateResponse(
        items=[
            PaymentCreateResponse(
                id=payment.id,
                payment_kind=payment.payment_kind,
                payment_direction=payment.payment_direction,
                company_bank_account_id=payment.company_bank_account_id,
            )
            for payment in payments
        ]
    )


@router.get("/attachments/{attachment_id}/content")
async def get_payment_attachment_content(
    attachment_id: int,
    db: AsyncSession = Depends(get_db),
) -> Response:
    attachment = await db.get(PaymentAttachment, attachment_id)
    if attachment is None:
        raise HTTPException(status_code=404, detail="Attachment not found")

    headers = {
        "Content-Disposition": f'inline; filename="{attachment.file_name}"',
        "Content-Length": str(attachment.file_size),
    }
    return Response(
        content=attachment.file_content,
        media_type=attachment.content_type or "application/octet-stream",
        headers=headers,
    )
