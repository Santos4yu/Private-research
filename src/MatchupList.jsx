// A Props tab league's list (NbaMatchups.jsx, NflMatchups.jsx): every prop
// PrizePicks posts in it with how often it has cleared its line lately and
// how good the opponent is for it, sortable either way. A row opens that
// player's matchup page; "Why" shows what made the score. `config` says
// which league: its stats, its lines (props-data.js), its score and page.
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ChevronDown,RefreshCw,Search,X} from 'lucide-react';
import {windowGames,windowRate} from './unified-finder-data';
import {Face} from './PickParts';
import './nba-matchups.css';

const SORTS=[['matchup','Matchup'],['hit','Hit %']];
const READS={defense:'Their defense',pace:'Their pace',position:'vs his position',attempts:'Threes they allow',rebounds:'Rebounds they allow',assists:'Assists they allow',turnovers:'Their turnovers'};
// What a read adds to (or takes from) the even 50.
const added=points=>`${points>0?'+':points<0?'−':''}${Math.abs(Math.round(points))} ${Math.abs(Math.round(points))===1?'point':'points'}`;
const figure=value=>Number.isInteger(Number(value))?String(Number(value)):Number(value).toFixed(1);
const when=iso=>{const time=Date.parse(iso||'');if(!Number.isFinite(time))return '';const date=new Date(time),today=new Date();
 const clock=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 return date.toDateString()===today.toDateString()?clock:`${date.toLocaleDateString([],{weekday:'short'})} ${clock}`;};
const gameOf=row=>`${row.awayTeamAbbr||''}@${row.homeTeamAbbr||''}|${row.startsAt||''}`;
const hitOf=row=>{const window=row.windows?.l10;const games=windowGames(window);return games?{rate:windowRate(window),hits:window.hits,games}:null;};

function Bar({value,tone}){
 return <span className="nm-bar" data-tone={tone||undefined}><i style={{width:`${Math.max(4,Math.min(100,value))}%`}}/></span>;
}

function Row({row,read,hit,open,onToggle,onOpen,short}){
 const home=row.teamAbbr&&row.teamAbbr===row.homeTeamAbbr;
 return <li className="nm-row" data-open={open||undefined}>
  <button type="button" className="nm-main" onClick={()=>onOpen(row)} aria-label={`Open ${row.player}'s ${short[row.marketKey]||row.market} matchup`}>
   <Face row={row}/>
   <span className="nm-who"><b>{row.player}</b>
    <small>{[row.position,row.teamAbbr&&row.opponent?`${row.teamAbbr} ${home?'vs':'@'} ${row.opponent}`:row.teamAbbr,when(row.startsAt)].filter(Boolean).join(' · ')}</small></span>
   <span className="nm-line"><small>More</small><b>{figure(row.line)}</b><em>{short[row.marketKey]||row.market}</em></span>
   <span className="nm-stat nm-hit"><span className="nm-stat-top"><small>Last 10</small><b>{hit?`${Math.round(hit.rate)}%`:'—'}</b></span>
    {hit?<Bar value={hit.rate} tone={hit.rate>=70?'strong':hit.rate>=55?'edge':hit.rate>=40?'neutral':'tough'}/>:<Bar value={0}/>}
    <small className="nm-sub">{hit?`${hit.hits} of ${hit.games}`:row.historyStatus==='pending'||row.historyRefresh?'Loading…':'No games yet'}</small></span>
   <span className="nm-stat nm-score" data-tone={read?.tone}><span className="nm-stat-top"><small>Matchup</small><b>{read?read.score:'—'}</b></span>
    <Bar value={read?.score||0} tone={read?.tone}/><small className="nm-sub">{read?read.label:'Not enough data'}</small></span>
  </button>
  {read&&<button type="button" className="nm-why" aria-expanded={open} onClick={onToggle}>Why<ChevronDown size={14}/></button>}
  {open&&read&&<ul className="nm-reads"><li className="nm-read-note">An even matchup is 50. Each part adds or takes away points.</li>{read.reads.map(item=><li key={item.key}>
   <span className="nm-read-head"><b>{READS[item.kind]||READS[item.key]}</b><em>{added(item.points)}</em></span>
   <span className="nm-read-text">{item.text}</span>
   <Bar value={item.score} tone={item.score>=60?'edge':item.score>=40?'neutral':'tough'}/>
  </li>)}</ul>}
 </li>;
}

