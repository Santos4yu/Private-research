import test from 'node:test';
import assert from 'node:assert/strict';
import {matchupCase, loadMatchups, withMatchups} from '../src/slip-matchup.js';

const w = (hits, games) => ({hits, misses: games - hits, pushes: 0, decisions: games, sample: games, hitRate: hits / games * 100});
const record = (won, games) => ({won, games, rate: won / games});
// Away games high, home games low: the road split.
const log = (away, home) => Array.from({length: 12}, (_, index) => ({value: index % 2 ? away : home, home: index % 2 === 0, date: `2026-09-${10 + index}`, opponent: 'X'}));

test('an MLB hitter: the starter, his career against him, the pitch mix, his split and the road', () => {
  const row = {sport: 'mlb', player: 'Shohei Ohtani', marketKey: 'hitting:hrr', market: 'Hits+Runs+RBIs', line: 1.5, isHome: false, opponent: 'COL',
    gameLog: log(2.6, 1.2), windows: {l10: {...w(7, 10), average: 2.1}},
    matchup: {kind: 'pitcher', pitcher: {name: 'Joe Ross', hand: 'R', era: 7.02, whip: 1.68, hr9: 1.9, lastStarts: [{ip: 6, h: 4, er: 1}, {ip: 4 + 2 / 3, h: 9, er: 6}]}},
    hitterMatchup: {pitcher: {name: 'Joe Ross', hand: 'R'}, pitches: [{name: '4-Seam', pct: 38}, {name: 'Slider', pct: 22}],
      bvp: {ab: 12, hits: 7, hr: 2, avg: '.583', ops: '1.700'},
      grades: {other: {score: 78, arsenal: {impact: 6, detail: '.312 weighted wOBA across 60% of the starter\'s mix'}}},
      factors: [{key: 'handedness', impact: 4, available: true, detail: 'vs RHP .310 AVG / .920 OPS (210 PA) · vs LHP .250 AVG'},
        {key: 'pitcher_quality', impact: 8, available: true, detail: 'Joe Ross · 7.02 ERA'},
        {key: 'bvp', impact: 5, available: true, detail: '7-for-12'}, {key: 'park', impact: 4, available: true, detail: 'Coors'}]}};
  const over = matchupCase({row, side: 'OVER', grade: {records: {l10: record(7, 10)}}});
  const text = over.facts.map(item => item.text);
  assert.equal(text[0], 'Faces Joe Ross (RHP): 7.02 ERA, 1.68 WHIP, 1.9 HR/9; last start 4.2 IP, 9 H, 6 ER');
  assert.ok(text.includes('Hits his pitch mix: .312 wOBA across 60% of it (4-Seam 38%, Slider 22%)'));
  assert.ok(text.includes('Career vs Ross: 7-for-12 (.583), 2 HR, 1.700 OPS'));
  assert.ok(text.includes('vs RHP: .310 AVG / .920 OPS'));
  assert.ok(text.includes('Averages 2.6 Hits+Runs+RBIs on the road vs 1.2 at home (on the road today)'));
  assert.ok(text.includes('A hitter-friendly park'));
  assert.ok(over.primary);
  assert.ok(over.score >= 80, String(over.score));
  assert.equal(over.label, 'Excellent matchup');
  // The same matchup for the under is a bad one.
  const under = matchupCase({row, side: 'UNDER', grade: {records: {l10: record(3, 10)}}});
  assert.ok(under.score < 30, String(under.score));
  assert.equal(under.facts.find(item => item.key === 'starter').tone, 'down');
});

test('an MLB pitcher: the lineup against his hand, his last starts, how deep he goes', () => {
  const row = {sport: 'mlb', player: 'Tarik Skubal', marketKey: 'pitching:strikeouts', market: 'Pitcher Strikeouts', line: 7.5, opponent: 'MIN',
    gameLog: [], matchup: {kind: 'lineup', league: {kRate: 0.22, vs: {L: {kRate: 0.22}}, teams: 30},
      lineup: {kRate: 0.26, games: 150, vs: {L: {kRate: 0.29, kRateRank: 2}}},
      self: {hand: 'L', projectedIp: 6.2, recentPitches: 98, lastStarts: [{k: 8}, {k: 6}, {k: 9}], vsOpponent: {starts: 1, ip: 7, k: 10, er: 1}}}};
  const read = matchupCase({row, side: 'OVER', grade: {records: {}}});
  assert.equal(read.facts[0].key, 'lineup');
  assert.match(read.facts[0].text, /MIN strikes out 29% of the time vs lefties \(2nd-most\)/);
  assert.ok(read.facts[0].impact > 5);
  assert.ok(read.facts.some(item => item.text === 'Last 3 starts: 8, 6, 9 strikeouts'));
  assert.ok(read.facts.some(item => item.text === 'Goes about 6.2 innings a start (98 pitches lately)'));
  assert.ok(read.facts.some(item => /Against MIN this season: 1 start, 7 IP, 10 K, 1 ER/.test(item.text)));
  assert.ok(read.score > 60);
});

