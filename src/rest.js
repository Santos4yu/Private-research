// Rest from a team's game times near today (league.rest, context.rest_table).
// Days are the US Eastern calendar's, as the schedule is played. The slip
// grader (slip-matchup.js) and the NBA player page's Rest card read it.
const EASTERN = 5 * 3600000;
const eastDay = time => new Date(time - EASTERN).toISOString().slice(0, 10);
const noon = time => Date.parse(`${eastDay(time)}T12:00:00Z`);
// Calendar days from each game to this one: 1 is the night before, -1 the night after.
function gaps(dates, startsAt) {
  const start = Date.parse(startsAt || '');
  if (!Number.isFinite(start) || !dates?.length) return null;
  const today = noon(start);
  return dates.map(date => Date.parse(date)).filter(Number.isFinite).map(time => Math.round((today - noon(time)) / 86400000));
}
/** The last game before this one: {days, backToBack, threeInFour}, or null. */
export function restBefore(dates, startsAt) {
  const days = (gaps(dates, startsAt) || []).filter(gap => gap > 0).sort((a, b) => a - b);
  if (!days.length) return null;
  return {days: days[0], backToBack: days[0] === 1, threeInFour: days.filter(gap => gap <= 3).length >= 2};
}
/** Days until the next game after this one (1: plays again tomorrow), or null. */
export function nextGameIn(dates, startsAt) {
  const days = (gaps(dates, startsAt) || []).filter(gap => gap < 0).map(gap => -gap).sort((a, b) => a - b);
  return days.length ? days[0] : null;
}
