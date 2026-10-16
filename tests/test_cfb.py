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

    def test_each_game_says_whether_the_opponent_is_fbs(self):
        schedule = [s.event("401600010", "2025-11-29T17:00Z", s.TEXAS, s.team("245", "TA&M", "Texas A&M", "Aggies"), 17, 7, True, 2025, schedule=True),
                    s.event("401700010", "2026-09-06T19:30Z", s.TEXAS, s.team("194", "OSU", "Ohio State", "Buckeyes"), 24, 27, True, 2026, schedule=True)]
        routes = {"teams/251/schedule?season=2025&seasontype=2": {"events": schedule[:1]},
                  "teams/251/schedule?season=2026&seasontype=2": {"events": schedule[1:]},
                  "seasontype=3": {"events": []}, "teams/251/roster": s.ROSTERS["251"],
                  "summary?event=401600010": s.summary(s.manning("18/27", "210", "1", "0", "5", "20"), "245"),
                  "summary?event=401700010": s.summary(s.manning("22/35", "301", "3", "1", "9", "45"), "194"),
                  # Ohio State is on the FBS list; the other side here is not.
                  "/teams?groups=80": {"sports": [{"leagues": [{"teams": [{"team": s.TEXAS}, {"team": s.team("194", "OSU", "Ohio State", "Buckeyes")}]}]}]}}
        with no_kv(), espn(routes):
            log = cfb.team_log("251", day=date(2026, 10, 15))
        self.assertEqual([game["opponentFbs"] for game in log["games"]], [False, True])

    def test_an_unreadable_fbs_list_leaves_the_opponents_unknown(self):
        schedule = [s.event("401700010", "2026-09-06T19:30Z", s.TEXAS, s.team("194", "OSU", "Ohio State", "Buckeyes"), 24, 27, True, 2026, schedule=True)]
        routes = {"teams/251/schedule?season=2025&seasontype=2": {"events": []},
                  "teams/251/schedule?season=2026&seasontype=2": {"events": schedule},
                  "seasontype=3": {"events": []}, "teams/251/roster": s.ROSTERS["251"],
                  "summary?event=401700010": s.summary(s.manning("22/35", "301", "3", "1", "9", "45"), "194"),
                  "/teams?groups=80": {"sports": []}}
        with no_kv(), espn(routes):
            log = cfb.team_log("251", day=date(2026, 10, 15))
        self.assertIsNone(log["games"][0]["opponentFbs"], "not every opponent marked FCS because the list was empty")
        self.assertEqual(log["games"][0]["players"]["4870906"]["passing_yards"], 301)


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


def box(home_id, away_id, home_lines, away_lines):
    """A summary whose box score has each side's players: {pid: (name, {category: [stats...]})}."""
    specs = {"passing": (["completions/passingAttempts", "passingYards", "yardsPerPassAttempt", "passingTouchdowns", "interceptions"],
                         ["C/ATT", "YDS", "AVG", "TD", "INT"]),
             "rushing": (["rushingAttempts", "rushingYards", "yardsPerRushAttempt", "rushingTouchdowns", "longRushing"], ["CAR", "YDS", "AVG", "TD", "LONG"]),
             "receiving": (["receptions", "receivingYards", "yardsPerReception", "receivingTouchdowns", "longReception"], ["REC", "YDS", "AVG", "TD", "LONG"]),
             "defensive": (["totalTackles", "soloTackles", "sacks", "tacklesForLoss"], ["TOT", "SOLO", "SACKS", "TFL"])}

    def side(tid, players):
        groups = {}
        for pid, (name, categories) in players.items():
            for category, stats in categories.items():
                groups.setdefault(category, []).append({"athlete": {"id": pid, "displayName": name}, "stats": stats})
        return {"team": {"id": tid}, "statistics": [{"name": name, "keys": specs[name][0], "labels": specs[name][1], "athletes": rows}
                                                    for name, rows in groups.items()]}

    def totals(tid, players):
        passing = [stats for _name, categories in players.values() for name, stats in categories.items() if name == "passing"]
        rushing = [stats for _name, categories in players.values() for name, stats in categories.items() if name == "rushing"]
        pass_yards = sum(int(stats[1]) for stats in passing)
        rush_yards = sum(int(stats[1]) for stats in rushing)
        cmp, att = (sum(int(stats[0].split("/")[i]) for stats in passing) for i in (0, 1))
        return {"team": {"id": tid}, "statistics": [{"name": "netPassingYards", "displayValue": str(pass_yards)},
                                                    {"name": "rushingYards", "displayValue": str(rush_yards)},
                                                    {"name": "totalYards", "displayValue": str(pass_yards + rush_yards)},
                                                    {"name": "completionAttempts", "displayValue": f"{cmp}-{att}"},
                                                    {"name": "rushingAttempts", "displayValue": str(sum(int(stats[0]) for stats in rushing))}]}
    return {"boxscore": {"teams": [totals(home_id, home_lines), totals(away_id, away_lines)],
                         "players": [side(home_id, home_lines), side(away_id, away_lines)]}}


