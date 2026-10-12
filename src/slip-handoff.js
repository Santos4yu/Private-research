// A slip handed from the Parlay Builder to the Slip Analyzer: the exact
// picks (each line's id on the board, its number and side), so the
// Analyzer grades the very slip that was built instead of reading a
// screenshot of it, plus what the Builder made of it, so the Analyzer can
// say whether anything has changed since.
const KEY = 'ace-slip-handoff';
const EVENT = 'vortex:analyze-slip';

/** A Builder slip ({legs, play, payout, letter, chance, value}) as the Analyzer reads a slip. */
export function builderSlip(slip, now = Date.now()) {
  return {
    app: {key: 'prizepicks', name: 'PrizePicks'},
    entry: {type: slip.play === 'flex' ? 'flex' : 'power', stake: null, payout: null, multiplier: null},
    skipped: 0,
    legs: slip.legs.map(leg => ({
      player: leg.row.player, team: String(leg.row.teamAbbr || '').toUpperCase(), opponent: String(leg.row.opponent || '').toUpperCase(),
      sport: leg.row.sport, stat: leg.row.raw?.stat || leg.row.market, statName: leg.row.market, line: leg.row.line, plus: false,
      side: leg.side, modifier: leg.modifier || 'standard', odds: null, needs: [], rowId: leg.row.id,
    })),
    builder: {at: now, letter: slip.letter, chance: slip.chance, value: slip.value, payout: slip.payout,
      legs: slip.legs.map(leg => ({rowId: leg.row.id, player: leg.row.player, line: leg.row.line, tier: leg.tier || null, chance: leg.chance}))},
  };
}

/** Hand a slip to the Analyzer: kept until it picks it up (it may not be open yet). */
export function handOff(read) {
  try { sessionStorage.setItem(KEY, JSON.stringify(read)); } catch { /* the event still carries it */ }
  window.dispatchEvent(new CustomEvent(EVENT, {detail: read}));
}

/** The slip waiting for the Analyzer, taken (once). */
export function takeHandoff() {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Hear slips handed over while the Analyzer is open. */
export function onHandoff(listener) {
  const heard = event => { takeHandoff(); listener(event.detail); };
  window.addEventListener(EVENT, heard);
  return () => window.removeEventListener(EVENT, heard);
}

/**
 * What changed between the Builder's slip and the Analyzer's grade of it:
 * [{kind, player, text}] -- a line moved, a pick's tier changed, a pick
 * missing -- and whether the grade still matches.
 */
export function changesSince(builder, legs, score) {
  if (!builder) return null;
  const items = [];
  for (const built of builder.legs || []) {
    const leg = legs.find(item => item.rowId === built.rowId) || legs.find(item => item.player === built.player);
    if (!leg?.grade) { items.push({kind: 'missing', player: built.player, text: `${built.player} isn't on PrizePicks' board any more`}); continue; }
    // The board's line now (a moved line is graded at the built number).
    const line = leg.spot?.board?.line ?? leg.row?.line;
    if (line != null && Number(line) !== Number(built.line)) items.push({kind: 'line', player: built.player, text: `${built.player}'s line moved ${built.line} → ${line}`});
    const news = leg.grade.capped && leg.grade.matchup?.facts?.find(fact => fact.kind === 'news' && fact.level);
    if (news) items.push({kind: 'news', player: built.player, text: news.text});
    else if (built.tier && leg.grade.tier && built.tier !== leg.grade.tier) items.push({kind: 'tier', player: built.player, text: `${built.player} went from ${cap(built.tier)} to ${cap(leg.grade.tier)}`});
  }
  return {same: Boolean(score?.letter) && score.letter === builder.letter && !items.length, letter: builder.letter, now: score?.letter || null, items};
}
const cap = word => String(word || '').replace(/^./, char => char.toUpperCase());
