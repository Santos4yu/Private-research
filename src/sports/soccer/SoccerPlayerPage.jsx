import React,{useEffect,useMemo,useRef,useState} from 'react';
import {CalendarDays,Database,ListOrdered,RefreshCw,Shield} from 'lucide-react';
import {FinderPlayerBanner} from '../../FinderPlayerBanner';
import {wnbaLines,wnbaOdds} from '../wnba/trend-data';
import SoccerFinderContext from './SoccerFinderContext';
import {SOCCER_STATS,average,finite,fmt,playerGames,shortDate,soccerChart,statKeyOf,statOf,teamLogParams,useSoccer,valueOf} from './soccer-finder';
import '../../mlb-finder-context.css';
import '../wnba/wnba-context.css';
import './soccer-player.css';

// The soccer player page, on the WNBA / NFL / MLB Finder pages' layout: the
// shared trend chart, supporting stats and game log on the left, the tabbed
// matchup panel on the right. Data: /api/board?view=soccer (ESPN match
// summaries, soccer_research.py).

// One tab per stat this player has a line on, in the catalog's order, named
// the way PrizePicks names it.
function statTabs(playerRows){
 const labels=new Map();
 for(const item of playerRows)if(item.marketKey&&!labels.has(item.marketKey))labels.set(item.marketKey,item.market);
 const rank=key=>{const index=SOCCER_STATS.findIndex(stat=>stat.key===statKeyOf(key));return index<0?SOCCER_STATS.length:index;};
 return [...labels].sort((a,b)=>rank(a[0])-rank(b[0])).map(([key,label])=>({key,label,
  code:statOf(statKeyOf(key))?.code||label.replace(/[^A-Za-z0-9+]/g,'').slice(0,5).toUpperCase()}));
}
const kickoff=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'});};

function TrendChart({row,playerRows,games,loading,onStat}){
 const host=useRef(null);
 const config=useMemo(()=>({sport:'SOCCER',player:row.player,teamAbbr:row.teamAbbr||'',teamLogo:row.teamLogo||'',opponent:row.opponent||'',
  opponentLogo:row.opponentLogo||'',matchupLabel:row.awayTeamAbbr&&row.homeTeamAbbr?`${row.awayTeamAbbr} @ ${row.homeTeamAbbr}`:'',
  kickoffLabel:kickoff(row.startsAt),status:'Pre-game',headshot:row.headshot||null,
  stats:statTabs(playerRows),statKey:row.marketKey,stat:row.market,side:row.direction==='UNDER'?'Under':'Over',line:row.line,
  chart:soccerChart(games,statKeyOf(row.marketKey),row.opponent),lines:wnbaLines(playerRows,row.marketKey),linesStatus:'ready',
  odds:wnbaOdds(playerRows,row.marketKey),loading,onStat}),[row,playerRows,games,loading,onStat]);
 const latest=useRef(config);latest.current=config;
 const [ready,setReady]=useState(true);
 useEffect(()=>{const panel=window.vortexTrendPanel;if(!panel||!host.current){setReady(false);return undefined;}setReady(Boolean(panel.mount(host.current,latest.current)));return()=>panel.unmount();},[]);
 useEffect(()=>{window.vortexTrendPanel?.update(config);},[config]);
 return <>{!ready&&<div className="wnba-board-message" role="status"><Database size={22} aria-hidden="true"/><strong>Trends could not open</strong><span>Refresh the page to reload player research.</span></div>}<div className="wnba-trend-host finder-mlb-trend-host" ref={host}/></>;
}

// Goalkeepers get their own supporting numbers.
const isKeeper=(row,games)=>/^G/i.test(String(row.position||games.at(-1)?.pos||''));
function supportFor(row,games){
 const keys=isKeeper(row,games)?['min','gc','sotf','saves']:['min','shots','sot','fd','fouls','passAtt','touch'];
 return keys.filter(key=>key==='min'||games.some(game=>finite(valueOf(game,key))));
}
const supportLabel=key=>key==='min'?'Minutes':key==='gc'?'Goals Allowed':key==='sotf'?'Shots Faced':statOf(key)?.label||key;
function SupportingStats({row,games,loading}){
 const keys=supportFor(row,games);
 const [selected,setSelected]=useState(0);
 useEffect(()=>setSelected(0),[row.player]);
 const recent=games.slice(-10),key=keys[Math.min(selected,keys.length-1)];
 const max=Math.max(1,...recent.map(game=>valueOf(game,key)).filter(finite));
 return <section className="mlb-context-card mlb-supporting"><header><h2>Supporting stats</h2><small>Last {recent.length||'—'} matches</small></header>
  <div className="mlb-support-tabs">{keys.map((stat,index)=>{const values=recent.map(game=>valueOf(game,stat)).filter(finite);return <button type="button" key={stat} aria-pressed={selected===index} onClick={()=>setSelected(index)}>{supportLabel(stat)}<strong>{values.length?fmt(average(values)):'—'} <small>avg.</small></strong></button>;})}</div>
  {recent.length?<div className="mlb-support-chart">{recent.map((game,index)=>{const value=valueOf(game,key);return <div key={game.gameId||index}><div className="mlb-support-track"><div style={{height:finite(value)?`${value/max*100}%`:'0%'}}><span>{finite(value)?fmt(value):'—'}</span></div></div><small>{shortDate(game.date)}<br/>{game.isHome===false?'@':''}{game.opponent}</small></div>;})}</div>
  :<p className="mlb-context-note">{loading?'Loading match logs…':'No recent matches are available for this player yet.'}</p>}
 </section>;
}

