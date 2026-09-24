import React,{useEffect,useMemo,useRef,useState} from 'react';
import {RefreshCw,ArrowUpRight,Shield,LayoutGrid,Table2,ArrowUp,ArrowDown,ChevronDown,Search,Users,Swords,ChartNoAxesColumnIncreasing,Check,Target,CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';
import {NFL_PROP_DEFINITIONS} from './props';
import {rankResearch,researchPlayer,LINE_MAX_AGE_MS} from './research-board';
import {freshness} from './nfl-client';
import {teamLogoUrl} from './nfl-ui-core';

const WINDOW_COLUMNS=[['l5','L5'],['l10','L10'],['l15','L15'],['l20','L20'],['h2h','H2H']];
let boardCache=null;
// Matched to the server's props cache. At 90s this expired while a scan was
// still finishing, so leaving the board and coming straight back restarted
// all 16 games from scratch.
const BOARD_CACHE_TTL=600000;
// Static for the life of the module; was being rebuilt on every render.
const PROP_LABELS=Object.fromEntries(NFL_PROP_DEFINITIONS.map(p=>[p.key,p.label]));
// One scan at a time, shared process-wide. The NFL shell kicks this off as
// soon as the section opens (see SportResearch.jsx) so the slate is already
// scanned by the time anyone taps Props -- the scan is the slow part, and it
// used to only start when the board itself mounted, in full view.
//
// Nothing here is wasted work: research-board responses are cached
// server-side for 10 minutes, so repeat scans inside that window cost no
// Odds API credits, and the result lands in boardCache for the component to
// render immediately.
let pendingScan=null;
// Live state of the shared scan. A board that mounts partway through a
// prefetch has to be able to see it: without this it joined the promise and
// sat on "Checking 0 of ... games" for the whole scan, because the progress
// callbacks belonged to whoever started it.
let scanState=null;
const scanListeners=new Set();
function publishScan(next){ scanState=next; for(const listener of [...scanListeners]) listener(scanState); }
export function subscribeToScan(listener){
  scanListeners.add(listener);
  listener(scanState);
  return ()=>{ scanListeners.delete(listener); };
}
// Kicked off by the NFL shell as soon as the section opens (see
// SportResearch.jsx) so the slate is already scanned by the time anyone taps
// Props. Nothing is wasted: research-board responses are cached server-side
// for 10 minutes, so repeat scans inside that window cost no Odds API
// credits, and the result lands in boardCache for the component to render.
export function prefetchNFLBoard(load) {
  if(boardCache && Date.now()-boardCache.ts<BOARD_CACHE_TTL) return Promise.resolve(boardCache);
  if(pendingScan) return pendingScan;
  pendingScan=scanBoard(load).catch(()=>null).finally(()=>{ pendingScan=null; publishScan(null); });
  return pendingScan;
}
export function startBoardScan(load) {
  // Explicit refresh: ignore both caches and any scan already running.
  pendingScan=scanBoard(load).catch(()=>null).finally(()=>{ pendingScan=null; publishScan(null); });
  return pendingScan;
}
async function scanBoard(load) {
  publishScan({done:0,total:0,failed:0,rows:[],events:null});
  const listing=await load('prop-games');
  const upcoming=listing.data.filter(e=>Date.parse(e.startsAt)>Date.now()&&Date.parse(e.startsAt)<Date.now()+7*86400000);
  publishScan({done:0,total:upcoming.length,failed:0,rows:[],events:upcoming});
  const collected=[];
  let index=0;
  async function worker(){
    while(index<upcoming.length){
      const event=upcoming[index++];
      let batch=null;
      try{
        const response=await load('research-board',{eventId:event.eventId});
        batch=response.data.map(r=>({...r,injuryReportAvailable:response.injuryReportAvailable}));
        collected.push(...batch);
      }catch{ /* one bad game must not lose the slate */ }
      publishScan({...scanState,
        done:(scanState?.done||0)+1,
        failed:(scanState?.failed||0)+(batch?0:1),
        rows:batch?[...(scanState?.rows||[]),...batch]:(scanState?.rows||[]),
      });
    }
  }
  await Promise.all([worker(),worker(),worker(),worker(),worker()]);
  boardCache={rows:collected,events:upcoming,ts:Date.now()};
  return boardCache;
}

function sortRows(rows,sort){
 // No sort selected = the backend's own sample-adjusted-support ranking,
 // unchanged. Clicking a column re-sorts client-side by that column only;
 // it never silently replaces the validated default order.
 if(!sort)return rows;
 const {key,dir}=sort;
 const value=row=>key==='avg'?row.average:key==='diff'?(row.line?.value!=null?(row.average-row.line.value)*(row.line.direction==='UNDER'?-1:1):null):key==='matchup'?row.matchupQuality:row.windows?.[key]?.hitRate;
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

// Memoized per row: rows stream in one game at a time and a timer ticks the
// staleness clock, so without this every arriving batch repainted every
// already-rendered row (and every gradient cell in it).
// Takes the stable `players` array rather than a prebuilt player object:
// researchPlayer() returns a fresh object every call, which would change
// identity on each render and defeat the memo entirely.
const BoardRow=React.memo(function BoardRow({row,players,onOpen}){
 const player=researchPlayer(row,players);
 const rawDiff=row.line?.value!=null?row.average-row.line.value:null;
 const favorableDiff=rawDiff==null?null:rawDiff*(row.line.direction==='UNDER'?-1:1);
 return <tr className={player?'clickable':''} onClick={()=>player&&onOpen(player)}>
  <td className="nfl-board-cell-player"><img src={player?.headshot_url} width="48" height="48" loading="lazy" decoding="async" alt={`${row.playerName} headshot`}/><div><strong>{row.playerName}</strong><small>{row.line.direction==='OVER'?'More':'Less'} {row.line.value} {PROP_LABELS[row.propType]}</small><small className="nfl-board-cell-meta">{row.position} · {row.teamId} vs {row.opponentId}</small></div></td>
  <td className="nfl-board-cell" data-label="Avg"><strong>{Number(row.average.toFixed(1))}</strong></td>
  <td className="nfl-board-cell" data-label="Edge" data-tone={favorableDiff==null?'':favorableDiff>0?'good':favorableDiff<0?'low':'mid'}>{rawDiff==null?<span className="muted">—</span>:<strong>{`${rawDiff>0?'+':''}${rawDiff.toFixed(1)}`}</strong>}</td>
  {WINDOW_COLUMNS.map(([key,label])=><WindowCell w={row.windows?.[key]} label={label} key={key}/>)}
 </tr>;
});

function BoardTable({rows,players,onOpen,sort,onSort}){
 return <div className="nfl-board-table-wrap"><table className="nfl-board-table">
  <thead><tr><th>Player / line</th><SortHeader label="Avg" columnKey="avg" sort={sort} onSort={onSort}/><SortHeader label="Diff" columnKey="diff" sort={sort} onSort={onSort}/>{WINDOW_COLUMNS.map(([key,label])=><SortHeader key={key} label={label} columnKey={key} sort={sort} onSort={onSort}/>)}</tr></thead>
  <tbody>{rows.map(row=><BoardRow key={`${row.gameId}.${row.playerId}.${row.propType}`} row={row} players={players} onOpen={onOpen}/>)}</tbody>
 </table></div>;
}

function FilterMenu({label,Icon,options,selected,onToggle,renderOption}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState('');
 const root=useRef(null);
 useEffect(()=>{if(!open)return undefined;const close=e=>{if(!root.current?.contains(e.target))setOpen(false);};const escape=e=>{if(e.key==='Escape')setOpen(false);};document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);};},[open]);
 const visible=options.filter(option=>option.search.toLowerCase().includes(query.trim().toLowerCase()));
 return <div className="nfl-filter-menu" ref={root}>
  <button type="button" className={selected.length?'nfl-filter-trigger active':'nfl-filter-trigger'} aria-expanded={open} onClick={()=>setOpen(value=>!value)}><Icon aria-hidden="true"/><span>{label}</span>{selected.length>0&&<b>{selected.length}</b>}<ChevronDown aria-hidden="true"/></button>
  {open&&<div className="nfl-filter-popover" role="dialog" aria-label={`${label} filters`}>
   <label className="nfl-filter-search"><Search aria-hidden="true"/><span className="sr-only">Search {label}</span><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder={`Search ${label.toLowerCase()}…`}/></label>
   <div className="nfl-filter-options">{visible.map(option=>{const checked=selected.includes(option.value);return <button type="button" role="checkbox" aria-checked={checked} className={checked?'selected':''} key={option.value} onClick={()=>onToggle(option.value)}><span className="nfl-filter-check">{checked&&<Check/>}</span>{renderOption?renderOption(option):<span><strong>{option.label}</strong>{option.detail&&<small>{option.detail}</small>}</span>}</button>;})}{!visible.length&&<p>No matches</p>}</div>
   <footer><button type="button" onClick={()=>selected.forEach(onToggle)} disabled={!selected.length}>Clear</button><button type="button" onClick={()=>setOpen(false)}>Done</button></footer>
  </div>}
 </div>;
}

