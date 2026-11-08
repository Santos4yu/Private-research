import test from 'node:test';
import assert from 'node:assert/strict';
import {clockText,detailOf,findGame,liveWithScores,runOf,tricode,withNbaLive} from '../src/nba-live.js';

const board={scoreboard:{games:[{gameId:'0022600140',gameStatus:2,period:2,gameClock:'PT00M31.20S',homeTeam:{teamTricode:'PHX',score:49},awayTeam:{teamTricode:'HOU',score:52}},
 {gameId:'0022600141',gameStatus:3,period:4,gameClock:'PT00M00.00S',homeTeam:{teamTricode:'GSW',score:118},awayTeam:{teamTricode:'NOP',score:104}}]}};
const actions=[{actionNumber:400,period:2,clock:'PT01M21.00S',teamTricode:'PHX',description:'K. Durant REBOUND (Off:0 Def:5)',scoreHome:'47',scoreAway:'47'},
 {actionNumber:401,period:2,clock:'PT01M02.00S',teamTricode:'HOU',description:'J. Green 26\' 3PT (14 PTS)',scoreHome:'47',scoreAway:'50'},
 {actionNumber:405,period:2,clock:'PT00M31.20S',teamTricode:'HOU',description:'A. Sengun 4\' Layup (12 PTS)',scoreHome:'47',scoreAway:'52'}];
const player=(name,nameI,points,reb=4,ast=3)=>({name,nameI,status:'ACTIVE',statistics:{points,reboundsTotal:reb,assists:ast,steals:1,blocks:0,turnovers:2,threePointersMade:2,minutes:'PT18M30.00S'}});
const box={period:2,gameClock:'PT00M31.20S',homeTeam:{score:49,periods:[{score:24},{score:25},{score:0},{score:0}],players:[player('Devin Booker','D. Booker',18),player('Kevin Durant','K. Durant',14,8,2)]},
 awayTeam:{score:52,periods:[{score:22},{score:30},{score:0},{score:0}],players:[player('Jalen Green','J. Green',14),player('Jabari Smith Jr.','J. Smith Jr.',9,7,1)]}};

test('NBA.com\'s clock and names',()=>{
 assert.equal(clockText('PT01M21.00S'),'1:21');
 assert.equal(clockText('PT00M54.40S'),'0:54.4');
 assert.equal(detailOf(board.scoreboard.games[0]),'0:31.2 - 2nd');
 assert.equal(detailOf(board.scoreboard.games[1]),null);
 assert.deepEqual([tricode('GS'),tricode('wsh'),tricode('PHX')],['GSW','WAS','PHX']);
 assert.equal(findGame(board,'PHX','HOU').gameId,'0022600140');
 assert.equal(findGame(board,'GS','NO').gameId,'0022600141');
 assert.equal(findGame(board,'LAL','BOS'),null);
});

test('the run from NBA.com\'s plays',()=>{
 assert.equal(runOf(actions),null);
 const more=[...actions,{scoreHome:'47',scoreAway:'54'}];
 assert.deepEqual(runOf(more),{side:'away',points:7});
});

test('NBA.com laid over the chart',()=>{
 const chart={id:'401',sport:'nba',state:'in',detail:'1:40 - 2nd',liveSource:'espn',home:{abbr:'PHX',score:47},away:{abbr:'HOU',score:45},
  clock:{points:[[0,0.5],[1300,0.6]]},feed:{last:{text:'old',when:'Q2 1:40',side:'home'},lead:{home:19,away:2}},
  props:[{name:'Devin Booker',stat:'Points',line:26.5,now:12},{name:'Jabari Smith',stat:'Rebounds',line:6.5,now:5},{name:'Kevin Durant',stat:'Pts + Reb + Ast',line:30.5,now:20}]};
 const found=withNbaLive(chart,actions,box);
 assert.deepEqual(found.feed.last,{text:'A. Sengun 4\' Layup (12 PTS)',when:'Q2 0:31.2',side:'away'});
 assert.deepEqual([found.home.score,found.away.score,found.detail],[49,52,'0:31.2 - 2nd']);
 assert.deepEqual(found.feed.quarters,{labels:['Q1','Q2'],home:[24,25],away:[22,30]});
 assert.deepEqual(found.feed.leaders.home[0],{name:'D. Booker',text:'18 pts · 4 reb · 3 ast'});
 assert.deepEqual(found.feed.lead,{home:19,away:2});
 const props=Object.fromEntries(found.props.map(row=>[row.name+'|'+row.stat,row.now]));
 assert.deepEqual(props,{'Devin Booker|Points':18,'Jabari Smith|Rebounds':7,'Kevin Durant|Pts + Reb + Ast':24});
 assert.equal(found.props[0].name,'Jabari Smith');
 assert.equal(found.clock,chart.clock);
 assert.equal(withNbaLive(chart,[],null),chart);
});

test('the list with NBA.com\'s scores',()=>{
 const games=[{id:'1',home:{abbr:'PHX'},away:{abbr:'HOU'}},{id:'2',home:{abbr:'GS'},away:{abbr:'NO'}}];
 const live={games:[{id:'1',state:'in',detail:'1:40 - 2nd',home:{score:47},away:{score:45}},{id:'2',state:'in',detail:'0:10 - 4th',home:{score:116},away:{score:104}}]};
 const found=liveWithScores(live,games,board);
 assert.deepEqual(found.games.map(game=>[game.state,game.detail,game.home.score,game.away.score]),[['in','0:31.2 - 2nd',49,52],['post','Final',118,104]]);
 assert.equal(liveWithScores(live,games,null),live);
});
