import unittest
from datetime import datetime, timezone
from unittest.mock import patch

import game_live
import game_predictor as gp
import nba_live
from test_game_live import nba_summary


def nba_feed():
    """NBA.com's scoreboard, play-by-play and box score for HOU @ PHX late in the 2nd."""
    board = {"scoreboard": {"games": [
        {"gameId": "0022600140", "gameStatus": 2, "period": 2, "gameClock": "PT00M31.20S",
         "homeTeam": {"teamTricode": "PHX", "score": 49}, "awayTeam": {"teamTricode": "HOU", "score": 52}},
        {"gameId": "0022600141", "gameStatus": 1, "period": 0, "gameClock": "",
         "homeTeam": {"teamTricode": "GSW", "score": 0}, "awayTeam": {"teamTricode": "NOP", "score": 0}}]}}
    actions = [{"actionNumber": 400, "period": 2, "clock": "PT01M21.00S", "teamTricode": "PHX", "description": "K. Durant REBOUND (Off:0 Def:5)",
                "scoreHome": "47", "scoreAway": "47"},
               {"actionNumber": 402, "period": 2, "clock": "PT00M58.00S", "teamTricode": "HOU", "description": "J. Green 26' 3PT (14 PTS)",
                "scoreHome": "47", "scoreAway": "50"},
               {"actionNumber": 405, "period": 2, "clock": "PT00M31.20S", "teamTricode": "HOU", "description": "A. Sengun 4' Layup (12 PTS)",
                "scoreHome": "47", "scoreAway": "52"}]
    player = lambda pid, name, short, points, minutes="PT18M30.00S", status="ACTIVE": {
        "personId": pid, "name": name, "nameI": short, "starter": "1", "status": status,
        "statistics": {"points": points, "reboundsTotal": 4, "assists": 3, "steals": 1, "blocks": 0, "turnovers": 2, "foulsPersonal": 1,
                       "reboundsOffensive": 1, "reboundsDefensive": 3, "fieldGoalsMade": 5, "fieldGoalsAttempted": 9,
                       "threePointersMade": 2, "threePointersAttempted": 4, "freeThrowsMade": 1, "freeThrowsAttempted": 2, "minutes": minutes}}
    box = {"game": {"gameStatus": 2, "period": 2, "gameClock": "PT00M31.20S",
                    "homeTeam": {"teamTricode": "PHX", "score": 49, "periods": [{"period": 1, "score": 24}, {"period": 2, "score": 25}, {"period": 3, "score": 0}, {"period": 4, "score": 0}],
                                 "players": [player(1626164, "Devin Booker", "D. Booker", 18), player(201142, "Kevin Durant", "K. Durant", 14),
                                             player(9, "Hurt Guy", "H. Guy", 0, "PT00M00.00S", "INACTIVE")]},
                    "awayTeam": {"teamTricode": "HOU", "score": 52, "periods": [{"period": 1, "score": 22}, {"period": 2, "score": 30}, {"period": 3, "score": 0}, {"period": 4, "score": 0}],
                                 "players": [player(1630224, "Jalen Green", "J. Green", 14)]}}}
    return {"/scoreboard/todaysScoreboard_00.json": board, "/playbyplay/playbyplay_0022600140.json": {"game": {"actions": actions}},
            "/boxscore/boxscore_0022600140.json": box}


