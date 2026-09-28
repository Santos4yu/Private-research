// Data + definitions for the Finder's NFL player page. Every number comes
// from /api/nfl's finder-* resources (backend/sports/nfl/finder.py, built on
// nflverse); nothing here estimates anything. The formatters are the WNBA
// page's, so both pages read the same.
import {useEffect,useState} from 'react';
import {finite} from '../wnba/wnba-research';

export const nflSeason=(now=new Date())=>now.getMonth()<2?now.getFullYear()-1:now.getFullYear();

const requests=new Map();
// One request per URL for the session; a failure is forgotten so Retry
// really asks again.
export function nflGet(resource,params={}){
 const query=new URLSearchParams({resource:`finder-${resource}`});
 Object.entries(params).forEach(([key,value])=>{if(value!=null&&value!=='')query.set(key,String(value));});
 const url='/api/nfl?'+query;
 if(!requests.has(url)){
  const promise=fetch(url,{credentials:'same-origin'}).then(async response=>{
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'NFL research is temporarily unavailable.');
   return data;
  });
  promise.catch(()=>requests.delete(url));
  requests.set(url,promise);
 }
 return requests.get(url);
}
export function useNfl(resource,params,enabled=true){
 const key=JSON.stringify(params);
 const [retry,setRetry]=useState(0),[state,setState]=useState({loading:enabled});
 useEffect(()=>{
  if(!enabled){setState({});return undefined;}
  let active=true;setState(old=>({loading:true,data:old.key===key?old.data:undefined,key}));
  nflGet(resource,params).then(data=>{if(active)setState({data,key});}).catch(error=>{if(active)setState({error:error.message,key});});
  return()=>{active=false;};
 },[resource,key,enabled,retry]);
 return {...state,retry:()=>setRetry(n=>n+1)};
}

export const gameIdOf=row=>row.raw?.gameId||row.gameId||'';
export const opponentOf=row=>row.opponent||(row.teamAbbr&&row.teamAbbr===row.homeTeamAbbr?row.awayTeamAbbr:row.homeTeamAbbr)||'';
export const positionOf=value=>String(value||'').toUpperCase();

// The page's stat families by position: what the supporting chart offers,
// what the game log shows, and which cards the averages section fills.
export const STATS={
 receptions:{label:'Receptions',short:'Recs',get:g=>g.box?.receptions},
 targets:{label:'Rec Targets',short:'TGTs',get:g=>g.box?.targets},
 receiving_yards:{label:'Rec Yards',short:'Rec Yds',get:g=>g.box?.receiving_yards},
 receiving_tds:{label:'Receiving TDs',short:'Rec TD',get:g=>g.box?.receiving_tds},
 longest_reception:{label:'Longest Reception',short:'Long',get:g=>g.values?.longest_reception},
 rz_targets:{label:'Red Zone Targets',short:'RZ Tgt',get:g=>g.box?.rz_targets},
 carries:{label:'Rush Attempts',short:'Rush Att',get:g=>g.box?.carries},
 rushing_yards:{label:'Rush Yards',short:'Rush Yds',get:g=>g.box?.rushing_yards},
 rushing_tds:{label:'Rush TDs',short:'Rush TD',get:g=>g.box?.rushing_tds},
 rush_rec_yards:{label:'Rush + Rec Yds',short:'R+R Yds',get:g=>g.values?.rushing_receiving_yards},
 touchdowns:{label:'Rush + Rec TDs',short:'TDs',get:g=>g.values?.touchdowns},
 completions:{label:'Completions',short:'Cmp',get:g=>g.box?.completions},
 attempts:{label:'Pass Attempts',short:'Att',get:g=>g.box?.attempts},
 passing_yards:{label:'Pass Yards',short:'Pass Yds',get:g=>g.box?.passing_yards},
 passing_tds:{label:'Pass TDs',short:'Pass TD',get:g=>g.box?.passing_tds},
 interceptions:{label:'Interceptions',short:'INT',get:g=>g.box?.passing_interceptions},
 sacks_taken:{label:'Sacks Taken',short:'Sacked',get:g=>g.box?.sacks_suffered},
 pass_rush_yards:{label:'Pass + Rush Yds',short:'P+R Yds',get:g=>g.values?.passing_rushing_yards},
 fantasy:{label:'Fantasy Score',short:'Fantasy',get:g=>g.values?.fantasy_score},
 tackles:{label:'Tackles',short:'Tkl',get:g=>g.box?.def_tackles_solo},
 assists:{label:'Assists',short:'Ast',get:g=>g.box?.def_tackle_assists},
 sacks:{label:'Sacks',short:'Sacks',get:g=>g.box?.def_sacks},
 def_int:{label:'Interceptions',short:'INT',get:g=>g.box?.def_interceptions},
 pass_defended:{label:'Passes Defended',short:'PD',get:g=>g.box?.def_pass_defended},
 fg_made:{label:'FG Made',short:'FGM',get:g=>g.box?.fg_made},
 fg_att:{label:'FG Attempts',short:'FGA',get:g=>g.box?.fg_att},
 pat_made:{label:'Extra Points',short:'XP',get:g=>g.box?.pat_made},
 kicking_points:{label:'Kicking Points',short:'Kick Pts',get:g=>finite(g.box?.fg_made)&&finite(g.box?.pat_made)?g.box.fg_made*3+g.box.pat_made:undefined},
};
const FAMILY={
 QB:{support:['completions','attempts','passing_yards','passing_tds','interceptions','rushing_yards'],
  log:['completions','attempts','passing_yards','passing_tds','interceptions','sacks_taken','carries','rushing_yards','rushing_tds','pass_rush_yards','fantasy']},
 RB:{support:['carries','rushing_yards','receptions','targets','receiving_yards','touchdowns'],
  log:['rushing_yards','carries','rushing_tds','receptions','receiving_yards','targets','rz_targets','receiving_tds','rush_rec_yards','fantasy']},
 WR:{support:['receptions','targets','longest_reception','receiving_tds','receiving_yards','rz_targets'],
  log:['rushing_yards','carries','rushing_tds','receptions','receiving_yards','targets','rz_targets','receiving_tds','rush_rec_yards','longest_reception','fantasy']},
 K:{support:['fg_made','fg_att','pat_made','kicking_points'],log:['fg_made','fg_att','pat_made','kicking_points']},
 DEF:{support:['tackles','assists','sacks','def_int','pass_defended'],log:['tackles','assists','sacks','def_int','pass_defended']},
};
export function family(position){
 const p=positionOf(position);
 if(p==='QB')return FAMILY.QB;if(p==='RB'||p==='FB')return FAMILY.RB;if(p==='K')return FAMILY.K;
 if(['WR','TE'].includes(p)||!p)return FAMILY.WR;return FAMILY.DEF;
}
// Which prop market a stat card stands for, so the averages can show which
// apps post a line on it.
export const STAT_MARKET={receptions:'receptions',targets:'targets',receiving_yards:'receiving_yards',longest_reception:'longest_reception',
 carries:'rush_attempts',rushing_yards:'rushing_yards',rush_rec_yards:'rushing_receiving_yards',touchdowns:'touchdowns',completions:'pass_completions',
 attempts:'passing_attempts',passing_yards:'passing_yards',passing_tds:'passing_touchdowns',interceptions:'interceptions',pass_rush_yards:'passing_rushing_yards',fantasy:'fantasy_score'};

