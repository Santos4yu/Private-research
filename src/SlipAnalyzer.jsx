import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowRight,Check,ClipboardPaste,ImageUp,Pencil,Plus,Repeat2,RotateCcw,Search,Trash2,TriangleAlert,X} from 'lucide-react';
import {LEAGUE_LOGOS} from './league-logos';
import {siteFinderSportAllowed} from './site-access';
import {finderSlipProp} from './unified-finder-data';
import {loadLines,ENRICH} from './finder-pool';
import {candidates,reasons} from './smart-slip';
import {SLIP_SPORTS,SPORT_NAMES,checkLeg,scoreEntry,verdict,swaps,sideWord,offeredStats} from './slip-check';
import {pickBuilder} from './pick-builder-client';
import {PhoneAccountButtons} from './UnifiedFinder';
import './slip-analyzer.css';

// The Slip Analyzer (the Slip Analyzer tab): a screenshot of a slip goes
// to the server to be read (slip_reader.py); its legs are matched to the
// Finder's lines and graded here (slip-check.js), and any leg can be fixed
// by hand if it was misread.
const READ_URL='/api/prediction?action=slip-analyzer';
const STEPS=['Reading your slip','Finding the players','Checking their games','Grading each pick'];
const MODIFIER_ICON={goblin:'/prizepicks/goblin.png',demon:'/prizepicks/demon.png'};
const TYPE_NAMES={power:'Power Play',flex:'Flex Play',parlay:'Parlay'};

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
 if(!response.ok)throw new Error(data.error||'That screenshot couldn\'t be read. Try again.');
 if(!Array.isArray(data.legs)||!data.legs.length)throw new Error('No player props were found in that screenshot.');
 return data;
}

function Face({row,leg}){
 const [bad,setBad]=useState(false);
 const src=row?.headshot;
 useEffect(()=>setBad(false),[src]);
 const name=row?.player||leg.player;
 const sport=row?.sport||leg.sport;
 return <span className="sa-face">
  {src&&!bad?<img src={src} alt="" loading="lazy" onError={()=>setBad(true)}/>:<i>{String(name||'').split(' ').map(part=>part[0]).slice(0,2).join('')}</i>}
  {sport&&LEAGUE_LOGOS[sport]&&<img className="sa-face-league" src={LEAGUE_LOGOS[sport]} alt=""/>}
 </span>;
}

const tone=chance=>chance>=0.6?'up':chance>=0.5?'blue':chance>=0.4?'gold':'down';
function Ring({chance,grade}){
 return <span className="sa-ring" data-tone={tone(chance)} style={{'--p':Math.round(chance*100)}} aria-label={`${percent(chance)} chance${grade?`, grade ${grade}`:''}`}>
  <b>{Math.round(chance*100)}<small>%</small></b>{grade&&<i data-grade={grade}>{grade}</i>}
 </span>;
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
  <div className="sa-games-plot">
   <i className="sa-games-line" style={{bottom:`${line/top*100}%`}}><span>{figure(line)}</span></i>
   {games.map((game,index)=><span key={`${game.date}-${index}`} className="sa-games-bar" style={{'--h':`${Math.max(3,game.value/top*100)}%`,'--i':index}}
    data-result={game.value===line?'push':won(game.value)?'hit':'miss'}><b>{figure(game.value)}</b></span>)}
  </div>
  <span className="sa-games-caption">Last {games.length}: <b>{hits}/{games.length}</b></span>
 </div>;
}

function Editor({leg,app,boards,onSave,onCancel}){
 const sport=leg.sport||leg.spot?.sport||'';
 const [player,setPlayer]=useState(leg.player);
 const [stat,setStat]=useState(leg.stat);
 const [line,setLine]=useState(leg.line??'');
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
 player:leg=>`${leg.player} isn't on today's board. The game may have started, or the name may be misread.`,
 stat:leg=>`${leg.player} has no ${leg.stat} line on today's board.`,
 needs:leg=>`The ${leg.needs?.includes('side')||!leg.side?'side':'line'} on this pick couldn't be read.`,
 thin:()=>'Not enough games yet to grade this pick.',
};

