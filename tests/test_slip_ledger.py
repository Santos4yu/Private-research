"""Graded slips and how they finished (slip_ledger.py), on an in-memory store."""
import json
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import slip_ledger  # noqa: E402

NOW = datetime(2026, 10, 4, 15, 0, tzinfo=timezone.utc)
KICK = (NOW + timedelta(hours=2)).isoformat()


class FakeStore:
    """GET/SET and the hash commands the ledger uses."""
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
                self.data.setdefault(key, {})[command[2]] = command[3]
                out.append({"result": 1})
            elif op == "HGETALL":
                flat = [item for pair in self.data.get(key, {}).items() for item in pair]
                out.append({"result": flat})
            elif op == "EXPIRE":
                out.append({"result": 1})
            else:
                raise AssertionError(op)
        return out


def pick(player="CeeDee Lamb", stat="Receiving Yards", line=59.5, side="OVER", tier="strong", **extra):
    return {"sport": "nfl", "player": player, "playerId": "00-1", "team": "DAL", "opponent": "LA", "startsAt": KICK,
            "side": side, "line": line, "stat": stat, "modifier": "standard", "tier": tier, "chance": 0.64,
            "position": "WR", "average": 62.0, "settle": {"kind": "key", "key": "receiving_yards"}, **extra}


def slip(slip_id="slip-0001", picks=None, **extra):
    return {"id": slip_id, "app": "prizepicks", "appName": "PrizePicks", "type": "power", "letter": "B+", "chance": 0.4,
            "multiplier": 3, "value": 1.2, "picks": picks or [pick()], **extra}


def final(players, state="post", off=False):
    """slip_games.read's answer for one game."""
    def read(payload):
        games = []
        for item in payload["games"]:
            games.append({"found": True, "state": state, "off": off, "team": item["team"], "opponent": item["opponent"],
                          "players": {person["key"]: players.get(person["name"]) for person in item["players"]}, "injuries": {}})
        return {"games": games}
    return read


