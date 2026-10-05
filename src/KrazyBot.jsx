import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUp,ChevronDown,Mic,RotateCcw} from 'lucide-react';
import MorphOrb from '@/components/ui/ai-thiking-orb-and-input';
import {createBot,SPORTS} from './krazy-bot';
import {BotCard} from './KrazyBotCard';
import {KrazyBotHome,LOOK_QUESTIONS} from './KrazyBotHome';
import {loadLines} from './finder-pool';
import {loadHitterMatchups,withHitterMatchups} from './unified-finder-data';
import {loadMatchups} from './slip-matchup';
import {loadGames,loadTeammates,withGame} from './slip-games';
import {isPrizePicksLine} from './smart-slip';
import {siteFinderSportAllowed} from './site-access';
import {useVoice} from './voice-input';
import './krazy-bot.css';

// What the bot remembers about this member (krazy-bot.js profile). It
// follows their account to other devices (account-sync.js SYNCED.bot).
const MEMORY_KEY='krazy-bot-memory-v1';
// An answer with data behind it opens a wider card (the trends, the matchup);
// on a computer wider still, with the report laid out side by side
// (krazy-bot.css), and plain answers get a little more room too.
const CARD_WIDTH=440;
const roomy=room=>room>860;
const cardWidth=room=>roomy(room)?Math.min(760,room-96):CARD_WIDTH;
const textWidth=room=>roomy(room)?520:null;
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

// Ask out loud: the words fill the field as they're heard and the question
// goes when the speaker stops. Hidden where the browser can't listen.
function VoiceButton({onWords,onSaid,tabIndex}){
 const voice=useVoice({onWords,onSaid});
 if(!voice.supported)return null;
 return <button type="button" className="kb-mic" data-listening={voice.listening?'':undefined} onClick={voice.listening?voice.stop:voice.start}
  tabIndex={tabIndex} aria-pressed={voice.listening} aria-label={voice.listening?'Stop listening':'Ask out loud'} title={voice.listening?'Listening…':'Ask out loud'}>
  {voice.listening?<span className="kb-mic-wave" aria-hidden="true"><i/><i/><i/><i/></span>:<Mic aria-hidden="true"/>}
 </button>;
}

