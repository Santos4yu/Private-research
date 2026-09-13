import json
import unittest
from unittest.mock import patch
from backend.sports.nfl.distribution_service import distribution
from backend.sports.nfl.cache import clear_nfl_cache
from test_nfl_distribution_engine import fixture

class ServiceTests(unittest.TestCase):
    def test_summarized_cache_and_invalidation(self):
        clear_nfl_cache();r=fixture();r['projection'].update(playerId='test',gameId='game',propType='receiving_yards',modelVersion='NFL_WR_RECEIVING_YARDS_V1')
        policy={'version':'NFL_PROCESS_DISTRIBUTION_V1','simulationCount':100,'models':{'WR.receiving_yards':{'method':'process','parameters':{},'status':'EXPERIMENTAL'}}}
        with patch('backend.sports.nfl.distribution_service.projection',return_value=r['projection']),patch('backend.sports.nfl.distribution_service.opportunity',return_value={'team':r['teamVolume'],'player':r['playerOpportunity']}),patch('pathlib.Path.read_text',return_value=json.dumps(policy)),patch('backend.sports.nfl.distribution_service.simulate',wraps=__import__('backend.sports.nfl.distribution_engine',fromlist=['simulate']).simulate) as engine:
            a=distribution(2025,'test',8,'receiving_yards');b=distribution(2025,'test',8,'receiving_yards')
            self.assertEqual(a['inputFingerprint'],b['inputFingerprint']);self.assertEqual(engine.call_count,1)
            self.assertNotIn('values',a);self.assertNotIn('_outcomeMass',a);self.assertIsNone(a['rawOverProbability'])
            r['playerOpportunity']['roleStatus']='INCREASING'
            c=distribution(2025,'test',8,'receiving_yards');self.assertNotEqual(a['inputFingerprint'],c['inputFingerprint'])
        clear_nfl_cache()

    def test_route_rejects_line(self):
        from api.nfl import handler
        request=object.__new__(handler);request.headers={};request.path='/api/nfl/distribution?season=2025&week=8&playerId=x&prop=targets&line=5'
        with patch('site_controls.read',return_value={'maintenance':False,'disabledTabs':[],'requireLogin':False}),patch('api.nfl.session_with_live_access',return_value=True),patch('api.nfl.send_json') as send:
            request.do_GET();self.assertEqual(send.call_args.args[1],400)

    def test_missing_policy(self):
        with patch('backend.sports.nfl.distribution_service.projection',return_value={'projectionMean':None}),patch('pathlib.Path.read_text',side_effect=OSError):
            self.assertEqual(distribution(2025,'x',8,'targets')['status'],'NOT_AVAILABLE')

    def test_roster_capacity(self):
        import random
        from backend.sports.nfl.distribution_engine import roster_allocation
        for i in range(100):
            row=roster_allocation(random.Random(i),35,{'a':.7,'b':.6,'c':.4})
            self.assertLessEqual(sum(row.values()),35)

    def test_calibration_no_fabrication_or_leakage(self):
        from backend.sports.nfl.calibration import transform
        self.assertIsNone(transform(.6,None,'2025-01-01T00:00:00+00:00'))
        artifact={'lineDataStatus':'REAL_TIMESTAMPED_LINES','status':'EXPERIMENTAL','sample':600,
                  'fitCutoff':'2024-01-01T00:00:00+00:00','method':'logistic','coefficients':[0,1]}
        self.assertAlmostEqual(transform(.6,artifact,'2025-01-01T00:00:00+00:00'),.6)
        with self.assertRaises(ValueError):transform(.6,artifact,'2023-01-01T00:00:00+00:00')

    def test_cached_cdf_comparison(self):
        from backend.sports.nfl.distributions import compare_mass
        mass={0:2,1:1,2:1}
        self.assertEqual(compare_mass(mass,1)['rawPushProbability'],.25)
        self.assertEqual(compare_mass(mass,1.5)['rawPushProbability'],0)
        self.assertEqual(mass,{0:2,1:1,2:1})
