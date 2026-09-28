import test from 'node:test';
import assert from 'node:assert/strict';
import {finderWindow,normalizeFinderRows,applyMlbHistory,enrichMlbRows,loadFinderSport,finderSlipProp} from '../src/unified-finder-data.js';

test('pushes are excluded, missing values stay missing, and Under reverses the outcome',()=>{
 assert.equal(finderWindow([null,undefined,'',0,2,3],2).hitRate,50);
 assert.equal(finderWindow([0,1,2,3],2,'UNDER').hits,2);
 assert.equal(finderWindow([2,2],2).hitRate,null);
 assert.equal(finderWindow([],2).average,null);
});
test('NFL preserves exact posted direction and L10 average, not the L20 average',()=>{
 const raw={playerId:'test',playerName:'Test Player',propType:'receiving_yards',teamId:'SEA',gameId:'2026_test',startsAt:'2099-09-01T00:00:00Z',average:99,line:{verified:true,bookmaker:'prizepicks',category:'STANDARD',value:50,direction:'UNDER',price:-110},windows:{l10:{sample:10,hits:7,misses:3,hitRate:70,average:40}}};
 const [row]=normalizeFinderRows('nfl',{rows:[raw]},[{id:'test',headshot_url:'test-photo'}]);
 assert.equal(row.average,40);assert.equal(row.diff,10);assert.equal(row.direction,'UNDER');assert.equal(row.apps[0].under,-110);assert.equal(row.apps[0].over,null);assert.equal(row.headshot,'test-photo');assert.equal(row.playerObject.id,'test');
 assert.equal(normalizeFinderRows('nfl',{rows:[{...raw,line:{...raw.line,verified:false}}]}).length,0);
});
test('finished games are omitted and IDs remain separate across sports',()=>{
 assert.equal(normalizeFinderRows('wnba',{rows:[{id:'a',player:'Test',line:1,startsAt:'2000-01-01'}]}).length,0);
 const [row]=normalizeFinderRows('wnba',{rows:[{id:'a',player:'Test',line:1,startsAt:'2099-01-01',teamAbbr:'A',homeTeamAbbr:'A',awayTeamAbbr:'B'}]});
 assert.equal(row.id,'wnba:a');assert.equal(row.opponent,'B');assert.equal(row.windows.l10,null);
});
test('MLB computes history from complete game values and keeps season separate',()=>{
 const [row]=normalizeFinderRows('mlb',{props:[{id:'x',player:'Test Batter',stat:'Hits',line:1.5}]});
 const payload={season:2026,player:{id:123},matchup:{opponent:{id:2,name:'Opponent'}},games:[{date:'2025-09-01',opponent:{id:2},stat:{hits:3}},{date:'2026-09-01',opponent:{id:2},stat:{hits:0}},{date:'2026-09-02',opponent:{id:3},stat:{}},{date:'2026-09-03',opponent:{id:2},stat:{hits:2}}]};
 const result=applyMlbHistory(row,payload);
 assert.equal(result.windows.l10.sample,3);assert.equal(result.windows.season.sample,2);assert.equal(result.windows.season.hitRate,50);assert.equal(result.streak,1);assert.equal(result.playerId,123);assert.equal(result.historyStatus,'ready');
});
test('MLB player history is shared across lines and failures remain unknown',async()=>{
 const rows=normalizeFinderRows('mlb',{props:[{id:'a',player:'Shared Test',stat:'Hits',line:.5},{id:'b',player:'Shared Test',stat:'Hits',line:1.5}]});
 let calls=0;const batches=[];
 const result=await enrichMlbRows(rows,{fetcher:async()=>{calls++;return {ok:true,json:async()=>({season:2026,player:{id:123},games:[{date:'2026-09-01',stat:{hits:1}}]})};},onRows:b=>batches.push(b)});
 assert.equal(calls,1);assert.equal(batches.length,1);assert.equal(result[0].windows.l10.hitRate,100);assert.equal(result[1].windows.l10.hitRate,0);
 const failed=await enrichMlbRows(normalizeFinderRows('mlb',{props:[{id:'c',player:'Unavailable Test',stat:'Hits',line:.5}]}),{fetcher:async()=>{throw new Error('offline');}});
 assert.equal(failed[0].historyStatus,'unavailable');assert.equal(failed[0].windows.l10,null);
});
test('NFL uses the server-built PrizePicks board and roster endpoints without a browser scan',async()=>{
 const urls=[];await loadFinderSport('nfl',{season:2026,fetcher:async url=>{urls.push(url);return {ok:true,json:async()=>({data:[]})};}});
 assert.deepEqual(urls.sort(),['/api/nfl?resource=finder-board&season=2026','/api/nfl?resource=players&season=2026']);
});
test('NFL rows show every PrizePicks market under its own name',()=>{
 const line=(propType,propLabel)=>({playerId:'00-1',playerName:'Chris Boswell',position:'K',propType,propLabel,teamId:'PIT',opponentId:'CLE',gameId:'g',startsAt:'2099-01-01T00:00:00Z',
  line:{verified:true,bookmaker:'prizepicks',platform:'PrizePicks',category:'GOBLIN',value:7.5,direction:'OVER',price:null}});
 const rows=normalizeFinderRows('nfl',{data:[line('kicking_points','Kicking Points'),line('pp:puntsdowned','Punts Downed'),line('passing_yards',undefined)],events:[]});
 assert.deepEqual(rows.map(row=>[row.marketKey,row.market,row.modifier]),[['kicking_points','Kicking Points','goblin'],['pp:puntsdowned','Punts Downed','goblin'],['passing_yards','Passing Yards','goblin']]);
});
test('a Finder row becomes a My Slip pick the PrizePicks export can match',()=>{
 const [wnba]=normalizeFinderRows('wnba',{rows:[{id:'e1:player_threes:Kelsey Plum:2.5',player:'Kelsey Plum',market:'3-Pointers Made',line:2.5,modifier:'goblin',startsAt:'2099-01-01T00:00:00Z',teamAbbr:'LV',homeTeamAbbr:'LV',awayTeamAbbr:'IND',teamLogo:'lv.png',apps:[{key:'prizepicks',over:-137},{key:'draftkings',name:'DraftKings',over:-120,under:-105}]}]});
 const pick=finderSlipProp(wnba);
 assert.equal(pick.id,'finder:wnba:e1:player_threes:Kelsey Plum:2.5');assert.equal(pick.finderId,wnba.id);assert.equal(pick.source,'finder');
 assert.equal(pick.sport,'WNBA');assert.equal(pick.betType,'3-Pointers Made');assert.equal(pick.exportStat,'3-Pointers Made');
 assert.equal(pick.side,'Over');assert.equal(pick.modifier,'goblin');assert.equal(pick.teamLogo,'lv.png');assert.equal(pick.startsAt,'2099-01-01T00:00:00Z');
 assert.deepEqual(pick.apps,[{key:'prizepicks',name:'PrizePicks',over:-137,under:null},{key:'draftkings',name:'DraftKings',over:-120,under:-105}]);
 // Only what the Pick Builder shows is kept, so localStorage stays small.
 assert.equal(pick.raw,undefined);assert.equal(pick.windows,undefined);
 // MLB picks export under PrizePicks' own stat name, not the Finder label.
 const [mlb]=normalizeFinderRows('mlb',{props:[{id:'9001',player:'Aaron Judge',stat:'Hitter Fantasy Score',line:9.5,start_time:'2099-01-01T00:00:00Z'}]});
 const mlbPick=finderSlipProp(mlb);
 assert.equal(mlbPick.sport,'MLB');assert.equal(mlbPick.betType,'Fantasy Score');assert.equal(mlbPick.exportStat,'Hitter Fantasy Score');
});
