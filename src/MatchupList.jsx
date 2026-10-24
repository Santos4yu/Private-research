// A Props tab league's list (NbaMatchups.jsx, NflMatchups.jsx): a table row
// for every prop PrizePicks posts in it, with how good the opponent is for
// it, how often it has cleared its line lately and its Prop grade
// (props-grade.js: the over at tonight's line as the Analyzer grades it),
// sortable by each from the buttons or the column headings. A row opens that
// player's matchup page; its arrow shows what made the scores.
// `config` says which league: its stats, its lines (props-data.js), its score
// and page.
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowDown,Check,ChevronDown,RefreshCw,Search,X} from 'lucide-react';
import {windowGames,windowRate} from './unified-finder-data';
import {Face,Img} from './PickParts';
import {propGrades} from './props-grade';
import {loadLearning} from './learning';
import {lineupRole} from './lineup-role';
import {ENOUGH,loadRecord,reportProps,reportRows} from './props-record';
import './nba-matchups.css';

const SORTS=[['matchup','Matchup'],['hit','Hit %'],['prop','Prop grade']];
// The table's headings for the sorted columns: full, and on a phone.
const HEADS={matchup:['Matchup','Match'],hit:['Last 10','L10'],prop:['Prop grade','Prop']};
const READS={teammates:'His teammates out',missing:'Their players out',recent:'Their last 10 games',defense:'Their defense',pace:'Their pace',position:'vs his position',attempts:'Threes they allow',rebounds:'Rebounds they allow',assists:'Assists they allow',turnovers:'Their turnovers',meetings:'His games vs them',
 script:'The game line',scoring:'His team’s scoring',role:'His role'};
// What a read adds to (or takes from) the even 50.
const added=points=>`${points>0?'+':points<0?'−':''}${Math.abs(Math.round(points))} ${Math.abs(Math.round(points))===1?'point':'points'}`;
const figure=value=>Number.isInteger(Number(value))?String(Number(value)):Number(value).toFixed(1);
const when=iso=>{const time=Date.parse(iso||'');if(!Number.isFinite(time))return '';const date=new Date(time),today=new Date();
 const clock=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 return date.toDateString()===today.toDateString()?clock:`${date.toLocaleDateString([],{weekday:'short'})} ${clock}`;};
// One game, whatever start time each of its lines carries (PrizePicks posts
// some at 6:30 and some at 6:40): the two teams on the day.
const dayOf=iso=>{const time=Date.parse(iso||'');return Number.isFinite(time)?new Date(time).toDateString():'';};
const gameOf=row=>`${row.awayTeamAbbr||''}@${row.homeTeamAbbr||''}|${dayOf(row.startsAt)}`;
const hitTone=rate=>rate>=70?'strong':rate>=55?'edge':rate>=40?'neutral':'tough';
const hitOf=row=>{const window=row.windows?.l10;const games=windowGames(window);return games?{rate:windowRate(window),hits:window.hits,games}:null;};

function Bar({value,tone}){
 return <span className="nm-bar" data-tone={tone||undefined}><i style={{width:`${Math.max(4,Math.min(100,value))}%`}}/></span>;
}

// One of the row's three numbers, under its heading: the number and what it
// means, and for a Demon's grade the chance it needs.
function Cell({kind,value,sub,note,tone}){
 return <span className={`nm-cell nm-${kind}`} data-tone={tone||undefined}><b>{value}</b><em>{sub}</em>{note&&<small>{note}</small>}</span>;
}
const percent=value=>`${Math.round(value*100)}%`;
// How far the chance sits from what the line needs, in the rounded numbers shown.
const gapText=prop=>{const gap=Math.round(prop.chance*100)-Math.round(prop.needs*100);
 return gap?`${percent(prop.chance)} is ${Math.abs(gap)} ${Math.abs(gap)===1?'point':'points'} ${gap>0?'over':'under'} that`:`${percent(prop.chance)} is right at that`;};

