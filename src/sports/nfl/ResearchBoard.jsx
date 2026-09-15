import React,{useEffect,useMemo,useState} from 'react';
import {RefreshCw,ArrowUpRight,Shield,LayoutGrid,Table2,ArrowUp,ArrowDown,Target} from 'lucide-react';
import {SheetSelect} from './ResearchSheet';
import {Select,SelectTrigger,SelectContent,SelectItem} from '../../../components/ui/select';
import {NFL_PROP_DEFINITIONS} from './props';
import {rankResearch,researchPlayer} from './research-board';

const WINDOW_COLUMNS=[['l5','L5'],['l10','L10'],['l15','L15'],['l20','L20'],['h2h','H2H']];
let boardCache=null;
const BOARD_CACHE_TTL=90000;
// Static for the life of the module; was being rebuilt on every render.
const PROP_LABELS=Object.fromEntries(NFL_PROP_DEFINITIONS.map(p=>[p.key,p.label]));

function sortRows(rows,sort){
 // No sort selected = the backend's own sample-adjusted-support ranking,
 // unchanged. Clicking a column re-sorts client-side by that column only;
 // it never silently replaces the validated default order.
 if(!sort)return rows;
 const {key,dir}=sort;
 const value=row=>key==='avg'?row.average:key==='diff'?(row.line?.value!=null?row.average-row.line.value:null):key==='matchup'?row.matchupQuality:row.windows?.[key]?.hitRate;
 return [...rows].sort((a,b)=>{const av=value(a),bv=value(b);if(av==null&&bv==null)return 0;if(av==null)return 1;if(bv==null)return -1;return dir==='asc'?av-bv:bv-av;});
}

function SortHeader({label,columnKey,sort,onSort}){
 const active=sort?.key===columnKey;
 return <th><button type="button" className={active?'active':''} onClick={()=>onSort(columnKey)}>{label}{active&&(sort.dir==='desc'?<ArrowDown size={12}/>:<ArrowUp size={12}/>)}</button></th>;
}

// Same three tiers/thresholds and the same data-tone attribute name as
// the MLB pitcher finder's own board (app.js's renderPitcherComparison:
// `pct >= 70 ? 'good' : pct >= 45 ? 'mid' : 'low'`), so this is the same
// design applied here rather than a fresh guess at one.
const heatTone=(value,good=70,mid=45)=>value==null?'':value>=good?'good':value>=mid?'mid':'low';

function WindowCell({w,label}){
 if(!w||w.hitRate==null)return <td className="nfl-board-cell muted" data-label={label}>—</td>;
 return <td className="nfl-board-cell" data-label={label} data-tone={heatTone(w.hitRate)}><strong>{Math.round(w.hitRate)}%</strong><small>{w.hits}-{w.misses}{w.pushes?` · ${w.pushes}p`:''}</small></td>;
}

function MatchupCell({row}){
 if(row.matchupQuality==null)return <td className="nfl-board-cell muted" data-label="Matchup">—</td>;
 return <td className="nfl-board-cell" data-label="Matchup" data-tone={heatTone(row.matchupQuality,65,45)}><strong>{row.matchupQuality}</strong><small>{row.matchupCoverage}% cov.</small></td>;
}

// Memoized per row: rows stream in one game at a time and a timer ticks the
// staleness clock, so without this every arriving batch repainted every
// already-rendered row (and every gradient cell in it).
// Takes the stable `players` array rather than a prebuilt player object:
// researchPlayer() returns a fresh object every call, which would change
// identity on each render and defeat the memo entirely.
const BoardRow=React.memo(function BoardRow({row,players,onOpen}){
 const player=researchPlayer(row,players);
 const diff=row.line?.value!=null?row.average-row.line.value:null;
 return <tr className={player?'clickable':''} onClick={()=>player&&onOpen(player)}>
  <td className="nfl-board-cell-player"><img src={player?.headshot_url} width="32" height="32" loading="lazy" alt=""/><div><strong>{row.playerName}</strong><small>{row.line.direction==='OVER'?'More':'Less'} {row.line.value} {PROP_LABELS[row.propType]}</small><small className="nfl-board-cell-meta">{row.position} · {row.teamId} vs {row.opponentId}</small></div></td>
  <td className="nfl-board-cell" data-label="Avg"><strong>{Number(row.average.toFixed(1))}</strong></td>
  <td className="nfl-board-cell" data-label="Diff" data-tone={diff==null?'':diff>0?'good':diff<0?'low':'mid'}>{diff==null?<span className="muted">—</span>:<strong>{`${diff>0?'+':''}${diff.toFixed(1)}`}</strong>}</td>
  <MatchupCell row={row}/>
  {WINDOW_COLUMNS.map(([key,label])=><WindowCell w={row.windows?.[key]} label={label} key={key}/>)}
 </tr>;
});

