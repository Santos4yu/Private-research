import test from 'node:test';
import assert from 'node:assert/strict';
import {createBot, understand, normalize, findPlayers, rank, distance} from '../src/krazy-bot.js';

const START = Date.parse('2026-10-03T23:05:00Z');
let id = 0;
// A board row and one side of it graded, with only what the bot reads.
const row = (player, sport, market, line, {team = 'DET', opponent = 'KC', game = player, modifier = 'standard', marketKey = null} = {}) =>
  ({id: `r${++id}`, sport, player, market, marketKey, line, modifier, teamAbbr: team, opponent, gameId: game, startsAt: new Date(START).toISOString(), raw: {stat: market}});
const graded = (row, side, {grade = 'B', chance = 0.58, recent = [7, 10], book = null, projection = null, matchup = null, lift = 1.06, risks = [], backed = true} = {}) => ({
  id: `${row.id}|${side}`, row, side, modifier: row.modifier, grade, chance, book, backed, game: `${row.sport}:${row.gameId}`, player: row.player, price: null,
  records: {l10: {won: recent[0], games: recent[1], rate: recent[0] / recent[1]}},
  read: {projection, factors: matchup ? [{key: 'matchup', factor: lift, text: matchup, short: '', label: 'lineup'}] : [], risks},
});

function board() {
  const skubal = row('Tarik Skubal', 'mlb', 'Pitcher Strikeouts', 6.5, {marketKey: 'pitching:strikeouts', game: 'det-kc'});
  const webb = row('Logan Webb', 'mlb', 'Pitcher Strikeouts', 5.5, {marketKey: 'pitching:strikeouts', team: 'SF', opponent: 'LAD', game: 'sf-lad'});
  const judge = row('Aaron Judge', 'mlb', 'Hits+Runs+RBIs', 1.5, {marketKey: 'hitting:hrr', team: 'NYY', opponent: 'BOS', game: 'nyy-bos'});
  const soto = row('Juan Soto', 'mlb', 'Hits+Runs+RBIs', 1.5, {marketKey: 'hitting:hrr', team: 'NYM', opponent: 'ATL', game: 'nym-atl'});
  const witt = row('Bobby Witt Jr.', 'mlb', 'Total Bases', 1.5, {marketKey: 'hitting:tb', team: 'KC', opponent: 'DET', game: 'det-kc'});
  const raleigh = row('Cal Raleigh', 'mlb', 'Home Runs', 0.5, {marketKey: 'hitting:hr', team: 'SEA', opponent: 'HOU', game: 'sea-hou'});
  const raleighDemon = row('Cal Raleigh', 'mlb', 'Total Bases', 2.5, {marketKey: 'hitting:tb', team: 'SEA', opponent: 'HOU', game: 'sea-hou', modifier: 'demon'});
  const tatum = row('Jayson Tatum', 'nba', 'Points', 26.5, {team: 'BOS', opponent: 'NYK', game: 'bos-nyk'});
  const matthews = row('Auston Matthews', 'nhl', 'Points', 1.5, {team: 'TOR', opponent: 'MTL', game: 'tor-mtl'});
  const pasta = row('David Pastrnak', 'nhl', 'Shots On Goal', 4.5, {team: 'BOS', opponent: 'FLA', game: 'bos-fla'});
  const reads = new Map([
    [`${skubal.id}|OVER`, graded(skubal, 'OVER', {grade: 'A', chance: 0.66, recent: [8, 10], book: 0.61, projection: 7.4, matchup: 'KC strikes out 26% of the time (league 22%)', risks: ['Only 7 games of history']})],
    [`${skubal.id}|UNDER`, graded(skubal, 'UNDER', {grade: 'C', chance: 0.34, recent: [2, 10], backed: false})],
    [`${webb.id}|OVER`, graded(webb, 'OVER', {grade: 'B', chance: 0.6})],
    [`${judge.id}|OVER`, graded(judge, 'OVER', {grade: 'A', chance: 0.63, matchup: 'Faces Brayan Bello (1.41 WHIP, 7.2 K/9)'})],
    [`${soto.id}|UNDER`, graded(soto, 'UNDER', {grade: 'B', chance: 0.57})],
    [`${witt.id}|OVER`, graded(witt, 'OVER', {grade: 'B', chance: 0.61})],
    [`${witt.id}|UNDER`, graded(witt, 'UNDER', {grade: 'C', chance: 0.39, backed: false})],
    [`${raleighDemon.id}|OVER`, graded(raleighDemon, 'OVER', {grade: 'B', chance: 0.38})],
    [`${tatum.id}|OVER`, graded(tatum, 'OVER', {grade: 'A', chance: 0.64})],
    [`${matthews.id}|OVER`, graded(matthews, 'OVER', {grade: 'B', chance: 0.59})],
    [`${pasta.id}|OVER`, graded(pasta, 'OVER', {grade: 'A', chance: 0.65})],
  ]);
  const rows = [skubal, webb, judge, soto, witt, raleigh, raleighDemon, tatum, matthews, pasta];
  return {rows, reads, skubal, witt};
}

