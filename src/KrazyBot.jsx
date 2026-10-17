import {loadLearning} from './learning';
import {logTopPicks} from './slip-history';
import React,{useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {ArrowUp,Mic,Plus,RotateCcw,Sparkles} from 'lucide-react';
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

// The Ace Assistant: a conversation with the bot (krazy-bot.js), which
// answers from today's graded picks in the browser, on the lines the Finder
// already loads. Before the first question, today's board (KrazyBotHome.jsx);
// then the thread, each answer streaming in with its report card
// (KrazyBotCard.jsx) under it, and the box to ask the next one at the foot.

// What the bot remembers about this member (krazy-bot.js profile). It
// follows their account to other devices (account-sync.js SYNCED.bot).
const MEMORY_KEY='krazy-bot-memory-v1';
const memory={
 read(){try{return JSON.parse(localStorage.getItem(MEMORY_KEY)||'null');}catch{return null;}},
 write(value){try{localStorage.setItem(MEMORY_KEY,JSON.stringify(value));}catch{/* private mode */}},
};
// However fast the answer is, the thinking shows this long, so it reads.
const THINK_MS=1300;
// The answer's words stream in this far apart, all of them within STREAM_MS.
const WORD_MS=26,STREAM_MS=1500;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,Math.max(0,ms)));

// Recent line moves, when this member can see them (the Line Moves feed).
async function recentMoves(){
 const response=await fetch('/api/board?view=moves',{cache:'no-store',credentials:'same-origin'});
 if(!response.ok)return [];
 const body=await response.json().catch(()=>({}));
 return Array.isArray(body.moves)?body.moves:[];
}

// The assistant's mark: the Ace spade in a ring of light that turns, faster
// while it thinks.
export function AceOrb({size='md',thinking=false}){
 return <span className="ka-orb" data-size={size} data-thinking={thinking||undefined} aria-hidden="true">
  <span className="ka-orb-ring"/><span className="ka-orb-core"><img src="/brand/ace-props-mark.png" alt="" width="40" height="40"/></span>
 </span>;
}

// Ask out loud: the words fill the box as they're heard and the question
// goes when the speaker stops. Hidden where the browser can't listen.
function VoiceButton({onWords,onSaid,disabled}){
 const voice=useVoice({onWords,onSaid});
 if(!voice.supported)return null;
 return <button type="button" className="ka-mic" data-listening={voice.listening||undefined} onClick={voice.listening?voice.stop:voice.start} disabled={disabled}
  aria-pressed={voice.listening} aria-label={voice.listening?'Stop listening':'Ask out loud'} title={voice.listening?'Listening…':'Ask out loud'}>
  {voice.listening?<span className="ka-wave" aria-hidden="true"><i/><i/><i/><i/></span>:<Mic aria-hidden="true"/>}
 </button>;
}

// What the assistant is doing, one line at a time, while it thinks.
function Thinking({labels}){
 const [at,setAt]=useState(0);
 useEffect(()=>{
  if(!labels?.length)return undefined;
  const timer=setInterval(()=>setAt(index=>Math.min(index+1,labels.length-1)),1100);
  return()=>clearInterval(timer);
 },[labels]);
 return <div className="ka-thinking" role="status" aria-live="polite">
  <span className="ka-thinking-dots" aria-hidden="true"><i/><i/><i/></span>
  <span key={at} className="ka-thinking-text">{labels?.[at]||'Thinking'}</span>
  <span className="ka-ghost" aria-hidden="true"><i/><i/><i/></span>
 </div>;
}

// One answer: its words stream in, then the report card under it loads in
// turn (its animations start once the words have landed).
function Answer({message,onRetry}){
 const words=useMemo(()=>String(message.text||'').split(/\s+/).filter(Boolean),[message.text]);
 const gap=words.length>1?Math.min(WORD_MS,STREAM_MS/(words.length-1)):0;
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  if(message.status!=='done')return undefined;
  const timer=setTimeout(()=>setReady(true),Math.min(STREAM_MS,gap*words.length)+260);
  return()=>clearTimeout(timer);
 },[message.status,gap,words.length]);
 if(message.status==='thinking')return <Thinking labels={message.labels}/>;
 if(message.status==='error')return <div className="ka-error"><p>That didn't come through. The board may still be loading.</p>
  <button type="button" onClick={onRetry}><RotateCcw aria-hidden="true"/>Try again</button></div>;
 return <div className="ka-answer" data-ready={ready||undefined} data-card={message.card?'':undefined}>
  <p className="ka-text">{words.map((word,index)=><span key={index} style={{'--d':`${Math.round(index*gap)}ms`}}>{word}{' '}</span>)}</p>
  {message.card&&<div className="ka-card"><BotCard card={message.card}/></div>}
 </div>;
}

