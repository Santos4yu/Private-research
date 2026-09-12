"""Prop-specific, explainable NFL matchup research. Never a prop prediction."""
import json
from math import isfinite
from pathlib import Path
from .matchup_profiles import profiles,pooled
from .matchup_interactions import normalize,unavailable

COMPONENTS=('defenseQuality','coverageFit','routeFit','alignmentFit','runSchemeFit','trenchFit',
            'pressureInteraction','yacFit','explosiveFit','personnelImpact','gameScriptFit','environmentImpact')
UNSUPPORTED={'coverageFit':'No validated current man/zone or coverage-family adapter',
             'routeFit':'Routes/route distribution unavailable; target depth is not a route',
             'alignmentFit':'Slot/outside/backfield alignment unavailable',
             'runSchemeFit':'Run directions are not inside/outside zone, power or counter concepts',
             'pressureInteraction':'Pressure/blitz attribution unavailable; sacks and QB hits are not pressure rate',
             'personnelImpact':'Injury/defender evidence incomplete; no arbitrary injury points',
             'gameScriptFit':'Phase 4 opportunity context only; not counted again as quality points',
             'environmentImpact':'Forecast weather unavailable; no normal-weather bonus'}

def selection(position,prop):
    if position=='QB' and prop in ('rushing_yards','rush_attempts'):
        return {}  # Never use RB run defense as a QB rushing model.
    if prop in ('targets','rush_attempts','passing_attempts'):
        return {}  # Opportunity/competition prop, not an efficiency score.
    if prop in ('rushing_yards',):
        return {'defenseQuality':'run_epa','explosiveFit':'run_explosive'}
    if prop in ('receptions','pass_completions'):
        return {'defenseQuality':'completion_rate','trenchFit':'sack_rate'}
    if prop in ('receiving_yards','longest_reception'):
        return {'defenseQuality':'pass_epa','yacFit':'yac_per_reception','explosiveFit':'pass_explosive','trenchFit':'sack_rate'}
    if prop in ('passing_yards','passing_touchdowns','interceptions'):
        return {'defenseQuality':'pass_epa','explosiveFit':'pass_explosive','trenchFit':'sack_rate'}
    # Compound/fantasy/TD models require separate branch composition, not a reused universal number.
    return {}

def policy():
    try:
        return json.loads(Path(__file__).with_name('matchup_policy.json').read_text(encoding='utf-8'))['enabled']
    except (ValueError,OSError,KeyError):
        return {}  # No validation policy, no invented score.


def metric_score(metric,defense,reference,enabled,freshness=1.):
    m=defense['metrics'].get(metric,{})
    if not enabled.get(metric):
        return unavailable('Feature not retained by chronological validation; available as diagnostic context only')
    if freshness<=0:
        return unavailable('Opponent observations are stale; no confident research score')
    raw=m.get('rawValue')
    value=m.get('adjustedValue') if m.get('adjustedValue') is not None else raw
    prior=m.get('priorExposure')
    if value is None or not prior or m.get('games',0)<4 or m.get('n',0)<=0:
        return unavailable('At least four prior defensive games and valid metric exposure required')
    rho=m['n']/(m['n']+prior)
    direction=-1 if metric in ('sack_rate','stuff_rate') else 1
    norm=normalize(value,reference.get(metric,{}),rho,direction)
    if norm is None:
        return unavailable('At least eight teams and non-degenerate empirical reference distribution required')
    adjustment_coverage=m.get('adjustmentCoverage',0) if m.get('adjustedValue') is not None else 0
    certainty=100*rho*freshness*(.5+.5*adjustment_coverage)
    return {'status':'AVAILABLE' if certainty>=60 else 'LOW_CONFIDENCE','score':50+norm['contribution'],
            'certainty':certainty,'dataCoverage':100,'sampleReliability':'HIGH' if rho>=.75 else 'MEDIUM' if rho>=.5 else 'LOW',
            'contributors':[{'feature':metric,**norm,'weight':1.,'sample':m['n'],'games':m['games'],
                             'adjustment':m.get('adjustment'),'rawValue':raw,'finalContribution':norm['contribution']}],
            'reason':'Weak defensive performance is favorable to offense; not hit probability'}


