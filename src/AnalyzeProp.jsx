import React,{useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {BadgeDollarSign,ChartColumn,Check,CloudSun,Gauge,History,House,Newspaper,Plus,RotateCcw,ScanSearch,Shield,Target,TrendingUp,TriangleAlert,X} from 'lucide-react';
import {gradeProp} from './prop-analyze';
import {buildInsight} from './prop-insight';
import {useIsAdmin} from './admin-notice';
import {finderSlipProp} from './unified-finder-data';
import {pickBuilder} from './pick-builder-client';
import './analyze-prop.css';

// The Finder's Analyze, once its button is pressed (AnalyzeButton.jsx): the
// line on the chart graded both ways the way the Slip Analyzer grades a pick
// (prop-analyze.js), and written up (prop-insight.js). While it grades, a
// spotlight moves over the page's own sections -- the chart, the hit rates,
// the odds, the matchup cards -- and each one's name drops into the
// progress card; then the result opens as a sheet from the bottom on a
// phone, a dialog on a computer.

const calm=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const figure=value=>Number.isInteger(value)?String(value):value.toFixed(1);
const percent=value=>`${Math.round(value*100)}%`;
// Each step of the progress card shows for at least this long.
const STEP_MS=520;
// The spotlight's stay on each section.
const SPOT_MS=470;

const ICONS={form:TrendingUp,projection:Gauge,defense:Shield,usage:Target,history:History,venue:House,news:Newspaper,weather:CloudSun,books:BadgeDollarSign,risk:TriangleAlert};
const STEPS=[['games','Reading the game log',ChartColumn],['matchup','Checking the matchup',Shield],['odds','Comparing the books',BadgeDollarSign],
 ['news','News, role and weather',Newspaper],['grade','Grading the pick',Gauge]];

// The page's own sections, in reading order, that the scan passes over:
// the player card, the chart, the hit rates, the odds, then the matchup
// cards by their own titles. Only what's on the screen.
const SPOTS=[['.fpb-hero','The line'],['.gamelog-chart','Last games'],['.gamelog-summary','Hit rates'],['.fpb-odds','Odds']];
function pageSpots(floor=innerHeight){
 const out=[],seen=new Set();
 const add=(element,label)=>{
  if(!element||seen.has(element)||element.closest('.ap-layer'))return;
  const box=element.getBoundingClientRect();
  const top=Math.max(box.top,10),bottom=Math.min(box.bottom,innerHeight-10,floor-14);
  if(box.width<80||bottom-top<40)return;
  seen.add(element);
  out.push({label,box:{left:box.left,top,width:box.width,height:bottom-top}});
 };
 for(const [selector,label] of SPOTS)add(document.querySelector(selector),label);
 for(const card of document.querySelectorAll('.mlb-context-card')){
  const title=(card.querySelector('h2')?.textContent||'').split('·')[0].trim();
  add(card,title||'Matchup');
 }
 return out.slice(0,6);
}

function useCount(target,run,ms=900){
 const [value,setValue]=useState(0);
 useEffect(()=>{
  if(!run){setValue(0);return undefined;}
  if(calm()){setValue(target);return undefined;}
  let frame,start=null;
  const step=now=>{
   if(start==null)start=now;
   const p=Math.min(1,(now-start)/ms);
   setValue(target*(1-(1-p)**3));
   if(p<1)frame=requestAnimationFrame(step);
  };
  frame=requestAnimationFrame(step);
  return()=>cancelAnimationFrame(frame);
 },[target,run,ms]);
 return value;
}

function gameLabel(row){
 const teams=row.awayTeamAbbr&&row.homeTeamAbbr?`${row.awayTeamAbbr} @ ${row.homeTeamAbbr}`:row.teamAbbr&&row.opponent?`${row.teamAbbr} vs ${row.opponent}`:'';
 const date=new Date(row.startsAt||'');
 const when=Number.isNaN(date.getTime())?'':`${date.toLocaleDateString([],{weekday:'short'})} ${date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`;
 return [teams,when].filter(Boolean).join(' · ');
}

function Face({row}){
 const initials=String(row.player||'').split(' ').map(part=>part[0]).slice(0,2).join('');
 return <span className="ap-face"><span aria-hidden="true">{initials}</span>
  {row.headshot&&<img src={row.headshot} alt="" onError={event=>{event.currentTarget.hidden=true;}}/>}</span>;
}

function Ring({chance,tier,run}){
 const value=useCount(chance,run,1100);
 const r=46,c=2*Math.PI*r;
 return <span className="ap-ring" data-tier={tier}>
  <svg viewBox="0 0 112 112" aria-hidden="true"><circle cx="56" cy="56" r={r} className="ap-ring-track"/>
   <circle cx="56" cy="56" r={r} className="ap-ring-fill" strokeDasharray={c} strokeDashoffset={c*(1-value)}/></svg>
  <b>{Math.round(value*100)}<small>%</small></b><em>to hit</em>
 </span>;
}

function Meter({label,value,text,tone,run}){
 const shown=useCount(value,run,1000);
 return <div className="ap-meter" data-tone={tone}>
  <span className="ap-meter-top"><small>{label}</small><b>{text}</b></span>
  <span className="ap-meter-bar"><i style={{transform:`scaleX(${Math.max(0,Math.min(1,shown))})`}}/></span>
 </div>;
}

function List({items,tone}){
 return <ul className="ap-list" data-tone={tone}>{items.map(item=>{
  const Icon=ICONS[item.icon]||(tone==='risk'?TriangleAlert:TrendingUp);
  return <li key={item.text} data-tone={item.tone||undefined}><span className="ap-list-icon"><Icon size={15} aria-hidden="true"/></span><span>{item.text}</span></li>;
 })}</ul>;
}

function Sheet({row,insight,run,onClose,titleId}){
 const [added,setAdded]=useState(false);
 const {verdict,tier}=insight;
 const canAdd=verdict.play&&!row.relinedFrom;
 const add=()=>{pickBuilder.set(finderSlipProp(row),insight.side==='UNDER'?'Under':'Over');setAdded(true);};
 const reasons=insight.reasons.length?insight.reasons:[{icon:'form',text:'Not much stands out in its favor'}];
 const risks=insight.risks.length?insight.risks:[{icon:'risk',text:'Nothing big stands out against it'}];
 return <>
  <section className="ap-verdict ap-rise" style={{'--i':0}} data-tier={tier}>
   <Ring chance={insight.chance} tier={tier} run={run}/>
   <div className="ap-verdict-copy">
    <span className="ap-tier" data-tier={tier}>{insight.tierLabel}</span>
    <h2 id={titleId}><span className="ap-emoji" aria-hidden="true">{verdict.emoji}</span>{verdict.title}</h2>
    <p>{verdict.subtitle}</p>
    {insight.other&&<p className="ap-other">Other side: <b>{insight.other.sideWord}</b> · {insight.other.held?<>{percent(insight.other.chance)} · not every read agrees</>
     :<><span data-tier={insight.other.tier}>{insight.other.tierLabel}</span> · {percent(insight.other.chance)}</>}</p>}
   </div>
  </section>
  <section className="ap-meters ap-rise" style={{'--i':1}}>
   <Meter label="Chance to hit" value={insight.chance} text={percent(insight.chance)} tone={tier} run={run}/>
   {insight.matchup&&<Meter label="Matchup" value={insight.matchup.score/100} text={`${insight.matchup.score} · ${insight.matchup.label.replace(/ matchup$/,'')}`} tone={insight.matchup.tone} run={run}/>}
  </section>
  <section className="ap-card ap-rise" style={{'--i':2}}>
   <h3><span aria-hidden="true">📝</span>The breakdown</h3>
   <p className="ap-write">{insight.summary.join(' ')}</p>
  </section>
  <section className="ap-card ap-rise" style={{'--i':3}}>
   <h3><span aria-hidden="true">{verdict.play?'✅':'➕'}</span>{verdict.play?'Why it can hit':'What\'s going for it'}</h3>
   <List items={reasons} tone="good"/>
  </section>
  <section className="ap-card ap-rise" style={{'--i':4}}>
   <h3><span aria-hidden="true">⚠️</span>What could go wrong</h3>
   <List items={risks} tone="risk"/>
  </section>
  {insight.matchup?.facts.length>0&&<section className="ap-card ap-rise" style={{'--i':5}}>
   <h3><span aria-hidden="true">🆚</span>The matchup<span className="ap-score" data-tone={insight.matchup.tone}>{insight.matchup.label} · {insight.matchup.score}</span></h3>
   <List items={insight.matchup.facts} tone="matchup"/>
  </section>}
  {insight.numbers.length>0&&<section className="ap-card ap-rise" style={{'--i':6}}>
   <h3><span aria-hidden="true">📊</span>By the numbers</h3>
   <div className="ap-numbers">{insight.numbers.map(item=><span key={item.label} data-tone={finite(item.rate)?(item.rate>=0.6?'up':item.rate>=0.5?'mid':'down'):undefined}>
    <small>{item.label}</small><b>{item.value}</b>{finite(item.rate)&&item.label!=='Books'&&<em>{percent(item.rate)}</em>}</span>)}</div>
  </section>}
  <p className="ap-foot ap-rise" style={{'--i':7}}>Graded the way the Slip Analyzer grades a pick: hit rates, the matchup, the books and the news.</p>
  <div className="ap-actions ap-rise" style={{'--i':7}}>
   {canAdd&&<button type="button" className="ap-btn ap-btn-main" onClick={add} disabled={added}>{added?<Check size={16} aria-hidden="true"/>:<Plus size={16} aria-hidden="true"/>}{added?'Added to My Slip':'Add to My Slip'}</button>}
   <button type="button" className="ap-btn" onClick={onClose}>Done</button>
  </div>
 </>;
}

export default function AnalyzeLayer({row,line,playerRows,origin,onClose}){
 const admin=useIsAdmin();
 const titleId=useId();
 const [attempt,setAttempt]=useState(0);
 const [phase,setPhase]=useState('scan');
 const [at,setAt]=useState(0);
 const [result,setResult]=useState(null);
 const [closing,setClosing]=useState(false);
 const [scanned,setScanned]=useState(false);
 const spot=useRef(null),tag=useRef(null),chips=useRef(null),card=useRef(null),closeButton=useRef(null);
 const close=useRef(()=>{});
 close.current=()=>{if(closing)return;setClosing(true);setTimeout(onClose,calm()?0:260);};

 // The page stays put underneath; Escape closes.
 useEffect(()=>{
  const html=document.documentElement,body=document.body;
  const before=[html.style.overflow,body.style.overflow];
  html.style.overflow='hidden';body.style.overflow='hidden';
  const key=event=>{if(event.key==='Escape')close.current();};
  window.addEventListener('keydown',key);
  return()=>{html.style.overflow=before[0];body.style.overflow=before[1];window.removeEventListener('keydown',key);};
 },[]);

 // The grading, and the progress card's steps: each shows for a beat, and
 // never ahead of the grading itself.
 useEffect(()=>{
  const job=new AbortController();
  let shown=0,reached=0,done=false,outcome=null,timer=null;
  setPhase('scan');setAt(0);setResult(null);setScanned(false);
  const quick=calm();
  const index=key=>STEPS.findIndex(([name])=>name===key);
  const tick=()=>{
   if(shown<Math.min(reached,STEPS.length)){shown+=1;setAt(shown);}
   if(done&&shown>=STEPS.length){
    timer=setTimeout(()=>{setResult(outcome);setPhase(outcome?.error?'error':'done');},quick?0:280);
    return;
   }
   timer=setTimeout(tick,quick?90:STEP_MS);
  };
  gradeProp(row,{line,playerRows,signal:job.signal,step:key=>{reached=Math.max(reached,index(key));}})
   .then(({row:graded,over,under})=>{outcome={row:graded,insight:buildInsight(graded,over,under)};})
   .catch(error=>{if(job.signal.aborted||error?.name==='AbortError')return;outcome={error};})
   .finally(()=>{if(job.signal.aborted)return;reached=STEPS.length;done=true;});
  timer=setTimeout(tick,quick?60:STEP_MS);
  return()=>{job.abort();clearTimeout(timer);};
 },[row,line,playerRows,attempt]);

 // The scan: the spotlight starts on the button, moves over each section
 // on the screen, and drops its name into the progress card.
 useLayoutEffect(()=>{
  if(phase!=='scan'||calm())return undefined;
  const element=spot.current;
  if(!element)return undefined;
  const spots=pageSpots(card.current?.getBoundingClientRect().top??innerHeight);
  const timers=[];
  const later=(fn,ms)=>timers.push(setTimeout(fn,ms));
  const place=box=>Object.assign(element.style,{left:`${box.left-6}px`,top:`${box.top-6}px`,width:`${box.width+12}px`,height:`${box.height+12}px`});
  if(origin)place(origin);
  const fly=item=>{
   const host=chips.current,target=card.current?.getBoundingClientRect();
   if(!host||!target)return;
   const chip=document.createElement('span');
   chip.className='ap-chip';
   chip.textContent=item.label;
   host.append(chip);
   const from={x:item.box.left+item.box.width/2-chip.offsetWidth/2,y:item.box.top+Math.min(item.box.height/2,90)-chip.offsetHeight/2};
   const to={x:target.left+target.width/2-chip.offsetWidth/2,y:target.top+18};
   const flight=chip.animate([
    {transform:`translate(${from.x}px,${from.y}px) scale(.9)`,opacity:0},
    {transform:`translate(${from.x}px,${from.y-10}px) scale(1)`,opacity:1,offset:.18},
    {transform:`translate(${to.x}px,${to.y}px) scale(.72)`,opacity:.9,offset:.88},
    {transform:`translate(${to.x}px,${to.y+6}px) scale(.6)`,opacity:0}],{duration:760,easing:'cubic-bezier(.45,0,.2,1)',fill:'forwards'});
   flight.onfinish=()=>{chip.remove();card.current?.animate([{scale:'1'},{scale:'1.018'},{scale:'1'}],{duration:260,easing:'ease-out'});};
  };
  spots.forEach((item,index)=>{
   later(()=>{
    place(item.box);
    element.dataset.on='true';
    if(tag.current)tag.current.textContent=item.label;
    later(()=>fly(item),300);
   },140+index*SPOT_MS);
  });
  // The scan done: the spotlight lets go and the page dims evenly.
  later(()=>{element.dataset.on='false';setScanned(true);},140+spots.length*SPOT_MS+120);
  return()=>timers.forEach(clearTimeout);
 },[phase,origin,attempt]);

 useEffect(()=>{if(phase!=='scan')closeButton.current?.focus({preventScroll:true});},[phase]);

 const sideWord=String(row.direction||'OVER').toUpperCase()==='UNDER'?'Less':'More';
 const insight=result?.insight;
 const graded=result?.row||row;
 const failed=phase==='error';
 const thin=phase==='done'&&!insight;
 return <div className="ap-layer" data-phase={phase} data-closing={closing||undefined} data-scanned={scanned||calm()||undefined}>
  <div className="ap-dim" onClick={()=>close.current()} aria-hidden="true"/>
  {phase==='scan'&&!calm()&&<div className="ap-spot" ref={spot} aria-hidden="true"><span className="ap-spot-tag"><ScanSearch size={13}/><span ref={tag}>The line</span></span></div>}
  <div className="ap-chips" ref={chips} aria-hidden="true"/>
  {phase==='scan'&&<div className="ap-progress" ref={card} role="status" aria-live="polite">
   <div className="ap-progress-head">
    <span className="ap-spinner" aria-hidden="true"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16"/><path d="M20 4a16 16 0 0 1 16 16"/></svg></span>
    <span><b>Analyzing {row.player}</b><small>{sideWord} {figure(Number(line))} {row.market}</small></span>
   </div>
   <ol>{STEPS.map(([key,label,Icon],index)=><li key={key} data-state={index<at?'done':index===at?'on':'wait'}>
    <span className="ap-step-icon">{index<at?<Check size={14} strokeWidth={3} aria-hidden="true"/>:<Icon size={14} aria-hidden="true"/>}</span>{label}</li>)}</ol>
   <span className="ap-progress-bar" aria-hidden="true"><i style={{transform:`scaleX(${Math.max(.04,at/STEPS.length)})`}}/></span>
  </div>}
  {phase!=='scan'&&<div className="ap-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} data-tier={insight?.tier||'none'}>
   <span className="ap-grip" aria-hidden="true"/>
   <header className="ap-head">
    <Face row={graded}/>
    <span className="ap-who"><b>{graded.player}</b><small>{sideWord} {figure(Number(line))} {graded.market}{gameLabel(graded)?` · ${gameLabel(graded)}`:''}</small></span>
    <button type="button" className="ap-close" ref={closeButton} onClick={()=>close.current()} aria-label="Close"><X size={18} aria-hidden="true"/></button>
   </header>
   <div className="ap-body">
    {insight&&<Sheet row={graded} insight={insight} run={phase==='done'} onClose={()=>close.current()} titleId={titleId}/>}
    {(failed||thin)&&<div className="ap-empty ap-rise" style={{'--i':0}}>
     <span className="ap-empty-icon" aria-hidden="true">{failed?'🔌':'📉'}</span>
     <h2 id={titleId}>{failed?'Couldn\'t analyze this line right now':'Not enough games to grade this line yet'}</h2>
     <p>{failed?'Try again in a moment.':'Analyze needs at least five recent games at this line, or a season of them.'}</p>
     {failed&&admin&&<p className="ap-admin">{String(result?.error?.message||result?.error||'Unknown error')}</p>}
     <div className="ap-actions">{failed&&<button type="button" className="ap-btn ap-btn-main" onClick={()=>setAttempt(value=>value+1)}><RotateCcw size={16} aria-hidden="true"/>Try again</button>}
      <button type="button" className="ap-btn" onClick={()=>close.current()}>Close</button></div>
    </div>}
   </div>
  </div>}
 </div>;
}
