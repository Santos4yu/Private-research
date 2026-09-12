"""Real NFL lines through the existing authorized Odds API transport.

Only regular O/U markets. DFS prices are indicative, never a payout/EV model.
"""
from datetime import datetime, timezone
import math
import os
import requests
import hashlib
from pathlib import Path
from dotenv import load_dotenv
from ..cache import cached_nfl, NFLCacheDomain
from ..identity import normalized_name, player_index
from . import nflverse

SPORT = 'americanfootball_nfl'
VERSION = 'NFL_ODDS_ADAPTER_V1'
MARKETS = {
    'player_pass_yds':'passing_yards','player_pass_attempts':'passing_attempts',
    'player_pass_completions':'pass_completions','player_pass_tds':'passing_touchdowns',
    'player_pass_interceptions':'interceptions','player_rush_yds':'rushing_yards',
    'player_rush_attempts':'rush_attempts','player_pass_rush_yds':'passing_rushing_yards',
    'player_reception_yds':'receiving_yards','player_receptions':'receptions',
    'player_reception_longest':'longest_reception','player_rush_reception_yds':'rushing_receiving_yards',
    'player_rush_reception_tds':'touchdowns',
}
BOOKS = 'prizepicks,underdog,draftkings,fanduel,betmgm'
_session = requests.Session()

def credentials():
    load_dotenv(Path(__file__).resolve().parents[4] / '.env.local', override=False)
    from v2.board.store import get_odds_api_key_candidates
    # Deployment-provided environment wins. The old MLB transport accepted an
    # exhausted stored key's 200 response and never tried the environment key.
    try: stored = get_odds_api_key_candidates()
    except requests.RequestException: stored = []
    values = [os.getenv(name,'') for name in ('NFL_ODDS_API_KEY','ODDS_API_KEY_V2','ODDS_API_KEY')]
    return list(dict.fromkeys(value for value in values+stored if value))

def _get(path, params):
    keys=credentials()
    if not keys:raise RuntimeError('NFL Odds API key not configured')
    exhausted=None
    for key in keys:
        try: response=_session.get('https://api.the-odds-api.com/v4'+path,params={**params,'apiKey':key},timeout=15)
        except requests.RequestException:continue
        if response.status_code in (401,429):continue
        if not response.ok:raise RuntimeError('NFL line provider returned an error')
        remaining=response.headers.get('x-requests-remaining')
        if path.endswith('/events') and str(remaining).isdigit() and int(remaining)<len(MARKETS):
            if exhausted is None or int(remaining)>int(exhausted.headers.get('x-requests-remaining','0')):exhausted=response
            continue
        return response
    if exhausted is not None:return exhausted
    raise RuntimeError('NFL line provider quota/key unavailable')

def timestamp(value):
    try:
        result=datetime.fromisoformat(str(value).replace('Z','+00:00'))
        return result if result.tzinfo else None
    except (ValueError,TypeError):return None

def finite(value):
    return isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value)

def events(season):
    response=_get(f'/sports/{SPORT}/events',{})
    raw=response.json()
    if not isinstance(raw,list):raise ValueError('NFL event schema invalid')
    teams=nflverse.teams(season).data or []
    by_name={normalized_name(team.name):team.id for team in teams}
    games=nflverse.schedule(season,season_type='REG').data or []
    if not teams or not games:raise RuntimeError('NFL team/schedule mapping source unavailable')
    now=datetime.now(timezone.utc)
    output=[];missing=0
    for event in raw:
        if not isinstance(event,dict):continue
        start=timestamp(event.get('commence_time'))
        home=by_name.get(normalized_name(event.get('home_team','')))
        away=by_name.get(normalized_name(event.get('away_team','')))
        if not start or start<=now or not home or not away or not event.get('id'):continue
        matches=[game for game in games if game.home_team.id==home and game.away_team.id==away and abs((game.starts_at-start).total_seconds())<=6*3600]
        if len(matches)!=1:missing+=1;continue
        game=matches[0]
        output.append({'eventId':event['id'],'gameId':game.id,'week':game.week,'homeTeamId':home,'awayTeamId':away,'startsAt':start.isoformat()})
    remaining=response.headers.get('x-requests-remaining')
    return {'status':'AVAILABLE','data':sorted(output,key=lambda event:event['startsAt']),
            'source':'the-odds-api','creditsRemaining':int(remaining) if str(remaining).isdigit() else None,
            'unresolvedEvents':missing,'fetchedAt':now.isoformat(),'adapterVersion':VERSION}

