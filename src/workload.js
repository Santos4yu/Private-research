// Is he being held back today? Two ways of knowing, on every pick.
//
// His own games: a player back from weeks out is often brought back slowly
// (a back on a snap count, a guard on a minutes limit, a starter on a pitch
// count), and his recent hit rates come from before he was hurt, at his
// full workload. So a long gap in his game log, against his league's
// schedule, marks his first game back, and after it his work since (the
// game log's `usage`: an NFL player's passes, carries and targets, minutes,
// ice time, pitches) against what it was before he was out.
//
// The injury report: its note may say so outright (slip_games.py reads it
// into `limit`, {kind, cleared, date}, on his own entry), whether or not
// he's been out.
//
// Both become news facts on the pick (kind 'news'), for the Slip Analyzer,
// the Parlay Builder and the Scout Assistant alike. Held back on an Over
// is Risky at best (newsCap): it never makes a built slip.
import {newsOf} from './slip-games.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const DAY = 86400000;
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const round = value => Math.round(value * 10) / 10;
const SUFFIX = /^(jr|sr|ii|iii|iv|v)\.?$/i;
const lastName = name => String(name || '').split(/\s+/).filter(word => word && !SUFFIX.test(word)).at(-1) || name;

// Each league: the days between games that mean he missed some (a bye or
// a break is shorter), when its season turns over (the month a season's
// year starts in), the date by which every team has played a couple of
// games (before it, not having played yet this season says nothing), about
// when its regular season ends (a player whose last game came weeks before
// that sat out the end of it: hurt, most often), and whether the game
// log's `usage` is his own work.
const LEAGUES = {
  nfl: {gap: 21, turn: 6, settled: [8, 24], ended: [0, 4], own: true},
  cfb: {gap: 21, turn: 6, settled: [8, 14], ended: [10, 29], own: false},
  nba: {gap: 9, turn: 8, settled: [10, 1], ended: [3, 12], own: true},
  wnba: {gap: 10, turn: 0, settled: [4, 30], ended: [8, 12], own: true},
  nhl: {gap: 12, turn: 8, settled: [9, 22], ended: [3, 16], own: true},
  mlb: {gap: 16, turn: 0, settled: [3, 12], ended: [8, 28], own: true},
  soccer: {gap: 24, turn: 6, settled: [8, 1], ended: [4, 18], own: true},
};
// Missing this much of the end of last season reads as sitting it out.
const SAT_OUT = 21;
// What teams usually hold back in a player's first games back.
const EXPECTED = {nfl: 'a snap count', cfb: 'a snap count', nba: 'a minutes limit', wnba: 'a minutes limit', nhl: 'limited ice time',
  mlb: 'a pitch count', soccer: 'a minutes limit'};
// What the report's note said is held back.
const HELD = {snaps: 'a snap count', touches: 'a limited number of touches', minutes: 'a minutes limit', icetime: 'limited ice time',
  pitches: 'a pitch count', innings: 'an innings limit', workload: 'a limited workload'};

const isPitcher = row => String(row?.marketKey || '').startsWith('pitching:');
const dayOf = value => {
  const time = Date.parse(String(value || '').length === 10 ? `${value}T12:00:00Z` : value || '');
  return finite(time) ? time : null;
};
const seasonOf = (time, league) => {
  const date = new Date(time);
  return date.getUTCMonth() >= league.turn ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
};
const settledBy = (season, league) => Date.UTC(season + (league.settled[0] < league.turn ? 1 : 0), league.settled[0], league.settled[1]);
const endedBy = (season, league) => Date.UTC(season + (league.ended[0] < league.turn ? 1 : 0), league.ended[0], league.ended[1]);
const shortDate = time => new Date(time).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});
const ordinal = n => ['first', 'second', 'third'][n] || `${n + 1}th`;

/** Did the time between `before` and `after` include games he missed? */
function missed(before, after, league) {
  if (after - before >= league.gap * DAY && seasonOf(before, league) === seasonOf(after, league)) return true;
  if (seasonOf(before, league) >= seasonOf(after, league)) return false;
  // Last season to this one: once this season is well under way, or from
  // opening night when he sat out the end of last season.
  return after >= settledBy(seasonOf(after, league), league) || before < endedBy(seasonOf(before, league), league) - SAT_OUT * DAY;
}

/**
 * Is today one of his first games back from an absence? From his game
 * log's dates and today's game: null, or {gamesBack (0 = today is his first
 * game back), away (days between his games either side of the absence),
 * lastPlayed, usage: {since, before} when his league's log counts his own
 * work}.
 */
