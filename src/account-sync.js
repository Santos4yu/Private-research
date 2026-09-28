// Carries a member's profile and settings between devices. The app keeps
// working exactly as before, reading and writing localStorage; this watches
// the keys below and mirrors them to the account (account_profile.py).
//
// - Signing in pulls the account's copy. Whichever side changed a setting
//   more recently wins, one setting at a time.
// - A change on this device is pushed a moment later.
// - Coming back to the tab pulls again, so the phone sees what the laptop did.
// - A device that last synced a different account never uploads that
//   account's data: it is cleared and replaced with this account's.

export const SYNCED={
 slip:'vortex_saved_prop_ids',
 accent:'vortex_custom_accents',
 accentPresets:'vortex_accent_presets',
 background:'vortex_bg_image',
 recentResearch:'krazy-data-recent-research-v1',
 recentNfl:'krazy-data:recent-players:nfl:v1',
};
const NAMES=Object.fromEntries(Object.entries(SYNCED).map(([name,key])=>[key,name]));
const META_KEY='krazy_data:account-sync:v1';
const PUSH_DELAY=1200,PULL_EVERY=15000;

let uid=null,ready=false,profile=null,pushTimer=0,pulling=null,lastPull=0,applying=false;
const dirty=new Set();

function storage(){try{return window.localStorage;}catch{return null;}}
function readMeta(){try{const meta=JSON.parse(storage()?.getItem(META_KEY)||'null');return meta&&typeof meta==='object'?{owner:meta.owner||null,at:meta.at||{},bg:meta.bg||null}:{owner:null,at:{},bg:null};}catch{return {owner:null,at:{},bg:null};}}
let meta=readMeta();
function writeMeta(){try{rawSet.call(storage(),META_KEY,JSON.stringify(meta));}catch{}}

// Every writer in the app goes through these, so this is the one place that
// sees a synced setting change.
const proto=typeof Storage==='undefined'?null:Storage.prototype;
const rawSet=proto?.setItem,rawRemove=proto?.removeItem;
if(proto&&!proto.__accountSync){
 proto.__accountSync=true;
 proto.setItem=function(key,value){rawSet.call(this,key,value);noteChange(this,key);};
 proto.removeItem=function(key){rawRemove.call(this,key);noteChange(this,key);};
}
function noteChange(target,key){
 if(applying||!NAMES[key]||target!==storage())return;
 // Changes made before the first pull are the app loading, not the member.
 if(!uid||!ready)return;
 meta.at[NAMES[key]]=Date.now();writeMeta();
 dirty.add(NAMES[key]);schedulePush();
}

async function request(url,body){
 const payload=body?JSON.stringify(body):null;
 // keepalive lets a change made just before the page closes still arrive;
 // browsers only allow it for small bodies.
 const response=await fetch(url,{cache:'no-store',credentials:'same-origin',...(payload?{method:'POST',headers:{'Content-Type':'application/json'},body:payload,keepalive:payload.length<60000}:{})});
 let data;try{data=await response.json();}catch{data={};}
 if(!response.ok){const error=new Error(data.error||'Account service temporarily unavailable');error.status=response.status;throw error;}
 return data;
}

function readLocal(name){
 const raw=storage()?.getItem(SYNCED[name]);if(raw==null)return null;
 try{return JSON.parse(raw);}catch{return undefined;}
}
function writeLocal(name,value){
 const store=storage();if(!store)return;
 applying=true;
 try{value==null?rawRemove.call(store,SYNCED[name]):rawSet.call(store,SYNCED[name],JSON.stringify(value));}catch{}
 finally{applying=false;}
}

function emitProfile(){window.dispatchEvent(new CustomEvent('vortex:account-profile',{detail:profile}));}
export function accountProfile(){return profile;}

