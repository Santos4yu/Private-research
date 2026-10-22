// The assistant's breakdown of one play (AcePlays.jsx): the read, the
// matchup, his recent form, the game around it and his role, each with a
// verdict (helps, mixed, hurts) and the numbers behind it in plain
// sentences. Built from the line graded the way Analyze grades one
// (prop-analyze.js gradeProp): `row` carries his games, the game's odds and
// news and (basketball) his minutes and usage; `pick` is the side graded
// (slip-check.js gradeLeg: chance, tier, records, matchup case, model read).
import {TIERS, baselineOf} from './slip-check.js';
import {CUTS} from './slip-matchup.js';
import {familyOf} from './sports/wnba/opportunity.js';
import {MARKET_STAT, baseMarket} from './sports/wnba/wnba-research.js';
import {voice} from './prop-insight.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const one = value => (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '');
const pct = value => `${Math.round(value * 100)}%`;
const lastName = name => String(name || '').split(' ').filter(part => !/^(jr|sr|ii|iii|iv)\.?$/i.test(part)).at(-1) || name;
const sentence = text => {
  const said = String(text || '').trim();
  return said ? `${said[0].toUpperCase()}${said.slice(1)}${/[.!?]$/.test(said) ? '' : '.'}` : '';
};
const join = (items, word = 'and') => items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} ${word} ${items.at(-1)}`;
const capital = text => text ? `${text[0].toUpperCase()}${text.slice(1)}` : text;
// A fact written without its subject ("Averages 37 at home...") gets one.
const subject = text => String(text || '').replace(/^(Averages|Has|Is|Plays|Gets|Takes)\b/, word => `He ${word.toLowerCase()}`);

export const VERDICT_WORDS = {helps: 'Helps', mixed: 'Mixed', hurts: 'Hurts'};
// The name the section goes by, the way it's said in a sentence.
const NAMES = {read: 'the read', matchup: 'the matchup', form: 'his recent form', game: 'the game around it', role: 'his role'};

/** "points + assists" from "Pts+Asts", "rebounds" from "Rebounds". */
function statWords(row) {
  const name = String(row.market || 'this stat').replace(/\bPts\b/gi, 'points').replace(/\bRebs\b/gi, 'rebounds').replace(/\bAsts\b/gi, 'assists')
    .replace(/\s*\+\s*/g, ' + ');
  return /[A-Z]{2}/.test(name) ? name : name.toLowerCase();
}

/** His values in the stat, oldest first. */
const valuesOf = row => (row.gameLog || []).map(game => game.value).filter(finite);

// ---------------------------------------------------------------- form

function form(row, pick) {
  const values = valuesOf(row), line = Number(row.line);
  if (values.length < 3 || !finite(line)) return null;
  const over = pick.side !== 'UNDER';
  const cleared = value => over ? value > line : value < line;
  const last = count => values.slice(-count);
  const l10 = last(10), l5 = last(5), l3 = last(3);
  const [a10, a5, a3] = [mean(l10), mean(l5), mean(l3)];
  const season = row.windows?.season?.average ?? null;
  const won = l10.filter(cleared).length;
  // Straight games on his side of the line, counting back from the last.
  let streak = 0;
  for (let index = values.length - 1; index >= 0 && cleared(values[index]); index -= 1) streak += 1;
  const gap = a10 - line;
  const word = over ? 'over' : 'under';
  const verdict = won / l10.length >= 0.7 && (over ? a5 > line : a5 < line) ? 'helps'
    : won / l10.length <= 0.4 || (over ? a5 < line * 0.92 : a5 > line * 1.08) ? 'hurts' : 'mixed';
  const room = Math.abs(gap) >= Math.max(1, line * 0.15) && Math.sign(gap) === (over ? 1 : -1);
  const lead = verdict === 'hurts'
    ? `He's gone ${word} ${one(line)} in only ${won} of his last ${l10.length}`
    : `He's gone ${word} ${one(line)} in ${won} of his last ${l10.length}${room ? ', with room to spare' : ''}`;
  const body = [];
  // The windows he has games for, longest first, each said once.
  const windows = [...new Set([l10.length, 5, 3].filter(size => size <= values.length))].sort((a, b) => b - a);
  body.push(`His average is ${join(windows.map(size => `${one(mean(last(size)))} over the last ${size}`))}`
    + `${finite(season) ? `, against ${one(season)} for the season` : ''}; the line is ${one(line)}`);
  const change = (a5 - a10) / Math.max(1, a10);
  if (change >= 0.08) body.push(`He's trending up: his last 5 are ${one(a5 - a10)} above his last-10 average`);
  else if (change <= -0.08) body.push(`He's cooled off a little: his last 5 are ${one(a10 - a5)} below his last-10 average`);
  if (streak >= 4) body.push(`That's ${streak} straight games ${word} the line`);
  // One huge game can carry an average: said, with the average without it.
  const spread = Math.sqrt(mean(l10.map(value => (value - a10) ** 2)));
  const peak = Math.max(...l10);
  if (l10.length >= 6 && spread > 0 && peak > a10 + 1.8 * spread && peak > line * 1.5) {
    const index = l10.lastIndexOf(peak), game = (row.gameLog || []).filter(item => finite(item.value)).slice(-10)[index];
    const rest = mean(l10.filter((_, i) => i !== index));
    body.push(`The ${one(peak)}${game?.opponent ? ` against ${game.opponent}` : ''} is an outlier; without it his last-10 average is ${one(rest)}`);
  }
  const floor = over ? Math.min(...l10) : Math.max(...l10);
  if (won === l10.length) body.push(`Even his ${over ? 'quietest' : 'biggest'} game in the last ${l10.length} (${one(floor)}) went ${word}`);
  const takeaway = verdict === 'helps' ? (change <= -0.08 ? 'Cooling a little, but still clear of the line.' : 'The recent games hold up the line.')
    : verdict === 'hurts' ? `His recent games sit ${over ? 'below' : 'above'} the line: the hit rate leans on older games.`
      : 'Close to the line lately: no cushion either way.';
  return {key: 'form', title: 'Recent form', verdict, lead, body, takeaway,
    headline: `he's ${won} of ${l10.length} ${word} it, averaging ${one(a10)}`};
}

