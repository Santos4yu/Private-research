import test from 'node:test';
import assert from 'node:assert/strict';
import {cardText,combined} from '../src/game-share.js';
import {colorGap,gameClockText,inkOn,keyInjuries,liveText,marketNote,pairColors,readGuide,steadySince} from '../src/game-predictor-core.js';
import {americanOf,boardLegs,cents,chartFrame,chartPath,moneyText,sideSeries,winOf,dayKey,dayLabel,dayOptions,groupByDay,mergeBoards,byText,decimal,evText,gamePicks,likeliest,lineText,odds,parlays,paysText,pct,pull,recordText,resultOf,startText,twoCalls,unitsText,valueRows} from '../src/game-predictor-core.js';

const game={home:{abbr:'DEN',short:'Nuggets'},away:{abbr:'BOS',short:'Celtics'}};

test('numbers read plainly',()=>{
 assert.equal(pct(0.613),'61%');
 assert.equal(pct(null),'—');
 assert.equal(odds(150),'+150');
 assert.equal(odds(-190),'-190');
 assert.equal(odds(null),'—');
});

test('the line names the favorite',()=>{
 assert.equal(lineText({...game,line:{spread:-6.5,total:231.5}}),'DEN -6.5 · O/U 231.5');
 assert.equal(lineText({...game,line:{spread:3,total:null}}),'BOS -3.0');
 assert.equal(lineText({...game,line:null}),'');
});

test('a factor points at the team it helps',()=>{
 assert.deepEqual(pull(3.84,game),{side:'home',text:'+3.8 DEN'});
 assert.deepEqual(pull(-12.04,game),{side:'away',text:'+12 BOS'});
 assert.deepEqual(pull(0,game),{side:null,text:'Even'});
 assert.equal(byText(-5.5,game),'BOS by 5.5');
 assert.equal(byText(6.5,game),'DEN by 6.5');
});

test('the record and each result',()=>{
 assert.equal(recordText({games:17,correct:12,pct:12/17}),'12-5 · 71%');
 assert.equal(recordText({games:0}),null);
 assert.equal(resultOf({result:null}),'pending');
 assert.equal(resultOf({result:{winner:'home',correct:true}}),'win');
 assert.equal(resultOf({result:{winner:'away',correct:false}}),'loss');
});

test('each moneyline\'s value, away first',()=>{
 const prediction={...game,ev:{blend:{home:{price:-190,chance:0.62,ev:-0.0537,fair:-163},away:{price:160,chance:0.38,ev:-0.012,fair:163}},
  ours:{home:{price:-190,chance:0.7,ev:0.0684}},best:null}};
 const rows=valueRows(prediction);
 assert.deepEqual(rows.map(row=>[row.side,row.price,row.chance,row.text,row.fair,row.ours,row.best]),
  [['away','+160','38%','−1.2%','+163',null,false],['home','-190','62%','−5.4%','-163','+6.8%',false]]);
 assert.deepEqual(valueRows({...game}),[]);
 assert.equal(evText(0.032),'+3.2%');
 assert.equal(unitsText(1.43),'+1.4 units');
 assert.equal(unitsText(-2),'−2 units');
 assert.equal(unitsText(-1),'−1 unit');
});

test('two predictions only when the line and ours both count',()=>{
 const ours={winner:'home',margin:6},blend={winner:'home',margin:5,weight:0.25};
 assert.equal(twoCalls({predictions:{ours,blend}}).share,'25% ours');
 assert.equal(twoCalls({predictions:{ours,blend:{...blend,weight:1}}}),null);
 assert.equal(twoCalls({predictions:{ours:null,blend}}),null);
});

test('start times say today and tomorrow',()=>{
 const now=new Date(2026,10,5,12,0);
 assert.match(startText(new Date(2026,10,5,19,30).toISOString(),now),/^Today 7:30/);
 assert.match(startText(new Date(2026,10,6,19,30).toISOString(),now),/^Tomorrow /);
 assert.equal(startText('nope',now),'');
});

