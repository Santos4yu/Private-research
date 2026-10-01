"""Verified current tennis matchup/profile data; private shared quota/cache."""
import time
from datetime import datetime,timezone
from urllib.parse import quote
from tennis_live import api,read,write,parse_result
from tennis_history import aliases,name_key

ROUND_LABELS={1:'Qualifying 1',2:'Qualifying 2',3:'Qualifying 3',4:'First round',5:'Second round',6:'Third round',7:'Fourth round',8:'Round robin',9:'Quarterfinal',10:'Semifinal',11:'Bronze match',12:'Final'}


def cached(key,path,ttl):
    saved=read('context:'+key)
    if saved and time.time()-saved['at']<ttl:
        return saved['data']
    try:
        data=api(path)
        write('context:'+key,{'at':time.time(),'data':data})
        return data
    except Exception:
        if saved:
            return saved['data']
        raise


def same(actual,expected):
    if name_key(expected)=='adolfodanielvallejo' and name_key(actual)=='danielvallejo':return True
    if name_key(actual)=='adolfodanielvallejo' and name_key(expected)=='danielvallejo':return True
    return name_key(actual) in aliases(expected) or name_key(expected) in aliases(actual)


def normalize_profile(raw):
    info=raw.get('information') or {}
    birth=raw.get('birthday');age=None
    try:
        born=datetime.fromisoformat(birth.replace('Z','+00:00'));now=datetime.now(timezone.utc)
        age=now.year-born.year-((now.month,now.day)<(born.month,born.day))
    except (ValueError,AttributeError):
        pass
    plays=info.get('plays') or ''
    return {'id':raw.get('id'),'name':raw.get('name'),'rank':raw.get('currentRank'),
            'rankChange':raw.get('progress'),'rankDate':(raw.get('curRank') or {}).get('date'),
            'bestRank':(raw.get('bestRank') or {}).get('position'),'age':age,
            'heightCm':info.get('height') or raw.get('height'),'hand':'Left' if 'left' in plays.lower() else 'Right' if 'right' in plays.lower() else None,
            'plays':plays or None,'country':raw.get('countryAcr'),'status':raw.get('playerStatus')}


def inline_stats(match):
    stats=match.get('stats') or match.get('stat') or {}
    result={}
    for index in (1,2):
        mine=dict(stats.get('player'+str(index)) or {})
        other=stats.get('player'+str(3-index)) or {}
        mine['player'+str(index)+'Id']=match.get('player'+str(index)+'Id')
        for old,new in [('breakPointsConverted','breakPointWonGm'),('breakPointsConvertedOf','breakPointChanceGm')]:
            if old in mine:mine[new]=mine[old]
        if isinstance(other.get('breakPointsConvertedOf'),(int,float)):
            mine['breakPointFacedGm']=other['breakPointsConvertedOf']
        if all(isinstance(other.get(k),(int,float)) for k in ('breakPointsConvertedOf','breakPointsConverted')):
            mine['breakPointSavedGm']=other['breakPointsConvertedOf']-other['breakPointsConverted']
        result['player'+str(index)+'Stats']=mine
    return result


def archive_rows(matches,league):
    rows=[]
    for raw in matches:
        match=dict(raw)
        match['matchId']=match.get('matchId') or match.get('id')
        if not match['matchId']:
            continue
        if not match.get('result_type') and match.get('result') and not any(c.isalpha() for c in match['result']):
            match['result_type']='completed'
        if 'laver cup' in (match.get('tournament') or {}).get('name','').lower():
            continue
        rows.extend(parse_result(match,league,inline_stats(match)))
    return rows