function BoardTable({rows,players,onOpen,sort,onSort}){
 const sorted=useMemo(()=>sortRows(rows,sort),[rows,sort]);
 return <div className="nfl-board-table-wrap"><table className="nfl-board-table">
  <thead><tr><th>Player / line</th><SortHeader label="Avg" columnKey="avg" sort={sort} onSort={onSort}/><SortHeader label="Diff" columnKey="diff" sort={sort} onSort={onSort}/><SortHeader label="Matchup" columnKey="matchup" sort={sort} onSort={onSort}/>{WINDOW_COLUMNS.map(([key,label])=><SortHeader key={key} label={label} columnKey={key} sort={sort} onSort={onSort}/>)}</tr></thead>
  <tbody>{sorted.map(row=><BoardRow key={`${row.gameId}.${row.playerId}.${row.propType}`} row={row} players={players} onOpen={onOpen}/>)}</tbody>
 </table></div>;
}

export function NFLResearchBoard({load,players,onOpen}) {
 // Kept outside the component (module scope) so leaving the board -- opening
 // a player, then coming back to Home -- doesn't blank the screen and re-run
 // the whole "checking N of M games" scan. TTL sits just under the backend's
 // own 2-minute posted-line freshness window (research_board.py), so a
 // "fresh" cache never shows a row the API would already have discarded.
 const cached=boardCache && Date.now()-boardCache.ts<BOARD_CACHE_TTL ? boardCache : null;
 const [rows,setRows]=useState(()=>cached?.rows || []),[events,setEvents]=useState(()=>cached?.events || []),[progress,setProgress]=useState(null),[error,setError]=useState(''),[failed,setFailed]=useState(0),[refresh,setRefresh]=useState(0);
 const [position,setPosition]=useState(''),[game,setGame]=useState(''),[prop,setProp]=useState(''),[now,setNow]=useState(Date.now());
 // Table now has its own mobile layout (see the max-width:640px block in
 // mobile-research.css, ported from the MLB finder's card treatment), so
 // it no longer needs to default to the simpler card view on phones.
 const [view,setView]=useState('table');
 const [sort,setSort]=useState(null);
 const onSort=key=>setSort(current=>current?.key===key?{key,dir:current.dir==='desc'?'asc':'desc'}:{key,dir:'desc'});
 // Only drives the 2-minute staleness filter, so it doesn't need to be
 // precise -- every tick re-filters and re-sorts the whole board.
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{
  let active=true;
  const fresh=refresh===0 && boardCache && Date.now()-boardCache.ts<BOARD_CACHE_TTL;
  if(fresh){setRows(boardCache.rows);setEvents(boardCache.events);setError('');setFailed(0);setProgress(null);return;}
  setRows([]);setError('');setFailed(0);setProgress({done:0,total:0});
  const collected=[];
  (async()=>{
   try {
    const listing=await load('prop-games');
    const upcoming=listing.data.filter(e=>Date.parse(e.startsAt)>Date.now()&&Date.parse(e.startsAt)<Date.now()+7*86400000);
    if(!active)return;setEvents(upcoming);setProgress({done:0,total:upcoming.length});
    let index=0;
    // No setNow() here: it only feeds the staleness filter, and bumping it
    // per finished game forced an extra full re-filter/re-sort/repaint of
    // everything already on screen, on top of the setRows append.
    async function worker(){while(active&&index<upcoming.length){const event=upcoming[index++];try{const response=await load('research-board',{eventId:event.eventId});const withMeta=response.data.map(r=>({...r,injuryReportAvailable:response.injuryReportAvailable}));collected.push(...withMeta);if(active)setRows(old=>[...old,...withMeta]);}catch{if(active)setFailed(n=>n+1);}finally{if(active)setProgress(p=>({...p,done:p.done+1}));}}}
    await Promise.all([worker(),worker(),worker(),worker(),worker()]);
    if(active)boardCache={rows:collected,events:upcoming,ts:Date.now()};
   }catch{if(active)setError('Live props could not load. Refresh to try again.');}
   finally{if(active)setProgress(null);}
  })();return()=>{active=false;};
 },[load,refresh]);
 // Filters and sorts the entire board; was re-running on every render,
 // including each of the ~16 streamed row batches and every timer tick.
 const ranked=useMemo(()=>rankResearch(rows,{position,game,prop,now}),[rows,position,game,prop,now]);
 return <section className="nfl-discovery" aria-label="NFL props board">
  <header><div><h2>NFL props</h2><p>PrizePicks · Next 7 days</p></div><div className="nfl-board-view-toggle" role="group" aria-label="Board layout"><button type="button" aria-pressed={view==='cards'} onClick={()=>setView('cards')} aria-label="Card view"><LayoutGrid size={16}/></button><button type="button" aria-pressed={view==='table'} onClick={()=>setView('table')} aria-label="Table view"><Table2 size={16}/></button></div><button type="button" className="nfl-refresh" disabled={!!progress} aria-label="Refresh NFL props board" onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={18}/></button></header>
  <div className="nfl-board-filters"><SheetSelect label="Position" value={position} onChange={e=>setPosition(e.target.value)}><option value="">Position</option>{['QB','RB','WR','TE'].map(p=><option key={p}>{p}</option>)}</SheetSelect><SheetSelect label="Game" value={game} onChange={e=>setGame(e.target.value)}><option value="">All games</option>{events.map(e=><option key={e.gameId} value={e.gameId}>{e.awayTeamId} @ {e.homeTeamId}</option>)}</SheetSelect>
   <Select value={prop} onValueChange={setProp}>
    <SelectTrigger icon={Target} placeholder="All props" aria-label="Prop" />
    <SelectContent>
     <SelectItem index={0} value="">All props</SelectItem>
     {NFL_PROP_DEFINITIONS.map((p,i)=><SelectItem key={p.key} index={i+1} value={p.key}>{p.label}</SelectItem>)}
    </SelectContent>
   </Select>
  </div>
  {(progress||failed>0)&&<div role="status" className="nfl-board-caption">{progress&&`Checking ${progress.done} of ${progress.total || '…'} games…`}{failed>0&&`${progress?' · ':''}${failed} games could not load`}</div>}
  {error&&<p role="alert">{error}</p>}
  {!progress&&!ranked.length&&!error&&<div className="nfl-chart-card">No fresh props match this view. Try another filter or refresh. Players remain available in Research.</div>}
  {view==='table'?<BoardTable rows={ranked} players={players} onOpen={onOpen} sort={sort} onSort={onSort}/>:
  <div className="nfl-discovery-grid">{ranked.map(row=>{const player=researchPlayer(row,players);return <button type="button" className="nfl-discovery-card" key={`${row.gameId}.${row.playerId}.${row.propType}`} disabled={!player} onClick={()=>onOpen(player)}>
   <div className="nfl-discovery-identity">{player?.headshot_url&&<img src={player.headshot_url} width="58" height="58" loading="lazy" alt=""/>}<div><strong>{row.playerName}</strong><small>{row.position} · {row.teamId} vs {row.opponentId} · {new Date(row.startsAt).toLocaleDateString([],{weekday:'short'})}</small></div><ArrowUpRight size={18}/></div>
   <div className="nfl-discovery-line"><img src="/prizepicks/logo.png" width="22" height="22" alt="PrizePicks"/><strong>{row.line.direction==='OVER'?'More':'Less'} {row.line.value} {PROP_LABELS[row.propType]}</strong></div>
   <div className="nfl-discovery-stats"><span>Last {row.recentSample}<b>{row.recentHits}/{row.recentDecisions} hit</b></span><span>Sample<b>{row.hits}/{row.decisions} hit</b></span><span>Average<b>{Number(row.average.toFixed(1))}</b></span></div>
   {row.matchupQuality!=null && <div className={`nfl-discovery-volume ${row.matchupQuality>=65?'good':row.matchupQuality<=35?'bad':'mid'}`}><Shield size={14}/><span>Matchup score {row.matchupQuality}/100 · {row.matchupCoverage}% coverage</span></div>}
   {row.opponentVolume && <div className={`nfl-discovery-volume ${row.opponentVolume.score>=60?'good':row.opponentVolume.score<=40?'bad':'mid'}`}><Shield size={14}/><span>{row.opponentVolume.label}: {row.opponentVolume.score}th percentile vs league</span></div>}
   <small className="nfl-board-caption">{row.seasons.join(' / ')} · {row.sample} games{row.pushes?` · ${row.pushes} pushes`:''} · {row.injuryReportAvailable?'Open research':'Injury report unavailable'}</small>
  </button>;})}</div>}
 </section>;
}
