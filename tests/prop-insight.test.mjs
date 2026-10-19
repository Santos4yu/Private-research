// The Finder's Analyze (prop-analyze.js, prop-insight.js): a line graded
// both ways as the Slip Analyzer grades a pick, the side to take, and the
// write-up from the same numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import {gradeProp} from '../src/prop-analyze.js';
import {buildInsight, chooseSide, voice} from '../src/prop-insight.js';
import {SLIP_SPORTS} from '../src/slip-check.js';

// A game in two days; his games weekly up to last week (a long gap reads as a first game back).
const DAY = 86400000;
const LATER = new Date(Date.now() + 2 * DAY).toISOString();
const w = (hits, games, average = null) => ({hits, misses: games - hits, pushes: 0, decisions: games, sample: games, hitRate: hits / games * 100, average});
const games = values => values.map((value, index) => ({value, date: new Date(Date.now() - (values.length - index) * 7 * DAY).toISOString().slice(0, 10),
  opponent: index % 5 ? 'SEA' : 'WAS', home: index % 2 === 0}));
// No network: every loader answers with nothing, as when a part can't load.
const offline = {loadLines: async () => [], loadMatchups: async () => ({}), loadLearning: async () => null, loadGames: async () => ({}),
  loadTeammates: async () => ({}), loadSoccerOpponents: async () => null, enrich: () => null};

function kittle(extra = {}) {
  const log = [4, 6, 3, 5, 4, 2, 7, 5, 4, 5, 6, 8, 7, 5, 1, 2, 4, 6, 4, 5];
  return {id: 'nfl:kittle:rec:3.5', sport: 'nfl', player: 'George Kittle', playerId: 'kittle', position: 'TE', market: 'Receptions', marketKey: 'receptions',
    line: 3.5, modifier: 'standard', direction: 'OVER', startsAt: LATER, teamAbbr: 'SF', opponent: 'WAS', homeTeamAbbr: 'SF', awayTeamAbbr: 'WAS',
    gameLog: games(log), historyStatus: 'ready',
    windows: {l5: w(4, 5, 4.6), l10: w(8, 10, 4.6), l20: w(14, 20, 4.5), season: w(4, 5, 4.2), h2h: w(1, 1, 5)},
    defenseValue: 6.1, defenseAverage: 5, defense: 30, defenseTeams: 32, defensePosition: 'TE',
    apps: [{key: 'prizepicks', name: 'PrizePicks', over: null, under: null}, {key: 'fanduel', name: 'FanDuel', over: -150, under: 120}], ...extra};
}

test('a strong More is written up from its record, the matchup and the books', async () => {
  const {row, over, under} = await gradeProp(kittle(), {deps: offline});
  assert.ok(over?.tier, 'the More is graded');
  assert.ok(under, 'the Less is graded too');
  const insight = buildInsight(row, over, under);
  assert.equal(insight.side, 'OVER');
  assert.ok(insight.verdict.play, `${insight.tier} is one to play`);
  assert.match(insight.verdict.title, /^(Elite play|Strong play|Lean): More 3\.5$/);
  assert.match(insight.summary[0], /^George Kittle has gone over 3\.5 receptions in 8 of the last 10 games, averaging 4\.6/);
  assert.ok(insight.summary.some(line => /WAS allows 6\.1 receptions a game to tight ends/.test(line)), insight.summary.join(' | '));
  assert.ok(insight.summary.some(line => /The books agree: FanDuel has the over at −150/.test(line)), insight.summary.join(' | '));
  assert.ok(insight.reasons.some(item => item.icon === 'defense'));
  assert.ok(insight.numbers.some(item => item.label === 'L10' && item.value === '8/10'));
  assert.ok(insight.summary.every(line => /[.!?]$/.test(line)), 'every sentence ends');
  // A Fade on the other side is just a Fade, not a Less held back.
  if (insight.other?.tier === 'fade') assert.equal(insight.other.held, false);
});

test('the line on the chart is the one graded', async () => {
  const {row} = await gradeProp(kittle(), {line: 5.5, deps: offline});
  assert.equal(row.line, 5.5);
  // His last 10 at 5.5: 7, 8, 7, 6 clear it... counted from the games themselves.
  assert.equal(row.windows.l10.sample, 10);
});

