from __future__ import annotations

import argparse
import asyncio
import json
import sqlite3
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import aiomysql


ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"

TABLES_IN_INSERT_ORDER = [
    "companies",
    "company_contacts",
    "banks",
    "clients",
    "company_clients",
    "counterparties",
    "company_bank_accounts",
    "exchange_rates",
    "bank_statements",
    "bank_statement_lines",
    "payments",
    "payment_settlement_rules_snapshot",
    "payment_financial_breakdown",
    "payment_attachments",
    "ledger_accounts",
    "ledger_entries",
    "ledger_postings",
    "client_balance_ledger",
]

TABLES_IN_DELETE_ORDER = list(reversed(TABLES_IN_INSERT_ORDER))


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text().splitlines():
        if not line or line.lstrip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip()
    return env


def parse_mysql_url(url: str) -> dict[str, object]:
    parsed = urlparse(url.replace("mysql+aiomysql://", "mysql://"))
    query = parse_qs(parsed.query)
    return {
        "host": parsed.hostname,
        "port": parsed.port or 3306,
        "user": parsed.username,
        "password": parsed.password,
        "db": parsed.path.lstrip("/"),
        "charset": (query.get("charset") or ["utf8mb4"])[0],
        "autocommit": False,
    }


def json_default(value: object) -> str:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, bytes):
        return value.hex()
    return str(value)


def sqlite_table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute(
        "select count(*) from sqlite_master where type = ? and name = ?",
        ("table", table),
    ).fetchone()
    return bool(row and row[0])


def sqlite_rows(conn: sqlite3.Connection, table: str, columns: list[str]) -> list[dict[str, object]]:
    if not sqlite_table_exists(conn, table):
        return []
    available = [row[1] for row in conn.execute(f"pragma table_info({table})").fetchall()]
    selected = [column for column in columns if column in available]
    if not selected:
        return []
    cursor = conn.execute(f"select {', '.join(selected)} from {table} order by id")
    return [dict(zip(selected, row, strict=True)) for row in cursor.fetchall()]


async def mysql_columns(cur: aiomysql.Cursor, table: str) -> list[str]:
    await cur.execute(
        """
        select column_name
        from information_schema.columns
        where table_schema = database() and table_name = %s
        order by ordinal_position
        """,
        (table,),
    )
    return [row[0] for row in await cur.fetchall()]


async def table_count(cur: aiomysql.Cursor, table: str) -> int:
    await cur.execute(f"select count(*) from {table}")
    return int((await cur.fetchone())[0])


async def backup_mysql(cur: aiomysql.Cursor, tables: list[str], backup_path: Path) -> None:
    backup: dict[str, list[dict[str, object]]] = {}
    for table in tables:
        await cur.execute(f"select * from {table}")
        columns = [description[0] for description in cur.description]
        backup[table] = [dict(zip(columns, row, strict=True)) for row in await cur.fetchall()]
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    backup_path.write_text(
        json.dumps(backup, ensure_ascii=False, indent=2, default=json_default),
    )


async def insert_rows(cur: aiomysql.Cursor, table: str, rows: list[dict[str, object]]) -> None:
    if not rows:
        return
    columns = list(rows[0].keys())
    placeholders = ", ".join(["%s"] * len(columns))
    sql = f"insert into {table} ({', '.join(columns)}) values ({placeholders})"
    values = [tuple(row[column] for column in columns) for row in rows]
    await cur.executemany(sql, values)


async def migrate(sqlite_path: Path, dry_run: bool) -> None:
    env = load_env(BACKEND_DIR / ".env")
    mysql_config = parse_mysql_url(env["DATABASE_URL"])

    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row

    conn = await aiomysql.connect(**mysql_config)
    cur = await conn.cursor()
    try:
        mysql_table_columns = {
            table: [column for column in await mysql_columns(cur, table)]
            for table in TABLES_IN_INSERT_ORDER
        }
        source_counts = {
            table: len(sqlite_rows(sqlite_conn, table, mysql_table_columns[table]))
            for table in TABLES_IN_INSERT_ORDER
        }

        print("Source SQLite rows:")
        for table, count in source_counts.items():
            print(f"  {table}: {count}")

        if dry_run:
            print("Dry run only; MySQL was not changed.")
            return

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        backup_path = ROOT_DIR / f"mysql_business_backup_{timestamp}.json"
        await backup_mysql(cur, TABLES_IN_INSERT_ORDER, backup_path)
        print(f"MySQL backup written: {backup_path}")

        await cur.execute("set foreign_key_checks = 0")
        for table in TABLES_IN_DELETE_ORDER:
            await cur.execute(f"delete from {table}")

        for table in TABLES_IN_INSERT_ORDER:
            rows = sqlite_rows(sqlite_conn, table, mysql_table_columns[table])
            await insert_rows(cur, table, rows)
            if rows and "id" in rows[0]:
                next_id = max(int(row["id"]) for row in rows if row.get("id") is not None) + 1
                await cur.execute(f"alter table {table} auto_increment = %s", (next_id,))

        await cur.execute("set foreign_key_checks = 1")
        await conn.commit()

        print("Target MySQL rows:")
        for table in TABLES_IN_INSERT_ORDER:
            print(f"  {table}: {await table_count(cur, table)}")
    except Exception:
        await conn.rollback()
        raise
    finally:
        await cur.close()
        conn.close()
        sqlite_conn.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--sqlite",
        default=str(ROOT_DIR / "accounting.db"),
        help="Path to the source SQLite database.",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    asyncio.run(migrate(Path(args.sqlite).resolve(), args.dry_run))


if __name__ == "__main__":
    main()
