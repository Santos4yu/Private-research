// The frame a Props tab matchup page sits in (NbaMatchupPage.jsx,
// NflMatchupPage.jsx): a full-width banner with who he is and his next game
// (a slim bar takes its place, pinned above the sections, once it scrolls
// away), the section tabs under it, and the sections themselves. Also his
// games against the line (Trend), the same chart on both pages.
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,LineChart,Minus,Plus} from 'lucide-react';
import {Card,Photo} from './sports/wnba/NbaScout';
import {finite,fmt,realGames} from './sports/wnba/wnba-research';

/** "Tonight, 7:30 PM" (or "Today, ..." for a day game), else "Sun 1:00 PM". */
export function when(iso,today='Tonight'){
 const time=Date.parse(iso||'');if(!Number.isFinite(time))return '';
 const date=new Date(time),now=new Date(),clock=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 return date.toDateString()===now.toDateString()?`${today}, ${clock}`:`${date.toLocaleDateString([],{weekday:'short'})} ${clock}`;
}

// His games against tonight's line, in any stat he has a line in.
export function Trend({row,lines,logs,chips}){
 const SHORT=useMemo(()=>Object.fromEntries(chips),[chips]);
 const offered=useMemo(()=>chips.filter(([key])=>lines.some(item=>item.marketKey===key)),[lines,chips]);
 const [stat,setStat]=useState(row.marketKey),[span,setSpan]=useState('l10');
 const tonight=lines.find(item=>item.marketKey===stat&&(item.modifier||'standard')==='standard')||lines.find(item=>item.marketKey===stat);
 const [line,setLine]=useState(tonight?.line??null);
 useEffect(()=>setLine(tonight?.line??null),[stat,tonight?.line]);
 const games=useMemo(()=>{
  const all=realGames(logs).filter(game=>finite(game.values?.[stat]));
  return span==='h2h'?all.filter(game=>game.opponent===row.opponent).slice(-10):all.slice(-Number(span.slice(1)));
 },[logs,stat,span,row.opponent]);
 const values=games.map(game=>game.values[stat]);
 const top=Math.max(1,...values,finite(line)?line:0);
 const over=finite(line)?values.filter(value=>value>line).length:null;
 const shown=offered.length?offered:chips.slice(0,4);
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
  {games.length?<div className="mp-bars" role="img" aria-label={`${SHORT[stat]}: ${values.join(', ')}`}>
   {/* Measured like the bars: over the chart's height less the room kept above them for the numbers. */}
   {finite(line)&&<i className="mp-bars-line" style={{bottom:`calc((100% - var(--mp-bars-room)) * ${Math.min(1,line/top)})`}}/>}
   {games.map((game,index)=>{const value=game.values[stat];return <span key={`${stat}-${span}-${game.gameId||index}`} style={{'--n':index}} data-tone={finite(line)?(value>line?'good':'poor'):undefined}>
    <b>{fmt(value,0)}</b><i style={{height:`${Math.max(3,value/top*100)}%`}}/><small>{game.opponent||''}</small></span>;})}
  </div>:<p className="mp-empty">{span==='h2h'?`He hasn't played ${row.opponent} in the games on record.`:'No games on record yet.'}</p>}
 </Card>;
}


// ------------------------------------------------------------ The frame
const hide=event=>{event.currentTarget.hidden=true;};
// "Shai Gilgeous-Alexander" -> ["Shai", "Gilgeous-Alexander"]: the banner sets the name on two lines.
const nameLines=name=>{const parts=String(name||'').trim().split(/\s+/);return parts.length>1?[parts[0],parts.slice(1).join(' ')]:[parts[0]||'',''];};

function Hero({row,team,opponent,home,facts,today,onBack,heroRef}){
 const [first,last]=nameLines(row.player),longest=Math.max(first.length,last.length);
 return <header ref={heroRef} className="mp-hero" data-long={longest>=14?'xl':longest>=10?'l':undefined}>
  {team?.logo&&<img className="mp-hero-mark" src={team.logo} alt="" onError={hide}/>}
  {row.headshot&&<img className="mp-hero-photo" src={row.headshot} alt="" onError={hide}/>}
  <button type="button" className="mp-back" onClick={onBack} aria-label="Back to matchups"><ArrowLeft size={20}/></button>
  <div className="mp-hero-text">
   <h1>{first}{last&&<><br/>{last}</>}</h1>
   <p>{facts.map((fact,index)=><React.Fragment key={fact}>{index>0&&<i aria-hidden="true"/>}{fact}</React.Fragment>)}</p>
   <div className="mp-next">{opponent?.logo&&<img src={opponent.logo} alt="" width="34" height="34" onError={hide}/>}
    <span><small>Next matchup</small><b>{home?'vs':'@'} {row.opponent}</b><em>{when(row.startsAt,today)}</em></span></div>
  </div>
 </header>;
}


/**
 * The page: `facts` under his name ("#5 · Timberwolves · Guard"), `tabs`
 * [[key, label]], the open one `tab` (onTab picks another), the sections
 * as children and anything drawn over the page (a sheet) as `after`.
 */
export function MatchupPageShell({row,team,opponent,home,facts,color,today,onBack,tabs,tab,onTab,jump,wide,children,after}){
 const [pinned,setPinned]=useState(null);
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
  <Hero row={row} team={team} opponent={opponent} home={home} facts={facts} today={today} onBack={onBack} heroRef={heroRef}/>
  <div className="mp-stick-slot" ref={slotRef}><div className="mp-stick" data-mini={pinned?true:undefined} style={pinned?{left:pinned.left,width:pinned.width}:undefined}>
   <div className="mp-mini" ref={miniRef} aria-hidden={!pinned}>
    <button type="button" className="mp-back" onClick={onBack} tabIndex={pinned?0:-1} aria-label="Back to matchups"><ArrowLeft size={18}/></button>
    <Photo src={row.headshot}/><b>{row.player}</b>
    <span className="mp-mini-game">{opponent?.logo&&<img src={opponent.logo} alt="" width="18" height="18" onError={hide}/>}{home?'vs':'@'} {row.opponent}<small>{when(row.startsAt,today)}</small></span>
   </div>
   <nav className="mp-tabs" role="tablist" aria-label="Sections" style={{'--mp-tab-count':tabs.length}}>{tabs.map(([key,label])=><button type="button" role="tab" key={key} aria-selected={tab===key} onClick={()=>pick(key)}>{label}</button>)}</nav>
  </div></div>
  <div className="mp-body">{children}</div>
  {after}
 </section>;
}
