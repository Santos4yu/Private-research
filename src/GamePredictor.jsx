// The Game Predictor (game_predictor.py through /api/prediction
// action=game-*): pick an NBA or NFL game, predict it, and see the winner,
// the final score, our model alone beside it blended with the line, each
// moneyline's value, what to check first, who's out, the pace,
// blowout chance and each side's best player matchup; below, every past
// prediction and how often it was right. The owner, Nov 5, with another
// app's simple "select a game, predict winner" screens. A section the admin
// switches on (site_controls 'predictor'), off until then.
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {AlertTriangle,Check,ChevronDown,Crosshair,Flame,Gauge,Info,Loader2,RefreshCw,ShieldCheck,Trophy,UserX,X} from 'lucide-react';
import {useIsAdmin} from './admin-notice.js';
import {SPORTS,americanOf,byText,evText,likeliest,lineText,odds,parlays,paysText,pct,pull,recordText,resultOf,startText,twoCalls,unitsText,valueRows} from './game-predictor-core.js';
import './game-predictor.css';

const PREF='game-predictor-sport';
const readSport=()=>{try{const value=localStorage.getItem(PREF);return SPORTS.some(([key])=>key===value)?value:'nba';}catch{return 'nba';}};
const saveSport=value=>{try{localStorage.setItem(PREF,value);}catch{/* a preference only */}};

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

// The game menu: the selected game, and the slate under it when open.
function GameMenu({games,selected,onPick,loading}){
 const [open,setOpen]=useState(false);
 const host=useRef(null);
 useEffect(()=>{
  if(!open)return undefined;
  const away=event=>{if(!host.current?.contains(event.target))setOpen(false);};
  const key=event=>{if(event.key==='Escape')setOpen(false);};
  document.addEventListener('pointerdown',away);document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('pointerdown',away);document.removeEventListener('keydown',key);};
 },[open]);
 const game=games.find(item=>item.id===selected);
 return <div className="gp-menu" ref={host}>
  <button type="button" id="gp-menu" className="gp-menu-button" aria-haspopup="listbox" aria-expanded={open} disabled={loading||!games.length} onClick={()=>setOpen(value=>!value)}>
   {game?<GameRow game={game}/>:<span className="gp-menu-empty">{loading?'Loading games…':games.length?'Select a game':'No games on the schedule'}</span>}
   <ChevronDown size={18} aria-hidden="true"/>
  </button>
  {open&&<ul className="gp-menu-list" role="listbox" aria-label="Games">{games.map(item=><li key={item.id}>
   <button type="button" role="option" aria-selected={item.id===selected} onClick={()=>{onPick(item.id);setOpen(false);}}><GameRow game={item}/></button>
  </li>)}</ul>}
 </div>;
}

function GameRow({game}){
 const live=game.state==='in';
 return <span className="gp-game-row">
  <span className="gp-game-teams"><Logo team={game.away} size={24}/><b>{game.away?.abbr}</b><i>@</i><Logo team={game.home} size={24}/><b>{game.home?.abbr}</b></span>
  <span className="gp-game-meta">{live?<em className="gp-live">Live</em>:startText(game.startsAt)}{lineText(game)&&<small>{lineText(game)}</small>}</span>
 </span>;
}

function Chance({prediction}){
 const away=prediction.chance.away,home=prediction.chance.home;
 return <div className="gp-chance">
  <div className="gp-chance-track" role="img" aria-label={`${prediction.away.abbr} ${pct(away)}, ${prediction.home.abbr} ${pct(home)}`}>
   <span className={prediction.winner==='away'?'is-pick':''} style={{flexGrow:Math.max(away,0.03)}}/>
   <span className={prediction.winner==='home'?'is-pick':''} style={{flexGrow:Math.max(home,0.03)}}/>
  </div>
  <div className="gp-chance-labels"><span>{prediction.away.abbr} <b>{pct(away)}</b></span><span><b>{pct(home)}</b> {prediction.home.abbr}</span></div>
 </div>;
}

