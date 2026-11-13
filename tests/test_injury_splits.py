"""A player out, read with how his team has done without him (Nov 13, the
owner: "look at how they are performing without him and with him are they
holding their own or are they barely surviving or are they struggling")."""
import unittest

import game_predictor as gp
import predictor_nba as nba

PARAMS = gp.V2["nba"]
RT = {"mu": 112.0, "off": {"DAL": 0.0, "BOS": 0.0, "NY": 4.0, "UTAH": -4.0}, "def": {"DAL": 0.0, "BOS": 0.0, "NY": 0.0, "UTAH": 0.0},
      "pace_mu": 100.0, "pace": {}}


def log(margins, opponent="BOS", home=True):
    return [{"opponent": opponent, "home": home, "margin": margin} for margin in margins]


def regular(played, value=20.0, reflect=0.5, name="Luka Doncic"):
    return {"id": "77", "name": name, "pos": "G", "headshot": None, "here": True, "games": sum(played), "minutes": 35.0, "value": value,
            "reflect": reflect, "rotation": True, "season": {"games": sum(played), "min": 350, "pts": 300, "reb": 80, "ast": 90},
            "lastDate": "2026-11-01", "missed": 0, "played": played}


class SplitTests(unittest.TestCase):
    def test_with_and_without_since_his_first_game(self):
        # Two games before he joined (not "without"), five with him, three without.
        state = {"log": log([-20, -20, 8, 6, 10, 4, 7, 5, 9, 6]), "games": 10}
        player = regular([False, False, True, True, True, True, True, False, False, False])
        split = nba.split_of(state, player, RT, 2.0)
        self.assertEqual((split["with"]["games"], split["with"]["wins"]), (5, 5))
        self.assertEqual((split["without"]["games"], split["without"]["wins"], split["without"]["losses"]), (3, 3, 0))
        self.assertEqual(split["without"]["margin"], round((5 + 9 + 6) / 3, 1))
        # At home against an average team: the home edge comes off.
        self.assertEqual(split["without"]["adjusted"], round((5 + 9 + 6) / 3 - 2.0, 1))
        self.assertIsNone(nba.split_of(state, regular([False] * 10), RT, 2.0))

    def test_opponents_strength_counts(self):
        tough = nba._side_of(log([-2], opponent="NY", home=False), RT, 2.0)
        soft = nba._side_of(log([-2], opponent="UTAH", home=False), RT, 2.0)
        # Losing by 2 on the road at a +4 team reads as better than at a -4 team.
        self.assertGreater(tough["adjusted"], soft["adjusted"])
        self.assertEqual(tough["adjusted"], -2 + 4 + 2.0)

    def test_verdicts(self):
        side = lambda games, adjusted: {"games": games, "wins": 0, "losses": games, "margin": adjusted, "adjusted": adjusted}
        self.assertEqual(nba.verdict({"with": side(10, 3.0), "without": side(6, 2.0)}), "holding")
        self.assertEqual(nba.verdict({"with": side(10, 12.0), "without": side(6, 5.0)}), "holding")  # still a good team
        self.assertEqual(nba.verdict({"with": side(10, 3.0), "without": side(6, -1.0)}), "surviving")
        self.assertEqual(nba.verdict({"with": side(10, 4.0), "without": side(6, -5.0)}), "struggling")
        self.assertIsNone(nba.verdict({"with": side(10, 4.0), "without": side(2, -5.0)}))
        # Out all season: how they're doing on their own.
        self.assertEqual(nba.verdict({"with": side(0, None), "without": side(8, 2.0)}), "holding")
        self.assertEqual(nba.verdict({"with": side(0, None), "without": side(8, -6.0)}), "struggling")

    def test_his_worth_pulled_toward_what_they_lost(self):
        player = regular([True] * 6 + [False] * 6, value=20.0)
        model = PARAMS["injury"] * 20.0
        side = lambda games, adjusted: {"games": games, "adjusted": adjusted}
        # Six games without him, and the team no worse: about a third of the way to nothing lost.
        worth, moved = nba.blended_value(player, {"with": side(6, 3.0), "without": side(6, 3.0)}, PARAMS)
        self.assertTrue(moved)
        self.assertAlmostEqual(worth, (1 - 6 / (6 + nba.SPLIT_K)) * model)
        # Much worse without him: more than the model's number.
        worse, _ = nba.blended_value(player, {"with": side(6, 4.0), "without": side(6, -8.0)}, PARAMS)
        self.assertGreater(worse, model)
        # Better without him never makes his absence a plus.
        better, _ = nba.blended_value(player, {"with": side(6, -6.0), "without": side(12, 8.0)}, PARAMS)
        self.assertGreaterEqual(better, 0.0)
        # Too few games either way: the model's own number.
        self.assertEqual(nba.blended_value(player, {"with": side(6, 3.0), "without": side(2, -9.0)}, PARAMS), (model, False))


