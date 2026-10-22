// One NFL player's matchup page, opened from the Props tab's NFL list
// (NflMatchups.jsx) and closed back to it, in the same frame as the NBA
// page (MatchupPageShell.jsx): Overview (his last-10 averages against the
// season, his games against the line, the injury report), Matchup (the
// grade in each of his position's stats, what the defense allows his
// position, his games against them, their defense's injuries) and Stats
// (his game log, each opponent's rank against his position beside it).
// His games come from /api/nfl?resource=finder-log (nflverse), the
// injuries from finder-team, the league numbers from the list.
import React,{useMemo,useState} from 'react';
import {CalendarDays,HeartPulse,History,LineChart,ListOrdered,Shield,Target} from 'lucide-react';
import {Card,Loading} from './sports/wnba/NbaScout';
import {finite,fmt} from './sports/wnba/wnba-research';
import {nflSeason,teamColor,useNfl} from './sports/nfl/nfl-finder';
import {MatchupPageShell,Trend} from './MatchupPageShell';
import {band,cardScores,positionOf} from './nfl-matchup-score';

// The stats a line can be in, as the list and the chart name them.
export const NFL_STATS=[['all','All'],['receiving_yards','REC YDS'],['rushing_yards','RUSH YDS'],['passing_yards','PASS YDS'],['receptions','REC'],
 ['touchdowns','TD'],['passing_touchdowns','PASS TD'],['rush_attempts','RUSH ATT'],['rushing_receiving_yards','R+R YDS'],['pass_completions','CMP'],
 ['passing_attempts','PASS ATT'],['passing_rushing_yards','P+R YDS'],['targets','TGT'],['rushing_tds','RUSH TD'],['receiving_tds','REC TD']];
const CHIPS=NFL_STATS.slice(1);
const POSITION_NAMES={QB:'Quarterback',RB:'Running back',WR:'Wide receiver',TE:'Tight end'};
const GROUPS={QB:'quarterbacks',RB:'running backs',WR:'receivers',TE:'tight ends'};
const TABS=[['overview','Overview'],['matchup','Matchup'],['stats','Stats']];
const mean=values=>{const kept=values.filter(finite);return kept.length?kept.reduce((sum,value)=>sum+value,0)/kept.length:null;};
const ordinal=n=>`${n}${n%100>=11&&n%100<=13?'th':['th','st','nd','rd'][n%10]||'th'}`;
// Rank 1 allows the least: "3rd most" / "5th fewest".
const place=(rank,count)=>!finite(rank)||!count?'—':rank>count/2?`${ordinal(count-rank+1)} most`:`${ordinal(rank)} fewest`;
const toneOf=(rank,count)=>!finite(rank)||!count?undefined:rank>count*2/3?'soft':rank<=count/3?'tough':undefined;
const played=logs=>(logs||[]).filter(game=>!game.dnp&&game.seasonKind!=='preseason');

// ------------------------------------------------------------ Overview
const AVERAGES={QB:[['passing_yards','Pass yds'],['passing_touchdowns','Pass TD'],['pass_completions','Completions'],['rushing_yards','Rush yds']],
 RB:[['rushing_yards','Rush yds'],['rush_attempts','Rush att'],['receiving_yards','Rec yds'],['touchdowns','TD']],
 WR:[['receiving_yards','Rec yds'],['receptions','Receptions'],['targets','Targets'],['touchdowns','TD']]};
AVERAGES.TE=AVERAGES.WR;

function Averages({logs,group}){
 const games=played(logs);
 if(!games.length)return null;
 const season=Math.max(...games.map(game=>Number(game.season)).filter(finite));
 const last=games.slice(-10),current=games.filter(game=>Number(game.season)===season);
 return <Card title={`Last ${last.length} games`} note="change vs this season" icon={CalendarDays} className="mp-averages">
  <div className="mp-avg-grid">{(AVERAGES[group]||AVERAGES.WR).map(([key,label])=>{
   const value=mean(last.map(game=>game.values?.[key])),usual=mean(current.map(game=>game.values?.[key]));
   const change=finite(value)&&usual>0?(value/usual-1)*100:null;
   return <div key={key}><small>{label}</small><b>{fmt(value,1)}</b>{finite(change)&&Math.abs(change)>=0.05?<em data-tone={change>=0?'good':'poor'}>{change>=0?'+':''}{fmt(change,1)}%</em>:<em>a game</em>}</div>;})}</div>
 </Card>;
}