// Four games: two big favorites, a coin flip, and one held back (no moneyline).
const board={games:[
 {id:'1',home:{abbr:'BOS'},away:{abbr:'WSH'},chance:{home:0.85,away:0.15},prices:{home:-600,away:450},confidence:'High'},
 {id:'2',home:{abbr:'DEN'},away:{abbr:'UTAH'},chance:{home:0.78,away:0.22},prices:{home:-400,away:320},confidence:'High'},
 {id:'3',home:{abbr:'MIA'},away:{abbr:'NY'},chance:{home:0.52,away:0.48},prices:{home:-110,away:-110},confidence:'Low'},
 {id:'4',home:{abbr:'LAL'},away:{abbr:'GS'},chance:{home:0.6,away:0.4},prices:{home:null,away:null},held:'No moneyline yet'}]};

test('moneylines as payouts',()=>{
 assert.equal(decimal(-150).toFixed(3),'1.667');
 assert.equal(decimal(130),2.3);
 assert.equal(decimal(50),null);
 assert.equal(americanOf(2.6),160);
 assert.equal(americanOf(1.5),-200);
 assert.equal(paysText(2.4333),'2.43x');
 assert.equal(paysText(3),'3x');
});

test('the most likely winners, one side a game, held games left out',()=>{
 assert.equal(boardLegs(board).length,6);
 assert.deepEqual(likeliest(board).map(leg=>[leg.team.abbr,leg.chance]),[['BOS',0.85],['DEN',0.78],['MIA',0.52]]);
});

test('every game with our pick and chance, most likely first, games without a line too',()=>{
 const picks=gamePicks(board);
 assert.deepEqual(picks.map(leg=>[leg.team.abbr,leg.chance,leg.price]),[['BOS',0.85,-600],['DEN',0.78,-400],['LAL',0.6,null],['MIA',0.52,-110]]);
 assert.equal(picks[2].ev,null);
});

test('parlays: exactly two legs, the most likely first',()=>{
 const [best]=parlays(board,{legs:2});
 assert.deepEqual(best.legs.map(leg=>leg.team.abbr),['BOS','DEN']);
 assert.equal(best.chance.toFixed(4),(0.85*0.78).toFixed(4));
 assert.equal(best.dec.toFixed(4),((1+100/600)*(1+100/400)).toFixed(4));
 assert.equal(best.ev.toFixed(4),(0.85*0.78*best.dec-1).toFixed(4));
});

test('parlays: paying at least 2x, two to four legs, never two sides of one game',()=>{
 const found=parlays(board,{payout:2,top:20});
 assert.ok(found.length>0);
 for(const combo of found){
  assert.ok(combo.dec>=2,combo.dec);
  assert.ok(combo.legs.length>=2&&combo.legs.length<=4);
  assert.equal(new Set(combo.legs.map(leg=>leg.game)).size,combo.legs.length);
 }
 // BOS and DEN pay only 1.46x; BOS and MIA pay 2.23x at 44%, likelier than all three (35%).
 assert.deepEqual(found[0].legs.map(leg=>leg.team.abbr),['BOS','MIA']);
 assert.equal(found[0].chance.toFixed(3),(0.85*0.52).toFixed(3));
 for(let index=1;index<found.length;index++)assert.ok(found[index-1].chance>=found[index].chance);
 // Best value: the highest average return first.
 const value=parlays(board,{payout:2,sort:'value',top:20});
 for(let index=1;index<value.length;index++)assert.ok(value[index-1].ev>=value[index].ev);
 // Nothing on these games pays 1000x.
 assert.deepEqual(parlays(board,{payout:1000}),[]);
});

test('the generator\'s days and the slate by day',()=>{
 const now=new Date(2026,10,6,15,0);
 const days=dayOptions(now,4);
 assert.deepEqual(days.map(day=>[day.key,day.top]),[['20261106','Today'],['20261107','Tomorrow'],['20261108','Sun'],['20261109','Mon']]);
 assert.equal(days[2].date,'Nov 8');
 assert.equal(dayKey(new Date(2026,0,5)),'20260105');
 const at=(day,hour)=>new Date(2026,10,day,hour).toISOString();
 assert.equal(dayLabel(at(6,19),now),'Today');
 assert.equal(dayLabel(at(7,19),now),'Tomorrow');
 assert.equal(dayLabel(at(9,13),now),'Monday, Nov 9');
 const grouped=groupByDay([{id:'b',startsAt:at(7,19)},{id:'a',startsAt:at(6,20)},{id:'c',startsAt:at(6,19)}],now);
 assert.deepEqual(grouped.map(day=>[day.label,day.games.map(game=>game.id)]),[['Today',['c','a']],['Tomorrow',['b']]]);
});

