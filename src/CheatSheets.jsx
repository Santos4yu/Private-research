import React,{useEffect,useMemo,useState} from 'react';
import {ArrowDown,ArrowLeft,ArrowUp,ArrowUpRight,ChevronDown,CloudRain,Crosshair,Flame,Home,Info,Layers,Moon,RefreshCw,Search,Sun,Swords,Target,TrendingUp,Zap} from 'lucide-react';
import {loadLines} from './finder-pool';
import {finite,nameKey,pct,num,fixed,signed,price,time,dayLabel,tone,initials,Img,Score,Tag,Table,better,Faq,Skeleton} from './cheat-sheet-parts';
import {NFL_SHEETS,NflSheetView} from './NflSheets';
import {siteSheetAllowed} from './site-access';
import './cheat-sheets.css';

// Cheat Sheets: today's MLB slate read eight ways (mlb_sheets.py). Each
// sheet is one request to the board endpoint, kept here for a few minutes;
// prices come from the lines the Finder already loads.

const SHEETS=[
 {key:'hr',blurb:"Power, matchup and park for every bat on the slate.",title:'HR Props',kicker:'Home run props',icon:Flame,about:'Power hitters ranked for home run props: barrel rate, hard-hit rate and exit velocity, slugging and ISO against today\'s pitcher hand, and the park and weather.'},
 {key:'hot',blurb:"Who's hitting well above their season right now.",title:'Hot Bats',kicker:'Last 14 days',icon:TrendingUp,about:'Hitters running well above their season over the last two weeks: OPS, ISO and average gains, home runs, and a sparkline of their recent total bases.'},
 {key:'matchups',blurb:"Each starter against the lineup he faces.",title:'Pitcher vs Lineup',kicker:'Game by game',icon:Swords,about:'Every starter against the lineup he faces: his splits against lefties and righties, his pitch mix, and each hitter\'s numbers against his hand.'},
 {key:'bvp',blurb:"Career numbers against today's starter.",title:'Batter vs Pitcher',kicker:'Career matchups',icon:Crosshair,about:'Career numbers for today\'s hitters against today\'s starter, with the sample size flagged so a 2-for-3 never passes for a trend.'},
 {key:'nrfi',blurb:"Our first-inning chance and fair odds for every game.",title:'NRFI / YRFI',kicker:'First inning',icon:Target,about:'Each starter\'s scoreless-first-inning rate, each offense\'s first-inning scoring, and our model\'s chance of a scoreless first with fair odds.'},
 {key:'park',blurb:"How each park and today's weather move scoring.",title:'Ballpark & Weather',kicker:'Parks & weather',icon:Sun,about:'How every park and the forecast move runs and home runs today: park factor, temperature, wind blowing in or out, and roofs.'},
 {key:'strikeouts',blurb:"Strikeout projections against today's lineups.",title:'Strikeouts',kicker:'K props',icon:Zap,about:'Starters\' strikeout profiles against the lineup they face: K rate, recent strikeouts, expected innings, the lineup\'s K rate against his hand, and a projection.'},
 {key:'streaks',blurb:"Active hit, on-base and home run streaks.",title:'Streaks',kicker:'Parlay legs',icon:Layers,about:'Active streaks for today\'s hitters: hits, on base, total bases, home runs, walks, steals and strikeouts, longest first.'},
];
const SPORTS=[{key:'mlb',label:'MLB'},{key:'nfl',label:'NFL'},{key:'nba',label:'NBA'},{key:'nhl',label:'NHL'}];
const FAQ={
 hr:[['What goes into the power score?','Barrel rate carries the most weight, then ISO against today\'s pitcher hand, home run rate, hard-hit rate, the starter\'s home runs allowed and the park and weather. It ranks today\'s hitters against each other from 0 to 100.'],
  ['What do HOT and the park tags mean?','HOT means three or more homers, or a big jump in ISO, over the last 14 days. The park figure is the game\'s home run environment from the park and the weather, against an average park.']],
 hot:[['How is "hot" measured?','The last 14 days against the hitter\'s own season: OPS, ISO and average. HOT is 250 points of OPS above his season, WARM is 120. At least 15 plate appearances in the window.'],
  ['What is the sparkline?','Total bases in each of his last 10 games, oldest on the left.']],
 matchups:[['Which lineup is shown?','The posted batting order when it\'s out; before that, the team\'s active hitters. Each hitter\'s numbers are against the hand of the pitcher he faces.'],
  ['How are hitters ranked?','By a matchup score from their ISO, OPS, home run rate and strikeout rate against that hand this season.']],
 bvp:[['How much should I trust BvP?','Not much on its own. A dozen plate appearances is noise; that\'s why every row carries its sample size and the score pulls small samples toward average.'],
  ['What do the sample tags mean?','LIMITED is under 8 plate appearances, MODERATE 8 to 19, STRONG 20 or more.']],
 nrfi:[['How is the chance worked out?','Each half of the first inning blends the offense\'s first-inning scoring rate with how often the opposing starter gives up a first-inning run, both pulled toward the league rate by their sample, then nudged by the park and weather. The two halves multiply into the chance of a scoreless first.'],
  ['What are the fair odds?','The price that chance is worth with no margin. A book price better than fair is value on that side.'],
  ['What do the leans mean?','LEAN NRFI at 56% or better, LEAN YRFI at 46% or worse, TOSS-UP in between.']],
 park:[['What is the run environment?','The park\'s run factor combined with the forecast: warm air carries the ball and wind blowing out helps hitters, blowing in hurts them. Domes and closed roofs take the weather out.'],
  ['How should I use it?','Lean toward hitter overs and game overs where runs are up, and toward pitcher props and unders where they are down, alongside the matchups.']],
 strikeouts:[['How is the projection made?','His strikeouts per batter faced, times the batters he should face over his expected innings, scaled by how often today\'s lineup strikes out against his hand compared with the league.'],
  ['What is the K score?','A 0-100 ranking of today\'s starters from his K rate, the lineup\'s K rate against his hand, his last five starts and how deep he goes.']],
 streaks:[['How are streaks counted?','Consecutive games, most recent first, that meet the mark. Games without a plate appearance are skipped.'],
  ['Should I chase streaks?','Use them as one input. A streak says what has happened; check the matchup and the park before building a leg on it.']],
};

