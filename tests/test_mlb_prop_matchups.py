import unittest
from unittest import mock

import mlb_prop_matchups
import mlb_sheets
from tests.test_mlb_sheets import DAY, WEATHER, fake_mlb

ARSENAL = [{"pitch_type": "FF", "pitch_name": "Four-seam FB", "pct": 55.0, "avg_speed": 95.0},
           {"pitch_type": "KC", "pitch_name": "Knuckle curve", "pct": 45.0, "avg_speed": 82.0}]
# Player 100 crushes both pitches; player 102 struggles with them.
PITCH_TABLE = {
    "100": [{"pitch_type": "FF", "pa": 80, "avg": ".330", "slg": ".640", "woba": ".420"},
            {"pitch_type": "CU", "pa": 50, "avg": ".310", "slg": ".580", "woba": ".400"}],
    "102": [{"pitch_type": "FF", "pa": 80, "avg": ".190", "slg": ".300", "woba": ".250"},
            {"pitch_type": "CU", "pa": 50, "avg": ".170", "slg": ".260", "woba": ".230"}],
}


class MlbPropMatchupsTest(unittest.TestCase):
    def setUp(self):
        stats = mlb_sheets._stats()
        patches = [mock.patch.object(mlb_sheets, "mlb", side_effect=fake_mlb),
                   mock.patch.object(mlb_sheets, "vortex_board_day", return_value=DAY),
                   mock.patch.object(mlb_sheets, "_weather", return_value=WEATHER),
                   mock.patch.object(mlb_sheets, "_park", return_value=1.04),
                   mock.patch.object(mlb_sheets, "cached", side_effect=lambda key, ttl, loader: loader()),
                   mock.patch.object(mlb_prop_matchups, "cached", side_effect=lambda key, ttl, loader: loader()),
                   mock.patch.object(stats, "get_pitcher_arsenal", return_value=ARSENAL),
                   mock.patch.object(stats, "_load_batter_arsenal_table", return_value=PITCH_TABLE),
                   mock.patch.object(stats, "get_career_bvp_batch", side_effect=lambda ids, pitcher: {ids[0]: {"ab": 12, "hits": 5}})]
        for patch in patches:
            patch.start()
            self.addCleanup(patch.stop)

    def test_every_hitter_is_graded_three_ways_with_the_pitch_mix(self):
        players = mlb_prop_matchups.slate_matchups("today")["players"]
        strong, weak = players["100"], players["102"]
        self.assertEqual(strong["pitcher"]["name"], "Hagen Smith")
        self.assertEqual(set(strong["grades"]), {"hits", "power", "other"})
        # The knuckle curve is read as a curveball, so the whole mix is covered.
        self.assertIn("100% coverage", strong["grades"]["other"]["arsenal"]["detail"])
        self.assertIn("SLG", strong["grades"]["power"]["arsenal"]["detail"])
        self.assertIn("AVG", strong["grades"]["hits"]["arsenal"]["detail"])
        for family in ("hits", "power", "other"):
            self.assertGreater(strong["grades"][family]["arsenal"]["impact"], 0)
            self.assertLess(weak["grades"][family]["arsenal"]["impact"], 0)
            self.assertGreater(strong["grades"][family]["score"], weak["grades"][family]["score"])
        keys = [factor["key"] for factor in strong["factors"]]
        self.assertEqual(keys, ["handedness", "pitcher_quality", "arsenal_fit", "bvp", "recent_form", "park", "weather"])
        form = next(factor for factor in strong["factors"] if factor["key"] == "recent_form")
        self.assertTrue(form["detail"].startswith("Last 10 OPS"))
        bvp = next(factor for factor in strong["factors"] if factor["key"] == "bvp")
        self.assertIn("5-for-12", bvp["detail"])
        self.assertEqual(strong["pitches"][0], {"name": "Four-seam FB", "pct": 55.0})

    def test_fip_and_last_ten(self):
        self.assertEqual(mlb_prop_matchups.fip({"ip": 180, "hr": 20, "so": 200, "bb9": 3}), 3.37)
        self.assertIsNone(mlb_prop_matchups.fip({"ip": 0, "hr": 1, "so": 1, "bb9": 1}))
        games = [{"pa": 4, "hits": 1, "bb": 1, "hbp": 0, "tb": 2}] * 10
        # OBP 2/4, SLG 2/3.
        self.assertEqual(mlb_prop_matchups.last_ten_ops(games), round(0.5 + 2 / 3, 3))
        self.assertIsNone(mlb_prop_matchups.last_ten_ops(games[:4]))


if __name__ == "__main__":
    unittest.main()
