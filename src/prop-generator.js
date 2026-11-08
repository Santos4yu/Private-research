// The NBA prop generator (Nov 8, the owner: "a prop generator that does a
// full analysis rmemver our mlb props that would generate good props that's
// what I want to but for nba"): tonight's NBA props graded the way the Props
// tab grades them, the ones worth playing picked out, each with the reasons
// in plain words, and the best slips made from them.
//
//  - Each line's chance to go over: props-grade.js (the prop model on his
//    recent games and role, the matchup, tonight's spread, what results have
//    taught it), against the chance it needs (50% for a regular line).
//  - The matchup: nba-matchup-score.js's 0-100 score and the reads behind it
//    (how the opponent defends his position, who's out on both sides, pace...).
//  - His record at the line: the last 5, 10, 20 games and the season.
// Overs only (the owner's rule for anything that builds picks), regular
// lines only (PrizePicks' slip payouts are for those), one line a player.
import {propGrades} from './props-grade.js';
import {spreadScores} from './nba-matchup-score.js';
import {windowGames, windowRate} from './unified-finder-data.js';

// PrizePicks' Power Play payouts (as smart-slip.js POWER): picks -> times the entry.
export const PAYOUTS = {2: 3, 3: 6, 4: 10, 5: 20, 6: 37.5};
// A game starting sooner than this is too close to pick (as smart-slip.js).
const LOCK_MINUTES = 10;
// The tiers worth a pick, best first (props-grade.js / slip-check.js TIERS).
export const PICK_TIERS = ['elite', 'strong', 'lean'];
// How many props the slips are made from, and at most this many legs a game.
const SLIP_POOL = 12, PER_GAME = 2;

const finite = value => typeof value === 'number' && Number.isFinite(value);
const STAT_WORDS = {player_points: 'points', player_rebounds: 'rebounds', player_assists: 'assists', player_threes: '3-pointers',
  player_points_rebounds: 'points + rebounds', player_points_assists: 'points + assists', player_points_rebounds_assists: 'points + rebounds + assists',
  player_steals: 'steals', player_blocks: 'blocks'};
export const statWords = row => STAT_WORDS[row?.marketKey] || String(row?.stat || row?.market || '').toLowerCase();

/** His record over a line in one window: {rate, hits, games}, or null. */
export function recordOf(row, key) {
  const window = row?.windows?.[key];
  const games = windowGames(window);
  return games ? {rate: windowRate(window), hits: window.hits, games} : null;
}

/** The game a line belongs to (two of a player's teammates in one game move together). */
const gameOf = row => row.gameId || row.eventId || `${row.awayTeamAbbr || ''}@${row.homeTeamAbbr || ''}:${String(row.startsAt || '').slice(0, 10)}` || row.teamAbbr;

/**
 * The props worth playing tonight, best first: [{row, grade, read, records,
 * score}]. `grades` and `reads` can be passed in (already worked out by the
 * page); otherwise they're worked out here from the rows and league numbers.
 */
export function generateProps(rows, league, {now = Date.now(), grades = null, reads = null, most = 25} = {}) {
  if (!league || !rows?.length) return [];
  const graded = grades || propGrades(rows, league);
  const scored = reads || spreadScores(rows, league);
  const best = new Map();
  for (const row of rows) {
    if (String(row.modifier || 'standard').toLowerCase() !== 'standard' || row.promo) continue;
    const starts = Date.parse(row.startsAt || '');
    if (Number.isFinite(starts) && starts - now < LOCK_MINUTES * 60000) continue;
    const grade = graded.get(row.id);
    if (!grade || !PICK_TIERS.includes(grade.tier) || !finite(grade.chance) || grade.edge <= 0) continue;
    const read = scored.get(row.id) || null;
    // Tier first, then how far past what it needs, then the matchup.
    const score = grade.rank * 100 + grade.edge * 100 + ((read?.score ?? 50) - 50) * 0.1;
    const item = {row, grade, read, score, records: {l5: recordOf(row, 'l5'), l10: recordOf(row, 'l10'), l20: recordOf(row, 'l20'), season: recordOf(row, 'season')}};
    const key = row.playerId || row.player;
    if (!best.has(key) || best.get(key).score < score) best.set(key, item);
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, most);
}

