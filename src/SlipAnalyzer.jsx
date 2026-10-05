import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Activity,ArrowLeftRight,ArrowRight,ArrowUpRight,Check,ChevronDown,ClipboardPaste,Crosshair,Crown,Flame,History,ImageUp,Link2,MapPin,Pencil,Plus,Repeat2,RotateCcw,Search,Trash2,TrendingDown,TrendingUp,TriangleAlert,Users,X} from 'lucide-react';
import {LEAGUE_LOGOS} from './league-logos';
import {siteFinderSportAllowed,siteIsAdmin} from './site-access';
import {finderSlipProp} from './unified-finder-data';
import {loadLines,ENRICH} from './finder-pool';
import {candidates} from './smart-slip';
import {SLIP_SPORTS,SPORT_NAMES,TIERS,checkLeg,scoreEntry,verdict,swaps,sideWord,offeredStats,judge} from './slip-check';
import {loadMatchups,withMatchups} from './slip-matchup';
import {lookupRow} from './slip-lookup';
import {teamLogoUrl} from './sports/nfl/nfl-ui-core';
import {pickBuilder} from './pick-builder-client';
import {PhoneAccountButtons} from './UnifiedFinder';
import './slip-analyzer.css';

// The Slip Analyzer (the Slip Analyzer tab): a screenshot of a slip goes
// to the server to be read (slip_reader.py); its legs are matched to the
// Finder's lines and graded here (slip-check.js), and any leg can be fixed
// by hand if it was misread.
const READ_URL='/api/prediction?action=slip-analyzer';
const STEPS=['Reading your slip','Finding the players','Checking the matchups','Grading the parlay'];
const MODIFIER_ICON={goblin:'/prizepicks/goblin.png',demon:'/prizepicks/demon.png'};
const TYPE_NAMES={power:'Power Play',flex:'Flex Play',parlay:'Parlay'};

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const percent=value=>`${Math.round(value*100)}%`;
const figure=value=>value==null?'—':String(Number(value));
const times=(value,estimated)=>`${estimated?'≈':''}${value>=10?Math.round(value):Number(value.toFixed(2))}x`;
const when=iso=>{const time=Date.parse(iso||'');if(!Number.isFinite(time))return '';const date=new Date(time),today=new Date();
 const clock=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 return date.toDateString()===today.toDateString()?clock:`${date.toLocaleDateString([],{weekday:'short'})} ${clock}`;};
const price=odds=>odds==null?'':odds>0?`+${odds}`:`−${Math.abs(odds)}`;
const pause=(ms,signal)=>new Promise(resolve=>{const id=setTimeout(resolve,ms);signal?.addEventListener('abort',()=>{clearTimeout(id);resolve();},{once:true});});
const calm=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

// Large screenshots are scaled and saved as a JPEG before they're sent:
// quicker to upload, still sharp enough to read.
async function shrink(file){
 try{
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,1280/bitmap.width,2800/bitmap.height);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.88));
  return blob||file;
 }catch{return file;}
}

async function readSlip(blob,signal){
 const response=await fetch(READ_URL,{method:'POST',headers:{'Content-Type':blob.type||'image/jpeg'},body:blob,credentials:'same-origin',signal});
 let data={};try{data=await response.json();}catch{/* handled below */}
 if(response.status===401)throw new Error('Sign in again to read slips.');
 if(data.featureDisabled)throw new Error('The Slip Analyzer is turned off right now.');
 if(!response.ok)throw Object.assign(new Error(data.error||'That screenshot couldn\'t be read. Try again.'),{detail:data.detail||''});
 if(!Array.isArray(data.legs)||!data.legs.length)throw new Error('No player props were found in that screenshot.');
 return data;
}

const LOGOS={prizepicks:'/prizepicks/logo.png'};
const appLogo=key=>key?LOGOS[key]||`/sportsbooks/${key}.png`:null;
const MLB_LOGO=id=>id?`https://www.mlbstatic.com/team-logos/${encodeURIComponent(id)}.svg`:null;
// The other team's mark, from whatever the league's line carries.
function opponentLogo(row){
 if(!row?.opponent)return null;
 if(row.opponentLogo)return row.opponentLogo;
 if(row.sport==='nfl')return teamLogoUrl(row.opponent);
 if(row.sport==='mlb')return MLB_LOGO(row.opponentTeamId);
 if(row.homeTeamAbbr===row.opponent)return row.homeTeamLogo||row.raw?.homeTeamLogo||null;
 if(row.awayTeamAbbr===row.opponent)return row.awayTeamLogo||row.raw?.awayTeamLogo||null;
 return null;
}
const teamLogo=row=>row?.teamLogo||(row?.sport==='nfl'&&row.teamAbbr?teamLogoUrl(row.teamAbbr):null);

