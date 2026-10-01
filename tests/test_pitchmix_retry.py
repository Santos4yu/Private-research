import ast
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parents[1]

class PitchMixRetryTests(unittest.TestCase):
    def call(self, pitcher='42', pitches=None, fail=False):
        source = ast.parse((ROOT / 'api/team-insights.py').read_text(encoding='utf-8'))
        cls = next(n for n in source.body if isinstance(n, ast.ClassDef))
        env = {'BaseHTTPRequestHandler': object, 'urlparse': urlparse, 'parse_qs': parse_qs,
               'session_with_live_access': lambda headers: True}
        exec(compile(ast.Module(body=[cls], type_ignores=[]), '<handler>', 'exec'), env)
        handler = env['handler']()
        handler.headers = {}
        handler.path = '/api/team-insights?detail=pitchmix&pitcherId=' + pitcher
        handler._send = Mock()
        fetch = Mock(return_value=pitches)
        if fail:
            fetch.side_effect = RuntimeError('temporary outage')
        core = SimpleNamespace(stats_mlb=SimpleNamespace(get_pitcher_arsenal=fetch),
                               _format_arsenal=lambda rows: rows)
        with patch.dict('sys.modules', {'prediction_core': core,
                                      'site_controls': SimpleNamespace(allowed=lambda *args: True)}):
            handler.do_GET()
        return handler._send.call_args.args, fetch

    def test_mix_loads_without_team_or_lineup_work(self):
        rows = [{'code': 'FF', 'pct': 60}]
        response, fetch = self.call(pitches=rows)
        self.assertEqual(response, (200, {'pitchArsenal': rows}))
        fetch.assert_called_once_with(42)

    def test_empty_and_failed_requests_are_retryable_errors(self):
        for kwargs in ({'pitches': []}, {'fail': True}):
            response, _ = self.call(**kwargs)
            self.assertEqual(response[0], 502)
            self.assertIn('retry', response[1]['error'].lower())

    def test_unknown_starter_is_not_requested(self):
        response, fetch = self.call(pitcher='0')
        self.assertEqual(response[0], 400)
        fetch.assert_not_called()

    def test_slow_prediction_preserves_starter_identity(self):
        source = (ROOT / 'prediction_core.py').read_text(encoding='utf-8')
        self.assertIn('"id": pitcher.get("pitcher_id") or pitcher.get("id") or matchup.get("pitcher_id")', source)

if __name__ == '__main__':
    unittest.main()
