// Smarter picks, for every page alike: the books' read of a stat moved to
// PrizePicks' number (line-value.js), and same-game picks that go together
// sought out while ones that work against each other are kept apart.
import test from 'node:test';
import assert from 'node:assert/strict';
import {moveChance, withBookLines} from '../src/line-value.js';
import {judgeLeg, reasons, buildLadder} from '../src/smart-slip.js';
import {link, against} from '../src/slip-correlation.js';

const NOW = Date.parse('2026-10-12T16:00:00Z');
const KICK = '2026-10-12T20:25:00Z';
const w = (hits, games) => ({hits, misses: games - hits, pushes: 0, decisions: games, sample: games, hitRate: hits / games * 100});
const pp = {key: 'prizepicks', name: 'PrizePicks', over: null, under: null};
function row({player = 'Rashee Rice', market = 'Receiving Yards', line = 59.5, modifier = 'standard', apps = [pp], game = 'g1',
  team = 'KC', opponent = 'BUF', l10 = [6, 10], season = [9, 15], position = 'WR'} = {}) {
  return {id: `nfl:${player}:${market}:${line}:${modifier}:${apps.map(app => app.key).join('-')}`, sport: 'nfl', player, market, line, modifier,
    direction: 'OVER', startsAt: KICK, teamAbbr: team, opponent, gameId: game, position, raw: {stat: market},
    windows: {l5: w(Math.round(l10[0] / 2), 5), l10: w(...l10), season: w(...season)}, apps};
}
const books = [{key: 'draftkings', name: 'DraftKings', over: -110, under: -110}, {key: 'fanduel', name: 'FanDuel', over: -112, under: -108}];

test('a book line a few yards higher makes the Over at PrizePicks\' number better than a coin flip', () => {
  const lower = moveChance(0.5, 64.5, 59.5, 15);
  assert.ok(lower > 0.55 && lower < 0.62, lower);
  const higher = moveChance(0.5, 64.5, 69.5, 15);
  assert.ok(Math.abs(higher - (1 - lower)) < 1e-9, 'the same distance the other way');
  assert.equal(moveChance(0.5, 64.5, 64.5, 15), 0.5);
  // Too far apart, or a price too lopsided to trust: nothing said.
  assert.equal(moveChance(0.5, 64.5, 20.5, 15), null);
  assert.equal(moveChance(0.9, 64.5, 59.5, 15), null);
  // A count swings less than yards: half a point moves it further.
  assert.ok(moveChance(0.5, 5.5, 4.5, 1.3) - 0.5 > lower - 0.5);
});

test('a PrizePicks line with no prices of its own gets the books\' nearest line', () => {
  const rows = withBookLines([
    row(),
    row({apps: books, line: 64.5}),
    row({apps: books, line: 74.5}),
    row({player: 'Travis Kelce', line: 44.5, apps: [pp, ...books]}),
    row({player: 'Travis Kelce', line: 52.5, apps: books}),
    row({modifier: 'goblin', line: 39.5}),
    row({player: 'Xavier Worthy', game: 'g9', line: 40.5}),
    row({player: 'Xavier Worthy', game: 'g1', line: 45.5, apps: books}),
  ]);
  assert.equal(rows[0].bookLine.line, 64.5);
  assert.ok(rows[0].bookLine.over > 0.55, rows[0].bookLine.over);
  assert.deepEqual(rows[0].bookLine.books, ['DraftKings', 'FanDuel']);
  assert.equal(rows[3].bookLine, undefined, 'priced at its own number already');
  assert.equal(rows[5].bookLine, undefined, 'Goblins and Demons keep their own pricing');
  assert.equal(rows[6].bookLine, undefined, 'another game');
  assert.equal(rows[1].bookLine, undefined, 'the books\' own rows are left alone');
});

test('the moved read counts in the pick, said plainly', () => {
  const [moved] = withBookLines([row({l10: [6, 10], season: [9, 15]}), row({apps: books, line: 66.5})]);
  const plain = judgeLeg(row({l10: [6, 10], season: [9, 15]}), 'OVER', {now: NOW});
  const read = judgeLeg(moved, 'OVER', {now: NOW});
  assert.ok(read.book > 0.55 && read.bookLine === 66.5, JSON.stringify({book: read.book}));
  assert.ok(read.chance > (plain?.chance ?? 0.5), `${read.chance} vs ${plain?.chance}`);
  const shown = reasons(read).find(item => item.key === 'books');
  assert.equal(shown.detail, 'their line 66.5');
});