QB = lambda cmp, yds, td="1": {"passing": [cmp, yds, "7.0", td, "0"]}
RUSH = lambda car, yds: {"rushing": [car, yds, "4.0", "0", "10"]}
CATCH = lambda rec, yds: {"receiving": [rec, yds, "10.0", "0", "20"]}


class LeagueTests(unittest.TestCase):
    def setUp(self):
        cfb._memory.clear()

    def build(self):
        texas, ou, bama, uga = s.TEXAS, s.OKLAHOMA, s.ALABAMA, s.GEORGIA
        days = {"20260905": [s.event("e1", "2026-09-05T19:30Z", texas, ou, 31, 17, True)],
                "20260912": [s.event("e2", "2026-09-12T19:30Z", bama, texas, 24, 21, True), s.event("e3", "2026-09-12T23:30Z", uga, ou, 35, 10, True)],
                "20260919": [s.event("e4", "2026-09-19T19:30Z", bama, uga, 20, 27, True)]}
        boxes = {
            "e1": box("251", "201", {"t-qb": ("Arch Manning", {**QB("20/30", "300"), **RUSH("5", "20")}), "t-wr": ("Ryan Wingo", CATCH("8", "150"))},
                      {"o-qb": ("John Mateer", QB("15/25", "180")), "o-rb": ("OU Back", RUSH("20", "90"))}),
            "e2": box("333", "251", {"b-qb": ("Ty Simpson", QB("18/28", "250")), "b-rb": ("Bama Back", RUSH("15", "60"))},
                      {"t-qb": ("Arch Manning", QB("22/35", "200")), "t-wr": ("Ryan Wingo", CATCH("4", "60"))}),
            "e3": box("61", "201", {"g-qb": ("Gunner Stockton", QB("25/32", "320", "3")), "g-te": ("UGA Tight End", CATCH("6", "70"))},
                      {"o-qb": ("John Mateer", QB("12/30", "140", "0"))}),
            "e4": box("333", "61", {"b-qb": ("Ty Simpson", QB("20/30", "210"))}, {"g-qb": ("Gunner Stockton", QB("19/26", "230"))}),
        }
        rosters = {"251": {"athletes": [{"items": [{"id": "t-qb", "fullName": "Arch Manning", "position": {"abbreviation": "QB"}},
                                                    {"id": "t-wr", "fullName": "Ryan Wingo", "position": {"abbreviation": "WR"}}]}]},
                   "61": {"athletes": [{"items": [{"id": "g-te", "fullName": "UGA Tight End", "position": {"abbreviation": "TE"}}]}]}}

        def get(url, timeout=15, attempts=2):
            if "scoreboard?dates=" in url:
                return {"events": days.get(url.split("dates=")[1][:8], [])}
            if "summary?event=" in url:
                return boxes[url.split("event=")[1]]
            if "/roster" in url:
                return rosters.get(url.split("/teams/")[1].split("/")[0], {"athletes": []})
            if "/teams?groups=80" in url:
                return {"sports": [{"leagues": [{"teams": [{"team": team} for team in (texas, ou, bama, uga)]}]}]}
            if "standings" in url:
                return {"children": [{"abbreviation": "SEC", "standings": {"entries": [
                    {"team": texas, "stats": [{"type": "total", "summary": "1-1"}, {"type": "vsconf", "summary": "0-1"}, {"name": "streak", "displayValue": "L1"}]}]}}]}
            raise AssertionError(url)
        with no_kv(), patch.object(cfb, "_get", side_effect=get):
            built = cfb.league(2026, day=date(2026, 9, 22))
            similar = cfb.similar("OU", "QB", "passing_yards", 2026)
        return built, similar

    def test_every_defense_is_ranked_by_what_it_allows_each_position(self):
        built, _ = self.build()
        self.assertTrue(built["complete"])
        self.assertEqual(built["teamCount"], 4)
        # Oklahoma faced Texas (300 pass yards) and Georgia (320): 310 a game, the most.
        self.assertEqual(built["dvp"]["OU"]["QB"]["stats"]["passing_yards"]["szn"], [310, 4])
        self.assertEqual(built["dvp"]["UGA"]["QB"]["stats"]["passing_yards"]["szn"], [175, 1], "Mateer 140 and Simpson 210 against Georgia")
        self.assertEqual(built["dvp"]["OU"]["WR"]["stats"]["receiving_yards"]["szn"][0], 75, "150 by Texas's receiver, none by Georgia's")
        self.assertEqual(built["dvp"]["OU"]["TE"]["stats"]["receiving_yards"]["szn"][0], 35, "Georgia's tight end, by his roster spot")
        self.assertEqual(built["teamStats"]["UGA"]["off"]["passing_yards"], [275, 1])
        self.assertEqual(built["teams"]["TEX"]["record"], "1-1")
        self.assertEqual(built["passRun"]["TEX"], {"passes": 65, "runs": 5})
        self.assertEqual(built["share"]["TEX"]["receptions"][0]["name"], "Ryan Wingo")
        self.assertEqual(built["standings"][0]["entries"][0]["record"], "1-1")

    def test_similar_players_against_a_defense_beside_their_own_averages(self):
        _, similar = self.build()
        rows = {entry["name"]: entry for entry in similar["similar"]}
        self.assertEqual(set(rows), {"Arch Manning", "Gunner Stockton"})
        self.assertEqual((rows["Arch Manning"]["value"], rows["Arch Manning"]["avg"], rows["Arch Manning"]["diff"]), (300, 200, 100))
        self.assertEqual(rows["Gunner Stockton"]["usage"], 32)


