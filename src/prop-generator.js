// The NBA prop generator (Nov 8, the owner: "a prop generator that does a
// full analysis rmemver our mlb props that would generate good props that's
// what I want to but for nba"): tonight's NBA props graded the way the Props
// tab grades them, the ones worth playing picked out, and the best slips
// made from them. Each candidate's game is then read in full and called a
// play or a pass (prop-gameread.js).
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
import {lineupRole} from './lineup-role.js';

// PrizePicks' Power Play payouts (as smart-slip.js POWER): picks -> times the entry.
export const PAYOUTS = {2: 3, 3: 6, 4: 10, 5: 20, 6: 37.5};
// A game starting sooner than this is too close to pick (as smart-slip.js).
const LOCK_MINUTES = 10;
// The tiers worth a pick, best first (props-grade.js / slip-check.js TIERS).
export const PICK_TIERS = ['elite', 'strong', 'lean'];
// How many props the slips are made from, and at most this many legs a game.
const SLIP_POOL = 12, PER_GAME = 2;
// The stats it picks from (Nov 8, the owner: "its going for bench players and
// i want like points PRA PA PR assist rebounds things like that and less
// blocks steal"): the main ones; 3-pointers too, a little behind them.
// Blocks and steals (one or two plays decide them) are left out.
export const MAIN_MARKETS = ['player_points', 'player_rebounds', 'player_assists', 'player_points_rebounds', 'player_points_assists',
  'player_points_rebounds_assists'];
const MARKET_WEIGHT = {player_threes: -3};
const MARKETS = new Set([...MAIN_MARKETS, 'player_threes']);
// Players in the heart of the rotation only: 28+ minutes a game over his
// last 10, or a starter on 22+ (a starter with a light load still starts);
// without the rotation, 26+.
export const MINUTES = {any: 28, starter: 22, unknown: 26};
// The smallest line it takes (Nov 8, the owner on a board of "Over 1.5
// assists" and "Over 7.5 points": "is this really the best we can do"): a
// line that low is one pass or one shot either way, and it's a role player's.
export const MIN_LINE = {player_points: 11.5, player_rebounds: 4.5, player_assists: 3.5, player_points_rebounds: 14.5,
  player_points_assists: 14.5, player_points_rebounds_assists: 19.5, player_threes: 2.5};
// What it takes of his record and his average: over the line in at least
// this share of his games (blended, below), and averaging over it lately.
export const FORM_FLOOR = 0.55;
// Confidence (0-100): how many of the four reads back the over, and how
// strongly. The model's chance counts most; his record at the line next;
// then the matchup; then how far his average clears the line.
export const CONFIDENCE = {model: 0.35, form: 0.30, matchup: 0.20, cushion: 0.15};

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

/**
 * His record over the line, blended: the last 10 (35%), last 20 (25%) and
 * season (40%), each pulled toward 50/50 by three games either way, so a
 * 4-for-5 start isn't read as 80%. Null with no games.
 */
export function formRate(records) {
  let sum = 0, weight = 0;
  for (const [key, share] of [['l10', 0.35], ['l20', 0.25], ['season', 0.40]]) {
    const record = records?.[key];
    if (!record?.games) continue;
    sum += share * (record.hits + 3) / (record.games + 6);
    weight += share;
  }
  return weight ? sum / weight : null;
}

/** His average over his last 10 games in the stat, or null. */
export function averageOf(row) {
  if (finite(row?.windows?.l10?.average)) return row.windows.l10.average;
  if (finite(row?.average)) return row.average;
  const games = (row?.gameLog || []).filter(game => finite(game.value)).slice(-10);
  return games.length ? games.reduce((sum, game) => sum + game.value, 0) / games.length : null;
}

const clamp = value => Math.max(0, Math.min(100, value));
/**
 * Each read as 0-100 and the confidence from them: the model (62%+ is
 * 100), his record (75%+ is 100), the matchup (90+ is 100, 40 or less 0),
 * his average over the line (20% over is 100).
 */
