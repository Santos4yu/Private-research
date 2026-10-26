// The write-up pop-up on an NBA player page (admins only, NbaMatchupPage.jsx):
// pick which of his lines, add it to the post (legs from other players'
// pages stay in it, writeup.js), set the title, units and confidence, and
// copy a Discord-ready post. The text can be edited before copying.
import React,{useEffect,useMemo,useState} from 'react';
import {Check,Copy,Plus,Trash2,X} from 'lucide-react';
import {STAT_SHORT,TAGS,addLeg,clearLegs,formatPost,onWriteupSlip,removeLeg,writeupSlip} from './writeup';

const figure=value=>Number.isInteger(Number(value))?String(Number(value)):Number(value).toFixed(1);

export function WriteupSheet({lines,buildLeg,onClose}){
 // His lines tonight, one per stat (the standard one first).
 const offered=useMemo(()=>{const seen=new Map();
  for(const item of [...lines].sort((a,b)=>(a.modifier&&a.modifier!=='standard')-(b.modifier&&b.modifier!=='standard')))
   if(STAT_SHORT[item.marketKey]&&!seen.has(item.marketKey))seen.set(item.marketKey,item);
  return [...seen.values()];},[lines]);
 const [market,setMarket]=useState(offered[0]?.marketKey);
 const chosen=offered.find(item=>item.marketKey===market)||offered[0];
 const leg=useMemo(()=>chosen?buildLeg(chosen.marketKey,Number(chosen.line)):null,[chosen,buildLeg]);
 const [slip,setSlip]=useState(writeupSlip);
 useEffect(()=>onWriteupSlip(setSlip),[]);
 const [tag,setTag]=useState('PICK'),[units,setUnits]=useState(''),[confidence,setConfidence]=useState(''),[perLeg,setPerLeg]=useState(3);
 const inSlip=leg&&slip.some(item=>item.key===leg.key);
 // The post: the gathered legs (this one refreshed if it's among them), else this one alone.
 const legs=slip.length?slip.map(item=>item.key===leg?.key?leg:item):leg?[leg]:[];
 const generated=useMemo(()=>formatPost(legs,{tag,units,confidence,perLeg}),[legs,tag,units,confidence,perLeg]);
 const [text,setText]=useState(generated);
 useEffect(()=>setText(generated),[generated]);
 const [copied,setCopied]=useState(false);
 const copy=async()=>{
  try{await navigator.clipboard.writeText(text);}catch{const area=document.querySelector('.wu-text');area?.select();document.execCommand?.('copy');}
  setCopied(true);setTimeout(()=>setCopied(false),1600);
 };
 return <div className="wu">
  <div className="wu-row"><span>His line</span><div className="wu-chips">{offered.map(item=>
   <button type="button" key={item.marketKey} aria-pressed={item.marketKey===chosen?.marketKey} onClick={()=>setMarket(item.marketKey)}>
    {STAT_SHORT[item.marketKey]} {figure(item.line)}</button>)}</div></div>
  {leg&&<div className="wu-leg-now">
   <div><b>{leg.header}</b><small>{leg.facts.length?`${leg.facts.length} reasons found`:'No strong reasons for the over in this one'}</small></div>
   <button type="button" className="wu-add" data-on={inSlip||undefined} onClick={()=>inSlip?removeLeg(leg.key):addLeg(leg)}>
    {inSlip?<><Check size={15} aria-hidden="true"/>In the post</>:<><Plus size={15} aria-hidden="true"/>Add to post</>}</button>
  </div>}
  {slip.length>0&&<div className="wu-slip"><div className="wu-slip-head"><span>In the post ({slip.length})</span>
   <button type="button" onClick={clearLegs}>Clear</button></div>
   {slip.map(item=><div className="wu-slip-leg" key={item.key}><span>{item.header}</span>
    <button type="button" onClick={()=>removeLeg(item.key)} aria-label={`Remove ${item.header}`}><Trash2 size={14}/></button></div>)}
   <p>Open another player's page to add his line too.</p></div>}
  <div className="wu-opts">
   <label><span>Label</span><select value={tag} onChange={event=>setTag(event.target.value)}>{TAGS.map(item=><option key={item}>{item}</option>)}</select></label>
   <label><span>Units</span><input value={units} onChange={event=>setUnits(event.target.value)} placeholder="1.5" inputMode="decimal"/></label>
   <label><span>Confidence</span><input value={confidence} onChange={event=>setConfidence(event.target.value)} placeholder="4.5" inputMode="decimal"/></label>
   <label><span>Reasons</span><select value={perLeg} onChange={event=>setPerLeg(Number(event.target.value))}>{[2,3,4,5].map(n=><option key={n} value={n}>{n} a leg</option>)}</select></label>
  </div>
  <textarea className="wu-text" value={text} onChange={event=>setText(event.target.value)} spellCheck={false} aria-label="Post"/>
  <div className="wu-actions">
   <button type="button" className="wu-copy" onClick={copy}>{copied?<><Check size={16} aria-hidden="true"/>Copied</>:<><Copy size={16} aria-hidden="true"/>Copy for Discord</>}</button>
   <button type="button" className="wu-close" onClick={onClose}><X size={16} aria-hidden="true"/>Close</button>
  </div>
 </div>;
}
