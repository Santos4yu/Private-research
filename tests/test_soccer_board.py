"""Soccer in the Finder: PrizePicks' soccer lines, the board route and export."""
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import prizepicks_export_core as export  # noqa: E402
import soccer_board  # noqa: E402
from tests.test_prizepicks_export import FakePrizePicks, player, projection  # noqa: E402

NOW = datetime.fromisoformat("2026-09-28T12:00:00+00:00").timestamp()


def soccer_projection(pid, player_id, stat, line, start="2026-09-28T19:00:00Z", **kwargs):
    row = projection(pid, "82", player_id, stat, line, **kwargs)
    row["attributes"].update(start_time=start, description="CHE")
    return row


SOCCER_FEED = {
    "data": [
        soccer_projection("5001", "s1", "Shots On Target", 1.5),
        soccer_projection("5002", "s1", "Shots On Target", 0.5, odds_type="goblin", wagers="over"),
        soccer_projection("5003", "s2", "Goalie Saves", 3.5),
        # Already kicked off, and a two-player combo line: neither is shown.
        soccer_projection("5004", "s1", "Shots", 2.5, start="2026-09-28T11:00:00Z"),
        soccer_projection("5005", "s3", "Shots", 4.5),
    ],
    "included": [
        {**player("s1", "Bukayo Saka", "SOCCER"), "attributes": {"display_name": "Bukayo Saka", "league": "SOCCER", "team": "ARS", "position": "M"}},
        {**player("s2", "David Raya", "SOCCER"), "attributes": {"display_name": "David Raya", "league": "SOCCER", "team": "ARS", "position": "GK"}},
        {**player("s3", "Saka + Odegaard", "SOCCER"), "attributes": {"display_name": "Saka + Odegaard", "league": "SOCCER", "combo": True}},
    ],
}
LEAGUES = {"data": [{"id": "82", "type": "league", "attributes": {"name": "SOCCER"}}]}


class SoccerBoardTests(unittest.TestCase):
    def setUp(self):
        export._PROJECTION_CACHE.clear()
        export._LEAGUE_CACHE.clear()
        soccer_board._cache.update(at=0.0, value=None)

    def fetch(self, feed=SOCCER_FEED):
        fake = FakePrizePicks(leagues=LEAGUES, feeds={"82": feed})
        with patch.object(export.requests, "get", side_effect=fake):
            return soccer_board.build(now=NOW), fake

    def test_upcoming_single_player_lines_become_finder_rows(self):
        board, _ = self.fetch()
        self.assertEqual([(row["player"], row["stat"], row["line"], row["modifier"]) for row in board["rows"]], [
            ("Bukayo Saka", "Shots On Target", 0.5, "goblin"),
            ("Bukayo Saka", "Shots On Target", 1.5, "standard"),
            ("David Raya", "Goalie Saves", 3.5, "standard"),
        ])
        saka = board["rows"][1]
        self.assertEqual((saka["id"], saka["team"], saka["opponent"], saka["position"]), ("pp:5001", "ARS", "CHE", "M"))
        self.assertEqual(saka["marketKey"], "shotsontarget")
        self.assertEqual(saka["startsAt"], "2026-09-28T19:00:00+00:00")
        self.assertEqual([app["key"] for app in saka["apps"]], ["prizepicks"])

    def test_an_empty_slate_is_an_empty_board_not_an_error(self):
        board, _ = self.fetch({"data": [], "included": []})
        self.assertEqual(board["rows"], [])

    def test_soccer_picks_export_to_prizepicks(self):
        fake = FakePrizePicks(leagues=LEAGUES, feeds={"82": SOCCER_FEED})
        with patch.object(export.requests, "get", side_effect=fake):
            status, body = export.build_export([
                {"league": "SOCCER", "player": "Bukayo Saka", "stat": "Shots On Target", "line": 1.5, "side": "under"},
                {"league": "SOCCER", "player": "David Raya", "stat": "Goalie Saves", "line": 3.5, "side": "over"},
            ])
        self.assertEqual(status, 200)
        self.assertEqual([match["projectionId"] for match in body["matches"]], ["5001", "5003"])


class SoccerRouteTests(unittest.TestCase):
    def get(self, sport_open=True):
        from api import board as board_api
        request = object.__new__(board_api.handler)
        request.path, request.headers = "/api/board?view=soccer", {}
        sent = []
        request._send = lambda status, payload: sent.append((status, payload))
        with patch("site_controls.allowed", return_value=True) as tab_gate, \
             patch("site_controls.finder_sport_allowed", return_value=sport_open) as sport_gate, \
             patch.object(board_api, "session_with_live_access", return_value=True), \
             patch("soccer_board.board", return_value={"rows": [{"id": "pp:1"}]}):
            request.do_GET()
        return sent[0], tab_gate, sport_gate

    def test_the_route_follows_the_finder_and_its_soccer_switch(self):
        (status, body), tab_gate, sport_gate = self.get()
        self.assertEqual((status, body["rows"][0]["id"]), (200, "pp:1"))
        self.assertEqual(tab_gate.call_args.args[1], "finder")
        self.assertEqual(sport_gate.call_args.args[1], "soccer")

    def test_soccer_switched_off_is_closed(self):
        (status, body), _, _ = self.get(sport_open=False)
        self.assertEqual((status, body.get("featureDisabled")), (503, True))


if __name__ == "__main__":
    unittest.main()
