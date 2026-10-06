// Krazy Bot: answers questions about today's props in plain words.
//
// There is no outside service behind it. A question is read for what it
// asks (a stat, a side, a line, players, a team, a sport, how many), with
// typos and slang straightened out first and the conversation so far
// filling in what a follow-up leaves unsaid ("what about the under?",
// "is he safe?"). Today's picks are read the way the Smart Slip reads them
// (smart-slip.js: record vs the line, projection, books) and then judged
// the way the Slip Analyzer judges them (slip-check.js judge: the matchup
// case from slip-matchup.js first, the tiers Elite to Fade), so the bot
// and the analyzer always agree on a pick. The reply is written from the
// numbers behind the pick -- every one checkable on the player's page. A
// small profile per member (what they ask about) lets it pick up where
// they left off.

import {candidates, reasons, POWER, FLEX, assessLeg, gameKey} from './smart-slip.js';
import {matchupRead, matchupGrade, withPoolDefense} from './slip-analyst.js';
import {judge as judgeLeg, scoreEntry, TIERS, baselineOf} from './slip-check.js';
import {link} from './slip-correlation.js';
import {withGame} from './slip-games.js';
import {withMatchups} from './slip-matchup.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const percent = value => `${Math.round(value * 100)}%`;
const figure = value => Number.isInteger(value) ? String(value) : value.toFixed(1);
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
const nameKey = value => String(value || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const clean = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[’`]/g, "'").replace(/&/g, ' and ').replace(/\s+/g, ' ').trim();
const lastName = name => String(name || '').trim().split(/\s+/).filter(part => !/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(part)).at(-1) || name;
const GRADE_ORDER = {A: 0, B: 1, C: 2, D: 3, F: 4};
// The analyzer's tiers as the bot's letters (for ordering and its tone of voice).
const TIER_GRADE = {elite: 'A', strong: 'B', lean: 'C', risky: 'D', fade: 'F'};
/** "Strong", the analyzer's word for a pick; a letter when it has no tier. */
export const gradeWord = leg => (leg?.tier ? TIERS[leg.tier].label : leg?.grade ? `grade ${leg.grade}` : '');
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

// NFL rows carry the market's key (backend/sports/nfl/markets.py); matched on it.
const nfl = (key, name, short, words, extra = {}) => ({sport: 'nfl', key, name, short, keys: [key], words, ...extra});
export const NFL_STATS = [
  nfl('passing_rushing_yards', 'pass + rush yards', 'Pass+Rush Yds', [/pass(ing)? ?(\+|and|plus) ?rush(ing)? ?(yards?|yds)/]),
  nfl('rushing_receiving_yards', 'rush + rec yards', 'Rush+Rec Yds', [/rush(ing)? ?(\+|and|plus) ?rec(eiving)? ?(yards?|yds)|scrimmage yards/]),
  nfl('passing_touchdowns', 'passing TD', 'pass TDs', [/pass(ing)? (tds?|touchdowns?)|td passes|touchdown passes/]),
  nfl('passing_attempts', 'pass attempts', 'pass attempts', [/pass(ing)? attempts?/]),
  nfl('pass_completions', 'completions', 'completions', [/completions?/]),
  nfl('longest_completion', 'longest completion', 'longest completion', [/longest (pass|completion)/]),
  nfl('passing_yards', 'passing yards', 'pass yards', [/pass(ing)? ?(yards?|yds)|throwing yards|through the air/]),
  nfl('interceptions', 'interceptions thrown', 'INTs thrown', [/interceptions? thrown|picks thrown|\bints?\b/]),
  nfl('rush_attempts', 'rush attempts', 'rush attempts', [/rush(ing)? attempts?|carries/]),
  nfl('longest_rush', 'longest rush', 'longest rush', [/longest rush/]),
  nfl('rushing_yards', 'rushing yards', 'rush yards', [/rush(ing)? ?(yards?|yds)|ground yards/]),
  nfl('longest_reception', 'longest reception', 'longest reception', [/longest (reception|catch)/]),
  nfl('receiving_yards', 'receiving yards', 'rec yards', [/rec(eiving)? ?(yards?|yds)/]),
  nfl('receptions', 'receptions', 'receptions', [/receptions?|catches|\brecs?\b/]),
  nfl('targets', 'targets', 'targets', [/targets?/]),
  nfl('touchdowns', 'touchdown', 'rush+rec TDs', [/anytime (td|touchdown)|\btds?\b|touchdowns?|score a td/]),
  nfl('fg_made', 'field goals made', 'FG made', [/field goals?( made)?|\bfgs?\b/], {shared: true}),
  nfl('kicking_points', 'kicking points', 'kicking points', [/kick(ing|er) points/]),
  nfl('tackles', 'tackles', 'tackles', [/tackles?/]),
  nfl('sacks', 'sacks', 'sacks', [/\bsacks?\b/]),
  nfl('fantasy_score', 'fantasy', 'fantasy points', [/fantasy/], {shared: true}),
];
// WNBA lines use PrizePicks' basketball stat names, the same as the NBA's.
export const WNBA_STATS = NBA_STATS.map(stat => ({...stat, sport: 'wnba'}));

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

const NFL_TEAMS = teamMap({
  'cardinals|arizona': ['ARI'], 'falcons|atlanta': ['ATL'], 'ravens|baltimore': ['BAL'], 'bills|buffalo': ['BUF'], 'panthers|carolina': ['CAR'],
  'bears|chicago': ['CHI'], 'bengals|cincinnati': ['CIN'], 'browns|cleveland': ['CLE'], 'cowboys|dallas': ['DAL'], 'broncos|denver': ['DEN'],
  'lions|detroit': ['DET'], 'packers|green bay': ['GB'], 'texans|houston': ['HOU'], 'colts|indianapolis': ['IND'], 'jaguars|jags|jacksonville': ['JAX'],
  'chiefs|kansas city': ['KC'], 'raiders|las vegas': ['LV'], 'chargers': ['LAC'], 'rams': ['LA', 'LAR'], 'dolphins|miami': ['MIA'],
  'vikings|minnesota': ['MIN'], 'patriots|pats|new england': ['NE'], 'saints|new orleans': ['NO'], 'giants': ['NYG'], 'jets': ['NYJ'],
  'eagles|philadelphia|philly': ['PHI'], 'steelers|pittsburgh': ['PIT'], '49ers|niners|san francisco': ['SF'], 'seahawks|seattle': ['SEA'],
  'buccaneers|bucs|tampa': ['TB'], 'titans|tennessee': ['TEN'], 'commanders|washington': ['WAS', 'WSH'],
});
const WNBA_TEAMS = teamMap({
  'dream': ['ATL'], 'sky': ['CHI'], 'sun|connecticut': ['CON', 'CONN'], 'wings': ['DAL'], 'valkyries': ['GS', 'GSV'], 'fever': ['IND'],
  'aces': ['LV', 'LVA'], 'sparks': ['LA', 'LAS'], 'lynx': ['MIN'], 'liberty': ['NY', 'NYL'], 'mercury': ['PHX', 'PHO'], 'storm': ['SEA'],
  'mystics': ['WAS', 'WSH'], 'tempo': ['TOR'], 'fire': ['POR'],
});

export const SPORTS = {
  mlb: {name: 'MLB', game: 'games', start: 'first pitch', words: /\b(mlb|baseball)\b/, stats: MLB_STATS, teams: MLB_TEAMS},
  nba: {name: 'NBA', game: 'games', start: 'tip-off', words: /\b(nba|basketball|hoops)\b/, stats: NBA_STATS, teams: NBA_TEAMS},
  nhl: {name: 'NHL', game: 'games', start: 'puck drop', words: /\b(nhl|hockey)\b/, stats: NHL_STATS, teams: NHL_TEAMS},
  nfl: {name: 'NFL', game: 'games', start: 'kickoff', words: /\b(nfl|football)\b/, stats: NFL_STATS, teams: NFL_TEAMS},
  wnba: {name: 'WNBA', game: 'games', start: 'tip-off', words: /\bwnba\b|\bwomen'?s basketball\b/, stats: WNBA_STATS, teams: WNBA_TEAMS},
};
const OTHER_SPORTS = /\b(ncaa|college|tennis|soccer|cs2|csgo|counter[ -]?strike|golf|ufc|mma)\b/;

/** Whether a row is the stat a question asks for. */
export function statMatches(stat, row) {
  if (!stat || String(row.sport || 'mlb') !== stat.sport) return false;
  if (stat.sport === 'mlb') return row.marketKey === stat.key;
  if (stat.keys) return stat.keys.includes(row.marketKey);
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
  // "Lineup" is a slip only when building one; otherwise it's a team's hitters.
  if (/\b(slip|parlay|entry|power play|flex( play)?|combo)\b|\b(build|make|give me|create|put together)\b.*\blineup\b|\b(\d|two|three|four|five|six)[ -]?(picks?|legs?|man)\b|\bpays?\b.*\b\d{1,3}(\.\d{1,2})?\s*(x|times)\b/.test(q)) {
    const legs = q.match(/\b(\d|two|three|four|five|six)[ -]?(pick|leg|man|player)/);
    // A safe slip (the likeliest picks) or a value one (the most payout for the chance).
    const style = /\b(safe(st|r)?|lock|locks|sure|surest|banker)\b/.test(q) ? 'safe'
      : /\b(value|long ?shots?|big(ger)? (payout|pay|win)|demons?|upside|lottery)\b/.test(q) ? 'value' : 'best';
    // A payout to aim for ("a 2x", "pays 5x", "10 times"), Goblins or Demons
    // on it ("with a goblin": at least one; "all goblins": every pick), and Flex.
    const aim = q.match(/\b(\d{1,3}(?:\.\d{1,2})?)\s*x\b/) || q.match(/\bpays?\s+(?:about\s+|around\s+)?(\d{1,3}(?:\.\d{1,2})?)\b/) || q.match(/\b(\d{1,3}(?:\.\d)?)\s+times\b/);
    const payout = aim && Number(aim[1]) >= 1.2 ? Math.min(1000, Number(aim[1])) : null;
    const only = Boolean(ask.modifier) && /\b(all|only|just|every)\b[^.?!]*\b(goblins?|demons?)\b|\b(goblins?|demons?)\s+only\b/.test(q);
    const count = Math.max(2, Math.min(6, Number(legs?.[1]) || NUMBER_WORDS[legs?.[1]] || 3));
    return {...ask, intent: 'slip', style, count, counted: Boolean(legs), payout, only, play: /\bflex\b/.test(q) && count >= 3 ? 'flex' : 'power'};
  }
  if (['another', 'flip', 'usual', 'mine', 'value'].includes(ask.intent)) return ask;
  const sheet = sheetAsked(q);
  if (sheet) return {...ask, intent: 'sheet', ...sheet};
  // An analyst's questions about one player or team, ahead of "vs"/"or"
  // reading as a comparison.
  const asking = !/\b(best|top|safest|props? today|slip|parlay)\b/.test(q);
  if (asking && /\b(innings?|how (deep|long|far)|go(ing|es)? deep|pitch(es)? count|how many pitches|leash|workload|stamina)\b/.test(q)) return {...ask, intent: 'innings'};
  if (asking && /\b(lefties|righties|left[- ]?handed|right[- ]?handed|lefty|righty|lhp|rhp|handed(ness)?|platoon|who (is|'?s) (he|she) facing|who (does|do) (he|they) face|who'?s pitching (against|vs))\b/.test(q)) return {...ask, intent: 'detail'};
  if (/\b(hot|hottest|hotter|cold|coldest|colder|on fire|slumping|struggling|swinging (it|well)|bats|been hitting|hitting lately|lately|recent form|streaking|trending|ice cold)\b/.test(q) && !/\bhot (take|pick|play)s?\b/.test(q)) return {...ask, intent: 'form'};
  if (/\b(rank(ed|ing|ings|s)?|strike ?outs? the most|most strikeouts|whiff the most|k%|k rate|worst lineups?|weakest lineups?|best lineups?|toughest lineups?|which (teams?|lineups?))\b/.test(q)) return {...ask, intent: 'rankings'};
  if (asking && /\b(minutes|mins|playing time|ice time|toi|usage)\b/.test(q)) return {...ask, intent: 'usage'};
  if (asking && /\b(project(ed|ion|ions|s)?|expect(ed|ing)?|how many \w+ (will|does|should|can|is)|what('?s| is| does) (his|her|their) (projection|number|line))\b/.test(q)) return {...ask, intent: 'projection'};
  if (asking && /\b(against|vs\.?|versus) (the )?\w+/.test(q) && /\b(how (does|do|did|has|have)|history|career|numbers|done)\b/.test(q)) return {...ask, intent: 'detail'};
  if (/\b(compare|versus|vs\.?|better (play|pick|option)|who should i (take|play|pick)|which (one|is better))\b|\bor\b/.test(q)) ask.intent = 'compare';
  if (/^(should i|would you|do you like|you like|is (it|this|that)?|thoughts on|how do you feel|tail|lock in|take|is \w+ (a )?(good|safe|worth))|\b(good (play|bet|pick)|worth (it|a play)|safe (play|bet)|smash or pass|yes or no)\b|\?$/.test(q)
      && (ask.line != null || /^(should|would|do you|you like|is|thoughts|how do you feel|tail|lock|take)\b/.test(q))) ask.verdict = true;
  if (/\b(rundown|slate|run ?down|overview|summary|card|what'?s (the )?(play|move|good|best bet)|what do you like|what are you (on|taking|playing)|today'?s (plays|picks|best))\b/.test(q)) ask.intent = 'rundown';
  else if (/\b(safe(st)?|lock|locks|sure|surest|most likely|highest (chance|percent|probability)|confident|banker)\b/.test(q)) ask.intent = ask.intent === 'compare' ? 'compare' : 'safest';
  else if (/\bmatch ?ups?\b|\bmismatch\b|\bexploit\b|\bweak(est)? (pitcher|lineup|opponent|defense)\b/.test(q)) ask.intent = ask.intent === 'compare' ? 'compare' : 'matchup';
  return ask;
}

// The day's MLB cheat sheets (mlb_sheets.py), asked about in plain words:
// first-inning runs, ballparks and weather, active streaks, career numbers
// against today's starter, the best home run bats and who's hot.
const STREAK_WORDS = [[/\bon ?base\b|\bobp\b|reach(ed|ing)? base/, 'onbase'], [/\b(home ?runs?|hrs?|homers?)\b/, 'hr'],
  [/total bases|\btbs?\b/, 'tb2'], [/\bwalks?\b|\bbbs?\b/, 'bb'], [/\bsteals?\b|stolen|\bsbs?\b/, 'sb'], [/strike ?outs?|\bks?\b/, 'k']];
function sheetAsked(q) {
  if (/\b(nrfi|yrfi)\b|\b(first|1st) inning (runs?|scor(e|es|ing))\b|\bruns? in the (first|1st)( inning)?\b/.test(q)
      && !/\b(strike ?outs?|hits? allowed|walks?|pitch(es)?)\b/.test(q)) return {sheet: 'nrfi'};
  if (/\b(weather|windy?|rain(out|y)?|forecast|temperature|ball ?parks?|park factors?|stadiums?|blowing (in|out)|roof)\b/.test(q)) return {sheet: 'park', wind: /\b(windy?|blowing)\b/.test(q), rain: /\brain/.test(q)};
  if (/\b(streaks?|streaking|in a row|straight games)\b/.test(q)) return {sheet: 'streaks', streak: (STREAK_WORDS.find(([pattern]) => pattern.test(q)) || [null, 'hits'])[1]};
  if (!/\b(lefties|righties|lefty|righty|lhp|rhp|left[- ]?handed|right[- ]?handed)\b/.test(q)
      && (/\bbvp\b|\bcareer (numbers|stats|history|line|vs|against)\b|\bhistory (vs|against|with|off)\b|\b(owns?|owned)\b|\bfaced (him|before)\b/.test(q)
        || /\bhow (does|do|has|have|did) \w+( \w+)? (hit|do|done|fare|fared|hits) (vs\.? |against |off )?\w+/.test(q) && /\bhit(s)? (vs\.? |against |off )?\w+/.test(q))) return {sheet: 'bvp'};
  if (/\bwho('?s| is| will)?( \w+)? (going to |gonna )?(homer|home ?run|hit (a )?(home ?run|hr|homer|dinger)|go yard|go deep)\b|\b(home ?run|hr|homer|dinger|power) (sheet|candidates?|bets?|plays|bats|threats?)\b|\bmost likely to (homer|home ?run|go deep|hit a home ?run)\b|\bbest (hr|home ?run) (bets?|plays|picks|candidates?)\b/.test(q)) return {sheet: 'hr'};
  if (/\b(hot|hottest|on fire|heating up|swinging (it|well)|raking)\b/.test(q) && /\b(hitters?|batters?|players?|guys)\b/.test(q) && !/\b(lineups?|teams?)\b/.test(q)) return {sheet: 'hot'};
  return null;
}

// First names that are everyday words too ("will he go deep", "drew a
// walk"): they only name a player already on screen.
const WORD_NAMES = new Set(['will', 'drew', 'max', 'chase', 'mark', 'grant', 'hunter', 'jack', 'august', 'rich', 'bo', 'cash', 'gray',
  'young', 'hope', 'early', 'case', 'miles', 'king', 'chance', 'christian', 'major', 'royce', 'ty', 'cal', 'win', 'ben', 'dean', 'art']);

/**
 * Board players a question names: full names, distinct last names,
 * near-misses of a last name, then first names ("why jacob") -- read
 * first against `preferred`, the players on screen.
 */
export function findPlayers(text, names, {preferred = []} = {}) {
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
  const firsts = new Map();
  for (const name of people) {
    const first = plain(name).split(' ')[0];
    if (first.length < 2 || stop.has(first)) continue;
    (firsts.get(first) || firsts.set(first, []).get(first)).push(name);
  }
  const onScreen = new Set(preferred);
  const groups = [];
  for (const word of words) {
    if (covered.has(word) || stop.has(word)) continue;
    let match = word.length >= 4 ? lasts.get(word) : null;
    if (!match && word.length >= 5) {
      const near = [...lasts.keys()].filter(last => Math.abs(last.length - word.length) <= 1 && distance(word, last) <= 1);
      if (near.length === 1) match = lasts.get(near[0]);
    }
    if (!match && firsts.has(word)) {
      const named = firsts.get(word), shown = named.filter(name => onScreen.has(name));
      if (shown.length) match = shown;
      else if (!WORD_NAMES.has(word) && word.length >= 3) match = named;
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

/**
 * Every pick is judged the Slip Analyzer's way (slip-check.js judge): the
 * matchup case for his side (slip-matchup.js), his chance with the matchup
 * counting most, and the tier. A tough matchup is a red flag however good
 * the last 10 looks, and so is news that caps the pick (he's out, or out of
 * the lineup). `required` is whether the league has opponent reads today.
 */
export function withMatchup(leg, required, tables = {}) {
  if (!leg) return leg;
  const judged = judgeLeg(leg, tables);
  const found = judged.matchup;
  // The matchup's lean, on the tiers' own lines: 56+ can back a Strong pick, under 45 caps it at Risky.
  const tone = !found ? null : found.score >= 56 ? 'good' : found.score < 45 ? 'tough' : 'neutral';
  const lead = found?.facts.find(item => item.kind !== 'form') || found?.facts[0];
  const out = {...judged, grade: TIER_GRADE[judged.tier] || leg.grade, matchupRequired: Boolean(required),
    matchup: found ? {...found, band: found.tone, tone, text: lead?.text || ''} : null};
  const news = found?.facts.find(item => item.kind === 'news' && item.level);
  const recent = leg.records?.l10 || leg.records?.l5;
  if (judged.capped && news) {
    out.redFlag = news.text;
    out.backed = false;
  } else if (tone === 'tough') {
    // "Tough matchup" -> "the matchup is tough (39)".
    const band = found.label.replace(/\s*matchup$/i, '').toLowerCase();
    out.redFlag = recent && recent.rate >= 0.6
      ? `He's ${recent.won} of his last ${recent.games}, but the matchup is ${band} (${found.score})`
      : `The matchup is ${band} (${found.score})`;
    out.flagWhy = found.facts.find(item => item.tone === 'down')?.text || null;
    out.backed = false;
  } else if (judged.tier === 'risky' || judged.tier === 'fade') out.backed = false;
  return out;
}
/** A day's legs judged; a league "requires" matchups when any of its picks has an opponent read. */
export function gradeMatchups(legs, tables = {}) {
  const judged = legs.map(leg => withMatchup(leg, false, tables));
  const read = new Set(judged.filter(leg => leg?.matchup?.primary).map(leg => String(leg.row?.sport || 'mlb')));
  return judged.map(leg => leg && {...leg, matchupRequired: read.has(String(leg.row?.sport || 'mlb'))});
}
// The red flag in words, with what's behind it.
function redFlagWords(leg) {
  return `${sentence(leg.redFlag)}${leg.flagWhy ? ` ${sentence(leg.flagWhy)}` : ''}`;
}
// A pick we'd recommend: Elite or Strong (a good matchup and the numbers
// behind it), or a Lean in a league with no opponent reads today.
export const passesMatchup = leg => (leg.tier ? leg.tier === 'elite' || leg.tier === 'strong' || (!leg.matchupRequired && leg.tier === 'lean')
  : !leg.matchupRequired);

