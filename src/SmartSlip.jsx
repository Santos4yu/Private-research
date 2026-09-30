import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUpRight,Check,Lock,LockOpen,RefreshCw,Repeat2,Search,Sparkles} from 'lucide-react';
import {LEAGUE_LOGOS} from './league-logos';
import {siteFinderSportAllowed} from './site-access';
import {finderSlipProp} from './unified-finder-data';
import {loadLines} from './finder-pool';
import {TARGETS,SPORT_NAMES,candidates,buildLadder,reasons,exportLeg,isPrizePicksLine} from './smart-slip';
import {pickBuilder,usePickBuilder} from './pick-builder-client';
import {PhoneAccountButtons} from './UnifiedFinder';
import './smart-slip.css';

// The Smart Slip page (the Parlay tab): the member picks a payout, the
// picks, Power or Flex and the sports; smart-slip.js finds the slips.
const KEYS=['mlb','wnba','nfl','nhl','soccer'];
const SIZES=['auto',2,3,4,5,6];
const PREFS_KEY='krazy-smart-slip';
const EXPORT_URL='/api/prediction?action=prizepicks-export&from=parlay';
const MODIFIER_ICON={goblin:'/prizepicks/goblin.png',demon:'/prizepicks/demon.png'};

const percent=value=>`${Math.round(value*100)}%`;
const times=(value,estimated)=>`${estimated?'≈':''}${value>=10?Math.round(value):Number(value.toFixed(1))}x`;
const figure=value=>String(value);
const when=iso=>{const time=Date.parse(iso||'');if(!Number.isFinite(time))return '';const date=new Date(time),today=new Date();
 const clock=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 return date.toDateString()===today.toDateString()?clock:`${date.toLocaleDateString([],{weekday:'short'})} ${clock}`;};
function readPrefs(){try{return JSON.parse(localStorage.getItem(PREFS_KEY)||'{}')||{};}catch{return {};}}

function Photo({src,name}){
 const [bad,setBad]=useState(false);
 useEffect(()=>setBad(false),[src]);
 return src&&!bad?<img className="ss-face" src={src} alt="" loading="lazy" onError={()=>setBad(true)}/>
  :<span className="ss-face ss-face-empty">{String(name||'').split(' ').map(part=>part[0]).slice(0,2).join('')}</span>;
}

function Leg({leg,index,locked,onLock,onSwap,onResearch}){
 const row=leg.row;
 const side=leg.side==='UNDER'?'Less':'More';
 const opponent=row.opponent?` ${row.isHome===false?'@':'vs'} ${row.opponent}`:'';
 return <article className="ss-leg" style={{'--delay':`${index*70}ms`}}>
  <div className="ss-leg-head">
   <div className="ss-leg-face"><Photo src={row.headshot} name={row.player}/><img className="ss-leg-league" src={LEAGUE_LOGOS[row.sport]} alt=""/></div>
   <div className="ss-leg-who"><b>{row.player}</b><span>{row.teamAbbr||SPORT_NAMES[row.sport]}{opponent}{row.startsAt?` · ${when(row.startsAt)}`:''}</span></div>
   <div className="ss-leg-chance"><b>{percent(leg.chance)}</b><span>chance</span></div>
  </div>
  <div className="ss-leg-pick"><span className={'ss-side '+(leg.side==='UNDER'?'is-less':'is-more')}>{side}</span><b>{figure(row.line)}</b><span>{row.market}</span>
   {MODIFIER_ICON[leg.modifier]&&<img src={MODIFIER_ICON[leg.modifier]} alt={leg.modifier} width="18" height="18"/>}</div>
  <ul className="ss-reasons">{reasons(leg).slice(0,5).map(item=><li key={item.key} data-kind={item.key}><b>{item.strong}</b><span>{item.label}</span>{item.detail&&<small>{item.detail}</small>}</li>)}</ul>
  <div className="ss-leg-actions">
   <button type="button" aria-pressed={locked} onClick={onLock}>{locked?<Lock size={14}/>:<LockOpen size={14}/>}{locked?'Locked':'Lock'}</button>
   <button type="button" onClick={onSwap} disabled={locked}><Repeat2 size={14}/>Swap</button>
   <button type="button" onClick={onResearch}><Search size={14}/>Research</button>
  </div>
 </article>;
}