const STATUS_TONE=status=>/^(out|ir|pup|nfi)$/i.test(status||'')?'out':'doubt';
function InjuryList({items}){
 return items.map(item=><div className="mp-inj nf-inj" key={item.id||item.name}>
  <span className="mp-inj-who"><b>{item.name}</b><small>{[item.position,item.injury].filter(Boolean).join(' · ')||'Undisclosed'}</small></span>
  <span className="mp-pill" data-tone={STATUS_TONE(item.status)}>{item.status}</span></div>);
}
function Injuries({row,season,league}){
 const own=useNfl('team',{season,team:row.teamAbbr},Boolean(row.teamAbbr));
 const theirs=useNfl('team',{season,team:row.opponent},Boolean(row.opponent));
 if((own.loading&&!own.data)||(theirs.loading&&!theirs.data))return <Card title="Injury report" icon={HeartPulse}><Loading/></Card>;
 const mine=(own.data?.injuries||[]).find(item=>item.id===row.playerId||item.name===row.player);
 const sides=[[row.teamAbbr,own.data],[row.opponent,theirs.data]].filter(([,data])=>data?.injuries?.length);
 return <Card title="Injury report" note={own.data?.injuryWeek?`Week ${own.data.injuryWeek}`:null} icon={HeartPulse} className="mp-injuries">
  <p className="nf-status" data-tone={mine?STATUS_TONE(mine.status):'good'}><i aria-hidden="true"/>{row.player}: {mine?`${mine.status}${mine.injury?` (${mine.injury})`:''}`:'not on the injury report'}</p>
  {sides.map(([team,data])=><div className="mp-inj-team" key={team}><h3>{league?.teams?.[team]?.name||team}</h3><InjuryList items={data.injuries}/></div>)}
  {!sides.length&&<p className="mp-empty">Neither team has anyone on this week’s report.</p>}
 </Card>;
}

// ------------------------------------------------------------ Matchup
function Grade({row,league,group,picked,onPick}){
 const scores=useMemo(()=>league.data?cardScores(row,league.data,group):[],[row,league.data,group]);
 if(league.loading&&!league.data)return <Card title="Matchup grade" icon={Target}><Loading/></Card>;
 const mine=scores.find(item=>item.marketKey===row.marketKey);
 const chosen=scores.find(item=>item.marketKey===picked&&item.score!=null)||(mine?.score!=null?mine:null)||scores.find(item=>item.score!=null);
 if(!chosen)return <Card title="Matchup grade" icon={Target}><p className="mp-empty">{row.opponent}’s numbers against {GROUPS[group]} aren’t in yet.</p></Card>;
 const clampTo=value=>Math.min(98,Math.max(2,value));
 return <section className="mp-card nba-grade" aria-label="Matchup grade">
  <header><h2>{chosen.stat} matchup <i aria-hidden="true"/> vs {row.opponent}</h2></header>
  <div className="mp-card-body">
   <div className="ng-head">
    <div className="ng-verdict"><b data-tone={chosen.tone}>{chosen.label}</b><span>Against {row.opponent}’s defense, as a {POSITION_NAMES[group].toLowerCase()}</span></div>
    <div className="ng-score"><b>{chosen.score}</b><small>/100</small></div>
   </div>
   <div className="ng-gauge" role="img" aria-label={`${chosen.score} out of 100, ${chosen.label}`}><i style={{left:`${clampTo(chosen.score)}%`}}/></div>
   <div className="ng-gauge-ends" aria-hidden="true"><span>Tough</span><span>Soft</span></div>
   <div className="ng-tiles" role="group" aria-label="Stat" style={{gridTemplateColumns:`repeat(${scores.length},minmax(0,1fr))`}}>{scores.map(item=>
    <button type="button" key={item.marketKey} data-tone={item.tone} aria-pressed={item.marketKey===chosen.marketKey} disabled={item.score==null}
     onClick={()=>onPick(item.marketKey)} aria-label={`${item.stat} ${item.score??'no score'}${item.label?`, ${item.label}`:''}`}><span>{item.stat}</span><b>{item.score??'—'}</b></button>)}</div>
   <p className="nd-foot">0-100 for the over, 50 an even matchup. Mostly what {row.opponent} allows {GROUPS[group]} in the stat, against the league’s average, with a little of what it allows every offense. 100: far softer than most defenses.</p>
   {chosen.reads?.length>0&&<ul className="nf-reads">{chosen.reads.map(read=><li key={read.key} data-tone={read.points>=1?'soft':read.points<=-1?'tough':undefined}>
    <span>{read.text}</span><b>{read.points>0?'+':read.points<0?'−':''}{fmt(Math.abs(read.points),0)}</b></li>)}</ul>}
  </div>
 </section>;
}