/** Today's picks for a question, best first, one per player. */
export function rank(legs, ask) {
  let pool = legs.filter(leg => !ask.sport || String(leg.row?.sport || 'mlb') === ask.sport);
  pool = pool.filter(leg => ask.modifier ? leg.modifier === ask.modifier : ask.intent === 'value' ? leg.modifier === 'demon' : leg.modifier === 'standard');
  if (ask.stat) pool = pool.filter(leg => statMatches(ask.stat, leg.row));
  if (ask.group) pool = pool.filter(leg => String(leg.row.marketKey || '').startsWith(`${ask.group}:`));
  if (ask.side) pool = pool.filter(leg => leg.side === ask.side);
  if (ask.team) pool = pool.filter(leg => ask.team.includes(String(leg.row.teamAbbr || '').toUpperCase()));
  if (ask.players?.length) pool = pool.filter(leg => ask.players.includes(leg.player));
  // Asked about a player, every line of his is fair game (with its red flags);
  // otherwise only picks with a good matchup.
  else pool = pool.filter(passesMatchup);
  const order = ask.intent === 'safest' || ask.intent === 'value' ? (a, b) => b.chance - a.chance
    : ask.intent === 'matchup' ? (a, b) => (b.matchup?.score ?? 0) - (a.matchup?.score ?? 0) || byGrade(a, b)
      : (a, b) => byGrade(a, b) || (b.matchup?.score ?? 50) - (a.matchup?.score ?? 50);
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
// American odds as the chance they imply (with the book's margin still in).
const implied = price => !finite(price) || price === 0 ? null : price < 0 ? -price / (-price + 100) : 100 / (price + 100);
const median = values => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * The scouting report under a pick: its record over each window, the last
 * 20 games against the line, home and road, what the books charge for it
 * against our chance, and the player's other lines on this stat (the
 * ladder). Plain numbers; src/KrazyBotCard.jsx draws them.
 */
