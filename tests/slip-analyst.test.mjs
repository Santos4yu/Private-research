import test from 'node:test';
import assert from 'node:assert/strict';
import {sideChance, matchupRead, readPick, grade, conflicted, analystNote, homeToday} from '../src/slip-analyst.js';
import {judgeLeg, reasons} from '../src/smart-slip.js';

const NOW = Date.parse('2026-09-30T18:00:00Z');
const near = (actual, expected, within = 0.005) => assert.ok(Math.abs(actual - expected) <= within, `${actual} vs ${expected}`);

test('a count stat reads off a Poisson, a wide one off a negative binomial, a big one off a curve', () => {
  // One or more hits with a 1.2 average: 1 - e^-1.2.
  near(sideChance(1.2, 1.2, 0.5, 'OVER'), 1 - Math.exp(-1.2));
  near(sideChance(1.2, 1.2, 0.5, 'UNDER'), Math.exp(-1.2));
  // Same average, games spread wider: more zeroes, so the Over is less likely.
  assert.ok(sideChance(1.2, 2.4, 0.5, 'OVER') < 1 - Math.exp(-1.2));
  // A whole-number line: a push is no result, the rest split between sides.
  near(sideChance(2, 2, 2, 'OVER') + sideChance(2, 2, 2, 'UNDER'), 1, 1e-9);
  // Points: 27 average against 24.5 is well over even; fractional stats use the curve.
  assert.ok(sideChance(27, 36, 24.5, 'OVER') > 0.6);
  near(sideChance(80, 400, 80, 'OVER', {counts: false}), 0.5);
});

test('the matchup: what a defense allows against the league, and MLB starters and lineups', () => {
  const wnba = matchupRead({sport: 'wnba', opponent: 'LV', market: 'Points', defenseValue: 18, defenseRecent: 20, defenseAverage: 15,
    defense: 12, defenseTeams: 13, defensePosition: 'G'});
  assert.ok(wnba.factor > 1.05 && wnba.factor <= 1.1, wnba.factor);
  assert.equal(wnba.text, 'LV allows 18 points to guards, 20% more than average (2nd-most)');
  const tough = matchupRead({sport: 'nfl', opponent: 'BAL', market: 'Receiving Yards', defenseValue: 120, defenseAverage: 150,
    defense: 1, defenseTeams: 32, defensePosition: 'WR'});
  assert.ok(tough.factor < 1 && tough.factor >= 0.9);
  assert.match(tough.text, /20% less than average \(1st-fewest\)$/);

  const league = {whip: 1.28, k9: 8.6, kRate: 0.22, avg: 0.245, runsPerGame: 4.4};
  const hitter = matchupRead({sport: 'mlb', marketKey: 'hitting:hits', opponent: 'DET',
    matchup: {kind: 'pitcher', pitcher: {name: 'Tarik Skubal', whip: 0.95, k9: 11.2, ip: 180}, league}});
  assert.ok(hitter.factor < 0.92, hitter.factor);
  assert.equal(hitter.text, 'Faces Tarik Skubal (0.95 WHIP, 11.2 K/9)');
  // Batter strikeouts go the other way against a strikeout pitcher.
  assert.ok(matchupRead({sport: 'mlb', marketKey: 'hitting:strikeouts', matchup: {kind: 'pitcher', pitcher: {name: 'T', k9: 11.2, ip: 180}, league}}).factor > 1.1);
  const pitcher = matchupRead({sport: 'mlb', marketKey: 'pitching:strikeouts', opponent: 'CLE',
    matchup: {kind: 'lineup', lineup: {kRate: 0.26, games: 160}, league}});
  assert.ok(pitcher.factor > 1.05);
  assert.equal(pitcher.text, 'CLE strikes out 26% of the time (league 22%)');
  assert.equal(matchupRead({sport: 'mlb', marketKey: 'hitting:sb', matchup: {kind: 'pitcher', pitcher: {whip: 1}, league}}), null);
});

// A WNBA guard's last 20 games of points: alternate home and away, scoring
// more at home, minutes up lately.
const games = (values, extra = () => ({})) => values.map((value, index) => ({value, date: `2026-08-${String(index + 1).padStart(2, '0')}`,
  home: index % 2 === 0, opponent: index % 5 === 0 ? 'LV' : 'NY', usage: index >= values.length - 5 ? 34 : 30, ...extra(index)}));
