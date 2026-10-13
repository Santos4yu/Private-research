// Layout fixture: Promo Board cards from made-up promo lines (no network).
import React from 'react';
import {createRoot} from 'react-dom/client';
import {PromoCard} from '../src/PromoBoard.jsx';
import {promoCards} from '../src/promo-board-core.js';
import '../src/slip-analyzer.css';

const later = new Date(Date.now() + 5 * 3600e3).toISOString();
const w = (hits, games) => ({hits, misses: games - hits, pushes: 0, decisions: games, sample: games, hitRate: hits / games * 100});
const log = values => values.map((value, i) => ({value, opponent: ['DEN', 'LAL', 'PHX', 'GSW', 'DAL', 'OKC', 'SAC', 'POR'][i % 8], date: `2026-10-0${(i % 9) + 1}`}));
const row = (player, market, line, promo, l10, season, values, extra = {}) => ({id: `${player}:${line}`, sport: 'nba', player, market, line, modifier: 'standard', promo,
  direction: 'OVER', startsAt: later, teamAbbr: 'MIN', opponent: 'DEN', gameId: 'g1', raw: {stat: market}, gameLog: log(values),
  windows: {l5: w(Math.min(5, Math.round(l10[0] / 2)), 5), l10: w(...l10), season: w(...season)}, apps: [{key: 'prizepicks', name: 'PrizePicks'}], ...extra});
const rows = [
  row('Anthony Edwards', 'Points', 0.5, true, [10, 10], [50, 50], [28, 31, 22, 35, 27, 24, 33, 29, 26, 30]),
  row('Anthony Edwards', 'Points', 27.5, false, [6, 10], [30, 50], []),
  row('Rudy Gobert', 'Rebounds', 1.5, true, [10, 10], [49, 50], [11, 13, 9, 12, 14, 10, 8, 12, 11, 13]),
  row('Rudy Gobert', 'Rebounds', 11.5, false, [5, 10], [26, 50], []),
];
createRoot(document.getElementById('root')).render(<div className="pb-grid">{promoCards(rows).map(card => <PromoCard key={card.row.id} card={card} saved={false} onAdd={() => {}}/>)}</div>);
