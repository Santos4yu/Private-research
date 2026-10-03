import React,{useEffect,useMemo,useRef,useState} from 'react';
import MorphOrb from '@/components/ui/ai-thiking-orb-and-input';
import {createBot,SPORTS} from './krazy-bot';
import {loadLines} from './finder-pool';
import {isPrizePicksLine} from './smart-slip';
import {siteFinderSportAllowed} from './site-access';
import './krazy-bot.css';

// What the bot remembers about this member (krazy-bot.js profile). It
// follows their account to other devices (account-sync.js SYNCED.bot).
const MEMORY_KEY='krazy-bot-memory-v1';
const memory={
 read(){try{return JSON.parse(localStorage.getItem(MEMORY_KEY)||'null');}catch{return null;}},
 write(value){try{localStorage.setItem(MEMORY_KEY,JSON.stringify(value));}catch{/* private mode */}},
};
// Recent line moves, when this member can see them (the Line Moves feed).
async function recentMoves(){
 const response=await fetch('/api/board?view=moves',{cache:'no-store',credentials:'same-origin'});
 if(!response.ok)return [];
 const body=await response.json().catch(()=>({}));
 return Array.isArray(body.moves)?body.moves:[];
}

// Krazy Bot: the orb chat component, answering from today's graded picks
// (krazy-bot.js). Everything runs in the browser on the lines the Finder
// already loads -- no extra server work.
export function KrazyBot(){
 const sports=useMemo(()=>{const open=Object.keys(SPORTS).filter(sport=>siteFinderSportAllowed(sport));return open.length?open:['mlb'];},[]);
 const bot=useMemo(()=>createBot({
  sports,profile:memory,moves:recentMoves,
  load:sport=>{const now=Date.now();return loadLines(sport,{only:row=>isPrizePicksLine(row)&&Date.parse(row.startsAt||'')>now+10*60000});},
 }),[sports]);
 const host=useRef(null);
 const queued=useRef(null);
 const [phase,setPhase]=useState('idle');
 const [examples,setExamples]=useState(()=>bot.examples());
 const [follow,setFollow]=useState([]);

 // Type a question into the component's own field and send it.
 const send=text=>{
  const root=host.current?.querySelector('.mo-root');
  const input=root?.querySelector('.mo-field'),form=root?.querySelector('.mo-input');
  if(!input||!form)return;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,text);
  input.dispatchEvent(new Event('input',{bubbles:true}));
  requestAnimationFrame(()=>form.requestSubmit());
 };
 // From an answer, a tapped follow-up clears it first, then asks.
 const askNow=text=>{
  const root=host.current?.querySelector('.mo-root');
  if(!root)return;
  if(root.dataset.phase==='idle')send(text);
  else if(root.dataset.phase==='answered'){queued.current=text;root.querySelector('.mo-reset')?.click();}
 };

 // Load the boards when the page is first opened (not on every page load).
 useEffect(()=>{
  const node=host.current;
  const warm=()=>bot.board().then(()=>setExamples(bot.examples())).catch(()=>{});
  if(!node||typeof IntersectionObserver==='undefined'){warm();return undefined;}
  const seen=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){warm();seen.disconnect();}});
  seen.observe(node);
  return()=>seen.disconnect();
 },[bot]);
 // Follow the component's state (data-phase on its root): examples while it
 // waits, follow-ups under an answer, and the answer card sized to its text.
 useEffect(()=>{
  const root=host.current?.querySelector('.mo-root');
  const actor=root?.querySelector('.mo-actor'),answer=root?.querySelector('.mo-answer');
  if(!root||!actor||!answer)return undefined;
  const measure=()=>actor.style.setProperty('--ans-h',`${answer.scrollHeight}px`);
  const watch=new MutationObserver(()=>{
   const next=root.dataset.phase;
   setPhase(next);measure();
   if(next==='answered')setFollow(bot.suggestions());
   if(next==='idle'){
    setExamples(bot.examples());
    if(queued.current){const text=queued.current;queued.current=null;send(text);}
   }
  });
  watch.observe(root,{attributes:true,attributeFilter:['data-phase']});
  const words=new MutationObserver(measure);
  words.observe(answer,{childList:true,subtree:true});
  window.addEventListener('resize',measure);
  return()=>{watch.disconnect();words.disconnect();window.removeEventListener('resize',measure);};
 },[bot]);

 const idle=phase==='idle',answered=phase==='answered';
 return <div className="krazy-bot" ref={host}>
  <MorphOrb onSubmit={text=>bot.ask(text)} thinkingLabels={text=>bot.thinking(text)} minThinkMs={3000}/>
  <header className="krazy-bot-head" data-idle={idle?'':undefined}>
   <span className="krazy-bot-badge">{sports.map(sport=>SPORTS[sport].name).join(' · ')}</span>
   <h1>Krazy Bot</h1>
   <p>Ask about today's props: the best plays, matchups, a player or a slip. I remember what you ask.</p>
  </header>
  <div className="krazy-bot-examples" data-idle={idle?'':undefined} aria-label="Example questions">
   {examples.map(text=><button key={text} type="button" tabIndex={idle?0:-1} onClick={()=>askNow(text)}>{text}</button>)}
  </div>
  <div className="krazy-bot-follow" data-show={answered&&follow.length?'':undefined} aria-label="Follow-up questions">
   {follow.map(text=><button key={text} type="button" tabIndex={answered?0:-1} onClick={()=>askNow(text)}>{text}</button>)}
  </div>
 </div>;
}
