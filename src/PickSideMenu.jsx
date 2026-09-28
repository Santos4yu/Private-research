import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowDown,ArrowUp,Trash2} from 'lucide-react';
import {finderSlipId,finderSlipProp} from './unified-finder-data';
import {pickBuilder} from './pick-builder-client';
import './pick-builder.css';

// What a Finder star opens: Over or Under for that line, straight into the
// site's one saved-picks list. On a saved pick the same menu switches its
// side or removes it. Portaled to <body> so the phone card feed and the
// desktop table's scroll box can't clip it.
export function PickSideMenu({row,anchor,side,onClose}){
 const ref=useRef(null);
 const [position,setPosition]=useState(null);
 const moreOnly=['goblin','demon'].includes(String(row.modifier||'').toLowerCase());
 useLayoutEffect(()=>{
  const place=()=>{
   const menu=ref.current;
   if(!menu||!anchor?.isConnected){onClose(false);return;}
   const a=anchor.getBoundingClientRect(),m=menu.getBoundingClientRect(),gap=8,edge=12;
   let top=a.bottom+gap;
   if(top+m.height>window.innerHeight-edge)top=Math.max(edge,a.top-gap-m.height);
   // Drops from the star, lined up with the photo it sits on.
   const left=Math.min(Math.max(edge,a.left-24),window.innerWidth-edge-m.width);
   setPosition({top,left});
  };
  place();
  window.addEventListener('resize',place);
  window.addEventListener('scroll',place,true);
  return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
 },[anchor,onClose]);
 // Focus lands on the saved side, or Over, once the menu is placed (it is
 // invisible, and so unfocusable, until then).
 const focused=useRef(false);
 useEffect(()=>{
  if(!position||focused.current)return;
  focused.current=true;
  const menu=ref.current;
  (menu?.querySelector('[aria-pressed=true]')||menu?.querySelector('button:not(:disabled)'))?.focus({preventScroll:true});
 },[position]);
 useEffect(()=>{
  const menu=ref.current;
  const outside=event=>{if(!menu?.contains(event.target)&&!anchor?.contains(event.target))onClose(false);};
  const keys=event=>{
   if(event.key==='Escape'){event.preventDefault();onClose(true);return;}
   if(event.key!=='Tab'||!menu)return;
   // Keep Tab inside the menu while it is open.
   const buttons=[...menu.querySelectorAll('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  };
  document.addEventListener('pointerdown',outside,true);
  document.addEventListener('keydown',keys);
  return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',keys);};
 },[anchor,onClose]);
 const choose=value=>{if(value!==side)pickBuilder.set(finderSlipProp(row),value);onClose(true);};
 const remove=()=>{pickBuilder.remove(finderSlipId(row));onClose(true);};
 const label=`${row.line} ${row.market}`;
 return createPortal(<div ref={ref} className="pick-side-menu" role="dialog" aria-label={`${row.player} ${label}: ${side?'change or remove this pick':'choose Over or Under'}`}
  style={position?{top:position.top,left:position.left}:{visibility:'hidden'}}>
  <header><strong>{row.player}</strong><span>{label}{side&&<> · <b data-side={side.toLowerCase()}>In picks: {side}</b></>}</span></header>
  <div className="pick-side-options">
   <button type="button" data-side="over" aria-pressed={side==='Over'} onClick={()=>choose('Over')}><ArrowUp size={16} aria-hidden="true"/>Over <b>{row.line}</b></button>
   <button type="button" data-side="under" aria-pressed={side==='Under'} disabled={moreOnly} onClick={()=>choose('Under')}><ArrowDown size={16} aria-hidden="true"/>Under <b>{row.line}</b></button>
  </div>
  {moreOnly&&<small className="pick-side-note">{row.modifier[0].toUpperCase()+row.modifier.slice(1)} lines are More only on PrizePicks.</small>}
  {side&&<button type="button" className="pick-side-remove" onClick={remove}><Trash2 size={15} aria-hidden="true"/>Remove from picks</button>}
 </div>,document.body);
}
