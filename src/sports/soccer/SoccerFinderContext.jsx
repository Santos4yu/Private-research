import React,{useEffect,useMemo,useState} from 'react';
import {Activity,CalendarClock,ChartColumn,HeartPulse,ListOrdered,RefreshCw,Search,Shirt,Trophy,UserCheck,UserRound,Users,UserX} from 'lucide-react';
import {TEAM_GROUPS,average,finite,findPlayer,fmt,longDate,price,shortDate,squad,statKeyOf,statOf,teamAverages,teamLogParams,teammateSplit,useSoccer,valueOf} from './soccer-finder';

// The soccer matchup panel, on the WNBA / MLB panel's layout. Matchup and
// Form read the match's own ESPN summary; Team Comparison and Similar read
// both teams' recent matches (soccer_research.py).
const tabs=[['matchup','Matchup',Trophy],['similar','Similar',Users],['lineups','Lineups',Shirt],['injuries','Injuries',HeartPulse],['form','Form',CalendarClock],['stats','Stats',ChartColumn]];
function Card({title,note,children,icon:Icon=Activity,className=''}){return <section className={'mlb-context-card '+className}><header><h2><Icon size={16} aria-hidden="true"/>{title}</h2>{note&&<small>{note}</small>}</header>{children}</section>;}
function Empty({children}){return <p className="mlb-context-note">{children}</p>;}
function Skeleton(){return <div className="mlb-context-skeleton" role="status" aria-label="Loading research"><span/><span/><span/><span/></div>;}
function Failed({state,label}){return <Empty>{state.error||`${label} is temporarily unavailable.`} <button type="button" onClick={state.retry}><RefreshCw size={13} aria-hidden="true"/> Retry</button></Empty>;}
function Logo({src,size=22}){return src?<img className="wnba-logo" src={src} alt="" width={size} height={size} loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>:null;}
function Switch({label,options,value,onChange}){return <div className="mlb-context-switch" aria-label={label}>{options.map(([key,text])=><button type="button" key={key} aria-pressed={value===key} onClick={()=>onChange(key)}>{text}</button>)}</div>;}

// Both teams as the row sees them: the player's team first.
function sides(row,match){
 const teams=match?.teams||[];
 const find=(id,abbr)=>teams.find(team=>team.id===String(id))||teams.find(team=>team.abbr===abbr)||null;
 return [{id:row.teamId,abbr:row.teamAbbr,name:row.teamName||row.teamAbbr,logo:row.teamLogo,...find(row.teamId,row.teamAbbr)},
  {id:row.opponentId,abbr:row.opponent,name:row.opponentName||row.opponent,logo:row.opponentLogo,...find(row.opponentId,row.opponent)}];
}
const hex=value=>/^[0-9a-f]{6}$/i.test(String(value||''))?'#'+value:null;
function colorOf(team,fallback){
 const light=value=>{const n=parseInt(value.slice(1),16);return 0.2126*((n>>16)&255)/255+0.7152*((n>>8)&255)/255+0.0722*(n&255)/255;};
 for(const color of [hex(team?.color),hex(team?.altColor)])if(color&&light(color)>0.2)return color;
 return fallback;
}

