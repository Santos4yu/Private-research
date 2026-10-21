// The NBA player page's scouting cards, shown when the Props tab's NBA
// matchups switch is on: tonight's matchup grade, the defense behind it, how
// he scores, who will guard him, how he and the players at his position have
// done against this team, and where he ranks at his position.
// Numbers: nba-matchup-score.js and the league context (ESPN box scores,
// backend/sports/wnba/context.py + scout.py), NBA.com's tables through the
// phone relay (play types, defenders), /api/wnba?resource=scout.
import React,{useEffect,useMemo,useState} from 'react';
import {Activity,ChevronDown,ChevronRight,Medal,Shield,Swords,Target,UserRound,Users} from 'lucide-react';
import {FinderResearchCard as Card} from '../../FinderResearchSections';
import {baseMarket,finite,fmt,opponentOf,ordinal,positionOf,realGames,shortDate,signed,useWnba} from './wnba-research';
import {cardScores} from '../../nba-matchup-score';
import './nba-scout.css';

const POS_WORDS={G:['guard','guards','Guards'],F:['forward','forwards','Forwards'],C:['center','centers','Centers']};
const POSITIONS=['G','F','C'];
const nbaHead=id=>id?`https://cdn.nba.com/headshots/nba/latest/260x190/${id}.png`:null;
const lastWord=name=>String(name||'').split(' ').filter(part=>!/^(jr|sr|ii|iii|iv)\.?$/i.test(part)).slice(-1)[0]||name;
const firstWord=name=>String(name||'').split(' ')[0]||name;
// "Tyler Herro" -> "T. Herro": the list's name column is narrow on a phone.
const shortName=name=>{const parts=String(name||'').split(' ');return parts.length>1?`${parts[0][0]}. ${parts.slice(1).join(' ')}`:name;};
const clamp=(value,low,high)=>Math.min(high,Math.max(low,value));
const teamName=(league,abbr)=>league?.teams?.[abbr]?.short||league?.teams?.[abbr]?.name||abbr;

function Photo({src,size}){
 return <span className="ns-photo" data-size={size||undefined}><UserRound size={16} aria-hidden="true"/>{src&&<img src={src} alt="" loading="lazy" onError={event=>{event.currentTarget.hidden=true;}}/>}</span>;
}
function Loading(){return <div className="mlb-context-skeleton" role="status" aria-label="Loading"><span/><span/><span/><span/></div>;}

// Rank r of n where 1 is the lowest number: "3rd most" / "5th fewest".
function placeText(rank,count,words=['fewest','most']){
 if(!finite(rank)||!count)return '—';
 return rank<=Math.ceil(count/2)?`${ordinal(rank)} ${words[0]}`:`${ordinal(count-rank+1)} ${words[1]}`;
}
// How soft a defense is in it: -1 the toughest in the league, 1 the softest.
function softness(rank,count,softHigh=true){
 if(!finite(rank)||!(count>1))return 0;
 const spot=(rank-(count+1)/2)/((count-1)/2);
 return softHigh?spot:-spot;
}
const toneOf=soft=>soft>=0.33?'soft':soft<=-0.33?'tough':'even';

