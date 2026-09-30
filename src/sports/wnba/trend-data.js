export const WNBA_STATS=[
 ['player_points','Points','PTS'],['player_rebounds','Rebounds','REB'],['player_assists','Assists','AST'],
 ['player_threes','3-Pointers Made','3PM'],['player_threes_attempts','3-PT Attempted','3PA'],['player_field_goals','FG Made','FGM'],
 ['player_frees_made','Free Throws Made','FTM'],['player_blocks','Blocks','BLK'],['player_steals','Steals','STL'],
 ['player_blocks_steals','Blocks + Steals','B+S'],['player_turnovers','Turnovers','TO'],
 ['player_points_rebounds','Points + Rebounds','PR'],['player_points_assists','Points + Assists','PA'],
 ['player_rebounds_assists','Rebounds + Assists','RA'],['player_points_rebounds_assists','Points + Rebounds + Assists','PRA'],
 ['player_fantasy_points','Fantasy Points','FS'],['player_field_goals_attempts','FG Attempted','FGA'],
 ['player_frees_attempts','Free Throws Attempted','FTA'],['player_twos','Two Pointers Made','2PM'],
 ['player_twos_attempts','Two Pointers Attempted','2PA'],['player_fouls','Personal Fouls','PF'],
 ['player_offensive_rebounds','Offensive Rebounds','OREB'],['player_defensive_rebounds','Defensive Rebounds','DREB'],['player_double_double','Double-Double','DD'],
 ['player_triple_double','Triple-Double','TD'],
].map(([key,label,code])=>({key,label,code}));

// ESPN stamps games in UTC, so a 7pm tip on the 22nd is the 23rd there.
// The chart shows the day the game was played where the viewer is.
const playedOn=date=>{const day=new Date(date);return Number.isNaN(day.getTime())?'':day.toLocaleDateString([],{month:'numeric',day:'numeric'});};
export function wnbaChart(logs,marketKey,opponent){
 // Every game by default; the chart's Season menu narrows it to
 // preseason, regular season or postseason.
 const all=(logs||[]).map(row=>({value:row.values?.[marketKey],season:String(row.season||''),fullDate:row.date||'',dateLabel:playedOn(row.date),opponent:row.opponent||'',opponentLabel:(row.isHome===false?'@':'')+(row.opponent||''),isHome:row.isHome,gameId:row.gameId,result:row.result,score:row.score,seasonKind:row.seasonKind||'regular'})).filter(row=>Number.isFinite(row.value));
 const chart={all};const h2h=opponent?all.filter(game=>game.opponent===opponent):[];
 if(h2h.length){chart.h2h=h2h;chart.meta={h2hLabel:`vs ${opponent}`};}return chart;
}
export function wnbaLines(rows,marketKey){
 const lines=new Map();for(const row of rows||[]){if(row.marketKey!==marketKey||!Number.isFinite(row.line))continue;let item=lines.get(row.line);if(!item){item={value:row.line,tier:'STANDARD',books:[],primaryBook:null};lines.set(row.line,item);}for(const app of row.apps||[]){if(!item.books.includes(app.key))item.books.push(app.key);if(app.key==='prizepicks'){item.primaryBook='prizepicks';const tier=String(app.category||row.modifier||'STANDARD').toUpperCase();if(['GOBLIN','DEMON'].includes(tier))item.tier=tier;}else if(!item.primaryBook)item.primaryBook=app.key;}}return [...lines.values()].sort((a,b)=>a.value-b.value);
}
export function wnbaOdds(rows,marketKey){return (rows||[]).filter(row=>row.marketKey===marketKey&&Number.isFinite(row.line)).map(row=>({line:row.line,books:Object.fromEntries((row.apps||[]).map(app=>[app.key,{over:app.over,under:app.under}]))}));}
