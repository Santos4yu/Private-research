// The Props tab's NBA side: every NBA prop on PrizePicks tonight with how
// often it has cleared its line lately and how good tonight's opponent is
// for it (nba-matchup-score.js), sortable either way. A row opens that
// player's matchup page (NbaMatchupPage.jsx); "Why" shows what made the score.
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ChevronDown,RefreshCw,Search,X} from 'lucide-react';
import {loadLines} from './finder-pool';
import {loadFinderDefense,windowGames,windowRate} from './unified-finder-data';
import {spreadScores} from './nba-matchup-score';
import {Face} from './PickParts';
import {NbaMatchupPage} from './NbaMatchupPage';
import './nba-matchups.css';

const STATS=[['all','All'],['player_points','PTS'],['player_rebounds','REB'],['player_assists','AST'],['player_threes','3PM'],
 ['player_points_rebounds','P+R'],['player_points_assists','P+A'],['player_points_rebounds_assists','PRA'],['player_steals','STL'],['player_blocks','BLK']];
const SHORT=Object.fromEntries(STATS);
const SORTS=[['matchup','Matchup'],['hit','Hit %']];
const READS={defense:'Their defense',pace:'Their pace',position:'vs his position',fit:'His games vs them'};
const figure=value=>Number.isInteger(Number(value))?String(Number(value)):Number(value).toFixed(1);
const when=iso=>{const time=Date.parse(iso||'');if(!Number.isFinite(time))return '';const date=new Date(time),today=new Date();
 const clock=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 return date.toDateString()===today.toDateString()?clock:`${date.toLocaleDateString([],{weekday:'short'})} ${clock}`;};
const wanted=row=>row.sport==='nba'&&SHORT[row.marketKey]&&(row.modifier||'standard')==='standard'&&!row.promo
 &&(!row.startsAt||Date.parse(row.startsAt)>Date.now());
const gameOf=row=>`${row.awayTeamAbbr||''}@${row.homeTeamAbbr||''}|${row.startsAt||''}`;
const hitOf=row=>{const window=row.windows?.l10;const games=windowGames(window);return games?{rate:windowRate(window),hits:window.hits,games}:null;};

function Bar({value,tone}){
 return <span className="nm-bar" data-tone={tone||undefined}><i style={{width:`${Math.max(4,Math.min(100,value))}%`}}/></span>;
}

function Row({row,read,hit,open,onToggle,onOpen}){
 const home=row.teamAbbr&&row.teamAbbr===row.homeTeamAbbr;
 return <li className="nm-row" data-open={open||undefined}>
  <button type="button" className="nm-main" onClick={()=>onOpen(row)} aria-label={`Open ${row.player}'s ${SHORT[row.marketKey]||row.market} matchup`}>
   <Face row={row}/>
   <span className="nm-who"><b>{row.player}</b>
    <small>{[row.position,row.teamAbbr&&row.opponent?`${row.teamAbbr} ${home?'vs':'@'} ${row.opponent}`:row.teamAbbr,when(row.startsAt)].filter(Boolean).join(' · ')}</small></span>
   <span className="nm-line"><small>More</small><b>{figure(row.line)}</b><em>{SHORT[row.marketKey]}</em></span>
   <span className="nm-stat nm-hit"><span className="nm-stat-top"><small>L10</small><b>{hit?`${Math.round(hit.rate)}%`:'—'}</b></span>
    {hit?<Bar value={hit.rate} tone={hit.rate>=70?'strong':hit.rate>=55?'edge':hit.rate>=40?'neutral':'tough'}/>:<Bar value={0}/>}
    <small className="nm-sub">{hit?`${hit.hits} of ${hit.games}`:'No games yet'}</small></span>
   <span className="nm-stat nm-score" data-tone={read?.tone}><span className="nm-stat-top"><small>Matchup</small><b>{read?read.score:'—'}</b></span>
    <Bar value={read?.score||0} tone={read?.tone}/><small className="nm-sub">{read?read.label:'Not enough data'}</small></span>
  </button>
  {read&&<button type="button" className="nm-why" aria-expanded={open} onClick={onToggle}>Why<ChevronDown size={14}/></button>}
  {open&&read&&<ul className="nm-reads">{read.reads.map(item=><li key={item.key}>
   <span className="nm-read-head"><b>{READS[item.key]}</b><em>{item.weight}% of the score</em></span>
   <span className="nm-read-text">{item.text}</span>
   <Bar value={item.score} tone={item.score>=60?'edge':item.score>=40?'neutral':'tough'}/>
  </li>)}</ul>}
 </li>;
}