// A number that counts up to its value as it appears.
function useCount(target,ms=900){
 const [value,setValue]=useState(()=>calm()?target:0);
 useEffect(()=>{
  if(target==null||calm()){setValue(target);return undefined;}
  let frame,start;
  const step=time=>{start??=time;const k=Math.min(1,(time-start)/ms);setValue(target*(1-(1-k)**3));if(k<1)frame=requestAnimationFrame(step);};
  frame=requestAnimationFrame(step);return()=>cancelAnimationFrame(frame);
 },[target,ms]);
 return value;
}

function Img({src,className,alt=''}){
 const [bad,setBad]=useState(false);
 useEffect(()=>setBad(false),[src]);
 return src&&!bad?<img className={className} src={src} alt={alt} loading="lazy" onError={()=>setBad(true)}/>:null;
}

function Face({row,leg,tier}){
 const [bad,setBad]=useState(false);
 const src=row?.headshot;
 useEffect(()=>setBad(false),[src]);
 const name=row?.player||leg?.player;
 const sport=row?.sport||leg?.sport;
 const badge=teamLogo(row)||LEAGUE_LOGOS[sport];
 return <span className="sa-face" data-tier={tier||undefined}>
  <span className="sa-face-photo">{src&&!bad?<img src={src} alt="" loading="lazy" onError={()=>setBad(true)}/>
   :<i>{String(name||'').split(' ').map(part=>part[0]).slice(0,2).join('')}</i>}</span>
  {badge&&<Img className="sa-face-badge" src={badge}/>}
 </span>;
}

const TIER_ICON={elite:Flame,strong:TrendingUp,lean:ArrowUpRight,risky:TriangleAlert,fade:TrendingDown};
function TierBadge({tier}){
 const Icon=TIER_ICON[tier];
 return <span className="sa-tier" data-tier={tier} title={TIERS[tier].text}><Icon size={13} strokeWidth={2.6}/>{TIERS[tier].label}</span>;
}

const rateTone=rate=>rate>=0.6?'up':rate>=0.5?'blue':rate>=0.4?'gold':'down';
const RECORDS=[['l5','L5'],['l10','L10'],['l20','L20'],['season','Season'],['h2h','H2H']];
function Records({grade,row}){
 const items=RECORDS.map(([key,label])=>[key,key==='h2h'&&row?.opponent?`vs ${row.opponent}`:label,grade.records?.[key]])
  .filter(([key,,record])=>record&&record.games>0&&!(key==='l20'&&record.games<=(grade.records.l10?.games||0))&&!(key==='season'&&record.games<=(grade.records.l20?.games||grade.records.l10?.games||0)));
 if(!items.length)return null;
 return <ul className="sa-records">{items.map(([key,label,record])=><li key={key} data-tone={rateTone(record.rate)}>
  <span>{label}</span><b>{record.won}/{record.games}</b><i style={{'--w':`${Math.round(record.rate*100)}%`}}/>
 </li>)}</ul>;
}

// The chance a pick hits, against what each pick needs for the parlay to pay its way.
function Meter({chance,need}){
 const shown=useCount(chance*100);
 return <div className="sa-meter" data-tone={rateTone(chance)}>
  <div className="sa-meter-top"><b>{Math.round(shown)}<small>%</small></b><span>to hit</span>
   {need!=null&&<em>needs {percent(need)}</em>}</div>
  <div className="sa-meter-bar"><i style={{'--w':`${Math.round(chance*100)}%`}}/>{need!=null&&<u style={{left:`${Math.round(need*100)}%`}}/>}</div>
 </div>;
}

// The last ten games against the slip's number.
function Games({row,line,side}){
 const games=(row?.gameLog||[]).slice(-10);
 if(games.length<3||line==null)return null;
 const values=games.map(game=>game.value);
 const top=Math.max(line*1.5,...values,1);
 const won=value=>side==='UNDER'?value<line:value>line;
 const hits=values.filter(won).length;
 return <div className="sa-games" role="img" aria-label={`Last ${games.length} games: ${hits} of ${games.length} on the ${side==='UNDER'?'under':'over'} side of ${line}`}>
  <div className="sa-games-head"><span>Last {games.length} games</span><b>{hits}/{games.length}</b></div>
  <div className="sa-games-plot">
   <i className="sa-games-line" style={{'--y':line/top}}><span>{figure(line)}</span></i>
   {games.map((game,index)=><span key={`${game.date}-${index}`} className="sa-games-bar" style={{'--h':`${Math.max(3,game.value/top*100)}%`,'--i':index}}
    data-result={game.value===line?'push':won(game.value)?'hit':'miss'}><b>{figure(game.value)}</b>
    {game.opponent&&typeof game.opponent==='string'&&<small>{game.opponent}</small>}</span>)}
  </div>
 </div>;
}

