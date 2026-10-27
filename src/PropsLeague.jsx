// The Props tab's league switch: NBA or NFL matchups (NbaMatchups,
// NflMatchups) or MLB (the bot's board, app.js). Mounted for someone with
// either matchups side switched on (site-access-core.js canUsePropsLeague,
// main.jsx); each league shows only to whom it's on. The choice is kept per
// device.
import React,{Suspense,lazy,useEffect,useRef,useState} from 'react';
import {LEAGUE_LOGOS} from './league-logos';
import {canUsePropsLeague} from './site-access-core';
import {inkStyle,useInk} from './use-ink';
import './nba-matchups.css';

const NbaMatchups=lazy(()=>import('./NbaMatchups').then(module=>({default:module.NbaMatchups})));
const NflMatchups=lazy(()=>import('./NflMatchups').then(module=>({default:module.NflMatchups})));
const KEY='propscout:props-league';
const LEAGUES=[['nba','NBA'],['nfl','NFL'],['mlb','MLB']];
function remembered(){try{const kept=localStorage.getItem(KEY);return LEAGUES.some(([key])=>key===kept)?kept:'nba';}catch{return 'nba';}}

export function PropsLeague({leagues=['nba']}){
 // Who sees which league follows the site's settings as they change.
 const [open,setOpen]=useState(leagues);
 useEffect(()=>{
  const update=event=>setOpen(['nba','nfl'].filter(league=>canUsePropsLeague(event.detail,league)));
  window.addEventListener('vortex:site-policy',update);
  return()=>window.removeEventListener('vortex:site-policy',update);
 },[]);
 const shown=LEAGUES.filter(([key])=>key==='mlb'||open.includes(key));
 const [picked,setPicked]=useState(remembered);
 const league=shown.some(([key])=>key===picked)?picked:shown[0][0];
 useEffect(()=>{
  const panel=document.getElementById('panel-v2');
  if(panel)panel.dataset.league=league;
  try{localStorage.setItem(KEY,league);}catch{/* kept for this visit only */}
  return()=>{if(panel)delete panel.dataset.league;};
 },[league]);
 // The underline glides from league to league.
 const tabs=useRef(null),ink=useInk(tabs,`${league}|${shown.length}`);
 return <>
  <div className="nm-league" role="group" aria-label="League" ref={tabs}>
   {shown.map(([key,name])=><button type="button" key={key} aria-pressed={league===key} onClick={()=>setPicked(key)}>
    <img src={LEAGUE_LOGOS[key]} alt="" width="18" height="18"/>{name}</button>)}
   <i className="nm-ink" aria-hidden="true" style={inkStyle(ink)}/>
  </div>
  {league==='nba'&&<Suspense fallback={null}><NbaMatchups/></Suspense>}
  {league==='nfl'&&<Suspense fallback={null}><NflMatchups/></Suspense>}
 </>;
}
