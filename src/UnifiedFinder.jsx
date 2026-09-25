import React, {useState} from 'react';
import {CalendarDays, ChevronDown, CircleDot, Database, ListFilter, SearchCheck, SlidersHorizontal, Trophy} from 'lucide-react';
import {MLBSearchField} from '../components/ui/mlb-search-field';
import './unified-finder.css';

const SPORTS=[
  {key:'all',label:'All'},
  {key:'wnba',label:'WNBA'},
  {key:'mlb',label:'MLB'},
  {key:'nfl',label:'NFL'},
  {key:'tennis',label:'Tennis'},
  {key:'soccer',label:'Soccer'},
];

function FilterButton({icon:Icon,label,disabled=false}){
 return <button type="button" className="unified-filter-button" disabled={disabled}><Icon size={16} aria-hidden="true"/><span>{label}</span><ChevronDown size={14} aria-hidden="true"/></button>;
}

export function UnifiedFinder(){
 const [sport,setSport]=useState('tennis');
 const [query,setQuery]=useState('');
 return <main className="unified-finder" aria-labelledby="unified-finder-title">
  <header className="unified-finder-head">
   <div><span className="unified-finder-kicker">MULTI-SPORT RESEARCH</span><h1 id="unified-finder-title">Finder</h1><p>One verified market board across every supported sport.</p></div>
   <span className="unified-finder-beta">Foundation</span>
  </header>
  <nav className="unified-sport-tabs" aria-label="Filter Finder by sport">
   {SPORTS.map(item=><button type="button" key={item.key} aria-pressed={sport===item.key} onClick={()=>setSport(item.key)}>{item.label}</button>)}
  </nav>
  <section className="unified-finder-toolbar" aria-label="Finder controls">
   <MLBSearchField id="unified-finder-search" ariaLabel="Search Finder players" placeholder="Search a player" value={query} onChange={event=>setQuery(event.target.value)} className="unified-finder-search"/>
   <div className="unified-finder-filters">
    <FilterButton icon={SlidersHorizontal} label="Modifiers" disabled/>
    <FilterButton icon={ListFilter} label="Stats" disabled/>
    <FilterButton icon={Trophy} label="Matches" disabled/>
    <FilterButton icon={CircleDot} label="Rankings" disabled/>
    <FilterButton icon={CalendarDays} label="Date" disabled/>
   </div>
  </section>
  <section className="unified-finder-stage" aria-live="polite">
   <div className="unified-finder-status-icon"><SearchCheck size={26} aria-hidden="true"/></div>
   <div><span>{sport==='tennis'?'TENNIS FOUNDATION':'SPORT FOUNDATION'}</span><h2>Verified data connection comes first.</h2><p>This workspace is intentionally not showing sample rows. Tennis lines and historical results will appear only after their sources pass identity, freshness and market-coverage checks.</p></div>
   <div className="unified-finder-proof"><Database size={18} aria-hidden="true"/><span><strong>No mock props</strong><small>Every future row must retain its source and update time.</small></span></div>
  </section>
 </main>;
}
