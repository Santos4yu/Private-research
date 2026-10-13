import base64
import hashlib
import hmac
import io
import json
import os
import time
import unittest
from unittest.mock import patch

import account_auth as accounts
import auth_core
import site_controls as controls
import site_members as members
import temporary_access
import whop_billing as billing

# Nothing here may reach the real KV store or Whop.
_kv_off = patch.object(accounts, '_kv', return_value=None)
_public_off = patch.object(temporary_access, 'ENABLED', False)
_whop_off = patch.object(billing.requests, 'request', side_effect=AssertionError('no network in tests'))


def setUpModule():
    _kv_off.start(); _public_off.start(); _whop_off.start()


def tearDownModule():
    _whop_off.stop(); _public_off.stop(); _kv_off.stop()


SECRET = 'ws_test_secret'
ENV = {'WHOP_API_KEY': 'apik_test', 'WHOP_WEBHOOK_SECRET': SECRET, 'WHOP_PLAN_IDS': 'plan_month123,plan_year1234'}
MEMBER = {'id': 'uid-1', 'email': 'Member@Example.com', 'account': True}


class FakeStore:
    def __init__(self):self.data = {}
    def get(self, key, **_):return self.data.get(key)
    def set(self, key, value, **_):self.data[key] = value; return True


def membership(status='active', mid='mem_aaaa1111', account='uid-1', email='member@example.com', ends='2099-01-01T00:00:00Z'):
    return {'id': mid, 'status': status, 'plan': {'id': 'plan_month123'}, 'renewal_period_end': ends,
            'cancel_at_period_end': status == 'canceling', 'manage_url': 'https://whop.com/orders/x',
            'metadata': {'ace_account_id': account, 'ace_email': email} if account else {},
            'user': {'email': email}}


def signed(body, secret=SECRET, stamp=None, msg_id='msg_1'):
    stamp = str(int(stamp or time.time()))
    sig = base64.b64encode(hmac.new(secret.encode(), f'{msg_id}.{stamp}.'.encode() + body, hashlib.sha256).digest()).decode()
    return {'webhook-id': msg_id, 'webhook-timestamp': stamp, 'webhook-signature': f'v1,{sig}'}


