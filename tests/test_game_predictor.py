"""game_predictor.py: the NBA and NFL game predictions and their record."""
import json
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from datetime import timedelta

import game_predictor as gp
from backend.sports.wnba.league import FIELDS

NOW = datetime(2026, 11, 5, 18, tzinfo=timezone.utc)
# No test reads DraftKings' real feed: ESPN's lines stand unless a test gives DraftKings' own.
_no_dk = patch.object(gp, "dk_events", return_value=[])


def setUpModule():
    _no_dk.start()


def tearDownModule():
    _no_dk.stop()


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

    def test_two_predictions_and_moneyline_value(self):
        # Our model has DEN by 14 where the line says 4.5: ours alone, and
        # the blend (a quarter ours), each with its chances and score.
        built = {"margin": 14.0, "total": 230, "parts": [], "teams": None, "out": None, "rest": None, "sigma": 12.12, "model": "v2"}
        found = gp.prediction("nba", game(), built, now=NOW)
        ours, blend = found["predictions"]["ours"], found["predictions"]["blend"]
        self.assertEqual((ours["margin"], ours["winner"], ours["total"]), (14.0, "home", 230))
        self.assertAlmostEqual(ours["chance"]["home"], round(gp.phi(14 / 12.12), 4))
        self.assertAlmostEqual(blend["margin"], round(0.75 * 4.5 + 0.25 * 14, 1))
        self.assertEqual((blend["weight"], blend["total"], found["margin"]), (0.25, 226.5, blend["margin"]))
        # The moneyline's value at the blend's chance: DEN -190 pays 100/190 a unit.
        p = gp.phi((0.75 * 4.5 + 0.25 * 14) / 12.5)
        home = found["ev"]["blend"]["home"]
        self.assertEqual(home["price"], -190)
        self.assertAlmostEqual(home["ev"], round(p * 100 / 190 - (1 - p), 4))
        mine = ours["chance"]["home"]
        self.assertAlmostEqual(found["ev"]["ours"]["away"]["ev"], round((1 - mine) * 1.6 - mine, 4))
        self.assertEqual(found["ev"]["best"], "home" if home["ev"] > 0 else None)
        # Ten points apart is worth a warning, and a low confidence.
        self.assertEqual([item["level"] for item in found["warnings"]], ["high"])
        self.assertEqual(found["confidence"], "Low")

    def test_confidence(self):
        built = {"margin": 9.0, "total": 230, "sigma": 12.12, "model": "v2"}
        sure = gp.prediction("nba", game(spread=-9.5, home_ml=-450, away_ml=340), built, now=NOW)
        self.assertEqual((sure["confidence"], sure["warnings"]), ("High", []))
        self.assertIn("Our model and the line pick the same team", sure["confidenceWhy"])
        split = gp.prediction("nba", game(spread=-2.5), {**built, "margin": -3.0}, now=NOW)
        self.assertEqual(split["confidence"], "Low")
        warned = gp.prediction("nba", game(spread=-9.5, home_ml=-450, away_ml=340),
                               {**built, "warnings": [gp._warn("medium", "Early season")]}, now=NOW)
        self.assertEqual(warned["confidence"], "Medium")

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


class NbaV2Tests(unittest.TestCase):
    def setUp(self):
        self.context = gp.nba_context(payload(), None, NOW.date())

    def test_ratings_injuries_and_warnings(self):
        healthy = gp.nba_model_v2(game(), self.context)
        self.assertEqual(healthy["model"], "v2")
        # BOS wins every game in the fixture: the model has BOS (away) ahead.
        self.assertLess(healthy["margin"], 0)
        self.assertGreater(self.context["rt"]["off"]["BOS"], self.context["rt"]["off"]["DEN"])
        self.assertEqual(healthy["teams"]["away"]["last10"], [6, 0])
        # Six games each: early season, and the small-sample spread of finals.
        self.assertEqual(healthy["sigma"], 9.99)
        self.assertIn("Early season", healthy["warnings"][0]["text"])
        hurt = gp.nba_model_v2(game({"DEN": [{"id": "Dstar", "name": "Nikola Jokic", "position": "C", "status": "Out"}]}), self.context)
        star = self.context["states"]["DEN"]["regulars"]["Dstar"]
        self.assertAlmostEqual(healthy["margin"] - hurt["margin"], gp.V2["nba"]["injury"] * star["value"] * star["reflect"], places=6)
        self.assertEqual((hurt["out"]["home"][0]["name"], hurt["out"]["home"][0]["out"]), ("Nikola Jokic", True))
        # A questionable regular: the swing if he sits, as a note.
        maybe = gp.nba_model_v2(game({"DEN": [{"id": "Dstar", "name": "Nikola Jokic", "status": "Questionable"}]}), self.context)
        self.assertAlmostEqual(maybe["margin"], healthy["margin"], places=6)
        self.assertTrue(any("if he sits" in item["text"] for item in maybe["warnings"]))
        players = gp.nba_players_v2(game(), self.context, healthy)
        self.assertEqual(set(players["home"]["avg"]), {"pts", "reb", "ast"})