// What the defense allows his position, a game: the season and its last five.
const DVP_ROWS={QB:[['passing_yards','Pass yards'],['passing_tds','Pass TDs'],['completions','Completions'],['attempts','Pass attempts'],['rushing_yards','Rush yards']],
 RB:[['rushing_yards','Rush yards'],['carries','Carries'],['rush_rec_tds','Touchdowns'],['receptions','Receptions'],['receiving_yards','Rec yards'],['targets','Targets']],
 WR:[['receiving_yards','Rec yards'],['receptions','Receptions'],['targets','Targets'],['rush_rec_tds','Touchdowns']]};
DVP_ROWS.TE=DVP_ROWS.WR;
const PICKED={passing_yards:'passing_yards',passing_touchdowns:'passing_tds',pass_completions:'completions',passing_attempts:'attempts',
 rushing_yards:'rushing_yards',rush_attempts:'carries',receptions:'receptions',receiving_yards:'receiving_yards',targets:'targets',touchdowns:'rush_rec_tds'};
const TEAM_ROWS=[['passing_yards','Pass yards'],['rushing_yards','Rush yards'],['rush_rec_tds','Touchdowns']];

function TheirDefense({row,league,group,picked}){
 const table=league.data?.dvp||{},count=Object.keys(table).length;
 const cells=table[row.opponent]?.[group]?.stats;
 if(!cells)return null;
 const team=league.data?.teamStats?.[row.opponent]?.def||{},teams=Object.keys(league.data?.teamStats||{}).length;
 const focus=PICKED[picked||row.marketKey];
 return <Card title={`${row.opponent} defense vs ${GROUPS[group]}`} note={`a game · of ${count}`} icon={Shield} className="nf-defense">
  <table className="nf-dvp"><thead><tr><th scope="col">Allowed</th><th scope="col">Season</th><th scope="col">Last 5</th></tr></thead>
   <tbody>{(DVP_ROWS[group]||DVP_ROWS.WR).map(([key,label])=>{const szn=cells[key]?.szn,l5=cells[key]?.l5;if(!szn)return null;
    return <tr key={key} data-picked={key===focus||undefined}><th scope="row">{label}</th>
     <td data-tone={toneOf(szn[1],count)}><b>{fmt(szn[0],1)}</b><small>{place(szn[1],count)}</small></td>
     <td data-tone={l5?toneOf(l5[1],count):undefined}>{l5?<><b>{fmt(l5[0],1)}</b><small>{place(l5[1],count)}</small></>:'—'}</td></tr>;})}</tbody></table>
  {TEAM_ROWS.some(([key])=>team[key])&&<><div className="ns-sub-head"><b>Every offense</b><span>What {row.opponent} allows a game, all positions</span></div>
   <div className="ns-base">{TEAM_ROWS.filter(([key])=>team[key]).map(([key,label])=><div key={key} data-tone={toneOf(team[key][1],teams)}>
    <small>{label}</small><b>{fmt(team[key][0],1)}</b><em>{place(team[key][1],teams)}</em></div>)}</div></>}
  <p className="nd-foot">Green: among the most the league allows (good for the over). Red: among the fewest. Each game counts every {GROUPS[group].replace(/s$/,'')} who played against them, added up.</p>
 </Card>;
}

