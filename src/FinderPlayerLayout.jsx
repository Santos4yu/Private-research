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
// the right; narrower, one column with a single row of every tab. Every
// section stays mounted and is hidden when not picked, so a tab opens at
// once and keeps where it was.
import React,{useCallback,useState} from 'react';
import {ChartColumn,Crosshair,HeartPulse,LayoutGrid,ListOrdered,Newspaper,Shield,Swords,Target,Users,Wind,CalendarDays,Activity,ScrollText,ChartNoAxesColumn,Layers} from 'lucide-react';
import {FinderPlayerBanner} from './FinderPlayerBanner';
import './finder-player-v2.css';
import './finder-player-app.css';

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
     {his.map(([key,,node])=><div className="fp2-section" key={key} hidden={hisTab!==key}>{node}</div>)}
    </div>}
   </div>
   <div className="fp2-research">
    {/* A phone (and a narrow window): one row for every tab. */}
    <Tabs className="fp2-tabs-all" label="Research" list={[...researchList,...hisList]} picked={group==='research'?shownResearch:HIS+hisTab} onPick={pick} icons/>
    <Tabs className="fp2-tabs-research" label="Matchup research" list={researchList} picked={shownResearch} onPick={pick} icons/>
    <div className="fp2-section fp2-matchup">{renderResearch?.(shownResearch)}</div>
   </div>
  </div>}
 </section>;
}
