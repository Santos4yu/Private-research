import React, { useEffect, useState } from 'react';
import { ModelBadge } from './ModelBadge';
export function NFLValueBoard({ load }) {
  const [resource, setResource] = useState(null);
  const [error, setError] = useState('');
  const [position, setPosition] = useState('');
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState('probability');
  const [dashboard, setDashboard] = useState(null);
  useEffect(() => { let active = true; load('value-board').then(body => { if (active) setResource(body.data); }).catch(() => { if (active) setError('Data source temporarily unavailable.'); }); return () => { active = false; }; }, [load]);
  // The server production gate supplies eligible rows only. No client promotions.
  const available = resource?.rows || [];
  const rows = available.filter(row => (!position || row.position === position) && Object.entries(filters).every(([key,value]) => !value || String(row[key]) === value)).sort((a,b) => (Number(b[sort]) || 0) - (Number(a[sort]) || 0));
  const cell = value => value == null ? 'NOT AVAILABLE' : typeof value === 'number' ? value.toFixed(1) : String(value).replaceAll('_', ' ');
  const columns = [['playerId','Player'],['teamId','Team'],['opponentId','Opponent'],['propType','Prop'],['line','Line'],['direction','Direction'],['projectionMean','Projection'],['probability','Probability'],['statisticalEdge','Statistical edge'],['productionStatus','Model status'],['modelHealth','Health'],['confidence','Confidence'],['verdict','Verdict']];
  return <section className="nfl-chart-card nfl-value-board"><div className="nfl-section-title"><h3>Value board</h3><ModelBadge status="SHADOW_ONLY" /></div>
    <label>Position <select value={position} onChange={event => setPosition(event.target.value)}><option value="">All positions</option>{['QB','RB','WR','TE'].map(value => <option key={value}>{value}</option>)}</select></label>
    <details><summary>Board filters and sorting</summary><div className="nfl-board-filters">{[['propType','Prop'],['teamId','Team'],['gameId','Game'],['verdict','Verdict'],['productionStatus','Model status'],['modelHealth','Health']].map(([key,label]) => <label key={key}>{label}<select value={filters[key] || ''} onChange={event => setFilters(current => ({...current,[key]:event.target.value}))}><option value="">All</option>{[...new Set(available.map(row => row[key]).filter(Boolean))].map(value => <option key={value} value={value}>{cell(value)}</option>)}</select></label>)}<label>Sort<select value={sort} onChange={event => setSort(event.target.value)}><option value="probability">Probability</option><option value="statisticalEdge">Statistical edge</option><option value="dataCoverage">Data coverage</option></select></label></div></details>
    {!resource && !error ? <p role="status">Checking eligible current lines…</p> : error ? <p role="alert">{error}</p> : !rows.length ? <p>{resource.reason || 'No eligible props for this position.'} Research remains available; public recommendations are disabled.</p> : <div className="nfl-board-rows">{rows.map(row => <article key={`${row.playerId}.${row.propType}`}><strong>{row.playerName || row.playerId}</strong><dl>{columns.map(([key,label]) => <div key={key}><dt>{label}</dt><dd>{key === 'line' ? cell(row.line?.value) : key === 'probability' ? Number.isFinite(row[key]) ? `${(row[key]*100).toFixed(1)}%` : 'NOT AVAILABLE' : cell(row[key])}</dd></div>)}</dl><ModelBadge status={row.productionStatus} /></article>)}</div>}
    <details><summary>Internal model health · admin access required</summary><button type="button" className="nfl-refresh" onClick={() => load('model-health').then(body => setDashboard(body.data)).catch(() => setDashboard({error:'Admin access or model-health data unavailable.'}))}>Load model health</button>{dashboard?.error && <p role="alert">{dashboard.error}</p>}{dashboard?.models?.map(model => <article className="nfl-evidence-row" key={model.modelKey}><strong>{model.modelKey} · {model.modelVersion}</strong><ModelBadge status={model.productionStatus} /><small>Health {model.health || 'NOT AVAILABLE'} · calibration {model.calibrationStatus || 'NOT AVAILABLE'}</small><span>Predictions {cell(model.holdoutSample)} · MAE {cell(model.pointMetrics?.MAE)} · bias {cell(model.pointMetrics?.bias)} · availability {cell(model.availability)}</span></article>)}</details>
  </section>;
}
