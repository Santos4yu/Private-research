// A basketball player's chances on a pick, for the Slip Analyzer and the
// Parlay Builder as Analyze has them (prop-analyze.js loadOpportunity): his
// minutes, usage, shots and shares from his player context (opportunity.py),
// with the prop model's projected minutes, as `row.opportunity`. The
// matchup case then reads what the line takes against what he's been
// getting (slip-matchup.js basketball). Requests go through wnbaGet, so a
// player asked about twice (or whose page is open) is asked once.
import {projectStat} from './prop-model.js';
import {hasPlayerContext, playerContextParams, wnbaGet} from './sports/wnba/wnba-research.js';

const BASKETBALL = new Set(['nba', 'wnba']);

/** The row with his chances, or the row as it was. */
export function withChances(row, chances) {
  if (!row || !chances?.szn) return row;
  let model = null;
  try { model = projectStat(row); } catch { model = null; }
  return {...row, opportunity: {...chances, projected: model?.unit === 'min' ? model.usage : null}};
}

/**
 * Each basketball pick's chances ({key: opportunity}) for `legs` ({key,
 * row}): at most `limit` players, `width` at a time. A player whose context
 * can't load is left out; nothing here ever fails the page.
 */
export async function loadChances(legs, {limit = 40, width = 6, get = wnbaGet} = {}) {
  const asked = (legs || []).filter(leg => BASKETBALL.has(leg?.row?.sport) && hasPlayerContext(leg.row)).slice(0, limit);
  const out = {};
  let next = 0;
  const work = async () => {
    while (next < asked.length) {
      const leg = asked[next++];
      try {
        const context = await get('player-context', playerContextParams(leg.row));
        if (context?.opportunity?.szn) out[leg.key] = context.opportunity;
      } catch { /* the pick is graded without it */ }
    }
  };
  await Promise.all(Array.from({length: Math.min(width, asked.length)}, work));
  return out;
}
