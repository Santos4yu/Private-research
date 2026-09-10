// Development-only integration fixture. App markup, React and behavior are real;
// all API/data responses and page storage are isolated synthetic examples.
// Open /tests/trends-integration.html#v2, select Finder, then a prop.
import { finderMarket, historyChart, nameKey } from '/src/prop-finder-core.js';

const nativeFetch = window.fetch.bind(window);
const players = [
  { id: 605400, name: 'Aaron Nola', position: 'P', team: 'Philadelphia Phillies', teamId: 143, teamAbbr: 'PHI' },
  { id: 605141, name: 'Mookie Betts', position: 'SS', team: 'Los Angeles Dodgers', teamId: 119, teamAbbr: 'LAD' },
];
const person = name => players.find(player => nameKey(player.name) === nameKey(name)) || players[0];
const headshot = player => `https://img.mlbstatic.com/mlb-photos/image/upload/w_180/v1/people/${player.id}/headshot/67/current`;
const props = [
  ['Aaron Nola', 'Pitcher Strikeouts', 2.5, 'goblin'],
  ['Aaron Nola', 'Pitcher Strikeouts', 5.5, 'standard'],
  ['Aaron Nola', 'Pitcher Strikeouts', 6.5, 'demon'],
  ['Aaron Nola', 'Pitcher Strikeouts', 7.5, 'demon'],
  ['Aaron Nola', 'Pitcher Strikeouts', 8.5, 'demon'],
  ['Aaron Nola', 'Hits Allowed', 3.5, 'goblin'],
  ['Aaron Nola', 'Hits Allowed', 5.5, 'standard'],
  ['Aaron Nola', 'Hits Allowed', 6.5, 'demon'],
  ['Aaron Nola', 'Earned Runs Allowed', 0.5, 'goblin'],
  ['Aaron Nola', 'Earned Runs Allowed', 2.5, 'standard'],
  ['Aaron Nola', 'Earned Runs Allowed', 3.5, 'demon'],
  ['Mookie Betts', 'Hits', 0.5, 'standard'],
  ['Mookie Betts', 'Hits', 1.5, 'demon'],
  ['Mookie Betts', 'Hits+Runs+RBIs', 0.5, 'goblin'],
  ['Mookie Betts', 'Hits+Runs+RBIs', 1.5, 'standard'],
  ['Mookie Betts', 'Hits+Runs+RBIs', 2.5, 'demon'],
  ['Mookie Betts', 'Total Bases', 1.5, 'standard'],
].map(([player, stat, line, odds_type], index) => ({
  id: `fixture-line-${index}`, player, stat, line, odds_type,
  team: person(player).teamAbbr, position: person(player).position,
  headshot: headshot(person(player)),
}));
const teams = [{ id: 144, name: 'ATL' }, { id: 121, name: 'NYM' }, { id: 146, name: 'MIA' }, { id: 120, name: 'WSH' }];

function history(playerName) {
  const player = person(playerName);
  const pitcher = player.position === 'P';
  return {
    updatedAt: Date.now(), player,
    matchup: { opponent: teams[0] }, h2hLabel: 'Sample current-season matchups',
    games: Array.from({ length: 30 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 7, 1 + index)).toISOString().slice(0, 10);
      const hits = pitcher ? [4, 7, 3, 5, 6, 4][index % 6] : [1, 2, 0, 3, 1, 0][index % 6];
      return {
        date, opponent: teams[index % teams.length], isHome: index % 2 === 0,
        oppHand: index % 3 === 0 ? 'L' : 'R',
        stat: {
          hits, strikeOuts: pitcher ? [7, 5, 8, 3, 6, 4][index % 6] : index % 3,
          earnedRuns: [0, 2, 4, 1, 3][index % 5], outs: [15, 18, 19, 17, 21][index % 5],
          inningsPitched: ['5.0', '6.0', '6.1', '5.2', '7.0'][index % 5],
          baseOnBalls: index % 3, runs: index % 2, rbi: index % 3,
          doubles: hits > 1 ? 1 : 0, triples: 0, homeRuns: index % 7 === 0 && hits ? 1 : 0,
          hitByPitch: 0, stolenBases: index % 8 === 0 ? 1 : 0,
        },
      };
    }),
  };
}

function chart(player, stat, line) {
  const payload = history(player);
  const market = finderMarket(stat) || finderMarket('Hits');
  const result = historyChart(payload, { stat: market.label, line });
  result.all.forEach((game, index) => {
    game.oppHand = payload.games[index].oppHand;
    if (market.pitcher) game.pitcherDetails = {
      inningsPitched: payload.games[index].stat.inningsPitched,
      battersFaced: 24, pitchCount: 91,
      walks: payload.games[index].stat.baseOnBalls,
      strikeouts: payload.games[index].stat.strikeOuts,
    };
  });
  return result;
}

