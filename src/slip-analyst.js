// The Smart Slip's analyst: reads one pick the way someone researching it
// by hand would. Where do the player's games sit against the line? What
// does today's opponent allow (or, in MLB, who is pitching)? Home or away,
// head-to-head, is the playing time going up or down, is it a
// back-to-back? From that it projects the stat, turns the projection into
// a chance of clearing the line, grades the pick and says why -- every
// number one a member can check on the player's page.
//
// Adjustments are deliberately small and pulled toward "no change" when
// the sample behind them is thin: a matchup moves a projection a few
// percent, never doubles it, and all of them together move it at most
// MAX_SHIFT.

const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const percent = value => `${Math.round(value * 100)}%`;
const figure = value => Number.isInteger(value) ? String(value) : value.toFixed(1);
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

// A projection needs this many games.
const MIN_GAMES = 5;
// Recent games count more: a game this many games back counts half.
const HALF_LIFE = 8;
const MAX_SHIFT = 0.15;

// ---------------------------------------------------------------- distributions

// log Γ(x), Lanczos.
function logGamma(x) {
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function normalCdf(z) {
  // Abramowitz-Stegun 7.1.26 on erf.
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

// P(X = k) for a count with this mean and variance: negative binomial when
// the games spread wider than a Poisson, Poisson otherwise.
function countPmf(k, mu, variance) {
  if (k < 0) return 0;
  if (variance > mu * 1.05) {
    const r = mu * mu / (variance - mu), p = r / (r + mu);
    return Math.exp(logGamma(k + r) - logGamma(k + 1) - logGamma(r) + r * Math.log(p) + k * Math.log(1 - p));
  }
  return Math.exp(k * Math.log(mu) - mu - logGamma(k + 1));
}

/**
 * The chance a stat with this mean and spread lands on `side` of `line`,
 * pushes (an exact whole-number line) left out. Counts use a count
 * distribution; big or fractional stats a normal curve.
 */
export function sideChance(mu, variance, line, side, {counts = true} = {}) {
  if (!finite(mu) || !finite(line)) return null;
  if (mu <= 0) return side === 'UNDER' ? 1 : 0;
  let over, push = 0;
  if (counts && (variance > mu * 1.05 || mu < 4)) {
    const k = Math.floor(line);
    let atMost = 0;
    for (let i = 0; i <= k; i++) atMost += countPmf(i, mu, variance);
    push = Number.isInteger(line) ? countPmf(line, mu, variance) : 0;
    over = 1 - atMost;
  } else {
    const sd = Math.sqrt(Math.max(variance, counts ? mu * 0.3 : (mu * 0.12) ** 2, 0.25));
    if (counts) {
      const k = Math.floor(line);
      over = 1 - normalCdf((k + 0.5 - mu) / sd);
      push = Number.isInteger(line) ? normalCdf((line + 0.5 - mu) / sd) - normalCdf((line - 0.5 - mu) / sd) : 0;
    } else over = 1 - normalCdf((line - mu) / sd);
  }
  const decided = 1 - push;
  if (decided <= 0) return null;
  const chance = side === 'UNDER' ? (1 - over - push) / decided : over / decided;
  return clamp(chance, 0.01, 0.99);
}

// ---------------------------------------------------------------- context

const POSITION_NAMES = {G: 'guards', F: 'forwards', C: 'centers', QB: 'QBs', RB: 'RBs', WR: 'WRs', TE: 'TEs', K: 'kickers'};
const USAGE_NAMES = {wnba: 'Minutes', nba: 'Minutes', soccer: 'Minutes', nhl: 'Ice time'};
const statWord = row => String(row.market || 'this stat').toLowerCase();

/** Is the player at home today? Null when the board doesn't say. */
export function homeToday(row) {
  if (typeof row.isHome === 'boolean') return row.isHome;
  if (row.teamAbbr && row.homeTeamAbbr && row.awayTeamAbbr) {
    if (row.teamAbbr === row.homeTeamAbbr) return true;
    if (row.teamAbbr === row.awayTeamAbbr) return false;
  }
  return null;
}

const shift = (ratio, weight, low, high) => clamp(1 + (ratio - 1) * weight, low, high);

// MLB: which of the pitcher's (or lineup's) rates bears on the stat, and
// which way. Hitter stats against a pitcher; pitcher stats against a lineup.
const HITTER_RATE = {hits: 'whip', tb: 'whip', hrr: 'whip', singles: 'whip', doubles: 'whip', triples: 'whip', xbh: 'whip', fantasy: 'whip',
  runs: 'whip', rbi: 'whip', 'runs-rbis': 'whip', 'hits-walks': 'whip', hr: 'hr9', strikeouts: 'k9', walks: 'bb9'};
const PITCHER_RATE = {strikeouts: ['kRate', 1], hits: ['avg', 1], 'earned-runs': ['runsPerGame', 1], 'runs-allowed': ['runsPerGame', 1],
  walks: ['bbRate', 1], 'hr-allowed': ['hrRate', 1], 'pitcher-fantasy': ['kRate', 0.6], outs: ['runsPerGame', -0.4], pitches: ['runsPerGame', 0.3]};

/**
 * A lineup's rate for one stat as the matchup sees it: against the
 * pitcher's hand when MLB split it out, blended with how the lineup has
 * hit over the last ten days, each held against the league's own figure.
 * Also what a card shows of it: the ranks, hot or cold.
 */
function lineupForm(lineup, league, hand, rate) {
  if (!lineup || !league) return null;
  const split = hand ? lineup.vs?.[hand] : null, splitLeague = hand ? league.vs?.[hand] : null;
  const useSplit = split && splitLeague && finite(split[rate]) && finite(splitLeague[rate]) && splitLeague[rate] > 0;
  const base = useSplit ? split : lineup, baseLeague = useSplit ? splitLeague : league;
  if (!finite(base[rate]) || !finite(baseLeague[rate]) || baseLeague[rate] <= 0) return null;
  let ratio = base[rate] / baseLeague[rate];
  const recent = lineup.recent, recentLeague = league.recent;
  const lately = recent && recentLeague && finite(recent[rate]) && finite(recentLeague[rate]) && recentLeague[rate] > 0
    ? recent[rate] / recentLeague[rate] : null;
  // Ten days say less than a season: weighted by the games in them.
  if (lately != null) {
    const weight = 0.35 * (finite(recent.games) ? recent.games / (recent.games + 6) : 0.5);
    ratio = (1 - weight) * ratio + weight * lately;
  }
  const hot = recent && recentLeague && finite(recent.ops) && finite(recentLeague.ops) && recentLeague.ops > 0
    ? recent.ops / recentLeague.ops : null;
  return {ratio, value: base[rate], league: baseLeague[rate], hand: useSplit ? hand : null, rank: base[rate + 'Rank'] || null,
    teams: league.teams || null, split: useSplit ? {kRate: split.kRate ?? null, kRateRank: split.kRateRank ?? null, ops: split.ops ?? null,
      opsRank: split.opsRank ?? null, avg: split.avg ?? null, league: splitLeague} : null,
    recent: recent ? {ops: recent.ops ?? null, opsRank: recent.opsRank ?? null, kRate: recent.kRate ?? null, kRateRank: recent.kRateRank ?? null,
      runsPerGame: recent.runsPerGame ?? null, runsPerGameRank: recent.runsPerGameRank ?? null, games: recent.games ?? null, league: recentLeague || null} : null,
    form: hot == null ? null : hot >= 1.08 ? 'hot' : hot <= 0.92 ? 'cold' : 'steady'};
}

// A starter's projected innings (mlb_context.py) against the innings in
// his own recent starts, for lines that ride on depth (pitching outs).
function depthRatio(row) {
  const self = row.matchup?.self;
  if (!self || !finite(self.projectedIp)) return null;
  const outs = (row.gameLog || []).map(game => game.value).filter(finite);
  if (outs.length < MIN_GAMES) return null;
  const average = mean(outs.slice(-10)) / 3;
  return average > 0 ? self.projectedIp / average : null;
}

/** What today's opponent does to the stat: a factor on the projection and its words. */
export function matchupRead(row) {
  if ((row.sport === 'wnba' || row.sport === 'nba' || row.sport === 'nfl') && finite(row.defenseValue) && finite(row.defenseAverage) && row.defenseAverage > 0) {
    const allowed = finite(row.defenseRecent) ? 0.65 * row.defenseValue + 0.35 * row.defenseRecent : row.defenseValue;
    const ratio = allowed / row.defenseAverage;
    const factor = shift(ratio, row.sport === 'nfl' ? 0.3 : 0.4, 0.9, 1.1);
    const gap = Math.round((row.defenseValue / row.defenseAverage - 1) * 100);
    const teams = finite(row.defenseTeams) ? row.defenseTeams : null;
    const most = teams && finite(row.defense) ? teams - row.defense + 1 : null;
    const place = most && most <= teams / 3 ? ` (${ordinal(most)}-most)` : teams && row.defense <= teams / 3 ? ` (${ordinal(row.defense)}-fewest)` : '';
    const who = POSITION_NAMES[row.defensePosition] || 'the position';
    return {factor, short: `${gap >= 0 ? '+' : '−'}${Math.abs(gap)}%`, label: `vs ${who}`,
      text: `${row.opponent} allows ${figure(Math.round(row.defenseValue * 10) / 10)} ${statWord(row)} to ${who}, ${Math.abs(gap)}% ${gap >= 0 ? 'more' : 'less'} than average${place}`};
  }
  if (row.sport === 'mlb' && row.matchup?.league) {
    const key = String(row.marketKey || '').split(':')[1];
    const {league} = row.matchup;
    if (row.matchup.kind === 'pitcher') {
      const rate = HITTER_RATE[key];
      const pitcher = row.matchup.pitcher;
      // His own lineup against this starter's hand, and lately (when MLB gave them).
      const form = lineupForm(row.matchup.lineup, league, pitcher?.hand, 'ops');
      const team = form ? shift(form.ratio, 0.25, 0.94, 1.06) : 1;
      if (rate && pitcher && finite(pitcher[rate]) && finite(league[rate]) && league[rate] > 0) {
        const trust = finite(pitcher.ip) ? pitcher.ip / (pitcher.ip + 60) : 0.3;
        const factor = clamp(shift(pitcher[rate] / league[rate], 0.5 * trust, 0.85, 1.15) * team, 0.85, 1.15);
        const shown = [finite(pitcher.whip) && `${pitcher.whip.toFixed(2)} WHIP`, finite(pitcher.k9) && `${pitcher.k9.toFixed(1)} K/9`].filter(Boolean).join(', ');
        return {factor, short: pitcher.name ? pitcher.name.split(' ').at(-1) : 'SP', label: 'starter',
          text: `Faces ${pitcher.name || "the opponent's starter"}${shown ? ` (${shown})` : ''}`,
          detail: {kind: 'hitter', pitcher, lineup: form, teams: league.teams || null}};
      }
      const staff = row.matchup.staff;
      if (rate && staff && finite(staff[rate]) && finite(league[rate]) && league[rate] > 0) {
        const factor = clamp(shift(staff[rate] / league[rate], 0.25, 0.92, 1.08) * team, 0.85, 1.15);
        return {factor, short: row.opponent || 'staff', label: 'pitching staff',
          text: `${row.opponent || 'The opponent'}'s staff runs a ${finite(staff.era) ? staff.era.toFixed(2) : '—'} ERA`,
          detail: {kind: 'hitter', pitcher: null, lineup: form, teams: league.teams || null}};
      }
    } else {
      const [rate, direction] = PITCHER_RATE[key] || [];
      const lineup = row.matchup.lineup;
      const hand = row.matchup.self?.hand || null;
      const form = rate ? lineupForm(lineup, league, hand, rate) : null;
      if (form) {
        const trust = finite(lineup.games) ? lineup.games / (lineup.games + 20) : 0.5;
        let factor = shift(form.ratio, 0.6 * direction * trust, 0.85, 1.15);
        // Pitching outs ride on how deep he goes: his projected innings
        // against what his own games average.
        const depth = key === 'outs' ? depthRatio(row) : null;
        if (depth) factor = clamp(factor * shift(depth, 0.5, 0.92, 1.08), 0.85, 1.15);
        const words = {kRate: ['strikes out', value => percent(value)], avg: ['hits', value => value.toFixed(3).replace(/^0/, '')],
          runsPerGame: ['scores', value => `${value.toFixed(1)} runs a game`], bbRate: ['walks', value => percent(value)],
          hrRate: ['homers', value => percent(value)]}[rate];
        const often = rate === 'kRate' || rate === 'bbRate' || rate === 'hrRate' ? ' of the time' : '';
        const against = form.hand ? ` vs ${form.hand === 'L' ? 'lefties' : 'righties'}` : '';
        const place = form.rank && form.teams && (form.rank <= 8 || form.rank > form.teams - 8)
          ? ` (${ordinal(form.rank <= 8 ? form.rank : form.teams - form.rank + 1)}-${form.rank <= 8 ? 'most' : 'fewest'})` : '';
        return {factor, short: `${form.ratio >= 1 ? '+' : '−'}${Math.abs(Math.round((form.ratio - 1) * 100))}%`, label: 'lineup',
          text: `${row.opponent || 'The opponent'} ${words[0]} ${words[1](form.value)}${often}${against}${place} (league ${words[1](form.league)})`,
          detail: {kind: 'pitcher', rate, lineup: form, self: row.matchup.self || null, teams: league.teams || null}};
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------- the read

const rateOn = (games, line, side) => {
  const decided = games.filter(game => game.value !== line);
  if (!decided.length) return null;
  const won = decided.filter(game => side === 'UNDER' ? game.value < line : game.value > line).length;
  return {won, games: decided.length, rate: won / decided.length};
};

/**
 * One pick, read: its projection (and the chance that gives), each thing
 * that moved it, the signals for and against and what to watch.
 * `records` are the hit-rate windows (smart-slip.js sideRecord); `book`
 * the sportsbooks' chance for this side; `baseline` the chance the line
 * needs to break even -- 0.5 for a regular line, lower for a Demon,
 * higher for a Goblin -- which the records are held against.
 */
export function readPick(row, side, {records = {}, book = null, baseline = 0.5} = {}) {
  const log = (row.gameLog || []).filter(game => finite(game.value));
  const line = row.line;
  const sign = side === 'UNDER' ? -1 : 1;
  const out = {projection: null, projected: null, factors: [], risks: []};
  const matchup = matchupRead(row);

  if (log.length >= MIN_GAMES && finite(line)) {
    const values = log.map(game => game.value);
    const n = values.length;
    let weights = 0, total = 0;
    values.forEach((value, index) => { const weight = 0.5 ** ((n - 1 - index) / HALF_LIFE); weights += weight; total += weight * value; });
    const base = total / weights;
    const plain = mean(values);
    const variance = n > 1 ? values.reduce((sum, value) => sum + (value - plain) ** 2, 0) / (n - 1) : plain;
    let factor = 1;
    const move = (key, value, detail) => { factor *= value; out.factors.push({key, factor: value, ...detail}); };

    if (matchup) move('matchup', matchup.factor, matchup);

    const home = homeToday(row);
    if (home != null) {
      const here = log.filter(game => game.home === home);
      if (here.length >= 4 && log.length - here.length >= 4 && plain > 0) {
        const record = rateOn(here, line, side);
        move('venue', shift(mean(here.map(game => game.value)) / plain, 0.8 * here.length / (here.length + 10), 0.94, 1.06),
          {short: record ? `${record.won}/${record.games}` : figure(mean(here.map(game => game.value))), label: home ? 'at home' : 'on the road', record,
            text: record ? `${record.won} of ${record.games} ${side === 'UNDER' ? 'under' : 'over'} ${home ? 'at home' : 'on the road'}` : null});
      }
    }

    const opponent = row.sport === 'mlb' ? row.opponentTeamId : row.opponent;
    if (opponent != null && plain > 0) {
      const faced = log.filter(game => game.opponent != null && String(game.opponent) === String(opponent));
      if (faced.length >= 2) {
        const record = rateOn(faced, line, side);
        move('h2h', shift(mean(faced.map(game => game.value)) / plain, faced.length / (faced.length + 8), 0.92, 1.08),
          {short: record ? `${record.won}/${record.games}` : '', label: `vs ${row.opponent || 'them'}`, record,
            text: record ? `${record.won} of ${record.games} ${side === 'UNDER' ? 'under' : 'over'} against ${row.opponent || 'this opponent'}` : null});
      }
    }

    const usage = log.map(game => game.usage).filter(finite);
    if (usage.length >= 8) {
      const lately = mean(usage.slice(-5)), before = mean(usage.slice(0, -5));
      if (before > 0 && Math.abs(lately / before - 1) >= 0.06) {
        const pitcher = String(row.marketKey || '').startsWith('pitching:');
        const name = USAGE_NAMES[row.sport] || (row.sport === 'mlb' ? (pitcher ? 'Pitches' : 'Plate appearances') : 'Playing time');
        const up = lately > before;
        const shown = value => row.sport === 'mlb' && !pitcher ? value.toFixed(1) : String(Math.round(value));
        move('role', shift(lately / before, 0.4, 0.92, 1.1), {short: `${up ? '+' : '−'}${Math.abs(Math.round((lately / before - 1) * 100))}%`,
          label: name.toLowerCase(), text: `${name} ${up ? 'up' : 'down'} to ${shown(lately)} from ${shown(before)}`});
      }
    }

    const last = log.at(-1)?.date, starts = Date.parse(row.startsAt || '');
    if ((row.sport === 'wnba' || row.sport === 'nba' || row.sport === 'nhl') && last && Number.isFinite(starts)) {
      const rest = (starts - Date.parse(`${last}T12:00:00Z`)) / 86400000;
      if (rest < 1.6) { move('rest', 0.98, {short: 'B2B', label: 'back-to-back', text: 'Second night of a back-to-back'}); out.risks.push('Back-to-back'); }
    }

    const projected = base * clamp(factor, 1 - MAX_SHIFT, 1 + MAX_SHIFT);
    const counts = values.every(value => Number.isInteger(value) && value >= 0);
    let chance = sideChance(projected, variance * (plain > 0 ? projected / plain : 1), line, side, {counts});
    // A short history says less: pulled toward even.
    if (chance != null) chance = 0.5 + (chance - 0.5) * n / (n + 4);
    out.projection = projected;
    out.projected = chance;
    out.games = n;
    if (n < 8) out.risks.push(`Only ${n} games of history`);
  } else if (matchup) {
    out.factors.push({key: 'matchup', ...matchup});
  }

  // Signals for and against the side, each weighted by how much it says.
  const signals = [];
  const signal = (key, weight, holds, fails) => { if (holds) signals.push({key, weight}); else if (fails) signals.push({key, weight: -weight}); };
  const recent = records.l10 || records.l5;
  const bar = baseline;
  if (recent && recent.games >= 5) signal('form', 1, recent.rate >= bar + 0.1, recent.rate <= bar - 0.1);
  if (records.season && records.season.games >= 10) signal('season', 1, records.season.rate >= bar + 0.07, records.season.rate <= bar - 0.07);
  if (out.projected != null) signal('projection', 1.25, out.projected >= bar + 0.07, out.projected <= bar - 0.03);
  // A Goblin's or Demon's price is the books' own chance: it sets the bar
  // rather than clearing it.
  if (finite(book) && bar === 0.5) signal('books', 1.5, book >= 0.54, book <= 0.47);
  for (const item of out.factors) {
    const effect = (item.factor - 1) * sign;
    if (item.key === 'matchup') signal('matchup', 1, effect >= 0.03, effect <= -0.03);
    if (item.key === 'role') signal('role', effect > 0 ? 0.5 : 0.75, effect >= 0.03, effect <= -0.03);
    if (item.key === 'h2h' && item.record?.games >= 3) signal('h2h', 0.75, item.record.rate >= 0.6, item.record.rate <= 0.34);
    if (item.key === 'venue' && item.record) signal('venue', 0.5, item.record.rate >= 0.6, item.record.rate <= 0.4);
  }
  out.signals = signals;
  out.support = signals.filter(item => item.weight > 0).reduce((sum, item) => sum + item.weight, 0);
  out.against = signals.filter(item => item.weight < 0).reduce((sum, item) => sum - item.weight, 0);

  // What to watch: whatever argues against the pick.
  for (const item of out.factors) {
    const effect = (item.factor - 1) * sign;
    if (item.key === 'matchup' && effect <= -0.03) out.risks.push(`Tough matchup: ${item.text}`);
    if (item.key === 'role' && effect <= -0.03) out.risks.push(item.text);
    if (item.key === 'h2h' && item.record?.games >= 3 && item.record.rate <= 0.34) out.risks.push(`${item.record.won} of ${item.record.games} against ${row.opponent}`);
  }
  // A starter not expected to go deep caps his strikeouts and outs.
  const self = row.sport === 'mlb' && row.matchup?.kind === 'lineup' ? row.matchup.self : null;
  if (self && finite(self.projectedIp) && self.projectedIp < 5 && side !== 'UNDER' && /^pitching:(strikeouts|outs|pitcher-fantasy)$/.test(row.marketKey || ''))
    out.risks.push(`Projects for only ${figure(self.projectedIp)} innings`);
  const lastFive = records.l5;
  if (lastFive && lastFive.games >= 5 && lastFive.rate <= bar - 0.1) out.risks.push(`${lastFive.won} of the last 5`);
  out.risks = [...new Set(out.risks)].slice(0, 2);
  return out;
}

/**
 * The grade: A when nearly everything agrees and the chance clears the
 * line's break-even with room, B when most of it does, C otherwise.
 * `baseline` is the break-even chance for the line (0.5 for a regular one).
 */
export function grade(read, chance, baseline = 0.5, modifier = 'standard') {
  const edge = chance - baseline;
  const [aEdge, bEdge] = modifier === 'standard' ? [0.07, 0.035] : [0.02, -0.01];
  if (edge >= aEdge && read.support >= 4 && read.against <= 0.75) return 'A';
  if (edge >= bEdge && read.support >= 2.5 && read.against <= 1.5) return 'B';
  return 'C';
}

/** Conflicting evidence: more against the pick than for it, or the projection and the books both against. */
export function conflicted(read) {
  const against = key => read.signals.some(item => item.key === key && item.weight < 0);
  return read.against > 0 && (read.against >= read.support || (against('projection') && against('books')));
}

/**
 * A note in plain words, strongest points first: the projection or the
 * record, then the matchup (or head-to-head, venue, playing time), then
 * the books.
 */
export function analystNote(row, side, read, {records = {}, book = null} = {}) {
  const word = side === 'UNDER' ? 'under' : 'over';
  const parts = [];
  const recent = records.l10 || records.l5;
  if (finite(read.projection)) {
    const lead = `Projects for ${figure(Math.round(read.projection * 10) / 10)} against the ${figure(row.line)} line`;
    parts.push(recent ? `${lead}, ${word} in ${recent.won} of the last ${recent.games}.` : `${lead}.`);
  } else if (recent) parts.push(`${recent.won} of the last ${recent.games} ${word} ${figure(row.line)}.`);
  const sign = side === 'UNDER' ? -1 : 1;
  const context = read.factors.filter(item => item.text && item.key !== 'rest')
    .map(item => ({item, strength: Math.abs(item.factor - 1) + (item.key === 'matchup' ? 0.02 : 0), helps: (item.factor - 1) * sign >= 0}))
    .filter(entry => entry.helps).sort((a, b) => b.strength - a.strength)[0]?.item;
  const books = finite(book) ? `the books have it at ${percent(book)}` : null;
  if (context && books) parts.push(`${context.text}; ${books}.`);
  else if (context) parts.push(`${context.text}.`);
  else if (books) parts.push(`${books[0].toUpperCase()}${books.slice(1)}.`);
  return parts.join(' ');
}
