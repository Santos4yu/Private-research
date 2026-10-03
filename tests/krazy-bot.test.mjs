import test from 'node:test';
import assert from 'node:assert/strict';
import {createBot, understand, findPlayer, rank} from '../src/krazy-bot.js';

// A graded pick as smart-slip.js candidates() returns it, with only what the bot reads.
const leg = (player, marketKey, line, {side = 'OVER', grade = 'B', chance = 0.58, recent = [7, 10], book = null, projection = null,
  matchup = null, lift = 1.06, risks = [], opponent = 'KC', team = 'DET', game = player, modifier = 'standard'} = {}) => ({
  id: `${player}|${marketKey}|${side}`, player, side, modifier, grade, chance, book, game, price: null,
  records: {l10: {won: recent[0], games: recent[1], rate: recent[0] / recent[1]}},
  read: {projection, factors: matchup ? [{key: 'matchup', factor: lift, text: matchup, short: '', label: 'lineup'}] : [], risks},
  row: {sport: 'mlb', player, marketKey, line, opponent, teamAbbr: team, modifier, market: marketKey},
});

const LEGS = [
  leg('Tarik Skubal', 'pitching:strikeouts', 6.5, {grade: 'A', chance: 0.66, recent: [8, 10], book: 0.61, projection: 7.4,
    matchup: 'KC strikes out 26% of the time (league 22%)', risks: ['Only 7 games of history'], game: 'det-kc'}),
  leg('Logan Webb', 'pitching:strikeouts', 5.5, {grade: 'B', chance: 0.6, opponent: 'LAD', team: 'SF', game: 'sf-lad'}),
  leg('Aaron Judge', 'hitting:hrr', 1.5, {grade: 'A', chance: 0.63, opponent: 'BOS', team: 'NYY', game: 'nyy-bos',
    matchup: 'Faces Brayan Bello (1.41 WHIP, 7.2 K/9)'}),
  leg('Juan Soto', 'hitting:hrr', 1.5, {side: 'UNDER', grade: 'B', chance: 0.57, opponent: 'ATL', team: 'NYM', game: 'nym-atl'}),
  leg('Jose Ramirez', 'hitting:tb', 1.5, {grade: 'B', chance: 0.59, opponent: 'MIN', team: 'CLE', game: 'cle-min'}),
  leg('Bobby Witt Jr.', 'hitting:tb', 1.5, {grade: 'C', chance: 0.71, opponent: 'DET', team: 'KC', game: 'det-kc'}),
  leg('Gunnar Henderson', 'hitting:tb', 1.5, {grade: 'A', chance: 0.61, opponent: 'TB', team: 'BAL', game: 'bal-tb'}),
];
const ROWS = [...LEGS.map(item => item.row), {sport: 'mlb', player: 'Cal Raleigh', marketKey: 'hitting:hr', line: 0.5, modifier: 'standard'}];

const bot = (options = {}) => createBot({load: async () => ROWS, judge: () => LEGS, random: () => 0, ...options});

test('questions are read for stat, side, count, team and intent', () => {
  assert.equal(understand('whats the best matchup for today').intent, 'matchup');
  assert.equal(understand('best strikeout prop?').stat.key, 'pitching:strikeouts');
  assert.equal(understand('best HRR prop').stat.key, 'hitting:hrr');
  assert.equal(understand('best hits allowed under').stat.key, 'pitching:hits');
  assert.equal(understand('best hitter Ks').stat.key, 'hitting:strikeouts');
  assert.equal(understand('best hrr under').side, 'UNDER');
  assert.equal(understand('give me more picks').side, null);
  assert.equal(understand('top 3 total bases').count, 3);
  assert.deepEqual(understand('best yankees hits prop').team, ['NYY']);
  assert.equal(understand('build me a 4 pick slip').count, 4);
  assert.equal(understand('best nba prop').intent, 'other-sport');
});

test('players are found by full name or a distinct last name, never by a stat word', () => {
  const names = ['Aaron Judge', 'Juan Soto', 'Will Smith', 'Josh Bell'];
  assert.equal(findPlayer('what about judge', names), 'Aaron Judge');
  assert.equal(findPlayer('Juan Soto props?', names), 'Juan Soto');
  assert.equal(findPlayer('best hits prop', names), null);
});

test('best K prop answers like an analyst with the numbers behind it', async () => {
  const answer = await bot().ask('whats the best strikeout prop');
  assert.match(answer, /Tarik Skubal over 6\.5 K's vs KC \(grade A, 66% to hit\)/);
  assert.match(answer, /Skubal has gone over in 8 of his last 10/);
  assert.match(answer, /projects for 7\.4 against the 6\.5 line/);
  assert.match(answer, /KC strikes out 26% of the time/);  // team codes keep their capitals
  assert.match(answer, /only 7 games of history/);
});

test('follow-ups: why breaks down the last pick, another moves to the next one', async () => {
  const krazy = bot();
  assert.match(await krazy.ask('why'), /Ask me for a pick first/);
  await krazy.ask('best K prop');
  const why = await krazy.ask('why?');
  assert.match(why, /^Why Tarik Skubal over 6\.5 K's vs KC:/);
  assert.match(why, /the books have it at 61%/);
  assert.match(why, /Risks: only 7 games of history/);
  assert.match(await krazy.ask('another one'), /Logan Webb over 5\.5 K's vs LAD/);
  assert.match(await krazy.ask('next'), /That's everything I'd back/);
});

test('safest, matchup, side and top-N questions rank differently', async () => {
  assert.match(await bot().ask('safest pick today'), /Bobby Witt Jr\. over 1\.5 total bases/);
  assert.match(await bot().ask('best matchup today'), /Tarik Skubal|Aaron Judge/);
  assert.match(await bot().ask('best hrr under'), /Juan Soto under 1\.5 Hits\+Runs\+RBIs/);
  const top = await bot().ask('top 3 total bases');
  assert.match(top, /^Top 3 total bases props today: 1\) Gunnar Henderson over 1\.5 total bases vs TB, A, 61%; 2\) Jose Ramirez/);
});

test('a slip takes B-or-better legs from different games', async () => {
  const slip = await bot().ask('build me a 3-pick slip');
  assert.match(slip, /3-pick slip/);
  assert.doesNotMatch(slip, /Witt/);  // grade C
  const legs = ['Skubal', 'Judge', 'Henderson', 'Webb', 'Ramirez', 'Soto'].filter(name => slip.includes(name));
  assert.equal(legs.length, 3);
  assert.match(slip, /6x Power Play/);
});

test('players with no edge, other sports, empty boards and outages get honest answers', async () => {
  assert.match(await bot().ask('what about Raleigh'), /Cal Raleigh is on the board for 0\.5 home runs, but none of his lines has a clear edge/);
  assert.match(await bot().ask('best Judge prop'), /Judge/);
  assert.match(await bot().ask('best nba prop'), /locked in on MLB/);
  assert.match(await createBot({load: async () => [], judge: () => []}).ask('best K prop'), /aren't any MLB props posted/);
  assert.match(await createBot({load: async () => { throw new Error('offline'); }}).ask('best K prop'), /can't reach today's lines/);
  assert.match(await bot().ask('best stolen base prop'), /don't see a stolen base prop/);
});

test('ranking keeps one pick per player', () => {
  const doubled = [...LEGS, leg('Tarik Skubal', 'pitching:outs', 17.5, {grade: 'A', chance: 0.7})];
  const ranked = rank(doubled, {intent: 'best'});
  assert.equal(ranked.filter(item => item.player === 'Tarik Skubal').length, 1);
});
