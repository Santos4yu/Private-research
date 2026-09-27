import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTrendCache, trendContextKey, gradeTrendChart, mergeTrendCharts } from '../src/trend-data.js';
import { finderMarket, historyChart, nameKey } from '../src/prop-finder-core.js';

// Run the real orchestration functions without booting the site's auth, DOM,
// or unrelated screens. Network gates below model response ordering explicitly.
const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function productionFunction(name) {
  const match = new RegExp(`^(?:async )?function ${name}\\(`, 'm').exec(source);
  assert.ok(match, `Production function ${name} exists`);
  const firstLineEnd = source.indexOf('\n', match.index);
  const firstLine = source.slice(match.index, firstLineEnd);
  const end = firstLine.endsWith('}') ? firstLineEnd : source.indexOf('\n}', firstLineEnd) + 2;
  return source.slice(match.index, end);
}
function productionConstant(name) {
  const start = source.indexOf(`const ${name} = `);
  assert.ok(start >= 0, `Production constant ${name} exists`);
  const end = source.indexOf(source[start + `const ${name} = `.length] === '[' ? '\n];' : '\n};', start);
  return source.slice(start, end + 3);
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = () => new Promise(resolve => setImmediate(resolve));
const reply = (body, ok = true) => ({ ok, json: async () => body });
const rawHistory = (stat = {}, playerId = 101) => ({
  player: { id: playerId }, updatedAt: Date.now(), matchup: { opponent: { id: 146, name: 'Miami Marlins' } },
  games: [{ gameId: 99, date: '2026-09-01', isHome: true, opponent: { id: 146, name: 'Miami Marlins' },
    stat: { gamesStarted: 1, strikeOuts: 7, outs: 17, inningsPitched: '5.2', hits: 4, totalBases: 6, ...stat } }],
});
const detail = value => ({ all: [{ value, fullDate: '2026-09-01', over: false }], meta: { player_id: 101 } });

function harness(respond = () => undefined) {
  const calls = [], paints = [], storage = new Map();
  const gameLogState = { player: 'Test Pitcher', stat: 'Strikeouts (Pitcher)', line: 5.5, isPitcher: true,
    chart: {}, fetchToken: 0, teamId: 146, opponent: 'Miami Marlins', handFilter: 'all', venueFilter: 'all',
    season: 'all', window: 'recent', windowKey: '10', gameCount: 10, loading: false, error: '', lineEdited: false };
  const bridge = { lines: [], value: '', status: '', disabled: false,
    setLines(value) { this.lines = value; }, setValue(value) { this.value = value; },
    setStatus(value) { this.status = value; }, setDisabled(value) { this.disabled = value; } };
  const els = { gamelogLineValue: { textContent: '' }, gamelogTitle: { textContent: '' },
    gamelogPropBadge: { textContent: '' }, gamelogHandField: { hidden: true }, gamelogOddsRow: { innerHTML: '' },
    gamelogStatTabs: { querySelectorAll: () => [] }, gamelogLinesBridge: bridge,
    glHandFilterBridge: { setDisabled(value) { this.disabled = value; } } };
  const dependencies = {
    gameLogState, els, createTrendCache, trendContextKey, gradeTrendChart, mergeTrendCharts,
    finderMarket, historyChart, nameKey, API_SOURCE: '/api/prediction',
    state: { pitcherFinderLoaded: false, pitcherFinderProps: [] },
    sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key,value) => storage.set(key,value) },
    fetch: async (url, options) => {
      const parsed = new URL(url, 'http://fixture.test');
      const call = { path: parsed.pathname, query: parsed.searchParams, options };
      calls.push(call);
      const custom = respond(call);
      if (custom !== undefined) return await custom;
      if (parsed.searchParams.get('view') === 'props') return reply({ props: [] });
      if (parsed.searchParams.get('action') === 'prizepicks-lines') return reply({ bookLines: [] });
      if (parsed.searchParams.get('view') === 'prop-history') return reply(rawHistory());
      return reply(detail(1));
    },
    renderGameLogTabs: () => {},
    renderGameLogChart: () => paints.push({ player: gameLogState.player, stat: gameLogState.stat,
      values: (gameLogState.chart.all || []).map(game => game.value), line: gameLogState.line,
      loading: gameLogState.loading, error: gameLogState.error }),
    syncGameLogContext: () => {}, captureGameLogViewport: () => ({}), restoreGameLogViewport: () => {},
    recordLineHistory: () => {}, renderLineMovement: () => {}, isMlbTrend: () => true, trendAdapter: {statCode: stat => stat}, externalTrendConfig: null,
    escapeHtml: value => String(value), americanOdds: value => Number(value) > 0 ? `+${value}` : String(value),
  };
  const names = ['syncTrendStatHeader','gameLogLineKey','snapPropLine','gameLogStatCode','regradeGameLog','setGameLogPreviewLine',
    'loadGameLogStat','requestGameLogDetails','gamelogLineTier','loadGameLogPostedLines','loadGameLogBookOdds',
    'renderGameLogBookOdds','recentGameLogSource','pitcherFinderStat','readFinderCache','writeFinderCache',
    'finderHistoryKey','cachedFinderHistory','requestFinderHistory','requestFinderFeed'];
  const program = [
    productionConstant('STAT_DEFAULT_LINE'), productionConstant('GAMELOG_STAT_CODES'), productionConstant('GAMELOG_ODDS_BOOKS'),
    'const gameLogDetailsCache=createTrendCache(),gameLogOddsCache=createTrendCache(),gameLogCustomLines=new Map();',
    'const finderPlayerHistory=new Map(),finderHistoryRequests=new Map();',
    'let postedLinesToken=0,gamelogPostedLinesContext={},gamelogBookOddsToken=0,gamelogBookOddsRows=[],activeFinderProp=null,finderFeedRequest,finderFeedAt=0;',
    ...names.map(productionFunction),
    'return {loadGameLogStat,loadGameLogPostedLines,loadGameLogBookOdds,setGameLogPreviewLine,requestGameLogDetails,regradeGameLog,gameLogDetailsCache,gameLogOddsCache,getOdds:()=>gamelogBookOddsRows};',
  ].join('\n');
  const engine = new Function(...Object.keys(dependencies), program)(...Object.values(dependencies));
  return { ...engine, state: gameLogState, els, bridge, calls, paints };
}

