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
  assert.match(read.facts[0].text, /^LAL allows 27\.4 points a game to guards, 14% more than average \(3rd-most\)$/);
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

test('NFL: the scouting notes read against his opponent this week, yards-only notes on yards props', () => {
  const note = (key, text, lean, weight, extra = {}) => ({key, kind: 'opponent', text, lean, weight, yards: false, ...extra});
  const scout = {players: {
    '00-9': {team: 'SEA', opponent: 'DEN', notes: {
      receiving: [{...note('blitz-split', 'Gets 24% of targets when the defense blitzes, 8% when it doesn\'t; DEN blitz on 38% of dropbacks, 7th most', 1, 2), kind: 'split'},
        note('pass-yards-allowed', 'DEN allow 7.9 yards a pass, 3rd most', 1, 1, {yards: true})]}},
    '00-7': {team: 'ATL', opponent: 'CHI', notes: {passing: [note('pressure', 'CHI pressure the quarterback on 32% of dropbacks, 2nd most', -1, 2)]}}}};
  const league = {teamCount: 32, teamStats: {CHI: {off: {sacks: [3.4, 2]}, def: {}}}, scout};
  const te = {sport: 'nfl', player: 'AJ Barner', playerId: '00-9', teamAbbr: 'SEA', opponent: 'DEN', marketKey: 'receptions', market: 'Receptions', line: 2.5, gameLog: []};
  const read = matchupCase({row: te, side: 'OVER', grade: {records: {}}}, {nfl: league});
  const blitz = read.facts.find(item => item.key === 'scout-blitz-split');
  assert.equal(blitz.tone, 'up');
  assert.equal(blitz.impact, 5);
  assert.equal(blitz.kind, 'split');
  assert.ok(!read.facts.some(item => item.key === 'scout-pass-yards-allowed'), 'yards a pass stays off a receptions line');
  assert.ok(matchupCase({row: {...te, marketKey: 'receiving_yards'}, side: 'OVER', grade: {records: {}}}, {nfl: league}).facts.some(item => item.key === 'scout-pass-yards-allowed'));
  // On the under the same note counts the other way.
  assert.equal(matchupCase({row: te, side: 'UNDER', grade: {records: {}}}, {nfl: league}).facts.find(item => item.key === 'scout-blitz-split').impact, -5);
  // Another opponent (a stale week): no notes.
  assert.ok(!matchupCase({row: {...te, opponent: 'KC'}, side: 'OVER', grade: {records: {}}}, {nfl: league}).facts.some(item => item.key.startsWith('scout-')));
  // The pressure rate replaces the sacks line for a quarterback.
  const qb = {sport: 'nfl', player: 'Michael Penix', playerId: '00-7', opponent: 'CHI', marketKey: 'passing_yards', market: 'Pass Yards', line: 235.5, gameLog: []};
  const facts = matchupCase({row: qb, side: 'OVER', grade: {records: {}}}, {nfl: league}).facts;
  assert.equal(facts.find(item => item.key === 'scout-pressure').tone, 'down');
  assert.ok(!facts.some(item => item.key === 'pass-rush'));
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
  assert.equal(asked.filter(url => /finder-scout/.test(url)).length, 1, 'the NFL scouting notes come with it');
  assert.equal(asked.filter(url => /finder-weather/.test(url)).length, 1, 'and the kickoff weather');
  const hitter = withMatchups({sport: 'mlb', playerId: 660271, marketKey: 'hitting:hrr', opponentTeamId: 115}, tables);
  assert.equal(hitter.hitterMatchup.grades.other.score, 70);
});

