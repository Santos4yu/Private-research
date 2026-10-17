// The admin panel's Record tab: the site's record (slip_ledger.py RECORD),
// which is only what the admin posts -- a slip graded in the Slip Analyzer,
// "Post to record" -- and the plays that already finished, read off slip
// screenshots or typed in here, each with the result the admin gives it. Posted picks settle from the final box score; here the admin
// can call one by hand, take one off, or erase the whole record.
import {READ_URL,shrink} from './slip-image.js';

const SPORT_NAMES={nfl:'NFL',nba:'NBA',wnba:'WNBA',mlb:'MLB',nhl:'NHL',soccer:'Soccer'};
const TIER_NAMES={elite:'Elite',strong:'Strong',lean:'Lean',risky:'Risky',fade:'Fade'};
const RESULT_NAMES={hit:'Hit',miss:'Miss',push:'Push',void:'Void',unknown:'Unsettled'};

function h(tag,props={},...children){
 const node=document.createElement(tag);
 for(const [key,value] of Object.entries(props)){
  if(value==null||value===false)continue;
  if(key==='className')node.className=value;else if(key==='text')node.textContent=value;
  else if(key.startsWith('on'))node.addEventListener(key.slice(2).toLowerCase(),value);else node.setAttribute(key,value===true?'':value);
 }
 node.append(...children.flat().filter(child=>child!=null&&child!==false));
 return node;
}
const pct=rate=>rate==null?'—':`${Math.round(rate*100)}%`;
const figure=value=>value==null?'':Number.isInteger(value)?String(value):Number(value).toFixed(1);
const dayLabel=iso=>new Date(`${iso}T12:00:00`).toLocaleDateString([],{month:'short',day:'numeric'});
// A date as <input type=date> wants it, `back` days ago in the viewer's time.
const isoDay=(back=0)=>{const d=new Date();d.setDate(d.getDate()-back);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const RECORD_DAYS=30;

function select(name,options,value){
 return h('select',{name},Object.entries(options).map(([key,label])=>h('option',{value:key,selected:key===value},label)));
}
function field(label,control,className){return h('label',{className:`record-field${className?` ${className}`:''}`},h('span',{text:label}),control);}

const RESULT_BUTTONS=[['hit','Hit'],['miss','Miss'],['push','Push'],['void','Void']];

// The reader leans on outside models that are sometimes busy or misread a
// screenshot, so a failed read is tried again (TRIES in all, a short wait
// between) before it's given up on -- not for a sign-in, size or format problem.
const TRIES=3;
const FINAL=new Set([400,401,403,413,415]);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function readShot(file,onTry=()=>{}){
 const blob=await shrink(file);
 let problem=null;
 for(let attempt=1;attempt<=TRIES;attempt++){
  if(attempt>1){onTry(attempt);await wait(1200*attempt);}
  let response,data;
  try{
   response=await fetch(READ_URL,{method:'POST',headers:{'Content-Type':blob.type||'image/jpeg'},body:blob,credentials:'same-origin',cache:'no-store'});
   data=await response.json().catch(()=>({}));
  }catch{problem=new Error('The connection dropped.');continue;}
  if(response.ok&&Array.isArray(data.legs)&&data.legs.length)return data;
  problem=new Error(response.ok?'No player props were found in it.':data.error||'That screenshot couldn\'t be read.');
  if(FINAL.has(response.status))break;
 }
 throw problem;
}

// Finished slips from their screenshots: every pick is read off them
// (slip_reader.py), the admin sets each slip's date and tier and taps Hit or
// Miss on each pick, and they all go on the record together
// (slip_ledger.record_enter_many).
function screenshotBox(onAdd){
 let slips=[],next=1;
 const files=h('input',{type:'file',accept:'image/png,image/jpeg,image/webp',multiple:true,className:'record-shot-input',id:'record-shot-files'});
 const pickLabel=h('label',{for:'record-shot-files',className:'record-shot-pick',text:'Choose screenshots'});
 const pasteButton=h('button',{type:'button',className:'record-shot-pick record-shot-paste',text:'Paste screenshot',onClick:pasteClipboard});
 const status=h('p',{className:'record-entry-status',role:'status'});
 const addStatus=h('p',{className:'record-entry-status record-shot-add-status',role:'status'});
 const list=h('div',{className:'record-shots'});
 const submit=h('button',{type:'button',className:'record-entry-add',hidden:true,onClick:addAll});
 files.addEventListener('change',()=>{const chosen=[...files.files];files.value='';if(chosen.length)read(chosen);});

 // Paste: the button reads the clipboard (phones), and a screenshot pasted
 // anywhere on the open Record tab is read too (computers).
 async function pasteClipboard(){
  try{
   const found=[];
   for(const item of await navigator.clipboard.read()){
    const type=item.types.find(name=>name.startsWith('image/'));
    if(type)found.push(new File([await item.getType(type)],'Pasted screenshot',{type}));
   }
   if(found.length)read(found);else status.textContent='There\'s no image on your clipboard. Copy the screenshot first.';
  }catch{status.textContent='Pasting was blocked by your browser. Choose the screenshot instead.';}
 }
 document.addEventListener('paste',event=>{
  if(!box.isConnected||!(box.checkVisibility?box.checkVisibility():box.offsetParent)||reading)return;
  if(event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,[contenteditable]'))return;
  const found=[...(event.clipboardData?.items||[])].filter(item=>item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean);
  if(!found.length)return;
  event.preventDefault();box.open=true;read(found);
 });

 let reading=false;
 // Screenshots that still couldn't be read, kept to try again without choosing them again.
 let failedFiles=[];
 const retry=h('button',{type:'button',className:'record-shot-retry',hidden:true,onClick:()=>{const again=failedFiles;failedFiles=[];read(again);}});
 async function read(chosen){
  reading=true;retry.hidden=true;
  pickLabel.setAttribute('aria-disabled','true');pasteButton.disabled=true;
  const failed=[];
  for(const [index,file] of chosen.entries()){
   const label=`Reading screenshot ${index+1} of ${chosen.length}…`;
   status.textContent=label;addStatus.textContent='';
   try{
    const slip=await readShot(file,attempt=>{status.textContent=`${label} trying again (${attempt} of ${TRIES})`;});
    // One id for the slip's picks: they're kept, shown and counted together.
    slips.push({id:next++,slipId:`r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,app:slip.app?.name||'',day:isoDay(1),tier:'elite',
     legs:slip.legs.map(leg=>({player:leg.player||'',sport:leg.sport||'',side:leg.side||'',line:leg.line??'',stat:leg.statName||leg.stat||'',
      team:leg.team||'',opponent:leg.opponent||'',modifier:leg.modifier||'standard',result:''}))});
    paint();
   }catch(error){failed.push(file);failedFiles.push(file);status.dataset.reason=error.message;}
  }
  pickLabel.removeAttribute('aria-disabled');pasteButton.disabled=false;reading=false;
  const done=chosen.length-failed.length;
  status.textContent=failed.length
   ?`${done?`Read ${done} of ${chosen.length}. `:''}${failed.length===1?'One screenshot':`${failed.length} screenshots`} couldn't be read after ${TRIES} tries (${status.dataset.reason}).`
   :`Read ${chosen.length} screenshot${chosen.length===1?'':'s'}. Tap Hit or Miss on each pick.`;
  retry.hidden=!failedFiles.length;
  retry.textContent=`Try ${failedFiles.length===1?'it':`those ${failedFiles.length}`} again`;
 }

 function legCard(slip,leg){
  const edit=(name,cast=value=>value)=>event=>{leg[name]=cast(event.target.value);};
  const card=h('li',{className:'record-shot-leg','data-missing':leg.missing?'true':null},
   h('div',{className:'record-shot-leg-head'},
    h('input',{type:'text',value:leg.player,maxlength:60,'aria-label':'Player',onInput:edit('player')}),
    h('button',{type:'button',className:'record-shot-drop','aria-label':`Leave ${leg.player||'this pick'} out`,text:'×',onClick:()=>{
     slip.legs=slip.legs.filter(item=>item!==leg);if(!slip.legs.length)slips=slips.filter(item=>item!==slip);paint();}})),
   h('div',{className:'record-shot-leg-line'},
    select('side',{'':'Over or Under?',OVER:'Over',UNDER:'Under'},leg.side),
    h('input',{type:'number',step:'0.5',inputmode:'decimal',value:leg.line,'aria-label':'Line',onInput:edit('line')}),
    h('input',{type:'text',value:leg.stat,maxlength:60,'aria-label':'Stat',onInput:edit('stat')}),
    select('sport',{'':'Sport',...SPORT_NAMES},leg.sport)),
   h('div',{className:'record-shot-results',role:'group','aria-label':`Result for ${leg.player}`},
    RESULT_BUTTONS.map(([result,label])=>h('button',{type:'button','data-result':result,'aria-pressed':String(leg.result===result),text:label,
     onClick:()=>{leg.result=leg.result===result?'':result;leg.missing=false;paint();}}))));
  card.querySelector('[name=side]').addEventListener('change',edit('side'));
  card.querySelector('[name=sport]').addEventListener('change',edit('sport'));
  return card;
 }

 function slipGroup(slip,index){
  const day=h('input',{type:'date',value:slip.day,max:isoDay(0),min:isoDay(RECORD_DAYS-1),'aria-label':'Game date'});
  day.addEventListener('change',()=>{slip.day=day.value;});
  const tier=select('tier',TIER_NAMES,slip.tier);tier.addEventListener('change',()=>{slip.tier=tier.value;});
  const all=result=>()=>{slip.legs.forEach(leg=>{leg.result=result;leg.missing=false;});paint();};
  return h('section',{className:'record-shot'},
   h('header',{},h('b',{text:`Slip ${index+1}${slip.app?` · ${slip.app}`:''} · ${slip.legs.length} pick${slip.legs.length===1?'':'s'}`}),
    h('button',{type:'button',className:'record-shot-drop',text:'Remove',onClick:()=>{slips=slips.filter(item=>item!==slip);paint();}})),
   h('div',{className:'record-entry-grid'},field('Game date',day),field('Tier',tier)),
   h('div',{className:'record-shot-all'},h('span',{text:'All picks:'}),
    h('button',{type:'button',text:'All hit',onClick:all('hit')}),h('button',{type:'button',text:'All miss',onClick:all('miss')})),
   h('ol',{className:'record-shot-legs'},slip.legs.map(leg=>legCard(slip,leg))));
 }

 function paint(){
  list.replaceChildren(...slips.map(slipGroup));
  const count=slips.reduce((sum,slip)=>sum+slip.legs.length,0);
  submit.hidden=!count;
  submit.textContent=`Add ${count} play${count===1?'':'s'} to record`;
 }

 async function addAll(){
  const legs=slips.flatMap(slip=>slip.legs);
  const unset=legs.filter(leg=>!leg.result);
  const unread=legs.filter(leg=>!leg.sport||!leg.side||leg.line===''||!String(leg.stat).trim()||!String(leg.player).trim());
  if(unset.length||unread.length){
   legs.forEach(leg=>{leg.missing=unset.includes(leg)||unread.includes(leg);});paint();
   addStatus.textContent=unset.length?`Tap Hit or Miss on ${unset.length} more pick${unset.length===1?'':'s'}.`
    :`Fill in the sport, Over/Under, line and stat on ${unread.length} pick${unread.length===1?'':'s'}.`;
   list.querySelector('[data-missing=true]')?.scrollIntoView({behavior:'smooth',block:'center'});
   return;
  }
  addStatus.textContent='';
  const plays=slips.flatMap(slip=>slip.legs.map(leg=>({day:slip.day,tier:slip.tier,slip:slip.slipId,slipApp:slip.app,player:leg.player.trim(),sport:leg.sport,side:leg.side,
   line:leg.line===''?null:Number(leg.line),stat:leg.stat.trim(),team:leg.team,opponent:leg.opponent,modifier:leg.modifier,result:leg.result})));
  submit.disabled=true;
  try{
   const done=await onAdd({action:'record-enter-many',plays});
   slips=[];paint();
   status.textContent=`Added ${done.added} play${done.added===1?'':'s'} to the record (${done.hits} hit, ${done.misses} miss).`;
  }catch(error){addStatus.textContent=error.message;}
  finally{submit.disabled=false;}
 }

 const box=h('details',{className:'record-entry-box',open:true},h('summary',{text:'Add finished slips from screenshots'}),
  h('p',{className:'site-controls-hint',text:`Choose or paste slip screenshots, check each slip's date (last ${RECORD_DAYS} days) and tier, tap Hit or Miss on each pick, then add them.`}),
  files,h('div',{className:'record-shot-sources'},pickLabel,pasteButton),status,retry,list,submit,addStatus);
 return box;
}

// A play that already finished, with its result (slip_ledger.record_enter).
function entryForm(onAdd){
 const form=h('form',{className:'record-entry',novalidate:true});
 const date=h('input',{type:'date',name:'day',required:true,value:isoDay(1),max:isoDay(0),min:isoDay(RECORD_DAYS-1)});
 const player=h('input',{type:'text',name:'player',required:true,maxlength:60,placeholder:'Dak Prescott',autocomplete:'off'});
 const stat=h('input',{type:'text',name:'stat',required:true,maxlength:60,placeholder:'Pass Attempts',autocomplete:'off'});
 const line=h('input',{type:'number',name:'line',required:true,step:'0.5',inputmode:'decimal',placeholder:'33.5'});
 const value=h('input',{type:'number',name:'value',step:'any',inputmode:'decimal',placeholder:'42'});
 const team=h('input',{type:'text',name:'team',maxlength:8,placeholder:'DAL',autocomplete:'off'});
 const opponent=h('input',{type:'text',name:'opponent',maxlength:8,placeholder:'TB',autocomplete:'off'});
 const status=h('p',{className:'record-entry-status',role:'status'});
 const submit=h('button',{type:'submit',className:'record-entry-add',text:'Add to record'});
 form.append(
  h('div',{className:'record-entry-grid'},
   field('Date',date),field('Sport',select('sport',SPORT_NAMES,'nfl')),
   field('Player',player,'record-wide'),
   field('Pick',select('side',{OVER:'Over',UNDER:'Under'},'OVER')),field('Line',line),
   field('Stat',stat,'record-wide'),
   field('Tier',select('tier',TIER_NAMES,'elite')),field('Result',select('result',{hit:'Hit',miss:'Miss',push:'Push',void:'Void'},'hit')),
   field('Finished at (the final stat, optional)',value,'record-wide'),field('Team',team),field('Opponent',opponent)),
  submit,status);
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const data=Object.fromEntries(new FormData(form));
  if(!data.player.trim()||!data.stat.trim()||data.line===''){status.textContent='Player, line and stat are required.';return;}
  submit.disabled=true;
  try{
   await onAdd({action:'record-enter',...data,line:Number(data.line),value:data.value===''?null:Number(data.value)});
   status.textContent=`Added ${data.player.trim()} ${data.side==='UNDER'?'Under':'Over'} ${data.line} ${data.stat.trim()}.`;
   // Ready for the next play from the same slip: same date, sport and teams.
   for(const input of [player,stat,line,value])input.value='';
   player.focus();
  }catch(error){status.textContent=error.message;}
  finally{submit.disabled=false;}
 });
 return h('details',{className:'record-entry-box'},h('summary',{text:'Type in a finished play'}),
  h('p',{className:'site-controls-hint',text:`For plays you made before posting here. Enter it with how it finished; it goes straight on the record. The record shows the last ${RECORD_DAYS} days.`}),form);
}

export function mountRecordPanel(host,{request}){
 if(host.refreshRecord)return host.refreshRecord();
 const totals=h('div',{className:'record-totals'});
 const status=h('p',{role:'status'});
 const list=h('ol',{className:'record-list'});
 const erase=h('button',{type:'button',className:'record-erase',text:'Erase record',onClick:eraseAll});
 // Loose picks (added one by one) the admin has ticked, to join into a slip.
 const chosen=new Set();
 const join=h('button',{type:'button',className:'record-join',hidden:true,onClick:()=>{
  const refs=[...chosen].map(ref=>{const [day,key]=ref.split('|');return {day,key};});
  chosen.clear();act({action:'record-group',picks:refs},`Joined ${refs.length} picks into one slip.`);
 }});
 function paintJoin(){join.hidden=chosen.size<2;join.textContent=`Group ${chosen.size} picks as one slip`;}
 host.append(
  h('p',{className:'site-controls-hint',text:'Only slips you add here or post from the Slip Analyzer count. Posted picks settle on their own from the box score.'}),
  totals,
  screenshotBox(async body=>{const done=await request('/api/v2-admin',body);await refresh();return done;}),
  entryForm(async body=>{await request('/api/v2-admin',body);await refresh();}),status,join,list,
  h('div',{className:'record-foot'},erase,h('a',{href:'/results',target:'_blank',rel:'noopener',className:'record-open',text:'Open /results'})));

 function summary(data){
  const all=data.summary?.all||{hits:0,misses:0,picks:0,rate:null};
  const pending=(data.picks||[]).filter(pick=>!pick.result).length;
  totals.replaceChildren(
   h('div',{},h('b',{text:pct(all.rate)}),h('span',{text:all.picks?`${all.hits}–${all.misses} settled`:'Nothing settled yet'})),
   h('div',{},h('b',{text:String(pending)}),h('span',{text:'to play'})),
   h('div',{},h('b',{text:String((data.picks||[]).length)}),h('span',{text:'on the record'})));
 }

 // The list stays short: each slip is one line until it's opened (its app,
 // day, how many hit and who), each pick in it one line with its Hit / Miss /
 // Void / Remove behind its "⋯"; PAGE slips at a time.
 const PAGE=8;
 let shown=PAGE,openRow='',latest=null;
 const opened=new Set();
 const sideShort=pick=>`${pick.side==='UNDER'?'U':'O'} ${figure(pick.line)} ${pick.stat}`;
 const initials=name=>String(name||'?').split(' ').map(part=>part[0]).join('').slice(0,2);
 const lastName=name=>String(name||'').split(' ').filter(part=>!/^(jr|sr|ii|iii|iv|v)\.?$/i.test(part)).pop()||name;
 const face=pick=>h('span',{className:'record-face','aria-hidden':'true'},h('i',{text:initials(pick.player)}),
  pick.headshot?h('img',{src:pick.headshot,alt:'',loading:'lazy',onLoad:event=>event.currentTarget.parentElement.classList.add('record-has-photo'),
   onError:event=>event.currentTarget.remove()}):null);

 function row(pick,loose){
  const ref=`${pick.day}|${pick.key}`;
  const call=result=>()=>{openRow='';act({action:'record-result',day:pick.day,key:pick.key,result},result?`${pick.player}: ${RESULT_NAMES[result]}.`:`${pick.player} will settle from the box score.`);};
  const open=openRow===ref;
  const tick=loose?h('input',{type:'checkbox',className:'record-pick-tick','aria-label':`Select ${pick.player} to group into a slip`,checked:chosen.has(ref)}):null;
  tick?.addEventListener('change',()=>{tick.checked?chosen.add(ref):chosen.delete(ref);paintJoin();});
  const detail=[sideShort(pick),loose?dayLabel(pick.day):null,pick.value!=null?`finished ${figure(pick.value)}`:null].filter(Boolean).join(' · ');
  return h('li',{className:'record-row','data-result':pick.result||'open','data-open':open?'true':null},
   tick,face(pick),
   h('div',{className:'record-row-main'},h('b',{text:pick.player}),h('small',{text:detail})),
   h('span',{className:'record-pill',text:pick.result?RESULT_NAMES[pick.result]||pick.result:'To play'}),
   h('button',{type:'button',className:'record-more','aria-expanded':String(open),'aria-label':`Change ${pick.player}`,text:'⋯',
    onClick:()=>{openRow=open?'':ref;show(latest);}}),
   open?h('div',{className:'record-row-actions'},
    h('button',{type:'button',text:'Hit','aria-pressed':String(pick.result==='hit'),onClick:call('hit')}),
    h('button',{type:'button',text:'Miss','aria-pressed':String(pick.result==='miss'),onClick:call('miss')}),
    h('button',{type:'button',text:'Void','aria-pressed':String(pick.result==='void'),onClick:call('void')}),
    pick.manual&&!pick.entered?h('button',{type:'button',text:'Auto',title:'Settle from the box score again',onClick:call(null)}):null,
    h('button',{type:'button',className:'record-remove',text:'Remove',onClick:()=>{
     if(!confirm(`Take ${pick.player} ${sideShort(pick)} off the record?`))return;
     openRow='';act({action:'record-remove',day:pick.day,key:pick.key},`${pick.player} removed.`);
    }})):null);
 }

 function slipStatus(picks){
  const results=picks.map(pick=>pick.result);
  if(results.includes('miss'))return ['lost','Lost'];
  if(results.some(result=>!result))return ['open','To play'];
  return results.includes('hit')?['won','Won']:['void','Void'];
 }
 function slipCard(picks){
  const [tone,label]=slipStatus(picks);
  const app=picks.find(pick=>pick.slipApp)?.slipApp||'';
  const id=picks[0].slip,open=opened.has(id);
  const hits=picks.filter(pick=>pick.result==='hit').length;
  const day=dayLabel(picks.map(pick=>pick.day).sort().pop());
  return h('li',{className:'record-slip','data-status':tone,'data-open':open?'true':null},
   h('button',{type:'button',className:'record-slip-head','aria-expanded':String(open),onClick:()=>{open?opened.delete(id):opened.add(id);show(latest);}},
    h('span',{className:'record-stack','aria-hidden':'true'},picks.slice(0,2).map(face)),
    h('span',{className:'record-row-main'},
     h('b',{text:`${picks.length}-pick${app?` ${app}`:''}`}),
     h('small',{text:open?`${day} · ${hits} of ${picks.length} hit`:`${day} · ${picks.map(pick=>lastName(pick.player)).join(', ')}`})),
    h('span',{className:'record-pill',text:label})),
   open?h('ol',{className:'record-rows'},picks.map(pick=>row(pick))):null,
   open?h('div',{className:'record-row-actions record-slip-actions'},
    h('button',{type:'button',className:'record-remove',text:'Remove slip',onClick:async()=>{
     if(!confirm(`Take this whole ${picks.length}-pick slip off the record?`))return;
     opened.delete(id);host.setAttribute('aria-busy','true');
     try{for(const pick of picks)await request('/api/v2-admin',{action:'record-remove',day:pick.day,key:pick.key});status.textContent='Slip removed.';}
     catch(error){status.textContent=error.message;}
     finally{host.removeAttribute('aria-busy');await refresh();}
    }})):null);
 }

 function show(data){
  latest=data;
  summary(data);
  const picks=data.picks||[];
  const groups=[];const bySlip=new Map();
  for(const pick of picks){
   if(!pick.slip){groups.push([pick]);continue;}
   if(!bySlip.has(pick.slip)){bySlip.set(pick.slip,[]);groups.push(bySlip.get(pick.slip));}
   bySlip.get(pick.slip).push(pick);
  }
  for(const ref of [...chosen])if(!picks.some(pick=>!pick.slip&&`${pick.day}|${pick.key}`===ref))chosen.delete(ref);
  paintJoin();
  const loose=groups.filter(group=>!group[0].slip).length;
  const more=groups.length-shown;
  list.replaceChildren(...(picks.length?[
   h('li',{className:'record-list-head'},h('b',{text:'On the record'}),
    h('small',{text:[bySlip.size?`${bySlip.size} slip${bySlip.size===1?'':'s'}`:null,loose?`${loose} single pick${loose===1?'':'s'}`:null].filter(Boolean).join(' · ')})),
   ...groups.slice(0,shown).map(group=>group[0].slip?slipCard(group):h('li',{className:'record-slip record-single'},h('ol',{className:'record-rows'},row(group[0],true)))),
   more>0?h('li',{},h('button',{type:'button',className:'record-show-more',text:`Show ${Math.min(PAGE,more)} more (${more} left)`,onClick:()=>{shown+=PAGE;show(latest);}})):null]
   :[h('li',{className:'record-empty',text:'The record is empty. Add finished slips above, or post one from the Slip Analyzer.'})]));
  erase.disabled=!picks.length;
 }
 async function refresh(){
  try{show(await request('/api/v2-admin?action=record'));}
  catch(error){status.textContent=error.message;}
 }
 async function act(body,done){
  host.setAttribute('aria-busy','true');
  try{await request('/api/v2-admin',body);status.textContent=done;await refresh();}
  catch(error){status.textContent=error.message;}
  finally{host.removeAttribute('aria-busy');}
 }
 function eraseAll(){
  if(!confirm('Erase the whole record? Every pick on it is deleted and /results starts from zero. This can’t be undone.'))return;
  act({action:'record-clear',confirm:true},'Record erased.');
 }
 host.refreshRecord=refresh;
 return refresh();
}
