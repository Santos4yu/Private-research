"""Synthetic evidence and market fixtures ONLY inside tests; no live promotions."""
import unittest
import tempfile
import sqlite3
from pathlib import Path
from datetime import datetime,timezone,timedelta
from unittest.mock import patch
from backend.sports.nfl.production.gates import eligible,policy
from backend.sports.nfl.production.audit import audit_models
from backend.sports.nfl.production.decisions import decide,value_board
from backend.sports.nfl.production.health import model_health,metrics
from backend.sports.nfl.production.ledger import ShadowLedger

NOW=datetime(2026,9,12,tzinfo=timezone.utc)

def evidence():
    e={'pointStatus':'VALIDATED','distributionStatus':'VALIDATED','calibrationStatus':'VALIDATED','health':'HEALTHY',
       'screenSample':600,'holdoutSample':700,'forwardSample':350,'forwardWeeks':8,'historicalSeasons':2,
       'lineCalibrationSample':1500,'lineCalibrationHoldout':600,'baselineImprovements':{k:.10 for k in ('seasonMean','recentMean','historicalEfficiency')},
       'absoluteBiasOverMAE':.02,'percentileError':.03,'sharpnessRelativeToBaseline':1.01,'ECE':.01,
       'calibrationSlopeDeviation':.05,'absoluteCalibrationIntercept':.02,'rosterAvailability':.9}
    for key in ('asOfSnapshots','untouchedHoldout','distributionBaselineImproved','sharpnessBaselineVerified','stabilityVerified','realTimestampedLines','calibrationBaselineImproved','forwardCapturedBeforeKickoff'):e[key]=True
    return e

def context():
    line={'playerId':'mock-player','gameId':'mock-game','propType':'targets','platform':'MOCK_TEST_ONLY','source':'MOCK_TEST_ONLY','provenance':'VERIFIED_CURRENT_PROVIDER','value':7.5,'timestamp':NOW.isoformat()}
    return {'playerId':'mock-player','gameId':'mock-game','propType':'targets','team':'MOCK_A','opponent':'MOCK_B','startingQB':'mock-qb',
        'playerStatus':'ACTIVE','injuryCertainty':'VERIFIED','roleStatus':'STABLE','opportunityStatus':'AVAILABLE',
        'projection':9,'distribution':{'status':'VALIDATED'},'calibrationStatus':'VALIDATED','modelHealth':'HEALTHY','dataCoverage':95,
        'dataTimestamp':NOW.isoformat(),'line':line,'currentLineValue':7.5,'calibratedProbabilities':{'over':.7,'under':.3,'push':0},
        'referenceProbability':.55,'referenceSource':'MOCK_TEST_ONLY'}

def learned():
    p=policy();p['decisionRules']={'status':'VALIDATED','lineDataStatus':'REAL_TIMESTAMPED_LINES','holdoutSample':600,
        'takeProbability':.68,'takeProbabilityEdge':.10,'leanProbability':.6,'leanProbabilityEdge':.02,'confidenceLabel':'HIGH'}
    return p

class GateTests(unittest.TestCase):
    def test_no_real_model_production_ready(self):
        audit=audit_models();self.assertEqual(audit['productionReady'],0)
        self.assertEqual(sum(r['productionStatus']=='SHADOW_ONLY' for r in audit['models']),12)
        self.assertTrue(all(r['calibrationStatus']=='NOT_AVAILABLE' for r in audit['models']))

    def test_promotion_demotion(self):
        e=evidence();self.assertEqual(eligible(e)['productionStatus'],'PRODUCTION_READY')
        e['forwardSample']=20;self.assertEqual(eligible(e)['productionStatus'],'SHADOW_ONLY')
        e['pointStatus']='DISABLED';self.assertEqual(eligible(e)['productionStatus'],'DISABLED')

    def test_experimental_never_ready(self):
        for field in ('pointStatus','distributionStatus','calibrationStatus'):
            e=evidence();e[field]='EXPERIMENTAL';self.assertNotEqual(eligible(e)['productionStatus'],'PRODUCTION_READY')

    def test_baseline_bias_snapshot_health(self):
        for field,value in (('baselineImprovements',{}),('absoluteBiasOverMAE',.8),('asOfSnapshots',False),('health','DEGRADED')):
            e=evidence();e[field]=value;self.assertEqual(eligible(e)['productionStatus'],'SHADOW_ONLY')

