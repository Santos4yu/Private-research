"""Separate Phase 5 aggregates. Phase 4 play counting is not modified."""
import csv
import gzip
import io
import json
import tempfile
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from .nflverse import RELEASE, ProviderError, canonical_team
from .play_by_play import number
from ..cache import NFLCacheDomain, cached_nfl

VERSION='nfl-matchup-pbp-v2'
REQUIRED={'game_id','week','posteam','defteam','season_type','play_type','play_deleted','two_point_attempt',
          'qb_dropback','qb_scramble','qb_kneel','qb_spike','sack','pass_attempt','rush_attempt',
          'epa','success','cpoe','complete_pass','yards_gained','air_yards','yards_after_catch',
          'passer_player_id','receiver_player_id','rusher_player_id','run_location'}


def add(metrics,key,value):
    if value is None:
        return
    m=metrics.setdefault(key,{'sum':0.,'n':0})
    m['sum']+=value; m['n']+=1


def aggregate(records):
    games={}; players={}; connections={}
    for r in records:
        if r.get('season_type')!='REG' or number(r,'play_deleted')==1 or number(r,'two_point_attempt')==1 or r.get('play_type') not in ('pass','run') or number(r,'qb_kneel')==1 or number(r,'qb_spike')==1:
            continue
        team,defense=canonical_team(r.get('posteam')),canonical_team(r.get('defteam'))
        w=number(r,'week')
        if not team or not defense or w is None or not r.get('game_id'):
            raise ProviderError('Invalid PBP matchup identity')
        flags={k:number(r,k) for k in ('qb_dropback','qb_scramble','sack','pass_attempt','rush_attempt','complete_pass')}
        if any(v not in (0,1) for v in flags.values()):
            raise ProviderError('Missing required matchup indicator')
        drop,scramble,sack=flags['qb_dropback'],flags['qb_scramble'],flags['sack']
        attempt=flags['pass_attempt']*(1-sack)
        rush=flags['rush_attempt']
        key=(r['game_id'],team)
        g=games.setdefault(key,{'game_id':r['game_id'],'week':int(w),'team_id':team,'opponent_team_id':defense,'game_date':r.get('game_date'),'metrics':{},'directions':{},'depths':{}})
        m=g['metrics']
        epa,success,yards,cpoe,air,yac=[number(r,k) for k in ('epa','success','yards_gained','cpoe','air_yards','yards_after_catch')]
        if drop:
            add(m,'pass_epa',epa); add(m,'pass_success',success); add(m,'sack_rate',sack); add(m,'scramble_rate',scramble)
        if attempt:
            add(m,'completion_rate',flags['complete_pass']); add(m,'cpoe',cpoe); add(m,'ypa',yards)
            add(m,'pass_explosive',float(yards>=20) if yards is not None else None)
            add(m,'adot',air)
            if air is not None:
                depth='DEEP' if air>=20 else 'INTERMEDIATE' if air>=10 else 'SHORT'
                dm=g['depths'].setdefault(depth,{})
                add(dm,'completion_rate',flags['complete_pass']); add(dm,'ypa',yards)
        if attempt and flags['complete_pass']:
            add(m,'yac_per_reception',yac)
            add(m,'yards_per_reception',yards)
        if rush and not scramble:
            add(m,'run_epa',epa); add(m,'run_success',success); add(m,'ypc',yards)
            add(m,'run_explosive',float(yards>=10) if yards is not None else None)
            add(m,'stuff_rate',float(yards<=0) if yards is not None else None)
            direction=r.get('run_location')
            if direction in ('left','middle','right'):
                dm=g['directions'].setdefault(direction,{})
                add(dm,'run_epa',epa); add(dm,'ypc',yards);add(dm,'run_success',success)
        pid=r.get('receiver_player_id') if attempt else r.get('rusher_player_id') if rush else None
        if pid:
            p=players.setdefault((r['game_id'],pid),{'game_id':r['game_id'],'week':int(w),'team_id':team,'player_id':pid,'metrics':{},'directions':{}})
            pm=p['metrics']
            if attempt:
                add(pm,'yards_per_target',yards);add(pm,'catch_rate',flags['complete_pass']);add(pm,'adot',air)
                add(pm,'deep_target_rate',float(air>=20) if air is not None else None)
                add(pm,'receiving_explosive',float(yards>=20) if yards is not None else None)
                if air is not None:
                    depth='DEEP' if air>=20 else 'INTERMEDIATE' if air>=10 else 'SHORT'
                    add(pm,'depth_'+depth,1.)
                if flags['complete_pass']:
                    add(pm,'yac_per_reception',yac)
                    add(pm,'yards_per_reception',yards)
                qb=r.get('passer_player_id')
                if qb:
                    c=connections.setdefault((r['game_id'],qb,pid),{'game_id':r['game_id'],'week':int(w),'team_id':team,'qb_id':qb,'receiver_id':pid,'metrics':{}})
                    add(c['metrics'],'catch_rate',flags['complete_pass']);add(c['metrics'],'yards_per_target',yards);add(c['metrics'],'adot',air)
            elif rush:
                add(pm,'ypc',yards); add(pm,'run_explosive',float(yards>=10) if yards is not None else None)
                direction=r.get('run_location')
                if direction in ('left','middle','right'):
                    dm=p['directions'].setdefault(direction,{})
                    add(dm,'ypc',yards);add(dm,'run_success',success)
        qb=r.get('passer_player_id') or (r.get('rusher_player_id') if scramble else None)
        if qb and drop:
            p=players.setdefault((r['game_id'],qb),{'game_id':r['game_id'],'week':int(w),'team_id':team,'player_id':qb,'metrics':{},'directions':{}})
            add(p['metrics'],'pass_epa',epa);add(p['metrics'],'sack_rate',sack);add(p['metrics'],'scramble_rate',scramble)
    if not games:
        raise ProviderError('No valid matchup records')
    return {'games':list(games.values()),'players':list(players.values()),'connections':list(connections.values())}


def season_data(season):
    def load():
        path=Path(tempfile.gettempdir())/f'krazy-data-{VERSION}-{season}.json'
        if path.exists() and time.time()-path.stat().st_mtime<1800:
            try:
                return json.loads(path.read_text(encoding='utf-8'))
            except (ValueError,OSError):
                pass
        url=f'{RELEASE}/pbp/play_by_play_{season}.csv.gz'
        with urlopen(Request(url,headers={'User-Agent':'KrazyData-NFL-research/1.0'}),timeout=30) as response:
            reader=csv.DictReader(io.TextIOWrapper(gzip.GzipFile(fileobj=response),encoding='utf-8-sig'))
            if not REQUIRED.issubset(reader.fieldnames or []):
                raise ProviderError('Matchup PBP schema missing required columns')
            result=aggregate(reader)
            result.update(source='nflverse',sourceUrl=url,fetchedAt=datetime.now(timezone.utc).isoformat(),observedAt=response.headers.get('Last-Modified'),version=VERSION)
        try:
            with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',dir=path.parent,delete=False,suffix='.json') as file:
                json.dump(result,file);temporary=Path(file.name)
            temporary.replace(path)
        except OSError:
            pass
        return result
    return cached_nfl(NFLCacheDomain.DEFENSE,(VERSION,season),load)