@patch.dict(os.environ, ENV)
class BillingTests(unittest.TestCase):
    def setUp(self):
        self.store = FakeStore()
        patch.object(billing, '_store', return_value=self.store).start()
        patch.object(members, 'read_rules', return_value={}).start()
        billing._access_cache.clear(); billing._plans_cache.update(at=0.0, value=None)
        self.addCleanup(patch.stopall)

    def api(self, routes):
        return patch.object(billing, '_call', side_effect=lambda method, path, body=None: routes[(method, path)](body) if callable(routes[(method, path)]) else routes[(method, path)])

    # -- webhooks --
    def test_a_signed_webhook_is_accepted_and_anything_else_refused(self):
        body = json.dumps({'type': 'membership.activated', 'data': {'id': 'mem_aaaa1111'}}).encode()
        self.assertEqual(billing.verify_webhook(signed(body), body)['type'], 'membership.activated')
        for headers, raw in ((signed(body, secret='ws_wrong'), body), (signed(body), body + b' '),
                             (signed(body, stamp=time.time() - 3600), body), ({}, body)):
            with self.assertRaises(ValueError):billing.verify_webhook(headers, raw)

    def test_standard_webhooks_whsec_secrets_verify_with_their_decoded_key(self):
        secret = 'whsec_' + base64.b64encode(b'raw-key-bytes').decode()
        body = b'{"type":"membership.updated","data":{}}'
        stamp = str(int(time.time()))
        sig = base64.b64encode(hmac.new(b'raw-key-bytes', f'm.{stamp}.'.encode() + body, hashlib.sha256).digest()).decode()
        with patch.dict(os.environ, {'WHOP_WEBHOOK_SECRET': secret}):
            billing.verify_webhook({'webhook-id': 'm', 'webhook-timestamp': stamp, 'webhook-signature': f'v1,bogus v1,{sig}'}, body)

    def test_a_webhook_is_never_trusted_the_membership_is_reread_from_whop(self):
        # The event claims active; Whop says it expired. Whop wins.
        with self.api({('GET', '/memberships/mem_aaaa1111'): membership('expired')}):
            billing.handle_event({'type': 'membership.activated', 'data': {'id': 'mem_aaaa1111', 'status': 'active'}})
        self.assertFalse(billing.has_paid_access(MEMBER))

    def test_activation_unlocks_by_account_and_cancellation_locks_again(self):
        with self.api({('GET', '/memberships/mem_aaaa1111'): membership('active')}):
            billing.handle_event({'type': 'payment.succeeded', 'data': {'id': 'pay_x', 'membership': {'id': 'mem_aaaa1111'}}})
        self.assertTrue(billing.has_paid_access(MEMBER))
        # Recorded under the account and the email, never the raw webhook.
        self.assertIn(billing.ACCOUNT_KEY + 'uid-1', self.store.data)
        self.assertIn(billing.EMAIL_KEY + 'member@example.com', self.store.data)
        with self.api({('GET', '/memberships/mem_aaaa1111'): membership('expired')}):
            billing.handle_event({'type': 'membership.deactivated', 'data': {'id': 'mem_aaaa1111'}})
        self.assertFalse(billing.has_paid_access(MEMBER))

    def test_cancelled_but_paid_up_and_retrying_payments_keep_access(self):
        for status in ('canceling', 'past_due', 'trialing'):
            with self.subTest(status=status), self.api({('GET', '/memberships/mem_aaaa1111'): membership(status)}):
                billing.sync_membership('mem_aaaa1111')
                self.assertTrue(billing.has_paid_access(MEMBER))

    def test_a_purchase_made_on_whop_directly_unlocks_the_account_with_that_email(self):
        with self.api({('GET', '/memberships/mem_bbbb2222'): membership(mid='mem_bbbb2222', account=None)}):
            billing.sync_membership('mem_bbbb2222')
        self.assertTrue(billing.has_paid_access(MEMBER))
        self.assertFalse(billing.has_paid_access({'id': 'uid-9', 'email': 'other@example.com'}))

    def test_an_old_membership_ending_never_cancels_a_newer_live_one(self):
        with self.api({('GET', '/memberships/mem_new11111'): membership(mid='mem_new11111'),
                       ('GET', '/memberships/mem_old11111'): membership('expired', mid='mem_old11111')}):
            billing.sync_membership('mem_new11111'); billing.sync_membership('mem_old11111')
        self.assertTrue(billing.has_paid_access(MEMBER))

    def test_a_record_left_active_long_after_its_period_is_rechecked(self):
        past = '2020-01-01T00:00:00Z'
        self.store.set(billing.ACCOUNT_KEY + 'uid-1', json.dumps({**billing._record(membership(ends=past)), 'checkedAt': 0}))
        with self.api({('GET', '/memberships/mem_aaaa1111'): membership('expired', ends=past)}):
            self.assertFalse(billing.has_paid_access(MEMBER))

    def test_comped_members_get_in_without_paying(self):
        with patch.object(members, 'read_rules', return_value={'member@example.com': {'comped': True}}):
            self.assertTrue(billing.has_paid_access(MEMBER))
        self.assertFalse(billing.has_paid_access(MEMBER))

    # -- checkout --
    def test_checkout_carries_the_account_and_only_offers_listed_plans(self):
        sent = {}
        with self.api({('POST', '/checkout_configurations'): lambda body: sent.update(body) or {'id': 'ch_abc12345'}}):
            self.assertEqual(billing.start_checkout(MEMBER, 'plan_month123', 'https://site/?checkout=done'), 'ch_abc12345')
        self.assertEqual(sent['metadata'], {'ace_account_id': 'uid-1', 'ace_email': 'member@example.com'})
        with self.assertRaises(ValueError):billing.start_checkout(MEMBER, 'plan_someoneelse', None)

    def test_confirming_someone_elses_payment_grants_nothing(self):
        routes = {('GET', '/payments/pay_abcd1234'): {'membership': {'id': 'mem_cccc3333'}},
                  ('GET', '/memberships/mem_cccc3333'): membership(mid='mem_cccc3333', account='uid-2', email='two@example.com')}
        with self.api(routes):
            self.assertIsNone(billing.confirm_payment(MEMBER, 'pay_abcd1234'))
            self.assertIsNotNone(billing.confirm_payment({'id': 'uid-2', 'email': 'two@example.com'}, 'pay_abcd1234'))

    def test_prices_come_from_whop_with_savings_against_monthly(self):
        routes = {('GET', '/plans/plan_month123'): {'id': 'plan_month123', 'plan_type': 'renewal', 'billing_period': 30, 'renewal_price': 49.99, 'currency': 'usd'},
                  ('GET', '/plans/plan_year1234'): {'id': 'plan_year1234', 'plan_type': 'renewal', 'billing_period': 365, 'renewal_price': 299.99, 'currency': 'usd'}}
        with self.api(routes):views = billing.plans()
        self.assertEqual([(v['label'], v['price'], v['period'], v['savePercent']) for v in views],
                         [('Monthly', 49.99, 'month', 0), ('Annual', 299.99, 'year', 50)])


