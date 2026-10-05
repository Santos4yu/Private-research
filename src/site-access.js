import './site-access.css';
import {serviceRequestError} from './storage-retry.js';
import {accessGranted,accountControlsVisible,canUseTab,availableTab,canUseSport,canUseFinderSport,hiddenTabs,ADMIN_TABS,FINDER_SPORTS} from './site-access-core.js';
import {mountMembersPanel,memberBadge} from './site-members.js';
import {mountAnnouncePanel} from './site-announce.js';
import {accountProfile,saveAccountProfile} from './account-sync.js';
import './push-alerts.js';
import './install-guide.js';
const ACCOUNT_ICON='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M5 21v-2a7 7 0 0 1 14 0v2" stroke="currentColor" stroke-width="1.6"/></svg>';
const names={research:'Research',finder:'Finder',moves:'Line Moves',v2:'Props',slate:'Tools',saved:'My Slip',slip:'Slip Analyzer',builder:'Builder',moneyline:'Moneyline',nrfi:'NRFI / YRFI',community:'Community',bot:'Krazy Bot',sheets:'Cheat Sheets'};
let status=null,initPromise=null,activeDialog=null,lockedDialog=null;
export function siteTabAllowed(tab){return canUseTab(status,tab);}
export function siteIsAdmin(){return Boolean(status?.isAdmin);}
export function siteSportAllowed(sport){return canUseSport(status,sport);}
export function siteFinderSportAllowed(sport){return canUseFinderSport(status,sport);}
export function availableSiteTab(current){return availableTab(status,current);}
export function showLockedTab(tab){
 if(!accessGranted(status)){renderStatus();return;}
 // An admin-only section isn't named to anyone else, not even as locked.
 if(ADMIN_TABS.includes(tab))return;
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
 if(!response.ok)throw serviceRequestError(data,response.headers.get('Retry-After'));return data;
}
function element(tag,text,className){const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;}
function button(text,handler,className='site-text-button'){const node=element('button',text,className);node.type='button';node.onclick=handler;return node;}
function brand(){const node=element('div',null,'site-auth-brand');const mark=document.createElement('img');mark.className='site-auth-wordmark';mark.src='/icons/krazy-data-wordmark.png';mark.alt='Krazy Data';mark.width=158;mark.height=28;node.append(mark);return node;}