export function KrazyBot(){
 const sports=useMemo(()=>{const open=Object.keys(SPORTS).filter(sport=>siteFinderSportAllowed(sport));return open.length?open:['mlb'];},[]);
 const bot=useMemo(()=>createBot({
  sports,profile:memory,moves:recentMoves,
  load:async sport=>{
   // What the results have taught the model, before anything is graded.
   await loadLearning();
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
 const host=useRef(null),scroller=useRef(null),field=useRef(null),lastAsked=useRef(null);
 const [messages,setMessages]=useState([]);
 const [busy,setBusy]=useState(false);
 const [draft,setDraft]=useState('');
 const [follow,setFollow]=useState([]);
 const [examples,setExamples]=useState(()=>bot.examples());
 // Today's board for the home screen (top plays, quick looks).
 const [today,setToday]=useState(null);
 const [todayFailed,setTodayFailed]=useState(false);
 const refreshToday=useCallback(()=>bot.today().then(value=>{
  setToday(value);setTodayFailed(false);
  // Its top plays go back to be settled and learned from (learning.py).
  logTopPicks((value.graded||[]).map(leg=>({row:leg.row,side:leg.side,grade:leg})),{source:'assistant',limit:30});
 }).catch(()=>setTodayFailed(true)),[bot]);

 // Load the boards when the page is first opened (not on every page load).
 useEffect(()=>{
  const node=host.current;
  const warm=()=>bot.board().then(()=>{setExamples(bot.examples());return refreshToday();}).catch(()=>setTodayFailed(true));
  if(!node||typeof IntersectionObserver==='undefined'){warm();return undefined;}
  const seen=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){warm();seen.disconnect();}});
  seen.observe(node);
  return()=>seen.disconnect();
 },[bot,refreshToday]);

 const ask=useCallback(async raw=>{
  const text=String(raw||'').trim();
  if(!text||busy)return;
  const id=`${Date.now()}`;
  lastAsked.current=`q${id}`;
  setDraft('');setFollow([]);setBusy(true);
  setMessages(list=>[...list,{id:`q${id}`,role:'user',text},{id:`a${id}`,role:'bot',status:'thinking',labels:bot.thinking(text),question:text}]);
  // Sent from a phone: the keyboard goes down so the answer has the screen.
  if(window.matchMedia('(pointer: coarse)').matches)field.current?.blur();
  const started=performance.now();
  let reply;
  try{
   const said=await bot.ask(text);
   const shown=bot.card();
   reply={status:'done',text:shown?.card?(shown.lead||said):said,card:shown?.card||null};
  }catch{reply={status:'error'};}
  await sleep(THINK_MS-(performance.now()-started));
  setMessages(list=>list.map(message=>message.id===`a${id}`?{...message,...reply}:message));
  if(reply.status==='done')setFollow(bot.suggestions());
  setBusy(false);
 },[bot,busy]);

 const fresh=()=>{if(busy)return;setMessages([]);setFollow([]);setExamples(bot.examples());refreshToday();};

 // A new question rises to the top of the thread, so its answer has the room under it.
 useLayoutEffect(()=>{
  const id=lastAsked.current;
  if(!id)return;
  lastAsked.current=null;
  const node=scroller.current?.querySelector(`[data-id="${id}"]`);
  if(node&&scroller.current)scroller.current.scrollTo({top:node.offsetTop-12,behavior:'smooth'});
 },[messages]);

 // The box grows with what's typed, up to five lines.
 useLayoutEffect(()=>{
  const node=field.current;
  if(!node)return;
  node.style.height='';
  if(draft)node.style.height=`${Math.min(node.scrollHeight,132)}px`;
 },[draft]);
 // The room the thread has, so the latest answer can hold the screen under
 // its question (krazy-bot.css --ka-room).
 useEffect(()=>{
  const node=scroller.current;
  if(!node||typeof ResizeObserver==='undefined')return undefined;
  const watch=new ResizeObserver(()=>node.style.setProperty('--ka-room',`${node.clientHeight}px`));
  watch.observe(node);
  return()=>watch.disconnect();
 },[]);

 // Typing on a touch screen: the assistant fits what's left above the
 // keyboard (window.visualViewport), so the box rests just over the keys
 // and the site's bottom menu steps out of the way.
 useEffect(()=>{
  const viewport=window.visualViewport,node=host.current;
  if(!node||!viewport)return undefined;
  const page=document.documentElement;
  const fit=()=>{
   const touch=window.matchMedia('(pointer: coarse)').matches;
   const typing=touch&&document.activeElement===field.current;
   const open=typing&&viewport.height<window.innerHeight-120;
   node.toggleAttribute('data-keyboard',open);
   page.toggleAttribute('data-bot-typing',open);
   if(open){node.style.setProperty('--kb-vv-top',`${Math.round(viewport.offsetTop)}px`);node.style.setProperty('--kb-vv-h',`${Math.round(viewport.height)}px`);}
  };
  const settle=()=>{fit();setTimeout(fit,320);};
  viewport.addEventListener('resize',fit);
  viewport.addEventListener('scroll',fit);
  node.addEventListener('focusin',settle);
  node.addEventListener('focusout',()=>setTimeout(fit,60));
  return()=>{viewport.removeEventListener('resize',fit);viewport.removeEventListener('scroll',fit);node.removeEventListener('focusin',settle);page.removeAttribute('data-bot-typing');};
 },[]);
 // Beside the desktop rail, whatever its width.
 useEffect(()=>{
  const shell=document.getElementById('app-shell');
  const place=()=>{const left=shell?parseFloat(getComputedStyle(shell).paddingLeft)||0:0;host.current?.style.setProperty('--kb-left',`${left}px`);};
  place();
  window.addEventListener('resize',place);
  return()=>window.removeEventListener('resize',place);
 },[]);

 const submit=event=>{event.preventDefault();ask(draft);};
 const keys=event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();ask(draft);}};
 const chatting=messages.length>0;
 const narrow=typeof window!=='undefined'&&window.matchMedia('(max-width: 760px)').matches;
 const chips=chatting?follow:examples.filter(text=>!LOOK_QUESTIONS.includes(text));

 return <div className="krazy-bot" ref={host} data-chatting={chatting||undefined}>
  <header className="ka-top">
   <div className="ka-brand">
    <AceOrb size="sm" thinking={busy}/>
    <div><h1>Ace Assistant</h1>
     <p>{busy?<span className="ka-live is-busy">Thinking…</span>
      :today?<span className="ka-live">{today.props.toLocaleString()} props · {today.games} games{today.next?` · next ${today.next}`:''}</span>
      :<span className="ka-live is-idle">{todayFailed?'Board unavailable right now':'Loading today\'s board…'}</span>}</p></div>
   </div>
   {chatting&&<button type="button" className="ka-new" onClick={fresh} disabled={busy}><Plus aria-hidden="true"/><span>New chat</span></button>}
  </header>

  <div className="ka-scroll" ref={scroller}>
   {!chatting?<div className="ka-home">
    <section className="ka-hero">
     <AceOrb size="lg"/>
     <span className="ka-sports">{sports.map(sport=>SPORTS[sport].name).join(' · ')}</span>
     <h2>What's the play <span>today?</span></h2>
     <p>Ask about any player, prop, matchup or slip. I grade every pick on today's board and remember what you ask.</p>
    </section>
    <KrazyBotHome today={today} failed={todayFailed} onAsk={ask} idle/>
   </div>
   :<ol className="ka-thread" aria-label="Conversation">
    {messages.map(message=>message.role==='user'
     ?<li key={message.id} data-id={message.id} className="ka-msg is-user"><p>{message.text}</p></li>
     :<li key={message.id} data-id={message.id} className="ka-msg is-bot" data-status={message.status}>
      <AceOrb size="xs" thinking={message.status==='thinking'}/>
      <div className="ka-bubble"><Answer message={message} onRetry={()=>{setMessages(list=>list.filter(item=>item.id!==message.id&&item.id!==message.id.replace(/^a/,'q')));ask(message.question);}}/></div>
     </li>)}
   </ol>}
  </div>

  <footer className="ka-dock">
   {chips.length>0&&!busy&&<div className="ka-chips" aria-label={chatting?'Follow-up questions':'Example questions'}>
    {chips.map((text,index)=><button key={text} type="button" style={{'--i':index}} onClick={()=>ask(text)}><Sparkles aria-hidden="true"/>{text}</button>)}
   </div>}
   <form className="ka-composer" onSubmit={submit} autoComplete="off" data-busy={busy||undefined}>
    <textarea ref={field} rows={1} value={draft} onChange={event=>setDraft(event.target.value)} onKeyDown={keys} maxLength={200}
     placeholder={chatting?'Ask a follow-up…':narrow?'Ask about any prop…':'Ask about any player, prop or matchup…'} aria-label="Ask the Ace Assistant" enterKeyHint="send" spellCheck={false} autoCorrect="off"/>
    <VoiceButton onWords={setDraft} onSaid={text=>{if(text)ask(text);}} disabled={busy}/>
    <button type="submit" className="ka-send" disabled={busy||!draft.trim()} aria-label={busy?'Thinking':'Send'}>
     {busy?<span className="ka-spin" aria-hidden="true"/>:<ArrowUp aria-hidden="true"/>}
    </button>
   </form>
   <small className="ka-foot">Grades are from today's board and recent games. Not a guarantee. Play responsibly.</small>
  </footer>
 </div>;
}
