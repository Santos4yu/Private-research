// The words for an NFL player page's "How it plays", "vs them" and Metrics
// sections, from /api/nfl?resource=finder-plays (nfl_plays.py): what each
// split and look is called, the one-line read of each split, the bottom
// line across them, and how a metric's value and rank are written. Pure, so
// tests/nfl-plays.test.mjs can check every sentence.
const finite=value=>typeof value==='number'&&Number.isFinite(value);
// Rates keep their decimals ("6.0", not "6"), so a column lines up.
const round=(value,digits)=>Number(value.toFixed(digits)).toLocaleString(undefined,{minimumFractionDigits:digits,maximumFractionDigits:digits});
export const ordinal=n=>`${n}${n%100>=11&&n%100<=13?'th':['th','st','nd','rd'][n%10]||'th'}`;
export const pct=value=>finite(value)?`${Math.round(value*100)}%`:'—';
export const num=(value,digits=1)=>finite(value)?round(value,digits):'—';

/** Rank 1 = the most: "8th most", "7th fewest", "the most", "the fewest". */
export function mostWords(rank,of){
 if(!finite(rank)||!of)return '';
 if(rank===1)return 'the most';
 if(rank===of)return 'the fewest';
 return rank<=of/2?`${ordinal(rank)} most`:`${ordinal(of-rank+1)} fewest`;
}
/** A rank where 1 is best: "11th of 65". */
export const rankWords=(rank,of)=>finite(rank)&&of?`${ordinal(rank)} of ${of}`:'';
/** Top third good, bottom third poor (1 = best). */
export const toneOfRank=(rank,of)=>!finite(rank)||!of||of<3?undefined:rank<=of/3?'good':rank>of*2/3?'poor':undefined;
/** For what a defense allows (1 = allows the most): the most is soft. */
export const softTone=(rank,of)=>!finite(rank)||!of||of<3?undefined:rank<=of/3?'soft':rank>of*2/3?'tough':undefined;

export const GROUP_NOUNS={QB:'Quarterbacks',RB:'Running backs',WR:'Receivers',TE:'Tight ends'};
export const SPLIT_TITLES={box:'Box count',direction:'Direction',lane:'Run lane',depth:'Depth',area:'Field area',
 blitz:'Against the blitz',playAction:'Play-action',coverage:'Coverage'};
export const LOOKS={
 box:{light:'Light box (6 or fewer)',base:'Base box (7)',stacked:'Stacked box (8+)'},
 direction:{left:'Left',middle:'Middle (at the guards)',right:'Right'},
 lane:{end:'Outside (end)',tackle:'Off tackle',guard:'Guard',middle:'Center'},
 depth:{behind:'Behind the line',short:'Short (0-9 yds)',intermediate:'Mid (10-19 yds)',deep:'Deep (20+ yds)'},
 area:{left:'Left side',middle:'Middle',right:'Right side'},
 blitz:{blitz:'Blitz (5+ rushers)',calm:'No blitz'},
 playAction:{pa:'Play-action',nopa:'Straight drop-back'},
 coverage:{man:'Man (Cover 0, 1, 2-Man)',cover3:'Cover 3',split:'Split safety (Cover 2, 4, 6, 9)'}};
// What his share in a look is a share of, and what a rate is per.
const UNITS={run:['carry','carries'],target:['target','targets'],pass:['throw','throws']};
const PHRASES={
 box:{light:'come against a light box',base:'come against a base 7-man box',stacked:'come against a stacked box'},
 direction:{left:'go left',middle:'go up the middle',right:'go right'},
 lane:{end:'bounce outside the tackles',tackle:'go off tackle',guard:'hit the guard holes',middle:'go straight up the center'},
 depth:{behind:'are behind the line',short:'are short (0-9 yards)',intermediate:'go 10-19 yards',deep:'go deep (20+ yards)'},
 area:{left:'go to the left side',middle:'go over the middle',right:'go to the right side'},
 coverage:{man:'come against man coverage',cover3:'come against Cover 3',split:'come against split-safety coverage'}};
