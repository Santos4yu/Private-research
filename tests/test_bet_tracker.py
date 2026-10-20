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


class ReadBetTests(unittest.TestCase):
    """A picture of a bet, as slip_reader.normalize_bet turns what the model read into the form's numbers."""

    def setUp(self):
        import slip_reader
        self.read = slip_reader.normalize_bet

    def test_a_pickem_entry_that_won(self):
        bet = self.read({"app": "PrizePicks", "stake": "$10", "payout": 50, "status": "Won", "date": "2026-10-20",
                         "legs": [{"player": "Jalen Brunson", "pick": "More 24.5 Points", "line": 24.5, "side": "more", "result": "hit"}]})
        self.assertEqual((bet["kind"], bet["stake"], bet["payout"], bet["multiplier"], bet["result"], bet["paid"]),
                         ("pickem", 10, 50, 5, "win", 50))
        self.assertEqual(bet["app"]["name"], "PrizePicks")
        self.assertEqual(bet["legs"][0]["side"], "OVER")

    def test_a_sportsbook_parlay_shown_as_to_win(self):
        bet = self.read({"app": "DraftKings", "stake": 20, "payout": 90, "payout_is_profit": True, "status": "open",
                         "legs": [{"player": "Knicks", "pick": "Knicks -3.5"}, {"player": "Celtics", "pick": "Over 220.5"}]})
        self.assertEqual((bet["kind"], bet["payout"], bet["multiplier"], bet["odds"], bet["result"]), ("parlay", 110, 5.5, 450, "pending"))

    def test_a_straight_bet_from_its_odds_and_a_loss(self):
        bet = self.read({"app": "FanDuel", "stake": 11, "odds": -110, "status": "lost", "legs": [{"player": "Jalen Brunson", "pick": "Over 26.5 Points"}]})
        self.assertEqual((bet["kind"], bet["odds"], bet["payout"], bet["result"], bet["paid"]), ("straight", -110, 21.0, "loss", 0))

    def test_a_flex_entry_that_paid_part(self):
        bet = self.read({"app": "PrizePicks", "entry_type": "Flex Play", "stake": 10, "payout": 100, "status": "won", "paid": 25})
        self.assertEqual((bet["result"], bet["paid"]), ("cashout", 25))

    def test_nothing_to_go_on(self):
        self.assertIsNone(self.read("nope"))
        bet = self.read({"app": "PrizePicks", "status": "won"})
        self.assertIsNone(bet["stake"])
        self.assertIsNone(bet["payout"])


class PickemReadTests(unittest.TestCase):
    """A PrizePicks entry read as a parlay with made-up odds and its "To win" taken for profit: still a 3x pick'em entry."""

    def test_prizepicks_to_win_is_the_whole_payout(self):
        import slip_reader
        bet = slip_reader.normalize_bet({"app": "PrizePicks", "kind": "parlay", "stake": 5, "to_win": 15, "payout_is_profit": True, "odds": -110,
                                         "status": "pending", "legs": [{"player": "Anthony Edwards"}, {"player": "George Kittle"}]})
        self.assertEqual((bet["kind"], bet["payout"], bet["multiplier"], bet["odds"], bet["estimated"]), ("pickem", 15, 3, None, False))

    def test_no_payout_on_the_picture_uses_the_usual_one(self):
        import slip_reader
        bet = slip_reader.normalize_bet({"app": "PrizePicks", "stake": 5, "status": "pending", "legs": [{"player": "A"}, {"player": "B"}]})
        self.assertEqual((bet["payout"], bet["multiplier"], bet["estimated"]), (15, 3, True))
        flex = slip_reader.normalize_bet({"app": "PrizePicks", "entry_type": "Flex Play", "stake": 10, "legs": [{"player": n} for n in "ABCD"]})
        self.assertEqual((flex["multiplier"], flex["payout"]), (6, 60))
        # A sportsbook's "To win" is profit.
        book = slip_reader.normalize_bet({"app": "FanDuel", "stake": 10, "to_win": 9.09, "legs": [{"player": "Knicks", "pick": "Knicks -3.5"}]})
        self.assertEqual((book["kind"], book["payout"], book["odds"]), ("straight", 19.09, -110))


class PrizePicksSlipTests(unittest.TestCase):
    """Two real PrizePicks entries: "2-Pick $10" over "$5 Power Play" is $5 in to pay $10, whatever the
    model made of the numbers on its own, and a cashed "2-Pick $7.50" over "$3.75 Power Play" is a win."""

    def test_the_n_pick_amount_is_the_payout(self):
        import slip_reader
        bet = slip_reader.normalize_bet({"app": "PrizePicks", "kind": "parlay", "entry_type": "Power Play", "stake": 10, "payout": None,
                                         "status": "PENDING", "date": "2026-10-18",
                                         "amounts": [{"label": "2-Pick", "amount": 10}, {"label": "Power Play", "amount": 5}],
                                         "legs": [{"player": "Anthony Edwards", "pick": "More 0.5 Points"}, {"player": "George Kittle", "pick": "More 3.5 Recs", "result": "hit"}]})
        self.assertEqual((bet["kind"], bet["stake"], bet["payout"], bet["multiplier"], bet["estimated"], bet["result"], bet["date"]),
                         ("pickem", 5, 10, 2, False, "pending", "2026-10-18"))

    def test_a_cashed_entry(self):
        import slip_reader
        bet = slip_reader.normalize_bet({"app": "PrizePicks", "entry_type": "Power Play", "status": "Win", "date": "2026-10-19", "sport": "nfl",
                                         "amounts": [{"label": "2-Pick", "amount": 7.5}, {"label": "Power Play", "amount": 3.75}],
                                         "legs": [{"player": "Brock Purdy", "pick": "More 19.5 Rush Yards", "result": "hit"},
                                                  {"player": "Drew Stevens", "pick": "More 0.5 FG Made", "result": "hit"}]})
        self.assertEqual((bet["stake"], bet["payout"], bet["multiplier"], bet["result"], bet["paid"], bet["sport"]), (3.75, 7.5, 2, "win", 7.5, "nfl"))
        self.assertEqual([leg["result"] for leg in bet["legs"]], ["hit", "hit"])

    def test_a_sportsbook_wager_and_to_win(self):
        import slip_reader
        bet = slip_reader.normalize_bet({"app": "FanDuel", "amounts": [{"label": "Wager", "amount": 20}, {"label": "To Win", "amount": 18.18}],
                                         "legs": [{"player": "Knicks", "pick": "Knicks -3.5"}]})
        self.assertEqual((bet["stake"], bet["payout"], bet["odds"]), (20, 38.18, -110))
        self.assertIn('"2-Pick"', slip_reader.BET_PROMPT)
