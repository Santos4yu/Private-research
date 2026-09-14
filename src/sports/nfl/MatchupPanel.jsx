import React from 'react';
import {teamLogoUrl} from './nfl-ui-core';
import { Activity, Shield, Crosshair, TrendingUp, AlertTriangle, Layers, CloudSun, UsersRound, CircleCheck, TriangleAlert } from 'lucide-react';

const COMPONENTS = { defenseQuality: ['Defense', Shield], coverageFit: ['Coverage', Crosshair], routeFit: ['Routes', Activity], alignmentFit: ['Alignment', Layers], runSchemeFit: ['Run scheme', Layers], trenchFit: ['Trenches · sack evidence', Shield], pressureInteraction: ['Pressure', Activity], yacFit: ['YAC fit', TrendingUp], explosiveFit: ['Explosive plays', TrendingUp], gameScriptFit: ['Game script', Activity], personnelImpact: ['Personnel', UsersRound], environmentImpact: ['Environment', CloudSun] };
const METRICS = { offense_sack_rate: 'Sacks allowed by offense', pass_epa: 'EPA per dropback allowed', pass_success: 'Pass success rate allowed', ypa: 'Yards per attempt allowed', completion_rate: 'Completion rate allowed', cpoe: 'CPOE allowed', pass_explosive: 'Explosive pass rate allowed', yac_per_reception: 'YAC per reception allowed', sack_rate: 'Sack rate', scramble_rate: 'Scramble rate allowed', run_epa: 'EPA per called rush allowed', run_success: 'Run success rate allowed', ypc: 'Yards per carry allowed', run_explosive: 'Explosive run rate allowed', stuff_rate: 'Stuff rate', adot: 'Target depth faced' };
const PERCENT = new Set(['pass_success', 'completion_rate', 'catch_rate', 'pass_explosive', 'sack_rate', 'scramble_rate', 'run_success', 'run_explosive', 'stuff_rate', 'offense_sack_rate']);
const scoreText = (value) => Number.isFinite(value) ? `${Math.round(value)}/100` : 'NOT AVAILABLE';
const metricText = (key, value) => !Number.isFinite(value) ? 'NOT AVAILABLE' : PERCENT.has(key) ? `${(value * 100).toFixed(1)}%` : value.toFixed(key.includes('epa') ? 3 : 2);

