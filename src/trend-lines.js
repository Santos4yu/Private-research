// What the trend chart's stat chips show under each stat: the player's
// posted line in it (a regular line before a Goblin or Demon), or nothing.
const standard = row => String(row?.modifier || 'standard').toLowerCase() === 'standard';

export function postedLine(rows, marketKey) {
  const lines = (rows || []).filter(row => row?.marketKey === marketKey && Number.isFinite(Number(row.line)));
  const pick = lines.find(standard) || lines[0];
  return pick ? Number(pick.line) : null;
}

/** Stat tabs with each one's posted line. */
export const withLines = (tabs, rows) => (tabs || []).map(tab => ({...tab, line: postedLine(rows, tab.key)}));
