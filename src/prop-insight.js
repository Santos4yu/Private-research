// The Finder's Analyze, in words: one line read both ways the way the Slip
// Analyzer reads a pick (slip-check.js gradeLeg), the side to take (Overs
// first: an Under only when every read agrees, as everywhere else), its
// tier, and why -- a short write-up, what's for it, what could go wrong,
// the matchup and the numbers. Every sentence comes from a number on the
// player's page or the matchup case the Slip Analyzer shows.
import {TIERS, confidentUnder} from './slip-check.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const percent = value => `${Math.round(value * 100)}%`;
const figure = value => Number.isInteger(value) ? String(value) : (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '');
const price = value => (value > 0 ? '+' : '−') + Math.abs(Math.round(value));
const SUFFIX = /^(jr|sr|ii|iii|iv|v)\.?$/i;
const lastName = name => String(name || '').trim().split(/\s+/).filter(part => !SUFFIX.test(part)).at(-1) || String(name || '');
const statWord = row => {
  const name = String(row.market || 'this stat').replace(/^pitcher\s+/i, '');
  return /[A-Z]{2}|\+/.test(name) ? name : name.toLowerCase();
};
const capital = text => text ? text[0].toUpperCase() + text.slice(1) : text;
const sentence = text => {
  const trimmed = String(text || '').trim();
  return !trimmed ? '' : /[.!?]$/.test(trimmed) ? capital(trimmed) : `${capital(trimmed)}.`;
};
// A list item: capitalised, no closing full stop.
const bullet = text => capital(String(text || '').trim().replace(/\.$/, ''));
const rank = judged => judged?.tier ? TIERS[judged.tier].rank : 0;

export const SIDE_WORDS = {OVER: 'More', UNDER: 'Less'};
// Facts said in their own section of the sheet (the opportunity read), not again in the lists.
const OWN_SECTION = new Set(['opportunity', 'teammate-out']);

/** The matchup case's words, for a WNBA player in her own pronouns. */
export function voice(text, row) {
  if (row?.sport !== 'wnba' || !text) return text;
  const swap = {his: 'her', him: 'her', he: 'she', himself: 'herself'};
  return text.replace(/\b(his|him|he|himself)\b/gi, word => {
    const next = swap[word.toLowerCase()];
    return word[0] === word[0].toUpperCase() ? capital(next) : next;
  });
}

/**
 * Which side to take: the More unless the Less grades higher and clears
 * the Slip Analyzer's bar for an Under (confidentUnder). `other` is the
 * side not taken.
 */
export function chooseSide(over, under) {
  const underCounts = Boolean(under && confidentUnder(under));
  let pick = over || (underCounts ? under : null);
  if (underCounts && (!over || rank(under) > rank(over) || (rank(under) === rank(over) && under.chance > over.chance))) pick = under;
  if (!pick) pick = under || null;
  return {pick, other: pick === over ? under : over};
}

// What each tier says at the top, and whether it's one to play.
export const VERDICTS = {
  elite: {emoji: '🔥', word: 'Elite play', play: true},
  strong: {emoji: '✅', word: 'Strong play', play: true},
  lean: {emoji: '👍', word: 'Lean', play: true},
  risky: {emoji: '⚠️', word: 'Risky', play: false},
  fade: {emoji: '🧊', word: 'Fade', play: false},
};

// A matchup fact's icon, by what it's about.
function iconOf(item) {
  if (item.key === 'weather') return 'weather';
  if (item.kind === 'news') return 'news';
  if (item.kind === 'opponent') return 'defense';
  if (item.kind === 'usage') return 'usage';
  if (item.kind === 'history') return 'history';
  if (item.kind === 'split' || item.kind === 'venue') return 'venue';
  return 'form';
}

const record = (label, entry) => entry && entry.games ? {label, value: `${entry.won}/${entry.games}`, rate: entry.rate} : null;

/** The recent values in the stat, oldest first, as "5, 4 and 6". */
function lastValues(row, count = 3) {
  const values = (row.gameLog || []).filter(game => finite(game.value)).slice(-count).map(game => figure(game.value));
  if (values.length < 2) return null;
  return `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`;
}

