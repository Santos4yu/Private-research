import test from 'node:test';
import assert from 'node:assert/strict';
import {applyNhlHistory,normalizeFinderRows} from '../src/unified-finder-data.js';
import {nhlChart,playerGames,seasonLabel,withWithout} from '../src/sports/nhl/nhl-stats.js';

// A team log as nhl_research.team_log returns it: CAR's games, each with its
// players' lines.
const game=(gameId,date,opponent,players,seasonKind='regular',season='20252026')=>({gameId,date,opponent,players,seasonKind,season,team:'CAR',isHome:true,result:'W',score:'3-2'});
const log={team:'CAR',players:{'1':{name:'Jordan Staal',pos:'C'},'2':{name:'Seth Jarvis',pos:'C'}},games:[
 game('a','2026-03-01','BOS',{'2':{sog:1}}),
 game('b','2026-03-03','FLA',{'1':{sog:2,goals:0},'2':{sog:4}}),
 game('c','2026-03-05','NYR',{'2':{sog:3}}),
 game('d','2026-03-07','FLA',{'1':{sog:4,goals:1}}),
 game('e','2026-09-22','CHI',{'1':{sog:1,goals:0},'2':{sog:2}},'preseason','20262027'),
]};

test('a player\'s games start at his first appearance and the ones he sat are DNP',()=>{
 const rows=playerGames(log,'1');
 assert.deepEqual(rows.map(row=>[row.gameId,row.dnp]),[['b',false],['c',true],['d',false],['e',false]]);
 assert.equal(rows[1].values.sog,undefined);
});

test('the chart skips DNP games and names seasons the hockey way',()=>{
 const chart=nhlChart(playerGames(log,'1'),'sog','FLA');
 assert.deepEqual(chart.all.map(game=>[game.value,game.season,game.seasonKind]),[[2,'2025-26','regular'],[4,'2025-26','regular'],[1,'2026-27','preseason']]);
 assert.deepEqual(chart.h2h.map(game=>game.value),[2,4]);
 assert.equal(seasonLabel('20262027'),'2026-27');
});

test('with / without a teammate covers the player\'s own games',()=>{
 const split=withWithout(log,'1','sog')['2'];
 assert.deepEqual(split.with.gameIds,['b','e']);
 assert.deepEqual(split.without.gameIds,['d']);
 assert.equal(split.with.avg,1.5);
});

test('NHL rows carry the game, the player\'s NHL id and export as NHL picks',()=>{
 const [row]=normalizeFinderRows('nhl',{rows:[{id:'pp:1',player:'Jordan Staal',playerId:'1',team:'CAR',opponent:'FLA',stat:'Shots On Goal',
  marketKey:'shotsongoal',valueKey:'sog',line:1.5,modifier:'standard',startsAt:'2099-01-01T00:00:00Z',gameId:'2026010080',homeTeamAbbr:'CAR',awayTeamAbbr:'FLA',
  apps:[{key:'prizepicks',name:'PrizePicks'}]}]});
 assert.equal(row.sport,'nhl');
 assert.equal(row.historyStatus,'pending');
 assert.equal(row.valueKey,'sog');
 // A line the board could not match to a player has no history to load.
 const [unmatched]=normalizeFinderRows('nhl',{rows:[{id:'pp:2',player:'New Guy',playerId:null,team:'CAR',stat:'Hits',marketKey:'hits',valueKey:'hits',line:0.5,startsAt:'2099-01-01T00:00:00Z'}]});
 assert.equal(unmatched.historyStatus,'none');
});

test('NHL hit rates come from the player\'s own games, DNP left out',()=>{
 const row={id:'nhl:1',sport:'nhl',player:'Jordan Staal',playerId:'1',opponent:'FLA',valueKey:'sog',line:1.5,direction:'OVER',apps:[]};
 const ready=applyNhlHistory(row,log);
 assert.equal(ready.historyStatus,'ready');
 assert.deepEqual([ready.windows.l5.hits,ready.windows.l5.decisions],[2,3]);
 assert.deepEqual([ready.windows.h2h.hits,ready.windows.h2h.decisions],[2,2]);
 // The latest season only: the one preseason game.
 assert.deepEqual([ready.windows.season.hits,ready.windows.season.decisions],[0,1]);
 assert.equal(ready.streak,-1);
 assert.equal(applyNhlHistory({...row,valueKey:null},log).historyStatus,'unavailable');
});

test('a busy NHL answer is waited out, then asked again', async () => {
  const {patientRequest} = await import('../src/unified-finder-data.js');
  const answers = [{status: 503, body: {error: 'NHL data is temporarily unavailable.', retryAfter: 0.01}}, {status: 200, body: {games: [1]}}];
  const asked = [];
  const fetcher = async url => { asked.push(url); const next = answers.shift(); return {ok: next.status === 200, json: async () => next.body}; };
  assert.deepEqual(await patientRequest('/api/board?view=nhl&resource=log&team=BOS', {fetcher}), {games: [1]});
  assert.equal(asked.length, 2);
  // Any other failure is not asked again.
  const failing = async () => ({ok: false, json: async () => ({error: 'Unknown team or game.'})});
  await assert.rejects(patientRequest('/x', {fetcher: failing}), /Unknown team/);
});

test('a goalie\'s row says how often he gets the net, never that tonight is confirmed',async()=>{
 const {matchupCase}=await import('../src/slip-matchup.js');
 const {readPick}=await import('../src/slip-analyst.js');
 // Tonight's game is a few hours away; CAR's last eight came every other day up to last night.
 const startsAt=new Date(Date.now()+6*3600e3);
 const dates=[15,13,11,9,7,5,3,1].map(days=>new Date(startsAt.getTime()-days*86400e3).toISOString().slice(0,10));
 const goalie=(index,starter)=>({saves:24+index,shots_against:26+index,ga:2,toi:starter?60:0,starter});
 // Andersen starts six of eight, the last one included; Kochetkov the other two.
 const games=dates.map((date,index)=>game(`g${index}`,date,'BOS',index===2||index===5?{'31':goalie(index,false),'52':goalie(index,true)}:{'31':goalie(index,true)}));
 const goalies={team:'CAR',players:{'31':{name:'Frederik Andersen',pos:'G'},'52':{name:'Pyotr Kochetkov',pos:'G'}},games};
 const [line]=normalizeFinderRows('nhl',{rows:[{id:'pp:9',player:'Frederik Andersen',playerId:'31',team:'CAR',opponent:'BOS',position:'G',stat:'Goalie Saves',
  marketKey:'goaliesaves',valueKey:'saves',line:24.5,modifier:'standard',startsAt:startsAt.toISOString(),homeTeamAbbr:'CAR',awayTeamAbbr:'BOS',
  apps:[{key:'prizepicks',name:'PrizePicks'}]}]});
 const row=applyNhlHistory(line,goalies);
 assert.deepEqual(row.goalieStarts,{started:6,of:8,last:true,lastDate:dates.at(-1)});
 const {facts}=matchupCase({row,side:'OVER'},{});
 const starts=facts.find(item=>item.key==='starts');
 assert.match(starts.text,/^Started 6 of CAR's last 8 games, including the last one; tonight's starter isn't confirmed here$/);
 assert.equal(starts.impact,0);
 // He started last night: the second night of a back-to-back.
 const read=readPick(row,'OVER',{records:{}});
 assert.ok(read.risks.includes('Started last night: teams usually start the backup on the second night'),JSON.stringify(read.risks));
});
