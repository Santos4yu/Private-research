"""Mock connections only; MLB scoring is outside this transport repair."""
import unittest
from unittest.mock import Mock, patch
import requests
from v2.board import odds_client


def response(status, remaining='100'):
    return Mock(status_code=status, ok=200 <= status < 300,
                headers={'x-requests-remaining': remaining})


class MLBTransportTests(unittest.TestCase):
    def request(self, replies, path='/sports/baseball_mlb/events/fixture/odds'):
        with patch('odds_budget.guarded_get', side_effect=lambda session, path, params, key, timeout: session.get('mock', params=params, timeout=timeout)), patch.object(odds_client, 'get_odds_api_key_candidates', return_value=['mock-expired', 'mock-funded']), patch.object(odds_client._SESSION, 'get', side_effect=replies) as fetch:
            result = odds_client._get(path, {})
            return result, fetch.call_count

    def test_rejected_key_retries_configured_fallback(self):
        good = response(200)
        self.assertEqual(self.request([response(401), good]), (good, 2))

    def test_exhausted_key_retries_configured_fallback(self):
        good = response(200)
        self.assertEqual(self.request([response(429), good]), (good, 2))

    def test_free_event_success_does_not_hide_exhaustion(self):
        good = response(200)
        self.assertEqual(self.request([response(200, '0'), good], '/sports/baseball_mlb/events'), (good, 2))

    def test_connection_error_does_not_leak_secret(self):
        with self.assertRaises(RuntimeError) as caught:
            self.request([requests.ConnectionError('https://example.invalid/?apiKey=MOCK_SECRET')]*2)
        self.assertNotIn('MOCK_SECRET', str(caught.exception))

    def test_exhausted_and_rejected_keys_report_quota(self):
        with self.assertRaisesRegex(RuntimeError, 'quota'):
            self.request([response(429), response(401)])
