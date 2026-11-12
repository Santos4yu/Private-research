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
// Nov 12, the owner: "organize these and add dates and use a date chart to
// show the props and record for that day wether it's for nfl or nba or both
// sports". So: NBA / NFL / Both; a calendar (each day with picks marked green
// or red by how it went) to see one day's record and picks, or all dates;
// and the picks grouped under their date, each date with its own record.
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {CalendarDays,Check,ChevronDown,ChevronLeft,ChevronRight,Minus,X} from 'lucide-react';
import {Empty,Segmented,Shimmer} from './gp-parts.jsx';
import {odds,pct,unitsText} from './game-predictor-core.js';
import {byDay,dayKey,dayTallies,dayTone,decidedOf,gameRow,longDay,mergeTally,monthGrid,rateOf,recordText,shortDay} from './game-record-core.js';
import './game-record.css';

const KINDS=[['moneylines','Moneylines'],['props','Props']];
const LEAGUES=[['nba','NBA'],['nfl','NFL'],['both','Both']];
const LEAGUE_WORDS={nba:'NBA',nfl:'NFL',both:'NBA + NFL'};
const STRENGTH_WORDS={best:'Best bets',strong:'Strong plays',play:'Plays'};
// Fill steps a visit may take (each up to about 30 s on the server).
const FILL_STEPS=40;
// Dates shown at first in the list, more on a tap.
const DAYS_SHOWN=5;

async function getJson(url,options={}){
 const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'The record is unavailable right now.');
 return data;
}

/** A league's moneyline record, the season so far filled in on the way (only while `on`). */
function useMoneylines(sport,on=true){
 const [state,setState]=useState({loading:true});
 useEffect(()=>{
  if(!on)return undefined;
  let live=true;
  const load=()=>getJson(`/api/prediction?action=game-record&sport=${sport}`);
  setState(old=>old.data?old:{loading:true});
  (async()=>{
   try{
    let data=await load();
    if(!live)return;
    setState({data});
    for(let step=0;live&&data.remaining>0&&step<FILL_STEPS;step++){
     const made=await getJson('/api/prediction?action=game-record-fill',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sport})});
     data=await load();
     if(!live)return;
     setState({data});
     // Nothing could be filled right now (ESPN not answering): try on the next visit.
     if(!made.added)break;
    }
   }catch(error){if(live)setState(old=>({data:old.data,error:error.message}));}
  })();
  return()=>{live=false;};
 },[sport,on]);
 return state;
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

