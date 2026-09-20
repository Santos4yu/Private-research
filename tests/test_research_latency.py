"""Request sharing must save work without leaking mutations or stale grades."""
import tempfile
import threading
import unittest
from concurrent.futures import Future, ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from api import prediction as api
import prediction_core

stats = prediction_core.stats_mlb
research = prediction_core.vortex_research


class ResearchCacheTests(unittest.TestCase):
    def setUp(self):
        self.cache = patch.dict(api._PREDICTION_CACHE, {}, clear=True)
        self.inflight = patch.dict(api._PREDICTION_INFLIGHT, {}, clear=True)
        self.cache.start()
        self.inflight.start()
        self.addCleanup(self.cache.stop)
        self.addCleanup(self.inflight.stop)

    def overlap(self, module, invoke, work, error=None):
        started, subscribed, release = (threading.Event() for _ in range(3))

        class ObservedFuture(Future):
            def result(self, timeout=None):
                subscribed.set()
                return super().result(timeout)

        def slow_work(*args, **kwargs):
            started.set()
            if not release.wait(3):
                raise AssertionError("Test producer was not released")
            if error:
                raise error
            return {"rows": [{"score": 80}]}

        with patch.object(module, "Future", ObservedFuture), \
             patch.object(module, work, side_effect=slow_work) as compute, \
             ThreadPoolExecutor(max_workers=2) as pool:
            owner = pool.submit(invoke)
            try:
                self.assertTrue(started.wait(3))
                follower = pool.submit(invoke)
                self.assertTrue(subscribed.wait(3), "Second request did not join the first")
            finally:
                release.set()
            if error:
                for future in (owner, follower):
                    with self.assertRaisesRegex(type(error), str(error)):
                        future.result(timeout=3)
                result = None
            else:
                result = (owner.result(timeout=3), follower.result(timeout=3))
            self.assertEqual(compute.call_count, 1)
            return result

    def test_simultaneous_prediction_prefetch_and_open_share_one_calculation(self):
        first, second = self.overlap(
            api, lambda: api._cached_prediction("ohtani", api.compute_prediction),
            "compute_prediction",
        )
        self.assertTrue(second["cached"])
        first["rows"][0]["score"] = 1
        second["rows"][0]["score"] = 2
        cached = api._cached_prediction("ohtani", lambda: self.fail("Should be cached"))
        self.assertEqual(cached["rows"][0]["score"], 80)
        self.assertFalse(api._PREDICTION_INFLIGHT)

    def test_prediction_failure_releases_all_waiters_and_can_retry(self):
        self.overlap(
            api, lambda: api._cached_prediction("ohtani", api.compute_prediction),
            "compute_prediction", error=RuntimeError("upstream unavailable"),
        )
        self.assertFalse(api._PREDICTION_INFLIGHT)
        self.assertFalse(api._PREDICTION_CACHE)
        result = api._cached_prediction("ohtani", lambda: {"score": 70})
        self.assertEqual(result["score"], 70)

    def test_prediction_ttl_is_not_extended_by_repeated_reads(self):
        now = [1000.0]
        compute = Mock(return_value={"score": 80})
        with patch.object(api.time, "monotonic", side_effect=lambda: now[0]):
            api._cached_prediction("player", compute)
            now[0] += 179
            self.assertTrue(api._cached_prediction("player", compute)["cached"])
            now[0] += 1
            self.assertNotIn("cached", api._cached_prediction("player", compute))
        self.assertEqual(compute.call_count, 2)

    def test_prediction_cache_is_bounded(self):
        with patch.object(api, "_PREDICTION_CACHE_MAX_ENTRIES", 2):
            for player in (1, 2, 3):
                api._cached_prediction(player, lambda: {"score": 80})
        self.assertEqual(set(api._PREDICTION_CACHE), {2, 3})

    def test_mlb_parallel_signals_share_resource_and_receive_independent_data(self):
        first, second = self.overlap(
            stats, lambda: stats._get("/schedule", {"date": "2026-09-19"}, "schedule_2026-09-19"),
            "_get_cached_response",
        )
        first["rows"][0]["score"] = 1
        self.assertEqual(second["rows"][0]["score"], 80)
        self.assertFalse(stats._GET_INFLIGHT)

    def test_mlb_failure_releases_waiters(self):
        self.overlap(
            stats, lambda: stats._get("/schedule", {}, "schedule_test"),
            "_get_cached_response", error=RuntimeError("upstream unavailable"),
        )
        self.assertFalse(stats._GET_INFLIGHT)
        with patch.object(stats, "_get_cached_response", return_value={"dates": []}) as fetch:
            self.assertEqual(stats._get("/schedule", {}, "schedule_test"), {"dates": []})
            fetch.assert_called_once()

    def invoke_api(self):
        request = object.__new__(api.handler)
        request.path = "/api/prediction?player=Example&stat=Hits&line=0.5&side=over&playerId=1"
        request.headers = {}
        responses = []
        request._send = lambda status, payload: responses.append((status, payload))
        request.do_GET()
        return responses[0]

    def test_auth_check_still_runs_before_a_cached_result_and_day_rolls_key(self):
        day = ["2026-09-19"]
        with patch("site_controls.allowed", return_value=True), \
             patch.object(api, "session_with_live_access", return_value=True) as access, \
             patch.object(api, "vortex_board_day", side_effect=lambda: day[0]), \
             patch.object(api, "compute_prediction", return_value={"score": 80}) as compute:
            self.assertEqual(self.invoke_api()[0], 200)
            self.assertTrue(self.invoke_api()[1]["cached"])
            day[0] = "2026-09-20"
            self.assertNotIn("cached", self.invoke_api()[1])
            access.return_value = None
            self.assertEqual(self.invoke_api()[0], 401)
            self.assertEqual(compute.call_count, 2)
            self.assertEqual(access.call_count, 4)