// The one-time "welcome" overlay this used to be has been replaced by the
// always-shown landing page (src/LandingPage.jsx, mounted from
// renderStatus() below) -- every signed-out visitor lands there now,
// every time, not just once per device.

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
   else {if(mode==='admin')location.pathname='/research';else location.reload();return;}
  }catch(error){feedback.textContent=error.message;}
  finally{busy=false;form.removeAttribute('aria-busy');submit.disabled=false;submit.textContent=text;if(['verify-recovery','update-password'].includes(mode))submit.textContent=mode==='verify-recovery'?'Verify code':'Save password';}
 };
 form.siteSetMode=setMode;host.append(form);setMode(initialMode);return form;
}
// The signed-out front door gets its own clean URLs (/ for the landing
// page, /sign-up and /sign-in for the auth card) instead of leaking
// whatever internal app route happened to be in the address bar before
// signing out (app.js never touches the URL until access is granted, so
// without this the gate would just sit on top of a stale path like
// /research). renderLanding/renderAuthCard both take the gate element so
// the popstate listener below can call them without re-running renderStatus.
function renderLanding(gate){
 gate.dataset.view='landing';gate.replaceChildren();
 // Explicit width: a plain block <div> directly inside this fixed,
 // overflow:auto gate doesn't reliably stretch to fill it on its own in
 // every browser (observed shrink-to-fit sizing instead) -- confirmed
 // fixed by forcing it here rather than relying on the default.
 const host=element('div');host.style.cssText='width:100%;min-height:100%';gate.append(host);
 window.vortexMountLandingPage(host,{
  onSignUp:()=>{history.pushState({},'','/sign-up');renderAuthCard(gate,'sign-up');},
  onSignIn:()=>{history.pushState({},'','/sign-in');renderAuthCard(gate,'sign-in');},
 });
}
function renderAuthCard(gate,initialMode){
 gate.dataset.view='form';gate.replaceChildren();
 const host=element('div');host.style.cssText='width:100%;height:100%';gate.append(host);
 window.vortexMountAuthCard(host,{
  initialMode:initialMode||'sign-in',
  registrationOpen:!!status?.registrationOpen,
  accountEmail:status?.account?.email||'',
  // Only sign-in/sign-up get their own URL -- recover/verify-recovery/
  // update-password/admin are sub-steps of whichever of those two the
  // visitor was already on, so the address bar just stays put for them.
  onModeChange:(mode)=>{
   if(mode==='sign-up'&&location.pathname!=='/sign-up')history.pushState({},'','/sign-up');
   else if(mode==='sign-in'&&location.pathname!=='/sign-in')history.pushState({},'','/sign-in');
  },
  onBack:()=>{history.pushState({},'','/');renderLanding(gate);},
 });
}
// Picks landing vs. sign-up vs. sign-in from whatever's actually in the
// address bar right now -- used both for the first paint and every
// popstate (back/forward), so a bookmarked/shared /sign-up link, or the
// back button from it, both land in the right place.
function renderSignedOutView(gate){
 const path=location.pathname;
 if(path==='/sign-up')renderAuthCard(gate,'sign-up');
 else if(path==='/sign-in')renderAuthCard(gate,'sign-in');
 else {if(path!=='/')history.replaceState({},'','/');renderLanding(gate);}
}
window.addEventListener('popstate',()=>{
 if(!status||accessGranted(status))return;
 const gate=document.getElementById('site-policy-gate');
 if(!gate||gate.dataset.kind!=='login'||!status.accountsConfigured)return;
 renderSignedOutView(gate);
});
function accountDialog(){
 if(activeDialog)return;
 const dialog=element('dialog',null,'site-account-dialog');activeDialog=dialog;
 const header=element('header');header.append(element('h2','Your account'),button('×',()=>dialog.close(),'site-dialog-close'));header.lastChild.setAttribute('aria-label','Close account');dialog.append(header);
 // Admin access lives behind 3 rapid clicks on the settings gear now, not
 // here -- this dialog is the member's profile + signing out.
 const account=status?.account;
 const badge=status?.isAdmin&&!account?{key:'admin',label:'Admin'}:status?.badge;
 const signOut=button('Sign out',async()=>{try{await request('/api/session',{action:'sign-out'});location.reload();}catch(error){dialog.append(element('p',error.message));}},account?'site-secondary-button site-profile-signout':'site-primary-button');
 dialog.onclose=()=>{activeDialog=null;window.removeEventListener('vortex:account-profile',fill);dialog.remove();};
 if(!account){
  const who=element('p','Administrator','site-account-email');if(badge)who.append(' ',memberBadge(badge));
  dialog.append(who,signOut);document.body.append(dialog);dialog.showModal();return;
 }
 // Name and photo live on the account (account_profile.py), so they show on
 // every device and next to the member's community posts.
 let photo,preview=null;
 const form=element('form',null,'site-profile');
 const avatar=element('span',null,'site-profile-avatar');
 const file=document.createElement('input');file.type='file';file.accept='image/*';file.hidden=true;
 const photoButton=button('',()=>file.click(),'site-profile-photo');photoButton.setAttribute('aria-label','Change profile photo');
 photoButton.append(avatar,element('span','Edit','site-profile-photo-edit'));
 const removePhoto=button('Remove photo',()=>{photo=null;paint();},'site-text-button site-profile-remove');
 const nameInput=document.createElement('input');nameInput.name='displayName';nameInput.maxLength=32;nameInput.autocomplete='nickname';nameInput.placeholder='How you appear in Community';
 const nameLabel=element('label',null,'site-profile-name');nameLabel.append(element('span','Display name'),nameInput);
 const who=element('p',account.email||'','site-account-email site-profile-email');if(badge)who.append(' ',memberBadge(badge));
 const message=element('p',null,'site-profile-status');message.setAttribute('role','status');
 const save=element('button','Save profile','site-primary-button');save.type='submit';
 function paint(){
  const current=accountProfile();
  const src=photo===null?null:preview||current?.avatarUrl;
  avatar.replaceChildren((nameInput.value||current?.name||account.email||'?').trim().slice(0,1).toUpperCase());
  if(src){const img=document.createElement('img');img.src=src;img.alt='';img.onerror=()=>img.remove();avatar.append(img);}
  removePhoto.hidden=!src;
 }
 function fill(){
  const current=accountProfile();
  nameInput.disabled=save.disabled=!current;
  if(current&&document.activeElement!==nameInput&&!form.dataset.edited)nameInput.value=current.name||'';
  if(!current)nameInput.placeholder='Loading your profile…';else nameInput.placeholder='How you appear in Community';
  paint();
 }
 window.addEventListener('vortex:account-profile',fill);
 nameInput.addEventListener('input',()=>{form.dataset.edited='1';paint();});
 file.addEventListener('change',()=>{
  const chosen=file.files?.[0];file.value='';if(!chosen)return;
  if(!chosen.type.startsWith('image/')){message.textContent='Choose an image file.';return;}
  photo=chosen;if(preview)URL.revokeObjectURL(preview);preview=URL.createObjectURL(chosen);paint();
  message.textContent='Looks good. Save to use this photo.';
 });
 form.onsubmit=async event=>{
  event.preventDefault();save.disabled=true;message.textContent='Saving…';
  try{
   await saveAccountProfile({name:nameInput.value,...(photo!==undefined?{photo}:{})});
   photo=undefined;if(preview){URL.revokeObjectURL(preview);preview=null;}delete form.dataset.edited;
   fill();message.textContent='Saved. Your name and photo show on every device.';
  }catch(error){message.textContent=error.message;}
  finally{save.disabled=!accountProfile();}
 };
 const row=element('div',null,'site-profile-row');
 const fields=element('div',null,'site-profile-fields');fields.append(nameLabel,who);
 row.append(photoButton,fields);
 form.append(row,file,removePhoto,message,save);
 dialog.append(form,element('p','Your slip, colors, presets and background follow this account to every device you sign in on.','site-profile-note'),signOut);
 fill();
 document.body.append(dialog);dialog.showModal();
}
// The account button shows the member's photo once they have one.
function paintAccountTrigger(){
 const trigger=document.querySelector('.site-account-trigger');if(!trigger)return;
 const url=status?.account?accountProfile()?.avatarUrl:null;
 if(trigger.dataset.avatar===(url||''))return;
 trigger.dataset.avatar=url||'';
 trigger.innerHTML=ACCOUNT_ICON;
 if(url){const img=document.createElement('img');img.src=url;img.alt='';img.onload=()=>trigger.replaceChildren(img);}
}
window.addEventListener('vortex:account-profile',paintAccountTrigger);
// The one way the boot screen leaves: fade, then drop it from the page.
// The access check used to set `hidden` on it -- an instant cut -- while app
// start-up separately tried to fade it out after it was already gone, so the
// site always arrived with a jump. Both now call this, and only the first
// call does anything.
let bootDismissed=false;
export function dismissBootLoader(){
 if(bootDismissed)return;bootDismissed=true;
 const loader=document.getElementById('boot-loading');if(!loader)return;
 loader.classList.add('private-loader-leaving');
 const remove=()=>loader.remove();
 loader.addEventListener('transitionend',remove,{once:true});
 // transitionend never fires when there is no transition (reduced motion)
 // or the tab is in the background, so a timer finishes the job either way.
 setTimeout(remove,700);
}
function renderStatus(){
 if(!status)return;
 const granted=accessGranted(status);document.documentElement.dataset.siteAccess=granted?'granted':'locked';
 document.getElementById('app-shell')?.classList.toggle('app-shell-hidden',!granted);
 dismissBootLoader();
 if(!granted&&activeDialog)activeDialog.close();
 if(!granted&&lockedDialog)lockedDialog.close();
 // Lives on <body>, never inside .hero. .hero is position:relative with
 // z-index:1, which makes it a stacking context -- nesting this in there
 // meant the account button's own z-index:70 only ever competed INSIDE
 // .hero (at .hero's level of 1), so any card stacked above that painted
 // straight over it, while the settings gear stayed clear purely because
 // it's a direct child of <body>. Keeping both at the same level also
 // keeps document-top positioning independent of sticky app headers.
 let bar=document.getElementById('site-account-bar');if(!bar){bar=element('div',null,'site-account-bar');bar.id='site-account-bar';}
 if(bar.parentElement!==document.body)document.body.append(bar);
 bar.hidden=!accountControlsVisible(status);
 if(granted&&!bar.childElementCount){const account=button('',accountDialog,'site-account-trigger');account.setAttribute('aria-label','Your account');account.innerHTML=ACCOUNT_ICON;bar.append(account);}
 paintAccountTrigger();
 document.querySelectorAll('[data-tab],[data-launch-tab]').forEach(b=>{const tab=b.dataset.tab||b.dataset.launchTab;if(tab!=='admin'){b.disabled=!granted;b.dataset.featureLocked=String(!siteTabAllowed(tab));}});
 // A section switched off in the admin panel disappears for everyone but
 // admins: site-access.css hides every element marked data-requires-tab
 // for a tab listed here, wherever and whenever it is drawn.
 document.documentElement.dataset.hiddenTabs=hiddenTabs(status,Object.keys(names)).join(' ');
 let gate=document.getElementById('site-policy-gate');if(!gate){gate=element('main',null,'site-policy-gate');gate.id='site-policy-gate';document.body.append(gate);}
 // URL paths use a friendlier slug than the internal tab id for a few tabs
 // (v2 -> /props, slate -> /tools, slip -> /slip-analyzer) -- app.js owns
 // the canonical map, this is just the read side for the same paths.
 const slugToTab={props:'v2',tools:'slate','slip-analyzer':'slip'};
 const slug=location.pathname.slice(1)||location.hash.slice(1);
 const current=slugToTab[slug]||slug||'finder';
 const next=granted?availableTab(status,current):null;
 document.documentElement.dataset.allTabsLocked=String(granted&&!next);
 let empty=document.getElementById('site-all-locked');if(!empty){empty=element('section',null,'site-all-locked');empty.id='site-all-locked';empty.append(element('h2','In development'),element('p','Sections are temporarily locked. Your account and navigation are still available.'));document.body.append(empty);}empty.hidden=!(granted&&!next);
 const kind=granted?'none':status.maintenance?'maintenance':status.suspended&&status.account?'suspended':'login';gate.hidden=kind==='none';
 document.documentElement.dataset.siteMaintenance=String(kind==='maintenance');
 const viewport=document.querySelector('meta[name=viewport]');if(viewport){viewport.dataset.originalContent??=viewport.content;viewport.content=kind==='maintenance'?'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover':viewport.dataset.originalContent;}

 if(granted&&current!==next&&!siteTabAllowed(current)){
  if(next)window.dispatchEvent(new CustomEvent('vortex:switch-tab',{detail:{tab:next}}));
  if(gate.dataset.lockedTab!==current){gate.dataset.lockedTab=current;showLockedTab(current);}
 }else delete gate.dataset.lockedTab;
 // Preserve typed credentials, recovery progress, and which view (landing
 // vs. the actual form) a signed-out visitor is on during a background
 // policy refresh -- only rebuild when kind itself actually changes.
 if(gate.dataset.kind!==kind){gate.dataset.kind=kind;gate.replaceChildren();
  if(kind==='login'&&status.accountsConfigured){
   // Every signed-out visitor's real front door: the landing page, every
   // time (not a one-time overlay) -- the actual sign-in/sign-up form only
   // shows once they pick one of its two buttons. Which of the two (or
   // landing) depends on the URL already in the address bar.
   renderSignedOutView(gate);
  }else if(kind==='login'){
   delete gate.dataset.view;
   const card=element('section',null,'site-auth-card');card.append(brand());
   card.append(element('h1','Sign-in is being configured'),element('p','Please check back shortly.','site-auth-subtitle'));
   const form=authForm(card,'admin');form.querySelector('.site-auth-back').hidden=true;
   gate.append(card);
  }else if(kind==='suspended'){
   delete gate.dataset.view;
   const card=element('section',null,'site-auth-card');card.append(brand());
   card.append(element('h1','Account suspended'),element('p','An administrator has paused access for this account. If you think this is a mistake, reach out to support.','site-auth-subtitle'));
   card.append(element('p',status.account.email||'','site-account-email'));
   card.append(button('Sign out',async()=>{try{await request('/api/session',{action:'sign-out'});}catch{}location.reload();},'site-primary-button'));
   gate.append(card);
  }else if(kind==='maintenance'){
   delete gate.dataset.view;
   const card=element('section',null,'site-auth-card');card.append(brand());
   card.append(element('h1','We’ll be back shortly'),element('p',status.message,'site-auth-subtitle'));
   const admin=button('Administrator',()=>{card.replaceChildren(brand());authForm(card,'admin');},'site-admin-link');card.append(admin);
   gate.append(card);
  }
 }
 window.dispatchEvent(new CustomEvent('vortex:site-policy',{detail:{...status,accessGranted:granted}}));
}
// Only signing out ends a session. Everything below exists because members
// used to be thrown back to the sign-in screen by things that were never a
// verdict on them: one failed status request (a phone switching networks)
// replaced the whole page with the "unavailable" screen, and a session the
// server merely couldn't confirm this time -- Supabase slow, a refresh still
// in flight -- rendered as signed out.
//
// "Unsettled" is that second case: the member still has a session cookie,
// the server just has no definite answer yet (the server reports it as
// refreshAvailable without an account).
const unsettled=s=>Boolean(s?.refreshAvailable&&!s.account);
let retryTimer=0,failures=0,retryNotBefore=0;
function retrySoon(){
 clearTimeout(retryTimer);
 // 2s, 4s, 8s, 16s, then every 30s until an answer comes back.
 retryTimer=setTimeout(()=>{retryTimer=0;refreshSiteAccess();},Math.max(retryNotBefore-Date.now(),Math.min(30000,2000*2**Math.min(failures-1,4))));
}
// The loading screen, kept up while a member's session is being confirmed.
// After a few seconds it says so, and offers the sign-in page as a way out
// in case the answer never comes.
let holding=false;
function holdBoot(pending){
 if(holding)return;holding=true;
 const loader=document.getElementById('boot-loading');if(!loader)return;
 setTimeout(()=>{
  if(!holding||status||!loader.isConnected||loader.querySelector('.private-loader-note'))return;
  const note=element('div',null,'private-loader-note');note.append(element('p','Signing you back in…'));
  setTimeout(()=>{if(holding&&!status&&note.isConnected)note.append(button('Go to sign in',()=>{holding=false;status=pending;renderStatus();},'private-loader-link'));},15000);
  loader.append(note);
 },2500);
}
async function readStatus(){
 let next=await request('/api/session?action=site-status');
 if(unsettled(next)){try{await request('/api/session',{action:'refresh'});next=await request('/api/session?action=site-status');}catch{}}
 return next;
}
async function checkSiteAccess(){
 if(status&&Date.now()<retryNotBefore)return status;
 let next=null,lastError=null;
 // On first load the boot screen is still up, so a couple of quick retries
 // settle it before anything is shown. After that, one attempt per check.
 for(let attempt=0;attempt<(status&&!status.offline?1:3);attempt++){
  if(attempt)await new Promise(r=>setTimeout(r,700*attempt));
  try{next=await readStatus();}catch(error){
   next=null;lastError=error;
   if(error.retryAfter){retryNotBefore=Date.now()+error.retryAfter*1000;break;}
  }
  if(next&&!unsettled(next))break;
 }
 if(next&&!unsettled(next)){failures=0;retryNotBefore=0;clearTimeout(retryTimer);retryTimer=0;holding=false;status=next;renderStatus();return status;}
 // No definite answer. Whoever is already in stays in, on the status we
 // last knew, and we ask again shortly -- nobody is signed out for a blip.
 failures++;retrySoon();
 // A session the server couldn't confirm yet (Supabase slow or busy, most
 // often when someone comes back after the hour their sign-in token lasts)
 // is never drawn as signed out. Opening the site, the loading screen stays
 // up while we keep asking; this used to show the sign-in page instead.
 if(unsettled(next)){if(!status)holdBoot(next);return status;}
 if(status)return status;
 status=next||{offline:true,maintenance:true,message:lastError?.retryAfter?lastError.message:'Website access is temporarily unavailable. Please retry shortly.',disabledTabs:[],requireLogin:true,registrationOpen:false,isAdmin:false};
 renderStatus();return status;
}
// One check at a time. A call made while one is running is not dropped --
// the running check goes round once more, so e.g. the admin panel's
// refresh-after-save still sees the settings it just saved.
let checking=null,checkAgain=false;
export function refreshSiteAccess(){
 if(checking){checkAgain=true;return checking;}
 checking=(async()=>{let result;do{checkAgain=false;result=await checkSiteAccess();}while(checkAgain);return result;})().finally(()=>{checking=null;});
 return checking;
}
// A tab left in the background stops polling (and phones freeze it
// outright), so by the time someone comes back the access token has often
// expired. Check the moment the page is visible again rather than up to 30s
// later -- the server refreshes the session in that same request.
let lastWake=0;
function wake(){
 if(document.hidden||Date.now()-lastWake<5000)return;
 lastWake=Date.now();refreshSiteAccess();
}
export function initSiteAccess(){
 if(initPromise)return initPromise;
 initPromise=(async()=>{
  // Google sign-in returns to /api/session. If Supabase's list of allowed
  // return addresses doesn't have it, Supabase sends the browser to the home
  // page with the code instead, so it is passed along from here.
  const back=new URLSearchParams(location.search);
  if(/^[0-9a-f-]{36}$/i.test(back.get('code')||'')){location.replace('/api/session?action=oauth-callback&code='+encodeURIComponent(back.get('code')));return new Promise(()=>{});}
  if(back.get('error')&&back.get('error_description'))history.replaceState({},'','/sign-in?auth='+(back.get('error')==='access_denied'?'google-cancelled':'google-failed'));
  await refreshSiteAccess();setInterval(()=>{if(!document.hidden)refreshSiteAccess();},30000);
  document.addEventListener('visibilitychange',wake);window.addEventListener('focus',wake);window.addEventListener('online',wake);window.addEventListener('pageshow',e=>{if(e.persisted)wake();});
  if(accessGranted(status))return status;return new Promise(resolve=>{const listener=e=>{if(e.detail.accessGranted){window.removeEventListener('vortex:site-policy',listener);resolve(e.detail);}};window.addEventListener('vortex:site-policy',listener);});})();return initPromise;
}
// Downscales only if larger than maxDim (a smaller source photo is left
// alone rather than upscaled/softened) and re-encodes as JPEG. Kept
// tighter than the personal per-device version in app.js since this one
// gets fetched by every visitor's browser, not just the admin's own.
function resizeSiteImage(file,maxDim=1600){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(new Error('Could not read file'));
  reader.onload=()=>{
   const img=new Image();
   img.onerror=()=>reject(new Error('Could not decode image'));
   img.onload=()=>{
    const scale=Math.min(1,maxDim/Math.max(img.naturalWidth,img.naturalHeight));
    const width=Math.max(1,Math.round(img.naturalWidth*scale)),height=Math.max(1,Math.round(img.naturalHeight*scale));
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(img,0,0,width,height);
    resolve(canvas.toDataURL('image/jpeg',0.85));
   };
   img.src=reader.result;
  };
  reader.readAsDataURL(file);
 });
}

