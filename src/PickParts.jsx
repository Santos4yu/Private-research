import React,{useEffect,useState} from 'react';
import {ArrowUpRight,Flame,TrendingDown,TrendingUp,TriangleAlert} from 'lucide-react';
import {LEAGUE_LOGOS} from './league-logos';
import {TIERS} from './slip-check';
import {allowReader,defenseKind,defenseWords} from './slip-analyst';
import {teamLogoUrl} from './sports/nfl/nfl-ui-core';
import './slip-analyzer.css';

// A graded pick's parts -- the photo with his team's mark, the tier, his
// chance against what the slip needs, his records and his last ten games.
// The Slip Analyzer's picks and the Smart Slip's are built from the same
// pieces, so they read the same. Styles: slip-analyzer.css (.sa-scope).
const percent=value=>`${Math.round(value*100)}%`;
const figure=value=>value==null?'—':String(Number(value));
const calm=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

export const MLB_LOGO=id=>id?`https://www.mlbstatic.com/team-logos/${encodeURIComponent(id)}.svg`:null;
// The other team's mark, from whatever the league's line carries.
export function opponentLogo(row){
 if(!row?.opponent)return null;
 if(row.opponentLogo)return row.opponentLogo;
 if(row.sport==='nfl')return teamLogoUrl(row.opponent);
 if(row.sport==='mlb')return MLB_LOGO(row.opponentTeamId);
 if(row.homeTeamAbbr===row.opponent)return row.homeTeamLogo||row.raw?.homeTeamLogo||null;
 if(row.awayTeamAbbr===row.opponent)return row.awayTeamLogo||row.raw?.awayTeamLogo||null;
 return null;
}
export const teamLogo=row=>row?.teamLogo||(row?.sport==='nfl'&&row.teamAbbr?teamLogoUrl(row.teamAbbr):null);

// A number that counts up to its value as it appears.
export function useCount(target,ms=900){
 const [value,setValue]=useState(()=>calm()?target:0);
 useEffect(()=>{
  if(target==null||calm()){setValue(target);return undefined;}
  let frame,start;
  const step=time=>{start??=time;const k=Math.min(1,(time-start)/ms);setValue(target*(1-(1-k)**3));if(k<1)frame=requestAnimationFrame(step);};
  frame=requestAnimationFrame(step);return()=>cancelAnimationFrame(frame);
 },[target,ms]);
 return value;
}

export function Img({src,className,alt=''}){
 const [bad,setBad]=useState(false);
 useEffect(()=>setBad(false),[src]);
 return src&&!bad?<img className={className} src={src} alt={alt} loading="lazy" onError={()=>setBad(true)}/>:null;
}

export function Face({row,leg,tier}){
 const [bad,setBad]=useState(false);
 const src=row?.headshot;
 useEffect(()=>setBad(false),[src]);
 const name=row?.player||leg?.player;
 const sport=row?.sport||leg?.sport;
 const badge=teamLogo(row)||LEAGUE_LOGOS[sport];
 return <span className="sa-face" data-tier={tier||undefined}>
  <span className="sa-face-photo">{src&&!bad?<img src={src} alt="" loading="lazy" onError={()=>setBad(true)}/>
   :<i>{String(name||'').split(' ').map(part=>part[0]).slice(0,2).join('')}</i>}</span>
  {badge&&<Img className="sa-face-badge" src={badge}/>}
 </span>;
}

const TIER_ICON={elite:Flame,strong:TrendingUp,lean:ArrowUpRight,risky:TriangleAlert,fade:TrendingDown};
export function TierBadge({tier}){
 const Icon=TIER_ICON[tier];
 return <span className="sa-tier" data-tier={tier} title={TIERS[tier].text}><Icon size={13} strokeWidth={2.6}/>{TIERS[tier].label}</span>;
}

export const rateTone=rate=>rate>=0.6?'up':rate>=0.5?'blue':rate>=0.4?'gold':'down';
const RECORDS=[['l5','L5'],['l10','L10'],['l20','L20'],['season','Season'],['h2h','H2H']];
// A team by its nickname on the small record chips: "Los Angeles Dodgers" is "Dodgers".
const TWO_WORD=/(red sox|white sox|blue jays|golden knights|maple leafs|blue jackets|red wings|trail blazers)$/i;
const teamShort=name=>{const text=String(name||'').trim();const two=text.match(TWO_WORD);return two?two[1]:text.split(/\s+/).length>1?text.split(/\s+/).pop():text;};
export function Records({grade,row}){
 // A backup starting today: these came in his smaller role.
 const smaller=grade.matchup?.facts?.some(item=>item.level==='role');
 const items=RECORDS.map(([key,label])=>[key,key==='h2h'&&row?.opponent?`vs ${teamShort(row.opponent)}`:label,grade.records?.[key]])
  .filter(([key,,record])=>record&&record.games>0&&!(key==='l20'&&record.games<=(grade.records.l10?.games||0))&&!(key==='season'&&record.games<=(grade.records.l20?.games||grade.records.l10?.games||0)));
 if(!items.length)return null;
 return <ul className="sa-records">{items.map(([key,label,record])=><li key={key} data-tone={smaller?'muted':rateTone(record.rate)}>
  <span>{label}</span><b>{record.won}/{record.games}</b><i style={{'--w':`${Math.round(record.rate*100)}%`}}/>
 </li>)}</ul>;
}

