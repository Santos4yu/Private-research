// The admin's record in History (GameRecord.jsx): the small pieces of text
// and the day-by-day chart's numbers, kept apart so they can be tested.

const finite=value=>typeof value==='number'&&Number.isFinite(value);

/** "12-5" from a tally ({wins, losses} or {hits, misses}); "—" with nothing in it. */
export function recordText(tally){
 if(!tally)return '—';
 const won=tally.wins??tally.hits??0,lost=tally.losses??tally.misses??0;
 return won+lost?`${won}-${lost}`:'—';
}

/** How many decided in a tally. */
export const decidedOf=tally=>tally?(tally.wins??tally.hits??0)+(tally.losses??tally.misses??0):0;

/** Its hit rate, 0-1, or null. */
export function rateOf(tally){
 const decided=decidedOf(tally);
 return decided?(tally.wins??tally.hits??0)/decided:null;
}

/** "Nov 7" from "2026-11-07". */
export function shortDay(day){
 const time=Date.parse(`${day}T12:00:00Z`);
 return Number.isFinite(time)?new Date(time).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}):'';
}

/**
 * The day-by-day chart, oldest first: the last `count` days with games,
 * each {day, wins, losses, units, up, down} where up and down are its wins
 * and losses as a share of the busiest day's, so the tallest bar fills its
 * half of the chart.
 */
export function dayBars(days,count=30){
 const list=(days||[]).filter(day=>day&&decidedOf(day)>0).slice(0,count).reverse();
 const most=Math.max(1,...list.map(day=>Math.max(day.wins??day.hits??0,day.losses??day.misses??0)));
 return list.map(day=>{
  const wins=day.wins??day.hits??0,losses=day.losses??day.misses??0;
  return {day:day.day,wins,losses,units:finite(day.units)?day.units:null,up:wins/most,down:losses/most};
 });
}

/** A game the record kept, as a row: {team, against, result: 'win'|'loss'|'push'|null, score}. */
export function gameRow(entry){
 const team=entry.side==='home'?entry.home:entry.away,against=entry.side==='home'?entry.away:entry.home;
 const result=entry.result?(entry.result.winner==null?'push':entry.result.correct?'win':'loss'):null;
 return {team,against,result,score:entry.result?`${entry.away} ${entry.result.away}-${entry.result.home} ${entry.home}`:null};
}

// ---------------------------------------------------------------- by date (Nov 12)
// The owner: "organize these and add dates and use a date chart to show the
// props and record for that day wether it's for nfl or nba or both sports".

const pad=value=>String(value).padStart(2,'0');
/** "2026-11-11" for a Date, in the viewer's own calendar. */
export const dayKey=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;

/** A month's calendar, Sunday first: 6 weeks of {day, date, inMonth}. */
export function monthGrid(year,month){
 const first=new Date(year,month,1),start=new Date(year,month,1-first.getDay());
 return Array.from({length:42},(_,index)=>{const date=new Date(start.getFullYear(),start.getMonth(),start.getDate()+index);
  return {day:dayKey(date),date:date.getDate(),inMonth:date.getMonth()===month};});
}

/** Tallies added up (wins/losses or hits/misses, pushes and units where given). */
export function mergeTally(...tallies){
 const out={wins:0,losses:0,pushes:0,units:null};
 for(const tally of tallies){
  if(!tally)continue;
  out.wins+=tally.wins??tally.hits??0;out.losses+=tally.losses??tally.misses??0;out.pushes+=tally.pushes??0;
  if(finite(tally.units))out.units=Math.round(((out.units||0)+tally.units)*100)/100;
 }
 return out;
}

/** Each day's tally across lists of {day, ...tally}: {day: tally}. */
export function dayTallies(...lists){
 const out={};
 for(const list of lists)for(const entry of list||[])if(entry?.day)out[entry.day]=mergeTally(out[entry.day],entry);
 return out;
}

/** How a day went: 'up' (more right), 'down' (more wrong), 'even', or null with nothing decided. */
export function dayTone(tally){
 const won=tally?.wins??tally?.hits??0,lost=tally?.losses??tally?.misses??0;
 return won+lost===0?null:won>lost?'up':won<lost?'down':'even';
}

/** Items grouped by their day, newest day first: [[day, items]]. */
export function byDay(items){
 const groups=new Map();
 for(const item of items||[]){const day=item.day||'';if(!groups.has(day))groups.set(day,[]);groups.get(day).push(item);}
 return [...groups].sort((a,b)=>b[0].localeCompare(a[0]));
}

/** "Today", "Yesterday" or "Wed, Nov 11". */
export function longDay(day,today=dayKey(new Date())){
 const time=Date.parse(`${day}T12:00:00Z`);
 if(!Number.isFinite(time))return '';
 const back=Math.round((Date.parse(`${today}T12:00:00Z`)-time)/864e5);
 if(back===0)return 'Today';
 if(back===1)return 'Yesterday';
 return new Date(time).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'});
}
