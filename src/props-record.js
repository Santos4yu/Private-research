// The Props tab's track record (props_record.py): the NBA list reports what
// it shows (each prop's matchup score, Prop grade and line, games still to
// come), and reads back how the props it showed went, by score band and
// grade tier.
const SENT = 'props-record:sent';
// A report goes again after this, or sooner when many more props are scored.
const EVERY = 10 * 60 * 1000;

/** The report for these rows: [{id, market, line, start, score, chance, tier, modifier, needs, book}],
 * `book` DraftKings' chance he goes over (book-props.js), when it has him. */
export function reportRows(rows, scores, grades, now = Date.now(), books = null) {
  const out = [];
  for (const row of rows || []) {
    const read = scores?.get(row.id), prop = grades?.get(row.id), book = books?.get(row.id);
    if (!read || !row.playerId || !Number.isFinite(Number(row.line)) || !(Date.parse(row.startsAt || '') > now)) continue;
    out.push({id: String(row.playerId), market: row.marketKey, line: Number(row.line), start: row.startsAt, score: read.score,
      chance: prop?.chance ?? null, tier: prop?.tier ?? null, modifier: String(row.modifier || 'standard').toLowerCase(), needs: prop?.needs ?? null,
      book: Number.isFinite(book?.chance) ? Math.round(book.chance * 1000) / 1000 : null});
  }
  return out;
}

/** Whether to send now: the first report, after EVERY, or a fifth more props scored since. */
export function shouldSend(count, last, now = Date.now()) {
  if (!count) return false;
  if (!last) return true;
  return now - last.at >= EVERY || count >= last.count * 1.2 + 5;
}

/** Send the list's report (best effort: the list never waits on it). */
export function reportProps(rows, {fetcher = fetch, storage = globalThis.sessionStorage} = {}) {
  let last = null;
  try { last = JSON.parse(storage?.getItem(SENT) || 'null'); } catch { last = null; }
  if (!shouldSend(rows.length, last)) return false;
  try { storage?.setItem(SENT, JSON.stringify({at: Date.now(), count: rows.length})); } catch { /* private mode */ }
  fetcher('/api/wnba?league=nba&resource=props-log', {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({rows})}).catch(() => {});
  return true;
}

/** How the props shown over the last `days` went. */
export async function loadRecord(days = 14, {fetcher = fetch} = {}) {
  const response = await fetcher(`/api/wnba?league=nba&resource=props-record&days=${days}`, {credentials: 'same-origin'});
  if (!response.ok) throw new Error('Track record unavailable');
  return response.json();
}

// Enough props in a band or tier for its rate to say something.
export const ENOUGH = 20;

// A Prop grade "hitting lately": its props have gone over more often than
// they needed to be worth taking, over enough of them that it isn't one
// good night (HOT.props, and a standard error clear of break-even).
export const HOT = {props: 40, errors: 1};

/** The tiers hitting lately: Map tier -> {rate, needed, props}. */
export function hittingTiers(record) {
  const out = new Map();
  for (const item of record?.tiers || []) {
    const n = item.priced, rate = item.pricedRate, needed = item.needed;
    if (!(n >= HOT.props) || !Number.isFinite(rate) || !Number.isFinite(needed)) continue;
    const p = needed / 100, error = Math.sqrt(p * (1 - p) / n) * 100;
    if (rate - needed >= HOT.errors * error) out.set(item.tier, {rate, needed, props: n});
  }
  return out;
}
