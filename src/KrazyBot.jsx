import {loadLearning} from './learning';
import {logTopPicks} from './slip-history';
import React,{useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {ArrowUp,Check,ChevronRight,Clock3,Flame,Layers,Mic,Plus,RotateCcw,Scale,Search,ShieldCheck,Swords,Target} from 'lucide-react';
import {LEAGUE_LOGOS} from './league-logos';
import {createBot,SPORTS} from './krazy-bot';
import {AceCard,Chance} from './AceCards';
import {Img,Face as SlipFace,TierBadge} from './PickParts';
import {loadLines} from './finder-pool';
import {loadHitterMatchups,withHitterMatchups} from './unified-finder-data';
import {loadMatchups} from './slip-matchup';
import {loadGames,loadTeammates,withGame} from './slip-games';
import {isPrizePicksLine} from './smart-slip';
import {siteFinderSportAllowed} from './site-access';
import {accountProfile} from './account-sync';
import {useVoice} from './voice-input';
import './krazy-bot.css';
import './ace-assistant.css';

// The Ace Assistant: a research desk you can talk to. It answers from
// today's graded picks (krazy-bot.js) in the browser, on the lines the
// Finder already loads, and shows a pick the way the Slip Analyzer does
// (AceCards.jsx). On a computer today's board sits beside the conversation;
// on a phone it's on the first screen, and the box to ask rests over the keys.

// What the bot remembers about this member (krazy-bot.js profile). It
// follows their account to other devices (account-sync.js SYNCED.bot).
const MEMORY_KEY='krazy-bot-memory-v1';
const memory={
 read(){try{return JSON.parse(localStorage.getItem(MEMORY_KEY)||'null');}catch{return null;}},
 write(value){try{localStorage.setItem(MEMORY_KEY,JSON.stringify(value));}catch{/* private mode */}},
};
// However fast the answer is, the research shows this long, so it reads.
const THINK_MS=1500;
// Each research step is ticked off this far apart.
const STEP_MS=520;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,Math.max(0,ms)));
const pct=value=>`${Math.round(value*100)}%`;
const figure=value=>value==null?'—':String(Math.round(Number(value)*10)/10);
const clock=at=>new Date(at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
const MARK='/brand/ace-props-mark.png';

// Recent line moves, when this member can see them (the Line Moves feed).
async function recentMoves(){
 const response=await fetch('/api/board?view=moves',{cache:'no-store',credentials:'same-origin'});
 if(!response.ok)return [];
 const body=await response.json().catch(()=>({}));
 return Array.isArray(body.moves)?body.moves:[];
}

// Ask out loud: the words fill the box as they're heard and the question
// goes when the speaker stops. Hidden where the browser can't listen.
function VoiceButton({onWords,onSaid,disabled}){
 const voice=useVoice({onWords,onSaid});
 if(!voice.supported)return null;
 return <button type="button" className="ace-mic" data-listening={voice.listening||undefined} onClick={voice.listening?voice.stop:voice.start} disabled={disabled}
  aria-pressed={voice.listening} aria-label={voice.listening?'Stop listening':'Ask out loud'} title={voice.listening?'Listening…':'Ask out loud'}>
  {voice.listening?<span className="ace-wave" aria-hidden="true"><i/><i/><i/><i/></span>:<Mic size={18} aria-hidden="true"/>}
 </button>;
}

// What it's checking, as a list: each step ticked off as the next starts.
function Research({labels}){
 const steps=labels?.length?labels:['Reading your question','Checking today\'s board','Grading the picks'];
 const [at,setAt]=useState(0);
 useEffect(()=>{
  const timer=setInterval(()=>setAt(index=>Math.min(index+1,steps.length-1)),STEP_MS);
  return()=>clearInterval(timer);
 },[steps.length]);
 return <div className="ace-research" role="status" aria-live="polite">
  <ol>{steps.slice(0,at+1).map((text,index)=><li key={text} data-done={index<at||undefined}>
   {index<at?<Check size={13} strokeWidth={3} aria-hidden="true"/>:<span className="ace-spinner" aria-hidden="true"/>}{text}</li>)}</ol>
  <span className="ace-progress" style={{'--p':(at+1)/steps.length}} aria-hidden="true"><i/></span>
 </div>;
}

// One answer: the words, then the card under them (its parts load in once
// the words have landed).
function Reply({message,onAsk,onRetry}){
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  if(message.status!=='done')return undefined;
  const timer=setTimeout(()=>setReady(true),220);
  return()=>clearTimeout(timer);
 },[message.status]);
 if(message.status==='thinking')return <Research labels={message.labels}/>;
 if(message.status==='error')return <div className="ace-error"><p>That one didn't come through. Today's board may still be loading.</p>
  <button type="button" onClick={onRetry}><RotateCcw size={15} aria-hidden="true"/>Try again</button></div>;
 return <div className="ace-answer" data-ready={ready||undefined}>
  <p className="ace-text">{message.text}</p>
  {message.card&&<AceCard card={message.card} onAsk={onAsk}/>}
 </div>;
}