test('both leagues on one board, each leg keeping its league',()=>{
 const both=mergeBoards([{sport:'nba',games:[board.games[0]]},{sport:'nfl',games:[{...board.games[1],id:'9'}]}]);
 assert.deepEqual(both.games.map(game=>game.sport),['nba','nfl']);
 const [best]=parlays(both,{legs:2});
 assert.deepEqual(best.legs.map(leg=>leg.sport),['nba','nfl']);
});

test('a parlay between the two sports: a leg from each league, never one league alone',()=>{
 const nba=board.games.map(game=>({...game,id:`n${game.id}`}));
 const both=mergeBoards([{sport:'nba',games:nba},{sport:'nfl',games:[{...board.games[1],id:'9'}]}]);
 const found=parlays(both,{legs:2,mixed:true,top:50});
 assert.ok(found.length>0);
 for(const combo of found)assert.deepEqual([...new Set(combo.legs.map(leg=>leg.sport))].sort(),['nba','nfl']);
 // Unmixed, NBA-only pairs are allowed; mixed with one league on the board, none.
 assert.ok(parlays(both,{legs:2,top:50}).some(combo=>combo.legs.every(leg=>leg.sport==='nba')));
 assert.deepEqual(parlays(mergeBoards([{sport:'nba',games:nba}]),{legs:2,mixed:true}),[]);
 // The same game id in two leagues is two games.
 const twins=mergeBoards([{sport:'nba',games:[board.games[0]]},{sport:'nfl',games:[board.games[0]]}]);
 assert.equal(parlays(twins,{legs:2,mixed:true}).length>0,true);
});

test('prices in cents, payouts and money',()=>{
 assert.equal(cents(0.634),'63¢');
 assert.equal(winOf(20,160),32);
 assert.equal(winOf(100,-200),50);
 assert.equal(winOf(0,-200),null);
 assert.equal(moneyText(32),'$32');
 assert.equal(moneyText(1250.5),'$1,250.50');
 assert.equal(moneyText(32,true),'+$32');
 assert.equal(moneyText(-20,true),'−$20');
});

test('the chart: one side\'s view, its frame and a step line',()=>{
 const series=sideSeries([[0,0.6],[10,0.62],[20,0.58]],'away');
 assert.deepEqual(series.map(point=>point[1].toFixed(2)),['0.40','0.38','0.42']);
 const frame=chartFrame([series],[0.45]);
 assert.equal(frame.start,0);assert.equal(frame.end,20);
 assert.ok(frame.low<=0.38&&frame.high>=0.45&&frame.high-frame.low>=0.1);
 assert.ok(frame.lines.every(value=>value>=frame.low&&value<=frame.high));
 const path=chartPath(series,frame,200,100);
 assert.match(path,/^M0\.0 [\d.]+H100\.0V[\d.]+H200\.0V[\d.]+H200$/);
 assert.equal(chartFrame([[]]),null);
});

test('two teams never share a color',()=>{
 // ATL and WSH are both red on ESPN: the Wizards take their navy.
 assert.ok(colorGap('c8102e','e31837')<150);
 assert.deepEqual(pairColors({color:'c8102e',alt:'fdb927'},{color:'e31837',alt:'002b5c'}),{home:'c8102e',away:'002b5c'});
 // Far apart already: kept.
 assert.deepEqual(pairColors({color:'c8102e'},{color:'007a33'}),{home:'c8102e',away:'007a33'});
 // The away team's second color is black (too dark here) or close too: the home team's, else gray.
 assert.deepEqual(pairColors({color:'c8102e',alt:'fdb927'},{color:'e31837',alt:'000000'}),{home:'fdb927',away:'e31837'});
 assert.deepEqual(pairColors({color:'c8102e'},{color:'e31837'}),{home:'c8102e',away:'a3a3a3'});
 assert.deepEqual(pairColors({color:null},{color:'e31837'}),{home:null,away:'e31837'});
});

