"""Each slip pick's game (slip_games.py): status, injuries, lineups and the
players' lines so far, from payloads in each source's own shape."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import slip_games  # noqa: E402
from tests import nhl_samples, soccer_samples  # noqa: E402
from tests.test_nfl_preseason import athlete  # noqa: E402
from tests.test_wnba_context import KEYS, line  # noqa: E402


def espn_header(home, away, home_score, away_score, state="in", period=3, clock="8:42", detail="8:42 - 3rd", name="STATUS_IN_PROGRESS"):
    return {"id": "401", "competitions": [{"id": "401", "date": "2026-10-04T17:00Z",
        "status": {"period": period, "displayClock": clock, "type": {"state": state, "shortDetail": detail, "completed": state == "post", "name": name}},
        "competitors": [{"homeAway": "home", "score": str(home_score), "team": {"id": "1", "abbreviation": home}},
                        {"homeAway": "away", "score": str(away_score), "team": {"id": "2", "abbreviation": away}}]}]}


def nfl_summary(state="in"):
    """DAL (home) 14, LAR 10 in the 3rd: Prescott and Lamb on DAL's side."""
    dal = {"team": {"abbreviation": "DAL"}, "statistics": [
        {"name": "passing", "keys": ["completions/passingAttempts", "passingYards", "yardsPerPassAttempt", "passingTouchdowns",
                                     "interceptions", "sacks-sackYardsLost", "adjQBR", "QBRating"],
         "athletes": [athlete("2577417", "Dak Prescott", "15/22", "188", "8.5", "1", "0", "1-6", "--", "101.2")]},
        {"name": "receiving", "keys": ["receptions", "receivingYards", "yardsPerReception", "receivingTouchdowns", "longReception", "receivingTargets"],
         "athletes": [athlete("4241389", "CeeDee Lamb", "4", "42", "10.5", "1", "19", "6")]},
    ]}
    lar = {"team": {"abbreviation": "LAR"}, "statistics": [
        {"name": "rushing", "keys": ["rushingAttempts", "rushingYards", "yardsPerRushAttempt", "rushingTouchdowns", "longRushing"],
         "athletes": [athlete("4430737", "Kyren Williams", "11", "38", "3.5", "0", "9")]}]}
    return {"header": espn_header("DAL", "LAR", 14, 10, state=state),
            "boxscore": {"players": [dal, lar] if state != "pre" else []},
            "injuries": [{"team": {"id": "1", "abbreviation": "DAL"}, "injuries": [
                {"status": "Out", "athlete": {"displayName": "Brandin Cooks", "position": {"abbreviation": "WR"}}},
                {"status": "Questionable", "athlete": {"displayName": "Jake Ferguson", "position": {"abbreviation": "TE"}}}]},
                {"team": {"id": "2", "abbreviation": "LAR"}, "injuries": []}]}


class MatchingTests(unittest.TestCase):
    def test_codes_and_names(self):
        self.assertEqual(slip_games.code("nfl", "LAR"), slip_games.code("nfl", "LA"))
        self.assertEqual(slip_games.code("nhl", "TBL"), slip_games.code("nhl", "TB"))
        self.assertEqual(slip_games.code("mlb", "CWS"), slip_games.code("mlb", "CHW"))
        people = [{"id": "1", "name": "Kenneth Walker III"}, {"id": "2", "name": "Josh Allen"}, {"id": "3", "name": "Josh Downs"}]
        self.assertEqual(slip_games.find_person(people, "Kenneth Walker")["id"], "1")
        self.assertEqual(slip_games.find_person(people, "J. Downs")["id"], "3")
        self.assertEqual(slip_games.find_person(people, "Someone", "2")["id"], "2")
        self.assertIsNone(slip_games.find_person(people, "Nobody Here"))

    def test_scoreboard_event_by_either_code(self):
        events = [{"id": "9", "date": "2026-10-04T17:00Z", "competitions": [{"competitors": [
            {"team": {"abbreviation": "DAL"}}, {"team": {"abbreviation": "LAR"}}]}]}]
        self.assertEqual(slip_games.find_event("nfl", "LA", "DAL", None, events)["id"], "9")
        self.assertIsNone(slip_games.find_event("nfl", "KC", "", None, events))

    def test_request_is_trimmed(self):
        games = slip_games.clean({"games": [{"sport": "nfl", "team": "DAL", "players": [{"key": i, "name": f"P {i}"} for i in range(30)]}] * 20
                                 + [{"sport": "cricket"}]})
        self.assertEqual(len(games), slip_games.MAX_GAMES)
        self.assertEqual(len(games[0]["players"]), slip_games.MAX_PLAYERS)
        with self.assertRaises(ValueError):
            slip_games.clean({"games": "nope"})


