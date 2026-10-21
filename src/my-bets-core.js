// My Bets' numbers (MyBets.jsx): each bet's profit in units, the period
// it's looked at by (a day, a week from Monday, a month, a year or all
// time), the totals for it, the running units for the chart and the
// cells of the calendar. Profit matches bet_tracker.py.

const finite = value => typeof value === 'number' && Number.isFinite(value);
export const KINDS = [['pickem', "Pick'em"], ['parlay', 'Parlay'], ['straight', 'Straight']];
export const PERIODS = [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year'], ['all', 'All time']];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** An American price as its decimal one (+150 -> 2.5, -120 -> 1.833). */
export function decimalOdds(odds) {
  const value = Number(odds);
  if (!finite(value) || (value > -100 && value < 100)) return null;
  return 1 + (value > 0 ? value / 100 : 100 / -value);
}
/** What a winning bet returns per unit staked. */
export const multiplierOf = bet => bet.kind === 'pickem' ? (Number(bet.payout) > 1 ? Number(bet.payout) : null) : decimalOdds(bet.odds);

/** Units won or lost; null while it's pending (or a cash out with no amount). */
export function profitOf(bet) {
  const stake = Number(bet?.stake) || 0;
  switch (bet?.result) {
    case 'win': { const paid = multiplierOf(bet); return paid ? stake * (paid - 1) : null; }
    case 'loss': return -stake;
    case 'push': case 'void': return 0;
    case 'cashout': return finite(Number(bet.returned)) && bet.returned !== null && bet.returned !== '' ? Number(bet.returned) - stake : null;
    default: return null;
  }
}

// Calendar days as 'YYYY-MM-DD', worked in UTC so no time zone moves them.
const parse = day => { const [y, m, d] = String(day).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const format = date => date.toISOString().slice(0, 10);
export const addDays = (day, count) => { const date = parse(day); date.setUTCDate(date.getUTCDate() + count); return format(date); };
/** Today where the member is. */
export function today(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
const monday = day => { const date = parse(day); return addDays(day, -((date.getUTCDay() + 6) % 7)); };
const short = day => { const date = parse(day); return `${MONTHS[date.getUTCMonth()].slice(0, 3)} ${date.getUTCDate()}`; };

/**
 * The period `kind` holding `anchor`: {kind, start, end, label} with start
 * and end inclusive days (null for all time).
 */
export function periodOf(kind, anchor, now = today()) {
  const date = parse(anchor);
  if (kind === 'day') {
    const label = anchor === now ? 'Today' : anchor === addDays(now, -1) ? 'Yesterday'
      : `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getUTCDay()]}, ${short(anchor)}`;
    return {kind, start: anchor, end: anchor, label};
  }
  if (kind === 'week') {
    const start = monday(anchor), end = addDays(start, 6);
    return {kind, start, end, label: start <= now && now <= end ? 'This week' : `${short(start)} – ${short(end)}`};
  }
  if (kind === 'month') {
    const start = format(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
    const end = format(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
    return {kind, start, end, label: `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`};
  }
  if (kind === 'year') {
    const year = date.getUTCFullYear();
    return {kind, start: `${year}-01-01`, end: `${year}-12-31`, label: String(year)};
  }
  return {kind: 'all', start: null, end: null, label: 'All time'};
}

/** The anchor `steps` periods away (back when negative). */
export function shiftAnchor(kind, anchor, steps) {
  if (kind === 'day') return addDays(anchor, steps);
  if (kind === 'week') return addDays(anchor, 7 * steps);
  const date = parse(anchor);
  if (kind === 'month') return format(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + steps, 1)));
  if (kind === 'year') return `${date.getUTCFullYear() + steps}-01-01`;
  return anchor;
}

export const inPeriod = (bet, period) => !period.start || (bet.date >= period.start && bet.date <= period.end);

/**
 * The totals for `bets`: units, dollars, staked, record, win rate and ROI.
 * Dollars are each bet's units at the unit size it was placed at (`unit`
 * for one that has none), and `sizes` the sizes they were placed at.
 */
export function summarize(bets, unit = null) {
  let units = 0, money = 0, staked = 0, wins = 0, losses = 0, pushes = 0, pending = 0, best = null;
  const sizes = new Set();
  for (const bet of bets) {
    const profit = profitOf(bet);
    if (profit === null) { pending += 1; continue; }
    const size = Number(bet.unit) > 0 ? Number(bet.unit) : Number(unit) || 0;
    units += profit;
    money += profit * size;
    sizes.add(size);
    if (bet.result === 'push' || bet.result === 'void') { pushes += 1; continue; }
    staked += Number(bet.stake) || 0;
    if (profit > 0) wins += 1; else if (profit < 0) losses += 1; else pushes += 1;
    if (profit > 0 && (!best || profit > best.profit)) best = {bet, profit};
  }
  const decided = wins + losses;
  return {units, money, sizes: [...sizes], staked, wins, losses, pushes, pending, count: bets.length, best,
    winRate: decided ? wins / decided : null, roi: staked ? units / staked : null};
}

/** The day a time falls on, on this device's calendar: 2026-10-20. */
export const localDay = time => {
  const when = new Date(time);
  if (Number.isNaN(when.getTime())) return null;
  return `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`;
};

/**
 * The member's balance (bet_tracker.set_bank): what they had, the money
 * they put in or took out since, and every bet dated on or after the day
 * it counts from (`from`; a balance kept before that had one counts from
 * the day it was set) -- each settled one's profit at the unit size it
 * was placed at, each pending one's stake out until it settles, so logging
 * or changing any of them moves it at once. Null with none set.
 */
export function bankroll(bank, bets, unit = null) {
  if (!bank || !Number.isFinite(Number(bank.start))) return null;
  const from = bank.from || localDay(bank.at) || '';
  const amounts = (bank.moves || []).map(move => Number(move.amount) || 0);
  const added = amounts.filter(amount => amount > 0).reduce((sum, amount) => sum + amount, 0);
  const taken = -amounts.filter(amount => amount < 0).reduce((sum, amount) => sum + amount, 0);
  const moves = added - taken;
  let won = 0, inPlay = 0, pending = 0, settled = 0;
  for (const bet of bets || []) {
    if (!(String(bet.date || '') >= from)) continue;
    const size = Number(bet.unit) > 0 ? Number(bet.unit) : Number(unit) || 0;
    const profit = profitOf(bet);
    if (profit !== null) { won += profit * size; settled += 1; }
    else if (bet.result === 'pending') { inPlay += (Number(bet.stake) || 0) * size; pending += 1; }
  }
  const start = Number(bank.start);
  return {start, from, moves, added, taken, won, inPlay, pending, settled, balance: start + moves + won - inPlay};
}

/** The current run of wins or losses, newest first: {kind: 'W'|'L', count}. */
export function streak(bets) {
  const settled = bets.map(bet => ({bet, profit: profitOf(bet)})).filter(item => item.profit !== null && item.profit !== 0)
    .sort((a, b) => (b.bet.date || '').localeCompare(a.bet.date || '') || (b.bet.at || '').localeCompare(a.bet.at || ''));
  if (!settled.length) return null;
  const up = settled[0].profit > 0;
  let count = 0;
  for (const item of settled) { if ((item.profit > 0) !== up) break; count += 1; }
  return {kind: up ? 'W' : 'L', count};
}

/** Units each day: {day: {units, count}} for settled bets. */
export function byDay(bets) {
  const days = {};
  for (const bet of bets) {
    const profit = profitOf(bet);
    if (profit === null || !bet.date) continue;
    const cell = days[bet.date] || (days[bet.date] = {units: 0, count: 0});
    cell.units += profit; cell.count += 1;
  }
  return days;
}

/**
 * The running units through `period`: [{day, units, total}] from its first
 * day (all time: the first bet) to its last or today, whichever is first.
 */
export function series(bets, period, now = today()) {
  const days = byDay(bets);
  const known = Object.keys(days).sort();
  const start = period.start || known[0];
  if (!start) return [];
  let end = period.end && period.end < now ? period.end : now;
  if (known.length && known.at(-1) > end) end = known.at(-1);
  const out = [];
  let total = 0, guard = 0;
  for (let day = start; day <= end && guard < 4000; day = addDays(day, 1), guard += 1) {
    const units = days[day]?.units || 0;
    total += units;
    out.push({day, units, total, count: days[day]?.count || 0});
  }
  return out;
}

/**
 * The calendar for `period`: a day, a week or a month shows the month's
 * days (Monday first, blanks before the 1st); a year its months; all time
 * its years. Each cell {key, label, units, count, inside}.
 */
export function calendar(bets, period, anchor) {
  const days = byDay(bets);
  if (period.kind === 'year' || period.kind === 'all') {
    const totals = {};
    for (const [day, cell] of Object.entries(days)) {
      const key = period.kind === 'year' ? day.slice(0, 7) : day.slice(0, 4);
      if (period.kind === 'year' && !day.startsWith(period.start.slice(0, 4))) continue;
      const total = totals[key] || (totals[key] = {units: 0, count: 0});
      total.units += cell.units; total.count += cell.count;
    }
    if (period.kind === 'year') {
      const year = period.start.slice(0, 4);
      return {unit: 'month', cells: MONTHS.map((name, index) => {
        const key = `${year}-${String(index + 1).padStart(2, '0')}`;
        return {key, label: name.slice(0, 3), units: totals[key]?.units || 0, count: totals[key]?.count || 0, inside: true};
      })};
    }
    const years = Object.keys(totals).sort();
    return {unit: 'year', cells: years.map(key => ({key, label: key, units: totals[key].units, count: totals[key].count, inside: true}))};
  }
  const month = periodOf('month', anchor);
  const lead = (parse(month.start).getUTCDay() + 6) % 7;
  const cells = Array.from({length: lead}, (_, index) => ({key: `blank-${index}`, blank: true}));
  for (let day = month.start; day <= month.end; day = addDays(day, 1)) {
    cells.push({key: day, label: String(parse(day).getUTCDate()), units: days[day]?.units || 0, count: days[day]?.count || 0,
      inside: inPeriod({date: day}, period)});
  }
  return {unit: 'day', title: month.label, cells};
}

/** "+12.5u" / "−3u". */
export function unitsText(value, digits = 1) {
  if (!finite(value)) return '—';
  const shown = Math.abs(value) >= 100 ? Math.round(Math.abs(value)) : Number(Math.abs(value).toFixed(digits));
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${shown}u`;
}
/** "+$124.50" / "−$30.00". */
export function moneyText(value) {
  if (!finite(value)) return '—';
  const text = Math.abs(value).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}$${text}`;
}
export const priceText = bet => bet.kind === 'pickem' ? `${Math.round(Number(bet.payout) * 100) / 100}x` : `${Number(bet.odds) > 0 ? '+' : ''}${bet.odds}`;

/** A tracked slip (slip_ledger.history) as a bet to log. */
export function betFromSlip(slip, sportOf = () => 'other') {
  const picks = slip?.picks || [];
  const first = picks.map(pick => pick.startsAt).filter(Boolean).sort()[0];
  const sports = [...new Set(picks.map(pick => pick.sport).filter(Boolean))];
  return {kind: 'pickem', book: slip?.appName || 'PrizePicks', sport: sports.length === 1 ? sportOf(sports[0]) : 'other',
    payout: finite(Number(slip?.multiplier)) && slip.multiplier > 1 ? Number(slip.multiplier) : '',
    title: `${picks.length}-pick ${slip?.type ? `${slip.type} ` : ''}entry`.replace(/\s+/g, ' '),
    date: first ? today(new Date(first)) : today(), stake: 1, result: 'pending', slipId: slip?.id,
    legs: picks.map(pick => ({player: pick.player, stat: pick.stat, line: pick.line, side: pick.side}))};
}

const round4 = value => Math.round(value * 10000) / 10000;
/**
 * A bet read from a picture (slip_reader.read_bet: dollars as the slip
 * shows them) as the form's fields, in units at the member's unit size.
 */
export function betFromRead(read, unit, sportOf = sport => sport) {
  const size = Number(unit) > 0 ? Number(unit) : 10;
  const legs = (read?.legs || []).filter(leg => leg?.player);
  // An entry on a pick'em app is a pick'em entry, whatever else the picture suggests.
  const pickemApp = /prizepicks|underdog|sleeper|pick6|betr|parlayplay|dabble|chalkboard/i.test(`${read?.app?.key || ''} ${read?.app?.name || ''}`);
  const kind = pickemApp ? 'pickem' : ['pickem', 'parlay', 'straight'].includes(read?.kind) ? read.kind : 'pickem';
  const names = [...new Set(legs.map(leg => leg.player))];
  const title = kind === 'straight' && legs.length === 1 ? [legs[0].player, legs[0].stat].filter(Boolean).join(' ')
    : legs.length ? `${legs.length}-pick: ${names.slice(0, 4).join(', ')}${names.length > 4 ? '…' : ''}` : `${read?.app?.name || 'Sportsbook'} bet`;
  const out = {kind, book: read?.app?.name || '', sport: sportOf(read?.sport || 'other'), title: title.slice(0, 90),
    stake: finite(read?.stake) ? round4(read.stake / size) : 1, result: read?.result || 'pending', date: read?.date || today(),
    legs: legs.map(leg => ({player: leg.player, stat: leg.stat || '', line: leg.line ?? null, side: leg.side || '', result: leg.result || null}))};
  if (kind === 'pickem') out.payout = finite(read?.multiplier) ? read.multiplier : '';
  else out.odds = finite(read?.odds) ? read.odds : '';
  if (out.result === 'cashout') out.returned = finite(read?.paid) ? round4(read.paid / size) : '';
  return out;
}
