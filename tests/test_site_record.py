"""The site's own record (Nov 9): every moneyline the Game Predictor picked
(game_record.py) and the prop generator's plays and the Props tab's picks
(slip_ledger.py), on an in-memory store."""
import json
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import game_record  # noqa: E402
import slip_ledger  # noqa: E402

NOW = datetime(2026, 11, 9, 17, 0, tzinfo=timezone.utc)


class FakeStore:
    """GET/SET and the hash commands the record uses."""
    def __init__(self):
        self.data = {}

    def get(self, key, **_):
        value = self.data.get(key)
        return value if isinstance(value, str) else None

    def set(self, key, value, ex=None):
        self.data[key] = value
        return True

    def pipeline(self, commands, **_):
        out = []
        for command in commands:
            op, key = command[0], command[1]
            if op == "HGET":
                out.append({"result": self.data.get(key, {}).get(command[2])})
            elif op == "HSET":
                bucket = self.data.setdefault(key, {})
                for field, value in zip(command[2::2], command[3::2]):
                    bucket[field] = value
                out.append({"result": 1})
            elif op == "HGETALL":
                out.append({"result": [item for pair in self.data.get(key, {}).items() for item in pair]})
            elif op == "GET":
                value = self.data.get(key)
                out.append({"result": value if isinstance(value, str) else None})
            elif op == "SET":
                self.data[key] = command[2]
                out.append({"result": "OK"})
            elif op == "EXPIRE":
                out.append({"result": 1})
            else:
                raise AssertionError(op)
        return out


