import React,{lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowDown,ArrowUp,ArrowUpDown,ArrowLeft,Bookmark,ChartNoAxesColumnIncreasing,ChevronDown,ChevronLeft,ChevronRight,Grid2X2,ListFilter,LoaderCircle,RefreshCw,Search,SlidersHorizontal,Star,Table2,Trash2,Users,CalendarDays,Settings,UserRound,X} from 'lucide-react';
import {loadFinderSport,enrichMlbRows,enrichWnbaRows,persistFinderCache,readFinderCache,matchesPrizePicksLine,finderSlipId,slipApps,bookProbability,loadFinderDefense,withDefense,BOOK_NAMES} from './unified-finder-data';
import {WNBAPlayerPage} from './sports/wnba/WNBAPlayerPage';
import {siteFinderSportAllowed} from './site-access';
import {LEAGUE_LOGOS} from './league-logos';
import './unified-finder.css';
import {FinderDropdown,FinderDropdownAssets} from './FinderDropdown';
import {FinderHitRateFilter,FinderMultiSelect} from './FinderMultiSelect';
import {PickSideMenu} from './PickSideMenu';
import {pickBuilder,usePickBuilder} from './pick-builder-client';
const FinderTrendView=lazy(()=>import('./FinderTrendView').then(m=>({default:m.FinderTrendView})));
const SPORTS=['all','wnba','mlb','nfl'],KEYS=SPORTS.slice(1),EMPTY={state:'idle',rows:[]};
const LOGOS={prizepicks:'/prizepicks/logo.png',draftkings:'/sportsbooks/draftkings.png',fanduel:'/sportsbooks/fanduel.png',betmgm:'/sportsbooks/betmgm.png',underdog:'/sportsbooks/underdog.png'};
const WINDOWS=[['l5','L5'],['l10','L10'],['l15','L15'],['h2h','H2H'],['season','SZN']];
// With no sort chosen the board runs L10 high to low.
const DEFAULT_SORT={key:'l10',direction:'desc'};
const MOBILE_SORTS=[['l5','L5'],['l10','L10'],['l15','L15'],['h2h','H2H'],['streak','Strk'],['average','AVG'],['diff','Diff'],['defense','Defense'],['line','Line'],['season','SZN']];
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const num=v=>finite(v)?Number(v.toFixed(1)).toLocaleString():'—';
const price=v=>finite(v)?(v>0?'+':'')+v:'—';
const tone=v=>!finite(v)?'none':v>=70?'good':v>=45?'mid':'low';
const dayKey=v=>Number.isFinite(Date.parse(v))?new Date(v).toLocaleDateString('en-CA'):'';
const when=v=>Number.isFinite(Date.parse(v))?new Date(v).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'}):'';
const bookName=k=>BOOK_NAMES[k]||k;
function Photo({src,className='',fallback=null,...props}){const [bad,setBad]=useState(false);useEffect(()=>setBad(false),[src]);return src&&!bad?<img src={src} alt="" className={className} onError={()=>setBad(true)} {...props}/>:fallback;}

