import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ChevronDown,RefreshCw,Trophy,TriangleAlert} from 'lucide-react';
import {LEAGUE_LOGOS} from './league-logos';
import {isMoneylinePlay,topMoneylines} from './moneyline-view';
import './moneylines.css';

// The Moneylines page: every game's fair price (the sharp books' consensus,
// our ratings' tilt), the best price to bet it at, and the plays -- with the
// record of every play posted (moneyline_model.py).
const LEAGUES=[['nfl','NFL'],['mlb','MLB'],['nhl','NHL'],['wnba','WNBA']];
const PREF='krazy-moneylines';
const TIERS={elite:'Elite setup',strong:'Strong play',play:'Play',lean:'Lean only'};
const signed=price=>price==null?'—':price>0?`+${price}`:`${price}`;
const pct=(value,digits=0)=>value==null?'—':`${(value*100).toFixed(digits)}%`;
const edge=value=>value==null?'—':`${value>=0?'+':'−'}${Math.abs(value*100).toFixed(1)}%`;
const unitsText=value=>value==null?'—':`${value>0?'+':value<0?'−':''}${Math.abs(value).toFixed(2).replace(/0$/,'')}u`;
const when=iso=>{const time=Date.parse(iso||'');if(!Number.isFinite(time))return '';const date=new Date(time),today=new Date();
 const clock=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 return date.toDateString()===today.toDateString()?`Today ${clock}`:`${date.toLocaleDateString([],{weekday:'short'})} ${clock}`;};
const day=iso=>{const time=Date.parse(iso||'');return Number.isFinite(time)?new Date(time).toLocaleDateString([],{month:'short',day:'numeric'}):'';};
function readPref(){try{return JSON.parse(localStorage.getItem(PREF)||'{}')||{};}catch{return {};}}

async function getJson(url,signal){
 const response=await fetch(url,{signal,cache:'no-store',credentials:'same-origin'});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok||payload.error)throw new Error(payload.error||'Moneylines are temporarily unavailable.');
 return payload;
}

function Logo({src,label}){
 const [bad,setBad]=useState(false);
 return src&&!bad?<img className="ml2-logo" src={src} alt="" onError={()=>setBad(true)}/>
  :<span className="ml2-logo ml2-logo-empty">{String(label||'').slice(0,3)}</span>;
}

// A team from the game: ESPN's names and logo when matched, else the books'.
const TWO_WORD=['Red Sox','White Sox','Blue Jays','Maple Leafs','Red Wings','Blue Jackets','Golden Knights'];
function team(game,side){
 const espn=game.espn?.[side]||{};
 const name=game[`${side}Name`];
 return {name,short:espn.short||TWO_WORD.find(tail=>name.endsWith(tail))||name.split(' ').slice(-1)[0],abbr:espn.abbr||name.split(' ').map(word=>word[0]).join('').slice(0,3),
  logo:espn.logo,record:espn.record,probable:espn.probable,score:espn.score};
}

// The win-chance bar: the model's chance for each side, two segments, the
// pick's side in the accent.
function ChanceBar({game,away,home}){
 const [tip,setTip]=useState(null);
 const homeChance=game.model?.home??game.fair?.home;
 if(homeChance==null)return null;
 const pick=game.pick?.side;
 const rows=[['away',away,1-homeChance,game.fair?.away],['home',home,homeChance,game.fair?.home]];
 return <div className="ml2-bar" onPointerLeave={()=>setTip(null)}>
  <div className="ml2-bar-track">{rows.map(([side,info,chance,market])=>
   <button type="button" key={side} className={pick===side?'is-pick':''} style={{flexGrow:Math.max(chance,0.02)}}
    aria-label={`${info.short} ${pct(chance,1)} win chance, market ${pct(market,1)}`}
    onPointerEnter={()=>setTip(side)} onFocus={()=>setTip(side)} onBlur={()=>setTip(null)}/>)}</div>
  <div className="ml2-bar-labels"><span>{away.abbr} <b>{100-Math.round(homeChance*100)}%</b></span><span><b>{Math.round(homeChance*100)}%</b> {home.abbr}</span></div>
  {tip&&<div className={`ml2-tip is-${tip}`} role="status">{rows.filter(([side])=>side===tip).map(([side,info,chance,market])=><React.Fragment key={side}>
   <b>{pct(chance,1)}</b><span>{info.short} to win</span>
   <small>Market {pct(market,1)}{game.model?.ratingHome!=null?` · ratings ${pct(side==='home'?game.model.ratingHome:1-game.model.ratingHome,1)}`:''}</small></React.Fragment>)}</div>}
 </div>;
}

