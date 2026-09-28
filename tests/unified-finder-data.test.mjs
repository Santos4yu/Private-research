import test from 'node:test';
import assert from 'node:assert/strict';
import {applySoccerHistory,finderWindow,normalizeFinderRows,applyMlbHistory,enrichMlbRows,loadFinderSport,finderSlipProp,bookProbability,powerDevig,defenseRank,withDefense,trendPickRow} from '../src/unified-finder-data.js';

test('book chance comes from the books\' prices with the margin removed, never a fixed 50/50',()=>{
 // PrizePicks' payouts and an app quoting the same price both ways say nothing.
 assert.equal(bookProbability([{key:'prizepicks',over:-137,under:-137},{key:'underdog',over:-122,under:-122}]),null);
 // DraftKings -122 / -111 with the margin removed.
 const dk=bookProbability([{key:'prizepicks',over:-137,under:-137},{key:'draftkings',name:'DraftKings',over:-122,under:-111}]);
 assert.equal(dk.over.toFixed(1),'51.2');
 assert.equal((dk.over+dk.under).toFixed(6),'100.000000');
 assert.deepEqual(dk.books.map(book=>[book.name,book.twoSided,book.weight]),[['DraftKings',true,1]]);
 // A lopsided line keeps more of its chance on the favorite than scaling would (80.5%).
 assert.equal(bookProbability([{key:'hardrockbet',over:-650,under:375}]).over.toFixed(1),'84.3');
 // An Over-only alternate line still reads, as if its other side filled out a usual margin.
 const alt=bookProbability([{key:'draftkings',over:-452}]);
 assert.equal(alt.over.toFixed(1),'79.2');
 assert.equal(alt.books[0].twoSided,false);
 // Pinnacle counts three times; an Over-only quote half; a pick'em app pricing sides apart half.
 assert.equal(bookProbability([{key:'pinnacle',over:-130,under:110},{key:'draftkings',over:-110,under:-110}]).over.toFixed(1),'53.4');
 const mixed=bookProbability([{key:'hardrockbet',over:-650,under:375},{key:'draftkings',over:-1040},{key:'underdog',over:-150,under:115}]);
 assert.deepEqual(mixed.books.map(book=>book.weight),[1,0.5,0.5]);
});
test('power de-vig splits a fair line evenly and solves a^k + b^k = 1',()=>{
 assert.equal(powerDevig(0.5238,0.5238).toFixed(4),'0.5000');
 const a=0.8667,b=0.2105,fair=powerDevig(a,b),k=Math.log(fair)/Math.log(a);
 assert.equal((a**k+b**k).toFixed(6),'1.000000');
});
test('defense rank reads the opponent\'s table for the player\'s position and stat',()=>{
 const wnbaLeague={teamCount:13,dvp:{ATL:{G:{stats:{pts:{szn:[18.2,4],l5:[20,9]}}}}}};
 const wnbaRow={sport:'wnba',opponent:'ATL',position:'G',marketKey:'player_points'};
 assert.equal(defenseRank(wnbaRow,wnbaLeague),4);
 assert.equal(defenseRank({...wnbaRow,marketKey:'player_rebounds'},wnbaLeague),null);
 const nflLeague={teamCount:32,dvp:{CLE:{WR:{stats:{receptions:{szn:[5.1,27]}}},DB:{stats:{tackles_assists:{szn:[6,3]}}}}}};
 assert.equal(defenseRank({sport:'nfl',opponent:'CLE',position:'WR',marketKey:'receptions'},nflLeague),27);
 // A cornerback's tackles read the defensive-back table.
 assert.equal(defenseRank({sport:'nfl',opponent:'CLE',position:'CB',marketKey:'tackles'},nflLeague),3);
 const [ranked,plain]=withDefense([{...wnbaRow,id:1},{sport:'wnba',opponent:'SEA',position:'F',marketKey:'player_points',id:2,defense:null}],wnbaLeague);
 assert.deepEqual([ranked.defense,ranked.defenseTeams],[4,13]);
 assert.equal(plain.defense,null);
});
test('NFL rows list every app posting the line',()=>{
 const raw={id:'odds:g:00-2:receptions:4.5',playerId:'00-2',playerName:'DK Metcalf',propType:'receptions',propLabel:'Receptions',teamId:'PIT',opponentId:'CLE',gameId:'g',startsAt:'2099-09-01T00:00:00Z',
  line:{verified:true,bookmaker:'draftkings',category:'STANDARD',value:4.5,direction:'OVER',price:-125},
  apps:[{key:'draftkings',name:'DraftKings',over:-125,under:-105},{key:'williamhill_us',name:'Caesars',over:-120,under:-110}]};
 const [row]=normalizeFinderRows('nfl',{data:[raw]});
 assert.equal(row.id,'nfl:odds:g:00-2:receptions:4.5');
 assert.deepEqual(row.apps.map(app=>[app.key,app.over,app.under]),[['draftkings',-125,-105],['williamhill_us',-120,-110]]);
 assert.equal(bookProbability(row.apps).books.length,2);
});
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
test('the trend star saves the line on screen, or that market\'s nearest posted line',()=>{
 const rows=[{id:'a',marketKey:'receptions',market:'Receptions',line:3.5},{id:'b',marketKey:'receptions',market:'Receptions',line:1.5,modifier:'goblin'},
  {id:'c',marketKey:'targets',market:'Targets',line:6.5}];
 assert.equal(trendPickRow(rows,{statKey:'receptions',line:1.5}).id,'b');
 assert.equal(trendPickRow(rows,{statKey:'receptions',line:4}).id,'a');
 // MLB panels name the market by its label.
 assert.equal(trendPickRow(rows,{stat:'Targets',line:9}).id,'c');
 assert.equal(trendPickRow(rows,{statKey:'rushing_yards',line:40}),null);
});