function League({sport}){return <img src={LEAGUE_LOGOS[sport]} alt="" className="finder-league" width="17" height="19"/>;}
function Heading({label,name,sort,onSort}){const active=sort.key===name;return <th scope="col" aria-sort={active?(sort.direction==='desc'?'descending':'ascending'):'none'}><button type="button" className={active?'is-sorted':''} onClick={()=>onSort(name)}>{label}{active?(sort.direction==='desc'?<ArrowDown size={12}/>:<ArrowUp size={12}/>):<ArrowUpDown size={11}/>}</button></th>;}
function Heat({value,kind,detail,loading}){return <td className="finder-stat"><div className="finder-heat" data-tone={kind||tone(value)}>{finite(value)?<><strong>{num(value)}{!kind?'%':''}</strong>{detail&&<small>{detail}</small>}</>:<span className="finder-no-data" title={loading?'Loading history':'No verified sample'}>{loading?'…':'—'}</span>}</div></td>;}
function Books({apps=[]}){return <div className="finder-books">{apps.slice(0,2).map(app=><div className="finder-book" key={app.key} title={app.name||bookName(app.key)}><Photo src={LOGOS[app.key]||'/sportsbooks/'+app.key+'.png'} width="25" height="25" fallback={<span className="finder-book-fallback">{(app.name||app.key||'?').slice(0,2)}</span>}/><span>{finite(app.over)||finite(app.under)?<><span><b className="finder-over">O</b> {price(app.over)}</span><span><b className="finder-under">U</b> {price(app.under)}</span></>:<small>More / Less</small>}</span></div>)}{apps.length>2&&<span className="finder-extra" title={apps.slice(2).map(a=>bookName(a.key)+': O '+price(a.over)+' / U '+price(a.under)).join('; ')}>+{apps.length-2}</span>}</div>;}
// The sportsbooks' no-vig chance for the line (unified-finder-data.js
// bookProbability). Pick'em apps price both sides the same, so they are left
// out; a line only they post shows a dash rather than a made-up 50/50.
function Probability({apps=[]}){const chance=bookProbability(apps);if(!chance)return <div className="finder-probability is-empty" title="No sportsbook prices this line, so there is no market lean to show. Pick'em apps price both sides the same."><span aria-label="No sportsbook odds">—</span></div>;return <div className="finder-probability" style={{'--over':chance.over.toFixed(1)}} title={'Over chance from the books\u2019 prices, margin removed: '+chance.books.map(book=>book.name+' '+book.over.toFixed(1)+'%'+(book.twoSided?'':' (Over only)')).join(', ')+(chance.books.length>1?'. Weighted average.':'.')+' Not a model prediction.'}>{[['O',chance.over],['U',chance.under]].map(([label,value])=><span key={label}>{label} <b>{value.toFixed(1)+'%'}</b></span>)}</div>;}
// The opponent's rank against this position in this stat. Rank 1 allows the
// least; for an Over, a high rank (a defense that gives up a lot) is good.
function Defense({row}){if(!finite(row.defense))return null;const n=row.defenseTeams||0,third=Math.ceil(n/3),rank=row.defense;const toneName=!n?'none':rank>n-third?'good':rank<=third?'low':'mid';return <span className="finder-defense" data-tone={toneName} title={row.opponent+' ranks '+rank+(n?' of '+n:'')+' in what it allows to this position in this stat (1 allows the least).'}>DEF {rank}{n?'/'+n:''}</span>;}
const Row=React.memo(function Row({row,onOpen,pick,onPick}){
 const record=w=>w?String(w.hits??0)+'/'+((w.hits??0)+(w.misses??0))+(w.pushes?' · '+w.pushes+'P':''):'';
 const delta=finite(row.average)?row.average-row.line:null,edge=row.diff,loading=row.historyStatus==='pending';
 return <tr onClick={()=>onOpen(row)}><td className="finder-player-cell"><div className="finder-player"><div className="finder-portrait-wrap"><Photo src={row.headshot} className="finder-portrait" width="38" height="38" loading="lazy" fallback={<span className="finder-portrait finder-initials">{row.player.split(' ').map(p=>p[0]).slice(0,2).join('')}</span>}/><button className="finder-star" type="button" data-requires-tab="saved" aria-label={pick?row.player+' '+row.line+' '+row.market+' is in your picks ('+pick+'). Change or remove':'Add '+row.player+' '+row.line+' '+row.market+' to your picks'} aria-haspopup="dialog" aria-pressed={Boolean(pick)} data-side={pick?pick.toLowerCase():undefined} onClick={e=>{e.stopPropagation();onPick(row,e.currentTarget);}}><Star size={11} fill={pick?'currentColor':'none'}/></button></div><button type="button" className="finder-open" onClick={e=>{e.stopPropagation();onOpen(row);}} aria-label={'Open '+row.sport.toUpperCase()+' '+row.player+' '+row.line+' '+row.market+' trends'}><span className="finder-name">{row.player} {row.position&&<em>({row.position})</em>}</span><span className="finder-market"><League sport={row.sport}/><b>{row.direction==='UNDER'?'U ':''}{row.line}</b> {row.market}{['goblin','demon'].includes(row.modifier)&&<img src={'/prizepicks/'+row.modifier+'.png'} alt={row.modifier} width="14" height="14"/>}</span><span className="finder-game">{row.teamAbbr||row.sport.toUpperCase()}{row.opponent?' vs '+row.opponent:''}{row.startsAt?' · '+when(row.startsAt):''}<Defense row={row}/></span></button></div></td><td><Books apps={row.apps}/></td><td className="finder-prob-cell"><Probability apps={row.apps}/></td><Heat value={row.average} kind={tone(row.windows?.l10?.hitRate)} loading={loading}/><Heat value={delta} kind={edge==null?'none':edge>0?'good':edge<0?'low':'mid'} loading={loading} detail={delta!=null&&row.line!==0?(delta>0?'+':'')+num(100*delta/row.line)+'%':null}/>{WINDOWS.slice(0,4).map(([key])=><Heat key={key} value={row.windows?.[key]?.hitRate} detail={record(row.windows?.[key])} loading={loading}/>)}<Heat value={row.streak} kind={row.streak>0?'good':row.streak<0?'low':'none'} loading={loading}/><Heat value={row.windows?.season?.hitRate} detail={record(row.windows?.season)} loading={loading}/></tr>;
});
// On phones the account and settings buttons live in this bar instead of
// floating in a strip of their own above it (unified-finder.css hides the
// floating pair while the Finder is open). They press the page's own
// buttons, so the account dialog, settings panel and the settings button's
// triple-click admin unlock all behave exactly as before. The page closes
// the settings panel on any click reaching the document, so these stop
// theirs first, as the settings button itself does.
const pressPageButton=selector=>event=>{event.stopPropagation();document.querySelector(selector)?.click();};
const PHONE_ACCOUNT_BUTTONS=<>
 <button type="button" className="finder-icon finder-top-account" aria-label="Your account" aria-haspopup="dialog" onClick={pressPageButton('.site-account-trigger')}><UserRound size={18}/></button>
 <button type="button" className="finder-icon finder-top-settings" aria-label="Settings" aria-haspopup="true" onClick={pressPageButton('#settings-btn')}><Settings size={18}/></button>
