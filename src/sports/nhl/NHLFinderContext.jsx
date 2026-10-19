import React,{useEffect,useMemo,useState} from 'react';
import {Activity,ArrowLeftRight,CalendarClock,ChartColumn,ChevronDown,HeartPulse,Home,ListOrdered,Plane,Search,Shield,Swords,Trophy,UserCheck,UserRound,Users,UserX} from 'lucide-react';
import {FinderDropdown,FinderDropdownAssets} from '../../FinderDropdown';
import {ago,average,finite,fmt,ordinal,price,rankTone,signed} from '../wnba/wnba-research';
import {STATS,family,nhlLogo,nhlSeason,playedGames,seasonLabel,statValue,withWithout} from './nhl-stats';
import {opponentOf,useNhl} from './nhl-finder';
import {propFocus} from '../../prop-focus';
import PropFocusTag from '../../PropFocusTag';
import {useIsAdmin,QUIET} from '../../admin-notice.js';

// The NHL page's matchup panel: the NFL and WNBA panels' cards and styling
// filled from the NHL's own feed and ESPN -- Matchup, Defense, Similar,
// Injuries, Odds and Rankings, with the averages underneath.
const tabs=[['matchup','Matchup',Trophy],['defense','Defense',Shield],['similar','Similar',Users],['injuries','Injuries',HeartPulse],['odds','Odds',ChartColumn],['rankings','Rankings',ListOrdered]];
const POSITION={L:'LW',R:'RW',LW:'LW',RW:'RW',C:'C',D:'D',G:'G'};
function Card({title,note,children,icon:Icon=Activity,className=''}){return <section className={'mlb-context-card '+className}><header><h2><Icon size={16} aria-hidden="true"/>{title}</h2>{note&&<small>{note}</small>}</header>{children}</section>;}
function Empty({children}){return <p className="mlb-context-note">{children}</p>;}
function Skeleton(){return <div className="mlb-context-skeleton" role="status" aria-label="Loading research"><span/><span/><span/><span/></div>;}
function Failed({state,label}){const admin=useIsAdmin();return <Empty>{admin?<>{state.error||`${label} is temporarily unavailable.`} <button type="button" onClick={state.retry}>Retry</button></>:QUIET}</Empty>;}
function Logo({src,size=22}){return src?<img className="wnba-logo" src={src} alt="" width={size} height={size} loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>:null;}
function Avatar({src}){return <span className="wnba-avatar"><UserRound size={18} aria-hidden="true"/>{src&&<img src={src} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span>;}
const bookLogo=key=>key==='prizepicks'?'/prizepicks/logo.png':`/sportsbooks/${key}.png`;
const bookName=key=>({prizepicks:'PrizePicks',draftkings:'DraftKings',fanduel:'FanDuel',betmgm:'BetMGM',underdog:'Underdog',caesars:'Caesars'}[key]||key);
const KIND_NOTE={preseason:'Preseason',regular:'Regular season',postseason:'Playoffs'};

// ---------------------------------------------------------------- Matchup
function CurrentLine({row,playerRows}){
 const offers=playerRows.filter(item=>item.marketKey===row.marketKey&&Number(item.line)===Number(row.line));
 const tier=['goblin','demon'].includes(String(row.modifier).toLowerCase())?String(row.modifier).toLowerCase():null;
 const updated=offers.flatMap(item=>(item.apps||[]).map(app=>app.updatedAt)).filter(Boolean).sort().at(-1);
 return <Card title="Current line" note={row.market} icon={ChartColumn} className="nfl-current-line">
  <div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Line</th><th scope="col">Apps</th><th scope="col">Updated</th></tr></thead><tbody><tr>
   <th scope="row">{row.line}</th>
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
 return <section className="mlb-context-card mlb-win-predictor"><header><h2>Win predictor</h2><small>{m.game.divisional?'Division game':KIND_NOTE[m.game.kind]||'Pregame'}</small></header>
  {source?<div className="mlb-win-body">{[away,home].map((team,index)=><React.Fragment key={team.abbr}>{index===1&&<div className="mlb-win-ring" role="img" aria-label={`${away.abbr} ${fmt(source.away,0)}%, ${home.abbr} ${fmt(source.home,0)}%`} style={{background:`conic-gradient(${colors[0]} 0% ${source.away}%, ${colors[1]} ${source.away}% 100%)`}}><span>WIN<br/>CHANCE</span></div>}
   <div className="mlb-win-team"><Logo src={team.logo} size={32}/><strong>{team.abbr}</strong><small>{team.record||'0-0-0'}{index===1?' · Home':''}</small><b style={{color:colors[index]}}>{fmt(index?source.home:source.away,0)}%</b></div></React.Fragment>)}</div>
  :<Empty>No moneyline is posted for this game yet.</Empty>}
 </section>;
}
function MatchupOdds({matchup}){
 const m=matchup.data;if(!m)return null;
 const odds=m.odds;
 return <Card title="Matchup odds" note={KIND_NOTE[m.game.kind]} icon={ChartColumn} className="wnba-odds">
  {odds?<div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Team</th><th scope="col">Moneyline</th><th scope="col">Puck line</th><th scope="col">Total</th>{odds.noVig&&<th scope="col">Win %</th>}</tr></thead><tbody>
   {m.teams.map(team=>{const side=odds[team.side]||{};return <tr key={team.abbr}><th scope="row"><span className="wnba-team-cell"><Logo src={team.logo}/>{team.abbr}{team.side==='home'&&<small>Home</small>}</span></th>
    <td>{price(side.moneyline)}</td><td>{finite(side.spread)?signed(side.spread):'—'} <small>{price(side.spreadOdds)}</small></td>
    <td>{finite(odds.total)?(team.side==='away'?'O ':'U ')+fmt(odds.total):'—'} <small>{price(team.side==='away'?odds.overOdds:odds.underOdds)}</small></td>{odds.noVig&&<td>{fmt(odds.noVig[team.side])}%</td>}</tr>;})}
  </tbody></table></div>:<Empty>No game line is posted yet.</Empty>}
 </Card>;
}
function LastFive({matchup}){
 const m=matchup.data;if(!m)return null;
 return <Card title="Last 5 games" icon={CalendarClock} className="wnba-last-five">
  <div className="wnba-last-five-grid">{m.teams.map(team=><div key={team.abbr}><h3><Logo src={team.logo}/>{team.name}</h3>
   {(m.lastFive?.[team.abbr]||[]).slice().reverse().map(game=><div className="wnba-last-five-row" key={game.gameId}><span>{new Date(`${game.date}T12:00:00`).toLocaleDateString([],{month:'numeric',day:'numeric',year:'2-digit'})}</span><span className="wnba-team-cell">{game.isHome?'vs':'@'} <Logo src={game.opponentLogo} size={18}/>{game.opponent}</span><b data-result={game.result}>{game.result}</b><span>{game.score}</span></div>)}
   {!(m.lastFive?.[team.abbr]||[]).length&&<Empty>No recent games.</Empty>}</div>)}</div>
 </Card>;
}
function Standings({matchup,row}){
 const groups=matchup.data?.standings||[];
 const home=groups.find(group=>group.entries.some(entry=>entry.abbr===row.teamAbbr))?.name;
 const [name,setName]=useState(home);
 useEffect(()=>setName(home),[home]);
 if(!groups.length)return null;
 const group=groups.find(item=>item.name===name)||groups[0];
 const involved=new Set([row.teamAbbr,opponentOf(row)]);
 return <Card title="Standings" icon={ListOrdered} className="wnba-standings">
  <div className="mlb-context-switch" aria-label="Division">{groups.map(item=><button type="button" key={item.name} aria-pressed={item.name===group.name} onClick={()=>setName(item.name)}>{item.name}</button>)}</div>
  <div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Team</th><th scope="col">GP</th><th scope="col">W-L-OT</th><th scope="col">PTS</th><th scope="col">STRK</th></tr></thead><tbody>
   {group.entries.map((entry,index)=><tr key={entry.abbr} data-involved={involved.has(entry.abbr)}><th scope="row"><span className="wnba-team-cell"><em className="wnba-rank">{index+1}</em><Logo src={entry.logo} size={18}/>{entry.name}</span></th><td>{entry.played}</td><td>{entry.wins}-{entry.losses}-{entry.otl}</td><td>{entry.points}</td><td data-tone={String(entry.streak).startsWith('W')?'good':'poor'}>{entry.streak||'—'}</td></tr>)}
  </tbody></table></div>
 </Card>;
}

// ---------------------------------------------------------------- Defense
const strength={good:'Weak',fair:'Neutral',poor:'Tough'};
const WINDOW_LABEL={l20:'L20',l10:'L10',l5:'L5'};
function DefenseVsPosition({league,row,position}){
 const data=league.data,opponent=opponentOf(row);
 const start=POSITION[String(position||'').toUpperCase()]||'C';
 const [pos,setPos]=useState(start),[team,setTeam]=useState(opponent);
 useEffect(()=>setPos(start),[start]);
 useEffect(()=>setTeam(opponent),[opponent]);
 const focus=useMemo(()=>propFocus(row),[row]);
 if(!data)return <Card title="Defense vs position" icon={Shield}>{league.loading?<Skeleton/>:<Failed state={league} label="Defense data"/>}</Card>;
 const n=data.teamCount,entry=data.dvp?.[team]?.[pos],labels=data.dvpStats?.[pos]||[];
 const tone=rank=>rankTone(finite(rank)?n+1-rank:rank,n);
 return <Card title="Defense vs position" note="Last 20 games" icon={Shield} className="wnba-dvp nfl-dvp">
  <div className="wnba-dvp-controls"><div className="nfl-dvp-pickers">
   <div className="wnba-team-picker nfl-position-picker"><FinderDropdown aria-label="Position" value={pos} onChange={e=>setPos(e.target.value)}>{(data.dvpPositions||[]).map(key=><option key={key} value={key}>{key}</option>)}</FinderDropdown></div>
   <div className="wnba-team-picker"><FinderDropdownAssets.Provider value={{Defense:Object.fromEntries(Object.keys(data.teams).map(abbr=>[abbr,nhlLogo(abbr)]))}}><FinderDropdown aria-label="Defense" value={team} onChange={e=>setTeam(e.target.value)}>{Object.keys(data.teams).sort().map(abbr=><option key={abbr} value={abbr}>{abbr}</option>)}</FinderDropdown></FinderDropdownAssets.Provider></div>
  </div></div>
  {entry?<div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Stat</th><th scope="col" className="wnba-bar-col"><span className="finder-sr-only">Rank</span></th>{Object.values(WINDOW_LABEL).map(label=><th scope="col" key={label}>{label}</th>)}<th scope="col">Strength</th></tr></thead><tbody>
   {focus.order(labels.filter(([key])=>entry[key]),([key])=>key).map(([key,label])=>{const cell=entry[key],[value,rank]=cell.l20||[],f=focus.of(key);return <tr key={key} data-focus={f||undefined}><th scope="row"><span className="wnba-stat-name"><span className="prop-focus-label">{label}<PropFocusTag focus={f}/></span><small>{fmt(value)} allowed/g</small></span></th>
    <td className="wnba-bar-col"><span className="wnba-rank-bar" data-tone={tone(rank)} aria-hidden="true"><i style={{width:finite(rank)?`${rank/n*100}%`:'0%'}}/></span></td>
    {Object.keys(WINDOW_LABEL).map(window=>{const r=cell[window]?.[1];return <td key={window} data-tone={tone(r)}>{ordinal(r)}</td>;})}
    <td><span className="wnba-strength" data-tone={tone(rank)}>{strength[tone(rank)]||'—'}</span></td></tr>;})}
  </tbody></table></div>:<Empty>No {pos} has played against {team} in these games yet.</Empty>}
  <div className="wnba-scale" aria-hidden="true"><span>Tougher</span><i/><span>Weaker</span></div>
 </Card>;
}
const OVD_ORDER=['goals','assists','points','sog','attempts','hits','fow','fol','blocked','ppp','pim','fantasy','saves','ga','shots_faced'];
function OffenseVsDefense({league,row}){
 const data=league.data,[flip,setFlip]=useState(false);
 const focus=useMemo(()=>propFocus(row),[row]);
 if(!data)return null;
 const labels=Object.fromEntries(data.stats||[]);
 const team=row.teamAbbr,opponent=opponentOf(row),offense=flip?opponent:team,defense=flip?team:opponent;
 const off=data.teams?.[offense],def=data.teams?.[defense],n=data.teamCount;
 if(!off||!def)return <Card title="Offense vs defense" icon={ArrowLeftRight}><Empty>Team data is not available for this matchup yet.</Empty></Card>;
 return <Card title="Offense vs defense" note="Last 20 games" icon={ArrowLeftRight} className="wnba-ovd">
  <div className="wnba-ovd-head"><span className="wnba-team-cell"><Logo src={nhlLogo(offense)}/>{offense}</span><button type="button" className="wnba-swap" aria-label="Swap offense and defense" onClick={()=>setFlip(v=>!v)}><ArrowLeftRight size={15}/></button><span className="wnba-team-cell">{defense}<Logo src={nhlLogo(defense)}/></span></div>
  <div className="nfl-ovd-labels"><span>Off rank</span><span>Advantage</span><span>Def rank</span></div>
  <div className="wnba-ovd-rows nfl-ovd-rows">{focus.order(OVD_ORDER).map(key=>{const [ov,or]=off.off?.[key]?.l20||[],[dv,dr]=def.def?.[key]?.l20||[],f=focus.of(key);if(!finite(or)||!finite(dr))return null;
   const share=((n-or)/(n-1||1)+(dr-1)/(n-1||1))/2*100,strong=rank=>rank<=Math.ceil(n/3);
   return <div className="wnba-ovd-row" key={key} data-focus={f||undefined}><span data-side="off" data-strong={strong(or)}>{ordinal(or)}<small>{fmt(ov)}</small></span><div><small>{labels[key]||key}<PropFocusTag focus={f}/></small><span className="wnba-ovd-bar" role="img" aria-label={`${labels[key]}: ${offense} ranks ${ordinal(or)}, ${defense} allows ${ordinal(dr)}`}><i style={{width:`${share}%`}}/></span></div><span data-side="def" data-strong={strong(dr)}>{ordinal(dr)}<small>{fmt(dv)}</small></span></div>;})}</div>
  <div className="wnba-ovd-legend"><span><i data-side="off"/>Offensive advantage</span><span>Defensive advantage<i data-side="def"/></span></div>
 </Card>;
}

// ---------------------------------------------------------------- Similar
const SIMILAR_POSITIONS=['C','LW','RW','D','G'];
function SimilarPlayers({row,position}){
 const opponent=opponentOf(row),start=POSITION[String(position||'').toUpperCase()]||'C';
 const [pos,setPos]=useState(start);
 useEffect(()=>setPos(start),[start]);
 const state=useNhl('similar',{opponent,position:pos,market:row.valueKey},Boolean(opponent&&row.valueKey));
 const entries=state.data?.entries||[];
 const withAvg=entries.filter(entry=>finite(entry.diff));
 const over=withAvg.filter(entry=>entry.diff>0).length,diff=average(withAvg.map(entry=>entry.diff)),base=average(withAvg.map(entry=>entry.avg));
 const max=Math.max(1,...entries.flatMap(entry=>[entry.value,entry.avg].filter(finite)));
 return <Card title={`Other ${pos}s vs ${opponent}`} note={row.market} icon={Users} className="wnba-similar">
  <div className="wnba-dvp-controls"><div className="mlb-context-switch" aria-label="Position">{SIMILAR_POSITIONS.map(key=><button type="button" key={key} aria-pressed={pos===key} onClick={()=>setPos(key)}>{key}</button>)}</div>
   {withAvg.length>0&&<div className="wnba-similar-summary"><span data-tone={over*2>=withAvg.length?'good':'poor'}>{over}/{withAvg.length} beat their average</span><span data-tone={diff>0?'good':'poor'}>Avg diff {signed(diff)}{finite(base)&&base?` (${signed(diff/base*100)}%)`:''}</span></div>}</div>
  {!row.valueKey?<Empty>No game history is kept for this stat.</Empty>:!state.data?(state.loading?<Skeleton/>:<Failed state={state} label="Similar players"/>):entries.length?<div className="wnba-similar-list">{entries.map(entry=><div className="wnba-similar-row" key={entry.gameId+entry.id}>
   <Avatar src={entry.headshot}/><span className="wnba-similar-name"><strong>{entry.name}</strong><small>{ago(`${entry.date}T12:00:00`)} · {entry.team}</small></span>
   <span className="wnba-similar-min">{finite(entry.toi)?`${fmt(entry.toi)} TOI`:''}</span>
   <span className="wnba-similar-result"><b data-tone={!finite(entry.diff)?undefined:entry.diff>0?'good':'poor'}>{fmt(entry.value)}</b><small>{finite(entry.avg)?`avg ${fmt(entry.avg)}`:'first game'}</small><span className="wnba-similar-bar" aria-hidden="true"><i data-tone={entry.diff>0?'good':'poor'} style={{width:`${entry.value/max*100}%`}}/>{finite(entry.avg)&&<em style={{left:`${entry.avg/max*100}%`}}/>}</span></span></div>)}</div>
  :<Empty>No {pos}s have played {opponent} in its recent games.</Empty>}
 </Card>;
}

// ---------------------------------------------------------------- Injuries
function Injuries({row,log,filters,onToggleFilter}){
 const team=row.teamAbbr,opponent=opponentOf(row),[side,setSide]=useState(team),[query,setQuery]=useState('');
 useEffect(()=>setSide(team),[team]);
 const data=useNhl('team',{team:side},Boolean(side));
 const impact=useMemo(()=>side===team&&log.data?withWithout(log.data,row.playerId,row.valueKey):{},[side,team,log.data,row.playerId,row.valueKey]);
 const listed=(data.data?.injuries||[]).filter(item=>!query.trim()||item.name.toLowerCase().includes(query.trim().toLowerCase()));
 const choose=(item,kind)=>{const split=impact[item.id]?.[kind];if(split?.games)onToggleFilter({id:String(item.id),kind,name:item.name,pos:item.position,ids:split.gameIds});};
 return <Card title="Injuries" icon={HeartPulse} className="mlb-injuries wnba-injuries nfl-injuries">
  <div className="mlb-context-switch" aria-label="Injury report team">{[team,opponent].filter(Boolean).map(abbr=><button type="button" key={abbr} aria-pressed={side===abbr} onClick={()=>setSide(abbr)}><img src={nhlLogo(abbr)} alt="" width="20" height="20" onError={e=>{e.currentTarget.hidden=true;}}/>{abbr}</button>)}</div>
  {side===team&&<div className="nfl-injury-legend"><span><b data-kind="without"><UserX size={14} aria-hidden="true"/>Without</b>Games this player missed</span><span><b data-kind="with"><UserCheck size={14} aria-hidden="true"/>With</b>Games this player played</span></div>}
  {!data.data?(data.loading?<Skeleton/>:<Failed state={data} label="The injury report"/>):!listed.length?<Empty>{query?'No listed player matches that search.':`No injuries listed for ${side}.`}</Empty>:
  <div className="mlb-injury-list">{listed.map(item=>{const effect=item.id?impact[item.id]:null,out=/out|reserve|suspen/i.test(item.status);return <article className="mlb-injury-card" key={item.id||item.name}>
   <div className="mlb-injury-heading"><span className="mlb-injury-avatar"><UserRound size={26} aria-hidden="true"/>{item.headshot&&<img src={item.headshot} alt="" width="48" height="48" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span><div><h3>{item.name}</h3><small>{item.position}</small></div><span className="mlb-injury-status" data-day={!out}>{[item.status,item.injury].filter(Boolean).join(' · ')}</span></div>
   {effect&&<div className="wnba-filter-buttons">{[['without','Without'],['with','With']].map(([kind,label])=><button type="button" key={kind} data-kind={kind} disabled={!effect[kind].games} aria-pressed={filters.some(filter=>filter.id===String(item.id)&&filter.kind===kind)} onClick={()=>choose(item,kind)}>{kind==='without'?<UserX size={14} aria-hidden="true"/>:<UserCheck size={14} aria-hidden="true"/>}{label} <small>{effect[kind].games}</small></button>)}</div>}
   {(item.date||item.note)&&<small className="mlb-injury-reported">{item.date?`Reported ${item.date}. `:''}{item.note}</small>}
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
const RANKINGS=[['off','goals'],['off','sog'],['off','ppp'],['off','hits'],['off','fow'],['off','blocked'],
 ['def','goals'],['def','sog'],['def','ppp'],['def','hits'],['def','saves']];
function Rankings({league,row}){
 const data=league.data;
 if(!data)return <Card title="Team rankings" icon={ListOrdered}>{league.loading?<Skeleton/>:<Failed state={league} label="Team rankings"/>}</Card>;
 const labels=Object.fromEntries(data.stats||[]);
 const teams=[row.teamAbbr,opponentOf(row)].filter(abbr=>data.teams?.[abbr]),n=data.teamCount;
 return <Card title="Team rankings" note="Last 20 games · per game" icon={ListOrdered} className="wnba-rankings">
  <div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Stat</th>{teams.map(abbr=><th scope="col" key={abbr}><span className="wnba-team-cell wnba-team-cell-end"><Logo src={nhlLogo(abbr)} size={18}/>{abbr}</span></th>)}</tr></thead><tbody>
   {['off','def'].map(group=><React.Fragment key={group}><tr className="wnba-rank-group"><th scope="rowgroup" colSpan={teams.length+1}>{group==='off'?'Offense':'Defense (allowed)'}</th></tr>
    {RANKINGS.filter(([g])=>g===group).map(([g,key])=><tr key={g+key}><th scope="row">{labels[key]}</th>{teams.map(abbr=>{const [value,rank]=data.teams[abbr][g]?.[key]?.l20||[];return <td key={abbr}><span data-tone={rankTone(rank,n)}>{fmt(value)}</span> <small>{ordinal(rank)}</small></td>;})}</tr>)}</React.Fragment>)}
  </tbody></table></div>
 </Card>;
}

// ---------------------------------------------------------------- Averages
function Averages({row,rows,position,playerRows}){
 const keys=[...new Set([...family(position).support,...family(position).log])].filter(key=>STATS[key]);
 const played=playedGames(rows),opponent=opponentOf(row);
 const apps=useMemo(()=>{const map=new Map();for(const item of playerRows||[])for(const app of item.apps||[]){const list=map.get(item.valueKey)||new Set();list.add(app.key);map.set(item.valueKey,list);}return map;},[playerRows]);
 const year=nhlSeason(),current=`${year}${year+1}`,last=`${year-1}${year}`;
 const regular=played.filter(game=>game.seasonKind==='regular');
 const sections=[
  {key:'season',title:`${seasonLabel(current)} Averages`,icon:Activity,games:regular.filter(game=>game.season===current)},
  {key:'last',title:`${seasonLabel(last)} Averages`,icon:Activity,games:regular.filter(game=>game.season===last)},
  {key:'home',title:'Home Averages',icon:Home,games:regular.filter(game=>game.isHome)},
  {key:'away',title:'Away Averages',icon:Plane,games:regular.filter(game=>game.isHome===false)},
  {key:'vs',title:`vs ${opponent}`,icon:Swords,games:played.filter(game=>game.opponent===opponent)},
 ];
 const first=sections.find(section=>section.games.length)?.key||'season';
 const [open,setOpen]=useState(first);
 useEffect(()=>setOpen(first),[first]);
 return <Card title="Regular season averages" icon={Activity} className="nfl-averages">
  {sections.map(section=>{const isOpen=open===section.key&&section.games.length>0;return <div className="nfl-average-section" key={section.key}>
   <button type="button" className="nfl-average-toggle" aria-expanded={isOpen} disabled={!section.games.length} onClick={()=>setOpen(isOpen?'':section.key)}><section.icon size={14} aria-hidden="true"/><strong>{section.games.length?section.title:`No ${section.title.replace(/ Averages$/,'')} games`}</strong><small>{section.games.length} {section.games.length===1?'game':'games'}</small><ChevronDown size={15} aria-hidden="true"/></button>
   {isOpen&&<div className="nfl-average-cards" tabIndex={0} role="region" aria-label={`${section.title}; scroll for more stats`}>{keys.map(key=>{const value=average(section.games.map(game=>statValue(game,key)));const books=[...(apps.get(key)||[])];
    return <div className="nfl-average-card" key={key} data-current={key===row.valueKey}><span>{STATS[key].short}</span><strong>{fmt(value,2)}</strong><small>{books.length?books.slice(0,3).map(book=><img key={book} src={bookLogo(book)} alt={bookName(book)} width="16" height="16" onError={e=>{e.currentTarget.hidden=true;}}/>):'No lines'}</small></div>;})}</div>}
  </div>;})}
 </Card>;
}

export default function NHLFinderContext({row,playerRows,rows,log,position,filters,onToggleFilter}){
 const [tab,setTab]=useState('matchup');
 const matchup=useNhl('matchup',{game:row.gameId,home:row.homeTeamAbbr,away:row.awayTeamAbbr,start:row.startsAt},Boolean(row.gameId));
 const league=useNhl('league',{},['defense','rankings'].includes(tab));
 return <aside className="mlb-finder-context wnba-finder-context nfl-finder-context nhl-finder-context" data-tab={tab} aria-label="NHL matchup research">
  <nav className="mlb-context-tabs" aria-label="Research sections">{tabs.map(([key,label,Icon])=><button key={key} data-section={key} type="button" aria-pressed={tab===key} onClick={()=>setTab(key)}><Icon size={18} aria-hidden="true"/>{label}</button>)}</nav>
  {tab==='matchup'&&<><CurrentLine row={row} playerRows={playerRows}/><WinPredictor matchup={matchup}/><MatchupOdds matchup={matchup}/><LastFive matchup={matchup}/><Standings matchup={matchup} row={row}/></>}
  {tab==='defense'&&<><DefenseVsPosition league={league} row={row} position={position}/><OffenseVsDefense league={league} row={row}/></>}
  {tab==='similar'&&<SimilarPlayers row={row} position={position}/>}
  {tab==='injuries'&&<Injuries row={row} log={log} filters={filters} onToggleFilter={onToggleFilter}/>}
  {tab==='odds'&&<Odds row={row} playerRows={playerRows}/>}
  {tab==='rankings'&&<Rankings league={league} row={row}/>}
  <Averages row={row} rows={rows} position={position} playerRows={playerRows}/>
 </aside>;
}
