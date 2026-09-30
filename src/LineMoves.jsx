import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Activity,ArrowDown,ArrowUp,ChevronDown,Grid2X2,RefreshCw,Search,X} from 'lucide-react';
import {LEAGUE_LOGOS} from './league-logos';
import {PhoneAccountButtons} from './UnifiedFinder';
import './line-moves.css';

// Line Moves: every change to a line the site sees, newest first
// (line_moves.py fills the list; /api/board?view=moves reads it). The page
// checks for new moves while it is open and on screen.
const POLL_MS=30000;
const APP_LOGOS={prizepicks:'/prizepicks/logo.png'};
const SPORT_NAMES={mlb:'MLB',nba:'NBA',wnba:'WNBA',nfl:'NFL',nhl:'NHL',soccer:'Soccer'};
const SOURCES=[['all','All'],['prizepicks','PrizePicks'],['books','Sportsbooks']];

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const signed=value=>(value>0?'+':value<0?'−':'')+Math.abs(value).toString();
const line=value=>finite(value)?String(value):'—';
const price=value=>finite(value)?(value>0?'+'+value:'−'+Math.abs(value)):'—';
const clock=time=>new Date(time).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
function ago(time,now){
 const minutes=Math.floor((now-time)/60000);
 if(minutes<1)return 'now';if(minutes<60)return minutes+'m';
 const hours=Math.floor(minutes/60);return hours<24?hours+'h':Math.floor(hours/24)+'d';
}
function day(time,now){
 const date=new Date(time),today=new Date(now);
 const start=value=>new Date(value.getFullYear(),value.getMonth(),value.getDate()).getTime();
 const diff=Math.round((start(today)-start(date))/86400000);
 return diff===0?'Today':diff===1?'Yesterday':date.toLocaleDateString([],{weekday:'long',month:'short',day:'numeric'});
}
// One prop's identity across its moves.
const propKey=move=>[move.sport,move.app,move.player,move.stat].join('|');
// Which way it went: a line up or down, or a price toward that side or away.
const direction=move=>(move.change||0)>0?'up':(move.change||0)<0?'down':'flat';

function Photo({src,alt='',fallback,...props}){
 const [bad,setBad]=useState(false);
 useEffect(()=>setBad(false),[src]);
 return src&&!bad?<img src={src} alt={alt} onError={()=>setBad(true)} {...props}/>:fallback;
}
function Face({move}){
 const initials=move.player.split(' ').map(part=>part[0]).slice(0,2).join('');
 return <span className="moves-face"><Photo src={move.headshot} width="40" height="40" loading="lazy" fallback={<b>{initials}</b>}/>
  <img className="moves-face-league" src={LEAGUE_LOGOS[move.sport]} alt="" width="16" height="16"/></span>;
}
function App({move}){
 const logo=APP_LOGOS[move.app]||'/sportsbooks/'+move.app+'.png';
 return <span className="moves-app" title={move.appName}><Photo src={logo} width="18" height="18" fallback={<i>{(move.appName||move.app).slice(0,2)}</i>}/><span>{move.appName||move.app}</span></span>;
}
function Change({move}){
 if(move.kind==='pulled')return <span className="moves-change" data-way="pulled">Pulled</span>;
 const way=direction(move);
 const Icon=way==='down'?ArrowDown:ArrowUp;
 return <span className="moves-change" data-way={way}>{way!=='flat'&&<Icon size={13} strokeWidth={2.6} aria-hidden="true"/>}
  {move.kind==='odds'?signed(move.change)+'%':signed(move.change)}</span>;
}
function Numbers({move}){
 if(move.kind==='pulled')return <span className="moves-numbers"><s>{line(move.from)}</s><ArrowRight/><em>Off the board</em></span>;
 if(move.kind==='odds')return <span className="moves-numbers"><small>{move.side==='under'?'U':'O'} {line(move.line)}</small><s>{price(move.from)}</s><ArrowRight/><b>{price(move.to)}</b></span>;
 return <span className="moves-numbers"><s>{line(move.from)}</s><ArrowRight/><b>{line(move.to)}</b></span>;
}
const ArrowRight=()=><svg className="moves-arrow" width="14" height="10" viewBox="0 0 14 10" aria-hidden="true"><path d="M1 5h11M8 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;

