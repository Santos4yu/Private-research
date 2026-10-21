// One NBA player's matchup page, opened from the Props tab's NBA list
// (NbaMatchups.jsx) and closed back to it: a full-width banner with who he
// is and tonight's game (a slim bar takes its place, pinned above the
// sections, once it scrolls away), then Overview (his averages, his games against tonight's line, the
// injury report), Matchup (the grade and everything behind it,
// NbaScout.jsx) and Stats (where he ranks at his position, his game log).
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,CalendarDays,ChevronDown,HeartPulse,LineChart,Minus,Plus,X} from 'lucide-react';
import {Card,LikelyDefenders,Loading,MatchupGrade,Photo,PlayTypes,PositionRanks,ShotLink,ShotZones,VsTeam,teamName} from './sports/wnba/NbaScout';
import {finite,fmt,realGames,useWnba} from './sports/wnba/wnba-research';
import {basketballLogUrl} from './unified-finder-data';

const STAT_CHIPS=[['player_points','PTS'],['player_rebounds','REB'],['player_assists','AST'],['player_threes','3PM'],['player_points_rebounds','P+R'],
 ['player_points_assists','P+A'],['player_rebounds_assists','R+A'],['player_points_rebounds_assists','PRA'],['player_steals','STL'],['player_blocks','BLK']];
const SHORT=Object.fromEntries(STAT_CHIPS);
const POSITION_NAMES={G:'Guard',F:'Forward',C:'Center'};
const AVERAGES=[['min','Minutes'],['player_points','Points'],['player_assists','Assists'],['player_rebounds','Rebounds']];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const valueOf=(game,key)=>key==='min'?(finite(game.minutes)?game.minutes:game.box?.min):game.values?.[key];
const mean=values=>{const kept=values.filter(finite);return kept.length?kept.reduce((sum,value)=>sum+value,0)/kept.length:null;};
const seasonLabel=season=>finite(season)?`${season-1}-${String(season).slice(-2)}`:'';
function when(iso){
 const time=Date.parse(iso||'');if(!Number.isFinite(time))return '';
 const date=new Date(time),today=new Date(),clock=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 return date.toDateString()===today.toDateString()?`Tonight, ${clock}`:`${date.toLocaleDateString([],{weekday:'short'})} ${clock}`;
}

// His games, newest last: the row's own history when the list loaded it, else fetched.
function useGameLog(row){
 const kept=row.history?.rows;
 const [state,setState]=useState(()=>kept?.length?{rows:kept}:{rows:[],loading:true});
 useEffect(()=>{
  if(kept?.length){setState({rows:kept});return undefined;}
  if(!row.playerId){setState({rows:[]});return undefined;}
  const control=new AbortController();setState({rows:[],loading:true});
  fetch(basketballLogUrl(row),{signal:control.signal,credentials:'same-origin'})
   .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Game logs unavailable');setState({rows:data.rows||[]});})
   .catch(error=>{if(error.name!=='AbortError')setState({rows:[],error:true});});
  return()=>control.abort();
 },[row.playerId,kept]);
 return state;
}

// ------------------------------------------------------------ Overview
function Averages({logs}){
 const [span,setSpan]=useState('szn');
 const games=useMemo(()=>realGames(logs),[logs]);
 const season=useMemo(()=>Math.max(...games.map(game=>Number(game.season)).filter(finite)),[games]);
 const seasonGames=games.filter(game=>Number(game.season)===season);
 if(!games.length)return null;
 const picked=span==='szn'?seasonGames:games.slice(-Number(span.slice(1)));
 return <Card title={finite(season)?`${seasonLabel(season)} season`:'Averages'} icon={CalendarDays} className="mp-averages">
  <div className="mp-seg" role="group" aria-label="Games">{[['szn','SZN'],['l15','L15'],['l10','L10'],['l5','L5']].map(([key,label])=>
   <button type="button" key={key} aria-pressed={span===key} onClick={()=>setSpan(key)}>{label}</button>)}</div>
  <div className="mp-avg-grid">{AVERAGES.map(([key,label])=>{const value=mean(picked.map(game=>valueOf(game,key))),usual=mean(seasonGames.map(game=>valueOf(game,key)));
   const change=span!=='szn'&&finite(value)&&usual>0?(value/usual-1)*100:null;
   return <div key={key}><small>{label}</small><b>{fmt(value,1)}</b>{finite(change)?<em data-tone={change>=0?'good':'poor'}>{change>=0?'+':''}{fmt(change,1)}%</em>:<em>per game</em>}</div>;})}</div>
 </Card>;
}