def found(event="401", home="DEN", away="BOS", winner="home", chance=0.64, market=0.58, price=-150, starts=None, confidence="Medium"):
    """A prediction as game_predictor.prediction makes it (the fields the record reads)."""
    starts = starts or (NOW + timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%SZ")
    other = "away" if winner == "home" else "home"
    return {"id": event, "sport": "nba", "startsAt": starts, "state": "pre", "home": {"abbr": home}, "away": {"abbr": away}, "winner": winner,
            "chance": {winner: chance, other: 1 - chance}, "market": {"chance": {winner: market, other: 1 - market}, "moneyline": {winner: price, other: 130}},
            "confidence": confidence, "pickedBy": "model", "score": {"home": 115, "away": 108}}


class MoneylineRecord(unittest.TestCase):
    def setUp(self):
        self.store = FakeStore()
        patcher = patch.object(game_record, "season_of", return_value=2027)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_every_game_still_to_start_is_kept_and_the_last_read_before_tip_off_stands(self):
        self.assertEqual(game_record.remember("nba", [found(), found("402", "LAL", "GS", "away", 0.55, 0.47, 120)], NOW, self.store), 2)
        held = game_record.entries("nba", 2027, self.store)
        self.assertEqual(sorted(held), ["401", "402"])
        entry = held["401"]
        self.assertEqual((entry["side"], entry["chance"], entry["market"], entry["price"], entry["day"]), ("home", 0.64, 0.58, -150, "2026-11-09"))
        self.assertAlmostEqual(entry["dec"], 1 + 100 / 150, places=4)
        # The same read again changes nothing; a newer one replaces it.
        self.assertEqual(game_record.remember("nba", [found()], NOW, self.store), 0)
        self.assertEqual(game_record.remember("nba", [found(chance=0.6)], NOW, self.store), 1)
        self.assertEqual(game_record.entries("nba", 2027, self.store)["401"]["chance"], 0.6)
        # A game already on isn't touched.
        started = found("403", starts=(NOW - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ"))
        self.assertEqual(game_record.remember("nba", [started], NOW, self.store), 0)

    def test_settled_from_the_final_score_with_units_at_the_price(self):
        game_record.remember("nba", [found(), found("402", "LAL", "GS", "away", 0.55, 0.47, 120)], NOW, self.store)
        later = NOW + timedelta(hours=7)
        held = game_record.entries("nba", 2027, self.store)
        settled = game_record.settle_due("nba", 2027, held, later, self.store, finals=lambda sport, ids: {"401": (112, 104), "402": (120, 101)})
        self.assertEqual(settled, 2)
        held = game_record.entries("nba", 2027, self.store)
        self.assertTrue(held["401"]["result"]["correct"])
        self.assertAlmostEqual(held["401"]["result"]["units"], 0.6667, places=3)
        # GS (away) lost 120-101.
        self.assertFalse(held["402"]["result"]["correct"])
        self.assertEqual(held["402"]["result"]["units"], -1.0)
        record = game_record.read("nba", later, self.store, finals=lambda sport, ids: {}, remaining=0)["record"]
        self.assertEqual((record["wins"], record["losses"], record["units"]), (1, 1, -0.33))
        # DEN at 58% was the market's favorite; GS at 47% its underdog.
        self.assertEqual((record["favorites"]["wins"], record["underdogs"]["losses"]), (1, 1))
        self.assertEqual(record["confidence"]["Medium"]["wins"], 1)
        self.assertEqual(record["days"][0]["day"], "2026-11-09")

    def test_the_season_so_far_filled_in_a_date_at_a_time_oldest_first(self):
        day = lambda n: datetime(2026, 10, 21 + n, 23, 30, tzinfo=timezone.utc)
        games = [{"id": f"g{n}{k}", "when": day(n), "final": (110, 100)} for n in range(4) for k in range(3)]
        replayed = []

        def replayer(game):
            replayed.append(game["id"])
            entry = game_record.entry_of(found(game["id"], starts=game["when"].strftime("%Y-%m-%dT%H:%M:%SZ")), NOW, filled=True)
            return game_record.gp.settle(entry, game["final"])
        step = game_record.fill("nba", NOW, self.store, most=6, games=games, replayer=replayer)
        self.assertEqual(step, {"added": 6, "remaining": 6, "through": "2026-10-22"})
        self.assertEqual(replayed[:3], ["g00", "g01", "g02"])
        # The next step picks up where it stopped; nothing kept is replayed.
        step = game_record.fill("nba", NOW, self.store, most=40, games=games, replayer=replayer)
        self.assertEqual(step, {"added": 6, "remaining": 0, "through": "2026-10-24"})
        self.assertEqual(len(replayed), 12)
        self.assertEqual(game_record.fill("nba", NOW, self.store, games=games, replayer=replayer)["remaining"], 0)
        record = game_record.read("nba", NOW, self.store, finals=lambda sport, ids: {}, remaining=0)["record"]
        # Replayed games are kept apart: the record is live picks only.
        self.assertEqual(record["games"], 0)
        self.assertEqual((record["replay"]["games"], record["replay"]["wins"], record["replay"]["since"]), (12, 12, "2026-10-21"))
        # A game there's nothing to call it on is kept as skipped: not tried again, not counted.
        extra = [{"id": "x1", "when": day(5), "final": (100, 90)}]
        self.assertEqual(game_record.fill("nba", NOW, self.store, games=extra, replayer=lambda game: None), {"added": 0, "remaining": 0, "through": "2026-10-26"})
        self.assertEqual(game_record.fill("nba", NOW, self.store, games=extra, replayer=lambda game: None)["remaining"], 0)
        shown = game_record.read("nba", NOW, self.store, finals=lambda sport, ids: {}, remaining=0)
        # The page's record and list are live picks only; the replay is summed apart.
        self.assertEqual((shown["record"]["games"], shown["record"]["pending"], len(shown["items"]), shown["record"]["replay"]["games"]), (0, 0, 0, 12))


def gen_play(player="Jalen Brunson", stat="Assists", key="player_assists", line=6.5, strength="strong", hours=3, **extra):
    return {"sport": "nba", "player": player, "playerId": "1", "team": "NY", "opponent": "MIA", "startsAt": (NOW + timedelta(hours=hours)).isoformat(),
            "side": "OVER", "line": line, "stat": stat, "modifier": "standard", "tier": "strong", "chance": 0.58, "settle": {"kind": "key", "key": key},
            "strength": strength, "confidence": 74, "projection": 8.2, **extra}


class PropRecord(unittest.TestCase):
    def setUp(self):
        self.store = FakeStore()
        for patcher in (patch.object(slip_ledger, "_store", return_value=self.store), patch.dict(slip_ledger._memory, clear=True)):
            patcher.start()
            self.addCleanup(patcher.stop)

    def kept(self):
        return [json.loads(value) for key, bucket in self.store.data.items() if key.startswith(slip_ledger.PREFIX + slip_ledger.GEN)
                for value in bucket.values()]

    def test_the_generator_plays_kept_checked_and_the_last_call_before_tip_off_stands(self):
        out = slip_ledger.generator_add({"plays": [gen_play(), gen_play("Blocker", "Blocks", "player_blocks"), gen_play("Soon", hours=-1),
                                                   {**gen_play("Football"), "sport": "nfl"}]}, NOW)
        self.assertEqual(out, {"kept": 1, "dropped": 0})
        [play] = self.kept()
        self.assertEqual((play["player"], play["strength"], play["confidence"], play["projection"], play["dropped"]), ("Jalen Brunson", "strong", 74, 8.2, False))
        # A newer read takes over; passed on later, it's dropped; played again, it's back.
        slip_ledger.generator_add({"plays": [gen_play(strength="best", confidence=81)]}, NOW)
        self.assertEqual((self.kept()[0]["strength"], self.kept()[0]["confidence"]), ("best", 81))
        self.assertEqual(slip_ledger.generator_add({"passes": [gen_play()]}, NOW), {"kept": 0, "dropped": 1})
        self.assertTrue(self.kept()[0]["dropped"])
        slip_ledger.generator_add({"plays": [gen_play()]}, NOW)
        self.assertFalse(self.kept()[0]["dropped"])
        # A pass never played adds nothing.
        self.assertEqual(slip_ledger.generator_add({"passes": [gen_play("Never Played")]}, NOW), {"kept": 0, "dropped": 0})

    def test_the_generator_record_by_strength_and_stat_dropped_left_out(self):
        rows = [("2026-11-09", "a", {**gen_play(), "result": "hit"}), ("2026-11-09", "b", {**gen_play("B", strength="best"), "result": "miss"}),
                ("2026-11-09", "c", {**gen_play("C", "Points", "player_points", 24.5, "best"), "result": "hit"}),
                ("2026-11-09", "d", {**gen_play("D"), "result": "miss", "dropped": True}), ("2026-11-09", "e", {**gen_play("E"), "result": None})]
        record = slip_ledger.generator_record(NOW, entries=rows)
        self.assertEqual((record["all"]["hits"], record["all"]["misses"], record["pending"]), (2, 1, 1))
        self.assertEqual((record["strengths"]["best"]["hits"], record["strengths"]["best"]["misses"]), (1, 1))
        self.assertEqual(record["stats"]["Points"]["hits"], 1)
        self.assertNotIn("D", [play["player"] for play in record["latest"]])

    def test_the_props_tab_picks_summed_up_a_day_at_a_time(self):
        def ledger_pick(sport, tier, result, source="board", side="OVER"):
            return json.dumps({"sport": sport, "tier": tier, "result": result, "source": source, "side": side, "modifier": "standard", "late": False})
        day = (NOW - timedelta(days=3)).date().isoformat()
        self.store.data[slip_ledger.PREFIX + "ledger:" + day] = {
            "1": ledger_pick("nba", "elite", "hit"), "2": ledger_pick("nba", "elite", "miss"), "3": ledger_pick("nba", "strong", "hit"),
            "4": ledger_pick("mlb", "strong", "hit"), "5": ledger_pick("nba", "elite", "hit", source="analyzer"),
            "6": ledger_pick("nba", "elite", "hit", side="UNDER"), "7": ledger_pick("nba", "risky", "hit")}
        written = slip_ledger.archive_board_days(NOW, most=40)
        self.assertIn(day, written)
        self.assertEqual(json.loads(self.store.data[slip_ledger.PREFIX + slip_ledger.BOARD_DAY + day]), {"nba": {"elite": [1, 1], "strong": [1, 0]}, "mlb": {"strong": [1, 0]}})
        # Summed up once.
        self.assertEqual(slip_ledger.archive_board_days(NOW, most=40), [])
        record = slip_ledger.board_record(NOW)
        self.assertEqual((record["all"]["hits"], record["all"]["misses"]), (3, 1))
        self.assertEqual(record["tiers"]["elite"]["rate"], 0.5)
        self.assertEqual(record["sports"]["mlb"]["all"]["hits"], 1)


if __name__ == "__main__":
    unittest.main()
