// The NFL player page's plays sections (NflMatchupPage.jsx), from
// /api/nfl?resource=finder-plays (nfl_plays.py): how the matchup plays (the
// looks he gets and how the opponent handles each), the players at his
// position who have faced the opponent, his metrics ranked at his position,
// and where he does best. Words come from nfl-plays.js.
import React,{useState} from 'react';
import {Activity,BarChart3,ChevronDown,Route,Trophy,Users} from 'lucide-react';
import {Card,Loading} from './sports/wnba/NbaScout';
import {useIsAdmin,QUIET} from './admin-notice.js';
import {FACED_LABELS,GROUP_NOUNS,LOOKS,NEED_WORDS,SPLIT_TITLES,bar,beat,bottomLine,columns,facedTally,headline,metricValue,
 mostWords,num,ordinal,pct,rankFill,rankWords,showsShare,softTone,toneOfRank} from './nfl-plays';

const finite=value=>typeof value==='number'&&Number.isFinite(value);

function Unavailable({state,label}){
 const admin=useIsAdmin();
 return <p className="mp-empty">{admin?<>{state.error||`${label} couldn’t load.`} <button type="button" className="nf-retry" onClick={state.retry}>Retry</button></>:QUIET}</p>;
}

// ------------------------------------------------------------ How it plays
function SplitTable({split,opponent}){
 const [mine,theirs,rate]=columns(split,opponent);
 const shown=showsShare(split);
 return <table className="nf-look">
  <thead><tr><th scope="col">{mine}</th>{opponent&&<th scope="col">{theirs}</th>}<th scope="col">{rate}</th></tr></thead>
  <tbody>{split.rows.map(row=>{const {his,them}=row,unit=split.kind==='run'?'car':split.kind==='target'?'tgt':'att';
   return <tr key={row.key}>
    <th scope="row"><b>{LOOKS[split.split]?.[row.key]||row.key}</b>
     <span className="nf-share" aria-hidden="true"><i style={{width:`${Math.round((his.share||0)*100)}%`}}/></span>
     <small>{his.n} {unit}{finite(his.share)?` · ${pct(his.share)}`:''}{split.split==='blitz'&&finite(his.teamShare)?` · ${pct(his.teamShare)} of team`:''}</small></th>
    {opponent&&<td data-tone={shown?undefined:softTone(them?.rank,them?.of)}>{them?.n?<>
     <b>{shown?pct(them.share):num(them.value,2)}</b>
     <small>{shown?mostWords(them.shareRank,them.of):mostWords(them.rank,them.of)}</small>
     <small className="nf-look-sub">{shown?(finite(them.value)?`${num(them.value,2)} a ${split.kind==='run'?'carry':'throw'}`:''):`${pct(them.share)} of ${split.kind==='run'?'carries':'throws'}`}</small></>
     :<b className="nf-none">—</b>}</td>}
    <td data-tone={toneOfRank(his.rank,his.of)}><b>{his.n?num(his.value):'—'}</b>{finite(his.rank)&&<small>{rankWords(his.rank,his.of)}</small>}</td>
   </tr>;})}</tbody>
 </table>;
}

function Angle({split,context,open}){
 return <details className="nf-angle" open={open||undefined}>
  <summary><span><b>{SPLIT_TITLES[split.split]}{split.season<context.season&&<em className="nf-tag">{split.season}</em>}</b>
   <small>{headline(split,context)}</small></span><ChevronDown size={18} aria-hidden="true"/></summary>
  <SplitTable split={split} opponent={context.opponent}/>
  
  
  
 </details>;
}

export function HowItPlays({plays,row,season}){
 if(plays.loading&&!plays.data)return <Card title="How it plays" icon={Route}><Loading/></Card>;
 if(plays.error&&!plays.data)return <Card title="How it plays" icon={Route}><Unavailable state={plays} label="How it plays"/></Card>;
 const splits=(plays.data?.splits||[]).filter(split=>split.rows?.some(item=>item.his?.n>0||item.them?.n>0));
 if(!plays.data?.player||!splits.length)return null;
 const context={opponent:row.opponent,team:row.teamAbbr,season};
 const line=bottomLine(splits,context);
 return <Card title="How it plays" note={`${season} · ${row.opponent} vs him`} icon={Route} className="nf-plays">
  {splits.map((split,index)=><Angle key={split.split} split={split} context={context} open={index===0}/>)}
  {line&&<p className="nf-bottom"><b>Bottom line</b>{line}</p>}
 </Card>;
}

