// A number that counts up to its value when it first shows, and glides to
// a new one when it changes (the Props list's matchup scores, the player
// page's score and averages). Text that isn't a number shows as it is; with
// reduced motion asked for, the number just shows.
import {useEffect,useRef,useState} from 'react';

const still=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease=t=>1-(1-t)**3;

export function CountUp({value,digits=0,ms=700,delay=0}){
 const target=Number(value);
 const counts=value!==null&&value!==''&&Number.isFinite(target);
 const [shown,setShown]=useState(()=>counts&&!still()?0:target);
 const from=useRef(counts&&!still()?0:target);
 useEffect(()=>{
  if(!counts)return undefined;
  if(still()){from.current=target;setShown(target);return undefined;}
  const start=from.current;let frame=0,began=0;
  const wait=setTimeout(()=>{
   const step=now=>{
    if(!began)began=now;
    const t=Math.min(1,(now-began)/ms),next=start+(target-start)*ease(t);
    from.current=next;setShown(next);
    if(t<1)frame=requestAnimationFrame(step);
   };
   frame=requestAnimationFrame(step);
  },delay);
  return()=>{clearTimeout(wait);cancelAnimationFrame(frame);};
 },[target,counts,ms,delay]);
 if(!counts)return value??null;
 return (Math.round(shown*10**digits)/10**digits).toFixed(digits);
}