function Editor({leg,app,boards,onSave,onCancel}){
 const sport=leg.sport||leg.spot?.sport||'';
 const [player,setPlayer]=useState(leg.player);
 const [stat,setStat]=useState(leg.stat);
 // An unread line starts at today's board line for the stat.
 const [line,setLine]=useState(leg.line??leg.spot?.lines?.find(row=>(row.modifier||'standard')==='standard')?.line??leg.spot?.lines?.[0]?.line??'');
 const [side,setSide]=useState(leg.side||'OVER');
 const people=useMemo(()=>{
  const names=new Set();
  for(const key of sport?[sport]:SLIP_SPORTS)for(const row of boards[key]||[])names.add(row.player);
  return [...names].sort();
 },[boards,sport]);
 const stats=offeredStats(leg.spot);
 const save=event=>{event.preventDefault();const value=Number(line);if(!player.trim()||!stat.trim()||!Number.isFinite(value))return;
  onSave({player:player.trim(),stat:stat.trim(),statName:'',line:value,side,needs:[]});};
 const id=`sa-edit-${leg.key}`;
 return <form className="sa-editor" onSubmit={save}>
  <label><span>Player</span><input value={player} onChange={event=>setPlayer(event.target.value)} list={`${id}-people`} autoComplete="off"/>
   <datalist id={`${id}-people`}>{people.slice(0,400).map(name=><option key={name} value={name}/>)}</datalist></label>
  <label><span>Stat</span>{stats.length?<select value={stats.includes(stat)?stat:''} onChange={event=>setStat(event.target.value)}>
    {!stats.includes(stat)&&<option value="">{stat||'Choose a stat'}</option>}
    {stats.map(name=><option key={name} value={name}>{name}</option>)}</select>
   :<input value={stat} onChange={event=>setStat(event.target.value)}/>}</label>
  <label><span>Line</span><input type="number" inputMode="decimal" step="0.5" min="0" value={line} onChange={event=>setLine(event.target.value)}/></label>
  <div className="sa-editor-side" role="group" aria-label="Side">
   {['OVER','UNDER'].map(key=><button type="button" key={key} aria-pressed={side===key} onClick={()=>setSide(key)}>{sideWord(key,app)}</button>)}
  </div>
  <div className="sa-editor-actions"><button type="button" className="sa-btn" onClick={onCancel}>Cancel</button><button type="submit" className="sa-btn sa-btn-primary"><Check size={15}/>Check this pick</button></div>
 </form>;
}

const MISSING={
 player:leg=>leg.lookupError?`${leg.player}'s games couldn't be loaded right now. Try again in a minute.`
  :`${leg.player} couldn't be found${leg.sport?` in the ${SPORT_NAMES[leg.sport]||leg.sport.toUpperCase()}`:''}. Check the name with Fix.`,
 stat:leg=>leg.stat?`There are no ${leg.stat} numbers for ${leg.player}. Pick the stat below.`:'The stat on this pick couldn\'t be read. Pick it below.',
 needs:leg=>leg.line==null&&!leg.side?'The line and side on this pick couldn\'t be read.':`The ${leg.line==null?'line':'side'} on this pick couldn't be read.`,
 thin:()=>'Not enough games yet to grade this pick.',
};

// The case for a pick: the matchup first, then his history, splits and form.
const FACT_ICON={opponent:Crosshair,history:History,split:ArrowLeftRight,venue:MapPin,usage:Users,form:Activity};
function Case({matchup}){
 if(!matchup?.facts?.length)return null;
 return <section className="sa-case" data-tone={matchup.tone}>
  <header><b>{matchup.label}</b><span className="sa-case-score" style={{'--w':`${matchup.score}%`}}><i/><em>{matchup.score}</em></span></header>
  <ul>{matchup.facts.map(item=>{const Icon=FACT_ICON[item.kind]||Activity;
   return <li key={item.key} data-kind={item.kind} data-tone={item.tone}><Icon size={14}/><span>{item.text}</span></li>;})}</ul>
 </section>;
}