function HitRateMenu({windowKey,setWindowKey,min,setMin,max,setMax}){
 const [open,setOpen]=useState(false);const root=useRef(null);const active=min>0||max<100||windowKey!=='l10';
 useEffect(()=>{if(!open)return undefined;const close=e=>{if(!root.current?.contains(e.target))setOpen(false);};const escape=e=>{if(e.key==='Escape')setOpen(false);};document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);};},[open]);
 return <div className="nfl-filter-menu" ref={root}><button type="button" className={active?'nfl-filter-trigger active':'nfl-filter-trigger'} aria-expanded={open} onClick={()=>setOpen(v=>!v)}><ChartNoAxesColumnIncreasing/><span>Hit rate</span>{active&&<b>1</b>}<ChevronDown/></button>{open&&<div className="nfl-filter-popover nfl-hit-rate-popover" role="dialog" aria-label="Hit rate filters"><div className="nfl-filter-popover-title"><div><strong>Hit rate between</strong><small>Select a sample and verified range</small></div><button type="button" onClick={()=>{setWindowKey('l10');setMin(0);setMax(100);}}>Reset</button></div><div className="nfl-hit-window">{WINDOW_COLUMNS.map(([key,label])=><button type="button" key={key} className={windowKey===key?'active':''} onClick={()=>setWindowKey(key)}>{label}</button>)}</div><div className="nfl-hit-fields"><label>From<input type="number" min="0" max="100" value={min} onChange={e=>setMin(Math.max(0,Math.min(Number(e.target.value),max)))}/></label><label>To<input type="number" min="0" max="100" value={max} onChange={e=>setMax(Math.min(100,Math.max(Number(e.target.value),min)))}/></label></div><div className="nfl-hit-presets">{[55,60,70,80].map(value=><button type="button" key={value} onClick={()=>{setMin(value);setMax(100);}}>{value}%+</button>)}</div><footer><span>{windowKey.toUpperCase()} · {min}%–{max}%</span><button type="button" onClick={()=>setOpen(false)}>Apply</button></footer></div>}</div>;
}

