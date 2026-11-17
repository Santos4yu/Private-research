// DraftKings' over/under on each NBA player prop (book_props.py, Nov 12,
// the owner: "I want better props higher hit rate"). The track record
// showed the matchup score going over 40-42% in every band: PrizePicks'
// lines already price the matchup. DraftKings' own price on the same
// player and stat is what they don't: with the book's cut taken out, its
// chance that he goes over, moved to PrizePicks' line when the two differ.
const STAT = {player_points: 'pts', player_rebounds: 'reb', player_assists: 'ast', player_threes: 'tpm',
  player_points_rebounds: 'pr', player_points_assists: 'pa', player_points_rebounds_assists: 'pra',
  player_rebounds_assists: 'ra', player_steals: 'stl', player_blocks: 'blk'};
// How far a stat lands from its line, roughly: its spread is this times the
// square root of the line (a 20-point line about 6.5 points either way).
const SPREAD = {pts: 1.45, reb: 1.05, ast: 1.0, tpm: 0.95, pr: 1.4, pa: 1.4, pra: 1.35, ra: 1.1, stl: 0.9, blk: 0.9};
// The list asks again after this.
const KEEP = 3 * 60 * 1000;

/** "Luka Dončić", "Jaren Jackson Jr." and "jaren jackson" read the same (book_props.name_key). */
export const nameKey = name => String(name || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, ' ').replace(/[^a-z]/g, '');

const erf = x => {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
};
const cdf = z => 0.5 * (1 + erf(z / Math.SQRT2));
// The z with cdf(z) = p, by halving (plenty for a chance to a tenth of a point).
const quantile = p => { let low = -8, high = 8; for (let i = 0; i < 60; i++) { const mid = (low + high) / 2; if (cdf(mid) < p) low = mid; else high = mid; } return (low + high) / 2; };
// Over a line means one more than it on a whole number, past it on a half.
const edgeOf = line => Number.isInteger(line) ? line + 0.5 : line;

/**
 * DraftKings' chance that this PrizePicks row goes over: {chance, line,
 * over, under, moved}, `line` and the prices DraftKings', `moved` when its
 * line isn't PrizePicks' (the chance then slid along the stat's spread).
 * Null when DraftKings has no over/under for him in this stat.
 */
export function bookChance(row, players) {
  const stat = STAT[row?.marketKey], line = Number(row?.line);
  const entry = stat && players?.[nameKey(row?.player)]?.[stat];
  if (!entry || !Number.isFinite(line)) return null;
  const [bookLine, over, under, fair] = entry;
  if (!Number.isFinite(bookLine) || !(fair > 0 && fair < 1)) return null;
  let chance = fair;
  if (bookLine !== line) {
    const spread = (SPREAD[stat] || 1.2) * Math.sqrt(Math.max(1, bookLine));
    const middle = edgeOf(bookLine) + spread * quantile(fair);
    chance = 1 - cdf((edgeOf(line) - middle) / spread);
  }
  return {chance: Math.min(0.99, Math.max(0.01, chance)), line: bookLine, over, under, moved: bookLine !== line};
}

/** "−140" / "+120": a price as DraftKings shows it. */
export const priceText = price => !Number.isFinite(price) ? '' : price > 0 ? `+${Math.round(price)}` : `−${Math.round(Math.abs(price))}`;

let kept = null;
/** DraftKings' NBA player props now ({} when the feed can't be read). */
export async function loadBookProps({fetcher = fetch, now = Date.now()} = {}) {
  if (kept && now - kept.at < KEEP) return kept.value;
  try {
    const response = await fetcher('/api/wnba?league=nba&resource=book-props', {credentials: 'same-origin'});
    const value = response.ok ? (await response.json())?.players || {} : {};
    kept = {at: now, value};
    return value;
  } catch {
    return {};
  }
}

/**
 * NBA PrizePicks lines with DraftKings' price on them (Nov 17, the owner:
 * the Parlay Builder and the Slip Analyzer "better ... for nba", smarter
 * picks). Every page reads lines through finder-pool.js loadLines, and
 * smart-slip.js assessLeg already weighs sportsbook prices most: until now
 * no book reached an NBA line there. At PrizePicks' own number DraftKings
 * joins the line's apps (a two-sided price); at another number its chance
 * moved to PrizePicks' line becomes the line's `bookLine` (weighed like a
 * one-sided price), as line-value.js does for other books. Goblins and
 * Demons only take it at their own number.
 */
export function withDraftKings(rows, players) {
  if (!Array.isArray(rows) || !players || !Object.keys(players).length) return rows;
  return rows.map(row => {
    if (row?.sport !== 'nba') return row;
    const apps = Array.isArray(row.apps) ? row.apps : [];
    if (apps.some(app => app?.key === 'draftkings')) return row;
    const found = bookChance(row, players);
    if (!found) return row;
    if (!found.moved) return {...row, apps: [...apps, {key: 'draftkings', name: 'DraftKings', over: found.over, under: found.under}]};
    if (String(row.modifier || 'standard').toLowerCase() !== 'standard' || row.bookLine) return row;
    return {...row, bookLine: {line: found.line, over: found.chance, books: ['DraftKings']}};
  });
}
