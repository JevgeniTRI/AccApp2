"""add payment breakdown currency codes

Revision ID: 4f2c7a9b1d65
Revises: 8b5d1e3a9c72
Create Date: 2026-05-17 10:10:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "4f2c7a9b1d65"
down_revision = "8b5d1e3a9c72"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "payment_financial_breakdown",
        sa.Column("own_expense_currency_code", sa.String(length=3), nullable=True),
    )
    op.add_column(
        "payment_financial_breakdown",
        sa.Column("company_commission_currency_code", sa.String(length=3), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("payment_financial_breakdown", "company_commission_currency_code")
    op.drop_column("payment_financial_breakdown", "own_expense_currency_code")
