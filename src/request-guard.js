// Every call the site makes to its own /api is given an end. Two things
// otherwise leave a page on its loading state for good:
//  - iOS drops requests that are in flight when the app goes to the
//    background, often without ever settling them, so a page opened just
//    before switching apps keeps "Loading…" when you come back;
//  - a connection that stalls never times out on its own.
// So a read still in flight when the app comes back (or the connection
// returns) starts over by itself, and any call that runs past the longest
// a server function can take (60 seconds on Vercel) is stopped, so the
// page shows its error and Retry instead of spinning.
//
// A call's own AbortSignal still cancels it as before (pages cancel the
// requests of a screen they leave), and calls to other sites are left alone.
// A stopped call fails with a TimeoutError, not an AbortError, because pages
// quietly ignore AbortErrors (those mean "you navigated away") and would
// otherwise keep spinning.
const LIMIT = 65000;
const STALE = 4000;
const inflight = new Set();
const timedOut = () => Object.assign(new Error('This is taking longer than usual. Try again.'), { name: 'TimeoutError' });

function ours(input, base) {
  if (typeof input !== 'string' && !(input instanceof URL)) return false;
  try {
    const url = new URL(String(input), base.href);
    return url.origin === base.origin && url.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

export function installRequestGuard(target = window) {
  if (!target.fetch || target.fetch.guarded) return;
  const native = target.fetch.bind(target);
  const guarded = (input, options) => {
    const init = options || {};
    if (!ours(input, target.location)) return native(input, init);
    const own = init.signal;
    const read = String(init.method || 'GET').toUpperCase() === 'GET';
    const attempt = (restarts) => {
      if (own?.aborted) return native(input, init);
      const controller = new AbortController();
      const entry = { controller, read, started: Date.now(), woke: false, late: false };
      const cancel = () => controller.abort(own.reason);
      own?.addEventListener('abort', cancel, { once: true });
      inflight.add(entry);
      // Left running after the reply arrives so a body that stalls is
      // stopped too; aborting a finished response does nothing.
      setTimeout(() => { entry.late = true; controller.abort(); }, LIMIT)?.unref?.();
      return native(input, { ...init, signal: controller.signal }).then((response) => {
        inflight.delete(entry);
        return response;
      }, (error) => {
        inflight.delete(entry);
        own?.removeEventListener('abort', cancel);
        if (own?.aborted) throw error;
        if (entry.woke && restarts < 3) return attempt(restarts + 1);
        if (entry.late) throw timedOut();
        throw error;
      });
    };
    return attempt(0);
  };
  guarded.guarded = true;
  target.fetch = guarded;

  const wake = () => {
    if (target.document?.visibilityState === 'hidden') return;
    const now = Date.now();
    for (const entry of inflight) {
      if (entry.read && now - entry.started > STALE) {
        entry.woke = true;
        entry.controller.abort();
      }
    }
  };
  target.addEventListener('pageshow', wake);
  target.addEventListener('online', wake);
  target.document?.addEventListener('visibilitychange', wake);
}

if (typeof window !== 'undefined') installRequestGuard(window);
