"""WNBA matchup research: pure functions only -- no network, no KV."""
import importlib.util
import unittest
from pathlib import Path

from backend.sports.wnba import context, league, matchup

_spec = importlib.util.spec_from_file_location("wnba_api", Path(__file__).resolve().parents[1] / "api" / "wnba.py")
wnba_api = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(wnba_api)


def line(minutes, pts, reb=0, ast=0, starter=True, dnp=False, pid="p", name="Player", pos="G", team="AAA"):
    """One athlete entry as ESPN's box score gives it."""
    stats = [str(minutes), str(pts), "4-9", "1-3", "2-2", str(reb), str(ast), "1", "1", "0", "1", str(reb), "2", "+3"]
    return {"athlete": {"id": pid, "displayName": name, "position": {"abbreviation": pos},
                        "headshot": {"href": f"https://img/{pid}.png"}},
            "starter": starter, "didNotPlay": dnp, "stats": [] if dnp else stats}


KEYS = ["minutes", "points", "fieldGoalsMade-fieldGoalsAttempted", "threePointFieldGoalsMade-threePointFieldGoalsAttempted",
        "freeThrowsMade-freeThrowsAttempted", "rebounds", "assists", "turnovers", "steals", "blocks",
        "offensiveRebounds", "defensiveRebounds", "fouls", "plusMinus"]


def summary(home_entries, away_entries, plays=()):
    return {"boxscore": {"players": [
        {"team": {"id": "1", "abbreviation": "AAA"}, "statistics": [{"keys": KEYS, "athletes": home_entries}]},
        {"team": {"id": "2", "abbreviation": "BBB"}, "statistics": [{"keys": KEYS, "athletes": away_entries}]},
    ]}, "plays": list(plays)}


def shot(pid, team_id, x, y, points, made):
    return {"shootingPlay": True, "pointsAttempted": points, "scoringPlay": made,
            "participants": [{"athlete": {"id": pid}}], "team": {"id": team_id}, "coordinate": {"x": x, "y": y}}


class ZoneTests(unittest.TestCase):
    def test_zones(self):
        self.assertEqual(league.zone_of(25, 2, 2), "ra")
        self.assertEqual(league.zone_of(25, 10, 2), "paint")
        self.assertEqual(league.zone_of(40, 15, 2), "mid")
        self.assertEqual(league.zone_of(2, 3, 3), "c3l")
        self.assertEqual(league.zone_of(48, 1, 3), "c3r")
        self.assertEqual(league.zone_of(25, 25, 3), "ab3")
        # A wing three is above the break even near a sideline.
        self.assertEqual(league.zone_of(4, 14, 3), "ab3")


class ExtractTests(unittest.TestCase):
    def test_box_and_shots(self):
        players = {}
        data = summary(
            [line(30, 20, 5, 4, pid="a1"), line(0, 0, pid="a2", starter=False), line(0, 0, pid="a3", dnp=True)],
            [line(28, 11, pid="b1", pos="F")],
            [shot("a1", "1", 25, 2, 2, True), shot("a1", "1", 25, 25, 3, False), shot("b1", "2", 25, 10, 2, True),
             # Free throws and unlocated shots carry sentinel coordinates.
             shot("a1", "1", -214748340, -214748340, 2, True), {"shootingPlay": True, "pointsAttempted": 1}],
        )
        game = league.extract_game(data, {"id": "g1", "date": "2026-06-01T00:00Z", "type": 2, "home": "AAA", "away": "BBB"}, players)
        home = game["t"]["AAA"]
        self.assertEqual([row[0] for row in home["p"]], ["a1"])
        self.assertEqual(sorted(home["dnp"]), ["a2", "a3"])  # zero minutes counts as not playing
        row = home["p"][0]
        self.assertEqual(row[2:6], [30, 20, 5, 4])  # min, pts, reb, ast as whole numbers
        zones = {(pid, league.ZONES[z]): (m, a) for pid, z, m, a in home["z"]}
        self.assertEqual(zones, {("a1", "ra"): (1, 1), ("a1", "ab3"): (0, 1)})
        self.assertEqual(players["b1"][1], "F")
        self.assertEqual(players["a1"][3], "AAA")


def game(gid, date, home, away, home_rows, away_rows, zones=None):
    zones = zones or {}
    return {"id": gid, "date": date, "type": 2, "home": home, "away": away,
            "t": {home: {"p": home_rows, "dnp": [], "z": zones.get(home, [])},
                  away: {"p": away_rows, "dnp": [], "z": zones.get(away, [])}}}


def row(pid, minutes, pts, reb=0, ast=0, starter=1):
    values = {"min": minutes, "pts": pts, "reb": reb, "ast": ast, "fgm": 3, "fga": 8, "tpm": 1, "tpa": 3,
              "ftm": 1, "fta": 2, "stl": 1, "blk": 0, "to": 1, "pf": 2, "oreb": 0, "dreb": reb}
    return [pid, starter] + [values[field] for field in league.FIELDS]