// ------------------------------------------------------------ Matchup grade
const READ_NAMES={defense:'Their defense',pace:'Their pace',position:'vs his position',fit:'His games vs them'};
export function GradeCard({row,league,logs}){
 const opponent=row.opponent||opponentOf(row);
 const own=positionOf(row.position)||'G';
 const [position,setPosition]=useState(own),[picked,setPicked]=useState(null);
 useEffect(()=>{setPosition(own);setPicked(null);},[own,row.id]);
 const history=useMemo(()=>logs?.length?{rows:logs}:row.history,[logs,row.history]);
 const scores=useMemo(()=>league.data?cardScores({...row,opponent,position},league.data,history):[],[row,opponent,position,league.data,history]);
 if(league.loading&&!league.data)return <Card title="Matchup grade" icon={Target}><Loading/></Card>;
 if(!scores.some(item=>item.score!=null))return null;
 const mine=scores.find(item=>item.marketKey===baseMarket(row.marketKey));
 const chosen=scores.find(item=>item.marketKey===picked&&item.score!=null)||(mine?.score!=null?mine:null)||scores.find(item=>item.score!=null);
 return <Card title="Matchup grade" note={`vs ${opponent}`} icon={Target} className="nba-grade">
  <div className="ng-head">
   <div className="ng-verdict"><small>{chosen.stat} matchup</small><b data-tone={chosen.tone}>{chosen.label}</b>
    <span>{position===own?'Defended as a':'If defended as a'} {POS_WORDS[position][0]}</span></div>
   <div className="ng-score" data-tone={chosen.tone}><b>{chosen.score}</b><small>/100</small></div>
  </div>
  <div className="ng-gauge" role="img" aria-label={`${chosen.score} out of 100, ${chosen.label}`}><i style={{left:`${clamp(chosen.score,2,98)}%`}}/></div>
  <div className="ng-gauge-ends"><span aria-hidden="true">Tough</span><div className="ns-seg ng-position" role="group" aria-label="Defended as">
   {POSITIONS.map(key=><button type="button" key={key} aria-pressed={position===key} onClick={()=>setPosition(key)}>{key}</button>)}</div><span aria-hidden="true">Soft</span></div>
  <div className="ng-tiles" role="group" aria-label="Stat">{scores.map(item=><button type="button" key={item.marketKey} data-tone={item.tone} aria-pressed={item.marketKey===chosen.marketKey}
   data-own={item.marketKey===mine?.marketKey||undefined} disabled={item.score==null} onClick={()=>setPicked(item.marketKey)}>
   <span>{item.stat}</span><b>{item.score??'—'}</b><small>{item.label||'No data'}</small></button>)}</div>
  {chosen.reads&&<ul className="ng-reads">{chosen.reads.map(read=><li key={read.key}>
   <span className="ng-read-head"><b>{READ_NAMES[read.key]}</b><em>{read.weight}%</em></span>
   <span className="ng-read-text">{read.text}</span>
   <span className="ng-bar" data-tone={read.score>=60?'edge':read.score>=40?'neutral':'tough'}><i style={{width:`${clamp(read.score,4,100)}%`}}/></span></li>)}</ul>}
  <p className="nd-foot">0-100 for the over, 50 an average matchup: how much their defense gives up and how fast they play, then what they allow his position in the stat and his own games against them. 100 is as soft as it gets.</p>
 </Card>;
}

// ------------------------------------------------------------ Their defense
// What the position puts up against them (dvp), then shooting and the rest.
const BY_STAT=[['pts','Points'],['reb','Rebounds'],['ast','Assists'],['tpm','Threes'],['stl','Steals'],['blk','Blocks']];
// [key, label, where, more is soft, digits, unit]
const MORE=[['fgPct','Their FG%','shooting',true,1,'%'],['tpPct','Their 3P%','shooting',true,1,'%'],['efg','Their eFG%','shooting',true,1,'%'],
 ['ftr','Free throws a shot','shooting',true,3,''],['tov','Turnover rate','shooting',false,1,'%'],
 ['astAllowed','Assists allowed','team',true,1,''],['paintAllowed','Paint points allowed','team',true,1,''],['drebPct','Def rebound %','team',false,1,'%']];

function DivergeRow({label,sub,soft,text}){
 const tone=toneOf(soft),width=Math.abs(soft)*50;
 return <div className="ns-diverge-row" data-tone={tone}>
  <span className="ns-diverge-name"><b>{label}</b><small>{sub}</small></span>
  <span className="ns-diverge-bar" aria-hidden="true"><i style={soft>=0?{left:'50%',width:`${Math.max(2,width)}%`}:{right:'50%',width:`${Math.max(2,width)}%`}}/></span>
  <em>{text}</em></div>;
}

