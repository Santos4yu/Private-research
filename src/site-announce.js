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
 const title=h('input',{type:'text',name:'announceTitle',maxlength:TITLE_MAX,placeholder:'Krazy Data',autocomplete:'off'});
 const body=h('textarea',{name:'announceBody',maxlength:BODY_MAX,rows:3,placeholder:'New update is live'});
 const left=h('span',{className:'announce-left',text:String(BODY_MAX)});
 const status=h('p',{role:'status'});
 const last=h('div',{className:'announce-last',hidden:true});
 const toMe=h('button',{type:'button',className:'announce-me',text:'Send to me',onClick:()=>send(true)});
 const toAll=h('button',{type:'button',className:'announce-all',text:'Send to everyone',onClick:()=>send(false)});
 body.addEventListener('input',()=>{left.textContent=String(BODY_MAX-body.value.length);});
 host.append(
  h('div',{className:'announce-reach'},h('span',{text:'Alerts on'}),count),
  h('label',{className:'announce-field'},'Title',title),
  h('label',{className:'announce-field'},h('span',{className:'announce-field-head'},'Message',left),body),
  h('div',{className:'announce-actions'},toMe,toAll),
  status,last);

 let reach=0;
 function show(data){
  reach=Number(data.devices)||0;
  count.textContent=devices(reach);
  const item=data.last;
  last.hidden=!item;
  if(item)last.replaceChildren(h('span',{text:`Last sent ${when(item.at)} · ${devices(Number(item.sent)||0)}`}),h('b',{text:item.title}),h('p',{text:item.body}));
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
