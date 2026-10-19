import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Bell,Camera,Check,ChevronLeft,ChevronRight,Compass,Download,History,LogOut,Plus,Settings,Share2,Ticket,X} from 'lucide-react';
import {accountProfile,accountSynced,saveAccountProfile} from './account-sync.js';
import {pickBuilder,usePickBuilder} from './pick-builder-client';
import {loadHistory} from './slip-history.js';
import {canInstall,shareInvite} from './install-guide.js';
import './account-sheet.css';

// The account sheet (site-access.js accountDialog): who you are, your
// numbers, your plan, shortcuts to the app's own tools, its colors, and
// signing out. It slides in from the right on a computer and up from the
// bottom on a phone (account-sheet.css). Most rows press the controls that
// already do the work (the settings panel's alerts switch and Get the app
// row, the accent studio's color input), so there's one way each thing
// happens.

// The accent colors offered here; any other is a tap on Custom away.
const SWATCHES=[['#FFFFFF','White'],['#00F58A','Green'],['#2DD4BF','Teal'],['#8B5CF6','Violet'],['#F472B6','Pink'],['#FB923C','Orange'],['#FACC15','Gold'],['#F43F5E','Red']];
const CLOSE_MS=260;

const hiddenTabs=()=>new Set((document.documentElement.dataset.hiddenTabs||'').split(/\s+/).filter(Boolean));
const monthYear=iso=>{const time=Date.parse(iso||'');return Number.isFinite(time)?new Date(time).toLocaleDateString([],{month:'short',year:'numeric'}):'';};

// The member's plan: Pro while paid access is on, else full access.
function plan(status){
 if(status?.comped)return {name:'PropScout Pro',line:'Free access, courtesy of PropScout'};
 const sub=status?.paidAccess?status.subscription:null;
 if(sub){
  const date=Date.parse(sub.renewsAt||'');const when=Number.isFinite(date)?new Date(date).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'}):'';
  const line=sub.cancelAtPeriodEnd||sub.status==='canceling'?(when?`Cancelled · access until ${when}`:'Cancelled · access until the period ends')
   :sub.status==='past_due'?'Payment failed · update your card to keep access'
   :sub.status==='trialing'?(when?`Free trial · ends ${when}`:'Free trial')
   :when?`Active · renews ${when}`:'Active';
  return {name:'PropScout Pro',line,manage:sub.manageUrl||''};
 }
 return {name:status?.isAdmin?'Administrator':'PropScout',line:'Full access to every tool'};
}

// The settings panel's alerts switch, mirrored: whether alerts can be
// turned on here, whether they're on, and any note (push-alerts.js).
function useAlerts(){
 const read=()=>{
  const row=document.getElementById('alerts-setting'),toggle=document.getElementById('alerts-switch'),note=document.getElementById('alerts-note');
  return {shown:Boolean(row&&toggle&&!row.hidden),on:toggle?.getAttribute('aria-checked')==='true',disabled:Boolean(toggle?.disabled),note:note&&!note.hidden?note.textContent:''};
 };
 const [alerts,setAlerts]=useState(read);
 useEffect(()=>{
  const observer=new MutationObserver(()=>setAlerts(read()));
  for(const id of ['alerts-setting','alerts-switch','alerts-note']){const node=document.getElementById(id);if(node)observer.observe(node,{attributes:true,childList:true,characterData:true,subtree:true});}
  return()=>observer.disconnect();
 },[]);
 return [alerts,()=>document.getElementById('alerts-switch')?.click()];
}

function Avatar({name,photo,size}){
 const [broken,setBroken]=useState('');
 return <span className="as-avatar" style={{'--size':size+'px'}} aria-hidden="true">{(name||'A').trim().slice(0,1).toUpperCase()}{photo&&broken!==photo&&<img src={photo} alt="" onError={()=>setBroken(photo)}/>}</span>;
}

function Row({icon:Icon,title,detail,onClick,children,...props}){
 return <button type="button" className="as-row" onClick={onClick} {...props}>
  <span className="as-row-icon"><Icon size={17} strokeWidth={1.9} aria-hidden="true"/></span>
  <span className="as-row-text"><b>{title}</b>{detail&&<small>{detail}</small>}</span>
  {children??<ChevronRight className="as-row-go" size={17} aria-hidden="true"/>}
 </button>;
}