export function signalsOf({chance, form, matchup, average, line}) {
  const signals = {model: clamp((chance - 0.5) / 0.12 * 100), form: form == null ? 50 : clamp((form - 0.5) / 0.25 * 100),
    matchup: clamp(((matchup ?? 50) - 40) / 50 * 100), cushion: average == null || !line ? 50 : clamp((average - line) / line / 0.2 * 100)};
  const confidence = Math.round(Object.entries(CONFIDENCE).reduce((sum, [key, share]) => sum + share * signals[key], 0));
  return {signals, confidence};
}

/** His minutes a game over his last 10 played (an NBA game log's `usage`), or null. */
export function minutesOf(row) {
  const played = (row?.gameLog || []).filter(game => finite(game.usage) && game.usage > 0).slice(-10);
  return played.length ? played.reduce((sum, game) => sum + game.usage, 0) / played.length : null;
}

/** Whether he's in the heart of the rotation (MINUTES). */
export function rotationRegular(row, league) {
  const role = lineupRole(row, league), minutes = minutesOf(row);
  if (minutes == null) return Boolean(role?.starter);
  if (minutes >= MINUTES.any) return true;
  if (role) return role.starter && minutes >= MINUTES.starter;
  return minutes >= MINUTES.unknown;
}

/** The game a line belongs to (two of a player's teammates in one game move together). */
const gameOf = row => row.gameId || row.eventId || `${row.awayTeamAbbr || ''}@${row.homeTeamAbbr || ''}:${String(row.startsAt || '').slice(0, 10)}` || row.teamAbbr;

/**
 * The props worth playing tonight, best first: [{row, grade, read, records,
 * score}]. `grades` and `reads` can be passed in (already worked out by the
 * page); otherwise they're worked out here from the rows and league numbers.
 */
export function generateProps(rows, league, {now = Date.now(), grades = null, reads = null, most = 25, strict = true} = {}) {
  if (!league || !rows?.length) return [];
  const graded = grades || propGrades(rows, league);
  const scored = reads || spreadScores(rows, league);
  const best = new Map();
  for (const row of rows) {
    if (String(row.modifier || 'standard').toLowerCase() !== 'standard' || row.promo || !MARKETS.has(row.marketKey)) continue;
    if (!(Number(row.line) >= (MIN_LINE[row.marketKey] ?? 0))) continue;
    if (!rotationRegular(row, league)) continue;
    const starts = Date.parse(row.startsAt || '');
    if (Number.isFinite(starts) && starts - now < LOCK_MINUTES * 60000) continue;
    const grade = graded.get(row.id);
    if (!grade || !finite(grade.chance)) continue;
    // Not strict (prop-gameread.js deepCandidates): any graded line, for the full read to judge.
    if (strict && (!PICK_TIERS.includes(grade.tier) || grade.edge <= 0)) continue;
    const read = scored.get(row.id) || null;
    const records = {l5: recordOf(row, 'l5'), l10: recordOf(row, 'l10'), l20: recordOf(row, 'l20'), season: recordOf(row, 'season')};
    const form = formRate(records), average = averageOf(row);
    // His record and his average have to back the model up.
    if (strict && form != null && form < FORM_FLOOR) continue;
    if (strict && average != null && average <= row.line) continue;
    const {signals, confidence} = signalsOf({chance: grade.chance, form, matchup: read?.score, average, line: row.line});
    const score = confidence + (MARKET_WEIGHT[row.marketKey] || 0);
    const games = (row.gameLog || []).filter(game => finite(game.value)).slice(-10).map(game => ({value: game.value, opponent: game.opponent, date: game.date}));
    const item = {row, grade, read, score, confidence, signals, form, average, games, records, role: lineupRole(row, league), minutes: minutesOf(row)};
    const key = row.playerId || row.player;
    if (!best.has(key) || best.get(key).score < score) best.set(key, item);
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, most);
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