function VsThem({row,logs,lines}){
 const games=played(logs).filter(game=>game.opponent===row.opponent).slice(-6).reverse();
 const line=lines.find(item=>item.marketKey===row.marketKey)?.line??row.line;
 if(!games.length)return <Card title={`vs ${row.opponent}`} icon={History}><p className="mp-empty">He hasn’t played {row.opponent} in the games on record.</p></Card>;
 const label=CHIPS.find(([key])=>key===row.marketKey)?.[1]||row.market;
 const over=games.filter(game=>finite(game.values?.[row.marketKey])&&game.values[row.marketKey]>line).length;
 return <Card title={`vs ${row.opponent}`} note={`last ${games.length} ${games.length===1?'meeting':'meetings'}`} icon={History} className="nf-vs">
  <p className="nv-summary"><b>{over} of {games.length}</b> over {fmt(line,1)} {label.toLowerCase()} against them.</p>
  <ul className="nf-vs-list">{games.map(game=>{const value=game.values?.[row.marketKey];return <li key={game.gameId}>
   <span><b>{game.season} · Week {game.week}</b><small>{game.isHome?'vs':'@'} {game.opponent}{game.result?` · ${game.result} ${game.score}`:''}</small></span>
   <b data-tone={finite(value)?(value>line?'good':'poor'):undefined}>{fmt(value,0)}</b></li>;})}</ul>
 </Card>;
}

const DEFENSE=/^(DL|DE|DT|NT|LB|ILB|OLB|MLB|CB|S|FS|SS|DB|SAF|EDGE)$/i;
function TheirInjuries({row,season,league}){
 const theirs=useNfl('team',{season,team:row.opponent},Boolean(row.opponent));
 const items=(theirs.data?.injuries||[]).filter(item=>DEFENSE.test(item.position||''));
 if(theirs.loading&&!theirs.data)return <Card title={`${row.opponent} defense this week`} icon={HeartPulse}><Loading/></Card>;
 if(!items.length)return null;
 return <Card title={`${league?.teams?.[row.opponent]?.name||row.opponent} defense`} note={`${items.length} on the report`} icon={HeartPulse} className="mp-injuries">
  <InjuryList items={items}/></Card>;
}

// ------------------------------------------------------------ Stats
const LOG_COLUMNS={QB:[['CMP/ATT',game=>finite(game.values?.pass_completions)?`${game.values.pass_completions}/${game.values.passing_attempts??'—'}`:'—'],
  ['PASS YDS','passing_yards'],['PASS TD','passing_touchdowns'],['INT','interceptions'],['RUSH YDS','rushing_yards']],
 RB:[['CAR','rush_attempts'],['RUSH YDS','rushing_yards'],['YPC',game=>fmt(game.values?.yards_per_carry,1)],['RUSH TD','rushing_tds'],['TGT','targets'],['REC','receptions'],['REC YDS','receiving_yards']],
 WR:[['TGT','targets'],['REC','receptions'],['REC YDS','receiving_yards'],['TD','touchdowns'],['RUSH YDS','rushing_yards']]};
LOG_COLUMNS.TE=LOG_COLUMNS.WR;
const MAIN={QB:'passing_yards',RB:'rushing_yards',WR:'receiving_yards',TE:'receiving_yards'};
const MAIN_WORDS={QB:'passing yards',RB:'rushing yards',WR:'receiving yards',TE:'receiving yards'};
const cellOf=(game,read)=>typeof read==='function'?read(game):fmt(game.values?.[read],0);

