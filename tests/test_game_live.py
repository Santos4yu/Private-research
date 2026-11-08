import unittest
from datetime import datetime, timezone
from unittest.mock import patch

import game_live as live
import game_predictor as gp

NBA_KEYS = ["minutes", "fieldGoalsMade-fieldGoalsAttempted", "threePointFieldGoalsMade-threePointFieldGoalsAttempted",
            "freeThrowsMade-freeThrowsAttempted", "offensiveRebounds", "defensiveRebounds", "rebounds", "assists", "steals",
            "blocks", "turnovers", "fouls", "plusMinus", "points"]


def athlete(pid, name, short, stats, starter=True, dnp=False):
    return {"athlete": {"id": pid, "displayName": name, "shortName": short, "headshot": {"href": f"https://img/{pid}.png"}},
            "starter": starter, "didNotPlay": dnp, "stats": stats}


def play(pid, period, clock, home, away, team="21", text="A play"):
    return {"id": pid, "period": {"number": period}, "clock": {"displayValue": clock}, "homeScore": home, "awayScore": away,
            "team": {"id": team}, "text": text}


def nba_summary(state="in"):
    """PHX (home, id 21) and HOU (away, id 10) in the third quarter."""
    plays = [play("p1", 1, "11:40", 0, 2, "10", "Alperen Sengun makes 4-foot layup"),
             play("p2", 1, "10:00", 3, 2, "21", "Devin Booker makes 26-foot three point jumper"),
             play("p3", 1, "6:00", 3, 14, "10", "Jalen Green makes 24-foot three point jumper"),
             play("p4", 2, "8:00", 3, 14, "21", "Kevin Durant defensive rebound"),
             play("p5", 3, "9:00", 7, 14, "21", "Kevin Durant makes 18-foot jumper"),
             play("p6", 3, "7:00", 12, 14, "21", "Devin Booker makes 25-foot three point jumper (Kevin Durant assists)"),
             play("p7", 3, "6:10", 16, 14, "21", "Devin Booker makes driving layup")]
    chances = [0.45, 0.47, 0.30, 0.31, 0.36, 0.44, 0.52]
    return {"header": {"competitions": [{"date": "2026-11-08T02:00Z",
                                         "status": {"period": 3, "displayClock": "6:00", "type": {"state": state, "shortDetail": "6:00 - 3rd"}},
                                         "competitors": [{"id": "21", "homeAway": "home", "team": {"id": "21", "abbreviation": "PHX"}, "score": "16",
                                                          "linescores": [{"value": 3.0}, {"value": 0.0}, {"value": 13.0}]},
                                                         {"id": "10", "homeAway": "away", "team": {"id": "10", "abbreviation": "HOU"}, "score": "14",
                                                          "linescores": [{"value": 14.0}, {"value": 0.0}, {"value": 0.0}]}]}]},
            "plays": plays,
            "winprobability": [{"playId": item["id"], "homeWinPercentage": chance} for item, chance in zip(plays, chances)],
            "boxscore": {"players": [
                {"team": {"id": "21", "abbreviation": "PHX"}, "statistics": [{"keys": NBA_KEYS, "athletes": [
                    athlete("1", "Devin Booker", "D. Booker", ["24", "4-9", "2-5", "0-0", "0", "3", "3", "4", "1", "0", "2", "1", "+2", "10"]),
                    athlete("2", "Kevin Durant", "K. Durant", ["22", "2-6", "0-1", "0-0", "1", "6", "7", "2", "0", "1", "1", "2", "+4", "4"]),
                    athlete("3", "Bench Guy", "B. Guy", [], starter=False, dnp=True)]}]},
                {"team": {"id": "10", "abbreviation": "HOU"}, "statistics": [{"keys": NBA_KEYS, "athletes": [
                    athlete("4", "Jalen Green", "J. Green", ["25", "4-11", "3-7", "0-0", "0", "2", "2", "1", "0", "0", "3", "2", "-2", "11"]),
                    athlete("5", "Jabari Smith Jr.", "J. Smith Jr.", ["20", "1-3", "0-1", "1-2", "2", "5", "7", "0", "1", "2", "0", "3", "-4", "3"])]}]}]}}