function Leg({leg,index,app,boards,editing,onEdit,onSave,onCancel,onRemove,saved,onKeep}){
 const row=leg.row;
 const grade=leg.grade;
 const opponent=row?.opponent?` ${row.isHome===false?'@':'vs'} ${row.opponent}`:'';
 const stats=leg.state==='stat'?offeredStats(leg.spot):[];
 return <article className="sa-leg" data-state={grade?'graded':leg.state} style={{'--i':index}}>
  <header className="sa-leg-head">
   <Face row={row} leg={leg}/>
   <div className="sa-who"><b>{row?.player||leg.player}</b>
    <span>{row?[row.teamAbbr||SPORT_NAMES[row.sport],opponent].join('')+(row.startsAt?` · ${when(row.startsAt)}`:''):SPORT_NAMES[leg.sport]||'Player prop'}</span></div>
   {grade?<Ring chance={grade.chance} grade={grade.grade}/>:<span className="sa-flag"><TriangleAlert size={14}/>{leg.state==='needs'?'Check':'Not graded'}</span>}
  </header>
  <div className="sa-pick">
   {leg.side?<span className="sa-side" data-side={leg.side}>{sideWord(leg.side,app)}</span>:<span className="sa-side" data-side="none">?</span>}
   <b>{figure(leg.line)}</b><span>{leg.stat}</span>
   {MODIFIER_ICON[leg.modifier]&&<img src={MODIFIER_ICON[leg.modifier]} alt={leg.modifier} width="18" height="18"/>}
  </div>
  {leg.state==='relined'&&grade&&<p className="sa-relined">The board has {figure(row.relinedFrom)} today; this was graded at your {figure(leg.line)}.</p>}
  {grade?<>
   <Games row={row} line={leg.line} side={leg.side}/>
   {grade.note&&<p className="sa-note">{grade.note}</p>}
   <ul className="sa-reasons">{reasons(grade).slice(0,5).map(item=><li key={item.key} data-tone={item.tone||undefined}><b>{item.strong}</b><span>{item.label}</span></li>)}</ul>
   {leg.odds!=null&&grade.implied!=null&&<p className="sa-price">Your price {price(leg.odds)} needs {percent(grade.implied)}; this pick hits about {percent(grade.chance)}.</p>}
   {grade.read?.risks?.length>0&&<ul className="sa-risks">{grade.read.risks.slice(0,2).map(risk=><li key={risk}><TriangleAlert size={12}/>{risk}</li>)}</ul>}
  </>:<div className="sa-missing"><p>{(MISSING[leg.state]||MISSING.thin)(leg)}</p>
   {stats.length>0&&<div className="sa-chips">{stats.slice(0,8).map(name=><button type="button" key={name} onClick={()=>onSave({stat:name,statName:''})}>{name}</button>)}</div>}
  </div>}
  {editing?<Editor leg={leg} app={app} boards={boards} onSave={onSave} onCancel={onCancel}/>
   :<footer className="sa-leg-actions">
    <button type="button" onClick={onEdit}><Pencil size={14}/>Fix</button>
    {row&&<button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('vortex:open-prop',{detail:{sport:row.sport,player:row.player,stat:row.raw?.stat||row.market}}))}><Search size={14}/>Research</button>}
    {grade&&<button type="button" aria-pressed={saved} onClick={onKeep}>{saved?<Check size={14}/>:<Plus size={14}/>}{saved?'Saved':'My Slip'}</button>}
    <button type="button" className="sa-remove" onClick={onRemove} aria-label={`Remove ${leg.player}`}><Trash2 size={14}/></button>
   </footer>}
 </article>;
}

function Summary({score,slip,legs,shot,pool,onSwap,onSaveAll,onNew}){
 const options=useMemo(()=>swaps(legs,pool),[legs,pool]);
 const weakest=score?.weakest;
 const kind=[slip.app?.name,`${legs.length}-pick ${TYPE_NAMES[score?.type]||'slip'}`].filter(Boolean).join(' · ');
 return <section className="sa-summary" data-grade={score?.letter||'none'}>
  <div className="sa-summary-top">
   <span className="sa-letter" aria-label={`Slip grade ${score?.letter||'not available'}`}>{score?.letter||'–'}</span>
   <div><span className="sa-kind">{kind}</span><p className="sa-verdict">{verdict(score)||'Fix the picks below to grade this slip.'}</p></div>
  </div>
  {score&&<dl className="sa-figures">
   <div><dt>All hit</dt><dd>{score.chance!=null?percent(score.chance):'—'}</dd></div>
   <div><dt>Pays</dt><dd>{score.multiplier?times(score.multiplier,score.estimated):'—'}</dd></div>
   <div><dt>Break-even</dt><dd>{score.breakEven?percent(score.breakEven):'—'}</dd></div>
   <div><dt>Avg pick</dt><dd>{percent(score.average)}</dd></div>
  </dl>}
  {weakest&&legs.length>1&&<p className="sa-weakest"><span>Weakest pick</span><b>{weakest.player}</b> {sideWord(weakest.side,slip.app)} {figure(weakest.line)} {weakest.stat} · {percent(weakest.grade.chance)}</p>}
  {options.length>0&&<div className="sa-swaps"><h3>Stronger picks to swap in</h3>
   <ul>{options.map(read=><li key={read.id}>
    <Face row={read.row} leg={read.row}/>
    <span className="sa-swap-copy"><b>{read.row.player}</b><small>{sideWord(read.side,slip.app)} {figure(read.row.line)} {read.row.market}</small></span>
    <span className="sa-swap-chance">{percent(read.chance)}</span>
    <button type="button" onClick={()=>onSwap(read)} aria-label={`Swap in ${read.row.player}`}><Repeat2 size={14}/>Swap</button>
   </li>)}</ul></div>}
  <div className="sa-summary-actions">
   <button type="button" className="sa-btn sa-btn-primary" onClick={onSaveAll} disabled={!legs.some(leg=>leg.grade)}><Plus size={15}/>Add all to My Slip</button>
   <button type="button" className="sa-btn" onClick={onNew}><RotateCcw size={15}/>New slip</button>
  </div>
  {shot&&<figure className="sa-thumb"><img src={shot.url} alt="Your screenshot"/></figure>}
 </section>;
}

