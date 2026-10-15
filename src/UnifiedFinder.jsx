import React,{lazy,startTransition,Suspense,useCallback,useDeferredValue,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowDown,ArrowUp,ArrowUpDown,ArrowLeft,Bookmark,ChartNoAxesColumnIncreasing,ChevronDown,ChevronLeft,ChevronRight,Grid2X2,ListFilter,LoaderCircle,RefreshCw,Search,SlidersHorizontal,Star,Swords,Table2,Trash2,Users,CalendarDays,Settings,UserRound,X} from 'lucide-react';
import {finderPlayerRows,loadFinderSportRaw,loadFinderSnapshot,hasFinderSnapshot,applyFinderSnapshot,within,persistFinderCache,readFinderCache,carryHistory,matchesPrizePicksLine,finderSlipId,slipApps,bookProbability,loadFinderDefense,withDefense,trendPickRow,BOOK_NAMES,linkTarget,findLinkedRow,readFinderView,saveFinderView} from './unified-finder-data';
import {WNBAPlayerPage} from './sports/wnba/WNBAPlayerPage';
import {siteFinderSportAllowed,siteIsAdmin} from './site-access';
import {accountProfile} from './account-sync';
import {LEAGUE_LOGOS} from './league-logos';
import {useTeamTint} from './team-tint';
import './unified-finder.css';
import './finder-cards.css';
import {FinderDropdown,FinderDropdownAssets} from './FinderDropdown';
import {FinderHitRateFilter,FinderMultiSelect,FinderSportMenu} from './FinderMultiSelect';
import {PickSideMenu} from './PickSideMenu';
import {pickBuilder,usePickBuilder} from './pick-builder-client';
import {ENRICH,ENRICH_CONCURRENCY,BOARD_FRESH,stamped,needsHistory} from './finder-pool';
import {takeEarly} from './finder-early';
const FinderTrendView=lazy(()=>import('./FinderTrendView').then(m=>({default:m.FinderTrendView})));
const SoccerPlayerPage=lazy(()=>import('./sports/soccer/SoccerPlayerPage').then(m=>({default:m.SoccerPlayerPage})));
const NHLPlayerPage=lazy(()=>import('./sports/nhl/NHLPlayerPage').then(m=>({default:m.NHLPlayerPage})));
const SPORTS=['all','nba','wnba','mlb','nfl','nhl','soccer','tennis','cs2'],KEYS=SPORTS.slice(1),EMPTY={state:'idle',rows:[]};
const LOGOS={prizepicks:'/prizepicks/logo.png',draftkings:'/sportsbooks/draftkings.png',fanduel:'/sportsbooks/fanduel.png',betmgm:'/sportsbooks/betmgm.png',underdog:'/sportsbooks/underdog.png'};
const WINDOWS=[['l5','L5'],['l10','L10'],['l15','L15'],['h2h','H2H'],['season','SZN']];
// With no sort chosen the board runs L10 high to low.
const DEFAULT_SORT={key:'l10',direction:'desc'};
const MOBILE_SORTS=[['l5','L5'],['l10','L10'],['l15','L15'],['h2h','H2H'],['streak','Strk'],['average','AVG'],['diff','Diff'],['defense','Defense'],['line','Line'],['season','SZN']];
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const num=v=>finite(v)?Number(v.toFixed(1)).toLocaleString():'—';
const price=v=>finite(v)?(v>0?'+':'')+v:'—';
const tone=v=>!finite(v)?'none':v>=70?'good':v>=45?'mid':'low';
// Dates are formatted once per start time and reused: the browser's date
// formatting is slow, and every line on the board asks for its day on each
// update.
const remembered=format=>{const seen=new Map();return v=>{if(!v)return '';let text=seen.get(v);if(text===undefined){const time=Date.parse(v);text=Number.isFinite(time)?format.format(time):'';if(seen.size>4000)seen.clear();seen.set(v,text);}return text;};};
const dayKey=remembered(new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}));
const when=remembered(new Intl.DateTimeFormat([],{weekday:'short',hour:'numeric',minute:'2-digit'}));
const bookName=k=>BOOK_NAMES[k]||k;
// One collator for every name comparison; localeCompare builds one per call.
const byName=new Intl.Collator().compare;
// One key per match: the two sides and the day. Rows without both sides
// named have no game to filter by.
const gameKey=row=>row.awayTeamAbbr&&row.homeTeamAbbr?`${row.sport}:${row.awayTeamAbbr}@${row.homeTeamAbbr}:${dayKey(row.startsAt)}`:null;
const kickoffClock=remembered(new Intl.DateTimeFormat([],{hour:'numeric',minute:'2-digit'}));
const kickoffTime=v=>kickoffClock(v).replace(/\s/g,'').toLowerCase();
function GameOption({game}){
 const side=(abbr,home)=>{const chance=game.chances[abbr];return <span className={'finder-game-side'+(home?' is-home':'')}>{!home&&<Photo src={game.logos[abbr]} className="finder-game-logo" width="26" height="26"/>}<span><b>{abbr}</b>{finite(chance)&&<em data-tone={chance>=50?'good':'low'}>{Math.round(chance)}%</em>}</span>{home&&<Photo src={game.logos[abbr]} className="finder-game-logo" width="26" height="26"/>}</span>;};
 return <span className="finder-game-option">{side(game.away,false)}<span className="finder-game-at">@</span>{side(game.home,true)}<span className="finder-game-time">{kickoffTime(game.startsAt)}</span></span>;
}
function Photo({src,className='',fallback=null,...props}){const [bad,setBad]=useState(false);useEffect(()=>setBad(false),[src]);return src&&!bad?<img src={src} alt="" className={className} onError={()=>setBad(true)} {...props}/>:fallback;}

