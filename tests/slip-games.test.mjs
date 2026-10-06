import test from 'node:test';
import assert from 'node:assert/strict';
import {gameRequests, loadGames, loadTeammates, newsOf, newsFacts, newsCap, statusLevel, liveRead, clockText, anyLive, withGame, samePerson}
  from '../src/slip-games.js';
import {judge} from '../src/slip-check.js';

const nflRow = (player, market, marketKey, line, extra = {}) => ({sport: 'nfl', player, playerId: `00-${player.length}`, teamAbbr: 'IND', opponent: 'LV',
  startsAt: '2026-10-04T17:00:00Z', market, marketKey, line, gameLog: [], ...extra});
const game = (extra = {}) => ({sport: 'nfl', state: 'in', detail: '8:42 - 3rd', period: 3, clock: '8:42', team: 'IND', opponent: 'LV',
  injuries: {IND: [], LV: []}, player: null, ...extra});
const response = body => ({ok: true, json: async () => body});

test('one request per game, with the players asked about', () => {
  const legs = [
    {key: 'a', row: nflRow('Josh Downs', 'Receiving Yards', 'receiving_yards', 71.5)},
    {key: 'b', row: nflRow('Michael Pittman', 'Receptions', 'receptions', 5.5)},
    {key: 'c', row: {sport: 'nhl', player: 'Auston Matthews', playerId: 8479318, teamAbbr: 'TOR', opponent: 'MTL', gameId: '2026020001', valueKey: 'sog'}},
    {key: 'd', row: null},
  ];
  const asked = gameRequests(legs);
  assert.equal(asked.length, 2);
  assert.deepEqual(asked[0].players.map(person => [person.key, person.id]), [['a', ''], ['b', '']]);  // nflverse ids mean nothing to ESPN
  assert.equal(asked[1].gameId, '2026020001');
  assert.equal(asked[1].players[0].id, 8479318);
});

test('each pick gets its game, its own line as game.player', async () => {
  let body;
  const fetcher = async (url, options) => { body = JSON.parse(options.body); return response({games: [
    {found: true, state: 'in', team: 'IND', injuries: {}, players: {a: {name: 'Josh Downs', line: {receiving_yards: 42}}, b: null}}]}); };
  const legs = [{key: 'a', row: nflRow('Josh Downs', 'Receiving Yards', 'receiving_yards', 71.5)},
    {key: 'b', row: nflRow('Michael Pittman', 'Receptions', 'receptions', 5.5)}];
  const games = await loadGames(legs, {fetcher});
  assert.equal(body.games.length, 1);
  assert.equal(body.games[0].key, undefined);
  assert.equal(games.a.player.line.receiving_yards, 42);
  assert.equal(games.b.player, null);
  assert.equal(games.a.state, 'in');
});

test('report statuses and names', () => {
  assert.equal(statusLevel('Out'), 'out');
  assert.equal(statusLevel('Injured Reserve'), 'out');
  assert.equal(statusLevel('10-Day IL'), 'out');
  assert.equal(statusLevel('Doubtful'), 'doubtful');
  assert.equal(statusLevel('Day-To-Day'), 'questionable');
  assert.equal(statusLevel('Questionable'), 'questionable');
  assert.equal(statusLevel('Active'), null);
  assert.ok(samePerson('Kenneth Walker III', 'Kenneth Walker'));
  assert.ok(samePerson('A. Barkov', 'Aleksander Barkov'));
  assert.ok(!samePerson('Josh Allen', 'Josh Downs'));
});

test('a questionable player is flagged and kept out of Elite; out is a Fade', () => {
  const row = withGame(nflRow('Josh Downs', 'Receiving Yards', 'receiving_yards', 59.5),
    game({state: 'pre', injuries: {IND: [{name: 'Josh Downs', status: 'Questionable', position: 'WR'}]}}));
  const facts = newsFacts(row, 'OVER');
  assert.equal(facts[0].text, 'Downs is listed Questionable. Check before the game');
  assert.equal(facts[0].tone, 'warn');
  assert.equal(newsCap(facts), 'strong');
  const out = withGame(row, game({state: 'pre', injuries: {IND: [{name: 'Josh Downs', status: 'Out', position: 'WR'}]}}));
  assert.equal(newsCap(newsFacts(out, 'OVER')), 'fade');
  // The grade itself is capped.
  const read = {row, side: 'OVER', chance: 0.8, modifier: 'standard', records: {}};
  const judged = judge(read);
  assert.notEqual(judged.tier, 'elite');
  assert.equal(judge({...read, row: out}).tier, 'fade');
  assert.equal(judge({...read, row: out}).matchup.facts[0].kind, 'news');
});

