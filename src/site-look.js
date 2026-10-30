// The site's background color (Settings, Accent studio, Background). Oct 30,
// the owner: "a new color setting that changes EVERYTHING ... incase i dont
// want to use black i can use white grey pink different brightness etc".
//
// Most pages paint their own dark colors, so a color can't reach them
// through the old theme variables (the old Background tint only moved those).
//  - A dark color becomes the site's own colors: every grey in every
//    stylesheet is built to follow `--ls`, the page color
//    (build/look-surfaces.mjs), so the page, panels, cards, borders and grey
//    text turn that color, each as far above the page as before, while white
//    text, the colored numbers, photos and logos stay as they are. (The first
//    try, a see-through layer of color over everything, read as a tint: the
//    owner, "its not even the actual website color".)
//  - A light color flips the whole site light (invert, then hue-rotate
//    180deg, which brings the hues back: green stays green, red stays red),
//    with photos and logos flipped back, and the same greys set so that,
//    once flipped, they land on the color picked. lookOf works out that
//    color before the flip.
// Grey text keeps its contrast too: on a lighter dark page the text greys
// follow a lighter color, `--lst` (look-surfaces.mjs says which greys are
// text).
// The brightness moves the picked color toward white or black.
//
// A gradient (Oct 30, the owner: "gradient colors with animations like that
// discord gradient look where the color like sways"): two colors, each a
// deep shade on a dark site or a pale one on a light site (the background
// picked says which), drawn as a band twice the screen's size that slowly
// sways (site-look.css): behind the page on a dark site (its panels and
// cards in the two colors' middle), over it on a light one. The member's
// name takes the two colors themselves, moving the same way.

export const DEFAULT_BASE = '#0a0a0a';
// [color, name]: the dark ones first, then the light ones.
export const LOOKS = [
  ['#0a0a0a', 'Black'], ['#1c1d21', 'Graphite'], ['#0d1a33', 'Navy'], ['#0e2118', 'Forest'], ['#221230', 'Plum'],
  ['#2b0f1f', 'Pink'], ['#ffffff', 'White'], ['#e7e8eb', 'Light grey'], ['#fbe2eb', 'Blush'], ['#e1ecf8', 'Sky'],
];
// [from, to, name]
export const GRADIENTS = [
  ['#2dd4bf', '#8b5cf6', 'Aurora'], ['#7dd3fc', '#f9a8d4', 'Candy'], ['#fb923c', '#f472b6', 'Sunset'], ['#3b82f6', '#22d3ee', 'Ocean'],
  ['#a855f7', '#ec4899', 'Grape'], ['#34d399', '#60a5fa', 'Mint'], ['#a3e635', '#14b8a6', 'Lime'], ['#f43f5e', '#facc15', 'Ember'],
];
export const BRIGHT = {min: -30, max: 30};
// The site's own page color, #0A0A0A, every channel.
const NATIVE = 10 / 255;
// Past these the text and the green / red numbers lose their contrast: a
// dark page no lighter than about #595959 (white text 7:1), a light page no
// darker than about #BCBCBC, in relative luminance. A color between them
// goes to whichever side it's nearer, made just light or dark enough.
const DARKEST_LIGHT = 0.5, LIGHTEST_DARK = 0.1;
// A light color is one closer to white than black.
const LIGHT_FROM = 0.3;
// How much of a gradient's color shows on the page: the rest is the dark
// page (or white, on a light site).
const GRAD_SHARE = 0.3;
// A tap on a color in the account sheet: the background a tint of it.
const TINT_SHARE = 0.16;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
export const normalizeBase = value => {
  const hex = String(value || '').trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(hex) ? hex : DEFAULT_BASE;
};
const isHex = value => /^#[0-9a-f]{6}$/.test(String(value || '').toLowerCase());
/** Two colors, or null. */
export const normalizeGrad = value => {
  const pair = Array.isArray(value) ? value.map(item => String(item).toLowerCase()) : null;
  return pair && pair.length === 2 && pair.every(isHex) ? pair : null;
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

// The flip on a light site: invert, hue-rotate(180deg), then brightness so
// the site's own page lands on white (site-look.css).
const LIFT = 1 / (1 - NATIVE);
const flipped = rgb => turn(rgb.map(value => 1 - value)).map(value => clamp(value * LIFT, 0, 1));
// The color that the flip takes to rgb (or as near as it can draw).
const beforeFlip = rgb => turn(rgb.map(value => value / LIFT)).map(value => clamp(1 - value, 0, 1));
const contrast = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};
// The dimmest grey text on the site (#606060): how far its mix leans to
// the page color, and its contrast on the site's own page.
const FAINT = 96 / 255, FAINT_KEEP = 1 - (FAINT - NATIVE) / (1 - NATIVE);
const FAINT_CONTRAST = contrast([FAINT, FAINT, FAINT], [NATIVE, NATIVE, NATIVE]);