class NflV2Tests(unittest.TestCase):
    """Two seasons of KC and BUF: KC's offense far better; Mahomes its quarterback."""
    def setUp(self):
        games, teams, qbs = {}, [], []
        for season, base in ((2025, 1730000000), (2026, 1757000000)):
            for n in range(6):
                gid = f"{season}_{n}"
                home, away = ("KC", "BUF") if n % 2 == 0 else ("BUF", "KC")
                kc_home = home == "KC"
                games[gid] = {"game_id": gid, "season": season, "home": home, "away": away, "home_score": 27 if kc_home else 17,
                              "away_score": 17 if kc_home else 27, "final": True, "kickoff": base + n * 7 * 86400}
                for team, epa, succ in (("KC", 6.0, 30.0), ("BUF", -3.0, 24.0)):
                    teams.append({"game": gid, "team": team, "side": "o", "plays": 60, "epa": epa, "succ": succ})
                qbs.append({"game": gid, "team": "KC", "qb": "q1", "name": "P.Mahomes", "db": 38, "epa": 8.0})
                qbs.append({"game": gid, "team": "BUF", "qb": "q2", "name": "J.Allen", "db": 36, "epa": 2.0})
        qbs.append({"game": "2026_5", "team": "KC", "qb": "q3", "name": "C.Wentz", "db": 6, "epa": -3.0})
        self.games = games
        table = lambda season: {"teams": [t for t in teams if t["game"].startswith(str(season))],
                                "qbs": [q for q in qbs if q["game"].startswith(str(season))], "builtAt": "2026-10-20T12:00:00+00:00"}
        today = datetime(2026, 10, 20).date()
        self.context = gp.nfl_context(table(2026), table(2025), games, today, 2026)
        self.game = {"id": "9", "startsAt": "2026-10-25T17:00:00Z", "neutral": False, "home": {"abbr": "BUF"}, "away": {"abbr": "KC"}}

    def test_names_match_across_sources(self):
        self.assertEqual(gp._short_key("P.Mahomes"), gp._short_key("Patrick Mahomes II"))
        self.assertEqual(gp._short_key("D.Thompson-Robinson"), gp._short_key("Dorian Thompson-Robinson"))
        self.assertNotEqual(gp._short_key("J.Allen"), gp._short_key("Kyler Murray"))

    def test_the_quarterback_out(self):
        healthy = gp.nfl_model_v2({**self.game, "injuries": {}}, self.context)
        self.assertEqual(healthy["model"], "v2")
        self.assertLess(healthy["margin"], 0)          # KC, away, is better
        self.assertEqual(healthy["starters"]["away"], {"name": "P.Mahomes", "how": "recent starter"})
        hurt = gp.nfl_model_v2({**self.game, "injuries": {"KC": [{"name": "Patrick Mahomes", "position": "QB", "status": "Out"}]}}, self.context)
        self.assertEqual(hurt["starters"]["away"]["name"], "C.Wentz")
        self.assertGreater(hurt["margin"], healthy["margin"])
        self.assertAlmostEqual(hurt["out"]["away"][0]["impact"], round(hurt["margin"] - healthy["margin"], 1), places=1)
        self.assertTrue(any("C.Wentz" in item["text"] for item in hurt["warnings"]))
        # The total from the points ratings (no fitted total weights).
        self.assertAlmostEqual(healthy["total"], 44, delta=6)
        found = gp.prediction("nfl", {**self.game, "state": "pre", "line": {"spread": 3.5, "total": 45.5, "moneyline": {"home": 150, "away": -180}, "chance": None},
                                      "espn": None}, hurt, now=NOW)
        self.assertAlmostEqual(found["margin"], round(0.9 * -3.5 + 0.1 * hurt["margin"], 1))
        self.assertAlmostEqual(found["predictions"]["ours"]["chance"]["home"], round(gp.phi(hurt["margin"] / 9.56), 4))

    def test_without_the_table_the_older_model(self):
        with patch.object(gp, "_nfl_v2", return_value=None), patch.object(gp, "_nfl_numbers", return_value=gp.nfl_tables(self.games, 2026)):
            built, _ = gp._model("nfl", {**self.game, "injuries": {}}, NOW)
        self.assertEqual((built["model"], built["fallback"]), ("v1", "no play-by-play table"))


