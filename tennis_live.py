"""Quota-limited free tennis result ingestion into persistent Redis storage.

Completed results only. Calls are shared across visitors; missing stats stay missing.
"""
import json
import os
import re
import time
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen

PREFIX = 'vortex:tennis:auto:v1:'
HOST = 'tennis-api-atp-wta-itf.p.rapidapi.com'


def setting(name):
    if os.getenv(name):
        return os.environ[name]
    # Local development only; these files are gitignored.
    for path in (Path(__file__).parent/'.env', Path(__file__).parent.parent/'.env'):
        if path.exists():
            for line in path.read_text(encoding='utf-8').splitlines():
                if line.startswith(name+'='):
                    return line.split('=', 1)[1].strip().strip('\"\'')
    return ''


def redis(*command):
    url, token = setting('KV_REST_API_URL'), setting('KV_REST_API_TOKEN')
    if not url or not token:
        raise RuntimeError('Tennis persistent storage is not configured.')
    request = Request(url, data=json.dumps(command).encode(),
                      headers={'Authorization':'Bearer '+token, 'Content-Type':'application/json'})
    with urlopen(request, timeout=6) as response:
        result = json.load(response)
    if result.get('error'):
        raise RuntimeError('Tennis storage request failed.')
    return result.get('result')


def read(key, default=None):
    value = redis('GET', PREFIX+key)
    return json.loads(value) if value else default


def write(key, value):
    return redis('SET', PREFIX+key, json.dumps(value)) == 'OK'


def api(path):
    key = setting('TENNIS_RAPIDAPI_KEY') or redis('GET', PREFIX+'api-key')
    if not key:
        raise RuntimeError('Tennis API key is not configured.')
    # Atomic reservation: leave ten calls for setup/provider-console testing.
    day = datetime.now(timezone.utc).strftime('%Y%m%d')
    count = redis('INCR', PREFIX+'quota:'+day)
    redis('EXPIRE', PREFIX+'quota:'+day, 172800)
    if count > 40:
        raise RuntimeError('Free tennis daily quota reached; stored history is retained.')
    request = Request('https://'+HOST+path, headers={'X-RapidAPI-Key':key,'X-RapidAPI-Host':HOST})
    with urlopen(request, timeout=8) as response:
        return json.load(response)


def parse_result(match, league, stats):
    from tennis_history import parse_match
    if match.get('result_type') != 'completed':
        return []
    scores = re.findall(r'(\d+)-(\d+)(?:\(\d+\))?', match.get('result') or '')
    if not scores:
        return []
    competitors=[]
    for index in (1, 2):
        player=match.get('player'+str(index)) or {}
        competitors.append({'id':player.get('id'), 'athlete':{'displayName':player.get('name')},
                            'winner':index==1, 'linescores':[{'value':int(s[index-1])} for s in scores]})
    tournament=match.get('tournament') or {}
    event={'id':tournament.get('id'),'name':tournament.get('name'),
           'season':{'year':int(match['date'][:4])},
           'major':match.get('best_of')==5}
    rows=parse_match(event, {'id':match['matchId'],'date':match['date'],
                           'status':{'type':{'completed':True,'name':'STATUS_FINAL'}},
                           'competitors':competitors},league)
    for index,row in enumerate(rows,1):
        row.update(source='Tennis API',round=str(match.get('roundId') or ''),
                   surface=(tournament.get('court') or {}).get('name') if isinstance(tournament.get('court'),dict) else tournament.get('court'),
                   odds=match.get('odd'+str(index)), providerMatchId=str(match['matchId']))
        values=row['values']
        mine=stats.get('player'+str(index)+'Stats') or {}
        other=stats.get('player'+str(3-index)+'Stats') or {}
        # Verify identity before assigning opponent or player statistics.
        expected=match.get('player'+str(index)+'Id')
        reported=mine.get('player'+str(index)+'Id')
        if reported is not None and str(reported)!=str(expected):
            continue
        for field,key in [('aces','aces'),('doubleFaults','doublefaults'),
                          ('breakPointWonGm','breakpointswon'),('breakPointChanceGm','breakpointchances'),
                          ('breakPointFacedGm','breakpointsfaced'),('breakPointSavedGm','breakpointssaved')]:
            if isinstance(mine.get(field),(int,float)):
                values[key]=mine[field]
        row['rank']=match.get('player'+str(index),{}).get('currentRank')
        if isinstance(match.get('round'),dict):
            row['round']=match['round'].get('name')
        row['bestOf']=match.get('best_of') or (5 if max(values['setswon'],values['totalsets']-values['setswon'])==3 else 3)
        row['counts']={field:value for field,value in mine.items() if isinstance(value,(int,float))}
        if isinstance(other.get('breakPointWonGm'),(int,float)):
            values['breakpointsgivenup']=other['breakPointWonGm']
        if 'breakpointswon' in values and 'breakpointsgivenup' in values:
            held=values['gameswon']-values['breakpointswon']-values.get('tiebreakswon',0)
            served=held+values['breakpointsgivenup']
            if held>=0 and served>0:
                values['servicegamesheld']=held
                values['servicegamesplayed']=served
                values['holdpercentage']=100*held/served
        if isinstance(other.get('aces'),(int,float)):
            values['acesallowed']=other['aces']
        for num,den,key in [('firstServe','firstServeOf','firstservepercentage'),
                            ('winningOnFirstServe','winningOnFirstServeOf','firstservewonpercentage'),
                            ('winningOnSecondServe','winningOnSecondServeOf','secondservewonpercentage'),
                            ('breakPointWonGm','breakPointChanceGm','breakpointswonpercentage'),
                            ('breakPointSavedGm','breakPointFacedGm','breakpointssavedpercentage')]:
            if isinstance(mine.get(num),(int,float)) and isinstance(mine.get(den),(int,float)) and mine[den]>0:
                values[key]=100*mine[num]/mine[den]
        if 'aces' in values and 'doublefaults' in values:
            values['fantasyscore']=10+values['gameswon']-values['gameslost']+3*(2*values['setswon']-values['totalsets'])+.5*(values['aces']-values['doublefaults'])
        won=mine.get('winningOnFirstServe');second=mine.get('winningOnSecondServe');total=mine.get('firstServeOf')
        otherwon=other.get('winningOnFirstServe');othersecond=other.get('winningOnSecondServe');othertotal=other.get('firstServeOf')
        if all(isinstance(v,(int,float)) for v in (won,second,total)) and total>0:
            values['servicepointswonpercentage']=100*(won+second)/total
            if isinstance(mine.get('doubleFaults'),(int,float)) and isinstance(mine.get('firstServe'),(int,float)) and total>mine['firstServe']:
                values['doublefaultpercentage']=100*mine['doubleFaults']/(total-mine['firstServe'])
                values['secondservepercentage']=100-values['doublefaultpercentage']
        if all(isinstance(v,(int,float)) for v in (otherwon,othersecond,othertotal)) and othertotal>0:
            values['returnpointswonpercentage']=100*(othertotal-otherwon-othersecond)/othertotal
        if 'servicepointswonpercentage' in values and 'returnpointswonpercentage' in values and values['servicepointswonpercentage']<100:
            values['dominanceratio']=values['returnpointswonpercentage']/(100-values['servicepointswonpercentage'])
    return rows


