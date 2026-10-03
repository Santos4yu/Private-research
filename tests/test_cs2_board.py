import unittest
from unittest.mock import patch
from cs2_board import build
import cs2_board
from cs2_underdog import parse
import prizepicks_export_core as export
from tests.test_prizepicks_export import FakePrizePicks,player,projection

class CS2Tests(unittest.TestCase):
    def setUp(self):
        # Each test starts from a server that has not read or written the board yet.
        cs2_board._snapshot.update(at=0.0,raw=None)
        cs2_board._published.update(at=0.0,digest=None)
        cs2_board._cache.update(at=0,value=None)

    def test_unchanged_board_is_not_rewritten_on_every_tick(self):
        value={'rows':[{'player':'alpha0','line':20.5}],'lineUpdatedAt':1}
        with patch('cs2_history.attach',side_effect=lambda board:board),patch('cs2_history.command') as command:
            writes=lambda:sum(call.args[0]=='SET' for call in command.call_args_list)
            cs2_board.publish_saved(value);cs2_board.publish_saved(value)
            self.assertEqual(writes(),1)
            cs2_board.publish_saved({**value,'rows':[{'player':'alpha0','line':21.5}]})
            self.assertEqual(writes(),2)
            # Rewritten before readers would treat it as stale.
            cs2_board._published['at']-=cs2_board.REPUBLISH_SECONDS
            cs2_board.publish_saved({**value,'rows':[{'player':'alpha0','line':21.5}]})
            self.assertEqual(writes(),3)

    def test_full_board_compression_is_lossless_and_smaller_than_host_limit(self):
        import gzip,json
        payload={'histories':{str(i):{'games':[{'values':{'map1kills':20,'map1headshots':12},'opponent':'Verified opponent','mapDetails':[{'kills':20,'headshots':12}]}]*40} for i in range(300)}}
        raw,encoding=cs2_board.response_bytes(payload,'br, gzip, deflate')
        self.assertEqual(encoding,'gzip')
        self.assertEqual(json.loads(gzip.decompress(raw)),payload)
        self.assertLess(len(raw),4_000_000)
        plain,encoding=cs2_board.response_bytes(payload,'gzip;q=0, br')
        self.assertIsNone(encoding)
        self.assertEqual(json.loads(plain),payload)

    def test_api_compression_headers_match_actual_transferred_bytes(self):
        import io,gzip,json
        from api.board import handler
        request=object.__new__(handler);request.headers={'Accept-Encoding':'gzip'};request.wfile=io.BytesIO()
        headers={}
        request.send_response=lambda status:None
        request.send_header=lambda key,value:headers.update({key:value})
        request.end_headers=lambda:None
        request._send(200,{'rows':[]},compress=True)
        raw=request.wfile.getvalue()
        self.assertEqual(headers['Content-Encoding'],'gzip')
        self.assertEqual(int(headers['Content-Length']),len(raw))
        self.assertEqual(json.loads(gzip.decompress(raw)),{'rows':[]})

    def test_books_join_only_when_both_teams_and_start_match(self):
        pp={'player':'Alxc','teamAbbr':'HAVU','opponent':'BBL','startsAt':'2099-01-01T15:00:00+00:00','apps':[{'key':'prizepicks'}]}
        ud={'player':'Alxc','teamAbbr':None,'opponent':'BBL Esports vs HAVU Gaming','startsAt':'2099-01-01T15:00:00Z','apps':[{'key':'underdog'}]}
        wrong={**ud,'opponent':'Sangal vs HAVU Gaming'}
        cs2_board.align_events([pp,ud,wrong])
        self.assertEqual((ud['teamAbbr'],ud['opponent']),('HAVU','BBL'))
        self.assertEqual(wrong['opponent'],'Sangal vs HAVU Gaming')
    def test_prebuilt_board_never_fetches_external_sources(self):
        import json,time
        snapshot={'rows':[{'player':'alpha','startsAt':'2099-01-01T00:00:00Z'}],
                  'histories':{'alpha':{'games':[{'values':{'map1kills':10}}]}},
                  'snapshotAt':time.time(),'lineUpdatedAt':time.time()}
        with patch('cs2_history.command',return_value=json.dumps(snapshot)) as command,patch.object(cs2_board,'_refresh',side_effect=AssertionError('network')):
            result=cs2_board.board()
        self.assertEqual(result['histories'],snapshot['histories'])
        self.assertEqual(command.call_count,1)

    def test_saved_board_older_than_three_minutes_still_serves_without_provider_wait(self):
        import json,time
        snapshot={'rows':[{'player':'alpha','startsAt':'2099-01-01T00:00:00Z'}],
                  'histories':{},'snapshotAt':time.time()-240,'lineUpdatedAt':time.time()-240}
        with patch('cs2_history.command',return_value=json.dumps(snapshot)),patch.object(cs2_board,'_refresh',side_effect=AssertionError('slow source')):
            self.assertEqual(len(cs2_board.board()['rows']),1)

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
             patch('cs2_history.command',return_value=None), \
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

