// The public record at /results (results.html): Ace Props' Elite and Strong
// picks over the last 30 days, settled from the final box score
// (slip_ledger.public_results). Anyone can open it -- it's the link for a bio
// or a post -- so it loads on its own, without the app.
import './results-page.css';
import {LEAGUE_LOGOS} from './league-logos.js';

const SPORT_NAMES = {nfl: 'NFL', nba: 'NBA', wnba: 'WNBA', mlb: 'MLB', nhl: 'NHL', soccer: 'Soccer'};
const TIER_NAMES = {elite: 'Elite', strong: 'Strong'};
// Fewer settled picks than this and the page says the sample is still small.
const SMALL = 30;

function h(tag, props = {}, ...children) {
 const node = document.createElement(tag);
 for (const [key, value] of Object.entries(props)) {
  if (value == null || value === false) continue;
  if (key === 'className') node.className = value; else if (key === 'text') node.textContent = value;
  else if (key === 'style') node.setAttribute('style', value);
  else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value); else node.setAttribute(key, value === true ? '' : value);
 }
 node.append(...children.flat().filter(child => child != null && child !== false));
 return node;
}
const pct = rate => rate == null ? '—' : `${Math.round(rate * 100)}%`;
const figure = value => value == null ? '' : Number.isInteger(value) ? String(value) : Number(value).toFixed(1);
const record = counts => `${counts.hits}–${counts.misses}`;
const dayLabel = iso => new Date(`${iso}T12:00:00`).toLocaleDateString([], {month: 'short', day: 'numeric'});

function header() {
 return h('header', {className: 'rp-head'},
  h('a', {href: '/', className: 'rp-brand', 'aria-label': 'Ace Props home'}, h('img', {src: '/brand/ace-props-wordmark.png', alt: 'Ace Props', width: '126', height: '48'})),
  h('a', {href: '/sign-up', className: 'rp-cta-small'}, 'Get every pick'));
}

function tierCard(tier, counts) {
 return h('article', {className: 'rp-tier', 'data-tier': tier},
  h('span', {className: 'rp-tier-name', text: TIER_NAMES[tier]}),
  h('strong', {className: 'rp-tier-rate', text: pct(counts.rate)}),
  h('span', {className: 'rp-tier-record', text: counts.picks ? `${record(counts)} · ${counts.picks} pick${counts.picks === 1 ? '' : 's'}` : 'No settled picks yet'}),
  h('i', {className: 'rp-bar', 'aria-hidden': 'true'}, h('i', {style: `width:${Math.round((counts.rate || 0) * 100)}%`})));
}

function sportsRow(sports) {
 const keys = Object.keys(sports);
 if (!keys.length) return null;
 return h('section', {className: 'rp-section', 'aria-labelledby': 'rp-sports'},
  h('h2', {id: 'rp-sports', text: 'By sport'}),
  h('div', {className: 'rp-sports'}, keys.map(key => h('div', {className: 'rp-sport'},
   h('img', {src: LEAGUE_LOGOS[key], alt: '', width: '22', height: '22'}),
   h('span', {className: 'rp-sport-name', text: SPORT_NAMES[key] || key.toUpperCase()}),
   h('b', {text: pct(sports[key].rate)}), h('small', {text: record(sports[key])})))));
}

function dailyChart(days) {
 const shown = days.filter(day => day.picks);
 if (!shown.length) return null;
 const most = Math.max(...days.map(day => day.picks), 1);
 return h('section', {className: 'rp-section', 'aria-labelledby': 'rp-daily'},
  h('h2', {id: 'rp-daily', text: 'Day by day'}),
  h('div', {className: 'rp-daily', role: 'img', 'aria-label': shown.map(day => `${dayLabel(day.day)}: ${record(day)}`).join(', ')},
   days.map(day => h('div', {className: 'rp-day', title: day.picks ? `${dayLabel(day.day)}: ${record(day)}` : dayLabel(day.day)},
    h('div', {className: 'rp-day-bars'},
     h('i', {className: 'rp-hit', style: `height:${day.hits / most * 100}%`}),
     h('i', {className: 'rp-miss', style: `height:${day.misses / most * 100}%`})),
    h('small', {text: dayLabel(day.day).replace(/^\w+ /, '')})))),
  h('p', {className: 'rp-legend'}, h('i', {className: 'rp-hit'}), 'Hit', h('i', {className: 'rp-miss'}), 'Miss'));
}

