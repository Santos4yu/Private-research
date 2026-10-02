import importlib.util
import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch

import account_auth as accounts
import auth_core
import site_controls as controls
import site_members
import temporary_access
from api.session import handler
from v2.board import admin_auth, store


class TemporaryAccessTests(unittest.TestCase):
    def setUp(self):
        self.enterContext(patch.object(temporary_access, 'ENABLED', True))
        self.enterContext(patch.object(accounts, '_kv', return_value=None))
        self.read = self.enterContext(patch.object(store, 'get', side_effect=store.StorageUnavailable('storage_capacity', 120)))
        self.write = self.enterContext(patch.object(store, 'set'))
        self.identity = self.enterContext(patch.object(accounts, 'identity', side_effect=AssertionError('Guest research must not load account identity')))
        self.members = self.enterContext(patch.object(site_members, 'read_rules', side_effect=AssertionError('Guest research must not load private member rules')))
        self.admin = self.enterContext(patch.object(admin_auth, 'is_admin_request', return_value=False))

    def test_public_gate_does_not_depend_on_database(self):
        policy = controls.read()
        self.assertFalse(policy['requireLogin'])
        self.assertTrue(policy['temporaryPublicAccess'])
        self.assertTrue(policy['storageUnavailable'])
        self.assertFalse(policy['registrationOpen'])
        self.write.assert_not_called()

    def test_public_research_and_finder_allowed_but_private_sections_closed(self):
        for tab in temporary_access.PUBLIC_TABS:
            self.assertTrue(controls.allowed({}, tab), tab)
        for sport in controls.FINDER_SPORTS:
            self.assertTrue(controls.finder_sport_allowed({}, sport), sport)
        for tab in ('moneyline', 'community', 'moves'):
            self.assertFalse(controls.allowed({}, tab), tab)
        self.identity.assert_not_called()
        self.members.assert_not_called()

    def test_both_data_gates_grant_visitor_not_admin_or_member(self):
        with patch.object(auth_core, 'FREE_BETA_MODE', False):
            for gate in (auth_core.session_from_request_headers, auth_core.session_with_live_access):
                session = gate({'Cookie': 'old-member-cookie'})
                self.assertEqual(session, temporary_access.visitor())
                self.assertNotEqual(session['id'], 'admin')
                self.assertNotIn('email', session)
        self.identity.assert_not_called()

    def test_site_status_opens_shell_without_refreshing_or_clearing_cookies(self):
        request = object.__new__(handler)
        request.path = '/api/session?action=site-status'
        request.headers = {'Cookie': 'old-member-cookie'}
        with patch.object(accounts, 'ensure_session') as refresh, patch.object(request, '_json') as send:
            request.do_GET()
        status, payload, cookies = send.call_args.args
        self.assertEqual(status, 200)
        self.assertFalse(payload['requireLogin'])
        self.assertFalse(payload['isAdmin'])
        self.assertIsNone(payload['account'])
        self.assertFalse(payload['accountsConfigured'])
        self.assertFalse(payload['refreshAvailable'])
        self.assertEqual(cookies, [])
        refresh.assert_not_called()

    def test_working_storage_preserves_maintenance_and_disabled_features(self):
        saved = {**controls.DEFAULT, 'maintenance': True, 'disabledTabs': ['builder'],
                 'disabledFinderSports': ['nfl'], 'tabsSeen': list(controls.TABS),
                 'finderSportsSeen': list(controls.FINDER_SPORTS)}
        self.read.side_effect = None
        self.read.return_value = json.dumps(saved)
        policy = controls.read()
        self.assertTrue(policy['maintenance'])
        self.assertIn('builder', policy['disabledTabs'])
        self.assertIn('community', policy['disabledTabs'])
        self.assertEqual(policy['disabledFinderSports'], ['nfl'])
        self.assertIsNone(auth_core.session_with_live_access({}))
        self.assertFalse(controls.allowed({}, 'finder'))
        self.assertTrue(controls.read_saved()['requireLogin'])
        self.write.assert_not_called()

    def test_mode_off_restores_saved_login_policy_and_fail_closed_outage(self):
        with patch.object(temporary_access, 'ENABLED', False):
            with self.assertRaises(store.StorageUnavailable):
                controls.read()
            self.read.side_effect = None
            self.read.return_value = json.dumps(controls.DEFAULT)
            self.assertTrue(controls.read()['requireLogin'])
            self.assertNotIn('temporaryPublicAccess', controls.read())

    def test_existing_verified_admin_session_remains_admin(self):
        self.admin.return_value = True
        self.assertEqual(auth_core.session_with_live_access({})['id'], 'admin')
        self.assertTrue(controls.allowed({}, 'moneyline'))
        request = object.__new__(handler)
        request.path = '/api/session?action=site-status'
        request.headers = {}
        with patch.object(request, '_json') as send:
            request.do_GET()
        self.assertTrue(send.call_args.args[1]['isAdmin'])

    def admin_module(self):
        spec = importlib.util.spec_from_file_location('temporary_access_admin', Path(__file__).resolve().parents[1] / 'api/v2-admin.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_guest_cannot_load_admin_settings_or_delete_member_posts(self):
        module = self.admin_module()
        request = object.__new__(module.handler)
        request.headers = {'Origin': 'https://site.invalid', 'Host': 'site.invalid'}
        request.path = '/api/v2-admin?action=site-settings'
        with patch.object(request, '_send') as send:
            request.do_GET()
        self.assertEqual(send.call_args.args[0], 401)
        body = json.dumps({'action': 'community-delete', 'postId': 'not-owned'}).encode()
        request.headers['Content-Length'] = str(len(body))
        request.rfile = io.BytesIO(body)
        with patch.object(request, '_send') as send:
            request.do_POST()
        self.assertEqual(send.call_args.args[0], 401)
        self.write.assert_not_called()

    def test_guest_cannot_write_admin_settings(self):
        module = self.admin_module()
        request = object.__new__(module.handler)
        body = json.dumps({'action': 'site-settings', 'settings': {}}).encode()
        request.headers = {'Content-Length': str(len(body))}
        request.rfile = io.BytesIO(body)
        with patch.object(request, '_send') as send:
            request.do_POST()
        self.assertEqual(send.call_args.args[0], 401)
        self.write.assert_not_called()

    def test_admin_unlock_still_fails_closed_when_storage_is_unavailable(self):
        module = self.admin_module()
        request = object.__new__(module.handler)
        body = json.dumps({'action': 'auth', 'pin': 'test-only'}).encode()
        request.headers = {'Content-Length': str(len(body))}
        request.rfile = io.BytesIO(body)
        with patch.object(store, 'KV_URL', 'https://storage.invalid'), patch.object(store, 'KV_TOKEN', 'test-only'), patch.object(request, '_send') as send, patch.object(admin_auth, 'check_pin') as check, patch.object(admin_auth, 'create_admin_token') as token:
            request.do_POST()
        self.assertEqual(send.call_args.args[0], 503)
        check.assert_not_called()
        token.assert_not_called()


if __name__ == '__main__':
    unittest.main()