// Picks as the Builder's search takes them, with their chances set.
function leg({player, team, opponent, game, market, position, chance, sport = 'nfl'}) {
  const r = {id: `${sport}:${player}:${market}`, sport, player, market, line: 50.5, modifier: 'standard', direction: 'OVER', startsAt: KICK,
    teamAbbr: team, opponent, gameId: game, position, raw: {stat: market}, apps: [pp]};
  return {id: `${r.id}|OVER`, row: r, side: 'OVER', modifier: 'standard', chance, factor: 1, game: `nfl:${game}`, player};
}
const fillers = Array.from({length: 60}, (_, i) => leg({player: `Back ${i}`, team: `T${i}`, opponent: `O${i}`, game: `f${i}`,
  market: 'Rush Yards', position: 'RB', chance: 0.6}));

test('a slip that may take two from a game finds the pick that goes with its best', () => {
  const qb = leg({player: 'Patrick Mahomes', team: 'KC', opponent: 'BUF', game: 'g1', market: 'Pass Yards', position: 'QB', chance: 0.66});
  const wr = leg({player: 'Rashee Rice', team: 'KC', opponent: 'BUF', game: 'g1', market: 'Receiving Yards', position: 'WR', chance: 0.56});
  const pool = [qb, wr, ...fillers];
  const together = buildLadder(pool, {sameGame: true, size: 3, targets: [5]})[0];
  assert.ok(together.legs.includes(qb) && together.legs.includes(wr), together.legs.map(item => item.player).join(', '));
  assert.ok(together.chance > 0.66 * 0.56 * 0.6, 'counted as going together');
  // One a game: the receiver has nothing to go with, and misses the cut.
  const apart = buildLadder(pool, {size: 3, targets: [5]})[0];
  assert.ok(!apart.legs.includes(wr));
});

test('picks that work against each other never share a slip', () => {
  const pitcher = leg({sport: 'mlb', player: 'Garrett Crochet', team: 'BOS', opponent: 'NYY', game: 'm1', market: 'Pitcher Strikeouts', chance: 0.7});
  const hitters = ['Aaron Judge', 'Juan Soto'].map((player, i) => leg({sport: 'mlb', player, team: 'NYY', opponent: 'BOS', game: 'm1',
    market: 'Hits', chance: 0.64 - i * 0.01}));
  assert.ok(against(link(pitcher, hitters[0])), 'his strikeouts and their hits pull different ways');
  const other = leg({sport: 'mlb', player: 'Bobby Witt Jr.', team: 'KC', opponent: 'DET', game: 'm2', market: 'Hits', chance: 0.6});
  const ladder = buildLadder([pitcher, ...hitters, other], {perGame: 3, size: 'auto'});
  assert.ok(ladder.length > 0);
  for (const slip of ladder) {
    const names = slip.legs.map(item => item.player);
    assert.ok(!(names.includes('Garrett Crochet') && names.some(name => name === 'Aaron Judge' || name === 'Juan Soto')), names.join(', '));
  }
});

// A one-event line (an RBI): a hot ten games over a poor season is luck.
const hitter = (l10, season) => ({id: `mlb:h:${l10}:${season}`, sport: 'mlb', player: 'Hitter', market: 'RBIs', line: 0.5, modifier: 'standard', direction: 'OVER',
  startsAt: KICK, teamAbbr: 'NYY', opponent: 'BOS', gameId: 'm9', raw: {stat: 'RBIs'}, apps: [pp],
  windows: {l5: w(Math.min(5, Math.round(l10[0] / 2)), 5), l10: w(...l10), l15: w(Math.round(l10[0] * 1.2), 15), l20: w(Math.round(season[0] / season[1] * 20), 20), season: w(...season)}});

test('a one-event line is judged on the season, not a hot week', () => {
  assert.equal(judgeLeg(hitter([7, 10], [30, 100]), 'OVER', {now: NOW}), null, '7 of his last 10, but 30% on the season');
  const steady = judgeLeg(hitter([6, 10], [58, 100]), 'OVER', {now: NOW});
  assert.ok(steady, 'a season of driving runs in still makes it');
  assert.ok(steady.chance < 0.6 && steady.chance > 0.5, steady.chance);
});
