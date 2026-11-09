// The prop generator's game read (Nov 9, the owner on the first boards: "I
// feel those aren't confident enough and aren't using the correct data it
// should think more human less robot and actually make decisions that may
// happen in the game using real raw data to support it").
//
// The board pass (prop-generator.js) grades every line on his recent games,
// the matchup and tonight's spread. For its best candidates this reads the
// game the way a bettor would before taking one, every point from his own
// games or tonight's reports:
//  - Who's out tonight, both sides (league.tonight, ESPN's injury report),
//    and what each absence has meant: his own games without that teammate
//    and with him (player-context withWithout, this season and last).
//  - Who's back tonight after missing games, and what he did with him.
//  - His minutes, and what he does when he gets them (his game log).
//  - The game line: the points his team should score against what it
//    usually does, and how likely a blowout is (starters sit those).
//  - The pace, the defense at his position, players like him against them
//    (player-context similar), rest, his record against them, home / away.
// Then the line is graded again with tonight's news in it (slip-check.js
// gradeLeg: the prop model reads the teammates' splits, the news caps a
// questionable player), and a call is made: a play, or a pass and why.
import {gradeLeg} from './slip-check.js';
import {newsOf, samePerson} from './slip-games.js';
import {restBefore} from './rest.js';
import {backTonight, outTonight} from './nba-matchup-score.js';
import {lineupRole, rotationPlayer} from './lineup-role.js';
import {formRate, PICK_TIERS, recordOf, statWords} from './prop-generator.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const one = value => String(Math.round(value * 10) / 10);
const SUFFIX = /^(jr|sr|ii|iii|iv|v)\.?$/i;
export const lastName = name => String(name || '').split(' ').filter(word => word && !SUFFIX.test(word)).slice(-1)[0] || String(name || '');

// The stats that ride on how many points a team scores.
const SCORING = new Set(['player_points', 'player_assists', 'player_threes', 'player_points_rebounds', 'player_points_assists',
  'player_points_rebounds_assists']);
// How far an NBA final margin usually lands from the spread (points, one
// standard deviation), and the margin starters usually sit the fourth at.
export const MARGIN_SD = 12.5, BLOWOUT_AT = 15;
// What a blowout does to a player's minutes: a starter sits most of the
// fourth, a bench player plays more of it.
export const BLOWOUT_MINUTES = {starter: 0.86, bench: 1.12};
// How many of the board's candidates get the full read.
export const DEEP = 16;
// A teammate's absence that can move a line (PrizePicks moves its lines
// with the news, so his record at tonight's number can look worse than it
// is): a rotation player on this many minutes, likely to sit.
const BIG_OUT = {minutes: 24, sits: 0.8};
// What a call takes: the model's chance with the news in, our projection's
// room over the line, the confidence.
export const CALL = {chance: 0.52, room: 0.03, confidence: 56};
// Confidence (0-100) from five reads: the model with tonight's news in, how
// far our projection clears the line, his record at the line, how much of
// the case is for it, the matchup.
export const CONFIDENCE = {model: 0.30, projection: 0.25, record: 0.20, case: 0.15, matchup: 0.10};
// The calls, best first.
export const STRENGTHS = [[78, 'best', 'Best bet'], [68, 'strong', 'Strong play'], [0, 'play', 'Play']];

// ---------------------------------------------------------------- the game

const ESPN_LEVEL = {OUT: 'Out', O: 'Out', OFS: 'Out', SUSP: 'Suspended', D: 'Doubtful', DOUBTFUL: 'Doubtful', GTD: 'Game-time decision',
  Q: 'Questionable', QUESTIONABLE: 'Questionable', DTD: 'Day-To-Day', 'DAY-TO-DAY': 'Day-To-Day'};
// An ESPN report line in the words slip-games.js reads: its fantasy code
// first (a player listed Out can be a game-time decision, Oct 25).
const reported = item => ({...item, status: ESPN_LEVEL[String(item.code || '').toUpperCase()] || item.status});

/**
 * Tonight's game for a line, from league.tonight (each team's ESPN injury
 * report and the game's line): {team, opponent, state, startsAt, injuries,
 * odds, teammates}, the shape slip-games.js gives a pick's game. Null when
 * his team's report isn't in (unknown, not healthy).
 */