test('a slower previous market cannot replace a newer detailed result', async () => {
  const raw = deferred(), hits = deferred(), bases = deferred();
  const h = harness(({query,path}) => query.get('view') === 'prop-history' ? raw.promise
    : path === '/api/game-log-filters' ? (query.get('stat') === 'Hits' ? hits.promise : bases.promise) : undefined);
  const first = h.loadGameLogStat('Hits');
  const second = h.loadGameLogStat('Total Bases');
  await flush();
  bases.resolve(reply(detail(6)));
  await flush();
  assert.deepEqual(h.state.chart.all.map(game => game.value), [6]);
  hits.resolve(reply(detail(1)));
  raw.resolve(reply(rawHistory({ hits: 2, totalBases: 4 })));
  await Promise.all([first, second]);
  assert.equal(h.state.stat, 'Total Bases');
  assert.deepEqual(h.state.chart.all.map(game => game.value), [6]);
  assert.equal(h.state.loading, false);
});

test('a previous player response cannot overwrite the current player', async () => {
  const old = deferred(), current = deferred();
  const h = harness(({query}) => query.get('view') === 'prop-history'
    ? (query.get('player') === 'First Pitcher' ? old.promise : current.promise) : undefined);
  h.state.player = 'First Pitcher';
  const first = h.loadGameLogStat('Pitching Outs');
  h.state.player = 'Second Pitcher';
  const second = h.loadGameLogStat('Pitching Outs');
  current.resolve(reply(rawHistory({ outs: 21 }, 202)));
  await second;
  old.resolve(reply(rawHistory({ outs: 9 }, 101)));
  await first;
  assert.equal(h.state.player, 'Second Pitcher');
  assert.equal(h.state.chart.meta.player_id, 202);
  assert.deepEqual(h.state.chart.all.map(game => game.value), [21]);
});

