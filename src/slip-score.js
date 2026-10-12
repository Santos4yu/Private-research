// One way to score a parlay, for every page that shows one: the Parlay
// Builder (smart-slip.js buildLadder), the Slip Analyzer and the Ace
// Assistant (slip-check.js scoreEntry). The same picks always get the same
// chance, the same worth and the same letter wherever they're looked at.
import {jointChance} from './slip-correlation.js';

// The parlay's letter, from what it returns per $1 over time.
export const LETTERS = [[1.35, 'A+'], [1.2, 'A'], [1.1, 'A-'], [1.02, 'B+'], [0.95, 'B'], [0.88, 'B-'], [0.8, 'C+'], [0.7, 'C'], [0.55, 'D']];
export const letterFor = value => (LETTERS.find(([floor]) => value >= floor) || [0, 'F'])[1];
// What each letter means, in the same words on every page.
export const HEADLINES = {'A+': 'Elite parlay', 'A': 'Strong parlay', 'A-': 'Strong parlay', 'B+': 'Good parlay', 'B': 'Playable parlay', 'B-': 'Playable parlay',
  'C+': 'Long shot', 'C': 'Long shot', 'D': 'Risky parlay', 'F': 'Fade this parlay'};
export const gradeTone = letter => ({A: 'up', B: 'blue', C: 'gold'})[String(letter || '')[0]] || 'down';

/** Chance of exactly k hits, for k = 0..n, the picks taken one by one. */
export function hitsDistribution(chances) {
  let dist = [1];
  for (const p of chances) {
    const next = new Array(dist.length + 1).fill(0);
    dist.forEach((value, k) => { next[k] += value * (1 - p); next[k + 1] += value * p; });
    dist = next;
  }
  return dist;
}

/**
 * A parlay from its picks' chances and the pairs among them that move
 * together ([{a, b, rho}], slip-correlation.js links): the chance every pick
 * hits, linked pairs counted; what it returns per $1 over time; the chance
 * it at least pays the stake back; and its letter. `pays` is the all-hit
 * multiplier. `flex` ({hits: multiplier}, already scaled) makes it a Flex
 * play, whose worth counts the partial payouts too; linked picks move
 * chance between all hitting and missing one.
 */
export function scoreParlay(chances, pairs = [], {pays = null, flex = null} = {}) {
  const n = chances.length;
  const independent = chances.reduce((product, p) => product * p, 1);
  const chance = jointChance(chances, pairs);
  if (flex) {
    const dist = hitsDistribution(chances);
    const extra = independent > 0 ? dist[n] * (chance / independent - 1) : 0;
    dist[n] += extra;
    dist[n - 1] = Math.max(0, dist[n - 1] - extra);
    const value = Object.entries(flex).reduce((sum, [k, pay]) => sum + dist[Number(k)] * pay, 0);
    const profit = Object.entries(flex).filter(([, pay]) => pay > 1).reduce((sum, [k]) => sum + dist[Number(k)], 0);
    return {chance, independent, value, profit, letter: letterFor(value)};
  }
  const value = pays ? chance * pays : null;
  return {chance, independent, value, profit: chance, letter: value == null ? null : letterFor(value)};
}
