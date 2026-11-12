import React,{useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,CalendarDays,Database,ListOrdered,RefreshCw,Shield,UserCheck,UserRound,Users,UserX} from 'lucide-react';
import {WNBA_STATS,researchRows,wnbaChart,wnbaLines,wnbaOdds} from './trend-data';
import WNBAFinderContext from './WNBAFinderContext';
import {FinderPlayerLayout} from '../../FinderPlayerLayout';
import {basketballLogUrl} from '../../unified-finder-data';
import {applySplits,finite,fmt,hasPlayerContext,hasSplit,leagueOf,logValue,matchupParams,opponentOf,playerContextParams,positionOf,realGames,shortDate,splitFilter,splitKey,splitLabel,toggleSplit,useWnba} from './wnba-research';
import '../../mlb-finder-context.css';
import './wnba-context.css';
import {withLines} from '../../trend-lines';
import {Failure} from '../../AdminNotice';
import {useTrendPanel} from '../../trend-panel.js';
import PlayerNews,{useNewsAllowed,withNews} from '../../PlayerNews';
import {depthRows,injuryCode} from './depth';
import {RESEARCH_TABS} from '../../FinderResearchSections';
import PropTrail from './PropTrail';


// The NBA / WNBA player page off the Finder, on the shared layout
// (FinderPlayerLayout.jsx; Oct 30 the owner rebuilt this page first, then
// had every sport take it): the shared trend chart with his Game log, Stats
// and Depth under it, the matchup panel's six tabs beside it.
// The trail (Line Movement / Prop History, PropTrail.jsx) is the phone's: a
// computer keeps the full game log in its place (finder-player-app.css).
const HIS=[['log','Game log'],['stats','Stats'],['depth','Depth'],['trail','Line movement']];
const RESEARCH_LIST=RESEARCH_TABS.map(([key,label])=>[key,label]);

