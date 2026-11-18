// Brand colours that were defaults rather than choices. A colour theme saved
// under an earlier brand (a member's own accent, which also comes back from
// their account on sign-in, or the admin's site-wide colours) that is one
// of those defaults gives way to PropScout's: the first site's blue, and
// Ace Props' green. Themes saved since PropScout carry `scout: true` and
// are always kept. Ace Props themes (`ace: true`) in any other colour are a
// member's own choice and are kept too, as are older themes that are not
// the first site's blue. PropScout's own blue was a default too: a theme
// still on it gives way to the black-and-white one, unless it was saved
// since that theme (`mono: true`).
export const OLD_BRAND_ACCENTS = new Set(['#0082fe', '#67a8ff', '#00f58a']);
const PROPSCOUT_BLUE = '#3d7bff';

function hue(hex) {
  const value = String(hex || '').trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(value)) return null;
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const light = (max + min) / 2;
  if (!delta) return { h: 0, s: 0, l: light };
  const s = delta / (1 - Math.abs(2 * light - 1));
  let h = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l: light };
}

export function isOldBrandBlue(hex) {
  const color = hue(hex);
  return !!color && color.h >= 190 && color.h <= 240 && color.s >= 0.35 && color.l >= 0.2 && color.l <= 0.85;
}

export function isOldBrandTheme(theme) {
  const primary = String(theme?.primary || '').toLowerCase();
  if (!primary) return false;
  if (theme?.mono) return false;
  if (primary === PROPSCOUT_BLUE) return true;
  if (theme?.scout) return false;
  if (OLD_BRAND_ACCENTS.has(primary)) return true;
  if (theme?.ace) return false;
  return isOldBrandBlue(primary);
}

// Charcoal (Nov 18, the owner picked "10 · Charcoal": dark grey, not black,
// orange buttons). A theme saved before it (no `charcoal: true`) that is
// still on the old defaults, the white accent or the black background,
// moves to the new ones; anything a member or the admin picked stays.
// Themes saved since carry `charcoal: true` and are always kept as saved,
// so Black and white can still be picked.
export const DEFAULT_ACCENT = '#ff7a33';
const OLD_ACCENT = '#ffffff';
const OLD_BASE = '#0a0a0a';
export function onCharcoal(theme) {
  if (!theme || typeof theme !== 'object' || theme.charcoal) return theme;
  const out = { ...theme };
  if (String(out.primary || '').trim().toLowerCase() === OLD_ACCENT) out.primary = DEFAULT_ACCENT;
  // The plain black page, not a gradient or a brightness picked over it.
  const plain = !(Array.isArray(out.grad) && out.grad.length) && !(Number(out.bright) || 0);
  if (plain && String(out.base || '').trim().toLowerCase() === OLD_BASE) delete out.base;
  return out;
}
