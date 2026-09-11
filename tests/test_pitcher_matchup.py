import unittest
from pitcher_matchup import pitcher_matchup_grade as grade, innings


def sample():
    return dict(k_card={'last_5_starts': [dict(ip='6.0', k=8, er=0, hits=3)] * 5},
                opponent_offense={'totals': {'plate_appearances': 900}, 'metrics': [
                    dict(key=key, rank=28, value=value) for key, value in
                    [('avg', .230), ('runs_pg', 3.9), ('hr_pg', .9), ('k_pct', 26), ('bb_pct', 7)]]},
                arsenal=[dict(pitch_type='FF', pct=60), dict(pitch_type='SL', pct=40)],
                team_pitch_types=[dict(pitch_type=pt, pa=300, k_pct=30, avg=.220, woba=.280) for pt in ('FF', 'SL')],
                park_factor=.97, weather={'dome': True})


def factor(result, key):
    return next(f for f in result['factors'] if f['key'] == key)


class PitcherContextTests(unittest.TestCase):
    def test_unsupported_market_does_not_receive_k_score(self):
        result = grade(**sample(), prop_type='pitcher_walks')
        self.assertEqual(result['coverage'], 0)
        self.assertEqual(result['score'], 50)

    def test_outs_not_decimal_innings(self):
        self.assertAlmostEqual(innings({'ip': '5.2'}), 17 / 3)
        self.assertEqual(innings({'outs': 17, 'ip': '9.0'}), 17 / 3)
        self.assertIsNone(innings({'ip': '5.8'}))

    def test_zero_era_is_real_and_fractional_innings_correct(self):
        data = sample()
        zero = grade(**data, prop_type='pitcher_earned_runs', side='under')
        self.assertGreater(factor(zero, 'form')['impact'], 0)
        data['k_card']['last_5_starts'] = [dict(ip='5.2', er=2)] * 5
        result = grade(**data, prop_type='pitcher_earned_runs')
        self.assertIn('3.18 ERA', factor(result, 'form')['detail'])

    def test_market_and_side_direction(self):
        for market in ('pitcher_strikeouts', 'pitcher_outs', 'pitcher_hits_allowed', 'pitcher_earned_runs'):
            over = grade(**sample(), prop_type=market)
            under = grade(**sample(), prop_type=market, side='under')
            self.assertEqual(over['score'] + under['score'], 100)
            for first, second in zip(over['factors'], under['factors']):
                self.assertEqual(first['impact'], -second['impact'])
        self.assertGreater(factor(grade(**sample(), line=5.5), 'k_pct')['impact'], 0)
        self.assertLess(factor(grade(**sample(), prop_type='pitcher_earned_runs'), 'offense')['impact'], 0)

    def test_exposure_increases_hits_even_for_strong_pitcher(self):
        result = grade(**sample(), prop_type='pitcher_hits_allowed')
        self.assertGreater(factor(result, 'workload')['impact'], 0)
        self.assertLess(factor(result, 'form')['impact'], 0)

    def test_missing_inputs_stay_neutral(self):
        result = grade(k_card={})
        self.assertEqual(result['score'], 50)
        self.assertEqual(result['coverage'], 0)
        self.assertTrue(all(not f['available'] for f in result['factors']))

    def test_thin_team_and_recent_samples_shrink(self):
        data = sample()
        full = grade(**data, line=5.5)
        data['opponent_offense']['totals']['plate_appearances'] = 60
        data['k_card']['last_5_starts'] = data['k_card']['last_5_starts'][:1]
        thin = grade(**data, line=5.5)
        self.assertLess(factor(thin, 'k_pct')['impact'], factor(full, 'k_pct')['impact'])
        self.assertLess(factor(thin, 'form')['impact'], factor(full, 'form')['impact'])
        self.assertLess(thin['coverage'], full['coverage'])

    def test_strikeout_score_uses_the_offered_line(self):
        low = grade(**sample(), line=4.5)
        high = grade(**sample(), line=8.5)
        self.assertGreater(low['score'], high['score'])

    def test_strikeout_under_reverses_the_matchup(self):
        over = grade(**sample(), line=5.5)
        under = grade(**sample(), line=5.5, side='under')
        self.assertLess(under['score'], over['score'])

    def test_pitch_mix_needs_sample_and_coverage(self):
        data = sample()
        full = grade(**data)
        self.assertGreater(factor(full, 'arsenal')['impact'], 0)
        data['team_pitch_types'] = [dict(pitch_type='SL', pa=300, k_pct=30)]
        partial = grade(**data)
        self.assertFalse(factor(partial, 'arsenal')['available'])
        data['team_pitch_types'] = [dict(pitch_type='FF', pa=10, k_pct=50)]
        self.assertFalse(factor(grade(**data), 'arsenal')['available'])

    def test_outs_line_changes_workload_support(self):
        low = grade(**sample(), prop_type='pitcher_outs', line=14.5)
        high = grade(**sample(), prop_type='pitcher_outs', line=20.5)
        self.assertGreater(factor(low, 'workload')['impact'], 0)
        self.assertLess(factor(high, 'workload')['impact'], 0)

    def test_zero_missing_and_invalid_weather(self):
        data = sample()
        data['weather'] = {'temp_f': float('nan'), 'error': 'unavailable'}
        data['park_factor'] = float('inf')
        result = grade(**data, prop_type='pitcher_earned_runs')
        self.assertFalse(factor(result, 'park')['available'])
        self.assertFalse(factor(result, 'weather')['available'])


if __name__ == '__main__':
    unittest.main()