/** One day's picks: each league's moneylines, or the generator's plays (the NBA's). */
function useDay(kind,sports,day){
 const [state,setState]=useState({});
 const key=`${kind}|${sports.join(',')}|${day||''}`;
 useEffect(()=>{
  if(!day){setState({});return undefined;}
  let live=true;
  setState({loading:true});
  const jobs=kind==='moneylines'?sports.map(sport=>getJson(`/api/prediction?action=game-record&sport=${sport}&day=${day}`).then(data=>(data.items||[]).map(item=>({...item,sport:item.sport||sport}))))
   :sports.includes('nba')?[getJson(`/api/prediction?action=game-prop-record&sport=nba&day=${day}`).then(data=>data.day||null)]:[];
  Promise.all(jobs).then(results=>{if(live)setState({data:kind==='moneylines'?results.flat():results[0]||null});}).catch(error=>{if(live)setState({error:error.message});});
  return()=>{live=false;};
 },[key]); // eslint-disable-line react-hooks/exhaustive-deps
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

const Mark=({result})=>result==='win'?<i className="gr-mark" data-result="win"><Check size={11} strokeWidth={3} aria-label="Right"/></i>
 :result==='loss'?<i className="gr-mark" data-result="loss"><X size={11} strokeWidth={3} aria-label="Wrong"/></i>
 :<i className="gr-mark"><Minus size={11} strokeWidth={3} aria-label={result==='push'?'Push':'Still to play'}/></i>;

// A team's logo from ESPN's CDN by league and abbreviation (the record keeps
// only the abbreviations); its letters when the picture can't load.
const logoOf=(sport,abbr)=>abbr?`https://a.espncdn.com/i/teamlogos/${sport==='nfl'?'nfl':'nba'}/500/${String(abbr).toLowerCase()}.png`:null;
function TeamLogo({sport,abbr,size=34}){
 const [bad,setBad]=useState(false);
 const src=logoOf(sport,abbr);
 return src&&!bad?<img className="gr-logo" src={src} alt="" width={size} height={size} loading="lazy" onError={()=>setBad(true)}/>
  :<span className="gr-logo gr-logo-empty" style={{width:size,height:size}}>{String(abbr||'').slice(0,3)}</span>;
}

// ---------------------------------------------------------------- the calendar

function DatePick({day,onDay,marks}){
 const [open,setOpen]=useState(false);
 const today=dayKey(new Date());
 const start=()=>{const date=day?new Date(`${day}T12:00:00`):new Date();return {year:date.getFullYear(),month:date.getMonth()};};
 const [view,setView]=useState(start);
 const wrap=useRef(null);
 useEffect(()=>{if(open)setView(start());},[open]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{
  if(!open)return undefined;
  const away=event=>{if(!wrap.current?.contains(event.target))setOpen(false);};
  const key=event=>{if(event.key==='Escape')setOpen(false);};
  document.addEventListener('pointerdown',away);document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('pointerdown',away);document.removeEventListener('keydown',key);};
 },[open]);
 const marked=useMemo(()=>Object.keys(marks).sort(),[marks]);
 // The day before or after with picks.
 const step=direction=>{
  const next=direction<0?[...marked].reverse().find(item=>item<day):marked.find(item=>item>day);
  if(next)onDay(next);
 };
 const month=dir=>setView(old=>{const date=new Date(old.year,old.month+dir,1);return {year:date.getFullYear(),month:date.getMonth()};});
 const pick=value=>{onDay(value);setOpen(false);};
 const title=new Date(view.year,view.month,1).toLocaleDateString('en-US',{month:'long',year:'numeric'});
 return <div className="gr-date" ref={wrap}>
  {day&&<button type="button" className="gr-date-step" aria-label="The day before with picks" disabled={!marked.some(item=>item<day)} onClick={()=>step(-1)}><ChevronLeft size={16} aria-hidden="true"/></button>}
  <button type="button" className="gr-date-btn" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>
   <CalendarDays size={15} aria-hidden="true"/><span>{day?longDay(day,today):'All dates'}</span><ChevronDown size={14} aria-hidden="true"/></button>
  {day&&<button type="button" className="gr-date-step" aria-label="The day after with picks" disabled={!marked.some(item=>item>day)} onClick={()=>step(1)}><ChevronRight size={16} aria-hidden="true"/></button>}
  {open&&<div className="gr-cal" role="dialog" aria-label="Pick a day">
   <div className="gr-cal-head">
    <button type="button" aria-label="The month before" onClick={()=>month(-1)}><ChevronLeft size={16} aria-hidden="true"/></button>
    <b>{title}</b>
    <button type="button" aria-label="The month after" onClick={()=>month(1)}><ChevronRight size={16} aria-hidden="true"/></button>
   </div>
   <div className="gr-cal-week" aria-hidden="true">{['Su','Mo','Tu','We','Th','Fr','Sa'].map(name=><span key={name}>{name}</span>)}</div>
   <div className="gr-cal-grid">{monthGrid(view.year,view.month).map(cell=>{
    const tally=marks[cell.day],mark=tally?dayTone(tally)||'pending':null;
    return <button type="button" key={cell.day} data-out={!cell.inMonth||undefined} data-today={cell.day===today||undefined} data-has={tally?'':undefined}
     aria-pressed={cell.day===day} aria-label={`${longDay(cell.day,today)}${tally?`, ${recordText(tally)}`:''}`} onClick={()=>pick(cell.day)}>
     <span>{cell.date}</span>{mark&&<i data-tone={mark}/>}</button>;})}</div>
   <div className="gr-cal-foot">
    <button type="button" aria-pressed={!day} onClick={()=>pick(null)}>All dates</button>
    <button type="button" aria-pressed={day===today} onClick={()=>pick(today)}>Today</button>
   </div>
  </div>}
 </div>;
}

