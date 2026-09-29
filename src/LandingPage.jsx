import React from 'react';
import { ArrowRight, ChevronDown, Search, SearchCheck, Star } from 'lucide-react';
import { SparklesBackground } from './SparklesBackground';
import { LEAGUE_LOGOS } from './league-logos';
import './landing-page.css';

// The Finder board as it looks signed in, drawn as a still preview: sample
// lines with their hit rates over the last 5, 10 and 20 games, head to head
// and this season. Tones follow the Finder's own (70%+ / 45-69% / under 45%).
const PREVIEW = [
  { name: "Ja'Marr Chase", pos: 'WR', team: 'CIN', league: 'nfl', line: 6.5, stat: 'Receptions', cells: [[4, 5], [8, 10], [15, 20], [3, 3], [3, 4]] },
  { name: 'Aaron Judge', pos: 'RF', team: 'NYY', league: 'mlb', line: 1.5, stat: 'Total Bases', cells: [[3, 5], [7, 10], [13, 20], [4, 6], [88, 152]] },
  { name: 'Caitlin Clark', pos: 'G', team: 'IND', league: 'wnba', line: 7.5, stat: 'Assists', cells: [[4, 5], [7, 10], [14, 20], [2, 2], [21, 31]] },
  { name: 'Josh Allen', pos: 'QB', team: 'BUF', league: 'nfl', line: 1.5, stat: 'Pass TDs', cells: [[3, 5], [7, 10], [13, 20], [1, 2], [3, 4]] },
  { name: 'Bijan Robinson', pos: 'RB', team: 'ATL', league: 'nfl', line: 84.5, stat: 'Rush Yards', cells: [[2, 5], [5, 10], [9, 20], [1, 3], [2, 4]] },
  { name: 'Shohei Ohtani', pos: 'DH', team: 'LAD', league: 'mlb', line: 0.5, stat: 'Home Runs', cells: [[2, 5], [3, 10], [7, 20], [1, 4], [49, 155]] },
];
const COLUMNS = ['L5', 'L10', 'L20', 'H2H', 'SZN'];
const tone = (hits, games) => {
  const rate = hits / games;
  return rate >= 0.7 ? 'good' : rate >= 0.45 ? 'mid' : 'low';
};
const initials = (name) => name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase();
// A league's mark, left out if it can't load.
const LeagueMark = ({ league, size }) => (
  <img src={LEAGUE_LOGOS[league]} alt="" width={size} height={size} onError={(event) => { event.currentTarget.hidden = true; }} />
);

function FinderPreview() {
  return (
    <div className="kd-preview" aria-hidden="true">
      <div className="kd-preview-top">
        <span className="kd-preview-mark"><SearchCheck size={16} /></span>
        <strong>Finder</strong>
        <span className="kd-preview-slash">/</span>
        <span className="kd-preview-leagues">
          {['mlb', 'nfl', 'wnba'].map((league) => <LeagueMark key={league} league={league} size={16} />)}
          All sports
        </span>
      </div>
      <div className="kd-preview-controls">
        <span className="kd-preview-search"><Search size={14} />Search players or teams…</span>
        {['All lines', 'All stats', 'All games', 'Hit Rate'].map((label) => (
          <span key={label} className="kd-preview-select">{label}<ChevronDown size={13} /></span>
        ))}
      </div>
      <div className="kd-preview-table">
        <div className="kd-preview-row kd-preview-head">
          <span>Line</span>
          {COLUMNS.map((column) => <span key={column} data-column={column} data-sorted={column === 'L10' || undefined}>{column}</span>)}
        </div>
        {PREVIEW.map((row) => (
          <div className="kd-preview-row" key={row.name + row.stat}>
            <span className="kd-preview-player">
              <span className="kd-preview-avatar">{initials(row.name)}<i><Star size={9} /></i></span>
              <span className="kd-preview-lines">
                <b>{row.name} <small>({row.pos})</small></b>
                <span className="kd-preview-stat"><LeagueMark league={row.league} size={13} /><span><em>{row.line}</em> {row.stat}</span></span>
                <small>{row.team}</small>
              </span>
            </span>
            {row.cells.map(([hits, games], index) => (
              <span key={COLUMNS[index]} className="kd-preview-heat" data-tone={tone(hits, games)} data-column={COLUMNS[index]}>
                <strong>{Math.round((hits / games) * 100)}%</strong>
                <small>{hits}/{games}</small>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// The site's front door for anyone signed out (see site-access.js
// renderLanding); the sign-in and sign-up forms open from its buttons.
export function LandingPage({ onSignUp, onSignIn }) {
  return (
    <div className="kd-landing">
      <SparklesBackground particleDensity={60} />
      <div className="kd-landing-glow" aria-hidden="true" />
      <header className="kd-landing-bar">
        <img src="/icons/krazy-data-wordmark.png" width={146} height={26} alt="Krazy Data" />
        <nav aria-label="Account">
          <button type="button" className="kd-button kd-button-quiet" onClick={onSignIn}>Sign in</button>
          <button type="button" className="kd-button kd-button-primary" onClick={onSignUp}>Sign up</button>
        </nav>
      </header>

      <main className="kd-landing-main">
        <section className="kd-landing-hero">
          <p className="kd-landing-sports">
            {['mlb', 'nfl', 'wnba'].map((league) => <LeagueMark key={league} league={league} size={18} />)}
            MLB · NFL · WNBA
          </p>
          <h1>Every prop.<span>Every hit rate.</span></h1>
          <p className="kd-landing-lede">
            The last 5, 10 and 20 games, head to head and this season, next to every line on the board.
          </p>
          <div className="kd-landing-actions">
            <button type="button" className="kd-button kd-button-primary kd-button-large" onClick={onSignUp}>
              Get started <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button type="button" className="kd-button kd-button-outline kd-button-large" onClick={onSignIn}>Sign in</button>
          </div>
        </section>
        <FinderPreview />
      </main>
    </div>
  );
}

export default LandingPage;
