// The public record at /results (results.html): the picks the admin posts
// (Admin › Record) over the last 30 days, settled from the final box score
// (slip_ledger.public_results). Anyone can open it -- it's the link for a bio
// or a post -- so it loads on its own, without the app. Its numbers count up
// and its charts build themselves as they scroll into view.
import './results-page.css';
import {LEAGUE_LOGOS} from './league-logos.js';

const SPORT_NAMES = {nfl: 'NFL', nba: 'NBA', wnba: 'WNBA', mlb: 'MLB', nhl: 'NHL', soccer: 'Soccer'};
const TIER_NAMES = {elite: 'Elite', strong: 'Strong', lean: 'Lean', risky: 'Risky', fade: 'Fade'};
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
const signed = value => value > 0 ? `+${value}` : String(value);
const dayLabel = iso => new Date(`${iso}T12:00:00`).toLocaleDateString([], {month: 'short', day: 'numeric'});
const initials = name => String(name || '?').split(' ').map(part => part[0]).join('').slice(0, 2);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// ---------------------------------------------------------------- motion
// Numbers count up and charts build themselves as they come into view; with
// reduced motion everything is simply there.
const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function onSeen(node, run) {
 if (calm() || typeof IntersectionObserver !== 'function') { run(); return; }
 const watch = new IntersectionObserver(entries => {
  if (!entries.some(entry => entry.isIntersecting)) return;
  watch.disconnect(); run();
 }, {threshold: 0.25});
 watch.observe(node);
}

function countUp(node, to, format, ms = 1200) {
 if (to == null || calm()) { node.textContent = format(to); return; }
 const start = performance.now();
 const step = now => {
  const k = Math.min(1, (now - start) / ms);
  node.textContent = format(to * (1 - (1 - k) ** 3));
  if (k < 1) requestAnimationFrame(step);
 };
 node.textContent = format(0);
 requestAnimationFrame(step);
}
// A count shown whole all the way up; a rate as a whole percent.
const whole = value => String(Math.round(value || 0));
const percent = value => value == null ? '—' : `${Math.round(value * 100)}%`;
// What a counting number shows before it's seen: its start, or with reduced motion its value.
const before = (value, format) => format(calm() || value == null ? value : 0);

// One tooltip for every chart on the page.
const tip = h('div', {className: 'rp-tip', role: 'tooltip', hidden: true});
function showTip(lines, x, y) {
 tip.replaceChildren(...lines.map(([text, strong]) => h(strong ? 'b' : 'span', {text})));
 tip.hidden = false;
 const box = tip.getBoundingClientRect();
 tip.style.left = `${Math.max(8, Math.min(innerWidth - box.width - 8, x - box.width / 2))}px`;
 tip.style.top = `${Math.max(8, y - box.height - 10)}px`;
}
const hideTip = () => { tip.hidden = true; };
addEventListener('scroll', hideTip, {passive: true});

// ---------------------------------------------------------------- pieces

function header() {
 return h('header', {className: 'rp-head'},
  h('a', {href: '/', className: 'rp-brand', 'aria-label': 'Ace Props home'}, h('img', {src: '/brand/ace-props-wordmark.png', alt: 'Ace Props', width: '126', height: '48'})),
  h('a', {href: '/sign-up', className: 'rp-cta-small'}, 'Get every pick'));
}

const SVG = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, ...children) {
 const node = document.createElementNS(SVG, tag);
 for (const [key, value] of Object.entries(attrs)) if (value != null) node.setAttribute(key, value);
 node.append(...children.filter(Boolean));
 return node;
}

