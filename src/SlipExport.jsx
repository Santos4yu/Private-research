import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Check,ChevronDown,ClipboardPaste,ImageUp,Pencil,RotateCcw,Search,TriangleAlert,X} from 'lucide-react';
import {LEAGUE_LOGOS} from './league-logos';
import {shrink} from './slip-image';
import './slip-analyzer.css';
import './slip-export.css';

// Slip to PrizePicks (admin only, site-access-core.js ADMIN_TABS): a picture
// of anyone's slip is read on the server (slip_reader.py), each pick is found
// on PrizePicks in whatever league it is (prizepicks_export_core.find_picks),
// and the picks open in PrizePicks in one tap. Nothing is graded here.
const URL_='/api/prediction?action=slip-export';
const APP_URL='https://app.prizepicks.com/?projections=';
const PRIZEPICKS_LOGO='/prizepicks/logo.png';
const MODIFIER_ICON={goblin:'/prizepicks/goblin.png',demon:'/prizepicks/demon.png'};
const STEPS=['Reading the slip','Finding each pick on PrizePicks','Lining up your entry'];
// PrizePicks takes 2 to 6 picks in an entry.
const MOST=6;
const LEAGUES=['NBA','WNBA','NFL','MLB','NHL','CFB','CBB','SOCCER','TENNIS','CS2','LOL','VAL','DOTA2','COD','MMA','PGA','NASCAR'];

const pause=(ms,signal)=>new Promise(resolve=>{const id=setTimeout(resolve,ms);signal?.addEventListener('abort',()=>{clearTimeout(id);resolve();},{once:true});});
const calm=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const figure=value=>value==null||value===''?'—':String(Number(value));
const initials=name=>String(name||'?').split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase();
const logoOf=league=>LEAGUE_LOGOS[String(league||'').toLowerCase()]||null;
const when=iso=>{
 const time=Date.parse(iso||'');if(!Number.isFinite(time))return '';
 const date=new Date(time),today=new Date();
 const clock=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 return date.toDateString()===today.toDateString()?clock:`${date.toLocaleDateString([],{weekday:'short'})} ${clock}`;
};
const sideOf=side=>/^(under|less|lower)$/i.test(String(side||''))?'under':'over';

async function ask(body,signal){
 const json=!(body instanceof Blob);
 const response=await fetch(URL_,{method:'POST',credentials:'same-origin',signal,
  headers:{'Content-Type':json?'application/json':body.type||'image/jpeg'},body:json?JSON.stringify(body):body});
 let data={};try{data=await response.json();}catch{/* handled below */}
 if(response.status===401)throw new Error('Sign in again to use Slip to PrizePicks.');
 if(data.featureDisabled)throw new Error('Slip to PrizePicks is unavailable right now.');
 if(!response.ok)throw new Error(data.error||'Something went wrong. Try again.');
 return data;
}

// The PrizePicks link for the picks found: each on its side, one per line.
export function entryLink(items){
 const seen=new Set(),tokens=[];
 for(const item of items){
  const pick=item.pick;
  if(!pick||seen.has(pick.projectionId))continue;
  seen.add(pick.projectionId);
  tokens.push(`${pick.projectionId}-${pick.side==='under'?'u':'o'}-${Number(pick.line)}`);
  if(tokens.length===MOST)break;
 }
 return tokens.length?APP_URL+tokens.join(','):null;
}

function Photo({src,name,league}){
 const [bad,setBad]=useState(false);
 useEffect(()=>setBad(false),[src]);
 const logo=logoOf(league);
 return <span className="se-photo">
  {src&&!bad?<img src={src} alt="" loading="lazy" onError={()=>setBad(true)}/>:<b aria-hidden="true">{initials(name)}</b>}
  {logo&&<img className="se-photo-league" src={logo} alt=""/>}
 </span>;
}

