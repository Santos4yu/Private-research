// The Promo Board: every PrizePicks promo line live right now -- flash sales
// and lines posted far under the player's real number
// (prizepicks_export_core.py _mark_promos) -- each graded the way the
// Parlay Builder grades a pick (smart-slip.js assessLeg, krazy-bot.js
// gradeMatchups). PrizePicks takes one promo per entry, so the best one is
// what a member is after.
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Check,Plus,RefreshCw,Search,TicketPercent} from 'lucide-react';
import {LEAGUE_LOGOS} from './league-logos';
import {siteFinderSportAllowed} from './site-access';
import {finderSlipProp} from './unified-finder-data';
import {loadLines} from './finder-pool';
import {SPORT_NAMES} from './smart-slip';
import {loadMatchups} from './slip-matchup';
import {promoCards} from './promo-board-core';
import {pickBuilder,usePickBuilder} from './pick-builder-client';
import {Face,TierBadge,Games} from './PickParts';
import './promo-board.css';

const SPORTS=['nba','wnba','mlb','nfl','nhl','soccer'];
const percent=value=>`${Math.round(value*100)}%`;
const figure=value=>Number.isInteger(Number(value))?String(Number(value)):Number(value).toFixed(1);
const when=iso=>{const time=Date.parse(iso||'');if(!Number.isFinite(time))return '';const date=new Date(time),today=new Date();
 const clock=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 return date.toDateString()===today.toDateString()?clock:`${date.toLocaleDateString([],{weekday:'short'})} ${clock}`;};
export function PromoCard({card,saved,onAdd}){
 const {row,leg,usual}=card;
 const tier=leg?.tier;
 const l10=leg?.records?.l10;
 return <article className="pb-card" data-tier={tier||'none'}>
  <header className="pb-card-head">
   <Face row={row} leg={leg} tier={tier}/>
   <div className="pb-who"><b>{row.player}</b>
    <small>{[SPORT_NAMES[row.sport],[row.teamAbbr,row.opponent&&`vs ${row.opponent}`].filter(Boolean).join(' '),when(row.startsAt)].filter(Boolean).join(' · ')}</small></div>
   {tier?<TierBadge tier={tier}/>:<span className="pb-ungraded">Not graded</span>}
  </header>
  <div className="pb-line">
   <span className="pb-tag"><TicketPercent size={13}/>Promo</span>
   <b>Over {figure(row.line)}</b><span>{row.market}</span>
   {usual&&<small className="pb-usual">usually {figure(usual.line)}{usual.modifier!=='standard'?` (${usual.modifier})`:''}</small>}
  </div>
  {leg?<div className="pb-read">
   <div className="pb-chance"><strong>{percent(leg.chance)}</strong><small>to hit</small></div>
   {l10&&<div className="pb-chance"><strong>{l10.won}/{l10.games}</strong><small>last {l10.games}</small></div>}
   {leg.book!=null&&<div className="pb-chance"><strong>{percent(leg.book)}</strong><small>books</small></div>}
  </div>:<p className="pb-thin">Not enough games to grade this line yet.</p>}
  {leg&&<Games row={row} line={row.line} side="OVER"/>}
  <footer className="pb-actions">
   <button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('vortex:open-prop',{detail:{sport:row.sport,player:row.player,stat:row.raw?.stat||row.market}}))}><Search size={14}/>Research</button>
   <button type="button" className="pb-add" aria-pressed={saved} onClick={onAdd}>{saved?<Check size={14}/>:<Plus size={14}/>}{saved?'In My Slip':'My Slip'}</button>
  </footer>
 </article>;
}

