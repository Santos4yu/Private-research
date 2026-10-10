"""The Finder's NFL player page research (backend/sports/nfl/finder.py)."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.sports.nfl import finder  # noqa: E402


def game(game_id, season, week, day, away, home, away_score="", home_score="", game_type="REG", **extra):
    return {"game_id": game_id, "season": str(season), "week": str(week), "game_type": game_type, "gameday": day,
            "gametime": "13:00", "away_team": away, "home_team": home, "away_score": str(away_score),
            "home_score": str(home_score), **extra}


def stat(player_id, game_id, team, opponent, position="WR", group="WR", season_type="REG", **values):
    row = {"player_id": player_id, "player_display_name": player_id.upper(), "position": position,
           "position_group": group, "game_id": game_id, "team": team, "opponent_team": opponent,
           "season_type": season_type, "headshot_url": ""}
    for key in ("passing_yards", "passing_tds", "passing_interceptions", "rushing_yards", "rushing_tds",
                "receiving_yards", "receptions", "receiving_tds", "fumbles_lost_total", "passing_2pt_conversions",
                "rushing_2pt_conversions", "receiving_2pt_conversions", "special_teams_tds", "fumble_recovery_tds",
                "def_tds", "attempts", "completions", "carries", "targets"):
        row[key] = "0"
    row.update({key: str(value) for key, value in values.items()})
    return row


def indexed(rows):
    with patch.object(finder, "schedule_rows", return_value=rows):
        return finder.games_index()


class NoCache:
    """Run every loader directly, so each test sees its own data."""
    def __enter__(self):
        self.patch = patch.object(finder, "cached_nfl", side_effect=lambda _domain, _parts, loader, **_: loader())
        self.patch.start()
        # No ESPN preseason lookups (test_nfl_preseason.py covers those).
        self.ids = patch.object(finder, "espn_ids", return_value={})
        self.ids.start()

    def __exit__(self, *exc):
        self.patch.stop()
        self.ids.stop()


class GamesTests(unittest.TestCase):
    def test_team_view_scores_from_each_side(self):
        games = indexed([game("2026_01_PIT_CLE", 2026, 1, "2026-09-13", "PIT", "CLE", 20, 13)])
        g = games["2026_01_PIT_CLE"]
        self.assertEqual((finder.team_view(g, "PIT")["result"], finder.team_view(g, "PIT")["score"]), ("W", "20-13"))
        self.assertEqual((finder.team_view(g, "CLE")["result"], finder.team_view(g, "CLE")["isHome"]), ("L", True))

    def test_kickoff_is_eastern_time(self):
        september = finder._starts_at({"gameday": "2026-09-13", "gametime": "13:00"})
        december = finder._starts_at({"gameday": "2026-12-13", "gametime": "13:00"})
        from datetime import datetime, timezone
        self.assertEqual(datetime.fromtimestamp(september, timezone.utc).hour, 17)  # EDT
        self.assertEqual(datetime.fromtimestamp(december, timezone.utc).hour, 18)   # EST


class PlayerLogTests(unittest.TestCase):
    def test_missed_games_between_appearances_are_dnp(self):
        schedule = [game(f"2026_0{w}_PIT_X{w}", 2026, w, f"2026-09-{10 + w}", "PIT", f"X{w}", 20, 10) for w in range(1, 5)]
        rows = [stat("p1", "2026_01_PIT_X1", "PIT", "X1", receiving_yards=40, receptions=4, targets=6),
                stat("p1", "2026_03_PIT_X3", "PIT", "X3", receiving_yards=12, receptions=1, targets=2)]
        with NoCache(), patch.object(finder, "schedule_rows", return_value=schedule), \
                patch.object(finder, "player_rows", side_effect=lambda year: rows if year == 2026 else []):
            log = finder.player_log(2026, "p1")
        self.assertEqual([(row["week"], row["dnp"]) for row in log["rows"]], [(1, False), (2, True), (3, False), (4, True)])
        self.assertEqual(log["rows"][0]["values"]["receiving_yards"], 40)
        self.assertEqual(log["rows"][0]["values"]["rushing_receiving_yards"], 40)

    def test_last_season_stops_at_his_last_game(self):
        schedule = [game(f"2025_0{w}_PIT_X{w}", 2025, w, f"2025-09-{10 + w}", "PIT", f"X{w}", 20, 10) for w in range(1, 4)]
        rows = [stat("p1", "2025_01_PIT_X1", "PIT", "X1", targets=1)]
        with NoCache(), patch.object(finder, "schedule_rows", return_value=schedule), \
                patch.object(finder, "player_rows", side_effect=lambda year: rows if year == 2025 else []):
            log = finder.player_log(2026, "p1")
        self.assertEqual([row["dnp"] for row in log["rows"]], [False])


class PlayByPlayTests(unittest.TestCase):
    def play(self, **values):
        base = {"game_id": "g1", "season_type": "REG", "posteam": "PIT", "defteam": "CLE", "play_type": "pass",
                "yardline_100": "50", "pass_attempt": "0", "sack": "0", "complete_pass": "0", "receiver_player_id": "",
                "receiving_yards": "", "rush_attempt": "0", "rusher_player_id": "", "rushing_yards": "", "two_point_attempt": "0"}
        return base | {key: str(value) for key, value in values.items()}

    def test_red_zone_targets_and_longest_plays(self):
        plays = [
            self.play(pass_attempt=1, receiver_player_id="w1", yardline_100=12),  # RZ target, incomplete
            self.play(pass_attempt=1, receiver_player_id="w1", complete_pass=1, receiving_yards=30),
            self.play(pass_attempt=1, receiver_player_id="w2", complete_pass=1, receiving_yards=12),
            self.play(pass_attempt=1, sack=1, receiver_player_id="w2", yardline_100=5),  # a sack is no target
            self.play(play_type="run", rush_attempt=1, rusher_player_id="r1", rushing_yards=22),
            self.play(pass_attempt=1, receiver_player_id="w1", yardline_100=3, two_point_attempt=1),  # 2-pt: ignored
        ]
        result = finder._aggregate_pbp(plays)
        self.assertEqual(result["players"]["w1"]["g1"]["rzTargets"], 1)
        self.assertEqual(result["players"]["w1"]["g1"]["longestReception"], 30)
        self.assertEqual(result["players"]["r1"]["g1"]["longestRush"], 22)
        team = result["teams"]["PIT"]["g1"]
        # Longest Reception adds up each receiver's longest catch; Longest
        # Completion is the single longest pass.
        self.assertEqual((team["longestReception"], team["longestCompletion"], team["rzTargets"]), (42, 30, 1))


class LeagueTests(unittest.TestCase):
    def test_ranks_offense_high_first_and_defense_low_first(self):
        values = {"A": 10.0, "B": 30.0, "C": 30.0, "D": None}
        self.assertEqual(finder._rank(values, reverse=True), {"A": 3, "B": 1, "C": 1, "D": None})
        ranked = finder._ranked({"A": {"off": {"x": 10}, "def": {"x": 5}}, "B": {"off": {"x": 20}, "def": {"x": 9}}}, ["x"])
        self.assertEqual((ranked["B"]["off"]["x"], ranked["A"]["def"]["x"]), ([20, 1], [5, 1]))

    def test_defense_vs_position_is_what_the_group_gets_a_game(self):
        schedule = [game("2026_01_PIT_CLE", 2026, 1, "2026-09-13", "PIT", "CLE", 20, 13),
                    game("2026_02_CLE_BAL", 2026, 2, "2026-09-20", "BAL", "CLE", 17, 10)]
        games = indexed(schedule)
        rows = [stat("w1", "2026_01_PIT_CLE", "PIT", "CLE", targets=8, receiving_yards=90, receptions=6),
                stat("w2", "2026_01_PIT_CLE", "PIT", "CLE", targets=2, receiving_yards=10, receptions=1),
                # A receiver who only returned punts adds nothing.
                stat("w3", "2026_01_PIT_CLE", "PIT", "CLE", punt_returns=3),
                stat("w4", "2026_02_CLE_BAL", "BAL", "CLE", targets=5, receiving_yards=40, receptions=4),
                # Baltimore's tight end isn't a receiver here.
                stat("t1", "2026_02_CLE_BAL", "BAL", "CLE", position="TE", group="TE", targets=4, receiving_yards=30, receptions=3)]
        dvp = finder._dvp(rows, games)
        wr = dvp["CLE"]["WR"]
        # The receivers' yards added up each game (100, then 40), averaged.
        self.assertEqual(wr["stats"]["receiving_yards"]["szn"], [70.0, 1])
        self.assertEqual(wr["stats"]["receptions"]["szn"][0], 5.5)
        self.assertEqual((wr["games"], wr["players"]), (2, 4))
        # Cleveland faced no tight end in week 1: a zero that game.
        self.assertEqual(dvp["CLE"]["TE"]["stats"]["receiving_yards"]["szn"][0], 15.0)
        # The last five is the same two games here.
        self.assertEqual(wr["stats"]["receiving_yards"]["l5"][0], 70.0)

    def test_standings_record_streak_and_games_back(self):
        schedule = [game("2026_01_PIT_CLE", 2026, 1, "2026-09-13", "PIT", "CLE", 20, 13),
                    game("2026_02_PIT_BAL", 2026, 2, "2026-09-20", "PIT", "BAL", 24, 17),
                    game("2026_02_CLE_CIN", 2026, 2, "2026-09-20", "CLE", "CIN", 10, 7)]
        groups, entries = finder._standings(indexed(schedule), 2026, {})
        self.assertEqual((entries["PIT"]["record"], entries["PIT"]["streak"]), ("2-0", "W2"))
        afc = {entry["abbr"]: entry for entry in groups[0]["entries"]}
        self.assertEqual((afc["PIT"]["gb"], afc["CLE"]["gb"], afc["CLE"]["pct"]), ("-", "1", "0.500"))


class MatchupTests(unittest.TestCase):
    def test_spread_signs_and_no_vig_win_chance(self):
        schedule = [game("2026_04_PIT_CLE", 2026, 4, "2026-10-01", "PIT", "CLE", away_moneyline="-142",
                         home_moneyline="120", spread_line="-2.5", total_line="38.5", over_odds="-105", under_odds="-115")]
        with NoCache(), patch.object(finder, "schedule_rows", return_value=schedule), patch.object(finder, "team_names", return_value={}):
            result = finder.matchup(2026, "2026_04_PIT_CLE")
        odds = result["odds"]
        # spread_line is the home team's edge: -2.5 means the away team gives 2.5.
        self.assertEqual((odds["away"]["spread"], odds["home"]["spread"]), (-2.5, 2.5))
        self.assertAlmostEqual(odds["noVig"]["away"] + odds["noVig"]["home"], 100)
        self.assertGreater(odds["noVig"]["away"], 50)
        self.assertEqual([team["side"] for team in result["teams"]], ["away", "home"])


class PlayerContextTests(unittest.TestCase):
    def test_with_and_without_a_teammate(self):
        schedule = [game(f"2026_0{w}_PIT_X{w}", 2026, w, f"2026-09-{10 + w}", "PIT", f"X{w}", 20, 10) for w in range(1, 4)]
        rows = [stat("me", f"2026_0{w}_PIT_X{w}", "PIT", f"X{w}", targets=5, receiving_yards=yards)
                for w, yards in ((1, 80), (2, 20), (3, 60))]
        rows += [stat("te", f"2026_0{w}_PIT_X{w}", "PIT", f"X{w}", position="TE", group="TE", targets=3) for w in (1, 3)]
        with NoCache(), patch.object(finder, "schedule_rows", return_value=schedule), \
                patch.object(finder, "player_rows", side_effect=lambda year: rows if year == 2026 else []):
            context = finder.player_context(2026, "me", "PIT", "CLE", "receiving_yards", 50.5)
        teammate = next(item for item in context["withWithout"] if item["id"] == "te")
        self.assertEqual((teammate["with"]["games"], teammate["with"]["avg"], teammate["with"]["hits"]), (2, 70, 2))
        self.assertEqual((teammate["without"]["games"], teammate["without"]["hits"], teammate["without"]["misses"]), (1, 0, 1))
        self.assertEqual(teammate["without"]["gameIds"], ["2026_02_PIT_X2"])


class RouteTests(unittest.TestCase):
    def call(self, path):
        import importlib.util
        spec = importlib.util.spec_from_file_location("api_nfl_finder", Path(__file__).resolve().parents[1] / "api/nfl.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        sent = {}
        handler = module.handler.__new__(module.handler)
        handler.path, handler.headers = path, {}
        with patch.object(module, "session_with_live_access", return_value=True), \
                patch("site_controls.finder_sport_allowed", return_value=True), \
                patch.object(module, "send_json", side_effect=lambda _h, status, body: sent.update(status=status, body=body)):
            handler._get()
        return sent

    def test_rejects_unverified_identities(self):
        self.assertEqual(self.call("/api/nfl?resource=finder-log&season=2026&playerId=abc")["status"], 400)
        self.assertEqual(self.call("/api/nfl?resource=finder-team&season=2026&team=pit1")["status"], 400)
        self.assertEqual(self.call("/api/nfl?resource=finder-matchup&season=2026&gameId=nope")["status"], 400)
        self.assertEqual(self.call("/api/nfl?resource=finder-player&season=2026&playerId=00-0035640&team=PIT"
                                   "&opponent=CLE&market=nope")["status"], 400)

    def test_finder_switch_gates_the_resources(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location("api_nfl_gate", Path(__file__).resolve().parents[1] / "api/nfl.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        sent = {}
        handler = module.handler.__new__(module.handler)
        handler.path, handler.headers = "/api/nfl?resource=finder-league&season=2026", {}
        with patch.object(module, "session_with_live_access", return_value=True), \
                patch("site_controls.finder_sport_allowed", return_value=False) as gate, \
                patch.object(module, "send_json", side_effect=lambda _h, status, body: sent.update(status=status, body=body)):
            handler._get()
        gate.assert_called_once()
        self.assertEqual(sent["status"], 503)


if __name__ == "__main__":
    unittest.main()
