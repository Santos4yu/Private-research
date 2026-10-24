// One NBA player's matchup page, opened from the Props tab's NBA list
// (NbaMatchups.jsx) and closed back to it: a full-width banner with who he
// is and tonight's game (a slim bar takes its place, pinned above the
// sections, once it scrolls away), then Overview (his averages, his games against tonight's line, the
// injury report), Matchup (the grade and everything behind it,
// NbaScout.jsx) and Stats (where he ranks at his position, his game log).
import React,{useEffect,useMemo,useState} from 'react';
import {CalendarDays,ChevronDown,HeartPulse,LineChart,X} from 'lucide-react';
import {MatchupPageShell,Trend} from './MatchupPageShell';
import {Card,LikelyDefenders,Loading,MatchupGrade,Photo,PlayTypes,PositionRanks,ShotLink,ShotZones,VsTeam,teamName} from './sports/wnba/NbaScout';
import {finite,fmt,realGames,useWnba} from './sports/wnba/wnba-research';
import {basketballLogUrl} from './unified-finder-data';
import {lineupRole} from './lineup-role';

const STAT_CHIPS=[['player_points','PTS'],['player_rebounds','REB'],['player_assists','AST'],['player_threes','3PM'],['player_points_rebounds','P+R'],
 ['player_points_assists','P+A'],['player_rebounds_assists','R+A'],['player_points_rebounds_assists','PRA'],['player_steals','STL'],['player_blocks','BLK']];
const SHORT=Object.fromEntries(STAT_CHIPS);
const POSITION_NAMES={G:'Guard',F:'Forward',C:'Center'};
const AVERAGES=[['min','Minutes'],['player_points','Points'],['player_assists','Assists'],['player_rebounds','Rebounds']];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const valueOf=(game,key)=>key==='min'?(finite(game.minutes)?game.minutes:game.box?.min):game.values?.[key];
const mean=values=>{const kept=values.filter(finite);return kept.length?kept.reduce((sum,value)=>sum+value,0)/kept.length:null;};
const seasonLabel=season=>finite(season)?`${season-1}-${String(season).slice(-2)}`:'';
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

const TABS=[['overview','Overview'],['matchup','Matchup'],['stats','Stats']];
export function NbaMatchupPage({row,lines,league,onBack}){
 const [tab,setTab]=useState('overview'),[shots,setShots]=useState(false);
 const leagueState=useMemo(()=>({data:league,loading:!league}),[league]);
 const log=useGameLog(row);
 const logs=log.rows;
 const player=useWnba('player-context',{playerId:row.playerId,team:row.teamAbbr,opponent:row.opponent,market:row.marketKey,line:row.line,league:'nba'},
  Boolean(row.playerId&&row.teamAbbr&&row.opponent));
 const matchup=useWnba('matchup',{home:row.homeTeamAbbr,away:row.awayTeamAbbr,startsAt:row.startsAt,league:'nba'},Boolean(row.homeTeamAbbr&&row.awayTeamAbbr&&row.startsAt));
 const home=row.teamAbbr&&row.teamAbbr===row.homeTeamAbbr;
 const team=league?.teams?.[row.teamAbbr],opponent=league?.teams?.[row.opponent];
 const color=team?.color?`#${String(team.color).replace('#','')}`:null;
 // Starter or Bench (lineup-role.js): who started his team's last game.
 const role=lineupRole(row,league);
 const facts=[row.jersey?`#${row.jersey}`:null,team?.short||row.teamAbbr,POSITION_NAMES[String(row.position||'')[0]]||row.position,role?.label].filter(Boolean);
 useEffect(()=>{if(!shots)return undefined;const close=event=>{if(event.key==='Escape')setShots(false);};
  document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[shots]);
 const sheet=shots&&<div className="mp-sheet" role="dialog" aria-modal="true" aria-label="Shot zones" onClick={event=>{if(event.target===event.currentTarget)setShots(false);}}>
  <div className="mp-sheet-panel"><div className="mp-sheet-head"><span><small>Shot zones</small><b>Where he scores vs {teamName(league,row.opponent)}</b></span>
   <button type="button" onClick={()=>setShots(false)} aria-label="Close"><X size={18}/></button></div>
   <ShotZones player={player} league={leagueState} row={row}/></div>
 </div>;
 return <MatchupPageShell row={row} team={team} opponent={opponent} home={home} facts={facts} color={color} onBack={onBack} tabs={TABS} tab={tab} onTab={setTab} after={sheet}>
  {/* Two columns side by side on a wide screen, one after the other on a phone. */}
  {tab==='overview'&&<div className="mp-cols">
   <div className="mp-col">{log.loading&&!logs.length?<Card title="His games" icon={LineChart}><Loading/></Card>:<><Averages logs={logs}/><Trend row={row} lines={lines} logs={logs} chips={STAT_CHIPS}/></>}</div>
   <div className="mp-col"><Injuries row={row} league={leagueState} matchup={matchup} player={player}/></div></div>}
  {tab==='matchup'&&<div className="mp-cols">
   <div className="mp-col"><MatchupGrade row={row} league={leagueState} logs={logs}/></div>
   <div className="mp-col"><PlayTypes row={row}/><LikelyDefenders row={row} league={leagueState} matchup={matchup}/>
    <ShotLink row={row} league={leagueState} onOpen={()=>setShots(true)}/><VsTeam row={row} league={leagueState} logs={logs} lines={lines}/></div></div>}
  {tab==='stats'&&<div className="mp-cols" data-wide="right">
   <div className="mp-col"><PositionRanks row={row}/></div>
   <div className="mp-col"><GameLog logs={logs} league={leagueState}/></div></div>}
 </MatchupPageShell>;
}
