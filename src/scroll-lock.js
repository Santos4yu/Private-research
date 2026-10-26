// While a pop-up is open the page under it stays still (Oct 25, the owner:
// "I shouldn't be able to scroll the page underneath when this is open or
// when anything is open"). Counted, so two pop-ups at once unlock only when
// both close. The scrollbar's width is kept as padding so nothing jumps
// sideways on a computer; the pop-up's own scrolling doesn't run on into the
// page (overscroll-behavior on it).
import {useEffect} from 'react';

let locks=0,saved=null;

export function lockScroll(){
 if(typeof document==='undefined')return()=>{};
 if(locks++===0){
  const html=document.documentElement,body=document.body,bar=window.innerWidth-html.clientWidth;
  saved={html:html.style.overflow,body:body.style.overflow,pad:body.style.paddingRight};
  html.style.overflow='hidden';body.style.overflow='hidden';
  if(bar>0)body.style.paddingRight=`${bar}px`;
  html.dataset.scrollLocked='';
 }
 let done=false;
 return()=>{
  if(done)return;done=true;
  if(--locks===0&&saved){
   const html=document.documentElement,body=document.body;
   html.style.overflow=saved.html;body.style.overflow=saved.body;body.style.paddingRight=saved.pad;
   delete html.dataset.scrollLocked;saved=null;
  }
 };
}

/** Locks the page while `active`. */
export function useScrollLock(active=true){
 useEffect(()=>active?lockScroll():undefined,[active]);
}
