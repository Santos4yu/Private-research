// The NBA matchup score (src/nba-matchup-score.js), built on a backtest of
// 2024-25 and 2025-26 (the weights and what they meant: the top of that file).
import test from 'node:test';
import assert from 'node:assert/strict';
import {matchupScore, spreadScores, cardScores, band, outTonight, backTonight, WEIGHTS, OUT_CENTRES} from '../src/nba-matchup-score.js';
import {meetingsOf, statGameLog} from '../src/unified-finder-data.js';
import {readFileSync} from 'node:fs';

// Thirty teams with their numbers spread like the normal curve, the named
// teams placed at given ranks (rank 1 the most) and the rest in order.
const N = 30, TEAMS = ['DAL', 'HOU', 'BOS', 'UTA', 'IND', 'NO', ...[...Array(24)].map((_, i) => `T${i}`)];
const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
function quantile(rank) {
  const p = 1 - (rank - 0.5) / N;
  let low = -5, high = 5;
  for (let i = 0; i < 60; i++) { const mid = (low + high) / 2; if (0.5 * (1 + erf(mid / Math.SQRT2)) < p) low = mid; else high = mid; }
  return (low + high) / 2;
}
// {team: [value, rank]} with rank 1 the most; `fewestFirst` turns ranks the other way (dvp, points allowed).
function table(placed, average, spread, fewestFirst = false) {
  const free = [...Array(N)].map((_, i) => i + 1).filter(rank => !Object.values(placed).includes(rank));
  return Object.fromEntries(TEAMS.map(team => {
    const rank = placed[team] ?? free.shift();
    return [team, [Math.round((average + spread * quantile(rank)) * 100) / 100, fewestFirst ? N - rank + 1 : rank]];
  }));
}
// RotoBot's Dallas page (Oct 2026): 8th most points allowed, 11th highest
// rating, 4th fastest pace; forwards get the 5th most points, 7th most
// rebounds, 6th most assists, 9th most threes, 12th fewest steals, about
// the 7th most blocks (its field-goal percentage allowed isn't shown:
// taken as average). Its Indiana page: 6th most points allowed, 5th
// highest rating, 7th fastest pace, the 4th highest field-goal percentage
// allowed and 17th highest from three; guards get the 7th most points, 3rd
// most rebounds, 13th fewest assists, 3rd fewest threes, 12th most blocks.
// BOS is at the stingy, slow end of everything.
const allowed = table({DAL: 8, IND: 6, BOS: 30}, 114, 4, true), rating = table({DAL: 11, IND: 5, BOS: 30}, 114, 3), pace = table({DAL: 4, IND: 7, BOS: 30}, 99.5, 2);
const fgPct = table({IND: 4, DAL: 15, BOS: 30}, 47, 1), tpPct = table({IND: 17, DAL: 16, BOS: 30}, 36, 1.2);
const F = {pts: table({DAL: 5, IND: 15, BOS: 30}, 10, 1.2, true), reb: table({DAL: 7, IND: 15, BOS: 30}, 4.2, 0.4, true), ast: table({DAL: 6, IND: 15, BOS: 30}, 1.9, 0.25, true),
  tpm: table({DAL: 9, IND: 15, BOS: 30}, 1.1, 0.15, true), stl: table({DAL: 19, IND: 15, BOS: 30}, 0.72, 0.06, true), blk: table({DAL: 7, IND: 15, BOS: 30}, 0.45, 0.08, true)};
const G = {pts: table({IND: 7, DAL: 15, BOS: 30}, 10.5, 1.2, true), reb: table({IND: 3, DAL: 15, BOS: 30}, 3, 0.3, true), ast: table({IND: 18, DAL: 15, BOS: 30}, 3.1, 0.3, true),
  tpm: table({IND: 28, DAL: 15, BOS: 30}, 1.6, 0.2, true), stl: table({IND: 16, DAL: 15, BOS: 30}, 0.8, 0.07, true), blk: table({IND: 12, DAL: 15, BOS: 30}, 0.3, 0.05, true)};