const guard = (over = {}) => ({sport: 'wnba', player: 'Kelsey Plum', market: 'Points', marketKey: 'player_points', line: 17.5, direction: 'OVER',
  teamAbbr: 'LA', homeTeamAbbr: 'LA', awayTeamAbbr: 'LV', opponent: 'LV', startsAt: '2026-09-30T23:00:00Z',
  gameLog: games([22, 16, 24, 18, 21, 15, 23, 19, 25, 17, 22, 18, 24, 16, 26, 19, 23, 20, 25, 21]),
  defenseValue: 18, defenseAverage: 15, defense: 12, defenseTeams: 13, defensePosition: 'G', ...over});

test('a read: projection, venue, head-to-head, playing time, and what to watch', () => {
  assert.equal(homeToday(guard()), true);
  const records = {l10: {won: 7, games: 10, rate: 0.7}, l5: {won: 4, games: 5, rate: 0.8}, season: {won: 14, games: 20, rate: 0.7}};
  const read = readPick(guard(), 'OVER', {records, book: 0.6});
  assert.ok(read.projection > 21 && read.projection < 25, read.projection);
  assert.ok(read.projected > 0.65, read.projected);
  assert.deepEqual(read.factors.map(item => item.key), ['matchup', 'venue', 'h2h', 'role']);
  assert.equal(read.factors.find(item => item.key === 'role').text, 'Minutes up to 34 from 30');
  assert.equal(read.risks.length, 0);
  assert.ok(read.support >= 5 && read.against === 0);
  assert.equal(grade(read, 0.64), 'A');
  assert.equal(grade(read, 0.52), 'C');
  assert.equal(conflicted(read), false);
  assert.equal(analystNote(guard(), 'OVER', read, {records, book: 0.6}),
    'Projects for ' + (Math.round(read.projection * 10) / 10) + ' against the 17.5 line, over in 7 of the last 10. LV allows 18 points to guards, 20% more than average (2nd-most); the books have it at 60%.');
  // The Under of the same line: everything above argues against it.
  const under = readPick(guard(), 'UNDER', {records: {l10: {won: 3, games: 10, rate: 0.3}}, book: 0.4});
  assert.ok(conflicted(under));
  assert.ok(under.risks.some(risk => risk.startsWith('Tough matchup')));
});

test('a back-to-back and a short history are flagged', () => {
  const tired = guard({startsAt: '2026-08-21T23:00:00Z'});
  const read = readPick(tired, 'OVER', {});
  assert.ok(read.risks.includes('Back-to-back'));
  assert.ok(read.factors.some(item => item.key === 'rest'));
  const rookie = readPick(guard({gameLog: games([20, 19, 22, 18, 21, 23])}), 'OVER', {});
  assert.ok(rookie.risks.includes('Only 6 games of history'));
  // Fewer than five games: no projection at all.
  assert.equal(readPick(guard({gameLog: games([20, 19, 22])}), 'OVER', {}).projection, null);
});

test('the Smart Slip grades a pick, notes why, and drops one the evidence argues against', () => {
  const w = (hits, n) => ({hits, misses: n - hits, pushes: 0, decisions: n, sample: n, hitRate: hits / n * 100});
  const row = guard({id: 'w1', modifier: 'standard', raw: {}, startsAt: '2026-09-30T23:00:00Z',
    windows: {l5: w(4, 5), l10: w(7, 10), l20: w(14, 20), season: w(14, 20)},
    apps: [{key: 'prizepicks', name: 'PrizePicks'}, {key: 'draftkings', name: 'DraftKings', over: -150, under: 120}]});
  const leg = judgeLeg(row, 'OVER', {now: NOW});
  assert.ok(leg, 'offered');
  assert.equal(leg.grade, 'A');
  assert.match(leg.note, /^Projects for \d+\.\d against the 17\.5 line, over in 7 of the last 10\. /);
  assert.deepEqual(reasons(leg).slice(0, 5).map(item => item.key), ['l10', 'season', 'books', 'projection', 'matchup']);
  // The same record, but the games themselves and a stingy defense say otherwise.
  const cold = guard({id: 'w2', modifier: 'standard', raw: {}, windows: row.windows, apps: [{key: 'prizepicks'}],
    gameLog: games([12, 11, 14, 10, 13, 12, 11, 15, 12, 13]), defenseValue: 12, defense: 1});
  assert.equal(judgeLeg(cold, 'OVER', {now: NOW}), null);
});
