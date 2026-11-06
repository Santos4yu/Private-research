// The Game Predictor (game_predictor.py through /api/prediction
// action=game-*), one full page (Nov 6, the owner: "I hate how it's all
// floating I want to look like a full page not random floating islands"):
// a header with the record and the league, then three tabs.
//  - Predict: the slate by day; tapping a game opens its own page (Nov 6,
//    the owner: "a page when we click on it not a dropdown ... not just a
//    long scroll down page ... make tabs in the game page"): the two teams
//    and their chance now, then Chance, Odds, Why and Players tabs.
//  - Generator: a day (today to six days ahead), the NBA, the NFL or both,
//    the most likely winners that day and moneyline parlays by payout or by
//    legs (the owner: "a moneyline generator for certain days").
//  - History: only the picks the member saves (Nov 6, the owner: "only if
//    I add the prediction"), settled, with what each won or lost.
// A game's chance chart moves with the odds (ESPN's lines, sampled; in a
// game ESPN's win probability after every play), read again every few
// seconds. Tapping a team's price opens a full-screen pick (the owner: "the
// slide up should be a full screen. That's how Polymarket looks"): an amount
// on a keypad, what it wins, and swipe up to save it to the history.
// A section the admin switches on (site_controls 'predictor'), off until then.
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {AlertTriangle,ArrowLeft,BookOpen,CalendarDays,Check,ChevronDown,ChevronRight,ChevronUp,Delete,Info,Layers,RefreshCw,Share,Trophy,UserX,X} from 'lucide-react';
import {useIsAdmin} from './admin-notice.js';
import {useInk,inkStyle} from './use-ink.js';
import {SPORTS,americanOf,byText,cents,chartFrame,chartPath,clockText,dayOptions,decimal,evText,groupByDay,keyInjuries,likeliest,inkOn,lineText,marketNote,mergeBoards,moneyText,odds,pairColors,parlays,paysText,pct,pull,readGuide,recordText,resultOf,sideSeries,startText,twoCalls,unitsText,valueRows,winOf} from './game-predictor-core.js';
import {shareMoneyline} from './game-share.js';
import './game-predictor.css';

const read=(key,ok,fallback)=>{try{const value=localStorage.getItem(key);return ok(value)?value:fallback;}catch{return fallback;}};
const save=(key,value)=>{try{localStorage.setItem(key,value);}catch{/* a preference only */}};
const VIEWS=[['predict','Predict'],['generate','Generator'],['history','History']];
const LEAGUES=[['nba','NBA'],['nfl','NFL'],['both','Both']];

async function call(params,signal){
 const response=await fetch(`/api/prediction?${new URLSearchParams(params)}`,{signal,cache:'no-store',credentials:'same-origin'});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.error)throw new Error(data.error||'The predictor is unavailable right now.');
 return data;
}

