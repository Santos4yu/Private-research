"""Synthetic fixtures are confined to tests, never production data."""
import unittest
from copy import deepcopy
from backend.sports.nfl.projections.models import ProjectionContext,SUPPORTED,model_key,model_version,project
from backend.sports.nfl.projections.efficiency import efficiency,positional_prior,prior_table
from backend.sports.nfl.projections.validate import statistics,mean_baseline

class ProjectionTests(unittest.TestCase):
    def context(self,position='WR'):
        stats={'attempts':30,'passing_yards':210,'completions':18,'passing_interceptions':1,
               'carries':15,'rushing_yards':75,'targets':10,'receptions':6,'receiving_yards':90}
        logs=[{'id':'mock-player','position':position,'team_id':'MOCK','game_id':f'mock-{w}','week':w,'season':2025,'stats':dict(stats)} for w in range(1,7)]
        peers=[{**deepcopy(r),'id':f'mock-peer-{i}'} for i in range(8) for r in logs]
        metrics={key:{'mean':v,'status':'AVAILABLE','sample':6,'reliability':'MEDIUM'} for key,v in [('expectedTargets',9),('expectedCarries',18),('expectedPassAttempts',35),('expectedDesignedRushes',2),('expectedScrambles',3),('expectedKneels',.5)]}
        profiles={k:{'rawValue':v,'adjustedValue':v,'n':200,'priorExposure':100,'games':6,'adjustment':'MOCK_TEST_ONLY'} for k,v in [('ypa',8),('completion_rate',.7),('ypc',5),('yac_per_reception',6)]}
        refs={k:{'mean':v-1 if k not in ('completion_rate',) else .65} for k,v in [('ypa',8),('completion_rate',.7),('ypc',5),('yac_per_reception',6)]}
        return ProjectionContext({'id':'mock-player','position':position,'team_id':'MOCK'},'mock-next',7,logs,logs+peers,
                {'status':'AVAILABLE','player':{'status':'AVAILABLE','roleStatus':'STABLE','sampleReliability':'MEDIUM','metrics':metrics},'health':{'injuryCertainty':'UNKNOWN'}},
                {'defenseProfile':{'metrics':profiles},'references':refs,'freshness':{'factor':1}},2025)

    def policy(self,ctx,method='recency',promotion='EXPERIMENTAL'):
        return {model_key(ctx.player['position'],p):{'promotion':promotion,'method':method,'coefficient':.2} for p in SUPPORTED[ctx.player['position']]}

    def test_every_supported_position_prop(self):
        for position,props in SUPPORTED.items():
            ctx=self.context(position)
            for prop in props:
                with self.subTest(position=position,prop=prop):
                    r=project(ctx,prop,self.policy(ctx))
                    self.assertIsNotNone(r['projectionMean'])
                    self.assertEqual(r['status'],'LOW_CONFIDENCE')
                    self.assertTrue(r['modelVersion'].endswith('_V1'))

    def test_no_line_side_or_verdict_output(self):
        ctx=self.context()
        r=project(ctx,'receiving_yards',self.policy(ctx))
        self.assertTrue(r['lineIndependent'])
        for key in ('overProbability','underProbability','confidence','verdict','line','side'):
            self.assertNotIn(key,r)
        self.assertIsNone(r['projectionMedianIfSupported'])

    def test_receiver_decomposition(self):
        ctx=self.context()
        r=project(ctx,'receiving_yards',self.policy(ctx))
        self.assertAlmostEqual(r['projectionMean'],9*.6*15)
        receptions=project(ctx,'receptions',self.policy(ctx))
        self.assertAlmostEqual(receptions['projectionMean'],9*.6)

    def test_volume_models_preserve_phase4(self):
        for position,prop,value in [('QB','passing_attempts',35),('QB','rush_attempts',5.5),('RB','rush_attempts',18),('WR','targets',9)]:
            ctx=self.context(position)
            self.assertEqual(project(ctx,prop,self.policy(ctx))['projectionMean'],value)

    def test_missing_opportunity(self):
        ctx=self.context();ctx.opportunity={'status':'NOT_AVAILABLE'}
        self.assertIsNone(project(ctx,'receiving_yards',self.policy(ctx))['projectionMean'])

    def test_missing_efficiency_not_zero(self):
        ctx=self.context()
        for row in ctx.logs:row['stats']['receiving_yards']=None
        self.assertIsNone(project(ctx,'receiving_yards',self.policy(ctx))['projectionMean'])

    def test_measured_zero_opportunity_remains_zero(self):
        ctx=self.context();ctx.opportunity['player']['metrics']['expectedTargets']['mean']=0
        self.assertEqual(project(ctx,'receptions',self.policy(ctx))['projectionMean'],0)

    def test_small_sample_gates(self):
        ctx=self.context();ctx.logs=ctx.logs[:2]
        self.assertIsNone(project(ctx,'receiving_yards',self.policy(ctx))['projectionMean'])
        ctx=self.context();ctx.opportunity['player']['metrics']['expectedTargets']['sample']=1
        self.assertIsNone(project(ctx,'targets',self.policy(ctx))['projectionMean'])

    def test_shrinkage_real_prior(self):
        ctx=self.context()
        for row in ctx.logs:row['stats']['receiving_yards']=300
        prior=positional_prior(ctx.league_logs,'WR','mock-player','yardsPerReception',7)
        estimate=efficiency(ctx.logs,'yardsPerReception',7,prior)
        self.assertGreater(estimate['mean'],15)
        self.assertLess(estimate['mean'],50)

    def test_interceptions_strong_prior(self):
        ctx=self.context('QB')
        r=project(ctx,'interceptions',self.policy(ctx))
        prior=r['efficiencyInputs']['interceptionRate']
        self.assertEqual(prior['priorExposure'],prior['prior']['priorExposure']*3)
        self.assertGreaterEqual(r['projectionMean'],0)

    def test_no_future_or_previous_season_leakage(self):
        ctx=self.context()
        original=project(ctx,'receiving_yards',self.policy(ctx))['projectionMean']
        future={**deepcopy(ctx.logs[0]),'week':7,'stats':{**ctx.logs[0]['stats'],'receiving_yards':99999}}
        old={**deepcopy(future),'week':2,'season':2024}
        ctx.logs.extend([future,old]);ctx.league_logs.extend([future,old])
        self.assertEqual(project(ctx,'receiving_yards',self.policy(ctx))['projectionMean'],original)

    def test_role_change_does_not_reset_efficiency_talent(self):
        ctx=self.context()
        before=project(ctx,'receiving_yards',self.policy(ctx))
        ctx.opportunity['player']['roleStatus']='INCREASING'
        after=project(ctx,'receiving_yards',self.policy(ctx))
        self.assertEqual(before['efficiencyInputs'],after['efficiencyInputs'])
        self.assertEqual(after['roleStatus'],'INCREASING')

    def test_opponent_adjustment_trace(self):
        ctx=self.context()
        base=project(ctx,'receiving_yards',self.policy(ctx))
        adjusted=project(ctx,'receiving_yards',self.policy(ctx,'opponent'))
        self.assertGreater(adjusted['projectionMean'],base['projectionMean'])
        self.assertAlmostEqual(adjusted['projectionMean'],adjusted['baseProjection']+sum(a['statAdjustment'] for a in adjusted['matchupAdjustments']))

    def test_matchup_score_never_multiplies_projection(self):
        ctx=self.context();policy=self.policy(ctx,'opponent')
        original=project(ctx,'receiving_yards',policy)['projectionMean']
        ctx.matchup.update(matchupQuality=100,matchupCertainty=100)
        ctx.matchup['defenseProfile']['metrics']['pass_epa']={'rawValue':999999}
        self.assertEqual(project(ctx,'receiving_yards',policy)['projectionMean'],original)
        self.assertEqual(len(project(ctx,'receiving_yards',policy)['matchupAdjustments']),1)

    def test_missing_advanced_feature_not_silent_numeric_zero(self):
        ctx=self.context();ctx.matchup={}
        r=project(ctx,'receiving_yards',self.policy(ctx,'opponent'))
        self.assertEqual(r['matchupAdjustments'],[])
        self.assertEqual(r['status'],'LOW_CONFIDENCE')

    def test_injury_scenarios_prevent_unconditional_mean(self):
        ctx=self.context();ctx.opportunity.update(status='NOT_AVAILABLE',scenarios=[{'condition':'Mock player active'}]);ctx.opportunity['player']['status']='NOT_AVAILABLE'
        self.assertIsNone(project(ctx,'receiving_yards',self.policy(ctx))['projectionMean'])

    def test_teammate_uncertainty_is_conditional_not_confident(self):
        ctx=self.context();ctx.opportunity.update(status='LOW_CONFIDENCE',scenarios=[{'condition':'Mock teammate inactive','player':None,'probability':None}])
        r=project(ctx,'receiving_yards',self.policy(ctx))
        self.assertEqual(r['status'],'LOW_CONFIDENCE');self.assertIn('baseline only',r['projectionCondition'])
        alternative={'metrics':{'expectedTargets':{'mean':12}}}
        ctx.opportunity['scenarios'][0]['player']=alternative
        self.assertIsNone(project(ctx,'receiving_yards',self.policy(ctx))['projectionMean'])

    def test_disabled_and_missing_policy(self):
        ctx=self.context()
        self.assertIsNone(project(ctx,'receiving_yards',{})['projectionMean'])
        self.assertIsNone(project(ctx,'receiving_yards',self.policy(ctx,promotion='DISABLED'))['projectionMean'])
        self.assertIsNone(project(ctx,'receiving_yards',self.policy(ctx,method='unknown-formula'))['projectionMean'])

    def test_position_isolation_and_unsupported_tail_td(self):
        ctx=self.context('QB')
        for prop in ('receiving_yards','rushing_yards','passing_rushing_yards','passing_touchdowns','fantasy_score'):
            self.assertIsNone(project(ctx,prop,self.policy(ctx))['projectionMean'])
        ctx=self.context('WR')
        for prop in ('touchdowns','longest_reception'):
            self.assertIsNone(project(ctx,prop,self.policy(ctx))['projectionMean'])

    def test_combined_components_reconcile(self):
        ctx=self.context('RB');policy=self.policy(ctx)
        combined=project(ctx,'rushing_receiving_yards',policy)
        self.assertEqual(combined['projectionMean'],sum(c['projectionMean'] for c in combined['components']))
        self.assertIsNone(combined['uncertainty']['covariance'])
        policy['RB.receiving_yards']['promotion']='DISABLED'
        self.assertIsNone(project(ctx,'rushing_receiving_yards',policy)['projectionMean'])

    def test_rb_and_receiver_priors_separate(self):
        rb=self.context('RB');wr=self.context('WR')
        self.assertNotEqual(model_version('RB','receiving_yards'),model_version('WR','receiving_yards'))
        self.assertEqual(project(rb,'receiving_yards',self.policy(rb))['efficiencyInputs']['catchRate']['positionBaseline'],'RB')
        self.assertEqual(project(wr,'receiving_yards',self.policy(wr))['efficiencyInputs']['catchRate']['positionBaseline'],'WR')

    def test_validation_metrics_and_future_baseline(self):
        rows=[{'actual':10,'predictions':{'model':8}},{'actual':20,'predictions':{'model':22}}]
        measured=statistics(rows,'model')
        self.assertEqual(measured['MAE'],2);self.assertEqual(measured['bias'],0)
        ctx=self.context()
        self.assertEqual(mean_baseline(ctx.logs,'receiving_yards',4),90)

    def test_preaggregated_prior_equivalence(self):
        ctx=self.context()
        table=prior_table(ctx.league_logs,7)
        self.assertEqual(table['mock-player']['catchRate'],positional_prior(ctx.league_logs,'WR','mock-player','catchRate',7))

    def test_stale_current_team_role_cannot_project(self):
        ctx=self.context();ctx.week=12
        self.assertIsNone(project(ctx,'receiving_yards',self.policy(ctx))['projectionMean'])

if __name__=='__main__':unittest.main()