const positions = {F, G};
const league = {
  teamCount: N,
  teamStats: Object.fromEntries(TEAMS.map(team => [team, {def: {pts: allowed[team]}}])),
  opportunity: {count: N, teams: Object.fromEntries(TEAMS.map(team => [team, {drtg: rating[team], poss: pace[team], fgPctAllowed: fgPct[team], tpPctAllowed: tpPct[team]}]))},
  dvp: Object.fromEntries(TEAMS.map(team => [team, Object.fromEntries(Object.entries(positions).map(([position, stats]) =>
    [position, {stats: Object.fromEntries(Object.entries(stats).map(([stat, cells]) => [stat, {szn: cells[team]}]))}]))])),
};
const row = (id, extra = {}) => ({id, sport: 'nba', player: `P${id}`, playerId: id, marketKey: 'player_points', position: 'F', teamAbbr: 'HOU',
  opponent: 'DAL', line: 14.5, gameLog: [], ...extra});

// Last season's real numbers in league-context's shape (ESPN box scores):
// what both sites read before a team has played this season.
const real = JSON.parse(readFileSync(new URL('./fixtures/nba-2025-26-league.json', import.meta.url)));
test('last season’s real numbers: Denver for a guard, and how the scores spread', () => {
  const card = Object.fromEntries(cardScores(row('d1', {position: 'G', teamAbbr: 'OKC', opponent: 'DEN'}), real).map(item => [item.stat, item.score]));
  // RotoBot (Oct 2026) moves each guard on something of its own: points 89
  // McCain, 73 Wallace, 63 Gilgeous-Alexander; steals 40-51. Denver turn it
  // over the fewest times, which is what predicted steals.
  assert.deepEqual(card, {PTS: 54, REB: 38, AST: 60, '3PM': 85, STL: 16, BLK: 73});
  const scores = Object.keys(real.teamStats).flatMap(opponent => ['G', 'F', 'C'].flatMap(position =>
    cardScores(row(`${opponent}${position}`, {position, teamAbbr: 'OKC', opponent}), real).map(item => item.score))).sort((a, b) => a - b);
  // The opponent's numbers alone (no injury report) now reach both ends
  // (Oct 25: stretched, as RotoBot's soft defenses read in the 90s): a few
  // in ten at 90+, the stingy end near 0, the middle near 50.
  assert.ok(scores[0] <= 10 && scores.at(-1) >= 95, `${scores[0]} ${scores.at(-1)}`);
  assert.ok(scores[Math.floor(scores.length * 0.1)] < 25 && scores[Math.floor(scores.length * 0.9)] > 80);
  assert.ok(Math.abs(scores[Math.floor(scores.length / 2)] - 50) <= 5);
});

test('what a defense allows his position is a player at a time, as RotoBot counts it', () => {
  // RotoBot: Denver allow each guard 11.0 points, 1.5 threes a game.
  const threes = matchupScore(row('w', {position: 'G', teamAbbr: 'OKC', opponent: 'DEN', marketKey: 'player_threes'}), real);
  // Threes read only the threes they let teams take; his position is shown, not counted.
  assert.deepEqual(threes.reads.map(read => [read.kind, read.points === 0]), [['position', true], ['attempts', false]]);
  assert.equal(threes.reads[0].text, 'DEN allows each guard 1.5 threes a game (10th most)');
  assert.equal(threes.reads[1].text, 'DEN lets teams take 39.1 threes a game (4th most)');
  const points = matchupScore(row('p', {position: 'G', teamAbbr: 'OKC', opponent: 'DEN'}), real);
  assert.deepEqual(points.reads.map(read => read.kind), ['defense', 'pace', 'position']);
  assert.match(points.reads[0].text, /^DEN gives up 116\.9 points a game \(10th most\) and .* per 100 possessions \(10th highest\)$/);
  assert.equal(matchupScore(row('a', {position: 'G', teamAbbr: 'OKC', opponent: 'DEN', marketKey: 'player_assists'}), real).reads.at(-1).text,
    'DEN gives up 27.5 assists a game (10th most)');
  // An older server's totals still score, read as the position's.
  const older = {...real, dvpEach: undefined};
  assert.match(matchupScore(row('w2', {position: 'G', teamAbbr: 'OKC', opponent: 'DEN'}), older).reads[2].text, /^DEN allows guards 57\.1 points a game/);
  // The parts add up to the score from an even 50.
  assert.ok(Math.abs(50 + threes.reads.reduce((sum, read) => sum + read.points, 0) - threes.raw) < 0.2);
});

test('the same for every forward against a team: his own games sit beside it', () => {
  const quiet = matchupScore(row('4'), league);
  const log = [...[...Array(8)].map(() => ({value: 10, opponent: 'T1'})), ...[...Array(3)].map(() => ({value: 25, opponent: 'DAL'}))];
  const hot = matchupScore(row('5', {gameLog: log}), league);
  assert.equal(hot.score, quiet.score);
  assert.match(hot.fit.text, /^3 games against DAL: 25\.0 a game, his usual 14\.1$/);
  assert.ok(hot.fit.score > 60);
  assert.equal(quiet.fit, null);
});

