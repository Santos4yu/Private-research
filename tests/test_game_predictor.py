"""game_predictor.py: the NBA and NFL game predictions and their record."""
import json
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from datetime import timedelta

import game_predictor as gp
from backend.sports.wnba.league import FIELDS

NOW = datetime(2026, 11, 5, 18, tzinfo=timezone.utc)


def line(pid, minutes, pts, reb=5, ast=3):
    """A box-score row: [id, starter, *FIELDS]."""
    values = dict.fromkeys(FIELDS, 0)
    values.update({"min": minutes, "pts": pts, "reb": reb, "ast": ast, "fgm": pts // 2, "fga": pts // 2 + 6, "fta": 4, "ftm": 3,
                   "oreb": 1, "dreb": reb - 1, "to": 2})
    return [pid, True, *[values[name] for name in FIELDS]]


def side(points, star=True, team="A"):
    rows = [line(f"{team}{n}", 24, points // 8) for n in range(1, 8)]
    if star:
        rows.append(line(f"{team}star", 36, points - sum(r[3] for r in rows)))
    else:
        rows.append(line(f"{team}8", 24, points - sum(r[3] for r in rows)))
    return {"p": rows}


def payload(games=6):
    """Two teams: BOS beats DEN every night, DEN's star (Dstar) plays them all."""
    out = {}
    for n in range(games):
        home = "BOS" if n % 2 == 0 else "DEN"
        out[str(n)] = {"id": str(n), "date": (datetime(2026, 10, 22, 23, 30, tzinfo=timezone.utc) + timedelta(days=2 * n)).strftime("%Y-%m-%dT%H:%M:%SZ"), "type": 2, "home": home,
                       "t": {"BOS": side(118, team="B"), "DEN": side(104, team="D")}}
    players = {f"{team}{n}": [f"{team} Player {n}", "G" if str(n) in "1234" else "F", None, "BOS" if team == "B" else "DEN"]
               for team in "BD" for n in list(range(1, 9)) + ["star"]}
    players["Dstar"] = ["Nikola Jokic", "C", None, "DEN"]
    return {"season": 2027, "games": out, "players": players, "builtAt": "x"}


def game(injuries=None, spread=-4.5, total=226.5, home_ml=-190, away_ml=160, home="DEN", away="BOS", state="pre"):
    return {"id": "401", "sport": "nba", "startsAt": "2026-11-06T00:30:00Z", "state": state, "neutral": False,
            "home": {"abbr": home, "short": home}, "away": {"abbr": away, "short": away},
            "line": {"spread": spread, "total": total, "moneyline": {"home": home_ml, "away": away_ml},
                     "chance": None} if spread is not None else None,
            "espn": {"home": 0.6, "away": 0.4}, "injuries": injuries or {}, "lastFive": {}}


class NbaTests(unittest.TestCase):
    def setUp(self):
        self.tables = gp.nba_tables(payload(), None)

    def test_ratings_and_regulars(self):
        bos, den = self.tables["teams"]["BOS"], self.tables["teams"]["DEN"]
        self.assertGreater(bos["ortg"], den["ortg"])
        self.assertLess(bos["drtg"], den["drtg"])
        star = den["players"]["Dstar"]
        self.assertEqual((star["games"], star["share"], star["regular"], star["pos"]), (6, 1.0, True, "C"))
        self.assertEqual(bos["lastGame"], "2026-11-01T23:30:00Z")

    def test_who_is_out_moves_the_margin(self):
        healthy = gp.nba_model(game(), self.tables)
        hurt = gp.nba_model(game({"DEN": [{"id": "Dstar", "name": "Nikola Jokic", "position": "C", "status": "Out"},
                                          {"id": "x", "name": "Someone", "position": "G", "status": "Day-To-Day"}]}), self.tables)
        star = self.tables["teams"]["DEN"]["players"]["Dstar"]
        self.assertAlmostEqual(healthy["margin"] - hurt["margin"], gp.MODELS["nba"]["injury"] * star["gmsc"], places=6)
        self.assertEqual([(p["name"], p["out"]) for p in hurt["out"]["home"]], [("Nikola Jokic", True), ("Someone", False)])
        self.assertGreater(hurt["out"]["home"][0]["impact"], 0)
        # Home court is in it, and gone on a neutral floor.
        neutral = gp.nba_model({**game(), "neutral": True}, self.tables)
        self.assertAlmostEqual(healthy["margin"] - neutral["margin"], gp.MODELS["nba"]["home"], places=6)

    def test_back_to_back(self):
        tonight = {**game(), "startsAt": "2026-11-02T23:30:00Z"}   # BOS and DEN both played Nov 1
        built = gp.nba_model(tonight, self.tables)
        self.assertEqual(built["rest"], {"home": 1, "away": 1})

    def test_the_best_matchup_skips_players_out(self):
        built = gp.nba_model(game({"DEN": [{"id": "Dstar", "name": "Nikola Jokic", "status": "Out"}]}), self.tables)
        players = gp.nba_players(game({"DEN": [{"id": "Dstar", "name": "Nikola Jokic", "status": "Out"}]}), self.tables, built)
        self.assertNotEqual(players["home"]["name"], "Nikola Jokic")
        self.assertEqual(set(players["home"]["proj"]), {"pts", "reb", "ast"})


class PredictionTests(unittest.TestCase):
    def test_line_and_model_combine(self):
        tables = gp.nba_tables(payload(), None)
        g = game()
        built = gp.nba_model(g, tables)
        found = gp.prediction("nba", g, built, now=NOW)
        expected = 0.75 * 4.5 + 0.25 * built["margin"]
        self.assertAlmostEqual(found["margin"], round(expected, 1))
        self.assertEqual(found["total"], 226.5)
        self.assertLessEqual(abs(found["score"]["home"] + found["score"]["away"] - 226.5), 1)
        self.assertEqual(found["winner"], "home" if expected > 0 else "away")
        self.assertAlmostEqual(found["chance"]["home"], round(gp.phi(expected / 12.5), 4))
        self.assertIn(found["confidence"], ("High", "Medium", "Low"))
        self.assertEqual(found["blowout"]["by"], 15)

    def test_edge_against_the_market(self):
        # Our model has DEN by 14 where the line says 4.5: the quarter of
        # ours moves DEN's chance up, laid on the moneyline's.
        built = {"margin": 14.0, "total": 230, "parts": [], "teams": None, "out": None, "rest": None}
        found = gp.prediction("nba", game(), built, now=NOW)
        market = gp.implied(-190) / (gp.implied(-190) + gp.implied(160))
        shift = gp.phi((0.75 * 4.5 + 0.25 * 14) / 12.5) - gp.phi(4.5 / 12.5)
        self.assertEqual((found["edge"]["side"], found["edge"]["price"]), ("home", -190))
        self.assertAlmostEqual(found["edge"]["points"], round(shift, 4))
        self.assertAlmostEqual(found["edge"]["chance"], round(market + shift, 4))
        # The line alone is no edge, even where its spread and its price
        # don't quite agree.
        alone = gp.prediction("nba", game(home_ml=170, away_ml=-200), None, now=NOW)
        self.assertIsNone(alone["edge"]["side"])

    def test_without_a_line(self):
        built = {"margin": -6.0, "total": 230.4, "parts": [], "teams": None, "out": None, "rest": None, "poss": 99, "leaguePace": 100}
        found = gp.prediction("nba", game(spread=None), built, now=NOW)
        self.assertEqual((found["margin"], found["total"], found["winner"]), (-6.0, 230.4, "away"))
        self.assertEqual(found["score"], {"home": 112, "away": 118})
        # ESPN's projection alone still names a winner.
        alone = gp.prediction("nba", game(spread=None), None, now=NOW)
        self.assertAlmostEqual(alone["chance"]["home"], 0.6, places=3)
        self.assertIsNone(alone["score"])

    def test_never_a_tied_score(self):
        self.assertEqual(gp.final_score(0.4, 220), (111, 110))
        self.assertEqual(gp.final_score(-0.4, 220), (110, 111))
        self.assertEqual(gp.final_score(16.2, 231.5), (124, 108))

    def test_odds(self):
        self.assertEqual((gp.american(0.6), gp.american(0.4)), (-150, 150))
        self.assertAlmostEqual(gp.implied(-150), 0.6)
        self.assertEqual(gp._price({"close": {"odds": "+135"}}), 135)
        self.assertEqual(gp._price({"open": {"odds": "EVEN"}}), 100)


class LineTests(unittest.TestCase):
    def test_scoreboard_odds(self):
        sides = {"home": {"abbr": "DEN"}, "away": {"abbr": "BOS"}}
        raw = {"provider": {"name": "DraftKings"}, "details": "DEN -4.5", "overUnder": 226.5, "spread": -4.5,
               "homeTeamOdds": {}, "awayTeamOdds": {}, "moneyline": {"home": {"close": {"odds": "-190"}}, "away": {"close": {"odds": "+160"}}}}
        found = gp._line(raw, sides)
        self.assertEqual((found["spread"], found["total"], found["moneyline"]), (-4.5, 226.5, {"home": -190, "away": 160}))
        self.assertAlmostEqual(found["chance"]["home"] + found["chance"]["away"], 1)
        # The away team favored: ESPN gives the favorite's number.
        flipped = gp._line({**raw, "details": "BOS -3", "spread": -3}, sides)
        self.assertEqual(flipped["spread"], 3)
        self.assertIsNone(gp._line(None, sides))


class NflTests(unittest.TestCase):
    def games(self):
        out = {}
        for n, (home, away, hs, as_) in enumerate([("KC", "BUF", 27, 20), ("BUF", "KC", 17, 24), ("KC", "BUF", 31, 10)]):
            out[f"g{n}"] = {"game_id": f"g{n}", "season": 2026, "home": home, "away": away, "home_score": hs, "away_score": as_,
                            "final": True, "kickoff": 1757000000 + n * 7 * 86400}
        out["old"] = {"game_id": "old", "season": 2025, "home": "BUF", "away": "KC", "home_score": 30, "away_score": 20,
                      "final": True, "kickoff": 1730000000}
        return out

    def test_quarterback_out(self):
        rows = [{"position": "QB", "season_type": "REG", "team": "KC", "player_id": "q1", "player_display_name": "Patrick Mahomes", "attempts": 35},
                {"position": "QB", "season_type": "REG", "team": "KC", "player_id": "q2", "player_display_name": "Backup", "attempts": 3}]
        tables = gp.nfl_tables(self.games(), 2026, rows)
        self.assertEqual(tables["qb"]["KC"]["name"], "Patrick Mahomes")
        self.assertEqual(tables["teams"]["KC"]["games"], 3)
        g = {"id": "1", "startsAt": "2025-09-25T17:00:00Z", "neutral": False, "home": {"abbr": "KC"}, "away": {"abbr": "BUF"}}
        healthy = gp.nfl_model({**g, "injuries": {}}, tables)
        hurt = gp.nfl_model({**g, "injuries": {"KC": [{"name": "Patrick Mahomes", "position": "QB", "status": "Out"}]}}, tables)
        self.assertAlmostEqual(healthy["margin"] - hurt["margin"], gp.MODELS["nfl"]["qb"])
        self.assertEqual(hurt["qbOut"]["home"], "Patrick Mahomes")
        self.assertEqual(hurt["out"]["home"][0]["impact"], gp.MODELS["nfl"]["qb"])
        # The line carries nine tenths of the final number.
        found = gp.prediction("nfl", {**g, "state": "pre", "line": {"spread": -3, "total": 47.5, "moneyline": {}, "chance": None}, "espn": None},
                              hurt, now=NOW)
        self.assertAlmostEqual(found["margin"], round(0.9 * 3 + 0.1 * hurt["margin"], 1))


class FakeStore:
    def __init__(self):
        self.data = {}

    def get(self, key):
        return self.data.get(key)

    def set(self, key, value):
        self.data[key] = value


class HistoryTests(unittest.TestCase):
    def found(self, event, starts, pick="home", score=(112, 104), market=0.6):
        return {"id": event, "startsAt": starts, "madeAt": "2026-11-01T12:00:00Z", "winner": pick, "chance": {"home": 0.62, "away": 0.38},
                "home": {"abbr": "DEN", "short": "Nuggets", "logo": None}, "away": {"abbr": "BOS", "short": "Celtics", "logo": None},
                "score": {"home": score[0], "away": score[1]}, "market": {"spread": -4.5, "total": 226.5, "chance": {"home": market, "away": 1 - market}},
                "edge": {"side": None}}

    def test_record_settle_and_summary(self):
        store = FakeStore()
        gp.record("nba", self.found("1", "2026-11-03T00:00:00Z"), store=store)
        gp.record("nba", self.found("1", "2026-11-03T00:00:00Z", score=(110, 100)), store=store)   # the later one wins
        gp.record("nba", self.found("2", "2026-11-04T00:00:00Z", pick="away", market=0.7), store=store)
        gp.record("nba", self.found("3", "2026-11-06T00:00:00Z"), store=store)                   # not played yet
        asked = []

        def finals(sport, ids):
            asked.append(sorted(ids))
            return {"1": (115, 101), "2": (120, 99)}
        result = gp.history("nba", now=NOW, store=store, finals=finals)
        self.assertEqual(asked, [["1", "2"]])
        items = {item["id"]: item for item in result["items"]}
        self.assertEqual(len(items), 3)
        self.assertEqual(items["1"]["score"], {"home": 110, "away": 100})
        self.assertEqual((items["1"]["result"]["correct"], items["1"]["result"]["miss"]), (True, 6))
        self.assertEqual((items["2"]["result"]["correct"], items["2"]["result"]["market"]), (False, True))
        self.assertIsNone(items["3"]["result"])
        self.assertEqual(result["record"]["games"], 2)
        self.assertEqual(result["record"]["correct"], 1)
        self.assertEqual(result["record"]["market"], {"games": 2, "correct": 2})
        self.assertEqual(result["record"]["pending"], 1)
        # Settled games are kept settled: no more scoreboard reads for them.
        gp.history("nba", now=NOW, store=store, finals=finals)
        self.assertEqual(len(asked), 1)
        self.assertEqual(len(json.loads(store.data[gp.HISTORY_KEY.format(sport="nba")])), 3)

    def test_a_final_from_the_summary(self):
        summary = {"header": {"competitions": [{"status": {"type": {"state": "post"}},
                                                "competitors": [{"homeAway": "home", "score": "27"}, {"homeAway": "away", "score": "20"}]}]}}
        self.assertEqual(gp.final_of(summary), (27, 20))
        summary["header"]["competitions"][0]["status"]["type"]["state"] = "in"
        self.assertIsNone(gp.final_of(summary))

    def test_the_nfl_week_and_the_next(self):
        def board(path, params=None):
            event = lambda id_, state: {"id": id_, "date": "2026-11-09T18:00Z", "competitions": [{"status": {"type": {"state": state}},
                "competitors": [{"homeAway": "home", "team": {"abbreviation": "KC"}}, {"homeAway": "away", "team": {"abbreviation": "BUF"}}]}]}
            if not params:
                return {"week": {"number": 9}, "season": {"type": 2}, "events": [event("1", "post")]}
            self.assertEqual(params, {"week": 10, "seasontype": 2})
            return {"events": [event("2", "pre")]}
        gp._memory.clear()
        with patch.object(gp, "_espn", side_effect=lambda sport, path, params=None: board(path, params)):
            found = gp.slate("nfl", now=NOW)
        self.assertEqual([game["id"] for game in found["games"]], ["2"])

    def test_predict_keeps_only_games_still_to_start(self):
        store = FakeStore()
        tables = gp.nba_tables(payload(), None)
        with patch.object(gp, "_summary", return_value=game()), patch.object(gp, "_nba_numbers", return_value=tables):
            gp.predict("nba", "401", now=NOW, store=store)
        with patch.object(gp, "_summary", return_value={**game(state="in"), "id": "402"}), patch.object(gp, "_nba_numbers", return_value=tables):
            found = gp.predict("nba", "402", now=NOW, store=store)
        self.assertEqual(found["id"], "402")
        kept = json.loads(store.data[gp.HISTORY_KEY.format(sport="nba")])
        self.assertEqual([item["id"] for item in kept], ["401"])
        with self.assertRaises(ValueError):
            gp.predict("mlb", "1", store=store)


if __name__ == "__main__":
    unittest.main()
