"""Evidence-only volume baseline. No prop probabilities or betting verdicts.

Validated PBP supplies dropbacks; weekly-only fallback keeps them unavailable.
All inputs must be same-season games preceding the forecast week.
"""
from math import exp, isfinite, sqrt
from statistics import median


def estimate(observations, week, prior=None, decay=8, prior_strength=4):
    rows = [(w, v) for w, v in observations if w < week and isinstance(v, (int, float)) and isfinite(v) and v >= 0]
    if not rows:
        return {"status": "NOT_AVAILABLE", "mean": None, "reason": "No prior same-season observations", "sample": 0}
    weights = [exp(-(week - w) / decay) for w, _ in rows]
    total = sum(weights)
    mean = sum(v * a for (_, v), a in zip(rows, weights)) / total
    effective = total ** 2 / sum(a * a for a in weights)
    if prior is not None:
        mean = (effective * mean + prior_strength * prior) / (effective + prior_strength)
    variance = sum(a * (v - mean) ** 2 for (_, v), a in zip(rows, weights)) / total
    return {"status": "AVAILABLE" if effective >= 4 else "LOW_CONFIDENCE", "mean": mean, "median": median(v for _,v in rows),
            "standardDeviation": sqrt(variance) if len(rows) > 1 else None,
            "variance": variance if len(rows) > 1 else None,
            "sample": len(rows), "effectiveSample": effective,
            "reliability": "HIGH" if effective >= 8 else "MEDIUM" if effective >= 4 else "LOW"}


def reconcile(values, capacity):
    """Scale excess only; preserve unassigned volume instead of filling it."""
    if capacity is None:
        return {}
    if not isfinite(capacity) or capacity<0:
        raise ValueError('Invalid opportunity capacity')
    valid = {key: value for key, value in values.items() if value is not None and isfinite(value) and value >= 0}
    factor = min(1, capacity / sum(valid.values())) if sum(valid.values()) else 1
    return {key: value * factor for key, value in valid.items()}


