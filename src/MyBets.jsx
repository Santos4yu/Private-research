import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {AlertTriangle,CalendarDays,Camera,ClipboardPaste,ChevronLeft,ChevronRight,LineChart,Loader2,Plus,Trash2,X} from 'lucide-react';
import {KINDS,PERIODS,calendar,inPeriod,moneyText,periodOf,priceText,profitOf,series,shiftAnchor,streak,summarize,today,unitsText,multiplierOf,betFromSlip,betFromRead} from './my-bets-core';
import {loadHistory} from './slip-history';
import {shrink} from './slip-image';
import './my-bets.css';

// My Bets: each member's own bets (bet_tracker.py through /api/prediction):
// units and dollars won over a day, a week, a month, a year or all time,
// the running total, a calendar of good and bad days, and every bet.

const SPORTS=[['nba','NBA'],['nfl','NFL'],['mlb','MLB'],['nhl','NHL'],['wnba','WNBA'],['cfb','CFB'],['cbb','CBB'],['soccer','Soccer'],['tennis','Tennis'],['golf','Golf'],['mma','MMA'],['esports','Esports'],['other','Other']];
const SPORT_NAME=Object.fromEntries(SPORTS);
const BOOKS=['PrizePicks','Underdog','DraftKings Pick6','DraftKings','FanDuel','BetMGM','Caesars','ESPN BET','Fanatics','bet365','Hard Rock Bet'];
const PAYOUTS=[3,5,6,10,20,25];
const RESULTS=[['pending','Pending'],['win','Won'],['loss','Lost'],['push','Push'],['cashout','Cash out']];
const RESULT_MARK={pending:'…',win:'W',loss:'L',push:'P',void:'V',cashout:'$'};
const KIND_NAME=Object.fromEntries(KINDS);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const pct=(value,signed=false)=>finite(value)?`${signed&&value>0?'+':''}${value<0?'−':''}${Math.abs(value*100).toFixed(1)}%`:'—';
const tone=value=>!finite(value)||Math.abs(value)<0.005?'flat':value>0?'up':'down';
const dayText=day=>{const [y,m,d]=String(day).split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString([],{month:'short',day:'numeric'});};

// ---------------------------------------------------------------- data

async function call(action,body){
 const response=await fetch(`/api/prediction?action=${action}`,body?{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{credentials:'same-origin',cache:'no-store'});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'Your bets are unavailable right now.');
 return data;
}

// A picture of a bet, read on the server (slip_reader.read_bet).
// Given up on after READ_LIMIT: the server stops trying well before that.
const READ_LIMIT=45000;
async function readPicture(file,signal){
 const body=await shrink(file);
 const response=await fetch('/api/prediction?action=bets-read',{method:'POST',credentials:'same-origin',headers:{'Content-Type':body.type||'image/jpeg'},body,signal});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'That picture couldn\'t be read. Try again, or use a clearer one.');
 return data;
}
// Wakes the server that reads pictures while the member finds theirs, so
// the read doesn't wait for it to start up. At most once a minute.
let warmed=0;
function warmReader(){
 if(Date.now()-warmed<60000)return;
 warmed=Date.now();
 fetch('/api/prediction?action=ping',{credentials:'same-origin',cache:'no-store'}).catch(()=>{});
}
const dollars=value=>finite(value)?`$${value.toLocaleString('en-US',{minimumFractionDigits:value%1?2:0,maximumFractionDigits:2})}`:null;
const unitMoney=value=>`$${Number(value).toLocaleString('en-US',{minimumFractionDigits:Number(value)%1?2:0,maximumFractionDigits:2})}`;
const READ_RESULT={win:'Won',loss:'Lost',push:'Refunded',cashout:'Paid part',pending:'Not settled yet'};

// ---------------------------------------------------------------- chart