class PlayerResolutionTests(unittest.TestCase):
    def test_name_lookup_uses_cached_transport_and_direct_fallback(self):
        person = {"id": 660271, "fullName": "Shohei Ohtani", "active": True,
                  "currentTeam": {"name": "Los Angeles Dodgers"}}
        response = SimpleNamespace(raise_for_status=lambda: None, json=lambda: {"people": [person]})
        session = SimpleNamespace(get=Mock(side_effect=[stats.requests.ConnectionError("proxy down"), response]))
        with tempfile.TemporaryDirectory() as directory, \
             patch.object(stats, "CACHE_DIR", Path(directory)), \
             patch.object(stats, "REQUEST_DELAY", 0), \
             patch.object(stats, "_thread_sessions", return_value=(session, session)):
            first = research.fuzzy_search("Shohei Ohtani")
            second = research.fuzzy_search("Shohei Ohtani")
        self.assertEqual(first, second)
        self.assertEqual(first[0]["id"], 660271)
        self.assertEqual(session.get.call_count, 2)
        self.assertTrue(session.get.call_args_list[0].args[0].startswith(stats.BASE))
        self.assertTrue(session.get.call_args_list[1].args[0].startswith(stats.BASE_FALLBACK))

    def test_roster_fallback_reuses_autocomplete_cache_key_and_current_season(self):
        with patch.object(research, "_PLAYER_LIST_CACHE", (0, [])), \
             patch.object(stats, "SEASON", 2027), \
             patch.object(stats, "_get", return_value={"people": [{"id": 1}]}) as fetch:
            self.assertEqual(research.get_active_player_list(), [{"id": 1}])
        fetch.assert_called_once_with(
            "/sports/1/players", {"season": 2027, "hydrate": "currentTeam"},
            cache_key="active_roster_2027",
        )

    def test_known_pitcher_id_skips_search_and_uses_vortex_day_for_logs(self):
        calls = []
        reads = threading.Barrier(3)

        def profile(player_id):
            reads.wait(timeout=3)
            return {"pitchHand": {"code": "R"}}

        def fetch(endpoint, params, cache_key):
            calls.append((endpoint, params, cache_key))
            reads.wait(timeout=3)
            return {"stats": [{"splits": [{"stat": {
                "inningsPitched": "50.0", "battersFaced": 200,
                "gamesStarted": 10, "strikeOuts": 60,
            }}]}]} if params["stats"] == "season" else {"stats": [{"splits": []}]}

        with patch.object(stats, "get_player_id", side_effect=AssertionError("Redundant player lookup")), \
             patch.object(stats, "_get_player_profile", side_effect=profile), \
             patch.object(stats, "_get", side_effect=fetch), \
             patch.object(stats, "vortex_day", return_value="2026-09-18"):
            result = stats.get_pitcher_metrics("Known Starter", 123)
        self.assertEqual(result["pitcher_id"], 123)
        game_log = next(params for _, params, _ in calls if params["stats"] == "gameLog")
        self.assertEqual(game_log["endDate"], "2026-09-17")


if __name__ == "__main__":
    unittest.main()
