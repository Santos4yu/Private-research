import React,{useCallback,useEffect,useId,useMemo,useRef,useState} from 'react';
import {ArrowRight,BookmarkPlus,Check,ChevronDown,ClipboardPaste,Crosshair,Crown,ImageUp,Link2,Pencil,Plus,Radio,Repeat2,RotateCcw,Search,Share2,ShieldCheck,Trash2,TriangleAlert,Unlink,X} from 'lucide-react';
import {LEAGUE_LOGOS} from './league-logos';
import {siteFinderSportAllowed,siteIsAdmin} from './site-access';
import {finderSlipProp} from './unified-finder-data';
import {loadLines,ENRICH} from './finder-pool';
import {candidates} from './smart-slip';
import {SLIP_SPORTS,SPORT_NAMES,TIERS,LETTERS,checkLeg,scoreEntry,verdict,swaps,sideWord,offeredStats,judge,regrade,saferPick} from './slip-check';
import {loadMatchups,withMatchups} from './slip-matchup';
import {HEADLINES,gradeTone} from './slip-score';
import {withPoolDefense} from './slip-analyst';
import {takeHandoff,onHandoff,changesSince} from './slip-handoff';
import {loadLearning} from './learning';
import {lookupRow} from './slip-lookup';
import {loadGames,loadTeammates,withGame,newsOf,liveRead,anyLive} from './slip-games';
import {MatchupCase} from './MatchupCase';
import {opponentLogo,teamLogo,useCount,Img,Face,TierBadge,Records,Meter,Games} from './PickParts';
import {shareSlip} from './slip-share';
import {Record,History,hasRecord} from './SlipHistory';
import {newSlipId,slipPayload,saveSlip,removeSlip,loadHistory} from './slip-history';
import {pickBuilder} from './pick-builder-client';
import {READ_URL,shrink} from './slip-image';
import './slip-analyzer.css';

// The Slip Analyzer (the Slip Analyzer tab): a screenshot of a slip goes
// to the server to be read (slip_reader.py); its legs are matched to the
// Finder's lines and graded here (slip-check.js), and any leg can be fixed
// by hand if it was misread.
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
 // Too few games to grade (a rookie, a new role): how many there are, and
 // below it, how they went.
 thin:leg=>{const games=leg.row?.gameLog?.length||0;
  return games?`Only ${games} game${games===1?'':'s'} so far, not enough to grade this pick yet. Here's how ${games===1?'it':'they'} went.`:'Not enough games yet to grade this pick.';},
};

// The case for a pick: the matchup first, then his history, splits and form.
const RESULT_WORDS={hit:'Hit',miss:'Missed',push:'Push',dnp:'Didn\'t play'};
// A pick whose game has started: how far along it is ("Downs 42 of 71.5
// receiving yards"), where the game is, and once it's decided, how it went.
function Live({live}){
 if(!live)return null;
 const word=RESULT_WORDS[live.result]||(live.state==='post'?'Final':'Live');
 return <div className="sa-live" data-result={live.result||'open'} data-state={live.state}>
  <div className="sa-live-top"><span className="sa-live-tag">{live.state==='in'&&!live.result&&<i aria-hidden="true"/>}{word}</span>{live.clock&&<span>{live.clock}</span>}</div>
  <p>{live.text}</p>
  {live.result!=='dnp'&&<div className="sa-live-bar" role="progressbar" aria-label={live.text} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(live.progress*100)}
   style={{'--p':live.progress}}><i/></div>}
 </div>;
}