class SnapshotTests(unittest.TestCase):
    def test_the_cron_only_samples_the_odds(self):
        store = FakeStore()
        line = lambda chance: {"chance": {"home": chance, "away": 1 - chance}, "moneyline": {"home": -150, "away": 130}}
        upcoming = [{"id": "1", "state": "pre", "line": line(0.6)}, {"id": "2", "state": "pre", "line": None}]
        with patch.object(gp, "slate", return_value={"games": upcoming}):
            done = gp.snapshot("nba", now=NOW, store=store)
        self.assertEqual((done["games"], done["sampled"]), (2, 1))
        self.assertEqual(json.loads(store.data[gp.ODDS_KEY.format(sport="nba", event="1")]), [[int(NOW.timestamp()), 0.6, -150, 130]])
        self.assertFalse(any("picks" in key or "history" in key for key in store.data))
        # The same chance minutes later adds nothing; a move, or a quarter hour, does.
        later = NOW + timedelta(minutes=5)
        self.assertEqual(gp.sample_odds("nba", [{"id": "1", "state": "pre", "line": line(0.6)}], store=store, now=later), 0)
        self.assertEqual(gp.sample_odds("nba", [{"id": "1", "state": "pre", "line": line(0.63)}], store=store, now=later), 1)
        self.assertEqual(gp.sample_odds("nba", [{"id": "1", "state": "pre", "line": line(0.63)}], store=store, now=later + timedelta(minutes=16)), 1)
        self.assertEqual(len(json.loads(store.data[gp.ODDS_KEY.format(sport="nba", event="1")])), 3)


class ChartTests(unittest.TestCase):
    def summary(self, state="in"):
        return {"header": {"competitions": [{"date": "2026-11-06T00:00Z", "status": {"type": {"state": state, "shortDetail": "Q2 5:00"}},
                                             "competitors": [{"homeAway": "home", "team": {"abbreviation": "DEN"}, "score": "50"},
                                                             {"homeAway": "away", "team": {"abbreviation": "BOS"}, "score": "44"}]}]},
                "pickcenter": [], "winprobability": [{"playId": "a", "homeWinPercentage": 0.5}, {"playId": "b", "homeWinPercentage": 0.58},
                                                      {"playId": "c", "homeWinPercentage": 0.61}],
                "plays": [{"id": "a", "wallclock": "2026-11-06T00:05:00Z"}, {"id": "b", "wallclock": "2026-11-06T00:20:00Z"}]}

    def test_the_market_before_and_espn_in_the_game(self):
        store = FakeStore()
        store.set(gp.ODDS_KEY.format(sport="nba", event="401"), json.dumps([[1, 0.55, -120, 100], [2, 0.57, -130, 110]]))
        gp._memory.clear()
        with patch.object(gp, "_espn", return_value=self.summary()):
            found = gp.chart("nba", "401", now=datetime(2026, 11, 6, 0, 40, tzinfo=timezone.utc), store=store)
        gp._memory.clear()
        self.assertEqual(found["market"], [[1, 0.55], [2, 0.57]])
        # Each play at its clock time; the last one (no clock) spread toward now.
        stamps = [point[0] for point in found["live"]]
        self.assertEqual(stamps[:2], [int(datetime(2026, 11, 6, 0, 5, tzinfo=timezone.utc).timestamp()),
                                      int(datetime(2026, 11, 6, 0, 20, tzinfo=timezone.utc).timestamp())])
        self.assertEqual([point[1] for point in found["live"]], [0.5, 0.58, 0.61])
        self.assertEqual((found["state"], found["now"]["live"], found["home"]["score"]), ("in", 0.61, 50))