class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.store = FakeStore()
        patcher = patch.object(slip_ledger, "_store", return_value=self.store)
        patcher.start()
        self.addCleanup(patcher.stop)
        slip_ledger._memory.clear()

    def ledger(self):
        return [json.loads(raw) for key, value in self.store.data.items() if ":ledger:" in key for raw in value.values()]

    def test_one_pick_counts_once_and_keeps_its_owners(self):
        slip_ledger.save("member-a", slip(), now=NOW)
        slip_ledger.save("member-b", slip("slip-0002", picks=[pick(tier="elite")]), now=NOW)
        entries = self.ledger()
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["owners"], ["member-a", "member-b"])
        self.assertEqual(entries[0]["tier"], "elite")  # graded again before kickoff: the newer tier
        # The same slip saved again (a pick fixed) replaces itself in the member's list.
        slip_ledger.save("member-a", slip(picks=[pick(), pick(player="Dak Prescott", stat="Pass Yards", line=245.5,
                                                               settle={"kind": "key", "key": "passing_yards"})]), now=NOW)
        mine = json.loads(self.store.data[slip_ledger.PREFIX + "user:member-a"])
        self.assertEqual([len(item["picks"]) for item in mine], [2])

    def test_the_same_parlay_graded_again_is_not_a_new_slip(self):
        dak = pick(player="Dak Prescott", stat="Pass Yards", line=245.5, settle={"kind": "key", "key": "passing_yards"})
        mine = lambda: json.loads(self.store.data[slip_ledger.PREFIX + "user:member-a"])  # noqa: E731
        first = slip_ledger.save("member-a", slip("slip-0001", picks=[pick(), dak]), now=NOW)
        self.assertFalse(first["again"])
        # Uploaded again later, picks in another order: the slip already kept, in its place and with its time.
        again = slip_ledger.save("member-a", slip("slip-0002", picks=[dak, pick()], letter="A-"), now=NOW + timedelta(minutes=20))
        self.assertEqual((again["id"], again["again"]), ("slip-0001", True))
        self.assertEqual([(item["id"], item["at"], item["letter"]) for item in mine()], [("slip-0001", NOW.isoformat(), "A-")])
        # Read as a Flex Play the second time: the props are what make it the same slip.
        self.assertEqual(slip_ledger.save("member-a", slip("slip-0009", picks=[pick(), dak], type="flex"), now=NOW)["id"], "slip-0001")
        # A different prop is a different parlay.
        cooks = pick(player="Brandin Cooks", stat="Receptions", line=3.5, settle={"kind": "key", "key": "receptions"})
        slip_ledger.save("member-a", slip("slip-0003", picks=[pick(), dak, cooks]), now=NOW)
        slip_ledger.save("member-a", slip("slip-0004", picks=[pick(), cooks]), now=NOW)
        self.assertEqual([item["id"] for item in mine()], ["slip-0004", "slip-0003", "slip-0001"])
        # A slip fixed into a copy of one already kept folds into it.
        slip_ledger.save("member-a", slip("slip-0003", picks=[dak, pick()]), now=NOW)
        self.assertEqual([item["id"] for item in mine()], ["slip-0004", "slip-0001"])
        # Once a game has started, grading the same parlay again doesn't change the grade it had.
        slip_ledger.save("member-a", slip("slip-0005", picks=[pick(), dak], letter="C"), now=NOW + timedelta(hours=3))
        self.assertEqual([(item["id"], item["letter"]) for item in mine()], [("slip-0004", "B+"), ("slip-0001", "B+")])
        # The record still counts each pick once.
        self.assertEqual(len(self.ledger()), 3)

    def test_copies_kept_before_are_shown_once(self):
        key = slip_ledger.PREFIX + "user:member-a"
        slip_ledger.save("member-a", slip("slip-0001"), now=NOW)
        first = json.loads(self.store.data[key])[0]
        # Two copies of one parlay already in the list (kept before copies were matched).
        self.store.data[key] = json.dumps([{**first, "id": "slip-0002", "at": (NOW + timedelta(minutes=13)).isoformat()}, first])
        with patch("slip_games.read", side_effect=final({}, state="pre")):
            shown = slip_ledger.history("member-a", now=NOW)
        self.assertEqual([item["id"] for item in shown["slips"]], ["slip-0001"])
        # Graded again: one slip, the first one, and the copy is gone from the list.
        slip_ledger.save("member-a", slip("slip-0003"), now=NOW)
        self.assertEqual([item["id"] for item in json.loads(self.store.data[key])], ["slip-0001"])

    def test_a_pick_graded_after_kickoff_is_kept_but_not_counted(self):
        slip_ledger.save("member-a", slip(picks=[pick(startsAt=(NOW - timedelta(hours=1)).isoformat())]), now=NOW)
        self.assertTrue(self.ledger()[0]["late"])

    def test_bad_input_is_refused(self):
        with self.assertRaises(ValueError):
            slip_ledger.save("member-a", {"id": "x", "picks": [pick()]}, now=NOW)
        with self.assertRaises(ValueError):
            slip_ledger.save("member-a", slip(picks=[{"player": "No Sport"}]), now=NOW)

    def test_settled_from_the_final_box_score(self):
        slip_ledger.save("member-a", slip(picks=[pick(), pick(player="Dak Prescott", stat="Pass Yards", line=245.5,
                                                          settle={"kind": "key", "key": "passing_yards"}),
                                                 pick(player="Brandin Cooks", stat="Receptions", line=3.5, side="UNDER",
                                                      settle={"kind": "key", "key": "receptions"})]), now=NOW)
        later = NOW + timedelta(hours=6)
        players = {"CeeDee Lamb": {"name": "CeeDee Lamb", "line": {"receiving_yards": 88}},
                   "Dak Prescott": {"name": "Dak Prescott", "line": {"passing_yards": 201}}}  # Cooks didn't play
        with patch("slip_games.read", side_effect=final(players)):
            shown = slip_ledger.history("member-a", now=later)
        results = {item["player"]: item["result"] for item in shown["slips"][0]["picks"]}
        self.assertEqual(results, {"CeeDee Lamb": "hit", "Dak Prescott": "miss", "Brandin Cooks": "void"})
        self.assertEqual(shown["slips"][0]["status"], "lost")
        record = slip_ledger.record(later, entries=[(None, None, entry) for entry in self.ledger()])
        self.assertEqual((record["tiers"]["strong"]["hits"], record["tiers"]["strong"]["misses"], record["picks"]), (1, 1, 2))

    def test_not_settled_before_the_game_is_over(self):
        slip_ledger.save("member-a", slip(), now=NOW)
        with patch("slip_games.read", side_effect=final({}, state="in")):
            shown = slip_ledger.history("member-a", now=NOW + timedelta(hours=6))
        self.assertEqual(shown["slips"][0]["status"], "pending")
        # Postponed: void.
        with patch("slip_games.read", side_effect=final({}, off=True)):
            shown = slip_ledger.history("member-a", now=NOW + timedelta(hours=7))
        self.assertEqual(shown["slips"][0]["picks"][0]["result"], "void")

    def test_mlb_numbers_add_up_the_finders_way(self):
        batting = {"hits": 2, "runs": 1, "rbi": 2, "doubles": 1, "homeRuns": 1, "baseOnBalls": 1, "stolenBases": 1}
        self.assertEqual(slip_ledger.mlb_value(batting, "hrr"), 5)
        self.assertEqual(slip_ledger.mlb_value(batting, "totalBases"), 2 + 1 + 3)
        self.assertEqual(slip_ledger.mlb_value(batting, "fantasy"), 0 * 3 + 5 + 10 + 2 + 4 + 2 + 5)
        self.assertEqual(slip_ledger.mlb_value({"inningsPitched": "5.2", "strikeOuts": 7, "earnedRuns": 2, "wins": 1}, "outs"), 17)
        self.assertEqual(slip_ledger.value_of({"kind": "mlb", "field": "strikeOuts", "pitcher": True},
                                              {"line": {"pitching": {"strikeOuts": 8}, "batting": {}}}), 8)
        self.assertIsNone(slip_ledger.value_of({"kind": "mlb", "field": "hits", "pitcher": False}, {"line": {"batting": {}, "pitching": {}}}))
        self.assertEqual(slip_ledger.value_of({"kind": "soccer", "key": "ga"}, {"line": {"s": {"goals": 1, "ast": 1}}}), 2)

    def test_news_before_the_game_is_sent_once(self):
        slip_ledger.save("member-a", slip(picks=[pick(player="Jalon Daniels", stat="Pass Attempts", line=28.5, side="UNDER",
                                                      position="QB", average=14.8, settle={"kind": "key", "key": "passing_attempts"})]), now=NOW)
        def read(payload):
            item = payload["games"][0]
            return {"games": [{"found": True, "state": "pre", "team": "DAL", "opponent": "LA", "players": {},
                               "injuries": {"DAL": [{"name": "Baker Mayfield", "status": "Out", "position": "QB"},
                                                    {"name": "Some Guard", "status": "Out", "position": "G"}]}}]}
        sent = []
        # push_notices needs the server's crypto library; a stand-in takes the messages.
        notices = SimpleNamespace(deliver=lambda messages: sent.append(messages) or {"sent": 1})
        with patch("slip_games.read", side_effect=read), patch.dict(sys.modules, {"push_notices": notices}):
            first = slip_ledger.tick(now=NOW)
            second = slip_ledger.tick(now=NOW + timedelta(minutes=10))
        self.assertEqual(first["sent"], 1)
        self.assertEqual(second["sent"], 0)
        body = sent[0]["member-a"][0]["body"]
        self.assertEqual(body, "Mayfield (QB) is out, so Daniels likely steps in. Recheck your Jalon Daniels Under 28.5 Pass Attempts.")


if __name__ == "__main__":
    unittest.main()
