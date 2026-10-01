import unittest
from unittest.mock import patch
from cs2_board import build
import cs2_board
from cs2_underdog import parse
import prizepicks_export_core as export
from tests.test_prizepicks_export import FakePrizePicks,player,projection

class CS2Tests(unittest.TestCase):
    def test_cs2_route_obeys_finder_and_cs2_switches(self):
        from api import board as api
        request=object.__new__(api.handler)
        request.path,request.headers='/api/board?view=cs2',{}
        sent=[]
        request._send=lambda status,payload:sent.append((status,payload))
        with patch('site_controls.allowed',return_value=True) as tab, \
             patch('site_controls.finder_sport_allowed',return_value=False), \
             patch.object(api,'session_with_live_access',return_value=True):
            request.do_GET()
        self.assertEqual(tab.call_args.args[1],'finder')
        self.assertEqual(sent[0][0],503)
        self.assertTrue(sent[0][1]['featureDisabled'])

    def test_one_provider_failure_keeps_the_other_provider_board(self):
        cs2_board._cache.update(at=0,value=None)
        with patch.object(cs2_board,'_fetch_projection_rows',side_effect=RuntimeError('Unavailable')), \
             patch('cs2_underdog.fetch',return_value=[{'id':'ud:1','player':'faveN'}]):
            result=cs2_board.board(force=True)
        self.assertEqual(result['sources'],['underdog'])
        self.assertEqual(result['rows'][0]['id'],'ud:1')
        self.assertEqual(result['unavailableSources'],['prizepicks'])
        cs2_board._cache.update(at=0,value=None)

    def test_prizepicks_exact_map_scopes_tiers_and_expired_filter(self):
        quotes=[{'id':str(i),'player':'junior','player_id':'p1','stat':stat,'line':line,
                 'start_time':'2099-01-01T00:00:00Z','description':'Team B MAPS 1-2',
                 'odds_type':tier,'team':'Voca'} for i,(stat,line,tier) in enumerate([
                    ('MAP 1 Kills',17.5,'standard'),('MAPS 1-2 Kills',33.5,'demon'),
                    ('MAPS 1-2 Headshots',14.5,'goblin')])]
        quotes += [{**quotes[0],'id':'past','start_time':'2020-01-01T00:00:00Z'},
                   {**quotes[0],'id':'combo','combo':True}]
        result=build(quotes,now=1800000000)
        self.assertEqual([r['marketKey'] for r in result['rows']],['map1kills','maps12kills','maps12headshots'])
        self.assertEqual([r['line'] for r in result['rows']],[17.5,33.5,14.5])
        self.assertTrue(all(r['opponent']=='Team B' for r in result['rows']))
        self.assertFalse(result['historyAvailable'])

    def test_cs2_prizepicks_export_resolves_exact_stat_not_other_map(self):
        export._PROJECTION_CACHE.clear();export._LEAGUE_CACHE.clear()
        quotes=[projection('cs1','265','p1','MAP 1 Kills',17.5),projection('cs2','265','p1','MAPS 1-2 Kills',33.5),projection('cs3','265','p2','MAP 1 Kills',12.5)]
        fake=FakePrizePicks(leagues={'data':[{'id':'265','attributes':{'name':'CS2'}}]},
                           feeds={'265':{'data':quotes,'included':[player('p1','junior','CS2'),player('p2','faveN','CS2')]}})
        with patch.object(export.requests,'get',side_effect=fake):
            status,result=export.build_export([{'league':'CS2','player':'junior','stat':'MAPS 1-2 Kills','line':33.5,'side':'over'},
                                               {'league':'CS2','player':'faveN','stat':'MAP 1 Kills','line':12.5,'side':'under'}])
        self.assertEqual(status,200,result)
        self.assertEqual(result['matches'][0]['projectionId'],'cs2')

    def test_underdog_filters_other_sports_and_live_and_preserves_scope(self):
        payload={'players':[{'id':'p1','sport_id':'CS','last_name':'faveN'}],
                 'appearances':[{'id':'a1','player_id':'p1','match_id':1}],
                 'games':[{'id':1,'sport_id':'CS','status':'scheduled','scheduled_at':'2099-01-01T00:00:00Z','title':'LG vs BIG'}],
                 'over_under_lines':[{'id':'q1','status':'active','stat_value':'26.5','live_event':False,
                  'over_under':{'appearance_stat':{'appearance_id':'a1','stat':'kills_on_maps_1_2'}},
                  'options':[{'status':'active','choice':'higher','american_price':'-112'},
                             {'status':'active','choice':'lower','american_price':'-108'}]}]}
        rows=parse(payload,now=1800000000)
        self.assertEqual((rows[0]['stat'],rows[0]['marketKey'],rows[0]['line']),('MAPS 1-2 Kills','maps12kills',26.5))
        self.assertEqual(rows[0]['apps'][0]['key'],'underdog')
        self.assertEqual(rows[0]['apps'][0]['under'],-108)
        payload['over_under_lines'][0]['live_event']=True
        self.assertEqual(parse(payload,now=1800000000),[])