// The match log: the columns ESPN has numbers for, plus both teams' share
// of the ball.
const LOG_COLUMNS=[['min','Mins'],['goals','Goals'],['ga','G+A'],['shots','Shots'],['sot','SOT'],['passAtt','Pass Att'],['passes','Passes'],['touch','Touch'],
 ['poss','Poss'],['oppPoss','Opp Poss'],['ast','Ast'],['cross','Cross'],['sa','SA'],['clear','Clear'],['tackles','Tack'],['fd','FD'],['saves','Saves'],
 ['gc','GA'],['sotf','SOTF'],['drib','Drib'],['fouls','Foul'],['off','Off'],['yc','YC']];
const cell=(game,key)=>key==='poss'?game.teamStats.possessionPct:key==='oppPoss'?game.oppStats.possessionPct:valueOf(game,key);
function PlayerGameLog({row,games,loading,error,onRetry}){
 const shown=games.slice(-15).reverse();
 const columns=LOG_COLUMNS.filter(([key])=>shown.some(game=>finite(cell(game,key))));
 return <section className="mlb-context-card mlb-player-gamelog"><header><h2><ListOrdered size={15} aria-hidden="true"/>Match log · Last 15</h2><small>{row.player}</small></header>
  {loading&&!shown.length?<p className="mlb-context-note" role="status">Loading match log…</p>:error&&!shown.length?<p className="mlb-context-note" role="status">The match log could not load. <button type="button" onClick={onRetry}>Retry</button></p>:shown.length?
  <div className="mlb-player-log-scroll" tabIndex={0} role="region" aria-label={`${row.player} recent match statistics; scroll for more columns`}><table><thead><tr><th scope="col">Date</th><th scope="col">Opponent</th><th scope="col">Result</th>{columns.map(([key,label])=><th scope="col" key={key}>{label}</th>)}</tr></thead>
  <tbody>{shown.map(game=><tr key={game.gameId}><th scope="row" title={`${game.date}${game.leagueName?' · '+game.leagueName:''}`}><span className="mlb-log-date"><CalendarDays size={12} aria-hidden="true"/>{shortDate(game.date)}</span></th>
   <td><span className="mlb-log-opponent"><span className="mlb-log-logo"><Shield size={17} aria-hidden="true"/>{game.opponentLogo&&<img src={game.opponentLogo} width="20" height="20" alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span><span>{game.isHome===false?'@ ':''}{game.opponent}</span></span></td>
   <td><span className="wnba-result" data-result={game.result==='D'?'T':game.result}>{game.result||'—'}</span> {game.score||''}</td>
   {columns.map(([key])=>{const value=cell(game,key);return <td key={key}>{finite(value)?fmt(value,Number.isInteger(value)?0:1):'—'}</td>;})}</tr>)}</tbody></table></div>
  :<p className="mlb-context-note">No recent matches are available for this player yet.</p>}
 </section>;
}

export function SoccerPlayerPage({row,playerRows,onBack}){
 const [selected,setSelected]=useState(row);
 useEffect(()=>setSelected(row),[row]);
 const matched=Boolean(row.eventId&&row.teamId);
 const log=useSoccer('log',teamLogParams(row),matched);
 const games=useMemo(()=>playerGames(log.data,row.player),[log.data,row.player]);
 // Switching stat keeps the tier this row came from where possible.
 const onStat=useMemo(()=>key=>{const options=playerRows.filter(item=>item.marketKey===key);const next=options.find(item=>item.modifier===selected.modifier)||options[0];if(next)setSelected(next);},[playerRows,selected.modifier]);
 const loading=Boolean(log.loading);
 return <section className="finder-trend-view wnba-trend-page wnba-player-page soccer-player-page">
  <FinderPlayerBanner row={selected} playerRows={playerRows} onBack={onBack}/>
  {!matched?<div className="wnba-board-message" role="status"><Database size={22} aria-hidden="true"/><strong>Match history unavailable</strong><span>This line could not be matched to its match yet, so trends and matchup research are not available.</span></div>:<>
  {log.error&&<div className="wnba-board-message" role="alert"><span>{log.error}</span><button type="button" className="wnba-trend-back" onClick={log.retry}><RefreshCw size={16} aria-hidden="true"/>Retry</button></div>}
  <div className="mlb-finder-workspace"><div className="mlb-trend-main">
   <TrendChart row={selected} playerRows={playerRows} games={games} loading={loading} onStat={onStat}/>
   <SupportingStats row={selected} games={games} loading={loading}/>
   <PlayerGameLog row={selected} games={games} loading={loading} error={Boolean(log.error)} onRetry={log.retry}/>
  </div>
  <SoccerFinderContext row={selected} games={games} log={log}/></div></>}
 </section>;
}