test('a teammate out, with what it has meant for him', async () => {
  const row = withGame(nflRow('Josh Downs', 'Receiving Yards', 'receiving_yards', 59.5, {position: 'WR'}),
    game({state: 'pre', injuries: {IND: [{name: 'Michael Pittman Jr.', status: 'Out', position: 'WR'}, {name: 'Someone Else', status: 'Questionable', position: 'TE'}]}}));
  assert.deepEqual(newsOf(row).out.map(person => person.name), ['Michael Pittman Jr.']);
  let asked;
  const fetcher = async url => { asked = url; return response({withWithout: [{name: 'Michael Pittman', with: {games: 9, avg: 48.2}, without: {games: 3, avg: 71.3}}]}); };
  const mates = await loadTeammates([{key: 'a', row}], {fetcher});
  assert.match(asked, /resource=finder-player/);
  assert.match(asked, /market=receiving_yards/);
  const facts = newsFacts(withGame(row, {...row.game, teammates: mates.a}), 'OVER');
  const boost = facts.find(item => item.key.startsWith('mate:'));
  assert.equal(boost.text, 'Pittman (WR) is out: Downs averages 71.3 receiving yards without Pittman (3 games), above the 59.5 line, and 48.2 with Pittman playing');
  assert.equal(boost.tone, 'up');
  assert.equal(newsCap(facts), null);
  // The same split counts against his under, and, landing over the line, keeps the under out of Elite.
  const under = newsFacts(withGame(row, {...row.game, teammates: mates.a}), 'UNDER');
  assert.ok(under.find(item => item.key.startsWith('mate:')).impact < 0);
  assert.equal(newsCap(under), 'strong');
  // A split that grows his numbers but still leaves him under the line doesn't.
  const short = newsFacts(withGame({...row, line: 80.5}, {...row.game, teammates: mates.a}), 'UNDER');
  assert.equal(newsCap(short), null);
  // No split to show: just who is out.
  assert.equal(newsFacts(row, 'OVER').find(item => item.key.startsWith('mate:')).text, 'Teammate Pittman (WR) is out');
});

test('a backup who starts today: his recent games say little, and the under on them is Risky at best', () => {
  // A backup quarterback's last games (14.8 attempts) against a starter's line, with the starter out.
  const daniels = withGame(nflRow('Jalon Daniels', 'Pass Attempts', 'passing_attempts', 28.5,
    {position: 'QB', teamAbbr: 'TB', opponent: 'DAL', windows: {l10: {average: 14.8, hits: 0, misses: 5, decisions: 5, sample: 5, hitRate: 0}}}),
  game({state: 'pre', team: 'TB', opponent: 'DAL', injuries: {TB: [{name: 'Baker Mayfield', status: 'Out', position: 'QB'},
    {name: 'Luke Schrauth', status: 'Out', position: 'G'}, {name: 'Devin Culp Kieft', status: 'Out', position: 'TE'}], DAL: []}}));
  const facts = newsFacts(daniels, 'UNDER');
  assert.equal(facts[0].text, 'Mayfield (QB) is out, so Daniels likely starts. Daniels\'s recent games came in a smaller role (14.8 a game against a 28.5 line) '
    + 'and say little about today; the 28.5 line is already set for him starting');
  assert.equal(facts[0].tone, 'down');
  // A guard, and a tight end with nothing to show, say nothing about his attempts.
  assert.ok(!facts.some(item => /Schrauth|Kieft/.test(item.text)));
  assert.equal(newsCap(facts), 'risky');
  // Graded: no longer Elite on the strength of backup games.
  const judged = judge({row: daniels, side: 'UNDER', chance: 0.8, modifier: 'standard', records: {l10: {won: 5, games: 5, rate: 1}}});
  assert.equal(judged.tier, 'risky');
  // His 5-for-5 under came as a backup: said so, and not counted for the under.
  const form = judged.matchup.facts.find(item => item.kind === 'form');
  assert.equal(form.text, '5 of his last 5 under, averaging 14.8 against the 28.5 line (in a smaller role)');
  assert.deepEqual([form.tone, form.impact], ['flat', 0]);
  assert.ok(judged.chance < 0.62, String(judged.chance));
  // A starter at his usual workload is not a role change.
  const starter = withGame({...daniels, windows: {l10: {average: 31}}}, daniels.game);
  assert.ok(!newsFacts(starter, 'UNDER').some(item => item.key === 'role'));
  // Nor is a cold stretch from a player who has been at this line over the season.
  const slump = withGame({...daniels, windows: {l10: {average: 14.8}, season: {average: 27.1}}}, daniels.game);
  assert.ok(!newsFacts(slump, 'UNDER').some(item => item.key === 'role'));
  // Hockey skaters share the ice: one center out doesn't make another a bigger role.
  const center = {sport: 'nhl', player: 'Mika Zibanejad', position: 'C', market: 'Shots On Goal', valueKey: 'shots', line: 2.5, teamAbbr: 'NYR',
    windows: {l10: {average: 1.6}}, game: {state: 'pre', team: 'NYR', injuries: {NYR: [{name: 'Joe Veleno', status: 'Out', position: 'C'}]}}};
  assert.ok(!newsFacts(center, 'UNDER').some(item => item.key === 'role'));
  assert.equal(newsCap(newsFacts(center, 'UNDER')), null);
});

