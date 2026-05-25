"""add client balance effect currency

Revision ID: a1b2c3d4e5f6
Revises: 4f2c7a9b1d65
Create Date: 2026-05-25 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "a1b2c3d4e5f6"
down_revision = "4f2c7a9b1d65"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "payment_financial_breakdown",
        sa.Column("client_balance_effect_currency_code", sa.String(length=3), nullable=True),
    )
    op.execute(
        """
        update payment_financial_breakdown pfb
        join payments p on p.id = pfb.payment_id
        set pfb.client_balance_effect_currency_code = p.currency_code
        where pfb.client_balance_effect_currency_code is null
        """
    )


def downgrade() -> None:
    op.drop_column("payment_financial_breakdown", "client_balance_effect_currency_code")
