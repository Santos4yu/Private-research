import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LEAGUE_LOGOS} from '../src/league-logos.js';

test('every Finder sport has a league mark',()=>{
  for(const sport of ['nba','wnba','mlb','nfl','nhl','soccer','tennis','cs2'])
    assert.ok(LEAGUE_LOGOS[sport],`${sport} logo missing`);
});

test('CS2 uses a shipped, valid PNG rather than an undefined image source',()=>{
  assert.equal(LEAGUE_LOGOS.cs2,'/leagues/cs2.png');
  const data=readFileSync(new URL('../public/leagues/cs2.png',import.meta.url));
  assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
});
