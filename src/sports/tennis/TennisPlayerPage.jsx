import React,{useMemo,useState} from 'react';
import {BookmarkPlus,CalendarDays,Database,Minus,Plus,Trophy} from 'lucide-react';
import {FinderPlayerBanner} from '../../FinderPlayerBanner';
import {finderSlipProp} from '../../unified-finder-data';
import {pickBuilder,usePickBuilder} from '../../pick-builder-client';
import './tennis-player.css';

const when=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'Schedule pending':date.toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});};
const tier=value=>String(value||'standard').toLowerCase();

export function TennisPlayerPage({row,playerRows,onBack}){
 const rows=useMemo(()=>playerRows.filter(item=>item.sport==='tennis'&&item.player===row.player),[playerRows,row.player]);
 const markets=useMemo(()=>[...new Set(rows.map(item=>item.market))],[rows]);
 const [market,setMarket]=useState(row.market);
 const lines=useMemo(()=>rows.filter(item=>item.market===market).sort((a,b)=>a.line-b.line),[rows,market]);
 const [selectedId,setSelectedId]=useState(row.id);
 const selected=lines.find(item=>item.id===selectedId)||lines.find(item=>Number(item.line)===Number(row.line))||lines[0]||row;
 const builder=usePickBuilder();
 const saved=builder.legs.find(leg=>leg.finderId===selected.id);
 const chooseMarket=value=>{setMarket(value);const first=rows.find(item=>item.market===value);if(first)setSelectedId(first.id);};
 const add=side=>pickBuilder.set(finderSlipProp(selected),side);
 return <section className="finder-trend-view tennis-player-page">
  <FinderPlayerBanner row={selected} playerRows={rows} onBack={onBack}/>
  <nav className="tennis-market-tabs" aria-label="Tennis statistics">{markets.map(value=><button type="button" key={value} aria-pressed={market===value} onClick={()=>chooseMarket(value)}>{value}<span>{rows.filter(item=>item.market===value).length}</span></button>)}</nav>
  <div className="tennis-detail-grid">
   <main className="tennis-trend-card">
    <header><div><span className="tennis-kicker"><Trophy size={14} aria-hidden="true"/>PrizePicks tennis</span><h2>{market}</h2><p>{selected.opponent?`vs ${selected.opponent}`:'Opponent pending'} · {when(selected.startsAt)}</p></div>
     <div className="tennis-side-actions" role="group" aria-label={`Save ${selected.player} ${selected.line} ${market}`}>
      <button type="button" aria-pressed={saved?.side==='Under'} disabled={['goblin','demon'].includes(tier(selected.modifier))} onClick={()=>add('Under')}><Minus size={14} aria-hidden="true"/>Less</button>
      <button type="button" aria-pressed={saved?.side==='Over'} onClick={()=>add('Over')}><Plus size={14} aria-hidden="true"/>More</button>
     </div>
    </header>
    <div className="tennis-lines" role="list" aria-label={`${market} lines`}>{lines.map(item=><button type="button" role="listitem" key={item.id} aria-pressed={selected.id===item.id} data-tier={tier(item.modifier)} onClick={()=>setSelectedId(item.id)}><img src="/prizepicks/logo.png" alt="" width="22" height="22"/><strong>{item.line}</strong><span>{tier(item.modifier)==='standard'?'Regular':tier(item.modifier)}</span></button>)}</div>
    <div className="tennis-context-pending" role="status"><Database size={28} aria-hidden="true"/><strong>Lines are live. Player context is ready to connect.</strong><span>The PrizePicks market is available in Finder and the Slip Builder now. Historical bars, surface splits and matchup context will populate from the context dataset without changing this layout.</span></div>
   </main>
   <aside className="tennis-match-card" aria-label="Upcoming tennis match"><span><CalendarDays size={16} aria-hidden="true"/>Upcoming match</span><h3>{selected.player}</h3><p>{selected.opponent?`vs ${selected.opponent}`:'Opponent has not been attached by PrizePicks'}</p><dl><div><dt>Market</dt><dd>{market}</dd></div><div><dt>Line</dt><dd>{selected.line}</dd></div><div><dt>Type</dt><dd>{tier(selected.modifier)}</dd></div><div><dt>Starts</dt><dd>{when(selected.startsAt)}</dd></div></dl><button type="button" className="tennis-open-builder" onClick={()=>{add('Over');pickBuilder.open();}}><BookmarkPlus size={16} aria-hidden="true"/>Add More and open Slip Builder</button></aside>
  </div>
 </section>;
}