def refresh_player(player,league):
    identifier=str(player['id'])
    raw=cached(f'profile:{league}:{identifier}',f'/tennis/v2/{league}/player/profile/{identifier}?include=form,ranking,country',86400).get('data') or {}
    if str(raw.get('id'))!=identifier:
        raise ValueError('Player profile identity mismatch.')
    profile=normalize_profile(raw)
    payload=cached(f'past-full:{league}:{identifier}',f'/tennis/v2/{league}/player/past-matches/{identifier}?pageSize=500&include=round,tournament,tournament.court,stat',21600)
    rows=[]
    rows=[row for row in archive_rows(payload.get('data') or [],league) if str(row['playerId'])==identifier]
    saved=read('history:'+name_key(player['name']),{'games':[]})
    games={row['gameId']:row for row in saved['games']}
    for row in rows:
        old=games.get(row['gameId'],{})
        merged={**old,**{key:value for key,value in row.items() if value is not None}}
        for field in ('values','opponentValues','counts','opponentCounts'):
            merged[field]={**old.get(field,{}),**row.get(field,{})}
        games[row['gameId']]=merged
    write('history:'+name_key(player['name']),{'games':sorted(games.values(),key=lambda g:g['date']),'updatedAt':int(time.time()*1000)})
    write('profile:'+name_key(player['name']),profile)
    return profile


def context(player,opponent,starts_at=''):
    if not player or not opponent or len(player)>150 or len(opponent)>150:
        raise ValueError('Both player names required.')
    opponent=opponent.split(' 1st Set')[0].strip()
    match=None;league=None
    for tour in ('atp','wta'):
        payload=cached('upcoming:'+tour,'/tennis/v2/upcoming/matches/'+tour,21600)
        candidates=[item for item in payload.get('matches',[]) if
                    (same((item.get('player1') or {}).get('name'),player) and same((item.get('player2') or {}).get('name'),opponent)) or
                    (same((item.get('player2') or {}).get('name'),player) and same((item.get('player1') or {}).get('name'),opponent))]
        if candidates:
            def distance(item):
                try:return abs(datetime.fromisoformat(item['date'].replace('Z','+00:00')).timestamp()-datetime.fromisoformat(starts_at.replace('Z','+00:00')).timestamp())
                except (ValueError,AttributeError,KeyError):return 0
            match=min(candidates,key=distance)
            if starts_at and distance(match)>36*3600:
                match=None;continue
            league=tour;break
    if not match:
        return {'match':None,'players':[],'source':'Tennis API','message':'This matchup is not in the current provider schedule.'}
    players=[];errors=[]
    for index in (1,2):
        entry=match['player'+str(index)]
        try:profile=refresh_player(entry,league)
        except Exception:
            profile=read('profile:'+name_key(entry['name'])) or {'id':entry['id'],'name':entry['name']}
            errors.append('Detailed player data may be delayed by the free quota or provider availability.')
        profile=dict(profile,decimalOdds=entry.get('odd'))
        players.append(profile)
    if not same(players[0]['name'],player):
        players.reverse()
    odds=[]
    for profile in players:
        try:
            odd=float(profile['decimalOdds']);odds.append(1/odd if odd>1 else None)
        except (TypeError,ValueError,KeyError):odds.append(None)
    if all(value is not None for value in odds):
        for profile,value in zip(players,odds):profile['winProbability']=100*value/sum(odds)
    from tennis_history import history
    for profile in players:
        profile['games']=history(profile['name'])['games']
    h2h_games=[]
    try:
        first,second=(str(p['id']) for p in players)
        payload=cached(f'h2h:{league}:{first}:{second}',f'/tennis/v2/{league}/h2h/matches/{quote(first)}/{quote(second)}?includeAll=true&pageSize=500&include=round,tournament,tournament.court,stat',86400)
        h2h_games=[g for g in archive_rows(payload.get('data') or [],league) if str(g['playerId'])==first]
    except Exception:
        pass  # Existing player histories remain usable during quota/outages.
    return {'match':{'date':match.get('date'),'event':(match.get('tournament') or {}).get('name'),
                     'surface':match.get('court'),'roundId':match.get('roundId'),'round':ROUND_LABELS.get(match.get('roundId')),'bestOf':match.get('best_of'),
                     'h2h':match.get('h2hSummary')},'players':players,'h2hGames':h2h_games,'errors':list(set(errors)),
            'source':'Tennis API · moneyline-implied probabilities','updatedAt':int(time.time()*1000)}
