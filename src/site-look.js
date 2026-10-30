// The site's background color (Settings, Accent studio, Background). Oct 30,
// the owner: "a new color setting that changes EVERYTHING ... incase i dont
// want to use black i can use white grey pink different brightness etc".
//
// Most pages paint their own dark colors, so a color can't reach them
// through the theme variables (the old Background tint only moved those).
// The whole page is recolored at once instead (site-look.css):
//  - a dark color lifts every pixel toward it: a full-screen layer in
//    screen blend over everything. Black becomes the color, white stays
//    white, and everything between keeps its order, so panels still stand
//    off the page and text stays readable;
//  - a light color flips the site light (invert, then hue-rotate 180deg,
//    which brings the hues back: green stays green, red stays red), turns
//    photos and logos back the right way round, then tints it with the
//    same layer, which under the flip works as a multiply.
// lookOf works out that layer's color so the page ends up on exactly the
// color picked; the brightness moves the picked color toward white or black.

export const DEFAULT_BASE = '#0a0a0a';
// [color, name]: the dark ones first, then the light ones.
export const LOOKS = [
  ['#0a0a0a', 'Black'], ['#1c1d21', 'Graphite'], ['#0d1a33', 'Navy'], ['#0e2118', 'Forest'], ['#221230', 'Plum'],
  ['#2b0f1f', 'Pink'], ['#ffffff', 'White'], ['#e7e8eb', 'Light grey'], ['#fbe2eb', 'Blush'], ['#e1ecf8', 'Sky'],
];
export const BRIGHT = {min: -30, max: 30};
// The site's own page color, #0A0A0A, every channel.
const NATIVE = 10 / 255;
// Past these the text loses its contrast: a dark page no lighter than about
// #4C4C4C, a light page no darker than about #C6C6C6 (relative luminance).
const DARKEST_LIGHT = 0.56, LIGHTEST_DARK = 0.072;
// A light color is one closer to white than black.
const LIGHT_FROM = 0.3;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
export const normalizeBase = value => {
  const hex = String(value || '').trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(hex) ? hex : DEFAULT_BASE;
};
export const normalizeBright = value => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? clamp(number, BRIGHT.min, BRIGHT.max) : 0;
};
const channels = hex => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255);
const hexOf = rgb => '#' + rgb.map(value => Math.round(clamp(value, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
const mix = (rgb, toward, share) => rgb.map((value, index) => value + (toward[index] - value) * share);
const linear = value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
export const luminance = rgb => 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
// CSS hue-rotate(180deg) (Filter Effects): its own inverse.
const TURN = [[-0.574, 1.43, 0.144], [0.426, 0.43, 0.144], [0.426, 1.43, -0.856]];
const turn = rgb => TURN.map(row => row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]);

// Moves rgb toward white or black just far enough to pass `ok` (a halving search).
function nudge(rgb, toward, ok) {
  if (ok(rgb)) return rgb;
  let low = 0, high = 1;
  for (let step = 0; step < 18; step++) {
    const middle = (low + high) / 2;
    if (ok(mix(rgb, toward, middle))) high = middle; else low = middle;
  }
  return mix(rgb, toward, high);
}

/**
 * The look for a picked color and brightness: dark or light, the page's
 * color, and the layer's color (null when the page needs none).
 */
export function lookOf(base, bright = 0) {
  const picked = channels(normalizeBase(base)), shift = normalizeBright(bright) / 100;
  const light = luminance(picked) > LIGHT_FROM;
  let page = shift > 0 ? mix(picked, [1, 1, 1], shift) : mix(picked, [0, 0, 0], -shift);
  page = light ? nudge(page, [1, 1, 1], rgb => luminance(rgb) >= DARKEST_LIGHT) : nudge(page, [0, 0, 0], rgb => luminance(rgb) <= LIGHTEST_DARK);
  // Dark: screen(native, lift) = page, a channel at a time.
  // Light: the flip takes the page's own color to 1 - native (brightened
  // back to white in site-look.css); a layer under it multiplies by
  // turn(1 - lift), so lift = 1 - turn(page).
  const lift = light ? turn(page).map(value => clamp(1 - value, 0, 1)) : page.map(value => clamp((value - NATIVE) / (1 - NATIVE), 0, 1));
  return {mode: light ? 'light' : 'dark', page: hexOf(page), lift: Math.max(...lift) < 0.004 ? null : hexOf(lift)};
}

/** Puts a look on the page (site-look.css reads these). */
export function applyLook(look, root = document.documentElement) {
  if (look.mode === 'light') root.setAttribute('data-look', 'light'); else root.removeAttribute('data-look');
  if (look.lift) { root.setAttribute('data-look-lift', ''); root.style.setProperty('--look-lift', look.lift); }
  else { root.removeAttribute('data-look-lift'); root.style.removeProperty('--look-lift'); }
  root.style.setProperty('--look-page', look.page);
  // The phone's status bar and toolbar take the page's color.
  document.getElementById('theme-color-meta')?.setAttribute('content', look.page);
}
