// The pricing page members see while the site requires a paid subscription
// (whop_billing.py). Plans and prices come from Whop; the right-hand side is
// Whop's own embedded checkout, so card numbers, Apple Pay and Cash App are
// entered on Whop and never pass through this site.
import './billing.css';
import {LEAGUE_LOGOS} from './league-logos.js';

const WHOP_LOADER='https://js.whop.com/static/checkout/loader.js';
const COMPLETE_CALLBACK='acePropsCheckoutComplete';
// Only the leagues that are live for members. Add one here once it is.
const LEAGUES=['nba','wnba','mlb','nfl','nhl','soccer'];
const PERKS=['Prop Finder for NBA, WNBA, MLB, NFL, NHL and soccer','Research, game logs and matchups','Cheat Sheets, Line Moves and NRFI / YRFI','Slip Analyzer and Parlay Builder','Scout Assistant'];
const PERIOD_SHORT={month:'mo','3 months':'3 mo','6 months':'6 mo',year:'yr',week:'wk'};

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
function money(value,currency){
 try{return new Intl.NumberFormat(undefined,{style:'currency',currency,minimumFractionDigits:value%1?2:0,maximumFractionDigits:2}).format(value);}
 catch{return `$${value}`;}
}
function loadWhop(){
 if(document.querySelector(`script[src="${WHOP_LOADER}"]`))return;
 document.head.append(h('script',{src:WHOP_LOADER,async:true,defer:true}));
}
function logoRow(className,keys,src,count,label){
 return h('div',{className:`ace-pricing-logos ${className}`},
  h('div',{className:'ace-pricing-logos-count'},h('strong',{text:count}),h('span',{text:label})),
  h('div',{className:'ace-pricing-logos-strip'},keys.map(key=>h('img',{src:src(key),alt:'',onError:e=>e.currentTarget.remove()}))));
}

