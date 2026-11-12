// The line's trail, for the NBA / WNBA player page (Nov 12, the owner with
// PickFinder's phone page: "make sure we have the line movement too"). One
// card, two tabs, like theirs:
//
//   Line Movement  this line on PrizePicks: each move newest first (the
//                  number, PrizePicks with its tier, when), where it opened
//                  last; "no moves" when it hasn't moved (line_moves.py
//                  through resource=line-history, the NBA's only)
//   Prop History   his last 15 games in this stat against tonight's line,
//                  each a hit or a miss
import React,{useMemo,useState} from 'react';
import {History,TrendingUp} from 'lucide-react';
import {finite,fmt,realGames,shortDate,useWnba} from './wnba-research';
import {lineTrail} from './prop-trail.js';

const stamp=at=>{const date=new Date(at);return Number.isNaN(date.getTime())?'':`${date.toLocaleDateString([],{month:'numeric',day:'numeric'})} ${date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`;};

function App({row}){
 const tier=['goblin','demon'].includes(row.modifier)?row.modifier:null;
 return <span className="fp2-trail-app"><img src="/prizepicks/logo.png" alt="PrizePicks" width="20" height="20"/>{tier&&<img src={`/prizepicks/${tier}.png`} alt={tier} width="18" height="18"/>}</span>;
}

function Moves({row}){
 const nba=row.sport==='nba';
 const history=useWnba('line-history',{player:row.player,league:'nba'},nba&&Boolean(row.player));
 const rows=useMemo(()=>lineTrail(row,history.data?.moves),[row,history.data]);
 const waiting=nba&&history.loading&&!history.data;
 return <table className="fp2-trail-table">
  <thead><tr><th scope="col">Line</th><th scope="col">App</th><th scope="col">Time</th></tr></thead>
  <tbody>{waiting?<tr><td colSpan={3} className="fp2-trail-none">Loading the line's moves…</td></tr>
   :rows.map(item=><tr key={item.key} data-tone={item.tone}>
    <td><b>{fmt(item.line,1)}</b>{finite(item.from)&&<small>from {fmt(item.from,1)}</small>}</td>
    <td><App row={row}/></td>
    <td>{item.at?<time dateTime={item.at}>{stamp(item.at)}</time>:<span className="fp2-trail-note">{item.note}</span>}{item.at&&item.note&&<small>{item.note}</small>}</td>
   </tr>)}</tbody>
 </table>;
}

function PropHistory({row,logs}){
 const games=realGames(logs).filter(game=>finite(game.values?.[row.marketKey])).slice(-15).reverse();
 if(!games.length)return <p className="fp2-trail-none">No games in this stat yet.</p>;
 const under=row.direction==='UNDER';
 return <table className="fp2-trail-table fp2-trail-history">
  <thead><tr><th scope="col">Date</th><th scope="col">Opp</th><th scope="col">{row.market}</th><th scope="col">vs {fmt(row.line,1)}</th></tr></thead>
  <tbody>{games.map(game=>{
   const value=game.values[row.marketKey],push=value===row.line,hit=under?value<row.line:value>row.line;
   return <tr key={game.gameId||game.date}>
    <td>{shortDate(game.date)}</td>
    <td>{game.isHome===false?'@':''}{game.opponent||'—'}</td>
    <td><b>{fmt(value,1)}</b></td>
    <td><span className="fp2-trail-mark" data-tone={push?'push':hit?'hit':'miss'}>{push?'Push':hit?'Hit':'Miss'}</span></td>
   </tr>;})}</tbody>
 </table>;
}

export default function PropTrail({row,logs}){
 const [tab,setTab]=useState('moves');
 return <section className="mlb-context-card fp2-trail">
  <div className="fp2-trail-tabs" role="tablist" aria-label="Line movement and prop history">
   <button type="button" role="tab" aria-selected={tab==='moves'} onClick={()=>setTab('moves')}><TrendingUp size={15} aria-hidden="true"/>Line Movement</button>
   <button type="button" role="tab" aria-selected={tab==='history'} onClick={()=>setTab('history')}><History size={15} aria-hidden="true"/>Prop History</button>
  </div>
  <div className="fp2-trail-body" role="tabpanel">{tab==='moves'?<Moves row={row}/>:<PropHistory row={row} logs={logs}/>}</div>
 </section>;
}
