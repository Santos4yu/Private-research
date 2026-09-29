"""The Finder's NHL lines and research (nhl_board.py, nhl_research.py)."""
import json
import sys
import time
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import nhl_board  # noqa: E402
import nhl_research as nhl  # noqa: E402
from tests import nhl_samples as s  # noqa: E402

DAY = date(2026, 9, 29)


def reset():
    nhl._memory.clear()
    nhl._blocked.update(web=0.0, stats=0.0)


def no_kv():
    """KV left out: nothing stored, nothing found."""
    return patch.multiple(nhl.store, get=MagicMock(return_value=None), set=MagicMock())


class GameIdTests(unittest.TestCase):
    def test_season_and_kind_from_the_id(self):
        self.assertEqual((nhl.season_of("2025020500"), nhl.kind_of("2025020500")), ("20252026", "regular"))
        self.assertEqual((nhl.kind_of("2026010030"), nhl.kind_of("2025030111")), ("preseason", "postseason"))
        self.assertEqual(nhl.season_id(DAY), "20262027")


class ResultTests(unittest.TestCase):
    def test_shootouts_and_overtime(self):
        row = lambda gf, ga, **result: s.team_row("1", "CAR", "FLA", True, "2026-01-10", gf, ga, **result)
        # The stats service leaves the shootout goal out: 3-3 is a 4-3 win...
        self.assertEqual(nhl._result(row(3, 3, wins=1, winsInShootout=1)), ("W", "4-3 SO", "SO"))
        # ...or a 3-4 loss.
        self.assertEqual(nhl._result(row(3, 3, otLosses=1)), ("L", "3-4 SO", "SO"))
        self.assertEqual(nhl._result(row(1, 2, otLosses=1)), ("L", "1-2 OT", "OT"))
        self.assertEqual(nhl._result(row(2, 1, wins=1, regulationAndOtWins=1)), ("W", "2-1 OT", "OT"))
        self.assertEqual(nhl._result(row(5, 2, wins=1, winsInRegulation=1, regulationAndOtWins=1)), ("W", "5-2", ""))


class LineTests(unittest.TestCase):
    def test_skater_line(self):
        rows = s.season_rows()
        line = nhl._skater(rows["skater/summary"][0], rows["skater/realtime"][0], rows["skater/faceoffwins"][0])
        self.assertEqual((line["goals"], line["sog"], line["ppp"], line["hits"], line["blocked"], line["attempts"]), (3, 5, 1, 4, 1, 9))
        self.assertEqual((line["fow"], line["fol"], line["faceoffs"], line["hits_blocks"], line["toi"]), (12, 8, 20, 5, 17.38))
        # Three goals (24), five shots (7.5), a block (1.5) and the hat trick (3).
        self.assertEqual(line["fantasy"], 36.0)

    def test_shorthanded_point_and_no_faceoffs(self):
        rows = s.season_rows()
        aho = nhl._skater(rows["skater/summary"][1], rows["skater/realtime"][1], rows["skater/faceoffwins"][1])
        # Two assists (10), two shots (3) and the shorthanded point (2).
        self.assertEqual(aho["fantasy"], 15.0)
        slavin = nhl._skater(rows["skater/summary"][2], rows["skater/realtime"][2], None)
        self.assertEqual((slavin["fow"], slavin["faceoffs"]), (0, 0))

    def test_goalie_line(self):
        andersen = nhl._goalie(s.season_rows()["goalie/summary"][0])
        self.assertEqual((andersen["saves"], andersen["shots_against"], andersen["ga"], andersen["toi"]), (27, 30, 3, 65.0))
        self.assertEqual((andersen["win"], andersen["decision"], andersen["starter"]), (1, "W", True))
        # 6 for the win, 27 saves at 0.6, three goals allowed at -3.
        self.assertEqual(andersen["fantasy"], round(6 + 27 * 0.6 - 9, 2))