class PredictTests(unittest.TestCase):
    def states(self, played, margins):
        return {"DAL": {"games": len(margins), "log": log(margins), "regulars": {"77": regular(played)}},
                "BOS": {"games": len(margins), "log": log([0] * len(margins), opponent="DAL", home=False), "regulars": {}}}

    def game(self, items):
        return {"home": {"abbr": "DAL"}, "away": {"abbr": "BOS"}, "injuries": {"DAL": items}}

    def test_out_six_games_and_holding_their_own(self):
        played, margins = [True] * 6 + [False] * 6, [5] * 12
        states = self.states(played, margins)
        out = [{"id": "77", "name": "Luka Doncic", "status": "Out"}]
        healthy = nba.predict(self.game([]), RT, states, PARAMS, gp._key)
        hurt = nba.predict(self.game(out), RT, states, PARAMS, gp._key)
        entry = hurt["out"]["home"][0]
        self.assertEqual(entry["verdict"], "holding")
        self.assertTrue(entry["splitCounted"])
        self.assertEqual((entry["split"]["without"]["wins"], entry["split"]["without"]["losses"]), (6, 0))
        full_cost = PARAMS["injury"] * 20.0 * 0.5
        lost = healthy["margin"] - hurt["margin"]
        # Less than the model alone would take off, because they've held up without him.
        self.assertLess(lost, full_cost - 0.5)
        self.assertAlmostEqual(lost, entry["impact"], places=1)

    def test_out_all_season(self):
        states = self.states([True] * 8, [-4] * 8)
        states["DAL"]["regulars"] = {}
        last = {"77": {"games": 70, "mpg": 36.0, "ppg": 28.0, "team": "DAL"}}
        hurt = nba.predict(self.game([{"id": "77", "name": "Luka Doncic", "status": "Out"}]), RT, states, PARAMS, gp._key, last=last)
        entry = hurt["out"]["home"][0]
        self.assertTrue(entry["seasonOut"])
        self.assertEqual(entry["impact"], 0.0)
        self.assertEqual(entry["verdict"], "struggling")  # 0-8, losing by 4 a game at home
        self.assertEqual(entry["ppg"], 28.0)
        # A player who didn't matter last season isn't singled out.
        quiet = nba.predict(self.game([{"id": "88", "name": "Two Way", "status": "Out"}]), RT, states, PARAMS, gp._key, last=last)
        self.assertNotIn("seasonOut", quiet["out"]["home"][0])

    def test_last_seasons_regulars(self):
        index = {"min": 2, "pts": 3}
        row = lambda pid, minutes, pts: [pid, 1, minutes, pts]
        games = [{"home": "DAL", "away": "BOS", "lines": {"DAL": [row("77", 36, 30), row("88", 8, 2)], "BOS": []}} for _ in range(25)]
        found = nba.last_regulars(games, index)
        self.assertEqual(found, {"77": {"games": 25, "mpg": 36.0, "ppg": 30.0, "team": "DAL"}})


class WordsTests(unittest.TestCase):
    def test_the_write_up(self):
        split = {"with": {"games": 6, "wins": 4, "losses": 2, "margin": 3.0, "adjusted": 2.5},
                 "without": {"games": 6, "wins": 4, "losses": 2, "margin": 2.0, "adjusted": 1.9}}
        row = {"name": "Luka Doncic", "out": True, "verdict": "holding", "split": split, "splitCounted": True, "full": 4.2}
        text = gp._split_line(row, "the Mavericks")
        self.assertIn("The Mavericks are 4-2 in 6 games without Luka Doncic", text)
        self.assertIn("holding their own", text)
        self.assertIn("counted in what his absence costs them", text)
        whole = {"name": "Luka Doncic", "out": True, "verdict": "struggling", "seasonOut": True,
                 "split": {"with": {"games": 0}, "without": {"games": 8, "wins": 1, "losses": 7, "margin": -6.0, "adjusted": -5.1}}}
        self.assertIn("hasn't played for the Mavericks this season", gp._split_line(whole, "the Mavericks"))
        made = {"sport": "nba", "home": {"short": "Mavericks", "abbr": "DAL"}, "away": {"short": "Celtics", "abbr": "BOS"},
                "out": {"home": [row], "away": []}}
        self.assertTrue(any("without Luka Doncic" in line for line in gp._injury_lines(made, None)))


if __name__ == "__main__":
    unittest.main()
