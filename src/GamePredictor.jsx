// The Game Predictor (game_predictor.py through /api/prediction
// action=game-*), one full page (Nov 6, the owner: "I hate how it's all
// floating I want to look like a full page not random floating islands"):
// a header with the record and the league, then three tabs.
//  - Predict: the slate by day; tap a game and its prediction opens under
//    it (the winner, the final score, our model alone and with the line,
//    each moneyline's value, what to check first, what moved the number,
//    who's out, each side's best matchup, the teams side by side).
//  - Generator: a day (today to six days ahead), the NBA, the NFL or both,
//    the most likely winners that day and moneyline parlays by payout or by
//    legs (the owner: "a moneyline generator for certain days").
//  - History: only the picks the member saves (Nov 6, the owner: "only if
//    I add the prediction"), settled, with what each won or lost.
// Each open game is a market, Kalshi-style (the owner: "a Kalshi look"):
// each team's chance in big numbers and its price in cents, over a chart of
// the market's chance moving with the odds (ESPN's lines, sampled; in a
// game ESPN's win probability after every play), read again every few
// seconds. Tapping a team opens a sheet from the bottom with a stake and
// what it pays; swiping up saves the pick (the owner: "the poly market
// swipe up to buy thing that would save it to the history").
// A section the admin switches on (site_controls 'predictor'), off until then.
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {AlertTriangle,CalendarDays,Check,ChevronDown,ChevronsUp,Flame,Gauge,Info,Layers,RefreshCw,ShieldCheck,Trophy,UserX,X} from 'lucide-react';
import {useIsAdmin} from './admin-notice.js';
import {useInk,inkStyle} from './use-ink.js';
import {SPORTS,americanOf,byText,cents,chartFrame,chartPath,clockText,dayOptions,evText,groupByDay,likeliest,lineText,mergeBoards,moneyText,odds,parlays,paysText,pct,pull,recordText,resultOf,sideSeries,startText,twoCalls,unitsText,valueRows,winOf} from './game-predictor-core.js';
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

function PredictView({slate,results,open,onOpen,admin,onRetry,sport,onPick}){
 const games=slate.games||[];
 if(slate.loading&&!games.length)return <Shimmer rows={5}/>;
 if(slate.error&&!games.length)return <Empty icon={RefreshCw} title="The games can't load right now" text={admin?slate.error:null}>
  <button type="button" className="gp-soft" onClick={onRetry}><RefreshCw size={15} aria-hidden="true"/>Try again</button></Empty>;
 if(!games.length)return <Empty title="No games on the schedule" text="Check back closer to the next games."/>;
 return <div className="gp-days">{groupByDay(games).map(day=><section key={day.key} className="gp-day">
  <h3 className="gp-day-head">{day.label}<small>{day.games.length} {day.games.length===1?'game':'games'}</small></h3>
  <ul className="gp-games">{day.games.map((game,index)=><GameItem key={game.id} game={game} index={index} open={open===game.id}
   result={results[game.id]} onOpen={()=>onOpen(game)} admin={admin} sport={sport} onPick={onPick}/>)}</ul>
 </section>)}</div>;
}