const pctText = value => `${Math.round(value * 100)}%`;
const lineText = row => `${row.line} ${statWords(row)}`;

/**
 * The reasons for one prop in plain words: [{key, title, text, tone}].
 * The model's chance and what it needs; his record and average at the line;
 * the matchup score and its biggest reads; tonight's game.
 */
export function analysisOf(item) {
  const {row, grade, read, records} = item;
  const out = [];
  const needs = grade.needs ?? 0.5;
  out.push({key: 'chance', title: 'The model', tone: grade.edge >= 0.08 ? 'up' : undefined,
    text: `Our model has ${row.player} over ${lineText(row)} about ${pctText(grade.chance)} of the time, ${Math.round(grade.edge * 100)} points better than ${needs === 0.5 ? 'even' : `the ${pctText(needs)} it needs`}. A PrizePicks slip pays for itself from about 55-58% a pick, depending on its size.`});
  const form = [];
  const recent = records.l10 || records.l5;
  if (recent) form.push(`over this line in ${recent.hits} of his last ${recent.games}`);
  if (records.season && records.season.games >= 10) form.push(`${Math.round(records.season.rate)}% of his games this season`);
  const average = finite(row.windows?.l10?.average) ? row.windows.l10.average : finite(row.average) ? row.average : null;
  if (form.length || average != null) {
    const said = form.length ? `He's gone ${form.join(' and ')}.` : '';
    const avg = average != null ? ` He's averaging ${Math.round(average * 10) / 10} ${statWords(row)} over his last 10${average > row.line ? ', above the line' : ', under the line'}.` : '';
    out.push({key: 'form', title: 'His form', tone: (records.l10?.rate ?? 50) >= 60 ? 'up' : (records.l10?.rate ?? 50) <= 40 ? 'down' : undefined, text: `${said}${avg}`.trim()});
  }
  if (read) {
    const top = [...(read.reads || [])].filter(part => part.text && Math.abs(part.points || 0) >= 0.5)
      .sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, 3);
    const opponent = row.opponent ? ` against ${row.opponent}` : '';
    out.push({key: 'matchup', title: 'The matchup', tone: read.score >= 60 ? 'up' : read.score < 40 ? 'down' : undefined,
      text: `A ${read.score} matchup${opponent} (${String(read.label || '').toLowerCase()}; 50 is even).`,
      points: top.map(part => ({text: part.text, tone: part.points > 0 ? 'up' : 'down'}))});
  }
  if (grade.blowout) {
    const spread = grade.blowout.spread;
    out.push({key: 'game', title: 'Tonight\'s game', tone: grade.blowout.role === 'starter' ? 'down' : 'up',
      text: grade.blowout.role === 'starter'
        ? `His team is ${spread < 0 ? 'favored' : 'an underdog'} by ${Math.abs(spread)}: a blowout could cut a starter's minutes late. It's in the chance above.`
        : `A ${Math.abs(spread)}-point spread: if it gets out of hand, bench players get more minutes. It's in the chance above.`});
  }
  return out;
}

/**
 * The best slip of each size from the top props: [{size, payout, legs,
 * chance, value}], where chance is every leg hitting (taken as independent)
 * and value what a dollar returns on average. At most two legs a game.
 */
export function bestSlips(items, sizes = [2, 3, 4, 5, 6]) {
  const pool = (items || []).slice(0, SLIP_POOL);
  const out = [];
  for (const size of sizes) {
    const payout = PAYOUTS[size];
    if (!payout || pool.length < size) continue;
    let best = null;
    const walk = (start, picked, chance, games) => {
      if (picked.length === size) {
        const value = chance * payout - 1;
        if (!best || value > best.value) best = {size, payout, legs: picked.slice(), chance, value};
        return;
      }
      for (let index = start; index <= pool.length - (size - picked.length); index++) {
        const item = pool[index], game = gameOf(item.row);
        if ((games.get(game) || 0) >= PER_GAME) continue;
        games.set(game, (games.get(game) || 0) + 1);
        picked.push(item);
        walk(index + 1, picked, chance * item.grade.chance, games);
        picked.pop();
        games.set(game, games.get(game) - 1);
      }
    };
    walk(0, [], 1, new Map());
    if (best) out.push(best);
  }
  return out;
}
