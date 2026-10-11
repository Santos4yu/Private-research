import test from 'node:test';
import assert from 'node:assert/strict';
import {nflGet,seedGames} from '../src/sports/nfl/nfl-finder.js';

const reply=(status,body)=>({ok:status<400,status,json:async()=>body});

test('a gateway timeout is asked once more, then reported', async () => {
  const calls=[];
  globalThis.fetch=async url=>{calls.push(url);return calls.length===1?reply(504,{}):reply(200,{rows:[1]});};
  assert.deepEqual(await nflGet('log',{season:2026,playerId:'00-1'}),{rows:[1]});
  assert.equal(calls.length,2);
  calls.length=0;
  globalThis.fetch=async url=>{calls.push(url);return reply(504,{});};
  await assert.rejects(nflGet('log',{season:2026,playerId:'00-2'}),/temporarily unavailable/);
  assert.equal(calls.length,2);
});

test('a real answer is final and a failure is forgotten so Retry asks again', async () => {
  let calls=0;
  globalThis.fetch=async()=>{calls+=1;return reply(400,{error:'A verified NFL player is required.'});};
  await assert.rejects(nflGet('log',{season:2026,playerId:'00-3'}),/verified NFL player/);
  assert.equal(calls,1);
  globalThis.fetch=async()=>{calls+=1;return reply(200,{ok:true});};
  assert.deepEqual(await nflGet('log',{season:2026,playerId:'00-3'}),{ok:true});
  assert.equal(calls,2);
});

test('a dropped connection is retried once', async () => {
  let calls=0;
  globalThis.fetch=async()=>{calls+=1;if(calls===1)throw new TypeError('Load failed');return reply(200,{fine:1});};
  assert.deepEqual(await nflGet('pbp',{season:2026,playerId:'00-4'}),{fine:1});
  assert.equal(calls,2);
});

test('the Finder rows seed one game per date with every market they carry', () => {
  const games=seedGames([
    {marketKey:'passing_yards',gameLog:[{value:210,date:'2026-09-20',home:false,opponent:'NE'},{value:250,date:'2025-12-28',home:true,opponent:'BAL'}]},
    {marketKey:'longest_completion',gameLog:[{value:26,date:'2026-09-20',home:false,opponent:'NE'},{value:null,date:'2026-09-27',opponent:'CIN'}]},
  ]);
  assert.equal(games.length,2);
  assert.deepEqual(games.map(game=>game.date),['2025-12-28','2026-09-20']);
  assert.deepEqual(games[1].values,{passing_yards:210,longest_completion:26});
  assert.equal(games[0].season,2025);
  assert.equal(games[1].isHome,false);
  assert.equal(games[1].dnp,false);
});
