"""add client interest rate percent

Revision ID: 9c1d2e3f4a5b
Revises: b2c4d6e8f0a1
Create Date: 2026-06-17 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "9c1d2e3f4a5b"
down_revision = "b2c4d6e8f0a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "clients",
        sa.Column("interest_rate_percent", sa.Numeric(precision=7, scale=4), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("clients", "interest_rate_percent")
