"""Real-line historical research shortlist, independent of production verdicts."""
from datetime import datetime, timezone
from math import sqrt, isfinite
from dataclasses import asdict
from .services import nflverse, odds
from .services.matchup_data import season_data
from .history_inputs import compact_history
from .matchup_volume_context import opponent_volume
from .cache import cached_nfl, NFLCacheDomain

VERSION='NFL_RESEARCH_BOARD_V2'
FIELDS={'passing_yards':('passing_yards',),'passing_attempts':('attempts',),'pass_completions':('completions',),'passing_touchdowns':('passing_tds',),'interceptions':('passing_interceptions',),'rushing_yards':('rushing_yards',),'rush_attempts':('carries',),'receiving_yards':('receiving_yards',),'receptions':('receptions',),'targets':('targets',),'passing_rushing_yards':('passing_yards','rushing_yards'),'rushing_receiving_yards':('rushing_yards','receiving_yards'),'touchdowns':('rushing_tds','receiving_tds')}

def finite(value):
    return isinstance(value,(float,int)) and not isinstance(value,bool) and isfinite(value)

def support(hits,n):
    # Wilson lower bound (95% interval), not a predicted hit probability.
    if not n:return 0
    z=1.96;p=hits/n
    return (p+z*z/(2*n)-z*sqrt(p*(1-p)/n+z*z/(4*n*n)))/(1+z*z/n)

def window_stats(values,line,direction):
    # Same hit/miss/push accounting as the main screen, over whatever slice
    # of values is passed in. No probability, no fabricated confidence.
    if not values:return {'hits':0,'misses':0,'pushes':0,'decisions':0,'hitRate':None,'sample':0,'average':None}
    pushes=values.count(line);hits=sum(v>line if direction=='OVER' else v<line for v in values);decisions=len(values)-pushes
    return {'hits':hits,'misses':decisions-hits,'pushes':pushes,'decisions':decisions,'hitRate':hits/decisions*100 if decisions else None,'sample':len(values),'average':sum(values)/len(values)}

def screen(offers,histories,event,now=None):
    now=now or datetime.now(timezone.utc);rows=[]
    start=odds.timestamp(event.get('startsAt'))
    if not start or start<=now:return rows
    for offer in offers:
        line=offer.get('line',{});fields=FIELDS.get(offer.get('propType'))
        stamp=odds.timestamp(line.get('updatedAt'))
        if not fields or not stamp or not 0<=(now-stamp).total_seconds()<=120:continue
        if not line.get('verified') or line.get('bookmaker')!='prizepicks' or line.get('category')!='STANDARD' or not finite(line.get('value')):continue
        if offer.get('gameId')!=event['gameId'] or line.get('playerId')!=offer.get('playerId') or line.get('propType')!=offer.get('propType') or line.get('gameId')!=event['gameId']:continue
        direction=line.get('direction')
        if direction not in ('OVER','UNDER'):continue
        eligible=sorted([g for g in histories.get(offer['playerId'],[]) if g.season_type=='REG' and g.player_id==offer['playerId'] and g.team_id==offer['teamId'] and g.game_id!=event['gameId'] and (int(event['gameId'][:4])-1<=g.season<int(event['gameId'][:4]) or (g.season==int(event['gameId'][:4]) and g.week<event['week']))],key=lambda g:(g.season,g.week))
        eligible=list({g.game_id:g for g in eligible if all(finite(g.stats.get(f)) for f in fields)}.values())
        logs=eligible[-20:]
        values=[sum(g.stats[f] for f in fields) for g in logs]
        if len(values)<8:continue
        recent=values[-10:];hits=sum(v>line['value'] if direction=='OVER' else v<line['value'] for v in values);pushes=values.count(line['value']);n=len(values)-pushes
        rh=sum(v>line['value'] if direction=='OVER' else v<line['value'] for v in recent);rn=len(recent)-recent.count(line['value'])
        if n<8 or rn<5:continue
        # A same-window comparison strip (like the single-player Trends tab
        # already has) so the board can show L5/L10/L15/L20/H2H side by side
        # instead of forcing a click into every prop to compare windows.
        h2h_opponent=offer.get('opponentId')
        h2h_values=[sum(g.stats[f] for f in fields) for g in eligible if h2h_opponent and g.opponent_team_id==h2h_opponent]
        windows={f'l{n}':window_stats(values[-n:],line['value'],direction) for n in (5,10,15,20)}
        windows['h2h']=window_stats(h2h_values,line['value'],direction)
        rows.append({**offer,'startsAt':event['startsAt'],'support':support(hits,n),'hits':hits,'sample':len(values),'decisions':n,'pushes':pushes,'hitRate':hits/n*100,'recentHits':rh,'recentSample':len(recent),'recentDecisions':rn,'average':sum(values)/len(values),'windows':windows,'seasons':sorted({g.season for g in logs}), 'historyOnly':all(g.season<int(event['gameId'][:4]) for g in logs),'screenVersion':VERSION})
    # One preferred posted direction per player/prop, no duplicate sides.
    ranked=sorted(rows,key=lambda r:(r['support'],r['recentHits']/r['recentDecisions'],r['sample']),reverse=True)
    seen=set();result=[]
    for row in ranked:
        key=(row['playerId'],row['propType'])
        if key not in seen:seen.add(key);result.append(row)
    return result