/** The books on this side, in a sentence and as a reason or a risk. */
function booksRead(judged) {
  if (!finite(judged.book)) return null;
  const word = judged.side === 'UNDER' ? 'under' : 'over';
  const quoted = judged.price ? `${judged.price.book} has the ${word} at ${price(judged.price.price)}` : null;
  if (judged.book >= 0.54) return {tone: 'up', text: `The books agree${quoted ? `: ${quoted}` : ''}, about ${percent(judged.book)} after the vig`,
    short: `Books give it ${percent(judged.book)}${quoted ? ` (${quoted})` : ''}`};
  if (judged.book <= 0.47) return {tone: 'down', text: `The books lean the other way, giving the ${word} only ${percent(judged.book)}${quoted ? ` (${quoted})` : ''}`,
    short: `Books give it only ${percent(judged.book)}`};
  return {tone: 'flat', text: `The books have it close to a coin flip at ${percent(judged.book)}`, short: `Books: ${percent(judged.book)}`};
}

/** The write-up: the strongest points first, in a few plain sentences. */
function writeup(row, judged, other, verdict) {
  const side = judged.side, word = side === 'UNDER' ? 'under' : 'over';
  const stat = statWord(row), line = figure(row.line);
  const records = judged.records || {};
  const recent = records.l10 || records.l5;
  const facts = judged.matchup?.facts || [];
  const out = [];
  if (recent) {
    const average = row.windows?.l10?.average ?? row.average;
    const seen = lastValues(row);
    out.push(`${row.player} has gone ${word} ${line} ${stat} in ${recent.won} of the last ${recent.games} games`
      + `${finite(average) ? `, averaging ${figure(average)}` : ''}${seen ? ` (${seen} in the last three)` : ''}`);
  } else if (records.season) out.push(`${row.player} has gone ${word} ${line} ${stat} in ${records.season.won} of ${records.season.games} games this season`);
  const projection = judged.read?.projection;
  if (finite(projection) && finite(row.line)) {
    const gap = projection - row.line;
    out.push(Math.abs(gap) < 0.05 ? `PropScout projects ${figure(projection)}, right on the line`
      : `PropScout projects ${figure(projection)}, ${figure(Math.abs(gap))} ${gap > 0 ? 'above' : 'below'} the ${line} line`);
  }
  // The matchup point that matters most for the verdict: what helps a play,
  // what hurts one to pass on.
  const wanted = verdict.play ? 'up' : 'down';
  const matchup = facts.filter(item => item.kind === 'opponent' && (item.tone === wanted || (!verdict.play && item.tone === 'warn')))
    .sort((a, b) => Boolean(b.primary) - Boolean(a.primary) || Math.abs(b.impact) - Math.abs(a.impact))[0];
  if (matchup) out.push(`${verdict.play ? 'On top of that, ' : 'And the matchup doesn\'t help: '}${voice(matchup.text, row)}`);
  const usage = facts.find(item => item.kind === 'usage' && !OWN_SECTION.has(item.key) && item.tone === wanted);
  if (usage) out.push(`${verdict.play ? 'Plus, ' : ''}${voice(usage.text, row)}`);
  const books = booksRead(judged);
  if (books) out.push(books.text);
  const news = facts.find(item => item.kind === 'news' && item.level && !OWN_SECTION.has(item.key));
  if (news) out.push(voice(news.text, row));
  if (verdict.play) out.push(`${TIERS[judged.tier].text}.`);
  else {
    const better = other && rank(other) >= TIERS.lean.rank;
    const held = better && other.side === 'UNDER' && !confidentUnder(other);
    out.push(held ? `The Less grades higher (${percent(other.chance)}), but an Under is only backed when every read agrees, and these don't. Better to sit this one out.`
      : better ? `If anything, the ${SIDE_WORDS[other.side]} grades better (${TIERS[other.tier].label}, ${percent(other.chance)}).`
        : 'Better to sit this one out.');
  }
  return out.map(sentence).filter(Boolean);
}

/** What's going for the side, strongest first. */
function reasonsFor(row, judged) {
  const out = [];
  const add = (icon, text) => { const said = bullet(text); if (said && !out.some(item => item.text === said)) out.push({icon, text: said}); };
  const word = judged.side === 'UNDER' ? 'under' : 'over';
  const records = judged.records || {};
  const recent = records.l10 || records.l5;
  if (recent && recent.rate >= 0.6) add('form', `${recent.won} of the last ${recent.games} ${word} ${figure(row.line)}`);
  if (records.season && records.season.games >= 8 && records.season.rate >= 0.58) add('form', `${records.season.won} of ${records.season.games} ${word} this season`);
  const projection = judged.read?.projection;
  if (finite(projection) && finite(row.line) && (judged.side === 'UNDER' ? projection < row.line : projection > row.line))
    add('projection', `Projects for ${figure(projection)} against the ${figure(row.line)} line`);
  for (const item of judged.matchup?.facts || []) if (item.tone === 'up' && item.kind !== 'form' && !OWN_SECTION.has(item.key)) add(iconOf(item), voice(item.text, row));
  const books = booksRead(judged);
  if (books?.tone === 'up') add('books', books.short);
  return out.slice(0, 5);
}

