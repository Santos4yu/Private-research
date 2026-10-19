import React,{useEffect,useState} from 'react';
import {Activity,CalendarClock,ChartColumn,CloudSun,HeartPulse,ListOrdered,Shield,Target,Users,Trophy} from 'lucide-react';
import {FinderResearchTabs,FinderResearchCard as Card} from '../../FinderResearchSections';
import {loadTennisHistory,tennisOpponentMatches} from '../../unified-finder-data';
import {FinderDropdown} from '../../FinderDropdown';
import './tennis-context.css';
import {courtKey,courtDetail,courtLabel,onCourt,tennisSample,tennisMean as mean,tennisSummary,decimalToAmerican,tennisOddsRecord,tennisOpponentResults,tennisResultSummary,tennisH2H,tennisRatio} from './tennis-research';
import {useIsAdmin} from '../../admin-notice.js';

export const TENNIS_STATS=[['totalgames','Total Games','GAMES'],['totalgameswon','Games Won','GW'],['gameslost','Games Lost','GL'],['fantasyscore','Fantasy Score','FP'],['dominanceratio','Dominance Ratio','DR'],['holdpercentage','Serve Hold %','HOLD%'],['breakpointswon','Break Points Won','BP WON'],['breakpointchances','Break Point Chances','BP CH'],['breakpointsgivenup','Breaks Given Up','BP GU'],['breakpointswonpercentage','Break Points Won %','BP W%'],['aces','Aces','ACES'],['acesallowed','Aces Allowed','ACE ALL'],['doublefaults','Double Faults','DF'],['doublefaultpercentage','Double Fault %','DF%'],['totalsets','Sets Played','SETS'],['setswon','Sets Won','SW'],['1stsettotalgames','1st Set Total Games','1ST G'],['1stsettotalgameswon','1st Set Games Won','1ST GW'],['totaltiebreaks','Tiebreaks','TB'],['firstservepercentage','First Serve %','1ST%'],['firstservewonpercentage','First Serve Points Won %','1ST W%'],['secondservewonpercentage','Second Serve Points Won %','2ND W%'],['servicepointswonpercentage','Service Points Won %','SPW%'],['returnpointswonpercentage','Return Points Won %','RPW%'],['breakpointsfaced','Break Points Faced','BP F'],['breakpointssaved','Break Points Saved','BP S'],['breakpointssavedpercentage','Break Points Saved %','BP S%']].map(([key,label,code])=>({key,label,code}));
const fmt=(v,d=1)=>Number.isFinite(v)?v.toFixed(d):'—';
TENNIS_STATS.push({key:'secondservepercentage',label:'Second Serve In %',code:'2ND%'});
const note=text=><p className="mlb-context-note">{text}</p>;
// Tennis names for the shared research tabs (the basketball ones read Defense/Shooting).
const TENNIS_TABS=[['matchup','Matchup',Trophy],['defense','Return',Shield],['shooting','Serve',Target],['similar','Similar',Users],['injuries','Status',HeartPulse],['rankings','Rankings',ListOrdered]];
const SURFACES=[['all','All'],['hard','Hard (all)'],['hard-outdoor','Outdoor hard'],['hard-indoor','Indoor hard'],['clay','Clay'],['grass','Grass']];
const record=games=>{const s=tennisSummary(games);return s.matches?`${s.wins}–${s.losses}`:'—';};
function averageCell(list,key){const pair=key==='breakpointswon'?tennisRatio(list,'breakpointswon','breakpointchances'):key==='holdpercentage'?tennisRatio(list,'servicegamesheld','servicegamesplayed'):key==='breakpointssavedpercentage'?tennisRatio(list,'breakpointssaved','breakpointsfaced'):null;return pair?(key==='breakpointswon'?`${pair.won}/${pair.total} (${fmt(pair.percentage)}%)`:`${fmt(pair.percentage)}%`):`${fmt(mean(list,key),key==='dominanceratio'?2:1)}${key.endsWith('percentage')&&Number.isFinite(mean(list,key))?'%':''}`;}
function Form({profile,games}){
 const [page,setPage]=useState(0);useEffect(()=>setPage(0),[profile.name]);
 const summary=tennisSummary(games.slice(-5)),pages=Math.max(1,Math.ceil(games.length/5));
 return <div className="tennis-form"><h3>{profile.name}</h3>
  <div className="tennis-form-summary"><span>{summary.wins}W–{summary.losses}L</span><span>Sets {summary.setsWon}–{summary.setsLost}</span><span>Games {summary.gamesWon}–{summary.gamesLost}</span></div>
  {[...games].reverse().slice(page*5,page*5+5).map(g=><article className="tennis-form-match" key={g.gameId}>
   <header><time>{new Date(g.date).toLocaleDateString([],{month:'short',day:'numeric'})}</time><span className="tennis-result" data-result={g.result}>{g.result}</span></header>
   <div className="tennis-form-opponent">vs {g.opponent}{g.opponentRank&&<small> #{g.opponentRank}</small>}</div>
   <strong className="tennis-form-score">{g.score}</strong>
   <footer>{g.event&&<span title={g.event}>{g.event}</span>}<small>{[courtLabel(g.surface),g.bestOf?`BO${g.bestOf}`:null].filter(Boolean).join(' · ')}</small></footer>
  </article>)}
  {!games.length&&note('No matches available.')}
  {pages>1&&<div className="mlb-context-switch"><button type="button" disabled={!page} aria-label={`Previous matches for ${profile.name}`} onClick={()=>setPage(p=>p-1)}>‹</button><span>{page+1} / {pages}</span><button type="button" disabled={page>=pages-1} aria-label={`Next matches for ${profile.name}`} onClick={()=>setPage(p=>p+1)}>›</button></div>}
 </div>;
}
function Metrics({games,other,keys,names}){return <div className="mlb-context-table-wrap"><table><thead><tr><th>Stat</th><th>{names[0]}</th><th>{names[1]}</th></tr></thead><tbody>{keys.map(key=><tr key={key}><th>{TENNIS_STATS.find(s=>s.key===key)?.label||key}</th>{[games,other].map((list,i)=>{const v=mean(list,key);return <td key={i} title={`${list.filter(g=>Number.isFinite(g.values?.[key])).length} matches reported`}>{fmt(v,key==='dominanceratio'?2:1)}{key.endsWith('percentage')&&Number.isFinite(v)?'%':''}</td>;})}</tr>)}</tbody></table></div>;}
function OpponentResults({games,opponent,row}){
 const [page,setPage]=useState(0);useEffect(()=>setPage(0),[opponent,row.marketKey,row.line,games.length]);
 const results=tennisOpponentResults(games,opponent,row.marketKey,row.line).filter(g=>!tennisOpponentMatches(g.player,row.player)),summary=tennisResultSummary(results,row.line),pages=Math.max(1,Math.ceil(results.length/10));
 const max=Math.max(1,Number.isFinite(row.line)?row.line:0,...results.map(g=>g.value||0));
 return <><div className="tennis-opponent-summary"><span>{summary.graded?`${summary.over}/${summary.graded} Over`:'— Over'}</span><span>Avg {fmt(summary.average)}</span><span>Diff {summary.difference>0?'+':''}{fmt(summary.difference)}</span>{summary.pushes>0&&<span>{summary.pushes} Push</span>}</div>
 <div className="tennis-opponent-heading"><span>Player</span><span>Moneyline</span><span>{row.market}</span></div>
 {results.slice(page*10,page*10+10).map(g=><article className="tennis-opponent-row" key={g.gameId}>
  <div><strong>{g.player}</strong>{g.rank&&<small>#{g.rank}</small>}<small><time>{new Date(g.date).toLocaleDateString([],{month:'short',day:'numeric'})}</time> · <b>{g.result}</b> {g.score}</small></div>
  <div><strong>{Number(g.odds)>1?`${Math.round(100/Number(g.odds))}%`:'—'}</strong><small>{decimalToAmerican(g.odds)}</small></div>
  <div data-outcome={g.outcome}><strong>{fmt(g.value)}</strong><small>{g.outcome||'Unavailable'}</small><div className="tennis-result-bar" aria-hidden="true"><i style={{width:`${Math.max(0,(g.value||0)/max*100)}%`}}/>{Number.isFinite(row.line)&&<b style={{left:`${Math.max(0,row.line/max*100)}%`}}/>}</div><small>Line {fmt(row.line)}</small></div>
 </article>)}
 {!results.length&&note('No opponent results available.')}
 {pages>1&&<div className="mlb-context-switch tennis-results-pager"><button type="button" disabled={!page} aria-label="Previous opponent results" onClick={()=>setPage(p=>p-1)}>‹</button><span>{page+1} / {pages}</span><button type="button" disabled={page>=pages-1} aria-label="Next opponent results" onClick={()=>setPage(p=>p+1)}>›</button></div>}
 </>;
}
function Matchup({profiles,match,lists,row}){
 const date=match?.date||row.startsAt;
 const court=courtDetail(match?.surface);
 return <Card title={match?.event||'Tennis matchup'} note={[match?.round,courtLabel(match?.surface),match?.bestOf?`BO${match.bestOf}`:null].filter(Boolean).join(' · ')} icon={Trophy} className="tennis-matchup">
  {date&&<div className="tennis-match-time">{new Date(date).toLocaleString([],{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</div>}
  <div className="mlb-win-body">{profiles.map((p,i)=><React.Fragment key={p.name}>
   {i===1&&<div className="mlb-win-ring" role="img" aria-label={profiles.map(p=>`${p.name} ${fmt(p.winProbability)}%`).join(', ')} style={Number.isFinite(profiles[0]?.winProbability)?{background:`conic-gradient(var(--theme-accent,#5cf8b2) 0% ${profiles[0].winProbability}%, #8c8c8c ${profiles[0].winProbability}% 100%)`}:undefined}><span>WIN<br/>CHANCE</span></div>}
   <div className="mlb-win-team"><strong>{p.name}</strong>
    <div className="tennis-profile-tags">{p.rank&&<span>#{p.rank}</span>}{p.hand&&<span>{p.hand==='Left'?'Lefty':'Righty'}</span>}</div>
    <small>{[p.age!=null?`Age ${p.age}`:null,p.heightCm?`${p.heightCm} cm`:null].filter(Boolean).join(' · ')}</small>
    <b>{fmt(p.winProbability)}{Number.isFinite(p.winProbability)?'%':''}</b>
   </div>
  </React.Fragment>)}</div>
  <div className="tennis-odds-strip">{profiles.map((p,i)=>{const record=tennisOddsRecord(lists[i],p.decimalOdds);return <div key={p.name}><span>Moneyline</span><strong>{decimalToAmerican(p.decimalOdds)}</strong>{record&&<small>Similar odds <b>{Math.round(record.wins/record.matches*100)}%</b> · {record.wins}/{record.matches}</small>}</div>;})}</div>
  {court&&<div className="tennis-odds-strip tennis-surface-strip">{profiles.map((p,i)=>{const s=tennisSummary(lists[i].filter(g=>onCourt(g,court)));return <div key={p.name}><span>On {courtLabel(match.surface).toLowerCase()}</span><strong>{s.matches?`${s.wins}–${s.losses}`:'—'}</strong><small>{s.matches?`${Math.round(s.wins/s.matches*100)}% won · ${s.matches} matches`:'No matches recorded'}</small></div>;})}</div>}
 </Card>;
}
function Weather({weather}){
 if(!weather)return null;
 if(weather.indoor)return <Card title="Weather" note="Indoor event" icon={CloudSun}>{note("Played indoors, so weather and rain delays don't apply.")}</Card>;
 if(!weather.available)return <Card title="Weather" icon={CloudSun}>{note(weather.message||'Weather unavailable.')}</Card>;
 const rain=weather.rainMm>=2?'Heavy':weather.rainMm>=.3?'Likely':weather.rainMm>0?'Light chance':'None expected';
 return <Card title="Match-time weather" note={weather.venue} icon={CloudSun} className="tennis-weather">
  {weather.flags?.length>0&&<div className="tennis-weather-flags">{weather.flags.map(f=><span key={f.key} data-level={f.level}>{f.label}</span>)}</div>}
  <dl className="tennis-weather-grid">
   <div><dt>Conditions</dt><dd>{weather.conditions||'—'}</dd></div>
   <div><dt>Temperature</dt><dd>{weather.tempF!=null?`${weather.tempF}°F`:'—'}{weather.tempC!=null&&<small> {Math.round(weather.tempC)}°C</small>}</dd></div>
   <div><dt>Wind</dt><dd>{weather.windMph!=null?`${weather.windMph} mph`:'—'}</dd></div>
   <div><dt>Humidity</dt><dd>{weather.humidity!=null?`${Math.round(weather.humidity)}%`:'—'}</dd></div>
   <div><dt>Rain</dt><dd>{rain}{weather.rainMm>0&&<small> {weather.rainMm} mm/hr</small>}</dd></div>
  </dl>
  {!weather.flags?.length&&note('No weather issues expected around the start.')}
  <small className="tennis-weather-credit">{weather.credit}</small>
 </Card>;
}
function Advanced({profiles,lists,opponent,size,rank,format,surface}){
 const [index,setIndex]=useState(0),games=tennisSample(lists[index],{surface,size,rank,format});
 const splits=[['All',games],['Hard',games.filter(g=>courtKey(g.surface)==='hard')],['Outdoor hard',games.filter(g=>onCourt(g,'hard-outdoor'))],['Indoor hard',games.filter(g=>onCourt(g,'hard-indoor'))],['Clay',games.filter(g=>courtKey(g.surface)==='clay')],['Grass',games.filter(g=>courtKey(g.surface)==='grass')],['vs Righties',games.filter(g=>g.opponentHand==='Right')],['vs Lefties',games.filter(g=>g.opponentHand==='Left')],['H2H',games.filter(g=>tennisOpponentMatches(g.opponent,index?profiles[0].name:opponent))]];
 const cols=['fantasyscore','dominanceratio','holdpercentage','breakpointswon','breakpointchances','breakpointsgivenup','returnpointswonpercentage','aces','acesallowed','doublefaults','firstservepercentage','secondservepercentage','doublefaultpercentage','breakpointssavedpercentage'];
return <><div className="mlb-context-switch" aria-label="Player averages">{profiles.map((p,i)=><button type="button" key={p.name} aria-pressed={i===index} onClick={()=>setIndex(i)}>{p.name}{p.hand?` (${p.hand})`:''}</button>)}</div><div className="mlb-context-table-wrap" tabIndex={0} role="region" aria-label={`Advanced averages for ${profiles[index].name}; scroll for more stats`}><table><thead><tr><th>Totals</th><th>W–L</th><th>Games Won / Played</th>{cols.map(key=><th key={key} title={TENNIS_STATS.find(s=>s.key===key)?.label}>{TENNIS_STATS.find(s=>s.key===key)?.code}</th>)}</tr></thead><tbody>{splits.map(([label,list])=>{const s=tennisSummary(list);return <tr key={label}><th>{label}</th><td>{s.matches?`${s.wins}–${s.losses} (${Math.round(s.wins/s.matches*100)}%)`:'—'}</td><td>{s.matches?`${fmt(mean(list,'totalgameswon'))}/${fmt(mean(list,'totalgames'))} (${Math.round(s.gamesWon/(s.gamesWon+s.gamesLost)*100)}%)`:'—'}</td>{cols.map(key=><td key={key} title={`${list.filter(g=>Number.isFinite(g.values?.[key])).length} matches reported`}>{averageCell(list,key)}</td>)}</tr>;})}</tbody></table></div></>;
}
export default function TennisFinderContext({row,games,playerRows,loading,context}){
 const admin=useIsAdmin();
 const [tab,setTab]=useState('matchup'),[other,setOther]=useState([]),[surface,setSurface]=useState('all'),[size,setSize]=useState(15),[rank,setRank]=useState('all'),[format,setFormat]=useState('all'),[failure,setFailure]=useState('');
 const opponent=String(row.opponent||'').replace(/\s+1st Set.*$/i,'');
 useEffect(()=>{const controller=new AbortController();setOther([]);setFailure('');if(opponent&&!context?.players?.length)loadTennisHistory(opponent,{signal:controller.signal}).then(data=>setOther(data.games||[])).catch(e=>{if(e.name!=='AbortError')setFailure('Opponent history could not load.');});return()=>controller.abort();},[opponent,context]);
 const profiles=context?.players?.length?context.players:[{name:row.player},{name:opponent||'Opponent'}],lists=[profiles[0].games||games,profiles[1].games||other].map((list,i)=>list.map(g=>({...g,opponentHand:g.opponentHand||(tennisOpponentMatches(g.opponent,profiles[1-i].name)?profiles[1-i].hand:null)})));
 const names=profiles.map(p=>p.name),sample=tennisSample(lists[0],{surface,size,rank,format}),opponentGames=tennisSample(lists[1],{surface,size,rank,format});
 const h2h=tennisH2H([...lists[0],...(context?.h2hGames||[])],lists[1],row.player,opponent,row.startsAt);
 const controls=<div className="wnba-dvp-controls">{[['Surface',surface,setSurface,SURFACES],['Matches',size,setSize,[[5,'Last 5'],[10,'Last 10'],[15,'Last 15'],[20,'Last 20'],[10000,'All']]],['VS Rank',rank,setRank,[['all','All'],['10','Top 10'],['50','Top 50'],['100','Top 100']]],['Best Of',format,setFormat,[['all','All'],['3','BO3'],['5','BO5']]]].map(([label,value,set,options])=><label key={label}>{label}<FinderDropdown aria-label={label} value={value} onChange={e=>set(e.target.value)}>{options.map(([key,text])=><option key={key} value={key}>{text}</option>)}</FinderDropdown></label>)}</div>;
 return <aside className="mlb-finder-context wnba-finder-context tennis-finder-context" data-tab={tab} aria-label="Tennis matchup research"><FinderResearchTabs tab={tab} onChange={setTab} tabs={TENNIS_TABS}/>{loading&&note('Loading match history…')}{admin&&failure&&note(failure)}{admin&&context?.message&&note('Matchup unavailable.')}{admin&&context?.errors?.length>0&&note('Some player details are unavailable.')}
  {tab==='matchup'&&<><Matchup profiles={profiles} match={context?.match} lists={lists} row={row}/><Weather weather={context?.weather}/><Card title="Matchup odds" note="Moneyline" icon={ChartColumn}><div className="mlb-context-table-wrap"><table><thead><tr><th>Player</th><th>Moneyline</th><th>Win %</th></tr></thead><tbody>{profiles.map(p=><tr key={p.name}><th>{p.name}</th><td>{decimalToAmerican(p.decimalOdds)}</td><td>{fmt(p.winProbability)}{Number.isFinite(p.winProbability)?'%':''}</td></tr>)}</tbody></table></div></Card><Card title="Player Form" icon={CalendarClock} className="wnba-last-five"><details open><summary>Recent matches · both players</summary><div className="wnba-last-five-grid"><Form profile={profiles[0]} games={lists[0]}/><Form profile={profiles[1]} games={lists[1]}/></div></details></Card><Card title="H2H (Past 2 Years)" icon={Users}><details open><summary>{h2h.length?`${h2h.length} meetings · ${profiles[0].name} ${record(h2h)}${courtDetail(context?.match?.surface)?` · ${courtLabel(context.match.surface).toLowerCase()} ${record(h2h.filter(g=>onCourt(g,courtDetail(context.match.surface))))}`:''}`:'No recorded meetings'}</summary>{h2h.length?<Form profile={profiles[0]} games={h2h}/>:note('No meetings in the past 2 years.')}</details>{context?.match?.h2h&&note(`Career H2H: ${context.match.h2h.matchCount} meetings.`)}</Card></>}
  {tab==='defense'&&<Card title="Return and break-point comparison" icon={Shield}>{controls}<Metrics games={sample} other={opponentGames} names={names} keys={['acesallowed','returnpointswonpercentage','breakpointswon','breakpointchances','breakpointswonpercentage','breakpointsgivenup','breakpointsfaced','breakpointssaved','breakpointssavedpercentage']}/></Card>}
  {tab==='shooting'&&<Card title="Serve statistics"  icon={Target}>{controls}<Metrics games={sample} other={opponentGames} names={names} keys={['aces','doublefaults','doublefaultpercentage','firstservepercentage','firstservewonpercentage','secondservewonpercentage','servicepointswonpercentage','dominanceratio']}/></Card>}
  {tab==='similar'&&<Card title={`Other players vs ${opponent}`} note={row.market} icon={Users}>{controls}<OpponentResults games={opponentGames} opponent={opponent} row={row}/></Card>}
  {tab==='injuries'&&<Card title="Player availability" icon={HeartPulse}><div className="mlb-context-table-wrap"><table><thead><tr><th>Player</th><th>Status</th></tr></thead><tbody>{profiles.map(p=><tr key={p.name}><th>{p.name}</th><td>{p.status==='Active'?'—':p.status||'—'}</td></tr>)}</tbody></table></div>{note('Tennis has no published injury report.')}</Card>}
  {tab==='rankings'&&<Card title="Player rankings and profile" icon={ListOrdered}><div className="mlb-context-table-wrap"><table><thead><tr><th>Player</th><th>Rank</th><th>Change</th><th>Best</th><th>Age</th><th>Height</th><th>Hand</th></tr></thead><tbody>{profiles.map(p=><tr key={p.name}><th>{p.name}</th><td>{p.rank?`#${p.rank}`:'—'}</td><td>{p.rankChange??'—'}</td><td>{p.bestRank?`#${p.bestRank}`:'—'}</td><td>{p.age??'—'}</td><td>{p.heightCm?`${p.heightCm} cm`:'—'}</td><td>{p.hand||'—'}</td></tr>)}</tbody></table></div>{note(profiles.map(p=>`${p.name}: ${p.rankDate?new Date(p.rankDate).toLocaleDateString():'rank date not reported'}`).join(' · '))}</Card>}
  <Card title="Advanced Averages" note={context?.updatedAt?`Updated ${new Date(context.updatedAt).toLocaleString()}`:null} icon={Activity}>{controls}<Advanced profiles={profiles} lists={lists} opponent={opponent} size={size} rank={rank} format={format} surface={surface}/></Card>
 </aside>;
}
