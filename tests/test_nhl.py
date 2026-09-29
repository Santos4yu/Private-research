"""The Finder's NHL lines and research (nhl_board.py, nhl_research.py)."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import nhl_board  # noqa: E402
import nhl_research as nhl  # noqa: E402
from tests import nhl_samples as s  # noqa: E402


def record():
    return nhl.parse_game(s.box(), s.pbp())


class StrengthTests(unittest.TestCase):
    def test_situation_codes(self):
        self.assertEqual(nhl._strength("1451", True), "pp")    # four away skaters: home power play
        self.assertEqual(nhl._strength("1451", False), "sh")   # the away team scoring shorthanded
        self.assertEqual(nhl._strength("1551", True), "ev")
        # A pulled goalie's extra attacker is not a power play...
        self.assertEqual(nhl._strength("0651", False), "ev")
        # ...unless the other side is also a man down.
        self.assertEqual(nhl._strength("0641", False), "pp")
        self.assertEqual(nhl._strength("1331", True), "ev")    # 3-on-3 overtime
        self.assertEqual(nhl._strength("", True), "ev")


class GameTests(unittest.TestCase):
    def test_box_score_lines(self):
        game = record()
        self.assertEqual((game["home"], game["away"], game["kind"], game["date"]), ("CAR", "FLA", "preseason", "2026-09-22"))
        staal = game["players"][str(s.STAAL)]
        self.assertEqual((staal["goals"], staal["sog"], staal["hits"], staal["blocked"], staal["toi"]), (1, 3, 4, 1, 17.38))
        self.assertEqual(staal["fullName"], "Jordan Staal")
        # The backup who never went in is not a line.
        self.assertNotIn("8480000", game["players"])

    def test_play_by_play_numbers(self):
        players = record()["players"]
        staal, aho, barkov = players[str(s.STAAL)], players[str(s.AHO)], players[str(s.BARKOV)]
        self.assertEqual((staal["fow"], staal["fol"], staal["faceoffs"]), (2, 1, 3))
        self.assertEqual((staal["goals_1p"], staal["points_1p"], staal["sog_1p"], staal["sog_3p"]), (1, 1, 2, 1))
        # The power-play goal and its assist; the empty-net goal against
        # FLA's extra attacker is even strength.
        self.assertEqual((staal["ppp"], aho["ppp"], aho["assists_1p"], aho["goals_3p"]), (1, 1, 1, 1))
        # Barkov's shorthanded goal and Ekblad's assist on it.
        self.assertEqual((barkov["shp"], players[str(s.EKBLAD)]["shp"], barkov["goals_2p"]), (1, 1, 1))
        # Shots on goal, missed and blocked.
        self.assertEqual(staal["attempts"], 3 + 1 + 1)
        self.assertEqual(staal["hits_blocks"], 5)

    def test_fantasy_score(self):
        players = record()["players"]
        # Staal: a goal (8), three shots on goal (4.5), a block (1.5).
        self.assertEqual(players[str(s.STAAL)]["fantasy"], 14.0)
        # Barkov: two goals (16), four shots (6) and a shorthanded point (2).
        self.assertEqual(players[str(s.BARKOV)]["fantasy"], 24.0)

    def test_goalie_lines(self):
        players = record()["players"]
        bobrovsky, andersen = players[str(s.BOBROVSKY)], players[str(s.ANDERSEN)]
        self.assertEqual((bobrovsky["saves"], bobrovsky["shots_against"], bobrovsky["ga"]), (27, 29, 2))
        # The empty-net goal was not on him.
        self.assertEqual((bobrovsky["ga_2p"], bobrovsky["saves_2p"], bobrovsky["ga_3p"]), (1, 0, 0))
        # First period: two shots faced, one of them the power-play goal at 5:12.
        self.assertEqual((bobrovsky["ga_1p"], bobrovsky["saves_1p"], bobrovsky["ga_first10"]), (1, 1, 1))
        self.assertEqual((andersen["win"], andersen["shutout"], andersen["saves_2p"]), (1, 0, 1))
        # 6 for the win, 23 saves at 0.6, two goals allowed at -3.
        self.assertEqual(andersen["fantasy"], round(6 + 23 * 0.6 - 6, 2))

    def test_game_is_kept_only_once_final(self):
        with patch.object(nhl, "_get", side_effect=lambda url: s.box(state="LIVE") if url.endswith("boxscore") else s.pbp()), \
                patch.object(nhl.store, "get", return_value=None), patch.object(nhl.store, "set") as saved:
            nhl._memory.clear()
            nhl.game("2026010030")
        saved.assert_not_called()


class BoardTests(unittest.TestCase):
    def games(self):
        return [{"id": "2026010060", "gameType": 1, "date": "2026-09-30", "start": "2026-09-30T23:00:00Z",
                 "home": "CAR", "away": "FLA", "state": "FUT"}]

    def rosters(self):
        players = {str(pid): {"name": f"{first} {last}", "first": first, "last": last, "pos": pos, "number": 11, "headshot": f"https://x/{pid}.png"}
                   for pid, first, last, pos in ((s.STAAL, "Jordan", "Staal", "C"), (s.AHO, "Sebastian", "Aho", "C"))}
        return {"CAR": players, "FLA": {}}

    def test_lines_find_their_game_and_player(self):
        lines = [s.projection("1", "Jordan Staal", "Shots On Goal", 2.5), s.projection("2", "Seb Aho", "Points", 0.5),
                 s.projection("3", "Someone New", "Hits", 1.5)]
        board = nhl_board.build(projections=lines, now=1_790_000_000, games=self.games(), rosters=self.rosters())
        rows = {row["player"]: row for row in board["rows"]}
        staal = rows["Jordan Staal"]
        self.assertEqual((staal["playerId"], staal["gameId"], staal["valueKey"], staal["isHome"]), (str(s.STAAL), "2026010060", "sog", True))
        self.assertEqual((staal["team"], staal["opponent"], staal["headshot"]), ("CAR", "FLA", f"https://x/{s.STAAL}"
                                                                                  ".png"))
        # First initial and last name on the same team.
        self.assertEqual(rows["Seb Aho"]["playerId"], str(s.AHO))
        self.assertIsNone(rows["Someone New"]["playerId"])

    def test_prizepicks_team_codes(self):
        lines = [s.projection("1", "Jordan Staal", "Goals", 0.5, team="CAR", opponent="TB")]
        games = [{"id": "9", "gameType": 2, "date": "2026-10-08", "start": "2026-09-30T23:30:00Z", "home": "TBL", "away": "CAR", "state": "FUT"}]
        row = nhl_board.build(projections=lines, now=1_790_000_000, games=games, rosters=self.rosters())["rows"][0]
        self.assertEqual((row["opponent"], row["gameId"], row["isHome"]), ("TBL", "9", False))

    def test_market_names(self):
        for stat, key in (("Shots On Goal", "sog"), ("Blocked Shots", "blocked"), ("Time On Ice", "toi"),
                          ("Faceoffs Won", "fow"), ("Power Play Points", "ppp"), ("Goalie Saves", "saves"),
                          ("Goals Allowed", "ga"), ("Fantasy Score", "fantasy"), ("1st Period Points", "points_1p"),
                          ("Goals Allowed in First 10 Minutes", "ga_first10"), ("Shots Blocked", "blocked"),
                          ("Goalie Fantasy Score", "fantasy")):
            self.assertEqual(nhl_board.value_key(stat), key, stat)
        self.assertIsNone(nhl_board.value_key("Something New"))


class TeamLogTests(unittest.TestCase):
    def setUp(self):
        nhl._memory.clear()

    def test_log_holds_the_teams_players_and_both_sides_totals(self):
        schedule = [{"id": "2026010030", "gameType": 1, "date": "2026-09-22", "start": None, "home": "CAR", "away": "FLA",
                     "homeScore": 3, "awayScore": 2, "lastPeriod": "REG", "final": True},
                    {"id": "2026010099", "gameType": 1, "date": "2026-10-01", "start": None, "home": "CAR", "away": "NSH",
                     "homeScore": None, "awayScore": None, "lastPeriod": "", "final": False}]
        with patch.object(nhl, "club_schedule", side_effect=lambda team, season: schedule if season == "20262027" else []), \
                patch.object(nhl, "game", return_value=record()), patch.object(nhl, "roster", return_value={}), \
                patch.object(nhl.store, "get", return_value=None), patch.object(nhl.store, "set"):
            log = nhl.team_log("CAR", "FLA", day=nhl.date(2026, 9, 29))
        self.assertEqual(len(log["games"]), 1)
        played = log["games"][0]
        self.assertEqual((played["opponent"], played["isHome"], played["result"], played["score"], played["seasonKind"]),
                         ("FLA", True, "W", "3-2", "preseason"))
        self.assertIn(str(s.STAAL), played["players"])
        self.assertNotIn(str(s.BARKOV), played["players"])
        self.assertEqual((played["totals"]["goals"], played["against"]["goals"], played["against"]["saves"]), (3, 2, 27))
        self.assertEqual(log["players"][str(s.STAAL)]["name"], "Jordan Staal")


class LeagueTests(unittest.TestCase):
    def setUp(self):
        nhl._memory.clear()

    def test_ranks_and_defense_by_position(self):
        schedule = [{"id": "2026010030", "gameType": 1, "date": "2026-09-22", "home": "CAR", "away": "FLA",
                     "homeScore": 3, "awayScore": 2, "final": True}]
        with patch.object(nhl, "finished_games", side_effect=lambda team, day=None: schedule if team in ("CAR", "FLA") else []), \
                patch.object(nhl, "game", return_value=record()), \
                patch.object(nhl.store, "get", return_value=None), patch.object(nhl.store, "set"):
            data = nhl.league()
        self.assertEqual(data["teamCount"], 2)
        car = data["teams"]["CAR"]
        # CAR's shots on goal: 3 + 2 + 1 from its skaters; FLA had 4 + 0.
        self.assertEqual(car["off"]["sog"]["l5"], [6, 1])
        self.assertEqual(data["teams"]["FLA"]["off"]["sog"]["l5"], [4, 2])
        # Defense: 1 allows the fewest.
        self.assertEqual(car["def"]["sog"]["l5"], [4, 1])
        # What FLA allowed to centers: Staal's goal and Aho's goal and assist.
        fla_c = data["dvp"]["FLA"]["C"]
        self.assertEqual(fla_c["goals"]["l5"][0], 2)
        self.assertEqual(fla_c["points"]["l5"][0], 3)


if __name__ == "__main__":
    unittest.main()
