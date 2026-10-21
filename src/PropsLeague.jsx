// The Props tab's league switch: MLB (the bot's board, app.js) or NBA
// (NbaMatchups). Mounted only for someone the NBA side is switched on for
// (site-access-core.js canUsePropsLeague); the choice is kept per device.
import React,{Suspense,lazy,useEffect,useState} from 'react';
import {LEAGUE_LOGOS} from './league-logos';
import './nba-matchups.css';

const NbaMatchups=lazy(()=>import('./NbaMatchups').then(module=>({default:module.NbaMatchups})));
const KEY='propscout:props-league';
const LEAGUES=[['nba','NBA'],['mlb','MLB']];
function remembered(){try{return localStorage.getItem(KEY)==='mlb'?'mlb':'nba';}catch{return 'nba';}}

export function PropsLeague(){
 const [league,setLeague]=useState(remembered);
 useEffect(()=>{
  const panel=document.getElementById('panel-v2');
  if(panel)panel.dataset.league=league;
  try{localStorage.setItem(KEY,league);}catch{/* kept for this visit only */}
  return()=>{if(panel)delete panel.dataset.league;};
 },[league]);
 return <>
  <div className="nm-league" role="group" aria-label="League">
   {LEAGUES.map(([key,name])=><button type="button" key={key} aria-pressed={league===key} onClick={()=>setLeague(key)}>
    <img src={LEAGUE_LOGOS[key]} alt="" width="18" height="18"/>{name}</button>)}
  </div>
  {league==='nba'&&<Suspense fallback={null}><NbaMatchups/></Suspense>}
 </>;
}