class FaceTests(unittest.TestCase):
    def test_a_players_photo_comes_from_his_box_score_id(self):
        self.assertEqual(slip_games.photo("nfl", "4426515"), "https://a.espncdn.com/i/headshots/nfl/players/full/4426515.png")
        self.assertIn("/people/660271/headshot/", slip_games.photo("mlb", 660271))
        self.assertEqual(slip_games.photo("nhl", "8479318", "TB", "2026-01-05T00:00:00+00:00"),
                         "https://assets.nhle.com/mugs/nhl/20252026/TBL/8479318.png")
        self.assertEqual(slip_games._players({"sport": "wnba", "players": [{"key": "k", "name": "A'ja Wilson"}]},
                                             [{"id": "3149391", "name": "A'ja Wilson", "team": "LV", "line": {}}])["k"]["headshot"],
                         "https://a.espncdn.com/i/headshots/wnba/players/full/3149391.png")
        self.assertEqual(slip_games.photo("nba", "not-an-id"), "")

    def test_a_clubs_logo_comes_from_its_code(self):
        self.assertTrue(slip_games.team_logo("nfl", "LAR").endswith("/logos/LA.svg"))
        self.assertTrue(slip_games.team_logo("nba", "GSW").endswith("/nba/500/gs.png"))
        self.assertTrue(slip_games.team_logo("mlb", "CWS").endswith("/mlb/500/chw.png"))
        self.assertEqual(slip_games.team_logo("soccer", "359"), "")
        self.assertEqual(slip_games.team_logo("nfl", "<b>"), "")


class EspnTests(unittest.TestCase):
    def test_nfl_live_line_injuries_and_clock(self):
        item = {"sport": "nfl", "team": "DAL", "opponent": "LA", "players": [{"key": "a", "name": "CeeDee Lamb"}, {"key": "b", "name": "Dak Prescott"},
                                                                             {"key": "c", "name": "Kyren Williams"}]}
        view = slip_games.espn_view("nfl", nfl_summary(), item)
        self.assertEqual((view["state"], view["period"], view["clock"]), ("in", 3, "8:42"))
        self.assertEqual(view["teams"]["DAL"]["score"], 14)
        self.assertIn("LA", view["teams"])  # ESPN's LAR, the Finder's LA
        lamb = view["players"]["a"]
        self.assertEqual(lamb["team"], "DAL")
        self.assertEqual((lamb["line"]["receiving_yards"], lamb["line"]["receptions"], lamb["line"]["targets"]), (42, 4, 6))
        self.assertEqual(view["players"]["b"]["line"]["passing_yards"], 188)
        self.assertEqual(view["players"]["c"]["line"]["rushing_yards"], 38)
        self.assertEqual([(p["name"], p["status"]) for p in view["injuries"]["DAL"]], [("Brandin Cooks", "Out"), ("Jake Ferguson", "Questionable")])

    def test_before_kickoff_only_status_and_injuries(self):
        view = slip_games.espn_view("nfl", nfl_summary("pre"), {"sport": "nfl", "players": [{"key": "a", "name": "CeeDee Lamb"}]})
        self.assertEqual(view["state"], "pre")
        self.assertIsNone(view["players"]["a"])
        self.assertEqual(len(view["injuries"]["DAL"]), 2)

    def test_basketball_line_and_dnp(self):
        summary = {"header": espn_header("NY", "IND", 61, 58, period=3, clock="4:10", detail="4:10 - 3rd"),
                   "boxscore": {"players": [
                       {"team": {"id": "1", "abbreviation": "NY"}, "statistics": [{"keys": KEYS, "athletes": [
                           line(24, 18, 7, 3, pid="11", name="Breanna Stewart"), line(0, 0, pid="12", name="Sabrina Ionescu", dnp=True)]}]},
                       {"team": {"id": "2", "abbreviation": "IND"}, "statistics": [{"keys": KEYS, "athletes": [
                           line(26, 21, 2, 6, pid="21", name="Kelsey Mitchell")]}]}]}, "plays": []}
        item = {"sport": "wnba", "players": [{"key": "s", "name": "Breanna Stewart", "id": "11"}, {"key": "i", "name": "Sabrina Ionescu"},
                                             {"key": "m", "name": "Kelsey Mitchell"}]}
        view = slip_games.espn_view("wnba", summary, item)
        stewart = view["players"]["s"]["line"]
        self.assertEqual((stewart["player_points"], stewart["player_rebounds"], stewart["player_points_rebounds_assists"]), (18, 7, 28))
        self.assertFalse(view["players"]["i"]["played"])
        self.assertEqual(view["players"]["m"]["line"]["player_assists"], 6)

    def test_basketball_pregame_line(self):
        summary = {"header": espn_header("NY", "IND", 0, 0, state="pre", period=0, clock="0:00", detail="7:30 PM", name="STATUS_SCHEDULED"),
                   "boxscore": {"players": []},
                   "pickcenter": [{"overUnder": 166.5, "spread": -7.5,
                                   "homeTeamOdds": {"moneyLine": -300}, "awayTeamOdds": {"moneyLine": 240}}]}
        view = slip_games.espn_view("wnba", summary, {"sport": "wnba", "players": []})
        odds = view["odds"]
        self.assertEqual(odds["total"], 166.5)
        self.assertEqual(odds["spread"], {"NY": -7.5, "IND": 7.5})
        self.assertAlmostEqual(odds["win"]["NY"] + odds["win"]["IND"], 1, places=3)
        self.assertGreater(odds["win"]["NY"], 0.7)
        # No line posted: nothing made up.
        summary["pickcenter"] = [{"provider": {"name": "ESPN BET"}}]
        self.assertIsNone(slip_games.espn_view("wnba", summary, {"sport": "wnba", "players": []})["odds"])
        # Under way, the pregame line no longer says anything.
        self.assertNotIn("odds", slip_games.espn_view("wnba", {**summary, "header": espn_header("NY", "IND", 40, 38)}, {"sport": "wnba", "players": []}))

    def test_game_carries_the_picks_codes(self):
        item = {"sport": "nfl", "team": "DAL", "opponent": "LAR", "players": [{"key": "a", "name": "CeeDee Lamb"}]}
        with patch.object(slip_games, "_espn_event", return_value={"id": "401"}), patch.object(slip_games, "_summary", return_value=nfl_summary()):
            view = slip_games.read_game(item)
        self.assertEqual((view["team"], view["opponent"]), ("DAL", "LA"))
        self.assertIn(view["opponent"], view["teams"])

    def test_a_failed_game_is_not_found(self):
        with patch.object(slip_games, "_espn_event", side_effect=RuntimeError("down")):
            self.assertEqual(slip_games.read_game({"sport": "nfl", "team": "DAL"}), {"found": False})