export function TheirDefense({row,league}){
 const [more,setMore]=useState(false);
 const data=league.data,opponent=row.opponent||opponentOf(row),position=positionOf(row.position)||'G';
 if(!data)return null;
 const n=data.teamCount,cells=data.dvp?.[opponent]?.[position]?.stats;
 if(!cells)return null;
 const def=data.teamStats?.[opponent]?.def||{},opp=data.opportunity?.teams?.[opponent]||{},count=data.opportunity?.count||n;
 const shooting=data.positionShooting?.teams?.[opponent]?.[position]||{},team=data.teamDefense?.teams?.[opponent]||{};
 // Points allowed: rank 1 the fewest. Rating and pace: rank 1 the most.
 const base=[
  {label:'Pts allowed',value:fmt(def.pts?.[0],1),text:placeText(def.pts?.[1],n),soft:softness(def.pts?.[1],n)},
  {label:'Def rating',value:fmt(opp.drtg?.[0],1),text:placeText(finite(opp.drtg?.[1])?count-opp.drtg[1]+1:null,count,['lowest','highest']),soft:-softness(opp.drtg?.[1],count)},
  {label:'Pace',value:fmt(opp.poss?.[0],1),text:placeText(finite(opp.poss?.[1])?count-opp.poss[1]+1:null,count,['slowest','fastest']),soft:-softness(opp.poss?.[1],count)}];
 const words=POS_WORDS[position];
 const extra=MORE.map(([key,label,where,softHigh,digits,unit])=>{const cell=(where==='team'?team:shooting)[key];if(!cell||!finite(cell[0]))return null;
  return <DivergeRow key={key} label={label} sub={`${digits===3?cell[0].toFixed(3).replace(/^0/,''):fmt(cell[0],digits)}${unit}`} soft={softness(cell[1],n,softHigh)}
   text={placeText(cell[1],n,unit==='%'||digits===3?['lowest','highest']:['fewest','most'])}/>;}).filter(Boolean);
 return <Card title={`${teamName(data,opponent)} defense`} note={`rank of ${n} teams`} icon={Shield} className="nba-their-defense">
  <div className="ns-base">{base.map(item=><div key={item.label} data-tone={toneOf(item.soft)}><small>{item.label}</small><b>{item.value}</b><em>{item.text}</em></div>)}</div>
  <div className="ns-sub-head"><b>Vs {words[1]}, by stat</b><span>What {teamName(data,opponent)} gives up to {words[1]} a game</span></div>
  <div className="ns-diverge-scale" aria-hidden="true"><span>Tough</span><span>Soft</span></div>
  <div className="ns-diverge">{BY_STAT.map(([key,label])=>{const [value,rank]=cells[key]?.szn||[];if(!finite(value))return null;
   return <DivergeRow key={key} label={label} sub={`${fmt(value,1)} a game`} soft={softness(rank,n)} text={placeText(rank,n)}/>;})}
   {more&&extra}</div>
  {extra.length>0&&<button type="button" className="ns-more" aria-expanded={more} onClick={()=>setMore(value=>!value)}>{more?'Show less':`Shooting and more (${extra.length})`}<ChevronDown size={14} aria-hidden="true"/></button>}
  <p className="nd-foot">Green: among the most the league gives up (good for the over). Red: among the fewest. Their FG%, 3P%, eFG%, free throws and turnovers are {words[1]}' against them; the last three are the whole team's.</p>
 </Card>;
}

// ------------------------------------------------------------ How he scores
const PLAY_COLORS=['#4cc9f0','#4f8ef7','#8b7cf6','#22d3c5','#93c5fd','#c4b5fd','#5eead4'];
export function PlayTypes({row}){
 const opponent=row.opponent||opponentOf(row);
 const state=useWnba('play-types',{league:'nba',player:row.player,team:row.teamAbbr,opponent},Boolean(row.player&&opponent));
 const data=state.data,plays=data?.player||[];
 if(state.loading&&!data)return <Card title="How he scores" icon={Activity}><Loading/></Card>;
 if(state.error||!plays.length)return null;
 const shown=plays.reduce((sum,item)=>sum+(item.share||0),0);
 return <Card title="How he scores" note={data.season} icon={Activity} className="nba-plays">
  <div className="np-mix" role="img" aria-label={plays.map(item=>`${item.label} ${fmt(item.share,0)}%`).join(', ')}>
   {plays.map((item,index)=><i key={item.type} style={{flexGrow:item.share||0,background:PLAY_COLORS[index%PLAY_COLORS.length]}}/>)}
   {shown<100&&<i className="np-mix-rest" style={{flexGrow:100-shown}}/>}</div>
  <table className="np-table"><thead><tr><th scope="col">Play type</th><th scope="col">Pts/play</th><th scope="col">{data.opponentCode} allows</th></tr></thead>
   <tbody>{plays.map((item,index)=>{const theirs=data.opponent?.[item.type];
    const soft=theirs&&theirs.rank<=Math.round(theirs.teams/3),tough=theirs&&theirs.rank>theirs.teams-Math.round(theirs.teams/3);
    return <tr key={item.type}><th scope="row"><span className="np-dot" style={{background:PLAY_COLORS[index%PLAY_COLORS.length]}}/><span><b>{item.label}</b><small>{fmt(item.share,0)}% of his plays</small></span></th>
     <td>{fmt(item.ppp,2)}{finite(item.percentile)&&<small>{item.percentile>=50?`top ${100-item.percentile}%`:`bottom ${item.percentile}%`}</small>}</td>
     <td data-tone={soft?'good':tough?'poor':undefined}>{theirs?<>{fmt(theirs.ppp,2)}<small>{soft?`${ordinal(theirs.rank)} most`:tough?`${ordinal(theirs.teams-theirs.rank+1)} fewest`:`${ordinal(theirs.rank)} of ${theirs.teams}`}</small></>:'—'}</td></tr>;})}</tbody></table>
  <p className="nd-foot">Pts/play: his points each time a play of that kind ends with him, and where that sits among NBA players. {data.opponentCode} allows: points a play they give up on it; green among the most in the league, red among the fewest. From NBA.com.</p>
 </Card>;
}