class DecisionTests(unittest.TestCase):
    def test_shipped_policy_has_no_betting_cutoffs(self):
        r=decide(context(),eligible(evidence()),NOW)
        self.assertEqual(r['verdict'],'PASS');self.assertIsNone(r['probability']);self.assertIsNone(r['EV'])

    def test_mock_threshold_trace(self):
        c=context();g=eligible(evidence());r=decide(c,g,NOW,learned())
        self.assertEqual(r['verdict'],'TAKE');self.assertAlmostEqual(r['statisticalEdge'],1.5)
        c['calibratedProbabilities']={'over':.63,'under':.37,'push':0}
        self.assertEqual(decide(c,g,NOW,learned())['verdict'],'LEAN')
        c['calibratedProbabilities']={'over':.57,'under':.43,'push':0}
        self.assertEqual(decide(c,g,NOW,learned())['verdict'],'PASS')

    def test_hard_pass(self):
        for field,value in (('line',None),('roleStatus','UNCERTAIN'),('injuryCertainty','UNKNOWN'),('startingQB',None),('modelHealth','DEGRADED'),('dataCoverage',30),('projection',None),('currentLineValue',9)):
            c=context();c[field]=value
            self.assertEqual(decide(c,eligible(evidence()),NOW,learned())['verdict'],'PASS')

    def test_stale_and_mismatch(self):
        for key,value in (('timestamp',(NOW-timedelta(minutes=5)).isoformat()),('playerId','wrong'),('propType','wrong')):
            c=context();c['line'][key]=value
            self.assertEqual(decide(c,eligible(evidence()),NOW,learned())['verdict'],'PASS')

    def test_matchup_score_ignored(self):
        c=context();g=eligible(evidence());a=decide(c,g,NOW,learned())
        c['matchupScore']=100;c['L5HitRate']=1
        self.assertEqual(a,decide(c,g,NOW,learned()))
        g['productionStatus']='SHADOW_ONLY';self.assertEqual(decide(c,g,NOW,learned())['verdict'],'PASS')

    def test_no_probability_reference_assumption(self):
        c=context();c.pop('referenceProbability')
        self.assertEqual(decide(c,eligible(evidence()),NOW,learned())['verdict'],'PASS')

    def test_value_board(self):
        base={'productionStatus':'PRODUCTION_READY','verdict':'TAKE','status':'AVAILABLE','analyzedLine':context()['line'],'dataCoverage':95,'team':'MOCK_A',
              'pointStatus':'VALIDATED','distributionStatus':'VALIDATED','calibrationStatus':'VALIDATED','modelHealth':'HEALTHY'}
        rows=[{**base,'probabilityEdge':.1,'probability':.65},{**base,'probabilityEdge':.2,'probability':.7},{**base,'productionStatus':'SHADOW_ONLY','probabilityEdge':.8}]
        self.assertEqual(len(value_board(rows)),2);self.assertEqual(value_board(rows)[0]['probabilityEdge'],.2)
        self.assertEqual(len(value_board(rows,{'minimumProbability':.68})),1)

class HealthTests(unittest.TestCase):
    def rows(self,error):return [{'projection':10+error,'actual':10,'createdAt':(NOW+timedelta(seconds=i)).isoformat(),'modelVersion':'MOCK_V1','season':2026} for i in range(60)]
    def test_drift(self):
        self.assertEqual(model_health([],2,'MOCK_V1',policy())['status'],'WATCH')
        self.assertEqual(model_health(self.rows(0),2,'MOCK_V1',policy())['status'],'HEALTHY')
        self.assertEqual(model_health(self.rows(3),2,'MOCK_V1',policy())['status'],'DEGRADED')
        self.assertFalse(model_health(self.rows(0),2,'MOCK_V1',policy(),source_changed=True)['verdictsEnabled'])

    def test_pending_not_missing_projection(self):
        m=metrics([{'projection':0,'actual':None}]);self.assertEqual(m['availability'],1)
        self.assertIsNone(m['MAE']);self.assertEqual(m['pendingResults'],1)

    def test_repeated_refreshes_are_not_independent_predictions(self):
        rows=[{**r,'gameId':'same-game','playerId':'same-player','propType':'targets'} for r in self.rows(0)]
        health=model_health(rows,2,'MOCK_V1',policy())
        self.assertEqual(health['distinctForecasts'],1);self.assertEqual(health['status'],'WATCH')

