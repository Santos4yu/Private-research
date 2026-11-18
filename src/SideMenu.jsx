import React,{useEffect,useState} from 'react';
import {adminTabs,moreTabs,topTabs} from './navTabs';
import {siteIsAdmin,siteTabAllowed} from './site-access';
import './side-menu.css';

// The side panel's menu on phones, laid out as a sidebar:
// the computer top bar's destinations (navTabs.js topTabs, the same list
// TopBar shows), then the tools that only ever lived in this panel.
// My Slip isn't a row -- the Pick Builder right below the menu is the slip.
// On desktop the rail is the menu, so side-menu.css hides this there.
const PRIMARY=topTabs.filter(item=>item.value&&item.value!=='saved');
// Nov 18, the redesign: the sections as tiles in groups (the computer's
// top bar "More" menu uses the same groups, TopBar.jsx).
const SHORT={bot:'Assistant',builder:'Parlay Builder',export:'To PrizePicks',predictor:'Game Predictor',slip:'Slip Analyzer'};
const GROUPS=[['Discover',['finder','bot','sheets','moves','research','predictor','v2']],['Build',['builder','slip','export','bets']],['More',['promos','slate']]];

export function SideMenu(){
 const [tab,setTab]=useState('finder');
 // Which tabs a user may see is a site setting (site_controls
 // disabledTabs): a section switched off is left out for everyone but
 // admins. The admin section (navTabs.js adminTabs) is listed only for an
 // admin session (unlocked from the settings gear). Re-read whenever the
 // policy changes or the panel opens.
 const [,setRevision]=useState(0);
 useEffect(()=>{
  const sync=({detail})=>setTab(detail?.tab||'finder');
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
 const tile=item=><button type="button" key={item.value} className="side-menu-link" aria-current={tab===item.value?'page':undefined} onClick={()=>go(item.value)}>
  <item.icon size={20} strokeWidth={1.8} aria-hidden="true"/><span>{SHORT[item.value]||item.title}</span>
 </button>;
 const primary=PRIMARY.filter(item=>siteTabAllowed(item.value));
 const grouped=GROUPS.map(([label,keys])=>[label,keys.map(key=>primary.find(item=>item.value===key)).filter(Boolean)]);
 const placed=new Set(GROUPS.flatMap(([,keys])=>keys));
 const rest=primary.filter(item=>!placed.has(item.value));
 const more=[...rest,...moreTabs.filter(item=>siteTabAllowed(item.value))];
 if(more.length)grouped[2]=['More',[...grouped[2][1],...more]];
 // The admin-only sections: for the admin, and members with the Admin badge (canUseTab).
 const admin=adminTabs.filter(item=>siteIsAdmin()||siteTabAllowed(item.value));
 if(admin.length)grouped.push(['Admin',admin]);
 return <nav className="side-menu" aria-label="Main menu">
  {grouped.filter(([,items])=>items.length).map(([label,items])=><div className="side-menu-section" key={label}>
   <p className="side-menu-label">{label}</p><div className="side-menu-group">{items.map(tile)}</div>
  </div>)}
 </nav>;
}
