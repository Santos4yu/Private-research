// What the results have taught the model (learning.py, refit once a day on
// the timer): for each sport and how sure the model was, how far its
// chances have been off. Every pick graded anywhere -- the Parlay Builder,
// the Slip Analyzer, the Ace Assistant -- goes through slip-check.js judge(),
// which applies it here, so they all move together.
//
// The day's top picks are sent back (slip-history.js logTopPicks) to be
// settled after their games and learned from, so the model learns every day.

const MODEL_URL = '/api/prediction?action=learning';
const CACHE_KEY = 'ace-learning';
const FRESH = 6 * 3600 * 1000;
const finite = value => typeof value === 'number' && Number.isFinite(value);
// Which model grades picks (learning.py BASIS): the prop model
// (prop-model.js) for these leagues. Corrections fit on another model's
// picks don't apply to them.
export const MODEL_BASIS = 2;
const PROP_SPORTS = new Set(['mlb', 'nba', 'wnba', 'nhl']);

let model = null;
let loading = null;
let asked = 0;

/** Use these corrections (null for none). */
export function setLearning(next) {
  model = next && next.version === 1 && next.groups ? next : null;
}
export const learned = () => model;

/** The corrections, from this browser's copy while it's fresh, else the site. Never fails. */
export function loadLearning({fetcher = (...args) => fetch(...args), now = Date.now()} = {}) {
  // A tab left open picks up the next day's corrections.
  if (loading && now - asked < FRESH) return loading;
  asked = now;
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (saved && now - saved.fetched < FRESH) { setLearning(saved.model); return (loading = Promise.resolve(model)); }
  } catch { /* fetched below */ }
  loading = fetcher(MODEL_URL, {credentials: 'same-origin', cache: 'no-store'})
    .then(response => {
      // Signed out or a hiccup: ask again next time, keep what we have.
      if (!response.ok) throw new Error('not now');
      return response.json();
    })
    .then(found => {
      setLearning(found);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({fetched: now, model: found})); } catch { /* kept in memory */ }
      return model;
    })
    .catch(() => { loading = null; return model; });
  return loading;
}

// A group's correction at a chance: straight lines between its bands' points
// (each band's average chance and its correction), level past the ends.
function offsetAt(group, p) {
  const points = (group?.points || []).filter(point => finite(point[0]) && finite(point[1])).sort((a, b) => a[0] - b[0]);
  if (!points.length) return null;
  if (p <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i];
    if (p <= x1) return y0 + (y1 - y0) * (p - x0) / (x1 - x0 || 1);
  }
  return points.at(-1)[1];
}

/** A pick's chance with what the results have taught: its sport's correction, else all sports'. */
export function calibrate(p, sport, using = model) {
  if (!using || !finite(p)) return p;
  if (PROP_SPORTS.has(sport) && using.basis !== MODEL_BASIS) return p;
  const offset = offsetAt(using.groups?.[sport], p) ?? offsetAt(using.groups?.all, p) ?? 0;
  return Math.min(0.97, Math.max(0.03, p + offset));
}
