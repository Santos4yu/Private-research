// Whether an NBA player is in his team's starting five, as the Props list and
// his matchup page show it: from the team's rotation in the league numbers
// (backend/sports/wnba/context.py rotation), the five who started the team's
// last game and are still on it, topped up from whoever started his own
// latest game. That's who started last time, not tonight's announced lineup
// (out about half an hour before tip-off). Null when the rotation doesn't
// list him (a league without one, like the NFL's, or no games yet).
// "Jaime Jaquez Jr." and "Jaime Jaquez" are one player (Oct 26: the props
// line's name had no "Jr.", so he wasn't found and read as unknown). A
// starter who sat the team's last game out (rest, a back-to-back) is still a
// starter (Oct 26, Kyrie Irving read as bench): `sat` says so.
const nameKey = name => String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[.'’-]/g, ' ').replace(/\b(jr|sr|ii|iii|iv|v)\b/g, ' ').replace(/\s+/g, ' ').trim();
export function rotationPlayer(row, league) {
  const players = league?.rotation?.[row?.teamAbbr]?.players;
  if (!Array.isArray(players)) return null;
  return players.find(item => row?.playerId != null && String(item.id) === String(row.playerId))
    || (row?.player ? players.find(item => nameKey(item.name) && nameKey(item.name) === nameKey(row.player)) : null) || null;
}
export function lineupRole(row, league) {
  const player = rotationPlayer(row, league);
  const games = Number(player?.games) || 0;
  if (!player || !games) return null;
  const starts = Math.min(games, Number(player.starts) || 0);
  // Back after missing the team's last three or more, having started most of
  // his own games before: whether he starts tonight isn't known, so neither.
  if (!player.lastStart && player.last3 === false && starts * 2 > games) return null;
  const sat = Boolean(player.lastStart) && player.playedLast === false;
  return {starter: Boolean(player.lastStart), label: player.lastStart ? 'Starter' : 'Bench', starts, games, sat,
    text: `${player.lastStart ? 'In his team’s starting five' : 'Off the bench'}: started ${starts} of his last ${games} ${games === 1 ? 'game' : 'games'}${sat ? ' (he sat out the team’s last one)' : ''}`};
}