// Our model alone beside the main call, ours blended with the line.
function TwoCalls({prediction}){
 const calls=twoCalls(prediction);
 if(!calls)return null;
 const call=(item,label,note)=>{const team=prediction[item.winner];return <div className="gp-call">
  <span className="gp-label">{label}{note&&<small>{note}</small>}</span>
  <b><Logo team={team} size={20}/>{team.abbr} {pct(item.chance[item.winner])}</b>
  <small>{byText(item.margin,prediction)}{item.score?` · ${item.score.away}-${item.score.home}`:''}</small>
 </div>;};
 return <div className="gp-calls">{call(calls.ours,'Our model')}{call(calls.blend,'With the line',calls.share)}</div>;
}

// Each moneyline: its price, the chance we give it, and what a dollar on it is worth.
function Value({prediction}){
 const rows=valueRows(prediction);
 if(!rows.length)return null;
 return <div className="gp-value">
  <span className="gp-label">Moneyline value</span>
  <ul>{rows.map(row=><li key={row.side} data-best={row.best?'':undefined}>
   <span className="gp-value-team"><Logo team={row.team} size={20}/><b>{row.team.abbr}</b><span>{row.price}</span></span>
   <span className="gp-value-ev" data-tone={row.ev>0?'up':'down'}>{row.text}</span>
   <small>{row.chance} to win · fair {row.fair}{row.ours?<> · our model {row.ours}</>:null}</small>
  </li>)}</ul>
 </div>;
}

function Warnings({prediction}){
 const items=prediction.warnings||[];
 if(!items.length)return null;
 return <section className="gp-card gp-warnings">
  <h4><AlertTriangle size={16} aria-hidden="true"/> Check first</h4>
  <ul>{items.map((item,index)=><li key={index} data-level={item.level}>
   {item.level==='info'?<Info size={15} aria-hidden="true"/>:<AlertTriangle size={15} aria-hidden="true"/>}<span>{item.text}</span>
  </li>)}</ul>
 </section>;
}

function Verdict({prediction}){
 const winner=prediction[prediction.winner];
 const score=prediction.score;
 return <section className="gp-card gp-verdict">
  <div className="gp-verdict-top">
   <Logo team={winner} size={52}/>
   <div><span className="gp-label">Predicted winner</span><h3>{winner.short||winner.name}</h3><b className="gp-big">{pct(prediction.chance[prediction.winner])} <small>to win</small></b></div>
  </div>
  {score&&<div className="gp-score" aria-label="Predicted final score">
   {['away','home'].map(side=><div key={side} className={prediction.winner===side?'is-pick':''}><Logo team={prediction[side]} size={26}/><span>{prediction[side].abbr}</span><b>{score[side]}</b></div>)}
  </div>}
  <Chance prediction={prediction}/>
  <div className="gp-tags">
   <span data-level={prediction.confidence}><ShieldCheck size={14} aria-hidden="true"/>{prediction.confidence} confidence</span>
   <span data-level={prediction.blowout.level}><Flame size={14} aria-hidden="true"/>Blowout {pct(prediction.blowout.chance)}<small>by {prediction.blowout.by}+</small></span>
   {prediction.pace&&<span data-level={prediction.pace.level}><Gauge size={14} aria-hidden="true"/>{prediction.pace.level} pace<small>{prediction.pace.value} {prediction.pace.unit}</small></span>}
  </div>
  {prediction.confidenceWhy?.length>0&&<p className="gp-why-line">{prediction.confidenceWhy.join(' · ')}</p>}
  <TwoCalls prediction={prediction}/>
  <Value prediction={prediction}/>
  <dl className="gp-views">
   {prediction.market?.spread!=null&&<div><dt>The line</dt><dd>{byText(-prediction.market.spread,prediction)}</dd></div>}
   {prediction.espn&&<div><dt>ESPN</dt><dd>{prediction.espn.home>=0.5?prediction.home.abbr:prediction.away.abbr} {pct(Math.max(prediction.espn.home,prediction.espn.away))}</dd></div>}
   {prediction.market?.moneyline?.home!=null&&<div><dt>Moneyline</dt><dd>{prediction.away.abbr} {odds(prediction.market.moneyline.away)} · {prediction.home.abbr} {odds(prediction.market.moneyline.home)}</dd></div>}
  </dl>
 </section>;
}

