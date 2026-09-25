import React, {useEffect, useMemo, useState} from 'react';
import {ArrowLeft, CalendarDays, ChevronDown, CircleDot, Database, ListFilter, RefreshCw, SearchCheck, SlidersHorizontal, Trophy} from 'lucide-react';
import {MLBSearchField} from '../components/ui/mlb-search-field';
import {WNBATrendHost} from './sports/wnba/TrendHost';
import {WNBA_STATS} from './sports/wnba/trend-data';
import './unified-finder.css';

const SPORTS=[
  {key:'all',label:'All'},
  {key:'wnba',label:'WNBA'},
  {key:'mlb',label:'MLB'},
  {key:'nfl',label:'NFL'},
  {key:'soccer',label:'Soccer'},
];

const BOOK_LOGOS={prizepicks:'/prizepicks/logo.png',draftkings:'/sportsbooks/draftkings.png',fanduel:'/sportsbooks/fanduel.png',betmgm:'/sportsbooks/betmgm.png',underdog:'/sportsbooks/underdog.png'};
const fmtPrice=value=>Number.isFinite(value)?`${value>0?'+':''}${value}`:'—';
const fmtStart=value=>{try{return new Intl.DateTimeFormat(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'}).format(new Date(value));}catch{return 'Upcoming';}};

function FilterButton({icon:Icon,label,disabled=false}){
 return <button type="button" className="unified-filter-button" disabled={disabled}><Icon size={16} aria-hidden="true"/><span>{label}</span><ChevronDown size={14} aria-hidden="true"/></button>;
}

export function UnifiedFinder(){
 const [sport,setSport]=useState('wnba');
 const [query,setQuery]=useState('');
 const [market,setMarket]=useState('all');
 const [board,setBoard]=useState({state:'loading',rows:[],fetchedAt:null,error:null});
 const [selected,setSelected]=useState(null);
 const [trend,setTrend]=useState({state:'idle',rows:[],error:null});
 const load=()=>{setBoard(current=>({...current,state:'loading',error:null}));fetch('/api/wnba',{cache:'no-store'}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'WNBA lines are unavailable.');setBoard({state:'ready',rows:Array.isArray(data.rows)?data.rows:[],fetchedAt:data.fetchedAt,error:null});}).catch(error=>setBoard({state:'error',rows:[],fetchedAt:null,error:error.message}));};
 useEffect(()=>{load();},[]);
 const markets=useMemo(()=>[...new Set(board.rows.map(row=>row.market))].sort(),[board.rows]);
 const rows=useMemo(()=>board.rows.filter(row=>(sport==='all'||sport==='wnba')&&(market==='all'||row.market===market)&&(!query.trim()||row.player.toLowerCase().includes(query.trim().toLowerCase()))),[board.rows,sport,market,query]);
 const playerRows=useMemo(()=>selected?board.rows.filter(row=>row.playerId===selected.playerId):[],[board.rows,selected]);
 const openTrend=row=>{if(!row.playerId)return;setSelected(row);setTrend({state:'loading',rows:[],error:null});fetch(`/api/wnba?resource=gamelog&playerId=${encodeURIComponent(row.playerId)}&season=${new Date().getUTCFullYear()}`,{cache:'no-store'}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'WNBA game logs are unavailable.');setTrend({state:'ready',rows:data.rows||[],error:null});}).catch(error=>setTrend({state:'error',rows:[],error:error.message}));};
 const switchTrendStat=key=>{const definition=WNBA_STATS.find(stat=>stat.key===key);const next=playerRows.find(row=>row.marketKey===key);if(next&&definition)setSelected({...next,market:definition.label});};
 if(selected)return <main className="unified-finder wnba-trend-page"><button type="button" className="wnba-trend-back" onClick={()=>setSelected(null)}><ArrowLeft size={17} aria-hidden="true"/>Back to WNBA Finder</button><header className="wnba-trend-title"><div className="wnba-player-cell"><img className="wnba-player-photo" src={selected.headshot} alt="" width="56" height="56"/><div><span>WNBA TRENDS</span><h1>{selected.player}</h1><p>{selected.market} · Line {selected.line}</p></div></div><div className="wnba-team-pair">{selected.awayTeamLogo&&<img src={selected.awayTeamLogo} alt=""/>}{selected.homeTeamLogo&&<img src={selected.homeTeamLogo} alt=""/>}</div></header>{trend.state==='error'?<div className="wnba-board-message"><Database size={22}/><strong>Trends unavailable</strong><span>{trend.error}</span></div>:<WNBATrendHost row={selected} playerRows={playerRows} logs={trend.rows} loading={trend.state==='loading'} onStat={switchTrendStat}/>}</main>;
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
    <label className="unified-market-filter"><ListFilter size={16} aria-hidden="true"/><span className="sr-only">Stat market</span><select value={market} onChange={event=>setMarket(event.target.value)}><option value="all">All stats</option>{markets.map(item=><option key={item}>{item}</option>)}</select><ChevronDown size={14} aria-hidden="true"/></label>
    <FilterButton icon={Trophy} label="Matches" disabled/>
    <FilterButton icon={CircleDot} label="Rankings" disabled/>
    <FilterButton icon={CalendarDays} label="Date" disabled/>
   </div>
  </section>
  {sport!=='wnba'&&sport!=='all'?<section className="unified-finder-stage" aria-live="polite">
   <div className="unified-finder-status-icon"><SearchCheck size={26} aria-hidden="true"/></div>
   <div><span>SPORT FOUNDATION</span><h2>{sport.toUpperCase()} is not connected yet.</h2><p>This workspace will only show a sport after its market and historical sources pass identity, freshness and coverage checks.</p></div>
   <div className="unified-finder-proof"><Database size={18} aria-hidden="true"/><span><strong>No mock props</strong><small>Every future row must retain its source and update time.</small></span></div>
  </section>:<section className="wnba-finder-board" aria-live="polite">
   <header><div><span>WNBA PROPS</span><strong>{board.state==='ready'?`${rows.length} verified lines`:'Loading verified lines…'}</strong><small>{board.fetchedAt?`Updated ${new Date(board.fetchedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`:'PrizePicks prioritized when available'}</small></div><button type="button" onClick={load} disabled={board.state==='loading'} aria-label="Refresh WNBA lines"><RefreshCw size={17} aria-hidden="true"/></button></header>
   {board.state==='error'?<div className="wnba-board-message"><Database size={22}/><strong>WNBA feed unavailable</strong><span>{board.error}</span></div>:board.state==='loading'?<div className="wnba-board-message"><span className="wnba-loader"/><strong>Loading the cached WNBA board</strong><span>Current lines are verified before display.</span></div>:rows.length===0?<div className="wnba-board-message"><SearchCheck size={22}/><strong>No matching WNBA props</strong><span>{board.rows.length?'Try a different player or stat.':'No supported books have posted a verified line yet.'}</span></div>:<div className="wnba-table-wrap"><table className="wnba-finder-table"><thead><tr><th>Player / prop</th><th>Game</th><th>Posted lines</th><th>Starts</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="wnba-clickable-row" tabIndex="0" role="button" aria-label={`Open ${row.player} ${row.market} trends`} onClick={()=>openTrend(row)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openTrend(row);}}}><td><div className="wnba-player-cell">{row.headshot?<img className="wnba-player-photo" src={row.headshot} alt="" width="48" height="48" loading="lazy"/>:<span className="wnba-player-fallback" aria-hidden="true">{row.player.split(' ').map(part=>part[0]).slice(0,2).join('')}</span>}<div><strong>{row.player}</strong><span>{row.position&&row.teamAbbr?`${row.position} · ${row.teamAbbr} · `:''}{row.market}</span><b>{row.line}</b></div></div></td><td><div className="wnba-matchup-cell"><span className="wnba-team-pair">{row.awayTeamLogo&&<img src={row.awayTeamLogo} alt="" width="30" height="30" loading="lazy"/>}{row.homeTeamLogo&&<img src={row.homeTeamLogo} alt="" width="30" height="30" loading="lazy"/>}</span><div><strong>{row.awayTeam} <i>@</i> {row.homeTeam}</strong><span>Open performance trends</span></div></div></td><td><div className="wnba-book-lines">{row.apps.map(app=><div className={`wnba-book-line ${app.key==='prizepicks'?'is-prizepicks':''}`} key={app.key}><span className="wnba-book-logo">{BOOK_LOGOS[app.key]?<img src={BOOK_LOGOS[app.key]} alt={app.name} width="28" height="28"/>:<b>{app.name.slice(0,2)}</b>}</span><span><small>OVER</small><b className="wnba-over">{fmtPrice(app.over)}</b></span><span><small>UNDER</small><b className="wnba-under">{fmtPrice(app.under)}</b></span></div>)}</div></td><td className="wnba-start-cell"><strong>{fmtStart(row.startsAt)}</strong><span>View trends →</span></td></tr>)}</tbody></table></div>}
  </section>}
 </main>;
}
