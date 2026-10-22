// The NFL matchup score (src/nfl-matchup-score.js), held to RotoBot's
// week-7 2026 grades, on that week's defenses (tests/fixtures: nflverse's
// 2026 weekly stats, weeks 1-6, added up the way the server does).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {matchupScore, spreadScores, cardScores, band} from '../src/nfl-matchup-score.js';
import {matchupCase} from '../src/slip-matchup.js';

const league = JSON.parse(readFileSync(new URL('./fixtures/nfl-2026-week7-league.json', import.meta.url)));
const row = (player, position, opponent, marketKey) => ({id: player, sport: 'nfl', player, position, opponent, marketKey, line: 1.5});
// [player, position, opponent, market, RotoBot]
const ROTOBOT = [['Jahmyr Gibbs', 'RB', 'GB', 'touchdowns', 91], ['Matthew Golden', 'WR', 'DET', 'receiving_yards', 84],
  ['Tucker Kraft', 'TE', 'DET', 'receptions', 82], ['Jordan Love', 'QB', 'DET', 'passing_touchdowns', 82],
  ['Matthew Stafford', 'QB', 'LV', 'passing_touchdowns', 79], ['Puka Nacua', 'WR', 'LV', 'touchdowns', 85],
  ['Rico Dowdle', 'RB', 'NO', 'receptions', 65], ['Kayshon Boutte', 'WR', 'NYG', 'receiving_yards', 41],
  ['Tank Dell', 'WR', 'NYG', 'receiving_yards', 40], ['Cam Skattebo', 'RB', 'HOU', 'rushing_yards', 25]];

test('close to RotoBot where its grade is the defense', () => {
  const gaps = ROTOBOT.map(([player, position, opponent, market, theirs]) => {
    const ours = matchupScore(row(player, position, opponent, market), league).score;
    return [player, ours, theirs, Math.abs(ours - theirs)];
  });
  const average = gaps.reduce((sum, [, , , gap]) => sum + gap, 0) / gaps.length;
  assert.ok(average <= 11, JSON.stringify(gaps));
  // The strong ones read strong, the tough ones tough.
  for (const [player, ours, theirs] of gaps) {
    if (theirs >= 80) assert.ok(ours >= 70, `${player} ${ours}`);
    if (theirs <= 45) assert.ok(ours <= 45, `${player} ${ours}`);
  }
});

test('the reasons: his position first, in words', () => {
  const gibbs = matchupScore(row('Jahmyr Gibbs', 'RB', 'GB', 'touchdowns'), league);
  assert.equal(gibbs.reads[0].kind, 'position');
  assert.match(gibbs.reads[0].text, /^GB allows running backs 1\.7 touchdowns \(2nd most\) a game$/);
  assert.match(gibbs.reads[1].text, /^GB allows .* touchdowns a game to every offense \(\d+(st|nd|rd|th) (most|fewest)\)$/);
  // The parts add up to the score from an even 50.
  assert.ok(Math.abs(50 + gibbs.reads.reduce((sum, read) => sum + read.points, 0) - gibbs.score) <= 0.6);
  assert.equal(band(gibbs.score).label, 'Strong edge');
});

test('a combo reads its parts; no position, opponent or market, no score', () => {
  const rr = matchupScore(row('Jahmyr Gibbs', 'RB', 'GB', 'rushing_receiving_yards'), league);
  assert.ok(rr && rr.reads[0].text.includes('rushing + receiving yards'));
  const qb = matchupScore(row('Jordan Love', 'QB', 'DET', 'passing_rushing_yards'), league);
  assert.match(qb.reads[0].text, /passing yards .* and .* rushing yards/);
  assert.equal(matchupScore(row('X', 'K', 'GB', 'touchdowns'), league), null);
  assert.equal(matchupScore(row('X', 'RB', 'ZZZ', 'touchdowns'), league), null);
  assert.equal(matchupScore(row('X', 'RB', 'GB', 'longest_rush'), league), null);
  assert.equal(matchupScore({...row('X', 'RB', 'GB', 'touchdowns'), sport: 'nba'}, league), null);
});

test('the list and the page score a prop the same', () => {
  const gibbs = row('Jahmyr Gibbs', 'RB', 'GB', 'touchdowns');
  const listed = spreadScores([gibbs], league).get('Jahmyr Gibbs');
  const card = cardScores(gibbs, league);
  assert.deepEqual(card.map(item => item.stat), ['RUSH YDS', 'CAR', 'REC', 'REC YDS', 'TD']);
  assert.equal(card.find(item => item.stat === 'TD').score, listed.score);
});

test('the slips read the same number for an NFL line', () => {
  const gibbs = {...row('Jahmyr Gibbs', 'RB', 'GB', 'touchdowns'), teamAbbr: 'DET', market: 'Rush + Rec TDs'};
  const listed = spreadScores([gibbs], league).get('Jahmyr Gibbs');
  const over = matchupCase({row: gibbs, side: 'OVER', grade: {}}, {nfl: league});
  assert.equal(over.score, listed.score);
  assert.equal(over.label, listed.label);
  assert.equal(over.cuts.risky, 40);
  assert.ok(over.facts.some(item => item.kind === 'opponent' && /allows running backs/.test(item.text)));
  // A line the Props tab doesn't grade (a kicker's) keeps the old read.
  const kicker = matchupCase({row: {...row('K', 'K', 'GB', 'kicking_points'), teamAbbr: 'DET'}, side: 'OVER', grade: {}}, {nfl: league});
  assert.ok(!kicker || kicker.cuts.risky === 45);
});
