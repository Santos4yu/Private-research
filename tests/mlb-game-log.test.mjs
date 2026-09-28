import test from 'node:test';
import assert from 'node:assert/strict';
import {logOpponent,recentLogGames} from '../src/mlb-game-log.js';
test('known opponents have compact labels and correct team logos',()=>{
 assert.equal(logOpponent({opponent:{id:147,name:'New York Yankees'}}).label,'NYY');
 assert.match(logOpponent({opponent:{id:147}}).logo,/147.svg$/);
 assert.equal(logOpponent({opponent:{id:999,name:'Unknown'}}).logo,null);
});
test('latest 15 games sorted newest first without changing source',()=>{
 const games=Array.from({length:20},(_,i)=>({date:`2026-09-${String(i+1).padStart(2,'0')}`,gameId:i}));
 const result=recentLogGames({games});
 assert.equal(result.length,15);assert.equal(result[0].gameId,19);assert.equal(games[0].gameId,0);
 assert.equal(recentLogGames({games:games.slice(0,6)}).length,6);
});
