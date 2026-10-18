import React,{useEffect,useState} from 'react';
import {HeartPulse,CalendarClock,UserRound} from 'lucide-react';
import {createMLBContextClient} from './mlb-finder-research';
import {Failure} from './AdminNotice';
const request=createMLBContextClient();
const aliases={ATH:'OAK',WSH:'WSN',CWS:'CHW',AZ:'ARI'};
const key=value=>{const text=String(value||'').trim().toUpperCase();return aliases[text]||text;};
export function findInjuryTeam(teams,values){return teams.find(t=>values.some(v=>v&&(key(t.abbr)===key(v)||key(t.name)===key(v))));}
export function injuryDate(value){if(!value)return '';const date=new Date(String(value).slice(0,10)+'T12:00:00Z');return Number.isNaN(date.getTime())?'':date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});}
export default function MLBInjuries({row,data}){
 const [state,setState]=useState({loading:true}),[side,setSide]=useState(0),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setState({loading:true});request('/api/team-insights',{detail:'injuries'}).then(result=>{if(active)setState({data:result});}).catch(()=>{if(active)setState({error:true});});return()=>{active=false;};},[retry]);
 useEffect(()=>setSide(0),[row.team,row.teamAbbr,row.opponent]);
 const teams=state.data?.teams||[];
 const choices=[{label:row.teamAbbr||row.team||data?.team||'Player team',values:[row.teamAbbr,row.team,data?.team]},
  {label:row.opponent||data?.matchup?.opponent||'Opponent',values:[row.opponent,data?.matchup?.opponent]}];
 const selected=findInjuryTeam(teams,choices[side].values);
 return <section className="mlb-context-card mlb-injuries"><header><h2><HeartPulse size={16} aria-hidden="true"/>Injuries</h2><small>Current report</small></header>
  <div className="mlb-context-switch" aria-label="Injury report team">{choices.map((choice,index)=>{const team=findInjuryTeam(teams,choice.values);return <button type="button" key={index} aria-pressed={side===index} onClick={()=>setSide(index)}>{team?.logo&&<img src={team.logo} alt="" width="20" height="20"/>}{team?.abbr||choice.label}</button>;})}</div>
  {state.loading?<div className="mlb-context-skeleton" role="status" aria-label="Loading injuries"><span/><span/><span/></div>:state.error?<Failure onRetry={()=>setRetry(n=>n+1)} quiet="No injury report for this game yet.">Injury report is temporarily unavailable.</Failure>:!selected?<p className="mlb-context-note">No injury report is available for this team.</p>:!selected.players.length?<p className="mlb-context-note">No injuries listed in the current report.</p>:<div className="mlb-injury-list">{selected.players.map(player=><article className="mlb-injury-card" key={player.id}>
   <div className="mlb-injury-heading"><span className="mlb-injury-avatar"><UserRound size={26} aria-hidden="true"/>{player.photo&&<img src={player.photo} alt="" width="48" height="48" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span><div><h3>{player.name}</h3><small>{player.position}</small></div><span className="mlb-injury-status" data-day={player.status==='Day-To-Day'}>{player.status.replaceAll('-',' ')}</span></div>
   <p className="mlb-injury-reason">{player.reason}</p>
   <div className="mlb-injury-return"><CalendarClock size={15} aria-hidden="true"/><span>{injuryDate(player.expectedReturn)?`Estimated return · ${injuryDate(player.expectedReturn)}`:'Return timetable not reported'}</span></div>
   {injuryDate(player.reportedAt)&&<small className="mlb-injury-reported">Reported {injuryDate(player.reportedAt)}</small>}
  </article>)}</div>}
 </section>;
}
