// The NFL matchup score (src/nfl-matchup-score.js) on week 7 of 2026: the
// defenses as nflverse's weekly stats add them up for weeks 1-6, every
// player's role (finder.usage_of) and each team's week-7 line from the
// schedule (finder.slate_of) -- tests/fixtures/nfl-2026-week7-league.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {matchupScore, spreadScores, cardScores, band, familiesOf} from '../src/nfl-matchup-score.js';
import {matchupCase} from '../src/slip-matchup.js';

const league = JSON.parse(readFileSync(new URL('./fixtures/nfl-2026-week7-league.json', import.meta.url)));
const row = (player, playerId, position, teamAbbr, opponent, marketKey) => ({id: player, sport: 'nfl', player, playerId, position, teamAbbr, opponent,
  marketKey, line: 1.5});
const GIBBS = ['Jahmyr Gibbs', '00-0039139', 'RB', 'DET', 'GB'];
const sum = found => 50 + found.reads.reduce((total, read) => total + read.points, 0);

test('touchdowns read the points his team is expected to score, not the defense’s touchdowns allowed', () => {
  // Backtested on 2024-25: the line's team total predicted touchdowns; what a
  // defense had allowed in touchdowns didn't.
  const gibbs = matchupScore(row(...GIBBS, 'touchdowns'), league);
  assert.equal(gibbs.score, 90);                                  // RotoBot 91
  assert.equal(gibbs.reads[0].points, 0);
  assert.match(gibbs.reads[0].text, /^GB allows running backs 1\.7 touchdowns \(2nd most\) a game$/);
  assert.equal(gibbs.reads[1].text, 'DET are expected to score 28.3 points (1st most this week), a 53.5-point total');
  assert.ok(Math.abs(sum(gibbs) - gibbs.score) <= 0.6);
  assert.equal(band(gibbs.score).label, 'Strong edge');
  // Lower team totals, lower touchdown scores.
  const nacua = matchupScore(row('Puka Nacua', '00-0039075', 'WR', 'LAR', 'LV', 'touchdowns'), league);
  assert.ok(nacua.score < gibbs.score && nacua.score >= 75, String(nacua.score));   // RotoBot 85
});

test('his role counts: a back’s carries, a receiver’s targets', () => {
  const skattebo = matchupScore(row('Cam Skattebo', '00-0040715', 'RB', 'NYG', 'HOU', 'rushing_yards'), league);
  assert.deepEqual(skattebo.reads.map(read => read.key), ['position-rushing_yards', 'script', 'role']);
  assert.equal(skattebo.reads[1].text, 'NYG are 10.5-point underdogs: a team behind runs less');
  assert.equal(skattebo.reads[2].text, 'He gets 50% of NYG’s carries a game');
  assert.ok(skattebo.score <= 30, String(skattebo.score));        // RotoBot 25
  const boutte = matchupScore(row('Kayshon Boutte', '00-0038608', 'WR', 'HOU', 'NYG', 'receiving_yards'), league);
  assert.equal(boutte.reads.at(-1).text, 'He gets 11% of HOU’s targets a game');
  assert.ok(boutte.reads.at(-1).points < 0 && boutte.score <= 45, String(boutte.score));   // RotoBot 41
  // A receiver's rushing line isn't judged on a back's share of the carries.
  const run = matchupScore(row('Puka Nacua', '00-0039075', 'WR', 'LAR', 'LV', 'rushing_yards'), league);
  assert.ok(!run.reads.some(read => read.key === 'role'));
});

test('a big favorite throws less; a quarterback’s passing stat is one read', () => {
  const stroud = matchupScore(row('C.J. Stroud', '00-0039163', 'QB', 'HOU', 'NYG', 'passing_yards'), league);
  assert.deepEqual(stroud.reads.map(read => read.key), ['position-passing_yards', 'script']);
  assert.equal(stroud.reads[1].text, 'HOU are 10.5-point favorites: a team ahead throws less');
  assert.ok(stroud.reads[1].points < 0 && stroud.score < 25, String(stroud.score));
  // Passing TDs: no read predicted them, so they stay close to even.
  const love = matchupScore(row('Jordan Love', '00-0036264', 'QB', 'GB', 'DET', 'passing_touchdowns'), league);
  assert.ok(love.score >= 55 && love.score <= 75, String(love.score));
});

