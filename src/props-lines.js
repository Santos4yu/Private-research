// Which PrizePicks lines a Props tab list shows (nba-props-data.js,
// nfl-props-data.js), one per player and stat: the standard line; where
// PrizePicks posts the stat only as Demons, the lowest Demon (the nearest to
// a standard line, marked Demon on the list); never a Goblin.
export const tierOf = row => String(row?.modifier || 'standard').toLowerCase();
export const listedTier = row => tierOf(row) === 'standard' || tierOf(row) === 'demon';

export function pickLines(rows) {
  const groups = new Map();
  for (const row of rows || []) {
    if (!listedTier(row)) continue;
    const key = `${row.playerId || row.player}|${row.teamAbbr || ''}|${row.marketKey}|${row.startsAt || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const kept = new Set();
  for (const group of groups.values()) {
    const standard = group.filter(row => tierOf(row) === 'standard');
    if (standard.length) standard.forEach(row => kept.add(row));
    else kept.add(group.reduce((low, row) => (Number(row.line) < Number(low.line) ? row : low)));
  }
  return (rows || []).filter(row => kept.has(row));
}
