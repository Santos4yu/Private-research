"""Synthetic fixtures exclusively for mechanics, not historical evidence."""
import unittest
from backend.sports.nfl.distribution_engine import simulate,crps,uncertain_rate
from backend.sports.nfl.distribution_validation import probability_metrics,percentile_coverage

def fixture(prop='receiving_yards'):
    def m(v):return {'mean':v,'sample':10,'standardDeviation':5}
    eff={'catchRate':{'mean':.7,'validExposure':80},'yardsPerReception':{'mean':10,'validExposure':50},'rushingYPC':{'mean':4,'validExposure':100}}
    point={'projectionMean':56,'promotion':'EXPERIMENTAL','efficiencyInputs':eff}
    if prop=='rushing_receiving_yards':point['components']=[{'efficiencyInputs':{'rushingYPC':eff['rushingYPC']}},{'efficiencyInputs':{k:v for k,v in eff.items() if k!='rushingYPC'}}]
    return {'propType':prop,'projection':point,'teamVolume':{'expectedPlays':m(65),'expectedDropbacks':m(38),'expectedCalledRushAttempts':m(26),
        'expectedTeamPassAttempts':m(34),'expectedRushAttempts':m(28)},'playerOpportunity':{'roleStatus':'STABLE','metrics':{'expectedTargets':m(8),'expectedCarries':m(15)}}}

class EngineTests(unittest.TestCase):
    def test_game_invariants(self):
        values,states=simulate(fixture(),'process',{},1000,23,True)
        self.assertEqual(values,simulate(fixture(),'process',{},1000,23))
        for s in states:
            self.assertEqual(s['plays'],s['dropbacks']+s['calledRushes']+s['spikes'])
            self.assertEqual(s['rushes'],s['calledRushes']+s['scrambles'])
            self.assertLessEqual(s['attempts'],s['dropbacks'])
            self.assertLessEqual(s['receptions'],s['targets'])
            self.assertLessEqual(s['targets'],s['attempts'])
            self.assertLessEqual(s['carries'],s['rushes'])

    def test_same_game_combined(self):
        values,states=simulate(fixture('rushing_receiving_yards'),'process',{},1000,5,True)
        for value,state in zip(values,states):self.assertEqual(value,state['rushing_yards']+state['receiving_yards'])

    def test_missing_and_scenarios(self):
        for field in ('teamVolume','playerOpportunity'):
            r=fixture();r[field]={}
            with self.assertRaises((ValueError,KeyError)):simulate(r,'process',{},100)
        r=fixture();r['projection']['injuryScenarios']=[{'condition':'OUT','probability':None}]
        with self.assertRaises(ValueError):simulate(r,'process',{},100)
        r=fixture();r['playerOpportunity']['roleStatus']='UNCERTAIN'
        with self.assertRaises(ValueError):simulate(r,'process',{},100)

    def test_parameter_uncertainty(self):
        import random,statistics
        small=[uncertain_rate(random.Random(i),.3,5) for i in range(200)]
        large=[uncertain_rate(random.Random(i),.3,500) for i in range(200)]
        self.assertGreater(statistics.variance(small),statistics.variance(large))

    def test_candidate_cap(self):
        for method in ('residual','poisson'):
            values,states=simulate(fixture('targets'),method,{'residuals':[100]*100},100,1,True)
            for v,s in zip(values,states):self.assertLessEqual(v,s['attempts'])

    def test_scoring(self):
        self.assertEqual(crps([3]*100,3),0)
        r=percentile_coverage([{'actual':0,'percentiles':{'p10':0,'p25':0,'p50':1,'p75':2,'p90':3}}])
        self.assertEqual(r['coverage']['p10'],1)
        self.assertEqual(probability_metrics([])['Brier'],None)
        with self.assertRaises(ValueError):probability_metrics([{'probability':.5,'hit':1}])
        r=probability_metrics([{'probability':.5,'hit':1,'lineSource':'TEST_ONLY'}])
        self.assertEqual(r['Brier'],.25)

    def test_no_disabled(self):
        r=fixture();r['projection']['promotion']='DISABLED'
        with self.assertRaises(ValueError):simulate(r,'process',{},100)