@patch.dict(os.environ, ENV)
class PaidGateTests(unittest.TestCase):
    def setUp(self):
        patch.object(controls.admin_auth, 'is_admin_request', return_value=False).start()
        patch.object(accounts, 'identity', return_value=MEMBER).start()
        patch.object(members, 'read_rules', return_value={}).start()
        self.addCleanup(patch.stopall)

    def session(self, paid, has_access):
        with patch.object(controls, 'read', return_value={**controls.DEFAULT, 'paidAccess': paid}), \
             patch.object(billing, 'has_paid_access', return_value=has_access):
            return auth_core.session_from_request_headers({}), auth_core.session_with_live_access({})

    def test_research_data_needs_a_subscription_only_while_the_switch_is_on(self):
        self.assertEqual(self.session(True, False), (None, None))
        self.assertEqual(self.session(True, True), (MEMBER, MEMBER))
        self.assertEqual(self.session(False, False), (MEMBER, MEMBER))

    def test_the_switch_is_validated_and_old_settings_leave_it_off(self):
        self.assertFalse(controls.validate({**controls.DEFAULT})['paidAccess'])
        body = {key: value for key, value in controls.DEFAULT.items() if key != 'paidAccess'}
        self.assertFalse(controls.validate(body)['paidAccess'])
        self.assertTrue(controls.validate({**controls.DEFAULT, 'paidAccess': True})['paidAccess'])
        with self.assertRaises(ValueError):controls.validate({**controls.DEFAULT, 'paidAccess': 'yes'})

    def test_free_access_is_a_member_rule(self):
        self.assertTrue(members.validate_rule({'comped': True})['comped'])
        self.assertIsNone(members.validate_rule({'comped': False}))
        self.assertTrue(members.viewer_policy(controls.DEFAULT, {'comped': True})['comped'])


@patch.dict(os.environ, ENV)
class WebhookEndpointTests(unittest.TestCase):
    def post(self, body, headers):
        from api.session import handler
        request = object.__new__(handler)
        request.path = '/api/session?action=whop-webhook'
        request.headers = {'Host': 'www.example.com', 'Content-Length': str(len(body)), **headers}
        request.rfile = io.BytesIO(body)
        sent = {}
        request.send_response = lambda status, *_: sent.update(status=status)
        request.send_header = lambda *_: None
        request.end_headers = lambda: None
        request.wfile = io.BytesIO()
        request.do_POST()
        return sent['status']

    def test_whop_reaches_the_webhook_without_same_origin_and_bad_signatures_bounce(self):
        body = json.dumps({'type': 'membership.activated', 'data': {'id': 'mem_aaaa1111'}}).encode()
        with patch.object(billing, 'handle_event') as handle:
            self.assertEqual(self.post(body, signed(body)), 200)
            handle.assert_called_once()
            self.assertEqual(self.post(body, signed(body, secret='ws_wrong')), 401)
            handle.assert_called_once()

    def test_whop_is_asked_to_retry_when_it_cant_be_reached(self):
        body = b'{"type":"membership.activated","data":{"id":"mem_aaaa1111"}}'
        with patch.object(billing, 'handle_event', side_effect=billing.BillingUnavailable('down')):
            self.assertEqual(self.post(body, signed(body)), 503)


if __name__ == '__main__':
    unittest.main()


@patch.dict(os.environ, ENV)
class SubscriberListTests(unittest.TestCase):
    def setUp(self):
        self.store = FakeStore()
        patch.object(billing, '_store', return_value=self.store).start()
        billing._access_cache.clear(); billing._plans_cache.update(at=0.0, value=None)
        self.addCleanup(patch.stopall)

    def test_live_fields_are_read_and_the_list_counts_who_pays(self):
        # Whop's live shape: plan_id and current_period_end, no user object.
        live = lambda mid, status, plan, email: {'id': mid, 'status': status, 'plan_id': plan, 'current_period_end': '2099-01-01T00:00:00Z',
                                                  'cancel_at_period_end': False, 'metadata': {'ace_account_id': 'u-' + mid, 'ace_email': email},
                                                  'created_at': '2026-10-11T00:00:00Z', 'promo_code_id': None}
        page = {'data': [live('mem_aaaa1111', 'active', 'plan_month123', 'a@example.com'),
                         live('mem_bbbb2222', 'trialing', 'plan_month123', 'b@example.com'),
                         live('mem_cccc3333', 'expired', 'plan_year1234', 'c@example.com')],
                'page_info': {'has_next_page': False}}
        plans = {'/plans/plan_month123': {'id': 'plan_month123', 'plan_type': 'renewal', 'billing_period': 30, 'renewal_price': 7.99, 'currency': 'usd'},
                 '/plans/plan_year1234': {'id': 'plan_year1234', 'plan_type': 'renewal', 'billing_period': 365, 'renewal_price': 59.99, 'currency': 'usd'}}
        with patch.object(billing, '_call', side_effect=lambda method, path, body=None: page if path.startswith('/memberships') else plans[path]):
            out = billing.subscribers(sync=True)
        self.assertEqual(out['counts']['active'], 1)
        self.assertEqual(out['counts']['trialing'], 1)
        self.assertEqual(out['monthly'], 7.99)  # trials and ended memberships don't count
        first = out['members'][0]
        self.assertEqual((first['plan'], first['renewsAt']), ('Monthly', '2099-01-01T00:00:00Z'))
        # Sync recorded each one, with its plan and renewal date.
        saved = json.loads(self.store.data[billing.ACCOUNT_KEY + 'u-mem_aaaa1111'])
        self.assertEqual((saved['planId'], saved['renewsAt'], saved['active']), ('plan_month123', '2099-01-01T00:00:00Z', True))
