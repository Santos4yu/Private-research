import React from 'react';
import {CloudSun} from 'lucide-react';
import './football-weather.css';

// The kickoff weather card on the NFL and college football player pages
// (football_weather.py): the forecast over the game, and what it does to
// passing, kicking and the run game. The same levels feed the grades in
// the Slip Analyzer, Parlay Builder and the bot (src/slip-matchup.js).
const ROOF={dome:"Played under a roof, so the weather won't matter.",
 retractable:"Retractable roof. Teams close it when the weather turns, so the weather won't matter."};
const PASSING=['No effect','Slows it a little','Hurts it','Hurts it a lot'];
const KICKING=['No effect','Shortens range a little','Hurts it','Hurts it a lot'];

function Card({note,children}){
 return <section className="mlb-context-card football-weather"><header><h2><CloudSun size={16} aria-hidden="true"/>Kickoff weather</h2>{note&&<small>{note}</small>}</header>{children}</section>;
}
const Note=({children})=><p className="mlb-context-note">{children}</p>;

/** state: a useNfl/useCfb request for the week's weather; gameId or team picks the game. */
export default function FootballWeather({state,gameId,team}){
 const data=state?.data;
 const game=data?.games?.[gameId]||data?.games?.[data?.teams?.[team]];
 if(!game){
  if(state?.loading)return <Card><div className="mlb-context-skeleton" role="status" aria-label="Loading weather"><span/><span/></div></Card>;
  return <Card><Note>{state?.error?'Weather is temporarily unavailable.':'The forecast for this game is not out yet.'}</Note></Card>;
 }
 if(game.covered)return <Card note={game.venue}><Note>{ROOF[game.roof]||ROOF.dome}</Note></Card>;
 if(!game.available)return <Card note={game.venue}><Note>{game.message||'Weather is temporarily unavailable.'}</Note></Card>;
 const rain=game.snow?'Snow':game.rainMm>=2.5?'Heavy':game.rainMm>=0.5?'Likely':game.rainMm>0?'Light':'None';
 return <Card note={game.venue}>
  {game.flags?.length>0&&<div className="football-weather-flags">{game.flags.map(flag=><span key={flag.key} data-level={flag.level}>{flag.label}</span>)}</div>}
  <dl className="football-weather-grid">
   <div><dt>Conditions</dt><dd>{game.conditions||'—'}</dd></div>
   <div><dt>Temperature</dt><dd>{game.tempF!=null?`${game.tempF}°F`:'—'}{game.lowF!=null&&game.lowF<game.tempF&&<small>Low {game.lowF}°F</small>}</dd></div>
   <div><dt>Wind</dt><dd>{game.windMph!=null?`${game.windMph} mph`:'—'}{game.gustMph>game.windMph&&<small>Gusts {game.gustMph} mph</small>}</dd></div>
   <div><dt>Rain or snow</dt><dd>{rain}{game.chance!=null&&<small>{game.chance}% chance</small>}</dd></div>
  </dl>
  <dl className="football-weather-effects">
   <div data-level={game.passing}><dt>Passing</dt><dd>{PASSING[game.passing]||PASSING[0]}</dd></div>
   <div data-level={game.kicking}><dt>Kicking</dt><dd>{KICKING[game.kicking]||KICKING[0]}</dd></div>
   <div data-level={game.run?'up':0}><dt>Run game</dt><dd>{game.run?'More runs':'No effect'}</dd></div>
  </dl>
  <small className="football-weather-credit">{game.credit||data?.credit}</small>
 </Card>;
}