function Factors({prediction}){
 const rows=(prediction.factors||[]).filter(item=>Math.abs(item.points)>=0.05||item.key==='ratings');
 if(!rows.length)return null;
 return <section className="gp-card">
  <h4>What moves our number</h4>
  <ul className="gp-factors">{rows.map(item=>{const side=pull(item.points,prediction);return <li key={item.key}>
   <span className="gp-pull" data-side={side.side||'even'}>{side.side&&<Logo team={prediction[side.side]} size={16}/>}{side.text}</span>
   <div><b>{item.label}</b>{item.text&&<small>{item.text}</small>}</div>
  </li>;})}</ul>
 </section>;
}

function WhosOut({prediction}){
 const out=prediction.out;
 if(!out)return null;
 return <section className="gp-card">
  <h4><UserX size={16} aria-hidden="true"/> Who's out</h4>
  <div className="gp-two">{['away','home'].map(side=><div key={side}>
   <p className="gp-team-head"><Logo team={prediction[side]} size={20}/>{prediction[side].short||prediction[side].abbr}</p>
   {(out[side]||[]).length?<ul className="gp-out">{out[side].slice(0,6).map((player,index)=><li key={index} data-out={player.out?'':undefined}>
    <span><b>{player.name}</b><small>{[player.position,player.status,player.injury].filter(Boolean).join(' · ')}</small></span>
    {player.impact>0&&<em>−{player.impact} pts</em>}
   </li>)}</ul>:<p className="gp-dim">Nobody on the injury report.</p>}
  </div>)}</div>
 </section>;
}

const STAT_NAMES={pts:'PTS',reb:'REB',ast:'AST',fantasy:'Fantasy'};
function Players({prediction}){
 const players=prediction.players||{};
 if(!players.home&&!players.away)return null;
 return <section className="gp-card">
  <h4>Best matchup on each team</h4>
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
 </section>;
}

function Compare({prediction}){
 const teams=prediction.teams;
 if(!teams)return null;
 const rank=value=>value?.[1]?<small>{value[1]}{['th','st','nd','rd'][value[1]%10>3||[11,12,13].includes(value[1]%100)?0:value[1]%10]}</small>:null;
 const cell=value=>value?.[0]==null?'—':<>{value[0]} {rank(value)}</>;
 const rest=days=>days==null?'—':days<=1?'Back-to-back':`${days} days`;
 const last=(side)=>{const games=prediction.lastFive?.[prediction[side].abbr]||[];return games.length?<span className="gp-form">{games.map((game,index)=><i key={index} data-result={game.result}>{game.result}</i>)}</span>:'—';};
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
 return <section className="gp-card">
  <h4>Side by side</h4>
  <table className="gp-table"><thead><tr><th/><th><Logo team={prediction.away} size={20}/>{prediction.away.abbr}</th><th><Logo team={prediction.home} size={20}/>{prediction.home.abbr}</th></tr></thead>
   <tbody>{rows.map(([label,away,home])=><tr key={label}><th scope="row">{label}</th><td>{away}</td><td>{home}</td></tr>)}</tbody></table>
 </section>;
}