const rate=value=>finite(value)?value.toFixed(3).replace(/^0/,''):'—';
const photo=id=>id?`https://img.mlbstatic.com/mlb-photos/image/upload/w_120,q_auto:best/v1/people/${id}/headshot/silo/current`:null;
const logo=id=>id?`https://www.mlbstatic.com/team-logos/${id}.svg`:null;

// ---------------------------------------------------------------- data

const store=new Map();
async function fetchSheet(sheet,day,force=false){
 const key=`${sheet}|${day}`,kept=store.get(key);
 if(!force&&kept&&Date.now()-kept.at<4*60000)return kept.data;
 const response=await fetch(`/api/board?view=mlb-sheet&sheet=${sheet}&day=${day}`,{credentials:'same-origin',cache:'no-store'});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(body.error||'This sheet is unavailable right now.');
 store.set(key,{at:Date.now(),data:body});
 return body;
}
// Prices for HR and strikeout props from the Finder's MLB lines (no history work).
let pricesPending=null;
function loadPrices(){
 pricesPending||=loadLines('mlb',{only:()=>false}).then(rows=>{
  const found={hr:new Map(),k:new Map()};
  for(const row of rows||[]){
   if(String(row.modifier||'standard').toLowerCase()!=='standard')continue;
   const kind=row.marketKey==='hitting:hr'?'hr':row.marketKey==='pitching:strikeouts'?'k':null;
   if(!kind)continue;
   const books=(row.apps||[]).filter(app=>app.key!=='prizepicks'&&(finite(app.over)||finite(app.under)));
   const best=side=>books.filter(app=>finite(app[side])).sort((a,b)=>b[side]-a[side])[0]||null;
   found[kind].set(nameKey(row.player),{line:row.line,over:best('over'),under:best('under')});
  }
  return found;
 }).catch(()=>({hr:new Map(),k:new Map()}));
 return pricesPending;
}
function usePrices(active){
 const [prices,setPrices]=useState(null);
 useEffect(()=>{if(!active)return;let live=true;loadPrices().then(found=>{if(live)setPrices(found);});return()=>{live=false;};},[active]);
 return prices;
}

// ---------------------------------------------------------------- pieces

function Face({id,name,teamId,size}){
 const [failed,setFailed]=useState(false);
 const [noLogo,setNoLogo]=useState(false);
 return <span className="cs-face" data-size={size||undefined}>
  {id&&!failed?<img src={photo(id)} alt="" loading="lazy" onError={()=>setFailed(true)}/>:<b>{initials(name)}</b>}
  {teamId&&!noLogo&&<span className="cs-face-team"><img src={logo(teamId)} alt="" loading="lazy" onError={()=>setNoLogo(true)}/></span>}
 </span>;
}
const Hand=({value})=>value?<span className="cs-hand">{value}</span>:null;
function Who({row,tag}){
 const versus=row.pitcher?<>vs {row.pitcher.name?.split(' ').at(-1)}<Hand value={row.pitcher.throws}/></>:row.opponent?<>{row.home?'vs':'@'} {row.opponent}</>:null;
 return <span className="cs-who">
  <Face id={row.id} name={row.name} teamId={row.teamId}/>
  <span className="cs-who-main">
   <span className="cs-who-name"><strong>{row.name}</strong>{tag}</span>
   <span className="cs-who-meta">{row.team}<Hand value={row.bats||row.throws}/>{versus&&<><i>·</i>{versus}</>}{row.startsAt&&<><i>·</i>{time(row.startsAt)}</>}</span>
  </span>
 </span>;
}
function Spark({values}){
 if(!values?.length)return null;
 const top=Math.max(...values,1),width=56,height=18,step=width/Math.max(values.length-1,1);
 const points=values.map((value,index)=>`${(index*step).toFixed(1)},${(height-1-value/top*(height-2)).toFixed(1)}`).join(' ');
 return <svg className="cs-spark" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true"><polyline points={points}/></svg>;
}