test('the Less is taken only when every read agrees, as on the Slip Analyzer', () => {
  const strongUnder = {side: 'UNDER', tier: 'strong', chance: 0.66, matchup: {facts: []},
    records: {l5: {won: 5, games: 5, rate: 1}, l10: {won: 9, games: 10, rate: 0.9}, season: {won: 9, games: 12, rate: 0.75}}};
  const riskyOver = {side: 'OVER', tier: 'risky', chance: 0.4, records: {}, matchup: {facts: []}};
  // Strong isn't enough for an Under: the More stays the read (and is a pass).
  assert.equal(chooseSide(riskyOver, strongUnder).pick, riskyOver);
  const eliteUnder = {...strongUnder, tier: 'elite', chance: 0.72};
  assert.equal(chooseSide(riskyOver, eliteUnder).pick, eliteUnder);
  assert.equal(chooseSide(null, null).pick, null);
});

test('when every read agrees on the Less, the Less is the play', async () => {
  const cold = kittle({windows: {l5: w(1, 5, 2.4), l10: w(2, 10, 2.6), l20: w(6, 20, 3.1), season: w(1, 5, 2.4), h2h: null},
    gameLog: games([2, 1, 3, 2, 2, 4, 1, 3, 2, 1, 2, 3, 1, 2, 2, 3, 1, 2, 2, 1]), defenseValue: 3.9, defense: 2,
    apps: [{key: 'prizepicks', name: 'PrizePicks'}, {key: 'pinnacle', name: 'Pinnacle', over: 150, under: -180}]});
  const {row, over, under} = await gradeProp(cold, {deps: offline});
  const insight = buildInsight(row, over, under);
  assert.equal(insight.side, 'UNDER');
  assert.match(insight.verdict.title, /: Less 3\.5$/);
  assert.ok(insight.summary.some(line => /Pinnacle has the under at −180/.test(line)), insight.summary.join(' | '));
  assert.equal(insight.other.side, 'OVER');
  assert.ok(['fade', 'risky'].includes(insight.other.tier));
});

test('a line to stay off says so', async () => {
  // About a coin flip, a tough matchup, the books against the More.
  const flat = kittle({windows: {l5: w(2, 5, 3.4), l10: w(5, 10, 3.5), l20: w(10, 20, 3.5), season: w(2, 5, 3.4), h2h: null},
    gameLog: games([3, 4, 3, 4, 2, 5, 3, 4, 3, 4, 3, 4, 3, 5, 2, 4, 3, 4, 3, 4]), defenseValue: 4.1, defense: 4,
    apps: [{key: 'prizepicks', name: 'PrizePicks'}, {key: 'pinnacle', name: 'Pinnacle', over: 125, under: -150}]});
  const {row, over, under} = await gradeProp(flat, {deps: offline});
  const insight = buildInsight(row, over, under);
  assert.ok(!insight.verdict.play, `${insight.side} ${insight.tier}`);
  assert.match(insight.verdict.title, /^(Fade the|Risky on the) (More|Less)$/);
  assert.ok(insight.risks.length > 0);
  assert.ok(/sit this one out|grades better/.test(insight.summary.at(-1)));
  // A Less that grades well without every read agreeing isn't offered as the play.
  if (insight.other?.held) assert.match(insight.summary.at(-1), /only backed when every read agrees/);
  // The tough defense is said once.
  assert.equal(insight.risks.filter(item => /receptions a game to (tight ends|TEs)/.test(item.text)).length, 1, insight.risks.map(item => item.text).join(' | '));
});

test('a WNBA player is written up in her own pronouns', () => {
  assert.equal(voice('8 of his last 10, more than he usually gets', {sport: 'wnba'}), '8 of her last 10, more than she usually gets');
  assert.equal(voice('His usage is up', {sport: 'wnba'}), 'Her usage is up');
  assert.equal(voice('8 of his last 10', {sport: 'nba'}), '8 of his last 10');
});

test('nothing to grade gives nothing to write', async () => {
  const thin = kittle({windows: {l5: w(1, 2), l10: null, season: null}, gameLog: games([1, 2])});
  const {row, over, under} = await gradeProp(thin, {deps: offline});
  assert.equal(buildInsight(row, over, under), null);
});

test('Analyze is offered for the Slip Analyzer\'s sports', async () => {
  // AnalyzeButton.jsx keeps its own list so the Finder loads none of the grading until it's pressed.
  const source = (await import('node:fs')).readFileSync(new URL('../src/AnalyzeButton.jsx', import.meta.url), 'utf8');
  const listed = JSON.parse(source.match(/ANALYZE_SPORTS=new Set\((\[[^\]]*\])\)/)[1].replace(/'/g, '"'));
  assert.deepEqual([...listed].sort(), [...SLIP_SPORTS].sort());
});

