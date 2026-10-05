// The case for a pick, the way someone would research it by hand: what the
// player faces today first, his history against it and his home/road
// split next, his recent form last. Each sport is read its own way:
//
//   MLB hitter   the starter (ERA, WHIP, HR/9, his last start), career
//                batter vs pitcher, how he hits the starter's pitch mix,
//                his split against the starter's hand, park and weather
//                (mlb_prop_matchups.py, mlb_context.py)
//   MLB pitcher  the lineup he faces: its strikeout rate against his hand,
//                how it has hit lately, how deep he goes
//   NBA / WNBA   what the defense allows his position in this stat, and
//                how much scoring the two teams' games produce
//   NFL          what the defense allows his position, its pass rush and
//                pass defense for a quarterback, his share of the targets
//                or carries
//   NHL          what the defense allows his position, the shots a team
//                takes for a goalie
//
// Every fact carries an impact on a 0-100 scale for the pick's side (50 is
// neutral); the matchup score is 50 plus their sum. src/slip-check.js
// grades a pick on that score first and its recent games second.
import {defenseCell, loadFinderDefense, loadMlbMatchups, loadHitterMatchups, withMlbMatchups, withHitterMatchups,
  withDefense} from './unified-finder-data.js';
import {homeToday, matchupRead} from './slip-analyst.js';
import {newsFacts} from './slip-games.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const one = value => Number.isInteger(value) ? String(value) : (Math.round(value * 10) / 10).toFixed(1);
const three = value => finite(value) ? value.toFixed(3).replace(/^0/, '') : String(value || '').replace(/^0/, '');
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
const lastName = name => String(name || '').split(' ').filter(word => !/^(jr|sr|ii|iii|iv)\.?$/i.test(word)).at(-1) || name;
const number = value => {
  const parsed = typeof value === 'string' ? Number(value.replace(/^\./, '0.')) : value;
  return finite(parsed) ? parsed : null;
};

// ---------------------------------------------------------------- loading

async function request(url, {signal, fetcher = fetch} = {}) {
  const response = await fetcher(url, {signal, cache: 'no-store', credentials: 'same-origin'});
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error || 'Matchup data is unavailable.');
  return data;
}
const quietly = promise => promise.catch(error => { if (error?.name === 'AbortError') throw error; return null; });

/**
 * Each league's matchup tables, for the sports on a slip: the defense
 * tables (NBA, WNBA, NFL, NHL) and MLB's starters, lineups and hitter
 * matchups. A table that can't be had is left out; its picks are read
 * on what remains.
 */
export async function loadMatchups(sports, {signal, fetcher} = {}) {
  const options = {signal, fetcher};
  const wanted = [...new Set(sports)];
  const pairs = await Promise.all(wanted.map(async sport => {
    if (sport === 'nba' || sport === 'wnba' || sport === 'nfl') return [sport, await quietly(loadFinderDefense(sport, options))];
    if (sport === 'nhl') return [sport, await quietly(request('/api/board?view=nhl&resource=league', options))];
    if (sport === 'mlb') {
      const [context, hitters] = await Promise.all([quietly(loadMlbMatchups(options)), quietly(loadHitterMatchups(options))]);
      return [sport, context || hitters ? {context, hitters} : null];
    }
    return [sport, null];
  }));
  return Object.fromEntries(pairs.filter(([, value]) => value));
}

/** A line with its league's matchup tables attached (what the analyst reads). */
export function withMatchups(row, tables = {}) {
  if (!row) return row;
  const table = tables[row.sport];
  if (!table) return row;
  if (row.sport === 'mlb') {
    let out = table.context ? withMlbMatchups([row], table.context)[0] : row;
    if (table.hitters) out = withHitterMatchups([out], table.hitters)[0];
    return out;
  }
  if (row.sport === 'nba' || row.sport === 'wnba' || row.sport === 'nfl') return finite(row.defenseValue) ? row : withDefense([row], table)[0];
  return row;
}

// ---------------------------------------------------------------- facts