// ---------------------------------------------------------------- Lines
// Every PrizePicks line on this stat for the player, with when PrizePicks
// last moved it.
function when(value){const date=new Date(value||'');return !value||Number.isNaN(date.getTime())?'—':date.toLocaleString([],{month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'});}
function Lines({row,playerRows}){
 const lines=(playerRows||[]).filter(item=>item.marketKey===row.marketKey).sort((a,b)=>a.line-b.line);
 if(!lines.length)return null;
 return <Card title="Lines" note={row.market} icon={ListOrdered} className="soccer-lines-card">
  <div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Line</th><th scope="col">App</th><th scope="col">Updated</th></tr></thead><tbody>
   {lines.map(item=>{const app=(item.apps||[]).find(entry=>entry.key==='prizepicks');return <tr key={item.id} data-current={item.id===row.id}>
    <th scope="row"><span className="soccer-line-value">{item.line}{['goblin','demon'].includes(item.modifier)&&<img src={'/prizepicks/'+item.modifier+'.png'} alt={item.modifier} width="14" height="14"/>}</span></th>
    <td><span className="soccer-line-app"><img src="/prizepicks/logo.png" alt="" width="18" height="18"/>{item.modifier==='standard'?'More / Less':'More only'}</span></td>
    <td>{when(app?.updatedAt)}</td></tr>;})}
  </tbody></table></div>
 </Card>;
}

// ---------------------------------------------------------------- Matchup
function WinPredictor({row,match}){
 const m=match.data,chance=m?.odds?.noVig;
 const [home,away]=m?.teams?.length===2?m.teams:[null,null];
 if(!m)return <section className="mlb-context-card mlb-win-predictor"><header><h2>Win predictor</h2><small>Pregame</small></header>{match.loading?<Skeleton/>:<Failed state={match} label="The match preview"/>}</section>;
 const colors=[colorOf(home,'#28cb98'),'#59606b',colorOf(away,'#7b8cff')];
 if(colors[0]===colors[2])colors[2]='#7b8cff';
 return <section className="mlb-context-card mlb-win-predictor soccer-win"><header><h2>Win predictor</h2><small>{m.odds?.provider?`${m.odds.provider} · no vig`:'Pregame'}</small></header>
  {chance&&home&&away?<div className="mlb-win-body">
   <div className="mlb-win-team"><Logo src={home.logo} size={32}/><strong>{home.abbr}</strong><small>Home</small><b style={{color:colors[0]}}>{fmt(chance.home)}%</b></div>
   <div className="mlb-win-ring" role="img" aria-label={`${home.abbr} ${chance.home}%, draw ${chance.draw}%, ${away.abbr} ${chance.away}%`}
    style={{background:`conic-gradient(${colors[0]} 0% ${chance.home}%, ${colors[1]} ${chance.home}% ${chance.home+(chance.draw||0)}%, ${colors[2]} ${chance.home+(chance.draw||0)}% 100%)`}}><span>DRAW<br/><b>{fmt(chance.draw)}%</b></span></div>
   <div className="mlb-win-team"><Logo src={away.logo} size={32}/><strong>{away.abbr}</strong><small>Away</small><b style={{color:colors[2]}}>{fmt(chance.away)}%</b></div>
  </div>:<Empty>No moneyline is posted for this match yet.</Empty>}
  {m.odds&&home&&away&&<div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Moneyline</th><th scope="col">{home.abbr}</th><th scope="col">Draw</th><th scope="col">{away.abbr}</th></tr></thead>
   <tbody><tr><th scope="row">{m.odds.provider||'Book'}</th><td>{price(m.odds.home)}</td><td>{price(m.odds.draw)}</td><td>{price(m.odds.away)}</td></tr></tbody></table></div>}
  {(m.leagueName||m.venue?.name)&&<Empty>{[m.leagueName,m.venue?.name,m.venue?.city].filter(Boolean).join(' · ')}</Empty>}
 </section>;
}

const WINDOWS=[[5,'L5'],[15,'L15'],[30,'L30']];
function TeamComparison({row,match,own,opponentLog}){
 const [n,setN]=useState(15),[group,setGroup]=useState('attack');
 const [mine,theirs]=sides(row,match.data);
 if((own.loading&&!own.data)||(opponentLog.loading&&!opponentLog.data))return <Card title="Team comparison" icon={ChartColumn}><Skeleton/></Card>;
 if(!own.data&&!opponentLog.data)return <Card title="Team comparison" icon={ChartColumn}><Failed state={own.error?own:opponentLog} label="Team comparison"/></Card>;
 const a=teamAverages(own.data,n,group),b=teamAverages(opponentLog.data,n,group);
 return <Card title="Team comparison" note="Per match averages" icon={ChartColumn} className="soccer-compare">
  <div className="soccer-compare-teams"><span><Logo src={mine.logo} size={26}/><span><strong>{mine.abbr}</strong><small>{a.games} matches</small></span></span>
   <Switch label="Matches" options={WINDOWS.map(([size,label])=>[size,label])} value={n} onChange={setN}/>
   <span><span><strong>{theirs.abbr}</strong><small>{b.games} matches</small></span><Logo src={theirs.logo} size={26}/></span></div>
  <Switch label="Category" options={TEAM_GROUPS.map(([key,label])=>[key,label])} value={group} onChange={setGroup}/>
  <div className="soccer-compare-rows">{a.rows.map((item,index)=>{const left=item.value,right=b.rows[index].value;
   if(!finite(left)&&!finite(right))return null;
   const total=(finite(left)?left:0)+(finite(right)?right:0);
   const share=total?(finite(left)?left:0)/total*100:50;
   const leftBetter=finite(left)&&finite(right)&&left!==right&&(item.lowerIsBetter?left<right:left>right);
   const rightBetter=finite(left)&&finite(right)&&left!==right&&!leftBetter;
   const digits=Math.max(Math.abs(left||0),Math.abs(right||0))>=100?0:1;
   return <div className="soccer-compare-row" key={item.label}>
    <div><b data-better={leftBetter}>{fmt(left,digits)}{finite(left)?item.unit:''}</b><span>{item.label}</span><b data-better={rightBetter}>{fmt(right,digits)}{finite(right)?item.unit:''}</b></div>
    <span className="soccer-compare-bar" role="img" aria-label={`${item.label}: ${mine.abbr} ${fmt(left)}, ${theirs.abbr} ${fmt(right)}`}><i data-tone={leftBetter?'good':rightBetter?'poor':'even'} style={{width:`${share}%`}}/><i data-tone={rightBetter?'good':leftBetter?'poor':'even'} style={{width:`${100-share}%`}}/></span>
   </div>;})}</div>
 </Card>;
}

// ---------------------------------------------------------------- Form
function LastFive({row,match,own,opponentLog}){
 const teams=sides(row,match.data);
 // The match summary's own form when ESPN has it, else the teams' logs.
 const fromLog=log=>(log.data?.games||[]).slice(-5).reverse().map(game=>({id:game.id,date:game.date,atVs:game.isHome?'vs':'@',opponent:game.opponent?.abbr,opponentLogo:game.opponent?.logo,result:game.result,score:game.score}));
 const lists=[match.data?.form?.[teams[0].id]?.length?match.data.form[teams[0].id]:fromLog(own),match.data?.form?.[teams[1].id]?.length?match.data.form[teams[1].id]:fromLog(opponentLog)];
 if(!lists[0].length&&!lists[1].length&&(match.loading||own.loading))return <Card title="Last 5 matches" icon={CalendarClock}><Skeleton/></Card>;
 return <Card title="Last 5 matches" icon={CalendarClock} className="wnba-last-five">
  <div className="wnba-last-five-grid">{teams.map((team,index)=><div key={team.abbr||index}><h3 data-self={index===0}><Logo src={team.logo}/>{team.name}</h3>
   {lists[index].map(game=><div className="wnba-last-five-row" key={game.id||game.date}><span>{shortDate(game.date)}</span><span className="wnba-team-cell">{game.atVs==='@'?'@':'vs'} <Logo src={game.opponentLogo} size={18}/>{game.opponent}</span><b data-result={game.result}>{game.result}</b><span>{game.score}</span></div>)}
   {!lists[index].length&&<Empty>No recent matches.</Empty>}</div>)}</div>
 </Card>;
}
function Standings({row,match}){
 const groups=match.data?.standings||[];
 const [mine,theirs]=sides(row,match.data);
 const involved=new Set([mine.id,theirs.id].filter(Boolean).map(String));
 const home=groups.find(group=>group.entries.some(entry=>involved.has(entry.id)))?.name;
 const [name,setName]=useState(home);
 useEffect(()=>setName(home),[home]);
 if(!groups.length)return null;
 const group=groups.find(item=>item.name===name)||groups[0];
 return <Card title="Standings" note={match.data.leagueName} icon={ListOrdered} className="wnba-standings soccer-standings">
  {groups.length>1&&<div className="mlb-context-switch soccer-group-switch" aria-label="Group">{groups.map(item=><button type="button" key={item.name} aria-pressed={item.name===group.name} onClick={()=>setName(item.name)}>{item.name.replace(/^Group\s+/i,'')}</button>)}</div>}
  <div className="mlb-context-table-wrap"><table><thead><tr><th scope="col">Team</th><th scope="col">P</th><th scope="col">W</th><th scope="col">D</th><th scope="col">L</th><th scope="col">GD</th><th scope="col">PTS</th></tr></thead><tbody>
   {group.entries.map((entry,index)=><tr key={entry.id||entry.name} data-involved={involved.has(entry.id)}><th scope="row"><span className="wnba-team-cell"><em className="wnba-rank" style={entry.zone?{'--zone':entry.zone}:undefined} data-zone={Boolean(entry.zone)} title={entry.zoneName||undefined}>{entry.rank??index+1}</em><Logo src={entry.logo} size={18}/>{entry.name}</span></th>
    <td>{fmt(entry.played,0)}</td><td>{fmt(entry.wins,0)}</td><td>{fmt(entry.draws,0)}</td><td>{fmt(entry.losses,0)}</td><td>{finite(entry.gd)&&entry.gd>0?'+':''}{fmt(entry.gd,0)}</td><td><strong>{fmt(entry.points,0)}</strong></td></tr>)}
  </tbody></table></div>
 </Card>;
}

// ---------------------------------------------------------------- Similar
const GROUPS=[['GK','Goalkeepers'],['DEF','Defenders'],['MID','Midfielders'],['FWD','Forwards']];
function groupOf(pos){
 const p=String(pos||'').toUpperCase();
 if(/^G/.test(p))return 'GK';
 if(/^(D|CB|LB|RB|LWB|RWB|CD|SW)/.test(p))return 'DEF';
 if(/^(M|CM|DM|AM|LM|RM|CDM|CAM)/.test(p))return 'MID';
 if(/^(F|ST|CF|LW|RW|W|S)/.test(p))return 'FWD';
 return null;
}
function ago(value){const date=new Date(value);if(Number.isNaN(date.getTime()))return '';const days=Math.round((Date.now()-date.getTime())/86400000);return days<=0?'Today':days===1?'Yesterday':days<45?`${days} days ago`:`${Math.round(days/30)} months ago`;}
function SimilarPlayers({row,games,opponentLog}){
 const stat=statKeyOf(row.marketKey),mine=groupOf(row.position||games.at(-1)?.pos)||'MID';
 const [position,setPosition]=useState(mine);
 useEffect(()=>setPosition(mine),[mine]);
 if(!opponentLog.data)return <Card title="Similar players" icon={Users}>{opponentLog.loading?<Skeleton/>:<Failed state={opponentLog} label="Similar players"/>}</Card>;
 // Everyone at this position who faced the opponent recently, newest first.
 const entries=(opponentLog.data.games||[]).slice().reverse().flatMap(game=>(game.oppPlayers||[])
  .filter(player=>groupOf(player.pos)===position&&(player.min??0)>=(position==='GK'?60:30)&&finite(valueOf(player,stat)))
  .map(player=>({...player,value:valueOf(player,stat),date:game.date,team:game.opponent?.abbr,teamLogo:game.opponent?.logo,gameId:game.id}))).slice(0,15);
 const over=entries.filter(entry=>entry.value>row.line).length;
 const diff=average(entries.map(entry=>entry.value-row.line));
 const max=Math.max(1,row.line*2,...entries.map(entry=>entry.value));
 const noun=GROUPS.find(([key])=>key===position)[1];
 return <Card title={`Other ${noun.toLowerCase()} vs ${row.opponent}`} note={row.market} icon={Users} className="wnba-similar">
  <div className="wnba-dvp-controls"><Switch label="Position" options={GROUPS.map(([key,label])=>[key,label])} value={position} onChange={setPosition}/>
   {entries.length>0&&<div className="wnba-similar-summary"><span data-tone={over*2>=entries.length?'good':'poor'}>{over}/{entries.length} went over {row.line}</span><span data-tone={diff>0?'good':'poor'}>Avg diff {finite(diff)?(diff>0?'+':'')+diff.toFixed(1):'—'}</span></div>}</div>
  {!stat?<Empty>{row.market} isn't in ESPN's match stats, so there's nothing to compare yet.</Empty>
  :entries.length?<div className="wnba-similar-list">{entries.map(entry=><div className="wnba-similar-row" key={entry.gameId+entry.id}>
   <span className="wnba-avatar"><UserRound size={18} aria-hidden="true"/>{entry.teamLogo&&<img src={entry.teamLogo} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span>
   <span className="wnba-similar-name"><strong>{entry.name}</strong><small>{ago(entry.date)} · {entry.team}</small></span>
   <span className="wnba-similar-min">{fmt(entry.min,0)} mins</span>
   <span className="wnba-similar-result"><b data-tone={entry.value>row.line?'good':'poor'}>{fmt(entry.value,0)}</b><small>line {row.line}</small><span className="wnba-similar-bar" aria-hidden="true"><i data-tone={entry.value>row.line?'good':'poor'} style={{width:`${Math.min(100,entry.value/max*100)}%`}}/><em style={{left:`${row.line/max*100}%`}}/></span></span></div>)}</div>
  :<Empty>No {noun.toLowerCase()} have played against {row.opponent} in its recent matches.</Empty>}
  {entries.length>0&&<div className="soccer-similar-legend"><span><i data-tone="good"/>Went over line</span><span><i data-tone="poor"/>Went under line</span></div>}
 </Card>;
}

// ---------------------------------------------------------------- Lineups
const LINE_ORDER={GK:0,DEF:1,MID:2,FWD:3};
function Lineups({row,match,own,opponentLog}){
 const teams=sides(row,match.data);
 const [side,setSide]=useState(0);
 const announced=teams.map(team=>match.data?.lineups?.[team.id]);
 // Before the teams are announced: who started each side's last match.
 const last=[own,opponentLog].map(log=>{const game=(log.data?.games||[]).at(-1);return game?{formation:null,date:game.date,players:(game.players||[]).map(player=>({...player,place:null}))}:null;});
 const lineup=announced[side]?.players?.some(player=>player.starter)?announced[side]:last[side];
 const official=lineup===announced[side];
 const sorted=list=>list.slice().sort((a,b)=>(LINE_ORDER[groupOf(a.pos)]??4)-(LINE_ORDER[groupOf(b.pos)]??4)||String(a.name).localeCompare(String(b.name)));
 return <Card title="Lineups" note={lineup?official?(lineup.formation||'Confirmed'):`Last match · ${shortDate(lineup.date)}`:''} icon={Shirt} className="soccer-lineups">
  <div className="mlb-context-switch" aria-label="Team">{teams.map((team,index)=><button type="button" key={team.abbr||index} aria-pressed={side===index} onClick={()=>setSide(index)}><Logo src={team.logo} size={18}/>{team.abbr}</button>)}</div>
  {!lineup?(match.loading||own.loading?<Skeleton/>:<Empty>No lineup is available yet.</Empty>):<>
   {!official&&<Empty>The lineup isn't announced yet. Showing who started {teams[side].abbr}'s last match.</Empty>}
   <div className="soccer-lineup-list">{[['Starting XI',sorted(lineup.players.filter(player=>player.starter))],['Bench',sorted(lineup.players.filter(player=>!player.starter))]].map(([title,list])=>list.length>0&&<div key={title}><h3>{title}</h3>
    {list.map(player=><div className="soccer-lineup-row" key={player.id||player.name} data-self={player.name===row.player}><span className="soccer-jersey">{player.jersey||'—'}</span><strong>{player.name}</strong><small>{player.pos}</small>{finite(player.min)&&!official&&<small>{player.min}'</small>}</div>)}</div>)}</div>
  </>}
 </Card>;
}

// ---------------------------------------------------------------- Injuries
// ESPN's injury report for both sides, and any player on either squad by
// search. For the player's own teammates, Without / With narrow the chart to
// the matches that teammate missed or played; Stats opens his last matches.
const STATUS_TEXT={'Day-To-Day':'GTD',Questionable:'GTD',Doubtful:'Doubt',Out:'Out',Suspension:'Susp',Suspended:'Susp'};
function statusLabel(item){if(!item)return null;const code=item.code||STATUS_TEXT[item.status]||item.status;return [code,item.injury].filter(Boolean).join(' · ')||null;}
function MiniLog({log,name,keeper}){
 const games=(log?.games||[]).map(game=>({game,line:findPlayer(game.players||[],name)})).filter(item=>item.line).slice(-5).reverse();
 const cols=keeper?[['saves','SV'],['gc','GA'],['sotf','SOTF']]:[['goals','G'],['ast','A'],['shots','SH'],['sot','SOT'],['fouls','F']];
 if(!games.length)return <Empty>No recent matches logged for {name}.</Empty>;
 return <div className="mlb-context-table-wrap soccer-mini-log"><table><thead><tr><th scope="col">Date</th><th scope="col">Opp</th><th scope="col">Min</th>{cols.map(([key,label])=><th scope="col" key={key}>{label}</th>)}</tr></thead><tbody>
  {games.map(({game,line})=><tr key={game.id}><th scope="row">{shortDate(game.date)}</th><td>{game.isHome?'':'@'}{game.opponent?.abbr}</td><td>{fmt(line.min,0)}</td>{cols.map(([key])=><td key={key}>{fmt(valueOf(line,key),0)}</td>)}</tr>)}
 </tbody></table></div>;
}
function PlayerCard({player,status,log,own,row,split,filters,onToggleFilter}){
 const [open,setOpen]=useState(false);
 const self=player.name===row.player;
 const pressed=kind=>filters.some(filter=>filter.id===String(player.id||player.name)&&filter.kind===kind);
 const choose=kind=>onToggleFilter({id:String(player.id||player.name),kind,name:player.name,pos:player.pos||'',ids:split[kind]});
 return <article className="mlb-injury-card soccer-player-card">
  <div className="mlb-injury-heading"><span className="mlb-injury-avatar"><UserRound size={22} aria-hidden="true"/>{player.headshot&&<img src={player.headshot} alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span>
   <div className="soccer-card-name"><h3>{player.name}</h3>{player.pos&&<small>{player.pos}</small>}</div>
   {statusLabel(status)&&<span className="soccer-status" data-out={String(status.status).toLowerCase()==='out'}>{statusLabel(status)}</span>}</div>
  {status?.comment&&<p className="mlb-injury-reason">{status.comment}</p>}
  <div className="wnba-filter-buttons">
   {own&&!self&&[['without',UserX,'Without'],['with',UserCheck,'With']].map(([kind,Icon,label])=><button type="button" key={kind} data-kind={kind} aria-pressed={pressed(kind)} disabled={!split?.[kind]?.length} onClick={()=>choose(kind)}
    title={`${row.player}'s matches ${kind} ${player.name}`}><Icon size={14} aria-hidden="true"/>{label} <small>{split?.[kind]?.length||0}</small></button>)}
   <button type="button" aria-expanded={open} onClick={()=>setOpen(value=>!value)}><ChartColumn size={14} aria-hidden="true"/>Stats</button>
  </div>
  {open&&<MiniLog log={log} name={player.name} keeper={/^G/i.test(player.pos||'')}/>}
 </article>;
}
function Injuries({row,match,own,opponentLog,teamGames,filters,onToggleFilter}){
 const teams=sides(row,match.data);
 const [side,setSide]=useState(0),[query,setQuery]=useState('');
 useEffect(()=>{setSide(0);setQuery('');},[row.player]);
 const log=side===0?own:opponentLog,team=teams[side];
 const listed=match.data?.injuries?.[team.id]||[];
 const members=useMemo(()=>squad(log.data),[log.data]);
 const found=query.trim().length>1?members.filter(player=>player.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0,8):[];
 const split=player=>side===0?teammateSplit(own.data,teamGames,player):null;
 return <Card title="Injuries" note={team.abbr} icon={HeartPulse} className="soccer-injuries">
  <div className="mlb-context-switch" aria-label="Team">{teams.map((item,index)=><button type="button" key={item.abbr||index} aria-pressed={side===index} onClick={()=>setSide(index)}><Logo src={item.logo} size={18}/>{item.abbr}</button>)}</div>
  <div className="soccer-injury-legend"><span><b data-kind="without"><UserX size={13} aria-hidden="true"/>Without</b>Matches he missed</span><span><b data-kind="with"><UserCheck size={13} aria-hidden="true"/>With</b>Matches he played</span><span><b><ChartColumn size={13} aria-hidden="true"/>Stats</b>His last matches</span></div>
  {match.loading&&!match.data?<Skeleton/>:listed.length?<div className="mlb-injury-list">{listed.map(item=><PlayerCard key={item.id||item.name} player={item} status={item} log={log.data} own={side===0} row={row} split={split(item)} filters={filters} onToggleFilter={onToggleFilter}/>)}</div>
  :<Empty>No injuries reported for {team.name||team.abbr}.</Empty>}
  <label className="finder-multi-search soccer-player-search"><Search size={15} aria-hidden="true"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search any player…" aria-label={`Search ${team.abbr} players`}/></label>
  {found.length>0&&<div className="mlb-injury-list">{found.map(player=><PlayerCard key={player.id||player.name} player={player} status={listed.find(item=>item.name===player.name)} log={log.data} own={side===0} row={row} split={split(player)} filters={filters} onToggleFilter={onToggleFilter}/>)}</div>}
  {query.trim().length>1&&!found.length&&<Empty>{log.loading?'Loading the squad…':`No ${team.abbr} player matches “${query.trim()}”.`}</Empty>}
 </Card>;
}

// ---------------------------------------------------------------- Stats
function HeadToHead({row,match}){
 const games=match.data?.h2h||[];
 if(!games.length)return <Card title="Head to head" icon={Trophy}>{match.loading?<Skeleton/>:<Empty>These teams haven't met recently.</Empty>}</Card>;
 return <Card title="Head to head" note={`${row.teamAbbr} results`} icon={Trophy} className="wnba-last-five soccer-h2h">
  {games.map(game=><div className="wnba-last-five-row" key={game.id||game.date}><span>{longDate(game.date)}</span><span className="wnba-team-cell">{game.atVs==='@'?'@':'vs'} <Logo src={game.opponentLogo} size={18}/>{game.opponent}<small>{game.league}</small></span><b data-result={game.result}>{game.result}</b><span>{game.score}</span></div>)}
 </Card>;
}
function Averages({row,games}){
 const stat=statKeyOf(row.marketKey);
 const values=list=>list.map(game=>valueOf(game,stat));
 const metrics=[['Last 5',average(values(games.slice(-5)))],['Last 10',average(values(games.slice(-10)))],['Home',average(values(games.filter(game=>game.isHome===true)))],
  ['Away',average(values(games.filter(game=>game.isHome===false)))],[`vs ${row.opponent||'OPP'}`,average(values(games.filter(game=>game.opponent===row.opponent)))]];
 const max=Math.max(1,...metrics.map(([,value])=>value||0),row.line||0);
 const others=['goals','ast','shots','sot','fd','fouls','saves','gc','sotf'].filter(key=>games.some(game=>finite(valueOf(game,key))));
 return <Card title="Averages" note={`${games.length} matches`} icon={Activity} className="wnba-averages">
  <div className="mlb-average-grid">{metrics.map(([label,value])=><div key={label}><span>{label}</span><strong data-tone={finite(value)?(value>row.line?'good':value<row.line?'poor':'fair'):undefined}>{fmt(value,2)}</strong><div className="mlb-average-track" aria-hidden="true"><i style={{width:finite(value)?`${value/max*100}%`:'0%'}}/></div></div>)}</div>
  {others.length>0&&<div className="wnba-season-grid">{others.map(key=><div key={key} data-current={key===stat}><span>{statOf(key)?.code||key}</span><strong>{fmt(average(games.map(game=>valueOf(game,key))),2)}</strong></div>)}</div>}
 </Card>;
}

export default function SoccerFinderContext({row,games,teamGames,log,playerRows,filters=[],onToggleFilter}){
 const [tab,setTab]=useState('matchup');
 const matched=Boolean(row.eventId);
 const match=useSoccer('match',{league:row.competition,event:row.eventId},matched);
 const opponentLog=useSoccer('log',teamLogParams(row,row.opponentId),Boolean(matched&&row.opponentId));
 const stat=useMemo(()=>statKeyOf(row.marketKey),[row.marketKey]);
 return <aside className="mlb-finder-context wnba-finder-context soccer-finder-context" data-tab={tab} aria-label="Soccer matchup research">
  <Lines row={row} playerRows={playerRows}/>
  <nav className="mlb-context-tabs" aria-label="Research sections">{tabs.map(([key,label,Icon])=><button key={key} data-section={key} type="button" aria-pressed={tab===key} onClick={()=>setTab(key)}><Icon size={18} aria-hidden="true"/>{label}</button>)}</nav>
  {tab==='matchup'&&<><WinPredictor row={row} match={match}/><TeamComparison row={row} match={match} own={log} opponentLog={opponentLog}/></>}
  {tab==='similar'&&<SimilarPlayers row={row} games={games} opponentLog={opponentLog}/>}
  {tab==='lineups'&&<Lineups row={row} match={match} own={log} opponentLog={opponentLog}/>}
  {tab==='injuries'&&<Injuries row={row} match={match} own={log} opponentLog={opponentLog} teamGames={teamGames} filters={filters} onToggleFilter={onToggleFilter}/>}
  {tab==='form'&&<><LastFive row={row} match={match} own={log} opponentLog={opponentLog}/><Standings row={row} match={match}/></>}
  {tab==='stats'&&<HeadToHead row={row} match={match}/>}
  {stat&&<Averages row={row} games={games}/>}
 </aside>;
}
