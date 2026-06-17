from __future__ import annotations

from typing import NamedTuple


class TabDefinition(NamedTuple):
    key: str
    label: str
    path: str
    is_admin_only: bool = False


TAB_DEFINITIONS: tuple[TabDefinition, ...] = (
    TabDefinition("dashboard", "Главная", "/"),
    TabDefinition("payments", "Платежи", "/payments"),
    TabDefinition("companies", "Компании", "/companies"),
    TabDefinition("banks", "Банки", "/banks"),
    TabDefinition("clients", "Клиенты", "/clients"),
    TabDefinition("counterparties", "Контрагенты", "/counterparties"),
    TabDefinition("admin", "Admin", "/admin", True),
)

TAB_KEYS = frozenset(tab.key for tab in TAB_DEFINITIONS)
ASSIGNABLE_TAB_KEYS = frozenset(tab.key for tab in TAB_DEFINITIONS if not tab.is_admin_only)


def normalize_tab_keys(values: list[str] | tuple[str, ...] | set[str] | frozenset[str]) -> set[str]:
    return {value for value in values if value in ASSIGNABLE_TAB_KEYS}


def get_all_tab_keys(*, include_admin: bool = True) -> list[str]:
    return [tab.key for tab in TAB_DEFINITIONS if include_admin or not tab.is_admin_only]


def get_required_tab_keys(path: str, method: str) -> frozenset[str]:
    clean_path = path.rstrip("/") or "/"
    method = method.upper()

    if clean_path == "/":
        return frozenset({"dashboard"})
    if clean_path.startswith("/admin"):
        return frozenset({"admin"})
    if clean_path.startswith("/payments") or clean_path.startswith("/exchange-rates"):
        return frozenset({"payments"})

    if clean_path == "/currencies" or clean_path.startswith("/currencies/"):
        return frozenset({"payments", "banks"}) if method == "GET" else frozenset({"admin"})

    if clean_path == "/company-bank-accounts" or clean_path.startswith("/company-bank-accounts/"):
        return frozenset({"payments", "banks"})

    if clean_path == "/bank-accounts" or clean_path.startswith("/bank-accounts/"):
        return frozenset({"payments", "banks"}) if method == "GET" else frozenset({"banks"})
    if clean_path == "/banks" or clean_path.startswith("/banks/"):
        return frozenset({"banks"})

    if clean_path == "/companies" or clean_path.startswith("/companies/"):
        return frozenset({"payments", "companies", "banks"}) if method == "GET" else frozenset({"companies"})
    if clean_path == "/clients" or clean_path.startswith("/clients/"):
        return frozenset({"payments", "clients"}) if method == "GET" else frozenset({"clients"})
    if clean_path == "/counterparties" or clean_path.startswith("/counterparties/"):
        return frozenset({"payments", "counterparties"}) if method == "GET" else frozenset({"counterparties"})

    return frozenset()


def can_access_required_tabs(
    *,
    is_superuser: bool,
    granted_tab_keys: set[str] | frozenset[str],
    required_tab_keys: frozenset[str],
) -> bool:
    if is_superuser:
        return True
    if not required_tab_keys:
        return False
    if "admin" in required_tab_keys:
        return False
    return bool(required_tab_keys.intersection(granted_tab_keys))
