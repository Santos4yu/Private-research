// Which rows on a player page's Matchup and Defense tabs decide the line
// being researched: its own stat (`key`) and the ones that feed it
// (`related`). The tables light those rows up and lead with them, so one
// look shows where to read; they follow the line as it changes.
import {MARKET_STAT} from './sports/wnba/wnba-research.js';
import {statKeyOf} from './sports/soccer/soccer-stats.js';

// ---------------------------------------------------------------- football

// A line's stat, as the defense and team tables name it. College lines
// carry the NFL's market names (cfb_board.py valueKey).
const FOOTBALL_LINE = {
  passing_yards: 'passing_yards', passing_touchdowns: 'passing_tds', passing_tds: 'passing_tds', passing_attempts: 'attempts',
  pass_attempts: 'attempts', pass_completions: 'completions', completions: 'completions', interceptions: 'interceptions',
  rushing_yards: 'rushing_yards', rush_attempts: 'carries', carries: 'carries', rushing_tds: 'rushing_tds', rushing_touchdowns: 'rushing_tds',
  receptions: 'receptions', receiving_yards: 'receiving_yards', targets: 'targets', receiving_tds: 'receiving_tds',
  receiving_touchdowns: 'receiving_tds', rushing_receiving_yards: 'rush_rec_yards', rush_rec_yards: 'rush_rec_yards',
  passing_rushing_yards: 'pass_rush_yards', pass_rush_yards: 'pass_rush_yards', touchdowns: 'rush_rec_tds', rush_rec_tds: 'rush_rec_tds',
  longest_reception: 'longest_reception', longest_rush: 'longest_rush', longest_completion: 'longest_completion',
  fantasy_score: 'fantasy', fantasy: 'fantasy', fg_made: 'fg_made', pat_made: 'pat_made', kicking_points: 'kicking_points',
  // A tackles line counts every tackle he's in on.
  tackles: 'tackles_assists', tackles_assists: 'tackles_assists', solo_tackles: 'tackles', assists: 'assists', sacks: 'sacks',
  def_interceptions: 'interceptions_def',
};
// A table's row, as above: the college tables keep the market names.
const FOOTBALL_ROW = {
  passing_touchdowns: 'passing_tds', pass_completions: 'completions', passing_attempts: 'attempts', rush_attempts: 'carries',
  rushing_receiving_yards: 'rush_rec_yards', passing_rushing_yards: 'pass_rush_yards', touchdowns: 'rush_rec_tds', fantasy_score: 'fantasy',
};
const FOOTBALL_RELATED = {
  passing_yards: ['attempts', 'completions', 'completion_pct', 'pass_rush_yards', 'longest_completion'],
  passing_tds: ['passing_yards', 'points'],
  attempts: ['completions', 'passing_yards'],
  completions: ['attempts', 'completion_pct', 'passing_yards'],
  interceptions: ['attempts', 'sacks'],
  rushing_yards: ['carries', 'rush_rec_yards', 'longest_rush', 'pass_rush_yards'],
  carries: ['rushing_yards'],
  rushing_tds: ['rush_rec_tds', 'rushing_yards', 'points'],
  receptions: ['targets', 'receiving_yards'],
  receiving_yards: ['receptions', 'targets', 'longest_reception', 'rush_rec_yards'],
  targets: ['receptions', 'receiving_yards'],
  receiving_tds: ['rush_rec_tds', 'redzone_targets', 'receiving_yards'],
  rush_rec_yards: ['rushing_yards', 'receiving_yards', 'carries', 'receptions'],
  pass_rush_yards: ['passing_yards', 'rushing_yards'],
  rush_rec_tds: ['rushing_tds', 'receiving_tds', 'redzone_targets', 'points'],
  longest_reception: ['receiving_yards', 'receptions'],
  longest_rush: ['rushing_yards', 'carries'],
  longest_completion: ['passing_yards'],
  fantasy: ['passing_yards', 'rushing_yards', 'receiving_yards', 'receptions'],
  fg_made: ['kicking_points', 'points'],
  pat_made: ['kicking_points', 'points'],
  kicking_points: ['fg_made', 'pat_made', 'points'],
  tackles_assists: ['tackles', 'assists'],
  tackles: ['tackles_assists'],
  assists: ['tackles_assists'],
  sacks: ['sacks_taken'],
  interceptions_def: ['interceptions', 'pass_defended'],
};

// ---------------------------------------------------------------- basketball