// The hero: the hit rate inside a ring that sweeps round to it, and the record counting up beneath.
function hero(data, all) {
 const R = 92, C = 2 * Math.PI * R;
 const arc = svg('circle', {cx: 110, cy: 110, r: R, class: 'rp-ring-fill', 'stroke-dasharray': C});
 arc.style.strokeDashoffset = String(calm() ? C * (1 - (all.rate || 0)) : C);
 const rate = h('strong', {text: before(all.rate, percent)});
 const hits = h('b', {text: before(all.hits, whole)}), misses = h('b', {text: before(all.misses, whole)});
 const ring = h('div', {className: 'rp-ring', role: 'img', 'aria-label': all.picks ? `${pct(all.rate)} hit rate, ${record(all)} on ${plural(all.picks, 'pick')}` : 'No settled picks yet'},
  svg('svg', {viewBox: '0 0 220 220', 'aria-hidden': 'true'}, svg('circle', {cx: 110, cy: 110, r: R, class: 'rp-ring-track'}), arc),
  h('div', {className: 'rp-ring-text', 'aria-hidden': 'true'}, rate, h('small', {text: 'hit rate'})));
 const overall = h('div', {className: 'rp-overall'}, ring,
  h('p', {className: 'rp-record'}, all.picks ? [hits, h('span', {text: '–'}), misses, h('em', {text: ` on ${plural(all.picks, 'pick')}`})] : 'The first results are being settled'));
 onSeen(ring, () => {
  countUp(rate, all.rate, percent, 1400);
  countUp(hits, all.hits, whole, 1400); countUp(misses, all.misses, whole, 1400);
  requestAnimationFrame(() => { arc.style.strokeDashoffset = String(C * (1 - (all.rate || 0))); });
 });
 return overall;
}

function tierCard(tier, counts) {
 const value = h('strong', {className: 'rp-tier-rate', text: before(counts.rate, percent)});
 const fill = h('i', {style: `width:${calm() ? Math.round((counts.rate || 0) * 100) : 0}%`});
 const card = h('article', {className: 'rp-tier', 'data-tier': tier},
  h('span', {className: 'rp-tier-name', text: TIER_NAMES[tier]}),
  value,
  h('span', {className: 'rp-tier-record', text: counts.picks ? `${record(counts)} · ${plural(counts.picks, 'pick')}` : 'No settled picks yet'}),
  h('i', {className: 'rp-bar', 'aria-hidden': 'true'}, fill));
 onSeen(card, () => { countUp(value, counts.rate, percent); requestAnimationFrame(() => { fill.style.width = `${Math.round((counts.rate || 0) * 100)}%`; }); });
 return card;
}

// The tiers with settled picks, best first; Elite and Strong before there are any.
function shownTiers(tiers) {
 const used = Object.keys(TIER_NAMES).filter(tier => tiers[tier]?.picks);
 return used.length ? used : ['elite', 'strong'];
}

function sportsRow(sports) {
 const keys = Object.keys(sports).sort((a, b) => sports[b].picks - sports[a].picks);
 if (!keys.length) return null;
 return h('section', {className: 'rp-section', 'aria-labelledby': 'rp-sports'},
  h('h2', {id: 'rp-sports', text: 'By sport'}),
  h('div', {className: 'rp-sports'}, keys.map(key => {
   const value = h('b', {text: before(sports[key].rate, percent)});
   const fill = h('i', {style: `width:${calm() ? Math.round((sports[key].rate || 0) * 100) : 0}%`});
   const card = h('div', {className: 'rp-sport'},
    h('img', {src: LEAGUE_LOGOS[key], alt: '', width: '28', height: '28'}),
    h('span', {className: 'rp-sport-name', text: SPORT_NAMES[key] || key.toUpperCase()}),
    value, h('small', {text: `${record(sports[key])} · ${plural(sports[key].picks, 'pick')}`}),
    h('i', {className: 'rp-bar', 'aria-hidden': 'true'}, fill));
   onSeen(card, () => { countUp(value, sports[key].rate, percent); requestAnimationFrame(() => { fill.style.width = `${Math.round((sports[key].rate || 0) * 100)}%`; }); });
   return card;
  })));
}

