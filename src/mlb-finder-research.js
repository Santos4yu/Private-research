// Small, bounded cache shared across Finder entries. Never cache errors.
export function createMLBContextClient({fetcher=(...args)=>fetch(...args),now=Date.now}={}) {
 const cache=new Map(), pending=new Map();
 return async function request(path,params) {
  const url=path+'?'+new URLSearchParams(Object.entries(params).filter(([,v])=>v!=null&&v!=='').sort(([a],[b])=>a.localeCompare(b)));
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

// Explicit display bands, not predictions or live league-average comparisons.
export function battingBand(key,value,ab,bvp=false){
 if(value==null||value===''||!Number.isFinite(Number(value)))return {tone:'neutral',label:'Unavailable'};
 if(ab==null||Number(ab)<(bvp?1:30))return {tone:'neutral',label:bvp?'No matchup sample':'Small sample'};
 const n=Number(value);
 const bands={avg:[.270,.240],ops:[.800,.700],k_pct:[20,25]};
 if(!bands[key])return {tone:'neutral',label:''};
 const [good,fair]=bands[key];
 const tone=key==='k_pct'?(n<=good?'good':n<=fair?'fair':'poor'):(n>=good?'good':n>=fair?'fair':'poor');
 return {tone,label:{good:'Strong',fair:'Moderate',poor:'Low'}[tone]+(bvp&&Number(ab)<30?' · Small BvP sample':'')};
}

export function mergeLineupSplits(summary,details){
 if(!summary)return details;
 const byId=new Map((details?.battingOrder||[]).map(p=>[String(p.id),p]));
 return {...summary,battingOrder:(summary.battingOrder||[]).map(p=>{
  const extra=byId.get(String(p.id));
  return extra?{...p,handSplitL:extra.handSplitL,handSplitR:extra.handSplitR,vsPitcher:extra.vsPitcher}:p;
 })};
}

export function supportingChoices(pitcher){return pitcher?
 [['inningsPitched','Innings pitched'],['earnedRuns','Earned runs allowed'],['hits','Hits allowed'],['numberOfPitches','Pitch count']]:
 [['plateAppearances','Plate appearances'],['hits','Hits'],['baseOnBalls','Walks']];}
export function supportingValue(game,key){
 const value=game.stat?.[key];
 if(key==='inningsPitched'){
  const outs=game.stat?.outs;
  if(outs!=null&&outs!==''&&Number.isFinite(Number(outs)))return Number(outs)/3;
  const match=String(value??'').match(/^(\d+)(?:\.([012]))?$/);
  return match?Number(match[1])+Number(match[2]||0)/3:null;
 }
 return value!=null&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
}
export function pitchTypeStats(row,code){
 if(code!=='all')return row?.byPitch?.[code]||{};
 const stats=Object.values(row?.byPitch||{}).filter(s=>Number(s.pa)>0);
 if(!stats.length)return {};
 const total=key=>stats.every(s=>s[key]!=null&&Number.isFinite(Number(s[key])))?stats.reduce((n,s)=>n+Number(s[key]),0):null;
 const pa=total('pa');
 const weighted=key=>pa&&stats.every(s=>s[key]!=null&&Number.isFinite(Number(s[key])))?stats.reduce((n,s)=>n+Number(s[key])*Number(s.pa),0)/pa:null;
 return {pa,pitches:total('pitches'),k_pct:weighted('k_pct'),woba:weighted('woba')};
}
