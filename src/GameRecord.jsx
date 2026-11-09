// The admin's record in History (Nov 9, the owner: "Is there any way to see
// our full record for the props and moneylines and can we get the past ones?
// I want to be able to see the overall record for admin only tho so for admin
// just automatically put it in history").
//  - Moneylines: every game the model picked in the league shown
//    (game_record.py), kept on its own and settled from the final score. The
//    first time it opens, the season so far is filled in a step at a time
//    (each past game called the way it would have been that morning).
//  - Props: the prop generator's plays (kept from the day it started), the
//    Props tab's top picks summed up a day at a time, and the posted record
//    (the Results page), all from slip_ledger.py.
import React,{useEffect,useState} from 'react';
import {Check,Minus,X} from 'lucide-react';
import {Empty,Segmented,Shimmer} from './gp-parts.jsx';
import {odds,pct,unitsText} from './game-predictor-core.js';
import {dayBars,decidedOf,gameRow,rateOf,recordText,shortDay} from './game-record-core.js';
import './game-record.css';

const KINDS=[['moneylines','Moneylines'],['props','Props']];
const LEVELS=['High','Medium','Low'];
const STRENGTH_WORDS={best:'Best bets',strong:'Strong plays',play:'Plays'};
const TIER_WORDS={elite:'Elite',strong:'Strong',lean:'Lean'};
const SPORT_WORDS={nba:'NBA',nfl:'NFL',mlb:'MLB',wnba:'WNBA',nhl:'NHL',cfb:'College football',soccer:'Soccer'};
// Fill steps a visit may take (each up to about 30 s on the server).
const FILL_STEPS=40;

async function getJson(url,options={}){
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'The record is unavailable right now.');
 return data;
}

/** The league's moneyline record, the season so far filled in on the way. */
function useMoneylines(sport){
 const [state,setState]=useState({loading:true});
 const [filling,setFilling]=useState(null);
 useEffect(()=>{
  let live=true;
  const load=()=>getJson(`/api/prediction?action=game-record&sport=${sport}`);
  setState({loading:true});setFilling(null);
  (async()=>{
   try{
    let data=await load();
    if(!live)return;
    setState({data});
    for(let step=0;live&&data.remaining>0&&step<FILL_STEPS;step++){
     setFilling({remaining:data.remaining});
     const made=await getJson('/api/prediction?action=game-record-fill',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sport})});
     data=await load();
     if(!live)return;
     setState({data});
     // Nothing could be filled right now (ESPN not answering): try on the next visit.
     if(!made.added)break;
    }
   }catch(error){if(live)setState(old=>({data:old.data,error:error.message}));}
   finally{if(live)setFilling(null);}
  })();
  return()=>{live=false;};
 },[sport]);
 return {...state,filling};
}

function useProps(on){
 const [state,setState]=useState({loading:true});
 useEffect(()=>{
  if(!on)return undefined;
  let live=true;
  getJson('/api/prediction?action=game-prop-record&sport=nba').then(data=>{if(live)setState({data});}).catch(error=>{if(live)setState({error:error.message});});
  return()=>{live=false;};
 },[on]);
 return state;
}

const tone=value=>value>0?'up':value<0?'down':undefined;

// The big line: the record, how often right, the units.
function Headline({tally,units,label,note}){
 const rate=rateOf(tally);
 return <div className="gr-head">
  <span className="gr-head-main"><b>{recordText(tally)}</b>{rate!=null&&<em>{pct(rate)}</em>}</span>
  {units!=null&&<strong data-tone={tone(units)}>{unitsText(units)}</strong>}
  <small>{[label,note].filter(Boolean).join(' · ')}</small>
 </div>;
}

// Rows of a split: what it is, the record, a bar of how often it hit (the
// middle mark is 50%), the units when there are any.
function Split({title,rows}){
 const shown=rows.filter(([,tally])=>decidedOf(tally)>0);
 if(!shown.length)return null;
 return <div className="gr-block"><h4>{title}</h4><ul className="gr-split">{shown.map(([label,tally],index)=>{
  const rate=rateOf(tally);
  return <li key={label} style={{'--i':index}}>
   <span className="gr-split-name">{label}<small>{recordText(tally)}{tally.units!=null?` · ${unitsText(tally.units)}`:''}</small></span>
   <span className="gr-split-bar"><i style={{'--w':rate??0}}/></span>
   <b>{pct(rate)}</b>
  </li>;
 })}</ul></div>;
}