test('only the injuries that matter',()=>{
 const nba=[{name:'Star',impact:2.4,out:true},{name:'Maybe',impact:1.2,out:false},{name:'Bench',impact:0.3,out:true}];
 assert.deepEqual(keyInjuries(nba,'nba'),{shown:nba.slice(0,2),others:1});
 const nfl=[{name:'QB1',position:'QB',out:true},{name:'WR2',position:'WR',status:'Doubtful'},{name:'Guard',position:'G',out:true},{name:'TE',position:'TE',status:'Questionable'}];
 assert.deepEqual(keyInjuries(nfl,'nfl').shown.map(player=>player.name),['QB1','WR2']);
 assert.equal(keyInjuries(null,'nba').others,0);
});

test('how to read the numbers, with the game\'s own',()=>{
 const prediction={home:{abbr:'ATL'},away:{abbr:'WSH'},winner:'home',chance:{home:0.71,away:0.29},
  market:{chance:{home:0.6,away:0.4},moneyline:{home:-200,away:170},spread:-6.5,total:230.5}};
 const chart={now:{market:0.68,moneyline:{home:-241,away:199}}};
 const rows=Object.fromEntries(readGuide(prediction,chart).map(row=>[row.term,row.text]));
 // The chart's price now beats the prediction's older one.
 assert.match(rows['The % and the ¢ price'],/ATL at 68¢ means the betting market expects ATL to win about 68 times out of 100/);
 assert.equal(rows['Moneyline (-241 / +199)'],'Minus means favorite, plus means underdog. ATL -241: you risk $241 to win $100. WSH +199: $100 wins $199.');
 assert.match(rows['What $10 pays'],/\$10 on ATL wins \$4\.15 \(\$14\.15 back\)\. \$10 on WSH wins \$19\.90/);
 assert.match(rows['Our pick against the price'],/We give ATL 71%; the price says 68%\. Ours is higher/);
 assert.match(rows.Spread,/ATL −6\.5: ATL has to win by more than 6\.5\. WSH \+6\.5/);
 assert.match(rows.Total,/230\.5/);
 assert.ok(rows.Value&&rows.Confidence);
 assert.deepEqual(readGuide(null),[]);
});

test('the note under a flat chart',()=>{
 const prediction={home:{abbr:'ATL'},away:{abbr:'WSH'},market:{chance:{home:0.68}}};
 const now=Date.parse('2026-11-06T16:48:00Z');
 const t=iso=>Date.parse(iso)/1000;
 const flat=[[t('2026-11-06T06:26:00Z'),0.6787],[t('2026-11-06T09:00:00Z'),0.6787],[t('2026-11-06T16:40:00Z'),0.6788]];
 assert.equal(steadySince(flat),flat[0][0]);
 assert.equal(steadySince([[1,0.6],[2,0.65],[3,0.65]]),2);
 const base={state:'pre',source:'draftkings',now:{market:0.6787,moneyline:{home:-241,away:199}},market:flat};
 // DraftKings moved off its opening price: where it opened and where it is.
 assert.equal(marketNote({...base,open:{moneyline:{home:-218,away:180}}},prediction,now),'DraftKings · ATL opened -218, now -241');
 assert.equal(marketNote({...base,open:{moneyline:{home:-241,away:199}}},prediction,now),'DraftKings · no change since it opened');
 // No opening price: how long it hasn't moved.
 assert.match(marketNote(base,prediction,now),/^DraftKings · no change since \d{1,2}:26 [AP]M$/);
 assert.equal(marketNote({...base,market:flat.slice(-1)},prediction,now),'DraftKings');
 assert.equal(marketNote({...base,state:'in'},prediction,now),null);
});

test('a team label\'s text stays readable',()=>{
 assert.equal(inkOn('c8102e'),'#ffffff');
 assert.equal(inkOn('002b5c'),'#ffffff');
 assert.equal(inkOn('fdb927'),'#141414');
 assert.equal(inkOn(null),'#ffffff');
});

