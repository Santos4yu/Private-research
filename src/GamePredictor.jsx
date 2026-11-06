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
//  - History: every prediction kept and how often it was right.
// A section the admin switches on (site_controls 'predictor'), off until then.
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {AlertTriangle,CalendarDays,Check,ChevronDown,Flame,Gauge,Info,Layers,RefreshCw,ShieldCheck,Trophy,UserX,X} from 'lucide-react';
import {useIsAdmin} from './admin-notice.js';
import {useInk,inkStyle} from './use-ink.js';
import {SPORTS,americanOf,byText,clockText,dayOptions,evText,groupByDay,likeliest,lineText,mergeBoards,odds,parlays,paysText,pct,pull,recordText,resultOf,startText,twoCalls,unitsText,valueRows} from './game-predictor-core.js';
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

function PredictView({slate,results,open,onOpen,admin,onRetry}){
 const games=slate.games||[];
 if(slate.loading&&!games.length)return <Shimmer rows={5}/>;
 if(slate.error&&!games.length)return <Empty icon={RefreshCw} title="The games can't load right now" text={admin?slate.error:null}>
  <button type="button" className="gp-soft" onClick={onRetry}><RefreshCw size={15} aria-hidden="true"/>Try again</button></Empty>;
 if(!games.length)return <Empty title="No games on the schedule" text="Check back closer to the next games."/>;
 return <div className="gp-days">{groupByDay(games).map(day=><section key={day.key} className="gp-day">
  <h3 className="gp-day-head">{day.label}<small>{day.games.length} {day.games.length===1?'game':'games'}</small></h3>
  <ul className="gp-games">{day.games.map((game,index)=><GameItem key={game.id} game={game} index={index} open={open===game.id}
   result={results[game.id]} onOpen={()=>onOpen(game)} admin={admin}/>)}</ul>
 </section>)}</div>;
}

function GameItem({game,index,open,result,onOpen,admin}){
 const host=useRef(null);
 const ready=Boolean(result?.data);
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
    :ready?<Prediction prediction={result.data}/>:null)}
  </div></div>
 </li>;
}

function Prediction({prediction}){
 return <div className="gp-prediction">
  <Verdict prediction={prediction}/>
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

function Generator({league,admin,onSaved}){
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
   if(boards.length)onSaved?.();
  });
  return()=>control.abort();
 },[day,which,tries,onSaved]);
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

function HistoryView({state,admin,onRetry}){
 const {data,error,loading}=state;
 const record=data?.record;
 const items=data?.items||[];
 if(loading&&!data)return <Shimmer rows={5}/>;
 if(error&&!data)return <Empty icon={RefreshCw} title="The history can't load right now" text={admin?error:null}>
  <button type="button" className="gp-soft" onClick={onRetry}><RefreshCw size={15} aria-hidden="true"/>Try again</button></Empty>;
 return <div className="gp-history">
  {record?.games?<dl className="gp-stats">
   <div className="is-lead"><dt>Picks right</dt><dd>{pct(record.pct)}<small>{record.correct} of {record.games}</small></dd></div>
   {record.ours?.games?<div><dt>Our model alone</dt><dd>{record.ours.correct}<small>of {record.ours.games}</small></dd></div>:null}
   {record.market?.games?<div><dt>Favorites won</dt><dd>{record.market.correct}<small>of {record.market.games}</small></dd></div>:null}
   {record.scoreMiss!=null&&<div><dt>Score off by</dt><dd>{record.scoreMiss.toFixed(1)}<small>pts</small></dd></div>}
   {record.bets?.count?<div><dt>Value bets</dt><dd data-tone={record.bets.units>0?'up':record.bets.units<0?'down':undefined}>{unitsText(record.bets.units)}<small>{record.bets.count} {record.bets.count===1?'bet':'bets'}</small></dd></div>:null}
  </dl>:null}
  {!items.length?<Empty icon={Trophy} title="No predictions yet" text="Every game is predicted twice a day; open one under Predict to see it now."/>
  :<ul className="gp-history-list">{items.map((item,index)=>{const result=resultOf(item);const pick=item[item.pick];return <li key={item.id} data-result={result} style={{'--i':Math.min(index,12)}}>
   <span className="gp-history-mark" aria-label={result}>{result==='win'?<Check size={14}/>:result==='loss'?<X size={14}/>:<i/>}</span>
   <span className="gp-history-game"><b>{item.away.abbr} @ {item.home.abbr}</b><small>{startText(item.startsAt)}</small></span>
   <span className="gp-history-pick"><b><Logo team={pick} size={18}/>{pick.abbr} {pct(item.chance)}</b>{item.score&&<small>Said {item.score.away}-{item.score.home}</small>}</span>
   <span className="gp-history-final">{item.result?<><b>{item.result.away}-{item.result.home}</b><small>Final</small></>:<small>Pending</small>}</span>
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
  call({action:'game-predict',sport,event:game.id}).then(data=>{setResults(old=>({...old,[game.id]:{data}}));loadHistory();})
   .catch(error=>setResults(old=>({...old,[game.id]:{error:error.message}})));
 };
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
   {view==='predict'&&<PredictView slate={slate} results={results} open={open} onOpen={openGame} admin={admin} onRetry={()=>setTries(n=>n+1)}/>}
   {view==='generate'&&<Generator league={sport} admin={admin} onSaved={loadHistory}/>}
   {view==='history'&&<HistoryView state={history} admin={admin} onRetry={()=>{setHistory({loading:true});loadHistory();}}/>}
  </div>
 </div>;
}
