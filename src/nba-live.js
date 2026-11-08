// NBA games while they're on, read by the member's own phone from NBA.com's
// live feed (Nov 8, the owner: "The live feed is super slow"). The server
// reads the same feed (nba_live.py) but NBA.com may turn servers away (the
// GitHub check's runner was); a phone isn't. Only used when the server's
// chart says it's on ESPN's slower play-by-play (chart.liveSource 'espn').

const CDN='https://cdn.nba.com/static/json/liveData';
// ESPN's abbreviation -> NBA.com's tricode where they differ (as nba_live.py).
const TRICODES={GS:'GSW',NY:'NYK',SA:'SAS',NO:'NOP',UTAH:'UTA',WSH:'WAS'};
export const tricode=abbr=>TRICODES[String(abbr||'').toUpperCase()]||String(abbr||'').toUpperCase();

/** NBA.com's ISO clock as a game clock: "PT01M21.00S" -> "1:21", "PT00M54.40S" -> "0:54.4". */
export function clockText(value){
 const found=/PT(\d+)M([\d.]+)S/.exec(String(value||''));
 if(!found)return String(value||'');
 const minutes=Number(found[1]),seconds=Number(found[2]);
 if(minutes===0&&seconds%1)return `0:${seconds.toFixed(1).padStart(4,'0')}`;
 return `${minutes}:${String(Math.floor(seconds)).padStart(2,'0')}`;
}
const ordinal=period=>({1:'1st',2:'2nd',3:'3rd',4:'4th'})[period]||(period===5?'OT':`${period-4}OT`);
/** ESPN's way of saying the time ("0:54.4 - 2nd"), so the page reads both alike; none at a period's end. */
export function detailOf(game){
 const period=Number(game?.period),clock=clockText(game?.gameClock);
 if(!period||!clock||clock==='0:00')return null;
 return `${clock} - ${ordinal(period)}`;
}

export function findGame(board,home,away){
 const games=board?.scoreboard?.games||[];
 return games.find(game=>game.homeTeam?.teamTricode===tricode(home)&&game.awayTeam?.teamTricode===tricode(away))||null;
}

const number=value=>{const found=Number(value);return Number.isFinite(found)?found:null;};
const periodName=index=>index<4?`Q${index+1}`:index===4?'OT':`OT${index-3}`;

/** The run going now from NBA.com's actions: the points one team has scored since the other last did (7+). */
export function runOf(actions,homeCode){
 let before=[0,0];const changes=[];
 for(const action of actions||[]){
  const home=number(action.scoreHome),away=number(action.scoreAway);
  if(home==null||away==null||(home===before[0]&&away===before[1]))continue;
  changes.push([home-before[0],away-before[1]]);before=[home,away];
 }
 let side=null,points=0;
 for(let index=changes.length-1;index>=0;index--){
  const [home,away]=changes[index];
  if(home>0&&away>0)break;
  const scorer=home>0?'home':away>0?'away':null;
  if(!scorer)continue;
  if(!side)side=scorer;
  if(scorer!==side)break;
  points+=scorer==='home'?home:away;
 }
 return side&&points>=7?{side,points}:null;
}

const minutesOf=value=>{const found=/PT(\d+)M([\d.]+)S/.exec(String(value||''));return found?Math.round((Number(found[1])+Number(found[2])/60)*10)/10:0;};
const statsOf=player=>{const s=player?.statistics||{};const n=key=>number(s[key])||0;
 return {pts:n('points'),reb:n('reboundsTotal'),ast:n('assists'),stl:n('steals'),blk:n('blocks'),to:n('turnovers'),pf:n('foulsPersonal'),
  oreb:n('reboundsOffensive'),dreb:n('reboundsDefensive'),fgm:n('fieldGoalsMade'),fga:n('fieldGoalsAttempted'),tpm:n('threePointersMade'),
  tpa:n('threePointersAttempted'),ftm:n('freeThrowsMade'),fta:n('freeThrowsAttempted'),min:minutesOf(s.minutes)};};

// A prop's name on the page (game_live.NBA_PROPS) -> its count from a box score line.
const sum=(...keys)=>stats=>keys.reduce((total,key)=>total+(stats[key]||0),0);
const PROP_COUNTS={'Points':sum('pts'),'Rebounds':sum('reb'),'Assists':sum('ast'),'3-pointers':sum('tpm'),'Pts + Reb + Ast':sum('pts','reb','ast'),
 'Pts + Reb':sum('pts','reb'),'Pts + Ast':sum('pts','ast'),'Reb + Ast':sum('reb','ast'),'Blocks':sum('blk'),'Steals':sum('stl'),
 'Blocks + Steals':sum('blk','stl'),'Turnovers':sum('to'),'Free throws made':sum('ftm'),'Field goals made':sum('fgm'),'Field goals tried':sum('fga'),
 '3-pointers tried':sum('tpa'),'Offensive rebounds':sum('oreb'),'Defensive rebounds':sum('dreb'),'Fouls':sum('pf'),
 '2-pointers':stats=>(stats.fgm||0)-(stats.tpm||0),
 'Fantasy score':stats=>Math.round(((stats.pts||0)+1.2*(stats.reb||0)+1.5*(stats.ast||0)+3*((stats.blk||0)+(stats.stl||0))-(stats.to||0))*10)/10};