// ---------------------------------------------------------------- matchup

function matchup(row, pick) {
  const found = pick.matchup;
  if (!found || !finite(found.score)) return null;
  const cuts = found.cuts || CUTS;
  const verdict = found.score >= cuts.strong ? 'helps' : found.score < cuts.risky ? 'hurts' : 'mixed';
  const opponent = row.opponent || 'Tonight\'s opponent', stat = statWords(row);
  const draw = verdict === 'helps' ? 'a soft draw' : verdict === 'hurts' ? 'a tough draw' : 'about an even draw';
  const lead = `${opponent} is ${draw} for his ${stat}: ${found.score} out of 100 (${found.label.replace(/\s*matchup$/i, '')})`;
  const facts = (found.facts || []).filter(item => item.kind === 'opponent' && item.text);
  const helping = facts.filter(item => item.tone === 'up'), hurting = facts.filter(item => item.tone === 'down');
  const body = [];
  for (const item of [...helping, ...facts.filter(item => item.tone === 'flat')].slice(0, 3)) body.push(item.text);
  if (hurting.length) body.push(`Working against it: ${hurting.slice(0, 2).map(item => item.text.replace(/^[A-Z](?=[a-z])/, letter => letter.toLowerCase())).join('; ')}`);
  const history = (found.facts || []).find(item => item.kind === 'history' && item.text);
  const h2h = pick.records?.h2h;
  if (h2h?.games) body.push(`Against ${opponent} he's gone ${pick.side === 'UNDER' ? 'under' : 'over'} this line in ${h2h.won} of ${h2h.games} games`);
  else if (history) body.push(`His games against them: ${history.text.replace(/^[A-Z](?=[a-z])/, letter => letter.toLowerCase())}`);
  const takeaway = verdict === 'helps' ? (hurting.length ? 'Soft overall, with a spot or two that pushes back.' : 'Soft across the board.')
    : verdict === 'hurts' ? (helping.length ? 'A tough defense, with a crack or two.' : 'One of the tougher defenses for this stat.')
      : 'Nothing here moves the line much either way.';
  return {key: 'matchup', title: 'Matchup', verdict, lead, body, takeaway,
    headline: `${opponent} grades ${found.score} out of 100 for it`};
}