class BoxScoreTests(unittest.TestCase):
    def test_preseason_box_score(self):
        record = nhl.parse_box(s.box())
        self.assertEqual((record["home"], record["away"], record["date"], record["final"]), ("CAR", "FLA", "2026-09-22", True))
        staal = record["lines"][str(s.STAAL)]["line"]
        self.assertEqual((staal["goals"], staal["sog"], staal["hits"], staal["blocked"], staal["toi"]), (1, 3, 4, 1, 17.38))
        self.assertEqual(staal["hits_blocks"], 5)
        # The box score has no faceoff counts, shot attempts or shorthanded
        # points (so no fantasy score).
        self.assertNotIn("fow", staal)
        self.assertNotIn("fantasy", staal)
        # The backup who never went in is not a line.
        self.assertNotIn("8480000", record["lines"])
        andersen = record["lines"][str(s.ANDERSEN)]["line"]
        self.assertEqual((andersen["saves"], andersen["ga"], andersen["win"]), (23, 2, 1))


class FeedTests(unittest.TestCase):
    def setUp(self):
        reset()

    def test_a_refusal_stops_asking_for_the_wait_it_names(self):
        busy = MagicMock(status_code=429, headers={"Retry-After": "45"})
        with patch.object(nhl.requests, "get", return_value=busy) as get:
            with self.assertRaises(nhl.Busy):
                nhl._web("/schedule/2026-09-29")
            with self.assertRaises(nhl.Busy):
                nhl._web("/roster/CAR/current")
        self.assertEqual(get.call_count, 1)
        self.assertAlmostEqual(nhl._blocked["web"], time.time() + 45, delta=2)

    def test_an_older_copy_stands_in_while_the_feed_is_busy(self):
        stored = json.dumps({"at": time.time() - 3600, "value": {"CAR": {}}})
        with patch.multiple(nhl.store, get=MagicMock(return_value=stored), set=MagicMock()):
            value = nhl._cached("k", 60, MagicMock(side_effect=nhl.Busy("x")), stale=24 * 3600)
        self.assertEqual(value, {"CAR": {}})
        with no_kv(), self.assertRaises(nhl.Busy):
            nhl._memory.clear()
            nhl._cached("k2", 60, MagicMock(side_effect=nhl.Busy("x")), stale=24 * 3600)


def feed(schedule=None, boxes=None):
    """The game feed: a club schedule, box scores and nothing else."""
    def web(path, timeout=12):
        if time.time() < nhl._blocked["web"]:
            raise nhl.Busy(path)
        if path.startswith("/club-schedule-season/"):
            return schedule or {"games": []}
        if path.startswith("/gamecenter/"):
            return (boxes or {})[path.split("/")[2]]
        raise nhl.Busy(path)
    return web


