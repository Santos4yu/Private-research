import React,{useEffect,useState} from 'react';
import {loadMlbHistory} from './unified-finder-data';
export default function MLBSupportingStats({row}){
 const [history,setHistory]=useState(row.history),[selected,setSelected]=useState(0);
 useEffect(()=>{let active=true;loadMlbHistory(row).then(value=>{if(active)setHistory(value);}).catch(()=>{});return()=>{active=false;};},[row.id]);
 const pitcher=row.marketKey?.startsWith('pitching:');
 const choices=pitcher?[['numberOfPitches','Pitch count'],['strikeOuts','Strikeouts'],['baseOnBalls','Walks']]:[['plateAppearances','Plate appearances'],['hits','Hits'],['baseOnBalls','Walks']];
 const games=[...(history?.games||[])].sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(-10);
 const value=(game,key)=>game.stat?.[key]!=null&&Number.isFinite(Number(game.stat[key]))?Number(game.stat[key]):null;
 const max=Math.max(1,...games.map(g=>value(g,choices[selected][0])||0));
 return <section className="mlb-context-card mlb-supporting"><header><h2>Supporting stats</h2><small>Last {games.length||'—'} games</small></header><div className="mlb-support-tabs">{choices.map(([key,label],i)=>{const values=games.map(g=>value(g,key)).filter(v=>v!=null);return <button type="button" key={key} aria-pressed={selected===i} onClick={()=>setSelected(i)}>{label}<strong>{values.length?(values.reduce((a,b)=>a+b,0)/values.length).toFixed(1):'—'} <small>avg.</small></strong></button>;})}</div>{games.length?<div className="mlb-support-chart">{games.map((g,i)=>{const n=value(g,choices[selected][0]);return <div key={g.gameId||i}><div className="mlb-support-track"><div style={{height:n==null?'0%':`${n/max*100}%`}}><span>{n??'—'}</span></div></div><small>{g.date?.slice(5).replace('-','/')}</small></div>;})}</div>:<p className="mlb-context-note">Supporting game logs are not available yet.</p>}</section>;
}