test('threes rise with the threes a team allows, not the percentage made; steals with turnovers; assists with assists, not FG%', () => {
  const shooting = structuredClone(league);
  for (const [team, cell] of Object.entries(table({DAL: 29}, 36, 1.2))) shooting.opportunity.teams[team].tpPctAllowed = cell;
  for (const [team, cell] of Object.entries(table({DAL: 6}, 14, 1.2, true))) shooting.teamStats[team].off = {to: cell};
  const before = Object.fromEntries(cardScores(row('6'), league).map(item => [item.stat, item.score]));
  const after = Object.fromEntries(cardScores(row('6'), shooting).map(item => [item.stat, item.score]));
  // RotoBot's threes don't follow it (Denver: 3rd lowest, Wallace 91).
  assert.equal(after['3PM'], before['3PM']);
  // They follow the tries: Dallas letting teams take the 2nd most lifts them.
  const tries = structuredClone(shooting);
  for (const [team, cell] of Object.entries(table({DAL: 2}, 36, 2))) tries.opportunity.teams[team].tpaAllowed = cell;
  const more = Object.fromEntries(cardScores(row('6'), tries).map(item => [item.stat, item.score]));
  assert.ok(more['3PM'] > after['3PM'] + 10, `${after['3PM']} -> ${more['3PM']}`);
  assert.equal(more.PTS, after.PTS);
  assert.match(matchupScore(row('7', {marketKey: 'player_threes'}), tries).reads.at(-1).text, /^DAL lets teams take .* threes a game \(2nd most\)$/);
  // Dallas turns the ball over the 6th most: steals rise (RotoBot 87).
  assert.ok(after.STL > before.STL + 3, `${before.STL} -> ${after.STL}`);
  assert.equal(after.PTS, before.PTS);
  assert.match(matchupScore(row('8', {marketKey: 'player_steals'}), shooting).reads.find(read => read.kind === 'turnovers').text,
    /DAL turns it over .* times a game \(6th most\)/);
  // The FG% a defense allows pointed the wrong way for assists in the backtest: not read.
  const finishing = structuredClone(league);
  for (const [team, cell] of Object.entries(table({DAL: 1}, 49, 1.5))) finishing.opportunity.teams[team].fgPctAllowed = cell;
  assert.equal(cardScores(row('6'), finishing).find(item => item.stat === 'AST').score, before.AST);
  const passing = structuredClone(league);
  for (const [team, cell] of Object.entries(table({DAL: 2}, 26, 1.8))) passing.opportunity.teams[team].astAllowed = cell;
  assert.ok(cardScores(row('6'), passing).find(item => item.stat === 'AST').score > before.AST + 8);
});

test('far softer than everyone reads near 100; the middle near 50; the stingy, slow end near 0', () => {
  const far = structuredClone(league);
  far.teamStats.UTA.def.pts = [128, N];
  far.opportunity.teams.UTA = {drtg: [124, 1], poss: [105, 1]};
  assert.ok(matchupScore(row('9', {opponent: 'UTA'}), far).score >= 80);
  const middle = TEAMS.find(team => allowed[team][1] === 15);
  assert.ok(Math.abs(matchupScore(row('10', {opponent: middle}), league).score - 50) <= 8);
  const tough = matchupScore(row('11', {opponent: 'BOS'}), league);
  assert.ok(tough.score <= 25, String(tough.score));
  assert.equal(band(tough.score).label, 'Tough');
});

test('the list and the player card score a prop the same', () => {
  const scores = spreadScores([row('a'), row('b', {opponent: 'BOS'})], league);
  assert.equal(scores.get('a').score, cardScores(row('a'), league).find(item => item.stat === 'PTS').score);
  assert.equal(scores.get('a').label, band(scores.get('a').score).label);
  assert.ok(scores.get('a').score >= 60);
  assert.ok(scores.get('b').score < scores.get('a').score);
  const history = {rows: [...Array(12)].map((_, i) => ({date: `2026-0${1 + (i % 9)}-1${i % 10}`, opponent: i % 4 ? 'T3' : 'DAL', isHome: i % 2 === 0,
    minutes: 30, values: {player_points: i % 4 ? 12 : 20, player_blocks: i % 4 ? 0 : 3}}))};
  const card = cardScores(row('12'), league, history);
  // A board row carries the meetings its history gave it (applyWnbaHistory).
  const blocks = row('13', {marketKey: 'player_blocks', gameLog: statGameLog(history, 'player_blocks'), meetings: meetingsOf(history, 'player_blocks', 'DAL')});
  const shown = card.find(item => item.stat === 'BLK');
  assert.equal(shown.score, spreadScores([blocks], league).get('13').score);
  assert.ok(shown.fit.counted);
  assert.ok(!card.find(item => item.stat === 'PTS').fit.counted);
  assert.ok(WEIGHTS.pts.position < WEIGHTS.pts.defense);  // for points the team leads, the position nudges
});