const nameKey=name=>String(name||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,'').split(/\s+/)
 .filter((part,index,parts)=>!(index===parts.length-1&&parts.length>1&&['jr','sr','ii','iii','iv','v'].includes(part))).join('');

/**
 * The chart with NBA.com's fresher parts laid over ESPN's: the score and the
 * clock, the last play and the run, the quarter scores, the top players, and
 * each prop's count. The win chance line stays ESPN's.
 */
export function withNbaLive(chart,actions,box){
 if(!chart||(!actions?.length&&!box))return chart;
 const homeCode=tricode(chart.home?.abbr),awayCode=tricode(chart.away?.abbr);
 const game=box||{};
 const feed={...(chart.feed||{})};
 const last=[...(actions||[])].reverse().find(action=>String(action.description||'').trim());
 if(last){
  const side=last.teamTricode===homeCode?'home':last.teamTricode===awayCode?'away':null;
  feed.last={text:String(last.description).trim(),when:`${periodName(Number(last.period)-1)} ${clockText(last.clock)}`,side};
 }
 if(actions?.length)feed.run=runOf(actions,homeCode);
 const players={home:game.homeTeam?.players||[],away:game.awayTeam?.players||[]};
 if(box){
  const rows=side=>(game[side==='home'?'homeTeam':'awayTeam']?.periods||[]).map(item=>number(item.score));
  const played=Math.max(1,number(game.period)||1),count=Math.min(played,Math.max(rows('home').length,rows('away').length));
  if(count)feed.quarters={labels:Array.from({length:count},(_,index)=>periodName(index)),home:rows('home').slice(0,count),away:rows('away').slice(0,count)};
  feed.leaders=Object.fromEntries(['home','away'].map(side=>[side,players[side].map(player=>({player,stats:statsOf(player)}))
   .sort((a,b)=>b.stats.pts-a.stats.pts||(b.stats.reb+b.stats.ast)-(a.stats.reb+a.stats.ast)).slice(0,2).filter(item=>item.stats.min||item.stats.pts)
   .map(({player,stats})=>({name:player.nameI||player.name,text:`${stats.pts} pts · ${stats.reb} reb · ${stats.ast} ast`}))]));
 }
 const byName=new Map([...players.home,...players.away].map(player=>[nameKey(player.name),statsOf(player)]));
 const props=(chart.props||[]).map(row=>{const stats=byName.get(nameKey(row.name));const count=PROP_COUNTS[row.stat];
  return stats&&count?{...row,now:Math.round(count(stats)*10)/10,minutes:stats.min||row.minutes}:row;});
 props.sort((a,b)=>Math.min(1,b.now/(b.line||1))-Math.min(1,a.now/(a.line||1))||(b.now>b.line)-(a.now>a.line));
 const score=(side,key)=>number(game[key]?.score);
 return {...chart,feed,props,liveSource:'nba.com (phone)',
  detail:detailOf(game)||chart.detail,
  home:{...chart.home,score:score('home','homeTeam')??chart.home?.score},
  away:{...chart.away,score:score('away','awayTeam')??chart.away?.score}};
}

/** {gameId: {home, away, detail, state}} from NBA.com's scoreboard, by both tricodes. */
export function scoresOf(board){
 const out=new Map();
 for(const game of board?.scoreboard?.games||[]){
  const state={1:'pre',2:'in',3:'post'}[Number(game.gameStatus)];
  out.set(`${game.homeTeam?.teamTricode}|${game.awayTeam?.teamTricode}`,{home:number(game.homeTeam?.score),away:number(game.awayTeam?.score),detail:detailOf(game),state});
 }
 return out;
}

/** The games list's live read with NBA.com's scores laid over it (NBA only). */
export function liveWithScores(live,games,board){
 const fresh=scoresOf(board);
 if(!fresh.size||!live)return live;
 const byId=new Map((games||[]).map(game=>[game.id,game]));
 return {...live,games:(live.games||[]).map(game=>{const listed=byId.get(game.id)||game;
  const found=fresh.get(`${tricode(listed.home?.abbr)}|${tricode(listed.away?.abbr)}`);
  if(!found||!['in','post'].includes(found.state))return game;
  return {...game,state:found.state,detail:found.detail||(found.state==='post'?'Final':game.detail),
   home:{...game.home,score:found.home??game.home?.score},away:{...game.away,score:found.away??game.away?.score}};})};
}

// One read at a time per path; a feed that won't answer this phone (NBA.com
// turning it away, or not allowing other sites to read it) is left alone for
// the rest of the visit.
const state={off:false};
export async function nbaJson(path){
 if(state.off)return null;
 try{
  const response=await fetch(`${CDN}${path}`,{cache:'no-store',credentials:'omit'});
  if(!response.ok){if(response.status===403)state.off=true;return null;}
  return await response.json();
 }catch{state.off=true;return null;}
}
export const nbaBoard=()=>nbaJson('/scoreboard/todaysScoreboard_00.json');