test('soccer rows carry PrizePicks\' own stat and tier, and export as SOCCER picks',async()=>{
 const payload={builtAt:'2026-09-28T12:00:00Z',rows:[
  {id:'pp:5001',player:'Bukayo Saka',team:'ARS',opponent:'CHE',position:'M',headshot:null,stat:'Shots On Target',marketKey:'shotsontarget',line:1.5,modifier:'standard',startsAt:'2026-09-28T19:00:00+00:00',apps:[{key:'prizepicks',name:'PrizePicks',over:null,under:null}]},
  {id:'pp:5002',player:'Bukayo Saka',team:'ARS',opponent:'CHE',position:'M',stat:'Shots On Target',marketKey:'shotsontarget',line:0.5,modifier:'goblin',startsAt:'2026-09-28T19:00:00+00:00',apps:[]},
  {id:'pp:5003',player:'Old Match',stat:'Shots',line:2.5,startsAt:'2026-09-28T11:00:00+00:00'},
 ]};
 const rows=normalizeFinderRows('soccer',payload,[],{now:Date.parse('2026-09-28T12:00:00Z')});
 assert.deepEqual(rows.map(row=>[row.id,row.market,row.line,row.modifier]),[['soccer:pp:5001','Shots On Target',1.5,'standard'],['soccer:pp:5002','Shots On Target',0.5,'goblin']]);
 assert.equal(rows[0].historyStatus,'none');
 assert.ok(Object.values(rows[0].windows).every(window=>window===null));
 assert.deepEqual(rows[1].apps.map(app=>app.key),['prizepicks']);
 const pick=finderSlipProp(rows[0]);
 assert.deepEqual([pick.sport,pick.exportStat,pick.team,pick.opponent],['SOCCER','Shots On Target','ARS','CHE']);
 const urls=[];
 const loaded=await loadFinderSport('soccer',{fetcher:async url=>{urls.push(url);return {ok:true,json:async()=>payload};}});
 assert.deepEqual(urls,['/api/board?view=soccer']);
 assert.equal(loaded.fetchedAt,'2026-09-28T12:00:00Z');
});

