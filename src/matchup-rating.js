// Null/empty API fields are missing evidence, never zero-rated matchups.
export const MATCHUP_VERSION = 'krazy-matchup-2026-09-19';

export function canReuseResearch(prop, now = Date.now()) {
  const age = now - new Date(prop?.matchupContext?.updatedAt || '').getTime();
  return prop?.matchupVersion === MATCHUP_VERSION && Number.isFinite(age) && age >= 0 && age < 180000;
}

export function matchupNumber(value) {
  if (value == null || typeof value === 'boolean' || String(value).trim() === '') return NaN;
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 100 ? score : NaN;
}

export function boardResearchSide(prop) {
  return String(prop?.stats?.side || prop?.side || '').toLowerCase() === 'under' ? 'Under' : 'Over';
}

export function matchupUpdatedText(context) {
  const date = new Date(context?.updatedAt || '');
  if (!Number.isFinite(date.getTime())) return '';
  return `Rated ${date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
}
