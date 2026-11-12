"""The NBA player page's scouting cards (backend/sports/wnba/scout.py) and
the api's scout resource: pure functions over a stored season."""
import importlib.util
import unittest
from pathlib import Path

from backend.sports.wnba import context, scout
from test_wnba_context import game, row

_spec = importlib.util.spec_from_file_location("wnba_api_scout", Path(__file__).resolve().parents[1] / "api" / "wnba.py")
wnba_api = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(wnba_api)

PLAYERS = {"star": ["Star", "G", None, "AAA"], "mate": ["Mate", "C", None, "AAA"],
           "b_g": ["B Guard", "G", None, "BBB"], "c_g": ["C Guard", "G", None, "CCC"],
           "b_c": ["B Center", "C", None, "BBB"], "c_c": ["C Center", "C", None, "CCC"]}


def payload():
    return {"season": 2026, "builtAt": "x", "teams": {}, "players": PLAYERS, "games": {g["id"]: g for g in (
        game("1", "2026-01-10T00:30Z", "AAA", "BBB", [row("star", 30, 20, 4, 6), row("mate", 25, 10, 9)], [row("b_g", 30, 5, 2, 3), row("b_c", 30, 8, 7)],
             {"AAA": [["star", 0, 3, 4], ["star", 5, 2, 6]], "BBB": [["b_g", 0, 1, 1], ["b_c", 1, 2, 3]]}),
        game("2", "2026-01-12T01:00Z", "CCC", "AAA", [row("c_g", 30, 25, 3, 7), row("c_c", 30, 12, 10)], [row("star", 32, 30, 5, 5)]),
        game("3", "2026-01-14T00:00Z", "BBB", "CCC", [row("b_g", 30, 9), row("b_c", 5, 2)], [row("c_g", 30, 15, 2, 8), row("c_c", 28, 6, 8)]),
    )}}


class DefenseTests(unittest.TestCase):
    def setUp(self):
        self.by_team = context.team_games(payload())

    def test_position_shooting_is_what_the_position_shot_against_them(self):
        table = scout.position_shooting(self.by_team, PLAYERS)
        # Every guard line here is 3-of-8 with one three in three tries.
        self.assertEqual(table["teams"]["AAA"]["G"]["fgPct"][0], 37.5)
        self.assertEqual(table["teams"]["AAA"]["G"]["tpPct"][0], 33.333)
        self.assertEqual(table["teams"]["AAA"]["G"]["efg"][0], 43.75)
        self.assertEqual(table["teams"]["AAA"]["G"]["ftr"][0], 0.25)
        self.assertEqual(table["league"]["G"]["fgPct"], 37.5)

    def test_team_defense_counts_paint_points_and_boards(self):
        table = scout.team_defense(self.by_team)
        # BBB scored 2 at the rim (1 made) and 4 in the paint (2 made) on AAA.
        self.assertEqual(table["teams"]["AAA"]["paintAllowed"][0], 6.0)
        # Assists given up a game: BBB's 3 in game 1, CCC's 7 in game 2.
        self.assertEqual(table["teams"]["AAA"]["astAllowed"][0], 5.0)
        self.assertIsNotNone(table["teams"]["AAA"]["drebPct"][0])

    def test_league_context_carries_them(self):
        ctx = context.league_context(payload())
        self.assertIn("G", ctx["positionShooting"]["teams"]["BBB"])
        self.assertIn("paintAllowed", ctx["teamDefense"]["teams"]["CCC"])


class FacedTests(unittest.TestCase):
    def setUp(self):
        self.by_team = context.team_games(payload())
        self.table = scout.season_table(self.by_team, PLAYERS)

    def test_game_day_is_the_us_day(self):
        self.assertEqual(scout.game_day("2026-01-12T01:00Z"), "2026-01-11")
        self.assertEqual(scout.game_day("2026-01-12"), "2026-01-12")
        self.assertIsNone(scout.game_day(None))

    def test_who_faced_them_newest_first_with_their_line(self):
        seen = []

        def lines(day, name):
            seen.append((day, name))
            return {"pts": 22.5} if name == "C Guard" else {}
        out = scout.faced(self.by_team, PLAYERS, self.table, "AAA", me="star", lines=lines)
        guards = out["positions"]["G"]
        # AAA's opponents' guards, newest game first; AAA's own players are never in it.
        self.assertEqual([item["name"] for item in guards], ["C Guard", "B Guard"])
        self.assertEqual(guards[0]["values"]["pts"], 25)
        self.assertEqual(guards[0]["lines"], {"pts": 22.5})
        self.assertEqual(guards[0]["day"], "2026-01-11")
        self.assertEqual(guards[0]["avg"]["pts"], 20.0)
        self.assertIn(("2026-01-11", "C Guard"), seen)
        self.assertEqual(out["games"], 2)

    def test_role_tags(self):
        guards = scout.faced(self.by_team, PLAYERS, self.table, "AAA", me="star")["positions"]["G"]
        tags = {item["name"]: item["tags"] for item in guards}
        # C Guard scores about what Star does; B Guard doesn't.
        self.assertEqual(tags, {"C Guard": ["similar"], "B Guard": []})
        # Leading a team needs five games: then CCC's scorer and playmaker is C Guard.
        many = payload()
        for number in range(4, 8):
            many["games"][str(number)] = {**many["games"]["2"], "id": str(number), "date": f"2026-01-2{number}T00:00Z"}
        table = scout.season_table(context.team_games(many), PLAYERS)
        self.assertTrue(table["c_g"].get("topScorer"))
        self.assertTrue(table["c_g"].get("handler"))
        self.assertFalse(table["c_c"].get("topScorer"))
        # A short stint isn't shown.
        self.assertNotIn("B Center", [item["name"] for item in scout.faced(self.by_team, PLAYERS, self.table, "CCC")["positions"]["C"]])

    def test_peer_ranks(self):
        ranks = scout.peer_ranks(self.table, "star")
        self.assertEqual(ranks["position"], "G")
        points = next(item for item in ranks["offense"] if item["key"] == "pts")
        self.assertEqual((points["value"], points["rank"]), (25.0, 1))
        self.assertEqual([item["label"] for item in ranks["defense"]], ["STL", "BLK", "STL+BLK", "DREB", "OREB", "PF"])
        self.assertIsNone(scout.peer_ranks(self.table, "nobody"))