// Splits whose first read is how often the defense shows the look, not what it allows in it.
const SHOWN=new Set(['box','blitz','playAction','coverage']);
export const showsShare=split=>SHOWN.has(split.split);

/** The column names of a split's table. */
export function columns(split,opponent){
 const [unit]=UNITS[split.kind]||UNITS.target;
 const rate=split.kind==='run'?'His YPC':`His yds/${unit==='target'?'tgt':'throw'}`;
 const theirs=split.split==='box'?'show it':split.split==='blitz'?'blitz':split.split==='playAction'?'face it':
  split.split==='coverage'?'play it':'allow';
 return [split.kind==='run'?'His share of carries':`His share of ${UNITS[split.kind][1]}`,`${opponent} ${theirs}`,rate];
}

const lastSeason=(split,season)=>finite(split.season)&&finite(season)&&split.season<season;

/** The one-line read of a split: where he does most of his work and how the opponent handles it. */
export function headline(split,{opponent,team,season}={}){
 const [unit,units]=UNITS[split.kind]||UNITS.target;
 const rows=(split.rows||[]).filter(row=>row.his?.n>0);
 const when=lastSeason(split,season);
 if(!rows.length)return when?`No ${units} on record in ${split.season}.`:`No ${units} on record yet.`;
 const by=key=>split.rows.find(row=>row.key===key);
 if(split.split==='blitz'){
  const blitz=by('blitz'),calm=by('calm'),them=blitz?.them;
  const lead=split.kind==='target'&&finite(blitz?.his?.teamShare)&&finite(calm?.his?.teamShare)
   ?`He gets ${pct(blitz.his.teamShare)} of ${team||'his team'}’s targets when the defense blitzes, ${pct(calm.his.teamShare)} when it doesn’t.`
   :finite(blitz?.his?.value)?`He averages ${num(blitz.his.value)} yards a ${unit} against the blitz${finite(blitz.his.rank)?` (${rankWords(blitz.his.rank,blitz.his.of)})`:''}${finite(calm?.his?.value)?`, ${num(calm.his.value)} without it`:''}.`:'';
  const tail=them&&finite(them.share)?` ${opponent} blitz on ${pct(them.share)} of throws (${mostWords(them.shareRank,them.of)})${finite(them.value)?` and allow ${num(them.value,2)} yards a throw when they do`:''}.`:'';
  return (lead+tail).trim();
 }
 if(split.split==='playAction'){
  const pa=by('pa');
  const lead=`He uses play-action on ${pct(pa?.his?.share)} of his throws${finite(pa?.his?.value)?` (${num(pa.his.value)} yards a throw)`:''}.`;
  const them=pa?.them;
  return them&&finite(them.value)?`${lead} ${opponent} allow ${num(them.value,2)} yards a throw against it, ${mostWords(them.rank,them.of)}.`:lead;
 }
 const top=rows.reduce((best,row)=>row.his.share>best.his.share?row:best);
 const past=Boolean(when);
 const phrase=PHRASES[split.split]?.[top.key]||`go ${LOOKS[split.split]?.[top.key]||top.key}`;
 const lead=`${past?`In ${split.season}, `:''}${pct(top.his.share)} of his ${units} ${past?pastTense(phrase):phrase}`;
 const them=top.them;
 if(!them||!them.n)return `${lead}.`;
 const per=split.kind==='run'||split.split==='box'?'carry':'throw';
 if(showsShare(split)){
  const what=split.split==='box'?'backs’ carries':'throws';
  const shows=split.split==='box'?(past?'showed one':'show one'):(past?'played it':'play it');
  return `${lead}. ${opponent} ${shows} on ${pct(them.share)} of ${what} (${mostWords(them.shareRank,them.of)})${finite(them.value)?` and ${past?'allowed':'allow'} ${num(them.value,2)} yards a ${per} against it`:''}.`;
 }
 const sample=split.kind==='run'?'':` (${them.n} ${them.n===1?'throw':'throws'})`;
 return `${lead}. ${opponent} ${past?'allowed':'allow'} ${num(them.value,2)} yards a ${per} there${sample}, ${mostWords(them.rank,them.of)}.`;
}
// "come against man coverage" -> "came against man coverage".
const PAST={come:'came',go:'went',are:'were',bounce:'bounced',hit:'hit'};
const pastTense=phrase=>phrase.replace(/^(\w+)/,word=>PAST[word]||word);