function Prop({leg,index,app,boards,need,editing,onEdit,onSave,onCancel,onRemove,saved,onKeep}){
 const row=leg.row;
 const grade=leg.grade;
 const tier=grade?.tier;
 const opponent=row?.opponent;
 const stats=leg.state==='stat'&&!grade?offeredStats(leg.spot):[];
 const average=row?.windows?.l10?.average??row?.average;
 const sport=row?.sport||leg.sport;
 return <article className="sa-prop" data-tier={tier||'none'} style={{'--i':index}}>
  <Img className="sa-prop-mark" src={teamLogo(row)}/>
  <header className="sa-prop-head">
   <Face row={row} leg={leg} tier={tier}/>
   <div className="sa-who"><b>{row?.player||leg.player}</b>
    <span className="sa-who-game">
     {sport&&<Img className="sa-who-league" src={LEAGUE_LOGOS[sport]}/>}
     {[row?.teamAbbr,row?.position].filter(Boolean).join(' · ')||SPORT_NAMES[sport]||'Player prop'}
     {opponent&&<span className="sa-who-vs"><span>{row.isHome===false?'@':'vs'}</span><Img src={opponentLogo(row)}/><span>{opponent}</span></span>}
    </span>
    {row?.startsAt&&<small>{when(row.startsAt)}</small>}</div>
   {tier?<TierBadge tier={tier}/>:<span className="sa-flag"><TriangleAlert size={13}/>{leg.state==='needs'?'Check':'No grade'}</span>}
  </header>
  <div className="sa-prop-pick">
   {leg.side?<span className="sa-side" data-side={leg.side} data-assumed={leg.assumedSide||undefined}>{sideWord(leg.side,app)}{leg.assumedSide&&'?'}</span>:<span className="sa-side" data-side="none">?</span>}
   <b>{figure(leg.line)}</b>{leg.stat?<span>{leg.stat}</span>:<span className="sa-unread">Stat?</span>}
   {MODIFIER_ICON[leg.modifier]&&<img src={MODIFIER_ICON[leg.modifier]} alt={leg.modifier} width="20" height="20"/>}
  </div>
  {leg.assumedSide&&<p className="sa-aside">The side couldn't be read, so {sideWord('OVER',app)} was assumed. Tap Fix if it was {sideWord('UNDER',app)}.</p>}
  {grade?<>
   <Meter chance={grade.chance} need={need}/>
   <Case matchup={grade.matchup}/>
   <div className="sa-form-head"><span>Recent form</span>
    <div className="sa-prop-figures">
     {finite(average)&&<span><small>Avg L10</small><b>{figure(Math.round(average*10)/10)}</b></span>}
     {grade.book!=null&&<span><small>Books</small><b>{percent(grade.book)}</b></span>}
     {leg.odds!=null&&<span><small>Your price</small><b>{price(leg.odds)}</b></span>}
    </div></div>
   <Records grade={grade} row={row}/>
   <Games row={row} line={leg.line} side={leg.side}/>
   {leg.state==='relined'&&<p className="sa-aside">Today's line is {figure(row.relinedFrom)}; this was graded at your {figure(leg.line)}.</p>}
   {grade.read?.risks?.length>0&&<ul className="sa-risks">{grade.read.risks.slice(0,2).map(risk=><li key={risk}><TriangleAlert size={12}/>{risk}</li>)}</ul>}
  </>:<div className="sa-missing"><p>{(MISSING[leg.state]||MISSING.thin)(leg)}</p>
   {leg.lookupError&&siteIsAdmin()&&<p className="sa-detail">{leg.lookupError}</p>}
   {leg.lookupError&&<div className="sa-chips"><button type="button" onClick={()=>onSave({})}><RotateCcw size={13}/>Try again</button></div>}
   {stats.length>0&&<div className="sa-chips">{stats.slice(0,8).map(name=><button type="button" key={name} onClick={()=>onSave({stat:name,statName:''})}>{name}</button>)}</div>}
  </div>}
  {editing?<Editor leg={leg} app={app} boards={boards} onSave={onSave} onCancel={onCancel}/>
   :<footer className="sa-prop-actions">
    <button type="button" onClick={onEdit}><Pencil size={14}/>Fix</button>
    {row&&<button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('vortex:open-prop',{detail:{sport:row.sport,player:row.player,stat:row.raw?.stat||row.market}}))}><Search size={14}/>Research</button>}
    {grade&&<button type="button" aria-pressed={saved} onClick={onKeep}>{saved?<Check size={14}/>:<Plus size={14}/>}{saved?'Saved':'My Slip'}</button>}
    <button type="button" className="sa-remove" onClick={onRemove} aria-label={`Remove ${leg.player}`}><Trash2 size={14}/></button>
   </footer>}
 </article>;
}