function makeBot({sports = ['mlb', 'nba', 'nhl'], store = null, moves = null, time = START} = {}) {
  const {rows, reads} = board();
  return createBot({
    sports, load: async sport => rows.filter(item => item.sport === sport),
    judge: list => list.flatMap(item => ['OVER', 'UNDER'].map(side => reads.get(`${item.id}|${side}`))).filter(leg => leg?.backed),
    assess: (item, side) => reads.get(`${item.id}|${side}`) || null,
    profile: store, moves, now: () => time, random: () => 0,
  });
}
const memory = () => { let saved = null; return {read: () => saved, write: value => { saved = JSON.parse(JSON.stringify(value)); }}; };

test('questions are read through slang and typos', () => {
  assert.equal(normalize('best strikout prop'), 'best strikeout prop');
  assert.equal(normalize('lock of the day'), 'safest');
  assert.equal(normalize("who's gonna get punchies"), "who's gonna get strikeouts");
  assert.equal(normalize('best rebouds prop'), 'best rebounds prop');
  assert.equal(normalize('what about skubel', new Set(['skubel'])), 'what about skubel');  // a name is never "corrected"
  assert.equal(distance('strikoeuts', 'strikeouts'), 1);
  const verdict = understand('should I take Skubal over 6.5 Ks?');
  assert.deepEqual([verdict.stat.key, verdict.side, verdict.line, verdict.verdict], ['pitching:strikeouts', 'OVER', 6.5, true]);
  assert.equal(understand('skubal over or under 6.5').side, null);
  assert.equal(understand('make it 2 picks').intent, 'slip');
  assert.equal(understand("what's the play today").intent, 'rundown');
  assert.deepEqual(understand('best points prop').statOptions.map(stat => stat.sport), ['nba', 'nhl']);
  assert.equal(understand('best shots on goal prop').stat.sport, 'nhl');
});

test('players are found by full name, last name and a near-miss, and look-alikes are asked about', () => {
  const names = ['Aaron Judge', 'Juan Soto', 'Will Smith', 'Dominic Smith', 'Tarik Skubal'];
  assert.deepEqual(findPlayers('what about judge', names).players, ['Aaron Judge']);
  assert.deepEqual(findPlayers('how is skubel looking', names).players, ['Tarik Skubal']);
  assert.deepEqual(findPlayers('compare judge and soto', names).players, ['Aaron Judge', 'Juan Soto']);
  assert.equal(findPlayers('smith props', names).ambiguous[0].length, 2);
  assert.deepEqual(findPlayers('best hits prop', names).players, []);
});