class TeamLogTests(unittest.TestCase):
    def setUp(self):
        reset()

    def test_season_games_and_preseason_box_scores(self):
        schedule = s.club_schedule(("2026010030", 1, "2026-09-22", "OFF"), ("2026010099", 1, "2026-10-01", "FUT"))
        with patch.object(nhl, "_stats", s.fake_stats()), patch.object(nhl, "_web", feed(schedule, {"2026010030": s.box()})), no_kv():
            log = nhl.team_log("CAR", "FLA", day=DAY)
        self.assertEqual([game["gameId"] for game in log["games"]], [s.SO_GAME, s.OT_GAME, "2026010030"])
        self.assertTrue(log["complete"])
        so, ot, pre = log["games"]
        self.assertEqual((so["score"], so["result"], so["isHome"], so["seasonKind"], so["season"]), ("4-3 SO", "W", True, "regular", "20252026"))
        self.assertEqual((ot["score"], ot["result"], ot["isHome"], ot["opponent"]), ("1-2 OT", "L", False, "FLA"))
        self.assertEqual((pre["score"], pre["seasonKind"], pre["season"]), ("3-2", "preseason", "20262027"))
        # Only CAR's players, with every stat.
        self.assertEqual(set(so["players"]), {str(s.STAAL), str(s.AHO), str(s.SLAVIN), str(s.ANDERSEN)})
        self.assertEqual(so["players"][str(s.STAAL)]["fow"], 12)
        self.assertEqual(pre["players"][str(s.STAAL)]["goals"], 1)
        self.assertEqual((so["totals"]["goals"], so["totals"]["sog"], so["totals"]["hits"], so["against"]["goals"]), (3, 35, 6, 3))
        staal = log["players"][str(s.STAAL)]
        self.assertEqual((staal["name"], staal["pos"]), ("Jordan Staal", "C"))
        # Without the roster, the NHL's photo from his latest season with the team.
        self.assertTrue(staal["headshot"].endswith(f"/20252026/CAR/{s.STAAL}.png"))

    def test_busy_feed_leaves_the_preseason_for_later(self):
        schedule = s.club_schedule(*[(f"20260100{n:02d}", 1, "2026-09-22", "OFF") for n in range(10)])
        boxes = {f"20260100{n:02d}": s.box(game_id=f"20260100{n:02d}") for n in range(10)}
        with patch.object(nhl, "_stats", s.fake_stats()), patch.object(nhl, "_web", feed(schedule, boxes)), no_kv():
            first = nhl.team_log("CAR", day=DAY)
            # A few box scores a look; the rest on the next.
            self.assertEqual((len(first["games"]), first["complete"]), (2 + nhl.PRESEASON_PER_CALL, False))
            second = nhl.team_log("CAR", day=DAY)
        self.assertEqual((len(second["games"]), second["complete"]), (12, True))

    def test_regular_season_stands_when_the_feed_refuses(self):
        with patch.object(nhl, "_stats", s.fake_stats()), patch.object(nhl, "_web", feed()), no_kv():
            nhl._blocked["web"] = time.time() + 60
            log = nhl.team_log("CAR", day=DAY)
        self.assertEqual((len(log["games"]), log["complete"]), (2, False))

    def test_reads(self):
        stats = s.fake_stats()
        with patch.object(nhl, "_stats", stats), patch.object(nhl, "_web", feed()), no_kv():
            nhl.team_log("CAR", day=DAY)
            nhl.team_log("CAR", "FLA", day=DAY)
            # Nothing kept yet: both seasons in one set of five requests.
            self.assertEqual({cayenne for _report, cayenne, _game in stats.calls}, {'teamAbbrev="CAR" and seasonId>=20252026'})
            self.assertEqual(len(stats.calls), 5)
            # Half an hour on, only this season is asked for again.
            key = f"nhl:teamrows:{nhl.VERSION}:CAR:20262027"
            nhl._memory[key] = (time.time() - 31 * 60, nhl._memory[key][1])
            log = nhl.team_log("CAR", day=DAY)
            # No game played since: one request, the kept copy stands.
            self.assertEqual(stats.calls[5:], [("team/summary", 'teamAbbrev="CAR" and seasonId=20262027', True)])
            self.assertEqual(len(log["games"]), 2)
            # A new game: the season is read again.
            rows = s.season_rows()
            rows["team/summary"].append(s.team_row("2026020010", "CAR", "NJD", True, "2026-10-09", 4, 1, wins=1, winsInRegulation=1))
            rows["skater/summary"].append(s.summary_row("2026020010", s.STAAL, "Jordan Staal", "CAR", "NJD", "C", "2026-10-09", goals=1, points=1))
            newer = s.fake_stats(rows)
            with patch.object(nhl, "_stats", newer):
                nhl._memory[key] = (time.time() - 31 * 60, nhl._memory[key][1])
                log = nhl.team_log("CAR", day=DAY)
        self.assertEqual(len(newer.calls), 6)
        self.assertEqual([game["score"] for game in log["games"]], ["4-3 SO", "1-2 OT", "4-1"])


class DepthTests(unittest.TestCase):
    def setUp(self):
        reset()

    def test_lines_by_ice_time_and_defense_by_shooting_side(self):
        current = {str(pid): {"name": name, "pos": pos, "number": 1, "headshot": f"https://x/{pid}.png", "shoots": shoots}
                   for pid, name, pos, shoots in ((s.STAAL, "Jordan Staal", "C", "L"), (s.AHO, "Sebastian Aho", "C", "L"),
                                                  (s.SLAVIN, "Jaccob Slavin", "D", "L"), (s.ANDERSEN, "Frederik Andersen", "G", "L"))}
        with patch.object(nhl, "_stats", s.fake_stats()), patch.object(nhl, "_web", feed()), \
                patch.object(nhl, "roster", return_value=current), no_kv():
            rows = {row["slot"]: [player["name"] for player in row["players"]] for row in nhl.depth("CAR", DAY)}
        # Aho averaged 19:35, Staal 17:02.
        self.assertEqual(rows["C"], ["Sebastian Aho", "Jordan Staal"])
        self.assertEqual((rows["LD"], rows["RD"], rows["G"]), (["Jaccob Slavin"], [], ["Frederik Andersen"]))


    def test_extra_centers_fill_the_open_wings(self):
        game = {"gameId": "1", "date": "2026-09-25", "players": {str(pid): {"toi": 20 - pid} for pid in range(1, 8)}}
        info = {str(pid): {"name": f"C{pid}", "pos": "C", "shoots": "R" if pid == 6 else "L", "season": "20262027"} for pid in range(1, 8)}
        built = {"games": [game], "players": info, "complete": True}
        with patch.object(nhl, "team_games", return_value=built), patch.object(nhl, "roster", side_effect=nhl.Busy("web")):
            rows = {row["slot"]: [player["name"] for player in row["players"]] for row in nhl.depth("CAR", DAY)}
        # The four with the most ice time stay at center; the right-handed
        # one goes to right wing, the others to left.
        self.assertEqual((rows["C"], rows["LW"], rows["RW"]), (["C1", "C2", "C3", "C4"], ["C5", "C7"], ["C6"]))


