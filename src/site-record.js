// The admin panel's Record tab: the site's record (slip_ledger.py RECORD),
// which is only what the admin posts -- a slip graded in the Slip Analyzer,
// "Post to record" -- and the plays that already finished, typed in here with
// their result. Posted picks settle from the final box score; here the admin
// can call one by hand, take one off, or erase the whole record.
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
 return h('details',{className:'record-entry-box',open:true},h('summary',{text:'Add a play that already happened'}),
  h('p',{className:'site-controls-hint',text:`For plays you made before posting here. Enter it with how it finished; it goes straight on the record. The record shows the last ${RECORD_DAYS} days.`}),form);
}

export function mountRecordPanel(host,{request}){
 if(host.refreshRecord)return host.refreshRecord();
 const totals=h('div',{className:'record-totals'});
 const status=h('p',{role:'status'});
 const list=h('ol',{className:'record-list'});
 const erase=h('button',{type:'button',className:'record-erase',text:'Erase record',onClick:eraseAll});
 host.append(
  h('p',{className:'site-controls-hint',text:'Only picks you post count. Grade a slip in the Slip Analyzer, then tap Post to record. Picks settle on their own from the final box score; you can call one yourself here.'}),
  totals,entryForm(async body=>{await request('/api/v2-admin',body);await refresh();}),status,list,
  h('div',{className:'record-foot'},erase,h('a',{href:'/results',target:'_blank',rel:'noopener',className:'record-open',text:'Open /results'})));

 function summary(data){
  const all=data.summary?.all||{hits:0,misses:0,picks:0,rate:null};
  const pending=(data.picks||[]).filter(pick=>!pick.result).length;
  totals.replaceChildren(
   h('div',{},h('b',{text:pct(all.rate)}),h('span',{text:all.picks?`${all.hits}–${all.misses} settled`:'Nothing settled yet'})),
   h('div',{},h('b',{text:String(pending)}),h('span',{text:'to play'})),
   h('div',{},h('b',{text:String((data.picks||[]).length)}),h('span',{text:'on the record'})));
 }

 function row(pick){
  const call=result=>()=>act({action:'record-result',day:pick.day,key:pick.key,result},result?`${pick.player}: ${RESULT_NAMES[result]}.`:`${pick.player} will settle from the box score.`);
  const chip=pick.result?RESULT_NAMES[pick.result]||pick.result:'To play';
  return h('li',{className:'record-pick','data-result':pick.result||'open'},
   h('div',{className:'record-pick-main'},
    h('b',{text:pick.player}),
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

 function show(data){
  summary(data);
  const picks=data.picks||[];
  list.replaceChildren(...(picks.length?picks.map(row):[h('li',{className:'record-empty',text:'The record is empty. Post a slip from the Slip Analyzer to start it.'})]));
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
