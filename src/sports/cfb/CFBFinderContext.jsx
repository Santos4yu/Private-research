import React,{useEffect,useMemo,useState} from 'react';
import {Activity,ArrowLeftRight,CalendarClock,ChartColumn,ChevronDown,HeartPulse,Home,ListOrdered,Plane,Shield,Swords,Trophy,UserCheck,UserRound,Users,UserX} from 'lucide-react';
import {FinderDropdown,FinderDropdownAssets} from '../../FinderDropdown';
import {ago,average,finite,fmt,ordinal,price,rankTone,signed} from '../wnba/wnba-research';
import {propFocus} from '../../prop-focus';
import PropFocusTag from '../../PropFocusTag';
import FootballWeather from '../FootballWeather';
import {STATS,cfbLogo,family,playedGames,statValue} from './cfb-stats';
import {cfbSeason,dvpPosition,injuryCode,opponentOf,useCfb} from './cfb-finder';
import {useIsAdmin,QUIET} from '../../admin-notice.js';

// The college football page's matchup panel: the NFL panel's tabs and cards
// (NFLFinderContext.jsx) filled from ESPN's college football feed --
// Matchup, Defense, Similar, Injuries, Odds and Rankings, with the season
// averages underneath. Data: /api/board?view=cfb (cfb_research.py).
// The research tabs; the Finder's player page (FinderPlayerLayout) draws
// their row and hands the picked one back as `tab`.
export const CFB_TABS=[['matchup','Matchup',Trophy],['defense','Defense',Shield],['similar','Similar',Users],['injuries','Injuries',HeartPulse],['odds','Odds',ChartColumn],['rankings','Rankings',ListOrdered]];
function Card({title,note,children,icon:Icon=Activity,className=''}){return <section className={'mlb-context-card '+className}><header><h2><Icon size={16} aria-hidden="true"/>{title}</h2>{note&&<small>{note}</small>}</header>{children}</section>;}
function Empty({children}){return <p className="mlb-context-note">{children}</p>;}
function Skeleton(){return <div className="mlb-context-skeleton" role="status" aria-label="Loading research"><span/><span/><span/><span/></div>;}
function Failed({state,label}){const admin=useIsAdmin();return <Empty>{admin?<>{state.error||`${label} is temporarily unavailable.`} <button type="button" onClick={state.retry}>Retry</button></>:QUIET}</Empty>;}
function Logo({src,size=22}){return src?<img className="wnba-logo" src={src} alt="" width={size} height={size} loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>:null;}
function Avatar({src}){return <span className="wnba-avatar"><UserRound size={18} aria-hidden="true"/>{src&&<img src={src} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span>;}
const logoFor=(league,abbr,row)=>league?.data?.teams?.[abbr]?.logo||(abbr===row?.teamAbbr?row?.teamLogo||cfbLogo(row?.teamId):abbr===opponentOf(row||{})?row?.opponentLogo||cfbLogo(row?.opponentId):'');
const ranked=team=>team?.rank?`#${team.rank} `:'';
const STILL_GATHERING='Still gathering this season\'s games. The full table fills in shortly.';

// ---------------------------------------------------------------- Matchup
function CurrentLine({row,playerRows}){
 const offers=playerRows.filter(item=>item.marketKey===row.marketKey&&Number(item.line)===Number(row.line));
 const tier=['goblin','demon'].includes(String(row.modifier).toLowerCase())?String(row.modifier).toLowerCase():null;
 const updated=offers.flatMap(item=>(item.apps||[]).map(app=>app.updatedAt)).filter(Boolean).sort().at(-1);
 return <Card title="Current line" note={row.market} icon={ChartColumn} className="nfl-current-line">
  <div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Line</th><th scope="col">Apps</th><th scope="col">Updated</th></tr></thead><tbody><tr>
   <th scope="row">{row.line}</th>
   <td><span className="nfl-line-apps"><img src="/prizepicks/logo.png" alt="PrizePicks" title="PrizePicks" width="22" height="22"/>{tier&&<img src={`/prizepicks/${tier}.png`} alt={tier} width="20" height="20"/>}</span></td>
   <td>{updated?new Date(updated).toLocaleString([],{month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'}):'—'}</td></tr></tbody></table></div>
 </Card>;
}
function WinPredictor({matchup}){
 const m=matchup.data;
 if(!m)return <section className="mlb-context-card mlb-win-predictor"><header><h2>Win predictor</h2><small>Pregame</small></header>{matchup.loading?<Skeleton/>:<Empty>{matchup.error||'Matchup prediction is not available yet.'}</Empty>}</section>;
 const [away,home]=m.teams||[],chance=m.chance;
 // Away grey, home white: the site's black and white, not team colours.
 const colors=['#8c8c8c','#f2f2f2'];
 return <section className="mlb-context-card mlb-win-predictor"><header><h2>Win predictor</h2><small>{m.chanceSource==='espn'?'ESPN projection':m.conference?'Conference game':'Pregame'}</small></header>
  {chance&&away&&home?<div className="mlb-win-body">{[away,home].map((team,index)=><React.Fragment key={team.abbr}>{index===1&&<div className="mlb-win-ring" role="img" aria-label={`${away.abbr} ${fmt(chance.away,0)}%, ${home.abbr} ${fmt(chance.home,0)}%`} style={{background:`conic-gradient(${colors[0]} 0% ${chance.away}%, ${colors[1]} ${chance.away}% 100%)`}}><span>WIN<br/>CHANCE</span></div>}
   <div className="mlb-win-team"><Logo src={team.logo} size={32}/><strong>{ranked(team)}{team.abbr}</strong><small>{team.record||'0-0'}{index===1&&!m.neutral?' · Home':''}</small><b style={{color:colors[index]}}>{fmt(index?chance.home:chance.away,0)}%</b></div></React.Fragment>)}</div>
  :<Empty>No moneyline or projection is posted for this game yet.</Empty>}
 </section>;
}
function MatchupOdds({matchup}){
 const m=matchup.data;if(!m)return null;
 const odds=m.odds;
 return <Card title="Matchup odds" note={odds?.provider||'Pregame'} icon={ChartColumn} className="wnba-odds">
  {odds?<div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Team</th><th scope="col">Moneyline</th><th scope="col">Spread</th><th scope="col">Total</th>{m.chance&&<th scope="col">Win %</th>}</tr></thead><tbody>
   {(m.teams||[]).map(team=>{const side=odds[team.side]||{};return <tr key={team.abbr}><th scope="row"><span className="wnba-team-cell"><Logo src={team.logo}/>{team.abbr}{team.side==='home'&&!m.neutral&&<small>Home</small>}</span></th>
    <td>{price(side.moneyline)}</td><td>{finite(side.spread)?signed(side.spread):'—'} <small>{price(side.spreadOdds)}</small></td>
    <td>{finite(odds.total)?(team.side==='away'?'O ':'U ')+fmt(odds.total):'—'} <small>{price(team.side==='away'?odds.overOdds:odds.underOdds)}</small></td>{m.chance&&<td>{fmt(m.chance[team.side])}%</td>}</tr>;})}
  </tbody></table></div>:<Empty>No game line is posted yet.</Empty>}
  {m.venue?.name&&<Empty>{m.venue.name}{m.venue.city?` · ${m.venue.city}`:''}{m.venue.surface?` · ${m.venue.surface}`:''}{m.neutral?' · Neutral site':''}</Empty>}
 </Card>;
}
function LastFive({matchup}){
 const m=matchup.data;if(!m)return null;
 return <Card title="Last 5 games" icon={CalendarClock} className="wnba-last-five">
  <div className="wnba-last-five-grid">{(m.teams||[]).map(team=><div key={team.abbr}><h3><Logo src={team.logo}/>{team.short||team.name}</h3>
   {(m.lastFive?.[team.abbr]||[]).slice().reverse().map(game=><div className="wnba-last-five-row" key={game.id}><span>{new Date(`${game.date}T12:00:00`).toLocaleDateString([],{month:'numeric',day:'numeric'})}</span><span className="wnba-team-cell">{game.atVs} <Logo src={game.opponentLogo} size={18}/>{game.opponent}</span><b data-result={game.result}>{game.result}</b><span>{game.score}</span></div>)}
   {!(m.lastFive?.[team.abbr]||[]).length&&<Empty>No recent games.</Empty>}</div>)}</div>
 </Card>;
}
function Standings({league,row}){
 const groups=league.data?.standings||[];
 const home=groups.find(group=>group.entries.some(entry=>entry.abbr===row.teamAbbr))?.name;
 const [name,setName]=useState(home);
 useEffect(()=>setName(home),[home]);
 if(!groups.length)return null;
 const visible=groups.filter(group=>group.entries.some(entry=>[row.teamAbbr,opponentOf(row)].includes(entry.abbr)));
 const shown=visible.length?visible:groups.slice(0,1);
 const group=shown.find(item=>item.name===name)||shown[0];
 const involved=new Set([row.teamAbbr,opponentOf(row)]);
 return <Card title="Conference standings" icon={ListOrdered} className="wnba-standings">
  {shown.length>1&&<div className="mlb-context-switch" aria-label="Conference">{shown.map(item=><button type="button" key={item.name} aria-pressed={item.name===group.name} onClick={()=>setName(item.name)}>{item.name}</button>)}</div>}
  <div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">{group.name}</th><th scope="col">Conf</th><th scope="col">Overall</th><th scope="col">STRK</th></tr></thead><tbody>
   {group.entries.map((entry,index)=><tr key={entry.abbr||index} data-involved={involved.has(entry.abbr)}><th scope="row"><span className="wnba-team-cell"><em className="wnba-rank">{index+1}</em><Logo src={entry.logo} size={18}/>{entry.name}</span></th><td>{entry.conf||'—'}</td><td>{entry.record||'—'}</td><td data-tone={String(entry.streak).startsWith('W')?'good':'poor'}>{entry.streak||'—'}</td></tr>)}
  </tbody></table></div>
 </Card>;
}

// ---------------------------------------------------------------- Defense
const strength={good:'Weak',fair:'Neutral',poor:'Tough'};
function DefenseVsPosition({row,position}){
 const current=cfbSeason(),[season,setSeason]=useState(current);
 const league=useCfb('league',{season});
 const data=league.data,opponent=opponentOf(row);
 const start=dvpPosition(position)||'WR';
 const [pos,setPos]=useState(start),[team,setTeam]=useState(opponent);
 useEffect(()=>setPos(start),[start]);
 useEffect(()=>setTeam(opponent),[opponent]);
 const focus=useMemo(()=>propFocus(row),[row]);
 const seasons=<div className="mlb-context-switch nfl-season-switch" aria-label="Season">{[current,current-1].map(year=><button type="button" key={year} aria-pressed={season===year} onClick={()=>setSeason(year)}>{year}</button>)}</div>;
 if(!data)return <Card title="Defense vs position" icon={Shield}>{seasons}{league.loading?<Skeleton/>:<Failed state={league} label="Defense data"/>}</Card>;
 const n=data.teamCount,entry=data.dvp?.[team]?.[pos],labels=data.dvpStats?.[pos]||[];
 const tone=rank=>rankTone(finite(rank)?n+1-rank:rank,n);
 const teams=Object.keys(data.teams||{}).sort();
 return <Card title="Defense vs position" icon={Shield} className="wnba-dvp nfl-dvp">
  <div className="wnba-dvp-controls">
   <div className="nfl-dvp-pickers">
    <div className="wnba-team-picker nfl-position-picker"><FinderDropdown aria-label="Position" value={pos} onChange={e=>setPos(e.target.value)}>{(data.dvpPositions||[]).map(key=><option key={key} value={key}>{key}</option>)}</FinderDropdown></div>
    <div className="wnba-team-picker"><FinderDropdownAssets.Provider value={{Defense:Object.fromEntries(teams.map(abbr=>[abbr,data.teams[abbr].logo]))}}><FinderDropdown aria-label="Defense" value={team} onChange={e=>setTeam(e.target.value)}>{teams.map(abbr=><option key={abbr} value={abbr}>{abbr}</option>)}</FinderDropdown></FinderDropdownAssets.Provider></div>
   </div>{seasons}</div>
  {entry?<div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Stat</th><th scope="col" className="wnba-bar-col"><span className="finder-sr-only">Rank</span></th><th scope="col">SZN</th><th scope="col">L5</th><th scope="col">Strength</th></tr></thead><tbody>
   {focus.order(labels.filter(([key])=>entry.stats[key]),([key])=>key).map(([key,label])=>{const cell=entry.stats[key],[value,rank]=cell.szn||[],f=focus.of(key);return <tr key={key} data-focus={f||undefined}><th scope="row"><span className="wnba-stat-name"><span className="prop-focus-label">{label}<PropFocusTag focus={f}/></span><small>{fmt(value)} allowed/g</small></span></th>
    <td className="wnba-bar-col"><span className="wnba-rank-bar" data-tone={tone(rank)} aria-hidden="true"><i style={{width:finite(rank)?`${rank/n*100}%`:'0%'}}/></span></td>
    {['szn','l5'].map(window=>{const r=cell[window]?.[1];return <td key={window} data-tone={tone(r)}>{ordinal(r)}</td>;})}
    <td><span className="wnba-strength" data-tone={tone(rank)}>{strength[tone(rank)]||'—'}</span></td></tr>;})}
  </tbody></table></div>:<Empty>{data.complete===false?STILL_GATHERING:`No ${pos} has played against ${team} in ${season} yet.`}</Empty>}
  <div className="wnba-scale" aria-hidden="true"><span>Tougher</span><i/><span>Weaker</span></div>
  <Empty>Ranked among {n} FBS defenses, per game.</Empty>
 </Card>;
}
// Each row: what one side's offense gains beside what the other's defense allows.
const OVD=[['passing_yards','passing_yards','Pass yards'],['rushing_yards','rushing_yards','Rush yards'],['total_yards','total_yards','Total yards'],
 ['points','points','Points'],['passing_tds','passing_tds','Pass TDs'],['rushing_tds','rushing_tds','Rush TDs'],['completions','completions','Completions'],
 ['completion_pct','completion_pct','Completion %'],['attempts','attempts','Pass attempts'],['carries','carries','Rush attempts'],
 ['sacks_taken','sacks','Sacks'],['interceptions','interceptions','Interceptions']];
function OffenseVsDefense({league,row}){
 const data=league.data,[flip,setFlip]=useState(false);
 const focus=useMemo(()=>propFocus(row),[row]);
 if(!data)return null;
 const stats=data.teamStats||{},team=row.teamAbbr,opponent=opponentOf(row),offense=flip?opponent:team,defense=flip?team:opponent;
 const off=stats[offense],def=stats[defense],n=data.teamCount;
 if(!off||!def)return <Card title="Offense vs defense" icon={ArrowLeftRight}><Empty>Team data is not available for this matchup yet.</Empty></Card>;
 return <Card title="Offense vs defense" icon={ArrowLeftRight} className="wnba-ovd">
  <div className="wnba-ovd-head"><span className="wnba-team-cell"><Logo src={logoFor(league,offense,row)}/>{offense}</span><button type="button" className="wnba-swap" aria-label="Swap offense and defense" onClick={()=>setFlip(v=>!v)}><ArrowLeftRight size={15}/></button><span className="wnba-team-cell">{defense}<Logo src={logoFor(league,defense,row)}/></span></div>
  <div className="nfl-ovd-labels"><span>Off rank</span><span>Advantage</span><span>Def rank</span></div>
  <div className="wnba-ovd-rows nfl-ovd-rows">{focus.order(OVD,([offKey])=>offKey).map(([offKey,defKey,label])=>{const f=focus.of(offKey);const [ov,or]=off.off[offKey]||[],[dv,dr]=def.def[defKey]||[];if(!finite(or)||!finite(dr))return null;
   // A defense that makes sacks or picks is strong at it; one that allows yards is weak.
   const made=defKey==='sacks'||defKey==='interceptions',defWeak=made?(n-dr)/(n-1):(dr-1)/(n-1);
   const share=((n-or)/(n-1)+defWeak)/2*100,strong=rank=>rank<=Math.ceil(n/3),pct=offKey==='completion_pct'?'%':'';
   return <div className="wnba-ovd-row" key={offKey} data-focus={f||undefined}><span data-side="off" data-strong={strong(or)}>{ordinal(or)}<small>{fmt(ov)}{pct}</small></span><div><small>{label}<PropFocusTag focus={f}/></small><span className="wnba-ovd-bar" role="img" aria-label={`${label}: ${offense} ranks ${ordinal(or)}, ${defense} ${ordinal(dr)}`}><i style={{width:`${share}%`}}/></span></div><span data-side="def" data-strong={made?dr>n-Math.ceil(n/3):strong(dr)}>{ordinal(dr)}<small>{fmt(dv)}{pct}</small></span></div>;})}</div>
  <div className="wnba-ovd-legend"><span><i data-side="off"/>Offensive advantage</span><span>Defensive advantage<i data-side="def"/></span></div>
 </Card>;
}

// ---------------------------------------------------------------- Similar
const SIMILAR_POSITIONS=['QB','RB','WR','TE'];
function SimilarPlayers({row,position}){
 const opponent=opponentOf(row),start=SIMILAR_POSITIONS.includes(dvpPosition(position))?dvpPosition(position):'WR';
 const [pos,setPos]=useState(start);
 useEffect(()=>setPos(start),[start]);
 const market=row.valueKey;
 const context=useCfb('similar',{opponent,position:pos,market,season:cfbSeason()},Boolean(opponent&&market));
 const p=context.data;
 if(!market)return <Card title="Similar players" icon={Users}><Empty>There is no history behind this stat.</Empty></Card>;
 if(!p)return <Card title="Similar players" icon={Users}>{context.loading?<Skeleton/>:<Failed state={context} label="Similar players"/>}</Card>;
 const entries=p.similar||[];
 const withAvg=entries.filter(entry=>finite(entry.diff));
 const over=withAvg.filter(entry=>entry.diff>0).length,diff=average(withAvg.map(entry=>entry.diff)),base=average(withAvg.map(entry=>entry.avg));
 const max=Math.max(1,...entries.flatMap(entry=>[entry.value,entry.avg].filter(finite)));
 return <Card title={`Other ${pos}s vs ${opponent}`} note={row.market} icon={Users} className="wnba-similar">
  <div className="wnba-dvp-controls"><div className="mlb-context-switch" aria-label="Position">{SIMILAR_POSITIONS.map(key=><button type="button" key={key} aria-pressed={pos===key} onClick={()=>setPos(key)}>{key}</button>)}</div>
   {withAvg.length>0&&<div className="wnba-similar-summary"><span data-tone={over*2>=withAvg.length?'good':'poor'}>{over}/{withAvg.length} beat their average</span><span data-tone={diff>0?'good':'poor'}>Avg diff {signed(diff)}{finite(base)&&base?` (${signed(diff/base*100)}%)`:''}</span></div>}</div>
  {entries.length?<div className="wnba-similar-list">{entries.map(entry=><div className="wnba-similar-row" key={entry.gameId+entry.id}>
   <Avatar src={entry.headshot}/><span className="wnba-similar-name"><strong>{entry.name}</strong><small>{ago(`${entry.date}T12:00:00`)} · {entry.team}</small></span>
   <span className="wnba-similar-min">{finite(entry.usage)?`${entry.usage} ${entry.usageLabel}`:''}</span>
   <span className="wnba-similar-result"><b data-tone={!finite(entry.diff)?undefined:entry.diff>0?'good':'poor'}>{fmt(entry.value)}</b><small>{finite(entry.avg)?`avg ${fmt(entry.avg)}`:'first game'}</small><span className="wnba-similar-bar" aria-hidden="true"><i data-tone={entry.diff>0?'good':'poor'} style={{width:`${Math.max(0,entry.value)/max*100}%`}}/>{finite(entry.avg)&&<em style={{left:`${entry.avg/max*100}%`}}/>}</span></span></div>)}</div>
  :<Empty>No {pos}s with a {row.market} number have played {opponent} yet this season.</Empty>}
 </Card>;
}

// ---------------------------------------------------------------- Injuries
function Injuries({row,matchup,impact,filters,onToggleFilter}){
 const team=row.teamAbbr,opponent=opponentOf(row),[side,setSide]=useState(team);
 useEffect(()=>setSide(team),[team]);
 const report=matchup.data?.injuries||{};
 const listed=report[side]||[];
 const effects=side===team?impact:{};
 const choose=(item,kind)=>{const split=effects?.[item.id]?.[kind];if(split?.games)onToggleFilter({id:String(item.id),kind,name:item.name,pos:item.position,ids:split.gameIds});};
 return <Card title="Injuries" note="Game report" icon={HeartPulse} className="mlb-injuries wnba-injuries nfl-injuries">
  <div className="mlb-context-switch" aria-label="Injury report team">{[team,opponent].filter(Boolean).map(abbr=><button type="button" key={abbr} aria-pressed={side===abbr} onClick={()=>setSide(abbr)}><Logo src={logoFor(null,abbr,row)} size={20}/>{abbr}</button>)}</div>
  {side===team&&<div className="nfl-injury-legend"><span><b data-kind="without"><UserX size={14} aria-hidden="true"/>Without</b>Games this player missed</span><span><b data-kind="with"><UserCheck size={14} aria-hidden="true"/>With</b>Games this player played</span></div>}
  {!matchup.data?(matchup.loading?<Skeleton/>:<Failed state={matchup} label="The injury report"/>):!listed.length?<Empty>No injuries are listed for {side} on this game's report. Colleges report less than the NFL, so check team news too.</Empty>:
  <div className="mlb-injury-list">{listed.map(item=>{const effect=effects?.[item.id],code=injuryCode(item);return <article className="mlb-injury-card" key={item.id||item.name}>
   <div className="mlb-injury-heading"><span className="mlb-injury-avatar"><UserRound size={26} aria-hidden="true"/>{item.headshot&&<img src={item.headshot} alt="" width="48" height="48" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span><div><h3>{item.name}</h3><small>{item.position}</small></div><span className="mlb-injury-status" data-day={code!=='OUT'}>{[item.status,item.injury].filter(Boolean).join(' · ')}</span></div>
   {effect&&<div className="wnba-filter-buttons">{[['without','Without'],['with','With']].map(([kind,label])=><button type="button" key={kind} data-kind={kind} disabled={!effect[kind].games} aria-pressed={filters.some(filter=>filter.id===String(item.id)&&filter.kind===kind)} onClick={()=>choose(item,kind)}>{kind==='without'?<UserX size={14} aria-hidden="true"/>:<UserCheck size={14} aria-hidden="true"/>}{label} <small>{effect[kind].games}</small></button>)}</div>}
  </article>;})}</div>}
 </Card>;
}

// ---------------------------------------------------------------- Odds
function Odds({row,playerRows}){
 const offers=playerRows.filter(item=>item.marketKey===row.marketKey);
 const lines=[...new Map(offers.map(item=>[`${item.line}:${item.modifier}`,item])).values()].sort((a,b)=>a.line-b.line);
 return <Card title="Odds" note={row.market} icon={ChartColumn} className="nfl-odds">
  {lines.length?<div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Line</th><th scope="col">App</th><th scope="col">Type</th></tr></thead><tbody>
   {lines.map(item=><tr key={`${item.line}:${item.modifier}`} data-current={item.line===row.line&&item.modifier===row.modifier}><th scope="row">{item.line}</th>
    <td><span className="wnba-team-cell"><img src="/prizepicks/logo.png" alt="" width="20" height="20"/>PrizePicks</span></td>
    <td>{['goblin','demon'].includes(item.modifier)?<span className="wnba-team-cell"><img src={`/prizepicks/${item.modifier}.png`} alt="" width="16" height="16"/>{item.modifier==='goblin'?'Goblin':'Demon'}</span>:'Standard'}</td></tr>)}
  </tbody></table></div>:<Empty>No lines posted for this stat right now.</Empty>}
 </Card>;
}

// ---------------------------------------------------------------- Rankings
const RANKINGS=[['off','points'],['off','total_yards'],['off','passing_yards'],['off','rushing_yards'],['off','passing_tds'],['off','rushing_tds'],['off','completion_pct'],['off','sacks_taken'],
 ['def','points'],['def','total_yards'],['def','passing_yards'],['def','rushing_yards'],['def','completion_pct'],['def','interceptions']];
const RANK_LABEL={sacks:'Sacks made',interceptions:'Interceptions made'};
function Rankings({league,row}){
 const data=league.data;
 if(!data)return <Card title="Team rankings" icon={ListOrdered}>{league.loading?<Skeleton/>:<Failed state={league} label="Team rankings"/>}</Card>;
 const labels=Object.fromEntries(data.stats||[]),stats=data.teamStats||{};
 const teams=[row.teamAbbr,opponentOf(row)].filter(abbr=>stats[abbr]),n=data.teamCount;
 if(!teams.length)return <Card title="Team rankings" icon={ListOrdered}><Empty>{data.complete===false?STILL_GATHERING:'Neither team has an FBS ranking yet.'}</Empty></Card>;
 return <Card title="Team rankings" note={`${data.season} · per game · ${n} FBS teams`} icon={ListOrdered} className="wnba-rankings">
  <div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Stat</th>{teams.map(abbr=><th scope="col" key={abbr}><span className="wnba-team-cell wnba-team-cell-end"><Logo src={logoFor(league,abbr,row)} size={18}/>{abbr}</span></th>)}</tr></thead><tbody>
   {['off','def'].map(group=><React.Fragment key={group}><tr className="wnba-rank-group"><th scope="rowgroup" colSpan={teams.length+1}>{group==='off'?'Offense':'Defense (allowed)'}</th></tr>
    {RANKINGS.filter(([g])=>g===group).map(([g,key])=><tr key={g+key}><th scope="row">{RANK_LABEL[key]&&g==='def'?RANK_LABEL[key]:labels[key]}</th>{teams.map(abbr=>{const [value,rank]=stats[abbr][g][key]||[];
     const tone=g==='def'&&key==='interceptions'?rankTone(finite(rank)?n+1-rank:rank,n):rankTone(rank,n);
     return <td key={abbr}><span data-tone={tone}>{fmt(value)}{key==='completion_pct'?'%':''}</span> <small>{ordinal(rank)}</small></td>;})}</tr>)}
    {group==='def'&&<tr><th scope="row">Sacks made</th>{teams.map(abbr=>{const [value,rank]=stats[abbr].off.sacks||[];return <td key={abbr}><span data-tone={rankTone(rank,n)}>{fmt(value)}</span> <small>{ordinal(rank)}</small></td>;})}</tr>}
   </React.Fragment>)}
  </tbody></table></div>
 </Card>;
}

// ---------------------------------------------------------------- Averages
function Averages({row,rows,position,playerRows,season}){
 const keys=[...new Set([...family(position).support,...family(position).log])].filter(key=>STATS[key]);
 const played=playedGames(rows),opponent=opponentOf(row);
 const offered=useMemo(()=>new Set((playerRows||[]).map(item=>item.valueKey).filter(Boolean)),[playerRows]);
 const regular=played.filter(game=>game.seasonKind!=='postseason');
 const sections=[
  {key:'season',title:`${season} Averages`,icon:Activity,games:played.filter(game=>game.season===season)},
  {key:'last',title:`${season-1} Averages`,icon:Activity,games:played.filter(game=>game.season===season-1)},
  {key:'home',title:`${season} Home Averages`,icon:Home,games:regular.filter(game=>game.season===season&&game.isHome)},
  {key:'away',title:`${season} Away Averages`,icon:Plane,games:regular.filter(game=>game.season===season&&game.isHome===false)},
  {key:'vs',title:`vs ${opponent}`,icon:Swords,games:played.filter(game=>row.opponentId?String(game.opponentId)===String(row.opponentId):game.opponent===opponent)},
 ];
 const [open,setOpen]=useState('season');
 return <Card title="Season averages" icon={Activity} className="nfl-averages">
  {sections.map(section=>{const isOpen=open===section.key&&section.games.length>0;return <div className="nfl-average-section" key={section.key}>
   <button type="button" className="nfl-average-toggle" aria-expanded={isOpen} disabled={!section.games.length} onClick={()=>setOpen(isOpen?'':section.key)}><section.icon size={14} aria-hidden="true"/><strong>{section.games.length?section.title:`No ${section.title.replace(/ Averages$/,'')} games`}</strong><small>{section.games.length} {section.games.length===1?'game':'games'}</small><ChevronDown size={15} aria-hidden="true"/></button>
   {isOpen&&<div className="nfl-average-cards" tabIndex={0} role="region" aria-label={`${section.title}; scroll for more stats`}>{keys.map(key=>{const value=average(section.games.map(game=>statValue(game,key)));
    return <div className="nfl-average-card" key={key} data-current={key===row.valueKey}><span>{STATS[key].short}</span><strong>{fmt(value,2)}</strong><small>{offered.has(key)?<img src="/prizepicks/logo.png" alt="PrizePicks" width="16" height="16"/>:'No lines'}</small></div>;})}</div>}
  </div>;})}
 </Card>;
}

export default function CFBFinderContext({row,playerRows,season,rows,position,league,matchup,weather,impact,filters,onToggleFilter,tab:shownTab}){
 const [ownTab,setTab]=useState('matchup');
 const tab=shownTab||ownTab;
 return <aside className="mlb-finder-context wnba-finder-context nfl-finder-context" data-tab={tab} aria-label="College football matchup research">
  {!shownTab&&<nav className="mlb-context-tabs" aria-label="Research sections">{CFB_TABS.map(([key,label,Icon])=><button key={key} data-section={key} type="button" aria-pressed={tab===key} onClick={()=>setTab(key)}><Icon size={18} aria-hidden="true"/>{label}</button>)}</nav>}
  {tab==='matchup'&&<><CurrentLine row={row} playerRows={playerRows}/><WinPredictor matchup={matchup}/><FootballWeather state={weather} gameId={row.gameId} team={row.teamAbbr||row.team}/><MatchupOdds matchup={matchup}/><LastFive matchup={matchup}/><Standings league={league} row={row}/></>}
  {tab==='defense'&&<><DefenseVsPosition row={row} position={position}/><OffenseVsDefense league={league} row={row}/></>}
  {tab==='similar'&&<SimilarPlayers row={row} position={position}/>}
  {tab==='injuries'&&<Injuries row={row} matchup={matchup} impact={impact} filters={filters} onToggleFilter={onToggleFilter}/>}
  {tab==='odds'&&<Odds row={row} playerRows={playerRows}/>}
  {tab==='rankings'&&<Rankings league={league} row={row}/>}
  <Averages row={row} rows={rows} position={position} playerRows={playerRows} season={season}/>
 </aside>;
}