// host: the element to draw into. options:
//  request(url, body)  -- site-access.js's fetch helper
//  email               -- the member's email, shown and prefilled at Whop
//  preview             -- the admin looking at the page. No checkout starts
//                         unless `live` is set too (the admin is also signed
//                         in with a member account), for a real test purchase.
//  onSignOut, onRefresh(), onClose (preview only)
export function renderPricing(host,{request,email='',preview=false,live=false,onSignOut,onRefresh,onClose}){
 let plans=[],selected=null,sessions={},mountToken=0,finishing=false;
 const card=h('section',{className:'ace-pricing','aria-labelledby':'ace-pricing-title'});
 const price=h('div',{className:'ace-pricing-price'});
 const subtitle=h('p',{className:'ace-pricing-sub',text:'Instant access · Cancel anytime'});
 const choices=h('div',{className:'ace-pricing-plans',role:'radiogroup','aria-label':'Choose a plan'});
 const checkout=h('div',{className:'ace-pricing-checkout'});
 const message=h('p',{className:'ace-pricing-message',role:'status'});
 const left=h('div',{className:'ace-pricing-summary'},
  h('div',{className:'ace-pricing-brand'},h('img',{src:'/brand/propscout-mark.svg',alt:'',width:'32',height:'32'}),h('h1',{id:'ace-pricing-title',text:'PropScout Pro'})),
  price,subtitle,choices,
  logoRow('ace-pricing-leagues',LEAGUES,key=>LEAGUE_LOGOS[key],String(LEAGUES.length),'sports'),
  h('ul',{className:'ace-pricing-perks'},PERKS.map(perk=>h('li',{text:perk}))));
 const right=h('div',{className:'ace-pricing-pay'},checkout,
  h('p',{className:'ace-pricing-secure'},h('span',{'aria-hidden':'true',text:'🔒'}),' Payments are processed securely by Whop. PropScout never sees your card.'));
 const footer=h('footer',{className:'ace-pricing-footer'},
  email&&h('span',{className:'ace-pricing-who',text:`Signed in as ${email}`}),
  !preview&&h('button',{type:'button',className:'ace-pricing-link',onClick:()=>refresh(true)},'Already subscribed? Refresh access'),
  !preview&&onSignOut&&h('button',{type:'button',className:'ace-pricing-link',onClick:onSignOut},'Sign out'),
  preview&&onClose&&h('button',{type:'button',className:'ace-pricing-link',onClick:onClose},'Close preview'));
 if(preview)card.append(h('p',{className:'ace-pricing-preview',text:live?`Preview — the checkout here is real and charges ${email}. Use it for a test purchase.`:'Preview — this is what members see while paid access is on. Sign in with a member account too for a real test checkout.'}));
 if(preview&&onClose)card.append(h('button',{type:'button',className:'ace-pricing-close','aria-label':'Close preview',onClick:onClose},'×'));
 card.append(h('div',{className:'ace-pricing-body'},left,right),message,footer);
 host.replaceChildren(card);

 function paintPlans(){
  const plan=plans.find(p=>p.id===selected);
  price.replaceChildren(...(plan?[h('strong',{text:money(plan.price,plan.currency)}),h('span',{text:plan.period==='one time'?'one time':`/${plan.period}`})]:[]));
  subtitle.textContent=plan?.trialDays?`${plan.trialDays}-day free trial · Cancel anytime`:'Instant access · Cancel anytime';
  // With a single plan there is nothing to choose, so the big price says it all.
 choices.hidden=plans.length<2;
 choices.replaceChildren(...plans.map(p=>{
   const per=p.monthly&&p.period!=='month'?`${money(p.monthly,p.currency)}/mo · `:'';
   const billed=p.period==='month'?'Billed monthly':p.period==='one time'?'Paid once':`Billed every ${p.period}`;
   return h('button',{type:'button',role:'radio','aria-checked':String(p.id===selected),className:'ace-pricing-plan',onClick:()=>choose(p.id)},
    h('span',{className:'ace-pricing-radio','aria-hidden':'true'}),
    h('span',{className:'ace-pricing-plan-name'},h('strong',{},p.label,p.savePercent?h('em',{text:`Save ${p.savePercent}%`}):null),h('small',{text:per+billed})),
    h('span',{className:'ace-pricing-plan-price'},h('strong',{text:money(p.price,p.currency)}),h('small',{text:p.period==='one time'?'once':`/${PERIOD_SHORT[p.period]||p.period}`})));
  }));
 }
 function placeholder(title,text){checkout.replaceChildren(h('div',{className:'ace-pricing-placeholder'},h('strong',{text:title}),h('p',{text})));}
 async function mountCheckout(){
  const token=++mountToken;
  if(preview&&!live){placeholder('Whop checkout','Members pay here — card, Apple Pay, Cash App and whatever else you turn on in Whop.');return;}
  checkout.replaceChildren(h('div',{className:'ace-pricing-loading','aria-label':'Loading checkout'}));
  try{
   sessions[selected]??=(await request('/api/session',{action:'checkout-start',plan:selected})).session;
   if(token!==mountToken)return;
   loadWhop();
   // Whop's script notices this element and fills it with the checkout.
   checkout.replaceChildren(h('div',{className:'ace-pricing-whop',id:'ace-whop-checkout',
    'data-whop-checkout-plan-id':selected,'data-whop-checkout-session':sessions[selected],
    'data-whop-checkout-theme':'dark','data-whop-checkout-theme-accent-color':'green',
    'data-whop-checkout-prefill-email':email||null,'data-whop-checkout-on-complete':COMPLETE_CALLBACK}));
  }catch(error){if(token===mountToken)placeholder('Checkout unavailable',error.message||'Please try again in a moment.');}
 }
 function choose(id){if(id===selected||finishing)return;selected=id;paintPlans();mountCheckout();}

 // After paying: Whop's webhook usually lands within seconds. The payment is
 // also looked up directly, so access doesn't hinge on the webhook timing.
 window[COMPLETE_CALLBACK]=async(_planId,receiptId)=>{
  finishing=true;
  checkout.replaceChildren(h('div',{className:'ace-pricing-placeholder ace-pricing-done'},h('div',{className:'ace-pricing-loading','aria-hidden':'true'}),h('strong',{text:'Payment received'}),h('p',{text:'Unlocking PropScout…'})));
  if(typeof receiptId==='string'&&receiptId)try{await request('/api/session',{action:'billing-confirm',payment:receiptId});}catch{}
  for(let attempt=0;attempt<20;attempt++){
   if(await onRefresh?.()){placeholder('You’re in','PropScout Pro is active on this account.');return;}
   await new Promise(resolve=>setTimeout(resolve,3000));
  }
  checkout.querySelector('p').textContent='Your payment went through. Access can take a minute to arrive — press “Refresh access” below.';
  checkout.querySelector('.ace-pricing-loading')?.remove();
 };
 async function refresh(manual){
  message.textContent=manual?'Checking your subscription…':'';
  try{await request('/api/session',{action:'billing-refresh'});}catch{}
  const unlocked=await onRefresh?.();
  if(manual&&!unlocked)message.textContent='No active subscription on this account yet. If you just paid, give it a minute and try again — or use the email you checked out with on Whop.';
 }

 (async()=>{
  placeholder('Loading plans','');
  try{
   const data=await request('/api/session?action=pricing');
   plans=data.plans||[];
   if(!data.configured||!plans.length){paintPlans();if(!finishing)placeholder('Subscriptions are opening soon','Plans aren’t set up yet. Check back shortly.');return;}
   selected=plans.find(p=>p.period==='month')?.id||plans[0].id;
   paintPlans();if(!finishing)mountCheckout();
  }catch(error){if(!finishing)placeholder('Plans unavailable',error.message||'Please try again in a moment.');}
 })();
 // Coming back from an off-site payment step (Cash App and the like).
 const back=new URLSearchParams(location.search);
 if(!preview&&back.get('checkout')==='done'){
  history.replaceState({},'',location.pathname);
  const receipt=[...back.values()].find(value=>/^(pay|r|rcpt)_[A-Za-z0-9]+$/.test(value));
  if(back.get('status')!=='error'&&back.get('status')!=='failed')window[COMPLETE_CALLBACK](null,receipt);
 }
 return card;
}