/** What could go wrong: the read's risks, the matchup against it, the books. */
function risksFor(row, judged) {
  const out = [];
  const add = (icon, text) => {
    const said = bullet(voice(text, row));
    if (said && !out.some(item => item.text.toLowerCase() === said.toLowerCase())) out.push({icon, text: said});
  };
  for (const item of judged.matchup?.facts || []) if ((item.tone === 'down' || item.tone === 'warn') && item.kind !== 'form' && !OWN_SECTION.has(item.key)) add(iconOf(item), item.text);
  const opponentSaid = (judged.matchup?.facts || []).some(item => item.kind === 'opponent' && (item.tone === 'down' || item.tone === 'warn'));
  for (const risk of judged.read?.risks || []) {
    if (/^Tough matchup: /.test(risk) && opponentSaid) continue;
    add(/matchup/i.test(risk) ? 'defense' : 'risk', risk.replace(/^Tough matchup: /, ''));
  }
  const books = booksRead(judged);
  if (books?.tone === 'down') add('books', books.short);
  const records = judged.records || {};
  if (records.l5 && records.l5.games >= 5 && records.l5.rate <= 0.4) add('form', `Only ${records.l5.won} of the last 5 ${judged.side === 'UNDER' ? 'under' : 'over'}`);
  return out.slice(0, 4);
}

/**
 * The Analyze write-up for one line: `over` and `under` are its two sides
 * graded (slip-check.js gradeLeg, either may be null). Null when neither
 * side could be graded.
 */
export function buildInsight(row, over, under) {
  const {pick, other} = chooseSide(over, under);
  if (!pick?.tier) return null;
  const verdict = VERDICTS[pick.tier];
  const side = SIDE_WORDS[pick.side];
  const records = pick.records || {};
  const average = row.windows?.l10?.average ?? row.average;
  const numbers = [record('L5', records.l5), record('L10', records.l10), record('L20', records.l20), record('Season', records.season),
    record('H2H', records.h2h),
    finite(average) ? {label: 'Avg L10', value: figure(average), rate: null} : null,
    finite(pick.read?.projection) ? {label: 'Projection', value: figure(pick.read.projection), rate: null} : null,
    finite(pick.book) ? {label: 'Books', value: percent(pick.book), rate: pick.book} : null].filter(Boolean);
  const matchup = pick.matchup ? {score: pick.matchup.score, label: pick.matchup.label, tone: pick.matchup.tone,
    facts: pick.matchup.facts.filter(item => item.kind !== 'form' && !OWN_SECTION.has(item.key)).slice(0, 5).map(item => ({icon: iconOf(item), tone: item.tone, text: bullet(voice(item.text, row))}))} : null;
  // Whether the chances behind the line are there, not just the hit rate (basketball: opportunity.js).
  const read = (pick.matchup?.facts || []).find(item => item.key === 'opportunity')?.read;
  const opportunity = read ? {verdict: read.verdict, title: voice(read.title, row), text: voice(read.text, row),
    points: read.points.map(item => ({icon: 'usage', tone: item.tone, text: bullet(voice(item.text, row))}))} : null;
  const pass = !verdict.play;
  return {
    player: row.player, side: pick.side, sideWord: side, line: row.line, market: row.market, tier: pick.tier,
    tierLabel: TIERS[pick.tier].label, tierText: TIERS[pick.tier].text, chance: pick.chance, edge: pick.chance - 0.5,
    verdict: {...verdict, title: pass ? (pick.tier === 'fade' ? `Fade the ${side}` : `Risky on the ${side}`) : `${verdict.word}: ${side} ${figure(row.line)}`,
      subtitle: pass ? `${side} ${figure(row.line)} ${row.market}: the numbers don't back it` : `${row.market} · ${percent(pick.chance)} to hit`},
    summary: writeup(row, pick, other, verdict),
    reasons: reasonsFor(row, pick),
    risks: risksFor(row, pick),
    matchup, numbers, opportunity,
    other: other?.tier ? {side: other.side, sideWord: SIDE_WORDS[other.side], tier: other.tier, tierLabel: TIERS[other.tier].label, chance: other.chance,
      held: other.side === 'UNDER' && rank(other) >= TIERS.lean.rank && !confidentUnder(other)} : null,
  };
}

export {lastName};
