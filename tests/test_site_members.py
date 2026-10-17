import json
import unittest
from unittest.mock import patch

import account_auth as accounts
import auth_core
import site_controls as controls
import site_members as members
import temporary_access

# Same rule as test_site_access.py: nothing here may reach the real KV store.
_kv_off = patch.object(accounts, '_kv', return_value=None)
_public_off = patch.object(temporary_access, 'ENABLED', False)


def setUpModule():
    _kv_off.start()
    _public_off.start()


def tearDownModule():
    _public_off.stop()
    _kv_off.stop()


MEMBER = {'id': 'uid-1', 'email': 'Tester@Example.com', 'account': True}
OTHER = {'id': 'uid-2', 'email': 'someone@example.com', 'account': True}


class FakeStore:
    """In-memory stand-in for v2.board.store's get/set."""

    def __init__(self):
        self.data = {}

    def get(self, key, **_):
        return self.data.get(key)

    def set(self, key, value):
        self.data[key] = value
        return True


class MemberRuleTests(unittest.TestCase):
    def setUp(self):
        members.forget_cached_rules()
        self.addCleanup(members.forget_cached_rules)

    def test_emails_are_normalized_and_validated(self):
        self.assertEqual(members.normalize_email('  Tester@Example.COM '), 'tester@example.com')
        for value in ('', 'no-at-sign', 'two@@example.com', 'a b@example.com', '@example.com', 'name@', None, 'x' * 250 + '@e.co'):
            self.assertEqual(members.normalize_email(value), '', value)

    def test_rule_validation(self):
        rule = members.validate_rule({'access': {'tab:finder': True, 'finderSport:nfl': False}, 'badge': 'vip', 'note': ' beta '})
        self.assertEqual(rule['access'], {'finderSport:nfl': False, 'tab:finder': True})
        self.assertEqual((rule['badge'], rule['note'], rule['suspended']), ('vip', 'beta', False))
        for body in ({'access': {'tab:admin': True}}, {'access': {'tab:finder': 'yes'}}, {'badge': 'owner'},
                     {'suspended': 'true'}, {'note': 'x' * 201}, {'access': []}, 'nope'):
            with self.assertRaises(ValueError, msg=body):
                members.validate_rule(body)

    def test_a_rule_back_at_defaults_is_removed(self):
        self.assertIsNone(members.validate_rule({'access': {}, 'badge': '', 'suspended': False, 'note': '  '}))
        fake = FakeStore()
        with patch.object(members, 'store', fake):
            members.save_rule('tester@example.com', members.validate_rule({'badge': 'pro'}))
            self.assertIn('tester@example.com', members.read_rules())
            members.save_rule('Tester@Example.com', None)
            self.assertEqual(members.read_rules(), {})

    def test_viewer_policy_applies_overrides_on_top_of_site_switches(self):
        policy = {**controls.DEFAULT, 'disabledTabs': ['finder', 'community'], 'disabledFinderSports': ['nfl']}
        rule = {'access': {'tab:finder': True, 'finderSport:nfl': True, 'tab:research': False}, 'badge': 'tester'}
        viewer = members.viewer_policy(policy, rule)
        self.assertEqual(sorted(viewer['disabledTabs']), ['community', 'research'])
        self.assertEqual(viewer['disabledFinderSports'], [])
        self.assertEqual(viewer['badge'], {'key': 'tester', 'label': 'Tester'})
        self.assertFalse(viewer['suspended'])
        self.assertNotIn('note', viewer)
        # No rule: exactly the site's own switches.
        plain = members.viewer_policy(policy, None)
        self.assertEqual(sorted(plain['disabledTabs']), ['community', 'finder'])
        self.assertEqual(plain['disabledFinderSports'], ['nfl'])
        self.assertIsNone(plain['badge'])

    def test_list_merges_signed_in_members_with_rules(self):
        fake = FakeStore()
        fake.data[members.RULES_KEY] = json.dumps({'rules': {'new@example.com': {'badge': 'vip'}}})
        seen = ['a@example.com', json.dumps({'id': 'a', 'lastSeen': '2026-09-01T00:00:00+00:00'}),
                'b@example.com', json.dumps({'id': 'b', 'lastSeen': '2026-09-20T00:00:00+00:00'})]
        with patch.object(members, 'store', fake), patch.object(members, '_pipeline',
                                                                return_value=[{'result': seen}, {'result': ['a@example.com', '2026-08-01T00:00:00+00:00']}]):
            listed = members.list_members()
        self.assertEqual([entry['email'] for entry in listed], ['b@example.com', 'a@example.com', 'new@example.com'])
        self.assertEqual(listed[1]['firstSeen'], '2026-08-01T00:00:00+00:00')
        self.assertEqual(listed[2]['rule'], {'badge': 'vip'})

    def test_touch_is_throttled_per_member(self):
        members._touched.clear()
        with patch.object(members, '_pipeline') as pipeline:
            members.touch(MEMBER)
            members.touch(MEMBER)
            members.touch({'id': 'x', 'email': 'not an email'})
        self.assertEqual(pipeline.call_count, 1)
        command = pipeline.call_args.args[0][0]
        self.assertEqual(command[:3], ['HSET', members.SEEN_KEY, 'tester@example.com'])

    def test_member_since_is_their_first_sign_in(self):
        with patch.object(members, '_pipeline', return_value=[{'result': '2026-10-01T12:00:00+00:00'}]) as pipeline:
            self.assertEqual(members.member_since({'email': ' Fan@Example.com'}), '2026-10-01T12:00:00+00:00')
        self.assertEqual(pipeline.call_args[0][0], [['HGET', members.FIRST_SEEN_KEY, 'fan@example.com']])
        with patch.object(members, '_pipeline', side_effect=RuntimeError('down')):
            self.assertIsNone(members.member_since({'email': 'fan@example.com'}))
        with patch.object(members, '_pipeline', return_value=None):
            self.assertIsNone(members.member_since({'email': 'fan@example.com'}))
        self.assertIsNone(members.member_since({}))

    def test_community_badges(self):
        rules = {'tester@example.com': {'badge': 'staff'}}
        posts = [{'id': 'p1', 'authorId': 'uid-1', 'authorName': 'Tester@example.com'},
                 {'id': 'p2', 'authorId': 'admin', 'authorName': 'Administrator'},
                 {'id': 'p3', 'authorId': 'uid-2', 'authorName': 'someone@example.com'}]
        with patch.object(members, 'read_rules', return_value=rules):
            badges = members.author_badges(posts)
        self.assertEqual(badges, {'p1': {'key': 'staff', 'label': 'Staff'}, 'p2': {'key': 'admin', 'label': 'Admin'}})