test('football: wind, rain or snow at kickoff moves passing, kicking and run props', async () => {
  const windy = {available: true, passing: 3, kicking: 3, run: 1, flags: [{key: 'wind', level: 'high', label: 'Wind 22 mph, gusts to 38'}]};
  const weather = {games: {'2026_07_MIA_BUF': windy, '2026_07_SEA_DET': {available: true, covered: true, passing: 0, kicking: 0, run: 0, flags: []}},
    teams: {BUF: '2026_07_MIA_BUF', MIA: '2026_07_MIA_BUF', DET: '2026_07_SEA_DET', SEA: '2026_07_SEA_DET'}};
  const tables = {nfl: {weather}};
  const pick = (row, side = 'OVER') => matchupCase({row: {sport: 'nfl', gameLog: [], ...row}, side, grade: {records: {}}}, tables).facts.find(item => item.key === 'weather');
  const qb = pick({player: 'Josh Allen', teamAbbr: 'BUF', opponent: 'MIA', gameId: '2026_07_MIA_BUF', marketKey: 'passing_yards', market: 'Pass Yards', line: 245.5});
  assert.equal(qb.text, 'Wind 22 mph, gusts to 38 at kickoff: really hurts passing');
  assert.equal(qb.impact, -10.5);
  assert.equal(pick({teamAbbr: 'BUF', marketKey: 'passing_yards'}, 'UNDER').impact, 10.5, 'the same wind helps the under');
  // Found by team when the row has no game id; receptions feel it less.
  assert.equal(pick({teamAbbr: 'MIA', marketKey: 'receptions'}).impact, -6.3);
  assert.equal(pick({teamAbbr: 'BUF', marketKey: 'fg_made'}).text, 'Wind 22 mph, gusts to 38 at kickoff: really hurts kicking');
  const run = pick({teamAbbr: 'BUF', marketKey: 'rush_attempts'});
  assert.equal(run.impact, 5);
  assert.equal(run.text, 'Wind 22 mph, gusts to 38 at kickoff: teams lean on the run');
  // Under a roof, or a prop weather doesn't touch: nothing said.
  assert.equal(pick({teamAbbr: 'DET', marketKey: 'passing_yards'}), undefined);
  assert.equal(pick({teamAbbr: 'BUF', marketKey: 'tackles'}), undefined);
  // College rows carry the NFL's keys as value keys, and their ESPN event id.
  const college = matchupCase({row: {sport: 'cfb', gameLog: [], team: 'ALA', gameId: '401', valueKey: 'receiving_yards', marketKey: 'receiving_yards'}, side: 'OVER',
    grade: {records: {}}}, {cfb: {weather: {games: {401: {...windy, passing: 2, flags: [{key: 'rain', level: 'high', label: 'Heavy rain'}]}}, teams: {}}}});
  assert.equal(college.facts.find(item => item.key === 'weather').text, 'Heavy rain at kickoff: hurts passing');
  // The college slate loads with the league tables.
  const asked = [];
  const fetcher = async url => { asked.push(url); return {ok: true, json: async () => ({games: {}, teams: {}})}; };
  const loaded = await loadMatchups(['cfb'], {fetcher});
  assert.ok(asked.some(url => /view=cfb&resource=weather/.test(url)));
  assert.ok(loaded.cfb.weather);
});

// Soccer: four clubs on the board, what each gives up a match.
const club = (abbr, {saves, shots, sot, possession, fouls, made = {}, players = {}}) => ({abbr, name: abbr, games: 10,
  allowed: {shots, sot, possession}, made: {sot: made.sot ?? 4.5, fouls: fouls ?? 11, possession: made.possession ?? 50}, players,
  toGroup: {GK: {saves, gc: 1.2}, FWD: {shots: shots * 0.5, sot: sot * 0.5}, MID: {passAtt: 40, passes: 34}},
  allowedRank: {shots: 1, sot: 1}});
const soccerLeague = {teamCount: 4, complete: true, teams: {
  1: club('ARS', {saves: 2.1, shots: 9, sot: 3, possession: 44, made: {sot: 6.2, possession: 58}, players: {11: {name: 'Bukayo Saka', apps: 10, starts: 10, min: 84, shotShare: 24, sotShare: 27}}}),
  2: club('LIV', {saves: 4.6, shots: 15, sot: 6, possession: 50, fouls: 14, made: {sot: 3.1}}),
  3: club('CHE', {saves: 3.2, shots: 12, sot: 4.5, possession: 52}),
  4: club('TOT', {saves: 3.4, shots: 12.5, sot: 4.6, possession: 54})},
  baseline: {team: {shots: 12, sot: 4.5, fouls: 11, possession: 50}, toGroup: {GK: {saves: 3.3, gc: 1.2}, FWD: {shots: 6, sot: 2.25}, MID: {passAtt: 40, passes: 34}}}};

test('soccer: a keeper\'s saves follow the shots the other side puts on target', () => {
  const row = withMatchups({sport: 'soccer', player: 'David Raya', position: 'GK', teamId: '2', opponentId: '1', teamAbbr: 'LIV', opponent: 'ARS',
    marketKey: 'goaliesaves', market: 'Goalie Saves', line: 2.5, winChance: 30, gameLog: []}, {soccer: soccerLeague});
  assert.equal(row.defensePosition, 'GK');
  assert.equal(row.defenseValue, 2.1);
  assert.equal(row.defense, 1);
  assert.ok(Math.abs(row.allowTable.LIV - 4.6 / 3.3) < 1e-9);
  const read = matchupCase({row, side: 'OVER', grade: {records: {}}}, {soccer: soccerLeague});
  assert.equal(read.facts[0].text, 'Keepers make 2.1 saves a match against ARS, 36% fewer than average');
  assert.ok(read.facts.some(item => item.text === 'ARS puts 6.2 shots on target a match (average 4.5)'));
  assert.ok(read.facts.some(item => item.key === 'script' && /big underdog/.test(item.text)));
});

test('soccer: a forward\'s shots, his starts, minutes and share of the team\'s shots', () => {
  const row = withMatchups({sport: 'soccer', player: 'B. Saka', position: 'F', teamId: '1', opponentId: '2', teamAbbr: 'ARS', opponent: 'LIV',
    marketKey: 'shots', market: 'Shots', line: 2.5, winChance: 62, gameLog: []}, {soccer: soccerLeague});
  assert.equal(row.defensePosition, 'FWD');
  const read = matchupCase({row, side: 'OVER', grade: {records: {}}}, {soccer: soccerLeague});
  assert.match(read.facts[0].text, /^LIV allows 7\.5 shots a match to forwards, 25% more than average/);
  assert.ok(read.facts.some(item => item.text === 'LIV gives up 15 shots a match (average 12)'));
  assert.ok(read.facts.some(item => item.text === "Started 10 of his team's last 10 matches, 84 minutes a match"));
  assert.ok(read.facts.some(item => item.text === "Takes 24% of ARS's shots"));
  assert.ok(read.score > 60);
});