class ContextTests(unittest.TestCase):
    def setUp(self):
        # AAA guard "star" plays BBB and CCC; BBB's guards score little on AAA.
        self.payload = {"season": 2026, "builtAt": "x", "teams": {}, "players": {
            "star": ["Star", "G", None, "AAA"], "mate": ["Mate", "C", None, "AAA"],
            "b_g": ["B Guard", "G", None, "BBB"], "c_g": ["C Guard", "G", None, "CCC"],
            "b_c": ["B Center", "C", None, "BBB"], "c_c": ["C Center", "C", None, "CCC"]},
            "games": {g["id"]: g for g in (
                game("1", "2026-06-01", "AAA", "BBB", [row("star", 30, 20), row("mate", 25, 10)], [row("b_g", 30, 5), row("b_c", 30, 8)],
                     {"AAA": [["star", 0, 3, 4], ["star", 5, 2, 6]], "BBB": [["b_g", 5, 1, 5]]}),
                game("2", "2026-06-03", "CCC", "AAA", [row("c_g", 30, 25), row("c_c", 30, 12)], [row("star", 32, 30)]),
                game("3", "2026-06-05", "BBB", "CCC", [row("b_g", 30, 9), row("b_c", 5, 2)], [row("c_g", 30, 15), row("c_c", 28, 6)]),
            )}}

    def test_defense_vs_position_ranks_least_allowed_first(self):
        ctx = context.league_context(self.payload)
        guards = {team: ctx["dvp"][team]["G"]["stats"]["pts"]["szn"] for team in ("AAA", "BBB", "CCC")}
        # Guards' points a game: AAA allowed 5 and 25 (15.0), BBB 20 and 15
        # (17.5), CCC 30 and 9 (19.5). The least allowed ranks first.
        self.assertEqual(guards["AAA"], [15.0, 1])
        self.assertEqual(guards["BBB"], [17.5, 2])
        self.assertEqual(guards["CCC"][1], 3)

    def test_position_defense_counts_the_whole_game(self):
        ctx = context.league_context(self.payload)
        # BBB's center scored 2 in 5 minutes against CCC: they count, since CCC
        # allowed them. AAA brought no center against CCC: a zero that game.
        self.assertEqual(ctx["dvp"]["CCC"]["C"]["stats"]["pts"]["szn"][0], 1.0)
        self.assertEqual(ctx["dvp"]["CCC"]["C"]["n"]["szn"], 1)

    def test_position_defense_adds_up_every_player_at_the_spot(self):
        # A fourth game: AAA plays two guards against CCC, 8 and 12 points -- 20 to guards that game.
        payload = {**self.payload, "players": {**self.payload["players"], "a_g2": ["A Guard 2", "G", None, "AAA"]},
                   "games": {**self.payload["games"],
                             "4": game("4", "2026-06-07", "AAA", "CCC", [row("star", 20, 8), row("a_g2", 30, 12)], [row("c_g", 30, 10)])}}
        ctx = context.league_context(payload)
        self.assertEqual(ctx["dvp"]["CCC"]["G"]["stats"]["pts"]["szn"][0], round((30 + 9 + 20) / 3, 2))
        # Tied teams share a rank.
        self.assertEqual(context._rank({"A": 1.0, "B": 2.0, "C": 2.0, "D": 3.0}, ascending=True), {"A": 1, "B": 2, "C": 2, "D": 4})

    def test_team_offense_and_defense_ranks(self):
        stats = context.league_context(self.payload)["teamStats"]
        # Team points per game: AAA 30, BBB 12, CCC 29 -- most ranks first.
        self.assertEqual(stats["AAA"]["off"]["pts"], [30.0, 1])
        # Allowed per game: AAA 25, BBB 25.5, CCC 20.5 -- least ranks first.
        self.assertEqual(stats["CCC"]["def"]["pts"], [20.5, 1])
        self.assertEqual(stats["AAA"]["def"]["pts"], [25.0, 2])

    def test_rotation_starts_with_last_starters(self):
        rotation = context.league_context(self.payload)["rotation"]["AAA"]["players"]
        self.assertEqual(rotation[0]["id"], "star")
        self.assertTrue(all(player["headshot"] for player in rotation))  # ESPN fallback when missing

    def test_player_context(self):
        ctx = context.player_context(self.payload, "star", "AAA", "BBB", "player_points", 25.0)
        self.assertEqual(ctx["zones"]["ra"], [3, 4])
        self.assertEqual(ctx["zones"]["ab3"], [2, 6])
        mate = next(item for item in ctx["withWithout"] if item["id"] == "mate")
        self.assertEqual((mate["with"]["games"], mate["with"]["avg"]), (1, 20.0))
        self.assertEqual((mate["without"]["games"], mate["without"]["avg"], mate["without"]["hits"]), (1, 30.0, 1))
        self.assertEqual(mate["without"]["gameIds"], ["2"])
        # Similar guards vs BBB: CCC's guard (30 min) -- never the player herself.
        similar = ctx["similar"]["G"]
        self.assertEqual([entry["id"] for entry in similar], ["c_g"])
        self.assertEqual(similar[0]["value"], 15)
        self.assertEqual(similar[0]["avg"], 25.0)  # her average in her OTHER games

    def test_market_mapping_covers_the_board(self):
        # Every Odds API market, plus the ones only PrizePicks' feed posts.
        self.assertEqual(set(context.MARKET_STAT), set(wnba_api.PRIZEPICKS_LABELS))
        self.assertTrue(set(wnba_api.MARKETS) <= set(context.MARKET_STAT))