class EnforcementTests(unittest.TestCase):
    """The server, not just the page, decides what each member can load."""

    def check(self, policy, rules, account, call):
        with patch.object(controls, 'read', return_value={**controls.DEFAULT, **policy}), \
                patch.object(controls.admin_auth, 'is_admin_request', return_value=False), \
                patch.object(members, 'read_rules', return_value=rules), \
                patch.object(accounts, 'identity', return_value=account) as identity:
            return call(), identity

    def test_early_access_opens_a_switched_off_section_for_that_member_only(self):
        rules = {'tester@example.com': {'access': {'tab:v2': True, 'tab:finder': True, 'finderSport:nfl': True}}}
        policy = {'disabledTabs': ['v2', 'finder'], 'disabledFinderSports': ['nfl']}
        self.assertTrue(self.check(policy, rules, MEMBER, lambda: controls.allowed({}, 'v2'))[0])
        self.assertTrue(self.check(policy, rules, MEMBER, lambda: controls.finder_sport_allowed({}, 'nfl'))[0])
        self.assertFalse(self.check(policy, rules, OTHER, lambda: controls.allowed({}, 'v2'))[0])
        self.assertFalse(self.check(policy, rules, OTHER, lambda: controls.finder_sport_allowed({}, 'nfl'))[0])
        self.assertFalse(self.check(policy, rules, None, lambda: controls.allowed({}, 'v2'))[0])

    def test_removed_section_closes_for_that_member_only(self):
        rules = {'tester@example.com': {'access': {'tab:research': False, 'sport:nfl': False}}}
        self.assertFalse(self.check({}, rules, MEMBER, lambda: controls.allowed({}, 'research'))[0])
        self.assertTrue(self.check({}, rules, MEMBER, lambda: controls.allowed({}, 'slate'))[0])
        self.assertFalse(self.check({}, rules, MEMBER, lambda: controls.allowed({}, 'research', sport='nfl'))[0])
        self.assertTrue(self.check({}, rules, OTHER, lambda: controls.allowed({}, 'research', sport='nfl'))[0])

    def test_suspended_member_is_refused_everywhere(self):
        rules = {'tester@example.com': {'suspended': True}}
        for call in (lambda: controls.allowed({}, 'research'), lambda: controls.allowed({}),
                     lambda: controls.finder_sport_allowed({}, 'wnba')):
            self.assertFalse(self.check({}, rules, MEMBER, call)[0])
            self.assertTrue(self.check({}, rules, OTHER, call)[0])
        self.assertIsNone(self.check({'requireLogin': True}, rules, MEMBER, lambda: auth_core.session_from_request_headers({}))[0])
        self.assertIsNone(self.check({'requireLogin': True}, rules, MEMBER, lambda: auth_core.session_with_live_access({}))[0])
        self.assertEqual(self.check({'requireLogin': True}, rules, OTHER, lambda: auth_core.session_from_request_headers({}))[0], OTHER)

    def test_early_access_never_opens_maintenance(self):
        rules = {'tester@example.com': {'access': {'tab:research': True}}}
        self.assertFalse(self.check({'maintenance': True}, rules, MEMBER, lambda: controls.allowed({}, 'research'))[0])

    def test_identity_is_only_looked_up_when_a_rule_could_change_the_answer(self):
        rules = {'tester@example.com': {'access': {'tab:v2': True}}}
        allowed, identity = self.check({}, rules, MEMBER, lambda: controls.allowed({}, 'research'))
        self.assertTrue(allowed)
        identity.assert_not_called()
        allowed, identity = self.check({}, {}, MEMBER, lambda: controls.finder_sport_allowed({}, 'mlb'))
        self.assertTrue(allowed)
        identity.assert_not_called()

    def test_admin_only_sections_stay_closed_to_everyone_else(self):
        # Moneylines: not even a member's own early-access rule opens it.
        rules = {'tester@example.com': {'access': {'tab:moneyline': True}}}
        self.assertFalse(self.check({}, rules, MEMBER, lambda: controls.allowed({}, 'moneyline'))[0])
        self.assertFalse(self.check({}, {}, OTHER, lambda: controls.allowed({}, 'moneyline'))[0])
        self.assertNotIn('tab:moneyline', members.access_items())
        with patch.object(controls, 'read', return_value=dict(controls.DEFAULT)), \
                patch.object(controls.admin_auth, 'is_admin_request', return_value=True):
            self.assertTrue(controls.allowed({}, 'moneyline'))

    def test_admins_bypass_member_rules(self):
        with patch.object(controls, 'read', return_value=dict(controls.DEFAULT)), \
                patch.object(controls.admin_auth, 'is_admin_request', return_value=True), \
                patch.object(members, 'read_rules', return_value={'tester@example.com': {'suspended': True}}):
            self.assertTrue(controls.allowed({}, 'research'))


