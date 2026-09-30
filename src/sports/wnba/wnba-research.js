// Data + formatting shared by the WNBA and NBA player page and its matchup
// panel. Every number shown comes from /api/wnba (ESPN game summaries and the
// stored season of box scores; `league=nba` for the NBA); nothing here
// estimates anything.
import {useEffect,useState} from 'react';

const requests=new Map();
// One request per URL for the session. A failure is forgotten so a retry
// really asks again.
export function wnbaGet(resource,params={}){
 const query=new URLSearchParams({resource});
 Object.entries(params).forEach(([key,value])=>{if(value!=null&&value!=='')query.set(key,String(value));});
 const url='/api/wnba?'+query;
 if(!requests.has(url)){
  const promise=fetch(url,{credentials:'same-origin'}).then(async response=>{
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||'Research is temporarily unavailable.');
   return data;
  });
  promise.catch(()=>requests.delete(url));
  requests.set(url,promise);
 }
 return requests.get(url);
}
export function useWnba(resource,params,enabled=true){
 const key=JSON.stringify(params);
 const [retry,setRetry]=useState(0),[state,setState]=useState({loading:enabled});
 useEffect(()=>{
  if(!enabled){setState({});return undefined;}
  let active=true;setState(old=>({loading:true,data:old.key===key?old.data:undefined,key}));
  wnbaGet(resource,params).then(data=>{if(active)setState({data,key});}).catch(error=>{if(active)setState({error:error.message,key});});
  return()=>{active=false;};
 },[resource,key,enabled,retry]);
 return {...state,retry:()=>setRetry(n=>n+1)};
}

// Prop-board market -> the stat key the matchup data uses.
export const MARKET_STAT={player_points:'pts',player_rebounds:'reb',player_assists:'ast',player_threes:'tpm',player_blocks:'blk',player_steals:'stl',player_blocks_steals:'bs',player_turnovers:'to',player_points_rebounds:'pr',player_points_assists:'pa',player_rebounds_assists:'ra',player_points_rebounds_assists:'pra',player_fantasy_points:'fs',player_threes_attempts:'tpa',player_field_goals:'fgm',player_frees_made:'ftm',player_field_goals_attempts:'fga',player_frees_attempts:'fta',player_twos:'twos',player_twos_attempts:'twosa',player_fouls:'pf',player_offensive_rebounds:'oreb',player_defensive_rebounds:'dreb',player_double_double:'dd',player_triple_double:'td'};
export const POSITIONS=[['G','Guards'],['F','Forwards'],['C','Centers']];
export const opponentOf=row=>row.team===row.homeTeam?row.awayTeamAbbr:row.homeTeamAbbr;
// The league a request is for: only the NBA says so (the WNBA is the default).
export const leagueOf=row=>row?.sport==='nba'?'nba':undefined;
// One definition, so every card asking for the player's context shares a
// single request (wnbaGet keys on the URL, and the URL on this order).
export const playerContextParams=row=>({playerId:row.playerId,team:row.teamAbbr,opponent:opponentOf(row),market:row.marketKey,line:row.line,league:leagueOf(row)});
export const hasPlayerContext=row=>Boolean(row.playerId&&row.teamAbbr&&opponentOf(row)&&MARKET_STAT[row.marketKey]);
// With/without choices on the chart. Several can be on at once (two
// teammates out, one in...); the chart keeps only the games matching all of
// them. The depth chart and the Injuries tab share this one list.
export const splitFilter=(id,kind,name,pos,ids)=>({id:String(id),kind,name,pos:positionOf(pos),ids:(ids||[]).map(String)});
export const splitKey=filter=>`${filter.id}:${filter.kind}`;
export const hasSplit=(filters,id,kind)=>filters.some(filter=>filter.id===String(id)&&filter.kind===kind);
// Same teammate, same choice: off. Same teammate, other choice: switch.
export function toggleSplit(filters,entry){
 const current=filters.find(filter=>filter.id===entry.id);
 if(current?.kind===entry.kind)return filters.filter(filter=>filter.id!==entry.id);
 return [...filters.filter(filter=>filter.id!==entry.id),entry];
}
export const splitLabel=filter=>`${filter.kind==='without'?'W/O':'W/'} ${filter.name}${filter.pos?` (${filter.pos})`:''}`;
export const applySplits=(logs,filters)=>filters.length?(logs||[]).filter(game=>filters.every(filter=>filter.ids.includes(String(game.gameId)))):(logs||[]);
export const positionOf=value=>{const p=String(value||'').toUpperCase()[0];return ['G','F','C'].includes(p)?p:null;};
export const finite=value=>typeof value==='number'&&Number.isFinite(value);
export function fmt(value,digits=1){if(!finite(value))return '—';return Number(value.toFixed(digits)).toLocaleString();}
export const ordinal=n=>{if(!finite(n))return '—';const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);};
export const signed=(value,digits=1)=>finite(value)?(value>0?'+':'')+value.toFixed(digits):'—';
export const price=value=>finite(value)?(value>0?'+':'')+Math.round(value):'—';
export function shortDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleDateString([],{month:'numeric',day:'numeric'});}
export function ago(value){
 const date=new Date(value);if(Number.isNaN(date.getTime()))return '';
 const days=Math.round((Date.now()-date.getTime())/86400000);
 return days<=0?'Today':days===1?'Yesterday':days<30?`${days} days ago`:date.toLocaleDateString([],{month:'short',day:'numeric'});
}
// Rank r of n teams, where 1 is always the better side for whoever reads it.
export function rankTone(rank,count){if(!finite(rank)||!count)return 'neutral';return rank<=Math.ceil(count/3)?'good':rank>count-Math.ceil(count/3)?'poor':'fair';}
// A team's own color when it reads on the dark cards, else its alternate.
export function teamColor(team,fallback='#7b8cff'){
 const hex=value=>/^[0-9a-f]{6}$/i.test(String(value||''))?'#'+value:null;
 const light=value=>{const n=parseInt(value.slice(1),16);return 0.2126*((n>>16)&255)/255+0.7152*((n>>8)&255)/255+0.0722*(n&255)/255;};
 for(const color of [hex(team?.color),hex(team?.altColor)])if(color&&light(color)>0.2)return color;
 return fallback;
}
// A game-log row's value for a stat key (box line first, markets second).
export function logValue(game,key){
 const box=game.box||{};
 if(key==='min')return finite(box.min)?box.min:game.minutes;
 if(key in box)return box[key];
 const market=Object.keys(MARKET_STAT).find(market=>MARKET_STAT[market]===key);
 return market?game.values?.[market]:undefined;
}
export const realGames=logs=>[...(logs||[])].filter(game=>game.seasonKind!=='preseason').sort((a,b)=>String(a.date).localeCompare(String(b.date)));
export function average(values){const valid=values.filter(finite);return valid.length?valid.reduce((sum,value)=>sum+value,0)/valid.length:null;}
