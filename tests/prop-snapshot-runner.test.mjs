// The prop snapshot job (tools/prop-snapshot/run.mjs) end to end against a
// stand-in site: it reads what a member's Props tab reads, grades with the
// site's own modules and posts each line's Over and Under grade.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';

const league = JSON.parse(readFileSync(new URL('./fixtures/nba-2025-26-league.json', import.meta.url), 'utf8'));
const start = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
const raw = (id, playerId, player, marketKey, market, line, modifier = 'standard') => ({id: `pp:${id}`, player, playerId, market, marketKey, line, modifier,
  startsAt: start, teamAbbr: 'GS', team: 'Golden State Warriors', homeTeam: 'Golden State Warriors', homeTeamAbbr: 'GS', awayTeamAbbr: 'LAL', position: 'G',
  apps: [{key: 'prizepicks', name: 'PrizePicks', over: null, under: null, modifier}]});
const BOARD = [raw(1, '3975', 'Stephen Curry', 'player_points', 'Points', 26.5), raw(2, '3975', 'Stephen Curry', 'player_points', 'Points', 22.5, 'goblin'),
  raw(3, '3975', 'Stephen Curry', 'player_threes', '3-PT Made', 4.5), raw(4, '6475', 'Draymond Green', 'player_assists', 'Assists', 6.5)];
const logs = Array.from({length: 14}, (_, index) => ({gameId: String(index), date: `2026-11-${String(index + 1).padStart(2, '0')}T00:00Z`,
  opponent: index % 2 ? 'BOS' : 'LAL', isHome: index % 2 === 0, seasonKind: 'regular', minutes: 30 + (index % 5),
  values: {player_points: 20 + (index * 7) % 15, player_threes: 2 + index % 5, player_assists: 4 + index % 6}}));

function site() {
  const posted = [];
  const asked = [];
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://x');
    asked.push({path: url.pathname + url.search, token: request.headers['x-github-oidc']});
    const send = (status, body) => { response.writeHead(status, {'Content-Type': 'application/json'}); response.end(JSON.stringify(body)); };
    if (url.pathname === '/token') return send(200, {value: 'signed-token'});
    if (request.method === 'POST') {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => { posted.push(JSON.parse(body)); send(200, {kept: 3}); });
      return undefined;
    }
    const resource = url.searchParams.get('resource');
    if (url.pathname === '/api/prediction') return send(200, {version: 1, at: '2026-11-18T09:00:00Z', picks: 300, groups: {nba: {points: [[0.5, 0], [0.7, -0.02]]}}});
    if (resource === 'gamelogs') return send(200, {histories: Object.fromEntries(url.searchParams.get('playerIds').split(',').map(id => [id, {rows: logs}]))});
    if (resource === 'gamelog') return send(200, {rows: logs});
    if (resource === 'league-context') return send(200, league);
    if (resource === 'tonight') return send(200, {fetchedAt: '2026-11-18T16:00:00Z', teams: {
      GS: {eventId: '1', startsAt: start, opponent: 'LAL', spread: -3.5, total: 228.5, injuries: [{id: '6475', name: 'Draymond Green', status: 'Questionable', code: 'GTD'}]},
      LAL: {eventId: '1', startsAt: start, opponent: 'GS', spread: 3.5, total: 228.5, injuries: []}}});
    if (resource === 'book-props') return send(200, {at: 1, players: {stephencurry: {pts: [26.5, -120, 100, 0.53]}}});
    if (url.pathname === '/api/board' && url.searchParams.get('view') === 'finder-history') return send(200, {histories: {}});
    if (url.pathname === '/api/wnba') return send(200, {rows: BOARD, fetchedAt: '2026-11-18T16:01:00Z'});
    return send(404, {error: 'unknown'});
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({server, posted, asked, port: server.address().port})));
}

function run(port, args = []) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, ['tools/prop-snapshot/run.mjs', ...args], {cwd: new URL('..', import.meta.url),
      env: {...process.env, SITE: `http://127.0.0.1:${port}`, ACTIONS_ID_TOKEN_REQUEST_URL: `http://127.0.0.1:${port}/token?x=1`,
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'request', GITHUB_SHA: 'abc1234'}});
    let out = '';
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { out += chunk; });
    child.on('close', code => resolve({code, out}));
  });
}

test('the job grades every listed line with the site\'s code and posts both sides', async () => {
  const {server, posted, asked, port} = await site();
  try {
    const {code, out} = await run(port);
    assert.equal(code, 0, out);
    assert.equal(posted.length, 1);
    const body = posted[0];
    assert.equal(body.action, 'nba-prop-snapshot');
    assert.equal(body.sha, 'abc1234');
    assert.match(body.model.hash, /^[0-9a-f]{12}$/);
    assert.ok(body.model.files > 10);
    assert.match(body.model.calibration, /^1\|/);
    // Every request carried the signed token.
    assert.ok(asked.filter(item => item.path !== '/token?x=1&audience=aceprops-nba-prop-snapshot').every(item => item.token === 'signed-token'));
    const points = body.rows.find(row => row.pp === '1');
    assert.equal(points.pid, '3975');
    assert.equal(points.mk, 'player_points');
    assert.equal(points.md, 'standard');
    // Over and Under each: [chance, raw, trend, tier, capped, needs, book, history, model chance, weight, backed].
    assert.equal(points.o.length, 11);
    assert.equal(points.u.length, 11);
    assert.ok(points.o[0] > 0 && points.o[0] < 1 && points.u[0] > 0 && points.u[0] < 1);
    assert.ok(Number.isFinite(points.pj));
    assert.equal(points.m.length, 6);
    // DraftKings at PrizePicks' line.
    assert.equal(points.dk[1], 26.5);
    // A Goblin is graded on the Over only.
    const goblin = body.rows.find(row => row.pp === '2');
    assert.equal(goblin.md, 'goblin');
    assert.equal(goblin.u, null);
    // His own report status as the grade read it.
    assert.deepEqual(body.rows.find(row => row.pid === '6475').ns, ['Questionable', 'GTD']);
    assert.equal(body.inputs.tonight.GS.injuries[0][2], 'Questionable');
    assert.equal(body.data.lines, 4);
    assert.equal(body.data.graded, 4);
    assert.equal(body.data.eligible, 3);
    assert.equal(body.data.bothSides, 3);
    assert.equal(body.data['bothSides.player_threes'], 1);
    assert.equal(body.data['bothSides.player_assists'], 1);
    assert.ok(!body.problems.some(text => /differed/.test(text)), body.problems.join('; '));
  } finally {
    server.close();
  }
});