// ---------------------------------------------------------------- sheets

function HrSheet({data,filter,prices}){
 const rows=useMemo(()=>(data.rows||[]).filter(filter),[data,filter]);
 const odds=row=>prices?.hr.get(nameKey(row.name))?.over||null;
 return <Table rows={rows} empty="No hitters match." columns={[
  {key:'player',label:'Player',className:'cs-sticky',render:row=><Who row={row} tag={row.hot&&<Tag tone="hot" icon={Flame}>Hot</Tag>}/>},
  {key:'hr',label:'HR',value:row=>row.hr,format:value=>num(value,0)},
  {key:'barrel',label:'Barrel %',short:'Brl %',value:row=>row.barrel,format:value=>fixed(value),tone:row=>better(row.barrel,6,12)},
  {key:'hardHit',label:'Hard hit %',short:'HH %',value:row=>row.hardHit,format:value=>fixed(value),tone:row=>better(row.hardHit,35,47)},
  {key:'ev',label:'EV',value:row=>row.ev,format:value=>fixed(value)},
  {key:'la',label:'LA',value:row=>row.la,format:value=>num(value,0)},
  {key:'slg',label:'SLG',value:row=>row.slg,format:rate,tone:row=>better(row.slg,0.38,0.48)},
  {key:'iso',label:'ISO vs hand',short:'ISO vH',value:row=>row.vsHand?.iso??row.iso,format:rate,tone:row=>better(row.vsHand?.iso??row.iso,0.13,0.22)},
  {key:'hrRate',label:'HR %',value:row=>row.hrRate,format:value=>pct(value),tone:row=>better(row.hrRate,0.025,0.05)},
  {key:'park',label:'Park',value:row=>row.park,format:value=>signed(value,item=>`${Math.round(item)}%`),tone:row=>better(row.park,-5,5)},
  {key:'odds',label:'Odds',value:row=>odds(row)?.over,render:row=>{const best=odds(row);return best?<span className="cs-odds">{price(best.over)}<small>{best.name}</small></span>:'—';}},
  {key:'score',label:'Power',value:row=>row.score,render:row=><Score value={row.score} label="Power score"/>},
 ]}/>;
}

function HotSheet({data,filter}){
 const rows=useMemo(()=>(data.rows||[]).filter(filter),[data,filter]);
 const delta=(value,format)=><span className="cs-delta" data-up={value>0?'':undefined}>{value>0?<ArrowUp aria-hidden="true"/>:<ArrowDown aria-hidden="true"/>}{format(Math.abs(value))}</span>;
 return <Table rows={rows} empty="Nobody is running hot in this window." columns={[
  {key:'player',label:'Player',className:'cs-sticky',render:row=><Who row={row} tag={row.tag&&<Tag tone={row.tag} icon={row.tag==='hot'?Flame:null}>{row.tag==='hot'?'Hot':'Warm'}</Tag>}/>},
  {key:'spark',label:'Last 10 TB',short:'L10 TB',render:row=><Spark values={row.spark}/>},
  {key:'pa',label:'PA',value:row=>row.pa,format:value=>num(value,0)},
  {key:'avg',label:'AVG',value:row=>row.avg,render:row=><>{rate(row.avg)}{finite(row.delta?.avg)&&delta(row.delta.avg,rate)}</>},
  {key:'ops',label:'OPS',value:row=>row.ops,render:row=><>{rate(row.ops)}{finite(row.delta?.ops)&&delta(row.delta.ops,rate)}</>},
  {key:'iso',label:'ISO',value:row=>row.iso,render:row=><>{rate(row.iso)}{finite(row.delta?.iso)&&delta(row.delta.iso,rate)}</>},
  {key:'hr',label:'HR',value:row=>row.hr,format:value=>num(value,0)},
  {key:'score',label:'Surge',value:row=>row.score,render:row=><Score value={row.score} label="Surge score"/>},
 ]}/>;
}

function WindArrow({effect,direction}){
 if(!effect||effect==='calm')return null;
 const turn=effect==='out'?0:effect==='in'?180:90;
 return <span className="cs-wind" data-effect={effect} title={`Wind ${effect}`}><ArrowUp style={{transform:`rotate(${turn}deg)`}} aria-hidden="true"/></span>;
}
function Weather({env}){
 if(!env)return null;
 return <div className="cs-weather">
  <span><b>{env.dome?'Roof':env.condition||'—'}</b><small>{env.dome?'closed':'conditions'}</small></span>
  <span><b>{finite(env.temp)?`${Math.round(env.temp)}°`:'—'}</b><small>temp</small></span>
  <span><b>{finite(env.precip)?`${Math.round(env.precip)}%`:'—'}</b><small>rain</small></span>
  <span><b><WindArrow effect={env.dome?null:env.windEffect}/>{env.dome?'—':finite(env.wind)?`${Math.round(env.wind)} mph`:'—'}</b><small>{env.dome?'wind':`wind ${env.windEffect||''}`.trim()}</small></span>
  <span data-tone={finite(env.hr)?(env.hr>=4?'good':env.hr<=-4?'bad':undefined):undefined}><b>{signed(env.hr,value=>`${Math.round(value)}%`)}</b><small>HR env.</small></span>
 </div>;
}

