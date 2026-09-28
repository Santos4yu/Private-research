// Soccer stats shared by the board's hit rates, the player page and its
// matchup panel. Every number comes from /api/board?view=soccer
// (soccer_research.py: ESPN's match summaries); nothing here estimates.
// No React here, so the board's data module can use it too.

// The stats a soccer line can be on, in the chart's tab order. `get` reads a
// player's match line (soccer_research.py PLAYER_STATS keys).
export const SOCCER_STATS=[
 ['goals','Goals','GOALS'],['ga','Goal + Assist','G+A'],['shots','Shots','SHOTS'],['sot','Shots On Target','SOT'],
 ['passAtt','Passes Attempted','PASS ATT'],['passes','Passes Completed','PASSES'],['touch','Touches','TOUCH'],['ast','Assists','AST'],
 ['cross','Crosses','CROSS'],['sa','Shots Assisted','SA'],['clear','Clearances','CLEAR'],['tackles','Tackles','TACK'],
 ['fd','Fouls Drawn','FD'],['saves','Goalie Saves','SAVES'],['gc','Goals Allowed','GA'],['sotf','Shots Faced','SOTF'],
 ['drib','Attempted Dribbles','DRIB'],['fouls','Fouls','FOUL'],['off','Offsides','OFF'],['yc','Yellow Cards','YC'],
].map(([key,label,code])=>({key,label,code}));
const STAT_BY_KEY=Object.fromEntries(SOCCER_STATS.map(stat=>[stat.key,stat]));
// PrizePicks' stat names (soccer_board.py marketKey: lowercase, letters and
// digits only) -> the stat above.
const MARKETS={goals:'goals',goal:'goals',goalassist:'ga',goalsassists:'ga',goalsassist:'ga',goalplusassist:'ga',goalsplusassists:'ga',
 shots:'shots',totalshots:'shots',shotsontarget:'sot',passesattempted:'passAtt',passes:'passAtt',passescompleted:'passes',
 touches:'touch',assists:'ast',crosses:'cross',shotsassisted:'sa',keypasses:'sa',clearances:'clear',tackles:'tackles',
 foulsdrawn:'fd',foulssuffered:'fd',goaliesaves:'saves',saves:'saves',goalsallowed:'gc',goalsconceded:'gc',
 shotsontargetfaced:'sotf',shotsfaced:'sotf',attempteddribbles:'drib',dribblesattempted:'drib',dribbles:'drib',
 fouls:'fouls',foulscommitted:'fouls',offsides:'off',yellowcards:'yc',cards:'yc'};
export const statKeyOf=marketKey=>MARKETS[String(marketKey||'').toLowerCase().replace(/[^a-z0-9]/g,'')]||null;
export const statOf=key=>STAT_BY_KEY[key]||null;

export const finite=value=>typeof value==='number'&&Number.isFinite(value);
export function fmt(value,digits=1){if(!finite(value))return '—';return Number(value.toFixed(digits)).toLocaleString();}
export function average(values){const valid=values.filter(finite);return valid.length?valid.reduce((sum,value)=>sum+value,0)/valid.length:null;}
export function shortDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleDateString([],{month:'numeric',day:'numeric'});}
export function longDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleDateString([],{month:'numeric',day:'numeric',year:'2-digit'});}
export const price=value=>finite(value)?(value>0?'+':'')+Math.round(value):'—';

// A match line's value for a stat. G+A is the two added; everything else
// is ESPN's own number, missing when ESPN doesn't publish it.
export function valueOf(game,key){
 const stats=game?.s||{};
 if(key==='min')return finite(game?.min)?game.min:null;
 if(key==='ga')return finite(stats.goals)&&finite(stats.ast)?stats.goals+stats.ast:null;
 return finite(stats[key])?stats[key]:null;
}
// Which stats ESPN actually has for this player (so the page can say so).
export const hasStat=(games,key)=>(games||[]).some(game=>finite(valueOf(game,key)));

// A season runs from July, so Sept 2026 and March 2027 are both "2026".
export function seasonOf(date){const day=new Date(date);if(Number.isNaN(day.getTime()))return '';return String(day.getUTCMonth()>=6?day.getUTCFullYear():day.getUTCFullYear()-1);}