// A prop's moves in order, drawn as a step line with each move listed.
function History({moves,now}){
 const steps=[...moves].sort((a,b)=>a.time-b.time);
 const values=[steps[0].from,...steps.map(move=>move.to)].filter(finite);
 const low=Math.min(...values),high=Math.max(...values),span=high-low||1;
 const width=260,height=54,pad=6;
 const x=index=>pad+index*(width-2*pad)/Math.max(values.length-1,1);
 const y=value=>height-pad-(value-low)*(height-2*pad)/span;
 const path=values.map((value,index)=>(index?`H${x(index)}V${y(value)}`:`M${x(0)} ${y(value)}`)).join('');
 return <div className="moves-history">
  {steps[0].kind==='line'&&values.length>1&&<svg className="moves-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true"><path d={path}/>{values.map((value,index)=><circle key={index} cx={x(index)} cy={y(value)} r="3"/>)}</svg>}
  <ol>{[...steps].reverse().map(move=><li key={move.id}><time dateTime={move.at}>{clock(move.time)} <em>{ago(move.time,now)}</em></time><Numbers move={move}/><Change move={move}/></li>)}</ol>
 </div>;
}

function Row({move,count,open,onToggle,fresh,now,history}){
 return <li className={'moves-row'+(fresh?' is-new':'')+(open?' is-open':'')}>
  <button type="button" className="moves-row-main" aria-expanded={open} onClick={onToggle}>
   <time className="moves-time" dateTime={move.at}><b>{clock(move.time)}</b><span>{ago(move.time,now)}</span></time>
   <Face move={move}/>
   <span className="moves-who">
    <b>{move.player}</b>
    <span>{move.stat}{move.team?' · '+move.team+(move.opponent?' vs '+move.opponent:''):''}</span>
   </span>
   <Numbers move={move}/>
   <Change move={move}/>
   <App move={move}/>
   {count>1&&<span className="moves-count" title={count+' moves'}>{count}×</span>}
   <ChevronDown className="moves-chevron" size={16} aria-hidden="true"/>
  </button>
  {open&&<History moves={history} now={now}/>}
 </li>;
}