function GameItem({game,index,open,result,onOpen,admin,sport,onPick}){
 const host=useRef(null);
 const ready=Boolean(result?.data);
 const chart=useChart(sport,open?game.id:null);
 useEffect(()=>{if(open&&ready)host.current?.scrollIntoView({behavior:'smooth',block:'start'});},[open,ready]);
 const live=game.state==='in';
 const team=side=><span className="gp-team"><Logo team={game[side]} size={30}/><span><b>{game[side]?.abbr}</b>{game[side]?.record&&<small>{game[side].record}</small>}</span></span>;
 return <li ref={host} className="gp-game" data-open={open?'':undefined} style={{'--i':index}}>
  <button type="button" className="gp-game-row" aria-expanded={open} onClick={onOpen}>
   <span className="gp-matchup">{team('away')}<i>@</i>{team('home')}</span>
   <span className="gp-game-meta">{live?<em className="gp-live">Live</em>:<b>{clockText(game.startsAt)}</b>}{lineText(game)&&<small>{lineText(game)}</small>}</span>
   <ChevronDown className="gp-chev" size={18} aria-hidden="true"/>
  </button>
  <div className="gp-drawer" aria-hidden={!open}><div className="gp-drawer-inner">
   {open&&(game.state!=='pre'?<p className="gp-note">This game has started. Its prediction is in the history if one was made before tip-off.</p>
    :result?.loading?<Shimmer rows={3} tall/>
    :result?.error?<p className="gp-note">{admin?result.error:'There isn\'t enough on this game yet. Try again closer to the start.'}</p>
    :ready?<Prediction prediction={result.data} chart={chart} onPick={(side,now)=>onPick(result.data,side,now)}/>:null)}
  </div></div>
 </li>;
}

function Prediction({prediction,chart,onPick}){
 return <div className="gp-prediction">
  <Verdict prediction={prediction}/>
  <Market prediction={prediction} chart={chart} onPick={onPick}/>
  <TwoCalls prediction={prediction}/>
  <Value prediction={prediction}/>
  <Warnings prediction={prediction}/>
  <Factors prediction={prediction}/>
  <WhosOut prediction={prediction}/>
  <Players prediction={prediction}/>
  <Compare prediction={prediction}/>
 </div>;
}

const Section=({title,icon:Icon,children,className=''})=><section className={`gp-sec ${className}`}>
 {title&&<h4 className="gp-sec-head">{Icon&&<Icon size={15} aria-hidden="true"/>}{title}</h4>}{children}
</section>;

function ChanceBar({chance,winner,away,home}){
 return <div className="gp-chance">
  <div className="gp-chance-track" role="img" aria-label={`${away.abbr} ${pct(chance.away)}, ${home.abbr} ${pct(chance.home)}`}>
   <span className={winner==='away'?'is-pick':''} style={{'--w':Math.max(chance.away,0.03)}}/>
   <span className={winner==='home'?'is-pick':''} style={{'--w':Math.max(chance.home,0.03)}}/>
  </div>
  <div className="gp-chance-labels"><span>{away.abbr} <b>{pct(chance.away)}</b></span><span><b>{pct(chance.home)}</b> {home.abbr}</span></div>
 </div>;
}

function Verdict({prediction}){
 const side=prediction.winner,winner=prediction[side],score=prediction.score;
 const color=/^[0-9a-f]{6}$/i.test(winner.color||'')?`#${winner.color}`:undefined;
 return <section className="gp-hero" style={color?{'--team':color}:undefined}>
  <div className="gp-hero-main">
   <span className="gp-hero-logo"><Logo team={winner} size={64}/></span>
   <div>
    <span className="gp-kicker">Predicted winner</span>
    <h3>{winner.name||winner.short||winner.abbr}</h3>
    <p><b>{pct(prediction.chance[side])}</b> to win</p>
   </div>
  </div>
  {score&&<div className="gp-scoreline" aria-label="Predicted final score">
   {['away','home'].map(key=><div key={key} className={side===key?'is-pick':''}><Logo team={prediction[key]} size={26}/><span>{prediction[key].abbr}</span><b>{score[key]}</b></div>)}
  </div>}
  <ChanceBar chance={prediction.chance} winner={side} away={prediction.away} home={prediction.home}/>
  <div className="gp-facts">
   <span data-level={prediction.confidence}><ShieldCheck size={15} aria-hidden="true"/>{prediction.confidence} confidence</span>
   <span data-level={prediction.blowout.level}><Flame size={15} aria-hidden="true"/>Blowout {pct(prediction.blowout.chance)}<small>by {prediction.blowout.by}+</small></span>
   {prediction.pace&&<span data-level={prediction.pace.level}><Gauge size={15} aria-hidden="true"/>{prediction.pace.level} pace<small>{prediction.pace.value} {prediction.pace.unit}</small></span>}
  </div>
  {prediction.confidenceWhy?.length>0&&<p className="gp-why-line">{prediction.confidenceWhy.join(' · ')}</p>}
  <dl className="gp-views">
   {prediction.market?.spread!=null&&<div><dt>The line</dt><dd>{byText(-prediction.market.spread,prediction)}</dd></div>}
   {prediction.market?.total!=null&&<div><dt>Total</dt><dd>{prediction.market.total}</dd></div>}
   {prediction.espn&&<div><dt>ESPN</dt><dd>{prediction.espn.home>=0.5?prediction.home.abbr:prediction.away.abbr} {pct(Math.max(prediction.espn.home,prediction.espn.away))}</dd></div>}
  </dl>
 </section>;
}

