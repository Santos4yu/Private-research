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
 // At the pick's own chance: our model's (Nov 8), else the blend's.
 const pick=ev?.pick||ev?.blend;
 if(!pick)return [];
 return ['away','home'].filter(side=>pick[side]).map(side=>{const row=pick[side];return {side,team:prediction[side],
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
  const price=game.prices?.[side],chance=game.chance?.[side],dec=decimal(price),market=game.market?.[side]??null;
  return dec&&chance!=null?{game:game.id,side,team:game[side],opponent:game[side==='home'?'away':'home'],home:side==='home',
   price,chance,dec,market,edge:market==null?null:chance-market,ev:chance*dec-1,startsAt:game.startsAt,confidence:game.confidence,sport:game.sport}:null;
 }).filter(Boolean));
}

/** The most likely winners: each game's likelier side, most likely first. */
/**
 * Where our model sees more than the market (Nov 8, the owner: "I want the
 * model to be the deciding factor ... I can just go to draft kings and pick
 * all the -200"): each side our model gives a better chance than the
 * market's (its moneylines with the vig taken out), the most a dollar
 * returns on average first. Either side of a game can show; the best one a game.
 */
export function valuePicks(board,count=5){
 const best=new Map();
 for(const leg of boardLegs(board)){
  if(leg.edge==null||leg.edge<=0.005||leg.ev<=0)continue;
  const old=best.get(leg.game);if(!old||leg.ev>old.ev)best.set(leg.game,leg);
 }
 return [...best.values()].sort((a,b)=>b.ev-a.ev).slice(0,count);
}
/** "+9 pts": how much higher our model has a side than the market. */
export const edgeText=edge=>edge==null||!Number.isFinite(edge)?'':`${edge>=0?'+':'−'}${Math.abs(edge*100).toFixed(0)} pts`;

/**
 * Every game on the board with our model's pick (its likelier side), most
 * likely first (Nov 9, the owner: "it should show all the games coming up and
 * show the % our model has them as"). A game still waiting on its moneyline
 * is in too, its price null; the parlays use boardLegs (priced games only).
 */
export function gamePicks(board){
 return (board?.games||[]).flatMap(game=>{
  const home=game.chance?.home,away=game.chance?.away;
  if(home==null&&away==null)return [];
  const side=(home??-1)>=(away??-1)?'home':'away';
  const raw=game.prices?.[side],price=raw!=null&&Math.abs(raw)>=100?raw:null;
  const chance=game.chance[side],dec=decimal(price),market=game.market?.[side]??null;
  return [{game:game.id,side,team:game[side],opponent:game[side==='home'?'away':'home'],home:side==='home',price,chance,dec,market,
   edge:market==null?null:chance-market,ev:dec?chance*dec-1:null,startsAt:game.startsAt,confidence:game.confidence,sport:game.sport}];
 }).sort((a,b)=>b.chance-a.chance);
}

export function likeliest(board,count=5){
 const best=new Map();
 for(const leg of boardLegs(board)){const old=best.get(leg.game);if(!old||leg.chance>old.chance)best.set(leg.game,leg);}
 return [...best.values()].sort((a,b)=>b.chance-a.chance).slice(0,count);
}

/** Moneyline parlays from the board, one leg a game: exactly `legs` legs,
 * or paying at least `payout` times the stake (2 to `most` legs). The most
 * likely to hit first, or the best value (`sort` 'value'). Each:
 * {legs, dec (what a dollar returns), chance (to hit), ev (a dollar's
 * average profit)}. The games are taken as independent of each other.
 * `mixed` (Nov 9, the owner: "a parlay between the 2 sports"): only
 * parlays with a leg from every league on the board, none with one league. */
