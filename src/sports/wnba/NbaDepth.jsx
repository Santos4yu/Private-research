// The NBA matchup page's Depth tab (Oct 27, the owner: "can we add a depths
// thing here", then "make it different"): his team's and tonight's
// opponent's rotation as each coach has actually used it, last game's
// starting five across the top, the bench under it by minutes, then the
// rest of the injury report. Tonight's report on everyone, and who's next
// up behind a starter who sits.
import React,{useEffect,useMemo,useState} from 'react';
import {Users} from 'lucide-react';
import {Card,Loading,Photo,teamName} from './NbaScout';
import {fmt} from './wnba-research';
import {injuryCode} from './depth';
import {positionCode} from '../../nba-matchup-score';

const STATUS={OUT:'Out',DOUBT:'Doubtful',Q:'Questionable',GTD:'GTD',DTD:'Day-to-day',OFS:'Out for season',SUSP:'Suspended'};
// Out of tonight's game, for "Next up".
const SITS=new Set(['OUT','DOUBT','OFS','SUSP']);
const ORDER={G:0,F:1,C:2};
// A starter's spot goes to his own position's bench first, then the nearest.
const NEAREST={G:['G','F','C'],F:['F','C','G'],C:['C','F','G']};
// The minutes bars' full width.
const FULL=40;
const SUFFIX=/^(jr|sr|ii|iii|iv)\.?$/i;
const shortName=name=>{const parts=String(name||'').trim().split(/\s+/);return parts.length>1?`${parts[0][0]}. ${parts.slice(1).join(' ')}`:parts[0]||'';};
const lastName=name=>{const parts=String(name||'').trim().split(/\s+/).filter(part=>!SUFFIX.test(part));return parts.length>1?parts.slice(1).join(' '):parts[0]||'';};
const plain=name=>String(name||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z]/g,'');

/** Starters, bench and out from a team's rotation and tonight's report. */
export function lineup(players,injuries,self){
 const injured=new Map(injuries.map(item=>[String(item.id),item]));
 const codeOf=player=>injuryCode(injured.get(String(player.id)));
 const pos=player=>positionCode(player.pos)||'F';
 const starters=players.filter(player=>player.lastStart).sort((a,b)=>ORDER[pos(a)]-ORDER[pos(b)]||b.min-a.min);
 const bench=players.filter(player=>!player.lastStart&&player.min>0).sort((a,b)=>b.min-a.min);
 // On the report and not playing lately (no minutes), or not in the rotation at all.
 const listed=new Set(players.map(player=>String(player.id)));
 const out=[...players.filter(player=>!player.lastStart&&!(player.min>0)&&codeOf(player)),
  ...injuries.filter(item=>item.id&&!listed.has(String(item.id))).map(item=>({id:item.id,name:item.name,pos:item.position,headshot:item.headshot,min:null}))];
 // Who's next up: for each starter sitting tonight, the bench player at his
 // position (then the nearest) with the most minutes who isn't sitting too.
 const next=new Map(),taken=new Set();
 for(const starter of starters){
  if(!SITS.has(codeOf(starter)||''))continue;
  const pick=NEAREST[pos(starter)].map(at=>bench.find(player=>pos(player)===at&&!taken.has(player.id)&&!SITS.has(codeOf(player)||''))).find(Boolean);
  if(pick){taken.add(pick.id);next.set(String(pick.id),starter);}
 }
 // His own chip: the id and name both, else the name (a box score's id can
 // differ from the board's), else the id.
 const everyone=[...starters,...bench,...out];
 const sameId=player=>self.id&&String(player.id)===String(self.id),sameName=player=>self.name&&plain(player.name)===plain(self.name);
 const me=everyone.find(player=>sameId(player)&&sameName(player))||everyone.find(sameName)||everyone.find(sameId);
 return {starters,bench,out,next,codeOf,pos,me:me?String(me.id):null,injured};
}

function Tag({code,next}){
 return <>{code&&<em data-code={code}>{STATUS[code]||code}</em>}{next&&<em data-next>Next up</em>}</>;
}

export function DepthCard({row,league,matchup}){
 const team=row.teamAbbr,opponent=row.opponent;
 const [side,setSide]=useState(team);
 useEffect(()=>setSide(team),[team]);
 const data=league.data,rotation=data?.rotation?.[side];
 const injuries=useMemo(()=>matchup?.data?.injuries?.[side]||[],[matchup?.data,side]);
 const chart=useMemo(()=>rotation?lineup(rotation.players,injuries,{id:row.playerId,name:row.player}):null,[rotation,injuries,row.playerId,row.player]);
 if(league.loading&&!data)return <Card title="Depth chart" icon={Users}><Loading/></Card>;
 if(!data?.rotation)return null;
 const self=player=>chart.me===String(player.id)||undefined;
 return <Card title="Depth chart" note={rotation?`min, last ${rotation.games} ${rotation.games===1?'game':'games'}`:undefined} icon={Users} className="nba-depth">
  <div className="mp-seg nd-teams" role="group" aria-label="Team">{[team,opponent].filter(Boolean).map(abbr=>
   <button type="button" key={abbr} aria-pressed={side===abbr} onClick={()=>setSide(abbr)}>
    {data.teams?.[abbr]?.logo&&<img src={data.teams[abbr].logo} alt="" width="18" height="18"/>}{teamName(data,abbr)}</button>)}</div>
  {!chart?<p className="mp-empty">No games recorded for the {teamName(data,side)} yet.</p>:<div className="nd-chart" key={side}>
   <h3 className="nd-head">Starters</h3>
   <ol className="nd-five">{chart.starters.map((player,index)=>{const code=chart.codeOf(player);
    return <li key={player.id} style={{'--n':index}} data-self={self(player)} data-sits={SITS.has(code||'')||undefined}
     aria-label={`${player.name}, ${chart.pos(player)}, ${fmt(player.min,0)} minutes${code?`, ${STATUS[code]||code} tonight`:''}`}>
     <Photo src={player.headshot}/>
     <b>{lastName(player.name)}</b>
     <small><span>{chart.pos(player)}</span>{fmt(player.min,0)}</small>
     {code&&<Tag code={code}/>}
    </li>;})}</ol>
   {chart.bench.length>0&&<><h3 className="nd-head">Bench</h3>
    <ol className="nd-list">{chart.bench.map((player,index)=>{const code=chart.codeOf(player),starter=chart.next.get(String(player.id));
     return <li key={player.id} style={{'--n':index+5}} data-self={self(player)} data-sits={SITS.has(code||'')||undefined}>
      <Photo src={player.headshot}/>
      <span className="nd-who"><b>{shortName(player.name)}</b>
       <small><span>{chart.pos(player)}</span><Tag code={code} next={Boolean(starter)}/>{starter&&`for ${lastName(starter.name)}`}</small></span>
      <span className="nd-bar" aria-hidden="true"><i style={{'--w':Math.min(1,(player.min||0)/FULL)}}/></span>
      <span className="nd-min">{fmt(player.min,0)}</span>
     </li>;})}</ol></>}
   {chart.out.length>0&&<><h3 className="nd-head">Injury report</h3>
    <ul className="nd-list nd-out">{chart.out.map(player=>{const item=chart.injured.get(String(player.id)),code=chart.codeOf(player);
     return <li key={player.id||player.name} data-self={self(player)}>
      <Photo src={player.headshot}/>
      <span className="nd-who"><b>{shortName(player.name)}</b>
       <small><span>{chart.pos(player)}</span>{item?.injury||null}</small></span>
      <Tag code={code}/>
     </li>;})}</ul></>}
  </div>}
 </Card>;
}