// side: +1 for the over, -1 for the under, so a fact written for the over
// counts the other way on an under.
const fact = (kind, key, text, impact = 0, extra = {}) => ({kind, key, text, impact: Math.round(impact * 10) / 10,
  tone: impact >= 1.5 ? 'up' : impact <= -1.5 ? 'down' : 'flat', ...extra});
const POSITION_WORDS = {G: 'guards', F: 'forwards', C: 'centers', QB: 'quarterbacks', RB: 'running backs', WR: 'receivers',
  TE: 'tight ends', K: 'kickers', LW: 'left wings', RW: 'right wings', D: 'defensemen'};
// "Hits+Runs+RBIs" keeps its capitals; "Receiving Yards" reads "receiving yards"; a pitcher's "Pitcher Strikeouts" is his strikeouts.
const statWord = row => {
  const name = String(row.market || 'this stat').replace(/^pitcher\s+/i, '');
  return /[A-Z]{2}|\+/.test(name) ? name : name.toLowerCase();
};
// "4th-most" / "3rd-fewest" when a rank is near either end, else nothing.
function place(rank, teams, {low = 'fewest', high = 'most'} = {}) {
  if (!finite(rank) || !finite(teams) || teams < 6 || rank < 1 || rank > teams) return '';
  const top = Math.max(3, Math.round(teams / 4));
  if (rank <= top) return ` (${ordinal(rank)}-${low})`;
  const fromTop = teams - rank + 1;
  return fromTop <= top ? ` (${ordinal(fromTop)}-${high})` : '';
}

/** What the defense allows his position in this stat (NBA, WNBA, NFL), held against the league. */
function positionDefense(row, sign) {
  if (!finite(row.defenseValue) || !finite(row.defenseAverage) || !(row.defenseAverage > 0)) return null;
  const allowed = finite(row.defenseRecent) ? 0.7 * row.defenseValue + 0.3 * row.defenseRecent : row.defenseValue;
  const ratio = allowed / row.defenseAverage;
  const gap = Math.round((row.defenseValue / row.defenseAverage - 1) * 100);
  const who = POSITION_WORDS[row.defensePosition] || 'his position';
  const text = `${row.opponent} allows ${one(row.defenseValue)} ${statWord(row)} to ${who}, ${Math.abs(gap)}% ${gap >= 0 ? 'more' : 'less'} than average${place(row.defense, row.defenseTeams)}`;
  return fact('opponent', 'defense', text, clamp((ratio - 1) * 110, -22, 22) * sign, {primary: true});
}

// MLB ------------------------------------------------------------------

const HITTER_FAMILY = {hits: 'hits', singles: 'hits', tb: 'power', hr: 'power', doubles: 'power', triples: 'power', xbh: 'power'};
const FACTOR_SIDE = {park: ['A hitter-friendly park', 'A pitcher-friendly park'], weather: ['Weather helps hitters', 'Weather helps pitchers']};

