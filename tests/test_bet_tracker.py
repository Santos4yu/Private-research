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


class PrecisionTests(unittest.TestCase):
    def test_small_stakes_and_odd_payouts_are_kept(self):
        bet = bet_tracker.clean({"kind": "pickem", "stake": 0.588, "payout": 2.10204, "result": "win"})
        self.assertEqual((bet["stake"], bet["payout"]), (0.588, 2.102))
        self.assertAlmostEqual(bet_tracker.profit(bet) * 2.5, 1.62, places=2)   # $1.47 in, $3.09 back


class SlipLinesTests(unittest.TestCase):
    """Amounts read by rule from the slip's lines, copied word for word, and a power play settled by its picks."""

    def test_two_dollars_to_pay_five_sixty_that_lost(self):
        import slip_reader
        # What a model made of it: the payout as the stake, and a "won" with part paid.
        bet = slip_reader.normalize_bet({"app": "PrizePicks", "entry_type": "Power Play", "stake": 5.6, "status": "won", "paid": 5.6, "sport": "tennis",
                                         "money_lines": ["2-Pick Power Play", "$2.00 to pay $5.60"],
                                         "legs": [{"player": "Iga Swiatek", "pick": "Less 22.5 Fantasy Score", "result": "miss"},
                                                  {"player": "Clara Burel", "pick": "More 5.5 Break Points Won", "result": "hit"}]})
        self.assertEqual((bet["kind"], bet["stake"], bet["payout"], bet["multiplier"], bet["estimated"], bet["result"], bet["paid"], bet["sport"]),
                         ("pickem", 2, 5.6, 2.8, False, "loss", 0, "tennis"))

    def test_every_way_an_amount_is_written(self):
        import slip_reader
        read = lambda lines, pickem=True: slip_reader._from_lines({"money_lines": lines}, pickem)
        self.assertEqual(read(["2-Pick $10", "$5 Power Play"]), (5, 10, None))
        self.assertEqual(read(["2-Pick $7.50", "$3.75 Power Play"]), (3.75, 7.5, None))
        self.assertEqual(read(["$2.00 to pay $5.60"]), (2, 5.6, None))
        self.assertEqual(read(["Wager $20.00", "To Win $18.18"], False), (20, None, 18.18))
        self.assertEqual(read(["$10 to win $25"], False), (10, None, 25))
        self.assertEqual(read(["Entry Fee: $1,250.00", "Payout $3,750"]), (1250, 3750, None))

    def test_a_power_play_whose_picks_all_hit_won(self):
        import slip_reader
        bet = slip_reader.normalize_bet({"app": "PrizePicks", "status": "pending", "money_lines": ["$5 to pay $15"],
                                         "legs": [{"player": "A", "result": "hit"}, {"player": "B", "result": "hit"}]})
        self.assertEqual((bet["result"], bet["paid"]), ("win", 15))


class PickResultTests(unittest.TestCase):
    """Each pick decided by its own numbers: the Swiatek/Burel entry is lost even when a model calls it won."""

    def test_by_the_numbers(self):
        import slip_reader
        bet = slip_reader.normalize_bet({"app": "PrizePicks", "entry_type": "Power Play", "status": "won", "money_lines": ["$2.00 to pay $5.60"],
                                         "legs": [{"player": "Iga Swiatek", "arrow": "down", "line": 22.5, "actual": 23, "final": True, "result": "hit"},
                                                  {"player": "Clara Burel", "arrow": "up", "line": 5.5, "actual": 6, "final": True, "result": "hit"}]})
        self.assertEqual([leg["result"] for leg in bet["legs"]], ["miss", "hit"])
        self.assertEqual([leg["side"] for leg in bet["legs"]], ["UNDER", "OVER"])
        self.assertEqual((bet["result"], bet["paid"], bet["doubt"]), ("loss", 0, True))

    def test_a_game_still_to_play_keeps_it_open(self):
        import slip_reader
        bet = slip_reader.normalize_bet({"app": "PrizePicks", "status": "", "money_lines": ["2-Pick $10", "$5 Power Play"],
                                         "legs": [{"player": "Anthony Edwards", "arrow": "up", "line": 0.5, "actual": 0, "final": False},
                                                  {"player": "George Kittle", "arrow": "up", "line": 3.5, "actual": 5, "final": True}]})
        self.assertEqual([leg["result"] for leg in bet["legs"]], [None, "hit"])
        self.assertEqual(bet["result"], "pending")
        # An over already past its line is a hit before the game ends; an under past it is a miss.
        live = slip_reader.normalize_bet({"app": "PrizePicks", "money_lines": ["$5 to pay $15"],
                                          "legs": [{"player": "A", "arrow": "up", "line": 20.5, "actual": 24, "final": False},
                                                   {"player": "B", "arrow": "down", "line": 4.5, "actual": 6, "final": False}]})
        self.assertEqual([leg["result"] for leg in live["legs"]], ["hit", "miss"])
        self.assertEqual(live["result"], "loss")


