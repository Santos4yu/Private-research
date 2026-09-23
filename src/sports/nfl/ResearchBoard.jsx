import React,{useEffect,useMemo,useState} from 'react';
import {RefreshCw,ArrowUpRight,Shield,LayoutGrid,Table2,ArrowUp,ArrowDown,Target} from 'lucide-react';
import {SheetSelect} from './ResearchSheet';
import {Select,SelectTrigger,SelectContent,SelectItem} from '../../../components/ui/select';
import {NFL_PROP_DEFINITIONS} from './props';
import {rankResearch,researchPlayer,LINE_MAX_AGE_MS} from './research-board';
import {freshness} from './nfl-client';

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
 // the whole "checking N of M games" scan. TTL matches the backend's posted
 // line freshness window (LINE_MAX_AGE_SECONDS in research_board.py), so a
 // "fresh" cache never shows a row the API would already have discarded --
 // and, unlike the old 90s, never expires mid-scan.
 const cached=boardCache && Date.now()-boardCache.ts<BOARD_CACHE_TTL ? boardCache : null;
 const [rows,setRows]=useState(()=>cached?.rows || []),[events,setEvents]=useState(()=>cached?.events || []),[progress,setProgress]=useState(null),[error,setError]=useState(''),[failed,setFailed]=useState(0),[refresh,setRefresh]=useState(0);
 const [position,setPosition]=useState(''),[game,setGame]=useState(''),[prop,setProp]=useState(''),[now,setNow]=useState(Date.now());
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
  load('board').then(result=>{
   if(!active)return;
   const stored=result?.data||[];
   if(stored.length){
    setRows(stored);
    if(result.events)setEvents(result.events);
    setSnapshotAt(result.builtAt||null);
    return;
   }
   runScan();   // nothing built yet -- scan live, as before
  }).catch(()=>{ if(active) runScan(); })
    .finally(()=>{ if(active) setLoadingBoard(false); });
  return()=>{active=false;unsubscribe?.();};
 },[load,refresh]);
 // Filters and sorts the entire board; was re-running on every render,
 // including each of the ~16 streamed row batches and every timer tick.
 // While showing the prebuilt board the posted-line age window is lifted:
 // it is a snapshot, deliberately older than the live window, and applying
 // that window to it would filter every row away. The caption says which
 // one you are looking at rather than hiding the difference.
 const ranked=useMemo(()=>rankResearch(rows,{position,game,prop,now,maxAge:snapshotAt?Infinity:LINE_MAX_AGE_MS}),[rows,position,game,prop,now,snapshotAt]);
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
  {(progress||failed>0||scannedAt||snapshotAt||loadingBoard)&&<div role="status" className="nfl-board-caption">{loadingBoard&&!progress&&'Loading props…'}{progress&&(progress.total?`Checking ${progress.done} of ${progress.total} games…`:'Finding games…')}{!progress&&scannedAt&&`${ranked.length} props · ${freshness(new Date(scannedAt).toISOString(),now,LINE_MAX_AGE_MS)}`}{!scannedAt&&snapshotAt&&`${ranked.length} props · lines as of ${new Date(snapshotAt).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'})}${progress?' · refreshing':''}`}{failed>0&&`${progress||scannedAt?' · ':''}${failed} games could not load`}</div>}
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