// ------------------------------------------------------------ vs them
export function FacedThem({plays,row,group}){
 const [all,setAll]=useState(false);
 const faced=plays.data?.faced;
 if(plays.loading&&!plays.data)return <Card title={`${GROUP_NOUNS[group]} vs ${row.opponent}`} icon={Users}><Loading/></Card>;
 if(!faced)return null;
 const noun=GROUP_NOUNS[group]||'Players';
 if(!faced.rows?.length)return <Card title={`${noun} vs ${row.opponent}`} icon={Users}><p className="mp-empty">No {noun.toLowerCase()} have faced {row.opponent} yet this season.</p></Card>;
 const tally=facedTally(faced),main=tally[0];
 const lines=faced.rows.some(item=>Object.keys(item.lines||{}).length);
 const shown=all?faced.rows:faced.rows.slice(0,8);
 return <Card title={`${noun} vs ${row.opponent}`} note={`${faced.rows.length} this season`} icon={Users} className="nf-faced">
  {main?.of>0&&<p className="nf-faced-sum"><b>{main.beat} of {main.of}</b> beat their usual {FACED_LABELS[main.stat].toLowerCase()} here.</p>}
  <div className="nf-faced-chips">{tally.map(item=><span key={item.stat} data-tone={item.of?(item.beat*2>=item.of?'good':'poor'):undefined}>
   <b>{item.of?`${item.beat}/${item.of}`:'—'}</b><small>{FACED_LABELS[item.stat]}</small></span>)}</div>
  <div className="nf-faced-wrap"><table className="nf-faced-table">
   <thead><tr><th scope="col">Player</th>{faced.stats.map(stat=><th scope="col" key={stat}>{FACED_LABELS[stat]}</th>)}</tr></thead>
   <tbody>{shown.map(item=><tr key={item.gameId+item.id}>
    <th scope="row"><b>{item.name}</b><small>{item.team} · Wk {item.week}</small></th>
    {faced.stats.map(stat=>{const against=bar(item,stat),call=beat(item,stat);
     return <td key={stat} data-tone={call===null?undefined:call?'good':'poor'}><b>{num(item.values?.[stat],0)}</b>
      <small>{against?`${against.kind==='line'?'line':'avg'} ${num(against.value,1)}`:''}</small></td>;})}
   </tr>)}</tbody></table></div>
  {faced.rows.length>8&&<button type="button" className="nf-more" aria-expanded={all} onClick={()=>setAll(value=>!value)}>{all?'Show fewer':`Show all ${faced.rows.length}`}</button>}
 </Card>;
}

// ------------------------------------------------------------ Metrics
function SeasonSwitch({seasons,shown,onPick}){
 if(seasons.length<2)return null;
 return <div className="mp-seg nf-season" role="group" aria-label="Season">{seasons.map(year=>
  <button type="button" key={year} aria-pressed={shown===year} onClick={()=>onPick(year)}>{year}</button>)}</div>;
}

function Tiles({group}){
 return <div className="nf-tiles">{group.items.map(item=><div key={item.key} data-tone={toneOfRank(item.rank,item.of)}>
  <small>{item.label}</small><b>{metricValue(item)}</b><em>{finite(item.rank)?rankWords(item.rank,item.of):'—'}</em></div>)}</div>;
}

function Bars({group}){
 return <ul className="nf-bars">{group.items.map(item=><li key={item.key} data-tone={toneOfRank(item.rank,item.of)}>
  <span>{item.label}</span><i aria-hidden="true"><i style={{width:`${Math.round(rankFill(item.rank,item.of)*100)}%`}}/></i>
  <b>{metricValue(item)}</b><em>{finite(item.rank)?ordinal(item.rank):'—'}</em></li>)}</ul>;
}

export function Metrics({state,season,seasons,onSeason}){
 const data=state.data;
 if(state.loading&&!data)return <Card title="Metrics" icon={BarChart3}><Loading/></Card>;
 if(state.error&&!data)return <Card title="Metrics" icon={BarChart3}><Unavailable state={state} label="Metrics"/></Card>;
 const switcher=<SeasonSwitch seasons={seasons} shown={season} onPick={onSeason}/>;
 if(!data?.player)return <Card title="Metrics" icon={BarChart3}>{switcher}<p className="mp-empty">No {season} games on record for him.</p></Card>;
 const groups=data.metrics||[],[production,volume,...efficiency]=groups;
 return <>
  <Card title="Production" note={`${season} · ${data.player.games} ${data.player.games===1?'game':'games'}`} icon={Trophy} className="nf-metrics">
   {switcher}
   {production&&<Tiles group={production}/>}
  </Card>
  {volume&&<Card title="Volume" note="his workload" icon={Activity} className="nf-metrics"><Bars group={volume}/></Card>}
  {efficiency.map(group=><Card key={group.key} title={group.title} note={group.need?`${group.need.min}+ ${NEED_WORDS[group.need.stat]||group.need.stat} · ${group.items.find(item=>item.of)?.of??0} ranked`:null}
   icon={BarChart3} className="nf-metrics">
   <Bars group={group}/>
   
  </Card>)}
 </>;
}

// ------------------------------------------------------------ Where he does best
export function WhereHeWins({state,season}){
 const splits=(state.data?.splits||[]).filter(split=>split.season===season&&split.rows?.some(row=>row.his?.n>0));
 if(!state.data?.player||!splits.length)return null;
 return <Card title="Where he does best" note={`${season} · his own splits`} icon={Route} className="nf-wins">
  {splits.map(split=>{const unit=split.kind==='run'?'car':split.kind==='target'?'tgt':'att',per=split.kind==='run'?'YPC':split.kind==='target'?'YDS/TGT':'YDS/ATT';
   const ranked=split.rows.filter(row=>row.his.n>0);
   const best=ranked.filter(row=>finite(row.his.rank)).sort((a,b)=>a.his.rank/a.his.of-b.his.rank/b.his.of)[0]
    ||ranked.slice().sort((a,b)=>(b.his.value||0)-(a.his.value||0))[0];
   return <section key={split.split} className="nf-wins-group"><h3>{SPLIT_TITLES[split.split]}</h3>
    <div className="nf-wins-grid">{ranked.map(row=><div key={row.key} data-best={row===best||undefined} data-tone={toneOfRank(row.his.rank,row.his.of)}>
     <small>{LOOKS[split.split]?.[row.key]||row.key}</small>
     <b>{row.his.n?num(row.his.value):'—'}<span>{per}</span></b>
     <em>{row.his.n} {unit} · {num(row.his.yards,0)} yds</em>
     {finite(row.his.rank)&&<i>{rankWords(row.his.rank,row.his.of)}</i>}</div>)}</div></section>;})}
 </Card>;
}
