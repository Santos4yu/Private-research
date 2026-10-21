import test from 'node:test';
import assert from 'node:assert/strict';
import {betFromSlip, calendar, decimalOdds, moneyText, periodOf, profitOf, series, shiftAnchor, streak, summarize, unitsText} from '../src/my-bets-core.js';

const bet = (date, result, extra = {}) => ({id: date + result + Math.random(), date, at: `${date}T20:00:00Z`, kind: 'pickem', payout: 3, stake: 1, result, ...extra});

test('profit in units, the way the server works it out', () => {
  assert.equal(profitOf(bet('2026-10-01', 'win')), 2);
  assert.equal(profitOf(bet('2026-10-01', 'loss', {stake: 2})), -2);
  assert.equal(profitOf(bet('2026-10-01', 'push')), 0);
  assert.equal(profitOf(bet('2026-10-01', 'pending')), null);
  assert.equal(profitOf(bet('2026-10-01', 'cashout', {stake: 2, returned: 3.5})), 1.5);
  assert.ok(Math.abs(profitOf({kind: 'straight', odds: -110, stake: 1.1, result: 'win'}) - 1) < 1e-9);
  assert.equal(decimalOdds(250), 3.5);
  assert.equal(decimalOdds(50), null);
});

test('periods: a day, a week from Monday, a month, a year, all time', () => {
  const now = '2026-10-21';
  assert.deepEqual(periodOf('day', now, now), {kind: 'day', start: now, end: now, label: 'Today'});
  assert.equal(periodOf('day', '2026-10-20', now).label, 'Yesterday');
  assert.deepEqual(periodOf('week', now, now), {kind: 'week', start: '2026-10-19', end: '2026-10-25', label: 'This week'});
  assert.equal(periodOf('week', '2026-10-12', now).label, 'Oct 12 – Oct 18');
  assert.deepEqual(periodOf('month', now, now), {kind: 'month', start: '2026-10-01', end: '2026-10-31', label: 'October 2026'});
  assert.deepEqual(periodOf('year', now, now), {kind: 'year', start: '2026-01-01', end: '2026-12-31', label: '2026'});
  assert.equal(periodOf('all', now, now).start, null);
  assert.equal(shiftAnchor('month', '2026-01-31', -1), '2025-12-01');
  assert.equal(shiftAnchor('week', now, -1), '2026-10-14');
  assert.equal(shiftAnchor('year', now, 1), '2027-01-01');
});

test('totals, record, win rate, ROI and the current run', () => {
  const bets = [bet('2026-10-01', 'win'), bet('2026-10-02', 'loss'), bet('2026-10-03', 'win', {stake: 2}), bet('2026-10-04', 'push'), bet('2026-10-05', 'pending')];
  const totals = summarize(bets);
  assert.equal(totals.units, 2 - 1 + 4);
  assert.deepEqual([totals.wins, totals.losses, totals.pushes, totals.pending], [2, 1, 1, 1]);
  assert.equal(totals.staked, 4);           // the push and the pending bet aren't risked money
  assert.equal(totals.winRate, 2 / 3);
  assert.equal(totals.roi, 5 / 4);
  assert.deepEqual(streak(bets), {kind: 'W', count: 1});
  assert.deepEqual(streak([...bets, bet('2026-10-06', 'loss'), bet('2026-10-07', 'loss')]), {kind: 'L', count: 2});
});

test('the running total and the calendar', () => {
  const bets = [bet('2026-10-02', 'win'), bet('2026-10-02', 'loss'), bet('2026-10-04', 'win')];
  const month = periodOf('month', '2026-10-15', '2026-10-05');
  const points = series(bets, month, '2026-10-05');
  assert.deepEqual(points.map(point => point.total), [0, 1, 1, 3, 3]);   // Oct 1 to today (the 5th)
  assert.deepEqual(points[1], {day: '2026-10-02', units: 1, total: 1, count: 2});
  const cal = calendar(bets, month, '2026-10-15');
  assert.equal(cal.unit, 'day');
  assert.equal(cal.cells.filter(cell => cell.blank).length, 3);          // Oct 1 2026 is a Thursday
  assert.deepEqual(cal.cells.find(cell => cell.key === '2026-10-04'), {key: '2026-10-04', label: '4', units: 2, count: 1, inside: true});
  const week = calendar(bets, periodOf('week', '2026-10-02', '2026-10-05'), '2026-10-02');
  assert.equal(week.cells.find(cell => cell.key === '2026-10-20').inside, false);
  const year = calendar(bets, periodOf('year', '2026-10-02'), '2026-10-02');
  assert.equal(year.cells.length, 12);
  assert.deepEqual(year.cells[9], {key: '2026-10', label: 'Oct', units: 3, count: 3, inside: true});
  assert.equal(calendar(bets, periodOf('all', '2026-10-02'), '2026-10-02').cells[0].key, '2026');
});

test('words and a tracked slip as a bet', () => {
  assert.equal(unitsText(12.345), '+12.3u');
  assert.equal(unitsText(-3), '−3u');
  assert.equal(moneyText(1848.3), '+$1,848.30');
  assert.equal(moneyText(-5), '−$5.00');
  const slip = {id: 's-abc-12345', appName: 'PrizePicks', type: 'Power', multiplier: 6,
    picks: [{player: 'A One', stat: 'Points', line: 20.5, side: 'OVER', sport: 'nba', startsAt: '2026-10-22T23:30:00Z'},
      {player: 'B Two', stat: 'Rebounds', line: 8.5, side: 'OVER', sport: 'nba', startsAt: '2026-10-22T23:00:00Z'}]};
  const made = betFromSlip(slip, sport => sport);
  assert.equal(made.kind, 'pickem');
  assert.equal(made.payout, 6);
  assert.equal(made.sport, 'nba');
  assert.equal(made.slipId, 's-abc-12345');
  assert.equal(made.title, '2-pick Power entry');
  assert.equal(made.legs.length, 2);
});