test('threes and blocks count his last three games against them; points don’t', () => {
  // Two guards, one Denver: McCain made 2, 3, 3 threes in his last three
  // meetings (1.5 usual), Gilgeous-Alexander 1, 0, 3 (1.7).
  const guard = (id, meetings, marketKey) => row(id, {position: 'G', teamAbbr: 'OKC', opponent: 'DEN', marketKey, meetings});
  const mccain = {values: [2, 3, 3], usual: 1.5}, shai = {values: [1, 0, 3], usual: 1.7};
  const hot = matchupScore(guard('m', mccain, 'player_threes'), real), cold = matchupScore(guard('s', shai, 'player_threes'), real);
  // On the backtest's own number (the shown score can top out).
  assert.ok(hot.calibrated > cold.calibrated + 10, `${hot.calibrated} vs ${cold.calibrated}`);
  assert.equal(hot.reads.at(-1).text, 'His last 3 games against DEN: 2, 3, 3 threes (2.7 a game), his usual 1.5');
  assert.equal(hot.fit.text, hot.reads.at(-1).text);
  const none = matchupScore(guard('n', null, 'player_threes'), real);
  assert.ok(hot.calibrated > none.calibrated && cold.calibrated < none.calibrated);
  // Points: his games against them predicted nothing, so they stay out.
  assert.equal(matchupScore(guard('m2', {values: [30, 30, 30], usual: 8}, 'player_points'), real).score,
    matchupScore(guard('s2', {values: [5, 5, 5], usual: 30}, 'player_points'), real).score);
  // One meeting is trusted half as much as three (n / (n + 3)).
  const once = matchupScore(guard('o', {values: [3], usual: 1.5}, 'player_threes'), real);
  assert.ok(once.calibrated < hot.calibrated && once.reads.at(-1).text.startsWith('His last game against DEN: 3 threes'));
});

test('his meetings: the last three against them, his usual with last season worth ten games', () => {
  const games = [...[...Array(20)].map((_, i) => ({date: `2026-01-${String(i + 1).padStart(2, '0')}`, season: 2026, opponent: i % 5 ? 'BOS' : 'DEN',
    values: {player_threes: 1}})), ...[...Array(4)].map((_, i) => ({date: `2026-11-0${i + 1}`, season: 2027, opponent: i === 3 ? 'DEN' : 'BOS',
    values: {player_threes: i === 3 ? 4 : 3}}))];
  const found = meetingsOf({season: 2027, rows: games}, 'player_threes', 'DEN');
  assert.deepEqual(found.values, [1, 1, 4]);
  assert.equal(found.usual, Math.round((3 + 3 + 3 + 4 + 10 * 1) / 14 * 100) / 100);
  assert.equal(meetingsOf({season: 2027, rows: games}, 'player_threes', 'LAL').values.length, 0);
  assert.equal(meetingsOf(null, 'player_threes', 'DEN'), null);
});

test('nothing about the opponent, no score; bands by the number', () => {
  assert.equal(matchupScore(row('14', {opponent: 'XXX'}), league), null);
  assert.equal(matchupScore({...row('15'), sport: 'wnba'}, league), null);
  assert.deepEqual([band(80).label, band(65).label, band(50).label, band(20).label], ['Strong edge', 'Edge', 'Neutral', 'Tough']);
});