// Name and photo (account_profile.py), the same on every device.
function EditProfile({account,onBack}){
 const current=accountProfile();
 const [name,setName]=useState(current?.name||'');
 const [photo,setPhoto]=useState(undefined);
 const [preview,setPreview]=useState('');
 const [message,setMessage]=useState('');
 const [saving,setSaving]=useState(false);
 const file=useRef(null);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
 const shown=photo===null?'':preview||current?.avatarUrl||'';
 const choose=event=>{
  const chosen=event.target.files?.[0];event.target.value='';if(!chosen)return;
  if(!chosen.type.startsWith('image/')){setMessage('Choose an image file.');return;}
  setPhoto(chosen);setPreview(URL.createObjectURL(chosen));setMessage('Looks good. Save to use this photo.');
 };
 const save=async event=>{
  event.preventDefault();setSaving(true);setMessage('Saving…');
  try{await saveAccountProfile({name,...(photo!==undefined?{photo}:{})});setPhoto(undefined);setMessage('Saved. Your name and photo show on every device.');}
  catch(error){setMessage(error.message);}
  finally{setSaving(false);}
 };
 return <form className="as-edit" onSubmit={save}>
  <button type="button" className="as-back" onClick={onBack}><ChevronLeft size={18} aria-hidden="true"/>Account</button>
  <div className="as-edit-photo">
   <button type="button" className="as-photo-button" onClick={()=>file.current?.click()} aria-label="Change profile photo">
    <Avatar name={name||current?.name||account?.email} photo={shown} size={88}/>
    <span className="as-photo-badge"><Camera size={14} aria-hidden="true"/></span>
   </button>
   <input ref={file} type="file" accept="image/*" hidden onChange={choose}/>
   {shown&&<button type="button" className="as-text-button" onClick={()=>{setPhoto(null);setMessage('Save to remove your photo.');}}>Remove photo</button>}
  </div>
  <label className="as-field"><span>Display name</span>
   <input value={name} maxLength={32} autoComplete="nickname" placeholder={current?'How you appear in Community':'Loading your profile…'} disabled={!current} onChange={event=>setName(event.target.value)}/>
  </label>
  {account?.email&&<p className="as-signed-in">Signed in as <b>{account.email}</b></p>}
  {message&&<p className="as-message" role="status">{message}</p>}
  <button type="submit" className="as-save" disabled={!current||saving}>Save profile</button>
 </form>;
}