class TopUpTests(unittest.TestCase):
    def test_a_finished_but_unrecorded_game_is_due(self):
        from datetime import datetime, timedelta, timezone
        ago = lambda hours: (datetime.now(timezone.utc) - timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%MZ")
        payload = lambda game: {"games": {"old": {}}, "schedule": [game]}
        self.assertTrue(league._game_due(payload({"id": "g", "date": ago(3)})))
        self.assertFalse(league._game_due(payload({"id": "g", "date": ago(1)})))      # still being played
        self.assertFalse(league._game_due(payload({"id": "old", "date": ago(3)})))    # already recorded
        # A long-postponed game never makes every read re-check.
        self.assertFalse(league._game_due(payload({"id": "g", "date": ago(24 * 5)})))


class PreseasonTests(unittest.TestCase):
    def test_preseason_games_stay_out_of_hit_rates(self):
        from unittest.mock import patch
        logs = [{"opponent": "OPP", "seasonKind": "preseason", "values": {"player_points": 4}},
                {"opponent": "OPP", "seasonKind": "regular", "values": {"player_points": 20}}]
        rows = [{"playerId": "test-only", "marketKey": "player_points", "line": 15,
                 "teamAbbr": "TEAM", "homeTeamAbbr": "OPP", "awayTeamAbbr": "TEAM"}]
        with patch.object(wnba_api, "_game_logs", return_value={"rows": logs}):
            result = wnba_api._attach_history(rows, 2026)[0]
        # Starters' short preseason minutes would make every Under look safe:
        # only the regular-season game counts (the chart still shows both).
        self.assertEqual(result["windows"]["season"]["sample"], 1)
        self.assertEqual(result["windows"]["season"]["hitRate"], 100)
        self.assertEqual(result["windows"]["h2h"]["sample"], 1)
        self.assertEqual(result["average"], 20)


class GameLogTests(unittest.TestCase):
    def test_attempts_two_pointers_and_fouls(self):
        from unittest.mock import patch
        names = ["minutes", "fieldGoalsMade-fieldGoalsAttempted", "threePointFieldGoalsMade-threePointFieldGoalsAttempted",
                 "freeThrowsMade-freeThrowsAttempted", "totalRebounds", "assists", "blocks", "steals", "fouls", "turnovers", "points"]
        payload = {"names": names, "events": {"401": {"gameDate": "2026-08-01T23:00Z", "opponent": {"abbreviation": "LV"}, "atVs": "vs",
                                                     "gameResult": "W", "score": "90-80"}},
                   "seasonTypes": [{"displayName": "2026 Regular Season", "categories": [{"events": [
                       {"eventId": "401", "stats": ["32", "9-17", "3-7", "4-5", "6", "5", "1", "2", "3", "2", "25"]}]}]}]}
        with patch.object(wnba_api, "_espn_json", return_value=payload), patch.object(wnba_api.store, "get", return_value=None), \
                patch.object(wnba_api.store, "set"):
            values = wnba_api._game_logs("test-only-log", 2026)["rows"][0]["values"]
        self.assertEqual((values["player_field_goals_attempts"], values["player_frees_attempts"], values["player_fouls"]), (17, 5, 3))
        # Two-pointers: nine field goals, three of them threes.
        self.assertEqual((values["player_twos"], values["player_twos_attempts"]), (6, 10))
        # 25 points and 6 rebounds: one category in double figures.
        self.assertEqual(values["player_double_double"], 0)

    def test_offensive_and_defensive_rebounds_come_from_the_stored_box_scores(self):
        from unittest.mock import patch
        from backend.sports.wnba import league
        line = ["test-only-log", 1] + [None] * len(league.FIELDS)
        line[2 + league.FIELDS.index("oreb")], line[2 + league.FIELDS.index("dreb")] = 2, 7
        stored = {"games": {"401": {"id": "401", "t": {"LV": {"p": [line]}}}}}
        with patch.object(league, "stored", return_value=stored):
            self.assertEqual(wnba_api._rebound_split("test-only-log", 2026), {"401": (2, 7)})
        self.assertEqual(context.stat_value(["x", 1] + [12 if field in ("pts", "reb") else 3 for field in league.FIELDS], "dd"), 1)


class ScoreTests(unittest.TestCase):
    def test_scores_read_team_first(self):
        for flip in (wnba_api._own_score_first, matchup._own_score_first):
            self.assertEqual(flip("102-85", "L"), "85-102")
            self.assertEqual(flip("96-77", "W"), "96-77")
            self.assertEqual(flip("86-84 OT", "L"), "84-86 OT")
            self.assertIsNone(flip(None, "L"))


if __name__ == "__main__":
    unittest.main()
