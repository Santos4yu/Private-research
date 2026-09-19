import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from analyze import _matchup_score_100


def _factor(result, key):
    return next(item for item in result["factors"] if item["key"] == key)


class MatchupScoringRegressionTests(unittest.TestCase):
    def test_pete_platoon_and_small_bvp_match_observed_scale(self):
        result = _matchup_score_100(
            {},
            pitcher={"hand": "R", "name": "Merrill Kelly", "era": 5.46,
                     "fip": 5.74, "whip": 1.54, "hr_per_9": 1.81},
            bvp={"ab": 5, "hits": 2, "avg": ".400"},
            vs_hand_splits={
                "R": {"avg": ".268", "ops": ".929", "pa": 395},
                "L": {"avg": ".306", "ops": ".957", "pa": 100},
            },
            prop_type="total_bases",
            weather={"dome": True},
        )
        self.assertAlmostEqual(_factor(result, "handedness")["impact"], -8.74, places=2)
        self.assertAlmostEqual(_factor(result, "pitcher_quality")["impact"], 9.46, places=2)
        self.assertLess(_factor(result, "bvp")["impact"], 2)

    def test_kody_platoon_and_recent_form_use_expected_scale(self):
        result = _matchup_score_100(
            {"recent_batting_form": {
                "delta_pct": 19.7, "l10_ops": .831, "season_ops": .759, "pa": 40,
            }},
            pitcher={"hand": "L", "name": "Jeffrey Springs", "era": 6.20,
                     "fip": 6.09, "whip": 1.52, "hr_per_9": 2.30},
            bvp={"ab": 1, "hits": 1, "avg": "1.000"},
            vs_hand_splits={
                "L": {"avg": ".255", "ops": ".763", "pa": 114},
                "R": {"avg": ".232", "ops": ".758", "pa": 574},
            },
            prop_type="hits_runs_rbis",
        )
        self.assertAlmostEqual(_factor(result, "handedness")["impact"], 5.29, places=2)
        self.assertEqual(_factor(result, "bvp")["impact"], 0)
        self.assertAlmostEqual(_factor(result, "recent_form")["impact"], 3.53, places=2)

    def test_missing_avg_or_slg_never_falls_back_to_ops(self):
        for prop_type in ("hits", "total_bases", "home_runs"):
            result = _matchup_score_100({}, arsenal=[{"pitch_type": "FF", "pct": 100}],
                bat_vs_pitch=[{"pitch_type": "FF", "pa": 200, "ops": ".950", "woba": ".400"}], prop_type=prop_type)
            self.assertFalse(_factor(result, "arsenal_fit")["available"])
            self.assertEqual(_factor(result, "arsenal_fit")["impact"], 0)

    def test_zero_avg_and_zero_era_are_real_data(self):
        result = _matchup_score_100({}, pitcher={"era": 0, "fip": "invalid"},
            arsenal=[{"pitch_type": "FF", "pct": 100}],
            bat_vs_pitch=[{"pitch_type": "FF", "pa": 200, "avg": 0, "ops": .950}], prop_type="hits")
        self.assertTrue(_factor(result, "arsenal_fit")["available"])
        self.assertLess(_factor(result, "arsenal_fit")["impact"], 0)
        self.assertTrue(_factor(result, "pitcher_quality")["available"])
        self.assertLess(_factor(result, "pitcher_quality")["impact"], 0)

    def test_single_game_streak_does_not_equal_established_sample(self):
        thin = _matchup_score_100({"l10": {"rate": 100, "games": 1}})
        full = _matchup_score_100({"l10": {"rate": 100, "games": 10}})
        self.assertLess(_factor(thin, "recent_form")["impact"], _factor(full, "recent_form")["impact"])

    def test_indoor_weather_is_known_neutral(self):
        result = _matchup_score_100({}, weather={"dome": True})
        self.assertTrue(_factor(result, "weather")["available"])
        self.assertEqual(_factor(result, "weather")["impact"], 0)

    def test_invalid_numbers_do_not_create_false_signal(self):
        result = _matchup_score_100({}, pitcher={"era": "NaN", "fip": "Infinity", "hand": "L"},
            bvp={"avg": None, "ab": 10}, vs_hand_splits={"L": {"pa": "NaN", "ops": "Infinity"}},
            park_factor="NaN", weather={"temp_f": "NaN"})
        self.assertIsNone(result["score"])

    def test_arsenal_metric_changes_with_market(self):
        arsenal = [{"pitch_type": "FF", "pitch_name": "Four-seam FB", "pct": 70}]
        pitch_results = [{"pitch_type": "FF", "pa": 60, "avg": ".290",
                          "slg": ".330", "ops": ".620"}]
        hits = _matchup_score_100({}, arsenal=arsenal, bat_vs_pitch=pitch_results,
                                  prop_type="hits")
        bases = _matchup_score_100({}, arsenal=arsenal, bat_vs_pitch=pitch_results,
                                   prop_type="total_bases")
        self.assertGreater(_factor(hits, "arsenal_fit")["impact"], 0)
        self.assertLess(_factor(bases, "arsenal_fit")["impact"], 0)


if __name__ == "__main__":
    unittest.main()