test('soccer: a midfielder\'s passes follow his side\'s share of the ball', () => {
  const row = withMatchups({sport: 'soccer', player: 'Declan Rice', position: 'DM', teamId: '1', opponentId: '3', teamAbbr: 'ARS', opponent: 'CHE',
    marketKey: 'passesattempted', market: 'Passes Attempted', line: 55.5, gameLog: []}, {soccer: soccerLeague});
  assert.equal(row.soccerGroup, 'MID');
  const read = matchupCase({row, side: 'OVER', grade: {records: {}}}, {soccer: soccerLeague});
  assert.ok(read.facts.some(item => item.text === 'ARS should have about 55% of the ball' && item.impact > 0));
});

test('NHL: every skater stat gets the defense table, shots allowed, penalties and ice time lately', () => {
  const cell = (value, rank, recent) => ({l20: [value, rank], l5: [recent ?? value, rank]});
  const dvp = {EDM: {C: {attempts: cell(9.6, 32, 10.4), ppp: cell(0.5, 30), plus_minus: null}}, TOR: {C: {attempts: cell(7.2, 10)}},
    BOS: {C: {attempts: cell(6.8, 3)}}, NYR: {C: {attempts: cell(7.0, 5)}}, VAN: {C: {attempts: cell(7.6, 15)}}, DAL: {C: {attempts: cell(7.4, 12)}}};
  const teams = {EDM: {def: {attempts: {l20: [64, 31]}}, off: {pim: {l20: [11.5, 2]}, goals: {l20: [3.6, 1]}}},
    TOR: {def: {attempts: {l20: [55, 10]}}, off: {pim: {l20: [7, 20]}, goals: {l20: [3, 8]}}},
    BOS: {def: {attempts: {l20: [52, 3]}}, off: {pim: {l20: [8, 15]}, goals: {l20: [2.6, 20]}}}};
  const league = {dvp, teams, teamCount: 32};
  const toi = [17, 17.5, 16.8, 17.2, 17, 16.9, 17.1, 17.3, 17, 16.8, 20.5, 21, 20.8];
  const row = withMatchups({sport: 'nhl', player: 'Auston Matthews', position: 'C', opponent: 'EDM', valueKey: 'attempts', market: 'Shot Attempts', line: 6.5,
    gameLog: toi.map((usage, index) => ({value: 6, usage, date: `2026-10-${String(index + 1).padStart(2, '0')}`, opponent: 'X'}))}, {nhl: league});
  assert.equal(row.defenseValue, 9.6);
  assert.equal(row.defenseRecent, 10.4);
  assert.equal(row.defensePosition, 'C');
  assert.ok(row.allowTable.EDM > 1.2 && row.allowTable.BOS < 1);
  const read = matchupCase({row, side: 'OVER', grade: {records: {}}}, {nhl: league});
  assert.equal(read.facts[0].text, 'EDM allows 9.60 shot attempts a game to centers, 26% more than average (1st-most)');
  assert.ok(read.facts.some(item => item.text === 'EDM gives up 64 shot attempts a game (2nd-most)'));
  assert.ok(read.facts.some(item => item.key === 'role-trend' && /^More ice time lately: 20\.8 min a game over his last 3 \(17\.1 before\)$/.test(item.text)));
  const pp = matchupCase({row: {...row, valueKey: 'ppp', market: 'Power Play Points', defenseValue: null}, side: 'OVER', grade: {records: {}}}, {nhl: league});
  assert.ok(pp.facts.some(item => item.text === 'EDM takes 11.5 penalty minutes a game (2nd-most)'));
  const plus = matchupCase({row: {...row, valueKey: 'plus_minus', market: 'Plus/Minus', defenseValue: null}, side: 'OVER', grade: {records: {}}}, {nhl: league});
  assert.ok(plus.facts.some(item => item.text === 'EDM scores 3.6 goals a game (1st-most)' && item.impact < 0));
});

test('NFL: props the position table leaves out are read off what the defense allows as a team', () => {
  const teamStats = {DAL: {def: {rush_rec_tds: [2.4, 30]}}, NYG: {def: {rush_rec_tds: [1.4, 5]}}, PHI: {def: {rush_rec_tds: [1.6, 12]}}};
  const row = {sport: 'nfl', player: 'Saquon Barkley', position: 'RB', opponent: 'DAL', teamAbbr: 'PHI', marketKey: 'touchdowns', market: 'Touchdowns', line: 0.5, gameLog: []};
  const read = matchupCase({row, side: 'OVER', grade: {records: {}}}, {nfl: {dvp: {}, teamStats, teamCount: 32}});
  assert.equal(read.facts[0].text, 'DAL allows 2.4 rushing + receiving TDs a game, 33% more than average (3rd-most)');
  assert.ok(read.score > 55);
});
