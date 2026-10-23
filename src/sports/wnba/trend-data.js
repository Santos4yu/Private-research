export const WNBA_STATS=[
 ['player_points','Points','PTS'],['player_rebounds','Rebounds','REB'],['player_assists','Assists','AST'],
 ['player_threes','3-Pointers Made','3PM'],['player_threes_attempts','3-PT Attempted','3PA'],['player_field_goals','FG Made','FGM'],
 ['player_frees_made','Free Throws Made','FTM'],['player_blocks','Blocks','BLK'],['player_steals','Steals','STL'],
 ['player_blocks_steals','Blocks + Steals','B+S'],['player_dunks','Dunks','DNK'],['player_turnovers','Turnovers','TO'],
 ['player_points_rebounds','Points + Rebounds','PR'],['player_points_assists','Points + Assists','PA'],
 ['player_rebounds_assists','Rebounds + Assists','RA'],['player_points_rebounds_assists','Points + Rebounds + Assists','PRA'],
 ['player_fantasy_points','Fantasy Points','FS'],['player_field_goals_attempts','FG Attempted','FGA'],
 ['player_frees_attempts','Free Throws Attempted','FTA'],['player_twos','Two Pointers Made','2PM'],
 ['player_twos_attempts','Two Pointers Attempted','2PA'],['player_fouls','Personal Fouls','PF'],
 ['player_offensive_rebounds','Offensive Rebounds','OREB'],['player_defensive_rebounds','Defensive Rebounds','DREB'],['player_double_double','Double-Double','DD'],
 ['player_triple_double','Triple-Double','TD'],
 // First quarter and first half (api/wnba.py, from the play-by-play).
 ...[['1q','1Q'],['1h','1H']].flatMap(([suffix,name])=>[['points','Points','PTS'],['rebounds','Rebounds','REB'],['assists','Assists','AST'],
  ['threes','3-PT Made','3PM'],['points_rebounds','Pts+Rebs','PR'],['points_assists','Pts+Asts','PA'],['rebounds_assists','Rebs+Asts','RA'],
  ['points_rebounds_assists','Pts+Rebs+Asts','PRA']].map(([key,label,code])=>[`player_${key}_${suffix}`,`${name} ${label}`,`${name} ${code}`])),
].map(([key,label,code])=>({key,label,code}));

// Stats his page offers on nights PrizePicks posts no line in them, from his
// game logs alone: the NBA's dunks (counted from the play-by-play, api/wnba.py
// _with_saved_dunks), which PrizePicks posts only some nights. The chart
// starts at the half nearest his average over his last 10 counted games and
// the chip shows no line; the banner says none is posted.
const RESEARCH_ONLY={nba:[['player_dunks','Dunks']]};
export function researchRows(row,playerRows,logs){
 const out=[];
 for(const [marketKey,market] of RESEARCH_ONLY[row?.sport]||[]){
  if((playerRows||[]).some(item=>item.marketKey===marketKey))continue;
  const values=(logs||[]).filter(log=>log.seasonKind!=='preseason').map(log=>log.values?.[marketKey]).filter(Number.isFinite);
  if(!values.length)continue;
  const recent=values.slice(-10),average=recent.reduce((sum,value)=>sum+value,0)/recent.length;
  out.push({...row,id:`${row.id}|research|${marketKey}`,marketKey,market,line:Math.max(0.5,Math.round(average-0.5)+0.5),
   direction:'OVER',modifier:'standard',apps:[],windows:null,researchOnly:true});
 }
 return out;
}