// Best picks (Nov 6, the owner: "the best most confident game to win and
// like I can do a pair ... at least 2x my money or 2 legs it'll give me the
// correct valued moneylines"): every game still to start, predicted
// (game-board); the most likely winners, then moneyline parlays that pay at
// least a payout or have a number of legs, the likeliest to hit (or the best
// value) first.
const PAYOUTS=[2,3,5,10],LEG_COUNTS=[2,3,4];
function Leg({leg}){
 return <li className="gp-leg">
  <Logo team={leg.team} size={22}/>
  <span><b>{leg.team.short||leg.team.abbr}</b><small>{leg.home?'vs':'@'} {leg.opponent.abbr} · {startText(leg.startsAt)}</small></span>
  <span className="gp-leg-num"><b>{pct(leg.chance)}</b><small>{odds(leg.price)}</small></span>
 </li>;
}
function BestPicks({state,admin,onRetry}){
 const [mode,setMode]=useState('payout'),[payout,setPayout]=useState(2),[legs,setLegs]=useState(2),[sort,setSort]=useState('likely');
 const {data,loading,error}=state;
 const top=useMemo(()=>likeliest(data,5),[data]);
 const combos=useMemo(()=>parlays(data,mode==='payout'?{payout,sort}:{legs,sort}),[data,mode,payout,legs,sort]);
 const held=(data?.games||[]).filter(game=>game.held).length;
 const pick=(value,label,current,set)=><button type="button" key={value} aria-pressed={current===value} onClick={()=>set(value)}>{label}</button>;
 return <section className="gp-card gp-best">
  <h4><Trophy size={16} aria-hidden="true"/> Best picks</h4>
  {loading&&!data?<div className="gp-skeleton" role="status" aria-label="Predicting every game"><span/><span/><span/></div>
  :error&&!data?<p className="gp-dim">{admin?error:'The best picks can\'t load right now.'} <button type="button" className="gp-link" onClick={onRetry}>Retry</button></p>
  :!top.length?<p className="gp-dim">No games with moneylines yet. Try again closer to the games.</p>:<>
   <div className="gp-top-pick">
    <span className="gp-label">Most likely to win</span>
    <div className="gp-top-row">
     <Logo team={top[0].team} size={44}/>
     <span><b>{top[0].team.short||top[0].team.abbr}</b><small>{top[0].home?'vs':'@'} {top[0].opponent.abbr} · {startText(top[0].startsAt)} · {top[0].confidence} confidence</small></span>
     <span className="gp-leg-num"><b>{pct(top[0].chance)}</b><small>{odds(top[0].price)}</small></span>
    </div>
   </div>
   {top.length>1&&<ul className="gp-legs">{top.slice(1).map(leg=><Leg key={leg.game} leg={leg}/>)}</ul>}
   <div className="gp-builder">
    <span className="gp-label">Build a parlay</span>
    <div className="gp-chips" role="group" aria-label="Parlay by">{pick('payout','Payout',mode,setMode)}{pick('legs','Legs',mode,setMode)}</div>
    <div className="gp-chips" role="group" aria-label={mode==='payout'?'Pays at least':'Number of legs'}>
     {mode==='payout'?PAYOUTS.map(value=>pick(value,`${value}x+`,payout,setPayout)):LEG_COUNTS.map(value=>pick(value,`${value} legs`,legs,setLegs))}
    </div>
    <div className="gp-chips" role="group" aria-label="Order">{pick('likely','Most likely',sort,setSort)}{pick('value','Best value',sort,setSort)}</div>
    {combos.length?<ol className="gp-parlays">{combos.map((combo,index)=><li key={combo.legs.map(leg=>leg.game+leg.side).join()}>
     <div className="gp-parlay-head">
      <b>Pays {paysText(combo.dec)} <small>{odds(americanOf(combo.dec))}</small></b>
      <span>{pct(combo.chance)} to hit</span>
      <span data-tone={combo.ev>0?'up':'down'}>{evText(combo.ev)} value</span>
     </div>
     <ul className="gp-legs">{combo.legs.map(leg=><Leg key={leg.game} leg={leg}/>)}</ul>
         </li>)}</ol>:<p className="gp-dim">{mode==='payout'?`No mix of these games pays ${payout}x.`:`Not enough games for ${legs} legs.`}</p>}
    {held>0&&<p className="gp-dim">{held} {held===1?'game':'games'} left out: no moneyline yet, or data to check.</p>}
   </div>
  </>}
 </section>;
}