// Play-by-play extras arrive separately (they need the heaviest file) and
// are folded into the game log when they land.
export function mergePlayByPlay(rows,pbp){
 const games=pbp?.games||{};
 return (rows||[]).map(row=>{const extra=games[row.gameId];if(!extra||row.dnp)return row;
  return {...row,box:{...row.box,rz_targets:extra.rzTargets,longest_rush:extra.longestRush},values:{...row.values,longest_reception:finite(extra.longestReception)?extra.longestReception:row.values?.longest_reception}};});
}
export const playedGames=rows=>(rows||[]).filter(row=>!row.dnp);

// The shared trend panel's shape (app.js EXTERNAL_TREND_ADAPTER): oldest
// first, one entry per game with a value for the stat.
const playedOn=date=>{const day=new Date(`${date}T12:00:00`);return Number.isNaN(day.getTime())?'':day.toLocaleDateString([],{month:'numeric',day:'numeric'});};
export function nflFinderChart(rows,market,opponent){
 const all=playedGames(rows).map(row=>({value:row.values?.[market],season:String(row.season||''),fullDate:row.date||'',dateLabel:playedOn(row.date),
  opponent:row.opponent||'',opponentLabel:(row.isHome===false?'@':'')+(row.opponent||''),isHome:row.isHome,gameId:row.gameId,result:row.result,score:row.score}))
  .filter(game=>finite(game.value));
 const chart={all};const h2h=opponent?all.filter(game=>game.opponent===opponent):[];
 if(h2h.length){chart.h2h=h2h;chart.meta={h2hLabel:`vs ${opponent}`};}
 return chart;
}

// Injury status -> the short tag the depth chart and cards show.
const INJURY_CODES={OUT:'OUT',DOUBTFUL:'DOUBT',QUESTIONABLE:'Q',IR:'IR',PUP:'PUP',NFI:'NFI'};
export const injuryCode=item=>item?INJURY_CODES[String(item.status||'').toUpperCase()]||null:null;
export const INJURY_LEGEND=[['OUT','Out for game'],['DOUBT','Doubtful'],['Q','Questionable'],['IR','Injured reserve']];

// Team colors that read on the dark cards (a team's primary where it does,
// its brightest alternate where the primary is too dark).
export const TEAM_COLORS={ARI:'#c9304f',ATL:'#d9313f',BAL:'#9e7c0c',BUF:'#d8263f',CAR:'#0085ca',CHI:'#e2551f',CIN:'#fb4f14',CLE:'#ff3c00',
 DAL:'#8fa3b7',DEN:'#fb4f14',DET:'#0a8ad1',GB:'#ffb612',HOU:'#d23a4a',IND:'#4a7fd4',JAX:'#d7a22a',KC:'#e31837',LAC:'#0a9ae6',LAR:'#ffa300',
 LV:'#a5acaf',MIA:'#00a3ad',MIN:'#8a68d6',NE:'#d2323f',NO:'#d3bc8d',NYG:'#3d6fd6',NYJ:'#1d9e6e',PHI:'#3aa0a6',PIT:'#ffb612',SEA:'#69be28',
 SF:'#c9302c',TB:'#e03a3e',TEN:'#4b92db',WAS:'#ffb612'};
export const teamColor=(abbr,fallback='#7b8cff')=>TEAM_COLORS[abbr]||fallback;
