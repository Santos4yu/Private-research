import base64
import copy
import json
import unittest
import zlib
from types import SimpleNamespace
from unittest.mock import patch

import account_auth
import finder_history_store
import line_moves
import site_controls
import site_members
import tennis_live
from tools import storage_migration as migration
from v2.board import store


def backup():
    return {'version': 1, 'source': migration.SOURCE, 'complete': True, 'writersPaused': True,
            'entries': [
                {'key': migration.POLICY, 'kind': 'string', 'value': json.dumps({
                    'requireLogin': True, 'registrationOpen': False, 'disabledTabs': ['nrfi','moneyline'],
                    'disabledSports': ['nfl'], 'disabledFinderSports': ['cs2','nfl']})},
                {'key': migration.RULES, 'kind': 'string', 'value': '{"rules":{}}'},
                {'key': 'hash', 'kind': 'hash', 'value': {"a'b\\x": 'large'*2000}},
                {'key': 'moves', 'kind': 'list', 'value': ['one','two']},
                {'key': 'players', 'kind': 'zset', 'value': {'player': 123.5}},
                {'key': 'expired', 'kind': 'string', 'value': 'lease', 'expiresAt': 1},
                {'key': 'future', 'kind': 'string', 'value': 'lease', 'expiresAt': 4102444800},
            ]}