function History({state,admin,onRetry}){
 const {data,error,loading}=state;
 const record=data?.record;
 return <section className="gp-card gp-history">
  <div className="gp-history-head"><h4>History</h4>
   {record?.games?<span className="gp-record"><b>{pct(record.pct)}</b> right</span>:null}
  </div>
  {record?.games?<dl className="gp-history-stats">
   <div><dt>Picks right</dt><dd>{record.correct} of {record.games}</dd></div>
   {record.ours?.games?<div><dt>Our model alone</dt><dd>{record.ours.correct} of {record.ours.games}</dd></div>:null}
   {record.market?.games?<div><dt>Favorites won</dt><dd>{record.market.correct} of {record.market.games}</dd></div>:null}
   {record.scoreMiss!=null&&<div><dt>Score off by</dt><dd>{record.scoreMiss.toFixed(1)} pts</dd></div>}
   {record.bets?.count?<div><dt>Value bets</dt><dd data-tone={record.bets.units>0?'up':record.bets.units<0?'down':undefined}>{unitsText(record.bets.units)} <small>{record.bets.count} {record.bets.count===1?'bet':'bets'}</small></dd></div>:null}
  </dl>:null}
  {loading&&!data?<div className="gp-skeleton" role="status" aria-label="Loading history"><span/><span/></div>
  :error&&!data?(admin?<p className="gp-dim">{error} <button type="button" className="gp-link" onClick={onRetry}>Retry</button></p>:<p className="gp-dim">No predictions yet.</p>)
  :!(data?.items||[]).length?<p className="gp-dim">No predictions yet. Pick a game above and predict it.</p>
  :<ul className="gp-history-list">{data.items.map(item=>{const result=resultOf(item);const pick=item[item.pick];return <li key={item.id} data-result={result}>
   <span className="gp-history-mark" aria-label={result}>{result==='win'?<Check size={14}/>:result==='loss'?<X size={14}/>:<i/>}</span>
   <span className="gp-history-game"><b>{item.away.abbr} @ {item.home.abbr}</b><small>{startText(item.startsAt)}</small></span>
   <span className="gp-history-pick"><b><Logo team={pick} size={16}/>{pick.abbr} {pct(item.chance)}</b>{item.score&&<small>Said {item.score.away}-{item.score.home}</small>}</span>
   <span className="gp-history-final">{item.result?<><b>{item.result.away}-{item.result.home}</b><small>Final</small></>:<small>Pending</small>}</span>
  </li>;})}</ul>}
 </section>;
}