function SideRow({game,side,info}){
 // Against the Fair price beside it: green is a book paying more than fair.
 const best=game.best?.[side],fairOdds=game.fair?.[`${side}Odds`],ev=game.marketEv?.[side];
 const pick=game.pick?.side===side&&game.pick.tier!=='lean';
 return <div className={`ml2-side${pick?' is-pick':''}`}>
  <Logo src={info.logo} label={info.abbr}/>
  <div className="ml2-team"><b><span className="ml2-full">{info.name}</span><span className="ml2-short">{info.short}</span></b>
   <span>{[info.record,info.probable].filter(Boolean).join(' · ')||(side==='home'?'Home':'Away')}</span></div>
  <div className="ml2-num"><small>Market fair</small><b>{signed(fairOdds)}</b></div>
  <div className="ml2-num ml2-best"><small>{best?.bookName||'Best'}</small><b>{signed(best?.price)}</b></div>
  <div className={`ml2-num ml2-edge ${ev>=0?'is-up':'is-down'}`}><small>vs fair</small><b>{edge(ev)}</b></div>
 </div>;
}

const UNIT={points:'pts',runs:'runs',goals:'goals'};
const round1=value=>Math.abs(value)>=10?Math.round(Math.abs(value)):Math.abs(value).toFixed(Math.abs(value)<1?2:1);
// A factor's pull, as the team it favors: "+5.5 pts KC".
const pull=(margin,away,home,unit)=>`+${round1(margin)} ${UNIT[unit]||unit} ${margin>=0?home.abbr:away.abbr}`;
const ordinal=n=>`${n}${n%100>=11&&n%100<=13?'th':['th','st','nd','rd'][n%10]||'th'}`;
const figure=value=>value==null?'—':Math.abs(value)>=10?value.toFixed(1):value.toFixed(2);

function Form({games}){
 if(!games?.length)return <span className="ml2-dim">—</span>;
 return <span className="ml2-form">{games.map((game,index)=><i key={index} className={`r-${game.result||'x'}`} title={`${game.home?'vs':'@'} ${game.opponent||''} ${game.score||''}`}>{game.result||'·'}</i>)}</span>;
}