export function NbaMatchups(){
 const [rows,setRows]=useState([]);
 const [league,setLeague]=useState(null);
 const [status,setStatus]=useState('loading');
 const [progress,setProgress]=useState(null);
 const [stat,setStat]=useState('all');
 const [game,setGame]=useState('all');
 const [query,setQuery]=useState('');
 const [sort,setSort]=useState('matchup');
 const [openId,setOpenId]=useState(null);
 const [page,setPage]=useState(null);
 const [at,setAt]=useState(0);
 const listScroll=useRef(0);
 const control=useRef(null);
 const load=useCallback(async()=>{
  control.current?.abort();
  const abort=new AbortController();control.current=abort;
  setStatus(old=>old==='ready'?'refreshing':'loading');setProgress(null);
  try{
   // Only the lines this page lists get their hit rates worked out.
   const [lines,context]=await Promise.all([
    loadLines('nba',{signal:abort.signal,only:wanted,onProgress:item=>item.stage==='history'&&setProgress({done:item.done,total:item.total})}),
    loadFinderDefense('nba',{signal:abort.signal}).catch(()=>null)]);
   if(abort.signal.aborted)return;
   setRows(lines.filter(wanted));setLeague(context);setAt(Date.now());setStatus('ready');
  }catch(error){if(error?.name!=='AbortError')setStatus(old=>old==='refreshing'?'ready':'error');}
 },[]);
 useEffect(()=>{load();return()=>control.current?.abort();},[load]);
 const scores=useMemo(()=>league?spreadScores(rows,league):new Map(),[rows,league]);
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
   :(b.read?.score??-1)-(a.read?.score??-1)||(b.hit?.rate??-1)-(a.hit?.rate??-1)),[rows,scores,stat,game,needle,sort]);
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
 if(page)return <NbaMatchupPage key={page.id} row={page} lines={rows.filter(item=>item.player===page.player&&item.teamAbbr===page.teamAbbr)} league={league} onBack={closePage}/>;

 return <section className="nba-matchups" aria-labelledby="nba-matchups-title">
  <header className="nm-head">
   <div><h2 id="nba-matchups-title">NBA Matchups</h2>
    <p>Every NBA prop tonight, graded on the matchup and how often it has hit lately.</p></div>
   <button type="button" className="nm-refresh" onClick={load} disabled={status==='loading'||status==='refreshing'} aria-label="Refresh">
    <RefreshCw size={16} className={status==='refreshing'?'nm-spin':undefined}/></button>
  </header>

  <div className="nm-stats" role="group" aria-label="Stat">
   {STATS.filter(([key])=>key==='all'||counts[key]).map(([key,text])=><button type="button" key={key} aria-pressed={stat===key} onClick={()=>setStat(key)}>{text}</button>)}
  </div>
  <div className="nm-controls">
   <label className="nm-game"><span className="nm-label">Game</span>
    <select value={game} onChange={event=>setGame(event.target.value)}>
     <option value="all">All games</option>
     {games.map(([key,row])=><option key={key} value={key}>{`${row.awayTeamAbbr||'?'} @ ${row.homeTeamAbbr||'?'} · ${when(row.startsAt)}`}</option>)}
    </select><ChevronDown size={14} aria-hidden="true"/></label>
   <label className="nm-search"><Search size={15} aria-hidden="true"/>
    <input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find a player" enterKeyHint="search" aria-label="Find a player"/>
    {query&&<button type="button" onClick={()=>setQuery('')} aria-label="Clear search"><X size={14}/></button>}</label>
   <div className="nm-sort" role="group" aria-label="Sort by">
    {SORTS.map(([key,text])=><button type="button" key={key} aria-pressed={sort===key} onClick={()=>setSort(key)}>{text}</button>)}
   </div>
  </div>

  {status==='loading'&&<div className="nm-empty"><RefreshCw size={18} className="nm-spin"/><b>Loading tonight’s NBA props…</b>
   {progress?.total>0&&<span>Hit rates {progress.done} of {progress.total}</span>}</div>}
  {status==='error'&&<div className="nm-empty"><b>NBA props couldn’t load</b><button type="button" onClick={load}>Try again</button></div>}
  {(status==='ready'||status==='refreshing')&&!rows.length&&<div className="nm-empty"><b>No NBA props posted right now</b>
   <span>PrizePicks posts tonight’s lines through the day. Check back soon.</span></div>}
  {(status==='ready'||status==='refreshing')&&rows.length>0&&!league&&<p className="nm-note">Matchup scores are still loading the league’s numbers. Hit rates are below.</p>}

  {shown.length>0&&<ul className="nm-list">{shown.map(({row,read,hit})=><Row key={row.id} row={row} read={read} hit={hit}
   open={openId===row.id} onToggle={()=>setOpenId(id=>id===row.id?null:row.id)} onOpen={openPage}/>)}</ul>}
  {(status==='ready'||status==='refreshing')&&rows.length>0&&!shown.length&&<div className="nm-empty"><b>Nothing matches</b>
   <span>Try another stat or game, or clear the search.</span></div>}

  {at>0&&rows.length>0&&<p className="nm-meta">Matchup is how good tonight’s opponent is for that stat: how much their defense gives up and how fast they play, what they allow his position in it, and his own games against them. 100 is as soft as it gets. · {shown.length} props · updated {new Date(at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</p>}
 </section>;
}
