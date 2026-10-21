import React,{useEffect,useMemo,useState} from 'react';
import {Activity,ArrowLeftRight,CalendarClock,ChartColumn,HeartPulse,ListOrdered,RefreshCw,Shield,Target,Trophy,UserRound,Users} from 'lucide-react';
import {FinderDropdown,FinderDropdownAssets} from '../../FinderDropdown';
import {FinderResearchTabs,FinderResearchCard as Card} from '../../FinderResearchSections';
import {propFocus} from '../../prop-focus';
import PropFocusTag from '../../PropFocusTag';
import {MARKET_STAT,POSITIONS,baseMarket,ago,average,finite,fmt,hasPlayerContext,hasSplit,leagueOf,opponentOf,ordinal,playerContextParams,positionOf,price,rankTone,realGames,shortDate,signed,splitFilter,useWnba} from './wnba-research';
import {useIsAdmin,QUIET} from '../../admin-notice.js';
import Opportunity from './Opportunity';
import {theirDefenders,theirSeasons} from './defenders';

function Empty({children}){return <p className="mlb-context-note">{children}</p>;}
function Skeleton(){return <div className="mlb-context-skeleton" role="status" aria-label="Loading research"><span/><span/><span/><span/></div>;}
function Failed({state,label}){const admin=useIsAdmin();return <Empty>{admin?<>{state.error||`${label} is temporarily unavailable.`} <button type="button" onClick={state.retry}><RefreshCw size={13} aria-hidden="true"/> Retry</button></>:QUIET}</Empty>;}
function Logo({src,size=22}){return src?<img className="wnba-logo" src={src} alt="" width={size} height={size} loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>:null;}
function Avatar({src}){return <span className="wnba-avatar"><UserRound size={18} aria-hidden="true"/>{src&&<img src={src} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span>;}

// ---------------------------------------------------------------- Matchup
function WinPredictor({matchup}){
 const m=matchup.data;
 if(!m)return <section className="mlb-context-card mlb-win-predictor"><header><h2>Win predictor</h2><small>Pregame</small></header>{matchup.loading?<Skeleton/>:<Empty>{matchup.error||'Matchup prediction is not available yet.'}</Empty>}</section>;
 const [away,home]=m.teams;const market=m.odds?.noVig;
 const source=m.predictor?{away:m.predictor.away,home:m.predictor.home,}:market?{away:market.away,home:market.home}:null;
 // Away grey, home white: the site's black and white, not team colours.
 const colors=['#8c8c8c','#f2f2f2'];
 return <section className="mlb-context-card mlb-win-predictor"><header><h2>Win predictor</h2><small>{m.status?.detail||'Pregame'}</small></header>
  {source?<><div className="mlb-win-body">{[away,home].map((team,index)=><React.Fragment key={team.id}>{index===1&&<div className="mlb-win-ring" role="img" aria-label={`${away.abbr} ${source.away}%, ${home.abbr} ${source.home}%`} style={{background:`conic-gradient(${colors[0]} 0% ${source.away}%, ${colors[1]} ${source.away}% 100%)`}}><span>WIN<br/>CHANCE</span></div>}
   <div className="mlb-win-team"><Logo src={team.logo} size={32}/><strong>{team.abbr}</strong><small>{team.record||'Record unavailable'}{index===1?' · Home':''}</small><b style={{color:colors[index]}}>{fmt(index?source.home:source.away)}%</b></div></React.Fragment>)}</div></>
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
function DefenseVsPosition({league,row,stat,playerPosition}){
 const data=league.data,opponent=opponentOf(row);
 const [position,setPosition]=useState(playerPosition||'G'),[team,setTeam]=useState(opponent);
 useEffect(()=>setPosition(playerPosition||'G'),[playerPosition]);
 useEffect(()=>setTeam(opponent),[opponent]);
 const focus=useMemo(()=>propFocus(row),[row]);
 if(!data)return <Card title="Defense vs position" icon={Shield}>{league.loading?<Skeleton/>:<Failed state={league} label="Defense data"/>}</Card>;
 const n=data.teamCount,labels=Object.fromEntries(data.stats),entry=data.dvp[team]?.[position];
 // The line's own stat and what feeds it lead (prop-focus.js).
 const order=focus.order([stat,...DVP_ORDER.filter(key=>key!==stat)]).filter(key=>entry?.stats?.[key]);
 // Rank 1 allows the least. For someone taking the over that is the tough
 // end, so the tone reads from the highest rank down.
 const tone=rank=>rankTone(finite(rank)?n+1-rank:rank,n);
 return <Card title="Defense vs position" note={data.season} icon={Shield} className="wnba-dvp">
  <div className="wnba-dvp-controls"><div className="mlb-context-switch" aria-label="Position">{POSITIONS.map(([key,label])=><button type="button" key={key} aria-pressed={position===key} onClick={()=>setPosition(key)}>{label}</button>)}</div>
   <div className="wnba-team-picker"><FinderDropdownAssets.Provider value={{Defense:Object.fromEntries(Object.entries(data.teams).map(([abbr,info])=>[abbr,info.logo]))}}><FinderDropdown aria-label="Defense" value={team} onChange={e=>setTeam(e.target.value)}>{Object.keys(data.teams).sort().map(abbr=><option key={abbr} value={abbr}>{abbr}</option>)}</FinderDropdown></FinderDropdownAssets.Provider></div></div>
  {entry?<div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Stat</th><th scope="col" className="wnba-bar-col">Allowed</th><th scope="col">SZN</th><th scope="col">L10</th><th scope="col">L5</th><th scope="col">Matchup</th></tr></thead><tbody>
   {order.map(key=>{const cell=entry.stats[key],[value,rank]=cell.szn||[],f=focus.of(key)||(key===stat?'key':null);return <tr key={key} data-focus={f||undefined}><th scope="row"><span className="wnba-stat-name"><span className="prop-focus-label">{labels[key]}<PropFocusTag focus={f}/></span><small>{fmt(value)} allowed/g</small></span></th>
    <td className="wnba-bar-col"><span className="wnba-rank-bar" data-tone={tone(rank)} aria-hidden="true"><i style={{width:finite(rank)?`${rank/n*100}%`:'0%'}}/></span></td>
    {['szn','l10','l5'].map(window=>{const r=cell[window]?.[1];return <td key={window} data-tone={tone(r)}>{ordinal(r)}</td>;})}
    <td><span className="wnba-strength" data-tone={tone(rank)}>{strength[tone(rank)]||'—'}</span></td></tr>;})}
  </tbody></table></div>:<Empty>No games recorded for this defense yet.</Empty>}
  <div className="wnba-scale" aria-hidden="true"><span>Tougher</span><i/><span>Weaker</span></div>
 </Card>;
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
  <div className="wnba-ovd-head"><span className="wnba-team-cell"><Logo src={data.teams[offense]?.logo}/>{offense} <small>offense</small></span><button type="button" className="wnba-swap" aria-label="Swap offense and defense" onClick={()=>setFlip(v=>!v)}><ArrowLeftRight size={15}/></button><span className="wnba-team-cell"><small>defense</small> {defense}<Logo src={data.teams[defense]?.logo}/></span></div>
  <div className="wnba-ovd-rows">{focus.order(OVD,([key])=>key).map(([key,label])=>{const [ov,or]=off.off[key]||[],[dv,dr]=def.def[key]||[],f=focus.of(key);if(!finite(or)||!finite(dr))return null;
   const share=((n-or)/(n-1)+(dr-1)/(n-1))/2*100;
   const strong=rank=>rank<=Math.ceil(n/3);
   return <div className="wnba-ovd-row" key={key} data-focus={f||undefined}><span data-side="off" data-strong={strong(or)}>{ordinal(or)}<small>{fmt(ov)}{key==='fgPct'?'%':''}</small></span><div><small>{label}<PropFocusTag focus={f}/></small><span className="wnba-ovd-bar" role="img" aria-label={`${label}: ${offense} offense ranks ${ordinal(or)}, ${defense} defense ranks ${ordinal(dr)}`}><i style={{width:`${share}%`}}/></span></div><span data-side="def" data-strong={strong(dr)}>{ordinal(dr)}<small>{fmt(dv)}{key==='fgPct'?'%':''}</small></span></div>;})}</div>
  <div className="wnba-ovd-legend"><span><i data-side="off"/>Offensive advantage</span><span>Defensive advantage<i data-side="def"/></span></div>
 </Card>;
}

// ---------------------------------------------------------------- Shooting
const ZONE_LABELS={ra:'Restricted area',paint:'In the paint',mid:'Mid-range',c3l:'Left corner 3',c3r:'Right corner 3',ab3:'Above the break 3'};
// Five bands of defense rank, toughest (red) to softest (green).
const BAND_COLORS=['#ef4b5a','#f28a3c','#f4c53f','#a7d94a','#35c77e'];
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
function SimilarPlayers({player,row,statLabel,playerPosition}){
 const opponent=opponentOf(row),[position,setPosition]=useState(playerPosition||'G');
 useEffect(()=>setPosition(playerPosition||'G'),[playerPosition]);
 const p=player.data;
 if(!p)return <Card title="Similar players" icon={Users}>{player.loading?<Skeleton/>:<Failed state={player} label="Similar players"/>}</Card>;
 const entries=p.similar?.[position]||[];
 const over=entries.filter(entry=>entry.diff>0).length,diff=average(entries.map(entry=>entry.diff)),base=average(entries.map(entry=>entry.avg));
 const max=Math.max(1,...entries.flatMap(entry=>[entry.value,entry.avg]));
 const noun=POSITIONS.find(([key])=>key===position)[1];
 return <Card title={`Other ${noun.toLowerCase()} vs ${opponent}`} note={statLabel} icon={Users} className="wnba-similar">
  <div className="wnba-dvp-controls"><div className="mlb-context-switch" aria-label="Position">{POSITIONS.map(([key,label])=><button type="button" key={key} aria-pressed={position===key} onClick={()=>setPosition(key)}>{label}</button>)}</div>
   {entries.length>0&&<div className="wnba-similar-summary"><span data-tone={over*2>=entries.length?'good':'poor'}>{over}/{entries.length} beat their average</span><span data-tone={diff>0?'good':'poor'}>Avg diff {signed(diff)}{finite(base)&&base?` (${signed(diff/base*100)}%)`:''}</span></div>}</div>
  {entries.length?<div className="wnba-similar-list">{entries.map(entry=><div className="wnba-similar-row" key={entry.gameId+entry.id}>
   <Avatar src={entry.headshot}/><span className="wnba-similar-name"><strong>{entry.name}</strong><small>{ago(entry.date)} · {entry.team}</small></span>
   <span className="wnba-similar-min">{fmt(entry.min,0)} min</span>
   <span className="wnba-similar-result"><b data-tone={entry.diff>0?'good':'poor'}>{fmt(entry.value)}</b><small>avg {fmt(entry.avg)}</small><span className="wnba-similar-bar" aria-hidden="true"><i data-tone={entry.diff>0?'good':'poor'} style={{width:`${entry.value/max*100}%`}}/><em style={{left:`${entry.avg/max*100}%`}}/></span></span></div>)}</div>
  :<Empty>No {noun.toLowerCase()} have played {p.similarMinMinutes}+ minutes against {opponent} yet this season.</Empty>}
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
    {RANKINGS.filter(([g])=>g===group).map(([g,key,label])=><tr key={g+key}><th scope="row">{label}</th>{teams.map(abbr=>{const [value,rank]=data.teamStats[abbr][g][key]||[];return <td key={abbr}><span data-tone={rankTone(rank,n)}>{fmt(value)}{key.endsWith('Pct')?'%':''}</span> <small>{ordinal(rank)}</small></td>;})}</tr>)}</React.Fragment>)}
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
  <p className="nd-foot">Per 75 possessions, about a game, from NBA.com's matchup tracking ({data.season}). {data.opponent}: players on {data.opponent} now, only in games they played for {data.opponent} against him ({theirSeasons(data,theirs)}); anyone out tonight left off. Usual: his season across every defender ({fmt(usual?.poss,0)} possessions).</p>
 </Card>;
}

export default function WNBAFinderContext({row,logs,matchup,filters,onToggleFilter}){
 const [tab,setTab]=useState('matchup');
 const opponent=opponentOf(row);
 const league=useWnba('league-context',{league:leagueOf(row)});
 const player=useWnba('player-context',playerContextParams(row),hasPlayerContext(row));
 // The NBA's own tracking (potential assists, rebound chances), when its site answers.
 const tracking=useWnba('player-tracking',{name:row.player,team:row.teamAbbr,league:'nba'},row.sport==='nba'&&Boolean(row.player));
 const stat=MARKET_STAT[baseMarket(row.marketKey)]||'pts';
 const playerPosition=positionOf(player.data?.position||row.position);
 const statLabel=useMemo(()=>Object.fromEntries(league.data?.stats||[])[stat]||row.market,[league.data,stat,row.market]);
 return <aside className="mlb-finder-context wnba-finder-context" data-tab={tab} aria-label={`${row.sport==='nba'?'NBA':'WNBA'} matchup research`}>
  <FinderResearchTabs tab={tab} onChange={setTab}/>
  {tab==='matchup'&&<><Opportunity row={row} player={player} league={league} matchup={matchup} tracking={tracking} statLabel={statLabel}/><WinPredictor matchup={matchup}/><MatchupOdds matchup={matchup}/><LastFive matchup={matchup}/><Standings matchup={matchup} team={row.teamAbbr}/></>}
  {tab==='defense'&&<>{row.sport==='nba'&&<DefenderCard row={row} matchup={matchup}/>}<DefenseVsPosition league={league} row={row} stat={stat} playerPosition={playerPosition}/><OffenseVsDefense league={league} row={row}/></>}
  {tab==='shooting'&&<ShotChart player={player} league={league} row={row}/>}
  {tab==='similar'&&<SimilarPlayers player={player} row={row} statLabel={statLabel} playerPosition={playerPosition}/>}
  {tab==='injuries'&&<Injuries matchup={matchup} player={player} row={row} filters={filters} onToggleFilter={onToggleFilter}/>}
  {tab==='rankings'&&<Rankings league={league} row={row}/>}
  <Averages row={row} logs={logs}/>
 </aside>;
}
