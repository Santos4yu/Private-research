import test from 'node:test';
import assert from 'node:assert/strict';
import {sideRecord, judgeLeg, candidates, scoreSlip, buildLadder, safest, reasons, exportLeg, slateGames, POWER} from '../src/smart-slip.js';

const NOW = Date.parse('2026-09-30T18:00:00Z');
const LATER = '2026-09-30T23:10:00Z';
const w = (hits, games, extra = {}) => ({hits, misses: games - hits, pushes: 0, decisions: games, sample: games, hitRate: hits / games * 100, ...extra});
let serial = 0;
function row({player = `Player ${++serial}`, sport = 'mlb', market = 'Total Bases', line = 1.5, modifier = 'standard', l10 = [7, 10], season = [30, 50],
  h2h = null, books = null, opponent = 'BOS', team = 'NYY', startsAt = LATER, game = null, ...extra} = {}) {
  return {id: `${sport}:${player}:${market}:${line}:${modifier}`, sport, player, market, line, modifier, direction: 'OVER', startsAt,
    teamAbbr: team, opponent, gameId: game || `${player}-game`, raw: {stat: market},
    windows: {l5: w(Math.round(l10[0] / 2), 5), l10: w(...l10), season: season && w(...season), h2h: h2h && w(...h2h)},
    apps: [{key: 'prizepicks', name: 'PrizePicks', over: null, under: null}, ...(books || [])], ...extra};
}

test('a record counts the side asked for, from counts or a rate', () => {
  const r = row({l10: [8, 10]});
  assert.deepEqual(sideRecord(r, 'l10', 'OVER'), {won: 8, games: 10, rate: 0.8});
  assert.deepEqual(sideRecord(r, 'l10', 'UNDER'), {won: 2, games: 10, rate: 0.2});
  assert.deepEqual(sideRecord({windows: {l10: {hitRate: 70, sample: 10}}}, 'l10', 'OVER'), {won: 7, games: 10, rate: 0.7});
  assert.equal(sideRecord({windows: {}}, 'l10', 'OVER'), null);
});

test('a well-backed pick has a sensible chance and its reasons in numbers', () => {
  const leg = judgeLeg(row({player: 'Aaron Judge', l10: [8, 10], season: [34, 50], h2h: [3, 4],
    books: [{key: 'draftkings', name: 'DraftKings', over: -160, under: 125}]}), 'OVER', {now: NOW});
  assert.ok(leg.chance > 0.6 && leg.chance < 0.72, leg.chance);
  assert.equal(leg.factor, 1);
  const shown = reasons(leg);
  assert.deepEqual(shown.slice(0, 4).map(item => [item.key, item.strong]), [['l10', '8/10'], ['season', '34/50'], ['books', `${Math.round(leg.book * 100)}%`], ['h2h', '3/4']]);
  assert.equal(shown[2].detail, 'DraftKings −160');
});

test('the Less side is judged on its own record', () => {
  const r = row({l10: [2, 10], season: [15, 50]});
  assert.equal(judgeLeg(r, 'OVER', {now: NOW}), null);
  const under = judgeLeg(r, 'UNDER', {now: NOW});
  assert.ok(under && under.chance > 0.6);
  assert.equal(reasons(under)[0].strong, '8/10');
});

test('picks the numbers do not back are never offered', () => {
  const rejected = {
    'thin sample': row({l10: [3, 3], season: null}),
    'books against it': row({l10: [8, 10], books: [{key: 'fanduel', over: 150, under: -190}]}),
    'weak record': row({l10: [5, 10], season: [24, 50]}),
    'game about to start': row({startsAt: new Date(NOW + 5 * 60000).toISOString()}),
    'not on PrizePicks': {...row(), apps: [{key: 'draftkings', over: -150, under: 120}]},
  };
  for (const [why, r] of Object.entries(rejected)) assert.equal(judgeLeg(r, 'OVER', {now: NOW}), null, why);
  assert.equal(judgeLeg(row({modifier: 'goblin', l10: [2, 10], season: [10, 50]}), 'UNDER', {now: NOW}), null, 'Goblins are More only');
});