def dk_feed(home="DEN Nuggets", away="BOS Celtics", start="2026-11-06T00:40:00.0000000Z", home_price="\u2212190", away_price="+160"):
    """DraftKings' league feed, as its sportsbook pages read it: one game with its moneyline and spread."""
    return {"events": [{"id": "33001", "name": f"{away} @ {home}", "startEventDate": start, "status": "NOT_STARTED",
                        "participants": [{"name": home, "venueRole": "Home"}, {"name": away, "venueRole": "Away"}]},
                       {"id": "33002", "name": "No prices yet", "startEventDate": start,
                        "participants": [{"name": "LA Lakers", "venueRole": "Home"}, {"name": "PHI 76ers", "venueRole": "Away"}]}],
            "markets": [{"id": "m1", "eventId": "33001", "name": "Moneyline"}, {"id": "m2", "eventId": "33001", "name": "Spread"},
                        {"id": "m3", "eventId": "33002", "marketType": {"name": "Moneyline"}}],
            "selections": [{"marketId": "m1", "outcomeType": "Home", "displayOdds": {"american": home_price}},
                           {"marketId": "m1", "outcomeType": "Away", "displayOdds": {"american": away_price}},
                           {"marketId": "m2", "outcomeType": "Home", "label": "-4.5", "displayOdds": {"american": "\u2212110"}},
                           {"marketId": "m3", "outcomeType": "Home", "displayOdds": {"american": "EVEN"}}]}


class DraftKingsTests(unittest.TestCase):
    def espn_game(self):
        found = game()
        found["home"], found["away"] = {"abbr": "DEN", "short": "Nuggets"}, {"abbr": "BOS", "short": "Celtics"}
        found["line"]["moneyline"], found["line"]["chance"] = {"home": -150, "away": 130}, {"home": 0.58, "away": 0.42}
        return found

    def test_the_feed(self):
        events = gp.parse_dk(dk_feed())
        # Only a game with both sides priced; DraftKings' minus sign read; the spread market left alone.
        self.assertEqual([(event["id"], event["moneyline"]) for event in events], [("33001", {"home": -190.0, "away": 160.0})])
        self.assertEqual(events[0]["names"], {"home": "DEN Nuggets", "away": "BOS Celtics"})
        self.assertEqual(events[0]["start"], datetime(2026, 11, 6, 0, 40, tzinfo=timezone.utc))
        self.assertEqual((gp._american("EVEN"), gp._american("+125"), gp._american("\u2212110"), gp._american("")), (100, 125, -110, None))
        self.assertEqual(gp.parse_dk(None), [])

    def test_draftkings_moneyline_over_espns(self):
        espn = self.espn_game()
        found = gp.with_dk("nba", [espn], gp.parse_dk(dk_feed()))[0]
        self.assertEqual((found["line"]["moneyline"], found["line"]["source"]), ({"home": -190.0, "away": 160.0}, "draftkings"))
        self.assertAlmostEqual(found["line"]["chance"]["home"] + found["line"]["chance"]["away"], 1)
        self.assertGreater(found["line"]["chance"]["home"], 0.6)
        # ESPN's spread and total stay; the game ESPN gave isn't changed (it's kept for minutes).
        self.assertEqual((found["line"]["spread"], found["line"]["total"]), (-4.5, 226.5))
        self.assertEqual(espn["line"]["moneyline"], {"home": -150, "away": 130})

    def test_a_games_summary_until_tip_off(self):
        espn = self.espn_game()
        with patch.object(gp, "_kept", return_value=espn), patch.object(gp, "dk_events", return_value=gp.parse_dk(dk_feed())):
            self.assertEqual(gp._summary("nba", "401")["line"]["moneyline"], {"home": -190.0, "away": 160.0})
            espn["state"] = "in"
            self.assertEqual(gp._summary("nba", "401")["line"]["moneyline"], {"home": -150, "away": 130})

    def test_a_neutral_site_game_listed_the_other_way(self):
        found = gp.with_dk("nba", [self.espn_game()], gp.parse_dk(dk_feed(home="BOS Celtics", away="DEN Nuggets", home_price="+160", away_price="-190")))[0]
        self.assertEqual(found["line"]["moneyline"], {"home": -190.0, "away": 160.0})

    def test_no_match_espns_line_stands(self):
        for feed in (dk_feed(start="2026-11-07T00:40:00Z"), dk_feed(home="DEN Broncos"), {}):
            found = gp.with_dk("nba", [self.espn_game()], gp.parse_dk(feed))[0]
            self.assertEqual(found["line"]["moneyline"], {"home": -150, "away": 130})
            self.assertNotIn("source", found["line"])

    def test_a_feed_that_fails_rests(self):
        _no_dk.stop()
        try:
            gp._memory.clear()
            with patch.object(gp.requests, "get", side_effect=OSError("blocked")) as get:
                self.assertEqual(gp.dk_events("nba"), [])
                gp._memory.pop("dk:nba", None)
                self.assertEqual(gp.dk_events("nba"), [])
                self.assertEqual(get.call_count, 1)
            self.assertEqual(gp.dk_events("mlb"), [])
        finally:
            gp._memory.clear()
            _no_dk.start()

    def test_the_chart_reads_draftkings(self):
        summary = ChartTests().summary(state="pre")
        for competitor, short in zip(summary["header"]["competitions"][0]["competitors"], ("Nuggets", "Celtics")):
            competitor["team"]["shortDisplayName"] = short
        store = FakeStore()
        gp._memory.clear()
        with patch.object(gp, "_espn", return_value=summary), patch.object(gp, "dk_events", return_value=gp.parse_dk(dk_feed())):
            found = gp.chart("nba", "401", now=datetime(2026, 11, 5, 23, 0, tzinfo=timezone.utc), store=store)
        gp._memory.clear()
        self.assertEqual((found["source"], found["now"]["moneyline"]), ("draftkings", {"home": -190.0, "away": 160.0}))
        self.assertEqual(json.loads(store.data[gp.ODDS_KEY.format(sport="nba", event="401")])[-1][2:], [-190.0, 160.0])


