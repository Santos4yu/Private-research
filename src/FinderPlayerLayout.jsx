// The Finder's player page, every sport (finder-player-v2.css). Oct 30, the
// owner rebuilt the NBA / WNBA page ("new buttons new everything ... nice
// and mobile friendly and user friendly easy to navigate and see data
// nothing complex"), then: "grab the same exact code layout ... and apply
// it for all the sports". So every sport's page is this one layout with its
// own parts:
//
//   top bar   the player and the game (FinderPlayerBanner layout "v2")
//   chart     the shared trend chart (app.js's panel moved in), then his own
//             sections under it on their own tabs (Game log, Stats, Depth...)
//   research  the sport's matchup panel, one tab row over it
//
// On a computer the chart and his sections take the left and the research
// the right. Narrower (Nov 12, the owner with PickFinder's phone page: "i
// want it like this"): one column, the chart, then each of his sections as
// its own card, then the research tabs as tiles over the research. Every
// section stays mounted and is hidden when not picked, so a tab opens at
// once and keeps where it was.
import React,{useCallback,useState} from 'react';
import {ChartColumn,Crosshair,HeartPulse,LayoutGrid,ListOrdered,Newspaper,Shield,Swords,Target,Users,Wind,CalendarDays,Activity,ScrollText,ChartNoAxesColumn,Layers} from 'lucide-react';
import {FinderPlayerBanner} from './FinderPlayerBanner';
import './finder-player-v2.css';
import './finder-player-app.css';
import './player-kit.css';

// Each research tab's icon, for the tiles on a computer (Nov 9, the owner
// with PickFinder's player page: "i want this layout").
const TAB_ICONS={matchup:Swords,defense:Shield,shooting:Target,similar:Users,injuries:HeartPulse,rankings:ListOrdered,news:Newspaper,
 odds:ChartColumn,weather:Wind,schedule:CalendarDays,usage:Activity,pitcher:Crosshair,
 // His own sections, among the tiles on a phone (Nov 11).
 log:ScrollText,gamelog:ScrollText,stats:ChartNoAxesColumn,depth:Layers};
function Tabs({list,picked,onPick,className,label,icons=false}){
 return <nav className={`fp2-tabs ${className}`} aria-label={label}>{list.map(([key,name])=>{const Icon=TAB_ICONS[String(key).replace(/^his:/,'').toLowerCase()]||LayoutGrid;
  return <button type="button" key={key} aria-pressed={picked===key} onClick={()=>onPick(key)}>{icons&&<Icon size={17} aria-hidden="true"/>}<span>{name}</span></button>;})}</nav>;
}

// At a glance (Nov 18, the owner picked "New layouts": the matchup and the
// game on their own cards above the research, like the first design they
// liked). From the line's own row: the opposing defense's rank in this
// stat against his position, and his team's chance to win. A card with
// nothing to show is left out.
const POSITION_GROUP={G:'guards',PG:'guards',SG:'guards',F:'forwards',SF:'forwards',PF:'forwards',C:'centers'};
const finiteNumber=value=>typeof value==='number'&&Number.isFinite(value);
const suffix=n=>{const t=n%100,o=n%10;return t>10&&t<14?'th':o===1?'st':o===2?'nd':o===3?'rd':'th';};
function Glance({row}){
 if(!row)return null;
 const teams=row.defenseTeams||0,rank=finiteNumber(row.defense)&&teams>0?row.defense:null;
 const group=POSITION_GROUP[String(row.defensePosition||row.position||'').toUpperCase()]||'his position';
 // Rank 1 allows the least: the slider runs from the toughest on the left to the easiest on the right.
 const most=rank?teams-rank+1:null,place=rank?(rank-1)/Math.max(1,teams-1):null;
 const word=place==null?'':place>=2/3?'Easy matchup':place<=1/3?'Tough matchup':'Average matchup';
 const tone=place==null?'':place>=2/3?'good':place<=1/3?'low':'mid';
 const win=finiteNumber(row.winChance)?Math.round(row.winChance):null;
 if(rank==null&&win==null)return null;
 return <div className="fp2-glance">
  {rank!=null&&<section className="fp2-glance-card" aria-label="Matchup">
   <header><h2>Matchup</h2><span data-tone={tone}>{word}</span></header>
   <p className="fp2-glance-lead">{row.opponentLogo&&<img src={row.opponentLogo} alt="" width="26" height="26"/>}<span><b>{row.opponent} vs {group}</b><small>{row.market} allowed: {most}{suffix(most)} most of {teams}</small></span></p>
   <div className="fp2-glance-slider" style={{'--at':(place*100).toFixed(1)+'%'}}><i/></div>
   <div className="fp2-glance-ends"><span>Toughest</span><span>Easiest</span></div>
  </section>}
  {win!=null&&<section className="fp2-glance-card" aria-label="The game">
   <header><h2>The game</h2><span>Win chance</span></header>
   <div className="fp2-glance-teams"><span>{row.teamLogo&&<img src={row.teamLogo} alt="" width="22" height="22"/>}<b>{row.teamAbbr}</b></span><span><b>{row.opponent}</b>{row.opponentLogo&&<img src={row.opponentLogo} alt="" width="22" height="22"/>}</span></div>
   <div className="fp2-glance-bar"><i style={{width:win+'%'}}/><i style={{width:(100-win)+'%'}}/></div>
   <div className="fp2-glance-ends fp2-glance-pct"><b>{win}%</b><b>{100-win}%</b></div>
  </section>}
 </div>;
}