// ------------------------------------------------------------ Likely defenders
// [label, value, lower is tougher, format]
const GUARD_ROWS=[
 ['Time on him',item=>item.share,null,value=>`${fmt(value,0)}%`],
 ['His pts/75',item=>item.pts,true,value=>fmt(value,1)],
 ['FG% allowed',item=>item.shooting?.dfg,true,value=>`${fmt(value,1)}%`],
 ['vs usual',item=>item.shooting?.diff,true,value=>`${signed(value,1)}`],
 ['At the rim',item=>item.shooting?.rim?.pct,true,value=>`${fmt(value,1)}%`],
 ['On threes',item=>item.shooting?.three?.pct,true,value=>`${fmt(value,1)}%`],
 ['STL+BLK',item=>item.stlBlk,false,value=>fmt(value,1)]];

export function LikelyDefenders({row}){
 const opponent=opponentOf(row);
 const state=useWnba('defender',{league:'nba',player:row.player,team:row.teamAbbr,opponent},Boolean(row.player&&opponent));
 const data=state.data;
 const top=useMemo(()=>{
  const theirs=(data?.defenders||[]).filter(item=>item.team===data?.opponent).sort((a,b)=>b.poss-a.poss).slice(0,3);
  const total=theirs.reduce((sum,item)=>sum+(item.poss||0),0);
  return theirs.map(item=>({...item,share:total?item.poss/total*100:null}));
 },[data]);
 if(state.loading&&!data)return <Card title="Who guards him" icon={Swords}><Loading/></Card>;
 if(state.error||top.length<2)return null;
 const rows=GUARD_ROWS.filter(([,read])=>top.filter(item=>finite(read(item))).length>=2);
 return <Card title="Who guards him" note="most time on him" icon={Swords} className="nba-guards">
  <div className="ng2-grid" style={{'--cols':top.length}}>
   <span/>{top.map(item=><figure key={item.id} data-likely={item.id===data.likely?.id||undefined}><Photo src={nbaHead(item.id)} size="lg"/><figcaption>{lastWord(item.name)}</figcaption></figure>)}
   {rows.map(([label,read,lowerTough,show])=>{const values=top.map(read),known=values.filter(finite);
    const toughest=lowerTough==null||!known.length?null:(lowerTough?Math.min(...known):Math.max(...known));
    return <React.Fragment key={label}><b className="ng2-label">{label}</b>{values.map((value,index)=><span key={top[index].id} data-tough={finite(value)&&value===toughest||undefined}>{finite(value)?show(value):'—'}</span>)}</React.Fragment>;})}
  </div>
  <p className="nd-foot">Shaded: the toughest on {lastWord(row.player)} in that row. Time on him: his possessions against each of them this season ({data.season}). From NBA.com's matchup and defense tracking.</p>
 </Card>;
}

// ------------------------------------------------------------ Shot chart link
export function ShotLink({row,league,onOpen}){
 const opponent=opponentOf(row);
 return <button type="button" className="ns-shotlink" onClick={onOpen}>
  <svg className="ns-court" viewBox="0 0 120 80" aria-hidden="true"><rect x="1" y="1" width="118" height="78" rx="8"/><path d="M18 79 V48 A42 42 0 0 1 102 48 V79"/><rect x="44" y="40" width="32" height="39"/>
   <circle cx="60" cy="66" r="7" className="ns-dot-pink"/><circle cx="30" cy="30" r="7" className="ns-dot-green"/><circle cx="90" cy="30" r="7" className="ns-dot-green"/></svg>
  <span><small>Shot chart</small><b>Where he scores vs {teamName(league.data,opponent)}</b><em>Zone by zone, against their defense</em></span>
  <ChevronRight size={18} aria-hidden="true"/></button>;
}

