"""Separate prop/family models; never read a line, side or matchup score."""
import json
from dataclasses import dataclass
from datetime import datetime,timezone
from pathlib import Path
from .efficiency import efficiency,positional_prior,valid_number

SUPPORTED={'QB':('passing_attempts','passing_yards','pass_completions','interceptions','rush_attempts'),
           'RB':('rush_attempts','rushing_yards','receptions','receiving_yards','rushing_receiving_yards'),
           'WR':('targets','receptions','receiving_yards'),'TE':('targets','receptions','receiving_yards')}
UNSUPPORTED={'passing_touchdowns':'No validated separate team/red-zone passing scoring process',
             'touchdowns':'No validated player goal-line/end-zone event model',
             'longest_reception':'Reception-length tail distribution unavailable; average catch length is not a maximum',
             'rushing_yards':'QB scramble/designed-rush yardage efficiency and kneel accounting are unsupported',
             'passing_rushing_yards':'QB rushing-yard component unavailable',
             'fantasy_score':'Component TD/fumble/scoring rules are unsupported; no standalone fantasy formula'}
# One selected efficiency feature per family. No EPA/YPA/success stacking.
FEATURES={'passing_yards':('ypa','expectedPassAttempts'), 'pass_completions':('completion_rate','expectedPassAttempts'),
          'rushing_yards':('ypc','expectedCarries'), 'receptions':('completion_rate','expectedTargets'),
          'receiving_yards':('yac_per_reception','expectedReceptions')}

@dataclass
class ProjectionContext:
    player:dict
    game_id:str
    week:int
    logs:list
    league_logs:list
    opportunity:dict
    matchup:dict
    season:int=0
    priors:dict|None=None

def model_key(position,prop):
    return f'{position}.{prop}'

def model_version(position,prop):
    return f'NFL_{position}_{prop.upper()}_V1'

def load_policy():
    try:
        artifact=json.loads(Path(__file__).with_name('policy.json').read_text(encoding='utf-8'))
        return artifact['models'] if artifact.get('version')=='NFL_PROJECTION_POLICY_V1' else {}
    except (OSError,ValueError,KeyError):
        return {}

def result(ctx,prop,reason=None):
    return {'playerId':ctx.player.get('id'),'gameId':ctx.game_id,'propType':prop,'projectionMean':None,'projectionMedianIfSupported':None,
            'opportunityInputs':{},'efficiencyInputs':{},'matchupAdjustments':[],
            'environment':{'status':'NOT_AVAILABLE','reason':'No forecast adjustment'},'personnel':{'status':'CONTEXT_ONLY','reason':'Opportunity owns conditional injury handling'},
            'roleReliability':ctx.opportunity.get('player',{}).get('sampleReliability','LOW'),
            'matchupReliability':'LOW','sampleReliability':'LOW','dataCoverage':0,
            'modelVersion':model_version(ctx.player.get('position','UNKNOWN'),prop),'policyVersion':'NFL_PROJECTION_POLICY_V1','generatedAt':datetime.now(timezone.utc).isoformat(),
            'status':'NOT_AVAILABLE','promotion':'DISABLED','reason':reason,'uncertainty':{'median':None,'distribution':'NOT_AVAILABLE'},
            'injuryCertainty':ctx.opportunity.get('health',{}).get('injuryCertainty','UNKNOWN'),
            'freshness':ctx.matchup.get('freshness',{}),'lineIndependent':True}

def opportunity_value(ctx,name):
    metric=ctx.opportunity.get('player',{}).get('metrics',{}).get(name,{})
    value=metric.get('mean')
    return (value,metric) if metric.get('status')!='NOT_AVAILABLE' and valid_number(value) and value>=0 else (None,metric)