test('the moneyline picture\'s words',()=>{
 const legs=[{team:{abbr:'BOS'},price:-344},{team:{abbr:'DAL'},price:-253},{team:{abbr:'SA'},price:-130}];
 const price=combined(legs);
 assert.ok(Math.abs(price.dec-(1+100/344)*(1+100/253)*(1+100/130))<1e-9);
 assert.equal(price.american,americanOf(price.dec));
 const parlay=cardText({legs,stake:25});
 assert.equal(parlay.title,'3-Pick Parlay');
 assert.equal(parlay.odds,odds(price.american));
 assert.deepEqual(parlay.money.map(row=>row[0]),['Amount','To win','Payout']);
 assert.equal(parlay.money[0][1],'$25');
 assert.equal(parlay.money[2][1],moneyText(25*price.dec));
 // A straight pick with no amount: in units.
 const straight=cardText({legs:[{team:{abbr:'DAL'},price:-253}]});
 assert.equal(straight.title,'Moneyline');
 assert.equal(straight.odds,'-253');
 assert.deepEqual(straight.money,[['Amount','1 unit'],['To win','0.40 units'],['Payout','1.40 units']]);
 assert.equal(combined([{price:null}]),null);
});

test('a live game\'s clock reads period first',()=>{
 assert.equal(liveText('54.7 - 1st'),'1st · 0:54.7');
 assert.equal(liveText('5:32 - 2nd'),'2nd · 5:32');
 assert.equal(liveText('8 - 4th'),'4th · 0:08');
 assert.equal(liveText('Halftime'),'Halftime');
 assert.equal(liveText('End of 1st'),'End of 1st');
 assert.equal(liveText(null),'');
});

test('a time into the game as its quarter and clock',()=>{
 assert.equal(gameClockText(0,'nba'),'Q1 12:00 left');
 assert.equal(gameClockText(1200,'nba'),'Q2 4:00 left');
 assert.equal(gameClockText(2880+150,'nba'),'OT 2:30 left');
 assert.equal(gameClockText(2880+300+60,'nba'),'OT2 4:00 left');
 assert.equal(gameClockText(2100,'nfl'),'Q3 10:00 left');
 assert.equal(gameClockText(null,'nba'),'');
});

test('a game\'s line stops where the game is',()=>{
 const frame={start:0,end:100,low:0,high:1};
 assert.equal(chartPath([[0,0.5],[50,0.6]],frame,100,10),'M0.0 5.0H50.0V4.0H100');
 assert.equal(chartPath([[0,0.5],[50,0.6]],frame,100,10,{toEnd:false}),'M0.0 5.0H50.0V4.0');
});

// ---- live games (Nov 8)
import {liveAlert,liveFirst,periodLeft,pickStatus,propProgress,runText,sparkPath} from '../src/game-predictor-core.js';

const teams={home:{abbr:'PHX',short:'Suns'},away:{abbr:'HOU',short:'Rockets'}};
const liveChart=(home,away,elapsed,extra={})=>({state:'in',sport:'nba',home:{abbr:'PHX',score:home},away:{abbr:'HOU',score:away},clock:{now:elapsed,length:2880},now:{live:0.53},...extra});

test('the time left in a period',()=>{
 assert.deepEqual(periodLeft(1800,'nba'),{period:3,left:360});
 assert.deepEqual(periodLeft(2880+120,'nba'),{period:5,left:180});
 assert.deepEqual(periodLeft(3000,'nfl'),{period:4,left:600});
 assert.equal(periodLeft(null,'nba'),null);
});

test('the run in words',()=>{
 assert.equal(runText({side:'home',points:9},teams,'nba'),'PHX on a 9-0 run');
 assert.equal(runText({side:'away',points:17},teams,'nfl'),'HOU has scored 17 straight');
 assert.equal(runText(null,teams,'nba'),'');
});

test('how our pick is doing',()=>{
 const prediction={...teams,winner:'away',chance:{home:0.3,away:0.7}};
 const now=pickStatus(prediction,liveChart(60,54,1800));
 assert.deepEqual([now.before,Math.round(now.now*100),now.result,now.tone],[0.7,47,'Down 6','down']);
 assert.equal(pickStatus(prediction,liveChart(54,60,1800)).result,'Up 6');
 assert.equal(pickStatus(prediction,liveChart(54,54,1800)).result,'Tied');
 const final=pickStatus(prediction,{...liveChart(104,112,2880),state:'post'});
 assert.deepEqual([final.result,final.tone,final.final],['Won 112-104','up',true]);
 assert.equal(pickStatus(prediction,{state:'pre'}),null);
});