function MatchupsSheet({data}){
 const games=data.games||[];
 const [pick,setPick]=useState(0);
 const game=games[Math.min(pick,games.length-1)];
 if(!game)return <p className="cs-empty">No games on this day.</p>;
 return <div className="cs-matchups">
  <div className="cs-games" role="tablist">{games.map((item,index)=><button key={item.gamePk} type="button" role="tab" aria-selected={index===pick} data-active={index===pick?'':undefined} onClick={()=>setPick(index)}>
   <span><Img className="cs-logo" src={logo(item.awayId)}/>{item.away}<i>@</i><Img className="cs-logo" src={logo(item.homeId)}/>{item.home}</span><small>{time(item.startsAt)}</small>
  </button>)}</div>
  <section className="cs-game-card">
   <header><div><h3>{game.away} @ {game.home}</h3><p>{game.venue} · {time(game.startsAt)}{finite(game.environment?.park)&&<> · park {signed((game.environment.park-1)*100,value=>`${Math.round(value)}%`)} runs</>}</p></div><Weather env={game.environment}/></header>
   {game.halves.map(half=><Half key={half.team} half={half}/>)}
  </section>
 </div>;
}
function Half({half}){
 const arm=half.pitcher;
 if(!arm)return <div className="cs-half"><p className="cs-empty">{half.team}'s opponent hasn't named a starter.</p></div>;
 const split=hand=>arm.vs?.[hand];
 const cells=line=>line?[rate(line.avg),rate(line.slg),rate(line.iso),num(line.hr9??null,2),pct(line.kRate),pct(line.bbRate),num(line.hr,0)]:Array(7).fill('—');
 return <div className="cs-half">
  <div className="cs-arm">
   <Face id={arm.id} name={arm.name}/>
   <div><strong>{arm.name} <Hand value={arm.throws}/></strong><small>{arm.team} vs {half.team}{arm.last3?` · last 3: ${arm.last3.ip} IP, ${arm.last3.k} K, ${arm.last3.hr} HR`:''}</small></div>
  </div>
  <div className="cs-table-wrap"><table className="cs-table cs-mini"><thead><tr><th/><th>BAA</th><th>SLG</th><th>ISO</th><th>HR/9</th><th>K %</th><th>BB %</th><th>HR</th></tr></thead><tbody>
   {[['Season',arm.season],['vs LHB',split('L')],['vs RHB',split('R')]].map(([label,line])=><tr key={label}><th>{label}</th>{cells(line).map((cell,index)=><td key={index}>{cell}</td>)}</tr>)}
  </tbody></table></div>
  {arm.arsenal?.length>0&&<div className="cs-chips cs-arsenal">{arm.arsenal.map(item=><span key={item.pitch}>{item.pitch}<b>{finite(item.pct)?`${Math.round(item.pct)}%`:''}</b>{finite(item.speed)&&<small>{num(item.speed)} mph</small>}</span>)}</div>}
  <h4>{half.team} lineup vs {arm.throws==='L'?'lefties':'righties'}{!half.confirmed&&<small> · projected</small>}</h4>
  <Table rows={half.lineup} empty="No lineup yet." initial={{key:'score',dir:-1}} columns={[
   {key:'player',label:'Batter',className:'cs-sticky',render:row=><span className="cs-batter">{row.order&&<i>{row.order}</i>}<strong>{row.name}</strong><Hand value={row.bats}/></span>},
   {key:'pa',label:'PA',value:row=>row.pa,format:value=>num(value,0)},
   {key:'hr',label:'HR',value:row=>row.hr,format:value=>num(value,0)},
   {key:'avg',label:'AVG',value:row=>row.avg,format:rate,tone:row=>better(row.avg,0.22,0.28)},
   {key:'obp',label:'OBP',value:row=>row.obp,format:rate,tone:row=>better(row.obp,0.29,0.35)},
   {key:'slg',label:'SLG',value:row=>row.slg,format:rate,tone:row=>better(row.slg,0.36,0.47)},
   {key:'iso',label:'ISO',value:row=>row.iso,format:rate,tone:row=>better(row.iso,0.12,0.2)},
   {key:'kRate',label:'K %',value:row=>row.kRate,format:value=>pct(value),tone:row=>finite(row.kRate)?(row.kRate>=0.28?'bad':row.kRate<=0.17?'good':undefined):undefined},
   {key:'score',label:'Score',value:row=>row.score,render:row=><Score value={row.score} label="Matchup score"/>},
  ]}/>
 </div>;
}

