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
            elif op == "HSETNX":
                bucket = self.data.setdefault(key, {})
                fresh = command[2] not in bucket
                if fresh:
                    bucket[command[2]] = command[3]
                out.append({"result": 1 if fresh else 0})
            elif op == "INCRBY":
                self.data[key] = str(int(self.data.get(key) or 0) + int(command[2]))
                out.append({"result": int(self.data[key])})
            elif op == "SET":
                taken = "NX" in command[3:] and key in self.data
                if not taken:
                    self.data[key] = command[2]
                out.append({"result": None if taken else "OK"})
            elif op == "EXPIRE":
                out.append({"result": 1})
            elif op == "HDEL":
                bucket = self.data.get(key, {})
                out.append({"result": sum(1 for field in command[2:] if bucket.pop(field, None) is not None)})
            elif op == "DEL":
                out.append({"result": sum(1 for name in command[1:] if self.data.pop(name, None) is not None)})
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
        # The ledger still holds each pick once.
        self.assertEqual(len(self.ledger()), 3)

    def test_only_graded_goes_in_the_ledger_but_is_not_tracked(self):
        key = slip_ledger.PREFIX + "user:member-a"
        shown = slip_ledger.save("member-a", slip(track=False), now=NOW)
        self.assertEqual((shown["tracked"], shown["id"]), (False, "slip-0001"))
        self.assertNotIn(key, self.store.data)
        self.assertEqual(self.ledger()[0]["owners"], [])  # in the ledger, nobody's alerts
        # Tracked: on their list, theirs for alerts.
        self.assertTrue(slip_ledger.save("member-a", slip(), now=NOW)["tracked"])
        self.assertEqual(self.ledger()[0]["owners"], ["member-a"])
        # Graded again later without tracking: already theirs, said so, list as it was.
        again = slip_ledger.save("member-a", slip("slip-0002", track=False), now=NOW)
        self.assertEqual((again["tracked"], again["id"]), (True, "slip-0001"))
        self.assertEqual([item["id"] for item in json.loads(self.store.data[key])], ["slip-0001"])

    def test_a_tracked_slip_can_be_removed(self):
        key = slip_ledger.PREFIX + "user:member-a"
        dak = pick(player="Dak Prescott", stat="Pass Yards", line=245.5, settle={"kind": "key", "key": "passing_yards"})
        slip_ledger.save("member-a", slip("slip-0001", picks=[pick(), dak]), now=NOW)
        slip_ledger.save("member-a", slip("slip-0002", picks=[dak]), now=NOW)
        slip_ledger.save("member-b", slip("slip-0003", picks=[pick()]), now=NOW)
        self.assertEqual(slip_ledger.remove("member-a", "slip-0001"), {"removed": 1})
        self.assertEqual([item["id"] for item in json.loads(self.store.data[key])], ["slip-0002"])
        owners = {entry["player"]: entry["owners"] for entry in self.ledger()}
        # Lamb's pick is no longer theirs; Dak's still is (their other slip); member-b keeps Lamb.
        self.assertEqual(owners, {"CeeDee Lamb": ["member-b"], "Dak Prescott": ["member-a"]})
        self.assertEqual(slip_ledger.remove("member-a", "slip-0009"), {"removed": 0})
        with self.assertRaises(ValueError):
            slip_ledger.remove("member-a", "x")

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



