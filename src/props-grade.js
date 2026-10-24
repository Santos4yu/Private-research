// The Props list's Prop grade: how good the over looks at tonight's line,
// graded the way the Finder's Analyze and the Slip Analyzer grade a pick
// (slip-check.js gradeLeg): his recent games and role read by the prop
// model, the matchup score on top, corrected by what results have taught
// the model (learning.js), and a Demon measured against what it pays.
// Tonight's game line (league.tonight: his team's spread and the total) is
// read the way the prop model reads a game's odds: a blowout risk and the
// points his team is expected to score. The rest of the game's news
// (lineups, who's out by name) the player's page and Analyze add.
import {baselineOf, gradeLeg, TIERS} from './slip-check.js';
import {blowoutOf, modelKey} from './prop-model.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
// A tier's colour on the list's bars.
export const TIER_TONES = {elite: 'strong', strong: 'edge', lean: 'neutral', risky: 'tough', fade: 'tough'};

/**
 * {row id: {chance, needs, priced, edge, tier, label, rank, tone}} for the
 * lines graded so far (a line waits for his games). `needs` is the chance the
 * line has to beat to be worth taking (slip-check.js baselineOf): 50% for a
 * regular line; for a Demon or Goblin the sportsbooks' chance at that line
 * where they price it (`priced`), else about 35% for a Demon (it pays more,
 * so a 43% Demon can grade Elite) and 70% for a Goblin.
 */
/** The row with tonight's line as its game's odds, when the line is for this game. */
export function withTonight(row, league) {
  const mine = league?.tonight?.teams?.[row?.teamAbbr];
  if (!row || row.game || !mine || !finite(mine.spread) || (row.opponent && mine.opponent && mine.opponent !== row.opponent)) return row;
  const spread = {[row.teamAbbr]: mine.spread, ...(mine.opponent ? {[mine.opponent]: -mine.spread} : {})};
  return {...row, game: {team: row.teamAbbr, state: 'pre', injuries: {}, odds: {spread, total: finite(mine.total) ? mine.total : null}}};
}

// A blowout worth a tag on the list: a spread of BLOWOUT_TAG points or more.
export const BLOWOUT_TAG = 10;

export function propGrades(rows, league) {
  const out = new Map();
  if (!league) return out;
  for (const listed of rows || []) {
    if (!listed?.windows && !listed?.gameLog?.length) continue;
    const row = withTonight(listed, league);
    let graded = null;
    try { graded = gradeLeg({side: 'OVER'}, row, {[row.sport]: league}); } catch { graded = null; }
    if (!graded || !finite(graded.chance) || !TIERS[graded.tier]) continue;
    const needs = baselineOf(graded);
    const found = blowoutOf(row.game?.odds?.spread?.[row.game?.team], graded.read?.model?.recentUsage, (modelKey(row) || '').split(':')[1]);
    out.set(listed.id, {chance: graded.chance, needs, priced: needs !== 0.5 && graded.book != null, edge: graded.chance - needs, tier: graded.tier, label: TIERS[graded.tier].label,
      rank: TIERS[graded.tier].rank, tone: TIER_TONES[graded.tier],
      blowout: found && found.change && found.size >= BLOWOUT_TAG ? {...found, spread: row.game.odds.spread[row.game.team]} : null});
  }
  return out;
}
