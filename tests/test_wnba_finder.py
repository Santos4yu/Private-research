"""Synthetic inputs confined to tests of WNBA history calculations."""
import unittest
from unittest.mock import patch

from api.wnba import _attach_history, _game_logs, _window


class WNBAFinderHistoryTests(unittest.TestCase):
    def test_pushes_are_not_decisions_and_empty_history_is_unknown(self):
        result = _window([0, 2, 2, 3], 2)
        self.assertEqual(result, {
            "hits": 1, "misses": 1, "pushes": 2, "sample": 4, "hitRate": 50,
        })
        self.assertIsNone(_window([], 2)["hitRate"])
        self.assertIsNone(_window([2, 2], 2)["hitRate"])

    def test_missing_stats_do_not_become_zero_and_h2h_uses_all_history(self):
        logs = [
            {"opponent": "OTHER" if index > 1 else "OPP",
             "values": {"player_points": None if index == 3 else index}}
            for index in range(16)
        ]
        rows = [{
            "playerId": "test-only", "marketKey": "player_points", "line": 5,
            "teamAbbr": "TEAM", "homeTeamAbbr": "OPP", "awayTeamAbbr": "TEAM",
        }]
        with patch("api.wnba._game_logs", return_value={"rows": logs}):
            row = _attach_history(rows, 2026)[0]
        self.assertEqual(row["average"], 10.5)
        self.assertEqual(row["windows"]["l15"]["sample"], 15)
        self.assertEqual(row["windows"]["h2h"]["sample"], 2)
        self.assertEqual(row["windows"]["h2h"]["hitRate"], 0)

    def test_multiple_markets_share_one_player_history_and_failure_stays_unknown(self):
        rows = [
            {"playerId": "test-only", "marketKey": market, "line": 2.5}
            for market in ("player_points", "player_rebounds")
        ]
        with patch("api.wnba._game_logs", side_effect=RuntimeError("test-only unavailable")) as load:
            results = _attach_history(rows, 2026)
        load.assert_called_once_with("test-only", 2026)
        for row in results:
            self.assertIsNone(row["average"])
            self.assertIsNone(row["diff"])
            self.assertIsNone(row["windows"]["l10"]["hitRate"])

    def test_parser_sorts_deduplicates_and_requires_all_combo_components(self):
        data = {
            "names": ["points", "totalRebounds", "assists", "steals", "blocks", "turnovers"],
            "events": {
                "earlier": {"gameDate": "2026-06-01", "opponent": {"abbreviation": "OPP"}},
                "later": {"gameDate": "2026-06-02", "opponent": {"abbreviation": "OTHER"}},
            },
            "seasonTypes": [{"displayName": "Regular Season", "categories": [{"events": [
                {"eventId": "later", "stats": ["20", "4", "--", "0", "1", "2"]},
                {"eventId": "earlier", "stats": ["0", "4", "5", "0", "1", "2"]},
                {"eventId": "earlier", "stats": ["0", "4", "5", "0", "1", "2"]},
            ]}]}],
        }
        with patch("api.wnba.store.get", return_value=None), \
             patch("api.wnba.store.set"), \
             patch("api.wnba._espn_json", return_value=data):
            rows = _game_logs("test-only", 2026)["rows"]
        self.assertEqual([row["gameId"] for row in rows], ["earlier", "later"])
        self.assertEqual(rows[0]["values"]["player_points"], 0)
        self.assertEqual(rows[0]["values"]["player_points_rebounds_assists"], 9)
        self.assertAlmostEqual(rows[0]["values"]["player_fantasy_points"], 13.3)
        self.assertNotIn("player_points_assists", rows[1]["values"])
        self.assertNotIn("player_fantasy_points", rows[1]["values"])


if __name__ == "__main__":
    unittest.main()