class FeedTests(unittest.TestCase):
    def test_the_last_play_the_run_and_the_quarters(self):
        found = live.feed("nba", nba_summary())
        self.assertEqual(found["last"], {"text": "Devin Booker makes driving layup", "when": "Q3 6:10", "side": "home"})
        # PHX scored 13 straight after HOU's 14-3.
        self.assertEqual(found["run"], {"side": "home", "points": 13})
        self.assertEqual(found["quarters"], {"labels": ["Q1", "Q2", "Q3"], "home": [3, 0, 13], "away": [14, 0, 0]})
        self.assertEqual(found["lead"], {"home": 2, "away": 11})
        self.assertEqual(found["leaders"]["home"][0], {"name": "D. Booker", "text": "10 pts · 3 reb · 4 ast"})
        self.assertEqual([item["name"] for item in found["leaders"]["away"]], ["J. Green", "J. Smith Jr."])

    def test_a_run_needs_enough_unanswered_points(self):
        timeline = [(0, 0, 2), (60, 3, 2), (120, 5, 2)]
        self.assertIsNone(live.current_run("nba", timeline))
        self.assertEqual(live.current_run("nba", timeline + [(200, 8, 2)]), {"side": "home", "points": 8})
        # The other team scoring ends it.
        self.assertIsNone(live.current_run("nba", timeline + [(200, 8, 2), (260, 8, 4)]))

    def test_the_plays_that_swung_it(self):
        found = live.swings("nba", nba_summary())
        # 0.47 -> 0.30 (Green's three) and 0.36 -> 0.44 (Booker's three); the rest moved less or sat too close.
        self.assertEqual([(item["when"], item["side"], item["delta"]) for item in found], [("Q1 6:00", "away", -0.17), ("Q3 7:00", "home", 0.08)])
        self.assertEqual(found[0]["at"], 360.0)
        self.assertIn("Jalen Green", found[0]["text"])

    def test_who_won_each_stretch(self):
        found = live.momentum("nba", nba_summary())
        # Three-minute stretches up to now (Q3 6:00 = 1800 s into the game).
        self.assertEqual(len(found), 10)
        self.assertEqual(found[0], {"start": 0, "end": 180, "home": 3, "away": 2})
        self.assertEqual(found[2], {"start": 360, "end": 540, "home": 0, "away": 12})
        self.assertEqual(found[9], {"start": 1620, "end": 1800, "home": 13, "away": 0})
        self.assertEqual(sum(item["home"] for item in found), 16)
        # Overtime stretches are shorter.
        self.assertEqual(live.stretches("nba", 2880 + 300)[-2:], [(2880, 3030), (3030, 3180)])


class PropTests(unittest.TestCase):
    def test_each_line_against_what_he_has(self):
        box = live.box_score("nba", nba_summary())
        lines = {"devinbooker|points": 26.5, "devinbooker|ptsrebsasts": 35.5, "kevindurant|rebounds": 6.5,
                 "jabarismithjr|rebounds": 8.5, "jalengreen|3ptmade": 2.5, "benchguy|points": 4.5,
                 "someoneelse|points": 20.5, "devinbooker|fantasyscore": 30.5, "devinbooker|dunks": 1.5}
        found = live.props("nba", box, lines)
        rows = {(row["short"], row["stat"]): (row["now"], row["line"]) for row in found}
        self.assertEqual(rows[("D. Booker", "Points")], (10, 26.5))
        self.assertEqual(rows[("D. Booker", "Pts + Reb + Ast")], (17, 35.5))
        self.assertAlmostEqual(rows[("D. Booker", "Fantasy score")][0], 20.6)
        self.assertEqual(rows[("J. Smith Jr.", "Rebounds")], (7, 8.5))
        # Not in this game, didn't play, or a stat with no count: left out.
        self.assertEqual(len(found), 6)
        # Past their lines first, then the closest.
        self.assertEqual([(row["short"], row["stat"]) for row in found[:2]], [("J. Green", "3-pointers"), ("K. Durant", "Rebounds")])
        self.assertEqual(found[0]["minutes"], 25)

    def test_names_with_and_without_jr(self):
        self.assertEqual(live.person_key("Jabari Smith Jr."), "jabarismith")
        self.assertEqual(live.person_key("Nikola Jokić"), "nikolajokic")
        box = {"home": [{"name": "Jaren Jackson", "short": "J. Jackson", "stats": {"pts": 12}}], "away": []}
        self.assertEqual(live.props("nba", box, {"jarenjacksonjr|points": 18.5})[0]["now"], 12)

    def test_nfl_lines_from_the_box_score(self):
        groups = [{"name": "passing", "keys": ["completions/passingAttempts", "passingYards", "yardsPerPassAttempt", "passingTouchdowns", "interceptions"],
                   "athletes": [athlete("9", "Jalen Hurts", "J. Hurts", ["14/20", "182", "9.1", "2", "0"])]},
                  {"name": "rushing", "keys": ["rushingAttempts", "rushingYards", "yardsPerRushAttempt", "rushingTouchdowns", "longRushing"],
                   "athletes": [athlete("9", "Jalen Hurts", "J. Hurts", ["6", "31", "5.2", "1", "12"]),
                                athlete("8", "Saquon Barkley", "S. Barkley", ["15", "88", "5.9", "0", "24"])]},
                  {"name": "receiving", "keys": ["receptions", "receivingYards", "yardsPerReception", "receivingTouchdowns", "longReception", "receivingTargets"],
                   "athletes": [athlete("7", "A.J. Brown", "A. Brown", ["5", "77", "15.4", "1", "30", "8"]),
                                athlete("8", "Saquon Barkley", "S. Barkley", ["2", "11", "5.5", "0", "8", "2"])]}]
        summary = {"header": {"competitions": [{"competitors": [{"homeAway": "home", "team": {"id": "21", "abbreviation": "PHI"}},
                                                                {"homeAway": "away", "team": {"id": "6", "abbreviation": "DAL"}}]}]},
                   "boxscore": {"players": [{"team": {"id": "21"}, "statistics": groups}]}}
        box = live.box_score("nfl", summary)
        found = {(row["short"], row["stat"]): row["now"] for row in live.props("nfl", box, {
            "jalenhurts|passyards": 230.5, "jalenhurts|passrushyds": 260.5, "saquonbarkley|rushrecyds": 120.5,
            "ajbrown|receptions": 5.5, "ajbrown|rushrectds": 0.5, "saquonbarkley|rushattempts": 18.5})}
        self.assertEqual(found, {("J. Hurts", "Pass yards"): 182, ("J. Hurts", "Pass + rush yards"): 213, ("S. Barkley", "Rush + rec yards"): 99,
                                 ("A. Brown", "Receptions"): 5, ("A. Brown", "Rush + rec TDs"): 1, ("S. Barkley", "Rush attempts"): 15})
        self.assertEqual([item["text"] for item in live.leaders("nfl", box)["home"]],
                         ["14/20 · 182 pass yds · 2 TD", "15 car · 88 rush yds", "5 rec · 77 yds"])