class BusyTests(unittest.TestCase):
    def setUp(self):
        reset()

    def test_zipped_copies_come_back(self):
        saved = {}
        with patch.multiple(nhl.store, get=MagicMock(side_effect=lambda key: saved.get(key)),
                            set=MagicMock(side_effect=lambda key, value, ex=None: saved.__setitem__(key, value))):
            nhl._cached("big", 60, lambda: {"games": [1, 2, 3]}, packed=True)
            self.assertIn('"z"', saved["big"])
            nhl._memory.clear()
            self.assertEqual(nhl._cached("big", 60, MagicMock(side_effect=AssertionError)), {"games": [1, 2, 3]})

    def test_a_refusing_stats_service_is_left_alone(self):
        busy = MagicMock(status_code=429, headers={})
        with patch.object(nhl.requests, "get", return_value=busy) as get:
            for _ in range(3):
                with self.assertRaises(nhl.Busy):
                    nhl._stats("skater/summary", 'teamAbbrev="CAR" and seasonId=20262027')
        self.assertEqual(get.call_count, 1)

    def test_older_copies_while_the_stats_service_refuses(self):
        refused = MagicMock(side_effect=nhl.Busy("stats"))
        with patch.object(nhl, "_stats", s.fake_stats()), patch.object(nhl, "_web", feed()), no_kv():
            nhl.team_log("CAR", day=DAY)
        for key in [key for key in nhl._memory if key.startswith("nhl:teamrows:")]:
            nhl._memory[key] = (time.time() - 3600, nhl._memory[key][1])
        with patch.object(nhl, "_stats", refused), patch.object(nhl, "_web", feed()), no_kv():
            log = nhl.team_log("CAR", day=DAY)
        self.assertEqual((len(log["games"]), log["complete"]), (2, True))

    def test_last_season_alone_while_this_seasons_read_is_refused(self):
        with patch.object(nhl, "_stats", s.fake_stats()), no_kv():
            last = nhl._fetch_rows("CAR", 'teamAbbrev="CAR" and seasonId=20252026')["20252026"]
        nhl._put(f"nhl:teamrows:{nhl.VERSION}:CAR:20252026", last, 3600, durable=False)
        with patch.object(nhl, "_stats", MagicMock(side_effect=nhl.Busy("stats"))), patch.object(nhl, "_web", feed()), no_kv():
            log = nhl.team_log("CAR", day=DAY)
            self.assertEqual((len(log["games"]), log["complete"]), (2, False))
            nhl._memory.clear()
            with self.assertRaises(nhl.Busy):
                nhl.team_log("CAR", day=DAY)