test('a Goblin pays less and a Demon more, by how likely each is', () => {
  const goblin = judgeLeg(row({modifier: 'goblin', line: 0.5, l10: [9, 10], season: [42, 50],
    books: [{key: 'fanduel', over: -300, under: null}]}), 'OVER', {now: NOW});
  assert.ok(goblin.factor < 0.8 && goblin.factor >= 0.45, goblin.factor);
  const demon = judgeLeg(row({modifier: 'demon', line: 2.5, l10: [4, 10], season: [15, 50]}), 'OVER', {now: NOW});
  assert.ok(demon.factor > 1.15, demon.factor);
});

test('payouts follow the PrizePicks tables', () => {
  const leg = (chance, factor = 1, modifier = 'standard') => ({chance, factor, modifier});
  const power = scoreSlip([leg(0.6), leg(0.6)]);
  assert.equal(power.payout, 3);
  assert.ok(Math.abs(power.chance - 0.36) < 1e-9);
  assert.ok(Math.abs(power.value - 1.08) < 1e-9);
  assert.equal(power.estimated, false);
  assert.ok(Math.abs(scoreSlip([leg(0.8, 0.6, 'goblin'), leg(0.8, 0.6, 'goblin')]).payout - 1.08) < 1e-9);
  const flex = scoreSlip([leg(0.6), leg(0.6), leg(0.6)], 'flex');
  assert.equal(flex.payout, 3);
  // 3 of 3 pays 3x, 2 of 3 gets the money back.
  assert.ok(Math.abs(flex.value - (0.216 * 3 + 3 * 0.36 * 0.4 * 1)) < 1e-9);
  assert.equal(scoreSlip([leg(0.6), leg(0.6)], 'flex'), null);
});

test('a ladder of payout bands, never under 2x, one pick per player, one per game', () => {
  const rows = [
    row({player: 'A', l10: [8, 10], books: [{key: 'draftkings', over: -150, under: 120}]}),
    row({player: 'B', l10: [8, 10], season: [33, 50]}),
    row({player: 'C', l10: [7, 10], season: [31, 50]}),
    row({player: 'D', l10: [7, 10], season: [30, 50], game: 'shared'}),
    row({player: 'E', l10: [7, 10], season: [30, 50], game: 'shared'}),
    row({player: 'F', modifier: 'goblin', line: 0.5, l10: [10, 10], season: [48, 50]}),
    row({player: 'G', modifier: 'goblin', line: 0.5, l10: [10, 10], season: [47, 50]}),
    row({player: 'A', market: 'Hits', l10: [9, 10], season: [40, 50]}),
    row({player: 'H', modifier: 'demon', line: 3.5, l10: [5, 10], season: [22, 50]}),
    row({player: 'I', l10: [7, 10], season: [29, 50]}),
    row({player: 'J', l10: [7, 10], season: [29, 50]}),
  ];
  const pool = candidates(rows, {now: NOW});
  const ladder = buildLadder(pool);
  assert.ok(ladder.length >= 3);
  const next = {2: 3, 3: 5, 5: 10, 10: 20, 20: Infinity};
  for (const slip of ladder) {
    assert.ok(slip.payout >= slip.target - 1e-9 && slip.payout < next[slip.target], `${slip.payout} in the ${slip.target}x band`);
    assert.ok(slip.payout >= (slip.estimated ? 2.1 : 2), 'never under 2x, with room when estimated');
    const players = slip.legs.map(leg => leg.player);
    assert.equal(new Set(players).size, players.length, 'one pick per player');
    assert.ok(slip.legs.filter(leg => leg.game === 'mlb:shared').length <= 1, 'one per game');
    assert.ok(!slip.legs.every(leg => leg.modifier === 'goblin'), 'not a Goblin stack');
  }
  assert.deepEqual(ladder.map(slip => slip.target), [...ladder.map(slip => slip.target)].sort((a, b) => a - b));
  // Same-game picks allowed: two from that game may pair.
  const sameGame = buildLadder(pool, {sameGame: true, size: 6});
  assert.ok(sameGame.every(slip => slip.legs.length === 6));
  // Locked picks stay; excluded ones never come in.
  const lockedId = pool.find(leg => leg.player === 'C').id;
  const excludedId = ladder[0].legs[0].id === lockedId ? ladder[0].legs[1].id : ladder[0].legs[0].id;
  for (const slip of buildLadder(pool, {locked: [lockedId], excluded: [excludedId]})) {
    assert.ok(slip.legs.some(leg => leg.id === lockedId));
    assert.ok(!slip.legs.some(leg => leg.id === excludedId));
  }
  assert.equal(POWER[3], 6);
});