class SupabaseStorageTests(unittest.TestCase):
    def setUp(self):
        self.enterContext(patch.object(store, 'STORAGE_BACKEND', 'supabase'))
        self.enterContext(patch.object(store, 'SUPABASE_URL', 'https://project.example.invalid'))
        self.enterContext(patch.object(store, 'SUPABASE_STORAGE_KEY', 'sb_secret_test-only'))
        self.enterContext(patch.object(store, '_failure', None))
        self.enterContext(patch.object(store, '_blocked_until', 0))
        self.enterContext(patch.object(store, '_read_cache', {}))
        self.get = self.enterContext(patch.object(store.requests, 'get'))
        self.post = self.enterContext(patch.object(store.requests, 'post'))
        self.post.return_value = SimpleNamespace(status_code=200, json=lambda: [{'result': 'OK'}])

    def test_no_privileged_key_never_falls_back_to_upstash_or_anon(self):
        with patch.object(store, 'SUPABASE_STORAGE_KEY', ''):
            self.assertFalse(store.configured())
            for run in (lambda: store.get('x'), lambda: store.set('x','y'), lambda: store.pipeline([['INCR','x']])):
                with self.assertRaises(store.StorageUnavailable): run()
        self.post.assert_not_called(); self.get.assert_not_called()

    def test_unknown_backend_is_closed(self):
        with patch.object(store, 'STORAGE_BACKEND', 'typo'):
            with self.assertRaises(store.StorageUnavailable): store.get('x')

    def test_secret_and_legacy_key_headers_are_server_only(self):
        for key in ('sb_secret_test-only', 'legacy-test-jwt'):
            with patch.object(store, 'SUPABASE_STORAGE_KEY', key):
                self.assertTrue(store.set('x', 'y', ex=45))
                args, kwargs = self.post.call_args
                self.assertEqual(args[0], 'https://project.example.invalid/rest/v1/rpc/website_storage_pipeline')
                self.assertEqual(kwargs['headers']['apikey'], key)
                self.assertEqual(kwargs['json']['commands'], [['SET','x','y','EX',45]])
                self.assertEqual('Authorization' in kwargs['headers'], not key.startswith('sb_secret_'))

    def test_large_string_compressed_before_upload_and_round_trips(self):
        value = json.dumps({'games': [{'kills': 12,'headshots': 8}]*1000})
        store.set('history', value)
        packed = self.post.call_args.kwargs['json']['commands'][0][2]
        self.assertLess(len(packed), len(value)//10)
        self.post.return_value.json = lambda: [{'result': packed}]
        self.assertEqual(store.get('history'), value)

    def test_literal_codec_prefix_and_unicode_round_trip(self):
        for value in ('~kd-storage-v1:z:literal', '🌀'*6000, '123', ''):
            self.assertEqual(store._unpack(store._pack(value)), value)

    def test_corrupt_and_oversized_compression_fail_closed(self):
        for packed in ('~kd-storage-v1:z:bad!', '~kd-storage-v1:unknown'):
            with self.assertRaises(store.StorageUnavailable): store._unpack(packed)
        with patch.object(store, '_MAX_VALUE_BYTES', 100):
            packed = '~kd-storage-v1:z:' + base64.b64encode(zlib.compress(b'x'*101)).decode()
            with self.assertRaises(store.StorageUnavailable): store._unpack(packed)

    def test_hash_payloads_not_fields_and_list_payloads_decode(self):
        value = 'large'*2000
        commands = [['HSET','h','field',value], ['HSETNX','h','other',value], ['LPUSH','l',value]]
        self.post.return_value.json = lambda: [{'result':1}]*3
        store.pipeline(commands)
        prepared = self.post.call_args.kwargs['json']['commands']
        self.assertEqual(prepared[0][2], 'field')
        self.assertEqual(store._unpack(prepared[0][3]), value)
        self.post.return_value.json = lambda: [{'result': ['field',prepared[0][3]]}, {'result':[prepared[2][2]]}]
        result = store.pipeline([['HGETALL','h'], ['LRANGE','l',0,-1]])
        self.assertEqual(result, [{'result':['field',value]}, {'result':[value]}])

    def test_counters_uncompressed_and_account_rate_limiter_shared(self):
        self.post.return_value.json = lambda: [{'result': 21},{'result':0}]
        self.assertFalse(account_auth.rate_allowed({}, 'test@example.invalid'))
        commands = self.post.call_args.kwargs['json']['commands']
        self.assertEqual(commands[0][0], 'INCR')
        self.assertEqual(commands[1][2:], [900,'NX'])

    def test_pin_counter_uses_atomic_database_function(self):
        self.post.return_value.json = lambda: {'result': 'OK'}
        store.record_pin_failure()
        self.assertTrue(self.post.call_args.args[0].endswith('/website_storage_pin_failure'))
        self.get.assert_not_called()

    def test_readiness_error_is_safe_and_stops_retries(self):
        self.post.return_value = SimpleNamespace(status_code=400, json=lambda: {'message':'website_storage_not_ready'})
        for _ in range(2):
            with self.assertRaises(store.StorageUnavailable) as error: store.get('policy')
            self.assertEqual(error.exception.code, 'storage_migration_pending')
        self.assertEqual(self.post.call_count, 1)

    def test_missing_policy_and_member_rules_never_use_open_defaults(self):
        self.post.return_value.json = lambda: [{'result': None}]
        with self.assertRaises(store.StorageUnavailable): site_controls.read_saved()
        with self.assertRaises(store.StorageUnavailable): site_members._stored_rules()

    def test_history_tennis_and_moves_route_to_selected_backend(self):
        self.post.return_value.json = lambda: [{'result': []}]
        self.assertEqual(finder_history_store.command('HGETALL','h'), [])
        self.assertEqual(tennis_live.redis('ZRANGEBYSCORE','z',0,'+inf'), [])
        self.assertEqual(line_moves._pipeline([['LRANGE','l',0,-1]]), [[]])
        self.assertEqual(self.post.call_count, 3)
        self.get.assert_not_called()


class MigrationTests(unittest.TestCase):
    def test_requires_original_source_complete_backup_and_policy_review(self):
        with self.assertRaises(ValueError): migration.import_sql(backup())
        for field, value in (('source','new-database'), ('complete',False), ('writersPaused',False)):
            data = backup(); data[field] = value
            with self.assertRaises(ValueError): migration.validate_backup(data)

    def test_missing_policy_rules_and_duplicate_keys_rejected(self):
        for index in (0,1):
            data = backup(); del data['entries'][index]
            with self.assertRaises(ValueError): migration.validate_backup(data)
        data = backup(); data['entries'].append(copy.deepcopy(data['entries'][0]))
        with self.assertRaises(ValueError): migration.validate_backup(data)

    def test_default_policy_or_guest_policy_rejected(self):
        for policy in ({}, {'requireLogin':False}, {'requireLogin':True}):
            data = backup(); data['entries'][0]['value'] = json.dumps(policy)
            with self.assertRaises(ValueError): migration.validate_backup(data)

    def test_import_no_overwrite_preserves_ttl_compresses_payloads_and_locks_pin(self):
        sql = migration.import_sql(backup(), policy_confirmed=True, now=100)
        self.assertIn('Destination must be empty and not ready', sql)
        self.assertNotIn("'expired'", sql)
        self.assertIn('to_timestamp(4102444800.0)', sql)
        self.assertIn('~kd-storage-v1:z:', sql)
        self.assertIn("a''b", sql)
        self.assertIn('statement_timestamp())+900', sql)
        self.assertIn('ready=true', sql)

    def test_export_cannot_run_against_destination(self):
        with patch.object(store,'STORAGE_BACKEND','supabase'):
            with self.assertRaises(ValueError): migration.export_backup(writers_paused=True)


if __name__ == '__main__': unittest.main()
