// The Game Predictor's words and numbers (GamePredictor.jsx), kept apart so
// they can be tested: percentages, prices, kickoff times, which team a
// factor helps, and the record line.

export const SPORTS=[['nba','NBA'],['nfl','NFL']];

export const pct=(value,digits=0)=>value==null||!Number.isFinite(value)?'—':`${(value*100).toFixed(digits)}%`;
export const odds=price=>price==null||!Number.isFinite(price)?'—':price>0?`+${Math.round(price)}`:`${Math.round(price)}`;
const tenth=value=>Math.abs(value)>=10?Math.abs(value).toFixed(1).replace(/\.0$/,''):Math.abs(value).toFixed(1);

/** "Today 7:30 PM", "Sun 1:00 PM", "Nov 9 8:15 PM" (local time). */
export function startText(iso,now=new Date()){
 const time=Date.parse(iso||'');
 if(!Number.isFinite(time))return '';
 const date=new Date(time);
 const clock=date.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
 const day=new Date(now);day.setHours(0,0,0,0);
 const days=Math.round((new Date(date).setHours(0,0,0,0)-day.getTime())/864e5);
 if(days===0)return `Today ${clock}`;
 if(days===1)return `Tomorrow ${clock}`;
 if(days>1&&days<7)return `${date.toLocaleDateString('en-US',{weekday:'short'})} ${clock}`;
 return `${date.toLocaleDateString('en-US',{month:'short',day:'numeric'})} ${clock}`;
}

/** A game's line in a few characters: "DEN -6.5 · O/U 231.5". */
export function lineText(game){
 const line=game?.line||game?.market;
 if(!line)return '';
 const parts=[];
 if(line.spread!=null){
  const home=line.spread<=0;
  const team=home?game.home?.abbr:game.away?.abbr;
  parts.push(line.spread===0?'Pick\'em':`${team} -${tenth(line.spread)}`);
 }
 if(line.total!=null)parts.push(`O/U ${line.total}`);
 return parts.join(' · ');
}

/** Which side a factor's points help, and by how much: {side, text}. */
export function pull(points,game){
 if(points==null||Math.abs(points)<0.05)return {side:null,text:'Even'};
 const side=points>0?'home':'away';
 return {side,text:`+${tenth(points)} ${game?.[side]?.abbr||''}`.trim()};
}

/** "BOS by 5.5" for a home margin (negative: the away team). */
export function byText(margin,game){
 if(margin==null)return '—';
 if(Math.abs(margin)<0.05)return 'Even';
 return `${(margin>0?game?.home:game?.away)?.abbr||''} by ${tenth(margin)}`;
}

/** The record line: "12-5 · 71%". */
export function recordText(record){
 if(!record?.games)return null;
 return `${record.correct}-${record.games-record.correct} · ${pct(record.pct)}`;
}

/** A prediction's edge, in words: null when there is none to show. */
export function edgeText(prediction){
 const edge=prediction?.edge;
 if(!edge?.side)return null;
 const team=prediction[edge.side];
 const market=prediction.market?.chance?.[edge.side];
 return {team,price:odds(edge.price),fair:odds(edge.fair),ours:pct(edge.chance??prediction.chance?.[edge.side]),market:pct(market),
  gap:`+${(edge.points*100).toFixed(1)}%`};
}

/** The history's result for one entry: 'win', 'loss', 'push' or 'pending'. */
export function resultOf(item){
 const result=item?.result;
 if(!result)return 'pending';
 if(!result.winner)return 'push';
 return result.correct?'win':'loss';
}
