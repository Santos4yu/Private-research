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
  results:recent.filter(g=>Number.isFinite(g.values?.[key])),
  h2h:recent.filter(g=>g.team&&g.opponent?.toLowerCase()===opponent?.toLowerCase()&&Number.isFinite(g.values?.[key])),line};
}
