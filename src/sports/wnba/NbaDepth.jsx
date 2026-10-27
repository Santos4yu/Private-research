// The NBA matchup page's Depth tab (Oct 27, the owner: "can we add a depths
// thing here"): his team's and tonight's opponent's depth charts, built from
// the rotation each coach has actually used (depth.js): last game's starters
// in the five slots, the bench behind them by minutes, tonight's injury
// report on each player, and who's next up where a starter is out.
import React,{useEffect,useMemo,useState} from 'react';
import {Users} from 'lucide-react';
import {Card,Loading,Photo,teamName} from './NbaScout';
import {fmt} from './wnba-research';
import {depthRows,injuryCode} from './depth';
import {positionCode} from '../../nba-matchup-score';

const STATUS={OUT:'Out',DOUBT:'Doubtful',Q:'Questionable',GTD:'GTD',DTD:'Day-to-day',OFS:'Out for season',SUSP:'Suspended'};
// Out of tonight's game, for "Next up".
const SITS=new Set(['OUT','DOUBT','OFS','SUSP']);
const shortName=name=>{const parts=String(name||'').trim().split(/\s+/);return parts.length>1?`${parts[0][0]}. ${parts.slice(1).join(' ')}`:parts[0]||'';};

export function DepthCard({row,league,matchup}){
 const team=row.teamAbbr,opponent=row.opponent;
 const [side,setSide]=useState(team);
 useEffect(()=>setSide(team),[team]);
 const data=league.data,rotation=data?.rotation?.[side];
 const injuries=useMemo(()=>matchup?.data?.injuries?.[side]||[],[matchup?.data,side]);
 const injured=useMemo(()=>new Map(injuries.map(item=>[String(item.id),item])),[injuries]);
 const rows=useMemo(()=>rotation?depthRows(rotation.players,injuries,positionCode):[],[rotation,injuries]);
 if(league.loading&&!data)return <Card title="Depth chart" icon={Users}><Loading/></Card>;
 if(!data?.rotation)return null;
 return <Card title="Depth chart" note={rotation?`last ${rotation.games} ${rotation.games===1?'game':'games'}`:undefined} icon={Users} className="nba-depth">
  <div className="mp-seg nd-teams" role="group" aria-label="Team">{[team,opponent].filter(Boolean).map(abbr=>
   <button type="button" key={abbr} aria-pressed={side===abbr} onClick={()=>setSide(abbr)}>
    {data.teams?.[abbr]?.logo&&<img src={data.teams[abbr].logo} alt="" width="18" height="18"/>}{teamName(data,abbr)}</button>)}</div>
  {!rotation?<p className="mp-empty">No games recorded for the {teamName(data,side)} yet.</p>
  :<div className="nd-chart">{rows.map(([slot,players])=>{
   // Where the starter sits tonight, the first one healthy behind him is next up.
   const starterOut=players[0]&&SITS.has(injuryCode(injured.get(String(players[0].id)))||'');
   const next=starterOut?players.findIndex((player,index)=>index>0&&!SITS.has(injuryCode(injured.get(String(player.id)))||'')):-1;
   return <div className="nd-row" key={slot}><span className="nd-slot">{slot[0]}</span>
    <div className="nd-players">{players.map((player,index)=>{
     const code=injuryCode(injured.get(String(player.id))),self=String(player.id)===String(row.playerId);
     const minutes=player.min10??player.min;
     return <div className="nd-player" key={player.id||player.name} data-start={index===0||undefined} data-self={self||undefined} data-sits={SITS.has(code||'')||undefined}>
      <Photo src={player.headshot}/>
      <span className="nd-who"><b>{shortName(player.name)}</b>
       <small>{player.injuredOnly?'Not in the rotation':`${fmt(minutes,0)} min${index===0&&player.lastStart?' · starter':''}`}</small></span>
      {code?<em data-code={code}>{STATUS[code]||code}</em>:index===next?<em data-next>Next up</em>:null}
     </div>;})}</div>
   </div>;})}</div>}
 </Card>;
}