def feature_delta(ctx,prop,opportunity,efficiencies):
    definition=FEATURES.get(prop)
    if not definition:
        return None
    metric,volume_key=definition
    profile=ctx.matchup.get('defenseProfile',{}).get('metrics',{}).get(metric,{})
    reference=ctx.matchup.get('references',{}).get(metric,{})
    # Consume underlying Phase 5 profiles, not presentation scores.
    value=profile.get('adjustedValue') if profile.get('adjustedValue') is not None else profile.get('rawValue')
    mean=reference.get('mean'); n=profile.get('n'); prior=profile.get('priorExposure')
    if not all(valid_number(v) for v in (value,mean,n,prior)) or n<=0 or prior<=0 or profile.get('games',0)<4 or ctx.matchup.get('freshness',{}).get('factor',0)<=0:
        return None
    exposure=opportunity
    if volume_key=='expectedReceptions':
        exposure*=efficiencies['catchRate']['mean']
    rho=n/(n+prior)
    return {'feature':metric,'rawValue':profile.get('rawValue'),'adjustedValue':profile.get('adjustedValue'),
            'referenceMean':mean,'delta':value-mean,'reliability':rho,'sample':n,'sampleGames':profile['games'],
            'adjustment':profile.get('adjustment'),'statExposure':exposure,'unitEffect':exposure*(value-mean)*rho,
            'group':'opponentCatchEnvironment' if prop in ('receptions','pass_completions') else 'opponentEfficiency'}