export function GamePredictor(){
 const admin=useIsAdmin();
 const [sport,setSport]=useState(readSport);
 const [slate,setSlate]=useState({loading:true,games:[]});
 const [history,setHistory]=useState({loading:true});
 const [selected,setSelected]=useState(null);
 const [result,setResult]=useState({});
 const [tries,setTries]=useState(0);
 const [best,setBest]=useState({open:false});
 const games=slate.games||[];
 useEffect(()=>{
  const control=new AbortController();
  setSlate(old=>({loading:true,games:old.sport===sport?old.games:[],sport}));setResult({});
  call({action:'game-slate',sport},control.signal).then(data=>{
   setSlate({games:data.games||[],sport});
   setSelected(old=>(data.games||[]).some(game=>game.id===old)?old:(data.games||[]).find(game=>game.state==='pre')?.id||null);
  }).catch(error=>{if(error.name!=='AbortError')setSlate({games:[],error:error.message,sport});});
  return()=>control.abort();
 },[sport,tries]);
 const loadHistory=useMemo(()=>signal=>call({action:'game-history',sport},signal)
  .then(data=>setHistory({data})).catch(error=>{if(error.name!=='AbortError')setHistory(old=>({data:old.data,error:error.message}));}),[sport]);
 useEffect(()=>{const control=new AbortController();setHistory({loading:true});loadHistory(control.signal);return()=>control.abort();},[loadHistory]);
 const game=games.find(item=>item.id===selected);
 const predict=()=>{
  if(!game)return;
  setResult({loading:true,id:game.id});
  call({action:'game-predict',sport,event:game.id}).then(data=>{setResult({data,id:game.id});loadHistory();})
   .catch(error=>setResult({error:error.message,id:game.id}));
 };
 const shown=result.id===selected?result:{};
 const pickSport=value=>{setSport(value);saveSport(value);setSelected(null);};
 // The best picks follow the league; open, they load (and reload on a league change).
 useEffect(()=>{
  if(!best.open)return undefined;
  const control=new AbortController();
  setBest(old=>({open:true,tries:old.tries,loading:true,data:old.sport===sport?old.data:null,sport}));
  call({action:'game-board',sport},control.signal).then(data=>{setBest(old=>({open:true,tries:old.tries,data,sport}));loadHistory();})
   .catch(error=>{if(error.name!=='AbortError')setBest(old=>({open:true,tries:old.tries,error:error.message,sport}));});
  return()=>control.abort();
 },[best.open,best.tries,sport,loadHistory]);
 return <div className="game-predictor">
  <section className="gp-card gp-deck">
   <header className="gp-head">
    <span className="gp-icon"><Crosshair size={20} aria-hidden="true"/></span>
    <div><h2>Game Predictor</h2>{recordText(history.data?.record)&&<p>Record {recordText(history.data.record)}</p>}</div>
    <div className="gp-seg" role="tablist" aria-label="League">{SPORTS.map(([key,label])=>
     <button type="button" role="tab" key={key} aria-selected={sport===key} onClick={()=>pickSport(key)}>{label}</button>)}</div>
   </header>
   <label className="gp-label" htmlFor="gp-menu">Select a game</label>
   <GameMenu games={games} selected={selected} onPick={id=>setSelected(id)} loading={slate.loading}/>
   {slate.error&&admin&&<p className="gp-dim">{slate.error} <button type="button" className="gp-link" onClick={()=>setTries(n=>n+1)}><RefreshCw size={13} aria-hidden="true"/> Retry</button></p>}
   <button type="button" className="gp-primary" onClick={predict} disabled={!game||game.state!=='pre'||shown.loading}>
    {shown.loading?<><Loader2 className="gp-spin" size={17} aria-hidden="true"/>Predicting…</>:<><Crosshair size={17} aria-hidden="true"/>Predict winner</>}
   </button>
   <button type="button" className="gp-secondary" aria-pressed={best.open} onClick={()=>setBest(old=>old.open?{open:false}:{open:true})}>
    <Trophy size={16} aria-hidden="true"/>{best.open?'Hide best picks':'Best picks and parlays'}
   </button>
   {game&&game.state!=='pre'&&<p className="gp-dim">This game has started. Its prediction is in the history if one was made before tip-off.</p>}
  </section>
  {best.open&&<BestPicks state={best} admin={admin} onRetry={()=>setBest(old=>({open:true,tries:(old.tries||0)+1}))}/>}
  {shown.error&&<section className="gp-card"><p className="gp-dim">{admin?shown.error:'There isn\'t enough on this game yet. Try again closer to the start.'}</p></section>}
  {shown.data&&<>
   <Verdict prediction={shown.data}/>
   <Warnings prediction={shown.data}/>
   <Factors prediction={shown.data}/>
   <WhosOut prediction={shown.data}/>
   <Players prediction={shown.data}/>
   <Compare prediction={shown.data}/>
  </>}
  <History state={history} admin={admin} onRetry={()=>{setHistory({loading:true});loadHistory();}}/>
 </div>;
}
