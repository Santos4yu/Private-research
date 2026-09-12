import unittest
from copy import deepcopy
from random import Random
from backend.sports.nfl.opportunity import estimate, reconcile, team_volume, player_opportunity
from backend.sports.nfl.allocation import allocate, absence_scenario
from backend.sports.nfl.services.play_by_play import summarize


class OpportunityTests(unittest.TestCase):
    def team_rows(self):
        return [{'week':w,'game_id':str(w),'team_id':'MOCK','stats':{'offensive_plays':65,'pass_plays':37,'attempts':35,'carries':28,
                'dropbacks':40,'called_rushes':25,'scrambles':3,'sacks_suffered':2,'spikes':0,'drives':10},
                'states':{s:{'plays':n,'dropbacks':d,'secondsPerPlay':30} for s,n,d in [('LEADING',20,8),('CLOSE',25,16),('TRAILING',20,16)]}} for w in range(1,9)]

    def mock_profile(self, value):
        return {'metrics':{'expectedTargets':{'mean':value,'status':'AVAILABLE','share':.2,'standardDeviation':2},'expectedCarries':{'mean':value,'status':'AVAILABLE','share':.2}}}

    def test_missing_is_not_zero(self):
        self.assertIsNone(estimate([(1, None)], 2)['mean'])
        self.assertEqual(estimate([(1, 0)], 2)['mean'], 0)

    def test_future_excluded(self):
        self.assertEqual(estimate([(1, 10), (2, 999)], 2)['mean'], 10)

    def test_small_sample_shrinkage(self):
        self.assertLess(estimate([(1, .38)], 2, .2)['mean'], .38)

    def test_target_and_carry_capacity(self):
        for cap in (35, 22):
            self.assertLessEqual(sum(reconcile({'a': 30, 'b': 20, 'missing': None}, cap).values()), cap)

    def test_volume_coherence(self):
        rows = [{'week': w, 'stats': {'offensive_plays': 65, 'pass_plays': 40, 'attempts': 37, 'carries': 25}} for w in range(1, 8)]
        v = team_volume(rows, rows, 8)
        self.assertEqual(v['expectedPassPlays']['mean'] + v['expectedRushAttempts']['mean'], v['expectedPlays']['mean'])
        self.assertLessEqual(v['expectedTeamPassAttempts']['mean'], v['expectedPassPlays']['mean'])
        self.assertIsNone(v['expectedDropbacks']['mean'])

    def test_injury_and_identity_fail(self):
        for player, injury in [({}, None), ({'id': 'mock', 'team_id': 'MOCK'}, 'QUESTIONABLE')]:
            self.assertEqual(player_opportunity(player, [], [], {}, 3, injury)['status'], 'NOT_AVAILABLE')

    def test_position_and_vacated_unavailable(self):
        p = player_opportunity({'id': 'mock', 'team_id': 'MOCK', 'position': 'WR'}, [], [], {'expectedTeamPassAttempts': {'mean': None}}, 3)
        self.assertNotIn('expectedCarries', p['metrics'])
        self.assertIsNone(p['metrics']['expectedTargets']['mean'])
        self.assertEqual(p['vacatedOpportunity']['status'], 'NOT_AVAILABLE')

    def test_true_dropbacks_partition_and_attempts(self):
        v=team_volume(self.team_rows(),self.team_rows(),9)
        self.assertAlmostEqual(v['expectedPlays']['mean'],v['expectedDropbacks']['mean']+v['expectedCalledRushAttempts']['mean']+v['expectedSpikes']['mean'])
        self.assertAlmostEqual(v['expectedRushAttempts']['mean'],v['expectedCalledRushAttempts']['mean']+v['expectedScrambles']['mean'])
        self.assertLessEqual(v['expectedTeamPassAttempts']['mean'],v['expectedDropbacks']['mean'])

    def test_script_sample_gate_and_historical_exposure(self):
        self.assertEqual(team_volume(self.team_rows(),[],3)['gameScript']['status'],'NOT_AVAILABLE')
        script=team_volume(self.team_rows(),[],9)['gameScript']
        self.assertEqual(script['status'],'AVAILABLE')
        self.assertAlmostEqual(sum(s['weight'] for s in script['states'].values()),1)
        self.assertLess(script['states']['LEADING']['passRate'],script['states']['TRAILING']['passRate'])

    def test_role_jump_uses_changed_sample(self):
        rows=self.team_rows(); v=team_volume(rows,[],9)
        logs=[{'week':r['week'],'game_id':r['game_id'],'team_id':'MOCK','stats':{'targets':3 if r['week']<7 else 18}} for r in rows]
        p=player_opportunity({'id':'mock','team_id':'MOCK','position':'WR'},logs,rows,v,9)
        self.assertEqual(p['roleStatus'],'INCREASING')
        self.assertEqual(p['metrics']['expectedTargets']['sample'],2)
        self.assertGreater(p['metrics']['expectedTargets']['share'],.3)
        self.assertEqual(p['sampleReliability'],'LOW')

    def test_role_drop_and_no_future_leakage(self):
        rows=self.team_rows(); v=team_volume(rows,[],9)
        logs=[{'week':r['week'],'game_id':r['game_id'],'team_id':'MOCK','stats':{'targets':18 if r['week']<7 else 3}} for r in rows]
        p={'id':'mock','team_id':'MOCK','position':'WR'}
        a=player_opportunity(p,logs,rows,v,9)
        self.assertEqual(a['roleStatus'],'DECREASING')
        logs.append({'week':99,'game_id':'future','team_id':'MOCK','stats':{'targets':99}})
        self.assertEqual(a,player_opportunity(p,logs,rows,v,9))

    def test_snaps_do_not_create_routes(self):
        rows=self.team_rows(); v=team_volume(rows,[],9)
        usage=[{'week':r['week'],'game_id':r['game_id'],'team_id':'MOCK','offense_snaps':50} for r in rows]
        p=player_opportunity({'id':'mock','team_id':'MOCK','position':'WR'},[],rows,v,9,usage=usage)
        self.assertAlmostEqual(p['metrics']['expectedSnaps']['mean'],50)
        self.assertIsNone(p['metrics']['expectedRoutes']['mean'])

    def test_qb_opportunities_separate(self):
        rows=self.team_rows(); v=team_volume(rows,[],9)
        logs=[{'week':r['week'],'game_id':r['game_id'],'team_id':'MOCK','stats':{'attempts':35,'carries':5,'scrambles':3,'kneels':1,'non_scramble_rushes':1}} for r in rows]
        p=player_opportunity({'id':'mock','team_id':'MOCK','position':'QB'},logs,rows,v,9)
        self.assertLessEqual(p['metrics']['expectedPassAttempts']['mean'],v['expectedDropbacks']['mean'])
        self.assertNotIn('expectedTargets',p['metrics'])
        self.assertAlmostEqual(p['metrics']['expectedScrambles']['mean'],3)
        self.assertIsNotNone(p['metrics']['expectedKneels']['mean'])

    def test_roster_reconciliation_and_missing_capacity(self):
        v=team_volume(self.team_rows(),[],9)
        original={'a':self.mock_profile(30),'b':self.mock_profile(20)}
        saved=deepcopy(original)
        result,allocation=allocate(original,v)
        self.assertEqual(original,saved)
        for metric,cap in [('expectedTargets','expectedTeamPassAttempts'),('expectedCarries','expectedRushAttempts')]:
            self.assertLessEqual(sum(p['metrics'][metric]['mean'] for p in result.values()),v[cap]['mean']+1e-9)
            self.assertGreaterEqual(allocation[metric]['unassigned'],0)
        self.assertEqual(reconcile({'a':20},None),{})

    def test_random_allocation_invariants(self):
        rng=Random(4)
        for _ in range(100):
            cap=rng.random()*50
            values={str(i):rng.random()*20 for i in range(25)}
            self.assertLessEqual(sum(reconcile(values,cap).values()),cap+1e-8)

    def test_vacated_not_blindly_redistributed(self):
        v=team_volume(self.team_rows(),[],9)
        s=absence_scenario({'a':self.mock_profile(10),'b':self.mock_profile(5)},{'a'},{},self.team_rows(),v,9,{})
        self.assertEqual(s['status'],'NOT_AVAILABLE')
        self.assertIsNone(s['players'])
        self.assertIsNone(s['probability'])
        self.assertEqual(s['vacated']['expectedTargets'],10)

    def test_vacated_uses_verified_absence_evidence(self):
        rows=self.team_rows(); v=team_volume(rows,[],9)
        logs={'b':[{'game_id':r['game_id'],'week':r['week'],'stats':{'targets':14,'carries':10}} for r in rows[:3]]}
        s=absence_scenario({'a':self.mock_profile(10),'b':self.mock_profile(5)},{'a'},logs,rows,v,9,{'a':['1','2','3']})
        self.assertEqual(s['status'],'LOW_CONFIDENCE')
        self.assertIsNone(s['probability'])
        self.assertGreater(s['players']['b']['metrics']['expectedTargets']['mean'],5)
        self.assertIsNone(s['players']['a']['metrics']['expectedTargets']['mean'])

    def test_variance_and_no_silent_invalid_values(self):
        self.assertIsNone(estimate([(1,float('nan')),(2,float('inf'))],3)['mean'])
        self.assertIsNone(estimate([(1,4)],2)['standardDeviation'])
        self.assertGreater(estimate([(1,2),(2,10)],3)['variance'],0)

    def test_pbp_scrambles_sacks_and_deleted_plays(self):
        base={'game_id':'mock','week':'1','season_type':'REG','posteam':'MOCK','defteam':'OTHER','posteam_type':'home','play_type':'pass',
              'qb_dropback':'1','qb_scramble':'0','rush_attempt':'0','pass_attempt':'1','sack':'0','qb_kneel':'0','qb_spike':'0',
              'score_differential':'0','fixed_drive':'1','play_deleted':'0','passer_player_id':'qb','rusher_player_id':'','receiver_player_id':'wr'}
        sack={**base,'sack':'1','receiver_player_id':''}
        scramble={**base,'play_type':'run','qb_scramble':'1','rush_attempt':'1','pass_attempt':'0','rusher_player_id':'qb','receiver_player_id':''}
        deleted={**base,'play_deleted':'1'}
        s=summarize([base,sack,scramble,deleted])
        g=s['teams'][0]['stats']; qb=next(p for p in s['players'] if p['player_id']=='qb')['stats']
        self.assertEqual(g['offensive_plays'],3)
        self.assertEqual(g['dropbacks'],3)
        self.assertEqual(g['attempts'],1)
        self.assertEqual(qb['dropbacks'],3)
        self.assertEqual(qb['scrambles'],1)

    def test_pbp_missing_flags_rejected(self):
        from backend.sports.nfl.services.nflverse import ProviderError
        with self.assertRaises(ProviderError):
            summarize([{'game_id':'mock','week':'1','season_type':'REG','posteam':'MOCK','defteam':'OTHER','play_type':'pass'}])

    def test_verified_structural_change_excludes_old_role(self):
        rows=self.team_rows(); v=team_volume(rows,rows,9)
        logs=[{'week':r['week'],'game_id':r['game_id'],'team_id':'MOCK','stats':{'targets':7}} for r in rows]
        event={'kind':'DEPTH_RANK_CHANGE','week':7,'direction':'INCREASING','verified':True}
        p=player_opportunity({'id':'mock','team_id':'MOCK','position':'WR'},logs,rows,v,9,role_events=[event])
        self.assertEqual(p['metrics']['expectedTargets']['sample'],2)
        self.assertEqual(p['roleStatus'],'INCREASING')
        event['week']=9
        p=player_opportunity({'id':'mock','team_id':'MOCK','position':'WR'},logs,rows,v,9,role_events=[event])
        self.assertIsNone(p['metrics']['expectedTargets']['mean'])

    def test_unverified_role_event_does_not_change_estimate(self):
        rows=self.team_rows();v=team_volume(rows,rows,9)
        logs=[{'week':r['week'],'game_id':r['game_id'],'team_id':'MOCK','stats':{'targets':7}} for r in rows]
        player={'id':'mock','team_id':'MOCK','position':'WR'}
        self.assertEqual(player_opportunity(player,logs,rows,v,9),player_opportunity(player,logs,rows,v,9,role_events=[{'week':7,'verified':False}]))

    def test_invalid_capacity_rejected(self):
        for value in (-1,float('nan'),float('inf')):
            with self.assertRaises(ValueError):
                reconcile({'mock':10},value)

    def test_abnormal_games_are_flagged_not_silently_removed(self):
        rows=self.team_rows(); rows[0]['flags']=['OVERTIME']
        v=team_volume(rows,rows,9)
        self.assertEqual(v['expectedPlays']['sample'],8)
        self.assertEqual(v['sampleFlags'][0]['flags'],['OVERTIME'])

    def test_stale_role_does_not_become_confident(self):
        rows=self.team_rows();v=team_volume(rows,rows,14)
        logs=[{'week':r['week'],'game_id':r['game_id'],'team_id':'MOCK','stats':{'targets':7}} for r in rows]
        p=player_opportunity({'id':'mock','team_id':'MOCK','position':'WR'},logs,rows,v,14)
        self.assertEqual(p['status'],'NOT_AVAILABLE')
        self.assertIsNone(p['metrics']['expectedTargets']['mean'])

if __name__ == '__main__':
    unittest.main()