class NhlTests(unittest.TestCase):
    def test_live_box(self):
        box = nhl_samples.box(state="LIVE", home_score=2, away_score=1)
        box.update(periodDescriptor={"number": 2}, clock={"timeRemaining": "11:05", "inIntermission": False})
        item = {"sport": "nhl", "players": [{"key": "b", "name": "Aleksander Barkov", "id": str(nhl_samples.BARKOV)},
                                            {"key": "g", "name": "Frederik Andersen", "id": str(nhl_samples.ANDERSEN)}]}
        view = slip_games.nhl_view(box, item, {"CAR": [{"name": "Seth Jarvis", "status": "Day-To-Day", "position": "RW"}]})
        self.assertEqual((view["state"], view["period"], view["clock"]), ("in", 2, "11:05"))
        self.assertEqual(view["players"]["b"]["line"]["sog"], 4)
        self.assertEqual(view["players"]["g"]["line"]["saves"], 23)
        self.assertEqual(view["injuries"]["CAR"][0]["status"], "Day-To-Day")
        self.assertIsNone(view["odds"])

    def test_pregame_line(self):
        import nhl_research
        box = nhl_samples.box(state="FUT", home_score=0, away_score=0)
        box["startTimeUTC"] = "2026-10-14T23:00:00Z"
        line = {"home": {"moneyline": -150, "spread": -1.5}, "away": {"moneyline": 130, "spread": 1.5}, "total": 6.5}
        with patch.object(nhl_research, "_odds", return_value=line) as asked:
            odds = slip_games.nhl_odds(box)
        home, away = (slip_games.code("nhl", nhl_research.canonical(box[side]["abbrev"])) for side in ("homeTeam", "awayTeam"))
        self.assertEqual(asked.call_args[0][0]["start"], "2026-10-14T23:00:00Z")
        self.assertEqual(odds["total"], 6.5)
        self.assertEqual(odds["spread"], {home: -1.5, away: 1.5})
        self.assertGreater(odds["win"][home], 0.55)
        with patch.object(nhl_research, "_odds", return_value=None):
            self.assertIsNone(slip_games.nhl_odds(box))
        view = slip_games.nhl_view(box, {"sport": "nhl", "players": []}, {}, odds)
        self.assertEqual(view["odds"], odds)


