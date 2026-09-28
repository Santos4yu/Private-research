import React,{useContext,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown,ChartNoAxesColumnIncreasing,Grid2X2,Search} from 'lucide-react';
import {FinderDropdownAssets} from './FinderDropdown';

function optionLogo(assets,label,option){return option.logo || assets[label]?.[option.value] || null;}
function OptionIcon({src}){return src?<img className="finder-multi-option-logo" src={src} alt="" decoding="async" onError={event=>{event.currentTarget.hidden=true;}}/>:null;}

// Focus the search box on opening only with a mouse: on a phone it would
// pop the keyboard up over a list of a few options.
const focusSearch=()=>typeof window!=='undefined'&&Boolean(window.matchMedia?.('(pointer: fine)').matches);

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

function menuStyle(rect,width=240){
 if(!rect)return {visibility:'hidden'};
 width=Math.min(width,window.innerWidth-24);
 const maxTop=Math.max(12,window.innerHeight-420);
 return {left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),top:Math.max(12,Math.min(rect.top,maxTop)),width};
}

// Options can carry a second line (sub), a heading they sit under (group),
// their own row content (render) and an "Only" shortcut (only).
export function FinderMultiSelect({label,icon:Icon,values=[],onChange,options=[],placeholder='All',searchable=true,only=false,wide=false}){
 const assets=useContext(FinderDropdownAssets);const [open,setOpen]=useState(false);const [query,setQuery]=useState('');
 const triggerRef=useRef(null);const menuRef=useRef(null);const rect=usePopover(open,triggerRef,menuRef);
 useEffect(()=>{if(!open)return undefined;const escape=event=>{if(event.key==='Escape')setOpen(false);};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[open]);
 useEffect(()=>{if(!open)return undefined;const outside=event=>{if(!triggerRef.current?.contains(event.target)&&!menuRef.current?.contains(event.target))setOpen(false);};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[open]);
 const selected=new Set(values);const visible=useMemo(()=>{const term=query.trim().toLowerCase();return options.filter(option=>!term||[option.label,option.sub,option.search,option.group].some(text=>String(text||'').toLowerCase().includes(term)));},[options,query]);
 const active=values.length>0;const display=values.length===0?placeholder:values.length===1?(options.find(option=>option.value===values[0])?.label||values[0]):`${values.length} selected`;
 const toggle=value=>onChange(selected.has(value)?values.filter(item=>item!==value):[...values,value]);
 const selectAll=()=>{const all=visible.map(option=>option.value);const every=all.length>0&&all.every(value=>selected.has(value));onChange(every?values.filter(value=>!all.includes(value)):[...new Set([...values,...all])]);};
 const content=open&&typeof document!=='undefined'?createPortal(<div className={'finder-multi-popover'+(wide?' is-wide':'')} ref={menuRef} style={menuStyle(rect,wide?360:240)} role="dialog" aria-label={label}>
   {searchable&&<label className="finder-multi-search"><Search size={17}/><input autoFocus={focusSearch()} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search…" aria-label={`Search ${label}`}/></label>}
   <button type="button" className="finder-multi-select-all" onClick={selectAll}><span className={'finder-multi-check '+(visible.length>0&&visible.every(option=>selected.has(option.value))?'is-checked':'')}>{visible.length>0&&visible.every(option=>selected.has(option.value))&&<Check size={15}/>}</span><strong>Select All</strong></button>
   <div className="finder-multi-options" role="listbox" aria-multiselectable="true">{visible.map((option,index)=>{const checked=selected.has(option.value);const heading=option.group&&option.group!==visible[index-1]?.group;return <React.Fragment key={option.value}>{heading&&<span className="finder-multi-group" role="presentation">{option.group}</span>}<div className={'finder-multi-row'+(only?' has-only':'')}><button type="button" role="option" aria-selected={checked} aria-label={option.aria||undefined} className={'finder-multi-option '+(checked?'is-selected':'')+(option.render?' is-custom':'')} onClick={()=>toggle(option.value)} disabled={option.disabled}><span className={'finder-multi-check '+(checked?'is-checked':'')}>{checked&&<Check size={15}/>}</span>{option.render?option.render():<><OptionIcon src={optionLogo(assets,label,option)}/><span className="finder-multi-option-text">{option.label}{option.sub&&<small className="finder-multi-option-sub">{option.sub}</small>}</span>{option.meta&&<small>{option.meta}</small>}</>}</button>{only&&<button type="button" className="finder-sport-only" aria-label={`Only ${option.aria||option.label}`} onClick={()=>{onChange([option.value]);setOpen(false);setQuery('');}}>Only</button>}</div></React.Fragment>;})}{!visible.length&&<span className="finder-multi-empty">No matching options</span>}</div>
   <button type="button" className="finder-multi-close" onClick={()=>{setOpen(false);setQuery('');}}>Close</button>
 </div>,document.body):null;
 return <><div className={'finder-multi-select '+(active?'is-active':'')}><button ref={triggerRef} type="button" className="finder-multi-trigger" aria-expanded={open} aria-haspopup="dialog" onClick={()=>setOpen(value=>!value)}><Icon size={15} aria-hidden="true"/><span>{display}</span>{active&&<b>{values.length}</b>}<ChevronDown size={14} aria-hidden="true"/></button></div>{content}</>;
}

/**
 * The Finder's league picker on phones: several leagues at once, "Only" to
 * keep just one. No league picked means every league, like the other
 * filters' "All".
 */
export function FinderSportMenu({sports=[],values=[],onChange,logos={}}){
 const [open,setOpen]=useState(false);const [query,setQuery]=useState('');
 const triggerRef=useRef(null);const menuRef=useRef(null);const rect=usePopover(open,triggerRef,menuRef);
 useEffect(()=>{if(!open)return undefined;const escape=event=>{if(event.key==='Escape')setOpen(false);};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[open]);
 useEffect(()=>{if(!open)return undefined;const outside=event=>{if(!triggerRef.current?.contains(event.target)&&!menuRef.current?.contains(event.target))setOpen(false);};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[open]);
 const picked=values.filter(key=>sports.includes(key));const name=key=>key.toUpperCase();
 const visible=sports.filter(key=>!query.trim()||name(key).toLowerCase().includes(query.trim().toLowerCase()));
 const every=sports.length>0&&sports.every(key=>picked.includes(key));
 const toggle=key=>onChange(picked.includes(key)?picked.filter(item=>item!==key):[...picked,key]);
 const close=()=>{setOpen(false);setQuery('');};
 const tile=key=><span className="finder-sport-tile" aria-hidden="true"><img src={logos[key]} alt="" decoding="async" onError={event=>{event.currentTarget.hidden=true;}}/></span>;
 const label=picked.length===0||every?'All sports':picked.length===1?name(picked[0]):`${picked.length} sports`;
 const content=open&&typeof document!=='undefined'?createPortal(<div className="finder-multi-popover finder-sport-popover" ref={menuRef} style={menuStyle(rect,320)} role="dialog" aria-label="Choose sports">
   <label className="finder-multi-search"><Search size={17}/><input autoFocus={focusSearch()} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search sports…" aria-label="Search sports"/></label>
   <button type="button" className="finder-multi-select-all" onClick={()=>onChange(every?[]:sports)}><span className={'finder-multi-check '+(every?'is-checked':'')}>{every&&<Check size={15}/>}</span><strong>Select All</strong></button>
   <div className="finder-multi-options" role="listbox" aria-multiselectable="true">{visible.map(key=>{const checked=picked.includes(key);return <div key={key} className={'finder-sport-row '+(checked?'is-selected':'')}>
    <button type="button" role="option" aria-selected={checked} className="finder-multi-option" onClick={()=>toggle(key)}><span className={'finder-multi-check '+(checked?'is-checked':'')}>{checked&&<Check size={15}/>}</span>{tile(key)}<span className="finder-multi-option-text">{name(key)}</span></button>
    <button type="button" className="finder-sport-only" aria-label={`Only ${name(key)}`} onClick={()=>{onChange([key]);close();}}>Only</button>
   </div>;})}</div>
   <div className="finder-sport-footer"><button type="button" className="finder-multi-close" onClick={()=>onChange([])}>Clear</button><button type="button" className="finder-multi-close" onClick={close}>Close</button></div>
 </div>,document.body):null;
 const shown=picked.length&&!every?picked:[];
 return <><button ref={triggerRef} type="button" className="finder-mobile-sport" aria-expanded={open} aria-haspopup="dialog" aria-label={`Sports: ${label}`} onClick={()=>setOpen(value=>!value)}>
  {shown.length?<span className="finder-sport-stack">{shown.slice(0,3).map(key=><img key={key} src={logos[key]} alt="" decoding="async" onError={event=>{event.currentTarget.hidden=true;}}/>)}</span>:<Grid2X2 size={15} aria-hidden="true"/>}
  <span className="finder-sport-label">{label}</span><ChevronDown size={13} aria-hidden="true"/></button>{content}</>;
}

const HIT_WINDOWS=[['l5','L5'],['l10','L10'],['l15','L15'],['h2h','H2H'],['season','SZN']];
const emptyHit={windows:['l10'],min:0,max:100};
export function FinderHitRateFilter({value=emptyHit,onChange}){
 const [open,setOpen]=useState(false);const triggerRef=useRef(null);const menuRef=useRef(null);const rect=usePopover(open,triggerRef,menuRef);
 const current={...emptyHit,...value,windows:value.windows?.length?value.windows:[]};const active=current.windows.length>0||current.min>0||current.max<100;
 useEffect(()=>{if(!open)return undefined;const escape=event=>{if(event.key==='Escape')setOpen(false);};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[open]);
 useEffect(()=>{if(!open)return undefined;const outside=event=>{if(!triggerRef.current?.contains(event.target)&&!menuRef.current?.contains(event.target))setOpen(false);};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[open]);
 const toggleWindow=key=>onChange({...current,windows:current.windows.includes(key)?current.windows.filter(item=>item!==key):[...current.windows,key]});
 const content=open&&typeof document!=='undefined'?createPortal(<div className="finder-hit-popover" ref={menuRef} style={menuStyle(rect,300)} role="dialog" aria-label="Hit rate filters">
   <header><div><strong>Hit Rate Between</strong><small>Choose hit-rate columns and a range</small></div><button type="button" onClick={()=>onChange(emptyHit)}>Reset</button></header>
   <div className="finder-hit-windows">{HIT_WINDOWS.map(([key,label])=><button type="button" key={key} className={current.windows.includes(key)?'is-selected':''} onClick={()=>toggleWindow(key)}>{label}</button>)}</div>
   <div className="finder-hit-fields"><label>From<input type="number" min="0" max="100" inputMode="numeric" value={current.min} onChange={event=>onChange({...current,min:Math.max(0,Math.min(Number(event.target.value)||0,current.max))})}/></label><label>To<input type="number" min="0" max="100" inputMode="numeric" value={current.max} onChange={event=>onChange({...current,max:Math.min(100,Math.max(Number(event.target.value)||0,current.min))})}/></label></div>
   <div className="finder-hit-slider"><div className="finder-hit-track"/><input aria-label="Minimum hit rate" type="range" min="0" max="100" value={current.min} onChange={event=>onChange({...current,min:Math.min(Number(event.target.value),current.max)})}/><input aria-label="Maximum hit rate" type="range" min="0" max="100" value={current.max} onChange={event=>onChange({...current,max:Math.max(Number(event.target.value),current.min)})}/><div><span>0%</span><span>50%</span><span>100%</span></div></div>
   <div className="finder-hit-presets">{[55,60,70,80].map(min=><button type="button" key={min} onClick={()=>onChange({...current,min,max:100})}>{min}%+</button>)}</div>
   <p>Leave every column unticked to filter across all of this sport’s hit-rate windows.</p>
   <button type="button" className="finder-multi-close" onClick={()=>setOpen(false)}>Close</button>
 </div>,document.body):null;
 return <><div className={'finder-multi-select finder-hit-filter '+(active?'is-active':'')}><button ref={triggerRef} type="button" className="finder-multi-trigger" aria-expanded={open} aria-haspopup="dialog" onClick={()=>setOpen(open=>!open)}><ChartNoAxesColumnIncreasing size={15}/><span>Hit Rate</span>{active&&<b>1</b>}<ChevronDown size={14}/></button></div>{content}</>;
}
