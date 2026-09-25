export const WNBA_STATS=[
 ['player_points','Points','PTS'],['player_rebounds','Rebounds','REB'],['player_assists','Assists','AST'],
 ['player_threes','3-Pointers Made','3PM'],['player_blocks','Blocks','BLK'],['player_steals','Steals','STL'],
 ['player_blocks_steals','Blocks + Steals','B+S'],['player_turnovers','Turnovers','TO'],
 ['player_points_rebounds','Points + Rebounds','PR'],['player_points_assists','Points + Assists','PA'],
 ['player_rebounds_assists','Rebounds + Assists','RA'],['player_points_rebounds_assists','Points + Rebounds + Assists','PRA'],
 ['player_fantasy_points','Fantasy Points','FS'],
].map(([key,label,code])=>({key,label,code}));

export function wnbaChart(logs,marketKey,opponent){
 const all=(logs||[]).map(row=>({value:row.values?.[marketKey],season:String(row.season||''),fullDate:row.date||'',opponent:row.opponent||'',isHome:row.isHome,gameId:row.gameId,result:row.result,score:row.score})).filter(row=>Number.isFinite(row.value));
 const chart={all};const h2h=opponent?all.filter(game=>game.opponent===opponent):[];
 if(h2h.length){chart.h2h=h2h;chart.meta={h2hLabel:`Career vs ${opponent}`};}return chart;
}
export function wnbaLines(rows,marketKey){
 const lines=new Map();for(const row of rows||[]){if(row.marketKey!==marketKey||!Number.isFinite(row.line))continue;let item=lines.get(row.line);if(!item){item={value:row.line,tier:'STANDARD',books:[],primaryBook:null};lines.set(row.line,item);}for(const app of row.apps||[]){if(!item.books.includes(app.key))item.books.push(app.key);if(app.key==='prizepicks')item.primaryBook='prizepicks';else if(!item.primaryBook)item.primaryBook=app.key;}}return [...lines.values()].sort((a,b)=>a.value-b.value);
}
export function wnbaOdds(rows,marketKey){return (rows||[]).filter(row=>row.marketKey===marketKey&&Number.isFinite(row.line)).map(row=>({line:row.line,books:Object.fromEntries((row.apps||[]).map(app=>[app.key,{over:app.over,under:app.under}]))}));}
