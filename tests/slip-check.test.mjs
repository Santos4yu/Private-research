import test from 'node:test';
import assert from 'node:assert/strict';
import {statKeys, rowStatKey, nameFit, playerRows, locate, relined, gradeLeg, scoreEntry, verdict, swaps, sideWord, checkLeg, tierOf, TIERS} from '../src/slip-check.js';

const LATER = '2099-09-30T23:10:00Z';
const w = (hits, games) => ({hits, misses: games - hits, pushes: 0, decisions: games, sample: games, hitRate: hits / games * 100});
const games = values => values.map((value, index) => ({value, date: `2026-0${1 + Math.floor(index / 28)}-${String(1 + index % 28).padStart(2, '0')}`, opponent: index % 4 ? 'BOS' : 'TOR'}));
let serial = 0;
function row({player, sport = 'mlb', market = 'Total Bases', line = 1.5, modifier = 'standard', team = 'NYY', l10 = [7, 10],
  season = [30, 50], log = null, ...extra} = {}) {
  return {id: `${sport}:${player}:${market}:${line}:${modifier}:${++serial}`, sport, player, playerId: `${player}-id`, market, line,
    modifier, direction: 'OVER', startsAt: LATER, teamAbbr: team, opponent: 'BOS', raw: {stat: market}, gameLog: log ? games(log) : [],
    windows: {l5: w(Math.round(l10[0] / 2), 5), l10: w(...l10), season: w(...season), h2h: null},
    apps: [{key: 'prizepicks', name: 'PrizePicks', over: null, under: null}], historyStatus: 'ready', ...extra};
}
const leg = (extra) => ({team: '', opponent: '', sport: null, statName: '', modifier: 'standard', odds: null, needs: [], ...extra});

test('every app\'s way of naming a stat reaches the same key', () => {
  const same = (sport, ...names) => {
    const keys = names.map(name => statKeys(sport, name)[0]);
    assert.ok(keys[0], `${names[0]} has a key`);
    assert.deepEqual(new Set(keys).size, 1, `${names.join(' / ')} -> ${keys.join(' / ')}`);
  };
  same('nba', 'Pts+Rebs+Asts', 'Points + Rebounds + Assists', 'PRA', 'pts + reb + ast');
  same('wnba', '3-PT Made', '3-Pointers Made', 'Threes', '3PM');
  same('nba', 'Blks+Stls', 'Blocks + Steals', 'Stocks');
  same('mlb', 'Hits+Runs+RBIs', 'Hits + Runs + RBIs', 'H+R+RBI', 'HRR', 'hits runs rbis');
  same('mlb', 'Total Bases', 'TB', '1+ Total Bases');
  same('mlb', 'Earned Runs Allowed', 'Earned Runs', 'ER');
  same('nfl', 'Rush + Rec Yds', 'Rushing + Receiving Yards', 'Rush Yards + Rec Yards');
  same('nfl', 'Receiving Yards', 'Rec Yds', 'Receiving Yds');
  same('nfl', 'Pass TDs', 'Passing Touchdowns');
  same('nfl', 'Receptions', 'Catches');
  same('nfl', 'Rush + Rec TDs', 'Anytime Touchdown', 'Anytime TD');
  same('nhl', 'Shots On Goal', 'SOG', 'Shots on goal');
  same('nhl', 'Goalie Saves', 'Saves');
  same('soccer', 'Shots On Target', 'SOT');
  same('soccer', 'Goal + Assist', 'Goals + Assists');
  assert.notEqual(statKeys('nfl', 'Rush Yards')[0], statKeys('nfl', 'Receiving Yards')[0]);
  assert.notEqual(statKeys('nba', 'Points')[0], statKeys('nba', 'Pts+Rebs')[0]);
  // Plain "Strikeouts" may be a pitcher's.
  assert.deepEqual(statKeys('mlb', 'Strikeouts'), ['h:strikeouts', 'p:strikeouts']);
  assert.deepEqual(statKeys('mlb', 'Pitcher Strikeouts'), ['p:strikeouts']);
  assert.deepEqual(statKeys('nfl', 'Interceptions'), ['int', 'int+pass']);
  assert.equal(rowStatKey({sport: 'mlb', market: 'Strikeouts (Pitcher)', raw: {stat: 'Pitcher Strikeouts'}}), 'p:strikeouts');
});

