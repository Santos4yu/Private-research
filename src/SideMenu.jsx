import React,{useEffect,useState} from 'react';
import {moreTabs,topTabs} from './navTabs';
import {siteIsAdmin,siteTabAllowed} from './site-access';
import './side-menu.css';

// The side panel's menu on phones, laid out like pickfinder.app's sidebar:
// the desktop rail's destinations (navTabs.js topTabs, the same list
// VortexSidebar shows), then the tools that only ever lived in this panel.
// My Slip isn't a row -- the Pick Builder right below the menu is the slip.
// On desktop the rail is the menu, so side-menu.css hides this there.
const PRIMARY=topTabs.filter(item=>item.value&&item.value!=='saved');

export function SideMenu(){
 const [tab,setTab]=useState('research');
 // Which tabs a user may see is a site setting (site_controls
 // disabledTabs): a section switched off is left out for everyone but
 // admins. Admin itself is listed only for an admin session (unlocked from
 // the settings gear). Re-read whenever the policy changes or the panel opens.
 const [,setRevision]=useState(0);
 useEffect(()=>{
  const sync=({detail})=>setTab(detail?.tab||'research');
  const refresh=()=>setRevision(n=>n+1);
  window.addEventListener('vortex:dock-sync',sync);
  window.addEventListener('vortex:site-policy',refresh);
  window.addEventListener('vortex:more-sync',refresh);
  window.dispatchEvent(new Event('vortex:dock-ready'));
  return()=>{
   window.removeEventListener('vortex:dock-sync',sync);
   window.removeEventListener('vortex:site-policy',refresh);
   window.removeEventListener('vortex:more-sync',refresh);
  };
 },[]);
 // Going anywhere closes the panel (app.js wireSidePanel).
 const go=value=>window.dispatchEvent(new CustomEvent('vortex:switch-tab',{detail:{tab:value}}));
 const row=item=><button type="button" key={item.value} className="side-menu-link" aria-current={tab===item.value?'page':undefined} onClick={()=>go(item.value)}>
  <item.icon size={20} strokeWidth={1.8} aria-hidden="true"/><span>{item.title}</span>
 </button>;
 const primary=PRIMARY.filter(item=>siteTabAllowed(item.value));
 const more=moreTabs.filter(item=>item.value==='admin'?siteIsAdmin():siteTabAllowed(item.value));
 return <nav className="side-menu" aria-label="Main menu">
  {primary.length>0&&<div className="side-menu-group">{primary.map(row)}</div>}
  {more.length>0&&<><p className="side-menu-label">More</p><div className="side-menu-group">{more.map(row)}</div></>}
 </nav>;
}