// How the record built up: hits minus misses so far, day by day, drawn as a
// line that writes itself across the chart. Hover or arrow keys read any day.
function runningChart(points) {
 if (points.length < 2) return null;
 const net = points.map(point => point.hits - point.misses);
 const last = points[points.length - 1];
 const box = h('div', {className: 'rp-run', tabindex: '0', role: 'img',
  'aria-label': `Hits minus misses by day, from ${signed(net[0])} on ${dayLabel(points[0].day)} to ${signed(net[net.length - 1])} on ${dayLabel(last.day)}`});
 let seen = false, width = 0, focus = -1;
 const draw = animate => {
  width = box.clientWidth;
  if (!width) return;
  const H = 210, left = 30, right = 46, top = 18, bottom = 26;
  const plotW = width - left - right, plotH = H - top - bottom;
  const low = Math.min(0, ...net), high = Math.max(1, ...net);
  const x = i => left + i * plotW / (net.length - 1);
  const y = v => top + (high - v) * plotH / (high - low);
  const line = net.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const path = svg('path', {d: line, class: 'rp-run-line'});
  const area = svg('path', {d: `${line}L${x(net.length - 1).toFixed(1)},${y(0)}L${x(0)},${y(0)}Z`, class: 'rp-run-area'});
  const end = svg('circle', {cx: x(net.length - 1), cy: y(net[net.length - 1]), r: 5, class: 'rp-run-end'});
  const endLabel = svg('text', {x: x(net.length - 1) + 10, y: y(net[net.length - 1]) + 4, class: 'rp-run-label'}, document.createTextNode(signed(net[net.length - 1])));
  const cross = svg('line', {y1: top, y2: H - bottom, class: 'rp-run-cross', visibility: 'hidden'});
  const dot = svg('circle', {r: 5, class: 'rp-run-dot', visibility: 'hidden'});
  const chart = svg('svg', {width, height: H, viewBox: `0 0 ${width} ${H}`, 'aria-hidden': 'true'},
   svg('line', {x1: left, x2: width - right, y1: y(high), y2: y(high), class: 'rp-run-grid'}),
   svg('line', {x1: left, x2: width - right, y1: y(0), y2: y(0), class: 'rp-run-zero'}),
   svg('text', {x: left - 8, y: y(high) + 4, class: 'rp-run-axis', 'text-anchor': 'end'}, document.createTextNode(signed(high))),
   svg('text', {x: left - 8, y: y(0) + 4, class: 'rp-run-axis', 'text-anchor': 'end'}, document.createTextNode('0')),
   low < 0 ? svg('text', {x: left - 8, y: y(low) + 4, class: 'rp-run-axis', 'text-anchor': 'end'}, document.createTextNode(signed(low))) : null,
   svg('text', {x: left, y: H - 6, class: 'rp-run-axis'}, document.createTextNode(dayLabel(points[0].day))),
   svg('text', {x: width - right, y: H - 6, class: 'rp-run-axis', 'text-anchor': 'end'}, document.createTextNode(dayLabel(last.day))),
   area, path, cross, end, endLabel, dot);
  box.replaceChildren(chart);
  const point = i => {
   focus = i;
   cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
   dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(net[i])); dot.setAttribute('visibility', 'visible');
   const frame = chart.getBoundingClientRect();
   showTip([[`${signed(net[i])}`, true], [`${record(points[i])} · ${dayLabel(points[i].day)}`]], frame.left + x(i), frame.top + y(net[i]));
  };
  const clear = () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); hideTip(); };
  chart.addEventListener('pointermove', event => {
   const frame = chart.getBoundingClientRect();
   point(Math.max(0, Math.min(net.length - 1, Math.round((event.clientX - frame.left - left) / plotW * (net.length - 1)))));
  });
  chart.addEventListener('pointerleave', clear);
  box.onfocus = () => point(focus < 0 ? net.length - 1 : focus);
  box.onblur = clear;
  box.onkeydown = event => {
   if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
   event.preventDefault(); point(Math.max(0, Math.min(net.length - 1, (focus < 0 ? net.length - 1 : focus) + (event.key === 'ArrowLeft' ? -1 : 1))));
  };
  if (calm() || (!animate && seen)) return;
  // Build it: the line writes itself, then the wash, the end dot and its number.
  const length = path.getTotalLength();
  path.style.strokeDasharray = `${length}`; path.style.strokeDashoffset = `${length}`;
  area.style.opacity = '0'; end.style.opacity = '0'; endLabel.style.opacity = '0';
  if (!animate) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
   box.classList.add('rp-run-go');
   path.style.strokeDashoffset = '0'; area.style.opacity = ''; end.style.opacity = ''; endLabel.style.opacity = '';
  }));
 };
 if (typeof ResizeObserver === 'function') new ResizeObserver(() => { if (box.clientWidth !== width) draw(false); }).observe(box);
 onSeen(box, () => { seen = true; draw(true); });
 const table = h('details', {className: 'rp-table'}, h('summary', {text: 'See the numbers'}),
  h('table', {}, h('thead', {}, h('tr', {}, h('th', {text: 'Day'}), h('th', {text: 'Record so far'}), h('th', {text: 'Hits minus misses'}))),
   h('tbody', {}, points.map((point, i) => h('tr', {}, h('td', {text: dayLabel(point.day)}), h('td', {text: record(point)}), h('td', {text: signed(net[i])}))).reverse())));
 return h('section', {className: 'rp-section', 'aria-labelledby': 'rp-run'},
  h('div', {className: 'rp-section-head'}, h('h2', {id: 'rp-run', text: 'How the record built up'}),
   h('p', {text: `Hits minus misses, every settled pick · ${record(last)} now`})),
  h('div', {className: 'rp-card'}, box), table);
}