function prediction(playerName, stat = 'Strikeouts (Pitcher)', line = 5.5, side = 'over') {
  const player = person(playerName);
  const gameLogChart = chart(player.name, stat, Number(line));
  const rate = games => games.length ? Math.round(games.filter(game => game.over).length / games.length * 100) : 0;
  return {
    id: `fixture-${nameKey(player.name)}-${nameKey(stat)}-${line}`,
    player: player.name, playerId: player.id, sport: 'MLB', position: player.position,
    team: player.teamAbbr, teamName: player.team, teamAbbr: player.teamAbbr, teamId: player.teamId,
    headshot: headshot(player), isPitcherProp: player.position === 'P', betType: stat,
    line: Number(line), side: side.toLowerCase() === 'under' ? 'Under' : 'Over',
    date: '2026-09-07', score: 76, verdict: 'Sample research', matchupScore: 72,
    matchupLabel: 'Sample matchup', matchupCoverage: 1, matchupFactors: [],
    matchup: { opponent: 'Atlanta Braves', pitcher: 'Sample starting pitcher', lineup: 'Sample lineup' },
    opponentTeamId: 144, gameLogChart, last5: gameLogChart.l5,
    hitRates: { l5: rate(gameLogChart.l5), l10: rate(gameLogChart.l10), l20: rate(gameLogChart.l20) },
    estHitRate: rate(gameLogChart.l10), whyItHits: ['Synthetic values for interface testing.'],
    negativeSignals: ['Sample data only. Not a live pick.'], narrative: 'Sample data only. Not a live pick.',
    researchMeta: { status: 'FULL', sampleGames: 30, exactLineRate: rate(gameLogChart.all),
      sources: ['UI fixture'], methodNote: 'Synthetic sample data.', limitations: [] },
    seasonLine: '2026 sample performance', split: {}, vsMatchup: {},
  };
}

const board = {
  generated_at: '2026-09-07T18:00:00Z',
  props: players.map(player => ({
    id: `fixture-board-${player.id}`, player_name: player.name, team: player.teamAbbr,
    sport: 'MLB', stat_type: player.position === 'P' ? 'Strikeouts' : 'Hits',
    line: player.position === 'P' ? 5.5 : 0.5, tier: 'STRONG', vortex_score: 76,
    stats: { player_id: player.id, team_id: player.teamId, team: player.team,
      team_abbr: player.teamAbbr, opponent_team_id: 144, opponent: 'Atlanta Braves',
      side: 'over', matchup_score: 72, _live_matchup_ready: true,
      splits: { l5: { rate: 60 }, l10: { rate: 70 }, l20: { rate: 65 } } },
  })),
};

function memoryStorage() {
  const values = new Map();
  return { get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(String(key)) ?? null,
    setItem: (key, value) => values.set(String(key), String(value)),
    removeItem: key => values.delete(String(key)), clear: () => values.clear() };
}
// Keep fixture saves, themes and cached sample responses out of customer storage.
Object.defineProperty(window, 'sessionStorage', { configurable: true, value: memoryStorage() });
Object.defineProperty(window, 'localStorage', { configurable: true, value: memoryStorage() });
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' },
});
window.fetch = async (input, options) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.href);
  const query = url.searchParams;
  if (url.pathname === '/predictions.json') return json({ props: players.map(player => prediction(player.name, player.position === 'P' ? 'Strikeouts (Pitcher)' : 'Hits', player.position === 'P' ? 5.5 : 0.5)) });
  if (url.pathname === '/api/auth/me') return json({ authenticated: true, username: 'Sample account' });
  if (url.pathname === '/api/players') return json({ players: players.filter(player => nameKey(player.name).includes(nameKey(query.get('q')))) });
  if (url.pathname === '/api/game-log-filters') return json(chart(query.get('player'), query.get('stat'), Number(query.get('line'))));
  if (url.pathname === '/api/board') {
    if (query.get('view') === 'props') return json({ props, updatedAt: Date.now() });
    if (query.get('view') === 'prop-history') return json(history(query.get('player')));
    if (query.get('view') === 'specials') return json({ moneyline: [], nrfi: [] });
    return json(board);
  }
  if (url.pathname === '/api/prediction') {
    if (query.get('action') === 'prizepicks-lines') return json({ lines: props.filter(row => nameKey(row.player) === nameKey(query.get('player')) && finderMarket(row.stat)?.label === finderMarket(query.get('stat'))?.label).map(row => ({ line: row.line, tier: row.odds_type.toUpperCase(), featured: row.odds_type === 'standard', ppOver: true, ppUnder: row.odds_type === 'standard' })) });
    if (query.get('action') === 'prizepicks-export') return json({ props });
    return json(prediction(query.get('player'), query.get('stat') || undefined, query.get('line') || undefined, query.get('side') || undefined));
  }
  // A new backend contract must be mocked explicitly, never hit production.
  if (url.pathname.startsWith('/api/')) return json({ error: `No fixture response for ${url.pathname}` }, 404);
  return nativeFetch(input, options);
};

const parsed = new DOMParser().parseFromString(await (await nativeFetch('/index.html')).text(), 'text/html');
parsed.querySelectorAll('script').forEach(script => script.remove());
parsed.head.querySelectorAll('[href]').forEach(node => {
  node.setAttribute('href', new URL(node.getAttribute('href'), `${location.origin}/`).href);
});
document.head.replaceChildren(...parsed.head.childNodes);
document.title = 'Research Trend integration · sample data, not live picks';
document.body.replaceChildren(...parsed.body.childNodes);
for (const attribute of parsed.documentElement.attributes) document.documentElement.setAttribute(attribute.name, attribute.value);
for (const attribute of parsed.body.attributes) document.body.setAttribute(attribute.name, attribute.value);
const badge = document.createElement('div');
badge.textContent = 'UI FIXTURE · SAMPLE DATA · NOT LIVE PICKS';
badge.setAttribute('role', 'note');
badge.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;text-align:center;background:#473b13;color:#fff2b9;font:9px/13px system-ui;pointer-events:none';
document.body.append(badge);
if (!location.hash) window.history.replaceState(null, '', `${location.pathname}#v2`);
await import('/src/main.jsx');
await import('/app.js');

