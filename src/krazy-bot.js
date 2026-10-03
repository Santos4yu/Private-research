// Krazy Bot: answers questions about today's props in plain words.
//
// There is no outside service behind it. A question is read for what it
// asks (a stat, a side, a line, players, a team, a sport, how many), with
// typos and slang straightened out first and the conversation so far
// filling in what a follow-up leaves unsaid ("what about the under?",
// "is he safe?"). Today's picks are ranked with the same graded reads the
// Smart Slip uses (smart-slip.js: record vs the line, projection,
// matchup, books), and the reply is written from the numbers behind the
// pick -- every one checkable on the player's page. A small profile per
// member (what they ask about) lets it pick up where they left off.

import {candidates, reasons, POWER, assessLeg, gameKey} from './smart-slip.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const percent = value => `${Math.round(value * 100)}%`;
const figure = value => Number.isInteger(value) ? String(value) : value.toFixed(1);
const nameKey = value => String(value || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const clean = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[’`]/g, "'").replace(/&/g, ' and ').replace(/\s+/g, ' ').trim();
const lastName = name => String(name || '').trim().split(/\s+/).filter(part => !/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(part)).at(-1) || name;
const GRADE_ORDER = {A: 0, B: 1, C: 2};
const NUMBER_WORDS = {one: 1, two: 2, three: 3, four: 4, five: 5, six: 6};
const FRESH_MS = 5 * 60 * 1000;
const DAY_MS = 86400000;

// ---------------------------------------------------------------- sports

// MLB rows carry a marketKey (prop-finder-core.js); NBA and NHL rows are
// matched on their PrizePicks stat name. Specific before general.
const mlb = (key, name, short, words, extra = {}) => ({sport: 'mlb', key, name, short, words, ...extra});
const byLabel = (sport, key, name, short, labels, words, extra = {}) => ({sport, key, name, short, labels, words, ...extra});

export const MLB_STATS = [
  mlb('pitching:first-ks', '1st-inning strikeout', "1st-inning K's", [/strike ?outs?|\bk'?s?\b|punch ?outs?/], {first: true}),
  mlb('pitching:first-runs', '1st-inning runs allowed', '1st-inning runs allowed', [/\bruns?\b|nrfi|yrfi/], {first: true}),
  mlb('pitching:first-hits', '1st-inning hits allowed', '1st-inning hits allowed', [/\bhits?\b/], {first: true}),
  mlb('pitching:first-walks', '1st-inning walks allowed', '1st-inning walks', [/\bwalks?\b|\bbbs?\b/], {first: true}),
  mlb('pitching:first-pitches', '1st-inning pitch count', '1st-inning pitches', [/pitch(es| count)/], {first: true}),
  mlb('hitting:hrr', 'HRR', 'Hits+Runs+RBIs', [/\bhrr\b|\bh ?\+ ?r ?\+ ?rbis?\b|hits,? ?\+? ?(and )?runs,? ?\+? ?(and )?rbis?|hits runs (and )?rbis?/]),
  mlb('hitting:runs-rbis', 'runs + RBIs', 'Runs+RBIs', [/runs? ?(\+|plus|and) ?rbis?/]),
  mlb('hitting:hits-walks', 'hits + walks', 'Hits+Walks', [/hits? ?(\+|plus|and) ?walks?/]),
  mlb('pitching:hr-allowed', 'home runs allowed', 'HR allowed', [/(home ?runs?|\bhrs?\b|homers?) allowed/]),
  mlb('pitching:hits', 'hits allowed', 'hits allowed', [/hits? allowed/]),
  mlb('pitching:walks', 'walks allowed', 'walks allowed', [/walks? allowed|\bbbs? allowed|pitcher walks?/]),
  mlb('pitching:earned-runs', 'earned runs', 'earned runs', [/earned runs?|\bers?\b/]),
  mlb('pitching:runs-allowed', 'runs allowed', 'runs allowed', [/runs? allowed/]),
  mlb('hitting:strikeouts', 'hitter strikeout', "batter K's", [/(hitter|batter|batting)'?s? ?(strike ?outs?|k'?s?\b)|(strike ?outs?|k'?s?) (for|by) (a )?(hitter|batter)/]),
  mlb('pitching:strikeouts', 'strikeout', "K's", [/strike ?outs?|\bk'?s\b|\bk props?\b|\bks\b|punch ?outs?|whiffs?/]),
  mlb('pitching:outs', 'pitching outs', 'pitching outs', [/pitching outs|\bouts\b|outs recorded/]),
  mlb('pitching:pitches', 'pitch count', 'pitches', [/pitch(es| count)|pitches thrown/]),
  mlb('pitching:pitcher-fantasy', 'pitcher fantasy', 'pitcher fantasy points', [/pitcher('?s)? fantasy|fantasy (for|of) (a )?pitchers?/]),
  mlb('hitting:tb', 'total bases', 'total bases', [/total bases|\btbs?\b/]),
  mlb('hitting:hr', 'home run', 'home runs', [/home ?runs?|\bhrs?\b|homers?|dingers?|long ?balls?|\bbombs?\b/]),
  mlb('hitting:hits', 'hits', 'hits', [/\bhits?\b/], {shared: true}),
  mlb('hitting:rbi', 'RBI', 'RBIs', [/\brbis?\b|runs batted in/]),
  mlb('hitting:runs', 'runs', 'runs', [/\bruns?( scored)?\b/]),
  mlb('hitting:walks', 'walks', 'walks', [/\bwalks?\b|\bbbs?\b/]),
  mlb('hitting:sb', 'stolen base', 'stolen bases', [/stolen bases?|\bsteals?\b|\bsbs?\b/]),
  mlb('hitting:singles', 'singles', 'singles', [/singles?/]),
  mlb('hitting:doubles', 'doubles', 'doubles', [/\bdoubles\b/]),
  mlb('hitting:triples', 'triples', 'triples', [/triples?/]),
  mlb('hitting:xbh', 'extra-base hit', 'extra-base hits', [/extra[ -]?base hits?|\bxbh\b/]),
  mlb('hitting:fantasy', 'fantasy', 'fantasy points', [/fantasy/], {shared: true}),
];

export const NBA_STATS = [
  byLabel('nba', 'pra', 'PRA', 'Pts+Rebs+Asts', ['ptsrebsasts', 'pra'], [/\bpra\b|points? ?(\+|and|plus)? ?rebounds? ?(\+|and|plus)? ?assists?|pts ?\+ ?rebs ?\+ ?asts/]),
  byLabel('nba', 'pr', 'points + rebounds', 'Pts+Rebs', ['ptsrebs'], [/points? ?(\+|and|plus) ?rebounds?|pts ?\+ ?rebs/]),
  byLabel('nba', 'pa', 'points + assists', 'Pts+Asts', ['ptsasts'], [/points? ?(\+|and|plus) ?assists?|pts ?\+ ?asts/]),
  byLabel('nba', 'ra', 'rebounds + assists', 'Rebs+Asts', ['rebsasts'], [/rebounds? ?(\+|and|plus) ?assists?|rebs ?\+ ?asts/]),
  byLabel('nba', 'stocks', 'blocks + steals', 'Blks+Stls', ['blksstls', 'blocksstls', 'stealsblocks'], [/(blocks?|blks) ?(\+|and|plus) ?(steals?|stls)|\bstocks\b/]),
  byLabel('nba', '3pa', '3-point attempts', '3-PT attempted', ['3ptattempted', 'threepointersattempted'], [/(3|three)[ -]?(pt|point|pointers?)s? attempt|\b3pa\b/]),
  byLabel('nba', '3pm', '3-pointers', '3-PT made', ['3ptmade', 'threepointersmade', '3pointersmade'], [/\bthrees\b|\b3s\b|(3|three)[ -]?(pt|point|pointers?)s?( made)?|\b3pm\b|treys/]),
  byLabel('nba', 'fgm', 'field goals made', 'FG made', ['fgmade', 'fieldgoalsmade'], [/field goals?( made)?|\bfgm\b|fg made/]),
  byLabel('nba', 'ftm', 'free throws made', 'free throws made', ['freethrowsmade', 'ftmade'], [/free throws?( made)?|\bftm\b/]),
  byLabel('nba', 'dd', 'double-double', 'double-double', ['doubledouble'], [/double[ -]?double/]),
  byLabel('nba', 'td', 'triple-double', 'triple-double', ['tripledouble'], [/triple[ -]?double/]),
  byLabel('nba', 'rebounds', 'rebounds', 'rebounds', ['rebounds'], [/\brebounds?\b|\brebs?\b|\bboards\b/]),
  byLabel('nba', 'assists', 'assists', 'assists', ['assists'], [/\bassists?\b|\basts?\b|\bdimes\b/], {shared: true}),
  byLabel('nba', 'steals', 'steals', 'steals', ['steals'], [/\bsteals?\b|\bstls?\b/]),
  byLabel('nba', 'blocks', 'blocks', 'blocks', ['blockedshots', 'blocks'], [/\bblocks?\b|blocked shots?|\bblks?\b/], {shared: true}),
  byLabel('nba', 'turnovers', 'turnovers', 'turnovers', ['turnovers'], [/turnovers?|\btos\b/]),
  byLabel('nba', 'points', 'points', 'points', ['points'], [/\bpoints?\b|\bpts\b|scoring|buckets/], {shared: true}),
  byLabel('nba', 'fantasy', 'fantasy', 'fantasy points', ['fantasyscore'], [/fantasy/], {shared: true}),
];

export const NHL_STATS = [
  byLabel('nhl', 'sog', 'shots on goal', 'shots on goal', ['shotsongoal', 'sog'], [/shots? on goal|\bsog\b|\bshots\b(?! blocked| attempt)/]),
  byLabel('nhl', 'saves', 'goalie saves', 'saves', ['goaliesaves', 'saves', 'totalsaves'], [/\bsaves?\b|goalies?/]),
  byLabel('nhl', 'ga', 'goals against', 'goals against', ['goalsallowed', 'goalsagainst'], [/goals? (allowed|against)/]),
  byLabel('nhl', 'ppp', 'power-play points', 'power-play points', ['powerplaypoints', 'powerplaypts', 'ppp'], [/power ?play points?|\bppp\b/]),
  byLabel('nhl', 'hits-blocks', 'hits + blocks', 'hits+blocks', ['hitsblockedshots', 'blockedshotshits'], [/hits? ?(\+|and|plus) ?blocks?/]),
  byLabel('nhl', 'blocked', 'blocked shots', 'blocked shots', ['blockedshots', 'blocks', 'shotsblocked'], [/blocked shots?|\bblocks?\b/], {shared: true}),
  byLabel('nhl', 'fow', 'faceoffs won', 'faceoffs won', ['faceoffswon', 'faceoffwins'], [/faceoffs?( won| wins)?|face offs?|\bfow\b/]),
  byLabel('nhl', 'toi', 'time on ice', 'time on ice', ['timeonice', 'toi'], [/time on ice|\btoi\b/]),
  byLabel('nhl', 'attempts', 'shot attempts', 'shot attempts', ['shotattempts', 'shotsattempted'], [/shot attempts?/]),
  byLabel('nhl', 'goals', 'goals', 'goals', ['goals'], [/\bgoals?\b|goal ?scorer/]),
  byLabel('nhl', 'assists', 'assists', 'assists', ['assists'], [/\bassists?\b/], {shared: true}),
  byLabel('nhl', 'points', 'points', 'points', ['points'], [/\bpoints?\b|\bpts\b/], {shared: true}),
  byLabel('nhl', 'hits', 'hits', 'hits', ['hits'], [/\bhits?\b/], {shared: true}),
  byLabel('nhl', 'pim', 'penalty minutes', 'penalty minutes', ['penaltyminutes', 'pim'], [/penalty minutes|\bpim\b/]),
  byLabel('nhl', 'fantasy', 'fantasy', 'fantasy points', ['fantasyscore', 'goaliefantasyscore'], [/fantasy/], {shared: true}),
];

const teamMap = entries => Object.entries(entries).map(([names, codes]) => ({pattern: new RegExp(`\\b(${names})\\b`), codes}));
const MLB_TEAMS = teamMap({
  'diamondbacks|d-?backs|arizona': ['ARI', 'AZ'], 'braves|atlanta': ['ATL'], 'orioles|baltimore': ['BAL'],
  'red sox|boston': ['BOS'], 'cubs': ['CHC'], 'white sox': ['CHW', 'CWS'], 'reds|cincinnati': ['CIN'],
  'guardians|cleveland': ['CLE'], 'rockies|colorado': ['COL'], 'tigers|detroit': ['DET'], 'astros|houston': ['HOU'],
  'royals|kansas city': ['KC', 'KCR'], 'angels': ['LAA'], 'dodgers': ['LAD'], 'marlins|miami': ['MIA'],
  'brewers|milwaukee': ['MIL'], 'twins|minnesota': ['MIN'], 'mets': ['NYM'], 'yankees|yanks': ['NYY'],
  'athletics': ['ATH', 'OAK'], 'phillies|philadelphia|phils': ['PHI'], 'pirates|pittsburgh': ['PIT'],
  'padres|san diego': ['SD', 'SDP'], 'giants|san francisco': ['SF', 'SFG'], 'mariners|seattle': ['SEA'],
  'cardinals|st\\.? louis': ['STL'], 'rays|tampa': ['TB', 'TBR'], 'rangers|texas': ['TEX'],
  'blue jays|toronto|jays': ['TOR'], 'nationals|washington|nats': ['WSH', 'WAS'],
});
const NBA_TEAMS = teamMap({
  'hawks': ['ATL'], 'celtics': ['BOS'], 'nets|brooklyn': ['BKN', 'BRK'], 'hornets|charlotte': ['CHA', 'CHO'], 'bulls': ['CHI'],
  'cavaliers|cavs': ['CLE'], 'mavericks|mavs|dallas': ['DAL'], 'nuggets|denver': ['DEN'], 'pistons': ['DET'],
  'warriors|golden state|dubs': ['GS', 'GSW'], 'rockets': ['HOU'], 'pacers|indiana': ['IND'], 'clippers': ['LAC'],
  'lakers': ['LAL'], 'grizzlies|memphis': ['MEM'], 'heat': ['MIA'], 'bucks': ['MIL'], 'timberwolves|wolves': ['MIN'],
  'pelicans|new orleans': ['NO', 'NOP'], 'knicks': ['NY', 'NYK'], 'thunder|okc|oklahoma city': ['OKC'], 'magic|orlando': ['ORL'],
  '76ers|sixers': ['PHI'], 'suns|phoenix': ['PHX', 'PHO'], 'trail blazers|blazers|portland': ['POR'],
  'kings|sacramento': ['SAC'], 'spurs|san antonio': ['SA', 'SAS'], 'raptors': ['TOR'], 'jazz|utah': ['UTA', 'UTAH'], 'wizards': ['WAS', 'WSH'],
});
const NHL_TEAMS = teamMap({
  'ducks|anaheim': ['ANA'], 'bruins': ['BOS'], 'sabres|buffalo': ['BUF'], 'flames|calgary': ['CGY'], 'hurricanes|canes|carolina': ['CAR'],
  'blackhawks|hawks': ['CHI'], 'avalanche|avs': ['COL'], 'blue jackets|columbus': ['CBJ'], 'stars': ['DAL'], 'red wings|wings': ['DET'],
  'oilers|edmonton': ['EDM'], 'panthers|florida': ['FLA'], 'kings': ['LA', 'LAK'], 'wild': ['MIN'], 'canadiens|habs|montreal': ['MTL'],
  'predators|preds|nashville': ['NSH'], 'devils|new jersey': ['NJ', 'NJD'], 'islanders|isles': ['NYI'], 'rangers': ['NYR'],
  'senators|sens|ottawa': ['OTT'], 'flyers': ['PHI'], 'penguins|pens': ['PIT'], 'sharks|san jose': ['SJ', 'SJS'],
  'kraken': ['SEA'], 'blues': ['STL'], 'lightning|bolts': ['TB', 'TBL'], 'maple leafs|leafs': ['TOR'], 'utah hockey|mammoth': ['UTA', 'UTAH'],
  'canucks|vancouver': ['VAN'], 'golden knights|vegas': ['VGK', 'VEG'], 'capitals|caps': ['WSH', 'WAS'], 'jets|winnipeg': ['WPG'],
});

export const SPORTS = {
  mlb: {name: 'MLB', game: 'games', start: 'first pitch', words: /\b(mlb|baseball)\b/, stats: MLB_STATS, teams: MLB_TEAMS},
  nba: {name: 'NBA', game: 'games', start: 'tip-off', words: /\b(nba|basketball|hoops)\b/, stats: NBA_STATS, teams: NBA_TEAMS},
  nhl: {name: 'NHL', game: 'games', start: 'puck drop', words: /\b(nhl|hockey)\b/, stats: NHL_STATS, teams: NHL_TEAMS},
};
const SPORT_ORDER = ['mlb', 'nhl', 'nba'];
const OTHER_SPORTS = /\b(wnba|nfl|ncaa|college|football|tennis|soccer|cs2|csgo|counter[ -]?strike|golf|ufc|mma)\b/;

/** Whether a row is the stat a question asks for. */
export function statMatches(stat, row) {
  if (!stat || String(row.sport || 'mlb') !== stat.sport) return false;
  if (stat.sport === 'mlb') return row.marketKey === stat.key;
  return stat.labels.includes(nameKey(row.market));
}
const statOfRow = row => (SPORTS[row.sport || 'mlb']?.stats || []).find(stat => !stat.first && statMatches(stat, row))
  || (SPORTS[row.sport || 'mlb']?.stats || []).find(stat => statMatches(stat, row)) || null;

// ---------------------------------------------------------------- reading a question

// Slang and shorthand, rewritten before anything else reads the question.
const SLANG = [
  [/\bpunch ?ies\b|\bpunchouts?\b|\bkay'?s\b|\bk'?s\b/g, 'strikeouts'],
  [/\bgo(es|ing)? yard\b|\bgoes deep\b|\btaters?\b|\bjacks\b|\bdongs?\b/g, 'home run'],
  [/\block of the day\b|\blotd\b|\bsure thing\b|\bbankers?\b|\bslam ?dunk pick\b/g, 'safest'],
  [/\bsmash(es)?\b|\bhammer\b|\bfavorite play\b|\bfav play\b/g, 'best'],
  [/\bsleepers?\b|\blong ?shots?\b|\bvalue plays?\b/g, 'value'],
  [/\btn\b|\btonite\b|\b2nite\b/g, 'tonight'],
  [/\b2day\b|\btdy\b/g, 'today'],
  [/\bu\b/g, 'you'], [/\bur\b/g, 'your'], [/\bpls\b|\bplz\b/g, 'please'], [/\bw\/\b/g, 'with'],
];
const VOCAB = new Set(('strikeouts strikeout pitcher pitchers hitter hitters batter batters matchup matchups safest compare versus rundown slate '
  + 'tonight today tomorrow rebounds assists points goalie saves shots goals under over parlay slip picks props prop player players '
  + 'total bases homers homer double triple steals blocks turnovers fantasy faceoffs penalty minutes power play walks allowed earned '
  + 'runs hits singles doubles triples stolen innings inning first should would worth explain another different better best worst '
  + 'baseball basketball hockey yankees dodgers mariners guardians tigers phillies padres brewers astros orioles royals rangers '
  + 'lakers celtics warriors knicks nuggets bucks thunder cavaliers oilers maple leafs bruins panthers avalanche lightning capitals').split(' '));

/** Edit distance with swaps counted as one ("strikoeuts" is one away). */
export function distance(a, b) {
  const rows = Array.from({length: a.length + 1}, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
}

/** The question with slang rewritten and misspelt keywords fixed (never a player's name). */
export function normalize(text, keepWords = new Set()) {
  let q = clean(text);
  for (const [pattern, replacement] of SLANG) q = q.replace(pattern, replacement);
  return q.split(' ').map(word => {
    const bare = word.replace(/[^a-z']/g, '');
    if (bare.length < 5 || VOCAB.has(bare) || keepWords.has(bare)) return word;
    const limit = bare.length >= 8 ? 2 : 1;
    let best = null, bestScore = limit + 1;
    for (const known of VOCAB) {
      if (Math.abs(known.length - bare.length) > limit) continue;
      const score = distance(bare, known);
      if (score < bestScore) { best = known; bestScore = score; }
    }
    return best ? word.replace(bare, best) : word;
  }).join(' ');
}

const FOLLOW = /^(and|also|ok(ay)?|now|then|so|what about|how about|wbu|same for|same but)\b/;

/** What a question asks for, before the board or the conversation is consulted. */
export function understand(text, {keepWords} = {}) {
  const q = normalize(text, keepWords);
  const ask = {text: q, raw: String(text || ''), intent: 'best', sport: null, stat: null, statOptions: [], side: null,
    count: 1, team: null, teamOptions: [], modifier: null, line: null, followUp: FOLLOW.test(q)};
  if (!q) return {...ask, intent: 'help'};
  if (/^(hi|hey|hello|yo|sup|what'?s up|wassup|gm|good (morning|afternoon|evening)|hola)\b[\s!.?]*$/.test(q)) return {...ask, intent: 'hello'};
  if (/^(thanks?|thank you|ty|appreciate (it|you)|nice|bet|good looks?|lets go|let'?s go|w bot|goat)\b/.test(q)) return {...ask, intent: 'thanks'};
  if (/^(help|what can you (do|answer)|how (do|does) (this|you) work|commands|examples?|what do you know)\b/.test(q)) return {...ask, intent: 'help'};
  if (/\bwhat (did|have) i (ask|asked|search|searched|look(ed)? (up|at))\b|\bmy (last|recent|past) (questions?|searches)\b|\bremember me\b/.test(q)) return {...ask, intent: 'recall'};
  if (/\b(my|the) usual\b/.test(q)) ask.intent = 'usual';
  if (/\bmy (guys|players|favorites?|faves?)\b/.test(q)) ask.intent = 'mine';
  if (/^(why|how come|explain|reasons?|break ?(it|that) down|tell me more|more (info|details)|details|whys?)\b/.test(q)) {
    const which = q.match(/#?\b(\d)\b/);
    return {...ask, intent: 'why', index: which ? Number(which[1]) - 1 : null};
  }
  if (/^(another|next|someone else|anyone else|different|give me another|one more|next one|who else)\b/.test(q)
      || /\b(another one|someone else|next best|second best|different one|anybody else)\b/.test(q)) ask.intent = 'another';
  if (/^(what about |how about |and )?(the )?(other side|flip( it)?|opposite)\b/.test(q)) ask.intent = 'flip';
  if (OTHER_SPORTS.test(q) && !Object.values(SPORTS).some(sport => sport.words.test(q))) return {...ask, intent: 'other-sport'};

  for (const [key, sport] of Object.entries(SPORTS)) if (sport.words.test(q)) { ask.sport = key; ask.explicitSport = true; }
  const first = /\b(1st|first) (inning|inn)\b|\bnrfi\b|\byrfi\b/.test(q);
  for (const [key, sport] of Object.entries(SPORTS)) {
    if (ask.sport && ask.sport !== key) continue;
    const stat = sport.stats.find(item => (key !== 'mlb' || Boolean(item.first) === first) && item.words.some(pattern => pattern.test(q)));
    if (stat) ask.statOptions.push(stat);
  }
  // A word only one sport uses decides the sport; a shared one waits for context.
  if (ask.statOptions.length === 1 || ask.sport) ask.stat = ask.statOptions[0] || null;
  else if (ask.statOptions.length > 1) {
    const unique = ask.statOptions.filter(stat => !stat.shared);
    if (unique.length === 1) ask.stat = unique[0];
  }
  if (/\bpitchers?\b/.test(q) && !ask.stat) ask.group = 'pitching';
  if (/\b(hitters?|batters?)\b/.test(q) && !ask.stat) ask.group = 'hitting';

  const under = /\b(under|less|lower|fade)\b/.test(q), over = /\b(over|higher)\b/.test(q);
  if (under !== over) ask.side = under ? 'UNDER' : 'OVER';  // "over or under?" picks no side
  if (/\bgoblins?\b/.test(q)) ask.modifier = 'goblin';
  if (/\bdemons?\b/.test(q)) ask.modifier = 'demon';
  if (/\bvalue\b/.test(q)) ask.intent = 'value';
  const line = q.match(/\b(\d{1,2}(?:\.\d)?)\b(?! ?(pick|leg|man|player|best|top|props?|plays?|picks?))/);
  if (line && /\b(over|under|o|u)\s*\d|\d\s*(\+|or more|or less)|\.\d/.test(q)) ask.line = Number(line[1]);

  const counted = q.match(/\b(?:top|best|give me|show me)\s+(\d|one|two|three|four|five|six)\b/) || q.match(/\b(\d|two|three|four|five|six)\s+(?:best|top|picks?|plays?|props?|legs?)\b/);
  if (counted) ask.count = Math.max(1, Math.min(5, Number(counted[1]) || NUMBER_WORDS[counted[1]] || 1));

  for (const [key, sport] of Object.entries(SPORTS)) {
    if (ask.sport && ask.sport !== key) continue;
    for (const team of sport.teams) if (team.pattern.test(q)) ask.teamOptions.push({sport: key, codes: team.codes, name: q.match(team.pattern)[1]});
  }
  if (/\b(slip|parlay|entry|lineup|power play|flex( play)?|combo)\b|\b(\d|two|three|four|five|six)[ -]?(picks?|legs?|man)\b/.test(q)) {
    const legs = q.match(/\b(\d|two|three|four|five|six)[ -]?(pick|leg|man|player)/);
    return {...ask, intent: 'slip', count: Math.max(2, Math.min(6, Number(legs?.[1]) || NUMBER_WORDS[legs?.[1]] || 3))};
  }
  if (['another', 'flip', 'usual', 'mine', 'value'].includes(ask.intent)) return ask;
  if (/\b(compare|versus|vs\.?|better (play|pick|option)|who should i (take|play|pick)|which (one|is better))\b|\bor\b/.test(q)) ask.intent = 'compare';
  if (/^(should i|would you|do you like|you like|is (it|this|that)?|thoughts on|how do you feel|tail|lock in|take|is \w+ (a )?(good|safe|worth))|\b(good (play|bet|pick)|worth (it|a play)|safe (play|bet)|smash or pass|yes or no)\b|\?$/.test(q)
      && (ask.line != null || /^(should|would|do you|you like|is|thoughts|how do you feel|tail|lock|take)\b/.test(q))) ask.verdict = true;
  if (/\b(rundown|slate|run ?down|overview|summary|card|what'?s (the )?(play|move|good|best bet)|what do you like|what are you (on|taking|playing)|today'?s (plays|picks|best))\b/.test(q)) ask.intent = 'rundown';
  else if (/\b(safe(st)?|lock|locks|sure|surest|most likely|highest (chance|percent|probability)|confident|banker)\b/.test(q)) ask.intent = ask.intent === 'compare' ? 'compare' : 'safest';
  else if (/\bmatch ?ups?\b|\bmismatch\b|\bexploit\b|\bweak(est)? (pitcher|lineup|opponent|defense)\b/.test(q)) ask.intent = ask.intent === 'compare' ? 'compare' : 'matchup';
  return ask;
}

/** Board players a question names: full names, distinct last names, then near-misses of a last name. */
export function findPlayers(text, names) {
  const q = ` ${clean(text).replace(/[^a-z0-9' ]/g, ' ')} `;
  const people = [...new Set(names)].filter(Boolean);
  const plain = name => clean(name).replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();
  const found = people.filter(name => q.includes(` ${plain(name)} `));
  const stop = new Set([...VOCAB, 'best', 'today', 'prop', 'props', 'play', 'over', 'under', 'what', 'about', 'should', 'take', 'think', 'thoughts']);
  const words = q.trim().split(' ');
  const covered = new Set(found.flatMap(name => plain(name).split(' ')));
  const lasts = new Map();
  for (const name of people) {
    const last = plain(lastName(name)).replace(/ /g, '');
    if (last.length < 4 || stop.has(last)) continue;
    (lasts.get(last) || lasts.set(last, []).get(last)).push(name);
  }
  const groups = [];
  for (const word of words) {
    if (covered.has(word) || stop.has(word) || word.length < 4) continue;
    let match = lasts.get(word);
    if (!match && word.length >= 5) {
      const near = [...lasts.keys()].filter(last => Math.abs(last.length - word.length) <= 1 && distance(word, last) <= 1);
      if (near.length === 1) match = lasts.get(near[0]);
    }
    if (match && !match.some(name => found.includes(name))) groups.push(match);
  }
  return {players: [...found, ...groups.filter(group => group.length === 1).map(group => group[0])],
    ambiguous: groups.filter(group => group.length > 1)};
}

/** The board player whose last name is nearest an unknown word (two letters off at most). */
export function closestPlayer(text, names) {
  let best = null, bestScore = 3;
  for (const word of clean(text).replace(/[^a-z' ]/g, ' ').split(' ').filter(item => item.length >= 4 && !VOCAB.has(item))) {
    for (const name of new Set(names)) {
      const score = distance(word, nameKey(lastName(name)));
      if (score < bestScore) { best = name; bestScore = score; }
    }
  }
  return best;
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
  let pool = legs.filter(leg => !ask.sport || String(leg.row?.sport || 'mlb') === ask.sport);
  pool = pool.filter(leg => ask.modifier ? leg.modifier === ask.modifier : ask.intent === 'value' ? leg.modifier === 'demon' : leg.modifier === 'standard');
  if (ask.stat) pool = pool.filter(leg => statMatches(ask.stat, leg.row));
  if (ask.group) pool = pool.filter(leg => String(leg.row.marketKey || '').startsWith(`${ask.group}:`));
  if (ask.side) pool = pool.filter(leg => leg.side === ask.side);
  if (ask.team) pool = pool.filter(leg => ask.team.includes(String(leg.row.teamAbbr || '').toUpperCase()));
  if (ask.players?.length) pool = pool.filter(leg => ask.players.includes(leg.player));
  const order = ask.intent === 'safest' || ask.intent === 'value' ? (a, b) => b.chance - a.chance
    : ask.intent === 'matchup' ? (a, b) => (matchupLift(b) >= 0.03) - (matchupLift(a) >= 0.03) || matchupLift(b) - matchupLift(a) || byGrade(a, b)
      : byGrade;
  const seen = new Set();
  return [...pool].sort(order).filter(leg => !seen.has(leg.player) && seen.add(leg.player));
}

// ---------------------------------------------------------------- writing

const pick = (list, random) => list[Math.floor(random() * list.length) % list.length];
const sideWord = leg => leg.side === 'UNDER' ? 'under' : 'over';
const statShort = leg => statOfRow(leg.row)?.short || String(leg.row.market || '').toLowerCase();
// Mid-sentence, the analyst's own phrases start lowercase; names and team codes keep their capitals.
const lower = text => /^(Faces|The|Only|Tough|Pitches|Plate|Playing|Second)\b/.test(text || '') ? text[0].toLowerCase() + text.slice(1) : text;
const join = (parts, word = 'and') => parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} ${word} ${parts.at(-1)}`;
const sentence = text => text ? text[0].toUpperCase() + text.slice(1).replace(/[.\s]*$/, '.') : '';
const tidy = text => text.replace(/\s+/g, ' ').replace(/\s+([.,])/g, '$1').trim();
const tag = leg => leg.modifier && leg.modifier !== 'standard' ? ` (${leg.modifier})` : '';

/** "Tarik Skubal over 6.5 K's vs KC" */
export function pickLine(leg) {
  const opponent = leg.row.opponent ? ` vs ${leg.row.opponent}` : '';
  return `${leg.player} ${sideWord(leg)} ${figure(leg.row.line)} ${statShort(leg)}${tag(leg)}${opponent}`;
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

// ---------------------------------------------------------------- cards

const MLB_PHOTO = id => `https://img.mlbstatic.com/mlb-photos/image/upload/w_120,q_auto:best/v1/people/${encodeURIComponent(id)}/headshot/silo/current`;
const MLB_LOGO = id => `https://www.mlbstatic.com/team-logos/${encodeURIComponent(id)}.svg`;
const shortDate = value => {
  const match = /^\d{4}-(\d{2})-(\d{2})/.exec(value || '');
  return match ? `${Number(match[1])}/${Number(match[2])}` : '';
};
// The opponent's logo: posted on the row (NHL, soccer), from the MLB team
// id, or ESPN's logo for the team's own code (NBA, WNBA).
function opponentLogo(row) {
  if (row.opponentLogo) return row.opponentLogo;
  if (row.sport === 'mlb' && row.opponentTeamId != null) return MLB_LOGO(row.opponentTeamId);
  if (row.opponent && /^https:\/\/a\.espncdn\.com\/.+\/[a-z]+\.png$/i.test(row.teamLogo || '')) return row.teamLogo.replace(/[a-z]+\.png$/i, `${String(row.opponent).toLowerCase()}.png`);
  return null;
}

// Card tiles carry short names; the rest say who (vs BOS) or what (pitches).
const TILE_LABELS = {season: () => 'Season', books: () => 'Books', projection: () => 'Projection', average: () => 'L10 avg',
  streak: () => 'Streak', defense: () => 'Defense', venue: label => label === 'at home' ? 'Home' : 'Road',
  role: label => label[0].toUpperCase() + label.slice(1)};

/**
 * What the answer card shows for one pick: who and when, the line, the
 * last 10 games against it, the numbers behind it, the matchup and what
 * to watch. Plain data; src/KrazyBotCard.jsx draws it.
 */
export function pickCard(leg) {
  const {row, side} = leg;
  const line = row.line;
  const sign = side === 'UNDER' ? -1 : 1;
  const last = (row.gameLog || []).filter(game => finite(game.value)).slice(-10).map(game => ({
    value: game.value,
    hit: game.value === line ? null : (game.value - line) * sign > 0,
    label: typeof game.opponent === 'string' && game.opponent ? game.opponent : shortDate(game.date),
  }));
  const records = leg.records || {};
  const recent = records.l10 || records.l5;
  const projection = leg.read?.projection;
  const tiles = reasons(leg).filter(item => !['l10', 'l5', 'matchup'].includes(item.key)).slice(0, 4).map(item => ({
    key: item.key, value: item.strong, label: TILE_LABELS[item.key]?.(item.label) || item.label,
    tone: item.tone || (item.key === 'projection' ? ((projection - line) * sign > 0 ? 'up' : 'down')
      : item.key === 'books' ? (leg.book >= 0.5 ? 'up' : 'down') : null),
  }));
  const matchup = matchupOf(leg);
  const pitcher = row.sport === 'mlb' && row.matchup?.kind === 'pitcher' ? row.matchup.pitcher : null;
  const lift = matchup ? matchupLift(leg) : 0;
  return {
    player: leg.player, headshot: row.headshot || null, position: row.position || null, sport: row.sport || 'mlb',
    team: row.teamAbbr || null, teamLogo: row.teamLogo || null,
    opponent: row.opponent || null, opponentLogo: opponentLogo(row), home: typeof row.isHome === 'boolean' ? row.isHome : null,
    time: timeOf(row.startsAt), side, line, stat: row.market || statShort(leg), short: statShort(leg),
    modifier: leg.modifier || 'standard', grade: leg.grade || null, chance: leg.chance, backed: leg.backed !== false,
    record: recent ? {won: recent.won, games: recent.games} : null, last, tiles,
    matchup: matchup?.text ? {
      text: matchup.text, short: matchup.short || null, tone: lift >= 0.03 ? 'up' : lift <= -0.03 ? 'down' : null,
      photo: pitcher?.id ? MLB_PHOTO(pitcher.id) : opponentLogo(row), face: Boolean(pitcher?.id),
      name: pitcher?.name || row.opponent || null, hand: pitcher?.hand || null,
    } : null,
    risks: (leg.read?.risks || []).slice(0, 2),
  };
}

const CONFIDENCE = {A: ['I love this one.', 'Strong play.', 'This is my kind of spot.'], B: ['Solid lean.', 'I like it.', 'Good spot.'],
  C: ['Small edge, so size it light.', 'Thin edge, but it\'s there.']};
const OPENERS = {
  best: stat => stat ? [`My top ${stat.name} play today:`, `Best ${stat.name} prop on the board:`, `If I'm taking one ${stat.name} prop, it's`, `The ${stat.name} prop I like most:`]
    : ['My favorite play on the board:', 'Top play today:', "If I'm picking one prop, it's", 'Best spot on the slate:'],
  safest: stat => [`Safest ${stat ? stat.name + ' ' : ''}look today:`, `Most likely ${stat ? stat.name + ' prop ' : ''}to hit:`, `The surest ${stat ? stat.name + ' ' : ''}play I see:`],
  matchup: stat => [`Best ${stat ? stat.name + ' ' : ''}matchup on today's slate:`, 'The matchup that jumps off the page:', 'Biggest edge from a matchup today:'],
  value: () => ['Best value on the board (a demon, so a bigger payout):', 'My favorite long shot today:'],
  another: () => ['Next up:', 'Another one I like:', "Here's the next best:", 'Right behind it:'],
  usual: stat => [`Your usual${stat ? `, the best ${stat.name} prop` : ''}:`, `Going with your usual${stat ? ` ${stat.name} look` : ''}:`],
};

const relative = (at, now) => {
  const days = Math.floor((now - at) / DAY_MS);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};
const timeOf = value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}) : null;
};

// ---------------------------------------------------------------- the profile

const EMPTY_PROFILE = () => ({v: 1, asked: [], players: {}, stats: {}, teams: {}, sports: {}, visits: 0, lastVisit: 0});
// A saved profile is only trusted field by field: anything malformed starts fresh.
const counts = value => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).filter(([key, n]) => typeof key === 'string' && finite(n)).slice(0, 40)) : {};
function sanitize(saved) {
  const base = EMPTY_PROFILE();
  if (!saved || typeof saved !== 'object') return base;
  return {...base, asked: Array.isArray(saved.asked) ? saved.asked.filter(item => typeof item?.q === 'string' && finite(item.at)).slice(0, 20) : [],
    players: counts(saved.players), stats: counts(saved.stats), teams: counts(saved.teams), sports: counts(saved.sports),
    visits: finite(saved.visits) ? saved.visits : 0, lastVisit: finite(saved.lastVisit) ? saved.lastVisit : 0};
}
const top = counts => Object.entries(counts || {}).sort((a, b) => b[1] - a[1]).map(([key]) => key);