// ---------------------------------------------------------------- moneylines

function PickRow({entry,index}){
 const row=gameRow(entry),sport=entry.sport||'nba';
 return <li className="gr-pick" data-result={row.result||'pending'} style={{'--i':Math.min(index,12)}}>
  <span className="gr-pick-logo"><TeamLogo sport={sport} abbr={row.team}/><Mark result={row.result}/></span>
  <span className="gr-game-main"><b className="gr-pick-call">{row.team}<i>over</i><TeamLogo sport={sport} abbr={row.against} size={18}/>{row.against}{entry.price!=null?<em>{odds(entry.price)}</em>:null}</b>
   <small>{[sport.toUpperCase(),row.score||'Still to play'].filter(Boolean).join(' · ')}</small></span>
  <span className="gr-game-right">{entry.result?.units!=null?<b data-tone={entry.result.units>0?'up':entry.result.units<0?'down':undefined}>{unitsText(entry.result.units)}</b>
   :<b>{pct(entry.chance)}</b>}</span>
 </li>;
}

// A date's header: the day (a tap opens just that day), its record and units.
function DayHead({day,tally,count,onDay}){
 return <h4 className="gr-day-head">
  <button type="button" onClick={()=>onDay(day)}>{longDay(day)}</button>
  <small>{decidedOf(tally)?<><b data-tone={dayTone(tally)}>{recordText(tally)}</b>{tally.units!=null&&<em data-tone={tone(tally.units)}>{unitsText(tally.units)}</em>}</>:`${count} still to play`}</small>
 </h4>;
}

function ByDate({items,days,onDay}){
 const [more,setMore]=useState(false);
 const groups=byDay(items);
 if(!groups.length)return null;
 const shown=more?groups:groups.slice(0,DAYS_SHOWN);
 return <div className="gr-block gr-dates">{shown.map(([day,list])=><section key={day} className="gr-date-group">
  <DayHead day={day} tally={days[day]} count={list.length} onDay={onDay}/>
  <ul className="gr-games">{list.map((entry,index)=><PickRow key={`${entry.sport}-${entry.id}`} entry={entry} index={index}/>)}</ul>
 </section>)}
 {groups.length>DAYS_SHOWN&&!more&&<button type="button" className="gp-soft gr-more" onClick={()=>setMore(true)}>Show {groups.length-DAYS_SHOWN} more dates</button>}
 </div>;
}

function Moneylines({league,sources,day,dayState,days,onDay}){
 const waiting=sources.some(source=>source.state.loading&&!source.state.data);
 if(waiting)return <Shimmer rows={3}/>;
 const failed=sources.find(source=>source.state.error&&!source.state.data);
 if(failed)return <p className="gp-note gr-note">{failed.state.error}</p>;
 const records=sources.map(source=>source.state.data?.record).filter(Boolean);
 const words=LEAGUE_WORDS[league];
 if(day){
  const tally=days[day];
  const items=dayState.data||[];
  const pending=items.filter(item=>!item.result).length;
  return <>
   <div className="gr-card"><Headline tally={tally} units={tally?.units??null} label={`${longDay(day)} · ${words}`}
    note={[`${items.length||decidedOf(tally)} picks`,pending?`${pending} still to play`:null].filter(Boolean).join(' · ')}/></div>
   {dayState.loading?<Shimmer rows={3}/>:dayState.error?<p className="gp-note gr-note">{dayState.error}</p>
    :items.length?<div className="gr-block"><ul className="gr-games">{items.map((entry,index)=><PickRow key={`${entry.sport}-${entry.id}`} entry={entry} index={index}/>)}</ul></div>
    :<Empty title={`No ${words} picks on ${shortDay(day)}`} text="Pick another day on the calendar, or All dates."/>}
  </>;
 }
 const total=mergeTally(...records);
 const games=records.reduce((sum,record)=>sum+(record.games||0),0),pending=records.reduce((sum,record)=>sum+(record.pending||0),0);
 const since=records.map(record=>record.since).filter(Boolean).sort()[0];
 // Past games re-run afterwards are not shown: only real picks count (Nov 9, the owner).
 if(!games&&!pending)return <Empty title={`No finished ${words} picks yet`} text="Every game the model picks before it starts shows here once it's final."/>;
 const items=sources.flatMap(source=>(source.state.data?.items||[]).map(item=>({...item,sport:item.sport||source.sport})))
  .sort((a,b)=>String(b.startsAt||'').localeCompare(String(a.startsAt||'')));
 return <>
  {/* Straight to the record (Nov 9, the owner: "get straight to the point of our record not all this extra stuff"). */}
  <div className="gr-card"><Headline tally={total} units={total.units} label={`${games} ${words} picks${since?` since ${shortDay(since)}`:''}`}
   note={pending?`${pending} still to play`:null}/></div>
  <ByDate items={items} days={days} onDay={onDay}/>
 </>;
}