function Trend({row,lines,logs}){
 const offered=useMemo(()=>STAT_CHIPS.filter(([key])=>lines.some(item=>item.marketKey===key)),[lines]);
 const [stat,setStat]=useState(row.marketKey),[span,setSpan]=useState('l10');
 const tonight=lines.find(item=>item.marketKey===stat&&(item.modifier||'standard')==='standard')||lines.find(item=>item.marketKey===stat);
 const [line,setLine]=useState(tonight?.line??null);
 useEffect(()=>setLine(tonight?.line??null),[stat,tonight?.line]);
 const games=useMemo(()=>{
  const all=realGames(logs).filter(game=>finite(game.values?.[stat]));
  return span==='h2h'?all.filter(game=>game.opponent===row.opponent).slice(-10):all.slice(-Number(span.slice(1)));
 },[logs,stat,span,row.opponent]);
 const values=games.map(game=>game.values[stat]);
 const top=Math.max(1,...values,finite(line)?line:0);
 const over=finite(line)?values.filter(value=>value>line).length:null;
 const chips=offered.length?offered:STAT_CHIPS.slice(0,4);
 return <Card title="His games" note={SHORT[stat]||row.market} icon={LineChart} className="mp-trend">
  <div className="mp-chips" role="group" aria-label="Stat">{chips.map(([key,label])=><button type="button" key={key} aria-pressed={stat===key} onClick={()=>setStat(key)}>{label}</button>)}</div>
  <div className="mp-trend-head">
   <div><small>{SHORT[stat]} · {span==='h2h'?`vs ${row.opponent}`:`last ${span.slice(1)}`} · {games.length} {games.length===1?'game':'games'}</small>
    <b data-tone={finite(over)&&games.length?(over*2>=games.length?'good':'poor'):undefined}>{finite(over)&&games.length?`${over}/${games.length}`:'—'}</b>
    {finite(line)&&<span>over {fmt(line,1)}</span>}</div>
   {finite(line)&&<div className="mp-stepper" aria-label="Line"><button type="button" aria-label="Lower the line" onClick={()=>setLine(value=>Math.max(0,value-0.5))}><Minus size={16}/></button>
    <span><small>Line</small><b>{fmt(line,1)}</b></span><button type="button" aria-label="Raise the line" onClick={()=>setLine(value=>value+0.5)}><Plus size={16}/></button></div>}
  </div>
  <div className="mp-seg" role="group" aria-label="Games">{[['l5','L5'],['l10','L10'],['l20','L20'],['h2h','H2H']].map(([key,label])=>
   <button type="button" key={key} aria-pressed={span===key} onClick={()=>setSpan(key)}>{label}</button>)}</div>
  {games.length?<div className="mp-bars" role="img" aria-label={`${SHORT[stat]}: ${values.join(', ')}`}>
   {finite(line)&&<i className="mp-bars-line" style={{bottom:`${line/top*100}%`}}/>}
   {games.map((game,index)=>{const value=game.values[stat];return <span key={game.gameId||index} data-tone={finite(line)?(value>line?'good':'poor'):undefined}>
    <b>{fmt(value,0)}</b><i style={{height:`${Math.max(3,value/top*100)}%`}}/><small>{game.opponent||''}</small></span>;})}
  </div>:<p className="mp-empty">{span==='h2h'?`He hasn't played ${row.opponent} in the games on record.`:'No games on record yet.'}</p>}
 </Card>;
}

