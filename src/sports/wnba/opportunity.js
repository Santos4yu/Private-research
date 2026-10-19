// Opportunity for a basketball line, for the player page's Opportunity
// card and Analyze: whether the chances behind the stat are there, not
// just how often it cleared. The numbers come from /api/wnba
// (player-context `opportunity`, league-context `opportunity`, NBA
// player-tracking); see backend/sports/wnba/opportunity.py and tracking.py.
import {rankTone, rankWords} from '../../research-ranks.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const one = value => (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '');
const signed = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${one(Math.abs(value))}`;

// What each stat comes from. Combos read every part they add up.
const FAMILY = {pts: 'points', fgm: 'points', fga: 'points', ftm: 'points', fta: 'points', twos: 'points', twosa: 'points',
  reb: 'rebounds', oreb: 'rebounds', dreb: 'rebounds', ast: 'assists', tpm: 'threes', tpa: 'threes',
  pr: 'combo', pa: 'combo', ra: 'combo', pra: 'combo', fs: 'combo'};
export const familyOf = stat => FAMILY[stat] || 'general';
const PARTS = {pr: ['pts', 'reb'], pa: ['pts', 'ast'], ra: ['reb', 'ast'], pra: ['pts', 'reb', 'ast'], fs: ['pts', 'reb', 'ast']};
const has = (stat, part) => (PARTS[stat] || [stat]).includes(part);

/** '2025-26' for an NBA season (ESPN names it 2026); a WNBA season is its year. */
export const seasonName = (year, league) => league === 'nba' && finite(year) ? `${year - 1}-${String(year).slice(-2)}` : String(year ?? '');
export const seasonsName = (years = [], league) => years.filter(finite).map(year => seasonName(year, league)).join(' and ');

const recentNote = (recent, key, unit = '') => finite(recent?.[key]) ? `Last 10: ${one(recent[key])}${unit}` : null;

/**
 * The tiles for his side of it: minutes and what the stat feeds on, season
 * first with the last ten beside it. `projected` is the model's minutes.
 */
// A percentage keeps its sign with the number: 31.2% while on the floor.
const tile = (key, label, value, unit, note) => unit?.startsWith('%')
  ? {key, label, value: `${one(value)}%`, unit: unit.slice(1).trim(), note} : {key, label, value: one(value), unit, note};

export function playerTiles(stat, chances, {projected = null} = {}) {
  const season = chances?.szn, recent = chances?.l10;
  if (!season) return [];
  const tiles = [];
  const add = (...args) => { if (finite(args[2])) tiles.push(tile(...args)); };
  add('min', 'Minutes', season.min, 'a game', [recentNote(recent, 'min'), finite(projected) ? `Projected tonight: ${one(projected)}` : null].filter(Boolean).join(' · '));
  const family = familyOf(stat);
  if (family === 'points' || family === 'combo' || family === 'general')
    add('usage', 'Plays he finishes', season.usage, '% while on the floor', ['His shots, free-throw trips and turnovers (usage)', recentNote(recent, 'usage', '%')].filter(Boolean).join(' · '));
  if (family === 'points') {
    add('fga', 'Shot attempts', season.fga, 'a game', [finite(season.per36?.fga) ? `${one(season.per36.fga)} per 36 minutes` : null, recentNote(recent, 'fga')].filter(Boolean).join(' · '));
    add('fta', 'Free throws', season.fta, 'a game', recentNote(recent, 'fta'));
  }
  if (family === 'threes') {
    add('tpa', '3-point tries', season.tpa, 'a game', [finite(season.tpPct) ? `Makes ${one(season.tpPct)}%` : null, recentNote(recent, 'tpa')].filter(Boolean).join(' · '));
    add('fga', 'Shot attempts', season.fga, 'a game', recentNote(recent, 'fga'));
  }
  if (has(stat, 'reb') || family === 'rebounds') {
    add('rebShare', 'Rebounds he grabs', season.rebShare, '% of those available',
      [finite(season.orebShare) && finite(season.drebShare) ? `Offense ${one(season.orebShare)}% · defense ${one(season.drebShare)}%` : null, recentNote(recent, 'rebShare', '%')].filter(Boolean).join(' · '));
    add('missesOn', 'Missed shots while he plays', season.missesOn, 'a game', ['Both teams’: his rebound chances', recentNote(recent, 'missesOn')].filter(Boolean).join(' · '));
  }
  if (has(stat, 'ast') || family === 'assists') {
    add('astShare', 'Teammates’ baskets he assists', season.astShare, '% while on the floor', recentNote(recent, 'astShare', '%'));
    add('mateFg', 'Teammates’ shooting', season.mateFg, '% from the field', ['In his games: the share of his passes that can become assists', recentNote(recent, 'mateFg', '%')].filter(Boolean).join(' · '));
  }
  if (family === 'combo' || family === 'general') add('possOn', 'Possessions while he plays', season.possOn, 'a game', recentNote(recent, 'possOn'));
  return tiles;
}

/** The NBA's tracking tiles that feed this stat (when stats.nba.com answered). */
export function trackingTiles(stat, tracking) {
  if (!tracking?.available) return [];
  const tiles = [], family = familyOf(stat), recent = tracking.recent || {};
  const add = (key, label, value, unit, note) => { if (finite(value)) tiles.push({key, label, value: one(value), unit, note}); };
  const passing = tracking.passing || {}, rebounding = tracking.rebounding || {};
  if (has(stat, 'ast') || family === 'assists') {
    const rate = finite(passing.potentialAst) && passing.potentialAst > 0 && finite(passing.ast) ? Math.round(100 * passing.ast / passing.potentialAst) : null;
    add('potentialAst', 'Potential assists', passing.potentialAst, 'a game',
      [rate != null ? `Passes a teammate shot off; ${rate}% became assists` : 'Passes a teammate shot off', finite(recent.passing?.potentialAst) ? `Last 10: ${one(recent.passing.potentialAst)}` : null].filter(Boolean).join(' · '));
  }
  if (has(stat, 'reb') || family === 'rebounds') {
    add('chances', 'Rebound chances', rebounding.chances, 'a game',
      [finite(rebounding.chancePct) ? `Rebounds he was near; grabs ${one(rebounding.chancePct)}%` : 'Rebounds he was near',
        finite(rebounding.contestedPct) ? `${Math.round(rebounding.contestedPct)}% contested` : null,
        finite(recent.rebounding?.chances) ? `Last 10: ${one(recent.rebounding.chances)}` : null].filter(Boolean).join(' · '));
  }
  if (family === 'threes') {
    const catches = tracking.catchShoot || {}, pullUps = tracking.pullUp || {};
    add('catchShoot', 'Catch-and-shoot 3s', catches.fg3a, 'tries a game', [finite(catches.fg3Pct) ? `Makes ${one(catches.fg3Pct)}%` : null,
      finite(pullUps.fg3a) ? `Pull-up 3s: ${one(pullUps.fg3a)} a game` : null].filter(Boolean).join(' · '));
  }
  if (family === 'points' || family === 'assists' || family === 'combo') {
    const touch = tracking.touches || {};
    add('touches', 'Touches', touch.touches, 'a game', finite(touch.timeOfPoss) ? `${one(touch.timeOfPoss)} minutes with the ball` : null);
  }
  return tiles;
}

/**
 * Tonight's game from the league's opportunity table: the pace both teams
 * play at, and what the defense gives up that this stat feeds on. Each row:
 * {key, label, note, value, rank, tone, league}. Rank 1 is the most; more
 * helps an over.
 */
export function gameRows(stat, table, team, opponent) {
  const teams = table?.teams || {}, league = table?.league || {}, count = table?.count || 0;
  const own = teams[team], opp = teams[opponent];
  if (!opp) return [];
  const rows = [];
  if (own?.poss?.[0] != null && opp.poss?.[0] != null && finite(league.poss)) {
    const expected = (own.poss[0] + opp.poss[0]) / 2, gap = expected - league.poss;
    rows.push({key: 'pace', label: 'Pace tonight', note: `Possessions a game, both teams averaged: ${team} ${rankWords(own.poss[1], count, 10, {most: 'fastest', fewest: 'slowest'})}, ${opponent} ${rankWords(opp.poss[1], count, 10, {most: 'fastest', fewest: 'slowest'})}`,
      value: `${one(expected)} possessions`, words: Math.abs(gap) < 1 ? 'about average' : gap > 0 ? `${one(gap)} faster than average` : `${one(-gap)} slower than average`,
      tone: gap >= 1.5 ? 'good' : gap <= -1.5 ? 'poor' : 'neutral', league: `league ${one(league.poss)}`});
  }
  const row = (key, label, note, unit) => {
    const [value, rank] = opp[key] || [];
    if (!finite(value)) return;
    rows.push({key, label, note, value: `${one(value)}${unit}`, words: rankWords(rank, count), tone: rankTone(rank, count), league: finite(league[key]) ? `league ${one(league[key])}${unit.startsWith('%') ? '%' : ''}` : null});
  };
  const family = familyOf(stat);
  if (family !== 'rebounds') row('drtg', `${opponent} points allowed`, 'Per 100 possessions (defensive rating)', ' per 100');
  if (family === 'points') row('ftaAllowed', `${opponent} free throws allowed`, 'Free throws its opponents take a game', ' a game');
  if (family === 'rebounds' || has(stat, 'reb')) {
    row('miss', `${opponent} missed shots`, 'Shots it misses a game: defensive rebounds to be had', ' a game');
    row('gameMiss', `Missed shots in ${opponent} games`, 'Both teams, a game', ' a game');
  }
  if (family === 'assists' || has(stat, 'ast')) {
    row('fgPctAllowed', `${opponent} shooting allowed`, 'How well its opponents shoot: more passes become assists', '%');
    row('astAllowed', `${opponent} assists allowed`, 'A game', ' a game');
  }
  if (family === 'threes') {
    row('tpaAllowed', `${opponent} 3-point tries allowed`, 'A game', ' a game');
    row('tpPctAllowed', `${opponent} 3-point shooting allowed`, 'How well its opponents shoot threes', '%');
  }
  return rows;
}

/** A change, +1.2 or −0.8, or '' when either side is missing. */
const change = (a, b) => finite(a) && finite(b) ? signed(a - b) : '';

/**
 * Teammates on tonight's injury report and what he did without them: each
 * {id, name, status, games, parts: [{label, without, change}], stat}. The
 * parts are minutes and what this stat feeds on.
 */
export function absences(stat, injuries = [], withWithout = [], statLabel = 'the stat') {
  const impact = new Map((withWithout || []).map(item => [String(item.id), item]));
  const family = familyOf(stat);
  return (injuries || []).filter(item => /out|doubtful|questionable/i.test(item.status || '')).map(item => {
    const entry = impact.get(String(item.id));
    const without = entry?.without, along = entry?.with;
    const a = without?.chances, b = along?.chances;
    const parts = [];
    const part = (label, key, unit = '') => { if (finite(a?.[key])) parts.push({label, without: `${one(a[key])}${unit}`, change: change(a[key], b?.[key])}); };
    part('Minutes', 'min');
    if (family === 'points' || family === 'combo' || family === 'general') { part('Shots', 'fga'); part('Usage', 'usage', '%'); }
    if (family === 'threes') part('3-point tries', 'tpa');
    if (family === 'rebounds' || has(stat, 'reb')) part('Rebound share', 'rebShare', '%');
    if (family === 'assists' || has(stat, 'ast')) part('Assist share', 'astShare', '%');
    const statLine = finite(without?.avg) ? {label: statLabel, without: one(without.avg), change: change(without.avg, along?.avg)} : null;
    return {id: item.id, name: item.name, status: item.status, games: without?.games || 0, known: Boolean(entry), parts, stat: statLine};
  });
}

// ---------------------------------------------------------------- Analyze

const STAT_WORDS = {pts: 'points', reb: 'rebounds', oreb: 'offensive rebounds', dreb: 'defensive rebounds', ast: 'assists', tpm: 'threes',
  tpa: '3-point tries', fga: 'shot attempts', fta: 'free throws', pr: 'points and rebounds', pa: 'points and assists', ra: 'rebounds and assists',
  pra: 'points, rebounds and assists'};
// What the over takes: 27 for a 26.5 line (a whole-number line pushes at itself).
const takes = line => Number.isInteger(line) ? line : Math.floor(line) + 1;
const sum = (window, parts) => parts.reduce((total, part) => finite(total) && finite(window?.[part]) ? total + window[part] : null, 0);

/**
 * The volume a stat comes from and his rate on it: shot and free-throw
 * trips for points, misses while he plays for rebounds, potential assists
 * (or minutes) for assists, 3-point tries for threes, minutes for the rest.
 * {volume: {season, recent}, rate, unit, describe(need, needed)} or null.
 */
function volumeOf(stat, chances, tracking, projected) {
  const season = chances?.szn, recent = chances?.l10;
  if (!season) return null;
  const trips = window => finite(window?.fga) && finite(window?.fta) ? window.fga + 0.44 * window.fta : null;
  if (stat === 'pts' && trips(season) > 0) {
    const rate = season.pts / trips(season);
    return {season: trips(season), recent: trips(recent), rate, unit: 'shots and free-throw trips',
      how: `At his usual ${one(rate)} points a shot or free-throw trip`};
  }
  if (['reb', 'oreb', 'dreb'].includes(stat) && season.missesOn > 0 && season[stat] > 0) {
    const rate = season[stat] / season.missesOn;
    return {season: season.missesOn, recent: recent?.missesOn, rate, unit: 'missed shots while he plays',
      how: `He grabs 1 of every ${one(1 / rate)} missed shots while he’s on the floor`};
  }
  const passing = tracking?.available ? tracking.passing : null;
  if (stat === 'ast' && passing?.potentialAst > 0 && finite(passing.ast)) {
    const rate = passing.ast / passing.potentialAst;
    return {season: passing.potentialAst, recent: tracking.recent?.passing?.potentialAst, rate, unit: 'potential assists',
      how: `${Math.round(rate * 100)}% of his potential assists become assists (NBA tracking)`};
  }
  if (stat === 'tpm' && season.tpa > 0 && finite(season.tpPct) && season.tpPct > 0) {
    const rate = season.tpPct / 100;
    return {season: season.tpa, recent: recent?.tpa, rate, unit: '3-point tries', how: `He makes ${one(season.tpPct)}% of his threes`};
  }
  const parts = {ast: ['ast'], tpa: ['tpa'], fga: ['fga'], fta: ['fta'], pr: ['pts', 'reb'], pa: ['pts', 'ast'], ra: ['reb', 'ast'], pra: ['pts', 'reb', 'ast']}[stat];
  const per36 = parts ? sum(season.per36, parts) : null;
  if (!(per36 > 0) || !(season.min > 0)) return null;
  const rate = per36 / 36;
  return {season: season.min, recent: finite(projected) ? projected : recent?.min, rate, unit: 'minutes', projected: finite(projected),
    how: `At his ${one(per36)} ${STAT_WORDS[stat]} per 36 minutes`};
}

/**
 * Whether the chances behind a line are there (Analyze's opportunity read):
 * what the line takes at his usual rate, against what he's had lately, and
 * what moves it -- his minutes, a streak on hot shooting, teammates out
 * tonight, the pace. {verdict, title, text, points: [{tone, text}], ratio}
 * or null when the stat has no read. `side` is 'OVER' or 'UNDER'.
 */
export function opportunityRead(stat, line, side, {chances, tracking, projected, injuries, withWithout, table, team, opponent, statLabel} = {}) {
  const volume = volumeOf(stat, chances, tracking, projected);
  if (!volume || !finite(line) || !(volume.rate > 0)) return null;
  const need = takes(line), needed = need / volume.rate;
  const now = finite(volume.recent) ? volume.recent : volume.season;
  const ratio = now / needed, over = side !== 'UNDER';
  const lately = volume.unit === 'minutes'
    ? `he's ${volume.projected ? 'projected for' : 'averaged'} ${one(now)}${volume.projected ? '' : ' in his last 10'} (${one(volume.season)} this season)`
    : `he's had ${one(now)} a game in his last 10 (${one(volume.season)} this season)`;
  const text = `${volume.how}, ${volume.how.startsWith('At ') ? '' : 'so '}${need} ${STAT_WORDS[stat] || 'of them'} takes about ${one(needed)} ${volume.unit}; ${lately}.`;
  const backed = over ? ratio >= 1.07 : ratio <= 0.93, edge = over ? ratio >= 0.95 : ratio <= 1.05;
  const verdict = backed ? 'backed' : edge ? 'edge' : 'short';
  const title = verdict === 'backed' ? 'The chances are there' : verdict === 'edge' ? 'Right at the edge'
    : over ? 'He needs more chances than he’s been getting' : 'His chances point over this line';
  const points = [];
  const point = (good, text) => points.push({tone: good === null ? 'flat' : good === over ? 'up' : 'down', text});
  const season = chances.szn, recent = chances.l10;
  // A run on hot shooting rather than more chances.
  const parts = PARTS[stat] || [stat];
  const made = sum(season, parts), lastMade = sum(recent, parts);
  if (finite(made) && made > 0 && finite(lastMade) && finite(volume.recent) && volume.season > 0 && recent?.games >= 5) {
    const statUp = lastMade / made - 1, chancesUp = volume.recent / volume.season - 1;
    if (statUp >= 0.12 && chancesUp < 0.04) point(false, `His last 10 ran on efficiency, not more chances: ${one(lastMade)} ${STAT_WORDS[stat] || ''} a game (${one(made)} this season) on ${one(volume.recent)} ${volume.unit}`.replace(/ {2}/g, ' '));
    else if (statUp >= 0.08 && chancesUp >= 0.06) point(true, `More chances behind his last 10: ${one(volume.recent)} ${volume.unit} a game against ${one(volume.season)} this season`);
    else if (statUp <= -0.12 && chancesUp > -0.04) point(true, `His last 10 dipped on misses, not fewer chances: ${one(volume.recent)} ${volume.unit} a game, about his season`);
  }
  if (finite(season.min) && finite(recent?.min) && Math.abs(recent.min - season.min) >= 2 && volume.unit !== 'minutes')
    point(recent.min > season.min, `${recent.min > season.min ? 'More' : 'Fewer'} minutes lately: ${one(recent.min)} a game in his last 10, ${one(season.min)} this season`);
  for (const item of absences(stat, injuries, withWithout, statLabel)) {
    if (!/out|doubtful/i.test(item.status || '') || item.games < 3) continue;
    const shown = item.parts.filter(part => part.label !== 'Minutes' || item.parts.length === 1).slice(0, 2);
    const lead = item.stat || shown[0];
    if (!lead?.change) continue;
    point(lead.change.startsWith('+') ? true : lead.change.startsWith('−') ? false : null,
      `${item.name} is ${String(item.status).toLowerCase()}: without ${item.name.split(' ').at(-1)} he's averaged ${[item.stat, ...shown].filter(Boolean).map(part => `${part.without} ${part.label.toLowerCase()} (${part.change})`).join(', ')} in ${item.games} games`);
    break;
  }
  const pace = gameRows(stat, table, team, opponent).find(item => item.key === 'pace');
  if (pace && pace.tone !== 'neutral') point(pace.tone === 'good', `${pace.tone === 'good' ? 'A fast' : 'A slow'} game: ${pace.value} expected, ${pace.words}`);
  return {verdict, title, text, points, ratio, need, needed, now};
}

/**
 * The read as facts for grading (slip-matchup.js): how far the chances
 * clear what the line takes, and a teammate out who moves them. `sign` is
 * +1 for an over, -1 for an under.
 */
export function opportunityFacts(read, sign) {
  if (!read) return [];
  const impact = Math.max(-8, Math.min(8, (read.ratio - 1) * 50)) * sign;
  const facts = [{kind: 'usage', key: 'opportunity', text: read.text, impact}];
  const out = read.points.find(item => / is (out|doubtful): /.test(item.text));
  if (out) facts.push({kind: 'news', key: 'teammate-out', text: out.text, impact: out.tone === 'up' ? 4 : out.tone === 'down' ? -4 : 0});
  return facts;
}
