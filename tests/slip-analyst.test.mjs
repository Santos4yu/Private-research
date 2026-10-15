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
  assert.equal(wnba.text, 'LV allows 18 points a game to guards, 20% more than average (2nd-most)');
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
  assert.ok(read.projected > 0.6, read.projected);
  assert.deepEqual(read.factors.map(item => item.key), ['matchup', 'venue', 'h2h', 'role']);
  assert.equal(read.factors.find(item => item.key === 'role').text, 'Minutes up to 34 from 30');
  assert.equal(read.risks.length, 0);
  assert.ok(read.support >= 5 && read.against === 0);
  assert.equal(grade(read, 0.64), 'A');
  assert.equal(grade(read, 0.52), 'C');
  assert.equal(conflicted(read), false);
  assert.equal(analystNote(guard(), 'OVER', read, {records, book: 0.6}),
    'Projects for ' + (Math.round(read.projection * 10) / 10) + ' against the 17.5 line, over in 7 of the last 10. LV allows 18 points a game to guards, 20% more than average (2nd-most); the books have it at 60%.');
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

test('MLB: a lineup read against the pitcher\'s hand and its last ten days, ranked', () => {
  const league = {kRate: 0.22, ops: 0.71, avg: 0.245, whip: 1.28, teams: 30,
    vs: {L: {kRate: 0.23, ops: 0.70}, R: {kRate: 0.215, ops: 0.72}}, recent: {kRate: 0.22, ops: 0.71}};
  const lineup = {kRate: 0.22, ops: 0.70, games: 150, vs: {L: {kRate: 0.28, kRateRank: 2, ops: 0.64, opsRank: 27}, R: {kRate: 0.2}},
    recent: {kRate: 0.25, ops: 0.62, opsRank: 29, games: 9}};
  const row = {sport: 'mlb', marketKey: 'pitching:strikeouts', opponent: 'CLE', matchup: {kind: 'lineup', lineup, league, self: {hand: 'L', projectedIp: 6.2}}};
  const read = matchupRead(row);
  assert.equal(read.text, 'CLE strikes out 28% of the time vs lefties (2nd-most) (league 23%)');
  assert.ok(read.factor > matchupRead({...row, matchup: {...row.matchup, self: {hand: 'R'}}}).factor);  // righties don't fan them
  assert.equal(read.detail.lineup.form, 'cold');
  assert.deepEqual([read.detail.lineup.split.kRateRank, read.detail.lineup.recent.opsRank], [2, 29]);
  // Without the splits it reads the season line, as before.
  assert.equal(matchupRead({...row, matchup: {kind: 'lineup', lineup: {kRate: 0.26, games: 160}, league}}).text, 'CLE strikes out 26% of the time (league 22%)');
  // A hitter's own lineup against the starter's hand nudges his read.
  const pitcher = {name: 'Tarik Skubal', hand: 'L', whip: 1.28, k9: 9, ip: 180};
  const hot = matchupRead({sport: 'mlb', marketKey: 'hitting:hits', matchup: {kind: 'pitcher', pitcher, league,
    lineup: {ops: 0.71, vs: {L: {ops: 0.80, opsRank: 2}}, recent: {ops: 0.82, opsRank: 1, games: 9}}}});
  const plain = matchupRead({sport: 'mlb', marketKey: 'hitting:hits', matchup: {kind: 'pitcher', pitcher, league}});
  assert.ok(hot.factor > plain.factor);
  assert.equal(hot.detail.lineup.form, 'hot');
  // A short leash is something to watch on a strikeout over.
  const log = [5, 6, 7, 4, 6, 5, 6].map((value, index) => ({value, date: `2026-09-${10 + index}`}));
  const short = readPick({...row, line: 5.5, gameLog: log, matchup: {...row.matchup, self: {hand: 'L', projectedIp: 4.6}}}, 'OVER');
  assert.ok(short.risks.includes('Projects for only 4.6 innings'));
});

// A scorer whose games depend on who he faced: 28 against soft defenses,
// 18 against tough ones, his last ten mostly against soft ones.
const scorer = (tonight, schedule) => ({sport: 'nba', player: 'Scorer', market: 'Points', marketKey: 'player_points', line: 22.5, direction: 'OVER',
  teamAbbr: 'LAL', opponent: tonight, startsAt: '2026-10-14T23:00:00Z',
  allowTable: {SOFT1: 1.2, SOFT2: 1.15, TOUGH1: 0.82, TOUGH2: 0.86, MID: 1},
  gameLog: schedule.map((opponent, index) => ({value: opponent.startsWith('SOFT') ? 28 : opponent.startsWith('TOUGH') ? 18 : 23,
    date: `2026-03-${String(index + 1).padStart(2, '0')}`, opponent}))});
const softRun = ['TOUGH1', 'MID', 'TOUGH2', 'MID', 'TOUGH1', 'MID', 'TOUGH2', 'SOFT1', 'SOFT2', 'SOFT1', 'SOFT2', 'SOFT1', 'SOFT2', 'TOUGH1', 'SOFT1', 'SOFT2'];

