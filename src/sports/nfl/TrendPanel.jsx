import {ResearchSheet,SheetSelect} from './ResearchSheet';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {SlidersHorizontal,Plus,Minus,RotateCcw} from 'lucide-react';
import {gameStatValue,teamLogoUrl} from './nfl-ui-core';
import {selectTrendGames,compareTrend,opportunityField,quoteIdentity} from './trend-data';

const fmt=value=>Number.isFinite(value)?Number(value.toFixed(1)):'—';
const hitTone=rate=>rate==null?'neutral':rate>=60?'good':rate<=40?'bad':'neutral';
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
  const maxN=Math.max(1,sample.included.length);
  // One row of sample-size tabs that also carries its own hit rate --
  // this used to be two separate rows (a fixed L5/L10/L15/Season/H2H
  // strip, plus a plain L5/L10/L15/L20/Max/H2H selector underneath it
  // showing no numbers at all), which repeated almost the same five
  // windows twice and read as an unplanned pile of boxes. One row that's
  // both the selector AND the at-a-glance read removes the duplication.
  const windows=useMemo(()=>{
    const eligible=sample.eligible;
    const windowFor=n=>compareTrend(eligible.slice(-n),selectedProp.key,line,direction);
    const h2hGames=opponent?logs.filter(row=>row.opponent_team_id===opponent && Number.isFinite(gameStatValue(row,selectedProp.key))):[];
    return [
      {key:5,label:'L5',...windowFor(5)},
      {key:10,label:'L10',...windowFor(10)},
      {key:15,label:'L15',...windowFor(15)},
      {key:20,label:'L20',...windowFor(20)},
      {key:'max',label:'Max',...compareTrend(eligible.slice(-maxN),selectedProp.key,line,direction)},
      ...(opponent?[{key:'h2h',label:'H2H',...compareTrend(h2hGames,selectedProp.key,line,direction)}]:[]),
    ];
  },[sample.eligible,maxN,logs,selectedProp.key,line,direction,opponent]);
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
  // Always fits the container's actual width -- bars shrink as the sample
  // grows instead of forcing a wider SVG and a horizontal scrollbar (same
  // approach as the MLB game log chart's dynamic --bar-width).
  const W=chartWidth,H=290,top=25,bottom=228,left=30,right=W-15;
  const y=v=>bottom-(v-min)/(max-min)*(bottom-top);
  const slot=(right-left)/Math.max(1,sample.selected.length);
  const dense=slot<26;
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
    <div className="nfl-line-editor"><div className="nfl-stepper"><button type="button" aria-label="Decrease comparison line" disabled={line==null} onClick={()=>changeLine(Number((line-.5).toFixed(1)))}><Minus size={18}/></button><input aria-label="Comparison line" type="number" inputMode="decimal" step="0.5" value={line??''} placeholder="Line" onChange={e=>changeLine(e.target.value)}/><button type="button" aria-label="Increase comparison line" disabled={line==null} onClick={()=>changeLine(Number((line+.5).toFixed(1)))}><Plus size={18}/></button></div>{market}<div className="nfl-side-switch" role="group" aria-label="Comparison direction">{[['OVER','More'],['UNDER','Less']].map(([key,text])=><button type="button" key={key} aria-pressed={direction===key} onClick={()=>{setDirection(key);setCustom(key!==quote?.direction || line!==quote?.value);}}>{text}</button>)}</div>{quote && custom && <button type="button" className="nfl-reset" onClick={()=>{setLine(quote.value);setDirection(quote.direction);setCustom(false);}}>Use posted line</button>}

    </div>
    <div className="nfl-window-tabs" role="group" aria-label="Game sample">{windows.map(w=>{const isH2H=w.key==='h2h',pressed=isH2H?filters.opponent===opponent:count===(w.key==='max'?maxN:w.key);const onClick=isH2H?()=>setFilter('opponent',filters.opponent===opponent?'':opponent):()=>setCount(w.key==='max'?maxN:w.key);return <button key={w.key} type="button" aria-pressed={pressed} disabled={isH2H&&!opponent} className={`${pressed?'active':''} ${line!=null?hitTone(w.hitRate):''}`} onClick={onClick}><span>{w.label}</span>{line!=null&&<strong>{w.hitRate==null?'—':`${Math.round(w.hitRate)}%`}</strong>}</button>;})}</div>
    <div className="nfl-game-count"><button type="button" className="nfl-filter-toggle" aria-haspopup="dialog" onClick={()=>setFiltersOpen(true)}><SlidersHorizontal size={16}/>Filters{activeFilters.length>0&&<b>{activeFilters.length}</b>}</button><div className="nfl-stepper"><button type="button" aria-label="Remove one game from sample" disabled={count<=1} onClick={()=>setCount(n=>Math.max(1,n-1))}><Minus size={18}/></button><input type="number" inputMode="numeric" aria-label="Number of games" min="1" max={Math.max(1,sample.included.length)} value={count} onChange={e=>setCount(Math.max(1,Math.min(100,Number(e.target.value)||1)))}/><button type="button" aria-label="Add one game to sample" disabled={count>=sample.included.length} onClick={()=>setCount(n=>n+1)}><Plus size={18}/></button></div></div>
    {/* Hit rate is the one number this whole panel exists to answer, so it
        leads at full size with its own tone; record and average are the
        supporting detail rather than three equal-weight columns. */}
    <div className={`nfl-trend-summary ${hitTone(summary.hitRate)}`}>
      <div className="nfl-trend-headline"><span>Hit rate</span><strong>{summary.hitRate==null?'—':`${fmt(summary.hitRate)}%`}</strong></div>
      <div className="nfl-trend-support">
        <div><span>Record</span><strong>{summary.hits==null?'—':`${summary.hits}–${summary.misses}${summary.pushes?` · ${summary.pushes}p`:''}`}</strong></div>
        <div><span>Average</span><strong>{fmt(summary.average)}</strong></div>
      </div>
    </div>
    <div className="nfl-chart-card"><div className="nfl-chart-head"><h3>{selectedProp.label}</h3><small>{line==null?'Select or enter a line':`${direction==='OVER'?'More':'Less'} ${line} · ${custom?'custom':'posted'}`}</small></div>
      {!sample.selected.length ? <p>{activeFilters.length || excluded.length ? 'No games match these filters. Adjust the filters or include more games.' : `No recorded ${selectedProp.label.toLowerCase()} games are available in this history sample.`}</p> : <><div className="nfl-interactive-chart" ref={chart}><svg viewBox={`0 0 ${W} ${H}`} style={{width:W,minWidth:W,height:H}} role="group" aria-label={`${selectedProp.label}: ${sample.selected.length} games, average ${fmt(summary.average)}${line!=null?`, comparison line ${line}, ${summary.hits} hits and ${summary.misses} misses`:''}`}>
        <defs>
          <linearGradient id="nfl-bar-hit" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7dffce"/><stop offset="45%" stopColor="#2be3a4"/><stop offset="100%" stopColor="#0d9a6f"/></linearGradient>
          <linearGradient id="nfl-bar-miss" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffa8b3"/><stop offset="45%" stopColor="#fa5b6f"/><stop offset="100%" stopColor="#c72d43"/></linearGradient>
          <linearGradient id="nfl-bar-push" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffe6ac"/><stop offset="45%" stopColor="#f3bd5c"/><stop offset="100%" stopColor="#cf8f37"/></linearGradient>
          <linearGradient id="nfl-bar-neutral" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#bcd8fb"/><stop offset="45%" stopColor="#7fb0e8"/><stop offset="100%" stopColor="#4a76ac"/></linearGradient>
          <linearGradient id="nfl-bar-sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff" stopOpacity=".35"/><stop offset="100%" stopColor="#fff" stopOpacity="0"/></linearGradient>
          <filter id="nfl-bar-shadow" x="-40%" y="-20%" width="180%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000" floodOpacity=".35"/></filter>
        </defs>
        {[0,.5,1].map(f=>{const value=min+(max-min)*f;return <g key={f}><line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="currentColor" strokeDasharray="2 5" opacity=".14"/><text x="1" y={y(value)+4} fontSize="10" fill="currentColor" opacity=".55">{fmt(value)}</text></g>;})}
        {sample.selected.map((row,i)=>{const value=values[i],hit=line==null?null:direction==='OVER'?value>line:value<line;const tone=line==null?'neutral':value===line?'push':hit?'hit':'miss';const fill=`url(#nfl-bar-${tone})`;const chipColor={hit:'#4fe3ac',miss:'#ff8b98',push:'#f3c877',neutral:'#a9c9ef'}[tone];const cx=left+slot*(i+.5),barY=Math.min(y(value),y(0)),height=Math.max(3,Math.abs(y(value)-y(0))),barWidth=Math.max(2,slot*.72),radius=dense?2:Math.min(9,barWidth/2);return <g key={row.game_id} role="button" tabIndex="0" aria-label={`${row.season} week ${row.week}, ${row.opponent_team_id}, ${value} ${selectedProp.label}. Show game details`} onClick={()=>setInspected(row.game_id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setInspected(row.game_id);}}} className="nfl-chart-game"><title>{`${row.season} W${row.week} / ${row.is_home?'vs':'@'} ${row.opponent_team_id} / ${value}`}</title><rect x={cx-barWidth/2} width={barWidth} y={barY} height={height} rx={radius} fill={fill} filter={dense?undefined:'url(#nfl-bar-shadow)'}/>{!dense && <rect x={cx-barWidth/2} width={barWidth} y={barY} height={Math.max(6,height*.4)} rx={radius} fill="url(#nfl-bar-sheen)"/>}{!dense && <g><rect x={cx-16} y={barY-25} width="32" height="17" rx="8.5" fill={chipColor} fillOpacity=".16" stroke={chipColor} strokeOpacity=".55"/><text x={cx} y={barY-13} textAnchor="middle" fontSize="11" fontWeight="700" fill={chipColor}>{value}</text></g>}{!dense && <image href={teamLogoUrl(row.opponent_team_id)} x={cx-13} y="238" width="26" height="26"/>}{!dense && <text x={cx} y="282" textAnchor="middle" fontSize="10" fill="currentColor" opacity=".7">{row.season} W{row.week}</text>}</g>;})}
        {/* The label sits pinned at the top-right corner with a short dashed
            lead down to the actual line, instead of floating at the line's
            own height -- a short/low game bar's value chip could otherwise
            land right where a tall game's line height puts the label. */}
        {line!=null && <g><line x1={left} x2={right} y1={y(line)} y2={y(line)} stroke="#4fa8ff" strokeWidth="1.5" strokeOpacity=".75" strokeDasharray="6 5"/><line x1={right-3} x2={right-3} y1={Math.min(y(line),top+20)} y2={Math.max(y(line),top+20)} stroke="#4fa8ff" strokeOpacity=".4" strokeDasharray="2 3"/><circle cx={right-3} cy={y(line)} r="3.5" fill="#4fa8ff"/><rect x={right-68} y={top-3} width="68" height="21" rx="10.5" fill="#182a3d" stroke="#4fa8ff" strokeOpacity=".65"/><text x={right-34} y={top+11} textAnchor="middle" fontSize="11" fontWeight="700" fill="#bfe0ff">{line} line</text></g>}
      </svg></div><small className="nfl-chart-caption">{sample.selected.length} games · tap a bar for details</small></>}
      {detail && <div className="nfl-game-detail"><strong>{detail.season} · Week {detail.week} · {detail.is_home?'vs':'@'} {detail.opponent_team_id}</strong><div>{otherStats.map(key=><span key={key}>{key.replaceAll('_',' ')} <b>{fmt(detail.stats?.[key])}</b></span>)}</div><button type="button" onClick={()=>{setExcluded(ids=>[...ids,detail.game_id]);setInspected(null);}}>Exclude this game</button></div>}
    </div>
    <details className="nfl-chart-card nfl-game-picker"><summary>Include / exclude individual games{excluded.length?` · ${excluded.length} excluded`:''}</summary>{excluded.length>0 && <button type="button" className="nfl-reset" onClick={()=>setExcluded([])}>Restore all games</button>}<div>{[...sample.eligible].reverse().map(row=><label key={row.game_id}><input type="checkbox" checked={!excluded.includes(row.game_id)} onChange={e=>setExcluded(ids=>e.target.checked?ids.filter(id=>id!==row.game_id):[...ids,row.game_id])}/><span>{row.season} W{row.week} · {row.is_home?'vs':'@'} {row.opponent_team_id}</span><strong>{fmt(gameStatValue(row,selectedProp.key))}</strong></label>)}</div></details>
  </section>;
}
