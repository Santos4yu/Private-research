// Write-ups for the owner's community posts (Oct 25, the owner: "a prop /
// parlay insight generator from the prop matchups ... short like those and
// in Discord text like # -# ** * ... where he shoots or how the team shoots
// and misses for rebound chances, how the team defends it ... good data
// people can understand why I like a play"). No odds: the site has none.
//
// legFacts() turns one prop's numbers into short reasons, each with a
// weight; only reasons FOR the over are kept (a write-up argues the play),
// the strongest few per leg. formatPost() lays legs out as a Discord post.
// The slip of legs a post is built from lives in this module (addLeg...),
// kept on the device, so legs can be gathered from several player pages.
import {defenseCell} from './unified-finder-data.js';
import {band, outTonight} from './nba-matchup-score.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
const one = value => (Math.round(value * 10) / 10).toString();
const pct = value => `${Math.round(value)}%`;
const lineText = value => (Number.isInteger(Number(value)) ? String(Number(value)) : Number(value).toFixed(1));

export const STAT_SHORT = {player_points: 'PTS', player_rebounds: 'REB', player_assists: 'AST', player_threes: '3PM', player_steals: 'STL',
  player_blocks: 'BLK', player_points_rebounds: 'P+R', player_points_assists: 'P+A', player_rebounds_assists: 'R+A',
  player_points_rebounds_assists: 'PRA', player_blocks_steals: 'B+S', player_threes_attempts: '3PTA'};
// What a stat is made of, for which reasons fit it.
const PARTS = {player_points: ['pts'], player_rebounds: ['reb'], player_assists: ['ast'], player_threes: ['tpm'], player_threes_attempts: ['tpm'],
  player_steals: ['stl'], player_blocks: ['blk'], player_points_rebounds: ['pts', 'reb'], player_points_assists: ['pts', 'ast'],
  player_rebounds_assists: ['reb', 'ast'], player_points_rebounds_assists: ['pts', 'reb', 'ast'], player_blocks_steals: ['blk', 'stl']};
const POS_WORDS = {G: ['guards', 'guard'], F: ['forwards', 'forward'], C: ['centers', 'center']};
// The stat in words, in a sentence ("the 3rd most points") and in a heading.
const STAT_WORDS = {player_points: 'points', player_rebounds: 'rebounds', player_assists: 'assists', player_threes: 'made threes',
  player_threes_attempts: 'three-point tries', player_steals: 'steals', player_blocks: 'blocks', player_points_rebounds: 'points and rebounds',
  player_points_assists: 'points and assists', player_rebounds_assists: 'rebounds and assists', player_points_rebounds_assists: 'points, rebounds and assists',
  player_blocks_steals: 'blocks and steals'};
const HEADER_WORDS = {player_points: 'Points', player_rebounds: 'Rebounds', player_assists: 'Assists', player_threes: 'Threes Made',
  player_threes_attempts: '3-Point Attempts', player_steals: 'Steals', player_blocks: 'Blocks', player_points_rebounds: 'Pts + Rebs',
  player_points_assists: 'Pts + Asts', player_rebounds_assists: 'Rebs + Asts', player_points_rebounds_assists: 'Pts + Rebs + Asts', player_blocks_steals: 'Blks + Stls'};
const cap = text => text.charAt(0).toUpperCase() + text.slice(1);
// "the Heat" when the league numbers name the team, else its letters.
const teamWords = (league, abbr) => { const name = league?.teams?.[abbr]?.short || league?.teams?.[abbr]?.name; return name ? `the ${name}` : abbr; };
const listNames = items => { const names = items.map(item => item.name); return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]; };
const ZONES = {ra: 'at the rim', paint: 'in the paint', mid: 'from mid-range', ab3: 'from above-break 3', c3l: 'from the left corner 3', c3r: 'from the right corner 3'};
const THREES = new Set(['ab3', 'c3l', 'c3r']);
const posOf = value => {
  const code = String(value || '').toUpperCase().split('-')[0];
  return {PG: 'G', SG: 'G', G: 'G', SF: 'F', PF: 'F', F: 'F', C: 'C'}[code] || (code[0] === 'G' ? 'G' : code[0] === 'C' ? 'C' : code ? 'F' : null);
};
const shortName = name => {
  const parts = String(name || '').trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : parts[0] || '';
};

