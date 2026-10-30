// A new release reaches an app that's already open. Everything the Props tab
// scores is worked out on the phone, so a phone holding an old copy of the
// site shows old scores until the app is fully closed. Each build bakes in
// its id (vite.config.js) and writes the same id to /version.json; the app
// asks for that when it comes back to the front and every few minutes while
// it's open, and a newer one reloads it: at once as it comes back (nothing
// is mid-way then), otherwise once it has sat untouched for a while.
const MINE = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : null;
const EVERY = 5 * 60 * 1000;
const IDLE = 3 * 60 * 1000;
// One reload per release in ten minutes: a CDN still handing out the old
// files mustn't loop the app.
const TRIED = 'app-update:tried', RETRY = 10 * 60 * 1000;

async function latest(fetcher = fetch) {
  try {
    const response = await fetcher(`/version.json?t=${Date.now()}`, {cache: 'no-store'});
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data?.id === 'string' && data.id ? data.id : null;
  } catch {
    return null;
  }
}

// Pages that can come back the way they were (the Finder's open player)
// hear about it first.
function reloadPage() {
  try { globalThis.dispatchEvent(new Event('vortex:update-reload')); } catch { /* reload anyway */ }
  globalThis.location.reload();
}

function reload(id, storage = globalThis.sessionStorage, go = reloadPage) {
  try {
    const [before, at] = String(storage?.getItem(TRIED) || '').split('|');
    if (before === id && Date.now() - Number(at) < RETRY) return false;
    storage?.setItem(TRIED, `${id}|${Date.now()}`);
  } catch { /* private mode: reload anyway */ }
  go();
  return true;
}

/** Whether the app should reload now: a newer release, and the moment is right. */
export function shouldReload({mine, id, resuming, idleFor}) {
  return Boolean(mine && id && id !== mine && (resuming || idleFor >= IDLE));
}

export function watchForUpdates() {
  if (!MINE || typeof document === 'undefined') return;
  let touched = Date.now(), asking = false;
  const check = async resuming => {
    if (asking || document.visibilityState !== 'visible') return;
    asking = true;
    const id = await latest();
    asking = false;
    if (shouldReload({mine: MINE, id, resuming, idleFor: Date.now() - touched})) reload(id);
  };
  for (const type of ['pointerdown', 'keydown', 'touchstart', 'scroll']) {
    addEventListener(type, () => { touched = Date.now(); }, {passive: true, capture: true});
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(true); });
  addEventListener('pageshow', event => { if (event.persisted) check(true); });
  setInterval(() => check(false), EVERY);
}
