"""Free ATP/WTA singles results. Unknown match statistics remain missing."""
import json
import gzip
from pathlib import Path
import threading
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from urllib.request import Request, build_opener, ProxyHandler

_cache = {}
_lock = threading.Lock()
_fetch_lock = threading.Lock()


def aliases(name):
    # The source lists this player by his second given name, Daniel.
    if name_key(name) == 'adolfodanielvallejo':
        return {name_key(name), 'vallejod'}
    parts = str(name or '').replace('.', '').split()
    if len(parts) < 2:
        return {name_key(name)}
    return {name_key(name), name_key(' '.join(parts[1:])+parts[0][0]),
            name_key(parts[-1]+parts[0][0])}


def parse_csv_match(record):
    if record.get('status') != 'FINISHED' or record.get('status_extra') != 'FINISHED':
        return []
    try:
        date = datetime.fromtimestamp(float(record['date_timestamp']), timezone.utc).isoformat()
        scores = [[float(record[f'{side}_set_{i}_score']) for i in range(1,6)
                   if record.get(f'{side}_set_{i}_score') != ''] for side in ('home','away')]
    except (ValueError,TypeError,KeyError):
        return []
    league = 'wta' if 'WTA' in record.get('tour_type_human','') else 'atp'
    match = {'id':record['match_id'],'date':date,'status':{'type':{'completed':True,'name':'STATUS_FINAL'}},
             'competitors':[{'id':record[f'{side}_id'],'athlete':{'displayName':record[f'{side}_name']},
                             'winner':record.get('winner_code')==str(index+1),
                             'linescores':[{'value':value} for value in scores[index]]}
                            for index,side in enumerate(('home','away'))]}
    result = parse_match({'id':'csv','name':record.get('tournament'),'season':{'year':record['season_year']}},match,league)
    for index,row in enumerate(result):
        side,other=('home','away') if index==0 else ('away','home')
        row.update(surface=record.get('surface'),round=record.get('round'),opponentRank=record.get(f'{other}_rank'),
                   source='TennisData.App',odds=record.get(f'{side}_odds_match_winner'))
        values=row['values']
        for field,key in [('aces','aces'),('double_faults','doublefaults'),
                          ('service_points_won_perc','servicepointswonpercentage'),
                          ('return_points_won_perc','returnpointswonpercentage'),
                          ('break_points_won_perc','breakpointswonpercentage'),
                          ('break_points_saved_perc','breakpointssavedpercentage')]:
            try:
                values[key]=float(record[f'{side}_{field}'])
            except (ValueError,TypeError,KeyError):
                pass
        if 'aces' in values and 'doublefaults' in values:
            # PrizePicks' published tennis scoring, verified September 2026.
            won=values['setswon'];lost=values['totalsets']-won
            values['fantasyscore']=10+values['gameswon']-values['gameslost']+3*(won-lost)+.5*(values['aces']-values['doublefaults'])
    return result


def snapshot_history(player):
    path=Path(__file__).resolve().parent/'data'/'tennis'/'history.json.gz'
    if not path.exists():
        return None
    with _lock:
        saved=_cache.get('snapshot')
        if saved is None:
            with gzip.open(path,'rt',encoding='utf-8') as stream:
                saved=json.load(stream)
            _cache['snapshot']=saved
            paired={}
            for row in saved['games']:
                paired.setdefault(row['gameId'],[]).append(row)
            for pair in paired.values():
                if len(pair)!=2:continue
                for index,row in enumerate(pair):
                    other=pair[1-index]
                    row['rank']=other.get('opponentRank')
                    v=row['values'];ov=other['values']
                    if 'aces' in ov:v['acesallowed']=ov['aces']
                    if 'servicepointswonpercentage' in v and 'returnpointswonpercentage' in v and v['servicepointswonpercentage']<100:
                        v['dominanceratio']=v['returnpointswonpercentage']/(100-v['servicepointswonpercentage'])
                    row['bestOf']=5 if max(v['setswon'],v['totalsets']-v['setswon'])==3 else 3
                    row['opponentOdds']=other.get('odds')
                    row['opponentValues']=dict(ov)
            index={}
            for row in saved['games']:
                index.setdefault(name_key(row['player']),[]).append(row)
            _cache['snapshot_by_name']=index
    names=aliases(player)
    rows=[row for key in names for row in _cache['snapshot_by_name'].get(key,[])]
    # Initial-and-surname collisions must not merge two different people.
    ids={r['playerId'] for r in rows}
    if len(ids)>1:
        return None
    return {'player':player,'games':sorted(rows,key=lambda r:r['date']),
            'source':'TennisData.App free ATP/WTA season downloads',
            'availableStats':sorted({k for r in rows for k in r['values']}),
            'updatedAt':saved['importedAt'],'historyThrough':max((r['date'] for r in rows),default=None)}


