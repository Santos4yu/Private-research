import React from 'react';
import { ModelBadge } from './ModelBadge';

export function NFLDecisionPanel({resource,propKey}) {
  const data=resource?.data;
  if(resource?.status==='LOADING')return <section className="nfl-chart-card" role="status"><h3>Checking model eligibility</h3></section>;
  if(!data || !data.modelKey?.endsWith(`.${propKey}`))return null;
  return <section className="nfl-chart-card"><div className="nfl-section-title"><h3>Production gate</h3><strong>PASS</strong><ModelBadge status={data.productionStatus} /></div>
    <p>{data.productionStatus==='SHADOW_ONLY'?'EXPERIMENTAL MODEL · shadow only':'Model unavailable for betting decisions'}</p>
    <small>Point {data.pointStatus} · distribution {data.distributionStatus} · health {data.health}</small>
    <p>No production-grade recommendation. Betting calibration is unavailable and model validation gates have not passed. Posted research lines do not establish a betting edge.</p>
    <details><summary>Why Vortex is passing</summary><ul>{(data.eligibilityReasons || data.reasons || []).map((reason,index)=><li key={index}>{reason}</li>)}</ul></details>
  </section>;
}
