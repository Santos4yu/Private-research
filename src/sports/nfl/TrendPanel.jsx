import {ResearchSheet,SheetSelect} from './ResearchSheet';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {SlidersHorizontal,Plus,Minus,RotateCcw} from 'lucide-react';
import {gameStatValue,teamLogoUrl} from './nfl-ui-core';
import {selectTrendGames,compareTrend,opportunityField,quoteIdentity} from './trend-data';

const fmt=value=>Number.isFinite(value)?Number(value.toFixed(1)):'—';
const emptyFilters={season:'',venue:'',opponent:'',team:'',minVolume:'',maxVolume:'',minSnaps:''};
const label={season:'Season',venue:'Location',opponent:'Opponent',team:'Team',minVolume:'Min opportunities',maxVolume:'Max opportunities',minSnaps:'Min snap %'};

export function NFLTrendPanel({logs,usage=[],selectedProp,quote,opponent,market,historyControl}) {
  const [count,setCount]=useState(5),[filters,setFilters]=useState({...emptyFilters}),[excluded,setExcluded]=useState([]);
  const [line,setLine]=useState(quote?.value ?? null),[direction,setDirection]=useState(quote?.direction || 'OVER'),[custom,setCustom]=useState(false);
  const [filtersOpen,setFiltersOpen]=useState(false),[inspected,setInspected]=useState(null);
  const offerId=quoteIdentity(quote);
  useEffect(()=>{if(quote){setLine(quote.value);setDirection(quote.direction);setCustom(false);}else if(!custom){setLine(null);}},[offerId]);
  const field=opportunityField(selectedProp.key);
  const sample=useMemo(()=>selectTrendGames(logs,usage,selectedProp.key,filters,excluded,count),[logs,usage,selectedProp.key,filters,excluded,count]);
  const summary=compareTrend(sample.selected,selectedProp.key,line,direction);
  const activeFilters=Object.entries(filters).filter(([,v])=>v!=='');
  const setFilter=(key,value)=>setFilters(current=>({...current,[key]:value}));
  const changeLine=value=>{setCustom(true);setLine(value===''?null:Number.isFinite(Number(value))?Number(value):null);};
  const reset=()=>{setFilters({...emptyFilters});setExcluded([]);setCount(5);};
  const chart=useRef(null);
  const [chartWidth,setChartWidth]=useState(340);
  useEffect(()=>{
    if(!chart.current)return;
    const observer=new ResizeObserver(entries=>setChartWidth(Math.max(220,Math.floor(entries[0].contentRect.width))));
    observer.observe(chart.current);return ()=>observer.disconnect();
  },[sample.selected.length]);
  const values=sample.selected.map(row=>gameStatValue(row,selectedProp.key));
  const max=Math.max(1,...values,Number.isFinite(line)?line:0)*1.2;
  const min=Math.min(0,...values,Number.isFinite(line)?line:0);
  const W=Math.max(chartWidth,sample.selected.length*52),H=290,top=25,bottom=228,left=30,right=W-15;
  const y=v=>bottom-(v-min)/(max-min)*(bottom-top);
  const slot=(right-left)/Math.max(1,sample.selected.length);
  const detail=sample.selected.find(row=>row.game_id===inspected);
  const otherStats=selectedProp.key==='fantasy_score' ? ['passing_yards','passing_tds','rushing_yards','receiving_yards','receptions'] : field?.key==='attempts' ? ['attempts','completions','passing_yards','passing_tds','passing_interceptions'] : field?.key==='carries' ? ['carries','rushing_yards','targets','receptions','receiving_yards'] : ['targets','receptions','receiving_yards','receiving_tds'];
  return <section className="nfl-panel-stack nfl-trends">

    <ResearchSheet open={filtersOpen} onClose={()=>setFiltersOpen(false)} title="Trend filters">{historyControl}<div className="nfl-filter-grid">
      <label>Season<SheetSelect label="Season" value={filters.season} onChange={e=>setFilter('season',e.target.value)}><option value="">All loaded seasons</option>{[...new Set(logs.map(row=>row.season))].sort().reverse().map(v=><option key={v}>{v}</option>)}</SheetSelect></label>
      <label>Location<SheetSelect label="Location" value={filters.venue} onChange={e=>setFilter('venue',e.target.value)}><option value="">Home + away</option><option value="HOME">Home</option><option value="AWAY">Away</option></SheetSelect></label>
      <label>Opponent<SheetSelect label="Opponent" value={filters.opponent} onChange={e=>setFilter('opponent',e.target.value)}><option value="">All opponents</option>{[...new Set(logs.map(row=>row.opponent_team_id).filter(Boolean))].sort().map(v=><option key={v}>{v}</option>)}</SheetSelect></label>
      <label>Player’s team<SheetSelect label="Player team" value={filters.team} onChange={e=>setFilter('team',e.target.value)}><option value="">All teams played for</option>{[...new Set(logs.map(row=>row.team_id).filter(Boolean))].sort().map(v=><option key={v}>{v}</option>)}</SheetSelect></label>
      {field && <><label>Minimum {field.label.toLowerCase()}<input type="number" inputMode="numeric" min="0" value={filters.minVolume} onChange={e=>setFilter('minVolume',e.target.value)} placeholder="Any"/></label><label>Maximum {field.label.toLowerCase()}<input type="number" inputMode="numeric" min="0" value={filters.maxVolume} onChange={e=>setFilter('maxVolume',e.target.value)} placeholder="Any"/></label></>}
      <label>Minimum offensive snap %<input type="number" inputMode="numeric" min="0" max="100" value={filters.minSnaps} onChange={e=>setFilter('minSnaps',e.target.value)} placeholder="Any" disabled={!usage.some(row=>Number.isFinite(row.offense_snap_rate))}/></label>
    </div>      {line!=null && <label>Comparison line · {line}<input className="nfl-line-range" type="range" aria-label="Move comparison line" min={Math.min(0,min,line)} max={Math.max(10,Math.ceil(max),line+1)} step="0.5" value={line} onChange={e=>changeLine(e.target.value)}/></label>}<button type="button" className="nfl-sheet-done" onClick={()=>setFiltersOpen(false)}>Show {sample.selected.length} games</button><button type="button" className="nfl-reset" onClick={reset}>Reset filters and sample</button></ResearchSheet>
    {activeFilters.length>0 && <div className="nfl-filter-chips">{activeFilters.map(([key,value])=><button type="button" key={key} aria-label={`Remove ${label[key]} filter`} onClick={()=>setFilter(key,'')}>{label[key]}: {value} ×</button>)}</div>}
    {market}
    <div className="nfl-line-editor"><div className="nfl-stepper"><button type="button" aria-label="Decrease comparison line" disabled={line==null} onClick={()=>changeLine(Number((line-.5).toFixed(1)))}><Minus size={18}/></button><input aria-label="Comparison line" type="number" inputMode="decimal" step="0.5" value={line??''} placeholder="Line" onChange={e=>changeLine(e.target.value)}/><button type="button" aria-label="Increase comparison line" disabled={line==null} onClick={()=>changeLine(Number((line+.5).toFixed(1)))}><Plus size={18}/></button></div><div className="nfl-side-switch" role="group" aria-label="Comparison direction">{[['OVER','More'],['UNDER','Less']].map(([key,text])=><button type="button" key={key} aria-pressed={direction===key} onClick={()=>{setDirection(key);setCustom(key!==quote?.direction || line!==quote?.value);}}>{text}</button>)}</div>{quote && custom && <button type="button" className="nfl-reset" onClick={()=>{setLine(quote.value);setDirection(quote.direction);setCustom(false);}}>Use posted line</button>}

    </div>
    <div className="nfl-window-tabs" role="group" aria-label="Game sample">{[5,10,15,20].map(n=><button key={n} type="button" aria-pressed={count===n} className={count===n?'active':''} onClick={()=>setCount(n)}>L{n}</button>)}<button type="button" onClick={()=>setCount(Math.max(1,sample.included.length))}>Max</button><button type="button" disabled={!opponent} aria-pressed={filters.opponent===opponent} onClick={()=>setFilter('opponent',filters.opponent===opponent?'':opponent)}>H2H</button></div>
    <div className="nfl-game-count"><button type="button" className="nfl-filter-toggle" aria-haspopup="dialog" onClick={()=>setFiltersOpen(true)}><SlidersHorizontal size={16}/>Filters{activeFilters.length>0&&<b>{activeFilters.length}</b>}</button><div className="nfl-stepper"><button type="button" aria-label="Remove one game from sample" disabled={count<=1} onClick={()=>setCount(n=>Math.max(1,n-1))}><Minus size={18}/></button><input type="number" inputMode="numeric" aria-label="Number of games" min="1" max={Math.max(1,sample.included.length)} value={count} onChange={e=>setCount(Math.max(1,Math.min(100,Number(e.target.value)||1)))}/><button type="button" aria-label="Add one game to sample" disabled={count>=sample.included.length} onClick={()=>setCount(n=>n+1)}><Plus size={18}/></button></div></div>
    <div className="nfl-stat-grid nfl-trend-summary">{[['Hit rate',summary.hitRate==null?'—':`${fmt(summary.hitRate)}%`],['Record',summary.hits==null?'—':`${summary.hits}–${summary.misses}${summary.pushes?` · ${summary.pushes} push`:''}`],['Average',fmt(summary.average)]].map(([name,value])=><article className="nfl-stat" key={name}><span>{name}</span><strong>{value}</strong></article>)}</div>
    <div className="nfl-chart-card"><div className="nfl-chart-head"><h3>{selectedProp.label}</h3><small>{line==null?'Select or enter a line':`${direction==='OVER'?'More':'Less'} ${line} · ${custom?'custom':'posted'}`}</small></div>
      {!sample.selected.length ? <p>{activeFilters.length || excluded.length ? 'No games match these filters. Adjust the filters or include more games.' : `No recorded ${selectedProp.label.toLowerCase()} games are available in this history sample.`}</p> : <><div className="nfl-interactive-chart" ref={chart}><svg viewBox={`0 0 ${W} ${H}`} style={{width:W,minWidth:W,height:H}} role="group" aria-label={`${selectedProp.label}: ${sample.selected.length} games, average ${fmt(summary.average)}${line!=null?`, comparison line ${line}, ${summary.hits} hits and ${summary.misses} misses`:''}`}>
        {[0,.5,1].map(f=>{const value=min+(max-min)*f;return <g key={f}><line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="currentColor" opacity=".12"/><text x="1" y={y(value)+4} fontSize="10" fill="currentColor">{fmt(value)}</text></g>;})}
        {sample.selected.map((row,i)=>{const value=values[i],hit=line==null?null:direction==='OVER'?value>line:value<line;const fill=line==null?'#719bbb':value===line?'#eab65e':hit?'#24c68c':'#ef566e';const cx=left+slot*(i+.5),barY=Math.min(y(value),y(0)),height=Math.max(3,Math.abs(y(value)-y(0)));return <g key={row.game_id} role="button" tabIndex="0" aria-label={`${row.season} week ${row.week}, ${row.opponent_team_id}, ${value} ${selectedProp.label}. Show game details`} onClick={()=>setInspected(row.game_id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setInspected(row.game_id);}}} className="nfl-chart-game"><title>{`${row.season} W${row.week} / ${row.is_home?'vs':'@'} ${row.opponent_team_id} / ${value}`}</title><rect x={cx-slot*.36} width={slot*.72} y={barY} height={height} rx="5" fill={fill}/><text x={cx} y={barY-7} textAnchor="middle" fontSize="12" fill="currentColor">{value}</text><image href={teamLogoUrl(row.opponent_team_id)} x={cx-13} y="238" width="26" height="26"/><text x={cx} y="282" textAnchor="middle" fontSize="10" fill="currentColor">{row.season} W{row.week}</text></g>;})}
        {line!=null && <g><line x1={left} x2={right} y1={y(line)} y2={y(line)} stroke="#f2cf80" strokeWidth="2" strokeDasharray="6 4"/><text x={right} y={y(line)-6} textAnchor="end" fontSize="12" fill="#f2cf80">{line} line</text></g>}
      </svg></div><small className="nfl-chart-caption">{sample.selected.length} games · tap a bar for details</small></>}
      {detail && <div className="nfl-game-detail"><strong>{detail.season} · Week {detail.week} · {detail.is_home?'vs':'@'} {detail.opponent_team_id}</strong><div>{otherStats.map(key=><span key={key}>{key.replaceAll('_',' ')} <b>{fmt(detail.stats?.[key])}</b></span>)}</div><button type="button" onClick={()=>{setExcluded(ids=>[...ids,detail.game_id]);setInspected(null);}}>Exclude this game</button></div>}
    </div>
    <details className="nfl-chart-card nfl-game-picker"><summary>Include / exclude individual games{excluded.length?` · ${excluded.length} excluded`:''}</summary>{excluded.length>0 && <button type="button" className="nfl-reset" onClick={()=>setExcluded([])}>Restore all games</button>}<div>{[...sample.eligible].reverse().map(row=><label key={row.game_id}><input type="checkbox" checked={!excluded.includes(row.game_id)} onChange={e=>setExcluded(ids=>e.target.checked?ids.filter(id=>id!==row.game_id):[...ids,row.game_id])}/><span>{row.season} W{row.week} · {row.is_home?'vs':'@'} {row.opponent_team_id}</span><strong>{fmt(gameStatValue(row,selectedProp.key))}</strong></label>)}</div></details>
  </section>;
}