// Tonight's injury reports (api/wnba.py _nba_tonight) and each team's
// rotation lately (context.py _recent_minutes).
const rotation = {
  HOU: {players: [
    {id: 'g1', name: 'Fred VanVleet', pos: 'PG', played10: 9, min10: 33, last3: true},
    {id: 'g2', name: 'Amen Thompson', pos: 'G', played10: 10, min10: 31, last3: true},
    {id: 'f1', name: 'Jabari Smith', pos: 'PF', played10: 10, min10: 30, last3: true},
    {id: 'c1', name: 'Alperen Sengun', pos: 'C', played10: 10, min10: 32, last3: true},
    {id: 'g9', name: 'Long Gone', pos: 'G', played10: 3, min10: 28, last3: false},
    {id: 'g8', name: 'Deep Bench', pos: 'G', played10: 6, min10: 9, last3: true}]},
  DAL: {players: [
    {id: 'dc', name: 'Dereck Lively', pos: 'C', played10: 8, min10: 27, last3: true},
    {id: 'dg', name: 'Kyrie Irving', pos: 'G', played10: 10, min10: 35, last3: true}]},
};
const report = (team, injuries) => ({[team]: {eventId: '1', startsAt: '2026-11-04T00:00:00Z', opponent: '?', injuries}});
const out = (id, status = 'Out') => ({id, name: id, status, out: ['Out', 'Doubtful'].includes(status)});
const tonight = teams => ({...league, rotation, tonight: {teams}});
const guard = (extra = {}) => row('tg', {position: 'G', teamAbbr: 'HOU', opponent: 'DAL', ...extra});

test('who counts as out: listed Out or Doubtful and in the rotation lately', () => {
  const night = tonight(report('HOU', [out('g1'), out('g2', 'Questionable'), out('g9'), out('g8'), out('c1', 'Doubtful'), out('tg'), out('f1', 'Probable')]));
  // VanVleet (PG: a guard) out, Sengun doubtful, Thompson questionable (a
  // third of his minutes); not the one out for weeks, the one who barely
  // plays, himself, or a probable.
  assert.deepEqual(outTonight('HOU', night, 'tg').map(player => [player.name, player.pos, player.min, player.sits]),
    [['Fred VanVleet', 'G', 33, 1], ['Alperen Sengun', 'C', 32, 0.8], ['Amen Thompson', 'G', 31, 0.35]]);
  // No report for the team, or a server without the recent minutes: unknown, not healthy.
  assert.equal(outTonight('DAL', night), null);
  const old = {...night, rotation: {HOU: {players: rotation.HOU.players.map(({played10, min10, last3, ...rest}) => rest)}}};
  assert.equal(outTonight('HOU', old), null);
});

test('a teammate out at his position lifts his score the most; a usual night reads even; no report, no read', () => {
  const none = matchupScore(guard(), league);
  const healthy = matchupScore(guard(), tonight(report('HOU', [])));
  const mateOut = matchupScore(guard(), tonight(report('HOU', [out('g1')])));
  const bigOut = matchupScore(guard(), tonight(report('HOU', [out('c1')])));
  assert.equal(none.reads.some(read => read.kind === 'teammates'), false);
  // Nobody out reads even: no penalty, no line, the same score as no report.
  assert.equal(healthy.reads.some(read => read.kind === 'teammates' || read.kind === 'missing'), false);
  assert.equal(healthy.score, none.score);
  // A starter at his position out lifts him past a no-report night; their center out, less.
  assert.ok(healthy.score <= bigOut.score && bigOut.score < mateOut.score && mateOut.score > none.score, `${healthy.score} ${none.score} ${bigOut.score} ${mateOut.score}`);
  assert.equal(mateOut.reads.find(read => read.kind === 'teammates').text,
    'Out for HOU tonight: Fred VanVleet (G, 33 min). Their minutes and shots go to the rest, most to the guards');
  // A starter's 33 minutes at his position (beyond a usual 12) still moves points a lot.
  assert.ok(mateOut.score - healthy.score >= 10, `${healthy.score} -> ${mateOut.score}`);
});

test('the opponent\'s absences: their center out lifts rebounds; threes don\'t read them', () => {
  const rebounds = extra => matchupScore(guard({marketKey: 'player_rebounds', ...extra}), tonight({...report('HOU', []), ...report('DAL', extra.injuries || [])}));
  const full = rebounds({}), noBig = rebounds({injuries: [out('dc')]});
  assert.ok(noBig.score > full.score);
  assert.match(noBig.reads.find(read => read.kind === 'missing').text, /^Out for DAL tonight: Dereck Lively \(C, 27 min\)\. A thinner defense, without its center on the glass$/);
  const threes = matchupScore(guard({marketKey: 'player_threes'}), tonight({...report('HOU', []), ...report('DAL', [out('dc'), out('dg')])}));
  assert.equal(threes.reads.some(read => read.kind === 'missing'), false);
});

