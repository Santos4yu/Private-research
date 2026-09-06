const paths = {
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="m12 12 8-8"/>',
  pitcher: '<circle cx="12" cy="7" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3M9 16l3 3 3-3"/>',
  mix: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  trend: '<path d="M3 3v18h18M6 15l5-6 4 3 5-7"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
};
export const researchIcon = (name = 'target') => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.target}</svg>`;
const clean = text => text.replace(/^[\s\p{Extended_Pictographic}\uFE0F\u200D]+/u, '').trim();

export function polishResearchCards(report) {
  report.querySelectorAll('.block-title').forEach(title => {
    const name = title.closest('.arsenal-block') ? 'mix' : /form|performance|result|trend/i.test(title.textContent) ? 'trend' : /risk/i.test(title.textContent) ? 'shield' : 'target';
    const text = title.closest('.arsenal-block') ? 'Starter & pitch mix' : clean(title.textContent);
    title.replaceChildren();
    title.insertAdjacentHTML('afterbegin', researchIcon(name));
    const label = document.createElement('span'); label.textContent = text; title.append(label);
  });
  const score = report.querySelector('.matchup-score-card');
  if (score) {
    score.closest('.report-block').classList.add('rc-matchup');
    score.querySelector('.matchup-score-scale')?.remove();
    const note = score.querySelector('.matchup-score-note');
    if (note) note.textContent = 'How the matchup supports this prop. This is not a win probability.';
    score.querySelectorAll('.matchup-factor').forEach(row => {
      const detail = row.querySelector('small');
      const title = row.querySelector('b');
      const impact = row.querySelector('strong');
      const value = Number(impact?.textContent.split('/')[0]);
      const disclosure = document.createElement('details'); disclosure.className = 'rc-factor';
      disclosure.dataset.direction = value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
      const summary = document.createElement('summary');
      summary.insertAdjacentHTML('afterbegin', researchIcon(/pitch|arsenal/i.test(title?.textContent) ? 'mix' : /form|workload/i.test(title?.textContent) ? 'trend' : 'target'));
      if (title) summary.append(title);
      if (impact) { impact.textContent = `${value > 0 ? '+' : ''}${Number.isFinite(value) ? value : 0}`; summary.append(impact); }
      disclosure.append(summary);
      if (detail) disclosure.append(detail);
      row.replaceWith(disclosure);
    });
  }
  for (const selector of ['.matchup-opp', '.matchup-pitcher', '.matchup-leash', '.matchup-handedness', '.matchup-lineup', '.matchup-bullpen']) {
    const row = report.querySelector(selector);
    if (!row || !row.textContent.trim()) { if (row) row.hidden = true; continue; }
    const text = clean(row.textContent);
    row.classList.add('rc-context-row'); row.replaceChildren();
    row.insertAdjacentHTML('afterbegin', researchIcon(selector.includes('pitcher') ? 'pitcher' : 'shield'));
    const copy = document.createElement('span'); copy.textContent = text; row.append(copy);
  }
  report.querySelectorAll('.starter-photo').forEach(photo => {
    const image = photo.querySelector('img');
    if (image) {
      image.alt = 'Starting pitcher';
      image.removeAttribute('onerror');
      image.addEventListener('error', () => { photo.innerHTML = researchIcon('pitcher'); }, { once: true });
    } else photo.innerHTML = researchIcon('pitcher');
  });
  report.querySelectorAll('.team-insights-btn').forEach(button => {
    button.replaceChildren(); button.insertAdjacentHTML('afterbegin', researchIcon('mix'));
    button.append(document.createTextNode('Explore lineup & pitches'));
  });
  report.querySelectorAll('.pitch-type-scroll tbody tr:not(.arsenal-row-extra)').forEach(row => {
    const cell = row.querySelector('td');
    if (cell && !cell.querySelector('svg')) cell.insertAdjacentHTML('afterbegin', researchIcon('mix'));
  });
}