const HEADLINES={'A+':'Elite parlay','A':'Strong parlay','A-':'Strong parlay','B+':'Good parlay','B':'Playable parlay','B-':'Playable parlay',
 'C+':'Long shot','C':'Long shot','D':'Risky parlay','F':'Fade this parlay'};
const tone=letter=>({A:'up',B:'blue',C:'gold'})[letter?.[0]]||'down';

function Figure({label,value,format,sub}){
 const shown=useCount(value);
 return <div><dt>{label}</dt><dd>{value==null?'—':format(shown)}</dd>{sub&&<small>{sub}</small>}</div>;
}

function Parlay({score,slip,legs,pool,onSwap,onSaveAll,onNew,shot}){
 const options=useMemo(()=>swaps(legs,pool),[legs,pool]);
 const n=legs.length;
 const kind=`${n}-Pick ${TYPE_NAMES[score?.type]||'Parlay'}`;
 const logo=appLogo(slip.app?.key);
 const letter=score?.letter;
 const dial=useCount(score?.score??0,1100);
 const odds=score?Math.max(1,Math.round(1/score.chance)):null;
 const graded=legs.filter(leg=>leg.grade);
 return <section className="sa-parlay" data-tone={score?tone(letter):'none'}>
  <div className="sa-parlay-top">
   <div className="sa-dial" style={{'--p':dial}} aria-label={`Parlay grade ${letter||'not available'}`}>
    <svg viewBox="0 0 120 120" aria-hidden="true"><circle className="sa-dial-track" cx="60" cy="60" r="52"/>
     <circle className="sa-dial-fill" cx="60" cy="60" r="52" pathLength="100" strokeDasharray="100" strokeDashoffset={100-dial}/></svg>
    <b>{letter||'–'}</b><span>Parlay grade</span>
   </div>
   <div className="sa-parlay-main">
    <span className="sa-kind">{logo&&<Img src={logo}/>}{[slip.app?.name,kind].filter(Boolean).join(' · ')}</span>
    <h2>{score?HEADLINES[letter]:'Not graded yet'}</h2>
    <p>{score?verdict(score):'None of the picks could be graded. Fix a pick below to grade the parlay.'}</p>
    <ul className="sa-stack" aria-label="Picks">{legs.map(leg=><li key={leg.key} title={`${leg.row?.player||leg.player}${leg.grade?` · ${TIERS[leg.grade.tier].label}`:''}`}>
     <Face row={leg.row} leg={leg} tier={leg.grade?.tier}/></li>)}</ul>
   </div>
   {score&&<dl className="sa-parlay-figures">
    <Figure label="Hit chance" value={score.chance*100} format={value=>`${value<10?value.toFixed(1):Math.round(value)}%`} sub={`about 1 in ${odds}`}/>
    <Figure label="Pays" value={score.multiplier} format={value=>times(value,score.estimated)} sub={score.assumed?'usual Power Play':score.estimated?'estimated':'your slip'}/>
    <Figure label="Return per $1" value={score.value} format={value=>`$${value.toFixed(2)}`} sub="over time"/>
    <Figure label="Break-even" value={score.breakEven!=null?score.breakEven*100:null} format={value=>`${value<10?value.toFixed(1):Math.round(value)}%`} sub="all must hit"/>
   </dl>}
  </div>

  {graded.length>0&&<div className="sa-mix">
   <div className="sa-mix-bar" aria-hidden="true">{legs.map((leg,index)=><i key={leg.key} data-tier={leg.grade?.tier||'none'} style={{'--i':index}}/>)}</div>
   <ul className="sa-mix-legend">{Object.keys(TIERS).filter(key=>score.tiers[key]).map(key=><li key={key} data-tier={key}><i/>{score.tiers[key]} {TIERS[key].label}</li>)}
    {n>graded.length&&<li data-tier="none"><i/>{n-graded.length} not graded</li>}</ul>
  </div>}

  {score&&score.matchups&&<p className="sa-matchup-line"><Crosshair size={14}/>
   {score.matchups.good} of {score.total} pick{score.total===1?' has':'s have'} a good matchup{score.matchups.tough?`, ${score.matchups.tough} ${score.matchups.tough===1?'has':'have'} a tough one`:''}.</p>}
  {score&&<div className="sa-callouts">
   {score.best&&n>1&&<div className="sa-callout" data-kind="best"><Crown size={16}/><span><small>Best pick</small>
    <b>{score.best.row?.player||score.best.player}</b> {sideWord(score.best.side,slip.app)} {figure(score.best.line)} {score.best.stat} · {percent(score.best.grade.chance)}{score.best.grade.matchup?` · ${score.best.grade.matchup.label.toLowerCase()}`:''}</span></div>}
   {score.weakest&&n>1&&score.weakest!==score.best&&<div className="sa-callout" data-kind="weak"><TriangleAlert size={16}/><span><small>Weakest link</small>
    <b>{score.weakest.row?.player||score.weakest.player}</b> {sideWord(score.weakest.side,slip.app)} {figure(score.weakest.line)} {score.weakest.stat} · {percent(score.weakest.grade.chance)}{score.weakest.grade.matchup?` · ${score.weakest.grade.matchup.label.toLowerCase()}`:''}</span></div>}
   {score.shared>1&&<div className="sa-callout" data-kind="info"><Link2 size={16}/><span><small>Same game</small>{score.shared} picks share a game, so they tend to hit or miss together.</span></div>}
  </div>}

  {options.length>0&&<div className="sa-swaps"><h3>Stronger picks to swap in</h3>
   <ul>{options.map(read=><li key={read.id}>
    <Face row={read.row} leg={read.row} tier={read.tier}/>
    <span className="sa-swap-copy"><b>{read.row.player}</b><small>{sideWord(read.side,slip.app)} {figure(read.row.line)} {read.row.market}</small></span>
    <span className="sa-swap-chance">{percent(read.chance)}</span>
    <button type="button" onClick={()=>onSwap(read)} aria-label={`Swap in ${read.row.player}`}><Repeat2 size={14}/>Swap</button>
   </li>)}</ul></div>}

  <div className="sa-parlay-actions">
   <button type="button" className="sa-btn sa-btn-primary" onClick={onSaveAll} disabled={!graded.length}><Plus size={15}/>Add all to My Slip</button>
   <button type="button" className="sa-btn" onClick={onNew}><RotateCcw size={15}/>New slip</button>
   {shot&&<details className="sa-shot-peek"><summary><ImageUp size={14}/>Your screenshot<ChevronDown size={14}/></summary><img src={shot.url} alt="Your screenshot"/></details>}
  </div>
 </section>;
}