export function comeback(row, {now = Date.now()} = {}) {
  const league = LEAGUES[row?.sport];
  if (!league || (row.sport === 'mlb' && !isPitcher(row))) return null;
  const games = (row.gameLog || []).map(game => ({time: dayOf(game.date), usage: game.usage})).filter(game => game.time != null)
    .sort((a, b) => a.time - b.time);
  if (!games.length) return null;
  const today = dayOf(row.startsAt) ?? now;
  const times = [...games.map(game => game.time), today];
  // The newest absence among his last three games and today's.
  for (let back = 0; back < 3; back++) {
    const index = times.length - 1 - back;
    if (index < 1) return null;
    if (!missed(times[index - 1], times[index], league)) continue;
    const out = {gamesBack: back, away: Math.round((times[index] - times[index - 1]) / DAY), lastPlayed: times[index - 1]};
    if (back > 0 && league.own) {
      const since = mean(games.slice(index, index + back).map(game => game.usage).filter(finite));
      const before = mean(games.slice(Math.max(0, index - 5), index).map(game => game.usage).filter(finite));
      if (finite(since) && finite(before) && before > 0) out.usage = {since: round(since), before: round(before)};
    }
    return out;
  }
  return null;
}

// What a game log's `usage` counts, in words.
function workWord(row) {
  if (row.sport === 'nfl') return String(row.position || '').toUpperCase() === 'QB' ? 'passes and runs' : 'carries and targets';
  if (row.sport === 'nhl') return 'minutes on the ice';
  if (row.sport === 'mlb') return 'pitches';
  return 'minutes';
}

const fact = (text, impact, tone, level, extra = {}) => ({kind: 'news', key: 'workload', text, impact: round(impact), tone, rank: 0,
  ...(level ? {level} : {}), ...extra});

/**
 * The workload facts for a pick on `side`. On an Over, a limit from the
 * report or a first game back is `limited`/`return` (Risky at best); his
 * work down since coming back is `limited`; a game or two back with
 * nothing else known is `back` (never Elite). On an Under they help.
 */
export function workloadFacts(row, side, {now = Date.now()} = {}) {
  if (!row) return [];
  const news = newsOf(row);
  // Out is out: the status says it all.
  if (news?.self?.level === 'out') return [];
  const sign = side === 'UNDER' ? -1 : 1;
  const over = sign > 0;
  const last = lastName(row.player);
  const limit = news?.self?.limit;
  const facts = [];
  if (limit && !limit.cleared) {
    const when = limit.date ? ` (injury report, ${shortDate(dayOf(limit.date))})` : ' (injury report)';
    facts.push(fact(`${last} is expected to be on ${HELD[limit.kind] || HELD.workload} today${when}. His usual numbers don't apply`,
      -8 * sign, over ? 'down' : 'up', over ? 'limited' : null, {source: 'report'}));
  }
  const back = comeback(row, {now});
  if (back) {
    const away = back.away >= 14 ? `${Math.round(back.away / 7)} weeks` : `${back.away} days`;
    const cleared = limit?.cleared;
    if (back.gamesBack === 0) {
      if (!facts.length) {
        const expected = cleared ? 'The latest report says he has no limit, but his recent games' : `Players coming back are often on ${EXPECTED[row.sport]}, and his recent games`;
        facts.push(fact(`First game back: ${last} hasn't played since ${shortDate(back.lastPlayed)}. ${expected} are from before he was out`,
          (cleared ? -3 : -7) * sign, over ? 'down' : 'up', over ? (cleared ? 'back' : 'return') : null, {source: 'log'}));
      }
    } else {
      const which = `${ordinal(back.gamesBack)} game back`;
      const {since, before} = back.usage || {};
      const ratio = finite(since) && finite(before) ? since / before : null;
      if (ratio != null && ratio < 0.75 && !cleared) {
        if (!facts.length) {
          facts.push(fact(`${last}'s workload is down since he came back from ${away} out: ${since} ${workWord(row)} a game since, ${before} before. Today is his ${which}`,
            -6 * sign, over ? 'down' : 'up', over ? 'limited' : null, {source: 'log'}));
        }
      } else if (ratio != null && ratio >= 0.9) {
        facts.push(fact(`${last} is back to his usual work since returning from ${away} out (${since} ${workWord(row)} a game, ${before} before)`, 0, 'flat', null, {source: 'log'}));
      } else if (!facts.length) {
        facts.push(fact(`Today is ${last}'s ${which} after ${away} out. Teams often still ease players back`,
          -2 * sign, 'warn', over && back.gamesBack === 1 ? 'back' : null, {source: 'log'}));
      }
    }
  }
  if (limit?.cleared && !back) {
    facts.push(fact(`The latest injury report says ${last} has no workload limit`, 0, 'flat', null, {source: 'report'}));
  }
  return facts;
}

/** A short tag for a player's comeback, for the Finder ("1st game back"), or null. */
export function comebackTag(row, options) {
  const back = comeback(row, options);
  if (!back) return null;
  return {text: back.gamesBack === 0 ? '1st game back' : `${back.gamesBack + 1}${back.gamesBack === 1 ? 'nd' : 'rd'} game back`,
    title: `Back from ${back.away >= 14 ? `${Math.round(back.away / 7)} weeks` : `${back.away} days`} out (last game before it ${shortDate(back.lastPlayed)}). Players coming back are often held back`};
}
