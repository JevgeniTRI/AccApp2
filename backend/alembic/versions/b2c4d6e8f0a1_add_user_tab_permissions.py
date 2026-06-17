"""add user tab permissions

Revision ID: b2c4d6e8f0a1
Revises: f3a6b8c1d9e0
Create Date: 2026-06-16 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "b2c4d6e8f0a1"
down_revision = "f3a6b8c1d9e0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_tab_permissions",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("tab_key", sa.String(length=64), nullable=False),
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "tab_key", name="uq_user_tab_permissions_user_tab"),
    )
    op.create_index(op.f("ix_user_tab_permissions_user_id"), "user_tab_permissions", ["user_id"], unique=False)
    op.create_index(op.f("ix_user_tab_permissions_tab_key"), "user_tab_permissions", ["tab_key"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_tab_permissions_tab_key"), table_name="user_tab_permissions")
    op.drop_index(op.f("ix_user_tab_permissions_user_id"), table_name="user_tab_permissions")
    op.drop_table("user_tab_permissions")