test('a bet read from a picture, in units', async () => {
  const {betFromRead} = await import('../src/my-bets-core.js');
  const pickem = betFromRead({kind: 'pickem', app: {name: 'PrizePicks'}, stake: 10, payout: 50, multiplier: 5, result: 'win', paid: 50, date: '2026-10-20', sport: 'nba',
    legs: [{player: 'Jalen Brunson', stat: 'More 24.5 Points'}, {player: 'Karl-Anthony Towns', stat: 'More 11.5 Rebounds'}]}, 2.5);
  assert.equal(pickem.stake, 4);                // $10 at $2.50 a unit
  assert.equal(pickem.payout, 5);
  assert.equal(pickem.result, 'win');
  assert.equal(pickem.title, '2-pick: Jalen Brunson, Karl-Anthony Towns');
  assert.equal(pickem.book, 'PrizePicks');
  const straight = betFromRead({kind: 'straight', app: {name: 'FanDuel'}, stake: 11, odds: -110, result: 'pending', legs: [{player: 'Jalen Brunson', stat: 'Over 26.5 Points'}]}, 10);
  assert.equal(straight.odds, -110);
  assert.equal(straight.stake, 1.1);
  assert.equal(straight.title, 'Jalen Brunson Over 26.5 Points');
  const flex = betFromRead({kind: 'pickem', stake: 10, payout: 100, multiplier: 10, result: 'cashout', paid: 25, legs: []}, 10);
  assert.equal(flex.returned, 2.5);
  assert.equal(flex.title, 'Sportsbook bet');
});

test("a PrizePicks entry is pick'em even if read as a parlay", async () => {
  const {betFromRead} = await import('../src/my-bets-core.js');
  const bet = betFromRead({kind: 'parlay', app: {key: 'prizepicks', name: 'PrizePicks'}, stake: 5, multiplier: 3, odds: -110, result: 'pending',
    legs: [{player: 'Anthony Edwards'}, {player: 'George Kittle'}]}, 10);
  assert.equal(bet.kind, 'pickem');
  assert.equal(bet.payout, 3);
  assert.equal(bet.stake, 0.5);
  assert.equal('odds' in bet, false);
});

test('a $1.47 entry at $2.50 a unit stays $1.47, and an odd payout is kept', async () => {
  const {betFromRead, priceText, profitOf} = await import('../src/my-bets-core.js');
  const bet = betFromRead({kind: 'pickem', app: {key: 'prizepicks', name: 'PrizePicks'}, stake: 1.47, payout: 3.09, multiplier: 2.102, result: 'loss',
    legs: [{player: 'James Cook III'}, {player: 'AJ Barner'}]}, 2.5);
  assert.equal(bet.stake, 0.588);
  assert.equal(Math.round(bet.stake * 2.5 * 100) / 100, 1.47);
  assert.equal(bet.payout, 2.102);
  assert.equal(priceText(bet), '2.1x');
  assert.equal(profitOf(bet), -0.588);
});

test('dollars are each bet at the unit size it was placed at', async () => {
  const {summarize} = await import('../src/my-bets-core.js');
  const bets = [bet('2026-10-01', 'win', {unit: 2.5}), bet('2026-10-02', 'loss', {unit: 5}), bet('2026-10-03', 'win')];
  const totals = summarize(bets, 10);
  assert.equal(totals.units, 2 - 1 + 2);
  assert.equal(totals.money, 2 * 2.5 - 5 + 2 * 10);       // the last has no size of its own: the member's
  assert.deepEqual(totals.sizes, [2.5, 5, 10]);
  assert.deepEqual(summarize([bet('2026-10-01', 'win', {unit: 2.5})], 10).sizes, [2.5]);
});

test('the balance: what was there, money in and out, and the bets logged after it', async () => {
  const {bankroll} = await import('../src/my-bets-core.js');
  const set = '2026-10-21T18:00:00.000Z';
  const bank = {start: 250, at: set, moves: [{amount: 100}, {amount: -40}]};
  const bets = [
    {at: '2026-10-21T17:00:00Z', kind: 'pickem', stake: 2, payout: 3, result: 'win', unit: 10},     // before it was set: not counted
    {at: '2026-10-21T19:00:00Z', kind: 'pickem', stake: 3, payout: 1.8, result: 'win', unit: 2.5},  // +2.4u at $2.50 = +$6
    {at: '2026-10-21T20:00:00Z', kind: 'pickem', stake: 2, payout: 3, result: 'loss', unit: 5},     // −$10
    {at: '2026-10-21T21:00:00Z', kind: 'pickem', stake: 1, payout: 3, result: 'pending', unit: 7.5}, // $7.50 in play
    {at: '2026-10-21T21:30:00Z', kind: 'pickem', stake: 1, payout: 3, result: 'push'},              // nothing
  ];
  const roll = bankroll(bank, bets, 10);
  assert.deepEqual([roll.moves, roll.added, roll.taken], [60, 100, 40]);
  assert.ok(Math.abs(roll.won - -4) < 1e-9);
  assert.equal(roll.inPlay, 7.5);
  assert.deepEqual([roll.pending, roll.settled], [1, 3]);
  assert.ok(Math.abs(roll.balance - (250 + 60 - 4 - 7.5)) < 1e-9);
  assert.equal(bankroll(null, bets, 10), null);
});
