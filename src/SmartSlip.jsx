import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUpRight,Check,Lock,LockOpen,RefreshCw,Repeat2,Search,Shield,ShieldCheck,Sparkles,TriangleAlert,Zap} from 'lucide-react';
import {LEAGUE_LOGOS} from './league-logos';
import {siteFinderSportAllowed} from './site-access';
import {finderSlipProp} from './unified-finder-data';
import {loadLines} from './finder-pool';
import {TARGETS,MIXES,SPORT_NAMES,candidates,buildLadder,safest,reasons,exportLeg,isPrizePicksLine} from './smart-slip';
import {pickBuilder,usePickBuilder} from './pick-builder-client';
import {loadMatchups,withMatchups} from './slip-matchup';
import {withPoolDefense} from './slip-analyst';
import {gradeMatchups,withMatchup,passesMatchup,confidentUnder} from './krazy-bot';
import {loadGames,loadTeammates,withGame} from './slip-games';
import {PhoneAccountButtons} from './UnifiedFinder';
import './smart-slip.css';

// The Smart Slip page (the Parlay tab): the member picks a payout, how the
// lines mix, the picks, Power or Flex and the sports; smart-slip.js finds
// the slips.
const KEYS=['mlb','nba','wnba','nfl','nhl','soccer'];
const SIZES=['auto',2,3,4,5,6];
const PREFS_KEY='krazy-smart-slip';
const EXPORT_URL='/api/prediction?action=prizepicks-export&from=parlay';
const MODIFIER_ICON={goblin:'/prizepicks/goblin.png',demon:'/prizepicks/demon.png'};
// Each payout band's name and colour, safest to boldest.
const LEVELS={2:{name:'Safest',tone:'#5fe0a8'},3:{name:'Solid',tone:'#4cc9f0'},5:{name:'Boost',tone:'#f6c35b'},10:{name:'Big',tone:'#ff9f5a'},20:{name:'Long shot',tone:'#ff6b8b'}};
const MIX_OPTIONS=[['regular','Regular + Regular',['standard','standard']],['goblin','Regular + Goblin',['standard','goblin']],
 ['demon','Regular + Demon',['standard','demon']],['any','Mix it up',['standard','goblin','demon']]];
const STEPS=['Pulling lines','Checking hit rates','Matchups, injuries and odds','Building your slips'];
// The picks a slip is built from, judged as the Slip Analyzer and Krazy Bot
// judge them (krazy-bot.js withMatchup): the matchup first, then each one's
// game news (who's out, who starts, a teammate's absence) for the strongest
// of them. Only picks that pass (Elite or Strong; Lean where a league has no
// matchup reads) go on a slip, so nothing Risky or ruled out gets built in.
const NEWS_FOR=40;
async function judged(rows,sports,{signal,now}){
 const tables=await loadMatchups(sports,{signal}).catch(()=>({}));
 const listed=withPoolDefense(rows.map(row=>withMatchups(row,tables)));
 // Overs first: an Under makes a slip only when it's a sure thing (confidentUnder).
 const usable=leg=>passesMatchup(leg)&&confidentUnder(leg);
 const graded=gradeMatchups(candidates(listed,{now}),tables).filter(usable);
 const top=graded.slice().sort((a,b)=>b.chance*b.factor-a.chance*a.factor).slice(0,NEWS_FOR);
 const asks=top.map(leg=>({key:leg.id,row:leg.row}));
 let found={},mates={};
 try{
  found=await loadGames(asks,{signal})||{};
  mates=await loadTeammates(asks.filter(item=>found[item.key]).map(item=>({key:item.key,row:withGame(item.row,found[item.key])})),{signal}).catch(()=>({}));
 }catch{/* built on the matchups alone */}
 return graded.map(leg=>{
  const game=found[leg.id];
  return game?withMatchup({...leg,chance:leg.trendChance??leg.chance,row:withGame(leg.row,{...game,teammates:mates[leg.id]||[]})},leg.matchupRequired,tables):leg;
 }).filter(usable);
}
// Where the lines light up on the sweep, from its centre.
const BLIPS=[[-34,-30],[26,-44],[44,6],[10,38],[-40,22],[-6,-12]];