export function LineMoves(){
 const [data,setData]=useState({moves:[],checked:{},sports:[]});
 const [status,setStatus]=useState('loading');
 const [sport,setSport]=useState('all');
 const [source,setSource]=useState('all');
 const [query,setQuery]=useState('');
 const [open,setOpen]=useState(null);
 const [fresh,setFresh]=useState(()=>new Set());
 const [now,setNow]=useState(Date.now());
 const [active,setActive]=useState(()=>!document.getElementById('panel-moves')?.hidden);
 const seen=useRef(null);
 const busy=useRef(false);

 const load=useCallback(async()=>{
  if(busy.current)return;busy.current=true;
  try{
   const response=await fetch('/api/board?view=moves',{cache:'no-store',credentials:'same-origin'});
   const body=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(body.error||'unavailable');
   const moves=(body.moves||[]).map(move=>({...move,time:Date.parse(move.at)})).filter(move=>finite(move.time));
   // Moves that arrived since the last look get a brief highlight.
   if(seen.current)setFresh(new Set(moves.filter(move=>!seen.current.has(move.id)).map(move=>move.id)));
   seen.current=new Set(moves.map(move=>move.id));
   setData({moves,checked:body.checked||{},sports:body.sports||[]});
   setStatus('ready');
  }catch{setStatus(current=>current==='ready'?'ready':'error');}
  finally{busy.current=false;setNow(Date.now());}
 },[]);

 // Only while the page is the one on screen.
 useEffect(()=>{
  const sync=({detail})=>setActive(detail?.tab==='moves');
  window.addEventListener('vortex:dock-sync',sync);
  return()=>window.removeEventListener('vortex:dock-sync',sync);
 },[]);
 useEffect(()=>{
  if(!active)return undefined;
  load();
  const timer=setInterval(()=>{if(!document.hidden)load();},POLL_MS);
  const tick=setInterval(()=>setNow(Date.now()),15000);
  const wake=()=>{if(!document.hidden)load();};
  document.addEventListener('visibilitychange',wake);
  return()=>{clearInterval(timer);clearInterval(tick);document.removeEventListener('visibilitychange',wake);};
 },[active,load]);
 useEffect(()=>{if(!fresh.size)return undefined;const timer=setTimeout(()=>setFresh(new Set()),4000);return()=>clearTimeout(timer);},[fresh]);

 const byProp=useMemo(()=>{const groups=new Map();for(const move of data.moves){const key=propKey(move);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(move);}return groups;},[data.moves]);
 const shown=useMemo(()=>{
  const needle=query.trim().toLowerCase();
  return data.moves.filter(move=>(sport==='all'||move.sport===sport)
   &&(source==='all'||(source==='prizepicks')===(move.app==='prizepicks'))
   &&(!needle||move.player.toLowerCase().includes(needle)||String(move.stat).toLowerCase().includes(needle)));
 },[data.moves,sport,source,query]);
 const groups=useMemo(()=>{const out=[];for(const move of shown){const label=day(move.time,now);if(out.at(-1)?.label!==label)out.push({label,moves:[]});out.at(-1).moves.push(move);}return out;},[shown,now]);
 const summary=useMemo(()=>{
  const since=now-24*3600000,recent=shown.filter(move=>move.time>=since);
  return {total:recent.length,up:recent.filter(move=>direction(move)==='up').length,down:recent.filter(move=>direction(move)==='down').length};
 },[shown,now]);
 const checkedAt=useMemo(()=>Math.max(0,...Object.entries(data.checked).filter(([key])=>sport==='all'||key===sport).map(([,value])=>Date.parse(value)||0)),[data.checked,sport]);
 const sports=data.sports.filter(key=>SPORT_NAMES[key]);

 return <section className="line-moves" aria-labelledby="line-moves-title">
  <header className="moves-head">
   <div className="moves-title"><span className="moves-mark"><Activity size={18} aria-hidden="true"/></span><h1 id="line-moves-title">Line Moves</h1>
    <span className="moves-live" data-state={status}><i aria-hidden="true"/>{status==='error'?'Offline':'Live'}</span></div>
   <div className="moves-head-side">{checkedAt>0&&<span className="moves-updated">Updated {ago(checkedAt,now)==='now'?'just now':ago(checkedAt,now)+' ago'}</span>}
    <button type="button" className="moves-icon" aria-label="Check for new moves" onClick={load}><RefreshCw size={16}/></button><PhoneAccountButtons/></div>
  </header>

  <div className="moves-controls">
   <nav className="moves-sports" aria-label="Sport">
    {['all',...sports].map(key=><button type="button" key={key} aria-pressed={sport===key} onClick={()=>setSport(key)}>
     {key==='all'?<Grid2X2 size={15} aria-hidden="true"/>:<img src={LEAGUE_LOGOS[key]} alt="" width="16" height="16"/>}<span>{key==='all'?'All':SPORT_NAMES[key]}</span></button>)}
   </nav>
   <div className="moves-filter-row">
    <div className="moves-segment" role="group" aria-label="Source">
     {SOURCES.map(([key,label])=><button type="button" key={key} aria-pressed={source===key} onClick={()=>setSource(key)}>{label}</button>)}
    </div>
    <label className="moves-search"><Search size={15} aria-hidden="true"/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search player or stat" aria-label="Search player or stat"/>
     {query&&<button type="button" aria-label="Clear search" onClick={()=>setQuery('')}><X size={14}/></button>}</label>
   </div>
  </div>

  <div className="moves-summary" aria-label="Last 24 hours">
   <div><span>Moves · 24h</span><b>{summary.total}</b></div>
   <div data-way="up"><span>Up</span><b><ArrowUp size={15} strokeWidth={2.6} aria-hidden="true"/>{summary.up}</b></div>
   <div data-way="down"><span>Down</span><b><ArrowDown size={15} strokeWidth={2.6} aria-hidden="true"/>{summary.down}</b></div>
  </div>

  {status==='loading'&&<ul className="moves-list moves-skeleton" aria-hidden="true">{Array.from({length:6},(_,index)=><li key={index}/>)}</ul>}
  {status==='error'&&<div className="moves-empty"><Activity size={22} aria-hidden="true"/><b>Line moves are unavailable right now</b><button type="button" onClick={()=>{setStatus('loading');load();}}>Try again</button></div>}
  {status==='ready'&&!shown.length&&<div className="moves-empty"><Activity size={22} aria-hidden="true"/><b>{data.moves.length?'No moves match':'No line moves yet'}</b></div>}
  {status==='ready'&&groups.map(group=><div className="moves-group" key={group.label}>
   <h2>{group.label}</h2>
   <ul className="moves-list">{group.moves.map(move=><Row key={move.id} move={move} now={now} fresh={fresh.has(move.id)}
    count={byProp.get(propKey(move))?.length||1} history={byProp.get(propKey(move))||[move]}
    open={open===move.id} onToggle={()=>setOpen(current=>current===move.id?null:move.id)}/>)}</ul>
  </div>)}
 </section>;
}
