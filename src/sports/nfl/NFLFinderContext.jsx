import React,{useEffect,useMemo,useState} from 'react';
import {Activity,ArrowLeftRight,CalendarClock,ChartColumn,ChevronDown,HeartPulse,Home,ListOrdered,Plane,Search,Shield,Swords,Trophy,UserCheck,UserRound,Users,UserX} from 'lucide-react';
import {FinderDropdown,FinderDropdownAssets} from '../../FinderDropdown';
import {STATS,STAT_MARKET,family,injuryCode,nflSeason,opponentOf,playedGames,useNfl} from './nfl-finder';
import {ago,average,finite,fmt,ordinal,price,rankTone,signed} from '../wnba/wnba-research';
import {propFocus} from '../../prop-focus';
import PropFocusTag from '../../PropFocusTag';
import FootballWeather from '../FootballWeather';
import QBRushing from './QBRushing';
import {useIsAdmin,QUIET} from '../../admin-notice.js';

// The NFL page's matchup panel: the WNBA panel's cards and styling
// (WNBAFinderContext.jsx) filled from nflverse -- Matchup, Defense, Similar,
// Injuries, Odds and Rankings, with the season averages underneath.
const tabs=[['matchup','Matchup',Trophy],['defense','Defense',Shield],['similar','Similar',Users],['injuries','Injuries',HeartPulse],['odds','Odds',ChartColumn],['rankings','Rankings',ListOrdered]];
const LOGO=abbr=>abbr?`https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${abbr}.svg`:'';
function Card({title,note,children,icon:Icon=Activity,className=''}){return <section className={'mlb-context-card '+className}><header><h2><Icon size={16} aria-hidden="true"/>{title}</h2>{note&&<small>{note}</small>}</header>{children}</section>;}
function Empty({children}){return <p className="mlb-context-note">{children}</p>;}
function Skeleton(){return <div className="mlb-context-skeleton" role="status" aria-label="Loading research"><span/><span/><span/><span/></div>;}
function Failed({state,label}){const admin=useIsAdmin();return <Empty>{admin?<>{state.error||`${label} is temporarily unavailable.`} <button type="button" onClick={state.retry}>Retry</button></>:QUIET}</Empty>;}
function Logo({src,size=22}){return src?<img className="wnba-logo" src={src} alt="" width={size} height={size} loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>:null;}
function Avatar({src}){return <span className="wnba-avatar"><UserRound size={18} aria-hidden="true"/>{src&&<img src={src} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span>;}
const bookLogo=key=>key==='prizepicks'?'/prizepicks/logo.png':`/sportsbooks/${key}.png`;
const bookName=key=>({prizepicks:'PrizePicks',draftkings:'DraftKings',fanduel:'FanDuel',betmgm:'BetMGM',underdog:'Underdog',caesars:'Caesars'}[key]||key);

// ---------------------------------------------------------------- Matchup
function CurrentLine({row,playerRows}){
 const offers=playerRows.filter(item=>item.marketKey===row.marketKey&&Number(item.line)===Number(row.line));
 const prizepicks=offers.find(item=>item.apps?.some(app=>app.key==='prizepicks'));
 const tier=['goblin','demon'].includes(String(prizepicks?.modifier).toLowerCase())?String(prizepicks.modifier).toLowerCase():null;
 const updated=offers.map(item=>item.raw?.line?.updatedAt||item.raw?.line?.fetchedAt).filter(Boolean).sort().at(-1);
 return <Card title="Current line" note={row.market} icon={ChartColumn} className="nfl-current-line">
  <div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Line</th><th scope="col">Apps</th><th scope="col">Updated</th></tr></thead><tbody><tr>
   <th scope="row">{row.direction==='UNDER'?'U ':''}{row.line}</th>
   <td><span className="nfl-line-apps">{[...new Set(offers.flatMap(item=>(item.apps||[]).map(app=>app.key)))].map(key=><img key={key} src={bookLogo(key)} alt={bookName(key)} title={bookName(key)} width="22" height="22" onError={e=>{e.currentTarget.hidden=true;}}/>)}{tier&&<img src={`/prizepicks/${tier}.png`} alt={tier} width="20" height="20"/>}</span></td>
   <td>{updated?new Date(updated).toLocaleString([],{month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'}):'—'}</td></tr></tbody></table></div>
 </Card>;
}
function WinPredictor({matchup}){
 const m=matchup.data;
 if(!m)return <section className="mlb-context-card mlb-win-predictor"><header><h2>Win predictor</h2><small>Pregame</small></header>{matchup.loading?<Skeleton/>:<Empty>{matchup.error||'Matchup prediction is not available yet.'}</Empty>}</section>;
 const [away,home]=m.teams,source=m.odds?.noVig;
 // Away grey, home white: the site's black and white, not team colours.
 const colors=['#8c8c8c','#f2f2f2'];
 return <section className="mlb-context-card mlb-win-predictor"><header><h2>Win predictor</h2><small>{m.game.divisional?'Division game':'Regular season'}</small></header>
  {source?<><div className="mlb-win-body">{[away,home].map((team,index)=><React.Fragment key={team.abbr}>{index===1&&<div className="mlb-win-ring" role="img" aria-label={`${away.abbr} ${fmt(source.away,0)}%, ${home.abbr} ${fmt(source.home,0)}%`} style={{background:`conic-gradient(${colors[0]} 0% ${source.away}%, ${colors[1]} ${source.away}% 100%)`}}><span>WIN<br/>CHANCE</span></div>}
   <div className="mlb-win-team"><Logo src={team.logo} size={32}/><strong>{team.abbr}</strong><small>{team.record||'0-0'}{index===1?' · Home':''}</small><b style={{color:colors[index]}}>{fmt(index?source.home:source.away,0)}%</b></div></React.Fragment>)}</div></>
  :<Empty>No moneyline is posted for this game yet.</Empty>}
 </section>;
}
function MatchupOdds({matchup}){
 const m=matchup.data;if(!m)return null;
 const odds=m.odds;
 return <Card title="Matchup odds" note="Regular season" icon={ChartColumn} className="wnba-odds">
  {odds?<div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Team</th><th scope="col">Moneyline</th><th scope="col">Spread</th><th scope="col">Total</th>{odds.noVig&&<th scope="col">Win %</th>}</tr></thead><tbody>
   {m.teams.map(team=>{const side=odds[team.side]||{};return <tr key={team.abbr}><th scope="row"><span className="wnba-team-cell"><Logo src={team.logo}/>{team.abbr}{team.side==='home'&&<small>Home</small>}</span></th>
    <td>{price(side.moneyline)}</td><td>{finite(side.spread)?signed(side.spread):'—'} <small>{price(side.spreadOdds)}</small></td>
    <td>{finite(odds.total)?(team.side==='away'?'O ':'U ')+fmt(odds.total):'—'} <small>{price(team.side==='away'?odds.overOdds:odds.underOdds)}</small></td>{odds.noVig&&<td>{fmt(odds.noVig[team.side])}%</td>}</tr>;})}
  </tbody></table></div>:<Empty>No game line is posted yet.</Empty>}
  {m.venue?.name&&<Empty>{m.venue.name}{m.venue.roof?` · ${m.venue.roof}`:''}{m.venue.surface?` · ${m.venue.surface}`:''}</Empty>}
 </Card>;
}
function LastFive({matchup}){
 const m=matchup.data;if(!m)return null;
 return <Card title="Last 5 games" icon={CalendarClock} className="wnba-last-five">
  <div className="wnba-last-five-grid">{m.teams.map(team=><div key={team.abbr}><h3><Logo src={team.logo}/>{team.name}</h3>
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
 const group=groups.find(item=>item.name===name)||groups[0];
 const involved=new Set([row.teamAbbr,opponentOf(row)]);
 return <Card title="Season standings" icon={ListOrdered} className="wnba-standings">
  <div className="mlb-context-switch" aria-label="Conference">{groups.map(item=><button type="button" key={item.name} aria-pressed={item.name===group.name} onClick={()=>setName(item.name)}>{item.name}</button>)}</div>
  <div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Team</th><th scope="col">W-L</th><th scope="col">PCT</th><th scope="col">GB</th><th scope="col">STRK</th></tr></thead><tbody>
   {group.entries.map((entry,index)=><tr key={entry.abbr} data-involved={involved.has(entry.abbr)}><th scope="row"><span className="wnba-team-cell"><em className="wnba-rank">{index+1}</em><Logo src={entry.logo} size={18}/>{entry.name}</span></th><td>{entry.record}</td><td>{entry.pct}</td><td>{entry.gb}</td><td data-tone={String(entry.streak).startsWith('W')?'good':'poor'}>{entry.streak||'—'}</td></tr>)}
  </tbody></table></div>
 </Card>;
}

// ---------------------------------------------------------------- Defense
const strength={good:'Weak',fair:'Neutral',poor:'Tough'};
function DefenseVsPosition({row,position}){
 const current=nflSeason(),[season,setSeason]=useState(current);
 const league=useNfl('league',{season});
 const data=league.data,opponent=opponentOf(row);
 const start=['QB','RB','WR','TE','FB','K'].includes(position)?position:['DL','LB','DB'].includes(position)?position:'WR';
 const [pos,setPos]=useState(start),[team,setTeam]=useState(opponent);
 useEffect(()=>setPos(start),[start]);
 useEffect(()=>setTeam(opponent),[opponent]);
 const focus=useMemo(()=>propFocus(row),[row]);
 const seasons=<div className="mlb-context-switch nfl-season-switch" aria-label="Season">{[current,current-1].map(year=><button type="button" key={year} aria-pressed={season===year} onClick={()=>setSeason(year)}>{year}</button>)}</div>;
 if(!data)return <Card title="Defense vs position" icon={Shield}>{seasons}{league.loading?<Skeleton/>:<Failed state={league} label="Defense data"/>}</Card>;
 const n=data.teamCount,entry=data.dvp?.[team]?.[pos],labels=data.dvpStats?.[pos]||[];
 const tone=rank=>rankTone(finite(rank)?n+1-rank:rank,n);
 return <Card title="Defense vs position" icon={Shield} className="wnba-dvp nfl-dvp">
  <div className="wnba-dvp-controls">
   <div className="nfl-dvp-pickers">
    <div className="wnba-team-picker nfl-position-picker"><FinderDropdown aria-label="Position" value={pos} onChange={e=>setPos(e.target.value)}>{(data.dvpPositions||[]).map(key=><option key={key} value={key}>{key}</option>)}</FinderDropdown></div>
    <div className="wnba-team-picker"><FinderDropdownAssets.Provider value={{Defense:Object.fromEntries(Object.keys(data.teams).map(abbr=>[abbr,LOGO(abbr)]))}}><FinderDropdown aria-label="Defense" value={team} onChange={e=>setTeam(e.target.value)}>{Object.keys(data.teams).sort().map(abbr=><option key={abbr} value={abbr}>{abbr}</option>)}</FinderDropdown></FinderDropdownAssets.Provider></div>
   </div>{seasons}</div>
  {entry?<div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Stat</th><th scope="col" className="wnba-bar-col"><span className="finder-sr-only">Rank</span></th><th scope="col">SZN</th><th scope="col">L5</th><th scope="col">Strength</th></tr></thead><tbody>
   {focus.order(labels.filter(([key])=>entry.stats[key]),([key])=>key).map(([key,label])=>{const cell=entry.stats[key],[value,rank]=cell.szn||[],f=focus.of(key);return <tr key={key} data-focus={f||undefined}><th scope="row"><span className="wnba-stat-name"><span className="prop-focus-label">{label}<PropFocusTag focus={f}/></span><small>{fmt(value)} allowed/g</small></span></th>
    <td className="wnba-bar-col"><span className="wnba-rank-bar" data-tone={tone(rank)} aria-hidden="true"><i style={{width:finite(rank)?`${rank/n*100}%`:'0%'}}/></span></td>
    {['szn','l5'].map(window=>{const r=cell[window]?.[1];return <td key={window} data-tone={tone(r)}>{ordinal(r)}</td>;})}
    <td><span className="wnba-strength" data-tone={tone(rank)}>{strength[tone(rank)]||'—'}</span></td></tr>;})}
  </tbody></table></div>:<Empty>No {pos} has played against {team} in {season} yet.</Empty>}
  <div className="wnba-scale" aria-hidden="true"><span>Tougher</span><i/><span>Weaker</span></div>
 </Card>;
}
const OVD_ORDER=['receiving_yards','receptions','targets','receiving_tds','longest_reception','passing_yards','passing_tds','attempts','completions','interceptions','rushing_yards','carries','rushing_tds','redzone_targets','rush_rec_tds','rush_rec_yards','pass_rush_yards','sacks','tackles','assists','tackles_assists','fg_made','pat_made','kicking_points','fumbles_lost','fantasy','longest_rush','longest_completion','completion_pct','sacks_taken','punts','punts_inside_20'];
function mergedTeamStats(league,pbp){
 const base=league.data?.teamStats||{},extra=pbp.data?.teamStats||{};
 return Object.fromEntries(Object.keys(base).map(team=>[team,{off:{...base[team].off,...extra[team]?.off},def:{...base[team].def,...extra[team]?.def}}]));
}
function OffenseVsDefense({league,pbp,row}){
 const data=league.data,[flip,setFlip]=useState(false);
 const stats=useMemo(()=>mergedTeamStats(league,pbp),[league,pbp]);
 const focus=useMemo(()=>propFocus(row),[row]);
 if(!data)return null;
 const labels=Object.fromEntries([...(data.stats||[]),...(pbp.data?.stats||[])]);
 const team=row.teamAbbr,opponent=opponentOf(row),offense=flip?opponent:team,defense=flip?team:opponent;
 const off=stats[offense],def=stats[defense],n=data.teamCount;
 if(!off||!def)return <Card title="Offense vs defense" icon={ArrowLeftRight}><Empty>Team data is not available for this matchup yet.</Empty></Card>;
 return <Card title="Offense vs defense" icon={ArrowLeftRight} className="wnba-ovd">
  <div className="wnba-ovd-head"><span className="wnba-team-cell"><Logo src={LOGO(offense)}/>{offense}</span><button type="button" className="wnba-swap" aria-label="Swap offense and defense" onClick={()=>setFlip(v=>!v)}><ArrowLeftRight size={15}/></button><span className="wnba-team-cell">{defense}<Logo src={LOGO(defense)}/></span></div>
  <div className="nfl-ovd-labels"><span>Off rank</span><span>Advantage</span><span>Def rank</span></div>
  <div className="wnba-ovd-rows nfl-ovd-rows">{focus.order(OVD_ORDER).map(key=>{const [ov,or]=off.off[key]||[],[dv,dr]=def.def[key]||[];if(!finite(or)||!finite(dr))return null;
   const share=((n-or)/(n-1)+(dr-1)/(n-1))/2*100,strong=rank=>rank<=Math.ceil(n/3),pct=key==='completion_pct'?'%':'',f=focus.of(key);
   return <div className="wnba-ovd-row" key={key} data-focus={f||undefined}><span data-side="off" data-strong={strong(or)}>{ordinal(or)}<small>{fmt(ov)}{pct}</small></span><div><small>{labels[key]||key}<PropFocusTag focus={f}/></small><span className="wnba-ovd-bar" role="img" aria-label={`${labels[key]}: ${offense} ranks ${ordinal(or)}, ${defense} allows ${ordinal(dr)}`}><i style={{width:`${share}%`}}/></span></div><span data-side="def" data-strong={strong(dr)}>{ordinal(dr)}<small>{fmt(dv)}{pct}</small></span></div>;})}
   {!pbp.data&&pbp.loading&&<Empty>Loading red-zone and longest-play ranks…</Empty>}</div>
  <div className="wnba-ovd-legend"><span><i data-side="off"/>Offensive advantage</span><span>Defensive advantage<i data-side="def"/></span></div>
 </Card>;
}

// ---------------------------------------------------------------- Similar
const SIMILAR_POSITIONS=['QB','RB','WR','TE'];
function SimilarPlayers({context,row,position}){
 const opponent=opponentOf(row),start=SIMILAR_POSITIONS.includes(position)?position:'WR';
 const [pos,setPos]=useState(start);
 useEffect(()=>setPos(start),[start]);
 const p=context.data;
 if(!p)return <Card title="Similar players" icon={Users}>{context.loading?<Skeleton/>:<Failed state={context} label="Similar players"/>}</Card>;
 const entries=p.similar?.[pos]||[];
 const withAvg=entries.filter(entry=>finite(entry.diff));
 const over=withAvg.filter(entry=>entry.diff>0).length,diff=average(withAvg.map(entry=>entry.diff)),base=average(withAvg.map(entry=>entry.avg));
 const max=Math.max(1,...entries.flatMap(entry=>[entry.value,entry.avg].filter(finite)));
 return <Card title={`Other ${pos}s vs ${opponent}`} note={row.marketKey==='longest_reception'?'Receiving Yards':row.market} icon={Users} className="wnba-similar">
  <div className="wnba-dvp-controls"><div className="mlb-context-switch" aria-label="Position">{SIMILAR_POSITIONS.map(key=><button type="button" key={key} aria-pressed={pos===key} onClick={()=>setPos(key)}>{key}</button>)}</div>
   {withAvg.length>0&&<div className="wnba-similar-summary"><span data-tone={over*2>=withAvg.length?'good':'poor'}>{over}/{withAvg.length} beat their average</span><span data-tone={diff>0?'good':'poor'}>Avg diff {signed(diff)}{finite(base)&&base?` (${signed(diff/base*100)}%)`:''}</span></div>}</div>
  {entries.length?<div className="wnba-similar-list">{entries.map(entry=><div className="wnba-similar-row" key={entry.gameId+entry.id}>
   <Avatar src={entry.headshot}/><span className="wnba-similar-name"><strong>{entry.name}</strong><small>{ago(`${entry.date}T12:00:00`)} · {entry.team}</small></span>
   <span className="wnba-similar-min">{entry.usage} {entry.usageLabel}</span>
   <span className="wnba-similar-result"><b data-tone={!finite(entry.diff)?undefined:entry.diff>0?'good':'poor'}>{fmt(entry.value)}</b><small>{finite(entry.avg)?`avg ${fmt(entry.avg)}`:'first game'}</small><span className="wnba-similar-bar" aria-hidden="true"><i data-tone={entry.diff>0?'good':'poor'} style={{width:`${entry.value/max*100}%`}}/>{finite(entry.avg)&&<em style={{left:`${entry.avg/max*100}%`}}/>}</span></span></div>)}</div>
  :<Empty>No {pos}s have played {opponent} yet this season.</Empty>}
 </Card>;
}

// ---------------------------------------------------------------- Injuries
function Injuries({row,season,context,filters,onToggleFilter}){
 const team=row.teamAbbr,opponent=opponentOf(row),[side,setSide]=useState(team),[query,setQuery]=useState('');
 useEffect(()=>setSide(team),[team]);
 const data=useNfl('team',{season,team:side},Boolean(side));
 const impact=side===team?new Map((context.data?.withWithout||[]).map(item=>[item.id,item])):new Map();
 const listed=(data.data?.injuries||[]).filter(item=>!query.trim()||item.name.toLowerCase().includes(query.trim().toLowerCase()));
 const choose=(item,kind)=>{const split=impact.get(item.id)?.[kind];if(split?.games)onToggleFilter({id:String(item.id),kind,name:item.name,pos:item.position,ids:split.gameIds});};
 return <Card title="Injuries" note={data.data?.injuryWeek?`Week ${data.data.injuryWeek} report`:'Current report'} icon={HeartPulse} className="mlb-injuries wnba-injuries nfl-injuries">
  <div className="mlb-context-switch" aria-label="Injury report team">{[team,opponent].filter(Boolean).map(abbr=><button type="button" key={abbr} aria-pressed={side===abbr} onClick={()=>setSide(abbr)}><img src={LOGO(abbr)} alt="" width="20" height="20" onError={e=>{e.currentTarget.hidden=true;}}/>{abbr}</button>)}</div>
  {side===team&&<div className="nfl-injury-legend"><span><b data-kind="without"><UserX size={14} aria-hidden="true"/>Without</b>Games this player missed</span><span><b data-kind="with"><UserCheck size={14} aria-hidden="true"/>With</b>Games this player played</span></div>}
  {!data.data?(data.loading?<Skeleton/>:<Failed state={data} label="The injury report"/>):!listed.length?<Empty>{query?'No listed player matches that search.':`No injuries listed for ${side}.`}</Empty>:
  <div className="mlb-injury-list">{listed.map(item=>{const effect=impact.get(item.id),code=injuryCode(item);return <article className="mlb-injury-card" key={item.id||item.name}>
   <div className="mlb-injury-heading"><span className="mlb-injury-avatar"><UserRound size={26} aria-hidden="true"/>{item.headshot&&<img src={item.headshot} alt="" width="48" height="48" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span><div><h3>{item.name}</h3><small>{item.position}</small></div><span className="mlb-injury-status" data-day={!['OUT','IR','PUP','NFI'].includes(code)}>{[code==='DOUBT'?'Doubtful':code||item.status,item.injury].filter(Boolean).join(' · ')}</span></div>
   {effect&&<div className="wnba-filter-buttons">{[['without','Without'],['with','With']].map(([kind,label])=><button type="button" key={kind} data-kind={kind} disabled={!effect[kind].games} aria-pressed={filters.some(filter=>filter.id===String(item.id)&&filter.kind===kind)} onClick={()=>choose(item,kind)}>{kind==='without'?<UserX size={14} aria-hidden="true"/>:<UserCheck size={14} aria-hidden="true"/>}{label} <small>{effect[kind].games}</small></button>)}</div>}
   {item.practice&&<small className="mlb-injury-reported">{item.week?`Week ${item.week}: `:''}{item.practice}</small>}
  </article>;})}</div>}
  <label className="nfl-injury-search"><Search size={15} aria-hidden="true"/><input type="search" placeholder="Search any player…" value={query} onChange={e=>setQuery(e.target.value)} aria-label="Search the injury report"/></label>
 </Card>;
}

// ---------------------------------------------------------------- Odds
function Odds({row,playerRows}){
 const offers=playerRows.filter(item=>item.marketKey===row.marketKey);
 const lines=[...new Set(offers.map(item=>item.line))].filter(finite).sort((a,b)=>a-b);
 return <Card title="Odds" note={row.market} icon={ChartColumn} className="nfl-odds">
  {lines.length?<div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Line</th><th scope="col">App</th><th scope="col">Over</th><th scope="col">Under</th></tr></thead><tbody>
   {lines.flatMap(line=>{const books=new Map();offers.filter(item=>item.line===line).forEach(item=>(item.apps||[]).forEach(app=>{const book=books.get(app.key)||{key:app.key,over:null,under:null,tier:item.modifier};if(finite(app.over))book.over=app.over;if(finite(app.under))book.under=app.under;books.set(app.key,book);}));
    return [...books.values()].map((book,index)=><tr key={`${line}:${book.key}`} data-current={line===row.line}><th scope="row">{index===0?line:''}</th><td><span className="wnba-team-cell"><img src={bookLogo(book.key)} alt="" width="20" height="20" onError={e=>{e.currentTarget.hidden=true;}}/>{bookName(book.key)}{['goblin','demon'].includes(String(book.tier).toLowerCase())&&<img src={`/prizepicks/${String(book.tier).toLowerCase()}.png`} alt={book.tier} width="16" height="16"/>}</span></td><td>{price(book.over)}</td><td>{price(book.under)}</td></tr>);})}
  </tbody></table></div>:<Empty>No lines posted for this stat right now.</Empty>}
 </Card>;
}

// ---------------------------------------------------------------- Rankings
const RANKINGS=[['off','passing_yards'],['off','rushing_yards'],['off','receiving_tds'],['off','rushing_tds'],['off','completion_pct'],['off','sacks_taken'],['off','sacks'],['off','fantasy'],
 ['def','passing_yards'],['def','rushing_yards'],['def','receiving_yards'],['def','rush_rec_tds'],['def','sacks'],['def','fantasy']];
function Rankings({league,pbp,row}){
 const data=league.data,stats=useMemo(()=>mergedTeamStats(league,pbp),[league,pbp]);
 if(!data)return <Card title="Team rankings" icon={ListOrdered}>{league.loading?<Skeleton/>:<Failed state={league} label="Team rankings"/>}</Card>;
 const labels=Object.fromEntries(data.stats||[]);
 const teams=[row.teamAbbr,opponentOf(row)].filter(abbr=>stats[abbr]),n=data.teamCount;
 return <Card title="Team rankings" note={`${data.season} · per game`} icon={ListOrdered} className="wnba-rankings">
  <div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Stat</th>{teams.map(abbr=><th scope="col" key={abbr}><span className="wnba-team-cell wnba-team-cell-end"><Logo src={LOGO(abbr)} size={18}/>{abbr}</span></th>)}</tr></thead><tbody>
   {['off','def'].map(group=><React.Fragment key={group}><tr className="wnba-rank-group"><th scope="rowgroup" colSpan={teams.length+1}>{group==='off'?'Offense':'Defense (allowed)'}</th></tr>
    {RANKINGS.filter(([g])=>g===group).map(([g,key])=><tr key={g+key}><th scope="row">{labels[key]}</th>{teams.map(abbr=>{const [value,rank]=stats[abbr][g][key]||[];return <td key={abbr}><span data-tone={rankTone(rank,n)}>{fmt(value)}{key==='completion_pct'?'%':''}</span> <small>{ordinal(rank)}</small></td>;})}</tr>)}</React.Fragment>)}
  </tbody></table></div>
 </Card>;
}

// ---------------------------------------------------------------- Averages
function Averages({row,rows,position,playerRows,season}){
 const keys=[...new Set([...family(position).support,...family(position).log])].filter(key=>STATS[key]);
 const played=playedGames(rows),opponent=opponentOf(row);
 const apps=useMemo(()=>{const map=new Map();for(const item of playerRows||[])for(const app of item.apps||[]){const list=map.get(item.marketKey)||new Set();list.add(app.key);map.set(item.marketKey,list);}return map;},[playerRows]);
 const regular=played.filter(game=>game.seasonKind==='regular');
 const sections=[
  {key:'season',title:`${season} Averages`,icon:Activity,games:regular.filter(game=>game.season===season)},
  {key:'last',title:`${season-1} Averages`,icon:Activity,games:regular.filter(game=>game.season===season-1)},
  {key:'home',title:`${season} Home Averages`,icon:Home,games:regular.filter(game=>game.season===season&&game.isHome)},
  {key:'away',title:`${season} Away Averages`,icon:Plane,games:regular.filter(game=>game.season===season&&game.isHome===false)},
  {key:'vs',title:`vs ${opponent}`,icon:Swords,games:played.filter(game=>game.opponent===opponent)},
 ];
 const [open,setOpen]=useState('season');
 return <Card title="Regular season averages" icon={Activity} className="nfl-averages">
  {sections.map(section=>{const isOpen=open===section.key&&section.games.length>0;return <div className="nfl-average-section" key={section.key}>
   <button type="button" className="nfl-average-toggle" aria-expanded={isOpen} disabled={!section.games.length} onClick={()=>setOpen(isOpen?'':section.key)}><section.icon size={14} aria-hidden="true"/><strong>{section.games.length?section.title:`No ${section.title.replace(/ Averages$/,'')} games`}</strong><small>{section.games.length} {section.games.length===1?'game':'games'}</small><ChevronDown size={15} aria-hidden="true"/></button>
   {isOpen&&<div className="nfl-average-cards" tabIndex={0} role="region" aria-label={`${section.title}; scroll for more stats`}>{keys.map(key=>{const value=average(section.games.map(STATS[key].get));const market=STAT_MARKET[key],books=market?[...(apps.get(market)||[])]:[];
    return <div className="nfl-average-card" key={key} data-current={market===row.marketKey}><span>{STATS[key].short}</span><strong>{fmt(value,2)}</strong><small>{books.length?books.slice(0,3).map(book=><img key={book} src={bookLogo(book)} alt={bookName(book)} width="16" height="16" onError={e=>{e.currentTarget.hidden=true;}}/>):'No lines'}{books.length>3&&` +${books.length-3}`}</small></div>;})}</div>}
  </div>;})}
 </Card>;
}

export default function NFLFinderContext({row,playerRows,season,rows,position,league,matchup,weather,context,pbp,filters,onToggleFilter}){
 const [tab,setTab]=useState('matchup');
 return <aside className="mlb-finder-context wnba-finder-context nfl-finder-context" data-tab={tab} aria-label="NFL matchup research">
  <nav className="mlb-context-tabs" aria-label="Research sections">{tabs.map(([key,label,Icon])=><button key={key} data-section={key} type="button" aria-pressed={tab===key} onClick={()=>setTab(key)}><Icon size={18} aria-hidden="true"/>{label}</button>)}</nav>
  {tab==='matchup'&&<><CurrentLine row={row} playerRows={playerRows}/><QBRushing row={row} season={season} position={position}/><WinPredictor matchup={matchup}/><FootballWeather state={weather} gameId={row.raw?.gameId||row.gameId} team={row.teamAbbr}/><MatchupOdds matchup={matchup}/><LastFive matchup={matchup}/><Standings league={league} row={row}/></>}
  {tab==='defense'&&<><DefenseVsPosition row={row} position={position}/><OffenseVsDefense league={league} pbp={pbp} row={row}/></>}
  {tab==='similar'&&<SimilarPlayers context={context} row={row} position={position}/>}
  {tab==='injuries'&&<Injuries row={row} season={season} context={context} filters={filters} onToggleFilter={onToggleFilter}/>}
  {tab==='odds'&&<Odds row={row} playerRows={playerRows}/>}
  {tab==='rankings'&&<Rankings league={league} pbp={pbp} row={row}/>}
  <Averages row={row} rows={rows} position={position} playerRows={playerRows} season={season}/>
 </aside>;
}