function AccountSheet({status,badge,signOut,onDone,handle}){
 const dialog=useRef(null);
 const [open,setOpen]=useState(false);
 const [view,setView]=useState('main');
 const [profile,setProfile]=useState(accountProfile);
 const [since,setSince]=useState(()=>accountSynced()?.memberSince||'');
 const [history,setHistory]=useState(null);
 const [accent,setAccent]=useState(()=>(document.getElementById('primary-accent')?.value||'').toUpperCase());
 const [leaving,setLeaving]=useState(false);
 const [alerts,toggleAlerts]=useAlerts();
 const picks=usePickBuilder().legs.length;
 const account=status?.account||null;
 const hidden=hiddenTabs();
 const membership=plan(status);
 const name=profile?.name||account?.displayName||(account?'Your account':'Administrator');

 // Close with the sheet sliding away, then whatever comes next.
 const close=(then)=>{
  setOpen(false);
  setTimeout(()=>{dialog.current?.close();onDone();then?.();},CLOSE_MS);
 };
 handle.close=()=>close();

 useEffect(()=>{
  // Focus lands on the sheet itself, not its first button.
  const node=dialog.current;node.showModal();node.querySelector('.as-panel')?.focus();
  const frame=requestAnimationFrame(()=>setOpen(true));
  const cancel=event=>{event.preventDefault();close();};
  node.addEventListener('cancel',cancel);
  const onProfile=()=>setProfile(accountProfile());
  const onSynced=event=>setSince(event.detail?.memberSince||'');
  window.addEventListener('vortex:account-profile',onProfile);
  window.addEventListener('vortex:account-synced',onSynced);
  const controller=new AbortController();
  if(account)loadHistory({signal:controller.signal}).then(data=>setHistory(data.slips||[])).catch(()=>setHistory(false));
  else setHistory([]);
  return()=>{cancelAnimationFrame(frame);node.removeEventListener('cancel',cancel);window.removeEventListener('vortex:account-profile',onProfile);window.removeEventListener('vortex:account-synced',onSynced);controller.abort();};
 },[]);

 const graded=history?history.length:null,won=history?history.filter(slip=>slip.status==='won').length:null;
 const live=history?history.filter(slip=>slip.status==='pending').length:0;
 const count=value=>value==null?'—':value.toLocaleString();
 const go=tab=>window.dispatchEvent(new CustomEvent('vortex:switch-tab',{detail:{tab}}));
 const pickColor=hex=>{
  const input=document.getElementById('primary-accent');if(!input)return;
  input.value=hex.toLowerCase();input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
  setAccent(hex);
 };
 const openSettings=()=>close(()=>document.getElementById('settings-btn')?.click());

 return <dialog ref={dialog} className={'account-sheet'+(open?' is-open':'')} aria-label="Your account"
  onClick={event=>{if(event.target===dialog.current)close();}}>
  <div className="as-panel" tabIndex={-1}>
   <span className="as-grab" aria-hidden="true"/>
   <header className="as-head"><h2>{view==='edit'?'Edit profile':'Account'}</h2>
    <button type="button" className="as-close" aria-label="Close account" onClick={()=>close()}><X size={18} aria-hidden="true"/></button></header>
   <div className="as-body">
    {view==='edit'?<EditProfile account={account} onBack={()=>setView('main')}/>:<>
     <section className="as-who">
      <Avatar name={name} photo={profile?.avatarUrl} size={64}/>
      <div className="as-who-text">
       <h3>{name}{badge&&<span className="member-badge" data-badge={badge.key}>{badge.label}</span>}</h3>
       <p>{since?`Member since ${monthYear(since)}`:account?'PropScout member':'Signed in as the site admin'}</p>
      </div>
      {account&&<button type="button" className="as-edit-button" onClick={()=>setView('edit')}>Edit</button>}
     </section>

     <section className="as-stats" aria-label="Your numbers">
      <div><b>{count(picks)}</b><span>Saved picks</span></div>
      <div><b>{count(graded)}</b><span>Slips graded</span></div>
      <div data-good={won>0||undefined}><b>{count(won)}</b><span>Slips won</span></div>
     </section>

     <section className="as-plan">
      <img src="/brand/propscout-mark.svg" alt="" width="36" height="36"/>
      <div><b>{membership.name}</b><span>{membership.line}</span></div>
      {membership.manage&&<a href={membership.manage} target="_blank" rel="noopener">Manage</a>}
     </section>

     <h4 className="as-label">Your picks</h4>
     <div className="as-group">
      {!hidden.has('saved')&&<Row icon={Ticket} title="My picks" detail={picks?`${picks} saved · open the Pick Builder`:'Tap a star in the Finder to save one'}
       onClick={()=>close(()=>pickBuilder.open())}/>}
      {!hidden.has('slip')&&<Row icon={History} title="Slip history" detail={graded?`${graded} graded${live?` · ${live} still live`:''}`:'Grade a slip to start your history'}
       onClick={()=>close(()=>{go('slip');setTimeout(()=>document.querySelector('.sh-history')?.scrollIntoView({behavior:'smooth',block:'start'}),450);})}/>}
      {alerts.shown&&<Row icon={Bell} title="Alerts" detail={alerts.note||'Line moves and news on your saved picks'} onClick={toggleAlerts}
       role="switch" aria-checked={alerts.on} disabled={alerts.disabled}><span className="as-switch" aria-hidden="true"/></Row>}
     </div>

     <h4 className="as-label">Color</h4>
     <div className="as-colors" role="radiogroup" aria-label="Site color">
      {SWATCHES.map(([hex,label])=>{const on=accent===hex;return <button type="button" key={hex} role="radio" aria-checked={on} aria-label={label}
       style={{'--swatch':hex}} onClick={()=>pickColor(hex)}>{on&&<Check size={15} strokeWidth={3} aria-hidden="true"/>}</button>;})}
      <button type="button" className="as-custom" aria-label="Custom color" title="Custom color" data-on={!SWATCHES.some(([hex])=>hex===accent)||undefined} onClick={openSettings}><Plus size={16} aria-hidden="true"/></button>
     </div>

     <h4 className="as-label">App</h4>
     <div className="as-group">
      {canInstall()&&<Row icon={Download} title="Get the app" detail="Add PropScout to your Home Screen" onClick={()=>close(()=>document.getElementById('get-app-row')?.click())}/>}
      <Row icon={Share2} title="Invite friends" detail="Send friends the link" onClick={event=>shareInvite(event.currentTarget)}/>
      <Row icon={Compass} title="Take the tour" detail="A one-minute look around" onClick={()=>close(()=>window.dispatchEvent(new Event('aceprops:start-tour')))}/>
      <Row icon={Settings} title="All settings" detail="Colors, background and more" onClick={openSettings}/>
     </div>

     <button type="button" className="as-signout" disabled={leaving} onClick={async()=>{setLeaving(true);try{await signOut();}catch{setLeaving(false);}}}>
      <LogOut size={17} aria-hidden="true"/>{leaving?'Signing out…':'Sign out'}</button>
     {account&&<p className="as-note">Your slip, colors, presets and background follow this account to every device you sign in on.</p>}
    </>}
   </div>
  </div>
 </dialog>;
}

/** Open the sheet; the returned handle closes it (signed out elsewhere). */
export function openAccountSheet({status,badge,signOut,onClosed}){
 const host=document.createElement('div');document.body.append(host);
 const root=createRoot(host);
 const handle={close:()=>{}};
 const done=()=>{setTimeout(()=>{root.unmount();host.remove();},0);onClosed?.();};
 root.render(<AccountSheet status={status} badge={badge} signOut={signOut} onDone={done} handle={handle}/>);
 return handle;
}