test('the member picks how the lines mix, and the safest slip is the one pointed to', () => {
  const rows = [
    row({player: 'A', l10: [8, 10], books: [{key: 'draftkings', over: -150, under: 120}]}),
    row({player: 'B', l10: [8, 10], season: [33, 50]}),
    row({player: 'C', l10: [7, 10], season: [31, 50]}),
    row({player: 'D', l10: [7, 10], season: [30, 50]}),
    row({player: 'F', modifier: 'goblin', line: 0.5, l10: [9, 10], season: [40, 50], books: [{key: 'draftkings', over: -230}]}),
    row({player: 'G', modifier: 'goblin', line: 0.5, l10: [9, 10], season: [39, 50], books: [{key: 'fanduel', over: -250}]}),
    row({player: 'H', modifier: 'demon', line: 3.5, l10: [5, 10], season: [22, 50]}),
    row({player: 'I', l10: [7, 10], season: [29, 50]}),
  ];
  const pool = candidates(rows, {now: NOW});
  const kinds = slip => slip.legs.map(leg => leg.modifier);
  const regular = buildLadder(pool, {mix: 'regular'});
  assert.ok(regular.length && regular.every(slip => kinds(slip).every(kind => kind === 'standard')));
  const goblin = buildLadder(pool, {mix: 'goblin'});
  assert.ok(goblin.length);
  for (const slip of goblin) {
    assert.ok(kinds(slip).includes('goblin') && kinds(slip).includes('standard') && !kinds(slip).includes('demon'), kinds(slip).join());
    // Never more Goblins than regular lines.
    assert.ok(kinds(slip).filter(kind => kind === 'goblin').length <= kinds(slip).filter(kind => kind === 'standard').length, kinds(slip).join());
    assert.ok(slip.payout >= 2);
  }
  // Two picks, a regular and a Goblin, still pay at least 2x -- by an
  // estimate with room to spare.
  assert.ok(buildLadder(pool, {mix: 'goblin', size: 2}).every(slip => slip.legs.length === 2 && slip.payout >= 2.1));
  for (const slip of buildLadder(pool, {mix: 'demon'})) assert.ok(kinds(slip).includes('demon') && !kinds(slip).includes('goblin'));
  // The safest slip is the likeliest to hit: the lowest payout band here.
  const ladder = buildLadder(pool);
  const pick = safest(ladder);
  assert.equal(pick.chance, Math.max(...ladder.map(slip => slip.chance)));
  assert.equal(pick.target, 2);
  assert.equal(safest([]), null);
});

test('in each band the likeliest fair slip wins, not the richest', () => {
  const leg = (id, chance, modifier = 'standard', factor = 1) => ({id, player: id, row: {id}, game: id, chance, modifier, factor});
  const pool = [leg('A', 0.62), leg('B', 0.55), leg('G', 0.75, 'goblin', 0.72), leg('H', 0.8, 'goblin', 0.63)];
  // A + G pays about 2.2x and hits 46.5%; A + G + H pays about 2.7x, a
  // touch more value, but hits only 37%.
  const [safe] = buildLadder(pool, {size: 'auto'});
  assert.equal(safe.target, 2);
  assert.deepEqual(safe.legs.map(item => item.id).sort(), ['A', 'G']);
  // A slip well short of fair loses to a fair one however likely it is.
  const [fair] = buildLadder([...pool, leg('Z', 0.97, 'goblin', 0.4)], {size: 2});
  assert.ok(fair.value >= 0.95, fair.value);
  // Only the bands asked for are filled.
  assert.deepEqual(buildLadder(pool, {only: [3]}).map(slip => slip.target), [3]);
});

