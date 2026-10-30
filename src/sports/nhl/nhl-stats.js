// The Finder's NHL numbers: a team's recent games (nhl_research.team_log)
// turned into one player's game log, the trend chart's games, and the
// stat families the player page shows. Pure -- no requests here.

const finite=value=>typeof value==='number'&&Number.isFinite(value);

export const nhlLogo=team=>team?`https://assets.nhle.com/logos/nhl/svg/${team}_dark.svg`:'';
// The NHL season a day falls in, by its first year (2026 for 2026-27).
export const nhlSeason=(now=new Date())=>now.getMonth()>=7?now.getFullYear():now.getFullYear()-1;
export const isGoalie=position=>String(position||'').toUpperCase()==='G';

// Every number a game log line carries (nhl_research's player lines).
export const STATS={
 goals:{label:'Goals',short:'G'},assists:{label:'Assists',short:'A'},points:{label:'Points',short:'PTS'},
 sog:{label:'Shots on Goal',short:'SOG'},attempts:{label:'Shot Attempts',short:'SAT'},hits:{label:'Hits',short:'HIT'},
 blocked:{label:'Blocked Shots',short:'BLK'},hits_blocks:{label:'Hits + Blocks',short:'H+B'},toi:{label:'Time on Ice',short:'TOI'},
 fow:{label:'Faceoffs Won',short:'FOW'},faceoffs:{label:'Faceoffs Taken',short:'FO'},ppp:{label:'Power Play Points',short:'PPP'},
 shp:{label:'Shorthanded Points',short:'SHP'},pim:{label:'Penalty Minutes',short:'PIM'},plus_minus:{label:'Plus/Minus',short:'+/-'},
 fantasy:{label:'Fantasy Score',short:'FS'},
 saves:{label:'Saves',short:'SV'},ga:{label:'Goals Allowed',short:'GA'},shots_against:{label:'Shots Faced',short:'SA'},
 win:{label:'Wins',short:'W'},shutout:{label:'Shutouts',short:'SO'},
};
// A stat's number from a game (null when the game has none).
export const statValue=(game,key)=>{const value=game?.values?.[key];return finite(value)?value:null;};

const FAMILY={
 F:{support:['toi','sog','points','hits','blocked','fow'],log:['goals','assists','points','sog','attempts','hits','blocked','fow','ppp','pim','toi','fantasy']},
 D:{support:['toi','sog','points','hits','blocked','assists'],log:['goals','assists','points','sog','attempts','hits','blocked','ppp','pim','plus_minus','toi','fantasy']},
 G:{support:['saves','shots_against','ga','toi'],log:['saves','shots_against','ga','toi','fantasy']},
};
export function family(position){
 const p=String(position||'').toUpperCase();
 return p==='G'?FAMILY.G:p==='D'?FAMILY.D:FAMILY.F;
}

// The page's stat tabs, in this order where the player has a line.
export const MARKET_ORDER=['points','goals','assists','sog','attempts','hits','blocked','hits_blocks','toi','fow','faceoffs','ppp','pim','plus_minus','fantasy',
 'saves','ga'];
const CODES={points:'PTS',goals:'GOALS',assists:'ASTS',sog:'SOG',attempts:'SHOTS',hits:'HITS',blocked:'BLK',hits_blocks:'H+B',toi:'TOI',
 fow:'FOW',faceoffs:'FO',ppp:'PPP',pim:'PIM',plus_minus:'+/-',fantasy:'FS',saves:'SAVES',ga:'GA'};
export const nhlStatCode=(valueKey,label)=>CODES[valueKey]||String(label||'').split(/\s+/).map(word=>word[0]).join('').toUpperCase().slice(0,5);

/** One player's games from his team's log, oldest first. Games the team
 * played after his first appearance that he sat out are DNP rows (the
 * chart skips them; the splits and game log use them). */
export function playerGames(log,playerId){
 const pid=String(playerId||'');
 const games=log?.games||[];
 const first=games.findIndex(game=>game.players&&pid in game.players);
 if(!pid||first<0)return [];
 return games.slice(first).map(game=>{
  const line=game.players?.[pid];
  return {gameId:game.gameId,season:game.season,seasonKind:game.seasonKind,date:game.date,team:game.team,opponent:game.opponent,
   isHome:game.isHome,result:game.result,score:game.score,extra:game.extra,dnp:!line,values:line||{},totals:game.totals,against:game.against};
 });
}
export const playedGames=rows=>(rows||[]).filter(row=>!row.dnp);

// The shared trend panel's shape (app.js EXTERNAL_TREND_ADAPTER): oldest
// first, one entry per game with a value for the stat.
const playedOn=date=>{const day=new Date(`${date}T12:00:00`);return Number.isNaN(day.getTime())?'':day.toLocaleDateString([],{month:'numeric',day:'numeric'});};
// "20262027" -> "2026-27", the way hockey seasons are named.
export const seasonLabel=season=>{const text=String(season||'');return /^\d{8}$/.test(text)?`${text.slice(0,4)}-${text.slice(6)}`:text;};
export function nhlChart(rows,valueKey,opponent){
 const all=playedGames(rows).map(row=>({value:statValue(row,valueKey),season:seasonLabel(row.season),fullDate:row.date||'',
  dateLabel:playedOn(row.date),opponent:row.opponent||'',opponentLabel:(row.isHome===false?'@':'')+(row.opponent||''),isHome:row.isHome,
  gameId:row.gameId,result:row.result,score:row.score,seasonKind:row.seasonKind||'regular'})).filter(game=>finite(game.value));
 const chart={all};const h2h=opponent?all.filter(game=>game.opponent===opponent):[];
 if(h2h.length){chart.h2h=h2h;chart.meta={h2hLabel:`vs ${opponent}`};}
 return chart;
}

/** How the player did with and without each teammate: {id: {with, without}}
 * with the games and his average in each, for the depth chart's buttons. */
export function withWithout(log,playerId,valueKey){
 const mine=playedGames(playerGames(log,playerId));
 // Each game's place in the team's log, and each teammate's first game in
 // it: before he joined, the player wasn't playing "without" him.
 const games=log?.games||[],at=new Map(games.map((game,index)=>[game.gameId,index])),first=new Map();
 games.forEach((game,index)=>{for(const pid of Object.keys(game.players||{}))if(!first.has(pid))first.set(pid,index);});
 const out={};
 for(const [pid,info] of Object.entries(log?.players||{})){
  if(pid===String(playerId))continue;
  const split={with:[],without:[]};
  for(const game of mine){const index=at.get(game.gameId),source=games[index];
   if(source?.players?.[pid])split.with.push(game);else if(first.has(pid)&&index>=first.get(pid))split.without.push(game);}
  const summary=games=>{const values=games.map(game=>statValue(game,valueKey)).filter(finite);return {games:games.length,gameIds:games.map(game=>game.gameId),avg:values.length?values.reduce((a,b)=>a+b,0)/values.length:null};};
  out[pid]={id:pid,name:info.name,with:summary(split.with),without:summary(split.without)};
 }
 return out;
}
