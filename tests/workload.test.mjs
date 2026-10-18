import test from 'node:test';
import assert from 'node:assert/strict';
import {comeback, comebackTag, workloadFacts} from '../src/workload.js';
import {newsCap, withGame} from '../src/slip-games.js';
import {judge} from '../src/slip-check.js';

// Weekly games from `start`, `count` of them, each with his work that game.
const weekly = (start, count, usage, value = 70) => Array.from({length: count}, (_, index) => {
  const date = new Date(Date.parse(`${start}T12:00:00Z`) + index * 7 * 86400000).toISOString().slice(0, 10);
  return {date, value, usage: Array.isArray(usage) ? usage[index] : usage};
});
const skattebo = (gameLog, extra = {}) => ({sport: 'nfl', player: 'Cam Skattebo', position: 'RB', teamAbbr: 'NYG', opponent: 'PHI',
  startsAt: '2026-10-18T17:00:00Z', market: 'Rushing Yards', marketKey: 'rushing_yards', line: 62.5, gameLog, ...extra});
const pregame = injuries => ({sport: 'nfl', state: 'pre', team: 'NYG', opponent: 'PHI', injuries: {NYG: injuries, PHI: []}, player: null});

test('his first game of the season, weeks into it: a first game back', () => {
  // Last season's games, hurt in late October.
  const row = skattebo(weekly('2025-09-07', 8, 22));
  const back = comeback(row);
  assert.equal(back.gamesBack, 0);
  assert.equal(new Date(back.lastPlayed).toISOString().slice(0, 10), '2025-10-26');
  const facts = workloadFacts(row, 'OVER');
  assert.equal(facts.length, 1);
  assert.equal(facts[0].level, 'return');
  assert.match(facts[0].text, /^First game back: Skattebo hasn't played since Oct 26, 2025\. Players coming back are often on a snap count/);
  assert.equal(newsCap(facts), 'risky');
  assert.equal(comebackTag(row).text, '1st game back');
  // On an Under it helps, and caps nothing.
  const under = workloadFacts(row, 'UNDER');
  assert.equal(under[0].level, undefined);
  assert.ok(under[0].impact > 0);
});

test('opening week is not a comeback, nor is a bye', () => {
  // Week 1 of the new season: nobody has played yet.
  assert.equal(comeback(skattebo(weekly('2025-09-07', 17, 20), {startsAt: '2026-09-13T17:00:00Z'})), null);
  // A bye: two weeks between games.
  const bye = [...weekly('2026-09-13', 4, 20), ...weekly('2026-10-18', 1, 20)];
  assert.equal(comeback(skattebo(bye.slice(0, 4), {startsAt: '2026-10-18T17:00:00Z'})), null);
});

test('back a game, his work down since: limited', () => {
  // Hurt in week 2, missed two games, back on Oct 11 with 9 touches.
  const log = [...weekly('2026-09-13', 2, 21), ...weekly('2026-10-11', 1, 9)];
  const row = skattebo(log);
  const back = comeback(row);
  assert.deepEqual([back.gamesBack, back.usage], [1, {since: 9, before: 21}]);
  const [fact] = workloadFacts(row, 'OVER');
  assert.equal(fact.level, 'limited');
  assert.equal(fact.text, "Skattebo's workload is down since he came back from 3 weeks out: 9 carries and targets a game since, 21 before. Today is his second game back");
  // Back to his usual work: shown, and nothing held against him.
  const full = workloadFacts(skattebo([...weekly('2026-09-13', 2, 21), ...weekly('2026-10-11', 1, 20)]), 'OVER');
  assert.equal(full[0].level, undefined);
  assert.equal(full[0].impact, 0);
});

test('a game back with nothing else known: never Elite', () => {
  const log = [...weekly('2026-09-13', 2, null), ...weekly('2026-10-11', 1, null)];
  const [fact] = workloadFacts(skattebo(log), 'OVER');
  assert.equal(fact.level, 'back');
  assert.equal(newsCap([fact]), 'strong');
});

test('the injury report says he is on a snap count', () => {
  const healthy = weekly('2026-09-07', 6, 20);
  const limit = {kind: 'snaps', cleared: false, date: '2026-10-17'};
  const row = withGame(skattebo(healthy), pregame([{name: 'Cam Skattebo', status: 'Active', position: 'RB', limit}]));
  const [fact] = workloadFacts(row, 'OVER');
  assert.equal(fact.level, 'limited');
  assert.equal(fact.text, "Skattebo is expected to be on a snap count today (injury report, Oct 17, 2026). His usual numbers don't apply");
  // Said to have no limit: a first game back is then only never-Elite.
  const cleared = withGame(skattebo(weekly('2025-09-07', 8, 22)), pregame([{name: 'Cam Skattebo', status: 'Active', position: 'RB',
    limit: {kind: 'snaps', cleared: true}}]));
  assert.equal(workloadFacts(cleared, 'OVER')[0].level, 'back');
  // Out is out: the status says it.
  const out = withGame(skattebo(healthy), pregame([{name: 'Cam Skattebo', status: 'Out', position: 'RB', limit}]));
  assert.deepEqual(workloadFacts(out, 'OVER'), []);
});

test('basketball minutes, a pitcher off the injured list, hitters left alone', () => {
  const daily = (start, count, usage, step = 2) => Array.from({length: count}, (_, index) => ({
    date: new Date(Date.parse(`${start}T12:00:00Z`) + index * step * 86400000).toISOString().slice(0, 10), value: 20, usage}));
  const nba = {sport: 'nba', player: 'Jalen Brunson', startsAt: '2027-01-20T00:30:00Z', marketKey: 'points', line: 26.5,
    gameLog: [...daily('2026-12-01', 10, 35), ...daily('2027-01-17', 1, 21)]};
  const [fact] = workloadFacts(nba, 'OVER');
  assert.equal(fact.level, 'limited');
  assert.match(fact.text, /21 minutes a game since, 35 before/);
  const starts = (start, count) => daily(start, count, 95, 5);
  const pitcher = {sport: 'mlb', player: 'Tarik Skubal', startsAt: '2026-08-20T23:00:00Z', marketKey: 'pitching:strikeouts', line: 7.5,
    gameLog: starts('2026-06-01', 8)};
  assert.equal(workloadFacts(pitcher, 'OVER')[0].level, 'return');
  assert.match(workloadFacts(pitcher, 'OVER')[0].text, /often on a pitch count/);
  assert.equal(comeback({...pitcher, marketKey: 'hitting:hits'}), null);
});

test('the grade: held back is Risky, and his old games count for little', () => {
  const row = skattebo(weekly('2025-09-07', 8, 22, 95), {records: {}});
  const judged = judge({row, side: 'OVER', chance: 0.85, modifier: 'standard', records: {l10: {won: 8, games: 8, rate: 1}}});
  assert.equal(judged.tier, 'risky');
  assert.ok(judged.chance < 0.6, String(judged.chance));
  // His 8-for-8 came before he was out: shown, not counted.
  const form = judged.matchup.facts.find(item => item.kind === 'form');
  assert.match(form.text, /\(before he was out\)$/);
  assert.equal(form.impact, 0);
  assert.equal(judged.matchup.facts[0].key, 'workload');
});

test('the Scout Assistant says why: he is held back', async () => {
  const {withMatchup} = await import('../src/krazy-bot.js');
  const row = skattebo(weekly('2025-09-07', 8, 22, 95));
  const leg = withMatchup({row, side: 'OVER', chance: 0.85, modifier: 'standard', records: {l10: {won: 8, games: 8, rate: 1}}});
  assert.equal(leg.backed, false);
  assert.match(leg.redFlag, /^First game back: Skattebo hasn't played since Oct 26, 2025/);
});