function League({sport}){return <img src={LEAGUE_LOGOS[sport]} alt="" className="finder-league" width="17" height="19"/>;}
function Heading({label,name,sort,onSort}){const active=sort.key===name;return <th scope="col" aria-sort={active?(sort.direction==='desc'?'descending':'ascending'):'none'}><button type="button" className={active?'is-sorted':''} onClick={()=>onSort(name)}>{label}{active?(sort.direction==='desc'?<ArrowDown size={12}/>:<ArrowUp size={12}/>):<ArrowUpDown size={11}/>}</button></th>;}
function Heat({value,kind,detail,loading}){return <td className="finder-stat"><div className="finder-heat" data-tone={kind||tone(value)} style={!kind&&finite(value)?{'--rate':Math.max(0,Math.min(100,value))+'%'}:undefined}>{finite(value)?<><strong>{num(value)}{!kind?'%':''}</strong>{detail&&<small>{detail}</small>}</>:<span className="finder-no-data" title={loading?'Loading history':'No verified sample'}>{loading?'…':'—'}</span>}</div></td>;}
function Books({apps=[]}){return <div className="finder-books">{apps.slice(0,2).map(app=><div className="finder-book" key={app.key} title={app.name||bookName(app.key)}><Photo src={LOGOS[app.key]||'/sportsbooks/'+app.key+'.png'} width="25" height="25" fallback={<span className="finder-book-fallback">{(app.name||app.key||'?').slice(0,2)}</span>}/><span>{finite(app.over)||finite(app.under)?<><span><b className="finder-over">O</b> {price(app.over)}</span><span><b className="finder-under">U</b> {price(app.under)}</span></>:<small>More / Less</small>}</span></div>)}{apps.length>2&&<span className="finder-extra" title={apps.slice(2).map(a=>bookName(a.key)+': O '+price(a.over)+' / U '+price(a.under)).join('; ')}>+{apps.length-2}</span>}</div>;}
// The sportsbooks' no-vig chance for the line (unified-finder-data.js
// bookProbability). Pick'em apps price both sides the same, so they are left
// out; a line only they post shows a dash rather than a made-up 50/50.
function Probability({apps=[],side}){const chance=bookProbability(apps);if(!chance)return <div className="finder-probability is-empty" title="No posted odds"><span aria-label="No sportsbook odds">—</span></div>;return <div className="finder-probability" data-pick={side==='UNDER'?'U':'O'} style={{'--over':chance.over.toFixed(1)}} title="Market chance">{[['O',chance.over],['U',chance.under]].map(([label,value])=><span key={label} data-side={label} data-tone={value>=55?'good':value>=45?'mid':'low'}>{label} <b>{value.toFixed(1)+'%'}</b></span>)}</div>;}
// The opponent's rank against this position in this stat. Rank 1 allows the
// least; for an Over, a high rank (a defense that gives up a lot) is good.
function Defense({row}){if(!finite(row.defense))return null;const n=row.defenseTeams||0,third=Math.ceil(n/3),rank=row.defense;const toneName=!n?'none':rank>n-third?'good':rank<=third?'low':'mid';return <span className="finder-defense" data-tone={toneName} title={row.opponent+' ranks '+rank+(n?' of '+n:'')+' in what it allows to this position in this stat (1 allows the least).'}>DEF {rank}{n?'/'+n:''}</span>;}
// The phone card's chips (finder-cards.css; hidden on desktop): the
// opponent's rank against this stat, his L10 average against the line and
// his current run.
function Chips({row,delta,edge}){const s=row.streak,run=finite(s)&&s!==0;
 return <span className="finder-chips"><Defense row={row}/>{finite(row.average)&&<span className="finder-chip" title="His average over his last 10">Avg <b>{num(row.average)}</b>{delta!=null&&<em data-tone={edge>0?'good':edge<0?'low':'mid'}>{(delta>0?'+':delta<0?'−':'')+num(Math.abs(delta))} vs line</em>}</span>}{run&&<span className="finder-chip" data-tone={s>0?'good':'low'}>{s>0?'Hit':'Missed'} <b>{Math.abs(s)}</b> straight</span>}</span>;}
