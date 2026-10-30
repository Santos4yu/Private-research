import React,{useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {CalendarDays,Database,ListOrdered,PieChart,RefreshCw,Shield,UserCheck,UserRound,Users,UserX} from 'lucide-react';
import {FinderPlayerLayout} from '../../FinderPlayerLayout';
import {loadCfbLog} from '../../unified-finder-data';
import {wnbaLines,wnbaOdds} from '../wnba/trend-data';
import {applySplits,finite,fmt,splitKey,toggleSplit} from '../wnba/wnba-research';
import {STATS,cfbChart,cfbLogo,cfbStatCode,family,playedGames,playerGames,statValue,withWithout} from './cfb-stats';
import {INJURY_LEGEND,cfbSeason,injuryCode,opponentOf,useCfb} from './cfb-finder';
import CFBFinderContext,{CFB_TABS} from './CFBFinderContext';
import '../../mlb-finder-context.css';
import '../wnba/wnba-context.css';
import '../nfl/nfl-finder.css';
import {Failure} from '../../AdminNotice';
import {useTrendPanel} from '../../trend-panel.js';

// The college football player page, on the Finder's shared player layout
// (FinderPlayerLayout.jsx, the NBA page's): the shared trend chart with his
// Game log, Stats, Depth and team Usage under it; the tabbed matchup panel
// (CFBFinderContext.jsx) beside it. Data: /api/board?view=cfb (cfb_research.py) -- every FBS game's
// box score from ESPN.

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

function TrendChart({row,playerRows,rows,loading,onStat,chips,chipsNote,onChipRemove,onChipsClear}){
 const host=useRef(null);
 const opponent=opponentOf(row);
 const home=row.homeTeamAbbr,away=row.awayTeamAbbr;
 const config=useMemo(()=>({sport:'CFB',player:row.player,teamAbbr:row.teamAbbr||'',teamLogo:row.teamLogo||cfbLogo(row.teamId),opponent,
  opponentLogo:row.opponentLogo||cfbLogo(row.opponentId),matchupLabel:away&&home?`${away} @ ${home}`:'',
  kickoffLabel:row.startsAt?new Date(row.startsAt).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'}):'',status:'Pre-game',headshot:row.headshot||null,
  stats:statTabs(playerRows),statKey:row.marketKey,stat:row.market,side:row.direction==='UNDER'?'Under':'Over',line:row.line,
  chart:cfbChart(rows,row.valueKey,opponent),lines:wnbaLines(playerRows,row.marketKey),linesStatus:'ready',odds:wnbaOdds(playerRows,row.marketKey),
  loading,onStat,filters:['seasonKind','opponent'],chips,chipsNote,onChipRemove,onChipsClear}),
  [row,rows,loading,onStat,opponent,home,away,playerRows,chips,chipsNote,onChipRemove,onChipsClear]);
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
  {games.length?<div className="mlb-support-chart">{games.map((game,index)=>{const value=statValue(game,key);return <div key={game.gameId||index}><div className="mlb-support-track"><div style={{height:finite(value)?`${Math.max(0,value)/max*100}%`:'0%'}}><span>{show(value)}</span></div></div><small>{shortDay(game.date,false)}<br/>{game.isHome===false?'@':''}{game.opponent}</small></div>;})}</div>
  :<p className="mlb-context-note">{loading?'Loading game logs…':'Supporting game logs are not available yet.'}</p>}
 </section>;
}

function PlayerGameLog({row,rows,loading,error,onRetry,position}){
 const columns=family(position).log;
 const games=(rows||[]).slice(-15).reverse();
 return <section className="mlb-context-card mlb-player-gamelog"><header><h2><ListOrdered size={15} aria-hidden="true"/>Game log · Last 15 games</h2><small>{row.player}</small></header>
  {loading&&!games.length?<p className="mlb-context-note" role="status">Loading player game log…</p>:error&&!games.length?<Failure onRetry={onRetry} quiet="No games to show yet.">Game log could not load.</Failure>:games.length?
  <div className="mlb-player-log-scroll" tabIndex={0} role="region" aria-label={`${row.player} recent game statistics; scroll for more columns`}><table><thead><tr><th scope="col">Date</th><th scope="col">Opponent</th><th scope="col">Result</th>{columns.map(key=><th scope="col" key={key}>{STATS[key].short}</th>)}</tr></thead>
  <tbody>{games.map(game=><tr key={game.gameId} data-dnp={game.dnp}><th scope="row" title={game.date}><span className="mlb-log-date"><CalendarDays size={12} aria-hidden="true"/>{shortDay(game.date)}</span></th>
   <td><span className="mlb-log-opponent"><span className="mlb-log-logo"><Shield size={17} aria-hidden="true"/><img src={game.opponentLogo||cfbLogo(game.opponentId)} width="20" height="20" alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/></span><span>{game.isHome===false?'@ ':''}{game.opponent}</span></span></td>
   <td><span className="wnba-result" data-result={game.result}>{game.result||'—'}</span> {game.score||''}{game.seasonKind==='postseason'&&<small className="wnba-po-tag">BOWL</small>}</td>
   {columns.map(key=><td key={key}>{game.dnp?<span className="nfl-dnp" title="Not in the box score: no stat recorded, or didn't play">—</span>:show(statValue(game,key))}</td>)}</tr>)}</tbody></table></div>
  :<p className="mlb-context-note">No games are available for this player yet.</p>}
 </section>;
}

// ---------------------------------------------------------------- depth and usage

const shortName=name=>{const parts=String(name||'').trim().split(/\s+/);return parts.length>1?`${parts[0][0]}. ${parts.slice(1).join(' ')}`:parts[0]||'';};
// A depth chart by who got the ball over the team's last three games, with
// each teammate's with/without split for the chart.
function DepthChart({row,impact,injuries,filters,onToggleFilter}){
 const team=row.teamAbbr,opponent=opponentOf(row);
 const [side,setSide]=useState('team');
 useEffect(()=>setSide('team'),[row.teamId]);
 const teamId=side==='team'?row.teamId:row.opponentId,abbr=side==='team'?team:opponent;
 const data=useCfb('team',{team:teamId,event:row.gameId},Boolean(teamId));
 const groups=data.data?.depth?.offense||[];
 const hurt=new Map((injuries?.[abbr]||[]).map(item=>[String(item.id),item]));
 const columns=Math.max(1,...groups.map(group=>group.players.length));
 const effects=side==='team'?impact:null;
 const toggle=(player,slot,kind)=>{const split=effects?.[player.id]?.[kind];if(split?.games)onToggleFilter({id:String(player.id),kind,name:player.name,pos:slot,ids:split.gameIds});};
 return <section className="mlb-context-card wnba-depth nfl-depth"><header><h2><Users size={15} aria-hidden="true"/>Depth charts</h2>
  <div className="wnba-depth-teams" aria-label="Depth chart team">{[['team',team,row.teamLogo||cfbLogo(row.teamId)],['opponent',opponent,row.opponentLogo||cfbLogo(row.opponentId)]].filter(([,label])=>label).map(([key,label,logo])=><button type="button" key={key} aria-pressed={side===key} onClick={()=>setSide(key)}><img src={logo} alt="" width="18" height="18" onError={e=>{e.currentTarget.hidden=true;}}/>{label}</button>)}</div></header>
  <div className="wnba-depth-legend">{INJURY_LEGEND.map(([code,label])=><span key={code}><b data-code={code}>{code}</b>{label}</span>)}</div>
  {data.loading&&!data.data?<div className="mlb-context-skeleton" role="status" aria-label="Loading depth chart"><span/><span/><span/></div>
  :data.error?<p className="mlb-context-note" role="status">{data.error} <button type="button" onClick={data.retry}>Retry</button></p>
  :!groups.length?<p className="mlb-context-note">No recent games to build {abbr}'s depth chart from yet.</p>
  :<><div className="wnba-depth-scroll" tabIndex={0} role="region" aria-label={`${abbr} depth chart; scroll for more columns`}><table className="wnba-depth-table nfl-depth-table"><thead><tr><th scope="col"><span className="finder-sr-only">Position</span></th>{Array.from({length:columns},(_,index)=><th scope="col" key={index}>{index===0?'Starter':['2nd','3rd','4th','5th'][index-1]||`${index+1}th`}</th>)}</tr></thead>
   <tbody>{groups.map(group=><tr key={group.slot}><th scope="row">{group.label}</th>{Array.from({length:columns},(_,index)=>{const player=group.players[index];if(!player)return <td key={index}/>;
    const code=injuryCode(hurt.get(String(player.id))),self=String(player.id)===String(row.playerId),effect=effects?.[player.id];
    return <td key={index}><div className="wnba-depth-cell">
     <span className="wnba-avatar"><UserRound size={20} aria-hidden="true"/>{player.headshot&&<img src={player.headshot} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span>
     <span className="wnba-depth-name" title={player.name}><strong className={self?'is-self':''}>{shortName(player.name)}</strong><small className="nfl-depth-role">{group.slot}{index+1}{code&&<em data-code={code}>{code}</em>}</small></span>
     {effects&&!self&&<span className="wnba-depth-actions">{[['without',UserX,'Without'],['with',UserCheck,'With']].map(([kind,Icon,label])=>{const split=effect?.[kind],pressed=filters.some(filter=>filter.id===String(player.id)&&filter.kind===kind);
      return <button type="button" key={kind} data-kind={kind} aria-pressed={pressed} disabled={!split?.games} onClick={()=>toggle(player,group.slot,kind)} aria-label={`${label} ${player.name}`} title={split?.games?`Chart: ${split.games} ${split.games===1?'game':'games'} ${kind} ${player.name}${finite(split.avg)?` · ${row.player} averaged ${fmt(split.avg)}`:''}`:`No games ${kind} ${player.name}`}><Icon size={15} aria-hidden="true"/></button>;})}</span>}
    </div></td>;})}</tr>)}</tbody></table></div>
   <p className="mlb-context-note">By who got the ball over {abbr}'s last {data.data.games} game{data.data.games===1?'':'s'}.</p></>}
 </section>;
}

// Team usage: how often the team throws, and who gets the ball.
const SHARE_COLORS=['#e5484d','#35c77e','#5cf8b2','#f4c53f','#00f58a','#ec4899','#84cc16','#38bdf8','#f97316','#14b8a6','#a3a3a3','#eab308'];
function TeamUsage({row,league}){
 const team=row.teamAbbr,[field,setField]=useState(/rush|carr/.test(row.valueKey||'')?'carries':'receptions');
 const passRun=league.data?.passRun?.[team],share=league.data?.share?.[team]?.[field]||[];
 const total=passRun?passRun.passes+passRun.runs:0;
 let start=0;
 const top=share.slice(0,11),rest=Math.max(0,100-top.reduce((sum,item)=>sum+item.share,0));
 const segments=[...top.map((item,index)=>({...item,color:SHARE_COLORS[index%SHARE_COLORS.length]})),...(rest>0.5?[{id:'rest',name:'Others',share:rest,color:'#585f63'}]:[])];
 const gradient=segments.map(item=>{const from=start;start+=item.share;return `${item.color} ${from}% ${start}%`;}).join(',');
 const label=field==='carries'?'Rush Att':'Catches';
 return <>
  <section className="mlb-context-card nfl-pass-run"><header><h2>{team} Pass vs Run Rate</h2><small>{league.data?.season} Season</small></header>
   {total?<div className="nfl-pass-run-body"><div className="nfl-pass-run-labels"><span>{fmt(passRun.passes/total*100,0)}% ({passRun.passes} passes)</span><span>{fmt(passRun.runs/total*100,0)}% ({passRun.runs} runs)</span></div>
    <span className="nfl-pass-run-bar" role="img" aria-label={`${team} passes on ${fmt(passRun.passes/total*100,0)}% of plays`}><i style={{width:`${passRun.passes/total*100}%`}}/></span></div>
   :<p className="mlb-context-note">{league.loading?'Loading team plays…':'No plays recorded for this team yet.'}</p>}
  </section>
  <section className="mlb-context-card nfl-share"><header><h2><PieChart size={15} aria-hidden="true"/>{team} Rush/Catch Share</h2><small>{league.data?.season} Season</small></header>
   <div className="mlb-context-switch nfl-share-switch" aria-label="Share of">{[['carries','Rush Att'],['receptions','Catches']].map(([key,text])=><button type="button" key={key} aria-pressed={field===key} onClick={()=>setField(key)}>{text}</button>)}</div>
   {share.length?<><div className="nfl-donut" role="img" aria-label={segments.map(item=>`${item.name} ${fmt(item.share)}%`).join(', ')} style={{background:`conic-gradient(${gradient})`}}><span>{label}</span></div>
    <div className="mlb-context-table-wrap"><table className="nfl-share-table"><thead><tr><th scope="col">Player</th><th scope="col">{label}</th><th scope="col">Share</th></tr></thead><tbody>
     {top.map((item,index)=><tr key={item.id} data-current={String(item.id)===String(row.playerId)}><th scope="row"><span className="nfl-share-player"><span className="wnba-avatar"><UserRound size={16} aria-hidden="true"/>{item.headshot&&<img src={item.headshot} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}<i style={{background:SHARE_COLORS[index%SHARE_COLORS.length]}}/></span><strong>{shortName(item.name)}</strong><small>{item.pos}</small></span></th><td>{item.value}</td><td>{fmt(item.share)}%</td></tr>)}
    </tbody></table></div></>
   :<p className="mlb-context-note">{league.loading?'Loading team usage…':'No usage recorded for this team yet.'}</p>}
  </section>
 </>;
}

export function CFBPlayerPage({row,playerRows,onBack}){
 const season=cfbSeason();
 const [selected,setSelected]=useState(row),[filters,setFilters]=useState([]);
 useEffect(()=>{setSelected(row);setFilters([]);},[row]);
 const toggleFilter=useCallback(entry=>setFilters(old=>toggleSplit(old,entry)),[]);
 const removeFilter=useCallback(key=>setFilters(old=>old.filter(filter=>splitKey(filter)!==key)),[]);
 const clearFilters=useCallback(()=>setFilters([]),[]);
 const log=useLog(row.playerId?selected.teamId:null);
 const league=useCfb('league',{season});
 const matchup=useCfb('matchup',{event:selected.gameId},Boolean(selected.gameId));
 const weather=useCfb('weather',{event:selected.gameId},Boolean(selected.gameId));
 const rows=useMemo(()=>playerGames(log.data,row.playerId),[log.data,row.playerId]);
 const position=selected.position||log.data?.players?.[row.playerId]?.pos;
 const impact=useMemo(()=>log.data?withWithout(log.data,row.playerId,selected.valueKey):null,[log.data,row.playerId,selected.valueKey]);
 // Switching stat keeps the tier this row came from where possible.
 const onStat=useMemo(()=>key=>{const options=playerRows.filter(item=>item.marketKey===key);const next=options.find(item=>item.modifier===selected.modifier)||options[0];if(next)setSelected(next);},[playerRows,selected.modifier]);
 const chartRows=useMemo(()=>applySplits(playedGames(rows),filters),[rows,filters]);
 const chips=useMemo(()=>filters.map(filter=>({key:splitKey(filter),kind:filter.kind,label:`${filter.kind==='without'?'W/O':'W/'} ${filter.name}${filter.pos?` (${filter.pos})`:''}`,title:`${filter.ids.length} of ${selected.player}'s games ${filter.kind} ${filter.name}`})),[filters,selected.player]);
 const shown=chartRows.length,chipsNote=filters.length?`${shown} ${shown===1?'game':'games'}`:'';
 const his=[['log','Game log',<PlayerGameLog row={selected} rows={rows} loading={log.loading} error={Boolean(log.error)} onRetry={log.retry} position={position}/>],
  ['stats','Stats',<SupportingStats rows={rows} position={position} loading={log.loading}/>],
  ['depth','Depth',<DepthChart row={selected} impact={impact} injuries={matchup.data?.injuries} filters={filters} onToggleFilter={toggleFilter}/>],
  ['usage','Usage',<TeamUsage row={selected} league={league}/>]];
 return <FinderPlayerLayout row={selected} playerRows={playerRows} onBack={onBack} className="nfl-player-page cfb-player-page" blocked={!row.playerId}
  notice={!row.playerId?<div className="wnba-board-message" role="status"><Database size={22} aria-hidden="true"/><strong>Player history unavailable</strong><span>This player could not be matched to his team's roster yet, so trends and matchup research are not available.</span></div>
   :log.error&&<div className="wnba-board-message" role="alert"><span>{log.error}</span><button type="button" className="wnba-trend-back" onClick={log.retry}><RefreshCw size={16} aria-hidden="true"/>Retry</button></div>}
  chart={<><TrendChart row={selected} playerRows={playerRows} rows={chartRows} loading={log.loading} onStat={onStat} chips={chips} chipsNote={chipsNote} onChipRemove={removeFilter} onChipsClear={clearFilters}/>
   {filters.length>0&&!shown&&!log.loading&&<p className="wnba-filter-empty" role="status">No games match all of these together. Remove a filter to see more.</p>}</>}
  his={his} research={CFB_TABS}
  renderResearch={tab=><CFBFinderContext row={selected} playerRows={playerRows} season={season} rows={rows} position={position} league={league} matchup={matchup} weather={weather}
   impact={impact} filters={filters} onToggleFilter={toggleFilter} tab={tab}/>}/>;
}
