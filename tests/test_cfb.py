"""College football in the Finder: ESPN's box scores read into player lines
(cfb_research.py) and PrizePicks' CFB lines tied to their games and players
(cfb_board.py)."""
import sys
import unittest
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import cfb_board  # noqa: E402
import cfb_research as cfb  # noqa: E402
from tests import cfb_samples as s  # noqa: E402


def no_kv():
    return patch.multiple(cfb.store, get=MagicMock(return_value=None), set=MagicMock())


def espn(routes):
    """_get answered from {url fragment: payload}."""
    def get(url, timeout=15, attempts=2):
        for fragment, payload in routes.items():
            if fragment in url:
                return payload
        raise AssertionError(f"unexpected request: {url}")
    return patch.object(cfb, "_get", side_effect=get)


def line(pid, player, stat, value, team="TEX", team_name="Texas", opponent="OU", start="2026-10-17T15:30:00-04:00", odds_type="standard"):
    return {"id": pid, "player": player, "stat": stat, "line": value, "odds_type": odds_type, "team": team, "team_name": team_name,
            "description": opponent, "start_time": start, "updated_at": "", "combo": False, "headshot": "", "position": ""}


class BoxScoreTests(unittest.TestCase):
    def test_a_box_score_reads_into_the_nfl_finders_keys(self):
        lines = s.manning("20/30", "254", "2", "1", "8", "32", rush_td="1", long_rush="18")
        lines["receiving"] = [("5000002", "Ryan Wingo", ["6", "88", "14.7", "1", "41"])]
        lines["kicking"] = [("5000003", "Mason Shipley", ["2/3", "66.7", "47", "4/4", "10"])]
        record = cfb.parse_box(s.summary(lines))
        arch = record["lines"]["4870906"]["values"]
        self.assertEqual((arch["pass_completions"], arch["passing_attempts"], arch["passing_yards"], arch["passing_touchdowns"], arch["interceptions"]),
                         (20, 30, 254, 2, 1))
        self.assertEqual((arch["rush_attempts"], arch["rushing_yards"], arch["longest_rush"], arch["passing_rushing_yards"]), (8, 32, 18, 286))
        self.assertEqual(arch["receptions"], 0, "no catches: none in the box score")
        # 254 * .04 + 2 * 4 - 1 + 32 * .1 + 6.
        self.assertEqual(arch["fantasy_score"], 26.36)
        wingo = record["lines"]["5000002"]["values"]
        self.assertEqual((wingo["receptions"], wingo["receiving_yards"], wingo["longest_reception"], wingo["touchdowns"]), (6, 88, 41, 1))
        self.assertEqual(record["lines"]["5000002"]["pos"], "WR")
        kicker = record["lines"]["5000003"]["values"]
        self.assertEqual((kicker["fg_made"], kicker["fg_attempts"], kicker["pat_made"], kicker["kicking_points"], kicker["longest_fg"]), (2, 3, 4, 10, 47))
        self.assertNotIn("fg_made", arch, "only kickers have kicking numbers")
        # What each offense did, so the other side's log knows what it gave up.
        self.assertEqual(record["gained"]["201"]["passYards"], 180)
        self.assertEqual((record["gained"]["251"]["completions"], record["gained"]["251"]["passTds"]), (20, 2))

    def test_a_negative_rushing_day_is_not_split_like_a_pair(self):
        record = cfb.parse_box(s.summary(s.manning("10/20", "120", "0", "0", "6", "-4", long_rush="3")))
        self.assertEqual(record["lines"]["4870906"]["values"]["rushing_yards"], -4)


class GameMatchTests(unittest.TestCase):
    def test_a_line_finds_its_game_by_team_abbreviation_or_school(self):
        games = [cfb._event(item) for item in s.SCOREBOARD["events"]]
        kick = datetime(2026, 10, 17, 19, 30, tzinfo=timezone.utc).timestamp()
        game, side = cfb.find_game(kick, games, "TEX", "Texas", "OU")
        self.assertEqual((game["id"], side), ("401700001", "away"))
        game, side = cfb.find_game(kick, games, "BAMA", "Alabama", "")
        self.assertEqual((game["id"], side), ("401700002", "home"), "an abbreviation ESPN doesn't use: the school name")
        self.assertEqual(cfb.find_game(kick, games, "ZZZ", "Nowhere State", ""), (None, None))

    def test_players_match_by_name_or_last_name_and_initial(self):
        players = {pid: {"name": item["fullName"]} for pid, item in
                   ((item["id"], item) for group in s.ROSTERS["251"]["athletes"] for item in group["items"])}
        self.assertEqual(cfb.match_player("Arch Manning", players), "4870906")
        self.assertEqual(cfb.match_player("A. Manning", players), "4870906")
        self.assertIsNone(cfb.match_player("Peyton Manning Jr.", players))

    def test_seasons_run_august_through_january(self):
        self.assertEqual(cfb.season_of(date(2026, 10, 15)), 2026)
        self.assertEqual(cfb.season_of(date(2027, 1, 9)), 2026)


