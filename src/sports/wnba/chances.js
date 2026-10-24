// Where an NBA player's rebounds and assists come from tonight, for the
// player page's rebound and assist sheets (NbaScout.jsx): the chances the
// game should give him against his usual, his share of them, and why the
// opponent gives up what it does. Arithmetic on the league's opportunity
// table (backend/sports/wnba/opportunity.py team_table) and his own
// (player-context `opportunity`), not a model: the matchup score's
// rebounds and assists reads already count what this explains (in the
// Oct 24 backtest these numbers line up with overs on their own but add
// nothing on top of the rebounds and assists a team allows).
//
// Rebounds come off missed shots. On defense his chances are their misses
// that they don't get back themselves; on offense his team's misses, the
// share of them his team gets back. Tonight each is the two teams' usual
// numbers met halfway (their misses and what his team usually forces; their
// crashing and what his team usually allows), set against his team's usual
// game, and his own rebounds on each end moved by as much.
//
// Assists come off teammates' baskets: tonight his team's usual baskets and
// what the opponent usually allows met halfway, times the share assisted
// (his team's habit and the opponent's, halfway), against his team's usual.
import {rankTone, rankWords} from '../../research-ranks.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const one = value => (Math.round(value * 10) / 10).toFixed(1);
const mean = (...values) => values.every(finite) ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const valueOf = cell => (Array.isArray(cell) ? cell[0] : cell);
const rankOf = cell => (Array.isArray(cell) ? cell[1] : null);
// His recent role where he has enough of it: his last 10 games, else the season.
const window = chances => (chances?.l10?.games >= 5 ? {...chances.l10, label: 'his last 10'} : chances?.szn ? {...chances.szn, label: 'this season'} : null);

/** A row on the sheet: what it is, the number, where it ranks and whether more helps his over. */
function row(key, label, value, unit, rank, count, moreHelps, note) {
  if (!finite(value)) return null;
  return {key, label, value: `${one(value)}${unit}`, words: rankWords(rank, count), tone: rankTone(rank, count, moreHelps), note};
}

/**
 * Rebounds: {expected, usual, basis, ends: [{key, label, tonight, usual, mine}], mine: [...], rows: [...]}
 * or null without the numbers. `stat` is 'reb' (or a combo with it).
 */
export function reboundChances(player, table, team, opponent) {
  const own = table?.teams?.[team], opp = table?.teams?.[opponent], count = table?.count;
  const his = window(player?.opportunity);
  if (!own || !opp || !his) return null;
  const v = key => valueOf(own[key]), w = key => valueOf(opp[key]);
  // Defense: their misses that they don't get back.
  const defUsual = finite(v('missAllowed')) && finite(v('orebAllowedPct')) ? v('missAllowed') * (1 - v('orebAllowedPct') / 100) : null;
  const defMisses = mean(w('miss'), v('missAllowed')), defCrash = mean(w('orebPct'), v('orebAllowedPct'));
  const defTonight = finite(defMisses) && finite(defCrash) ? defMisses * (1 - defCrash / 100) : null;
  // Offense: his team's misses, the share it gets back.
  const offUsual = finite(v('miss')) && finite(v('orebPct')) ? v('miss') * v('orebPct') / 100 : null;
  const offMisses = mean(v('miss'), w('missAllowed')), offGets = mean(v('orebPct'), w('orebAllowedPct'));
  const offTonight = finite(offMisses) && finite(offGets) ? offMisses * offGets / 100 : null;
  if (!finite(defUsual) || !finite(defTonight) || !finite(his.dreb) || !finite(his.oreb) || !(defUsual > 0)) return null;
  const offFactor = finite(offUsual) && offUsual > 0 && finite(offTonight) ? offTonight / offUsual : 1;
  const expected = his.dreb * defTonight / defUsual + his.oreb * offFactor;
  const season = player.opportunity.szn;
  return {
    expected, usual: his.dreb + his.oreb, basis: his.label,
    ends: [
      {key: 'defense', label: 'On defense', tonight: defTonight, usual: defUsual, mine: his.dreb,
        text: `${opponent}'s misses they don't get back: about ${one(defTonight)} tonight, ${team}'s usual game ${one(defUsual)}`},
      {key: 'offense', label: 'On offense', tonight: offTonight, usual: offUsual, mine: his.oreb,
        text: finite(offTonight) ? `${team}'s misses it gets back: about ${one(offTonight)} tonight, usually ${one(offUsual)}` : `${team}'s offensive rebounds: as usual`},
    ],
    mine: [
      finite(season?.drebShare) && {key: 'drebShare', label: 'Defensive boards he grabs', value: `${one(season.drebShare)}%`, note: 'Of the rebounds off their misses while he plays'},
      finite(season?.orebShare) && {key: 'orebShare', label: 'Offensive boards he grabs', value: `${one(season.orebShare)}%`, note: 'Of the rebounds off his team’s misses while he plays'},
      finite(season?.missesOn) && {key: 'missesOn', label: 'Missed shots while he plays', value: one(season.missesOn), note: 'Both teams, a game'},
    ].filter(Boolean),
    rows: [
      row('miss', `${opponent} missed shots`, w('miss'), ' a game', rankOf(opp.miss), count, true, 'His chances on defense'),
      row('orebPct', `${opponent} get back their misses`, w('orebPct'), '%', rankOf(opp.orebPct), count, false, 'The more they crash, the fewer fall to him'),
      row('missAllowed', `Misses against ${opponent}`, w('missAllowed'), ' a game', rankOf(opp.missAllowed), count, true, 'His team’s chances on offense'),
      row('orebAllowedPct', `Teams get back their misses vs ${opponent}`, w('orebAllowedPct'), '%', rankOf(opp.orebAllowedPct), count, true, 'Weak on their own glass: more offensive boards'),
      row('rebAllowed', `${opponent} rebounds allowed`, w('rebAllowed'), ' a game', rankOf(opp.rebAllowed), count, true, 'All of it together'),
    ].filter(Boolean),
  };
}

