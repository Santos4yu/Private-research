"""First quarter, first half and dunks from the play-by-play (periods.py), the
season store's catch-up (league.backfill_periods), the board's merge
(api/wnba.py) and live lines (slip_games.basketball_lines)."""
import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.sports.wnba import league, periods  # noqa: E402

_spec = importlib.util.spec_from_file_location("wnba_api_periods", Path(__file__).resolve().parents[1] / "api" / "wnba.py")
wnba_api = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(wnba_api)


def box(pid, pts, reb, ast, fgm=0, tpm=0):
    values = {field: 0 for field in league.FIELDS}
    values.update(min=30, pts=pts, reb=reb, ast=ast, fgm=fgm, tpm=tpm)
    return [pid, 1] + [values[field] for field in league.FIELDS]


def play(period, kind, people, value=None):
    out = {"period": {"number": period}, "type": {"text": kind}, "participants": [{"athlete": {"id": pid}} for pid in people]}
    if value:
        out.update(scoringPlay=True, scoreValue=value)
    return out


PLAYS = [
    play(1, "Jump Shot", ["a", "b"], 3),       # a: 3 (a three), b: assist -- first quarter
    play(1, "Free Throw", ["a"], 1),           # a: 1
    play(1, "Defensive Rebound", ["b"]),       # b: rebound
    play(2, "Layup", ["b", "a"], 2),           # b: 2, a: assist -- second quarter
    play(2, "Offensive Rebound", ["a"]),       # a: rebound
    play(3, "Dunk", ["a"], 2),                 # a: 2 -- after the half
    play(3, "Defensive Rebound", []),          # a team rebound: nobody's
]
RECORD = {"t": {"AAA": {"p": [box("a", 6, 1, 1), box("b", 2, 1, 1)]}}}


class PeriodLineTests(unittest.TestCase):
    def test_quarter_and_half_from_the_plays(self):
        lines = periods.period_lines({"plays": PLAYS}, RECORD, league.FIELDS)
        a, b = lines["AAA"]
        #            q: pts reb ast 3pm   h: pts reb ast 3pm
        self.assertEqual(a, ["a", 4, 0, 0, 1, 4, 1, 1, 1])
        self.assertEqual(b, ["b", 0, 1, 1, 0, 2, 1, 1, 0])
        self.assertEqual(periods.values_of(a)["player_points_1q"], 4)
        self.assertEqual(periods.values_of(a)["player_points_rebounds_assists_1h"], 6)
        self.assertEqual(periods.values_of(b)["player_rebounds_assists_1q"], 2)

    def test_numbers_that_disagree_with_the_box_are_left_out(self):
        # Points off: the whole team's lines go.
        wrong = {"t": {"AAA": {"p": [box("a", 9, 1, 1), box("b", 2, 1, 1)]}}}
        self.assertEqual(periods.period_lines({"plays": PLAYS}, wrong, league.FIELDS), {})
        # Assists off by two: points and rebounds stay, assists go.
        off = {"t": {"AAA": {"p": [box("a", 6, 1, 3), box("b", 2, 1, 1)]}}}
        a = periods.period_lines({"plays": PLAYS}, off, league.FIELDS)["AAA"][0]
        self.assertEqual(a, ["a", 4, 0, None, 1, 4, 1, None, 1])
        values = periods.values_of(a)
        self.assertEqual(values["player_points_1q"], 4)
        self.assertNotIn("player_assists_1q", values)
        self.assertNotIn("player_points_rebounds_assists_1h", values)
        # No play-by-play at all.
        self.assertEqual(periods.period_lines({}, RECORD, league.FIELDS), {})

    def test_labels(self):
        self.assertEqual(periods.LABELS["player_points_1q"], "1Q Points")
        self.assertEqual(periods.LABELS["player_points_rebounds_assists_1h"], "1H Pts+Rebs+Asts")


