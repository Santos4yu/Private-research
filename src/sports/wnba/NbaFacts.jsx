// Small cards on the NBA matchup page's Overview (Oct 27, the owner picked
// them): how his PrizePicks lines moved tonight, how often he's gone over
// tonight's line at home and on the road, his minutes and shot volume
// lately, and both teams' rest.
import React,{useMemo,useState} from 'react';
import {ArrowRight,ArrowUpDown,Ban,BedDouble,ChevronDown,CircleCheck,Clock3,House,Minus,Timer,TrendingDown,TrendingUp} from 'lucide-react';
import {Card,Loading,teamName} from './NbaScout';
import {finite,fmt,realGames,useWnba} from './wnba-research';
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

// ------------------------------------------------------------ Line movement
// Oct 27, the owner: "more sleek and compact ... actual icons and logos ...
// premium like polished". Tonight's PrizePicks lines that moved as one
// list (an up / down / pulled mark, the number now and where it opened, a
// small step chart of its path, each move's time on a tap), the steady ones
// as chips. The by-game history was taken off at the same time.
// The server's names (line_moves.norm): lower case letters and digits.
const norm=value=>String(value||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');
// A move belongs to tonight's game when its start is within a few hours of it.
const SAME_GAME=3*3600e3;
const clock={hour:'numeric',minute:'2-digit'};
const timeOf=at=>new Date(at).toLocaleTimeString([],clock);
const ago=at=>{const minutes=Math.round((Date.now()-Date.parse(at||''))/60000);
 return !finite(minutes)?null:minutes<1?'just now':minutes<60?`${minutes}m ago`:minutes<1440?`${Math.round(minutes/60)}h ago`:null;};
const PRIZEPICKS_LOGO='/prizepicks/logo.png';
// The line's path through the day as steps, each move one step along.
function Steps({values,tone}){
 const width=54,height=22,pad=3;
 const low=Math.min(...values),high=Math.max(...values),y=value=>high===low?height/2:pad+(high-value)/(high-low)*(height-2*pad);
 const step=width/Math.max(1,values.length);
 const path=values.map((value,index)=>`${index?`H${(index*step).toFixed(1)}V`:'M0 '}${y(value).toFixed(1)}`).join('')+`H${width}`;
 return <svg className="nf-steps" data-tone={tone} viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
  <path d={path} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  <circle cx={width-1.5} cy={y(values.at(-1))} r="2.5"/></svg>;
}
export function LineMovement({row,lines}){
 // His standard lines tonight, one a stat, the page's own first.
 const offered=useMemo(()=>{
  const seen=new Map();
  for(const item of [row,...(lines||[])]){
   const key=norm(item.market);
   if(key&&!seen.has(key)&&(item.modifier||'standard')==='standard'&&finite(item.line))seen.set(key,item);
  }
  return [...seen.values()];
 },[row,lines]);
 const history=useWnba('line-history',{player:row.player,league:'nba'},Boolean(row.player));
 const [opened,setOpened]=useState(null);
 const pageKey=norm(row.market);
 const tonight=useMemo(()=>{
  const start=Date.parse(row.startsAt||'');
  const moves=(history.data?.moves||[]).filter(move=>Math.abs(Date.parse(move.startsAt||'')-start)<SAME_GAME)
   .sort((a,b)=>String(a.at).localeCompare(String(b.at)));
  // A line pulled tonight is off the board: it comes from its moves.
  const gone=[...new Map(moves.filter(move=>!offered.some(item=>norm(item.market)===norm(move.stat))).map(move=>[norm(move.stat),move])).values()]
   .map(move=>({market:move.stat,line:null}));
  return [...offered,...gone].map(item=>{
   const key=norm(item.market),mine=moves.filter(move=>norm(move.stat)===key),changes=mine.filter(move=>move.kind==='line');
   const open=changes.length?changes[0].from:item.line,now=finite(item.line)?item.line:changes.length?changes.at(-1).to:mine[0]?.from;
   const pulled=mine.find(move=>move.kind==='pulled');
   return {item,key,moves:mine,open,now,pulled,path:[open,...changes.map(move=>move.to)].filter(finite),change:finite(open)&&finite(now)?Math.round((now-open)*10)/10:0};
  });
 },[history.data,offered,row.startsAt]);
 if(!row.player)return null;
 const head=<span className="nf-src"><img src={PRIZEPICKS_LOGO} alt="" width="16" height="16"/>PrizePicks{ago(history.data?.checked)&&<em>· {ago(history.data.checked)}</em>}</span>;
 if(history.loading&&!history.data)return <Card title="Line movement" note={head} icon={ArrowUpDown}><Loading/></Card>;
 const moved=tonight.filter(entry=>entry.moves.length).sort((a,b)=>(b.key===pageKey)-(a.key===pageKey));
 const steady=tonight.filter(entry=>!entry.moves.length);
 return <Card title="Line movement" note={head} icon={ArrowUpDown} className="nf-moves">
  {moved.length?<ul className="nf-mv-list">{moved.map((entry,index)=>{
   const open=opened===entry.key,tone=entry.pulled?'pulled':entry.change>0?'up':entry.change<0?'down':'flat';
   const Mark=entry.pulled?Ban:entry.change>0?TrendingUp:entry.change<0?TrendingDown:Minus;
   const last=entry.moves.at(-1),count=entry.moves.filter(move=>move.kind==='line').length;
   return <li key={entry.key} data-page={entry.key===pageKey||undefined} data-tone={tone} style={{'--n':index}}>
    <button type="button" aria-expanded={open} onClick={()=>setOpened(open?null:entry.key)}>
     <span className="nf-mv-mark"><Mark size={15} aria-hidden="true"/></span>
     <span className="nf-mv-what"><b>{entry.item.market}</b>
      <small><Clock3 size={11} aria-hidden="true"/>{entry.pulled?`Pulled ${timeOf(entry.pulled.at)}`:`${count} ${count===1?'move':'moves'} · ${timeOf(last.at)}`}</small></span>
     {entry.path.length>1&&!entry.pulled&&<Steps values={entry.path} tone={tone}/>}
     <span className="nf-mv-now"><b>{fmt(entry.now,1)}</b>
      <small>{entry.pulled?'Off the board':`${entry.change>0?'+':entry.change<0?'−':''}${fmt(Math.abs(entry.change),1)} from ${fmt(entry.open,1)}`}</small></span>
     <ChevronDown className="nf-mv-more" size={15} aria-hidden="true"/>
    </button>
    {open&&<ol className="nf-mv-times">{entry.moves.map((move,step)=><li key={step} data-kind={move.kind}>
     <time dateTime={move.at}>{timeOf(move.at)}</time>
     {move.kind==='pulled'?<span>Pulled at <b>{fmt(move.from,1)}</b></span>
      :<span>{fmt(move.from,1)}<ArrowRight size={12} aria-hidden="true"/><b>{fmt(move.to,1)}</b></span>}
    </li>)}</ol>}
   </li>;})}</ul>
  :<p className="nf-mv-none"><CircleCheck size={15} aria-hidden="true"/>None of his lines have moved since they went up.</p>}
  {steady.length>0&&<div className="nf-steady"><span className="nf-steady-label"><Minus size={12} aria-hidden="true"/>Steady</span>
   {steady.map(entry=><span key={entry.key} className="nf-chip" data-page={entry.key===pageKey||undefined}>{entry.item.market}<b>{fmt(entry.now,1)}</b></span>)}</div>}
 </Card>;
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
