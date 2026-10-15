// A team's color, read off its logo: the most colorful pixels of it,
// averaged, then evened out so a header tinted with it stays readable
// (not near-black, not neon). The player header (FinderPlayerBanner.jsx)
// washes its card in it. Logos from the leagues' own hosts are read through
// the site (api/mlb-logo.py ?src=) so the canvas may look at them; anything
// else, or a logo that won't load, leaves the header in the brand's mint.
import {useEffect, useState} from 'react';

const STORE = 'ace-team-tint';
const LOGO_HOSTS = /(^|\.)(espncdn\.com|mlbstatic\.com|nhle\.com|nfl\.com|nba\.com|wnba\.com)$/i;
const memory = new Map();

function saved() {
  try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch { return {}; }
}
function save(url, color) {
  try {
    const all = saved();
    all[url] = color;
    const keys = Object.keys(all);
    for (const key of keys.slice(0, Math.max(0, keys.length - 200))) delete all[key];
    localStorage.setItem(STORE, JSON.stringify(all));
  } catch { /* storage full or blocked: kept in memory */ }
}

/** Where the canvas may read a logo from: same-origin, or through the site's image proxy. */
export function readableLogo(url) {
  try {
    const parsed = new URL(url, location.href);
    if (parsed.protocol === 'data:' || parsed.origin === location.origin) return parsed.href;
    if (parsed.protocol === 'https:' && LOGO_HOSTS.test(parsed.hostname)) return `/api/mlb-logo?src=${encodeURIComponent(parsed.href)}`;
  } catch { /* not a URL */ }
  return null;
}

function hsl(r, g, b) {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255, l = (max + min) / 2;
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  return [s, l];
}

/** The logo's color from its pixels ([r, g, b, a, ...]), evened out; null when it has none worth using. */
export function tintOf(data) {
  let r = 0, g = 0, b = 0, weight = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    if (alpha < 0.6) continue;
    const [s, l] = hsl(data[i], data[i + 1], data[i + 2]);
    // White, black and grey outlines aren't the team's color.
    if (s < 0.25 || l < 0.12 || l > 0.9) continue;
    const w = s * alpha;
    r += data[i] * w; g += data[i + 1] * w; b += data[i + 2] * w; weight += w;
  }
  if (weight < 4) return null;
  [r, g, b] = [r / weight, g / weight, b / weight];
  // Even the lightness out (scaling toward a middle grey keeps the hue).
  const [, l] = hsl(r, g, b);
  const target = Math.min(0.55, Math.max(0.4, l));
  const scale = l > 0 ? target / l : 1;
  const out = [r, g, b].map(value => Math.round(Math.min(255, value * scale)));
  return `rgb(${out.join(', ')})`;
}

/** A logo's tint (a promise of a CSS color or null), remembered per logo. */
export function loadTint(url) {
  if (!url) return Promise.resolve(null);
  if (memory.has(url)) return memory.get(url);
  const known = saved()[url];
  if (known !== undefined) { const done = Promise.resolve(known); memory.set(url, done); return done; }
  const source = readableLogo(url);
  if (!source || typeof document === 'undefined') return Promise.resolve(null);
  const found = new Promise(resolve => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 40;
        const context = canvas.getContext('2d', {willReadFrequently: true});
        context.drawImage(image, 0, 0, 40, 40);
        const color = tintOf(context.getImageData(0, 0, 40, 40).data);
        save(url, color);
        resolve(color);
      } catch { resolve(null); }
    };
    image.onerror = () => resolve(null);
    image.src = source;
  });
  memory.set(url, found);
  return found;
}

/** The tint for a logo, once read (null until then, or for none). */
export function useTeamTint(url) {
  const [tint, setTint] = useState(() => (url && saved()[url]) || null);
  useEffect(() => {
    let live = true;
    setTint((url && saved()[url]) || null);
    loadTint(url).then(color => { if (live) setTint(color); });
    return () => { live = false; };
  }, [url]);
  return tint;
}
