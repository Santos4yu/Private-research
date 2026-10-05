import json
import unittest
from unittest.mock import Mock, patch
import requests
import odds_budget as budget


def response(payload, remaining=38731, status=200):
    r = requests.Response()
    r.status_code = status
    r._content = json.dumps(payload).encode()
    r.headers["x-requests-remaining"] = str(remaining)
    return r

class BudgetTests(unittest.TestCase):
    def setUp(self):
        self.data = {}
        self.patches = [patch.object(budget.store, "require_configured"),
                       patch.object(budget.store, "get", side_effect=lambda key, **kwargs: self.data.get(key)),
                       patch.object(budget.store, "set", side_effect=self.write),
                       patch.object(budget.store, "pipeline", side_effect=self.pipeline),
                       patch.dict(budget.os.environ, {"ODDS_API_PAUSED":"", "ODDS_DAILY_CREDIT_LIMIT":"1000", "ODDS_CREDIT_RESERVE":"1500"})]
        for p in self.patches: p.start()
        self.addCleanup(lambda: [p.stop() for p in reversed(self.patches)])
        self.session = Mock()
        self.session.get.side_effect = [response([]), response({"bookmakers":[]}, 38720)]
        self.params = {"markets":"player_points,player_rebounds", "bookmakers":"draftkings"}
        self.path = "/sports/basketball_wnba/events/test/odds"

    def write(self, key, value, **kwargs):
        self.data[key] = value
        return True

    def pipeline(self, commands):
        result = []
        for cmd in commands:
            if cmd[0] == "SET":
                if cmd[1] in self.data: result.append({"result":None})
                else:
                    self.data[cmd[1]] = cmd[2]
                    result.append({"result":"OK"})
            else:
                if self.data.get(cmd[1]) == cmd[2]: self.data.pop(cmd[1])
                result.append({"result":1})
        return result

    def fetch(self):
        return budget.guarded_get(self.session, self.path, self.params, "secret-key")

    def test_durable_cache_avoids_second_paid_call_and_secrets(self):
        self.fetch()
        self.assertEqual(self.fetch().headers["x-odds-cache"], "hit")
        self.assertEqual(self.session.get.call_count, 2) # free quota probe + paid call
        self.assertNotIn("secret-key", json.dumps(self.data))

    def test_daily_cap_blocks_before_network(self):
        with patch.dict(budget.os.environ, {"ODDS_DAILY_CREDIT_LIMIT":"1"}):
            with self.assertRaises(budget.BudgetPaused): self.fetch()
        self.assertEqual(self.session.get.call_count, 1) # only the free probe

    def test_reserve_blocks_before_paid_call(self):
        self.session.get.side_effect = [response([], 1501)]
        with self.assertRaises(budget.BudgetPaused): self.fetch()
        self.assertEqual(self.session.get.call_count, 1)

    def test_storage_failure_fails_closed(self):
        with patch.object(budget.store, "get", side_effect=RuntimeError("storage")):
            with self.assertRaises(budget.BudgetPaused): self.fetch()
        self.session.get.assert_not_called()

    def test_busy_lease_does_not_buy(self):
        self.data[budget.PREFIX+"lock"] = "another-worker"
        with self.assertRaises(budget.BudgetPaused): self.fetch()
        self.session.get.assert_not_called()

    def test_failed_network_keeps_reservation_and_releases_lease(self):
        self.session.get.side_effect = [response([]), requests.ConnectionError()]
        with self.assertRaises(requests.ConnectionError): self.fetch()
        state = next(json.loads(v) for k,v in self.data.items() if ":budget:" in k)
        self.assertEqual(state["spent"], 2)
        self.assertNotIn(budget.PREFIX+"lock", self.data)

    def test_bookmaker_cost_rounds_up_per_ten(self):
        self.assertEqual(budget.estimate({"markets":"a,b", "bookmakers":",".join(str(i) for i in range(11))}), 4)

    def test_free_endpoint_does_not_use_storage(self):
        budget.guarded_get(self.session, "/sports", {}, "secret-key")
        self.assertEqual(self.data, {})

    def test_finder_comparison_cache_hit_does_not_probe_or_buy(self):
        self.fetch()
        before = self.session.get.call_count
        self.assertEqual(budget.cached_get(self.path, self.params, "secret-key").headers["x-odds-cache"], "hit")
        self.assertEqual(self.session.get.call_count, before)

    def test_finder_cache_miss_never_uses_network_or_budget(self):
        with self.assertRaises(budget.BudgetPaused):
            budget.cached_get(self.path, self.params, "secret-key")
        self.session.get.assert_not_called()
        self.assertEqual(self.data, {})

    def test_distance_ttl(self):
        now=budget.datetime.now(budget.timezone.utc).timestamp()
        def event(hours):
            return {"commence_time":budget.datetime.fromtimestamp(now+hours*3600,budget.timezone.utc).isoformat()}
        self.assertEqual(budget._ttl(event(2),now),3600)
        self.assertEqual(budget._ttl(event(12),now),10800)
        self.assertEqual(budget._ttl(event(30),now),21600)