const nameKey=value=>String(value||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z ]/g,' ').split(/\s+/).filter(Boolean);
// Finds the player among one match's lines: the full name, else the same
// last name and first initial, else a last name only one player has.
export function findPlayer(players,name){
 const wanted=nameKey(name);if(!wanted.length)return null;
 const full=wanted.join(' ');
 const exact=players.find(player=>nameKey(player.name).join(' ')===full);if(exact)return exact;
 const last=wanted.at(-1),first=wanted[0][0];
 const initial=players.filter(player=>{const words=nameKey(player.name);return words.at(-1)===last&&words[0]?.[0]===first;});
 if(initial.length===1)return initial[0];
 // One-name players (Rodri, Vinicius) and surname-only listings.
 const single=players.filter(player=>{const words=nameKey(player.name);return words.includes(last)||(wanted.length===1&&words.includes(wanted[0]));});
 return single.length===1?single[0]:null;
}

// The player's matches from his team's log (soccer_research.team_log),
// oldest first: only matches he played in.
export function playerGames(log,name){
 const rows=[];
 for(const game of log?.games||[]){
  const line=findPlayer(game.players||[],name);
  if(!line)continue;
  rows.push({gameId:game.id,date:game.date,season:seasonOf(game.date),league:game.league,leagueName:game.leagueName,isHome:game.isHome,
   opponent:game.opponent?.abbr||'',opponentName:game.opponent?.name||'',opponentLogo:game.opponent?.logo||null,opponentId:game.opponent?.id||'',
   result:game.result,score:game.score,min:line.min,starter:line.starter,pos:line.pos,playerId:line.id,s:line.s||{},
   teamStats:game.teamStats||{},oppStats:game.oppStats||{},goals:game.goals,against:game.against});
 }
 return rows.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}

const playedOn=date=>{const day=new Date(date);return Number.isNaN(day.getTime())?'':day.toLocaleDateString([],{month:'numeric',day:'numeric'});};
export function soccerChart(games,key,opponent){
 const all=(games||[]).map(game=>({value:valueOf(game,key),season:game.season,fullDate:game.date||'',dateLabel:playedOn(game.date),
  opponent:game.opponent,opponentLabel:(game.isHome===false?'@':'')+game.opponent,isHome:game.isHome,gameId:game.gameId,result:game.result,score:game.score}))
  .filter(game=>finite(game.value));
 const chart={all};const h2h=opponent?all.filter(game=>game.opponent===opponent):[];
 if(h2h.length){chart.h2h=h2h;chart.meta={h2hLabel:`vs ${opponent}`};}
 return chart;
}

// Team Comparison: per-match averages over a team's last `n` matches.
// `better` says which way is good for that team.
const pct=(made,total)=>finite(made)&&finite(total)&&total?made/total*100:null;
export const TEAM_GROUPS=[
 ['attack','Attack',[['Goals',game=>game.goals],['Shots',game=>game.teamStats.totalShots],['Shots on Target',game=>game.teamStats.shotsOnTarget],
  ['Corners',game=>game.teamStats.wonCorners],['Crosses',game=>game.teamStats.totalCrosses]]],
 ['poss','Poss',[['Possession',game=>game.teamStats.possessionPct,'%'],['Passes',game=>game.teamStats.totalPasses],
  ['Pass Accuracy',game=>pct(game.teamStats.accuratePasses,game.teamStats.totalPasses),'%'],['Long Balls',game=>game.teamStats.totalLongBalls]]],
 ['defense','Defense',[['Tackles',game=>game.teamStats.totalTackles],['Clearances',game=>game.teamStats.totalClearance],
  ['Interceptions',game=>game.teamStats.interceptions],['Saves',game=>game.teamStats.saves],['Goals Allowed',game=>game.against,'',true]]],
 ['cards','Cards',[['Fouls Won',game=>game.oppStats.foulsCommitted],['Fouls',game=>game.teamStats.foulsCommitted,'',true],
  ['Offsides',game=>game.teamStats.offsides,'',true],['Yellow Cards',game=>game.teamStats.yellowCards,'',true],['Red Cards',game=>game.teamStats.redCards,'',true]]],
];
export function teamAverages(log,n,group){
 const games=(log?.games||[]).slice(-n);
 const [, ,rows]=TEAM_GROUPS.find(([key])=>key===group)||TEAM_GROUPS[0];
 return {games:games.length,rows:rows.map(([label,get,unit='',lowerIsBetter=false])=>({label,unit,lowerIsBetter,value:average(games.map(get))}))};
}