class BoardTests(unittest.TestCase):
    def setUp(self):
        cfb._memory.clear()

    def build(self, projections):
        routes = {"scoreboard": s.SCOREBOARD, **{f"teams/{tid}/roster": roster for tid, roster in s.ROSTERS.items()}}
        now = datetime(2026, 10, 17, 12, 0, tzinfo=timezone.utc).timestamp()
        with no_kv(), espn(routes):
            return cfb_board.build(projections=projections, now=now)

    def test_lines_are_tied_to_their_game_player_and_stat(self):
        board = self.build([line("1", "Arch Manning", "Pass Yards", 254.5), line("2", "Arch Manning", "Rush+Rec Yds", 30.5, odds_type="goblin"),
                            line("3", "Ty Simpson", "Pass TDs", 1.5, team="ALA", team_name="Alabama", opponent="UGA"),
                            line("4", "Mason Shipley", "Kicking Points", 7.5)])
        rows = {row["id"]: row for row in board["rows"]}
        arch = rows["pp:1"]
        self.assertEqual((arch["playerId"], arch["team"], arch["teamId"], arch["opponent"], arch["opponentId"]), ("4870906", "TEX", "251", "OU", "201"))
        self.assertEqual((arch["valueKey"], arch["position"], arch["gameId"], arch["isHome"]), ("passing_yards", "QB", "401700001", False))
        self.assertEqual(arch["headshot"], "https://img/arch.png")
        self.assertEqual((rows["pp:2"]["valueKey"], rows["pp:2"]["modifier"]), ("rushing_receiving_yards", "goblin"))
        self.assertEqual((rows["pp:3"]["playerId"], rows["pp:3"]["valueKey"]), ("5200001", "passing_touchdowns"))
        self.assertEqual((rows["pp:4"]["position"], rows["pp:4"]["valueKey"]), ("K", "kicking_points"))

    def test_a_team_named_unlike_espn_is_found_by_whose_roster_has_him(self):
        board = self.build([line("5", "Gunner Stockton", "Pass Yards", 230.5, team="GEOR", team_name="UGA Bulldogs", opponent="BAMA")])
        row = board["rows"][0]
        self.assertEqual((row["playerId"], row["team"], row["opponent"], row["isHome"]), ("5300001", "UGA", "ALA", False))

    def test_started_games_and_combos_are_left_off(self):
        board = self.build([line("6", "Arch Manning", "Pass Yards", 254.5, start="2026-10-17T07:00:00-04:00"),
                            {**line("7", "Manning + Wisner", "Rush Yards", 90.5), "combo": True}])
        self.assertEqual(board["rows"], [])


class TeamLogTests(unittest.TestCase):
    def setUp(self):
        cfb._memory.clear()

    def test_a_teams_finished_games_with_each_players_line(self):
        schedule = {"events": [
            s.event("401600010", "2025-11-29T17:00Z", s.TEXAS, s.team("245", "TA&M", "Texas A&M", "Aggies"), 17, 7, True, 2025, schedule=True),
            s.event("401700010", "2026-09-06T19:30Z", s.TEXAS, s.team("194", "OSU", "Ohio State", "Buckeyes"), 24, 27, True, 2026, schedule=True),
            s.event("401700001", "2026-10-17T19:30Z", s.OKLAHOMA, s.TEXAS, schedule=True)]}
        summaries = {"401600010": s.summary(s.manning("18/27", "210", "1", "0", "5", "20"), "245"),
                     "401700010": s.summary(s.manning("22/35", "301", "3", "1", "9", "45", rush_td="1"), "194")}
        routes = {"teams/251/schedule?season=2025&seasontype=2": {"events": schedule["events"][:1]},
                  "teams/251/schedule?season=2026&seasontype=2": {"events": schedule["events"][1:]},
                  "seasontype=3": {"events": []}, "teams/251/roster": s.ROSTERS["251"],
                  "summary?event=401600010": summaries["401600010"], "summary?event=401700010": summaries["401700010"],
                  "/teams?groups=80": {"sports": [{"leagues": [{"teams": [{"team": s.TEXAS}]}]}]}}
        with no_kv(), espn(routes):
            log = cfb.team_log("251", "201", day=date(2026, 10, 15))
        self.assertTrue(log["complete"])
        self.assertEqual([game["gameId"] for game in log["games"]], ["401600010", "401700010"], "only finished games, oldest first")
        last = log["games"][-1]
        self.assertEqual((last["team"], last["opponent"], last["isHome"], last["result"], last["score"], last["season"]),
                         ("TEX", "OSU", True, "L", "24-27", 2026))
        self.assertEqual(last["players"]["4870906"]["passing_yards"], 301)
        self.assertEqual(last["against"]["passYards"], 180, "what Ohio State's offense did against Texas")
        self.assertEqual(last["against"]["points"], 27)
        self.assertEqual(log["players"]["4870906"]["pos"], "QB")
        self.assertEqual(log["team"], "TEX")


class FindTests(unittest.TestCase):
    def setUp(self):
        cfb._memory.clear()

    def test_a_slips_player_is_found_from_a_recent_board(self):
        stored = {}
        with patch.multiple(cfb.store, get=MagicMock(side_effect=lambda key, **_: stored.get(key)),
                            set=MagicMock(side_effect=lambda key, value, ex=None: stored.__setitem__(key, value))):
            cfb.remember_players([{"player": "Arch Manning", "playerId": "4870906", "team": "TEX", "teamId": "251", "teamName": "Texas Longhorns"}])
            self.assertEqual(cfb.find("Arch Manning")[0]["playerId"], "4870906")
            self.assertEqual(cfb.find("A. Manning", "TEX")[0]["teamId"], "251")
            self.assertEqual(cfb.find("Nobody Here"), [])


if __name__ == "__main__":
    unittest.main()
