import ast
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import live_props_core as core


class LivePropsTests(unittest.TestCase):
    def setUp(self):
        core._cache.clear()

    def test_catalog_search_handles_accents_without_prediction_import(self):
        with patch.object(core, 'player_catalog', return_value=[{'name': 'José Ramírez', 'id': 1}]):
            self.assertEqual(core.search_players('Jose')[0]['id'], 1)
            self.assertEqual(core.search_players('j'), [])

    def test_raw_history_reused_and_relief_or_current_game_excluded(self):
        def split(date, game_id, started):
            return {'date': date, 'game': {'gamePk': game_id}, 'stat': {'gamesStarted': started, 'strikeOuts': 4},
                    'opponent': {'id': 2}, 'isHome': True}
        calls = []
        def mlb(path, params):
            calls.append((path, params))
            if path == '/schedule':
                return {'dates': [{'games': [{'gamePk': 10, 'teams': {'home': {'team': {'id': 1}}, 'away': {'team': {'id': 2}}}}]}]}
            return {'stats': [{'splits': [split('2026-09-01', 1, 1), split('2026-09-02', 2, 0), split('2026-09-06', 3, 1)]}]}
        player = {'id': 100, 'name': 'Test Player', 'team_id': 1}
        with patch.object(core, 'player_catalog', return_value=[player]), patch.object(core, 'mlb', side_effect=mlb), \
             patch.object(core, 'vortex_day', return_value='2026-09-06'), patch.object(core, 'vortex_board_day', return_value='2026-09-06'):
            result = core.player_history('Test Player', 'pitching')
            again = core.player_history('Test Player', 'pitching')
        self.assertEqual(len(result['games']), 1)
        self.assertEqual(result['matchup']['opponent']['id'], 2)
        self.assertEqual(again['games'], result['games'])
        self.assertEqual(len(calls), 3)  # two seasons + schedule, warm call adds none

    def test_builder_evidence_requires_a_listed_starter(self):
        # Test the production adapter without loading the expensive research engine.
        tree = ast.parse(Path('prediction_core.py').read_text(encoding='utf-8'))
        function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == '_builder_evidence')
        env = {'stats_mlb': SimpleNamespace(get_todays_schedule=lambda day: {'1': {'home_pitcher_id': 100, 'away_pitcher_id': 200}}),
               'vortextime': SimpleNamespace(vortex_board_day=lambda: '2026-09-06')}
        exec(compile(ast.Module(body=[function], type_ignores=[]), '<evidence>', 'exec'), env)
        evidence = env['_builder_evidence']({}, {}, {'l10': {'games': 10}}, 'over', 100, True)
        self.assertTrue(evidence['starterConfirmed'])
        self.assertEqual(evidence['sampleL10'], 10)
        self.assertFalse(env['_builder_evidence']({}, {}, {}, 'over', 300, True)['starterConfirmed'])
        self.assertIsNone(evidence['projectionEdge'])


if __name__ == '__main__':
    unittest.main()
