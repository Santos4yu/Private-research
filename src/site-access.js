import './site-access.css';
import {accessGranted,canUseTab,availableTab,canUseSport} from './site-access-core.js';
const names={research:'Research',v2:'Props',slate:'Tools',saved:'My Slip',slip:'Slip Analyzer',builder:'Builder',moneyline:'Moneyline',nrfi:'NRFI / YRFI'};
let status=null,initPromise=null,activeDialog=null,lockedDialog=null;
export function siteTabAllowed(tab){return canUseTab(status,tab);}
export function siteSportAllowed(sport){return canUseSport(status,sport);}
export function availableSiteTab(current){return availableTab(status,current);}
export function showLockedTab(tab){
 if(!accessGranted(status)){renderStatus();return;}
 if(lockedDialog)lockedDialog.close();
 const trigger=document.activeElement;
 const dialog=element('dialog',null,'site-account-dialog site-locked-dialog');lockedDialog=dialog;
 const header=element('header');header.append(element('h2','Locked'),button('×',()=>dialog.close(),'site-dialog-close'));header.lastChild.setAttribute('aria-label','Close locked message');dialog.append(header);
 const name=names[tab]||'This section';dialog.append(element('p',name,'site-locked-name'),element('p','In development. This section is temporarily unavailable.','site-account-email'),button('Go back',()=>dialog.close(),'site-primary-button'));
 dialog.setAttribute('aria-label',name+' locked');
 dialog.onclick=e=>{if(e.target===dialog)dialog.close();};
 dialog.onclose=()=>{if(lockedDialog===dialog)lockedDialog=null;dialog.remove();if(trigger instanceof HTMLElement&&trigger.isConnected)trigger.focus({preventScroll:true});};
 document.body.append(dialog);dialog.showModal();
}
async function request(url,body){
 const response=await fetch(url,{cache:'no-store',credentials:'same-origin',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
 let data;try{data=await response.json();}catch{throw new Error('Service temporarily unavailable. Please try again.');}
 if(!response.ok)throw new Error(data.error||'Request unavailable');return data;
}
function element(tag,text,className){const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;}
function button(text,handler,className='site-text-button'){const node=element('button',text,className);node.type='button';node.onclick=handler;return node;}
function brand(){const node=element('div',null,'site-auth-brand');node.append(element('span','K','site-auth-mark'),element('span','Krazy Data'));return node;}

function authForm(host,initialMode='sign-in'){
 let mode=initialMode,busy=false;
 const form=element('form',null,'site-auth-form');
 form.innerHTML=`<div class="site-auth-modes" role="group" aria-label="Account access"><button type="button" data-mode="sign-in">Sign in</button><button type="button" data-mode="sign-up">Create account</button></div><h1></h1><p class="site-auth-subtitle"></p><label class="site-email-label">Email address<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label><label class="site-password-label">Password<span class="site-password-wrap"><input name="password" type="password" minlength="8" maxlength="128" autocomplete="current-password" required placeholder="Enter your password"><button type="button" class="site-show-password" aria-label="Show password">Show</button></span></label><label class="site-code-label" hidden>Recovery code<input name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="Code from your email"></label><label class="site-pin-label" hidden>Admin passcode<input name="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="32"></label><div class="site-auth-links"><button type="button" class="site-text-button site-forgot">Forgot password?</button></div><p class="site-auth-feedback" role="status" aria-live="polite"></p><button type="submit" class="site-primary-button"></button><button type="button" class="site-text-button site-auth-back" hidden>Back to sign in</button>`;
 const email=form.elements.email,password=form.elements.password,code=form.elements.code,pin=form.elements.pin;
 email.value=status?.account?.email||'';
 const feedback=form.querySelector('[role=status]');
 function setMode(next){
  if(busy)return;mode=next;feedback.textContent='';
  const headings={'sign-in':'Welcome back','sign-up':'Create your account',recover:'Reset your password','verify-recovery':'Check your email','update-password':'Choose a new password',admin:'Administrator access'};
  const subtitles={'sign-in':'Sign in to your research workspace.','sign-up':'Your MLB and NFL research, in one place.',recover:'We will send a recovery code to your email.','verify-recovery':'Enter the recovery code to continue.','update-password':'Use at least 8 characters.',admin:'Enter your admin passcode to manage the website.'};
  form.querySelector('h1').textContent=headings[mode];form.querySelector('.site-auth-subtitle').textContent=subtitles[mode];
  const showEmail=!['admin','update-password'].includes(mode),showPassword=['sign-in','sign-up','update-password'].includes(mode);
  form.querySelector('.site-email-label').hidden=!showEmail;email.required=showEmail;email.disabled=!showEmail;
  form.querySelector('.site-password-label').hidden=!showPassword;password.required=showPassword;password.disabled=!showPassword;password.autocomplete=mode==='sign-in'?'current-password':'new-password';
  form.querySelector('.site-code-label').hidden=mode!=='verify-recovery';code.required=mode==='verify-recovery';code.disabled=mode!=='verify-recovery';
  form.querySelector('.site-pin-label').hidden=mode!=='admin';pin.required=mode==='admin';pin.disabled=mode!=='admin';
  form.querySelector('.site-auth-modes').hidden=!['sign-in','sign-up'].includes(mode);
  form.querySelector('.site-auth-links').hidden=mode!=='sign-in';form.querySelector('.site-auth-back').hidden=['sign-in','sign-up'].includes(mode);
  form.querySelectorAll('[data-mode]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.mode===mode));b.disabled=b.dataset.mode==='sign-up'&&!status?.registrationOpen;});
  form.querySelector('[type=submit]').textContent={'sign-in':'Sign in','sign-up':'Create account',recover:'Send recovery code','verify-recovery':'Verify code','update-password':'Save password',admin:'Unlock admin'}[mode];
 }
 form.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
 form.querySelector('.site-forgot').onclick=()=>setMode('recover');form.querySelector('.site-auth-back').onclick=()=>setMode('sign-in');
 form.querySelector('.site-show-password').onclick=e=>{password.type=password.type==='password'?'text':'password';e.target.textContent=password.type==='password'?'Show':'Hide';e.target.setAttribute('aria-label',password.type==='password'?'Show password':'Hide password');};
 form.onsubmit=async e=>{
  e.preventDefault();if(busy)return;busy=true;feedback.textContent='';form.setAttribute('aria-busy','true');const submit=form.querySelector('[type=submit]');const text=submit.textContent;submit.disabled=true;submit.textContent='Please wait…';
  try{
   const fields=Object.fromEntries(new FormData(form));
   const data=await request(mode==='admin'?'/api/v2-admin':'/api/session',{action:mode==='admin'?'auth':mode,...fields});
   if(mode==='recover'){busy=false;setMode('verify-recovery');feedback.textContent='If your account exists, a recovery email will arrive shortly.';}
   else if(mode==='verify-recovery'){busy=false;setMode('update-password');password.value='';password.focus();}
   else if(mode==='sign-up'&&!data.signedIn){feedback.textContent=data.message||'Account could not be created. Please try signing in.';}
   else {if(mode==='admin')location.hash='admin';location.reload();return;}
  }catch(error){feedback.textContent=error.message;}
  finally{busy=false;form.removeAttribute('aria-busy');submit.disabled=false;submit.textContent=text;if(['verify-recovery','update-password'].includes(mode))submit.textContent=mode==='verify-recovery'?'Verify code':'Save password';}
 };
 form.siteSetMode=setMode;host.append(form);setMode(initialMode);return form;
}
function accountDialog(){
 if(activeDialog)return;
 const dialog=element('dialog',null,'site-account-dialog');activeDialog=dialog;
 const header=element('header');header.append(element('h2','Your account'),button('×',()=>dialog.close(),'site-dialog-close'));header.lastChild.setAttribute('aria-label','Close account');dialog.append(header);
 dialog.append(element('p',status?.account?.email||'Administrator','site-account-email'));
 dialog.append(button('Admin panel',()=>{dialog.close();window.dispatchEvent(new CustomEvent('vortex:switch-tab',{detail:{tab:'admin'}}));},'site-secondary-button'));
 dialog.append(button('Sign out',async()=>{try{await request('/api/session',{action:'sign-out'});location.reload();}catch(error){dialog.append(element('p',error.message));}},'site-primary-button'));
 dialog.onclose=()=>{activeDialog=null;dialog.remove();};document.body.append(dialog);dialog.showModal();
}
function renderStatus(){
 if(!status)return;
 const granted=accessGranted(status);document.documentElement.dataset.siteAccess=granted?'granted':'locked';
 document.getElementById('app-shell')?.classList.toggle('app-shell-hidden',!granted);
 document.getElementById('boot-loading')?.setAttribute('hidden','');
 if(!granted&&activeDialog)activeDialog.close();
 if(!granted&&lockedDialog)lockedDialog.close();
 let bar=document.getElementById('site-account-bar');if(!bar){bar=element('div',null,'site-account-bar');bar.id='site-account-bar';(document.querySelector('.hero')||document.body).append(bar);}
 bar.hidden=!granted;
 if(granted&&!bar.childElementCount){const account=button('',accountDialog,'site-account-trigger');account.setAttribute('aria-label','Your account');account.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M5 21v-2a7 7 0 0 1 14 0v2" stroke="currentColor" stroke-width="1.6"/></svg>';bar.append(account);}
 document.querySelectorAll('[data-tab],[data-launch-tab]').forEach(b=>{const tab=b.dataset.tab||b.dataset.launchTab;if(tab!=='admin'){b.disabled=!granted;b.dataset.featureLocked=String(!siteTabAllowed(tab));}});
 let gate=document.getElementById('site-policy-gate');if(!gate){gate=element('main',null,'site-policy-gate');gate.id='site-policy-gate';document.body.append(gate);}
 const current=location.hash.slice(1)||'research';
 const next=granted?availableTab(status,current):null;
 document.documentElement.dataset.allTabsLocked=String(granted&&!next);
 let empty=document.getElementById('site-all-locked');if(!empty){empty=element('section',null,'site-all-locked');empty.id='site-all-locked';empty.append(element('h2','In development'),element('p','Sections are temporarily locked. Your account and navigation are still available.'));document.body.append(empty);}empty.hidden=!(granted&&!next);
 const kind=granted?'none':status.maintenance?'maintenance':'login';gate.hidden=kind==='none';
 document.documentElement.dataset.siteMaintenance=String(kind==='maintenance');
 const viewport=document.querySelector('meta[name=viewport]');if(viewport){viewport.dataset.originalContent??=viewport.content;viewport.content=kind==='maintenance'?'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover':viewport.dataset.originalContent;}

 if(granted&&current!==next&&!siteTabAllowed(current)){
  if(next)window.dispatchEvent(new CustomEvent('vortex:switch-tab',{detail:{tab:next}}));
  if(gate.dataset.lockedTab!==current){gate.dataset.lockedTab=current;showLockedTab(current);}
 }else delete gate.dataset.lockedTab;
 // Preserve typed credentials and recovery progress during background policy refresh.
 if(gate.dataset.kind!==kind){gate.dataset.kind=kind;gate.replaceChildren();
  if(kind!=='none'){
   const card=element('section',null,'site-auth-card');card.append(brand());
   if(kind==='login'){
    if(status.accountsConfigured){const form=authForm(card);card.append(button('Administrator',()=>{form.siteSetMode('admin');form.elements.pin.focus();},'site-admin-link'));}
    else{card.append(element('h1','Sign-in is being configured'),element('p','Please check back shortly.','site-auth-subtitle'));const form=authForm(card,'admin');form.querySelector('.site-auth-back').hidden=true;}
   }else{card.append(element('h1','We’ll be back shortly'),element('p',status.message,'site-auth-subtitle'));const admin=button('Administrator',()=>{card.replaceChildren(brand());authForm(card,'admin');},'site-admin-link');card.append(admin);}
   gate.append(card);
  }
 }
 window.dispatchEvent(new CustomEvent('vortex:site-policy',{detail:{...status,accessGranted:granted}}));
}
export async function refreshSiteAccess(){
 try{status=await request('/api/session?action=site-status');if(status.refreshAvailable&&!status.account){try{await request('/api/session',{action:'refresh'});status=await request('/api/session?action=site-status');}catch{}}renderStatus();return status;}
 catch{status={maintenance:true,message:'Website access is temporarily unavailable. Please retry shortly.',disabledTabs:[],requireLogin:true,registrationOpen:false,isAdmin:false};renderStatus();return status;}
}
export function initSiteAccess(){
 if(initPromise)return initPromise;
 initPromise=(async()=>{await refreshSiteAccess();setInterval(()=>{if(!document.hidden)refreshSiteAccess();},30000);if(accessGranted(status))return status;return new Promise(resolve=>{const listener=e=>{if(e.detail.accessGranted){window.removeEventListener('vortex:site-policy',listener);resolve(e.detail);}};window.addEventListener('vortex:site-policy',listener);});})();return initPromise;
}
export async function loadSiteControls(){
 const policy=await request('/api/v2-admin?action=site-settings');let host=document.getElementById('site-controls');if(!host)return;
 host.hidden=false;host.innerHTML='<h3>Website controls</h3><form><div class="site-control-switches"></div><label>Maintenance message<textarea name="message" maxlength="240" required></textarea></label><fieldset><legend>Available tabs</legend></fieldset><fieldset class="site-sport-controls"><legend>Visible sports</legend></fieldset><p role="status"></p><button type="submit">Save website settings</button></form>';
 const form=host.querySelector('form');for(const [key,title] of Object.entries({maintenance:'Maintenance mode — members cannot use the website',requireLogin:'Require email account to access research',registrationOpen:'Allow new account registrations'})){const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.name=key;input.checked=policy[key];label.append(input,document.createTextNode(title));host.querySelector('.site-control-switches').append(label);}
 form.elements.message.value=policy.message;
 for(const [key,title] of Object.entries(names)){const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.name='tab';input.value=key;input.checked=!policy.disabledTabs.includes(key);label.append(input,document.createTextNode(title));host.querySelector('fieldset').append(label);}
 const sportLabel=element('label');const sportInput=document.createElement('input');sportInput.type='checkbox';sportInput.name='sport';sportInput.value='nfl';sportInput.checked=!(policy.disabledSports||[]).includes('nfl');sportLabel.append(sportInput,document.createTextNode('NFL — show sport and allow NFL data'));host.querySelector('.site-sport-controls').append(sportLabel);
 form.onsubmit=async e=>{e.preventDefault();const message=host.querySelector('[role=status]');const button=host.querySelector('[type=submit]');button.disabled=true;try{await request('/api/v2-admin',{action:'site-settings',settings:{maintenance:form.elements.maintenance.checked,requireLogin:form.elements.requireLogin.checked,registrationOpen:form.elements.registrationOpen.checked,message:form.elements.message.value,disabledSports:[...form.querySelectorAll('[name=sport]')].filter(c=>!c.checked).map(c=>c.value),disabledTabs:[...form.querySelectorAll('[name=tab]')].filter(c=>!c.checked).map(c=>c.value)}});message.textContent='Saved. Changes apply to member requests immediately.';await refreshSiteAccess();}catch(error){message.textContent=error.message;}finally{button.disabled=false;}};
}
