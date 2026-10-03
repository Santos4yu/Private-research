// Local visual regression fixture. Bio/odds match the verified API response;
// match rows are synthetic and never used as production history.
import React from 'react';
import {createRoot} from 'react-dom/client';
import TennisFinderContext from '../src/sports/tennis/TennisFinderContext';
import '../src/mlb-finder-context.css';
import '../src/sports/wnba/wnba-context.css';
import '../src/unified-finder.css';
const games=Array.from({length:20},(_,i)=>({gameId:String(i),date:`2026-09-${String(i+1).padStart(2,'0')}T18:00:00Z`,opponent:i%2?'Casper Ruud':'Test Opponent',opponentRank:21,surface:i%4?'Hard':'I.hard',bestOf:3,event:'Visual test tournament',round:'First round',score:'6-4 6-3',result:i%3?'W':'L',odds:2,values:{totalgameswon:12,gameslost:7,totalgames:19,setswon:2,totalsets:2,aces:5,doublefaults:2,fantasyscore:24,dominanceratio:1.2,holdpercentage:80,breakpointswon:4,breakpointchances:8,returnpointswonpercentage:40,acesallowed:3,firstservepercentage:60,secondservepercentage:90,doublefaultpercentage:10,breakpointssavedpercentage:66}}));
const row={player:'Luciano Darderi',opponent:'Casper Ruud',startsAt:'2026-10-01T02:00:00Z',market:'Aces',marketKey:'aces',line:5.5};
const weather={available:true,venue:'Tokyo, Japan',tempC:24,tempF:75,windMph:21,humidity:60,rainMm:1.2,conditions:'Rain',flags:[{key:'rain',label:'Rain delay risk',level:'medium'},{key:'wind',label:'Windy (affects serve and toss)',level:'medium'}],credit:'Forecast: MET Norway · Map data: OpenStreetMap'};
const context={weather,match:{event:'Japan Open Tennis Championships - Tokyo',surface:'Hard',round:'First round',date:row.startsAt,h2h:{matchCount:1}},players:[{name:row.player,rank:19,age:24,heightCm:183,hand:'Right',decimalOdds:3.64,winProbability:26.016,rankDate:'2026-09-28',games},{name:row.opponent,rank:21,age:27,heightCm:183,hand:'Right',decimalOdds:1.28,winProbability:73.984,rankDate:'2026-09-28',games:games.map((g,i)=>({...g,opponent:i%4?'Test Opponent '+(i%4):row.player,opponentOdds:2.5,opponentValues:{aces:i%7,doublefaults:2},score:g.result==='W'?'6-4 6-3':'4-6 3-6'}))}]};
document.body.style.cssText='margin:0;background:#0b0f14;color:#edf3fa;font-family:Arial,sans-serif';
createRoot(document.getElementById('root')).render(<main style={{maxWidth:560,margin:'auto',padding:12}}><p>Layout QA · synthetic match rows</p><TennisFinderContext row={row} games={games} playerRows={[]} context={context}/></main>);