def attach_opponent_volume(rows,season,week,roster):
    # Best-effort context, not a ranking input: opponent-volume percentile is
    # only defined for a few volume props, and never blocks a row from
    # appearing if the shared dataset or a given player/prop isn't covered.
    if not rows:return rows
    try:
        data=compact_history(season_data,season,week,('games','players','connections')) if week<=4 else season_data(season)
    except Exception:
        data=None
    if not data:return rows
    quarterback_ids={pid for pid,p in roster.items() if p.position=='QB'}
    enriched=[]
    for row in rows:
        player=roster.get(row['playerId'])
        context=opponent_volume(data,asdict(player),row.get('opponentId'),row['propType'],week,quarterback_ids) if player and row.get('opponentId') else None
        enriched.append({**row,'opponentVolume':context} if context else row)
    return enriched

def game_board(season,event_id):
    def load():
        listing=odds.events(season)
        event=next((e for e in listing['data'] if e['eventId']==event_id),None)
        if not event:raise ValueError('Upcoming NFL event required')
        offers=odds.research_lines(season,event)
        roster={p.id:p for p in nflverse.players(season).data or []}
        offers={**offers,'data':[r for r in offers.get('data',[]) if r['playerId'] in roster and str(roster[r['playerId']].status).upper() in ('ACT','ACTIVE')]}
        injuries=nflverse.injuries(season,event['week'])
        uncertain={i.player_id for i in injuries.data or [] if str(i.game_status or '').upper() in ('OUT','DOUBTFUL','QUESTIONABLE')}
        offers={**offers,'data':[r for r in offers['data'] if r['playerId'] not in uncertain]}
        ids={r['playerId'] for r in offers.get('data',[]) if r['line'].get('bookmaker')=='prizepicks'}
        histories={};failed=0
        for pid in ids:
            current=nflverse.game_logs(season,pid)
            older=nflverse.game_logs(season-1,pid)
            histories[pid]=list(older.data or [])+list(current.data or [])
            failed+=int(current.data is None or older.data is None)
        rows=attach_opponent_volume(screen(offers.get('data',[]),histories,event),season,event['week'],roster)
        return {'data':rows,'event':event,'source':'the-odds-api + nflverse','historyFailures':failed,'injuryReportAvailable':injuries.data is not None,'fetchedAt':datetime.now(timezone.utc).isoformat(),'method':'Ranked by sample-adjusted historical support, not betting confidence. Current-team games only; regular posted lines only.'}
    result=cached_nfl(NFLCacheDomain.PROPS,(VERSION,season,event_id),load)
    now=datetime.now(timezone.utc)
    return {**result,'data':[r for r in result['data'] if odds.timestamp(r['startsAt'])>now and 0<=(now-odds.timestamp(r['line']['updatedAt'])).total_seconds()<=120]}