def normalize(payload, event, roster, now=None):
    now=now or datetime.now(timezone.utc)
    if not isinstance(payload,dict) or payload.get('id')!=event['eventId'] or not isinstance(payload.get('bookmakers'),list):
        raise ValueError('NFL line event/schema mismatch')
    if timestamp(payload.get('commence_time'))!=timestamp(event['startsAt']):raise ValueError('NFL line kickoff mismatch')
    rows=[];unresolved=0;seen=set();index=player_index(roster)
    for book in payload['bookmakers']:
        if not isinstance(book,dict) or book.get('key') not in BOOKS.split(','):continue
        markets=book.get('markets',[])
        if not isinstance(markets,list):continue
        for market in markets:
            if not isinstance(market,dict):continue
            prop=MARKETS.get(market.get('key'))
            if not prop:continue
            updated=timestamp(market.get('last_update') or book.get('last_update'))
            if not updated or updated>now:continue
            outcomes=market.get('outcomes',[])
            if not isinstance(outcomes,list):continue
            for outcome in outcomes:
                if not isinstance(outcome,dict) or not isinstance(outcome.get('description'),str):continue
                direction=outcome.get('name')
                value=outcome.get('point')
                if direction not in ('Over','Under') or not finite(value) or value<0:continue
                player=index.get('name:'+normalized_name(outcome['description']))
                if not player or player.team_id not in (event['homeTeamId'],event['awayTeamId']):unresolved+=1;continue
                from ..props import props_for_position
                if prop not in [p.key.value for p in props_for_position(player.position)]:continue
                key=(player.id,prop,book.get('key'),value,direction)
                if key in seen:continue
                seen.add(key)
                line={'value':value,'platform':book.get('title') or book.get('key'),'bookmaker':book.get('key'),
                      'playerId':player.id,'gameId':event['gameId'],'propType':prop,'direction':direction.upper(),
                      'source':'the-odds-api','updatedAt':updated.isoformat(),'verified':True,
                      'price':outcome.get('price') if finite(outcome.get('price')) else None,
                      'ageSeconds':max(0,(now-updated).total_seconds()),'stale':(now-updated).total_seconds()>120}
                rows.append({'playerId':player.id,'playerName':player.name,'position':player.position.value,'teamId':player.team_id,
                             'opponentId':event['awayTeamId'] if player.team_id==event['homeTeamId'] else event['homeTeamId'],
                             'gameId':event['gameId'],'week':event['week'],'propType':prop,'direction':direction.upper(),'line':line})
    return {'status':'AVAILABLE','data':rows,'source':'the-odds-api','fetchedAt':now.isoformat(),
            'unresolvedPlayers':unresolved,'adapterVersion':VERSION}

def lines(season, player_id=None, week=None, event_id=None):
    listing=events(season)
    player=next((player for player in nflverse.players(season).data or [] if player.id==player_id),None) if player_id else None
    if player_id and not player:raise ValueError('Unresolved NFL player')
    candidates=[event for event in listing['data'] if (not event_id or event['eventId']==event_id) and (not week or event['week']==week)
                and (not player or player.team_id in (event['homeTeamId'],event['awayTeamId']))]
    if not candidates:return {'status':'NOT_AVAILABLE','data':[],'reason':'No verified upcoming NFL event mapping.','source':'the-odds-api'}
    event=candidates[0]
    def load():
        if listing['creditsRemaining'] is not None and listing['creditsRemaining']<len(MARKETS):return {'status':'NOT_AVAILABLE','data':[],'reason':'Selected Odds API connection has insufficient credits for the NFL markets. Update the key or restore credits in Settings.','source':'the-odds-api'}
        response=_get(f"/sports/{SPORT}/events/{event['eventId']}/odds",{'markets':','.join(MARKETS),'bookmakers':BOOKS,'oddsFormat':'american'})
        return normalize(response.json(),event,nflverse.players(season).data or [])
    key_id=hashlib.sha256('|'.join(credentials()).encode()).hexdigest()[:16]
    result=cached_nfl(NFLCacheDomain.PROPS,(VERSION,season,event['eventId'],key_id),load)
    if player:return {**result,'data':[row for row in result['data'] if row['playerId']==player.id]}
    return result
