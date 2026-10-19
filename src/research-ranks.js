// How a rank is said and coloured on the research cards (the QB rushing
// card, basketball's opportunity card): rank 1 is the most.

const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : {1: 'st', 2: 'nd', 3: 'rd'}[n % 10] || 'th'}`;

/** '6th most', 'the fewest', or '15th of 32' in the middle. Rank 1 is the most. */
export function rankWords(rank, count, near = 10, {most = 'most', fewest: few = 'fewest'} = {}) {
  if (!rank || !count) return '';
  if (rank <= near) return rank === 1 ? `the ${most}` : `${ordinal(rank)} ${most}`;
  const fewest = count - rank + 1;
  if (fewest <= near) return fewest === 1 ? `the ${few}` : `${ordinal(fewest)} ${few}`;
  return `${ordinal(rank)} of ${count}`;
}

/** Whether a rank helps the line ('good'), hurts it ('poor') or neither. */
export function rankTone(rank, count, moreHelps = true, edge = 8) {
  if (!rank || !count) return 'neutral';
  const top = rank <= edge, bottom = count - rank + 1 <= edge;
  if (!top && !bottom) return 'neutral';
  return top === moreHelps ? 'good' : 'poor';
}