def project(ctx,prop,policy=None,variant=None):
    position=ctx.player.get('position')
    output=result(ctx,prop)
    if not ctx.player.get('id') or not ctx.player.get('team_id') or not ctx.game_id:
        output['reason']='Resolved player, team and scheduled game required';return output
    if prop not in SUPPORTED.get(position,()):
        output['reason']=UNSUPPORTED.get(prop,'Unsupported prop for player position');return output
    config=(load_policy() if policy is None else policy).get(model_key(position,prop),{})
    output['promotion']=config.get('promotion','DISABLED')
    if variant is None and (not config or config.get('promotion')=='DISABLED'):
        output['reason']='Model disabled or lacks completed validation policy';return output
    if variant is None and config.get('method') not in ('historical','shrink','recency','opponent','componentSum'):
        output['reason']='Unrecognized versioned model methodology';return output
    role=ctx.opportunity.get('player',{})
    if ctx.opportunity.get('status')=='NOT_AVAILABLE' or not role or role.get('status')=='NOT_AVAILABLE':
        output['reason']='Usable unconditional Phase 4 opportunity required';return output
    if ctx.opportunity.get('scenarios'):
        output['injuryScenarios']=ctx.opportunity['scenarios']
        output['projectionCondition']='Supplied Phase 4 observed-role baseline only; teammate scenarios have no modeled probabilities'
        # Selected-player injury already fails the unavailable-role gate above.
        # A supported alternative with different volume cannot be averaged without probabilities.
        base_metrics=role.get('metrics',{})
        for scenario in ctx.opportunity['scenarios']:
            alternative=(scenario.get('player') or {}).get('metrics',{})
            for name in ('expectedTargets','expectedCarries','expectedPassAttempts'):
                before=base_metrics.get(name,{}).get('mean');after=alternative.get(name,{}).get('mean')
                if valid_number(before) and valid_number(after) and abs(before-after)>1e-6:
                    output['reason']='Supported injury scenarios imply different opportunities; no unconditional mixture without scenario probabilities';return output
    recent=[r['week'] for r in ctx.logs if r['id']==ctx.player['id'] and r['team_id']==ctx.player['team_id'] and r['week']<ctx.week and (not ctx.season or r.get('season')==ctx.season)]
    if not recent or max(recent)<ctx.week-3:
        output['reason']='Current-team role observations are stale or missing';return output
    method=variant or config.get('method','recency')
    if method=='selected':method=config.get('method','recency')
    output['method']=method
    if prop=='rushing_receiving_yards':
        children=[project(ctx,p,policy,variant) for p in ('rushing_yards','receiving_yards')]
        output['components']=children
        if any(c['projectionMean'] is None for c in children):
            output['reason']='Both component yardage projections required';return output
        output.update(projectionMean=sum(c['projectionMean'] for c in children),status='LOW_CONFIDENCE',dataCoverage=min(c['dataCoverage'] for c in children),
                      reason='Exact component sum; correlation and predictive variance remain unavailable',
                      uncertainty={'median':None,'distribution':'NOT_AVAILABLE','covariance':None,'relationship':'Same game/team script; do not assume independence'})
        return output
    volume_models={'passing_attempts':'expectedPassAttempts','targets':'expectedTargets','rush_attempts':'expectedCarries'}
    if prop in volume_models:
        name=volume_models[prop]
        if position=='QB' and prop=='rush_attempts':
            components={k:opportunity_value(ctx,k) for k in ('expectedDesignedRushes','expectedScrambles','expectedKneels')}
            if any(v[0] is None or v[1].get('sample',0)<4 for v in components.values()):
                output['reason']='QB rush attempts require non-scramble proxy, scrambles and kneels separately';return output
            value=sum(v[0] for v in components.values())
            output['opportunityInputs']={k:v[1] for k,v in components.items()}
        else:
            value,metric=opportunity_value(ctx,name);output['opportunityInputs'][name]=metric
        if value is None or (not (position=='QB' and prop=='rush_attempts') and metric.get('sample',0)<4):
            output['reason']='Required Phase 4 opportunity unavailable';return output
        output.update(projectionMean=value,status='LOW_CONFIDENCE',dataCoverage=100,reason='Phase 4 reconciled volume, not an efficiency-derived opportunity')
        return output
    name='expectedPassAttempts' if position=='QB' else 'expectedCarries' if prop=='rushing_yards' else 'expectedTargets'
    value,metric=opportunity_value(ctx,name);output['opportunityInputs'][name]=metric
    if value is None or metric.get('sample',0)<4:
        output['reason']='Required Phase 4 opportunity unavailable';return output
    rate_keys={'passing_yards':['passingYPA'],'pass_completions':['completionRate'],'interceptions':['interceptionRate'],
               'rushing_yards':['rushingYPC'],'receptions':['catchRate'],'receiving_yards':['catchRate','yardsPerReception']}[prop]
    historical=[r for r in ctx.logs if r['id']==ctx.player['id'] and r['position']==position and r['week']<ctx.week and (not ctx.season or r.get('season')==ctx.season)]
    base_method=method if method in ('historical','shrink','recency') else 'recency'
    for key in rate_keys:
        prior=ctx.priors.get(key) if ctx.priors is not None else positional_prior([r for r in ctx.league_logs if not ctx.season or r.get('season')==ctx.season],position,ctx.player['id'],key,ctx.week)
        estimate=efficiency(historical,key,ctx.week,prior,base_method)
        output['efficiencyInputs'][key]=estimate
        if estimate['mean'] is None:
            output['reason']=estimate['reason'];return output
    base=value
    for rate in output['efficiencyInputs'].values():base*=rate['mean']
    feature=feature_delta(ctx,prop,value,output['efficiencyInputs'])
    # Validation chooses at most one independent opponent feature per model.
    coefficient=config.get('coefficient',0) if method=='opponent' else 0
    delta=coefficient*feature['unitEffect'] if feature and valid_number(coefficient) else 0
    if feature:
        output['matchupFeature']=feature
        output['matchupAdjustments']=[{**feature,'coefficient':coefficient,'statAdjustment':delta,'enabled':method=='opponent' and coefficient!=0}]
    final=base+delta
    if prop in ('receptions','pass_completions','interceptions'):final=max(0,min(value,final))
    output['reconciliationAdjustment']=final-(base+delta)
    output.update(projectionMean=final,baseProjection=base,status='LOW_CONFIDENCE',promotion=config.get('promotion','EXPERIMENTAL'),
                  dataCoverage=100*(2+bool(feature))/4, sampleReliability=min((r['reliability'] for r in output['efficiencyInputs'].values()),default=0),
                  reason='Statistic-only experimental projection; unavailable advanced tracking/weather and incomplete injuries limit certainty',
                  method=method,roleStatus=role.get('roleStatus','UNCERTAIN'),
                  roleChangeHandling='Opportunity consumes changed role; efficiency retains broader same-season talent with an eight-week decay and positional shrinkage')
    return output
