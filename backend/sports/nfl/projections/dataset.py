"""Real weekly box scores with explicit missing fields, season and source."""
from ..services.nflverse import _source_rows,_number,RELEASE,PLAYER_STAT_FIELDS,NONNEGATIVE_PLAYER_FIELDS,canonical_team,ProviderError
from ..cache import cached_nfl,NFLCacheDomain

def weekly_logs(season):
    def load():
        url=f'{RELEASE}/stats_player/stats_player_week_{season}.csv'
        rows,fetched,observed=_source_rows(url)
        required={'player_id','position','game_id','week','season','season_type','team',*PLAYER_STAT_FIELDS}
        if not rows or not required.issubset(rows[0]):
            raise ProviderError('Projection box-score schema incomplete')
        logs=[];seen=set()
        for row in rows:
            if row.get('season_type')!='REG' or row.get('position') not in ('QB','RB','WR','TE'):
                continue
            if _number(row,'season')!=season:
                raise ProviderError('Mixed season in projection dataset')
            week=_number(row,'week');team=canonical_team(row.get('team'))
            pid,gid=row.get('player_id'),row.get('game_id')
            if not pid or not gid or not team or week is None or not 1<=week<=18 or int(week)!=week:
                raise ProviderError('Projection log identity invalid')
            key=(pid,gid)
            if key in seen:raise ProviderError('Duplicate player/game projection log')
            stats={field:_number(row,field) for field in PLAYER_STAT_FIELDS}
            # Air yards (and their share) can legitimately be negative on screens.
            if any(stats[k] is not None and stats[k]<0 for k in NONNEGATIVE_PLAYER_FIELDS-{'air_yards_share'}):
                raise ProviderError('Invalid nonnegative box-score metric')
            for n,d in (('completions','attempts'),('receptions','targets')):
                if stats[n] is not None and stats[d] is not None and stats[n]>stats[d]:
                    raise ProviderError('Box-score efficiency counts incoherent')
            seen.add(key)
            logs.append({'id':pid,'position':row['position'],'team_id':team,'game_id':gid,'week':int(week),'season':season,'stats':stats})
        return {'logs':logs,'source':'nflverse','sourceUrl':url,'fetchedAt':fetched.isoformat(),'observedAt':observed.isoformat() if observed else None,'version':'projection-box-v1'}
    return cached_nfl(NFLCacheDomain.PROJECTIONS,('projection-box-v1',season),load)
