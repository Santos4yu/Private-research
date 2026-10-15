import React,{useEffect,useMemo,useState} from 'react';
import {createMLBContextClient,statText} from './mlb-finder-research';
import {propFocus} from './prop-focus';
import PropFocusTag from './PropFocusTag';
const request=createMLBContextClient();
const metrics=[['record','Record'],['inningsPitched','Innings pitched'],['era','Earned runs allowed per 9',2],['kPer9','Strikeouts per 9',2],['whip','Walks + hits per inning pitched',2],['hrPer9','Home runs allowed per 9',2],['avgAgainst','Batting average against',3],['opsAgainst','OPS against',3]];
function format(p,key,digits){return key==='record'?p.wins!=null&&p.losses!=null?`${p.wins}–${p.losses}`:'—':statText(p[key],digits);}
function tone(key,value,base){if(['record','inningsPitched'].includes(key)||value==null||base==null||value===''||base===''||!Number.isFinite(Number(value))||!Number.isFinite(Number(base))||Number(value)===Number(base))return 'neutral';return (key==='kPer9'?Number(value)>Number(base):Number(value)<Number(base))?'good':'poor';}
export default function MLBStarterComparison({data,row}){
 const p=data.starterProfile||{},[state,setState]=useState({}),[retry,setRetry]=useState(0);
 // The rows behind the line being researched lead, lit up (prop-focus.js).
 const focus=useMemo(()=>propFocus(row),[row]);
 // For batter props the starter faces the batter's own team, not his own club.
 const opponentId=data.isPitcherProp?data.opponentTeamId:data.teamInsightsParams?.teamId;
 const opponentName=data.isPitcherProp?data.matchup?.opponent:data.teamInsightsTeamName;
 useEffect(()=>{let active=true;setState({loading:true});if(!p.id||!data.researchSeason){setState({});return;}request('/api/team-insights',{detail:'pitcher-comparisons',pitcherId:p.id,teamId:opponentId,season:data.researchSeason}).then(value=>{if(active)setState({data:value});}).catch(()=>{if(active)setState({error:true});});return()=>{active=false;};},[p.id,opponentId,data.researchSeason,retry]);
 const season=state.data?.season||p;
 const columns=[['season',data.researchSeason||'Season'],['opponent','vs opponent'],['left','vs LHB'],['right','vs RHB']];
 return <section className="mlb-context-card mlb-starter-card mlb-starter-comparison"><header><h2>{data.isPitcherProp?'Starting pitcher':'Opposing starter'}</h2><span className="mlb-starter-season">{data.researchSeason||'Season'}</span></header><div className="mlb-starter-scroll" tabIndex={0} role="region" aria-label="Pitcher split comparison"><table className="mlb-starter-table"><thead><tr><th scope="col"><span className="mlb-starter-identity">{p.id&&<img className="mlb-context-photo" src={`https://img.mlbstatic.com/mlb-photos/image/upload/w_100,q_auto:best/v1/people/${p.id}/headshot/silo/current`} alt="" width="26" height="26"/>}<strong>{p.name||'Starter pending'}</strong><small>{['R','L'].includes(p.hand)?p.hand+'HP':''}</small></span></th>{columns.map(([key,label])=><th scope="col" key={key} title={key==='opponent'?opponentName:undefined}>{label}</th>)}</tr></thead><tbody>{focus.order(metrics,([key])=>key).map(([key,label,digits])=>{const f=focus.of(key);return <tr key={key} data-focus={f||undefined}><th scope="row"><span className="prop-focus-label">{label}<PropFocusTag focus={f}/></span></th>{columns.map(([column])=>{const values=column==='season'?season:state.data?.[column]||{};const band=column==='season'?'neutral':tone(key,values[key],season[key]);return <td key={column} data-tone={band} title={band==='neutral'?'':`${band==='good'?'Better':'Worse'} for pitcher than season`}><span>{band==='good'?'↑ ':band==='poor'?'↓ ':''}{format(values,key,digits)}</span></td>;})}</tr>;})}</tbody></table></div>
 {opponentName&&<p className="mlb-context-note">Opponent comparison: {opponentName} · {data.researchSeason}</p>}
 {state.loading&&<p className="mlb-context-note" role="status">Loading comparisons…</p>}{state.error&&<p className="mlb-context-note" role="status">Comparisons unavailable. <button type="button" onClick={()=>setRetry(n=>n+1)}>Retry</button></p>}
 <footer className="mlb-starter-footer"><span className="mlb-pitch-good">↑ Better for pitcher</span><span className="mlb-pitch-poor">↓ Worse for pitcher</span><span>Compared with season · — unavailable. Small splits can be volatile.</span></footer></section>;
}