export function pickReport(leg, {ladder = []} = {}) {
  const {row, side} = leg;
  const line = row.line, sign = side === 'UNDER' ? -1 : 1;
  const won = value => value === line ? null : (value - line) * sign > 0;
  const log = (row.gameLog || []).filter(game => finite(game.value));
  const games = log.slice(-20).map(game => ({value: game.value, date: shortDate(game.date),
    opponent: typeof game.opponent === 'string' && game.opponent ? game.opponent : null,
    home: typeof game.home === 'boolean' ? game.home : null, hit: won(game.value)}));
  const records = leg.records || {};
  const ring = (key, label) => records[key]?.games ? {key, label, won: records[key].won, games: records[key].games, rate: records[key].rate} : null;
  const rings = [ring('l5', 'L5'), ring('l10', 'L10'), ring('l20', 'L20'), ring('season', 'Season'), ring('h2h', row.opponent ? `vs ${row.opponent}` : 'H2H')].filter(Boolean);
  const split = list => {
    const decided = list.filter(game => game.value !== line);
    return list.length ? {games: list.length, avg: mean(list.map(game => game.value)), won: decided.filter(game => won(game.value)).length, decided: decided.length} : null;
  };
  const values = log.slice(-20).map(game => game.value);
  const opponent = row.sport === 'mlb' ? row.opponentTeamId : row.opponent;
  const versus = opponent == null ? [] : log.filter(game => game.opponent != null && String(game.opponent) === String(opponent));
  const books = (row.apps || []).filter(app => app && app.key !== 'prizepicks')
    .map(app => ({name: app.name || app.key, price: side === 'UNDER' ? app.under : app.over}))
    .filter(book => finite(book.price)).map(book => ({...book, chance: implied(book.price)}))
    .sort((a, b) => b.price - a.price).slice(0, 6);
  const role = leg.read?.factors?.find(item => item.key === 'role');
  return {
    line, side, games, rings,
    stats: values.length ? {avg: mean(values), median: median(values), high: Math.max(...values), low: Math.min(...values), projection: finite(leg.read?.projection) ? leg.read.projection : null} : null,
    splits: {home: split(log.filter(game => game.home === true)), away: split(log.filter(game => game.home === false)),
      today: typeof row.isHome === 'boolean' ? (row.isHome ? 'home' : 'away') : null,
      versus: versus.length ? {opponent: row.opponent || null, ...split(versus), games: versus.slice(-6).map(game => ({value: game.value, date: shortDate(game.date), hit: won(game.value)}))} : null},
    market: {model: finite(leg.chance) ? leg.chance : null, books: finite(leg.book) ? leg.book : null,
      edge: finite(leg.chance) && finite(leg.book) ? leg.chance - leg.book : null},
    books, ladder,
    defense: finite(row.defense) && finite(row.defenseTeams) ? {rank: row.defense, teams: row.defenseTeams, position: row.defensePosition || null} : null,
    role: role?.text ? {text: role.text, short: role.short || null} : null,
  };
}