def name_key(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', str(value or '')).lower()
                   if c.isascii() and c.isalnum())


def parse_match(event, match, league):
    status = match.get('status', {}).get('type', {})
    # Walkovers, retirements and unfinished matches cannot grade full-match props.
    if not status.get('completed') or status.get('name') != 'STATUS_FINAL':
        return []
    competitors = match.get('competitors', [])
    if len(competitors) != 2:
        return []
    sets = [[s.get('value') for s in c.get('linescores', [])] for c in competitors]
    if not sets[0] or len(sets[0]) != len(sets[1]):
        return []
    if any(not isinstance(v, (int, float)) for scores in sets for v in scores):
        return []
    # A final status sometimes accompanies an incomplete last set.
    if any(max(a, b) < 6 or (abs(a-b) < 2 and max(a, b) != 7)
           for a, b in zip(*sets)):
        return []
    required = 3 if event.get('major') and league == 'atp' else 2
    if max(sum(a>b for a,b in zip(sets[0],sets[1])), sum(a<b for a,b in zip(sets[0],sets[1]))) < required:
        return []
    rows = []
    for index, player in enumerate(competitors):
        opponent = competitors[1-index]
        mine, theirs = sets[index], sets[1-index]
        values = {'totalgameswon': sum(mine), 'gameswon': sum(mine),
                  'gameslost': sum(theirs), 'totalgames': sum(mine)+sum(theirs),
                  'totalsets': len(mine), 'setswon': sum(a>b for a,b in zip(mine,theirs)),
                  '1stsettotalgames': mine[0]+theirs[0], '1stsettotalgameswon': mine[0],
                  'totaltiebreaks': sum({a,b} == {6,7} for a,b in zip(mine,theirs))}
        values['tiebreakswon']=sum(a==7 and b==6 for a,b in zip(mine,theirs))
        for stat in player.get('statistics', []):
            key = name_key(stat.get('name') or stat.get('label'))
            try:
                number = float(stat.get('value', stat.get('displayValue')))
            except (ValueError, TypeError):
                continue
            if key in {'aces', 'doublefaults', 'breakpointswon'}:
                values[key] = number
        rows.append({'player': player.get('athlete', {}).get('displayName'),
                     'playerId': str(player.get('id') or ''), 'league': league,
                     'date': match.get('date'), 'season': event.get('season', {}).get('year'),
                     'gameId': f"{league}:{event.get('id')}:{match.get('id')}",
                     'event': event.get('name'), 'round': match.get('round', {}).get('displayName'),
                     'opponent': opponent.get('athlete', {}).get('displayName'),
                     'opponentRank': opponent.get('curatedRank', {}).get('current'),
                     'result': 'W' if player.get('winner') else 'L',
                     'score': ' '.join(f'{a:g}-{b:g}' for a,b in zip(mine,theirs)),
                     'values': values, 'seasonKind': 'regular'})
    return rows


