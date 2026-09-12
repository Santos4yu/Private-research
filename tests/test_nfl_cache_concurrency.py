import unittest
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from backend.sports.nfl.cache import cached_nfl,clear_nfl_cache,NFLCacheDomain

class CacheConcurrencyTests(unittest.TestCase):
    def setUp(self): clear_nfl_cache()
    def test_same_source_download_is_shared_across_research_requests(self):
        entered,release=Event(),Event(); calls=[]
        def load():
            calls.append(1);entered.set();release.wait(2);return {'data':'test-only'}
        with ThreadPoolExecutor(max_workers=4) as pool:
            jobs=[pool.submit(cached_nfl,NFLCacheDomain.STATS,('test-only',2025),load) for _ in range(4)]
            self.assertTrue(entered.wait(1));release.set()
            self.assertTrue(all(job.result()=={'data':'test-only'} for job in jobs))
        self.assertEqual(len(calls),1)
    def test_error_is_not_cached_and_clear_does_not_repopulate_stale_request(self):
        def fail():raise RuntimeError('test outage')
        with self.assertRaises(RuntimeError):cached_nfl(NFLCacheDomain.STATS,('test-error',),fail)
        self.assertEqual(cached_nfl(NFLCacheDomain.STATS,('test-error',),lambda:7),7)
        def clear_during_load():clear_nfl_cache();return 2
        self.assertEqual(cached_nfl(NFLCacheDomain.STATS,('test-clear',),clear_during_load),2)
        self.assertEqual(cached_nfl(NFLCacheDomain.STATS,('test-clear',),lambda:3),3)