function mlbHitter(row, sign) {
  const model = row.hitterMatchup;
  const key = String(row.marketKey || '').split(':')[1];
  const inverted = key === 'strikeouts';
  const flip = inverted ? -sign : sign;
  const factors = Object.fromEntries((model?.factors || []).map(item => [item.key, item]));
  const graded = model?.grades?.[HITTER_FAMILY[key] || 'other'];
  const out = [];
  const starter = row.matchup?.pitcher;
  const name = model?.pitcher?.name || starter?.name;
  // The starter: his season line and what he gave up last time out.
  if (name) {
    const line = [finite(starter?.era) && `${starter.era.toFixed(2)} ERA`, finite(starter?.whip) && `${starter.whip.toFixed(2)} WHIP`,
      finite(starter?.hr9) && `${starter.hr9.toFixed(1)} HR/9`].filter(Boolean);
    const last = starter?.lastStarts?.at(-1);
    const lastText = last && finite(last.ip) ? `; last start ${one(Math.floor(last.ip) + Math.round((last.ip % 1) * 3) / 10)} IP${finite(last.h) ? `, ${last.h} H` : ''}${finite(last.er) ? `, ${last.er} ER` : ''}` : '';
    const quality = factors.pitcher_quality;
    const impact = quality?.available && finite(quality.impact) ? quality.impact * flip * 1.2 : 0;
    const hand = model?.pitcher?.hand || starter?.hand;
    out.push(fact('opponent', 'starter', `Faces ${name}${hand ? ` (${hand}HP)` : ''}${line.length ? `: ${line.join(', ')}` : ''}${lastText}`, impact, {primary: true}));
  }
  // Career against him.
  const bvp = model?.bvp;
  if (bvp && finite(bvp.ab) && bvp.ab >= 3 && name) {
    const avg = number(bvp.avg);
    const impact = factors.bvp?.available && finite(factors.bvp.impact) ? factors.bvp.impact * flip * 1.2 : 0;
    out.push(fact('history', 'bvp', `Career vs ${lastName(name)}: ${bvp.hits}-for-${bvp.ab}${avg != null ? ` (${three(avg)})` : ''}${bvp.hr ? `, ${bvp.hr} HR` : ''}${number(bvp.ops) != null ? `, ${three(number(bvp.ops))} OPS` : ''}`, impact));
  }
  // His pitch mix.
  const arsenal = graded?.arsenal;
  if (arsenal?.detail && finite(arsenal.impact)) {
    const metric = /SLG/.test(arsenal.detail) ? 'SLG' : /AVG/.test(arsenal.detail) ? 'AVG' : 'wOBA';
    const value = arsenal.detail.match(/(\d?\.\d{3}) weighted/)?.[1];
    const coverage = arsenal.detail.match(/(\d+)% (?:coverage|of the starter's mix)/)?.[1];
    const pitches = (model?.pitches || []).filter(pitch => finite(pitch.pct)).slice(0, 3).map(pitch => `${pitch.name} ${Math.round(pitch.pct)}%`);
    const verb = arsenal.impact >= 2 ? 'Hits' : arsenal.impact <= -2 ? 'Struggles with' : 'Holds his own against';
    out.push(fact('opponent', 'arsenal', `${verb} his pitch mix${value ? `: ${three(number(value))} ${metric}` : ''}${coverage ? ` across ${coverage}% of it` : ''}${pitches.length ? ` (${pitches.join(', ')})` : ''}`,
      arsenal.impact * flip * 1.2));
  }
  // Against the starter's hand.
  const hand = factors.handedness;
  if (hand?.available && hand.detail) out.push(fact('split', 'hand', hand.detail.split(' · ')[0].replace(/^vs ([LR])HP/, 'vs $1HP:').replace(/ \(\d+ PA\)$/, ''),
    finite(hand.impact) ? hand.impact * flip : 0));
  for (const item of ['park', 'weather']) {
    const factor = factors[item];
    if (factor?.available && finite(factor.impact) && Math.abs(factor.impact) >= 2) {
      const words = FACTOR_SIDE[item][factor.impact > 0 ? 0 : 1];
      out.push(fact('venue', item, item === 'weather' ? `${words}: ${factor.detail}` : words, factor.impact * flip * 0.8));
    }
  }
  // No model today: the starter's rates against the league (slip-analyst.js).
  if (!graded && starter) {
    const read = matchupRead(row);
    if (read && finite(read.factor)) out[0] = {...out[0], impact: Math.round(clamp((read.factor - 1) * 220, -25, 25) * sign * 10) / 10};
  }
  return out;
}

function mlbPitcher(row, sign) {
  const out = [];
  const read = matchupRead(row);
  const lineup = read?.detail?.lineup;
  if (read && finite(read.factor)) out.push(fact('opponent', 'lineup', read.text, clamp((read.factor - 1) * 220, -25, 25) * sign, {primary: true}));
  if (lineup?.recent && finite(lineup.recent.ops) && lineup.form && lineup.form !== 'steady') {
    out.push(fact('form', 'lineup-form', `${row.opponent || 'Their lineup'} is ${lineup.form} lately: ${three(lineup.recent.ops)} OPS over ${lineup.recent.games || 'its last'} games`, 0));
  }
  const self = row.matchup?.self;
  if (self) {
    const starts = (self.lastStarts || []).slice(-3);
    const key = String(row.marketKey || '').split(':')[1];
    const field = key === 'strikeouts' ? 'k' : key === 'hits' ? 'h' : key === 'earned-runs' ? 'er' : key === 'walks' ? 'bb' : null;
    if (field && starts.length && starts.every(start => finite(start[field]))) {
      out.push(fact('form', 'starts', `Last ${starts.length} starts: ${starts.map(start => start[field]).join(', ')} ${statWord(row)}`, 0));
    }
    if (finite(self.projectedIp)) out.push(fact('usage', 'depth', `Goes about ${one(self.projectedIp)} innings a start${finite(self.recentPitches) ? ` (${Math.round(self.recentPitches)} pitches lately)` : ''}`, 0));
    if (self.vsOpponent?.starts) {
      const vs = self.vsOpponent;
      out.push(fact('history', 'vs-team', `Against ${row.opponent || 'them'} this season: ${vs.starts} start${vs.starts > 1 ? 's' : ''}, ${one(vs.ip)} IP, ${vs.k} K, ${vs.er} ER`, 0));
    }
  }
  return out;
}

// Basketball -------------------------------------------------------------

const POINTS_STATS = /pts|points|pra|pts\+|fantasy/i;
function basketball(row, sign, league) {
  const out = [];
  const defense = positionDefense(row, sign);
  if (defense) out.push(defense);
  const stats = league?.teamStats;
  const own = stats?.[row.teamAbbr], their = stats?.[row.opponent];
  // How much scoring their games produce, for points-heavy lines.
  if (own && their && POINTS_STATS.test(`${row.marketKey} ${row.market}`)) {
    const teamFor = own.off?.pts?.[0], teamAgainst = own.def?.pts?.[0], oppFor = their.off?.pts?.[0], oppAgainst = their.def?.pts?.[0];
    const all = Object.values(stats).map(team => team.off?.pts?.[0]).filter(finite);
    if ([teamFor, teamAgainst, oppFor, oppAgainst].every(finite) && all.length > 4) {
      const expected = (teamFor + oppAgainst) / 2 + (oppFor + teamAgainst) / 2;
      const normal = 2 * mean(all);
      const ratio = expected / normal;
      const words = ratio >= 1.02 ? 'a fast, high-scoring matchup' : ratio <= 0.98 ? 'a slow, low-scoring matchup' : 'an average-pace matchup';
      out.push(fact('opponent', 'pace', `Projects as ${words}: about ${Math.round(expected)} total points (league ${Math.round(normal)})`, clamp((ratio - 1) * 120, -8, 8) * sign));
    }
  }
  return out;
}

// NFL ------------------------------------------------------------------

const PASSING = new Set(['passing_yards', 'pass_completions', 'passing_attempts', 'passing_touchdowns', 'passing_rushing_yards']);
function football(row, sign, league) {
  const out = [];
  const defense = positionDefense(row, sign);
  if (defense) out.push(defense);
  const stats = league?.teamStats;
  const their = stats?.[row.opponent];
  const teams = league?.teamCount || Object.keys(stats || {}).length;
  const average = key => mean(Object.values(stats || {}).map(team => team.off?.[key]?.[0]).filter(finite));
  const market = row.marketKey || row.raw?.propType;
  if (their && (PASSING.has(market) || market === 'interceptions')) {
    // His pass rush: the sacks their defense makes (off: rank 1 the most).
    const sacks = their.off?.sacks;
    const normal = average('sacks');
    if (sacks && finite(sacks[0]) && normal > 0) {
      const ratio = sacks[0] / normal;
      out.push(fact('opponent', 'pass-rush', `${row.opponent}'s pass rush gets ${one(sacks[0])} sacks a game${place(sacks[1], teams, {low: 'most', high: 'fewest'})}`,
        clamp(-(ratio - 1) * (market === 'interceptions' ? -25 : 25), -8, 8) * sign));
    }
    const completion = their.def?.completion_pct;
    if (completion && finite(completion[0]) && market !== 'interceptions') {
      out.push(fact('opponent', 'coverage', `Allows a ${one(completion[0])}% completion rate${place(completion[1], teams, {low: 'lowest', high: 'highest'})}`, 0));
    }
    const picks = their.def?.interceptions;
    if (picks && finite(picks[0]) && market === 'interceptions') {
      out.push(fact('opponent', 'picks', `${row.opponent} picks off ${one(picks[0])} passes a game${place(picks[1], teams, {low: 'fewest', high: 'most'})}`, 0));
    }
  }
  // His share of the team's targets or carries.
  const field = /receiv|reception|target/.test(market || '') ? 'targets' : /rush/.test(market || '') && !PASSING.has(market) ? 'carries' : null;
  const share = field ? (league?.share?.[row.teamAbbr]?.[field] || []) : [];
  const index = share.findIndex(item => String(item.id) === String(row.playerId));
  if (index >= 0 && finite(share[index].share)) {
    const pct = share[index].share;
    out.push(fact('usage', 'share', `Gets ${Math.round(pct)}% of ${row.teamAbbr}'s ${field}${index === 0 ? ' (most on the team)' : index === 1 ? ' (2nd on the team)' : ''}`,
      clamp((pct - 15) / 3, -3, 5) * sign));
  }
  return out;
}

// NHL ------------------------------------------------------------------

const NHL_POSITION = {L: 'LW', R: 'RW', LW: 'LW', RW: 'RW', C: 'C', D: 'D', G: 'G'};
const NHL_DVP_KEY = {points: 'points', goals: 'goals', assists: 'assists', sog: 'sog', hits: 'hits', blocked: 'blocked', ppp: 'ppp',
  fow: 'fow', fantasy: 'fantasy', saves: 'saves', ga: 'ga'};
function hockey(row, sign, league) {
  const out = [];
  const position = NHL_POSITION[String(row.position || '').toUpperCase()];
  const key = NHL_DVP_KEY[row.valueKey];
  const dvp = league?.dvp;
  const window = 'l20';
  const cell = position && key ? dvp?.[row.opponent]?.[position]?.[key]?.[window] : null;
  if (cell && finite(cell[0])) {
    const all = Object.values(dvp).map(team => team?.[position]?.[key]?.[window]?.[0]).filter(finite);
    const normal = mean(all);
    if (normal > 0) {
      const ratio = cell[0] / normal;
      const gap = Math.round((ratio - 1) * 100);
      const who = POSITION_WORDS[position] || 'his position';
      out.push(fact('opponent', 'defense', `${row.opponent} allows ${cell[0].toFixed(2)} ${statWord(row)} a game to ${who}, ${Math.abs(gap)}% ${gap >= 0 ? 'more' : 'less'} than average${place(cell[1], league.teamCount || all.length)}`,
        clamp((ratio - 1) * 90, -22, 22) * sign, {primary: true}));
    }
  }
  // A goalie's saves follow the shots the other team takes.
  if (position === 'G' && key === 'saves') {
    const shots = league?.teams?.[row.opponent]?.off?.sog?.[window];
    const all = Object.values(league?.teams || {}).map(team => team?.off?.sog?.[window]?.[0]).filter(finite);
    if (shots && finite(shots[0]) && all.length) {
      const ratio = shots[0] / mean(all);
      out.push(fact('opponent', 'shots', `${row.opponent} takes ${one(shots[0])} shots a game${place(shots[1], league.teamCount || all.length, {low: 'most', high: 'fewest'})}`,
        clamp((ratio - 1) * 90, -15, 15) * sign, {primary: !out.length}));
    }
  }
  return out;
}

// Every sport ------------------------------------------------------------

/** His home and road averages, and which one today is. */
function venueSplit(row, sign) {
  const today = homeToday(row);
  const games = (row.gameLog || []).filter(game => finite(game.value) && typeof game.home === 'boolean').slice(-20);
  const home = games.filter(game => game.home).map(game => game.value), road = games.filter(game => !game.home).map(game => game.value);
  if (today == null || home.length < 3 || road.length < 3) return null;
  const here = today ? mean(home) : mean(road), there = today ? mean(road) : mean(home);
  const overall = mean(games.map(game => game.value));
  if (!(overall > 0)) return null;
  const where = today ? 'at home' : 'on the road';
  const text = `Averages ${one(here)} ${statWord(row)} ${where} vs ${one(there)} ${today ? 'on the road' : 'at home'} (${where} today)`;
  return fact('split', 'venue', text, clamp((here / overall - 1) * 45, -7, 7) * sign);
}

function headToHead(row, records) {
  const record = records?.h2h;
  if (!record || record.games < 2 || !row.opponent) return null;
  const weight = record.games / (record.games + 4);
  return fact('history', 'h2h', `${record.won} of ${record.games} against ${row.opponent}`, clamp((record.rate - 0.5) * 22 * weight, -6, 6));
}

function recentForm(row, records, side) {
  const record = records?.l10 || records?.l5;
  if (!record) return null;
  const word = side === 'UNDER' ? 'under' : 'over';
  const average = row.windows?.l10?.average ?? row.average;
  const avg = finite(average) && finite(row.line) ? `, averaging ${one(Math.round(average * 10) / 10)} against the ${one(row.line)} line` : '';
  return fact('form', 'form', `${record.won} of his last ${record.games} ${word}${avg}`, clamp((record.rate - 0.5) * 14, -5, 5));
}

const BANDS = [[72, 'Excellent matchup', 'excellent'], [60, 'Good matchup', 'good'], [45, 'Neutral matchup', 'neutral'], [35, 'Tough matchup', 'tough'], [0, 'Bad matchup', 'bad']];

/**
 * A graded leg's case: {score, label, tone, primary, facts}. `score` is
 * 0-100 for the pick's side; `primary` is whether anything was known about
 * the opponent (a score from splits and form alone means less).
 */
export function matchupCase(leg, tables = {}) {
  const row = leg?.row;
  if (!row || !leg.side) return null;
  const sign = leg.side === 'UNDER' ? -1 : 1;
  const league = tables[row.sport];
  const facts = [];
  if (row.sport === 'mlb') facts.push(...(String(row.marketKey || '').startsWith('pitching:') ? mlbPitcher(row, sign) : mlbHitter(row, sign)));
  else if (row.sport === 'nba' || row.sport === 'wnba') facts.push(...basketball(row, sign, league));
  else if (row.sport === 'nfl') facts.push(...football(row, sign, league));
  else if (row.sport === 'nhl') facts.push(...hockey(row, sign, league));
  const records = leg.grade?.records;
  for (const extra of [venueSplit(row, sign), headToHead(row, records), recentForm(row, records, leg.side)]) if (extra) facts.push(extra);
  // Is he playing, who's out around him, where he bats (slip-games.js).
  facts.push(...newsFacts(row, leg.side));
  const primary = facts.some(item => item.primary);
  // A hitter's model grade already weighs the starter, his history, the
  // pitch mix, the split, the park and the weather: it is the backbone.
  const model = row.sport === 'mlb' ? row.hitterMatchup?.grades?.[HITTER_FAMILY[String(row.marketKey || '').split(':')[1]] || 'other'] : null;
  let score;
  if (model && finite(model.score)) {
    const over = String(row.marketKey || '').endsWith(':strikeouts') ? 100 - model.score : model.score;
    const sided = sign > 0 ? over : 100 - over;
    const outside = facts.filter(item => item.kind === 'split' && item.key === 'venue' || item.kind === 'form' || item.kind === 'news')
      .reduce((sum, item) => sum + item.impact, 0);
    score = sided + outside;
  } else score = 50 + facts.reduce((sum, item) => sum + item.impact, 0);
  score = Math.round(clamp(score, 3, 97));
  const [, label, tone] = BANDS.find(([floor]) => score >= floor);
  // The news first (is he playing), then the opponent, history and splits, then form.
  const order = {news: -1, opponent: 0, history: 1, split: 2, venue: 3, usage: 4, form: 5};
  facts.sort((a, b) => order[a.kind] - order[b.kind] || (a.rank ?? 0) - (b.rank ?? 0) || Math.abs(b.impact) - Math.abs(a.impact));
  return {score, label, tone, primary, facts};
}
