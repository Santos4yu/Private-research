// The admin panel's Members tab: everyone who has signed in, and per-person
// rules on top of the website switches (site_members.py) -- early access to
// a section that is off for everyone, a section removed for one person,
// suspension, and a badge. Rules follow the email address, so someone can be
// set up before they ever sign in.

const SPORTS={wnba:'WNBA',mlb:'MLB',nfl:'NFL',soccer:'Soccer',nhl:'NHL',nba:'NBA',cfb:'CFB'};
const LISTS={tab:'disabledTabs',sport:'disabledSports',finderSport:'disabledFinderSports'};
const GROUPS=[['tab','Sections'],['sport','Research sports'],['finderSport','Finder sports']];
const CHOICES=[['default','Default'],['on','On'],['off','Off']];
const PAGE=50;
const EMAIL=/^[^\s@]+@[^\s@]+$/;

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

export function memberBadge(badge){
 return h('span',{className:'member-badge','data-badge':badge.key,text:badge.label});
}

function ago(iso){
 const time=Date.parse(iso||'');if(!Number.isFinite(time))return '';
 const minutes=Math.round((Date.now()-time)/60000);
 if(minutes<2)return 'just now';if(minutes<60)return `${minutes}m ago`;
 const hours=Math.round(minutes/60);if(hours<24)return `${hours}h ago`;
 const days=Math.round(hours/24);if(days<30)return `${days}d ago`;
 return new Date(time).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});
}
const day=iso=>{const time=Date.parse(iso||'');return Number.isFinite(time)?new Date(time).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'}):'';};

function itemLabel(item,names){
 const [kind,value]=item.split(':');
 if(kind==='tab')return names[value]||value;
 if(kind==='sport')return `${SPORTS[value]||value} research`;
 return `${SPORTS[value]||value} in the Finder`;
}
const siteOpen=(policy,item)=>{const [kind,value]=item.split(':');return !(policy[LISTS[kind]]||[]).includes(value);};

function summary(rule){
 const access=Object.values(rule?.access||{});
 return {on:access.filter(Boolean).length,off:access.filter(value=>value===false).length};
}

export function mountMembersPanel(host,{request,names}){
 if(host.dataset.mounted)return;host.dataset.mounted='1';
 let data=null,query='',shown=PAGE,open=null;
 const search=h('input',{type:'search',placeholder:'Search or add by email',autocomplete:'off',spellcheck:'false','aria-label':'Search members or add one by email'});
 const count=h('p',{className:'site-members-count'});
 const list=h('div',{className:'site-members-list'});
 const more=h('button',{type:'button',className:'site-members-more',hidden:true,onClick:()=>{shown+=PAGE;render();}},'Show more');
 const status=h('p',{className:'site-members-status',role:'status'});
 host.append(
  h('label',{className:'site-members-search'},h('span',{'aria-hidden':'true',text:'⌕'}),search),
  h('p',{className:'site-controls-hint',text:'Default follows the website switch. On gives someone a section even while it is off for everyone (early access); Off takes it away from just them. Rules follow the email address, so you can set someone up before they sign in.'}),
  count,list,more,status);
 search.addEventListener('input',()=>{query=search.value.trim().toLowerCase();shown=PAGE;render();});

 async function load(){
  status.textContent='Loading members…';
  try{data=await request('/api/v2-admin?action=members');status.textContent='';render();}
  catch(error){status.replaceChildren(error.message,' ',h('button',{type:'button',className:'site-members-retry',onClick:load},'Retry'));}
 }

 function editor(member){
  const rule=member.rule||{};
  const draft={access:{...(rule.access||{})},badge:rule.badge||'',suspended:Boolean(rule.suspended),comped:Boolean(rule.comped),note:rule.note||''};
  const note=h('textarea',{maxlength:'200',rows:'2',placeholder:'Only admins see this'});note.value=draft.note;
  note.addEventListener('input',()=>{draft.note=note.value;});
  const suspend=h('input',{type:'checkbox',name:'memberSuspended'});suspend.checked=draft.suspended;
  suspend.addEventListener('change',()=>{draft.suspended=suspend.checked;});
  const comp=h('input',{type:'checkbox',name:'memberComped'});comp.checked=draft.comped;
  comp.addEventListener('change',()=>{draft.comped=comp.checked;});
  const badges=h('div',{className:'site-member-choices',role:'group','aria-label':'Badge'});
  const badgeOptions=[{key:'',label:'None'},...data.badges];
  const paintBadges=()=>badges.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===draft.badge)));
  badgeOptions.forEach(option=>badges.append(h('button',{type:'button','data-value':option.key,'data-badge':option.key||null,onClick:()=>{draft.badge=option.key;paintBadges();}},option.label)));
  paintBadges();
  const groups=GROUPS.map(([kind,title])=>{
   const items=data.items.filter(item=>item.startsWith(`${kind}:`));
   return h('div',{className:'site-member-group',role:'group','aria-label':title},h('h4',{text:title}),items.map(item=>{
    const label=itemLabel(item,names);
    const seg=h('div',{className:'site-member-seg',role:'group','aria-label':`${label} access`});
    const value=()=>draft.access[item]===true?'on':draft.access[item]===false?'off':'default';
    const paint=()=>seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value===value())));
    CHOICES.forEach(([key,text])=>seg.append(h('button',{type:'button','data-value':key,onClick:()=>{if(key==='default')delete draft.access[item];else draft.access[item]=key==='on';paint();}},text)));
    paint();
    return h('div',{className:'site-member-access'},h('span',{},label,h('small',{text:siteOpen(data.policy,item)?'On for everyone':'Off for everyone'})),seg);
   }));
  });
  const saveStatus=h('p',{className:'site-member-status',role:'status'});
  const save=h('button',{type:'button',className:'site-member-save'},'Save member');
  save.addEventListener('click',async()=>{
   save.disabled=true;saveStatus.textContent='Saving…';
   try{
    const result=await request('/api/v2-admin',{action:'member-rule',email:member.email,rule:{access:draft.access,badge:draft.badge,suspended:draft.suspended,comped:draft.comped,note:draft.note}});
    const index=data.members.findIndex(entry=>entry.email===member.email);
    if(index>=0)data.members[index]=result.member;else data.members.unshift(result.member);
    open=member.email;render();
    host.querySelector('.site-member[data-open=true] .site-member-status').textContent=result.member.rule?'Saved. It applies on their next page load.':'Back to the website defaults.';
   }catch(error){saveStatus.textContent=error.message;save.disabled=false;}
  });
  const reset=h('button',{type:'button',className:'site-member-reset',onClick:()=>{
   draft.access={};draft.badge='';draft.suspended=false;draft.comped=false;draft.note='';
   note.value='';suspend.checked=false;comp.checked=false;paintBadges();
   groups.forEach(group=>group.querySelectorAll('.site-member-seg').forEach(seg=>seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.value==='default')))));
   saveStatus.textContent='Cleared here. Save to put them back on the website defaults.';
  }},'Clear rules');
  return h('div',{className:'site-member-editor'},
   h('div',{className:'site-member-section'},h('span',{className:'site-member-label',text:'Badge'}),badges,h('small',{className:'site-member-hint',text:'Admin: everything on for them, sections you add later too, and free access. They never see admin notes, error messages or this panel.'})),
   h('div',{className:'site-member-section'},h('span',{className:'site-member-label',text:'Access'}),groups),
   h('div',{className:'site-control-switches'},h('label',{},comp,h('span',{},'Free Pro access',h('small',{text:'Gets in without a subscription while the website requires one.'}))),h('label',{},suspend,h('span',{},'Suspend this account',h('small',{text:'They stay signed in but can’t use any part of the site until you lift it.'})))),
   h('label',{className:'site-member-note'},'Private note',note),
   h('div',{className:'site-member-actions'},save,reset),saveStatus);
 }

 function row(member,isNew=false){
  const rule=member.rule,{on,off}=summary(rule),expanded=open===member.email;
  const meta=isNew?'Not signed in yet':member.lastSeen?`Last seen ${ago(member.lastSeen)}${member.firstSeen?` · Joined ${day(member.firstSeen)}`:''}`:'Not signed in yet';
  const chips=h('span',{className:'site-member-chips'},
   isNew&&h('span',{className:'site-member-chip',text:'New'}),
   rule?.badge&&memberBadge(data.badges.find(badge=>badge.key===rule.badge)||{key:rule.badge,label:rule.badge}),
   rule?.suspended&&h('span',{className:'site-member-chip','data-tone':'danger',text:'Suspended'}),
   rule?.comped&&h('span',{className:'site-member-chip','data-tone':'on',text:'Free Pro'}),
   on>0&&h('span',{className:'site-member-chip','data-tone':'on',text:`+${on} access`}),
   off>0&&h('span',{className:'site-member-chip','data-tone':'off',text:`${off} removed`}));
  const head=h('button',{type:'button',className:'site-member-head','aria-expanded':String(expanded),onClick:()=>{open=expanded?null:member.email;render();}},
   h('span',{className:'site-member-avatar','aria-hidden':'true',text:(member.name||member.email).slice(0,1).toUpperCase()},
    member.avatarUrl&&h('img',{src:member.avatarUrl,alt:'',loading:'lazy',onError:e=>{e.currentTarget.remove();}})),
   h('span',{className:'site-member-who'},member.name?h('strong',{text:member.name},h('small',{text:member.email})):h('strong',{text:member.email}),h('small',{text:meta})),
   chips,h('span',{className:'site-member-chevron','aria-hidden':'true',text:'⌄'}));
  return h('article',{className:'site-member','data-open':String(expanded)},head,expanded&&editor(member));
 }

 function render(){
  if(!data)return;
  const matches=data.members.filter(member=>!query||member.email.includes(query));
  const adding=EMAIL.test(query)&&!data.members.some(member=>member.email===query);
  list.replaceChildren(...(adding?[row({email:query,rule:null},true)]:[]),...matches.slice(0,shown).map(member=>row(member)));
  const total=data.members.length,ruled=data.members.filter(member=>member.rule).length;
  count.textContent=query?`${matches.length} of ${total} members match`:`${total} ${total===1?'member':'members'} · ${ruled} with special access`;
  if(!matches.length&&!adding)list.append(h('p',{className:'site-members-empty',text:query?'No one matches. Type a full email to set someone up.':'No one has signed in yet.'}));
  more.hidden=matches.length<=shown;
 }

 load();
}
