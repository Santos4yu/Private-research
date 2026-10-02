import copy
import unittest
from datetime import timedelta
from unittest import mock

import moneyline_grading as mg
import moneyline_model as ml
import moneyline_matchup as mm
from tests.test_moneyline_model import RATED, CONTEXT, EVENT, NOW, KICK


class GradingTest(unittest.TestCase):
    def read(self, rated=None, context=None, event=None, **kw):
        [game] = ml.parse_odds([event or EVENT])
        return ml.read_game('nfl', game, rated or RATED, context=CONTEXT if context is None else context, **kw)

    def test_both_teams_have_real_offense_defense_and_separate_matchup_scores(self):
        game = self.read()
        for side in ('home', 'away'):
            row = game['grading']['teams'][side]
            self.assertEqual(len(row['components']), 5)
            self.assertTrue(0 <= row['matchupScore'] <= 100)
            self.assertEqual(row['sample'], 16)
        home = game['grading']['teams']['home']
        away = game['grading']['teams']['away']
        self.assertGreater(home['matchupScore'], away['matchupScore'])
        self.assertEqual(game['prediction']['side'], 'home')
        self.assertNotEqual(home['matchupScore'], game['prediction']['probability'] * 100)

    def test_missing_data_is_not_an_elite_setup_or_a_stake(self):
        game = self.read(rated={'teams': RATED['teams']}, context={})
        self.assertEqual(game['grading']['coverage'], 0)
        self.assertTrue(game['grading']['missing'])
        self.assertNotIn((game['pick'] or {}).get('tier'), ('elite', 'strong', 'play'))
        self.assertIsNone(game['target'])

    def test_ties_in_league_scoring_get_equal_midrank(self):
        self.assertEqual(mg.percentile(20, [20, 20, 20, 20]), 50)
        self.assertEqual(mg.percentile(20, [20, 20, 20, 20], False), 50)
        self.assertIsNone(mg.percentile(20, [20]))
        self.assertIsNone(mg.percentile(float('nan'), [20] * 4))

    def test_neutral_game_removes_home_advantage_and_home_road_adjustment(self):
        normal = self.read()
        neutral = self.read(espn={'neutral': True})
        self.assertAlmostEqual(normal['model']['base'] - neutral['model']['base'], ml.SPORTS['nfl']['hfa'])
        self.assertTrue(neutral['grading']['neutral'])
        self.assertNotIn('splits', [f['key'] for f in neutral['matchup']['factors']])

    def test_nflverse_neutral_site_matches_exact_date_and_teams(self):
        rated = {**RATED, 'neutralSites': {(ml.name_key(EVENT['home_team']), ml.name_key(EVENT['away_team']), KICK[:10]): True}}
        self.assertTrue(self.read(rated=rated)['grading']['neutral'])

    def test_scoring_replaces_part_of_rating_instead_of_double_counting(self):
        scoring = mg.scoring_matchup(RATED, 'Kansas City Chiefs', 'Buffalo Bills', 1.5, 4.5)
        self.assertEqual(scoring['weight'], .2)
        self.assertAlmostEqual(scoring['adjustment'], .2 * (scoring['margin'] - 4.5))

    def test_stale_or_future_quote_cannot_create_a_recommended_play(self):
        event = copy.deepcopy(EVENT)
        for book in event['bookmakers']:
            book['last_update'] = (NOW - timedelta(hours=1)).isoformat()
        game = self.read(event=event, now=NOW)
        self.assertIsNone(game['pick'])
        self.assertEqual(game['passReason'], 'Prices need a fresh update')
        for book in event['bookmakers']:
            book['last_update'] = (NOW + timedelta(hours=1)).isoformat()
        self.assertIsNone(self.read(event=event, now=NOW)['pick'])

    def test_unknown_report_is_not_a_clean_injury_report(self):
        page = {'header': {'competitions': [{'competitors': [{'homeAway': 'home', 'team': {'id': '1'}}]}]}}
        self.assertEqual(mm.parse_summary(page)['injuries'], {})
        page['injuries'] = []
        self.assertEqual(mm.parse_summary(page)['injuries'], {'home': []})

    def test_stale_best_price_is_excluded_when_fresh_prices_exist(self):
        event = copy.deepcopy(EVENT)
        stale = event['bookmakers'][-1]
        stale['last_update'] = (NOW - timedelta(hours=1)).isoformat()
        for outcome in stale['markets'][0]['outcomes']:
            outcome['price'] = 500
        game = self.read(event=event, now=NOW)
        for offer in game['best'].values():
            self.assertNotEqual(offer['book'], stale['key'])
        fresh = [book for book in ml.parse_odds([event])[0]['books'] if book['key'] != stale['key']]
        self.assertAlmostEqual(game['fair']['home'], ml.consensus(fresh)[0])

    def test_mlb_probables_match_the_fixture_not_first_doubleheader_game(self):
        game = ml.parse_odds([EVENT])[0]
        starter = {'name': 'Second-game starter', 'era': 3.2, 'ip': 100}
        rated = {**RATED, 'ids': {'Kansas City Chiefs': '1', 'Buffalo Bills': '2'},
                 'probables': {'1': {'name': 'Wrong starter', 'era': 2, 'ip': 100}},
                 'scheduledGames': [
                     {'home': '1', 'away': '2', 'startTime': (ml._time(KICK) - timedelta(hours=4)).isoformat(), 'starters': {'home': rated_starter}}
                     for rated_starter in [{'name': 'Wrong starter', 'era': 2, 'ip': 100}]] +
                     [{'home': '1', 'away': '2', 'startTime': KICK, 'starters': {'home': starter}}]}
        result = ml.read_game('mlb', game, rated, context={})
        self.assertEqual(result['matchup']['teams']['home']['starter']['name'], 'Second-game starter')
        self.assertEqual(rated['probables']['1']['name'], 'Wrong starter')

    def test_ambiguous_mlb_fixture_does_not_reuse_a_team_level_pitcher(self):
        game = ml.parse_odds([EVENT])[0]
        fixture = {'home': '1', 'away': '2', 'startTime': KICK, 'starters': {'home': {'name': 'Unresolved'}}}
        rated = {**RATED, 'ids': {'Kansas City Chiefs': '1', 'Buffalo Bills': '2'},
                 'probables': {'1': {'name': 'Wrong starter', 'era': 2, 'ip': 100}},
                 'scheduledGames': [fixture, copy.deepcopy(fixture)]}
        result = ml.read_game('mlb', game, rated, context={})
        self.assertIsNone(result['matchup']['teams']['home']['starter'])
        self.assertTrue(result['grading']['teams']['home']['personnelUnresolved'])

    def test_elite_needs_positive_conservative_ev_evidence_and_both_team_support(self):
        grade = {'coverage': 1, 'teams': {'home': {'matchupScore': 90}}}
        elite = mg.decision(.75, .76, .73, .72, -150, grade, 'home', 5, True)
        self.assertEqual(elite['tier'], 'elite')
        self.assertLessEqual(elite['units'], 1)
        losing_price = mg.decision(.75, .76, .73, .72, -400, grade, 'home', 5, True)
        self.assertIsNone(losing_price['tier'])
        self.assertEqual(losing_price['units'], 0)
        thin = mg.decision(.75, .76, .73, .72, -150, {**grade, 'coverage': .2}, 'home', 5, True)
        self.assertNotIn(thin['tier'], ('elite', 'strong', 'play'))

    def test_higher_confidence_does_not_override_price_or_model_conflict(self):
        grade = {'coverage': 1, 'teams': {'home': {'matchupScore': 90}}}
        conflict = mg.decision(.65, .4, .7, .7, 100, grade, 'home', 5, True)
        self.assertIsNone(conflict['tier'])
        self.assertEqual(conflict['units'], 0)

    def test_risk_haircut_and_units_decrease_with_missing_evidence(self):
        grade = {'coverage': 1, 'teams': {'home': {'matchupScore': 90}}}
        a = mg.decision(.7, .72, .7, .68, -120, grade, 'home', 5, True)
        b = mg.decision(.7, .72, .7, .68, -120, {**grade, 'coverage': .6}, 'home', 5, True)
        self.assertLess(b['conservativeProbability'], a['conservativeProbability'])
        self.assertLessEqual(b['units'], a['units'])
        self.assertEqual(b['units'] * 4, round(b['units'] * 4))

    def test_unknown_goalie_never_promotes_nhl_to_elite(self):
        rated = copy.deepcopy(RATED)
        row = mg.grade_matchup('nhl', rated, CONTEXT, {'home': 'Kansas City Chiefs', 'away': 'Buffalo Bills'}, [], 2, 2.1)
        self.assertLess(row['coverage'], .85)
        self.assertTrue(row['teams']['home']['personnelUnresolved'])

    def test_equal_goalie_effects_still_show_the_available_personnel_data(self):
        game = ml.parse_odds([EVENT])[0]
        goalies = {team: [{'name': name, 'starts': 10, 'savePct': .91, 'shots': 300}]
                   for team, name in [('Kansas City Chiefs', 'Home goalie'), ('Buffalo Bills', 'Away goalie')]}
        read = ml.read_game('nhl', game, RATED, context=CONTEXT, extras={'goalies': goalies})
        self.assertEqual(read['matchup']['teams']['home']['goalie']['name'], 'Home goalie')
        personnel = next(c for c in read['grading']['teams']['home']['components'] if c['key'] == 'personnel')
        self.assertIsNotNone(personnel['score'])
        self.assertIn('not confirmed', personnel['detail'])

    def test_target_price_actually_qualifies_for_a_small_play(self):
        event = copy.deepcopy(EVENT)
        for book in event['bookmakers']:
            if book['key'] == 'espnbet':
                book['markets'][0]['outcomes'][0]['price'] = -160
        read = self.read(event=event)
        self.assertIsNotNone(read['target'])
        target = read['target']
        side = target['side']
        verdict = mg.decision(read['model'][side], read['model']['ratingHome'] if side == 'home' else 1 - read['model']['ratingHome'], None,
                              read['fair'][side], target['price'], read['grading'], side, len(read['books']), read['sharp'])
        self.assertIn(verdict['tier'], ('elite', 'strong', 'play'))
        self.assertGreaterEqual(verdict['units'], .25)