// ---------------------------------------------------------------- the game

const SCORING = new Set(['points', 'assists', 'threes', 'combo', 'general']);

function game(row, pick, stat) {
  const odds = row.game?.state === 'pre' || !row.game?.state ? row.game?.odds : null;
  const team = row.game?.team || row.teamAbbr;
  const total = odds?.total, spread = odds?.spread?.[team];
  const facts = pick.matchup?.facts || [];
  const pace = facts.find(item => /pace$/.test(item.key) && item.text);
  const rest = facts.filter(item => item.kind === 'rest' && item.text);
  const venue = facts.find(item => item.key === 'venue' && item.text);
  if (!finite(total) && !finite(spread) && !pace && !rest.length && !venue) return null;
  const scoring = SCORING.has(familyOf(stat));
  let lean = 0;
  const body = [];
  const normal = row.scoring?.normal;
  if (finite(total) && scoring && finite(normal) && normal > 0) {
    const ratio = total / (2 * normal);
    lean += ratio >= 1.02 ? 1 : ratio <= 0.98 ? -1 : 0;
    body.push(`The total is ${one(total)} against a usual ${one(2 * normal)}: ${ratio >= 1.02 ? 'a high-scoring game' : ratio <= 0.98 ? 'a lower-scoring game' : 'about a normal game'}`);
  } else if (finite(total)) body.push(`The total is ${one(total)}`);
  if (pace) {
    lean += pace.tone === 'up' ? 1 : pace.tone === 'down' ? -1 : 0;
    body.push(pace.text);
  }
  if (finite(spread)) {
    const size = Math.abs(spread);
    if (size >= 10) {
      lean -= 1;
      body.push(`${team} ${spread < 0 ? 'are favored' : 'are getting'} by ${one(size)}: if it gets lopsided, starters can sit the fourth quarter`);
    } else body.push(`${team} ${spread < 0 ? 'are favored by' : spread > 0 ? 'are getting' : 'are even at'} ${spread ? one(size) : 'a pick\'em'}${size <= 4 ? ': a close game keeps the starters on the floor' : ''}`);
  }
  for (const item of rest) {
    lean += item.tone === 'up' ? 1 : item.tone === 'down' ? -1 : 0;
    body.push(item.text);
  }
  if (venue) body.push(subject(venue.text));
  const verdict = lean >= 1 ? 'helps' : lean <= -1 ? 'hurts' : 'mixed';
  const lead = verdict === 'helps' ? 'The game sets up for volume' : verdict === 'hurts' ? 'The game itself is a drag on the line' : 'The game is a wash for this line';
  const takeaway = verdict === 'helps' ? 'A tailwind, not the whole case.' : verdict === 'hurts' ? 'Worth keeping in mind next to the rest.' : 'Neither a push nor a drag.';
  return {key: 'game', title: 'The game', verdict, lead, body, takeaway,
    headline: verdict === 'helps' ? 'the game sets up for volume' : verdict === 'hurts' ? 'the game setup drags on it' : null};
}

// ---------------------------------------------------------------- role