// A team's place among the league in a table cell [value, rank] (rank 1 the most).
const mostRank = cell => (finite(cell?.[1]) ? cell[1] : null);

/**
 * One prop's reasons: {key, header, score, facts: [{text, weight, kind}]}.
 * row: the list's row (player, team, opponent, position, startsAt, playerId);
 * marketKey/line: the prop written up; league: the Props tab's league numbers
 * (with tonight's reports); games: his game log, oldest first, each
 * {opponent, values: {marketKey: value}}; ctx: the player-context payload
 * (zones, similar, opportunity) or null; score: the matchup score.
 */
export function legFacts({row, marketKey, line, league, games = [], ctx = null, score = null, side = 'O'}) {
  const stat = STAT_SHORT[marketKey] || marketKey;
  const parts = PARTS[marketKey] || [];
  const opp = row.opponent;
  const pos = posOf(row.position);
  const [posWords, posSingle] = POS_WORDS[pos] || ['players at his spot', 'player at his spot'];
  const teams = league?.teamCount || league?.opportunity?.count || 30;
  const table = league?.opportunity?.teams?.[opp] || {};
  const facts = [];
  const add = (kind, weight, text) => { if (text && weight > 0) facts.push({kind, weight, text}); };

  // Every reason in plain words, for people who don't follow the numbers
  // (Oct 25, the owner: "I don't want so much numbers ... just explain it so
  // people understand that don't know much about sports"). At most a place
  // ("3rd most") or an "8 of his last 10"; no decimals, no per-100s.
  const them = teamWords(league, opp), They = cap(them);
  const what = STAT_WORDS[marketKey] || stat;

  // What they allow his position in this stat (each player at it).
  const cell = defenseCell({...row, sport: 'nba', position: pos || row.position, marketKey}, league?.dvpEach ? {...league, dvp: league.dvpEach} : league);
  if (cell && finite(cell.rank)) {
    const most = teams - cell.rank + 1;
    if (most <= 10) add('dvp', 12 - most, `🎯 ${They} give up the ${ordinal(most)} most ${what} to ${posWords} in the league`);
  }

  // The team's numbers that fit the stat.
  if (parts.includes('pts')) {
    const rating = mostRank(table.drtg);
    if (rating && rating <= 8) add('defense', 9 - rating, `🛡️ ${They} are one of the worst defenses in the league (${ordinal(rating)} worst), so scoring comes easy`);
  }
  if (parts.some(part => part === 'pts' || part === 'reb' || part === 'ast')) {
    const pace = mostRank(table.poss);
    if (pace && pace <= 6) add('pace', 7 - pace, `💨 ${They} play fast, one of the quickest teams in the league. Faster game, more chances for him`);
  }
  if (parts.includes('reb')) {
    const boards = mostRank(table.rebAllowed);
    if (boards && boards <= 10) add('boards', 11 - boards, `🧲 ${They} give up the ${ordinal(boards)} most rebounds in the league`);
    const fg = mostRank(table.fgPctAllowed);
    const lowest = fg ? teams - fg + 1 : null;
    if (lowest && lowest <= 8) add('misses', 9 - lowest, `🧱 Teams miss a lot of shots against ${them}, and every miss is a rebound up for grabs`);
  }
  if (parts.includes('ast')) {
    const assists = mostRank(table.astAllowed);
    if (assists && assists <= 10) add('assists', 11 - assists, `🤝 ${They} give up the ${ordinal(assists)} most assists in the league, so the ball moves easily against them`);
  }
  if (parts.includes('tpm')) {
    const tries = mostRank(table.tpaAllowed);
    if (tries && tries <= 10) add('tpa', 11 - tries, `🏹 ${They} leave shooters open: teams take the ${ordinal(tries)} most threes against them`);
    const made = mostRank(table.tpPctAllowed);
    if (made && made <= 8) add('tpPct', 9 - made, `🏹 Teams also make a lot of their threes against ${them} (${ordinal(made)} best in the league)`);
  }

  // Where he scores against where they give it up (shot zones).
  const zones = ctx?.zones, defense = league?.zoneDefense?.[opp];
  if (zones && defense && (parts.includes('pts') || parts.includes('tpm'))) {
    const points = zone => (zones[zone]?.[0] || 0) * (THREES.has(zone) ? 3 : 2);
    const kept = parts.includes('pts') ? Object.keys(ZONES) : [...THREES];
    const total = kept.reduce((sum, zone) => sum + (parts.includes('pts') ? points(zone) : zones[zone]?.[1] || 0), 0);
    const shareOf = zone => (total ? (parts.includes('pts') ? points(zone) : zones[zone]?.[1] || 0) / total * 100 : 0);
    const best = kept.filter(zone => shareOf(zone) >= 20 && finite(defense[zone]?.[1]))
      .map(zone => ({zone, share: shareOf(zone), highest: teams - defense[zone][1] + 1}))
      .filter(item => item.highest <= 10).sort((a, b) => a.highest - b.highest)[0];
    if (best) {
      const much = best.share >= 45 ? 'Most of' : best.share >= 30 ? 'A big chunk of' : 'A lot of';
      const his = parts.includes('pts') ? 'his points come' : 'his threes come';
      add('zones', 11 - best.highest, `📍 ${much} ${his} ${ZONES[best.zone]}, and that's one of the spots ${them} defend worst (${ordinal(best.highest)} worst in the league)`);
    }
  }

  // His chances (last 10 games).
  const chances = ctx?.opportunity?.l10;
  if (chances && parts.includes('reb') && finite(chances.rebShare) && chances.rebShare >= 14) {
    add('rebChances', 4, `🧲 When a shot misses with him on the court, he's one of the guys who goes and gets it`);
  }
  if (chances && parts.includes('ast') && finite(chances.astShare) && chances.astShare >= 20) {
    add('astChances', 3.5, `🤝 He sets up about 1 in every ${Math.max(2, Math.round(100 / chances.astShare))} of his teammates' baskets while he's on the court`);
  }
  if (chances && parts.includes('tpm') && finite(chances.tpa) && finite(line) && chances.tpa >= line * 2) {
    add('volume', 4, `🏹 He's been letting it fly lately, around ${Math.round(chances.tpa)} threes a game`);
  }
  if (chances && parts.length === 1 && parts[0] === 'pts' && finite(chances.usage) && chances.usage >= 25) {
    add('usage', 3, `🏀 The offense runs through him: he takes one of the biggest shares of his team's shots`);
  }

  // His games against the line.
  const values = games.map(game => game?.values?.[marketKey]).filter(finite);
  if (finite(line) && values.length) {
    const last10 = values.slice(-10), overs = last10.filter(value => value > line).length;
    if (overs * 10 >= last10.length * 6) add('hits', 3 + overs - last10.length / 2, `📈 He's gone over this line in ${overs} of his last ${last10.length} games`);
    const last5 = values.slice(-5), hot = last5.filter(value => value > line).length;
    if (last5.length >= 4 && hot >= 4) add('last5', 3.5, `🌡️ He's on a roll right now: over in ${hot} of his last ${last5.length}`);
    const meetings = games.filter(game => game?.opponent === opp).map(game => game.values?.[marketKey]).filter(finite).slice(-5);
    const hit = meetings.filter(value => value > line).length;
    if (meetings.length && hit * 2 >= meetings.length + (meetings.length > 1 ? 0 : 1)) add('h2h', 2 + hit, `🔁 He's done it against ${them} before: over in ${hit} of ${meetings.length} ${meetings.length === 1 ? 'game' : 'games'}`);
  }

  // Players like him against them (the player-context's similar list is for its own market).
  const similar = ctx?.market === marketKey ? (ctx?.similar?.[pos] || []) : [];
  if (similar.length >= 3) {
    const beat = similar.filter(item => finite(item.diff) && item.diff > 0).length;
    if (beat * 10 >= similar.length * 6) add('similar', 2 + beat / 2, `👀 Players like him have feasted on ${them}: ${beat} of the last ${similar.length} ${posWords} beat their usual numbers`);
  }
  const latest = similar.find(item => finite(item.value));
  if (latest && finite(latest.diff) && latest.diff > 0 && (!finite(line) || latest.value > line)) {
    add('lastFaced', 3, `👀 The last ${posSingle} to face ${them} (${shortName(latest.name)}) went well over his usual`);
  }

  // Who's out tonight: his teammates (minutes and shots to go around) and theirs.
  const mine = (outTonight(row.teamAbbr, league, row.playerId) || []).filter(item => item.sits >= 0.8 && item.min >= 18).slice(0, 3);
  if (mine.length) add('out', 6 + mine.length, `🚑 ${listNames(mine)} ${mine.length > 1 ? 'are' : 'is'} out, so more shots and minutes go his way`);
  const theirs = (outTonight(opp, league) || []).filter(item => item.sits >= 0.8 && item.min >= 20).slice(0, 2);
  if (theirs.length) add('oppOut', 4, `🚑 ${They} are missing ${listNames(theirs)}, which makes their defense weaker`);

  return {key: `${row.playerId || row.player}|${marketKey}`, player: row.player, team: row.teamAbbr, opponent: opp, marketKey,
    header: `${row.player} · ${side === 'U' ? 'Under' : 'Over'} ${finite(line) ? lineText(line) : ''} ${HEADER_WORDS[marketKey] || stat}`.replace(/\s+/g, ' ').trim(),
    score: finite(score) ? score : null, label: finite(score) ? band(score).label : null,
    facts: facts.sort((a, b) => b.weight - a.weight)};
}

