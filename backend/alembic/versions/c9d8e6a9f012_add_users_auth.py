"""add users auth

Revision ID: c9d8e6a9f012
Revises: 7a4c0d2f8b91
Create Date: 2026-05-13 04:20:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "c9d8e6a9f012"
down_revision = "7a4c0d2f8b91"
branch_labels = None
depends_on = None


ALICE_PASSWORD_HASH = "pbkdf2_sha256$260000$m4Qh3gs9ErMVDUCraO0tEw==$NB9BORACMvLQ/vwBrFDAwzNEw24wQ31/8vGRW1RD2bY="


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("username", sa.String(length=128), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("is_superuser", sa.Boolean(), nullable=False),
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
    )
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    users_table = sa.table(
        "users",
        sa.column("username", sa.String(length=128)),
        sa.column("password_hash", sa.String(length=255)),
        sa.column("is_active", sa.Boolean()),
        sa.column("is_superuser", sa.Boolean()),
    )
    op.bulk_insert(
        users_table,
        [
            {
                "username": "Alice",
                "password_hash": ALICE_PASSWORD_HASH,
                "is_active": True,
                "is_superuser": True,
            }
        ],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_table("users")
