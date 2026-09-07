import ast
from pathlib import Path
import unittest


def load_function(name, **environment):
    tree = ast.parse(Path('backend/stats_mlb.py').read_text(encoding='utf-8'))
    fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == name)
    exec(compile(ast.Module(body=[fn], type_ignores=[]), '<season-batting>', 'exec'), environment)
    return environment[name]


class SeasonBattingTests(unittest.TestCase):
    def test_bvp_excludes_previous_season_and_wrong_player(self):
        calls = []
        def get(path, params, cache_key):
            calls.append((params, cache_key))
            return {'stats': [{'splits': [
                {'season': '2025', 'player': {'id': 1}, 'stat': {'atBats': 100, 'hits': 50}},
                {'season': '2026', 'player': {'id': 2}, 'stat': {'atBats': 100, 'hits': 50}},
                {'season': '2026', 'player': {'id': 1}, 'stat': {'atBats': 4, 'hits': 1, 'totalBases': 1}},
            ]}]}
        result = load_function('get_bvp_history', SEASON=2026, _get=get)(1, 10)
        self.assertEqual(result['ab'], 4)
        self.assertEqual(result['avg'], '.250')
        self.assertEqual(calls[0][0]['season'], 2026)
        self.assertIn('2026', calls[0][1])

    def test_no_current_season_sample_is_not_career_or_zero_average(self):
        get = lambda *args, **kwargs: {'stats': [{'splits': [{'season': '2025', 'stat': {'atBats': 10, 'hits': 5}}]}]}
        result = load_function('get_bvp_history', SEASON=2026, _get=get)(1, 10)
        self.assertEqual(result['ab'], 0)
        self.assertEqual(result['avg'], '.---')

    def test_pitch_type_compatibility_uses_season_arsenal(self):
        rows = [{'season': 2026, 'pitch_type': 'FF', 'avg': '.250'}]
        function = load_function('get_batter_vs_pitch_type', get_batter_arsenal_stats=lambda bid: rows)
        self.assertEqual(function(1, 10), rows)


if __name__ == '__main__':
    unittest.main()