def team_volume(rows, opponent_rows, week):
    rows=[r for r in rows if r['week']<week]
    opponent_rows=[r for r in opponent_rows if r['week']<week]
    output = {}
    for name, field in [('expectedPlays', 'offensive_plays'), ('expectedPassPlays', 'pass_plays'),
                        ('expectedTeamPassAttempts', 'attempts'), ('expectedRushAttempts', 'carries'),
                        ('expectedDropbacks', 'dropbacks'), ('expectedCalledRushAttempts', 'called_rushes'),
                        ('expectedScrambles', 'scrambles'), ('expectedSpikes', 'spikes'), ('expectedDrives', 'drives')]:
        own = estimate([(r['week'], r['stats'].get(field)) for r in rows], week)
        allowed = estimate([(r['week'], r['stats'].get(field)) for r in opponent_rows], week)
        if own['mean'] is not None and allowed['mean'] is not None:
            own_mean=own['mean']
            own['mean'] = (own['mean'] + allowed['mean']) / 2
            own['status'] = 'LOW_CONFIDENCE' if 'LOW_CONFIDENCE' in (own['status'], allowed['status']) else 'AVAILABLE'
            own['teamSample']=own['sample']; own['opponentSample']=allowed['sample']
            if own.get('standardDeviation') is not None and allowed.get('standardDeviation') is not None:
                own['standardDeviation']=sqrt((own['variance']+allowed['variance'])/2+(own_mean-allowed['mean'])**2/4)
                own['variance']=own['standardDeviation']**2
            levels={'LOW':0,'MEDIUM':1,'HIGH':2}
            own['reliability']=min((own['reliability'],allowed['reliability']),key=levels.get)
        elif own['mean'] is not None:
            own['status']='LOW_CONFIDENCE'
            own['opponentSample']=0
        output[name] = own
    plays, passes, rushes = [output[k]['mean'] for k in ('expectedPlays', 'expectedPassPlays', 'expectedRushAttempts')]
    if all(v is not None for v in (plays, passes, rushes)) and passes + rushes:
        factor = plays / (passes + rushes)
        output['expectedPassPlays']['mean'] *= factor
        output['expectedRushAttempts']['mean'] *= factor
        attempts = output['expectedTeamPassAttempts']['mean']
        if attempts is not None:
            output['expectedTeamPassAttempts']['mean'] = min(attempts, output['expectedPassPlays']['mean'])
    script = script_profile(rows, opponent_rows, week)
    output['gameScript'] = script
    drop = output['expectedDropbacks']
    called = output['expectedCalledRushAttempts']
    spikes = output['expectedSpikes']
    if plays is not None and drop['mean'] is not None and called['mean'] is not None and spikes['mean'] is not None:
        spike_mean = spikes['mean']
        if script['status'] == 'AVAILABLE':
            rate = sum(s['weight'] * s['passRate'] for s in script['states'].values())
            drop['mean'] = max(0, plays - spike_mean) * rate
            called['mean'] = max(0, plays - spike_mean - drop['mean'])
        else:
            factor = max(0, plays-spike_mean)/(drop['mean']+called['mean']) if drop['mean']+called['mean'] else 1
            drop['mean'] *= factor
            called['mean'] *= factor
        scramble_rows = [(r['week'],r['stats']['scrambles']/r['stats']['dropbacks']) for r in rows if r['stats'].get('dropbacks',0)>0 and r['stats'].get('scrambles') is not None]
        scramble_rate = estimate(scramble_rows,week)
        sack_rows = [(r['week'],r['stats']['sacks_suffered']/r['stats']['dropbacks']) for r in rows if r['stats'].get('dropbacks',0)>0 and r['stats'].get('sacks_suffered') is not None]
        sack_rate = estimate(sack_rows,week)
        if scramble_rate['mean'] is not None and sack_rate['mean'] is not None:
            scramble = drop['mean']*scramble_rate['mean']
            output['expectedScrambles']['mean'] = scramble
            output['expectedRushAttempts']['mean'] = called['mean'] + scramble
            output['expectedTeamPassAttempts']['mean'] = min(drop['mean'],max(0,drop['mean']*(1-scramble_rate['mean']-sack_rate['mean'])+spike_mean))
    drives = output['expectedDrives']['mean']
    output['expectedPlaysPerDrive'] = {'status': output['expectedDrives']['status'], 'mean': plays/drives if plays is not None and drives else None}
    output['expectedPossessions'] = {**output['expectedDrives'], 'definition': 'Offensive drives containing a counted offensive play; excludes empty/end-half possessions'}
    output['dataCoverage'] = round(100*sum(output[k]['mean'] is not None for k in ('expectedPlays','expectedDropbacks','expectedRushAttempts','expectedDrives'))/4)
    output['volumeCertainty'] = 'HIGH' if all(output[k].get('reliability')=='HIGH' for k in ('expectedPlays','expectedDropbacks','expectedRushAttempts')) else 'MEDIUM' if output['expectedDropbacks']['status']=='AVAILABLE' else 'LOW'
    output['accounting'] = 'Dropbacks + called rushes + spikes = plays. Official rush attempts include scrambles already in dropbacks.'
    output['sampleFlags']=[{'gameId':r['game_id'],'flags':r['flags']} for r in rows if r['week']<week and r.get('flags')]
    return output


def script_profile(rows, opponent_rows, week):
    history = [r for r in rows if r['week']<week and r.get('states')]
    if len(history)<4:
        return {'status':'NOT_AVAILABLE','reason':'At least four earlier games with score-state data required','states':{}}
    totals = {}
    for state in ('LEADING','CLOSE','TRAILING'):
        counts, drops, pace, weight = 0,0,0,0
        for r in history:
            s=r['states'].get(state)
            if not s:
                continue
            a=exp(-(week-r['week'])/8)
            counts+=s['plays']*a; drops+=s['dropbacks']*a
            if s.get('secondsPerPlay') is not None:
                pace+=a*s['secondsPerPlay']; weight+=a
        totals[state]={'plays':counts,'passRate':drops/counts if counts else None,'secondsPerPlay':pace/weight if weight else None}
    total=sum(s['plays'] for s in totals.values())
    if not total or any(s['plays']<30 for s in totals.values()):
        return {'status':'LOW_CONFIDENCE','reason':'Weak score-state sample; forecast uses overall tendencies','states':{}}
    for s in totals.values():
        s['weight']=s['plays']/total
        s['rushRate']=1-s['passRate']
    return {'status':'AVAILABLE','states':totals,'sample':len(history),'method':'Empirical prior-game score-state exposure; not calibrated game-script probabilities'}