export function tonightGame(row, league) {
  const teams = league?.tonight?.teams || {};
  const mine = teams[row?.teamAbbr];
  if (!mine || (row.opponent && mine.opponent && mine.opponent !== row.opponent)) return null;
  const opponent = row.opponent || mine.opponent;
  const theirs = teams[opponent];
  const injuries = {[row.teamAbbr]: (mine.injuries || []).map(reported)};
  if (theirs) injuries[opponent] = (theirs.injuries || []).map(reported);
  const spread = finite(mine.spread) ? {[row.teamAbbr]: mine.spread, ...(opponent ? {[opponent]: -mine.spread} : {})} : null;
  const total = finite(mine.total) ? mine.total : null;
  return {team: row.teamAbbr, opponent, state: 'pre', startsAt: row.startsAt || mine.startsAt || null, injuries,
    odds: spread || total != null ? {spread, total} : null, teammates: []};
}

/** His splits with and without each teammate listed out tonight ({name, status, with, without}). */
export function teammateSplits(row, game, context) {
  const news = newsOf({...row, game});
  const splits = context?.withWithout || [];
  return (news?.out || []).map(mate => {
    const split = splits.find(item => (mate.id != null && String(item.id) === String(mate.id)) || samePerson(item.name, mate.name));
    return split ? {...mate, with: split.with, without: split.without} : null;
  }).filter(Boolean);
}

// The chance a normal variable lands under z.
function normalCdf(z) {
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/**
 * How the game could go, from his team's spread (negative: favored): it
 * stays within BLOWOUT_AT, his team pulls away, or the other one does, each
 * with its chance, his minutes in it and what that projects him to. The
 * minutes are set so the three average out to tonight's projection.
 */
export function scenariosOf({spread, projection, minutes, starter, line, team, opponent}) {
  if (!finite(spread) || !finite(projection) || !finite(minutes) || !(minutes > 0)) return null;
  const margin = -spread;
  const ahead = 1 - normalCdf((BLOWOUT_AT - margin) / MARGIN_SD), behind = normalCdf((-BLOWOUT_AT - margin) / MARGIN_SD);
  const close = Math.max(0, 1 - ahead - behind);
  const factor = starter ? BLOWOUT_MINUTES.starter : BLOWOUT_MINUTES.bench;
  const closeMinutes = minutes / (close + (1 - close) * factor), blowMinutes = closeMinutes * factor;
  const rate = projection / minutes;
  const at = (key, label, chance, played) => ({key, label, chance, minutes: played, projection: rate * played, clears: finite(line) ? rate * played > line : null});
  return [at('close', 'It stays close', close, closeMinutes), at('ahead', `${team || 'His team'} pulls away`, ahead, blowMinutes),
    at('behind', `${opponent || 'They'} pull${opponent ? 's' : ''} away`, behind, blowMinutes)];
}

// ---------------------------------------------------------------- his games

/** His games with minutes, newest last (at most `count`). */
const playedGames = (row, count = 15) => (row?.gameLog || []).filter(game => finite(game.value) && finite(game.usage) && game.usage > 0).slice(-count);
const overLine = (games, line) => games.filter(game => game.value > line).length;
/** How many of his latest games in a row went over the line. */
export function streakOf(row) {
  const values = (row?.gameLog || []).map(game => game.value).filter(finite);
  let streak = 0;
  for (let index = values.length - 1; index >= 0 && values[index] > row.line; index--) streak++;
  return streak;
}
const dayText = date => {
  const time = Date.parse(`${date}T12:00:00Z`);
  return Number.isFinite(time) ? new Date(time).toLocaleDateString('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'}) : '';
};

// ---------------------------------------------------------------- the reasons

// A reason: {key, title, text, side: 'for' | 'against' | 'info', weight, short}.
// `short` is the half-sentence the summary uses.
const beat = (key, title, text, side, weight, short = null) => ({key, title, text, side, weight: Math.round(weight * 100) / 100, short});
const sideOf = (up, down) => up ? 'for' : down ? 'against' : 'info';
const POSITION_WORDS = {G: ['guard', 'guards'], F: ['forward', 'forwards'], C: ['center', 'centers']};