function recentList(recent) {
 if (!recent.length) return null;
 return h('section', {className: 'rp-section', 'aria-labelledby': 'rp-recent'},
  h('h2', {id: 'rp-recent', text: 'Latest results'}),
  h('ol', {className: 'rp-picks'}, recent.map(pick => h('li', {className: 'rp-pick', 'data-result': pick.result},
   h('span', {className: 'rp-face'}, h('i', {text: String(pick.player || '?').split(' ').map(part => part[0]).join('').slice(0, 2)}),
    pick.headshot ? h('img', {src: pick.headshot, alt: '', loading: 'lazy', onError: event => event.currentTarget.remove()}) : null),
   h('div', {className: 'rp-pick-main'},
    h('b', {text: pick.player}),
    h('span', {text: `${pick.side === 'UNDER' ? 'Under' : 'Over'} ${figure(pick.line)} ${pick.stat}`}),
    h('small', {text: [SPORT_NAMES[pick.sport], pick.team && pick.opponent ? `${pick.team} vs ${pick.opponent}` : pick.team, dayLabel(pick.day), TIER_NAMES[pick.tier]].filter(Boolean).join(' · ')})),
   h('div', {className: 'rp-pick-result'},
    h('span', {className: 'rp-chip', text: pick.result === 'hit' ? 'Hit' : 'Miss'}),
    pick.value != null ? h('small', {text: `Finished ${figure(pick.value)}`}) : null)))));
}

function render(root, data) {
 const all = data.all || {hits: 0, misses: 0, picks: 0, rate: null};
 const small = all.picks < SMALL;
 root.replaceChildren(
  header(),
  h('section', {className: 'rp-hero'},
   h('p', {className: 'rp-eyebrow', text: `Last ${data.days} days`}),
   h('h1', {}, 'Our record'),
   h('p', {className: 'rp-lede', text: 'Every Elite and Strong pick, graded before the game and settled from the final box score. Wins and losses, nothing hidden.'}),
   h('div', {className: 'rp-overall'},
    h('strong', {text: pct(all.rate)}),
    h('span', {text: all.picks ? `${record(all)} on ${all.picks} Elite and Strong pick${all.picks === 1 ? '' : 's'}` : 'The first results are being settled'})),
   small && all.picks ? h('p', {className: 'rp-note', text: `Still a small sample (${all.picks} picks), so expect this to move as more games settle.`}) : null),
  h('div', {className: 'rp-tiers'}, ['elite', 'strong'].map(tier => tierCard(tier, data.tiers?.[tier] || {hits: 0, misses: 0, picks: 0, rate: null}))),
  sportsRow(data.sports || {}),
  dailyChart(data.daily || []),
  recentList(data.recent || []),
  h('section', {className: 'rp-join'},
   h('h2', {text: 'Get every pick before the game'}),
   h('p', {text: 'The Finder, research on every line, the Parlay Builder and the Slip Analyzer, for NBA, WNBA, MLB, NFL, NHL and soccer.'}),
   h('a', {href: '/sign-up', className: 'rp-cta'}, 'Join Ace Props'),
   h('a', {href: '/', className: 'rp-link'}, 'Already a member? Open Ace Props')),
  h('footer', {className: 'rp-foot'},
   h('p', {text: 'Results are updated through the day as games finish. Past results don’t guarantee future ones. For adults 21+ where legal. Play responsibly.'}),
   h('small', {text: `Updated ${new Date(data.at).toLocaleString([], {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})}`})));
 root.removeAttribute('aria-busy');
}

async function load() {
 const root = document.getElementById('results-root');
 try {
  const response = await fetch('/api/session?action=results', {credentials: 'omit'});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'unavailable');
  render(root, data);
 } catch {
  root.replaceChildren(header(), h('section', {className: 'rp-hero'}, h('h1', {}, 'Our record'),
   h('p', {className: 'rp-lede', text: 'The record couldn’t load right now. Try again in a minute.'}),
   h('button', {type: 'button', className: 'rp-cta', onClick: () => location.reload()}, 'Try again')));
  root.removeAttribute('aria-busy');
 }
}
load();
