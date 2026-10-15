import React,{useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Activity,CalendarDays,ChartColumn,Database,ListOrdered,RefreshCw,Shield,Swords} from 'lucide-react';
import {FinderPlayerBanner} from '../../FinderPlayerBanner';
import {loadCfbLog} from '../../unified-finder-data';
import {wnbaLines,wnbaOdds} from '../wnba/trend-data';
import {finite,fmt} from '../wnba/wnba-research';
import {AGAINST,AGAINST_WORDS,STATS,cfbChart,cfbLogo,cfbStatCode,family,playedGames,playerGames,statValue} from './cfb-stats';
import '../../mlb-finder-context.css';
import '../wnba/wnba-context.css';
import '../nfl/nfl-finder.css';

// The college football player page, on the NFL / NHL Finder pages' layout:
// the shared trend chart, supporting stats and game log on the left; the
// line, the opponent's defense and past meetings on the right. Data:
// /api/board?view=cfb&resource=log (cfb_research.py) -- each team's games
// from ESPN's box scores.

function useLog(team){
 const [retry,setRetry]=useState(0),[state,setState]=useState({loading:Boolean(team)});
 useEffect(()=>{
  if(!team){setState({});return undefined;}
  let active=true;setState(old=>({loading:true,data:old.team===team?old.data:undefined,team}));
  loadCfbLog(team).then(data=>{if(active)setState({data,team});}).catch(error=>{if(active)setState({error:error.message,team});});
  return()=>{active=false;};
 },[team,retry]);
 return {...state,retry:()=>setRetry(n=>n+1)};
}

function statTabs(playerRows){
 const labels=new Map();
 for(const item of playerRows)if(item.marketKey&&!labels.has(item.marketKey))labels.set(item.marketKey,item);
 const order=Object.keys(STATS);
 const rank=item=>{const index=order.indexOf(item.valueKey);return index<0?order.length:index;};
 return [...labels.values()].sort((a,b)=>rank(a)-rank(b)).map(item=>({key:item.marketKey,label:item.market,code:cfbStatCode(item.valueKey,item.market)}));
}
const shortDay=(date,year=true)=>{const day=new Date(`${date}T12:00:00`);return Number.isNaN(day.getTime())?'—':day.toLocaleDateString([],{month:'numeric',day:'numeric',...(year?{year:'2-digit'}:{})});};
const show=value=>!finite(value)?'—':fmt(value,Number.isInteger(value)?0:1);
const opponentOf=row=>row.opponent||(row.teamAbbr&&row.teamAbbr===row.homeTeamAbbr?row.awayTeamAbbr:row.homeTeamAbbr)||'';

function TrendChart({row,playerRows,rows,loading,onStat}){
 const host=useRef(null);
 const opponent=opponentOf(row);
 const home=row.homeTeamAbbr,away=row.awayTeamAbbr;
 const config=useMemo(()=>({sport:'CFB',player:row.player,teamAbbr:row.teamAbbr||'',teamLogo:row.teamLogo||cfbLogo(row.teamId),opponent,
  opponentLogo:row.opponentLogo||cfbLogo(row.opponentId),matchupLabel:away&&home?`${away} @ ${home}`:'',
  kickoffLabel:row.startsAt?new Date(row.startsAt).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'}):'',status:'Pre-game',headshot:row.headshot||null,
  stats:statTabs(playerRows),statKey:row.marketKey,stat:row.market,side:row.direction==='UNDER'?'Under':'Over',line:row.line,
  chart:cfbChart(rows,row.valueKey,opponent),lines:wnbaLines(playerRows,row.marketKey),linesStatus:'ready',odds:wnbaOdds(playerRows,row.marketKey),
  loading,onStat,filters:['seasonKind','opponent']}),[row,rows,loading,onStat,opponent,home,away,playerRows]);
 const latest=useRef(config);latest.current=config;
 const [ready,setReady]=useState(true);
 useLayoutEffect(()=>{const panel=window.vortexTrendPanel;if(!panel||!host.current){setReady(false);return undefined;}setReady(Boolean(panel.mount(host.current,latest.current)));return()=>panel.unmount();},[]);
 useLayoutEffect(()=>{window.vortexTrendPanel?.update(config);},[config]);
 return <>{!ready&&<div className="wnba-board-message" role="status"><Database size={22} aria-hidden="true"/><strong>Trends could not open</strong><span>Refresh the page to reload player research.</span></div>}<div className="wnba-trend-host finder-mlb-trend-host" ref={host}/></>;
}

