"""Roster reconciliation and evidence-gated conditional absence scenarios."""
from copy import deepcopy
from .opportunity import reconcile, estimate

CAPACITIES={'expectedTargets':'expectedTeamPassAttempts','expectedCarries':'expectedRushAttempts','expectedPassAttempts':'expectedTeamPassAttempts'}


def allocate(profiles, volume):
    result=deepcopy(profiles)
    summary={}
    for metric,capacity in CAPACITIES.items():
        cap=volume.get(capacity,{}).get('mean')
        values={pid:p.get('metrics',{}).get(metric,{}).get('mean') for pid,p in result.items()}
        normalized=reconcile(values,cap)
        for pid,value in normalized.items():
            m=result[pid]['metrics'][metric]
            factor=value/m['mean'] if m['mean'] else 1
            m['mean']=value
            if m.get('standardDeviation') is not None:
                m['standardDeviation']*=factor
                m['variance']=m['standardDeviation']**2
            m['reconciled']=True
        summary[metric]={'capacity':cap,'assigned':sum(normalized.values()) if cap is not None else None,
                         'unassigned':max(0,cap-sum(normalized.values())) if cap is not None else None}
    return result,summary


def absence_scenario(profiles, out_ids, logs_by_player, team_rows, volume, week, verified_absences):
    """Redistribute only from ≥3 verified past absences, never from a missing stat row.

    verified_absences maps player IDs to game IDs from trusted OUT/participation evidence.
    Returns conditional outputs, with no scenario probabilities.
    """
    result=deepcopy(profiles)
    vacated={}
    for pid in out_ids:
        profile=result.get(pid)
        if profile:
            for metric,m in profile.get('metrics',{}).items():
                if m.get('mean') is not None:
                    vacated[metric]=vacated.get(metric,0)+m['mean']
                    m.update(mean=None,status='NOT_APPLICABLE',reason='Inactive in this conditional scenario')
    eligible_games=set.intersection(*(set(verified_absences.get(pid,[])) for pid in out_ids)) if out_ids else set()
    by_game={r['game_id']:r for r in team_rows if r['week']<week}
    eligible_games &= set(by_game)
    evidence=False
    if len(eligible_games)>=3:
        for pid,p in result.items():
            if pid in out_ids:
                continue
            for metric,field,denominator in [('expectedTargets','targets','attempts'),('expectedCarries','carries','carries')]:
                observations=[]
                for row in logs_by_player.get(pid,[]):
                    t=by_game.get(row['game_id'])
                    value=row['stats'].get(field)
                    base=t['stats'].get(denominator) if t else None
                    if row['game_id'] in eligible_games and value is not None and base and 0<=value<=base:
                        observations.append((row['week'],value/base))
                if len(observations)<3 or metric not in p.get('metrics',{}):
                    continue
                m=p['metrics'][metric]
                share=estimate(observations,week,m.get('share'))
                cap=volume[CAPACITIES[metric]].get('mean')
                if cap is not None and share['mean'] is not None:
                    sd=share.get('standardDeviation')
                    m.update(mean=cap*share['mean'],share=share['mean'],status='LOW_CONFIDENCE',absenceSample=len(observations),
                             standardDeviation=sd*cap if sd is not None else None,variance=sd**2*cap**2 if sd is not None else None)
                    evidence=True
    reconciled,allocation=allocate(result,volume)
    return {'status':'LOW_CONFIDENCE' if evidence else 'NOT_AVAILABLE','probability':None,
            'condition':{'inactivePlayerIds':sorted(out_ids)},'vacated':vacated,
            'players':reconciled if evidence else None,'allocation':allocation if evidence else None,
            'reason':None if evidence else 'Insufficient verified historical absence evidence; vacated volume is not reassigned'}
