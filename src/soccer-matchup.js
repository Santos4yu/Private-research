// Soccer matchups: what today's opponent does to a player's stat, read off
// both teams' recent matches (soccer_research.team_log: every match's team
// stats for and against). A keeper's saves follow the shots on target the
// other side takes; a forward's shots follow the shots the other side
// gives up; passes and touches follow how much of the ball his team gets;
// tackles and clearances follow how much the other side has it.
//
// For each stat it asks one question of the opponent's recent matches --
// what teams record against them, or what they themselves produce -- and
// holds the answer against a normal team: the average over every team on
// the board (or, with too few, the two teams in the match). A handful of
// matches says little, so the ratio is pulled toward normal by how many
// are behind it.
import {statKeyOf} from './sports/soccer/soccer-stats.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const one = value => (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '');

// The team stats a profile keeps (ESPN's names; goals come off the score).
const TEAM_STATS = ['goals', 'totalShots', 'shotsOnTarget', 'possessionPct', 'totalPasses', 'accuratePasses', 'totalCrosses',
  'accurateCrosses', 'totalTackles', 'effectiveTackles', 'totalClearance', 'interceptions', 'blockedShots', 'foulsCommitted',
  'offsides', 'yellowCards', 'wonCorners', 'saves'];
// Recent matches count most: one this many matches back counts half.
const HALF_LIFE = 6;
const MATCHES = 12;
// Matches of a normal team each ratio is pulled toward.
const PULL = 6;

// A player's stat -> the team stat it follows, whose ('for': what the
// opponent produces; 'against': what teams record against the opponent),
// and how much the opponent moves it (the rest is the player himself).
const SPEC = {
  saves: ['shotsOnTarget', 'for', 0.9], sotf: ['shotsOnTarget', 'for', 0.9], gc: ['goals', 'for', 0.7],
  shots: ['totalShots', 'against', 0.8], sot: ['shotsOnTarget', 'against', 0.8], sa: ['totalShots', 'against', 0.6],
  goals: ['goals', 'against', 0.7], ast: ['goals', 'against', 0.6], ga: ['goals', 'against', 0.7],
  passAtt: ['totalPasses', 'against', 0.7], passes: ['accuratePasses', 'against', 0.7], touch: ['totalPasses', 'against', 0.6],
  cross: ['totalCrosses', 'against', 0.6], crossAcc: ['accurateCrosses', 'against', 0.6],
  tackles: ['totalTackles', 'against', 0.7], tacklesWon: ['effectiveTackles', 'against', 0.6], clear: ['totalClearance', 'against', 0.7],
  int: ['interceptions', 'against', 0.6], blk: ['blockedShots', 'against', 0.5], fouls: ['foulsCommitted', 'against', 0.5],
  fd: ['foulsCommitted', 'for', 0.5], off: ['offsides', 'against', 0.4], yc: ['yellowCards', 'against', 0.4],
};
// Which way a favorite's edge pushes the stat: more of the ball and the
// shots (+1), or more defending (-1).
const ATTACK = new Set(['shots', 'sot', 'sa', 'goals', 'ast', 'ga', 'passAtt', 'passes', 'touch', 'cross', 'crossAcc', 'off', 'fd', 'drib']);
const DEFEND = new Set(['saves', 'sotf', 'gc', 'tackles', 'tacklesWon', 'clear', 'int', 'blk', 'fouls']);
// Stats that ride on who has the ball.
const BALL = new Set(['passAtt', 'passes', 'touch', 'cross', 'crossAcc', 'tackles', 'tacklesWon', 'clear', 'int']);
const WORDS = {goals: 'goals', totalShots: 'shots', shotsOnTarget: 'shots on target', totalPasses: 'passes', accuratePasses: 'completed passes',
  totalCrosses: 'crosses', accurateCrosses: 'accurate crosses', totalTackles: 'tackles', effectiveTackles: 'tackles won',
  totalClearance: 'clearances', interceptions: 'interceptions', blockedShots: 'blocked shots', foulsCommitted: 'fouls',
  offsides: 'offsides', yellowCards: 'yellow cards'};

/** A team's recent matches as per-match averages for and against ({games, for, against}), or null. */
export function teamProfile(log, matches = MATCHES) {
  const games = (log?.games || []).slice(-matches);
  if (!games.length) return null;
  const sums = {for: {}, against: {}};
  const n = games.length;
  games.forEach((game, index) => {
    const weight = 0.5 ** ((n - 1 - index) / HALF_LIFE);
    for (const [side, stats, goals] of [['for', game.teamStats || {}, game.goals], ['against', game.oppStats || {}, game.against]]) {
      for (const key of TEAM_STATS) {
        const value = key === 'goals' ? goals : stats[key];
        if (!finite(value)) continue;
        const cell = sums[side][key] ||= [0, 0];
        cell[0] += weight * value; cell[1] += weight;
      }
    }
  });
  const average = side => Object.fromEntries(Object.entries(sums[side]).map(([key, [total, weight]]) => [key, total / weight]));
  const team = log.team || {};
  return {id: String(team.id || ''), abbr: team.abbr || '', name: team.name || '', games: n, for: average('for'), against: average('against')};
}

