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
