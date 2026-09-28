import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,CalendarDays,Database,Filter,ListOrdered,RefreshCw,Shield,Users,X} from 'lucide-react';
import {WNBA_STATS,wnbaChart,wnbaLines,wnbaOdds} from './trend-data';
import WNBAFinderContext from './WNBAFinderContext';
import {finite,fmt,logValue,opponentOf,positionOf,realGames,shortDate,useWnba} from './wnba-research';
import '../../mlb-finder-context.css';
import './wnba-context.css';

// The WNBA player page, on the MLB Finder page's exact layout: the shared
// trend chart, supporting stats and game log on the left, the tabbed
// matchup panel on the right (MLBTrends in FinderTrendView.jsx).

function TrendChart({row,playerRows,logs,loading,onStat}){
 const host=useRef(null);
 const opponent=opponentOf(row),available=new Set(playerRows.map(item=>item.marketKey));
 const config=useMemo(()=>({sport:'WNBA',player:row.player,teamAbbr:row.teamAbbr||'',teamLogo:row.teamLogo||'',opponent:opponent||'',
  opponentLogo:row.team===row.homeTeam?row.awayTeamLogo:row.homeTeamLogo,matchupLabel:`${row.awayTeam} @ ${row.homeTeam}`,
  kickoffLabel:new Date(row.startsAt).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'}),status:'Pre-game',headshot:row.headshot||null,
  stats:WNBA_STATS.filter(stat=>available.has(stat.key)),statKey:row.marketKey,stat:row.market,side:row.direction==='UNDER'?'Under':'Over',line:row.line,
  chart:wnbaChart(logs,row.marketKey,opponent),lines:wnbaLines(playerRows,row.marketKey),linesStatus:'ready',odds:wnbaOdds(playerRows,row.marketKey),loading,onStat}),
  [row,playerRows,logs,loading,onStat,opponent]);
 const latest=useRef(config);latest.current=config;
 const [available_,setAvailable]=useState(true);
 useEffect(()=>{const panel=window.vortexTrendPanel;if(!panel||!host.current){setAvailable(false);return undefined;}setAvailable(Boolean(panel.mount(host.current,latest.current)));return()=>panel.unmount();},[]);
 useEffect(()=>{window.vortexTrendPanel?.update(config);},[config]);
 return <>{!available_&&<div className="wnba-board-message" role="status"><Database size={22} aria-hidden="true"/><strong>Trends could not open</strong><span>Refresh the page to reload player research.</span></div>}<div className="wnba-trend-host finder-mlb-trend-host" ref={host}/></>;
}

const SUPPORT=[['min','Minutes'],['pts','Points'],['reb','Rebounds'],['ast','Assists'],['fgm','FG Made'],['tpm','3-PT Made'],['ftm','FT Made'],['pf','Fouls']];
function SupportingStats({logs,loading}){
 const [selected,setSelected]=useState(0);
 const games=realGames(logs).slice(-10),key=SUPPORT[selected][0];
 const max=Math.max(1,...games.map(game=>logValue(game,key)).filter(finite));
 return <section className="mlb-context-card mlb-supporting"><header><h2>Supporting stats</h2><small>Last {games.length||'—'} games</small></header>
  <div className="mlb-support-tabs">{SUPPORT.map(([stat,label],index)=>{const values=games.map(game=>logValue(game,stat)).filter(finite);return <button type="button" key={stat} aria-pressed={selected===index} onClick={()=>setSelected(index)}>{label}<strong>{values.length?fmt(values.reduce((a,b)=>a+b,0)/values.length):'—'} <small>avg.</small></strong></button>;})}</div>
  {games.length?<div className="mlb-support-chart">{games.map((game,index)=>{const value=logValue(game,key);return <div key={game.gameId||index}><div className="mlb-support-track"><div style={{height:finite(value)?`${value/max*100}%`:'0%'}}><span>{finite(value)?fmt(value):'—'}</span></div></div><small>{shortDate(game.date)}<br/>{game.isHome===false?'@':''}{game.opponent}</small></div>;})}</div>
  :<p className="mlb-context-note">{loading?'Loading game logs…':'Supporting game logs are not available yet.'}</p>}
 </section>;
}

