// Small cards on the NBA matchup page's Overview (Oct 27, the owner picked
// them): how often he's gone over tonight's line at home and on the road,
// his minutes and shot volume lately, and both teams' rest.
import React,{useMemo} from 'react';
import {BedDouble,House,Timer} from 'lucide-react';
import {Card,teamName} from './NbaScout';
import {finite,fmt,realGames} from './wnba-research';
import {nextGameIn,restBefore} from '../../rest';

const mean=values=>{const kept=values.filter(finite);return kept.length?kept.reduce((sum,value)=>sum+value,0)/kept.length:null;};
const minutesOf=game=>finite(game.minutes)?game.minutes:game.box?.min;
const overTone=(over,games)=>finite(over)&&games?(over*2>=games?'good':'poor'):undefined;
// A recent average against the usual one: worth a colour from 12% and half a unit apart.
const changeTone=(value,usual)=>{
 if(!finite(value)||!(usual>0))return undefined;
 const change=value-usual;
 return Math.abs(change)>=0.5&&Math.abs(change)/usual>=0.12?(change>0?'good':'poor'):undefined;
};
// What "usual" means: this season once he has five games in it, else last season.
function usualGames(games){
 const seasons=[...new Set(games.map(game=>Number(game.season)).filter(finite))].sort((a,b)=>b-a);
 const now=games.filter(game=>Number(game.season)===seasons[0]);
 if(now.length>=5||seasons.length<2)return {games:now,label:'SZN'};
 return {games:games.filter(game=>Number(game.season)===seasons[1]),label:'Last SZN'};
}

// ------------------------------------------------------------ Home / away
// This season's games once there are ten, else both seasons the log holds.
const SPLIT_GAMES=10;
export function HomeAway({row,logs,short}){
 const stat=row.marketKey,line=finite(row.line)?row.line:null;
 const view=useMemo(()=>{
  const games=realGames(logs).filter(game=>finite(game.values?.[stat])&&typeof game.isHome==='boolean');
  if(!games.length)return null;
  const latest=Math.max(...games.map(game=>Number(game.season)).filter(finite));
  const now=games.filter(game=>Number(game.season)===latest),pool=now.length>=SPLIT_GAMES?now:games;
  const side=home=>{const values=pool.filter(game=>game.isHome===home).map(game=>game.values[stat]);
   return {games:values.length,avg:mean(values),over:line===null?null:values.filter(value=>value>line).length};};
  return {home:side(true),away:side(false),both:pool.some(game=>Number(game.season)!==latest)};
 },[logs,stat,line]);
 if(!view||!(view.home.games+view.away.games))return null;
 const tonightHome=row.teamAbbr&&row.homeTeamAbbr?row.teamAbbr===row.homeTeamAbbr:null;
 return <Card title="Home / away" note={`${short}${line===null?'':` over ${fmt(line,1)}`} · ${view.both?'last 2 seasons':'this season'}`} icon={House} className="nf-split">
  <div className="nf-sides">{[['Home',view.home,true],['Away',view.away,false]].map(([name,side,home])=>
   <div key={name} data-tonight={tonightHome===home||undefined}>
    <span className="nf-side-head"><small>{name}</small>{tonightHome===home&&<em>Tonight</em>}</span>
    {line===null||!side.games?<b>{fmt(side.avg,1)}</b>:<b data-tone={overTone(side.over,side.games)}>{side.over}/{side.games}</b>}
    <small>{side.games?`${line===null?'':`${Math.round(side.over/side.games*100)}% · `}avg ${fmt(side.avg,1)}`:'No games'}</small>
   </div>)}</div>
 </Card>;
}