// The player's team's chance to win the match, from the moneyline with the
// margin taken out (soccer_research.py three_way).
function Moneyline({row}){if(!finite(row.winChance))return null;return <span className="finder-moneyline" data-tone={row.winChance>=50?'good':row.winChance>=33?'mid':'low'} title="Market chance">{row.teamLogo&&<img src={row.teamLogo} alt="" width="14" height="14" onError={event=>{event.currentTarget.hidden=true;}}/>}Moneyline <b>{Math.round(row.winChance)}%</b></span>;}
const Row=React.memo(function Row({row,onOpen,pick,onPick}){
 const tint=useTeamTint(row.teamLogo);
 const record=w=>w?String(w.hits??0)+'/'+((w.hits??0)+(w.misses??0))+(w.pushes?' · '+w.pushes+'P':''):'';
 const delta=finite(row.average)?row.average-row.line:null,edge=row.diff,loading=row.historyStatus==='pending';
 return <tr onClick={()=>onOpen(row)} style={tint?{'--team':tint}:undefined}><td className="finder-player-cell">{row.teamLogo&&<img className="finder-card-mark" src={row.teamLogo} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}<div className="finder-player"><div className="finder-portrait-wrap"><Photo src={row.headshot} className="finder-portrait" width="38" height="38" loading="lazy" fallback={<span className="finder-portrait finder-initials">{row.player.split(' ').map(p=>p[0]).slice(0,2).join('')}</span>}/><button className="finder-star" type="button" data-requires-tab="saved" aria-label={pick?row.player+' '+row.line+' '+row.market+' is in your picks ('+pick+'). Change or remove':'Add '+row.player+' '+row.line+' '+row.market+' to your picks'} aria-haspopup="dialog" aria-pressed={Boolean(pick)} data-side={pick?pick.toLowerCase():undefined} onClick={e=>{e.stopPropagation();onPick(row,e.currentTarget);}}><Star size={11} fill={pick?'currentColor':'none'}/></button></div><button type="button" className="finder-open" onClick={e=>{e.stopPropagation();onOpen(row);}} aria-label={'Open '+row.sport.toUpperCase()+' '+row.player+' '+row.line+' '+row.market+' trends'}><span className="finder-name">{row.player} {row.position&&<em>({row.position})</em>}</span><span className="finder-market"><League sport={row.sport}/><b data-side={row.direction==='UNDER'?'less':'more'}>{row.direction==='UNDER'&&<span className="finder-u">U </span>}{row.line}</b> {row.market}{['goblin','demon'].includes(row.modifier)&&<img src={'/prizepicks/'+row.modifier+'.png'} alt={row.modifier} width="14" height="14"/>}</span><span className="finder-game">{row.teamAbbr||row.sport.toUpperCase()}{row.opponent?' vs '+row.opponent:''}{row.startsAt?' · '+when(row.startsAt):''}<Defense row={row}/></span><Moneyline row={row}/></button></div>{!loading&&<Chips row={row} delta={delta} edge={edge}/>}</td><td><Books apps={row.apps}/></td><td className="finder-prob-cell"><Probability apps={row.apps} side={row.direction}/></td><Heat value={row.average} kind={tone(row.windows?.l10?.hitRate)} loading={loading}/><Heat value={delta} kind={edge==null?'none':edge>0?'good':edge<0?'low':'mid'} loading={loading} detail={delta!=null&&row.line!==0?(delta>0?'+':'')+num(100*delta/row.line)+'%':null}/>{WINDOWS.slice(0,4).map(([key])=><Heat key={key} value={row.windows?.[key]?.hitRate} detail={record(row.windows?.[key])} loading={loading}/>)}<Heat value={row.streak} kind={row.streak>0?'good':row.streak<0?'low':'none'} loading={loading}/><Heat value={row.windows?.season?.hitRate} detail={record(row.windows?.season)} loading={loading}/></tr>;
});
// On phones the account and settings buttons live in this bar instead of
// floating in a strip of their own above it (unified-finder.css hides the
// floating pair while the Finder is open). They press the page's own
// buttons, so the account dialog, settings panel and the settings button's
// triple-click admin unlock all behave exactly as before. The page closes
// the settings panel on any click reaching the document, so these stop
// theirs first, as the settings button itself does.
const pressPageButton=selector=>event=>{event.stopPropagation();document.querySelector(selector)?.click();};
// The member's photo (or first initial) for the phone bar's account button.
function useAccountFace(){
 const read=()=>{const profile=accountProfile()||{};return {photo:profile.avatarUrl||'',initial:String(profile.name||'').trim().slice(0,1).toUpperCase()};};
 const [face,setFace]=useState(read);
 useEffect(()=>{const sync=()=>setFace(read());window.addEventListener('vortex:account-profile',sync);return()=>window.removeEventListener('vortex:account-profile',sync);},[]);
 return face;
}
export function PhoneAccountButtons(){
 const face=useAccountFace();
 const [broken,setBroken]=useState('');
 return <>
  <button type="button" className="finder-icon finder-top-settings" aria-label="Settings" aria-haspopup="true" onClick={pressPageButton('#settings-btn')}><Settings size={18}/></button>
  <button type="button" className="finder-icon finder-top-account" aria-label="Your account" aria-haspopup="dialog" onClick={pressPageButton('.site-account-trigger')}>
   {face.photo&&broken!==face.photo?<img src={face.photo} alt="" onError={()=>setBroken(face.photo)}/>:face.initial?<b aria-hidden="true">{face.initial}</b>:<UserRound size={18}/>}
  </button>
 </>;
}
const storage=()=>{try{return window.localStorage;}catch{return null;}};
export function UnifiedFinder(){
 // A notification's link (/finder?sport=&player=&stat=) opens that prop;
 // otherwise the Finder comes back the way it was left (readFinderView).
 const [target]=useState(()=>typeof location==='undefined'?null:linkTarget(location.search));
 const [view]=useState(()=>target?{}:readFinderView(storage()));
 const linked=useRef(target),restoring=useRef(Boolean(view.marketFilter?.length||view.bookFilter?.length||view.teamFilter?.length));
 const [mobileSearch,setMobileSearch]=useState(Boolean(target));
 // Which leagues a regular user may see here is an admin switch
 // (site_controls disabledFinderSports); admins always get every league. Re-read
 // whenever the site policy changes rather than only on mount.
 const [policyRevision,setPolicyRevision]=useState(0);
 useEffect(()=>{const bump=()=>setPolicyRevision(n=>n+1);window.addEventListener('vortex:site-policy',bump);return()=>window.removeEventListener('vortex:site-policy',bump);},[]);
 const allowedKeys=useMemo(()=>KEYS.filter(siteFinderSportAllowed),[policyRevision]);
 // "All" only means something with more than one league to combine.
 const visibleSports=allowedKeys.length>1?['all',...allowedKeys]:allowedKeys;
 // The leagues on the board. None picked -- the default -- means every
 // league the site allows.
 const [picked,setPicked]=useState(target?[target.sport]:view.picked||[]),[boards,setBoards]=useState(()=>Object.fromEntries(KEYS.map(key=>[key,EMPTY])));
 const scope=useMemo(()=>{const chosen=picked.filter(key=>allowedKeys.includes(key));return chosen.length?chosen:allowedKeys;},[picked,allowedKeys]),scopeKey=scope.join();
 const [query,setQuery]=useState(target?target.player:''),[marketFilter,setMarketFilter]=useState(view.marketFilter||[]),[bookFilter,setBookFilter]=useState(view.bookFilter||[]),[teamFilter,setTeamFilter]=useState(view.teamFilter||[]),[dayFilter,setDayFilter]=useState([]),[gameFilter,setGameFilter]=useState([]),[modifierFilter,setModifierFilter]=useState(view.modifierFilter||[]),[hitFilter,setHitFilter]=useState(view.hitFilter||{windows:[],min:0,max:100});
 const [sorts,setSorts]=useState(view.sorts||[]),[page,setPage]=useState(0),[pageSize,setPageSize]=useState(view.pageSize||20),[selected,setSelected]=useState(null),[savedOnly,setSavedOnly]=useState(false);
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
 // Data landing never holds up a tap or a keystroke: board updates render
 // as transitions, which React sets aside for input and picks up after.
 // `latest` holds each league's newest lines at once, before React gets to
 // them, so the hit rates can start on them straight away.
 const latest=useRef({});
 // The first lines on screen render at once; everything after (hit rates,
 // refreshed boards) gives way to taps and typing.
 const putBoard=useCallback((key,next)=>{
  if(typeof next!=='function'&&next.rows)latest.current[key]=next.rows;
  const update=()=>setBoards(old=>{const board=typeof next==='function'?next(old[key]):next;if(board.rows)latest.current[key]=board.rows;return {...old,[key]:board};});
  if(boardsRef.current[key]?.rows?.length)startTransition(update);else update();
 },[]);
 // Saving a board to the device copies every line, so it waits for a quiet moment.
 const saveTimers=useRef(new Map());
 const saveSoon=useCallback(key=>{
  clearTimeout(saveTimers.current.get(key));
  saveTimers.current.set(key,setTimeout(()=>{
   const save=()=>{const board=boardsRef.current[key];if(board?.rows?.length)persistFinderCache(key,board);};
   if(typeof window!=='undefined'&&window.requestIdleCallback)window.requestIdleCallback(save,{timeout:4000});else save();
  },1200));
 },[]);
 // Hit rates for the lines on screen (and the top of the list) load first.
 const priority=useRef(new Set());
 const enriching=useRef(new Map()),scopeRef=useRef([]);scopeRef.current=scope;
 const enrichBoard=useCallback(async(key,{gentle=false}={})=>{
  const enrich=ENRICH[key],rows=latest.current[key]||boardsRef.current[key].rows||[];
  const running=enriching.current.get(key);
  // A league warming in the background that you then open speeds up.
  if(running&&!running.signal.aborted&&!(running.gentle&&!gentle))return;
  if(!enrich||!rows.some(row=>needsHistory(key,row)))return;
  running?.abort();
  const c=new AbortController();c.gentle=gentle;enriching.current.set(key,c);controllers.current.add(c);
  const run=(generation.current.get(key)||0)+1;generation.current.set(key,run);
  let pendingUpdates=new Map(),flushTimer=null;
  const flushUpdates=()=>{flushTimer=null;if(generation.current.get(key)!==run||c.signal.aborted||!pendingUpdates.size)return;const updates=pendingUpdates;pendingUpdates=new Map();putBoard(key,old=>({...old,rows:old.rows.map(r=>updates.get(r.id)||r)}));};
  // Hit rates land in batches; the list updates a few times a second
  // rather than on every batch.
  const applyBatch=batch=>{if(generation.current.get(key)!==run||c.signal.aborted)return;stamped(batch).forEach(row=>pendingUpdates.set(row.id,row));if(flushTimer===null)flushTimer=setTimeout(flushUpdates,500);};
  try{
   const first=priority.current;
   const ordered=first.size?[...rows.filter(row=>first.has(row.id)),...rows.filter(row=>!first.has(row.id))]:rows;
   // A league in the background takes its time, leaving the network to the one on screen.
   await enrich(ordered,{signal:c.signal,concurrency:gentle?Math.min(2,ENRICH_CONCURRENCY[key]):ENRICH_CONCURRENCY[key],onRows:applyBatch});
   flushUpdates();
   if(!c.signal.aborted)saveSoon(key);
  }catch(e){if(e.name!=='AbortError')flushUpdates();}
  finally{
   if(enriching.current.get(key)===c)enriching.current.delete(key);controllers.current.delete(c);
   // Then the next league in the background, one at a time.
   if(!c.signal.aborted&&![...enriching.current.keys()].some(k=>scopeRef.current.includes(k))){
    const next=KEYS.find(k=>!scopeRef.current.includes(k)&&!enriching.current.has(k)&&ENRICH[k]&&(latest.current[k]||[]).some(row=>needsHistory(k,row)));
    if(next&&document.visibilityState!=='hidden')setTimeout(()=>enrichBoard(next,{gentle:true}),400);
   }
  }
 },[putBoard,saveSoon]);
 const load=useCallback(async(key,force=false,{background=false}={})=>{
  if(requests.current.has(key))return;
  // Already here: just make sure its hit rates are coming.
  if(!force&&boardsRef.current[key].state==='ready'){latest.current[key]??=boardsRef.current[key].rows;if(!background)enrichBoard(key);return;}
  const c=new AbortController();requests.current.set(key,c);controllers.current.add(c);
  try{
   // The saved board first, props and hit rates together, before any request.
   // Both may already be on their way, started at sign-in (finder-early.js).
   const started=!force?takeEarly(key):null;
   const cached=!force?await (started?started.cached:readFinderCache(key)):null;
   if(c.signal.aborted)return;
   if(cached){latest.current[key]=cached.rows;putBoard(key,old=>({...old,...cached,state:'ready',error:null,version:(old.version||0)+1}));}
   else setBoards(old=>({...old,[key]:{...old[key],state:old[key].rows?.length?'ready':'loading',error:null}}));
   // A board saved moments ago is current; otherwise ask again, keeping the
   // hit rates of every line that hasn't changed (carryHistory).
   if(!cached||Date.now()-Number(cached.ts||0)>=BOARD_FRESH){
    // The lines show as soon as they're in; the hit rates the server has
    // saved land a moment later instead of holding them back.
    const head=started&&await started.live;
    const saved=head?head.saved:hasFinderSnapshot(key)?loadFinderSnapshot(key,{signal:c.signal}).catch(()=>({})):null;
    const fresh=await (head?head.board:loadFinderSportRaw(key,{signal:c.signal,fast:key==='wnba'||key==='nba'}));if(c.signal.aborted)return;
    const previous=boardsRef.current[key].rows?.length?boardsRef.current[key].rows:cached?.rows||[];
    let rows=carryHistory(fresh.rows,previous);
    const withSaved=(list,histories)=>{
     const need=list.filter(row=>row.historyStatus!=='ready'||row.historyRefresh);
     if(!need.length||!histories||!Object.keys(histories).length)return list;
     const filled=new Map(applyFinderSnapshot(need,histories).map(row=>[row.id,row]));
     return list.map(row=>filled.get(row.id)||row);
    };
    // Saved hit rates that are already here go in with the lines.
    const early=saved&&await Promise.race([saved,Promise.resolve(null)]);
    if(early)rows=withSaved(rows,early);
    // A refresh while a league's hit rates are loading restarts them on the new lines.
    enriching.current.get(key)?.abort();
    putBoard(key,{...fresh,ts:Date.now(),rows,state:'ready',error:null,version:(boardsRef.current[key].version||0)+1});
    if(saved&&!early){
     const histories=await within(saved,1500,null);if(c.signal.aborted)return;
     if(histories)putBoard(key,old=>({...old,rows:withSaved(old.rows||[],histories)}));
    }
    saveSoon(key);
   }
  }
  catch(e){if(e.name!=='AbortError')setBoards(old=>({...old,[key]:{...old[key],state:old[key].rows?.length?'ready':'error',error:e.message}}));}
  finally{requests.current.delete(key);controllers.current.delete(c);}
  // Hit rates next, for the lines on screen first. Leagues warmed in the
  // background wait their turn (enrichBoard).
  if(!c.signal.aborted&&!background)setTimeout(()=>enrichBoard(key),0);
 },[enrichBoard,putBoard,saveSoon]);
 // Save what is on screen when the app goes to the background, so hit rates
 // loaded so far are there on the next open even if loading was cut short.
 useEffect(()=>{
  const save=()=>{if(document.visibilityState!=='hidden')return;KEYS.forEach(key=>{const board=boardsRef.current[key];if(board.state==='ready'&&board.rows?.length)persistFinderCache(key,board);});};
  document.addEventListener('visibilitychange',save);return()=>document.removeEventListener('visibilitychange',save);
 },[]);
 useEffect(()=>{scope.forEach(key=>load(key));},[scopeKey,load]);
 // Keep open screens current, but never spend background-tab bandwidth.
 useEffect(()=>{const refresh=()=>{if(document.visibilityState==='hidden')return;scope.forEach(key=>load(key,true));};const timer=setInterval(refresh,BOARD_FRESH);document.addEventListener('visibilitychange',refresh);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};},[scopeKey,load]);
 // Warm the other leagues during idle time so switching sports is a local
 // state change for returning users instead of a blank/loading transition.
 useEffect(()=>{
  let cancelled=false;
  // Never warm a league the user is not allowed to see.
  const prefetch=()=>{if(cancelled)return;allowedKeys.filter(key=>!scope.includes(key)).forEach(key=>load(key,false,{background:true}));};
  const idle=typeof window!=='undefined'&&window.requestIdleCallback?window.requestIdleCallback(prefetch,{timeout:1800}):setTimeout(prefetch,900);
  return()=>{cancelled=true;if(typeof window!=='undefined'&&window.cancelIdleCallback&&typeof idle==='number')window.cancelIdleCallback(idle);else clearTimeout(idle);};
 },[scopeKey,load,allowedKeys]);
 useEffect(()=>()=>{controllers.current.forEach(c=>c.abort());generation.current.clear();},[]);
 // Rows already loaded for a league that was since switched off must not
 // keep showing under "All".
 // Defense-vs-position ranks come from each league's own table (the one the
 // player pages show), fetched once when that league's board is ready.
 const [leagues,setLeagues]=useState({}),leagueRequests=useRef(new Set());
 useEffect(()=>{['wnba','nba','nfl'].forEach(key=>{if(boards[key].state!=='ready'||leagueRequests.current.has(key))return;leagueRequests.current.add(key);loadFinderDefense(key).then(data=>{if(data?.dvp)setLeagues(old=>({...old,[key]:data}));}).catch(()=>leagueRequests.current.delete(key));});},[boards.wnba.state,boards.nba.state,boards.nfl.state]);
 const defended=useRef(new WeakMap());
 const allRows=useMemo(()=>allowedKeys.flatMap(k=>{
  // Each league's defense ranks are worked out once per board, not again for every league whenever one changes.
  const list=boards[k].rows||[],league=leagues[k];if(!league)return list;
  const hit=defended.current.get(list);if(hit?.league===league)return hit.rows;
  const rows=withDefense(list,league);defended.current.set(list,{league,rows});return rows;
 }),[boards,allowedKeys,leagues]);
 // A detail page opened from a saved board must receive fresh fixture IDs
 // when the live board arrives, rather than retaining its stale snapshot.
 useEffect(()=>{setSelected(current=>{
  if(!current||current.sport!=='soccer')return current;
  const fresh=allRows.find(row=>row.id===current.id);
  return fresh&&fresh.eventId&&(!current.eventId||fresh.eventId!==current.eventId||fresh.teamId!==current.teamId)?fresh:current;
 });},[allRows]);
 const sportRows=useMemo(()=>allRows.filter(r=>scope.includes(r.sport)),[allRows,scopeKey]);
 // The filter menus (markets, apps, teams, days, games) come from the lines
 // themselves, so they're rebuilt when a board's lines change -- not each
 // time a batch of hit rates fills in.
 const linesKey=scope.map(k=>`${k}:${boards[k].version||0}:${boards[k].rows?.length||0}`).join();
 const lineRows=useMemo(()=>sportRows,[linesKey]);// eslint-disable-line react-hooks/exhaustive-deps
 const markets=useMemo(()=>[...new Set(lineRows.map(r=>r.market))].sort(),[lineRows]);
 const books=useMemo(()=>[...new Set(lineRows.flatMap(r=>r.apps.map(a=>a.key)))].sort((a,b)=>a==='prizepicks'?-1:b==='prizepicks'?1:a.localeCompare(b)),[lineRows]);
 const teams=useMemo(()=>[...new Set(lineRows.map(r=>r.teamAbbr).filter(Boolean))].sort(),[lineRows]);
 const days=useMemo(()=>[...new Set(lineRows.map(r=>dayKey(r.startsAt)).filter(Boolean))].sort(),[lineRows]);
 const bookOptions=useMemo(()=>books.map(value=>({value,label:bookName(value)})),[books]);
 const marketOptions=useMemo(()=>markets.map(value=>({value,label:value})),[markets]);
 // Full names where the rows carry them (soccer's clubs and countries).
 const teamOptions=useMemo(()=>{const names=new Map();for(const row of lineRows){if(row.teamAbbr&&row.teamName)names.set(row.teamAbbr,row.teamName);if(row.opponent&&row.opponentName)names.set(row.opponent,row.opponentName);}
  return teams.map(value=>({value,label:value,sub:names.get(value)||undefined}));},[teams,lineRows]);
 // Games: one entry per match, under its competition, with each side's
 // chance to win where the moneyline is known.
 const games=useMemo(()=>{const found=new Map();for(const row of lineRows){const key=gameKey(row);if(!key)continue;const game=found.get(key)||{key,group:row.competitionName||row.sport.toUpperCase(),away:row.awayTeamAbbr,home:row.homeTeamAbbr,startsAt:row.startsAt,logos:{},chances:{}};
  if(row.teamAbbr&&row.teamLogo)game.logos[row.teamAbbr]=row.teamLogo;if(row.opponent&&row.opponentLogo)game.logos[row.opponent]=row.opponentLogo;if(row.teamAbbr&&finite(row.winChance))game.chances[row.teamAbbr]=row.winChance;found.set(key,game);}
  return [...found.values()].sort((a,b)=>a.group.localeCompare(b.group)||String(a.startsAt).localeCompare(String(b.startsAt)));},[lineRows]);
 const gameOptions=useMemo(()=>games.map(game=>({value:game.key,label:`${game.away} @ ${game.home}`,aria:`${game.away} at ${game.home}`,group:game.group,search:`${game.away} ${game.home}`,render:()=><GameOption game={game}/>})),[games]);
 const dayOptions=useMemo(()=>days.map(value=>({value,label:new Date(value+'T12:00:00').toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})})),[days]);
 const lineOptions=useMemo(()=>[{value:'standard',label:'Regular'},{value:'goblin',label:'Goblins'},{value:'demon',label:'Demons'}],[]);
 const order=useMemo(()=>sorts.length?sorts:[DEFAULT_SORT],[sorts]),sort=order[0];
 // Typing in the search box stays instant; the list catches up a beat later.
 const searched=useDeferredValue(query);
 const rows=useMemo(()=>{
  const hitActive=hitFilter.windows.length>0||hitFilter.min>0||hitFilter.max<100;
  const hitWindows=hitFilter.windows.length?hitFilter.windows:['l5','l10','l15','h2h','season'];
  const filtered=sportRows.filter(r=>(!marketFilter.length||marketFilter.includes(r.market))&&(!bookFilter.length||bookFilter.some(book=>r.apps.some(a=>a.key===book)))&&(!teamFilter.length||teamFilter.includes(r.teamAbbr))&&(!dayFilter.length||dayFilter.includes(dayKey(r.startsAt)))&&(!gameFilter.length||gameFilter.includes(gameKey(r)))&&
    matchesPrizePicksLine(r,modifierFilter)&&
    (!hitActive||hitWindows.every(key=>finite(r.windows?.[key]?.hitRate)&&r.windows[key].hitRate>=hitFilter.min&&r.windows[key].hitRate<=hitFilter.max))&&(!savedOnly||picks.has(r.id))&&(!searched.trim()||(r.player+' '+(r.teamAbbr||'')+' '+(r.opponent||'')).toLowerCase().includes(searched.trim().toLowerCase())));
  // Each chosen sort in turn; a row missing that value goes after the rest.
  const value=(r,key)=>key==='player'?r.player:key==='average'?r.average:key==='diff'?r.diff:key==='streak'?r.streak:key==='line'?r.line:key==='defense'?r.defense:r.windows?.[key]?.hitRate;
  const compare=(a,b,{key,direction})=>{const av=value(a,key),bv=value(b,key);if(av==null&&bv==null)return 0;if(av==null)return 1;if(bv==null)return -1;const n=typeof av==='string'?byName(av,bv):av-bv;return direction==='asc'?n:-n;};
  return filtered.sort((a,b)=>{for(const item of order){const n=compare(a,b,item);if(n)return n;}return byName(a.player,b.player);});
 },[sportRows,marketFilter,bookFilter,teamFilter,dayFilter,gameFilter,modifierFilter,hitFilter,savedOnly,picks,searched,order]);
 useEffect(()=>setPage(0),[scopeKey,query,marketFilter,bookFilter,teamFilter,dayFilter,gameFilter,modifierFilter,hitFilter,pageSize,savedOnly,order]);
 const pages=Math.max(1,Math.ceil(rows.length/pageSize)),currentPage=Math.min(page,pages-1),visible=rows.slice(currentPage*pageSize,(currentPage+1)*pageSize);
 priority.current=new Set([...visible,...rows.slice(0,60)].map(row=>row.id));
 const loading=scope.some(k=>['loading','idle'].includes(boards[k].state)),errors=scope.filter(k=>boards[k].error).map(k=>k.toUpperCase()+': '+boards[k].error),histories=sportRows.filter(r=>r.historyStatus==='pending').length;
 const timestamp=scope.map(k=>boards[k].fetchedAt).filter(Boolean).sort().at(-1);
 const historyTimestamp=sportRows.reduce((latest,row)=>Math.max(latest,Number(row.historyAsOf||row.enrichedAt)||0),0);
 useEffect(()=>{saveFinderView(storage(),{picked,marketFilter,bookFilter,teamFilter,modifierFilter,hitFilter,sorts,pageSize});},[picked,marketFilter,bookFilter,teamFilter,modifierFilter,hitFilter,sorts,pageSize]);
 // A filter brought back from last time that today's board doesn't have
 // (a team not playing) is dropped once the board is in, so it never
 // leaves the board empty.
 useEffect(()=>{
  if(!restoring.current||loading||!sportRows.length)return;
  restoring.current=false;
  setMarketFilter(values=>values.filter(value=>markets.includes(value)));setBookFilter(values=>values.filter(value=>books.includes(value)));setTeamFilter(values=>values.filter(value=>teams.includes(value)));
 },[loading,sportRows,markets,books,teams]);
 // Keep saved picks' prices and start times current with the board.
 useEffect(()=>{
  if(!picks.size)return;
  const updates=allRows.filter(row=>picks.has(row.id)).map(row=>({id:finderSlipId(row),apps:slipApps(row.apps),startsAt:row.startsAt||'',teamLogo:row.teamLogo||'',headshot:row.headshot||''}));
  if(updates.length)pickBuilder.refresh(updates);
 },[allRows,picks]);
 const open=useCallback(row=>{trigger.current='Open '+row.sport.toUpperCase()+' '+row.player+' '+row.line+' '+row.market+' trends';setSelected(row);},[]);
 // Another page asking for a prop (the Smart Slip's Research button) is
 // handled like a link.
 const [linkTick,setLinkTick]=useState(0);
 useEffect(()=>{
  const onOpen=({detail})=>{if(!detail?.sport||!detail?.player)return;linked.current={sport:detail.sport,player:detail.player,stat:detail.stat||''};setSelected(null);setPicked([detail.sport]);setQuery(detail.player);setMobileSearch(true);setLinkTick(n=>n+1);};
  window.addEventListener('vortex:open-prop',onOpen);return()=>window.removeEventListener('vortex:open-prop',onOpen);
 },[]);
 // The linked prop opens once its league's board is in; a line no longer
 // posted leaves that player's other lines showing (the search holds the
 // name). The link is then taken off the address.
 useEffect(()=>{
  const want=linked.current,board=want&&boards[want.sport];
  if(!want||!board||!['ready','error'].includes(board.state))return;
  linked.current=null;
  const row=board.state==='ready'?findLinkedRow(allRows,want):null;
  if(row)open(row);
  try{const url=new URL(location.href);['sport','player','stat'].forEach(name=>url.searchParams.delete(name));history.replaceState(history.state,'',url.pathname+url.search+url.hash);}catch{}
 },[boards,allRows,open,linkTick]);
 const back=()=>{setSelected(null);requestAnimationFrame(()=>{const button=[...document.querySelectorAll('.finder-open')].find(el=>el.getAttribute('aria-label')===trigger.current);button?.focus({preventScroll:true});});};
 const changeSports=keys=>{setPicked(keys);setSelected(null);setMarketFilter([]);setBookFilter([]);setTeamFilter([]);setDayFilter([]);setGameFilter([]);setModifierFilter([]);setHitFilter({windows:[],min:0,max:100});};
 const clear=()=>{setQuery('');setMarketFilter([]);setBookFilter([]);setTeamFilter([]);setDayFilter([]);setGameFilter([]);setModifierFilter([]);setHitFilter({windows:[],min:0,max:100});setSavedOnly(false);};
 // A table heading sorts by that column alone; tapping it again flips it.
 const onSort=key=>setSorts(old=>{const first=old[0]||DEFAULT_SORT;return [{key,direction:first.key===key&&first.direction==='desc'?'asc':'desc'}];});
 // Phone sort chips stack: each one tapped sorts within the ones before it
 // (numbered in order). Tapping a chip again flips it; its x removes it.
 const toggleSort=key=>setSorts(old=>old.some(item=>item.key===key)?old.map(item=>item.key===key?{...item,direction:item.direction==='desc'?'asc':'desc'}:item):[...old,{key,direction:'desc'}]);
 const removeSort=key=>setSorts(old=>old.filter(item=>item.key!==key));
 const hasDefense=useMemo(()=>sportRows.some(row=>finite(row.defense)),[sportRows]);
 const changePage=n=>{setPage(n);tableRef.current?.scrollTo({top:0});};
 const playerRows=useMemo(()=>finderPlayerRows(allRows,selected),[allRows,selected]);
 // The trend panel's save star (app.js vortexTrendPanel.setSave): it saves
 // the line the panel is showing, through the same Over / Under chooser as
 // the board's stars.
 useEffect(()=>{
  const panel=window.vortexTrendPanel;
  if(!panel?.setSave)return undefined;
  if(!selected){panel.setSave(null);return undefined;}
  const line=current=>trendPickRow(current.postedRows||playerRows,current)||selected;
  panel.setSave({savedSide:current=>picks.get(line(current).id)||null,onClick:(anchor,current)=>onPick(line(current),anchor)});
  return()=>panel.setSave(null);
 },[selected,playerRows,picks,onPick]);
 const dropdownAssets=useMemo(()=>({Teams:Object.fromEntries(lineRows.filter(row=>row.teamAbbr&&row.teamLogo).map(row=>[row.teamAbbr,row.teamLogo])),Apps:Object.fromEntries(books.map(key=>[key,LOGOS[key]||'/sportsbooks/'+key+'.png'])),'Choose sport':LEAGUE_LOGOS,'Line type':{standard:'/prizepicks/logo.png',goblin:'/prizepicks/goblin.png',demon:'/prizepicks/demon.png'}}),[lineRows,books]);
 if(!allowedKeys.length)return <main className="unified-finder" aria-label="Finder"><div className="finder-message">The Finder is not available right now. Check back soon.</div></main>;
 return <FinderDropdownAssets.Provider value={dropdownAssets}><main className={'unified-finder'+(selected?' finder-detail-active':'')+(mobileSearch?' finder-search-expanded':'')} aria-label="Multi-sport prop Finder">
  <header className="finder-topbar"><div className="finder-title"><button type="button" className="finder-picks-trigger" data-requires-tab="saved" aria-label={'Open Pick Builder'+(builder.legs.length?' ('+builder.legs.length+' saved '+(builder.legs.length===1?'pick':'picks')+')':'')} aria-controls="side-panel" aria-haspopup="dialog" onClick={event=>{event.stopPropagation();setChooser(null);pickBuilder.open();}}><Table2 size={19} aria-hidden="true"/>{builder.legs.length>0&&<b aria-hidden="true">{builder.legs.length}</b>}</button><h1>Finder</h1><span>/</span><FinderSportMenu sports={allowedKeys} values={picked} onChange={changeSports} logos={LEAGUE_LOGOS}/></div><nav className="finder-sports" aria-label="Finder sport">{visibleSports.map(key=><button type="button" key={key} aria-pressed={key==='all'?scope.length===allowedKeys.length:scope.length<allowedKeys.length&&scope.includes(key)} onClick={()=>changeSports(key==='all'?[]:[key])}>{key==='all'?<Grid2X2 size={15}/>:<League sport={key}/>}<span>{key==='all'?'All':key.toUpperCase()}</span></button>)}</nav><img className="finder-brand" src="/brand/ace-props-wordmark.png" alt="Ace Props" width="63" height="24"/><button type="button" className="finder-icon finder-top-save" data-requires-tab="saved" aria-label="Show only your picks" aria-pressed={savedOnly} onClick={()=>{setSelected(null);setSavedOnly(v=>!v);}}><Bookmark size={17}/></button><PhoneAccountButtons/></header>
  {selected?<Suspense fallback={<div className="finder-message"><LoaderCircle className="finder-spin"/>Loading player trends…</div>}>{selected.sport==='wnba'||selected.sport==='nba'?<WNBAPlayerPage row={selected} playerRows={playerRows} onBack={back}/>:selected.sport==='soccer'?<SoccerPlayerPage row={selected} playerRows={playerRows} onBack={back}/>:selected.sport==='nhl'?<NHLPlayerPage row={selected} playerRows={playerRows} onBack={back}/>:<FinderTrendView row={selected} playerRows={playerRows} onBack={back}/>}</Suspense>:<>
   <div className="finder-controls"><div className="finder-search-row"><label className="finder-search"><Search size={16}/><input type="search" aria-label="Search players or teams" placeholder="Search players or teams…" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="finder-app-filter"><FinderMultiSelect label="Apps" icon={Grid2X2} values={bookFilter} onChange={setBookFilter} options={bookOptions} placeholder="All apps"/><span className="finder-app-icons" aria-hidden="true">{books.slice(0,6).map(k=><Photo key={k} src={LOGOS[k]||'/sportsbooks/'+k+'.png'} width="23" height="23"/>)}</span></div><button type="button" className="finder-mobile-search-toggle finder-icon" aria-label="Toggle player search" aria-expanded={mobileSearch} onClick={()=>setMobileSearch(v=>!v)}><Search size={18}/></button><button type="button" className="finder-icon" aria-label="Refresh Finder" onClick={()=>scope.forEach(k=>load(k,true))} disabled={loading}><RefreshCw size={16} className={loading?'finder-spin':''}/></button></div>
   <div className="finder-filters"><FinderMultiSelect label="Line type" icon={SlidersHorizontal} values={modifierFilter} onChange={setModifierFilter} options={lineOptions} placeholder="All lines" searchable={false}/><FinderMultiSelect label="Stats" icon={ChartNoAxesColumnIncreasing} values={marketFilter} onChange={setMarketFilter} options={marketOptions} placeholder="All stats"/>{gameOptions.length>0&&<FinderMultiSelect label="Games" icon={Swords} values={gameFilter} onChange={setGameFilter} options={gameOptions} placeholder="All games" only wide/>}<FinderMultiSelect label="Teams" icon={Users} values={teamFilter} onChange={setTeamFilter} options={teamOptions} placeholder="All teams" only/><FinderMultiSelect label="Date" icon={CalendarDays} values={dayFilter} onChange={setDayFilter} options={dayOptions} placeholder="All dates" searchable={false}/><FinderHitRateFilter value={hitFilter} onChange={setHitFilter}/><button type="button" className={'finder-saved '+(savedOnly?'is-active':'')} data-requires-tab="saved" aria-pressed={savedOnly} onClick={()=>setSavedOnly(v=>!v)}><Bookmark size={15}/>Saved{picks.size>0&&<b>{picks.size}</b>}</button><button type="button" className="finder-icon finder-reset" aria-label="Reset all Finder filters" onClick={clear}><Trash2 size={16}/></button></div></div>
   <div className="finder-mobile-sort" role="group" aria-label="Sort prop cards">{MOBILE_SORTS.filter(([key])=>key!=='defense'||hasDefense).map(([key,label])=>{const index=sorts.findIndex(item=>item.key===key),active=sorts[index];return <span key={key} className="finder-sort-chip" data-active={active?'true':undefined}><button type="button" aria-pressed={Boolean(active)} aria-label={active?'Sorted by '+label+(sorts.length>1?' (sort '+(index+1)+')':'')+', '+(active.direction==='desc'?'high to low':'low to high')+'. Tap to flip':'Sort by '+label} onClick={()=>toggleSort(key)}>{label}{active&&<b aria-hidden="true">{index+1}</b>}{active?(active.direction==='desc'?<ArrowDown size={12}/>:<ArrowUp size={12}/>):<ArrowUpDown size={11}/>}</button>{active&&<button type="button" className="finder-sort-remove" aria-label={'Stop sorting by '+label} onClick={()=>removeSort(key)}><X size={12}/></button>}</span>;})}</div>
   {/* The counts, history times and colour key are for the admin; members only see that lines are loading. */}
   {(siteIsAdmin()||loading)&&<div className="finder-meta"><span role="status">{loading?<><LoaderCircle size={12} className="finder-spin"/>Loading {scope.filter(k=>boards[k].state!=='ready').map(k=>k.toUpperCase()).join(', ')}…</>:<><i/>{rows.length.toLocaleString()} props</>}{histories>0&&<small> · Filling new history for {histories} lines</small>}{historyTimestamp>0&&<small> · History updated {new Date(historyTimestamp).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</small>}</span>{siteIsAdmin()&&<span className="finder-legend"><i data-tone="good"/>70%+<i data-tone="mid"/>45–69%<i data-tone="low"/>&lt;45% <span>·</span>{timestamp?'Updated '+new Date(timestamp).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'Pushes excluded'}</span>}</div>}
   {errors.length>0&&sportRows.length>0&&<div className="finder-availability" role="status"><span>{scope.some(k=>boards[k].error&&boards[k].persisted)?'The latest props couldn’t load. Showing the last saved lines.':'Some props are temporarily unavailable.'}</span><button type="button" onClick={()=>scope.filter(k=>boards[k].error).forEach(k=>load(k,true))}>Retry</button></div>}
   <section className="finder-board" aria-label="Player props"><div className="finder-scroll" ref={tableRef}><table className="finder-table"><caption className="finder-sr-only">Historical hit rates for the displayed line and side. Green 70 percent or more, yellow 45 to 69 percent, red below 45 percent. Missing data is shown as a dash.</caption><thead><tr><Heading name="player" label="Line" sort={sort} onSort={onSort}/><th scope="col">Apps</th><th scope="col" title="Odds-implied probability, normalized to remove margin">Book %</th><Heading name="average" label="Avg L10" sort={sort} onSort={onSort}/><Heading name="diff" label="Diff" sort={sort} onSort={onSort}/>{WINDOWS.slice(0,4).map(([key,label])=><Heading key={key} name={key} label={label} sort={sort} onSort={onSort}/>)}<Heading name="streak" label="Streak" sort={sort} onSort={onSort}/><Heading name="season" label="SZN" sort={sort} onSort={onSort}/></tr></thead><tbody>{/* Keyed by place on the page: turning the page updates the rows already there rather than building new ones. */}{visible.map((row,index)=><Row key={index} row={row} onOpen={open} pick={picks.get(row.id)} onPick={onPick}/>)}</tbody></table>{!visible.length&&<div className="finder-message finder-empty-board" role="status">{loading?<><LoaderCircle className="finder-spin"/><strong>Loading the prop board</strong><span>Lines appear here as each sport loads.</span></>:<><ChartNoAxesColumnIncreasing size={26} aria-hidden="true"/><strong>{errors.length&&!sportRows.length?'Props temporarily unavailable':savedOnly?'No saved props found':'No props found'}</strong><span>{errors.length&&!sportRows.length?'We couldn’t load the latest props. Please try again.':sportRows.length?'No props match these filters. Loosen or reset them to see more.':'No upcoming props are available right now. Check back soon.'}</span><button type="button" onClick={errors.length&&!sportRows.length?()=>scope.filter(k=>boards[k].error).forEach(k=>load(k,true)):clear}>{errors.length&&!sportRows.length?'Retry':'Clear all filters'}</button></>}</div>}</div><footer className="finder-pagination"><span>{rows.length?(currentPage*pageSize+1)+'–'+Math.min((currentPage+1)*pageSize,rows.length)+' of '+rows.length.toLocaleString():'0 props'}</span><div><button type="button" aria-label="Previous page" disabled={currentPage===0} onClick={()=>changePage(currentPage-1)}><ChevronLeft size={17}/></button><span>Page <b>{currentPage+1}</b> / {pages}</span><button type="button" aria-label="Next page" disabled={currentPage>=pages-1} onClick={()=>changePage(currentPage+1)}><ChevronRight size={17}/></button><label><ListFilter size={14}/><FinderDropdown aria-label="Rows per page" value={pageSize} onChange={e=>setPageSize(Number(e.target.value))}>{[20,50,100].map(n=><option value={n} key={n}>{n} rows</option>)}</FinderDropdown><ChevronDown size={12}/></label></div><span className="finder-page-hint">Select a player to open Trends</span></footer></section>
  </>}
  {chooser&&<PickSideMenu key={chooser.row.id} row={chooser.row} anchor={chooser.anchor} side={picks.get(chooser.row.id)} onClose={closeChooser}/>}
 </main></FinderDropdownAssets.Provider>;
}