const RESULT_NAMES = {hit: 'Hit', miss: 'Miss', push: 'Push', void: 'Void'};
const dropImage = event => event.currentTarget.remove();
// A headshot is see-through around the player, so his initials step aside once it's in.
const photoIn = event => event.currentTarget.parentElement.classList.add('rp-has-photo');
const logo = (src, label) => src ? h('img', {className: 'rp-logo', src, alt: label || '', width: '16', height: '16', loading: 'lazy', onError: dropImage}) : null;

// The player's photo (his initials until it loads, or when there isn't one) with his team's logo on its corner.
function face(pick) {
 return h('span', {className: 'rp-face-wrap'},
  h('span', {className: 'rp-face'}, h('i', {text: initials(pick.player)}),
   pick.headshot ? h('img', {src: pick.headshot, alt: '', loading: 'lazy', onLoad: photoIn, onError: dropImage}) : null),
  pick.teamLogo ? h('img', {className: 'rp-face-team', src: pick.teamLogo, alt: '', width: '20', height: '20', loading: 'lazy', onError: dropImage}) : null);
}

function matchup(pick, inSlip) {
 const parts = [];
 if (pick.team) parts.push(h('span', {className: 'rp-team'}, logo(pick.teamLogo), pick.team));
 if (pick.team && pick.opponent) parts.push(h('span', {className: 'rp-vs', text: 'vs'}));
 if (pick.opponent) parts.push(h('span', {className: 'rp-team'}, logo(pick.opponentLogo), pick.opponent));
 const rest = [SPORT_NAMES[pick.sport], inSlip ? null : dayLabel(pick.day), TIER_NAMES[pick.tier]].filter(Boolean).join(' · ');
 return h('small', {className: 'rp-matchup'}, parts, rest ? h('span', {className: 'rp-meta', text: rest}) : null);
}

function reveal(node) {
 if (calm()) return node;
 node.classList.add('rp-reveal');
 onSeen(node, () => node.classList.add('rp-in'));
 return node;
}

