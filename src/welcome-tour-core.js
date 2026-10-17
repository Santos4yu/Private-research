// The welcome tour's rules (src/WelcomeTour.jsx): who sees it by itself,
// its steps, and where its card sits beside what it points at.

// Synced to the member's other devices (account-sync.js), so a tour
// finished on the phone doesn't open again on the laptop.
export const TOUR_KEY='aceprops:welcome-tour:v1';
// Members who joined within this many days get the tour by itself; anyone
// can replay it from Settings.
export const NEW_FOR_DAYS=14;

export const STEPS=[
 {key:'welcome',title:'Welcome to Ace Props',text:"Here's a quick look around. It takes about a minute, and you can skip it anytime."},
 {key:'sports',target:['.finder-sports','.finder-title'],title:'Pick a sport',
  text:'The Finder lists every prop posted today, with how often each one has hit.'},
 {key:'search',target:['.finder-controls'],title:'Search and filter',
  text:'Look up a player or team, or narrow the list by stat, line type, team and date.'},
 {key:'card',target:['.finder-table tbody tr'],title:'Read a prop card',
  text:'Each card shows the line, how tough the defense is, and how often he has cleared it: his last 5, 10 and 15 games, against this team and this season. Green means it has been hitting.'},
 {key:'star',target:['.finder-table tbody tr .finder-star'],title:'Save a pick',text:'Tap the star to add a pick to your slip.'},
 {key:'player',page:'player',target:['.fpb-hero','.finder-trend-view'],title:'The player page',
  text:'Tap any card to open it: every recent game against the line, his full game log and his trends.'},
 {key:'research',page:'player',target:['.mlb-context-tabs','.fpb-switch'],title:'Matchup research',
  text:'The defense he faces, injuries, odds and the weather for this game are all a tap away.'},
 {key:'slip',page:'slip',target:['.sa-drop','#panel-slip'],title:'Slip Analyzer',
  text:'Upload a screenshot of your slip and every pick gets a grade, plus one for the whole slip.'},
 {key:'done',title:"You're all set",text:'You can replay this tour anytime from Settings.'},
];

export function readTour(storage){
 try{const value=JSON.parse(storage?.getItem(TOUR_KEY)||'null');return value&&typeof value==='object'?value:null;}catch{return null;}
}
export function saveTour(storage,how,now=Date.now()){
 try{storage?.setItem(TOUR_KEY,JSON.stringify({done:true,how,at:now}));}catch{}
}

/** Whether the tour opens by itself: never twice, and only for someone who
 *  joined in the last two weeks (when we can't tell, they count as new). */
export function shouldStart(record,memberSince,now=Date.now()){
 if(record?.done)return false;
 const joined=Date.parse(memberSince||'');
 return !Number.isFinite(joined)||now-joined<NEW_FOR_DAYS*86400e3;
}

/** Where the card goes: under what it points at when it fits, else above,
 *  else pinned to the bottom; centered when it points at nothing. */
export function placement(rect,card,view,{gap=14,margin=12}={}){
 const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
 if(!rect)return {top:Math.max(margin,(view.height-card.height)/2),left:Math.max(margin,(view.width-card.width)/2),side:'center'};
 const left=clamp(rect.left+rect.width/2-card.width/2,margin,Math.max(margin,view.width-card.width-margin));
 if(view.height-rect.bottom>=card.height+gap+margin)return {top:rect.bottom+gap,left,side:'below'};
 if(rect.top>=card.height+gap+margin)return {top:rect.top-gap-card.height,left,side:'above'};
 return {top:Math.max(margin,view.height-card.height-margin),left,side:'over'};
}

/** The spotlight around a target: a little room on each side, kept on screen. */
export function spotlight(rect,view,pad=6){
 if(!rect)return null;
 const top=Math.max(4,rect.top-pad),left=Math.max(4,rect.left-pad);
 const bottom=Math.min(view.height-4,rect.bottom+pad),right=Math.min(view.width-4,rect.right+pad);
 return bottom>top&&right>left?{top,left,right,bottom,width:right-left,height:bottom-top}:null;
}