export function SlipAnalyzer(){
 const [phase,setPhase]=useState('pick');
 const [shot,setShot]=useState(null);
 const [step,setStep]=useState(0);
 const [error,setError]=useState('');
 // Why reading failed, sent to admins only.
 const [detail,setDetail]=useState('');
 const [slip,setSlip]=useState(null);
 const [legs,setLegs]=useState([]);
 const [editing,setEditing]=useState(null);
 const [pool,setPool]=useState([]);
 const [saved,setSaved]=useState(()=>new Set());
 const [over,setOver]=useState(false);
 const boards=useRef({});
 const control=useRef(null);
 const host=useRef(null);
 const input=useRef(null);
 const enrichFor=sport=>ENRICH[sport];
 // Each league's matchup tables for the sports on the slip (slip-matchup.js).
 const tables=useRef({});
 // A player who isn't on today's board (his game has started) is looked
 // up in his league and graded from his own games (slip-lookup.js).
 const options=signal=>({enrichFor,signal,tables:tables.current,sports:SLIP_SPORTS.filter(siteFinderSportAllowed),
  lookup:(leg,where)=>lookupRow(leg,{sports:where,enrich:enrichFor,signal})});

 const run=useCallback(async file=>{
  if(!file)return;
  if(!/^image\//.test(file.type||'image/')){setError('Use a screenshot (PNG, JPG or WEBP).');setPhase('error');return;}
  control.current?.abort();
  const job=new AbortController();control.current=job;const {signal}=job;
  setShot(old=>{if(old?.url)URL.revokeObjectURL(old.url);return {url:URL.createObjectURL(file)};});
  setPhase('reading');setStep(0);setError('');setDetail('');setLegs([]);setSlip(null);setEditing(null);setPool([]);setSaved(new Set());
  const sports=SLIP_SPORTS.filter(siteFinderSportAllowed);
  // Today's lines load while the screenshot is read.
  const loading=Object.fromEntries(sports.map(sport=>[sport,loadLines(sport,{signal,only:()=>false}).catch(()=>[])]));
  try{
   const body=await shrink(file);
   const started=Date.now();
   const read=await readSlip(body,signal);
   if(Date.now()-started<900)await pause(900-(Date.now()-started),signal);
   setStep(1);
   // The matchups for the sports on the slip load alongside today's lines.
   const onSlip=[...new Set(read.legs.map(leg=>leg.sport).filter(sport=>sports.includes(sport)))];
   const [rows,found]=await Promise.all([
    Promise.all(sports.map(async sport=>[sport,await loading[sport]])).then(Object.fromEntries),
    loadMatchups(onSlip.length?onSlip:sports.filter(sport=>sport!=='soccer'),{signal}).catch(error=>{if(error.name==='AbortError')throw error;return {};}),
   ]);
   boards.current=rows;tables.current=found;
   await pause(calm()?0:350,signal);
   setStep(2);
   const checked=await Promise.all(read.legs.map((leg,index)=>checkLeg({...leg,key:`${index}:${leg.player}`},rows,options(signal))));
   setStep(3);
   await pause(calm()?0:450,signal);
   if(signal.aborted)return;
   setSlip(read);setLegs(checked);setPhase('done');
   // Picks to swap in, from the lines whose hit rates are already in.
   const used=new Set(checked.map(leg=>leg.sport).filter(Boolean));
   setPool(candidates([...used].flatMap(sport=>(rows[sport]||[]).filter(row=>row.historyStatus==='ready').map(row=>withMatchups(row,found))))
    .map(read=>judge(read,found)));
  }catch(failure){
   if(signal.aborted||failure.name==='AbortError')return;
   setError(failure.message||'That screenshot couldn\'t be read. Try again.');setDetail(failure.detail||'');setPhase('error');
  }
 },[]);

 useEffect(()=>()=>control.current?.abort(),[]);
 // Paste a screenshot anywhere on the page while it's open.
 useEffect(()=>{
  const paste=event=>{
   if(host.current?.closest('.tab-panel')?.hidden||!host.current?.isConnected)return;
   if(event.target instanceof HTMLElement&&event.target.closest('input,textarea,[contenteditable]'))return;
   const item=[...(event.clipboardData?.items||[])].find(entry=>entry.type.startsWith('image/'));
   if(!item)return;
   event.preventDefault();run(item.getAsFile());
  };
  document.addEventListener('paste',paste);return()=>document.removeEventListener('paste',paste);
 },[run]);

 const pasteButton=async()=>{
  try{
   const items=await navigator.clipboard.read();
   for(const item of items){const type=item.types.find(name=>name.startsWith('image/'));if(type){run(new File([await item.getType(type)],'pasted',{type}));return;}}
   setError('There\'s no image on your clipboard. Copy the screenshot first.');setPhase('error');
  }catch{setError('Pasting was blocked by your browser. Choose the screenshot instead.');setPhase('error');}
 };

 const recheck=async(key,changes)=>{
  const current=legs.find(leg=>leg.key===key);if(!current)return;
  const next={...current,...changes};
  setEditing(null);
  const checked=await checkLeg({key,player:next.player,team:next.team,opponent:next.opponent,sport:next.sport,stat:next.stat,statName:next.statName,
   line:next.line,plus:next.plus,side:current.assumedSide&&!changes.side?null:next.side,modifier:next.modifier,odds:next.odds,confidence:next.confidence,needs:[]},boards.current,options());
  setLegs(list=>list.map(leg=>leg.key===key?checked:leg));
  // Still missing its line or side: open the form for it.
  if(checked.state==='needs')setEditing(key);
 };
 const swapIn=async read=>{
  const weakest=scoreEntry(legs,slip)?.weakest;if(!weakest)return;
  const row=read.row;
  const checked=await checkLeg({key:`swap:${row.id}`,player:row.player,team:row.teamAbbr,sport:row.sport,stat:row.market,statName:'',line:row.line,
   side:read.side,modifier:read.modifier,odds:null,needs:[]},boards.current,options());
  setLegs(list=>list.map(leg=>leg.key===weakest.key?checked:leg));
 };
 const save=leg=>{
  if(!leg.grade)return;
  pickBuilder.set(finderSlipProp(leg.row),leg.side==='UNDER'?'Under':'Over');
  setSaved(old=>new Set(old).add(leg.key));
 };
 const saveAll=()=>{legs.filter(leg=>leg.grade).forEach(save);pickBuilder.open();};
 const reset=()=>{control.current?.abort();setPhase('pick');setLegs([]);setSlip(null);setError('');};
 const score=useMemo(()=>slip?scoreEntry(legs,slip):null,[legs,slip]);
 // What each pick needs to hit for the parlay to break even.
 const need=score?.breakEven&&legs.length?score.breakEven**(1/legs.length):null;
 const sports=SLIP_SPORTS.filter(siteFinderSportAllowed);

 return <div className="slip-analyzer" ref={host}>
  <header className="sa-head">
   <div><span className="sa-eyebrow">Slip Analyzer</span><h1>Grade your parlay.</h1>
    <p>Upload a screenshot of your picks. The parlay gets one grade, and every pick is checked against the player's recent games, the matchup and sportsbook odds.</p></div>
   <PhoneAccountButtons/>
  </header>

  {phase==='pick'&&<div className="sa-drop" data-over={over||undefined}
   onDragOver={event=>{event.preventDefault();setOver(true);}} onDragLeave={()=>setOver(false)}
   onDrop={event=>{event.preventDefault();setOver(false);run(event.dataTransfer.files?.[0]);}}>
   <div className="sa-drop-art" aria-hidden="true"><i/><i/><i/></div>
   <h2>Drop a screenshot of your slip</h2>
   <p>PrizePicks, Underdog, Sleeper, Pick6 or a sportsbook parlay, with 2 to 6 player props.</p>
   <div className="sa-drop-actions">
    <button type="button" className="sa-btn sa-btn-primary" onClick={()=>input.current?.click()}><ImageUp size={16}/>Choose screenshot</button>
    <button type="button" className="sa-btn" onClick={pasteButton}><ClipboardPaste size={16}/>Paste</button>
    <input ref={input} type="file" accept="image/*" hidden onChange={event=>{run(event.target.files?.[0]);event.target.value='';}}/>
   </div>
   <small className="sa-drop-hint">or press Ctrl+V / ⌘V</small>
   <ul className="sa-leagues" aria-label="Sports">{sports.map(sport=><li key={sport}><img src={LEAGUE_LOGOS[sport]} alt=""/>{SPORT_NAMES[sport]}</li>)}</ul>
  </div>}

  {phase==='reading'&&<div className="sa-reading" role="status" aria-live="polite" aria-label={STEPS[step]}>
   {shot&&<figure className="sa-shot"><img src={shot.url} alt="Your screenshot"/><i className="sa-scan" aria-hidden="true"/></figure>}
   <ol className="sa-steps">{STEPS.map((text,index)=><li key={text} data-state={index<step?'done':index===step?'active':'waiting'}>
    <span className="sa-step-dot">{index<step&&<Check size={12} strokeWidth={3}/>}</span>{text}</li>)}</ol>
  </div>}

  {phase==='error'&&<div className="sa-problem" role="alert">
   {shot&&<figure className="sa-shot is-small"><img src={shot.url} alt="Your screenshot"/></figure>}
   <div><h2>That slip couldn't be checked</h2><p>{error}</p>{detail&&<p className="sa-detail">{detail}</p>}
    <div className="sa-drop-actions"><button type="button" className="sa-btn sa-btn-primary" onClick={()=>input.current?.click()}><ImageUp size={16}/>Choose another</button>
     <button type="button" className="sa-btn" onClick={reset}><X size={16}/>Start over</button>
     <input ref={input} type="file" accept="image/*" hidden onChange={event=>{run(event.target.files?.[0]);event.target.value='';}}/></div></div>
  </div>}

  {phase==='done'&&slip&&<div className="sa-results">
   <Parlay score={score} slip={slip} legs={legs} shot={shot} pool={pool} onSwap={swapIn} onSaveAll={saveAll} onNew={reset}/>
   {slip.source==='text'&&<p className="sa-heads-up"><TriangleAlert size={14}/>This slip was read from its text, so double-check each {sideWord('OVER',slip.app)} and {sideWord('UNDER',slip.app)}.</p>}
   {slip.detail&&<p className="sa-detail">{slip.detail}</p>}
   <div className="sa-props-head"><h2>The picks</h2><span>{legs.length} pick{legs.length===1?'':'s'}</span></div>
   <div className="sa-props">
    {legs.map((leg,index)=><Prop key={leg.key} leg={leg} index={index} app={slip.app} boards={boards.current} need={need} editing={editing===leg.key}
     onEdit={()=>setEditing(leg.key)} onCancel={()=>setEditing(null)} onSave={changes=>recheck(leg.key,changes)}
     onRemove={()=>setLegs(list=>list.filter(item=>item.key!==leg.key))} saved={saved.has(leg.key)} onKeep={()=>save(leg)}/>)}
   </div>
   {slip.skipped>0&&<p className="sa-heads-up">{slip.skipped} game line{slip.skipped>1?'s were':' was'} left out (moneylines, spreads and totals aren't graded).</p>}
   <button type="button" className="sa-another" onClick={reset}>Grade another parlay<ArrowRight size={15}/></button>
  </div>}
 </div>;
}

export default SlipAnalyzer;
