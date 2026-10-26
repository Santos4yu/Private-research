import React,{useEffect,useId,useRef,useState} from 'react';
import {BadgeDollarSign,ChartColumn,Check,CloudSun,Gauge,History,House,Newspaper,Plus,RotateCcw,Shield,Target,TrendingUp,TriangleAlert,X} from 'lucide-react';
import {gradeProp} from './prop-analyze';
import {buildInsight} from './prop-insight';
import {createTour} from './analyze-tour';
import {useIsAdmin} from './admin-notice';
import {finderSlipProp} from './unified-finder-data';
import {pickBuilder} from './pick-builder-client';
import {lockScroll} from './scroll-lock';
import './analyze-prop.css';

// The Finder's Analyze, once its button is pressed (AnalyzeButton.jsx): the
// line on the chart graded both ways the way the Slip Analyzer grades a pick
// (prop-analyze.js), and written up (prop-insight.js). While it grades, a
// cursor (a finger on a phone) researches the page the way a person would
// (analyze-tour.js): the chart, the hit-rate windows, the matchup and its
// tabs, the game log, each dropping into the progress pill at the top. Then
// the result opens as a sheet from the bottom on a phone, a dialog on a
// computer.

const calm=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse=()=>typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const figure=value=>Number.isInteger(value)?String(value):value.toFixed(1);
const percent=value=>`${Math.round(value*100)}%`;
// The walk-through works between the progress pill (and room for the
// spotlight's tag) and the phone's dock.
const topEdge=card=>()=>(card.current?.getBoundingClientRect().bottom??60)+28;
const floorEdge=()=>{
 const dock=document.querySelector('.mobile-app-nav');
 const rect=dock?.getClientRects().length?dock.getBoundingClientRect():null;
 return rect&&rect.height&&rect.top<innerHeight?rect.top-6:innerHeight-14;
};

const ICONS={form:TrendingUp,projection:Gauge,defense:Shield,usage:Target,history:History,venue:House,news:Newspaper,weather:CloudSun,books:BadgeDollarSign,risk:TriangleAlert};
const STEPS=[['games','Reading the game log',ChartColumn],['matchup','Checking the matchup',Shield],['odds','Comparing the books',BadgeDollarSign],
 ['news','Injuries and news',Newspaper],['grade','Grading the pick',Gauge]];

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
  {insight.opportunity&&<section className="ap-card ap-rise" style={{'--i':3}}>
   <h3><span aria-hidden="true">🎯</span>The opportunity</h3>
   <p className="ap-opp-verdict" data-tone={insight.opportunity.verdict}>{insight.opportunity.title}</p>
   <p className="ap-write">{insight.opportunity.text}</p>
   {insight.opportunity.points.length>0&&<List items={insight.opportunity.points} tone="matchup"/>}
  </section>}
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