export function SlipAnalyzer(){
 const [phase,setPhase]=useState('pick');
 const [shot,setShot]=useState(null);
 const [step,setStep]=useState(0);
 const [error,setError]=useState('');
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

 const run=useCallback(async file=>{
  if(!file)return;
  if(!/^image\//.test(file.type||'image/')){setError('Use a screenshot (PNG, JPG or WEBP).');setPhase('error');return;}
  control.current?.abort();
  const job=new AbortController();control.current=job;const {signal}=job;
  setShot(old=>{if(old?.url)URL.revokeObjectURL(old.url);return {url:URL.createObjectURL(file)};});
  setPhase('reading');setStep(0);setError('');setLegs([]);setSlip(null);setEditing(null);setPool([]);setSaved(new Set());
  const sports=SLIP_SPORTS.filter(siteFinderSportAllowed);
  // Today's lines load while the screenshot is read.
  const loading=Object.fromEntries(sports.map(sport=>[sport,loadLines(sport,{signal,only:()=>false}).catch(()=>[])]));
  try{
   const body=await shrink(file);
   const started=Date.now();
   const read=await readSlip(body,signal);
   if(Date.now()-started<900)await pause(900-(Date.now()-started),signal);
   setStep(1);
   const rows=Object.fromEntries(await Promise.all(sports.map(async sport=>[sport,await loading[sport]])));
   boards.current=rows;
   await pause(calm()?0:350,signal);
   setStep(2);
   const checked=await Promise.all(read.legs.map((leg,index)=>checkLeg({...leg,key:`${index}:${leg.player}`},rows,{enrichFor,signal})));
   setStep(3);
   await pause(calm()?0:450,signal);
   if(signal.aborted)return;
   setSlip(read);setLegs(checked);setPhase('done');
   // Picks to swap in, from the lines whose hit rates are already in.
   const used=new Set(checked.map(leg=>leg.sport).filter(Boolean));
   setPool(candidates([...used].flatMap(sport=>(rows[sport]||[]).filter(row=>row.historyStatus==='ready'))));
  }catch(failure){
   if(signal.aborted||failure.name==='AbortError')return;
   setError(failure.message||'That screenshot couldn\'t be read. Try again.');setPhase('error');
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
   line:next.line,plus:next.plus,side:next.side,modifier:next.modifier,odds:next.odds,confidence:next.confidence,needs:[]},boards.current,{enrichFor});
  setLegs(list=>list.map(leg=>leg.key===key?checked:leg));
 };
 const swapIn=async read=>{
  const weakest=scoreEntry(legs,slip)?.weakest;if(!weakest)return;
  const row=read.row;
  const checked=await checkLeg({key:`swap:${row.id}`,player:row.player,team:row.teamAbbr,sport:row.sport,stat:row.market,statName:'',line:row.line,
   side:read.side,modifier:read.modifier,odds:null,needs:[]},boards.current,{enrichFor});
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
 const sports=SLIP_SPORTS.filter(siteFinderSportAllowed);

 return <div className="slip-analyzer" ref={host}>
  <header className="sa-head">
   <div><span className="sa-eyebrow">Slip Analyzer</span><h1>Check your slip.</h1>
    <p>Upload a screenshot of your picks. Every leg is read and checked against the player's recent games, the matchup and sportsbook odds.</p></div>
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
   <div><h2>That slip couldn't be checked</h2><p>{error}</p>
    <div className="sa-drop-actions"><button type="button" className="sa-btn sa-btn-primary" onClick={()=>input.current?.click()}><ImageUp size={16}/>Choose another</button>
     <button type="button" className="sa-btn" onClick={reset}><X size={16}/>Start over</button>
     <input ref={input} type="file" accept="image/*" hidden onChange={event=>{run(event.target.files?.[0]);event.target.value='';}}/></div></div>
  </div>}

  {phase==='done'&&slip&&<div className="sa-results">
   <Summary score={score} slip={slip} legs={legs} shot={shot} pool={pool} onSwap={swapIn} onSaveAll={saveAll} onNew={reset}/>
   <div className="sa-legs">
    {slip.source==='text'&&<p className="sa-heads-up">This slip was read from its text, so double-check each More or Less.</p>}
    {legs.map((leg,index)=><Leg key={leg.key} leg={leg} index={index} app={slip.app} boards={boards.current} editing={editing===leg.key}
     onEdit={()=>setEditing(leg.key)} onCancel={()=>setEditing(null)} onSave={changes=>recheck(leg.key,changes)}
     onRemove={()=>setLegs(list=>list.filter(item=>item.key!==leg.key))} saved={saved.has(leg.key)} onKeep={()=>save(leg)}/>)}
    {slip.skipped>0&&<p className="sa-heads-up">{slip.skipped} game line{slip.skipped>1?'s were':' was'} left out (moneylines, spreads and totals aren't graded).</p>}
    <button type="button" className="sa-another" onClick={reset}>Check another slip<ArrowRight size={15}/></button>
   </div>
  </div>}
 </div>;
}

export default SlipAnalyzer;
