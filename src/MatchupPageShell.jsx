// The frame a Props tab matchup page sits in (NbaMatchupPage.jsx,
// NflMatchupPage.jsx): a full-width banner with who he is and his next game
// (a slim bar takes its place, pinned above the sections, once it scrolls
// away), the section tabs under it, and the sections themselves. Also his
// games against the line (Trend), the same chart on both pages.
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,LineChart,Minus,Plus} from 'lucide-react';
import {Card,Photo} from './sports/wnba/NbaScout';
import {finite,fmt,realGames} from './sports/wnba/wnba-research';
import {tierOf} from './props-lines';
import {SlipToggle,useSlipIds} from './SlipToggle';

/** "Tonight, 7:30 PM" (or "Today, ..." for a day game), else "Sun 1:00 PM". */
export function when(iso,today='Tonight'){
 const time=Date.parse(iso||'');if(!Number.isFinite(time))return '';
 const date=new Date(time),now=new Date(),clock=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 return date.toDateString()===now.toDateString()?`${today}, ${clock}`:`${date.toLocaleDateString([],{weekday:'short'})} ${clock}`;
}

// His games against tonight's line, in any stat he has a line in. A tap on
// a bar (Oct 27, the owner: "show the info like the Finder ... minutes ...
// the starters who were out and did he start or not ... I need to know if
// it matches tonight's matchup") shows that game under the chart: result,
// started or bench, minutes, usage, his box line, who sat on each side
// (game-notes) and who of them is out tonight too. `notes` (game id ->
// {usage, started, out, oppOut}) and `tonight` ({role, report, team,
// opponent}) come from the NBA page; without them a bar just shows its box.
const FOCUS={player_points:['pts'],player_rebounds:['reb'],player_assists:['ast'],player_threes:['tpm'],player_steals:['stl'],player_blocks:['blk'],
 player_turnovers:['to'],player_blocks_steals:['blk','stl'],player_points_rebounds:['pts','reb'],player_points_assists:['pts','ast'],
 player_rebounds_assists:['reb','ast'],player_points_rebounds_assists:['pts','reb','ast']};