// The market, Kalshi-style: the predicted winner's chance now and how it
// moved, a chart of it (the market's from ESPN's lines; in a game ESPN's win
// probability after every play; our pick as a dashed line), then each team
// with its chance and its price in cents, tapped to pick it.
const W=600,H=170;
function Chart({prediction,chart,side}){
 const host=useRef(null);
 const [hover,setHover]=useState(null);
 const now=Date.now()/1000;
 const market=sideSeries(chart?.market,side),live=sideSeries(chart?.live,side);
 const fallback=prediction.market?.chance?.[side];
 const shown=market.length?market:fallback!=null?[[now-3600,fallback],[now,fallback]]:[];
 const ours=prediction.chance[side];
 const frame=chartFrame([shown,live].filter(series=>series.length),[ours]);
 if(!frame)return null;
 const end=Math.max(frame.end,now);
 const box={...frame,end};
 const y=value=>(1-(value-box.low)/(box.high-box.low))*100;
 const main=live.length?live:shown;
 const pick=event=>{
  const rect=host.current?.getBoundingClientRect();if(!rect)return;
  const span=Math.max(1,rect.width-44);
  const t=box.start+(Math.min(Math.max(event.clientX-rect.left,0),span)/span)*(box.end-box.start);
  let found=main[0];for(const point of main){if(point[0]<=t)found=point;else break;}
  setHover({x:(found[0]-box.start)/(box.end-box.start||1)*100,value:found[1],t:found[0]});
 };
 return <div className="gp-chart" ref={host} onPointerMove={pick} onPointerDown={pick} onPointerLeave={()=>setHover(null)}>
  <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${prediction[side].abbr} chance over time, now ${pct(main[main.length-1][1])}`}>
   {box.lines.map(value=><line key={value} className="gp-chart-grid" x1="0" x2={W} y1={y(value)*H/100} y2={y(value)*H/100}/>)}
   <line className="gp-chart-ours" x1="0" x2={W} y1={y(ours)*H/100} y2={y(ours)*H/100}/>
   {live.length>0&&shown.length>0&&<path className="gp-chart-line is-faint" d={chartPath(shown,box,W,H)}/>}
   <path className="gp-chart-line" d={chartPath(main,box,W,H)}/>
  </svg>
  {box.lines.map(value=><span key={value} className="gp-chart-y" style={{top:`${y(value)}%`}}>{Math.round(value*100)}%</span>)}
  <span className="gp-chart-tag" style={{top:`${y(ours)}%`}}>Our pick {pct(ours)}</span>
  <span className="gp-chart-dot" style={{top:`${y(main[main.length-1][1])}%`}}/>
  {hover&&<><span className="gp-chart-cross" style={{left:`calc((100% - 44px) * ${hover.x/100})`}}/>
   <span className="gp-chart-tip" style={{left:`calc((100% - 44px) * ${Math.min(Math.max(hover.x,14),86)/100})`}}><b>{pct(hover.value)}</b>{clockText(new Date(hover.t*1000).toISOString())}</span></>}
 </div>;
}

function Market({prediction,chart,onPick}){
 const side=prediction.winner,team=prediction[side];
 const live=chart?.state==='in';
 const market=sideSeries(chart?.market,side),inGame=sideSeries(chart?.live,side);
 const latest=inGame.length?inGame[inGame.length-1][1]:market.length?market[market.length-1][1]:prediction.market?.chance?.[side];
 const first=market.length?market[0][1]:null;
 const moved=latest!=null&&first!=null?latest-first:null;
 const open=prediction.state==='pre'&&(chart?.state||'pre')==='pre';
 return <section className="gp-sec gp-market">
  <div className="gp-market-head">
   <div>
    <span className="gp-kicker">{live?<><i className="gp-pulse" aria-hidden="true"/>Live · {chart.detail}</>:'Market chance'}</span>
    <p className="gp-market-now"><b>{pct(latest)}</b> {team.abbr}{moved!=null&&Math.abs(moved)>=0.005&&<em data-tone={moved>0?'up':'down'}>{moved>0?'▲':'▼'} {Math.abs(moved*100).toFixed(1)}</em>}</p>
   </div>
   <div className="gp-legend"><span className="is-line">{live?'Live win chance':'Market'}</span><span className="is-ours">Our pick</span></div>
  </div>
  <Chart prediction={prediction} chart={chart} side={side}/>
  {live&&chart.home?.score!=null&&<p className="gp-live-score">{chart.away.abbr} {chart.away.score} · {chart.home.abbr} {chart.home.score}</p>}
  <ul className="gp-outcomes">{['away','home'].map(key=>{const item=prediction[key];
   const price=chart?.now?.moneyline?.[key]??prediction.market?.moneyline?.[key];
   const homeNow=chart?.now?.market;const marketChance=homeNow!=null?(key==='home'?homeNow:1-homeNow):prediction.market?.chance?.[key];
   const color=/^[0-9a-f]{6}$/i.test(item.color||'')?`#${item.color}`:undefined;
   return <li key={key} style={color?{'--team':color}:undefined}>
    <Logo team={item} size={34}/>
    <span className="gp-outcome-name"><b>{item.short||item.abbr}</b><small>{price!=null?odds(price):'No line'}{prediction.ours?<> · our model {pct(prediction.ours.chance[key])}</>:null}</small></span>
    <strong className="gp-outcome-pct">{pct(prediction.chance[key])}</strong>
    <button type="button" className="gp-buy" disabled={!open||price==null} onClick={()=>onPick(key,{price,marketChance})}>
     <span>{item.abbr}</span><b>{cents(marketChance)}</b>
    </button>
   </li>;})}</ul>
 </section>;
}

