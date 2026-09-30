"""Tennis Finder board, access switch, and PrizePicks slip export."""
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import prizepicks_export_core as export  # noqa: E402
import tennis_board  # noqa: E402
from tests.test_prizepicks_export import FakePrizePicks, player, projection  # noqa: E402

NOW = datetime.fromisoformat("2026-09-30T12:00:00+00:00").timestamp()


def tennis_projection(pid, player_id, stat, line, start="2026-09-30T19:00:00Z", **kwargs):
    row = projection(pid, "5", player_id, stat, line, **kwargs)
    row["attributes"].update(start_time=start, description="Aryna Sabalenka")
    return row


FEED = {"data": [
    tennis_projection("t1", "p1", "Aces", 4.5),
    tennis_projection("t2", "p1", "A Brand New Stat", 2.5, odds_type="goblin", wagers="over"),
    tennis_projection("t3", "p2", "Double Faults", 3.5),
    tennis_projection("old", "p1", "Games Won", 11.5, start="2026-09-30T10:00:00Z"),
], "included": [player("p1", "Iga Swiatek", "TENNIS"), player("p2", "Aryna Sabalenka", "TENNIS")]}
LEAGUES = {"data": [{"id": "5", "type": "league", "attributes": {"name": "TENNIS"}}]}


class TennisBoardTests(unittest.TestCase):
    def setUp(self):
        export._PROJECTION_CACHE.clear()
        export._LEAGUE_CACHE.clear()
        tennis_board._cache.update(at=0.0, value=None)

    def test_every_upcoming_stat_is_kept_without_an_allowlist(self):
        fake = FakePrizePicks(leagues=LEAGUES, feeds={"5": FEED})
        with patch.object(export.requests, "get", side_effect=fake):
            result = tennis_board.build(now=NOW)
        self.assertEqual([(row["stat"], row["line"], row["modifier"]) for row in result["rows"]], [
            ("Double Faults", 3.5, "standard"), ("A Brand New Stat", 2.5, "goblin"),
            ("Aces", 4.5, "standard"),
        ])
        self.assertEqual(result["rows"][2]["opponent"], "Aryna Sabalenka")

    def test_tennis_picks_export_on_the_current_prizepicks_lines(self):
        fake = FakePrizePicks(leagues=LEAGUES, feeds={"5": FEED})
        with patch.object(export.requests, "get", side_effect=fake):
            status, body = export.build_export([
                {"league": "TENNIS", "player": "Iga Swiatek", "stat": "Aces", "line": 4.5, "side": "under"},
                {"league": "TENNIS", "player": "Aryna Sabalenka", "stat": "Double Faults", "line": 3.5, "side": "over"},
            ])
        self.assertEqual(status, 200, body)
        self.assertEqual([item["projectionId"] for item in body["matches"]], ["t1", "t3"])


class TennisRouteTests(unittest.TestCase):
    def test_route_obeys_the_tennis_admin_switch(self):
        from api import board as board_api
        request = object.__new__(board_api.handler)
        request.path, request.headers = "/api/board?view=tennis", {}
        sent = []
        request._send = lambda status, payload: sent.append((status, payload))
        with patch("site_controls.allowed", return_value=True) as tab_gate, \
             patch("site_controls.finder_sport_allowed", return_value=False) as sport_gate, \
             patch.object(board_api, "session_with_live_access", return_value=True):
            request.do_GET()
        self.assertEqual(sent[0], (503, {"error": "This section is temporarily unavailable", "featureDisabled": True}))
        self.assertEqual(tab_gate.call_args.args[1], "finder")
        self.assertEqual(sport_gate.call_args.args[1], "tennis")


if __name__ == "__main__":
    unittest.main()