// Confirms the saved background link actually resolves to a loadable image
// (a relative path like our own upload endpoint needs the base to resolve)
// instead of only trusting that the settings write itself succeeded.
function probeImageLoads(url){
 return new Promise(resolve=>{
  const img=new Image();
  img.onload=()=>resolve(true);
  img.onerror=()=>resolve(false);
  img.src=new URL(url,window.location.origin).href;
 });
}
function escapeHtml(str){return String(str).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

// Site theme presets are a convenience local to the admin's own browser --
// only whichever one gets picked and saved actually goes out to visitors.
const THEME_PRESETS_KEY='krazy_data_site_theme_presets';
const DEFAULT_THEME=Object.freeze({primary:'#0082fe',secondary:'#d6e1ea',tint:0});
function loadThemePresets(){
 try{const saved=JSON.parse(localStorage.getItem(THEME_PRESETS_KEY)||'[]');return Array.isArray(saved)?saved.filter(p=>p&&p.name).slice(0,12):[];}catch{return [];}
}

export async function loadSiteControls(){
 const policy=await request('/api/v2-admin?action=site-settings');let host=document.getElementById('site-controls');if(!host)return;
 host.hidden=false;
 host.innerHTML='<h3>Website controls</h3>'
  +'<div class="site-tabs" role="tablist">'
   +'<button type="button" class="site-tab" data-panel-tab="general" role="tab" aria-selected="true">General</button>'
   +'<button type="button" class="site-tab" data-panel-tab="access" role="tab" aria-selected="false">Access</button>'
   +'<button type="button" class="site-tab" data-panel-tab="appearance" role="tab" aria-selected="false">Appearance</button>'
   +'<button type="button" class="site-tab" data-panel-tab="members" role="tab" aria-selected="false">Members</button>'
   +'<button type="button" class="site-tab" data-panel-tab="announce" role="tab" aria-selected="false">Announce</button>'
  +'</div>'
  +'<form>'
   +'<div class="site-tab-panel" data-panel="general">'
    +'<div class="site-control-switches"></div>'
    +'<label>Maintenance message<textarea name="message" maxlength="240" required></textarea></label>'
   +'</div>'
   +'<div class="site-tab-panel" data-panel="access" hidden>'
    +'<fieldset><legend>Available tabs</legend></fieldset>'
    +'<fieldset class="site-sport-controls"><legend>Visible sports</legend></fieldset><fieldset class="site-finder-sport-controls"><legend>Finder sports</legend><p class="site-controls-hint">Leagues offered inside the Finder. Separate from the Research sports above. Admins always see every league.</p></fieldset>'
   +'</div>'
   +'<div class="site-tab-panel" data-panel="appearance" hidden>'
    +'<div class="bg-image-control">'
     +'<span class="settings-label">Site background image — everyone sees this</span>'
     +'<button type="button" class="bg-image-upload-btn" id="site-bg-upload">Upload a photo</button>'
     +'<input type="file" id="site-bg-file" accept="image/*" hidden />'
     +'<div class="bg-image-divider"><span>or paste a link</span></div>'
     +'<input type="text" name="bgUrl" placeholder="https://example.com/photo.jpg" autocomplete="off" inputmode="url" />'
     +'<label class="accent-tint-control"><span>Opacity</span><input type="range" name="bgOpacity" min="5" max="100" step="1" value="35" aria-label="Site background opacity" /><output>35%</output></label>'
     +'<p class="theme-picker-note">This is separate from a member’s personal background in their own Settings — their choice always overrides this on their device. Members without a personal background see this one.</p>'
    +'</div>'
    +'<div class="site-theme-control">'
     +'<span class="settings-label">Website color theme — everyone sees this</span>'
     +'<div class="accent-controls">'
      +'<label class="accent-control"><span>Primary</span><div><input type="color" name="themePrimary" value="#0082fe" /><output>#0082FE</output></div></label>'
      +'<label class="accent-control"><span>Secondary</span><div><input type="color" name="themeSecondary" value="#d6e1ea" /><output>#D6E1EA</output></div></label>'
     +'</div>'
     +'<label class="accent-tint-control"><span>Background tint</span><input type="range" name="themeTint" min="0" max="35" step="1" value="0" /><output>0%</output></label>'
     +'<div class="bg-image-actions"><button type="button" id="site-theme-reset">Use default colors</button><button type="button" id="site-theme-apply-preview">Preview here</button></div>'
     +'<div class="accent-save-row"><label>Save current colors as a preset</label><div><input type="text" id="site-theme-preset-name" placeholder="Preset name" maxlength="40" /><button type="button" id="site-theme-preset-save">Save</button></div></div>'
     +'<div class="accent-presets" id="site-theme-presets"></div>'
     +'<p class="theme-picker-note">Publishing this forces it onto every device at least once, even over someone’s own personal colors — from there, anyone (including you) can switch back to their own in Settings, until the next time this is saved.</p>'
    +'</div>'
   +'</div>'
   +'<p role="status"></p>'
   +'<button type="submit">Save website settings</button>'
  +'</form>'
  // Members saves person by person, so it sits outside the settings form.
  +'<div class="site-tab-panel site-members-panel" data-panel="members" hidden></div>'
  +'<div class="site-tab-panel site-announce-panel" data-panel="announce" hidden></div>';
 const tabs=[...host.querySelectorAll('.site-tab')],panels=[...host.querySelectorAll('.site-tab-panel')];
 tabs.forEach(tab=>tab.addEventListener('click',()=>{
  tabs.forEach(t=>t.setAttribute('aria-selected',String(t===tab)));
  panels.forEach(p=>{p.hidden=p.dataset.panel!==tab.dataset.panelTab;});
  const panel=tab.dataset.panelTab;
  // Members and Announce save on their own, outside the settings form.
  host.querySelector('form').hidden=panel==='members'||panel==='announce';
  if(panel==='members')mountMembersPanel(host.querySelector('.site-members-panel'),{request,names});
  if(panel==='announce')mountAnnouncePanel(host.querySelector('.site-announce-panel'),{request});
 }));
 const form=host.querySelector('form');for(const [key,title] of Object.entries({maintenance:'Maintenance mode — members cannot use the website',requireLogin:'Require email account to access research',registrationOpen:'Allow new account registrations'})){const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.name=key;input.checked=policy[key];label.append(input,document.createTextNode(title));host.querySelector('.site-control-switches').append(label);}
 form.elements.message.value=policy.message;
 for(const [key,title] of Object.entries(names).filter(([key])=>!ADMIN_TABS.includes(key))){const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.name='tab';input.value=key;input.checked=!policy.disabledTabs.includes(key);label.append(input,document.createTextNode(title));host.querySelector('fieldset').append(label);}
 const sportLabel=element('label');const sportInput=document.createElement('input');sportInput.type='checkbox';sportInput.name='sport';sportInput.value='nfl';sportInput.checked=!(policy.disabledSports||[]).includes('nfl');sportLabel.append(sportInput,document.createTextNode('NFL — show sport and allow NFL data'));host.querySelector('.site-sport-controls').append(sportLabel);
 // Finder leagues, one switch each. Unchecked = hidden from regular users.
 const finderSportNames={wnba:'WNBA',mlb:'MLB',nfl:'NFL',soccer:'Soccer',nhl:'NHL',nba:'NBA',tennis:'Tennis',cs2:'CS2'};
 for(const sport of FINDER_SPORTS){const label=element('label');const input=document.createElement('input');input.type='checkbox';input.name='finderSport';input.value=sport;input.checked=!(policy.disabledFinderSports||[]).includes(sport);label.append(input,document.createTextNode(`${finderSportNames[sport]} in the Finder`));host.querySelector('.site-finder-sport-controls').append(label);}
 const bg=policy.backgroundImage||{url:'',opacity:35};
 form.elements.bgUrl.value=bg.url||'';form.elements.bgOpacity.value=String(bg.opacity??35);
 const bgOpacityOutput=host.querySelector('.bg-image-control output');bgOpacityOutput.textContent=`${form.elements.bgOpacity.value}%`;
 form.elements.bgOpacity.addEventListener('input',()=>{bgOpacityOutput.textContent=`${form.elements.bgOpacity.value}%`;});
 const statusEl=()=>host.querySelector('[role=status]');
 host.querySelector('#site-bg-upload').addEventListener('click',()=>host.querySelector('#site-bg-file').click());
 host.querySelector('#site-bg-file').addEventListener('change',async e=>{
  const file=e.target.files?.[0];e.target.value='';
  if(!file)return;
  if(!file.type.startsWith('image/')){statusEl().textContent='Please choose an image file.';return;}
  statusEl().textContent='Uploading photo…';
  try{
   const dataUrl=await resizeSiteImage(file);
   const result=await request('/api/v2-admin',{action:'site-background-upload',image:dataUrl});
   form.elements.bgUrl.value=result.url;
   statusEl().textContent='Photo uploaded. Click "Save website settings" to publish it to everyone.';
  }catch(error){statusEl().textContent=error.message;}
 });

 // ---- Website color theme ----
 const theme=policy.theme&&policy.theme.primary?policy.theme:DEFAULT_THEME;
 form.elements.themePrimary.value=theme.primary;form.elements.themeSecondary.value=theme.secondary;form.elements.themeTint.value=String(theme.tint??0);
 const themeOutputs=host.querySelector('.site-theme-control').querySelectorAll('output');
 const syncThemeOutputs=()=>{themeOutputs[0].textContent=form.elements.themePrimary.value.toUpperCase();themeOutputs[1].textContent=form.elements.themeSecondary.value.toUpperCase();themeOutputs[2].textContent=`${form.elements.themeTint.value}%`;};
 syncThemeOutputs();
 form.elements.themePrimary.addEventListener('input',syncThemeOutputs);
 form.elements.themeSecondary.addEventListener('input',syncThemeOutputs);
 form.elements.themeTint.addEventListener('input',syncThemeOutputs);
 host.querySelector('#site-theme-reset').addEventListener('click',()=>{
  form.elements.themePrimary.value=DEFAULT_THEME.primary;form.elements.themeSecondary.value=DEFAULT_THEME.secondary;form.elements.themeTint.value=String(DEFAULT_THEME.tint);
  syncThemeOutputs();
  statusEl().textContent='Colors reset to default here — click "Save website settings" to publish.';
 });
 host.querySelector('#site-theme-apply-preview').addEventListener('click',()=>{
  window.dispatchEvent(new CustomEvent('vortex:site-theme-preview',{detail:{primary:form.elements.themePrimary.value,secondary:form.elements.themeSecondary.value,tint:Number(form.elements.themeTint.value)}}));
  statusEl().textContent='Previewing these colors on this page only — not saved yet.';
 });
 const renderThemePresets=()=>{
  const presets=loadThemePresets();const list=host.querySelector('#site-theme-presets');
  list.innerHTML=presets.length?'':'<p class="accent-presets-empty">No saved presets yet.</p>';
  presets.forEach((preset,index)=>{
   const row=document.createElement('div');row.className='accent-preset';
   row.innerHTML=`<span class="accent-preset-preview" style="--preset-primary:${preset.primary};--preset-secondary:${preset.secondary};--preset-tint:${preset.tint||0}%"><i></i><i></i></span><span class="accent-preset-name">${escapeHtml(preset.name)}</span><button type="button" aria-label="Delete ${escapeHtml(preset.name)} preset"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button><span class="accent-preset-apply" role="button" tabindex="0" aria-label="Apply ${escapeHtml(preset.name)} preset"></span>`;
   const apply=()=>{
    form.elements.themePrimary.value=preset.primary;form.elements.themeSecondary.value=preset.secondary;form.elements.themeTint.value=String(preset.tint||0);
    syncThemeOutputs();
    statusEl().textContent=`${preset.name} loaded — click "Save website settings" to publish it.`;
   };
   const applyButton=row.querySelector('.accent-preset-apply');
   applyButton.addEventListener('click',apply);
   applyButton.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();apply();}});
   row.querySelector('button').addEventListener('click',e=>{
    e.stopPropagation();
    const next=loadThemePresets();next.splice(index,1);
    localStorage.setItem(THEME_PRESETS_KEY,JSON.stringify(next));
    renderThemePresets();
    statusEl().textContent=`${preset.name} deleted.`;
   });
   list.append(row);
  });
 };
 renderThemePresets();
 host.querySelector('#site-theme-preset-name').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();host.querySelector('#site-theme-preset-save').click();}});
 host.querySelector('#site-theme-preset-save').addEventListener('click',()=>{
  const nameInput=host.querySelector('#site-theme-preset-name');const name=nameInput.value.trim();
  if(!name){nameInput.focus();statusEl().textContent='Name the preset before saving it.';return;}
  const presets=loadThemePresets();
  const preset={name,primary:form.elements.themePrimary.value,secondary:form.elements.themeSecondary.value,tint:Number(form.elements.themeTint.value)};
  const existing=presets.findIndex(p=>p.name.toLowerCase()===name.toLowerCase());
  if(existing>=0)presets[existing]=preset;else presets.unshift(preset);
  localStorage.setItem(THEME_PRESETS_KEY,JSON.stringify(presets.slice(0,12)));
  nameInput.value='';
  renderThemePresets();
  statusEl().textContent=`${name} saved as a preset on this device.`;
 });

 form.onsubmit=async e=>{e.preventDefault();const message=statusEl();const button=host.querySelector('[type=submit]');button.disabled=true;const bgUrl=form.elements.bgUrl.value.trim();
  const themePrimary=form.elements.themePrimary.value,themeSecondary=form.elements.themeSecondary.value,themeTint=Number(form.elements.themeTint.value);
  const themeIsDefault=themePrimary.toLowerCase()===DEFAULT_THEME.primary&&themeSecondary.toLowerCase()===DEFAULT_THEME.secondary&&themeTint===DEFAULT_THEME.tint;
  try{await request('/api/v2-admin',{action:'site-settings',settings:{maintenance:form.elements.maintenance.checked,requireLogin:form.elements.requireLogin.checked,registrationOpen:form.elements.registrationOpen.checked,message:form.elements.message.value,disabledSports:[...form.querySelectorAll('[name=sport]')].filter(c=>!c.checked).map(c=>c.value),disabledFinderSports:[...form.querySelectorAll('[name=finderSport]')].filter(c=>!c.checked).map(c=>c.value),disabledTabs:[...form.querySelectorAll('[name=tab]')].filter(c=>!c.checked).map(c=>c.value),backgroundImage:{url:bgUrl,opacity:Number(form.elements.bgOpacity.value)},theme:themeIsDefault?{primary:'',secondary:'',tint:0}:{primary:themePrimary,secondary:themeSecondary,tint:themeTint}}});
  if(bgUrl){
   message.textContent='Saved. Checking that the image loads…';
   const loads=await probeImageLoads(bgUrl);
   message.textContent=loads?'Saved — background image is live for everyone.':'Saved, but that image failed to load. Double-check the link or re-upload the photo.';
  }else{
   message.textContent='Saved. Changes apply to member requests immediately.';
  }
  await refreshSiteAccess();
 }catch(error){message.textContent=error.message;}finally{button.disabled=false;}};
}
