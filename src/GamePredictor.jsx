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
import {AlertTriangle,ArrowLeft,BookOpen,CalendarDays,Check,ChevronDown,ChevronRight,ChevronUp,Delete,Flame,Info,Layers,RefreshCw,Share,Trophy,UserX,X,Zap} from 'lucide-react';
import {useIsAdmin} from './admin-notice.js';
import {useInk,inkStyle} from './use-ink.js';
import {SPORTS,americanOf,byText,cents,chartFrame,chartPath,clockText,dayOptions,dayText,historyGroups,pickScoreText,decimal,evText,groupByDay,keyInjuries,likeliest,gameClockText,inkOn,lineText,liveAlert,liveFirst,liveText,marketNote,mergeBoards,pickStatus,propProgress,runText,sparkPath,moneyText,odds,pairColors,parlays,paysText,pct,pull,readGuide,recordText,resultOf,sideSeries,startText,twoCalls,unitsText,valueRows,winOf} from './game-predictor-core.js';
import {shareMoneyline} from './game-share.js';
import {findGame,liveWithScores,nbaBoard,nbaJson,withNbaLive} from './nba-live.js';
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
  // In a game every 3 s (the server reads NBA.com's feed every 2 s, ESPN's every 3); before it every minute.
  const next=()=>{if(!stop)timer=setTimeout(load,live.current?3000:60000);};
  const load=()=>{
   if(document.visibilityState==='hidden'){timer=setTimeout(load,5000);return;}
   call({action:'game-chart',sport,event}).then(data=>{if(stop)return;live.current=data.state==='in';setChart(data);}).catch(()=>{}).finally(next);
  };
  load();
  return()=>{stop=true;clearTimeout(timer);};
 },[sport,event]);
 return chart;
}