test('soccer hit rates come from the player\'s own matches in his team\'s log',()=>{
 const game=(id,date,opponent,isHome,shots,name='Bukayo Saka')=>({id,date,isHome,opponent:{abbr:opponent},result:'W',score:'1-0',teamStats:{},oppStats:{},
  players:[{id:'2',name,pos:'F',min:90,starter:true,s:{shots,sot:1,goals:0,ast:0}},{id:'9',name:'Someone Else',pos:'M',min:90,starter:true,s:{shots:9}}]});
 const log={games:[game('1','2026-05-01T15:00Z','CHE',true,4),game('2','2026-08-20T15:00Z','LIV',false,1),game('3','2026-08-27T15:00Z','CHE',true,3),
  // Not in the squad that day: the match doesn't count for him.
  {...game('4','2026-09-03T15:00Z','TOT',false,0),players:[]},game('5','2026-09-10T15:00Z','AVL',true,2,'B. Saka')]};
 const [row]=normalizeFinderRows('soccer',{rows:[{id:'pp:1',player:'Bukayo Saka',team:'ARS',opponent:'CHE',stat:'Shots',marketKey:'shots',line:2.5,
  startsAt:'2026-09-29T14:00:00Z',eventId:'900',teamId:'359',competition:'eng.1'}]},[],{now:Date.parse('2026-09-28T12:00:00Z')});
 assert.equal(row.historyStatus,'pending');
 const ready=applySoccerHistory(row,log);
 // 4, 1, 3, 2 over 2.5: two of four; vs CHE both; this season (from July) 1, 3, 2.
 assert.deepEqual([ready.windows.l5.hits,ready.windows.l5.decisions],[2,4]);
 assert.deepEqual([ready.windows.h2h.hits,ready.windows.h2h.decisions],[2,2]);
 assert.deepEqual([ready.windows.season.hits,ready.windows.season.decisions],[1,3]);
 assert.equal(ready.streak,-1);
 assert.equal(ready.average,2.5);
 // A stat ESPN doesn't publish has no history rather than zeros.
 const passes=applySoccerHistory({...row,marketKey:'passesattempted'},log);
 assert.equal(passes.historyStatus,'unavailable');
});

test('the soccer chart draws shots faced behind saves and carries league and team for its filters',async()=>{
 const {soccerChart,mergeGames}=await import('../src/sports/soccer/soccer-stats.js');
 const game=(gameId,date,teamName,s)=>({gameId,date,season:'2026',opponent:'CHE',isHome:true,leagueName:'Premier League',teamName,s});
 const club=[game('1','2026-08-20T15:00Z','Liverpool',{saves:4,sotf:6}),game('2','2026-09-13T15:00Z','Liverpool',{saves:3,sotf:3})];
 const country=[game('3','2026-09-05T15:00Z','Georgia',{saves:5,sotf:7}),game('1','2026-08-20T15:00Z','Liverpool',{saves:4,sotf:6})];
 const games=mergeGames(country,club);
 assert.deepEqual(games.map(item=>item.gameId),['1','3','2']);
 const chart=soccerChart(games,'saves','CHE');
 assert.deepEqual(chart.all.map(item=>[item.value,item.context,item.team]),[[4,6,'Liverpool'],[5,7,'Georgia'],[3,3,'Liverpool']]);
 assert.equal(chart.all[0].contextLabel,'faced');
 assert.equal(chart.all[0].league,'Premier League');
 // Shots on target sit in front of shots; goals have no context bar.
 assert.equal(soccerChart([game('4','2026-09-01T15:00Z','Arsenal',{sot:2,shots:5})],'sot').all[0].context,5);
 assert.equal(soccerChart([game('4','2026-09-01T15:00Z','Arsenal',{goals:1,shots:5})],'goals').all[0].context,undefined);
});

test('a teammate\'s with / without split covers the player\'s own matches for his team',async()=>{
 const {teammateSplit,squad,applySplits,toggleSplit}=await import('../src/sports/soccer/soccer-stats.js');
 const game=(id,names)=>({id,date:`2026-09-0${id}T15:00Z`,players:names.map(name=>({id:name==='Bukayo Saka'?'2':'3',name,pos:'M',min:90,s:{}}))});
 const log={games:[game('1',['Bukayo Saka','Martin Odegaard']),game('2',['Bukayo Saka']),game('3',['Bukayo Saka','Martin Odegaard']),game('4',['Martin Odegaard'])]};
 // Saka's matches: 1, 2, 3 (he missed 4), plus a club match from elsewhere.
 const games=[{gameId:'1'},{gameId:'2'},{gameId:'3'},{gameId:'club-9'}];
 const split=teammateSplit(log,games,{name:'Martin Odegaard'});
 assert.deepEqual(split,{with:['1','3'],without:['2']});
 assert.deepEqual(squad(log).map(player=>[player.name,player.games]),[['Bukayo Saka',3],['Martin Odegaard',3]]);
 const filters=toggleSplit([], {id:'3',kind:'without',name:'Martin Odegaard',ids:split.without});
 assert.deepEqual(applySplits(games,filters).map(game=>game.gameId),['2']);
 assert.deepEqual(toggleSplit(filters,{id:'3',kind:'without',ids:[]}),[]);
});