const STATUS_TONE=status=>/out/i.test(status||'')?'out':'doubt';
function Injuries({row,league,matchup,player}){
 const data=matchup.data?.injuries;
 if(matchup.loading&&!matchup.data)return <Card title="Injury report" icon={HeartPulse}><Loading/></Card>;
 const teams=[row.teamAbbr,row.opponent].filter(team=>data?.[team]?.length);
 if(!teams.length)return null;
 const impact=Object.fromEntries((player.data?.impact||[]).map(item=>[String(item.id),item]));
 return <Card title="Injury report" note={`His ${SHORT[row.marketKey]||row.market} without them`} icon={HeartPulse} className="mp-injuries">
  {teams.map(team=><div key={team} className="mp-inj-team"><h3>{league.data?.teams?.[team]?.name||team}</h3>
   {data[team].map(item=>{const split=team===row.teamAbbr?impact[String(item.id)]:null,without=split?.without,withHim=split?.with;
    const change=without?.games&&finite(without.avg)&&finite(withHim?.avg)?without.avg-withHim.avg:null;
    return <div className="mp-inj" key={item.id||item.name}><Photo src={item.headshot}/>
     <span className="mp-inj-who"><b>{item.name}</b><small>{[item.position,item.injury||item.detail].filter(Boolean).join(' · ')||'Undisclosed'}</small></span>
     {finite(change)?<span className="mp-inj-split" data-tone={change>=0?'good':'poor'}><b>{change>=0?'+':''}{fmt(change,1)}</b><small>{without.games} games without</small></span>
      :<span className="mp-pill" data-tone={STATUS_TONE(item.status)}>{item.code||item.status||'—'}</span>}</div>;})}</div>)}
  <p className="nd-foot">Green: his average goes up in the games that teammate missed; red: it goes down.</p>
 </Card>;
}

// ------------------------------------------------------------ Stats
const LOG_STATS=[['player_points','PTS'],['player_rebounds','REB'],['player_assists','AST'],['player_threes','3PM'],['player_points_rebounds_assists','PRA']];
function GameLog({logs,league}){
 const [stat,setStat]=useState('player_points'),[open,setOpen]=useState(null);
 const months=useMemo(()=>{
  const groups=new Map();
  for(const game of realGames(logs).reverse()){
   const date=new Date(game.date);if(Number.isNaN(date.getTime()))continue;
   const key=`${date.getFullYear()}-${date.getMonth()}`;
   if(!groups.has(key))groups.set(key,{key,name:`${MONTHS[date.getMonth()]} ${date.getFullYear()}`,games:[]});
   groups.get(key).games.push(game);
  }
  return [...groups.values()];
 },[logs]);
 if(!months.length)return null;
 const shown=open??months[0].key;
 return <Card title="Game log" icon={CalendarDays} className="mp-gamelog">
  <div className="mp-chips" role="group" aria-label="Stat">{LOG_STATS.map(([key,label])=><button type="button" key={key} aria-pressed={stat===key} onClick={()=>setStat(key)}>{label}</button>)}</div>
  {months.map(month=>{const expanded=month.key===shown;return <div className="mp-month" key={month.key} data-open={expanded||undefined}>
   <button type="button" className="mp-month-head" aria-expanded={expanded} onClick={()=>setOpen(expanded?'':month.key)}><b>{month.name}</b><span>{month.games.length} GP<ChevronDown size={16}/></span></button>
   {expanded&&<table className="mp-log"><thead><tr><th scope="col">Date</th><th scope="col">Opp</th><th scope="col">Result</th><th scope="col">Min</th><th scope="col">{SHORT[stat]}</th></tr></thead>
    <tbody>{month.games.map((game,index)=><tr key={game.gameId||index}>
     <td>{new Date(game.date).toLocaleDateString([],{weekday:'short',month:'numeric',day:'numeric'})}</td>
     <td><span className="mp-opp">{game.isHome?'':'@'}{league.data?.teams?.[game.opponent]?.logo?<img src={league.data.teams[game.opponent].logo} alt="" width="20" height="20"/>:null}{game.opponent}</span></td>
     <td><span className="mp-result" data-result={game.result||undefined}>{game.result||''}</span> {game.score||''}</td>
     <td>{fmt(valueOf(game,'min'),0)}</td><td><b>{fmt(game.values?.[stat],0)}</b></td></tr>)}
     <tr className="mp-log-avg"><td colSpan="3">Average</td><td>{fmt(mean(month.games.map(game=>valueOf(game,'min'))),1)}</td><td><b>{fmt(mean(month.games.map(game=>game.values?.[stat])),1)}</b></td></tr></tbody></table>}
  </div>;})}
 </Card>;
}

