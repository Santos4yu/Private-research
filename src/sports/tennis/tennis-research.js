export const courtKey=value=>String(value||'').toLowerCase().includes('hard')?'hard':String(value||'').toLowerCase().includes('clay')?'clay':String(value||'').toLowerCase().includes('grass')?'grass':'';
export function tennisSample(games,{surface='all',size=15,rank='all',format='all',hand='all'}={}){
 return games.filter(g=>(surface==='all'||courtKey(g.surface)===surface)&&(rank==='all'||(Number(g.opponentRank)>0&&Number(g.opponentRank)<=Number(rank)))&&(format==='all'||String(g.bestOf)===format)&&(hand==='all'||g.opponentHand===hand)).slice(-Number(size));
}
export const tennisMean=(games,key)=>{const v=games.map(g=>g.values?.[key]).filter(Number.isFinite);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;};
export function tennisSummary(games){const sum=key=>games.reduce((n,g)=>n+(Number.isFinite(g.values?.[key])?g.values[key]:0),0),wins=games.filter(g=>g.result==='W').length;return {matches:games.length,wins,losses:games.length-wins,setsWon:sum('setswon'),setsLost:sum('totalsets')-sum('setswon'),gamesWon:sum('totalgameswon'),gamesLost:sum('gameslost')};}
export function decimalToAmerican(value){const n=Number(value);return n>1?(n>=2?'+'+Math.round((n-1)*100):String(-Math.round(100/(n-1)))):'—';}
export function tennisOddsRecord(games,decimal){const n=Number(decimal);if(!(n>1))return null;const sample=games.filter(g=>Number(g.odds)>1&&Math.abs(1/Number(g.odds)-1/n)<=.05);return sample.length?tennisSummary(sample):null;}