function outBeats(row, game, splits, league) {
  const news = newsOf({...row, game});
  const out = [];
  const stat = statWords(row), last = lastName(row.player);
  for (const mate of (news?.out || []).slice(0, 3)) {
    const split = splits.find(item => samePerson(item.name, mate.name));
    const known = split && split.without?.games >= 2 && split.with?.games >= 2 && finite(split.without.avg) && finite(split.with.avg);
    const listed = rotationPlayer({playerId: mate.id, player: mate.name, teamAbbr: row.teamAbbr}, league);
    // Missed his team's last three already: his recent games went without him.
    const already = listed ? listed.last3 === false : false;
    const minutes = finite(listed?.min10) && listed.min10 > 0 ? listed.min10 : finite(listed?.min) ? listed.min : null;
    const who = `${mate.name}${minutes ? ` (${Math.round(minutes)} min a game)` : ''}`;
    const word = mate.level === 'doubtful' ? 'doubtful' : 'out';
    if (known) {
      const {with: on, without: off} = split;
      const more = off.avg >= on.avg * 1.05, less = off.avg <= on.avg * 0.95;
      const hits = finite(off.hits) ? ` and went over ${row.line} in ${off.hits}` : '';
      const tail = already ? ` He's missed their last few games too, so that's already in ${last}'s recent numbers.` : '';
      const weight = (already ? 0.5 : 1) * clamp(off.games / 4, 0.5, 2) * (Math.abs(off.avg - on.avg) / Math.max(row.line, 1) >= 0.08 ? 1.5 : 1);
      out.push(beat(`out:${mate.name}`, 'Who\'s out', `${who} is ${word} tonight. In the ${off.games} games ${last} played without him, he averaged ${one(off.avg)} ${stat}${hits}; with ${lastName(mate.name)} playing it's ${one(on.avg)}.${tail}`,
        sideOf(more && off.avg > row.line, less && off.avg < row.line), weight,
        more && off.avg > row.line ? `${lastName(mate.name)}'s ${word}, and without him ${last} has averaged ${one(off.avg)}`
          : less && off.avg < row.line ? `without ${lastName(mate.name)} he's averaged only ${one(off.avg)}` : null));
    } else if (!already && minutes != null && minutes >= 15) {
      out.push(beat(`out:${mate.name}`, 'Who\'s out', `${who} is ${word} tonight: more shots and minutes to go around.`, 'for', 0.5));
    }
  }
  return out;
}

function backBeats(row, context, league) {
  const back = backTonight(row.teamAbbr, league, row.playerId) || [];
  const stat = statWords(row), last = lastName(row.player);
  return back.slice(0, 2).map(mate => {
    const split = (context?.withWithout || []).find(item => String(item.id) === String(mate.id) || samePerson(item.name, mate.name));
    const known = split && split.with?.games >= 2 && split.without?.games >= 2 && finite(split.with.avg) && finite(split.without.avg);
    const maybe = mate.plays < 1 ? ` (listed ${String(mate.status || 'questionable').toLowerCase()})` : '';
    if (!known) return beat(`back:${mate.name}`, 'Who\'s back', `${mate.name}${maybe} is due back tonight after missing his team's last few games. He plays ${Math.round(mate.min)} minutes a game and takes some of the shots back.`, 'against', 0.75 * mate.plays,
      `${lastName(mate.name)} is back and takes shots back`);
    const {with: on, without: off} = split;
    const less = on.avg <= off.avg * 0.95, under = on.avg < row.line;
    const weight = (less && under ? 2.5 : less ? 1.5 : 0.75) * mate.plays;
    const found = beat(`back:${mate.name}`, 'Who\'s back', `${mate.name}${maybe} is due back tonight after missing his team's last few games. With him playing, ${last} averages ${one(on.avg)} ${stat} (${on.games} games); without him, ${one(off.avg)}.`,
      sideOf(!less && on.avg > row.line * 1.05, less), weight, less ? `${lastName(mate.name)} is back, and with him ${last} averages ${one(on.avg)}` : null);
    // Back, and under the line with him: reason enough to pass.
    if (less && under && mate.plays >= 0.65) found.pass = `${lastName(mate.name)} is back tonight, and with him playing ${last} averages ${one(on.avg)} ${stat}, under the ${row.line} line.`;
    return found;
  });
}