const percent=value=>`${Math.round(value*100)}%`;
const times=(value,estimated)=>`${estimated?'≈':''}${value>=10?Math.round(value):Number(value.toFixed(value<3?2:1))}x`;
const figure=value=>String(value);
const when=iso=>{const time=Date.parse(iso||'');if(!Number.isFinite(time))return '';const date=new Date(time),today=new Date();
 const clock=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 return date.toDateString()===today.toDateString()?clock:`${date.toLocaleDateString([],{weekday:'short'})} ${clock}`;};
const scanLabel=row=>`${row.player} · ${row.market} ${figure(row.line)}`;
const pause=(ms,signal)=>new Promise(resolve=>{const id=setTimeout(resolve,ms);signal?.addEventListener('abort',()=>{clearTimeout(id);resolve();},{once:true});});
const calm=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function readPrefs(){try{return JSON.parse(localStorage.getItem(PREFS_KEY)||'{}')||{};}catch{return {};}}

// A number that climbs to its value: from 1 when it first shows, then
// from wherever it was.
function useCountUp(value){
 const [shown,setShown]=useState(1);
 const last=useRef(1);
 useEffect(()=>{
  if(calm()){last.current=value;setShown(value);return;}
  let frame,start;const from=last.current;
  const run=time=>{start??=time;const t=Math.min(1,(time-start)/700);last.current=from+(value-from)*(1-Math.pow(1-t,3));setShown(last.current);if(t<1)frame=requestAnimationFrame(run);};
  frame=requestAnimationFrame(run);
  return()=>cancelAnimationFrame(frame);
 },[value]);
 return shown;
}

function Photo({src,name}){
 const [bad,setBad]=useState(false);
 useEffect(()=>setBad(false),[src]);
 return src&&!bad?<img className="ss-face" src={src} alt="" loading="lazy" onError={()=>setBad(true)}/>
  :<span className="ss-face ss-face-empty">{String(name||'').split(' ').map(part=>part[0]).slice(0,2).join('')}</span>;
}

function Token({kind}){
 return MODIFIER_ICON[kind]?<i className={`ss-token is-${kind}`}><img src={MODIFIER_ICON[kind]} alt=""/></i>:<i className="ss-token is-standard"/>;
}

function Segment({options,value,onChange,label}){
 const at=Math.max(0,options.findIndex(([key])=>key===value));
 return <div className="ss-seg" role="group" aria-label={label} style={{'--n':options.length,'--at':at}}>
  <i className="ss-seg-thumb" aria-hidden="true"/>
  {options.map(([key,text,Icon])=><button type="button" key={key} aria-pressed={key===value} onClick={()=>onChange(key)}>{Icon&&<Icon size={14}/>}{text}</button>)}
 </div>;
}

// The build, step by step: a sweep over every line, the steps ticking off
// and the lines being checked flashing past.
function BuildStage({step,share,sports,scan}){
 const waiting=sports.map(key=>SPORT_NAMES[key]).join(' · ');
 const [tick,setTick]=useState(0);
 useEffect(()=>{const id=setInterval(()=>setTick(n=>n+1),150);return()=>clearInterval(id);},[]);
 const lines=scan.current;
 const current=lines.length?lines[tick%lines.length]:waiting;
 const previous=lines.length>1?lines[(tick+lines.length-1)%lines.length]:null;
 const done=step===0?6:step===1?12+share*70:step===2?86:97;
 return <div className="ss-stage" role="status" aria-live="polite" aria-label={STEPS[step]}>
  <div className="ss-radar">
   <svg viewBox="0 0 120 120" aria-hidden="true"><circle className="ss-radar-track" cx="60" cy="60" r="55"/>
    <circle className="ss-radar-fill" cx="60" cy="60" r="55" pathLength="100" style={{strokeDashoffset:100-done}}/></svg>
   <i className="ss-radar-sweep" aria-hidden="true"/>
   {BLIPS.map(([x,y],n)=><i key={n} className="ss-radar-blip" style={{left:`calc(50% + ${x}px)`,top:`calc(50% + ${y}px)`,animationDelay:`${n*0.27}s`}} aria-hidden="true"/>)}
   <div className="ss-orbit" aria-hidden="true">{sports.map((key,n)=><span key={key} style={{transform:`rotate(${n*360/sports.length}deg) translateY(var(--orbit)) rotate(${-n*360/sports.length}deg)`}}>
    <img src={LEAGUE_LOGOS[key]} alt=""/></span>)}</div>
   <b>{Math.round(done)}<small>%</small></b>
  </div>
  <div className="ss-stage-copy">
   <ol className="ss-steps">{STEPS.map((text,n)=><li key={text} data-state={n<step?'done':n===step?'active':'waiting'}>
    <span className="ss-step-dot">{n<step&&<Check size={11} strokeWidth={3}/>}</span>{text}</li>)}</ol>
   <div className="ss-ticker" aria-hidden="true">{previous&&<span key={`out${tick}`} className="is-out">{previous}</span>}<span key={lines.length?tick:'waiting'}>{current}</span></div>
  </div>
 </div>;
}