test('only teammates who bear on the pick: no linemen or defenders for a back\'s catches', () => {
  const bijan = withGame(nflRow('Bijan Robinson', 'Receptions', 'receptions', 2.5, {position: 'RB', teamAbbr: 'ATL', opponent: 'NO', windows: {l10: {average: 4.5}}}),
    game({state: 'pre', team: 'ATL', opponent: 'NO', injuries: {ATL: [{name: 'A.J. Terrell', status: 'Out', position: 'CB'},
      {name: 'Brandon Hand', status: 'Out', position: 'DT'}, {name: 'Drake London', status: 'Injured Reserve', position: 'WR'}], NO: []},
    teammates: [{name: 'A.J. Terrell', with: {games: 9, avg: 4.8}, without: {games: 3, avg: 3.7}}]}));
  assert.deepEqual(newsOf(bijan).out.map(person => person.name), ['Drake London']);
  // London has been out for weeks with no split to show: already in his recent games.
  assert.deepEqual(newsFacts(bijan, 'OVER'), []);
  // A goalie hears about goalies, a skater about skaters; an MLB pick about no one.
  const goalie = {sport: 'nhl', player: 'Joey Daccord', position: 'G', market: 'Goalie Saves', valueKey: 'saves', line: 27.5, teamAbbr: 'SEA',
    windows: {l10: {average: 12}}, game: {state: 'pre', team: 'SEA', injuries: {SEA: [{name: 'Philipp Grubauer', status: 'Out', position: 'G'},
      {name: 'Jared McCann', status: 'Out', position: 'C'}]}}};
  assert.deepEqual(newsOf(goalie).out.map(person => person.name), ['Philipp Grubauer']);
  assert.match(newsFacts(goalie, 'OVER')[0].text, /^Grubauer \(G\) is out, so Daccord likely starts\./);
  const hitter = {sport: 'mlb', player: 'Shohei Ohtani', teamAbbr: 'LAD', marketKey: 'hitting:hrr', market: 'Hits+Runs+RBIs', line: 1.5,
    game: {state: 'pre', team: 'LAD', injuries: {LAD: [{name: 'Max Muncy', status: '10-Day IL', position: '3B'}]}}};
  assert.deepEqual(newsOf(hitter).out, []);
});

test('MLB: the batting spot, a hitter left out, a pitcher who isn\'t starting', () => {
  const hitter = {sport: 'mlb', player: 'Shohei Ohtani', teamAbbr: 'LAD', marketKey: 'hitting:hrr', market: 'Hits+Runs+RBIs', line: 1.5};
  const posted = {LAD: {confirmed: true, order: [{name: 'Shohei Ohtani'}, {name: 'Mookie Betts'}]}};
  const leadoff = newsFacts(withGame(hitter, {state: 'pre', team: 'LAD', lineups: posted, injuries: {}, player: {spot: 1}}), 'OVER');
  assert.equal(leadoff[0].text, 'Batting 1st in the posted lineup');
  assert.equal(leadoff[0].tone, 'up');
  const benched = newsFacts(withGame({...hitter, player: 'Freddie Freeman'}, {state: 'pre', team: 'LAD', lineups: posted, injuries: {}, player: null}), 'OVER');
  assert.equal(benched[0].text, 'Freeman isn\'t in the posted lineup');
  assert.equal(newsCap(benched), 'risky');
  const pitcher = {sport: 'mlb', player: 'Tyler Glasnow', teamAbbr: 'LAD', marketKey: 'pitching:strikeouts', market: 'Pitcher Strikeouts', line: 6.5};
  const facts = newsFacts(withGame(pitcher, {state: 'pre', team: 'LAD', lineups: posted, starters: {LAD: {name: 'Yoshinobu Yamamoto'}}, injuries: {}}), 'OVER');
  assert.equal(facts[0].text, 'Yoshinobu Yamamoto is listed to start, not Glasnow');
  assert.equal(newsCap(facts), 'fade');
});