test('a defense with few games counts less', () => {
  const fewer = structuredClone(league);
  fewer.dvp.DET.TE.games = 2;
  const kraft = row('Tucker Kraft', '00-0038996', 'TE', 'GB', 'DET', 'receptions');
  const full = matchupScore(kraft, league), early = matchupScore(kraft, fewer);
  assert.ok(early.score < full.score, `${early.score} vs ${full.score}`);
  // Detroit allow tight ends the most catches: still a strong matchup after six games.
  assert.ok(full.score >= 85, String(full.score));                // RotoBot 82
});

test('without the role and the line it still scores on the defense', () => {
  const bare = {season: league.season, teamCount: league.teamCount, teams: league.teams, dvp: league.dvp, teamStats: league.teamStats};
  const kraft = matchupScore(row('Tucker Kraft', '00-0038996', 'TE', 'GB', 'DET', 'receptions'), bare);
  assert.ok(kraft && kraft.reads.every(read => read.kind === 'position' || read.kind === 'defense'));
  assert.equal(matchupScore(row(...GIBBS, 'touchdowns'), bare).score, 50);
});

test('which weights a market reads', () => {
  assert.deepEqual(familiesOf('rushing_receiving_yards', 'RB'), ['rbRush', 'rbRec']);
  assert.deepEqual(familiesOf('passing_rushing_yards', 'QB'), ['passVolume', 'qbRush']);
  assert.deepEqual(familiesOf('receptions', 'TE'), ['teRec']);
  assert.deepEqual(familiesOf('touchdowns', 'WR'), ['tds']);
  const rr = matchupScore(row(...GIBBS, 'rushing_receiving_yards'), league);
  assert.ok(rr && rr.reads[0].text.includes('rushing + receiving yards'));
  assert.equal(matchupScore(row('X', null, 'K', 'DET', 'GB', 'touchdowns'), league), null);
  assert.equal(matchupScore(row('X', null, 'RB', 'DET', 'ZZZ', 'touchdowns'), league), null);
  assert.equal(matchupScore(row('X', null, 'RB', 'DET', 'GB', 'longest_rush'), league), null);
  assert.equal(matchupScore({...row(...GIBBS, 'touchdowns'), sport: 'nba'}, league), null);
});

test('the list and the page score a prop the same', () => {
  const gibbs = row(...GIBBS, 'touchdowns');
  const listed = spreadScores([gibbs], league).get('Jahmyr Gibbs');
  const card = cardScores(gibbs, league);
  assert.deepEqual(card.map(item => item.stat), ['RUSH YDS', 'CAR', 'REC', 'REC YDS', 'TD']);
  assert.equal(card.find(item => item.stat === 'TD').score, listed.score);
});

test('the slips read the same number for an NFL line', () => {
  const gibbs = {...row(...GIBBS, 'touchdowns'), market: 'Rush + Rec TDs'};
  const listed = spreadScores([gibbs], league).get('Jahmyr Gibbs');
  const over = matchupCase({row: gibbs, side: 'OVER', grade: {}}, {nfl: league});
  assert.equal(over.score, listed.score);
  assert.equal(over.label, listed.label);
  assert.equal(over.cuts.risky, 40);
  assert.ok(over.facts.some(item => item.kind === 'opponent' && /expected to score/.test(item.text)));
  // A line the Props tab doesn't grade (a kicker's) keeps the old read.
  const kicker = matchupCase({row: {...row('K', null, 'K', 'DET', 'GB', 'kicking_points')}, side: 'OVER', grade: {}}, {nfl: league});
  assert.ok(!kicker || kicker.cuts.risky === 45);
});