// ------------------------------------------------------------ The page
const hide=event=>{event.currentTarget.hidden=true;};
// "Shai Gilgeous-Alexander" -> ["Shai", "Gilgeous-Alexander"]: the banner sets the name on two lines.
const nameLines=name=>{const parts=String(name||'').trim().split(/\s+/);return parts.length>1?[parts[0],parts.slice(1).join(' ')]:[parts[0]||'',''];};

function Hero({row,team,opponent,home,onBack,heroRef}){
 const [first,last]=nameLines(row.player),longest=Math.max(first.length,last.length);
 const facts=[row.jersey?`#${row.jersey}`:null,team?.short||row.teamAbbr,POSITION_NAMES[String(row.position||'')[0]]||row.position].filter(Boolean);
 return <header ref={heroRef} className="mp-hero" data-long={longest>=14?'xl':longest>=10?'l':undefined}>
  {team?.logo&&<img className="mp-hero-mark" src={team.logo} alt="" onError={hide}/>}
  {row.headshot&&<img className="mp-hero-photo" src={row.headshot} alt="" onError={hide}/>}
  <button type="button" className="mp-back" onClick={onBack} aria-label="Back to matchups"><ArrowLeft size={20}/></button>
  <div className="mp-hero-text">
   <h1>{first}{last&&<><br/>{last}</>}</h1>
   <p>{facts.map((fact,index)=><React.Fragment key={fact}>{index>0&&<i aria-hidden="true"/>}{fact}</React.Fragment>)}</p>
   <div className="mp-next">{opponent?.logo&&<img src={opponent.logo} alt="" width="34" height="34" onError={hide}/>}
    <span><small>Next matchup</small><b>{home?'vs':'@'} {row.opponent}</b><em>{when(row.startsAt)}</em></span></div>
  </div>
 </header>;
}

