import React,{useEffect,useMemo,useRef,useState} from 'react';
import MorphOrb from '@/components/ui/ai-thiking-orb-and-input';
import {createBot,EXAMPLES} from './krazy-bot';
import {loadLines} from './finder-pool';
import {isPrizePicksLine} from './smart-slip';
import './krazy-bot.css';

// Krazy Bot (admin-only for now): the orb chat component, answering from
// today's graded MLB picks (krazy-bot.js). Everything runs in the browser
// on the lines the Finder already loads -- no extra server work.
export function KrazyBot(){
 const bot=useMemo(()=>createBot({load:sport=>{
  const now=Date.now();
  return loadLines(sport,{only:row=>isPrizePicksLine(row)&&Date.parse(row.startsAt||'')>now+10*60000});
 }}),[]);
 const host=useRef(null);
 const [idle,setIdle]=useState(true);
 // Load the board as soon as the page is opened (not on every admin page
 // load), so the first answer doesn't wait on it.
 useEffect(()=>{
  const node=host.current;
  if(!node||typeof IntersectionObserver==='undefined'){bot.board();return undefined;}
  const seen=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){bot.board();seen.disconnect();}});
  seen.observe(node);
  return()=>seen.disconnect();
 },[bot]);
 // The component marks its state on its root (data-phase). Example
 // questions show only while it waits for one, and the answer card is
 // told its text's height so a longer answer can grow it.
 useEffect(()=>{
  const root=host.current?.querySelector('.mo-root');
  const actor=root?.querySelector('.mo-actor'),answer=root?.querySelector('.mo-answer');
  if(!root||!actor||!answer)return undefined;
  const measure=()=>actor.style.setProperty('--ans-h',`${answer.scrollHeight}px`);
  const phase=new MutationObserver(()=>{setIdle(root.dataset.phase==='idle');measure();});
  phase.observe(root,{attributes:true,attributeFilter:['data-phase']});
  const words=new MutationObserver(measure);
  words.observe(answer,{childList:true,subtree:true});
  window.addEventListener('resize',measure);
  return()=>{phase.disconnect();words.disconnect();window.removeEventListener('resize',measure);};
 },[]);
 // A tapped example is typed into the component's own field and sent.
 const askExample=text=>{
  const root=host.current?.querySelector('.mo-root');
  const input=root?.querySelector('.mo-field'),form=root?.querySelector('.mo-input');
  if(!input||!form||root.dataset.phase!=='idle')return;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,text);
  input.dispatchEvent(new Event('input',{bubbles:true}));
  requestAnimationFrame(()=>form.requestSubmit());
 };
 return <div className="krazy-bot" ref={host}>
  <MorphOrb onSubmit={text=>bot.ask(text)} minThinkMs={1800}/>
  <header className="krazy-bot-head" data-idle={idle?'':undefined}>
   <span className="krazy-bot-badge">MLB</span>
   <h1>Krazy Bot</h1>
   <p>Ask about today's props. Every answer comes from our models.</p>
  </header>
  <div className="krazy-bot-examples" data-idle={idle?'':undefined} aria-label="Example questions">
   {EXAMPLES.map(text=><button key={text} type="button" tabIndex={idle?0:-1} onClick={()=>askExample(text)}>{text}</button>)}
  </div>
 </div>;
}
