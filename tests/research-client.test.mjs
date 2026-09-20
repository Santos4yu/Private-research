import test from 'node:test';
import assert from 'node:assert/strict';
import { createResearchClient } from '../src/research-client.js';
import { MATCHUP_VERSION } from '../src/matchup-rating.js';

const context = { player: 'Shohei Ohtani', playerId: 660271, stat: 'Hits', line: 1.5, side: 'Over' };
const fresh = (score = 88) => ({
  matchupVersion: MATCHUP_VERSION,
  matchupContext: { updatedAt: new Date().toISOString() },
  score,
});

test('research client coalesces an in-flight request and reuses the result', async () => {
  let calls = 0;
  const client = createResearchClient({
    fetcher: async () => {
      calls += 1;
      await new Promise(resolve => setTimeout(resolve, 5));
      return { ok: true, json: async () => fresh() };
    },
  });
  const [first, second] = await Promise.all([client.request(context), client.request(context)]);
  assert.equal(calls, 1);
  assert.equal(first.score, 88);
  assert.equal(second.score, 88);
  assert.equal(client.peek(context).score, 88);
});

test('clearing the client invalidates an in-flight response', async () => {
  let resolveFetch;
  let markStarted;
  const started = new Promise(resolve => { markStarted = resolve; });
  const client = createResearchClient({
    fetcher: () => {
      markStarted();
      return new Promise(resolve => { resolveFetch = resolve; });
    },
  });
  const request = client.request(context);
  await started;
  client.clear();
  resolveFetch({ ok: true, json: async () => fresh(91) });
  await assert.rejects(request, error => error.name === 'AbortError');
  assert.equal(client.peek(context), null);
});

test('restored ratings stay cached for three minutes without extending freshness', async () => {
  let now = Date.parse('2026-09-20T06:00:00Z');
  let calls = 0;
  const client = createResearchClient({ now: () => now, fetcher: async () => {
    calls++;
    return { ok: true, json: async () => ({ matchupScore: 97,
      matchupVersion: MATCHUP_VERSION,
      matchupContext: { updatedAt: new Date(now).toISOString(), source: 'live' } }) };
  } });
  await client.request(context);
  now += 179000;
  assert.equal((await client.request(context)).matchupScore, 97);
  assert.equal(calls, 1);
  now += 1000;
  assert.equal(client.peek(context), null);
  await client.request(context);
  assert.equal(calls, 2);
});
