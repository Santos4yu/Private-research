// Which PrizePicks lines a Props tab list shows (nba-props-data.js,
// nfl-props-data.js), one per player, stat and kind of line: the standard
// line, the Goblin nearest it (the highest) and the Demon nearest it (the
// lowest). The list's Lines filter (MatchupList.jsx) picks which kinds show.
// Oct 25, the owner: a way to see only regular lines, or quick Goblins, or
// Demons. Before, Goblins never showed and a Demon only where no standard
// line was posted; mainLines() keeps that rule for the track record, so its
// rates stay comparable.
export const tierOf = row => String(row?.modifier || 'standard').toLowerCase();
export const TIERS = ['standard', 'goblin', 'demon'];
export const listedTier = row => TIERS.includes(tierOf(row));

const groupBy = (rows, keyOf) => {
  const groups = new Map();
  for (const row of rows || []) {
    if (!listedTier(row)) continue;
    const key = keyOf(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
};
const statKey = row => `${row.playerId || row.player}|${row.teamAbbr || ''}|${row.marketKey}|${row.startsAt || ''}`;
// The one nearest a standard line: the highest Goblin, the lowest Demon.
const nearest = group => group.reduce((best, row) => (tierOf(row) === 'goblin' ? Number(row.line) > Number(best.line) : Number(row.line) < Number(best.line)) ? row : best);

export function pickLines(rows) {
  const kept = new Set();
  for (const group of groupBy(rows, row => `${statKey(row)}|${tierOf(row)}`).values()) {
    if (tierOf(group[0]) === 'standard') group.forEach(row => kept.add(row));
    else kept.add(nearest(group));
  }
  return (rows || []).filter(row => kept.has(row));
}

/** The line a stat was shown at before the filter: standard, else its lowest Demon; never a Goblin. */
export function mainLines(rows) {
  const kept = new Set();
  for (const group of groupBy((rows || []).filter(row => tierOf(row) !== 'goblin'), statKey).values()) {
    const standard = group.filter(row => tierOf(row) === 'standard');
    if (standard.length) standard.forEach(row => kept.add(row));
    else kept.add(nearest(group));
  }
  return (rows || []).filter(row => kept.has(row));
}