// One prop: who and when, the line, then Matchup, Last 10 and Prop grade.
function PropRow({row,read,hit,prop,role,open,onToggle,onOpen,short}){
 const home=row.teamAbbr&&row.teamAbbr===row.homeTeamAbbr;
 const demon=String(row.modifier||'').toLowerCase()==='demon';
 const stat=short[row.marketKey]||row.market;
 const waiting=row.historyStatus==='pending'||row.historyRefresh;
 const said=[read&&`matchup ${read.score}`,hit&&`last 10 ${hit.hits} of ${hit.games}`,prop&&`prop grade ${Math.round(prop.chance*100)}%`].filter(Boolean).join(', ');
 return <li className="nm-row" data-open={open||undefined}>
  <button type="button" className="nm-main" onClick={()=>onOpen(row)} aria-label={`${row.player}, more ${figure(row.line)} ${stat}${demon?' Demon':''}${said?`: ${said}`:''}. Open his matchup page`}>
   <Face row={row}/>
   <b className="nm-name">{row.player}</b>
   <small className="nm-when">{row.position&&<span className="nm-pos">{row.position} · </span>}{role&&<><span className="nm-role" data-role={role.starter?'starter':'bench'} title={role.text}>{role.label}</span> · </>}
    {row.teamAbbr&&row.opponent?<><span className="nm-own">{row.teamAbbr} </span>{home?'vs':'@'} {row.opponent}</>:row.teamAbbr}{row.startsAt&&` · ${when(row.startsAt)}`}</small>
   <span className="nm-line"><small>More</small><b>{figure(row.line)}</b><em>{stat}</em>{demon&&<img className="nm-demon" src="/prizepicks/demon-64.png" alt="Demon" title="PrizePicks Demon: a higher line that pays more" width="18" height="18"/>}</span>
   <Cell kind="score" value={read?read.score:'—'} sub={read?read.label:'No data yet'} tone={read?.tone}/>
   <Cell kind="hit" value={hit?`${hit.hits}/${hit.games}`:'—'} sub={hit?`${Math.round(hit.rate)}% over`:waiting?'Loading…':'No games'} tone={hit?hitTone(hit.rate):undefined}/>
   <Cell kind="prop" value={prop?percent(prop.chance):'—'} sub={prop?prop.label:hit?'Not graded':'Loading…'} note={prop&&prop.needs!==0.5?`needs ${percent(prop.needs)}`:null} tone={prop?.tone}/>
  </button>
  {read?<button type="button" className="nm-why" aria-expanded={open} aria-label={`Why ${row.player}'s scores`} title="Why these scores" onClick={onToggle}><ChevronDown size={16}/></button>:<span aria-hidden="true"/>}
  {open&&read&&<ul className="nm-reads">{prop&&<li className="nm-read-note">Prop grade: a {percent(prop.chance)} chance of the over at {figure(row.line)}, from his recent games and role with this matchup.
   {prop.needs===0.5?' A regular line needs 50% to be worth taking;':prop.priced?` The sportsbooks give the over at this line a ${percent(prop.needs)} chance, so that's what this ${demon?'Demon':'Goblin'} needs to beat;`
    :` A ${demon?'Demon':'Goblin'} ${demon?'pays more than a regular line, so it only needs':'pays less, so it needs'} about ${percent(prop.needs)} to be worth taking (a regular line needs 50%);`} {gapText(prop)}{read?`, with a ${read.score} matchup`:''}: {prop.label}.</li>}
   {role&&<li className="nm-read-note">{role.label}: {role.starter?'he started his team’s last game':'he didn’t start his team’s last game'} and {role.starts} of his last {role.games}. Tonight’s lineup is announced about half an hour before tip-off.</li>}
   <li className="nm-read-note">Matchup: an even one is 50. Each part adds or takes away points.</li>{read.reads.map(item=><li key={item.key}>
   <span className="nm-read-head"><b>{READS[item.kind]||READS[item.key]||'Their defense'}</b><em>{added(item.points)}</em></span>
   <span className="nm-read-text">{item.text}</span>
   <Bar value={item.score} tone={item.score>=60?'edge':item.score>=40?'neutral':'tough'}/>
  </li>)}</ul>}
 </li>;
}