// An NBA game on now whose chart is on ESPN's slower play-by-play (the
// server couldn't reach NBA.com): this phone reads NBA.com's live feed
// itself every 3 seconds and lays it over the chart (nba-live.js).
function useNbaLive(chart){
 const [fresh,setFresh]=useState(null);
 const want=chart?.sport==='nba'&&chart?.state==='in'&&chart?.liveSource==='espn';
 const key=want?chart.id:null;
 const teams=useRef(null);
 teams.current=chart?{home:chart.home?.abbr,away:chart.away?.abbr}:null;
 useEffect(()=>{
  setFresh(null);
  if(!key)return undefined;
  let stop=false,timer=null,gameId=null,boardAt=0;
  const load=async()=>{
   try{
    if(document.visibilityState!=='hidden'){
     if(!gameId&&Date.now()-boardAt>60000){boardAt=Date.now();gameId=findGame(await nbaBoard(),teams.current?.home,teams.current?.away)?.gameId||null;}
     if(gameId){
      const [plays,box]=await Promise.all([nbaJson(`/playbyplay/playbyplay_${gameId}.json`),nbaJson(`/boxscore/boxscore_${gameId}.json`)]);
      if(!stop&&(plays||box))setFresh({actions:plays?.game?.actions||[],box:box?.game||null});
     }
    }
   }catch{/* ESPN's stands */}
   if(!stop)timer=setTimeout(load,3000);
  };
  load();
  return()=>{stop=true;clearTimeout(timer);};
 },[key]);
 return useMemo(()=>fresh&&want?withNbaLive(chart,fresh.actions,fresh.box):chart,[chart,fresh,want]);
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
// The games on now, read every 15 seconds while there are any (the slate is
// kept 5 minutes): their score, time left and chance line (game_live.py).
function useLiveList(sport,games){
 const [live,setLive]=useState(null);
 const listed=useRef(games);
 listed.current=games;
 const due=(games||[]).some(game=>game.state==='in'||(game.state==='pre'&&Date.parse(game.startsAt)<=Date.now()+60000));
 useEffect(()=>{
  setLive(null);
  if(!due)return undefined;
  let stop=false,timer=null;
  const load=()=>{
   if(document.visibilityState==='hidden'){timer=setTimeout(load,5000);return;}
   // The NBA's scores from NBA.com too, read by this phone (seconds fresher than ESPN's).
   call({action:'game-live',sport}).then(async data=>{
    const board=sport==='nba'?await nbaBoard().catch(()=>null):null;
    if(!stop)setLive(board?liveWithScores(data,listed.current,board):data);
   }).catch(()=>{}).finally(()=>{if(!stop)timer=setTimeout(load,15000);});
  };
  load();
  return()=>{stop=true;clearTimeout(timer);};
 },[sport,due]);
 return live;
}

// A game on now in the list (Nov 8): both teams with their score, the time
// left, and a small line of the chance of the team ahead on it.
function LiveRow({game,index,onOpen}){
 const colors=pairColors(game.home,game.away);
 const points=game.spark?.points||[];
 const homeNow=points[points.length-1]?.[1];
 const ahead=homeNow==null?null:homeNow>=0.5?'home':'away';
 const color=ahead&&teamColor({color:colors[ahead]});
 const team=side=><span className="gp-live-team"><Logo team={game[side]} size={24}/><b>{game[side]?.abbr}</b><strong>{game[side]?.score??''}</strong></span>;
 return <li className="gp-game is-live" style={{'--i':index}}>
  <button type="button" className="gp-game-row gp-live-row" onClick={()=>onOpen(game)}>
   <span className="gp-live-teams">{team('away')}{team('home')}</span>
   <span className="gp-live-side" style={color?{'--team':color}:undefined}>
    {ahead&&<small className="gp-live-chance">{game[ahead]?.abbr} <b>{pct(ahead==='home'?homeNow:1-homeNow)}</b></small>}
    {ahead&&<svg className="gp-spark" viewBox="0 0 80 24" preserveAspectRatio="none" aria-hidden="true">
     <line x1="0" x2="80" y1="12" y2="12"/><path d={sparkPath(game.spark,ahead,80,24)}/></svg>}
    <small className="gp-live-clock"><i className="gp-pulse" aria-hidden="true"/>{liveText(game.detail)||'Live'}</small>
   </span>
   <ChevronRight className="gp-chev" size={18} aria-hidden="true"/>
  </button>
 </li>;
}

function PredictView({slate,live,onOpen,admin,onRetry}){
 const sorted=liveFirst(slate.games||[],live);
 const games=sorted.rest;
 if(slate.loading&&!games.length)return <Shimmer rows={5}/>;
 if(slate.error&&!games.length)return <Empty icon={RefreshCw} title="The games can't load right now" text={admin?slate.error:null}>
  <button type="button" className="gp-soft" onClick={onRetry}><RefreshCw size={15} aria-hidden="true"/>Try again</button></Empty>;
 if(!games.length&&!sorted.live.length)return <Empty title="No games on the schedule" text="Check back closer to the next games."/>;
 return <div className="gp-days">
  {sorted.live.length>0&&<section className="gp-day gp-day-live">
   <h3 className="gp-day-head">Live now<small>{sorted.live.length} {sorted.live.length===1?'game':'games'}</small></h3>
   <ul className="gp-games">{sorted.live.map((game,index)=><LiveRow key={game.id} game={game} index={index} onOpen={onOpen}/>)}</ul>
  </section>}
  {groupByDay(games).map(day=><section key={day.key} className="gp-day">
  <h3 className="gp-day-head">{day.label}<small>{day.games.length} {day.games.length===1?'game':'games'}</small></h3>
  <ul className="gp-games">{day.games.map((game,index)=>{const live=game.state==='in';
   const team=side=><span className="gp-team"><Logo team={game[side]} size={30}/><span><b>{game[side]?.abbr}</b>{game[side]?.record&&<small>{game[side].record}</small>}</span></span>;
   return <li key={game.id} className="gp-game" style={{'--i':index}}>
    <button type="button" className="gp-game-row" onClick={()=>onOpen(game)}>
     <span className="gp-matchup">{team('away')}<i>@</i>{team('home')}</span>
     <span className="gp-game-meta">{live?<em className="gp-live">Live</em>:game.state==='post'?<b>Final</b>:<b>{clockText(game.startsAt)}</b>}
      {game.state==='post'&&game.away?.score!=null?<small>{game.away.score}-{game.home?.score}</small>:lineText(game)&&<small>{lineText(game)}</small>}</span>
     <ChevronRight className="gp-chev" size={18} aria-hidden="true"/>
    </button>
   </li>;})}</ul>
 </section>)}
 </div>;
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
// In a game and after it, a tab for the game itself: the score by quarter,
// the top players, the plays that swung it, and every player's props.
const gameTabs=chart=>{const on=['in','post'].includes(chart?.state)&&(chart?.feed||chart?.props?.length);
 return on?[GAME_TABS[0],['live',chart.state==='in'?'Live':'Recap'],...GAME_TABS.slice(1)]:GAME_TABS;};
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
 const chart=useNbaLive(useChart(sport,game.id));
 const analysis=useAnalysis(sport,game.id,tab==='why');
 const raw=result?.data;
 const colors=pairColors(raw?.home||game.home,raw?.away||game.away);
 const prediction=useMemo(()=>raw&&{...raw,home:{...raw.home,color:colors.home},away:{...raw.away,color:colors.away}},[raw,colors.home,colors.away]);
 const live=(chart?.state||game.state)==='in';
 const now=chancesNow(prediction,chart);
 const home=prediction?.home||game.home,away=prediction?.away||game.away;
 const status=live?<><i className="gp-pulse" aria-hidden="true"/>{liveText(chart?.detail)||'Live'}</>:(chart?.state||game.state)==='post'?'Final':startText(game.startsAt);
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
   {gameTabs(chart).map(([key,text])=><button type="button" role="tab" key={key} aria-selected={tab===key} onClick={()=>setTab(key)}>{text}</button>)}
   <span className="gp-tabs-ink" style={inkStyle(ink)} aria-hidden="true"/>
  </nav>
  <div className="gp-page-body" key={tab}>
   {result?.loading&&!prediction?<Shimmer rows={3} tall/>
   :result?.error&&!prediction?<p className="gp-note gp-page-note">{admin?result.error:'There isn\'t enough on this game yet. Try again closer to the start.'}</p>
   :prediction?<>
    {tab==='chance'&&<ChanceTab prediction={prediction} chart={chart} onPick={onPick}/>}
    {tab==='live'&&<LiveTab prediction={prediction} chart={chart}/>}
    {tab==='odds'&&<OddsTab prediction={prediction} chart={chart} onPick={onPick}/>}
    {tab==='why'&&<><Analysis state={analysis} prediction={prediction}/><Warnings prediction={prediction}/><WhosOut prediction={prediction}/>
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
 const [swing,setSwing]=useState(null);
 const nowT=Date.now()/1000;
 const live=chart?.live||[],market=chart?.market||[];
 const fallback=prediction.market?.chance?.home??prediction.chance.home;
 // In a game, on the game's own clock where ESPN gives it (Nov 8: the quarters
 // across the chart, the line filling in as the game goes), else clock time.
 const clock=chart?.clock?.points?.length>1&&['in','post'].includes(chart.state)?chart.clock:null;
 const inGame=Boolean(clock)||live.length>1;
 const raw=clock?clock.points:inGame?live:market.length?market:[[nowT-3600,fallback]];
 // The price stands until it moves: before the game, the line runs on to now at the latest price.
 const latest=inGame?null:chart?.now?.market??raw[raw.length-1][1];
 const base=latest!=null&&raw[raw.length-1][0]<nowT-30?[...raw,[nowT,latest]]:raw;
 const series={home:sideSeries(base,'home'),away:sideSeries(base,'away')};
 const frame=chartFrame([series.home,series.away]);
 if(!frame)return null;
 const step=0.15,below=Math.min(frame.low,0.35),above=Math.max(frame.high,0.65);
 const low=Math.max(0,0.5-step*Math.ceil((0.5-below)/step-1e-9)),high=Math.min(1,0.5+step*Math.ceil((above-0.5)/step-1e-9));
 const box=clock?{...frame,low,high,start:0,end:clock.length}:{...frame,low,high,end:Math.max(frame.end,nowT)};
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
 // Where the line ends across the chart (the right edge, or in a game the time now).
 const reach=clock?Math.min(1,base[base.length-1][0]/(clock.length||1)):1;
 // Two labels never overlap: pushed apart when the chances are close.
 const gap=Math.abs(y(ends.home)-y(ends.away))<26;
 const labelY=side=>{const value=y(ends[side]);if(!gap)return value;const up=ends[side]>=ends[side==='home'?'away':'home'];return up?Math.min(value,y(0.5)-13):Math.max(value,y(0.5)+13);};
 const colorOf=side=>teamColor(prediction[side]);
  const swings=clock?(chart.swings||[]).filter(item=>item.at<=clock.length):[];
 return <div className="gp-chart2" ref={host} onPointerMove={event=>{if(!swing)pick(event);}} onPointerDown={event=>{setSwing(null);pick(event);}} onPointerLeave={()=>setHover(null)}
  style={{'--home':colorOf('home')||'#e9e9e9','--away':colorOf('away')||'#8f8f8f','--home-ink':inkOn(prediction.home?.color),'--away-ink':inkOn(prediction.away?.color)}}>
  {grid.map(value=><span key={value} className="gp-chart-rule" style={{top:`${y(value)}%`}}><small>{Math.round(value*100)}%</small></span>)}
  {clock&&clock.periods.map((period,index)=>{const next=clock.periods[index+1]?.at??clock.length;return <React.Fragment key={period.label}>
   {index>0&&<span className="gp-chart-period" style={{left:`calc(${PLOT} * ${period.at/clock.length})`}} aria-hidden="true"/>}
   <span className="gp-chart-period-name" style={{left:`calc(${PLOT} * ${(period.at+next)/2/clock.length})`}}
    data-now={chart.clock.now!=null&&chart.clock.now>=period.at&&chart.clock.now<next?'':undefined}>{period.label}</span>
  </React.Fragment>;})}
  <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${prediction.away.abbr} ${pct(ends.away)}, ${prediction.home.abbr} ${pct(ends.home)}`}>
   {['away','home'].map(side=><path key={side} className={`gp-chart2-line is-${side}`} d={chartPath(series[side],box,W,H,{toEnd:!clock})}/>)}
  </svg>
  {['away','home'].map(side=><React.Fragment key={side}>
   <i className={`gp-chart2-dot is-${side}`} style={{top:`${y(ends[side])}%`,left:`calc(${PLOT} * ${reach})`}} aria-hidden="true"/>
   <span className={`gp-chart2-end is-${side}`} style={{top:`${labelY(side)}%`,...(clock&&reach<1?{left:`min(calc(${PLOT} * ${reach} + 14px), calc(100% - 100px))`}:{})}}>
    <small>{prediction[side].abbr}</small><b>{pct(ends[side])}</b>
   </span>
  </React.Fragment>)}
  {swings.map(item=>{const value=item.side==='home'?item.home:1-item.home;
   return <button type="button" key={item.at} className={`gp-swing is-${item.side}`} data-open={swing?.at===item.at?'':undefined}
    style={{left:`calc(${PLOT} * ${item.at/clock.length})`,top:`${y(value)}%`}} aria-label={`${item.when}: ${item.text}`}
    onPointerDown={event=>event.stopPropagation()} onPointerMove={event=>event.stopPropagation()}
    onClick={()=>{setHover(null);setSwing(old=>old?.at===item.at?null:item);}}/>;})}
  {swing&&<span className="gp-chart-tip gp-swing-tip" style={{left:`calc(${PLOT} * ${Math.min(Math.max(swing.at/clock.length,0.3),0.7)})`}}>
   <span><b>{prediction[swing.side].abbr} {signed(Math.abs(swing.delta)*100,0)}%</b> · {swing.when}</span>{swing.text}
  </span>}
  {hover&&!swing&&<><span className="gp-chart-cross" style={{left:`calc(${PLOT} * ${Math.min(hover.x,1)})`}}/>
   <span className="gp-chart-tip" style={{left:`calc(${PLOT} * ${Math.min(Math.max(hover.x,0.2),0.8)})`}}>
    <span>{prediction.away.abbr} <b>{pct(1-hover.home)}</b> · {prediction.home.abbr} <b>{pct(hover.home)}</b></span>{clock?gameClockText(hover.t,chart.sport):clockText(new Date(hover.t*1000).toISOString())}
   </span></>}
 </div>;
}

// A button for each team: its price in cents and the book's own odds
// (DraftKings' -241 / +199: the same price), tapped to pick it.
function PickButtons({prediction,chart,onPick}){
 const open=prediction.state==='pre'&&(chart?.state||'pre')==='pre';
 // In a game the line is usually the pregame one (Nov 8: 70¢ beside a live
 // 53%): say so, and show no cents, unless it's DraftKings' in-game price.
 const pregame=!open&&chart?.state==='in'&&!chart?.now?.priceLive;
 return <div className="gp-pick-buttons">{['away','home'].map(side=>{const team=prediction[side];
  const price=chart?.now?.moneyline?.[side]??prediction.market?.moneyline?.[side];
  const homeNow=chart?.now?.market;const marketChance=homeNow!=null?(side==='home'?homeNow:1-homeNow):prediction.market?.chance?.[side];
  const color=teamColor(team);
  return <button type="button" key={side} className="gp-buy" style={color?{'--team':color}:undefined} disabled={!open||price==null}
   onClick={()=>onPick(side,{price,marketChance})}>
   <span>{team.abbr}</span>{pregame?<small className="gp-buy-pregame">Pregame {odds(price)}</small>:<><b>{cents(marketChance)}</b>{price!=null&&<small>{odds(price)}</small>}</>}
  </button>;})}</div>;
}

// One line when the game calls for it (Nov 8): close late, a comeback, the
// underdog ahead, an upset at the end (game-predictor-core.liveAlert).
function LiveAlert({prediction,chart}){
 const alert=liveAlert(chart?.sport||prediction.sport,chart,prediction);
 if(!alert)return null;
 return <p className={`gp-alert is-${alert.kind}`} key={alert.text} role="status">{alert.kind==='close'?<Zap size={15} aria-hidden="true"/>:<Flame size={15} aria-hidden="true"/>}{alert.text}</p>;
}

// Under the chart in a game: the last play, and the run going now.
function LastPlay({prediction,chart}){
 if(chart?.state!=='in')return null;
 const last=chart.feed?.last,run=runText(chart.feed?.run,prediction,chart.sport);
 if(!last&&!run)return null;
 const color=last?.side&&teamColor(prediction[last.side]);
 return <div className="gp-lastplay">
  {last&&<p key={`${last.when}${last.text}`} style={color?{'--team':color}:undefined}><small>{last.when}</small><span>{last.text}</span></p>}
  {run&&<p className="gp-run" key={run}><Flame size={14} aria-hidden="true"/>{run}</p>}
 </div>;
}

// Who outscored whom in each stretch of the game (three minutes in the NBA,
// five in the NFL), lined up under the chart: the home team's above the
// line, the away team's below, taller the more they won it by.
function Momentum({prediction,chart}){
 const stretches=chart?.momentum||[],length=chart?.clock?.length;
 if(!length||!stretches.length||!['in','post'].includes(chart.state))return null;
 const most=Math.max(6,...stretches.map(item=>Math.abs(item.home-item.away)));
 const colorOf=side=>teamColor(prediction[side]);
 return <div className="gp-momentum" style={{'--home':colorOf('home')||'#e9e9e9','--away':colorOf('away')||'#8f8f8f'}}>
  <div className="gp-momentum-bars" role="img" aria-label="Points won in each stretch of the game">
   {stretches.map((item,index)=>{const net=item.home-item.away;
    return <span key={item.start} className={net>0?'is-home':net<0?'is-away':'is-even'} title={`${gameClockText(item.start,chart.sport).replace(' left','')}: ${prediction.away.abbr} ${item.away}, ${prediction.home.abbr} ${item.home}`}
     style={{left:`${item.start/length*100}%`,width:`${(item.end-item.start)/length*100}%`,'--size':Math.max(net?0.14:0,Math.abs(net)/most),'--i':index}}/>;})}
  </div>
  <span className="gp-momentum-key"><small className="is-home">{prediction.home.abbr}</small><small className="is-away">{prediction.away.abbr}</small></span>
 </div>;
}

function ChanceTab({prediction,chart,onPick}){
 const side=prediction.winner,team=prediction[side];
 const live=chart?.state==='in'&&(chart?.live||[]).length>1;
 const status=pickStatus(prediction,chart);
 return <>
  <LiveAlert prediction={prediction} chart={chart}/>
  <section className="gp-sec gp-chance-sec">
   <span className="gp-kicker">{live?'Live win chance':chart?.state==='post'?'Win chance, start to finish':'Market chance'}</span>
   <TwoLineChart prediction={prediction} chart={chart}/>
   <Momentum prediction={prediction} chart={chart}/>
   {!live&&chart?.state!=='post'&&marketNote(chart,prediction)&&<p className="gp-chart-note">{marketNote(chart,prediction)}</p>}
   <LastPlay prediction={prediction} chart={chart}/>
   <PickButtons prediction={prediction} chart={chart} onPick={onPick}/>
  </section>
  <section className="gp-sec gp-ourpick" style={teamColor(team)?{'--team':teamColor(team)}:undefined}>
   <span className="gp-kicker">{status?.final?'Our pick, final':status?'Our pick, live':'Our pick'}</span>
   <div className="gp-ourpick-row">
    <Logo team={team} size={34}/>
    <span><b>{team.short||team.abbr}</b><small>{status?<>{pct(status.before)} before the game{!status.final&&status.now!=null&&<> → <span className="gp-ourpick-now">{pct(status.now)}</span> now</>}</>
     :`${prediction.confidence} confidence`}</small></span>
    {status?<strong className="gp-ourpick-result" data-tone={status.tone} key={status.result}>{status.result||pct(status.now)}</strong>:<strong>{pct(prediction.chance[side])}</strong>}
   </div>
   {prediction.score&&<p className="gp-ourpick-score">{status&&!status.final?'Our projected final':'Final score'} <b>{prediction.away.abbr} {prediction.score.away} – {prediction.score.home} {prediction.home.abbr}</b></p>}
  </section>
 </>;
}

// The game itself (Nov 8): the score by quarter, each team's top players,
// the plays that swung it most, and every player's props against his line.
function LiveTab({prediction,chart}){
 const feed=chart?.feed||{},final=chart?.state==='post';
 return <>
  {feed.quarters&&<Quarters prediction={prediction} quarters={feed.quarters} chart={chart}/>}
  {feed.leaders&&<TopPlayers prediction={prediction} leaders={feed.leaders}/>}
  {chart?.swings?.length>0&&<Swings prediction={prediction} swings={chart.swings}/>}
  <PropTracker prediction={prediction} rows={chart?.props||[]} final={final}/>
 </>;
}

function Quarters({prediction,quarters,chart}){
 const total=side=>chart?.[side]?.score??quarters[side].reduce((sum,value)=>sum+(value||0),0);
 return <Section title="Score by quarter" className="gp-quarters">
  <table>
   <thead><tr><th scope="col"><span className="gp-sr">Team</span></th>{quarters.labels.map(label=><th scope="col" key={label}>{label}</th>)}<th scope="col">T</th></tr></thead>
   <tbody>{['away','home'].map(side=><tr key={side} style={teamColor(prediction[side])?{'--team':teamColor(prediction[side])}:undefined}>
    <th scope="row"><Logo team={prediction[side]} size={20}/>{prediction[side].abbr}</th>
    {quarters[side].map((value,index)=><td key={index}>{value??'–'}</td>)}<td className="gp-quarters-total">{total(side)}</td>
   </tr>)}</tbody>
  </table>
 </Section>;
}

function TopPlayers({prediction,leaders}){
 const sides=['away','home'].filter(side=>leaders[side]?.length);
 if(!sides.length)return null;
 return <Section title="Top players" className="gp-leaders">
  {sides.map(side=><div key={side} className="gp-leaders-team" style={teamColor(prediction[side])?{'--team':teamColor(prediction[side])}:undefined}>
   <span className="gp-leaders-abbr"><Logo team={prediction[side]} size={18}/>{prediction[side].abbr}</span>
   <ul>{leaders[side].map(item=><li key={item.name+item.text}><b>{item.name}</b><span>{item.text}</span></li>)}</ul>
  </div>)}
 </Section>;
}

function Swings({prediction,swings}){
 return <Section title="Biggest swings" className="gp-swings">
  <ol>{swings.map((item,index)=>{const color=teamColor(prediction[item.side]);
   return <li key={item.at} style={{...(color?{'--team':color}:{}),'--i':index}}>
    <small>{item.when}</small><span>{item.text}</span><b>{prediction[item.side].abbr} +{Math.round(Math.abs(item.delta)*100)}%</b>
   </li>;})}</ol>
 </Section>;
}

// Every player's prop lines in this game against what he has so far (Nov 8,
// the owner's pick of the ideas): his count, the line, a bar toward it, and
// how many more he needs; the closest first. The first eight, then all.
function PropTracker({prediction,rows,final}){
 const [all,setAll]=useState(false);
 if(!rows.length)return null;
 const shown=all?rows:rows.slice(0,8);
 return <Section title={final?'Player props, final':'Player props live'} className="gp-props">
  <ul>{shown.map((row,index)=>{const done=propProgress(row,final);const color=teamColor(prediction[row.side]);
   return <li key={`${row.name}|${row.stat}`} style={{...(color?{'--team':color}:{}),'--i':index}} data-hit={done.hit?'':undefined} data-miss={done.miss?'':undefined}>
    {row.headshot?<img className="gp-props-face" src={row.headshot} alt="" width={34} height={34} loading="lazy"/>:<span className="gp-props-face" aria-hidden="true"/>}
    <span className="gp-props-who"><b>{row.short||row.name}</b><small>{row.stat}{row.minutes?` · ${Math.round(row.minutes)} min`:''}</small></span>
    <span className="gp-props-count"><b>{row.now}</b><small>/ {row.line}</small></span>
    <span className="gp-props-left">{done.hit&&<Check size={13} aria-hidden="true"/>}{done.text}</span>
    <i className="gp-props-bar" aria-hidden="true"><span style={{transform:`scaleX(${done.share})`}}/></i>
   </li>;})}</ul>
  {rows.length>8&&<button type="button" className="gp-props-more" onClick={()=>setAll(value=>!value)}>{all?'Show fewer':`Show all ${rows.length}`}<ChevronDown size={15} aria-hidden="true" style={all?{transform:'rotate(180deg)'}:undefined}/></button>}
 </Section>;
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
const STORY_TAGS={chance:'The odds',teams:'Offense vs defense',player:'Player to watch',injuries:'Injuries',form:'Form',home:'Home and away',extras:'Also',confidence:'How sure we are'};

// The analyst write-up (Nov 7, the owner's brief: the pick, why, the matchup
// that matters, what could go wrong, injuries, moneyline value, a verdict).
// The pick's numbers are worked out by the server (game_predictor.pick_block);
// the sections are written from the app's own data and checked there. With
// none (Groq unavailable, an NFL game), the plain write-up stands.
function useAnalysis(sport,event,on){
 const [state,setState]=useState({});
 const asked=useRef(null);
 useEffect(()=>{
  if(!on||!event||asked.current===event)return undefined;
  asked.current=event;
  let stop=false;
  setState({loading:true});
  call({action:'game-analysis',sport,event}).then(data=>{if(!stop)setState({data});}).catch(error=>{if(!stop){asked.current=null;setState({error:error.message});}});
  return()=>{stop=true;};
 },[sport,event,on]);
 return state;
}
const ANALYSIS_SECTIONS=[['why','Why our model favors them'],['matchup','The matchup that matters'],['risk','What could go wrong'],['injuries','Injuries and rotation'],['value','Moneyline value'],['verdict','Final verdict']];
const signed=(value,digits=1)=>value==null?'—':`${value>0?'+':value<0?'−':''}${Math.abs(value).toFixed(digits)}`;
function PickBlock({pick}){
 if(!pick)return null;
 const tone=pick.verdict==='Positive value'?'up':pick.verdict==='Negative value'?'down':undefined;
 const rows=[
  ['Projected winner',pick.winner],
  ['Projected score',pick.score?.winner!=null?`${pick.score.winner}-${pick.score.loser}`:'—'],
  ['Model win chance',pct(pick.modelChance,1)],
  [`Moneyline${pick.book?` (${pick.book})`:''}`,odds(pick.moneyline)],
  ['Market chance, no vig',pick.noVigChance!=null?`${pct(pick.noVigChance,1)} (${pct(pick.impliedChance,1)} with vig)`:'—'],
  ['Model edge',pick.edge!=null?`${signed(pick.edge*100)} pts`:'—'],
  ['Expected return',pick.expectedReturnPerDollar!=null?`${signed(pick.expectedReturnPerDollar*100,0)}¢ per $1`:'—'],
 ];
 return <section className="gp-sec gp-thepick">
  <div className="gp-thepick-head"><span className="gp-kicker">The pick</span><b data-tone={tone}>{pick.verdict}</b></div>
  <dl>{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
 </section>;
}
function Analysis({state,prediction}){
 const data=state.data;
 if(state.loading&&!data)return <section className="gp-sec gp-analysis-wait"><span className="gp-kicker">Writing the analysis…</span><Shimmer rows={4}/></section>;
 return <>
  <PickBlock pick={data?.pick}/>
  {data?.sections?<section className="gp-sec gp-analysis">
   {ANALYSIS_SECTIONS.filter(([key])=>data.sections[key]).map(([key,title],index)=><article key={key} style={{'--i':index}}>
    <h4>{title}</h4>{String(data.sections[key]).split(/\n\s*\n/).map((part,at)=><p key={at}>{part}</p>)}
   </article>)}
  </section>:<Story prediction={prediction}/>}
 </>;
}
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
// One line a day: "Today", "Tomorrow", then "Sun 8" (Nov 7, the owner:
// "Make this look cleaner"); the picked one on a gliding soft pill.
const dayName=day=>day.top==='Today'||day.top==='Tomorrow'?day.top:`${day.top} ${String(day.date).replace(/\D+/g,'')}`;
function DayStrip({days,value,onChange}){
 const row=useRef(null),ink=useInk(row,value,'[aria-checked=true]');
 return <div className="gp-daystrip" role="radiogroup" aria-label="Day" ref={row}>
  <span className="gp-day-ink" style={inkStyle(ink)} aria-hidden="true"/>
  {days.map(day=><button type="button" role="radio" key={day.key} aria-checked={value===day.key} aria-label={`${day.top} ${day.date}`} onClick={()=>onChange(day.key)}>
   {dayName(day)}
  </button>)}
 </div>;
}

// A small pill showing its choice; tapped, a short list under it. Used for
// the league, the order and what the parlays are built by, so the three sit
// on one row instead of three rows of buttons.
function ChipMenu({label,value,options,onChange}){
 const [open,setOpen]=useState(false);
 const wrap=useRef(null);
 useEffect(()=>{
  if(!open)return undefined;
  const away=event=>{if(!wrap.current?.contains(event.target))setOpen(false);};
  const key=event=>{if(event.key==='Escape')setOpen(false);};
  document.addEventListener('pointerdown',away);document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('pointerdown',away);document.removeEventListener('keydown',key);};
 },[open]);
 const current=options.find(option=>option.key===value)||options[0];
 return <div className="gp-menu" ref={wrap}>
  <button type="button" className="gp-menu-pill" aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${current.text}`} onClick={()=>setOpen(old=>!old)}>
   {current.short||current.text}<ChevronDown size={15} aria-hidden="true"/>
  </button>
  {open&&<div className="gp-menu-list" role="listbox" aria-label={label}>
   {options.map((option,index)=><React.Fragment key={option.key}>
    {option.group&&option.group!==options[index-1]?.group&&<span className="gp-menu-group">{option.group}</span>}
    <button type="button" role="option" aria-selected={option.key===value} onClick={()=>{onChange(option.key);setOpen(false);}}>
     {option.text}{option.key===value&&<Check size={15} aria-hidden="true"/>}
    </button>
   </React.Fragment>)}
  </div>}
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
   <div className="gp-menus">
    <ChipMenu label="League" value={which} onChange={setWhich} options={LEAGUES.map(([key,text])=>({key,text:key==='both'?'NBA + NFL':text}))}/>
    <ChipMenu label="Order" value={sort} onChange={setSort} options={[{key:'likely',text:'Most likely'},{key:'value',text:'Best value'}]}/>
    <ChipMenu label="Parlays" value={mode==='payout'?`p${payout}`:`l${legs}`}
     onChange={key=>{const amount=Number(key.slice(1));if(key[0]==='p'){setMode('payout');setPayout(amount);}else{setMode('legs');setLegs(amount);}}}
     options={[...PAYOUTS.map(value=>({key:`p${value}`,text:`Pays ${value}x or more`,short:`Pays ${value}x+`,group:'By payout'})),
      ...LEG_COUNTS.map(value=>({key:`l${value}`,text:`${value} legs`,group:'By legs'}))]}/>
   </div>
  </div>
  {state.loading&&!board?<Shimmer rows={5}/>
  :state.error&&!board?<Empty icon={RefreshCw} title="The generator can't load right now" text={admin?state.error:null}>
   <button type="button" className="gp-soft" onClick={()=>setTries(n=>n+1)}><RefreshCw size={15} aria-hidden="true"/>Try again</button></Empty>
  :!games.length?(day===days[0].key?<Empty title="No games left today" text="Today's games have started or finished.">
    <button type="button" className="gp-soft" onClick={()=>setDay(days[1].key)}>See tomorrow<ChevronRight size={15} aria-hidden="true"/></button></Empty>
   :<Empty title={`No games ${when}`} text="Pick another day or league."/>)
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

// The member's picks (Nov 8, the owner: "Now how can we make this look
// better"): the record in one row, then the picks in three groups: on now
// (the score from the pick's side, the time left, its chance now), still to
// come (taken back with the x until it starts), settled (won or lost and
// what it paid). Each row leads with the picked team's logo.
function HistoryView({state,live,admin,onRetry,onRemove}){
 const {data,error,loading}=state;
 const record=data?.record;
 const items=data?.items||[];
 if(loading&&!data)return <Shimmer rows={5}/>;
 if(error&&!data)return <Empty icon={RefreshCw} title="Your picks can't load right now" text={admin?error:null}>
  <button type="button" className="gp-soft" onClick={onRetry}><RefreshCw size={15} aria-hidden="true"/>Try again</button></Empty>;
 if(!items.length)return <Empty icon={Trophy} title="No picks yet" text="Open a game, tap a team and swipe up to save it here."/>;
 const groups=historyGroups(items,live);
 const lost=record?(record.games||0)-(record.correct||0):0;
 const head=(title,count)=><h3 className="gp-day-head">{title}<small>{count} {count===1?'pick':'picks'}</small></h3>;
 let at=0;
 const rows=(list,kind)=><ul className="gp-picks">{list.map(item=><PickRow key={item.id} item={item} kind={kind} index={at++} onRemove={onRemove}/>)}</ul>;
 return <div className="gp-history">
  {record?.games>0&&<dl className="gp-hstats">
   <div><dt>Record</dt><dd>{record.correct}-{lost}<small>{pct(record.pct)}</small></dd></div>
   {record.money?<div><dt>Profit</dt><dd data-tone={record.money.profit>0?'up':record.money.profit<0?'down':undefined}>{moneyText(record.money.profit,true)}<small>on {moneyText(record.money.staked)}</small></dd></div>:null}
   {record.units!=null?<div><dt>Units</dt><dd data-tone={record.units>0?'up':record.units<0?'down':undefined}>{unitsText(record.units).replace(/ units?$/,'')}<small>{Math.abs(record.units)===1?'unit':'units'}</small></dd></div>:null}
  </dl>}
  {groups.live.length>0&&<section className="gp-picks-group is-live">{head('Live',groups.live.length)}{rows(groups.live,'live')}</section>}
  {groups.upcoming.length>0&&<section className="gp-picks-group">{head('Upcoming',groups.upcoming.length)}{rows(groups.upcoming,'upcoming')}</section>}
  {groups.settled.length>0&&<section className="gp-picks-group">{head('Settled',groups.settled.length)}{rows(groups.settled,'settled')}</section>}
 </div>;
}

function PickRow({item,kind,index,onRemove}){
 const team=item[item.side]||{};
 const result=resultOf(item);
 const color=teamColor(team);
 const live=item.live;
 const win=winOf(item.stake,item.price);
 let sub,right;
 if(kind==='live'){
  const state=pickScoreText(live),final=live.state==='post';
  sub=<span className="gp-pick-score">{live.away!=null?<>{item.away.abbr} <b>{live.away}</b> – <b>{live.home}</b> {item.home.abbr}</>:`${item.away.abbr} @ ${item.home.abbr}`}
   <span className="gp-pick-clock">{final?'Final':<><i className="gp-pulse" aria-hidden="true"/>{liveText(live.detail)||'Live'}</>}</span></span>;
  right=<><b data-tone={state.tone} key={state.text}>{state.text}</b><small>{!final&&live.chance!=null?`${pct(live.chance)} now`:item.stake?`${moneyText(item.stake)} to win ${moneyText(win)}`:'1 unit'}</small></>;
 }else if(kind==='upcoming'){
  sub=`${item.away.abbr} @ ${item.home.abbr} · ${startText(item.startsAt)}`;
  right=item.stake?<><b>{moneyText(item.stake)}</b><small>to win {moneyText(win)}</small></>:<><b>{pct(item.chance)}</b><small>our chance</small></>;
 }else{
  sub=`${item.away.abbr} @ ${item.home.abbr} · ${dayText(item.startsAt)} · ${item.result.away}-${item.result.home}`;
  right=<><b data-tone={result==='win'?'up':result==='loss'?'down':undefined}>{item.result.profit!=null?moneyText(item.result.profit,true):unitsText(item.result.units)}</b>
   <small>{result==='win'?'Won':result==='loss'?'Lost':'Push'}{item.stake?` · ${moneyText(item.stake)}`:''}</small></>;
 }
 return <li className="gp-pickrow" data-kind={kind} data-result={result} style={{...(color?{'--team':color}:{}),'--i':Math.min(index,12)}}>
  <span className="gp-pickrow-logo"><Logo team={team} size={34}/>
   {kind==='settled'&&(result==='win'||result==='loss')&&<i className="gp-pickrow-mark" aria-label={result==='win'?'Won':'Lost'}>{result==='win'?<Check size={11} strokeWidth={3}/>:<X size={11} strokeWidth={3}/>}</i>}</span>
  <span className="gp-pickrow-main"><b>{team.abbr} to win <em>{odds(item.price)}</em></b><small>{sub}</small></span>
  <span className="gp-pickrow-right">{right}</span>
  {kind==='upcoming'?<button type="button" className="gp-pickrow-x" onClick={()=>onRemove(item)} aria-label={`Take back the ${team.abbr} pick`}><X size={16}/></button>:<span className="gp-pickrow-x" aria-hidden="true"/>}
 </li>;
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
 // The games on now, for the list and for the member's picks on now.
 const pendingPicks=useMemo(()=>(history.data?.items||[]).filter(item=>!item.result).map(item=>({id:item.id,state:'pre',startsAt:item.startsAt,home:item.home,away:item.away})),[history.data]);
 const liveList=useLiveList(sport,open?[]:view==='history'?pendingPicks:view==='predict'?slate.games:[]);
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
  <div className="gp-list-bg" aria-hidden="true"/>
  <div className="gp-aurora" aria-hidden="true"/>
  <header className="gp-top">
   <div className="gp-title">
    <h2>Game Predictor</h2>
    <p>{view!=='history'&&recordText(record)?<>Record <b>{recordText(record)}</b></>:'NBA and NFL winners, scores and moneylines'}</p>
   </div>
   {view!=='generate'&&<Segmented options={SPORTS} value={sport} onChange={pickSport} label="League"/>}
  </header>
  <Tabs value={view} onChange={pickView}/>
  <div className="gp-view" key={view}>
   {view==='predict'&&<PredictView slate={slate} live={liveList} onOpen={openGame} admin={admin} onRetry={()=>setTries(n=>n+1)}/>}
   {view==='generate'&&<Generator league={sport} admin={admin}/>}
   {view==='history'&&<HistoryView state={history} live={liveList} admin={admin} onRetry={()=>{setHistory({loading:true});loadHistory();}} onRemove={removePick}/>}
  </div>

 </div>;
}
