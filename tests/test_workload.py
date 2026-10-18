"""Workload limits read from the injury report's notes (workload.py) and
carried on each pick's game (slip_games.py)."""
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import mlb_injuries  # noqa: E402
import slip_games  # noqa: E402
import workload  # noqa: E402
from tests.test_slip_games import espn_header  # noqa: E402

NOW = datetime(2026, 10, 18, 15, tzinfo=timezone.utc)


class ReadLimitTests(unittest.TestCase):
    def test_limits_by_kind(self):
        cases = [
            ("Skattebo (ankle) was activated Saturday and is expected to be on a snap count against the Eagles.", "nfl", "snaps"),
            ("The Giants plan to manage his workload in his first game back.", "nfl", "workload"),
            ("He is likely to see a reduced workload Sunday.", "nfl", "workload"),
            ("Coach said he'll be on a pitch count after missing six weeks.", "nfl", "touches"),
            ("He'll be on a pitch count in his first start off the IL.", "mlb", "pitches"),
            ("Expect him to be limited to about four innings.", "mlb", "innings"),
            ("Brunson will play but will be on a minutes restriction.", "nba", "minutes"),
            ("He'll be limited to around 20 minutes in his return.", "nba", "minutes"),
            ("His ice time will be monitored in his first game back.", "nhl", "icetime"),
            ("McCaffrey won't handle a full workload Sunday.", "nfl", "workload"),
            ("The team will ease him back in.", "nfl", "workload"),
        ]
        for text, sport, kind in cases:
            with self.subTest(text=text):
                self.assertEqual(workload.read_limit(text, sport), {"kind": kind, "cleared": False})

    def test_limits_said_not_to_apply(self):
        cases = [
            ("He is not expected to be on a minutes restriction Wednesday.", "minutes"),
            ("He doesn't have a snap count this week.", "snaps"),
            ("He was on a snap count last week but has no restrictions now.", "snaps"),
            ("He's expected to play without restrictions.", "workload"),
            ("He should handle a full workload against Dallas.", "workload"),
        ]
        for text, kind in cases:
            with self.subTest(text=text):
                self.assertEqual(workload.read_limit(text, "nfl"), {"kind": kind, "cleared": True})

    def test_practice_and_plain_notes_say_nothing(self):
        for text in ("He was a limited participant in practice Thursday.", "Coach said he will be eased back into practice this week.",
                     "Barkley handled a full workload in practice.", "He's questionable with a hamstring injury.", "", None):
            with self.subTest(text=text):
                self.assertIsNone(workload.read_limit(text, "nfl"))

    def test_note_limit_reads_the_short_note_first_and_skips_old_ones(self):
        item = {"date": "2026-10-17T20:00Z", "shortComment": "He'll be on a snap count.",
                "longComment": "He had no restrictions last season."}
        self.assertEqual(workload.note_limit(item, "nfl", now=NOW), {"kind": "snaps", "cleared": False, "date": "2026-10-17"})
        old = {**item, "date": "2026-09-01T20:00Z"}
        self.assertIsNone(workload.note_limit(old, "nfl", now=NOW))
        self.assertIsNone(workload.note_limit({"date": "2026-10-17", "shortComment": "Questionable (hamstring)."}, "nfl", now=NOW))


def summary_with_notes():
    return {"header": espn_header("NYG", "PHI", 0, 0, state="pre"), "boxscore": {"players": []},
            "injuries": [{"team": {"abbreviation": "NYG"}, "injuries": [
                {"status": "Active", "date": "2026-10-17T20:00Z",
                 "shortComment": "Skattebo (ankle) is expected to be on a snap count Sunday.",
                 "athlete": {"displayName": "Cam Skattebo", "position": {"abbreviation": "RB"}}},
                {"status": "Out", "athlete": {"displayName": "Malik Nabers", "position": {"abbreviation": "WR"}}}]}]}


class GameNotesTests(unittest.TestCase):
    def test_the_game_page_carries_the_flag_not_the_note(self):
        with patch.object(workload, "datetime") as clock:
            clock.now.return_value = NOW
            clock.fromisoformat = datetime.fromisoformat
            listed = slip_games.espn_injuries(summary_with_notes(), "nfl")["NYG"]
        skattebo = listed[0]
        self.assertEqual(skattebo["limit"], {"kind": "snaps", "cleared": False, "date": "2026-10-17"})
        self.assertNotIn("shortComment", skattebo)
        self.assertNotIn("Eagles", str(listed))
        self.assertNotIn("limit", listed[1])

    def test_league_report_adds_a_flag_the_game_page_lacks(self):
        report = {"NYG": [{"name": "Cam Skattebo", "status": "Active", "position": "RB",
                           "limit": {"kind": "touches", "cleared": False, "date": "2026-10-17"}},
                          {"name": "Malik Nabers", "status": "Out", "position": "WR"}]}
        item = {"sport": "nfl", "team": "NYG", "players": [{"key": "a", "name": "Cam Skattebo"}, {"key": "b", "name": "Malik Nabers"}]}
        with patch.object(slip_games, "league_injuries", return_value=report):
            # Not on the game page at all: added with his flag.
            added = slip_games.with_league_notes({"NYG": []}, "nfl", item)
            self.assertEqual(added["NYG"][0]["limit"]["kind"], "touches")
            # On it without a flag: the flag joins his entry.
            joined = slip_games.with_league_notes({"NYG": [{"name": "Cam Skattebo", "status": "Questionable", "position": "RB"}]}, "nfl", item)
            self.assertEqual(joined["NYG"], [{"name": "Cam Skattebo", "status": "Questionable", "position": "RB",
                                              "limit": {"kind": "touches", "cleared": False, "date": "2026-10-17"}}])
        # The league report down: the game page's report stands.
        with patch.object(slip_games, "league_injuries", side_effect=RuntimeError("down")):
            self.assertEqual(slip_games.with_league_notes({"NYG": []}, "nfl", item), {"NYG": []})

    def test_before_kickoff_the_view_asks_the_league_report(self):
        item = {"sport": "nfl", "team": "NYG", "opponent": "PHI", "players": [{"key": "a", "name": "Cam Skattebo"}]}
        report = {"NYG": [{"name": "Cam Skattebo", "status": "Active", "position": "RB",
                           "limit": {"kind": "snaps", "cleared": False, "date": "2026-10-17"}}]}
        summary = summary_with_notes()
        summary["injuries"][0]["injuries"][0].pop("shortComment")
        with patch.object(slip_games, "league_injuries", return_value=report):
            view = slip_games.espn_view("nfl", summary, item)
        self.assertEqual(view["injuries"]["NYG"][0]["limit"]["kind"], "snaps")

    def test_mlb_report_flags_a_pitch_count(self):
        report = mlb_injuries.normalize_report({"injuries": [{"id": "1", "displayName": "Detroit", "injuries": [{
            "id": "2", "status": "15-Day-IL", "date": datetime.now(timezone.utc).isoformat(),
            "shortComment": "He'll be on a pitch count when he's activated Friday.",
            "athlete": {"displayName": "Test Pitcher", "position": {"abbreviation": "SP"}, "team": {"abbreviation": "DET"}}}]}]})
        player = report["teams"][0]["players"][0]
        self.assertEqual((player["limit"]["kind"], player["limit"]["cleared"]), ("pitches", False))


if __name__ == "__main__":
    unittest.main()