function theirOutBeat(row, league) {
  const theirs = (outTonight(row.opponent, league) || []).filter(player => player.sits >= 0.8).slice(0, 3);
  if (!theirs.length) return null;
  const center = theirs.some(player => player.pos === 'C');
  const glass = center && /rebounds/.test(row.marketKey);
  const same = theirs.some(player => player.pos === (String(row.position || '').toUpperCase()[0]));
  const names = theirs.map(player => `${player.name} (${player.pos}, ${Math.round(player.min)} min)`).join(', ');
  return beat('their-out', 'Their side', `${row.opponent} will be without ${names}.${glass ? ' That\'s their center: more rebounds up for grabs.' : ' A thinner rotation to guard him.'}`,
    'for', 0.6 + (glass || same ? 0.5 : 0), `${row.opponent} is missing ${theirs.length === 1 ? lastName(theirs[0].name) : `${theirs.length} rotation players`}`);
}

function minutesBeat(row, projected) {
  const games = playedGames(row);
  if (games.length < 5) return null;
  const minutes = games.map(game => game.usage);
  const lately = mean(minutes.slice(-5)), before = minutes.length >= 8 ? mean(minutes.slice(0, -5)) : null;
  const tonight = finite(projected) ? projected : lately;
  const cut = Math.max(20, Math.floor(tonight) - 1);
  const full = games.filter(game => game.usage >= cut);
  const list = minutes.slice(-5).map(value => Math.round(value)).join(', ');
  const parts = [`He's played ${list} minutes in his last five.`];
  let up = false, down = false, short = null;
  if (full.length >= 3) {
    const average = mean(full.map(game => game.value)), hits = overLine(full, row.line);
    parts.push(`In his ${full.length} games with ${cut}+ minutes, he's averaged ${one(average)} and gone over ${row.line} in ${hits}.`);
    up = hits / full.length >= 0.65 && average > row.line * 1.05;
    down = hits / full.length <= 0.4;
    if (up) short = `when he gets ${cut}+ minutes he's cleared ${row.line} in ${hits} of ${full.length}`;
    if (down) short = `even with ${cut}+ minutes he's cleared it in only ${hits} of ${full.length}`;
  }
  if (before != null && before > 0 && Math.abs(lately / before - 1) >= 0.08 && Math.abs(lately - before) >= 2.5) {
    const rising = lately > before;
    parts.push(`His minutes are ${rising ? 'up' : 'down'} lately: ${one(lately)} a game over his last 5, ${one(before)} before.`);
    if (rising) up = up || !down;
    else { down = true; short ||= `his minutes are down to ${one(lately)}`; }
  }
  return beat('minutes', 'His minutes', parts.join(' '), sideOf(up && !down, down), 1.5, short);
}

function teamPoints(team, league) {
  const now = league?.thisSeason?.teamStats?.[team];
  if (now?.off?.pts && (league.thisSeason.games?.[team] ?? 0) >= 5) return now.off.pts[0];
  return league?.teamStats?.[team]?.off?.pts?.[0] ?? null;
}