// A league's logo, or its short name if the logo won't load.
function LeagueMark({sport}){
 const [broken,setBroken]=useState(false);
 return broken||!LEAGUE_LOGOS[sport]?<em className="ace-league-text">{sport.toUpperCase()}</em>
  :<img src={LEAGUE_LOGOS[sport]} alt="" onError={()=>setBroken(true)}/>;
}

const TIER_NAMES={elite:'Elite',strong:'Strong',lean:'Lean',risky:'Risky',fade:'Fade'};
const gameOf=play=>[play.team&&play.opponent?`${play.team} ${play.home===false?'@':'vs'} ${play.opponent}`:play.team,play.time].filter(Boolean).join(' · ');
const faceRow=play=>play.row||{player:play.player,headshot:play.headshot,sport:play.sport,teamLogo:play.teamLogo};

// Today's top play, up front: who, the line, his chance and his last games.
function Spotlight({play,onAsk,loading}){
 if(!play)return <div className="ace-spot is-empty" aria-hidden="true">{!loading&&<p>Today's top play shows here once the board loads.</p>}</div>;
 const last=play.last||[];
 const top=Math.max(play.line*1.5,...last.map(game=>game.value),1);
 const decided=last.filter(game=>game.hit!==null),hits=decided.filter(game=>game.hit).length;
 return <button type="button" className="ace-spot" data-tier={play.tier||'none'} onClick={()=>onAsk(play.question)}>
  <Img className="ace-spot-mark" src={play.teamLogo}/>
  <span className="ace-spot-top"><span className="ace-spot-tag"><Flame size={13} aria-hidden="true"/>Top play right now</span>{play.tier&&<TierBadge tier={play.tier}/>}</span>
  <span className="ace-spot-head">
   <SlipFace row={faceRow(play)} tier={play.tier}/>
   <span className="ace-spot-who"><b>{play.player}</b>
    <small>{play.team}{play.position&&` · ${play.position}`}{play.opponent&&<span className="ace-spot-vs"> {play.home===false?'@':'vs'} <Img src={play.opponentLogo}/>{play.opponent}</span>}</small>
    {play.time&&<small>{play.time}</small>}</span>
   <Chance value={play.chance} tier={play.tier} size={60}/>
  </span>
  <span className="ace-spot-line"><em data-side={play.side}>{play.side==='UNDER'?'Less':'More'}</em><b>{figure(play.line)}</b><span>{play.stat}</span></span>
  {last.length>=3&&<span className="ace-spot-games">
   <span className="ace-spot-games-head"><small>Last {last.length} games</small><b>{hits}/{decided.length} {play.side==='UNDER'?'under':'over'}</b></span>
   <span className="ace-spot-bars">{last.map((game,index)=><i key={index} data-hit={game.hit===null?'push':game.hit?'hit':'miss'} style={{'--h':`${Math.max(6,game.value/top*100)}%`,'--i':index}}/>)}
    <u style={{'--y':`${play.line/top*100}%`}}/></span>
  </span>}
  {play.matchup?.text&&<span className="ace-spot-note" data-tone={play.matchup.tone||undefined}><Swords size={13} aria-hidden="true"/>{play.matchup.text}</span>}
  <span className="ace-spot-go">See the full report<ChevronRight size={15} aria-hidden="true"/></span>
 </button>;
}

// Top plays as rows: who, the line, the game and the chance.
function TopPlays({plays,onAsk,loading,disabled}){
 if(!plays.length)return loading?<ul className="ace-plays" aria-hidden="true">{[0,1,2,3].map(index=><li key={index} className="ace-ghost"/>)}</ul>
  :<p className="ace-empty">No plays to show right now.</p>;
 return <ul className="ace-plays">{plays.map((play,index)=><li key={`${play.player}-${play.stat}-${play.line}`} style={{'--i':index}}>
  <button type="button" onClick={()=>onAsk(play.question)} disabled={disabled} data-tier={play.tier||'none'}>
   <SlipFace row={faceRow(play)} tier={play.tier}/>
   <span className="ace-play-main"><b>{play.player}</b>
    <span><em data-side={play.side}>{play.side==='UNDER'?'Less':'More'}</em> {figure(play.line)} {play.short||play.stat}</span>
    <small>{gameOf(play)}</small></span>
   <span className="ace-play-end"><Chance value={play.chance} tier={play.tier}/>{play.tier&&<em className="ace-tier-word">{TIER_NAMES[play.tier]}</em>}</span>
  </button>
 </li>)}</ul>;
}

// Today's numbers in one strip, and each league's share of the props.
function Board({today,failed}){
 const leagues=today?.leagues||[];
 const most=Math.max(1,...leagues.map(item=>item.props));
 return <div className="ace-board">
  <dl className="ace-stats">
   <div><dt>Props</dt><dd>{today?today.props.toLocaleString():'—'}</dd></div>
   <div><dt>Games</dt><dd>{today?today.games:'—'}</dd></div>
   <div><dt>Next start</dt><dd>{today?(today.next||'—'):failed?'—':'…'}</dd></div>
  </dl>
  {leagues.length>0&&<ul className="ace-leagues">{leagues.map(item=><li key={item.sport}>
   <span className="ace-league-mark"><LeagueMark sport={item.sport}/></span><span>{item.name}</span><b>{item.props.toLocaleString()}</b>
   <i style={{'--w':`${Math.round(item.props/most*100)}%`}}/>
  </li>)}</ul>}
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
 const [recent,setRecent]=useState([]);
 // Today's board (the numbers, the top plays) for the welcome and the side panel.
 const [today,setToday]=useState(null);
 const [todayFailed,setTodayFailed]=useState(false);
 const refreshToday=useCallback(()=>bot.today().then(value=>{
  setToday(value);setTodayFailed(false);
  // Its top plays go back to be settled and learned from (learning.py).
  logTopPicks((value.graded||[]).map(leg=>({row:leg.row,side:leg.side,grade:leg})),{source:'assistant',limit:30});
 }).catch(()=>setTodayFailed(true)),[bot]);
 // The member's latest questions, newest first (krazy-bot.js profile).
 const readRecent=useCallback(()=>{
  const asked=bot.profile()?.asked||[];
  setRecent([...new Set(asked.map(item=>item.q).filter(Boolean))].slice(0,4));
 },[bot]);

 // Load the boards when the page is first opened (not on every page load).
 useEffect(()=>{
  const node=host.current;
  const warm=()=>bot.board().then(()=>{setExamples(bot.examples());readRecent();return refreshToday();}).catch(()=>setTodayFailed(true));
  if(!node||typeof IntersectionObserver==='undefined'){warm();return undefined;}
  const seen=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){warm();seen.disconnect();}});
  seen.observe(node);
  return()=>seen.disconnect();
 },[bot,refreshToday,readRecent]);

 const ask=useCallback(async raw=>{
  const text=String(raw||'').trim();
  if(!text||busy)return;
  const id=`${Date.now()}`;
  lastAsked.current=`q${id}`;
  setDraft('');setFollow([]);setBusy(true);
  setMessages(list=>[...list,{id:`q${id}`,role:'user',text},{id:`a${id}`,role:'bot',status:'thinking',labels:bot.thinking(text),question:text,at:Date.now()}]);
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
  setMessages(list=>list.map(message=>message.id===`a${id}`?{...message,...reply,at:Date.now()}:message));
  if(reply.status==='done')setFollow(bot.suggestions());
  readRecent();
  setBusy(false);
 },[bot,busy,readRecent]);
 const retry=message=>{setMessages(list=>list.filter(item=>item.id!==message.id&&item.id!==message.id.replace(/^a/,'q')));ask(message.question);};
 const fresh=()=>{if(busy)return;setMessages([]);setFollow([]);setExamples(bot.examples());refreshToday();};
 // Start a question for them to finish ("How's ___ looking?").
 const prime=text=>{setDraft(text);requestAnimationFrame(()=>{const node=field.current;if(node){node.focus();node.setSelectionRange(text.length,text.length);}});};

 // A new question rises to the top of the conversation, its answer under it.
 useLayoutEffect(()=>{
  const id=lastAsked.current;
  if(!id)return;
  lastAsked.current=null;
  const node=scroller.current?.querySelector(`[data-id="${id}"]`);
  if(node&&scroller.current)scroller.current.scrollTo({top:node.offsetTop-14,behavior:'smooth'});
 },[messages]);
 // The room the conversation has, so the latest answer can hold the screen
 // under its question (ace-assistant.css --ace-room).
 useEffect(()=>{
  const node=scroller.current;
  if(!node||typeof ResizeObserver==='undefined')return undefined;
  const watch=new ResizeObserver(()=>node.style.setProperty('--ace-room',`${node.clientHeight}px`));
  watch.observe(node);
  return()=>watch.disconnect();
 },[]);
 // The box grows with what's typed, up to five lines.
 useLayoutEffect(()=>{
  const node=field.current;
  if(!node)return;
  node.style.height='';
  if(draft)node.style.height=`${Math.min(node.scrollHeight,132)}px`;
 },[draft]);
 // Typing on a touch screen: the page fits what's left above the keyboard
 // (window.visualViewport), the box rests just over the keys and the
 // site's bottom menu steps out of the way.
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
   // iOS can leave the page scrolled once the keys go down, which lifts
   // everything pinned to the screen (the dock over a black strip). This
   // page never scrolls as a whole, so while it's showing it goes back to
   // the top.
   else if(node.getClientRects().length&&(window.scrollY||page.scrollTop))window.scrollTo(0,0);
  };
  const settle=()=>{fit();setTimeout(fit,320);};
  const later=()=>{setTimeout(fit,60);setTimeout(fit,420);};
  viewport.addEventListener('resize',fit);
  viewport.addEventListener('scroll',fit);
  node.addEventListener('focusin',settle);
  node.addEventListener('focusout',later);
  return()=>{viewport.removeEventListener('resize',fit);viewport.removeEventListener('scroll',fit);node.removeEventListener('focusin',settle);node.removeEventListener('focusout',later);page.removeAttribute('data-bot-typing');};
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
 const plays=today?.top?.filter(Boolean)||[];
 const name=String(accountProfile()?.name||'').trim().split(/\s+/)[0];
 const hour=new Date().getHours();
 const greeting=`${hour<12?'Good morning':hour<18?'Good afternoon':'Good evening'}${name?`, ${name}`:''}`;
 const starts=[
  {icon:ShieldCheck,title:'Safest pick',text:today?.safest?`${today.safest.player} · ${pct(today.safest.chance)} to hit`:'The likeliest hit on the board',go:()=>ask('Safest pick')},
  {icon:Swords,title:'Best matchup',text:today?.matchup?`${today.matchup.player}${today.matchup.rating?` · ${today.matchup.rating.label}`:''}`:'The softest spot today',go:()=>ask('Best matchup today')},
  {icon:Layers,title:'Build a slip',text:'Three picks, B or better, different games',go:()=>ask('Build me a 3-pick slip')},
  {icon:Search,title:'Check a player',text:'Type a name, get every line graded',go:()=>prime('How\'s ')},
  {icon:Scale,title:'Compare two',text:'Which of two picks is the better play',go:()=>prime('Compare ')},
  today?.mlb===false?{icon:Flame,title:'Best value',text:'A demon worth the payout',go:()=>ask('Best value play')}
   :{icon:Target,title:'NRFI / YRFI',text:'First-inning chances by game',go:()=>ask('nrfi today?')},
 ];
 const asked=new Set(['Safest pick','Best matchup today','Build me a 3-pick slip','nrfi today?','Best value play']);
 const chips=chatting?follow:examples.filter(text=>!asked.has(text)).slice(0,4);

 return <div className="krazy-bot ace" ref={host} data-chatting={chatting||undefined}>
  <header className="ace-top">
   <div className="ace-title"><span className="ace-mark"><img src={MARK} alt="" width="24" height="24"/></span>
    <div><h1>Ace Assistant</h1>
     <ul className="ace-top-leagues" aria-label={sports.map(sport=>SPORTS[sport].name).join(', ')}>{sports.map(sport=><li key={sport} title={SPORTS[sport].name}><LeagueMark sport={sport}/></li>)}</ul></div></div>
   <div className="ace-top-end">
    <span className="ace-status" data-state={busy?'busy':today?'live':todayFailed?'down':'idle'}>
     <i aria-hidden="true"/>{busy?'Researching':today?`${today.props.toLocaleString()} props live`:todayFailed?'Board unavailable':'Loading board'}</span>
    {chatting&&<button type="button" className="ace-new" onClick={fresh} disabled={busy}><Plus size={16} aria-hidden="true"/><span>New chat</span></button>}
   </div>
  </header>

  <div className="ace-body">
   <main className="ace-main">
    <div className="ace-scroll" ref={scroller}>
     {!chatting?<div className="ace-welcome">
      <section className="ace-hero">
       <div className="ace-intro">
        <p className="ace-hello">{greeting}</p>
        <h2>What are we <span>playing today?</span></h2>
        <p>Ask about a player, a prop or a slip. I check it against his recent games, the matchup, injuries and the books, and grade it the way the Slip Analyzer does.</p>
        <p className="ace-live" data-ready={today?'':undefined}><i aria-hidden="true"/>
         {today?<>{today.props.toLocaleString()} props<em>·</em>{today.games} games{today.next&&<><em>·</em>next start {today.next}</>}</>
          :todayFailed?'Today\'s board is unavailable right now':'Loading today\'s board'}</p>
       </div>
       <Spotlight play={plays[0]} onAsk={ask} loading={!today&&!todayFailed}/>
      </section>
      <section>
       <h3>Start with</h3>
       <div className="ace-starts">{starts.map(({icon:Icon,title,text,go},index)=><button key={title} type="button" style={{'--i':index}} onClick={go}>
        <span className="ace-start-icon"><Icon size={18} aria-hidden="true"/></span><span className="ace-start-text"><b>{title}</b><small>{text}</small></span>
        <ChevronRight size={16} className="ace-start-go" aria-hidden="true"/>
       </button>)}</div>
      </section>
      {(plays.length>1||!today)&&<section className="ace-welcome-plays"><h3>More top plays</h3><TopPlays plays={plays.slice(1)} onAsk={ask} loading={!today&&!todayFailed}/></section>}
     </div>
     :<ol className="ace-thread" aria-label="Conversation">
      {messages.map(message=>message.role==='user'
       ?<li key={message.id} data-id={message.id} className="ace-msg is-user"><p>{message.text}</p></li>
       :<li key={message.id} data-id={message.id} className="ace-msg is-bot" data-status={message.status}>
        <div className="ace-from"><span className="ace-mark is-small"><img src={MARK} alt="" width="14" height="14"/></span><b>Ace</b>{message.status==='done'&&<time>{clock(message.at)}</time>}</div>
        <Reply message={message} onAsk={ask} onRetry={()=>retry(message)}/>
       </li>)}
     </ol>}
    </div>
    <footer className="ace-dock">
     {chips.length>0&&!busy&&<div className="ace-chips" aria-label={chatting?'Follow-up questions':'Example questions'}>
      {chips.map((text,index)=><button key={text} type="button" style={{'--i':index}} onClick={()=>ask(text)}>{text}</button>)}
     </div>}
     <form className="ace-composer" onSubmit={submit} autoComplete="off" data-busy={busy||undefined}>
      <textarea ref={field} rows={1} value={draft} onChange={event=>setDraft(event.target.value)} onKeyDown={keys} maxLength={200}
       placeholder={chatting?'Ask a follow-up':'Ask about a player or a prop'} aria-label="Ask the Ace Assistant" enterKeyHint="send" spellCheck={false} autoCorrect="off"/>
      <VoiceButton onWords={setDraft} onSaid={text=>{if(text)ask(text);}} disabled={busy}/>
      <button type="submit" className="ace-send" disabled={busy||!draft.trim()} aria-label={busy?'Researching':'Send'}>
       {busy?<span className="ace-spinner" aria-hidden="true"/>:<ArrowUp size={18} aria-hidden="true"/>}
      </button>
     </form>
     <small className="ace-fine">Grades come from today's board and recent games. Not a guarantee. Play responsibly.</small>
    </footer>
   </main>

   <aside className="ace-side" aria-label="Today's board">
    <section><h3>Today's board</h3><Board today={today} failed={todayFailed}/></section>
    <section><h3>Top plays</h3><TopPlays plays={plays} onAsk={ask} loading={!today&&!todayFailed} disabled={busy}/></section>
    {recent.length>0&&<section><h3>You asked</h3><ul className="ace-recent">{recent.map(text=><li key={text}>
     <button type="button" onClick={()=>ask(text)} disabled={busy}><Clock3 size={14} aria-hidden="true"/><span>{text}</span></button></li>)}</ul></section>}
   </aside>
  </div>
 </div>;
}