export function NFLMatchupPanel({ resource, selectedProp }) {
  const data=resource?.data;
  if(resource?.status==='LOADING')return <section className="nfl-matchup-hero" role="status"><h3>Matchup</h3><div className="nfl-score-skeleton"/>Loading opponent evidence…</section>;
  if(!data?.components)return <section className="nfl-matchup-hero"><h3>Matchup</h3><p>Opponent data could not load. Refresh research to retry.</p></section>;
  const volume=data.opponentVolume;
  const quality=Number.isFinite(data.matchupQuality)?data.matchupQuality:null;
  const score=quality??volume?.score;
  const rounded=score==null?null:Math.round(score);
  const grade=rounded==null?'Limited evidence':rounded>=80?'Strong':rounded>=65?'Favorable':rounded>=45?'Neutral':rounded>=30?'Difficult':'Very difficult';
  const available=Object.entries(COMPONENTS).filter(([key])=>Number.isFinite(data.components[key]?.score));
  const unavailable=Object.entries(COMPONENTS).filter(([key])=>!Number.isFinite(data.components[key]?.score));
  // Below this coverage, most of the score is a single discounted component
  // (or none at all) — showing a bold number here reads as a confident
  // verdict when it isn't one. Same 50% threshold the backend itself uses
  // to flag "partial evidence, not strong certainty".
  const lowCoverage=quality!=null&&Number.isFinite(data.dataCoverage)&&data.dataCoverage<50;
  return <section className="nfl-panel-stack nfl-matchup-app">
    <article className={`nfl-matchup-hero${lowCoverage?' low-coverage':''}`}>{data.opponentId&&<div className="nfl-matchup-opponent"><img src={teamLogoUrl(data.opponentId)} width="28" height="28" alt={`${data.opponentId} logo`}/><span>vs {data.opponentId}</span></div>}
      {lowCoverage ? <>
        <div className="nfl-matchup-low-evidence"><TriangleAlert size={18}/><div><strong>Not enough validated matchup data for {selectedProp.label.toLowerCase()}</strong><p>Only {Math.round(data.dataCoverage)}% of matchup evidence is currently validated for this prop vs {data.opponentId}. The components below that are missing failed historical validation or have no reliable data source — they're excluded rather than guessed.</p></div></div>
        <div className="nfl-matchup-raw-score"><span>Raw estimate (low confidence)</span><strong>{Math.round(score)}<small>/100 · {grade}</small></strong></div>
      </> : <>
        <div className="nfl-matchup-heading"><div><span>{selectedProp.label}</span><h3>{quality!=null?'Matchup score':volume?'Opponent volume':'Matchup'}</h3></div><strong>{score==null?'—':Math.round(score)}{score!=null&&<small>/100</small>}</strong></div>
        {score!=null&&<div className="nfl-fit-track"><i style={{width:`${score}%`}}/></div>}
        <div className="nfl-matchup-meta"><span>{quality!=null?grade:volume?'Historical percentile':'Scored evidence unavailable'}</span><span>{quality!=null?`${Math.round(data.dataCoverage)}% coverage`:volume?`${volume.games} games · ${volume.teams} teams`:''}</span></div>
        {volume&&quality==null&&<><p>{volume.label}</p><div className="nfl-volume-comparison"><span>Opponent <b>{volume.value.toFixed(1)}</b></span><span>League <b>{volume.leagueMean.toFixed(1)}</b></span></div><small>Higher = more opposing volume. Your player’s role still matters.</small></>}
        {quality!=null&&<small>50 is neutral · not hit probability</small>}
      </>}
    </article>
    {(data.edges?.length>0||data.risks?.length>0)&&<div className="nfl-matchup-notes">
      {data.edges?.length>0&&<div className="nfl-matchup-note-group good"><h4><CircleCheck size={16}/>Why it helps</h4><ul>{data.edges.map((e,i)=><li key={i}>{e.text}</li>)}</ul></div>}
      {data.risks?.length>0&&<div className="nfl-matchup-note-group bad"><h4><TriangleAlert size={16}/>Why to be cautious</h4><ul>{data.risks.map((r,i)=><li key={i}>{r.text}</li>)}</ul></div>}
    </div>}
    {data.positionDefense?.length>0&&<div className="nfl-position-defense"><h4>Defense vs {data.positionDefense[0].position}</h4>{data.positionDefense.map((row)=><div className="nfl-position-defense-row" key={row.stat}><div><span>{row.label}</span><small>{row.value} / game · league avg {row.leagueMean}</small></div><div className={`nfl-position-defense-bar ${row.percentile>=60?'good':row.percentile<=40?'bad':''}`}><i style={{width:`${row.percentile}%`}}/><strong>{row.percentile}<small>th</small></strong></div></div>)}<small className="nfl-quote-time">Higher percentile = more of this volume historically allowed to the position. Not a projection.</small></div>}
    {available.length>0&&<div className="nfl-factor-list">{available.map(([key,[label,Icon]])=>{const item=data.components[key];return <details key={key}><summary><Icon size={18}/><span>{label}</span><strong>{Math.round(item.score)}</strong></summary><div className="nfl-factor-body">{(item.contributors||[]).map((input,i)=><div className="nfl-evidence-row" key={i}><span>{METRICS[input.feature]||input.feature.replaceAll('_',' ')}</span><strong>{metricText(input.feature,input.value)}</strong><small>{input.sample} plays</small></div>)}</div></details>;})}</div>}
    {unavailable.length>0&&<details className="nfl-factor-list nfl-matchup-unsupported"><summary><span>{unavailable.length} components not used for this prop</span></summary><div className="nfl-factor-body">{unavailable.map(([key,[label]])=><div className="nfl-evidence-row" key={key}><span>{label}</span><small>{data.components[key]?.reason||'Not applicable to this prop'}</small></div>)}</div></details>}
    {data.history?.usesPriorSeason&&<small className="nfl-quote-time">Includes {data.history.seasons.join(' / ')} games.</small>}

  </section>;
}