function gameLineBeats(row, game, league, starter) {
  const out = [];
  const spread = game?.odds?.spread?.[row.teamAbbr], total = game?.odds?.total;
  const team = row.teamAbbr, opponent = row.opponent;
  if (finite(spread) && finite(total)) {
    const implied = (total - spread) / 2, usual = teamPoints(team, league);
    const how = spread < 0 ? `favored by ${one(-spread)}` : spread > 0 ? `as a ${one(spread)}-point underdog` : 'even';
    const scoring = SCORING.has(row.marketKey);
    if (finite(usual)) {
      const diff = implied - usual;
      const than = Math.abs(diff) < 0.5 ? `right at the ${one(usual)} they average` : `${one(Math.abs(diff))} ${diff > 0 ? 'more' : 'fewer'} than the ${one(usual)} they average`;
      out.push(beat('game-line', 'The game line', `The game line has ${team} ${how} with a total of ${one(total)}: about ${Math.round(implied)} points for ${team}, ${than}.`,
        scoring ? sideOf(diff >= 3, diff <= -3) : 'info', 1, scoring && diff >= 3 ? `${team} should score about ${Math.round(implied)}`
          : scoring && diff <= -3 ? `${team} projects to score only about ${Math.round(implied)}` : null));
    } else {
      out.push(beat('game-line', 'The game line', `The game line has ${team} ${how} with a total of ${one(total)}: about ${Math.round(implied)} points for ${team}.`, 'info', 0.5));
    }
  }
  if (finite(spread)) {
    const margin = -spread;
    const big = 1 - normalCdf((BLOWOUT_AT - margin) / MARGIN_SD) + normalCdf((-BLOWOUT_AT - margin) / MARGIN_SD);
    // Even a pick'em game ends 15 or more apart about 23% of the time: a
    // spread of 8 or more is where the risk is real.
    if (starter && Math.abs(spread) >= 8) {
      out.push(beat('blowout', 'Blowout risk', `A ${one(Math.abs(spread))}-point spread. There's about a ${Math.round(big * 100)}% chance this gets to ${BLOWOUT_AT} or more, and starters usually sit most of the fourth when it does.`,
        'against', Math.abs(spread) >= 11.5 ? 2 : 1, `a ${one(Math.abs(spread))}-point spread could mean a short night`));
    } else if (!starter && Math.abs(spread) >= 8) {
      out.push(beat('blowout', 'Blowout risk', `A ${one(Math.abs(spread))}-point spread: if it gets out of hand (about ${Math.round(big * 100)}%), the bench plays more of the fourth.`, 'for', 0.5));
    } else if (starter && Math.abs(spread) <= 4.5) {
      out.push(beat('close', 'A close game', `A close game on paper (${one(Math.abs(spread))}-point spread): starters play their full minutes in those.`, 'for', 0.75,
        'it should be close, so he plays his full minutes'));
    }
  }
  return out;
}

function paceBeat(row, league) {
  const table = league?.opportunity?.teams || {};
  const mine = table[row.teamAbbr]?.poss?.[0], theirs = table[row.opponent]?.poss?.[0];
  if (!finite(mine) || !finite(theirs)) return null;
  const all = Object.values(table).map(team => team?.poss?.[0]).filter(finite);
  const usual = finite(league?.opportunity?.league?.poss) ? league.opportunity.league.poss : mean(all);
  if (!finite(usual)) return null;
  const expected = (mine + theirs) / 2, diff = expected - usual;
  if (Math.abs(diff) < 1.5) return null;
  const fast = diff > 0;
  return beat('pace', 'Pace', `${fast ? 'A fast game' : 'A slow game'}: ${row.teamAbbr} plays at ${one(mine)} possessions a game and ${row.opponent} at ${one(theirs)}, against a league average of ${one(usual)}. ${fast ? 'More trips, more chances.' : 'Fewer trips, fewer chances.'}`,
    sideOf(fast, !fast), 0.75, fast ? 'the pace should be fast' : 'a slow game means fewer chances');
}

const DEFENSE_KINDS = new Set(['position', 'defense', 'rebounds', 'assists', 'attempts', 'recent']);
function defenseBeats(row, read) {
  return [...(read?.reads || [])].filter(part => DEFENSE_KINDS.has(part.kind) && part.text && Math.abs(part.points || 0) >= 0.5)
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points)).slice(0, 2)
    .map(part => beat(`defense:${part.key}`, 'Their defense', `${part.text}.`, sideOf(part.points >= 1, part.points <= -1), clamp(Math.abs(part.points) / 4, 0.3, 1.5),
      part.text.replace(/^[A-Z](?=[a-z])/, letter => letter.toLowerCase())));
}

function similarBeat(row, context) {
  const position = context?.position;
  const players = (context?.similar?.[position] || []).filter(item => finite(item.diff));
  if (players.length < 5) return null;
  const words = POSITION_WORDS[position] || ['player', 'players'];
  const average = mean(players.map(item => item.diff)), above = players.filter(item => item.diff > 0).length;
  const scale = Math.max(row.line, 1);
  const up = average / scale >= 0.04 && above >= players.length * 0.6, down = average / scale <= -0.04 && above <= players.length * 0.4;
  const stat = statWords(row);
  return beat('similar', 'Players like him', `The last ${players.length} ${words[1]} who played real minutes against ${row.opponent} ${average >= 0 ? 'beat' : 'fell short of'} their own average by ${one(Math.abs(average))} ${stat} (${above} of ${players.length} went above it).`,
    sideOf(up, down), 1, up ? `${words[1]} have been beating their average against ${row.opponent}` : down ? `${words[1]} have come up short against ${row.opponent}` : null);
}

