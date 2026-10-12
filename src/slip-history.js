// Graded slips kept for the member, how they finished, and the site's
// record (slip_ledger.py through /api/prediction).
import {recentAverage, settleKey} from './slip-games.js';

const SAVE_URL = '/api/prediction?action=slip-save';
const REMOVE_URL = '/api/prediction?action=slip-remove';
const HISTORY_URL = '/api/prediction?action=slip-history';

export const newSlipId = () => `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * A graded pick ({row, side, grade}) as the server keeps it, with what it
 * needs to be settled: its chance as shown, and (`raw`) the model's own
 * before what results have taught it (learning.js), which learning.py
 * measures against.
 */
export function pickPayload(leg) {
  const row = leg.row;
  return {sport: row.sport, player: row.player, playerId: row.playerId ?? '', team: row.teamAbbr || '', opponent: row.opponent || '',
    startsAt: row.startsAt || '', gameId: row.sport === 'nhl' ? row.gameId || '' : '', eventId: row.eventId || '',
    teamId: row.teamId ?? '', opponentId: row.opponentId ?? '', competition: row.competition || '',
    side: leg.side, line: leg.line ?? row.line, stat: leg.stat || row.market, modifier: leg.modifier || row.modifier || 'standard',
    tier: leg.grade.tier, chance: leg.grade.chance, raw: leg.grade.rawChance ?? leg.grade.chance, headshot: row.headshot || '', position: row.position || '',
    average: recentAverage(row), settle: settleKey(row)};
}

/** What the server keeps of a graded slip: each graded pick, with what it needs to be settled. */
export function slipPayload(id, slip, legs, score, source = 'analyzer') {
  const picks = legs.filter(leg => leg.grade && leg.row && leg.side).map(pickPayload);
  return {id, app: slip?.app?.key || '', appName: slip?.app?.name || '', type: score?.type || '', letter: score?.letter || '',
    chance: score?.chance ?? null, multiplier: score?.multiplier ?? null, value: score?.value ?? null, source, picks};
}

export async function saveSlip(payload, {fetcher = fetch} = {}) {
  const response = await fetcher(SAVE_URL, {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload)});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The slip couldn\'t be saved.');
  return data;
}

/** Stop tracking a slip: off the member's list (its picks stay in the site's record). */
export async function removeSlip(id, {fetcher = fetch} = {}) {
  const response = await fetcher(REMOVE_URL, {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({id})});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The slip couldn\'t be removed.');
  return data;
}

export async function loadHistory({signal, fetcher = fetch} = {}) {
  const response = await fetcher(HISTORY_URL, {credentials: 'same-origin', signal, cache: 'no-store'});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Graded slips are unavailable right now.');
  return data;
}

const LEARN_URL = '/api/prediction?action=slip-learn';
const SENT_KEY = 'ace-learned';

/**
 * Send the day's top graded picks ([{row, side, grade}]) to be learned from:
 * the strongest `limit` not sent today, before their games. Fire and forget.
 */
export function logTopPicks(legs, {source = 'board', limit = 60, now = Date.now(), fetcher = (...args) => fetch(...args)} = {}) {
  const day = new Date(now).toISOString().slice(0, 10);
  let sent = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(SENT_KEY) || 'null');
    if (saved?.day === day) sent = new Set(saved.ids);
  } catch { /* nothing sent yet */ }
  const fresh = (legs || []).filter(leg => leg?.row && leg.grade && !sent.has(`${leg.row.id}:${leg.side}`)
    && Date.parse(leg.row.startsAt || '') > now + 10 * 60000)
    .sort((a, b) => (b.grade.chance || 0) - (a.grade.chance || 0)).slice(0, limit);
  if (!fresh.length) return Promise.resolve({kept: 0});
  for (const leg of fresh) sent.add(`${leg.row.id}:${leg.side}`);
  try { localStorage.setItem(SENT_KEY, JSON.stringify({day, ids: [...sent].slice(-2000)})); } catch { /* sent again tomorrow at worst */ }
  return fetcher(LEARN_URL, {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({picks: fresh.map(leg => ({...pickPayload(leg), source}))})})
    .then(response => response.json().catch(() => ({kept: 0})))
    .catch(() => ({kept: 0}));
}
