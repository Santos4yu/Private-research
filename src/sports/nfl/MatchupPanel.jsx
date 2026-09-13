import React from 'react';
import {teamLogoUrl} from './nfl-ui-core';
import { Activity, Shield, Crosshair, TrendingUp, AlertTriangle, Layers, CloudSun, UsersRound } from 'lucide-react';

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
  return <section className="nfl-panel-stack nfl-matchup-app">
    <article className="nfl-matchup-hero">{data.opponentId&&<div className="nfl-matchup-opponent"><img src={teamLogoUrl(data.opponentId)} width="28" height="28" alt={`${data.opponentId} logo`}/><span>vs {data.opponentId}</span></div>}<div className="nfl-matchup-heading"><div><span>{selectedProp.label}</span><h3>{quality!=null?'Matchup score':volume?'Opponent volume':'Matchup'}</h3></div><strong>{score==null?'—':Math.round(score)}{score!=null&&<small>/100</small>}</strong></div>{score!=null&&<div className="nfl-fit-track"><i style={{width:`${score}%`}}/></div>}<div className="nfl-matchup-meta"><span>{quality!=null?grade:volume?'Historical percentile':'Scored evidence unavailable'}</span><span>{quality!=null?`${Math.round(data.dataCoverage)}% coverage`:volume?`${volume.games} games · ${volume.teams} teams`:''}</span></div>{volume&&quality==null&&<><p>{volume.label}</p><div className="nfl-volume-comparison"><span>Opponent <b>{volume.value.toFixed(1)}</b></span><span>League <b>{volume.leagueMean.toFixed(1)}</b></span></div><small>Higher = more opposing volume. Your player’s role still matters.</small></>}{quality!=null&&<small>{data.dataCoverage<50?'Limited evidence · ':''}50 is neutral · not hit probability</small>}</article>
    {available.length>0&&<div className="nfl-factor-list">{available.map(([key,[label,Icon]])=>{const item=data.components[key];return <details key={key}><summary><Icon size={18}/><span>{label}</span><strong>{Math.round(item.score)}</strong></summary><div className="nfl-factor-body">{(item.contributors||[]).map((input,i)=><div className="nfl-evidence-row" key={i}><span>{METRICS[input.feature]||input.feature.replaceAll('_',' ')}</span><strong>{metricText(input.feature,input.value)}</strong><small>{input.sample} plays</small></div>)}</div></details>;})}</div>}
    {data.history?.usesPriorSeason&&<small className="nfl-quote-time">Includes {data.history.seasons.join(' / ')} games.</small>}

  </section>;
}
