import React from 'react';
import { NFLFreshness } from './Freshness';

export function NFLDistributionPanel({ resource, propKey, quote }) {
  const data=resource?.data;
  if(resource?.status==='LOADING')return <section className="nfl-chart-card" role="status"><h3>Estimating outcome distribution</h3></section>;
  const supported=data?.propType===propKey && data.status==='EXPERIMENTAL' && Number.isFinite(data.projectionMedian) && data.percentiles;
  if(!supported)return null;
  const bars=data.histogram || []; const peak=Math.max(...bars.map(b=>b.mass),.001);
  const low=bars[0]?.lower ?? 0;const high=bars.at(-1)?.upper ?? 1;
  const x=(value)=>Math.max(0,Math.min(400,(value-low)/Math.max(1,high-low)*400));
  const line=quote?.verified && quote.propType===propKey && Number.isFinite(quote.value) ? quote : null;
  return <section className="nfl-chart-card"><div className="nfl-section-title"><h3>Estimated outcome range</h3><small>Beta estimate</small></div><NFLFreshness timestamp={data.generatedAt} />
    <div className="nfl-stat-grid">{[['Simulation mean',data.projectionMean],['Median',data.projectionMedian],['P10',data.percentiles.p10],['Floor · P25',data.percentiles.p25],['Ceiling · P75',data.percentiles.p75],['P90',data.percentiles.p90]].map(([label,value])=><div className="nfl-stat" key={label}><span>{label}</span><strong>{Number.isFinite(value)?value.toFixed(1):'NOT AVAILABLE'}</strong></div>)}</div>
    <svg viewBox="0 0 400 130" role="img" aria-label={`Experimental outcome histogram. Median ${data.projectionMedian}. Middle fifty percent ${data.percentiles.p25} to ${data.percentiles.p75}.`} style={{width:'100%',height:'auto'}}>
      {bars.map((bar,i)=><rect key={i} x={i*400/bars.length} y={110-bar.mass/peak*100} width={Math.max(1,400/bars.length-2)} height={bar.mass/peak*100} fill="currentColor" opacity=".55"><title>{`${bar.lower.toFixed(0)} to ${bar.upper.toFixed(0)}: ${(bar.mass*100).toFixed(1)}%`}</title></rect>)}
      {[[data.projectionMean,'Mean',''],[data.projectionMedian,'Median','4 3'],[data.percentiles.p25,'P25','2 4'],[data.percentiles.p75,'P75','2 4']].map(([value,label,dash])=><line key={label} x1={x(value)} x2={x(value)} y1="5" y2="110" stroke="currentColor" strokeDasharray={dash} strokeWidth="2"><title>{`${label}: ${value.toFixed(1)}`}</title></line>)}
      {line && <line x1={x(line.value)} x2={x(line.value)} y1="0" y2="110" stroke="#f2bd63" strokeWidth="3"><title>{`Selected ${line.platform} line: ${line.value}${line.value<low || line.value>high ? ' (outside histogram range; marker at boundary)' : ''}`}</title></line>}
      <text x="0" y="128" fill="currentColor" fontSize="12">{bars[0]?.lower.toFixed(0)}</text><text x="400" y="128" textAnchor="end" fill="currentColor" fontSize="12">{bars.at(-1)?.upper.toFixed(0)}</text>
    </svg><small>Solid marker: mean · dashed: median · dotted: P25/P75</small><p>P25–P75 shows the middle half of estimated outcomes.</p>
    <small>Outcome volatility {data.outcomeVolatility} · point model {data.pointModelStatus} · {data.simulationCount?.toLocaleString()} simulations</small>
    {line && <p>Gold marker: selected {line.platform} line {line.value}. {line.value<low || line.value>high ? 'The selected line is outside the plotted range.' : ''}</p>}
    {data.projectionCondition && <p>{data.projectionCondition}</p>}
    <small>This estimate is still being validated.</small>
  </section>;
}
