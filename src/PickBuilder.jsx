import React from 'react';
import {ArrowDown,ArrowLeft,ArrowUp,ExternalLink,Link2,Ticket,Trash2,X} from 'lucide-react';
import {LEAGUE_LOGOS} from './league-logos';
import {pickBuilder,usePickBuilder} from './pick-builder-client';
import './pick-builder.css';

// The Pick Builder section at the top of the side panel (#side-panel). It is
// one more view of the site's saved-picks list -- the same one My Slip, the
// Prop Builder dropdown and the Finder's stars show -- and exports through
// the same live PrizePicks check (app.js exportManualBetSlip).
// Oct 28, the owner: "redesign the Pick Builder and make it easier to
// navigate", then "I want a nicer builder like high quality looking". A slip:
// the title with how many of the 6 places are taken, each pick's photo and
// game, its line large with Over / Under beside it (green up, red down), the
// books' prices in a quiet line under it, and the export, link and clear
// always in view at the bottom. In the desktop rail it takes the rail to
// itself, a Menu button back to the links.

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const american=value=>finite(value)?(value>0?'+':'')+Math.round(value):null;
const BOOK_LOGOS={prizepicks:'/prizepicks/logo.png'};
const bookLogo=key=>BOOK_LOGOS[key]||`/sportsbooks/${key}.png`;
const initials=name=>String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase();
const TIERS={goblin:'Goblin',demon:'Demon'};
const MAX=6;
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
   <img src={bookLogo(book.key)} alt={book.name||book.key} width="14" height="14" onError={event=>{event.currentTarget.hidden=true;}}/>
   {american(book[side])||(book.key==='prizepicks'?(tier?<><img src={`/prizepicks/${tier}.png`} alt="" width="13" height="13"/>{TIERS[tier]}</>:'Standard'):null)}
  </span>)}
 </span>;
}

function Leg({leg,busy,index}){
 const moreOnly=['goblin','demon'].includes(leg.modifier);
 const league=LEAGUE_LOGOS[String(leg.sport||'').toLowerCase()];
 const when=startLabel(leg.startsAt);
 return <li className="pick-builder-leg" data-side={leg.side.toLowerCase()} style={{'--n':index}}>
  <span className="pick-builder-photo">
   <span aria-hidden="true">{initials(leg.player)}</span>
   {leg.headshot&&<img className="pick-builder-headshot" src={leg.headshot} alt="" onError={event=>{event.currentTarget.hidden=true;}}/>}
   {leg.teamLogo&&<img className="pick-builder-team" src={leg.teamLogo} alt={leg.team||''} onError={event=>{event.currentTarget.hidden=true;}}/>}
  </span>
  <span className="pick-builder-copy">
   <strong>{leg.player}</strong>
   <span className="pick-builder-meta">{league&&<img src={league} alt="" width="12" height="13" onError={event=>{event.currentTarget.hidden=true;}}/>}
    {leg.team&&<span>{leg.team}</span>}{when&&leg.team&&<i aria-hidden="true">·</i>}{when&&<time dateTime={leg.startsAt}>{when}</time>}</span>
  </span>
  <button type="button" className="pick-builder-remove" aria-label={`Remove ${leg.player} ${leg.line} ${leg.stat}`} disabled={busy} onClick={()=>pickBuilder.remove(leg.id)}><X size={15} aria-hidden="true"/></button>
  <span className="pick-builder-bet">
   <span className="pick-builder-stat"><b>{leg.line}</b><span>{leg.stat}</span></span>
   <span className="pick-builder-side" role="group" aria-label={`${leg.player}: Over or Under`}>
    <button type="button" data-side="over" aria-pressed={leg.side==='Over'} disabled={busy} onClick={()=>pickBuilder.side(leg.id,'Over')}><ArrowUp size={13} strokeWidth={2.6} aria-hidden="true"/>Over</button>
    <button type="button" data-side="under" aria-pressed={leg.side==='Under'} disabled={busy||moreOnly} title={moreOnly?'Goblin and Demon lines are More only on PrizePicks':undefined} onClick={()=>pickBuilder.side(leg.id,'Under')}><ArrowDown size={13} strokeWidth={2.6} aria-hidden="true"/>Under</button>
   </span>
  </span>
  <Odds leg={leg}/>
 </li>;
}

export function PickBuilder({onClose,titleId='pick-builder-title'}){
 const builder=usePickBuilder();
 const count=builder.legs.length;
 return <section className="pick-builder" data-count={count} aria-labelledby={titleId}>
  <header className="pick-builder-head">
   {onClose&&<button type="button" className="pick-builder-back" aria-label="Close Pick Builder, back to the menu" onClick={onClose}><ArrowLeft size={16} aria-hidden="true"/><span>Menu</span></button>}
   <span className="pick-builder-mark" aria-hidden="true"><Ticket size={17}/></span>
   <span className="pick-builder-title"><h2 id={titleId}>Pick Builder</h2><small>{count===0?'No picks yet':`${count} of ${MAX} picks`}</small></span>
  </header>
  {/* The six places on a PrizePicks entry, the taken ones lit. */}
  <div className="pick-builder-slots" role="img" aria-label={`${count} of ${MAX} picks`}>{Array.from({length:MAX},(_,index)=><i key={index} data-on={index<count||undefined}/>)}</div>
  {count===0?<div className="pick-builder-empty"><span className="pick-builder-mark" aria-hidden="true"><Ticket size={17}/></span><span><strong>Your slip is empty</strong>Tap + on a Props line or the star on a Finder prop.</span></div>
   :<ol className="pick-builder-list" aria-live="polite">{builder.legs.map((leg,index)=><Leg key={leg.id} leg={leg} busy={builder.busy} index={index}/>)}</ol>}
  <footer className="pick-builder-footer">
   <p role="status">{builder.status}</p>
   {/* PrizePicks opens in a new tab: a link once one is made for these picks, else Export makes it. */}
   {builder.link&&!builder.busy?<a className="pick-builder-export" href={builder.link} target="_blank" rel="noopener noreferrer"><span>Open in PrizePicks</span><ExternalLink size={15} aria-hidden="true"/></a>
    :<button type="button" className="pick-builder-export" disabled={!builder.canExport||builder.busy} onClick={pickBuilder.export}><span>{builder.busy?'Checking lines…':'Export to PrizePicks'}</span><ExternalLink size={15} aria-hidden="true"/></button>}
   <div className="pick-builder-more">
    <button type="button" className="pick-builder-link" disabled={!builder.canExport||builder.busy} onClick={pickBuilder.copy}><Link2 size={15} aria-hidden="true"/>Copy link</button>
    <button type="button" className="pick-builder-clear" disabled={!count||builder.busy} onClick={pickBuilder.clear}><Trash2 size={15} aria-hidden="true"/>Clear</button>
   </div>
  </footer>
 </section>;
}
