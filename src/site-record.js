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

async function readShot(file){
 const blob=await shrink(file);
 const response=await fetch(READ_URL,{method:'POST',headers:{'Content-Type':blob.type||'image/jpeg'},body:blob,credentials:'same-origin',cache:'no-store'});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||'That screenshot couldn\'t be read.');
 if(!Array.isArray(data.legs)||!data.legs.length)throw new Error('No player props were found in it.');
 return data;
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
  if(!box.isConnected||!box.offsetParent||reading)return;
  if(event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,[contenteditable]'))return;
  const found=[...(event.clipboardData?.items||[])].filter(item=>item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean);
  if(!found.length)return;
  event.preventDefault();box.open=true;read(found);
 });

 let reading=false;
 async function read(chosen){
  reading=true;
  pickLabel.setAttribute('aria-disabled','true');pasteButton.disabled=true;
  const failed=[];
  for(const [index,file] of chosen.entries()){
   status.textContent=`Reading screenshot ${index+1} of ${chosen.length}…`;addStatus.textContent='';
   try{
    const slip=await readShot(file);
    // One id for the slip's picks: they're kept, shown and counted together.
    slips.push({id:next++,slipId:`r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,app:slip.app?.name||'',day:isoDay(1),tier:'elite',
     legs:slip.legs.map(leg=>({player:leg.player||'',sport:leg.sport||'',side:leg.side||'',line:leg.line??'',stat:leg.statName||leg.stat||'',
      team:leg.team||'',opponent:leg.opponent||'',modifier:leg.modifier||'standard',result:''}))});
    paint();
   }catch(error){failed.push(`${file.name||`Screenshot ${index+1}`}: ${error.message}`);}
  }
  pickLabel.removeAttribute('aria-disabled');pasteButton.disabled=false;reading=false;
  status.textContent=failed.length?failed.join(' '):`Read ${chosen.length} screenshot${chosen.length===1?'':'s'}. Tap Hit or Miss on each pick.`;
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
  h('p',{className:'site-controls-hint',text:`Choose or paste one or more slip screenshots. Every pick is read off them and each slip stays together; check its date and tier, tap Hit or Miss on each pick, then add them all. Dates must be in the last ${RECORD_DAYS} days.`}),
  files,h('div',{className:'record-shot-sources'},pickLabel,pasteButton),status,list,submit,addStatus);
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
  h('p',{className:'site-controls-hint',text:'Only picks you post count. Grade a slip in the Slip Analyzer, then tap Post to record. Picks settle on their own from the final box score; you can call one yourself here.'}),
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

 function row(pick,loose){
  const call=result=>()=>act({action:'record-result',day:pick.day,key:pick.key,result},result?`${pick.player}: ${RESULT_NAMES[result]}.`:`${pick.player} will settle from the box score.`);
  const chip=pick.result?RESULT_NAMES[pick.result]||pick.result:'To play';
  const ref=`${pick.day}|${pick.key}`;
  const tick=loose?h('input',{type:'checkbox',className:'record-pick-tick','aria-label':`Select ${pick.player} to group into a slip`,checked:chosen.has(ref)}):null;
  tick?.addEventListener('change',()=>{tick.checked?chosen.add(ref):chosen.delete(ref);paintJoin();});
  return h('li',{className:'record-pick','data-result':pick.result||'open'},
   h('div',{className:'record-pick-main'},
    h('b',{},tick,pick.player),
    h('span',{text:`${pick.side==='UNDER'?'Under':'Over'} ${figure(pick.line)} ${pick.stat}`}),
    h('small',{text:[SPORT_NAMES[pick.sport]||pick.sport,pick.team&&pick.opponent?`${pick.team} vs ${pick.opponent}`:pick.team,dayLabel(pick.day),TIER_NAMES[pick.tier]].filter(Boolean).join(' · ')})),
   h('div',{className:'record-pick-side'},
    h('span',{className:'record-chip',text:pick.entered?`${chip} (typed in)`:pick.manual?`${chip} (yours)`:chip}),
    pick.value!=null?h('small',{text:`Finished ${figure(pick.value)}`}):null),
   h('div',{className:'record-pick-actions'},
    h('button',{type:'button',text:'Hit',onClick:call('hit')}),
    h('button',{type:'button',text:'Miss',onClick:call('miss')}),
    h('button',{type:'button',text:'Void',onClick:call('void')}),
    pick.manual&&!pick.entered?h('button',{type:'button',text:'Auto',title:'Settle from the box score again',onClick:call(null)}):null,
    h('button',{type:'button',className:'record-remove',text:'Remove',onClick:()=>{
     if(confirm(`Take ${pick.player} ${pick.side==='UNDER'?'Under':'Over'} ${figure(pick.line)} ${pick.stat} off the record?`))
      act({action:'record-remove',day:pick.day,key:pick.key},`${pick.player} removed.`);
    }})));
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
  return h('li',{className:'record-slip','data-status':tone},
   h('header',{},
    h('div',{},h('b',{text:`${picks.length}-pick ${app?`${app} `:''}slip`}),h('small',{text:dayLabel(picks.map(pick=>pick.day).sort().pop())})),
    h('span',{className:'record-chip',text:label})),
   h('ol',{className:'record-list'},picks.map(pick=>row(pick))),
   h('button',{type:'button',className:'record-remove record-slip-remove',text:'Remove slip',onClick:async()=>{
    if(!confirm(`Take this whole ${picks.length}-pick slip off the record?`))return;
    host.setAttribute('aria-busy','true');
    try{for(const pick of picks)await request('/api/v2-admin',{action:'record-remove',day:pick.day,key:pick.key});status.textContent='Slip removed.';}
    catch(error){status.textContent=error.message;}
    finally{host.removeAttribute('aria-busy');await refresh();}
   }}));
 }

 function show(data){
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
  list.replaceChildren(...(picks.length?groups.map(group=>group[0].slip?slipCard(group):row(group[0],true))
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