export default function AnalyzeLayer(props){
 // The line as it was when pressed: the Finder refreshes its rows every
 // few seconds, and that mustn't start the analysis over.
 const [{row,line,playerRows,origin}]=useState(()=>({row:props.row,line:props.line,playerRows:props.playerRows,origin:props.origin}));
 const {onClose}=props;
 const admin=useIsAdmin();
 const titleId=useId();
 const [attempt,setAttempt]=useState(0);
 const [phase,setPhase]=useState('scan');
 const [stage,setStage]=useState(0);
 const [result,setResult]=useState(null);
 const [closing,setClosing]=useState(false);
 const spot=useRef(null),tag=useRef(null),pointer=useRef(null),ripples=useRef(null),chips=useRef(null),card=useRef(null),closeButton=useRef(null);
 const tour=useRef(null);
 // The grading and the walk-through run together; the result opens when both are done.
 const flow=useRef({graded:null,toured:false,shown:false});
 const touch=useRef(coarse()).current;
 const finish=()=>{
  const state=flow.current;
  if(!state.graded||!state.toured||state.shown)return;
  state.shown=true;
  setStage(STEPS.length);
  setTimeout(()=>{setResult(state.graded);setPhase(state.graded.error?'error':'done');},calm()?0:420);
 };
 const close=useRef(()=>{});
 close.current=()=>{if(closing)return;tour.current?.stop();setClosing(true);setTimeout(onClose,calm()?0:260);};
 const skip=()=>{tour.current?.stop();flow.current.toured=true;setStage(STEPS.length-1);finish();};

 // The page stays put underneath (the walk-through scrolls it itself); Escape closes.
 useEffect(()=>{
  const unlock=lockScroll();
  const key=event=>{if(event.key==='Escape')close.current();};
  window.addEventListener('keydown',key);
  return()=>{unlock();window.removeEventListener('keydown',key);};
 },[]);

 useEffect(()=>{
  const job=new AbortController();
  flow.current={graded:null,toured:false,shown:false};
  setPhase('scan');setStage(0);setResult(null);
  let outcome=null;
  gradeProp(row,{line,playerRows,signal:job.signal})
   .then(({row:graded,over,under})=>{outcome={row:graded,insight:buildInsight(graded,over,under)};})
   .catch(error=>{if(!job.signal.aborted&&error?.name!=='AbortError')outcome={error};})
   .then(()=>{if(job.signal.aborted||!outcome)return;flow.current.graded=outcome;finish();});
  let stopTour=()=>{};
  if(calm()){
   // Reduced motion: no walk-through, the steps tick quickly.
   let index=0;
   const timer=setInterval(()=>{
    index+=1;setStage(Math.min(index,STEPS.length-1));
    if(index>=STEPS.length-1){clearInterval(timer);flow.current.toured=true;finish();}
   },110);
   stopTour=()=>clearInterval(timer);
  }else{
   const walk=createTour({spot:spot.current,tag:tag.current,pointer:pointer.current,ripples:ripples.current,chips:chips.current,card:()=>card.current,
    step:index=>setStage(index),top:topEdge(card),floor:floorEdge,touch,start:origin});
   tour.current=walk;
   walk.run().catch(()=>{}).then(()=>{if(job.signal.aborted)return;flow.current.toured=true;finish();});
   stopTour=()=>walk.stop();
  }
  return()=>{job.abort();stopTour();};
 },[attempt]);

 useEffect(()=>{if(phase!=='scan')closeButton.current?.focus({preventScroll:true});},[phase]);

 const sideWord=String(row.direction||'OVER').toUpperCase()==='UNDER'?'Less':'More';
 const insight=result?.insight;
 const graded=result?.row||row;
 const failed=phase==='error';
 const thin=phase==='done'&&!insight;
 const current=STEPS[Math.min(stage,STEPS.length-1)];
 const CurrentIcon=current[2];
 return <div className="ap-layer" data-phase={phase} data-closing={closing||undefined}>
  <div className="ap-dim" onClick={()=>close.current()} aria-hidden="true"/>
  {phase==='scan'&&!calm()&&<div className="ap-spot" ref={spot} aria-hidden="true"><span className="ap-spot-tag"><CurrentIcon size={13}/><span ref={tag}>The line</span></span></div>}
  <div className="ap-chips" ref={chips} aria-hidden="true"/>
  <div className="ap-ripples" ref={ripples} aria-hidden="true"/>
  {phase==='scan'&&!calm()&&<span className="ap-pointer" ref={pointer} data-touch={touch||undefined} aria-hidden="true">
   {touch?<i/>:<svg viewBox="0 0 26 32"><path d="M2 2 L2 25 L7.6 20 L11.4 29 L15.4 27.3 L11.6 18.6 L19 18.6 Z"/></svg>}</span>}
  {/* A slim pill at the top, out of the walk-through's way: what it's on now, and how far along. */}
  {phase==='scan'&&<div className="ap-progress" ref={card}>
   <span className="ap-spinner" aria-hidden="true"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16"/><path d="M20 4a16 16 0 0 1 16 16"/></svg>
    <CurrentIcon key={stage} size={14} strokeWidth={2.4}/></span>
   <span className="ap-progress-title" role="status" aria-live="polite"><b key={stage}>{current[1]}…</b><small><span className="ap-wide">Analyzing </span>{row.player} · {sideWord} {figure(Number(line))} {row.market}</small></span>
   <span className="ap-steps" role="img" aria-label={`Step ${Math.min(stage+1,STEPS.length)} of ${STEPS.length}`}>
    {STEPS.map(([key],index)=><i key={key} data-state={index<stage?'done':index===stage?'on':'wait'}/>)}</span>
   {!calm()&&<button type="button" className="ap-skip" onClick={skip}>Skip</button>}
   <span className="ap-progress-bar" aria-hidden="true"><i style={{transform:`scaleX(${Math.max(.05,Math.min(1,(stage+(stage<STEPS.length?.5:0))/STEPS.length))})`}}/></span>
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
