// The Finder's college football numbers: a team's games (cfb_research.team_log)
// turned into one player's game log, the trend chart's games, and how much
// each defense on the board gives up. Pure -- no requests here.

const finite=value=>typeof value==='number'&&Number.isFinite(value);

export const cfbLogo=id=>/^\d+$/.test(String(id||''))?`https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png`:'';

// Every number a game carries, under the NFL Finder's market keys.
export const STATS={
 passing_yards:{label:'Pass Yards',short:'PASS'},passing_touchdowns:{label:'Pass TDs',short:'PTD'},passing_attempts:{label:'Pass Attempts',short:'ATT'},
 pass_completions:{label:'Completions',short:'CMP'},interceptions:{label:'Interceptions Thrown',short:'INT'},sacks_taken:{label:'Sacks Taken',short:'SACKED'},
 completion_pct:{label:'Completion %',short:'CMP%'},passing_rushing_yards:{label:'Pass + Rush Yds',short:'P+R'},
 rushing_yards:{label:'Rush Yards',short:'RUSH'},rush_attempts:{label:'Rush Attempts',short:'CAR'},rushing_tds:{label:'Rush TDs',short:'RTD'},
 longest_rush:{label:'Longest Rush',short:'LNG'},yards_per_carry:{label:'Yards per Carry',short:'YPC'},
 receptions:{label:'Receptions',short:'REC'},receiving_yards:{label:'Receiving Yards',short:'REC YD'},receiving_tds:{label:'Rec TDs',short:'RECTD'},
 longest_reception:{label:'Longest Reception',short:'LNG'},targets:{label:'Targets',short:'TGT'},
 rushing_receiving_yards:{label:'Rush + Rec Yds',short:'R+R'},touchdowns:{label:'Rush + Rec TDs',short:'TD'},pass_rush_rec_tds:{label:'Pass + Rush + Rec TDs',short:'TDS'},
 fumbles_lost:{label:'Fumbles Lost',short:'FUM'},fantasy_score:{label:'Fantasy Score',short:'FS'},
 fg_made:{label:'FG Made',short:'FGM'},fg_attempts:{label:'FG Attempts',short:'FGA'},kicking_points:{label:'Kicking Points',short:'KP'},
 longest_fg:{label:'Longest FG',short:'LNG'},pat_made:{label:'PAT Made',short:'XP'},pat_attempts:{label:'PAT Attempts',short:'XPA'},
 punts:{label:'Punts',short:'PUNTS'},gross_punt_yards:{label:'Punt Yards',short:'P YDS'},punts_inside_20:{label:'Punts Inside 20',short:'IN20'},
 tackles:{label:'Total Tackles',short:'TKL'},solo_tackles:{label:'Solo Tackles',short:'SOLO'},sacks:{label:'Sacks',short:'SACK'},
 tackles_for_loss:{label:'Tackles for Loss',short:'TFL'},def_interceptions:{label:'Interceptions',short:'D INT'},
};
export const statValue=(game,key)=>{const value=game?.values?.[key];return finite(value)?value:null;};

const FAMILY={
 QB:{support:['passing_attempts','pass_completions','passing_yards','rushing_yards'],log:['pass_completions','passing_attempts','passing_yards','passing_touchdowns','interceptions','rush_attempts','rushing_yards','rushing_tds','fantasy_score']},
 RB:{support:['rush_attempts','rushing_yards','receptions','receiving_yards'],log:['rush_attempts','rushing_yards','rushing_tds','longest_rush','receptions','receiving_yards','receiving_tds','fantasy_score']},
 WR:{support:['receptions','receiving_yards','longest_reception','rushing_yards'],log:['receptions','receiving_yards','receiving_tds','longest_reception','rush_attempts','rushing_yards','fantasy_score']},
 K:{support:['fg_attempts','fg_made','pat_made','kicking_points'],log:['fg_made','fg_attempts','longest_fg','pat_made','pat_attempts','kicking_points']},
 P:{support:['punts','gross_punt_yards','punts_inside_20'],log:['punts','gross_punt_yards','punts_inside_20']},
 DEF:{support:['tackles','solo_tackles','tackles_for_loss','sacks'],log:['tackles','solo_tackles','tackles_for_loss','sacks','def_interceptions']},
};
export function family(position){
 const p=String(position||'').toUpperCase();
 if(p==='QB'||p==='K'||p==='P')return FAMILY[p];
 if(p==='RB')return FAMILY.RB;
 if(p==='WR'||p==='TE')return FAMILY.WR;
 if(['DL','LB','DB','DEF'].includes(p))return FAMILY.DEF;
 return FAMILY.WR;
}
export const cfbStatCode=(valueKey,label)=>STATS[valueKey]?.short||String(label||'').split(/\s+/).map(word=>word[0]).join('').toUpperCase().slice(0,5);

/** One player's games from his team's log, oldest first. Games the team
 * played after his first appearance with no line for him are DNP rows: a
 * box score lists only who recorded a stat, so the chart and hit rates
 * leave them out rather than count them as zeros. */