function UnitsChart({points}){
 const host=useRef(null);
 const [width,setWidth]=useState(640);
 const [hover,setHover]=useState(null);
 useEffect(()=>{
  const node=host.current;if(!node)return;
  const observer=new ResizeObserver(([entry])=>setWidth(Math.max(260,Math.round(entry.contentRect.width))));
  observer.observe(node);return()=>observer.disconnect();
 },[]);
 const height=width<520?190:230,pad={l:44,r:12,t:12,b:26};
 const totals=points.map(point=>point.total);
 const low=Math.min(0,...totals),high=Math.max(0,...totals);
 const span=(high-low)||1,top=high+span*0.08,bottom=low-span*0.08;
 const x=index=>pad.l+(points.length<2?0.5:index/(points.length-1))*(width-pad.l-pad.r);
 const y=value=>pad.t+(top-value)/(top-bottom)*(height-pad.t-pad.b);
 // Round steps (1, 2 or 5 of a power of ten) between the top and bottom.
 const raw=(top-bottom)/4,power=10**Math.floor(Math.log10(raw)),step=[1,2,5,10].map(n=>n*power).find(n=>n>=raw)||10*power;
 const zero=y(0),ticks=[];
 for(let value=Math.ceil(bottom/step)*step;value<=top+1e-9;value+=step)ticks.push(Math.round(value*100)/100);
 const line=points.map((point,index)=>`${index?'L':'M'}${x(index).toFixed(1)},${y(point.total).toFixed(1)}`).join('');
 const area=points.length?`${line}L${x(points.length-1).toFixed(1)},${zero.toFixed(1)}L${x(0).toFixed(1)},${zero.toFixed(1)}Z`:'';
 // Green above even, red below it: the colour changes where the line crosses zero.
 const split=Math.min(1,Math.max(0,(zero-pad.t)/(height-pad.t-pad.b)));
 const pick=event=>{
  const box=host.current.getBoundingClientRect(),at=(event.clientX-box.left-pad.l)/(width-pad.l-pad.r);
  setHover(Math.max(0,Math.min(points.length-1,Math.round(at*(points.length-1)))));
 };
 const shown=hover!=null?points[hover]:null;
 const labels=points.length>2?[0,Math.floor((points.length-1)/2),points.length-1]:points.map((_,index)=>index);
 return <div className="mb-chart" ref={host} onPointerMove={pick} onPointerDown={pick} onPointerLeave={()=>setHover(null)}>
  <svg width={width} height={height} role="img" aria-label="Running units through the period">
   <defs>
    <linearGradient id="mb-stroke" x1="0" x2="0" y1={pad.t} y2={height-pad.b} gradientUnits="userSpaceOnUse">
     <stop offset={split} stopColor="var(--mb-up)"/><stop offset={split} stopColor="var(--mb-down)"/>
    </linearGradient>
    <linearGradient id="mb-fill" x1="0" x2="0" y1={pad.t} y2={height-pad.b} gradientUnits="userSpaceOnUse">
     <stop offset="0" stopColor="var(--mb-up)" stopOpacity=".22"/><stop offset={split} stopColor="var(--mb-up)" stopOpacity=".03"/>
     <stop offset={split} stopColor="var(--mb-down)" stopOpacity=".03"/><stop offset="1" stopColor="var(--mb-down)" stopOpacity=".22"/>
    </linearGradient>
   </defs>
   {ticks.map(value=><g key={value} className="mb-grid">{value!==0&&<line x1={pad.l} x2={width-pad.r} y1={y(value)} y2={y(value)}/>}<text x={pad.l-8} y={y(value)+3.5}>{value===0?'0':unitsText(value,1)}</text></g>)}
   <line className="mb-zero" x1={pad.l} x2={width-pad.r} y1={zero} y2={zero}/>
   {area&&<path d={area} fill="url(#mb-fill)"/>}
   {line&&<path d={line} fill="none" stroke="url(#mb-stroke)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>}
   {labels.map(index=><text key={index} className="mb-xlabel" x={x(index)} y={height-8} textAnchor={index===0?'start':index===points.length-1?'end':'middle'}>{dayText(points[index].day)}</text>)}
   {shown&&<g className="mb-hover"><line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height-pad.b}/><circle cx={x(hover)} cy={y(shown.total)} r="4.5" data-tone={tone(shown.total)}/></g>}
  </svg>
  {shown&&<div className="mb-tip" style={{left:Math.min(Math.max(x(hover),70),width-70),top:Math.max(4,y(shown.total)-64)}}>
   <small>{dayText(shown.day)}</small><b data-tone={tone(shown.total)}>{unitsText(shown.total)}</b>
   <span>{shown.count?<>{unitsText(shown.units)} on {shown.count} bet{shown.count===1?'':'s'}</>:'No bets settled'}</span>
  </div>}
 </div>;
}

