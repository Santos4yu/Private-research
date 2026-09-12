import unittest
from datetime import datetime, timezone

from backend.sports.nfl.domain import (
    DataStatus, NFLGame, NFLPlayerRef, NFLPosition, NFLProp, NFLPropKey,
    NFLPropLine, NFLTeamRef, SourcedValue,
)
from backend.sports.nfl.props import props_for_position
from backend.sports.nfl.research import build_research_result
from backend.sports.nfl.cache import NFLCacheDomain, nfl_cache_key


class NFLFoundationTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