// Swipe up to save (Polymarket's "swipe up to buy"): drag the knob up past
// the line; a tap only nudges it, Enter or Space saves from the keyboard.
function SwipeUp({onDone,disabled,label}){
 const [lift,setLift]=useState(0),[hint,setHint]=useState(false);
 const from=useRef(null),liftRef=useRef(0);
 const LIMIT=84;
 const set=value=>{liftRef.current=value;setLift(value);};
 const down=event=>{if(disabled)return;from.current=event.clientY;event.currentTarget.setPointerCapture?.(event.pointerId);};
 const move=event=>{if(from.current==null)return;set(Math.min(LIMIT*1.15,Math.max(0,from.current-event.clientY)));};
 const up=()=>{
  if(from.current==null)return;from.current=null;
  if(liftRef.current>=LIMIT){set(LIMIT);navigator.vibrate?.(12);onDone();return;}
  if(liftRef.current<6){setHint(true);setTimeout(()=>setHint(false),650);}
  set(0);
 };
 return <button type="button" className="gp-swipe" disabled={disabled} data-hint={hint?'':undefined}
  style={{'--lift':`${lift}px`,'--progress':Math.min(1,lift/LIMIT)}} aria-label={`${label}: swipe up, or press Enter`}
  onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
  onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!disabled)onDone();}}}>
  <span className="gp-swipe-knob"><ChevronsUp size={22} aria-hidden="true"/></span>
  <span className="gp-swipe-text">{label}</span>
 </button>;
}