function BvpSheet({data,filter}){
 const rows=useMemo(()=>(data.rows||[]).filter(filter),[data,filter]);
 return <Table rows={rows} rowKey={row=>`${row.id}-${row.pitcher?.id}`} empty="No career matchups with four or more plate appearances." columns={[
  {key:'player',label:'Player',className:'cs-sticky',render:row=><Who row={row} tag={<Tag tone={row.sample}>{row.sample}</Tag>}/>},
  {key:'pa',label:'PA',value:row=>row.pa,format:value=>num(value,0)},
  {key:'avg',label:'AVG',value:row=>row.avg,format:rate,tone:row=>better(row.avg,0.2,0.3)},
  {key:'obp',label:'OBP',value:row=>row.obp,format:rate,tone:row=>better(row.obp,0.27,0.36)},
  {key:'slg',label:'SLG',value:row=>row.slg,format:rate,tone:row=>better(row.slg,0.33,0.5)},
  {key:'ops',label:'OPS',value:row=>row.ops,format:rate,tone:row=>better(row.ops,0.62,0.85)},
  {key:'hr',label:'HR',value:row=>row.hr,format:value=>num(value,0)},
  {key:'so',label:'K',value:row=>row.so,format:value=>num(value,0)},
  {key:'score',label:'Score',value:row=>row.score,render:row=><Score value={row.score} label="BvP score"/>},
 ]}/>;
}

const LEANS={nrfi:'Lean NRFI',yrfi:'Lean YRFI',toss:'Toss-up'};
function Meter({value,label}){
 return <span className="cs-meter"><i style={{'--v':finite(value)?value:0}}/><b>{finite(value)?Math.round(value*100):'—'}</b>{label&&<small>{label}</small>}</span>;
}
function Starter({side}){
 const arm=side.pitcher;
 if(!arm)return <div className="cs-sp"><strong>TBD</strong><small>{side.team}</small></div>;
 const show=value=>finite(value)?Math.round(value*100):'—';
 return <div className="cs-sp">
  <strong>{arm.name?.split(' ').at(-1)} <Hand value={arm.throws}/>{arm.last!=null&&<span className="cs-last" data-clean={arm.last?'':undefined}>{arm.last?'N':'Y'}</span>}</strong>
  <small><span data-tone={better(arm.season,0.62,0.74)}>SZN {show(arm.season)}%</span><span data-tone={better(arm.l5,0.55,0.8)}>L5 {show(arm.l5)}%</span><span data-tone={better(arm.l10,0.55,0.8)}>L10 {show(arm.l10)}%</span></small>
 </div>;
}
function NrfiSheet({data}){
 const rows=data.rows||[];
 if(!rows.length)return <p className="cs-empty">No games on this day.</p>;
 return <div className="cs-nrfi">
  <div className="cs-nrfi-head" aria-hidden="true"><span>Matchup</span><span>Model</span><span>Away SP</span><span>Home SP</span><span>Scoring in the 1st</span><span>Fair odds</span><span>Park</span></div>
  {rows.map(row=><article key={row.gamePk} className="cs-nrfi-row">
   <div className="cs-nrfi-teams"><Img className="cs-logo" src={logo(row.away.teamId)}/><span>{row.away.team}<i>@</i>{row.home.team}</span><Img className="cs-logo" src={logo(row.home.teamId)}/><small>{time(row.startsAt)}</small></div>
   <div className="cs-nrfi-model" data-lean={row.lean}><strong>{Math.round(row.chance*100)}%</strong><span>{LEANS[row.lean]}</span></div>
   <Starter side={row.away}/><Starter side={row.home}/>
   <div className="cs-nrfi-off"><Meter value={row.away.offense.season} label={`${row.away.team} · L10 ${finite(row.away.offense.l10)?Math.round(row.away.offense.l10*100):'—'}%`}/><Meter value={row.home.offense.season} label={`${row.home.team} · L10 ${finite(row.home.offense.l10)?Math.round(row.home.offense.l10*100):'—'}%`}/></div>
   <div className="cs-nrfi-odds"><span><small>NRFI</small><b>{price(row.nrfi)}</b></span><span><small>YRFI</small><b>{price(row.yrfi)}</b></span></div>
   <div className="cs-nrfi-park"><b>{signed(row.environment?.runs,value=>`${Math.round(value)}%`)}</b><small>{row.environment?.dome?'Roof':finite(row.environment?.temp)?`${Math.round(row.environment.temp)}°`:''} runs</small></div>
  </article>)}
  <p className="cs-legend"><span data-lean="nrfi">Lean NRFI</span> 56%+ scoreless <span data-lean="toss">Toss-up</span> no clear edge <span data-lean="yrfi">Lean YRFI</span> 46% or less</p>
 </div>;
}