function pickRow(pick, inSlip) {
 const row = h('li', {className: 'rp-pick', 'data-result': pick.result},
  face(pick),
  h('div', {className: 'rp-pick-main'},
   h('b', {text: pick.player}),
   h('span', {text: `${pick.side === 'UNDER' ? 'Under' : 'Over'} ${figure(pick.line)} ${pick.stat}`}),
   matchup(pick, inSlip)),
  h('div', {className: 'rp-pick-result'},
   h('span', {className: 'rp-chip', text: RESULT_NAMES[pick.result] || pick.result}),
   pick.value != null ? h('small', {text: `Finished ${figure(pick.value)}`}) : null));
 return inSlip ? row : reveal(row);
}

// A slip's picks stay together under the slip, won or lost; a pick posted on its own stands alone.
function slipCard(item) {
 const n = item.picks.length;
 return reveal(h('li', {className: 'rp-slip', 'data-status': item.status},
  h('header', {className: 'rp-slip-head'},
   h('span', {className: 'rp-stack', 'aria-hidden': 'true'}, item.picks.slice(0, 4).map(pick => h('span', {className: 'rp-face rp-face-mini'},
    h('i', {text: initials(pick.player)}), pick.headshot ? h('img', {src: pick.headshot, alt: '', loading: 'lazy', onLoad: photoIn, onError: dropImage}) : null))),
   h('div', {}, h('b', {text: `${n}-pick ${item.app ? `${item.app} ` : ''}slip`}), h('small', {text: dayLabel(item.day)})),
   h('span', {className: 'rp-chip', text: item.status === 'won' ? 'Won' : item.status === 'lost' ? 'Lost' : 'Void'})),
  h('ol', {className: 'rp-picks'}, item.picks.map(pick => pickRow(pick, true)))));
}

function recentList(latest) {
 if (!latest.length) return null;
 return h('section', {className: 'rp-section', 'aria-labelledby': 'rp-recent'},
  h('h2', {id: 'rp-recent', text: 'Latest results'}),
  h('ol', {className: 'rp-picks'}, latest.map(item => item.slip ? slipCard(item) : pickRow(item.picks[0]))));
}

function render(root, data) {
 const all = data.all || {hits: 0, misses: 0, picks: 0, rate: null};
 const small = all.picks < SMALL;
 root.replaceChildren(
  header(),
  h('section', {className: 'rp-hero'},
   h('p', {className: 'rp-eyebrow', text: `Last ${data.days} days`}),
   h('h1', {}, 'Our record'),
   h('p', {className: 'rp-lede', text: 'Every pick we post, made before the game and settled from the final box score. Wins and losses, nothing hidden.'}),
   hero(data, all),
   data.slips?.slips ? h('p', {className: 'rp-slips'}, h('b', {text: `${data.slips.won}–${data.slips.lost}`}),
    ` in slips · ${pct(data.slips.rate)} cashed`) : null,
   small && all.picks ? h('p', {className: 'rp-note', text: `Still a small sample (${all.picks} picks), so expect this to move as more games settle.`}) : null),
  h('div', {className: 'rp-tiers'}, shownTiers(data.tiers || {}).map(tier => tierCard(tier, data.tiers?.[tier] || {hits: 0, misses: 0, picks: 0, rate: null}))),
  runningChart(data.running || []),
  sportsRow(data.sports || {}),
  recentList(data.latest || []),
  h('section', {className: 'rp-join'},
   h('h2', {text: 'Get every pick before the game'}),
   h('p', {text: 'The Finder, research on every line, the Parlay Builder and the Slip Analyzer, for NBA, WNBA, MLB, NFL, NHL and soccer.'}),
   h('a', {href: '/sign-up', className: 'rp-cta'}, 'Join Ace Props'),
   h('a', {href: '/', className: 'rp-link'}, 'Already a member? Open Ace Props')),
  h('footer', {className: 'rp-foot'},
   h('p', {text: 'Results are updated through the day as games finish. Past results don’t guarantee future ones. For adults 21+ where legal. Play responsibly.'}),
   h('small', {text: `Updated ${new Date(data.at).toLocaleString([], {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})}`})),
  tip);
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
