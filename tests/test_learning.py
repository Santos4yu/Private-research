"""Learning from results (learning.py) and the picks it learns from (slip_ledger.learn)."""
import json
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import learning  # noqa: E402
import slip_ledger  # noqa: E402
from tests.test_slip_ledger import FakeStore, pick, slip  # noqa: E402

NOW = datetime(2026, 10, 4, 15, 0, tzinfo=timezone.utc)


def settled(n, hits, chance, sport="nba", tier="strong", **extra):
    """n settled picks the model gave `chance`, `hits` of them hits."""
    return [("2026-10-01", f"{sport}-{chance}-{i}", {"sport": sport, "tier": tier, "chance": chance, "raw": chance,
                                                        "result": "hit" if i < hits else "miss", "late": False, **extra})
            for i in range(n)]


def offset(model, group, chance):
    band = learning._band(chance)
    for predicted, value, *_ in model["groups"][group]["points"]:
        if learning._band(predicted) == band:
            return value
    return None


class FitTests(unittest.TestCase):
    def test_too_sure_comes_down_a_step_at_a_time(self):
        # 400 NBA picks called 72% that hit 60%.
        model = learning.fit(settled(400, 240, 0.72), now=NOW)
        self.assertEqual(offset(model, "nba", 0.72), -0.03)
        self.assertEqual(offset(model, "all", 0.72), -0.03)
        # Day after day it keeps going, never more than STEP a day, and stops where the results are.
        for _ in range(10):
            model = learning.fit(settled(400, 240, 0.72), previous=model, now=NOW)
        self.assertLess(offset(model, "all", 0.72), -0.1)
        self.assertGreater(offset(model, "all", 0.72), -0.12)

    def test_a_few_results_change_nothing(self):
        model = learning.fit(settled(10, 2, 0.7), now=NOW)
        self.assertEqual(offset(model, "nba", 0.7), 0.0)
        self.assertEqual(model["picks"], 10)

    def test_a_small_sport_borrows_the_all_sports_correction(self):
        entries = settled(300, 180, 0.7, sport="nba") + settled(10, 10, 0.7, sport="nhl")
        model = learning.fit(entries, now=NOW)
        self.assertEqual(offset(model, "nhl", 0.7), offset(model, "all", 0.7))

    def test_modest_picks_go_up(self):
        model = learning.fit(settled(300, 240, 0.62), now=NOW)
        self.assertEqual(offset(model, "nba", 0.62), 0.03)

    def test_late_pushes_voids_and_unknown_dont_count(self):
        entries = (settled(50, 50, 0.7, late=True) + [("d", "p", {"sport": "nba", "chance": 0.7, "result": "push"}),
                   ("d", "v", {"sport": "nba", "chance": 0.7, "result": "void"}), ("d", "u", {"sport": "nba", "chance": 0.7, "result": None})])
        self.assertEqual(learning.fit(entries, now=NOW)["picks"], 0)

    def test_it_learns_from_the_raw_chance_not_yesterdays_correction(self):
        entries = [(d, k, {**p, "chance": 0.6}) for d, k, p in settled(300, 180, 0.72)]
        model = learning.fit(entries, now=NOW)
        self.assertIsNotNone(offset(model, "nba", 0.72))
        self.assertIsNone(offset(model, "nba", 0.6))

    def test_the_tiers_show_what_they_said_and_what_happened(self):
        model = learning.fit(settled(100, 70, 0.75, tier="elite"), now=NOW)
        self.assertEqual(model["tiers"]["elite"], {"picks": 100, "hits": 70, "predicted": 0.75, "actual": 0.7})


class ParlayRecordTests(unittest.TestCase):
    def test_a_parlay_counts_once_every_pick_is_settled(self):
        parlays = [("d", "s1", {"letter": "A+", "picks": [{"day": "d", "key": "a"}, {"day": "d", "key": "b"}]}),
                   ("d", "s2", {"letter": "A-", "picks": [{"day": "d", "key": "a"}, {"day": "d", "key": "c"}]}),
                   ("d", "s3", {"letter": "B", "picks": [{"day": "d", "key": "a"}, {"day": "d", "key": "x"}]}),
                   ("d", "s4", {"letter": "F", "picks": [{"day": "d", "key": "c"}]}),
                   ("d", "s5", {"letter": "A", "late": True, "picks": [{"day": "d", "key": "a"}]})]
        results = {("d", "a"): "hit", ("d", "b"): "hit", ("d", "c"): "miss", ("d", "x"): None}
        record = learning.parlay_record(parlays, results)
        self.assertEqual(record["A"], {"hits": 1, "misses": 1, "slips": 2, "rate": 0.5})
        self.assertEqual(record["B"]["slips"], 0)
        self.assertEqual(record["D"]["misses"], 1)


class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.store = FakeStore()
        patcher = patch.object(slip_ledger, "_store", return_value=self.store)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_the_sites_own_picks_are_kept_once_and_capped_a_day(self):
        first = slip_ledger.learn({"picks": [pick(raw=0.66), pick(player="Dak Prescott", stat="Pass Yards", line=250.5)]}, now=NOW)
        self.assertEqual(first["kept"], 2)
        again = slip_ledger.learn({"picks": [pick(tier="elite")]}, now=NOW)
        self.assertEqual(again["kept"], 0)
        day = slip_ledger._eastern_day(NOW + timedelta(hours=2))
        kept = [json.loads(raw) for raw in self.store.data[slip_ledger.PREFIX + "ledger:" + day].values()]
        self.assertTrue(all(item["source"] == "board" for item in kept))
        self.assertIn(0.66, [item["raw"] for item in kept])
        with patch.object(slip_ledger, "LEARN_PER_DAY", 4):  # 3 asked for so far
            capped = slip_ledger.learn({"picks": [pick(player=f"P{i}") for i in range(5)]}, now=NOW)
        self.assertEqual(capped["kept"], 1)

    def test_a_graded_slip_is_kept_for_the_record_by_grade(self):
        slip_ledger.save("member-a", slip(letter="A", source="builder"), now=NOW)
        slip_ledger.save("member-b", slip(letter="C"), now=NOW)
        kept = slip_ledger.parlays([slip_ledger._eastern_day(NOW + timedelta(hours=2))])
        self.assertEqual([parlay["letter"] for _, _, parlay in kept], ["A"])
        self.assertEqual(kept[0][2]["source"], "builder")

    def test_the_daily_learning_runs_once_a_day_on_the_timer(self):
        with patch.object(learning, "_store", return_value=self.store), patch.dict(learning._memory, clear=True):
            first = learning.daily(NOW)
            self.assertIsNotNone(first)
            learning._memory.clear()
            self.assertIsNone(learning.daily(NOW + timedelta(hours=3)))
            learning._memory.clear()
            self.assertIsNotNone(learning.daily(NOW + timedelta(hours=21)))

    def test_members_parlays_stay_off_the_record(self):
        # The record is only what the admin posts (slip_ledger.RECORD): the
        # members' parlays are counted for the model, not shown as the record.
        slip_ledger.save("member-a", slip(letter="A", source="builder"), now=NOW)
        with patch.object(learning, "_store", return_value=self.store), patch.dict(learning._memory, clear=True), \
                patch.object(slip_ledger, "settle", return_value={}):
            learning.daily(NOW)
            shown = slip_ledger.history("member-a", now=NOW)
        self.assertNotIn("parlays", shown["record"])
        self.assertEqual(shown["record"]["picks"], 0)


if __name__ == "__main__":
    unittest.main()