function SupportingStats({rows,position,loading}){
 const keys=family(position).support;
 const [selected,setSelected]=useState(0);
 useEffect(()=>setSelected(0),[position]);
 const games=playedGames(rows).slice(-10),key=keys[Math.min(selected,keys.length-1)];
 const max=Math.max(1,...games.map(game=>statValue(game,key)).filter(finite));
 return <section className="mlb-context-card mlb-supporting"><header><h2>Supporting stats</h2><small>Last {games.length||'—'} games</small></header>
  <div className="mlb-support-tabs">{keys.map((stat,index)=>{const values=games.map(game=>statValue(game,stat)).filter(finite);return <button type="button" key={stat} aria-pressed={selected===index} onClick={()=>setSelected(index)}>{STATS[stat].label}<strong>{values.length?fmt(values.reduce((a,b)=>a+b,0)/values.length):'—'} <small>avg.</small></strong></button>;})}</div>
  {games.length?<div className="mlb-support-chart">{games.map((game,index)=>{const value=statValue(game,key);return <div key={game.gameId||index}><div className="mlb-support-track"><div style={{height:finite(value)?`${Math.max(0,value)/max*100}%`:'0%'}}><span>{show(value)}</span></div></div><small>{shortDay(game.date,false)}<br/>{game.isHome===false?'@':''}{game.opponent}</small></div>;})}</div>
  :<p className="mlb-context-note">{loading?'Loading game logs…':'Supporting game logs are not available yet.'}</p>}
 </section>;
}

function PlayerGameLog({row,rows,loading,error,onRetry,position}){
 const columns=family(position).log;
 const games=(rows||[]).slice(-15).reverse();
 return <section className="mlb-context-card mlb-player-gamelog"><header><h2><ListOrdered size={15} aria-hidden="true"/>Game log · Last 15 games</h2><small>{row.player}</small></header>
  {loading&&!games.length?<p className="mlb-context-note" role="status">Loading player game log…</p>:error&&!games.length?<p className="mlb-context-note" role="status">Game log could not load. <button type="button" onClick={onRetry}>Retry</button></p>:games.length?
  <div className="mlb-player-log-scroll" tabIndex={0} role="region" aria-label={`${row.player} recent game statistics; scroll for more columns`}><table><thead><tr><th scope="col">Date</th><th scope="col">Opponent</th><th scope="col">Result</th>{columns.map(key=><th scope="col" key={key}>{STATS[key].short}</th>)}</tr></thead>
  <tbody>{games.map(game=><tr key={game.gameId} data-dnp={game.dnp}><th scope="row" title={game.date}><span className="mlb-log-date"><CalendarDays size={12} aria-hidden="true"/>{shortDay(game.date)}</span></th>
   <td><span className="mlb-log-opponent"><span className="mlb-log-logo"><Shield size={17} aria-hidden="true"/><img src={game.opponentLogo||cfbLogo(game.opponentId)} width="20" height="20" alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/></span><span>{game.isHome===false?'@ ':''}{game.opponent}</span></span></td>
   <td><span className="wnba-result" data-result={game.result}>{game.result||'—'}</span> {game.score||''}{game.seasonKind==='postseason'&&<small className="wnba-po-tag">BOWL</small>}</td>
   {columns.map(key=><td key={key}>{game.dnp?<span className="nfl-dnp" title="Not in the box score: no stat recorded, or didn't play">—</span>:show(statValue(game,key))}</td>)}</tr>)}</tbody></table></div>
  :<p className="mlb-context-note">No games are available for this player yet.</p>}
 </section>;
}

// ---------------------------------------------------------------- side panel

function Card({title,note,children,icon:Icon=Activity,className=''}){return <section className={'mlb-context-card '+className}><header><h2><Icon size={16} aria-hidden="true"/>{title}</h2>{note&&<small>{note}</small>}</header>{children}</section>;}

function CurrentLine({row,playerRows}){
 const offers=playerRows.filter(item=>item.marketKey===row.marketKey);
 const lines=[...new Map(offers.map(item=>[`${item.line}:${item.modifier}`,item])).values()].sort((a,b)=>a.line-b.line);
 return <Card title="Lines" note={row.market} icon={ChartColumn} className="nfl-current-line">
  <div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Line</th><th scope="col">Type</th></tr></thead><tbody>
   {lines.map(item=><tr key={`${item.line}:${item.modifier}`}><th scope="row">{item.line}</th><td><span className="nfl-line-apps"><img src="/prizepicks/logo.png" alt="PrizePicks" width="20" height="20"/>{['goblin','demon'].includes(item.modifier)&&<img src={`/prizepicks/${item.modifier}.png`} alt={item.modifier} width="18" height="18"/>}</span></td></tr>)}
  </tbody></table></div>
 </Card>;
}