class AdminRecordTests(unittest.TestCase):
    """The site's record: only what the admin posts, never the members' grading."""
    def setUp(self):
        self.store = FakeStore()
        patcher = patch.object(slip_ledger, "_store", return_value=self.store)
        patcher.start()
        self.addCleanup(patcher.stop)
        slip_ledger._memory.clear()

    def posted(self):
        return [json.loads(raw) for key, value in self.store.data.items() if ":record:" in key for raw in value.values()]

    def test_members_grading_never_reaches_the_record(self):
        slip_ledger.save("member-a", slip(picks=[pick(tier="elite")]), now=NOW)
        slip_ledger.save("member-b", slip("slip-0002", track=False), now=NOW)
        self.assertEqual(self.posted(), [])
        players = {"CeeDee Lamb": {"name": "CeeDee Lamb", "line": {"receiving_yards": 88}}}
        with patch("slip_games.read", side_effect=final(players)):
            shown = slip_ledger.history("member-a", now=NOW + timedelta(hours=6))
        self.assertEqual(shown["slips"][0]["picks"][0]["result"], "hit")  # their own slip still settles
        self.assertEqual(shown["record"]["picks"], 0)
        self.assertEqual(slip_ledger.public_results(NOW + timedelta(hours=6))["all"]["picks"], 0)

    def test_the_admins_posted_picks_settle_and_make_the_record(self):
        dak = pick(player="Dak Prescott", stat="Pass Yards", line=245.5, tier="elite", settle={"kind": "key", "key": "passing_yards"})
        started = pick(player="Brandin Cooks", stat="Receptions", line=3.5, startsAt=(NOW - timedelta(hours=1)).isoformat())
        self.assertEqual(slip_ledger.record_add({"picks": [pick(), dak, started]}, now=NOW), {"added": 2, "started": 1})
        self.assertEqual(sorted(entry["player"] for entry in self.posted()), ["CeeDee Lamb", "Dak Prescott"])
        later = NOW + timedelta(hours=6)
        players = {"CeeDee Lamb": {"name": "CeeDee Lamb", "line": {"receiving_yards": 88}},
                   "Dak Prescott": {"name": "Dak Prescott", "line": {"passing_yards": 201}}}
        with patch("slip_games.read", side_effect=final(players)):
            picks = slip_ledger.record_picks(now=later)
        self.assertEqual({row["player"]: row["result"] for row in picks}, {"CeeDee Lamb": "hit", "Dak Prescott": "miss"})
        self.assertNotIn("owners", picks[0])
        out = slip_ledger.public_results(later)
        self.assertEqual((out["all"]["hits"], out["all"]["misses"]), (1, 1))
        self.assertEqual(out["tiers"]["elite"]["misses"], 1)
        self.assertEqual(slip_ledger.record(later)["picks"], 2)
        # Posted again after it settled: left as it finished.
        self.assertEqual(slip_ledger.record_add({"picks": [pick(tier="elite")]}, now=NOW)["added"], 0)

    def test_the_admin_can_call_remove_and_erase(self):
        slip_ledger.record_add({"picks": [pick(), pick(player="Dak Prescott", stat="Pass Yards", line=245.5,
                                                      settle={"kind": "key", "key": "passing_yards"})]}, now=NOW)
        with patch("slip_games.read", side_effect=final({}, state="pre")):
            rows = slip_ledger.record_picks(now=NOW)
        lamb = next(row for row in rows if row["player"] == "CeeDee Lamb")
        slip_ledger.record_set_result(lamb["day"], lamb["key"], "hit", 91)
        self.assertEqual(next(entry for entry in self.posted() if entry["player"] == "CeeDee Lamb")["result"], "hit")
        with self.assertRaises(ValueError):
            slip_ledger.record_set_result(lamb["day"], lamb["key"], "won")
        dak = next(row for row in rows if row["player"] == "Dak Prescott")
        self.assertEqual(slip_ledger.record_remove(dak["day"], dak["key"]), {"removed": 1})
        self.assertEqual([entry["player"] for entry in self.posted()], ["CeeDee Lamb"])
        with self.assertRaises(ValueError):
            slip_ledger.record_remove("today", "x")
        # Members' ledger is untouched by erasing the record.
        slip_ledger.save("member-a", slip(), now=NOW)
        self.assertEqual(slip_ledger.record_clear(now=NOW)["cleared"], 1)
        self.assertEqual(self.posted(), [])
        self.assertTrue(any(":ledger:" in key for key in self.store.data))

    def test_a_finished_play_typed_in_goes_straight_on_the_record(self):
        play = {"day": "2026-10-03", "sport": "nfl", "player": "Dak Prescott", "side": "over", "line": "33.5",
                "stat": "Pass Attempts", "tier": "elite", "result": "hit", "value": 42, "team": "dal", "opponent": "tb"}
        entered = slip_ledger.record_enter(play, now=NOW)
        self.assertEqual(entered["result"], "hit")
        with patch("slip_games.read", side_effect=AssertionError("nothing to settle")):
            rows = slip_ledger.record_picks(now=NOW)
        self.assertEqual([(row["player"], row["side"], row["line"], row["team"], row["value"]) for row in rows],
                         [("Dak Prescott", "OVER", 33.5, "DAL", 42)])
        out = slip_ledger.public_results(NOW)
        self.assertEqual((out["all"]["hits"], out["sports"]["nfl"]["picks"], out["recent"][0]["player"]), (1, 1, "Dak Prescott"))
        # Its result can be changed, but there's no box score to go back to.
        slip_ledger.record_set_result(entered["day"], entered["key"], "miss")
        with self.assertRaises(ValueError):
            slip_ledger.record_set_result(entered["day"], entered["key"], None)
        # Outside the days the record shows, or missing what makes a play: refused.
        for bad in ({**play, "day": "2026-08-01"}, {**play, "day": "2026-10-05"}, {**play, "result": None},
                    {**play, "player": ""}, {**play, "line": "x"}, {**play, "sport": "golf"}, {**play, "tier": "lock"}):
            with self.assertRaises(ValueError):
                slip_ledger.record_enter(bad, now=NOW)

    def test_finished_slips_go_on_the_record_together_or_not_at_all(self):
        base = {"day": "2026-10-02", "sport": "nfl", "side": "OVER", "tier": "strong", "team": "DAL", "opponent": "TB"}
        plays = [{**base, "player": "Dak Prescott", "line": 33.5, "stat": "Pass Attempts", "result": "hit"},
                 {**base, "player": "Brandon Aubrey", "line": 8.5, "stat": "Kicking Points", "result": "miss", "modifier": "demon"},
                 {**base, "player": "CeeDee Lamb", "line": 59.5, "stat": "Receiving Yards", "result": "hit", "day": "2026-10-03"}]
        # One without a result: nothing is added, and it's named.
        with self.assertRaisesRegex(ValueError, "^CeeDee Lamb: Pick hit"):
            slip_ledger.record_enter_many([*plays[:2], {**plays[2], "result": ""}], now=NOW)
        self.assertEqual(self.posted(), [])
        self.assertEqual(slip_ledger.record_enter_many(plays, now=NOW), {"added": 3, "hits": 2, "misses": 1})
        out = slip_ledger.public_results(NOW)
        self.assertEqual((out["all"]["hits"], out["all"]["misses"], out["tiers"]["strong"]["picks"]), (2, 1, 3))
        self.assertEqual({entry["player"]: entry["modifier"] for entry in self.posted()}["Brandon Aubrey"], "demon")
        for bad in ([], None, [plays[0]] * (slip_ledger.RECORD_BATCH + 1)):
            with self.assertRaises(ValueError):
                slip_ledger.record_enter_many(bad, now=NOW)

    def test_nothing_to_post_is_refused(self):
        with self.assertRaises(ValueError):
            slip_ledger.record_add({"picks": [{"player": "No Sport"}]}, now=NOW)