function formBeat(row, records) {
  const recent = records.l10 || records.l5;
  if (!recent) return null;
  const streak = streakOf(row);
  const season = records.season && records.season.games >= 5 ? ` This season: ${records.season.hits} of ${records.season.games}.` : '';
  const rate = recent.hits / recent.games;
  return beat('form', 'His form', `He's gone over ${row.line} in ${recent.hits} of his last ${recent.games}${streak >= 3 ? `, the last ${streak} in a row` : ''}.${season}`,
    sideOf(rate >= 0.7, rate <= 0.4), 1.25, rate >= 0.7 ? `he's over ${row.line} in ${recent.hits} of his last ${recent.games}`
      : rate <= 0.4 ? `he's over it in only ${recent.hits} of his last ${recent.games}` : null);
}

function headToHeadBeat(row) {
  const games = (row.gameLog || []).filter(game => finite(game.value) && game.opponent && game.opponent === row.opponent).slice(-4);
  if (!games.length) return null;
  const hits = overLine(games, row.line), list = games.map(game => `${one(game.value)}${game.date ? ` (${dayText(game.date)})` : ''}`).join(', ');
  const rate = hits / games.length;
  const text = games.length === 1
    ? `He had ${one(games[0].value)} ${statWords(row)} against ${row.opponent}${games[0].date ? ` on ${dayText(games[0].date)}` : ''}, ${hits ? 'over' : 'under'} this line.`
    : `His last ${games.length} against ${row.opponent}: ${list}. ${hits} of ${games.length} over ${row.line}.`;
  return beat('h2h', 'Against them', text,
    games.length >= 2 ? sideOf(rate >= 0.67, rate <= 0.34) : 'info', 0.5,
    rate >= 0.67 ? `he's ${hits} of ${games.length} against ${row.opponent}` : `he's only ${hits} of ${games.length} against ${row.opponent}`);
}

function venueBeat(row, game) {
  const home = row.homeTeamAbbr ? row.teamAbbr === row.homeTeamAbbr : null;
  if (home == null) return null;
  const games = (row.gameLog || []).filter(item => finite(item.value) && item.home === home).slice(-10);
  if (games.length < 4) return null;
  const hits = overLine(games, row.line), average = mean(games.map(item => item.value));
  return beat('venue', home ? 'At home' : 'On the road', `${home ? 'At home' : 'On the road'} over his last ${games.length} there: ${one(average)} a game, ${hits} over ${row.line}.`,
    sideOf(hits / games.length >= 0.7, hits / games.length <= 0.35), 0.5,
    `${hits} of ${games.length} ${home ? 'at home' : 'on the road'}`);
}

function restBeats(row, league) {
  const startsAt = row.startsAt;
  const mine = restBefore(league?.rest?.[row.teamAbbr], startsAt), theirs = restBefore(league?.rest?.[row.opponent], startsAt);
  const out = [];
  if (mine?.backToBack) out.push(beat('rest', 'Rest', `${row.teamAbbr} played last night: the second of a back-to-back, when minutes get managed.`, 'against', 0.75,
    `${row.teamAbbr} is on a back-to-back`));
  if (theirs?.backToBack && !mine?.backToBack) out.push(beat('rest-them', 'Rest', `${row.opponent} played last night: tired legs on defense.`, 'for', 0.5, `${row.opponent} is on a back-to-back`));
  else if (mine && mine.days >= 3 && !theirs?.backToBack) out.push(beat('rest', 'Rest', `${row.teamAbbr} comes in on ${mine.days - 1} days of rest.`, 'info', 0.25));
  return out;
}