class LeagueTests(unittest.TestCase):
    def setUp(self):
        reset()

    def test_ranks_and_defense_by_position(self):
        stats = s.fake_stats()
        with patch.object(nhl, "_stats", stats), no_kv():
            data = nhl.league(DAY)
        self.assertEqual(data["teamCount"], 2)
        car, fla = data["teams"]["CAR"], data["teams"]["FLA"]
        # CAR's skaters: 5 + 2 + 1 and 3 + 4 shots on goal; FLA's 4 + 1 and 5 + 2.
        self.assertEqual(car["off"]["sog"]["l5"], [7.5, 1])
        self.assertEqual(fla["off"]["sog"]["l5"], [6, 2])
        # Defense: 1 allows the fewest.
        self.assertEqual((car["def"]["sog"]["l5"], fla["def"]["sog"]["l5"]), ([6, 1], [7.5, 2]))
        # What FLA allowed to centers: Staal's four goals over the two games.
        self.assertEqual(data["dvp"]["FLA"]["C"]["goals"]["l5"][0], 2)
        self.assertEqual(data["dvp"]["FLA"]["G"]["saves"]["l5"][0], 29)
        # The players' reports are read from the earliest game any team's window needs.
        self.assertIn(("skater/summary", 'gameDate>="2026-01-10"', True), stats.calls)

    def test_similar_players(self):
        with patch.object(nhl, "_stats", s.fake_stats()), no_kv():
            data = nhl.similar("FLA", "C", "sog", DAY)
        self.assertEqual([(entry["name"], entry["value"]) for entry in data["entries"]],
                         [("Sebastian Aho", 4), ("Jordan Staal", 3), ("Jordan Staal", 5), ("Sebastian Aho", 2)])
        self.assertEqual((data["entries"][0]["avg"], data["entries"][0]["diff"]), (3, 1))


class MatchupTests(unittest.TestCase):
    def setUp(self):
        reset()

    def test_from_the_lines_teams_with_records_from_the_stats_service(self):
        standings = [{"teamFullName": "Carolina Hurricanes", "wins": 50, "losses": 25, "otLosses": 7, "points": 107, "gamesPlayed": 82},
                     {"teamFullName": "Florida Panthers", "wins": 45, "losses": 30, "otLosses": 7, "points": 97, "gamesPlayed": 82}]
        stats = s.fake_stats({**s.season_rows(), "team/summary": s.season_rows()["team/summary"]})

        def run(report, cayenne, game=True):
            # Before the new season: last season's records.
            if not game:
                return standings if "20252026" in cayenne else []
            return stats(report, cayenne, game)
        with patch.object(nhl, "_stats", run), patch.object(nhl, "_web", feed()), patch.object(nhl, "_odds", return_value=None), no_kv():
            data = nhl.matchup("2026010060", "CAR", "FLA", "2026-09-30T23:00:00Z")
        self.assertEqual((data["game"]["kind"], data["game"]["divisional"]), ("preseason", False))
        self.assertEqual([(team["abbr"], team["side"], team["record"]) for team in data["teams"]],
                         [("FLA", "away", "45-30-7"), ("CAR", "home", "50-25-7")])
        self.assertEqual([game["score"] for game in data["lastFive"]["CAR"]], ["4-3 SO", "1-2 OT"])
        self.assertEqual([group["name"] for group in data["standings"]], ["Atlantic", "Metropolitan"])


class OddsTests(unittest.TestCase):
    def test_close_numbers(self):
        line = {"provider": {"name": "ESPN BET"}, "moneyline": {"home": {"close": {"odds": "-130"}}, "away": {"close": {"odds": "+110"}}},
                "pointSpread": {"home": {"close": {"line": "-1.5", "odds": "+190"}}, "away": {"close": {"line": "+1.5", "odds": "-230"}}},
                "total": {"over": {"close": {"line": "o6.5", "odds": "+105"}}, "under": {"close": {"line": "u6.5", "odds": "-125"}}}}
        odds = nhl.parse_odds(line)
        self.assertEqual((odds["home"]["moneyline"], odds["away"]["moneyline"], odds["home"]["spread"], odds["away"]["spread"]), (-130, 110, -1.5, 1.5))
        self.assertEqual((odds["total"], odds["overOdds"], odds["underOdds"]), (6.5, 105, -125))
        self.assertEqual(odds["noVig"], {"away": 45.7, "home": 54.3})