// How the props the list showed went (props-record.js): by matchup score
// band and Prop grade tier, over each one's line, once enough have been
// played. The NBA's only.
const TIER_NAMES={elite:'Elite',strong:'Strong',lean:'Lean',risky:'Risky',fade:'Fade'};
function TrackRecord(){
 const [record,setRecord]=useState(null),[open,setOpen]=useState(false);
 useEffect(()=>{let live=true;loadRecord(14).then(data=>{if(live)setRecord(data);}).catch(()=>{});return()=>{live=false;};},[]);
 const bands=(record?.bands||[]).filter(item=>item.props>=ENOUGH),tiers=(record?.tiers||[]).filter(item=>item.props>=ENOUGH);
 if(!record||!bands.length)return record?.nights>0?<p className="nm-record-note">Track record: {record.all.props} props over {record.nights} {record.nights===1?'night':'nights'} so far. Rates show once each band has {ENOUGH}.</p>:null;
 const top=bands[0];
 const rate=item=>`${Math.round(item.overRate)}%`;
 return <section className="nm-record" data-open={open||undefined}>
  <button type="button" className="nm-record-head" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>
   <span><b>Track record</b><small>Last {record.nights} {record.nights===1?'night':'nights'}: matchup {top.band} went over {rate(top)} of {top.props}</small></span><ChevronDown size={16} aria-hidden="true"/></button>
  {open&&<div className="nm-record-body">
   <table><caption>How often the props this list showed went over their line, by matchup score</caption>
    <thead><tr><th scope="col">Matchup</th><th scope="col">Over</th><th scope="col">Props</th></tr></thead>
    <tbody>{bands.map(item=><tr key={item.band}><th scope="row">{item.band}</th><td>{rate(item)}</td><td>{item.props}</td></tr>)}</tbody></table>
   {tiers.length>0&&<table><caption>By Prop grade</caption>
    <thead><tr><th scope="col">Grade</th><th scope="col">Over</th><th scope="col">Props</th></tr></thead>
    <tbody>{tiers.map(item=><tr key={item.tier}><th scope="row">{TIER_NAMES[item.tier]}</th><td>{rate(item)}</td><td>{item.props}</td></tr>)}</tbody></table>}
  </div>}
 </section>;
}

// The game menu: each game once, with both teams' logos, its time and how
// many props it has. Opens under the button; Escape, a tap outside or a pick
// closes it, and the arrow keys move through it.
function GamePicker({games,value,onChange}){
 const [open,setOpen]=useState(false);
 const box=useRef(null),button=useRef(null),list=useRef(null);
 const options=useMemo(()=>[{key:'all',label:'All games',count:games.reduce((sum,game)=>sum+game.count,0)},...games],[games]);
 const chosen=options.find(option=>option.key===value)||options[0];
 useEffect(()=>{
  if(!open)return undefined;
  const away=event=>{if(box.current&&!box.current.contains(event.target))setOpen(false);};
  document.addEventListener('pointerdown',away);
  requestAnimationFrame(()=>list.current?.querySelector('[aria-selected=true]')?.focus());
  return()=>document.removeEventListener('pointerdown',away);
 },[open]);
 const pick=key=>{onChange(key);setOpen(false);button.current?.focus();};
 const keys=event=>{
  const items=[...(list.current?.querySelectorAll('[role=option]')||[])],at=items.indexOf(document.activeElement);
  if(event.key==='Escape'){event.preventDefault();setOpen(false);button.current?.focus();}
  else if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();items[Math.max(0,Math.min(items.length-1,at+(event.key==='ArrowDown'?1:-1)))]?.focus();}
  else if(event.key==='Home'||event.key==='End'){event.preventDefault();(event.key==='Home'?items[0]:items.at(-1))?.focus();}
 };
 return <div className="nm-game" ref={box} data-open={open||undefined}>
  <button type="button" ref={button} className="nm-game-button" aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(value=>!value)}
   onKeyDown={event=>{if(event.key==='ArrowDown'&&!open){event.preventDefault();setOpen(true);}}}>
   <span className="nm-label">Game</span><span className="nm-game-now">{chosen.key==='all'?'All games':`${chosen.away} @ ${chosen.home}`}</span><ChevronDown size={14} aria-hidden="true"/></button>
  {open&&<ul className="nm-game-menu" role="listbox" aria-label="Game" ref={list} onKeyDown={keys}>{options.map(option=>
   <li key={option.key} role="option" aria-selected={option.key===chosen.key} tabIndex={-1} onClick={()=>pick(option.key)}
    onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();pick(option.key);}}}>
    {option.key==='all'?<span className="nm-game-teams"><b>All games</b></span>
     :<span className="nm-game-teams"><Img src={option.awayLogo}/><b>{option.away}</b><i>@</i><Img src={option.homeLogo}/><b>{option.home}</b></span>}
    <span className="nm-game-when">{option.key==='all'?`${option.count} props`:`${when(option.startsAt)} · ${option.count}`}</span>
    {option.key===chosen.key&&<Check size={14} aria-hidden="true"/>}
   </li>)}</ul>}
 </div>;
}

