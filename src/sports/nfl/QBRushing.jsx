import React from 'react';
import {ChevronDown, Footprints} from 'lucide-react';
import {gameIdOf, opponentOf, useNfl} from './nfl-finder';
import {QB_RUSH_MARKETS, qbSeason, rankTone, rankWords, weekOf} from './qb-rushing';
import {useIsAdmin, QUIET} from '../../admin-notice.js';
import './qb-rushing.css';

// The QB rushing card on an NFL player page, for a quarterback's rushing
// lines: how he runs (scrambles against designed runs, sneaks among them,
// what kneel-downs take off, against the blitz, in close games), how he
// handles pressure, the model's dropbacks for this game; what this week's
// defense gives quarterbacks on the ground -- each with its rank, and game
// by game against what each quarterback usually runs for; this week's
// starters out up front; then his games one by one. From nfl_scouting.py
// (qb_rush), the same numbers the Slip Analyzer's QB notes read.

const one = value => (Math.round(value * 10) / 10).toFixed(1);
const pct = value => `${Math.round(value * 100)}%`;
const per = (total, games) => (games ? one(total / games) : '—');
const yards = value => String(value).replace('-', '\u2212');
const signed = value => `${value >= 0 ? '+' : '\u2212'}${one(Math.abs(value))}`;
const lastName = name => String(name || '').trim().split(/\s+/).slice(1).join(' ') || name || 'His';

function Tile({label, value, unit, note}) {
  return <div className="qbr-tile"><span>{label}</span><strong>{value}{unit && <small>{unit}</small>}</strong>{note && <em>{note}</em>}</div>;
}

// What a defense gives quarterbacks: [key, label, how to show it, more helps his line, aside, rank words].
const DEFENSE = [
  ['qbRushVsUsual', 'QB rushing vs their usual', value => `${signed(value)} a game`, true, 'what quarterbacks run for here over their other games',
    {most: 'most', fewest: 'least'}],
  ['qbScrambleYards', 'QB scramble yards allowed', value => `${one(value)} a game`, true],
  ['qbRushYards', 'QB rushing yards allowed', value => `${one(value)} a game`, true, 'kneel-downs left out'],
  ['qbScrambles', 'QB scrambles allowed', value => `${one(value)} a game`, true],
  ['yardsPerScramble', 'Yards a QB scramble', value => `${one(value)} yards`, true],
  ['scrambleRate', 'QB scramble rate', value => `${pct(value)} of dropbacks`, true],
  ['blitz', 'Blitz rate', value => `${pct(value)} of dropbacks`, true],
  ['pressure', 'Pressure rate', value => `${pct(value)} of dropbacks`, true],
  ['sackPerPressure', 'Pressures turned into sacks', value => pct(value), false],
];

