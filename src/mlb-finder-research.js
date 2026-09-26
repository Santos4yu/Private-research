// Small, bounded cache shared across Finder entries. Never cache errors.
export function createMLBContextClient({fetcher=(...args)=>fetch(...args),now=Date.now}={}) {
 const cache=new Map(), pending=new Map();
 return async function request(path,params) {
  const url=path+'?'+new URLSearchParams(Object.entries(params).filter(([,v])=>v!=null&&v!==''));
  const saved=cache.get(url);
  if(saved&&now()-saved.at<180000)return saved.data;
  if(pending.has(url))return pending.get(url);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),55000);
  const task=(async()=>{
   const response=await fetcher(url,{credentials:'same-origin',signal:controller.signal});
   const data=await response.json();
   if(!response.ok||data.error)throw new Error(data.error||'MLB research is unavailable.');
   cache.delete(url);cache.set(url,{at:now(),data});
   while(cache.size>32)cache.delete(cache.keys().next().value);
   return data;
  })().finally(()=>{clearTimeout(timer);pending.delete(url);});
  pending.set(url,task);return task;
 };
}

export function researchParams(row){return {player:row.player,playerId:row.playerId,teamId:row.teamId,stat:row.market,line:row.line,side:row.direction==='UNDER'?'under':'over'};}
export function statText(value,digits){if(value==null||value===''||!Number.isFinite(Number(value)))return '—';return digits==null?String(value):Number(value).toFixed(digits);}
export function lineupState(data){return data?.lineupConfirmed?'Confirmed batting order':data?.lineupProjected?'Projected batting order':'Active roster · order unconfirmed';}