const lastWord=name=>String(name||'').split(' ').filter(part=>!/^(jr|sr|ii|iii|iv)\.?$/i.test(part)).at(-1)||name;
function Prop({leg,index,app,boards,need,editing,onEdit,onSave,onCancel,onRemove,saved,onKeep,safer}){
 const row=leg.row;
 const grade=leg.grade;
 const tier=grade?.tier;
 const opponent=row?.opponent;
 const stats=leg.state==='stat'&&!grade?offeredStats(leg.spot):[];
 const average=row?.windows?.l10?.average??row?.average;
 const sport=row?.sport||leg.sport;
 const live=row?liveRead(row,leg.side,leg.line??row.line):null;
 // His own line on the injury report, shown by his name.
 const status=newsOf(row)?.self;
 return <article className="sa-prop" id={`sa-prop-${index}`} data-tier={tier||'none'} data-live={live?.result||live?.state||undefined} style={{'--i':index}}>
  <Img className="sa-prop-mark" src={teamLogo(row)}/>
  <header className="sa-prop-head">
   <Face row={row} leg={leg} tier={tier}/>
   <div className="sa-who"><b>{row?.player||leg.player}</b>
    {status?.level&&<span className="sa-status" data-level={status.level}>{status.status}</span>}
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
  <Live live={live}/>
  {grade?<>
   <Meter chance={grade.chance} need={need}/>
   <MatchupCase matchup={grade.matchup} limit={3}/>
   {safer&&<div className="sa-safer" data-tier={safer.tier}><ShieldCheck size={16}/>
    <span><small>A safer way to play {lastWord(row?.player||leg.player)}</small>
     <b>{sideWord(safer.side,app)} {figure(safer.row.line)} {String(safer.row.market).split(' ').slice(0,-1).join(' ')} <span className="sa-safer-end">{String(safer.row.market).split(' ').pop()}{MODIFIER_ICON[safer.row.modifier]&&<img src={MODIFIER_ICON[safer.row.modifier]} alt={safer.row.modifier} width="16" height="16"/>}</span></b>
     <em>{percent(safer.chance)} · {TIERS[safer.tier].label}</em></span>
    <button type="button" onClick={()=>onSave({line:safer.row.line,side:safer.side,modifier:safer.row.modifier||'standard',stat:safer.row.market,statName:''})}>Use this</button>
   </div>}
   <div className="sa-form-head"><span>Recent form{grade.matchup?.facts?.some(item=>item.level==='role')?' · from a smaller role':''}</span>
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
   {(leg.state==='thin'||!MISSING[leg.state])&&<Games row={row} line={leg.line} side={leg.side}/>}
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

// The same words and colours as the Parlay Builder (slip-score.js).
const tone=gradeTone;

function Figure({label,value,format,sub}){
 const shown=useCount(value);
 return <div><dt>{label}</dt><dd>{value==null?'—':format(shown)}</dd>{sub&&<small>{sub}</small>}</div>;
}

// The parlay's grade on a dial: an arc that fills to its score, the letter
// in the middle. Tapping it shows how the grade is worked out.
function Dial({score,letter,open,onToggle}){
 const fill=useCount(score??0,1100);
 const id=`sa-dial-${useId().replace(/[^a-z0-9]/gi,'')}`;
 return <button type="button" className="sa-dial" onClick={onToggle} aria-expanded={open}
  aria-label={`Parlay grade ${letter||'not available'}. Show how it's graded`}>
  <svg viewBox="0 0 120 120" aria-hidden="true">
   <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" style={{stopColor:'var(--tone-hi)'}}/><stop offset="1" style={{stopColor:'var(--tone)'}}/></linearGradient></defs>
   <circle className="sa-dial-track" cx="60" cy="60" r="52"/>
   <circle className="sa-dial-fill" cx="60" cy="60" r="52" pathLength="100" strokeDasharray="100" strokeDashoffset={100-fill} style={{stroke:`url(#${id})`}}/>
  </svg>
  <span className="sa-dial-face"><b>{letter||'–'}</b><small>Grade</small></span>
 </button>;
}

const pct=value=>`${value<10?value.toFixed(1):Math.round(value)}%`;
// The chance they all hit, against the chance the payout needs to break
// even: the clearer the gap, the better the bet.
function Edge({score}){
 const shown=useCount(score.chance*100);
 const need=score.breakEven;
 const top=Math.min(1,Math.max(0.25,Math.max(score.chance,need||0)*1.45));
 const gap=need!=null?Math.round((score.chance-need)*100):null;
 const odds=Math.max(1,Math.round(1/score.chance));
 return <div className="sa-edge" data-clear={gap==null?undefined:gap>=0?'yes':'no'}>
  <div className="sa-edge-top"><b>{pct(shown)}</b><span>chance all {score.total} hit</span>{need!=null&&<em>needs {pct(need*100)}</em>}</div>
  <div className="sa-edge-bar"><i style={{'--w':`${Math.min(100,score.chance/top*100)}%`}}/>
   {need!=null&&<u style={{'--at':`${Math.min(100,need/top*100)}%`}}/>}</div>
  <small>{gap==null?`About 1 in ${odds}`:gap>=0?`About 1 in ${odds}, ${gap} point${gap===1?'':'s'} above break-even`
   :`About 1 in ${odds}, ${-gap} point${gap===-1?'':'s'} short of break-even`}</small>
 </div>;
}

// How the letter comes about, with the whole scale and this slip on it.
const SCALE=[...LETTERS.map(([floor,letter])=>[letter,floor]),['F',0]];
const money=value=>value>=1?`$${value.toFixed(2)}`:`${Math.round(value*100)}¢`;
function Explain({score}){
 const priced=score.value!=null&&score.multiplier;
 const average=score.average;
 // One decimal, so the sum on screen adds up.
 const exact=`${(score.chance*100).toFixed(1)}%`;
 return <div className="sa-explain" role="note">
  <p>{priced?<>All {score.total} hit {exact} of the time and the slip pays {times(score.multiplier,score.estimated)}.
   That's <b>{exact} × {times(score.multiplier,score.estimated).replace('≈','')} = {money(score.value)}</b> back for every $1 played, over time.</>
   :<>This slip has no payout to read, so the grade goes by the picks: <b>{pct(average*100)}</b> each on average, where about 55% a pick is what a
   pick'em slip needs to break even.</>}
   {score.links?.length>0&&' Picks from the same game are counted together.'}</p>
  <ol className="sa-scale" aria-label="Grade scale">{SCALE.map(([letter,floor],index)=><li key={letter} data-on={letter===score.letter||undefined} data-band={letter[0]}>
   <b>{letter}</b><small>{priced?(floor?`${money(floor)}+`:`under ${money(SCALE[index-1][1])}`):(floor?`${floor.toFixed(2)}×`:'less')}</small></li>)}</ol>
 </div>;
}

function Parlay({score,slip,legs,pool,onSwap,onSaveAll,onNew,onShare,sharing,shot,tracked,onTrack,tracking,onPost,posting,posted}){
 const options=useMemo(()=>swaps(legs,pool),[legs,pool]);
 const [open,setOpen]=useState(false);
 const n=legs.length;
 const kind=`${n}-Pick ${TYPE_NAMES[score?.type]||'Parlay'}`;
 const logo=appLogo(slip.app?.key);
 const letter=score?.letter;
 const graded=legs.filter(leg=>leg.grade);
 // The picks whose games have started, and how each is going.
 const live=legs.map(leg=>leg.row?liveRead(leg.row,leg.side,leg.line??leg.row.line):null).filter(Boolean);
 const jump=index=>document.getElementById(`sa-prop-${index}`)?.scrollIntoView({behavior:calm()?'auto':'smooth',block:'start'});
 return <section className="sa-parlay" data-tone={score?tone(letter):'none'}>
  <div className="sa-parlay-top">
   <Dial score={score?.score} letter={letter} open={open} onToggle={()=>score&&setOpen(value=>!value)}/>
   <div className="sa-parlay-main">
    <span className="sa-kind">{logo&&<Img src={logo}/>}{[slip.app?.name,kind].filter(Boolean).join(' · ')}</span>
    <h2>{score?HEADLINES[letter]:'Not graded yet'}</h2>
    <p>{score?verdict(score):'None of the picks could be graded. Fix a pick below to grade the parlay.'}</p>
    {score&&<button type="button" className="sa-why" onClick={()=>setOpen(value=>!value)} aria-expanded={open}>
     {open?'Hide':'How this grade works'}<ChevronDown size={13}/></button>}
   </div>
  </div>
  {open&&score&&<Explain score={score}/>}

  <div className="sa-parlay-body">
   {score&&<div className="sa-parlay-numbers">
    <Edge score={score}/>
    {score.multiplier!=null&&<dl className="sa-parlay-figures">
     <Figure label="Pays" value={score.multiplier} format={value=>times(value,score.estimated)} sub={score.assumed?'usual Power Play':score.estimated?'estimated':'your slip'}/>
     {score.value!=null&&<Figure label="Return per $1" value={score.value} format={value=>`$${value.toFixed(2)}`} sub="over time"/>}
    </dl>}
   </div>}
   <ol className="sa-legs" aria-label="Picks">{legs.map((leg,index)=>{
    const tier=leg.grade?.tier;
    return <li key={leg.key} data-tier={tier||'none'} style={{'--i':index}}>
     <button type="button" onClick={()=>jump(index)}>
      <Face row={leg.row} leg={leg} tier={tier}/>
      <span className="sa-leg-who"><b>{leg.row?.player||leg.player}</b>
       <small>{leg.side?sideWord(leg.side,slip.app):''} {figure(leg.line)} {leg.stat}</small></span>
      <span className="sa-leg-tier">{tier?TIERS[tier].label:'No grade'}</span>
      <span className="sa-leg-chance">{leg.grade?percent(leg.grade.chance):'–'}</span>
     </button></li>;})}</ol>
  </div>

  {score&&score.matchups&&<p className="sa-matchup-line"><Crosshair size={14}/>
   {score.matchups.good} of {score.total} pick{score.total===1?' has':'s have'} a good matchup{score.matchups.tough?`, ${score.matchups.tough} ${score.matchups.tough===1?'has':'have'} a tough one`:''}.</p>}
  {live.length>0&&<p className="sa-live-line" data-busted={live.some(read=>read.result==='miss')||undefined}><Radio size={14}/>
   {[['hit','hit'],['open','still going'],['miss','missed'],['dnp','didn\'t play']].map(([key,word])=>[key,word,live.filter(read=>(read.result||'open')===key).length])
    .filter(([,,count])=>count).map(([key,word,count])=>`${count} ${word}`).join(' · ')}
   {live.length<n?` · ${n-live.length} not started`:''}</p>}
  {score&&<div className="sa-callouts">
   {score.best&&n>1&&<div className="sa-callout" data-kind="best"><Crown size={16}/><span><small>Best pick</small>
    <b>{score.best.row?.player||score.best.player}</b> {sideWord(score.best.side,slip.app)} {figure(score.best.line)} {score.best.stat} · {percent(score.best.grade.chance)}{score.best.grade.matchup?` · ${score.best.grade.matchup.label.toLowerCase()}`:''}</span></div>}
   {score.weakest&&n>1&&score.weakest!==score.best&&<div className="sa-callout" data-kind="weak"><TriangleAlert size={16}/><span><small>Weakest link</small>
    <b>{score.weakest.row?.player||score.weakest.player}</b> {sideWord(score.weakest.side,slip.app)} {figure(score.weakest.line)} {score.weakest.stat} · {percent(score.weakest.grade.chance)}{score.weakest.grade.matchup?` · ${score.weakest.grade.matchup.label.toLowerCase()}`:''}</span></div>}
   {(score.links||[]).slice(0,3).map(pair=><div key={`${pair.a}-${pair.b}`} className="sa-callout" data-kind={pair.tone==='together'?'best':'weak'}>
    {pair.tone==='together'?<Link2 size={16}/>:<Unlink size={16}/>}<span><small>{pair.tone==='together'?'Work together':'Work against each other'}</small>
    {pair.text[0].toUpperCase()+pair.text.slice(1)}, so the parlay's chance is {pair.tone==='together'?'a little higher':'lower'} than the picks alone suggest.</span></div>)}
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
   {onTrack&&<button type="button" className="sa-btn sa-track" onClick={onTrack} disabled={tracking} aria-pressed={tracked}
    title={tracked?'Tracking this slip in Your tracked slips. Tap to stop.':'Played it? Track it to see how it finishes.'}>
    {tracked?<Check size={15}/>:<BookmarkPlus size={15}/>}{tracked?'Tracking':'Track slip'}</button>}
   {onPost&&<button type="button" className="sa-btn sa-track sa-post" onClick={onPost} disabled={posting||Boolean(posted?.added)} aria-pressed={Boolean(posted?.added)}
    title="Admin: put these picks on the site's record (Admin › Record)">
    {posted?.added?<Check size={15}/>:<Crown size={15}/>}{posting?'Posting…':posted?.added?'On the record':'Post to record'}</button>}
   {score&&onShare&&<button type="button" className="sa-btn" onClick={onShare} disabled={sharing}><Share2 size={15}/>{sharing?'Making…':'Share'}</button>}
   <button type="button" className="sa-btn" onClick={onNew}><RotateCcw size={15}/>New slip</button>
   {posted?.message&&<p className="sa-post-note" role="status">{posted.message}</p>}
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
 const [sharing,setSharing]=useState(false);
 // Graded slips kept for the member and the site's record (slip-history.js).
 const [history,setHistory]=useState(null);
 const [historyTick,setHistoryTick]=useState(0);
 const slipId=useRef(null);
 const savedSig=useRef('');
 // Graded slips aren't kept for the member until they track one ("Track
 // slip"): only graded, its picks still count for the site's record.
 const [tracked,setTracked]=useState(false);
 const trackedRef=useRef(false);
 const [tracking,setTracking]=useState(false);
 const [canTrack,setCanTrack]=useState(false);
 const markTracked=value=>{trackedRef.current=value;setTracked(value);};
 // The admin's own slips go on the site's record (slip_ledger.record_add); nobody else's do.
 const [posting,setPosting]=useState(false);
 const [posted,setPosted]=useState(null);
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

 // Each pick's game (slip-games.js): the injury report, lineups and, once
 // it starts, his line so far. The news re-grades the pick; the page keeps
 // checking while a game is on.
 const games=useRef({});
 const mates=useRef({});
 const latest=useRef(legs);latest.current=legs;
 const withNews=useCallback(list=>list.map(leg=>{
  const game=games.current[leg.key];
  if(!leg.row||!game)return leg;
  const row=withGame(leg.row,{...game,teammates:mates.current[leg.key]||[]});
  return {...leg,row,grade:regrade(leg.grade,row,tables.current)};
 }),[]);
 const signature=legs.map(leg=>`${leg.key}:${leg.row?.id||leg.row?.player||''}`).join('|');
 useEffect(()=>{
  if(phase!=='done'||!latest.current.length)return undefined;
  const job=new AbortController();let timer=null;
  const check=async()=>{
   try{
    const list=latest.current;
    const found=await loadGames(list,{signal:job.signal});
    Object.assign(games.current,found);
    // What a teammate's absence has meant, asked once per pick.
    const asking=list.filter(leg=>leg.row&&found[leg.key]&&!mates.current[leg.key]);
    const splits=await loadTeammates(asking.map(leg=>({key:leg.key,row:withGame(leg.row,found[leg.key])})),{signal:job.signal});
    for(const leg of asking)mates.current[leg.key]=splits[leg.key]||[];
    if(!job.signal.aborted)setLegs(current=>withNews(current));
   }catch(error){if(error.name==='AbortError')return;}
   const rows=Object.values(games.current).map(game=>({game,startsAt:game.startsAt}));
   if(anyLive(rows))timer=setTimeout(check,document.hidden?120000:45000);
  };
  check();
  return()=>{job.abort();clearTimeout(timer);};
 },[phase,signature,withNews]);

 // A screenshot to read, or (`handed`) a slip handed over from the Parlay
 // Builder with its exact picks (slip-handoff.js), graded the same way.
 const run=useCallback(async(file,handed=null)=>{
  if(!file&&!handed?.legs?.length)return;
  if(file&&!/^image\//.test(file.type||'image/')){setError('Use a screenshot (PNG, JPG or WEBP).');setPhase('error');return;}
  control.current?.abort();
  const job=new AbortController();control.current=job;const {signal}=job;
  setShot(old=>{if(old?.url)URL.revokeObjectURL(old.url);return file?{url:URL.createObjectURL(file)}:null;});
  setPhase('reading');setStep(0);setError('');setDetail('');setLegs([]);setSlip(null);setEditing(null);setPool([]);setSaved(new Set());
  games.current={};mates.current={};slipId.current=newSlipId();savedSig.current='';markTracked(false);setPosted(null);
  const sports=SLIP_SPORTS.filter(siteFinderSportAllowed);
  // Today's lines load while the screenshot is read.
  const loading=Object.fromEntries(sports.map(sport=>[sport,loadLines(sport,{signal,only:()=>false}).catch(()=>[])]));
  try{
   let read=handed;
   if(!read){
    const body=await shrink(file);
    const started=Date.now();
    read=await readSlip(body,signal);
    if(Date.now()-started<900)await pause(900-(Date.now()-started),signal);
   }
   setStep(1);
   // The matchups for the sports on the slip load alongside today's lines.
   const onSlip=[...new Set(read.legs.map(leg=>leg.sport).filter(sport=>sports.includes(sport)))];
   const [rows,,found]=await Promise.all([
    Promise.all(sports.map(async sport=>[sport,await loading[sport]])).then(Object.fromEntries),
    // What the results have taught the model, before anything is graded.
    loadLearning(),
    loadMatchups(onSlip.length?onSlip:sports.filter(sport=>sport!=='soccer'),{signal}).catch(error=>{if(error.name==='AbortError')throw error;return {};}),
   ]);
   // The lines read as the Parlay Builder reads them: the matchup tables,
   // then what each opponent gave up to players like him where a league
   // has no table (slip-analyst.js), so both grade a pick the same.
   for(const sport of Object.keys(rows))rows[sport]=withPoolDefense((rows[sport]||[]).map(row=>withMatchups(row,found)));
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
   setError(failure.message||(handed?'That slip couldn\'t be checked. Try again.':'That screenshot couldn\'t be read. Try again.'));setDetail(failure.detail||'');setPhase('error');
  }
 },[]);
 // A slip from the Parlay Builder: waiting when this page opens, or sent
 // while it's open.
 useEffect(()=>{
  const waiting=takeHandoff();
  if(waiting)run(null,waiting);
  return onHandoff(read=>run(null,read));
 },[run]);

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
  setLegs(list=>withNews(list.map(leg=>leg.key===key?checked:leg)));
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
 // The graded slip as a picture (slip-share.js).
 const shareIt=async()=>{
  if(!score)return;
  setSharing(true);
  try{await shareSlip({score,legs,headline:HEADLINES[score.letter],kind:[slip.app?.name,`${legs.length}-Pick ${TYPE_NAMES[score.type]||'Parlay'}`].filter(Boolean).join(' · '),
   side:leg=>sideWord(leg.side,slip.app)});}
  finally{setSharing(false);}
 };
 const reset=()=>{control.current?.abort();games.current={};mates.current={};setPhase('pick');setLegs([]);setSlip(null);setError('');};
 const score=useMemo(()=>slip?scoreEntry(legs,slip):null,[legs,slip]);
 // A Builder slip: whether the grade still matches, and what changed if not.
 const changes=useMemo(()=>slip?.builder&&legs.every(leg=>leg.state!=='checking')?changesSince(slip.builder,legs,score):null,[slip,legs,score]);
 // Track this slip (onto Your tracked slips, with its results and alerts), or stop.
 const trackIt=async()=>{
  if(!score||!slip||!slipId.current||tracking)return;
  setTracking(true);
  try{
   if(trackedRef.current){await removeSlip(slipId.current);markTracked(false);}
   else{
    const result=await saveSlip({...slipPayload(slipId.current,slip,legs,score),track:true});
    if(result?.id)slipId.current=result.id;
    markTracked(result?.saved!==false);
   }
   setHistoryTick(tick=>tick+1);
  }catch{/* the button stays as it was */}
  finally{setTracking(false);}
 };
 // A pick changed after posting (fixed, swapped, regraded): it can be posted again.
 const postSig=JSON.stringify(legs.map(leg=>[leg.row?.player,leg.side,leg.line,leg.grade?.tier]));
 useEffect(()=>{setPosted(null);},[postSig]);
 const postIt=async()=>{
  if(!score||!slip||posting)return;
  const picks=slipPayload(slipId.current,slip,legs,score).picks;
  if(!picks.length){setPosted({message:'Nothing graded to post yet.'});return;}
  setPosting(true);
  try{
   const response=await fetch('/api/v2-admin',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'record-add',id:slipId.current,appName:slip.app?.name||'',picks})});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'The record couldn\'t be updated.');
   const started=data.started?` ${data.started} already started, so not posted: add finished plays in Admin › Record.`:'';
   setPosted({added:data.added,message:data.added?`Posted ${data.added} pick${data.added===1?'':'s'} to the record.${started}`:`Nothing posted.${started}`});
  }catch(err){setPosted({message:err.message});}
  finally{setPosting(false);}
 };
 // Off the list from Your tracked slips (the one on screen too, when it's this one).
 const untrack=async id=>{
  await removeSlip(id);
  if(id===slipId.current)markTracked(false);
  setHistoryTick(tick=>tick+1);
 };
 // Keep the graded slip: once it's graded, and again when a pick or its tier changes.
 useEffect(()=>{
  if(phase!=='done'||!score||!slip||!slipId.current)return undefined;
  const payload={...slipPayload(slipId.current,slip,legs,score),track:trackedRef.current};
  if(!payload.picks.length)return undefined;
  const sig=JSON.stringify(payload.picks.map(pick=>[pick.player,pick.stat,pick.line,pick.side,pick.tier]));
  if(sig===savedSig.current)return undefined;
  // The same parlay graded before comes back as that slip: later fixes update it.
  const timer=setTimeout(()=>{savedSig.current=sig;saveSlip(payload).then(result=>{
   setCanTrack(result?.saved!==false);
   if(slipId.current!==payload.id)return;
   if(result?.id)slipId.current=result.id;
   // A slip they already track, graded again: shown as tracked.
   if(result?.tracked&&!trackedRef.current)markTracked(true);
   if(result?.tracked)setHistoryTick(tick=>tick+1);}).catch(()=>{});},1500);
  return()=>clearTimeout(timer);
 },[phase,score,slip,legs]);
 useEffect(()=>{
  const job=new AbortController();
  loadHistory({signal:job.signal}).then(setHistory).catch(()=>{});
  return()=>job.abort();
 },[historyTick]);
 // A safer line on the same player for each Risky or Fade pick (slip-check.js saferPick).
 const safer=useMemo(()=>Object.fromEntries(legs.map(leg=>[leg.key,leg.row?saferPick(leg,boards.current[leg.row.sport],tables.current):null]).filter(([,pick])=>pick)),[legs]);
 // What each pick needs to hit for the parlay to break even.
 const need=score?.breakEven&&legs.length?score.breakEven**(1/legs.length):null;
 const sports=SLIP_SPORTS.filter(siteFinderSportAllowed);

 return <div className="slip-analyzer" ref={host}>
  <header className="sa-head">
   <div><span className="sa-eyebrow">Slip Analyzer</span><h1>Grade your parlay.</h1>
    <p>Upload a screenshot of your picks. The parlay gets one grade, and every pick is checked against the player's recent games, the matchup and sportsbook odds.</p></div>
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
   {changes&&<div className="sa-builder-check" data-same={changes.same?'true':undefined} role="status">
    <span className="sa-builder-mark">{changes.same?<Check size={16} strokeWidth={3}/>:<TriangleAlert size={16}/>}</span>
    <div><b>{changes.same?`Same grade as the Parlay Builder: ${changes.letter}`
     :changes.now&&changes.now!==changes.letter?`Changed since the Parlay Builder made it: ${changes.letter} → ${changes.now}`:'Something changed since the Parlay Builder made it'}</b>
     {changes.items.length>0&&<ul>{changes.items.map(item=><li key={`${item.kind}-${item.player}`}>{item.text}</li>)}</ul>}
     {!changes.same&&!changes.items.length&&<small>The lines and news are the same, so the grade moved with the latest numbers.</small>}</div>
   </div>}
   <Parlay score={score} slip={slip} legs={legs} shot={shot} pool={pool} onSwap={swapIn} onSaveAll={saveAll} onNew={reset}
    onShare={shareIt} sharing={sharing} tracked={tracked} tracking={tracking} onTrack={canTrack?trackIt:null}
    onPost={siteIsAdmin()?postIt:null} posting={posting} posted={posted}/>
   {slip.source==='text'&&<p className="sa-heads-up"><TriangleAlert size={14}/>This slip was read from its text, so double-check each {sideWord('OVER',slip.app)} and {sideWord('UNDER',slip.app)}.</p>}
   <div className="sa-props-head"><h2>The picks</h2><span>{legs.length} pick{legs.length===1?'':'s'}</span></div>
   <div className="sa-props" data-count={legs.length}>
    {legs.map((leg,index)=><Prop key={leg.key} leg={leg} index={index} app={slip.app} boards={boards.current} need={need} editing={editing===leg.key}
     onEdit={()=>setEditing(leg.key)} onCancel={()=>setEditing(null)} onSave={changes=>recheck(leg.key,changes)}
     onRemove={()=>setLegs(list=>list.filter(item=>item.key!==leg.key))} saved={saved.has(leg.key)} onKeep={()=>save(leg)} safer={safer[leg.key]}/>)}
   </div>
   {slip.skipped>0&&<p className="sa-heads-up">{slip.skipped} game line{slip.skipped>1?'s were':' was'} left out (moneylines, spreads and totals aren't graded).</p>}
   <button type="button" className="sa-another" onClick={reset}>Grade another parlay<ArrowRight size={15}/></button>
  </div>}
  {(phase==='pick'||phase==='done')&&(hasRecord(history?.record)||history?.slips?.length>0)&&<div className="sh-wrap" data-phase={phase}
   data-single={!(hasRecord(history.record)&&history.slips?.length>0)||undefined}>
   {hasRecord(history.record)&&<Record record={history.record}/>}<History slips={history.slips} onRemove={untrack}/></div>}
 </div>;
}

export default SlipAnalyzer;