// Each team side by side: what it has done, where it plays, who is out.
function Compare({game,away,home}){
 const teams=game.matchup?.teams||{};
 const a=teams.away||{},h=teams.home||{};
 const rows=[
  ['Record',a.record||away.record||'—',h.record||home.record||'—'],
  ['Road / home',a.venueRecord?`${a.venueRecord} on the road`:'—',h.venueRecord?`${h.venueRecord} at home`:'—'],
  ['Last 5',<Form games={a.form}/>,<Form games={h.form}/>],
  [`Scores / game`,a.stats?<>{figure(a.stats.for)} <small className="ml2-rank">{ordinal(a.stats.forRank)}</small></>:'—',h.stats?<>{figure(h.stats.for)} <small className="ml2-rank">{ordinal(h.stats.forRank)}</small></>:'—'],
  [`Allows / game`,a.stats?<>{figure(a.stats.against)} <small className="ml2-rank">{ordinal(a.stats.againstRank)}</small></>:'—',h.stats?<>{figure(h.stats.against)} <small className="ml2-rank">{ordinal(h.stats.againstRank)}</small></>:'—'],
 ];
 const starter=pitcher=>pitcher?.name?<>{pitcher.name}{pitcher.hand?` (${pitcher.hand})`:''}<small>{[pitcher.era!=null&&`${pitcher.era.toFixed(2)} ERA`,pitcher.whip!=null&&`${pitcher.whip.toFixed(2)} WHIP`,pitcher.k9!=null&&`${pitcher.k9.toFixed(1)} K/9`].filter(Boolean).join(' · ')}</small></>:'TBD';
 if(a.starter||h.starter)rows.push(['Starter',starter(a.starter),starter(h.starter)]);
 if(a.bullpen!=null||h.bullpen!=null)rows.push(['Bullpen, last 3 days',a.bullpen!=null?`${a.bullpen} IP`:'—',h.bullpen!=null?`${h.bullpen} IP`:'—']);
 if(a.goalie||h.goalie)rows.push(['Likely goalie',...[a.goalie,h.goalie].map(g=>g?<>{g.name}<small>{g.savePct!=null?`${g.savePct.toFixed(3).replace(/^0/,'')} save %`:''}{g.backup?' · backup':''}</small></>:'—')]);
 const hurt=list=>list==null?'—':list.length?<ul className="ml2-hurt">{list.slice(0,3).map(player=><li key={player.name}><b>{player.name}</b> <small>{[player.position,player.status].filter(Boolean).join(' · ')}</small></li>)}</ul>:<span className="ml2-dim">None listed</span>;
 rows.push(['Injuries',hurt(a.injuries),hurt(h.injuries)]);
 return <table className="ml2-compare" aria-label="Team comparison">
  <thead><tr><th/><th><Logo src={away.logo} label={away.abbr}/>{away.abbr}</th><th><Logo src={home.logo} label={home.abbr}/>{home.abbr}</th></tr></thead>
  <tbody>{rows.map(([label,left,right])=><tr key={label}><th scope="row">{label}</th><td>{left}</td><td>{right}</td></tr>)}</tbody>
 </table>;
}

