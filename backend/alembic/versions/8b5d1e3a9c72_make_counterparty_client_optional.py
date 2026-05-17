"""make counterparty client optional

Revision ID: 8b5d1e3a9c72
Revises: 2f6b1d9e4a13
Create Date: 2026-05-17 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "8b5d1e3a9c72"
down_revision = "2f6b1d9e4a13"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("counterparties") as batch_op:
        batch_op.alter_column(
            "client_id",
            existing_type=sa.Integer(),
            nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("counterparties") as batch_op:
        batch_op.alter_column(
            "client_id",
            existing_type=sa.Integer(),
            nullable=False,
        )