function ParkSheet({data}){
 const rows=data.rows||[];
 if(!rows.length)return <p className="cs-empty">No games on this day.</p>;
 const cell=value=><b data-tone={finite(value)?(value>=3?'good':value<=-3?'bad':undefined):undefined}>{signed(value,item=>`${Math.round(item)}%`)}</b>;
 return <div className="cs-parks">
  {rows.map(row=><article key={row.gamePk} className="cs-park">
   <div className="cs-park-runs">{cell(row.runs)}<small>runs</small></div>
   <div className="cs-park-main">
    <strong><Img className="cs-logo" src={logo(row.homeId)}/>{row.venue}{row.dome&&<span className="cs-tag">Roof</span>}</strong>
    <small>{row.away} @ {row.home} · {time(row.startsAt)} · {row.starters.filter(Boolean).map(name=>name.split(' ').at(-1)).join(' vs ')}</small>
   </div>
   <div className="cs-park-cells">
    <span>{cell(row.hr)}<small>HR</small></span>
    <span><b>{finite(row.park)?row.park.toFixed(2):'—'}</b><small>park factor</small></span>
    <span><b>{row.dome?<Home aria-hidden="true"/>:finite(row.precip)&&row.precip>=40?<CloudRain aria-hidden="true"/>:<Sun aria-hidden="true"/>}{finite(row.temp)&&!row.dome?`${Math.round(row.temp)}°`:''}</b><small>{row.dome?'indoors':row.condition||'weather'}</small></span>
    <span><b><WindArrow effect={row.dome?null:row.windEffect}/>{!row.dome&&finite(row.wind)?`${Math.round(row.wind)}`:'—'}</b><small>{row.dome?'wind':`mph ${row.windEffect||''}`.trim()}</small></span>
   </div>
  </article>)}
  <p className="cs-legend"><b data-tone="good">Plus</b> helps hitters · <b data-tone="bad">minus</b> helps pitchers · percent against an average park</p>
 </div>;
}

function StrikeoutSheet({data,prices}){
 const rows=data.rows||[];
 const line=row=>prices?.k.get(nameKey(row.name))||null;
 return <Table rows={rows} empty="No starters named yet." moreLabel="Last starts" expand={row=><KDetail row={row}/>} columns={[
  {key:'player',label:'Pitcher',className:'cs-sticky',render:row=><Who row={{...row,pitcher:null,bats:null}}/>},
  {key:'line',label:'O/U',value:row=>line(row)?.line,render:row=>{const found=line(row);return found?<span className="cs-ou"><b>{num(found.line)}</b><small>{found.over?`o ${price(found.over.over)}`:''}{found.under?` · u ${price(found.under.under)}`:''}</small></span>:'—';}},
  {key:'k9',label:'K/9',value:row=>row.k9,format:value=>num(value),tone:row=>better(row.k9,7.5,10)},
  {key:'kRate',label:'K %',value:row=>row.kRate,format:value=>pct(value),tone:row=>better(row.kRate,0.2,0.27)},
  {key:'avgK',label:'Avg K',value:row=>row.avgK,format:value=>num(value)},
  {key:'l5K',label:'L5 K',value:row=>row.l5K,format:value=>num(value)},
  {key:'ip',label:'Proj. IP',short:'Proj IP',value:row=>row.ip,format:value=>num(value)},
  {key:'opp',label:'Opp K %',short:'Opp K%',value:row=>row.opponentK,render:row=><span className="cs-ou"><b>{pct(row.opponentK)}</b>{finite(row.opponentKRank)&&<small>{row.opponentKRank} of {row.teams}</small>}</span>,tone:row=>finite(row.opponentK)&&finite(row.leagueK)?(row.opponentK>=row.leagueK*1.06?'good':row.opponentK<=row.leagueK*0.94?'bad':undefined):undefined},
  {key:'projected',label:'Proj. K',short:'Proj K',value:row=>row.projected,render:row=>{const found=line(row);return <b className="cs-proj" data-tone={found&&finite(row.projected)?(row.projected>found.line?'good':'bad'):undefined}>{num(row.projected)}</b>;}},
  {key:'score',label:'K score',value:row=>row.score,render:row=><Score value={row.score} label="K matchup score"/>},
 ]}/>;
}
function KDetail({row}){
 const top=Math.max(9,...row.starts.map(start=>start.k));
 return <div className="cs-kdetail">
  <div className="cs-kbars" role="img" aria-label={`Strikeouts in his last ${row.starts.length} starts`}>{row.starts.map((start,index)=><span key={index} style={{'--h':`${Math.max(start.k/top*100,4)}%`}}>
   <b>{start.k}</b><i/><small>{num(start.ip)} IP</small>
  </span>)}</div>
  <p>{row.name.split(' ').at(-1)} strikes out {pct(row.kRate)}% of batters{finite(row.l5K)?` and has averaged ${num(row.l5K)} over his last ${row.starts.length}`:''}. {row.opponent} strike out {pct(row.opponentK)}% against {row.throws==='L'?'lefties':'righties'}{finite(row.opponentKRank)?` (${row.opponentKRank} of ${row.teams})`:''}, against a league {pct(row.leagueK)}%. Over about {num(row.ip)} innings that projects to {num(row.projected)} strikeouts.</p>
 </div>;
}

