import React,{useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,CalendarDays,Database,ListOrdered,RefreshCw,Shield,UserCheck,UserRound,Users,UserX} from 'lucide-react';
import {WNBA_STATS,wnbaChart,wnbaLines,wnbaOdds} from './trend-data';
import WNBAFinderContext from './WNBAFinderContext';
import {FinderPlayerBanner} from '../../FinderPlayerBanner';
import {basketballLogUrl} from '../../unified-finder-data';
import {applySplits,finite,fmt,hasPlayerContext,hasSplit,leagueOf,logValue,opponentOf,playerContextParams,positionOf,realGames,shortDate,splitFilter,splitKey,splitLabel,toggleSplit,useWnba} from './wnba-research';
import '../../mlb-finder-context.css';
import './wnba-context.css';
import {withLines} from '../../trend-lines';
import {Failure} from '../../AdminNotice';
import {useTrendPanel} from '../../trend-panel.js';


// The WNBA player page, on the MLB Finder page's exact layout: the shared
// trend chart, supporting stats and game log on the left, the tabbed
// matchup panel on the right (MLBTrends in FinderTrendView.jsx).

// The known stats in their usual order, then any other market PrizePicks
// posts for this player (shown by its own name; no history to chart yet).
function statTabs(playerRows,available){
 const known=WNBA_STATS.filter(stat=>available.has(stat.key));
 const extra=[...available].filter(key=>key&&!WNBA_STATS.some(stat=>stat.key===key)).map(key=>{
  const label=playerRows.find(item=>item.marketKey===key)?.market||key;
  return {key,label,code:label.replace(/[^A-Za-z0-9+]/g,'').slice(0,5).toUpperCase()};
 });
 return [...known,...extra];
}
function TrendChart({row,playerRows,logs,loading,onStat,chips,chipsNote,onChipRemove,onChipsClear}){
 const host=useRef(null);
 // Each game's usage rate and who sat out, for the chart's game cards.
 const notes=useWnba('game-notes',{playerId:row.playerId,league:leagueOf(row)},Boolean(row.playerId));
 const games=notes.data?.games;
 const opponent=opponentOf(row),available=new Set(playerRows.map(item=>item.marketKey));
 const config=useMemo(()=>({sport:row.sport==='nba'?'NBA':'WNBA',player:row.player,teamAbbr:row.teamAbbr||'',teamLogo:row.teamLogo||'',opponent:opponent||'',
  opponentLogo:row.team===row.homeTeam?row.awayTeamLogo:row.homeTeamLogo,matchupLabel:`${row.awayTeam} @ ${row.homeTeam}`,
  kickoffLabel:new Date(row.startsAt).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'}),status:'Pre-game',headshot:row.headshot||null,
  stats:withLines(statTabs(playerRows,available),playerRows),startsAt:row.startsAt,statKey:row.marketKey,stat:row.market,side:row.direction==='UNDER'?'Under':'Over',line:row.line,
  chart:wnbaChart(logs,row.marketKey,opponent,games),lines:wnbaLines(playerRows,row.marketKey),linesStatus:'ready',odds:wnbaOdds(playerRows,row.marketKey),loading,onStat,
  filters:['seasonKind'],chips,chipsNote,onChipRemove,onChipsClear}),
  [row,playerRows,logs,loading,onStat,opponent,chips,chipsNote,onChipRemove,onChipsClear,games]);
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

// ESPN publishes no WNBA depth chart, so this is built from the rotation each
// coach has actually used: last game's starters fill the five slots by
// position, then the bench joins its position's rows by minutes, and anyone
// on the injury report who hasn't been playing joins at the end.
const SLOTS=[['G1','G'],['G2','G'],['F1','F'],['F2','F'],['C','C']];
// A starter with no slot left at her own position (a third guard, say) takes
// the nearest open one.
const OVERFLOW={G:['F1','F2','C'],F:['C','F2','F1','G2','G1'],C:['F2','F1','G2','G1']};
const BENCH_ROWS={G:['G1','G2'],F:['F1','F2'],C:['C']};
function depthRows(players,injuries){
 const rows=Object.fromEntries(SLOTS.map(([slot])=>[slot,[]]));
 const starters=players.filter(player=>player.lastStart).sort((a,b)=>b.min-a.min),overflow=[];
 for(const player of starters){const slot=SLOTS.find(([name,position])=>position===positionOf(player.pos)&&!rows[name].length);if(slot)rows[slot[0]].push(player);else overflow.push(player);}
 for(const player of overflow){const slot=(OVERFLOW[positionOf(player.pos)]||SLOTS.map(([name])=>name)).find(name=>!rows[name].length);if(slot)rows[slot].push(player);}
 const inRotation=new Set(players.map(player=>player.id));
 const bench=[...players.filter(player=>!player.lastStart).sort((a,b)=>b.min-a.min),
  ...injuries.filter(item=>item.id&&!inRotation.has(item.id)).map(item=>({id:item.id,name:item.name,pos:item.position,headshot:item.headshot,min:null,injuredOnly:true}))];
 for(const player of bench){const options=BENCH_ROWS[positionOf(player.pos)]||['F1','F2'];rows[options.reduce((best,name)=>rows[name].length<rows[best].length?name:best,options[0])].push(player);}
 return SLOTS.map(([slot])=>[slot,rows[slot]]);
}
const INJURY_CODES={OUT:'OUT',O:'OUT',OFS:'OFS',D:'DOUBT',DOUBTFUL:'DOUBT',Q:'Q',QUESTIONABLE:'Q',GTD:'GTD','DAY-TO-DAY':'DTD',DTD:'DTD',SUSP:'SUSP'};
const LEGEND=[['OUT','Out for game'],['Q','Questionable'],['DOUBT','Doubtful'],['OFS','Out for season']];
const injuryCode=item=>item?INJURY_CODES[String(item.code||item.status||'').toUpperCase()]||String(item.code||item.status||'').toUpperCase():null;
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
 const rows=useMemo(()=>rotation?depthRows(rotation.players,injuries):[],[rotation,injuries]);
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
 const [selected,setSelected]=useState(row),[trend,setTrend]=useState({state:'loading',rows:[]}),[retry,setRetry]=useState(0);
 // With/without choices from the depth chart or Injuries tab; the chart
 // keeps the games that match every one of them.
 const [filters,setFilters]=useState([]);
 useEffect(()=>{setSelected(row);setFilters([]);},[row]);
 const toggleFilter=useCallback(entry=>setFilters(old=>toggleSplit(old,entry)),[]);
 const removeFilter=useCallback(key=>setFilters(old=>old.filter(filter=>splitKey(filter)!==key)),[]);
 const clearFilters=useCallback(()=>setFilters([]),[]);
 useEffect(()=>{if(!row.playerId)return undefined;const controller=new AbortController();setTrend(old=>({...old,state:'loading'}));
  fetch(basketballLogUrl(row),{signal:controller.signal,credentials:'same-origin'})
   .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Game logs unavailable');setTrend({state:'ready',rows:data.rows||[]});})
   .catch(error=>{if(error.name!=='AbortError')setTrend({state:'error',rows:[],error:error.message});});
  return()=>controller.abort();},[row.playerId,row.sport,retry]);
 const matchup=useWnba('matchup',{home:selected.homeTeamAbbr,away:selected.awayTeamAbbr,startsAt:selected.startsAt,league:leagueOf(selected)},Boolean(selected.homeTeamAbbr&&selected.awayTeamAbbr&&selected.startsAt));
 const onStat=useMemo(()=>key=>{const next=playerRows.find(item=>item.marketKey===key);if(next)setSelected(next);},[playerRows]);
 const chartLogs=useMemo(()=>applySplits(trend.rows,filters),[trend.rows,filters]);
 const chips=useMemo(()=>filters.map(filter=>({key:splitKey(filter),kind:filter.kind,label:splitLabel(filter),title:`${filter.ids.length} of ${selected.player}'s games ${filter.kind} ${filter.name}`})),[filters,selected.player]);
 const shown=realGames(chartLogs).length;
 const chipsNote=filters.length?`${shown} ${shown===1?'game':'games'}`:'';
 const loading=trend.state==='loading';
 return <section className="finder-trend-view wnba-trend-page wnba-player-page">
  <FinderPlayerBanner row={selected} playerRows={playerRows} onBack={onBack}/>
  {!row.playerId?<div className="wnba-board-message" role="status"><Database size={22} aria-hidden="true"/><strong>Player history unavailable</strong><span>This player could not be matched to ESPN's roster yet, so trends and matchup research are not available.</span></div>:<>
  {trend.state==='error'&&<div className="wnba-board-message" role="alert"><span>{trend.error}</span><button type="button" className="wnba-trend-back" onClick={()=>setRetry(n=>n+1)}><RefreshCw size={16} aria-hidden="true"/>Retry</button></div>}
  <div className="mlb-finder-workspace"><div className="mlb-trend-main">
   <TrendChart row={selected} playerRows={playerRows} logs={chartLogs} loading={loading} onStat={onStat} chips={chips} chipsNote={chipsNote} onChipRemove={removeFilter} onChipsClear={clearFilters}/>
   {filters.length>0&&!shown&&!loading&&<p className="wnba-filter-empty" role="status">No games match all of these together. Remove a filter to see more.</p>}
   <SupportingStats logs={trend.rows} loading={loading}/>
   <DepthChart row={selected} matchup={matchup.data} filters={filters} onToggleFilter={toggleFilter}/>
   <PlayerGameLog row={selected} logs={trend.rows} loading={loading} error={trend.state==='error'} onRetry={()=>setRetry(n=>n+1)}/>
  </div>
  <WNBAFinderContext row={selected} logs={trend.rows} matchup={matchup} filters={filters} onToggleFilter={toggleFilter}/></div></>}
 </section>;
}