class MlbTests(unittest.TestCase):
    def game(self, abstract="Live", detailed="In Progress"):
        return {"gamePk": 777, "gameDate": "2026-10-04T23:05:00Z", "status": {"abstractGameState": abstract, "detailedState": detailed},
                "linescore": {"currentInning": 5, "currentInningOrdinal": "5th", "inningState": "Top", "outs": 1},
                "teams": {"home": {"score": 3, "team": {"id": 119, "abbreviation": "LAD"}, "probablePitcher": {"id": 1, "fullName": "Yoshinobu Yamamoto"}},
                          "away": {"score": 1, "team": {"id": 144, "abbreviation": "ATL"}, "probablePitcher": {"id": 2, "fullName": "Chris Sale"}}}}

    def box(self, posted=True):
        def player(pid, name, order=None, batting=None, pitching=None):
            entry = {"person": {"id": pid, "fullName": name}, "stats": {"batting": batting or {}, "pitching": pitching or {}}}
            if order:
                entry["battingOrder"] = order
            return entry
        lad = {f"ID{pid}": player(pid, f"Dodger {pid}", f"{index + 1}00") for index, pid in enumerate(range(10, 19))}
        lad["ID10"] = player(10, "Shohei Ohtani", "100", {"hits": 2, "runs": 1, "rbi": 2, "homeRuns": 1, "totalBases": 5})
        lad["ID1"] = player(1, "Yoshinobu Yamamoto", None, None, {"strikeOuts": 6, "outs": 13, "hits": 3, "earnedRuns": 1})
        atl = {"ID2": player(2, "Chris Sale", None, None, {"strikeOuts": 4, "outs": 12}), "ID30": player(30, "Matt Olson", "300", {"hits": 0})}
        return {"teams": {"home": {"players": lad, "battingOrder": list(range(10, 19)) if posted else []},
                          "away": {"players": atl, "battingOrder": [30] if posted else []}}}

    def test_live_lines_order_and_starters(self):
        item = {"sport": "mlb", "players": [{"key": "o", "name": "Shohei Ohtani", "id": "10"}, {"key": "y", "name": "Yoshinobu Yamamoto"},
                                            {"key": "x", "name": "Freddie Freeman"}]}
        view = slip_games.mlb_view(self.game(), self.box(), item, {})
        self.assertEqual((view["state"], view["detail"], view["period"]), ("in", "Top 5th", 5))
        ohtani = view["players"]["o"]
        self.assertEqual((ohtani["spot"], ohtani["line"]["batting"]["hits"]), (1, 2))
        self.assertEqual(view["players"]["y"]["line"]["pitching"]["strikeOuts"], 6)
        self.assertIsNone(view["players"]["x"])
        self.assertTrue(view["lineups"]["LAD"]["confirmed"])
        self.assertFalse(view["lineups"]["ATL"]["confirmed"])
        self.assertEqual(view["starters"]["ATL"]["name"], "Chris Sale")

    def test_before_the_lineup_is_posted(self):
        view = slip_games.mlb_view(self.game("Preview", "Scheduled"), self.box(posted=False), {"sport": "mlb", "players": [{"key": "o", "name": "Shohei Ohtani"}]}, {})
        self.assertEqual(view["state"], "pre")
        self.assertFalse(view["lineups"]["LAD"]["confirmed"])
        self.assertIsNone(view["players"]["o"])

    def test_postponed(self):
        view = slip_games.mlb_view(self.game("Final", "Postponed"), self.box(), {"sport": "mlb", "players": []}, {})
        self.assertTrue(view["off"])


class SoccerTests(unittest.TestCase):
    def test_live_lines_and_lineups(self):
        home = [soccer_samples.roster_entry("1", "Bukayo Saka", "RW", True, {"totalShots": 3, "shotsOnTarget": 2})]
        away = [soccer_samples.roster_entry("2", "Robert Sanchez", "G", True, {"saves": 4})]
        summary = soccer_samples.summary("55", "2026-10-04T14:00Z", soccer_samples.ARS, soccer_samples.CHE, 1, 0, home, away, completed=False)
        summary["header"]["competitions"][0]["status"] = {"type": {"state": "in", "shortDetail": "67'", "name": "STATUS_SECOND_HALF"}}
        view = slip_games.soccer_view(summary, {"sport": "soccer", "eventId": "55", "players": [{"key": "s", "name": "Bukayo Saka"}]})
        self.assertEqual(view["state"], "in")
        self.assertEqual(view["players"]["s"]["line"]["s"]["shots"], 3)
        self.assertTrue(view["lineups"]["359"]["confirmed"])


if __name__ == "__main__":
    unittest.main()
