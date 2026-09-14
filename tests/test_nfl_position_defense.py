"""Synthetic fixtures only: descriptive context must not modify model outputs."""
import copy
import unittest
from dataclasses import dataclass
from backend.sports.nfl.position_defense import position_allowed, position_defense_context


@dataclass
class MockPlayer:
    id: str
    position: str


class PositionDefenseTests(unittest.TestCase):
    def fixture(self):
        data = {'games': [], 'players': []}
        roster = {}
        for team in range(9):
            for week in range(1, 5):
                game_id = f'mock-{team}-{week}'
                data['games'].append({'game_id': game_id, 'team_id': 'OFF', 'week': week, 'opponent_team_id': f'D{team}'})
                # A distinct RB and WR each game, with per-team-index-scaled volume.
                rb_id, wr_id = f'rb-{team}', f'wr-{team}'
                roster.setdefault(rb_id, MockPlayer(rb_id, 'RB'))
                roster.setdefault(wr_id, MockPlayer(wr_id, 'WR'))
                data['players'].append({'game_id': game_id, 'player_id': rb_id, 'metrics': {'ypc': {'n': 15 + team, 'sum': 60 + team * 5}}})
                data['players'].append({'game_id': game_id, 'player_id': wr_id, 'metrics': {'yards_per_target': {'n': 5, 'sum': 0}, 'yards_per_reception': {'n': 3, 'sum': 40 + team * 2}}})
        return data, roster

    def test_rb_rushing_percentile_ties_and_extremes(self):
        data, roster = self.fixture()
        self.assertEqual(position_allowed(data, roster, 'D4', 'RB', 'rush_attempts', 5)['percentile'], 50)
        self.assertEqual(position_allowed(data, roster, 'D0', 'RB', 'rush_attempts', 5)['percentile'], 0)
        self.assertEqual(position_allowed(data, roster, 'D8', 'RB', 'rush_attempts', 5)['percentile'], 100)

    def test_position_filtering_is_correct(self):
        data, roster = self.fixture()
        rb = position_allowed(data, roster, 'D4', 'RB', 'rushing_yards', 5)
        wr = position_allowed(data, roster, 'D4', 'WR', 'receiving_yards', 5)
        self.assertEqual(rb['value'], 80.0)
        self.assertEqual(wr['value'], 48.0)

    def test_no_mutation_of_inputs(self):
        data, roster = self.fixture()
        original = copy.deepcopy(data)
        position_allowed(data, roster, 'D4', 'RB', 'rush_attempts', 5)
        self.assertEqual(data, original)

    def test_future_week_and_small_sample_do_not_score(self):
        data, roster = self.fixture()
        self.assertIsNone(position_allowed(data, roster, 'D4', 'RB', 'rush_attempts', 4))
        thin = {'games': data['games'][:28], 'players': data['players']}
        self.assertIsNone(position_allowed(thin, roster, 'D4', 'RB', 'rush_attempts', 5))

    def test_unknown_player_or_stat_returns_none(self):
        data, roster = self.fixture()
        self.assertIsNone(position_allowed(data, {}, 'D4', 'RB', 'rush_attempts', 5))
        self.assertIsNone(position_allowed(data, roster, 'D4', 'RB', 'not_a_real_stat', 5))
        self.assertIsNone(position_allowed(None, roster, 'D4', 'RB', 'rush_attempts', 5))

    def test_context_returns_only_relevant_stats_for_position(self):
        data, roster = self.fixture()
        wr_context = position_defense_context(data, roster, 'D4', 'WR', 5)
        self.assertTrue(all(r['stat'] in ('targets', 'receptions', 'receiving_yards') for r in wr_context))
        self.assertEqual(position_defense_context(data, roster, 'D4', 'QB', 5), [])