test('a slip goes to PrizePicks under PrizePicks\' own stat name', () => {
  const leg = judgeLeg(row({player: 'Aaron Judge', l10: [8, 10], raw: {stat: 'Total Bases'}}), 'OVER', {now: NOW});
  assert.deepEqual(exportLeg(leg), {league: 'MLB', player: 'Aaron Judge', stat: 'Total Bases', line: 1.5, side: 'over', modifier: 'standard'});
});

test('the games on the board: teams away first, logos, players, soonest first, started ones left out', () => {
  const soon = new Date(NOW + 2 * 3600e3).toISOString(), later = new Date(NOW + 5 * 3600e3).toISOString();
  const rows = [
    row({player: 'Judge', team: 'NYY', opponent: 'BOS', isHome: false, startsAt: later, game: 'g2', headshot: 'judge.png'}),
    row({player: 'Devers', team: 'BOS', opponent: 'NYY', isHome: true, startsAt: later, game: 'g2'}),
    row({player: 'Judge', market: 'Hits', team: 'NYY', opponent: 'BOS', isHome: false, startsAt: later, game: 'g2'}),
    row({player: 'Soto', team: 'NYM', opponent: 'ATL', isHome: true, startsAt: soon, game: 'g1'}),
    row({player: 'Gone', team: 'LAD', opponent: 'SD', startsAt: new Date(NOW + 60000).toISOString(), game: 'g0'}),
  ];
  const games = slateGames(rows, {now: NOW, logo: r => `logo-${r.teamAbbr}`, opponentLogo: r => `logo-${r.opponent}`});
  assert.deepEqual(games.map(game => game.key), ['mlb:g1', 'mlb:g2']);
  const [first, second] = games;
  assert.deepEqual([first.away.abbr, first.home.abbr], ['ATL', 'NYM']);
  assert.deepEqual([second.away, second.home], [{abbr: 'NYY', logo: 'logo-NYY'}, {abbr: 'BOS', logo: 'logo-BOS'}]);
  assert.deepEqual(second.players.map(player => player.name), ['Judge', 'Devers']);
  assert.equal(second.players[0].headshot, 'judge.png');
});

test('a one-game parlay takes its picks from that game, never all from one team', () => {
  const rows = ['A', 'B', 'C'].map(player => row({player, team: 'NYY', opponent: 'BOS', game: 'one', l10: [8, 10], season: [35, 50]}))
    .concat(['D', 'E'].map(player => row({player, team: 'BOS', opponent: 'NYY', game: 'one', l10: [7, 10], season: [31, 50]})));
  const pool = candidates(rows, {now: NOW});
  // One pick per game by default: no slip at all from a single game.
  assert.equal(buildLadder(pool).length, 0);
  const ladder = buildLadder(pool, {perGame: 6});
  assert.ok(ladder.length);
  for (const slip of ladder) {
    assert.ok(slip.legs.every(leg => leg.game === 'mlb:one'));
    assert.ok(new Set(slip.legs.map(leg => leg.row.teamAbbr)).size === 2, 'both teams on the slip');
  }
  // Only one team's players: nothing PrizePicks would take.
  assert.equal(buildLadder(candidates(rows.slice(0, 3), {now: NOW}), {perGame: 6}).length, 0);
});

test('a slip carries one PrizePicks promo line at most', () => {
  // The strongest picks on the board are all promos; every slip still takes one at most.
  const rows = [
    row({player: 'P1', line: 0.5, l10: [10, 10], season: [49, 50], promo: true}),
    row({player: 'P2', line: 0.5, l10: [10, 10], season: [48, 50], promo: true}),
    row({player: 'P3', line: 0.5, l10: [10, 10], season: [48, 50], promo: true}),
    row({player: 'A', l10: [8, 10], season: [34, 50]}),
    row({player: 'B', l10: [8, 10], season: [33, 50]}),
    row({player: 'C', l10: [7, 10], season: [31, 50]}),
    row({player: 'D', l10: [7, 10], season: [30, 50]}),
  ];
  const ladder = buildLadder(candidates(rows, {now: NOW}), {sameGame: true});
  assert.ok(ladder.length);
  for (const slip of ladder) assert.ok(slip.legs.filter(leg => leg.row.promo).length <= 1, slip.legs.map(leg => leg.player).join(', '));
  assert.ok(ladder.some(slip => slip.legs.some(leg => leg.row.promo)), 'one promo is still welcome');
});