function Leg({leg,index,locked,onLock,onSwap,onResearch}){
 const row=leg.row;
 const side=leg.side==='UNDER'?'Less':'More';
 const opponent=row.opponent?` ${row.isHome===false?'@':'vs'} ${row.opponent}`:'';
 return <article className="ss-leg" style={{'--delay':`${index*110}ms`}}>
  <div className="ss-leg-head">
   <div className="ss-leg-face"><Photo src={row.headshot} name={row.player}/><img className="ss-leg-league" src={LEAGUE_LOGOS[row.sport]} alt=""/></div>
   <div className="ss-leg-who"><b>{row.player}</b><span>{row.teamAbbr||SPORT_NAMES[row.sport]}{opponent}{row.startsAt?` · ${when(row.startsAt)}`:''}</span></div>
   <div className="ss-leg-chance" style={{'--p':Math.round(leg.chance*100)}}><b>{percent(leg.chance)}</b><span>chance</span>
    {leg.grade&&<i className="ss-grade" data-grade={leg.grade} aria-label={`Grade ${leg.grade}`}>{leg.grade}</i>}</div>
  </div>
  <div className="ss-leg-pick"><span className={'ss-side '+(leg.side==='UNDER'?'is-less':'is-more')}>{side}</span><b>{figure(row.line)}</b><span>{row.market}</span>
   {MODIFIER_ICON[leg.modifier]&&<img src={MODIFIER_ICON[leg.modifier]} alt={leg.modifier} width="18" height="18"/>}</div>
  {leg.note&&<p className="ss-note">{leg.note}</p>}
  <ul className="ss-reasons">{reasons(leg).slice(0,6).map(item=><li key={item.key} data-kind={item.key} data-tone={item.tone||undefined}><b>{item.strong}</b><span>{item.label}</span>{item.detail&&<small>{item.detail}</small>}</li>)}</ul>
  {leg.read?.risks?.length>0&&<ul className="ss-watch">{leg.read.risks.map(risk=><li key={risk}><TriangleAlert size={12}/>{risk}</li>)}</ul>}
  <div className="ss-leg-actions">
   <button type="button" className="ss-lock" aria-pressed={locked} onClick={onLock}>{locked?<Lock size={14}/>:<LockOpen size={14}/>}{locked?'Locked':'Lock'}</button>
   <button type="button" className="ss-swap" onClick={onSwap} disabled={locked}><Repeat2 size={14}/>Swap</button>
   <button type="button" className="ss-research" onClick={onResearch}><Search size={14}/>Research</button>
  </div>
 </article>;
}