// The known stats in their usual order, then any other market PrizePicks
// posts for this player (shown by its own name; no history to chart yet).
// `playerRows` here includes his research-only rows (researchRows).
function statTabs(playerRows,available){
 const known=WNBA_STATS.filter(stat=>available.has(stat.key));
 const extra=[...available].filter(key=>key&&!WNBA_STATS.some(stat=>stat.key===key)).map(key=>{
  const label=playerRows.find(item=>item.marketKey===key)?.market||key;
  return {key,label,code:label.replace(/[^A-Za-z0-9+]/g,'').slice(0,5).toUpperCase()};
 });
 return [...known,...extra];
}
function TrendChart({row,playerRows,extraRows,logs,loading,onStat,chips,chipsNote,onChipRemove,onChipsClear}){
 const host=useRef(null);
 // Each game's usage rate and who sat out, for the chart's game cards.
 const notes=useWnba('game-notes',{playerId:row.playerId,league:leagueOf(row)},Boolean(row.playerId));
 const games=notes.data?.games;
 const opponent=opponentOf(row),statRows=[...playerRows,...extraRows],available=new Set(statRows.map(item=>item.marketKey));
 const lines=wnbaLines(playerRows,row.marketKey);
 const config=useMemo(()=>({sport:row.sport==='nba'?'NBA':'WNBA',player:row.player,teamAbbr:row.teamAbbr||'',teamLogo:row.teamLogo||'',opponent:opponent||'',
  opponentLogo:row.team===row.homeTeam?row.awayTeamLogo:row.homeTeamLogo,matchupLabel:`${row.awayTeam} @ ${row.homeTeam}`,
  kickoffLabel:new Date(row.startsAt).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'}),status:'Pre-game',headshot:row.headshot||null,
  stats:withLines(statTabs(statRows,available),playerRows),startsAt:row.startsAt,statKey:row.marketKey,stat:row.market,side:row.direction==='UNDER'?'Under':'Over',line:row.line,
  chart:wnbaChart(logs,row.marketKey,opponent,games),lines,linesStatus:lines.length?'ready':'empty',odds:wnbaOdds(playerRows,row.marketKey),loading,onStat,
  // Team: the games for each team he played for (a traded player's H2H
  // with his old team isn't his H2H now).
  filters:['seasonKind','team'],seasonKind:'games',chips,chipsNote,onChipRemove,onChipsClear}),
  [row,playerRows,extraRows,logs,loading,onStat,opponent,chips,chipsNote,onChipRemove,onChipsClear,games]);
 const available_=useTrendPanel(host,config);
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
  {loading&&!games.length?<p className="mlb-context-note" role="status">Loading player game log…</p>:error&&!games.length?<Failure onRetry={onRetry} quiet="No games to show yet.">Game log could not load.</Failure>:games.length?
  <div className="mlb-player-log-scroll" tabIndex={0} role="region" aria-label={`${row.player} recent game statistics; scroll for more columns`}><table><thead><tr><th scope="col">Date</th><th scope="col">Opponent</th><th scope="col">Result</th>{LOG_COLUMNS.map(([key,label])=><th scope="col" key={key}>{label}</th>)}</tr></thead>
  <tbody>{games.map(game=><tr key={game.gameId}><th scope="row" title={game.date}><span className="mlb-log-date"><CalendarDays size={12} aria-hidden="true"/>{shortDate(game.date)}</span></th>
   <td><span className="mlb-log-opponent"><span className="mlb-log-logo"><Shield size={17} aria-hidden="true"/>{game.opponentLogo&&<img src={game.opponentLogo} width="20" height="20" alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span><span>{game.isHome===false?'@ ':''}{game.opponent}</span></span></td>
   <td><span className="wnba-result" data-result={game.result}>{game.result||'—'}</span> {game.score||''}{game.seasonKind==='postseason'&&<small className="wnba-po-tag">PO</small>}{game.seasonKind==='preseason'&&<small className="wnba-po-tag">PRE</small>}</td>
   {LOG_COLUMNS.map(([key])=><td key={key}>{logCell(game,key)}</td>)}</tr>)}</tbody></table></div>
  :<p className="mlb-context-note">No games are available for this player yet.</p>}
 </section>;
}

// The depth chart's rows come from depth.js (the rotation each coach has used).
const LEGEND=[['OUT','Out for game'],['Q','Questionable'],['DOUBT','Doubtful'],['OFS','Out for season']];
const shortName=name=>{const parts=String(name||'').trim().split(/\s+/);return parts.length>1?`${parts[0][0]}. ${parts.slice(1).join(' ')}`:parts[0]||'';};
const columnLabel=index=>index===0?'Starter':['2nd','3rd','4th','5th','6th'][index-1]||`${index+1}th`;
function DepthChart({row,matchup,filters,onToggleFilter}){
 const league=useWnba('league-context',{league:leagueOf(row)});
 const context=useWnba('player-context',playerContextParams(row),hasPlayerContext(row));
 const team=row.teamAbbr,opponent=opponentOf(row);
 const [side,setSide]=useState(team);
 useEffect(()=>setSide(row.teamAbbr),[row.teamAbbr]);
 const rotation=league.data?.rotation?.[side],teams=league.data?.teams||{};
 const injuries=matchup?.injuries?.[side]||[];
 const injured=new Map(injuries.map(item=>[item.id,item]));
 // His own team's chart always has him: a trade the rosters haven't caught
 // up with yet left a player off his new team's chart.
 const players=useMemo(()=>{const list=rotation?.players||[];
  return side===team&&row.playerId&&!list.some(player=>String(player.id)===String(row.playerId))?[...list,{id:row.playerId,name:row.player,pos:row.position,headshot:row.headshot,min:null}]:list;},[rotation,side,team,row.playerId,row.player,row.position,row.headshot]);
 const rows=useMemo(()=>rotation?depthRows(players,injuries):[],[rotation,players,injuries]);
 const columns=Math.max(1,...rows.map(([,players])=>players.length));
 // With/without only means something for the player's own teammates.
 const impact=side===team?new Map((context.data?.withWithout||[]).map(item=>[item.id,item])):null;
 const used=new Set(rows.flatMap(([,players])=>players.map(player=>injuryCode(injured.get(player.id)))).filter(Boolean));
 const legend=[...LEGEND,...[...used].filter(code=>!LEGEND.some(([key])=>key===code)).map(code=>[code,{DTD:'Day-to-day',GTD:'Game-time decision',SUSP:'Suspended'}[code]||code])];
 const toggle=(player,kind)=>{const split=impact?.get(player.id)?.[kind];if(split?.games)onToggleFilter(splitFilter(player.id,kind,player.name,player.pos,split.gameIds));};
 return <section className="mlb-context-card wnba-depth"><header><h2><Users size={15} aria-hidden="true"/>Depth charts</h2>
  <div className="wnba-depth-teams" aria-label="Depth chart team">{[team,opponent].filter(Boolean).map(abbr=><button type="button" key={abbr} aria-pressed={side===abbr} onClick={()=>setSide(abbr)}>{teams[abbr]?.logo&&<img src={teams[abbr].logo} alt="" width="18" height="18"/>}{abbr}</button>)}</div></header>
  <div className="wnba-depth-legend">{legend.map(([code,label])=><span key={code}><b data-code={code}>{code}</b>{label}</span>)}</div>
  {league.loading&&!rotation?<div className="mlb-context-skeleton" role="status" aria-label="Loading depth chart"><span/><span/><span/></div>
  :league.error?<p className="mlb-context-note" role="status">{league.error} <button type="button" onClick={league.retry}>Retry</button></p>
  :!rotation?<p className="mlb-context-note">No games recorded for this team yet.</p>
  :<div className="wnba-depth-scroll" tabIndex={0} role="region" aria-label={`${side} depth chart; scroll for more columns`}><table className="wnba-depth-table"><thead><tr><th scope="col"><span className="finder-sr-only">Slot</span></th>{Array.from({length:columns},(_,index)=><th scope="col" key={index}>{columnLabel(index)}</th>)}</tr></thead>
   <tbody>{rows.map(([slot,players])=><tr key={slot}><th scope="row">{slot}</th>{Array.from({length:columns},(_,index)=>{const player=players[index];if(!player)return <td key={index}/>;
    const code=injuryCode(injured.get(player.id)),self=String(player.id)===String(row.playerId),effect=impact?.get(player.id);
    return <td key={index}><div className="wnba-depth-cell">
     <span className="wnba-avatar"><UserRound size={20} aria-hidden="true"/>{player.headshot&&<img src={player.headshot} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span>
     <span className="wnba-depth-name" title={`${player.name}${player.min!=null?` · ${fmt(player.min)} min over the last ${rotation.games} games`:''}`}><strong className={self?'is-self':''}>{shortName(player.name)}</strong>{code&&<em data-code={code}>{code}</em>}</span>
     {impact&&!self&&<span className="wnba-depth-actions">{[['without',UserX,'Without'],['with',UserCheck,'With']].map(([kind,Icon,label])=>{const split=effect?.[kind],pressed=hasSplit(filters,player.id,kind);
      return <button type="button" key={kind} data-kind={kind} aria-pressed={pressed} disabled={!split?.games} onClick={()=>toggle(player,kind)} aria-label={`${label} ${player.name}`} title={split?.games?`Chart: ${split.games} ${split.games===1?'game':'games'} ${kind} ${player.name}${finite(split.avg)?` · ${row.player} averaged ${fmt(split.avg)}`:''}`:`No games ${kind} ${player.name} this season`}><Icon size={15} aria-hidden="true"/></button>;})}</span>}
    </div></td>;})}</tr>)}</tbody></table></div>}
 </section>;
}

export function WNBAPlayerPage({row,playerRows,onBack}){
 const newsOn=useNewsAllowed();
 const [selected,setSelected]=useState(row),[trend,setTrend]=useState({state:'loading',rows:[]}),[retry,setRetry]=useState(0);
 // With/without choices from the depth chart or Injuries tab; the chart
 // keeps the games that match every one of them.
 const [filters,setFilters]=useState([]);
 useEffect(()=>{setSelected(row);setFilters([]);},[row]);
 const toggleFilter=useCallback(entry=>setFilters(old=>toggleSplit(old,entry)),[]);
 const removeFilter=useCallback(key=>setFilters(old=>old.filter(filter=>splitKey(filter)!==key)),[]);
 const clearFilters=useCallback(()=>setFilters([]),[]);
 useEffect(()=>{if(!row.playerId)return undefined;const controller=new AbortController();setTrend(old=>({...old,state:'loading'}));
  // The NBA page reaches back two more seasons for head to head (deep).
  fetch(basketballLogUrl(row)+(row.sport==='nba'?'&deep=1':''),{signal:controller.signal,credentials:'same-origin'})
   .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Game logs unavailable');setTrend({state:'ready',rows:data.rows||[]});})
   .catch(error=>{if(error.name!=='AbortError')setTrend({state:'error',rows:[],error:error.message});});
  return()=>controller.abort();},[row.playerId,row.sport,retry]);
 const matchup=useWnba('matchup',matchupParams(selected),Boolean(selected.homeTeamAbbr&&selected.awayTeamAbbr&&selected.startsAt));
 // His stats with no line tonight that his games can still chart (Dunks).
 const extraRows=useMemo(()=>researchRows(row,playerRows,trend.rows),[row,playerRows,trend.rows]);
 const onStat=useMemo(()=>key=>{const next=[...playerRows,...extraRows].find(item=>item.marketKey===key);if(next)setSelected(next);},[playerRows,extraRows]);
 const chartLogs=useMemo(()=>applySplits(trend.rows,filters),[trend.rows,filters]);
 const chips=useMemo(()=>filters.map(filter=>({key:splitKey(filter),kind:filter.kind,label:splitLabel(filter),title:`${filter.ids.length} of ${selected.player}'s games ${filter.kind} ${filter.name}`})),[filters,selected.player]);
 const shown=realGames(chartLogs).length;
 const chipsNote=filters.length?`${shown} ${shown===1?'game':'games'}`:'';
 const loading=trend.state==='loading';
 const sections={log:<PlayerGameLog row={selected} logs={trend.rows} loading={loading} error={trend.state==='error'} onRetry={()=>setRetry(n=>n+1)}/>,
  stats:<SupportingStats logs={trend.rows} loading={loading}/>,depth:<DepthChart row={selected} matchup={matchup.data} filters={filters} onToggleFilter={toggleFilter}/>,
  trail:<PropTrail row={selected} logs={trend.rows}/>};
 return <FinderPlayerLayout row={selected} playerRows={playerRows} onBack={onBack} blocked={!row.playerId}
  notice={!row.playerId?<div className="wnba-board-message" role="status"><Database size={22} aria-hidden="true"/><strong>Player history unavailable</strong><span>This player could not be matched to ESPN's roster yet, so trends and matchup research are not available.</span></div>
   :trend.state==='error'&&<div className="wnba-board-message" role="alert"><span>{trend.error}</span><button type="button" className="wnba-trend-back" onClick={()=>setRetry(n=>n+1)}><RefreshCw size={16} aria-hidden="true"/>Retry</button></div>}
  chart={<><TrendChart row={selected} playerRows={playerRows} extraRows={extraRows} logs={chartLogs} loading={loading} onStat={onStat} chips={chips} chipsNote={chipsNote} onChipRemove={removeFilter} onChipsClear={clearFilters}/>
   {filters.length>0&&!shown&&!loading&&<p className="wnba-filter-empty" role="status">No games match all of these together. Remove a filter to see more.</p>}</>}
  his={HIS.map(([key,label])=>[key,label,sections[key]])} research={withNews(RESEARCH_LIST,newsOn)}
  renderResearch={tab=>tab==='news'?<PlayerNews row={selected}/>:<WNBAFinderContext row={selected} logs={trend.rows} matchup={matchup} filters={filters} onToggleFilter={toggleFilter} tab={tab}/>}/>;
}