const QUICK=[10,25,50,100];
function PickSheet({pick,onClose,onSaved}){
 const {prediction,side}=pick;
 const team=prediction[side],other=prediction[side==='home'?'away':'home'];
 const price=pick.now?.price??prediction.market?.moneyline?.[side];
 const marketChance=pick.now?.marketChance??prediction.market?.chance?.[side];
 const [stake,setStake]=useState('');
 const [phase,setPhase]=useState('idle');
 const [error,setError]=useState(null);
 const [shown,setShown]=useState(false);
 const [drag,setDrag]=useState(0);
 const from=useRef(null);
 useEffect(()=>{
  const frame=requestAnimationFrame(()=>setShown(true));
  const key=event=>{if(event.key==='Escape')close();};
  document.addEventListener('keydown',key);
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',key);document.body.style.overflow=overflow;};
 },[]);
 const close=()=>{setShown(false);setTimeout(onClose,320);};
 const amount=Number(stake)>0?Number(stake):null;
 const win=winOf(amount,price);
 const ev=prediction.ev?.blend?.[side]?.ev;
 const save=()=>{
  if(phase==='saving')return;
  setPhase('saving');setError(null);
  post('game-save',{sport:prediction.sport,event:prediction.id,side,stake:amount}).then(data=>{setPhase('saved');onSaved?.(data.pick);setTimeout(close,1300);})
   .catch(failure=>{setPhase('idle');setError(failure.message);});
 };
 const color=/^[0-9a-f]{6}$/i.test(team.color||'')?`#${team.color}`:undefined;
 return createPortal(<div className={`gp-sheet-layer${shown?' is-open':''}`}>
  <button type="button" className="gp-sheet-scrim" aria-label="Close" onClick={close}/>
  <div className="gp-sheet" role="dialog" aria-modal="true" aria-label={`Pick ${team.short||team.abbr}`} style={{'--drag':`${drag}px`,...(color?{'--team':color}:{})}}>
   <div className="gp-sheet-grab" onPointerDown={event=>{from.current=event.clientY;event.currentTarget.setPointerCapture?.(event.pointerId);}}
    onPointerMove={event=>{if(from.current!=null)setDrag(Math.max(0,event.clientY-from.current));}}
    onPointerUp={()=>{from.current=null;if(drag>90)close();setDrag(0);}} onPointerCancel={()=>{from.current=null;setDrag(0);}}><span/></div>
   {phase==='saved'?<div className="gp-sheet-done"><span><Check size={30} aria-hidden="true"/></span><b>Saved to your history</b><p>{team.abbr} to win{amount?` · ${moneyText(amount)}`:''}</p></div>:<>
    <header className="gp-sheet-head">
     <Logo team={team} size={46}/>
     <div><b>{team.short||team.abbr} to win</b><small>{side==='home'?'vs':'@'} {other.abbr} · {startText(prediction.startsAt)}</small></div>
     <button type="button" className="gp-sheet-x" aria-label="Close" onClick={close}><X size={18}/></button>
    </header>
    <dl className="gp-sheet-facts">
     <div><dt>Price</dt><dd>{cents(marketChance)}<small>{odds(price)}</small></dd></div>
     <div><dt>Our chance</dt><dd>{pct(prediction.chance[side])}<small>{prediction.ours?`model ${pct(prediction.ours.chance[side])}`:''}</small></dd></div>
     <div><dt>Value</dt><dd data-tone={ev>0?'up':ev<0?'down':undefined}>{evText(ev)}</dd></div>
    </dl>
    <label className="gp-amount"><span>Amount</span>
     <span className="gp-amount-box"><i>$</i><input inputMode="decimal" placeholder="0" value={stake} onChange={event=>setStake(event.target.value.replace(/[^0-9.]/g,'').slice(0,9))} aria-label="Amount in dollars"/></span>
    </label>
    <div className="gp-chips">{QUICK.map(value=><button type="button" key={value} onClick={()=>setStake(String((Number(stake)||0)+value))}>+${value}</button>)}
     {stake&&<button type="button" onClick={()=>setStake('')}>Clear</button>}</div>
    <div className="gp-sheet-win"><span>To win</span><b>{win!=null?moneyText(win):'—'}</b><small>{win!=null?`Payout ${moneyText(win+amount)}`:'Optional: saves as one unit without it'}</small></div>
    {error&&<p className="gp-note" data-tone="down">{error}</p>}
    <SwipeUp onDone={save} disabled={phase==='saving'||price==null} label={phase==='saving'?'Saving…':'Swipe up to save'}/>
   </>}
  </div>
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
 return <Section title="Moneyline value">
  <ul className="gp-rows">{rows.map(row=><li key={row.side} className="gp-value" data-best={row.best?'':undefined}>
   <Logo team={row.team} size={26}/>
   <span><b>{row.team.abbr} <em>{row.price}</em></b><small>{row.chance} to win · fair {row.fair}{row.ours?<> · our model {row.ours}</>:null}</small></span>
   <strong data-tone={row.ev>0?'up':'down'}>{row.text}</strong>
  </li>)}</ul>
 </Section>;
}

function Warnings({prediction}){
 const items=prediction.warnings||[];
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

function WhosOut({prediction}){
 const out=prediction.out;
 if(!out)return null;
 return <Section title="Who's out" icon={UserX}>
  <div className="gp-two">{['away','home'].map(side=><div key={side}>
   <p className="gp-team-head"><Logo team={prediction[side]} size={20}/>{prediction[side].short||prediction[side].abbr}</p>
   {(out[side]||[]).length?<ul className="gp-out">{out[side].slice(0,6).map((player,index)=><li key={index} data-out={player.out?'':undefined}>
    <span><b>{player.name}</b><small>{[player.position,player.status,player.injury].filter(Boolean).join(' · ')}</small></span>
    {player.impact>0&&<em>−{player.impact} pts</em>}
   </li>)}</ul>:<p className="gp-note">Nobody on the injury report.</p>}
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
    <span className="gp-kicker"><Trophy size={14} aria-hidden="true"/>Most likely to win {when}</span>
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
 const openGame=game=>{
  if(open===game.id){setOpen(null);return;}
  setOpen(game.id);
  if(game.state!=='pre'||results[game.id]?.data||results[game.id]?.loading)return;
  setResults(old=>({...old,[game.id]:{loading:true}}));
  call({action:'game-predict',sport,event:game.id}).then(data=>setResults(old=>({...old,[game.id]:{data}})))
   .catch(error=>setResults(old=>({...old,[game.id]:{error:error.message}})));
 };
 const removePick=item=>post('game-remove',{sport,event:item.id}).then(()=>loadHistory()).catch(()=>{});
 const pickSport=value=>{setSport(value);save('game-predictor-sport',value);};
 const pickView=value=>{setView(value);save('game-predictor-view',value);};
 const record=history.data?.record;
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
   {view==='predict'&&<PredictView slate={slate} results={results} open={open} onOpen={openGame} admin={admin} onRetry={()=>setTries(n=>n+1)}
    sport={sport} onPick={(prediction,side,now)=>setSheet({prediction,side,now})}/>}
   {view==='generate'&&<Generator league={sport} admin={admin}/>}
   {view==='history'&&<HistoryView state={history} admin={admin} onRetry={()=>{setHistory({loading:true});loadHistory();}} onRemove={removePick}/>}
  </div>
  {sheet&&<PickSheet pick={sheet} onClose={()=>setSheet(null)} onSaved={()=>loadHistory()}/>}
 </div>;
}