// A normal team: every team on the board, for and against alike.
function norms(profiles) {
  const out = {};
  for (const key of TEAM_STATS) {
    const values = profiles.flatMap(profile => [profile.for[key], profile.against[key]]).filter(finite);
    if (values.length) out[key] = mean(values);
  }
  return out;
}

/**
 * The matchup read for one line, from his team's and the opponent's
 * profiles and a normal team: the ratio (pulled toward 1 by the
 * opponent's matches), how much it moves the stat, and what it rests on.
 */
export function soccerRead(row, team, opponent, normal) {
  const stat = statKeyOf(row.marketKey);
  const spec = SPEC[stat];
  if (!spec || !opponent) return null;
  const [key, side, weight] = spec;
  const value = opponent[side][key], base = normal[key];
  if (!finite(value) || !(base > 0)) return null;
  const pull = opponent.games / (opponent.games + PULL);
  const ratio = 1 + (value / base - 1) * pull;
  // How much of the ball his team should have: its own average and what
  // the opponent usually lets teams have.
  const own = team?.for?.possessionPct, allowed = opponent.against?.possessionPct;
  const possession = finite(own) && finite(allowed) ? {expected: (own + allowed) / 2, own, allowed} : null;
  return {stat, key, side, weight, ratio, value, normal: base, games: opponent.games, possession,
    direction: ATTACK.has(stat) ? 1 : DEFEND.has(stat) ? -1 : 0, ball: BALL.has(stat),
    opponent: row.opponent || opponent.abbr || opponent.name || 'the opponent', team: row.teamAbbr || team?.abbr || ''};
}

/** The read in words, e.g. "SEA take 5.1 shots on target a game (normal 4.2)". */
export function soccerText(read) {
  const word = WORDS[read.key] || read.key;
  const gap = Math.round((read.value / read.normal - 1) * 100);
  const vs = `${Math.abs(gap)}% ${gap >= 0 ? 'more' : 'fewer'} than a normal team`;
  if (read.side === 'for') {
    const verb = read.key === 'goals' ? 'score' : read.key === 'foulsCommitted' ? 'commit' : 'take';
    return `${read.opponent} ${verb} ${one(read.value)} ${word} a game, ${vs} (last ${read.games})`;
  }
  return `Teams average ${one(read.value)} ${word} a game against ${read.opponent}, ${vs} (last ${read.games})`;
}

/** A favorite's tilt on the stat from the match odds: a small factor, 1 with no odds. */
export function oddsTilt(row, read) {
  const win = finite(row.winChance) ? row.winChance / 100 : null;
  if (win == null || !read?.direction) return 1;
  return clamp(1 + read.direction * (win - 0.4) * 0.15, 0.94, 1.06);
}

/**
 * Soccer lines with their matchup read (`soccerMatchup`), from the teams'
 * recent matches `logFor(row, teamId)` has (null when it doesn't). The
 * normal team is the board's, with six teams or more.
 */
export function withSoccerMatchups(rows, logFor) {
  if (!Array.isArray(rows) || typeof logFor !== 'function') return rows;
  const profiles = new Map();
  const profileOf = (row, teamId) => {
    if (!teamId) return null;
    const key = `${row.eventId}:${teamId}`;
    if (!profiles.has(key)) profiles.set(key, teamProfile(logFor(row, teamId)));
    return profiles.get(key);
  };
  const soccer = rows.filter(row => row?.sport === 'soccer' && row.eventId);
  for (const row of soccer) { profileOf(row, row.teamId); profileOf(row, row.opponentId); }
  const distinct = new Map();
  for (const profile of profiles.values()) if (profile && profile.id && !distinct.has(profile.id)) distinct.set(profile.id, profile);
  const board = distinct.size >= 6 ? norms([...distinct.values()]) : null;
  return rows.map(row => {
    if (row?.sport !== 'soccer' || !row.eventId) return row;
    const team = profileOf(row, row.teamId), opponent = profileOf(row, row.opponentId);
    if (!opponent) return row;
    const read = soccerRead(row, team, opponent, board || norms([team, opponent].filter(Boolean)));
    return read ? {...row, soccerMatchup: read} : row;
  });
}