// What today's opponent has given up per game this season, in what this
// stat feeds on, beside the same for every defense on today's board.
function OpponentDefense({row,opponentLog}){
 const key=AGAINST[row.valueKey];
 const games=opponentLog.data?.games||[];
 const season=games.at(-1)?.season;
 const recent=games.filter(game=>game.season===season);
 const values=recent.map(game=>game.against?.[key]).filter(finite);
 const average=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;
 const ratio=row.allowTable?.[row.opponent];
 const tone=!finite(ratio)?null:ratio>=1.08?'soft':ratio<=0.92?'tough':'average';
 return <Card title={`${row.opponent||'Opponent'} defense`} note={key?`${AGAINST_WORDS[key]} allowed`:'Defense'} icon={Shield}>
  {!key?<p className="mlb-context-note">There is no defense number behind this stat.</p>
  :opponentLog.loading&&!games.length?<div className="mlb-context-skeleton" role="status" aria-label="Loading defense"><span/><span/><span/></div>
  :!values.length?<p className="mlb-context-note">{opponentLog.error?'Their games could not load right now.':'No games for this defense yet this season.'}</p>
  :<>
   <p className="mlb-context-note"><b>{fmt(average,1)}</b> {AGAINST_WORDS[key]} allowed per game over {values.length} game{values.length===1?'':'s'} this season{tone?<>, <b data-tone={tone}>{tone==='soft'?'more than':tone==='tough'?'less than':'about the same as'}</b> the defenses on today's board</>:''}.</p>
   <div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Date</th><th scope="col">Opponent</th><th scope="col">Allowed</th><th scope="col">Pts</th></tr></thead><tbody>
    {recent.slice(-5).reverse().map(game=><tr key={game.gameId}><th scope="row">{shortDay(game.date,false)}</th><td>{game.isHome===false?'@ ':''}{game.opponent}</td><td>{show(game.against?.[key])}</td><td>{show(game.against?.points)}</td></tr>)}
   </tbody></table></div>
  </>}
 </Card>;
}

function HeadToHead({row,rows}){
 const met=playedGames(rows).filter(game=>row.opponentId?String(game.opponentId)===String(row.opponentId):game.opponent===row.opponent);
 return <Card title="Head to head" note={`vs ${row.opponent||'opponent'}`} icon={Swords}>
  {met.length?<div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Date</th><th scope="col">Result</th><th scope="col">{STATS[row.valueKey]?.short||'Stat'}</th></tr></thead><tbody>
   {met.slice().reverse().map(game=>{const value=statValue(game,row.valueKey);return <tr key={game.gameId}><th scope="row">{shortDay(game.date)}</th><td>{game.result||'—'} {game.score}</td><td data-hit={finite(value)?String(value>row.line):undefined}>{show(value)}</td></tr>;})}
  </tbody></table></div>:<p className="mlb-context-note">He hasn't played {row.opponent||'this opponent'} in the last two seasons.</p>}
 </Card>;
}

function Averages({row,rows}){
 const values=playedGames(rows).map(game=>statValue(game,row.valueKey)).filter(finite);
 const of=list=>list.length?list.reduce((a,b)=>a+b,0)/list.length:null;
 const windows=[['L5',values.slice(-5)],['L10',values.slice(-10)],['All',values]];
 return <Card title="Averages" note={row.market} icon={Activity}>
  <div className="mlb-context-table-wrap"><table><thead><tr>{windows.map(([label])=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody><tr>
   {windows.map(([label,list])=><td key={label}>{show(of(list)==null?null:Math.round(of(list)*10)/10)}</td>)}</tr></tbody></table></div>
 </Card>;
}

function CFBFinderContext({row,playerRows,rows}){
 const opponentLog=useLog(row.opponentId);
 return <aside className="mlb-finder-context wnba-finder-context nfl-finder-context" aria-label="College football matchup research">
  <CurrentLine row={row} playerRows={playerRows}/>
  <OpponentDefense row={row} opponentLog={opponentLog}/>
  <HeadToHead row={row} rows={rows}/>
  <Averages row={row} rows={rows}/>
 </aside>;
}

export function CFBPlayerPage({row,playerRows,onBack}){
 const [selected,setSelected]=useState(row);
 useEffect(()=>setSelected(row),[row]);
 const log=useLog(row.playerId?selected.teamId:null);
 const rows=useMemo(()=>playerGames(log.data,row.playerId),[log.data,row.playerId]);
 const position=selected.position||log.data?.players?.[row.playerId]?.pos;
 // Switching stat keeps the tier this row came from where possible.
 const onStat=useMemo(()=>key=>{const options=playerRows.filter(item=>item.marketKey===key);const next=options.find(item=>item.modifier===selected.modifier)||options[0];if(next)setSelected(next);},[playerRows,selected.modifier]);
 const chartRows=useMemo(()=>playedGames(rows),[rows]);
 return <section className="finder-trend-view wnba-trend-page wnba-player-page nfl-player-page cfb-player-page">
  <FinderPlayerBanner row={selected} playerRows={playerRows} onBack={onBack}/>
  {!row.playerId?<div className="wnba-board-message" role="status"><Database size={22} aria-hidden="true"/><strong>Player history unavailable</strong><span>This player could not be matched to his team's roster yet, so trends and matchup research are not available.</span></div>:<>
  {log.error&&<div className="wnba-board-message" role="alert"><span>{log.error}</span><button type="button" className="wnba-trend-back" onClick={log.retry}><RefreshCw size={16} aria-hidden="true"/>Retry</button></div>}
  <div className="mlb-finder-workspace"><div className="mlb-trend-main">
   <TrendChart row={selected} playerRows={playerRows} rows={chartRows} loading={log.loading} onStat={onStat}/>
   <SupportingStats rows={rows} position={position} loading={log.loading}/>
   <PlayerGameLog row={selected} rows={rows} loading={log.loading} error={Boolean(log.error)} onRetry={log.retry} position={position}/>
  </div>
  <CFBFinderContext row={selected} playerRows={playerRows} rows={rows}/></div></>}
 </section>;
}
