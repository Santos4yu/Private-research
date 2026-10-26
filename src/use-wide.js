// Whether the screen is a computer's (1100px and wider): the Props pages lay
// out as a dashboard there (NbaMatchupPage.jsx, MatchupList.jsx), and as one
// column with tabs on a phone or tablet.
import {useEffect,useState} from 'react';

export const WIDE='(min-width: 1100px)';
const matches=query=>typeof matchMedia==='function'&&matchMedia(query).matches;

export function useWide(query=WIDE){
 const [wide,setWide]=useState(()=>matches(query));
 useEffect(()=>{
  if(typeof matchMedia!=='function')return undefined;
  const list=matchMedia(query),change=()=>setWide(list.matches);
  change();list.addEventListener?.('change',change);
  return()=>list.removeEventListener?.('change',change);
 },[query]);
 return wide;
}
