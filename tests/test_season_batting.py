import ast
from pathlib import Path
import unittest


def load_function(name, **environment):
    tree = ast.parse(Path('backend/stats_mlb.py').read_text(encoding='utf-8'))
    fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == name)
    exec(compile(ast.Module(body=[fn], type_ignores=[]), '<season-batting>', 'exec'), environment)
    return environment[name]


def load_functions(names, **environment):
    tree = ast.parse(Path('backend/stats_mlb.py').read_text(encoding='utf-8'))
    body = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names]
    exec(compile(ast.Module(body=body, type_ignores=[]), '<season-batting>', 'exec'), environment)
    return [environment[name] for name in names]


class SeasonBattingTests(unittest.TestCase):
    def test_bvp_is_career_head_to_head_and_excludes_the_wrong_player(self):
        # Batter vs pitcher is the one split that spans every season (a
        # single season is too few at-bats to mean anything).
        calls = []
        def get(path, params, cache_key):
            calls.append((params, cache_key))
            return {'stats': [{'splits': [
                {'season': '2025', 'player': {'id': 1}, 'stat': {'atBats': 100, 'hits': 50}},
                {'season': '2026', 'player': {'id': 2}, 'stat': {'atBats': 100, 'hits': 50}},
                {'season': '2026', 'player': {'id': 1}, 'stat': {'atBats': 4, 'hits': 1, 'totalBases': 1}},
            ]}]}
        result = load_function('get_bvp_history', SEASON=2026, _get=get)(1, 10)
        self.assertEqual(result['ab'], 104)
        self.assertEqual(result['hits'], 51)
        self.assertNotIn('season', calls[0][0])
        self.assertEqual(calls[0][0]['opposingPlayerId'], 10)

    def test_no_head_to_head_sample_is_not_a_zero_average(self):
        get = lambda *args, **kwargs: {'stats': [{'splits': []}]}
        result = load_function('get_bvp_history', SEASON=2026, _get=get)(1, 10)
        self.assertEqual(result['ab'], 0)
        self.assertEqual(result['avg'], '.---')

    def test_pitch_type_compatibility_uses_season_arsenal(self):
        rows = [{'season': 2026, 'pitch_type': 'FF', 'avg': '.250'}]
        function = load_function('get_batter_vs_pitch_type', get_batter_arsenal_stats=lambda bid: rows)
        self.assertEqual(function(1, 10), rows)

    def test_batter_pitch_type_table_uses_current_season_cache_and_rows(self):
        import tempfile
        import time
        from types import SimpleNamespace

        csv = (
            'year,player_id,team_name_alt,pitch_type,pitch_name,pa,pitches,ba,slg,woba,whiff_percent,k_percent,hard_hit_percent,run_value_per_100\n'
            '2025,1,LAD,FF,Four-Seam Fastball,10,40,.999,1.500,.900,10,5,50,3\n'
            '2026,1,LAD,FF,Four-Seam Fastball,12,44,.250,.400,.310,20,18,42,1\n'
        )
        calls = []

        class Requests:
            @staticmethod
            def get(*args, **kwargs):
                calls.append((args, kwargs))
                return SimpleNamespace(ok=True, content=csv.encode('utf-8'))

        with tempfile.TemporaryDirectory() as tmp:
            cache_dir = Path(tmp)
            _, load_table = load_functions(
                ['_canonical_pitch_type', '_load_batter_arsenal_table'],
                SEASON=2026,
                CACHE_DIR=cache_dir,
                time=time,
                json=__import__('json'),
                requests=Requests,
            )
            table = load_table()
            self.assertEqual(table['1'][0]['avg'], '.250')
            self.assertEqual(table['1'][0]['season'], 2026)
            self.assertEqual(len(table['1']), 1)
            self.assertTrue((cache_dir / 'savant_batter_arsenal_v6_current_season_2026.json').exists())
            self.assertEqual(calls[0][1]['params']['year'], 2026)


if __name__ == '__main__':
    unittest.main()
