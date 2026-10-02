// Only qualifying, currently available bets belong in Top plays. A projected
// winner or an unavailable watch price must never masquerade as one.
export const PLAY_TIERS = new Set(['elite', 'strong', 'play']);
export const isMoneylinePlay = game => PLAY_TIERS.has(game?.pick?.tier) && game.pick.units > 0;
export function topMoneylines(games = []) {
 return games.filter(isMoneylinePlay).slice().sort((a,b) =>
  (b.pick.score ?? 0) - (a.pick.score ?? 0)
  || (b.pick.probability ?? 0) - (a.pick.probability ?? 0)
  || (b.pick.conservativeEv ?? 0) - (a.pick.conservativeEv ?? 0)
  || String(a.startsAt).localeCompare(String(b.startsAt)));
}