class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.ledger=ShadowLedger(Path(self.tmp.name)/'nfl.sqlite')
    def tearDown(self):self.ledger.close();self.tmp.cleanup()
    def body(self):return {'mode':'SHADOW','publicVerdict':'PASS','playerId':'mock-player','gameId':'mock-game','propType':'targets',
          'modelVersion':'MOCK_V1','distributionVersion':'MOCK_D1','decisionRuleVersion':'MOCK_RULE1','featureVersion':'MOCK_F1',
          'projection':2,'line':context()['line'],'direction':'OVER'}

    def test_immutable_results_original_line(self):
        sid=self.ledger.snapshot(self.body(),(NOW+timedelta(hours=1)).isoformat(),NOW)
        r=self.ledger.settle(sid,8,'FINAL',now=NOW+timedelta(hours=4),result_source='MOCK_TEST_ONLY')
        self.assertEqual(r['grade'],'HIT');self.assertEqual(self.ledger.get(sid)['line']['value'],7.5)
        with self.assertRaises(sqlite3.IntegrityError):self.ledger.db.execute('UPDATE nfl_snapshots SET body=? WHERE id=?',('{}',sid))
        with self.assertRaises(sqlite3.IntegrityError):self.ledger.settle(sid,9,'FINAL',now=NOW+timedelta(hours=4),result_source='MOCK_TEST_ONLY')

    def test_no_backdated_public_or_incomplete_snapshot(self):
        with self.assertRaises(ValueError):self.ledger.snapshot(self.body(),(NOW-timedelta(hours=1)).isoformat(),NOW)
        b=self.body();b['publicVerdict']='TAKE'
        with self.assertRaises(ValueError):self.ledger.snapshot(b,(NOW+timedelta(hours=1)).isoformat(),NOW)
        b=self.body();b.pop('modelVersion')
        with self.assertRaises(ValueError):self.ledger.snapshot(b,(NOW+timedelta(hours=1)).isoformat(),NOW)

    def test_zero_push_missing_result(self):
        b=self.body();b['line']['value']=0;b['projection']=0
        sid=self.ledger.snapshot(b,(NOW+timedelta(hours=1)).isoformat(),NOW)
        with self.assertRaises(ValueError):self.ledger.settle(sid,None,'FINAL',now=NOW+timedelta(hours=4),result_source='MOCK_TEST_ONLY')
        self.assertEqual(self.ledger.settle(sid,0,'FINAL',now=NOW+timedelta(hours=4),result_source='MOCK_TEST_ONLY')['grade'],'PUSH')

    def test_no_ephemeral_storage(self):
        with self.assertRaises(ValueError):ShadowLedger(':memory:')

    def test_no_mlb_database_contamination(self):
        path=Path(self.tmp.name)/'other-sport.sqlite'
        connection=sqlite3.connect(path);connection.execute('CREATE TABLE mlb_predictions(id TEXT)');connection.commit();connection.close()
        with self.assertRaises(ValueError):ShadowLedger(path)

class APITests(unittest.TestCase):
    def test_admin_health_route_denied(self):
        from api.nfl import handler
        request=object.__new__(handler);request.headers={};request.path='/api/nfl/model-health?season=2026'
        with patch('api.nfl.session_with_live_access',return_value=True),patch('v2.board.admin_auth.is_admin_request',return_value=False),patch('api.nfl.send_json') as send:
            request.do_GET();self.assertEqual(send.call_args.args[1],403)
