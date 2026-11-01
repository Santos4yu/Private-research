import React,{useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {CalendarDays,Database,ListOrdered,PieChart,RefreshCw,Shield,UserCheck,UserRound,Users,UserX} from 'lucide-react';
import {FinderPlayerLayout} from '../../FinderPlayerLayout';
import {nflLineLadder,nflOddsRows,nflStatCode} from './trend-bridge';
import {INJURY_LEGEND,MARKET_ORDER,PBP_MARKETS,STATS,family,gameIdOf,injuryCode,mergePlayByPlay,nflFinderChart,nflSeason,opponentOf,playedGames,positionOf,seedGames,teamColor,useNfl} from './nfl-finder';
import {applySplits,finite,fmt,splitKey,toggleSplit} from '../wnba/wnba-research';
import NFLFinderContext,{NFL_TABS} from './NFLFinderContext';
import PlayerNews,{useNewsAllowed,withNews} from '../../PlayerNews';
import '../../mlb-finder-context.css';
import '../wnba/wnba-context.css';
import './nfl-finder.css';
import {withLines} from '../../trend-lines';
import {Failure} from '../../AdminNotice';
import {useTrendPanel} from '../../trend-panel.js';


// The NFL player page, on the Finder's shared player layout
// (FinderPlayerLayout.jsx, the NBA page's): the shared trend chart with his
// Game log, Stats, Depth and team Usage under it, the tabbed matchup panel
// beside it. Data: /api/nfl's
// finder-* resources (backend/sports/nfl/finder.py).

// Markets the player page can research: the context resources (similar
// players, with/without splits) speak weekly stats, so play-by-play markets
// borrow their closest weekly one. Punting and markets we don't chart have
// none, and skip that request.
const CONTEXT_BASE={longest_reception:'receiving_yards',rec_yards_first_2:'receiving_yards',longest_rush:'rushing_yards',
 rush_yards_first_5:'rushing_yards',longest_completion:'passing_yards',completion_pct:'pass_completions',quarters_25_pass_yds:'passing_yards',
 yards_per_carry:'rushing_yards',first_rush_yards:'rushing_yards',quarters_5_rush_yds:'rushing_yards',halves_25_rush_yds:'rushing_yards',
 quarters_1_rec:'receptions',quarters_5_rec_yds:'receiving_yards',halves_25_rec_yds:'receiving_yards'};
const NO_CONTEXT=new Set(['punts','punts_inside_20','gross_punt_yards','punts_50_plus']);
const CONTEXT_MARKET=market=>!market||NO_CONTEXT.has(market)||String(market).startsWith('pp:')?null:CONTEXT_BASE[market]||market;
// One tab per market this player has a line on, in the catalog's order.
function statTabs(playerRows){
 const labels=new Map();
 for(const item of playerRows)if(item.marketKey&&!labels.has(item.marketKey))labels.set(item.marketKey,item.market);
 const rank=key=>{const index=MARKET_ORDER.indexOf(key);return index<0?MARKET_ORDER.length:index;};
 return [...labels].sort((a,b)=>rank(a[0])-rank(b[0])).map(([key,label])=>({key,label,code:nflStatCode(key,label)}));
}
const offersFor=(rows,market)=>(rows||[]).filter(row=>row.marketKey===market&&row.raw?.line).map(row=>row.raw);
const shortDay=date=>{const day=new Date(`${date}T12:00:00`);return Number.isNaN(day.getTime())?'—':day.toLocaleDateString([],{month:'numeric',day:'numeric',year:'2-digit'});};
const shortName=name=>{const parts=String(name||'').trim().split(/\s+/);return parts.length>1?`${parts[0][0]}. ${parts.slice(1).join(' ')}`:parts[0]||'';};

function TrendChart({row,playerRows,rows,loading,onStat,chips,chipsNote,onChipRemove,onChipsClear}){
 const host=useRef(null);
 const opponent=opponentOf(row);
 const offers=useMemo(()=>offersFor(playerRows,row.marketKey),[playerRows,row.marketKey]);
 const home=row.homeTeamAbbr,away=row.awayTeamAbbr;
 const config=useMemo(()=>({sport:'NFL',player:row.player,teamAbbr:row.teamAbbr||'',teamLogo:row.teamLogo||'',opponent,
  opponentLogo:opponent?`https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${opponent}.svg`:'',matchupLabel:away&&home?`${away} @ ${home}`:'',
  kickoffLabel:row.startsAt?new Date(row.startsAt).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'}):'',status:'Pre-game',headshot:row.headshot||null,
  stats:withLines(statTabs(playerRows),playerRows),startsAt:row.startsAt,statKey:row.marketKey,stat:row.market,
  side:row.direction==='UNDER'?'Under':'Over',line:row.line,chart:nflFinderChart(rows,row.marketKey,opponent),lines:nflLineLadder(offers),linesStatus:'ready',
  odds:nflOddsRows(offers),loading,onStat,filters:['seasonKind'],chips,chipsNote,onChipRemove,onChipsClear}),
  [row,rows,loading,onStat,opponent,offers,home,away,chips,chipsNote,onChipRemove,onChipsClear,playerRows]);
 const ready=useTrendPanel(host,config);
 return <>{!ready&&<div className="wnba-board-message" role="status"><Database size={22} aria-hidden="true"/><strong>Trends could not open</strong><span>Refresh the page to reload player research.</span></div>}<div className="wnba-trend-host finder-mlb-trend-host" ref={host}/></>;
}

function SupportingStats({rows,position,loading}){
 const keys=family(position).support;
 const [selected,setSelected]=useState(0);
 useEffect(()=>setSelected(0),[position]);
 const games=playedGames(rows).slice(-10),stat=STATS[keys[Math.min(selected,keys.length-1)]];
 const max=Math.max(1,...games.map(stat.get).filter(finite));
 return <section className="mlb-context-card mlb-supporting"><header><h2>Supporting stats</h2><small>Last {games.length||'—'} games</small></header>
  <div className="mlb-support-tabs">{keys.map((key,index)=>{const values=games.map(STATS[key].get).filter(finite);return <button type="button" key={key} aria-pressed={selected===index} onClick={()=>setSelected(index)}>{STATS[key].label}<strong>{values.length?fmt(values.reduce((a,b)=>a+b,0)/values.length):'—'} <small>avg.</small></strong></button>;})}</div>
  {games.length?<div className="mlb-support-chart">{games.map((game,index)=>{const value=stat.get(game);return <div key={game.gameId||index}><div className="mlb-support-track"><div style={{height:finite(value)?`${value/max*100}%`:'0%'}}><span>{finite(value)?fmt(value):'—'}</span></div></div><small>{shortDay(game.date)}<br/>{game.isHome===false?'@':''}{game.opponent}</small></div>;})}</div>
  :<p className="mlb-context-note">{loading?'Loading game logs…':'Supporting game logs are not available yet.'}</p>}
 </section>;
}

// nflverse's published depth chart: a row per slot (QB, RB, WR · Left...),
// a column per depth, both teams, offense / defense / special teams.
const UNITS=[['offense','Offense'],['defense','Defense'],['special','Special Teams']];
function roleLabel(group,index){
 const [position,side]=String(group.label).split(' · ');
 return side?`${side} ${position}${index+1}`:`${group.position||position}${index+1}`;
}
function DepthChart({row,season,context,filters,onToggleFilter}){
 const team=row.teamAbbr,opponent=opponentOf(row);
 const [side,setSide]=useState(team),[unit,setUnit]=useState('offense');
 useEffect(()=>setSide(row.teamAbbr),[row.teamAbbr]);
 const data=useNfl('team',{season,team:side},Boolean(side));
 const depth=data.data?.depth,groups=depth?.[unit]||[];
 const injured=new Map((data.data?.injuries||[]).map(item=>[item.id,item]));
 const columns=Math.max(1,...groups.map(group=>group.players.length));
 const impact=side===team?new Map((context.data?.withWithout||[]).map(item=>[item.id,item])):null;
 const toggle=(player,kind)=>{const split=impact?.get(player.id)?.[kind];if(split?.games)onToggleFilter({id:String(player.id),kind,name:player.name,pos:player.role?.split(' ').pop()||'',ids:split.gameIds});};
 return <section className="mlb-context-card wnba-depth nfl-depth"><header><h2><Users size={15} aria-hidden="true"/>Depth charts</h2>
  <div className="wnba-depth-teams" aria-label="Depth chart team">{[team,opponent].filter(Boolean).map(abbr=><button type="button" key={abbr} aria-pressed={side===abbr} onClick={()=>setSide(abbr)}><img src={`https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${abbr}.svg`} alt="" width="18" height="18" onError={e=>{e.currentTarget.hidden=true;}}/>{abbr}</button>)}</div></header>
  <div className="mlb-context-switch nfl-depth-units" aria-label="Unit">{UNITS.map(([key,label])=><button type="button" key={key} aria-pressed={unit===key} onClick={()=>setUnit(key)}>{label}</button>)}</div>
  <div className="wnba-depth-legend">{INJURY_LEGEND.map(([code,label])=><span key={code}><b data-code={code}>{code}</b>{label}</span>)}</div>
  {data.loading&&!depth?<div className="mlb-context-skeleton" role="status" aria-label="Loading depth chart"><span/><span/><span/></div>
  :data.error?<p className="mlb-context-note" role="status">{data.error} <button type="button" onClick={data.retry}>Retry</button></p>
  :!groups.length?<p className="mlb-context-note">No depth chart is published for {side} yet.</p>
  :<div className="wnba-depth-scroll" tabIndex={0} role="region" aria-label={`${side} depth chart; scroll for more columns`}><table className="wnba-depth-table nfl-depth-table"><thead><tr><th scope="col"><span className="finder-sr-only">Position</span></th>{Array.from({length:columns},(_,index)=><th scope="col" key={index}>{index===0?'Starter':['2nd','3rd','4th','5th','6th'][index-1]||`${index+1}th`}</th>)}</tr></thead>
   <tbody>{groups.map(group=><tr key={group.slot}><th scope="row">{group.label}</th>{Array.from({length:columns},(_,index)=>{const player=group.players[index];if(!player)return <td key={index}/>;
    const status=injured.get(player.id),code=injuryCode(status),self=String(player.id)===String(row.playerId),effect=impact?.get(player.id);
    const labelled={...player,role:roleLabel(group,index)};
    return <td key={index}><div className="wnba-depth-cell">
     <span className="wnba-avatar"><UserRound size={20} aria-hidden="true"/>{player.headshot&&<img src={player.headshot} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span>
     <span className="wnba-depth-name" title={player.name}><strong className={self?'is-self':''}>{shortName(player.name)}</strong><small className="nfl-depth-role">{labelled.role}{code&&<em data-code={code}>{code}</em>}</small></span>
     {impact&&!self&&<span className="wnba-depth-actions">{[['without',UserX,'Without'],['with',UserCheck,'With']].map(([kind,Icon,label])=>{const split=effect?.[kind],pressed=filters.some(filter=>filter.id===String(player.id)&&filter.kind===kind);
      return <button type="button" key={kind} data-kind={kind} aria-pressed={pressed} disabled={!split?.games} onClick={()=>toggle(labelled,kind)} aria-label={`${label} ${player.name}`} title={split?.games?`Chart: ${split.games} ${split.games===1?'game':'games'} ${kind} ${player.name}${finite(split.avg)?` · ${row.player} averaged ${fmt(split.avg)}`:''}`:`No games ${kind} ${player.name}`}><Icon size={15} aria-hidden="true"/></button>;})}</span>}
    </div></td>;})}</tr>)}</tbody></table></div>}
 </section>;
}

// Team usage: how often the team throws, and who gets the ball.
const SHARE_COLORS=['#e5484d','#35c77e','#5cf8b2','#f4c53f','#00f58a','#ec4899','#84cc16','#00f58a','#f97316','#14b8a6','#a3a3a3','#eab308'];
function TeamUsage({row,league}){
 const team=row.teamAbbr,[field,setField]=useState('targets');
 const passRun=league.data?.passRun?.[team],share=league.data?.share?.[team]?.[field]||[];
 const total=passRun?passRun.passes+passRun.runs:0;
 let start=0;
 const top=share.slice(0,11),rest=share.slice(11).reduce((sum,item)=>sum+item.share,0);
 const segments=[...top.map((item,index)=>({...item,color:SHARE_COLORS[index%SHARE_COLORS.length]})),...(rest>0?[{id:'rest',name:'Others',share:rest,color:'#585f63'}]:[])];
 const gradient=segments.map(item=>{const from=start;start+=item.share;return `${item.color} ${from}% ${start}%`;}).join(',');
 return <>
  <section className="mlb-context-card nfl-pass-run"><header><h2>{team} Pass vs Run Rate</h2><small>{league.data?.season} Season</small></header>
   {total?<div className="nfl-pass-run-body"><div className="nfl-pass-run-labels"><span>{fmt(passRun.passes/total*100,0)}% ({passRun.passes} passes)</span><span>{fmt(passRun.runs/total*100,0)}% ({passRun.runs} runs)</span></div>
    <span className="nfl-pass-run-bar" role="img" aria-label={`${team} passes on ${fmt(passRun.passes/total*100,0)}% of plays`}><i style={{width:`${passRun.passes/total*100}%`}}/></span></div>
   :<p className="mlb-context-note">{league.loading?'Loading team plays…':'No plays recorded for this team yet.'}</p>}
  </section>
  <section className="mlb-context-card nfl-share"><header><h2><PieChart size={15} aria-hidden="true"/>{team} Rush/Target Share</h2><small>{league.data?.season} Season</small></header>
   <div className="mlb-context-switch nfl-share-switch" aria-label="Share of">{[['carries','Rush Att'],['targets','Targets']].map(([key,label])=><button type="button" key={key} aria-pressed={field===key} onClick={()=>setField(key)}>{label}</button>)}</div>
   {share.length?<><div className="nfl-donut" role="img" aria-label={segments.map(item=>`${item.name} ${fmt(item.share)}%`).join(', ')} style={{background:`conic-gradient(${gradient})`}}><span>{field==='targets'?'Targets':'Rush Att'}</span></div>
    <div className="mlb-context-table-wrap"><table className="nfl-share-table"><thead><tr><th scope="col">Player</th><th scope="col">{field==='targets'?'Targets':'Rush Att'}</th><th scope="col">{field==='targets'?'Target %':'Rush %'}</th></tr></thead><tbody>
     {top.map((item,index)=><tr key={item.id} data-current={String(item.id)===String(row.playerId)}><th scope="row"><span className="nfl-share-player"><span className="wnba-avatar"><UserRound size={16} aria-hidden="true"/>{item.headshot&&<img src={item.headshot} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}<i style={{background:SHARE_COLORS[index%SHARE_COLORS.length]}}/></span><strong>{shortName(item.name)}</strong><small>{item.pos}</small></span></th><td>{item.value}</td><td>{fmt(item.share)}%</td></tr>)}
    </tbody></table></div></>
   :<p className="mlb-context-note">{league.loading?'Loading team usage…':'No usage recorded for this team yet.'}</p>}
  </section>
 </>;
}

function PlayerGameLog({row,rows,loading,error,onRetry,position}){
 const columns=family(position).log;
 const games=(rows||[]).slice(-15).reverse();
 return <section className="mlb-context-card mlb-player-gamelog"><header><h2><ListOrdered size={15} aria-hidden="true"/>Game log · Last 15 games</h2><small>{row.player}</small></header>
  {loading&&!games.length?<p className="mlb-context-note" role="status">Loading player game log…</p>:error&&!games.length?<Failure onRetry={onRetry} quiet="No games to show yet.">Game log could not load.</Failure>:games.length?
  <div className="mlb-player-log-scroll" tabIndex={0} role="region" aria-label={`${row.player} recent game statistics; scroll for more columns`}><table><thead><tr><th scope="col">Date</th><th scope="col">Opponent</th><th scope="col">Result</th>{columns.map(key=><th scope="col" key={key}>{STATS[key].short}</th>)}</tr></thead>
  <tbody>{games.map(game=><tr key={game.gameId} data-dnp={game.dnp}><th scope="row" title={game.date}><span className="mlb-log-date"><CalendarDays size={12} aria-hidden="true"/>{shortDay(game.date)}</span></th>
   <td><span className="mlb-log-opponent"><span className="mlb-log-logo"><Shield size={17} aria-hidden="true"/><img src={`https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${game.opponent}.svg`} width="20" height="20" alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/></span><span>{game.isHome===false?'@ ':''}{game.opponent}</span></span></td>
   <td><span className="wnba-result" data-result={game.result}>{game.result||'—'}</span> {game.score||''}{game.seasonKind==='postseason'&&<small className="wnba-po-tag">PO</small>}{game.seasonKind==='preseason'&&<small className="wnba-po-tag">PRE</small>}</td>
   {columns.map(key=>{const value=STATS[key].get(game);return <td key={key}>{game.dnp?<span className="nfl-dnp">DNP</span>:finite(value)?fmt(value,Number.isInteger(value)?0:1):'—'}</td>;})}</tr>)}</tbody></table></div>
  :<p className="mlb-context-note">No games are available for this player yet.</p>}
 </section>;
}

export function NFLPlayerPage({row,playerRows,onBack}){
 const newsOn=useNewsAllowed();
 const season=nflSeason();
 const [selected,setSelected]=useState(row),[filters,setFilters]=useState([]);
 useEffect(()=>{setSelected(row);setFilters([]);},[row]);
 const toggleFilter=useCallback(entry=>setFilters(old=>toggleSplit(old,entry)),[]);
 const removeFilter=useCallback(key=>setFilters(old=>old.filter(filter=>splitKey(filter)!==key)),[]);
 const clearFilters=useCallback(()=>setFilters([]),[]);
 const log=useNfl('log',{season,playerId:row.playerId},Boolean(row.playerId));
 const pbp=useNfl('pbp',{season,playerId:row.playerId},Boolean(row.playerId));
 const league=useNfl('league',{season});
 const opponent=opponentOf(selected);
 const contextMarket=CONTEXT_MARKET(selected.marketKey);
 const context=useNfl('player',{season,playerId:row.playerId,team:selected.teamAbbr,opponent,market:contextMarket,line:contextMarket===selected.marketKey?selected.line:''},
  Boolean(row.playerId&&selected.teamAbbr&&opponent&&contextMarket));
 const matchup=useNfl('matchup',{season,gameId:gameIdOf(selected)},Boolean(gameIdOf(selected)));
 const weather=useNfl('weather',{season});
 const rows=useMemo(()=>mergePlayByPlay(log.data?.rows,pbp.data),[log.data,pbp.data]);
 const position=positionOf(log.data?.player?.position||selected.position);
 // Switching stat keeps the book/tier this row came from where possible.
 const onStat=useMemo(()=>key=>{const options=playerRows.filter(item=>item.marketKey===key);const next=options.find(item=>item.apps?.some(app=>app.key==='prizepicks'))||options[0];if(next)setSelected(next);},[playerRows]);
 // Until the full log (and, for a play-by-play stat, the play-by-play) is
 // in, the chart draws from the games the Finder already has.
 const seed=useMemo(()=>seedGames(playerRows),[playerRows]);
 const needsPbp=PBP_MARKETS.has(selected.marketKey);
 const complete=Boolean(log.data)&&(!needsPbp||Boolean(pbp.data||pbp.error));
 const seeded=!complete&&!filters.length&&seed.some(game=>finite(game.values[selected.marketKey]));
 const chartRows=useMemo(()=>seeded?playedGames(seed):applySplits(playedGames(rows),filters),[seeded,seed,rows,filters]);
 const chips=useMemo(()=>filters.map(filter=>({key:splitKey(filter),kind:filter.kind,label:`${filter.kind==='without'?'W/O':'W/'} ${filter.name}${filter.pos?` (${filter.pos})`:''}`,title:`${filter.ids.length} of ${selected.player}'s games ${filter.kind} ${filter.name}`})),[filters,selected.player]);
 const shown=chartRows.length,chipsNote=filters.length?`${shown} ${shown===1?'game':'games'}`:'';
 const loading=log.loading;
 const chartLoading=!seeded&&(log.loading||(needsPbp&&pbp.loading));
 const his=[['log','Game log',<PlayerGameLog row={selected} rows={rows} loading={loading} error={Boolean(log.error)} onRetry={log.retry} position={position}/>],
  ['stats','Stats',<SupportingStats rows={rows} position={position} loading={loading}/>],
  ['depth','Depth',<DepthChart row={selected} season={season} context={context} filters={filters} onToggleFilter={toggleFilter}/>],
  ['usage','Usage',<TeamUsage row={selected} league={league}/>]];
 return <FinderPlayerLayout row={selected} playerRows={playerRows} onBack={onBack} className="nfl-player-page" style={{'--nfl-team':teamColor(selected.teamAbbr)}} blocked={!row.playerId}
  notice={!row.playerId?<div className="wnba-board-message" role="status"><Database size={22} aria-hidden="true"/><strong>Player history unavailable</strong><span>This player could not be matched to nflverse's roster yet, so trends and matchup research are not available.</span></div>
   :log.error&&<div className="wnba-board-message" role="alert"><span>{log.error}</span><button type="button" className="wnba-trend-back" onClick={log.retry}><RefreshCw size={16} aria-hidden="true"/>Retry</button></div>}
  chart={<><TrendChart row={selected} playerRows={playerRows} rows={chartRows} loading={chartLoading} onStat={onStat} chips={chips} chipsNote={chipsNote} onChipRemove={removeFilter} onChipsClear={clearFilters}/>
   {filters.length>0&&!shown&&!loading&&<p className="wnba-filter-empty" role="status">No games match all of these together. Remove a filter to see more.</p>}</>}
  his={his} research={withNews(NFL_TABS,newsOn)}
  renderResearch={tab=>tab==='news'?<PlayerNews row={selected}/>:<NFLFinderContext row={selected} playerRows={playerRows} season={season} rows={rows} position={position} league={league} matchup={matchup} weather={weather} context={context} pbp={pbp} filters={filters} onToggleFilter={toggleFilter} tab={tab}/>}/>;
}
