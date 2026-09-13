import React from 'react';
import {projectionValue} from './projection-ui';
import {NFLFreshness} from './Freshness';
const LABELS={expectedTargets:'Expected targets',expectedCarries:'Expected carries',expectedPassAttempts:'Expected pass attempts',expectedDesignedRushes:'Non-scramble rushes',expectedScrambles:'Scrambles',passingYPA:'Yards per attempt',completionRate:'Completion rate',rushingYPC:'Yards per carry',catchRate:'Catch rate',yardsPerReception:'Yards per reception'};
export function NFLProjectionPanel({resource,selectedProp}) {
  if(resource?.status==='LOADING')return <div className="nfl-model-loading" role="status">Loading estimate…</div>;
  const data=resource?.data;const value=projectionValue(data,selectedProp.key);
  if(value===null)return null;
  return <section className="nfl-chart-card nfl-compact-estimate"><div className="nfl-section-title"><h3>Beta estimate</h3><strong>{Number(value.toFixed(1))}</strong></div><NFLFreshness timestamp={data.generatedAt}/><details><summary>How this estimate is calculated</summary>{[['Opportunity',data.opportunityInputs],['Efficiency',data.efficiencyInputs]].map(([title,metrics])=><div key={title}><h4>{title}</h4>{Object.entries(metrics || {}).filter(([,metric])=>Number.isFinite(metric?.mean)).map(([key,metric])=><p key={key}>{LABELS[key] || key.replaceAll('_',' ')}: {['catchRate','completionRate'].includes(key)?`${(metric.mean*100).toFixed(1)}%`:metric.mean.toFixed(1)}</p>)}</div>)}{data.projectionCondition && <p>{data.projectionCondition}</p>}<p>Model validation is in progress. {data.modelVersion}</p></details></section>;
}
