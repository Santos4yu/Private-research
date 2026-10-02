// Development-only visual fixture. Not a live board or a betting recommendation.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Game,MatchupGrades,Record} from '../src/Moneylines.jsx';

const components=(name,offense,defense)=>[
 {key:'offense',label:'Offense',score:offense,detail:'27.5 scored/game · 8 current games'},
 {key:'defense',label:'Defense',score:defense,detail:'21.0 allowed/game · 8 current games'},
 {key:'personnel',label:'Quarterback / report',score:null,detail:`${name} · starter confirmation unresolved`},
 {key:'form',label:'Recent form',score:70,detail:'5 completed games'},
 {key:'availability',label:'Injury report',score:70,detail:'Report available; lineup unconfirmed'}];
const grading={coverage:.7,neutral:true,teams:{home:{matchupScore:32,sample:8,components:components('Washington',40,60)},
 away:{matchupScore:68,sample:8,components:components('Indianapolis',70,65)}},missing:['home: starter/key-player confirmation unresolved','away: starter/key-player confirmation unresolved']};
const game={id:'fixture',homeName:'Washington Commanders',awayName:'Indianapolis Colts',startsAt:'2026-10-04T13:30Z',
 fair:{home:.35,away:.65,homeOdds:185,awayOdds:-185},model:{home:.385,away:.615},books:[],best:{home:{price:170,bookName:'ESPN BET'},away:{price:-192,bookName:'DraftKings'}},ev:{},marketEv:{home:-.054,away:-.012},
 prediction:{side:'away',team:'Indianapolis Colts',probability:.615,score:68},pick:null,reasons:[],grading,
 target:{side:'away',price:-160,best:-192,bookName:'DraftKings'},passReason:'No supported matchup clears the conservative price threshold'};
const record={summary:{plays:3,wins:1,losses:2,pending:2,units:-.4,roi:-.12,curve:[],closeSamples:0},plays:[],currentModel:{wins:0,losses:0,units:0,pending:1},validation:{games:0,brier:null,marketBrier:null,bins:[]}};
function Preview(){return <main className="ml2" style={{padding:'16px',maxWidth:1000}}>
 <p>Development fixture · not live odds</p><Record record={record}/><Game game={game}/>
 <div className="ml2-game"><MatchupGrades game={game} away={{abbr:'IND'}} home={{abbr:'WSH'}}/></div>
 <Game game={{...game,id:'play',target:null,model:{home:.3,away:.7},prediction:{side:'away',team:'Indianapolis Colts',probability:.7,score:80},pick:{side:'away',tier:'strong',price:-150,bookName:'DraftKings',probability:.7,units:.75,score:80,coverage:.85,agreement:3,conservativeEv:.06,minimumPrice:-155}}}/>
</main>}
createRoot(document.getElementById('root')).render(<Preview/>);