test('a pick reads like an analyst: confidence from the grade and the numbers behind it', async () => {
  const bot = makeBot();
  const answer = await bot.ask('whats the best strikeout prop');
  assert.match(answer, /Tarik Skubal over 6\.5 K's vs KC \(grade A, 66% to hit\)\. I love this one\./);
  assert.match(answer, /Skubal has gone over in 8 of his last 10, projects for 7\.4 against the 6\.5 line and KC strikes out 26%/);
  assert.match(answer, /only 7 games of history/);
  assert.deepEqual(bot.suggestions(), ['Why?', 'Next best', 'What about the under?', 'Build me a 3-pick slip']);
});

test('it remembers the conversation: he, the under, why, next, what about another player', async () => {
  const bot = makeBot();
  await bot.ask('best K prop');
  assert.match(await bot.ask('is he safe?'), /^Yes\. I love it\. Tarik Skubal over 6\.5 K's vs KC: 66% to hit, grade A\./);
  assert.match(await bot.ask('what about the under?'), /^I'd flip it\. The over is the better side at 66%\. Tarik Skubal under 6\.5 K's vs KC: 34% to hit/);
  await bot.ask('best K prop');
  assert.match(await bot.ask('why?'), /^Why Tarik Skubal over 6\.5 K's vs KC:.*the books have it at 61%.*Risks: only 7 games of history/);
  assert.match(await bot.ask('next'), /Logan Webb over 5\.5 K's vs LAD/);
  // The K's carried over give way: Judge has no strikeout line.
  assert.match(await bot.ask('what about judge'), /Aaron Judge over 1\.5 Hits\+Runs\+RBIs/);
});

test('should I take answers yes, flips a weak side, and corrects a stale line', async () => {
  const bot = makeBot();
  assert.match(await bot.ask('should I take Skubal over 6.5 Ks?'), /^Yes\. I love it\./);
  assert.match(await bot.ask('should i take witt under 1.5 total bases'), /^I'd flip it\. The over is the better side at 61%/);
  assert.match(await bot.ask('skubal over 7.5 ks?'), /\(Today's line is 6\.5, not 7\.5\.\)/);
  assert.match(await bot.ask('skubal over or under 6.5'), /Tarik Skubal over 6\.5 K's vs KC is the better side at 66%/);
});

test('compare picks the better spot of two players', async () => {
  const answer = await makeBot().ask('compare judge and soto');
  assert.match(answer, /^I'd go Judge\. Aaron Judge over 1\.5 Hits\+Runs\+RBIs vs BOS is 63% to hit \(grade A\) vs Juan Soto under 1\.5 Hits\+Runs\+RBIs vs ATL at 57%/);
});

test("the day's rundown: games, first pitch, top play, matchup and a long shot", async () => {
  const answer = await makeBot({sports: ['mlb']}).ask("what's the play today?");
  assert.match(answer, /^Today's MLB slate: 5 games, first pitch at /);
  assert.match(answer, /Top play: Tarik Skubal over 6\.5 K's vs KC \(A, 66%\)\./);
  assert.match(answer, /Best matchup: Aaron Judge over 1\.5 Hits\+Runs\+RBIs vs BOS, faces Brayan Bello/);
  assert.match(answer, /Long shot: Cal Raleigh over 2\.5 total bases \(demon\) vs HOU at 38%\./);
});

test('NBA and NHL: a shared stat asks which league, a team or the conversation decides it', async () => {
  const bot = makeBot();
  assert.match(await bot.ask('best points prop'), /^NBA or NHL points\? Both are on the board today\./);
  assert.match(await bot.ask('best celtics points prop'), /Jayson Tatum over 26\.5 points vs NYK/);
  assert.match(await bot.ask('best shots on goal prop'), /David Pastrnak over 4\.5 shots on goal vs FLA/);
  assert.match(await bot.ask('and points?'), /Auston Matthews over 1\.5 points vs MTL/);  // still hockey
});

test('a member is remembered between visits', async () => {
  const store = memory();
  const first = makeBot({store, time: START});
  await first.ask('what about judge');
  await first.ask('best hrr prop');
  await first.ask('best hrr prop');
  const later = makeBot({store, time: START + 3 * 3600000});
  assert.match(await later.ask('hey'), /^Welcome back! You were asking about Judge before, and he's got a good spot today: Aaron Judge over 1\.5/);
  assert.match(await later.ask('what did I ask last time?'), /^Your last questions: "best hrr prop" \(today\).*You ask about Aaron Judge the most\./);
  assert.match(await later.ask('my usual'), /Your usual.*HRR/);
  assert.ok(later.examples().includes("How's Judge looking?"));
  // A damaged saved profile starts fresh instead of breaking the bot.
  const broken = createBot({sports: ['mlb'], load: async () => [], profile: {read: () => ({asked: 'oops', players: [1, 2]}), write() {}}});
  assert.deepEqual(broken.profile().asked, []);
});

test('line moves, thinking steps and honest fallbacks', async () => {
  const moves = async () => [{kind: 'line', player: 'Tarik Skubal', stat: 'Pitcher Strikeouts', from: 5.5, to: 6.5, at: new Date(START - 3600000).toISOString()}];
  const bot = makeBot({moves});
  assert.match(await bot.ask('best K prop'), /Heads up: this line moved from 5\.5 to 6\.5/);
  const steps = bot.thinking('should I take Skubal over 6.5 Ks?');
  assert.equal(steps[0], 'Reading your question');
  assert.ok(steps.includes("Checking Skubal's last 10"));
  assert.ok(steps.some(step => /^Scanning \d+ MLB props$/.test(step)));
  assert.match(await bot.ask('what about smth'), /^I didn't catch that\. Did you mean /);
  assert.match(await bot.ask('purple monkey dishwasher'), /^I didn't catch that one\./);
  assert.match(await bot.ask('best nfl prop'), /covering MLB, NBA, NHL right now/);
  assert.match(await createBot({load: async () => { throw new Error('offline'); }}).ask('best K prop'), /can't reach today's lines/);
  assert.match(await bot.ask('build me a 3-pick slip'), /3-pick slip I like: .*from different games/);
});

test('ranking keeps one pick per player', () => {
  const {rows, reads} = board();
  const legs = [...reads.values()].filter(leg => leg.backed);
  legs.push(graded(rows[0], 'OVER', {grade: 'A', chance: 0.7}));
  assert.equal(rank(legs, {intent: 'best'}).filter(leg => leg.player === 'Tarik Skubal').length, 1);
});