class ForecastTest(unittest.TestCase):
    def setUp(self):
        self.store = {}
        self.load = mock.patch.object(ml, '_load', side_effect=lambda key, default=None: self.store.get(key, default))
        self.save = mock.patch.object(ml, '_save', side_effect=lambda key, value, **kw: self.store.update({key: copy.deepcopy(value)}))
        self.load.start(); self.save.start()
        self.addCleanup(self.load.stop); self.addCleanup(self.save.stop)

    def test_every_game_forecast_is_frozen_including_passes(self):
        game = {'id': 'a', 'startsAt': KICK, 'homeName': 'A', 'awayName': 'B', 'pick': None,
                'model': {'home': .6, 'ratingHome': .58}, 'fair': {'home': .59}}
        self.assertEqual(ml.remember_forecasts('nfl', [game], NOW), 1)
        game['model']['home'] = .7
        self.assertEqual(ml.remember_forecasts('nfl', [game], NOW + timedelta(minutes=5)), 0)
        self.assertEqual(self.store[f'forecasts:{ml.VERSION}'][0]['homeProbability'], .6)
        self.assertEqual(ml.forecast_summary()['games'], 0)

    def test_stale_quotes_do_not_freeze_a_new_forecast(self):
        game = {'id': 'a', 'startsAt': KICK, 'homeName': 'A', 'awayName': 'B', 'quoteFresh': False,
                'model': {'home': .6, 'ratingHome': .58}, 'fair': {'home': .59}}
        self.assertEqual(ml.remember_forecasts('nfl', [game], NOW), 0)

    def test_stale_quotes_cannot_replace_a_closing_observation(self):
        game = ml.parse_odds([EVENT])[0]
        game.update(quoteFresh=False, fair={'home': .6, 'away': .4}, best={}, pick=None)
        identity = ml._play_id('nfl', game, 'home')
        self.store['plays'] = [{'id': identity, 'result': None, 'startsAt': KICK, 'close': {'at': 'old'}}]
        ml.remember('nfl', [game], NOW)
        self.assertEqual(self.store['plays'][0]['close']['at'], 'old')

    def test_validation_measures_all_settled_games_against_market_baseline(self):
        self.store[f'forecasts:{ml.VERSION}'] = [
            {'homeProbability': .6, 'marketHome': .5, 'result': 'home'},
            {'homeProbability': .7, 'marketHome': .6, 'result': 'away'},
            {'homeProbability': .8, 'marketHome': .7, 'result': None}]
        summary = ml.forecast_summary()
        self.assertEqual(summary['games'], 2)
        self.assertAlmostEqual(summary['brier'], (.4 ** 2 + .7 ** 2) / 2)
        self.assertAlmostEqual(summary['marketBrier'], (.5 ** 2 + .6 ** 2) / 2)
        self.assertEqual(summary['pending'], 1)
        self.assertEqual(sum(b['games'] for b in summary['bins']), 2)

    def test_forecasts_settle_only_from_verified_finals_and_skip_ties(self):
        self.store[f'forecasts:{ml.VERSION}'] = [{'id': 'nfl:a', 'sport': 'nfl', 'startsAt': KICK,
            'homeName': 'A', 'awayName': 'B', 'homeProbability': .6, 'marketHome': .5, 'result': None}]
        final = {'home': {'name': 'A', 'short': 'A', 'score': '17'}, 'away': {'name': 'B', 'short': 'B', 'score': '17'}, 'date': KICK, 'completed': True}
        with mock.patch.object(ml, 'scoreboard', return_value=[final]):
            self.assertEqual(ml.grade_forecasts(NOW + timedelta(hours=6)), 1)
        self.assertEqual(ml.forecast_summary()['games'], 0)

    def test_old_losses_remain_and_current_model_is_separate(self):
        self.store['plays'] = [{'id': 'old', 'result': 'L', 'profit': -1, 'units': 1, 'startsAt': NOW.isoformat()}]
        record = ml.record(NOW)
        self.assertEqual(record['summary']['losses'], 1)
        self.assertEqual(record['currentModel']['losses'], 0)
        self.assertEqual(record['summary']['units'], -1)

    def test_open_and_far_from_start_quotes_are_not_final_clv(self):
        play = {'startsAt': KICK, 'price': -130, 'close': {'probability': .6, 'at': NOW.isoformat()}}
        self.assertIsNone(ml.clv(play, NOW))
        self.assertIsNone(ml.clv(play, NOW + timedelta(hours=3)))
        play['close']['at'] = (NOW + timedelta(minutes=110)).isoformat()
        self.assertGreater(ml.clv(play, NOW + timedelta(hours=3)), 0)


if __name__ == '__main__':
    unittest.main()
