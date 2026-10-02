import json,time,unittest
from unittest.mock import patch
import cs2_board as b

class ProviderCacheTests(unittest.TestCase):
    def tearDown(self): b._cache.update(at=0,value=None)

    def test_failed_prizepicks_keeps_recent_verified_quotes_without_restamping(self):
        at=time.time()-60
        old={'at':at,'data':{'rows':[{'id':'pp:1','player':'Alpha','teamAbbr':'A','opponent':'B','startsAt':'2099-01-01T00:00:00Z','apps':[{'key':'prizepicks'}]}]}}
        def command(*args):return json.dumps(old) if args==('GET','finder:cs2:provider:prizepicks') else None
        with patch.object(b,'_fetch_projection_rows',side_effect=RuntimeError('outage')),patch('cs2_underdog.fetch',return_value=[]),patch('cs2_history.command',side_effect=command):
            value=b._refresh(force=True)
        self.assertEqual(value['rows'][0]['quoteAsOf'],at)
        self.assertEqual(value['lineUpdatedAt'],at)
        self.assertTrue(value['rows'][0]['staleQuote'])
        self.assertEqual(value['staleSources'],['prizepicks'])

    def test_expired_fallback_is_not_shown(self):
        old={'at':time.time()-901,'data':{'rows':[{'player':'Alpha'}]}}
        with patch.object(b,'_fetch_projection_rows',side_effect=RuntimeError('outage')),patch('cs2_underdog.fetch',return_value=[]),patch('cs2_history.command',return_value=json.dumps(old)):
            value=b._refresh(force=True)
        self.assertEqual(value['rows'],[])
        self.assertEqual(value['staleSources'],[])
