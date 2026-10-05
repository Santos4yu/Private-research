"""The Slip Analyzer's player lookups: a slip's pick whose player is off the
board (his game has started) is found by name in his league -- NFL, NBA and
WNBA, NHL -- so it can still be graded from his games. No network."""
import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from backend.sports.nfl import finder, prizepicks_board
import nhl_research

_spec = importlib.util.spec_from_file_location("wnba_api_lookup", Path(__file__).resolve().parents[1] / "api" / "wnba.py")
wnba = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(wnba)


class NFLLookup(unittest.TestCase):
    def setUp(self):
        kickoff = datetime(2026, 10, 4, 17, tzinfo=timezone.utc)
        self.now = datetime(2026, 10, 4, 19, tzinfo=timezone.utc).timestamp()  # the game is on
        self.games = {"2026_05_IND_LV": {"game_id": "2026_05_IND_LV", "home": "LV", "away": "IND", "final": False,
                                         "kickoff": kickoff.timestamp()}}
        self.roster = [{"gsis_id": "00-1", "full_name": "Josh Downs", "team": "IND", "position": "WR", "espn_id": "4688813"},
                       {"gsis_id": "00-2", "full_name": "D'Andre Swift", "team": "CHI", "position": "RB", "espn_id": "1"}]
        self.history = {"00-1": [{"opponent": "TEN", "date": f"2026-09-{day:02d}", "values": {"receiving_yards": value, "targets": 7}}
                                 for day, value in zip((7, 14, 21, 28), (80, 64, 90, 75))],
                        "00-2": [{"opponent": "GB", "values": {"targets": value}} for value in (3, 2, 4)]}

    def lookup(self, *args):
        with patch.object(finder, "games_index", return_value=self.games), \
                patch.object(finder, "roster_rows", side_effect=lambda year: self.roster if year == 2026 else []), \
                patch.object(finder, "game_values", side_effect=lambda _season, pid, cached=True: self.history[pid]):
            return prizepicks_board.lookup(2026, *args, now=self.now)

    def test_a_started_game_still_finds_the_player_and_his_history(self):
        row = self.lookup("Josh Downs", None, "Rec Yards", "71.5")
        self.assertEqual((row["playerId"], row["teamId"], row["opponentId"], row["propType"]), ("00-1", "IND", "LV", "receiving_yards"))
        self.assertEqual(row["line"]["value"], 71.5)
        self.assertEqual(row["windows"]["l5"]["hits"], 3)
        self.assertEqual([game["value"] for game in row["gameLog"]], [80, 64, 90, 75])
        self.assertIn("4688813", row["headshot"])
        self.assertEqual(row["event"]["gameId"], "2026_05_IND_LV")
        self.assertEqual(row["apps"], [])

    def test_apostrophes_initials_and_rec_targets(self):
        row = self.lookup("DAndre Swift", "CHI", "Rec Targets", 2.5)
        self.assertEqual((row["playerId"], row["propType"]), ("00-2", "targets"))
        self.assertEqual(row["windows"]["l5"]["hits"], 2)
        self.assertEqual(self.lookup("J. Downs", None, "Receiving Yards", 60.5)["playerId"], "00-1")

    def test_unknown_player_or_stat(self):
        self.assertIsNone(self.lookup("Nobody Atall", None, "Rec Yards", 10.5))
        row = self.lookup("Josh Downs", None, "Receiving Air Yards", 60.5)
        self.assertEqual(row["windows"], {})
        self.assertEqual(row["propLabel"], "Receiving Air Yards")


class BasketballLookup(unittest.TestCase):
    DIRECTORY = {"players": {
        "stephen curry": [{"id": "3975", "name": "Stephen Curry", "teamAbbr": "GS", "team": "Golden State Warriors", "headshot": "c.png"}],
        "jalen williams": [{"id": "1", "name": "Jalen Williams", "teamAbbr": "OKC"}, {"id": "2", "name": "Jalen Williams", "teamAbbr": "PHX"}],
    }, "teams": {}}

    def find(self, *args):
        with patch.object(wnba, "_roster_directory", return_value=self.DIRECTORY):
            return wnba._find(*args)

    def test_name_team_and_initials(self):
        self.assertEqual(self.find("Stephen Curry", "", "nba")["id"], "3975")
        self.assertEqual(self.find("S. Curry", "", "nba")["id"], "3975")
        self.assertEqual(self.find("Jalen Williams", "PHX", "nba")["id"], "2")
        # Two of one name and no team: no guess.
        self.assertIsNone(self.find("Jalen Williams", "", "nba"))
        self.assertIsNone(self.find("Nobody Atall", "", "nba"))


class NHLLookup(unittest.TestCase):
    DIRECTORY = {"8478402": {"name": "Connor McDavid", "team": "EDM", "pos": "C", "season": "20252026"},
                 "8479318": {"name": "Auston Matthews", "team": "TOR", "pos": "C", "season": "20252026"}}

    def test_found_with_or_without_a_team(self):
        with patch.object(nhl_research, "directory", return_value=self.DIRECTORY):
            row, = nhl_research.find("Connor McDavid")
            self.assertEqual((row["playerId"], row["team"], row["position"]), ("8478402", "EDM", "C"))
            self.assertIn("8478402", row["headshot"])
            self.assertEqual(nhl_research.find("A. Matthews")[0]["playerId"], "8479318")
            self.assertEqual(nhl_research.find("Connor McDavid", "EDM")[0]["playerId"], "8478402")
            self.assertEqual(nhl_research.find("Nobody Atall"), [])


if __name__ == "__main__":
    unittest.main()