const BASKETBALL_RELATED = {
  pts: ['fgm', 'ftm', 'tpm', 'fgPct', 'pr', 'pa', 'pra'],
  reb: ['pr', 'ra', 'pra'],
  ast: ['pa', 'ra', 'pra'],
  pra: ['pts', 'reb', 'ast', 'pr', 'pa', 'ra'],
  pr: ['pts', 'reb', 'pra'],
  pa: ['pts', 'ast', 'pra'],
  ra: ['reb', 'ast', 'pra'],
  tpm: ['pts', 'fgm', 'fgPct'],
  tpa: ['tpm'],
  fgm: ['pts', 'tpm', 'fgPct'],
  fga: ['fgm'],
  ftm: ['pts'],
  fta: ['ftm'],
  twos: ['fgm', 'pts'],
  twosa: ['fgm'],
  stl: ['bs'],
  blk: ['bs'],
  bs: ['stl', 'blk'],
  to: ['ast'],
  pf: [],
  fs: ['pts', 'reb', 'ast', 'stl', 'blk', 'to'],
  dd: ['pts', 'reb', 'ast'],
  td: ['pts', 'reb', 'ast'],
};

// ---------------------------------------------------------------- hockey

const HOCKEY_RELATED = {
  points: ['goals', 'assists', 'ppp', 'sog'],
  goals: ['sog', 'attempts', 'points', 'ppp'],
  assists: ['points', 'ppp'],
  sog: ['attempts', 'goals'],
  attempts: ['sog'],
  hits: ['hits_blocks'],
  blocked: ['hits_blocks'],
  hits_blocks: ['hits', 'blocked'],
  ppp: ['points', 'pim'],
  fow: ['faceoffs', 'fol'],
  faceoffs: ['fow', 'fol'],
  pim: [],
  fantasy: ['goals', 'assists', 'sog', 'blocked', 'ppp'],
  plus_minus: ['goals', 'ga'],
  // A goalie's: what the other team shoots, and what gets past.
  saves: ['shots_against', 'shots_faced', 'sog', 'ga'],
  ga: ['goals', 'saves'],
};
// The goalie table names shots faced differently from the team table.
const HOCKEY_ROW = {shots_faced: 'shots_against'};

// ---------------------------------------------------------------- soccer

// The team comparison's rows go by their labels, in groups; a line opens
// the group its stat sits in.
const SOCCER = {
  goals: ['attack', ['Goals'], ['Shots on Target', 'Shots']],
  ga: ['attack', ['Goals'], ['Shots on Target', 'Shots']],
  ast: ['attack', ['Goals'], ['Shots', 'Crosses']],
  sa: ['attack', ['Shots'], ['Goals', 'Crosses']],
  shots: ['attack', ['Shots'], ['Shots on Target', 'Goals']],
  sot: ['attack', ['Shots on Target'], ['Shots', 'Goals']],
  cross: ['attack', ['Crosses'], ['Corners']],
  crossAcc: ['attack', ['Crosses'], ['Corners']],
  saves: ['defense', ['Saves'], ['Goals Allowed']],
  sotf: ['defense', ['Saves'], ['Goals Allowed']],
  gc: ['defense', ['Goals Allowed'], ['Saves']],
  tackles: ['defense', ['Tackles'], ['Interceptions', 'Clearances']],
  tacklesWon: ['defense', ['Tackles'], ['Interceptions', 'Clearances']],
  int: ['defense', ['Interceptions'], ['Tackles', 'Clearances']],
  clear: ['defense', ['Clearances'], ['Tackles', 'Interceptions']],
  blk: ['defense', [], ['Clearances', 'Tackles']],
  passAtt: ['poss', ['Passes'], ['Possession', 'Pass Accuracy']],
  passes: ['poss', ['Passes'], ['Pass Accuracy', 'Possession']],
  touch: ['poss', ['Possession'], ['Passes']],
  fouls: ['cards', ['Fouls'], ['Yellow Cards']],
  fd: ['cards', ['Fouls Won'], []],
  off: ['cards', ['Offsides'], []],
  yc: ['cards', ['Yellow Cards'], ['Fouls']],
};

// ---------------------------------------------------------------- baseball

