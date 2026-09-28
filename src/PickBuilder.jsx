import React from 'react';
import {ClipboardList,ExternalLink,Trash2,X} from 'lucide-react';
import {LEAGUE_LOGOS} from './league-logos';
import {pickBuilder,usePickBuilder} from './pick-builder-client';
import './pick-builder.css';

// The Pick Builder section at the top of the side panel (#side-panel). It is
// one more view of the site's saved-picks list -- the same one My Slip, the
// Prop Builder dropdown and the Finder's stars show -- and exports through
// the same live PrizePicks check (app.js exportManualBetSlip).

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const american=value=>finite(value)?(value>0?'+':'')+Math.round(value):null;
const BOOK_LOGOS={prizepicks:'/prizepicks/logo.png'};
const bookLogo=key=>BOOK_LOGOS[key]||`/sportsbooks/${key}.png`;
const initials=name=>String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase();
function startLabel(value){
 const date=new Date(value);
 if(!value||Number.isNaN(date.getTime()))return '';
 return `${date.toLocaleDateString([],{weekday:'short'})} ${date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`;
}

// Each book's price for the side this pick is on. PrizePicks itself shows
// its tier instead when it has no price for the side.
function Odds({leg}){
 const side=leg.side==='Under'?'under':'over';
 const tier=['goblin','demon'].includes(leg.modifier)?leg.modifier:null;
 const books=(leg.apps||[]).filter(app=>app.key==='prizepicks'||american(app[side]));
 if(!books.length)return null;
 return <span className="pick-builder-odds" aria-label={`${leg.side} prices`}>
  {books.map(book=><span className="pick-builder-book" key={book.key} title={book.name||book.key}>
   <img src={bookLogo(book.key)} alt={book.name||book.key} width="18" height="18" onError={event=>{event.currentTarget.hidden=true;}}/>
   {american(book[side])||(book.key==='prizepicks'?(tier?<img src={`/prizepicks/${tier}.png`} alt={tier} width="16" height="16"/>:<small>Std</small>):null)}
  </span>)}
 </span>;
}

function Leg({leg,busy}){
 const moreOnly=['goblin','demon'].includes(leg.modifier);
 const league=LEAGUE_LOGOS[String(leg.sport||'').toLowerCase()];
 const when=startLabel(leg.startsAt);
 return <article className="pick-builder-leg" data-side={leg.side.toLowerCase()}>
  <span className="pick-builder-photo">
   <span aria-hidden="true">{initials(leg.player)}</span>
   {leg.headshot&&<img className="pick-builder-headshot" src={leg.headshot} alt="" onError={event=>{event.currentTarget.hidden=true;}}/>}
   {leg.teamLogo&&<img className="pick-builder-team" src={leg.teamLogo} alt={leg.team||''} onError={event=>{event.currentTarget.hidden=true;}}/>}
  </span>
  <span className="pick-builder-copy">
   <strong>{leg.player}</strong>
   <span className="pick-builder-stat">{league&&<img src={league} alt="" width="12" height="13" onError={event=>{event.currentTarget.hidden=true;}}/>}<b>{leg.line}</b> {leg.stat}</span>
   <span className="pick-builder-meta">{when&&<time dateTime={leg.startsAt}>{when}</time>}{when&&leg.team&&<i aria-hidden="true">·</i>}{leg.team&&<span>{leg.team}</span>}</span>
   <Odds leg={leg}/>
  </span>
  <span className="pick-builder-side" role="group" aria-label={`${leg.player}: Under or Over`}>
   <button type="button" data-side="under" aria-pressed={leg.side==='Under'} disabled={busy||moreOnly} title={moreOnly?'Goblin and Demon lines are More only on PrizePicks':undefined} onClick={()=>pickBuilder.side(leg.id,'Under')}>Under</button>
   <button type="button" data-side="over" aria-pressed={leg.side==='Over'} disabled={busy} onClick={()=>pickBuilder.side(leg.id,'Over')}>Over</button>
  </span>
  <button type="button" className="pick-builder-remove" aria-label={`Remove ${leg.player} ${leg.line} ${leg.stat}`} disabled={busy} onClick={()=>pickBuilder.remove(leg.id)}><X size={14} aria-hidden="true"/></button>
 </article>;
}

export function PickBuilder(){
 const builder=usePickBuilder();
 const count=builder.legs.length;
 return <section className="pick-builder" aria-labelledby="pick-builder-title">
  <header className="pick-builder-head">
   <h2 id="pick-builder-title">Pick Builder</h2>
   <span>{count} of 6 picks</span>
  </header>
  {count===0?<div className="pick-builder-empty"><ClipboardList size={20} aria-hidden="true"/><span><strong>No picks yet</strong>Tap the star on a Finder prop, or add one from Research.</span></div>
   :<div className="pick-builder-list" aria-live="polite">{builder.legs.map(leg=><Leg key={leg.id} leg={leg} busy={builder.busy}/>)}</div>}
  <footer className="pick-builder-footer">
   <p role="status">{builder.status}</p>
   <div>
    <button type="button" className="pick-builder-clear" disabled={!count||builder.busy} onClick={pickBuilder.clear}><Trash2 size={15} aria-hidden="true"/>Clear</button>
    <button type="button" className="pick-builder-export" disabled={!builder.canExport||builder.busy} onClick={pickBuilder.export}><span>{builder.busy?'Checking lines…':'Export to PrizePicks'}</span><ExternalLink size={15} aria-hidden="true"/></button>
   </div>
  </footer>
 </section>;
}
