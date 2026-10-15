"""Slip to PrizePicks: a slip's picks, read off a picture, found on
PrizePicks' boards in any league (prizepicks_export_core.find_picks), and
the admin-only route that does it (api/prediction.py action=slip-export)."""
import io
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import prizepicks_export_core as export  # noqa: E402


def row(pid, league, name, stat, line, odds_type="standard", wagers="over,under", combo=False):
    return {"id": pid, "league": league, "player": name, "player_id": name, "stat": stat, "line": line, "odds_type": odds_type,
            "allowed_wager_types": wagers if odds_type == "standard" else "over", "headshot": f"https://img/{pid}.png", "team": "T",
            "description": "OPP", "start_time": "2026-10-15T23:00:00Z", "combo": combo}


BOARDS = {
    "NBA": [row("n1", "NBA", "Jalen Brunson", "Points", 26.5), row("n2", "NBA", "Jalen Brunson", "Points", 22.5, "goblin"),
            row("n3", "NBA", "Jalen Brunson", "Assists", 7.5), row("n4", "NBA", "Brunson + Towns", "Points", 50.5, combo=True)],
    "CS2": [row("c1", "CS2", "ZywOo", "MAPS 1-2 Kills", 38.5), row("c2", "CS2", "m0NESY", "MAPS 1-2 Headshots", 19.5)],
    "TENNIS": [row("t1", "TENNIS", "Carlos Alcaraz", "Aces", 6.5), row("t2", "TENNIS", "Carlos Alcaraz", "Total Games", 22.5)],
    "GOLF": [row("g1", "GOLF", "Scottie Scheffler", "Strokes", 68.5)],
}


def leg(player, stat, line=None, side="OVER", league="", modifier="standard"):
    return {"player": player, "stat": stat, "statName": "", "line": line, "side": side, "league": league, "sport": "", "modifier": modifier}


class FindPicksTests(unittest.TestCase):
    def find(self, legs, boards=BOARDS):
        asked = []

        def fetch(force=False, league="MLB"):
            asked.append(league)
            if league not in boards:
                raise RuntimeError(f"PrizePicks returned no active {league} projections.")
            return boards[league]

        with patch.object(export, "_fetch_projection_rows", side_effect=fetch), \
                patch.object(export, "_active_leagues", return_value=list(boards)):
            return export.find_picks(legs), asked

    def test_a_slip_league_is_named_as_prizepicks_names_it(self):
        self.assertEqual(export.league_name("csgo"), "CS2")
        self.assertEqual(export.league_name("Counter-Strike 2"), "CS2")
        self.assertEqual(export.league_name("LoL"), "LOL")
        self.assertEqual(export.league_name("nba"), "NBA")
        self.assertEqual(export.league_name(""), "")
        # The feed's own name wins over a nickname for it.
        self.assertEqual(export._board_names("golf", ["NBA", "GOLF"]), ["GOLF"])
        self.assertEqual(export._board_names("CSGO", ["NBA", "CS2"]), ["CS2"])

    def test_picks_are_found_in_their_league_on_their_line(self):
        found, asked = self.find([leg("Jalen Brunson", "Points", 26.5, league="NBA"),
                                  leg("ZywOo", "Maps 1-2 Kills", 38.5, "UNDER", league="CS2")])
        self.assertEqual([item["pick"]["projectionId"] for item in found], ["n1", "c1"])
        self.assertEqual([item["pick"]["side"] for item in found], ["over", "under"])
        self.assertEqual(sorted(asked), ["CS2", "NBA"], "the leagues the slip shows, nothing else")
        self.assertFalse(found[0]["pick"]["changed"])
        self.assertEqual(found[0]["pick"]["sides"], ["over", "under"])

    def test_a_goblin_on_the_slip_is_the_goblin_and_plays_more(self):
        found, _ = self.find([leg("Jalen Brunson", "Points", 22.5, "UNDER", league="NBA", modifier="goblin")])
        pick = found[0]["pick"]
        self.assertEqual((pick["projectionId"], pick["oddsType"], pick["side"], pick["sides"]), ("n2", "goblin", "over", ["over"]))

    def test_a_pick_with_no_league_is_found_in_whatever_league_has_it(self):
        found, _ = self.find([leg("C. Alcaraz", "Aces", 6.5), leg("Scottie Scheffler", "Strokes", 68.5, league="PGA")])
        self.assertEqual(found[0]["pick"]["projectionId"], "t1", "last name and first initial")
        self.assertEqual(found[1]["pick"]["projectionId"], "g1", "a slip calling it PGA still finds PrizePicks' GOLF board")

    def test_a_moved_line_is_still_found_and_said(self):
        found, _ = self.find([leg("Jalen Brunson", "Points", 25.5, league="NBA")])
        self.assertEqual(found[0]["pick"]["projectionId"], "n1")
        self.assertTrue(found[0]["pick"]["changed"])

    def test_what_is_not_on_prizepicks_says_why(self):
        found, _ = self.find([leg("Jalen Brunson", "Rebounds", 4.5, league="NBA"), leg("Nobody Atall", "Points", 10.5, league="NBA")])
        self.assertEqual(found[0]["reason"], "PrizePicks has this player, but not this stat right now")
        self.assertEqual(found[1]["reason"], "Not on PrizePicks right now")
        self.assertEqual(found[0]["read"]["player"], "Jalen Brunson")
        self.assertNotIn("pick", found[0])

    def test_combo_lines_are_never_matched(self):
        found, _ = self.find([leg("Brunson + Towns", "Points", 50.5, league="NBA")])
        self.assertNotIn("pick", found[0])

    def test_the_link_opens_each_pick_on_its_side(self):
        self.assertEqual(export.picks_url([{"projectionId": "n1", "side": "over", "line": 26.5}, {"projectionId": "c1", "side": "under", "line": 38.0}]),
                         "https://app.prizepicks.com/?projections=n1-o-26.5,c1-u-38")
        self.assertIsNone(export.picks_url([]))


