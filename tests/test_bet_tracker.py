"""My Bets (bet_tracker.py): each member's bets, profit in units, and bets
logged from a tracked slip settling with it."""
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import bet_tracker  # noqa: E402


class FakeStore:
    def __init__(self):
        self.data = {}

    def get(self, key, **_):
        return self.data.get(key)

    def set(self, key, value, ex=None):
        self.data[key] = value


class ProfitTests(unittest.TestCase):
    def test_each_result(self):
        self.assertEqual(bet_tracker.profit({"kind": "pickem", "payout": 3, "stake": 2, "result": "win"}), 4)
        self.assertAlmostEqual(bet_tracker.profit({"kind": "straight", "odds": -110, "stake": 1.1, "result": "win"}), 1.0)
        self.assertEqual(bet_tracker.profit({"kind": "parlay", "odds": 250, "stake": 1, "result": "win"}), 2.5)
        self.assertEqual(bet_tracker.profit({"kind": "pickem", "payout": 6, "stake": 1, "result": "loss"}), -1)
        self.assertEqual(bet_tracker.profit({"kind": "pickem", "payout": 6, "stake": 1, "result": "push"}), 0)
        self.assertEqual(bet_tracker.profit({"kind": "pickem", "payout": 6, "stake": 2, "result": "cashout", "returned": 3}), 1)
        self.assertIsNone(bet_tracker.profit({"kind": "pickem", "payout": 6, "stake": 1, "result": "pending"}))

    def test_a_bet_is_checked(self):
        with self.assertRaises(ValueError):
            bet_tracker.clean({"kind": "pickem", "stake": 1})          # no payout
        with self.assertRaises(ValueError):
            bet_tracker.clean({"kind": "straight", "stake": 1, "odds": 50})   # not a price
        with self.assertRaises(ValueError):
            bet_tracker.clean({"kind": "pickem", "stake": 0, "payout": 3})
        bet = bet_tracker.clean({"kind": "straight", "stake": "1.5", "odds": "+120", "sport": "nba", "date": "2026-10-21",
                                 "legs": [{"player": "Jalen Brunson", "stat": "Points", "line": 26.5, "side": "over"}]})
        self.assertEqual((bet["odds"], bet["stake"], bet["sport"], bet["date"], bet["result"]), (120, 1.5, "nba", "2026-10-21", "pending"))
        self.assertEqual(bet["title"], "Jalen Brunson")
        self.assertEqual(bet["legs"][0]["side"], "OVER")


class StoreTests(unittest.TestCase):
    def setUp(self):
        self.store = FakeStore()
        patcher = patch.object(bet_tracker, "_store", return_value=self.store)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_add_change_remove_and_unit(self):
        first = bet_tracker.save("u1", {"kind": "pickem", "stake": 1, "payout": 3, "date": "2026-10-20", "title": "Two-pick"})["bet"]
        bet_tracker.save("u1", {"kind": "pickem", "stake": 2, "payout": 6, "date": "2026-10-22", "title": "Three-pick"})
        listed = bet_tracker.listing("u1")
        self.assertEqual([bet["title"] for bet in listed["bets"]], ["Three-pick", "Two-pick"])   # newest first
        self.assertEqual(listed["unit"], bet_tracker.DEFAULT_UNIT)
        bet_tracker.save("u1", {"id": first["id"], "kind": "pickem", "stake": 1, "payout": 3, "date": "2026-10-20", "title": "Two-pick", "result": "win"})
        listed = bet_tracker.listing("u1")
        self.assertEqual(listed["bets"][1]["profit"], 2)
        self.assertEqual(listed["bets"][1]["id"], first["id"])
        self.assertEqual(bet_tracker.set_unit("u1", "25")["unit"], 25)
        self.assertEqual(bet_tracker.remove("u1", first["id"]), {"removed": 1})
        self.assertEqual(len(bet_tracker.listing("u1")["bets"]), 1)
        self.assertEqual(bet_tracker.listing("u1")["unit"], 25)
        # Another member sees none of it.
        self.assertEqual(bet_tracker.listing("u2")["bets"], [])

    def test_a_slip_is_logged_once(self):
        bet_tracker.save("u1", {"kind": "pickem", "stake": 1, "payout": 3, "slipId": "slip-abc-123"})
        with self.assertRaises(ValueError):
            bet_tracker.save("u1", {"kind": "pickem", "stake": 1, "payout": 3, "slipId": "slip-abc-123"})

    def test_bets_from_tracked_slips_settle_with_them(self):
        legs = [{"player": "A One", "stat": "Points"}, {"player": "B Two", "stat": "Rebounds"}]
        for slip in ("slip-won-0001", "slip-lost-001", "slip-push-001", "slip-wait-001"):
            bet_tracker.save("u1", {"kind": "pickem", "stake": 1, "payout": 3, "slipId": slip, "legs": legs})
        slips = [
            {"id": "slip-won-0001", "status": "won", "picks": [{"player": "A One", "stat": "Points", "result": "hit"}, {"player": "B Two", "stat": "Rebounds", "result": "hit"}]},
            {"id": "slip-lost-001", "status": "lost", "picks": [{"player": "A One", "stat": "Points", "result": "miss"}]},
            {"id": "slip-push-001", "status": "won", "picks": [{"player": "A One", "stat": "Points", "result": "hit"}, {"player": "B Two", "stat": "Rebounds", "result": "void"}]},
            {"id": "slip-wait-001", "status": "pending", "picks": []},
        ]
        bets = {bet["slipId"]: bet for bet in bet_tracker.listing("u1", slips_loader=lambda: slips)["bets"]}
        self.assertEqual((bets["slip-won-0001"]["result"], bets["slip-won-0001"]["profit"]), ("win", 2))
        self.assertEqual(bets["slip-won-0001"]["legs"][0]["result"], "hit")
        self.assertEqual((bets["slip-lost-001"]["result"], bets["slip-lost-001"]["profit"]), ("loss", -1))
        self.assertTrue(bets["slip-push-001"]["check"])   # a pick voided: what it paid is the member's to say
        self.assertEqual(bets["slip-wait-001"]["result"], "pending")
        # Kept, so the next look doesn't need the slips.
        stored = json.loads(self.store.data[bet_tracker.PREFIX + "u1"])
        self.assertEqual(sum(bet["result"] != "pending" for bet in stored["bets"]), 3)


if __name__ == "__main__":
    unittest.main()
