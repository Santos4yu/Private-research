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

    def test_first_inning_reads_the_opposing_half_and_the_starters_pitches(self):
        def play(pitcher, inning, pitches, event):
            return {'about': {'inning': inning}, 'matchup': {'pitcher': {'id': pitcher}},
                    'playEvents': [{'isPitch': True}] * pitches + [{'isPitch': False}],
                    'result': {'eventType': event}}
        def mlb(path, params):
            if path.endswith('/linescore'):
                return {'innings': [{'num': 1, 'home': {'hits': 0, 'runs': 0}, 'away': {'hits': 2, 'runs': 1}},
                                    {'num': 2, 'home': {'hits': 3, 'runs': 2}, 'away': {'hits': 0, 'runs': 0}}]}
            self.assertIn('allPlays', params['fields'])
            # 100 starts at home, so he pitches the top of the 1st.
            return {'allPlays': [play(100, 1, 4, 'strikeout'), play(100, 1, 6, 'walk'), play(100, 1, 2, 'single'),
                                 play(200, 1, 5, 'strikeout'), play(100, 2, 3, 'strikeout')]}
        with patch.object(core, 'mlb', side_effect=mlb):
            result = core.first_inning(7, 100, True)
        self.assertEqual(result, {'firstInningHits': 2, 'firstInningRuns': 1, 'firstInningPitches': 12,
                                  'firstInningWalks': 1, 'firstInningStrikeouts': 1})

    def test_first_inning_keeps_hits_and_runs_when_play_by_play_fails(self):
        def mlb(path, params):
            if path.endswith('/linescore'):
                return {'innings': [{'num': 1, 'home': {'hits': 1, 'runs': 0}, 'away': {'hits': 0, 'runs': 0}}]}
            raise RuntimeError('down')
        with patch.object(core, 'mlb', side_effect=mlb):
            self.assertEqual(core.first_inning(8, 100, False), {'firstInningHits': 1, 'firstInningRuns': 0})
        with patch.object(core, 'mlb', return_value={'innings': []}):
            self.assertIsNone(core.first_inning(9, 100, False))

    def test_first_inning_numbers_join_each_start(self):
        games = [{'gameId': 1, 'isHome': True, 'stat': {'strikeOuts': 5}},
                 {'gameId': 2, 'isHome': False, 'stat': {'strikeOuts': 7}}]
        def first(game_pk, pitcher_id, is_home):
            if game_pk == 2:
                raise RuntimeError('missing')
            return {'firstInningHits': 0, 'firstInningRuns': 0}
        with patch.object(core, 'first_inning', side_effect=first):
            result = core.with_first_inning(games, 100)
        self.assertEqual(result[0]['stat'], {'strikeOuts': 5, 'firstInningHits': 0, 'firstInningRuns': 0})
        # A game MLB cannot answer for stays as it was.
        self.assertEqual(result[1]['stat'], {'strikeOuts': 7})


if __name__ == '__main__':
    unittest.main()
