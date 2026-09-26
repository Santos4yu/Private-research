import React,{useContext,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown,ChartNoAxesColumnIncreasing,Search} from 'lucide-react';
import {FinderDropdownAssets} from './FinderDropdown';

function optionLogo(assets,label,option){return option.logo || assets[label]?.[option.value] || null;}
function OptionIcon({src}){return src?<img className="finder-multi-option-logo" src={src} alt="" decoding="async" onError={event=>{event.currentTarget.hidden=true;}}/>:null;}

function usePopover(open,triggerRef,menuRef){
 const [rect,setRect]=useState(null);
 useEffect(()=>{
  if(!open)return undefined;
  const measure=()=>{const trigger=triggerRef.current;if(!trigger)return;const next=trigger.getBoundingClientRect();setRect({left:next.left,top:next.bottom+7,width:next.width});};
  measure();window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);
  return()=>{window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};
 },[open,triggerRef]);
 return rect;
}

function menuStyle(rect){
 if(!rect)return {visibility:'hidden'};
 const width=Math.min(Math.max(rect.width,280),window.innerWidth-24);
 const maxTop=Math.max(12,window.innerHeight-420);
 return {left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),top:Math.max(12,Math.min(rect.top,maxTop)),width};
}

export function FinderMultiSelect({label,icon:Icon,values=[],onChange,options=[],placeholder='All',searchable=true}){
 const assets=useContext(FinderDropdownAssets);const [open,setOpen]=useState(false);const [query,setQuery]=useState('');
 const triggerRef=useRef(null);const menuRef=useRef(null);const rect=usePopover(open,triggerRef,menuRef);
 useEffect(()=>{if(!open)return undefined;const escape=event=>{if(event.key==='Escape')setOpen(false);};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[open]);
 useEffect(()=>{if(!open)return undefined;const outside=event=>{if(!triggerRef.current?.contains(event.target)&&!menuRef.current?.contains(event.target))setOpen(false);};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[open]);
 const selected=new Set(values);const visible=useMemo(()=>{const term=query.trim().toLowerCase();return options.filter(option=>!term||String(option.label).toLowerCase().includes(term));},[options,query]);
 const active=values.length>0;const display=values.length===0?placeholder:values.length===1?(options.find(option=>option.value===values[0])?.label||values[0]):`${values.length} selected`;
 const toggle=value=>onChange(selected.has(value)?values.filter(item=>item!==value):[...values,value]);
 const selectAll=()=>{const all=visible.map(option=>option.value);const every=all.length>0&&all.every(value=>selected.has(value));onChange(every?values.filter(value=>!all.includes(value)):[...new Set([...values,...all])]);};
 const content=open&&typeof document!=='undefined'?createPortal(<div className="finder-multi-popover" ref={menuRef} style={menuStyle(rect)} role="dialog" aria-label={label}>
   {searchable&&<label className="finder-multi-search"><Search size={17}/><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search…" aria-label={`Search ${label}`}/></label>}
   <button type="button" className="finder-multi-select-all" onClick={selectAll}><span className={'finder-multi-check '+(visible.length>0&&visible.every(option=>selected.has(option.value))?'is-checked':'')}>{visible.length>0&&visible.every(option=>selected.has(option.value))&&<Check size={15}/>}</span><strong>Select All</strong></button>
   <div className="finder-multi-options" role="listbox" aria-multiselectable="true">{visible.map(option=>{const checked=selected.has(option.value);return <button type="button" role="option" aria-selected={checked} key={option.value} className={'finder-multi-option '+(checked?'is-selected':'')} onClick={()=>toggle(option.value)} disabled={option.disabled}><span className={'finder-multi-check '+(checked?'is-checked':'')}>{checked&&<Check size={15}/>}</span><OptionIcon src={optionLogo(assets,label,option)}/><span className="finder-multi-option-text">{option.label}</span>{option.meta&&<small>{option.meta}</small>}</button>;})}{!visible.length&&<span className="finder-multi-empty">No matching options</span>}</div>
   <button type="button" className="finder-multi-close" onClick={()=>{setOpen(false);setQuery('');}}>Close</button>
 </div>,document.body):null;
 return <><div className={'finder-multi-select '+(active?'is-active':'')}><button ref={triggerRef} type="button" className="finder-multi-trigger" aria-expanded={open} aria-haspopup="dialog" onClick={()=>setOpen(value=>!value)}><Icon size={15} aria-hidden="true"/><span>{display}</span>{active&&<b>{values.length}</b>}<ChevronDown size={14} aria-hidden="true"/></button></div>{content}</>;
}

const HIT_WINDOWS=[['l5','L5'],['l10','L10'],['l15','L15'],['h2h','H2H'],['season','SZN']];
const emptyHit={windows:['l10'],min:0,max:100};
export function FinderHitRateFilter({value=emptyHit,onChange}){
 const [open,setOpen]=useState(false);const triggerRef=useRef(null);const menuRef=useRef(null);const rect=usePopover(open,triggerRef,menuRef);
 const current={...emptyHit,...value,windows:value.windows?.length?value.windows:[]};const active=current.windows.length>0||current.min>0||current.max<100;
 useEffect(()=>{if(!open)return undefined;const escape=event=>{if(event.key==='Escape')setOpen(false);};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[open]);
 useEffect(()=>{if(!open)return undefined;const outside=event=>{if(!triggerRef.current?.contains(event.target)&&!menuRef.current?.contains(event.target))setOpen(false);};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[open]);
 const toggleWindow=key=>onChange({...current,windows:current.windows.includes(key)?current.windows.filter(item=>item!==key):[...current.windows,key]});
 const content=open&&typeof document!=='undefined'?createPortal(<div className="finder-hit-popover" ref={menuRef} style={menuStyle(rect)} role="dialog" aria-label="Hit rate filters">
   <header><div><strong>Hit Rate Between</strong><small>Select columns and range</small></div><button type="button" onClick={()=>onChange(emptyHit)}>Reset</button></header>
   <div className="finder-hit-windows">{HIT_WINDOWS.map(([key,label])=><button type="button" key={key} className={current.windows.includes(key)?'is-selected':''} onClick={()=>toggleWindow(key)}>{label}</button>)}</div>
   <div className="finder-hit-fields"><label>From<input type="number" min="0" max="100" inputMode="numeric" value={current.min} onChange={event=>onChange({...current,min:Math.max(0,Math.min(Number(event.target.value)||0,current.max))})}/></label><label>To<input type="number" min="0" max="100" inputMode="numeric" value={current.max} onChange={event=>onChange({...current,max:Math.min(100,Math.max(Number(event.target.value)||0,current.min))})}/></label></div>
   <div className="finder-hit-slider"><div className="finder-hit-track"/><input aria-label="Minimum hit rate" type="range" min="0" max="100" value={current.min} onChange={event=>onChange({...current,min:Math.min(Number(event.target.value),current.max)})}/><input aria-label="Maximum hit rate" type="range" min="0" max="100" value={current.max} onChange={event=>onChange({...current,max:Math.max(Number(event.target.value),current.min)})}/><div><span>0%</span><span>50%</span><span>100%</span></div></div>
   <div className="finder-hit-presets">{[55,60,70,80].map(min=><button type="button" key={min} onClick={()=>onChange({...current,min,max:100})}>{min}%+</button>)}</div>
   <p>Empty column selection means all available hit-rate columns for this sport.</p>
   <button type="button" className="finder-multi-close" onClick={()=>setOpen(false)}>Close</button>
 </div>,document.body):null;
 return <><div className={'finder-multi-select finder-hit-filter '+(active?'is-active':'')}><button ref={triggerRef} type="button" className="finder-multi-trigger" aria-expanded={open} aria-haspopup="dialog" onClick={()=>setOpen(open=>!open)}><ChartNoAxesColumnIncreasing size={15}/><span>Hit Rate</span>{active&&<b>1</b>}<ChevronDown size={14}/></button></div>{content}</>;
}
