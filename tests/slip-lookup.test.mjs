import test from 'node:test';
import assert from 'node:assert/strict';
import {lookupRow} from '../src/slip-lookup.js';

const PAST = '2026-10-04T17:00:00+00:00';
const answer = body => async () => ({ok: true, json: async () => body});
const w = (hits, games) => ({hits, misses: games - hits, pushes: 0, decisions: games, sample: games, hitRate: hits / games * 100, average: 70});

test('an NFL player whose game has started comes back as a gradeable line', async () => {
  const asked = [];
  const fetcher = async url => { asked.push(url); return answer({rows: [{id: 'slip:00-1:receiving_yards:71.5', playerId: '00-1', playerName: 'Josh Downs',
    position: 'WR', headshot: 'downs.png', propType: 'receiving_yards', propLabel: 'Receiving Yards', teamId: 'IND', opponentId: 'LV',
    gameId: 'g1', startsAt: PAST, line: {verified: true, bookmaker: null, category: 'STANDARD', value: 71.5, direction: 'OVER'}, apps: [],
    windows: {l5: w(3, 5), l10: w(6, 10)}, gameLog: [{value: 80, date: '2026-09-07'}]}], events: [{gameId: 'g1', awayTeamId: 'IND', homeTeamId: 'LV', startsAt: PAST}]})(); };
  const row = await lookupRow({player: 'Josh Downs', sport: 'nfl', stat: 'Rec Yards', line: 71.5, side: 'OVER'}, {sports: ['nfl'], fetcher});
  assert.match(asked[0], /resource=finder-find/);
  assert.match(asked[0], /name=Josh\+Downs/);
  assert.equal(row.sport, 'nfl');
  assert.equal(row.startsAt, PAST);
  assert.equal(row.line, 71.5);
  assert.equal(row.windows.l10.hits, 6);
  assert.equal(row.headshot, 'downs.png');
  assert.equal(row.teamAbbr, 'IND');
});

test('NBA picks map the slip\'s stat to the game-log field and load his history', async () => {
  const fetcher = answer({rows: [{playerId: '3975', name: 'Stephen Curry', teamAbbr: 'GS', teamLogo: 'gs.png', headshot: 'c.png'}]});
  let enriched = null;
  const enrich = () => async rows => { enriched = rows[0]; return [{...rows[0], historyStatus: 'ready', gameLog: [{value: 30}]}]; };
  const row = await lookupRow({player: 'Stephen Curry', sport: 'nba', stat: 'Pts+Rebs+Asts', line: 38.5, side: 'OVER'}, {sports: ['nba'], fetcher, enrich});
  assert.equal(enriched.marketKey, 'player_points_rebounds_assists');
  assert.equal(enriched.playerId, '3975');
  assert.equal(row.historyStatus, 'ready');
  assert.equal(row.teamLogo, 'gs.png');
});

test('MLB looks the player up by name, trying a pitcher\'s strikeouts when a hitter has none', async () => {
  const seen = [];
  const enrich = () => async rows => { seen.push(rows[0].raw.stat); return [rows[0].marketKey.startsWith('pitching')
    ? {...rows[0], historyStatus: 'ready', gameLog: [{value: 7}]} : {...rows[0], historyStatus: 'ready', gameLog: []}]; };
  const row = await lookupRow({player: 'Tarik Skubal', sport: 'mlb', stat: 'Strikeouts', line: 7.5, side: 'OVER'}, {sports: ['mlb'], enrich});
  assert.equal(seen.length, 2);
  assert.match(row.marketKey, /^pitching:/);
});

test('nobody found is nothing; data out of reach is an error, not "not found"', async () => {
  assert.equal(await lookupRow({player: 'Nobody', sport: 'nba', stat: 'Points', line: 10.5}, {sports: ['nba'], fetcher: answer({rows: []})}), null);
  const down = async () => ({ok: false, json: async () => ({error: 'NFL research is temporarily unavailable. Try again shortly.'})});
  await assert.rejects(lookupRow({player: 'Josh Downs', sport: 'nfl', stat: 'Rec Yards', line: 71.5}, {sports: ['nfl'], fetcher: down}),
    error => error.lookup && /temporarily unavailable/.test(error.message));
});

test('a pick whose line wasn\'t read still finds its player', async () => {
  const fetcher = async url => answer({rows: [{id: 'slip:00-1', playerId: '00-1', playerName: 'Josh Downs', headshot: 'downs.png', propType: 'receiving_yards',
    propLabel: 'Receiving Yards', teamId: 'IND', startsAt: PAST, line: {verified: true, value: Number(new URL(url, 'http://x').searchParams.get('line')), direction: 'OVER'},
    apps: [], windows: {l10: w(10, 10)}, gameLog: [{value: 80}]}], events: []})();
  const row = await lookupRow({player: 'Josh Downs', sport: 'nfl', stat: 'Rec Yards', line: null}, {sports: ['nfl'], fetcher});
  assert.equal(row.headshot, 'downs.png');
  assert.equal(row.line, null);
  assert.equal(row.windows, null);
});

test('with no sport on the pick, a league without the player doesn\'t stop the search', async () => {
  const enrich = () => async rows => [{...rows[0], historyStatus: 'unavailable', gameLog: []}];
  const fetcher = answer({rows: [{id: 'slip:00-1', playerId: '00-1', playerName: 'Josh Downs', propType: 'receiving_yards', propLabel: 'Receiving Yards',
    teamId: 'IND', startsAt: PAST, line: {verified: true, value: 71.5, direction: 'OVER'}, apps: [], windows: {l10: w(6, 10)}, gameLog: []}], events: []});
  const row = await lookupRow({player: 'Josh Downs', stat: 'Rec Yards', line: 71.5, side: 'OVER'}, {sports: ['mlb', 'nfl'], fetcher, enrich});
  assert.equal(row.sport, 'nfl');
});