function Fix({item,onFind,onCancel}){
 const read=item.read||{};
 const [player,setPlayer]=useState(item.pick?.player||read.player||'');
 const [stat,setStat]=useState(item.pick?.stat||read.stat||'');
 const [line,setLine]=useState(item.pick?.line??read.line??'');
 const [league,setLeague]=useState(item.pick?.league||read.league||'');
 const [side,setSide]=useState(item.pick?.side||sideOf(read.side));
 const id=`se-fix-${item.key}`;
 const submit=event=>{
  event.preventDefault();
  if(!player.trim()||!stat.trim())return;
  const value=line===''?null:Number(line);
  onFind({player:player.trim(),stat:stat.trim(),statName:'',line:Number.isFinite(value)?value:null,side,league:league.trim().toUpperCase(),
   modifier:item.pick?.oddsType||read.modifier||'standard'});
 };
 return <form className="se-fix" onSubmit={submit}>
  <label className="se-fix-wide"><span>Player</span><input value={player} onChange={event=>setPlayer(event.target.value)} autoComplete="off" required/></label>
  <label className="se-fix-wide"><span>Stat</span><input value={stat} onChange={event=>setStat(event.target.value)} autoComplete="off" placeholder="Points, Kills, Aces…" required/></label>
  <label><span>Line</span><input type="number" inputMode="decimal" step="0.5" min="0" value={line} onChange={event=>setLine(event.target.value)}/></label>
  <label><span>League</span><input value={league} onChange={event=>setLeague(event.target.value)} list={`${id}-leagues`} autoComplete="off" placeholder="Any"/>
   <datalist id={`${id}-leagues`}>{LEAGUES.map(name=><option key={name} value={name}/>)}</datalist></label>
  <div className="se-side se-fix-wide" role="group" aria-label="More or Less">
   {['over','under'].map(key=><button type="button" key={key} data-side={key} aria-pressed={side===key} onClick={()=>setSide(key)}>{key==='over'?'More':'Less'}</button>)}
  </div>
  <div className="se-fix-actions se-fix-wide">
   <button type="button" className="sa-btn" onClick={onCancel}>Cancel</button>
   <button type="submit" className="sa-btn sa-btn-primary"><Search size={15}/>Find on PrizePicks</button>
  </div>
 </form>;
}

function Pick({item,index,fixing,onSide,onFix,onFind,onCancel,onRemove}){
 const pick=item.pick,read=item.read||{};
 if(item.busy)return <article className="se-pick" data-state="busy" style={{'--i':index}} aria-busy="true">
  <span className="se-photo is-empty"/><div className="se-pick-main"><b>{read.player}</b><small>Finding on PrizePicks…</small></div>
 </article>;
 if(fixing)return <article className="se-pick" data-state="fix" style={{'--i':index}}>
  <header className="se-fix-head"><b>Fix this pick</b><small>As read: {[read.player,read.stat,read.line!=null?figure(read.line):null].filter(Boolean).join(' · ')}</small></header>
  <Fix item={item} onFind={onFind} onCancel={onCancel}/>
 </article>;
 if(!pick)return <article className="se-pick" data-state="missing" style={{'--i':index}}>
  <Photo name={read.player}/>
  <div className="se-pick-main">
   <b>{read.player||'Unknown player'}</b>
   <small>{[read.stat,read.line!=null?figure(read.line):null,read.side?(sideOf(read.side)==='under'?'Less':'More'):null].filter(Boolean).join(' · ')||'Couldn\'t read this pick'}</small>
   <p className="se-reason"><TriangleAlert size={13}/>{item.reason||'Not on PrizePicks right now'}</p>
  </div>
  <div className="se-pick-tools">
   <button type="button" className="se-chip-btn" onClick={onFix}><Pencil size={13}/>Fix</button>
   <button type="button" className="se-icon-btn" aria-label={`Remove ${read.player||'this pick'}`} onClick={onRemove}><X size={15}/></button>
  </div>
 </article>;
 const tier=pick.oddsType==='goblin'||pick.oddsType==='demon'?pick.oddsType:null;
 const lessOk=pick.sides?.includes('under');
 return <article className="se-pick" data-state="found" data-side={pick.side} style={{'--i':index}}>
  <Photo src={pick.headshot} name={pick.player} league={pick.league}/>
  <div className="se-pick-main">
   <div className="se-pick-name"><b>{pick.player}</b><span className="se-league">{pick.league}</span></div>
   <small>{[pick.team,pick.opponent?`vs ${pick.opponent.replace(/^vs\.?\s*/i,'')}`:null,when(pick.startsAt)].filter(Boolean).join(' · ')}</small>
   <div className="se-line">
    {tier&&<img className="se-tier" src={MODIFIER_ICON[tier]} alt={tier==='goblin'?'Goblin':'Demon'} title={tier==='goblin'?'Goblin':'Demon'}/>}
    <strong>{figure(pick.line)}</strong><span>{pick.stat}</span>
   </div>
   {pick.changed&&read.line!=null&&<p className="se-moved">The slip had {figure(read.line)}. PrizePicks has {figure(pick.line)} now.</p>}
  </div>
  <div className="se-pick-tools">
   <div className="se-side" role="group" aria-label={`${pick.player}: More or Less`}>
    <button type="button" data-side="over" aria-pressed={pick.side==='over'} onClick={()=>onSide('over')}>More</button>
    <button type="button" data-side="under" aria-pressed={pick.side==='under'} disabled={!lessOk} title={lessOk?undefined:'Goblins and Demons are More only'} onClick={()=>onSide('under')}>Less</button>
   </div>
   <div className="se-pick-actions">
    <button type="button" className="se-chip-btn" onClick={onFix}><Pencil size={13}/>Fix</button>
    <button type="button" className="se-icon-btn" aria-label={`Remove ${pick.player}`} onClick={onRemove}><X size={15}/></button>
   </div>
  </div>
 </article>;
}