// His sections' keys carry a prefix: a sport's research can have a tab of
// the same name (soccer's Stats).
const HIS='his:';

/**
 * row / playerRows / onBack: the top bar's. `chart`: the trend chart and
 * anything that belongs under it (the filters' "no games" note). `his`:
 * [[key, label, node]], his own sections under the chart. `research`:
 * [[key, label]], the matchup panel's tabs; `renderResearch(tab)` draws the
 * panel on that tab. `notice` shows under the top bar; with `blocked` it is
 * all there is (a player the sport's data can't match).
 */
export function FinderPlayerLayout({row,playerRows,onBack,className='',style,notice=null,blocked=false,chart,his=[],research=[],renderResearch}){
 const [researchTab,setResearchTab]=useState(research[0]?.[0]),[hisTab,setHisTab]=useState(his[0]?.[0]),[group,setGroup]=useState('research');
 const pick=useCallback(key=>{
  if(key.startsWith(HIS)){setHisTab(key.slice(HIS.length));setGroup('his');}
  else{setResearchTab(key);setGroup('research');}
 },[]);
 const researchList=research.map(([key,label])=>[key,label]);
 const hisList=his.map(([key,label])=>[HIS+key,label]);
 const shownResearch=research.some(([key])=>key===researchTab)?researchTab:research[0]?.[0];
 return <section className={`finder-trend-view wnba-trend-page wnba-player-page fp2 ${className}`} style={style}>
  <FinderPlayerBanner row={row} playerRows={playerRows} onBack={onBack} layout="v2"/>
  {notice}
  {!blocked&&<div className="fp2-grid" data-group={group}>
   <div className="fp2-chart">
    {chart}
    {his.length>0&&<div className="fp2-his">
     <Tabs className="fp2-tabs-his" label="His games" list={hisList} picked={HIS+hisTab} onPick={pick}/>
     {his.map(([key,,node])=><div className="fp2-section" key={key} data-his={key} hidden={hisTab!==key}>{node}</div>)}
    </div>}
   </div>
   <div className="fp2-research">
    <Glance row={row}/>
    {/* A phone (and a narrow window): one row for every tab. */}
    <Tabs className="fp2-tabs-all" label="Research" list={[...researchList,...hisList]} picked={group==='research'?shownResearch:HIS+hisTab} onPick={pick} icons/>
    <Tabs className="fp2-tabs-research" label="Matchup research" list={researchList} picked={shownResearch} onPick={pick} icons/>
    <div className="fp2-section fp2-matchup">{renderResearch?.(shownResearch)}</div>
   </div>
  </div>}
 </section>;
}