class SlipExportRouteTests(unittest.TestCase):
    def post(self, body, content_type="application/json", admin=True):
        from api import prediction
        raw = json.dumps(body).encode() if content_type == "application/json" else body
        handler = prediction.handler.__new__(prediction.handler)
        handler.path = "/api/prediction?action=slip-export"
        handler.headers = {"Content-Length": str(len(raw)), "Content-Type": content_type}
        handler.rfile = io.BytesIO(raw)
        sent = {}
        from v2.board import admin_auth
        with patch("site_controls.allowed", side_effect=lambda _headers, tab=None, sport=None: tab == "export" and admin) as gate, \
                patch.object(admin_auth, "is_admin_request", return_value=admin), \
                patch.object(prediction, "session_with_live_access", return_value=True), \
                patch.object(prediction.handler, "_send", lambda _self, status, payload: sent.update(status=status, body=payload)):
            handler.do_POST()
        return sent, gate

    def test_only_an_admin_gets_in(self):
        sent, gate = self.post({"legs": [leg("Jalen Brunson", "Points", 26.5)]}, admin=False)
        self.assertEqual(gate.call_args.args[1], "export")
        self.assertEqual((sent["status"], sent["body"].get("featureDisabled")), (503, True))

    def test_a_picture_is_read_into_its_picks(self):
        slip = {"app": {"key": "underdog", "name": "Underdog"}, "legs": [leg("ZywOo", "Kills", 38.5, league="CS2")]}
        with patch("slip_reader.read_slip", return_value=slip) as read:
            sent, _ = self.post(b"\x89PNG fake", content_type="image/png")
        read.assert_called_once()
        self.assertEqual(sent["status"], 200)
        self.assertEqual(sent["body"]["legs"][0]["player"], "ZywOo")

    def test_picks_are_found_with_the_link_that_opens_them(self):
        found = [{"index": 0, "read": {}, "pick": {"projectionId": "n1", "side": "over", "line": 26.5}}, {"index": 1, "read": {}, "reason": "Not on PrizePicks right now"}]
        with patch.object(export, "find_picks", return_value=found) as finder:
            sent, _ = self.post({"legs": [leg("Jalen Brunson", "Points", 26.5), leg("Nobody", "Points", 1.5), "junk"]})
        self.assertEqual(len(finder.call_args.args[0]), 2, "only real picks are looked for")
        self.assertEqual(sent["status"], 200)
        self.assertEqual(sent["body"]["url"], "https://app.prizepicks.com/?projections=n1-o-26.5")

    def test_nothing_to_find_is_refused(self):
        sent, _ = self.post({"legs": []})
        self.assertEqual(sent["status"], 400)
        sent, _ = self.post(b"text", content_type="text/plain")
        self.assertEqual(sent["status"], 415)


if __name__ == "__main__":
    unittest.main()