test('names match through initials, accents, suffixes and small misspellings', () => {
  assert.equal(nameFit('Aaron Judge', 'Aaron Judge'), 3);
  assert.equal(nameFit('Luka Doncic', 'Luka Dončić'), 3);
  assert.equal(nameFit('Ronald Acuna Jr.', 'Ronald Acuña Jr'), 3);
  assert.equal(nameFit('J. Allen', 'Josh Allen'), 2);
  assert.equal(nameFit('Vladimir Guerrero', 'Vladimir Guerrero Jr.'), 3);
  assert.equal(nameFit('Shohei Ohtanl', 'Shohei Ohtani'), 1);
  assert.equal(nameFit('Josh Allen', 'Josh Hart'), 0);
  const rows = [row({player: 'Josh Allen', sport: 'nfl', team: 'BUF'}), row({player: 'Josh Allen', sport: 'nfl', team: 'JAX'})];
  assert.deepEqual(playerRows(leg({player: 'J. Allen', team: 'JAX'}), rows).map(r => r.teamAbbr), ['JAX']);
});

test('a leg finds its board line, or the player\'s games at its own number', async () => {
  const judgeTb = row({player: 'Aaron Judge', market: 'Total Bases', line: 1.5, l10: [6, 10], log: [0, 2, 3, 1, 4, 0, 2, 2, 5, 1, 0, 3]});
  const judgeHrr = row({player: 'Aaron Judge', market: 'Hits+Runs+RBIs', line: 2.5});
  const boards = {mlb: [judgeTb, judgeHrr, row({player: 'Juan Soto'})], nfl: [row({player: 'Josh Allen', sport: 'nfl', market: 'Pass Yards', line: 245.5})]};

  const exact = locate(leg({player: 'Aaron Judge', sport: 'mlb', stat: 'H+R+RBI', line: 2.5, side: 'OVER'}), boards);
  assert.equal(exact.state, 'ready');
  assert.equal(exact.board, judgeHrr);

  const other = locate(leg({player: 'Aaron Judge', sport: 'mlb', stat: 'Total Bases', line: 2.5, side: 'OVER'}), boards);
  assert.equal(other.state, 'relined');
  assert.equal(other.board, judgeTb);
  const moved = await relined(other.board, 2.5);
  // The last 10 games at 2.5: 3, 4, 5, 3 clear it.
  assert.equal(moved.line, 2.5);
  assert.deepEqual([moved.windows.l10.hits, moved.windows.l10.sample], [4, 10]);
  assert.equal(moved.relinedFrom, 1.5);
  assert.ok(moved.apps.every(app => app.over == null && app.under == null));

  // The sport misread: the player is still found.
  assert.equal(locate(leg({player: 'Josh Allen', sport: 'mlb', stat: 'Passing Yards', line: 245.5, side: 'UNDER'}), boards).state, 'ready');
  assert.equal(locate(leg({player: 'Juan Soto', sport: 'mlb', stat: 'Stolen Bases', line: 0.5, side: 'OVER'}), boards).state, 'stat');
  assert.equal(locate(leg({player: 'Mike Trout', sport: 'mlb', stat: 'Hits', line: 0.5, side: 'OVER'}), boards).state, 'player');
  assert.equal(locate(leg({player: 'Aaron Judge', sport: 'mlb', stat: 'Total Bases', line: 1.5, side: null}), boards).state, 'needs');
});

test('a relined leg is re-scored by the sport\'s own history when there is one', async () => {
  const base = row({player: 'A\'ja Wilson', sport: 'wnba', market: 'Points', line: 22.5});
  const asked = [];
  const enrich = async (rows) => { asked.push(rows[0]); return [{...rows[0], historyStatus: 'ready', windows: {l10: w(3, 10)}}]; };
  const moved = await relined(base, 26.5, {enrich});
  assert.equal(asked[0].line, 26.5);
  assert.equal(asked[0].historyStatus, 'pending');
  assert.equal(moved.windows.l10.hits, 3);
  assert.equal(moved.modifier, 'standard');
});

