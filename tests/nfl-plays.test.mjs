// The NFL player page's plays words (src/nfl-plays.js), on Jahmyr Gibbs'
// real 2026 splits against Green Bay before week 7.
import test from 'node:test';
import assert from 'node:assert/strict';
import {bottomLine,columns,facedTally,headline,metricValue,mostWords,rankFill,beat} from '../src/nfl-plays.js';

const row=(key,his,them,league)=>({key,his,them,league});
const direction={kind:'run',split:'direction',season:2026,total:105,rows:[
 row('left',{n:21,yards:114,share:0.2,value:5.43,rank:11,of:47},{n:42,share:0.309,shareRank:5,value:5.52,rank:7,of:32},{share:0.231,value:4.73}),
 row('middle',{n:53,yards:198,share:0.505,value:3.74,rank:36,of:70},{n:63,share:0.463,shareRank:31,value:2.62,rank:32,of:32},{share:0.567,value:3.81}),
 row('right',{n:31,yards:192,share:0.295,value:6.19,rank:4,of:42},{n:31,share:0.228,shareRank:9,value:4.77,rank:11,of:32},{share:0.202,value:4.14})]};
const box={kind:'run',split:'box',season:2026,total:105,rows:[
 row('light',{n:54,yards:289,share:0.514,value:5.35,rank:11,of:65},{n:71,share:0.522,shareRank:8,value:4.41,rank:17,of:32},{share:0.455,value:4.38}),
 row('base',{n:44,yards:203,share:0.419,value:4.61,rank:16,of:64},{n:58,share:0.426,shareRank:26,value:3.81,rank:19,of:32},{share:0.466,value:4.0}),
 row('stacked',{n:7,yards:12,share:0.067,value:1.71,rank:null,of:15},{n:7,share:0.051,shareRank:21,value:1.57,rank:24,of:31},{share:0.079,value:2.97})]};
const context={opponent:'GB',team:'DET',season:2026};

test('ranks read as most and fewest, 1 the most', () => {
 assert.equal(mostWords(1,32),'the most');
 assert.equal(mostWords(32,32),'the fewest');
 assert.equal(mostWords(8,32),'8th most');
 assert.equal(mostWords(26,32),'7th fewest');
 assert.equal(mostWords(21,31),'11th fewest');
 assert.equal(rankFill(1,10),1);
 assert.equal(rankFill(10,10),0.1);
});

test('each split reads where he works and how the opponent handles it', () => {
 assert.equal(headline(box,context),'51% of his carries come against a light box. GB show one on 52% of backs’ carries (8th most) and allow 4.41 yards a carry against it.');
 assert.equal(headline(direction,context),'51% of his carries go up the middle. GB allow 2.62 yards a carry there, the fewest.');
 assert.deepEqual(columns(direction,'GB'),['His share of carries','GB allow','His YPC']);
 assert.deepEqual(columns(box,'GB'),['His share of carries','GB show it','His YPC']);
});

test('last season’s coverage is told in the past, with its year', () => {
 const coverage={kind:'target',split:'coverage',season:2025,total:94,rows:[
  row('man',{n:23,share:0.245,value:5.96},{n:102,share:0.189,shareRank:32,value:6.85,rank:14,of:32},{share:0.307,value:6.68}),
  row('cover3',{n:26,share:0.277,value:6.42},{n:188,share:0.349,shareRank:3,value:6.98,rank:22,of:32},{share:0.279,value:7.56}),
  row('split',{n:45,share:0.479,value:6.87},{n:247,share:0.458,shareRank:10,value:5.88,rank:30,of:32},{share:0.409,value:6.97})]};
 assert.equal(headline(coverage,context),'In 2025, 48% of his targets came against split-safety coverage. GB played it on 46% of throws (10th most) and allowed 5.88 yards a throw against it.');
 // Last season's looks never make the bottom line.
 assert.equal(bottomLine([coverage],context),null);
});

test('the blitz split reads his share of the team’s targets each way', () => {
 const blitz={kind:'target',split:'blitz',season:2026,total:57,rows:[
  row('blitz',{n:24,share:0.42,teamShare:0.387,value:8.29,rank:27,of:61},{n:69,share:0.329,shareRank:13,value:6.06,rank:24,of:32},{share:0.314,value:6.89}),
  row('calm',{n:33,share:0.58,teamShare:0.262,value:5.52,rank:83,of:102},{n:141,share:0.671,shareRank:20,value:5.94,rank:27,of:32},{share:0.686,value:7.1})]};
 assert.equal(headline(blitz,context),'He gets 39% of DET’s targets when the defense blitzes, 26% when it doesn’t. GB blitz on 33% of throws (13th most) and allow 6.06 yards a throw when they do.');
});

test('the bottom line is the look he lives in that sits furthest from the league', () => {
 assert.equal(bottomLine([box,direction],context),
  '51% of his carries go up the middle, and GB allow 2.62 yards a carry there, the fewest (league average 3.81). He averages 3.7 yards a carry there (36th of 70). That works against his over.');
 // Nothing 8% off the league in a look he uses: no bottom line.
 const even={...direction,rows:direction.rows.map(item=>({...item,them:{...item.them,value:item.league.value}}))};
 assert.equal(bottomLine([even],context),null);
});

test('players who faced them are measured against their line, else their average going in', () => {
 const faced={stats:['rushing_yards','rush_attempts'],rows:[
  {values:{rushing_yards:50,rush_attempts:18},base:{rushing_yards:100,rush_attempts:20},lines:{rushing_yards:44.5}},
  {values:{rushing_yards:80,rush_attempts:15},base:{rushing_yards:60,rush_attempts:15},lines:{}},
  {values:{rushing_yards:30,rush_attempts:9},base:{},lines:{}}]};
 assert.equal(beat(faced.rows[0],'rushing_yards'),true);     // over his 44.5 line, though under his average
 assert.equal(beat(faced.rows[1],'rush_attempts'),null);     // level with his average: no call
 assert.deepEqual(facedTally(faced),[{stat:'rushing_yards',beat:2,of:2},{stat:'rush_attempts',beat:0,of:1}]);
});

test('metric values keep their format', () => {
 assert.equal(metricValue({format:'int',value:504}),'504');
 assert.equal(metricValue({format:'pct',value:0.794}),'79.4%');
 assert.equal(metricValue({format:'1',value:6}),'6.0');
 assert.equal(metricValue({format:'signed',value:-0.0312}),'−0.03');
 assert.equal(metricValue({format:'signedPct',value:0.013}),'+1.3%');
 assert.equal(metricValue({format:'1',value:null}),'—');
});