class ChartExtrasTests(unittest.TestCase):
    def test_the_chart_carries_them(self):
        gp._memory.clear()
        with patch.object(gp, "_espn", return_value=nba_summary()), patch.object(live, "prop_lines", return_value={"devinbooker|points": 26.5}), \
                patch.object(gp, "_read", return_value=[]), patch.object(gp, "dk_events", return_value=[]):
            found = gp.chart("nba", "401", now=datetime(2026, 11, 8, 3, tzinfo=timezone.utc), store=object())
        gp._memory.clear()
        self.assertEqual(found["feed"]["run"], {"side": "home", "points": 13})
        self.assertEqual(len(found["swings"]), 2)
        self.assertEqual(len(found["momentum"]), 10)
        self.assertEqual(found["props"][0]["stat"], "Points")
        self.assertEqual(found["clock"]["now"], 1800)

    def test_one_part_failing_leaves_the_rest(self):
        with patch.object(live, "prop_lines", side_effect=RuntimeError("no store")):
            found = live.extras("nba", nba_summary())
        self.assertIsNone(found["props"])
        self.assertEqual(found["feed"]["run"]["points"], 13)


class LiveListTests(unittest.TestCase):
    def test_the_games_on_now(self):
        board = {"events": [
            {"id": "401", "date": "2026-11-08T02:00Z", "competitions": [{"status": {"type": {"state": "in", "shortDetail": "6:00 - 3rd"}},
                                                                         "competitors": [{"homeAway": "home", "team": {"abbreviation": "PHX"}, "score": "16"},
                                                                                         {"homeAway": "away", "team": {"abbreviation": "HOU"}, "score": "14"}]}]},
            {"id": "402", "date": "2026-11-08T03:00Z", "competitions": [{"status": {"type": {"state": "pre", "shortDetail": "10:00 PM"}},
                                                                         "competitors": [{"homeAway": "home", "team": {"abbreviation": "LAL"}},
                                                                                         {"homeAway": "away", "team": {"abbreviation": "BOS"}}]}]}]}
        def espn(sport, path, params=None):
            return board if path == "/scoreboard" else nba_summary()
        gp._memory.clear()
        with patch.object(gp, "_espn", side_effect=espn):
            found = live.live_list("nba", now=datetime(2026, 11, 8, 3, tzinfo=timezone.utc))
        gp._memory.clear()
        self.assertEqual([game["id"] for game in found["games"]], ["401"])
        game = found["games"][0]
        self.assertEqual((game["detail"], game["home"]["score"], game["away"]["score"]), ("6:00 - 3rd", 16, 14))
        self.assertEqual(game["spark"]["length"], 2880)
        self.assertEqual(game["spark"]["points"][-1], [1790.0, 0.52])

    def test_a_long_line_is_cut_down(self):
        summary = nba_summary()
        summary["plays"] = [play(f"x{n}", 1 + n // 60, f"{11 - (n % 60) // 6}:{(n % 6) * 10:02d}", n, 0) for n in range(200)]
        summary["winprobability"] = [{"playId": f"x{n}", "homeWinPercentage": 0.5 + n / 1000} for n in range(200)]
        found = live.spark("nba", summary)
        self.assertLessEqual(len(found["points"]), live.LIST_POINTS + 1)
        # The line still ends at the latest play.
        self.assertEqual(found["points"][-1], gp.game_clock_series("nba", summary)["points"][-1])


if __name__ == "__main__":
    unittest.main()