const LOG_COLUMNS=[['min','MIN'],['pts','PTS'],['reb','REB'],['ast','AST'],['fg','FG'],['tp','3PT'],['ft','FT'],['stl','STL'],['blk','BLK'],['to','TO'],['pf','PF']];
function logCell(game,key){
 const box=game.box||{};
 const pair=(made,attempted)=>finite(box[made])&&finite(box[attempted])?`${box[made]}-${box[attempted]}`:'—';
 if(key==='fg')return pair('fgm','fga');if(key==='tp')return pair('tpm','tpa');if(key==='ft')return pair('ftm','fta');
 const value=logValue(game,key);return finite(value)?fmt(value,0):'—';
}
function PlayerGameLog({row,logs,loading,error,onRetry}){
 const games=realGames(logs).slice(-15).reverse();
 return <section className="mlb-context-card mlb-player-gamelog"><header><h2><ListOrdered size={15} aria-hidden="true"/>Game log · Last 15 games</h2><small>{row.player}</small></header>
  {loading&&!games.length?<p className="mlb-context-note" role="status">Loading player game log…</p>:error&&!games.length?<p className="mlb-context-note" role="status">Game log could not load. <button type="button" onClick={onRetry}>Retry</button></p>:games.length?
  <div className="mlb-player-log-scroll" tabIndex={0} role="region" aria-label={`${row.player} recent game statistics; scroll for more columns`}><table><thead><tr><th scope="col">Date</th><th scope="col">Opponent</th><th scope="col">Result</th>{LOG_COLUMNS.map(([key,label])=><th scope="col" key={key}>{label}</th>)}</tr></thead>
  <tbody>{games.map(game=><tr key={game.gameId}><th scope="row" title={game.date}><span className="mlb-log-date"><CalendarDays size={12} aria-hidden="true"/>{shortDate(game.date)}</span></th>
   <td><span className="mlb-log-opponent"><span className="mlb-log-logo"><Shield size={17} aria-hidden="true"/>{game.opponentLogo&&<img src={game.opponentLogo} width="20" height="20" alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span><span>{game.isHome===false?'@ ':''}{game.opponent}</span></span></td>
   <td><span className="wnba-result" data-result={game.result}>{game.result||'—'}</span> {game.score||''}{game.seasonKind==='postseason'&&<small className="wnba-po-tag">PO</small>}</td>
   {LOG_COLUMNS.map(([key])=><td key={key}>{logCell(game,key)}</td>)}</tr>)}</tbody></table></div>
  :<p className="mlb-context-note">No games are available for this player yet.</p>}
 </section>;
}

// ESPN publishes no WNBA depth chart, so this is the rotation each coach
// has actually used: last game's starters, then the bench by minutes.
function DepthChart({row,matchup}){
 const league=useWnba('league-context',{});
 const team=row.teamAbbr,opponent=opponentOf(row);
 const [side,setSide]=useState(team);
 useEffect(()=>setSide(row.teamAbbr),[row.teamAbbr]);
 const rotation=league.data?.rotation?.[side];
 const teams=league.data?.teams||{};
 const injured=new Map((matchup?.injuries?.[side]||[]).map(item=>[item.id,item]));
 const groups=['G','F','C'].map(position=>[position,(rotation?.players||[]).filter(player=>positionOf(player.pos)===position)]);
 return <section className="mlb-context-card wnba-depth"><header><h2><Users size={15} aria-hidden="true"/>Depth chart</h2><small>{rotation?`Last ${rotation.games} games`:''}</small></header>
  <div className="mlb-context-switch" aria-label="Depth chart team">{[team,opponent].filter(Boolean).map(abbr=><button type="button" key={abbr} aria-pressed={side===abbr} onClick={()=>setSide(abbr)}>{teams[abbr]?.logo&&<img src={teams[abbr].logo} alt="" width="18" height="18"/>}{abbr}</button>)}</div>
  {league.loading&&!rotation?<div className="mlb-context-skeleton" role="status" aria-label="Loading rotation"><span/><span/><span/></div>
  :league.error?<p className="mlb-context-note" role="status">{league.error} <button type="button" onClick={league.retry}>Retry</button></p>
  :!rotation?<p className="mlb-context-note">No games recorded for this team yet.</p>
  :<div className="wnba-depth-rows">{groups.filter(([,players])=>players.length).map(([position,players])=><div className="wnba-depth-row" key={position}><b>{position}</b><div>{players.map(player=>{const injury=injured.get(player.id);return <span className="wnba-depth-player" data-starter={player.lastStart} key={player.id} title={`${player.name} · ${fmt(player.min)} min over ${player.games} games · ${player.starts} starts`}>
    <span className="wnba-avatar">{player.headshot&&<img src={player.headshot} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span>
    <span><strong className={player.id===String(row.playerId)?'is-self':''}>{player.name}</strong><small>{fmt(player.min)} min{player.lastStart?' · Starter':''}</small></span>
    {injury&&<em className="wnba-injury-code" title={[injury.status,injury.injury].filter(Boolean).join(' · ')}>{injury.code||injury.status}</em>}</span>;})}</div></div>)}</div>}
  <p className="mlb-context-note">Order and minutes from the last {rotation?.games||5} games — ESPN publishes no official WNBA depth chart. Injury tags are from the current report.</p>
 </section>;
}

export function WNBAPlayerPage({row,playerRows,onBack}){
 const [selected,setSelected]=useState(row),[trend,setTrend]=useState({state:'loading',rows:[]}),[retry,setRetry]=useState(0);
 // A with/without choice from the Injuries tab narrows the chart to those games.
 const [filter,setFilter]=useState(null);
 useEffect(()=>{setSelected(row);setFilter(null);},[row]);
 useEffect(()=>{if(!row.playerId)return undefined;const controller=new AbortController();setTrend(old=>({...old,state:'loading'}));
  fetch('/api/wnba?resource=gamelog&playerId='+encodeURIComponent(row.playerId)+'&season='+new Date().getUTCFullYear(),{signal:controller.signal,credentials:'same-origin'})
   .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Game logs unavailable');setTrend({state:'ready',rows:data.rows||[]});})
   .catch(error=>{if(error.name!=='AbortError')setTrend({state:'error',rows:[],error:error.message});});
  return()=>controller.abort();},[row.playerId,retry]);
 const matchup=useWnba('matchup',{home:selected.homeTeamAbbr,away:selected.awayTeamAbbr,startsAt:selected.startsAt},Boolean(selected.homeTeamAbbr&&selected.awayTeamAbbr&&selected.startsAt));
 const onStat=useMemo(()=>key=>{const next=playerRows.find(item=>item.marketKey===key);if(next)setSelected(next);},[playerRows]);
 const chartLogs=useMemo(()=>filter?trend.rows.filter(game=>filter.ids.includes(String(game.gameId))):trend.rows,[trend.rows,filter]);
 const loading=trend.state==='loading';
 return <section className="finder-trend-view wnba-trend-page wnba-player-page">
  <button type="button" className="wnba-trend-back" aria-label="Back to Finder" onClick={onBack}><ArrowLeft size={17} aria-hidden="true"/>Back</button>
  <header className="wnba-trend-title"><div className="wnba-player-cell">
   {selected.headshot&&<img className="wnba-player-photo" src={selected.headshot} alt="" width="56" height="56" onError={e=>{e.currentTarget.hidden=true;}}/>}
   <div><span>WNBA TRENDS</span><h1>{selected.player}</h1><p>{selected.market} · Line {selected.line}{selected.teamAbbr?` · ${selected.teamAbbr} ${selected.team===selected.homeTeam?'vs':'@'} ${opponentOf(selected)||''}`:''}</p></div>
  </div></header>
  {!row.playerId?<div className="wnba-board-message" role="status"><Database size={22} aria-hidden="true"/><strong>Player history unavailable</strong><span>This player could not be matched to ESPN's roster yet, so trends and matchup research are not available.</span></div>:<>
  {trend.state==='error'&&<div className="wnba-board-message" role="alert"><span>{trend.error}</span><button type="button" className="wnba-trend-back" onClick={()=>setRetry(n=>n+1)}><RefreshCw size={16} aria-hidden="true"/>Retry</button></div>}
  <div className="mlb-finder-workspace"><div className="mlb-trend-main">
   {filter&&<div className="wnba-filter-banner" role="status"><Filter size={14} aria-hidden="true"/><span>Chart shows <b>{chartLogs.length}</b> {chartLogs.length===1?'game':'games'} {filter.label}</span><button type="button" onClick={()=>setFilter(null)}><X size={14} aria-hidden="true"/>Show all games</button></div>}
   <TrendChart row={selected} playerRows={playerRows} logs={chartLogs} loading={loading} onStat={onStat}/>
   <SupportingStats logs={trend.rows} loading={loading}/>
   <PlayerGameLog row={selected} logs={trend.rows} loading={loading} error={trend.state==='error'} onRetry={()=>setRetry(n=>n+1)}/>
   <DepthChart row={selected} matchup={matchup.data}/>
  </div>
  <WNBAFinderContext row={selected} logs={trend.rows} matchup={matchup} filter={filter} onFilter={setFilter}/></div></>}
 </section>;
}