export function playerGames(log,playerId){
 const pid=String(playerId||'');
 const games=log?.games||[];
 const first=games.findIndex(game=>game.players&&pid in game.players);
 if(!pid||first<0)return [];
 return games.slice(first).map(game=>{
  const line=game.players?.[pid];
  return {gameId:game.gameId,season:game.season,seasonKind:game.seasonKind,date:game.date,team:game.team,opponent:game.opponent,opponentId:game.opponentId,
   opponentLogo:game.opponentLogo,isHome:game.isHome,result:game.result,score:game.score,dnp:!line,values:line||{},totals:game.totals,against:game.against};
 });
}
export const playedGames=rows=>(rows||[]).filter(row=>!row.dnp);

const playedOn=date=>{const day=new Date(`${date}T12:00:00`);return Number.isNaN(day.getTime())?'':day.toLocaleDateString([],{month:'numeric',day:'numeric'});};
// The shared trend panel's shape: oldest first, one entry per game with a value.
export function cfbChart(rows,valueKey,opponent){
 const all=playedGames(rows).map(row=>({value:statValue(row,valueKey),season:String(row.season||''),fullDate:row.date||'',
  dateLabel:playedOn(row.date),opponent:row.opponent||'',opponentLabel:(row.isHome===false?'@':'')+(row.opponent||''),isHome:row.isHome,
  gameId:row.gameId,result:row.result,score:row.score,seasonKind:row.seasonKind||'regular'})).filter(game=>finite(game.value));
 const chart={all};const h2h=opponent?all.filter(game=>game.opponent===opponent):[];
 if(h2h.length){chart.h2h=h2h;chart.meta={h2hLabel:`vs ${opponent}`};}
 return chart;
}

// What a defense gives up that a stat feeds on (cfb_research's "against"):
// a quarterback's passing yards and a receiver's catches both come from
// the passing game the defense allows.
export const AGAINST={
 passing_yards:'passYards',passing_attempts:'passAttempts',pass_completions:'completions',passing_touchdowns:'passTds',completion_pct:'completions',
 receiving_yards:'passYards',receptions:'completions',receiving_tds:'passTds',longest_reception:'passYards',targets:'passAttempts',
 rushing_yards:'rushYards',rush_attempts:'rushAttempts',rushing_tds:'rushTds',longest_rush:'rushYards',yards_per_carry:'rushYards',
 rushing_receiving_yards:'totalYards',passing_rushing_yards:'totalYards',touchdowns:'points',pass_rush_rec_tds:'points',fantasy_score:'totalYards',
 kicking_points:'points',fg_made:'points',fg_attempts:'points',pat_made:'points',
};
export const AGAINST_WORDS={passYards:'passing yards',passAttempts:'pass attempts',completions:'completions',passTds:'passing TDs',
 rushYards:'rushing yards',rushAttempts:'rush attempts',rushTds:'rushing TDs',totalYards:'total yards',points:'points'};

/** Each team's average given up per game, this season (last season's when
 * it has fewer than three games yet): {team abbr: {passYards, ...}, games}. */
export function allowedByTeam(logs){
 const out={};
 for(const log of logs){
  const games=log?.games||[];if(!games.length||!log.team)continue;
  const season=games.at(-1).season;
  let used=games.filter(game=>game.season===season);
  if(used.length<3)used=games.slice(-8);
  const sums={},counts={};
  for(const game of used)for(const [key,value] of Object.entries(game.against||{}))if(finite(value)){sums[key]=(sums[key]||0)+value;counts[key]=(counts[key]||0)+1;}
  out[log.team]={games:used.length,...Object.fromEntries(Object.keys(sums).map(key=>[key,sums[key]/counts[key]]))};
 }
 return out;
}

/** How generous each defense is for one stat, 1 being the board's average
 * (above 1 gives up more), pulled toward 1 on a short sample: {team: ratio}. */
export function allowTable(allowed,valueKey){
 const key=AGAINST[valueKey];
 if(!key)return null;
 const teams=Object.entries(allowed).filter(([,item])=>finite(item[key]));
 if(teams.length<6)return null;
 const average=teams.reduce((sum,[,item])=>sum+item[key],0)/teams.length;
 if(!(average>0))return null;
 return Object.fromEntries(teams.map(([team,item])=>[team,1+(item[key]/average-1)*item.games/(item.games+3)]));
}

/** How the player did with and without each teammate: {id: {with, without}}
 * with the games and his average in each, for the depth chart's buttons. */
export function withWithout(log,playerId,valueKey){
 const mine=playedGames(playerGames(log,playerId));
 const out={};
 for(const [pid,info] of Object.entries(log?.players||{})){
  if(pid===String(playerId))continue;
  const split={with:[],without:[]};
  for(const game of mine){const source=(log.games||[]).find(item=>item.gameId===game.gameId);split[source?.players?.[pid]?'with':'without'].push(game);}
  const summary=games=>{const values=games.map(game=>statValue(game,valueKey)).filter(finite);return {games:games.length,gameIds:games.map(game=>game.gameId),avg:values.length?values.reduce((a,b)=>a+b,0)/values.length:null};};
  out[pid]={id:pid,name:info.name,with:summary(split.with),without:summary(split.without)};
 }
 return out;
}