test('manual lines survive a delayed posted quote and a round trip through another market', async () => {
  const feed = deferred();
  const h = harness(({query}) => query.get('view') === 'props' ? feed.promise : undefined);
  const loading = h.loadGameLogStat('Strikeouts (Pitcher)');
  h.setGameLogPreviewLine(8.5, true);
  feed.resolve(reply({ props: [{player:'Test Pitcher',stat:'Pitcher Strikeouts',line:5.5,odds_type:'standard'}] }));
  await loading;
  assert.equal(h.state.line, 8.5);
  assert.equal(h.state.chart.all[0].over, false);
  await h.loadGameLogStat('Pitching Outs');
  await h.loadGameLogStat('Strikeouts (Pitcher)');
  assert.equal(h.state.line, 8.5);
  assert.equal(h.els.gamelogLineValue.textContent, '8.5');
});

test('pitcher market switching reuses raw history and derives outs instead of strikeouts', async () => {
  const payload = rawHistory({ strikeOuts: 7, outs: 17 });
  const h = harness(({query}) => query.get('view') === 'prop-history' ? reply(payload) : undefined);
  await h.loadGameLogStat('Strikeouts (Pitcher)');
  assert.deepEqual(h.state.chart.all.map(game => game.value), [7]);
  await h.loadGameLogStat('Pitching Outs');
  assert.deepEqual(h.state.chart.all.map(game => game.value), [17]);
  assert.equal(h.calls.filter(call => call.query.get('view') === 'prop-history').length, 1);
  assert.equal(h.calls.filter(call => call.path === '/api/game-log-filters').length, 0);
  assert.equal(payload.games[0].stat.strikeOuts, 7);
  assert.equal(payload.games[0].stat.outs, 17);
});

test('stale posted-line responses cannot select a previous player or market baseline', async () => {
  const feed = deferred();
  const h = harness(({query}) => query.get('view') === 'props' ? feed.promise : undefined);
  const first = h.loadGameLogPostedLines('Strikeouts (Pitcher)', 'Test Pitcher');
  h.state.player = 'Another Pitcher'; h.state.stat = 'Pitching Outs'; h.state.fetchToken++;
  const second = h.loadGameLogPostedLines('Pitching Outs', 'Another Pitcher');
  feed.resolve(reply({props:[
    {player:'Test Pitcher',stat:'Pitcher Strikeouts',line:7.5,odds_type:'standard'},
    {player:'Another Pitcher',stat:'Pitching Outs',line:18.5,odds_type:'standard'},
  ]}));
  await Promise.all([first,second]);
  assert.equal(h.state.line, 18.5);
  assert.deepEqual(h.bridge.lines, [{value:18.5,tier:'STANDARD'}]);
  assert.equal(h.bridge.value, '18.5');
});

test('out-of-order odds for previous markets and players are ignored', async () => {
  const oldStat = deferred(), oldPlayer = deferred(), current = deferred();
  const h = harness(({query}) => query.get('action') === 'prizepicks-lines'
    ? query.get('player') === 'Current Pitcher' ? current.promise
      : query.get('stat') === 'Pitching Outs' ? oldPlayer.promise : oldStat.promise : undefined);
  const first = h.loadGameLogBookOdds('Strikeouts (Pitcher)');
  h.state.stat = 'Pitching Outs'; h.state.fetchToken++;
  const second = h.loadGameLogBookOdds('Pitching Outs');
  h.state.player = 'Current Pitcher'; h.state.stat = 'Strikeouts (Pitcher)'; h.state.fetchToken++;
  const third = h.loadGameLogBookOdds('Strikeouts (Pitcher)');
  const prices = price => reply({bookLines:[{line:5.5,books:{draftkings:{over:price,under:105}}}]});
  current.resolve(prices(-177));
  await third;
  oldPlayer.resolve(prices(-133)); oldStat.resolve(prices(-111));
  await Promise.all([first,second]);
  assert.equal(h.getOdds()[0].books.draftkings.over, -177);
  assert.match(h.els.gamelogOddsRow.innerHTML, /-177/);
  assert.doesNotMatch(h.els.gamelogOddsRow.innerHTML, /-133|-111/);
});

