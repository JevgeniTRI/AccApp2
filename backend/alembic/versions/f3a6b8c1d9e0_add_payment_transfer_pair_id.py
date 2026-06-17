"""add payment transfer pair id

Revision ID: f3a6b8c1d9e0
Revises: a1b2c3d4e5f6
Create Date: 2026-06-16 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "f3a6b8c1d9e0"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("payments") as batch_op:
        batch_op.add_column(sa.Column("transfer_pair_id", sa.Integer(), nullable=True))
        batch_op.create_index("ix_payments_transfer_pair_id", ["transfer_pair_id"])
        batch_op.create_foreign_key(
            "fk_payments_transfer_pair_id_payments",
            "payments",
            ["transfer_pair_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("payments") as batch_op:
        batch_op.drop_constraint("fk_payments_transfer_pair_id_payments", type_="foreignkey")
        batch_op.drop_index("ix_payments_transfer_pair_id")
        batch_op.drop_column("transfer_pair_id")