test('NBA: the defense against his position and the pace of the game', () => {
  const stats = team => ({off: {pts: [team.for, 1]}, def: {pts: [team.against, 1]}});
  const league = {teamStats: {LAL: stats({for: 122, against: 120}), GS: stats({for: 121, against: 119}), BOS: stats({for: 108, against: 106}),
    NY: stats({for: 110, against: 108}), MIA: stats({for: 109, against: 107})}};
  const row = {sport: 'nba', player: 'Stephen Curry', teamAbbr: 'GS', opponent: 'LAL', marketKey: 'player_points', market: 'Points', line: 26.5,
    position: 'G', defense: 28, defenseTeams: 30, defenseValue: 27.4, defenseAverage: 24, defensePosition: 'G', gameLog: []};
  const read = matchupCase({row, side: 'OVER', grade: {records: {}}}, {nba: league});
  assert.match(read.facts[0].text, /^LAL allows 27\.4 points to guards, 14% more than average \(3rd-most\)$/);
  assert.match(read.facts.find(item => item.key === 'pace').text, /fast, high-scoring matchup/);
  assert.ok(read.score > 60);
});

test('NFL: a quarterback against a pass rush, a receiver with the target share', () => {
  const team = (sacks, completion) => ({off: {sacks: [sacks, 1]}, def: {completion_pct: [completion, 30]}});
  const league = {teamCount: 32, teamStats: {PIT: team(3.6, 61), CLE: team(2, 66), BAL: team(2.2, 64), CIN: team(2.1, 65), KC: team(2, 64), BUF: team(2.4, 63)},
    share: {IND: {targets: [{id: '00-1', share: 26}, {id: '00-2', share: 18}]}}};
  const qb = {sport: 'nfl', player: 'Joe Burrow', opponent: 'PIT', marketKey: 'passing_yards', market: 'Pass Yards', line: 245.5, gameLog: []};
  const pass = matchupCase({row: qb, side: 'OVER', grade: {records: {}}}, {nfl: league});
  const rush = pass.facts.find(item => item.key === 'pass-rush');
  assert.match(rush.text, /PIT's pass rush gets 3\.6 sacks a game/);
  assert.equal(rush.tone, 'down');
  // One sack a game reads as one.
  const quiet = {...league, teamStats: {...league.teamStats, NYG: team(1, 64)}};
  assert.match(matchupCase({row: {...qb, opponent: 'NYG'}, side: 'OVER', grade: {records: {}}}, {nfl: quiet}).facts.find(item => item.key === 'pass-rush').text,
    /NYG's pass rush gets 1 sack a game/);
  const wr = {sport: 'nfl', player: 'Josh Downs', playerId: '00-1', teamAbbr: 'IND', opponent: 'LV', marketKey: 'receiving_yards', market: 'Receiving Yards', line: 59.5, gameLog: []};
  const share = matchupCase({row: wr, side: 'OVER', grade: {records: {}}}, {nfl: league}).facts.find(item => item.key === 'share');
  assert.equal(share.text, "Gets 26% of IND's targets (most on the team)");
});

test('NHL: what the defense allows his position; a goalie the shots he will face', () => {
  const cell = (value, rank) => ({l20: [value, rank]});
  const dvp = {EDM: {C: {sog: cell(3.4, 30)}, G: {saves: cell(31, 30)}}, TOR: {C: {sog: cell(2.6, 10)}}, BOS: {C: {sog: cell(2.4, 3)}},
    NYR: {C: {sog: cell(2.5, 5)}}, VAN: {C: {sog: cell(2.7, 15)}}, DAL: {C: {sog: cell(2.6, 12)}}};
  const teams = {EDM: {off: {sog: {l20: [34, 2]}}}, TOR: {off: {sog: {l20: [29, 20]}}}, BOS: {off: {sog: {l20: [28, 25]}}}};
  const row = {sport: 'nhl', player: 'Auston Matthews', position: 'C', opponent: 'EDM', valueKey: 'sog', market: 'Shots On Goal', line: 3.5, gameLog: []};
  const read = matchupCase({row, side: 'OVER', grade: {records: {}}}, {nhl: {dvp, teams, teamCount: 32}});
  assert.equal(read.facts[0].text, 'EDM allows 3.40 shots on goal a game to centers, 26% more than average (3rd-most)');
  assert.ok(read.score > 60);
  const goalie = matchupCase({row: {...row, position: 'G', valueKey: 'saves', market: 'Goalie Saves', line: 27.5}, side: 'OVER', grade: {records: {}}},
    {nhl: {dvp, teams, teamCount: 32}});
  assert.ok(goalie.facts.some(item => item.text === 'EDM takes 34 shots a game (2nd-most)'));
});

test('a line gets its league\'s tables, loaded once for the sports on the slip', async () => {
  const asked = [];
  const fetcher = async url => { asked.push(url); return {ok: true, json: async () => (/mlb-context/.test(url) ? {probables: {}, hitting: {}, pitching: {}, league: {}}
    : /mlb-matchups/.test(url) ? {players: {660271: {grades: {other: {score: 70}}}}} : {dvp: {}, teamStats: {}})}; };
  const tables = await loadMatchups(['mlb', 'nfl', 'nfl'], {fetcher});
  assert.deepEqual(Object.keys(tables).sort(), ['mlb', 'nfl']);
  assert.equal(asked.filter(url => /finder-league/.test(url)).length, 1);
  const hitter = withMatchups({sport: 'mlb', playerId: 660271, marketKey: 'hitting:hrr', opponentTeamId: 115}, tables);
  assert.equal(hitter.hitterMatchup.grades.other.score, 70);
});