const STREAK_ORDER=['hits','onbase','tb2','hr','bb','sb','k'];
const STREAK_LABEL={hits:'1+ Hits',onbase:'On base',tb2:'2+ TB',hr:'1+ HR',bb:'1+ BB',sb:'1+ SB',k:'1+ K'};
function StreaksSheet({data,filter}){
 const [kind,setKind]=useState('hits');
 const rows=(data.streaks?.[kind]?.rows||[]).filter(filter);
 return <div className="cs-streaks">
  <div className="cs-seg cs-scroll" role="tablist">{STREAK_ORDER.map(key=><button key={key} type="button" role="tab" aria-selected={key===kind} data-active={key===kind?'':undefined} onClick={()=>setKind(key)}>{STREAK_LABEL[key]}<small>{data.streaks?.[key]?.rows?.length||0}</small></button>)}</div>
  {rows.length?<div className="cs-streak-grid">{rows.map((row,index)=><article key={row.id} className="cs-streak" style={{'--i':index}}>
   <Face id={row.id} name={row.name} teamId={row.teamId}/>
   <span className="cs-streak-count">{row.streak}</span>
   <div><strong>{row.name}</strong><small>{row.team} · {row.home?'vs':'@'} {row.opponent} · {time(row.startsAt)}</small>
    <span className="cs-streak-bar" aria-label={`${row.recent.filter(Boolean).length} of the last ${row.recent.length}`}>{row.recent.map((hit,step)=><i key={step} data-hit={hit?'':undefined} data-last={step===row.recent.length-1?'':undefined}/>)}</span>
   </div>
  </article>)}</div>:<p className="cs-empty">No active streaks of this kind.</p>}
  <p className="cs-legend"><i data-hit=""/> hit <i/> miss · oldest on the left, brightest is the last game</p>
 </div>;
}

// ---------------------------------------------------------------- page

function Hub({sheets,onOpen}){
 if(!sheets.length)return <p className="cs-empty">No sheets are open for this league right now.</p>;
 return <div className="cs-grid">{sheets.map((sheet,index)=>{const Icon=sheet.icon;return <button key={sheet.key} type="button" className="cs-tile" onClick={()=>onOpen(sheet.key)} style={{'--i':index}}>
  <span className="cs-tile-top"><span className="cs-icon"><Icon aria-hidden="true"/></span><ArrowUpRight className="cs-tile-go" aria-hidden="true"/></span>
  <strong>{sheet.title}</strong>
  <span>{sheet.blurb}</span>
  <small>{sheet.kicker}</small>
 </button>;})}</div>;
}

