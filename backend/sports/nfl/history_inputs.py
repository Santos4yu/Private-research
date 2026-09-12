"""Explicit early-season statistical history on a consecutive season-week axis.

Source season/week stay intact in metadata. No future current-season rows,
postseason rows, or prior-team carry/target shares enter current-role estimates.
This is a new experimental input policy, not a validated model promotion.
"""
from copy import deepcopy
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from .services import nflverse

VERSION='NFL_EARLY_SEASON_INPUTS_V1'

def axis(rows, source_season, season, week, raw=False):
    if source_season not in (season,season-1):raise ValueError('Unsupported history season')
    output=[]
    for original in rows:
        game_type=original.get('season_type')
        if game_type and game_type!='REG':continue
        try: observed_week=int(original['week'])
        except (KeyError,TypeError,ValueError):continue
        if not 1<=observed_week<=18 or (source_season==season and observed_week>=week):continue
        if original.get('season') is not None and int(original['season'])!=source_season:raise ValueError('Mixed history source season')
        row=deepcopy(original)
        row['sourceSeason']=source_season;row['sourceWeek']=observed_week
        row['week']=str(observed_week-18 if source_season<season else observed_week) if raw else observed_week-18 if source_season<season else observed_week
        output.append(row)
    return output

def optional_weekly(season):
    try:return nflverse._source_rows(f'{nflverse.RELEASE}/stats_player/stats_player_week_{season}.csv')
    except (RuntimeError,ValueError,OSError):return [],datetime.now(timezone.utc),None

def compact_history(loader, season, week, fields):
    def optional(year):
        try:return loader(year)
        except (RuntimeError,ValueError,OSError,EOFError):return None
    with ThreadPoolExecutor(max_workers=2) as pool:
        current=pool.submit(optional,season);previous=pool.submit(optional,season-1) if week<=4 else None
        parts=[(season,current.result())]+([(season-1,previous.result())] if previous else [])
    present=[(year,part) for year,part in parts if part]
    if not present:return None
    result={**present[0][1]}
    for field in fields:result[field]=[row for year,part in present for row in axis(part.get(field,[]),year,season,week)]
    result['history']={'inputVersion':VERSION,'seasons':sorted(year for year,_ in present),'forecastSeason':season,
                       'usesPriorSeason':any(year<season for year,_ in present),
                       'condition':'Prior-team role shares excluded; historical role continuation is uncertain across offseason',
                       'sourceUrls':[part.get('sourceUrl') for _,part in present if part.get('sourceUrl')]}
    return result

def projection_history(season,week):
    from .projections.dataset import weekly_logs
    with ThreadPoolExecutor(max_workers=2) as pool:
        def optional(year):
            try:return weekly_logs(year)
            except (RuntimeError,ValueError,OSError):return None
        current=pool.submit(optional,season);prior=pool.submit(optional,season-1) if week<=4 else None
        parts=[(season,current.result())]+([(season-1,prior.result())] if prior else [])
    present=[(year,part) for year,part in parts if part]
    if not present:raise RuntimeError('No validated NFL weekly history')
    data={**present[0][1],'logs':[row for year,part in present for row in axis(part['logs'],year,season,week)]}
    data['history']={'inputVersion':VERSION,'seasons':sorted(year for year,_ in present),'usesPriorSeason':any(year<season for year,_ in present)}
    return data
