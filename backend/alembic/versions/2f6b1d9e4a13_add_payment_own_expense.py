"""add payment own expense amounts

Revision ID: 2f6b1d9e4a13
Revises: c9d8e6a9f012
Create Date: 2026-05-15 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "2f6b1d9e4a13"
down_revision: Union[str, None] = "c9d8e6a9f012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "payment_financial_breakdown",
        sa.Column("own_expense_amount_original", sa.Numeric(18, 2), nullable=True),
    )
    op.add_column(
        "payment_financial_breakdown",
        sa.Column(
            "own_expense_amount_eur",
            sa.Numeric(18, 2),
            nullable=False,
            server_default="0",
        ),
    )
    op.alter_column("payment_financial_breakdown", "own_expense_amount_eur", server_default=None)


def downgrade() -> None:
    op.drop_column("payment_financial_breakdown", "own_expense_amount_eur")
    op.drop_column("payment_financial_breakdown", "own_expense_amount_original")
