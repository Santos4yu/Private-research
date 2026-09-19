import test from 'node:test';
import assert from 'node:assert/strict';
import { matchupNumber, boardResearchSide, matchupUpdatedText, canReuseResearch, MATCHUP_VERSION } from '../src/matchup-rating.js';

test('missing scores never become zero or enter matchup rankings', () => {
  for (const value of [null, undefined, '', ' ', false, true, 'NaN', Infinity, -1, 101]) {
    assert.ok(Number.isNaN(matchupNumber(value)));
  }
  assert.equal(matchupNumber(0), 0);
  assert.equal(matchupNumber('79'), 79);
});

test('research navigation preserves both directions', () => {
  assert.equal(boardResearchSide({ stats: { side: 'under' } }), 'Under');
  assert.equal(boardResearchSide({ stats: { side: 'over' } }), 'Over');
  assert.equal(boardResearchSide({ side: 'UNDER' }), 'Under');
});

test('rating freshness is visible only for real timestamps', () => {
  assert.equal(matchupUpdatedText({ updatedAt: 'bad' }), '');
  assert.match(matchupUpdatedText({ updatedAt: '2026-09-19T06:00:00Z' }), /^Rated /);
});

test('unversioned static props and expired research cannot bypass live grading', () => {
  const now = Date.parse('2026-09-19T06:00:00Z');
  const fresh = { matchupVersion: MATCHUP_VERSION, matchupContext: { updatedAt: new Date(now - 1000).toISOString() } };
  assert.ok(canReuseResearch(fresh, now));
  assert.equal(canReuseResearch({ ...fresh, matchupVersion: 'old' }, now), false);
  assert.equal(canReuseResearch(fresh, now + 180000), false);
  assert.equal(canReuseResearch({ matchupScore: 100 }, now), false);
});