test('the one alert worth showing',()=>{
 const prediction={...teams,market:{chance:{home:0.75,away:0.25},moneyline:{home:-300,away:240}}};
 // Close late: within 5 in the last five minutes of the 4th.
 assert.deepEqual(liveAlert('nba',liveChart(100,97,2880-120),prediction),{kind:'close',text:'Within 3 with 2:00 left'});
 assert.equal(liveAlert('nba',liveChart(100,100,2880-45),prediction).text,'Tied with 0:45 left');
 // Too early, too wide: not close.
 assert.notEqual(liveAlert('nba',liveChart(100,97,2000),prediction)?.kind,'close');
 assert.equal(liveAlert('nba',liveChart(110,97,2880-120),prediction),null);
 // A comeback: down 18 at some point, within 5 now.
 assert.deepEqual(liveAlert('nba',liveChart(70,72,2000,{feed:{lead:{home:2,away:18}}}),prediction),
  {kind:'comeback',text:'Comeback: the Suns were down 18, now within 2'});
 // The underdog ahead from the 2nd quarter.
 assert.deepEqual(liveAlert('nba',liveChart(40,46,1000),prediction),{kind:'underdog',text:'Underdog Rockets lead by 6'});
 assert.equal(liveAlert('nba',liveChart(10,16,300),prediction),null);
 // NFL: a one-score game.
 assert.equal(liveAlert('nfl',{...liveChart(20,14,3600-200),sport:'nfl',clock:{now:3600-200}},prediction).text,'One-score game with 3:20 left');
 // An upset at the end.
 assert.deepEqual(liveAlert('nba',{...liveChart(100,104,2880),state:'post'},prediction),{kind:'upset',text:'Upset: the Rockets won as +240 underdogs'});
 assert.equal(liveAlert('nba',{...liveChart(104,100,2880),state:'post'},prediction),null);
});

test('a prop against its line',()=>{
 assert.deepEqual(propProgress({now:12,line:26.5}),{share:12/26.5,hit:false,text:'Needs 15'});
 assert.equal(propProgress({now:12,line:26}).text,'Needs 15');
 assert.equal(propProgress({now:20.6,line:30.5}).text,'Needs 9.9');
 assert.deepEqual(propProgress({now:27,line:26.5}),{share:1,hit:true,text:'Hit'});
 assert.equal(propProgress({now:20,line:26.5},true).text,'Missed');
 assert.equal(propProgress({now:26,line:26},true).text,'Push');
});

test('the list\'s small chance line and the games on now first',()=>{
 assert.equal(sparkPath({points:[[0,0.5],[1440,0.75]],length:2880},'home',80,24),'M0.0 12.0 L40.0 6.0');
 assert.equal(sparkPath({points:[[0,0.5],[1440,0.75]],length:2880},'away',80,24),'M0.0 12.0 L40.0 18.0');
 assert.equal(sparkPath(null,'home',80,24),'');
 const games=[{id:'1',state:'pre',startsAt:'2026-11-08T02:00Z',home:{abbr:'PHX'},away:{abbr:'HOU'}},{id:'2',state:'pre',home:{abbr:'LAL'},away:{abbr:'BOS'}}];
 const found=liveFirst(games,{games:[{id:'1',state:'in',detail:'6:00 - 3rd',home:{score:16},away:{score:14},spark:{points:[],length:2880}}]});
 assert.deepEqual(found.live.map(game=>[game.id,game.home.score,game.away.score,game.detail,game.home.abbr]),[['1',16,14,'6:00 - 3rd','PHX']]);
 assert.deepEqual(found.rest.map(game=>game.id),['2']);
 assert.deepEqual(liveFirst(games,null).rest.length,2);
});

// ---- the History tab (Nov 8)
import {dayText,historyGroups,pickScoreText} from '../src/game-predictor-core.js';