// ESPN stamps games in UTC, so a 7pm tip on the 22nd is the 23rd there.
// The chart shows the day the game was played where the viewer is.
const playedOn=date=>{const day=new Date(date);return Number.isNaN(day.getTime())?'':day.toLocaleDateString([],{month:'numeric',day:'numeric'});};
// The box-score fields a market is made of: the game card rings them.
const FOCUS={player_points:['pts'],player_rebounds:['reb'],player_assists:['ast'],player_threes:['tp'],player_threes_attempts:['tp'],
 player_field_goals:['fg'],player_field_goals_attempts:['fg'],player_frees_made:['ft'],player_frees_attempts:['ft'],player_blocks:['blk'],
 player_steals:['stl'],player_blocks_steals:['blk','stl'],player_turnovers:['to'],player_points_rebounds:['pts','reb'],
 player_points_assists:['pts','ast'],player_rebounds_assists:['reb','ast'],player_points_rebounds_assists:['pts','reb','ast'],
 player_fouls:['pf'],player_dunks:['fg'],player_offensive_rebounds:['reb'],player_defensive_rebounds:['reb'],player_twos:['fg'],player_twos_attempts:['fg'],
 player_fantasy_points:['pts','reb','ast','stl','blk','to'],player_double_double:['pts','reb','ast'],player_triple_double:['pts','reb','ast']};
// One game's card on the chart (app.js gameCard): his box line, the
// result, and from the stored season (api/wnba.py game-notes) his usage
// rate, whether he started and who sat out.
// A first-quarter or first-half line's card adds his line for that part of
// the game under the box score.
const PERIOD=/_(1[qh])$/;
function periodLine(values,marketKey){
 const suffix=PERIOD.exec(String(marketKey||''))?.[1];
 if(!suffix)return null;
 const part=key=>values[`player_${key}_${suffix}`];
 return {label:suffix.toUpperCase(),pts:part('points'),reb:part('rebounds'),ast:part('assists'),tpm:part('threes')};
}
export function gameDetails(row,marketKey,note){
 const box=row.box||{},values=row.values||{};
 return {kind:'hoops',focus:FOCUS[marketKey]||[],period:periodLine(values,marketKey),result:row.result||null,score:row.score||'',logo:row.opponentLogo||null,
  min:box.min??row.minutes??null,usage:note?.usage??null,started:note?typeof note.started==='boolean'?note.started:null:null,
  pts:box.pts,reb:box.reb,oreb:values.player_offensive_rebounds,dreb:values.player_defensive_rebounds,ast:box.ast,to:box.to,
  stl:box.stl,blk:box.blk,pf:box.pf,fgm:box.fgm,fga:box.fga,tpm:box.tpm,tpa:box.tpa,ftm:box.ftm,fta:box.fta,out:note?.out||[]};
}
export function wnbaChart(logs,marketKey,opponent,notes={}){
 // Every game by default; the chart's Season menu narrows it to
 // preseason, regular season or postseason.
 const all=(logs||[]).map(row=>({value:row.values?.[marketKey],season:String(row.season||''),fullDate:row.date||'',dateLabel:playedOn(row.date),opponent:row.opponent||'',opponentLabel:(row.isHome===false?'@':'')+(row.opponent||''),isHome:row.isHome,gameId:row.gameId,result:row.result,score:row.score,seasonKind:row.seasonKind||'regular',
  details:gameDetails(row,marketKey,notes?.[String(row.gameId)])})).filter(row=>Number.isFinite(row.value));
 const chart={all};const h2h=opponent?all.filter(game=>game.opponent===opponent):[];
 if(h2h.length){chart.h2h=h2h;chart.meta={h2hLabel:`vs ${opponent}`};}return chart;
}
export function wnbaLines(rows,marketKey){
 const lines=new Map();for(const row of rows||[]){if(row.marketKey!==marketKey||!Number.isFinite(row.line))continue;let item=lines.get(row.line);if(!item){item={value:row.line,tier:'STANDARD',books:[],primaryBook:null};lines.set(row.line,item);}for(const app of row.apps||[]){if(!item.books.includes(app.key))item.books.push(app.key);if(app.key==='prizepicks'){item.primaryBook='prizepicks';const tier=String(app.category||row.modifier||'STANDARD').toUpperCase();if(['GOBLIN','DEMON'].includes(tier))item.tier=tier;}else if(!item.primaryBook)item.primaryBook=app.key;}}return [...lines.values()].sort((a,b)=>a.value-b.value);
}
export function wnbaOdds(rows,marketKey){return (rows||[]).filter(row=>row.marketKey===marketKey&&Number.isFinite(row.line)).map(row=>({line:row.line,books:Object.fromEntries((row.apps||[]).map(app=>[app.key,{over:app.over,under:app.under}]))}));}