const TABS=[['overview','Overview'],['matchup','Matchup'],['stats','Stats']];
export function NbaMatchupPage({row,lines,league,onBack}){
 const [tab,setTab]=useState('overview'),[shots,setShots]=useState(false),[pinned,setPinned]=useState(null);
 const heroRef=useRef(null),slotRef=useRef(null),miniRef=useRef(null);
 const leagueState=useMemo(()=>({data:league,loading:!league}),[league]);
 const log=useGameLog(row);
 const logs=log.rows;
 const player=useWnba('player-context',{playerId:row.playerId,team:row.teamAbbr,opponent:row.opponent,market:row.marketKey,line:row.line,league:'nba'},
  Boolean(row.playerId&&row.teamAbbr&&row.opponent));
 const matchup=useWnba('matchup',{home:row.homeTeamAbbr,away:row.awayTeamAbbr,startsAt:row.startsAt,league:'nba'},Boolean(row.homeTeamAbbr&&row.awayTeamAbbr&&row.startsAt));
 const home=row.teamAbbr&&row.teamAbbr===row.homeTeamAbbr;
 const team=league?.teams?.[row.teamAbbr],opponent=league?.teams?.[row.opponent];
 const color=team?.color?`#${String(team.color).replace('#','')}`:null;
 useEffect(()=>{if(!shots)return undefined;const close=event=>{if(event.key==='Escape')setShots(false);};
  document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[shots]);
 // Once the banner scrolls up under where the slim bar goes, the bar and
 // the section tabs pin to the top of the screen (fixed: the page's body
 // doesn't let sticky elements stick), their slot keeping its height.
 useEffect(()=>{
  const hero=heroRef.current,slot=slotRef.current,bar=miniRef.current;
  if(!hero||!slot||!bar||typeof IntersectionObserver==='undefined')return undefined;
  slot.style.minHeight=`${slot.offsetHeight}px`;
  let out=false;
  const place=()=>{const box=slot.getBoundingClientRect();setPinned(out?{left:box.left,width:box.width}:null);};
  const watch=new IntersectionObserver(([entry])=>{out=!entry.isIntersecting&&entry.boundingClientRect.top<0;place();},{rootMargin:`-${bar.offsetHeight}px 0px 0px 0px`});
  watch.observe(hero);addEventListener('resize',place);
  return()=>{watch.disconnect();removeEventListener('resize',place);};
 },[]);
 // A new section starts at its top, under the pinned bar.
 const pick=key=>{setTab(key);const slot=slotRef.current,bar=miniRef.current;
  if(pinned&&slot&&bar)window.scrollTo(0,window.scrollY+slot.getBoundingClientRect().top-bar.offsetHeight+1);};
 return <section className="nba-mp" aria-label={`${row.player} matchup`} style={color?{'--team':color}:undefined}>
  <Hero row={row} team={team} opponent={opponent} home={home} onBack={onBack} heroRef={heroRef}/>
  <div className="mp-stick-slot" ref={slotRef}><div className="mp-stick" data-mini={pinned?true:undefined} style={pinned?{left:pinned.left,width:pinned.width}:undefined}>
   <div className="mp-mini" ref={miniRef} aria-hidden={!pinned}>
    <button type="button" className="mp-back" onClick={onBack} tabIndex={pinned?0:-1} aria-label="Back to matchups"><ArrowLeft size={18}/></button>
    <Photo src={row.headshot}/><b>{row.player}</b>
    <span className="mp-mini-game">{opponent?.logo&&<img src={opponent.logo} alt="" width="18" height="18" onError={hide}/>}{home?'vs':'@'} {row.opponent}<small>{when(row.startsAt)}</small></span>
   </div>
   <nav className="mp-tabs" role="tablist" aria-label="Sections">{TABS.map(([key,label])=><button type="button" role="tab" key={key} aria-selected={tab===key} onClick={()=>pick(key)}>{label}</button>)}</nav>
  </div></div>
  <div className="mp-body">
   {tab==='overview'&&<>{log.loading&&!logs.length?<Card title="His games" icon={LineChart}><Loading/></Card>:<><Averages logs={logs}/><Trend row={row} lines={lines} logs={logs}/></>}
    <Injuries row={row} league={leagueState} matchup={matchup} player={player}/></>}
   {tab==='matchup'&&<><MatchupGrade row={row} league={leagueState} logs={logs}/><PlayTypes row={row}/>
    <LikelyDefenders row={row}/><ShotLink row={row} league={leagueState} onOpen={()=>setShots(true)}/><VsTeam row={row} league={leagueState} logs={logs} lines={lines}/></>}
   {tab==='stats'&&<><PositionRanks row={row}/><GameLog logs={logs} league={leagueState}/></>}
  </div>
  {shots&&<div className="mp-sheet" role="dialog" aria-modal="true" aria-label="Shot zones" onClick={event=>{if(event.target===event.currentTarget)setShots(false);}}>
   <div className="mp-sheet-panel"><div className="mp-sheet-head"><span><small>Shot zones</small><b>Where he scores vs {teamName(league,row.opponent)}</b></span>
    <button type="button" onClick={()=>setShots(false)} aria-label="Close"><X size={18}/></button></div>
    <ShotZones player={player} league={leagueState} row={row}/></div>
  </div>}
 </section>;
}
