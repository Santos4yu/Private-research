// Small pieces the Game Predictor's pages share (GamePredictor.jsx,
// PropGenerator.jsx, GameRecord.jsx): the loading shimmer, the empty state,
// a section with its heading, the menu pill and the sliding switch.
import React,{useEffect,useRef,useState} from 'react';
import {CalendarDays,Check,ChevronDown} from 'lucide-react';
import {useInk,inkStyle} from './use-ink.js';

export const Shimmer=({rows=4,tall})=><div className={`gp-shimmer${tall?' is-tall':''}`} role="status" aria-label="Loading">{Array.from({length:rows},(_,index)=><span key={index} style={{'--i':index}}/>)}</div>;
export const Empty=({icon:Icon=CalendarDays,title,text,children})=><div className="gp-empty"><Icon size={22} aria-hidden="true"/><b>{title}</b>{text&&<p>{text}</p>}{children}</div>;
export const Section=({title,icon:Icon,children,className=''})=><section className={`gp-sec ${className}`}>
 {title&&<h4 className="gp-sec-head">{Icon&&<Icon size={15} aria-hidden="true"/>}{title}</h4>}{children}
</section>;

// A pill that opens a short list (league, order, parlays...).
export function ChipMenu({label,value,options,onChange}){
 const [open,setOpen]=useState(false);
 const wrap=useRef(null);
 useEffect(()=>{
  if(!open)return undefined;
  const away=event=>{if(!wrap.current?.contains(event.target))setOpen(false);};
  const key=event=>{if(event.key==='Escape')setOpen(false);};
  document.addEventListener('pointerdown',away);document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('pointerdown',away);document.removeEventListener('keydown',key);};
 },[open]);
 const current=options.find(option=>option.key===value)||options[0];
 return <div className="gp-menu" ref={wrap}>
  <button type="button" className="gp-menu-pill" aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${current.text}`} onClick={()=>setOpen(old=>!old)}>
   {current.short||current.text}<ChevronDown size={15} aria-hidden="true"/>
  </button>
  {open&&<div className="gp-menu-list" role="listbox" aria-label={label}>
   {options.map((option,index)=><React.Fragment key={option.key}>
    {option.group&&option.group!==options[index-1]?.group&&<span className="gp-menu-group">{option.group}</span>}
    <button type="button" role="option" aria-selected={option.key===value} onClick={()=>{onChange(option.key);setOpen(false);}}>
     {option.text}{option.key===value&&<Check size={15} aria-hidden="true"/>}
    </button>
   </React.Fragment>)}
  </div>}
 </div>;
}

// A switch of two or three, one pill sliding to the picked one.
export function Segmented({options,value,onChange,label,wide}){
 const row=useRef(null),ink=useInk(row,value,'[aria-checked=true]');
 return <div className={`gp-seg${wide?' is-wide':''}`} role="radiogroup" aria-label={label} ref={row}>
  <span className="gp-seg-ink" style={inkStyle(ink)} aria-hidden="true"/>
  {options.map(([key,text])=><button type="button" role="radio" key={key} aria-checked={value===key} onClick={()=>onChange(key)}>{text}</button>)}
 </div>;
}