// ------------------------------------------------------------ Vs the team
const VS_STATS=[['player_points','pts','PTS'],['player_rebounds','reb','REB'],['player_assists','ast','AST'],['player_threes','tpm','3PM'],['player_points_rebounds_assists','pra','PRA']];
const FILTERS=[['all','All'],['similar',null],['handler','Main ball handlers'],['top','Top scorers'],['usage','Usage 28%+']];
const MEETINGS=5;

function Diff({value,line,usual}){
 if(finite(value)&&finite(line))return <small data-tone={value>line?'good':'poor'}>{signed(value-line,1)}</small>;
 if(finite(value)&&finite(usual))return <small data-tone="muted">{signed(value-usual,1)}</small>;
 return <small> </small>;
}

export function VsTeam({row,league,logs,lines}){
 const opponent=opponentOf(row),name=teamName(league.data,opponent),first=firstWord(row.player);
 const [tab,setTab]=useState('him'),[filter,setFilter]=useState('all');
 useEffect(()=>{setTab('him');setFilter('all');},[row.playerId,opponent]);
 const scout=useWnba('scout',{league:'nba',playerId:row.playerId,team:row.teamAbbr,opponent},Boolean(row.playerId&&row.teamAbbr&&opponent));
 const tonight=useMemo(()=>Object.fromEntries(VS_STATS.map(([market])=>[market,(lines||[]).find(item=>item.marketKey===market&&(item.modifier||'standard')==='standard'&&!item.promo)?.line])),[lines]);
 const meetings=useMemo(()=>realGames(logs).filter(game=>game.opponent===opponent).reverse().slice(0,MEETINGS),[logs,opponent]);
 const faced=scout.data?.faced;
 const players=tab!=='him'?(faced?.positions?.[tab]||[]):[];
 const filters=FILTERS.filter(([key])=>key==='all'||players.some(item=>item.tags?.includes(key)));
 // A filter nobody on this tab fits reads as All.
 const current=filters.some(([key])=>key===filter)?filter:'all';
 const shown=current==='all'?players:players.filter(item=>item.tags?.includes(current));
 if(!meetings.length&&!faced)return scout.loading?<Card title={`vs ${name}`} icon={Users}><Loading/></Card>:null;
 const tabs=[['him',first],...POSITIONS.map(key=>[key,POS_WORDS[key][2]])];
 const note=tab==='him'?`last ${meetings.length} ${meetings.length===1?'meeting':'meetings'}`:`last ${faced?.games||0} ${name} games`;
 let tiles,summary,body,foot;
 if(tab==='him'){
  tiles=VS_STATS.map(([market,,label])=>{const line=tonight[market],values=meetings.map(game=>game.values?.[market]).filter(finite);
   return {label,top:finite(line)&&values.length?`${values.filter(value=>value>line).length}/${values.length}`:'—',sub:finite(line)?`o${fmt(line,1)}`:'no line'};});
  body=meetings.map(game=><div className="nv-row" key={game.gameId||game.date}><span className="nv-who"><b>{shortDate(game.date)}</b><small>{game.isHome?'vs':'@'} {name}</small></span>
   {VS_STATS.map(([market])=><span key={market}><b>{fmt(game.values?.[market],0)}</b><Diff value={game.values?.[market]} line={tonight[market]}/></span>)}</div>);
  summary=meetings.length?null:<p className="nv-summary">He hasn't played {name} in the games on record.</p>;
  foot=`Graded at tonight's lines; the number under each is how far over or under it he finished.`;
 }else{
  const words=POS_WORDS[tab];
  tiles=VS_STATS.map(([,key,label])=>{const graded=shown.filter(item=>finite(item.values?.[key])&&finite(item.lines?.[key]));
   if(graded.length)return {label,top:`${graded.filter(item=>item.values[key]>item.lines[key]).length}/${graded.length}`,sub:'cleared'};
   const usual=shown.filter(item=>finite(item.values?.[key])&&finite(item.avg?.[key]));
   return {label,top:usual.length?`${usual.filter(item=>item.values[key]>item.avg[key]).length}/${usual.length}`:'—',sub:'above usual'};});
  const graded=shown.filter(item=>finite(item.values?.pts)&&finite(item.lines?.pts));
  const usual=shown.filter(item=>finite(item.values?.pts)&&finite(item.avg?.pts));
  summary=!shown.length?<p className="nv-summary">No {words[1]} played real minutes against {name} in these games.</p>
   :<p className="nv-summary">{graded.length?<><b>{graded.filter(item=>item.values.pts>item.lines.pts).length} of {graded.length}</b> {words[1]} cleared their own points line against {name}.</>
    :<><b>{usual.filter(item=>item.values.pts>item.avg.pts).length} of {usual.length}</b> {words[1]} scored more than usual against {name}.</>}</p>;
  body=shown.map(item=><div className="nv-row" key={item.id+item.date}><span className="nv-who"><Photo src={item.headshot}/><span><b title={item.name}>{shortName(item.name)}</b>
   <small>{shortDate(item.date)} · {item.team}</small>{finite(item.usage)&&<small>{fmt(item.usage,0)}% usage</small>}</span></span>
   {VS_STATS.map(([,key])=><span key={key}><b>{fmt(item.values?.[key],0)}</b><Diff value={item.values?.[key]} line={item.lines?.[key]} usual={item.avg?.[key]}/></span>)}</div>);
  foot='Colored: against his own PrizePicks line that night. Grey: against his usual, for nights before lines were kept.';
 }
 return <Card title={`vs ${name}`} note={note} icon={Users} className="nba-vs">
  <div className="nv-tabs" role="tablist" aria-label="Whose games">{tabs.map(([key,label])=><button type="button" role="tab" key={key} aria-selected={tab===key} onClick={()=>setTab(key)}>{label}</button>)}</div>
  {tab!=='him'&&filters.length>1&&<div className="nv-filters" role="group" aria-label="Which players">{filters.map(([key,label])=><button type="button" key={key} aria-pressed={current===key} onClick={()=>setFilter(key)}>{label||`Similar to ${first}`}</button>)}</div>}
  {tab!=='him'&&scout.loading&&!faced?<Loading/>:<>
   {summary}
   {(tab==='him'?meetings.length:shown.length)>0&&<>
    <div className="nv-tiles">{tiles.map(tile=><div key={tile.label}><small>{tile.label}</small><b>{tile.top}</b><em>{tile.sub}</em></div>)}</div>
    <div className="nv-list">{body}</div>
    <p className="nd-foot">{foot}</p></>}</>}
 </Card>;
}