export function MatchupList({config}){
 const {store,stats:STATS,score,Page,words}=config;
 const SHORT=useMemo(()=>Object.fromEntries(STATS),[STATS]);
 // The lines and league numbers live in props-data.js, loaded before the
 // tab opens and saved on the device: what's there shows at once and a
 // fresh board fills in behind it.
 const [data,setData]=useState(store.get);
 const [stat,setStat]=useState('all');
 const [game,setGame]=useState('all');
 const [query,setQuery]=useState('');
 const [sort,setSort]=useState('matchup');
 const [openId,setOpenId]=useState(null);
 const [page,setPage]=useState(null);
 const listScroll=useRef(0);
 useEffect(()=>{
  const stop=store.on(setData);
  store.warm();
  // League numbers the server wasn't ready with are asked for again.
  // Tonight's injury reports (the NBA) are asked for again every few minutes.
  const retry=setInterval(()=>{if(!store.get().league)store.refresh();store.freshenTonight?.();},45000);
  return()=>{stop();clearInterval(retry);};
 },[store]);
 const load=useCallback(()=>{store.refresh();},[store]);
 const rows=useMemo(()=>(data.rows||[]).filter(store.wanted),[data.rows,store]);
 // Tonight's injury reports (the NBA) ride with the league numbers into the score.
 const league=useMemo(()=>data.league&&data.tonight?{...data.league,tonight:data.tonight}:data.league,[data.league,data.tonight]);
 const progress=data.progress,at=data.at;
 // Something to show beats a spinner: the list stays up while a board loads.
 const status=data.rows==null||(!rows.length&&data.loading)?'loading':!rows.length&&data.error?'error':data.loading?'refreshing':'ready';
 const scores=useMemo(()=>league?score(rows,league):new Map(),[rows,league,score]);
 // What results have taught the model (learning.js): the Analyzer's correction, once loaded.
 const [learned,setLearned]=useState(0);
 useEffect(()=>{let live=true;Promise.resolve().then(()=>loadLearning()).then(()=>{if(live)setLearned(Date.now());}).catch(()=>{});return()=>{live=false;};},[]);
 const grades=useMemo(()=>propGrades(rows,league),[rows,league,learned]);
 // The NBA list reports what it shows for the track record (props-record.js).
 useEffect(()=>{
  if(config.key!=='nba'||!scores.size)return undefined;
  const wait=setTimeout(()=>reportProps(reportRows(rows,scores,grades)),4000);
  return()=>clearTimeout(wait);
 },[config.key,rows,scores,grades]);
 const games=useMemo(()=>{
  const seen=new Map();
  for(const row of rows){
   const key=gameOf(row),game=seen.get(key);
   if(!game)seen.set(key,{key,away:row.awayTeamAbbr||'?',home:row.homeTeamAbbr||'?',awayLogo:row.awayTeamLogo||null,homeLogo:row.homeTeamLogo||null,startsAt:row.startsAt,count:1});
   else{game.count+=1;if(String(row.startsAt)<String(game.startsAt))game.startsAt=row.startsAt;}
  }
  return [...seen.values()].sort((a,b)=>String(a.startsAt).localeCompare(String(b.startsAt)));
 },[rows]);
 // A picked game that has since left the board (it started) shows them all again.
 const picked=games.some(item=>item.key===game)?game:'all';
 const needle=query.trim().toLowerCase();
 const shown=useMemo(()=>rows
  .filter(row=>(stat==='all'||row.marketKey===stat)&&(picked==='all'||gameOf(row)===picked)&&(!needle||row.player.toLowerCase().includes(needle)))
  .map(row=>({row,read:scores.get(row.id)||null,hit:hitOf(row),prop:grades.get(row.id)||null,role:lineupRole(row,league)}))
  .sort((a,b)=>sort==='hit'?(b.hit?.rate??-1)-(a.hit?.rate??-1)||(b.read?.score??-1)-(a.read?.score??-1)
   :sort==='prop'?(b.prop?.rank??-1)-(a.prop?.rank??-1)||(b.prop?.edge??-1)-(a.prop?.edge??-1)
   :(b.read?.score??-1)-(a.read?.score??-1)||(b.hit?.rate??-1)-(a.hit?.rate??-1))
  // All stats: each player once, at his best line by the sort; a stat chip lists that stat's line.
  .filter((item,index,list)=>stat!=='all'||list.findIndex(other=>other.row.player===item.row.player&&other.row.teamAbbr===item.row.teamAbbr)===index),
  [rows,scores,grades,stat,picked,needle,sort,league]);
 const counts=useMemo(()=>rows.reduce((out,row)=>({...out,[row.marketKey]:(out[row.marketKey]||0)+1}),{}),[rows]);
 // A player's page: its own history entry, so the phone's back gesture
 // closes it the same as the page's back button.
 const openPage=useCallback(row=>{
  listScroll.current=window.scrollY;
  history.pushState({...history.state,nbaMatchup:row.id},'',location.href);
  setPage(row);window.scrollTo(0,0);
 },[]);
 const closePage=useCallback(()=>{if(history.state?.nbaMatchup)history.back();else setPage(null);},[]);
 useEffect(()=>{
  const onPop=()=>{if(!history.state?.nbaMatchup)setPage(null);};
  window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);
 },[]);
 useEffect(()=>{
  const root=document.getElementById('props-league-root');
  if(root)root.dataset.page=page?'player':'';
  if(!page)requestAnimationFrame(()=>window.scrollTo(0,listScroll.current));
  return()=>{if(root)root.dataset.page='';};
 },[page]);
 if(page)return <Page key={page.id} row={page} lines={rows.filter(item=>item.player===page.player&&item.teamAbbr===page.teamAbbr)} league={league} onBack={closePage}/>;

 return <section className="nba-matchups" data-league={config.key} aria-labelledby={`${config.key}-matchups-title`}>
  <header className="nm-head">
   <div><h2 id={`${config.key}-matchups-title`}>{words.title}</h2>
    <p>{words.blurb}</p></div>
   <button type="button" className="nm-refresh" onClick={load} disabled={status==='loading'||status==='refreshing'} aria-label="Refresh">
    <RefreshCw size={16} className={status==='refreshing'?'nm-spin':undefined}/></button>
  </header>

  <div className="nm-tools">
   <label className="nm-search"><Search size={16} aria-hidden="true"/>
    <input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find a player" enterKeyHint="search" aria-label="Find a player"/>
    {query&&<button type="button" onClick={()=>setQuery('')} aria-label="Clear search"><X size={14}/></button>}</label>
   <GamePicker games={games} value={picked} onChange={setGame}/>
   <div className="nm-sort" role="group" aria-label="Sort by">
    {SORTS.map(([key,text])=><button type="button" key={key} aria-pressed={sort===key} onClick={()=>setSort(key)}>{text}</button>)}
   </div>
  </div>
  <div className="nm-stats" role="group" aria-label="Stat">
   {STATS.filter(([key])=>key==='all'||counts[key]).map(([key,text])=><button type="button" key={key} aria-pressed={stat===key} onClick={()=>setStat(key)}>{text}</button>)}
  </div>

  {status==='loading'&&<div className="nm-empty"><RefreshCw size={18} className="nm-spin"/><b>{words.loading}</b>
   {progress?.total>0&&<span>Hit rates {progress.done} of {progress.total}</span>}</div>}
  {status==='error'&&<div className="nm-empty"><b>{words.failed}</b><button type="button" onClick={load}>Try again</button></div>}
  {(status==='ready'||status==='refreshing')&&!rows.length&&<div className="nm-empty"><b>{words.none}</b>
   <span>{words.noneText}</span></div>}
  {config.key==='nba'&&<TrackRecord/>}
  {(status==='ready'||status==='refreshing')&&rows.length>0&&!league&&<p className="nm-note">Matchup scores are still loading the league’s numbers. Hit rates are below.</p>}

  {shown.length>0&&<div className="nm-table">
   <div className="nm-thead"><span className="nm-th-player">Player</span><span className="nm-th-line">Line</span>
    {SORTS.map(([key])=><button type="button" key={key} className={`nm-th nm-th-${key}`} aria-pressed={sort===key} onClick={()=>setSort(key)}
     aria-label={`Sort by ${HEADS[key][0]}`}><span className="nm-long">{HEADS[key][0]}</span><span className="nm-short">{HEADS[key][1]}</span>{sort===key&&<ArrowDown size={13} aria-hidden="true"/>}</button>)}</div>
   <ul className="nm-list">{shown.map(({row,read,hit,prop,role})=><PropRow key={row.id} row={row} read={read} hit={hit} prop={prop} role={role} short={SHORT}
    open={openId===row.id} onToggle={()=>setOpenId(id=>id===row.id?null:row.id)} onOpen={openPage}/>)}</ul></div>}
  {(status==='ready'||status==='refreshing')&&rows.length>0&&!shown.length&&<div className="nm-empty"><b>Nothing matches</b>
   <span>Try another stat or game, or clear the search.</span></div>}

  {at>0&&rows.length>0&&<p className="nm-meta">{shown.length} {shown.length===1?'prop':'props'} · updated {new Date(at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</p>}
 </section>;
}