// ---------------------------------------------------------------- props

function PropPlays({plays,grouped,days,onDay}){
 const [all,setAll]=useState(false);
 if(!plays?.length)return null;
 const row=(play,index)=>{
  const result=play.result==='hit'?'win':play.result==='miss'?'loss':play.result==='push'||play.result==='void'?'push':null;
  return <li key={`${play.day}-${play.player}-${play.stat}`} style={{'--i':Math.min(index,10)}}>
   <Mark result={result}/>
   <span className="gr-game-main"><b>{play.player}</b>
    <small>{[`Over ${play.line} ${String(play.stat||'').toLowerCase()}`,play.value!=null?`had ${play.value}`:play.result==='void'?'didn\'t play':'still to play',
     STRENGTH_WORDS[play.strength]?.replace(/s$/,'')].filter(Boolean).join(' · ')}</small></span>
   <span className="gr-game-right"><b>{play.confidence??'—'}</b><small>confidence</small></span>
  </li>;
 };
 if(!grouped)return <ul className="gr-games">{plays.map(row)}</ul>;
 const groups=byDay(plays),shown=all?groups:groups.slice(0,DAYS_SHOWN);
 return <div className="gr-dates">{shown.map(([day,list])=><section key={day} className="gr-date-group">
  <DayHead day={day} tally={days[day]} count={list.length} onDay={onDay}/>
  <ul className="gr-games">{list.map(row)}</ul></section>)}
 {groups.length>DAYS_SHOWN&&!all&&<button type="button" className="gp-soft gr-more" onClick={()=>setAll(true)}>Show {groups.length-DAYS_SHOWN} more dates</button>}</div>;
}

/** The Props tab's top picks for the league picked (all of them for Both). */
const boardTally=(entry,league)=>!entry?null:league==='both'?entry:entry.sports?.[league]||null;

