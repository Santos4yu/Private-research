import { polishResearchCards } from './research-cards.js';

const tabs = [
  { key: 'overview', label: 'Overview', icon: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>' },
  { key: 'trend', label: 'Trend', icon: '<path d="M4 19V5m0 14h16M7 14l4-5 4 3 5-7"/><path d="M16 5h4v4"/>' },
  { key: 'matchup', label: 'Matchup', icon: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>' },
  { key: 'context', label: 'Context', icon: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6 6-2Z"/>' },
];
let selectedTab = 'overview';
let reportSequence = 0;

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

// Move the existing, populated sections rather than copying them: all event
// handlers, data-availability gates, chart nodes, and save state stay intact.
export function mountResearchTabs(report, prop) {
  const uid = `research-${++reportSequence}`;
  report.classList.add('rr-report');
  polishResearchCards(report);
  const header = report.querySelector('.report-header');
  const save = header.querySelector('.save-btn');
  const sticky = element('div', 'rr-sticky');
  const tablist = element('div', 'rr-tablist');
  tablist.setAttribute('role', 'tablist');
  tablist.setAttribute('aria-label', 'Research sections');
  const panels = new Map();
  const buttons = new Map();

  tabs.forEach(({ key, label, icon }) => {
    const button = element('button', 'rr-tab');
    button.type = 'button';
    button.id = `${uid}-tab-${key}`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', `${uid}-panel-${key}`);
    button.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg><span>${label}</span>`;
    tablist.append(button);
    buttons.set(key, button);
    const panel = element('div', 'rr-tab-panel');
    panel.id = `${uid}-panel-${key}`;
    panel.dataset.researchPanel = key;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', button.id);
    panel.tabIndex = 0;
    panels.set(key, panel);
  });

  const move = (selector, key) => {
    const block = report.querySelector(selector);
    if (block) panels.get(key).append(block);
  };
  const moveParent = (selector, key) => {
    const child = report.querySelector(selector);
    const block = child?.closest('.report-block');
    if (block) panels.get(key).append(block);
  };
  const disclose = (block, label, key) => {
    if (!block) return;
    const details = element('details', 'rr-disclosure');
    details.hidden = block.hidden;
    details.append(element('summary', '', label), block);
    panels.get(key).append(details);
  };

  move('.research-snapshot', 'overview');
  move('.biggest-grid', 'overview');
  move('.decision-panel', 'overview');
  move('.narrative-block', 'overview');

  const formBlock = element('section', 'report-block rr-recent-results');
  formBlock.append(element('h3', 'block-title', 'Recent results'));
  ['.hitrate-bars', '.last5-row'].forEach((selector) => {
    const chart = report.querySelector(selector);
    if (chart) formBlock.append(chart);
  });
  panels.get('trend').append(formBlock);
  disclose(report.querySelector('.why-list')?.closest('.report-block'), 'All supporting factors', 'overview');
  move('.alternate-props-block', 'overview');
  move('.form-ladder-block', 'trend');
  move('.projection-block', 'trend');
  moveParent('.split-grid', 'trend');
  moveParent('.perf-season', 'trend');

  moveParent('.matchup-score-card', 'matchup');
  move('.arsenal-block', 'matchup');
  move('.pitcher-lineup-profile', 'matchup');
  move('.k-path-block', 'matchup');
  moveParent('.vs-career', 'matchup');

  const riskContent = report.querySelector('.risk-list')?.parentElement;
  if (riskContent) {
    const risks = element('section', 'report-block rr-risk-details');
    risks.append(riskContent);
    disclose(risks, 'All risk signals', 'overview');
  }
  const environment = report.querySelector('.env-text')?.closest('.report-block');
  if (environment) { environment.classList.add('rr-environment'); panels.get('context').append(environment); }
  move('.opportunity-block', 'context');
  move('.playability-block', 'context');
  move('.research-health-block', 'context');
  move('.model-confirm', 'context');

  const verdict = header.querySelector('.verdict-strip');
  if (verdict) { verdict.classList.add('rr-verdict'); panels.get('overview').prepend(verdict); }
  const sizing = header.querySelector('.unit-row');
  if (sizing) { const block = element('section', 'report-block rr-sizing'); block.append(sizing); panels.get('context').append(block); }
  const footer = element('footer', 'rr-save-dock');
  const copy = element('div', 'rr-save-copy');
  copy.append(element('strong', '', prop.player), element('span', '', `${prop.side} ${prop.line} ${prop.betType}`));
  footer.append(save);
  save.setAttribute('aria-label', `Add ${prop.player} ${prop.side} ${prop.line} ${prop.betType} to My Slip`);
  header.querySelector('.report-actions-row')?.remove();
  header.querySelector('.rt-title').textContent = prop.player;
  const line = element('p', 'rr-prop-line', `${prop.side} ${prop.line} ${prop.betType}`);
  header.querySelector('.rt-title').after(line);
  header.append(footer);
  sticky.append(header, tablist);

  // New report sections default to Context instead of silently disappearing.
  [...report.children].forEach((block) => panels.get('context').append(block));
  report.append(sticky, ...panels.values());

  const select = (key, { focus = false, scroll = false } = {}) => {
    selectedTab = key;
    buttons.forEach((button, name) => {
      const panel = panels.get(name);
      const wasHidden = panel.hidden;
      button.setAttribute('aria-selected', String(name === key));
      button.tabIndex = name === key ? 0 : -1;
      panel.hidden = name !== key;
      // Panel content built off-DOM (while every tab was still hidden) can't
      // play its reveal animations then -- e.g. the matchup gauge fills
      // silently before anyone can see it. Tell it to (re)play now instead.
      if (wasHidden && !panel.hidden) {
        panel.dispatchEvent(new CustomEvent('rr:panel-shown', { bubbles: true, detail: { key: name } }));
      }
    });
    if (focus) buttons.get(key).focus({ preventScroll: true });
    // A short tab must not inherit a position halfway down a long matchup.
    if (scroll && report.getBoundingClientRect().top < 0) {
      report.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  };
  buttons.forEach((button, key) => {
    button.addEventListener('click', () => select(key, { scroll: true }));
    button.addEventListener('keydown', (event) => {
      const index = tabs.findIndex((tab) => tab.key === key);
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
      if (next < 0) return;
      event.preventDefault();
      select(tabs[next].key, { focus: true, scroll: true });
    });
  });
  select(selectedTab);
}
