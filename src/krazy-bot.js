// Krazy Bot: answers questions about today's props in plain words.
//
// There is no outside service behind it. A question is matched to what it
// asks for (a stat, a side, a player, a team, how many), today's picks are
// ranked with the same graded reads the Smart Slip uses (smart-slip.js
// candidates: record, projection, matchup, books), and the reply is
// written from the numbers behind the pick -- every one checkable on the
// player's page. MLB first; the other sports plug into the same flow.

import {candidates, reasons, POWER} from './smart-slip.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const percent = value => `${Math.round(value * 100)}%`;
const figure = value => Number.isInteger(value) ? String(value) : value.toFixed(1);
const clean = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[’`]/g, "'").replace(/&/g, ' and ').replace(/\s+/g, ' ').trim();
const lastName = name => String(name || '').trim().split(/\s+/).filter(part => !/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(part)).at(-1) || name;
const GRADE_ORDER = {A: 0, B: 1, C: 2};
const NUMBER_WORDS = {one: 1, two: 2, three: 3, four: 4, five: 5, six: 6};
const FRESH_MS = 5 * 60 * 1000;

// What each MLB prop is called in a question, checked in this order (the
// specific before the general: "hits allowed" before "hits").
export const MLB_STATS = [
  {key: 'pitching:first-ks', name: '1st-inning strikeout', short: "1st-inning K's", first: true, words: [/strike ?outs?|\bk'?s?\b|punch ?outs?/]},
  {key: 'pitching:first-runs', name: '1st-inning runs allowed', short: '1st-inning runs allowed', first: true, words: [/\bruns?\b|nrfi|yrfi/]},
  {key: 'pitching:first-hits', name: '1st-inning hits allowed', short: '1st-inning hits allowed', first: true, words: [/\bhits?\b/]},
  {key: 'pitching:first-walks', name: '1st-inning walks allowed', short: '1st-inning walks', first: true, words: [/\bwalks?\b|\bbbs?\b/]},
  {key: 'pitching:first-pitches', name: '1st-inning pitch count', short: '1st-inning pitches', first: true, words: [/pitch(es| count)/]},
  {key: 'hitting:hrr', name: 'HRR', short: 'Hits+Runs+RBIs', words: [/\bhrr\b|\bh ?\+ ?r ?\+ ?rbis?\b|hits,? ?\+? ?(and )?runs,? ?\+? ?(and )?rbis?|hits runs (and )?rbis?/]},
  {key: 'hitting:runs-rbis', name: 'runs + RBIs', short: 'Runs+RBIs', words: [/runs? ?(\+|plus|and) ?rbis?/]},
  {key: 'hitting:hits-walks', name: 'hits + walks', short: 'Hits+Walks', words: [/hits? ?(\+|plus|and) ?walks?/]},
  {key: 'pitching:hr-allowed', name: 'home runs allowed', short: 'HR allowed', words: [/(home ?runs?|\bhrs?\b|homers?) allowed/]},
  {key: 'pitching:hits', name: 'hits allowed', short: 'hits allowed', words: [/hits? allowed/]},
  {key: 'pitching:walks', name: 'walks allowed', short: 'walks allowed', words: [/walks? allowed|\bbbs? allowed/]},
  {key: 'pitching:earned-runs', name: 'earned runs', short: 'earned runs', words: [/earned runs?|\bers?\b/]},
  {key: 'pitching:runs-allowed', name: 'runs allowed', short: 'runs allowed', words: [/runs? allowed/]},
  {key: 'hitting:strikeouts', name: 'hitter strikeout', short: "batter K's", words: [/(hitter|batter|batting)'?s? ?(strike ?outs?|k'?s?\b)|(strike ?outs?|k'?s?) (for|by) (a )?(hitter|batter)/]},
  {key: 'pitching:strikeouts', name: 'strikeout', short: "K's", words: [/strike ?outs?|\bk'?s\b|\bk props?\b|\bks\b|punch ?outs?|whiffs?/]},
  {key: 'pitching:outs', name: 'pitching outs', short: 'pitching outs', words: [/pitching outs|\bouts\b|outs recorded/]},
  {key: 'pitching:pitches', name: 'pitch count', short: 'pitches', words: [/pitch(es| count)|pitches thrown/]},
  {key: 'pitching:pitcher-fantasy', name: 'pitcher fantasy', short: 'pitcher fantasy points', words: [/pitcher('?s)? fantasy|fantasy (for|of) (a )?pitchers?/]},
  {key: 'hitting:tb', name: 'total bases', short: 'total bases', words: [/total bases|\btbs?\b/]},
  {key: 'hitting:hr', name: 'home run', short: 'home runs', words: [/home ?runs?|\bhrs?\b|homers?|dingers?|long ?balls?|\bbombs?\b/]},
  {key: 'hitting:hits', name: 'hits', short: 'hits', words: [/\bhits?\b/]},
  {key: 'hitting:rbi', name: 'RBI', short: 'RBIs', words: [/\brbis?\b|runs batted in/]},
  {key: 'hitting:runs', name: 'runs', short: 'runs', words: [/\bruns?( scored)?\b/]},
  {key: 'hitting:walks', name: 'walks', short: 'walks', words: [/\bwalks?\b|\bbbs?\b/]},
  {key: 'hitting:sb', name: 'stolen base', short: 'stolen bases', words: [/stolen bases?|\bsteals?\b|\bsbs?\b/]},
  {key: 'hitting:singles', name: 'singles', short: 'singles', words: [/singles?/]},
  {key: 'hitting:doubles', name: 'doubles', short: 'doubles', words: [/doubles?/]},
  {key: 'hitting:triples', name: 'triples', short: 'triples', words: [/triples?/]},
  {key: 'hitting:xbh', name: 'extra-base hit', short: 'extra-base hits', words: [/extra[ -]?base hits?|\bxbh\b/]},
  {key: 'hitting:fantasy', name: 'fantasy', short: 'fantasy points', words: [/fantasy/]},
];

// Team names as people type them, to the abbreviations the board uses.
const MLB_TEAMS = {
  'diamondbacks|d-?backs|arizona': ['ARI', 'AZ'], 'braves|atlanta': ['ATL'], 'orioles|baltimore|o\'s': ['BAL'],
  'red sox|boston': ['BOS'], 'cubs': ['CHC'], 'white sox': ['CHW', 'CWS'], 'reds|cincinnati': ['CIN'],
  'guardians|cleveland': ['CLE'], 'rockies|colorado': ['COL'], 'tigers|detroit': ['DET'], 'astros|houston': ['HOU'],
  'royals|kansas city': ['KC', 'KCR'], 'angels': ['LAA'], 'dodgers': ['LAD'], 'marlins|miami': ['MIA'],
  'brewers|milwaukee': ['MIL'], 'twins|minnesota': ['MIN'], 'mets': ['NYM'], 'yankees|yanks': ['NYY'],
  'athletics|a\'s': ['ATH', 'OAK'], 'phillies|philadelphia|phils': ['PHI'], 'pirates|pittsburgh': ['PIT'],
  'padres|san diego': ['SD', 'SDP'], 'giants|san francisco': ['SF', 'SFG'], 'mariners|seattle': ['SEA'],
  'cardinals|st\\.? louis': ['STL'], 'rays|tampa': ['TB', 'TBR'], 'rangers|texas': ['TEX'],
  'blue jays|toronto|jays': ['TOR'], 'nationals|washington|nats': ['WSH', 'WAS'],
};
const OTHER_SPORTS = /\b(nba|wnba|nfl|nhl|ncaa|basketball|football|hockey|tennis|soccer|cs2|csgo|counter[ -]?strike|golf|ufc|mma)\b/;

// ---------------------------------------------------------------- understanding

/** What a question asks for. */
export function understand(text) {
  const q = clean(text);
  const ask = {text: q, intent: 'best', stat: null, side: null, count: 1, team: null, modifier: null};
  if (!q) return {...ask, intent: 'help'};
  if (/^(hi|hey|hello|yo|sup|what'?s up|gm|good (morning|afternoon|evening))\b[\s!.?]*$/.test(q)) return {...ask, intent: 'hello'};
  if (/^(thanks?|thank you|ty|appreciate (it|you)|nice|bet|good looks?|lets go|let'?s go)\b/.test(q)) return {...ask, intent: 'thanks'};
  if (/^(help|what can you (do|answer)|how (do|does) (this|you) work|commands|examples?)\b/.test(q)) return {...ask, intent: 'help'};
  if (/^(why|how come|explain|reasons?|break ?(it|that) down|tell me more|more (info|details)|details|whys?)\b/.test(q)) return {...ask, intent: 'why'};
  if (/^(another|next|someone else|anyone else|other|different|give me another|one more|next one|who else)\b/.test(q)
      || /\b(another one|someone else|next best|second best|different one)\b/.test(q)) ask.intent = 'another';
  if (OTHER_SPORTS.test(q) && !/\b(mlb|baseball)\b/.test(q)) return {...ask, intent: 'other-sport'};

  const first = /\b(1st|first) (inning|inn)\b|\bnrfi\b|\byrfi\b/.test(q);
  for (const stat of MLB_STATS) {
    if (Boolean(stat.first) !== first) continue;
    if (stat.words.some(pattern => pattern.test(q))) { ask.stat = stat; break; }
  }
  // "More" is too common ("more picks") to read as a side; over and under aren't.
  if (/\b(under|less|lower|fade)\b/.test(q)) ask.side = 'UNDER';
  else if (/\b(over|higher)\b/.test(q)) ask.side = 'OVER';
  if (/\bgoblins?\b/.test(q)) ask.modifier = 'goblin';
  if (/\bdemons?\b/.test(q)) ask.modifier = 'demon';

  const counted = q.match(/\b(?:top|best|give me|show me)\s+(\d|one|two|three|four|five|six)\b/) || q.match(/\b(\d|two|three|four|five|six)\s+(?:best|top|picks?|plays?|props?|legs?)\b/);
  if (counted) ask.count = Math.max(1, Math.min(5, Number(counted[1]) || NUMBER_WORDS[counted[1]] || 1));

  for (const [names, codes] of Object.entries(MLB_TEAMS)) {
    if (new RegExp(`\\b(${names})\\b`).test(q)) { ask.team = codes; break; }
  }
  if (/\b(slip|parlay|entry|lineup|power play|flex( play)?|combo)\b|\b\d[ -]?(pick|leg|man)\b/.test(q)) {
    const legs = q.match(/\b(\d|two|three|four|five|six)[ -]?(pick|leg|man|player)/);
    return {...ask, intent: 'slip', count: Math.max(2, Math.min(6, Number(legs?.[1]) || NUMBER_WORDS[legs?.[1]] || 3))};
  }
  if (ask.intent === 'another') return ask;
  if (/\b(safe(st)?|lock|locks|sure|surest|most likely|highest (chance|percent|probability)|confident|banker)\b/.test(q)) ask.intent = 'safest';
  else if (/\bmatch ?ups?\b|\bmismatch\b|\bexploit\b|\bweak(est)? (pitcher|lineup|opponent)\b/.test(q)) ask.intent = 'matchup';
  return ask;
}

/** The board player a question names, matched on the full name or a distinct last name. */
export function findPlayer(text, names) {
  const q = ` ${clean(text).replace(/[^a-z0-9' ]/g, ' ')} `;
  const people = [...new Set(names)].filter(Boolean);
  const full = people.filter(name => q.includes(` ${clean(name).replace(/[^a-z0-9' ]/g, ' ')} `));
  if (full.length) return full.sort((a, b) => b.length - a.length)[0];
  const stopWords = new Set(MLB_STATS.flatMap(stat => clean(stat.name).split(' ')).concat(['best', 'today', 'prop', 'props', 'play', 'over', 'under']));
  const byLast = people.filter(name => {
    const last = clean(lastName(name)).replace(/[^a-z0-9']/g, '');
    return last.length >= 4 && !stopWords.has(last) && q.includes(` ${last} `);
  });
  const lasts = new Set(byLast.map(name => clean(lastName(name))));
  return lasts.size === 1 ? byLast[0] : null;
}

// ---------------------------------------------------------------- ranking

const matchupOf = leg => leg.read?.factors?.find(item => item.key === 'matchup') || null;
const matchupLift = leg => {
  const item = matchupOf(leg);
  return item ? (item.factor - 1) * (leg.side === 'UNDER' ? -1 : 1) : 0;
};
const byGrade = (a, b) => (GRADE_ORDER[a.grade] ?? 3) - (GRADE_ORDER[b.grade] ?? 3) || b.chance - a.chance;

/** Today's picks for a question, best first, one per player. */
export function rank(legs, ask) {
  let pool = legs.filter(leg => String(leg.row?.sport || 'mlb') === 'mlb');
  pool = pool.filter(leg => ask.modifier ? leg.modifier === ask.modifier : leg.modifier === 'standard');
  if (ask.stat) pool = pool.filter(leg => leg.row.marketKey === ask.stat.key);
  if (ask.side) pool = pool.filter(leg => leg.side === ask.side);
  if (ask.team) pool = pool.filter(leg => ask.team.includes(String(leg.row.teamAbbr || '').toUpperCase()));
  if (ask.player) pool = pool.filter(leg => leg.player === ask.player);
  const order = ask.intent === 'safest' ? (a, b) => b.chance - a.chance
    : ask.intent === 'matchup' ? (a, b) => (matchupLift(b) >= 0.03) - (matchupLift(a) >= 0.03) || matchupLift(b) - matchupLift(a) || byGrade(a, b)
      : byGrade;
  const seen = new Set();
  return [...pool].sort(order).filter(leg => !seen.has(leg.player) && seen.add(leg.player));
}

// ---------------------------------------------------------------- writing

const pick = (list, random) => list[Math.floor(random() * list.length) % list.length];
const sideWord = leg => leg.side === 'UNDER' ? 'under' : 'over';
const statShort = leg => MLB_STATS.find(stat => stat.key === leg.row.marketKey && !stat.first)?.short
  || MLB_STATS.find(stat => stat.key === leg.row.marketKey)?.short || String(leg.row.market || '').toLowerCase();
// Mid-sentence, the analyst's own phrases start lowercase; names and team codes keep their capitals.
const lower = text => /^(Faces|The|Only|Tough|Pitches|Plate|Playing|Second)\b/.test(text || '') ? text[0].toLowerCase() + text.slice(1) : text;

/** "Tarik Skubal over 6.5 K's vs KC" */
export function pickLine(leg) {
  const opponent = leg.row.opponent ? ` vs ${leg.row.opponent}` : '';
  return `${leg.player} ${sideWord(leg)} ${figure(leg.row.line)} ${statShort(leg)}${opponent}`;
}

/** The numbers behind a pick as short clauses, strongest first. */
export function evidence(leg) {
  const name = lastName(leg.player);
  const records = leg.records || {};
  const out = [];
  const recent = records.l10 || records.l5;
  if (recent) out.push(`${name} has gone ${sideWord(leg)} in ${recent.won} of his last ${recent.games}`);
  const projection = leg.read?.projection;
  if (finite(projection)) out.push(`projects for ${figure(Math.round(projection * 10) / 10)} against the ${figure(leg.row.line)} line`);
  const matchup = matchupOf(leg);
  if (matchup?.text && matchupLift(leg) >= 0) out.push(lower(matchup.text));
  if (finite(leg.book)) out.push(`the books have it at ${percent(leg.book)}`);
  if (records.h2h && records.h2h.games >= 2 && leg.row.opponent) out.push(`he's ${records.h2h.won}/${records.h2h.games} against ${leg.row.opponent}`);
  if (records.season && records.season.games > (recent?.games || 0)) out.push(`${records.season.won} of ${records.season.games} on the season`);
  for (const item of reasons(leg)) {
    if (item.key === 'streak') out.push(`he's hit it ${item.strong} straight`);
    if (item.key === 'defense') out.push(`${leg.row.opponent} are ${item.strong} in ${item.label.replace(/ \(.*\)$/, '')}`);
  }
  return out;
}

const join = parts => parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
const sentence = text => text ? text[0].toUpperCase() + text.slice(1).replace(/[.\s]*$/, '.') : '';

function single(leg, opener, random) {
  const facts = evidence(leg).slice(0, 3);
  const risk = leg.read?.risks?.[0];
  const watch = risk ? ` ${pick(['One thing to watch:', 'Only knock:', 'Watch out:'], random)} ${lower(risk)}.` : '';
  return `${opener} ${pickLine(leg)} (grade ${leg.grade}, ${percent(leg.chance)} to hit). ${sentence(join(facts))}${watch}`.replace(/\s+/g, ' ').trim();
}

function list(legs, label) {
  const items = legs.map((leg, index) => `${index + 1}) ${pickLine(leg)}, ${leg.grade}, ${percent(leg.chance)}`);
  return `${label} ${items.join('; ')}. Ask "why" for the breakdown on #1.`;
}

const OPENERS = {
  best: stat => stat ? [`My top ${stat.name} play today:`, `Best ${stat.name} prop on the board:`, `If I'm taking one ${stat.name} prop, it's`, `The ${stat.name} prop I like most:`]
    : ['My favorite play on the board:', 'Top play today:', "If I'm picking one prop, it's", 'Best spot on the slate:'],
  safest: stat => [`Safest ${stat ? stat.name + ' ' : ''}look today:`, `Most likely ${stat ? stat.name + ' prop ' : ''}to hit:`, `The surest ${stat ? stat.name + ' ' : ''}play I see:`],
  matchup: stat => [`Best ${stat ? stat.name + ' ' : ''}matchup on today's slate:`, 'The matchup that jumps off the page:', 'Biggest edge from a matchup today:'],
  another: () => ['Next up:', 'Another one I like:', 'Here\'s the next best:', 'Right behind it:'],
};

export const EXAMPLES = ['Best K prop today', 'Best HRR prop', 'Best matchup today', 'Safest pick', 'Build me a 3-pick slip'];

const HELP = 'I break down today\'s MLB props using our models: record vs the line, projections, pitcher and lineup matchups and the books. Try "best K prop", "best HRR prop", "best matchup today", "safest pick", "top 3 total bases", a player\'s name, or "build me a 3-pick slip".';

/**
 * The bot. `load` resolves today's rows for a sport (finder-pool loadLines);
 * `judge` turns rows into graded picks (Smart Slip candidates by default).
 */
export function createBot({load, judge = rows => candidates(rows), now = () => Date.now(), random = Math.random} = {}) {
  let state = {rows: [], legs: [], at: 0, failed: false};
  let pending = null;
  let memory = null;  // the last answer: its question, its ranked picks, which one was shown

  async function board() {
    if (state.at && now() - state.at < FRESH_MS) return state;
    pending ||= (async () => {
      try {
        const rows = await load('mlb');
        state = {rows, legs: judge(rows), at: now(), failed: false};
      } catch {
        state = {...state, failed: !state.legs.length};
      } finally { pending = null; }
      return state;
    })();
    return pending;
  }

  function answerPick(ask, ranked, index = 0) {
    memory = {ask, ranked, index};
    const leg = ranked[index];
    const name = lastName(leg.player);
    const opener = ask.player && index === 0 ? pick([`Best way to play ${name} today:`, `For ${name}, I like`, `${name}'s best prop today:`], random)
      : pick((OPENERS[ask.intent] || OPENERS.best)(ask.stat), random);
    return single(leg, opener, random);
  }

  async function ask(text) {
    const question = understand(text);
    if (question.intent === 'hello') return pick(['Hey! What are we looking at today?', 'What\'s good. Ask me about today\'s MLB props.', 'Yo. Want the best play on the board?'], random) + ' ' + 'Try "best K prop" or "best matchup today".';
    if (question.intent === 'help') return HELP;
    if (question.intent === 'thanks') return pick(['Anytime. Want another one?', 'Good luck on it. Ask me for another anytime.', 'Bet. Need a slip to go with it?'], random);
    if (question.intent === 'other-sport') return 'I\'m locked in on MLB right now, more sports are coming soon. Ask me about today\'s baseball props.';

    if (question.intent === 'why') {
      const leg = memory?.ranked?.[memory.index];
      if (!leg) return 'Ask me for a pick first, like "best K prop", and I\'ll break it down.';
      const facts = evidence(leg);
      const risks = leg.read?.risks || [];
      return `Why ${pickLine(leg)}: ${join(facts.slice(0, 5))}.${risks.length ? ` Risks: ${join(risks.map(lower))}.` : ' Nothing major argues against it.'} Grade ${leg.grade}, ${percent(leg.chance)} to hit.`;
    }
    if (question.intent === 'another') {
      if (!memory?.ranked?.length) return 'Ask me for a pick first, like "best HRR prop", then I can give you the next one.';
      const next = memory.index + 1;
      if (next >= memory.ranked.length) return 'That\'s everything I\'d back for that one. Ask about another stat or "best matchup today".';
      memory = {...memory, ask: {...memory.ask, intent: 'another'}};
      return answerPick(memory.ask, memory.ranked, next);
    }

    const {rows, legs, failed} = await board();
    if (failed) return 'I can\'t reach today\'s lines right now. Give it a minute and ask again.';
    if (!rows.length) return 'There aren\'t any MLB props posted right now. Check back closer to first pitch.';

    const player = findPlayer(text, rows.map(row => row.player));
    if (player) question.player = player;

    if (question.intent === 'slip') {
      const chosen = [];
      const games = new Set();
      for (const leg of rank(legs, {...question, intent: 'safest', count: 6})) {
        if (leg.grade === 'C' || games.has(leg.game)) continue;
        chosen.push(leg); games.add(leg.game);
        if (chosen.length === question.count) break;
      }
      if (chosen.length < question.count) return `I only see ${chosen.length || 'no'} pick${chosen.length === 1 ? '' : 's'} I'd trust from different games right now, not enough for a ${question.count}-pick slip. Try a smaller one.`;
      const together = chosen.reduce((product, leg) => product * leg.chance, 1);
      memory = {ask: question, ranked: chosen, index: 0};
      const payout = POWER[chosen.length];
      return `Here's a ${chosen.length}-pick slip I like: ${chosen.map(pickLine).join('; ')}. Every leg grades B or better and they're from different games. All ${chosen.length} hit about ${percent(together)} of the time${payout ? `, a ${payout}x Power Play` : ''}. Ask "why" for the first leg.`;
    }

    const ranked = rank(legs, question);
    if (player && !ranked.length) {
      const lines = rows.filter(row => row.player === player && String(row.modifier || 'standard').toLowerCase() === 'standard');
      if (!lines.length) return `${player} isn't on today's board.`;
      const markets = [...new Set(lines.map(row => `${figure(row.line)} ${MLB_STATS.find(stat => stat.key === row.marketKey)?.short || row.market}`))].slice(0, 3);
      return `${player} is on the board for ${join(markets)}, but none of his lines has a clear edge in our numbers. I'd pass on him today.`;
    }
    if (!ranked.length) {
      const what = [question.side ? sideWord({side: question.side}) : null, question.stat?.name, question.team ? 'for that team' : null].filter(Boolean).join(' ');
      return `I don't see a${what ? ` ${what}` : ''} prop I'd back right now. Try "best matchup today" or another stat.`;
    }
    if (question.count > 1) {
      memory = {ask: question, ranked, index: 0};
      const label = `Top ${Math.min(question.count, ranked.length)} ${question.stat ? question.stat.name + ' ' : ''}props today:`;
      return list(ranked.slice(0, question.count), label);
    }
    return answerPick(question, ranked);
  }

  return {ask, board};
}