test('their last 10 games read beside the season, where the server sends them', () => {
  const recent = structuredClone(league);
  TEAMS.forEach((team, index) => Object.assign(recent.opportunity.teams[team], {ptsAllowed10: [100 + index, null], drtg10: [100 + index, null]}));
  const read = matchupScore(row('r1', {opponent: 'T23'}), recent).reads.find(item => item.kind === 'recent');
  assert.match(read.text, /^T23 over its last 10 games: 129\.0 points a game, 129\.0 per 100 possessions allowed$/);
  assert.ok(read.points > 0);
  assert.equal(matchupScore(row('r2'), league).reads.some(item => item.kind === 'recent'), false);
});

test('a teammate back after missing their last 3 takes minutes back; only once the team has played lately', () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  const players = [
    {id: 'g1', name: 'Fred VanVleet', pos: 'PG', played10: 9, min10: 33, last3: true, min: 33, games: 5},
    {id: 'g5', name: 'Reed Sheppard', pos: 'G', played10: 4, min10: 26, last3: false, min: 27, games: 5},
    {id: 'c5', name: 'Steven Adams', pos: 'C', played10: 6, min10: 22, last3: false, min: 22, games: 5},
    {id: 'g6', name: 'Barely Plays', pos: 'G', played10: 5, min10: 12, last3: false, min: 12, games: 5},
    {id: 'g7', name: 'New Signing', pos: 'G', played10: 0, min10: 0, last3: false, min: 30, games: 5}];
  const night = (injuries, lastGame = '2026-11-02') => ({...league, rotation: {...rotation, HOU: {lastGame, players}}, tonight: {teams: report('HOU', injuries)}});
  // Sheppard and Adams are back; not the one who barely plays, nor one who hasn't played for them; Adams is questionable.
  assert.deepEqual(backTonight('HOU', night([out('c5', 'Questionable')]), 'tg', now).map(player => [player.name, player.pos, player.plays]),
    [['Reed Sheppard', 'G', 1], ['Steven Adams', 'C', 0.65]]);
  // Out tonight after all: not back.
  assert.deepEqual(backTonight('HOU', night([out('g5'), out('c5')]), 'tg', now), []);
  // A season's first game (their last games are last season's): no read.
  assert.equal(backTonight('HOU', night([], '2026-04-12'), 'tg', now), null);
  // The score reads the clock: their last game two days ago.
  const score = (marketKey, injuries) => matchupScore(guard({marketKey}), night(injuries, new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10)));
  const back = score('player_points', []), gone = score('player_points', [out('g5'), out('c5')]);
  const read = back.reads.find(item => item.kind === 'back');
  assert.ok(read.points < -5, String(read.points));
  assert.ok(back.score < gone.score);
  assert.equal(read.text, 'Back for HOU tonight after missing their last 3: Reed Sheppard (G, 27 min), Steven Adams (C, 22 min). They take minutes and shots back, most from the guards');
  assert.equal(gone.reads.some(item => item.kind === 'back'), false);
});

test('a starter is scored on the opponent alone: his teammates in or out don\'t count', () => {
  const starting = structuredClone(rotation);
  starting.HOU.players = starting.HOU.players.map(player => player.id === 'tg' ? {...player, games: 5, starts: 5, lastStart: true} : player);
  if (!starting.HOU.players.some(player => player.id === 'tg')) starting.HOU.players.push({id: 'tg', name: 'tg', pos: 'G', games: 5, starts: 5, lastStart: true});
  const night = {...league, rotation: starting, tonight: {teams: report('HOU', [out('g1')])}};
  const starter = matchupScore(guard(), night), bench = matchupScore(guard(), tonight(report('HOU', [out('g1')])));
  assert.equal(starter.reads.some(read => read.kind === 'teammates' || read.kind === 'back'), false);
  assert.equal(starter.score, matchupScore(guard(), league).score);
  assert.ok(bench.reads.some(read => read.kind === 'teammates') && bench.score > starter.score);
});

test('ESPN\'s injury code decides over its status: a game-time decision sits about half the time', () => {
  const night = tonight(report('HOU', [{id: 'g1', name: 'g1', status: 'Out', code: 'GTD', out: true}, {id: 'c1', name: 'c1', status: 'Out', code: 'OUT', out: true}]));
  const out = Object.fromEntries(outTonight('HOU', night, 'tg').map(player => [player.name, [player.sits, player.status]]));
  assert.deepEqual(out['Fred VanVleet'], [0.5, 'GTD']);
  assert.deepEqual(out['Alperen Sengun'], [1, 'OUT']);
});
