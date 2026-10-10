import React from 'react';
import {createRoot} from 'react-dom/client';
import {UnifiedFinder} from '../src/UnifiedFinder';
import {refreshSiteAccess} from '../src/site-access';
import {storeBoard} from '../src/finder-store';
import {saveFinderView} from '../src/unified-finder-data';

// This isolated fixture never calls production APIs or paid feeds.
window.fetch=async()=>new Response(JSON.stringify({requireLogin:false,isAdmin:false,disabledTabs:[],disabledSports:[],disabledFinderSports:[],histories:{},rows:[],data:[],players:[]}),{headers:{'Content-Type':'application/json'}});
const now=Date.now();
const samples=[['Parker Messick','P','CLE','CWS','Earned Runs Allowed',0.5,1.6,'goblin'],['Brenton Doyle','OF','COL','LAD','Strikeouts',1.5,1.1,'standard'],['Miguel Vargas','IF','CWS','CLE','Hits + Runs + RBIs',0.5,2.6,'goblin'],['Munetaka Murakami','IF','CWS','CLE','Fantasy Score',11.5,11.9,'standard'],['Steven Kwan','OF','CLE','CWS','Hits',1.5,1.2,'demon'],['Shohei Ohtani','DH','LAD','COL','Total Bases',2.5,2.9,'standard'],['Aaron Judge','OF','NYY','BOS','Hits + Runs + RBIs',2.5,3.2,'standard'],['Tarik Skubal','P','DET','MIN','Pitcher Strikeouts',6.5,7.1,'standard']];
const rows=samples.map(([player,position,teamAbbr,opponent,market,line,average,modifier],i)=>({id:`preview-${i}`,sport:'mlb',player,playerId:i+1,position,teamAbbr,opponent,market,marketKey:'batter_hits',line,average,diff:average-line,modifier,direction:'OVER',startsAt:new Date(now+86400000).toISOString(),historyStatus:'ready',historyAsOf:now,enrichedAt:now,streak:4-i,apps:[{key:'prizepicks',name:'PrizePicks'},...(modifier==='standard'?[{key:'fanduel',name:'FanDuel',over:-115,under:-105}]:[])],windows:Object.fromEntries(['l5','l10','l15','h2h','season'].map((w,k)=>{const games=[5,10,15,5,100][k],hits=Math.max(1,Math.round(games*([.8,.6,.9,.7,.4,.6,.8,.7][i]-.03*k)));return [w,{hits,misses:games-hits,pushes:0,hitRate:hits/games*100}]}))}));
for(const sport of ['mlb','nba','wnba','nfl','soccer','nhl','tennis','cs2'])await storeBoard(sport,{rows:sport==='mlb'?rows:[],ts:now,fetchedAt:new Date(now).toISOString()});
saveFinderView(localStorage,{picked:['mlb'],pageSize:20,sorts:[]});
await refreshSiteAccess();
createRoot(document.getElementById('preview')).render(<UnifiedFinder/>);