function Ticket({slip,locked,onLock,onSwap,onResearch,onAdd,onExport,exporting}){
 const level=LEVELS[slip.target]||LEVELS[2];
 const pays=useCountUp(slip.payout);
 return <div className="ss-ticket" style={{'--tone':level.tone}}>
  <div className="ss-ticket-head">
   <div><span className="ss-ticket-kind"><i>{level.name}</i>{slip.legs.length}-pick {slip.play==='flex'?'Flex':'Power'} Play</span><strong>Pays {times(pays,slip.estimated)}</strong></div>
   <dl>
    <div><dt>{slip.play==='flex'?'To profit':'All hit'}</dt><dd>{percent(slip.play==='flex'?slip.profit:slip.chance)}</dd></div>
    <div><dt>Edge</dt><dd className={slip.value>=1?'is-up':'is-down'}>{slip.value>=1?'+':'−'}{Math.abs(Math.round((slip.value-1)*100))}%</dd></div>
    <div><dt>Fair price</dt><dd>{times(slip.fair,false)}</dd></div>
    {slip.legs.every(leg=>leg.grade)&&<div><dt>Grades</dt><dd className="ss-grades">{slip.legs.map(leg=><i key={leg.id} data-grade={leg.grade}>{leg.grade}</i>)}</dd></div>}
   </dl>
  </div>
  <div className="ss-legs">{slip.legs.map((leg,index)=><Leg key={leg.id} leg={leg} index={index} locked={locked.includes(leg.id)}
   onLock={()=>onLock(leg.id)} onSwap={()=>onSwap(leg)} onResearch={()=>onResearch(leg)}/>)}</div>
  <div className="ss-ticket-actions">
   <button type="button" className="ss-add" onClick={onAdd}><Check size={16}/>Add to My Slip</button>
   <button type="button" className="ss-primary" onClick={onExport} disabled={exporting}>{exporting?<RefreshCw size={16} className="ss-spin"/>:<ArrowUpRight size={16}/>}Open in PrizePicks</button>
  </div>
  {slip.estimated&&<p className="ss-fine">Payouts with Goblins or Demons are estimates. PrizePicks shows the exact payout before you submit.</p>}
 </div>;
}