function lineBeat(row) {
  const season = row.windows?.season;
  const average = finite(season?.average) ? season.average : null;
  if (average == null || !(average > 0) || !(Number(season.sample || season.decisions || 0) >= 5)) return null;
  const gap = average - row.line;
  if (gap / average >= 0.05) return beat('line', 'The line', `The line (${row.line}) sits ${one(gap)} under his season average of ${one(average)}.`, 'for', 0.75,
    `the line is ${one(gap)} under his season average`);
  if (-gap / average >= 0.08) return beat('line', 'The line', `The line (${row.line}) is set ${one(-gap)} above his season average of ${one(average)}.`, 'against', 0.75,
    'the line is above his season average');
  return null;
}

function statusBeat(row, game) {
  const self = newsOf({...row, game})?.self;
  if (!self || !self.level) return null;
  if (self.level === 'probable') return null;
  return beat('status', 'His status', `He's listed ${String(self.status).toLowerCase()} tonight.${self.level === 'questionable' ? ' Check before tip-off: limited minutes would sink it.' : ''}`,
    'against', self.level === 'questionable' ? 1.5 : 3, `he's listed ${String(self.status).toLowerCase()}`);
}

// ---------------------------------------------------------------- the read

/**
 * The board item read in full: {...item, game, deep (the grade again with
 * tonight's news), projection, minutes, beats, scenarios, case, confidence,
 * signals, call: {play, strength, label, reason}}. `context` is the
 * player-context payload (null when it didn't load: the read goes on
 * without his splits).
 */
export function readGame(item, league, context = null) {
  const {row} = item;
  const base = item.grade;
  const game = tonightGame(row, league);
  const splits = game ? teammateSplits(row, game, context) : [];
  const withNews = game ? {...row, game: {...game, teammates: splits}} : row;
  let deep = null;
  try { deep = gradeLeg({side: 'OVER'}, withNews, {[row.sport || 'nba']: league}); } catch { deep = null; }
  const chance = finite(deep?.chance) ? deep.chance : base?.chance;
  const tier = deep?.tier || base?.tier;
  const projection = finite(deep?.read?.projection) ? deep.read.projection : finite(base?.projection) ? base.projection : item.average;
  const minutes = finite(deep?.read?.model?.usage) ? deep.read.model.usage : item.minutes;
  const role = item.role || lineupRole(row, league);
  const starter = role ? role.starter : finite(minutes) && minutes >= 28;
  const records = item.records || {l5: recordOf(row, 'l5'), l10: recordOf(row, 'l10'), l20: recordOf(row, 'l20'), season: recordOf(row, 'season')};
  const form = item.form ?? formRate(records);

  const beats = [statusBeat(row, game), ...(game ? outBeats(row, game, splits, league) : []), ...backBeats(row, context, league), theirOutBeat(row, league),
    minutesBeat(row, minutes), ...gameLineBeats(row, game, league, starter), paceBeat(row, league), ...defenseBeats(row, item.read),
    similarBeat(row, context), formBeat(row, records), lineBeat(row), headToHeadBeat(row), venueBeat(row, game), ...restBeats(row, league)].filter(Boolean);
  const weightOf = side => beats.filter(part => part.side === side).reduce((sum, part) => sum + part.weight, 0);
  const forWeight = weightOf('for'), againstWeight = weightOf('against');
  const share = forWeight + againstWeight > 0 ? forWeight / (forWeight + againstWeight) : 0.5;
  const scenarios = scenariosOf({spread: game?.odds?.spread?.[row.teamAbbr], projection, minutes, starter, line: row.line, team: row.teamAbbr, opponent: row.opponent});

  const room = finite(projection) && row.line > 0 ? (projection - row.line) / row.line : null;
  const signals = {model: clamp((chance - 0.5) / 0.10 * 100, 0, 100), projection: room == null ? 50 : clamp(room / 0.16 * 100, 0, 100),
    record: form == null ? 50 : clamp((form - 0.5) / 0.25 * 100, 0, 100), case: clamp((share - 0.4) / 0.45 * 100, 0, 100),
    matchup: clamp(((item.read?.score ?? 50) - 40) / 50 * 100, 0, 100)};
  const confidence = Math.round(Object.entries(CONFIDENCE).reduce((sum, [key, part]) => sum + part * signals[key], 0));

  // The call. A pass says why, the way you'd say it to a friend.
  const self = game ? newsOf(withNews)?.self : null;
  const backing = beats.filter(part => part.pass);
  const blowout = scenarios?.slice(1).reduce((sum, part) => sum + part.chance, 0) ?? 0;
  let reason = null;
  if (self?.level === 'out' || self?.level === 'doubtful') reason = `He's listed ${String(self.status).toLowerCase()}.`;
  else if (backing.length) reason = backing[0].pass;
  else if (!PICK_TIERS.includes(tier) || !(chance >= CALL.chance)) reason = `With tonight's news in, the model has it at only ${Math.round(chance * 100)}%.`;
  else if (room == null || room < CALL.room) reason = `Our number (${finite(projection) ? one(projection) : '—'}) is too close to the line.`;
  else if (starter && blowout >= 0.35 && scenarios && !scenarios[1].clears) reason = `Too much blowout risk: if it gets out of hand he likely sits, and at about ${Math.round(scenarios[1].minutes)} minutes he's under.`;
  else if (confidence < CALL.confidence) reason = `Not enough lines up: ${beats.filter(part => part.side === 'for').length} things for it, ${beats.filter(part => part.side === 'against').length} against.`;
  const [, strength, label] = STRENGTHS.find(([floor]) => confidence >= floor);
  const call = reason ? {play: false, reason} : {play: true, strength, label};
  return {...item, game, deep, chance, tier, projection, room, minutes, starter, beats, scenarios, case: {for: forWeight, against: againstWeight, share},
    confidence, signals, call, score: confidence + (item.row.marketKey === 'player_threes' ? -3 : 0), grade: {...(base || {}), chance, tier, edge: chance - 0.5}};
}