export function parlays(board,{legs=null,payout=null,sort='likely',most=4,top=3,mixed=false}={}){
 const pool=boardLegs(board);
 const gameKey=leg=>`${leg.sport||''}:${leg.game}`;
 const byGame=[...new Set(pool.map(gameKey))].map(id=>pool.filter(leg=>gameKey(leg)===id));
 const leagues=new Set(pool.map(leg=>leg.sport||''));
 if(mixed&&leagues.size<2)return [];
 const covers=picked=>!mixed||new Set(picked.map(leg=>leg.sport||'')).size===leagues.size;
 const sizes=legs?[legs]:Array.from({length:Math.max(0,most-1)},(_,index)=>index+2);
 const deepest=Math.max(0,...sizes),found=[];
 const walk=(start,picked,dec,chance)=>{
  // "Pays 2x or more" means about that (Nov 8: ranked by value, 42x long
  // shots came first): up to three times the payout asked for.
  if(sizes.includes(picked.length)&&(!payout||(dec>=payout-1e-9&&dec<=payout*3+1e-9))&&covers(picked))found.push({legs:picked.slice(),dec,chance,ev:chance*dec-1});
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
export function chartPath(series,frame,w,h,{toEnd=true}={}){
 if(!series?.length||!frame)return '';
 const x=t=>frame.end===frame.start?w:(t-frame.start)/(frame.end-frame.start)*w;
 const y=v=>h-(v-frame.low)/(frame.high-frame.low)*h;
 let path='';
 series.forEach(([t,v],index)=>{
  const px=x(t).toFixed(1),py=y(v).toFixed(1);
  path+=index===0?`M${px} ${py}`:`H${px}V${py}`;
 });
 // A price stands until it moves, so its line runs to the edge; a game's line stops where the game is.
 return toEnd?path+`H${w}`:path;
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

/** ESPN's clock for a game on, the period first: "54.7 - 1st" -> "1st · 0:54.7", "5:32 - 2nd" -> "2nd · 5:32"; anything else as it is. */
export function liveText(detail){
 const text=String(detail||'').trim();
 const found=/^(\d{1,2}:\d{2}(?:\.\d)?|\d{1,2}(?:\.\d)?)\s*-\s*(.+)$/.exec(text);
 if(!found)return text;
 const clock=found[1].includes(':')?found[1]:`0:${found[1].padStart(found[1].includes('.')?4:2,'0')}`;
 return `${found[2]} · ${clock}`;
}

/** A time into a game as its quarter and clock: 1200 s of an NBA game -> "Q2 4:00 left"; overtime "OT 2:30 left". */
export function gameClockText(elapsed,sport){
 const [quarter,extra]=sport==='nfl'?[900,600]:[720,300];
 if(elapsed==null||!Number.isFinite(elapsed))return '';
 const regulation=4*quarter;
 const period=elapsed<regulation?Math.floor(elapsed/quarter):4+Math.floor((elapsed-regulation)/extra);
 const start=period<4?period*quarter:regulation+(period-4)*extra,length=period<4?quarter:extra;
 const left=Math.max(0,start+length-elapsed),minutes=Math.floor(left/60),seconds=Math.floor(left%60);
 const name=period<4?`Q${period+1}`:period===4?'OT':`OT${period-3}`;
 return `${name} ${minutes}:${String(seconds).padStart(2,'0')} left`;
}

// ------------------------------------------------------------------ live games
// (Nov 8, the owner, offered seven ideas for live games: "Yes add all".)

const QUARTER={nba:[720,300],nfl:[900,600]};
/** A time into a game as its period number (5 = OT) and the seconds left in it. */
export function periodLeft(elapsed,sport){
 const [quarter,extra]=QUARTER[sport]||QUARTER.nba;
 if(elapsed==null||!Number.isFinite(elapsed))return null;
 const regulation=4*quarter;
 if(elapsed<regulation){const period=Math.floor(elapsed/quarter);return {period:period+1,left:(period+1)*quarter-elapsed};}
 const over=Math.floor((elapsed-regulation)/extra);
 return {period:5+over,left:regulation+(over+1)*extra-elapsed};
}
const minutesText=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const nameOf=team=>team?.short||team?.name||team?.abbr||'';

/** The run going now: "PHX on a 9-0 run"; in the NFL "PHI has scored 17 straight". */
export function runText(run,teams,sport){
 if(!run?.side||!run.points)return '';
 const abbr=teams?.[run.side]?.abbr||'';
 return sport==='nfl'?`${abbr} has scored ${run.points} straight`:`${abbr} on a ${run.points}-0 run`;
}

const scoreOf=(chart,side)=>{const value=Number(chart?.[side]?.score);return Number.isFinite(value)?value:null;};

/** How our pick is doing: its chance before the game and now, and the score from its side. */
export function pickStatus(prediction,chart){
 const side=prediction?.winner;
 if(!side||!['in','post'].includes(chart?.state))return null;
 const other=side==='home'?'away':'home';
 const mine=scoreOf(chart,side),theirs=scoreOf(chart,other);
 const margin=mine!=null&&theirs!=null?mine-theirs:null;
 const points=chart?.clock?.points||[];
 const homeNow=chart?.now?.live??points[points.length-1]?.[1];
 const now=homeNow==null?null:side==='home'?homeNow:1-homeNow;
 const before=prediction.chance?.[side]??null;
 const score=mine!=null&&theirs!=null?`${Math.max(mine,theirs)}-${Math.min(mine,theirs)}`:'';
 if(chart.state==='post'){
  const won=margin==null?null:margin>0;
  return {side,before,now:won==null?null:won?1:0,margin,final:true,tone:won==null?undefined:won?'up':'down',
   result:won==null?'Final':won?`Won ${score}`:`Lost ${score}`};
 }
 return {side,before,now,margin,final:false,tone:margin>0?'up':margin<0?'down':undefined,
  result:margin==null?'':margin>0?`Up ${margin}`:margin<0?`Down ${-margin}`:'Tied'};
}

/**
 * The one thing worth a banner in a game, if any: a close game late ("Within
 * 3 with 2:00 left"), a comeback ("Suns were down 18, now up 2"), the
 * underdog ahead ("Underdog Rockets lead by 6"); after it, an upset.
 */
export function liveAlert(sport,chart,prediction){
 if(!chart||!['in','post'].includes(chart.state))return null;
 const home=scoreOf(chart,'home'),away=scoreOf(chart,'away');
 if(home==null||away==null)return null;
 const teams={home:prediction?.home||chart.home,away:prediction?.away||chart.away};
 const nfl=sport==='nfl';
 const before=prediction?.market?.chance;
 const underdog=before?.home!=null?(before.home<0.4?'home':before.home>0.6?'away':null):null;
 if(chart.state==='post'){
  const won=home>away?'home':away>home?'away':null;
  if(!underdog||won!==underdog)return null;
  const price=prediction?.market?.moneyline?.[underdog];
  return {kind:'upset',text:`Upset: the ${nameOf(teams[underdog])} won as ${price!=null&&price>0?`+${Math.round(price)} `:''}underdogs`};
 }
 const at=periodLeft(chart.clock?.now,sport);
 const margin=Math.abs(home-away);
 if(at&&at.period>=4&&at.left<=300&&at.left>0&&margin<=(nfl?8:5)){
  const left=minutesText(at.left);
  return {kind:'close',text:margin===0?`Tied with ${left} left`:nfl&&margin>3?`One-score game with ${left} left`:`Within ${margin} with ${left} left`};
 }
 const lead=chart.feed?.lead;
 for(const side of ['home','away']){
  const other=side==='home'?'away':'home';
  const down=lead?.[other]||0,now=(side==='home'?home-away:away-home);
  if(down>=(nfl?14:15)&&now>=-(nfl?7:5)){
   const where=now>0?`now up ${now}`:now===0?'now tied':`now within ${-now}`;
   return {kind:'comeback',text:`Comeback: the ${nameOf(teams[side])} were down ${down}, ${where}`};
  }
 }
 if(underdog&&(at?.period||1)>=2){
  const ahead=underdog==='home'?home-away:away-home;
  if(ahead>0)return {kind:'underdog',text:`Underdog ${nameOf(teams[underdog])} lead by ${ahead}`};
 }
 return null;
}

const numberText=value=>Number.isInteger(value)?String(value):value.toFixed(1).replace(/\.0$/,'');
/** One prop against its line: how far along (0 to 1), and "Needs 15", "Hit", "Missed by 3". */
export function propProgress(row,final=false){
 const now=Number(row?.now)||0,line=Number(row?.line)||0;
 const share=line>0?Math.min(1,now/line):now>0?1:0;
 if(now>line)return {share:1,hit:true,text:'Hit'};
 if(final)return now===line?{share,hit:false,text:'Push'}:{share,hit:false,miss:true,text:'Missed'};
 // A count goes over its line one at a time (26.5 with 12: 15 more; 26 with
 // 12: 15 more too); a fantasy score by tenths.
 const needs=Number.isInteger(now)?Math.floor(line-now)+1:Math.round((line-now)*10)/10;
 return {share,hit:false,text:`Needs ${numberText(needs)}`};
}

/** A small chance line for the games list: the path of one side's chance, across the game's length. */
export function sparkPath(spark,side,w,h){
 const points=spark?.points||[];
 if(points.length<2||!(spark.length>0))return '';
 return points.map(([at,home],index)=>{const chance=side==='home'?home:1-home;
  const x=Math.min(1,at/spark.length)*w,y=(1-chance)*h;
  return `${index?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`;}).join(' ');
}

/** The games list with the games on now first (the list's own live reads over the kept slate). */
export function liveFirst(games,live){
 const fresh=new Map((live?.games||[]).map(game=>[game.id,game]));
 const merged=(games||[]).map(game=>{const now=fresh.get(game.id);if(!now)return game;
  return {...game,state:now.state,detail:now.detail||game.detail,spark:now.spark,
   home:{...game.home,score:now.home?.score??game.home?.score},away:{...game.away,score:now.away?.score??game.away?.score}};});
 return {live:merged.filter(game=>game.state==='in'),rest:merged.filter(game=>game.state!=='in')};
}

// ------------------------------------------------------------------ the member's picks
// (Nov 8, the owner, with the History tab: "Now how can we make this look better".)

/** A pick's day: "Today", "Yesterday", "Sat", "Nov 6". */
export function dayText(iso,now=new Date()){
 const time=Date.parse(iso||'');
 if(!Number.isFinite(time))return '';
 const day=new Date(now);day.setHours(0,0,0,0);
 const days=Math.round((new Date(time).setHours(0,0,0,0)-day.getTime())/864e5);
 if(days===0)return 'Today';
 if(days===-1)return 'Yesterday';
 if(days===1)return 'Tomorrow';
 if(days>-7&&days<7)return new Date(time).toLocaleDateString('en-US',{weekday:'short'});
 return new Date(time).toLocaleDateString('en-US',{month:'short',day:'numeric'});
}

/**
 * The picks in three groups: on now (or just finished, waiting to be
 * settled) with the score from the pick's side and its chance now, still to
 * come (soonest first), and settled.
 */
export function historyGroups(items,live,now=Date.now()){
 const fresh=new Map((live?.games||[]).map(game=>[game.id,game]));
 const groups={live:[],upcoming:[],settled:[]};
 for(const item of items||[]){
  if(item.result){groups.settled.push(item);continue;}
  const game=fresh.get(item.id);
  const started=Date.parse(item.startsAt)<=now;
  if(!started&&!(game&&['in','post'].includes(game.state))){groups.upcoming.push(item);continue;}
  const side=item.side,other=side==='home'?'away':'home';
  const score=key=>{const value=Number(game?.[key]?.score);return game?.[key]?.score!=null&&Number.isFinite(value)?value:null;};
  const mine=score(side),theirs=score(other);
  const points=game?.spark?.points||[];
  const homeNow=points.length?points[points.length-1][1]:null;
  groups.live.push({...item,live:{state:game?.state||'in',detail:game?.detail||'',home:score('home'),away:score('away'),
   margin:mine!=null&&theirs!=null?mine-theirs:null,chance:homeNow==null?null:side==='home'?homeNow:1-homeNow}});
 }
 groups.upcoming.sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));
 return groups;
}

/** A live pick's state from its side: "Up 6", "Down 4", "Tied"; once it's over, "Won" / "Lost". */
export function pickScoreText(live){
 const margin=live?.margin;
 if(margin==null)return {text:'Live'};
 const tone=margin>0?'up':margin<0?'down':undefined;
 if(live.state==='post')return {text:margin>0?'Won':margin<0?'Lost':'Tied',tone};
 return {text:margin>0?`Up ${margin}`:margin<0?`Down ${-margin}`:'Tied',tone};
}

// ------------------------------------------------------------------ the matchup card
// (Nov 11, the owner, with PickFinder's moneyline card: "i like what
// pickfinder does with moneylines look". Its layout as a reference only:
// the win chance split, each side's price, the two teams side by side, their
// last games and who's out.)

const espnLogo=(sport,abbr)=>abbr?`https://a.espncdn.com/i/teamlogos/${sport}/500/${String(abbr).toLowerCase()}.png`:null;
const rankText=cell=>Array.isArray(cell)&&Number.isFinite(cell[1])?`#${cell[1]}`:'—';
const recordOf=spot=>spot&&Number.isFinite(spot.w)?`${spot.w}-${spot.l}`:null;
const daysText=days=>!Number.isFinite(days)?'—':days<=1?(days===1?'1 day':'Back-to-back'):`${days} days`;

/** This season's meetings: each side's wins, {away, home, games}, or null. */
export function headToHead(prediction){
 const games=prediction?.meetings||[];
 if(!games.length)return null;
 const abbr={home:prediction.home?.abbr,away:prediction.away?.abbr};
 const wins=side=>games.filter(game=>(game.home===abbr[side]&&game.hs>game.as)||(game.away===abbr[side]&&game.as>game.hs)).length;
 return {away:wins('away'),home:wins('home'),games:games.length};
}

/**
 * The two teams side by side: [{key, label, away: {text, small, better},
 * home: {...}}]. Open → now (the moneyline where it opened and now), the
 * offense and defense ranks, the last 10, home and road, rest, head to head.
 * `better` marks the side ahead on a row (a lower rank, more rest...);
 * `share` (0-1) is how strong each side is on it, for the row's meter.
 */
export function matchupRows(prediction){
 if(!prediction)return [];
 const rows=[],teams=prediction.teams||{},nfl=prediction.sport==='nfl';
 const market=prediction.market||{},prices=market.moneyline||{},open=market.open;
 const pair=(key,label,away,home,better=null)=>rows.push({key,label,away:{...away,better:better==='away'},home:{...home,better:better==='home'}});
 if(prices.home!=null||prices.away!=null){
  const share=side=>Number.isFinite(prices[side])?implied(prices[side]):null;
  if(open&&open.home!=null&&open.away!=null)pair('price','Open → now',{text:`${americanText(open.away)} → ${americanText(prices.away)}`,move:moveOf(open.away,prices.away),share:share('away')},
   {text:`${americanText(open.home)} → ${americanText(prices.home)}`,move:moveOf(open.home,prices.home),share:share('home')});
  else pair('price','Moneyline',{text:americanText(prices.away),share:share('away')},{text:americanText(prices.home),share:share('home')});
 }
 const off=nfl?'pf':'ortg',def=nfl?'pa':'drtg',count=nfl?32:30;
 const fromRank=cell=>Array.isArray(cell)&&Number.isFinite(cell[1])?Math.max(0,Math.min(1,(count+1-cell[1])/count)):null;
 const ranked=(key,label,field,unit)=>{
  const a=teams.away?.[field],h=teams.home?.[field];
  if(!a&&!h)return;
  const better=Number.isFinite(a?.[1])&&Number.isFinite(h?.[1])&&a[1]!==h[1]?(a[1]<h[1]?'away':'home'):null;
  pair(key,label,{text:rankText(a),small:Number.isFinite(a?.[0])?`${a[0]} ${unit}`:null,share:fromRank(a)},
   {text:rankText(h),small:Number.isFinite(h?.[0])?`${h[0]} ${unit}`:null,share:fromRank(h)},better);
 };
 ranked('offense','Offense',off,nfl?'pts':'per 100');
 ranked('defense','Defense',def,nfl?'allowed':'per 100');
 const l10=side=>teams[side]?.last10;
 if(l10('away')||l10('home')){
  const won=side=>l10(side)?l10(side)[0]/Math.max(1,l10(side)[0]+l10(side)[1]):null;
  pair('last10','Last 10',{text:l10('away')?l10('away').join('-'):'—',share:won('away')},{text:l10('home')?l10('home').join('-'):'—',share:won('home')},
   won('away')!=null&&won('home')!=null&&won('away')!==won('home')?(won('away')>won('home')?'away':'home'):null);
 }
 const info=prediction.homeInfo||{};
 const road=recordOf(info.away?.away),home=recordOf(info.home?.home);
 const shareOf=spot=>spot&&spot.w+spot.l>0?spot.w/(spot.w+spot.l):null;
 if(road||home)pair('venue','Home / road',{text:road?`${road} road`:'—',share:shareOf(info.away?.away)},{text:home?`${home} home`:'—',share:shareOf(info.home?.home)});
 const rest=prediction.rest||{};
 const rested=days=>Number.isFinite(days)?Math.min(days,4)/4:null;
 if(Number.isFinite(rest.home)||Number.isFinite(rest.away))pair('rest','Rest',{text:daysText(rest.away),share:rested(rest.away)},{text:daysText(rest.home),share:rested(rest.home)},
  Number.isFinite(rest.home)&&Number.isFinite(rest.away)&&rest.home!==rest.away?(rest.away>rest.home?'away':'home'):null);
 const meet=headToHead(prediction);
 if(meet)pair('h2h','Head to head',{text:`${meet.away}-${meet.home}`,share:meet.away/meet.games},{text:`${meet.home}-${meet.away}`,share:meet.home/meet.games},meet.away!==meet.home?(meet.away>meet.home?'away':'home'):null);
 return rows;
}
const americanText=price=>price==null||!Number.isFinite(price)?'—':price>0?`+${Math.round(price)}`:`${Math.round(price)}`;
// Which way a moneyline moved for its team: 'up' when it got likelier (shorter), 'down' when longer.
const implied=price=>price<0?-price/(-price+100):100/(price+100);
const moveOf=(from,to)=>!Number.isFinite(from)||!Number.isFinite(to)||from===to?null:implied(to)>implied(from)?'up':'down';

/**
 * A team's latest games, oldest first: [{opponent: {abbr, logo}, margin,
 * home}]. The NBA's last 10 from the stored season (prediction.recent);
 * otherwise ESPN's last five (lastFive, "W 27-20" own score first).
 */
export function recentGames(prediction,side){
 const sport=prediction?.sport||'nba';
 const listed=prediction?.recent?.[side];
 if(Array.isArray(listed)&&listed.length)return listed.map(game=>({opponent:{abbr:game.opponent,logo:espnLogo(sport,game.opponent)},margin:game.margin,home:game.home}));
 const abbr=prediction?.[side]?.abbr;
 const five=(prediction?.lastFive||{})[abbr]||[];
 return five.map(game=>{
  const [own,their]=String(game.score||'').split('-').map(Number);
  return Number.isFinite(own)&&Number.isFinite(their)?{opponent:{abbr:game.opponent,logo:game.opponentLogo||espnLogo(sport,game.opponent)},margin:own-their,home:game.atVs!=='@',date:game.date}:null;
 }).filter(Boolean).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
}

/** What a side has out tonight in points a game: the out ones fully, a questionable one at his chance to sit. */
export function outPoints(entries){
 return Math.round((entries||[]).reduce((sum,entry)=>sum+(Number.isFinite(entry.ppg)?entry.ppg*(entry.kind==='out'?1:entry.kind==='questionable'?(entry.chance??0.35):0):0),0)*10)/10;
}