</>;
export function UnifiedFinder(){
 const [mobileSearch,setMobileSearch]=useState(false);
 // Which leagues a regular user may see here is an admin switch
 // (site_controls disabledFinderSports); admins always get all three. Re-read
 // whenever the site policy changes rather than only on mount.
 const [policyRevision,setPolicyRevision]=useState(0);
 useEffect(()=>{const bump=()=>setPolicyRevision(n=>n+1);window.addEventListener('vortex:site-policy',bump);return()=>window.removeEventListener('vortex:site-policy',bump);},[]);
 const allowedKeys=useMemo(()=>KEYS.filter(siteFinderSportAllowed),[policyRevision]);
 // "All" only means something with more than one league to combine.
 const visibleSports=allowedKeys.length>1?['all',...allowedKeys]:allowedKeys;
 const [sport,setSport]=useState(()=>KEYS.find(siteFinderSportAllowed)||'wnba'),[boards,setBoards]=useState({wnba:EMPTY,mlb:EMPTY,nfl:EMPTY});
 // If the league being viewed gets switched off, move to one still allowed.
 useEffect(()=>{if(visibleSports.length&&!visibleSports.includes(sport))setSport(visibleSports[0]);},[visibleSports.join(),sport]);
 const [query,setQuery]=useState(''),[marketFilter,setMarketFilter]=useState([]),[bookFilter,setBookFilter]=useState([]),[teamFilter,setTeamFilter]=useState([]),[dayFilter,setDayFilter]=useState([]),[modifierFilter,setModifierFilter]=useState([]),[hitFilter,setHitFilter]=useState({windows:[],min:0,max:100});
 const [sorts,setSorts]=useState([]),[page,setPage]=useState(0),[pageSize,setPageSize]=useState(20),[selected,setSelected]=useState(null),[savedOnly,setSavedOnly]=useState(false);
 // Starred lines are picks in the site's one saved-picks list (My Slip /
 // Prop Builder, kept by app.js), not a Finder-only watchlist. This only
 // mirrors which rows are in it and on which side.
 const builder=usePickBuilder();
 const pickKey=builder.legs.filter(leg=>leg.finderId).map(leg=>leg.finderId+'\u0000'+leg.side).join('\u0001');
 const picks=useMemo(()=>new Map(builder.legs.filter(leg=>leg.finderId).map(leg=>[leg.finderId,leg.side])),[pickKey]);
 const [chooser,setChooser]=useState(null),chooserRef=useRef(null);chooserRef.current=chooser;
 const onPick=useCallback((row,anchor)=>setChooser(current=>current?.row.id===row.id?null:{row,anchor}),[]);
 const closeChooser=useCallback(returnFocus=>{const anchor=chooserRef.current?.anchor;setChooser(null);if(returnFocus&&anchor?.isConnected)anchor.focus({preventScroll:true});},[]);
 const requests=useRef(new Map()),controllers=useRef(new Set()),generation=useRef(new Map()),boardsRef=useRef(boards),tableRef=useRef(null),trigger=useRef(null);boardsRef.current=boards;
 const load=useCallback(async(key,force=false)=>{
  if(requests.current.has(key)||(!force&&boardsRef.current[key].state==='ready'))return;
  const c=new AbortController();requests.current.set(key,c);controllers.current.add(c);
  const cached=!force?readFinderCache(key):null;
  if(cached)setBoards(old=>({...old,[key]:{...old[key],...cached,state:'ready',error:null}}));
  else setBoards(old=>({...old,[key]:{...old[key],state:'loading',error:null}}));
  try{const result=await loadFinderSport(key,{signal:c.signal,fast:key==='wnba'});if(c.signal.aborted)return;setBoards(old=>({...old,[key]:{...result,state:'ready',error:null}}));persistFinderCache(key,result);
   const run=(generation.current.get(key)||0)+1;generation.current.set(key,run);
   let pendingUpdates=new Map(),flushTimer=null;
   const flushUpdates=()=>{flushTimer=null;if(generation.current.get(key)!==run||c.signal.aborted||!pendingUpdates.size)return;const updates=pendingUpdates;pendingUpdates=new Map();setBoards(old=>({...old,[key]:{...old[key],rows:old[key].rows.map(r=>updates.get(r.id)||r)}}));};
   const applyBatch=(sportKey,batch)=>{if(generation.current.get(sportKey)!==run||c.signal.aborted)return;batch.forEach(row=>pendingUpdates.set(row.id,row));if(flushTimer===null)flushTimer=setTimeout(flushUpdates,48);};
   if(key==='wnba'){const enriched=await enrichWnbaRows(result.rows,{signal:c.signal,concurrency:6,onRows:batch=>applyBatch('wnba',batch)});flushUpdates();if(!c.signal.aborted)persistFinderCache(key,{...result,rows:enriched});}
   if(key==='mlb'){const enriched=await enrichMlbRows(result.rows,{signal:c.signal,concurrency:3,onRows:batch=>applyBatch('mlb',batch)});flushUpdates();if(!c.signal.aborted)persistFinderCache(key,{...result,rows:enriched});}
  }
  catch(e){if(e.name!=='AbortError')setBoards(old=>({...old,[key]:{...old[key],state:old[key].rows?.length?'ready':'error',error:e.message}}));}
  finally{requests.current.delete(key);controllers.current.delete(c);}
 },[]);
 useEffect(()=>{(sport==='all'?allowedKeys:[sport]).filter(key=>allowedKeys.includes(key)).forEach(key=>load(key));},[sport,load,allowedKeys]);
 // Warm the other leagues during idle time so switching sports is a local
 // state change for returning users instead of a blank/loading transition.
 useEffect(()=>{
  let cancelled=false;
  // Never warm a league the user is not allowed to see.
  const prefetch=()=>{if(cancelled)return;allowedKeys.filter(key=>key!==sport).forEach(key=>load(key));};
  const idle=typeof window!=='undefined'&&window.requestIdleCallback?window.requestIdleCallback(prefetch,{timeout:1800}):setTimeout(prefetch,900);
  return()=>{cancelled=true;if(typeof window!=='undefined'&&window.cancelIdleCallback&&typeof idle==='number')window.cancelIdleCallback(idle);else clearTimeout(idle);};
 },[sport,load,allowedKeys]);
 useEffect(()=>()=>{controllers.current.forEach(c=>c.abort());generation.current.clear();},[]);
 const scope=sport==='all'?allowedKeys:[sport];
 // Rows already loaded for a league that was since switched off must not
 // keep showing under "All".
 // Defense-vs-position ranks come from each league's own table (the one the
 // player pages show), fetched once when that league's board is ready.
 const [leagues,setLeagues]=useState({}),leagueRequests=useRef(new Set());
 useEffect(()=>{['wnba','nfl'].forEach(key=>{if(boards[key].state!=='ready'||leagueRequests.current.has(key))return;leagueRequests.current.add(key);loadFinderDefense(key).then(data=>{if(data?.dvp)setLeagues(old=>({...old,[key]:data}));}).catch(()=>leagueRequests.current.delete(key));});},[boards.wnba.state,boards.nfl.state]);
 const allRows=useMemo(()=>allowedKeys.flatMap(k=>withDefense(boards[k].rows||[],leagues[k])),[boards,allowedKeys,leagues]);
 const sportRows=useMemo(()=>allRows.filter(r=>sport==='all'||r.sport===sport),[allRows,sport]);
 const markets=useMemo(()=>[...new Set(sportRows.map(r=>r.market))].sort(),[sportRows]);
 const books=useMemo(()=>[...new Set(sportRows.flatMap(r=>r.apps.map(a=>a.key)))].sort((a,b)=>a==='prizepicks'?-1:b==='prizepicks'?1:a.localeCompare(b)),[sportRows]);
 const teams=useMemo(()=>[...new Set(sportRows.map(r=>r.teamAbbr).filter(Boolean))].sort(),[sportRows]);
 const days=useMemo(()=>[...new Set(sportRows.map(r=>dayKey(r.startsAt)).filter(Boolean))].sort(),[sportRows]);
 const bookOptions=useMemo(()=>books.map(value=>({value,label:bookName(value)})),[books]);
 const marketOptions=useMemo(()=>markets.map(value=>({value,label:value})),[markets]);
 const teamOptions=useMemo(()=>teams.map(value=>({value,label:value})),[teams]);
 const dayOptions=useMemo(()=>days.map(value=>({value,label:new Date(value+'T12:00:00').toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})})),[days]);
 const lineOptions=useMemo(()=>[{value:'standard',label:'Regular'},{value:'goblin',label:'Goblins'},{value:'demon',label:'Demons'}],[]);
 const order=useMemo(()=>sorts.length?sorts:[DEFAULT_SORT],[sorts]),sort=order[0];
 const rows=useMemo(()=>{
  const hitActive=hitFilter.windows.length>0||hitFilter.min>0||hitFilter.max<100;
  const hitWindows=hitFilter.windows.length?hitFilter.windows:['l5','l10','l15','h2h','season'];
  const filtered=sportRows.filter(r=>(!marketFilter.length||marketFilter.includes(r.market))&&(!bookFilter.length||bookFilter.some(book=>r.apps.some(a=>a.key===book)))&&(!teamFilter.length||teamFilter.includes(r.teamAbbr))&&(!dayFilter.length||dayFilter.includes(dayKey(r.startsAt)))&&
    matchesPrizePicksLine(r,modifierFilter)&&
    (!hitActive||hitWindows.every(key=>finite(r.windows?.[key]?.hitRate)&&r.windows[key].hitRate>=hitFilter.min&&r.windows[key].hitRate<=hitFilter.max))&&(!savedOnly||picks.has(r.id))&&(!query.trim()||(r.player+' '+(r.teamAbbr||'')+' '+(r.opponent||'')).toLowerCase().includes(query.trim().toLowerCase())));
  // Each chosen sort in turn; a row missing that value goes after the rest.
  const value=(r,key)=>key==='player'?r.player:key==='average'?r.average:key==='diff'?r.diff:key==='streak'?r.streak:key==='line'?r.line:key==='defense'?r.defense:r.windows?.[key]?.hitRate;
  const compare=(a,b,{key,direction})=>{const av=value(a,key),bv=value(b,key);if(av==null&&bv==null)return 0;if(av==null)return 1;if(bv==null)return -1;const n=typeof av==='string'?av.localeCompare(bv):av-bv;return direction==='asc'?n:-n;};
  return filtered.sort((a,b)=>{for(const item of order){const n=compare(a,b,item);if(n)return n;}return a.player.localeCompare(b.player);});
 },[sportRows,marketFilter,bookFilter,teamFilter,dayFilter,modifierFilter,hitFilter,savedOnly,picks,query,order]);
 useEffect(()=>setPage(0),[sport,query,marketFilter,bookFilter,teamFilter,dayFilter,modifierFilter,hitFilter,pageSize,savedOnly,order]);
 const pages=Math.max(1,Math.ceil(rows.length/pageSize)),currentPage=Math.min(page,pages-1),visible=rows.slice(currentPage*pageSize,(currentPage+1)*pageSize);
 const loading=scope.some(k=>['loading','idle'].includes(boards[k].state)),errors=scope.filter(k=>boards[k].error).map(k=>k.toUpperCase()+': '+boards[k].error),histories=sportRows.filter(r=>r.historyStatus==='pending').length;
 const timestamp=scope.map(k=>boards[k].fetchedAt).filter(Boolean).sort().at(-1);
 // Keep saved picks' prices and start times current with the board.
 useEffect(()=>{
  if(!picks.size)return;
  const updates=allRows.filter(row=>picks.has(row.id)).map(row=>({id:finderSlipId(row),apps:slipApps(row.apps),startsAt:row.startsAt||'',teamLogo:row.teamLogo||'',headshot:row.headshot||''}));
  if(updates.length)pickBuilder.refresh(updates);
 },[allRows,picks]);
 const open=useCallback(row=>{trigger.current='Open '+row.sport.toUpperCase()+' '+row.player+' '+row.line+' '+row.market+' trends';setSelected(row);},[]);
 const back=()=>{setSelected(null);requestAnimationFrame(()=>{const button=[...document.querySelectorAll('.finder-open')].find(el=>el.getAttribute('aria-label')===trigger.current);button?.focus({preventScroll:true});});};
 const changeSport=key=>{setSport(key);setSelected(null);setMarketFilter([]);setBookFilter([]);setTeamFilter([]);setDayFilter([]);setModifierFilter([]);setHitFilter({windows:[],min:0,max:100});};
 const clear=()=>{setQuery('');setMarketFilter([]);setBookFilter([]);setTeamFilter([]);setDayFilter([]);setModifierFilter([]);setHitFilter({windows:[],min:0,max:100});setSavedOnly(false);};
 // A table heading sorts by that column alone; tapping it again flips it.
 const onSort=key=>setSorts(old=>{const first=old[0]||DEFAULT_SORT;return [{key,direction:first.key===key&&first.direction==='desc'?'asc':'desc'}];});
 // Phone sort chips stack: each one tapped sorts within the ones before it
 // (numbered in order). Tapping a chip again flips it; its x removes it.
 const toggleSort=key=>setSorts(old=>old.some(item=>item.key===key)?old.map(item=>item.key===key?{...item,direction:item.direction==='desc'?'asc':'desc'}:item):[...old,{key,direction:'desc'}]);
 const removeSort=key=>setSorts(old=>old.filter(item=>item.key!==key));
 const hasDefense=useMemo(()=>sportRows.some(row=>finite(row.defense)),[sportRows]);
 const changePage=n=>{setPage(n);tableRef.current?.scrollTo({top:0});};
 const playerRows=selected?allRows.filter(r=>r.sport===selected.sport&&(selected.playerId?r.playerId===selected.playerId:r.player===selected.player)):[];
 const dropdownAssets=useMemo(()=>({Teams:Object.fromEntries(sportRows.filter(row=>row.teamAbbr&&row.teamLogo).map(row=>[row.teamAbbr,row.teamLogo])),Apps:Object.fromEntries(books.map(key=>[key,LOGOS[key]||'/sportsbooks/'+key+'.png'])),'Choose sport':LEAGUE_LOGOS,'Line type':{standard:'/prizepicks/logo.png',goblin:'/prizepicks/goblin.png',demon:'/prizepicks/demon.png'}}),[sportRows,books]);
 if(!allowedKeys.length)return <main className="unified-finder" aria-label="Finder"><div className="finder-message">The Finder is not available right now. Check back soon.</div></main>;
 return <FinderDropdownAssets.Provider value={dropdownAssets}><main className={'unified-finder'+(selected?' finder-detail-active':'')+(mobileSearch?' finder-search-expanded':'')} aria-label="Multi-sport prop Finder">
  <label className="finder-mobile-sport"><Grid2X2 size={15}/><FinderDropdown aria-label="Choose sport" value={sport} onChange={e=>changeSport(e.target.value)}>{visibleSports.map(key=><option key={key} value={key}>{key==='all'?'All sports':key.toUpperCase()}</option>)}</FinderDropdown><ChevronDown size={13}/></label>
  {!selected&&<button type="button" className="finder-mobile-search-toggle finder-icon" aria-label="Toggle player search" aria-expanded={mobileSearch} onClick={()=>setMobileSearch(v=>!v)}><Search size={18}/></button>}
  <header className="finder-topbar"><div className="finder-title"><button type="button" className="finder-picks-trigger" data-requires-tab="saved" aria-label={'Open Pick Builder'+(builder.legs.length?' ('+builder.legs.length+' saved '+(builder.legs.length===1?'pick':'picks')+')':'')} aria-controls="side-panel" aria-haspopup="dialog" onClick={event=>{event.stopPropagation();setChooser(null);pickBuilder.open();}}><Table2 size={19} aria-hidden="true"/>{builder.legs.length>0&&<b aria-hidden="true">{builder.legs.length}</b>}</button><h1>Finder</h1><span>/</span></div><nav className="finder-sports" aria-label="Finder sport">{visibleSports.map(key=><button type="button" key={key} aria-pressed={sport===key} onClick={()=>changeSport(key)}>{key==='all'?<Grid2X2 size={15}/>:<League sport={key}/>}<span>{key==='all'?'All':key.toUpperCase()}</span></button>)}</nav><span className="finder-brand">KRAZY<span>EDGE</span></span><button type="button" className="finder-icon finder-top-save" data-requires-tab="saved" aria-label="Show only your picks" aria-pressed={savedOnly} onClick={()=>{setSelected(null);setSavedOnly(v=>!v);}}><Bookmark size={17}/></button>{PHONE_ACCOUNT_BUTTONS}</header>
  {selected?<Suspense fallback={<div className="finder-message"><LoaderCircle className="finder-spin"/>Loading player trends…</div>}>{selected.sport==='wnba'?<WNBAPlayerPage row={selected} playerRows={playerRows} onBack={back}/>:<FinderTrendView row={selected} playerRows={playerRows} onBack={back}/>}</Suspense>:<>
   <div className="finder-controls"><div className="finder-search-row"><label className="finder-search"><Search size={16}/><input type="search" aria-label="Search players or teams" placeholder="Search players or teams…" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="finder-app-filter"><FinderMultiSelect label="Apps" icon={Grid2X2} values={bookFilter} onChange={setBookFilter} options={bookOptions} placeholder="All apps"/><span className="finder-app-icons" aria-hidden="true">{books.slice(0,6).map(k=><Photo key={k} src={LOGOS[k]||'/sportsbooks/'+k+'.png'} width="23" height="23"/>)}</span></div><button type="button" className="finder-icon" aria-label="Refresh Finder" onClick={()=>scope.forEach(k=>load(k,true))} disabled={loading}><RefreshCw size={16} className={loading?'finder-spin':''}/></button></div>
   <div className="finder-filters"><FinderMultiSelect label="Line type" icon={SlidersHorizontal} values={modifierFilter} onChange={setModifierFilter} options={lineOptions} placeholder="All lines" searchable={false}/><FinderMultiSelect label="Stats" icon={ChartNoAxesColumnIncreasing} values={marketFilter} onChange={setMarketFilter} options={marketOptions} placeholder="All stats"/><FinderMultiSelect label="Teams" icon={Users} values={teamFilter} onChange={setTeamFilter} options={teamOptions} placeholder="All teams"/><FinderMultiSelect label="Date" icon={CalendarDays} values={dayFilter} onChange={setDayFilter} options={dayOptions} placeholder="All dates" searchable={false}/><FinderHitRateFilter value={hitFilter} onChange={setHitFilter}/><button type="button" className={'finder-saved '+(savedOnly?'is-active':'')} data-requires-tab="saved" aria-pressed={savedOnly} onClick={()=>setSavedOnly(v=>!v)}><Bookmark size={15}/>Saved{picks.size>0&&<b>{picks.size}</b>}</button><button type="button" className="finder-icon finder-reset" aria-label="Reset all Finder filters" onClick={clear}><Trash2 size={16}/></button></div></div>
   <div className="finder-mobile-sort" role="group" aria-label="Sort prop cards">{MOBILE_SORTS.filter(([key])=>key!=='defense'||hasDefense).map(([key,label])=>{const index=sorts.findIndex(item=>item.key===key),active=sorts[index];return <span key={key} className="finder-sort-chip" data-active={active?'true':undefined}><button type="button" aria-pressed={Boolean(active)} aria-label={active?'Sorted by '+label+(sorts.length>1?' (sort '+(index+1)+')':'')+', '+(active.direction==='desc'?'high to low':'low to high')+'. Tap to flip':'Sort by '+label} onClick={()=>toggleSort(key)}>{label}{active&&<b aria-hidden="true">{index+1}</b>}{active?(active.direction==='desc'?<ArrowDown size={12}/>:<ArrowUp size={12}/>):<ArrowUpDown size={11}/>}</button>{active&&<button type="button" className="finder-sort-remove" aria-label={'Stop sorting by '+label} onClick={()=>removeSort(key)}><X size={12}/></button>}</span>;})}</div>
   <div className="finder-meta"><span role="status">{loading?<><LoaderCircle size={12} className="finder-spin"/>Loading {scope.filter(k=>boards[k].state!=='ready').map(k=>k.toUpperCase()).join(', ')}…</>:<><i/>{rows.length.toLocaleString()} props</>}{histories>0&&<small> · History loading for {histories} lines</small>}</span><span className="finder-legend"><i data-tone="good"/>70%+<i data-tone="mid"/>45–69%<i data-tone="low"/>&lt;45% <span>·</span>{timestamp?'Updated '+new Date(timestamp).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'Pushes excluded'}</span></div>
   {errors.length>0&&sportRows.length>0&&<div className="finder-availability" role="status"><span>{scope.some(k=>boards[k].error&&boards[k].persisted)?'The latest props couldn’t load. Showing the last saved lines.':'Some props are temporarily unavailable.'}</span><button type="button" onClick={()=>scope.filter(k=>boards[k].error).forEach(k=>load(k,true))}>Retry</button></div>}
   <section className="finder-board" aria-label="Player props"><div className="finder-scroll" ref={tableRef}><table className="finder-table"><caption className="finder-sr-only">Historical hit rates for the displayed line and side. Green 70 percent or more, yellow 45 to 69 percent, red below 45 percent. Missing data is shown as a dash.</caption><thead><tr><Heading name="player" label="Line" sort={sort} onSort={onSort}/><th scope="col">Apps</th><th scope="col" title="Odds-implied probability, normalized to remove margin">Book %</th><Heading name="average" label="Avg L10" sort={sort} onSort={onSort}/><Heading name="diff" label="Diff" sort={sort} onSort={onSort}/>{WINDOWS.slice(0,4).map(([key,label])=><Heading key={key} name={key} label={label} sort={sort} onSort={onSort}/>)}<Heading name="streak" label="Streak" sort={sort} onSort={onSort}/><Heading name="season" label="SZN" sort={sort} onSort={onSort}/></tr></thead><tbody>{visible.map(row=><Row key={row.id} row={row} onOpen={open} pick={picks.get(row.id)} onPick={onPick}/>)}</tbody></table>{!visible.length&&<div className="finder-message finder-empty-board" role="status">{loading?<><LoaderCircle className="finder-spin"/><strong>Loading the prop board</strong><span>Lines appear here as each sport loads.</span></>:<><ChartNoAxesColumnIncreasing size={26} aria-hidden="true"/><strong>{errors.length&&!sportRows.length?'Props temporarily unavailable':savedOnly?'No saved props found':'No props found'}</strong><span>{errors.length&&!sportRows.length?'We couldn’t load the latest props. Please try again.':sportRows.length?'No props match these filters. Loosen or reset them to see more.':'No upcoming props are available right now. Check back soon.'}</span><button type="button" onClick={errors.length&&!sportRows.length?()=>scope.filter(k=>boards[k].error).forEach(k=>load(k,true)):clear}>{errors.length&&!sportRows.length?'Retry':'Clear all filters'}</button></>}</div>}</div><footer className="finder-pagination"><span>{rows.length?(currentPage*pageSize+1)+'–'+Math.min((currentPage+1)*pageSize,rows.length)+' of '+rows.length.toLocaleString():'0 props'}</span><div><button type="button" aria-label="Previous page" disabled={currentPage===0} onClick={()=>changePage(currentPage-1)}><ChevronLeft size={17}/></button><span>Page <b>{currentPage+1}</b> / {pages}</span><button type="button" aria-label="Next page" disabled={currentPage>=pages-1} onClick={()=>changePage(currentPage+1)}><ChevronRight size={17}/></button><label><ListFilter size={14}/><FinderDropdown aria-label="Rows per page" value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}>{[20,50,100].map(n=><option value={n} key={n}>{n} rows</option>)}</FinderDropdown><ChevronDown size={12}/></label></div><span className="finder-page-hint">Select a player to open Trends</span></footer></section>
  </>}
  {chooser&&<PickSideMenu key={chooser.row.id} row={chooser.row} anchor={chooser.anchor} side={picks.get(chooser.row.id)} onClose={closeChooser}/>}
 </main></FinderDropdownAssets.Provider>;
}
