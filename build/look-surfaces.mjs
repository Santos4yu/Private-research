// Every grey in the site's stylesheets follows the page color the member
// picks in Settings (src/site-look.js). Oct 30, the owner on the first try
// (a see-through layer of color over the whole site): "this all just looks
// like a tint tho its not even the actual website color". So the site's own
// greys change instead: each one becomes a mix of `--ls` (the page color)
// and a lighter color worked out so that, on the site's own #0A0A0A, the mix
// is exactly the grey it was. Pages, panels, cards, borders and grey text
// take the member's color, each as far above the page as before; white
// text, the colored numbers, photos and logos stay as they are.
//
// Grey text follows `--lst` instead, a lighter color on a lighter dark
// page, so the dimmest text still reads (src/site-look.js): a grey set as a
// text color, an icon's fill or stroke, or a custom property named like
// text (muted, faint, dim, label...). Dark ink (on white buttons) stays on
// the page color.
//
// A grey is any color whose channels sit within 14 of each other (or a
// fifth of its brightest, for a light blue-grey like #626A74), from #040404
// up to about #E6E6E6 (pure black is left for shadows, near-white for
// text). Wired up in vite.config.js.

const NATIVE = 10;
const SPREAD = 14;
const HEX = /#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi;
const RGB = /rgba?\(\s*([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*,\s*|\s+)([\d.]+)\s*(?:(?:,|\/)\s*([\d.]+%?))?\s*\)/gi;
const URL = /url\([^)]*\)/gi;

const round = value => Math.round(value * 10) / 10;
const hexOf = rgb => '#' + rgb.map(value => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0')).join('');

const TEXT_PROPS = /^(color|-webkit-text-fill-color|caret-color|text-decoration-color|text-emphasis-color|fill|stroke)$/;
const TEXT_NAMES = /^--.*(text|muted|faint|dim|label|ink|quiet|subtle|copy|fg)/i;
/** Whether a declaration's greys are text. */
export const isText = prop => TEXT_PROPS.test(prop) || TEXT_NAMES.test(prop);

/** The themed form of one color (0-255 channels, alpha 0-1), or null to leave it. */
export function themedColor(r, g, b, alpha = 1, text = false) {
  if (Math.max(r, g, b) - Math.min(r, g, b) > Math.max(SPREAD, Math.max(r, g, b) * 0.2)) return null;
  const level = (r + g + b) / 3;
  if (level < 4 || level > 230) return null;
  const high = Math.max(r, g, b);
  const base = text && level >= 40 ? 'var(--lst)' : 'var(--ls)';
  let mixed;
  if (high <= NATIVE) {
    // The page itself, or darker: the page color toward black.
    const keep = level / NATIVE;
    mixed = keep > 0.995 ? base : `color-mix(in srgb,${base} ${round(keep * 100)}%,#000)`;
  } else {
    // keep * page + (1 - keep) * lifted = the grey, on the site's own page.
    // Measured from its brightest channel, so a bluish grey keeps its blue.
    const share = (high - NATIVE) / (255 - NATIVE), keep = 1 - share;
    const lifted = [r, g, b].map(channel => (channel - keep * NATIVE) / share);
    mixed = `color-mix(in srgb,${base} ${round(keep * 100)}%,${hexOf(lifted)})`;
  }
  return alpha < 1 ? `color-mix(in srgb,${mixed},transparent ${round((1 - alpha) * 100)}%)` : mixed;
}

function themedValue(value, text) {
  // Image links stay as written.
  const kept = [];
  let out = value.replace(URL, match => `\u0000${kept.push(match) - 1}\u0000`);
  out = out.replace(HEX, (match, digits) => {
    const full = digits.length <= 4 ? [...digits].map(digit => digit + digit).join('') : digits;
    const [r, g, b] = [0, 2, 4].map(at => parseInt(full.slice(at, at + 2), 16));
    const alpha = full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1;
    return themedColor(r, g, b, alpha, text) || match;
  });
  out = out.replace(RGB, (match, r, g, b, a) => {
    const alpha = a == null ? 1 : a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a);
    return themedColor(+r, +g, +b, alpha, text) || match;
  });
  return out.replace(/\u0000(\d+)\u0000/g, (match, index) => kept[+index]);
}

/** The PostCSS plugin (vite.config.js). */
export function lookSurfaces() {
  return {
    postcssPlugin: 'look-surfaces',
    Declaration(decl) {
      if (decl.prop === '--ls' || decl.prop === '--lst' || decl.__looked) return;
      const value = themedValue(decl.value, isText(decl.prop));
      decl.__looked = true;
      if (value !== decl.value) decl.value = value;
    },
  };
}
lookSurfaces.postcss = true;