class ApiTests(unittest.TestCase):
    def test_scout_reads_the_kept_lines_by_name(self):
        import line_archive
        original = line_archive.lines_on
        line_archive.lines_on = lambda sport, day, pipeline: {"cguard|points": 22.5, "cguard|ptsrebsasts": 30.5, "cguard|fantasyscore": 40.0}
        self.addCleanup(setattr, line_archive, "lines_on", original)
        out = wnba_api._scout(payload(), 2026, "star", "AAA", "nba")
        guard = out["faced"]["positions"]["G"][0]
        self.assertEqual(guard["lines"], {"pts": 22.5, "pra": 30.5})
        self.assertEqual(out["peers"]["position"], "G")
        self.assertEqual(out["me"]["pts"], 25.0)

    def test_wnba_has_no_kept_lines(self):
        self.assertIsNone(wnba_api._archived_lines("wnba"))


if __name__ == "__main__":
    unittest.main()


class LeagueContextTests(unittest.TestCase):
    """The start of a season: last season's games join the new one's, and a
    league table is never built from a handful of new games alone."""

    def call(self, current, previous):
        from unittest.mock import patch
        from backend.sports.wnba import league
        sent = []
        handler = wnba_api.handler.__new__(wnba_api.handler)
        with patch.object(wnba_api, "_send", lambda _self, status, body: sent.append((status, body))), \
                patch.object(league, "current_season", return_value=2027), \
                patch.object(league, "ensure", return_value=current), \
                patch.object(league, "stored", return_value=previous), \
                patch.object(wnba_api, "_team_rosters", return_value=({}, None)):
            wnba_api._league_memory.clear()
            handler._context("league-context", {}, "nba")
        return sent[0]

    def test_last_season_unreadable_is_not_ready(self):
        opening = {"season": 2027, "builtAt": "y", "teams": {}, "players": PLAYERS,
                   "games": {"1": payload()["games"]["1"]}}
        status, body = self.call(opening, None)
        self.assertEqual(status, 503)
        self.assertIn("prepared", body["error"])

    def test_last_season_joins_the_first_games(self):
        opening = {"season": 2027, "builtAt": "y", "teams": {}, "players": PLAYERS,
                   "games": {"9": {**payload()["games"]["1"], "id": "9", "date": "2026-10-21T00:00Z"}}}
        status, body = self.call(opening, payload())
        self.assertEqual(status, 200)
        self.assertEqual(sorted(body["dvp"]), ["AAA", "BBB", "CCC"])


class KeptAnswerTests(unittest.TestCase):
    """Research answers kept in KV a few minutes (api/wnba.py _kept_context)."""

    class Handler:
        def __init__(self, answer):
            import io
            self.answer, self.calls, self.wfile, self.status = answer, 0, io.BytesIO(), None
        def send_response(self, status):
            self.status = status
        def send_header(self, *args):
            pass
        def end_headers(self):
            pass
        def _context(self, resource, query, league):
            self.calls += 1
            return wnba_api._send(self, *self.answer)

    def test_a_good_answer_is_kept_and_sent_again_without_working_it_out(self):
        import json
        from unittest.mock import patch
        from v2.board import store
        kept = {}
        with patch.object(store, "get", side_effect=lambda key, **_: kept.get(key)), \
                patch.object(store, "set", side_effect=lambda key, value, ex=None: kept.__setitem__(key, value) or True):
            query = {"playerId": ["12"], "team": ["BOS"], "opponent": ["NY"], "market": ["player_points"]}
            first = self.Handler((200, {"ok": 1}))
            wnba_api._kept_context(first, "player-context", query, "nba")
            self.assertEqual((first.status, json.loads(first.wfile.getvalue()), first.calls), (200, {"ok": 1}, 1))
            second = self.Handler((200, {"ok": 2}))
            wnba_api._kept_context(second, "player-context", dict(reversed(list(query.items()))), "nba")
            # The same question in any order: the kept answer, not worked out again.
            self.assertEqual((json.loads(second.wfile.getvalue()), second.calls), ({"ok": 1}, 0))
            # A failure is sent but never kept; another league or player is its own question.
            failed = self.Handler((503, {"error": "x"}))
            wnba_api._kept_context(failed, "dvp", query, "nba")
            self.assertEqual(failed.status, 503)
            self.assertEqual(len(kept), 1)
            self.assertNotEqual(wnba_api.answer_key("player-context", query, "nba"), wnba_api.answer_key("player-context", query, "wnba"))