def player_opportunity(player, logs, team_rows, volume, week, injury_status=None, usage=None, role_events=None):
    if not player.get('id') or not player.get('team_id'):
        return {'status': 'NOT_AVAILABLE', 'reason': 'Unresolved identity or team', 'metrics': {}}
    if injury_status in ('OUT', 'IR', 'DOUBTFUL', 'QUESTIONABLE'):
        return {'status': 'NOT_AVAILABLE', 'roleStatus': 'UNCERTAIN', 'reason': 'Injury scenario unresolved; no scenario probabilities assigned', 'metrics': {}}
    by_game = {r['game_id']: r for r in team_rows if r['week'] < week}
    events=[e for e in role_events or [] if e.get('verified') and e.get('week',week+1)<=week]
    event=max(events,key=lambda e:e['week']) if events else None
    role, metrics = [], {}
    fields = [('expectedTargets', 'targets', 'attempts', 'expectedTeamPassAttempts')] if player['position'] in ('WR', 'TE', 'RB') else []
    if player['position'] in ('RB', 'QB'):
        fields.append(('expectedCarries', 'carries', 'carries', 'expectedRushAttempts'))
    if player['position'] == 'QB':
        fields.append(('expectedPassAttempts', 'attempts', 'attempts', 'expectedTeamPassAttempts'))
    for name, numerator, denominator, team_metric in fields:
        shares = []
        for row in logs:
            if row['week'] >= week:
                continue
            team = by_game.get(row['game_id'])
            value = row['stats'].get(numerator)
            base = team['stats'].get(denominator) if team else None
            if row.get('team_id') == player['team_id'] and value is not None and base is not None and base > 0 and 0 <= value <= base:
                shares.append((row['week'], value / base))
        shares.sort()
        prior = sum(v for _, v in shares) / len(shares) if shares else None
        status = 'STABLE'
        if event:
            shares=[r for r in shares if r[0]>=event['week']]
            status=event.get('direction','UNCERTAIN')
        elif len(shares) >= 5:
            earlier = sum(v for _, v in shares[:-2]) / len(shares[:-2])
            recent = sum(v for _, v in shares[-2:]) / 2
            if abs(recent - earlier) >= .15:
                status = 'INCREASING' if recent > earlier else 'DECREASING'
                shares = shares[-2:]
        share = estimate(shares, week, prior, decay=3 if status!='STABLE' else 8, prior_strength=1 if status!='STABLE' else 4)
        base = volume.get(team_metric,{}).get('mean')
        mean = share['mean'] * base if share['mean'] is not None and base is not None else None
        metrics[name] = {**share, 'mean': mean, 'share': share['mean'],
                         'standardDeviation': share.get('standardDeviation') * base if share.get('standardDeviation') is not None and base is not None else None}
        # Product uncertainty from role and team volume, assuming independence.
        team_sd=volume.get(team_metric,{}).get('standardDeviation')
        role_sd=share.get('standardDeviation')
        if mean is not None and team_sd is not None and role_sd is not None:
            metrics[name]['standardDeviation']=sqrt(base**2*role_sd**2+share['mean']**2*team_sd**2+team_sd**2*role_sd**2)
        if volume.get(team_metric,{}).get('status')!='AVAILABLE' and mean is not None:
            metrics[name]['status']='LOW_CONFIDENCE'
        metrics[name]['median'] = None
        metrics[name]['variance'] = metrics[name]['standardDeviation']**2 if metrics[name]['standardDeviation'] is not None else None
        role.append(status if status!='STABLE' and shares else 'STABLE' if len(shares)>=4 else 'UNCERTAIN')
        metrics[name]['roleChange'] = status if status!='STABLE' else None
    unavailable = ['expectedRoutes', 'expectedSnaps'] if player['position'] in ('WR', 'TE', 'RB') else ['expectedDesignedRushes', 'expectedScrambles', 'expectedKneels']
    for key in unavailable:
        metrics[key] = {'status': 'NOT_AVAILABLE', 'mean': None, 'reason': 'Required usage classification unavailable'}
    if usage:
        snap_shares=[]
        for row in usage:
            team=by_game.get(row['game_id'])
            count=row.get('offense_snaps')
            base=team['stats'].get('offensive_plays') if team else None
            if base and count is not None and 0<=count<=base and row.get('team_id')==player['team_id']:
                snap_shares.append((row['week'],count/base))
        share=estimate(snap_shares,week)
        if len(snap_shares)>=5:
            snap_shares.sort()
            earlier=sum(v for _,v in snap_shares[:-2])/len(snap_shares[:-2])
            recent=sum(v for _,v in snap_shares[-2:])/2
            if abs(recent-earlier)>=.15:
                role.append('INCREASING' if recent>earlier else 'DECREASING')
                share=estimate(snap_shares[-2:],week,earlier,decay=3,prior_strength=1)
        base=volume.get('expectedPlays',{}).get('mean')
        metrics['expectedSnaps']={**share,'mean':share['mean']*base if share['mean'] is not None and base is not None else None, 'share':share['mean'], 'median':None,
                                 'standardDeviation':None,'variance':None}
    if player['position']=='QB':
        for key,field,denominator,base_key in [('expectedScrambles','scrambles','dropbacks','expectedDropbacks'),
                                              ('expectedDesignedRushes','non_scramble_rushes','called_rushes','expectedCalledRushAttempts'),
                                              ('expectedKneels','kneels','called_rushes','expectedCalledRushAttempts')]:
            shares=[]
            for row in logs:
                team=by_game.get(row['game_id'])
                value=row['stats'].get(field)
                base=team['stats'].get(denominator) if team else None
                if row['week']<week and row.get('team_id')==player['team_id'] and value is not None and base and 0<=value<=base:
                    shares.append((row['week'],value/base))
            share=estimate(shares,week)
            base=volume.get(base_key,{}).get('mean')
            metrics[key]={**share,'mean':share['mean']*base if share['mean'] is not None and base is not None else None,'median':None,'share':share['mean']}
            if key=='expectedDesignedRushes':
                metrics[key]['definition']='Observed non-scramble, non-kneel rush opportunities; aborted plays may remain, not charted play design'
        # A backup's historical output must not masquerade as a starting-QB projection.
        attempts=metrics.get('expectedPassAttempts',{})
        if attempts.get('share') is not None and attempts['share']<.5:
            attempts.update(mean=None,status='NOT_AVAILABLE',reason='Starting role unsupported by observed attempt share')
        expected_drop=volume.get('expectedDropbacks',{}).get('mean')
        if expected_drop is not None and attempts.get('mean') is not None:
            attempts['mean']=min(attempts['mean'],expected_drop)
    if player['position']=='RB':
        metrics['expectedTouches']={'status':'NOT_AVAILABLE','mean':None,'reason':'Touches require receptions; targets are not catches. Receptions model deferred.'}
    observed_weeks=[r['week'] for r in logs if r['week']<week and r.get('team_id')==player['team_id'] and any(r['stats'].get(k) is not None for k in ('targets','carries','attempts'))]
    observed_weeks += [r['week'] for r in usage or [] if r['week']<week and r.get('team_id')==player['team_id'] and r.get('offense_snaps') is not None]
    if observed_weeks and max(observed_weeks)<week-3:
        for m in metrics.values():
            m.update(mean=None,status='NOT_AVAILABLE',reason='No recent role observation within three weeks; stale role is not projected')
        role=['UNCERTAIN']
    role_profile={'position':player['position'],'method':'Measured role shares; unsupported routes/first reads stay unavailable'}
    if player['position']=='RB':
        target_share=metrics.get('expectedTargets',{}).get('share')
        carry_share=metrics.get('expectedCarries',{}).get('share')
        role_profile['usageType']='UNCERTAIN' if target_share is None or carry_share is None else 'RECEIVING' if target_share>=.1 and carry_share<.4 else 'LEAD_CARRIER' if carry_share>=.5 else 'COMMITTEE'
    relevant=[m for m in metrics.values() if m.get('mean') is not None]
    reliability='HIGH' if relevant and all(m.get('reliability')=='HIGH' for m in relevant) else 'MEDIUM' if relevant and all(m.get('reliability') in ('HIGH','MEDIUM') for m in relevant) else 'LOW'
    sd_values=[m['standardDeviation'] for m in relevant if m.get('standardDeviation') is not None]
    return {'status': 'LOW_CONFIDENCE' if any(m['status'] != 'AVAILABLE' for m in metrics.values() if m['mean'] is not None) else 'AVAILABLE' if any(m['mean'] is not None for m in metrics.values()) else 'NOT_AVAILABLE',
            'roleStatus': next((r for r in role if r != 'STABLE'), 'STABLE'), 'metrics': metrics,
            'roleStability': reliability if all(r=='STABLE' for r in role) else 'LOW', 'sampleReliability': reliability,
            'roleProfile':role_profile,
            'roleEvents':events,
            'dataCoverage': round(100*len(relevant)/len(metrics)) if metrics else 0,
            'uncertainty': {'status':'AVAILABLE' if sd_values else 'NOT_AVAILABLE','method':'Observed share variability; predictive calibration evaluated separately'},
            'vacatedOpportunity': {'status': 'NOT_AVAILABLE', 'reason': 'Historical absence/depth-chart evidence required; no automatic redistribution'},
            'method': 'Same-season recency-weighted shares, shrunk toward larger player sample'}