function role(row, pick, stat) {
  const chances = row.opportunity?.chances, season = chances?.szn, recent = chances?.l10;
  const facts = pick.matchup?.facts || [];
  const out = facts.find(item => item.key === 'teammate-out' && item.text);
  const usageFacts = facts.filter(item => item.kind === 'usage' && item.key !== 'opportunity' && item.text);
  if (!season && !out && !usageFacts.length) return null;
  const body = [];
  let lean = 0;
  let lead = null;
  if (season && recent && finite(season.min) && finite(recent.min)) {
    const minutes = recent.min - season.min, usage = finite(recent.usage) && finite(season.usage) ? recent.usage - season.usage : null;
    lean += minutes >= 2 ? 1 : minutes <= -2 ? -1 : 0;
    if (finite(usage)) lean += usage >= 1.5 ? 1 : usage <= -1.5 ? -1 : 0;
    const usageWords = finite(usage) ? ` and ${one(recent.usage)}% usage` : '';
    const seasonWords = finite(usage) ? `${one(season.min)} and ${one(season.usage)}%` : one(season.min);
    lead = lean >= 1 ? `His role has grown: ${one(recent.min)} minutes${usageWords} over his last 10, up from ${seasonWords} for the season`
      : lean <= -1 ? `His role has shrunk: ${one(recent.min)} minutes${usageWords} over his last 10, down from ${seasonWords} for the season`
        : `His role is steady: ${one(recent.min)} minutes${usageWords} over his last 10 (${seasonWords} for the season)`;
    if (finite(usage)) body.push('Usage is the share of his team\'s plays that end with his shot, free-throw trip or turnover while he\'s on the floor');
  } else if (season && finite(season.min)) lead = `He's playing ${one(season.min)} minutes a game this season`;
  const family = familyOf(stat), parts = stat === 'pa' || stat === 'pra' || stat === 'ra' || family === 'assists' ? ['ast'] : [];
  const tracking = row.opportunity?.tracking?.available ? row.opportunity.tracking : null;
  if (season) {
    if ((family === 'points' || family === 'combo') && finite(season.fga)) body.push(`He takes ${one(recent?.fga ?? season.fga)} shots a game${finite(recent?.fga) ? ` lately (${one(season.fga)} for the season)` : ''}`);
    if (family === 'threes' && finite(season.tpa)) body.push(`He takes ${one(recent?.tpa ?? season.tpa)} threes a game${finite(season.tpPct) ? ` and makes ${one(season.tpPct)}%` : ''}`);
    if ((family === 'rebounds' || stat === 'pr' || stat === 'ra' || stat === 'pra') && finite(season.rebShare)) body.push(`He grabs ${one(recent?.rebShare ?? season.rebShare)}% of the rebounds available while he plays`);
    if (parts.length && finite(season.astShare)) body.push(`He assists ${one(recent?.astShare ?? season.astShare)}% of his teammates' baskets while he plays`);
    const shots = season.fga + 0.44 * (season.fta || 0);
    const ts = finite(season.pts) && shots > 0 ? season.pts / (2 * shots) * 100 : null;
    if (finite(ts) && (family === 'points' || family === 'combo')) {
      if (ts < 54) { lean -= 0.5; body.push(`His shooting is modest (${one(ts)}% true shooting), so the volume doesn't promise clean scoring`); }
      else if (ts >= 60) body.push(`He's efficient with it: ${one(ts)}% true shooting`);
    }
  }
  if (tracking) {
    const passing = tracking.recent?.passing || tracking.passing, boards = tracking.recent?.rebounding || tracking.rebounding;
    if (parts.length && finite(passing?.potentialAst)) body.push(`The NBA's tracking has him at ${one(passing.potentialAst)} potential assists a game (passes a teammate shot off)`);
    if ((family === 'rebounds' || stat === 'pr' || stat === 'ra' || stat === 'pra') && finite(boards?.chances)) body.push(`He's around ${one(boards.chances)} rebound chances a game by the NBA's tracking`);
  }
  if (out) { lean += out.tone === 'up' ? 1 : out.tone === 'down' ? -1 : 0; body.push(out.text); }
  for (const item of usageFacts.slice(0, 2)) { lean += item.tone === 'up' ? 0.5 : item.tone === 'down' ? -0.5 : 0; body.push(item.text); }
  const verdict = lean >= 1 ? 'helps' : lean <= -1 ? 'hurts' : 'mixed';
  if (!lead) lead = verdict === 'helps' ? 'His role is pointing up' : verdict === 'hurts' ? 'His role is shrinking' : 'His role is steady';
  const takeaway = verdict === 'helps' ? 'More time and more of the ball: the line has a real base under it.'
    : verdict === 'hurts' ? 'Less time or less of the ball makes the line harder to reach.' : 'The same role he\'s had: the line rests on the rest.';
  return {key: 'role', title: 'Role & minutes', verdict, lead, body, takeaway,
    headline: verdict === 'helps' ? 'his minutes and usage are up' : verdict === 'hurts' ? 'his role has shrunk' : null};
}