async function post(action,body){
 const response=await fetch(`/api/prediction?action=${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin'});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.error)throw new Error(data.error||'That didn\'t save. Try again.');
 return data;
}

// One open game's chart, read again every 15 seconds in a game, every
// minute before it (and not while the page is hidden).
function useChart(sport,event){
 const [chart,setChart]=useState(null);
 const live=useRef(false);
 useEffect(()=>{
  if(!event)return undefined;
  let stop=false,timer=null;
  const next=()=>{if(!stop)timer=setTimeout(load,live.current?15000:60000);};
  const load=()=>{
   if(document.visibilityState==='hidden'){timer=setTimeout(load,5000);return;}
   call({action:'game-chart',sport,event}).then(data=>{if(stop)return;live.current=data.state==='in';setChart(data);}).catch(()=>{}).finally(next);
  };
  load();
  return()=>{stop=true;clearTimeout(timer);};
 },[sport,event]);
 return chart;
}

function Logo({team,size=28}){
 const [bad,setBad]=useState(false);
 return team?.logo&&!bad?<img className="gp-logo" src={team.logo} alt="" width={size} height={size} style={{width:size,height:size}} onError={()=>setBad(true)}/>
  :<span className="gp-logo gp-logo-empty" style={{width:size,height:size}}>{String(team?.abbr||'').slice(0,3)}</span>;
}

// A row of choices with one soft pill gliding to the picked one.
function Segmented({options,value,onChange,label,wide}){
 const row=useRef(null),ink=useInk(row,value,'[aria-checked=true]');
 return <div className={`gp-seg${wide?' is-wide':''}`} role="radiogroup" aria-label={label} ref={row}>
  <span className="gp-seg-ink" style={inkStyle(ink)} aria-hidden="true"/>
  {options.map(([key,text])=><button type="button" role="radio" key={key} aria-checked={value===key} onClick={()=>onChange(key)}>{text}</button>)}
 </div>;
}

function Tabs({value,onChange}){
 const row=useRef(null),ink=useInk(row,value,'[aria-selected=true]');
 return <nav className="gp-tabs" role="tablist" aria-label="Game Predictor" ref={row}>
  {VIEWS.map(([key,text])=><button type="button" role="tab" key={key} aria-selected={value===key} onClick={()=>onChange(key)}>{text}</button>)}
  <span className="gp-tabs-ink" style={inkStyle(ink)} aria-hidden="true"/>
 </nav>;
}

const Shimmer=({rows=4,tall})=><div className={`gp-shimmer${tall?' is-tall':''}`} role="status" aria-label="Loading">{Array.from({length:rows},(_,index)=><span key={index} style={{'--i':index}}/>)}</div>;
const Empty=({icon:Icon=CalendarDays,title,text,children})=><div className="gp-empty"><Icon size={22} aria-hidden="true"/><b>{title}</b>{text&&<p>{text}</p>}{children}</div>;

// ------------------------------------------------------------------ predict

// The slate by day; tapping a game opens its own page (Nov 6, the owner:
// "Make them a page when we click on it not a dropdown").
function PredictView({slate,onOpen,admin,onRetry}){
 const games=slate.games||[];
 if(slate.loading&&!games.length)return <Shimmer rows={5}/>;
 if(slate.error&&!games.length)return <Empty icon={RefreshCw} title="The games can't load right now" text={admin?slate.error:null}>
  <button type="button" className="gp-soft" onClick={onRetry}><RefreshCw size={15} aria-hidden="true"/>Try again</button></Empty>;
 if(!games.length)return <Empty title="No games on the schedule" text="Check back closer to the next games."/>;
 return <div className="gp-days">{groupByDay(games).map(day=><section key={day.key} className="gp-day">
  <h3 className="gp-day-head">{day.label}<small>{day.games.length} {day.games.length===1?'game':'games'}</small></h3>
  <ul className="gp-games">{day.games.map((game,index)=>{const live=game.state==='in';
   const team=side=><span className="gp-team"><Logo team={game[side]} size={30}/><span><b>{game[side]?.abbr}</b>{game[side]?.record&&<small>{game[side].record}</small>}</span></span>;
   return <li key={game.id} className="gp-game" style={{'--i':index}}>
    <button type="button" className="gp-game-row" onClick={()=>onOpen(game)}>
     <span className="gp-matchup">{team('away')}<i>@</i>{team('home')}</span>
     <span className="gp-game-meta">{live?<em className="gp-live">Live</em>:<b>{clockText(game.startsAt)}</b>}{lineText(game)&&<small>{lineText(game)}</small>}</span>
     <ChevronRight className="gp-chev" size={18} aria-hidden="true"/>
    </button>
   </li>;})}</ul>
 </section>)}</div>;
}

// The pick or parlay as a picture (game-share.js): the phone's share sheet
// (Copy, Save, Messages), a computer's clipboard, else a download.
function ShareButton({legs,stake,label,className='gp-share',icon=false}){
 const [state,setState]=useState(null);
 const run=async()=>{
  if(state==='busy')return;
  setState('busy');
  try{const done=await shareMoneyline({legs,stake});setState(done==='copied'?'Copied':done==='saved'?'Saved':null);}
  catch{setState(null);}
  setTimeout(()=>setState(old=>old==='busy'?old:null),1800);
 };
 return <button type="button" className={className} onClick={run} disabled={state==='busy'} aria-label={label}>
  {state==='Copied'||state==='Saved'?<Check size={icon?19:16} aria-hidden="true"/>:<Share size={icon?19:16} aria-hidden="true"/>}
  {!icon&&<span>{state==='Copied'||state==='Saved'?state:state==='busy'?'Making it…':'Share'}</span>}
 </button>;
}

const Section=({title,icon:Icon,children,className=''})=><section className={`gp-sec ${className}`}>
 {title&&<h4 className="gp-sec-head">{Icon&&<Icon size={15} aria-hidden="true"/>}{title}</h4>}{children}
</section>;
const teamColor=team=>/^[0-9a-f]{6}$/i.test(team?.color||'')?`#${team.color}`:null;
// Each team's chance now: ESPN's live win probability in a game, else the
// market's (the latest line), else the prediction's.
function chancesNow(prediction,chart){
 const live=chart?.live||[],market=chart?.market||[];
 const home=live.length?live[live.length-1][1]:chart?.now?.market??(market.length?market[market.length-1][1]:prediction?.market?.chance?.home??prediction?.chance?.home);
 return home==null?null:{home,away:1-home};
}

const GAME_TABS=[['chance','Chance'],['odds','Odds'],['why','Why'],['players','Players']];
// One game's page: the two teams and their chance now, then four tabs.
//  - Chance: both teams' chance over time (the market's from ESPN's lines,
//    in a game ESPN's win probability), our pick, and a button each.
//  - Odds: the moneylines in cents and prices with their value, the line,
//    our model alone and with it.
//  - Why: the short version in plain words (who we pick and why: the
//    offense against the defense with their ranks, the player to watch, who's
//    out that matters), then what to check, the injuries that matter, what
//    moves our number, and how to read the numbers.
//  - Players: each side's best matchup and the teams side by side.
// The page has its own background (Nov 6, the owner: "a background tho so
// it's not just transparent"): the site's dark with each team's color in its
// top corner, and both teams always in colors that don't look alike.
function GamePage({game,sport,result,admin,onBack,onPick}){
 const [tab,setTab]=useState('chance');
 const chart=useChart(sport,game.id);
 const raw=result?.data;
 const colors=pairColors(raw?.home||game.home,raw?.away||game.away);
 const prediction=useMemo(()=>raw&&{...raw,home:{...raw.home,color:colors.home},away:{...raw.away,color:colors.away}},[raw,colors.home,colors.away]);
 const live=(chart?.state||game.state)==='in';
 const now=chancesNow(prediction,chart);
 const home=prediction?.home||game.home,away=prediction?.away||game.away;
 const status=live?<><i className="gp-pulse" aria-hidden="true"/>{chart?.detail||'Live'}</>:(chart?.state||game.state)==='post'?'Final':startText(game.startsAt);
 const tabsRow=useRef(null),ink=useInk(tabsRow,tab,'[aria-selected=true]');
 const row=(side,team)=>{const color=teamColor({color:colors[side]});const score=chart?.[side]?.score;
  return <li style={color?{'--team':color}:undefined}>
   <Logo team={team} size={32}/>
   <span className="gp-board-name"><b>{team.name||team.short||team.abbr}</b><small>{team.record||team.abbr}</small></span>
   {(live||chart?.state==='post')&&score!=null&&<strong className="gp-board-score">{score}</strong>}
   <strong className="gp-board-pct">{now?pct(now[side]):'—'}</strong>
  </li>;};
 const tint=hex=>/^[0-9a-f]{6}$/i.test(hex||'')?`#${hex}`:'transparent';
 return <>
 <div className="gp-page-bg" style={{'--home':tint(colors.home),'--away':tint(colors.away)}} aria-hidden="true"/>
 <div className="gp-page">
  <header className="gp-page-top">
   <button type="button" className="gp-back" onClick={onBack} aria-label="Back to the games"><ArrowLeft size={20}/></button>
   <div><b>{away.abbr} @ {home.abbr}</b><small>{status}</small></div>
   <span className="gp-back-space" aria-hidden="true"/>
  </header>
  <ul className="gp-board">{row('away',away)}{row('home',home)}</ul>
  <nav className="gp-tabs gp-page-tabs" role="tablist" aria-label="This game" ref={tabsRow}>
   {GAME_TABS.map(([key,text])=><button type="button" role="tab" key={key} aria-selected={tab===key} onClick={()=>setTab(key)}>{text}</button>)}
   <span className="gp-tabs-ink" style={inkStyle(ink)} aria-hidden="true"/>
  </nav>
  <div className="gp-page-body" key={tab}>
   {result?.loading&&!prediction?<Shimmer rows={3} tall/>
   :result?.error&&!prediction?<p className="gp-note gp-page-note">{admin?result.error:'There isn\'t enough on this game yet. Try again closer to the start.'}</p>
   :prediction?<>
    {tab==='chance'&&<ChanceTab prediction={prediction} chart={chart} onPick={onPick}/>}
    {tab==='odds'&&<OddsTab prediction={prediction} chart={chart} onPick={onPick}/>}
    {tab==='why'&&<><Story prediction={prediction}/><Warnings prediction={prediction}/><WhosOut prediction={prediction}/>
     <Factors prediction={prediction}/><ReadGuide prediction={prediction} chart={chart}/></>}
    {tab==='players'&&<><Players prediction={prediction}/><Compare prediction={prediction}/></>}
   </>:null}
  </div>
 </div>
 </>;
}

// Both teams' chance over time (Nov 6, the owner, with DraftKings' game
// chart: "look how nice theirs looks love that"): dotted lines every 15
// points labeled down the right side, a line each in its team's color
// running up to now with a dot where it ends, and there the team in a small
// label in its color with its chance big under it. A touch reads both.
const W=600,H=190,PLOT='(100% - 112px)';
function TwoLineChart({prediction,chart}){
 const host=useRef(null);
 const [hover,setHover]=useState(null);
 const nowT=Date.now()/1000;
 const live=chart?.live||[],market=chart?.market||[];
 const fallback=prediction.market?.chance?.home??prediction.chance.home;
 const inGame=live.length>1;
 const raw=inGame?live:market.length?market:[[nowT-3600,fallback]];
 // The price stands until it moves: before the game, the line runs on to now at the latest price.
 const latest=inGame?null:chart?.now?.market??raw[raw.length-1][1];
 const base=latest!=null&&raw[raw.length-1][0]<nowT-30?[...raw,[nowT,latest]]:raw;
 const series={home:sideSeries(base,'home'),away:sideSeries(base,'away')};
 const frame=chartFrame([series.home,series.away]);
 if(!frame)return null;
 const step=0.15,below=Math.min(frame.low,0.35),above=Math.max(frame.high,0.65);
 const low=Math.max(0,0.5-step*Math.ceil((0.5-below)/step-1e-9)),high=Math.min(1,0.5+step*Math.ceil((above-0.5)/step-1e-9));
 const box={...frame,low,high,end:Math.max(frame.end,nowT)};
 const grid=[];for(let value=low;value<=high+1e-9;value+=step)grid.push(Math.round(value*100)/100);
 const y=value=>(1-(value-box.low)/(box.high-box.low))*100;
 const pick=event=>{
  const rect=host.current?.getBoundingClientRect();if(!rect)return;
  const span=Math.max(1,rect.width-112);
  const t=box.start+(Math.min(Math.max(event.clientX-rect.left,0),span)/span)*(box.end-box.start);
  let found=base[0];for(const point of base){if(point[0]<=t)found=point;else break;}
  setHover({x:(found[0]-box.start)/(box.end-box.start||1),home:found[1],t:found[0]});
 };
 const last=base[base.length-1][1];
 const ends={home:last,away:1-last};
 // Two labels never overlap: pushed apart when the chances are close.
 const gap=Math.abs(y(ends.home)-y(ends.away))<26;
 const labelY=side=>{const value=y(ends[side]);if(!gap)return value;const up=ends[side]>=ends[side==='home'?'away':'home'];return up?Math.min(value,y(0.5)-13):Math.max(value,y(0.5)+13);};
 const colorOf=side=>teamColor(prediction[side]);
 return <div className="gp-chart2" ref={host} onPointerMove={pick} onPointerDown={pick} onPointerLeave={()=>setHover(null)}
  style={{'--home':colorOf('home')||'#e9e9e9','--away':colorOf('away')||'#8f8f8f','--home-ink':inkOn(prediction.home?.color),'--away-ink':inkOn(prediction.away?.color)}}>
  {grid.map(value=><span key={value} className="gp-chart-rule" style={{top:`${y(value)}%`}}><small>{Math.round(value*100)}%</small></span>)}
  <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${prediction.away.abbr} ${pct(ends.away)}, ${prediction.home.abbr} ${pct(ends.home)}`}>
   {['away','home'].map(side=><path key={side} className={`gp-chart2-line is-${side}`} d={chartPath(series[side],box,W,H)}/>)}
  </svg>
  {['away','home'].map(side=><React.Fragment key={side}>
   <i className={`gp-chart2-dot is-${side}`} style={{top:`${y(ends[side])}%`}} aria-hidden="true"/>
   <span className={`gp-chart2-end is-${side}`} style={{top:`${labelY(side)}%`}}>
    <small>{prediction[side].abbr}</small><b>{pct(ends[side])}</b>
   </span>
  </React.Fragment>)}
  {hover&&<><span className="gp-chart-cross" style={{left:`calc(${PLOT} * ${hover.x})`}}/>
   <span className="gp-chart-tip" style={{left:`calc(${PLOT} * ${Math.min(Math.max(hover.x,0.2),0.8)})`}}>
    <span>{prediction.away.abbr} <b>{pct(1-hover.home)}</b> · {prediction.home.abbr} <b>{pct(hover.home)}</b></span>{clockText(new Date(hover.t*1000).toISOString())}
   </span></>}
 </div>;
}

// A button for each team: its price in cents and the book's own odds
// (DraftKings' -241 / +199: the same price), tapped to pick it.
function PickButtons({prediction,chart,onPick}){
 const open=prediction.state==='pre'&&(chart?.state||'pre')==='pre';
 return <div className="gp-pick-buttons">{['away','home'].map(side=>{const team=prediction[side];
  const price=chart?.now?.moneyline?.[side]??prediction.market?.moneyline?.[side];
  const homeNow=chart?.now?.market;const marketChance=homeNow!=null?(side==='home'?homeNow:1-homeNow):prediction.market?.chance?.[side];
  const color=teamColor(team);
  return <button type="button" key={side} className="gp-buy" style={color?{'--team':color}:undefined} disabled={!open||price==null}
   onClick={()=>onPick(side,{price,marketChance})}>
   <span>{team.abbr}</span><b>{cents(marketChance)}</b>{price!=null&&<small>{odds(price)}</small>}
  </button>;})}</div>;
}

function ChanceTab({prediction,chart,onPick}){
 const side=prediction.winner,team=prediction[side];
 const live=chart?.state==='in'&&(chart?.live||[]).length>1;
 return <>
  <section className="gp-sec gp-chance-sec">
   <span className="gp-kicker">{live?'Live win chance':'Market chance'}</span>
   <TwoLineChart prediction={prediction} chart={chart}/>
   {!live&&marketNote(chart,prediction)&&<p className="gp-chart-note">{marketNote(chart,prediction)}</p>}
   <PickButtons prediction={prediction} chart={chart} onPick={onPick}/>
  </section>
  <section className="gp-sec gp-ourpick" style={teamColor(team)?{'--team':teamColor(team)}:undefined}>
   <span className="gp-kicker">Our pick</span>
   <div className="gp-ourpick-row">
    <Logo team={team} size={34}/>
    <span><b>{team.short||team.abbr}</b><small>{prediction.confidence} confidence</small></span>
    <strong>{pct(prediction.chance[side])}</strong>
   </div>
   {prediction.score&&<p className="gp-ourpick-score">Final score <b>{prediction.away.abbr} {prediction.score.away} – {prediction.score.home} {prediction.home.abbr}</b></p>}
  </section>
 </>;
}

function OddsTab({prediction,chart,onPick}){
 const market=prediction.market||{};
 return <>
  <Value prediction={prediction}/>
  {(market.spread!=null||market.total!=null)&&<Section title="The line">
   <dl className="gp-views gp-views-flat">
    {market.spread!=null&&<div><dt>Spread</dt><dd>{byText(-market.spread,prediction)}</dd></div>}
    {market.total!=null&&<div><dt>Total</dt><dd>{market.total}</dd></div>}
    {prediction.espn&&<div><dt>ESPN</dt><dd>{prediction.espn.home>=0.5?prediction.home.abbr:prediction.away.abbr} {pct(Math.max(prediction.espn.home,prediction.espn.away))}</dd></div>}
   </dl>
  </Section>}
  <TwoCalls prediction={prediction}/>
  <Section><PickButtons prediction={prediction} chart={chart} onPick={onPick}/></Section>
 </>;
}

// Swipe up to save (Polymarket's "swipe to buy"). The bar follows the
// finger up and down as it moves (Nov 6, the owner: "actually move up and
// down smoothly when am swiping on it"): written straight to the bar each
// frame, no spring while dragging; a little give below its rest and past
// the line. Let go past the line and it flies up and saves; short of it, it
// springs back. A tap only nudges it; Enter or Space saves from the keyboard.
function SwipeBar({onDone,disabled,label,armedLabel,sub}){
 const bar=useRef(null),from=useRef(null),lift=useRef(0),frame=useRef(0);
 const [hint,setHint]=useState(false),[armed,setArmed]=useState(false);
 const LIMIT=110;
 const paint=value=>{
  lift.current=value;
  cancelAnimationFrame(frame.current);
  frame.current=requestAnimationFrame(()=>{const node=bar.current;if(!node)return;
   node.style.setProperty('--lift',`${value}px`);node.style.setProperty('--progress',String(Math.max(0,Math.min(1,value/LIMIT))));});
 };
 useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
 const down=event=>{
  if(disabled)return;
  from.current=event.clientY;bar.current.dataset.dragging='';
  event.currentTarget.setPointerCapture?.(event.pointerId);
 };
 const move=event=>{
  if(from.current==null)return;
  event.preventDefault();
  const raw=from.current-event.clientY;
  // Rubber-banded: a quarter of the pull below rest, a third past the line.
  const value=raw<0?Math.max(-28,raw*0.25):raw<=LIMIT?raw:LIMIT+(raw-LIMIT)*0.35;
  paint(value);
  const now=value>=LIMIT;
  setArmed(old=>old===now?old:now);
 };
 const up=()=>{
  if(from.current==null)return;
  from.current=null;delete bar.current.dataset.dragging;setArmed(false);
  if(lift.current>=LIMIT){
   navigator.vibrate?.(12);
   bar.current.dataset.flying='';paint(window.innerHeight);
   setTimeout(onDone,260);
   return;
  }
  if(Math.abs(lift.current)<6){setHint(true);setTimeout(()=>setHint(false),650);}
  paint(0);
 };
 // A new attempt after a failed save starts from rest.
 useEffect(()=>{if(!disabled&&bar.current?.dataset.flying!==undefined){delete bar.current.dataset.flying;paint(0);}},[disabled]);
 return <button type="button" ref={bar} className="gp-swipebar" disabled={disabled} data-hint={hint?'':undefined} data-armed={armed?'':undefined}
  aria-label={`${label}: swipe up, or press Enter`}
  onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
  onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!disabled)onDone();}}}>
  <ChevronUp size={22} aria-hidden="true"/><b>{armed&&armedLabel?armedLabel:label}</b>{sub&&<small>{sub}</small>}
 </button>;
}

// The pick, full screen (Polymarket's order screen): the amount in big
// numbers with a keypad, what it wins, then swipe up; saved, the screen
// turns the team's color with what was picked.
const QUICK=[10,25,50,100];
const KEYS=['1','2','3','4','5','6','7','8','9','.','0','back'];
function PickScreen({pick,onClose,onSaved}){
 const {prediction,side}=pick;
 const team=prediction[side],other=prediction[side==='home'?'away':'home'];
 const price=pick.now?.price??prediction.market?.moneyline?.[side];
 const marketChance=pick.now?.marketChance??prediction.market?.chance?.[side];
 const [stake,setStake]=useState('');
 const [phase,setPhase]=useState('idle');
 const [error,setError]=useState(null);
 const [shown,setShown]=useState(false);
 const press=key=>setStake(old=>{
  if(key==='back')return old.slice(0,-1);
  if(key==='.')return old.includes('.')?old:(old||'0')+'.';
  const next=(old==='0'?'':old)+key;
  return /^\d{0,6}(\.\d{0,2})?$/.test(next)?next:old;
 });
 useEffect(()=>{
  const frame=requestAnimationFrame(()=>setShown(true));
  const key=event=>{
   if(event.key==='Escape')close();
   else if(/^[0-9.]$/.test(event.key))press(event.key);
   else if(event.key==='Backspace')press('back');
  };
  document.addEventListener('keydown',key);
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',key);document.body.style.overflow=overflow;};
 },[]);
 const close=()=>{setShown(false);setTimeout(onClose,360);};
 const amount=Number(stake)>0?Number(stake):null;
 const win=winOf(amount,price);
 const save=()=>{
  if(phase==='saving')return;
  setPhase('saving');setError(null);
  post('game-save',{sport:prediction.sport,event:prediction.id,side,stake:amount}).then(data=>{setPhase('saved');onSaved?.(data.pick);})
   .catch(failure=>{setPhase('idle');setError(failure.message);});
 };
 const color=teamColor(team);
 return createPortal(<div className={`gp-screen${shown?' is-open':''}${phase==='saved'?' is-saved':''}`} role="dialog" aria-modal="true"
  aria-label={`Pick ${team.short||team.abbr}`} style={color?{'--team':color}:undefined}>
  {phase==='saved'?<div className="gp-screen-done">
   <div className="gp-done-top">
    <button type="button" className="gp-screen-x" aria-label="Close" onClick={close}><X size={20}/></button>
    <ShareButton icon className="gp-screen-x gp-done-share" label={`Share the ${team.abbr} pick as a picture`} stake={amount}
     legs={[{team,opponent:other,home:side==='home',price,chance:prediction.chance?.[side],startsAt:prediction.startsAt,sport:prediction.sport}]}/>
   </div>
   <div className="gp-done-main">
    <Logo team={team} size={56}/>
    <small>{prediction.away.abbr} @ {prediction.home.abbr}</small>
    <h3>You picked <span>{team.short||team.abbr}</span></h3>
   </div>
   <dl className="gp-done-rows">
    <div><dt>Amount</dt><dd>{amount?moneyText(amount):'1 unit'}</dd></div>
    <div><dt>Odds</dt><dd>{cents(marketChance)} · {odds(price)}</dd></div>
    <div><dt>To win</dt><dd>{win!=null?moneyText(win,true):`${decimal(price)?`+${(decimal(price)-1).toFixed(2)}`:'—'} units`}</dd></div>
    <div className="is-big"><dt>Payout</dt><dd>{win!=null?moneyText(win+amount):decimal(price)?`${decimal(price).toFixed(2)} units`:'—'}</dd></div>
   </dl>
   <button type="button" className="gp-done-ok" onClick={close}>Done</button>
  </div>:<>
   <header className="gp-screen-top">
    <button type="button" className="gp-screen-x" aria-label="Close" onClick={close}><X size={20}/></button>
    <div><Logo team={team} size={30}/><span><small>{prediction.away.abbr} @ {prediction.home.abbr} · {startText(prediction.startsAt)}</small><b>{team.short||team.abbr} to win</b></span></div>
    <span className="gp-back-space" aria-hidden="true"/>
   </header>
   <div className="gp-screen-amount">
    <p className={`gp-amount-big${stake?'':' is-empty'}`}>${stake||'0'}</p>
    <p className="gp-amount-win">{win!=null?<>To win <b>{moneyText(win)}</b></>:'Enter an amount, or save it as one unit'}</p>
    <small>Price {cents(marketChance)} · {odds(price)} · our chance {pct(prediction.chance[side])}</small>
   </div>
   <div className="gp-chips gp-screen-chips">{QUICK.map(value=><button type="button" key={value} onClick={()=>setStake(old=>String(Math.round(((Number(old)||0)+value)*100)/100))}>+${value}</button>)}</div>
   <div className="gp-keypad">{KEYS.map(key=><button type="button" key={key} onClick={()=>press(key)} aria-label={key==='back'?'Delete':key}>
    {key==='back'?<Delete size={22} aria-hidden="true"/>:key}</button>)}</div>
   {error&&<p className="gp-note gp-screen-error" data-tone="down">{error}</p>}
   <SwipeBar onDone={save} disabled={phase==='saving'||price==null} label={phase==='saving'?'Saving…':`Swipe up to pick ${team.abbr}`}
    armedLabel={`Release to pick ${team.abbr}`}
    sub={`${side==='home'?'vs':'@'} ${other.abbr} · saved to your history`}/>
  </>}
 </div>,document.body);
}

// Our model alone beside it blended with the line.
function TwoCalls({prediction}){
 const calls=twoCalls(prediction);
 if(!calls)return null;
 const call=(item,label,note)=>{const team=prediction[item.winner];return <div className="gp-call">
  <span className="gp-call-label">{label}{note&&<small>{note}</small>}</span>
  <b><Logo team={team} size={22}/>{team.abbr} {pct(item.chance[item.winner])}</b>
  <small>{byText(item.margin,prediction)}{item.score?` · ${item.score.away}-${item.score.home}`:''}</small>
 </div>;};
 return <Section className="gp-calls">{call(calls.ours,'Our model')}{call(calls.blend,'With the line',calls.share)}</Section>;
}

// Each moneyline: its price, the chance we give it and what a dollar on it is worth.
function Value({prediction}){
 const rows=valueRows(prediction);
 if(!rows.length)return null;
 return <Section title={prediction.market?.provider==='DraftKings'?'DraftKings moneylines':'Moneyline value'}>
  <ul className="gp-rows">{rows.map(row=><li key={row.side} className="gp-value" data-best={row.best?'':undefined}>
   <Logo team={row.team} size={26}/>
   <span><b>{row.team.abbr} <em>{row.price}</em></b><small>{row.chance} to win · fair {row.fair}</small></span>
   <strong data-tone={row.ev>0?'up':'down'}>{row.text}</strong>
  </li>)}</ul>
 </Section>;
}

// The short version, in plain words (Nov 6, the owner: "for people who
// don't understand like odds ... easy to understand ... defensive rankings,
// injuries only the injuries that matter"). Written by the server
// (game_predictor.story): one short paragraph a point, each with its label.
const STORY_TAGS={chance:'The odds',teams:'Offense vs defense',player:'Player to watch',injuries:'Injuries',home:'Home and away',extras:'Also',confidence:'How sure we are'};
function Story({prediction}){
 const story=prediction.story;
 if(!story)return null;
 const team=prediction[prediction.winner],color=teamColor(team);
 return <section className="gp-sec gp-story" style={color?{'--team':color}:undefined}>
  <p className="gp-story-lead"><Logo team={team} size={26}/><b>{story.headline}</b></p>
  <ul className="gp-story-list">{story.points.map((point,index)=><li key={index} style={{'--i':index}}>
   <span>{STORY_TAGS[point.key]||''}</span><p>{point.text}</p>
  </li>)}</ul>
 </section>;
}

// Every term on the page in plain words, with this game's own numbers; closed until asked for.
function ReadGuide({prediction,chart}){
 const rows=readGuide(prediction,chart);
 if(!rows.length)return null;
 return <details className="gp-sec gp-guide">
  <summary><BookOpen size={15} aria-hidden="true"/><b>New to odds? How to read these numbers</b><ChevronDown size={16} aria-hidden="true"/></summary>
  <dl>{rows.map(row=><div key={row.term}><dt>{row.term}</dt><dd>{row.text}</dd></div>)}</dl>
 </details>;
}

function Warnings({prediction}){
 // A questionable player's "if he sits" is in the short version already.
 const items=(prediction.warnings||[]).filter(item=>!(item.level==='info'&&/if he sits/.test(item.text)));
 if(!items.length)return null;
 return <Section title="Check first" icon={AlertTriangle} className="gp-warnings">
  <ul>{items.map((item,index)=><li key={index} data-level={item.level}>
   {item.level==='info'?<Info size={15} aria-hidden="true"/>:<AlertTriangle size={15} aria-hidden="true"/>}<span>{item.text}</span>
  </li>)}</ul>
 </Section>;
}

function Factors({prediction}){
 const rows=(prediction.factors||[]).filter(item=>Math.abs(item.points)>=0.05||item.key==='ratings');
 if(!rows.length)return null;
 return <Section title="What moves our number">
  <ul className="gp-rows">{rows.map(item=>{const side=pull(item.points,prediction);return <li key={item.key} className="gp-factor">
   <span><b>{item.label}</b>{item.text&&<small>{item.text}</small>}</span>
   <span className="gp-pull" data-side={side.side||'even'}>{side.side&&<Logo team={prediction[side.side]} size={16}/>}{side.text}</span>
  </li>;})}</ul>
 </Section>;
}

// Only the injuries that matter (keyInjuries); the rest of the report is a count.
function WhosOut({prediction}){
 const out=prediction.out;
 if(!out)return null;
 const sides=['away','home'].map(side=>({side,...keyInjuries(out[side],prediction.sport)}));
 const rest=prediction.sport==='nfl'?'none at QB, RB, WR or TE':'none in the rotation';
 return <Section title="Injuries that matter" icon={UserX}>
  <div className="gp-two">{sides.map(({side,shown,others})=><div key={side}>
   <p className="gp-team-head"><Logo team={prediction[side]} size={20}/>{prediction[side].short||prediction[side].abbr}</p>
   {shown.length?<ul className="gp-out">{shown.slice(0,5).map((player,index)=><li key={index} data-out={player.out?'':undefined}>
    <span><b>{player.name}</b><small>{[player.position,player.status,player.injury].filter(Boolean).join(' · ')}</small></span>
    {player.impact>0&&<em>−{player.impact} pts</em>}
   </li>)}</ul>:<p className="gp-note">Nobody who matters.</p>}
   {others>0&&<p className="gp-note gp-out-more">{others} more on the report, {rest}.</p>}
  </div>)}</div>
 </Section>;
}

const STAT_NAMES={pts:'PTS',reb:'REB',ast:'AST',fantasy:'Fantasy'};
function Players({prediction}){
 const players=prediction.players||{};
 if(!players.home&&!players.away)return null;
 return <Section title="Best matchup on each team">
  <div className="gp-two">{['away','home'].map(side=>{const player=players[side];if(!player)return <div key={side}/>;
   const stats=prediction.sport==='nba'?['pts','reb','ast']:['fantasy','yards'];
   return <div key={side} className="gp-player">
    <div className="gp-player-head">
     {player.headshot?<img src={player.headshot} alt="" loading="lazy" onError={event=>{event.currentTarget.style.visibility='hidden';}}/>:<span className="gp-player-blank"/>}
     <span><b>{player.name}</b><small>{player.team} · {player.position}</small></span>
    </div>
    <div className="gp-player-stats">{stats.map(key=>{const up=(player.proj[key]??0)-(player.avg[key]??0);return <div key={key}>
     <span>{key==='yards'?player.yardsLabel:STAT_NAMES[key]}</span><b>{player.proj[key]}</b><small data-tone={up>=0.3?'up':up<=-0.3?'down':undefined}>avg {player.avg[key]}</small>
    </div>;})}</div>
    {player.why?.length>0&&<ul className="gp-why">{player.why.map(text=><li key={text}>{text}</li>)}</ul>}
   </div>;})}</div>
 </Section>;
}

function Compare({prediction}){
 const teams=prediction.teams;
 if(!teams)return null;
 const rank=value=>value?.[1]?<small>{value[1]}{['th','st','nd','rd'][value[1]%10>3||[11,12,13].includes(value[1]%100)?0:value[1]%10]}</small>:null;
 const cell=value=>value?.[0]==null?'—':<>{value[0]} {rank(value)}</>;
 const rest=days=>days==null?'—':days<=1?'Back-to-back':`${days} days`;
 const last=side=>{const games=prediction.lastFive?.[prediction[side].abbr]||[];return games.length?<span className="gp-form">{games.map((game,index)=><i key={index} data-result={game.result}>{game.result}</i>)}</span>:'—';};
 const rows=prediction.sport==='nba'?[
  ['Offense (pts / 100)',cell(teams.away.ortg),cell(teams.home.ortg)],
  ['Defense (allowed / 100)',cell(teams.away.drtg),cell(teams.home.drtg)],
  ['Pace',cell(teams.away.pace),cell(teams.home.pace)],
  ['Last 10',teams.away.last10?teams.away.last10.join('-'):'—',teams.home.last10?teams.home.last10.join('-'):'—'],
 ]:[
  ['Points a game',cell(teams.away.pf),cell(teams.home.pf)],
  ['Allowed a game',cell(teams.away.pa),cell(teams.home.pa)],
  ...(teams.away.epaOff?[['EPA a play',cell(teams.away.epaOff),cell(teams.home.epaOff)],
   ['EPA allowed a play',cell(teams.away.epaDef),cell(teams.home.epaDef)]]:[]),
  ['Plays a game',cell(prediction.pace?.away),cell(prediction.pace?.home)],
  ['Quarterback',teams.away.qb||'—',teams.home.qb||'—'],
 ];
 rows.push(['Last 5',last('away'),last('home')]);
 if(prediction.rest)rows.push(['Rest',rest(prediction.rest.away),rest(prediction.rest.home)]);
 return <Section title="Side by side">
  <table className="gp-table"><thead><tr><th/><th><Logo team={prediction.away} size={20}/>{prediction.away.abbr}</th><th><Logo team={prediction.home} size={20}/>{prediction.home.abbr}</th></tr></thead>
   <tbody>{rows.map(([label,away,home])=><tr key={label}><th scope="row">{label}</th><td>{away}</td><td>{home}</td></tr>)}</tbody></table>
 </Section>;
}

// ------------------------------------------------------------------ generator

const PAYOUTS=[2,3,5,10],LEG_COUNTS=[2,3,4];
const Chips=({options,value,onChange,label})=><div className="gp-chips" role="radiogroup" aria-label={label}>
 {options.map(([key,text])=><button type="button" role="radio" key={key} aria-checked={value===key} onClick={()=>onChange(key)}>{text}</button>)}
</div>;

function DayStrip({days,value,onChange}){
 const row=useRef(null),ink=useInk(row,value,'[aria-checked=true]');
 return <div className="gp-daystrip" role="radiogroup" aria-label="Day" ref={row}>
  <span className="gp-day-ink" style={inkStyle(ink)} aria-hidden="true"/>
  {days.map(day=><button type="button" role="radio" key={day.key} aria-checked={value===day.key} onClick={()=>onChange(day.key)}>
   <b>{day.top}</b><small>{day.date}</small>
  </button>)}
 </div>;
}

function Leg({leg,mixed}){
 return <li className="gp-leg">
  <Logo team={leg.team} size={28}/>
  <span><b>{leg.team.short||leg.team.abbr}</b><small>{mixed&&leg.sport?`${leg.sport.toUpperCase()} · `:''}{leg.home?'vs':'@'} {leg.opponent.abbr} · {clockText(leg.startsAt)}</small></span>
  <span className="gp-leg-num"><b>{pct(leg.chance)}</b><small>{odds(leg.price)}</small></span>
 </li>;
}

function Generator({league,admin}){
 const days=useMemo(()=>dayOptions(new Date(),7),[]);
 const [day,setDay]=useState(days[0].key);
 const [which,setWhich]=useState(league);
 const [mode,setMode]=useState('payout'),[payout,setPayout]=useState(2),[legs,setLegs]=useState(2),[sort,setSort]=useState('likely');
 const [state,setState]=useState({loading:true});
 const [tries,setTries]=useState(0);
 useEffect(()=>{
  const control=new AbortController();
  const sports=which==='both'?['nba','nfl']:[which];
  setState(old=>({loading:true,data:old.key===`${day}|${which}`?old.data:null,key:old.key}));
  Promise.allSettled(sports.map(sport=>call({action:'game-board',sport,day},control.signal))).then(found=>{
   if(control.signal.aborted)return;
   const boards=found.filter(item=>item.status==='fulfilled').map(item=>item.value);
   const failed=found.find(item=>item.status==='rejected');
   setState(boards.length?{data:mergeBoards(boards),key:`${day}|${which}`,partial:Boolean(failed)}:{error:failed?.reason?.message||'The generator is unavailable right now.'});
  });
  return()=>control.abort();
 },[day,which,tries]);
 const board=state.data;
 const top=useMemo(()=>likeliest(board,6),[board]);
 const combos=useMemo(()=>parlays(board,mode==='payout'?{payout,sort}:{legs,sort}),[board,mode,payout,legs,sort]);
 const games=board?.games||[],held=games.filter(game=>game.held).length;
 const dayName=(days.find(item=>item.key===day)||days[0]).top;
 const when=dayName==='Today'||dayName==='Tomorrow'?dayName.toLowerCase():`on ${dayName}`;
 return <div className="gp-gen">
  <div className="gp-controls">
   <DayStrip days={days} value={day} onChange={setDay}/>
   <div className="gp-control-row">
    <Segmented options={LEAGUES} value={which} onChange={setWhich} label="League"/>
    <Segmented options={[['likely','Most likely'],['value','Best value']]} value={sort} onChange={setSort} label="Order"/>
   </div>
   <div className="gp-control-row">
    <Segmented options={[['payout','Payout'],['legs','Legs']]} value={mode} onChange={setMode} label="Build by"/>
    {mode==='payout'?<Chips options={PAYOUTS.map(value=>[value,`${value}x+`])} value={payout} onChange={setPayout} label="Pays at least"/>
     :<Chips options={LEG_COUNTS.map(value=>[value,`${value} legs`])} value={legs} onChange={setLegs} label="Legs"/>}
   </div>
  </div>
  {state.loading&&!board?<Shimmer rows={5}/>
  :state.error&&!board?<Empty icon={RefreshCw} title="The generator can't load right now" text={admin?state.error:null}>
   <button type="button" className="gp-soft" onClick={()=>setTries(n=>n+1)}><RefreshCw size={15} aria-hidden="true"/>Try again</button></Empty>
  :!games.length?<Empty title={`No games ${when}`} text="Pick another day or league."/>
  :!top.length?<Empty title={`No moneylines ${when} yet`} text="The books usually post them the day before."/>
  :<div className={`gp-results${state.loading?' is-busy':''}`}>
   <section className="gp-pick">
    <div className="gp-pick-top"><span className="gp-kicker"><Trophy size={14} aria-hidden="true"/>Most likely to win {when}</span>
     <ShareButton legs={[top[0]]} label={`Share the ${top[0].team.abbr} moneyline as a picture`}/></div>
    <div className="gp-pick-main">
     <span className="gp-hero-logo"><Logo team={top[0].team} size={56}/></span>
     <span><b>{top[0].team.short||top[0].team.abbr}</b><small>{which==='both'?`${top[0].sport?.toUpperCase()} · `:''}{top[0].home?'vs':'@'} {top[0].opponent.abbr} · {clockText(top[0].startsAt)} · {top[0].confidence} confidence</small></span>
     <span className="gp-pick-num"><b>{pct(top[0].chance)}</b><small>{odds(top[0].price)}</small></span>
    </div>
   </section>
   {top.length>1&&<Section title="Next most likely"><ul className="gp-legs">{top.slice(1).map(leg=><Leg key={leg.game} leg={leg} mixed={which==='both'}/>)}</ul></Section>}
   <Section title={mode==='payout'?`Parlays paying ${payout}x or more`:`${legs}-leg parlays`} icon={Layers}>
    {combos.length?<ol className="gp-parlays">{combos.map((combo,index)=><li key={combo.legs.map(leg=>leg.game+leg.side).join()} style={{'--i':index}}>
     <div className="gp-parlay-head">
      <span className="gp-parlay-pays"><b>{paysText(combo.dec)}</b><small>{odds(americanOf(combo.dec))}</small></span>
      <span className="gp-parlay-hit"><span className="gp-meter" style={{'--w':combo.chance}}/><small>{pct(combo.chance)} to hit</small></span>
      <strong data-tone={combo.ev>0?'up':'down'}>{evText(combo.ev)}<small>value</small></strong>
      <ShareButton legs={combo.legs} label={`Share this ${combo.legs.length}-pick parlay as a picture`}/>
     </div>
     <ul className="gp-legs">{combo.legs.map(leg=><Leg key={leg.game} leg={leg} mixed={which==='both'}/>)}</ul>
    </li>)}</ol>:<p className="gp-note">{mode==='payout'?`No mix of these games pays ${payout}x.`:`Not enough games for ${legs} legs.`}</p>}
    {held>0&&<p className="gp-note">{held} {held===1?'game':'games'} left out: no moneyline yet, or data to check.</p>}
    {state.partial&&<p className="gp-note">One league couldn't load; these are the other's games.</p>}
   </Section>
  </div>}
 </div>;
}

// ------------------------------------------------------------------ history

function HistoryView({state,admin,onRetry,onRemove}){
 const {data,error,loading}=state;
 const record=data?.record;
 const items=data?.items||[];
 if(loading&&!data)return <Shimmer rows={5}/>;
 if(error&&!data)return <Empty icon={RefreshCw} title="Your picks can't load right now" text={admin?error:null}>
  <button type="button" className="gp-soft" onClick={onRetry}><RefreshCw size={15} aria-hidden="true"/>Try again</button></Empty>;
 return <div className="gp-history">
  {record?.games||record?.pending?<dl className="gp-stats">
   <div className="is-lead"><dt>Record</dt><dd>{record.correct}-{record.games-record.correct}<small>{record.games?pct(record.pct):''}</small></dd></div>
   {record.money?<div><dt>Profit</dt><dd data-tone={record.money.profit>0?'up':record.money.profit<0?'down':undefined}>{moneyText(record.money.profit,true)}<small>on {moneyText(record.money.staked)}</small></dd></div>:null}
   {record.units!=null?<div><dt>Units</dt><dd data-tone={record.units>0?'up':record.units<0?'down':undefined}>{unitsText(record.units)}</dd></div>:null}
   <div><dt>Pending</dt><dd>{record.pending}</dd></div>
  </dl>:null}
  {!items.length?<Empty icon={Trophy} title="No picks yet" text="Open a game, tap a team and swipe up to save it here."/>
  :<ul className="gp-history-list">{items.map((item,index)=>{const result=resultOf(item);const team=item[item.side]||{};const win=winOf(item.stake,item.price);
   return <li key={item.id} data-result={result} style={{'--i':Math.min(index,12)}}>
   <span className="gp-history-mark" aria-label={result}>{result==='win'?<Check size={14}/>:result==='loss'?<X size={14}/>:<i/>}</span>
   <span className="gp-history-game"><b><Logo team={team} size={18}/>{team.abbr} to win <em>{odds(item.price)}</em></b><small>{item.away.abbr} @ {item.home.abbr} · {startText(item.startsAt)}</small></span>
   <span className="gp-history-pick">{item.stake?<><b>{moneyText(item.stake)}</b><small>to win {moneyText(win)}</small></>:<><b>1 unit</b><small>{pct(item.chance)} our chance</small></>}</span>
   <span className="gp-history-final">{item.result?<><b data-tone={item.result.correct?'up':item.result.winner?'down':undefined}>{item.result.profit!=null?moneyText(item.result.profit,true):unitsText(item.result.units)}</b><small>{item.result.away}-{item.result.home}</small></>
    :<button type="button" className="gp-link-x" onClick={()=>onRemove(item)} aria-label={`Remove the ${team.abbr} pick`}><X size={15}/></button>}</span>
  </li>;})}</ul>}
 </div>;
}

// ------------------------------------------------------------------ the page

export function GamePredictor(){
 const admin=useIsAdmin();
 const [sport,setSport]=useState(()=>read('game-predictor-sport',value=>SPORTS.some(([key])=>key===value),'nba'));
 const [view,setView]=useState(()=>read('game-predictor-view',value=>VIEWS.some(([key])=>key===value),'predict'));
 const [slate,setSlate]=useState({loading:true,games:[]});
 const [history,setHistory]=useState({loading:true});
 const [open,setOpen]=useState(null);
 const mark=useRef(null),depth=useRef(0),listScroll=useRef(0);
 const [results,setResults]=useState({});
 const [tries,setTries]=useState(0);
 const [sheet,setSheet]=useState(null);
 useEffect(()=>{
  const control=new AbortController();
  setSlate(old=>({loading:true,games:old.sport===sport?old.games:[],sport}));setResults({});setOpen(null);
  call({action:'game-slate',sport},control.signal).then(data=>setSlate({games:data.games||[],sport}))
   .catch(error=>{if(error.name!=='AbortError')setSlate({games:[],error:error.message,sport});});
  return()=>control.abort();
 },[sport,tries]);
 const loadHistory=useMemo(()=>signal=>call({action:'game-history',sport},signal)
  .then(data=>setHistory({data})).catch(error=>{if(error.name!=='AbortError')setHistory(old=>({data:old.data,error:error.message}));}),[sport]);
 useEffect(()=>{const control=new AbortController();setHistory({loading:true});loadHistory(control.signal);return()=>control.abort();},[loadHistory]);
 // A game's page marks its own history entry, so the phone's back closes
 // it (the Props tab's matchup page does the same); only this visit's mark counts.
 // (window.history: `history` here is the picks.)
 const marked=()=>Boolean(mark.current)&&window.history.state?.gpGame===mark.current;
 const clearMark=()=>{if(window.history.state?.gpGame){const {gpGame,...rest}=window.history.state;window.history.replaceState(rest,'',location.href);}};
 useEffect(()=>{clearMark();const onPop=()=>{if(!marked()){mark.current=null;setOpen(null);}};
  window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);},[]);
 useEffect(()=>{if(!open)requestAnimationFrame(()=>window.scrollTo(0,listScroll.current));},[open]);
 const closeGame=()=>{if(marked()&&window.history.length===depth.current){window.history.back();return;}mark.current=null;clearMark();setOpen(null);};
 const openGame=game=>{
  listScroll.current=window.scrollY;
  mark.current=`${game.id}:${Date.now()}`;
  window.history.pushState({...window.history.state,gpGame:mark.current},'',location.href);
  depth.current=window.history.length;
  setOpen(game.id);window.scrollTo(0,0);
  if(results[game.id]?.data||results[game.id]?.loading)return;
  setResults(old=>({...old,[game.id]:{loading:true}}));
  call({action:'game-predict',sport,event:game.id}).then(data=>setResults(old=>({...old,[game.id]:{data}})))
   .catch(error=>setResults(old=>({...old,[game.id]:{error:error.message}})));
 };
 const removePick=item=>post('game-remove',{sport,event:item.id}).then(()=>loadHistory()).catch(()=>{});
 const pickSport=value=>{setSport(value);save('game-predictor-sport',value);};
 const pickView=value=>{setView(value);save('game-predictor-view',value);};
 const record=history.data?.record;
 const openedGame=open&&(slate.games||[]).find(game=>game.id===open);
 if(openedGame)return <div className="game-predictor">
  <GamePage game={openedGame} sport={sport} result={results[open]} admin={admin} onBack={closeGame}
   onPick={(side,now)=>results[open]?.data&&setSheet({prediction:results[open].data,side,now})}/>
  {sheet&&<PickScreen pick={sheet} onClose={()=>setSheet(null)} onSaved={()=>loadHistory()}/>}
 </div>;
 return <div className="game-predictor">
  <div className="gp-aurora" aria-hidden="true"/>
  <header className="gp-top">
   <div className="gp-title">
    <h2>Game Predictor</h2>
    <p>{recordText(record)?<>Record <b>{recordText(record)}</b></>:'NBA and NFL winners, scores and moneylines'}</p>
   </div>
   {view!=='generate'&&<Segmented options={SPORTS} value={sport} onChange={pickSport} label="League"/>}
  </header>
  <Tabs value={view} onChange={pickView}/>
  <div className="gp-view" key={view}>
   {view==='predict'&&<PredictView slate={slate} onOpen={openGame} admin={admin} onRetry={()=>setTries(n=>n+1)}/>}
   {view==='generate'&&<Generator league={sport} admin={admin}/>}
   {view==='history'&&<HistoryView state={history} admin={admin} onRetry={()=>{setHistory({loading:true});loadHistory();}} onRemove={removePick}/>}
  </div>

 </div>;
}
