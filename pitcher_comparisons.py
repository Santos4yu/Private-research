"""Season pitching comparisons; no new serverless entry point."""
from concurrent.futures import ThreadPoolExecutor
from live_props_core import mlb, cached
from backend.vortextime import vortex_day


def normalize(stat):
    keys = {'era':'era','inningsPitched':'inningsPitched','wins':'wins','losses':'losses',
            'whip':'whip','kPer9':'strikeoutsPer9Inn','bbPer9':'walksPer9Inn',
            'hrPer9':'homeRunsPer9','avgAgainst':'avg','opsAgainst':'ops'}
    return {key:stat.get(source) for key,source in keys.items()}


def aggregate(rows):
    if not rows:
        return {}
    def total(key):
        values=[r.get(key) for r in rows]
        return sum(float(v) for v in values) if all(v is not None for v in values) else None
    outs=total('outs')
    def ratio(a,b,factor=1):
        return round(a/b*factor,3) if a is not None and b else None
    hits,walks,ab=total('hits'),total('baseOnBalls'),total('atBats')
    return {'wins':total('wins'),'losses':total('losses'),
            'inningsPitched':f'{int(outs)//3}.{int(outs)%3}' if outs is not None else None,
            'era':ratio(total('earnedRuns'),outs,27),'kPer9':ratio(total('strikeOuts'),outs,27),
            'bbPer9':ratio(walks,outs,27),'hrPer9':ratio(total('homeRuns'),outs,27),
            'whip':ratio(hits+walks if hits is not None and walks is not None else None,outs,3),
            'avgAgainst':ratio(hits,ab), 'opsAgainst':None}


def get_pitcher_comparisons(pitcher_id,opponent_id,season):
    def load():
        def fetch(kind,**extra):
            payload=mlb(f'/people/{pitcher_id}/stats',{'stats':kind,'group':'pitching','season':season,**extra})
            return [s for group in payload.get('stats',[]) for s in group.get('splits',[])]
        with ThreadPoolExecutor(max_workers=3) as pool:
            season_future=pool.submit(fetch,'season')
            hands_future=pool.submit(fetch,'statSplits',sitCodes='vl,vr')
            logs_future=pool.submit(fetch,'gameLog')
            season_rows=season_future.result()
            hands=hands_future.result()
            logs=logs_future.result()
        # Never aggregate live/current-day games into opponent comparisons.
        rows=[s['stat'] for s in logs if str(s.get('opponent',{}).get('id'))==str(opponent_id)
              and s.get('date','9999')<vortex_day()]
        result={'season':normalize(season_rows[0].get('stat',{})) if season_rows else {},'opponent':aggregate(rows)}
        for code,key in [('vl','left'),('vr','right')]:
            matches=[s for s in hands if s.get('split',{}).get('code')==code]
            result[key]=normalize(matches[0].get('stat',{})) if matches else {}
        return result
    return cached(('pitcher-comparison',pitcher_id,opponent_id,season,vortex_day()),300,load)
