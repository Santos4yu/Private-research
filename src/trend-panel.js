// The trend panel (app.js window.vortexTrendPanel) is one element shared by
// every player page: a page moves it into its own host and feeds it its
// setup. useTrendPanel(host, config) does that for a page, and keeps it
// right when pages overlap:
//
//  * a page's cleanup only puts the panel away while that page still holds
//    it -- React can run an old page's cleanup after a new page has taken
//    the panel (an MLB page's runs later than the rest), and putting it
//    away then left the new page with its card on top and the chart
//    reopened on its own below, the page stuck until the app restarted;
//  * a page that's showing takes the panel back if something else has it
//    (a research report, another page), when its setup changes or when you
//    come back to its tab.
//
// Returns false when the panel couldn't be mounted at all.
import {useLayoutEffect,useRef,useState} from 'react';

const showing=node=>node.isConnected&&node.getClientRects().length>0;

export function useTrendPanel(host,config){
 const latest=useRef(config);
 latest.current=config;
 const [ready,setReady]=useState(true);
 useLayoutEffect(()=>{
  const panel=window.vortexTrendPanel,node=host.current;
  if(!panel||!node){setReady(false);return undefined;}
  setReady(Boolean(panel.mount(node,latest.current)));
  // After a tab change the page shows a frame later.
  let frame=0;
  const reclaim=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(showing(node)&&!panel.holds(node))panel.mount(node,latest.current);});};
  window.addEventListener('vortex:dock-sync',reclaim);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('vortex:dock-sync',reclaim);panel.unmount(node);};
 },[]);
 useLayoutEffect(()=>{
  const panel=window.vortexTrendPanel,node=host.current;
  if(!panel||!node)return;
  if(panel.holds(node))panel.update(config);
  else if(showing(node))panel.mount(node,config);
 },[config]);
 return ready;
}
