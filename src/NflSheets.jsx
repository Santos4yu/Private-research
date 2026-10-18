import React,{useEffect,useMemo,useState} from 'react';
import {Activity,ArrowDown,ArrowRight,ArrowUp,ChevronDown,Crosshair,Flame,Gauge,Ghost,Grid3x3,Info,RefreshCw,Search,Shield,Snowflake,Star,Swords,Tags,Target,Timer,Trophy,Zap} from 'lucide-react';
import {finite,nameKey,num,fixed,price,time,initials,Img,Score,Tag,Table,Faq,Skeleton} from './cheat-sheet-parts';
import {teamLogoUrl} from './sports/nfl/nfl-ui-core';
import './nfl-sheets.css';
import {useIsAdmin} from './admin-notice.js';

// NFL Cheat Sheets: this week's games read twelve ways (nfl_sheets.py).
// Each sheet is one request, kept here for a few minutes. Every sheet has an
// admin switch (site_controls SHEETS); CheatSheets.jsx only offers the ones
// that are on.

export const NFL_SHEETS=[
 {key:'best',tint:'#E26CFF',title:'Best Matchups',kicker:'Top prop each game',icon:Swords,blurb:'The best matchup in every game, at any position.',
  about:"Every posted line's More side, at any position, read four ways: what his opponent gives up to his position in that stat against the league (its last five games and the season), a projection from his recent games moved by that defense and his team's implied points, how often he has cleared the line (last 10 and season), and the books' chance with their margin taken out. Scouting notes then move the score: how often the defense blitzes and pressures the quarterback, the boxes it plays against the run, the yards a carry and a pass it allows, how he does against the blitz or light boxes, his snaps and touches lately, and the spread. Only defenses that give up more than average count. Each player shows his best line, and each game's top one is marked."},
 {key:'td',tint:'#3FE39E',title:'TD Scorers',kicker:'Anytime TD',icon:Trophy,blurb:"Every player's touchdown chance this week, next to the best price.",
  about:"Each team's expected rushing and receiving touchdowns come from its implied points (the spread and total) and the league's touchdowns per point. They're split among the team's healthy players by their share of its touchdowns, red-zone looks and touches this season, nudged toward the positions the defense gives up touchdowns to."},
 {key:'firsttd',tint:'#6EA8FF',title:'First TD',kicker:'Opening drives',icon:Timer,blurb:'Who scores early: first-two-drive touchdowns and the game’s first score.',
  about:"How often each team scores a touchdown on its first two drives, how often its defense allows one, who scored each game's first touchdown, and who gets the ball on those early drives. The chance a team scores first leans on its expected points and both early rates; a player's part follows his share of the team's touchdowns."},
 {key:'streaks',tint:'#FF8A4C',title:'Prop Streaks',kicker:'Hit-rate runs',icon:Flame,blurb:'Lines a player keeps clearing game after game.',
  about:"Every posted line checked against the player's games: how many in a row he has cleared (or missed), and his hit rate over the last 10, last 20 and this season. Preseason games are left out."},
 {key:'zones',tint:'#4FD1C5',title:'Target Zones',kicker:'Where the ball goes',icon:Grid3x3,blurb:"Where a receiver's targets go, against where the defense gives up yards.",
  about:"Every target this season split six ways: short or deep, and left, middle or right of the field (from the play-by-play). Each receiver's share in each zone is set against the yards per target the defense allows there, compared with the league."},
 {key:'redzone',tint:'#F06A77',title:'Red Zone',kicker:'Inside the 20',icon:Target,blurb:'Red-zone trips, who gets the ball there, and the touchdown chance.',
  about:"Red-zone trips are drives that reached the opponent's 20. Each player's red-zone looks are his carries and targets from there; inside-10 looks are the ones from the 10 in. The touchdown chance is the same one TD Scorers shows."},
 {key:'speed',tint:'#FFD452',title:'Speed Edges',kicker:'40-yard speed',icon:Gauge,blurb:"A player's 40-yard speed against the defenders across from him.",
  about:"Speed is from each player's 40-yard dash at the NFL Combine, turned into miles per hour over the 40. Receivers are set against the other team's starting corners and nickel, tight ends against its safeties and a linebacker, backs against its starting linebackers, from this week's depth chart. Players who didn't run at the Combine aren't listed."},
 {key:'steam',tint:'#B48CFF',title:'Steam Moves',kicker:'Line movement',icon:Activity,blurb:'Lines that moved since they opened, and how many books moved together.',
  about:"Each line's first number is recorded when a book posts it; the sheet compares it with the number now. A move is steam when two or more books moved the same way. Juice is the shift in the Over's implied chance at an unchanged line."},
 {key:'shop',tint:'#F2C26B',title:'Line Shopping',kicker:'Best prices',icon:Tags,blurb:"Prices that beat the other books, and numbers off the market's line.",
  about:"A better price compares each book's price with the fair chance the other books imply (their margin taken out) and shows the expected return. An off-market line is an app or book posting a number well away from the one most books share."},
 {key:'dvp',tint:'#5CC8FF',title:'Defense vs Position',kicker:'Matchup ranks',icon:Shield,blurb:'What every defense gives up to each position, game by game.',
  about:"For each defense, the whole position group's total in each game (every receiver's yards added up, say), averaged over its last 3, 5 or 10 games or the season. Rank 1 allows the least; the last rank allows the most."},
 {key:'soft',tint:'#FF6FA3',title:'Soft Spots',kicker:'Matchup props',icon:Crosshair,blurb:'Props lined up against the defenses that allow the most for that stat.',
  about:"Every posted line whose player faces one of the eight defenses that allow the most of that stat to his position over their last five games, with how far above the league average that is, his hit rates and the best price."},
 {key:'goblins',tint:'#A3E635',title:'Goblins & Demons',kicker:'PrizePicks lines',icon:Ghost,blurb:'Goblins and demons the sportsbooks price at the same number.',
  about:"PrizePicks' goblin and demon lines next to the sportsbooks' prices at the same number (their alternate lines). The chance is the books' price with their margin taken out, averaged across books."},
];
const FAQ={
 best:[['What makes it the best matchup?','The defense gives up more than most to his position in that stat, his projection against it clears the line, he has been clearing it, and the books agree. Each part adds to the score; the defense counts the most.'],
  ['Why only More?','A good matchup is a defense that gives up a lot, so the play is More.'],
  ['Where do the scouting notes come from?','Every play this season, charted: how many rushers each defense sends, how many it puts in the box, who gets the ball against each look, plus pressures, yards after contact and snap counts. The charting comes out a few days after each week, so the newest games can be missing for a few days.'],
  ['Why is each player listed once?','Each player shows his best line, so one player can’t fill the board. Pick a game to see every matchup in it.']],
 td:[['Why is the chance different from the book?','The book prices in its margin and its own read. Edge is our chance minus the chance the best price implies; a positive edge means the price pays more than our number says it should.'],
  ['Does it count passing touchdowns?','No. A quarterback is listed for touchdowns he runs in himself, the way anytime touchdown props settle.']],
 firsttd:[['What counts as an early touchdown?','A touchdown on either of the team’s first two offensive drives.'],
  ['Why don’t the two teams add up to 100%?','A defensive or return touchdown is sometimes the first score of a game; that share is left out.']],
 streaks:[['What do the tags mean?','On fire: 5 or more straight games over the line. Ice cold: 5 or more straight under. Steady: over in at least 75% of the last 20.'],
  ['Do streaks predict the next game?','Not on their own. Check the matchup and the price before playing one.']],
 zones:[['Why zones and not routes?','Route charts are not public. Where the ball is thrown (depth and side) is, and it is what a route is for.'],
  ['What is a prime zone?','His busiest zone takes at least a quarter of his targets and the defense is one of the five softest there.']],
 redzone:[['What is a red-zone look?','A carry or a target from the opponent’s 20-yard line in.'],
  ['Why does a high share not always mean a high chance?','His team has to get there. A big share on a team expected to score little adds up to less.']],
 speed:[['Is this game speed?','No. It is Combine speed, the one public measure for every drafted player. It shows who has the burst to separate, not how fast anyone ran last week.'],
  ['Who counts as across from him?','The other team’s starters at the spots that usually cover his position on this week’s depth chart.']],
 steam:[['Up or down?','Up means the line or the Over’s price went up: the market expects more. Down means it expects less.'],
  ['Why are some lines missing?','A line only shows once it has moved since it was first seen.']],
 shop:[['What does the edge mean?','For a better price, the expected return per dollar at the fair chance. For an off-market line, how far the number sits from the market’s.'],
  ['Can I trust a big edge?','Check that the line is the same prop everywhere and has not moved. Big gaps often close fast.']],
 dvp:[['Why does a defense rank 32nd?','It allows the most to that position in that stat over the window you picked.'],
  ['What window should I use?','Last 5 shows the defense now; Season gives more games. A defense that changed a lot shows up as a big gap between the two.']],
 soft:[['How soft is soft?','One of the eight defenses that allow the most of the stat to his position over their last five games.'],
  ['What is vs avg?','How much more than the league average that defense allows the position, per game.']],
 goblins:[['What is a goblin or a demon?','A PrizePicks line set lower (goblin) or higher (demon) than its standard line, paying less or more.'],
  ['Where do the books’ prices come from?','Their alternate lines at the same number. A book quoting only the Over is read with a typical margin on the Under.']],
};