test('picks in groups: on now, still to come, settled',()=>{
 const now=Date.parse('2026-11-08T03:00:00Z');
 const pick=(id,startsAt,side='away',result=null)=>({id,startsAt,side,result,home:{abbr:'PHX'},away:{abbr:'HOU'},chance:0.69});
 const items=[pick('1','2026-11-08T04:00:00Z'),pick('2','2026-11-08T02:00:00Z'),pick('3','2026-11-08T03:30:00Z'),
  pick('4','2026-11-06T02:00:00Z','home',{home:110,away:104,winner:'home',correct:true}),pick('5','2026-11-08T01:00:00Z')];
 const live={games:[{id:'2',state:'in',detail:'4:12 - 3rd',home:{score:78},away:{score:84},spark:{points:[[0,0.4],[1900,0.35]],length:2880}},
  {id:'5',state:'post',detail:'Final',home:{score:101},away:{score:99}}]};
 const groups=historyGroups(items,live,now);
 assert.deepEqual(groups.upcoming.map(item=>item.id),['3','1']);
 assert.deepEqual(groups.settled.map(item=>item.id),['4']);
 assert.deepEqual(groups.live.map(item=>item.id),['2','5']);
 const on=groups.live[0].live;
 assert.deepEqual([on.margin,on.away,on.home,on.detail],[6,84,78,'4:12 - 3rd']);
 assert.equal(Math.round(on.chance*100),65);
 assert.deepEqual(pickScoreText(on),{text:'Up 6',tone:'up'});
 assert.deepEqual(pickScoreText(groups.live[1].live),{text:'Lost',tone:'down'});
 // Started, but the live read hasn't come back yet: on now, no score.
 const early=historyGroups([pick('2','2026-11-08T02:00:00Z')],null,now);
 assert.deepEqual([early.live.length,early.live[0].live.margin,pickScoreText(early.live[0].live).text],[1,null,'Live']);
});

test('a pick\'s day',()=>{
 const now=new Date(2026,10,8,20,0);
 assert.equal(dayText(new Date(2026,10,8,19,0).toISOString(),now),'Today');
 assert.equal(dayText(new Date(2026,10,7,19,0).toISOString(),now),'Yesterday');
 assert.equal(dayText(new Date(2026,9,20,19,0).toISOString(),now),'Oct 20');
});

// ---- the model decides (Nov 8)
import {edgeText,valuePicks} from '../src/game-predictor-core.js';

test('value picks: where our model sees more than the market',()=>{
 const game=(id,home,away,hp,ap,chanceHome,marketHome)=>({id,home:{abbr:home},away:{abbr:away},prices:{home:hp,away:ap},
  chance:{home:chanceHome,away:1-chanceHome},market:marketHome==null?null:{home:marketHome,away:1-marketHome}});
 const board={games:[
  game('a','BOS','WSH',-650,470,0.86,0.85),   // agrees with the market: no value either side
  game('b','DEN','UTAH',-200,170,0.58,0.65),  // the model likes the underdog: UTAH 42% vs 35%
  game('c','MIA','NY',-115,-105,0.6,0.52),    // MIA 60% vs 52%
  game('d','LAL','GS',-150,130,0.7,null),     // no market chance: left out
 ]};
 const found=valuePicks(board);
 assert.deepEqual(found.map(leg=>leg.team.abbr),['UTAH','MIA']);
 assert.equal(Math.round(found[0].edge*100),7);
 assert.equal(Math.round(found[0].ev*1000),134);   // 0.42 x 2.7 - 1
 assert.equal(edgeText(0.071),'+7 pts');
 assert.equal(edgeText(-0.03),'−3 pts');
 assert.equal(edgeText(null),'');
});

