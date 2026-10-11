import test from 'node:test';
import assert from 'node:assert/strict';
import {installRequestGuard} from '../src/request-guard.js';

function page(reply) {
  const listeners = {};
  const doc = {visibilityState: 'visible', addEventListener: (name, fn) => { listeners[name] = fn; }};
  const target = {location: new URL('https://aceprops.xyz/finder'), document: doc, calls: [],
    addEventListener: (name, fn) => { listeners[name] = fn; }, fetch: (url, init) => { target.calls.push({url, init}); return reply(url, init, target.calls.length); }};
  installRequestGuard(target);
  return {target, listeners};
}
const hang = (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));

test('a read in flight when the app comes back starts over', async () => {
  const {target, listeners} = page((url, init, n) => n === 1 ? hang(url, init) : Promise.resolve({ok: true, n}));
  const pending = target.fetch('/api/board?view=props');
  target.calls[0].init.signal; // in flight
  const started = Date.now; Date.now = () => started() + 10000;
  try { listeners.visibilitychange(); } finally { Date.now = started; }
  assert.deepEqual(await pending, {ok: true, n: 2});
  assert.equal(target.calls.length, 2);
});

test('a fresh read is left alone, and writes are never repeated', async () => {
  const {target, listeners} = page((url, init, n) => n <= 2 ? hang(url, init) : Promise.resolve({again: n}));
  const write = target.fetch('/api/session?action=account', {method: 'POST', body: '{}'});
  const read = target.fetch('/api/board');
  listeners.online();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(target.calls.length, 2);
  const started = Date.now; Date.now = () => started() + 10000;
  try { listeners.online(); } finally { Date.now = started; }
  assert.deepEqual(await read, {again: 3});
  assert.equal(target.calls.length, 3);
  assert.equal(target.calls[2].url, '/api/board');
  assert.equal(target.calls[0].init.signal.aborted, false);
  void write;
});

test('other sites pass straight through; an own signal still cancels', async () => {
  const {target, listeners} = page((url, init) => url.startsWith('/api/') ? hang(url, init) : Promise.resolve({}));
  target.fetch('https://api.prizepicks.com/projections');
  assert.equal(target.calls[0].init.signal, undefined);
  const leave = new AbortController();
  const pending = target.fetch('/api/wnba', {signal: leave.signal});
  assert.notEqual(target.calls[1].init.signal, leave.signal);
  leave.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
  // Cancelled by the page: never restarted on wake.
  const started = Date.now; Date.now = () => started() + 10000;
  try { listeners.visibilitychange(); } finally { Date.now = started; }
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(target.calls.length, 2);
});

test('a call past the limit fails as a timeout the page will show', async (t) => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const {target} = page((url, init) => hang(url, init));
  const pending = target.fetch('/api/board?view=props', {signal: new AbortController().signal});
  t.mock.timers.tick(65001);
  await assert.rejects(pending, error => error.name === 'TimeoutError' && /longer than usual/.test(error.message));
});