export function MatchupList({config}){
 const {store,stats:STATS,score,Page,words}=config;
 const SHORT=useMemo(()=>Object.fromEntries(STATS),[STATS]);
 // The lines and league numbers live in props-data.js, loaded before the
 // tab opens and saved on the device: what's there shows at once and a
 // fresh board fills in behind it.
 const [data,setData]=useState(store.get);
 const [stat,setStat]=useState('all');
 const [game,setGame]=useState('all');
 const [query,setQuery]=useState('');
 const [sort,setSort]=useState('matchup');
 const [openId,setOpenId]=useState(null);
 const [page,setPage]=useState(null);
 const listScroll=useRef(0);
 useEffect(()=>{
  const stop=store.on(setData);
  store.warm();
  // League numbers the server wasn't ready with are asked for again.
  const retry=setInterval(()=>{if(!store.get().league)store.refresh();},45000);
  return()=>{stop();clearInterval(retry);};
 },[store]);
 const load=useCallback(()=>{store.refresh();},[store]);
 const rows=useMemo(()=>(data.rows||[]).filter(store.wanted),[data.rows,store]);
 const league=data.league,progress=data.progress,at=data.at;
 // Something to show beats a spinner: the list stays up while a board loads.
 const status=data.rows==null||(!rows.length&&data.loading)?'loading':!rows.length&&data.error?'error':data.loading?'refreshing':'ready';
 const scores=useMemo(()=>league?score(rows,league):new Map(),[rows,league,score]);
 const games=useMemo(()=>{
  const seen=new Map();
  for(const row of rows)if(!seen.has(gameOf(row)))seen.set(gameOf(row),row);
  return [...seen.entries()].sort((a,b)=>String(a[1].startsAt).localeCompare(String(b[1].startsAt)));
 },[rows]);
 const needle=query.trim().toLowerCase();
 const shown=useMemo(()=>rows
  .filter(row=>(stat==='all'||row.marketKey===stat)&&(game==='all'||gameOf(row)===game)&&(!needle||row.player.toLowerCase().includes(needle)))
  .map(row=>({row,read:scores.get(row.id)||null,hit:hitOf(row)}))
  .sort((a,b)=>sort==='hit'?(b.hit?.rate??-1)-(a.hit?.rate??-1)||(b.read?.score??-1)-(a.read?.score??-1)
   :(b.read?.score??-1)-(a.read?.score??-1)||(b.hit?.rate??-1)-(a.hit?.rate??-1))
  // All stats: each player once, at his best line by the sort; a stat chip lists that stat's line.
  .filter((item,index,list)=>stat!=='all'||list.findIndex(other=>other.row.player===item.row.player&&other.row.teamAbbr===item.row.teamAbbr)===index),
  [rows,scores,stat,game,needle,sort]);
 const counts=useMemo(()=>rows.reduce((out,row)=>({...out,[row.marketKey]:(out[row.marketKey]||0)+1}),{}),[rows]);
 // A player's page: its own history entry, so the phone's back gesture
 // closes it the same as the page's back button.
 const openPage=useCallback(row=>{
  listScroll.current=window.scrollY;
  history.pushState({...history.state,nbaMatchup:row.id},'',location.href);
  setPage(row);window.scrollTo(0,0);
 },[]);
 const closePage=useCallback(()=>{if(history.state?.nbaMatchup)history.back();else setPage(null);},[]);
 useEffect(()=>{
  const onPop=()=>{if(!history.state?.nbaMatchup)setPage(null);};
  window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);
 },[]);
 useEffect(()=>{
  const root=document.getElementById('props-league-root');
  if(root)root.dataset.page=page?'player':'';
  if(!page)requestAnimationFrame(()=>window.scrollTo(0,listScroll.current));
  return()=>{if(root)root.dataset.page='';};
 },[page]);
 if(page)return <Page key={page.id} row={page} lines={rows.filter(item=>item.player===page.player&&item.teamAbbr===page.teamAbbr)} league={league} onBack={closePage}/>;

 return <section className="nba-matchups" data-league={config.key} aria-labelledby={`${config.key}-matchups-title`}>
  <header className="nm-head">
   <div><h2 id={`${config.key}-matchups-title`}>{words.title}</h2>
    <p>{words.blurb}</p></div>
   <button type="button" className="nm-refresh" onClick={load} disabled={status==='loading'||status==='refreshing'} aria-label="Refresh">
    <RefreshCw size={16} className={status==='refreshing'?'nm-spin':undefined}/></button>
  </header>

  <div className="nm-tools">
   <label className="nm-search"><Search size={16} aria-hidden="true"/>
    <input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find a player" enterKeyHint="search" aria-label="Find a player"/>
    {query&&<button type="button" onClick={()=>setQuery('')} aria-label="Clear search"><X size={14}/></button>}</label>
   <label className="nm-game"><span className="nm-label">Game</span>
    <select value={game} onChange={event=>setGame(event.target.value)}>
     <option value="all">All games</option>
     {games.map(([key,row])=><option key={key} value={key}>{`${row.awayTeamAbbr||'?'} @ ${row.homeTeamAbbr||'?'} · ${when(row.startsAt)}`}</option>)}
    </select><ChevronDown size={14} aria-hidden="true"/></label>
   <div className="nm-sort" role="group" aria-label="Sort by">
    {SORTS.map(([key,text])=><button type="button" key={key} aria-pressed={sort===key} onClick={()=>setSort(key)}>{text}</button>)}
   </div>
  </div>
  <div className="nm-stats" role="group" aria-label="Stat">
   {STATS.filter(([key])=>key==='all'||counts[key]).map(([key,text])=><button type="button" key={key} aria-pressed={stat===key} onClick={()=>setStat(key)}>{text}</button>)}
  </div>

  {status==='loading'&&<div className="nm-empty"><RefreshCw size={18} className="nm-spin"/><b>{words.loading}</b>
   {progress?.total>0&&<span>Hit rates {progress.done} of {progress.total}</span>}</div>}
  {status==='error'&&<div className="nm-empty"><b>{words.failed}</b><button type="button" onClick={load}>Try again</button></div>}
  {(status==='ready'||status==='refreshing')&&!rows.length&&<div className="nm-empty"><b>{words.none}</b>
   <span>{words.noneText}</span></div>}
  {(status==='ready'||status==='refreshing')&&rows.length>0&&!league&&<p className="nm-note">Matchup scores are still loading the league’s numbers. Hit rates are below.</p>}

  {shown.length>0&&<div className="nm-cols" aria-hidden="true"><span>Player</span><span>Line</span><span>Last 10</span><span>Matchup</span></div>}
  {shown.length>0&&<ul className="nm-list">{shown.map(({row,read,hit})=><Row key={row.id} row={row} read={read} hit={hit} short={SHORT}
   open={openId===row.id} onToggle={()=>setOpenId(id=>id===row.id?null:row.id)} onOpen={openPage}/>)}</ul>}
  {(status==='ready'||status==='refreshing')&&rows.length>0&&!shown.length&&<div className="nm-empty"><b>Nothing matches</b>
   <span>Try another stat or game, or clear the search.</span></div>}

  {at>0&&rows.length>0&&<p className="nm-meta">{words.meta} · {shown.length} {shown.length===1?'prop':'props'} · updated {new Date(at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</p>}
 </section>;
}