// Each day with games, wins up and losses down. Tap a day for it.
function DayChart({days}){
 const bars=dayBars(days,30);
 const [picked,setPicked]=useState(null);
 if(bars.length<2)return null;
 const shown=picked!=null?bars[picked]:bars[bars.length-1];
 return <div className="gr-block"><h4>Day by day<small>{bars.length} days</small></h4>
  <div className="gr-days" role="img" aria-label={bars.map(bar=>`${shortDay(bar.day)} ${bar.wins}-${bar.losses}`).join(', ')}>
   {bars.map((bar,index)=><button type="button" key={bar.day} className="gr-day" data-picked={shown===bar||undefined} style={{'--i':index}}
    onClick={()=>setPicked(index)} onPointerEnter={event=>{if(event.pointerType==='mouse')setPicked(index);}} aria-label={`${shortDay(bar.day)}: ${bar.wins}-${bar.losses}`}>
    <span className="gr-day-up"><i style={{'--h':bar.up}}/></span><span className="gr-day-down"><i style={{'--h':bar.down}}/></span>
   </button>)}
  </div>
  <p className="gr-days-note"><b>{shortDay(shown.day)}</b> {shown.wins}-{shown.losses}{shown.units!=null?<span data-tone={tone(shown.units)}> · {unitsText(shown.units)}</span>:null}
   <span className="gr-key"><i className="is-win"/>Right<i className="is-loss"/>Wrong</span></p>
 </div>;
}

const Mark=({result})=>result==='win'?<i className="gr-mark" data-result="win"><Check size={11} strokeWidth={3} aria-label="Right"/></i>
 :result==='loss'?<i className="gr-mark" data-result="loss"><X size={11} strokeWidth={3} aria-label="Wrong"/></i>
 :<i className="gr-mark"><Minus size={11} strokeWidth={3} aria-label={result==='push'?'Push':'Still to play'}/></i>;

function Games({items}){
 const [all,setAll]=useState(false);
 if(!items?.length)return null;
 const shown=all?items:items.slice(0,12);
 return <div className="gr-block"><h4>Every pick<small>newest first</small></h4><ul className="gr-games">{shown.map((entry,index)=>{
  const row=gameRow(entry);
  return <li key={entry.id} style={{'--i':Math.min(index,12)}}>
   <Mark result={row.result}/>
   <span className="gr-game-main"><b>{row.team} over {row.against}{entry.price!=null?<em>{odds(entry.price)}</em>:null}</b>
    <small>{[shortDay(entry.day),row.score||'Still to play'].filter(Boolean).join(' · ')}</small></span>
   <span className="gr-game-right"><b>{pct(entry.chance)}</b><small>{entry.market!=null?`market ${pct(entry.market)}`:'our chance'}</small></span>
  </li>;
 })}</ul>
 {items.length>12&&!all&&<button type="button" className="gp-soft gr-more" onClick={()=>setAll(true)}>Show all {items.length}</button>}
 </div>;
}

function Moneylines({sport}){
 const {data,error,loading,filling}=useMoneylines(sport);
 if(loading&&!data)return <Shimmer rows={3}/>;
 if(error&&!data)return <p className="gp-note gr-note">{error}</p>;
 const record=data.record,league=sport.toUpperCase();
 const progress=filling?<p className="gr-filling"><span className="gr-filling-dot" aria-hidden="true"/>Replaying the season so far: {filling.remaining} {filling.remaining===1?'game':'games'} to go</p>:null;
 // Past games re-run afterwards, kept apart from the live picks.
 const replay=record.replay?.games?<div className="gr-block"><h4>Season replay<small>{shortDay(record.replay.since)} to {shortDay(record.replay.through)}</small></h4>
  <Headline tally={record.replay} units={record.replay.units} label={`${record.replay.games} past ${league} games re-run with only what was known before each one. Not live picks.`}/></div>:null;
 if(!record.games)return <>{progress}<Empty title={`No finished live ${league} picks yet`} text="Every game the model picks before tip-off shows here once it's final."/>{replay}</>;
 return <>
  <Headline tally={record} units={record.units} label={`${record.games} live ${league} picks${record.since?` since ${shortDay(record.since)}`:''}`}
   note={record.pending?`${record.pending} still to play`:null}/>
  {progress}
  <dl className="gp-hstats gr-stats">
   <div><dt>Last 7 days</dt><dd>{recordText(record.last7)}<small>{pct(record.last7.pct)}{record.last7.units!=null?` · ${unitsText(record.last7.units)}`:''}</small></dd></div>
   <div><dt>Last 30 days</dt><dd>{recordText(record.last30)}<small>{pct(record.last30.pct)}{record.last30.units!=null?` · ${unitsText(record.last30.units)}`:''}</small></dd></div>
  </dl>
  <DayChart days={record.days}/>
  <Split title="Favorite or underdog" rows={[['Took the market\'s favorite',record.favorites],['Took the underdog',record.underdogs]]}/>
  <Split title="By confidence" rows={LEVELS.map(level=>[`${level} confidence`,record.confidence?.[level]])}/>
  <Games items={data.items}/>
  {replay}
 </>;
}

