import React,{useState} from 'react';
import {Check,ChevronRight,Link2,Plus,ShieldAlert,TriangleAlert,Unlink} from 'lucide-react';
import {LEAGUE_LOGOS} from './league-logos';
import {Img,Face as SlipFace,TierBadge,Records,Meter,Games,AnalystRead,opponentLogo} from './PickParts';
import {MatchupCase} from './MatchupCase';
import {BotCard,Actions} from './KrazyBotCard';
import {finderSlipProp} from './unified-finder-data';
import {pickBuilder} from './pick-builder-client';

// The Scout Assistant's answer cards. A pick reads as it does in the Slip
// Analyzer (the same parts: PickParts.jsx, MatchupCase.jsx), with the rest
// of the report beside it rather than behind tabs: his numbers, home and
// road, the books and the defense. Lists and slips are rows of the same
// picks; anything else is drawn by KrazyBotCard.jsx in a plain frame.

const pct=value=>`${Math.round(value*100)}%`;
const figure=value=>value==null?'—':String(Math.round(Number(value)*10)/10);
const price=value=>value==null?'—':value>0?`+${value}`:`−${Math.abs(value)}`;
const MODIFIER_ICON={goblin:'/prizepicks/goblin.png',demon:'/prizepicks/demon.png'};
const sideWord=side=>side==='UNDER'?'Less':'More';
const lastName=name=>String(name||'').split(' ').filter(part=>!/^(jr|sr|ii|iii|iv)\.?$/i.test(part)).at(-1)||name;
// The report's rings as the Slip Analyzer's records ({l10:{won,games,rate}}).
const recordsOf=pick=>Object.fromEntries((pick.report?.rings||[]).map(ring=>[ring.key,{won:ring.won,games:ring.games,rate:ring.rate}]));

// The chance a pick hits, as a ring in its tier's color.
export function Chance({value,tier,size=42}){
 const r=size/2-3.5,around=2*Math.PI*r;
 return <span className="ace-chance" data-tier={tier||'none'} style={{'--s':`${size}px`}} aria-label={`${pct(value)} to hit`}>
  <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true"><circle cx={size/2} cy={size/2} r={r} className="ace-chance-track"/>
   <circle cx={size/2} cy={size/2} r={r} className="ace-chance-arc" strokeDasharray={`${around*Math.max(0,Math.min(1,value))} ${around}`}/></svg>
  <b>{Math.round(value*100)}<small>%</small></b>
 </span>;
}

function Who({pick}){
 const row=pick.row||{};
 return <div className="sa-who"><b>{pick.player}</b>
  <span className="sa-who-game">
   {pick.sport&&<Img className="sa-who-league" src={LEAGUE_LOGOS[pick.sport]}/>}
   {[pick.team,pick.position].filter(Boolean).join(' · ')}
   {pick.opponent&&<span className="sa-who-vs"><span>{pick.home===false?'@':'vs'}</span><Img src={pick.opponentLogo||opponentLogo(row)}/><span>{pick.opponent}</span></span>}
  </span>
  {pick.time&&<small>{pick.time}</small>}
 </div>;
}

function Split({label,split,today,side}){
 if(!split?.games)return null;
 const rate=split.decided?split.won/split.decided:null;
 return <li data-today={today||undefined}>
  <span>{label}{today&&<em>Today</em>}</span>
  <b>{figure(split.avg)}</b>
  <small>{split.decided?`${split.won}/${split.decided} ${side==='UNDER'?'under':'over'}`:`${split.games} games`}</small>
  {rate!=null&&<i style={{'--w':`${Math.round(rate*100)}%`}} data-tone={rate>=0.6?'up':rate<0.45?'down':'flat'}/>}
 </li>;
}

