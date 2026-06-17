from unittest import TestCase, main

from app.core.permissions import can_access_required_tabs, get_required_tab_keys


class PermissionRuleTests(TestCase):
    def test_admin_can_access_admin_tab(self):
        assert can_access_required_tabs(
            is_superuser=True,
            granted_tab_keys=set(),
            required_tab_keys=get_required_tab_keys('/admin', 'GET'),
        )

    def test_regular_user_cannot_access_admin_tab(self):
        assert not can_access_required_tabs(
            is_superuser=False,
            granted_tab_keys={'admin'},
            required_tab_keys=get_required_tab_keys('/admin/users', 'GET'),
        )

    def test_payment_tab_allows_payment_routes(self):
        assert can_access_required_tabs(
            is_superuser=False,
            granted_tab_keys={'payments'},
            required_tab_keys=get_required_tab_keys('/payments/1', 'GET'),
        )

    def test_missing_tab_denies_reference_mutation(self):
        assert not can_access_required_tabs(
            is_superuser=False,
            granted_tab_keys={'payments'},
            required_tab_keys=get_required_tab_keys('/clients/1', 'PUT'),
        )

    def test_payment_tab_can_read_client_lookup(self):
        assert can_access_required_tabs(
            is_superuser=False,
            granted_tab_keys={'payments'},
            required_tab_keys=get_required_tab_keys('/clients', 'GET'),
        )


if __name__ == '__main__':
    main()