function PropPlays({plays}){
 const [all,setAll]=useState(false);
 if(!plays?.length)return null;
 const shown=all?plays:plays.slice(0,10);
 return <><ul className="gr-games">{shown.map((play,index)=>{
  const result=play.result==='hit'?'win':play.result==='miss'?'loss':play.result==='push'||play.result==='void'?'push':null;
  return <li key={`${play.day}-${play.player}-${play.stat}`} style={{'--i':Math.min(index,10)}}>
   <Mark result={result}/>
   <span className="gr-game-main"><b>{play.player}</b>
    <small>{[`Over ${play.line} ${String(play.stat||'').toLowerCase()}`,shortDay(play.day),play.value!=null?`had ${play.value}`:play.result==='void'?'didn\'t play':'still to play',
     STRENGTH_WORDS[play.strength]?.replace(/s$/,'')].filter(Boolean).join(' · ')}</small></span>
   <span className="gr-game-right"><b>{play.confidence??'—'}</b><small>confidence</small></span>
  </li>;
 })}</ul>
 {plays.length>10&&!all&&<button type="button" className="gp-soft gr-more" onClick={()=>setAll(true)}>Show all {plays.length}</button>}</>;
}

function Props(){
 const {data,error,loading}=useProps(true);
 if(loading&&!data)return <Shimmer rows={3}/>;
 if(error&&!data)return <p className="gp-note gr-note">{error}</p>;
 const {generator,board,posted}=data;
 const genStats=Object.entries(generator?.stats||{}).sort((a,b)=>decidedOf(b[1])-decidedOf(a[1]));
 return <>
  <section className="gr-part">
   <h3 className="gr-part-head">Prop generator<small>since {shortDay(generator.since)}</small></h3>
   {decidedOf(generator.all)?<>
    <Headline tally={generator.all} label="NBA plays" note={generator.pending?`${generator.pending} still to play`:null}/>
    <dl className="gp-hstats gr-stats">
     <div><dt>Last 7 days</dt><dd>{recordText(generator.last7)}<small>{pct(generator.last7.rate)}</small></dd></div>
     <div><dt>Last 30 days</dt><dd>{recordText(generator.last30)}<small>{pct(generator.last30.rate)}</small></dd></div>
    </dl>
    <DayChart days={generator.days}/>
    <Split title="By strength" rows={Object.entries(STRENGTH_WORDS).map(([key,label])=>[label,generator.strengths?.[key]])}/>
    <Split title="By stat" rows={genStats}/>
   </>:<p className="gp-note gr-note">{generator.pending?`${generator.pending} ${generator.pending===1?'play':'plays'} kept so far, still to play. `:''}Every play the generator shows is kept from now on and settled from the box score.</p>}
   <PropPlays plays={generator.latest}/>
  </section>
  <section className="gr-part">
   <h3 className="gr-part-head">Props tab top picks<small>{board.since?`${shortDay(board.since)} to ${shortDay(board.through)}`:'the last 40 days'}</small></h3>
   {decidedOf(board.all)?<>
    <Headline tally={board.all} label="Elite, Strong and Lean overs the site graded" note={`${board.days} days`}/>
    <Split title="By grade" rows={Object.entries(TIER_WORDS).map(([key,label])=>[label,board.tiers?.[key]])}/>
    <Split title="By sport" rows={Object.entries(board.sports||{}).map(([sport,counts])=>[SPORT_WORDS[sport]||sport.toUpperCase(),counts.all])}/>
   </>:<p className="gp-note gr-note">The last 40 days are being added up, a few days at a time. Check back in an hour.</p>}
  </section>
  {posted?.picks>0&&<section className="gr-part">
   <h3 className="gr-part-head">Posted record<small>Results page, last {posted.days} days</small></h3>
   <Split title="By grade" rows={['elite','strong','lean','risky','fade'].map(tier=>[tier[0].toUpperCase()+tier.slice(1),posted.tiers?.[tier]])}/>
  </section>}
 </>;
}

/** The admin's record, on top of History. */
export function GameRecord({sport}){
 const [kind,setKind]=useState('moneylines');
 return <section className="gr" aria-label="Our record">
  <div className="gr-top"><h2>Our record</h2>
   <Segmented options={KINDS} value={kind} onChange={setKind} label="Record"/></div>
  {kind==='moneylines'?<Moneylines key={sport} sport={sport}/>:<Props/>}
 </section>;
}
