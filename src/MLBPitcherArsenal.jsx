import React,{useEffect,useState} from 'react';
import {ChartPie,Users} from 'lucide-react';
import {createMLBContextClient,pitchTypeStats,statText,lineupState} from './mlb-finder-research';

const request=createMLBContextClient();
const colors=['#76edbc','#a28aff','#65cfff','#ffd27c','#ff8797','#709dff'];
export default function MLBPitcherArsenal({data}){
 const [selected,setSelected]=useState('all'),[state,setState]=useState({}),[retry,setRetry]=useState(0);
 const params=data.teamInsightsParams;
 useEffect(()=>{let active=true;setState({loading:true});setSelected('all');if(!params){setState({});return;}request('/api/team-insights',{...params,detail:'arsenal'}).then(value=>{if(active)setState({data:value});}).catch(()=>{if(active)setState({error:true});});return()=>{active=false;};},[params,retry]);
 const pitches=(data.pitchArsenal||[]).filter(p=>Number(p.pct)>0);
 let cursor=0;const gradient=pitches.map((p,i)=>{const start=cursor;cursor+=Number(p.pct);return `${colors[i%colors.length]} ${start}% ${cursor}%`;});
 if(cursor<100)gradient.push(`#263049 ${cursor}% 100%`);
 const rows=state.data?.pitchRows||[];
 return <>
  <section className="mlb-context-card"><header><h2><ChartPie size={16} aria-hidden="true"/>Pitcher's arsenal</h2><small>{data.starterProfile?.name} · {data.starterProfile?.hand}HP</small></header>
   {pitches.length?<div className="mlb-arsenal-summary"><div className="mlb-arsenal-ring" style={{background:`conic-gradient(${gradient.join(',')})`}} role="img" aria-label={pitches.map(p=>`${p.name} ${p.pct}%`).join(', ')}><span>{data.researchSeason}</span></div><ul>{pitches.map((p,i)=><li key={p.code}><i style={{background:colors[i%colors.length]}}/><span>{p.name}<small className="mlb-pitch-speed">{statText(p.speed,1)} mph</small></span><b>{statText(p.pct,1)}%</b></li>)}</ul></div>:<p className="mlb-context-note">Pitch usage is not available yet.</p>}
  </section>
  <section className="mlb-context-card"><header><h2><Users size={16} aria-hidden="true"/>Opposing hitters vs pitch arsenal</h2><small>{data.teamInsightsTeamName}</small></header>
   <div className="mlb-context-switch" aria-label="Pitch type"><button type="button" aria-pressed={selected==='all'} onClick={()=>setSelected('all')}>All</button>{pitches.map((p,i)=><button type="button" key={p.code} aria-pressed={selected===p.code} title={p.name} onClick={()=>setSelected(p.code)} style={{color:colors[i%colors.length]}}>{p.code}</button>)}</div>
   {state.loading?<p className="mlb-context-note" role="status">Preparing pitch-type matchups…</p>:state.error?<p className="mlb-context-note">Pitch-type results are temporarily unavailable. <button type="button" onClick={()=>setRetry(n=>n+1)}>Retry</button></p>:rows.length?<>
    <p className="mlb-context-note">{lineupState(state.data)}</p>
    <div className="mlb-context-table-wrap"><table><thead><tr>{['Hitter','PA','Pitches','K%','wOBA'].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map(p=>{const s=pitchTypeStats(p,selected);return <tr key={p.id}><th scope="row"><span className="mlb-context-batter">{(state.data.lineupConfirmed||state.data.lineupProjected)&&<small>{p.order}</small>}<span>{p.name}<small>{p.position}</small></span></span></th><td>{statText(s.pa)}</td><td>{statText(s.pitches)}</td><td>{statText(s.k_pct,1)}{s.k_pct!=null?'%':''}</td><td>{statText(s.woba,3)}</td></tr>;})}</tbody></table></div>
   </>:<p className="mlb-context-note">Pitch-type results are not available for this lineup yet.</p>}
  </section>
 </>;
}
