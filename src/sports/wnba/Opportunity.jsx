// Opportunity: the chances behind a basketball line (opportunity.js) -- his
// minutes, usage and the shots, misses and teammates' baskets the stat
// comes from, tonight's pace and what the defense gives up, the NBA's own
// tracking, and how his chances change with teammates out tonight.
import React, {useMemo} from 'react';
import {Gauge} from 'lucide-react';
import {FinderResearchCard as Card} from '../../FinderResearchSections';
import {useIsAdmin} from '../../admin-notice.js';
import {projectStat} from '../../prop-model.js';
import {voice} from '../../prop-insight.js';
import {MARKET_STAT, baseMarket, opponentOf} from './wnba-research';
import {absences, gameRows, playerTiles, seasonsName, trackingTiles} from './opportunity';
import './opportunity.css';

// A tile's note is a few short facts (" · " between them); each gets its own line.
function Tile({label, value, unit, note}) {
  const lines = note ? note.split(' · ').filter(Boolean) : [];
  return <div className="bko-tile"><span>{label}</span><strong>{value}{unit && <small>{unit}</small>}</strong>
    {lines.length > 0 && <em>{lines.map(line => {
      // "Last 10: 34" reads as a small label and its number.
      const [, head, number] = line.match(/^(Last 10|Projected tonight):\s*(.+)$/) || [];
      return head ? <span key={line} className="bko-then">{head}<b>{number}</b></span> : <span key={line}>{line}</span>;
    })}</em>}</div>;
}

export default function Opportunity({row, player, league, matchup, tracking, statLabel}) {
  const admin = useIsAdmin();
  const stat = MARKET_STAT[baseMarket(row.marketKey)] || 'pts', opponent = opponentOf(row), name = row.sport === 'nba' ? 'nba' : 'wnba';
  const chances = player.data?.opportunity;
  const model = useMemo(() => { try { return projectStat(row); } catch { return null; } }, [row]);
  // A WNBA player in her own pronouns (prop-insight.js voice).
  const said = list => list.map(item => ({...item, label: voice(item.label, row), unit: voice(item.unit, row), note: voice(item.note, row)}));
  const tiles = useMemo(() => said(playerTiles(stat, chances, {projected: model?.unit === 'min' ? model.usage : null})), [stat, chances, model, row]);
  const tracked = useMemo(() => said(trackingTiles(stat, tracking?.data)), [stat, tracking?.data, row]);
  const game = useMemo(() => gameRows(stat, league.data?.opportunity, row.teamAbbr, opponent), [stat, league.data, row.teamAbbr, opponent]);
  const out = useMemo(() => absences(stat, matchup.data?.injuries?.[row.teamAbbr], player.data?.withWithout, statLabel || row.market),
    [stat, matchup.data, row.teamAbbr, player.data, statLabel, row.market]);
  if (!chances?.szn && !game.length) {
    if (player.loading || league.loading) return <Card title="Opportunity" icon={Gauge} className="bko-card"><p className="bko-wait">Loading his minutes, shots and chances…</p></Card>;
    return admin && (player.error || league.error) ? <Card title="Opportunity" icon={Gauge} className="bko-card"><p className="bko-wait">{player.error || league.error}</p></Card> : null;
  }
  const seasons = seasonsName(player.data?.seasons, name);
  const them = row.sport === 'wnba' ? 'her' : 'him';
  return <Card title="Opportunity" note={[chances?.szn ? `${chances.games} games` : null, seasons].filter(Boolean).join(' · ')} icon={Gauge} className="bko-card">
    {tiles.length > 0 && <div className="bko-section"><h3>{row.player}&rsquo;s chances</h3><div className="bko-tiles">{tiles.map(tile => <Tile key={tile.key} {...tile}/>)}</div></div>}
    {tracked.length > 0 && <div className="bko-section"><h3>NBA tracking · {tracking.data.season}</h3><div className="bko-tiles">{tracked.map(tile => <Tile key={tile.key} {...tile}/>)}</div></div>}
    {admin && row.sport === 'nba' && tracking?.error && <p className="bko-wait bko-admin">Admin: {tracking.error}</p>}
    {game.length > 0 && <div className="bko-section"><h3>Tonight&rsquo;s game</h3><ul className="bko-rows">{game.map(item => <li key={item.key}>
      <span>{item.label}</span><b>{item.value}</b>{item.note && <small>{item.note}</small>}<i data-tone={item.tone}>{item.words}{item.league && <small>{item.league}</small>}</i></li>)}</ul></div>}
    {out.length > 0 && <div className="bko-section"><h3>Teammates on tonight&rsquo;s injury report</h3><ul className="bko-out">{out.map(item => <li key={item.id || item.name}>
      <p><b>{item.name}</b> <span>{item.status}</span></p>
      {!item.known ? <em>No games together on record.</em> : !item.games ? <em>{row.player} hasn&rsquo;t played without {them} in these games.</em> : <>
        <em>Without {them}: {item.games} game{item.games === 1 ? '' : 's'}, and the change against games with {them}</em>
        <div className="bko-parts">{[...item.parts, ...(item.stat ? [item.stat] : [])].map(part => <span key={part.label}><small>{part.label}</small><b>{part.without}</b>{part.change && <i data-tone={part.change.startsWith('+') ? 'good' : part.change.startsWith('−') ? 'poor' : 'neutral'}>{part.change}</i>}</span>)}</div>
      </>}
    </li>)}</ul></div>}
  </Card>;
}
