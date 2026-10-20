// Each Cheat Sheet's #1 right now, for its card on the hub (CheatSheets.jsx):
// who or what it is, a short line on why, and the number behind it. Read
// from the same data the sheet itself shows (mlb_sheets.py, nfl_sheets.py, nba_sheets.py).

const finite = value => typeof value === 'number' && Number.isFinite(value);
const best = (rows, value) => (rows || []).reduce((top, row) => {
  const mine = value(row);
  return finite(mine) && (!top || mine > value(top)) ? row : top;
}, null);
const last = name => String(name || '').split(' ').filter(Boolean).at(-1) || '';
const rate = value => value.toFixed(3).replace(/^0/, '');
const one = value => Number.isInteger(value) ? String(value) : value.toFixed(1);
const signed = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(Math.round(value))}%`;
const side = value => String(value || '').toLowerCase() === 'under' ? 'Under' : 'Over';
const nflWho = row => ({name: row?.who?.name || '', photo: row?.who?.headshot || null});

const MLB = {
  hr: data => {
    const row = best(data.rows, item => item.score);
    return row && {name: row.name, id: row.id, detail: `${row.team} vs ${last(row.pitcher?.name) || row.opponent}`, value: row.score, kind: 'score'};
  },
  hot: data => {
    const row = best(data.rows, item => item.score);
    return row && {name: row.name, id: row.id, value: row.score, kind: 'score',
      detail: finite(row.delta?.ops) && row.delta.ops > 0 ? `OPS up ${rate(row.delta.ops)} on his season` : `${row.team} vs ${row.opponent}`};
  },
  matchups: data => {
    const batters = (data.games || []).flatMap(game => (game.halves || []).flatMap(half =>
      (half.lineup || []).map(batter => ({...batter, team: half.team, arm: half.pitcher?.name}))));
    const row = best(batters, item => item.score);
    return row && {name: row.name, id: row.id, detail: `${row.team} vs ${last(row.arm) || 'TBD'}`, value: row.score, kind: 'score'};
  },
  bvp: data => {
    const row = best(data.rows, item => item.score);
    const line = finite(row?.hits) && finite(row?.ab) ? `${row.hits}-for-${row.ab}` : `${row?.pa} PA`;
    return row && {name: row.name, id: row.id, detail: `${line} vs ${last(row.pitcher?.name)}`, value: row.score, kind: 'score'};
  },
  nrfi: data => {
    const row = best(data.rows, item => item.chance);
    return row && {name: `${row.away?.team} @ ${row.home?.team}`, detail: 'Best chance of a scoreless first', value: row.chance, kind: 'pct'};
  },
  park: data => {
    const row = best(data.rows, item => item.runs);
    return row && {name: row.venue, detail: `${row.away} @ ${row.home} · runs ${signed(row.runs)}`, value: row.runs, kind: 'signed'};
  },
  strikeouts: data => {
    const row = best(data.rows, item => item.score);
    return row && {name: row.name, id: row.id, value: row.score, kind: 'score',
      detail: finite(row.projected) ? `Projects ${one(row.projected)} K vs ${row.opponent}` : `vs ${row.opponent}`};
  },
  streaks: data => {
    const row = best(data.streaks?.hits?.rows, item => item.streak);
    return row && {name: row.name, id: row.id, detail: `${row.team} · hit in ${row.streak} straight`, value: row.streak, kind: 'count'};
  },
};

const NFL = {
  best: data => {
    const row = best(data.rows, item => item.score);
    return row && {...nflWho(row), detail: `More ${row.line} ${row.label} vs ${row.opponent}`, value: row.score, kind: 'score'};
  },
  td: data => {
    const row = best(data.players, item => item.chance);
    return row && {...nflWho(row), detail: `${row.who?.position || ''} · ${row.who?.team} vs ${row.opponent}`.replace(/^ · /, ''), value: row.chance, kind: 'pct'};
  },
  firsttd: data => {
    const row = best(data.bestEarly, item => item.early);
    return row && {name: row.team, detail: `TD on its first two drives in ${row.earlyTds} of ${row.earlyGames}`, value: row.early, kind: 'pct'};
  },
  streaks: data => {
    const row = best(data.rows, item => item.score);
    return row && {...nflWho(row), detail: `${row.streak} straight · ${side(row.side)} ${row.line} ${row.label}`, value: row.score, kind: 'score'};
  },
  zones: data => {
    const row = best(data.rows, item => item.score);
    return row && {...nflWho(row), detail: `${row.who?.position || ''} vs ${row.opponent}${row.prime ? ' · prime zone' : ''}`.trim(), value: row.score, kind: 'score'};
  },
  redzone: data => {
    const row = best(data.rows, item => item.looks);
    return row && {...nflWho(row), detail: `${one(row.looks)} red-zone looks a game vs ${row.opponent}`, value: row.share, kind: 'pct'};
  },
  speed: data => {
    const row = best(data.rows, item => item.score);
    return row && {...nflWho(row), detail: `${finite(row.mph) ? `${one(row.mph)} mph · ` : ''}${row.label}`, value: row.score, kind: 'score'};
  },
  steam: data => {
    const row = best(data.rows, item => item.score);
    return row && {...nflWho(row), detail: `${row.label} ${row.open} → ${row.now} · ${row.books} books`, value: row.score, kind: 'score'};
  },
  shop: data => {
    const row = best(data.rows, item => item.edge);
    return row && {...nflWho(row), detail: `${side(row.side)} ${row.line} ${row.label} · ${row.bookName}`, value: row.edge, kind: 'edge'};
  },
  dvp: data => {
    const row = (data.softest || [])[0];
    return row && {name: `${row.team} vs ${row.position}s`, detail: `Gives up the most · plays ${row.opponent}`, value: row.rank, kind: 'rank'};
  },
  soft: data => {
    const row = best(data.spots, item => item.rank);
    return row && {...nflWho(row), detail: `${row.label} vs the ${row.rank === row.teams ? 'softest' : `#${row.rank}`} defense`, value: row.rank, kind: 'rank'};
  },
  goblins: data => {
    const row = best(data.lines, item => item.chance);
    return row && {...nflWho(row), detail: `${row.kind === 'demon' ? 'Demon' : 'Goblin'} ${row.line} ${row.label}`, value: row.chance, kind: 'pct'};
  },
};

const NBA = {
  pace: data => {
    const row = (data.rows || [])[0];
    return row && {name: `${row.away} @ ${row.home}`, photo: `https://a.espncdn.com/i/teamlogos/nba/500/${String(row.home).toLowerCase()}.png`,
      detail: `${one(row.projected)} possessions${row.paceUp ? ' · two fast teams' : ''}`, value: row.score, kind: 'score'};
  },
  out: data => {
    const row = best(data.rows, item => item.score);
    return row && {...nflWho(row), detail: `Without ${last(row.out?.name)}: ${row.diff?.pts > 0 ? '+' : ''}${one(row.diff?.pts || 0)} pts in ${row.games} games`,
      value: row.score, kind: 'score'};
  },
};

const LEAGUES = {mlb: MLB, nfl: NFL, nba: NBA};

/** The sheet's #1 as {name, detail, value, kind, id | photo}, or null. */
export function teaser(league, sheet, data) {
  try {
    return (data && LEAGUES[league]?.[sheet]?.(data)) || null;
  } catch {
    return null;
  }
}

/** The number on the card: a score, a chance, a rank. */
export function teaserValue({value, kind} = {}) {
  if (!finite(value)) return '—';
  if (kind === 'pct') return `${Math.round(value * 100)}%`;
  if (kind === 'edge') return `+${Math.round(value * 100)}%`;
  if (kind === 'signed') return signed(value);
  if (kind === 'rank') return `#${value}`;
  return String(Math.round(value));
}