class RecordRouteTests(unittest.TestCase):
    """/api/v2-admin's record actions: the admin's only."""
    def setUp(self):
        import importlib.util
        import io
        self.io = io
        spec = importlib.util.spec_from_file_location("v2_admin_record", Path(__file__).resolve().parents[1] / "api" / "v2-admin.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.handler, self.admin_auth = module.handler, module.admin_auth
        self.store = FakeStore()
        patcher = patch.object(slip_ledger, "_store", return_value=self.store)
        patcher.start()
        self.addCleanup(patcher.stop)
        slip_ledger._memory.clear()

    def call(self, method, body=None, query="", admin=True, same_origin=True):
        request = object.__new__(self.handler)
        raw = json.dumps(body or {}).encode()
        request.path = query
        request.headers = {"Content-Length": str(len(raw)), "Origin": "https://example.com",
                           "Host": "example.com" if same_origin else "evil.com"}
        request.rfile = self.io.BytesIO(raw)
        with patch.object(self.admin_auth, "is_admin_request", return_value=admin), patch.object(request, "_send") as send:
            getattr(request, method)()
        return send.call_args.args[:2]

    def test_only_the_admin_posts_and_erases(self):
        later = pick(startsAt=(datetime.now(timezone.utc) + timedelta(hours=2)).isoformat())
        self.assertEqual(self.call("do_POST", {"action": "record-add", "picks": [later]}, admin=False)[0], 401)
        self.assertEqual(self.call("do_GET", query="/api/v2-admin?action=record", admin=False)[0], 401)
        self.assertEqual(self.call("do_POST", {"action": "record-add", "picks": [later]}, same_origin=False)[0], 403)
        self.assertEqual(self.call("do_POST", {"action": "record-add", "picks": [later]}), (200, {"added": 1, "started": 0}))
        status, body = self.call("do_GET", query="/api/v2-admin?action=record")
        self.assertEqual((status, [row["player"] for row in body["picks"]]), (200, ["CeeDee Lamb"]))
        self.assertEqual(self.call("do_POST", {"action": "record-enter", "day": "1999-01-01"})[0], 400)
        self.assertEqual(self.call("do_POST", {"action": "record-enter", "day": "1999-01-01"}, admin=False)[0], 401)
        self.assertEqual(self.call("do_POST", {"action": "record-enter-many", "plays": []})[0], 400)
        self.assertEqual(self.call("do_POST", {"action": "record-clear"})[0], 400)  # not confirmed
        self.assertEqual(self.call("do_POST", {"action": "record-clear", "confirm": True}), (200, {"cleared": 1}))
        self.assertEqual(self.call("do_GET", query="/api/v2-admin?action=record")[1]["picks"], [])


class PublicResultsTests(unittest.TestCase):
    def test_the_public_record_shows_every_finished_posted_pick_and_nothing_private(self):
        from datetime import datetime, timezone
        import slip_ledger as ledger
        now = datetime(2026, 10, 13, 16, 0, tzinfo=timezone.utc)
        pick = lambda tier, result, **extra: {'player': 'P', 'sport': 'nba', 'stat': 'Points', 'line': 20.5, 'side': 'OVER', 'tier': tier,
                                              'result': result, 'value': 25, 'startsAt': '2026-10-12T23:00:00+00:00', 'owners': ['member-1'],
                                              'settle': {'kind': 'key'}, **extra}
        entries = [('2026-10-12', 'a', pick('elite', 'hit')), ('2026-10-12', 'b', pick('elite', 'miss')),
                   ('2026-10-12', 'c', pick('strong', 'hit')), ('2026-10-12', 'd', pick('lean', 'hit')),
                   ('2026-10-13', 'e', pick('elite', None)),     # still to play: not shown
                   ('2026-10-12', 'f', pick('elite', 'push'))]   # a push: neither
        out = ledger.public_results(now, entries)
        self.assertEqual(out['tiers']['elite'], {'hits': 1, 'misses': 1, 'picks': 2, 'rate': 0.5})
        self.assertEqual(out['tiers']['lean']['picks'], 1)
        self.assertEqual(out['all']['picks'], 4)
        self.assertEqual(len(out['recent']), 4)
        self.assertNotIn('owners', out['recent'][0])
        self.assertNotIn('settle', out['recent'][0])
        self.assertEqual([day['picks'] for day in out['daily'] if day['day'] == '2026-10-12'], [4])


if __name__ == "__main__":
    unittest.main()
