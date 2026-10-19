// The scouting notes a prop reads are chosen twice: by the Cheat Sheets on
// the server (nfl_scouting.py FAMILIES and YARDS) and by the Slip Analyzer
// here (slip-matchup.js SCOUT_FAMILIES and SCOUT_YARDS). They must agree, or
// a pick reads differently in the two places.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const python = readFileSync(new URL('../nfl_scouting.py', import.meta.url), 'utf8');
const js = readFileSync(new URL('../src/slip-matchup.js', import.meta.url), 'utf8');

const pythonFamilies = () => {
  const body = python.match(/^FAMILIES = \{([\s\S]*?)^\}/m)[1];
  return Object.fromEntries([...body.matchAll(/"(\w+)": \(([^)]*)\)/g)].map(([, market, list]) => [market, [...list.matchAll(/"(\w+)"/g)].map(m => m[1])]));
};
const pythonYards = () => [...python.match(/^YARDS = \{([\s\S]*?)\}/m)[1].matchAll(/"(\w+)"/g)].map(m => m[1]).sort();
const jsFamilies = () => {
  const body = js.match(/const SCOUT_FAMILIES = \{([\s\S]*?)\};/)[1];
  return Object.fromEntries([...body.matchAll(/(\w+): \[([^\]]*)\]/g)].map(([, market, list]) => [market, [...list.matchAll(/'(\w+)'/g)].map(m => m[1])]));
};
const jsYards = () => [...js.match(/const SCOUT_YARDS = new Set\(\[([\s\S]*?)\]\)/)[1].matchAll(/'(\w+)'/g)].map(m => m[1]).sort();

test('every prop reads the same scouting notes on the server and in the Slip Analyzer', () => {
  assert.deepEqual(jsFamilies(), pythonFamilies());
  assert.deepEqual(jsYards(), pythonYards());
});

test('a quarterback\'s rushing lines read the rushing notes', () => {
  const families = jsFamilies();
  for (const market of ['rushing_yards', 'rush_attempts', 'longest_rush', 'passing_rushing_yards']) assert.ok(families[market].includes('rushing'), market);
});
