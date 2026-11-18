// The NBA Props tab's model check (admin only; Phase 0 of the NBA prop model
// work). What is being recorded before each game (prop_snapshots.py) and how
// the production grades have done against real PrizePicks lines
// (prop_eval.py): log loss, Brier score, calibration and hit rates, Over and
// Under apart, against simple baselines and DraftKings. Reads only.
import React,{useEffect,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import './model-check.css';

const DAYS=[14,30,60];
const MODEL_NAMES={production:'Our grade',line:'Line only',average:'Player average',coin:'Coin flip',draftkings:'DraftKings'};
const MARKETS={player_points:'PTS',player_rebounds:'REB',player_assists:'AST',player_threes:'3PM',player_steals:'STL',player_blocks:'BLK',
 player_points_rebounds:'P+R',player_points_assists:'P+A',player_points_rebounds_assists:'PRA'};
const TIER_NAMES={elite:'Elite',strong:'Strong',lean:'Lean',risky:'Risky',fade:'Fade'};
const SOURCES=[['job','Snapshot job'],['list','Props list']];

const pct=(value,digits=1)=>Number.isFinite(value)?`${(value*100).toFixed(digits)}%`:'–';
const num=(value,digits=4)=>Number.isFinite(value)?value.toFixed(digits):'–';
const range=(ci,format=num)=>Array.isArray(ci)?`${format(ci[0])} to ${format(ci[1])}`:'';
const signed=value=>Number.isFinite(value)?`${value>0?'+':''}${value.toFixed(4)}`:'–';
const time=seconds=>Number.isFinite(seconds)&&seconds>0?new Date(seconds*1000).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'–';

async function loadCheck(days,fresh){
 const response=await fetch(`/api/v2-admin?action=nba-prop-eval&days=${days}${fresh?'&fresh=1':''}`,{credentials:'same-origin',cache:'no-store'});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(body.error||`HTTP ${response.status}`);
 return body;
}

function Table({head,rows,note}){
 return <div className="mc-table"><table>
  <thead><tr>{head.map((cell,index)=><th key={index} scope="col">{cell}</th>)}</tr></thead>
  <tbody>{rows.map((row,index)=><tr key={index}>{row.map((cell,cellIndex)=>cellIndex===0?<th key={cellIndex} scope="row">{cell}</th>:<td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
 </table>{note&&<p className="mc-note">{note}</p>}</div>;
}

const Rate=({value,ci})=><span className="mc-rate"><i style={{width:`${Math.max(0,Math.min(100,(value||0)*100))}%`}}/><b>{pct(value)}</b>{ci&&<small>{range(ci,value=>pct(value,0))}</small>}</span>;

function CaptureCoverage({data}){
 if(!data?.eligible)return null;
 const markets=Object.entries(MARKETS).filter(([key])=>data[`eligible.${key}`]);
 const tiers=Object.entries(TIER_NAMES).filter(([key])=>data[`overTier.${key}`]||data[`underTier.${key}`]);
 return <details>
  <summary>Latest run graded both sides for {data.bothSides??0} of {data.eligible} eligible standard lines</summary>
  <Table head={['Stat','Eligible','Both grades','DraftKings']} rows={markets.map(([key,name])=>
   [name,data[`eligible.${key}`],data[`bothSides.${key}`]??0,data[`draftKings.${key}`]??0])}/>
  {tiers.length>0&&<Table head={['Tier','Over grades','Under grades']} rows={tiers.map(([key,name])=>
   [name,data[`overTier.${key}`]??0,data[`underTier.${key}`]??0])}/>}
 </details>;
}

function Recording({recording}){
 if(!recording)return null;
 if(recording.error)return <p className="mc-note">{recording.error}</p>;
 const status=recording.status||{};
 const run=status.run,reports=status.reports,lines=status.lines,attempt=status.attempt;
 return <section className="mc-block" aria-label="What is being recorded">
  <h3>What is being recorded</h3>
  <div className="mc-tiles">
   <div><span>Graded runs</span><b>{run?time(run.at):'None yet'}</b><small>{run?`${run.rows} lines · model ${run.model||'–'} · code ${String(run.sha||'').slice(0,7)}`:'The snapshot job posts before each night'}</small></div>
   <div><span>Line changes</span><b>{lines?time(lines.at):'None yet'}</b><small>{lines?`${lines.lines} lines in the last feed`:'Kept as PrizePicks moves them'}</small></div>
   <div><span>Injury reports</span><b>{reports?time(reports.at):'None yet'}</b><small>{reports?`${reports.games} games · ${reports.changed} changed · ${reports.stale} stale · ${reports.missing} missing`:'Checked every 10 minutes'}</small></div>
   <div><span>Storage keys</span><b>{recording.keys??'–'}</b><small>{attempt?`Last failed run ${time(attempt.at)}`:'No failed runs'}</small></div>
  </div>
  {(recording.days||[]).map(day=><div key={day.day} className="mc-day">
   <h4>{day.day}</h4>
   <p className="mc-note">{day.grades.lines} graded lines ({day.grades.changed} changed between runs) · {day.lines.tracked} PrizePicks lines tracked, {day.lines.moved} moved, {day.lines.pulled} taken down · {day.reports.events} report versions ({Object.entries(day.reports.kinds||{}).map(([kind,count])=>`${kind} ${count}`).join(', ')||'none'}) · {day.runs.length} runs · {Math.round((day.bytes?.grades||0)/1024)} KB of grades</p>
   <CaptureCoverage data={day.runs.at(-1)?.data}/>
   {day.grades.sample.length>0&&<Table head={['Player','Stat','Line','Over','Under','Tier','Proj.','DK','Seen']}
    rows={day.grades.sample.map(row=>[row.pl,`${MARKETS[row.mk]||row.mk}${row.md!=='standard'?` ${row.md}`:''}`,row.ln,pct(row.o?.[0]),pct(row.u?.[0]),TIER_NAMES[row.o?.[3]]||'–',
     num(row.pj,1),pct(row.dk?.[0]),`${time(row.first)} – ${time(row.last)}`])}/>}
  </div>)}
  {(recording.health||[]).length>0&&<><h4>Problems logged</h4><ul className="mc-log">{recording.health.slice(0,12).map((item,index)=>
   <li key={index} data-level={item.level}><time>{time(item.at)}</time><span>{item.text}</span></li>)}</ul></>}
 </section>;
}

function Side({side,label}){
 if(!side||!side.n)return <p className="mc-note">No settled {label} lines yet.</p>;
 const models=side.summary||[];
 return <>
  <p className="mc-note">{side.n} lines · {side.playerGames} player-games · {side.nights} nights · {label} hit {pct(side.hitRate)}. Ranges are 95%, resampling whole player-games.</p>
  <Table head={['Model','Log loss','Brier','Ours less this (log loss)','Lines']} rows={models.map(model=>[MODEL_NAMES[model.model]||model.model,
   <>{num(model.logLoss)}<small>{range(model.logLossCI)}</small></>,<>{num(model.brier)}<small>{range(model.brierCI)}</small></>,
   model.model==='production'?'–':<>{signed(model.logLossVsProduction)}<small>{range(model.logLossVsProductionCI)}{model.logLossVsProductionNightCI?` · by night ${range(model.logLossVsProductionNightCI)}`:''}</small></>,
   model.n])} note="Lower is better. A negative difference means our grade beat that model on the same lines; it counts only when the whole range is below zero."/>
  <h4>Calibration</h4>
  <Table head={['Our chance','Lines','Average chance','Hit']} rows={(side.calibration||[]).map(band=>[`${pct(band.band[0],0)}–${pct(Math.min(1,band.band[1]),0)}`,
   band.n,pct(band.meanChance),<Rate value={band.hitRate} ci={band.hitRateCI}/>])}
   note={side.fit?`Calibration slope ${side.fit.slope} (1 is right; below 1, the chances are too far from 50%) · intercept ${side.fit.intercept} · average gap ${pct(side.ece)}`:''}/>
  {side.tiers?.length>0&&<><h4>By tier</h4><Table head={['Tier','Lines','Player-games','Average chance','Hit']}
   rows={side.tiers.map(item=>[TIER_NAMES[item.tier]||item.tier,item.n,item.playerGames,pct(item.meanChance),<Rate value={item.hitRate} ci={item.hitRateCI}/>])}/></>}
  {side.thresholds?.length>0&&<><h4>By chance</h4><Table head={['Chance at least','Lines','Player-games','Hit']}
   rows={side.thresholds.map(item=>[pct(item.atLeast,0),item.n,item.playerGames,<Rate value={item.hitRate} ci={item.hitRateCI}/>])}
/></>}
  {side.markets?.length>0&&<><h4>By stat</h4><Table head={['Stat','Lines','Average chance','Hit','Log loss','Brier']}
   rows={side.markets.map(item=>[MARKETS[item.market]||item.market,item.n,pct(item.meanChance),<Rate value={item.hitRate} ci={item.hitRateCI}/>,num(item.logLoss),num(item.brier)])}/></>}
  {side.gaps?.length>0&&<><h4>By gap to the line</h4><Table head={['Gap','From','Lines','Average chance','Hit']}
   rows={side.gaps.map(item=>[`${item.gap[0]==null?'below':pct(item.gap[0],0)} to ${item.gap[1]==null?'above':pct(item.gap[1],0)}`,item.by==='projection'?'Our projection':'His average',
    item.n,pct(item.meanChance),<Rate value={item.hitRate} ci={item.hitRateCI}/>])}/></>}
 </>;
}

function Source({source,name}){
 const [side,setSide]=useState('over');
 if(!source)return null;
 if(!source.lines)return <p className="mc-note">{name}: no settled lines in this window yet.{source.missingResults>0&&` Results missing for ${source.missingResults} lines.`}</p>;
 const favored=source.favored||{};
 return <>
  <p className="mc-note">{source.from} to {source.to} · {source.standard} standard lines · {source.duplicatesRemoved} duplicate lines removed · {source.void} void (didn’t play) · {source.pushes} pushes left out.{source.missingResults>0&&` Results missing for ${source.missingResults} lines.`}</p>
  {favored.n>0&&<p className="mc-note">The side our grade favored won {pct(favored.right)} of {favored.n} ({range(favored.rightCI,value=>pct(value,1))}){Number.isFinite(favored.averageRight)?`; the player average’s side ${pct(favored.averageRight)}`:''}. Overs went {pct(favored.overRate)}; we favored the Over on {pct(favored.overPicked)}.</p>}
  <div className="mc-switch" role="group" aria-label="Side">{[['over','Over'],['under','Under']].map(([key,text])=>
   <button type="button" key={key} aria-pressed={side===key} onClick={()=>setSide(key)}>{text}</button>)}</div>
  <Side side={source[side]} label={side==='over'?'Over':'Under'}/>
  {source.timeline?.length>0&&<><h4>Accuracy by night</h4><Table head={['Night','Picks','Correct','Over picked']}
   rows={source.timeline.map(item=>[item.day,item.n,<Rate value={item.right} ci={item.rightCI}/>,pct(item.overPicked)])}/></>}
  {source.errors?.length>0&&<><h4>Projection error</h4><Table head={['Stat','Lines','Average miss','RMSE','Bias','Line’s miss','Average’s miss']}
   rows={source.errors.map(item=>[MARKETS[item.market]||item.market,item.n,num(item.mae,2),num(item.rmse,2),num(item.bias,2),num(item.lineMae,2),num(item.averageMae,2)])}/></>}
  {['goblin','demon'].map(kind=>source.specials?.[kind]?.n>0&&<p key={kind} className="mc-note">{kind==='goblin'?'Goblins':'Demons'} (Over only): {source.specials[kind].n} lines hit {pct(source.specials[kind].hitRate)}; our average chance {pct((source.specials[kind].summary||[])[0]?.meanChance)}; log loss {num((source.specials[kind].summary||[])[0]?.logLoss)}.</p>)}
 </>;
}

export default function ModelCheck(){
 const [days,setDays]=useState(30);
 const [state,setState]=useState({loading:true});
 const [source,setSource]=useState('list');
 const load=fresh=>{setState(current=>({...current,loading:true,error:null}));
  loadCheck(days,fresh).then(body=>{setState({loading:false,body});if(body?.evaluation?.job?.lines)setSource('job');})
   .catch(error=>setState({loading:false,error:error.message}));};
 useEffect(()=>{load(false);},[days]); // eslint-disable-line react-hooks/exhaustive-deps
 const evaluation=state.body?.evaluation;
 return <div className="mc">
  <header className="mc-head"><h3>Model check</h3><small>Admin</small>
   <div className="mc-switch" role="group" aria-label="Nights">{DAYS.map(value=><button type="button" key={value} aria-pressed={days===value} onClick={()=>setDays(value)}>{value} nights</button>)}</div>
   <button type="button" className="mc-refresh" onClick={()=>load(true)} disabled={state.loading} aria-label="Work it out again"><RefreshCw size={14} className={state.loading?'nm-spin':undefined}/></button>
  </header>
  {state.error&&<p className="mc-note">{state.error}</p>}
  {state.loading&&!state.body&&<p className="mc-note">Working it out…</p>}
  <Recording recording={state.body?.recording}/>
  {evaluation&&(evaluation.error?<p className="mc-note">{evaluation.error}</p>:<section className="mc-block" aria-label="How the grades have done">
   <h3>How the grades have done</h3>
   <p className="mc-note">Real PrizePicks lines, settled from the box scores. Worked out {time(evaluation.generatedAt)} in {evaluation.seconds}s. Baselines use earlier nights only.</p>
   <div className="mc-switch" role="group" aria-label="Record">{SOURCES.map(([key,text])=>
    <button type="button" key={key} aria-pressed={source===key} onClick={()=>setSource(key)}>{text}<small>{evaluation[key]?.standard??0}</small></button>)}</div>
   <p className="mc-note">{source==='job'?'Grades worked out on a schedule before each game by the site’s own code, both sides.':'What the Props list showed, its last report before each game. Its Under is 1 minus its Over.'}</p>
   <Source key={source} source={evaluation[source]} name={SOURCES.find(([key])=>key===source)[1]}/>
  </section>)}
 </div>;
}