test('legs are graded, and the slip scored on its own payout', () => {
  const strong = row({player: 'A', l10: [8, 10], season: [36, 50]});
  const fair = row({player: 'B', l10: [6, 10], season: [28, 50]});
  const weak = row({player: 'C', l10: [3, 10], season: [20, 50]});
  const legs = [[strong, 'OVER'], [fair, 'OVER'], [weak, 'OVER']].map(([r, side]) => ({...leg({player: r.player, side, line: r.line}), grade: gradeLeg({side}, r)}));
  assert.ok(legs.every(item => item.grade));
  assert.ok(legs[0].grade.chance > legs[2].grade.chance);
  const priced = scoreEntry(legs, {app: {key: 'prizepicks'}, entry: {type: 'power'}});
  assert.equal(priced.multiplier, 6);
  assert.equal(priced.weakest.player, 'C');
  assert.ok(Math.abs(priced.chance - legs.reduce((p, item) => p * item.grade.chance, 1)) < 1e-9);
  assert.ok(Math.abs(priced.value - priced.chance * 6) < 1e-9);
  assert.match(verdict(priced), /All 3 hit about 1 in \d+ times, and at 6x/);
  // A sportsbook parlay: the legs' own odds make the payout.
  const book = scoreEntry(legs.map(item => ({...item, odds: -110})), {app: {key: 'fanduel'}});
  assert.ok(Math.abs(book.multiplier - (1 + 100 / 110) ** 3) < 1e-9);
  // Flex counts the near misses too.
  const flex = scoreEntry(legs, {app: {key: 'prizepicks'}, entry: {type: 'flex'}});
  assert.ok(flex.value > flex.chance * flex.multiplier);
  // The parlay gets one letter; every pick gets a tier instead.
  assert.match(priced.letter, /^[A-DF][+-]?$/);
  assert.equal(priced.best.player, 'A');
  assert.ok(legs.every(item => TIERS[item.grade.tier]));
  assert.ok(TIERS[legs[0].grade.tier].rank > TIERS[legs[2].grade.tier].rank);
  assert.equal(Object.values(priced.tiers).reduce((sum, count) => sum + count, 0), 3);
  // An ungraded leg counts as a coin flip, so the parlay is still graded.
  const partial = scoreEntry([...legs, leg({player: 'D'})], {app: {key: 'prizepicks'}});
  assert.ok(Math.abs(partial.chance - priced.chance * 0.5) < 1e-9);
  assert.equal(partial.partial, true);
  assert.equal(partial.graded, 3);
  assert.equal(partial.multiplier, 10);
  assert.match(verdict(partial), /couldn't be graded/);
  // No app or payout read: a usual Power Play of that size is assumed.
  const plain = scoreEntry(legs, {});
  assert.equal(plain.multiplier, 6);
  assert.equal(plain.assumed, true);
  assert.match(verdict(plain), /a usual 6x/);
});

test('each tier reads the pick: backed picks are Strong or Elite, the rest Lean, Risky or Fade', () => {
  assert.equal(tierOf({chance: 0.66, backed: true, grade: 'A', modifier: 'standard'}), 'elite');
  assert.equal(tierOf({chance: 0.57, backed: true, grade: 'B', modifier: 'standard'}), 'strong');
  assert.equal(tierOf({chance: 0.53, backed: false, grade: 'C', modifier: 'standard'}), 'lean');
  assert.equal(tierOf({chance: 0.48, backed: false, grade: 'C', modifier: 'standard'}), 'risky');
  assert.equal(tierOf({chance: 0.38, backed: false, grade: 'C', modifier: 'standard'}), 'fade');
  // A Goblin is measured against the 70% it's priced at.
  assert.equal(tierOf({chance: 0.6, backed: false, grade: 'C', modifier: 'goblin', book: null}), 'fade');
});

test('"Rec Targets" and "Targets" are the same NFL stat', () => {
  assert.deepEqual(statKeys('nfl', 'Rec Targets'), statKeys('nfl', 'Targets'));
  assert.deepEqual(statKeys('nfl', 'Receiving Yards'), statKeys('nfl', 'Rec Yards'));
});

test('a player off the board (his game started) is looked up and graded from his games', async () => {
  const found = row({player: 'Josh Downs', l10: [7, 10], season: [30, 50]});
  const asked = [];
  const lookup = async (item, sports) => { asked.push([item.player, sports]); return {...found, sport: 'nfl'}; };
  const checked = await checkLeg(leg({player: 'Josh Downs', sport: 'nfl', stat: 'Rec Yards', line: 71.5, side: 'OVER'}), {nfl: []}, {lookup});
  assert.deepEqual(asked, [['Josh Downs', ['nfl']]]);
  assert.equal(checked.state, 'history');
  assert.ok(checked.grade.chance > 0.5);
  assert.ok(TIERS[checked.grade.tier]);
  // No side read: graded as More, and flagged.
  const unread = await checkLeg(leg({player: 'Josh Downs', sport: 'nfl', stat: 'Rec Yards', line: 71.5, side: null}), {nfl: []}, {lookup});
  assert.equal(unread.state, 'history');
  assert.equal(unread.side, 'OVER');
  assert.equal(unread.assumedSide, true);
  // No line read: the player is found, the pick waits for its line.
  const noLine = await checkLeg(leg({player: 'Josh Downs', sport: 'nfl', stat: 'Rec Yards', line: null, side: 'OVER'}), {nfl: []}, {lookup});
  assert.equal(noLine.state, 'needs');
  assert.equal(noLine.row.player, 'Josh Downs');
  // League data out of reach: said so, not "not found".
  const down = await checkLeg(leg({player: 'Josh Downs', sport: 'nfl', stat: 'Rec Yards', line: 71.5, side: 'OVER'}), {nfl: []},
    {lookup: async () => { throw new Error('NFL research is temporarily unavailable.'); }});
  assert.equal(down.lookupError, 'NFL research is temporarily unavailable.');
  // Nobody by that name: left ungraded.
  const missing = await checkLeg(leg({player: 'Nobody Here', sport: 'nfl', stat: 'Rec Yards', line: 10.5, side: 'OVER'}), {nfl: []}, {lookup: async () => null});
  assert.equal(missing.state, 'player');
  assert.equal(missing.grade, null);
});

test('a sportsbook price shows the edge over its implied chance', () => {
  const r = row({player: 'A', l10: [8, 10], season: [36, 50]});
  const graded = gradeLeg({side: 'OVER', odds: -150}, r);
  assert.ok(Math.abs(graded.implied - 0.6) < 1e-9);
  assert.ok(Math.abs(graded.edge - (graded.chance - 0.6)) < 1e-9);
});

test('a weak leg gets better swaps from the boards', () => {
  const weak = {...leg({player: 'C', sport: 'mlb'}), grade: {chance: 0.42}};
  const pool = [
    {backed: true, chance: 0.66, player: 'D', modifier: 'standard', row: {sport: 'mlb'}},
    {backed: true, chance: 0.7, player: 'C', modifier: 'standard', row: {sport: 'mlb'}},
    {backed: true, chance: 0.72, player: 'E', modifier: 'standard', row: {sport: 'nfl'}},
    {backed: false, chance: 0.8, player: 'F', modifier: 'standard', row: {sport: 'mlb'}},
  ];
  assert.deepEqual(swaps([weak], pool).map(read => read.player), ['D']);
  assert.deepEqual(swaps([{...weak, grade: {chance: 0.65}}], pool), []);
});

test('sides read the way each app says them', () => {
  assert.equal(sideWord('OVER', {key: 'prizepicks'}), 'More');
  assert.equal(sideWord('UNDER', {key: 'underdog'}), 'Lower');
  assert.equal(sideWord('UNDER', {key: 'fanduel'}), 'Under');
});

test('a leg is checked end to end: located, filled in, re-scored and graded', async () => {
  const {checkLeg, offeredStats} = await import('../src/slip-check.js');
  const pending = row({player: 'Caitlin Clark', sport: 'wnba', market: 'Assists', line: 7.5, historyStatus: 'pending', windows: null});
  const boards = {wnba: [pending, row({player: 'Caitlin Clark', sport: 'wnba', market: 'Points', line: 19.5})]};
  const filled = [];
  const enrich = async rows => rows.map(item => { filled.push(item.line); return {...item, historyStatus: 'ready', windows: {l10: w(8, 10), season: w(30, 40)}}; });
  const ready = await checkLeg(leg({player: 'Caitlin Clark', sport: 'wnba', stat: 'Assists', line: 7.5, side: 'OVER'}), boards, {enrichFor: () => enrich});
  assert.equal(ready.state, 'ready');
  assert.ok(ready.grade.chance > 0.55);
  const moved = await checkLeg(leg({player: 'Caitlin Clark', sport: 'wnba', stat: 'Assists', line: 9.5, side: 'UNDER'}), boards, {enrichFor: () => enrich});
  assert.equal(moved.state, 'relined');
  assert.equal(moved.row.line, 9.5);
  assert.deepEqual(filled, [7.5, 9.5]);
  const missing = await checkLeg(leg({player: 'Caitlin Clark', sport: 'wnba', stat: 'Steals', line: 1.5, side: 'OVER'}), boards);
  assert.equal(missing.state, 'stat');
  assert.deepEqual(offeredStats(missing.spot), ['Assists', 'Points']);
});
