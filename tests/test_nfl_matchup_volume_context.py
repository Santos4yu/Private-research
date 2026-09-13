"""Synthetic fixtures only: descriptive context must not modify model outputs."""
import copy
import unittest
from backend.sports.nfl.matchup_volume_context import opponent_volume


class VolumeContextTests(unittest.TestCase):
    def fixture(self):
        data = {'games': [], 'players': []}
        for team in range(9):
            for week in range(1, 5):
                identity = {'game_id': f'mock-{team}-{week}', 'team_id': 'OFF', 'week': week}
                data['games'].append({**identity, 'opponent_team_id': f'D{team}', 'metrics': {
                    'ypc': {'n': 20 + team, 'sum': 100}, 'scramble_rate': {'n': 35, 'sum': 2},
                    'completion_rate': {'n': 30 + team, 'sum': 20}}})
                data['players'].extend([
                    {**identity, 'player_id': 'mock-qb', 'metrics': {'sack_rate': {'n': 35, 'sum': 2}, 'ypc': {'n': team + 2, 'sum': team * 3}}},
                    {**identity, 'player_id': 'mock-rb', 'metrics': {'ypc': {'n': 20, 'sum': 90}}},
                ])
        return data

    def run_context(self, data=None, position='QB', prop='rush_attempts', opponent='D4', week=5):
        return opponent_volume(data or self.fixture(), {'position': position}, opponent, prop, week, {'mock-qb'})

    def test_ties_neutral_and_extremes(self):
        self.assertEqual(self.run_context()['score'], 50)
        self.assertEqual(self.run_context(opponent='D0')['score'], 0)
        self.assertEqual(self.run_context(opponent='D8')['score'], 100)
        data = self.fixture()
        for row in data['games']:
            row['metrics']['completion_rate']['n'] = 30
        self.assertEqual(self.run_context(data, prop='passing_attempts')['score'], 50)

    def test_position_specific_and_no_mutation(self):
        data = self.fixture(); original = copy.deepcopy(data)
        self.assertEqual(self.run_context(data)['value'], 6)
        self.assertEqual(self.run_context(data, position='RB')['value'], 24)
        self.assertEqual(self.run_context(data, prop='rushing_yards')['value'], 12)
        self.assertEqual(data, original)
        self.assertIsNone(self.run_context(prop='receiving_yards'))

    def test_future_and_small_sample_do_not_score(self):
        self.assertIsNone(self.run_context(week=4))
        data = self.fixture()
        for row in data['games']:
            if row['opponent_team_id'] == 'D4': row['week'] = 5
        self.assertIsNone(self.run_context(data))
        data = self.fixture(); data['games'] = data['games'][:28]
        self.assertIsNone(self.run_context(data))

    def test_unmapped_rushers_and_missing_data_do_not_become_zero(self):
        data = self.fixture(); data['players'] = [p for p in data['players'] if p['player_id'] != 'mock-rb']
        self.assertIsNone(self.run_context(data))
        data = self.fixture()
        for row in data['games']: row['metrics'].pop('ypc')
        self.assertIsNone(self.run_context(data))
        self.assertIsNone(opponent_volume(self.fixture(), {'position':'QB'}, 'D4', 'rush_attempts', 5))

    def test_confirmed_zero_rushing_is_valid(self):
        data = self.fixture()
        for row in data['games']:
            row['metrics']['ypc']['n'] = 20
            row['metrics']['scramble_rate']['sum'] = 0
        for row in data['players']:
            if row['player_id'] == 'mock-qb': row['metrics'].pop('ypc')
        result = self.run_context(data)
        self.assertEqual(result['value'], 0)
        self.assertEqual(result['score'], 50)
        self.assertNotIn('projectionMean', result)
