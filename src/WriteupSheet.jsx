// The write-up pop-up on an NBA player page (admins only, NbaMatchupPage.jsx):
// pick which of his lines, add it to the post (legs from other players'
// pages stay in it, writeup.js), set the label, units and confidence, see
// the post the way Discord shows it (or edit the text), and copy it from a
// bar that stays at the bottom (Oct 25, the owner: the dock covered Copy and
// the screen "kinda bad": now compact, a preview, Copy always in reach).
import React,{useEffect,useMemo,useState} from 'react';
import {Check,Copy,Plus,X} from 'lucide-react';
import {STAT_SHORT,TAGS,addLeg,clearLegs,formatPost,onWriteupSlip,removeLeg,writeupSlip} from './writeup';

const figure=value=>Number.isInteger(Number(value))?String(Number(value)):Number(value).toFixed(1);

// The post as Discord draws it: ## / ### headings, > quotes, -# small text, **bold**.
function Inline({text}){
 return text.split(/(\*\*[^*]+\*\*)/).map((part,index)=>/^\*\*[^*]+\*\*$/.test(part)?<b key={index}>{part.slice(2,-2)}</b>:part);
}
function DiscordPreview({text}){
 return <div className="wu-discord" aria-label="Preview">{text.split('\n').map((line,index)=>{
  if(!line.trim())return <div key={index} className="wu-d-gap"/>;
  if(line.startsWith('## '))return <div key={index} className="wu-d-h2"><Inline text={line.slice(3)}/></div>;
  if(line.startsWith('### '))return <div key={index} className="wu-d-h3"><Inline text={line.slice(4)}/></div>;
  if(line.startsWith('# '))return <div key={index} className="wu-d-h1"><Inline text={line.slice(2)}/></div>;
  if(line.startsWith('-# '))return <div key={index} className="wu-d-sub"><Inline text={line.slice(3)}/></div>;
  if(line.startsWith('> '))return <div key={index} className="wu-d-quote"><Inline text={line.slice(2)}/></div>;
  return <div key={index} className="wu-d-p"><Inline text={line}/></div>;
 })}</div>;
}

export function WriteupSheet({lines,buildLeg}){
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
 const [view,setView]=useState('preview');
 const [copied,setCopied]=useState(false);
 const copy=async()=>{
  try{await navigator.clipboard.writeText(text);}
  catch{const area=document.createElement('textarea');area.value=text;document.body.append(area);area.select();document.execCommand?.('copy');area.remove();}
  setCopied(true);setTimeout(()=>setCopied(false),1600);
 };
 return <div className="wu">
  <div className="wu-lines" role="group" aria-label="His line">{offered.map(item=>
   <button type="button" key={item.marketKey} aria-pressed={item.marketKey===chosen?.marketKey} onClick={()=>setMarket(item.marketKey)}>
    <small>{STAT_SHORT[item.marketKey]}</small><b>{figure(item.line)}</b></button>)}</div>

  {leg&&<div className="wu-leg-now">
   <span><b>{leg.header}</b><small>{leg.facts.length?`${leg.facts.length} ${leg.facts.length===1?'reason':'reasons'} for the over`:'Nothing strong for the over in this one'}</small></span>
   <button type="button" className="wu-add" data-on={inSlip||undefined} onClick={()=>inSlip?removeLeg(leg.key):addLeg(leg)}
    aria-label={inSlip?'Remove from the post':'Add to the post'}>{inSlip?<Check size={16} aria-hidden="true"/>:<Plus size={16} aria-hidden="true"/>}<span>{inSlip?'Added':'Add'}</span></button>
  </div>}

  {slip.length>0&&<div className="wu-slip"><span className="wu-cap">Parlay · {slip.length} {slip.length===1?'leg':'legs'}</span>
   {slip.map(item=><button type="button" key={item.key} className="wu-chip" onClick={()=>removeLeg(item.key)} aria-label={`Remove ${item.header}`}>
    {item.header.split(' · ')[0]} <small>{item.header.split(' · ')[1]}</small><X size={12} aria-hidden="true"/></button>)}
   <button type="button" className="wu-clear" onClick={clearLegs}>Clear</button></div>}

  <div className="wu-opts">
   <label><span>Label</span><select value={tag} onChange={event=>setTag(event.target.value)}>{TAGS.map(item=><option key={item}>{item}</option>)}</select></label>
   <label><span>Units</span><input value={units} onChange={event=>setUnits(event.target.value)} placeholder="—" inputMode="decimal"/></label>
   <label><span>Confidence</span><input value={confidence} onChange={event=>setConfidence(event.target.value)} placeholder="—" inputMode="decimal"/></label>
   <label><span>Reasons</span><select value={perLeg} onChange={event=>setPerLeg(Number(event.target.value))}>{[2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
  </div>

  <div className="wu-view" role="tablist" aria-label="Post">
   {[['preview','Preview'],['edit','Edit text']].map(([key,label])=><button type="button" role="tab" key={key} aria-selected={view===key} onClick={()=>setView(key)}>{label}</button>)}
  </div>
  {view==='preview'?<DiscordPreview text={text}/>
   :<textarea className="wu-text" value={text} onChange={event=>setText(event.target.value)} spellCheck={false} aria-label="Post text"/>}

  <div className="wu-bar">
   <button type="button" className="wu-copy" data-done={copied||undefined} onClick={copy} disabled={!text}>
    {copied?<><Check size={17} aria-hidden="true"/>Copied, paste it in Discord</>:<><Copy size={17} aria-hidden="true"/>Copy for Discord</>}</button>
  </div>
 </div>;
}
