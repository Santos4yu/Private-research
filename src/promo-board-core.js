// The Promo Board's list (src/PromoBoard.jsx), apart from React so it can be
// tested: each PrizePicks promo line on the board, read on the Over.
import {assessLeg,isPrizePicksLine} from './smart-slip.js';
import {gradeMatchups} from './krazy-bot.js';

const ORDER={elite:0,strong:1,lean:2,risky:3,fade:4};
const key=row=>`${row.sport}|${row.player}|${row.market}`;

/** The player's other lines on the same stat today: what the promo is cut from. */
function usualLine(rows,promo){
 const same=rows.filter(row=>row!==promo&&!row.promo&&key(row)===key(promo)&&Number(row.line)>Number(promo.line));
 const regular=same.find(row=>String(row.modifier||'standard')==='standard');
 const any=regular||same.sort((a,b)=>a.line-b.line)[0];
 return any?{line:any.line,modifier:String(any.modifier||'standard')}:null;
}

/** Each promo line on the board, read on the Over (the side Ace Props backs). */
export function promoCards(rows,{now=Date.now(),tables={}}={}){
 const promos=rows.filter(row=>row.promo&&isPrizePicksLine(row)&&Date.parse(row.startsAt||'')>now);
 const legs=gradeMatchups(promos.map(row=>assessLeg(row,'OVER',{now})||null),tables);
 return promos.map((row,index)=>({row,leg:legs[index]||null,usual:usualLine(rows,row)}))
  .sort((a,b)=>(a.leg?0:1)-(b.leg?0:1)||(ORDER[a.leg?.tier]??9)-(ORDER[b.leg?.tier]??9)||(b.leg?.chance||0)-(a.leg?.chance||0)
   ||Date.parse(a.row.startsAt)-Date.parse(b.row.startsAt));
}