test('recent games are judged by who they came against, then set against tonight', () => {
  const plain = readPick({...scorer('MID', softRun), allowTable: null}, 'OVER');
  const read = readPick(scorer('MID', softRun), 'OVER');
  // Most of his recent games came against soft defenses: against an average one he's worth less.
  assert.ok(read.projection < plain.projection, `${read.projection} vs ${plain.projection}`);
  const schedule = read.factors.find(item => item.key === 'schedule');
  assert.ok(schedule && schedule.applied && schedule.factor < 1);
  assert.match(schedule.text, /^His last 10 came against defenses \d+% softer than average: against average defenses that's [\d.]+, not [\d.]+$/);
  assert.ok(read.signals.some(item => item.key === 'schedule' && item.weight < 0));
  // Tough and soft, at tonight's line.
  assert.deepEqual([read.split.tough.won, read.split.tough.games], [0, 5]);
  assert.deepEqual([read.split.soft.won, read.split.soft.games], [8, 8]);

  // Tonight against a tough defense: how he's done against those.
  const tough = readPick(scorer('TOUGH2', softRun), 'OVER');
  assert.equal(tough.similar.kind, 'tough');
  assert.equal(tough.similar.text, 'Against tough defenses like TOUGH2: 0 of 5 over 22.5');
  assert.ok(tough.risks.includes('Only 0 of 5 against tough defenses'));
  assert.ok(tough.signals.some(item => item.key === 'similar' && item.weight < 0));
  // A soft one: the same history argues for it.
  const soft = readPick(scorer('SOFT1', softRun), 'OVER');
  assert.equal(soft.similar.text, 'Against soft defenses like SOFT1: 8 of 8 over 22.5');
  assert.ok(soft.signals.some(item => item.key === 'similar' && item.weight > 0));
});

test('MLB: a hitter\'s past games judged by the staffs he faced', () => {
  const league = {whip: 1.3, k9: 8.6};
  const row = {sport: 'mlb', player: 'H', market: 'Hits', marketKey: 'hitting:hits', line: 0.5, opponentTeamId: 147,
    mlbTeams: {pitching: {111: {whip: 1.6}, 147: {whip: 1.0}}, hitting: {}, league},
    gameLog: Array.from({length: 10}, (_, index) => ({value: index % 2, date: `2026-06-${String(index + 1).padStart(2, '0')}`, opponent: 111}))};
  const read = readPick(row, 'OVER');
  assert.ok(read.factors.some(item => item.key === 'schedule' && item.factor < 1), 'his hits came off a soft staff');
});

// A hitter facing an ace on a team whose staff is only average overall.
const facingAce = (market, marketKey) => ({sport: 'mlb', player: 'H', market, marketKey, line: 0.5, opponent: 'Los Angeles Dodgers', opponentTeamId: 119,
  matchup: {kind: 'pitcher', pitcher: {name: 'Blake Snell', whip: 1.1, k9: 11.8, ip: 120}, league: {whip: 1.3, k9: 8.6}},
  mlbTeams: {pitching: {119: {whip: 1.32, k9: 9.9}, 111: {whip: 1.0, k9: 7}, 147: {whip: 1.6, k9: 10.5}}, hitting: {}, league: {whip: 1.3, k9: 8.6}},
  gameLog: Array.from({length: 12}, (_, index) => ({value: index % 3 ? 1 : 0, date: `2026-06-${String(index + 1).padStart(2, '0')}`, opponent: index % 2 ? 111 : 147}))});

test('MLB: tonight\'s starter, not the staff, says how tough the pitching is, in words for the stat', () => {
  // Hits against Snell: stronger pitching, named for him, though the staff is average.
  const hits = readPick(facingAce('Hits', 'hitting:hits'), 'OVER');
  assert.match(hits.similar.text, /^Against stronger pitching like Blake Snell: \d+ of \d+ over 0\.5$/);
  // His strikeouts against Snell: strikeout-heavy pitching, good for the Over -- and said so, not "soft".
  const ks = readPick(facingAce('Strikeouts', 'hitting:strikeouts'), 'OVER');
  assert.match(ks.similar.text, /^Against strikeout-heavy pitching like Blake Snell: /);
  assert.ok(!/soft|tough/.test(ks.similar.text + hits.similar.text));
});

test('the projection weighs hockey and soccer defenses, worded for goalies and keepers', () => {
  const skater = matchupRead({sport: 'nhl', opponent: 'EDM', market: 'Shots On Goal', defenseValue: 3.4, defenseRecent: 3.6, defenseAverage: 2.7,
    defense: 32, defenseTeams: 32, defensePosition: 'C'});
  assert.ok(skater.factor > 1);
  assert.equal(skater.text, 'EDM allows 3.4 shots on goal a game to centers, 26% more than average (1st-most)');
  const goalie = matchupRead({sport: 'nhl', opponent: 'EDM', market: 'Goalie Saves', defenseValue: 31, defenseAverage: 27, defense: 30, defenseTeams: 32, defensePosition: 'G'});
  assert.equal(goalie.text, 'Goalies average 31 saves a game against EDM, 15% more than average (3rd-most)');
  const keeper = matchupRead({sport: 'soccer', opponent: 'ARS', market: 'Goalie Saves', defenseValue: 2.1, defenseAverage: 3.3, defense: 1, defenseTeams: 20, defensePosition: 'GK'});
  assert.ok(keeper.factor < 1);
  assert.equal(keeper.text, 'Goalkeepers average 2.1 saves a match against ARS, 36% fewer than average (1st-fewest)');
});