export function pickCard(leg, {ladder = []} = {}) {
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
  const model = matchupGrade(leg.read, side);
  return {
    player: leg.player, headshot: row.headshot || null, position: row.position || null, sport: row.sport || 'mlb',
    team: row.teamAbbr || null, teamLogo: row.teamLogo || null,
    opponent: row.opponent || null, opponentLogo: opponentLogo(row), home: typeof row.isHome === 'boolean' ? row.isHome : null,
    time: timeOf(row.startsAt), side, line, stat: row.market || statShort(leg), short: statShort(leg),
    modifier: leg.modifier || 'standard', grade: leg.grade || null, tier: leg.tier || null, chance: leg.chance, backed: leg.backed !== false,
    projection: finite(projection) ? Math.round(projection * 10) / 10 : null,
    record: recent ? {won: recent.won, games: recent.games} : null, last, tiles,
    matchup: matchup?.text ? {
      text: matchup.text, short: matchup.short || null, tone: lift >= 0.03 ? 'up' : lift <= -0.03 ? 'down' : null,
      photo: pitcher?.id ? MLB_PHOTO(pitcher.id) : opponentLogo(row), face: Boolean(pitcher?.id),
      name: pitcher?.name || row.opponent || null, hand: pitcher?.hand || null,
    } : null,
    risks: (leg.read?.risks || []).slice(0, 2),
    // The Slip Analyzer's matchup panel (slip-matchup.js), as it reads there.
    case: leg.matchup?.facts?.length ? {score: leg.matchup.score, label: leg.matchup.label, tone: leg.matchup.band || leg.matchup.tone,
      primary: Boolean(leg.matchup.primary), facts: leg.matchup.facts} : null,
    // The Research model's factors and the starter's pitches (MLB hitters), for the pitch-mix chart.
    rating: model ? {score: model.score, label: model.label, tone: model.tone, versus: row.hitterMatchup?.pitcher?.name || null,
      factors: (model.factors || []).filter(item => item.available && finite(item.impact))
        .map(item => ({name: item.name, impact: (leg.side === 'UNDER' ? -1 : 1) * item.impact, detail: item.detail}))
        .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 5),
      pitches: (model.pitches || []).slice(0, 4)} : null,
    redFlag: leg.redFlag || null,
    report: pickReport(leg, {ladder}),
    // The line itself, for the card's buttons (add to My Slip, open in the Finder).
    row,
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
  moves = null, sheets = null, matchups = null, games = null, now = () => Date.now(), random = Math.random} = {}) {
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
        // The lines and the league's matchup tables (slip-matchup.js loadMatchups), side by side.
        const [rows, tables] = await Promise.all([load(sport), matchups ? matchups(sport).catch(() => ({})) : {}]);
        entry.tables = tables || {};
        const listed = (rows || []).map(row => withMatchups({...row, sport: row.sport || sport}, entry.tables));
        Object.assign(entry, {rows: withPoolDefense(listed), at: now(), failed: false});
        entry.legs = gradeMatchups(judge(entry.rows), entry.tables);
        entry.matchups = entry.legs.some(leg => leg.matchupRequired);
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
  // A pick's game news (slip-games.js, via `games`: the injury report, the
  // lineups, who starts and what a teammate's absence has meant), judged
  // again with it -- as the Slip Analyzer does -- for every pick the bot
  // talks about or puts on a slip. Kept a few minutes per line.
  const news = new Map();
  const newsKey = leg => String(leg.row.id ?? `${leg.player}:${leg.row.market}`);
  const rejudged = (leg, held) => {
    if (!held?.game) return leg;
    const entry = boards[leg.row.sport || 'mlb'];
    return withMatchup({...leg, chance: leg.trendChance ?? leg.chance, row: withGame(leg.row, held.game)}, leg.matchupRequired, entry?.tables || {});
  };
  /** Several picks' news in one go (one request per game), each judged again with it. */
  async function withNewsAll(legs) {
    if (!games) return legs;
    const due = new Map();
    for (const leg of legs) {
      if (!leg?.row) continue;
      const key = newsKey(leg), held = news.get(key);
      if (!held || now() - held.at > 3 * 60000) due.set(key, leg.row);
    }
    if (due.size) {
      let found = null;
      try { found = await games([...due].map(([key, row]) => ({key, row}))); } catch { found = null; }
      for (const key of due.keys()) news.set(key, {at: now(), game: found?.[key] || null});
    }
    return legs.map(leg => (leg?.row ? rejudged(leg, news.get(newsKey(leg))) : leg));
  }
  const withNews = async leg => (await withNewsAll([leg]))[0];
  // One side of one line, read and judged the way the board's picks are.
  const readSide = (row, side) => {
    const entry = boards[row.sport || 'mlb'];
    return withMatchup(assess(row, side, {now: now()}), Boolean(entry?.matchups), entry?.tables || {});
  };
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
    if (allowed.includes('nfl')) base.push('Best receiving yards prop');
    if (allowed.includes('wnba')) base.push('Best WNBA points prop');
    const personal = [stat && `Best ${stat.name} prop`, player && `How's ${lastName(player)} looking?`].filter(Boolean);
    return [...new Set([...personal, ...base])].slice(0, 6);
  }

  /** Short status lines for the thinking animation, about this question. */
  function thinking(text) {
    const known = new Set(allRows().flatMap(row => nameKey(row.player) ? clean(row.player).split(' ') : []));
    const ask = understand(text, {keepWords: known});
    const {players} = findPlayers(text, allRows().map(row => row.player), {preferred: onScreen()});
    const sport = ask.sport || players.map(name => allRows().find(row => row.player === name)?.sport)[0] || ctx?.sport || allowed[0];
    const count = (boards[sport]?.rows || []).length;
    const steps = ['Reading your question'];
    if (count) steps.push(`Scanning ${count} ${SPORTS[sport]?.name || ''} props`.replace(/\s+/g, ' '));
    else steps.push(`Loading today's ${SPORTS[sport]?.name || ''} lines`.replace(/\s+/g, ' '));
    if (players[0] && !['innings', 'form', 'rankings'].includes(ask.intent)) steps.push(`Checking ${lastName(players[0])}'s last 10`);
    if (players[1] && !['innings', 'form', 'rankings'].includes(ask.intent)) steps.push(`Checking ${lastName(players[1])}'s last 10`);
    if (ask.intent === 'matchup' || ask.intent === 'rundown') steps.push('Reading today\'s matchups');
    const named = players.length ? players : /\b(they|them|both)\b/.test(ask.text) ? onScreen() : ctx?.player ? [ctx.player] : [];
    if (ask.intent === 'innings') steps.push(...named.slice(0, 2).map(name => `Pulling ${lastName(name)}'s recent starts`), 'Projecting innings');
    if (ask.intent === 'detail') steps.push('Checking the lineup vs his hand', 'Reading the last 10 days of hitting');
    if (ask.intent === 'form') steps.push('Reading the last 10 days of hitting', 'Ranking today\'s lineups');
    if (ask.intent === 'rankings') steps.push('Ranking today\'s lineups', 'Matching each to the starter\'s hand');
    if (ask.intent === 'usage') steps.push('Checking playing time');
    if (ask.intent === 'projection') steps.push('Running the projection');
    if (ask.intent === 'sheet') steps.push({nrfi: 'Reading first innings', park: 'Checking parks and the forecast', streaks: 'Counting active streaks',
      bvp: 'Pulling career matchups', hot: 'Reading the last 14 days', hr: 'Ranking power bats'}[ask.sheet] || 'Reading today\'s cheat sheets');
    if (ask.stat) steps.push(`Ranking ${ask.stat.name} props`);
    if (ask.intent === 'slip') steps.push('Spreading legs across games');
    if (!['innings', 'form', 'rankings', 'usage', 'sheet'].includes(ask.intent)) steps.push('Checking what the books say');
    steps.push('Writing it up');
    return [...new Set(steps)].slice(0, 6);
  }

  const answerPick = async (ask, ranked, index = 0) => {
    // The news can knock a pick out (he's out, or out of the lineup): asked
    // for the best, the next one steps up; asked about him, he's shown with it.
    ranked = ranked.slice();
    for (let tries = 0; tries < 3 && index < ranked.length; tries++) {
      ranked[index] = await withNews(ranked[index]);
      if (ask.players?.length || passesMatchup(ranked[index]) || index === ranked.length - 1) break;
      ranked.splice(index, 1);
    }
    ctx = {...ctx, ask, ranked, index, sport: ranked[index].row.sport, player: ranked[index].player, leg: ranked[index]};
    const leg = ranked[index];
    const name = lastName(leg.player);
    const opener = ask.players?.length && index === 0 ? pick([`Best way to play ${name} today:`, `For ${name}, I like`, `${name}'s best prop today:`], random)
      : pick((OPENERS[ask.intent] || OPENERS.best)(ask.stat), random);
    const facts = evidence(leg).slice(0, 3);
    const risk = leg.read?.risks?.[0];
    const watch = risk ? ` ${pick(['One thing to watch:', 'Only knock:', 'Watch out:'], random)} ${lower(risk)}.` : '';
    suggestions = ['Why?', 'Next best', leg.side === 'OVER' ? 'What about the under?' : 'What about the over?', 'Build me a 3-pick slip'];
    const confidence = leg.redFlag ? `Red flag: ${lower(leg.redFlag)}, so I wouldn't back it.` : pick(CONFIDENCE[leg.grade] || CONFIDENCE.C, random);
    const moved = await moveNote(leg);
    answer = {lead: tidy(`${opener} ${pickLine(leg)}. ${confidence} ${sentence(facts[0] || '')}${moved}`), card: {kind: 'pick', pick: fullCard(leg)}};
    return tidy(`${opener} ${pickLine(leg)} (${gradeWord(leg)}, ${percent(leg.chance)} to hit). ${confidence} ${sentence(join(facts))}${watch}${moved}`);
  };

  // ---------------------------------------------------------------- the cheat sheets

  const sheetCache = new Map();
  async function sheetData(name) {
    const kept = sheetCache.get(name);
    if (kept && now() - kept.at < FRESH_MS) return kept.data;
    const data = await sheets(name);
    sheetCache.set(name, {at: now(), data});
    return data;
  }
  const signedPct = value => finite(value) ? `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(Math.round(value))}%` : '—';
  const rate3 = value => finite(value) ? value.toFixed(3).replace(/^0/, '') : '—';
  const priceOf = value => finite(value) ? (value > 0 ? `+${value}` : String(value)) : '—';
  const onTeam = (team, ...codes) => !team || codes.some(code => team.includes(String(code || '').toUpperCase()));
  const hitterRow = (row, fields) => ({photo: row.id ? MLB_PHOTO(row.id) : null, logo: row.teamId ? MLB_LOGO(row.teamId) : null, name: row.name, ...fields});
  const named = (rows, name) => rows.find(row => nameKey(row.name) === nameKey(name)) || null;

  async function sheetAnswer(ask, players) {
    if (!allowed.includes('mlb') || !sheets) { suggestions = examples(); return 'The cheat sheets cover MLB, and MLB isn\'t on the board for you right now.'; }
    let data;
    try { data = await sheetData(ask.sheet); } catch { suggestions = examples(); return 'I can\'t reach today\'s cheat sheets right now. Give it a minute and ask again.'; }
    remember(ask);
    ctx = {...ctx, ask, sport: 'mlb'};
    const team = ask.team || null;
    if (ask.sheet === 'nrfi') return nrfiAnswer(data, team);
    if (ask.sheet === 'park') return parkAnswer(data, team, ask);
    if (ask.sheet === 'streaks') return streakAnswer(data, team, ask.streak);
    if (ask.sheet === 'bvp') return bvpAnswer(data, players, ask);
    if (ask.sheet === 'hot') return hotAnswer(data, team, players);
    return powerAnswer(data, team, players);
  }

  function nrfiAnswer(data, team) {
    const games = (data.rows || []).filter(row => onTeam(team, row.away?.team, row.home?.team));
    suggestions = ['Weather today', 'Best HR bats today', 'Who is on a hit streak?'];
    if (!games.length) return team ? 'That team isn\'t on today\'s MLB slate.' : 'There are no MLB games on today\'s slate.';
    const pctOf = row => Math.round(row.chance * 100);
    const arm = side => side.pitcher ? lastName(side.pitcher.name) : 'TBD';
    const lean = row => row.lean === 'nrfi' ? 'Lean NRFI' : row.lean === 'yrfi' ? 'Lean YRFI' : 'Toss-up';
    const card = {kind: 'board', title: team ? 'First inning' : 'NRFI / YRFI today', rows: games.slice(0, 6).map(row => ({
      logos: [row.away?.teamId ? MLB_LOGO(row.away.teamId) : null, row.home?.teamId ? MLB_LOGO(row.home.teamId) : null],
      name: `${row.away.team} @ ${row.home.team}`, sub: `${arm(row.away)} vs ${arm(row.home)} · fair NRFI ${priceOf(row.nrfi)}`,
      value: `${pctOf(row)}%`, label: lean(row), tone: row.lean === 'nrfi' ? 'up' : row.lean === 'yrfi' ? 'down' : null, meter: row.chance}))};
    if (team) {
      const row = games[0];
      const clean = side => side.pitcher && finite(side.pitcher.season) ? `${side.pitcher.name} has kept ${Math.round(side.pitcher.season * 100)}% of his first innings scoreless` : null;
      answer = {lead: `${row.away.team} @ ${row.home.team}: ${pctOf(row)}% chance of a scoreless first (${lean(row).toLowerCase()}).`, card};
      return tidy(`${row.away.team} @ ${row.home.team}: ${pctOf(row)}% chance of a scoreless first, so ${lean(row).toLowerCase()}. Fair NRFI ${priceOf(row.nrfi)}, YRFI ${priceOf(row.yrfi)}. ${sentence(join([clean(row.away), clean(row.home)].filter(Boolean)))}`);
    }
    const best = games[0], worst = games.at(-1);
    const said = `Best NRFI today: ${best.away.team} @ ${best.home.team} at ${pctOf(best)}% scoreless (fair ${priceOf(best.nrfi)}).`
      + (worst !== best && worst.lean === 'yrfi' ? ` Best YRFI: ${worst.away.team} @ ${worst.home.team}, ${100 - pctOf(worst)}% to see a run (fair ${priceOf(worst.yrfi)}).` : '');
    answer = {lead: said, card};
    return said;
  }

  function parkAnswer(data, team, ask) {
    let games = (data.rows || []).filter(row => onTeam(team, row.away, row.home));
    suggestions = ['NRFI today?', 'Best HR bats today', "What's the play today?"];
    if (!games.length) return team ? 'That team isn\'t on today\'s MLB slate.' : 'There are no MLB games on today\'s slate.';
    const weather = row => row.dome ? 'roof closed' : [finite(row.temp) && `${Math.round(row.temp)}°`, finite(row.wind) && `${Math.round(row.wind)} mph ${row.windEffect || ''}`.trim()].filter(Boolean).join(', ');
    const describe = row => `${row.venue} (${signedPct(row.runs)} runs${weather(row) ? `, ${weather(row)}` : ''})`;
    let said;
    if (team) said = `${games[0].away} @ ${games[0].home} is at ${describe(games[0])}: ${signedPct(games[0].hr)} for home runs against an average park.`;
    else if (ask.wind) {
      const out = games.filter(row => !row.dome && row.windEffect === 'out' && (row.wind || 0) >= 5), blowingIn = games.filter(row => !row.dome && row.windEffect === 'in' && (row.wind || 0) >= 5);
      games = [...out, ...blowingIn, ...games.filter(row => !out.includes(row) && !blowingIn.includes(row))];
      said = out.length || blowingIn.length ? `${out.length ? `Blowing out: ${join(out.map(row => `${row.venue} (${Math.round(row.wind)} mph)`))}.` : ''} ${blowingIn.length ? `Blowing in: ${join(blowingIn.map(row => `${row.venue} (${Math.round(row.wind)} mph)`))}.` : ''}`
        : 'No real wind today: nothing over 5 mph blowing in or out.';
    } else if (ask.rain) {
      const wet = games.filter(row => !row.dome && finite(row.precip) && row.precip >= 30);
      said = wet.length ? `Rain risk: ${join(wet.map(row => `${row.venue} (${Math.round(row.precip)}%)`))}.` : 'No rain worth worrying about on today\'s slate.';
    } else {
      const best = games[0], worst = games.at(-1);
      said = `Best hitting conditions: ${describe(best)}.${worst !== best ? ` Toughest: ${describe(worst)}.` : ''}`;
    }
    answer = {lead: tidy(said), card: {kind: 'board', title: 'Ballparks & weather', rows: games.slice(0, 6).map(row => ({
      logos: [row.homeId ? MLB_LOGO(row.homeId) : null], name: row.venue, sub: `${row.away} @ ${row.home}${weather(row) ? ` · ${weather(row)}` : ''}`,
      value: signedPct(row.runs), label: 'runs', tone: (row.runs || 0) >= 3 ? 'up' : (row.runs || 0) <= -3 ? 'down' : null}))}};
    return tidy(said);
  }

  function streakAnswer(data, team, kind) {
    const group = data.streaks?.[kind] || data.streaks?.hits || {label: 'hit', rows: []};
    const rows = (group.rows || []).filter(row => onTeam(team, row.team));
    suggestions = ['Who is on an on-base streak?', 'Best HR bats today', 'Who are the hottest hitters?'];
    const label = String(group.label || 'hit').toLowerCase();
    if (!rows.length) return `Nobody${team ? ' on that team' : ''} is on an active ${label} streak today.`;
    const top = rows[0].streak || 1;
    answer = {lead: `Longest active ${label} streaks: ${join(rows.slice(0, 3).map(row => `${lastName(row.name)} (${row.streak})`))}.`,
      card: {kind: 'board', title: `Active ${label} streaks`, rows: rows.slice(0, 6).map(row => hitterRow(row, {
        sub: `${row.team} ${row.home ? 'vs' : '@'} ${row.opponent}`, value: String(row.streak), label: 'games', meter: row.streak / top}))}};
    return `Longest active ${label} streaks today: ${join(rows.slice(0, 4).map(row => `${row.name} (${row.streak} straight)`))}.`;
  }

  function bvpAnswer(data, players, ask) {
    const rows = data.rows || [];
    suggestions = ['Best HR bats today', 'NRFI today?', "What's the play today?"];
    if (players.length) {
      const hitter = players.map(name => named(rows, name)).find(Boolean);
      if (!hitter) return `${players[0]} doesn't have 4 or more career plate appearances against today's starter, so there's no history worth reading.`;
      const pitcher = hitter.pitcher?.name || "today's starter";
      // The pitcher asked about, named or not on today's board ("judge vs cole").
      const word = (ask.text.match(/\b(?:vs\.?|versus|against|off|hit|hits)\s+([a-z][a-z'.-]+)/) || [])[1];
      const asked = players.find(name => nameKey(name) !== nameKey(hitter.name))
        || (word && !['the', 'him', 'his', 'today', 'tonight', 'lefties', 'righties'].includes(word) && nameKey(word) !== nameKey(lastName(hitter.name)) ? word[0].toUpperCase() + word.slice(1) : null);
      const other = asked && nameKey(lastName(asked)) !== nameKey(lastName(pitcher)) ? ` (He faces ${pitcher} today, not ${asked}.)` : '';
      const said = `${hitter.name} vs ${pitcher}: ${hitter.hits}-for-${hitter.ab} (${rate3(hitter.avg)}), ${hitter.hr} HR, ${hitter.so} K in ${hitter.pa} plate appearances. That's a ${hitter.sample} sample${hitter.sample === 'limited' ? ', so don\'t lean on it' : ''}.${other}`;
      answer = {lead: said, card: {kind: 'board', title: 'Career vs today\'s starter', rows: [hitterRow(hitter, {
        sub: `vs ${pitcher} · ${hitter.hits}-for-${hitter.ab}, ${hitter.hr} HR`, value: rate3(hitter.ops), label: 'OPS', tag: hitter.sample})]}};
      return said;
    }
    const best = rows.filter(row => row.sample !== 'limited').slice(0, 5);
    if (!best.length) return 'No hitter has a real sample against today\'s starter yet.';
    answer = {lead: `Best career matchups today: ${join(best.slice(0, 3).map(row => `${lastName(row.name)} vs ${lastName(row.pitcher?.name || '')} (${row.hits}-for-${row.ab})`))}.`,
      card: {kind: 'board', title: 'Career vs today\'s starter', rows: best.map(row => hitterRow(row, {
        sub: `vs ${row.pitcher?.name || 'starter'} · ${row.hits}-for-${row.ab}, ${row.hr} HR`, value: rate3(row.ops), label: 'OPS', tag: row.sample}))}};
    return answer.lead;
  }

  function hotAnswer(data, team, players) {
    let rows = (data.rows || []).filter(row => onTeam(team, row.team));
    if (players.length) rows = rows.filter(row => players.some(name => nameKey(name) === nameKey(row.name)));
    suggestions = ['Who is on a hit streak?', 'Best HR bats today', "What's the play today?"];
    if (!rows.length) return players.length ? `${players[0]} isn't running hot over the last ${data.days || 14} days.` : 'Nobody is running well above their season right now.';
    const line = row => `${row.name} (${rate3(row.ops)} OPS, ${signedOps(row.delta?.ops)} over his season, ${row.hr} HR)`;
    answer = {lead: `Hottest bats over the last ${data.days || 14} days: ${join(rows.slice(0, 3).map(row => lastName(row.name)))}.`,
      card: {kind: 'board', title: `Hot bats · last ${data.days || 14} days`, rows: rows.slice(0, 6).map(row => hitterRow(row, {
        sub: `${row.team} · ${row.hr} HR · ${signedOps(row.delta?.ops)} OPS vs season`, value: rate3(row.ops), label: 'OPS', tag: row.tag === 'hot' ? 'Hot' : 'Warm', tone: 'up'}))}};
    return `Hottest bats over the last ${data.days || 14} days: ${join(rows.slice(0, 3).map(line))}.`;
  }
  const signedOps = value => finite(value) ? `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(3).replace(/^0/, '')}` : '—';

  function powerAnswer(data, team, players) {
    let rows = (data.rows || []).filter(row => onTeam(team, row.team));
    suggestions = ['Best HR prop', 'Weather today', 'Who is on a HR streak?'];
    const facts = row => [finite(row.barrel) && `${row.barrel.toFixed(1)}% barrels`,
      finite(row.vsHand?.iso ?? row.iso) && `${rate3(row.vsHand?.iso ?? row.iso)} ISO${row.pitcher?.throws ? ` vs ${row.pitcher.throws}HP` : ''}`,
      finite(row.park) && Math.abs(row.park) >= 3 && `${signedPct(row.park)} HR park`, row.hot && 'hot lately'].filter(Boolean);
    if (players.length) {
      const found = players.map(name => named(data.rows || [], name)).find(Boolean);
      if (!found) return `${players[0]} isn't on today's home run sheet.`;
      const place = (data.rows || []).indexOf(found) + 1;
      answer = {lead: `${found.name}'s power score today: ${found.score} (#${place} of ${(data.rows || []).length}).`, card: {kind: 'board', title: 'Home run sheet', rows: [powerRow(found)]}};
      return `${found.name}'s power score today is ${found.score}, #${place} on the slate: ${join(facts(found))}.`;
    }
    if (!rows.length) return team ? 'That team isn\'t on today\'s MLB slate.' : 'There are no MLB games on today\'s slate.';
    const top = rows.slice(0, 5);
    answer = {lead: `Top home run bats today: ${join(top.slice(0, 3).map(row => `${lastName(row.name)} (${row.score})`))}.`,
      card: {kind: 'board', title: 'Home run sheet', rows: top.map(powerRow)}};
    return `Top home run bats today: ${join(top.slice(0, 3).map(row => `${row.name} (${row.score})`))}. ${lastName(top[0].name)}: ${join(facts(top[0]))}.`;
  }
  const powerRow = row => hitterRow(row, {sub: `${row.team} vs ${row.pitcher ? `${lastName(row.pitcher.name)} (${row.pitcher.throws || '?'}HP)` : row.opponent}${finite(row.barrel) ? ` · ${row.barrel.toFixed(1)}% brl` : ''}`,
    value: String(row.score ?? '—'), label: 'power', meter: finite(row.score) ? row.score / 100 : null, tag: row.hot ? 'Hot' : null, tone: (row.score || 0) >= 65 ? 'up' : null});

  /**
   * The player's other lines on the same stat today (Goblin, standard,
   * Demon), each read on the pick's side, lowest line first.
   */
  function ladderFor(leg) {
    const stat = statOfRow(leg.row);
    const rows = (boards[leg.row.sport || 'mlb']?.rows || []).filter(item => item.player === leg.player
      && (stat ? statMatches(stat, item) : nameKey(item.market) === nameKey(leg.row.market)));
    if (rows.length < 2) return [];
    return rows.map(item => {
      const read = item.id === leg.row.id ? leg : readSide(item, leg.side);
      const recent = read?.records?.l10 || read?.records?.l5 || null;
      return {line: item.line, modifier: String(item.modifier || 'standard').toLowerCase(), current: item.id === leg.row.id,
        chance: finite(read?.chance) ? read.chance : null, recent: recent ? {won: recent.won, games: recent.games} : null};
    }).sort((a, b) => a.line - b.line);
  }
  const fullCard = leg => pickCard(leg, {ladder: ladderFor(leg)});

  /** A yes/no on one side of one line, whether or not it's a pick we'd make. */
  async function verdict(row, side, ask) {
    const sides = side ? [side, side === 'OVER' ? 'UNDER' : 'OVER'] : ['OVER', 'UNDER'];
    const reads = await Promise.all(sides.map(item => withNews(readSide(row, item))));
    if (!reads[0] && !reads[1]) return `I don't have enough history on ${row.player} to call that one (or it starts too soon).`;
    let [chosen, other] = reads;
    if (!side && other && (!chosen || other.chance > chosen.chance)) [chosen, other] = [other, chosen];
    if (!chosen) return `${row.player}'s ${figure(row.line)} ${statShort({row})} only takes the over on that kind of line, and I don't have a read on it.`;
    ctx = {...ctx, ask, ranked: [chosen], index: 0, sport: row.sport, player: row.player, leg: chosen};
    const lineNote = ask.line != null && Math.abs(ask.line - row.line) > 0.01 ? ` (Today's line is ${figure(row.line)}, not ${figure(ask.line)}.)` : '';
    const facts = evidence(chosen).slice(0, 2);
    let call;
    if (chosen.redFlag) call = `Red flag. ${redFlagWords(chosen)}`;
    else if (chosen.backed && chosen.matchup?.tone === 'neutral') call = 'Lean yes. The numbers are there, but the matchup is only neutral.';
    else if (chosen.backed && chosen.tier === 'elite') call = pick(['Yes. I love it.', 'Yes, that\'s one of my favorite spots today.'], random);
    else if (chosen.backed) call = pick(['Yes, I like it.', 'I\'d take it.'], random);
    else if (chosen.chance >= 0.53) call = 'Lean yes, but it\'s thin.';
    else if (other?.backed) call = `I'd flip it. The ${sideWord(other)} is the better side at ${percent(other.chance)}.`;
    else call = `I'd pass. That's close to a coin flip.`;
    suggestions = ['Why?', side === 'UNDER' ? 'What about the over?' : 'What about the under?', `Best ${statOfRow(row)?.name || ''} prop today`.replace('  ', ' '), 'Next best'];
    const head = side || !other ? `${pickLine(chosen)}: ${percent(chosen.chance)} to hit${gradeWord(chosen) ? `, ${gradeWord(chosen)}` : ''}.`
      : `${pickLine(chosen)} is the better side at ${percent(chosen.chance)}.`;
    const moved = await moveNote(chosen);
    const tone = chosen.redFlag ? (other?.backed && !other.redFlag ? 'flip' : 'pass')
      : chosen.backed ? (chosen.matchup?.tone === 'neutral' ? 'lean' : 'yes') : chosen.chance >= 0.53 ? 'lean' : other?.backed ? 'flip' : 'pass';
    if (chosen.redFlag && tone === 'flip') call += ` The ${sideWord(other)} is the better side at ${percent(other.chance)}.`;
    const shown = tone === 'flip' ? other : chosen;
    const label = chosen.redFlag && tone === 'pass' ? 'Red flag' : {yes: 'Take it', lean: 'Lean', flip: 'Flip it', pass: 'Pass'}[tone];
    answer = {lead: tidy(`${call} ${tone === 'flip' ? '' : head}${lineNote}${moved}`),
      card: {kind: 'pick', pick: fullCard(shown), verdict: {tone, label}}};
    return tidy(`${call} ${head} ${sentence(join(facts))}${lineNote}${moved}`);
  }

  function contextual(ask, players) {
    // A follow-up borrows what it leaves unsaid from the last answer.
    const last = ctx?.ask;
    // "They", "both", "those two": everyone in the last answer.
    const plural = /\b(they|them|their|both|those (two|guys)|these (two|guys)|the two|each of them|both of them)\b/.test(ask.text);
    if (!players.length && plural && onScreen().length > 1 && !/\b(other team|opponent)\b/.test(ask.text)) {
      players = onScreen().slice(0, 3);
      ask.plural = true;
    }
    const pronoun = /\b(he|him|his|he's|hes|that guy|this guy|that one|this one|it|that pick|this pick)\b/.test(ask.text);
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
    if (before.intent === 'other-sport' || (before.explicitSport && !allowed.includes(before.sport))) return `I'm covering ${allowed.map(sport => SPORTS[sport].name).join(', ')} right now, more sports are coming soon.`;
    if (before.intent === 'recall') return recall();

    await boardsLoaded();
    if (allowed.every(sport => boards[sport]?.failed)) { suggestions = ["What's the play today?"]; return 'I can\'t reach today\'s lines right now. Give it a minute and ask again.'; }
    const rows = allRows(), legs = allLegs();
    const known = new Set(rows.flatMap(row => clean(row.player).split(' ')));
    const question = understand(text, {keepWords: known});
    const found = findPlayers(text, rows.map(row => row.player), {preferred: onScreen()});
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
    if (question.intent === 'why' && players.length && question.index == null) {
      const shown = (ctx?.ranked || []).findIndex(leg => leg?.player === players[0]);
      if (shown >= 0) return why(shown);
    }
    if (question.intent === 'why' && players.length && ctx?.player !== players[0] && question.index == null) {
      const ranked = rank(legs, {...question, intent: 'best', players: [players[0]]});
      remember(question, ranked);
      if (!ranked.length) return `${players[0]} is on the board today, but none of his lines has a clear edge in our numbers. I'd pass on him.${listLines(players[0])}`;
      ctx = {...ctx, ask: {...question, intent: 'best'}, ranked, index: 0, sport: ranked[0].row.sport, player: players[0], leg: ranked[0]};
      return why(0);
    }
    if (question.intent === 'why') return why(question.index);
    // Career numbers against a team (not a pitcher) are the hitter's history vs that team.
    if (question.intent === 'sheet' && question.sheet === 'bvp' && question.team && players.length < 2 && !/\b(bvp|career)\b/.test(question.text)) question.intent = 'detail';
    if (question.intent === 'sheet') return sheetAnswer(question, players);
    if (question.intent === 'matchup' && players.length) question.intent = 'detail';
    if (question.intent === 'innings') return innings(question, players);
    if (question.intent === 'detail') return detail(question, players);
    if (question.intent === 'form') return form(question, players);
    if (question.intent === 'rankings') return rankings(question);
    if (question.intent === 'usage') return usage(question, players);
    if (question.intent === 'projection') return projection(question, players);
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
      return `${label} ${ranked.slice(0, question.count).map((leg, index) => `${index + 1}) ${pickLine(leg)}, ${gradeWord(leg)}, ${percent(leg.chance)}`).join('; ')}. Ask "why #1" for the breakdown.`;
    }
    return answerPick(question, ranked);
  }

  // ---------------------------------------------------------------- the analyst
  // Questions about one player or team -- how deep a starter goes, his
  // matchup, whose bats are hot, where lineups rank, playing time, the
  // projection -- answered from the same rows and MLB context the picks use.

  const isPitching = row => String(row?.marketKey || '').startsWith('pitching:');
  const standard = row => String(row.modifier || 'standard').toLowerCase() === 'standard';
  const onScreen = () => [...new Set((ctx?.ranked || []).filter(Boolean).map(leg => leg.player))];

  /** The line to talk about for a player: the one on screen, his best graded one, else his first. */
  function lineOf(player, stat = null) {
    const fits = leg => leg?.player === player && (!stat || statMatches(stat, leg.row));
    if (fits(ctx?.leg)) return ctx.leg;
    const shown = (ctx?.ranked || []).find(fits);
    if (shown) return shown;
    const graded = rank(allLegs(), {intent: 'best', players: [player], stat});
    if (graded[0]) return graded[0];
    const rows = allRows().filter(row => row.player === player && (!stat || statMatches(stat, row)));
    const row = rows.find(standard) || rows[0];
    if (!row) return null;
    return readSide(row, 'OVER') || readSide(row, 'UNDER')
      || {row, player, side: 'OVER', modifier: 'standard', records: {}, read: null, chance: null, grade: null, backed: false};
  }

  /** Today's MLB teams from the board: each lineup, its starter, who it plays. */
  function mlbTeams() {
    const teams = new Map();
    let league = null;
    const team = (id, abbr) => {
      if (id == null) return null;
      const key = String(id);
      if (!teams.has(key)) teams.set(key, {id: key, abbr: null, logo: MLB_LOGO(key), lineup: null, starter: null, opponent: null});
      const entry = teams.get(key);
      entry.abbr ||= abbr || null;
      return entry;
    };
    for (const row of boards.mlb?.rows || []) {
      const matchup = row.matchup;
      if (!matchup) continue;
      league ||= matchup.league || null;
      const own = team(row.teamId, row.teamAbbr), them = team(row.opponentTeamId, row.opponent);
      if (own && them) { own.opponent = them.id; them.opponent = own.id; }
      if (matchup.kind === 'lineup') {
        if (them && matchup.lineup) them.lineup = matchup.lineup;
        if (own && matchup.self) own.starter = {...matchup.self, headshot: row.headshot || null};
      } else {
        if (own && matchup.lineup) own.lineup = matchup.lineup;
        if (them && matchup.pitcher) them.starter ||= matchup.pitcher;
      }
    }
    return {teams, league, of: league?.teams || 30};
  }
  const teamName = team => team?.lineup?.name || team?.abbr || 'them';
  const nick = team => team?.lineup?.name ? team.lineup.name.split(' ').at(-1) : team?.abbr || 'them';
  const ops = value => finite(value) ? value.toFixed(3).replace(/^0/, '') : '—';
  const handWord = hand => hand === 'L' ? 'lefties' : hand === 'R' ? 'righties' : 'that hand';
  const place = (rank, of) => finite(rank) ? `${ordinal(rank)} of ${of}` : null;
  const toneOf = (rank, of, high) => !finite(rank) ? null : rank <= of / 3 ? (high ? 'good' : 'bad') : rank > of * 2 / 3 ? (high ? 'bad' : 'good') : null;

  async function innings(question, players) {
    const named = players.length ? players : onScreen();
    const pitchers = named.filter(name => allRows().some(row => row.player === name && row.sport === 'mlb' && isPitching(row)));
    if (!pitchers.length) {
      suggestions = ['Best K prop today', 'Best matchup today'];
      return named.length ? `${join(named.map(lastName))} ${named.length > 1 ? "aren't" : "isn't"} pitching today, so there are no innings to project.`
        : 'Which pitcher? Ask like "how deep will Skubal go?"';
    }
    const entries = pitchers.slice(0, 3).map(name => {
      const rows = allRows().filter(row => row.player === name && isPitching(row));
      const row = rows.find(item => item.matchup?.self) || rows[0];
      const self = row.matchup?.self || null;
      const outs = rows.find(item => item.marketKey === 'pitching:outs' && standard(item));
      const fromLog = outs ? mean((outs.gameLog || []).map(game => game.value).filter(finite).slice(-5)) : null;
      const projected = finite(self?.projectedIp) ? self.projectedIp : finite(fromLog) ? Math.round(fromLog / 3 * 10) / 10 : null;
      return {player: name, headshot: row.headshot || null, teamLogo: row.teamLogo || null, team: row.teamAbbr || null, opponent: row.opponent || null,
        opponentLogo: opponentLogo(row), home: typeof row.isHome === 'boolean' ? row.isHome : null, time: timeOf(row.startsAt), hand: self?.hand || null,
        projected, recent: self?.recentIp ?? null, season: finite(self?.ip) && self?.starts ? Math.round(self.ip / self.starts * 10) / 10 : null,
        pitches: finite(self?.recentPitches) ? Math.round(self.recentPitches) : null, outsLine: outs?.line ?? null,
        starts: (self?.lastStarts || []).map(start => ({ip: start.ip, k: start.k, pitches: start.pitches, label: shortDate(start.date)}))};
    });
    remember(question, []);
    ctx = {...ctx, ask: question, sport: 'mlb', player: pitchers.length === 1 ? pitchers[0] : ctx?.player};
    const said = entries.map(entry => {
      if (!finite(entry.projected)) return `I don't have ${lastName(entry.player)}'s recent starts yet.`;
      const parts = [`${lastName(entry.player)} projects for about ${figure(entry.projected)} innings (${Math.round(entry.projected * 3)} outs)`];
      const behind = [finite(entry.recent) && `${figure(Math.round(entry.recent * 10) / 10)} a start over his last ${entry.starts.length || 5}`,
        finite(entry.season) && `${figure(entry.season)} on the season`, finite(entry.pitches) && `${entry.pitches} pitches a start lately`].filter(Boolean);
      let line = `${parts[0]}${behind.length ? `: ${join(behind)}` : ''}.`;
      if (finite(entry.outsLine)) line += ` His outs line is ${figure(entry.outsLine)}, so that leans ${entry.projected * 3 > entry.outsLine ? 'over' : 'under'}.`;
      return line;
    });
    answer = {lead: said.join(' '), card: {kind: 'innings', pitchers: entries}};
    suggestions = [`How does ${lastName(pitchers[0])} match up?`, `Are the ${entries[0].opponent || 'other'} bats hot?`, 'Best K prop today'];
    return said.join(' ');
  }

  function detail(question, players) {
    const name = players[0] || ctx?.player;
    if (!name) { suggestions = ['Best matchup today']; return 'Whose matchup? Ask like "how does Skubal match up?"'; }
    const leg = lineOf(name, question.stat);
    if (!leg) return `${name} isn't on today's board.`;
    const row = leg.row;
    const read = matchupRead(row);
    remember(question, [leg]);
    ctx = {...ctx, ask: question, sport: row.sport, player: name, leg: ctx?.ranked?.includes(leg) ? leg : ctx?.leg};
    const records = leg.records || {};
    const h2h = records.h2h && records.h2h.games >= 1 ? records.h2h : null;
    const face = {player: name, headshot: row.headshot || null, teamLogo: row.teamLogo || null, team: row.teamAbbr || null,
      opponent: row.opponent || null, opponentLogo: opponentLogo(row), home: typeof row.isHome === 'boolean' ? row.isHome : null, time: timeOf(row.startsAt)};
    if (row.sport !== 'mlb' || !read?.detail) {
      // Other leagues: the defense read and his record against them.
      const said = [read?.text ? sentence(read.text) : `I don't have a matchup read for ${lastName(name)} today.`,
        h2h && row.opponent ? `He's ${sideWord(leg)} ${h2h.won} of ${h2h.games} against ${row.opponent}.` : ''].join(' ').trim();
      answer = {lead: said, card: {kind: 'pick', pick: fullCard(leg)}};
      suggestions = [`Why ${lastName(name)}?`, `${lastName(name)}'s minutes`.replace(/'s minutes$/, row.sport === 'nhl' ? "'s ice time" : "'s minutes"), 'Best matchup today'];
      return said;
    }
    const {of} = mlbTeams();
    const info = read.detail, form = info.lineup;
    const metrics = [];
    let said;
    if (info.kind === 'pitcher') {
      const hand = info.self?.hand || form?.hand || null, split = form?.split, recent = form?.recent;
      const kRate = split?.kRate ?? row.matchup.lineup?.kRate, kRank = split?.kRateRank ?? row.matchup.lineup?.kRateRank;
      const fullOps = split?.ops ?? row.matchup.lineup?.ops, opsRank = split?.opsRank ?? row.matchup.lineup?.opsRank;
      const vs = split ? ` vs ${hand}HP` : '';
      if (finite(kRate)) metrics.push({key: 'k', label: `K rate${vs}`, value: percent(kRate), rank: kRank, of, tone: toneOf(kRank, of, true)});
      if (finite(fullOps)) metrics.push({key: 'ops', label: `OPS${vs}`, value: ops(fullOps), rank: opsRank, of, tone: toneOf(opsRank, of, false)});
      if (finite(recent?.ops)) metrics.push({key: 'recent', label: 'OPS, last 10 days', value: ops(recent.ops), rank: recent.opsRank, of, tone: toneOf(recent.opsRank, of, false), form: form.form});
      if (finite(recent?.runsPerGame)) metrics.push({key: 'runs', label: 'Runs a game, last 10 days', value: figure(Math.round(recent.runsPerGame * 10) / 10), rank: recent.runsPerGameRank, of, tone: toneOf(recent.runsPerGameRank, of, false)});
      const history = info.self?.vsOpponent || null;
      said = `${lastName(name)}${hand ? ` (${hand}HP)` : ''} gets ${row.opponent || 'a lineup'}`;
      if (finite(kRate)) said += `, who strike out ${percent(kRate)}${split ? ` against ${handWord(hand)}` : ''}${finite(kRank) ? ` (${ordinal(kRank)} of ${of})` : ''}`;
      said += '.';
      if (form?.form === 'hot' || form?.form === 'cold') said += ` They've been ${form.form} lately: ${ops(recent.ops)} OPS over the last 10 days${finite(recent.opsRank) ? ` (${ordinal(recent.opsRank)})` : ''}.`;
      if (history) said += ` He's faced them ${history.starts === 1 ? 'once' : history.starts === 2 ? 'twice' : `${history.starts} times`} this year: ${figure(Math.round(history.ip * 10) / 10)} innings, ${history.k} strikeout${history.k === 1 ? '' : 's'}, ${history.er} earned run${history.er === 1 ? '' : 's'}.`;
      const lift = matchupLift(leg);
      said += ` Overall it's a ${lift >= 0.03 ? 'good' : lift <= -0.03 ? 'tough' : 'neutral'} spot for his ${statShort(leg)} ${sideWord(leg)}.`;
      answer = {lead: said, card: {kind: 'matchup', role: 'pitcher', face, hand, versus: {abbr: row.opponent, logo: opponentLogo(row), name: row.matchup.lineup?.name || row.opponent},
        metrics, history, form: form?.form || null, projected: info.self?.projectedIp ?? null, pick: leg.chance != null ? pickCard(leg) : null}};
      suggestions = [`How deep will ${lastName(name)} go?`, `Why ${lastName(name)}?`, 'Hottest lineups today'];
    } else {
      const pitcher = info.pitcher, hand = pitcher?.hand || null, split = form?.split, recent = form?.recent;
      const starters = [...mlbTeams().teams.values()].map(team => team.starter).filter(item => finite(item?.whip));
      const whipRank = pitcher && finite(pitcher.whip) && starters.length > 3 ? starters.filter(item => item.whip > pitcher.whip).length + 1 : null;
      if (pitcher && finite(pitcher.era)) metrics.push({key: 'era', label: `${lastName(pitcher.name || 'Starter')}'s ERA`, value: pitcher.era.toFixed(2), tone: pitcher.era >= 4.5 ? 'good' : pitcher.era <= 3.3 ? 'bad' : null});
      if (pitcher && finite(pitcher.whip)) metrics.push({key: 'whip', label: 'WHIP', value: pitcher.whip.toFixed(2), rank: whipRank, of: starters.length || null,
        tone: pitcher.whip >= 1.35 ? 'good' : pitcher.whip <= 1.1 ? 'bad' : null, note: whipRank ? 'among today\'s starters, worst first' : null});
      if (pitcher && finite(pitcher.k9)) metrics.push({key: 'k9', label: 'K/9', value: pitcher.k9.toFixed(1), tone: pitcher.k9 <= 7.5 ? 'good' : pitcher.k9 >= 10 ? 'bad' : null});
      if (finite(split?.ops)) metrics.push({key: 'ops', label: `${row.teamAbbr || 'His team'} OPS vs ${hand}HP`, value: ops(split.ops), rank: split.opsRank, of, tone: toneOf(split.opsRank, of, true)});
      if (finite(recent?.ops)) metrics.push({key: 'recent', label: `${row.teamAbbr || 'Team'} OPS, last 10 days`, value: ops(recent.ops), rank: recent.opsRank, of, tone: toneOf(recent.opsRank, of, true), form: form.form});
      said = pitcher?.name ? `${lastName(name)} faces ${pitcher.name}${hand ? ` (${hand}HP)` : ''}${finite(pitcher.whip) ? `, ${pitcher.whip.toFixed(2)} WHIP` : ''}${finite(pitcher.era) ? `, ${pitcher.era.toFixed(2)} ERA` : ''}.`
        : `${lastName(name)}'s opponent hasn't named a starter yet.`;
      if (finite(split?.ops)) said += ` ${row.teamAbbr || 'His team'} hits ${ops(split.ops)} against ${handWord(hand)}${finite(split.opsRank) ? ` (${ordinal(split.opsRank)} of ${of})` : ''}.`;
      if (form?.form === 'hot' || form?.form === 'cold') said += ` The bats are ${form.form}: ${ops(recent.ops)} OPS over the last 10 days.`;
      if (h2h && row.opponent) said += ` He's ${sideWord(leg)} ${h2h.won} of ${h2h.games} against ${row.opponent}.`;
      answer = {lead: said, card: {kind: 'matchup', role: 'hitter', face, hand, versus: pitcher?.name ? {name: pitcher.name, headshot: pitcher.id ? MLB_PHOTO(pitcher.id) : null, abbr: row.opponent, logo: opponentLogo(row)} : {abbr: row.opponent, logo: opponentLogo(row), name: row.opponent},
        metrics, history: null, h2h: h2h ? {won: h2h.won, games: h2h.games, side: sideWord(leg), opponent: row.opponent} : null, form: form?.form || null, pick: leg.chance != null ? pickCard(leg) : null}};
      suggestions = [`Why ${lastName(name)}?`, `Are the ${row.teamAbbr || ''} bats hot?`.replace('  ', ' '), 'Best matchup today'];
    }
    return said;
  }

  function teamRows(list, metric) {
    return list.map(team => {
      const recent = team.lineup?.recent || {}, season = team.lineup || {};
      const value = metric === 'k' ? team.kRate : recent.ops;
      return {abbr: team.abbr, logo: team.logo, name: teamName(team), starter: team.vsStarter || null,
        value: metric === 'k' ? percent(value) : ops(value), share: metric === 'k' ? value : value,
        delta: metric === 'k' ? null : finite(recent.ops) && finite(season.ops) ? recent.ops - season.ops : null,
        note: [finite(recent.opsRank) && `${ordinal(recent.opsRank)} of ${team.of || 30}`, finite(recent.runsPerGame) && `${figure(Math.round(recent.runsPerGame * 10) / 10)} runs a game`].filter(Boolean).join(' · ') || null,
        form: metric === 'k' ? null : finite(recent.ops) && finite(team.leagueOps) ? (recent.ops / team.leagueOps >= 1.08 ? 'hot' : recent.ops / team.leagueOps <= 0.92 ? 'cold' : null) : null};
    });
  }

  function form(question, players) {
    const {teams, league, of} = mlbTeams();
    const leagueOps = league?.recent?.ops;
    const playing = [...teams.values()].filter(team => finite(team.lineup?.recent?.ops)).map(team => ({...team, leagueOps, of}));
    if (!playing.length) { suggestions = ['Best matchup today']; return 'I don\'t have the last 10 days of team hitting yet. Ask me again in a bit.'; }
    // Which team: named, a named player's (a pitcher's opponent), or the one on screen.
    let pickTeam = null;
    if (question.teamOptions.length) pickTeam = playing.find(team => question.teamOptions.some(option => option.sport === 'mlb' && option.codes.includes(String(team.abbr || '').toUpperCase())));
    const who = players[0] || (/\b(other team|opponent|they|their|them)\b/.test(question.text) ? ctx?.player : null);
    if (!pickTeam && who) {
      const row = allRows().find(item => item.player === who && item.sport === 'mlb');
      if (row) pickTeam = playing.find(team => team.id === String(isPitching(row) || /\b(other team|opponent)\b/.test(question.text) ? row.opponentTeamId : row.teamId));
    }
    remember(question, []);
    if (pickTeam) {
      const recent = pickTeam.lineup.recent, season = pickTeam.lineup;
      const ratio = leagueOps ? recent.ops / leagueOps : 1;
      const word = ratio >= 1.08 ? 'hot' : ratio <= 0.92 ? 'cold' : 'about average';
      const said = `The ${nick(pickTeam)} are ${word}: ${ops(recent.ops)} OPS over the last 10 days${finite(recent.opsRank) ? ` (${ordinal(recent.opsRank)} of ${of})` : ''}${finite(season.ops) ? `, ${recent.ops >= season.ops ? 'up' : 'down'} from ${ops(season.ops)} on the season` : ''}.${finite(recent.runsPerGame) ? ` ${figure(Math.round(recent.runsPerGame * 10) / 10)} runs a game in that stretch.` : ''}${finite(recent.kRate) ? ` They've struck out ${percent(recent.kRate)} of the time.` : ''}`;
      answer = {lead: said, card: {kind: 'teams', title: 'Last 10 days', metric: 'ops', rows: teamRows([pickTeam], 'ops'), focus: {season: ops(season.ops), recent: ops(recent.ops), runs: recent.runsPerGame, kRate: recent.kRate}}};
      suggestions = ['Hottest lineups today', 'Which lineups strike out the most?', 'Best matchup today'];
      return said;
    }
    const sorted = [...playing].sort((a, b) => b.lineup.recent.ops - a.lineup.recent.ops);
    const cold = /\b(cold|coldest|colder|slumping|struggling|ice cold)\b/.test(question.text);
    const list = (cold ? sorted.reverse() : sorted).slice(0, 5);
    const said = `${cold ? 'Coldest' : 'Hottest'} lineups playing today, by OPS over the last 10 days: ${join(list.slice(0, 3).map(team => `${team.abbr} (${ops(team.lineup.recent.ops)})`))}.`;
    answer = {lead: said, card: {kind: 'teams', title: `${cold ? 'Coldest' : 'Hottest'} bats · last 10 days`, metric: 'ops', rows: teamRows(list, 'ops')}};
    suggestions = [cold ? 'Hottest lineups today' : 'Coldest lineups today', 'Which lineups strike out the most?', 'Best K prop today'];
    return said;
  }

  function rankings(question) {
    const {teams, of} = mlbTeams();
    // Strikeouts against the hand of the starter each lineup faces today.
    const list = [...teams.values()].filter(team => team.lineup).map(team => {
      const facing = team.opponent ? teams.get(team.opponent)?.starter : null;
      const hand = facing?.hand || null, split = hand ? team.lineup.vs?.[hand] : null;
      return {...team, kRate: split?.kRate ?? team.lineup.kRate, kRank: split ? split.kRateRank : team.lineup.kRateRank, kHand: split ? hand : null,
        vsStarter: facing?.name || null, ops: split?.ops ?? team.lineup.ops};
    }).filter(team => finite(team.kRate));
    if (!list.length) { suggestions = ['Best matchup today']; return 'I don\'t have today\'s lineup numbers yet.'; }
    remember(question, []);
    const best = /\b(best|toughest)\b/.test(question.text) && !/strike|whiff|k%|k rate/.test(question.text);
    if (best || /\b(worst|weakest)\b/.test(question.text)) {
      const sorted = list.filter(team => finite(team.ops)).sort((a, b) => best ? b.ops - a.ops : a.ops - b.ops).slice(0, 5);
      const said = `${best ? 'Toughest' : 'Weakest'} lineups today, by OPS against the hand they face: ${join(sorted.slice(0, 3).map(team => `${team.abbr} (${ops(team.ops)})`))}.`;
      answer = {lead: said, card: {kind: 'teams', title: `${best ? 'Toughest' : 'Weakest'} lineups today`, metric: 'ops-hand',
        rows: sorted.map(team => ({abbr: team.abbr, logo: team.logo, name: teamName(team), value: ops(team.ops), share: team.ops, rank: null, note: team.kHand ? `vs ${team.kHand}HP${team.vsStarter ? ` · ${lastName(team.vsStarter)}` : ''}` : 'season'}))}};
      suggestions = ['Which lineups strike out the most?', 'Best matchup today', 'Hottest lineups today'];
      return said;
    }
    const sorted = list.sort((a, b) => b.kRate - a.kRate).slice(0, 6);
    const said = `Lineups that strike out the most today, against the hand they face: ${join(sorted.slice(0, 3).map(team => `${team.abbr} ${percent(team.kRate)}${team.vsStarter ? ` vs ${lastName(team.vsStarter)}` : ''}`))}. That's where I look for strikeout overs.`;
    answer = {lead: said, card: {kind: 'teams', title: 'Strikeout rate vs today\'s starter hand', metric: 'k', of,
      rows: sorted.map(team => ({abbr: team.abbr, logo: team.logo, name: teamName(team), value: percent(team.kRate), share: team.kRate,
        note: [team.kHand ? `vs ${team.kHand}HP` : 'season', team.vsStarter && lastName(team.vsStarter), finite(team.kRank) && `${ordinal(team.kRank)} of ${of}`].filter(Boolean).join(' · ')}))}};
    suggestions = ['Best K prop today', 'Hottest lineups today', 'Weakest lineups today'];
    return said;
  }

  function usage(question, players) {
    const name = players[0] || ctx?.player;
    if (!name) { suggestions = examples().slice(0, 3); return 'Whose playing time? Ask like "how many minutes is Tatum playing?"'; }
    const leg = lineOf(name, question.stat);
    const row = leg?.row;
    const log = (row?.gameLog || []).filter(game => finite(game.usage)).slice(-10);
    if (!log.length) return `I don't have ${lastName(name)}'s playing time logged.`;
    const label = row.sport === 'nhl' ? 'ice time' : row.sport === 'mlb' ? (isPitching(row) ? 'pitches' : 'plate appearances') : 'minutes';
    const values = log.map(game => game.usage), all = mean(values), last5 = mean(values.slice(-5));
    const show = value => row.sport === 'nhl' && value > 100 ? figure(Math.round(value / 60 * 10) / 10) : figure(Math.round(value * 10) / 10);
    const said = `${lastName(name)} is averaging ${show(all)} ${label} over his last ${values.length}${values.length > 5 ? ` and ${show(last5)} over his last 5` : ''}, ${last5 > all * 1.05 ? 'trending up' : last5 < all * 0.95 ? 'trending down' : 'holding steady'}.`;
    remember(question, [leg]);
    ctx = {...ctx, ask: question, sport: row.sport, player: name};
    answer = {lead: said, card: {kind: 'usage', face: {player: name, headshot: row.headshot || null, teamLogo: row.teamLogo || null, team: row.teamAbbr || null,
      opponent: row.opponent || null, opponentLogo: opponentLogo(row), home: typeof row.isHome === 'boolean' ? row.isHome : null, time: timeOf(row.startsAt)},
      label, average: show(all), recent: show(last5), values: log.map(game => ({value: Number(show(game.usage)), label: typeof game.opponent === 'string' ? game.opponent : shortDate(game.date)}))}};
    suggestions = [`Why ${lastName(name)}?`, `How does ${lastName(name)} match up?`, 'Next best'];
    return said;
  }

  async function projection(question, players) {
    const name = players[0] || ctx?.player;
    if (!name) { suggestions = examples().slice(0, 3); return 'Whose projection? Ask like "what\'s Skubal projected for?"'; }
    const leg = lineOf(name, question.stat);
    if (!leg) return `${name} isn't on today's board.`;
    const projected = leg.read?.projection;
    remember(question, [leg]);
    ctx = {...ctx, ask: {...question, intent: 'best'}, ranked: ctx?.ranked?.includes(leg) ? ctx.ranked : [leg], index: 0, sport: leg.row.sport, player: name, leg};
    suggestions = [`Why ${lastName(name)}?`, leg.side === 'OVER' ? 'What about the under?' : 'What about the over?', `How does ${lastName(name)} match up?`];
    if (!finite(projected)) {
      answer = {lead: `I don't have enough games to project ${lastName(name)}'s ${statShort(leg)}, but here's how his line looks.`, card: {kind: 'pick', pick: fullCard(leg)}};
      return answer.lead;
    }
    const said = `${lastName(name)} projects for ${figure(Math.round(projected * 10) / 10)} ${statShort(leg)} against the ${figure(leg.row.line)} line${finite(leg.chance) ? `, ${percent(leg.chance)} to go ${sideWord(leg)}` : ''}.`;
    answer = {lead: said, card: {kind: 'pick', pick: fullCard(leg)}};
    return said;
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
        answer = {lead: `Welcome back! You were asking about ${lastName(player)} before, and he's got a good spot today. What else are we looking at?`, card: {kind: 'pick', pick: fullCard(leg)}};
        return `Welcome back! You were asking about ${lastName(player)} before, and he's got a good spot today: ${pickLine(leg)} (${gradeWord(leg)}, ${percent(leg.chance)}). What else are we looking at?`;
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
    answer = {lead: leg.redFlag ? `Careful with ${pickLine(leg)}. ${sentence(leg.redFlag)}` : `Here's why I like ${pickLine(leg)}.`,
      card: {kind: 'pick', pick: fullCard(leg), reasons: facts.filter(fact => fact !== drawn).slice(0, 5).map(sentence)}};
    const against = leg.redFlag ? ` Red flag: ${lower(leg.redFlag)}${leg.flagWhy ? ` (${lower(leg.flagWhy)})` : ''}.${risks.length ? ` Also: ${join(risks.map(lower))}.` : ''}`
      : risks.length ? ` Risks: ${join(risks.map(lower))}.` : ' Nothing major argues against it.';
    return `Why ${pickLine(leg)}: ${join(facts.slice(0, 5))}.${against} ${sentence(gradeWord(leg)).replace(/\.$/, ',')} ${percent(leg.chance)} to hit.`;
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
      return lines.flatMap(row => ['OVER', 'UNDER'].map(side => readSide(row, side))).filter(Boolean)
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
    return `I'd go ${lastName(win.player)}. ${pickLine(win)} is ${percent(win.chance)} to hit (${gradeWord(win)})${versus}. ${sentence(join(facts))}`.replace(/\s+/g, ' ').trim();
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
    const matchup = rank(legs, {intent: 'matchup', sport}).find(leg => leg !== topPlay && leg.matchup?.tone === 'good');
    const sleeper = rank(legs, {intent: 'value', sport})[0];
    remember({...question, sport}, topPlay ? [topPlay] : []);
    const parts = [`Today's ${SPORTS[sport].name} slate: ${games} ${SPORTS[sport].game}${first ? `, ${SPORTS[sport].start} at ${timeOf(first)}` : ''}.`];
    if (topPlay) parts.push(`Top play: ${pickLine(topPlay)} (${gradeWord(topPlay)}, ${percent(topPlay.chance)}).`);
    if (matchup) parts.push(`Best matchup: ${pickLine(matchup)}, ${lower(matchup.matchup?.text || matchupOf(matchup)?.text || '')}.`.replace(', .', '.'));
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

  /**
   * A slip built from today's Elite and Strong picks, best first. A pick
   * that works against one already on it (a pitcher's strikeouts and a
   * hitter he faces) is left out, no more than two come from one game, and
   * the whole slip is graded the Slip Analyzer's way (slip-check.js
   * scoreEntry: the linked chance, the payout, the letter).
   */
  async function slip(question) {
    const good = leg => leg.tier === 'elite' || leg.tier === 'strong';
    const asPick = leg => ({row: leg.row, side: leg.side, player: leg.player});
    // A payout asked for (or Goblins and Demons on it): the picks are chosen
    // together, for the best chance at about that payout.
    if (question.payout || question.modifier) return aimed(question, good, asPick);
    let pool, order = null;
    if (question.style === 'value') {
      // Any line, Goblins and Demons included, by how far its chance clears
      // what the line needs (a Demon pays more, so it needs less).
      const seen = new Set(), edge = leg => leg.chance / baselineOf(leg);
      order = (a, b) => edge(b) - edge(a);
      pool = ['standard', 'goblin', 'demon'].flatMap(modifier => rank(allLegs(), {...question, intent: 'best', modifier})).filter(good)
        .sort(order).filter(leg => !seen.has(leg.player) && seen.add(leg.player));
    } else {
      pool = rank(allLegs(), {...question, intent: question.style === 'safe' ? 'safest' : 'best'}).filter(good);
      if (question.style === 'safe') order = (a, b) => b.chance - a.chance;
    }
    // The best of them with their game news (who's out, who starts, a
    // teammate's absence), judged again as the Slip Analyzer will judge them.
    pool = (await withNewsAll(pool.slice(0, 18))).filter(good);
    if (order) pool.sort(order);
    const chosen = [], perGame = new Map();
    let avoided = null;
    for (const leg of pool) {
      const against = chosen.map(other => link(asPick(other), asPick(leg))).find(found => found && found.rho <= -0.03);
      if (against) { avoided ||= {leg, text: against.text}; continue; }
      if ((perGame.get(leg.game) || 0) >= 2) continue;
      chosen.push(leg);
      perGame.set(leg.game, (perGame.get(leg.game) || 0) + 1);
      if (chosen.length === question.count) break;
    }
    remember(question, chosen);
    const league = question.sport ? `${SPORTS[question.sport].name} ` : '';
    if (!chosen.length) return `I don't see any Elite or Strong ${league}picks right now, so I'd hold off on a slip. Check back closer to game time.`;
    if (chosen.length < question.count) {
      return `I only see ${chosen.length} Elite or Strong ${league}pick${chosen.length === 1 ? '' : 's'} that don't work against each other right now, not enough for a ${question.count}-pick slip. Try a smaller one.`;
    }
    return writeSlip(question, chosen, {avoided});
  }

  // What a Goblin or Demon pays next to a regular line (smart-slip.js
  // assessLeg works it out from the books; a usual one when it can't).
  const payFactor = leg => (finite(leg.factor) && leg.factor > 0 ? leg.factor : leg.modifier === 'goblin' ? 0.7 : leg.modifier === 'demon' ? 1.5 : 1);
  const basePay = (play, count) => (play === 'flex' ? FLEX[count]?.[count] : POWER[count]) || null;

  /**
   * A slip built to a payout ("a 2-man 2x": a Goblin with a regular line) or
   * with Goblins or Demons asked for: every way of putting the best Elite and
   * Strong lines together (no two from one player, none working against each
   * other, no more than two from a game) is weighed, and the likeliest one
   * paying about what was asked wins (not much under it, not far over: from
   * 92% to 130% of it; else the closest).
   */
  async function aimed(question, good, asPick) {
    const want = question.payout;
    const kinds = question.only ? [question.modifier] : ['standard', 'goblin', 'demon'];
    // How many picks: as asked, else the count whose regular payout is nearest.
    let count = question.count;
    if (want && !question.counted) {
      count = [2, 3, 4, 5, 6].filter(n => basePay(question.play, n)).sort((a, b) => Math.abs(Math.log(basePay(question.play, a) / want)) - Math.abs(Math.log(basePay(question.play, b) / want)))[0];
    }
    const base = basePay(question.play, count);
    const ranked = kinds.flatMap(modifier => rank(allLegs(), {...question, intent: 'best', modifier}).filter(good)
      .sort((a, b) => b.chance - a.chance).slice(0, modifier === 'standard' ? 8 : 6));
    // With their game news, judged again (as in slip()).
    const pool = (await withNewsAll(ranked)).filter(good).slice(0, 16);
    const clash = pool.map(a => pool.map(b => a === b || a.player === b.player || Boolean((link(asPick(a), asPick(b))?.rho ?? 0) <= -0.03)));
    const fit = pays => (want ? Math.abs(Math.log(pays / want)) : 0);
    let best = null;
    const pick = (start, chosen) => {
      if (chosen.length === count) {
        const legs = chosen.map(index => pool[index]);
        if (question.modifier && !legs.some(leg => leg.modifier === question.modifier)) return;
        const games = new Map();
        for (const leg of legs) { games.set(leg.game, (games.get(leg.game) || 0) + 1); if (games.get(leg.game) > 2) return; }
        const pays = base * legs.reduce((product, leg) => product * payFactor(leg), 1);
        const chance = legs.reduce((product, leg) => product * leg.chance, 1);
        // Close enough to the payout: the likeliest. Otherwise: the closest. No payout asked: the most back per $1.
        const near = Boolean(want) && pays >= want * 0.92 && pays <= want * 1.3;
        const better = !best ? true : want ? (near !== best.near ? near : near ? chance > best.chance : fit(pays) < fit(best.pays) - 1e-9 || (Math.abs(fit(pays) - fit(best.pays)) < 1e-9 && chance > best.chance))
          : chance * pays > best.chance * best.pays;
        if (better) best = {legs, pays, chance, near};
        return;
      }
      for (let index = start; index < pool.length; index++) {
        if (chosen.some(other => clash[other][index])) continue;
        pick(index + 1, [...chosen, index]);
      }
    };
    pick(0, []);
    const chosen = best?.legs || [];
    remember(question, chosen);
    const league = question.sport ? `${SPORTS[question.sport].name} ` : '';
    const what = question.only ? `${question.modifier} ` : '';
    if (chosen.length < count) {
      return `I don't see ${count} Elite or Strong ${league}${what}picks that work together right now${question.modifier && !question.only ? ` with a ${question.modifier} on it` : ''}. Try a smaller slip or check back closer to game time.`;
    }
    return writeSlip({...question, count}, chosen, {aimed: want ? {want, near: best.near, pays: best.pays} : null});
  }

  // A built slip, graded the Slip Analyzer's way (slip-check.js scoreEntry)
  // and written up: its picks, its grade, what it pays and why.
  function writeSlip(question, chosen, {avoided = null, aimed: target = null} = {}) {
    const league = question.sport ? `${SPORTS[question.sport].name} ` : '';
    const flex = question.play === 'flex';
    const score = scoreEntry(chosen.map((leg, index) => ({key: String(index), player: leg.player, side: leg.side, row: leg.row, line: leg.row.line,
      grade: {...leg, factor: payFactor(leg)}})), {app: {key: 'prizepicks'}, entry: {type: flex ? 'flex' : 'power'}});
    // A slip across leagues leaves the next question open to all of them.
    const sports = new Set(chosen.map(leg => leg.row.sport));
    ctx = {...ctx, ask: question, ranked: chosen, index: 0, sport: question.sport || (sports.size === 1 ? chosen[0].row.sport : null), player: chosen[0].player, leg: chosen[0]};
    // What it pays: a Power (or Flex) Play, scaled for any Goblin or Demon on it.
    const payout = score?.multiplier ? Number(score.multiplier.toFixed(2)) : basePay(question.play, chosen.length);
    const scaled = chosen.some(leg => leg.modifier && leg.modifier !== 'standard');
    const play = flex ? 'Flex Play' : 'Power Play';
    const together = score?.links?.filter(pair => pair.tone === 'together') || [];
    const notes = [
      together[0] && `${sentence(together[0].text)} That helps the slip.`,
      avoided && `I left out ${pickLine(avoided.leg)}: ${avoided.text}.`,
      target && !target.near && `That's as close to ${target.want}x as my Elite and Strong picks get today.`,
      scaled && 'Goblin and Demon payouts vary by line, so check the exact number on the app.',
    ].filter(Boolean).join(' ');
    const mix = Object.entries(score?.tiers || {}).filter(([, count]) => count).map(([key, count]) => `${count} ${TIERS[key].label}`).join(', ');
    const kind = `${{safe: 'safe ', value: 'value '}[question.style] || ''}${chosen.length}-pick ${league}${flex ? 'Flex ' : ''}slip${target ? ` that pays about ${payout}x` : ''}`;
    const how = target ? '' : {safe: ', the likeliest of them', value: ', the most payout for their chance'}[question.style] || '';
    answer = {lead: tidy(`Here's a ${kind} from my Elite and Strong picks${how} (${mix}). Parlay grade ${score?.letter || '–'}. ${notes}`),
      card: {kind: 'slip', picks: chosen.map(pickCard), together: score?.chance ?? chosen.reduce((product, leg) => product * leg.chance, 1),
        payout: payout || null, letter: score?.letter || null, value: score?.value ?? null,
        links: (score?.links || []).map(pair => ({text: pair.text, tone: pair.tone}))}};
    suggestions = [...new Set([`Why ${lastName(chosen[0].player)}?`, question.count < 6 ? `Make it ${question.count + 1} picks` : `Make it ${question.count - 1} picks`,
      question.style === 'safe' ? 'Build me a value slip' : 'Build me a safe slip'])];
    return tidy(`Here's a ${kind} from my Elite and Strong picks${how}: ${chosen.map(leg => `${pickLine(leg)} (${gradeWord(leg)})`).join('; ')}. `
      + `Parlay grade ${score?.letter || '–'}: all ${chosen.length} hit about ${percent(score?.chance ?? 0)} of the time${payout ? `, ${scaled ? 'about ' : ''}a ${payout}x ${play}` : ''}. ${notes}`);
  }

  /**
   * The bot's home screen: today's top plays, the safest one, the best
   * matchup and what's on the board, from the same graded picks it answers from.
   */
  async function today({count = 4} = {}) {
    await boardsLoaded();
    const legs = allLegs(), rows = allRows();
    const ask = intent => rank(legs, {intent});
    const shown = leg => leg && {...pickCard(leg), question: `Should I take ${leg.player} ${sideWord(leg)} ${figure(leg.row.line)} ${statShort(leg)}?`};
    const games = new Set(rows.map(row => `${row.sport}:${[row.teamAbbr, row.opponent].map(team => String(team || '')).sort().join('-')}:${String(row.startsAt || '').slice(0, 10)}`));
    const starts = rows.map(row => Date.parse(row.startsAt || '')).filter(at => finite(at) && at > now()).sort((a, b) => a - b);
    const leagues = allowed.map(sport => ({sport, name: SPORTS[sport].name, props: (boards[sport]?.rows || []).length})).filter(item => item.props);
    // The candidates with their game news, judged again: one ruled out, or
    // capped by a role change, gives way to the next.
    const best = ask('best').slice(0, count + 4), safe = ask('safest').slice(0, 4), matched = ask('matchup').slice(0, 4);
    const candidates = [...new Set([...best, ...safe, ...matched])];
    const checked = new Map((await withNewsAll(candidates)).map((leg, index) => [candidates[index], leg]));
    const after = list => list.map(leg => checked.get(leg) || leg).filter(passesMatchup);
    const top = after(best).slice(0, count);
    const safest = after(safe).sort((a, b) => b.chance - a.chance)[0];
    const matchup = after(matched).find(leg => leg.matchup?.score != null);
    return {props: rows.length, games: games.size, leagues, next: starts.length ? timeOf(starts[0]) : null,
      top: top.map(shown), safest: shown(safest), matchup: shown(matchup), mlb: leagues.some(item => item.sport === 'mlb')};
  }

  return {ask, board: boardsLoaded, today, thinking, examples, suggestions: () => suggestions, card: () => answer, profile: () => me, returning: () => Boolean(returning)};
}

const HELP = allowed => `I break down today's ${allowed.map(sport => SPORTS[sport].name).join(', ')} props using our models: record vs the line, projections, matchups and the books. Ask "what's the play today?", "best K prop", "should I take Skubal over 6.5 Ks?", "compare Judge and Soto", "top 3 total bases" or "build me a 3-pick slip". Follow up with "why?", "next" or "what about the under?". I remember what you ask about.`;
