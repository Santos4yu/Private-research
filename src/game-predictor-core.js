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

/** A moneyline's expected value on a dollar: "+3.2%", "−4.1%". */
export const evText=value=>value==null||!Number.isFinite(value)?'—':`${value>=0?'+':'−'}${Math.abs(value*100).toFixed(1)}%`;

/** Units won or lost: "+1.4 units", "−2 units". */
export const unitsText=units=>{
 if(units==null||!Number.isFinite(units))return '—';
 const size=Math.abs(units).toFixed(1).replace(/\.0$/,'');
 return `${units>=0?'+':'−'}${size} ${size==='1'?'unit':'units'}`;
};

/** The moneyline rows, away first: each price with the blend's chance, its
 * value, the fair price and our model's value alone. */
export function valueRows(prediction){
 const ev=prediction?.ev;
 if(!ev?.blend)return [];
 return ['away','home'].filter(side=>ev.blend[side]).map(side=>{const row=ev.blend[side];return {side,team:prediction[side],
  price:odds(row.price),chance:pct(row.chance),ev:row.ev,text:evText(row.ev),fair:odds(row.fair),
  ours:ev.ours?.[side]?evText(ev.ours[side].ev):null,best:ev.best===side};});
}

/** Our model alone and with the line, when they're two different numbers. */
export function twoCalls(prediction){
 const {ours,blend}=prediction?.predictions||{};
 if(!ours||!blend||blend.weight==null||blend.weight>=1)return null;
 return {ours,blend,share:blend.weight>0?`${Math.round(blend.weight*100)}% ours`:'The line'};
}

/** American odds as what a dollar returns, stake included: -150 → 1.667, +130 → 2.3. */
export const decimal=price=>price==null||!Number.isFinite(price)||Math.abs(price)<100?null:price>0?1+price/100:1+100/Math.abs(price);
/** A dollar's return as American odds: 2.6 → +160, 1.5 → -200. */
export const americanOf=dec=>dec==null||!(dec>1)?null:dec>=2?Math.round((dec-1)*100):-Math.round(100/(dec-1));
/** "2.43x", "3x". */
export const paysText=dec=>dec==null?'—':`${dec.toFixed(2).replace(/\.?0+$/,'')}x`;

/** Every moneyline on the board a parlay can use: both sides of each game
 * not held back (no moneyline yet, or a data warning). */
export function boardLegs(board){
 return (board?.games||[]).filter(game=>!game.held).flatMap(game=>['away','home'].map(side=>{
  const price=game.prices?.[side],chance=game.chance?.[side],dec=decimal(price);
  return dec&&chance!=null?{game:game.id,side,team:game[side],opponent:game[side==='home'?'away':'home'],home:side==='home',
   price,chance,dec,startsAt:game.startsAt,confidence:game.confidence}:null;
 }).filter(Boolean));
}

/** The most likely winners: each game's likelier side, most likely first. */
export function likeliest(board,count=5){
 const best=new Map();
 for(const leg of boardLegs(board)){const old=best.get(leg.game);if(!old||leg.chance>old.chance)best.set(leg.game,leg);}
 return [...best.values()].sort((a,b)=>b.chance-a.chance).slice(0,count);
}

/** Moneyline parlays from the board, one leg a game: exactly `legs` legs,
 * or paying at least `payout` times the stake (2 to `most` legs). The most
 * likely to hit first, or the best value (`sort` 'value'). Each:
 * {legs, dec (what a dollar returns), chance (to hit), ev (a dollar's
 * average profit)}. The games are taken as independent of each other. */
export function parlays(board,{legs=null,payout=null,sort='likely',most=4,top=3}={}){
 const pool=boardLegs(board);
 const byGame=[...new Set(pool.map(leg=>leg.game))].map(id=>pool.filter(leg=>leg.game===id));
 const sizes=legs?[legs]:Array.from({length:Math.max(0,most-1)},(_,index)=>index+2);
 const deepest=Math.max(0,...sizes),found=[];
 const walk=(start,picked,dec,chance)=>{
  if(sizes.includes(picked.length)&&(!payout||dec>=payout-1e-9))found.push({legs:picked.slice(),dec,chance,ev:chance*dec-1});
  if(picked.length>=deepest)return;
  for(let game=start;game<byGame.length;game++)for(const leg of byGame[game]){
   picked.push(leg);walk(game+1,picked,dec*leg.dec,chance*leg.chance);picked.pop();
  }
 };
 walk(0,[],1,1);
 const order=sort==='value'?(a,b)=>b.ev-a.ev||b.chance-a.chance:(a,b)=>b.chance-a.chance||b.ev-a.ev;
 return found.sort(order).slice(0,top);
}

/** The history's result for one entry: 'win', 'loss', 'push' or 'pending'. */
export function resultOf(item){
 const result=item?.result;
 if(!result)return 'pending';
 if(!result.winner)return 'push';
 return result.correct?'win':'loss';
}