function GameLog({logs,league,group}){
 const seasons=useMemo(()=>[...new Set((logs||[]).filter(game=>game.seasonKind!=='preseason').map(game=>Number(game.season)).filter(finite))].sort((a,b)=>b-a),[logs]);
 const [season,setSeason]=useState(null);
 const shown=season??seasons[0];
 if(!seasons.length)return null;
 const games=(logs||[]).filter(game=>game.seasonKind!=='preseason'&&Number(game.season)===shown);
 const columns=LOG_COLUMNS[group]||LOG_COLUMNS.WR,table=league.data?.dvp||{},count=Object.keys(table).length;
 const totals=columns.map(([,read])=>typeof read==='string'?played(games).reduce((sum,game)=>sum+(game.values?.[read]||0),0):null);
 return <Card title={`${shown} game log`} note={games.length?`${played(games).length} games`:null} icon={ListOrdered} className="mp-gamelog nf-log">
  {seasons.length>1&&<div className="mp-seg" role="group" aria-label="Season">{seasons.slice(0,3).map(year=>
   <button type="button" key={year} aria-pressed={shown===year} onClick={()=>setSeason(year)}>{year}</button>)}</div>}
  <div className="nf-log-wrap"><table className="mp-log"><thead><tr><th scope="col">Wk</th><th scope="col">Opp</th>{columns.map(([label])=><th scope="col" key={label}>{label}</th>)}</tr></thead>
   <tbody>{games.map(game=>{const rank=table[game.opponent]?.[group]?.stats?.[MAIN[group]]?.szn?.[1];
    return <tr key={game.gameId} data-dnp={game.dnp||undefined}><td>{game.week}</td>
     <td><span className="mp-opp">{game.isHome?'':'@'}{game.opponent}{finite(rank)&&shown===seasons[0]&&<em className="nf-drank" data-tone={toneOf(rank,count)}>D#{rank}</em>}</span></td>
     {game.dnp?<td colSpan={columns.length} className="nf-dnp">Did not play</td>:columns.map(([label,read])=><td key={label}>{cellOf(game,read)}</td>)}</tr>;})}
    <tr className="mp-log-avg"><td colSpan="2">Totals</td>{totals.map((total,index)=><td key={columns[index][0]}>{total==null?'':fmt(total,0)}</td>)}</tr></tbody></table></div>
  {shown===seasons[0]&&<p className="nd-foot">D#: where that defense ranks this season in {MAIN_WORDS[group]} allowed to {GROUPS[group]}. 1 allows the fewest (tough), {count||32} the most (soft).</p>}
 </Card>;
}

// ------------------------------------------------------------ The page
export function NflMatchupPage({row,lines,league,onBack}){
 const [tab,setTab]=useState('overview'),[picked,setPicked]=useState(null);
 const season=nflSeason();
 const leagueState=useMemo(()=>({data:league,loading:!league}),[league]);
 const log=useNfl('log',{season,playerId:row.playerId},Boolean(row.playerId));
 const logs=log.data?.rows||[];
 const group=positionOf(row)||'WR';
 const home=row.teamAbbr&&row.teamAbbr===row.homeTeamAbbr;
 const team=league?.teams?.[row.teamAbbr],opponent=league?.teams?.[row.opponent];
 const nickname=String(team?.name||'').split(' ').slice(-1)[0]||row.teamAbbr;
 const facts=[nickname,POSITION_NAMES[group]].filter(Boolean);
 return <MatchupPageShell row={row} team={team} opponent={opponent} home={home} facts={facts} color={teamColor(row.teamAbbr,null)} today="Today"
  onBack={onBack} tabs={TABS} tab={tab} onTab={setTab}>
  {tab==='overview'&&<div className="mp-cols">
   <div className="mp-col">{log.loading&&!logs.length?<Card title="His games" icon={LineChart}><Loading/></Card>:<><Averages logs={logs} group={group}/>
    <Trend row={row} lines={lines} logs={played(logs)} chips={CHIPS}/></>}</div>
   <div className="mp-col"><Injuries row={row} season={season} league={league}/></div></div>}
  {tab==='matchup'&&<div className="mp-cols">
   <div className="mp-col"><Grade row={row} league={leagueState} group={group} picked={picked} onPick={setPicked}/>
    <div className="mp-section"><span>Why this score</span></div>
    <TheirDefense row={row} league={leagueState} group={group} picked={picked}/></div>
   <div className="mp-col"><VsThem row={row} logs={logs} lines={lines}/><TheirInjuries row={row} season={season} league={league}/></div></div>}
  {tab==='stats'&&<GameLog logs={logs} league={leagueState} group={group}/>}
 </MatchupPageShell>;
}

export {band};
