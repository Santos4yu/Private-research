import React,{useEffect,useMemo,useState} from 'react';
import {Trophy,Users,ChartPie,CloudSun,ListOrdered,RefreshCw,Target,Wind,Droplets,CloudRain,TrendingUp,Minus,TrendingDown,Activity} from 'lucide-react';
import {createMLBContextClient,researchParams,statText,lineupState,battingBand,mergeLineupSplits} from './mlb-finder-research';
import './mlb-finder-context.css';
import MLBWinPredictor from './MLBWinPredictor';
import MLBPitcherArsenal from './MLBPitcherArsenal';
import MLBInjuries from './MLBInjuries';
import MLBStarterComparison from './MLBStarterComparison';
import {HeartPulse} from 'lucide-react';

const request=createMLBContextClient();
const tabs=[['matchup','Matchup',Trophy],['lineups','Lineups',Users],['arsenal','Pitch arsenal',ChartPie],['injuries','Injuries',HeartPulse],['rankings','Rankings',ListOrdered],['weather','Weather',CloudSun]];
const palette=['#28cb98','#ff5869','#9170ff','#f4b847','#51aaff','#55d8df'];
function Card({title,note,children,icon:Icon=Activity}){return <section className="mlb-context-card"><header><h2><Icon size={16} aria-hidden="true"/>{title}</h2>{note&&<small>{note}</small>}</header>{children}</section>;}
function Empty({children}){return <p className="mlb-context-note">{children}</p>;}
function Skeleton(){return <div className="mlb-context-skeleton" role="status" aria-label="Loading research"><span/><span/><span/><span/></div>;}
function Portrait({id}){return id?<img className="mlb-context-photo" src={`https://img.mlbstatic.com/mlb-photos/image/upload/w_100,q_auto:best/v1/people/${encodeURIComponent(id)}/headshot/silo/current`} alt="" width="30" height="30" loading="lazy" onError={e=>{e.currentTarget.style.visibility='hidden';}}/>:null;}
function BattingValue({stat,value,ab,bvp=false}){
 const band=battingBand(stat,value,ab,bvp),Icon=band.tone==='good'?TrendingUp:band.tone==='poor'?TrendingDown:Minus;
 return <span className="mlb-stat-pill" data-tone={band.tone} aria-label={`${stat}: ${statText(value,stat==='k_pct'?1:3)}${band.label?', '+band.label:''}`} title={band.label}><Icon size={11} aria-hidden="true"/>{statText(value,stat==='k_pct'?1:3)}{stat==='k_pct'&&value!=null?'%':''}</span>;
}
function Starter({data}){
 const p=data.starterProfile||{};
 const metrics=[['Record',p.wins!=null&&p.losses!=null?`${p.wins}–${p.losses}`:'—'],['Innings pitched',statText(p.inningsPitched)],['Earned runs allowed per 9',statText(p.era,2)],['Strikeouts per 9',statText(p.kPer9,2)],['Walks per 9',statText(p.bbPer9,2)],['Walks + hits per inning pitched',statText(p.whip,2)],['Home runs allowed per 9',statText(p.hrPer9,2)],['Batting average against',statText(p.avgAgainst,3)],['OPS against',statText(p.opsAgainst,3)]];
 return <section className="mlb-context-card mlb-starter-card"><header><h2><Target size={15} aria-hidden="true"/>{data.isPitcherProp?'Starting pitcher':'Opposing starter'}</h2><span className="mlb-starter-season">{data.researchSeason||'Season'}</span></header><table className="mlb-starter-table"><thead><tr><th scope="col"><span className="mlb-starter-identity"><Portrait id={p.id}/><strong>{p.name||'Starter not announced'}</strong><small>{['R','L'].includes(p.hand)?p.hand+'HP':'Hand unavailable'}</small></span></th><th scope="col">{data.researchSeason||'Season'}</th></tr></thead><tbody>{metrics.map(([label,value])=><tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}</tbody></table><footer className="mlb-starter-footer">Season pitching totals <span>— Not available</span></footer></section>;
}
function Lineup({data,team,loading,error,onRetry,split,setSplit}){
 const rows=data?.battingOrder||[];
 return <Card title="Batting order & stats" note={team} icon={Users}>
  <div className="mlb-context-switch" aria-label="Batting split">{[['season','Season'],['handSplitL','vs LHP'],['handSplitR','vs RHP'],['vsPitcher','vs starter']].map(([key,label])=><button type="button" key={key} aria-pressed={split===key} onClick={()=>setSplit(key)}>{label}</button>)}</div>
  <Empty>{data?lineupState(data):'Checking batting order…'}{data?.source?.season?' · '+data.source.season:''}</Empty>
  <div className="mlb-stat-legend"><span data-tone="good"><TrendingUp size={12}/>Strong</span><span data-tone="fair"><Minus size={12}/>Moderate</span><span data-tone="poor"><TrendingDown size={12}/>Low</span><span>Batting performance</span></div>
  {error&&<Empty>{error} <button type="button" onClick={onRetry}>Retry</button></Empty>}
  {loading?<Skeleton/>:rows.length?<div className="mlb-context-table-wrap"><table><thead><tr>{['Player','AB','H','AVG','HR','RBI','OPS','K%'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map(p=>{const s=p[split]||{};return <tr key={p.id}><th scope="row"><span className="mlb-context-batter">{data.lineupConfirmed||data.lineupProjected?<small>{p.order}</small>:null}<Portrait id={p.id}/><span>{p.name}<small>{p.position}</small></span></span></th>{['ab','hits','avg','hr','rbi','ops','k_pct'].map(key=><td key={key}>{['avg','ops','k_pct'].includes(key)?<BattingValue stat={key} value={s[key]} ab={s.ab} bvp={split==='vsPitcher'}/>:statText(s[key])}</td>)}</tr>;})}</tbody></table></div>:!error&&<Empty>No batting order is available yet.</Empty>}
 </Card>;
}
function Arsenal({data}){
 if(data.isPitcherProp)return <MLBPitcherArsenal data={data}/>;
 const pitches=(data.pitchArsenal||[]).filter(p=>Number.isFinite(Number(p.pct))&&Number(p.pct)>0);
 let cursor=0;
 const segments=pitches.map((p,i)=>{const start=cursor;cursor+=Number(p.pct);return `${palette[i%palette.length]} ${start}% ${cursor}%`;});
 if(cursor<100)segments.push(`#263049 ${cursor}% 100%`);
 return <Card title="Pitch arsenal" note={data.starterProfile?.name} icon={ChartPie}>{pitches.length?<><div className="mlb-arsenal-summary"><div className="mlb-arsenal-ring" role="img" aria-label={pitches.map(p=>`${p.name} ${p.pct}%`).join(', ')} style={{background:`conic-gradient(${segments.join(',')})`}}><span>{data.researchSeason||'Mix'}</span></div><ul>{pitches.map((p,i)=><li key={p.code||p.name}><i style={{background:palette[i%palette.length]}}/><span>{p.name}<span className="mlb-pitch-track"><i style={{width:`${Math.min(100,Number(p.pct))}%`,background:palette[i%palette.length]}}/></span></span><b>{statText(p.pct,1)}%</b></li>)}</ul></div><div className="mlb-context-table-wrap"><table><thead><tr><th>Pitch</th><th>MPH</th><th>Batter AVG</th><th>wOBA</th><th>PA</th></tr></thead><tbody>{pitches.map(p=><tr key={p.code||p.name}><th scope="row">{p.name}</th><td>{statText(p.speed,1)}</td><td>{statText(p.batterVs?.avg,3)}</td><td>{statText(p.batterVs?.woba,3)}</td><td>{statText(p.batterVs?.pa)}</td></tr>)}</tbody></table></div></>:<Empty>Pitch-mix data is not available for this starter.</Empty>}</Card>;
}
function Rankings({data}){const p=data.opponentOffense||{};return <Card title="Opponent batting rankings" note={p.team_name||data.matchup?.opponent} icon={ListOrdered}>{p.metrics?.length?<><div className="mlb-ranking-list">{p.metrics.map(m=><div key={m.key}><div><strong>{m.label}</strong><b>{m.display??statText(m.value)}</b><span className="mlb-context-edge" data-edge={m.edge}>{m.edge_label||'Neutral'}</span></div><div className="mlb-rank-track" aria-hidden="true"><i style={{width:m.rank!=null?`${Math.max(0,Math.min(100,(31-Number(m.rank))/30*100))}%`:'0%'}}/></div><small>{m.rank!=null?`Rank ${m.rank} of 30`:'Rank unavailable'}</small></div>)}</div></>:<Empty>Opponent batting rankings are not available for this selection.</Empty>}</Card>;}
function Weather({data}){const w=data.ballparkWeather;return <Card title="Ballpark weather" note={w?.venue} icon={CloudSun}>{w&&!w.error?<><div className="mlb-weather-hero"><CloudSun size={36} aria-hidden="true"/><strong>{w.temp_f==null?'—':`${statText(w.temp_f)}°F`}</strong><span>{w.roof_pending?'Roof unconfirmed':w.dome?'Indoor / covered':w.roof_status||'Outdoor'}</span></div><dl className="mlb-weather-grid">{[[Wind,'Wind',w.speed_mph,' mph'],[Droplets,'Humidity',w.humidity_pct,'%'],[CloudRain,'Rain chance',w.rain_probability,'%']].map(([Icon,label,value,unit])=><div key={label}><Icon size={20} aria-hidden="true"/><dt>{label}</dt><dd>{value==null?'—':statText(value)+unit}</dd></div>)}</dl><Empty>{w.effect||data.wind||'Wind direction unavailable.'}</Empty></>:<Empty>Game-time weather is not available.</Empty>}</Card>;}
function Averages({data,row}){
 const metrics=[['Home',data.split?.homeAvg],['Away',data.split?.roadAvg],['L10',row.windows?.l10?.average],['L20',row.windows?.l20?.average]];
 const max=Math.max(1,...metrics.map(([,v])=>Number(v)||0),Number(row.line)||0);
 return <Card title="Prop averages" note={row.market} icon={Activity}><div className="mlb-average-grid">{metrics.map(([label,value])=><div key={label}><span>{label}</span><strong>{statText(value,2)}</strong><div className="mlb-average-track" aria-hidden="true"><i style={{width:value==null?'0%':`${Math.max(0,Number(value))/max*100}%`}}/></div></div>)}</div>{data.seasonLine&&<Empty>{data.seasonLine}</Empty>}</Card>;
}
export default function MLBFinderContext({row}){
 const params=useMemo(()=>researchParams(row),[row.player,row.playerId,row.teamId,row.market,row.line,row.direction]);
 const [tab,setTab]=useState('matchup'),[retry,setRetry]=useState(0),[state,setState]=useState({}),[lineup,setLineup]=useState({}),[splits,setSplits]=useState({}),[split,setSplit]=useState('season');
 useEffect(()=>{let active=true;setState({loading:true});setLineup({});setSplits({});setSplit('season');request('/api/prediction',params).then(data=>{if(active)setState({data});}).catch(()=>{if(active)setState({error:'Research is temporarily unavailable. Please retry.'});});return()=>{active=false;};},[params,retry]);
 const teamParams=state.data?.teamInsightsParams;
 // Preload season stats without waiting on arsenal, arm-slot or career work.
 useEffect(()=>{if(!teamParams)return;let active=true;setLineup({loading:true});request('/api/team-insights',{...teamParams,detail:'summary'}).then(data=>{if(active)setLineup({data});}).catch(()=>{if(active)setLineup({error:'Lineup statistics are temporarily unavailable.'});});return()=>{active=false;};},[teamParams,retry]);
 // Warm splits on opening Lineups; the season table stays interactive.
 useEffect(()=>{if(!teamParams||(tab!=='lineups'&&!(state.data?.isPitcherProp&&tab==='matchup'&&split!=='season')))return;let active=true;setSplits({loading:true});request('/api/team-insights',{...teamParams,detail:'filters'}).then(data=>{if(active)setSplits({data});}).catch(()=>{if(active)setSplits({error:'Batting splits are temporarily unavailable.'});});return()=>{active=false;};},[tab,teamParams,retry,split,state.data?.isPitcherProp]);
 const data=state.data,merged=useMemo(()=>mergeLineupSplits(lineup.data,splits.data),[lineup.data,splits.data]);
 return <aside className="mlb-finder-context" data-tab={tab} aria-label="MLB matchup research"><nav className="mlb-context-tabs" aria-label="Research sections">{tabs.map(([key,label,Icon])=><button key={key} data-section={key} type="button" aria-pressed={tab===key} onClick={()=>setTab(key)}><Icon size={18} aria-hidden="true"/>{label}</button>)}</nav>
 {tab==='injuries'?<MLBInjuries row={row} data={data}/>:state.loading?<Card title="MLB research"><Skeleton/></Card>:state.error?<Card title="Research unavailable"><Empty>{state.error}</Empty><button type="button" className="mlb-context-retry" onClick={()=>setRetry(n=>n+1)}><RefreshCw size={15}/>Retry</button></Card>:data?<>
  {tab==='matchup'&&<><MLBStarterComparison data={data}/>{!data.isPitcherProp&&<Card title="Batter matchup" note={data.matchup?.opponent} icon={Trophy}><Empty>{data.matchup?.pitcher}</Empty><Empty>{data.matchup?.handedness||data.matchup?.leash}</Empty><Empty>{data.vsMatchup?.career}</Empty></Card>}</>}
  {(tab==='lineups'||(data.isPitcherProp&&tab==='matchup'))&&(teamParams?<Lineup data={merged} team={data.teamInsightsTeamName} loading={lineup.loading||(split!=='season'&&splits.loading)} error={lineup.error||(split!=='season'&&splits.error)} split={split} setSplit={setSplit} onRetry={()=>setRetry(n=>n+1)}/>:<Card title="Batting order"><Empty>Team or opposing starter has not been resolved yet.</Empty></Card>)}
  {tab==='arsenal'&&<Arsenal data={data}/>} {tab==='rankings'&&<Rankings data={data}/>} {tab==='weather'&&<Weather data={data}/>}<Averages data={data} row={row}/>
 </>:null}
 {tab==='matchup'&&<MLBWinPredictor row={row} data={data}/>}
 </aside>;
}