/** The short read on top of a pick: our number, then the two or three things that matter most, then the main worry. */
export function summaryOf(read) {
  const {row} = read;
  const parts = [];
  if (finite(read.projection)) {
    const minutes = finite(read.minutes) ? ` in about ${Math.round(read.minutes)} minutes` : '';
    parts.push(`We have ${lastName(row.player)} at ${one(read.projection)} ${statWords(row)}${minutes}, ${one(Math.abs(read.projection - row.line))} ${read.projection >= row.line ? 'over' : 'under'} the line.`);
  }
  const reasons = read.beats.filter(part => part.side === 'for' && part.short).sort((a, b) => b.weight - a.weight).slice(0, 3).map(part => part.short);
  for (const text of reasons) parts.push(`${text[0].toUpperCase()}${text.slice(1)}.`);
  const worry = read.beats.filter(part => part.side === 'against' && part.short).sort((a, b) => b.weight - a.weight)[0];
  if (worry) parts.push(`The worry: ${worry.short.replace(/\.$/, '')}.`);
  return parts.join(' ');
}

/** Games for the minutes chart: his last 15 with minutes, {minutes, value, over, opponent, date}. */
export function minutesPoints(row) {
  return playedGames(row).map(game => ({minutes: game.usage, value: game.value, over: game.value > row.line, opponent: game.opponent, date: game.date}));
}

/**
 * Which board items get the full read: the board's best (DEEP of them),
 * and the best line of any regular whose team has a big absence tonight
 * (PrizePicks moves a line with the news, so his record at the new number
 * can understate him; `loose` is generateProps without the record checks).
 */
export function deepCandidates(strict, loose, league, count = DEEP) {
  const chosen = new Map();
  for (const item of strict.slice(0, count)) chosen.set(item.row.playerId || item.row.player, item);
  const news = new Set(Object.keys(league?.tonight?.teams || {}).filter(team => (outTonight(team, league) || [])
    .some(player => player.min >= BIG_OUT.minutes && player.sits >= BIG_OUT.sits)));
  const extra = (loose || []).filter(item => news.has(item.row.teamAbbr) && !chosen.has(item.row.playerId || item.row.player))
    .sort((a, b) => b.grade.chance - a.grade.chance).slice(0, 6);
  for (const item of extra) chosen.set(item.row.playerId || item.row.player, item);
  return [...chosen.values()];
}

/** The reads split into the calls: {plays (best first), passes}. */
export function callsOf(reads) {
  const plays = reads.filter(read => read.call.play).sort((a, b) => b.score - a.score);
  const passes = reads.filter(read => !read.call.play).sort((a, b) => b.confidence - a.confidence);
  return {plays, passes};
}
