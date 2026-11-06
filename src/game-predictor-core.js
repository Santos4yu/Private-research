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

/** A local date as the server's day key: "20261106". */
export const dayKey=date=>`${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
const midnight=date=>{const day=new Date(date);day.setHours(0,0,0,0);return day;};

/** The generator's days, today and the next ones: {key, top: "Today" / "Tomorrow" / "Sat", date: "Nov 8"}. */
export function dayOptions(now=new Date(),count=7){
 return Array.from({length:count},(_,offset)=>{
  const day=midnight(now);day.setDate(day.getDate()+offset);
  return {key:dayKey(day),top:offset===0?'Today':offset===1?'Tomorrow':day.toLocaleDateString('en-US',{weekday:'short'}),
   date:day.toLocaleDateString('en-US',{month:'short',day:'numeric'})};
 });
}

/** A start time's day in words: "Today", "Tomorrow", "Sunday, Nov 9". */
export function dayLabel(iso,now=new Date()){
 const time=Date.parse(iso||'');
 if(!Number.isFinite(time))return 'Later';
 const days=Math.round((midnight(new Date(time))-midnight(now))/864e5);
 if(days===0)return 'Today';
 if(days===1)return 'Tomorrow';
 return new Date(time).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});
}

/** "7:30 PM". */
export const clockText=iso=>{const time=Date.parse(iso||'');return Number.isFinite(time)?new Date(time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'';};

/** The slate's games by day, soonest first: [{key, label, games}]. */
export function groupByDay(games,now=new Date()){
 const days=new Map();
 for(const game of [...(games||[])].sort((a,b)=>String(a.startsAt).localeCompare(String(b.startsAt)))){
  const time=Date.parse(game.startsAt||'');
  const key=Number.isFinite(time)?dayKey(new Date(time)):'later';
  if(!days.has(key))days.set(key,{key,label:dayLabel(game.startsAt,now),games:[]});
  days.get(key).games.push(game);
 }
 return [...days.values()];
}

/** Boards from several leagues as one (the generator's "Both"). */
export const mergeBoards=boards=>({games:boards.flatMap(board=>(board?.games||[]).map(game=>({...game,sport:game.sport||board.sport})))});

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
   price,chance,dec,startsAt:game.startsAt,confidence:game.confidence,sport:game.sport}:null;
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

/** A chance as a market price: 0.634 → "63¢". */
export const cents=chance=>chance==null||!Number.isFinite(chance)?'—':`${Math.round(chance*100)}¢`;
/** What a stake wins at a moneyline (stake back not included). */
export const winOf=(stake,price)=>{const dec=decimal(price);return dec&&stake>0?stake*(dec-1):null;};
/** "$32", "$1,250.50", "+$32", "−$20". */
export function moneyText(value,signed=false){
 if(value==null||!Number.isFinite(value))return '—';
 const round=Math.round(Math.abs(value)*100)/100;
 const text=round.toLocaleString('en-US',{minimumFractionDigits:Number.isInteger(round)?0:2,maximumFractionDigits:2});
 return `${value<0?'−':signed&&value>0?'+':''}$${text}`;
}

/** One side's chance over time: [[t, home chance]] read from `side`'s view. */
export const sideSeries=(points,side)=>(points||[]).map(([t,home])=>[t,side==='home'?home:1-home]);

/** The chart's frame: the time span and a chance range around the data
 * (at least 10 points wide, inside 0-100%), and the y lines to draw. */
export function chartFrame(series,extra=[]){
 const all=series.flat();
 const times=all.map(point=>point[0]),values=[...all.map(point=>point[1]),...extra.filter(Number.isFinite)];
 if(!times.length)return null;
 let low=Math.min(...values),high=Math.max(...values);
 const pad=Math.max(0.02,(high-low)*0.15);low-=pad;high+=pad;
 if(high-low<0.1){const mid=(high+low)/2;low=mid-0.05;high=mid+0.05;}
 low=Math.max(0,low);high=Math.min(1,high);
 const step=high-low>0.4?0.2:high-low>0.2?0.1:0.05;
 const lines=[];for(let value=Math.ceil(low/step)*step;value<=high+1e-9;value+=step)lines.push(Math.round(value*100)/100);
 return {start:Math.min(...times),end:Math.max(...times),low,high,lines};
}

/** An SVG path for a series in a w x h box (a step line: a price holds until it moves). */
export function chartPath(series,frame,w,h){
 if(!series?.length||!frame)return '';
 const x=t=>frame.end===frame.start?w:(t-frame.start)/(frame.end-frame.start)*w;
 const y=v=>h-(v-frame.low)/(frame.high-frame.low)*h;
 let path='';
 series.forEach(([t,v],index)=>{
  const px=x(t).toFixed(1),py=y(v).toFixed(1);
  path+=index===0?`M${px} ${py}`:`H${px}V${py}`;
 });
 return path+`H${w}`;
}

/** The history's result for one entry: 'win', 'loss', 'push' or 'pending'. */
export function resultOf(item){
 const result=item?.result;
 if(!result)return 'pending';
 if(!result.winner)return 'push';
 return result.correct?'win':'loss';
}

// ------------------------------------------------------------------ the game page's colors and words

const rgbOf=hex=>/^[0-9a-f]{6}$/i.test(hex||'')?[0,2,4].map(index=>parseInt(hex.slice(index,index+2),16)):null;
/** How far apart two colors look ("redmean" distance, 0 to about 765). */
export function colorGap(one,two){
 const a=rgbOf(one),b=rgbOf(two);
 if(!a||!b)return Infinity;
 const mean=(a[0]+b[0])/2,[r,g,bl]=[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
 return Math.sqrt((2+mean/256)*r*r+4*g*g+(2+(255-mean)/256)*bl*bl);
}
const tooDark=hex=>{const c=rgbOf(hex);return !c||0.2126*c[0]+0.7152*c[1]+0.0722*c[2]<18;};
/** Both teams' colors (hex, no "#"), never two that look alike (Nov 6: ATL
 * and WSH are both red): the away team takes its second color, else the
 * home team does, else the away team is a light gray. */
export function pairColors(home,away){
 const h=rgbOf(home?.color)?home.color:null,a=rgbOf(away?.color)?away.color:null;
 if(!h||!a||colorGap(h,a)>=150)return {home:h,away:a};
 if(!tooDark(away?.alt)&&colorGap(away.alt,h)>=150)return {home:h,away:away.alt};
 if(!tooDark(home?.alt)&&colorGap(home.alt,a)>=150)return {home:home.alt,away:a};
 return {home:h,away:'a3a3a3'};
}

/** The injuries that matter: in the NBA a player worth a point or more to
 * his team (out or questionable); in the NFL a QB, RB, WR or TE out or
 * doubtful. {shown, others}: the rest are only counted. */
export function keyInjuries(rows,sport){
 const list=rows||[];
 const matters=sport==='nfl'
  ?player=>(player.out||/doubtful/i.test(player.status||''))&&['QB','RB','WR','TE'].includes(String(player.position||'').toUpperCase())
  :player=>(player.impact||0)>=1;
 const shown=list.filter(matters);
 return {shown,others:list.length-shown.length};
}

/** "How to read the numbers": each term in plain words, with this game's own numbers. */
export function readGuide(prediction,chart){
 if(!prediction)return [];
 const homeNow=chart?.now?.market??prediction.market?.chance?.home??null;
 const prices=chart?.now?.moneyline||prediction.market?.moneyline||{};
 const team=side=>prediction[side]?.abbr||side;
 const chanceOf=side=>homeNow==null?null:side==='home'?homeNow:1-homeNow;
 const fav=homeNow==null?prediction.winner:homeNow>=0.5?'home':'away',dog=fav==='home'?'away':'home';
 const pays=price=>price<0?`you risk $${Math.abs(Math.round(price))} to win $100`:`$100 wins $${Math.round(price)}`;
 const rows=[];
 if(homeNow!=null)rows.push({term:'The % and the ¢ price',
  text:`They're the same number: the chance to win. ${team(fav)} at ${cents(chanceOf(fav))} means the betting market expects ${team(fav)} to win about ${Math.round(chanceOf(fav)*100)} times out of 100.`});
 if(prices[fav]!=null&&prices[dog]!=null){
  const favPrice=prices[fav],dogPrice=prices[dog];
  rows.push({term:`Moneyline (${odds(favPrice)} / ${odds(dogPrice)})`,
   text:`Minus means favorite, plus means underdog. ${team(fav)} ${odds(favPrice)}: ${pays(favPrice)}. ${team(dog)} ${odds(dogPrice)}: ${pays(dogPrice)}.`});
  const favWin=winOf(10,favPrice),dogWin=winOf(10,dogPrice);
  rows.push({term:'What $10 pays',
   text:`$10 on ${team(fav)} wins ${moneyText(favWin)} (${moneyText(10+favWin)} back). $10 on ${team(dog)} wins ${moneyText(dogWin)} (${moneyText(10+dogWin)} back). The favorite wins more often, so it pays less.`});
 }
 const side=prediction.winner,ours=prediction.chance?.[side],theirs=chanceOf(side);
 if(ours!=null&&theirs!=null){
  const gap=Math.round((ours-theirs)*100);
  rows.push({term:'Our pick against the price',
   text:`We give ${team(side)} ${pct(ours)}; the price says ${pct(theirs)}. ${gap>=2?'Ours is higher, so the price is good value.':gap<=-2?'Ours is lower: the right team, but a steep price for it.':'About the same: a fair price, no real edge either way.'}`});
 }
 rows.push({term:'Value',text:'What a $1 pick is worth on average at this price, using our chance. Green (above zero) is a good price; red means paying more than it\'s worth. It\'s an average over many games, not a promise for one.'});
 rows.push({term:'Confidence',text:'How much to trust our number. High: a clear favorite, and our model and the betting line agree. Medium: a favorite, not a lock. Low: close to a coin flip, our model and the line disagree, or the data has gaps.'});
 const market=prediction.market||{};
 if(market.spread!=null&&Math.abs(market.spread)>0){
  const by=Math.abs(market.spread),favored=market.spread<0?'home':'away',other=favored==='home'?'away':'home';
  rows.push({term:'Spread',text:`How many points the favorite should win by. ${team(favored)} −${by}: ${team(favored)} has to win by more than ${by}. ${team(other)} +${by}: ${team(other)} can lose by less than that, or win.`});
 }
 if(market.total!=null)rows.push({term:'Total',text:`Both teams' points added up. The line is ${market.total}: over if they score more together, under if less.`});
 return rows;
}

