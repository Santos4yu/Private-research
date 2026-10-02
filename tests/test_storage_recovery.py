"""Outage recovery must never bypass shared authentication protection."""
import importlib.util
import io
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import account_auth as accounts
import site_controls
import temporary_access
from api.session import handler
from v2.board import store


def response(data, status=200):
    return SimpleNamespace(status_code=status, json=lambda: data)


class StorageRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.enterContext(patch.object(temporary_access, 'ENABLED', False))
        self.enterContext(patch.object(store, 'KV_URL', 'https://storage.example.invalid'))
        self.enterContext(patch.object(store, 'KV_TOKEN', 'test-only-secret'))
        self.enterContext(patch.object(store, '_blocked_until', 0))
        self.enterContext(patch.object(store, '_failure', None))
        self.enterContext(patch.object(store, '_read_cache', {}))
        self.clock = self.enterContext(patch.object(store.time, 'monotonic', return_value=100))
        self.get = self.enterContext(patch.object(store.requests, 'get'))
        self.post = self.enterContext(patch.object(store.requests, 'post'))
        self.enterContext(patch.object(accounts, '_kv', return_value=None))

    def capacity(self):
        return response({'error': 'ERR This database has reached current Fixed plan limits. internal detail'}, 403)

    def test_capacity_is_safe_and_typed(self):
        self.get.return_value = self.capacity()
        with self.assertRaises(store.StorageUnavailable) as failure:
            store.get('private-key')
        payload = failure.exception.payload()
        self.assertEqual(payload['code'], 'storage_capacity')
        self.assertEqual(payload['retryAfter'], 120)
        for secret in ('example.invalid', 'test-only-secret', 'private-key', 'internal detail'):
            self.assertNotIn(secret, json.dumps(payload))

    def test_breaker_stops_reads_writes_and_pipelines_then_recovers(self):
        self.get.return_value = self.capacity()
        for operation in (lambda: store.get('a'), lambda: store.get('b'),
                          lambda: store.set('a', 'x'), lambda: store.pipeline([['INCR', 'counter']])):
            with self.assertRaises(store.StorageUnavailable):
                operation()
        self.assertEqual(self.get.call_count, 1)
        self.post.assert_not_called()
        self.clock.return_value = 221
        self.get.return_value = response({'result': 'restored'})
        self.assertEqual(store.get('a'), 'restored')
        self.assertIsNone(store._failure)

    def test_policy_cache_is_short_and_expired_policy_never_served_on_failure(self):
        self.get.return_value = response({'result': '{}'})
        site_controls.read()
        site_controls.read()
        self.assertEqual(self.get.call_count, 1)
        self.clock.return_value = 111
        self.get.return_value = self.capacity()
        with self.assertRaises(store.StorageUnavailable):
            site_controls.read()

    def test_default_reads_are_never_cached(self):
        self.get.return_value = response({'result': '0'})
        store.get(store.PIN_LOCK_UNTIL_KEY)
        store.get(store.PIN_LOCK_UNTIL_KEY)
        self.assertEqual(self.get.call_count, 2)

    def test_write_invalidates_cached_metadata(self):
        self.get.return_value = response({'result': 'old'})
        self.assertEqual(store.get('policy', cache_seconds=10), 'old')
        self.post.return_value = response({'result': 'OK'})
        store.set('policy', 'new')
        self.get.return_value = response({'result': 'new'})
        self.assertEqual(store.get('policy', cache_seconds=10), 'new')
        self.assertEqual(self.get.call_count, 2)

    def test_rate_limit_preserved_and_never_cached(self):
        self.post.side_effect = [response([{'result': 20}, {'result': 1}]), response([{'result': 21}, {'result': 0}])]
        self.assertTrue(accounts.rate_allowed({}, 'test@example.invalid'))
        self.assertFalse(accounts.rate_allowed({}, 'test@example.invalid'))
        self.assertEqual(self.post.call_count, 2)
        self.assertEqual(self.post.call_args.kwargs['json'][1][2:], [900, 'NX'])

    def test_malformed_counter_and_partial_pipeline_fail_closed(self):
        for data in ([{'result': True}, {'result': 1}], [{'result': 1}, {'error': 'private detail'}], {'result': 1}):
            self.post.return_value = response(data)
            with self.assertRaises(store.StorageUnavailable):
                accounts.rate_allowed({})

    def test_sign_in_storage_failure_never_calls_supabase(self):
        request = object.__new__(handler)
        body = json.dumps({'action': 'sign-in', 'email': 'test@example.invalid', 'password': 'test-only-password'}).encode()
        request.headers = {'Origin': 'https://site.example.invalid', 'Host': 'site.example.invalid', 'Content-Length': str(len(body))}
        request.rfile = io.BytesIO(body)
        self.post.return_value = self.capacity()
        with patch.object(request, '_json') as send, patch.object(accounts, 'call') as provider:
            request.do_POST()
        self.assertEqual(send.call_args.args[0], 503)
        self.assertEqual(send.call_args.args[1]['code'], 'storage_capacity')
        provider.assert_not_called()

    def test_site_status_outage_returns_json_not_default_open_policy(self):
        request = object.__new__(handler)
        request.path = '/api/session?action=site-status'
        request.headers = {}
        self.get.return_value = self.capacity()
        with patch.object(request, '_json') as send, patch.object(accounts, 'ensure_session', return_value=(None, [], False)):
            request.do_GET()
        self.assertEqual(send.call_args.args[0], 503)
        self.assertNotIn('registrationOpen', send.call_args.args[1])

    def test_admin_outage_does_not_check_pin_or_issue_cookie(self):
        spec = importlib.util.spec_from_file_location('admin_recovery_test', Path(__file__).resolve().parents[1] / 'api/v2-admin.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        request = object.__new__(module.handler)
        body = json.dumps({'action': 'auth', 'pin': 'test-only'}).encode()
        request.headers = {'Content-Length': str(len(body))}
        request.rfile = io.BytesIO(body)
        self.get.return_value = self.capacity()
        with patch.object(request, '_send') as send, patch.object(module.admin_auth, 'check_pin') as check, patch.object(module.admin_auth, 'create_admin_token') as token:
            request.do_POST()
        self.assertEqual(send.call_args.args[0], 503)
        check.assert_not_called()
        token.assert_not_called()

    def test_unconfigured_auth_protection_fails_closed(self):
        with patch.object(store, 'KV_TOKEN', ''):
            for operation in (store.is_pin_locked_out, store.clear_pin_failures, store.record_pin_failure, lambda: accounts.rate_allowed({})):
                with self.assertRaises(store.StorageUnavailable):
                    operation()
        self.get.assert_not_called()
        self.post.assert_not_called()

    def test_transport_failure_does_not_expose_endpoint(self):
        self.get.side_effect = store.requests.ConnectionError('secret endpoint detail')
        with self.assertRaises(store.StorageUnavailable) as error:
            store.get('key')
        self.assertNotIn('secret endpoint', str(error.exception))


if __name__ == '__main__':
    unittest.main()