test('the matchup card: the teams side by side, the better side marked, their latest games and who is out',async()=>{
 const {headToHead,matchupRows,outPoints,recentGames}=await import('../src/game-predictor-core.js');
 const prediction={sport:'nba',home:{abbr:'IND'},away:{abbr:'WSH'},
  market:{moneyline:{home:-166,away:139},open:{home:-161,away:135}},
  teams:{home:{ortg:[114.2,21],drtg:[113.0,14],last10:[2,8]},away:{ortg:[110.1,23],drtg:[115.2,17],last10:[3,7]}},
  homeInfo:{home:{home:{w:0,l:5}},away:{away:{w:2,l:5}}},rest:{home:1,away:2},
  meetings:[{home:'IND',away:'WSH',hs:100,as:108},{home:'WSH',away:'IND',hs:111,as:104}],
  recent:{home:[{opponent:'DAL',margin:-16,home:true},{opponent:'BKN',margin:27,home:false}],away:[]},
  lastFive:{WSH:[{opponent:'TOR',score:'101-111',atVs:'@',date:'2026-11-01'},{opponent:'CHI',score:'118-114',atVs:'vs',date:'2026-11-03'}]}};
 const rows=matchupRows(prediction);
 assert.deepEqual(rows.map(row=>row.key),['price','offense','defense','last10','venue','rest','h2h']);
 const [price,offense,defense,last10,venue,rest,h2h]=rows;
 assert.equal(price.label,'Open → now');
 assert.deepEqual([price.away.text,price.away.move,price.home.text,price.home.move],['+135 → +139','down','-161 → -166','up']);
 // A lower rank is the better side.
 assert.deepEqual([offense.away.text,offense.home.text,offense.home.better,offense.away.better],['#23','#21',true,false]);
 assert.equal(defense.home.better,true);
 assert.equal(last10.away.better,true);
 assert.deepEqual([venue.away.text,venue.home.text],['2-5 road','0-5 home']);
 // Rest as days off: a game last night is a back-to-back, two nights ago 1 day.
 assert.deepEqual([rest.away.text,rest.home.text,rest.away.better,rest.home.tone],['1 day','Back-to-back',true,'bad']);
 assert.deepEqual(headToHead(prediction),{away:2,home:0,games:2});
 assert.deepEqual([h2h.away.text,h2h.home.text,h2h.away.better],['2-0','0-2',true]);
 // The NBA's last 10 from the season; ESPN's last five otherwise, oldest first, own score first.
 assert.deepEqual(recentGames(prediction,'home').map(game=>[game.opponent.abbr,game.margin]),[['DAL',-16],['BKN',27]]);
 assert.equal(recentGames(prediction,'home')[0].opponent.logo,'https://a.espncdn.com/i/teamlogos/nba/500/dal.png');
 assert.deepEqual(recentGames(prediction,'away').map(game=>[game.opponent.abbr,game.margin,game.home]),[['TOR',-10,false],['CHI',4,true]]);
 assert.equal(outPoints([{kind:'out',ppg:21.8},{kind:'questionable',ppg:9.4,chance:0.5},{kind:'other',ppg:5}]),26.5);
 assert.deepEqual(matchupRows(null),[]);
 // The ranks per 100 possessions even when points a game are there too (PickFinder's); points a game only without ratings.
 const both={...prediction,teams:{home:{...prediction.teams.home,pts:[108,22],ptsAllowed:[104,1]},away:{...prediction.teams.away,pts:[118,10],ptsAllowed:[117,19]}}};
 assert.deepEqual(matchupRows(both).filter(row=>row.key==='offense'||row.key==='defense').map(row=>[row.away.text,row.home.text]),[['#23','#21'],['#17','#14']]);
 const games={...prediction,teams:{home:{pts:[108,22],ptsAllowed:[104,1]},away:{pts:[118,10],ptsAllowed:[117,19]}}};
 assert.deepEqual(matchupRows(games).filter(row=>row.key==='offense').map(row=>[row.away.text,row.away.small]),[['#10','118 a game']]);
 // The last three meetings, last season's included.
 const four={...prediction,meetings:[{home:'IND',away:'WSH',hs:120,as:100},...prediction.meetings,{home:'IND',away:'WSH',hs:99,as:101}]};
 assert.deepEqual(headToHead(four),{away:3,home:0,games:3});
 // The NFL's rest is the days between games.
 const nfl=matchupRows({...prediction,sport:'nfl',teams:{},rest:{home:7,away:4}}).find(row=>row.key==='rest');
 assert.deepEqual([nfl.away.text,nfl.home.text,nfl.home.better],['4 days','7 days',true]);
 const {restText}=await import('../src/game-predictor-core.js');
 assert.deepEqual([restText(1),restText(2),restText(4),restText(null),restText(7,true)],['Back-to-back','1 day','3 days','—','7 days']);
});