export function SmartSlip(){
 const saved=useMemo(readPrefs,[]);
 const [revision,setRevision]=useState(0);
 useEffect(()=>{const bump=()=>setRevision(n=>n+1);window.addEventListener('vortex:site-policy',bump);return()=>window.removeEventListener('vortex:site-policy',bump);},[]);
 const allowed=useMemo(()=>KEYS.filter(siteFinderSportAllowed),[revision]);
 const [target,setTarget]=useState(TARGETS.includes(saved.target)?saved.target:3);
 const [size,setSize]=useState(SIZES.includes(saved.size)?saved.size:'auto');
 const [play,setPlay]=useState(saved.play==='flex'?'flex':'power');
 const [sports,setSports]=useState(Array.isArray(saved.sports)?saved.sports:[]);
 const [alternates,setAlternates]=useState(saved.alternates!==false);
 const [sameGame,setSameGame]=useState(saved.sameGame===true);
 useEffect(()=>{try{localStorage.setItem(PREFS_KEY,JSON.stringify({target,size,play,sports,alternates,sameGame}));}catch{}},[target,size,play,sports,alternates,sameGame]);
 // No sport picked means every sport the site allows.
 const chosen=useMemo(()=>{const picked=sports.filter(key=>allowed.includes(key));return picked.length?picked:allowed;},[sports,allowed]);

 const [status,setStatus]=useState('idle');
 const [progress,setProgress]=useState({});
 const [pool,setPool]=useState([]);
 const [builtAt,setBuiltAt]=useState(0);
 // Locked by the member; kept while one pick is swapped out; swapped out.
 const [locked,setLocked]=useState([]);
 const [kept,setKept]=useState([]);
 const [excluded,setExcluded]=useState([]);
 const [selected,setSelected]=useState(null);
 const [notice,setNotice]=useState('');
 const [exporting,setExporting]=useState(false);
 const controller=useRef(null),ladderRef=useRef(null),scrollAfterBuild=useRef(false);
 const builder=usePickBuilder();

 const ladder=useMemo(()=>pool.length?buildLadder(pool,{play,size,sameGame,locked:[...new Set([...locked,...kept])],excluded}):[],[pool,play,size,sameGame,locked,kept,excluded]);
 // The one to point to: the best value among slips with a real chance
 // (1 in 5 or better) -- not a long shot that only wins on paper.
 const recommended=useMemo(()=>{
  const odds=slip=>slip.play==='flex'?slip.profit:slip.chance;
  const likely=ladder.filter(slip=>odds(slip)>=0.2);
  return (likely.length?likely:ladder).reduce((top,slip)=>!top||(likely.length?slip.value>top.value:odds(slip)>odds(top))?slip:top,null);
 },[ladder]);
 // The band asked for, else the nearest bigger one, else the biggest there is.
 const slip=useMemo(()=>ladder.find(item=>item.target===selected)||ladder.find(item=>item.target>=target)||ladder.at(-1)||null,[ladder,selected,target]);

 const build=useCallback(async()=>{
  controller.current?.abort();
  const control=new AbortController();controller.current=control;
  setStatus('loading');setNotice('');setLocked([]);setKept([]);setExcluded([]);setSelected(null);setProgress({});
  const now=Date.now();
  const only=row=>isPrizePicksLine(row)&&(!alternates?String(row.modifier||'standard')==='standard':true)&&Date.parse(row.startsAt||'')>now+10*60000;
  const results=await Promise.allSettled(chosen.map(sport=>loadLines(sport,{signal:control.signal,only,onProgress:update=>setProgress(old=>({...old,[sport]:update}))})));
  if(control.signal.aborted)return;
  const rows=results.flatMap(result=>result.status==='fulfilled'?result.value:[]);
  const failed=chosen.filter((_,index)=>results[index].status==='rejected');
  setPool(candidates(rows,{now:Date.now(),alternates}));
  setBuiltAt(Date.now());
  setStatus(rows.length?'ready':'error');
  scrollAfterBuild.current=true;
  if(failed.length)setNotice(`${failed.map(key=>SPORT_NAMES[key]).join(', ')} lines couldn’t load right now.`);
 },[chosen,alternates]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 // A finished build brings its options into view (below the controls on a phone).
 useEffect(()=>{
  if(!scrollAfterBuild.current||status!=='ready')return;
  scrollAfterBuild.current=false;
  requestAnimationFrame(()=>ladderRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));
 },[status,ladder]);

 const toggleSport=key=>setSports(old=>{const base=old.filter(item=>allowed.includes(item));const current=base.length?base:allowed;
  const next=current.includes(key)?current.filter(item=>item!==key):[...current,key];return next.length===allowed.length?[]:next.length?next:[key];});
 const lockLeg=id=>setLocked(old=>old.includes(id)?old.filter(item=>item!==id):[...old,id]);
 const swapLeg=leg=>{if(!slip)return;setKept(slip.legs.filter(other=>other.id!==leg.id).map(other=>other.id));setExcluded(old=>[...old,leg.id]);setSelected(slip.target);};
 const choose=value=>{setKept([]);setSelected(value);setTarget(value);};
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
 const stageText=Object.entries(progress).filter(([,item])=>item.stage==='history'&&item.done<item.total).map(([key,item])=>`${SPORT_NAMES[key]} ${item.done}/${item.total}`).join(' · ');

 return <section className="smart-slip" aria-labelledby="smart-slip-title">
  <header className="ss-head">
   <div><span className="ss-eyebrow"><Sparkles size={13}/>Smart Slip</span><h1 id="smart-slip-title">Build your card.</h1>
    <p>Real hit rates and sportsbook odds, built into a slip that pays what you want.</p></div>
   <PhoneAccountButtons/>
  </header>

  <div className="ss-controls">
   <div className="ss-field"><span className="ss-label">Payout</span>
    <div className="ss-chips ss-targets">{TARGETS.map(value=><button type="button" key={value} aria-pressed={target===value} onClick={()=>{setKept([]);setTarget(value);setSelected(null);}}>{value}x<small>+</small></button>)}</div></div>
   <div className="ss-row">
    <div className="ss-field"><span className="ss-label">Picks</span>
     <div className="ss-chips">{SIZES.filter(value=>play!=='flex'||value==='auto'||value>=3).map(value=><button type="button" key={value} aria-pressed={size===value} onClick={()=>setSize(value)}>{value==='auto'?'Auto':value}</button>)}</div></div>
    <div className="ss-field"><span className="ss-label">Play</span>
     <div className="ss-segment">{[['power','Power'],['flex','Flex']].map(([value,label])=><button type="button" key={value} aria-pressed={play===value} onClick={()=>{setPlay(value);if(value==='flex'&&size===2)setSize('auto');}}>{label}</button>)}</div></div>
   </div>
   <div className="ss-field"><span className="ss-label">Sports</span>
    <div className="ss-chips ss-sports">{allowed.map(key=><button type="button" key={key} aria-pressed={chosen.includes(key)} onClick={()=>toggleSport(key)}><img src={LEAGUE_LOGOS[key]} alt="" width="16" height="16"/>{SPORT_NAMES[key]}</button>)}</div></div>
   <div className="ss-toggles">
    <label><input type="checkbox" checked={alternates} onChange={event=>setAlternates(event.target.checked)}/><span><b>Goblins &amp; Demons</b><small>Mix in easier and harder lines</small></span></label>
    <label><input type="checkbox" checked={sameGame} onChange={event=>setSameGame(event.target.checked)}/><span><b>Same-game picks</b><small>Up to 2 from one game</small></span></label>
   </div>
   <button type="button" className="ss-build" onClick={build} disabled={loading||!allowed.length}>
    {loading?<RefreshCw size={17} className="ss-spin"/>:<Sparkles size={17}/>}{loading?'Building…':status==='ready'?'Build again':'Build my slip'}</button>
  </div>

  {loading&&<div className="ss-progress" role="status">
   <div className="ss-bar"><i style={{width:totals.total?`${Math.round(totals.done/totals.total*100)}%`:'12%'}}/></div>
   <span>{stageText?`Checking hit rates · ${stageText}`:'Loading lines…'}</span>
  </div>}
  {notice&&<p className="ss-notice" role="status">{notice}</p>}

  {status==='ready'&&!ladder.length&&<div className="ss-empty" ref={ladderRef}><b>No slip clears the bar right now</b><span>Try more sports, Goblins &amp; Demons, or a different payout.</span></div>}
  {status==='error'&&<div className="ss-empty"><b>Lines couldn’t load</b><button type="button" onClick={build}>Try again</button></div>}

  {status==='ready'&&ladder.length>0&&<>
   <div className="ss-ladder" role="listbox" aria-label="Payout options" ref={ladderRef}>{ladder.map(item=>{
    const active=item===slip;
    return <button type="button" role="option" aria-selected={active} key={item.target} className={active?'is-active':''} onClick={()=>choose(item.target)}>
     {item===recommended&&<em>Recommended</em>}
     <b>{times(item.payout,item.estimated)}</b>
     <span>{percent(item.play==='flex'?item.profit:item.chance)} {item.play==='flex'?'to profit':'to hit'}</span>
     <small>{item.legs.length}-pick {item.play==='flex'?'Flex':'Power'}</small>
    </button>;})}</div>

   {slip&&<div className="ss-ticket" key={slip.key}>
    <div className="ss-ticket-head">
     <div><span className="ss-label">{slip.legs.length}-pick {slip.play==='flex'?'Flex':'Power'} Play</span><strong>Pays {times(slip.payout,slip.estimated)}</strong></div>
     <dl>
      <div><dt>{slip.play==='flex'?'To profit':'All hit'}</dt><dd>{percent(slip.play==='flex'?slip.profit:slip.chance)}</dd></div>
      <div><dt>Edge</dt><dd className={slip.value>=1?'is-up':'is-down'}>{slip.value>=1?'+':'−'}{Math.abs(Math.round((slip.value-1)*100))}%</dd></div>
      <div><dt>Fair price</dt><dd>{times(slip.fair,false)}</dd></div>
     </dl>
    </div>
    <div className="ss-legs">{slip.legs.map((leg,index)=><Leg key={leg.id} leg={leg} index={index} locked={locked.includes(leg.id)}
     onLock={()=>lockLeg(leg.id)} onSwap={()=>swapLeg(leg)} onResearch={()=>research(leg)}/>)}</div>
    <div className="ss-ticket-actions">
     <button type="button" onClick={addToSlip}><Check size={16}/>Add to My Slip</button>
     <button type="button" className="ss-primary" onClick={openPrizePicks} disabled={exporting}>{exporting?<RefreshCw size={16} className="ss-spin"/>:<ArrowUpRight size={16}/>}Open in PrizePicks</button>
    </div>
    {slip.estimated&&<p className="ss-fine">Payouts with Goblins or Demons are estimates. PrizePicks shows the exact payout before you submit.</p>}
   </div>}
   <p className="ss-meta">{pool.length} picks qualified · lines as of {new Date(builtAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</p>
  </>}
 </section>;
}
