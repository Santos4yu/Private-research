export const courtKey=value=>String(value||'').toLowerCase().includes('hard')?'hard':String(value||'').toLowerCase().includes('clay')?'clay':String(value||'').toLowerCase().includes('grass')?'grass':'';
// Hard courts split by roof: the data marks indoor courts ("I.hard", "Indoor hard").
export const isIndoor=value=>/(^|[^a-z])i\.|indoor/i.test(String(value||''));
export const courtDetail=value=>courtKey(value)==='hard'?(isIndoor(value)?'hard-indoor':'hard-outdoor'):courtKey(value);
export const COURT_LABELS={hard:'Hard','hard-outdoor':'Outdoor hard','hard-indoor':'Indoor hard',clay:'Clay',grass:'Grass'};
export const courtLabel=value=>COURT_LABELS[courtDetail(value)]||String(value||'')||null;
export const onCourt=(game,court)=>court==='all'||courtKey(game.surface)===court||courtDetail(game.surface)===court;
export function tennisPostedSelection(rows,key,current){
 const posted=rows.filter(r=>r.marketKey===key&&Number.isFinite(r.line));
 return posted.find(r=>r.id===current?.id)||posted.find(r=>String(r.modifier||'standard').toLowerCase()==='standard')||posted[0]||null;
}
export function tennisSample(games,{surface='all',size=15,rank='all',format='all',hand='all'}={}){
 return games.filter(g=>onCourt(g,surface)&&(rank==='all'||(Number(g.opponentRank)>0&&Number(g.opponentRank)<=Number(rank)))&&(format==='all'||String(g.bestOf)===format)&&(hand==='all'||g.opponentHand===hand)).slice(-Number(size));
}
export const tennisMean=(games,key)=>{const v=games.map(g=>g.values?.[key]).filter(Number.isFinite);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;};
export function tennisRatio(games,numerator,denominator){const pairs=games.filter(g=>Number.isFinite(g.values?.[numerator])&&Number.isFinite(g.values?.[denominator])&&g.values[denominator]>0);if(!pairs.length)return null;const won=pairs.reduce((n,g)=>n+g.values[numerator],0),total=pairs.reduce((n,g)=>n+g.values[denominator],0);return {won,total,percentage:100*won/total};}
export function tennisSummary(games){const sum=key=>games.reduce((n,g)=>n+(Number.isFinite(g.values?.[key])?g.values[key]:0),0),wins=games.filter(g=>g.result==='W').length;return {matches:games.length,wins,losses:games.length-wins,setsWon:sum('setswon'),setsLost:sum('totalsets')-sum('setswon'),gamesWon:sum('totalgameswon'),gamesLost:sum('gameslost')};}
export function decimalToAmerican(value){const n=Number(value);return n>1?(n>=2?'+'+Math.round((n-1)*100):String(-Math.round(100/(n-1)))):'—';}
export function tennisOddsRecord(games,decimal){const n=Number(decimal);if(!(n>1))return null;const sample=games.filter(g=>Number(g.odds)>1&&Math.abs(1/Number(g.odds)-1/n)<=.05);return sample.length?tennisSummary(sample):null;}
// Reverse a completed match without inferring unreported serving statistics.
export function tennisReverseGame(game,player){
 const v=game.values||{},values={...(game.opponentValues||{})};
 for(const [key,value] of Object.entries({totalgames:v.totalgames,totalsets:v.totalsets,totaltiebreaks:v.totaltiebreaks,totalgameswon:v.gameslost,gameswon:v.gameslost,gameslost:v.totalgameswon,setswon:Number.isFinite(v.totalsets)&&Number.isFinite(v.setswon)?v.totalsets-v.setswon:null,'1stsettotalgames':v['1stsettotalgames'],'1stsettotalgameswon':Number.isFinite(v['1stsettotalgames'])&&Number.isFinite(v['1stsettotalgameswon'])?v['1stsettotalgames']-v['1stsettotalgameswon']:null,aces:v.acesallowed,acesallowed:v.aces,breakpointswon:v.breakpointsgivenup,breakpointsgivenup:v.breakpointswon})) if(Number.isFinite(value)&&!Number.isFinite(values[key]))values[key]=value;
 return {...game,player:game.opponent,opponent:player,rank:game.opponentRank,opponentRank:game.rank,odds:game.opponentOdds,values,counts:game.opponentCounts||{},result:game.result==='W'?'L':game.result==='L'?'W':null,score:String(game.score||'').replace(/(\d+)-(\d+)/g,(_,a,b)=>`${b}-${a}`)};
}
export function tennisOpponentResults(games,opponent,key,line){
 const seen=new Set();return [...games].reverse().filter(g=>{const id=g.gameId||`${g.date}:${g.opponent}`;if(seen.has(id))return false;seen.add(id);return g.result==='W'||g.result==='L';}).map(g=>{
  const game=tennisReverseGame(g,opponent),value=game.values[key];
  return {...game,value:Number.isFinite(value)?value:null,outcome:Number.isFinite(value)&&Number.isFinite(line)?value>line?'Over':value<line?'Under':'Push':null};
 });
}
export function tennisResultSummary(games,line){
 const scored=games.filter(g=>Number.isFinite(g.value)),graded=Number.isFinite(line)?scored.filter(g=>g.value!==line):[];
 return {reported:scored.length,graded:graded.length,over:graded.filter(g=>g.value>line).length,pushes:Number.isFinite(line)?scored.length-graded.length:0,average:scored.length?scored.reduce((n,g)=>n+g.value,0)/scored.length:null,difference:scored.length&&Number.isFinite(line)?scored.reduce((n,g)=>n+g.value-line,0)/scored.length:null};
}
export function tennisH2H(first,second,player,opponent,startsAt){
 const end=new Date(startsAt||Date.now()),start=new Date(end);start.setFullYear(start.getFullYear()-2);
 const clean=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const matches=(a,b)=>{const parts=String(b||'').trim().split(/\s+/),names=[b];if(parts.length>1)names.push(parts.slice(1).join(' ')+parts[0][0],parts.at(-1)+parts[0][0]);return names.some(n=>clean(n)===clean(a));};
 const merged=new Map();for(const game of [...second.filter(g=>matches(g.opponent,player)).map(g=>tennisReverseGame(g,opponent)),...first.filter(g=>matches(g.opponent,opponent))]){
  const date=new Date(game.date);if(date>=start&&date<end)merged.set(`${game.date.slice(0,10)}:${game.score}`,game);
 }return [...merged.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export const TENNIS_MARKET_TABS=[['totalgames','Total Games'],['totalgameswon','Total Games Won'],['fantasyscore','Fantasy Score'],['totalsets','Total Sets'],['aces','Aces'],['breakpointswon','Break Points Won'],['totaltiebreaks','Total Tie Breaks'],['1stsettotalgames','1st Set Total Games'],['1stsettotalgameswon','1st Set Total Games Won'],['doublefaults','Double Faults']].map(([key,label])=>({key,label,code:label}));