function Calendar({cells,unit,title,onPick,now}){
 const most=Math.max(1,...cells.filter(cell=>!cell.blank).map(cell=>Math.abs(cell.units)));
 return <div className="mb-cal" data-unit={unit}>
  {title&&<p className="mb-cal-title">{title}</p>}
  {unit==='day'&&<div className="mb-cal-week">{['M','T','W','T','F','S','S'].map((day,index)=><span key={index}>{day}</span>)}</div>}
  <div className="mb-cal-grid">{cells.map(cell=>cell.blank?<span key={cell.key} className="mb-cal-blank"/>
   :<button key={cell.key} type="button" className="mb-cal-cell" data-tone={cell.count?tone(cell.units):'none'} data-out={cell.inside&&!(unit==='day'&&cell.key>now)?undefined:''}
     style={{'--mb-heat':cell.count?Math.max(.18,Math.abs(cell.units)/most):0}} onClick={()=>onPick(cell)} aria-label={`${cell.label}: ${cell.count?unitsText(cell.units):'no bets'}`}>
    <span>{cell.label}</span>{cell.count>0&&<b>{unitsText(cell.units)}</b>}
   </button>)}</div>
 </div>;
}

// ---------------------------------------------------------------- the form

const blank=()=>({kind:'pickem',book:'PrizePicks',sport:'nba',title:'',stake:1,payout:3,odds:-110,date:today(),result:'pending',returned:''});