export function SmartSlip(){
 const saved=useMemo(readPrefs,[]);
 const [revision,setRevision]=useState(0);
 useEffect(()=>{const bump=()=>setRevision(n=>n+1);window.addEventListener('vortex:site-policy',bump);return()=>window.removeEventListener('vortex:site-policy',bump);},[]);
 const allowed=useMemo(()=>KEYS.filter(siteFinderSportAllowed),[revision]);
 const [target,setTarget]=useState(TARGETS.includes(saved.target)?saved.target:2);
 const [mix,setMix]=useState(MIXES[saved.mix]?saved.mix:saved.alternates===false?'regular':'any');
 const [size,setSize]=useState(SIZES.includes(saved.size)?saved.size:'auto');
 const [play,setPlay]=useState(saved.play==='flex'?'flex':'power');
 const [sports,setSports]=useState(Array.isArray(saved.sports)?saved.sports:[]);
 const [sameGame,setSameGame]=useState(saved.sameGame===true);
 useEffect(()=>{try{localStorage.setItem(PREFS_KEY,JSON.stringify({target,mix,size,play,sports,sameGame}));}catch{}},[target,mix,size,play,sports,sameGame]);
 // No sport picked means every sport the site allows.
 const chosen=useMemo(()=>{const picked=sports.filter(key=>allowed.includes(key));return picked.length?picked:allowed;},[sports,allowed]);

 const [status,setStatus]=useState('idle');
 const [step,setStep]=useState(0);
 const [progress,setProgress]=useState({});
 const [pool,setPool]=useState([]);
 const [builtAt,setBuiltAt]=useState(0);
 // Locked by the member; swapped out; the slip a swap is working on (its
 // band, its size and the picks it keeps).
 const [locked,setLocked]=useState([]);
 const [excluded,setExcluded]=useState([]);
 const [swap,setSwap]=useState(null);
 const [selected,setSelected]=useState(null);
 const [notice,setNotice]=useState('');
 const [exporting,setExporting]=useState(false);
 const [toast,setToast]=useState('');
 useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(''),2600);return()=>clearTimeout(id);},[toast]);
 const controller=useRef(null),ladderRef=useRef(null),stageRef=useRef(null),scrollAfterBuild=useRef(false),scan=useRef([]);
 const builder=usePickBuilder();

 const base=useMemo(()=>pool.length?buildLadder(pool,{play,size,mix,sameGame,locked,excluded}):[],[pool,play,size,mix,sameGame,locked,excluded]);
 // A swap changes one pick of one slip: same band, same size, the rest kept.
 const swapped=useMemo(()=>swap&&pool.length?buildLadder(pool,{play,size:swap.size,mix,sameGame,locked:[...new Set([...locked,...swap.kept])],excluded,only:[swap.target]})[0]||null:null,
  [swap,pool,play,mix,sameGame,locked,excluded]);
 const ladder=useMemo(()=>{
  const bands=new Map(base.map(item=>[item.target,item]));
  if(swapped)bands.set(swapped.target,swapped);
  return TARGETS.filter(value=>bands.has(value)).map(value=>bands.get(value));
 },[base,swapped]);
 useEffect(()=>setSwap(null),[play,size,mix,sameGame]);
 // The one to point to: the likeliest to cash.
 const recommended=useMemo(()=>safest(ladder),[ladder]);
 // The band asked for, else the nearest bigger one, else the biggest there is.
 const slip=useMemo(()=>ladder.find(item=>item.target===selected)||ladder.find(item=>item.target>=target)||ladder.at(-1)||null,[ladder,selected,target]);

 const build=useCallback(async()=>{
  controller.current?.abort();
  const control=new AbortController();controller.current=control;
  const started=Date.now();
  setStatus('loading');setStep(0);setNotice('');setLocked([]);setSwap(null);setExcluded([]);setSelected(null);setProgress({});
  scan.current=[];
  requestAnimationFrame(()=>stageRef.current?.scrollIntoView({behavior:calm()?'auto':'smooth',block:'nearest'}));
  const now=Date.now();
  // Every kind of line, so a different mix needs no second build.
  const only=row=>isPrizePicksLine(row)&&Date.parse(row.startsAt||'')>now+10*60000;
  let checked=false;
  const results=await Promise.allSettled(chosen.map(sport=>loadLines(sport,{signal:control.signal,only,onProgress:update=>{
   setProgress(old=>({...old,[sport]:update}));
   if(update.stage==='history'){checked=true;setStep(old=>Math.max(old,1));}
   if(update.rows?.length)scan.current=[...scan.current,...update.rows.map(scanLabel)].slice(-60);
  }})));
  if(control.signal.aborted)return;
  const rows=results.flatMap(result=>result.status==='fulfilled'?result.value:[]);
  const failed=chosen.filter((_,index)=>results[index].status==='rejected');
  let found=[];
  try{found=await judged(rows,chosen,{signal:control.signal,now:Date.now()});}
  catch{if(control.signal.aborted)return;found=candidates(rows,{now:Date.now()}).filter(leg=>leg.side!=='UNDER');}
  if(control.signal.aborted)return;
  // Every step shows, even when every line was already saved.
  const lines=rows.filter(only);
  if(lines.length)scan.current=Array.from({length:Math.min(60,lines.length)},()=>scanLabel(lines[Math.floor(Math.random()*lines.length)]));
  const quiet=calm();
  const hold=async(next,ms)=>{setStep(old=>Math.max(old,next));if(!quiet)await pause(ms,control.signal);return !control.signal.aborted;};
  if(!await hold(0,420-(Date.now()-started)))return;
  if(!await hold(1,checked?200:500))return;
  if(!await hold(2,550))return;
  if(!await hold(3,650))return;
  setPool(found);
  setBuiltAt(Date.now());
  setStatus(rows.length?'ready':'error');
  scrollAfterBuild.current=true;
  if(failed.length)setNotice(`${failed.map(key=>SPORT_NAMES[key]).join(', ')} lines couldn’t load right now.`);
 },[chosen]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 // A finished build brings its options into view (below the controls on a phone).
 useEffect(()=>{
  if(!scrollAfterBuild.current||status!=='ready')return;
  scrollAfterBuild.current=false;
  requestAnimationFrame(()=>ladderRef.current?.scrollIntoView({behavior:calm()?'auto':'smooth',block:'start'}));
 },[status,ladder]);

 const toggleSport=key=>setSports(old=>{const base=old.filter(item=>allowed.includes(item));const current=base.length?base:allowed;
  const next=current.includes(key)?current.filter(item=>item!==key):[...current,key];return next.length===allowed.length?[]:next.length?next:[key];});
 const lockLeg=id=>setLocked(old=>old.includes(id)?old.filter(item=>item!==id):[...old,id]);
 const swapLeg=leg=>{
  if(!slip)return;
  const kept=slip.legs.filter(other=>other.id!==leg.id).map(other=>other.id);
  // Nothing else fits: the slip stays as it is.
  const next=buildLadder(pool,{play,size:slip.legs.length,mix,sameGame,locked:[...new Set([...locked,...kept])],excluded:[...excluded,leg.id],only:[slip.target]})[0];
  if(!next){setToast('No other pick fits this slip right now');return;}
  setSwap({target:slip.target,size:slip.legs.length,kept});
  setExcluded(old=>[...old,leg.id]);setSelected(slip.target);
 };
 const choose=value=>{setSwap(null);setSelected(value);setTarget(value);};
 const research=leg=>{
  window.dispatchEvent(new CustomEvent('vortex:open-prop',{detail:{sport:leg.row.sport,player:leg.row.player,stat:leg.row.raw?.stat||leg.row.market}}));
  window.dispatchEvent(new CustomEvent('vortex:switch-tab',{detail:{tab:'finder'}}));
 };
 const addToSlip=()=>{
  if(!slip)return;
  if(builder.legs.length&&!confirm(`Replace the ${builder.legs.length} pick${builder.legs.length===1?'':'s'} in your slip?`))return;
  pickBuilder.clear();
  slip.legs.forEach(leg=>pickBuilder.set(finderSlipProp(leg.row),leg.side==='UNDER'?'Under':'Over'));
  pickBuilder.open();
 };
 const openPrizePicks=async()=>{
  if(!slip||exporting)return;
  setExporting(true);setNotice('Checking every pick on PrizePicks…');
  try{
   const response=await fetch(EXPORT_URL,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({legs:slip.legs.map(exportLeg)})});
   const payload=await response.json().catch(()=>({}));
   if(!response.ok||!payload.url){
    const detail=(payload.unmatched||[]).map(leg=>`${leg.player} ${leg.line} ${leg.stat}`).join('; ');
    throw new Error(detail?`${payload.error||'Some picks are gone'}: ${detail}`:payload.error||'PrizePicks is unavailable right now.');
   }
   window.location.assign(payload.url);
  }catch(error){setNotice(error.message||'PrizePicks is unavailable right now.');setExporting(false);}
 };

 const loading=status==='loading';
 const totals=Object.values(progress).reduce((sum,item)=>({done:sum.done+(item.done||0),total:sum.total+(item.total||0)}),{done:0,total:0});
 const sizes=SIZES.filter(value=>play!=='flex'||value==='auto'||value>=3);

 return <section className="smart-slip" aria-labelledby="smart-slip-title">
  <header className="ss-head">
   <div><span className="ss-eyebrow"><Sparkles size={13}/>Smart Slip</span><h1 id="smart-slip-title">Build your card.</h1>
    <p>Real hit rates and sportsbook odds, built into a slip that pays what you want.</p></div>
   <PhoneAccountButtons/>
  </header>

  <div className="ss-controls">
   <div className="ss-field"><span className="ss-label">Payout</span>
    <div className="ss-payouts">{TARGETS.map((value,index)=><button type="button" key={value} aria-pressed={target===value} style={{'--tone':LEVELS[value].tone}}
     onClick={()=>{setSwap(null);setTarget(value);setSelected(null);}}>
     <b>{value}x<small>+</small></b><span>{LEVELS[value].name}</span>
     <i className="ss-meter" aria-hidden="true">{TARGETS.map((_,n)=><em key={n} className={n<=index?'is-on':''}/>)}</i>
    </button>)}</div></div>
   <div className="ss-field"><span className="ss-label">Lines</span>
    <div className="ss-mixes">{MIX_OPTIONS.map(([value,text,tokens])=><button type="button" key={value} aria-pressed={mix===value} onClick={()=>setMix(value)}>
     <span className="ss-tokens">{tokens.map((kind,n)=><Token key={n} kind={kind}/>)}</span><b>{text}</b>
    </button>)}</div></div>
   <div className="ss-row">
    <div className="ss-field"><span className="ss-label">Picks</span>
     <Segment label="Picks" value={size} onChange={setSize} options={sizes.map(value=>[value,value==='auto'?'Auto':String(value)])}/></div>
    <div className="ss-field"><span className="ss-label">Play</span>
     <Segment label="Play" value={play} onChange={value=>{setPlay(value);if(value==='flex'&&size===2)setSize('auto');}}
      options={[['power','Power',Zap],['flex','Flex',Shield]]}/></div>
   </div>
   <div className="ss-row">
    <div className="ss-field"><span className="ss-label">Sports</span>
     <div className="ss-sports">{allowed.map(key=><button type="button" key={key} aria-pressed={chosen.includes(key)} onClick={()=>toggleSport(key)}>
      <img src={LEAGUE_LOGOS[key]} alt="" width="20" height="20"/>{SPORT_NAMES[key]}<i className="ss-check" aria-hidden="true"><Check size={10} strokeWidth={3.5}/></i></button>)}</div></div>
    <div className="ss-field"><span className="ss-label">Games</span>
     <label className="ss-switch"><input type="checkbox" checked={sameGame} onChange={event=>setSameGame(event.target.checked)}/><span><b>Same-game picks</b><small>Up to 2 from one game</small></span></label></div>
   </div>
   <button type="button" className="ss-build" onClick={build} disabled={loading||!allowed.length}>
    {loading?<RefreshCw size={18} className="ss-spin"/>:<Sparkles size={18}/>}<span>{loading?'Building…':status==='ready'?'Build again':'Build my slip'}</span></button>
  </div>

  <div ref={stageRef} className="ss-stage-anchor">{loading&&<BuildStage step={step} share={totals.total?totals.done/totals.total:1} sports={chosen} scan={scan}/>}</div>
  {notice&&<p className="ss-notice" role="status">{notice}</p>}

  {status==='ready'&&!ladder.length&&<div className="ss-empty" ref={ladderRef}><b>No slip clears the bar right now</b><span>Try more sports, another line mix, or a different payout.</span></div>}
  {status==='error'&&<div className="ss-empty"><b>Lines couldn’t load</b><button type="button" onClick={build}>Try again</button></div>}

  {status==='ready'&&ladder.length>0&&<>
   <div className="ss-ladder" role="listbox" aria-label="Payout options" ref={ladderRef}>{ladder.map((item,index)=>{
    const active=item===slip;
    const odds=item.play==='flex'?item.profit:item.chance;
    return <button type="button" role="option" aria-selected={active} key={item.target} className={active?'is-active':''}
     style={{'--tone':(LEVELS[item.target]||LEVELS[2]).tone,'--i':index}} onClick={()=>choose(item.target)}>
     {item===recommended&&<em><ShieldCheck size={11} strokeWidth={2.6}/>Recommended</em>}
     <b>{times(item.payout,item.estimated)}</b>
     <span>{percent(odds)} {item.play==='flex'?'to profit':'to hit'}</span>
     <i className="ss-odds" aria-hidden="true"><i style={{width:percent(odds)}}/></i>
     <small>{item.legs.length}-pick {item.play==='flex'?'Flex':'Power'}
      {item.legs.filter(leg=>MODIFIER_ICON[leg.modifier]).map(leg=><img key={leg.id} src={MODIFIER_ICON[leg.modifier]} alt={leg.modifier} width="13" height="13"/>)}</small>
    </button>;})}</div>

   {slip&&<Ticket key={slip.target} slip={slip} locked={locked} onLock={lockLeg} onSwap={swapLeg} onResearch={research}
    onAdd={addToSlip} onExport={openPrizePicks} exporting={exporting}/>}
   <p className="ss-meta">{pool.length} picks qualified · lines as of {new Date(builtAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</p>
  </>}
  {toast&&<p className="ss-toast" role="status" key={toast}>{toast}</p>}
 </section>;
}