class BoardTests(unittest.TestCase):
    def test_every_game_with_its_moneylines(self):
        store = FakeStore()
        upcoming = [{"id": str(n), "state": "pre", "startsAt": f"2026-11-06T0{n}:00:00Z"} for n in range(3)]
        context = gp.nba_context(payload(), None, NOW.date())
        # Game 0's line agrees with our model (BOS by about 5), game 2's is 25 points the other way.
        summaries = {"0": game(spread=5.5, home_ml=190, away_ml=-230), "1": game(spread=5.5, home_ml=None, away_ml=None),
                     "2": game(spread=-25.5, home_ml=-5000, away_ml=2000)}
        gp._memory.pop("board:nba:next", None)
        with patch.object(gp, "slate", return_value={"games": upcoming}), patch.object(gp, "_nba_v2", return_value=context), \
                patch.object(gp, "_summary", side_effect=lambda sport, event: {**summaries[event], "id": event}):
            found = gp.board("nba", now=NOW, store=store)
        games = {item["id"]: item for item in found["games"]}
        self.assertEqual(sorted(games), ["0", "1", "2"])
        self.assertEqual((games["0"]["prices"], games["0"]["held"], games["0"]["winner"]), ({"home": 190, "away": -230}, None, "away"))
        self.assertAlmostEqual(games["0"]["chance"]["home"] + games["0"]["chance"]["away"], 1, places=3)
        self.assertIn("home", games["0"]["ev"])
        self.assertEqual(games["1"]["held"], "No moneyline yet")
        # 25 points from our model: a data warning holds it back.
        self.assertIn("points apart", games["2"]["held"])
        # Nothing kept: the history is only what a member saves.
        self.assertFalse(any("picks" in key or "history" in key for key in store.data))
        self.assertEqual(games["0"]["sport"], "nba")
        gp._memory.pop("board:nba:next", None)

    def test_one_day(self):
        # The NFL: this week's board and next week's, kept to the day asked for.
        def scoreboard(sport, path, params=None):
            event = lambda id_, date: {"id": id_, "date": date, "competitions": [{"status": {"type": {"state": "pre"}},
                "competitors": [{"homeAway": "home", "team": {"abbreviation": "KC"}}, {"homeAway": "away", "team": {"abbreviation": "BUF"}}]}]}
            if not params:
                return {"week": {"number": 10}, "season": {"type": 2}, "events": [event("1", "2026-11-08T18:00Z"), event("2", "2026-11-10T01:15Z")]}
            return {"events": [event("3", "2026-11-15T18:00Z")]}
        gp._memory.clear()
        with patch.object(gp, "_espn", side_effect=scoreboard):
            self.assertEqual([g["id"] for g in gp.day_games("nfl", "20261108", now=NOW)], ["1"])
            # A Monday night kickoff (01:15 UTC Tuesday) is Monday's game in the US.
            self.assertEqual([g["id"] for g in gp.day_games("nfl", "20261109", now=NOW)], ["2"])
            self.assertEqual([g["id"] for g in gp.day_games("nfl", "20261115", now=NOW)], ["3"])
        gp._memory.clear()