function Matchup({game,away,home}){
 const m=game.matchup;
 if(!m)return <p className="ml2-dim">Matchup details show up when the game is on ESPN's schedule.</p>;
 const model=game.model||{};
 const fairHome=game.fair?.home;
 const views=[
  model.base!=null&&['Ratings',model.base,null],
  model.margin!=null&&['With the matchup',model.margin,model.ratingHome],
 ].filter(Boolean);
 const moved=m.movement&&fairHome!=null&&m.movement.open!=null?fairHome-m.movement.open:null;
 return <div className="ml2-matchup">
  <MatchupGrades game={game} away={away} home={home}/>
  <section>
   <h4>What moves our number</h4>
   <div className="ml2-views">
    {views.map(([label,margin,chance])=><div key={label}><span>{label}</span><b>{margin>=0?home.abbr:away.abbr} by {round1(margin)} {UNIT[m.unit]}</b>{chance!=null&&<small>{pct(Math.max(chance,1-chance))} to win</small>}</div>)}
    {m.espn&&<div><span>ESPN's model</span><b>{m.espn.home>=0.5?home.abbr:away.abbr} {pct(Math.max(m.espn.home,m.espn.away))}</b><small>to win</small></div>}
    <div><span>Market</span><b>{fairHome>=0.5?home.abbr:away.abbr} {pct(Math.max(fairHome,1-fairHome))}</b><small>no-vig consensus</small></div>
    <div className="is-ours"><span>Combined prediction</span><b>{model.home>=0.5?home.abbr:away.abbr} {pct(Math.max(model.home,model.away),1)}</b><small>{model.tilt?`${model.tilt>0?home.abbr:away.abbr} +${Math.abs(model.tilt*100).toFixed(1)} percentage points vs market`:'the market'}</small></div>
   </div>
   {m.factors.length>0?<ul className="ml2-factors">{m.factors.map(item=><li key={item.key}>
    <span className={`ml2-pull ${item.margin>=0?'is-home':'is-away'}`}>{pull(item.margin,away,home,m.unit)}</span>
    <div><b>{item.label}</b>{item.text&&<small>{item.text}</small>}</div></li>)}</ul>
    :<p className="ml2-dim">No matchup factor moves this one: it comes down to the ratings and the price.</p>}
  </section>
  <section><h4>Side by side</h4><Compare game={game} away={away} home={home}/></section>
  {(m.h2h?.meetings?.length>0||m.h2h?.summary)&&<section><h4>Head to head</h4>
   {m.h2h.summary&&<p className="ml2-series">{m.h2h.summary}</p>}
   <ul className="ml2-meetings">{m.h2h.meetings.map((meeting,index)=>{
    const homeName=meeting.homeName?team({homeName:meeting.homeName,awayName:meeting.awayName},'home').short:meeting.home;
    const awayName=meeting.awayName?team({homeName:meeting.homeName,awayName:meeting.awayName},'away').short:meeting.away;
    return <li key={index}><span>{day(meeting.date)}</span><b>{awayName} {meeting.awayScore} @ {homeName} {meeting.homeScore}</b></li>;})}</ul></section>}
  {moved!=null&&Math.abs(moved)>=0.005&&<section><h4>Line movement</h4>
   <p className="ml2-series">Opened {home.abbr} {pct(m.movement.open)} ({signed(americanOf(m.movement.open))}), now {pct(fairHome)} ({signed(game.fair.homeOdds)}): the market moved toward <b>{moved>0?home.short:away.short}</b>.</p></section>}
 </div>;
}
const americanOf=p=>p==null||p<=0||p>=1?null:p>=0.5?Math.round(-100*p/(1-p)):Math.round(100*(1-p)/p);

export function MatchupGrades({game,away,home}){
 const grade=game.grading;
 if(!grade)return null;
 const a=grade.teams?.away||{},h=grade.teams?.home||{};
 return <section className="ml2-grading">
  <h4>Both-team matchup grades</h4>
  <div className="ml2-grade-totals">{[['away',away,a],['home',home,h]].map(([side,info,row])=><div key={side}>
   <span>{info.abbr} matchup</span><b>{row.matchupScore==null?'Unavailable':`${Math.round(row.matchupScore)} / 100`}</b>
   <small>{row.sample||0} current-season games</small></div>)}</div>
  <p className="ml2-dim">Grades describe matchup strength—not win percentages. Offense and defense grades use scoring rates, not a complete play-by-play model.</p>
  <table className="ml2-compare" aria-label="Offense, defense and personnel grades">
   <thead><tr><th scope="col">Factor</th><th scope="col">{away.abbr}</th><th scope="col">{home.abbr}</th></tr></thead>
   <tbody>{(h.components||[]).map((c,index)=><tr key={c.key}><th scope="row">{c.label}</th>{[a.components?.[index],c].map((item,i)=><td key={i}>
    <b>{item?.score==null?'Unavailable':`${Math.round(item.score)} / 100`}</b><small>{item?.detail}</small></td>)}</tr>)}</tbody>
  </table>
  <p className="ml2-dim">Evidence coverage {pct(grade.coverage)} · {grade.neutral?'Neutral venue: no home advantage':'Home/road context included where verified'}</p>
  {grade.missing?.length>0&&<details className="ml2-caveats"><summary>Missing inputs and cautions ({grade.missing.length})</summary><ul>{grade.missing.map(note=><li key={note}>{note.replace(/^home:/,`${home.abbr}:`).replace(/^away:/,`${away.abbr}:`)}</li>)}</ul></details>}
 </section>;
}

export function Game({game}){
 const [open,setOpen]=useState(false);
 const [tab,setTab]=useState('matchup');
 const away=team(game,'away'),home=team(game,'home');
 const pick=game.pick;
 const tier=pick?.tier||'none';
 const live=game.espn?.state==='in';
 const top=[...(game.matchup?.factors||[])].sort((a,b)=>Math.abs(b.margin)-Math.abs(a.margin)).slice(0,3);
 return <article className={`ml2-game tier-${tier}`}>
  <header className="ml2-game-head">
   <span className="ml2-when">{live?<i className="ml2-live">Live</i>:null}{live?game.espn.detail:when(game.startsAt)}</span>
   <span className={`ml2-tier tier-${tier}`}>{pick?TIERS[pick.tier]:'No edge'}</span>
  </header>
  {game.espn?.note&&<p className="ml2-stage">{game.espn.note}{game.espn.series&&<span>{game.espn.series}</span>}</p>}
  <SideRow game={game} side="away" info={away}/>
  <SideRow game={game} side="home" info={home}/>
  <ChanceBar game={game} away={away} home={home}/>
  {game.prediction&&<div className="ml2-verdict">
   <div><span>Projected winner</span><b>{game.prediction.side==='home'?home.short:away.short} · {pct(game.prediction.probability,1)}</b></div>
   <div><span>Matchup grade</span><b>{game.prediction.score==null?'Unavailable':`${Math.round(game.prediction.score)} / 100`}</b></div>
   {!isMoneylinePlay(game)&&<p><b>Pass for now.</b> {game.passReason||'Lean only; no recommended stake.'}</p>}
  </div>}
  {top.length>0&&<ul className="ml2-chips" aria-label="Biggest matchup factors">{top.map(item=><li key={item.key}>
   <span>{item.label}</span><b className={item.margin>=0?'is-home':'is-away'}>{pull(item.margin,away,home,game.matchup.unit)}</b></li>)}</ul>}
  {game.target&&<p className="ml2-target"><span>Watch price · not a play</span><b><span className="ml2-full">{game.target.side==='home'?home.name:away.name}</span><span className="ml2-short">{game.target.side==='home'?home.short:away.short}</span> {signed(game.target.price)}</b>
   <em>Target unavailable. Best now {signed(game.target.best)} at {game.target.bookName}. Recheck matchup and price before betting.</em></p>}
  {pick&&pick.tier!=='lean'&&<div className="ml2-pick">
   <div><span>Bet</span><b><span className="ml2-full">{pick.side==='home'?home.name:away.name}</span><span className="ml2-short">{pick.side==='home'?home.short:away.short}</span> {signed(pick.price)}</b><em>at {pick.bookName}</em></div>
   <dl><div><dt>Conservative EV</dt><dd>{edge(pick.conservativeEv??pick.ev)}</dd></div><div><dt>Win estimate</dt><dd>{pct(pick.probability)}</dd></div>
    <div><dt>Suggested size</dt><dd>{pick.units}u</dd></div><div><dt>Minimum price</dt><dd>{signed(pick.minimumPrice)}</dd></div></dl>
   <small className="ml2-stake-note">{pick.agreement} model/market views favor this side · {pct(pick.coverage)} evidence coverage · 1u = 1% bankroll. Size uses conservative EV, not a guaranteed confidence level.</small>
  </div>}
  <button type="button" className="ml2-more" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>
   {open?'Hide the matchup':'Matchup, reasons and every book'}<ChevronDown size={15}/></button>
  {open&&<div className="ml2-detail">
   <div className="ml2-tabs" role="tablist">{[['matchup','Matchup'],['prices','Prices']].map(([key,label])=>
    <button type="button" role="tab" key={key} aria-selected={tab===key} onClick={()=>setTab(key)}>{label}</button>)}</div>
   {tab==='matchup'?<Matchup game={game} away={away} home={home}/>:<>
    <ul className="ml2-reasons">{game.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>
    <table className="ml2-books">
     <thead><tr><th>Book</th><th>{away.abbr}</th><th>{home.abbr}</th></tr></thead>
     <tbody>{game.books.map(book=><tr key={book.key} className={book.key==='pinnacle'||book.key==='betonlineag'?'is-sharp':''}>
      <td>{book.name}{(book.key==='pinnacle'||book.key==='betonlineag')&&<small>sharp</small>}</td>
      <td className={game.best?.away?.book===book.key?'is-best':''}>{signed(book.away)}</td>
      <td className={game.best?.home?.book===book.key?'is-best':''}>{signed(book.home)}</td></tr>)}</tbody>
    </table></>}
  </div>}
 </article>;
}

// The units curve: one series, running units over the graded plays, with a
// crosshair that snaps to the nearest play.
function UnitsChart({curve}){
 const [hover,setHover]=useState(null);
 const box=useRef(null);
 if(!curve?.length)return <div className="ml2-chart-empty">The curve starts with the first settled play.</div>;
 const points=[{units:0},...curve];
 const width=600,height=140,pad={l:6,r:6,t:14,b:14};
 const values=points.map(point=>point.units);
 const low=Math.min(0,...values),high=Math.max(0,...values),span=high-low||1;
 const x=index=>pad.l+index/(points.length-1||1)*(width-pad.l-pad.r);
 const y=value=>pad.t+(high-value)/span*(height-pad.t-pad.b);
 const line=points.map((point,index)=>`${index?'L':'M'}${x(index).toFixed(1)},${y(point.units).toFixed(1)}`).join('');
 const area=`${line}L${x(points.length-1).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`;
 const last=points.at(-1);
 const move=event=>{
  const rect=box.current.getBoundingClientRect();
  const at=(event.clientX-rect.left)/rect.width*width;
  let index=Math.round((at-pad.l)/(width-pad.l-pad.r)*(points.length-1));
  index=Math.max(1,Math.min(points.length-1,index));
  setHover(index);
 };
 return <div className="ml2-chart" onPointerMove={move} onPointerLeave={()=>setHover(null)}>
  <svg ref={box} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Units over the last 30 days, now ${unitsText(last.units)}`}>
   <line className="ml2-zero" x1={pad.l} x2={width-pad.r} y1={y(0)} y2={y(0)}/>
   <path className="ml2-area" d={area}/>
   <path className="ml2-line" d={line}/>
   {hover!=null&&<line className="ml2-cross" x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height-pad.b}/>}
   <circle className="ml2-dot" cx={x(points.length-1)} cy={y(last.units)} r="4.5"/>
   {hover!=null&&<circle className="ml2-dot" cx={x(hover)} cy={y(points[hover].units)} r="4.5"/>}
  </svg>
  <span className="ml2-end" style={{top:`${y(last.units)/height*100}%`}}>{unitsText(last.units)}</span>
  {hover!=null&&<div className="ml2-chart-tip" style={{left:`${Math.min(78,x(hover)/width*100)}%`}}>
   <b>{unitsText(points[hover].units)}</b><span>after {day(points[hover].at)}</span></div>}
 </div>;
}

export function Record({record}){
 const [open,setOpen]=useState(false);
 if(!record)return <div className="ml2-record is-loading" aria-hidden="true"/>;
 const month=record.summary;
 const tiles=[
  ['Record',month.plays?`${month.wins}–${month.losses}${month.pushes?`–${month.pushes}`:''}`:'—',month.pending?`${month.pending} pending`:'last 30 days'],
  ['Units',unitsText(month.plays?month.units:null),month.roi==null?'no settled plays yet':`${month.roi>=0?'+':'−'}${Math.abs(month.roi*100).toFixed(1)}% return`],
  ['Beat the close',pct(month.beatClose),month.clv==null?'no qualified closing samples':`${month.closeSamples} samples · avg ${edge(month.clv)}`],
 ];
 return <section className="ml2-record" aria-label="Track record">
  <div className="ml2-tiles">{tiles.map(([label,value,note],index)=><div key={label} className={index===1&&month.plays?(month.units>=0?'is-up':'is-down'):''}>
   <span>{label}</span><b>{value}</b><small>{note}</small></div>)}</div>
  <div className="ml2-chart-wrap"><span className="ml2-chart-title">Units, last 30 days</span><UnitsChart curve={month.curve}/></div>
  <button type="button" className="ml2-more" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>
   {open?'Hide every play':`Every play (${record.plays.length})`}<ChevronDown size={15}/></button>
  {open&&<div className="ml2-history"><table>
   <thead><tr><th>Date</th><th>Play</th><th>Price</th><th>Close</th><th>Result</th></tr></thead>
   <tbody>{record.plays.map(play=><tr key={play.id}>
    <td>{day(play.startsAt)}</td>
    <td><b>{play.team}</b><small>{play.home?'vs':'@'} {play.opponentAbbr||play.opponent}</small></td>
    <td>{signed(play.price)}<small>{play.bookName} · {play.units}u</small></td>
    <td className={play.clv==null?'':play.clv>=0?'is-up':'is-down'}>{play.clv!=null?signed(play.close?.price):'—'}<small>{play.clv==null?(play.result?'No close sample':'Not closed'):edge(play.clv)}</small></td>
    <td className={`ml2-result r-${play.result||'open'}`}>{play.result||'Open'}<small>{play.score||(play.profit!=null?unitsText(play.profit):'')}</small></td>
   </tr>)}</tbody></table></div>}
  {record.currentModel&&<div className="ml2-validation"><b>New matchup model</b><span>{record.currentModel.wins}–{record.currentModel.losses} · {unitsText(record.currentModel.units)} · {record.currentModel.pending} pending</span>
   <small>Historical plays above stay unchanged. New grades are provisional; maximum suggested size is 1u.</small>
   {record.validation&&<details><summary>Prediction tracking · {record.validation.games} settled forecasts</summary>
    <p>First pregame predictions include all games—not just recommended bets. Not yet calibrated.</p>
    <p>Brier score: {record.validation.brier?.toFixed(3)??'Awaiting results'} · Market baseline: {record.validation.marketBrier?.toFixed(3)??'Awaiting results'} (lower is better).</p>
    <table><thead><tr><th>Win estimate</th><th>Games</th><th>Predicted</th><th>Actual wins</th></tr></thead><tbody>{record.validation.bins.map(bin=><tr key={bin.label}><td>{bin.label}</td><td>{bin.games}</td><td>{pct(bin.predicted)}</td><td>{pct(bin.actual)}</td></tr>)}</tbody></table>
   </details>}
  </div>}
 </section>;
}

export function Moneylines(){
 const saved=useMemo(readPref,[]);
 const [sport,setSport]=useState(LEAGUES.some(([key])=>key===saved.sport)?saved.sport:'nfl');
 const [all,setAll]=useState(saved.all===true);
 const [board,setBoard]=useState(null);
 const [record,setRecord]=useState(null);
 const [status,setStatus]=useState('loading');
 const [error,setError]=useState('');
 const control=useRef(null);
 useEffect(()=>{try{localStorage.setItem(PREF,JSON.stringify({sport,all}));}catch{}},[sport,all]);

 const load=useCallback(async(league=sport)=>{
  control.current?.abort();
  const signal=(control.current=new AbortController()).signal;
  setStatus(old=>old==='ready'&&board?.sport===league?'refreshing':'loading');setError('');
  try{
   const payload=await getJson(`/api/board?view=moneylines&sport=${league}`,signal);
   setBoard(payload);setStatus('ready');
  }catch(problem){if(problem.name==='AbortError')return;setError(problem.message);setStatus('error');}
 },[sport,board]);
 useEffect(()=>{load(sport);},[sport]);// eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{getJson('/api/board?view=moneylines&resource=record').then(setRecord).catch(()=>setRecord({summary:{plays:0,curve:[]},plays:[]}));},[]);
 // Fresh prices when the page comes back into view after a while.
 useEffect(()=>{
  let last=Date.now();
  const back=()=>{if(document.visibilityState==='visible'&&Date.now()-last>5*60000){last=Date.now();load(sport);}};
  document.addEventListener('visibilitychange',back);
  return()=>document.removeEventListener('visibilitychange',back);
 },[sport,load]);

 const games=board?.sport===sport?board.games:[];
 const plays=topMoneylines(games);
 // Not plays yet, but within a few cents of one: the price to wait for.
 const close=games.filter(game=>game.target&&game.target.gap<=0.04).sort((a,b)=>a.target.gap-b.target.gap).slice(0,6);
 const shown=all?games:plays;
 const counts=board?.leagues||{};
 const updated=board?.updatedAt?new Date(board.updatedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):null;

 return <section className="ml2" aria-labelledby="ml2-title">
  <header className="ml2-head">
   <div><span className="ml2-eyebrow"><Trophy size={13}/>Moneylines</span><h1 id="ml2-title">Grade the matchup.</h1>
    <p>Both teams, offense, defense and available personnel context. Ranked plays require matchup support and a worthwhile price.</p></div>
  </header>

  <Record record={record}/>

  <div className="ml2-controls">
   <div className="ml2-leagues" role="tablist" aria-label="League">{LEAGUES.map(([key,label])=><button type="button" role="tab" key={key} aria-selected={sport===key} onClick={()=>setSport(key)}>
    <img src={LEAGUE_LOGOS[key]} alt="" width="18" height="18"/>{label}{counts[key]?.games>0&&<small>{counts[key].games}</small>}</button>)}</div>
   <div className="ml2-view" role="group" aria-label="Show">
    <button type="button" aria-pressed={!all} onClick={()=>setAll(false)}>Top plays{status==='ready'&&<small>{plays.length}</small>}</button>
    <button type="button" aria-pressed={all} onClick={()=>setAll(true)}>All predictions{status==='ready'&&<small>{games.length}</small>}</button>
   </div>
   <button type="button" className="ml2-refresh" onClick={()=>load(sport)} disabled={status==='loading'||status==='refreshing'} aria-label="Refresh prices">
    <RefreshCw size={15} className={status==='refreshing'||status==='loading'?'ml2-spin':''}/>{updated&&<span>{updated}</span>}</button>
  </div>

  {status==='loading'&&<div className="ml2-list" aria-busy="true">{[0,1,2].map(n=><div key={n} className="ml2-game is-skeleton"/>)}</div>}
  {status==='error'&&<div className="ml2-empty"><TriangleAlert size={20}/><b>{error}</b><button type="button" onClick={()=>load(sport)}>Try again</button></div>}
  {(status==='ready'||status==='refreshing')&&<>
   {shown.length
    ?<div className="ml2-list">{shown.map(game=><Game key={game.id} game={game}/>)}</div>
    :<div className="ml2-empty"><b>{games.length?'No plays right now':'No games on the board'}</b>
     <span>{games.length?'No matchup currently clears the evidence and conservative price requirements. We do not force bets.':'Lines post a few days before each game.'}</span>
     {games.length>0&&<button type="button" onClick={()=>setAll(true)}>See all {games.length} predictions</button>}</div>}
   {!all&&close.length>0&&<section className="ml2-close" aria-labelledby="ml2-close-title">
    <h2 id="ml2-close-title">Watch prices · not current plays</h2>
    <div className="ml2-list">{close.map(game=><Game key={game.id} game={game}/>)}</div>
   </section>}
  </>}
 </section>;
}