def build_matchup(data,player,opponent_id,prop,week,opportunity=None,environment=None,personnel=None,enabled=None):
    defensive,reference=profiles(data['games'],week)
    defense=defensive.get(opponent_id)
    if not player.get('id') or not player.get('team_id') or not defense:
        return {'status':'NOT_AVAILABLE','reason':'Resolved player/team and prior opponent defense data required','matchupQuality':None,'matchupCertainty':None,'dataCoverage':0}
    selected=selection(player['position'],prop)
    enabled=policy() if enabled is None else enabled
    latest=max(defense['sampleWeeks'])
    freshness=1. if week-latest<=2 else .5 if week-latest<=3 else 0.
    # Consecutive season-week indices control recency, not calendar freshness.
    # Prior-season-only defense is conditional offseason evidence.
    if data.get('history',{}).get('usesPriorSeason') and latest<=0:
        freshness=min(freshness,.5)
    components={name:unavailable(UNSUPPORTED.get(name,'Not applicable or supported for this prop')) for name in COMPONENTS}
    for component,metric in selected.items():
        components[component]=metric_score(metric,defense,reference,enabled,freshness)
    # Sack-only trench evidence is not full pass protection or pressure attribution.
    if components['trenchFit']['score'] is not None:
        own=pooled([g for g in data['games'] if g['team_id']==player['team_id'] and g['week']<week],'sack_rate')
        own_norm=normalize(own['value'],reference['sack_rate'],own['n']/(own['n']+defense['metrics']['sack_rate']['priorExposure']) if own['n'] else 0,-1)
        if own_norm:
            components['trenchFit']['score']=(components['trenchFit']['score']+50+own_norm['contribution'])/2
            components['trenchFit']['contributors'][0]['weight']=.5
            components['trenchFit']['contributors'][0]['finalContribution']*=.5
            components['trenchFit']['contributors'].append({'feature':'offense_sack_rate',**own_norm,'weight':.5,'sample':own['n'],'games':own['games'],'adjustment':'RAW_OFFENSE_SACK_CONTEXT','rawValue':own['value'],'finalContribution':own_norm['contribution']*.5})
        components['trenchFit']['dataCoverage']=20
        components['trenchFit']['certainty']*=.2
        components['trenchFit']['reason']='Sack-rate component only; OL/pressure/blitz/time-to-pressure are unavailable'
        components['trenchFit']['status']='LOW_CONFIDENCE'
        components['trenchFit']['offenseSackRate']=own
    script=(opportunity or {}).get('team',{}).get('gameScript')
    components['gameScriptFit']['context']={'team':(opportunity or {}).get('team',{}),'player':(opportunity or {}).get('player',{}),'script':script}
    components['environmentImpact']['context']=environment or {}
    components['personnelImpact']['context']=personnel or {'status':'NOT_AVAILABLE'}
    history=[p for p in data.get('players',[]) if p['player_id']==player['id'] and p['team_id']==player['team_id'] and p['week']<week]
    player_profile={m:pooled(history,m) for m in ('yards_per_target','yards_per_reception','catch_rate','adot','deep_target_rate','yac_per_reception','receiving_explosive','ypc','run_explosive','sack_rate','scramble_rate')}
    # Receiver-specific exposure gates a team-level YAC signal. No routes are inferred.
    yac_component=components['yacFit']
    if yac_component['score'] is not None:
        yac=player_profile['yac_per_reception']; yards=player_profile['yards_per_reception']
        if yac['value'] is None or not yards['value'] or yac['games']<3:
            components['yacFit']=unavailable('Player-specific YAC/reception sample unavailable; team YAC alone is not player fit')
        else:
            exposure=max(0,min(1,yac['value']/yards['value']))
            receiver_rho=yac['n']/(yac['n']+20)
            factor=exposure*receiver_rho
            yac_component['score']=50+(yac_component['score']-50)*factor
            yac_component['certainty']*=receiver_rho
            yac_component['playerExposure']={'yacShareOfCatchYards':exposure,'sample':yac['n'],'reliability':receiver_rho}
            for c in yac_component['contributors']:
                c['finalContribution']*=factor
                c['playerExposureWeight']=factor
    target_depth={}; direction_context={}
    for depth in ('SHORT','INTERMEDIATE','DEEP'):
        count=sum(p['metrics'].get('depth_'+depth,{}).get('n',0) for p in history)
        faced=[{'metrics':g.get('depths',{}).get(depth,{})} for g in data['games'] if g['opponent_team_id']==opponent_id and g['week']<week]
        target_depth[depth]={'playerTargets':count,'defenseYPA':pooled(faced,'ypa'),'defenseCompletion':pooled(faced,'completion_rate')}
    depth_total=sum(v['playerTargets'] for v in target_depth.values())
    for depth in target_depth.values():
        depth['frequency']=depth['playerTargets']/depth_total if depth_total else None
    for direction in ('left','middle','right'):
        own=[{'metrics':p.get('directions',{}).get(direction,{})} for p in history]
        faced=[{'metrics':g.get('directions',{}).get(direction,{})} for g in data['games'] if g['opponent_team_id']==opponent_id and g['week']<week]
        direction_context[direction]={'player':pooled(own,'ypc'),'defense':pooled(faced,'ypc')}
    qb_id=(opportunity or {}).get('startingQB')
    connections=[c for c in data.get('connections',[]) if c['receiver_id']==player['id'] and c['qb_id']==qb_id and c['week']<week and c['team_id']==player['team_id']]
    qb_connection={metric:pooled(connections,metric) for metric in ('catch_rate','yards_per_target','adot')} if qb_id else {'status':'NOT_AVAILABLE','reason':'Current QB unresolved'}
    # Correlated efficiency measures share ONE capped group, not repeated independent votes.
    groups={'efficiency':['defenseQuality','yacFit','explosiveFit'],'sackContext':['trenchFit']}
    group_values=[]; group_trace=[]
    for group,names in groups.items():
        available=[components[n] for n in names if components[n]['score'] is not None]
        if available:
            value=sum(c['score'] for c in available)/len(available)
            group_values.append(value);group_trace.append({'group':group,'components':[n for n in names if components[n]['score'] is not None],'score':value,'withinGroupWeight':1/len(available)})
    supported=[c for c in components.values() if c['score'] is not None]
    coverage=100*sum(c['dataCoverage']/100 for c in supported)/len(COMPONENTS)
    certainty=sum(c['certainty'] for c in supported)/len(supported)*coverage/100 if supported else None
    quality=sum(group_values)/len(group_values) if group_values else None
    for group in group_trace:
        group['weight']=1/len(group_trace)
        group['finalContribution']=(group['score']-50)*group['weight']
    edges=[]; risks=[]
    for name in selected:
        c=components[name]
        for contributor in c['contributors']:
            z=contributor['normalized']
            explanation={'component':name,'feature':contributor['feature'],'value':contributor['value'],'referenceMean':contributor['referenceMean'],
                         'sample':contributor['sample'],'contribution':contributor['finalContribution'],
                         'text':f"{contributor['feature'].replace('_',' ')} is {'above' if contributor['value']>contributor['referenceMean'] else 'below'} the prior-week league reference ({contributor['sample']} observations; {contributor['adjustment'].replace('_',' ').lower()})."}
            if contributor['finalContribution']>0:
                edges.append(explanation)
            elif contributor['finalContribution']<0:
                risks.append(explanation)
    if coverage<50:
        risks.append({'feature':'dataCoverage','text':'Most advanced matchup components are unsupported; quality is partial evidence, not strong certainty.'})
    if (opportunity or {}).get('status')!='AVAILABLE':
        risks.append({'feature':'opportunity','text':'Opportunity/role certainty is limited or unavailable; matchup quality cannot create opportunities.'})
    return {'status':'LOW_CONFIDENCE' if quality is not None else 'NOT_AVAILABLE','playerId':player['id'],'opponentId':opponent_id,'propKey':prop,
            'matchupQuality':quality,'matchupCertainty':certainty,'dataCoverage':coverage,'components':components,
            'defenseProfile':defense,'playerProfile':player_profile,'targetDepthContext':{'score':None,'splits':target_depth,'reason':'Target depth is not coverage or route data; unvalidated interaction has no score weight'},
            'runDirectionContext':{'score':None,'splits':direction_context,'reason':'Direction is not run concept; supporting diagnostics only'},
            'qbReceiverContext':{'score':None,'metrics':qb_connection,'reason':'Observed connection, not catchability or first-read charting; no score weight'},
            'edges':edges,'risks':risks,'scoreGroups':group_trace,
            'freshness':{'fetchedAt':data.get('fetchedAt'),'observedAt':data.get('observedAt'),'latestOpponentWeek':latest,'factor':freshness},
            'normalization':'50 + 50*tanh(z/2)*sampleReliability; reference from earlier same-season defenses',
            'qualityDefinition':'Partial prop-specific research fit, not final prop model or hit probability',
            'modelVersion':'nfl-matchup-v2'}