class NbaLiveTests(unittest.TestCase):
    def setUp(self):
        feed = nba_feed()
        self.patch = patch.object(nba_live, "_get", side_effect=lambda path, seconds: feed.get(path))
        self.patch.start()

    def tearDown(self):
        self.patch.stop()

    def test_clock_and_names(self):
        self.assertEqual(nba_live.clock_text("PT01M21.00S"), "1:21")
        self.assertEqual(nba_live.clock_text("PT00M54.40S"), "0:54.4")
        self.assertEqual(nba_live.clock_text("PT11M05.00S"), "11:05")
        self.assertEqual((nba_live.tricode("GS"), nba_live.tricode("WSH"), nba_live.tricode("PHX")), ("GSW", "WAS", "PHX"))

    def test_a_game_on_now(self):
        found = nba_live.live("PHX", "HOU")
        self.assertEqual((found["home"], found["away"], found["detail"]), (49, 52, "0:31.2 - 2nd"))
        self.assertEqual(found["quarters"], {"labels": ["Q1", "Q2"], "home": [24, 25], "away": [22, 30]})
        self.assertEqual(found["plays"][-1]["text"], "A. Sengun 4' Layup (12 PTS)")
        self.assertEqual(found["plays"][-1]["clock"]["displayValue"], "0:31.2")
        booker = found["box"]["home"][0]
        self.assertEqual((booker["name"], booker["stats"]["pts"], booker["stats"]["min"]), ("Devin Booker", 18, 18.5))
        self.assertIn("1626164", booker["headshot"])
        self.assertTrue(found["box"]["home"][2]["out"])
        # A game not started, or not on NBA.com's board: ESPN stands.
        self.assertIsNone(nba_live.live("GS", "NO"))
        self.assertIsNone(nba_live.live("LAL", "BOS"))

    def test_the_chart_takes_nba_coms_feed(self):
        summary = nba_summary()
        summary["header"]["competitions"][0]["competitors"][0]["team"]["abbreviation"] = "PHX"
        gp._memory.clear()
        with patch.object(gp, "_espn", return_value=summary), patch.object(game_live, "prop_lines", return_value={"devinbooker|points": 26.5}), \
                patch.object(gp, "_read", return_value=[]), patch.object(gp, "dk_events", return_value=[]):
            found = gp.chart("nba", "401", now=datetime(2026, 11, 8, 3, tzinfo=timezone.utc), store=object())
        gp._memory.clear()
        self.assertEqual(found["liveSource"], "nba.com")
        self.assertEqual(found["feed"]["last"], {"text": "A. Sengun 4' Layup (12 PTS)", "when": "Q2 0:31.2", "side": "away"})
        self.assertEqual(found["feed"]["quarters"]["away"], [22, 30])
        self.assertEqual((found["home"]["score"], found["away"]["score"], found["detail"]), (49, 52, "0:31.2 - 2nd"))
        self.assertEqual(found["props"][0]["now"], 18)
        # The win chance line stays ESPN's.
        self.assertEqual(found["clock"]["points"][-1], [1790.0, 0.52])

    def test_espn_when_nba_com_is_quiet(self):
        self.patch.stop()
        with patch.object(nba_live, "_get", return_value=None):
            self.assertIsNone(nba_live.live("PHX", "HOU"))
            self.assertEqual(game_live.with_nba_scores([{"id": "1", "state": "in", "detail": "x", "home": {"abbr": "PHX"}, "away": {"abbr": "HOU"}}])[0]["detail"], "x")
        self.patch.start()

    def test_the_list_takes_nba_coms_scores(self):
        games = [{"id": "1", "state": "in", "detail": "1:21 - 2nd", "home": {"abbr": "PHX", "score": 47}, "away": {"abbr": "HOU", "score": 47}},
                 {"id": "2", "state": "pre", "detail": "10:00 PM", "home": {"abbr": "GS"}, "away": {"abbr": "NO"}}]
        found = game_live.with_nba_scores(games)
        self.assertEqual((found[0]["home"]["score"], found[0]["away"]["score"], found[0]["detail"]), (49, 52, "0:31.2 - 2nd"))
        self.assertEqual(found[1], games[1])

    def test_a_feed_that_fails_is_left_alone_a_while(self):
        self.patch.stop()
        nba_live._resting["until"] = 0
        gp._memory.clear()
        with patch.object(nba_live.requests, "get", side_effect=OSError("refused")) as get:
            self.assertIsNone(nba_live._get("/scoreboard/todaysScoreboard_00.json", 5))
            self.assertIsNone(nba_live._get("/scoreboard/todaysScoreboard_00.json", 5))
        self.assertEqual(get.call_count, 1)
        nba_live._resting["until"] = 0
        gp._memory.clear()
        self.patch.start()


if __name__ == "__main__":
    unittest.main()
