import json
import unittest
from unittest.mock import patch
import cs2_history as h


def fixture(number=1, ended=True):
    boards=[]
    assignments=[]
    for team in ('Alpha','Beta'):
        rows=[]
        for i in range(5):
            slug=f'{team.lower()}{i}'
            kills=10+i
            rows.append(f'<div class="table-row"><a href="/players/{slug}">{slug}</a><div class="kills">{kills}</div><div class="deaths">8</div><div class="assists">2</div></div>')
            var=f'p{team}{i}'
            assignments.append(f'{var}.id={i};{var}.game_id=99;{var}.kills={kills};{var}.death=8;{var}.assists=2;{var}.headshots=a;{var}.steam_profile={{player:{{id:{i},slug:"{slug}",nickname:"{slug}"}}}};')
        boards.append(f'<div class="c-widget-match-scoreboard"><div class="o-widget__header">{team} Scoreboard Mirage (M{number})</div>'+''.join(rows)+'</div>')
    return ('<span class="status">'+('Ended' if ended else 'Live')+'</span>'+''.join(boards)+
            '<script>window.__NUXT__=(function(a){'+''.join(assignments)+'return {}}(4))</script>')


class HistoryTests(unittest.TestCase):
    def setUp(self):
        h._memory.clear()
        self.fan = patch.object(h,'fan_out',return_value={'covered':0,'games':0})
        self.fan.start()
        self.addCleanup(self.fan.stop)

    def test_exact_headshots_are_validated_against_entire_map(self):
        result=h.map_result(fixture(),'/matches/alpha-vs-beta-01-10-2026/mirage','2026-10-01')
        self.assertEqual(len(result['players']),10)
        self.assertEqual(result['players']['alpha0']['headshots'],4)
        broken=fixture().replace('pAlpha0.kills=10;', 'pAlpha0.kills=20;')
        result=h.map_result(broken,'/matches/a/mirage','2026-10-01')
        self.assertTrue(all('headshots' not in p for p in result['players'].values()))

    def test_reject_live_incomplete_and_unknown_map_order(self):
        for html in (fixture(ended=False),fixture().replace('(M1)',''),fixture().replace('/players/alpha0','/not-player/alpha0')):
            with self.assertRaises(ValueError): h.map_result(html,'/matches/a/mirage','2026-10-01')

    def test_maps_12_require_both_maps_not_map_3(self):
        maps=[h.map_result(fixture(n),f'/matches/a/map{n}','2026-10-01') for n in (1,3)]
        game=h.games_for('alpha0',maps)[0]
        self.assertEqual(game['values'],{'map1kills':10,'map1headshots':4})
        maps.append(h.map_result(fixture(2),'/matches/a/map2','2026-10-01'))
        self.assertEqual(h.games_for('alpha0',maps)[0]['values']['maps12kills'],20)
        self.assertEqual(h.games_for('alpha0',maps)[0]['values']['maps12headshots'],8)

    def test_player_identity_and_calendar_date(self):
        html='<h1>alpha0</h1><a class="table-row" href="/matches/alpha-vs-beta-01-10-2026/mirage"><div class="team-name">Alpha</div><div class="team-name">Beta</div></a>'
        self.assertEqual(h.player_maps(html,'alpha0')[0]['date'],'2026-10-01')
        with self.assertRaises(ValueError):h.player_maps(html,'beta0')

    def test_board_only_reads_saved_data_and_enrolls_every_player(self):
        saved={'alpha0':json.dumps({'games':[{'values':{'map1kills':10}}],'updatedAt':1,'source':'bo3'})}
        def command(*args):return saved if args[0]=='HGETALL' else None
        with patch.object(h,'command',side_effect=command),patch.object(h,'fetch',side_effect=AssertionError('network')):
            result=h.attach({'rows':[{'player':'alpha0'},{'player':'beta0'}]})
        self.assertTrue(result['historyAvailable'])
        self.assertNotIn('history',result['rows'][1])

    def test_collector_keeps_good_data_on_timeout(self):
        saved={'alpha0':{'checkedAt':0,'games':[{'values':{'map1kills':10}}],'updatedAt':1,'source':'bo3'}}
        writes=[]
        def command(*args):
            if args[0]=='SET':return 'OK'
            if args[0]=='HSET':writes.append(args)
        jobs={'alpha0':{'player':'alpha0','slug':'alpha0','enrolledAt':h.time.time()}}
        with patch.object(h,'read_entries',side_effect=[jobs,saved]),patch.object(h,'command',side_effect=command),patch.object(h,'fetch',side_effect=TimeoutError):
            result=h.warm()
        self.assertEqual(result['failed'],1)
        self.assertEqual(json.loads(writes[-1][-1])['games'],saved['alpha0']['games'])

    def test_collector_uses_shared_map_cache_and_keeps_partial_progress(self):
        path='/matches/a/mirage'
        result=h.map_result(fixture(),path,'2026-10-01')
        state={'checkedAt':0,'listedAt':h.time.time(),'listParserVersion':2,'paths':[{'path':path,'date':'2026-10-01'},{'path':'/matches/a/ancient','date':'2026-10-01'}]}
        writes=[]
        def command(*args):
            if args[0]=='SET':return 'OK'
            if args[:2]==('HGET',h.STATE):return json.dumps(state)
            if args[:3]==('HGET',h.MAPS,path):return json.dumps(result)
            if args[0]=='HSET':writes.append(args)
        jobs={'alpha0':{'player':'alpha0','slug':'alpha0','enrolledAt':h.time.time()}}
        with patch.object(h,'read_entries',side_effect=[jobs,{}]),patch.object(h,'command',side_effect=command),patch.object(h,'fetch',side_effect=TimeoutError) as fetch:
            h.warm()
        self.assertEqual(fetch.call_count,1)
        self.assertEqual(json.loads(writes[-1][-1])['games'][0]['values']['map1kills'],10)
        self.assertNotIn('maps12kills',json.loads(writes[-1][-1])['games'][0]['values'])

    def test_same_day_order_comes_from_source_not_match_name(self):
        maps=[h.map_result(fixture(),f'/matches/{m}/mirage','2026-10-01') for m in ('a','z')]
        paths=[{'path':'/matches/a/mirage'},{'path':'/matches/z/mirage'}]
        self.assertEqual([g['gameId'] for g in h.games_for('alpha0',maps,paths)],['/matches/z','/matches/a'])

    def test_one_failed_map_does_not_block_remaining_maps(self):
        paths=[{'path':f'/matches/a/map{n}','date':'2026-10-01'} for n in (3,1,2)]
        state={'listedAt':h.time.time(),'listParserVersion':2,'paths':paths}
        writes=[]
        def command(*args):
            if args[0]=='SET':return 'OK'
            if args[:2]==('HGET',h.STATE):return json.dumps(state)
            if args[0]=='HSET':writes.append(args)
        jobs={'alpha0':{'player':'alpha0','slug':'alpha0','enrolledAt':h.time.time()}}
        with patch.object(h,'read_entries',side_effect=[jobs,{}]),patch.object(h,'command',side_effect=command),patch.object(h,'fetch',side_effect=[TimeoutError(),fixture(1),fixture(2)]):
            result=h.warm(max_maps=3)
        self.assertEqual(result['failed'],1)
        self.assertEqual(json.loads(writes[-1][-1])['games'][0]['values']['maps12kills'],20)