function Props({league,state,day,dayState,days,onDay}){
 const {data,error,loading}=state;
 if(loading&&!data)return <Shimmer rows={3}/>;
 if(error&&!data)return <p className="gp-note gr-note">{error}</p>;
 const {generator,board}=data;
 const nba=league!=='nfl';
 const words=LEAGUE_WORDS[league];
 const boardAll=league==='both'?board.all:board.sports?.[league]?.all;
 const boardDay=day?boardTally((board.daily||[]).find(entry=>entry.day===day),league):null;
 const genDay=day&&nba?dayState.data:null;
 return <>
  {nba&&<section className="gr-part">
   <h3 className="gr-part-head">Prop generator<small>{day?longDay(day):`since ${shortDay(generator.since)}`}</small></h3>
   {day?(dayState.loading?<Shimmer rows={2}/>:genDay&&(decidedOf(genDay.tally)||genDay.pending)?<>
     <div className="gr-card"><Headline tally={genDay.tally} label={`NBA plays · ${shortDay(day)}`} note={genDay.pending?`${genDay.pending} still to play`:null}/></div>
     <PropPlays plays={genDay.plays}/>
    </>:<p className="gp-note gr-note">No generator plays on {shortDay(day)}.</p>)
   :decidedOf(generator.all)?<>
    <div className="gr-card"><Headline tally={generator.all} label="NBA plays" note={generator.pending?`${generator.pending} still to play`:null}/></div>
    <PropPlays plays={generator.latest} grouped days={dayTallies(generator.days)} onDay={onDay}/>
   </>:<p className="gp-note gr-note">{generator.pending?`${generator.pending} ${generator.pending===1?'play':'plays'} kept so far, still to play. `:''}Every play the generator shows is kept from now on and settled from the box score.</p>}
  </section>}
  {!nba&&<p className="gp-note gr-note">The prop generator plays the NBA only; the NFL's props are in the Props tab's picks below.</p>}
  <section className="gr-part">
   <h3 className="gr-part-head">Props tab top picks<small>{day?longDay(day):board.since?`${shortDay(board.since)} to ${shortDay(board.through)}`:'the last 40 days'}</small></h3>
   {day?(decidedOf(boardDay)?<div className="gr-card"><Headline tally={boardDay} label={`${words} Elite, Strong and Lean overs · ${shortDay(day)}`}/></div>
     :<p className="gp-note gr-note">No {words} top picks were graded on {shortDay(day)}.</p>)
   :decidedOf(boardAll)?<div className="gr-card"><Headline tally={boardAll} label={`${words} Elite, Strong and Lean overs the site graded`} note={`${board.days} days`}/></div>
   :<p className="gp-note gr-note">{league==='both'?'The last 40 days are being added up, a few days at a time. Check back in an hour.':`No ${words} top picks graded in the last 40 days yet.`}</p>}
  </section>
 </>;
}

/** The admin's record, on top of History. */
export function GameRecord({sport}){
 const [kind,setKind]=useState('moneylines');
 const [league,setLeague]=useState(sport==='nfl'?'nfl':'nba');
 useEffect(()=>{setLeague(sport==='nfl'?'nfl':'nba');},[sport]);
 const [day,setDay]=useState(null);
 const sports=league==='both'?['nba','nfl']:[league];
 const nba=useMoneylines('nba',kind==='moneylines'&&sports.includes('nba'));
 const nfl=useMoneylines('nfl',kind==='moneylines'&&sports.includes('nfl'));
 const props=useProps(kind==='props');
 const dayState=useDay(kind,sports,day);
 const sources=sports.map(item=>({sport:item,state:item==='nba'?nba:nfl}));
 // Each day's record for the calendar and the date headers (and today's picks still to play).
 const days=useMemo(()=>{
  if(kind==='moneylines'){
   const out=dayTallies(...sources.map(source=>source.state.data?.record?.days));
   for(const source of sources)for(const item of source.state.data?.items||[])if(item.day&&!out[item.day])out[item.day]={wins:0,losses:0,pushes:0,units:null};
   return out;
  }
  const data=props.data;if(!data)return {};
  return dayTallies(league!=='nfl'?data.generator?.days:[],(data.board?.daily||[]).map(entry=>({day:entry.day,...(boardTally(entry,league)||{})})));
 },[kind,league,nba.data,nfl.data,props.data]); // eslint-disable-line react-hooks/exhaustive-deps
 return <section className="gr" aria-label="Our record">
  <div className="gr-top"><h2>Our record</h2>
   <Segmented options={KINDS} value={kind} onChange={setKind} label="Record"/></div>
  <div className="gr-controls">
   <Segmented options={LEAGUES} value={league} onChange={setLeague} label="League"/>
   <DatePick day={day} onDay={setDay} marks={days}/>
  </div>
  {kind==='moneylines'?<Moneylines league={league} sources={sources} day={day} dayState={dayState} days={days} onDay={setDay}/>
   :<Props league={league} state={props} day={day} dayState={dayState} days={days} onDay={setDay}/>}
 </section>;
}