const BOOK_LOGOS={prizepicks:'/prizepicks/logo.png',draftkings:'/sportsbooks/draftkings.png',fanduel:'/sportsbooks/fanduel.png',betmgm:'/sportsbooks/betmgm.png',
 underdog:'/sportsbooks/underdog.png',williamhill_us:'/sportsbooks/williamhill_us.png',espnbet:'/sportsbooks/espnbet.png',fanatics:'/sportsbooks/fanatics.png',
 hardrockbet:'/sportsbooks/hardrockbet.png',pick6:'/sportsbooks/pick6.png',betrivers:'/sportsbooks/betrivers.png'};
const BOOK_NAMES={prizepicks:'PrizePicks',underdog:'Underdog',pick6:'DK Pick6',draftkings:'DraftKings',fanduel:'FanDuel',betmgm:'BetMGM',williamhill_us:'Caesars',
 espnbet:'ESPN BET',fanatics:'Fanatics',hardrockbet:'Hard Rock Bet',pinnacle:'Pinnacle'};
const ZONE_NAMES={short_left:'Short left',short_middle:'Short middle',short_right:'Short right',deep_left:'Deep left',deep_middle:'Deep middle',deep_right:'Deep right'};
const POSITIONS=['QB','RB','WR','TE'];

const percent=(value,digits=0)=>finite(value)?`${(value*100).toFixed(digits)}%`:'—';
const kick=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?`${date.toLocaleDateString([],{weekday:'short'})} ${time(value)}`:'';};
const teamLogo=team=>team?teamLogoUrl(team):null;
const rateTone=value=>!finite(value)?undefined:value>=0.6?'good':value<=0.4?'bad':undefined;

// ---------------------------------------------------------------- data

const store=new Map();
// Kept a few minutes: the hub reads each sheet's #1 from the same request.
export async function fetchSheet(sheet,force=false){
 const kept=store.get(sheet);
 if(!force&&kept&&Date.now()-kept.at<4*60000)return kept.data;
 const response=await fetch(`/api/board?view=nfl-sheet&sheet=${sheet}`,{credentials:'same-origin',cache:'no-store'});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(body.error||'This sheet is unavailable right now.');
 store.set(sheet,{at:Date.now(),data:body});
 return body;
}

// ---------------------------------------------------------------- pieces

function Face({src,name,team,size}){
 const [failed,setFailed]=useState(false);
 return <span className="cs-face" data-size={size||undefined}>
  {src&&!failed?<img src={src} alt="" loading="lazy" onError={()=>setFailed(true)}/>:<b>{initials(name)}</b>}
  {team&&<span className="cs-face-team"><Img src={teamLogo(team)}/></span>}
 </span>;
}
function Who({who,opponent,startsAt,tag,status}){
 return <span className="cs-who">
  <Face src={who?.headshot} name={who?.name} team={who?.team}/>
  <span className="cs-who-main">
   <span className="cs-who-name"><strong>{who?.name||'—'}</strong>{tag}{status&&<span className="nfl-status" data-status={String(status).toLowerCase()}>{String(status)[0]}</span>}</span>
   <span className="cs-who-meta">{who?.position}{who?.team&&<><i>·</i>{who.team}</>}{opponent&&<> vs {opponent}</>}{startsAt&&<><i>·</i>{kick(startsAt)}</>}</span>
  </span>
 </span>;
}
const Pick=({side='over',line,label})=><span className="nfl-pick" data-side={side}><b>{side==='under'?'Less':'More'}</b><strong>{num(line,1)}</strong><small>{label}</small></span>;
function Rate({hit}){
 if(!hit||!finite(hit.rate))return <span className="nfl-rate">—</span>;
 return <span className="nfl-rate" data-tone={rateTone(hit.rate)}><b>{percent(hit.rate)}</b><small>{hit.hits}/{hit.games}</small></span>;
}
function BookPrice({best,line}){
 if(!best)return <span className="nfl-book">—</span>;
 return <span className="nfl-book"><Img className="nfl-book-logo" src={BOOK_LOGOS[best.book]}/><b>{finite(best.price)?price(best.price):num(line,1)}</b><small>{best.name||BOOK_NAMES[best.book]||best.book}</small></span>;
}
const Chance=({value,fair})=><span className="nfl-chance" data-tone={finite(value)&&value>=0.6?'good':undefined}><b>{percent(value)}</b>{finite(fair)&&<small>fair {price(fair)}</small>}</span>;
const Edge=({value})=>finite(value)?<span className="nfl-edge" data-tone={value>0?'good':value<0?'bad':undefined}>{value>0?'+':''}{(value*100).toFixed(1)}%</span>:<span className="nfl-edge">—</span>;
function Rank({rank,teams=32,value,unit}){
 if(!finite(rank))return <span className="nfl-rank">—</span>;
 const soft=rank>=teams-7,tough=rank<=8;
 return <span className="nfl-rank" data-tone={soft?'good':tough?'bad':undefined}><b>#{rank}</b>{finite(value)&&<small>{fixed(value,value<10?2:1)}{unit?` ${unit}`:''}</small>}</span>;
}
function Dots({recent}){
 if(!recent?.length)return null;
 return <span className="nfl-dots" aria-label={`${recent.filter(Boolean).length} of the last ${recent.length}`}>{recent.map((hit,index)=><i key={index} data-hit={hit?'':undefined}/>)}</span>;
}
function Bar({value,label}){
 return <span className="nfl-bar"><i style={{'--v':finite(value)?Math.max(0,Math.min(value,1)):0}}/>{label!==undefined&&<b>{label}</b>}</span>;
}
function Seg({value,options,onChange,label}){
 return <div className="cs-seg" role="tablist" aria-label={label}>{options.map(([key,text,count])=><button key={key} type="button" role="tab" aria-selected={value===key} data-active={value===key?'':undefined} onClick={()=>onChange(key)}>{text}{finite(count)&&<small>{count}</small>}</button>)}</div>;
}
function Chips({value,options,onChange,label}){
 return <div className="cs-chips-row cs-scroll" role="tablist" aria-label={label}>{options.map(([key,text])=><button key={key} type="button" data-active={value===key?'':undefined} onClick={()=>onChange(key)}>{text}</button>)}</div>;
}
function Prices({prices,line}){
 if(!prices?.length)return null;
 return <div className="nfl-prices">{prices.map(item=><span key={item.book}><Img className="nfl-book-logo" src={BOOK_LOGOS[item.book]}/><b>{item.name||BOOK_NAMES[item.book]||item.book}</b>
  <small>{finite(item.over)?`More ${price(item.over)}`:''}{finite(item.over)&&finite(item.under)?' · ':''}{finite(item.under)?`Less ${price(item.under)}`:''}</small></span>)}</div>;
}
const gameOf=(data,id)=>(data.games||[]).find(game=>game.gameId===id);
const startOf=(data,id)=>gameOf(data,id)?.startsAt;

