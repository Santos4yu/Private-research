// Alerts: the site's announcements as phone notifications (push_notices.py,
// public/sw.js). The switch lives in Settings. iPhones only allow it in the
// home-screen app, and only from a tap -- so the key and the service worker
// are ready before the switch is touched, and the tap goes straight to the
// browser's subscribe.
const SYNC_KEY = 'krazy-alerts-synced';
const SYNC_EVERY = 24 * 60 * 60 * 1000;

const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const iPhone = typeof navigator !== 'undefined'
  && (/iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const homeScreen = typeof window !== 'undefined'
  && (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true);

let registration = null;
let serverKey = null;
let signedIn = false;
let busy = false;

async function post(body) {
  const response = await fetch('/api/session', {method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Alerts are unavailable right now');
  return data;
}

function keyBytes(text) {
  const raw = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - text.length % 4) % 4));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

function sameKey(subscription, key) {
  const current = subscription?.options?.applicationServerKey;
  if (!current || !key) return true;
  const a = new Uint8Array(current), b = keyBytes(key);
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}

async function prepare() {
  if (!supported) return;
  registration ??= await navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).catch(() => null);
  if (signedIn && !serverKey) {
    serverKey = await fetch('/api/session?action=push-key', {credentials: 'same-origin', cache: 'no-store'})
      .then(response => (response.ok ? response.json() : {})).then(data => data.key || null).catch(() => null);
  }
}

async function currentSubscription() {
  return registration ? registration.pushManager.getSubscription().catch(() => null) : null;
}

async function subscribe() {
  await prepare();
  if (!registration || !serverKey) throw new Error('Alerts are unavailable right now');
  const subscription = await registration.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: keyBytes(serverKey)});
  await post({action: 'push-subscribe', subscription: subscription.toJSON()});
  try { localStorage.setItem(SYNC_KEY, String(Date.now())); } catch { /* private mode */ }
  return subscription;
}

async function unsubscribe() {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await subscription.unsubscribe().catch(() => {});
  await post({action: 'push-unsubscribe', subscription: {endpoint: subscription.endpoint}}).catch(() => {});
  try { localStorage.removeItem(SYNC_KEY); } catch { /* private mode */ }
}

// A device that already has alerts on is re-sent now and then, so the list
// on the server follows it (a new key, a lost record, a different member).
async function keepInSync() {
  const subscription = await currentSubscription();
  if (!subscription || Notification.permission !== 'granted' || !serverKey) return;
  if (!sameKey(subscription, serverKey)) {
    await subscription.unsubscribe().catch(() => {});
    await subscribe().catch(() => {});
    return;
  }
  let last = 0;
  try { last = Number(localStorage.getItem(SYNC_KEY)) || 0; } catch { /* private mode */ }
  if (Date.now() - last < SYNC_EVERY) return;
  await post({action: 'push-subscribe', subscription: subscription.toJSON()})
    .then(() => { try { localStorage.setItem(SYNC_KEY, String(Date.now())); } catch { /* private mode */ } })
    .catch(() => {});
}

async function render(note = '') {
  const row = document.getElementById('alerts-setting');
  const toggle = document.getElementById('alerts-switch');
  const noteEl = document.getElementById('alerts-note');
  if (!row || !toggle || !noteEl) return;
  const needsHomeScreen = !supported && iPhone && !homeScreen;
  row.hidden = !signedIn || (!supported && !needsHomeScreen);
  if (row.hidden) return;
  const blocked = supported && Notification.permission === 'denied';
  const on = supported && !blocked && Notification.permission === 'granted' && Boolean(await currentSubscription());
  toggle.setAttribute('aria-checked', String(on));
  toggle.disabled = busy || needsHomeScreen || blocked;
  const message = note
    || (needsHomeScreen ? 'Add Krazy Data to your Home Screen to turn on alerts.' : '')
    || (blocked ? 'Notifications are off for Krazy Data in your device settings.' : '');
  noteEl.textContent = message;
  noteEl.hidden = !message;
}

async function toggleAlerts() {
  if (busy) return;
  const turningOn = document.getElementById('alerts-switch')?.getAttribute('aria-checked') !== 'true';
  busy = true;
  let note = '';
  try {
    if (turningOn) await subscribe();
    else await unsubscribe();
  } catch (error) {
    // Declining the prompt isn't an error worth showing; the switch just stays off.
    if (Notification.permission !== 'denied' && error?.name !== 'NotAllowedError') note = error?.message || 'Alerts are unavailable right now';
  } finally {
    busy = false;
    render(note);
  }
}

function start() {
  document.getElementById('alerts-switch')?.addEventListener('click', toggleAlerts);
  window.addEventListener('vortex:site-policy', event => {
    const detail = event.detail || {};
    const now = Boolean(detail.accessGranted !== false && detail.account?.id);
    if (now === signedIn && (registration || !supported)) return;
    signedIn = now;
    prepare().then(() => (signedIn ? keepInSync() : null)).finally(() => render());
  });
  // Coming back from the device's settings can change what's allowed.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
}