// The starter card's rows (MLBStarterComparison.jsx) behind each line.
const BASEBALL = {
  'pitching:strikeouts': [['kPer9'], ['inningsPitched']],
  'pitching:first-ks': [['kPer9'], []],
  'pitching:outs': [['inningsPitched'], ['era', 'whip']],
  'pitching:batters-faced': [['inningsPitched'], ['whip']],
  'pitching:pitches': [['inningsPitched'], ['whip', 'kPer9']],
  'pitching:hits': [['avgAgainst'], ['whip', 'opsAgainst']],
  'pitching:first-hits': [['avgAgainst'], ['whip']],
  'pitching:earned-runs': [['era'], ['whip', 'hrPer9', 'opsAgainst']],
  'pitching:runs-allowed': [['era'], ['whip', 'hrPer9']],
  'pitching:first-runs': [['era'], ['whip']],
  'pitching:hr-allowed': [['hrPer9'], ['opsAgainst']],
  'pitching:walks': [['whip'], []],
  'pitching:first-walks': [['whip'], []],
  'pitching:pitcher-fantasy': [['kPer9', 'era'], ['inningsPitched', 'whip']],
  'hitting:hits': [['avgAgainst'], ['whip', 'opsAgainst']],
  'hitting:singles': [['avgAgainst'], ['whip']],
  'hitting:tb': [['opsAgainst'], ['hrPer9', 'avgAgainst']],
  'hitting:doubles': [['opsAgainst'], ['avgAgainst']],
  'hitting:triples': [['opsAgainst'], ['avgAgainst']],
  'hitting:xbh': [['opsAgainst'], ['hrPer9']],
  'hitting:hr': [['hrPer9'], ['opsAgainst']],
  'hitting:hrr': [['opsAgainst'], ['avgAgainst', 'era', 'whip']],
  'hitting:runs': [['opsAgainst'], ['era', 'whip']],
  'hitting:rbi': [['opsAgainst'], ['era', 'hrPer9']],
  'hitting:walks': [['whip'], []],
  'hitting:strikeouts': [['kPer9'], []],
  'hitting:fantasy': [['opsAgainst'], ['avgAgainst', 'hrPer9']],
};

// ---------------------------------------------------------------- the focus

const NONE = Object.freeze({key: new Set(), related: new Set(), group: null, of: () => null, order: keys => keys});

function build(key, related, canon = value => value, group = null) {
  const keys = new Set(key.filter(Boolean));
  const near = new Set(related.filter(value => value && !keys.has(value)));
  if (!keys.size && !near.size) return NONE;
  const of = value => {
    const name = canon(value);
    return keys.has(name) ? 'key' : near.has(name) ? 'related' : null;
  };
  // The line's own rows first, then the ones that feed it, then the rest
  // in their usual order.
  const order = (items, keyOf = item => item) => items
    .map((item, index) => [item, index, of(keyOf(item))])
    .sort((a, b) => (a[2] === 'key' ? 0 : a[2] === 'related' ? 1 : 2) - (b[2] === 'key' ? 0 : b[2] === 'related' ? 1 : 2) || a[1] - b[1])
    .map(([item]) => item);
  return {key: keys, related: near, group, of, order};
}

/**
 * The focus for a line: `of(rowKey)` says whether a table row is the
 * line's own stat ('key'), one that feeds it ('related') or neither;
 * `order(rows, keyOf)` leads with them. Soccer's also names the team
 * comparison `group` to open on.
 */
export function propFocus(row) {
  if (!row) return NONE;
  const sport = row.sport;
  if (sport === 'nfl' || sport === 'cfb') {
    const stat = FOOTBALL_LINE[sport === 'cfb' ? row.valueKey : row.marketKey || row.raw?.propType] || FOOTBALL_LINE[row.marketKey];
    return stat ? build([stat], FOOTBALL_RELATED[stat] || [], value => FOOTBALL_ROW[value] || value) : NONE;
  }
  if (sport === 'nba' || sport === 'wnba') {
    const stat = MARKET_STAT[row.marketKey];
    return stat ? build([stat], BASKETBALL_RELATED[stat] || []) : NONE;
  }
  if (sport === 'nhl') {
    const stat = row.valueKey;
    return stat ? build([stat], HOCKEY_RELATED[stat] || [], value => HOCKEY_ROW[value] || value) : NONE;
  }
  if (sport === 'soccer') {
    const entry = SOCCER[statKeyOf(row.marketKey)];
    return entry ? build(entry[1], entry[2], value => value, entry[0]) : NONE;
  }
  if (sport === 'mlb') {
    const entry = BASEBALL[row.marketKey];
    return entry ? build(entry[0], entry[1]) : NONE;
  }
  return NONE;
}

/** The words a highlighted row carries. */
export const FOCUS_TAG = {key: 'Your line', related: 'Related'};