export function NFLResearchBoard({load,players,onOpen}) {
 // Kept outside the component (module scope) so leaving the board -- opening
 // a player, then coming back to Home -- doesn't blank the screen and re-run
 // the whole "checking N of M games" scan. TTL matches the backend's posted
 // line freshness window (LINE_MAX_AGE_SECONDS in research_board.py), so a
 // "fresh" cache never shows a row the API would already have discarded --
 // and, unlike the old 90s, never expires mid-scan.
 const cached=boardCache && Date.now()-boardCache.ts<BOARD_CACHE_TTL ? boardCache : null;
 const [rows,setRows]=useState(()=>cached?.rows || []),[events,setEvents]=useState(()=>cached?.events || []),[progress,setProgress]=useState(null),[error,setError]=useState(''),[failed,setFailed]=useState(0),[refresh,setRefresh]=useState(0);
 const [query,setQuery]=useState(''),[positions,setPositions]=useState([]),[games,setGames]=useState([]),[teamsFilter,setTeamsFilter]=useState([]),[dates,setDates]=useState([]),[props,setProps]=useState([]),[hitWindow,setHitWindow]=useState('l10'),[hitMin,setHitMin]=useState(0),[hitMax,setHitMax]=useState(100),[now,setNow]=useState(Date.now());
 const [page,setPage]=useState(1),[rowsPerPage,setRowsPerPage]=useState(20);
 const [scannedAt,setScannedAt]=useState(cached?cached.ts:null);
 // Table now has its own mobile layout (see the max-width:640px block in
 // mobile-research.css, ported from the MLB finder's card treatment), so
 // it no longer needs to default to the simpler card view on phones.
 const [view,setView]=useState('table');
 // The prebuilt board, read in one request (api/nfl.py 'board'), the same
 // way MLB's tab reads whatever its last scan stored. It paints immediately
 // while the live scan is still running, and the live rows replace it the
 // moment they land.
 const [snapshotAt,setSnapshotAt]=useState(null);
 const [loadingBoard,setLoadingBoard]=useState(false);
 const [boardReason,setBoardReason]=useState('');
 const [sort,setSort]=useState(null);
 const onSort=key=>setSort(current=>current?.key===key?{key,dir:current.dir==='desc'?'asc':'desc'}:{key,dir:'desc'});
 // Only drives the 2-minute staleness filter, so it doesn't need to be
 // precise -- every tick re-filters and re-sorts the whole board.
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);

 useEffect(()=>{
  let active=true;
  const fresh=refresh===0 && boardCache && Date.now()-boardCache.ts<BOARD_CACHE_TTL;
  if(fresh){setRows(boardCache.rows);setEvents(boardCache.events);setError('');setFailed(0);setProgress(null);setScannedAt(boardCache.ts);return;}
  setRows([]);setError('');setFailed(0);

  // Follow the shared scan, whether this component starts it or joins one
  // the shell already had running.
  let unsubscribe=null;
  const runScan=()=>{
   if(!active)return;
   setProgress({done:0,total:0});
   unsubscribe=subscribeToScan(state=>{
    if(!active||!state)return;
    if(state.events)setEvents(state.events);
    setProgress({done:state.done,total:state.total});
    setFailed(state.failed);
    if(state.rows.length){setSnapshotAt(null);setRows(state.rows);}
   });
   (refresh===0?prefetchNFLBoard(load):startBoardScan(load)).then(result=>{
    if(!active)return;
    if(result){setSnapshotAt(null);setRows(result.rows);setEvents(result.events);setScannedAt(result.ts);}
    else setError('Live props could not load. Refresh to try again.');
   }).finally(()=>{if(active)setProgress(null);});
  };

  if(refresh!==0){ runScan(); return()=>{active=false;unsubscribe?.();}; }

  // Prefer the prebuilt board. It is one request and no scan at all, which
  // is the whole point of building it -- scanning 16 games live whenever the
  // client cache lapsed meant the "checking N of 16" counter came back every
  // ten minutes even though a finished board was sitting in the store.
  setLoadingBoard(true);
  // The very first request after a deploy has to BUILD the board, which can
  // take most of a minute. Waiting for it before doing anything meant
  // staring at a blank board with no progress -- so if it has not answered
  // quickly, start scanning live alongside it. The two share the same
  // per-event server cache, so whichever gets to a game first warms it for
  // the other; this is not double work.
  let scanning=false;
  const scanIfSlow=setTimeout(()=>{ if(active){ scanning=true; runScan(); } },1200);
  load('board').then(result=>{
   if(!active)return;
   const stored=result?.data||[];
   // Live rows beat a snapshot -- never replace a scan already under way.
   if(stored.length&&!scanning){
    clearTimeout(scanIfSlow);
    setRows(stored);
    if(result.events)setEvents(result.events);
    setSnapshotAt(result.builtAt||null);
    return;
   }
   if(result?.pending&&result.reason&&result.reason!=='another build is already running') setBoardReason(String(result.reason));
   if(!scanning){ clearTimeout(scanIfSlow); scanning=true; runScan(); }
  }).catch(()=>{ if(active&&!scanning){ clearTimeout(scanIfSlow); scanning=true; runScan(); } })
    .finally(()=>{ if(active) setLoadingBoard(false); });
  return()=>{active=false;clearTimeout(scanIfSlow);unsubscribe?.();};
 },[load,refresh]);
 // Filters and sorts the entire board; was re-running on every render,
 // including each of the ~16 streamed row batches and every timer tick.
 // While showing the prebuilt board the posted-line age window is lifted:
 // it is a snapshot, deliberately older than the live window, and applying
 // that window to it would filter every row away. The caption says which
 // one you are looking at rather than hiding the difference.
 const toggle=(setter,value)=>setter(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value]);
 const ranked=useMemo(()=>rankResearch(rows,{now,maxAge:snapshotAt?Infinity:LINE_MAX_AGE_MS}).filter(row=>{
  if(positions.length&&!positions.includes(row.position))return false;
  if(games.length&&!games.includes(row.gameId))return false;
  if(teamsFilter.length&&!teamsFilter.some(team=>team===row.teamId||team===row.opponentId))return false;
  if(dates.length&&!dates.includes(new Date(row.startsAt).toLocaleDateString('en-CA')))return false;
  if(props.length&&!props.includes(row.propType))return false;
  if(query.trim()&&!row.playerName.toLowerCase().includes(query.trim().toLowerCase()))return false;
  const rate=row.windows?.[hitWindow]?.hitRate;
  if(rate==null)return hitWindow==='l10'&&hitMin===0&&hitMax===100;
  return rate>=hitMin&&rate<=hitMax;
 }),[rows,query,positions,games,teamsFilter,dates,props,hitWindow,hitMin,hitMax,now,snapshotAt]);
 const positionOptions=['QB','RB','WR','TE'].map(value=>({value,label:value,search:value}));
 const gameOptions=events.map(event=>({value:event.gameId,label:`${event.awayTeamId} @ ${event.homeTeamId}`,detail:new Date(event.startsAt).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'}),search:`${event.awayTeamId} ${event.homeTeamId}`}));
 const teamOptions=[...new Set(events.flatMap(event=>[event.awayTeamId,event.homeTeamId]))].sort().map(value=>({value,label:value,search:value}));
 const dateOptions=[...new Map(events.map(event=>{const value=new Date(event.startsAt).toLocaleDateString('en-CA');return [value,{value,label:new Date(event.startsAt).toLocaleDateString([],{weekday:'long',month:'short',day:'numeric'}),search:value}]})).values()];
 const propOptions=NFL_PROP_DEFINITIONS.map(item=>({value:item.key,label:item.label,search:item.label}));
 const filterCount=positions.length+games.length+teamsFilter.length+dates.length+props.length+(hitMin>0||hitMax<100||hitWindow!=='l10'?1:0);
 const ordered=useMemo(()=>sortRows(ranked,sort),[ranked,sort]);
 const pageCount=Math.max(1,Math.ceil(ordered.length/rowsPerPage));
 const paged=ordered.slice((Math.min(page,pageCount)-1)*rowsPerPage,Math.min(page,pageCount)*rowsPerPage);
 useEffect(()=>setPage(1),[query,positions,games,teamsFilter,dates,props,hitWindow,hitMin,hitMax,sort,rowsPerPage]);
 return <section className="nfl-discovery" aria-label="NFL props board">
  <header><div><h2>NFL props</h2><p>PrizePicks · Next 7 days</p></div><div className="nfl-board-view-toggle" role="group" aria-label="Board layout"><button type="button" aria-pressed={view==='cards'} onClick={()=>setView('cards')} aria-label="Card view"><LayoutGrid size={16}/></button><button type="button" aria-pressed={view==='table'} onClick={()=>setView('table')} aria-label="Table view"><Table2 size={16}/></button></div><button type="button" className="nfl-refresh" disabled={!!progress} aria-label="Refresh NFL props board" onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={18}/></button></header>
  <div className="nfl-finder-topline"><label className="nfl-finder-search"><Search/><span className="sr-only">Search players</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search players…"/></label><div className="nfl-platform-summary"><img src="/prizepicks/logo.png" alt=""/><span>PrizePicks fixed</span><small>Verified standard lines</small></div></div>
  <div className="nfl-board-filterbar" aria-label="NFL prop filters">
   <FilterMenu label="Positions" Icon={Users} options={positionOptions} selected={positions} onToggle={value=>toggle(setPositions,value)}/>
   <FilterMenu label="Stats" Icon={Target} options={propOptions} selected={props} onToggle={value=>toggle(setProps,value)}/>
   <FilterMenu label="Games" Icon={Swords} options={gameOptions} selected={games} onToggle={value=>toggle(setGames,value)} renderOption={option=>{const event=events.find(item=>item.gameId===option.value);return <span className="nfl-game-filter-option"><span><img src={teamLogoUrl(event?.awayTeamId)} alt=""/><strong>{event?.awayTeamId}</strong></span><em>@</em><span><img src={teamLogoUrl(event?.homeTeamId)} alt=""/><strong>{event?.homeTeamId}</strong></span><small>{option.detail}</small></span>;}}/>
   <FilterMenu label="Teams" Icon={Shield} options={teamOptions} selected={teamsFilter} onToggle={value=>toggle(setTeamsFilter,value)} renderOption={option=><span className="nfl-team-filter-option"><img src={teamLogoUrl(option.value)} alt=""/><strong>{option.label}</strong></span>}/>
   <FilterMenu label="Date" Icon={CalendarDays} options={dateOptions} selected={dates} onToggle={value=>toggle(setDates,value)}/>
   <HitRateMenu windowKey={hitWindow} setWindowKey={setHitWindow} min={hitMin} setMin={setHitMin} max={hitMax} setMax={setHitMax}/>
   {filterCount>0&&<button type="button" className="nfl-filter-reset" onClick={()=>{setPositions([]);setGames([]);setTeamsFilter([]);setDates([]);setProps([]);setHitWindow('l10');setHitMin(0);setHitMax(100);}}><X/>Clear all <b>{filterCount}</b></button>}
  </div>
  {(progress||failed>0||scannedAt||snapshotAt||loadingBoard||boardReason)&&<div role="status" className="nfl-board-caption">{loadingBoard&&!progress&&'Loading props…'}{progress&&(progress.total?`Checking ${progress.done} of ${progress.total} games…`:'Finding games…')}{!progress&&scannedAt&&`${ranked.length} props · ${freshness(new Date(scannedAt).toISOString(),now,LINE_MAX_AGE_MS)}`}{!scannedAt&&snapshotAt&&`${ranked.length} props · lines as of ${new Date(snapshotAt).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'})}${progress?' · refreshing':''}`}{failed>0&&`${progress||scannedAt?' · ':''}${failed} games could not load`}{boardReason&&!ranked.length&&` · prebuilt board unavailable (${boardReason})`}</div>}
  {error&&<p role="alert">{error}</p>}
  {!progress&&!loadingBoard&&!ranked.length&&!error&&<div className="nfl-chart-card">No fresh props match this view. Try another filter or refresh. Players remain available in Research.</div>}
  {view==='table'?<BoardTable rows={paged} players={players} onOpen={onOpen} sort={sort} onSort={onSort}/>:
  <div className="nfl-discovery-grid">{paged.map(row=>{const player=researchPlayer(row,players);return <button type="button" className="nfl-discovery-card" key={`${row.gameId}.${row.playerId}.${row.propType}`} disabled={!player} onClick={()=>onOpen(player)}>
   <div className="nfl-discovery-identity">{player?.headshot_url&&<img src={player.headshot_url} width="64" height="64" loading="lazy" decoding="async" alt={`${row.playerName} headshot`}/>}<div><strong>{row.playerName}</strong><small>{row.position} · {row.teamId} vs {row.opponentId} · {new Date(row.startsAt).toLocaleDateString([],{weekday:'short'})}</small></div><ArrowUpRight size={18}/></div>
   <div className="nfl-discovery-line"><img src="/prizepicks/logo.png" width="22" height="22" alt="PrizePicks"/><strong>{row.line.direction==='OVER'?'More':'Less'} {row.line.value} {PROP_LABELS[row.propType]}</strong></div>
   <div className="nfl-discovery-stats"><span>Last {row.recentSample}<b>{row.recentHits}/{row.recentDecisions} hit</b></span><span>Sample<b>{row.hits}/{row.decisions} hit</b></span><span>Average<b>{Number(row.average.toFixed(1))}</b></span></div>
   {row.opponentVolume && <div className={`nfl-discovery-volume ${row.opponentVolume.score>=60?'good':row.opponentVolume.score<=40?'bad':'mid'}`}><Shield size={14}/><span>{row.opponentVolume.label}: {row.opponentVolume.score}th percentile vs league</span></div>}
   <small className="nfl-board-caption">{row.seasons.join(' / ')} · {row.sample} games{row.pushes?` · ${row.pushes} pushes`:''} · {row.injuryReportAvailable?'Open research':'Injury report unavailable'}</small>
  </button>;})}</div>}
  {ordered.length>0&&<nav className="nfl-board-pagination" aria-label="NFL props pages"><button type="button" onClick={()=>setPage(value=>Math.max(1,value-1))} disabled={page<=1} aria-label="Previous page"><ChevronLeft/></button><span>Page <b>{Math.min(page,pageCount)}</b> of {pageCount}</span><button type="button" onClick={()=>setPage(value=>Math.min(pageCount,value+1))} disabled={page>=pageCount} aria-label="Next page"><ChevronRight/></button><label>Rows<select value={rowsPerPage} onChange={event=>setRowsPerPage(Number(event.target.value))}><option value="20">20</option><option value="40">40</option><option value="60">60</option></select></label></nav>}
 </section>;
}