export function PromoBoard(){
 const [rows,setRows]=useState([]);
 const [tables,setTables]=useState({});
 const [status,setStatus]=useState('loading');
 const [sport,setSport]=useState('all');
 const [at,setAt]=useState(0);
 const control=useRef(null);
 const builder=usePickBuilder();
 const load=useCallback(async()=>{
  control.current?.abort();
  const abort=new AbortController();control.current=abort;
  setStatus(old=>old==='ready'?'refreshing':'loading');
  const allowed=SPORTS.filter(siteFinderSportAllowed);
  // Only the promo lines' games are read, so this stays quick.
  const results=await Promise.allSettled(allowed.map(key=>loadLines(key,{signal:abort.signal,only:row=>row.promo})));
  if(abort.signal.aborted)return;
  const all=results.flatMap(result=>result.status==='fulfilled'?result.value:[]);
  const read=await loadMatchups(allowed,{signal:abort.signal}).catch(()=>({}));
  if(abort.signal.aborted)return;
  setRows(all);setTables(read);setAt(Date.now());
  setStatus(all.length||results.some(result=>result.status==='fulfilled')?'ready':'error');
 },[]);
 useEffect(()=>{load();return()=>control.current?.abort();},[load]);
 const cards=useMemo(()=>promoCards(rows,{tables}),[rows,tables]);
 const counts=useMemo(()=>cards.reduce((out,card)=>({...out,[card.row.sport]:(out[card.row.sport]||0)+1}),{}),[cards]);
 const shown=cards.filter(card=>sport==='all'||card.row.sport===sport);
 const inSlip=useMemo(()=>new Set((builder.legs||[]).map(leg=>leg.id)),[builder.legs]);
 const add=card=>{
  const prop=finderSlipProp(card.row);
  if(inSlip.has(prop.id)){pickBuilder.remove(prop.id);return;}
  pickBuilder.set(prop,'Over');
 };
 const best=shown.find(card=>card.leg?.tier==='elite'||card.leg?.tier==='strong');

 return <section className="promo-board" aria-labelledby="promo-board-title">
  <header className="pb-head">
   <div className="pb-title"><span className="pb-mark" aria-hidden="true"><TicketPercent size={22}/></span>
    <div><h1 id="promo-board-title">Promo Board</h1>
     <p>Every PrizePicks promo live right now, graded by Ace Props. PrizePicks takes one promo per entry, so pick your best one.</p></div></div>
   <button type="button" className="pb-refresh" onClick={load} disabled={status==='loading'||status==='refreshing'} aria-label="Refresh promos">
    <RefreshCw size={16} className={status==='refreshing'?'pb-spin':undefined}/></button>
  </header>

  {cards.length>0&&<div className="pb-filters" role="group" aria-label="Sport">
   {[['all',`All · ${cards.length}`],...SPORTS.filter(key=>counts[key]).map(key=>[key,`${SPORT_NAMES[key]} · ${counts[key]}`])].map(([value,text])=>
    <button type="button" key={value} aria-pressed={sport===value} onClick={()=>setSport(value)}>
     {value!=='all'&&<img src={LEAGUE_LOGOS[value]} alt="" width="16" height="16"/>}{text}</button>)}
  </div>}

  {best&&<p className="pb-best">Best promo on the board: <b>{best.row.player} over {figure(best.row.line)} {best.row.market}</b> · {percent(best.leg.chance)} to hit</p>}

  {status==='loading'&&<div className="pb-empty"><RefreshCw size={18} className="pb-spin"/><b>Finding today’s promos…</b></div>}
  {status==='error'&&<div className="pb-empty"><b>Promos couldn’t load</b><button type="button" onClick={load}>Try again</button></div>}
  {(status==='ready'||status==='refreshing')&&!cards.length&&<div className="pb-empty"><TicketPercent size={22}/><b>No promos live right now</b>
   <span>PrizePicks posts promos through the day, often a few hours before games. Check back soon.</span></div>}

  {shown.length>0&&<div className="pb-grid">{shown.map(card=><PromoCard key={card.row.id} card={card} saved={inSlip.has(finderSlipProp(card.row).id)} onAdd={()=>add(card)}/>)}</div>}
  {at>0&&cards.length>0&&<p className="pb-meta">{cards.length} promo{cards.length===1?'':'s'} · checked {new Date(at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</p>}
 </section>;
}