/** Assists: {expected, usual, basis, tonight, usualMakes, assisted, usualAssisted, mine, rows} or null. */
export function assistChances(player, table, team, opponent, tracking = null) {
  const own = table?.teams?.[team], opp = table?.teams?.[opponent], count = table?.count;
  const his = window(player?.opportunity);
  if (!own || !opp || !his || !finite(his.ast)) return null;
  const v = key => valueOf(own[key]), w = key => valueOf(opp[key]);
  const makes = mean(v('fgm'), w('fgmAllowed')), assisted = mean(v('assistedPct'), w('assistedAllowed'));
  if (!finite(makes) || !finite(assisted) || !(v('fgm') > 0) || !(v('assistedPct') > 0)) return null;
  const tonight = makes * assisted / 100, usual = v('fgm') * v('assistedPct') / 100;
  const season = player.opportunity.szn, passing = tracking?.available ? tracking.passing : null;
  return {
    expected: his.ast * tonight / usual, usual: his.ast, basis: his.label,
    makes, usualMakes: v('fgm'), assisted, usualAssisted: v('assistedPct'),
    text: `${team} baskets: about ${one(makes)} tonight (usually ${one(v('fgm'))}), ${Math.round(assisted)}% assisted (usually ${Math.round(v('assistedPct'))}%)`,
    mine: [
      finite(season?.astShare) && {key: 'astShare', label: 'Teammates’ baskets he assists', value: `${one(season.astShare)}%`, note: 'While he plays'},
      finite(season?.mateFg) && {key: 'mateFg', label: 'Teammates’ shooting', value: `${one(season.mateFg)}%`, note: 'In his games: how often his passes can become assists'},
      finite(passing?.potentialAst) && {key: 'potentialAst', label: 'Potential assists', value: one(passing.potentialAst), note: 'Passes a teammate shot off, a game (NBA tracking)'},
    ].filter(Boolean),
    rows: [
      row('fgmAllowed', `${opponent} baskets allowed`, w('fgmAllowed'), ' a game', rankOf(opp.fgmAllowed), count, true, 'More baskets, more to assist'),
      row('assistedAllowed', `Baskets vs ${opponent} assisted`, w('assistedAllowed'), '%', rankOf(opp.assistedAllowed), count, true, 'How much ball movement beats them'),
      row('fgPctAllowed', `${opponent} shooting allowed`, w('fgPctAllowed'), '%', rankOf(opp.fgPctAllowed), count, true, 'How often a pass becomes a basket'),
      row('astAllowed', `${opponent} assists allowed`, w('astAllowed'), ' a game', rankOf(opp.astAllowed), count, true, 'All of it together'),
    ].filter(Boolean),
  };
}