class MatchupTests(unittest.TestCase):
    def setUp(self):
        cfb._memory.clear()

    def test_a_games_page_gives_odds_win_chance_and_injuries(self):
        summary = {"header": {"competitions": [{"date": "2026-10-17T19:30Z", "neutralSite": True, "conferenceCompetition": True, "competitors": [
            {"homeAway": "home", "team": s.OKLAHOMA, "record": [{"type": "total", "summary": "5-1"}], "rank": 18},
            {"homeAway": "away", "team": s.TEXAS, "record": [{"type": "total", "summary": "4-2"}], "rank": 99}]}]},
            "pickcenter": [{"provider": {"name": "ESPN BET"}, "spread": -3.5, "overUnder": 51.5,
                            "homeTeamOdds": {"moneyLine": -160, "spreadOdds": -110}, "awayTeamOdds": {"moneyLine": 135, "spreadOdds": -110}}],
            "gameInfo": {"venue": {"fullName": "Cotton Bowl", "address": {"city": "Dallas", "state": "TX"}, "grass": True}},
            "injuries": [{"team": {"abbreviation": "TEX"}, "injuries": [{"athlete": {"id": "9", "displayName": "Some Receiver", "position": {"abbreviation": "WR"}},
                                                                        "status": "Out", "details": {"type": "Ankle"}}]}]}
        with no_kv(), patch.object(cfb, "_get", return_value=summary), patch.object(cfb, "_last_five", return_value=[]):
            game = cfb.matchup("401700001")
        self.assertEqual([team["abbr"] for team in game["teams"]], ["TEX", "OU"], "away first")
        self.assertEqual((game["teams"][1]["rank"], game["teams"][0]["rank"]), (18, None))
        self.assertEqual(game["odds"]["away"]["spread"], 3.5)
        self.assertEqual(game["chanceSource"], "odds")
        self.assertAlmostEqual(game["chance"]["home"] + game["chance"]["away"], 100, places=0)
        self.assertGreater(game["chance"]["home"], 55)
        self.assertEqual(game["injuries"]["TEX"][0]["injury"], "Ankle")
        self.assertEqual(game["venue"]["city"], "Dallas, TX")