def _fetch(league, start, end):
    url = f'https://site.api.espn.com/apis/site/v2/sports/tennis/{league}/scoreboard?dates={start}-{end}'
    req = Request(url)
    with build_opener(ProxyHandler({})).open(req, timeout=20) as response:
        payload = json.load(response)
    result = []
    for event in payload.get('events', []):
        for group in event.get('groupings', []):
            if group.get('grouping', {}).get('slug') not in {'mens-singles', 'womens-singles'}:
                continue
            for match in group.get('competitions', []):
                result.extend(parse_match(event, match, league))
    return result


def history(player):
    if not name_key(player):
        raise ValueError('Player name required.')
    snapshot=snapshot_history(player)
    live={'games':[]}
    try:
        import tennis_live
        live=tennis_live.player_history(player)
        try:
            tennis_live.tick(budget=10)
            live=tennis_live.player_history(player)
        except Exception:
            pass  # Quota/outage never hides already-persisted matches.
    except Exception:
        pass
    if snapshot and snapshot['games'] or live['games']:
        games=list((snapshot or {}).get('games',[]))
        for new in live['games']:
            found=next((i for i,old in enumerate(games)
                        if old['date'][:10]==new['date'][:10]
                        and name_key(old['opponent']) in aliases(new['opponent'])),None)
            if found is None:
                games.append(new)
            else:
                # Keep older fields when the fresh source doesn't report them.
                games[found]={**games[found], **new,
                              'values':{**games[found]['values'], **new['values']},
                              'opponentValues':{**games[found].get('opponentValues',{}), **new.get('opponentValues',{})}}
        return {'player':player,'games':sorted(games,key=lambda g:g['date']),
                'source':'TennisData.App historical snapshot + automatic Tennis API finals',
                'availableStats':sorted({k for g in games for k in g['values']}),
                'updatedAt':live.get('updatedAt',(snapshot or {}).get('updatedAt')),
                'historyThrough':max(g['date'] for g in games)}
    saved_key = f'vortex:tennis:history:v1:{name_key(player)}'
    try:
        from v2.board import store
        saved = store.get(saved_key, timeout=2)
        if saved:
            return json.loads(saved)
    except Exception:
        store = None
    now = datetime.now(timezone.utc)
    end = now.strftime('%Y%m%d')
    start = f'{now.year}0101'
    with _lock:
        cached = _cache.get('results')
    if cached and time.time()-cached['at'] < 1800:
        rows = cached['rows']
    else:
        with _fetch_lock:
            with _lock:
                fresh = _cache.get('results')
            if fresh and time.time()-fresh['at'] < 1800:
                rows, failures = fresh['rows'], []
            else:
                with ThreadPoolExecutor(max_workers=4) as pool:
                    ranges = [(start,end),(f'{now.year-1}0101',f'{now.year-1}1231')]
                    futures = [pool.submit(_fetch, league, a, b) for league in ('atp','wta') for a,b in ranges]
                    rows, failures = [], []
                    for future in futures:
                        try:
                            rows.extend(future.result())
                        except Exception as error:
                            failures.append(error)
                if not failures:
                    with _lock:
                        _cache['results'] = {'at': time.time(), 'rows': rows}
        if failures:
            # Do not cache a failed tour as an empty history.
            if cached:
                rows = cached['rows']
            else:
                raise RuntimeError('Tennis results could not load. Try again.') from failures[0]
        else:
            with _lock:
                _cache['results'] = {'at': time.time(), 'rows': rows}
    matches = {r['gameId']: r for r in rows if name_key(r['player']) == name_key(player)}
    games = sorted(matches.values(), key=lambda r: r['date'] or '')
    payload = {'player': player, 'games': games, 'source': 'ESPN ATP/WTA results',
            'availableStats': sorted({k for g in games for k in g['values']}),
            'updatedAt': int(time.time()*1000)}
    if store and games:
        try:
            store.set(saved_key,json.dumps(payload),ex=1800)
        except Exception:
            pass
    return payload
