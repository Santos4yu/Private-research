export const CS2_STATS=[...[1,2,3].flatMap(n=>[['kills','Kills'],['headshots','Headshots']].map(([suffix,label])=>({key:`map${n}${suffix}`,label:`MAP ${n} ${label}`,code:`M${n}${suffix==='kills'?'K':'HS'}`}))),
 ...['12','123'].flatMap(scope=>[['kills','Kills'],['headshots','Headshots']].map(([suffix,label])=>({key:`maps${scope}${suffix}`,label:`MAPS 1-${scope.at(-1)} ${label}`,code:`M1-${scope.at(-1)}${suffix==='kills'?'K':'HS'}`})))];

export function cs2Sample(games,key,limit=Infinity){
 const kills=key.replace(/headshots$/,'kills');
 // Headshots and kills share the same actually played scope. Missing HS is
 // still a played match, not a zero and not a reason to hide the log row.
 const played=games.filter(g=>Number.isFinite(g.values?.[kills])||Number.isFinite(g.values?.[key]))
  .sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 return Number.isFinite(limit)?played.slice(-limit):played;
}

export function cs2Coverage(games,key){
 const played=cs2Sample(games,key);
 const recorded=played.filter(g=>Number.isFinite(g.values?.[key])).length;
 return {played:played.length,recorded,missing:played.length-recorded};
}

export function cs2Selection(rows,key,row,games){
 const posted=rows.find(r=>r.marketKey===key&&r.modifier==='standard')||rows.find(r=>r.marketKey===key);
 if(posted)return posted;
 const stat=CS2_STATS.find(s=>s.key===key);
 if(!stat)return null;
 const values=cs2Sample(games,key,10).map(g=>g.values?.[key]).filter(Number.isFinite);
 return {...row,id:`research:${key}`,marketKey:key,market:stat.label,line:values.length?Math.round(values.slice(-10).reduce((n,v)=>n+v,0)/Math.min(10,values.length)*10)/10:0,apps:[],modifier:null};
}
export function shortDate(value){
 const date=new Date(value);
 return Number.isNaN(date.getTime())?'—':date.toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone:'UTC'});
}
export function researchData(games,key,line,opponent,startsAt){
 const cutoff=startsAt?Date.parse(startsAt):Infinity;
 const settled=games.filter(g=>Date.parse(g.date)<cutoff);
 const recent=[...settled].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,15);
 const maps=recent.flatMap(g=>(g.mapDetails||[]).map(m=>({...m,date:g.date,opponent:g.opponent,gameId:g.gameId})));
 const average=field=>{const rows=maps.filter(m=>Number.isFinite(m[field]));return rows.length?rows.reduce((n,m)=>n+m[field],0)/rows.length:null;};
 const totals=field=>maps.reduce((n,m)=>n+(Number.isFinite(m[field])?m[field]:0),0);
 const headshotMaps=maps.filter(m=>Number.isFinite(m.headshots)&&Number.isFinite(m.kills));
 const hsKills=headshotMaps.reduce((n,m)=>n+m.kills,0);
 return {recent,maps,average,kd:maps.some(m=>Number.isFinite(m.deaths))&&totals('deaths')>0?totals('kills')/totals('deaths'):null,
  hs:hsKills>0?headshotMaps.reduce((n,m)=>n+m.headshots,0)/hsKills*100:null,
  results:cs2Sample(settled,key,15).reverse(),
  h2h:recent.filter(g=>g.team&&g.opponent?.toLowerCase()===opponent?.toLowerCase()&&Number.isFinite(g.values?.[key])),line};
}