/** One pick, the whole report. */
export function AcePick({pick,verdict}){
 const report=pick.report||{};
 const stats=report.stats,splits=report.splits||{},market=report.market||{};
 const records=recordsOf(pick);
 const opp=splits.versus?.opponent||pick.opponent;
 return <article className="ace-pick sa-prop" data-tier={pick.tier||'none'}>
  <Img className="sa-prop-mark" src={pick.teamLogo}/>
  <header className="sa-prop-head">
   <SlipFace row={pick.row||{player:pick.player,headshot:pick.headshot,sport:pick.sport,teamLogo:pick.teamLogo}} tier={pick.tier}/>
   <Who pick={pick}/>
   {pick.tier?<TierBadge tier={pick.tier}/>:pick.grade&&<span className="ace-letter" data-grade={pick.grade[0]}>{pick.grade}</span>}
  </header>
  <div className="sa-prop-pick">
   <span className="sa-side" data-side={pick.side}>{sideWord(pick.side)}</span>
   <b>{figure(pick.line)}</b><span>{pick.stat}</span>
   {MODIFIER_ICON[pick.modifier]&&<img src={MODIFIER_ICON[pick.modifier]} alt={pick.modifier} width="20" height="20"/>}
   {verdict?.label&&<em className="ace-verdict" data-tone={verdict.tone||undefined}>{verdict.label}</em>}
  </div>
  {pick.redFlag&&<p className="ace-flag"><ShieldAlert size={15}/><span><b>Red flag</b>{pick.redFlag}</span></p>}
  <div className="ace-pick-body">
   <div className="ace-pick-main">
    {Number.isFinite(pick.chance)&&<Meter chance={pick.chance} need={null}/>}
    <MatchupCase matchup={pick.case} limit={4}/>
    {pick.read&&<AnalystRead read={pick.read} side={pick.side} line={pick.line} row={pick.row}/>}
    <div className="sa-form-head"><span>Recent form</span></div>
    <Records grade={{records,matchup:pick.case}} row={pick.row}/>
    {pick.row&&<Games row={pick.row} line={pick.line} side={pick.side}/>}
    {pick.risks?.length>0&&<ul className="sa-risks">{pick.risks.map(risk=><li key={risk}><TriangleAlert size={12}/>{risk}</li>)}</ul>}
   </div>
   <aside className="ace-pick-side">
    {stats&&<section className="ace-panel">
     <h4>The numbers</h4>
     <dl className="ace-figures">
      {stats.projection!=null&&<div data-tone={(stats.projection-pick.line)*(pick.side==='UNDER'?-1:1)>0?'up':'down'}><dt>Projection</dt><dd>{figure(stats.projection)}</dd></div>}
      <div><dt>Average</dt><dd>{figure(stats.avg)}</dd></div>
      <div><dt>Median</dt><dd>{figure(stats.median)}</dd></div>
      <div><dt>High / low</dt><dd>{figure(stats.high)}<small> / {figure(stats.low)}</small></dd></div>
     </dl>
    </section>}
    {(splits.home||splits.away||splits.versus)&&<section className="ace-panel">
     <h4>Where it's played</h4>
     <ul className="ace-splits">
      <Split label="Home" split={splits.home} today={splits.today==='home'} side={pick.side}/>
      <Split label="Road" split={splits.away} today={splits.today==='away'} side={pick.side}/>
      {splits.versus&&<Split label={`vs ${opp}`} split={splits.versus} today side={pick.side}/>}
     </ul>
    </section>}
    {(market.model!=null||report.books?.length>0)&&<section className="ace-panel">
     <h4>The market</h4>
     {market.model!=null&&<div className="ace-market">
      <span><small>Our chance</small><b>{pct(market.model)}</b></span>
      {market.books!=null&&<span><small>Books</small><b>{pct(market.books)}</b></span>}
      {market.edge!=null&&<span data-tone={market.edge>=0?'up':'down'}><small>Edge</small><b>{market.edge>=0?'+':'−'}{Math.abs(Math.round(market.edge*100))}%</b></span>}
     </div>}
     {report.books?.length>0&&<ul className="ace-books">{report.books.slice(0,4).map(book=><li key={book.name}><span>{book.name}</span><b>{price(book.price)}</b><small>{pct(book.chance)}</small></li>)}</ul>}
    </section>}
    {report.defense&&<section className="ace-panel">
     <h4>The defense</h4>
     <p className="ace-defense"><b>{report.defense.rank}<small>/{report.defense.teams}</small></b>
      <span>{pick.opponent} rank {report.defense.rank} of {report.defense.teams} against {report.defense.position||'his position'}{report.defense.rank>report.defense.teams*2/3?' (one of the softest)':report.defense.rank<=report.defense.teams/3?' (one of the toughest)':''}</span></p>
    </section>}
    {report.role?.text&&<p className="ace-note">{report.role.text}</p>}
   </aside>
  </div>
  <Actions pick={pick}/>
 </article>;
}

