import React,{useState} from 'react';
import {Check,ChevronDown,Clock,Minus,Trophy,X} from 'lucide-react';
import {TIERS,sideWord} from './slip-check';

// How the grades have done (the site's record over 30 days) and the
// member's own graded slips with each pick's result (slip_ledger.py).

const nice=value=>Number.isInteger(value)?String(value):Number(value).toFixed(1);
function when(value){
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return '';
 const today=new Date();
 const same=date.toDateString()===today.toDateString();
 const time=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 return same?`Today ${time}`:`${date.toLocaleDateString([],{month:'short',day:'numeric'})}, ${time}`;
}

/** Each tier's hit rate over the last 30 days, best tier first. */
export function Record({record}){
 if(!record)return null;
 const rows=Object.keys(TIERS).map(tier=>[tier,record.tiers?.[tier]]).filter(([,counts])=>counts?.picks>0);
 return <section className="sh-record" aria-label="How our grades have done">
  <header><span className="sh-eyebrow"><Trophy size={13}/>Our record</span>
   <h2>How our grades have done</h2>
   <p>Every pick graded here, settled from the final box score. Last {record.days} days.</p></header>
  {rows.length?<ul>{rows.map(([tier,counts],index)=><li key={tier} data-tier={tier} style={{'--i':index}}>
   <span className="sh-tier">{TIERS[tier].label}</span>
   <span className="sh-bar" aria-hidden="true"><i style={{'--w':`${Math.round(counts.rate*100)}%`}}/></span>
   <b>{Math.round(counts.rate*100)}%</b>
   <small>{counts.hits}–{counts.misses}</small>
  </li>)}</ul>
   :<p className="sh-empty">Results show up here as graded picks finish.</p>}
  {record.picks>0&&record.picks<30&&<p className="sh-note">Early days: {record.picks} pick{record.picks===1?'':'s'} settled so far, so these will move.</p>}
 </section>;
}

const STATUS={won:'Won',lost:'Lost',pending:'Pending',void:'Void'};
const RESULT_ICON={hit:Check,miss:X,push:Minus,void:Minus,unknown:Minus};

/** The member's graded slips, newest first; tap one for its picks. */
export function History({slips}){
 const [open,setOpen]=useState(null);
 if(!slips?.length)return null;
 return <section className="sh-history" aria-label="Your graded slips">
  <header><h2>Your graded slips</h2><span>{slips.length} kept</span></header>
  <ul>{slips.slice(0,12).map(slip=>{
   const counted=slip.picks.filter(pick=>pick.result==='hit'||pick.result==='miss').length;
   const app={key:slip.app};
   return <li key={slip.id} data-status={slip.status}>
    <button type="button" onClick={()=>setOpen(open===slip.id?null:slip.id)} aria-expanded={open===slip.id}>
     <span className="sh-letter" data-band={(slip.letter||'F')[0]}>{slip.letter||'–'}</span>
     <span className="sh-what"><b>{slip.picks.length}-Pick{slip.appName?` ${slip.appName}`:''}</b>
      <small>{when(slip.at)}{counted?` · ${slip.hits} of ${counted} hit`:''}</small></span>
     <span className="sh-dots" aria-hidden="true">{slip.picks.map((pick,index)=><i key={index} data-result={pick.result||'pending'}/>)}</span>
     <span className="sh-status">{slip.status==='pending'&&<Clock size={12}/>}{STATUS[slip.status]||'Pending'}</span>
     <ChevronDown className="sh-chevron" size={15}/>
    </button>
    {open===slip.id&&<ul className="sh-picks">{slip.picks.map((pick,index)=>{
     const Icon=RESULT_ICON[pick.result]||Clock;
     return <li key={index} data-result={pick.result||'pending'}>
      <span className="sh-result"><Icon size={13} strokeWidth={3}/></span>
      <span className="sh-pick"><b>{pick.player}</b><small>{sideWord(pick.side,app)} {nice(pick.line)} {pick.stat}</small></span>
      {pick.value!=null&&<em>{nice(pick.value)}</em>}
      {pick.tier&&<span className="sh-pill" data-tier={pick.tier}>{TIERS[pick.tier]?.label}</span>}
     </li>;})}</ul>}
   </li>;})}</ul>
 </section>;
}
