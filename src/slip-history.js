// Graded slips kept for the member, how they finished, and the site's
// record (slip_ledger.py through /api/prediction).
import {recentAverage, settleKey} from './slip-games.js';

const SAVE_URL = '/api/prediction?action=slip-save';
const REMOVE_URL = '/api/prediction?action=slip-remove';
const HISTORY_URL = '/api/prediction?action=slip-history';

export const newSlipId = () => `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** What the server keeps of a graded slip: each graded pick, with what it needs to be settled. */
export function slipPayload(id, slip, legs, score) {
  const picks = legs.filter(leg => leg.grade && leg.row && leg.side).map(leg => {
    const row = leg.row;
    return {sport: row.sport, player: row.player, playerId: row.playerId ?? '', team: row.teamAbbr || '', opponent: row.opponent || '',
      startsAt: row.startsAt || '', gameId: row.sport === 'nhl' ? row.gameId || '' : '', eventId: row.eventId || '',
      teamId: row.teamId ?? '', opponentId: row.opponentId ?? '', competition: row.competition || '',
      side: leg.side, line: leg.line ?? row.line, stat: leg.stat || row.market, modifier: leg.modifier || row.modifier || 'standard',
      tier: leg.grade.tier, chance: leg.grade.chance, headshot: row.headshot || '', position: row.position || '',
      average: recentAverage(row), settle: settleKey(row)};
  });
  return {id, app: slip?.app?.key || '', appName: slip?.app?.name || '', type: score?.type || '', letter: score?.letter || '',
    chance: score?.chance ?? null, multiplier: score?.multiplier ?? null, value: score?.value ?? null, picks};
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