test('live: how far along each pick is, and where the game is', () => {
  const downs = withGame(nflRow('Josh Downs', 'Receiving Yards', 'receiving_yards', 71.5),
    game({player: {name: 'Josh Downs', line: {receiving_yards: 42}}}));
  const read = liveRead(downs, 'OVER');
  assert.equal(read.text, 'Downs 42 of 71.5 receiving yards');
  assert.equal(read.clock, '3rd quarter, 8:42');
  assert.equal(read.result, null);
  assert.ok(Math.abs(read.progress - 42 / 71.5) < 1e-9);
  // Past the line, an over has hit and an under is busted.
  const past = withGame(downs, {...downs.game, player: {line: {receiving_yards: 80}}});
  assert.equal(liveRead(past, 'OVER').result, 'hit');
  assert.equal(liveRead(past, 'UNDER').result, 'miss');
  // At the final, under the line: the under hits.
  assert.equal(liveRead(withGame(downs, {...downs.game, state: 'post'}), 'UNDER').result, 'hit');
  // Not in the box score yet is zero; at the final it's a DNP.
  assert.equal(liveRead(withGame(downs, {...downs.game, player: null}), 'OVER').value, 0);
  assert.equal(liveRead(withGame(downs, {...downs.game, state: 'post', player: null}), 'OVER').result, 'dnp');
  // Not started: nothing to show.
  assert.equal(liveRead(withGame(downs, {...downs.game, state: 'pre'}), 'OVER'), null);
  // MLB adds its fields the history's way; NHL reads its value key.
  const ohtani = {sport: 'mlb', player: 'Shohei Ohtani', market: 'Hits+Runs+RBIs', marketKey: 'hitting:hrr', raw: {stat: 'Hits+Runs+RBIs'}, line: 1.5,
    game: {sport: 'mlb', state: 'in', detail: 'Top 5th', player: {line: {batting: {hits: 1, runs: 1, rbi: 0}, pitching: {}}}}};
  assert.equal(liveRead(ohtani, 'OVER').value, 2);
  assert.equal(liveRead(ohtani, 'OVER').clock, 'Top 5th');
  const matthews = {sport: 'nhl', player: 'Auston Matthews', market: 'Shots On Goal', valueKey: 'sog', line: 3.5,
    game: {sport: 'nhl', state: 'in', period: 2, clock: '11:05', player: {line: {sog: 3}}}};
  assert.equal(liveRead(matthews, 'OVER').text, 'Matthews 3 of 3.5 shots on goal');
  assert.equal(liveRead(matthews, 'OVER').clock, '2nd period, 11:05');
});

test('clock words', () => {
  assert.equal(clockText({sport: 'nfl', state: 'in', detail: 'Halftime', period: 2, clock: '0:00'}), 'Halftime');
  assert.equal(clockText({sport: 'nba', state: 'in', detail: 'End of 3rd', period: 3, clock: '0:00'}), 'End of 3rd');
  assert.equal(clockText({sport: 'nfl', state: 'in', detail: '2:00 - OT', period: 5, clock: '2:00'}), 'Overtime, 2:00');
  assert.equal(clockText({sport: 'nhl', state: 'in', period: 1, clock: '18:00', intermission: true}), '1st intermission');
  assert.equal(clockText({sport: 'nfl', state: 'post'}), 'Final');
  assert.equal(clockText({sport: 'mlb', state: 'post', off: true, detail: 'Postponed'}), 'Postponed');
});

test('the page keeps checking while a game is on or about to start', () => {
  const now = Date.parse('2026-10-04T16:30:00Z');
  assert.ok(anyLive([{game: {state: 'in'}}], now));
  assert.ok(anyLive([{startsAt: '2026-10-04T17:00:00Z', game: {state: 'pre'}}], now));
  assert.ok(!anyLive([{startsAt: '2026-10-04T23:00:00Z', game: {state: 'pre'}}, {game: {state: 'post'}}], now));
});