test('grading preserves metadata and never mutates cached arrays or game objects', () => {
  const game = Object.freeze({value:4,over:true,pitcherDetails:Object.freeze({inningsPitched:'5.2'})});
  const meta = Object.freeze({player_id:101,opponent_team_id:146});
  const sourceChart = Object.freeze({all:Object.freeze([game]),h2h:Object.freeze([game]),meta});
  const graded = gradeTrendChart(sourceChart, 4.5);
  assert.equal(graded.meta, meta);
  assert.notEqual(graded.all, sourceChart.all);
  assert.notEqual(graded.all[0], game);
  assert.equal(graded.all[0].over, false);
  assert.equal(game.over, true);
  const merged = mergeTrendCharts(sourceChart, {all:[],h2h:[],meta:{h2hLabel:'Sample opponent'}});
  assert.equal(merged.h2h.length, 1);
  assert.equal(merged.meta.player_id, 101);
  assert.equal(merged.meta.h2hLabel, 'Sample opponent');
  assert.equal(sourceChart.meta.h2hLabel, undefined);
});

test('detail transport deduplicates concurrent requests and reuses cached data independently of line', async () => {
  const gate = deferred();
  const h = harness(({path}) => path === '/api/game-log-filters' ? gate.promise : undefined);
  const context = {player:'Sample Batter',stat:'Hits',teamId:146,opponent:'Miami Marlins'};
  const first = h.requestGameLogDetails(context);
  const second = h.requestGameLogDetails({...context,line:2.5});
  await flush();
  assert.equal(h.calls.filter(call => call.path === '/api/game-log-filters').length, 1);
  gate.resolve(reply(detail(3)));
  const [one,two] = await Promise.all([first,second]);
  assert.equal(one,two);
  assert.equal(await h.requestGameLogDetails({...context,line:7.5}), one);
  assert.equal(h.calls.filter(call => call.path === '/api/game-log-filters').length, 1);
});

test('failed detail requests are evicted so retry can recover', async () => {
  let attempts = 0;
  const h = harness(({path}) => path === '/api/game-log-filters'
    ? ++attempts === 1 ? reply({error:'Temporary outage'},false) : reply(detail(2)) : undefined);
  const context = {player:'Sample Batter',stat:'Hits'};
  await assert.rejects(h.requestGameLogDetails(context), /Temporary outage/);
  assert.equal((await h.requestGameLogDetails(context)).all[0].value, 2);
  assert.equal(attempts, 2);
});

test('a history failure leaves an actionable state and retry clears it', async () => {
  let attempts = 0;
  const h = harness(({query}) => query.get('view') === 'prop-history'
    ? ++attempts === 1 ? reply({error:'Unavailable'},false) : reply(rawHistory()) : undefined);
  await h.loadGameLogStat('Pitching Outs');
  assert.equal(h.state.loading, false);
  assert.match(h.state.error, /Try again/);
  assert.equal(h.state.chart.all?.length || 0, 0);
  await h.loadGameLogStat('Pitching Outs');
  assert.equal(h.state.error, '');
  assert.equal(h.state.loading, false);
  assert.deepEqual(h.state.chart.all.map(game => game.value), [17]);
});

test('an empty history settles without stale bars and another player can still load', async () => {
  const h = harness(({query}) => query.get('view') === 'prop-history' && query.get('player') === 'Test Pitcher'
    ? reply({...rawHistory(),games:[]}) : undefined);
  h.state.chart = detail(99);
  await h.loadGameLogStat('Pitching Outs');
  assert.deepEqual(h.state.chart.all, []);
  assert.equal(h.state.error, '');
  assert.equal(h.state.loading, false);
  h.state.player = 'Available Pitcher';
  await h.loadGameLogStat('Pitching Outs');
  assert.deepEqual(h.state.chart.all.map(game => game.value), [17]);
});

test('cache expiry, context identity, and entry bounds preserve fresh independent results', async () => {
  let time = 0, calls = 0;
  const cache = createTrendCache({maxAge:10,limit:2,now:()=>time});
  const key = trendContextKey({player:'Test',stat:'Hits',teamId:146});
  assert.notEqual(key,trendContextKey({player:'Test',stat:'Total Bases',teamId:146}));
  assert.notEqual(key,trendContextKey({player:'Test',stat:'Hits',teamId:119}));
  const load = () => ({version:++calls});
  assert.equal((await cache.request(key,load)).version,1);
  time = 9;
  assert.equal((await cache.request(key,load)).version,1);
  time = 10;
  assert.equal((await cache.request(key,load)).version,2);
  await cache.request('second',load); await cache.request('third',load);
  assert.equal(cache.peek(key),null);
});