// ---------------------------------------------------------------- the read

function read(row, pick, parts) {
  const tier = TIERS[pick.tier];
  if (!tier || !finite(pick.chance)) return null;
  const verdict = pick.tier === 'elite' || pick.tier === 'strong' ? 'helps' : pick.tier === 'lean' ? 'mixed' : 'hurts';
  const side = pick.side === 'UNDER' ? 'Less' : 'More';
  const need = baselineOf(pick), edge = pick.chance - need;
  const lead = `${side} ${one(Number(row.line))} ${statWords(row)}: ${tier.label}. We have it at ${pct(pick.chance)} to hit`
    + (Math.abs(edge) >= 0.01 ? `, ${Math.round(Math.abs(edge) * 100)} points ${edge > 0 ? 'better' : 'worse'} than the ${pct(need)} this line needs` : `, right at the ${pct(need)} it needs`);
  const body = [];
  const helping = parts.filter(part => part.verdict === 'helps' && part.headline).map(part => part.headline);
  if (helping.length) body.push(`Going for it: ${join(helping)}`);
  const projection = pick.read?.projection;
  if (finite(projection)) body.push(`PropScout projects ${one(projection)} against the ${one(Number(row.line))} line`);
  if (finite(pick.book)) body.push(`The books have the ${pick.side === 'UNDER' ? 'under' : 'over'} at about ${pct(pick.book)}`);
  if (pick.redFlag) body.push(`Red flag: ${pick.redFlag}`);
  const good = parts.filter(part => part.verdict === 'helps').map(part => NAMES[part.key]);
  const bad = parts.filter(part => part.verdict === 'hurts').map(part => NAMES[part.key]);
  const takeaway = good.length && bad.length ? `${capital(join(good))} back it; ${join(bad)} ${bad.length === 1 ? 'is' : 'are'} the thing to watch.`
    : good.length ? `${capital(join(good))} ${good.length === 1 ? 'backs it' : 'all point the same way'}.`
      : bad.length ? `${capital(join(bad))} ${bad.length === 1 ? 'is' : 'are'} working against it.` : `${tier.text}.`;
  return {key: 'read', title: 'The read', verdict, lead, body, takeaway};
}

/**
 * The breakdown of one play: [{key, title, verdict, label, lead, body,
 * takeaway}], the read first. Sections with nothing to say are left out.
 * A WNBA player is spoken of as she is (prop-insight.js voice).
 */
export function playBreakdown(row, pick) {
  if (!row || !pick) return [];
  const stat = MARKET_STAT[baseMarket(row.marketKey)] || 'pts';
  const parts = [matchup(row, pick), form(row, pick), game(row, pick, stat), role(row, pick, stat)].filter(Boolean);
  const top = read(row, pick, parts);
  const said = text => voice(sentence(text), row);
  return [top, ...parts].filter(Boolean).map(({headline, ...part}) => ({...part, label: VERDICT_WORDS[part.verdict],
    lead: said(part.lead), body: part.body.map(said).filter(Boolean), takeaway: voice(part.takeaway, row)}));
}

export {lastName};