/**
 * The bot. `load(sport)` resolves today's rows (finder-pool loadLines);
 * `sports` are the leagues this member may see; `judge` grades rows
 * (Smart Slip candidates) and `assess` reads any one line; `profile` keeps
 * what this member asks about ({read, write}); `moves` lists recent line
 * moves (optional).
 */
export function createBot({load, sports = ['mlb'], judge = rows => candidates(rows), assess = assessLeg, profile = null,
  moves = null, now = () => Date.now(), random = Math.random} = {}) {
  const allowed = sports.filter(sport => SPORTS[sport]);
  const boards = {};
  let movesCache = {at: 0, list: []};
  let ctx = null;          // the conversation: the last question and what it showed
  let suggestions = [];
  let answer = null;       // the card for the last answer ({lead, card}), when it has one
  let me = sanitize(profile?.read?.());

  const save = () => { try { profile?.write?.(me); } catch { /* storage full or blocked */ } };
  me.visits += 1;
  const returning = me.lastVisit && now() - me.lastVisit > 30 * 60000;
  const previousVisit = me.lastVisit;
  me.lastVisit = now();
  save();

  async function board(sport) {
    const entry = boards[sport] ||= {rows: [], legs: [], at: 0, failed: false, pending: null};
    if (entry.at && now() - entry.at < FRESH_MS) return entry;
    entry.pending ||= (async () => {
      try {
        const rows = await load(sport);
        Object.assign(entry, {rows: (rows || []).map(row => ({...row, sport: row.sport || sport})), at: now(), failed: false});
        entry.legs = judge(entry.rows);
      } catch {
        entry.failed = !entry.rows.length;
      } finally { entry.pending = null; }
      return entry;
    })();
    return entry.pending;
  }
  const boardsLoaded = async () => {
    await Promise.all(allowed.map(board));
    return allowed.map(sport => ({sport, ...boards[sport]}));
  };
  const allRows = () => allowed.flatMap(sport => boards[sport]?.rows || []);
  const allLegs = () => allowed.flatMap(sport => boards[sport]?.legs || []);

  async function recentMoves() {
    if (!moves) return [];
    if (now() - movesCache.at < FRESH_MS) return movesCache.list;
    try { movesCache = {at: now(), list: await moves()}; } catch { movesCache = {at: now(), list: []}; }
    return movesCache.list;
  }
  async function moveNote(leg) {
    const stat = nameKey(leg.row.raw?.stat || leg.row.market);
    const move = (await recentMoves()).filter(item => item.kind !== 'odds' && item.kind !== 'pulled' && item.player === leg.player
      && nameKey(item.stat) === stat && now() - Date.parse(item.at) < DAY_MS && finite(item.from) && finite(item.to))
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    return move ? ` Heads up: this line moved from ${figure(move.from)} to ${figure(move.to)}${timeOf(move.at) ? ` at ${timeOf(move.at)}` : ''}.` : '';
  }

  function remember(ask, legs = []) {
    me.asked = [{q: ask.raw.slice(0, 80), at: now()}, ...me.asked].slice(0, 20);
    if (ask.stat) me.stats[`${ask.stat.sport}:${ask.stat.key}`] = (me.stats[`${ask.stat.sport}:${ask.stat.key}`] || 0) + 1;
    for (const player of new Set([...(ask.players || []), ...legs.slice(0, 1).map(leg => leg.player)])) me.players[player] = (me.players[player] || 0) + 1;
    if (ask.team) me.teams[ask.team[0]] = (me.teams[ask.team[0]] || 0) + 1;
    const sport = ask.sport || legs[0]?.row?.sport;
    if (sport) me.sports[sport] = (me.sports[sport] || 0) + 1;
    // Keep the profile small: the 12 most-asked of each.
    for (const field of ['players', 'stats', 'teams']) me[field] = Object.fromEntries(top(me[field]).slice(0, 12).map(key => [key, me[field][key]]));
    save();
  }
  const favoriteStat = () => {
    const key = top(me.stats).find(item => allowed.includes(item.split(':')[0]));
    if (!key) return null;
    const [sport, ...rest] = key.split(':');
    return SPORTS[sport].stats.find(stat => stat.key === rest.join(':')) || null;
  };

  function examples() {
    const stat = favoriteStat();
    const player = top(me.players).find(name => allRows().some(row => row.player === name));
    const base = ["What's the play today?", 'Best K prop today', 'Best matchup today', 'Safest pick', 'Build me a 3-pick slip'];
    if (allowed.includes('nba')) base.push('Best NBA points prop');
    if (allowed.includes('nhl')) base.push('Best shots on goal prop');
    const personal = [stat && `Best ${stat.name} prop`, player && `How's ${lastName(player)} looking?`].filter(Boolean);
    return [...new Set([...personal, ...base])].slice(0, 6);
  }

  /** Short status lines for the thinking animation, about this question. */
  function thinking(text) {
    const known = new Set(allRows().flatMap(row => nameKey(row.player) ? clean(row.player).split(' ') : []));
    const ask = understand(text, {keepWords: known});
    const {players} = findPlayers(text, allRows().map(row => row.player));
    const sport = ask.sport || players.map(name => allRows().find(row => row.player === name)?.sport)[0] || ctx?.sport || allowed[0];
    const count = (boards[sport]?.rows || []).length;
    const steps = ['Reading your question'];
    if (count) steps.push(`Scanning ${count} ${SPORTS[sport]?.name || ''} props`.replace(/\s+/g, ' '));
    else steps.push(`Loading today's ${SPORTS[sport]?.name || ''} lines`.replace(/\s+/g, ' '));
    if (players[0]) steps.push(`Checking ${lastName(players[0])}'s last 10`);
    if (players[1]) steps.push(`Checking ${lastName(players[1])}'s last 10`);
    if (ask.intent === 'matchup' || ask.intent === 'rundown') steps.push('Reading today\'s matchups');
    if (ask.stat) steps.push(`Ranking ${ask.stat.name} props`);
    if (ask.intent === 'slip') steps.push('Spreading legs across games');
    steps.push('Checking what the books say', 'Writing it up');
    return [...new Set(steps)].slice(0, 6);
  }

  const answerPick = async (ask, ranked, index = 0) => {
    ctx = {...ctx, ask, ranked, index, sport: ranked[index].row.sport, player: ranked[index].player, leg: ranked[index]};
    const leg = ranked[index];
    const name = lastName(leg.player);
    const opener = ask.players?.length && index === 0 ? pick([`Best way to play ${name} today:`, `For ${name}, I like`, `${name}'s best prop today:`], random)
      : pick((OPENERS[ask.intent] || OPENERS.best)(ask.stat), random);
    const facts = evidence(leg).slice(0, 3);
    const risk = leg.read?.risks?.[0];
    const watch = risk ? ` ${pick(['One thing to watch:', 'Only knock:', 'Watch out:'], random)} ${lower(risk)}.` : '';
    suggestions = ['Why?', 'Next best', leg.side === 'OVER' ? 'What about the under?' : 'What about the over?', 'Build me a 3-pick slip'];
    const confidence = pick(CONFIDENCE[leg.grade] || CONFIDENCE.C, random);
    const moved = await moveNote(leg);
    answer = {lead: tidy(`${opener} ${pickLine(leg)}. ${confidence} ${sentence(facts[0] || '')}${moved}`), card: {kind: 'pick', pick: pickCard(leg)}};
    return tidy(`${opener} ${pickLine(leg)} (grade ${leg.grade}, ${percent(leg.chance)} to hit). ${confidence} ${sentence(join(facts))}${watch}${moved}`);
  };

  /** A yes/no on one side of one line, whether or not it's a pick we'd make. */
  async function verdict(row, side, ask) {
    const sides = side ? [side, side === 'OVER' ? 'UNDER' : 'OVER'] : ['OVER', 'UNDER'];
    const reads = sides.map(item => assess(row, item, {now: now()}));
    if (!reads[0] && !reads[1]) return `I don't have enough history on ${row.player} to call that one (or it starts too soon).`;
    let [chosen, other] = reads;
    if (!side && other && (!chosen || other.chance > chosen.chance)) [chosen, other] = [other, chosen];
    if (!chosen) return `${row.player}'s ${figure(row.line)} ${statShort({row})} only takes the over on that kind of line, and I don't have a read on it.`;
    ctx = {...ctx, ask, ranked: [chosen], index: 0, sport: row.sport, player: row.player, leg: chosen};
    const lineNote = ask.line != null && Math.abs(ask.line - row.line) > 0.01 ? ` (Today's line is ${figure(row.line)}, not ${figure(ask.line)}.)` : '';
    const facts = evidence(chosen).slice(0, 2);
    let call;
    if (chosen.backed && chosen.grade === 'A') call = pick(['Yes. I love it.', 'Yes, that\'s one of my favorite spots today.'], random);
    else if (chosen.backed) call = pick(['Yes, I like it.', 'I\'d take it.'], random);
    else if (chosen.chance >= 0.53) call = 'Lean yes, but it\'s thin.';
    else if (other?.backed) call = `I'd flip it. The ${sideWord(other)} is the better side at ${percent(other.chance)}.`;
    else call = `I'd pass. That's close to a coin flip.`;
    suggestions = ['Why?', side === 'UNDER' ? 'What about the over?' : 'What about the under?', `Best ${statOfRow(row)?.name || ''} prop today`.replace('  ', ' '), 'Next best'];
    const head = side || !other ? `${pickLine(chosen)}: ${percent(chosen.chance)} to hit${chosen.grade ? `, grade ${chosen.grade}` : ''}.`
      : `${pickLine(chosen)} is the better side at ${percent(chosen.chance)}.`;
    const moved = await moveNote(chosen);
    const tone = chosen.backed ? 'yes' : chosen.chance >= 0.53 ? 'lean' : other?.backed ? 'flip' : 'pass';
    const shown = tone === 'flip' ? other : chosen;
    answer = {lead: tidy(`${call} ${tone === 'flip' ? '' : head}${lineNote}${moved}`),
      card: {kind: 'pick', pick: pickCard(shown), verdict: {tone, label: {yes: 'Take it', lean: 'Lean', flip: 'Flip it', pass: 'Pass'}[tone]}}};
    return tidy(`${call} ${head} ${sentence(join(facts))}${lineNote}${moved}`);
  }

  function contextual(ask, players) {
    // A follow-up borrows what it leaves unsaid from the last answer.
    const last = ctx?.ask;
    const pronoun = /\b(he|him|his|he's|hes|that guy|this guy|that one|this one|it|that pick|this pick|them)\b/.test(ask.text);
    if (!players.length && pronoun && ctx?.player) {
      players = [ctx.player];
      // "Is he safe?" is about the same pick.
      if (ctx.leg?.player === ctx.player) {
        ask.side ||= ctx.leg.side;
        ask.stat ||= statOfRow(ctx.leg.row);
        if (ask.line == null) ask.line = ctx.leg.row.line;
      }
    }
    if (last && (ask.followUp || ask.text.split(' ').length <= 5)) {
      const loose = !ask.stat && !players.length && !ask.teamOptions.length;
      if (!ask.sport && !ask.stat) ask.sport = ctx.sport || last.sport;
      if (!ask.stat && (players.length || ask.teamOptions.length || (ask.side && loose)) && last.stat) { ask.stat = last.stat; ask.inherited = true; }
      if (!ask.stat && ask.statOptions.length > 1) ask.stat = ask.statOptions.find(stat => stat.sport === ask.sport) || null;
      if (!ask.teamOptions.length && last.team && /^(and|also|same)/.test(ask.text)) ask.team = last.team;
      if (loose && ask.side && ctx?.leg && !ask.statOptions.length) ask.intent = 'flip';
    }
    return players;
  }

  async function ask(text) {
    suggestions = [];
    answer = null;
    const before = understand(text);
    if (before.intent === 'hello') { await boardsLoaded(); return hello(); }
    if (before.intent === 'help') { suggestions = examples(); return HELP(allowed); }
    if (before.intent === 'thanks') { suggestions = ['Next best', 'Build me a 3-pick slip', "What's the play today?"]; return pick(['Anytime. Want another one?', 'Good luck on it. Ask me for another anytime.', 'Bet. Need a slip to go with it?'], random); }
    if (before.intent === 'other-sport') return `I'm covering ${allowed.map(sport => SPORTS[sport].name).join(', ')} right now, more sports are coming soon.`;
    if (before.intent === 'recall') return recall();

    await boardsLoaded();
    if (allowed.every(sport => boards[sport]?.failed)) { suggestions = ["What's the play today?"]; return 'I can\'t reach today\'s lines right now. Give it a minute and ask again.'; }
    const rows = allRows(), legs = allLegs();
    const known = new Set(rows.flatMap(row => clean(row.player).split(' ')));
    const question = understand(text, {keepWords: known});
    const found = findPlayers(text, rows.map(row => row.player));
    if (found.ambiguous.length && !found.players.length) {
      const options = found.ambiguous[0].map(name => `${name}${rows.find(row => row.player === name)?.teamAbbr ? ` (${rows.find(row => row.player === name).teamAbbr})` : ''}`);
      suggestions = found.ambiguous[0].map(name => `What about ${name}?`);
      return `Which one do you mean: ${join(options, 'or')}?`;
    }
    const players = contextual(question, found.players);
    question.players = players;
    const playerSport = players.map(name => rows.find(row => row.player === name)?.sport).find(Boolean);
    // A stat carried over from the last answer gives way when this player doesn't have that line.
    if (question.inherited && players.length && !rows.some(row => players.includes(row.player) && statMatches(question.stat, row))) question.stat = null;
    if (question.stat) question.sport = question.stat.sport;
    if (!question.sport || (playerSport && question.sport !== playerSport && !question.stat)) question.sport = playerSport || question.sport || null;
    if (question.teamOptions.length) {
      const team = question.teamOptions.find(option => option.sport === question.sport) || question.teamOptions.find(option => (boards[option.sport]?.rows || []).length) || question.teamOptions[0];
      question.team = team.codes;
      // A team names its league unless the question named one itself.
      if (!question.explicitSport && !(question.stat && !question.inherited && question.stat.sport !== team.sport)) question.sport = team.sport;
      if (question.inherited && question.stat?.sport !== question.sport) { question.stat = null; question.inherited = false; }
    }
    if (!question.stat && question.statOptions.length) {
      question.stat = question.statOptions.find(stat => stat.sport === (question.sport || ctx?.sport)) || null;
      if (!question.stat) {
        const live = question.statOptions.filter(stat => (boards[stat.sport]?.rows || []).some(row => statMatches(stat, row)));
        if (live.length === 1) question.stat = live[0];
        else if (live.length > 1) {
          suggestions = live.map(stat => `Best ${SPORTS[stat.sport].name} ${stat.name} prop`);
          return `${SPORTS[live[0].sport].name} or ${SPORTS[live[1].sport].name} ${live[0].name}? Both are on the board today.`;
        }
        else question.stat = question.statOptions[0];
      }
      question.sport ||= question.stat?.sport || null;
    }

    // "Why is Judge a good pick?" with nothing about him on screen: his best pick, broken down.
    if (question.intent === 'why' && players.length && ctx?.player !== players[0] && question.index == null) {
      const ranked = rank(legs, {...question, intent: 'best', players: [players[0]]});
      remember(question, ranked);
      if (!ranked.length) return `${players[0]} is on the board today, but none of his lines has a clear edge in our numbers. I'd pass on him.${listLines(players[0])}`;
      ctx = {...ctx, ask: {...question, intent: 'best'}, ranked, index: 0, sport: ranked[0].row.sport, player: players[0], leg: ranked[0]};
      return why(0);
    }
    if (question.intent === 'why') return why(question.index);
    if (question.intent === 'another') return another();
    if (question.intent === 'flip') return flip(question.side);
    if (question.intent === 'usual') {
      const stat = favoriteStat();
      if (!stat) { suggestions = examples(); return 'I don\'t know your usual yet. Ask me about a stat a couple of times and I\'ll remember it.'; }
      Object.assign(question, {stat, sport: stat.sport});
    }
    if (question.intent === 'mine') {
      const mine = top(me.players).filter(name => rows.some(row => row.player === name)).slice(0, 4);
      if (!mine.length) { suggestions = examples(); return 'None of the players you usually ask about are on today\'s board.'; }
      question.players = mine;
      const ranked = rank(legs, {...question, intent: 'best'});
      remember(question, ranked);
      if (!ranked.length) return `${join(mine)} ${mine.length > 1 ? 'are' : 'is'} on the board today, but none of their lines has a clear edge.`;
      return answerPick({...question, players: []}, ranked);
    }
    // Nothing in it we know: say so (with a guess at a name) instead of guessing a pick.
    const recognized = question.stat || question.statOptions.length || players.length || question.team || question.explicitSport
      || question.side || question.line != null || question.intent !== 'best'
      || /\b(best|top|good|great|play|plays|pick|picks|prop|props|bet|bets|like|love|today|tonight|slate|lines?)\b/.test(question.text);
    if (!recognized) {
      const guess = closestPlayer(question.text, rows.map(row => row.player));
      suggestions = guess ? [`What about ${guess}?`, ...examples().slice(0, 2)] : examples().slice(0, 3);
      return guess ? `I didn't catch that. Did you mean ${guess}?` : `I didn't catch that one. Try "what's the play today?", "best K prop" or a player's name.`;
    }
    if (question.intent === 'rundown') return rundown(question);
    if (question.intent === 'slip') return slip(question);
    if (question.intent === 'compare' && players.length >= 2) return compare(question, players.slice(0, 2));

    // "Should I take Skubal over 6.5 Ks?" -- a verdict on that line.
    if ((question.verdict || question.line != null) && players.length === 1) {
      let options = rows.filter(row => row.player === players[0] && (question.modifier ? String(row.modifier).toLowerCase() === question.modifier : String(row.modifier || 'standard').toLowerCase() === 'standard'));
      if (question.stat) options = options.filter(row => statMatches(question.stat, row));
      if (question.line != null && options.length > 1) {
        const exact = options.filter(row => Math.abs(row.line - question.line) < 0.01);
        if (exact.length) options = exact;
      }
      if (!options.length) return `${players[0]} doesn't have ${question.stat ? `a ${question.stat.name} line` : 'that line'} today.${listLines(players[0])}`;
      if (options.length > 1) {
        suggestions = options.slice(0, 3).map(row => `Should I take ${lastName(row.player)} over ${figure(row.line)} ${statShort({row})}?`);
        return `Which one: ${join(options.slice(0, 4).map(row => `his ${figure(row.line)} ${statShort({row})}`), 'or')}?`;
      }
      remember(question);
      return verdict(options[0], question.side, question);
    }

    const ranked = rank(legs, question);
    remember(question, ranked);
    if (players.length && !ranked.length) return `${players[0]} is on the board today, but none of his lines has a clear edge in our numbers. I'd pass on him.${listLines(players[0])}`;
    if (!rows.length) { suggestions = []; return 'There aren\'t any props posted right now. Check back closer to game time.'; }
    if (!ranked.length) {
      const what = [question.side ? sideWord({side: question.side}) : null, question.stat?.name, question.team ? 'for that team' : null].filter(Boolean).join(' ');
      suggestions = ["What's the play today?", 'Best matchup today'];
      return `I don't see a${what ? ` ${what}` : ''} prop I'd back right now. Try another stat or ask for the best matchup today.`;
    }
    if (question.count > 1) {
      ctx = {...ctx, ask: question, ranked, index: 0, sport: ranked[0].row.sport, player: ranked[0].player, leg: ranked[0]};
      suggestions = ['Why #1?', 'Build me a 3-pick slip', 'Safest pick'];
      const label = `Top ${Math.min(question.count, ranked.length)} ${question.stat ? question.stat.name + ' ' : ''}props today:`;
      answer = {lead: `${label.replace(/:$/, '.')} Ask "why #1" for the breakdown.`, card: {kind: 'list', picks: ranked.slice(0, question.count).map(pickCard)}};
      return `${label} ${ranked.slice(0, question.count).map((leg, index) => `${index + 1}) ${pickLine(leg)}, ${leg.grade}, ${percent(leg.chance)}`).join('; ')}. Ask "why #1" for the breakdown.`;
    }
    return answerPick(question, ranked);
  }

  function listLines(player) {
    const lines = allRows().filter(row => row.player === player && String(row.modifier || 'standard').toLowerCase() === 'standard');
    const named = [...new Set(lines.map(row => `${figure(row.line)} ${statShort({row})}`))].slice(0, 3);
    return named.length ? ` His lines today: ${join(named)}.` : '';
  }

  function hello() {
    const back = me.visits > 1 && previousVisit;
    const player = top(me.players).find(name => allLegs().some(leg => leg.player === name));
    const stat = favoriteStat();
    suggestions = examples();
    if (back && player) {
      const leg = rank(allLegs(), {intent: 'best', players: [player]})[0];
      if (leg) {
        ctx = {ask: {intent: 'best', players: [player], raw: '', text: ''}, ranked: [leg], index: 0, sport: leg.row.sport, player, leg};
        answer = {lead: `Welcome back! You were asking about ${lastName(player)} before, and he's got a good spot today. What else are we looking at?`, card: {kind: 'pick', pick: pickCard(leg)}};
        return `Welcome back! You were asking about ${lastName(player)} before, and he's got a good spot today: ${pickLine(leg)} (grade ${leg.grade}, ${percent(leg.chance)}). What else are we looking at?`;
      }
    }
    if (back && stat) return `Welcome back! Want your usual, the best ${stat.name} prop? Or ask me anything about today's board.`;
    if (back) return pick(['Welcome back! What are we looking at today?', 'Good to see you again. What do you need?'], random);
    return `Hey, I'm Krazy Bot. Ask me about today's ${allowed.map(sport => SPORTS[sport].name).join(', ')} props: best plays, matchups, a player, or a slip.`;
  }

  function recall() {
    const past = me.asked.slice(0, 4);
    suggestions = examples();
    if (!past.length) return 'You haven\'t asked me anything yet. Try "best K prop" or "what\'s the play today?".';
    const favorite = top(me.players)[0];
    return `Your last questions: ${past.map(item => `"${item.q}" (${relative(item.at, now())})`).join(', ')}.${favorite ? ` You ask about ${favorite} the most.` : ''}`;
  }

  function why(index) {
    const leg = ctx?.ranked?.[index ?? ctx.index];
    if (!leg) { suggestions = examples(); return 'Ask me for a pick first, like "best K prop", and I\'ll break it down.'; }
    const facts = evidence(leg);
    const risks = leg.read?.risks || [];
    suggestions = ['Next best', leg.side === 'OVER' ? 'What about the under?' : 'What about the over?', 'Build me a 3-pick slip'];
    const drawn = lower(matchupOf(leg)?.text || '');
    answer = {lead: `Here's why I like ${pickLine(leg)}.`, card: {kind: 'pick', pick: pickCard(leg), reasons: facts.filter(fact => fact !== drawn).slice(0, 5).map(sentence)}};
    return `Why ${pickLine(leg)}: ${join(facts.slice(0, 5))}.${risks.length ? ` Risks: ${join(risks.map(lower))}.` : ' Nothing major argues against it.'} Grade ${leg.grade}, ${percent(leg.chance)} to hit.`;
  }

  async function another() {
    if (!ctx?.ranked?.length) { suggestions = examples(); return 'Ask me for a pick first, like "best HRR prop", then I can give you the next one.'; }
    const next = ctx.index + 1;
    if (next >= ctx.ranked.length) {
      // A verdict or a single player's pick: the next one is the next best overall for that stat.
      const more = rank(allLegs(), {...ctx.ask, intent: 'best', players: [], line: null}).filter(leg => !ctx.ranked.some(shown => shown.player === leg.player));
      if (!more.length) { suggestions = ["What's the play today?"]; return 'That\'s everything I\'d back for that one. Ask about another stat or the best matchup today.'; }
      ctx = {...ctx, ranked: [...ctx.ranked, ...more]};
    }
    return answerPick({...ctx.ask, intent: 'another', players: []}, ctx.ranked, next);
  }

  async function flip(side) {
    const leg = ctx?.leg;
    if (!leg) { suggestions = examples(); return 'Ask me about a pick first, then I can tell you about the other side.'; }
    return verdict(leg.row, side || (leg.side === 'OVER' ? 'UNDER' : 'OVER'), {...ctx.ask, line: null});
  }

  async function compare(question, [first, second]) {
    const best = player => {
      const lines = allRows().filter(row => row.player === player && String(row.modifier || 'standard').toLowerCase() === 'standard'
        && (!question.stat || statMatches(question.stat, row)));
      return lines.flatMap(row => ['OVER', 'UNDER'].map(side => assess(row, side, {now: now()}))).filter(Boolean)
        .sort((a, b) => (b.backed - a.backed) || b.chance - a.chance)[0] || null;
    };
    const [a, b] = [best(first), best(second)];
    remember(question, [a, b].filter(Boolean));
    if (!a && !b) return `I don't have a good read on ${first} or ${second}${question.stat ? ` for ${question.stat.name}` : ''} today.`;
    const [win, lose] = !b || (a && a.chance >= b.chance) ? [a, b] : [b, a];
    ctx = {...ctx, ask: question, ranked: [win, lose].filter(Boolean), index: 0, sport: win.row.sport, player: win.player, leg: win};
    suggestions = ['Why?', 'Next best', 'Build me a 3-pick slip'];
    const facts = evidence(win).slice(0, 2);
    const versus = lose ? ` vs ${pickLine(lose)} at ${percent(lose.chance)}${lose.backed ? '' : ', which I wouldn\'t play'}` : '';
    answer = {lead: tidy(`I'd go ${lastName(win.player)}. ${sentence(facts[0] || '')}`), card: {kind: 'compare', picks: [win, lose].filter(Boolean).map(pickCard)}};
    return `I'd go ${lastName(win.player)}. ${pickLine(win)} is ${percent(win.chance)} to hit (grade ${win.grade})${versus}. ${sentence(join(facts))}`.replace(/\s+/g, ' ').trim();
  }

  async function rundown(question) {
    const sports = question.sport ? [question.sport] : allowed.filter(sport => (boards[sport]?.rows || []).length);
    if (!sports.length) return 'There aren\'t any props posted right now. Check back closer to game time.';
    const sport = sports[0];
    const rows = boards[sport].rows;
    const games = new Set(rows.map(gameKey)).size;
    const first = rows.map(row => Date.parse(row.startsAt || '')).filter(Number.isFinite).sort((a, b) => a - b)[0];
    const legs = boards[sport].legs;
    const topPlay = rank(legs, {intent: 'best', sport})[0];
    const matchup = rank(legs, {intent: 'matchup', sport}).find(leg => leg !== topPlay && matchupLift(leg) >= 0.03);
    const sleeper = rank(legs, {intent: 'value', sport})[0];
    remember({...question, sport}, topPlay ? [topPlay] : []);
    const parts = [`Today's ${SPORTS[sport].name} slate: ${games} ${SPORTS[sport].game}${first ? `, ${SPORTS[sport].start} at ${timeOf(first)}` : ''}.`];
    if (topPlay) parts.push(`Top play: ${pickLine(topPlay)} (${topPlay.grade}, ${percent(topPlay.chance)}).`);
    if (matchup) parts.push(`Best matchup: ${pickLine(matchup)}, ${lower(matchupOf(matchup)?.text || '')}.`.replace(', .', '.'));
    if (sleeper) parts.push(`Long shot: ${pickLine(sleeper)} at ${percent(sleeper.chance)}.`);
    const others = sports.slice(1).map(item => `${SPORTS[item].name} has ${new Set(boards[item].rows.map(gameKey)).size} games too`);
    if (others.length && !question.sport) parts.push(`${others.join(' and ')}.`);
    if (!topPlay) parts.push('Nothing I\'d back strongly yet.');
    if (topPlay) ctx = {...ctx, ask: {...question, intent: 'best', sport}, ranked: [topPlay, matchup, sleeper].filter(Boolean), index: 0, sport, player: topPlay.player, leg: topPlay};
    answer = {lead: tidy(`${parts[0]} ${others.length && !question.sport ? `${others.join(' and ')}.` : ''}${topPlay ? '' : ' Nothing I\'d back strongly yet.'}`),
      card: topPlay ? {kind: 'rundown', rows: [['Top play', topPlay], ['Best matchup', matchup], ['Long shot', sleeper]].filter(([, leg]) => leg).map(([tag, leg]) => ({tag, pick: pickCard(leg)}))} : null};
    if (!answer.card) answer = null;
    suggestions = ['Why the top play?'.replace('the top play', topPlay ? lastName(topPlay.player) : 'that'), 'Best matchup today', 'Build me a 3-pick slip'];
    return parts.join(' ');
  }

  async function slip(question) {
    const chosen = [];
    const games = new Set();
    for (const leg of rank(allLegs(), {...question, intent: 'safest', count: 6})) {
      if (leg.grade === 'C' || games.has(leg.game)) continue;
      chosen.push(leg); games.add(leg.game);
      if (chosen.length === question.count) break;
    }
    remember(question, chosen);
    if (chosen.length < question.count) return `I only see ${chosen.length || 'no'} pick${chosen.length === 1 ? '' : 's'} I'd trust from different games right now, not enough for a ${question.count}-pick slip. Try a smaller one.`;
    const together = chosen.reduce((product, leg) => product * leg.chance, 1);
    ctx = {...ctx, ask: question, ranked: chosen, index: 0, sport: chosen[0].row.sport, player: chosen[0].player, leg: chosen[0]};
    const payout = POWER[chosen.length];
    answer = {lead: `Here's a ${chosen.length}-pick slip I like. Every leg grades B or better and they're from different games.`,
      card: {kind: 'slip', picks: chosen.map(pickCard), together, payout: payout || null}};
    suggestions = ['Why the first leg?'.replace('the first leg', lastName(chosen[0].player)), question.count > 2 ? `Make it ${question.count - 1} picks` : 'Make it 3 picks', question.count < 6 ? `Make it ${question.count + 1} picks` : 'Safest pick'];
    return `Here's a ${chosen.length}-pick slip I like: ${chosen.map(pickLine).join('; ')}. Every leg grades B or better and they're from different games. All ${chosen.length} hit about ${percent(together)} of the time${payout ? `, a ${payout}x Power Play` : ''}.`;
  }

  return {ask, board: boardsLoaded, thinking, examples, suggestions: () => suggestions, card: () => answer, profile: () => me, returning: () => Boolean(returning)};
}

const HELP = allowed => `I break down today's ${allowed.map(sport => SPORTS[sport].name).join(', ')} props using our models: record vs the line, projections, matchups and the books. Ask "what's the play today?", "best K prop", "should I take Skubal over 6.5 Ks?", "compare Judge and Soto", "top 3 total bases" or "build me a 3-pick slip". Follow up with "why?", "next" or "what about the under?". I remember what you ask about.`;
