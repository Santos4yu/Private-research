// Getting the app onto the Home Screen. iPhones never offer it on their own,
// so this sheet shows the steps: once for a signed-in phone visitor, straight
// away for someone arriving by an invite link (/?invite=1), and whenever
// "Get the app" in Settings or the Alerts note is tapped. Android and desktop
// Chrome get the browser's own Install button instead. "Share PropScout"
// sends the invite link.
import './install-guide.css';

const SEEN_KEY = 'krazy-install-guide';
const REMIND_AFTER = 14 * 24 * 60 * 60 * 1000;
const AUTO_AFTER = 20000;

const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
const iOS = /iP(hone|od|ad)/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const android = /Android/i.test(ua);
const standalone = typeof window !== 'undefined'
  && (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true);
// Apps' built-in browsers can't add to the Home Screen; Safari can.
const inApp = /FBAN|FBAV|Instagram|Discord|Snapchat|TikTok|musical_ly|Twitter|LinkedInApp|GSA\/|Line\//i.test(ua);

let deferred = null;   // the browser's own install prompt (Android, desktop Chrome)
let sheet = null;
let signedIn = false;
let autoTimer = null;

const ICONS = {
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></svg>',
  add: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8M8 12h8" /></svg>',
  safari: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="19" r="1.4" /></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></svg>',
};

function steps() {
  if (iOS) {
    return [
      ...(inApp ? [['safari', 'Open this page in Safari', 'Tap ⋯ or the compass, then Open in Safari']] : []),
      // The way iPhone's browsers show it now: the ⋯ menu, Share, then Add to Home Screen.
      ['more', 'Tap the 3 dots ⋯', 'In your browser’s toolbar'],
      ['share', 'Tap Share', 'Near the top of the menu'],
      ['add', 'Tap Add to Home Screen', 'Scroll down if you don’t see it, then tap Add'],
    ];
  }
  return [
    ['menu', 'Tap ⋮ in your browser', 'Top right of the screen'],
    ['add', 'Tap Install app', 'Or Add to Home screen'],
    ['icon', 'Open PropScout', 'From your Home Screen'],
  ];
}

function remember() {
  try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch { /* private mode */ }
}
function recentlySeen() {
  try { return Date.now() - Number(localStorage.getItem(SEEN_KEY) || 0) < REMIND_AFTER; } catch { return true; }
}

export function canInstall() {
  return !standalone && (iOS || android || Boolean(deferred));
}

function close() {
  if (!sheet) return;
  const current = sheet;
  sheet = null;
  current.classList.remove('is-open');
  setTimeout(() => current.remove(), 220);
  remember();
}

async function install() {
  if (!deferred) return;
  const prompt = deferred;
  deferred = null;
  prompt.prompt();
  await prompt.userChoice.catch(() => null);
  close();
  syncSettings();
}

export function openInstallGuide() {
  if (sheet || standalone) return;
  clearTimeout(autoTimer);
  sheet = document.createElement('div');
  sheet.className = 'install-guide';
  const native = Boolean(deferred) && !iOS;
  sheet.innerHTML = `
    <div class="install-backdrop"></div>
    <section class="install-sheet" role="dialog" aria-modal="true" aria-labelledby="install-title">
      <button type="button" class="install-close" aria-label="Close">×</button>
      <img class="install-app-icon" src="/icons/apple-touch-icon.png?v=6" alt="" width="64" height="64" />
      <h2 id="install-title">Get the PropScout app</h2>
      <p class="install-lead">Opens full screen from your Home Screen, with alerts when your picks move.</p>
      ${native ? '' : `<ol class="install-steps">${steps().map(([icon, title, detail], index) => `
        <li><span class="install-step-icon" data-icon="${icon}">${icon === 'icon' ? '<img src="/icons/apple-touch-icon.png?v=6" alt="" width="30" height="30" />' : ICONS[icon]}</span>
          <span><b>${index + 1}. ${title}</b><small>${detail}</small></span></li>`).join('')}</ol>`}
      ${native ? '<button type="button" class="install-primary">Install</button>' : ''}
      <button type="button" class="install-later">Not now</button>
    </section>`;
  document.body.append(sheet);
  sheet.querySelector('.install-backdrop').addEventListener('click', close);
  sheet.querySelector('.install-close').addEventListener('click', close);
  sheet.querySelector('.install-later').addEventListener('click', close);
  sheet.querySelector('.install-primary')?.addEventListener('click', install);
  sheet.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  requestAnimationFrame(() => { sheet?.classList.add('is-open'); sheet?.querySelector('.install-close')?.focus({preventScroll: true}); });
}

// Share Krazy Data: the phone's share sheet where there is one, else the
// link is copied.
export async function shareInvite(button) {
  const url = `${location.origin}/?invite=1`;
  const data = {title: 'PropScout', text: 'Props, hit rates and line moves. Get the app:', url};
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare(data))) { await navigator.share(data); return; }
  } catch (error) {
    if (error?.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(url);
    flash(button, 'Link copied');
  } catch {
    flash(button, url);
  }
}

function flash(button, text) {
  const label = button?.querySelector('small');
  if (!label) return;
  const before = label.dataset.text ??= label.textContent;
  label.textContent = text;
  setTimeout(() => { label.textContent = before; }, 2200);
}

function syncSettings() {
  const get = document.getElementById('get-app-row');
  if (get) get.hidden = !canInstall();
}

function start() {
  document.getElementById('get-app-row')?.addEventListener('click', event => {
    event.stopPropagation();
    if (deferred && !iOS) install(); else openInstallGuide();
  });
  const invite = document.getElementById('invite-row');
  invite?.addEventListener('click', event => { event.stopPropagation(); shareInvite(invite); });
  syncSettings();

  // Arrived by an invite link: the steps straight away on a phone.
  const params = new URLSearchParams(location.search);
  if (params.has('invite')) {
    params.delete('invite');
    const rest = params.toString();
    try { history.replaceState(history.state, '', location.pathname + (rest ? '?' + rest : '') + location.hash); } catch { /* ignore */ }
    if (!standalone && (iOS || android)) setTimeout(openInstallGuide, 1200);
  }
  // Signed in on a phone's browser: once, after a little while, then not
  // again for two weeks.
  window.addEventListener('vortex:site-policy', event => {
    const detail = event.detail || {};
    signedIn = Boolean(detail.accessGranted !== false && detail.account);
    if (!signedIn || standalone || !(iOS || android) || recentlySeen() || autoTimer || sheet) return;
    autoTimer = setTimeout(() => { if (!document.hidden && signedIn) openInstallGuide(); }, AUTO_AFTER);
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferred = event; syncSettings(); });
  window.addEventListener('appinstalled', () => { deferred = null; remember(); close(); syncSettings(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
}