class FastReadTests(unittest.TestCase):
    """Reading a bet quickly: the first reader to answer wins, a picture already read comes back at once,
    and Qwen is asked not to think first."""
    PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64

    def test_the_backup_answers_when_the_first_is_slow(self):
        import time as clock
        import slip_reader
        slow = lambda: clock.sleep(2) or {"app": "PrizePicks", "money_lines": ["$1 to pay $3"]}
        quick = lambda: {"app": "PrizePicks", "money_lines": ["$2.00 to pay $5.60"]}
        with patch.object(slip_reader, "HEAD_START", 0.2):
            began = clock.time()
            bet = slip_reader.read_bet(self.PNG, readers=[slow, quick])
        self.assertLess(clock.time() - began, 1.5)
        self.assertEqual((bet["stake"], bet["payout"]), (2, 5.6))

    def test_a_picture_read_before_comes_back_at_once(self):
        import slip_reader
        kept = {"app": "PrizePicks", "money_lines": ["2-Pick $10", "$5 Power Play"], "status": "pending", "legs": []}   # what the model saw
        with patch.object(slip_reader, "_cached_bet", return_value=kept), \
             patch.object(slip_reader, "_groq", side_effect=AssertionError("no model asked")):
            bet = slip_reader.read_bet(self.PNG)
        self.assertEqual((bet["stake"], bet["payout"], bet["cached"]), (5, 10, True))

    def test_qwen_is_asked_not_to_think(self):
        import slip_reader
        asked = []

        class Answer:
            def __init__(self, text):
                self.choices = [type("C", (), {"message": type("M", (), {"content": text})()})()]

        class Client:
            def __init__(self):
                self.models = type("Models", (), {"list": lambda _: type("L", (), {"data": [type("I", (), {"id": "qwen/qwen3.8-27b"})()]})()})()
                self.chat = type("Chat", (), {"completions": type("Comp", (), {"create": lambda _, **kw: asked.append(kw) or Answer('{"stake": 5}')})()})()

            def with_options(self, **_):
                return self

        slip_reader._available.update(at=0, ids=None)
        with patch.object(slip_reader, "_groq", return_value=Client()), patch.object(slip_reader, "fit_image", return_value=(b"x", "image/jpeg")):
            self.assertEqual(slip_reader._groq_bet(self.PNG, []), {"stake": 5})
        self.assertEqual(asked[0]["reasoning_effort"], "none")
        self.assertEqual(asked[0]["response_format"], {"type": "json_object"})
        slip_reader._available.update(at=0, ids=None)


class RaceTests(unittest.TestCase):
    def test_every_timing(self):
        import time as clock
        import slip_reader

        def after(seconds, value):
            def read():
                clock.sleep(seconds)
                if isinstance(value, Exception):
                    raise value
                return value
            return read
        cases = [([after(2, "A"), after(0, "B")], {"head_start": 0.2}, "B", 1),          # the backup, once the first is slow
                 ([after(0, "A"), after(2, "B")], {"head_start": 0.2}, "A", 0.5),        # the first, when it's quick
                 ([after(0, None), after(0, "B")], {"head_start": 5}, "B", 0.5),         # the next at once when one fails
                 ([after(0, RuntimeError()), after(0, "B")], {"head_start": 5}, "B", 0.5),
                 ([after(2, "A"), after(2, "B")], {"head_start": 0.1, "deadline": 0.4}, None, 1),   # nothing by the deadline
                 ([after(0, None), after(0, None)], {}, None, 0.5)]
        for readers, options, want, limit in cases:
            began = clock.time()
            self.assertEqual(slip_reader.race(readers, **options), want)
            self.assertLess(clock.time() - began, limit)



class AppWordsTests(unittest.TestCase):
    def test_a_prizepicks_win_the_model_called_draftkings(self):
        import slip_reader
        bet = slip_reader.normalize_bet({"app": "DraftKings", "kind": "pickem", "entry_type": "2-Pick Power Play", "status": "Win", "paid": 7.5,
                                         "sport": "soccer", "money_lines": ["2-Pick Power Play", "$2.50 to win $7.50"],
                                         "legs": [{"player": "Virgil van Dijk", "arrow": "up", "line": 11, "actual": 16.65, "final": True},
                                                  {"player": "Cucho Hernandez", "arrow": "down", "line": 2.5, "actual": 1, "final": True}]})
        self.assertEqual((bet["app"]["name"], bet["stake"], bet["payout"], bet["multiplier"], bet["result"], bet["paid"]),
                         ("PrizePicks", 2.5, 7.5, 3, "win", 7.5))
        self.assertEqual([leg["result"] for leg in bet["legs"]], ["hit", "hit"])

    def test_a_sportsbook_keeps_its_to_win(self):
        import slip_reader
        bet = slip_reader.normalize_bet({"app": "DraftKings", "money_lines": ["$10 to win $25"], "legs": [{"player": "Knicks", "pick": "Knicks ML"}]})
        self.assertEqual((bet["app"]["name"], bet["payout"], bet["odds"]), ("DraftKings", 35, 250))