class FanOutTests(unittest.TestCase):
    def test_one_series_fills_all_ten_verified_players(self):
        maps={f'/matches/a/map{n}':h.map_result(fixture(n),f'/matches/a/map{n}','2026-10-01') for n in (1,2)}
        jobs={f'{team}{i}':{'slug':f'{team}{i}','enrolledAt':h.time.time()} for team in ('alpha','beta') for i in range(5)}
        jobs['wrong']={'slug':'unrelated','enrolledAt':h.time.time()}
        with patch.object(h,'read_entries',side_effect=[maps,{},{}]),patch.object(h,'command') as command:
            result=h.fan_out(jobs)
        self.assertEqual(result,{'covered':10,'games':10})
        self.assertEqual(command.call_args.args[:2],('HSET',h.SAVED))
        self.assertNotIn('wrong',command.call_args.args)

    def test_one_player_page_supplies_verified_complete_kills_history(self):
        path='/matches/alpha-vs-beta-01-09-2026/mirage'
        html='<h1>alpha0</h1><a class="table-row" href="'+path+'"><div class="team-name">Alpha</div><div class="team-name">Beta</div><div class="kills">20</div><div class="deaths">10</div><div class="assists">4</div></a>'
        html+='<script>window.__NUXT__=(function(a){return {"widget-player-maps-results-alpha0":{results:[{slug:"alpha-vs-beta-01-09-2026",start_date:"2026-09-01T12:00:00Z",map_name:"de_mirage",game_number:1,winner_clan_score:13,loser_clan_score:8,advanced_kills:20,advanced_deaths:10,advanced_assists:4}]}}}(0))</script>'
        paths=h.player_maps(html,'alpha0')
        maps=h.listed_results(html,'alpha0',paths)
        self.assertEqual(len(maps),1)
        self.assertEqual(h.games_for('alpha0',maps)[0]['values'],{'map1kills':20})
        self.assertEqual(h.listed_results(html.replace('advanced_kills:20','advanced_kills:21'),'alpha0',paths),[])
        self.assertEqual(h.listed_results(html.replace('winner_clan_score:13','winner_clan_score:10'),'alpha0',paths),[])


if __name__=='__main__':unittest.main()
