// Press and hold a pick or parlay to share it (Nov 13, the owner: "without
// adding extra buttons make it so when I hold down on it it pops up a
// download or copy button"). `useHold` turns a long press (or a right-click
// on a computer) into `onHold`; `HoldSheet` shows the picture
// (game-share.js, made as the sheet opens) with Copy and Download under it.
// The picture itself can also be long-pressed on a phone for its own menu.
import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,Copy,Download} from 'lucide-react';
import {copyPicture,pictureOf,savePicture} from './game-share.js';

const HOLD_MS=450;
// A finger that moves this far is scrolling, not holding.
const SLOP=10;

/** Handlers for an element: hold it HOLD_MS (or right-click it) to call onHold. */
export function useHold(onHold){
 const press=useRef(null);
 const stop=()=>{if(press.current){clearTimeout(press.current.timer);press.current=null;}};
 useEffect(()=>stop,[]);
 return {
  onPointerDown:event=>{
   if(event.button>0||event.target.closest('button,a,input,select'))return;
   stop();
   const x=event.clientX,y=event.clientY;
   press.current={x,y,timer:setTimeout(()=>{press.current=null;try{navigator.vibrate?.(12);}catch{/* not on every phone */}onHold();},HOLD_MS)};
  },
  onPointerMove:event=>{const held=press.current;if(held&&Math.hypot(event.clientX-held.x,event.clientY-held.y)>SLOP)stop();},
  onPointerUp:stop,onPointerLeave:stop,onPointerCancel:stop,
  // The phone's own long-press menu (and a computer's right-click) gives way to ours.
  onContextMenu:event=>{if(event.target.closest('button,a,input,select'))return;event.preventDefault();stop();onHold();},
 };
}

/** The picture of `legs` with Copy and Download; closes on a tap outside or Escape. */
export function HoldSheet({legs,onClose}){
 const [picture,setPicture]=useState(null);
 const [done,setDone]=useState(null);
 useEffect(()=>{
  let live=true,made=null;
  pictureOf({legs}).then(found=>{made=found;if(live)setPicture(found);else if(found)URL.revokeObjectURL(found.url);}).catch(()=>{if(live)setPicture(false);});
  return()=>{live=false;if(made)URL.revokeObjectURL(made.url);};
 },[legs]);
 useEffect(()=>{const key=event=>{if(event.key==='Escape')onClose();};addEventListener('keydown',key);return()=>removeEventListener('keydown',key);},[onClose]);
 const copy=async()=>{const ok=await copyPicture(picture);setDone(ok?'copied':'copy-failed');if(ok)setTimeout(onClose,900);};
 const save=async()=>{const found=await savePicture(picture);if(found)setDone('saved');};
 const title=legs.length>1?`${legs.length}-pick parlay`:`${legs[0]?.team?.short||legs[0]?.team?.abbr||''} moneyline`;
 return createPortal(<div className="gp-hold" role="dialog" aria-modal="true" aria-label={`Share the ${title}`} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
  <div className="gp-hold-card">
   <div className="gp-hold-picture">{picture?<img src={picture.url} alt={`The ${title} as a picture`}/>
    :<span className="gp-hold-wait">{picture===false?'The picture couldn’t be made.':'Making the picture…'}</span>}</div>
   {done==='copy-failed'&&<p className="gp-hold-note">This browser won’t copy pictures. Press and hold the picture to copy it, or tap Download.</p>}
   <div className="gp-hold-actions">
    <button type="button" onClick={copy} disabled={!picture}>{done==='copied'?<Check size={18} aria-hidden="true"/>:<Copy size={18} aria-hidden="true"/>}{done==='copied'?'Copied':'Copy'}</button>
    <button type="button" onClick={save} disabled={!picture}>{done==='saved'?<Check size={18} aria-hidden="true"/>:<Download size={18} aria-hidden="true"/>}{done==='saved'?'Saved':'Download'}</button>
   </div>
  </div>
 </div>,document.body);
}