/**
 * The bottom line across the splits: the look he lives in where the
 * opponent is furthest from the league, for or against him. Null when no
 * look stands out (each within 8% of the league).
 */
export function bottomLine(splits,{opponent,season}={}){
 let best=null;
 for(const split of splits||[]){
  if(split.split==='blitz'||split.split==='playAction'||lastSeason(split,season))continue;
  for(const row of split.rows||[]){
   const them=row.them,league=row.league?.value;
   if(!them||!finite(them.value)||!finite(league)||!league||!(row.his?.share>=0.2))continue;
   // Thin samples say little: a defense's look needs plays in it.
   if(them.n<(split.kind==='run'?15:20))continue;
   const edge=them.value/league-1,weight=edge*row.his.share;
   if(Math.abs(edge)>=0.08&&(!best||Math.abs(weight)>Math.abs(best.weight)))best={split,row,edge,weight};
  }
 }
 if(!best)return null;
 const {split,row,edge}=best;
 const [unit,units]=UNITS[split.kind]||UNITS.target;
 const per=split.kind==='run'?'carry':'throw';
 const phrase=PHRASES[split.split]?.[row.key]||`come ${LOOKS[split.split]?.[row.key]||row.key}`;
 const his=finite(row.his.value)?` He averages ${num(row.his.value)} yards a ${unit} there${finite(row.his.rank)?` (${rankWords(row.his.rank,row.his.of)})`:''}.`:'';
 return `${pct(row.his.share)} of his ${units} ${phrase}, and ${opponent} allow ${num(row.them.value,2)} yards a ${per} there, ${mostWords(row.them.rank,row.them.of)} (league average ${num(row.league.value,2)}).${his} That ${edge>0?'helps':'works against'} his over.`;
}

// ------------------------------------------------------------ vs them
export const FACED_LABELS={rushing_yards:'RUSH YDS',rush_attempts:'CAR',receiving_yards:'REC YDS',receptions:'REC',targets:'TGT',
 receiving_tds:'REC TD',passing_yards:'PASS YDS',passing_touchdowns:'PASS TD',pass_completions:'CMP'};
/** What a game is measured against: his line that day, else his average going in. */
export function bar(row,stat){
 if(finite(row.lines?.[stat]))return {kind:'line',value:row.lines[stat]};
 if(finite(row.base?.[stat]))return {kind:'avg',value:row.base[stat]};
 return null;
}
export function beat(row,stat){
 const against=bar(row,stat),value=row.values?.[stat];
 if(!against||!finite(value)||value===against.value)return null;
 return value>against.value;
}
/** [{stat, beat, of}]: how many cleared their line (or average) in each stat. */
export function facedTally(faced){
 return (faced?.stats||[]).map(stat=>{
  const calls=(faced.rows||[]).map(row=>beat(row,stat)).filter(call=>call!==null);
  return {stat,beat:calls.filter(Boolean).length,of:calls.length};
 });
}

// ------------------------------------------------------------ metrics
export function metricValue(item){
 const value=item?.value;
 if(!finite(value))return '—';
 switch(item.format){
  case 'int':return round(value,0);
  case '2':return num(value,2);
  case 'pct':return `${num(value*100,1)}%`;
  case 'signed':return `${value>=0?'+':'−'}${Math.abs(value).toFixed(2)}`;
  case 'signedPct':return `${value>=0?'+':'−'}${num(Math.abs(value)*100,1)}%`;
  default:return num(value,1);
 }
}
/** How far along the bar goes: where his rank sits among those ranked (best at full). */
export const rankFill=(rank,of)=>finite(rank)&&of?Math.max(0.04,(of-rank+1)/of):0;
export const NEED_WORDS={carries:'carries',targets:'targets',att:'attempts'};
