// The admin panel's Announce tab: a notification to every device with alerts
// on (push_notices.py). "Send to me" goes only to the admin's own devices,
// to see it on a phone before everyone does.
const TITLE_MAX=60,BODY_MAX=180;

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

function when(seconds){
 const time=Number(seconds)*1000;if(!Number.isFinite(time)||!time)return '';
 const minutes=Math.round((Date.now()-time)/60000);
 if(minutes<2)return 'just now';if(minutes<60)return `${minutes}m ago`;
 const hours=Math.round(minutes/60);if(hours<24)return `${hours}h ago`;
 return new Date(time).toLocaleDateString([],{month:'short',day:'numeric'});
}
const devices=count=>`${count} ${count===1?'device':'devices'}`;

export function mountAnnouncePanel(host,{request}){
 // Reopening the tab only refreshes the numbers; a half-written message stays.
 if(host.refreshAnnounce)return host.refreshAnnounce();
 const count=h('strong',{className:'announce-count',text:'…'});
 const title=h('input',{type:'text',name:'announceTitle',maxlength:TITLE_MAX,placeholder:'PropScout',autocomplete:'off'});
 const body=h('textarea',{name:'announceBody',maxlength:BODY_MAX,rows:3,placeholder:'New update is live'});
 const left=h('span',{className:'announce-left',text:String(BODY_MAX)});
 const status=h('p',{role:'status'});
 const last=h('div',{className:'announce-last',hidden:true});
 const toMe=h('button',{type:'button',className:'announce-me',text:'Send to me',onClick:()=>send(true)});
 const toAll=h('button',{type:'button',className:'announce-all',text:'Send to everyone',onClick:()=>send(false)});
 body.addEventListener('input',()=>{left.textContent=String(BODY_MAX-body.value.length);});
 // The line-check link (line_moves.py): an outside timer calls it every few
 // minutes so line moves and saved-pick alerts don't wait for someone to
 // have the site open. Shows when lines were last checked.
 const timerLink=h('input',{type:'text',readonly:true,className:'announce-timer-link','aria-label':'Line check link'});
 const timerSeen=h('span',{className:'announce-left'});
 const timerCopy=h('button',{type:'button',className:'announce-me',text:'Copy',onClick:async()=>{
  try{await navigator.clipboard.writeText(timerLink.value);timerCopy.textContent='Copied';}
  catch{timerLink.select();document.execCommand?.('copy');timerCopy.textContent='Copied';}
  setTimeout(()=>{timerCopy.textContent='Copy';},1600);
 }});
 const timer=h('div',{className:'announce-timer',hidden:true},
  h('span',{className:'announce-field-head'},'Line check link',timerSeen),
  h('div',{className:'announce-timer-row'},timerLink,timerCopy),
  h('small',{text:'Add it at cron-job.org, every 5 minutes.'}));
 // The NBA phone link (nba_relay.py): the admin's phone Shortcut fetches
 // NBA.com's tables, which turn the site's servers away, and sends them here.
 const phoneLink=h('input',{type:'text',readonly:true,className:'announce-timer-link','aria-label':'NBA phone link'});
 const phoneSeen=h('span',{className:'announce-left'});
 const phoneCopy=h('button',{type:'button',className:'announce-me',text:'Copy',onClick:async()=>{
  try{await navigator.clipboard.writeText(phoneLink.value);phoneCopy.textContent='Copied';}
  catch{phoneLink.select();document.execCommand?.('copy');phoneCopy.textContent='Copied';}
  setTimeout(()=>{phoneCopy.textContent='Copy';},1600);
 }});
 const phone=h('div',{className:'announce-timer',hidden:true},
  h('span',{className:'announce-field-head'},'NBA phone link',phoneSeen),
  h('div',{className:'announce-timer-row'},phoneLink,phoneCopy),
  h('small',{text:'Goes in the NBA Shortcut on your phone.'}));
 host.append(
  h('div',{className:'announce-reach'},h('span',{text:'Alerts on'}),count),
  h('label',{className:'announce-field'},'Title',title),
  h('label',{className:'announce-field'},h('span',{className:'announce-field-head'},'Message',left),body),
  h('div',{className:'announce-actions'},toMe,toAll),
  status,last,timer,phone);

 let reach=0;
 function show(data){
  reach=Number(data.devices)||0;
  count.textContent=devices(reach);
  const item=data.last;
  last.hidden=!item;
  if(item)last.replaceChildren(h('span',{text:`Last sent ${when(item.at)} · ${devices(Number(item.sent)||0)}`}),h('b',{text:item.title}),h('p',{text:item.body}));
  if('timer' in data){
   timer.hidden=!data.timer?.path;
   if(data.timer?.path)timerLink.value=location.origin+data.timer.path;
   const newest=Math.max(0,...Object.values(data.timer?.checked||{}).map(value=>Date.parse(value)/1000||0));
   timerSeen.textContent=newest?`Last check ${when(newest)}`:'Not checked yet';
  }
  if('phone' in data){
   phone.hidden=!data.phone?.path;
   if(data.phone?.path)phoneLink.value=location.origin+data.phone.path;
   phoneSeen.textContent=data.phone?.last?`Last sent ${when(data.phone.last)} · ${data.phone.current}/${data.phone.tables} current`:'Nothing sent yet';
  }
 }
 async function refresh(){
  try{show(await request('/api/v2-admin?action=announce-status'));}
  catch(error){count.textContent='—';status.textContent=error.message;}
 }
 async function send(onlyMe){
  const message=body.value.trim();
  if(!message){status.textContent='Write a message first.';body.focus();return;}
  if(!onlyMe&&!confirm(`Send this to ${devices(reach)}?`))return;
  toMe.disabled=toAll.disabled=true;status.textContent='Sending…';
  try{
   const result=await request('/api/v2-admin',{action:'announce',title:title.value.trim(),body:message,onlyMe});
   show(result);
   status.textContent=result.sent?`Sent to ${devices(result.sent)}.`:(onlyMe?'Turn on alerts in Settings on your phone first.':'No devices have alerts on yet.');
   if(result.failed)status.textContent+=` ${devices(result.failed)} didn’t go through.`;
   if(!onlyMe&&result.sent){body.value='';left.textContent=String(BODY_MAX);}
  }catch(error){status.textContent=error.message;}
  finally{toMe.disabled=toAll.disabled=false;}
 }
 host.refreshAnnounce=refresh;
 return refresh();
}