// The side rail: short ranked lists and this week's games.
function RailList({title,sub,items}){
 if(!items?.length)return null;
 return <section className="nfl-rail-card"><header><h3>{title}</h3>{sub&&<p>{sub}</p>}</header>
  <ol>{items.map((item,index)=><li key={item.key||index}>
   {item.face?<Face src={item.face.headshot} name={item.face.name} team={item.face.team} size="sm"/>:item.logo?<Img className="nfl-rail-logo" src={item.logo}/>:null}
   <span className="nfl-rail-main"><b>{item.name}</b>{item.meta&&<small>{item.meta}</small>}</span>
   <span className="nfl-rail-value"><b data-tone={item.tone}>{item.value}</b>{item.sub&&<small>{item.sub}</small>}</span>
   {finite(item.bar)&&<span className="nfl-rail-bar"><i style={{'--v':Math.max(0,Math.min(item.bar,1))}}/></span>}
  </li>)}</ol></section>;
}
function Slate({data,counts,game,setGame}){
 const games=(data.games||[]).filter(item=>!item.started);
 if(!games.length)return null;
 return <section className="nfl-rail-card"><header><h3>This week</h3><p>{games.length} game{games.length===1?'':'s'} to come</p></header>
  <ul className="nfl-slate">{games.map(item=><li key={item.gameId}><button type="button" data-active={game===item.gameId?'':undefined} onClick={()=>setGame(game===item.gameId?'all':item.gameId)}>
   <span className="nfl-slate-teams"><Img src={teamLogo(item.away)}/>{item.away}<i>@</i><Img src={teamLogo(item.home)}/>{item.home}</span>
   <small>{kick(item.startsAt)}</small>
   {counts&&<em>{counts[item.gameId]||0}</em>}
  </button></li>)}</ul></section>;
}
const countBy=(rows,key=row=>row.gameId)=>rows.reduce((found,row)=>{const id=key(row);if(id)found[id]=(found[id]||0)+1;return found;},{});

// ---------------------------------------------------------------- sheets