export function SlipExport(){
 const host=useRef(null),input=useRef(null),control=useRef(null);
 const [phase,setPhase]=useState('pick');
 const [step,setStep]=useState(0);
 const [shot,setShot]=useState(null);
 const [items,setItems]=useState([]);
 const [app,setApp]=useState(null);
 const [error,setError]=useState('');
 const [over,setOver]=useState(false);
 const [fixing,setFixing]=useState(null);

 const run=useCallback(async file=>{
  if(!file)return;
  if(!String(file.type||'').startsWith('image/')){setError('That isn\'t a picture. Use a PNG, JPG or screenshot.');setPhase('error');return;}
  control.current?.abort();
  const job=new AbortController();control.current=job;const {signal}=job;
  setShot(old=>{if(old)URL.revokeObjectURL(old);return URL.createObjectURL(file);});
  setPhase('reading');setStep(0);setError('');setItems([]);setFixing(null);
  try{
   const read=await ask(await shrink(file),signal);
   if(signal.aborted)return;
   if(!Array.isArray(read.legs)||!read.legs.length)throw new Error('No picks could be read off that picture. Try a clearer one.');
   setApp(read.app||null);setStep(1);
   const found=await ask({legs:read.legs},signal);
   if(signal.aborted)return;
   setStep(2);
   await pause(calm()?0:450,signal);
   if(signal.aborted)return;
   setItems((found.legs||[]).map((item,index)=>({...item,key:`${index}:${item.read?.player||''}`})));
   setPhase('done');
  }catch(failure){
   if(signal.aborted||failure.name==='AbortError')return;
   setError(failure.message||'That picture couldn\'t be read. Try again.');setPhase('error');
  }
 },[]);

 useEffect(()=>()=>control.current?.abort(),[]);
 // Paste a picture anywhere on the page while it's open.
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
   const clip=await navigator.clipboard.read();
   for(const item of clip){const type=item.types.find(name=>name.startsWith('image/'));if(type){run(new File([await item.getType(type)],'pasted',{type}));return;}}
   setError('There\'s no picture on your clipboard. Copy the slip first.');setPhase('error');
  }catch{setError('Pasting was blocked by your browser. Choose the picture instead.');setPhase('error');}
 };

 const update=(key,change)=>setItems(list=>list.map(item=>item.key===key?{...item,...(typeof change==='function'?change(item):change)}:item));
 const setSide=(key,side)=>update(key,item=>({pick:{...item.pick,side}}));
 const remove=key=>{setItems(list=>list.filter(item=>item.key!==key));if(fixing===key)setFixing(null);};
 // A fixed pick, looked for again on its own.
 const find=async(key,leg)=>{
  setFixing(null);
  update(key,{busy:true,read:leg});
  try{
   const found=await ask({legs:[leg]});
   const [next]=found.legs||[];
   update(key,{busy:false,read:next?.read||leg,pick:next?.pick||null,reason:next?.reason||'Not on PrizePicks right now'});
  }catch(failure){update(key,{busy:false,pick:null,reason:failure.message});}
 };
 const reset=()=>{control.current?.abort();setPhase('pick');setItems([]);setError('');setFixing(null);setApp(null);};

 const ready=items.filter(item=>item.pick&&!item.busy);
 const link=entryLink(ready);
 const missing=items.length-ready.length;
 const fileInput=<input ref={input} type="file" accept="image/*" hidden onChange={event=>{run(event.target.files?.[0]);event.target.value='';}}/>;

 return <div className="slip-export sa-scope" ref={host}>
  <header className="sa-head se-head">
   <div><span className="sa-eyebrow">Slip to PrizePicks</span><h1>Any slip, into PrizePicks.</h1>
    <p>Paste or upload a picture of a slip. Every pick is found on PrizePicks, in any sport, and opens in the app ready to play.</p></div>
  </header>

  {phase==='pick'&&<div className="sa-drop se-drop" data-over={over||undefined}
   onDragOver={event=>{event.preventDefault();setOver(true);}} onDragLeave={()=>setOver(false)}
   onDrop={event=>{event.preventDefault();setOver(false);run(event.dataTransfer.files?.[0]);}}>
   <div className="se-drop-art" aria-hidden="true"><i/><i/><i/><img src={PRIZEPICKS_LOGO} alt=""/></div>
   <h2>Drop a picture of a slip</h2>
   <p>From PrizePicks, Underdog, Sleeper, a sportsbook or a screenshot someone sent you. NBA to CS2, tennis to golf.</p>
   <div className="sa-drop-actions">
    <button type="button" className="sa-btn sa-btn-primary" onClick={()=>input.current?.click()}><ImageUp size={16}/>Choose picture</button>
    <button type="button" className="sa-btn" onClick={pasteButton}><ClipboardPaste size={16}/>Paste</button>
    {fileInput}
   </div>
   <small className="sa-drop-hint">or press Ctrl+V / ⌘V</small>
  </div>}

  {phase==='reading'&&<div className="sa-reading" role="status" aria-live="polite" aria-label={STEPS[step]}>
   {shot&&<figure className="sa-shot"><img src={shot} alt="The slip"/><i className="sa-scan" aria-hidden="true"/></figure>}
   <ol className="sa-steps">{STEPS.map((text,index)=><li key={text} data-state={index<step?'done':index===step?'active':'waiting'}>
    <span className="sa-step-dot">{index<step&&<Check size={12} strokeWidth={3}/>}</span>{text}</li>)}</ol>
  </div>}

  {phase==='error'&&<div className="sa-problem" role="alert">
   {shot&&<figure className="sa-shot is-small"><img src={shot} alt="The slip"/></figure>}
   <div><h2>That slip couldn't be brought over</h2><p>{error}</p>
    <div className="sa-drop-actions"><button type="button" className="sa-btn sa-btn-primary" onClick={()=>input.current?.click()}><ImageUp size={16}/>Choose another</button>
     <button type="button" className="sa-btn" onClick={reset}><X size={16}/>Start over</button>{fileInput}</div></div>
  </div>}

  {phase==='done'&&<div className="se-results">
   <section className="se-ready" data-ready={link?'true':undefined} aria-live="polite">
    <img className="se-ready-logo" src={PRIZEPICKS_LOGO} alt=""/>
    <div className="se-ready-text">
     <b>{ready.length} of {items.length} pick{items.length===1?'':'s'} ready</b>
     <small>{ready.length<2?'PrizePicks needs at least 2 picks in an entry.'
      :ready.length>MOST?`PrizePicks takes up to ${MOST} picks, so the first ${MOST} open.`
      :missing?`${missing} couldn't be found. Fix ${missing===1?'it':'them'} below, or open the rest.`
      :'Choose Power or Flex in the app.'}{app?.name&&app.key!=='prizepicks'?` Read from ${app.name}.`:''}</small>
    </div>
    <div className="se-ready-actions">
     {link&&ready.length>=2?<a className="se-open" href={link} target="_blank" rel="noopener noreferrer">Open in PrizePicks<ArrowUpRight size={17}/></a>
      :<span className="se-open" aria-disabled="true">Open in PrizePicks<ArrowUpRight size={17}/></span>}
     <button type="button" className="sa-btn" onClick={reset}><RotateCcw size={15}/>New slip</button>
    </div>
   </section>

   {shot&&<details className="sa-shot-peek se-peek"><summary><ImageUp size={14}/>The slip<ChevronDown size={14}/></summary><img src={shot} alt="The slip"/></details>}

   <div className="se-list">
    {items.map((item,index)=><Pick key={item.key} item={item} index={index} fixing={fixing===item.key}
     onSide={side=>setSide(item.key,side)} onFix={()=>setFixing(item.key)} onCancel={()=>setFixing(null)}
     onFind={leg=>find(item.key,leg)} onRemove={()=>remove(item.key)}/>)}
   </div>
   {!items.length&&<p className="se-empty">No picks left. Start a new slip.</p>}
  </div>}
 </div>;
}