export default function QBRushing({row, season, position}) {
  const admin = useIsAdmin();
  const opponent = opponentOf(row);
  const show = position === 'QB' && QB_RUSH_MARKETS.has(row.marketKey) && Boolean(row.playerId && opponent);
  const gameId = gameIdOf(row), week = weekOf(gameId);
  const state = useNfl('qb-rush', {season, playerId: row.playerId, opponent, gameId}, show);
  // The model's dropbacks for this game (backend/sports/nfl/opportunity_service.py).
  const model = useNfl('opportunity', {season, week, playerId: row.playerId}, show && Boolean(week), {model: true});
  if (!show) return null;
  const data = state.data;
  const me = qbSeason(data?.player);
  const name = lastName(row.player);
  const card = children => <section className="mlb-context-card qbr-card">
    <header><h2><Footprints size={16} aria-hidden="true"/>QB rushing</h2>{me && <small>{season} · {me.games} {me.games === 1 ? 'game' : 'games'}</small>}</header>
    {children}
  </section>;
  if (state.loading && !data) return card(<div className="mlb-context-skeleton" role="status" aria-label="Loading QB rushing"><span/><span/><span/><span/></div>);
  if (state.error) return card(<p className="mlb-context-note">{admin ? <>{state.error} <button type="button" onClick={state.retry}>Retry</button></> : QUIET}</p>);
  if (!me) return card(<p className="mlb-context-note">No starts for {row.player} yet this season.</p>);

  const count = data.teamCount || 32;
  const withKneels = me.scrambleYards + me.designedYards + me.kneelYards;
  const sacked = data.player?.sackRate, escape = data.player?.escape, last = data.player?.lastSeason;
  const sneaks = !me.sneaks ? 'no QB sneaks' : me.sneaks === me.designed ? (me.designed === 1 ? 'a QB sneak' : `all QB sneaks`)
    : `${me.sneaks} of ${me.designed} ${me.sneaks === 1 ? 'was a QB sneak' : 'were QB sneaks'}`;
  const forecast = model.data?.data, dropbacks = forecast?.team?.expectedDropbacks, expected = forecast?.player?.metrics?.expectedScrambles || forecast?.team?.expectedScrambles;
  const projected = dropbacks?.status === 'AVAILABLE' && Number.isFinite(dropbacks.mean)
    ? {value: one(dropbacks.mean), note: `PropScout's model${expected?.status === 'AVAILABLE' && Number.isFinite(expected.mean) ? `; ${one(expected.mean)} scrambles expected` : ''}`}
    : {value: '—', note: model.loading ? 'Projecting…' : 'No projection for this game yet'};
  const lines = data.lines || {};
  const lineList = players => (players?.length ? players.map(player => `${player.position} ${player.name} (${player.status.toLowerCase()})`).join(', ') : 'All starters in');
  const under = me.under
    ? {value: per(me.under.yards, me.under.games), note: `${season} · ${me.under.scrambles} scrambles on ${me.under.dropbacks} pressured dropbacks`}
    : last?.games
      ? {value: per(last.yards, last.games), note: `${season - 1} · ${last.scrambles} scrambles on ${last.pressured} pressured dropbacks; ${season}'s isn't charted yet`}
      : {value: '—', note: `Not charted yet for ${season}`};
  return card(<>
    <div className="qbr-section">
      <h3>{name}'s runs</h3>
      <div className="qbr-tiles">
        <Tile label="Scrambles" value={per(me.scrambles, me.games)} unit="a game" note={`${me.scrambles} in ${me.games} games`}/>
        <Tile label="Scramble yards" value={per(me.scrambleYards, me.games)} unit="a game" note={me.scrambles ? `${one(me.scrambleYards / me.scrambles)} a scramble` : 'No scrambles yet'}/>
        <Tile label="Designed runs" value={per(me.designed, me.games)} unit="a game" note={`${per(me.designedYards, me.games)} yards a game; ${sneaks}`}/>
        <Tile label="Rush yards without kneel-downs" value={per(me.scrambleYards + me.designedYards, me.games)} unit="a game"
          note={me.kneels ? `${per(withKneels, me.games)} with his ${me.kneels} kneel${me.kneels === 1 ? '' : 's'} (${yards(me.kneelYards)} yards), as the line counts it` : 'No kneel-downs'}/>
        <Tile label="Pressured" value={me.pressureRate == null ? '—' : pct(me.pressureRate)} unit="of dropbacks"
          note={me.pressuredGames ? `${per(me.pressured, me.pressuredGames)} times a game` : 'Not in the advanced stats yet'}/>
        <Tile label="Sacked when pressured" value={sacked ? pct(sacked[0]) : '—'} unit="of pressures"
          note={sacked ? `${rankWords(sacked[1], sacked[2])} of ${sacked[2]} QBs` : 'Too few pressures yet'}/>
        <Tile label="Gets away from pressure" value={escape ? Math.round(escape[0] * 100) : '—'} unit="scrambles per 100 pressures"
          note={escape ? `${rankWords(escape[1], escape[2])} of ${escape[2]} QBs` : 'Too few pressures yet'}/>
        <Tile label="Rush yards under pressure" value={under.value} unit={under.value === '—' ? '' : 'a game'} note={under.note}/>
        <Tile label="Scrambles against the blitz" value={me.vsBlitz == null ? '—' : pct(me.vsBlitz)} unit={me.vsBlitz == null ? '' : 'of dropbacks'}
          note={me.vsBlitz == null ? 'Too few blitzes charted yet' : me.noBlitz == null ? `${me.blitzedDropbacks} blitzed dropbacks` : `${pct(me.noBlitz)} of dropbacks without the blitz`}/>
        <Tile label="10+ yard scrambles" value={`${me.longGames} of ${me.games}`} unit="games" note={me.scrambles ? `His longest went ${me.longest} yards` : 'No scrambles yet'}/>
        <Tile label="Runs in close games" value={me.close == null ? '—' : pct(me.close)} unit={me.close == null ? '' : 'of plays within one score'}
          note={me.close == null ? 'Too few close plays yet' : me.other == null ? '' : `${pct(me.other)} of plays otherwise`}/>
        <Tile label="Projected dropbacks" value={projected.value} unit={projected.value === '—' ? '' : 'this game'} note={projected.note}/>
      </div>
    </div>
    <div className="qbr-section">
      <h3>Up front this week</h3>
      {lines.reported ? <ul className="qbr-lines">
        <li><span>{data.team} offensive line</span><b data-tone={lines.line?.length ? 'warn' : 'neutral'}>{lineList(lines.line)}</b></li>
        <li><span>{data.opponent.team} pass rush</span><b data-tone={lines.rush?.length ? 'warn' : 'neutral'}>{lineList(lines.rush)}</b></li>
      </ul> : <p className="qbr-wait">{week ? `Week ${week}'s` : "This week's"} injury report isn't out yet (it comes out Wednesday). Starters out
        on his line or {data.opponent.team}'s pass rush will show here.</p>}
    </div>
    <div className="qbr-section">
      <h3>{data.opponent.team} defense against quarterbacks</h3>
      <ul className="qbr-defense">
        {DEFENSE.map(([key, label, show, moreHelps, aside, words]) => {
          const cell = data.opponent[key], normal = data.league?.[key];
          if (!cell) return <li key={key}><span>{label}</span><b>—</b><i data-tone="neutral">Not enough games yet</i></li>;
          return <li key={key}><span>{label}{aside && <small>{aside}</small>}</span><b>{show(cell[0])}</b>
            <i data-tone={rankTone(cell[1], count, moreHelps)}>{rankWords(cell[1], count, 10, words)}{normal != null && <small>league {show(normal)}</small>}</i></li>;
        })}
      </ul>
    </div>
    {data.opponent.log?.length > 0 && <details className="qbr-games">
      <summary>{data.opponent.team} against quarterbacks <small>game by game</small><ChevronDown size={14} aria-hidden="true"/></summary>
      <div className="qbr-table qbr-table-fit" tabIndex={0} role="region" aria-label={`${data.opponent.team} against quarterbacks game by game`}>
        <table>
          <thead><tr><th>Wk</th><th>Quarterback</th><th title="Rushing yards, kneel-downs left out">Rush yds</th>
            <th title="What he runs for in his other games">Usual</th><th title="This game over his usual">vs usual</th><th title="Scrambles and designed runs">Runs</th></tr></thead>
          <tbody>{[...data.opponent.log].reverse().map(game => <tr key={`${game.week}-${game.qbId}`}>
            <td>{game.week}</td><td>{game.qb || game.offense}<small> {game.offense}</small></td><td>{game.rushYards}</td>
            <td>{game.usual == null ? '—' : one(game.usual)}</td>
            <td data-tone={game.usual == null ? 'neutral' : game.rushYards - game.usual >= 5 ? 'good' : game.rushYards - game.usual <= -5 ? 'poor' : 'neutral'}>{game.usual == null ? '—' : signed(game.rushYards - game.usual)}</td>
            <td>{game.scrambles + game.designed}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>}
    <details className="qbr-games">
      <summary>{name}'s games <small>{me.games} {me.games === 1 ? 'game' : 'games'}</small><ChevronDown size={14} aria-hidden="true"/></summary>
      <div className="qbr-table" tabIndex={0} role="region" aria-label={`${row.player}'s runs game by game; scroll for more`}>
        <table>
          <thead><tr><th>Wk</th><th>Opp</th><th title="Scrambles">Scr</th><th title="Scramble yards">Scr yds</th><th title="Designed runs (sneaks)">Designed</th>
            <th title="Designed run yards">Des yds</th><th title="Kneel-downs (yards)">Kneels</th><th title="Times pressured (Pro Football Reference)">Pressured</th><th title="Sacked">Sacked</th></tr></thead>
          <tbody>{[...me.rows].reverse().map(game => <tr key={game.week}>
            <td>{game.week}</td><td>{game.opponent}</td><td>{game.scrambles}</td><td>{game.scrambleYards}</td>
            <td>{game.designed}{game.sneaks ? <small> ({game.sneaks} sneak{game.sneaks === 1 ? '' : 's'})</small> : null}</td><td>{game.designedYards}</td>
            <td>{game.kneels ? `${game.kneels} (${yards(game.kneelYards)})` : 0}</td><td>{game.pressured ?? '—'}</td><td>{game.sacked ?? game.sacks}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>
    <p className="qbr-foot">Scrambles are dropbacks he ran on; designed runs are called runs, QB sneaks included. Kneel-downs count in his
      rushing (and settle the line) but aren't running. Close: within one score at the snap. Pressures and sacks: Pro Football Reference.
      Blitzes: FTN charting. Up front: the week's injury report (out or doubtful) against the depth chart's starters.</p>
  </>);
}