// ------------------------------------------------------------ Minutes & shots
const VOLUME=[['min','Minutes'],['fga','Shots'],['tpa','Threes'],['fta','Free throws']];
const volumeOf=(game,key)=>key==='min'?minutesOf(game):game.box?.[key];
export function MinutesShots({logs}){
 const view=useMemo(()=>{
  const games=realGames(logs).filter(game=>minutesOf(game)>0);
  if(games.length<3)return null;
  const usual=usualGames(games),last10=games.slice(-10);
  return {usual,last5:games.slice(-5),last10,avg:mean(usual.games.map(minutesOf)),top:Math.max(40,...last10.map(minutesOf))};
 },[logs]);
 if(!view)return null;
 const rows=VOLUME.filter(([key])=>view.last10.some(game=>finite(volumeOf(game,key))));
 return <Card title="Minutes & shots" note="per game" icon={Timer} className="nf-volume">
  <div className="nf-min-head"><small>Minutes, last {view.last10.length}</small>{finite(view.avg)&&<small><i aria-hidden="true"/>{view.usual.label==='SZN'?'Season':'Last season'} {fmt(view.avg,1)}</small>}</div>
  <div className="nf-min-bars" style={{'--avg':finite(view.avg)?view.avg/view.top:0}}>
   {finite(view.avg)&&<i className="nf-min-avg" aria-hidden="true"/>}
   {view.last10.map((game,index)=>{const minutes=minutesOf(game);
    return <span key={game.gameId||index} style={{'--h':minutes/view.top,'--n':index}} data-tone={changeTone(minutes,view.avg)}
     aria-label={`${new Date(game.date).toLocaleDateString([],{month:'short',day:'numeric'})}: ${fmt(minutes,0)} minutes`}><b>{fmt(minutes,0)}</b><i/></span>;})}
  </div>
  <table className="nf-table"><thead><tr><th scope="col" aria-label="Stat"/><th scope="col">L5</th><th scope="col">L10</th><th scope="col">{view.usual.label}</th></tr></thead>
   <tbody>{rows.map(([key,label])=>{const usual=mean(view.usual.games.map(game=>volumeOf(game,key)));
    return <tr key={key}><th scope="row">{label}</th>
     {[view.last5,view.last10].map((games,index)=>{const value=mean(games.map(game=>volumeOf(game,key)));
      return <td key={index} data-tone={changeTone(value,usual)}>{fmt(value,1)}</td>;})}
     <td>{fmt(usual,1)}</td></tr>;})}</tbody></table>
 </Card>;
}

// ------------------------------------------------------------ Rest
const WEEKDAY={weekday:'short'};
export function RestCard({row,league}){
 const data=league.data,rest=data?.rest;
 const teams=[row.teamAbbr,row.opponent].filter(Boolean).map(abbr=>({abbr,before:restBefore(rest?.[abbr],row.startsAt),next:nextGameIn(rest?.[abbr],row.startsAt)}));
 if(!rest||!row.startsAt||!teams.some(team=>team.before))return null;
 return <Card title="Rest" icon={BedDouble} className="nf-rest">
  {teams.map(({abbr,before,next})=>{
   const off=before?before.days-1:null;
   const main=!before?'No recent games':before.backToBack?'Back-to-back':`${off} day${off===1?'':'s'} off`;
   const tone=before?.backToBack?'poor':before?.threeInFour?'fair':off>=2?'good':undefined;
   const last=before&&!before.backToBack?new Date(Date.parse(row.startsAt)-before.days*864e5).toLocaleDateString([],WEEKDAY):null;
   const notes=[before?.threeInFour&&'3rd game in 4 nights',last&&`Last played ${last}`,next===1&&'Plays again tomorrow'].filter(Boolean);
   return <div className="nf-rest-row" key={abbr}>
    {data.teams?.[abbr]?.logo?<img src={data.teams[abbr].logo} alt="" width="28" height="28"/>:<span aria-hidden="true"/>}
    <span className="nf-rest-team"><b>{teamName(data,abbr)}</b><small>{notes.join(' · ')}</small></span>
    <em data-tone={tone}>{main}</em>
   </div>;})}
 </Card>;
}