// ------------------------------------------------------------ Position ranks
export function PositionRanks({row}){
 const opponent=opponentOf(row),[side,setSide]=useState('offense');
 const scout=useWnba('scout',{league:'nba',playerId:row.playerId,team:row.teamAbbr,opponent},Boolean(row.playerId&&row.teamAbbr&&opponent));
 const peers=scout.data?.peers;
 if(scout.loading&&!peers)return <Card title="At his position" icon={Medal}><Loading/></Card>;
 if(!peers)return null;
 const words=POS_WORDS[peers.position],tiles=peers[side]||[];
 const seasons=scout.data.seasons||[];
 return <Card title={`vs other ${words[1]}`} note={`${peers.games} games · rank of ${peers.count}`} icon={Medal} className="nba-ranks">
  <div className="nv-tabs" role="tablist" aria-label="Side">{[['offense','Offense'],['defense','Defense & boards']].map(([key,label])=><button type="button" role="tab" key={key} aria-selected={side===key} onClick={()=>setSide(key)}>{label}</button>)}</div>
  <div className="nr-grid" data-count={tiles.length}>{tiles.map(tile=>{const top=finite(tile.rank)&&tile.rank<=Math.ceil(peers.count/4),most=['to','pf'].includes(tile.key);
   return <div key={tile.key} data-top={top&&!most||undefined}><small>{tile.label}</small><b>{fmt(tile.value,1)}{tile.key==='ts'||tile.key==='usage'?'%':''}</b><em>{finite(tile.rank)?`#${tile.rank}${most?' most':''}`:'—'}</em></div>;})}</div>
  <p className="nd-foot">Ranked among {words[1]} playing 20+ minutes a game{seasons.length>1?', last season and this one together until this season has enough games':''}. Per game.</p>
 </Card>;
}