class BoardTests(unittest.TestCase):
    def setUp(self):
        reset()

    def games(self):
        return [{"id": "2026010060", "gameType": 1, "date": "2026-09-30", "start": "2026-09-30T23:00:00Z",
                 "home": "CAR", "away": "FLA", "state": "FUT"}]

    def rosters(self):
        players = {str(pid): {"name": f"{first} {last}", "pos": pos, "number": 11, "headshot": f"https://x/{pid}.png"}
                   for pid, first, last, pos in ((s.STAAL, "Jordan", "Staal", "C"), (s.AHO, "Sebastian", "Aho", "C"))}
        return {"CAR": players, "FLA": {}}

    def test_lines_find_their_game_and_player(self):
        lines = [s.projection("1", "Jordan Staal", "Shots On Goal", 2.5), s.projection("2", "Seb Aho", "Points", 0.5),
                 s.projection("3", "Someone New", "Hits", 1.5)]
        board = nhl_board.build(projections=lines, now=1_790_000_000, games=self.games(), rosters=self.rosters())
        rows = {row["player"]: row for row in board["rows"]}
        staal = rows["Jordan Staal"]
        self.assertEqual((staal["playerId"], staal["gameId"], staal["valueKey"], staal["isHome"]), (str(s.STAAL), "2026010060", "sog", True))
        self.assertEqual((staal["team"], staal["opponent"], staal["headshot"]), ("CAR", "FLA", f"https://x/{s.STAAL}.png"))
        # First initial and last name on the same team.
        self.assertEqual(rows["Seb Aho"]["playerId"], str(s.AHO))
        self.assertIsNone(rows["Someone New"]["playerId"])

    def test_two_players_with_one_name(self):
        rosters = {"CAR": {"1": {"name": "Sebastian Aho"}}, "NYI": {"2": {"name": "Sebastian Aho"}}, "BOS": {}}
        self.assertEqual(nhl.match_player("Sebastian Aho", "NYI", rosters), ("2", "NYI"))
        # Traded since: the one player anywhere with the name.
        self.assertEqual(nhl.match_player("Jordan Staal", "BOS", {"CAR": {"7": {"name": "Jordan Staal"}}}), ("7", "CAR"))
        # Two elsewhere is no match.
        self.assertIsNone(nhl.match_player("Sebastian Aho", "BOS", rosters))

    def test_players_from_the_stats_service_and_rosters_for_new_names(self):
        directory = {str(s.STAAL): {"name": "Jordan Staal", "team": "CAR", "pos": "C", "shoots": "L", "season": "20252026"}}
        roster = {"9999": {"name": "Rookie Newman", "pos": "C", "number": 91, "headshot": "https://x/9999.png", "shoots": "L"}}
        lines = [s.projection("1", "Jordan Staal", "Goals", 0.5), s.projection("2", "Rookie Newman", "Goals", 0.5),
                 s.projection("3", "Aleksander Barkov", "Goals", 0.5, team="FLA", opponent="CAR")]
        with patch.object(nhl, "directory", return_value=directory), \
                patch.object(nhl, "roster", side_effect=lambda team: roster if team == "CAR" else {}) as rosters:
            board = nhl_board.build(projections=lines, now=1_790_000_000, games=self.games())
        rows = {row["player"]: row for row in board["rows"]}
        self.assertEqual((rows["Jordan Staal"]["playerId"], rows["Rookie Newman"]["playerId"]), (str(s.STAAL), "9999"))
        self.assertTrue(rows["Jordan Staal"]["headshot"].endswith(f"/20252026/CAR/{s.STAAL}.png"))
        # Rosters only for the teams with a name the stats service lacks.
        self.assertEqual(sorted(call.args[0] for call in rosters.call_args_list), ["CAR", "FLA"])

    def test_prizepicks_team_codes(self):
        lines = [s.projection("1", "Jordan Staal", "Goals", 0.5, team="CAR", opponent="TB")]
        games = [{"id": "9", "gameType": 2, "date": "2026-10-08", "start": "2026-09-30T23:30:00Z", "home": "TBL", "away": "CAR", "state": "FUT"}]
        row = nhl_board.build(projections=lines, now=1_790_000_000, games=games, rosters=self.rosters())["rows"][0]
        self.assertEqual((row["opponent"], row["gameId"], row["isHome"]), ("TBL", "9", False))

    def test_market_names(self):
        for stat, key in (("Shots On Goal", "sog"), ("Blocked Shots", "blocked"), ("Time On Ice", "toi"),
                          ("Faceoffs Won", "fow"), ("Power Play Points", "ppp"), ("Goalie Saves", "saves"),
                          ("Goals Allowed", "ga"), ("Fantasy Score", "fantasy"), ("Plus/Minus", "plus_minus"),
                          ("Hits", "hits"), ("Points", "points"), ("Assists", "assists"), ("Goals", "goals"),
                          ("Shots Blocked", "blocked"), ("Goalie Fantasy Score", "fantasy")):
            self.assertEqual(nhl_board.value_key(stat), key, stat)
        self.assertIsNone(nhl_board.value_key("Something New"))


if __name__ == "__main__":
    unittest.main()
