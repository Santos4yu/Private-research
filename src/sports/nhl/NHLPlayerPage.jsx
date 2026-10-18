import React,{useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {CalendarDays,Database,ListOrdered,RefreshCw,Shield,UserCheck,UserRound,Users,UserX} from 'lucide-react';
import {FinderPlayerBanner} from '../../FinderPlayerBanner';
import {wnbaLines,wnbaOdds} from '../wnba/trend-data';
import {applySplits,finite,fmt,splitKey,toggleSplit} from '../wnba/wnba-research';
import {MARKET_ORDER,STATS,family,nhlChart,nhlLogo,nhlStatCode,playedGames,playerGames,statValue,withWithout} from './nhl-stats';
import {opponentOf,useNhl} from './nhl-finder';
import NHLFinderContext from './NHLFinderContext';
import '../../mlb-finder-context.css';
import '../wnba/wnba-context.css';
import '../nfl/nfl-finder.css';
import './nhl-player.css';
import {withLines} from '../../trend-lines';
import {Failure} from '../../AdminNotice';
import {useTrendPanel} from '../../trend-panel.js';


// The NHL player page, on the WNBA / MLB / NFL Finder pages' layout: the
// shared trend chart, supporting stats, depth chart and game log on the
// left, the tabbed matchup panel on the right. Data: /api/board?view=nhl
// (nhl_research.py) -- the team's recent games from the NHL's own box
// scores and play-by-play, ESPN's injuries and depth charts.

// One tab per stat this player has a line on, in the catalog's order.
function statTabs(playerRows){
 const labels=new Map();
 for(const item of playerRows)if(item.marketKey&&!labels.has(item.marketKey))labels.set(item.marketKey,item);
 const rank=item=>{const index=MARKET_ORDER.indexOf(item.valueKey);return index<0?MARKET_ORDER.length:index;};
 return [...labels.values()].sort((a,b)=>rank(a)-rank(b)).map(item=>({key:item.marketKey,label:item.market,code:nhlStatCode(item.valueKey,item.market)}));
}
const shortDay=(date,year=true)=>{const day=new Date(`${date}T12:00:00`);return Number.isNaN(day.getTime())?'—':day.toLocaleDateString([],{month:'numeric',day:'numeric',...(year?{year:'2-digit'}:{})});};
const shortName=name=>{const parts=String(name||'').trim().split(/\s+/);return parts.length>1?`${parts[0][0]}. ${parts.slice(1).join(' ')}`:parts[0]||'';};
const show=(key,value)=>!finite(value)?'—':key==='toi'?fmt(value,1):fmt(value,Number.isInteger(value)?0:1);

function TrendChart({row,playerRows,rows,loading,onStat,chips,chipsNote,onChipRemove,onChipsClear}){
 const host=useRef(null);
 const opponent=opponentOf(row);
 const home=row.homeTeamAbbr,away=row.awayTeamAbbr;
 const config=useMemo(()=>({sport:'NHL',player:row.player,teamAbbr:row.teamAbbr||'',teamLogo:row.teamLogo||nhlLogo(row.teamAbbr),opponent,
  opponentLogo:nhlLogo(opponent),matchupLabel:away&&home?`${away} @ ${home}`:'',
  kickoffLabel:row.startsAt?new Date(row.startsAt).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'}):'',status:'Pre-game',headshot:row.headshot||null,
  stats:withLines(statTabs(playerRows),playerRows),startsAt:row.startsAt,statKey:row.marketKey,stat:row.market,side:row.direction==='UNDER'?'Under':'Over',line:row.line,
  chart:nhlChart(rows,row.valueKey,opponent),lines:wnbaLines(playerRows,row.marketKey),linesStatus:'ready',odds:wnbaOdds(playerRows,row.marketKey),
  loading,onStat,filters:['seasonKind','opponent'],chips,chipsNote,onChipRemove,onChipsClear}),
  [row,rows,loading,onStat,opponent,home,away,chips,chipsNote,onChipRemove,onChipsClear,playerRows]);
 const ready=useTrendPanel(host,config);
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
  {games.length?<div className="mlb-support-chart">{games.map((game,index)=>{const value=statValue(game,key);return <div key={game.gameId||index}><div className="mlb-support-track"><div style={{height:finite(value)?`${value/max*100}%`:'0%'}}><span>{show(key,value)}</span></div></div><small>{shortDay(game.date,false)}<br/>{game.isHome===false?'@':''}{game.opponent}</small></div>;})}</div>
  :<p className="mlb-context-note">{loading?'Loading game logs…':'Supporting game logs are not available yet.'}</p>}
 </section>;
}

// ESPN's depth chart: a row per position (LW, C, RW, LD, RD, G), a column
// per line, both teams.
function DepthChart({row,log,filters,onToggleFilter}){
 const team=row.teamAbbr,opponent=opponentOf(row);
 const [side,setSide]=useState(team);
 useEffect(()=>setSide(row.teamAbbr),[row.teamAbbr]);
 const data=useNhl('team',{team:side},Boolean(side));
 const groups=(data.data?.depth||[]).filter(group=>group.players.length);
 const injured=new Map((data.data?.injuries||[]).filter(item=>item.id).map(item=>[String(item.id),item]));
 const columns=Math.max(1,...groups.map(group=>group.players.length));
 const impact=useMemo(()=>side===team&&log.data?withWithout(log.data,row.playerId,row.valueKey):null,[side,team,log.data,row.playerId,row.valueKey]);
 const toggle=(player,slot,kind)=>{const split=impact?.[player.id]?.[kind];if(split?.games)onToggleFilter({id:String(player.id),kind,name:player.name,pos:slot,ids:split.gameIds});};
 return <section className="mlb-context-card wnba-depth nfl-depth nhl-depth"><header><h2><Users size={15} aria-hidden="true"/>Depth charts</h2>
  <div className="wnba-depth-teams" aria-label="Depth chart team">{[team,opponent].filter(Boolean).map(abbr=><button type="button" key={abbr} aria-pressed={side===abbr} onClick={()=>setSide(abbr)}><img src={nhlLogo(abbr)} alt="" width="18" height="18" onError={e=>{e.currentTarget.hidden=true;}}/>{abbr}</button>)}</div></header>
  <div className="wnba-depth-legend"><span><b data-code="OUT">OUT</b>Out for game</span><span><b data-code="DTD">DTD</b>Day to day</span></div>
  {data.loading&&!data.data?<div className="mlb-context-skeleton" role="status" aria-label="Loading depth chart"><span/><span/><span/></div>
  :data.error?<p className="mlb-context-note" role="status">{data.error} <button type="button" onClick={data.retry}>Retry</button></p>
  :!groups.length?<p className="mlb-context-note">No depth chart is published for {side} yet.</p>
  :<div className="wnba-depth-scroll" tabIndex={0} role="region" aria-label={`${side} depth chart; scroll for more columns`}><table className="wnba-depth-table nfl-depth-table"><thead><tr><th scope="col"><span className="finder-sr-only">Position</span></th>{Array.from({length:columns},(_,index)=><th scope="col" key={index}>{index===0?'Starter':['2nd','3rd','4th'][index-1]||`${index+1}th`}</th>)}</tr></thead>
   <tbody>{groups.map(group=><tr key={group.slot}><th scope="row">{group.slot}</th>{Array.from({length:columns},(_,index)=>{const player=group.players[index];if(!player)return <td key={index}/>;
    const status=player.id?injured.get(String(player.id)):null,code=status?(/out|reserve|suspen/i.test(status.status)?'OUT':'DTD'):null;
    const self=player.id&&String(player.id)===String(row.playerId),effect=player.id?impact?.[player.id]:null;
    return <td key={index}><div className="wnba-depth-cell">
     <span className="wnba-avatar"><UserRound size={20} aria-hidden="true"/>{player.headshot&&<img src={player.headshot} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span>
     <span className="wnba-depth-name" title={player.name}><strong className={self?'is-self':''}>{shortName(player.name)}</strong>{code&&<small className="nfl-depth-role"><em data-code={code}>{code}</em></small>}</span>
     {impact&&!self&&player.id&&<span className="wnba-depth-actions">{[['without',UserX,'Without'],['with',UserCheck,'With']].map(([kind,Icon,label])=>{const split=effect?.[kind],pressed=filters.some(filter=>filter.id===String(player.id)&&filter.kind===kind);
      return <button type="button" key={kind} data-kind={kind} aria-pressed={pressed} disabled={!split?.games} onClick={()=>toggle(player,group.slot,kind)} aria-label={`${label} ${player.name}`} title={split?.games?`Chart: ${split.games} ${split.games===1?'game':'games'} ${kind} ${player.name}${finite(split.avg)?` · ${row.player} averaged ${fmt(split.avg)}`:''}`:`No games ${kind} ${player.name}`}><Icon size={15} aria-hidden="true"/></button>;})}</span>}
    </div></td>;})}</tr>)}</tbody></table></div>}
 </section>;
}

function PlayerGameLog({row,rows,loading,error,onRetry,position}){
 const columns=family(position).log;
 const games=(rows||[]).slice(-15).reverse();
 return <section className="mlb-context-card mlb-player-gamelog"><header><h2><ListOrdered size={15} aria-hidden="true"/>Game log · Last 15 games</h2><small>{row.player}</small></header>
  {loading&&!games.length?<p className="mlb-context-note" role="status">Loading player game log…</p>:error&&!games.length?<Failure onRetry={onRetry} quiet="No games to show yet.">Game log could not load.</Failure>:games.length?
  <div className="mlb-player-log-scroll" tabIndex={0} role="region" aria-label={`${row.player} recent game statistics; scroll for more columns`}><table><thead><tr><th scope="col">Date</th><th scope="col">Opponent</th><th scope="col">Result</th>{columns.map(key=><th scope="col" key={key}>{STATS[key].short}</th>)}</tr></thead>
  <tbody>{games.map(game=><tr key={game.gameId} data-dnp={game.dnp}><th scope="row" title={game.date}><span className="mlb-log-date"><CalendarDays size={12} aria-hidden="true"/>{shortDay(game.date)}</span></th>
   <td><span className="mlb-log-opponent"><span className="mlb-log-logo"><Shield size={17} aria-hidden="true"/><img src={nhlLogo(game.opponent)} width="20" height="20" alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/></span><span>{game.isHome===false?'@ ':''}{game.opponent}</span></span></td>
   <td><span className="wnba-result" data-result={game.result}>{game.result||'—'}</span> {game.score||''}{game.seasonKind==='postseason'&&<small className="wnba-po-tag">PO</small>}{game.seasonKind==='preseason'&&<small className="wnba-po-tag">PRE</small>}</td>
   {columns.map(key=><td key={key}>{game.dnp?<span className="nfl-dnp">DNP</span>:show(key,statValue(game,key))}</td>)}</tr>)}</tbody></table></div>
  :<p className="mlb-context-note">No games are available for this player yet.</p>}
 </section>;
}

export function NHLPlayerPage({row,playerRows,onBack}){
 const [selected,setSelected]=useState(row),[filters,setFilters]=useState([]);
 useEffect(()=>{setSelected(row);setFilters([]);},[row]);
 const toggleFilter=useCallback(entry=>setFilters(old=>toggleSplit(old,entry)),[]);
 const removeFilter=useCallback(key=>setFilters(old=>old.filter(filter=>splitKey(filter)!==key)),[]);
 const clearFilters=useCallback(()=>setFilters([]),[]);
 const opponent=opponentOf(selected);
 const log=useNhl('log',{team:selected.teamAbbr,opponent},Boolean(selected.teamAbbr&&row.playerId));
 const rows=useMemo(()=>playerGames(log.data,row.playerId),[log.data,row.playerId]);
 const position=log.data?.players?.[row.playerId]?.pos||selected.position;
 // Switching stat keeps the tier this row came from where possible.
 const onStat=useMemo(()=>key=>{const options=playerRows.filter(item=>item.marketKey===key);const next=options.find(item=>item.modifier===selected.modifier)||options[0];if(next)setSelected(next);},[playerRows,selected.modifier]);
 const chartRows=useMemo(()=>applySplits(playedGames(rows),filters),[rows,filters]);
 const chips=useMemo(()=>filters.map(filter=>({key:splitKey(filter),kind:filter.kind,label:`${filter.kind==='without'?'W/O':'W/'} ${filter.name}${filter.pos?` (${filter.pos})`:''}`,title:`${filter.ids.length} of ${selected.player}'s games ${filter.kind} ${filter.name}`})),[filters,selected.player]);
 const shown=chartRows.length,chipsNote=filters.length?`${shown} ${shown===1?'game':'games'}`:'';
 const loading=log.loading;
 return <section className="finder-trend-view wnba-trend-page wnba-player-page nfl-player-page nhl-player-page">
  <FinderPlayerBanner row={selected} playerRows={playerRows} onBack={onBack}/>
  {!row.playerId?<div className="wnba-board-message" role="status"><Database size={22} aria-hidden="true"/><strong>Player history unavailable</strong><span>This player could not be matched to an NHL roster yet, so trends and matchup research are not available.</span></div>:<>
  {log.error&&<div className="wnba-board-message" role="alert"><span>{log.error}</span><button type="button" className="wnba-trend-back" onClick={log.retry}><RefreshCw size={16} aria-hidden="true"/>Retry</button></div>}
  <div className="mlb-finder-workspace"><div className="mlb-trend-main">
   <TrendChart row={selected} playerRows={playerRows} rows={chartRows} loading={loading} onStat={onStat} chips={chips} chipsNote={chipsNote} onChipRemove={removeFilter} onChipsClear={clearFilters}/>
   {filters.length>0&&!shown&&!loading&&<p className="wnba-filter-empty" role="status">No games match all of these together. Remove a filter to see more.</p>}
   <SupportingStats rows={rows} position={position} loading={loading}/>
   <DepthChart row={selected} log={log} filters={filters} onToggleFilter={toggleFilter}/>
   <PlayerGameLog row={selected} rows={rows} loading={loading} error={Boolean(log.error)} onRetry={log.retry} position={position}/>
  </div>
  <NHLFinderContext row={selected} playerRows={playerRows} rows={rows} log={log} position={position} filters={filters} onToggleFilter={toggleFilter}/></div></>}
 </section>;
}
