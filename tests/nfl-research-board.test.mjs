import test from 'node:test';
import assert from 'node:assert/strict';
import {rankResearch,researchPlayer} from '../src/sports/nfl/research-board.js';
const now=Date.now();
const row={playerId:'mock',propType:'targets',position:'WR',gameId:'mock-game',support:.6,decisions:10,recentHits:8,recentDecisions:10,startsAt:new Date(now+3600000).toISOString(),line:{verified:true,bookmaker:'prizepicks',category:'STANDARD',value:5.5,updatedAt:new Date(now).toISOString()}};
test('global ranking is independent of game loading order',()=>{assert.equal(rankResearch([{...row,support:.5},{...row,support:.8}],{now})[0].support,.8);});
test('filters and freshness are applied before ranking',()=>{assert.equal(rankResearch([row],{position:'QB',now}).length,0);assert.equal(rankResearch([row],{now:now+601000}).length,0);});
test('research opens exact offer and never invents identity',()=>{assert.equal(researchPlayer(row,[]),null);const matchupContext={opponentId:'OPP',positionDefense:[]};const result=researchPlayer({...row,matchupContext},[{id:'mock',name:'Test only'}]);assert.equal(result.researchLine,row.line);assert.equal(result.researchProp,'targets');assert.equal(result.researchGameId,'mock-game');assert.equal(result.researchMatchup,matchupContext);});