// The chance a pick hits, against what each pick needs for the parlay to pay its way.
export function Meter({chance,need}){
 const shown=useCount(chance*100);
 return <div className="sa-meter" data-tone={rateTone(chance)}>
  <div className="sa-meter-top"><b>{Math.round(shown)}<small>%</small></b><span>to hit</span>
   {need!=null&&<em>needs {percent(need)}</em>}</div>
  <div className="sa-meter-bar"><i style={{'--w':`${Math.round(chance*100)}%`}}/>{need!=null&&<u style={{left:`${Math.round(need*100)}%`}}/>}</div>
 </div>;
}

// The last ten games against the slip's number, each marked by the defense
// it came against (soft or tough for this stat, slip-analyst.js).
export function Games({row,line,side}){
 const games=(row?.gameLog||[]).slice(-10);
 if(games.length<3||line==null)return null;
 const values=games.map(game=>game.value);
 const top=Math.max(line*1.5,...values,1);
 const won=value=>side==='UNDER'?value<line:value>line;
 const hits=values.filter(won).length;
 const allow=allowReader(row);
 const kinds=games.map(game=>defenseKind(allow?.of(game)));
 const marked=kinds.some(kind=>kind==='soft'||kind==='tough');
 const words=defenseWords(row);
 return <div className="sa-games" role="img" data-marked={marked||undefined}
  aria-label={`Last ${games.length} games: ${hits} of ${games.length} on the ${side==='UNDER'?'under':'over'} side of ${line}`}>
  <div className="sa-games-head"><span>Last {games.length} games</span>
   {marked&&<span className="sa-games-key"><i data-kind="tough"/>{words.toughKey}<i data-kind="soft"/>{words.softKey}</span>}<b>{hits}/{games.length}</b></div>
  <div className="sa-games-plot">
   <i className="sa-games-line" style={{'--y':line/top}}><span>{figure(line)}</span></i>
   {games.map((game,index)=><span key={`${game.date}-${index}`} className="sa-games-bar" style={{'--h':`${Math.max(3,game.value/top*100)}%`,'--i':index}}
    data-result={game.value===line?'push':won(game.value)?'hit':'miss'}><b>{figure(game.value)}</b>
    {game.opponent&&typeof game.opponent==='string'&&<small>{game.opponent}</small>}
    {marked&&(kinds[index]==='soft'||kinds[index]==='tough')&&<i className="sa-games-def" data-kind={kinds[index]}/>}</span>)}
  </div>
 </div>;
}

const tenth=value=>String(Math.round(value*10)/10);
/**
 * The analyst's read of a pick, as someone checking it by hand would: is
 * the line too high or too low against the projection, did his recent
 * numbers come against soft or tough defenses, and how has he done against
 * defenses like tonight's (slip-analyst.js readPick).
 */
export function AnalystRead({read,side,line,row}){
 const check=read?.lineCheck,schedule=read?.factors?.find(item=>item.key==='schedule'),similar=read?.similar,split=read?.split;
 const over=side!=='UNDER',word=over?'Over':'Under';
 const both=split?.tough?.games>=2&&split?.soft?.games>=2;
 const words=defenseWords(row);
 const splitText=!similar&&both&&line!=null?`${word} ${figure(line)} in ${split.tough.won} of ${split.tough.games} against ${words.toughKind}, ${split.soft.won} of ${split.soft.games} against ${words.softKind}`:null;
 if(!check&&!schedule&&!similar&&!splitText)return null;
 const helps=check&&check.verdict!=='fair'&&(check.verdict==='low')===over;
 const z=check?Math.max(-2,Math.min(2,check.z)):0;
 return <section className="sa-analyst" aria-label="Analyst read">
  {check&&<div className="sa-lc" data-tone={check.verdict==='fair'?'even':helps?'good':'bad'}>
   <div className="sa-lc-top"><span>Line check</span><b>{check.verdict==='fair'?'Line looks fair':`Line looks ${tenth(Math.abs(check.gap))} ${check.verdict}`}</b></div>
   <div className="sa-lc-scale" aria-hidden="true"><i className="sa-lc-mid"/><i className="sa-lc-dot" style={{'--x':`${50+z*22}%`}}/></div>
   <div className="sa-lc-foot"><span>Line <b>{figure(check.line)}</b></span><span>Projects <b>{tenth(check.projection)}</b></span>
    {check.average!=null&&<span>Avg <b>{tenth(check.average)}</b></span>}</div>
  </div>}
  {(schedule||similar||splitText)&&<ul className="sa-analyst-points">
   {schedule&&<li data-tone={(schedule.factor>1)===over?'good':'bad'}>{schedule.text}.</li>}
   {similar&&<li data-tone={similar.record.rate>=0.6?'good':similar.record.rate<=0.4?'bad':'even'}>{similar.text}.</li>}
   {splitText&&<li data-tone="even">{splitText}.</li>}
  </ul>}
 </section>;
}

