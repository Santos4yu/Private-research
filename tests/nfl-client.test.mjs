import test from 'node:test';
import assert from 'node:assert/strict';
import { createNFLClient, freshness } from '../src/sports/nfl/nfl-client.js';
import { readFileSync } from 'node:fs';
test('client prop badges match the versioned production audit', () => {
  const audit = JSON.parse(readFileSync(new URL('../docs/nfl-production-model-status.json',import.meta.url)));
  const ui = JSON.parse(readFileSync(new URL('../src/sports/nfl/model-status.json',import.meta.url)));
  assert.equal(ui.gateVersion,audit.gateVersion);
  assert.deepEqual(ui.models,audit.models.map(({position,propType,pointStatus})=>({position,propType,pointStatus})));
  assert.equal(ui.models.filter(row=>row.pointStatus==='VALIDATED').length,0);
});
test('NFL requests coalesce, expire and explicitly invalidate', async () => {
  let calls = 0, time = 0;
  const client = createNFLClient({ now: () => time, fetcher: async () => { calls++; return { ok: true, json: async () => ({ data: [] }) }; } });
  await Promise.all([client.get('players',{season:2026}),client.get('players',{season:2026})]);
  assert.equal(calls,1); time = 300001; await client.get('players',{season:2026}); assert.equal(calls,2);
  client.clear(); await client.get('players',{season:2026}); assert.equal(calls,3);
});
test('NFL cache separates season/player/prop and never caches provider failures', async () => {
  let calls = 0;
  const client = createNFLClient({ fetcher: async () => { calls++; return { ok: calls > 1, status: 503, json: async () => ({ data: { status:'NOT_AVAILABLE' } }) }; } });
  await assert.rejects(client.get('projection',{playerId:'a',prop:'targets',season:2026}));
  await client.get('projection',{playerId:'a',prop:'targets',season:2026});
  await client.get('projection',{playerId:'b',prop:'targets',season:2026}); assert.equal(calls,3);
});
test('freshness does not turn absent timestamps into live data', () => {
  assert.equal(freshness(null), 'Timestamp unavailable');
  assert.equal(freshness('2026-09-12T12:00:00Z',Date.parse('2026-09-12T12:16:00Z')), 'Stale · refresh research');
});
test('current quotes expire at the stricter two-minute line threshold', () => {
  assert.equal(freshness('2026-09-12T12:00:00Z',Date.parse('2026-09-12T12:02:00Z'),120000),'Stale · refresh research');
  assert.equal(freshness('2026-09-12T12:00:00Z',Date.parse('2026-09-12T12:02:00Z')),'Updated 2m ago');
});