// Krazy Bot: the orb chat component, answering from today's graded picks
// (krazy-bot.js). Everything runs in the browser on the lines the Finder
// already loads -- no extra server work.
export function KrazyBot(){
 const sports=useMemo(()=>{const open=Object.keys(SPORTS).filter(sport=>siteFinderSportAllowed(sport));return open.length?open:['mlb'];},[]);
 const bot=useMemo(()=>createBot({
  sports,profile:memory,moves:recentMoves,
  load:async sport=>{
   const now=Date.now();
   const rows=await loadLines(sport,{only:row=>isPrizePicksLine(row)&&Date.parse(row.startsAt||'')>now+10*60000});
   // MLB hitters carry the Research matchup grade (pitch mix and all).
   return sport==='mlb'?withHitterMatchups(rows,await loadHitterMatchups().catch(()=>null)):rows;
  },
  // Each league's matchup tables (slip-matchup.js), so every pick is judged
  // exactly as the Slip Analyzer judges it.
  matchups:sport=>loadMatchups([sport]),
  // A pick's game news (injury report, lineups, what a teammate's absence
  // has meant), the same the Slip Analyzer reads (slip-games.js).
  games:async legs=>{
   const found=await loadGames(legs);
   const mates=await loadTeammates(legs.filter(leg=>found[leg.key]).map(leg=>({key:leg.key,row:withGame(leg.row,found[leg.key])}))).catch(()=>({}));
   return Object.fromEntries(Object.entries(found).map(([key,game])=>[key,{...game,teammates:mates[key]||[]}]));
  },
  // Today's MLB cheat sheets (mlb_sheets.py) for questions about NRFIs, weather, streaks and more.
  sheets:async name=>{
   const response=await fetch(`/api/board?view=mlb-sheet&sheet=${encodeURIComponent(name)}&day=today`,{credentials:'same-origin',cache:'no-store'});
   if(!response.ok)throw new Error('This sheet is unavailable right now.');
   return response.json();
  },
 }),[sports]);
 const host=useRef(null);
 const queued=useRef(null);
 const measureRef=useRef(()=>{});
 const [phase,setPhase]=useState('idle');
 const [examples,setExamples]=useState(()=>bot.examples());
 // Today's board for the home screen (top plays, quick looks).
 const [today,setToday]=useState(null);
 const [todayFailed,setTodayFailed]=useState(false);
 const refreshToday=()=>bot.today().then(value=>{setToday(value);setTodayFailed(false);}).catch(()=>setTodayFailed(true));
 const [follow,setFollow]=useState([]);
 const [rich,setRich]=useState(false);
 const [draft,setDraft]=useState('');

 // Type a question into the component's own field and send it.
 const send=text=>{
  const root=host.current?.querySelector('.mo-root');
  const input=root?.querySelector('.mo-field'),form=root?.querySelector('.mo-input');
  if(!input||!form)return;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,text);
  input.dispatchEvent(new Event('input',{bubbles:true}));
  requestAnimationFrame(()=>form.requestSubmit());
 };
 // Words heard so far, shown in the component's own field without asking yet.
 const typeInto=text=>{
  const input=host.current?.querySelector('.mo-root .mo-field');
  if(!input)return;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,text);
  input.dispatchEvent(new Event('input',{bubbles:true}));
 };
 // From an answer, a tapped follow-up clears it first, then asks.
 const askNow=text=>{
  const root=host.current?.querySelector('.mo-root');
  if(!root)return;
  if(root.dataset.phase==='idle')send(text);
  else if(root.dataset.phase==='answered'){queued.current=text;root.querySelector('.mo-reset')?.click();}
 };

 // The bar under an answer: ask the next question without starting over.
 const askFromBar=event=>{
  event.preventDefault();
  const text=draft.trim();
  if(!text)return;
  setDraft('');
  askNow(text);
 };
 // A card taller than the screen: the next part of it, one tap at a time.
 const more=()=>{const answer=host.current?.querySelector('.mo-answer');answer?.scrollBy({top:answer.clientHeight*.7,behavior:'smooth'});};
 const startOver=()=>{const root=host.current?.querySelector('.mo-root');if(root?.dataset.phase==='answered')root.querySelector('.mo-reset')?.click();};
 // Centered in what's visible: beside the desktop rail, whatever its width.
 useEffect(()=>{
  const shell=document.getElementById('app-shell');
  const place=()=>{const left=shell?parseFloat(getComputedStyle(shell).paddingLeft)||0:0;host.current?.style.setProperty('--kb-left',`${left}px`);};
  place();
  window.addEventListener('resize',place);
  return()=>window.removeEventListener('resize',place);
 },[]);
 // Typing on a phone: the bot is fitted to what's left above the keyboard,
 // with the input resting just over the keys and the site's bottom menu out
 // of the way. Some phones shrink only the visible part of the page for the
 // keyboard and some the whole window, so it's measured against the
 // tallest the screen has been at this width rather than the window.
 useEffect(()=>{
  const viewport=window.visualViewport,node=host.current;
  if(!node)return undefined;
  const page=document.documentElement;
  let full=0,width=0;
  const fit=()=>{
   const height=viewport?viewport.height:window.innerHeight;
   if(window.innerWidth!==width){width=window.innerWidth;full=0;}
   const field=document.activeElement;
   const typing=Boolean(field&&node.contains(field)&&field.matches('input,textarea'));
   if(!typing||height>full)full=Math.max(full,height);
   // Touch screens only: zooming in on a computer shrinks the viewport too.
   const touch=window.matchMedia('(pointer: coarse)').matches;
   const open=touch&&typing&&height<full-120;
   if(open){
    node.style.setProperty('--kb-vv-top',`${Math.round(viewport?viewport.offsetTop:0)}px`);
    node.style.setProperty('--kb-vv-h',`${Math.round(height)}px`);
   }
   if(open!==node.hasAttribute('data-keyboard'))node.toggleAttribute('data-keyboard',open);
   page.toggleAttribute('data-bot-typing',open);
   measureRef.current();
  };
  const later=()=>setTimeout(fit,60);
  // The keyboard slides in after the field takes focus: look again once it has.
  const settle=()=>{fit();setTimeout(fit,320);};
  fit();
  viewport?.addEventListener('resize',fit);
  viewport?.addEventListener('scroll',fit);
  window.addEventListener('resize',fit);
  node.addEventListener('focusin',settle);
  node.addEventListener('focusout',later);
  // Sent from a phone: the keyboard goes down so the answer has the screen.
  const sent=event=>{
   if(!window.matchMedia('(pointer: coarse)').matches)return;
   const field=event.target.querySelector?.('input');
   if(field&&document.activeElement===field)field.blur();
  };
  node.addEventListener('submit',sent,true);
  return()=>{
   viewport?.removeEventListener('resize',fit);viewport?.removeEventListener('scroll',fit);window.removeEventListener('resize',fit);
   node.removeEventListener('focusin',settle);node.removeEventListener('focusout',later);node.removeEventListener('submit',sent,true);
   page.removeAttribute('data-bot-typing');
  };
 },[]);
 // While typing on a phone the orb's input pill rests just above the keys
 // (38px up from the bottom of the bot's box, as --mo-pill-bottom in
 // krazy-bot.css); otherwise the orb keeps its own spot.
 const pillBottom=()=>host.current?.hasAttribute('data-keyboard')?38:null;
 // Load the boards when the page is first opened (not on every page load).
 useEffect(()=>{
  const node=host.current;
  const warm=()=>bot.board().then(()=>{setExamples(bot.examples());return refreshToday();}).catch(()=>setTodayFailed(true));
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
  // The card grows to fit its answer, centred in the open space between the
  // top of the page and the follow-ups under it, and scrolling inside when
  // that isn't room enough.
  const atEnd=()=>answer.toggleAttribute('data-end',answer.scrollTop+answer.clientHeight>=answer.scrollHeight-4);
  // The answer's own height (the box itself is stretched to the card, so its
  // scrollHeight never drops when the card's report switches to a shorter tab).
  const content=()=>{
   const last=answer.lastElementChild;
   return last?last.offsetTop+last.offsetHeight+(parseFloat(getComputedStyle(answer).paddingBottom)||0):answer.scrollHeight;
  };
  const measure=()=>{
   const box=host.current.getBoundingClientRect();
   const follow=host.current.querySelector('.krazy-bot-follow');
   const floor=(follow?follow.getBoundingClientRect().top-box.top:box.height-130)-12;
   // Phones keep it under the account and settings buttons up top (while
   // typing, only as far as they still show above the keyboard).
   const typing=host.current.hasAttribute('data-keyboard');
   const ceiling=window.innerWidth>760?12:typing?Math.max(12,64-(window.visualViewport?.offsetTop||0)):64;
   const room=Math.max(160,floor-ceiling);
   const full=content();
   const height=Math.min(full,room);
   const centre=box.height*.46;
   const top=ceiling+(room-height)/2;
   actor.style.setProperty('--ans-h',`${height}px`);
   // A card taller than the room scrolls; its foot fades until you reach it.
   answer.toggleAttribute('data-scrolls',full>room+1);
   atEnd();
   actor.style.setProperty('--ans-y',`${Math.round(top-(centre-height/2))}px`);
   root.style.setProperty('--ans-cap',`${room}px`);
   // Where the card ends, for the "More" button.
   host.current.style.setProperty('--kb-card-foot',`${Math.round(top+height)}px`);
  };
  measureRef.current=measure;
  const watch=new MutationObserver(()=>{
   const next=root.dataset.phase;
   setPhase(next);measure();
   if(next==='answered')setFollow(bot.suggestions());
   if(next==='idle'){
    setExamples(bot.examples());
    refreshToday();
    if(queued.current){const text=queued.current;queued.current=null;send(text);}
   }
  });
  watch.observe(root,{attributes:true,attributeFilter:['data-phase']});
  const words=new MutationObserver(measure);
  words.observe(answer,{childList:true,subtree:true});
  window.addEventListener('resize',measure);
  answer.addEventListener('scroll',atEnd,{passive:true});
  return()=>{watch.disconnect();words.disconnect();window.removeEventListener('resize',measure);answer.removeEventListener('scroll',atEnd);};
 },[bot]);
 // The follow-ups can wrap to a second row; keep the card clear of them.
 useEffect(()=>{measureRef.current();},[follow]);
 // The answer's text, plus the card of data behind it when there is one.
 const reply=async text=>{
  const said=await bot.ask(text);
  const shown=bot.card();
  setRich(Boolean(shown?.card));
  const room=host.current?.clientWidth||window.innerWidth;
  if(shown?.card)return {text:shown.lead||said,extra:<BotCard card={shown.card}/>,width:cardWidth(room)};
  return textWidth(room)?{text:said,width:textWidth(room)}:said;
 };

 const idle=phase==='idle',answered=phase==='answered';
 return <div className="krazy-bot" ref={host}>
  <MorphOrb onSubmit={reply} thinkingLabels={text=>bot.thinking(text)} minThinkMs={3000} pillBottom={pillBottom}
   inputAccessory={idle?<VoiceButton onWords={typeInto} onSaid={text=>text&&askNow(text)}/>:null}/>
  <section className="krazy-bot-home" data-idle={idle?'':undefined} aria-hidden={idle?undefined:true}>
   <div className="krazy-bot-home-inner">
    <header className="krazy-bot-head">
     <span className="krazy-bot-badge">{sports.map(sport=>SPORTS[sport].name).join(' · ')}</span>
     <h1>Krazy Bot</h1>
     <p>Ask about today's props: the best plays, matchups, a player or a slip. I remember what you ask.</p>
    </header>
    <KrazyBotHome today={today} failed={todayFailed} onAsk={askNow} idle={idle}/>
   </div>
  </section>
  <div className="krazy-bot-examples" data-idle={idle?'':undefined} aria-label="Example questions">
   {examples.filter(text=>!LOOK_QUESTIONS.includes(text)).map(text=><button key={text} type="button" tabIndex={idle?0:-1} onClick={()=>askNow(text)}>{text}</button>)}
  </div>
  <div className="krazy-bot-more" data-show={answered?'':undefined} data-after-card={rich?'':undefined}>
   <button type="button" onClick={more} tabIndex={answered?0:-1}>More<ChevronDown aria-hidden="true"/></button>
  </div>
  <form className="krazy-bot-ask" data-show={answered?'':undefined} data-after-card={rich?'':undefined} onSubmit={askFromBar} autoComplete="off">
   <button type="button" className="krazy-bot-new" onClick={startOver} tabIndex={answered?0:-1} aria-label="New question" title="New question"><RotateCcw aria-hidden="true"/></button>
   <input value={draft} onChange={event=>setDraft(event.target.value)} maxLength={200} placeholder="Ask a follow-up…" aria-label="Ask a follow-up" enterKeyHint="send" spellCheck={false} autoCorrect="off" tabIndex={answered?0:-1}/>
   <VoiceButton onWords={setDraft} onSaid={text=>{if(text){setDraft('');askNow(text);}}} tabIndex={answered?0:-1}/>
   <button type="submit" className="krazy-bot-send" data-ready={draft.trim()?'':undefined} tabIndex={answered?0:-1} aria-label="Send"><ArrowUp aria-hidden="true"/></button>
  </form>
  <div className="krazy-bot-follow" data-show={answered&&follow.length?'':undefined} data-after-card={rich?'':undefined} aria-label="Follow-up questions">
   {follow.map((text,index)=><button key={text} type="button" style={{'--i':index}} tabIndex={answered?0:-1} onClick={()=>askNow(text)}>{text}</button>)}
  </div>
 </div>;
}
