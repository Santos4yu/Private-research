import test from 'node:test';
import assert from 'node:assert/strict';
import {tennisOpponentResults,tennisResultSummary,tennisH2H,tennisRatio} from '../src/sports/tennis/tennis-research.js';
const game={gameId:'1',date:'2026-09-01T12:00:00Z',opponent:'Player A',result:'W',score:'6-4 6-3',rank:12,opponentRank:40,opponentOdds:3,values:{totalgameswon:12,gameslost:7,totalgames:19,totalsets:2,setswon:2,aces:6,acesallowed:2},opponentValues:{doublefaults:3}};
test('opponent rows reverse scores and serving data without inventing missing fields',()=>{
 const [r]=tennisOpponentResults([game],'Player B','aces',2);
 assert.equal(r.player,'Player A');assert.equal(r.opponent,'Player B');assert.equal(r.value,2);assert.equal(r.outcome,'Push');assert.equal(r.score,'4-6 3-6');assert.equal(r.odds,3);assert.equal(r.values.doublefaults,3);assert.equal(r.values.totalgameswon,7);assert.equal(r.result,'L');assert.equal(r.values.firstservepercentage,undefined);
});
test('summary excludes absent stats and pushes from hit rate',()=>{
 const rows=[{value:3},{value:2},{value:0},{value:null}],s=tennisResultSummary(rows,2);
 assert.equal(s.graded,2);assert.equal(s.over,1);assert.equal(s.pushes,1);assert.equal(s.reported,3);
});
test('H2H merges both player histories, deduplicates, and respects the two-year window',()=>{
 const other={...game,opponent:'Player B'};
 const first={...game,opponent:'Player A',score:'4-6 3-6',result:'L'};
 const old={...first,date:'2022-01-01T00:00:00Z'};
 assert.equal(tennisH2H([first,old],[other],'Player B','Player A','2026-10-01T00:00:00Z').length,1);
});
test('break-point rates use pooled chances and missing pairs stay absent',()=>{
 const ratio=tennisRatio([{values:{breakpointswon:1,breakpointchances:2}},{values:{breakpointswon:1,breakpointchances:8}}],'breakpointswon','breakpointchances');assert.equal(ratio.percentage,20);
 assert.equal(tennisRatio([{values:{}}],'breakpointswon','breakpointchances'),null);
});
