import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Activity,ArrowLeftRight,CalendarClock,ChartColumn,HeartPulse,ListOrdered,RefreshCw,Shield,Target,Trophy,UserRound,Users} from 'lucide-react';
import {FinderDropdown,FinderDropdownAssets} from '../../FinderDropdown';
import {FinderResearchTabs,FinderResearchCard as Card} from '../../FinderResearchSections';
import {propFocus} from '../../prop-focus';
import PropFocusTag from '../../PropFocusTag';
import {MARKET_STAT,POSITIONS,baseMarket,dvpParams,ago,average,finite,fmt,hasPlayerContext,hasSplit,leagueOf,opponentOf,ordinal,playerContextParams,positionOf,price,rankTone,realGames,shortDate,signed,splitFilter,useWnba} from './wnba-research';
import {useIsAdmin,QUIET} from '../../admin-notice.js';
import Opportunity from './Opportunity';
import {theirDefenders,theirSeasons} from './defenders';

function Empty({children}){return <p className="mlb-context-note">{children}</p>;}
function Skeleton(){return <div className="mlb-context-skeleton" role="status" aria-label="Loading research"><span/><span/><span/><span/></div>;}
function Failed({state,label}){const admin=useIsAdmin();return admin?<Empty>{state.error||`${label} is temporarily unavailable.`} <button type="button" onClick={state.retry}><RefreshCw size={13} aria-hidden="true"/> Retry</button></Empty>:<p className="mlb-context-note is-quiet">{QUIET}</p>;}
function Logo({src,size=22}){return src?<img className="wnba-logo" src={src} alt="" width={size} height={size} loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>:null;}
function Avatar({src}){return <span className="wnba-avatar"><UserRound size={18} aria-hidden="true"/>{src&&<img src={src} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span>;}

// ---------------------------------------------------------------- Matchup
function WinPredictor({matchup}){
 const m=matchup.data;
 if(!m)return <section className="mlb-context-card mlb-win-predictor"><header><h2>Win predictor</h2><small>Pregame</small></header>{matchup.loading?<Skeleton/>:<Failed state={matchup} label="The matchup prediction"/>}</section>;
 const [away,home]=m.teams;const market=m.odds?.noVig;
 const source=m.predictor?{away:m.predictor.away,home:m.predictor.home,}:market?{away:market.away,home:market.home}:null;
 return <section className="mlb-context-card mlb-win-predictor"><header><h2>Win predictor</h2><small>{m.status?.detail||'Pregame'}</small></header>
  {/* The two teams either side of a ring split between them (Nov 9, the owner with PickFinder's page: "i want this layout"). */}
  {source?<div className="wp-ring-row">
   {[away,home].map((team,index)=><div className="wp-ring-team" key={team.id} data-side={index?'home':'away'} style={{order:index?3:1}}><Logo src={team.logo} size={34}/>
    <strong>{team.abbr}</strong><small>{team.record||'—'}{index===1?' · Home':''}</small><b data-tone={(index?source.home:source.away)>=50?'good':'low'}>{fmt(index?source.home:source.away)}%</b></div>)}
   <div className="wp-ring" style={{order:2,'--away':`${source.away}%`,'--ac':source.away>=50?'#13a874':'#F06A77','--hc':source.away>=50?'#F06A77':'#13a874'}} role="img" aria-label={`${away.abbr} ${source.away}%, ${home.abbr} ${source.home}%`}><span/></div>
  </div>
  :<Empty>No pregame prediction or moneyline is posted for this game yet.</Empty>}
 </section>;
}
function MatchupOdds({matchup}){
 const m=matchup.data;if(!m)return null;
 const odds=m.odds;
 return <Card title="Matchup odds" note={odds?.provider||'Pregame'} icon={ChartColumn} className="wnba-odds">
  {odds?<div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Team</th><th scope="col">Moneyline</th><th scope="col">Spread</th><th scope="col">Total</th>{odds.noVig&&<th scope="col">Win %</th>}</tr></thead><tbody>
   {m.teams.map(team=>{const side=odds[team.side]||{};return <tr key={team.id}><th scope="row"><span className="wnba-team-cell"><Logo src={team.logo}/>{team.abbr}{team.side==='home'&&<small>Home</small>}</span></th>
    <td>{price(side.moneyline)}</td><td>{finite(side.spread)?signed(side.spread):'—'} <small>{price(side.spreadOdds)}</small></td>
    <td>{finite(odds.total)?(team.side==='away'?'O ':'U ')+fmt(odds.total):'—'} <small>{price(team.side==='away'?odds.overOdds:odds.underOdds)}</small></td>{odds.noVig&&<td>{fmt(odds.noVig[team.side])}%</td>}</tr>;})}
  </tbody></table></div>:<Empty>No game line is posted yet.</Empty>}
  {m.venue?.name&&<Empty>{m.venue.name}{m.venue.city?` · ${m.venue.city}${m.venue.state?', '+m.venue.state:''}`:''}</Empty>}
 </Card>;
}
function LastFive({matchup}){
 const m=matchup.data;if(!m)return null;
 return <Card title="Last 5 games" icon={CalendarClock} className="wnba-last-five">
  <div className="wnba-last-five-grid">{m.teams.map(team=><div key={team.id}><h3><Logo src={team.logo}/>{team.name}</h3>
   {(m.lastFive?.[team.abbr]||[]).slice().reverse().map(game=><div className="wnba-last-five-row" key={game.id||game.date}><span>{shortDate(game.date)}</span><span className="wnba-team-cell">{game.atVs==='@'?'@':'vs'} <Logo src={game.opponentLogo} size={18}/>{game.opponent}</span><b data-result={game.result}>{game.result}</b><span>{game.score}</span></div>)}
   {!(m.lastFive?.[team.abbr]||[]).length&&<Empty>No recent games.</Empty>}</div>)}</div>
  {m.series?.summary&&<Empty>{m.series.title||'Season series'}: {m.series.summary}</Empty>}
 </Card>;
}
function Standings({matchup,team}){
 const groups=matchup.data?.standings||[];
 const home=groups.find(group=>group.entries.some(entry=>entry.abbr===team))?.name;
 const [name,setName]=useState(home);
 useEffect(()=>setName(home),[home]);
 if(!groups.length)return null;
 const group=groups.find(item=>item.name===name)||groups[0];
 const involved=new Set((matchup.data.teams||[]).map(item=>item.abbr));
 return <Card title="Season standings" icon={ListOrdered} className="wnba-standings">
  <div className="mlb-context-switch" aria-label="Conference">{groups.map(item=><button type="button" key={item.name} aria-pressed={item.name===group.name} onClick={()=>setName(item.name)}>{item.name}</button>)}</div>
  <div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Team</th><th scope="col">W-L</th><th scope="col">PCT</th><th scope="col">GB</th><th scope="col">STRK</th></tr></thead><tbody>
   {group.entries.map((entry,index)=><tr key={entry.id} data-involved={involved.has(entry.abbr)}><th scope="row"><span className="wnba-team-cell"><em className="wnba-rank">{index+1}</em><Logo src={entry.logo} size={18}/>{entry.name}</span></th><td>{fmt(entry.wins,0)}-{fmt(entry.losses,0)}</td><td>{entry.pct}</td><td>{entry.gb}</td><td data-tone={String(entry.streak).startsWith('W')?'good':'poor'}>{entry.streak}</td></tr>)}
  </tbody></table></div>
 </Card>;
}

// ---------------------------------------------------------------- Defense
const DVP_ORDER=['pr','pts','reb','ast','pa','ra','pra','tpm','fgm','ftm','stl','blk','to','pf'];
const strength={good:'Weak',fair:'Average',poor:'Tough'};
// One stored season at a time (api/wnba.py resource=dvp), picked from
// small menus: Season, Position, the defense and the view (Oct 30, the
// owner, with another app's: "same size dropdowns ... nice and small and
// compact"). Positions are ESPN's G, F and C (the owner went back to them
// from a PG / SG / SF / PF / C split); "All" is every opposing player. Views: Total (the position's players added up a game, the usual
// count), Per player, Per 36 min. A window the defense hasn't played in full
// says how many games it has ("L10 (5)"); a stat opens the games behind it
// one at a time, a game where nobody at the position played shown as left
// out. Admins also see the box scores checked against the final scores.
const POSITION_NAMES={ALL:'All',G:'G',F:'F',C:'C',PG:'PG',SG:'SG',SF:'SF',PF:'PF',DC:'C'};
// The NBA's depth-chart spots (depth.py) sit beside the box score's G / F / C
// when the admin's switch shows them; their C is keyed DC so the two never mix.
const POSITION_GROUPS={box:'Box score',depth:'Depth chart'};
const SPOT_KEYS=['PG','SG','SF','PF','DC'];
function readTime(iso){
 const date=iso?new Date(iso):null;
 return date&&!Number.isNaN(date.getTime())?date.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';
}
// The depth-chart spots' status under the menus: when the charts were last
// read, how much of this defense's opponents' minutes were placed, and which
// windows are incomplete (unplaced minutes that may be this spot's reach the
// flag share). Never a number dressed up as complete.
function SpotStatus({data,team}){
 const status=data.depth?.status,cover=data.coverage?.[team];
 if(!status)return null;
 const flagged=(data.windows||[]).filter(([key])=>cover?.[key]?.flag).map(([key])=>key.toUpperCase());
 const season=cover?.szn,share=season&&finite(season.share)?Math.round((1-season.share)*100):null;
 return <p className="wnba-dvp-spot-status" data-flag={flagged.length||status.stale||undefined}>
  <span>Depth charts {status.stale?'last read':'updated'} {readTime(status.newest)}</span>
  {finite(share)&&<span>{share}% of minutes placed</span>}
  {flagged.length>0&&<span className="wnba-dvp-spot-flag">Incomplete: {flagged.join(', ')}</span>}
 </p>;
}
const VALUE_UNIT={total:'allowed/g',player:'per player',per36:'per 36 min'};
const seasonName=year=>`${String(year-1).slice(-2)}/${String(year).slice(-2)}`;
const dayName=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleDateString('en-US',{month:'short',day:'numeric'});};
const lastName=name=>{const parts=String(name||'').trim().split(/\s+/);return parts.length>1?`${parts[0][0]}. ${parts.slice(1).join(' ')}`:parts[0]||'';};
function DefenseVsPosition({row,stat}){
 const opponent=opponentOf(row),admin=useIsAdmin();
 const [season,setSeason]=useState(null),[position,setPosition]=useState(null),[view,setView]=useState('total'),[team,setTeam]=useState(opponent),[open,setOpen]=useState(null),[all,setAll]=useState(false);
 useEffect(()=>setTeam(opponent),[opponent]);
 useEffect(()=>{setSeason(null);setPosition(null);setOpen(null);setAll(false);},[row.playerId]);
 const state=useWnba('dvp',dvpParams(row,{season,position,view,team}));
 // The last table stays up while another season, position or view loads.
 const shown=useRef(null);
 if(state.data)shown.current=state.data;
 const data=state.data||shown.current;
 const focus=useMemo(()=>propFocus(row),[row]);
 if(!data)return <Card title="Defense vs position" icon={Shield}>{state.loading?<Skeleton/>:<Failed state={state} label="Defense data"/>}</Card>;
 const n=data.teamCount,labels=Object.fromEntries(data.stats),entry=data.dvp[team];
 const statIndex=Object.fromEntries(data.stats.map(([key],index)=>[key,index]));
 const logos=Object.fromEntries(Object.entries(data.teams).map(([abbr,info])=>[abbr,info.logo]));
 const windows=data.windows||[['szn',0],['l10',10],['l5',5]];
 // The line's own stat and what feeds it lead (prop-focus.js).
 const order=focus.order([stat,...DVP_ORDER.filter(key=>key!==stat)]).filter(key=>entry?.stats?.[key]);
 // First only those (Nov 11, the owner with PickFinder's card, which shows the line's stats alone); the rest one tap away.
 const leading=order.filter(key=>key===stat||focus.of(key));
 const rows=all||leading.length<2||leading.length>=order.length?order:leading;
 // Rank 1 allows the least. For someone taking the over that is the tough
 // end, so the tone reads from the highest rank down.
 const tone=rank=>rankTone(finite(rank)?n+1-rank:rank,n);
 const games=data.games?.[team],played=data.played?.[team],through=dayName(data.through);
 const count=finite(played)&&finite(games)&&played>games?`${games} of ${played} games`:finite(games)?`${games} ${games===1?'game':'games'}`:'';
 const short=([key,size])=>size>0&&finite(entry?.g?.[key])&&entry.g[key]<size;
 const audit=data.audit;
 const spot=SPOT_KEYS.includes(data.position);
 return <Card title="Defense vs position" note={[seasonName(data.season),count,through&&`thru ${through}`].filter(Boolean).join(' · ')} icon={Shield} className="wnba-dvp">
  <div className="wnba-dvp-menus" data-loading={state.loading||undefined}>
   <FinderDropdown aria-label="Season" value={data.season} onChange={e=>{setSeason(Number(e.target.value));setOpen(null);}}>{data.seasons.map(year=><option key={year} value={year}>{`${seasonName(year)} Season`}</option>)}</FinderDropdown>
   <FinderDropdown aria-label="Position" value={data.position} onChange={e=>{setPosition(e.target.value);setOpen(null);}}>{data.positions.map(key=>{const group=(data.groups||[]).find(([,keys])=>keys.includes(key))?.[0];return <option key={key} value={key} data-group={group?POSITION_GROUPS[group]:undefined} data-display={key==='DC'?'C · depth chart':undefined}>{POSITION_NAMES[key]||key}</option>;})}</FinderDropdown>
   <span className="wnba-dvp-vs" aria-hidden="true">vs</span>
   <FinderDropdownAssets.Provider value={{Defense:logos}}><FinderDropdown aria-label="Defense" value={team} onChange={e=>{setTeam(e.target.value);setOpen(null);}}>{Object.keys(data.teams).sort().map(abbr=><option key={abbr} value={abbr}>{abbr}</option>)}</FinderDropdown></FinderDropdownAssets.Provider>
   {data.views&&<FinderDropdown aria-label="View" value={data.view} onChange={e=>setView(e.target.value)}>{data.views.map(([key,label])=><option key={key} value={key}>{label}</option>)}</FinderDropdown>}
  </div>
  {spot&&<SpotStatus data={data} team={team}/>}
  {entry?<div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Stat</th><th scope="col" className="wnba-bar-col">Allowed</th>
   {windows.map(item=><th scope="col" key={item[0]} data-flag={(spot&&data.coverage?.[team]?.[item[0]]?.flag)||undefined}>{item[0].toUpperCase()}{short(item)?<small> ({entry.g[item[0]]})</small>:null}</th>)}<th scope="col" className="wnba-dvp-matchup">Matchup</th></tr></thead><tbody>
   {rows.map(key=>{const cell=entry.stats[key],[value,rank]=cell.szn||[],f=focus.of(key)||(key===stat?'key':null),isOpen=open===key;return <React.Fragment key={key}>
    <tr data-focus={f||undefined} data-open={isOpen||undefined}><th scope="row"><button type="button" className="wnba-dvp-stat" aria-expanded={isOpen} onClick={()=>setOpen(isOpen?null:key)}><span className="wnba-stat-name"><span className="prop-focus-label">{labels[key]}<PropFocusTag focus={f}/></span><small>{fmt(value)} {VALUE_UNIT[data.view]||VALUE_UNIT.total}</small></span></button></th>
    <td className="wnba-bar-col"><span className="wnba-rank-bar" data-tone={tone(rank)} aria-hidden="true"><i style={{width:finite(rank)?`${rank/n*100}%`:'0%'}}/></span></td>
    {windows.map(item=>{const r=cell[item[0]]?.[1];return <td key={item[0]} data-tone={tone(r)} data-short={short(item)||undefined}>{ordinal(r)}</td>;})}
    <td className="wnba-dvp-matchup"><span className="wnba-strength" data-tone={tone(rank)}>{strength[tone(rank)]||'—'}</span></td></tr>
    {isOpen&&<tr className="wnba-dvp-log-row"><td colSpan={windows.length+3}><DefenseGames log={data.log} index={statIndex[key]} position={POSITION_NAMES[data.position]||data.position} logos={logos}/></td></tr>}
   </React.Fragment>;})}
  </tbody></table></div>:<Empty>No games recorded for this defense in {seasonName(data.season)}.</Empty>}
  {entry&&rows.length<order.length&&<button type="button" className="wnba-dvp-more" onClick={()=>setAll(true)}>Show all {order.length} stats</button>}
  {entry&&all&&leading.length>=2&&leading.length<order.length&&<button type="button" className="wnba-dvp-more" onClick={()=>{setAll(false);setOpen(null);}}>Show the line's stats only</button>}
  <div className="wnba-scale" aria-hidden="true"><span>Tougher</span><i/><span>Weaker</span></div>
  {admin&&audit&&<p className="wnba-dvp-audit" data-off={audit.offCount||audit.duplicates||audit.missing?'true':undefined}>Box scores: {audit.verified} of {audit.checked} games match ESPN's final scores{audit.offCount?` · ${audit.offCount} off`:''}{audit.duplicates?` · ${audit.duplicates} doubled`:''}{audit.missing?` · ${audit.missing} finished not stored yet`:''}</p>}
 </Card>;
}
// The games behind one stat, newest first: what the position put up in each,
// player by player.
function DefenseGames({log,index,position,logos}){
 if(!log)return <div className="wnba-dvp-log" role="status"><span className="mlb-context-skeleton"><span/></span></div>;
 if(!log.length)return <p className="wnba-dvp-log-empty">No games yet.</p>;
 return <ol className="wnba-dvp-log">{log.map(game=>{const players=game.players.filter(player=>finite(player[2][index]));const total=players.reduce((sum,player)=>sum+player[2][index],0);
  return <li key={game.id} data-out={!game.players.length||undefined}>
   <span className="wnba-dvp-log-game"><b>{dayName(game.date)}</b><span>{game.home?'vs':'@'}</span>{logos[game.opponent]&&<img src={logos[game.opponent]} alt="" width="16" height="16" loading="lazy"/>}<span>{game.opponent}</span></span>
   {game.players.length?<><strong>{fmt(total,total%1?1:0)}</strong><span className="wnba-dvp-log-players">{players.map(player=>`${lastName(player[0])} ${fmt(player[2][index],player[2][index]%1?1:0)}`).join(' · ')}</span></>
    :<span className="wnba-dvp-log-players">No {position} played · left out</span>}
   {game.unsure?.length>0&&<span className="wnba-dvp-log-unsure">{game.unsure.reduce((sum,player)=>sum+(player[1]||0),0)} min unplaced ({game.unsure.map(player=>lastName(player[0])).join(', ')})</span>}
  </li>;})}</ol>;
}
const OVD=[['pr','Pts+Rebs'],['pts','Points'],['reb','Rebounds'],['ast','Assists'],['tpm','3-PT Made'],['fgm','FG Made'],['ftm','FT Made'],['fgPct','FG%']];
function OffenseVsDefense({league,row}){
 const data=league.data,[flip,setFlip]=useState(false);
 const focus=useMemo(()=>propFocus(row),[row]);
 if(!data)return null;
 const team=row.teamAbbr,opponent=opponentOf(row),offense=flip?opponent:team,defense=flip?team:opponent;
 const off=data.teamStats[offense],def=data.teamStats[defense],n=data.teamCount;
 if(!off||!def)return <Card title="Offense vs defense" icon={ArrowLeftRight}><Empty>Team data is not available for this matchup yet.</Empty></Card>;
 return <Card title="Offense vs defense" icon={ArrowLeftRight} className="wnba-ovd">
  <div className="wnba-ovd-head"><span className="wnba-team-cell"><Logo src={data.teams[offense]?.logo}/>{offense}</span><button type="button" className="wnba-swap" aria-label="Swap offense and defense" onClick={()=>setFlip(v=>!v)}><ArrowLeftRight size={15}/></button><span className="wnba-team-cell">{defense}<Logo src={data.teams[defense]?.logo}/></span></div>
  <div className="wnba-ovd-cols" aria-hidden="true"><span>Off rank</span><span>Advantage</span><span>Def rank</span></div>
  <div className="wnba-ovd-rows">{focus.order(OVD,([key])=>key).map(([key,label])=>{const [ov,or]=off.off[key]||[],[dv,dr]=def.def[key]||[],f=focus.of(key);if(!finite(or)||!finite(dr))return null;
   const share=((n-or)/(n-1)+(dr-1)/(n-1))/2*100;
   const strong=rank=>rank<=Math.ceil(n/3);
   return <div className="wnba-ovd-row" key={key} data-focus={f||undefined}><span data-side="off" data-strong={strong(or)}>{ordinal(or)}<small>({fmt(ov)}{key==='fgPct'?'%':''})</small></span><div><small>{label}<PropFocusTag focus={f}/></small><span className="wnba-ovd-bar" role="img" aria-label={`${label}: ${offense} offense ranks ${ordinal(or)}, ${defense} defense ranks ${ordinal(dr)}`}><i style={{width:`${share}%`}}/></span></div><span data-side="def" data-strong={strong(dr)}><small>({fmt(dv)}{key==='fgPct'?'%':''})</small>{ordinal(dr)}</span></div>;})}</div>
  <div className="wnba-ovd-legend"><span><i data-side="off"/>Offensive advantage</span><span>Defensive advantage<i data-side="def"/></span></div>
 </Card>;
}

// ---------------------------------------------------------------- Shooting
const ZONE_LABELS={ra:'Restricted area',paint:'In the paint',mid:'Mid-range',c3l:'Left corner 3',c3r:'Right corner 3',ab3:'Above the break 3'};
// Five bands of defense rank, toughest (red) to softest (green).
// Nov 12: the board's colors (red, orange, amber, lime, teal-green), under a
// shade that deepens toward the top (the court's gradient).
const BAND_COLORS=['#EE3F55','#F2793A','#F5A524','#8BD94A','#18D08E'];
function bandOf(rank,count){if(!finite(rank)||!count)return null;return Math.min(4,Math.floor((rank-1)/(count/5)));}
function ShotChart({player,league,row}){
 const data=league.data,p=player.data,opponent=opponentOf(row);
 if(!data||!p)return <Card title="Shot chart" icon={Target}>{league.loading||player.loading?<Skeleton/>:<Failed state={league.error?league:player} label="Shooting data"/>}</Card>;
 const zones=p.zones||{},defense=data.zoneDefense[opponent]||{},n=data.teamCount;
 const makes=Object.values(zones).reduce((sum,[made])=>sum+made,0);
 const share=zone=>makes?(zones[zone]?.[0]||0)/makes*100:0;
 const fill=zone=>{const band=bandOf(defense[zone]?.[1],n);return band==null?'#3d3d3d':BAND_COLORS[band];};
 const label=(zone,x,y)=><g className="wnba-zone-label" transform={`translate(${x} ${y})`}><rect x="-21" y="-15" width="42" height="30" rx="7"/><text y="-2">{fmt(share(zone),0)}%</text><text y="10" className="wnba-zone-rank">#{defense[zone]?.[1]??'—'}</text></g>;
 const inside=['ra','paint','mid'],three=['c3l','c3r','ab3'];
 const groupShare=group=>group.reduce((sum,zone)=>sum+share(zone),0);
 const weightedRank=group=>{const total=groupShare(group);return total?group.reduce((sum,zone)=>sum+share(zone)*(defense[zone]?.[1]||0),0)/total:null;};
 const verdict=rank=>{const tone=rankTone(finite(rank)?n+1-Math.round(rank):rank,n);return {tone,text:tone==='good'?'soft':tone==='poor'?'tough':'average'};};
 const summary=[['Inside the arc',inside],['From three',three]].map(([name,group])=>({name,share:groupShare(group),rank:weightedRank(group)}));
 return <Card title="Shot chart" note={`vs ${opponent} defense`} icon={Target} className="wnba-shots">
  {makes?<>
  <svg className="wnba-court" viewBox="0 0 300 220" role="img" aria-label={`Shot chart: ${Object.keys(ZONE_LABELS).map(zone=>`${ZONE_LABELS[zone]} ${fmt(share(zone),0)}% of makes, ${opponent} rank ${defense[zone]?.[1]??'unavailable'}`).join('; ')}`}>
   <rect x="0" y="0" width="300" height="220" fill={fill('ab3')}/>
   <rect x="0" y="130" width="40" height="90" fill={fill('c3l')}/><rect x="260" y="130" width="40" height="90" fill={fill('c3r')}/>
   <path d="M40 220 L40 130 A130.4 130.4 0 0 1 260 130 L260 220 Z" fill={fill('mid')}/>
   <rect x="105" y="110" width="90" height="110" fill={fill('paint')}/>
   <path d="M122 220 L122 200 A28 28 0 0 1 178 200 L178 220 Z" fill={fill('ra')}/>
   <defs><linearGradient id="wnba-court-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#000" stopOpacity=".55"/><stop offset=".6" stopColor="#000" stopOpacity=".28"/><stop offset="1" stopColor="#000" stopOpacity=".08"/></linearGradient></defs>
   <rect className="wnba-court-shade" x="0" y="0" width="300" height="220" fill="url(#wnba-court-shade)"/>
   <g className="wnba-court-lines"><rect x="0" y="0" width="300" height="220"/><path d="M40 220 L40 130 A130.4 130.4 0 0 1 260 130 L260 220"/><rect x="105" y="110" width="90" height="110"/><path d="M122 220 L122 200 A28 28 0 0 1 178 200 L178 220"/></g>
   {label('ab3',150,40)}{label('mid',150,88)}{label('paint',150,140)}{label('ra',150,194)}{label('c3l',20,176)}{label('c3r',280,176)}
  </svg>
  <div className="wnba-band-legend">{BAND_COLORS.map((color,index)=>{const size=n/5,low=Math.floor(index*size)+1,high=Math.floor((index+1)*size);return <span key={color}><i style={{background:color}}/>#{low}{high>low?`–${high}`:''}</span>;})}<small>Lower rank = tougher defense</small></div>
  <div className="wnba-shot-summary">{summary.map(item=>{const v=verdict(item.rank);return <div key={item.name}><strong>{item.name}</strong><span>{fmt(item.share,0)}% of makes</span><span className="wnba-strength" data-tone={v.tone}>{finite(item.rank)?`${v.text} · avg rank ${fmt(item.rank)}`:'—'}</span></div>;})}</div>
  <div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Zone</th><th scope="col">FGM-FGA</th><th scope="col">FG%</th><th scope="col">{opponent} allows</th><th scope="col">League</th></tr></thead><tbody>
   {Object.keys(ZONE_LABELS).map(zone=>{const [made,attempts]=zones[zone]||[0,0],[pct,rank]=defense[zone]||[];return <tr key={zone}><th scope="row">{ZONE_LABELS[zone]}</th><td>{made}-{attempts}</td><td>{attempts?fmt(made/attempts*100):'—'}%</td><td data-tone={rankTone(finite(rank)?n+1-rank:rank,n)}>{fmt(pct)}% <small>#{rank??'—'}</small></td><td>{fmt(data.leagueZones[zone])}%</td></tr>;})}
  </tbody></table></div></>
  :<Empty>No located shots are recorded for this player this season.</Empty>}
 </Card>;
}

// ---------------------------------------------------------------- Similar
// Each stat's short name, for the result column.
const STAT_SHORT={pts:'PTS',reb:'REB',ast:'AST',tpm:'3PM',blk:'BLK',stl:'STL',bs:'B+S',to:'TO',pr:'P+R',pa:'P+A',ra:'R+A',pra:'PRA',fgm:'FGM',ftm:'FTM',fga:'FGA',fta:'FTA',tpa:'3PA',pf:'PF'};
// After PickFinder's "other guards vs" list (Nov 11, the owner): who played
// the spot against tonight's opponent, each against his own average.
function SimilarPlayers({player,row,statLabel,playerPosition,league,stat}){
 const opponent=opponentOf(row),[position,setPosition]=useState(playerPosition||'G');
 useEffect(()=>setPosition(playerPosition||'G'),[playerPosition]);
 const p=player.data;
 if(!p)return <Card title="Similar players" icon={Users}>{player.loading?<Skeleton/>:<Failed state={player} label="Similar players"/>}</Card>;
 const entries=p.similar?.[position]||[];
 const over=entries.filter(entry=>entry.diff>0).length,diff=average(entries.map(entry=>entry.diff)),base=average(entries.map(entry=>entry.avg));
 const max=Math.max(1,...entries.flatMap(entry=>[entry.value,entry.avg]));
 const noun=POSITIONS.find(([key])=>key===position)[1],teams=league?.data?.teams||{},short=STAT_SHORT[stat]||statLabel;
 return <Card title={`Other ${noun.toLowerCase()} vs ${opponent}`} note={statLabel} icon={Users} className="wnba-similar">
  <div className="wnba-similar-top">
   {entries.length>0?<div className="wnba-similar-summary"><span data-tone={over*2>=entries.length?'good':'poor'}>{over}/{entries.length} beat their average</span><span data-tone={diff>0?'good':'poor'}>Avg diff {signed(diff)}{finite(base)&&base?` (${signed(diff/base*100)}%)`:''}</span></div>:<span/>}
   <FinderDropdown aria-label="Position" value={position} onChange={e=>setPosition(e.target.value)}>{POSITIONS.map(([key,label])=><option key={key} value={key}>{label}</option>)}</FinderDropdown>
  </div>
  {entries.length?<>
   <div className="wnba-similar-cols" aria-hidden="true"><span>Player</span><span>Minutes</span><span>Result</span></div>
   <div className="wnba-similar-list">{entries.map(entry=><div className="wnba-similar-row" key={entry.gameId+entry.id}>
    <span className="wnba-similar-face"><Avatar src={entry.headshot}/>{teams[entry.team]?.logo&&<img className="wnba-similar-team" src={teams[entry.team].logo} alt="" width="16" height="16" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span>
    <span className="wnba-similar-name"><strong>{entry.name}<em>{entry.team}</em></strong><small>{ago(entry.date)} vs {opponent}</small></span>
    <span className="wnba-similar-min">{fmt(entry.min,0)} mins</span>
    <span className="wnba-similar-result"><b data-tone={entry.diff>0?'good':'poor'}>{fmt(entry.value)}<em>{short}</em></b><span className="wnba-similar-bar" aria-hidden="true"><i data-tone={entry.diff>0?'good':'poor'} style={{width:`${entry.value/max*100}%`}}/><em style={{left:`${entry.avg/max*100}%`}}/></span><small>Avg: {fmt(entry.avg)}</small></span></div>)}</div>
   <div className="wnba-similar-key" aria-hidden="true"><span><i data-tone="good"/>Beat his average</span><span><i data-tone="poor"/>Under his average</span></div>
  </>:<Empty>No {noun.toLowerCase()} have played {p.similarMinMinutes}+ minutes against {opponent} yet this season.</Empty>}
 </Card>;
}

// ---------------------------------------------------------------- Injuries
function injuryDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});}
function SplitLine({label,split,line}){
 if(!split||!split.games)return <span className="wnba-split" data-empty="true">{label}: no games</span>;
 const decided=(split.hits??0)+(split.misses??0);
 return <span className="wnba-split"><b>{label}</b> {split.games} {split.games===1?'game':'games'} · avg {fmt(split.avg)}{finite(line)&&decided?` · over ${line} in ${split.hits}/${decided}`:''}</span>;
}
function FilterButtons({name,pos,impact,filters,onToggleFilter}){
 if(!impact)return null;
 const choose=(kind,ids)=>onToggleFilter(splitFilter(impact.id,kind,name,pos||impact.pos,ids));
 return <div className="wnba-filter-buttons">{[['without',impact.without],['with',impact.with]].map(([kind,split])=><button type="button" key={kind} data-kind={kind} disabled={!split.games} aria-pressed={hasSplit(filters,impact.id,kind)} onClick={()=>choose(kind,split.gameIds)}>{kind==='without'?'Without':'With'} <small>{split.games}</small></button>)}</div>;
}
function Injuries({matchup,player,row,filters,onToggleFilter}){
 const team=row.teamAbbr,opponent=opponentOf(row),[side,setSide]=useState(team);
 useEffect(()=>setSide(team),[team]);
 const m=matchup.data,impact=new Map((player.data?.withWithout||[]).map(item=>[item.id,item]));
 const listed=m?.injuries?.[side]||[];
 const teams=Object.fromEntries((m?.teams||[]).map(item=>[item.abbr,item]));
 const listedIds=new Set(listed.map(item=>item.id));
 const others=side===team?(player.data?.withWithout||[]).filter(item=>item.without.games>0&&!listedIds.has(item.id)):[];
 return <>
 <Card title="Injuries" note="Current report" icon={HeartPulse} className="mlb-injuries wnba-injuries">
  <div className="mlb-context-switch" aria-label="Injury report team">{[team,opponent].filter(Boolean).map(abbr=><button type="button" key={abbr} aria-pressed={side===abbr} onClick={()=>setSide(abbr)}>{teams[abbr]?.logo&&<img src={teams[abbr].logo} alt="" width="20" height="20"/>}{abbr}</button>)}</div>
  {!m?(matchup.loading?<Skeleton/>:<Failed state={matchup} label="The injury report"/>):!listed.length?<Empty>No injuries listed for {side} in the current report.</Empty>:
  <div className="mlb-injury-list">{listed.map(item=>{const effect=side===team?impact.get(item.id):null;return <article className="mlb-injury-card" key={item.id||item.name}>
   <div className="mlb-injury-heading"><span className="mlb-injury-avatar"><UserRound size={26} aria-hidden="true"/>{item.headshot&&<img src={item.headshot} alt="" width="48" height="48" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span><div><h3>{item.name}</h3><small>{item.position}</small></div><span className="mlb-injury-status" data-day={item.status!=='Out'}>{[item.code||item.status,item.injury].filter(Boolean).join(' · ')}</span></div>
   {(item.comment||item.detail)&&<p className="mlb-injury-reason">{item.comment||item.detail}</p>}
   <div className="mlb-injury-return"><CalendarClock size={15} aria-hidden="true"/><span>{item.code==='OFS'?'Out for the season':injuryDate(item.returnDate)?`Estimated return · ${injuryDate(item.returnDate)}`:'Return timetable not reported'}</span></div>
   {effect&&<div className="wnba-impact"><span className="wnba-impact-title">{row.player} · {row.market}</span><SplitLine label="Without" split={effect.without} line={row.line}/><SplitLine label="With" split={effect.with} line={row.line}/><FilterButtons name={item.name} pos={item.position} impact={effect} filters={filters} onToggleFilter={onToggleFilter}/></div>}
   {injuryDate(item.date)&&<small className="mlb-injury-reported">Reported {injuryDate(item.date)}</small>}
  </article>;})}</div>}
 </Card>
 {side===team&&<Card title="Teammate impact" note={`${row.player} · ${row.market}`} icon={Users} className="wnba-teammates">
  {player.loading&&!player.data?<Skeleton/>:!player.data?<Failed state={player} label="Teammate splits"/>:others.length?<div className="wnba-teammate-list">{others.map(item=><div className="wnba-teammate" key={item.id}>
   <Avatar src={item.headshot}/><span className="wnba-similar-name"><strong>{item.name}</strong><small>{item.pos} · {fmt(item.min)} min</small></span>
   <span className="wnba-teammate-splits"><SplitLine label="Without" split={item.without} line={row.line}/><SplitLine label="With" split={item.with} line={row.line}/></span>
   <FilterButtons name={item.name} pos={item.pos} impact={item} filters={filters} onToggleFilter={onToggleFilter}/></div>)}</div>
  :<Empty>{row.player} has played every game alongside each current teammate.</Empty>}
 </Card>}
 </>;
}

// ---------------------------------------------------------------- Rankings
const RANKINGS=[['off','pts','Points'],['off','reb','Rebounds'],['off','ast','Assists'],['off','tpm','3-PT made'],['off','fgPct','FG%'],['off','tpPct','3-PT%'],['off','stl','Steals'],['off','blk','Blocks'],['off','to','Turnovers'],
 ['def','pts','Points allowed'],['def','reb','Rebounds allowed'],['def','tpm','3-PT made allowed'],['def','fgPct','FG% allowed'],['def','to','Turnovers forced']];
function Rankings({league,row}){
 const data=league.data;
 if(!data)return <Card title="Team rankings" icon={ListOrdered}>{league.loading?<Skeleton/>:<Failed state={league} label="Team rankings"/>}</Card>;
 const teams=[row.teamAbbr,opponentOf(row)].filter(abbr=>data.teamStats[abbr]),n=data.teamCount;
 return <Card title="Team rankings" note={`${data.season} · per game`} icon={ListOrdered} className="wnba-rankings">
  <div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Stat</th>{teams.map(abbr=><th scope="col" key={abbr}><span className="wnba-team-cell wnba-team-cell-end"><Logo src={data.teams[abbr]?.logo} size={18}/>{abbr}</span></th>)}</tr></thead><tbody>
   {['off','def'].map(group=><React.Fragment key={group}><tr className="wnba-rank-group"><th scope="rowgroup" colSpan={teams.length+1}>{group==='off'?'Offense':'Defense'}</th></tr>
    {RANKINGS.filter(([g])=>g===group).map(([g,key,label])=><tr key={g+key}><th scope="row">{label}</th>{teams.map(abbr=>{const [value,rank]=data.teamStats[abbr][g][key]||[];return <td key={abbr}>{finite(value)?<><span data-tone={rankTone(rank,n)}>{fmt(value)}{key.endsWith('Pct')?'%':''}</span> <small>{ordinal(rank)}</small></>:<span className="wnba-rank-none">—</span>}</td>;})}</tr>)}</React.Fragment>)}
  </tbody></table></div>
 </Card>;
}

// ---------------------------------------------------------------- Averages
const SEASON_MARKETS=[['player_points','PTS'],['player_rebounds','REB'],['player_assists','AST'],['player_threes','3PM'],['player_points_rebounds','PR'],['player_points_assists','PA'],['player_rebounds_assists','RA'],['player_points_rebounds_assists','PRA']];
function Averages({row,logs}){
 const games=realGames(logs),opponent=opponentOf(row);
 const values=list=>list.map(game=>game.values?.[row.marketKey]);
 const metrics=[['Season',average(values(games))],['Home',average(values(games.filter(g=>g.isHome===true)))],['Away',average(values(games.filter(g=>g.isHome===false)))],[`vs ${opponent||'OPP'}`,average(values(games.filter(g=>g.opponent===opponent)))]];
 const max=Math.max(1,...metrics.map(([,v])=>v||0),row.line||0);
 return <Card title="Prop averages" note={row.market} icon={Activity} className="wnba-averages">
  <div className="mlb-average-grid">{metrics.map(([label,value])=><div key={label}><span>{label}</span><strong data-tone={finite(value)?(value>row.line?'good':value<row.line?'poor':'fair'):undefined}>{fmt(value,2)}</strong><div className="mlb-average-track" aria-hidden="true"><i style={{width:finite(value)?`${value/max*100}%`:'0%'}}/></div></div>)}</div>
  <div className="wnba-season-grid">{SEASON_MARKETS.map(([market,label])=><div key={market} data-current={market===row.marketKey}><span>{label}</span><strong>{fmt(average(games.map(g=>g.values?.[market])),1)}</strong></div>)}</div>
 </Card>;
}

// ---------------------------------------------------------------- Defender
// Who guards him (NBA only): NBA.com's season matchups, per 75 possessions
// (about a game), against his own season across every defender
// (nba_matchups.py). Today's opponent's defenders first; tap one to see him.
const DEF_TILES=[['pts','PTS',' /75'],['ts','TS%','%'],['tov','TOV',' /75',true],['fga','FGA',' /75'],['fg','FG%','%'],['tpa','3PA',' /75'],['tp','3P%','%'],['fta','FTA',' /75'],['ast','AST',' /75']];
const PCT=new Set(['ts','fg','tp']);
const nbaHead=id=>id?`https://cdn.nba.com/headshots/nba/latest/260x190/${id}.png`:null;
const lastWord=name=>String(name||'').split(' ').filter(part=>!/^(jr|sr|ii|iii|iv)\.?$/i.test(part)).slice(-1)[0]||name;
// A tile's change from his usual: points for a percentage, a share otherwise.
function change(key,value,usual){
 if(!finite(value)||!finite(usual))return null;
 if(PCT.has(key))return {text:`${value-usual>=0?'+':''}${fmt(value-usual,1)} pts`,diff:value-usual};
 if(!usual)return null;
 const share=(value-usual)/usual*100;return {text:`${share>=0?'+':''}${fmt(share,0)}%`,diff:share};
}
// The prop's own number for the line under the faces.
const LEAD={player_assists:'ast',player_threes:'tp',player_threes_attempts:'tpa',player_field_goals:'fg',player_field_goals_attempts:'fga',player_frees_made:'fta',player_frees_attempts:'fta',player_turnovers:'tov'};
function DefenderCard({row,matchup}){
 const admin=useIsAdmin();
 const opponent=opponentOf(row);
 const state=useWnba('defender',{league:'nba',player:row.player,team:row.teamAbbr,opponent},row.sport==='nba'&&Boolean(row.player&&opponent));
 const data=state.data,defenders=data?.defenders||[],usual=data?.usual,injuries=matchup?.data?.injuries?.[opponent];
 // The opponent's players now, only for the games they played for it against him; anyone out tonight left off.
 const theirs=useMemo(()=>theirDefenders(data,injuries),[data,injuries]);
 const [scope,setScope]=useState('theirs'),[sort,setSort]=useState('poss'),[picked,setPicked]=useState(null);
 useEffect(()=>{setPicked(null);setScope('theirs');},[row.playerId,opponent]);
 if(state.loading&&!data)return <Card title="Who guards him" icon={Shield}><Skeleton/></Card>;
 // Nothing to show (NBA.com not answering the site, or no tracking for
 // him): members see no card at all; the admin sees why.
 if(state.error)return admin?<Card title="Who guards him" icon={Shield}><Failed state={state} label="Defender matchups"/></Card>:null;
 if(!data?.player||!defenders.length)return admin?<Card title="Who guards him" icon={Shield}><Empty>No defender tracking for {row.player} yet this season.</Empty></Card>:null;
 const listed=(scope==='theirs'&&theirs.length?theirs:defenders).filter(item=>sort==='poss'||item.poss>=10);
 const sorted=[...listed].sort((a,b)=>sort==='tough'?(a.pts??99)-(b.pts??99):sort==='easy'?(b.pts??-1)-(a.pts??-1):b.poss-a.poss).slice(0,8);
 const chosen=(scope==='theirs'&&theirs.length?theirs:defenders).find(item=>item.id===picked)||defenders.find(item=>item.id===picked)
  ||theirs.find(item=>item.id===data.likely?.id)||theirs[0]||defenders[0];
 const isLikely=chosen.id===data.likely?.id;
 const lead=LEAD[baseMarket(row.marketKey)]||'pts',leadTile=DEF_TILES.find(([key])=>key===lead);
 const leadChange=change(lead,chosen[lead],usual?.[lead]);
 // "18.3 points per 75 vs Moody, usually 20.4" or "36.4% FG vs Moody, usually 41.7%".
 const pctLead=PCT.has(lead),unit=pctLead?'%':'';
 const said=`${fmt(chosen[lead],1)}${unit} ${pctLead?leadTile[1].replace('%',''):`${lead==='pts'?'points':leadTile[1]} per 75`} vs ${lastWord(chosen.name)}, usually ${fmt(usual?.[lead],1)}${unit}`;
 const big=leadChange&&Math.abs(leadChange.diff)>=(pctLead?2:8),better=leadChange&&(lead==='tov'?leadChange.diff<0:leadChange.diff>0);
 const verdict=!leadChange?null:`${!big?'About his usual':better?'Better than usual':'Worse than usual'}: ${said}`;
 return <Card title="Who guards him" note={data.season} icon={Shield} className="nba-defender">
  <div className="nd-faces">
   <figure><Avatar src={nbaHead(data.player.id)}/><figcaption><b>{lastWord(row.player)}</b><small>{row.teamAbbr}</small></figcaption></figure>
   <span className="nd-vs">vs</span>
   <figure className="is-defender"><figcaption><b>{lastWord(chosen.name)}</b><small>{chosen.team||'—'}</small></figcaption><Avatar src={nbaHead(chosen.id)}/></figure>
  </div>
  <p className="nd-sub"><span><b>{fmt(chosen.poss,0)}</b> poss</span><span><b>{chosen.gp}</b> {chosen.gp===1?'game':'games'}</span><span><b>{fmt(chosen.min,1)}</b> min</span>
   {isLikely&&<em data-sure={data.likely.sure}>{data.likely.sure==='likely'?'Likely defender':'Possible defender'} · {data.likely.share}% of his possessions vs {data.opponent}</em>}</p>
  {verdict&&<p className="nd-verdict" data-tone={big?(better?'good':'poor'):'fair'}>{verdict}</p>}
  {chosen.poss<20&&<p className="nd-small">Small sample: {fmt(chosen.poss,0)} possessions.</p>}
  <div className="nd-tiles">{DEF_TILES.map(([key,label,unit,lowerBetter])=>{const moved=change(key,chosen[key],usual?.[key]);
   const tone=!moved||Math.abs(moved.diff)<(PCT.has(key)?2:8)?'fair':((lowerBetter?moved.diff<0:moved.diff>0)?'good':'poor');
   return <div key={key} data-focus={key===lead||undefined}><span>{label}{unit.includes('/75')?<i>/75</i>:null}</span><b>{finite(chosen[key])?fmt(chosen[key],1)+(PCT.has(key)?'%':''):'—'}</b>
    <small>usual {finite(usual?.[key])?fmt(usual[key],1)+(PCT.has(key)?'%':''):'—'}</small>{moved&&<em data-tone={tone}>{moved.text}</em>}</div>;})}</div>
  <div className="nd-list-head"><h3>Defenders he's faced</h3>
   <div className="nd-seg" role="group" aria-label="Which defenders">{theirs.length>0&&<button type="button" aria-pressed={scope==='theirs'} onClick={()=>setScope('theirs')}>{data.opponent} <small>{theirs.length}</small></button>}
    <button type="button" aria-pressed={scope==='all'||!theirs.length} onClick={()=>setScope('all')}>All <small>{defenders.length}</small></button></div></div>
  <div className="nd-seg nd-sort" role="group" aria-label="Sort defenders">{[['poss','Most time'],['tough','Toughest'],['easy','Easiest']].map(([key,label])=><button type="button" key={key} aria-pressed={sort===key} onClick={()=>setSort(key)}>{label}</button>)}</div>
  <table className="nd-table"><thead><tr><th scope="col">Defender</th><th scope="col">Poss</th><th scope="col">PTS/75</th><th scope="col">TS%</th><th scope="col">FGA/75</th></tr></thead>
   <tbody>{sorted.map(item=><tr key={item.id} aria-selected={item.id===chosen.id} onClick={()=>setPicked(item.id)}>
    <th scope="row"><button type="button" onClick={()=>setPicked(item.id)}><Avatar src={nbaHead(item.id)}/><span><b>{item.name}</b><small>{item.team||'—'}</small></span></button></th>
    <td>{fmt(item.poss,0)}</td><td data-tone={finite(item.pts)&&finite(usual?.pts)?(item.pts>usual.pts*1.08?'good':item.pts<usual.pts*.92?'poor':undefined):undefined}>{fmt(item.pts,1)}</td>
    <td>{finite(item.ts)?fmt(item.ts,1)+'%':'—'}</td><td>{fmt(item.fga,1)}</td></tr>)}</tbody></table>
  {scope==='theirs'&&!theirs.length&&<Empty>He hasn't faced {data.opponent}'s current players in games against them; showing everyone.</Empty>}
 </Card>;
}

// `tab` from the page (the NBA / WNBA page's own section tabs, which then
// stand in for this panel's tab row), else its own.
export default function WNBAFinderContext({row,logs,matchup,filters,onToggleFilter,tab:shownTab}){
 const [ownTab,setTab]=useState('matchup');
 const tab=shownTab||ownTab;
 const opponent=opponentOf(row);
 const league=useWnba('league-context',{league:leagueOf(row)});
 const player=useWnba('player-context',playerContextParams(row),hasPlayerContext(row));
 // The NBA's own tracking (potential assists, rebound chances), when its site answers.
 const tracking=useWnba('player-tracking',{name:row.player,team:row.teamAbbr,league:'nba'},row.sport==='nba'&&Boolean(row.player));
 const stat=MARKET_STAT[baseMarket(row.marketKey)]||'pts';
 const playerPosition=positionOf(player.data?.position||row.position);
 const statLabel=useMemo(()=>Object.fromEntries(league.data?.stats||[])[stat]||row.market,[league.data,stat,row.market]);
 return <aside className="mlb-finder-context wnba-finder-context" data-tab={tab} aria-label={`${row.sport==='nba'?'NBA':'WNBA'} matchup research`}>
  {!shownTab&&<FinderResearchTabs tab={tab} onChange={setTab}/>}
  {tab==='matchup'&&<><Opportunity row={row} player={player} league={league} matchup={matchup} tracking={tracking} statLabel={statLabel}/><WinPredictor matchup={matchup}/><MatchupOdds matchup={matchup}/><LastFive matchup={matchup}/><Standings matchup={matchup} team={row.teamAbbr}/></>}
  {tab==='defense'&&<><DefenseVsPosition row={row} stat={stat}/>{row.sport==='nba'&&<DefenderCard row={row} matchup={matchup}/>}<OffenseVsDefense league={league} row={row}/></>}
  {tab==='shooting'&&<ShotChart player={player} league={league} row={row}/>}
  {tab==='similar'&&<SimilarPlayers player={player} row={row} statLabel={statLabel} playerPosition={playerPosition} league={league} stat={stat}/>}
  {tab==='injuries'&&<Injuries matchup={matchup} player={player} row={row} filters={filters} onToggleFilter={onToggleFilter}/>}
  {tab==='rankings'&&<Rankings league={league} row={row}/>}
  <Averages row={row} logs={logs}/>
 </aside>;
}