class FakeStore:
    def __init__(self):
        self.data = {}

    def get(self, key):
        return self.data.get(key)

    def set(self, key, value):
        self.data[key] = value


class HistoryTests(unittest.TestCase):
    def save(self, store, event, starts, side="home", stake=None, home_ml=-190, away_ml=160, member="m1"):
        g = {**game(home_ml=home_ml, away_ml=away_ml), "id": event, "startsAt": starts}
        context = gp.nba_context(payload(), None, NOW.date())
        with patch.object(gp, "_summary", return_value=g), patch.object(gp, "_nba_v2", return_value=context):
            return gp.save_pick("nba", member, event, side, stake, now=NOW - timedelta(days=5), store=store)

    def test_only_saved_picks_settled_with_profit(self):
        store = FakeStore()
        self.save(store, "1", "2026-11-03T00:00:00Z", side="home", stake=50)
        first = self.save(store, "1", "2026-11-03T00:00:00Z", side="away", stake=20)         # a new pick replaces it
        self.assertEqual((first["side"], first["price"], first["dec"], first["stake"]), ("away", 160, 2.6, 20.0))
        self.save(store, "2", "2026-11-04T00:00:00Z", side="home")                              # no amount: units only
        self.save(store, "3", "2026-11-06T00:00:00Z")                                           # not played yet
        self.save(store, "9", "2026-11-03T00:00:00Z", member="someone else")
        asked = []

        def finals(sport, ids):
            asked.append(sorted(ids))
            return {"1": (101, 115), "2": (99, 120)}
        result = gp.history("nba", "m1", now=NOW, store=store, finals=finals)
        self.assertEqual(asked, [["1", "2"]])
        items = {item["id"]: item for item in result["items"]}
        self.assertEqual(sorted(items), ["1", "2", "3"])
        # BOS (away) at +160 won: 20 staked wins 32.
        self.assertEqual((items["1"]["result"]["correct"], items["1"]["result"]["profit"], items["1"]["result"]["units"]), (True, 32.0, 1.6))
        self.assertEqual((items["2"]["result"]["correct"], items["2"]["result"]["units"]), (False, -1.0))
        self.assertIsNone(items["3"]["result"])
        record = result["record"]
        self.assertEqual((record["games"], record["correct"], record["units"], record["pending"]), (2, 1, 0.6, 1))
        self.assertEqual(record["money"], {"staked": 20.0, "profit": 32.0})
        # Settled once; a pick still to come can be taken back, a settled one can't.
        gp.history("nba", "m1", now=NOW, store=store, finals=finals)
        self.assertEqual(len(asked), 1)
        self.assertTrue(gp.remove_pick("nba", "m1", "3", store=store))
        self.assertFalse(gp.remove_pick("nba", "m1", "1", store=store))
        self.assertEqual(len(gp.history("nba", "someone else", now=NOW, store=store, finals=finals)["items"]), 1)

    def test_no_picks_once_the_game_starts(self):
        store = FakeStore()
        g = {**game(state="in"), "id": "5"}
        context = gp.nba_context(payload(), None, NOW.date())
        with patch.object(gp, "_summary", return_value=g), patch.object(gp, "_nba_v2", return_value=context):
            with self.assertRaises(LookupError):
                gp.save_pick("nba", "m1", "5", "home", now=NOW, store=store)
            with self.assertRaises(ValueError):
                gp.save_pick("nba", "m1", "5", "draw", now=NOW, store=store)

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

    def test_predict_keeps_nothing(self):
        store = FakeStore()
        tables = gp.nba_tables(payload(), None)
        context = gp.nba_context(payload(), None, NOW.date())
        with patch.object(gp, "_summary", return_value=game()), patch.object(gp, "_nba_v2", return_value=context):
            found = gp.predict("nba", "401", now=NOW, store=store)
        self.assertEqual((found["id"], found["model"]), ("401", "v2"))
        self.assertEqual(store.data, {})
        # Without v2's numbers the older model stands in, and says so.
        with patch.object(gp, "_summary", return_value=game()), patch.object(gp, "_nba_v2", side_effect=RuntimeError), \
                patch.object(gp, "_nba_numbers", return_value=tables):
            older = gp.predict("nba", "401", now=NOW, store=store)
        self.assertEqual(older["model"], "v1")
        self.assertIn("simpler model", older["warnings"][0]["text"])
        with self.assertRaises(ValueError):
            gp.predict("mlb", "1", store=store)


if __name__ == "__main__":
    unittest.main()
