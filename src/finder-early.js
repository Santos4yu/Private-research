// The Finder's lines start loading the moment a member is let in, while the
// page is still drawing itself: each league's saved board is read from the
// device and, when it's missing or old, the live one is asked for. The Finder
// takes these up the first time it loads each league (UnifiedFinder load()),
// instead of starting them only after its first render.
import {readFinderCache, loadFinderSportRaw, loadFinderSnapshot, hasFinderSnapshot, readFinderView, linkTarget} from './unified-finder-data.js';
import {BOARD_FRESH} from './finder-pool.js';

export const FINDER_KEYS = ['nba', 'wnba', 'mlb', 'nfl', 'nhl', 'soccer', 'tennis', 'cs2'];
// Started this long ago or more, a head start is stale and loading begins afresh.
const KEEP = 30 * 1000;
const early = new Map();

/** The leagues the Finder will open on: a linked one, the member's saved pick, or every league they can see. */
export function finderStartKeys(allowed, {search = '', storage = null} = {}) {
  const open = FINDER_KEYS.filter(allowed);
  const target = linkTarget(search);
  const picked = target ? [target.sport] : readFinderView(storage).picked || [];
  const chosen = picked.filter(key => open.includes(key));
  return chosen.length ? chosen : open;
}

export function startFinder(keys, now = Date.now) {
  for (const key of keys) {
    if (early.has(key)) continue;
    const cached = readFinderCache(key).catch(() => null);
    // Lines the device has from moments ago are current; otherwise ask now,
    // with the server's saved hit rates alongside.
    const live = cached.then(saved => saved && now() - Number(saved.ts || 0) < BOARD_FRESH ? null : {
      saved: hasFinderSnapshot(key) ? loadFinderSnapshot(key).catch(() => ({})) : null,
      board: loadFinderSportRaw(key, {fast: key === 'wnba' || key === 'nba'}),
    });
    // A failure is reported when the Finder takes this up, not as an unhandled rejection now.
    live.then(head => head?.board.catch(() => {}));
    early.set(key, {cached, live, at: now()});
  }
}

/** A league's head start, once; null when there is none or it's stale. */
export function takeEarly(key, now = Date.now) {
  const item = early.get(key);
  early.delete(key);
  return item && now() - item.at < KEEP ? item : null;
}