def track(player):
    from tennis_history import name_key
    redis('ZADD',PREFIX+'players',int(time.time()),name_key(player))


def track_players(players):
    from tennis_history import name_key
    names={name_key(player) for player in players if name_key(player)}
    if names:
        arguments=[part for name in names for part in (int(time.time()),name)]
        redis('ZADD',PREFIX+'players',*arguments)


def tick(budget=18, force=False):
    """Discover recent finals, queue relevant matches, then ingest under quota.

    A lease serializes discovery and writes. Queue survives timeout/quota errors.
    Only players visited in Finder or on its current board consume stats calls.
    """
    token=secrets.token_hex(12)
    if not redis('SET',PREFIX+'lock',token,'NX','EX',90):
        return {'status':'busy'}
    deadline=time.monotonic()+budget
    status={'status':'ok','saved':0}
    try:
        players=set(redis('ZRANGEBYSCORE',PREFIX+'players',int(time.time())-90*86400,'+inf') or [])
        if not players:
            return {'status':'waiting-for-players'}
        queue=read('queue',{})
        now=datetime.now(timezone.utc)
        for league in ('atp','wta'):
            discovery=read('discovery:'+league,{})
            if force or time.time()-discovery.get('at',0)>6*3600:
                if time.monotonic()>deadline-8:
                    break
                start=(now-timedelta(days=7)).strftime('%Y-%m-%d')
                end=now.strftime('%Y-%m-%d')
                path=f'/tennis/v2/{league}/results/{start}/{end}?pageSize=500&filter=PlayerGroup:singles'
                page=discovery.get('page',1)
                response=api(path+f'&pageNo={page}')
                from tennis_history import name_key
                for match in response.get('data',[]):
                    if match.get('result_type')!='completed':
                        continue
                    if not any(name_key((match.get('player'+str(i)) or {}).get('name')) in players for i in (1,2)):
                        continue
                    identifier=league+':'+str(match['matchId'])
                    if not read('done:'+identifier):
                        queue.setdefault(identifier,{'league':league,'match':match})
                write('queue',queue)
                # Continue pagination on next tick without skipping older finals.
                write('discovery:'+league, {'at':0 if response.get('hasNextPage') else time.time(),
                                          'page':page+1 if response.get('hasNextPage') else 1})
        for identifier,item in list(queue.items()):
            if item.get('nextAttempt',0)>time.time():
                continue
            if time.monotonic()>deadline-8:
                break
            match=item['match'];league=item['league']
            path=f"/tennis/v2/{league}/h2h/match-stats/{match['tournamentId']}/{match['player1Id']}/{match['player2Id']}"
            stats=api(path).get('data') or {}
            rows=parse_result(match,league,stats)
            # Persist score history even if serving stats have not arrived yet.
            from tennis_history import name_key
            for row in rows:
                key='history:'+name_key(row['player'])
                existing=read(key,{'games':[]})
                games={g['gameId']:g for g in existing['games']}
                games[row['gameId']]=row
                write(key,{'games':sorted(games.values(),key=lambda g:g['date']), 'updatedAt':int(time.time()*1000)})
            complete=bool(rows) and all('aces' in row['values'] and 'doublefaults' in row['values'] for row in rows)
            if complete or item.get('attempts',0)>=2:
                write('done:'+identifier,{'at':time.time(),'servingStats':complete})
                del queue[identifier]
            else:
                queue[identifier]['attempts']=item.get('attempts',0)+1
                queue[identifier]['nextAttempt']=time.time()+6*3600
            write('queue',queue)
            status['saved']+=len(rows)
        write('status',dict(status,checkedAt=int(time.time()*1000),pending=len(queue)))
        return status
    finally:
        redis('EVAL',"if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",1,PREFIX+'lock',token)


def player_history(player):
    from tennis_history import name_key
    track(player)
    return read('history:'+name_key(player), {'games':[]})
