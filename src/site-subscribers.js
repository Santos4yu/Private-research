// The admin panel's Subscribers tab: everyone with a Whop membership
// (whop_billing.py subscribers), how they pay, and when it renews or ends.
// "Sync with Whop" also records each one on the site, which mends a webhook
// that never arrived (a firewall, an outage).

const STATUS = {
 active: ['Paying', 'on'], trialing: ['Free trial', 'trial'], canceling: ['Cancelled · paid up', 'warn'],
 past_due: ['Payment failed', 'danger'], expired: ['Ended', 'ended'], canceled: ['Ended', 'ended'], completed: ['Ended', 'ended'],
};

function h(tag, props = {}, ...children) {
 const node = document.createElement(tag);
 for (const [key, value] of Object.entries(props)) {
  if (value == null || value === false) continue;
  if (key === 'className') node.className = value; else if (key === 'text') node.textContent = value;
  else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value); else node.setAttribute(key, value === true ? '' : value);
 }
 node.append(...children.flat().filter(child => child != null && child !== false));
 return node;
}
const day = iso => { const time = Date.parse(iso || ''); return Number.isFinite(time) ? new Date(time).toLocaleDateString([], {month: 'short', day: 'numeric', year: 'numeric'}) : ''; };
const money = value => `$${Number(value || 0).toFixed(2)}`;

function when(row) {
 const date = day(row.renewsAt);
 if (!date) return '';
 if (row.status === 'trialing') return `Trial ends ${date}`;
 if (row.status === 'canceling' || row.cancelAtPeriodEnd) return `Access until ${date}`;
 if (row.active) return `Renews ${date}`;
 return `Ended ${day(row.canceledAt) || date}`;
}

export function mountSubscribersPanel(host, {request}) {
 if (host.dataset.mounted) return; host.dataset.mounted = '1';
 const totals = h('div', {className: 'site-subs-totals'});
 const list = h('div', {className: 'site-subs-list'});
 const status = h('p', {className: 'site-members-status', role: 'status'});
 const filters = h('div', {className: 'site-subs-filters', role: 'group', 'aria-label': 'Show'});
 let data = null, filter = 'live';
 const refresh = h('button', {type: 'button', className: 'site-subs-sync', onClick: () => load(true)}, 'Sync with Whop');
 host.append(
  h('p', {className: 'site-controls-hint', text: 'Everyone with a PropScout membership on Whop. Sync with Whop also updates each member’s access on the site, in case a Whop message was missed.'}),
  totals, h('div', {className: 'site-subs-bar'}, filters, refresh), list, status);
 [['live', 'Current'], ['all', 'Everyone']].forEach(([key, text]) => filters.append(h('button', {type: 'button', 'data-key': key, onClick: () => { filter = key; render(); }}, text)));

 async function load(sync = false) {
  status.textContent = sync ? 'Syncing with Whop…' : 'Loading subscribers…'; refresh.disabled = true;
  try {
   data = await request(`/api/v2-admin?action=subscribers${sync ? '&sync=1' : ''}`);
   status.textContent = sync && data.synced != null ? `Synced ${data.synced} membership${data.synced === 1 ? '' : 's'} with the site.` : '';
   render();
  } catch (error) { status.textContent = error.message; }
  finally { refresh.disabled = false; }
 }

 function render() {
  if (!data) return;
  filters.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.key === filter)));
  if (!data.configured) { totals.replaceChildren(); list.replaceChildren(h('p', {className: 'site-members-empty', text: 'Whop isn’t set up on this deployment yet.'})); return; }
  const counts = data.counts || {};
  totals.replaceChildren(
   ...[['Paying', counts.active || 0], ['Free trial', counts.trialing || 0], ['Cancelled · paid up', counts.canceling || 0], ['Payment failed', counts.past_due || 0]]
    .map(([label, value]) => h('div', {className: 'site-subs-total'}, h('b', {text: String(value)}), h('small', {text: label}))),
   h('div', {className: 'site-subs-total', 'data-tone': 'money'}, h('b', {text: money(data.monthly)}), h('small', {text: 'a month, at full price'})));
  const rows = (data.members || []).filter(row => filter === 'all' || row.active);
  list.replaceChildren(...rows.map(row => {
   const [label, tone] = STATUS[row.status] || [row.status || 'Unknown', 'ended'];
   return h('article', {className: 'site-subs-row'},
    h('div', {className: 'site-subs-who'}, h('strong', {text: row.email || 'No email on the membership'}),
     h('small', {text: [row.plan ? `${row.plan} · ${money(row.price)}` : 'Plan not on the pricing page', row.promo && 'promo code', `joined ${day(row.createdAt)}`].filter(Boolean).join(' · ')})),
    h('div', {className: 'site-subs-state'}, h('span', {className: 'site-member-chip', 'data-tone': tone, text: label}),
     h('small', {text: when(row)}), !row.accountId && row.active ? h('small', {className: 'site-subs-unlinked', text: 'Not linked to a site account'}) : null));
  }));
  if (!rows.length) list.append(h('p', {className: 'site-members-empty', text: filter === 'live' ? 'No current subscribers yet.' : 'No memberships on Whop yet.'}));
 }
 load();
}