class RouteTests(unittest.TestCase):
    def site_status(self, account, rules):
        from api.session import handler
        request = object.__new__(handler)
        request.path = '/api/session?action=site-status'
        request.headers = {}
        policy = {**controls.DEFAULT, 'disabledTabs': ['finder']}
        with patch.object(accounts, 'ensure_session', return_value=(account, [], False)), \
                patch.object(controls, 'read', return_value=policy), \
                patch.object(members, 'read_rules', return_value=rules), \
                patch.object(members, 'touch'), patch.object(request, '_json') as send:
            request.do_GET()
        return send.call_args.args[1]

    def test_site_status_sends_the_members_own_view_without_admin_notes(self):
        rules = {'tester@example.com': {'access': {'tab:finder': True}, 'badge': 'vip', 'suspended': True, 'note': 'private'}}
        body = self.site_status(dict(MEMBER), rules)
        self.assertEqual(body['disabledTabs'], [])
        self.assertTrue(body['suspended'])
        self.assertEqual(body['badge'], {'key': 'vip', 'label': 'VIP'})
        self.assertNotIn('private', json.dumps(body))
        signed_out = self.site_status(None, rules)
        self.assertEqual(signed_out['disabledTabs'], ['finder'])
        self.assertNotIn('suspended', signed_out)


def load_admin_handler():
    import importlib.util
    from pathlib import Path
    spec = importlib.util.spec_from_file_location('v2_admin', Path(__file__).resolve().parents[1] / 'api' / 'v2-admin.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.handler


class AdminRouteTests(unittest.TestCase):
    def call(self, method, body=None, query='', admin=True, same_origin=True):
        import io
        handler = load_admin_handler()
        request = object.__new__(handler)
        raw = json.dumps(body or {}).encode()
        request.path = '/api/v2-admin' + query
        request.headers = {'Content-Length': str(len(raw)), 'Origin': 'https://example.com',
                           'Host': 'example.com' if same_origin else 'evil.com'}
        request.rfile = io.BytesIO(raw)
        with patch.object(controls.admin_auth, 'is_admin_request', return_value=admin), \
                patch.object(request, '_send') as send:
            getattr(request, method)()
        return send.call_args.args

    def test_members_routes_are_admin_only(self):
        self.assertEqual(self.call('do_GET', query='?action=members', admin=False)[0], 401)
        self.assertEqual(self.call('do_POST', {'action': 'member-rule', 'email': 'a@example.com', 'rule': {}}, admin=False)[0], 401)

    def test_member_rule_requires_same_origin_and_valid_input(self):
        self.assertEqual(self.call('do_POST', {'action': 'member-rule', 'email': 'a@example.com', 'rule': {}}, same_origin=False)[0], 403)
        self.assertEqual(self.call('do_POST', {'action': 'member-rule', 'email': 'nope', 'rule': {}})[0], 400)
        self.assertEqual(self.call('do_POST', {'action': 'member-rule', 'email': 'a@example.com', 'rule': {'badge': 'owner'}})[0], 400)

    def test_member_rule_saves(self):
        fake = FakeStore()
        with patch.object(members, 'store', fake), patch.object(members, '_pipeline', return_value=None):
            status, body = self.call('do_POST', {'action': 'member-rule', 'email': 'A@Example.com',
                                                 'rule': {'access': {'tab:finder': True}, 'badge': 'tester'}})
        self.assertEqual(status, 200)
        self.assertEqual(body['member']['email'], 'a@example.com')
        self.assertEqual(body['member']['rule']['badge'], 'tester')
        self.assertIn('a@example.com', json.loads(fake.data[members.RULES_KEY])['rules'])


if __name__ == '__main__':
    unittest.main()
