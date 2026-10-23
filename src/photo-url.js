// ESPN's headshots are 1040 x 760: squeezed into a 40-60px circle the
// browser shrinks them badly (jagged, "pixelated"). ESPN's own resizer sends
// one at about twice the size shown instead (PickParts.jsx Face falls back
// to the full photo, then initials, if it fails). Other photos as they are.
const ESPN_HEAD = /^https?:\/\/a\.espncdn\.com\/i\/headshots\/([a-z]+)\/players\/full\/(\d+)\.png$/i;

export function sharpHead(src) {
  const found = ESPN_HEAD.exec(String(src || ''));
  return found ? `https://a.espncdn.com/combiner/i?img=/i/headshots/${found[1]}/players/full/${found[2]}.png&w=208&h=152` : src;
}
