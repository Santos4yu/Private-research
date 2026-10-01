import unittest
from tennis_history import parse_match, parse_csv_match, aliases


class TennisHistoryTests(unittest.TestCase):
    def test_provider_second_given_name_alias(self):
        self.assertIn('vallejod', aliases('Adolfo Daniel Vallejo'))

    def match(self):
        return {'id':'1','date':'2026-09-20T12:00Z',
                'status':{'type':{'completed':True,'name':'STATUS_FINAL'}},
                'competitors':[
                    {'id':'a','athlete':{'displayName':'A'},'winner':True,
                     'linescores':[{'value':6},{'value':7}]},
                    {'id':'b','athlete':{'displayName':'B'},'winner':False,
                     'linescores':[{'value':4},{'value':6}]}]}

    def test_set_totals_and_tiebreak_are_exact(self):
        a,b=parse_match({'id':'e','season':{'year':2026}},self.match(),'atp')
        self.assertEqual(a['values']['totalgameswon'],13)
        self.assertEqual(b['values']['totalgameswon'],10)
        self.assertEqual(a['values']['totalgames'],23)
        self.assertEqual(a['values']['1stsettotalgames'],10)
        self.assertEqual(a['values']['totaltiebreaks'],1)
        self.assertNotIn('aces',a['values'])

    def test_walkovers_retirements_and_partial_sets_do_not_grade(self):
        match=self.match()
        match['status']['type']['name']='STATUS_WALKOVER'
        self.assertEqual(parse_match({},match,'atp'),[])
        match=self.match()
        match['competitors'][0]['linescores'][1]['value']=3
        self.assertEqual(parse_match({},match,'atp'),[])
        self.assertEqual(parse_match({'major':True},self.match(),'atp'),[])

    def test_fantasy_requires_reported_aces_and_double_faults(self):
        record={'match_id':'1','status':'FINISHED','status_extra':'FINISHED','date_timestamp':'1790000000',
                'season_year':'2026','tour_type_human':'ATP','winner_code':'1'}
        for side,scores in [('home',[6,7]),('away',[4,6])]:
            record.update({f'{side}_id':side,f'{side}_name':side,f'{side}_aces':'0',f'{side}_double_faults':'2'})
            for i in range(1,6):
                record[f'{side}_set_{i}_score']=str(scores[i-1]) if i<=len(scores) else ''
        a,b=parse_csv_match(record)
        self.assertEqual(a['values']['fantasyscore'],18)
        self.assertEqual(a['values']['aces'],0)
        record['home_aces']=''
        self.assertNotIn('fantasyscore',parse_csv_match(record)[0]['values'])


if __name__=='__main__':
    unittest.main()