function SheetView({sheetKey,sheets,onOpen}){
 const sheet=sheets.find(item=>item.key===sheetKey)||sheets[0];
 const [day,setDay]=useState('today');
 const [state,setState]=useState({loading:true,data:null,error:null});
 const [game,setGame]=useState('all');
 const [query,setQuery]=useState('');
 const prices=usePrices(sheet.key==='hr'||sheet.key==='strikeouts');
 const load=(force=false)=>{
  setState(current=>({...current,loading:true,error:null}));
  fetchSheet(sheet.key,day,force).then(data=>setState({loading:false,data,error:null})).catch(error=>setState({loading:false,data:null,error:error.message}));
 };
 useEffect(()=>{setGame('all');load();},[sheet.key,day]);
 // Only this sheet's data: while the next one loads, the last one's never feeds it.
 const data=state.data?.sheet===sheet.key?state.data:null;
 const filter=useMemo(()=>{const wanted=nameKey(query);return row=>(game==='all'||String(row.gamePk)===game)&&(!wanted||nameKey(row.name).includes(wanted));},[game,query]);
 const listed=['hr','hot','bvp','streaks'].includes(sheet.key);
 const projected=data&&data.games?.length&&data.games.some(item=>!item.confirmed);
 const games=data?.games?.length||0;
 return <div className="cs-view">
  <nav className="cs-tabs" aria-label="Sheets">{sheets.map(item=>{const ItemIcon=item.icon;return <button key={item.key} type="button" aria-current={item.key===sheet.key?'page':undefined} data-active={item.key===sheet.key?'':undefined} onClick={()=>onOpen(item.key)}>
   <ItemIcon aria-hidden="true"/>{item.title}
  </button>;})}</nav>
  <section className="cs-sheet">
   <header className="cs-sheet-head">
    <div className="cs-sheet-title"><h2>{sheet.title}</h2><p>{sheet.blurb}</p>
     <small>{data?<>{dayLabel(data.day)}<i>·</i>{games} game{games===1?'':'s'}<i>·</i>updated {time(data.updatedAt)}</>:'Loading…'}</small></div>
    <div className="cs-sheet-actions">
     <div className="cs-seg" role="tablist" aria-label="Day">{[['today','Today',Sun],['tomorrow','Tomorrow',Moon]].map(([key,label,DayIcon])=><button key={key} type="button" role="tab" aria-selected={day===key} data-active={day===key?'':undefined} onClick={()=>setDay(key)}><DayIcon aria-hidden="true"/>{label}</button>)}</div>
     <button type="button" className="cs-icon-btn" onClick={()=>load(true)} aria-label="Refresh" disabled={state.loading}><RefreshCw data-spin={state.loading?'':undefined} aria-hidden="true"/></button>
    </div>
   </header>
   {listed&&data&&<div className="cs-filters">
    <div className="cs-chips-row cs-scroll" role="tablist" aria-label="Game"><button type="button" data-active={game==='all'?'':undefined} onClick={()=>setGame('all')}>All games</button>
     {data.games.map(item=><button key={item.gamePk} type="button" data-active={game===String(item.gamePk)?'':undefined} onClick={()=>setGame(String(item.gamePk))}><Img className="cs-logo" src={logo(item.awayId)}/>{item.away}<i>@</i><Img className="cs-logo" src={logo(item.homeId)}/>{item.home}</button>)}</div>
    <label className="cs-search"><Search aria-hidden="true"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find a player" aria-label="Find a player"/></label>
   </div>}
   {projected&&['hr','matchups','bvp'].includes(sheet.key)&&<p className="cs-note"><Info aria-hidden="true"/>Some lineups aren't posted yet, so those teams show their active hitters.</p>}
   <div className="cs-body" data-loading={state.loading?'':undefined}>
    {state.error?<div className="cs-error"><p>{state.error}</p><button type="button" onClick={()=>load(true)}>Try again</button></div>
     :!data?<Skeleton/>
     :sheet.key==='hr'?<HrSheet data={data} filter={filter} prices={prices}/>
     :sheet.key==='hot'?<HotSheet data={data} filter={filter}/>
     :sheet.key==='matchups'?<MatchupsSheet data={data}/>
     :sheet.key==='bvp'?<BvpSheet data={data} filter={filter}/>
     :sheet.key==='nrfi'?<NrfiSheet data={data}/>
     :sheet.key==='park'?<ParkSheet data={data}/>
     :sheet.key==='strikeouts'?<StrikeoutSheet data={data} prices={prices}/>
     :<StreaksSheet data={data} filter={filter}/>}
   </div>
   <Faq items={[['What\'s on this sheet?',sheet.about],...(FAQ[sheet.key]||[])]}/>
  </section>
 </div>;
}


// The league and sheet in the address, so a sheet can be shared and Back
// works: #hr (an MLB sheet, as before), #nfl for the NFL sheets, #nfl/dvp.
const LEAGUES={mlb:SHEETS,nfl:NFL_SHEETS};
const LEAGUE_NOTE={mlb:count=>`Today's MLB slate, read ${count} ways. Updated through the day.`,
 nfl:count=>`This week's NFL games, read ${count} ways. Updated through the week.`};
function readRoute(){
 const [first,second]=location.hash.slice(1).split('/');
 if(first==='nfl')return {league:'nfl',sheet:NFL_SHEETS.some(item=>item.key===second)?second:null};
 if(first==='mlb')return {league:'mlb',sheet:SHEETS.some(item=>item.key===second)?second:null};
 return {league:null,sheet:SHEETS.some(item=>item.key===first)?first:null};
}
const hashFor=(league,sheet)=>league==='mlb'?(sheet||'mlb'):sheet?`${league}/${sheet}`:league;

export function CheatSheets(){
 const [route,setRoute]=useState(readRoute);
 // Which sheets a member sees is an admin switch per sheet; re-read whenever
 // the site's settings change.
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  const sync=()=>setRoute(readRoute());
  const bump=()=>setRevision(value=>value+1);
  window.addEventListener('hashchange',sync);
  window.addEventListener('popstate',sync);
  window.addEventListener('vortex:site-policy',bump);
  return()=>{window.removeEventListener('hashchange',sync);window.removeEventListener('popstate',sync);window.removeEventListener('vortex:site-policy',bump);};
 },[]);
 const open=useMemo(()=>Object.fromEntries(Object.entries(LEAGUES).map(([league,list])=>[league,list.filter(item=>siteSheetAllowed(`${league}:${item.key}`))])),[revision]);
 const league=route.league&&open[route.league]?.length?route.league:route.sheet?'mlb':Object.keys(LEAGUES).find(key=>open[key].length)||'mlb';
 const sheets=open[league];
 const sheet=route.sheet&&sheets.some(item=>item.key===route.sheet)?route.sheet:null;
 const go=(nextLeague,key)=>{
  if(nextLeague===league&&key===sheet)return;
  const url=new URL(location.href);url.hash=hashFor(nextLeague,key);
  history.pushState(history.state,'',url);
  setRoute({league:nextLeague,sheet:key});
  document.getElementById('panel-sheets')?.scrollIntoView({block:'start'});
 };
 return <div className="cheat-sheets">
  <header className="cs-top" data-sheet={sheet?'':undefined}>
   {sheet?<button type="button" className="cs-back" onClick={()=>go(league,null)}><ArrowLeft aria-hidden="true"/>Cheat Sheets</button>
    :<div className="cs-top-title"><h1>Cheat Sheets</h1><p>{LEAGUE_NOTE[league](sheets.length)}</p></div>}
   <div className="cs-sports" role="tablist" aria-label="Sport">{SPORTS.map(sport=>{const live=Boolean(open[sport.key]?.length);return <button key={sport.key} type="button" role="tab" aria-selected={sport.key===league} data-active={sport.key===league?'':undefined} disabled={!live} onClick={()=>go(sport.key,null)}>
    {sport.label}{!live&&<small>Soon</small>}
   </button>;})}</div>
  </header>
  {sheet?(league==='nfl'?<NflSheetView sheetKey={sheet} sheets={sheets} onOpen={key=>go('nfl',key)}/>:<SheetView sheetKey={sheet} sheets={sheets} onOpen={key=>go('mlb',key)}/>)
   :<Hub sheets={sheets} onOpen={key=>go(league,key)}/>}
 </div>;
}
