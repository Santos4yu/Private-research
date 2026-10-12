// The books and PrizePicks often post different numbers for the same
// player and stat: 64.5 receiving yards at the books where PrizePicks has
// 59.5. The books' prices sit on their own row then, and PrizePicks' line
// has none, though the books are saying plenty about it: if they make 64.5
// a coin flip, the Over at 59.5 is better than one.
//
// Each PrizePicks line without prices of its own gets the books' nearest
// line for that player and stat (`bookLine`), its chance moved to
// PrizePicks' number along the spread the stat usually has. smart-slip.js
// assessLeg weighs it like a one-sided price: a little less than a price
// on the line itself. Every page reads lines through finder-pool.js
// loadLines, so the Parlay Builder, the Slip Analyzer and the Ace
// Assistant all see it alike.
import {bookProbability} from './unified-finder-data.js';
import {rowStatKey, personKey} from './slip-check.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
// The normal curve, near enough (within about 1%) for moving a price a
// line or two.
const curve = z => 1 / (1 + Math.exp(-1.702 * z));
const inverse = p => Math.log(p / (1 - p)) / 1.702;

/**
 * How widely a stat swings game to game: its variance over its average.
 * Yards swing widely (a 60-yard receiver has 30-yard games and 100-yard
 * games); counts like rebounds or strikeouts about as much as chance alone.
 */
export function spreadOf(row) {
  const key = String(rowStatKey(row) || '');
  const sport = row.sport;
  if (sport === 'nfl') return key.includes('yds') ? 15 : key.includes('fantasy') ? 4 : 1.4;
  if (sport === 'mlb') return /pitches/.test(key) ? 2.5 : /outs/.test(key) ? 0.8 : /fantasy/.test(key) ? 4 : 1.3;
  if (sport === 'nba' || sport === 'wnba') return /pts|fantasy/.test(key) ? 2.5 : 1.3;
  return 1.3;
}

/**
 * The Over chance at `line`, from the books' Over chance `over` at
 * `bookLine`: null when the two are too far apart to say.
 */
export function moveChance(over, bookLine, line, spread) {
  if (![over, bookLine, line, spread].every(finite) || over <= 0.15 || over >= 0.85) return null;
  const sd = Math.sqrt(spread * Math.max(0.5, bookLine));
  const gap = line - bookLine;
  if (Math.abs(gap) > 1.25 * sd) return null;
  // The books' line sits at its own Over chance on the curve; PrizePicks'
  // number sits `gap` further along it.
  const z = inverse(1 - over) + gap / sd;
  return Math.min(0.9, Math.max(0.1, 1 - curve(z)));
}

const keyOf = row => {
  const stat = rowStatKey(row);
  if (!stat || !row.player) return null;
  const game = row.gameId || row.eventId || String(row.startsAt || '').slice(0, 10);
  return `${row.sport}|${personKey(row.player)}|${stat}|${game}`;
};
const standard = row => String(row.modifier || 'standard').toLowerCase() === 'standard';
const isPrizePicks = row => Array.isArray(row.apps) && row.apps.some(app => app?.key === 'prizepicks');

/** The rows, each PrizePicks line the books don't price at its number given their nearest one (`bookLine`). */
export function withBookLines(rows) {
  if (!Array.isArray(rows) || !rows.length) return rows;
  const quotes = new Map();
  for (const row of rows) {
    if (!standard(row) || !finite(row.line)) continue;
    const books = bookProbability(row.apps);
    if (!books) continue;
    const key = keyOf(row);
    if (!key) continue;
    if (!quotes.has(key)) quotes.set(key, []);
    quotes.get(key).push({line: row.line, over: books.over / 100, books: books.books.map(book => book.name)});
  }
  if (!quotes.size) return rows;
  return rows.map(row => {
    if (!isPrizePicks(row) || !standard(row) || !finite(row.line) || bookProbability(row.apps)) return row;
    const found = quotes.get(keyOf(row));
    if (!found) return row;
    const nearest = [...found].sort((a, b) => Math.abs(a.line - row.line) - Math.abs(b.line - row.line) || b.books.length - a.books.length)[0];
    if (nearest.line === row.line) return row;
    const over = moveChance(nearest.over, nearest.line, row.line, spreadOf(row));
    return over == null ? row : {...row, bookLine: {line: nearest.line, over, books: nearest.books}};
  });
}
