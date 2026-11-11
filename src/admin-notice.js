// Errors are for admins. When part of a page can't load, a member sees what
// did load, or a calm empty state ("Nothing here for this game yet"), never
// "could not load" or "temporarily unavailable" and a Retry button; an
// admin sees what went wrong and can retry. useIsAdmin() follows the site
// policy as it arrives or changes (site-access.js).
import {useEffect,useState} from 'react';
import {siteFullAccess,siteIsAdmin} from './site-access.js';

export function useIsAdmin(){
 const [admin,setAdmin]=useState(()=>siteIsAdmin());
 useEffect(()=>{
  const update=()=>setAdmin(siteIsAdmin());
  update();
  window.addEventListener('vortex:site-policy',update);
  return()=>window.removeEventListener('vortex:site-policy',update);
 },[]);
 return admin;
}

/** The admin or an Admin-badge member (site-access.js siteFullAccess), for
 * the sections and records only they see -- never for notes or errors. */
export function useFullAccess(){
 const [full,setFull]=useState(()=>siteFullAccess());
 useEffect(()=>{
  const update=()=>setFull(siteFullAccess());
  update();
  window.addEventListener('vortex:site-policy',update);
  return()=>window.removeEventListener('vortex:site-policy',update);
 },[]);
 return full;
}

/** What a member sees where a panel couldn't load. */
export const QUIET='Nothing to show here for this game yet.';