// One color of the page: brightened and held readable.
function shade(rgb, light, shift) {
  const page = shift > 0 ? mix(rgb, [1, 1, 1], shift) : mix(rgb, [0, 0, 0], -shift);
  return light ? nudge(page, [1, 1, 1], color => luminance(color) >= DARKEST_LIGHT) : nudge(page, [0, 0, 0], color => luminance(color) <= LIGHTEST_DARK);
}
// The color grey text follows on a dark page: the page color, lightened
// just enough that the dimmest text reads as well as it does on black.
function textOn(page) {
  const faint = anchor => anchor.map(value => value * FAINT_KEEP + (1 - FAINT_KEEP));
  // Black and the darkest colors read as they are; past that, a little margin over rounding.
  if (contrast(faint(page), page) >= FAINT_CONTRAST - 0.01) return page;
  return nudge(page, [1, 1, 1], anchor => contrast(faint(anchor), page) >= FAINT_CONTRAST + 0.02);
}

/**
 * The look for a picked color, brightness and gradient: dark or light,
 * the page as it shows (`page`, and `page2` with a gradient), `surface` and
 * `text` (the colors every grey and every grey text follow, before the
 * flip on a light site), with a gradient the two colors picked and the
 * moving page's two colors (`layer`, before the flip too), and whether it
 * stays still.
 */
export function lookOf(base, bright = 0, grad = null, sway = true) {
  const picked = channels(normalizeBase(base)), shift = normalizeBright(bright) / 100;
  const light = luminance(picked) > LIGHT_FROM, pair = normalizeGrad(grad);
  const behind = light ? [1, 1, 1] : [NATIVE, NATIVE, NATIVE];
  const pages = (pair ? pair.map(hex => mix(channels(hex), behind, 1 - GRAD_SHARE)) : [picked]).map(rgb => shade(rgb, light, shift));
  // On a light site each color is set before the flip, then shown as the flip draws it.
  const drawn = light ? pages.map(beforeFlip) : pages;
  const shown = light ? drawn.map(flipped) : pages;
  // The panels and cards: the color, or a gradient's two colors' middle.
  const surface = drawn.length > 1 ? mix(drawn[0], drawn[1], 0.5) : drawn[0];
  const look = {mode: light ? 'light' : 'dark', page: hexOf(shown[0]), surface: hexOf(surface),
    // On a light site the flip keeps grey text's contrast by itself.
    text: hexOf(light ? surface : textOn(surface))};
  if (pair) Object.assign(look, {page2: hexOf(shown[1]), grad: pair, layer: drawn.map(hexOf), ...(sway === false ? {still: true} : {})});
  return look;
}

/** The background a color tap in the account sheet gives: a tint of it, dark or light as the site is. */
export function tintOf(hex, base) {
  const light = luminance(channels(normalizeBase(base))) > LIGHT_FROM;
  if (!isHex(hex)) return light ? '#ffffff' : DEFAULT_BASE;
  const rgb = channels(hex.toLowerCase());
  // White (or near it) is no tint: the plain page.
  if (Math.max(...rgb) - Math.min(...rgb) < 0.08) return light ? '#ffffff' : DEFAULT_BASE;
  return hexOf(mix(rgb, light ? [1, 1, 1] : [NATIVE, NATIVE, NATIVE], 1 - TINT_SHARE));
}

/** Puts a look on the page (site-look.css reads these). */
export function applyLook(look, root = document.documentElement) {
  const set = (name, value) => value ? root.style.setProperty(name, value) : root.style.removeProperty(name);
  if (look.mode === 'light') root.setAttribute('data-look', 'light'); else root.removeAttribute('data-look');
  // The colors every grey and every grey text in the site follow.
  set('--ls', look.surface);
  set('--lst', look.text);
  set('--look-page', look.page);
  if (look.grad) root.setAttribute('data-look-grad', ''); else root.removeAttribute('data-look-grad');
  set('--look-layer-1', look.layer?.[0]);
  set('--look-layer-2', look.layer?.[1]);
  set('--grad-a', look.grad?.[0]);
  set('--grad-b', look.grad?.[1]);
  if (look.still) root.setAttribute('data-look-still', ''); else root.removeAttribute('data-look-still');
  // The phone's status bar and toolbar take the page's color.
  document.getElementById('theme-color-meta')?.setAttribute('content', look.page);
}
