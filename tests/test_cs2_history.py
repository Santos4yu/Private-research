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


def listing_fixture(day, pages=2):
    slug=f'alpha-vs-beta-{day:02d}-09-2026'
    path=f'/matches/{slug}/mirage'
    return (f'<h1>alpha0</h1><a class="table-row" href="{path}"><span class="team-name">Alpha</span><span class="team-name">Beta</span>'
            '<span class="kills">20</span><span class="deaths">10</span><span class="assists">4</span></a>'
            '<script>window.__NUXT__=(function(a){return {"widget-player-maps-results-alpha0":{'
            f'total:{{count:2,pages:{pages},offset:0,limit:40}},results:[{{slug:"{slug}",start_date:"2026-09-{day:02d}T12:00:00Z",'
            'map_name:"de_mirage",game_number:1,winner_clan_score:13,loser_clan_score:8,advanced_kills:20,advanced_deaths:10,advanced_assists:4}]}}}(0))</script>')


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

    def test_missing_one_headshot_result_preserves_other_verified_players(self):
        for missing in ('null', '-1', '11', 'true'):
            html=fixture().replace('pAlpha0.headshots=a;',f'pAlpha0.headshots={missing};')
            result=h.map_result(html,'/matches/a/mirage','2026-09-01')
            self.assertNotIn('headshots',result['players']['alpha0'])
            self.assertEqual(sum('headshots' in p for p in result['players'].values()),9)
            self.assertEqual(result['players']['beta4']['headshots'],4)
            self.assertEqual(h.result_status(result=result)['result'],'headshots_missing')
        # Partial headshots still require a complete matching ten-player KDA.
        broken=html.replace('pAlpha0.kills=10;','pAlpha0.kills=9;')
        self.assertFalse(h.headshot_results(broken,h.map_result(html,'/matches/a/mirage','2026-09-01')['players']))

    def test_reject_live_incomplete_and_unknown_map_order(self):
        for html in (fixture(ended=False),fixture().replace('(M1)',''),fixture().replace('/players/alpha0','/not-player/alpha0')):
            with self.assertRaises(ValueError): h.map_result(html,'/matches/a/mirage','2026-10-01')

    def test_maps_12_require_both_maps_not_map_3(self):
        maps=[h.map_result(fixture(n),f'/matches/a/map{n}','2026-10-01') for n in (1,3)]
        game=h.games_for('alpha0',maps)[0]
        self.assertNotIn('maps12kills',game['values'])
        self.assertEqual(game['values']['map3headshots'],4)
        maps.append(h.map_result(fixture(2),'/matches/a/map2','2026-10-01'))
        self.assertEqual(h.games_for('alpha0',maps)[0]['values']['maps12kills'],20)
        self.assertEqual(h.games_for('alpha0',maps)[0]['values']['maps12headshots'],8)
        self.assertEqual(h.games_for('alpha0',maps)[0]['values']['map2headshots'],4)
        self.assertEqual(h.games_for('alpha0',maps)[0]['values']['maps123headshots'],12)
        only_second=h.games_for('alpha0',[h.map_result(fixture(2),'/matches/a/map2','2026-10-01')])[0]
        self.assertEqual(only_second['values']['map2headshots'],4)
        self.assertNotIn('map1kills',only_second['values'])
        self.assertNotIn('maps12headshots',only_second['values'])

    def test_combined_kills_allow_verified_listing_plus_full_scoreboards(self):
        maps=[h.map_result(fixture(n),f'/matches/a/map{n}','2026-09-01') for n in (1,2,3)]
        listed=maps[1]
        listed['listed']=True
        listed['players']['alpha0'].update(team=None,opponent='Alpha / Beta')
        listed['players']['alpha0'].pop('headshots')
        values=h.games_for('alpha0',maps)[0]['values']
        self.assertEqual(values['maps123kills'],30)
        self.assertNotIn('maps123headshots',values)
        maps[2]['players']['alpha0']['team']='Contradictory team'
        self.assertNotIn('maps123kills',h.games_for('alpha0',maps)[0]['values'])

    def test_player_identity_and_calendar_date(self):
        html='<h1>alpha0</h1><a class="table-row" href="/matches/alpha-vs-beta-01-10-2026/mirage"><div class="team-name">Alpha</div><div class="team-name">Beta</div></a>'
        self.assertEqual(h.player_maps(html,'alpha0')[0]['date'],'2026-10-01')
        with self.assertRaises(ValueError):h.player_maps(html,'beta0')

    def test_verified_alias_heading_is_not_required_to_equal_url_slug(self):
        for slug,nickname in [('device','dev1ce'),('frozen-david-cernansky','frozen'),('mith','MITHPUTTINI'),('atarax1a','atarax1a')]:
            self.assertEqual(h.player_maps(f'<h1>{nickname}</h1>',slug),[])
            with self.assertRaises(ValueError): h.player_maps('<h1>Someone else</h1>',slug)

    def test_public_pagination_metadata_is_read_without_executing_scripts(self):
        html='<script>window.__NUXT__=(function(a,b){return {"widget-player-maps-results-alpha0":{total:{count:a,pages:b,offset:0,limit:40}}}}(85,3))</script>'
        self.assertEqual(h.listing_pages(html,'alpha0'),{'count':85,'pages':3})
        self.assertEqual(h.listing_pages(html,'wrong'),{'count':None,'pages':1})
        self.assertEqual(h.listing_pages(html.replace('(85,3)','(400,10)'),'alpha0')['pages'],3)

    def test_public_second_page_adds_older_games_without_truncating_first_page(self):
        jobs={'alpha0':{'slug':'alpha0','enrolledAt':h.time.time()}}
        writes=[]
        def command(*args):
            if args[0]=='SET':return 'OK'
            if args[0]=='HSET':writes.append(args)
        with patch.object(h,'read_entries',side_effect=[jobs,{}]),patch.object(h,'command',side_effect=command), \
             patch.object(h,'fetch',side_effect=[listing_fixture(2),listing_fixture(1)]) as fetch:
            h.warm(listing_only=True)
        self.assertEqual([c.args[0] for c in fetch.call_args_list],['/players/alpha0/maps','/players/alpha0/maps?page=2'])
        entry=json.loads(writes[-1][-1])
        self.assertEqual(len(entry['games']),2)
        self.assertTrue(entry['coverage']['listingComplete'])
        self.assertTrue(entry['coverage']['partial'])  # Headshots still need scoreboards.

    def test_failed_second_page_preserves_first_page_and_marks_listing_incomplete(self):
        jobs={'alpha0':{'slug':'alpha0','enrolledAt':h.time.time()}}
        writes=[]
        def command(*args):
            if args[0]=='SET':return 'OK'
            if args[0]=='HSET':writes.append(args)
        with patch.object(h,'read_entries',side_effect=[jobs,{}]),patch.object(h,'command',side_effect=command), \
             patch.object(h,'fetch',side_effect=[listing_fixture(2),TimeoutError()]):
            result=h.warm(listing_only=True)
        entry=json.loads(writes[-1][-1])
        self.assertEqual(result['failed'],1)
        self.assertEqual(len(entry['games']),1)
        self.assertFalse(entry['coverage']['listingComplete'])

    def test_unfinished_listings_are_prioritized_over_completed_players(self):
        jobs={s:{'slug':s,'enrolledAt':h.time.time()} for s in ('alpha0','beta0')}
        saved={s:{'listingReady':True,'checkedAt':0,'coverage':{'listingComplete':s=='alpha0'}} for s in jobs}
        state={'listedAt':h.time.time(),'listParserVersion':2,'paginationVersion':1,'listingPages':2,
               'nextListingPage':2,'paths':[{'path':'/matches/old/mirage','date':'2026-09-02'}]}
        def command(*args):
            if args[0]=='SET':return 'OK'
            if args[:2]==('HGET',h.STATE):return json.dumps(state)
        with patch.object(h,'read_entries',side_effect=[jobs,saved]),patch.object(h,'command',side_effect=command), \
             patch.object(h,'player_maps',return_value=[{'path':'/matches/new/mirage','date':'2026-09-01'}]), \
             patch.object(h,'listed_results',return_value=[]),patch.object(h,'fetch',return_value='verified page') as fetch:
            h.warm(limit=1,listing_only=True)
        self.assertEqual(fetch.call_args.args[0],'/players/beta0/maps?page=2')

    def test_nonadvancing_pagination_is_deferred_without_claiming_complete_history(self):
        jobs={'alpha0':{'slug':'alpha0','enrolledAt':h.time.time()}}
        state={'listedAt':h.time.time(),'listParserVersion':2,'paginationVersion':1,'listingPages':2,
               'nextListingPage':2,'paths':[{'path':'/matches/old/mirage','date':'2026-09-02'}],
               'games':[{'values':{'map1kills':20}}]}
        writes=[]
        def command(*args):
            if args[0]=='SET': return 'OK'
            if args[:2]==('HGET',h.STATE): return json.dumps(state)
            if args[0]=='HSET': writes.append(args)
        with patch.object(h,'read_entries',side_effect=[jobs,{}]),patch.object(h,'command',side_effect=command), \
             patch.object(h,'player_maps',return_value=[]),patch.object(h,'fetch',return_value='empty later page'):
            result=h.warm(listing_only=True)
        saved=json.loads(writes[-1][-1])
        self.assertEqual(result['failed'],1)
        self.assertEqual(saved['listingStatus']['result'],'pagination_missing')
        self.assertGreater(saved['listingStatus']['nextAttemptAt'],h.time.time()+5*3600)
        self.assertEqual(saved['games'],state['games'])
        self.assertFalse(saved['coverage']['listingComplete'])

    def test_deferred_listings_do_not_starve_shared_headshots(self):
        jobs={s:{'slug':s,'enrolledAt':h.time.time()} for s in ('alpha0','beta0')}
        saved={s:{'listingReady':True,'sourceSlug':s,'coverage':{'listingComplete':False},
                  'listingStatus':{'nextAttemptAt':h.time.time()+3600}} for s in jobs}
        heads={'mapsCompleted':2,'pendingMaps':10,'readyMaps':8,'deferredMaps':2,'outcomes':{'complete':2}}
        with patch.object(h,'read_entries',side_effect=[jobs,saved]),patch.object(h,'command'), \
             patch.object(h,'warm_headshots',return_value=heads) as backfill, \
             patch.object(h,'fetch',side_effect=AssertionError('Deferred listing was requested')):
            result=h.warm(force=True)
        backfill.assert_called_once()
        self.assertEqual(result['listingsDeferred'],2)
        self.assertEqual(result['players'],2)
        self.assertEqual(result['headshots'],heads)

    def test_new_verified_identity_bypasses_prior_profile_backoff(self):
        jobs={'frozen':{'slug':'frozen','enrolledAt':h.time.time()}}
        saved={'frozen':{'sourceSlug':'frozen','listingStatus':{'nextAttemptAt':h.time.time()+3600}}}
        def command(*args): return 'OK' if args[0]=='SET' else None
        with patch.object(h,'read_entries',side_effect=[jobs,saved]),patch.object(h,'command',side_effect=command), \
             patch.object(h,'fetch',side_effect=TimeoutError) as fetch:
            h.warm(listing_only=True)
        self.assertEqual(fetch.call_args.args[0],'/players/frozen-david-cernansky/maps')

    def test_existing_jobs_are_migrated_to_verified_slugs(self):
        jobs={'frozen':{'slug':'frozen','enrolledAt':h.time.time()},'ataraxia':{'slug':'ataraxia'},'unknown':{'slug':'unknown'}}
        with patch.object(h,'read_entries',return_value=jobs),patch.object(h,'command') as command:
            result=h.read_jobs()
        self.assertEqual(result['frozen']['slug'],'frozen-david-cernansky')
        self.assertEqual(result['ataraxia']['slug'],'atarax1a')
        self.assertEqual(result['unknown']['slug'],'unknown')
        self.assertEqual(command.call_args.args[:2],('HSET',h.JOBS))

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
        state={'checkedAt':0,'listedAt':h.time.time(),'listParserVersion':2,'paginationVersion':1,'paths':[{'path':path,'date':'2026-10-01'},{'path':'/matches/a/ancient','date':'2026-10-01'}]}
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

    def test_shared_headshot_queue_collects_one_map_for_multiple_players(self):
        path='/matches/a/mirage'
        jobs={s:{'slug':s,'enrolledAt':h.time.time()} for s in ('alpha0','alpha1')}
        states={s:{'paths':[{'path':path,'date':'2026-09-01'}]} for s in jobs}
        def command(*args):return 'OK' if args[0]=='SET' else None
        with patch.object(h,'read_entries',side_effect=[jobs,states,{},{},{}]),patch.object(h,'command',side_effect=command),patch.object(h,'fetch',return_value=fixture()) as fetch:
            result=h.warm_headshots(publish=False)
        fetch.assert_called_once()
        self.assertEqual(result['mapsCompleted'],1)
        self.assertEqual(result['pendingMaps'],1)

    def test_empty_source_pages_are_deferred_without_blocking_other_maps(self):
        missing, valid = '/matches/missing/mirage', '/matches/valid/mirage'
        jobs={'alpha0':{'slug':'alpha0','enrolledAt':h.time.time()}}
        states={'alpha0':{'paths':[{'path':p,'date':'2026-09-01'} for p in (missing,valid)]}}
        statuses={missing:h.result_status(error=ValueError('Incomplete scoreboard'))}
        def command(*args): return 'OK' if args[0]=='SET' else None
        with patch.object(h,'read_entries',side_effect=[jobs,states,{},{},statuses]),patch.object(h,'command',side_effect=command),patch.object(h,'fetch',return_value=fixture()) as fetch:
            result=h.warm_headshots(publish=False)
        self.assertEqual(fetch.call_args.args[0],valid)
        self.assertEqual(result['deferredMaps'],1)
        self.assertEqual(result['mapsCompleted'],1)
        self.assertEqual(result['outcomes'],{'complete':1})

    def test_missing_source_headshots_are_recorded_not_zero_filled(self):
        path='/matches/missing/mirage'
        jobs={'alpha0':{'slug':'alpha0','enrolledAt':h.time.time()}}
        states={'alpha0':{'paths':[{'path':path,'date':'2026-09-01'}]}}
        writes=[]
        def command(*args):
            if args[0]=='SET': return 'OK'
            if args[0]=='HSET': writes.append(args)
        html=fixture().replace('.headshots=a;', '.unrelated=a;')
        with patch.object(h,'read_entries',side_effect=[jobs,states,{},{},{}]),patch.object(h,'command',side_effect=command),patch.object(h,'fetch',return_value=html):
            result=h.warm_headshots(publish=False)
        self.assertEqual(result['mapsCompleted'],0)
        self.assertEqual(result['outcomes'],{'headshots_missing':1})
        status=next(json.loads(w[-1]) for w in writes if w[1]==h.HS_STATUS)
        self.assertGreater(status['nextAttemptAt'],h.time.time()+5*3600)
        saved=next(json.loads(w[-1]) for w in writes if w[1]==h.MAPS)
        self.assertNotIn('headshots',saved['players']['alpha0'])

    def test_backoff_distinguishes_empty_source_from_transient_errors(self):
        missing=h.result_status(error=ValueError('Incomplete scoreboard'))
        transient=h.result_status(error=TimeoutError())
        self.assertEqual(missing['result'],'scoreboard_missing')
        self.assertGreater(missing['nextAttemptAt'],transient['nextAttemptAt'])
        response=h.requests.Response();response.status_code=429;response.headers['Retry-After']='1800'
        limited=h.result_status(error=h.requests.HTTPError(response=response))
        self.assertEqual(limited['result'],'rate_limited')
        self.assertGreaterEqual(limited['nextAttemptAt']-limited['checkedAt'],1800)

    def test_coverage_compares_only_same_played_scope(self):
        games=[{'values':{'map1kills':20,'map1headshots':0}},
               {'values':{'map1kills':10,'map2kills':15,'map2headshots':8,'maps12kills':25}}]
        report=h.coverage_for(games)
        self.assertEqual(report['scopes']['map1'],{'kills':2,'headshots':1,'missingHeadshots':1})
        self.assertEqual(report['scopes']['map2'],{'kills':1,'headshots':1,'missingHeadshots':0})
        self.assertEqual(report['scopes']['map3'],{'kills':0,'headshots':0,'missingHeadshots':0})
        self.assertTrue(report['partial'])
        self.assertFalse(h.coverage_for(games[:1])['partial'])
        self.assertTrue(h.coverage_for([])['partial'])

    def test_coverage_does_not_count_invalid_values(self):
        report=h.coverage_for([{'values':{'map1kills':True}},{'values':{'map1kills':float('nan')}},
                               {'values':{'map1kills':15,'map1headshots':None}}])
        self.assertEqual(report['scopes']['map1']['kills'],1)
        self.assertEqual(report['scopes']['map1']['missingHeadshots'],1)

    def test_audit_counts_all_active_players_and_flags_empty_histories(self):
        jobs={key:{'slug':key,'enrolledAt':h.time.time()} for key in ('alpha0','beta0')}
        jobs['expired']={'slug':'expired','enrolledAt':0}
        saved={'alpha0':{'coverage':{'listingComplete':True},'games':[{'values':{'map1kills':10,'map1headshots':4}}]}}
        with patch.object(h,'read_entries',side_effect=[jobs,saved,{}]): report=h.audit()
        self.assertEqual(report['players'],2)
        self.assertEqual(report['covered'],1)
        self.assertEqual(report['completePlayers'],1)
        self.assertEqual(report['scopes']['map1']['headshots'],1)

    def test_cached_map_without_headshots_is_retried_for_every_player(self):
        path='/matches/a/mirage'
        cached=h.map_result(fixture(),path,'2026-09-01')
        for player in cached['players'].values(): player.pop('headshots')
        state={'listedAt':h.time.time(),'listParserVersion':2,'paginationVersion':1,'paths':[{'path':path,'date':'2026-09-01'}],'maps':[cached]}
        writes=[]
        def command(*args):
            if args[0]=='SET':return 'OK'
            if args[:2]==('HGET',h.STATE):return json.dumps(state)
            if args[:2]==('HGET',h.MAPS):return json.dumps(cached)
            if args[0]=='HSET':writes.append(args)
        jobs={'alpha0':{'slug':'alpha0','enrolledAt':h.time.time()}}
        with patch.object(h,'read_entries',side_effect=[jobs,{}]),patch.object(h,'command',side_effect=command),patch.object(h,'fetch',return_value=fixture()) as fetch:
            h.warm()
        fetch.assert_called_once()
        saved_map=next(json.loads(w[-1]) for w in writes if w[1]==h.MAPS)
        self.assertTrue(all(p['headshots']==4 for p in saved_map['players'].values()))

    def test_one_failed_map_does_not_block_remaining_maps(self):
        paths=[{'path':f'/matches/a/map{n}','date':'2026-10-01'} for n in (3,1,2)]
        state={'listedAt':h.time.time(),'listParserVersion':2,'paginationVersion':1,'paths':paths}
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
        basic=html.replace('advanced_kills:20','advanced_kills:null,basic_kills:20,basic_deaths:10,basic_assists:4')
        self.assertEqual(h.listed_results(basic,'alpha0',paths)[0]['players']['alpha0']['kills'],20)
        self.assertEqual(h.listed_results(html.replace('winner_clan_score:13','winner_clan_score:10'),'alpha0',paths),[])


if __name__=='__main__':unittest.main()