function BestSheet({data,filter,game}){
 const [position,setPosition]=useState('all');
 const [view,setView]=useState('games');
 const base=useMemo(()=>(data.rows||[]).filter(row=>filter(row)&&(position==='all'||row.who.position===position)),[data,filter,position]);
 const perGame=view==='games'&&game==='all';
 // Rows come best first, so each game's first is its best.
 const rows=useMemo(()=>{if(!perGame)return base;const seen=new Set();return base.filter(row=>!seen.has(row.gameId)&&seen.add(row.gameId));},[base,perGame]);
 const tier=row=><Tag tone={row.tier==='elite'?'hot':row.tier==='strong'?'strong':'limited'} icon={row.top&&!perGame?Star:undefined}>{row.tier==='elite'?'Elite':row.tier==='strong'?'Strong':'Lean'}</Tag>;
 return <>
  <div className="nfl-controls">
   {game==='all'&&<Seg value={view} onChange={setView} label="Show" options={[['games','Best per game'],['all','All matchups']]}/>}
   <Seg value={position} onChange={setPosition} label="Position" options={[['all','All'],...POSITIONS.map(item=>[item,item])]}/>
  </div>
  <Table rows={rows} empty="No matchups on the board right now." expand={row=><><BestWhy row={row}/><Notes notes={row.notes}/><Prices prices={row.prices}/></>} moreLabel="Scouting and prices" columns={[
   {key:'player',label:'Player',className:'cs-sticky',render:row=><Who who={row.who} opponent={row.opponent} startsAt={row.startsAt} status={row.status} tag={tier(row)}/>},
   {key:'pick',label:'Pick',render:row=><Pick line={row.line} label={row.label}/>},
   {key:'proj',label:'Proj',value:row=>row.edge,render:row=><span className="nfl-two"><b>{fixed(row.projection,1)}</b><small>{finite(row.edge)?`${row.edge>0?'+':''}${Math.round(row.edge*100)}% vs line`:''}</small></span>},
   {key:'rank',label:'Opp vs pos',short:'Opp',value:row=>row.rank,render:row=><Rank rank={row.rank} teams={row.teams} value={row.allowed}/>},
   {key:'l10',label:'L10',value:row=>row.hits.l10.rate,render:row=><Rate hit={row.hits.l10}/>},
   {key:'best',label:'Best',value:row=>row.best?.price,render:row=><BookPrice best={row.best} line={row.line}/>},
   {key:'score',label:'Score',value:row=>row.score,render:row=><Score value={row.score} label="Matchup score"/>},
  ]}/>
 </>;
}
// The scouting notes (nfl_scouting.py): a dot for which way each leans.
function Notes({notes}){
 if(!notes?.length)return null;
 return <ul className="nfl-notes" aria-label="Scouting notes">{notes.map((note,index)=><li key={index} data-lean={note.lean>0?'up':note.lean<0?'down':'flat'}>{note.text}</li>)}</ul>;
}
function BestWhy({row}){
 const l10=row.hits?.l10,szn=row.hits?.szn;
 return <p className="nfl-why">{row.opponent} allow <b>{fixed(row.allowed,1)}</b> {String(row.label).toLowerCase()} a game to {row.who.position}s (league {fixed(row.average,1)}){finite(row.rank)?<>: <b>#{row.rank}</b> of {row.teams}</>:null}. {row.who.name} has averaged {fixed(row.recent,1)} lately; with this matchup{finite(row.points)?<> and {row.who.team}'s {fixed(row.points,1)} implied points</>:null} that projects to <b>{fixed(row.projection,1)}</b> against the {num(row.line,1)} line.{l10?.games?<> He's gone over it in <b>{l10.hits} of his last {l10.games}</b>{szn?.games?<> ({szn.hits} of {szn.games} this season)</>:null}.</>:null}{finite(row.chance)?<> The books give More a <b>{percent(row.chance)}</b> chance across {row.books} book{row.books===1?'':'s'}.</>:null}</p>;
}

function TdSheet({data,filter,game}){
 const rows=useMemo(()=>(data.players||[]).filter(filter),[data,filter]);
 const card=game!=='all'?(data.cards||[]).find(item=>item.gameId===game):null;
 return <>{card&&<TdGame card={card} data={data}/>}
  <Table rows={rows} rowKey={row=>row.who.id} empty="No players for this pick yet." expand={row=><TdWhy row={row}/>} moreLabel="How it's worked out" columns={[
   {key:'player',label:'Player',className:'cs-sticky',render:row=><Who who={row.who} opponent={row.opponent} startsAt={startOf(data,row.gameId)} status={row.status}/>},
   {key:'share',label:'His share',short:'Share',value:row=>row.share,render:row=><span className="nfl-two"><b>{percent(row.share)}</b><small>of {fixed(row.teamTds,1)} team TDs</small></span>},
   {key:'rz',label:'RZ looks',short:'RZ',value:row=>row.rzLooks,render:row=><span className="nfl-two"><b>{row.rzLooks}</b><small>{finite(row.rzShare)?`${percent(row.rzShare)} of team`:''}</small></span>},
   {key:'tdGames',label:'TDs',value:row=>row.tds/Math.max(row.games,1),render:row=><span className="nfl-two"><b>{row.tds}</b><small>in {row.games} games</small></span>},
   {key:'defense',label:'Opp vs pos',short:'Opp',value:row=>row.defenseRank,render:row=><Rank rank={row.defenseRank} value={row.defenseTds} unit="TD/g"/>},
   {key:'best',label:'Best price',short:'Best',value:row=>row.edge,render:row=><span className="nfl-priced"><BookPrice best={row.best}/>{finite(row.edge)&&<Edge value={row.edge}/>}</span>},
   {key:'chance',label:'TD chance',short:'Chance',value:row=>row.chance,render:row=><Chance value={row.chance} fair={row.fair}/>},
  ]}/></>;
}
function TdWhy({row}){
 const tilt=finite(row.tilt)&&Math.abs(row.tilt-1)>=0.03;
 return <p className="nfl-why">{row.who.team} are expected to score about <b>{fixed(row.teamTds,1)}</b> rushing and receiving touchdowns{finite(row.teamPoints)?<> ({fixed(row.teamPoints,1)} implied points)</>:null}. {row.who.name} gets <b>{percent(row.share)}</b> of that from his share of their touchdowns, red-zone looks and touches this season{tilt?<>, moved {row.tilt>1?'up':'down'} because {row.opponent} allows {fixed(row.defenseTds,2)} touchdowns a game to {row.who.position}s (league {fixed(row.leagueTds,2)})</>:null}. That's <b>{fixed(row.expected,2)}</b> expected touchdowns: a <b>{percent(row.chance)}</b> chance of at least one, fair price {price(row.fair)}.</p>;
}
function TdGame({card,data}){
 const game=gameOf(data,card.gameId);
 return <section className="nfl-game-card">
  <header><h3><Img src={teamLogo(game?.away)}/>{game?.awayName||game?.away}<i>@</i><Img src={teamLogo(game?.home)}/>{game?.homeName||game?.home}</h3><small>{kick(game?.startsAt)}{finite(game?.total)?` · total ${game.total}`:''}</small></header>
  <div className="nfl-sides">{card.sides.map(side=><div key={side.team} className="nfl-side">
   <div className="nfl-side-top"><Img src={teamLogo(side.team)}/><b>{side.team}</b><span><strong>{fixed(side.tds,1)}</strong> expected TDs{finite(side.points)?` · ${fixed(side.points,1)} pts`:''}</span></div>
   <p>{side.opponent}'s defense, touchdowns allowed a game</p>
   <div className="nfl-leaks">{side.defense.map(leak=><span key={leak.position}><small>vs {leak.position}</small><Rank rank={leak.rank} value={leak.allowed}/></span>)}</div>
  </div>)}</div>
 </section>;
}

function FirstTdSheet({data,game}){
 const cards=(data.cards||[]).filter(card=>game==='all'||card.gameId===game);
 if(!cards.length)return <p className="cs-empty">No games left to play this week.</p>;
 return <div className="nfl-ftd-list">{cards.map((card,index)=><FirstTdCard key={card.gameId} card={card} data={data} index={index}/>)}</div>;
}
function FirstTdCard({card,data,index}){
 const game=gameOf(data,card.gameId);
 const [team,setTeam]=useState('all');
 const [all,setAll]=useState(false);
 const [away,home]=card.sides;
 const players=useMemo(()=>card.sides.flatMap(side=>side.players.map(player=>({...player,team:side.team}))).filter(player=>team==='all'||player.team===team).sort((a,b)=>(b.chance||0)-(a.chance||0)),[card,team]);
 const shown=all?players:players.slice(0,6);
 const split=finite(away.chance)&&finite(home.chance)?away.chance/(away.chance+home.chance):0.5;
 return <article className="nfl-ftd" style={{'--i':index}}>
  <header><h3><Img src={teamLogo(away.team)}/>{away.team}<i>@</i><Img src={teamLogo(home.team)}/>{home.team}</h3><small>{kick(game?.startsAt)}</small></header>
  <div className="nfl-ftd-split">
   <span><Img src={teamLogo(away.team)}/><b>{percent(away.chance)}</b></span>
   <div><i style={{'--v':split}}/><small>Chance to score the game's first TD</small></div>
   <span><b>{percent(home.chance)}</b><Img src={teamLogo(home.team)}/></span>
  </div>
  <dl className="nfl-ftd-stats">
   {[['TD on first two drives',side=>finite(side.early)?`${percent(side.early)} · ${side.earlyTds}/${side.earlyGames}`:'—'],
     ['Their defense allows one',side=>finite(side.allowed)?`${percent(side.allowed)} · ${side.allowedTds}/${side.allowedGames}`:'—'],
     ['Scored the first TD',side=>`${side.firstTd} of ${side.games}`],
     ['Early runs',side=>finite(side.run)?percent(side.run):'—']].map(([label,value])=><div key={label}><dd>{value(away)}</dd><dt>{label}</dt><dd>{value(home)}</dd></div>)}
  </dl>
  <Seg value={team} onChange={setTeam} label="Team" options={[['all','Both'],[away.team,away.team],[home.team,home.team]]}/>
  <ul className="nfl-ftd-players">{shown.map(player=><li key={player.who.id}>
   <Who who={player.who} status={player.status}/>
   <span className="nfl-ftd-early"><Bar value={player.early} label={finite(player.early)?`${percent(player.early)} ${player.earlyKind==='rush'?'rush':'tgt'}`:'—'}/><small>first 2 drives · Q1 {percent(player.q1)}</small></span>
   <span className="nfl-two"><b>{player.firstTd}</b><small>first TDs / {player.games}</small></span>
   <Chance value={player.chance} fair={player.fair}/>
  </li>)}</ul>
  {players.length>6&&<button type="button" className="cs-mcard-more" onClick={()=>setAll(value=>!value)}>{all?'Show fewer':`Show all ${players.length}`}<ChevronDown aria-hidden="true"/></button>}
 </article>;
}

const STREAK_TAGS={hot:['On fire','hot',Flame],cold:['Ice cold','cold',Snowflake],steady:['Steady','strong',null]};
function StreaksSheet({data,filter}){
 const [side,setSide]=useState('over');
 const all=(data.rows||[]).filter(filter);
 const rows=useMemo(()=>all.filter(row=>side==='all'||row.side===side),[all,side]);
 return <>
  <div className="nfl-controls"><Seg value={side} onChange={setSide} label="Side" options={[['over','More',all.filter(row=>row.side==='over').length],['under','Less',all.filter(row=>row.side==='under').length],['all','All',all.length]]}/></div>
  <Table rows={rows} empty="No streaks on this side right now." columns={[
   {key:'player',label:'Player',className:'cs-sticky',render:row=>{const tag=STREAK_TAGS[row.tag];return <Who who={row.who} opponent={row.opponent} startsAt={row.startsAt} tag={tag&&<Tag tone={tag[1]} icon={tag[2]}>{tag[0]}</Tag>}/>;}},
   {key:'pick',label:'Line',render:row=><Pick side={row.side} line={row.line} label={row.label}/>},
   {key:'recent',label:'Last 10',render:row=><Dots recent={row.recent}/>},
   {key:'streak',label:'Streak',value:row=>row.streak,render:row=><span className="nfl-two"><b>{row.streak}</b><small>straight</small></span>},
   {key:'l10',label:'L10',value:row=>row.hits.l10.rate,render:row=><Rate hit={row.hits.l10}/>},
   {key:'l20',label:'L20',value:row=>row.hits.l20.rate,render:row=><Rate hit={row.hits.l20}/>},
   {key:'szn',label:'Season',value:row=>row.hits.szn.rate,render:row=><Rate hit={row.hits.szn}/>},
   {key:'best',label:'Price',value:row=>row.best?.price,render:row=><BookPrice best={row.best}/>},
   {key:'score',label:'Score',value:row=>row.score,render:row=><Score value={row.score} label="Streak score"/>},
  ]}/>
 </>;
}

function ZoneMap({zones,opponent}){
 const by=Object.fromEntries((zones||[]).map(zone=>[zone.zone,zone]));
 return <div className="nfl-zonemap">
  <p>His targets by zone, and the yards per target {opponent} allows there (league in brackets).</p>
  <div className="nfl-zonegrid">{['deep','short'].map(depth=>['left','middle','right'].map(side=>{const zone=by[`${depth}_${side}`];const soft=zone&&finite(zone.rank)&&zone.rank>=26;return <span key={`${depth}_${side}`} data-soft={soft?'':undefined} data-empty={zone?undefined:''}>
   <small>{depth} {side}</small>
   {zone?<><b>{percent(zone.share)}</b><em>{fixed(zone.allowed,1)} yds <i>({fixed(zone.league,1)})</i></em>{finite(zone.rank)&&<strong>#{zone.rank}</strong>}</>:<b>—</b>}
  </span>;}))}</div>
 </div>;
}
function ZonesSheet({data,filter}){
 const [position,setPosition]=useState('all');
 const [defense,setDefense]=useState('any');
 const teams=data.teams||32;
 const rows=useMemo(()=>(data.rows||[]).filter(filter).filter(row=>(position==='all'||row.who.position===position)
  &&(defense==='any'||(defense==='soft'?row.defenseRank>=teams-9:defense==='tough'?row.defenseRank<=10:row.defenseRank>10&&row.defenseRank<teams-9))),[data,filter,position,defense,teams]);
 const zone=item=>item?<span className="nfl-zone"><b>{ZONE_NAMES[item.zone]}</b><small>{percent(item.share)} of targets{finite(item.rank)?<> · <em data-tone={item.rank>=teams-4?'good':item.rank<=6?'bad':undefined}>#{item.rank}</em></>:null}</small></span>:'—';
 return <>
  <div className="nfl-controls">
   <Seg value={position} onChange={setPosition} label="Position" options={[['all','All'],['WR','WR'],['TE','TE'],['RB','RB']]}/>
   <Seg value={defense} onChange={setDefense} label="Defense" options={[['any','Any D'],['soft','Soft'],['mid','Mid'],['tough','Tough']]}/>
  </div>
  <Table rows={rows} rowKey={row=>row.who.id} empty="No receivers match." expand={row=><ZoneMap zones={row.zones} opponent={row.opponent}/>} moreLabel="Zone map" columns={[
   {key:'player',label:'Player',className:'cs-sticky',render:row=><Who who={row.who} opponent={row.opponent} startsAt={startOf(data,row.gameId)} status={row.status} tag={row.prime&&<Tag tone="strong" icon={Zap}>Prime zone</Tag>}/>},
   {key:'top',label:'Top zone',render:row=>zone(row.zones[0])},
   {key:'second',label:'2nd zone',render:row=>zone(row.zones[1])},
   {key:'targets',label:'Targets',value:row=>row.targets,format:value=>num(value,0)},
   {key:'line',label:'Rec yds',value:row=>row.line,render:row=>finite(row.line)?<span className="nfl-two"><b>{num(row.line,1)}</b><small>{row.best?`${price(row.best.price)} ${row.best.name}`:''}</small></span>:'—'},
   {key:'l10',label:'L10',value:row=>row.hits?.l10?.rate,render:row=><Rate hit={row.hits?.l10}/>},
   {key:'score',label:'Score',value:row=>row.score,render:row=><Score value={row.score} label="Zone score"/>},
  ]}/>
 </>;
}

function RedZoneSheet({data,filter}){
 const rows=useMemo(()=>(data.rows||[]).filter(filter),[data,filter]);
 const rate=(value,trips)=><span className="nfl-two"><b>{fixed(trips,1)}</b><small>{finite(value)?`${percent(value)} TD`:''}</small></span>;
 return <Table rows={rows} rowKey={row=>row.who.id} empty="No red-zone roles to show." expand={row=><RzWhy row={row} league={data.league}/>} moreLabel="How it's worked out" columns={[
  {key:'player',label:'Player',className:'cs-sticky',render:row=><Who who={row.who} opponent={row.opponent} startsAt={startOf(data,row.gameId)} status={row.status}/>},
  {key:'share',label:'RZ share',short:'Share',value:row=>row.share,render:row=><Bar value={row.share/0.6} label={percent(row.share)}/>},
  {key:'looks',label:'RZ looks/g',short:'RZ/g',value:row=>row.looks,format:value=>fixed(value,1)},
  {key:'inside10',label:'Inside 10/g',short:'In-10/g',value:row=>row.inside10,format:value=>fixed(value,1)},
  {key:'team',label:'Team trips/g',short:'Trips/g',value:row=>row.teamTrips,render:row=>rate(row.teamRate,row.teamTrips)},
  {key:'allowed',label:'Opp allows/g',short:'Opp trips',value:row=>row.allowedTrips,render:row=>rate(row.allowedRate,row.allowedTrips)},
  {key:'defense',label:'Opp vs pos',short:'Opp',value:row=>row.defenseRank,render:row=><Rank rank={row.defenseRank} value={row.defenseTds} unit="TD/g"/>},
  {key:'best',label:'Best price',short:'Best',value:row=>row.best?.price,render:row=><BookPrice best={row.best}/>},
  {key:'chance',label:'TD chance',short:'Chance',value:row=>row.chance,render:row=><Chance value={row.chance} fair={row.fair}/>},
 ]}/>;
}
function RzWhy({row,league}){
 return <p className="nfl-why">{row.who.team} reach the red zone <b>{fixed(row.teamTrips,1)}</b> times a game and score on <b>{percent(row.teamRate)}</b> of those trips; {row.opponent} allow <b>{fixed(row.allowedTrips,1)}</b> trips a game and a touchdown on <b>{percent(row.allowedRate)}</b> (league {fixed(league?.trips,1)} and {percent(league?.tdRate)}). {row.who.name} has <b>{percent(row.share)}</b> of his team's red-zone carries and targets ({fixed(row.looks,1)} a game, {fixed(row.inside10,1)} from the 10 in) and {row.rzTds} red-zone touchdowns in {row.games} games. His team is expected to score {fixed(row.teamTds,1)} rushing and receiving touchdowns, {percent(row.portion)} of them his: {fixed(row.expected,2)} expected, a <b>{percent(row.chance)}</b> chance of at least one.</p>;
}

const SPEED_TAGS={burner:['Burner','strong',Zap],faster:['Faster','strong',null],even:['Even','limited',null],slower:['Slower','limited',null]};
function SpeedSheet({data,filter}){
 const [position,setPosition]=useState('all');
 const rows=useMemo(()=>(data.rows||[]).filter(filter).filter(row=>position==='all'||row.who.position===position),[data,filter,position]);
 return <>
  <div className="nfl-controls"><Seg value={position} onChange={setPosition} label="Position" options={[['all','All'],['WR','WR vs CB'],['TE','TE vs S/LB'],['RB','RB vs LB']]}/></div>
  <Table rows={rows} rowKey={row=>row.who.id+row.label} empty="No speed matchups to show." expand={row=><Defenders row={row}/>} moreLabel="Who's across" columns={[
   {key:'player',label:'Player',className:'cs-sticky',render:row=>{const tag=SPEED_TAGS[row.tag];return <Who who={row.who} opponent={row.opponent} startsAt={startOf(data,row.gameId)} tag={tag&&<Tag tone={tag[1]} icon={tag[2]}>{tag[0]}</Tag>}/>;}},
   {key:'pick',label:'Line',render:row=><span className="nfl-two"><b>{num(row.line,1)}</b><small>{row.label}</small></span>},
   {key:'mph',label:'40 speed',value:row=>row.mph,render:row=><span className="nfl-two"><b>{fixed(row.mph,1)} mph</b><small>{fixed(row.forty,2)}s 40</small></span>},
   {key:'across',label:'Across from him',render:row=><span className="nfl-across">{row.defenders.slice(0,2).map(item=><span key={item.id}><b>{item.name}</b><small>{item.slot} · {finite(item.forty)?`${fixed(item.forty,2)}s`:'no time'}{finite(item.edge)&&<em data-tone={item.edge>0?'good':'bad'}> {item.edge>0?'+':''}{fixed(item.edge,1)}</em>}</small></span>)}</span>},
   {key:'edge',label:'Speed edge',value:row=>row.edge,render:row=><span className="nfl-two"><b data-tone={row.edge>0.1?'good':row.edge<-0.1?'bad':undefined}>{row.edge>0?'+':''}{fixed(row.edge,1)} mph</b><small>faster than {row.faster}/{row.timed}</small></span>},
   {key:'athletic',label:'Vert · Broad · 3-cone',short:'Athletic',render:row=><span className="nfl-two"><b>{finite(row.vertical)?`${fixed(row.vertical,1)}"`:'—'} · {finite(row.broad)?`${num(row.broad,0)}"`:'—'}</b><small>3-cone {finite(row.cone)?`${fixed(row.cone,2)}s`:'—'}</small></span>},
   {key:'l10',label:'L10',value:row=>row.hits?.l10?.rate,render:row=><Rate hit={row.hits?.l10}/>},
   {key:'best',label:'Price',value:row=>row.best?.price,render:row=><BookPrice best={row.best}/>},
   {key:'score',label:'Score',value:row=>row.score,render:row=><Score value={row.score} label="Speed score"/>},
  ]}/>
 </>;
}
function Defenders({row}){
 return <div className="nfl-defenders"><p>{row.who.name} ran {fixed(row.forty,2)}s at the Combine ({fixed(row.mph,1)} mph over 40 yards). {row.opponent}'s starters across from him:</p>
  <ul>{row.defenders.map(item=><li key={item.id}><Face src={item.headshot} name={item.name} size="sm"/><b>{item.name}</b><small>{item.slot}</small>
   <span>{finite(item.forty)?`${fixed(item.forty,2)}s · ${fixed(item.mph,1)} mph`:'No Combine time'}</span>
   {finite(item.edge)&&<em data-tone={item.edge>0?'good':'bad'}>{item.edge>0?'+':''}{fixed(item.edge,1)} mph</em>}</li>)}</ul></div>;
}

function SteamSheet({data,filter}){
 const [direction,setDirection]=useState('all');
 const rows=useMemo(()=>(data.rows||[]).filter(row=>!row.gameId||filter(row)).filter(row=>direction==='all'||row.direction===direction),[data,filter,direction]);
 return <>
  <div className="nfl-controls"><Seg value={direction} onChange={setDirection} label="Direction" options={[['all','All'],['up','Moving up'],['down','Moving down']]}/></div>
  {data.recording&&<p className="cs-note"><Info aria-hidden="true"/>Opening numbers are being recorded as books post them. Moves show up here as lines change.</p>}
  <Table rows={rows} rowKey={row=>`${row.who.name}|${row.label}`} empty="No lines have moved yet." expand={row=><Prices prices={row.byBook.map(item=>({book:item.book,name:BOOK_NAMES[item.book],over:item.over,under:item.under}))}/>} moreLabel="Every book" columns={[
   {key:'player',label:'Player',className:'cs-sticky',render:row=><Who who={row.who} opponent={row.opponent} startsAt={row.startsAt} tag={<Tag tone={row.tag==='steam'?'hot':'limited'} icon={row.tag==='steam'?Flame:null}>{row.tag==='steam'?'Steam':'Drift'}</Tag>}/>},
   {key:'label',label:'Market',render:row=><span className="nfl-market">{row.label}</span>},
   {key:'move',label:'Open → now',render:row=><span className="nfl-move" data-dir={row.direction}>{num(row.open,1)}<ArrowRight aria-hidden="true"/><b>{num(row.now,1)}</b>{row.direction==='up'?<ArrowUp aria-hidden="true"/>:<ArrowDown aria-hidden="true"/>}</span>},
   {key:'change',label:'Move',value:row=>Math.abs(row.change||0),render:row=><b data-tone={row.direction==='up'?'good':'bad'}>{row.change>0?'+':''}{num(row.change,1)}</b>},
   {key:'juice',label:'Juice',value:row=>Math.abs(row.juice||0),render:row=>finite(row.juice)&&row.juice!==0?`${row.juice>0?'+':''}${fixed(row.juice,0)} pts`:'—'},
   {key:'books',label:'Books',value:row=>row.agree,render:row=><span className="nfl-two"><b>{row.agree}/{row.books}</b><small>moved together</small></span>},
   {key:'score',label:'Score',value:row=>row.score,render:row=><Score value={row.score} label="Move score"/>},
  ]}/>
 </>;
}

function ShopSheet({data,filter}){
 const [kind,setKind]=useState('all');
 const all=(data.rows||[]).filter(filter);
 const rows=useMemo(()=>all.filter(row=>kind==='all'||row.kind===kind),[all,kind]);
 return <>
  <div className="nfl-controls"><Seg value={kind} onChange={setKind} label="Kind" options={[['all','All',all.length],['price','Better price',all.filter(row=>row.kind==='price').length],['line','Off-market line',all.filter(row=>row.kind==='line').length]]}/></div>
  <Table rows={rows} rowKey={row=>`${row.id}|${row.kind}`} empty="No prices beat the market right now." expand={row=>row.prices?<Prices prices={row.prices}/>:<p className="nfl-why">Most books are at {num(row.center,1)}. {row.where.join(', ')} {row.where.length===1?'posts':'post'} {num(row.line,1)}, so {row.side==='over'?'More':'Less'} is {num(row.gap,1)} easier there.</p>} moreLabel="Every price" columns={[
   {key:'player',label:'Player',className:'cs-sticky',render:row=><Who who={row.who} opponent={row.opponent} startsAt={row.startsAt}/>},
   {key:'pick',label:'Pick',render:row=><Pick side={row.side} line={row.line} label={row.label}/>},
   {key:'where',label:'Where',render:row=>row.kind==='price'?<BookPrice best={{book:row.book,name:row.bookName,price:row.price}}/>:<span className="nfl-two"><b>{row.where.slice(0,2).join(', ')}</b><small>{row.price?`${price(row.price.price)} ${row.price.name}`:'pick\'em line'}</small></span>},
   {key:'market',label:'Market',render:row=>row.kind==='price'?<span className="nfl-two"><b>fair {price(row.fair)}</b><small>{percent(row.chance)} · {row.books} books</small></span>:<span className="nfl-two"><b>{num(row.center,1)}</b><small>{row.marketBooks} books</small></span>},
   {key:'l10',label:'L10 here',value:row=>row.kind==='price'?row.hits?.l10?.rate:row.l10,render:row=>row.kind==='price'?<Rate hit={row.hits?.l10}/>:<span className="nfl-two"><b data-tone={rateTone(row.l10)}>{percent(row.l10)}</b><small>{percent(row.l10Center)} at {num(row.center,1)}</small></span>},
   {key:'edge',label:'Edge',value:row=>row.kind==='price'?row.edge:row.gap/Math.max(Math.abs(row.center),1),render:row=>row.kind==='price'?<Edge value={row.edge}/>:<span className="nfl-edge" data-tone="good">{num(row.gap,1)} {row.side==='over'?'lower':'higher'}</span>},
  ]}/>
 </>;
}

function DvpSheet({data}){
 const [stat,setStat]=useState('fantasy');
 const [span,setSpan]=useState('l5');
 const [playing,setPlaying]=useState(true);
 const definition=(data.stats||[]).find(item=>item.key===stat)||data.stats?.[0];
 const positions=definition?.positions||POSITIONS;
 const teams=data.ranked||32;
 const rows=useMemo(()=>(data.teams||[]).filter(team=>!playing||team.opponent).map(team=>({...team,id:team.team})),[data,playing]);
 const cell=(team,position)=>data.cells?.[team]?.[position]?.[stat]?.[span];
 const league=data.league||{};
 return <>
  <div className="nfl-controls nfl-dvp-controls">
   <Chips value={stat} onChange={setStat} label="Stat" options={(data.stats||[]).map(item=>[item.key,item.label])}/>
   <div className="nfl-control-row">
    <Seg value={span} onChange={setSpan} label="Window" options={[['l3','L3'],['l5','L5'],['l10','L10'],['szn','Season']]}/>
    <Seg value={playing?'playing':'all'} onChange={key=>setPlaying(key==='playing')} label="Defenses" options={[['playing','Playing'],['all','All 32']]}/>
   </div>
  </div>
  <Table key={stat+span} rows={rows} initial={{key:positions[0],dir:-1}} empty="No defenses to show." columns={[
   {key:'team',label:'Defense',className:'cs-sticky',render:row=><span className="cs-who"><span className="nfl-team-logo"><Img src={row.logo}/></span><span className="cs-who-main"><span className="cs-who-name"><strong>{row.team}</strong></span><span className="cs-who-meta">{row.opponent?<>{row.home?'vs':'@'} {row.opponent}<i>·</i>{row.started?'Started':kick(row.startsAt)}</>:`${row.games} games`}</span></span></span>},
   ...positions.map(position=>({key:position,label:`vs ${position}`,value:row=>cell(row.team,position)?.[1],render:row=>{const found=cell(row.team,position);return found?<span className="nfl-dvp-cell" data-tone={found[1]>=teams-7?'good':found[1]<=8?'bad':undefined}><b>#{found[1]}</b><small>{fixed(found[0],found[0]<10?2:1)}</small></span>:'—';}})),
  ]}/>
  <p className="cs-legend"><span>League a game</span>{positions.map(position=><b key={position}>{position} {fixed(league[position]?.[stat]?.[span],1)}</b>)}<span>#1 allows the least, #{teams} the most</span></p>
 </>;
}

function SoftSheet({data,filter}){
 const [position,setPosition]=useState('all');
 const [market,setMarket]=useState('all');
 const base=(data.spots||[]).filter(filter);
 const markets=[...new Map(base.map(row=>[row.market,row.label])).entries()];
 const rows=useMemo(()=>base.filter(row=>(position==='all'||row.who.position===position)&&(market==='all'||row.market===market)),[base,position,market]);
 return <>
  <div className="nfl-controls">
   <Seg value={position} onChange={setPosition} label="Position" options={[['all','All'],...POSITIONS.map(item=>[item,item])]}/>
   <Chips value={market} onChange={setMarket} label="Stat" options={[['all','All stats'],...markets]}/>
  </div>
  <Table rows={rows} empty="No soft spots on the board right now." expand={row=><><p className="nfl-why">{row.opponent} allow <b>{fixed(row.allowed,1)}</b> {row.label.toLowerCase()} a game to {row.who.position}s over their last 5 (league {fixed(row.average,1)}): <b>#{row.rank}</b> of {row.teams}{finite(row.sznRank)?`, #${row.sznRank} on the season`:''}.</p><Prices prices={row.prices}/></>} moreLabel="Why and prices" columns={[
   {key:'player',label:'Player',className:'cs-sticky',render:row=><Who who={row.who} opponent={row.opponent} startsAt={row.startsAt} tag={<Tag tone={row.tier==='elite'?'hot':row.tier==='strong'?'strong':'limited'}>{row.tier==='elite'?'Elite':row.tier==='strong'?'Strong':'Lean'}</Tag>}/>},
   {key:'pick',label:'Pick',render:row=><Pick line={row.line} label={row.label}/>},
   {key:'rank',label:'Opp',value:row=>row.rank,render:row=><Rank rank={row.rank} teams={row.teams}/>},
   {key:'allowed',label:'Allows',value:row=>row.allowed,render:row=><span className="nfl-two"><b>{fixed(row.allowed,1)}</b><small>avg {fixed(row.average,1)}</small></span>},
   {key:'l5',label:'L5',value:row=>row.hits.l5.rate,render:row=><Rate hit={row.hits.l5}/>},
   {key:'l10',label:'L10',value:row=>row.hits.l10.rate,render:row=><Rate hit={row.hits.l10}/>},
   {key:'szn',label:'Season',value:row=>row.hits.szn.rate,render:row=><Rate hit={row.hits.szn}/>},
   {key:'best',label:'Best',value:row=>row.best?.price,render:row=><BookPrice best={row.best}/>},
   {key:'versus',label:'vs avg',value:row=>row.versus,render:row=><span className="nfl-versus">+{Math.round((row.versus||0)*100)}%</span>},
   {key:'score',label:'Score',value:row=>row.score,render:row=><Score value={row.score} label="Spot score"/>},
  ]}/>
 </>;
}

function GoblinsSheet({data,filter}){
 const [kind,setKind]=useState('all');
 const [market,setMarket]=useState('all');
 const base=(data.lines||[]).filter(filter);
 const markets=[...new Map(base.map(row=>[row.market,row.label])).entries()];
 const rows=useMemo(()=>base.filter(row=>(kind==='all'||row.kind===kind)&&(market==='all'||row.market===market)),[base,kind,market]);
 return <>
  <div className="nfl-controls">
   <Seg value={kind} onChange={setKind} label="Line" options={[['all','Both',base.length],['goblin','Goblins',base.filter(row=>row.kind==='goblin').length],['demon','Demons',base.filter(row=>row.kind==='demon').length]]}/>
   <Chips value={market} onChange={setMarket} label="Stat" options={[['all','All stats'],...markets]}/>
  </div>
  <Table rows={rows} empty="No goblins or demons the books price right now." expand={row=><Prices prices={row.prices}/>} moreLabel="Every price" columns={[
   {key:'player',label:'Player',className:'cs-sticky',render:row=><Who who={row.who} opponent={row.opponent} startsAt={row.startsAt} tag={<span className="nfl-kind" data-kind={row.kind}><img src={`/prizepicks/${row.kind}.png`} alt=""/>{row.kind==='goblin'?'Goblin':'Demon'}</span>}/>},
   {key:'line',label:'PrizePicks',render:row=><span className="nfl-pp"><img src="/prizepicks/logo.png" alt=""/><Pick line={row.line} label={row.label}/></span>},
   {key:'main',label:'Main',value:row=>row.main,format:value=>num(value,1)},
   {key:'books',label:'Books',value:row=>row.price,render:row=><span className="nfl-two"><b>{price(row.price)}</b><small>{row.books} book{row.books===1?'':'s'}</small></span>},
   {key:'l5',label:'L5',value:row=>row.hits.l5.rate,render:row=><Rate hit={row.hits.l5}/>},
   {key:'l10',label:'L10',value:row=>row.hits.l10.rate,render:row=><Rate hit={row.hits.l10}/>},
   {key:'szn',label:'Season',value:row=>row.hits.szn.rate,render:row=><Rate hit={row.hits.szn}/>},
   {key:'chance',label:'Books chance',short:'Chance',value:row=>row.chance,render:row=><Chance value={row.chance}/>},
  ]}/>
 </>;
}

// ---------------------------------------------------------------- rails

const top=(rows,count=5)=>(rows||[]).slice(0,count);
function rails(sheet,data){
 const face=row=>({headshot:row.who?.headshot,name:row.who?.name,team:row.who?.team});
 switch(sheet){
  case 'best':return [{title:'Best in each game',sub:'Matchup score',items:top((data.rows||[]).filter(row=>row.top),8).map(row=>({key:row.id,face:face(row),name:row.who.name,meta:`More ${num(row.line,1)} ${row.label} · vs ${row.opponent}`,value:row.score,bar:(row.score||0)/100}))},
   {title:'Biggest projection edges',sub:'Projection over the line',items:top([...(data.rows||[])].sort((a,b)=>(b.edge||0)-(a.edge||0))).map(row=>({key:row.id,face:face(row),name:row.who.name,meta:`More ${num(row.line,1)} ${row.label}`,value:`+${Math.round((row.edge||0)*100)}%`,tone:'good',sub:`proj ${fixed(row.projection,1)}`}))}];
  case 'td':{const leaks=(data.cards||[]).flatMap(card=>card.sides.flatMap(side=>side.defense.map(leak=>({...leak,team:side.opponent,versus:side.team})))).filter(leak=>finite(leak.rank)).sort((a,b)=>b.rank-a.rank||(b.allowed||0)-(a.allowed||0));
   return [{title:'Top TD chances',sub:'This week',items:top(data.players).map(row=>({key:row.who.id,face:face(row),name:row.who.name,meta:`${row.who.position} · ${row.who.team} vs ${row.opponent}`,value:percent(row.chance),sub:`fair ${price(row.fair)}`}))},
    {title:'Leakiest TD defenses',sub:'Touchdowns allowed a game, by position',items:top(leaks,6).map(leak=>({key:leak.team+leak.position,logo:teamLogo(leak.team),name:`${leak.team} vs ${leak.position}`,meta:`plays ${leak.versus}`,value:`#${leak.rank}`,tone:'good',sub:`${fixed(leak.allowed,2)}/g`}))}];}
  case 'firsttd':return [{title:'Fastest starters',sub:'TD on the first two drives',items:(data.bestEarly||[]).map(item=>({key:item.team,logo:teamLogo(item.team),name:item.team,meta:`vs ${item.opponent}`,value:percent(item.early),sub:`${item.earlyTds}/${item.earlyGames} games`,bar:item.early}))},
   {title:'Softest early defenses',sub:'Allow a TD on the first two drives',items:(data.softEarly||[]).map(item=>({key:item.team+item.versus,logo:teamLogo(item.team),name:`${item.team} defense`,meta:`faces ${item.versus}`,value:percent(item.allowed),bar:item.allowed}))}];
  case 'streaks':return [{title:'Longest streaks',sub:'Games in a row',items:top([...(data.rows||[])].sort((a,b)=>b.streak-a.streak),6).map(row=>({key:row.id,face:face(row),name:row.who.name,meta:`${row.side==='under'?'Less':'More'} ${num(row.line,1)} ${row.label}`,value:`${row.streak}`,sub:'straight'}))}];
  case 'zones':return [{title:'Top zone edges',sub:'Zone score',items:top(data.rows).map(row=>({key:row.who.id,face:face(row),name:row.who.name,meta:`${ZONE_NAMES[row.zones[0]?.zone]||''} vs ${row.opponent}`,value:row.score}))},
   {title:'Softest zones',sub:'Yards per target allowed',items:(data.softest||[]).map(item=>({key:item.team+item.zone,logo:teamLogo(item.team),name:`${item.team} ${ZONE_NAMES[item.zone]?.toLowerCase()}`,meta:`${item.targets} targets`,value:`${fixed(item.allowed,1)}`,sub:`#${item.rank}`,tone:'good'}))}];
  case 'redzone':return [{title:'Top red-zone roles',sub:'TD chance',items:top(data.rows).map(row=>({key:row.who.id,face:face(row),name:row.who.name,meta:`${percent(row.share)} of ${row.who.team}'s RZ looks`,value:percent(row.chance)}))},
   {title:'Leakiest red zones',sub:'Red-zone TDs allowed a game',items:(data.leaky||[]).map(item=>({key:item.team,logo:teamLogo(item.team),name:`${item.team} defense`,meta:`${fixed(item.trips,1)} trips · ${percent(item.tdRate)} TD`,value:fixed(item.tds,1),bar:(item.tdRate||0)}))}];
  case 'speed':return [{title:'Biggest speed edges',sub:'Over the fastest defender across',items:top([...(data.rows||[])].sort((a,b)=>b.edge-a.edge),6).map(row=>({key:row.who.id+row.label,face:face(row),name:row.who.name,meta:`${row.who.position} vs ${row.opponent}`,value:`${row.edge>0?'+':''}${fixed(row.edge,1)}`,sub:'mph',tone:row.edge>0?'good':undefined}))}];
  case 'steam':return [{title:'Biggest moves',sub:'Open to now',items:top(data.rows,6).map(row=>({key:row.who.name+row.label,face:face(row),name:row.who.name,meta:row.label,value:`${num(row.open,1)} → ${num(row.now,1)}`,tone:row.direction==='up'?'good':'bad'}))}];
  case 'shop':return [{title:'Best prices',sub:'Expected return at the fair chance',items:top((data.rows||[]).filter(row=>row.kind==='price'),6).map(row=>({key:row.id,face:face(row),name:row.who.name,meta:`${row.side==='under'?'Less':'More'} ${num(row.line,1)} ${row.label} · ${row.bookName}`,value:`+${((row.edge||0)*100).toFixed(1)}%`,tone:'good',sub:price(row.price)}))}];
  case 'dvp':return [{title:'Softest spots this week',sub:'Fantasy points allowed, last 5',items:(data.softest||[]).map(item=>({key:item.team+item.position,logo:teamLogo(item.team),name:`${item.team} vs ${item.position}`,meta:`plays ${item.opponent}`,value:`#${item.rank}`,tone:'good',sub:`${fixed(item.allowed,1)} allowed`}))}];
  case 'soft':return [{title:'Best soft spots',sub:'vs league average',items:top(data.spots).map(row=>({key:row.id,face:face(row),name:row.who.name,meta:`More ${num(row.line,1)} ${row.label} · vs ${row.opponent}`,value:`+${Math.round((row.versus||0)*100)}%`,tone:'good',sub:`#${row.rank} of ${row.teams}`}))},
   {title:'Softest defenses',sub:'Props lined up against them',items:(data.defenses||[]).map(item=>({key:item.team+item.position,logo:teamLogo(item.team),name:`${item.team} vs ${item.position}`,value:item.props,sub:'props',bar:item.props/Math.max(data.defenses[0]?.props||1,1)}))}];
  case 'goblins':return [{title:'Safest goblins',sub:"Books' chance at the goblin line",items:top((data.lines||[]).filter(row=>row.kind==='goblin')).map(row=>({key:row.id,face:face(row),name:row.who.name,meta:`More ${num(row.line,1)} ${row.label}`,value:percent(row.chance),tone:'good',sub:`${row.books} books`}))},
   {title:'Likeliest demons',sub:"Books' chance at the demon line",items:top((data.lines||[]).filter(row=>row.kind==='demon')).map(row=>({key:row.id,face:face(row),name:row.who.name,meta:`More ${num(row.line,1)} ${row.label}`,value:percent(row.chance),sub:`${row.books} books`}))}];
  default:return [];
 }
}
const MAIN_ROWS={best:'rows',td:'players',streaks:'rows',zones:'rows',redzone:'rows',speed:'rows',steam:'rows',shop:'rows',soft:'spots',goblins:'lines'};

// ---------------------------------------------------------------- the view

export function NflSheetView({sheetKey,sheets,onOpen}){
 const admin=useIsAdmin();
 const sheet=sheets.find(item=>item.key===sheetKey)||sheets[0];
 const [state,setState]=useState({loading:true,data:null,error:null});
 const [game,setGame]=useState('all');
 const [query,setQuery]=useState('');
 const load=(force=false)=>{
  setState(current=>({...current,loading:true,error:null}));
  fetchSheet(sheet.key,force).then(data=>setState({loading:false,data,error:null})).catch(error=>setState({loading:false,data:null,error:error.message}));
 };
 useEffect(()=>{setGame('all');setQuery('');load();},[sheet.key]);
 const data=state.data?.sheet===sheet.key?state.data:null;
 const filter=useMemo(()=>{const wanted=nameKey(query);return row=>(game==='all'||row.gameId===game)&&(!wanted||nameKey(row.who?.name).includes(wanted));},[game,query]);
 const upcoming=(data?.games||[]).filter(item=>!item.started);
 const listed=sheet.key!=='dvp';
 const mainRows=MAIN_ROWS[sheet.key]?data?.[MAIN_ROWS[sheet.key]]||[]:null;
 const counts=mainRows?countBy(mainRows):sheet.key==='firsttd'?Object.fromEntries((data?.cards||[]).map(card=>[card.gameId,card.sides.reduce((sum,side)=>sum+side.players.length,0)])):null;
 const side=data?rails(sheet.key,data):[];
 const Icon=sheet.icon;
 return <div className="cs-view" style={{'--sheet':sheet.tint}}>
  <nav className="cs-tabs" aria-label="Sheets">{sheets.map(item=>{const ItemIcon=item.icon;return <button key={item.key} type="button" style={{'--tab':item.tint}} aria-current={item.key===sheet.key?'page':undefined} data-active={item.key===sheet.key?'':undefined} onClick={()=>onOpen(item.key)}>
   <ItemIcon aria-hidden="true"/>{item.title}
  </button>;})}</nav>
  <section className="cs-sheet">
   <header className="cs-sheet-head nfl-sheet-head">
    <div className="cs-sheet-title"><span className="cs-sheet-kicker"><span className="cs-icon"><Icon aria-hidden="true"/></span>{sheet.kicker}</span><h2>{sheet.title}</h2><p>{sheet.blurb}</p>
     <small>{data?<>{data.week?`Week ${data.week}`:'This week'}<i>·</i>{upcoming.length} game{upcoming.length===1?'':'s'} to come<i>·</i>updated {time(data.updatedAt)}</>:'Loading…'}</small></div>
    <div className="cs-sheet-actions">
     <button type="button" className="cs-icon-btn" onClick={()=>load(true)} aria-label="Refresh" disabled={state.loading}><RefreshCw data-spin={state.loading?'':undefined} aria-hidden="true"/></button>
    </div>
   </header>
   {listed&&data&&<div className="cs-filters">
    <div className="cs-chips-row cs-scroll" role="tablist" aria-label="Game"><button type="button" data-active={game==='all'?'':undefined} onClick={()=>setGame('all')}>All games</button>
     {upcoming.map(item=><button key={item.gameId} type="button" data-active={game===item.gameId?'':undefined} onClick={()=>setGame(item.gameId)}><Img className="cs-logo" src={teamLogo(item.away)}/>{item.away}<i>@</i><Img className="cs-logo" src={teamLogo(item.home)}/>{item.home}</button>)}</div>
    {sheet.key!=='firsttd'&&<label className="cs-search"><Search aria-hidden="true"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find a player" aria-label="Find a player"/></label>}
   </div>}
   <div className="nfl-layout" data-rail={side.length?'':undefined}>
    <div className="cs-body" data-loading={state.loading?'':undefined}>
     {state.error?<div className="cs-error"><p>{admin?state.error:'This sheet is still being put together. Check back in a minute.'}</p><button type="button" onClick={()=>load(true)}>{admin?'Try again':'Refresh'}</button></div>
      :!data?<Skeleton/>
      :sheet.key==='best'?<BestSheet data={data} filter={filter} game={game}/>
      :sheet.key==='td'?<TdSheet data={data} filter={filter} game={game}/>
      :sheet.key==='firsttd'?<FirstTdSheet data={data} game={game}/>
      :sheet.key==='streaks'?<StreaksSheet data={data} filter={filter}/>
      :sheet.key==='zones'?<ZonesSheet data={data} filter={filter}/>
      :sheet.key==='redzone'?<RedZoneSheet data={data} filter={filter}/>
      :sheet.key==='speed'?<SpeedSheet data={data} filter={filter}/>
      :sheet.key==='steam'?<SteamSheet data={data} filter={filter}/>
      :sheet.key==='shop'?<ShopSheet data={data} filter={filter}/>
      :sheet.key==='dvp'?<DvpSheet data={data}/>
      :sheet.key==='soft'?<SoftSheet data={data} filter={filter}/>
      :<GoblinsSheet data={data} filter={filter}/>}
    </div>
    {data&&side.length>0&&<aside className="nfl-rail">
     {side.map(item=><RailList key={item.title} {...item}/>)}
     {listed&&<Slate data={data} counts={counts} game={game} setGame={setGame}/>}
    </aside>}
   </div>
   <Faq items={[['What\'s on this sheet?',sheet.about],...(FAQ[sheet.key]||[])]}/>
  </section>
 </div>;
}