/**
 * The post, in PropScout's own style (Oct 25, the owner: different emojis,
 * not a copy of the posts he showed): a title line, a small line with the
 * sport, size, units and confidence, then each leg as a heading with its
 * reasons quoted under it (Discord's grey bar) and its matchup grade in
 * small text, and a small sign-off. Discord markdown: ## / ### headings,
 * > quotes, -# small text, ** bold.
 */
export const TAGS = ['PICK', 'TOP PICK', 'BEST BET', 'LEAN', 'SLEEPER'];
export function formatPost(legs, {units = '', tag = 'PICK', confidence = '', perLeg = 3, footer = true, sport = 'NBA'} = {}) {
  if (!legs?.length) return '';
  const unit = String(units || '').trim().replace(/u$/i, '');
  const sure = String(confidence || '').trim();
  const lines = [`## 🔎 PropScout ${String(tag || 'PICK').toUpperCase()}${legs.length > 1 ? ` · ${legs.length}-Leg Parlay` : ''}`];
  lines.push(`-# 🏀 ${sport}${unit ? ` · ${unit} ${unit === '1' ? 'unit' : 'units'}` : ''}${sure ? ` · Confidence ${sure}/5` : ''}`);
  for (const leg of legs) {
    lines.push('', `### ${leg.header}`);
    for (const fact of (leg.facts || []).slice(0, perLeg)) lines.push(`> ${fact.text}`);
    if (finite(leg.score)) lines.push(`-# 📊 Matchup grade ${leg.score}/100${leg.label ? ` · ${leg.label}` : ''}`);
  }
  if (footer) lines.push('', '-# Researched with PropScout 🔎 Play it smart and stay within your limits');
  return lines.join('\n');
}

// ---------------------------------------------------------------- The slip
// The legs gathered for a post, from any player page, kept on this device.
const KEY = 'propscout:writeup:v2';
let slip = (() => { try { const saved = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(saved) ? saved : []; } catch { return []; } })();
const listeners = new Set();
const save = next => {
  slip = next;
  try { localStorage.setItem(KEY, JSON.stringify(slip)); } catch { /* this device only */ }
  listeners.forEach(listen => listen(slip));
};
export const writeupSlip = () => slip;
export const onWriteupSlip = listen => { listeners.add(listen); return () => listeners.delete(listen); };
export const addLeg = leg => save([...slip.filter(item => item.key !== leg.key), leg].slice(-6));
export const removeLeg = key => save(slip.filter(item => item.key !== key));
export const clearLegs = () => save([]);
