import React,{useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import {accountSynced} from './account-sync';
import {STEPS,placement,readTour,saveTour,shouldStart,spotlight} from './welcome-tour-core';
import './welcome-tour.css';

// A first look around for new members: the Finder, a player page and the
// Slip Analyzer, one spotlight at a time. It opens by itself once, after
// sign-in, for someone who joined in the last two weeks
// (welcome-tour-core.js); "Take the tour" in Settings replays it.
const storage=()=>{try{return window.localStorage;}catch{return null;}};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function visible(el){
 if(!el)return false;
 const rect=el.getBoundingClientRect();
 return rect.width>0&&rect.height>0&&getComputedStyle(el).visibility!=='hidden';
}
function find(selectors=[]){
 for(const selector of selectors)for(const el of document.querySelectorAll(selector))if(visible(el))return el;
 return null;
}
async function waitFor(selectors,ms=6000){
 for(const end=Date.now()+ms;Date.now()<end;await sleep(120)){const el=find(selectors);if(el)return el;}
 return null;
}
const shown=id=>{const panel=document.getElementById(id);return Boolean(panel&&!panel.hidden);};
const switchTab=tab=>window.dispatchEvent(new CustomEvent('vortex:switch-tab',{detail:{tab}}));
const view=()=>({width:window.innerWidth,height:window.innerHeight});

// Brings up the page a step points at: the Finder board, a player page
// (the first card's) or the Slip Analyzer. False when it can't be had.
async function pageFor(step){
 if(step.page==='slip'){
  if(!shown('panel-slip'))switchTab('slip');
  return Boolean(await waitFor(['#panel-slip:not([hidden]) .sa-stage'],5000));
 }
 if(!shown('panel-finder')){switchTab('finder');await sleep(250);}
 if(step.page==='player'){
  if(find(['.fpb-hero']))return true;
  const open=find(['.finder-table tbody tr .finder-open','.fk-list .fk-card .finder-open']);
  if(!open)return false;
  open.click();
  return Boolean(await waitFor(['.fpb-hero'],8000));
 }
 const back=find(['.fpb-back']);
 if(back&&(step.target||step.key==='done')){back.click();await sleep(200);}
 return true;
}

export function WelcomeTour(){
 const [index,setIndex]=useState(-1);
 const [busy,setBusy]=useState(false);
 const [rect,setRect]=useState(null);
 const [spot,setSpot]=useState(null);
 const [card,setCard]=useState(null);
 const target=useRef(null),cardRef=useRef(null),nextRef=useRef(null),moved=useRef(false),openRef=useRef(false);
 const step=STEPS[index];

 const show=useCallback(async(at,direction=1)=>{
  setBusy(true);
  for(let i=at;i>=0&&i<STEPS.length;i+=direction){
   const next=STEPS[i];
   if(next.page)moved.current=true;
   const ready=await pageFor(next);
   const el=ready&&next.target?await waitFor(next.target,next.page?4000:2500):null;
   if(next.target&&!el)continue; // nothing to point at (an empty board, a switched-off page): the next step
   target.current=el;
   el?.scrollIntoView?.({block:'center',inline:'nearest'});
   setIndex(i);setBusy(false);
   return;
  }
  setBusy(false);
 },[]);

 const start=useCallback(()=>{
  if(openRef.current)return;
  openRef.current=true;moved.current=false;target.current=null;
  setIndex(0);setRect(null);
 },[]);

 const finish=useCallback(how=>{
  saveTour(storage(),how);
  openRef.current=false;setIndex(-1);target.current=null;
  if(moved.current){
   // Back where the member started: the Finder's board.
   if(!shown('panel-finder'))switchTab('finder');
   setTimeout(()=>find(['.fpb-back'])?.click(),250);
  }
 },[]);

 // Opens by itself once the account's settings are on this device (so a
 // tour finished elsewhere counts) and the Finder's board has loaded.
 useEffect(()=>{
  let gone=false;
  const consider=async info=>{
   if(gone||openRef.current||!info?.uid||!shouldStart(readTour(storage()),info.memberSince))return;
   for(const end=Date.now()+15000;!gone&&Date.now()<end;await sleep(300)){
    if(shown('panel-finder')&&find(['.finder-table tbody tr']))break;
   }
   if(gone||!shown('panel-finder')||document.querySelector('.install-guide,#settings-panel:not([hidden])'))return;
   if(shouldStart(readTour(storage()),info.memberSince))start();
  };
  const synced=event=>consider(event.detail);
  const asked=()=>{
   const panel=document.getElementById('settings-panel');
   if(panel&&!panel.hidden)document.getElementById('settings-btn')?.click();
   start();
  };
  const row=document.getElementById('tour-row');
  window.addEventListener('vortex:account-synced',synced);
  window.addEventListener('aceprops:start-tour',asked);
  row?.addEventListener('click',asked);
  consider(accountSynced());
  return()=>{gone=true;window.removeEventListener('vortex:account-synced',synced);window.removeEventListener('aceprops:start-tour',asked);row?.removeEventListener('click',asked);};
 },[start]);

 // Follow what the step points at as the page scrolls, loads and resizes.
 useEffect(()=>{
  if(index<0)return undefined;
  let frame=0,last='';
  const track=()=>{
   // A page that re-renders swaps the element out: find it again.
   if(step?.target&&!target.current?.isConnected)target.current=find(step.target);
   const el=target.current;
   const box=el&&visible(el)?el.getBoundingClientRect():null;
   const key=box?`${Math.round(box.top)},${Math.round(box.left)},${Math.round(box.width)},${Math.round(box.height)}`:'none';
   if(key!==last){last=key;setRect(box?{top:box.top,left:box.left,right:box.right,bottom:box.bottom,width:box.width,height:box.height}:null);}
   frame=requestAnimationFrame(track);
  };
  track();
  return()=>cancelAnimationFrame(frame);
 },[index,step]);

 useLayoutEffect(()=>{
  if(index<0||!cardRef.current)return;
  const size={width:cardRef.current.offsetWidth,height:cardRef.current.offsetHeight};
  const screen=view();
  setSpot(spotlight(rect,screen));
  setCard(placement(spotlight(rect,screen),size,screen));
 },[rect,index,busy]);

 useEffect(()=>{if(index>=0&&!busy)nextRef.current?.focus({preventScroll:true});},[index,busy]);

 const next=()=>{if(busy)return;if(index>=STEPS.length-1)return finish('finished');show(index+1,1);};
 const back=()=>{if(busy||index<=0)return;show(index-1,-1);};
 useEffect(()=>{
  if(index<0)return undefined;
  const keys=event=>{
   if(event.key==='Escape'){event.preventDefault();finish('skipped');}
   else if(event.key==='ArrowRight'){event.preventDefault();next();}
   else if(event.key==='ArrowLeft'){event.preventDefault();back();}
  };
  document.addEventListener('keydown',keys);
  return()=>document.removeEventListener('keydown',keys);
 });

 if(index<0||!step)return null;
 const middle=STEPS.length-2,number=index>0&&index<=middle?index:null;
 const last=index===STEPS.length-1;
 return createPortal(<div className="wt" data-busy={busy||undefined}>
  <div className="wt-block" aria-hidden="true"/>
  {spot?<div className="wt-spot" aria-hidden="true" style={{top:spot.top,left:spot.left,width:spot.width,height:spot.height}}/>:<div className="wt-dim" aria-hidden="true"/>}
  <section ref={cardRef} className="wt-card" role="dialog" aria-modal="true" aria-labelledby="wt-title" aria-describedby="wt-text" data-side={card?.side}
   style={card?{top:card.top,left:card.left}:{visibility:'hidden'}}>
   <header className="wt-head">
    {number?<span className="wt-count">{number} of {middle}</span>:<span className="wt-brand"><img src="/brand/propscout-mark.svg" alt="" width="24" height="22"/>PropScout</span>}
    <button type="button" className="wt-close" aria-label="Close the tour" onClick={()=>finish('skipped')}><X size={16} aria-hidden="true"/></button>
   </header>
   <h2 id="wt-title">{step.title}</h2>
   <p id="wt-text">{step.text}</p>
   {number&&<div className="wt-dots" aria-hidden="true">{STEPS.slice(1,-1).map((item,at)=><i key={item.key} data-on={at+1===number||undefined} data-done={at+1<number||undefined}/>)}</div>}
   <div className="wt-actions">
    {index===0?<button type="button" className="wt-quiet" onClick={()=>finish('skipped')}>Skip</button>
     :!last&&<button type="button" className="wt-quiet" onClick={back} disabled={busy}>Back</button>}
    <button type="button" ref={nextRef} className="wt-next" onClick={next} disabled={busy}>{index===0?'Start the tour':last?'Start using PropScout':busy?'Loading…':'Next'}</button>
   </div>
  </section>
 </div>,document.body);
}