class DunkTests(unittest.TestCase):
    PLAYS = [
        play(1, "Cutting Dunk Shot", ["a", "b"], 2),          # a: a dunk, b the pass
        play(2, "Alley Oop Dunk Shot", ["a"], 2),             # a: another
        {"period": {"number": 2}, "type": {"text": "Running Dunk Shot"}, "participants": [{"athlete": {"id": "b"}}]},   # b missed one
        play(3, "Layup Shot", ["b"], 2),
    ]

    def test_made_dunks_a_player_from_the_shot_types(self):
        record = {"t": {"AAA": {"p": [box("a", 4, 0, 0, fgm=2), box("b", 2, 0, 1, fgm=1)]}}}
        self.assertEqual(periods.dunk_counts({"plays": self.PLAYS}, record, league.FIELDS), {"AAA": {"a": 2}})
        # Without a play-by-play, nothing is known.
        self.assertEqual(periods.dunk_counts({}, record, league.FIELDS), {})
        # More dunks than twos made: the plays and the box disagree, the team is left out.
        short = {"t": {"AAA": {"p": [box("a", 4, 0, 0, fgm=1), box("b", 2, 0, 1, fgm=1)]}}}
        self.assertEqual(periods.dunk_counts({"plays": self.PLAYS}, short, league.FIELDS), {})

    def test_a_stored_game_keeps_them_and_the_board_reads_them(self):
        self.assertEqual(wnba_api._market_of("dunks"), "player_dunks")
        self.assertEqual(wnba_api.PRIZEPICKS_LABELS["player_dunks"], "Dunks")
        stored = {"builtAt": "y", "games": {
            "501": {"t": {"AAA": {"p": [box("a", 4, 0, 0, fgm=2), box("b", 2, 0, 1, fgm=1)], "h": [], "dk": {"a": 2}}}},
            "502": {"t": {"AAA": {"p": [box("a", 4, 0, 0, fgm=2)], "h": [], "dk": None}}}}}
        wnba_api._period_memory.clear()
        with patch("backend.sports.wnba.league.stored", side_effect=lambda year, which: stored if year == 2026 else None):
            a = wnba_api._with_periods([{"gameId": "501", "values": {"player_points": 4}}, {"gameId": "502", "values": {}}], "a", "nba", [2026])
            b = wnba_api._with_periods([{"gameId": "501", "values": {}}], "b", "nba", [2026])
        self.assertEqual(a[0]["values"], {"player_points": 4, "player_dunks": 2})
        self.assertEqual(a[1], {"gameId": "502", "values": {}})     # not counted that game: no dunk value at all
        self.assertEqual(b[0]["values"], {"player_dunks": 0})        # counted, he made none


class StoreTests(unittest.TestCase):
    def test_backfill_fills_newest_first_and_saves_their_months(self):
        payload = {"games": {
            "1": {"id": "1", "date": "2026-03-01T00:00Z", "t": {"AAA": {"p": [box("a", 6, 1, 1), box("b", 2, 1, 1)]}}},
            "2": {"id": "2", "date": "2026-04-01T00:00Z", "t": {"AAA": {"p": [box("a", 6, 1, 1), box("b", 2, 1, 1)]}}},
            "3": {"id": "3", "date": "2026-02-01T00:00Z", "t": {"AAA": {"p": [], "h": [], "dk": {}}}}}}
        saved = {}
        with patch.object(league, "stored", return_value=payload), \
             patch.object(league, "espn", side_effect=lambda path, params, timeout, which: {"plays": PLAYS}), \
             patch.object(league, "_save", side_effect=lambda season, value, which, changed: saved.update(changed=changed)):
            result = league.backfill_periods(2026, "nba", deadline_seconds=5, limit=1)
        self.assertEqual(result, {"done": 1, "left": 1})
        self.assertEqual(payload["games"]["2"]["t"]["AAA"]["h"][0][0], "a")   # April first
        # Its dunks too ("a" made 2 twos in the box here: 0 fgm, so the box disagrees and they're not kept).
        self.assertIn("dk", payload["games"]["2"]["t"]["AAA"])
        self.assertNotIn("h", payload["games"]["1"]["t"]["AAA"])
        self.assertEqual(saved["changed"], {"2026-04"})

    def test_board_reads_period_names_and_merges_values(self):
        self.assertEqual(wnba_api._market_of("1qpoints"), "player_points_1q")
        self.assertEqual(wnba_api._market_of("points1sthalf"), "player_points_1h")
        self.assertEqual(wnba_api._market_of("1hptsrebsasts"), "player_points_rebounds_assists_1h")
        self.assertEqual(wnba_api._market_of("1q3ptmade"), "player_threes_1q")
        self.assertEqual(wnba_api._market_of("1qdunks"), "pp:1qdunks")
        self.assertEqual(wnba_api._market_of("points"), "player_points")
        stored = {"builtAt": "x", "games": {"401": {"t": {"AAA": {"h": [["a", 4, 0, 0, 1, 4, 1, 1, 1]]}}}}}
        wnba_api._period_memory.clear()
        with patch("backend.sports.wnba.league.stored", side_effect=lambda year, which: stored if year == 2026 else None):
            rows = wnba_api._with_periods([{"gameId": "401", "values": {"player_points": 6}}, {"gameId": "402", "values": {}}],
                                          "a", "nba", [2026, 2027])
        self.assertEqual(rows[0]["values"]["player_points_1q"], 4)
        self.assertEqual(rows[0]["values"]["player_points"], 6)
        self.assertEqual(rows[1], {"gameId": "402", "values": {}})


if __name__ == "__main__":
    unittest.main()