/** Since when (epoch seconds) the market's chance has sat where it is now, within a fifth of a point. */
export function steadySince(series,tolerance=0.002){
 if(!series?.length)return null;
 const last=series[series.length-1][1];
 let since=series[series.length-1][0];
 for(let index=series.length-1;index>=0;index--){if(Math.abs(series[index][1]-last)>tolerance)break;since=series[index][0];}
 return since;
}
const sinceText=(seconds,now)=>{
 const date=new Date(seconds*1000),today=new Date(now);
 const clock=date.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
 const days=Math.round((new Date(today).setHours(0,0,0,0)-new Date(date).setHours(0,0,0,0))/864e5);
 return days===0?clock:days===1?`yesterday ${clock}`:`${date.toLocaleDateString('en-US',{weekday:'short'})} ${clock}`;
};
/** The line under a game's chart before it starts (Nov 6, the owner: "why
 * are the lines just flat?"): whose price it is, and where the favorite's
 * moneyline opened against now, or how long it hasn't moved. */
export function marketNote(chart,prediction,now=Date.now()){
 if(!chart||chart.state!=='pre')return null;
 const book=chart.source==='draftkings'?'DraftKings':prediction?.market?.provider||null;
 const prices=chart.now?.moneyline,open=chart.open?.moneyline;
 const side=(chart.now?.market??prediction?.market?.chance?.home??0.5)>=0.5?'home':'away';
 const team=prediction?.[side]?.abbr||'';
 let detail=null;
 if(open&&prices&&prices[side]!=null&&open[side]!==prices[side])detail=`${team} opened ${odds(open[side])}, now ${odds(prices[side])}`;
 else if(open&&prices)detail='no change since it opened';
 else{
  const series=chart.market||[],since=steadySince(series);
  if(series.length>=2&&since!=null&&now/1000-since>=1800)detail=`no change since ${sinceText(since,now)}`;
 }
 return [book,detail].filter(Boolean).join(' · ')||null;
}

/** Text color for a label filled with a team's color (hex, no "#"): dark on light colors, white on the rest. */
export function inkOn(hex){
 const c=rgbOf(hex);
 if(!c)return '#ffffff';
 // The label is the color mixed 82% with white.
 const [r,g,b]=c.map(value=>value*0.82+255*0.18);
 return 0.2126*r+0.7152*g+0.0722*b>165?'#141414':'#ffffff';
}