// Pull the account's copy and settle each setting with this device's.
async function pull(){
 if(!uid)return;
 if(pulling)return pulling;
 const forUid=uid;
 pulling=(async()=>{
  const data=await request('/api/session?action=account');
  if(forUid!==uid)return;
  lastPull=Date.now();
  profile=data.profile||{name:'',avatarUrl:null};emitProfile();
  if(meta.owner!==forUid){
   // Another account's settings are on this device: never upload them.
   if(meta.owner)for(const name of Object.keys(SYNCED))writeLocal(name,null);
   meta={owner:forUid,at:meta.owner?{}:meta.at,bg:null};writeMeta();
  }
  const remote=data.prefs||{},applied=[],push={};
  for(const name of Object.keys(SYNCED)){
   const theirs=remote[name],localAt=meta.at[name]||0,local=readLocal(name);
   if(theirs&&theirs.at>localAt){writeLocal(name,theirs.value);meta.at[name]=theirs.at;applied.push(SYNCED[name]);}
   else if(local!==undefined&&(theirs?localAt>theirs.at:local!=null)){meta.at[name]=localAt||Date.now();push[name]=true;}
  }
  writeMeta();
  if(applied.length)window.dispatchEvent(new CustomEvent('vortex:account-prefs-applied',{detail:{keys:applied}}));
  for(const name of Object.keys(push))dirty.add(name);
  ready=true;
  if(dirty.size)schedulePush(0);
 })().finally(()=>{pulling=null;});
 return pulling;
}

function schedulePush(delay=PUSH_DELAY){clearTimeout(pushTimer);pushTimer=setTimeout(()=>push().catch(()=>{}),delay);}

// Photos can't ride along in settings; they go up as the account's
// background image and the setting keeps its link.
async function backgroundForAccount(value){
 if(!value?.url?.startsWith('data:'))return value;
 const sig=`${value.url.length}:${value.url.slice(-48)}`;
 if(meta.bg?.sig===sig)return {...value,url:meta.bg.url};
 const image=await shrink(value.url,1920,.82,1400*1024);
 const {url}=await request('/api/session',{action:'account-image-save',slot:'background',image});
 meta.bg={sig,url};writeMeta();
 return {...value,url};
}

async function push(){
 if(!uid||!ready||!dirty.size)return;
 const names=[...dirty];dirty.clear();
 const changes={};
 try{
  for(const name of names){
   let value=readLocal(name);if(value===undefined)continue;
   if(name==='background')value=await backgroundForAccount(value);
   changes[name]={value,at:meta.at[name]||Date.now()};
  }
  if(Object.keys(changes).length)await request('/api/session',{action:'prefs-save',changes});
 }catch(error){
  // A rejected setting (too large, invalid) would fail the same way again;
  // anything else is kept for the next try rather than losing the change.
  if(error.status===400)throw error;
  names.forEach(name=>dirty.add(name));
  schedulePush(15000);
  throw error;
 }
}

// Profile photo: a centered square, small enough to load instantly.
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Could not read that photo'));img.src=src;});}
function readFile(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read that photo'));reader.readAsDataURL(file);});}
async function shrink(src,maxDim,quality,maxBytes,square=false){
 const img=await loadImage(src);
 let width=img.naturalWidth,height=img.naturalHeight,sx=0,sy=0,sw=width,sh=height;
 if(square){const side=Math.min(width,height);sx=(width-side)/2;sy=(height-side)/2;sw=sh=side;width=height=side;}
 const scale=Math.min(1,maxDim/Math.max(width,height));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
 const ctx=canvas.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(img,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
 let out=canvas.toDataURL('image/jpeg',quality);
 for(let q=quality-.12;out.length*.75>maxBytes&&q>.3;q-=.12)out=canvas.toDataURL('image/jpeg',q);
 return out;
}

export async function saveAccountProfile({name,photo}={}){
 if(!uid)throw new Error('Sign in to edit your profile');
 const body={action:'profile-save'};
 if(name!==undefined)body.name=name;
 if(photo===null)body.avatar=null;
 else if(photo)body.avatar=await shrink(await readFile(photo),320,.86,240*1024,true);
 const data=await request('/api/session',body);
 profile=data.profile;emitProfile();
 return profile;
}

function start(nextUid){
 if(nextUid===uid)return;
 uid=nextUid;ready=false;profile=null;dirty.clear();clearTimeout(pushTimer);emitProfile();
 if(uid)pull().catch(()=>{ready=true;});
}
window.addEventListener('vortex:site-policy',event=>{
 const detail=event.detail||{};
 start(detail.accessGranted!==false&&detail.account?.id?detail.account.id:null);
});
function wake(){if(uid&&!document.hidden&&Date.now()-lastPull>PULL_EVERY)pull().catch(()=>{});}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&dirty.size)push().catch(()=>{});else wake();});
window.addEventListener('focus',wake);
window.addEventListener('pagehide',()=>{if(dirty.size)push().catch(()=>{});});
