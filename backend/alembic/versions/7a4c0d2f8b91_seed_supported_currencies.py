"""seed supported currencies

Revision ID: 7a4c0d2f8b91
Revises: 3ed2a4537e43
Create Date: 2026-05-13 03:41:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "7a4c0d2f8b91"
down_revision = "3ed2a4537e43"
branch_labels = None
depends_on = None


currencies_table = sa.table(
    "currencies",
    sa.column("code", sa.String(length=3)),
    sa.column("name", sa.String(length=64)),
    sa.column("numeric_code", sa.String(length=3)),
    sa.column("minor_units", sa.Integer()),
    sa.column("is_active", sa.Boolean()),
)


SUPPORTED_CURRENCIES = [
    {
        "code": "RUB",
        "name": "Russian Ruble",
        "numeric_code": "643",
        "minor_units": 2,
        "is_active": True,
    },
    {
        "code": "USD",
        "name": "US Dollar",
        "numeric_code": "840",
        "minor_units": 2,
        "is_active": True,
    },
    {
        "code": "EUR",
        "name": "Euro",
        "numeric_code": "978",
        "minor_units": 2,
        "is_active": True,
    },
]


def upgrade() -> None:
    connection = op.get_bind()
    for currency in SUPPORTED_CURRENCIES:
        exists = connection.execute(
            sa.select(currencies_table.c.code).where(currencies_table.c.code == currency["code"])
        ).scalar_one_or_none()
        if exists is None:
            connection.execute(currencies_table.insert().values(**currency))


def downgrade() -> None:
    op.execute(
        currencies_table.delete().where(
            currencies_table.c.code.in_([currency["code"] for currency in SUPPORTED_CURRENCIES])
        )
    )
