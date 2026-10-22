// The Props list's Prop grade: how good the over looks at tonight's line,
// graded the way the Finder's Analyze and the Slip Analyzer grade a pick
// (slip-check.js gradeLeg): his recent games and role read by the prop
// model, the matchup score on top, corrected by what results have taught
// the model (learning.js), and a Demon measured against what it pays.
// Tonight's game news (injuries, lineups) isn't in it here; the player's
// page and Analyze add that.
import {baselineOf, gradeLeg, TIERS} from './slip-check.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
// A tier's colour on the list's bars.
export const TIER_TONES = {elite: 'strong', strong: 'edge', lean: 'neutral', risky: 'tough', fade: 'tough'};

/** {row id: {chance, edge, tier, label, rank, tone}} for the lines graded so far (a line waits for his games). */
export function propGrades(rows, league) {
  const out = new Map();
  if (!league) return out;
  for (const row of rows || []) {
    if (!row?.windows && !row?.gameLog?.length) continue;
    let graded = null;
    try { graded = gradeLeg({side: 'OVER'}, row, {[row.sport]: league}); } catch { graded = null; }
    if (!graded || !finite(graded.chance) || !TIERS[graded.tier]) continue;
    out.set(row.id, {chance: graded.chance, edge: graded.chance - baselineOf(graded), tier: graded.tier, label: TIERS[graded.tier].label,
      rank: TIERS[graded.tier].rank, tone: TIER_TONES[graded.tier]});
  }
  return out;
}
