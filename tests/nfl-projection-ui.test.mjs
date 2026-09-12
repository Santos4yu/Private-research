import test from 'node:test';
import assert from 'node:assert/strict';
import { projectionValue } from '../src/sports/nfl/projection-ui.js';

test('disabled, unavailable and stale prop results cannot show projections', () => {
  const data = { propType: 'receiving_yards', status: 'LOW_CONFIDENCE', promotion: 'EXPERIMENTAL', projectionMean: 80 };
  assert.equal(projectionValue(data, 'receiving_yards'), 80);
  assert.equal(projectionValue(data, 'receptions'), null);
  assert.equal(projectionValue({ ...data, promotion: 'DISABLED' }, 'receiving_yards'), null);
  assert.equal(projectionValue({ ...data, status: 'NOT_AVAILABLE' }, 'receiving_yards'), null);
});

test('real zero is available but missing, NaN and infinity are unavailable', () => {
  const data = { propType: 'targets', status: 'LOW_CONFIDENCE', promotion: 'EXPERIMENTAL' };
  assert.equal(projectionValue({ ...data, projectionMean: 0 }, 'targets'), 0);
  for (const value of [null, undefined, NaN, Infinity]) assert.equal(projectionValue({ ...data, projectionMean: value }, 'targets'), null);
});
