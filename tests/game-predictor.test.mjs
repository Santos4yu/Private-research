import test from 'node:test';
import assert from 'node:assert/strict';
import {cardText,combined} from '../src/game-share.js';
import {colorGap,inkOn,keyInjuries,marketNote,pairColors,readGuide,steadySince} from '../src/game-predictor-core.js';
import {americanOf,boardLegs,cents,chartFrame,chartPath,moneyText,sideSeries,winOf,dayKey,dayLabel,dayOptions,groupByDay,mergeBoards,byText,decimal,evText,likeliest,lineText,odds,parlays,paysText,pct,pull,recordText,resultOf,startText,twoCalls,unitsText,valueRows} from '../src/game-predictor-core.js';

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
