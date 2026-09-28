"""The Finder's MLB sportsbook prices (mlb_book_lines.py)."""
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import mlb_book_lines as books  # noqa: E402


def outcome(side, point, price, name="Chris Sale"):
    return {"name": side, "description": name, "point": point, "price": price}


def pp_row(pid, player, stat, line, odds_type="standard", start="2026-09-29T15:00:00Z"):
    return {"id": pid, "league": "MLB", "player": player, "stat": stat, "line": line, "odds_type": odds_type,
            "team": "ATL", "position": "P", "start_time": start, "description": "PHI", "headshot": ""}


class ParseTests(unittest.TestCase):
    def test_main_line_wins_and_alternates_are_flagged(self):
        payload = {"id": "e1", "bookmakers": [
            {"key": "draftkings", "markets": [
                {"key": "pitcher_strikeouts_alternate", "outcomes": [outcome("Over", 4.5, -1040), outcome("Over", 6.5, -140)]},
                {"key": "pitcher_strikeouts", "outcomes": [outcome("Over", 6.5, -125), outcome("Under", 6.5, -105)]}]},
            {"key": "prizepicks", "markets": [{"key": "pitcher_strikeouts", "outcomes": [outcome("Over", 6.5, -137)]}]}]}
        quotes = {(q["line"], q["alternate"]): (q["over"], q["under"], q["stat"]) for q in books.parse_event(payload, "e1")}
        self.assertEqual(quotes, {(6.5, False): (-125, -105, "Pitcher Strikeouts"),
                                  (4.5, True): (-1040, None, "Pitcher Strikeouts")})
        with self.assertRaises(ValueError):
            books.parse_event({"id": "other", "bookmakers": []}, "e1")


class AttachTests(unittest.TestCase):
    def quote(self, book, player, stat, line, over, under=None, alternate=False, starts="2026-09-29T15:05:00Z"):
        return {"book": book, "player": player, "stat": stat, "line": line, "over": over, "under": under,
                "alternate": alternate, "eventId": "e1", "startsAt": starts}

    def test_goblins_get_alternate_prices_and_book_main_lines_become_rows(self):
        rows = [pp_row("1", "Chris Sale", "Pitcher Strikeouts", 4.5, "goblin"),
                pp_row("2", "Chris Sale", "Pitcher Strikeouts", 6.5)]
        quotes = [
            self.quote("draftkings", "Chris Sale", "Pitcher Strikeouts", 4.5, -1040, alternate=True),
            self.quote("hardrockbet", "Chris Sale", "Pitcher Strikeouts", 4.5, -650, 375, alternate=True),
            self.quote("fanduel", "Chris Sale", "Pitcher Strikeouts", 6.5, -130, 100),
            # FanDuel's main line on a stat PrizePicks doesn't post: its own row.
            self.quote("fanduel", "Chris Sale", "Pitching Outs", 17.5, -115, -115),
            # Alternates alone never make a row.
            self.quote("draftkings", "Chris Sale", "Hits Allowed", 7.5, 300, alternate=True),
            # A player PrizePicks doesn't list, and another day's game: left out.
            self.quote("fanduel", "Someone Else", "Hits", 0.5, -200, 150),
            self.quote("fanduel", "Chris Sale", "Walks Allowed", 1.5, -110, -110, starts="2026-10-02T15:05:00Z"),
        ]
        out = {(row["stat"], row["line"]): row for row in books.attach(rows, quotes)}
        self.assertEqual(set(out), {("Pitcher Strikeouts", 4.5), ("Pitcher Strikeouts", 6.5), ("Pitching Outs", 17.5)})
        goblin = out[("Pitcher Strikeouts", 4.5)]
        self.assertEqual([app["key"] for app in goblin["apps"]], ["prizepicks", "draftkings", "hardrockbet"])
        self.assertEqual(goblin["odds_type"], "goblin")
        outs = out[("Pitching Outs", 17.5)]
        self.assertEqual((outs["bookOnly"], outs["team"], outs["description"], [app["key"] for app in outs["apps"]]),
                         (True, "ATL", "PHI", ["fanduel"]))


class FetchTests(unittest.TestCase):
    def setUp(self):
        books._memory.clear()

    def test_window_credit_floor_and_fallback(self):
        from datetime import datetime, timezone
        now = datetime(2026, 9, 21, 1, tzinfo=timezone.utc).timestamp()
        soon = {"id": "a", "commence_time": "2026-09-21T13:00:00Z"}
        later = {"id": "b", "commence_time": "2026-10-10T13:00:00Z"}
        calls = []

        def get(path, params):
            calls.append((path, params))
            if path.endswith("/events"):
                return Mock(headers={"x-requests-remaining": "90000"}, json=lambda: [soon, later])
            if len([call for call in calls if call[0].endswith("/odds")]) == 1:
                raise RuntimeError("The live-lines provider returned HTTP 422.")
            return Mock(json=lambda: {"id": "a", "bookmakers": [{"key": "fanduel", "markets": [
                {"key": "pitcher_strikeouts", "outcomes": [outcome("Over", 6.5, -125), outcome("Under", 6.5, -105)]}]}]})
        from v2.board import odds_client, store
        with patch.object(odds_client, "_get", side_effect=get), patch.object(store, "get", return_value=None), \
                patch.object(store, "set"), patch("mlb_book_lines.time.time", return_value=now):
            quotes = books.lines(now=now)
        self.assertEqual([(q["eventId"], q["line"]) for q in quotes], [("a", 6.5)])
        odds_calls = [params for path, params in calls if path.endswith("/odds")]
        # The full list was refused, so the known markets were asked next.
        self.assertEqual(len(odds_calls), 2)
        self.assertEqual(len(odds_calls[0]["bookmakers"].split(",")), 10)
        self.assertNotIn("batter_stolen_bases", odds_calls[1]["markets"])
        with patch.object(odds_client, "_get", return_value=Mock(headers={"x-requests-remaining": "300"}, json=lambda: [soon])), \
                self.assertRaises(RuntimeError):
            books.lines(now=now)


if __name__ == "__main__":
    unittest.main()