function BetForm({initial,unit,slips,onSave,onDelete,onClose}){
 // A picture pasted on the page before the form opened comes in with it.
 const {picture:pasted,...given}=initial||{};
 const [bet,setBet]=useState(()=>({...blank(),...given}));
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const set=(key,value)=>setBet(current=>({...current,[key]:value}));
 const paid=multiplierOf({...bet,payout:Number(bet.payout),odds:Number(bet.odds)});
 const stake=Number(bet.stake);
 const toWin=finite(paid)&&stake>0?stake*(paid-1):null;
 const editing=Boolean(bet.id);
 // The stake in units, or in dollars at their unit size.
 const [money,setMoney]=useState(false);
 const [picture,setPicture]=useState({state:'idle'});
 const pictureInput=useRef(null);
 // One read at a time: a new picture, or closing the form, stops the last.
 const reading=useRef(null);
 const lastFile=useRef(null);
 const readFile=async file=>{
  if(!file||!/^image\//.test(file.type||'image/')){setPicture({state:'error',error:'Use a screenshot (PNG, JPG or WEBP).'});return;}
  reading.current?.abort();
  const job=new AbortController();reading.current=job;lastFile.current=file;
  const slow=setTimeout(()=>{if(reading.current===job)setPicture(current=>current.state==='reading'?{...current,slow:true}:current);},6000);
  const limit=setTimeout(()=>job.abort('slow'),READ_LIMIT);
  setPicture({state:'reading'});setError('');
  try{
   const read=await readPicture(file,job.signal);
   if(reading.current!==job)return;
   setBet(current=>({...current,...betFromRead(read,unit,sport=>SPORT_NAME[sport]?sport:'other'),slipId:undefined}));
   setPicture({state:'read',read});
   setMoney(finite(read.stake));
  }catch(problem){
   if(reading.current!==job)return;
   const timedOut=job.signal.aborted;
   setPicture({state:'error',retry:true,error:timedOut?'That took too long. Tap Try again.':problem.message||'That picture couldn\'t be read.'});
  }finally{clearTimeout(slow);clearTimeout(limit);if(reading.current===job)reading.current=null;}
 };
 // Closing the form stops a read on its way.
 useEffect(()=>()=>reading.current?.abort(),[]);
 useEffect(()=>{if(!editing)warmReader();},[]);
 // The Paste button: the picture on the clipboard (iPhone asks first).
 const pastePicture=async()=>{
  try{
   if(!navigator.clipboard?.read)throw new Error('no clipboard');
   for(const item of await navigator.clipboard.read()){
    const type=item.types.find(name=>name.startsWith('image/'));
    if(type){readFile(new File([await item.getType(type)],'pasted',{type}));return;}
   }
   setPicture({state:'error',error:'There\'s no picture on your clipboard. Copy the screenshot first.'});
  }catch{setPicture({state:'error',error:'Your browser didn\'t allow pasting. Tap Add a picture and choose the screenshot instead.'});}
 };
 useEffect(()=>{if(pasted)readFile(pasted);},[]);
 // A screenshot pasted while the form is open is read too.
 useEffect(()=>{
  if(editing)return undefined;
  const paste=event=>{const file=[...(event.clipboardData?.files||[])].find(item=>/^image\//.test(item.type));if(file){event.preventDefault();readFile(file);}};
  document.addEventListener('paste',paste);return()=>document.removeEventListener('paste',paste);
 },[editing,unit]);
 const fromSlip=slip=>setBet(current=>({...current,...betFromSlip(slip,sport=>SPORT_NAME[sport]?sport:'other'),stake:current.stake||1}));
 const submit=async event=>{
  event.preventDefault();setBusy(true);setError('');
  try{await onSave({...bet,stake:Number(bet.stake),payout:Number(bet.payout),odds:Number(bet.odds),returned:bet.result==='cashout'?Number(bet.returned):undefined,check:false});}
  catch(problem){setError(problem.message);setBusy(false);}
 };
 useEffect(()=>{const close=event=>{if(event.key==='Escape')onClose();};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[onClose]);
 // On the page itself, so it sits over the phone's bottom bar too.
 return createPortal(<div className="my-bets mb-sheet" role="dialog" aria-modal="true" aria-label={editing?'Edit bet':'Log a bet'} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
  <form className="mb-form" onSubmit={submit}>
   <header><h2>{editing?'Edit bet':'Log a bet'}</h2><button type="button" className="mb-icon" onClick={onClose} aria-label="Close"><X aria-hidden="true"/></button></header>
   {!editing&&<div className="mb-picture" data-state={picture.state} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();readFile(event.dataTransfer.files?.[0]);}}>
    <input ref={pictureInput} type="file" accept="image/*" hidden onChange={event=>{readFile(event.target.files?.[0]);event.target.value='';}}/>
    {picture.state==='reading'?<p className="mb-picture-busy"><Loader2 aria-hidden="true"/>{picture.slow?'Still reading… busy right now, almost there.':'Reading your bet…'}</p>
     :picture.state==='read'?<div className="mb-picture-read">
      <p><b>Read from your picture</b>{[dollars(picture.read.stake)&&`${dollars(picture.read.stake)} in`,dollars(picture.read.payout)&&`pays ${dollars(picture.read.payout)}`,
        finite(picture.read.multiplier)&&picture.read.kind==='pickem'&&`${Math.round(picture.read.multiplier*100)/100}x`,READ_RESULT[picture.read.result]].filter(Boolean).join(' · ')}</p>
      {picture.read.legs?.length>0&&<span className="mb-picture-legs">{picture.read.legs.map((leg,index)=><em key={index} data-result={leg.result||undefined}>
       {leg.player.split(' ').slice(-1)[0]}{leg.line!=null?` ${leg.side==='UNDER'?'Less':leg.side==='OVER'?'More':''} ${leg.line}`.replace(/\s+/g,' '):''}{leg.actual!=null?` · ${leg.actual}`:''}
       {leg.result==='hit'?' ✓':leg.result==='miss'?' ✗':leg.result==='push'?' =':''}</em>)}</span>}
      {picture.read.doubt&&<small className="mb-picture-guess">The marks on the slip and its numbers didn't agree, so the result goes by the numbers. Check it.</small>}
      {picture.read.estimated&&<small className="mb-picture-guess">The picture didn't show the payout, so this is {(name=>/s$/i.test(name)?`${name}'`:`${name}'s`)(picture.read.app?.name||'the app')} usual {picture.read.multiplier}x for {picture.read.legs?.length} picks. Change Pays if yours is different.</small>}
      <small>Check it below, then tap Log bet. <button type="button" onClick={()=>pictureInput.current?.click()}>Use another picture</button> · <button type="button" onClick={pastePicture}>Paste another</button></small>
     </div>
     :<div className="mb-picture-row">
      <button type="button" className="mb-picture-pick" onClick={()=>pictureInput.current?.click()}>
       <Camera aria-hidden="true"/><span><b>Add a picture of your bet</b><small>What you put in, what it pays and how it went are filled in for you.</small></span>
      </button>
      <button type="button" className="mb-picture-paste" onClick={pastePicture}><ClipboardPaste aria-hidden="true"/>Paste</button>
     </div>}
    {picture.state==='error'&&<p className="mb-picture-error" role="alert">{picture.error} {picture.retry&&lastFile.current&&<><button type="button" onClick={()=>readFile(lastFile.current)}>Try again</button> · </>}<button type="button" onClick={()=>pictureInput.current?.click()}>Choose one</button> · <button type="button" onClick={pastePicture}>Paste again</button></p>}
   </div>}
   {!editing&&slips.length>0&&<details className="mb-from">
    <summary>From a slip you track <small>{slips.length}</small></summary>
    <ul>{slips.map(slip=><li key={slip.id}><button type="button" data-picked={bet.slipId===slip.id?'':undefined} onClick={()=>fromSlip(slip)}>
     <b>{slip.picks.length}-pick {slip.appName||'entry'}</b><small>{slip.picks.slice(0,3).map(pick=>pick.player).join(', ')}{slip.picks.length>3?'…':''}</small>
     {finite(slip.multiplier)&&<em>{slip.multiplier}x</em>}
    </button></li>)}</ul>
    <p>A bet from a tracked slip settles itself when the games are done.</p>
   </details>}
   <div className="mb-seg" role="radiogroup" aria-label="Kind of bet">{KINDS.map(([key,label])=><button key={key} type="button" role="radio" aria-checked={bet.kind===key} onClick={()=>set('kind',key)}>{label}</button>)}</div>
   <div className="mb-fields">
    <label className="mb-wide"><span>What you bet</span><input value={bet.title} onChange={event=>set('title',event.target.value)} placeholder={bet.kind==='straight'?'Knicks −3.5':'3-pick: Brunson, Towns, Bridges'} maxLength={90}/></label>
    <label><span>App or book</span><input list="mb-books" value={bet.book} onChange={event=>set('book',event.target.value)} maxLength={24}/></label>
    <label><span>Sport</span><select value={bet.sport} onChange={event=>set('sport',event.target.value)}>{SPORTS.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label><span className="mb-stake-head">Stake<span className="mb-mini" role="radiogroup" aria-label="Stake in">
      <button type="button" role="radio" aria-checked={!money} onClick={()=>setMoney(false)}>Units</button><button type="button" role="radio" aria-checked={money} onClick={()=>setMoney(true)}>$</button></span></span>
     <input type="number" inputMode="decimal" min="0" step="any" required aria-label={money?'Stake in dollars':'Stake in units'}
      value={money?(stake>0?Math.round(stake*unit*100)/100:bet.stake):bet.stake}
      onChange={event=>set('stake',money&&event.target.value!==''?Math.round(Number(event.target.value)/unit*10000)/10000:event.target.value)}/>
     <small>{money?(stake>0?`${Math.round(stake*100)/100}u`:'—'):(stake>0?moneyText(stake*unit).replace('+',''):'—')} at {unitMoney(unit)} a unit</small></label>
    {bet.kind==='pickem'?<label><span>Pays</span><input type="number" inputMode="decimal" min="1" step="any" value={bet.payout} onChange={event=>set('payout',event.target.value)} required/>
     <small className="mb-chips">{PAYOUTS.map(value=><button key={value} type="button" data-on={Number(bet.payout)===value?'':undefined} onClick={()=>set('payout',value)}>{value}x</button>)}</small></label>
     :<label><span>Odds</span><input type="number" inputMode="numeric" step="1" value={bet.odds} onChange={event=>set('odds',event.target.value)} required/>
     <small>Like −110 or +250</small></label>}
    <label className="mb-wide"><span>Date</span><input type="date" value={bet.date} onChange={event=>set('date',event.target.value)} required/></label>
    <p className="mb-towin">{finite(toWin)?<>To win <b>{unitsText(toWin)}</b> · {moneyText(toWin*unit)}</>:'Enter the stake and price to see what it pays.'}</p>
   </div>
   <div className="mb-seg mb-results" role="radiogroup" aria-label="Result">{RESULTS.map(([key,label])=><button key={key} type="button" role="radio" aria-checked={bet.result===key} data-result={key} onClick={()=>set('result',key)}>{label}</button>)}</div>
   {bet.result==='cashout'&&<label className="mb-returned"><span>Units that came back</span><input type="number" inputMode="decimal" min="0" step="any" value={bet.returned} onChange={event=>set('returned',event.target.value)} required/>
    <small>For a cash out, or a flex entry that paid part</small></label>}
   {error&&<p className="mb-error" role="alert">{error}</p>}
   <footer>
    {editing&&<button type="button" className="mb-delete" onClick={()=>onDelete(bet)} disabled={busy}><Trash2 aria-hidden="true"/>Delete</button>}
    <button type="button" className="mb-ghost" onClick={onClose}>Cancel</button>
    <button type="submit" className="mb-primary" disabled={busy}>{busy?'Saving…':editing?'Save':'Log bet'}</button>
   </footer>
   <datalist id="mb-books">{BOOKS.map(book=><option key={book} value={book}/>)}</datalist>
  </form>
 </div>,document.body);
}

// ---------------------------------------------------------------- the list

function BetRow({bet,onEdit,onResult}){
 const profit=profitOf(bet);
 return <li className="mb-bet" data-result={bet.result}>
  <span className="mb-mark" data-result={bet.result} aria-hidden="true">{RESULT_MARK[bet.result]||'…'}</span>
  <button type="button" className="mb-bet-main" onClick={()=>onEdit(bet)}>
   <b>{bet.title}</b>
   <small>{dayText(bet.date)}<i>·</i>{bet.book||KIND_NAME[bet.kind]}<i>·</i>{SPORT_NAME[bet.sport]||'Other'}{bet.slipId&&<><i>·</i>tracked slip</>}</small>
   {bet.legs?.length>0&&<span className="mb-legs">{bet.legs.slice(0,6).map((leg,index)=><em key={index} data-result={leg.result||undefined}>{leg.player}{leg.line!=null?` ${leg.side==='UNDER'?'U':'O'} ${leg.line}`:''}</em>)}</span>}
   {bet.check&&<span className="mb-check"><AlertTriangle aria-hidden="true"/>A pick was voided, so it may have paid less. Tap to set what it paid.</span>}
  </button>
  <span className="mb-bet-side">
   <small>{Math.round(Number(bet.stake)*100)/100}u @ {priceText(bet)}</small>
   {bet.result==='pending'?<span className="mb-quick">
    <button type="button" data-result="win" onClick={()=>onResult(bet,'win')}>Won</button>
    <button type="button" data-result="loss" onClick={()=>onResult(bet,'loss')}>Lost</button>
    <button type="button" data-result="push" onClick={()=>onResult(bet,'push')}>Push</button>
   </span>:<b data-tone={tone(profit)}>{unitsText(profit,2)}</b>}
  </span>
 </li>;
}

// ---------------------------------------------------------------- the page

export function MyBets(){
 const [state,setState]=useState({loading:true,error:'',bets:[],unit:10});
 const [kind,setKind]=useState('month');
 const [anchor,setAnchor]=useState(today);
 const [sport,setSport]=useState('all');
 const [view,setView]=useState('chart');
 const [editing,setEditing]=useState(null);
 const [slips,setSlips]=useState([]);
 const [unitDraft,setUnitDraft]=useState('');
 const [limit,setLimit]=useState(15);
 const load=()=>call('bets').then(data=>{setState({loading:false,error:'',bets:data.bets||[],unit:data.unit||10});setUnitDraft(String(data.unit||10));})
  .catch(problem=>setState(current=>({...current,loading:false,error:problem.message})));
 useEffect(()=>{load();},[]);
 // A screenshot pasted on the page (Ctrl+V) opens Log a bet and reads it.
 useEffect(()=>{
  if(editing)return undefined;
  const paste=event=>{
   if(/^(input|textarea)$/i.test(event.target?.tagName||''))return;
   const file=[...(event.clipboardData?.files||[])].find(item=>/^image\//.test(item.type));
   if(file){event.preventDefault();setEditing({picture:file});}
  };
  document.addEventListener('paste',paste);return()=>document.removeEventListener('paste',paste);
 },[editing]);
 // The slips they track, to log one as a bet.
 useEffect(()=>{if(editing&&!editing.id)loadHistory().then(data=>setSlips(data.slips||[])).catch(()=>setSlips([]));},[editing]);
 const period=useMemo(()=>periodOf(kind,anchor),[kind,anchor]);
 const now=today();
 const canNext=kind!=='all'&&period.end<now;
 const mine=useMemo(()=>state.bets.filter(bet=>sport==='all'||bet.sport===sport),[state.bets,sport]);
 const shown=useMemo(()=>mine.filter(bet=>inPeriod(bet,period)),[mine,period]);
 useEffect(()=>setLimit(15),[period,sport]);
 const totals=useMemo(()=>summarize(shown),[shown]);
 const allTime=useMemo(()=>summarize(mine),[mine]);
 const run=useMemo(()=>streak(shown),[shown]);
 const points=useMemo(()=>series(shown,period,now),[shown,period,now]);
 const cal=useMemo(()=>calendar(shown,period,anchor),[shown,period,anchor]);
 const sports=useMemo(()=>[...new Set(state.bets.map(bet=>bet.sport))].filter(Boolean),[state.bets]);
 const unit=Number(state.unit)||10;
 const logged=useMemo(()=>new Set(state.bets.map(bet=>bet.slipId).filter(Boolean)),[state.bets]);

 const save=async bet=>{
  const {bet:saved}=await call('bets-save',{bet});
  setState(current=>({...current,bets:[saved,...current.bets.filter(item=>item.id!==saved.id)].sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.at||'').localeCompare(a.at||''))}));
  setEditing(null);
 };
 const remove=async bet=>{
  await call('bets-remove',{id:bet.id});
  setState(current=>({...current,bets:current.bets.filter(item=>item.id!==bet.id)}));
  setEditing(null);
 };
 const mark=(bet,result)=>save({...bet,result,check:false}).catch(problem=>setState(current=>({...current,error:problem.message})));
 const unitTimer=useRef(null),savedUnit=useRef(null);
 const [unitNote,setUnitNote]=useState('');
 const saveUnit=(raw=unitDraft)=>{
  clearTimeout(unitTimer.current);
  const value=Number(raw);
  if(!(value>0)){setUnitDraft(String(unit));return;}
  if(value===(savedUnit.current??unit))return;
  savedUnit.current=value;
  setState(current=>({...current,unit:value}));
  setUnitNote('Saving…');
  call('bets-unit',{unit:value}).then(()=>setUnitNote('Saved')).catch(problem=>{savedUnit.current=null;setUnitNote(problem.message||'Not saved. Try again.');});
 };
 const typeUnit=value=>{setUnitDraft(value);clearTimeout(unitTimer.current);unitTimer.current=setTimeout(()=>saveUnit(value),800);};
 const drill=cell=>{
  if(cal.unit==='day'){setKind('day');setAnchor(cell.key);}
  else if(cal.unit==='month'){setKind('month');setAnchor(`${cell.key}-01`);}
  else{setKind('year');setAnchor(`${cell.key}-01-01`);}
 };

 return <div className="my-bets">
  <header className="mb-head">
   <div><h1>My Bets</h1><p>Every bet you log, in units and dollars. Know if you're winning.</p></div>
   <button type="button" className="mb-primary" onClick={()=>setEditing({})}><Plus aria-hidden="true"/>Log a bet</button>
  </header>

  <div className="mb-bar">
   <div className="mb-seg mb-periods" role="tablist" aria-label="Period">{PERIODS.map(([key,label])=><button key={key} type="button" role="tab" aria-selected={kind===key} onClick={()=>{setKind(key);setAnchor(now);}}>{label}</button>)}</div>
   {kind!=='all'&&<div className="mb-step">
    <button type="button" className="mb-icon" onClick={()=>setAnchor(shiftAnchor(kind,anchor,-1))} aria-label="Earlier"><ChevronLeft aria-hidden="true"/></button>
    <b>{period.label}</b>
    <button type="button" className="mb-icon" onClick={()=>setAnchor(shiftAnchor(kind,anchor,1))} disabled={!canNext} aria-label="Later"><ChevronRight aria-hidden="true"/></button>
   </div>}
  </div>
  {sports.length>1&&<div className="mb-sports" role="tablist" aria-label="Sport">
   {[['all','All'],...SPORTS.filter(([key])=>sports.includes(key))].map(([key,label])=><button key={key} type="button" aria-pressed={sport===key} onClick={()=>setSport(key)}>{label}</button>)}
  </div>}

  {state.error&&<p className="mb-error" role="alert">{state.error}</p>}

  <section className="mb-tiles" aria-label="Totals">
   <div className="mb-tile mb-tile-profit" data-tone={tone(totals.units)}><span>Profit</span><b>{unitsText(totals.units,2)}</b><small>{moneyText(totals.units*unit)} at {unitMoney(unit)} a unit</small></div>
   <div className="mb-tile"><span>Record</span><b>{totals.wins}-{totals.losses}-{totals.pushes}</b><small>{totals.pending?`${totals.pending} pending`:`${totals.count} bet${totals.count===1?'':'s'}`}</small></div>
   <div className="mb-tile"><span>Win rate</span><b>{pct(totals.winRate)}</b><small>{run?`${run.kind==='W'?'Won':'Lost'} last ${run.count}`:'No results yet'}</small></div>
   <div className="mb-tile" data-tone={tone(totals.roi)}><span>ROI</span><b>{pct(totals.roi,true)}</b><small>{Number(totals.staked.toFixed(2))}u staked</small></div>
  </section>

  <section className="mb-card mb-perf">
   <header><h2>{view==='chart'?'Running units':'Day by day'}</h2>
    <div className="mb-seg mb-views" role="tablist" aria-label="View">
     <button type="button" role="tab" aria-selected={view==='chart'} onClick={()=>setView('chart')}><LineChart aria-hidden="true"/>Chart</button>
     <button type="button" role="tab" aria-selected={view==='calendar'} onClick={()=>setView('calendar')}><CalendarDays aria-hidden="true"/>Calendar</button>
    </div></header>
   {state.loading?<div className="mb-wait" aria-label="Loading"/>
    :view==='chart'?(points.some(point=>point.count)?<UnitsChart points={points}/>:<p className="mb-empty">No settled bets {kind==='all'?'yet':'in this stretch'}.</p>)
    :<Calendar {...cal} now={now} onPick={drill}/>}
  </section>

  <section className="mb-card mb-unit">
   <label><span>Unit size</span><span className="mb-dollar">$<input type="number" inputMode="decimal" min="0.01" step="any" value={unitDraft} onChange={event=>typeUnit(event.target.value)} onBlur={()=>saveUnit()} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}} aria-label="Dollars per unit"/></span>{unitNote&&<small className="mb-unit-note" data-tone={unitNote==='Saved'?'up':unitNote==='Saving…'?undefined:'down'}>{unitNote}</small>}</label>
   <p><span>{period.label}</span><b data-tone={tone(totals.units)}>{moneyText(totals.units*unit)}</b></p>
   <p><span>All time</span><b data-tone={tone(allTime.units)}>{moneyText(allTime.units*unit)}</b></p>
  </section>

  <section className="mb-card mb-list">
   <header><h2>Bets</h2><small>{shown.length} in {period.label.toLowerCase()==='all time'?'all':period.label}</small></header>
   {state.loading?<div className="mb-wait"/>
    :shown.length?<><ul>{shown.slice(0,limit).map(bet=><BetRow key={bet.id} bet={bet} onEdit={setEditing} onResult={mark}/>)}</ul>
     {shown.length>limit&&<button type="button" className="mb-ghost mb-more" onClick={()=>setLimit(count=>count+15)}>Show more<small>{shown.length-limit} left</small></button>}</>
    :<div className="mb-none"><p>{state.bets.length?'No bets in this stretch.':'No bets logged yet.'}</p><button type="button" className="mb-ghost" onClick={()=>setEditing({})}><Plus aria-hidden="true"/>Log your first bet</button></div>}
  </section>

  {editing&&<BetForm initial={editing} unit={unit} slips={slips.filter(slip=>!logged.has(slip.id))} onSave={save} onDelete={remove} onClose={()=>setEditing(null)}/>}
 </div>;
}
