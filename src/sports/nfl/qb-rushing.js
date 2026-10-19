// A quarterback's runs for the player page's QB rushing card, from
// /api/nfl?resource=finder-qb-rush (nfl_scouting.py qb_rush): his season
// summed up, and how to say where a defense ranks.

// The lines the card is for: anything a quarterback's running moves.
export const QB_RUSH_MARKETS = new Set(['rushing_yards', 'rush_attempts', 'longest_rush', 'passing_rushing_yards', 'rush_yards_first_5',
  'first_rush_yards', 'quarters_5_rush_yds', 'halves_25_rush_yds', 'rushing_receiving_yards']);
// A game he played, not a relief series (nfl_scouting.py START_DROPBACKS).
export const START_DROPBACKS = 10;

const number = value => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** His season over the games he played: totals, plus the pressure he faced in the games the advanced stats cover. */
export function qbSeason(player) {
  const games = (player?.games || []).filter(game => number(game.dropbacks) >= START_DROPBACKS);
  if (!games.length) return null;
  const sum = (key, list = games) => list.reduce((total, game) => total + number(game[key]), 0);
  const graded = games.filter(game => typeof game.pressured === 'number');
  const charted = games.filter(game => game.underPressure);
  const under = key => charted.reduce((total, game) => total + number(game.underPressure[key]), 0);
  // Nested counts (against the blitz, in a close game...) added up.
  const part = (key, field) => games.reduce((total, game) => total + number(game[key]?.[field]), 0);
  const rate = (key, top, bottom, minimum) => (part(key, bottom) >= minimum ? part(key, top) / part(key, bottom) : null);
  return {
    games: games.length, rows: games,
    scrambles: sum('scrambles'), scrambleYards: sum('scrambleYards'),
    designed: sum('designed'), designedYards: sum('designedYards'), sneaks: sum('sneaks'),
    kneels: sum('kneels'), kneelYards: sum('kneelYards'), dropbacks: sum('dropbacks'),
    pressured: sum('pressured', graded), pressuredGames: graded.length,
    pressureRate: sum('dropbacks', graded) ? sum('pressured', graded) / sum('dropbacks', graded) : null,
    under: charted.length ? {games: charted.length, dropbacks: under('dropbacks'), scrambles: under('scrambles'), yards: under('yards')} : null,
    // Scrambles a dropback against the blitz and without it (FTN charting).
    vsBlitz: rate('vsBlitz', 'scrambles', 'dropbacks', 20), noBlitz: rate('noBlitz', 'scrambles', 'dropbacks', 40),
    blitzedDropbacks: part('vsBlitz', 'dropbacks'),
    // Games with a 10+ yard scramble, and his longest.
    longGames: games.filter(game => number(game.long) > 0).length,
    longest: games.reduce((most, game) => Math.max(most, number(game.longest)), 0),
    // Runs a play within one score and otherwise.
    close: rate('close', 'runs', 'plays', 60), other: rate('other', 'runs', 'plays', 40),
  };
}

const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : {1: 'st', 2: 'nd', 3: 'rd'}[n % 10] || 'th'}`;

/** '6th most', 'the fewest', or '15th of 32' in the middle. Rank 1 is the most. */
export function rankWords(rank, count, near = 10, {most = 'most', fewest: few = 'fewest'} = {}) {
  if (!rank || !count) return '';
  if (rank <= near) return rank === 1 ? `the ${most}` : `${ordinal(rank)} ${most}`;
  const fewest = count - rank + 1;
  if (fewest <= near) return fewest === 1 ? `the ${few}` : `${ordinal(fewest)} ${few}`;
  return `${ordinal(rank)} of ${count}`;
}

/** '2026_07_SF_WAS' -> 7. */
export const weekOf = gameId => {
  const week = Number(String(gameId || '').split('_')[1]);
  return Number.isInteger(week) && week > 0 ? week : null;
};

/** Whether a rank helps his rushing line ('good'), hurts it ('poor') or neither. */
export function rankTone(rank, count, moreHelps = true, edge = 8) {
  if (!rank || !count) return 'neutral';
  const top = rank <= edge, bottom = count - rank + 1 <= edge;
  if (!top && !bottom) return 'neutral';
  return top === moreHelps ? 'good' : 'poor';
}
