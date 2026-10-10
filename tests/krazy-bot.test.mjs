import test from 'node:test';
import assert from 'node:assert/strict';
import {createBot, understand, normalize, findPlayers, rank, distance, pickCard, pickReport} from '../src/krazy-bot.js';

const START = Date.parse('2026-10-03T23:05:00Z');
let id = 0;
// A board row and one side of it graded, with only what the bot reads.
const row = (player, sport, market, line, {team = 'DET', opponent = 'KC', game = player, modifier = 'standard', marketKey = null} = {}) =>
  ({id: `r${++id}`, sport, player, market, marketKey, line, modifier, teamAbbr: team, opponent, gameId: game, startsAt: new Date(START).toISOString(), raw: {stat: market}});
const graded = (row, side, {grade = 'B', chance = 0.58, recent = [7, 10], book = null, projection = null, matchup = null, lift = 1.06, risks = [], backed = true} = {}) => ({
  id: `${row.id}|${side}`, row, side, modifier: row.modifier, grade, chance, book, backed, game: `${row.sport}:${row.gameId}`, player: row.player, price: null,
  records: {l10: {won: recent[0], games: recent[1], rate: recent[0] / recent[1]}},
  // MLB has matchup reads today, so every MLB leg carries one (a good one
  // for its side unless a test says otherwise); NBA and NHL have none here.
  read: {projection, factors: matchup ? [{key: 'matchup', factor: lift, text: matchup, short: '', label: 'lineup'}]
    : row.sport === 'mlb' ? [{key: 'matchup', factor: side === 'UNDER' ? 0.95 : 1.05, text: null, short: '', label: 'lineup'}] : [], risks},
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
  // Each line's matchup, in the shapes the Slip Analyzer's engine reads
  // (slip-matchup.js): the lineup a starter faces, a hitter's grade from the
  // Research model, the defense against a scorer's position. NHL has none.
  const league = {teams: 30, kRate: 0.22, vs: {L: {kRate: 0.22}, R: {kRate: 0.22}}};
  skubal.matchup = {kind: 'lineup', league, lineup: {name: 'Kansas City Royals', kRate: 0.26, games: 150, vs: {L: {kRate: 0.29, kRateRank: 2}}},
    self: {hand: 'L', projectedIp: 6.2, recentPitches: 98, lastStarts: [{k: 8}, {k: 6}, {k: 9}]}};
  webb.matchup = {kind: 'lineup', league, lineup: {name: 'Los Angeles Dodgers', kRate: 0.235, games: 150, vs: {R: {kRate: 0.24, kRateRank: 8}}},
    self: {hand: 'R', projectedIp: 6.4}};
  judge.matchup = {kind: 'pitcher', pitcher: {name: 'Brayan Bello', hand: 'R', era: 4.6, whip: 1.41, k9: 7.2}};
  judge.hitterMatchup = {pitcher: {name: 'Brayan Bello', hand: 'R'}, grades: {other: {score: 74}}, factors: []};
  soto.hitterMatchup = {grades: {other: {score: 36}}, factors: []};
  witt.hitterMatchup = {grades: {power: {score: 64}}, factors: []};
  raleighDemon.hitterMatchup = {grades: {power: {score: 60}}, factors: []};
  Object.assign(tatum, {position: 'F', defense: 28, defenseTeams: 30, defenseValue: 27.4, defenseAverage: 24, defensePosition: 'F'});
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
  assert.deepEqual(understand('best points prop').statOptions.map(stat => stat.sport), ['nba', 'nhl', 'wnba']);
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
  // Judged the Slip Analyzer's way: KC's strikeouts against lefties make it Elite, and the chance counts the matchup.
  assert.match(answer, /Tarik Skubal over 6\.5 K's vs KC \(Elite, 68% to hit\)\. I love this one\./);
  assert.match(answer, /Skubal has gone over in 8 of his last 10, projects for 7\.4 against the 6\.5 line and KC strikes out 26%/);
  assert.match(answer, /only 7 games of history/);
  assert.deepEqual(bot.suggestions(), ['Why?', 'Next best', 'What about the under?', 'Build me a 3-pick slip']);
});

test('it remembers the conversation: he, the under, why, next, what about another player', async () => {
  const bot = makeBot();
  await bot.ask('best K prop');
  assert.match(await bot.ask('is he safe?'), /^Yes\. I love it\. Tarik Skubal over 6\.5 K's vs KC: 68% to hit, Elite\./);
  assert.match(await bot.ask('what about the under?'), /^Red flag\. The matchup is (tough|bad) \(\d+\)\..* The over is the better side at 68%\./);
  await bot.ask('best K prop');
  assert.match(await bot.ask('why?'), /^Why Tarik Skubal over 6\.5 K's vs KC:.*the books have it at 61%.*Risks: only 7 games of history/);
  assert.match(await bot.ask('next'), /Logan Webb over 5\.5 K's vs LAD/);
  // The K's carried over give way: Judge has no strikeout line.
  assert.match(await bot.ask('what about judge'), /Aaron Judge over 1\.5 Hits\+Runs\+RBIs/);
});

test('should I take answers yes, flips a weak side, and corrects a stale line', async () => {
  const bot = makeBot();
  assert.match(await bot.ask('should I take Skubal over 6.5 Ks?'), /^Yes\. I love it\./);
  assert.match(await bot.ask('should i take witt under 1.5 total bases'), /^Red flag\. .*The over is the better side at 64%/);
  assert.match(await bot.ask('skubal over 7.5 ks?'), /\(Today's line is 6\.5, not 7\.5\.\)/);
  assert.match(await bot.ask('skubal over or under 6.5'), /Tarik Skubal over 6\.5 K's vs KC is the better side at 68%/);
});

test('compare picks the better spot of two players', async () => {
  const answer = await makeBot().ask('compare judge and soto');
  assert.match(answer, /^I'd go Judge\. Aaron Judge over 1\.5 Hits\+Runs\+RBIs vs BOS is 66% to hit \(Elite\) vs Juan Soto under 1\.5 Hits\+Runs\+RBIs vs ATL at 61%/);
});

test("the day's rundown: games, first pitch, top play, matchup and a long shot", async () => {
  const answer = await makeBot({sports: ['mlb']}).ask("what's the play today?");
  assert.match(answer, /^Today's MLB slate: 5 games, first pitch at /);
  assert.match(answer, /Top play: Tarik Skubal over 6\.5 K's vs KC \(Elite, 68%\)\./);
  assert.match(answer, /Best matchup: Aaron Judge over 1\.5 Hits\+Runs\+RBIs vs BOS, faces Brayan Bello/);
  assert.match(answer, /Long shot: Cal Raleigh over 2\.5 total bases \(demon\) vs HOU at 42%\./);
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
  assert.match(await bot.ask('build me a 3-pick slip'), /3-pick (MLB )?slip from my Elite and Strong picks: .*Parlay grade [A-F]/);
});

test('answers carry a card: the pick, its last 10, the numbers, the matchup', async () => {
  const bot = makeBot();
  await bot.ask('best k prop');
  const {lead, card} = bot.card();
  assert.equal(card.kind, 'pick');
  assert.match(lead, /Tarik Skubal over 6\.5 K's vs KC\. I love this one\. Skubal has gone over in 8 of his last 10\./);
  assert.doesNotMatch(lead, /Elite/);  // the card shows the tier and chance
  assert.deepEqual([card.pick.player, card.pick.tier, Math.round(card.pick.chance * 100), card.pick.side, card.pick.line], ['Tarik Skubal', 'elite', 68, 'OVER', 6.5]);
  // The same matchup panel as the Slip Analyzer: KC's strikeouts against lefties first.
  assert.equal(card.pick.case.facts[0].key, 'lineup');
  assert.equal(card.pick.case.label, 'Excellent matchup');
  assert.deepEqual(card.pick.record, {won: 8, games: 10});
  assert.deepEqual(card.pick.tiles.map(tile => [tile.key, tile.value, tile.label, tile.tone]), [['books', '61%', 'Books', 'up'], ['projection', '7.4', 'Projection', 'up']]);
  assert.equal(card.pick.matchup.text, 'KC strikes out 26% of the time (league 22%)');
  assert.equal(card.pick.matchup.tone, 'up');
  assert.deepEqual(card.pick.risks, ['Only 7 games of history']);

  await bot.ask('compare judge and soto');
  assert.deepEqual(bot.card().card.picks.map(item => item.player), ['Aaron Judge', 'Juan Soto']);
  await bot.ask('build me a 3-pick slip');
  const slip = bot.card().card;
  assert.equal(slip.kind, 'slip');
  assert.equal(slip.picks.length, 3);
  assert.equal(new Set(slip.picks.map(item => item.player)).size, 3);
  assert.ok(slip.together > 0 && slip.together < 1);
  await bot.ask("what's the play today");
  assert.deepEqual(bot.card().card.rows.map(item => item.tag), ['Top play', 'Best matchup', 'Long shot']);
  await bot.ask('should I take witt under 1.5 total bases');
  assert.deepEqual([bot.card().card.verdict.tone, bot.card().card.pick.side], ['flip', 'OVER']);
  await bot.ask('why');
  assert.ok(bot.card().card.reasons.length >= 1);
  await bot.ask('thanks');
  assert.equal(bot.card(), null);  // small talk stays plain text
});

test('"why is he a good pick" about a player not on screen breaks down his best pick', async () => {
  const bot = makeBot();
  assert.match(await bot.ask('why is judge a good pick'), /^Why Aaron Judge over 1\.5 Hits\+Runs\+RBIs vs BOS: /);
  const {card} = bot.card();
  assert.equal(card.pick.player, 'Aaron Judge');
  assert.ok(!card.reasons.some(text => /Brayan Bello/.test(text)));  // the matchup has its own row
  assert.equal(card.pick.matchup.text, 'Faces Brayan Bello (1.41 WHIP, 7.2 K/9)');
});

test('a card reads the game log, venue and logos off the row', () => {
  const row = {id: 'x', sport: 'nba', player: 'Jayson Tatum', market: 'Points', line: 26.5, modifier: 'standard', teamAbbr: 'BOS', opponent: 'NYK',
    teamLogo: 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png', isHome: false, startsAt: '2026-10-03T23:30:00Z', headshot: 'https://example.test/t.png',
    gameLog: [{value: 31, date: '2026-04-01', opponent: 'MIA'}, {value: 26.5, date: '2026-04-03', opponent: 'ORL'}, {value: 22, date: '2026-04-05', opponent: 'CHI'}]};
  const card = pickCard({row, side: 'OVER', player: row.player, grade: 'A', chance: 0.64, records: {}, read: {factors: [], risks: []}});
  assert.deepEqual(card.last.map(game => [game.value, game.hit, game.label]), [[31, true, 'MIA'], [26.5, null, 'ORL'], [22, false, 'CHI']]);
  assert.equal(card.opponentLogo, 'https://a.espncdn.com/i/teamlogos/nba/500/nyk.png');
  assert.equal(card.home, false);
  const mlb = pickCard({row: {...row, sport: 'mlb', opponentTeamId: 147, teamLogo: null, gameLog: [{value: 2, date: '2026-09-28', opponent: 147}],
    matchup: {kind: 'pitcher', pitcher: {id: 605400, name: 'Aaron Nola', hand: 'R'}}}, side: 'UNDER', player: row.player, grade: 'B', chance: 0.6, records: {},
    read: {factors: [{key: 'matchup', factor: 0.95, text: 'Faces Aaron Nola (1.10 WHIP, 9.1 K/9)', short: 'Nola', label: 'starter'}], risks: []}});
  assert.equal(mlb.opponentLogo, 'https://www.mlbstatic.com/team-logos/147.svg');
  assert.deepEqual([mlb.last[0].label, mlb.last[0].hit], ['9/28', true]);
  assert.deepEqual([mlb.matchup.name, mlb.matchup.face, mlb.matchup.tone], ['Aaron Nola', true, 'up']);
  assert.match(mlb.matchup.photo, /people\/605400\/headshot/);
});

test('build me a slip: Elite and Strong picks, none working against each other, graded as one', async () => {
  const bot = makeBot({sports: ['mlb']});
  const answer = await bot.ask('build me a 3-pick slip');
  const card = bot.card().card;
  assert.equal(card.kind, 'slip');
  assert.ok(card.picks.every(pick => pick.tier === 'elite' || pick.tier === 'strong'));
  // Witt bats against Skubal, whose strikeouts are already on it: left out, and said why.
  assert.ok(card.picks.some(pick => pick.player === 'Tarik Skubal'));
  assert.ok(!card.picks.some(pick => pick.player === 'Bobby Witt Jr.'));
  assert.match(answer, /I left out Bobby Witt Jr\. over 1\.5 total bases vs DET: Skubal and Witt are on opposite sides of the same at-bats\./);
  // Graded the Slip Analyzer's way: a letter, the chance all hit, the Power Play.
  assert.match(card.letter, /^[A-F][+-]?$/);
  assert.equal(card.payout, 6);
  assert.ok(card.together > 0 && card.together < 1);
  assert.match(bot.card().lead, /^Here's a 3-pick slip from my Elite and Strong picks \(\d Elite(, \d Strong)?\)\. Parlay grade /);
  // Too few picks to trust: it says so instead of padding the slip.
  assert.match(await bot.ask('build me a 6-pick slip'), /^I only see \d Elite or Strong (MLB )?picks?( that go together \(.*\))? right now, not enough for a 6-pick slip/);
});

test('slip options: a safe slip takes the likeliest picks, a value slip weighs the payout, and a sport keeps it to one league', async () => {
  assert.equal(understand('build me a safe 2 pick slip').style, 'safe');
  assert.equal(understand('give me a value parlay').style, 'value');
  assert.equal(understand('build me a slip with demons').style, 'value');
  assert.equal(understand('build me a slip').style, 'best');
  assert.equal(understand('build me an nhl slip').sport, 'nhl');
  const bot = makeBot();
  const safe = await bot.ask('build me a safe 2-pick slip');
  assert.match(safe, /^Here's a safe 2-pick slip from my Elite and Strong picks, the likeliest of them: /);
  const chances = bot.card().card.picks.map(pick => pick.chance);
  assert.deepEqual(chances, [...chances].sort((a, b) => b - a));
  assert.ok(bot.suggestions().includes('Build me a value slip'));
  assert.match(await bot.ask('build me a value 2-pick slip'), /^Here's a value 2-pick slip from my Elite and Strong picks, the most payout for their chance: /);
  assert.ok(bot.suggestions().includes('Build me a safe slip'));
  await bot.ask('build me a 2-pick mlb slip');
  assert.match(bot.card().lead, /^Here's a 2-pick MLB slip /);
  assert.ok(bot.card().card.picks.every(pick => pick.sport === 'mlb'));
  // No good NHL matchups on this board: it says so instead of padding.
  assert.equal(await bot.ask('build me an nhl slip'), "I don't see any Elite or Strong NHL picks right now, so I'd hold off on a slip. Check back closer to game time.");
});

// An NFL board: half the players face a soft defense (good for overs), half a
// tough one (good for unders), and each has a Goblin that pays less.
function nflBoard() {
  const rows = [], reads = new Map();
  const players = [['Josh Allen', 'Pass Yards', 249.5, 'BUF', 'MIA', 'buf-mia'], ['James Cook', 'Rush Yards', 64.5, 'BUF', 'MIA', 'buf-mia'],
    ['CeeDee Lamb', 'Receiving Yards', 72.5, 'DAL', 'PHI', 'dal-phi'], ['Jalen Hurts', 'Pass Yards', 219.5, 'PHI', 'DAL', 'dal-phi'],
    ['Bijan Robinson', 'Rush Yards', 79.5, 'ATL', 'TB', 'atl-tb'], ['Puka Nacua', 'Receiving Yards', 81.5, 'LA', 'SF', 'la-sf'], ['Brock Purdy', 'Pass Yards', 241.5, 'SF', 'LA', 'la-sf'],
    ['Khalil Shakir', 'Receiving Yards', 49.5, 'BUF', 'MIA', 'buf-mia']];
  players.forEach(([name, stat, line, team, opponent, game], i) => {
    // A soft defense for most, a tough one for Lamb and Nacua (whose good side is the under).
    const position = /Pass/.test(stat) ? 'QB' : /Rush/.test(stat) ? 'RB' : 'WR', soft = i !== 2 && i !== 5;
    const defense = {position, defense: soft ? 29 : 3, defenseTeams: 32, defenseValue: soft ? line * 1.2 : line * 0.8, defenseAverage: line, defensePosition: position};
    const standard = {...row(name, 'nfl', stat, line, {team, opponent, game}), ...defense};
    const goblin = {...row(name, 'nfl', stat, line - 15.5, {team, opponent, game, modifier: 'goblin'}), ...defense};
    rows.push(standard);
    if (name !== 'Khalil Shakir') rows.push(goblin);  // no Goblin on Shakir's line
    reads.set(`${standard.id}|OVER`, {...graded(standard, 'OVER', {grade: 'A', chance: 0.64 - i * 0.01}), factor: 1});
    reads.set(`${standard.id}|UNDER`, {...graded(standard, 'UNDER', {grade: 'A', chance: 0.66 - i * 0.01}), factor: 1});
    reads.set(`${goblin.id}|OVER`, {...graded(goblin, 'OVER', {grade: 'A', chance: 0.78 - i * 0.01}), factor: 0.62 + i * 0.03});
  });
  return createBot({sports: ['nfl'], load: async sport => (sport === 'nfl' ? rows : []),
    judge: list => list.flatMap(item => ['OVER', 'UNDER'].map(side => reads.get(`${item.id}|${side}`))).filter(Boolean),
    assess: (item, side) => reads.get(`${item.id}|${side}`) || null, now: () => START, random: () => 0});
}

test('slips as asked: the league, overs or unders, how many picks, and a payout to build to', async () => {
  assert.deepEqual(['give me a 3 leg parlay with nfl over props', 'give me a 2 man 2x parlay', 'give me 3 overs that pay 6 times', 'all goblins 3 man', '6 man flex']
    .map(q => { const a = understand(q); return [a.intent, a.count, a.sport, a.side, a.payout, a.modifier, a.only, a.play]; }),
  [['slip', 3, 'nfl', 'OVER', null, null, false, 'power'], ['slip', 2, null, null, 2, null, false, 'power'], ['slip', 3, null, 'OVER', 6, null, false, 'power'],
    ['slip', 3, null, null, null, 'goblin', true, 'power'], ['slip', 6, null, null, null, null, false, 'flex']]);
  const bot = nflBoard();
  // Overs asked for: overs only, though the unders grade higher.
  await bot.ask('give me a 3 leg parlay with nfl over props');
  assert.deepEqual(bot.card().card.picks.map(pick => pick.side), ['OVER', 'OVER', 'OVER']);
  // A 2-man 2x: a Goblin with a regular line, paying about 2x.
  const two = await bot.ask('give me a 2 man 2x parlay');
  const card = bot.card().card;
  assert.equal(card.picks.length, 2);
  assert.deepEqual(card.picks.map(pick => pick.modifier).sort(), ['goblin', 'standard']);
  assert.ok(card.payout >= 1.84 && card.payout <= 2.6, String(card.payout));
  assert.match(two, /^Here's a 2-pick slip that pays about [\d.]+x from my Elite and Strong picks: .*\(goblin\).*Goblin and Demon payouts vary by line/);
  // No count asked: as many picks as that payout takes.
  await bot.ask('give me a 10x nfl parlay');
  assert.equal(bot.card().card.picks.length, 4);
  // Every pick a Goblin when that's what's asked.
  await bot.ask('all goblins 3 man nfl');
  assert.deepEqual(bot.card().card.picks.map(pick => pick.modifier), ['goblin', 'goblin', 'goblin']);
});

test('overs first: unders make a slip or the top plays only when they are sure things', async () => {
  const bot = nflBoard();
  // Lamb's and Nacua's good sides are unders, but not sure ones (7 of 10): left out.
  await bot.ask('build me a 5-pick nfl slip');
  const picks = bot.card().card.picks;
  assert.equal(picks.length, 5);
  assert.ok(picks.every(pick => pick.side === 'OVER'), JSON.stringify(picks.map(pick => [pick.player, pick.side])));
  // Asked for unders: unders.
  await bot.ask('give me a 2 leg parlay with nfl under props');
  assert.deepEqual(bot.card().card.picks.map(pick => pick.side), ['UNDER', 'UNDER']);
  // No side asked about a player: the over, unless the under is a sure thing.
  // Lamb's over has a tough matchup and his under is likelier but no sure thing: a pass, said plainly.
  const answer = await bot.ask('should I take CeeDee Lamb 72.5?');
  assert.match(answer, /^Red flag\./);
  assert.match(answer, /The under is likelier at \d+%, but I only back an under when everything points to it\./);
  assert.match(answer, /CeeDee Lamb over 72\.5 receiving yards vs PHI: \d+% to hit/);
  assert.equal(bot.card().card.verdict.tone, 'pass');
});

test('slips for one game, one team or one day', async () => {
  assert.deepEqual(['give me a parlay for the bills vs dolphins game', 'give me a bills parlay', 'give me a parlay for the chiefs game', 'sunday nfl parlay', 'give me a mnf parlay', 'build me a 3-pick slip']
    .map(q => { const a = understand(q); return [a.scope, a.day?.words || null]; }),
  [['game', null], ['team', null], ['game', null], [null, 'Sunday'], [null, 'Monday night'], [null, null]]);
  const bot = nflBoard();
  // One game: both picks from it (more than two from a game when that's what's asked). Allen's and
  // Cook's overs pull against each other (one game script or the other), so Shakir goes with Allen.
  assert.match(await bot.ask('give me a 2 man parlay for the bills vs dolphins game'), /^Here's a 2-pick NFL slip for the Bills vs Dolphins game from my Elite and Strong picks: /);
  assert.deepEqual(bot.card().card.picks.map(pick => pick.player).sort(), ['Josh Allen', 'Khalil Shakir']);
  // One team.
  assert.match(await bot.ask('2 man bills parlay'), /^Here's a 2-pick NFL slip for the Bills from my Elite and Strong picks: /);
  // Not enough there: said so, for that game.
  assert.match(await bot.ask('give me a 3 leg bills parlay'), /^I only see 2 Elite or Strong NFL picks for the Bills that go together \(James Cook over 64\.5 rush yards vs MIA works against them: .*\) right now, not enough for a 3-pick slip/);
  // No lines up for it at all.
  assert.equal(await bot.ask('give me a parlay for the chiefs game'), "I don't see a Chiefs game on the board right now. Lines usually go up a day or two before the game.");
  assert.equal(await bot.ask('sunday nfl parlay'), "I don't see any lines for Sunday on the board right now. Lines usually go up a day or two before the game.");
  // The day of the board's games (Saturday night, on the test's clock).
  assert.match(await bot.ask('3 leg parlay for tonight'), /^Here's a 3-pick NFL slip for tonight from my Elite and Strong picks: /);
});

test('game news counts in the bot as it does in the Slip Analyzer: a player listed Out is a Fade', async () => {
  const {rows, reads} = board();
  const asked = [];
  const bot = createBot({sports: ['mlb'], load: async () => rows,
    judge: list => list.flatMap(item => ['OVER', 'UNDER'].map(side => reads.get(`${item.id}|${side}`))).filter(leg => leg?.backed),
    assess: (item, side) => reads.get(`${item.id}|${side}`) || null, now: () => START, random: () => 0,
    // His game's news (slip-games.js loadGames): the injury report has Skubal out.
    games: async legs => { asked.push(...legs.map(leg => leg.row.player));
      return Object.fromEntries(legs.map(leg => [leg.key, {state: 'pre', team: leg.row.teamAbbr, opponent: leg.row.opponent,
        injuries: {DET: [{name: 'Tarik Skubal', status: 'Out', position: 'SP'}]}, player: null}])); }});
  // A slip is built from the picks with their news: Skubal (out) isn't on it.
  await bot.ask('build me a 3-pick slip');
  assert.ok(asked.includes('Tarik Skubal'));
  assert.ok(!bot.card().card.picks.some(pick => pick.player === 'Tarik Skubal'));
  // Nor on the home screen's picks.
  const home = await bot.today();
  assert.ok(![...home.top, home.safest, home.matchup].filter(Boolean).some(item => item.player === 'Tarik Skubal'));
  // Asked for the best K prop, the next one steps up.
  assert.match(await bot.ask('best k prop'), /Logan Webb over 5\.5 K's vs LAD/);
  assert.ok(asked.includes('Tarik Skubal'));
  // Asked about him, the news is the red flag.
  const verdict = await bot.ask('should I take Skubal over 6.5 Ks?');
  assert.match(verdict, /^Red flag\. Skubal is listed Out\. Picks on a player who doesn't play are usually voided\./);
  assert.equal(bot.card().card.pick.tier, 'fade');
  assert.equal(bot.card().card.pick.case.facts[0].kind, 'news');
});

test('ranking keeps one pick per player', () => {
  const {rows, reads} = board();
  const legs = [...reads.values()].filter(leg => leg.backed);
  legs.push(graded(rows[0], 'OVER', {grade: 'A', chance: 0.7}));
  assert.equal(rank(legs, {intent: 'best'}).filter(leg => leg.player === 'Tarik Skubal').length, 1);
});

// ---------------------------------------------------------------- the analyst

function analystBot() {
  const league = {teams: 30, kRate: 0.22, ops: 0.71, whip: 1.28, vs: {R: {kRate: 0.22, ops: 0.71}, L: {kRate: 0.23, ops: 0.7}}, recent: {kRate: 0.22, ops: 0.71}};
  const reds = {name: 'Cincinnati Reds', kRate: 0.24, kRateRank: 5, ops: 0.7, opsRank: 20, games: 150,
    vs: {R: {kRate: 0.26, kRateRank: 3, ops: 0.68, opsRank: 24}}, recent: {ops: 0.62, opsRank: 29, runsPerGame: 3.1, runsPerGameRank: 28, kRate: 0.27, games: 9}};
  const sox = {name: 'Boston Red Sox', kRate: 0.21, kRateRank: 20, ops: 0.74, opsRank: 8, games: 150,
    vs: {R: {kRate: 0.2, kRateRank: 24, ops: 0.75, opsRank: 6}}, recent: {ops: 0.82, opsRank: 1, runsPerGame: 6.1, runsPerGameRank: 2, kRate: 0.19, games: 9}};
  const yanks = {name: 'New York Yankees', kRate: 0.23, ops: 0.76, games: 150, vs: {R: {kRate: 0.22, kRateRank: 12, ops: 0.79, opsRank: 2}},
    recent: {ops: 0.85, opsRank: 1, runsPerGame: 6.2, games: 9}};
  const starts = [5.2, 6, 5, 6.1, 6.2].map((ip, index) => ({date: `2026-09-${10 + index * 5}`, ip, k: 7, pitches: 90 + index}));
  const mlbRow = (player, line, market, marketKey, extra) => ({...row(player, 'mlb', market, line, {marketKey, ...extra}), ...extra});
  const miz = mlbRow('Jacob Misiorowski', 4.5, 'Pitcher Strikeouts', 'pitching:strikeouts', {team: 'MIL', opponent: 'CIN', game: 'mil-cin', teamAbbr: 'MIL',
    teamId: 158, opponentTeamId: 113, isHome: true, matchup: {kind: 'lineup', lineup: reds, league,
      self: {id: 694819, name: 'Jacob Misiorowski', hand: 'R', projectedIp: 5.6, recentIp: 5.87, ip: 60, starts: 12, recentPitches: 92, lastStarts: starts,
        vsOpponent: {starts: 1, ip: 6, k: 9, er: 1}}}});
  const drew = mlbRow('Drew Rasmussen', 17.5, 'Pitching Outs', 'pitching:outs', {team: 'TB', opponent: 'BOS', game: 'tb-bos', teamAbbr: 'TB',
    teamId: 139, opponentTeamId: 111, matchup: {kind: 'lineup', lineup: sox, league, self: {id: 656876, name: 'Drew Rasmussen', hand: 'R', projectedIp: 5.9, recentIp: 6, ip: 150, starts: 27, recentPitches: 88, lastStarts: starts}}});
  const judge = mlbRow('Aaron Judge', 1.5, 'Hits+Runs+RBIs', 'hitting:hrr', {team: 'NYY', opponent: 'TOR', game: 'nyy-tor', teamAbbr: 'NYY', teamId: 147, opponentTeamId: 141,
    matchup: {kind: 'pitcher', pitcher: {id: 592332, name: 'Kevin Gausman', hand: 'R', whip: 1.2, era: 3.9, k9: 9.5, ip: 150}, lineup: yanks, league}});
  const tatum = {...row('Jayson Tatum', 'nba', 'Points', 26.5, {team: 'BOS', opponent: 'NYK', game: 'bos-nyk'}),
    gameLog: [34, 36, 38, 35, 37, 36, 39, 38, 40, 38].map((usage, index) => ({value: 25 + index, usage, opponent: 'MIA', date: `2026-04-0${index % 9 + 1}`}))};
  const graded = (item, side, chance, projection, extra = {}) => ({id: `${item.id}|${side}`, row: item, side, modifier: 'standard', grade: 'A', chance, book: null, backed: true,
    game: `${item.sport}:${item.gameId}`, player: item.player, price: null, records: {l10: {won: 8, games: 10, rate: 0.8}, ...extra}, read: {projection, factors: [], risks: []}});
  const reads = new Map([[`${miz.id}|OVER`, graded(miz, 'OVER', 0.7, 6.3)], [`${drew.id}|OVER`, graded(drew, 'OVER', 0.6, 18.1)],
    [`${judge.id}|OVER`, graded(judge, 'OVER', 0.63, 2.4, {h2h: {won: 4, games: 6, rate: 0.67}})], [`${tatum.id}|OVER`, graded(tatum, 'OVER', 0.6, 28.3)]]);
  const rows = [miz, drew, judge, tatum];
  return createBot({sports: ['mlb', 'nba'], load: async sport => rows.filter(item => item.sport === sport),
    judge: list => list.flatMap(item => ['OVER', 'UNDER'].map(side => reads.get(`${item.id}|${side}`))).filter(Boolean),
    assess: (item, side) => reads.get(`${item.id}|${side}`) || null, now: () => START, random: () => 0});
}

test('the analyst: innings for "they", first names on screen, the matchup against his hand', async () => {
  const bot = analystBot();
  await bot.ask('compare misiorowski and rasmussen');
  const deep = await bot.ask('how many projected innings are they going');
  assert.match(deep, /^Misiorowski projects for about 5\.6 innings \(17 outs\): 5\.9 a start over his last 5, 5 on the season and 92 pitches a start lately\. /);
  assert.match(deep, /Rasmussen projects for about 5\.9 innings \(18 outs\).*His outs line is 17\.5, so that leans over\./);
  const card = bot.card().card;
  assert.equal(card.kind, 'innings');
  assert.deepEqual(card.pitchers.map(item => [item.player, item.projected, item.starts.length]), [['Jacob Misiorowski', 5.6, 5], ['Drew Rasmussen', 5.9, 5]]);
  assert.match(await bot.ask('why jacob'), /^Why Jacob Misiorowski over 4\.5 K's vs CIN/);
  const matchup = await bot.ask('how does the lineup do vs righties');
  assert.equal(matchup, "Misiorowski (RHP) gets CIN, who strike out 26% against righties (3rd of 30). They've been cold lately: .620 OPS over the last 10 days (29th). "
    + "He's faced them once this year: 6 innings, 9 strikeouts, 1 earned run. Overall it's a neutral spot for his K's over.");
  const {card: detail} = bot.card();
  assert.equal(detail.kind, 'matchup');
  assert.deepEqual(detail.metrics.map(item => [item.key, item.value, item.rank, item.tone]),
    [['k', '26%', 3, 'good'], ['ops', '.680', 24, 'good'], ['recent', '.620', 29, 'good'], ['runs', '3.1', 28, 'good']]);
  assert.match(await bot.ask("are the other team's bats hot"), /^The Reds are cold: \.620 OPS over the last 10 days \(29th of 30\), down from \.700 on the season\./);
});

test('the analyst: hot lineups, strikeout rankings, a hitter\'s matchup, minutes and projections', async () => {
  const bot = analystBot();
  assert.match(await bot.ask('hottest lineups today'), /^Hottest lineups playing today, by OPS over the last 10 days: NYY \(\.850\), BOS \(\.820\) and CIN \(\.620\)\./);
  assert.equal(bot.card().card.rows[0].abbr, 'NYY');
  assert.match(await bot.ask('which lineups strike out the most'), /^Lineups that strike out the most today, against the hand they face: CIN 26% vs Misiorowski/);
  assert.equal(await bot.ask('how does judge match up'), 'Judge faces Kevin Gausman (RHP), 1.20 WHIP, 3.90 ERA. NYY hits .790 against righties (2nd of 30). '
    + 'The bats are hot: .850 OPS over the last 10 days. He\'s over 4 of 6 against TOR.');
  assert.equal(bot.card().card.versus.name, 'Kevin Gausman');
  assert.match(await bot.ask('how many minutes is tatum playing'), /^Tatum is averaging 37\.1 minutes over his last 10 and 38\.2 over his last 5, holding steady\./);
  assert.equal(bot.card().card.values.length, 10);
  assert.equal(await bot.ask("what's judge projected for"), 'Judge projects for 2.4 Hits+Runs+RBIs against the 1.5 line, 59% to go over.');
  assert.equal(bot.card().card.pick.projection, 2.4);
  // A first name that's an everyday word names nobody off screen.
  assert.notEqual(bot.card(), null);
  assert.deepEqual(findPlayers('will he go deep', ['Will Smith', 'Aaron Judge']).players, []);
  assert.deepEqual(findPlayers('why will', ['Will Smith', 'Aaron Judge'], {preferred: ['Will Smith']}).players, ['Will Smith']);
});

test('every pick needs a good matchup: a hot last 10 into a tough one is a red flag', async () => {
  const {rows, reads} = board();
  const hot = row('Hunter Greene', 'mlb', 'Pitcher Strikeouts', 7.5, {marketKey: 'pitching:strikeouts', team: 'CIN', opponent: 'NYY', game: 'cin-nyy'});
  const neutral = row('Joe Ryan', 'mlb', 'Pitcher Strikeouts', 5.5, {marketKey: 'pitching:strikeouts', team: 'MIN', opponent: 'CHW', game: 'min-chw'});
  // The best record and chance on the board, into a lineup that rarely strikes out.
  reads.set(`${hot.id}|OVER`, graded(hot, 'OVER', {grade: 'A', chance: 0.72, recent: [9, 10], matchup: 'NYY strike out 18% of the time (league 22%)', lift: 0.94}));
  reads.set(`${neutral.id}|OVER`, graded(neutral, 'OVER', {grade: 'A', chance: 0.7, recent: [8, 10], matchup: 'CHW strike out about the league rate', lift: 1.005}));
  // What the analyzer's engine reads: NYY rarely strike out against righties, CHW about the league rate.
  const league = {teams: 30, kRate: 0.22, vs: {R: {kRate: 0.22}}};
  hot.matchup = {kind: 'lineup', league, lineup: {name: 'New York Yankees', kRate: 0.18, games: 150, vs: {R: {kRate: 0.18, kRateRank: 29}}}, self: {hand: 'R'}};
  neutral.matchup = {kind: 'lineup', league, lineup: {name: 'Chicago White Sox', kRate: 0.22, games: 150, vs: {R: {kRate: 0.221, kRateRank: 15}}}, self: {hand: 'R'}};
  const all = [...rows, hot, neutral];
  const bot = createBot({sports: ['mlb'], load: async () => all,
    judge: list => list.flatMap(item => ['OVER', 'UNDER'].map(side => reads.get(`${item.id}|${side}`))).filter(leg => leg?.backed),
    assess: (item, side) => reads.get(`${item.id}|${side}`) || null, now: () => START, random: () => 0});
  // Neither is a pick: one has a tough matchup, the other only a neutral one.
  assert.match(await bot.ask('best k prop'), /Tarik Skubal over 6\.5 K's/);
  const verdict = await bot.ask('should I take Greene over 7.5 Ks?');
  assert.match(verdict, /^Red flag\. He's 9 of his last 10, but the matchup is (tough|bad) \(\d+\)\. NYY strikes out 18% of the time vs righties/);
  assert.equal(bot.card().card.verdict.label, 'Red flag');
  assert.equal(bot.card().card.pick.redFlag.startsWith("He's 9 of his last 10"), true);
  // The card shows the analyzer's matchup panel.
  assert.ok(['tough', 'bad'].includes(bot.card().card.pick.case.tone));
  assert.equal(bot.card().card.pick.case.facts[0].key, 'lineup');
  assert.match(await bot.ask('why'), /Red flag: He's 9 of his last 10, but the matchup is (tough|bad) \(\d+\) \(NYY strikes out 18%.*\)\. (Risky|Fade), \d+% to hit\.$/);
  assert.match(await bot.ask('should I take Ryan over 5.5 Ks?'), /^Lean yes\. The numbers are there, but the matchup is only neutral\./);
});

test('NFL and WNBA: stats, teams and leagues', async () => {
  assert.equal(understand('best receiving yards prop').stat.key, 'receiving_yards');
  assert.equal(understand('mahomes passing yards').stat.key, 'passing_yards');
  assert.equal(understand('best rush + rec yards').stat.key, 'rushing_receiving_yards');
  assert.equal(understand('who scores an anytime td').stat.key, 'touchdowns');
  assert.deepEqual(understand('best chiefs prop').teamOptions.map(team => [team.sport, team.codes[0]]), [['nfl', 'KC']]);
  assert.equal(understand('best wnba points prop').sport, 'wnba');
  assert.deepEqual(understand('best aces prop').teamOptions.map(team => team.sport), ['wnba']);
  const kelce = row('Travis Kelce', 'nfl', 'Receiving Yards', 52.5, {marketKey: 'receiving_yards', team: 'KC', opponent: 'LV', game: 'kc-lv'});
  const henry = row('Derrick Henry', 'nfl', 'Rush Yards', 88.5, {marketKey: 'rushing_yards', team: 'BAL', opponent: 'CIN', game: 'bal-cin'});
  const wilson = row("A'ja Wilson", 'wnba', 'Points', 24.5, {team: 'LV', opponent: 'NY', game: 'lv-ny'});
  const reads = new Map([[`${kelce.id}|OVER`, graded(kelce, 'OVER', {grade: 'A', chance: 0.64})], [`${henry.id}|OVER`, graded(henry, 'OVER', {grade: 'B', chance: 0.6})],
    [`${wilson.id}|OVER`, graded(wilson, 'OVER', {grade: 'A', chance: 0.66})]]);
  const rows = [kelce, henry, wilson];
  const bot = createBot({sports: ['nfl', 'wnba'], load: async sport => rows.filter(item => item.sport === sport),
    judge: list => list.flatMap(item => ['OVER', 'UNDER'].map(side => reads.get(`${item.id}|${side}`))).filter(Boolean),
    assess: (item, side) => reads.get(`${item.id}|${side}`) || null, now: () => START, random: () => 0});
  assert.match(await bot.ask('best receiving yards prop'), /Travis Kelce over 52\.5 rec yards vs LV/);
  assert.match(await bot.ask('best rushing yards prop'), /Derrick Henry over 88\.5 rush yards vs CIN/);
  assert.match(await bot.ask('best wnba points prop'), /A'ja Wilson over 24\.5 points vs NY/);
  assert.match(await bot.ask('best nhl prop'), /covering NFL, WNBA right now/);
  assert.ok(bot.examples().includes('Best receiving yards prop'));
});

test('the cheat sheets answer NRFIs, weather, streaks, career numbers, hot bats and home run bats', async () => {
  const face = (id, name, team, extra = {}) => ({id, name, team, teamId: 100 + id, opponent: 'BOS', home: true, pitcher: {id: 9, name: 'Brayan Bello', throws: 'R'}, ...extra});
  const SHEETS = {
    nrfi: {rows: [
      {away: {team: 'NYY', teamId: 147, pitcher: {name: 'Gerrit Cole', season: 0.78}}, home: {team: 'TB', teamId: 139, pitcher: {name: 'Drew Rasmussen', season: 0.8}}, chance: 0.6, nrfi: -150, yrfi: 150, lean: 'nrfi'},
      {away: {team: 'ATL', teamId: 144, pitcher: {name: 'JR Ritchie', season: 0.6}}, home: {team: 'LAD', teamId: 119, pitcher: {name: 'Tarik Skubal', season: 0.6}}, chance: 0.42, nrfi: 138, yrfi: -138, lean: 'yrfi'}]},
    park: {rows: [
      {venue: 'Dodger Stadium', away: 'ATL', home: 'LAD', homeId: 119, runs: 14, hr: 34, temp: 97, wind: 6, windEffect: 'out', dome: false, precip: 0},
      {venue: 'American Family Field', away: 'SD', home: 'MIL', homeId: 158, runs: -5, hr: -17, temp: 55, wind: 9, windEffect: 'in', dome: false, precip: 40}]},
    streaks: {streaks: {hits: {label: '1+ Hits', rows: [face(1, 'Andy Pages', 'LAD', {streak: 14}), face(2, 'Michael Harris', 'ATL', {streak: 13})]},
      onbase: {label: 'On base', rows: [face(3, 'Juan Soto', 'NYM', {streak: 21})]}}},
    bvp: {rows: [face(4, 'Aaron Judge', 'NYY', {pa: 22, ab: 20, hits: 8, hr: 2, so: 3, avg: 0.4, ops: 1.2, sample: 'strong', score: 80})]},
    hot: {days: 14, rows: [face(5, 'Giancarlo Stanton', 'NYY', {ops: 1.114, hr: 4, delta: {ops: 0.475}, tag: 'hot'})]},
    hr: {rows: [face(6, 'Cal Raleigh', 'SEA', {score: 82, barrel: 19.6, vsHand: {iso: 0.31}, park: 12, hot: true}), face(7, 'Kyle Schwarber', 'PHI', {score: 75, barrel: 18})]},
  };
  const asked = [];
  const bot = createBot({sports: ['mlb'], load: async () => [], sheets: async name => { asked.push(name); return SHEETS[name]; }, now: () => START, random: () => 0});
  assert.match(await bot.ask('nrfi today?'), /^Best NRFI today: NYY @ TB at 60% scoreless \(fair -150\)\. Best YRFI: ATL @ LAD, 58% to see a run \(fair -138\)\./);
  assert.equal(bot.card().card.kind, 'board');
  assert.deepEqual(bot.card().card.rows.map(row => [row.value, row.label]), [['60%', 'Lean NRFI'], ['42%', 'Lean YRFI']]);
  assert.match(await bot.ask('yankees nrfi?'), /^NYY @ TB: 60% chance of a scoreless first, so lean nrfi\. Fair NRFI -150, YRFI \+150\. Gerrit Cole has kept 78% of his first innings scoreless/);
  assert.match(await bot.ask("what's the weather today"), /^Best hitting conditions: Dodger Stadium \(\+14% runs, 97°, 6 mph out\)\. Toughest: American Family Field \(−5% runs/);
  assert.match(await bot.ask('where is the wind blowing out'), /^Blowing out: Dodger Stadium \(6 mph\)\. Blowing in: American Family Field \(9 mph\)\./);
  assert.match(await bot.ask('any rain today'), /^Rain risk: American Family Field \(40%\)\./);
  assert.match(await bot.ask('who is on a hit streak'), /^Longest active 1\+ hits streaks today: Andy Pages \(14 straight\) and Michael Harris \(13 straight\)\./);
  assert.match(await bot.ask('on base streaks'), /Juan Soto \(21 straight\)/);
  assert.match(await bot.ask('who are the hottest hitters'), /^Hottest bats over the last 14 days: Giancarlo Stanton \(1\.114 OPS, \+\.475 over his season, 4 HR\)\./);
  assert.match(await bot.ask('who is going to homer today'), /^Top home run bats today: Cal Raleigh \(82\) and Kyle Schwarber \(75\)\. Raleigh: 19\.6% barrels, \.310 ISO vs RHP, \+12% HR park and hot lately\./);
  assert.deepEqual(bot.card().card.rows.map(row => [row.name, row.value, row.tag]), [['Cal Raleigh', '82', 'Hot'], ['Kyle Schwarber', '75', null]]);
  assert.deepEqual([...new Set(asked)], ['nrfi', 'park', 'streaks', 'hot', 'hr']);  // each sheet fetched once, then kept
  assert.ok(bot.thinking('nrfi today?').includes('Reading first innings'));
  // Without MLB, the sheets say so.
  const nba = createBot({sports: ['nba'], load: async () => [], sheets: async () => ({rows: []}), now: () => START});
  assert.match(await nba.ask('nrfi today?'), /cover MLB/);
});

test('career numbers against today\'s starter, by name', async () => {
  const judge = row('Aaron Judge', 'mlb', 'Hits+Runs+RBIs', 1.5, {marketKey: 'hitting:hrr', team: 'NYY', opponent: 'BOS'});
  const bvp = {rows: [{id: 4, name: 'Aaron Judge', team: 'NYY', teamId: 147, pitcher: {name: 'Brayan Bello', throws: 'R'}, pa: 22, ab: 20, hits: 8, hr: 2, so: 3, avg: 0.4, ops: 1.2, sample: 'strong'}]};
  const bot = createBot({sports: ['mlb'], load: async () => [judge], sheets: async () => bvp, now: () => START, random: () => 0});
  assert.match(await bot.ask('how does judge hit bello'), /^Aaron Judge vs Brayan Bello: 8-for-20 \(\.400\), 2 HR, 3 K in 22 plate appearances\. That's a strong sample\./);
  assert.match(await bot.ask('judge career numbers vs cole'), /\(He faces Brayan Bello today, not Cole\.\)$/);
  assert.doesNotMatch(await bot.ask('judge history vs bello'), /He faces/);
});

test('every pick card carries a scouting report: windows, games, splits, books and the ladder', async () => {
  const day = index => `2026-09-${String(10 + index).padStart(2, '0')}`;
  const values = [5, 8, 7, 9, 4, 8, 6, 10, 7, 9, 8, 5];
  const kelce = {...row('Travis Kelce', 'nfl', 'Receptions', 6.5, {marketKey: 'receptions', team: 'KC', opponent: 'LV', game: 'kc-lv'}), isHome: true,
    gameLog: values.map((value, index) => ({value, date: day(index), home: index % 2 === 0, opponent: index % 4 === 0 ? 'LV' : 'DEN'})),
    apps: [{key: 'prizepicks', name: 'PrizePicks', over: null, under: null}, {key: 'draftkings', name: 'DraftKings', over: -140, under: 110}, {key: 'fanduel', name: 'FanDuel', over: -120, under: -110}]};
  const leg = {...graded(kelce, 'OVER', {grade: 'A', chance: 0.66, recent: [7, 10], book: 0.58, projection: 7.6}),
    records: {l5: {won: 4, games: 5, rate: 0.8}, l10: {won: 7, games: 10, rate: 0.7}, season: {won: 8, games: 12, rate: 8 / 12}, h2h: {won: 2, games: 3, rate: 2 / 3}}};
  const report = pickReport(leg);
  assert.deepEqual(report.rings.map(item => [item.label, item.won, item.games]), [['L5', 4, 5], ['L10', 7, 10], ['Season', 8, 12], ['vs LV', 2, 3]]);
  assert.equal(report.games.length, 12);
  assert.deepEqual(report.games.slice(0, 3).map(game => [game.value, game.hit, game.opponent, game.home]), [[5, false, 'LV', true], [8, true, 'DEN', false], [7, true, 'DEN', true]]);
  assert.deepEqual([report.stats.median, report.stats.high, report.stats.low, report.stats.projection], [7.5, 10, 4, 7.6]);
  assert.deepEqual([report.splits.today, report.splits.home.games, report.splits.home.won, report.splits.away.won], ['home', 6, 3, 5]);
  assert.deepEqual(report.splits.versus.games.map(game => game.value), [5, 4, 7]);
  // Best price first, PrizePicks left out, each with the chance it implies.
  assert.deepEqual(report.books.map(book => [book.name, book.price, Math.round(book.chance * 1000) / 1000]), [['FanDuel', -120, 0.545], ['DraftKings', -140, 0.583]]);
  assert.equal(Math.round(report.market.edge * 100), 8);
  // In the bot, the ladder lists his other lines on the stat.
  const goblin = {...kelce, id: 'kelce-goblin', line: 4.5, modifier: 'goblin'};
  const reads = new Map([[`${kelce.id}|OVER`, leg], [`goblin|OVER`, {...graded(goblin, 'OVER', {grade: 'A', chance: 0.81, recent: [9, 10]})}]]);
  const bot = createBot({sports: ['nfl'], load: async () => [kelce, goblin],
    judge: list => list.map(item => item.id === goblin.id ? reads.get('goblin|OVER') : reads.get(`${item.id}|OVER`)).filter(Boolean),
    assess: (item, side) => item.id === goblin.id ? reads.get('goblin|OVER') : reads.get(`${item.id}|${side}`) || null, now: () => START, random: () => 0});
  await bot.ask('should I take kelce over 6.5 receptions');
  const ladder = bot.card().card.pick.report.ladder;
  // Each rung judged the same way as the pick itself.
  assert.deepEqual(ladder.map(item => [item.line, item.modifier, item.current, Math.round(item.chance * 100)]), [[4.5, 'goblin', false, 77], [6.5, 'standard', true, 60]]);
  assert.equal(bot.card().card.pick.row.id, kelce.id);
});

test('the home screen shows today\'s top plays, the safest one and the board', async () => {
  const bot = makeBot({time: START - 3600e3});
  const today = await bot.today();
  assert.equal(today.props, 10);
  assert.equal(today.games, 8);
  assert.deepEqual(today.leagues.map(item => [item.sport, item.props]), [['mlb', 7], ['nba', 1], ['nhl', 2]]);
  assert.ok(today.next);
  assert.equal(today.top.length, 4);
  // One per player, best first, each with the question that opens its report.
  assert.equal(new Set(today.top.map(play => play.player)).size, 4);
  assert.ok(today.top.every(play => play.grade && play.question.startsWith(`Should I take ${play.player} `)));
  assert.equal(today.safest.player, 'Tarik Skubal');
  assert.equal(today.mlb, true);
  // The question behind a play opens that pick's report.
  await bot.ask(today.top[0].question);
  assert.equal(bot.card().card.kind, 'pick');
  assert.equal(bot.card().card.pick.player, today.top[0].player);
});
