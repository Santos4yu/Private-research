import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from backend.sports.nfl.domain import (
    DataStatus, NFLGame, NFLPlayerRef, NFLPosition, NFLProp, NFLPropKey,
    NFLPropLine, NFLTeamRef, SourcedValue,
)
from backend.sports.nfl.props import props_for_position
from backend.sports.nfl.research import build_research_result
from backend.sports.nfl.cache import NFLCacheDomain, nfl_cache_key
from backend.sports.nfl.cache import clear_nfl_cache
from backend.sports.nfl.identity import normalized_name, resolve_player
from backend.sports.nfl.services import nflverse


class NFLFoundationTests(unittest.TestCase):
    def tearDown(self):
        clear_nfl_cache()

    def test_missing_data_cannot_silently_become_zero(self):
        with self.assertRaises(ValueError):
            SourcedValue(DataStatus.MISSING, 0, "test", None, datetime.now(timezone.utc))

    def test_prop_registry_is_position_specific(self):
        qb = {item.key for item in props_for_position(NFLPosition.QB)}
        wr = {item.key for item in props_for_position(NFLPosition.WR)}
        self.assertIn(NFLPropKey.PASSING_YARDS, qb)
        self.assertNotIn(NFLPropKey.PASSING_YARDS, wr)
        self.assertIn(NFLPropKey.TARGETS, wr)

    def test_unimplemented_engine_returns_not_available(self):
        now = datetime.now(timezone.utc)
        player = NFLPlayerRef("p1", "Player", NFLPosition.QB, "t1")
        home = NFLTeamRef("t1", "HOM", "Home")
        away = NFLTeamRef("t2", "AWY", "Away")
        game = NFLGame("g1", 2026, "REG", 1, now, "SCHEDULED", home, away)
        prop = NFLProp("prop1", player, game.id, NFLPropKey.PASSING_YARDS, "Passing Yards",
                       (NFLPropLine(250.5, "OVER", "test", now),), "test", now)
        result = build_research_result(player=player, game=game, prop=prop, missing=("usage",))
        self.assertEqual(DataStatus.NOT_AVAILABLE, result.status)
        self.assertIsNone(result.projection.mean)
        self.assertIsNone(result.confidence)
        self.assertEqual("NOT_AVAILABLE", result.verdict)

    def test_cache_keys_are_nfl_namespaced(self):
        key = nfl_cache_key(NFLCacheDomain.GAME_LOGS, 2026, "player-1")
        self.assertEqual("krazy_data:nfl:v1:game_logs:2026:player-1", key)
        self.assertNotIn("mlb", key)

    def test_team_aliases_are_canonical(self):
        self.assertEqual("JAX", nflverse.canonical_team("JAC"))
        self.assertEqual("LAR", nflverse.canonical_team("LA"))
        self.assertEqual("WAS", nflverse.canonical_team("WSH"))

    def test_player_identity_prefers_stable_ids_and_handles_suffixes(self):
        player = nflverse.NFLPlayer("00-1", "John Smith Jr.", NFLPosition.WR, "JAX", "John", "Smith", "ACT",
                                    source_ids={"espn_id": "42"})
        self.assertEqual("john smith", normalized_name("John Smith, Jr."))
        self.assertIs(player, resolve_player([player], provider="espn_id", player_id="42"))
        self.assertIs(player, resolve_player([player], name="John Smith", team_id="JAC"))

    def test_game_log_preserves_zero_and_marks_missing_as_none(self):
        row = {
            "player_id": "00-1", "player_display_name": "Player", "position": "QB",
            "season_type": "REG", "game_id": "2026_01_JAX_WAS", "season": "2026", "week": "1",
            "team": "WSH", "opponent_team": "JAC", "completions": "0", "attempts": "0",
            "passing_yards": "", "passing_tds": "0", "passing_interceptions": "0",
            "carries": "1", "rushing_yards": "-1", "rushing_tds": "0", "targets": "",
            "receptions": "", "receiving_yards": "", "receiving_tds": "",
            "target_share": "", "air_yards_share": "", "fantasy_points": "-0.1", "fantasy_points_ppr": "-0.1",
        }
        with patch.object(nflverse, "_fetch_csv", return_value=([row], datetime.now(timezone.utc), None)):
            result = nflverse.game_logs(2026, "00-1")
        self.assertEqual(DataStatus.AVAILABLE, result.status)
        self.assertEqual(0, result.data[0].stats["attempts"])
        self.assertIsNone(result.data[0].stats["passing_yards"])
        self.assertEqual(-1, result.data[0].stats["rushing_yards"])
        self.assertTrue(result.data[0].is_home)
        self.assertEqual("WAS", result.data[0].team_id)
        self.assertEqual("JAX", result.data[0].opponent_team_id)

    def test_season_type_is_never_mixed(self):
        base = {
            "player_id": "00-1", "player_display_name": "Player", "position": "RB",
            "team": "BUF", "opponent_team": "MIA", "completions": "0", "attempts": "0",
            "passing_yards": "0", "passing_tds": "0", "passing_interceptions": "0",
            "carries": "1", "rushing_yards": "3", "rushing_tds": "0", "targets": "0",
            "receptions": "0", "receiving_yards": "0", "receiving_tds": "0",
            "target_share": "0", "air_yards_share": "0", "fantasy_points": "0.3", "fantasy_points_ppr": "0.3",
        }
        rows = [{**base, "season_type": "PRE", "game_id": "2026_01_MIA_BUF", "week": "1"},
                {**base, "season_type": "REG", "game_id": "2026_02_MIA_BUF", "week": "2"}]
        with patch.object(nflverse, "_fetch_csv", return_value=(rows, datetime.now(timezone.utc), None)):
            result = nflverse.game_logs(2026, "00-1", "REG")
        self.assertEqual([2], [game.week for game in result.data])

    def test_malformed_player_stat_record_is_rejected(self):
        row = {
            "player_id": "00-1", "player_display_name": "Player", "position": "QB", "season_type": "REG",
            "game_id": "2026_01_MIA_BUF", "week": "1", "team": "BUF", "opponent_team": "MIA",
            "completions": "4", "attempts": "3", **{key: "0" for key in nflverse.PLAYER_STAT_FIELDS if key not in {"completions", "attempts"}},
        }
        with patch.object(nflverse, "_fetch_csv", return_value=([row], datetime.now(timezone.utc), None)):
            result = nflverse.game_logs(2026, "00-1")
        self.assertEqual([], result.data)

    def test_rate_limit_is_explicit_and_not_zero_fallback(self):
        with patch.object(nflverse, "_fetch_csv", side_effect=nflverse.ProviderRateLimited("limited")):
            result = nflverse.players(2099)
        self.assertEqual(DataStatus.UNRELIABLE, result.status)
        self.assertIsNone(result.data)

    def test_injury_normalization_keeps_absent_status_missing(self):
        row = {"week": "1", "gsis_id": "00-1", "full_name": "Player", "team": "JAC", "position": "WR",
               "season_type": "REG", "report_primary_injury": "Hamstring", "report_status": "",
               "practice_primary_injury": "", "practice_status": "Limited Participation in Practice"}
        with patch.object(nflverse, "_fetch_csv", return_value=([row], datetime.now(timezone.utc), None)):
            result = nflverse.injuries(2026, 1)
        self.assertEqual("JAX", result.data[0].team_id)
        self.assertIsNone(result.data[0].game_status)
        self.assertEqual("Limited Participation in Practice", result.data[0].practice_status)

    def test_schedule_normalizes_phase_week_teams_and_time(self):
        row = {"game_id": "2026_01_JAC_LA", "season": "2026", "game_type": "REG", "week": "1",
               "gameday": "2026-09-10", "gametime": "20:20", "away_team": "JAC", "home_team": "LA",
               "away_score": "", "home_score": "", "stadium": "Test Stadium", "roof": "outdoors",
               "temp": "72", "wind": "8"}
        with patch.object(nflverse, "_fetch_csv", return_value=([row], datetime.now(timezone.utc), None)):
            result = nflverse.schedule(2026, 1, "REG")
        game = result.data[0]
        self.assertEqual("JAX", game.away_team.id)
        self.assertEqual("LAR", game.home_team.id)
        self.assertEqual("REG", game.season_type)
        self.assertEqual(1, game.week)
        self.assertEqual("SCHEDULED", game.status)
        self.assertEqual(timezone.utc, game.starts_at.tzinfo)
        self.assertEqual(72, game.temperature_f)
        self.assertEqual(8, game.wind_mph)
        self.assertIsNone(game.precipitation_probability)

    def test_depth_chart_returns_only_latest_snapshot(self):
        rows = [
            {"dt": "2026-09-10T12:00:00Z", "team": "BUF", "player_name": "Old", "gsis_id": "00-1",
             "pos_abb": "WR", "pos_name": "Wide Receiver", "pos_rank": "1"},
            {"dt": "2026-09-11T12:00:00Z", "team": "BUF", "player_name": "Current", "gsis_id": "00-2",
             "pos_abb": "WR", "pos_name": "Wide Receiver", "pos_rank": "1"},
        ]
        with patch.object(nflverse, "_fetch_csv", return_value=(rows, datetime.now(timezone.utc), None)):
            result = nflverse.depth_chart(2026, "BUF")
        self.assertEqual(["Current"], [entry.player_name for entry in result.data])


if __name__ == "__main__":
    unittest.main()
