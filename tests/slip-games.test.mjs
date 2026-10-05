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
  const row = withGame(nflRow('Josh Downs', 'Receiving Yards', 'receiving_yards', 59.5),
    game({state: 'pre', injuries: {IND: [{name: 'Michael Pittman Jr.', status: 'Out', position: 'WR'}, {name: 'Someone Else', status: 'Questionable', position: 'TE'}]}}));
  assert.deepEqual(newsOf(row).out.map(person => person.name), ['Michael Pittman Jr.']);
  let asked;
  const fetcher = async url => { asked = url; return response({withWithout: [{name: 'Michael Pittman', with: {games: 9, avg: 48.2}, without: {games: 3, avg: 71.3}}]}); };
  const mates = await loadTeammates([{key: 'a', row}], {fetcher});
  assert.match(asked, /resource=finder-player/);
  assert.match(asked, /market=receiving_yards/);
  const facts = newsFacts(withGame(row, {...row.game, teammates: mates.a}), 'OVER');
  const boost = facts.find(item => item.key.startsWith('mate:'));
  assert.equal(boost.text, 'Pittman (WR) is out: Downs averages 71.3 receiving yards without Pittman (3 games) and 48.2 with Pittman playing');
  assert.equal(boost.tone, 'up');
  // The same split counts against his under.
  assert.ok(newsFacts(withGame(row, {...row.game, teammates: mates.a}), 'UNDER').find(item => item.key.startsWith('mate:')).impact < 0);
  // No split to show: just who is out.
  assert.equal(newsFacts(row, 'OVER').find(item => item.key.startsWith('mate:')).text, 'Teammate Pittman (WR) is out');
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
