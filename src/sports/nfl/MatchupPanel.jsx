import React from 'react';
import {teamLogoUrl} from './nfl-ui-core';
import {Activity, Shield, TrendingDown, TrendingUp} from 'lucide-react';

const COMPONENTS = {defenseQuality:'Team defense',coverageFit:'Pass defense',trenchFit:'Pass rush',pressureInteraction:'Pressure and sacks',yacFit:'Yards after catch',explosiveFit:'Explosive plays',runSchemeFit:'Run defense'};
const METRICS = {offense_sack_rate:'Offensive sack rate',pass_epa:'EPA allowed per dropback',pass_success:'Pass success rate allowed',ypa:'Yards per attempt allowed',completion_rate:'Completion rate allowed',cpoe:'CPOE allowed',pass_explosive:'Explosive pass rate allowed',yac_per_reception:'YAC per reception allowed',sack_rate:'Defensive sack rate',scramble_rate:'QB scramble rate allowed',run_epa:'EPA allowed per rush',run_success:'Rush success rate allowed',ypc:'Yards per carry allowed',run_explosive:'Explosive run rate allowed',stuff_rate:'Run stuff rate',adot:'Average target depth faced'};
const PERCENT=new Set(['pass_success','completion_rate','catch_rate','pass_explosive','sack_rate','scramble_rate','run_success','run_explosive','stuff_rate','offense_sack_rate']);
const metricText=(key,value)=>!Number.isFinite(value)?'—':PERCENT.has(key)?`${(value*100).toFixed(1)}%`:value.toFixed(key.includes('epa')?3:2);
const ordinal=value=>{const n=Math.max(1,Math.round(value));const mod=n%100;return `${n}${mod>=11&&mod<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th'}`;};
const defenseRank=row=>Math.max(1,row.teams-Math.round((row.percentile/100)*(row.teams-1)));
const strength=rank=>rank<=8?['Tough','tough']:rank>=25?['Easy','easy']:['Neutral','neutral'];

function PositionRow({row}) {
  const rank=defenseRank(row); const [label,tone]=strength(rank);
  return <article className="nfl-defense-rank-row">
    <div><strong>{row.label}</strong><small>{row.value} allowed/game · NFL avg {row.leagueMean}</small></div>
    <div className="nfl-defense-rank-track" aria-label={`${row.label}: ${ordinal(rank)} of ${row.teams}`}><i style={{width:`${Math.max(4,Math.min(96,100-row.percentile))}%`}} /></div>
    <b>{ordinal(rank)}</b><span className={tone}>{label}</span>
  </article>;
}

export function NFLMatchupPanel({resource,selectedProp}) {
  const data=resource?.data;
  if(resource?.status==='LOADING') return <section className="nfl-defense-card" role="status"><div className="nfl-defense-title"><Shield/><div><span>Opponent defense</span><h3>Loading defensive context…</h3></div></div></section>;
  if(!data) return <section className="nfl-defense-card"><h3>Opponent defense unavailable</h3><p>Refresh this player to try the defensive sources again.</p></section>;
  const positionRows=data.positionDefense||[];
  const componentRows=Object.entries(data.components||{}).filter(([key,item])=>COMPONENTS[key]&&Array.isArray(item?.contributors)&&item.contributors.length);
  return <section className="nfl-defense-page">
    <header className="nfl-defense-card nfl-defense-hero"><div className="nfl-defense-title">{data.opponentId&&<img src={teamLogoUrl(data.opponentId)} alt="" width="44" height="44"/>}<div><span>Opponent research</span><h3>{data.opponentId||'Opponent'} defense</h3><p>Ranks and values only—no combined matchup grade.</p></div></div><div className="nfl-defense-prop"><Activity size={16}/><span>Viewing context for</span><strong>{selectedProp.label}</strong></div></header>
    <section className="nfl-defense-card"><div className="nfl-defense-section-head"><div><span>Defense vs position</span><h3>{positionRows[0]?.position||'Position'} production allowed</h3></div><small>Lower rank = tougher defense</small></div>{positionRows.length?<div className="nfl-defense-rank-list">{positionRows.map(row=><PositionRow row={row} key={row.stat}/>)}</div>:<p className="nfl-defense-empty">Position-level ranks are not available for this player yet.</p>}</section>
    {componentRows.length>0&&<section className="nfl-defense-card"><div className="nfl-defense-section-head"><div><span>Team defense</span><h3>Advanced defensive results</h3></div><small>Prior games only</small></div><div className="nfl-defense-metrics">{componentRows.flatMap(([key,item])=>item.contributors.map((input,index)=><article key={`${key}-${input.feature}-${index}`}><span>{METRICS[input.feature]||input.feature.replaceAll('_',' ')}</span><strong>{metricText(input.feature,input.value)}</strong><small>{input.sample} plays · {COMPONENTS[key]}</small></article>))}</div></section>}
    {(data.edges?.length>0||data.risks?.length>0)&&<section className="nfl-defense-card nfl-defense-notes"><div>{data.edges?.length>0&&<><h4><TrendingUp size={16}/> More allowed</h4>{data.edges.map((item,index)=><p key={index}>{item.text}</p>)}</>}</div><div>{data.risks?.length>0&&<><h4><TrendingDown size={16}/> Less allowed</h4>{data.risks.map((item,index)=><p key={index}>{item.text}</p>)}</>}</div></section>}
    <p className="nfl-defense-footnote">Ranks describe what the opponent allowed before this game. They are research context, not a projection or probability.</p>
  </section>;
}
