"""All synthetic examples below are explicit test-only matchup fixtures."""
import unittest
from copy import deepcopy
from backend.sports.nfl.matchup_interactions import normalize,frequency_fit,coverage_fit,route_fit,alignment_fit,run_concept_fit,pressure_fit
from backend.sports.nfl.matchup_profiles import profiles,pooled
from backend.sports.nfl.matchup import build_matchup,selection,metric_score
from backend.sports.nfl.services.matchup_data import aggregate


class MatchupTests(unittest.TestCase):
    def data(self):
        games=[]
        for w in range(1,9):
            for i in range(12):
                metrics={m:{'sum':value*n,'n':n} for m,value,n in [('pass_epa',i/20-.2,35),('run_epa',i/30-.2,25),('ypa',6+i/4,32),('ypc',3+i/6,25),('completion_rate',.55+i/100,32),('sack_rate',.03+i/300,35),('scramble_rate',.03,35),('yac_per_reception',4+i/10,20),('run_explosive',.05+i/200,25),('pass_explosive',.1+i/500,32)]}
                games.append({'game_id':f'mock-{w}-{i}','week':w,'team_id':f'O{(i+w)%12}','opponent_team_id':f'D{i}','metrics':metrics,'directions':{},'depths':{}})
        return {'games':games,'players':[],'connections':[],'fetchedAt':'mock-only'}

    def test_neutral_point_and_bounded_normalization(self):
        self.assertEqual(normalize(5,{'mean':5,'standardDeviation':2})['contribution'],0)
        self.assertGreater(normalize(7,{'mean':5,'standardDeviation':2})['contribution'],0)
        self.assertLess(abs(normalize(999,{'mean':5,'standardDeviation':2},.1)['contribution']),5.001)

    def test_invalid_reference_cannot_create_score(self):
        for ref in ({},{'mean':2,'standardDeviation':0},{'mean':2,'standardDeviation':-1},{'mean':float('nan'),'standardDeviation':1}):
            self.assertIsNone(normalize(0,ref))
        self.assertIsNone(normalize(None,{'mean':0,'standardDeviation':1}))

    def test_coverage_frequency_not_rare_split_dominance(self):
        split={'COMMON':{'mean':1,'n':500},'RARE':{'mean':10,'n':500}}
        ref={'mean':1,'standardDeviation':1}
        fit=frequency_fit({'COMMON':.95,'RARE':.05},split,ref,1,40)
        self.assertLess(fit['score'],53)
        self.assertEqual(fit['dataCoverage'],100)

    def test_coverage_shrinkage_small_sample(self):
        ref={'mean':1,'standardDeviation':1}
        low=frequency_fit({'ZONE':1},{'ZONE':{'mean':4.5,'n':12}},ref,1,100)
        large=frequency_fit({'ZONE':1},{'ZONE':{'mean':4.5,'n':500}},ref,1,100)
        self.assertLess(low['score'],large['score'])
        self.assertLess(low['certainty'],large['certainty'])
        self.assertEqual(low['status'],'LOW_CONFIDENCE')

    def test_missing_frequency_is_not_neutral_zero(self):
        for prior in (-1,float('nan'),float('inf')):
            self.assertIsNone(frequency_fit({'ZONE':1},{'ZONE':{'mean':2,'n':10}},{'mean':1,'standardDeviation':1},1,prior)['score'])
        fit=frequency_fit({'ZONE':1},{},{'mean':1,'standardDeviation':1},1,40)
        self.assertIsNone(fit['score'])
        self.assertEqual(fit['dataCoverage'],0)

    def test_receiver_qb_coverage_units_normalize_separately(self):
        ref={'mean':1,'standardDeviation':1}
        fit=coverage_fit({'ZONE':1},{'ZONE':{'mean':2,'n':100}},{'ZONE':{'mean':2,'n':100}},ref,ref,1,1,40,40)
        self.assertGreater(fit['score'],50)
        self.assertIsNone(coverage_fit({'ZONE':1},{'ZONE':{'mean':2,'n':100}},{},ref,ref,1,1,40,40)['score'])

    def test_route_requires_player_and_defense(self):
        ref={'mean':0,'standardDeviation':1}
        player={'CROSS':{'mean':3,'n':100}}
        self.assertIsNone(route_fit({'CROSS':1},player,{},ref,1,1,40)['score'])
        fit=route_fit({'CROSS':1},player,{'CROSS':{'mean':2,'n':100}},ref,1,1,40)
        self.assertGreater(fit['score'],50)

    def test_alignment_requires_matching_supported_exposure(self):
        fit=alignment_fit({'SLOT':1},{'SLOT':{'mean':2,'n':100}},{'OUTSIDE':{'mean':2,'n':100}},{'mean':0,'standardDeviation':1},1,1,40)
        self.assertIsNone(fit['score'])

    def test_run_concept_requires_blocking_evidence(self):
        split={'ZONE':{'mean':2,'n':100}}
        args=({'ZONE':1},split,split,{}, {'mean':0,'standardDeviation':1},{'player':1,'defense':1,'blocking':1},40)
        self.assertIsNone(run_concept_fit(*args)['score'])
        fit=run_concept_fit({'ZONE':1},split,split,split,{'mean':0,'standardDeviation':1},{'player':1,'defense':1,'blocking':1},40)
        self.assertGreater(fit['score'],50)

    def test_pressure_requires_actual_pressure_rate(self):
        self.assertIsNone(pressure_fit(None,{}, {},1,40)['score'])
        fit=pressure_fit(.1,{'PRESSURED':{'mean':0,'n':100},'CLEAN':{'mean':2,'n':500}},{'mean':1,'standardDeviation':1},1,40)
        self.assertGreater(fit['score'],50)

    def test_profiles_respect_chronology_and_missing_field_exposure(self):
        d=self.data(); p,ref=profiles(d['games'],9)
        original=deepcopy(p)
        d['games'].append({'week':99,'team_id':'FUTURE','opponent_team_id':'FUTURE','metrics':{'run_epa':{'sum':99999,'n':1}}})
        self.assertEqual(original,profiles(d['games'],9)[0])
        self.assertIsNone(p['D0']['metrics']['stuff_rate']['value'])
        self.assertEqual(p['D0']['metrics']['stuff_rate']['n'],0)
        self.assertIsNotNone(p['D0']['metrics']['run_epa']['adjustedValue'])

    def test_prop_specific_selection_and_qb_rushing_isolation(self):
        self.assertNotEqual(selection('WR','receiving_yards'),selection('WR','receptions'))
        self.assertEqual(selection('QB','rushing_yards'),{})
        self.assertIn('run_epa',selection('RB','rushing_yards').values())
        self.assertEqual(selection('RB','rush_attempts'),{})

    def test_unvalidated_feature_not_arbitrary_number(self):
        p,ref=profiles(self.data()['games'],9)
        self.assertIsNone(metric_score('run_epa',p['D0'],ref,{})['score'])
        self.assertIsNone(metric_score('run_epa',p['D0'],ref,{'run_epa':True},0)['score'])

    def test_double_count_groups_and_component_explainability(self):
        result=build_matchup(self.data(),{'id':'mock-rb','team_id':'O0','position':'RB'},'D0','rushing_yards',9,enabled={'run_epa':True,'run_explosive':True})
        self.assertEqual(len(result['scoreGroups']),1)
        self.assertAlmostEqual(result['matchupQuality'],50+sum(g['finalContribution'] for g in result['scoreGroups']))
        self.assertLess(result['matchupCertainty'],result['matchupQuality'])
        c=result['components']['defenseQuality']
        self.assertAlmostEqual(c['score'],50+sum(v['finalContribution'] for v in c['contributors']))
        self.assertIsNone(result['components']['coverageFit']['score'])

    def test_opportunity_not_overridden_by_quality(self):
        opp={'status':'NOT_AVAILABLE','player':{'metrics':{}},'team':{}}
        r=build_matchup(self.data(),{'id':'mock-rb','team_id':'O0','position':'RB'},'D0','rushing_yards',9,opp,enabled={'run_epa':True})
        self.assertEqual(r['components']['gameScriptFit']['context']['player']['metrics'],{})
        self.assertIsNone(r['components']['gameScriptFit']['score'])
        self.assertFalse(any(k in r for k in ('over_probability','verdict','projection')))

    def test_real_zero_preserved_not_missing(self):
        self.assertEqual(pooled([{'metrics':{'sack_rate':{'sum':0,'n':20}}}],'sack_rate')['value'],0)
        self.assertIsNone(pooled([{'metrics':{}}],'sack_rate')['value'])

    def test_pbp_field_missingness_and_sacks_not_pressure(self):
        base={'game_id':'mock','week':'1','season_type':'REG','posteam':'MOCK','defteam':'OTHER','play_type':'pass','play_deleted':'0','two_point_attempt':'0','qb_dropback':'1','qb_scramble':'0','sack':'0','pass_attempt':'1','rush_attempt':'0','complete_pass':'1','epa':'0','success':'1','yards_gained':'8','air_yards':'','yards_after_catch':'','cpoe':'','passer_player_id':'mock-qb','receiver_player_id':'mock-wr','rusher_player_id':''}
        d=aggregate([base]);m=d['games'][0]['metrics']
        self.assertEqual(m['pass_epa']['sum'],0)
        self.assertNotIn('cpoe',m)
        self.assertNotIn('pressure_rate',m)
        self.assertNotIn('yac_per_reception',m)

if __name__=='__main__':
    unittest.main()