/** Ranked picks, one row each; a tap asks about that one. */
function Rows({picks,tags,onAsk,ranked=true}){
 return <ol className="ace-rows">{picks.map((pick,index)=><li key={`${pick.player}-${index}`} style={{'--i':index}}>
  <button type="button" data-tier={pick.tier||'none'} onClick={()=>onAsk?.(`How's ${pick.player} looking?`)}>
   {ranked&&<span className="ace-rank">{index+1}</span>}
   <SlipFace row={pick.row||{player:pick.player,headshot:pick.headshot,sport:pick.sport,teamLogo:pick.teamLogo}} tier={pick.tier}/>
   <span className="ace-row-main">
    {tags?.[index]&&<span className="ace-tag">{tags[index]}</span>}
    <b>{pick.player}</b>
    <span className="ace-row-line"><em data-side={pick.side}>{sideWord(pick.side)}</em> {figure(pick.line)} {pick.short||pick.stat}
     {pick.opponent&&<i> {pick.home===false?'@':'vs'} {pick.opponent}</i>}</span>
    {pick.record&&<small>{pick.record.won}/{pick.record.games} {pick.side==='UNDER'?'under':'over'} last {pick.record.games}{pick.matchup?.short?` · ${pick.matchup.short}`:''}</small>}
   </span>
   <span className="ace-row-end">
    {pick.tier?<TierBadge tier={pick.tier}/>:pick.grade&&<span className="ace-letter" data-grade={pick.grade[0]}>{pick.grade}</span>}
   </span>
   {Number.isFinite(pick.chance)&&<Chance value={pick.chance} tier={pick.tier} size={46}/>}
   <ChevronRight className="ace-row-go" size={16} aria-hidden="true"/>
  </button>
 </li>)}</ol>;
}

/** A slip: its picks, its grade as one, what helps or hurts, one tap to save it. */
function AceSlip({card,onAsk}){
 const [added,setAdded]=useState(false);
 const add=()=>{
  if(!added)card.picks.forEach(pick=>pickBuilder.set(finderSlipProp(pick.row),pick.side==='UNDER'?'Under':'Over'));
  setAdded(true);pickBuilder.open();
 };
 return <div className="ace-slip">
  <div className="ace-slip-sum">
   {card.letter&&<span className="ace-slip-grade" data-grade={card.letter[0]}><small>Slip grade</small><b>{card.letter}</b></span>}
   <span><small>All {card.picks.length} hit</small><b>{pct(card.together)}</b></span>
   {card.payout&&<span><small>Power Play</small><b>{card.payout}x</b></span>}
   <span><small>Picks</small><b>{card.picks.length}</b></span>
  </div>
  <Rows picks={card.picks} onAsk={onAsk}/>
  {card.links?.length>0&&<ul className="ace-links">{card.links.map(pair=><li key={pair.text} data-tone={pair.tone}>
   {pair.tone==='together'?<Link2 size={14}/>:<Unlink size={14}/>}{pair.text[0].toUpperCase()+pair.text.slice(1)}</li>)}</ul>}
  <button type="button" className="ace-primary" onClick={add}>{added?<Check size={16}/>:<Plus size={16}/>}{added?'Open My Slip':'Add all to My Slip'}</button>
 </div>;
}

/** Two picks side by side, the better one marked. */
function AceCompare({card}){
 return <div className="ace-compare">{card.picks.map((pick,index)=><div key={pick.player} className="ace-compare-side" data-best={index===0||undefined}>
  {index===0&&<span className="ace-best">My pick</span>}
  <header className="sa-prop-head"><SlipFace row={pick.row||{player:pick.player,headshot:pick.headshot,teamLogo:pick.teamLogo}} tier={pick.tier}/><Who pick={pick}/></header>
  <div className="sa-prop-pick"><span className="sa-side" data-side={pick.side}>{sideWord(pick.side)}</span><b>{figure(pick.line)}</b><span>{pick.short||pick.stat}</span></div>
  {Number.isFinite(pick.chance)&&<Meter chance={pick.chance} need={null}/>}
  {pick.report?.rings?.length>0&&<Records grade={{records:recordsOf(pick),matchup:pick.case}} row={pick.row}/>}
  {pick.row&&<Games row={pick.row} line={pick.line} side={pick.side}/>}
 </div>)}</div>;
}

/** Whatever the answer brought, drawn for the Scout Assistant. */
export function AceCard({card,onAsk}){
 if(!card)return null;
 let body;
 if(card.kind==='pick')body=<AcePick pick={card.pick} verdict={card.verdict}/>;
 else if(card.kind==='list')body=<div className="ace-frame"><Rows picks={card.picks} onAsk={onAsk}/></div>;
 else if(card.kind==='rundown')body=<div className="ace-frame"><Rows picks={card.rows.map(item=>item.pick)} tags={card.rows.map(item=>item.tag)} onAsk={onAsk} ranked={false}/></div>;
 else if(card.kind==='slip')body=<div className="ace-frame"><AceSlip card={card} onAsk={onAsk}/></div>;
 else if(card.kind==='compare')body=<div className="ace-frame"><AceCompare card={card}/></div>;
 else body=<div className="ace-frame ace-legacy"><BotCard card={card}/></div>;
 return <div className="sa-scope ace-card-wrap">{body}</div>;
}

export {lastName};
