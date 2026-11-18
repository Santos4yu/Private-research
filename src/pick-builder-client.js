import {useEffect,useState} from 'react';

// The saved-picks list lives in app.js (state.savedProps, kept in
// localStorage as "vortex_saved_prop_ids") and these are the events it
// answers. Every view of it -- the Prop Builder dropdown, My Slip, the Pick
// Builder side panel and the Finder's stars -- goes through the same ones,
// so there is one list and one PrizePicks export.
const send=(name,detail)=>window.dispatchEvent(new CustomEvent(name,{detail}));
export const pickBuilder={
 // Add a pick on a side, or move a saved one to it.
 set:(prop,side)=>send('vortex:prop-builder-set',{prop,side}),
 side:(id,side)=>send('vortex:prop-builder-side',{id,side}),
 remove:id=>send('vortex:prop-builder-remove',{id}),
 clear:()=>send('vortex:prop-builder-clear'),
 // PrizePicks in a new tab, or its link copied (app.js).
 export:()=>send('vortex:prop-builder-export'),
 copy:()=>send('vortex:prop-builder-copy'),
 // Current prices and start times for saved Finder picks.
 refresh:updates=>send('vortex:prop-builder-refresh',{updates}),
 // On desktop the Pick Builder opens inside the sidebar rail
 // (TopBar registers window.vortexRailBuilder); on phones, in the
 // side panel (#side-panel) under the menu.
 open:()=>{
  const rail=typeof window!=='undefined'?window.vortexRailBuilder:null;
  if(rail?.available())rail.open();
  else send('vortex:open-more',{section:'pick-builder'});
 },
};

export const EMPTY_PICKS={legs:[],status:'Add at least 2 props to export.',canExport:false,busy:false,link:''};

export function usePickBuilder(){
 const [state,setState]=useState(EMPTY_PICKS);
 useEffect(()=>{
  const sync=({detail})=>setState(current=>({...current,...(detail||{})}));
  window.addEventListener('vortex:prop-builder-sync',sync);
  window.dispatchEvent(new Event('vortex:prop-builder-request-sync'));
  return()=>window.removeEventListener('vortex:prop-builder-sync',sync);
 },[]);
 return state;
}