const TILES=[['min','MIN'],['pts','PTS'],['reb','REB'],['ast','AST'],['tpm','3PM'],['stl','STL'],['blk','BLK'],['to','TO']];
// A game without its box line still has the stats its lines read.
const VALUE_OF={pts:'player_points',reb:'player_rebounds',ast:'player_assists',tpm:'player_threes',stl:'player_steals',blk:'player_blocks',to:'player_turnovers'};
const nameKey=name=>String(name||'').toLowerCase().replace(/[.'’]/g,'').replace(/\s+(jr|sr|ii|iii|iv)$/,'').trim();
// Tonight's report: Out, Doubtful or GTD (questionable / day-to-day).
function reportStatus(item){
 const text=` ${String(item?.code||'')} ${String(item?.status||'')} `.toLowerCase();
 if(/\bout\b| o |susp/.test(text))return 'Out';
 if(/doubt| d /.test(text))return 'Doubtful';
 if(/gtd|question|day-to-day| q | dtd /.test(text))return 'GTD';
 return null;
}
function onReport(person,items){
 const found=(items||[]).find(item=>(item.id&&String(item.id)===String(person.id))||nameKey(item.name)===nameKey(person.name));
 return found?reportStatus(found):null;
}
const shortName=name=>{const parts=String(name||'').split(/\s+/).filter(Boolean);return parts.length>1?`${parts[0][0]}. ${parts.slice(1).join(' ')}`:parts[0]||'';};
const pct=(made,tried)=>finite(made)&&finite(tried)&&tried>0?`${Math.round(made/tried*100)}%`:'';

function SatOut({title,people,report}){
 if(!people?.length)return null;
 return <div className="mp-gp-out"><h4>{title}</h4><ul>{people.map(person=>{const tonight=onReport(person,report);
  return <li key={person.id||person.name}><b>{shortName(person.name)}</b><small>{fmt(person.ppg,1)} pts{person.starter?' · starter':''}</small>
   {tonight&&<em data-status={tonight}>{tonight==='Out'?'Out tonight too':`${tonight} tonight`}</em>}</li>;})}</ul></div>;
}

function GamePanel({game,stat,line,note,tonight,current}){
 const box=game.box||{},focus=new Set(FOCUS[stat]||[]),value=game.values?.[stat];
 const day=(()=>{const date=new Date(game.date);return Number.isNaN(date.getTime())?'':date.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'});})();
 const started=typeof note?.started==='boolean'?note.started:null;
 const result=String(game.result||'').toUpperCase().slice(0,1);
 const minutes=finite(game.minutes)?game.minutes:box.min;
 const mine=tonight?.report?.[tonight.team],theirs=tonight?.report?.[tonight.opponent];
 // His team's players out tonight who weren't among those who sat this
 // game (this season's games only: last season's rosters were different).
 const satNow=current&&note?(mine||[]).filter(item=>reportStatus(item)==='Out'&&!(note.out||[]).some(person=>onReport(person,[item]))):[];
 const sameRole=started!=null&&tonight?.role?(tonight.role.starter===started):null;
 return <div className="mp-gp" key={game.gameId||game.date}>
  <header className="mp-gp-head">
   {game.opponentLogo&&<img src={game.opponentLogo} alt="" width="26" height="26" onError={event=>{event.currentTarget.hidden=true;}}/>}
   <span><b>{game.isHome===false?'@':'vs'} {game.opponent}</b><small>{day}</small></span>
   {finite(value)&&<em className="mp-gp-value" data-tone={finite(line)?(value>line?'good':'poor'):undefined}>{fmt(value,0)}{finite(line)&&<small>{value>line?'over':'under'} {fmt(line,1)}</small>}</em>}
   {result&&<span className="mp-gp-result" data-result={result}>{result} {String(game.score||'').replace('-','–')}</span>}
  </header>
  <div className="mp-gp-role">
   {started!=null&&<span data-on>{started?'Started':'Bench'}{sameRole!=null&&<i>{sameRole?' · same as tonight':` · tonight ${tonight.role.label.toLowerCase()}`}</i>}</span>}
   {finite(note?.usage)&&<span>{fmt(note.usage,1)}% usage</span>}
  </div>
  <div className="mp-gp-box">{TILES.map(([key,label])=>{const shown=key==='min'?minutes:finite(box[key])?box[key]:game.values?.[VALUE_OF[key]];
   return <span key={key} data-focus={focus.has(key)||undefined}><small>{label}</small><b>{finite(shown)?fmt(shown,0):'–'}</b></span>;})}</div>
  {(finite(box.fga)||finite(box.tpa)||finite(box.fta))&&<p className="mp-gp-shoot">
   {[['FG',box.fgm,box.fga],['3PT',box.tpm,box.tpa],['FT',box.ftm,box.fta]].filter(([,,tried])=>finite(tried)).map(([label,made,tried])=>
    <span key={label}><small>{label}</small>{fmt(made,0)}/{fmt(tried,0)}<i>{pct(made,tried)}</i></span>)}</p>}
  {note&&<>
   <SatOut title={`${tonight?.team||'His team'} without`} people={note.out} report={mine}/>
   <SatOut title={`${game.opponent} without`} people={note.oppOut} report={theirs}/>
   {!note.out?.length&&!note.oppOut?.length&&<p className="mp-gp-none">Nobody who matters sat this one.</p>}
   {satNow.length>0&&<p className="mp-gp-diff">Out tonight, not out this game: {satNow.map(item=>shortName(item.name)).join(', ')}</p>}
  </>}
 </div>;
}

export function Trend({row,lines,logs,chips,notes,tonight}){
 const SHORT=useMemo(()=>Object.fromEntries(chips),[chips]);
 const offered=useMemo(()=>chips.filter(([key])=>lines.some(item=>item.marketKey===key)),[lines,chips]);
 const [stat,setStat]=useState(row.marketKey),[span,setSpan]=useState('l10'),[picked,setPicked]=useState(null);
 const tonightLine=lines.find(item=>item.marketKey===stat&&(item.modifier||'standard')==='standard')||lines.find(item=>item.marketKey===stat);
 const [line,setLine]=useState(tonightLine?.line??null);
 useEffect(()=>setLine(tonightLine?.line??null),[stat,tonightLine?.line]);
 const games=useMemo(()=>{
  const all=realGames(logs).filter(game=>finite(game.values?.[stat]));
  return span==='h2h'?all.filter(game=>game.opponent===row.opponent).slice(-10):all.slice(-Number(span.slice(1)));
 },[logs,stat,span,row.opponent]);
 const latest=useMemo(()=>Math.max(...realGames(logs).map(game=>Number(game.season)).filter(finite)),[logs]);
 const values=games.map(game=>game.values[stat]);
 const top=Math.max(1,...values,finite(line)?line:0);
 const over=finite(line)?values.filter(value=>value>line).length:null;
 const shown=offered.length?offered:chips.slice(0,4);
 // The game shown under the chart: the one tapped, else the latest.
 const keyOf=game=>String(game.gameId||game.date);
 const chosen=games.find(game=>keyOf(game)===picked)||games[games.length-1]||null;
 const detailed=Boolean(notes||tonight);
 return <Card title="His games" note={SHORT[stat]||row.market} icon={LineChart} className="mp-trend">
  <div className="mp-chips" role="group" aria-label="Stat">{shown.map(([key,label])=><button type="button" key={key} aria-pressed={stat===key} onClick={()=>setStat(key)}>{label}</button>)}</div>
  <div className="mp-trend-head">
   <div><small>{SHORT[stat]} · {span==='h2h'?`vs ${row.opponent}`:`last ${span.slice(1)}`} · {games.length} {games.length===1?'game':'games'}</small>
    <b key={`${stat}-${span}-${line}`} data-tone={finite(over)&&games.length?(over*2>=games.length?'good':'poor'):undefined}>{finite(over)&&games.length?`${over}/${games.length}`:'—'}</b>
    {finite(line)&&<span>over {fmt(line,1)}</span>}</div>
   {finite(line)&&<div className="mp-stepper" aria-label="Line"><button type="button" aria-label="Lower the line" onClick={()=>setLine(value=>Math.max(0,value-0.5))}><Minus size={16}/></button>
    <span><small>Line</small><b>{fmt(line,1)}</b></span><button type="button" aria-label="Raise the line" onClick={()=>setLine(value=>value+0.5)}><Plus size={16}/></button></div>}
  </div>
  <div className="mp-seg" role="group" aria-label="Games">{[['l5','L5'],['l10','L10'],['l20','L20'],['h2h','H2H']].map(([key,label])=>
   <button type="button" key={key} aria-pressed={span===key} onClick={()=>setSpan(key)}>{label}</button>)}</div>
  {games.length?<div className="mp-bars" data-count={games.length} data-picking={detailed||undefined}>
   {/* Measured like the bars: over the chart's height less the room kept above them for the numbers. */}
   {finite(line)&&<i className="mp-bars-line" style={{bottom:`calc((100% - var(--mp-bars-room)) * ${Math.max(0,Math.min(1,line/top))})`}}/>}
   {games.map((game,index)=>{const value=game.values[stat],key=keyOf(game),on=detailed&&chosen&&keyOf(chosen)===key;
    const date=new Date(game.date),label=Number.isNaN(date.getTime())?'':date.toLocaleDateString([],{month:'numeric',day:'numeric'});
    const inner=<><b>{fmt(value,0)}</b><i style={{height:`${Math.max(3,value/top*100)}%`}}/><small>{game.isHome===false?'@':''}{game.opponent||''}<em>{label}</em></small></>;
    const tone=finite(line)?(value>line?'good':'poor'):undefined;
    return detailed?<button type="button" key={`${stat}-${span}-${key}`} style={{'--n':index}} data-tone={tone} aria-pressed={Boolean(on)} onClick={()=>setPicked(key)}
      aria-label={`${label} ${game.isHome===false?'at':'vs'} ${game.opponent}: ${fmt(value,0)} ${SHORT[stat]||''}. Show this game`}>{inner}</button>
     :<span key={`${stat}-${span}-${key}`} style={{'--n':index}} data-tone={tone}>{inner}</span>;})}
  </div>:<p className="mp-empty">{span==='h2h'?`He hasn't played ${row.opponent} in the games on record.`:'No games on record yet.'}</p>}
  {detailed&&chosen&&<GamePanel game={chosen} stat={stat} line={line} note={notes?.[String(chosen.gameId)]} tonight={tonight} current={Number(chosen.season)===latest}/>}
 </Card>;
}


// ------------------------------------------------------------ The frame
const hide=event=>{event.currentTarget.hidden=true;};
const figure=value=>Number.isInteger(Number(value))?String(Number(value)):Number(value).toFixed(1);
const PICS={demon:['/prizepicks/demon-64.png','Demon'],goblin:['/prizepicks/goblin.png','Goblin']};
// His lines on the board of this one's kind, one per stat, this one first.
function heroLines(row,lines){
 const kind=tierOf(row),seen=new Set();
 return [row,...(lines||[]).filter(line=>line.id!==row.id&&tierOf(line)===kind)].filter(line=>!seen.has(line.marketKey)&&seen.add(line.marketKey));
}

// Oct 28, the owner: "nothing should look alike". The banner is a player
// card now: his photo on a tile of his team's color, his name and facts,
// tonight's game, and his lines tonight, each with its + for the slip.
function Hero({row,team,opponent,home,facts,today,onBack,heroRef,action,lines,stats,saved}){
 const shown=heroLines(row,lines);
 const label=line=>stats?.find(([key])=>key===line.marketKey)?.[1]||line.market;
 return <header ref={heroRef} className="mp-hero">
  <div className="mp-hero-top">
   <button type="button" className="mp-back" onClick={onBack} aria-label="Back to matchups"><ArrowLeft size={18}/><span>All props</span></button>
   {action}
  </div>
  <div className="mp-hero-card" aria-hidden="true">
   {team?.logo&&<img className="mp-hero-mark" src={team.logo} alt="" onError={hide}/>}
   {row.headshot&&<img className="mp-hero-photo" src={row.headshot} alt="" onError={hide}/>}
  </div>
  <div className="mp-hero-text">
   <h1>{row.player}</h1>
   <p>{facts.map((fact,index)=><React.Fragment key={fact}>{index>0&&<i aria-hidden="true"/>}{fact}</React.Fragment>)}</p>
   <div className="mp-next">{opponent?.logo&&<img src={opponent.logo} alt="" width="30" height="30" onError={hide}/>}
    <span><small>Next matchup</small><b>{home?'vs':'@'} {row.opponent}</b><em>{when(row.startsAt,today)}</em></span></div>
  </div>
  {shown.length>0&&<section className="mp-hero-lines" aria-label="His lines">
   <h2>His lines {today==='Today'?'today':'tonight'}</h2>
   <ul>{shown.map(line=>{const pic=PICS[tierOf(line)];return <li key={line.id} data-page={line.id===row.id||undefined}>
    <small>{label(line)}</small><span><em>More</em><b>{figure(line.line)}</b>{pic&&<img src={pic[0]} alt={pic[1]} width="15" height="15"/>}</span>
    <SlipToggle row={line} saved={saved} stat={label(line)}/></li>;})}</ul>
  </section>}
 </header>;
}


/**
 * The page: `facts` under his name ("#5 · Timberwolves · Guard"), `tabs`
 * [[key, label]], the open one `tab` (onTab picks another), the sections
 * as children and anything drawn over the page (a sheet) as `after`.
 */
export function MatchupPageShell({row,team,opponent,home,facts,color,today,onBack,tabs,tab,onTab,jump,wide,action,children,after,lines,stats}){
 const [pinned,setPinned]=useState(null);
 // What's on the slip: the banner's lines and the pinned bar show it.
 const saved=useSlipIds();
 const heroRef=useRef(null),slotRef=useRef(null),miniRef=useRef(null);
 // Once the banner scrolls up under where the slim bar goes, the bar and
 // the section tabs pin to the top of the screen (fixed: the page's body
 // doesn't let sticky elements stick), their slot keeping its height.
 useEffect(()=>{
  const hero=heroRef.current,slot=slotRef.current,bar=miniRef.current;
  if(!hero||!slot||!bar||typeof IntersectionObserver==='undefined')return undefined;
  slot.style.minHeight=`${slot.offsetHeight}px`;
  let out=false;
  const place=()=>{const box=slot.getBoundingClientRect();setPinned(out?{left:box.left,width:box.width}:null);};
  const watch=new IntersectionObserver(([entry])=>{out=!entry.isIntersecting&&entry.boundingClientRect.top<0;place();},{rootMargin:`-${bar.offsetHeight}px 0px 0px 0px`});
  watch.observe(hero);addEventListener('resize',place);
  return()=>{watch.disconnect();removeEventListener('resize',place);};
 },[]);
 // The page's background takes his team's color (nba-matchups.css, Background).
 useEffect(()=>{
  const shell=document.getElementById('app-shell');
  if(!shell||!color)return undefined;
  shell.style.setProperty('--props-team',color);
  return()=>shell.style.removeProperty('--props-team');
 },[color]);
 // A new section starts at its top, under the pinned bar.
 const pick=key=>{if(jump){jump(key);return;}onTab(key);const slot=slotRef.current,bar=miniRef.current;
  if(pinned&&slot&&bar)window.scrollTo(0,window.scrollY+slot.getBoundingClientRect().top-bar.offsetHeight+1);};
 return <section className="nba-mp" data-wide={wide||undefined} aria-label={`${row.player} matchup`} style={color?{'--team':color}:undefined}>
  <Hero row={row} team={team} opponent={opponent} home={home} facts={facts} today={today} onBack={onBack} heroRef={heroRef} action={action} lines={lines} stats={stats} saved={saved}/>
  <div className="mp-stick-slot" ref={slotRef}><div className="mp-stick" data-mini={pinned?true:undefined} style={pinned?{left:pinned.left,width:pinned.width}:undefined}>
   <div className="mp-mini" ref={miniRef} aria-hidden={!pinned}>
    <button type="button" className="mp-back" onClick={onBack} tabIndex={pinned?0:-1} aria-label="Back to matchups"><ArrowLeft size={18}/></button>
    <Photo src={row.headshot}/><b>{row.player}</b>
    <span className="mp-mini-game">{opponent?.logo&&<img src={opponent.logo} alt="" width="18" height="18" onError={hide}/>}{home?'vs':'@'} {row.opponent}<small>{when(row.startsAt,today)}</small></span>
    <span className="mp-mini-line"><em>More</em><b>{figure(row.line)}</b><small>{stats?.find(([key])=>key===row.marketKey)?.[1]||row.market}</small></span>
    {pinned&&<SlipToggle row={row} saved={saved} stat={stats?.find(([key])=>key===row.marketKey)?.[1]||row.market}/>}
   </div>
   <nav className="mp-tabs" role="tablist" aria-label="Sections" data-count={tabs.length} style={{'--mp-tab-count':tabs.length}}>{tabs.map(([key,label])=><button type="button" role="tab" key={key} aria-selected={tab===key} onClick={()=>pick(key)}>{label}</button>)}</nav>
  </div></div>
  <div className="mp-body">{children}</div>
  {after}
 </section>;
}
