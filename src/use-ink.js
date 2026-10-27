// A sliding underline for a row of tabs (the Props tab's leagues and stats,
// the phone dock's pill): where the picked tab sits in its row, so one mark
// can glide from tab to tab instead of jumping. Kept right as the row
// resizes or fonts load. `picked` is any value that changes with the pick.
import {useLayoutEffect,useState} from 'react';

export function useInk(ref,picked,selector='[aria-pressed=true]'){
 const [ink,setInk]=useState(null);
 useLayoutEffect(()=>{
  const row=ref.current;
  if(!row)return undefined;
  let live=true;
  const place=()=>{if(!live)return;const on=row.querySelector(selector);setInk(on?{left:on.offsetLeft,width:on.offsetWidth}:null);};
  place();
  const watch=typeof ResizeObserver==='function'?new ResizeObserver(place):null;
  watch?.observe(row);
  document.fonts?.ready?.then(place).catch(()=>{});
  return()=>{live=false;watch?.disconnect();};
 },[ref,picked,selector]);
 return ink;
}

/** The underline itself, placed by useInk. */
export const inkStyle=ink=>ink?{transform:`translateX(${ink.left}px)`,width:ink.width}:{opacity:0};
