// The Analyze walk-through: while the line is graded, a cursor (a finger on
// a touch screen) does on the player's page what someone researching it by
// hand would -- reads the card, runs along the chart, flips the hit-rate
// windows, opens the matchup and clicks through its tabs (defense, odds,
// injuries), scrolls down to the game log -- with a spotlight on whatever
// it's looking at. Every click is on the page's own buttons, and the page
// is put back as it was: the same tabs, the same window, the same scroll,
// whether the walk-through finishes, is skipped or is closed half-way.

const easeInOut = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const visible = element => Boolean(element?.isConnected && element.getClientRects().length && element.getBoundingClientRect().width > 0);
const find = (selector, root = document) => [...root.querySelectorAll(selector)].find(visible) || null;
const label = element => (element?.textContent || '').replace(/\s+/g, ' ').trim();

class Stop extends Error {}

/** The element that scrolls `element` into view: the nearest scrolling box, else the page. */
function scrollerOf(element) {
  for (let node = element?.parentElement; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 2) return node;
  }
  return document.scrollingElement || document.documentElement;
}

// What the walk-through may change, as it was before it started (on a
// phone the matchup's tabs are there while its view is hidden).
const either = selector => find(selector) || document.querySelector(selector);
function snapshot() {
  const tab = either('nav.mlb-context-tabs > button[aria-pressed="true"]');
  const views = [...document.querySelectorAll('.fpb-switch [role="tab"][aria-selected="true"]')];
  const view = views.find(visible) || views[0];
  const window = either('.gamelog-windowbar button[data-window].active');
  return {tab: tab?.dataset.section || null, view: view ? label(view) : null, window: window && !window.dataset.windowMenu ? window.dataset.window : null};
}
const contextTab = key => find(`nav.mlb-context-tabs > button[data-section="${key}"]`);
const anyContextTab = key => document.querySelector(`nav.mlb-context-tabs > button[data-section="${key}"]`);
const anyViewTab = name => [...document.querySelectorAll('.fpb-switch [role="tab"]')].find(button => label(button).toLowerCase() === String(name).toLowerCase()) || null;
const viewTab = name => [...document.querySelectorAll('.fpb-switch [role="tab"]')].find(button => visible(button) && label(button).toLowerCase() === String(name).toLowerCase()) || null;
const windowButton = key => find(`.gamelog-windowbar button[data-window="${key}"]`);

/**
 * The walk-through. `spot`, `tag`, `pointer`, `ripples`, `chips` are the
 * layer's elements; `card()` the progress card (where what's gathered
 * goes); `step(i)` hears each stage of the progress card start; `top()` and
 * `floor()` the part of the screen it works in (below the status bar,
 * above the progress card); `touch` draws a finger instead of a pointer.
 */
export function createTour({spot, tag, pointer, ripples, chips, card, step = () => {}, top = () => 72, floor = () => innerHeight, touch = false, start = null}) {
  let stopped = false, frame = 0, target = null, box = null;
  let point = start ? {x: start.left + start.width / 2, y: start.top + start.height / 2} : {x: innerWidth - 60, y: innerHeight * 0.3};
  let motion = null;
  const touched = new Map();
  const before = snapshot();

  const check = () => { if (stopped) throw new Stop(); };
  const wait = ms => new Promise((resolve, reject) => setTimeout(() => (stopped ? reject(new Stop()) : resolve()), ms));

  // One loop draws the spotlight (following its section as the page
  // scrolls) and the pointer.
  const draw = () => {
    if (stopped) return;
    if (target && visible(target)) {
      const rect = target.getBoundingClientRect();
      const low = Math.max(rect.top, 8), high = Math.min(rect.bottom, floor() - 12);
      const want = {x: rect.left - 6, y: low - 6, w: rect.width + 12, h: Math.max(28, high - low) + 12};
      box = box ? {x: box.x + (want.x - box.x) * .2, y: box.y + (want.y - box.y) * .2, w: box.w + (want.w - box.w) * .2, h: box.h + (want.h - box.h) * .2} : want;
      Object.assign(spot.style, {transform: `translate(${box.x}px,${box.y}px)`, width: `${box.w}px`, height: `${box.h}px`});
    }
    if (motion) {
      const p = clamp((performance.now() - motion.start) / motion.ms, 0, 1), k = easeInOut(p);
      point = {x: motion.from.x + (motion.to.x - motion.from.x) * k, y: motion.from.y + (motion.to.y - motion.from.y) * k - Math.sin(Math.PI * k) * motion.arc};
      if (p >= 1) { const done = motion.resolve; motion = null; done(); }
    }
    pointer.style.transform = `translate(${point.x}px,${point.y}px)`;
    frame = requestAnimationFrame(draw);
  };

  const moveTo = (x, y) => new Promise(resolve => {
    check();
    const distance = Math.hypot(x - point.x, y - point.y);
    motion = {from: {...point}, to: {x, y}, start: performance.now(), ms: clamp(distance * 0.75, 220, 480), arc: Math.min(40, distance * 0.08), resolve};
  });

  const scrollTo = async element => {
    const scroller = scrollerOf(element);
    if (!touched.has(scroller)) touched.set(scroller, scroller.scrollTop);
    const rect = element.getBoundingClientRect();
    const room = floor() - top();
    const fits = rect.top >= top() - 4 && rect.bottom <= floor() - 6;
    const tallInView = rect.height > room && rect.top >= top() - 4 && rect.top <= top() + 140;
    if (fits || tallInView) return;
    const desired = rect.height > room * 0.8 ? top() : top() + (room - rect.height) * 0.3;
    const from = scroller.scrollTop;
    const to = clamp(from + rect.top - desired, 0, scroller.scrollHeight - scroller.clientHeight);
    if (Math.abs(to - from) < 8) return;
    const ms = clamp(Math.abs(to - from) * 0.7, 380, 820), began = performance.now();
    await new Promise(resolve => {
      const tick = now => {
        if (stopped) { resolve(); return; }
        const p = clamp((now - began) / ms, 0, 1);
        scroller.scrollTop = from + (to - from) * easeInOut(p);
        if (p < 1) requestAnimationFrame(tick); else resolve();
      };
      requestAnimationFrame(tick);
    });
    check();
  };

  const showTag = text => { tag.textContent = text; spot.dataset.on = 'true'; };

  // What it looked at, dropping into the progress card.
  const gather = (text, element) => {
    const host = chips, goal = card()?.getBoundingClientRect();
    if (!host || !goal || !visible(element) || stopped) return;
    const chip = document.createElement('span');
    chip.className = 'ap-chip';
    chip.textContent = text;
    host.append(chip);
    const rect = element.getBoundingClientRect();
    const from = {x: clamp(rect.left + rect.width / 2, 40, innerWidth - 40) - chip.offsetWidth / 2, y: clamp(rect.top + Math.min(rect.height / 2, 80), 40, floor() - 40) - chip.offsetHeight / 2};
    const to = {x: goal.left + goal.width / 2 - chip.offsetWidth / 2, y: goal.top + 14};
    const flight = chip.animate([
      {transform: `translate(${from.x}px,${from.y}px) scale(.9)`, opacity: 0},
      {transform: `translate(${from.x}px,${from.y - 10}px) scale(1)`, opacity: 1, offset: .2},
      {transform: `translate(${to.x}px,${to.y}px) scale(.72)`, opacity: .9, offset: .88},
      {transform: `translate(${to.x}px,${to.y + 6}px) scale(.6)`, opacity: 0}], {duration: 820, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards'});
    flight.onfinish = () => { chip.remove(); card()?.animate([{scale: '1'}, {scale: '1.02'}, {scale: '1'}], {duration: 260, easing: 'ease-out'}); };
  };

  // Look at a section: bring it into view, light it, and point into it.
  const look = async (element, text, dwell = 500) => {
    if (!visible(element)) return false;
    check();
    await scrollTo(element);
    target = element;
    showTag(text);
    const rect = element.getBoundingClientRect();
    const high = Math.min(rect.bottom, floor() - 20);
    await moveTo(rect.left + Math.min(rect.width * 0.32, 220), clamp(rect.top + Math.min(rect.height * 0.35, 120), top() + 10, high - 10));
    await wait(dwell);
    return true;
  };

  // Run along a section the way eyes read it.
  const sweep = async element => {
    if (!visible(element)) return;
    const rect = element.getBoundingClientRect();
    const y = clamp(rect.top + rect.height * 0.55, top() + 10, floor() - 30);
    for (const share of [0.22, 0.52, 0.82]) await moveTo(rect.left + rect.width * share, y + (share === 0.52 ? -14 : 0));
    await wait(80);
  };

  const press = (x, y) => {
    const ring = document.createElement('span');
    ring.className = 'ap-ripple';
    ring.style.transform = `translate(${x}px,${y}px)`;
    ripples.append(ring);
    ring.animate([{scale: '.3', opacity: .9}, {scale: '1.6', opacity: 0}], {duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)'}).onfinish = () => ring.remove();
    pointer.animate([{scale: '1'}, {scale: '.82'}, {scale: '1'}], {duration: 220, easing: 'ease-out'});
  };

  // Tap one of the page's own buttons. `get` finds it again: the page may
  // have drawn it anew since.
  const tap = async (get, after = 420) => {
    let button = get();
    if (!visible(button)) return false;
    await scrollTo(button);
    button = get();
    if (!visible(button)) return false;
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    await moveTo(x, y);
    await wait(90);
    press(x, y);
    button.click();
    await wait(after);
    return true;
  };

  // Put the page back: tabs and the window by its own buttons, then the scroll.
  const restore = async (instant = false) => {
    const now = snapshot();
    if (before.tab && now.tab !== before.tab) anyContextTab(before.tab)?.click();
    if (before.view && now.view !== before.view) anyViewTab(before.view)?.click();
    if (before.window && now.window !== before.window) document.querySelector(`.gamelog-windowbar button[data-window="${before.window}"]`)?.click();
    if (instant) { for (const [scroller, value] of touched) scroller.scrollTop = value; return; }
    await new Promise(resolve => requestAnimationFrame(resolve));
    await Promise.all([...touched].map(([scroller, value]) => new Promise(resolve => {
      const from = scroller.scrollTop, ms = clamp(Math.abs(value - from) * 0.6, 300, 760), began = performance.now();
      if (Math.abs(value - from) < 4) { resolve(); return; }
      const tick = now => {
        const p = clamp((now - began) / ms, 0, 1);
        scroller.scrollTop = from + (value - from) * easeInOut(p);
        if (p < 1 && !stopped) requestAnimationFrame(tick); else { if (stopped) scroller.scrollTop = value; resolve(); }
      };
      requestAnimationFrame(tick);
    })));
  };

  const script = async () => {
    step(0);
    const hero = find('.fpb-hero');
    if (hero) await look(hero, 'The line', 550);
    const chart = find('.gamelog-chart');
    if (await look(chart, 'Last games', 100)) { await sweep(chart); gather('Last games', chart); }
    // The hit-rate windows: another one, then back to the one it was on.
    const bar = find('.gamelog-windowbar');
    if (await look(bar, 'Hit rates', 120)) {
      const plain = button => button && !button.dataset.windowMenu && !button.disabled;
      const current = bar.querySelector('button[data-window].active');
      if (plain(current)) {
        const other = [...bar.querySelectorAll('button[data-window]')].find(button => plain(button) && button !== current);
        if (other) {
          const key = other.dataset.window;
          await tap(() => windowButton(key), 440);
          await tap(() => windowButton(current.dataset.window), 240);
        }
      } else await wait(400);
      gather('Hit rates', bar);
    }

    step(1);
    // The matchup: on a phone, its own view.
    const matchupView = viewTab('Matchup');
    if (matchupView && matchupView.getAttribute('aria-selected') !== 'true') {
      target = matchupView.closest('.fpb-switch') || matchupView;
      showTag('Matchup');
      await tap(() => viewTab('Matchup'), 480);
    }
    const aside = find('aside.mlb-finder-context');
    const clickTab = async (key, text) => {
      const button = contextTab(key);
      if (!button) return false;
      if (button.getAttribute('aria-pressed') !== 'true') {
        target = button.parentElement;
        showTag(text);
        if (!await tap(() => contextTab(key), 300)) return false;
      }
      const panel = find('aside.mlb-finder-context');
      if (await look(panel, text, 380)) gather(text, panel);
      return true;
    };
    if (aside) {
      if (contextTab('matchup')) await clickTab('matchup', 'Matchup');
      else if (await look(aside, 'Matchup', 600)) gather('Matchup', aside);
      await clickTab('defense', 'Defense');
    }

    step(2);
    if (!(aside && await clickTab('odds', 'Odds'))) {
      const odds = find('.fpb-odds');
      if (await look(odds, 'Odds', 600)) gather('Odds', odds);
    }

    step(3);
    if (aside) await clickTab('injuries', 'Injuries');
    // Back to where the matchup was (on a phone, as its view closes), and to the trend view.
    const leaving = before.view && viewTab(before.view)?.getAttribute('aria-selected') !== 'true';
    if (before.tab && contextTab(before.tab)?.getAttribute('aria-pressed') !== 'true') {
      if (leaving) anyContextTab(before.tab)?.click(); else await tap(() => contextTab(before.tab), 260);
    }
    if (leaving) {
      target = viewTab(before.view)?.closest('.fpb-switch') || target;
      showTag(before.view);
      await tap(() => viewTab(before.view), 420);
    }

    step(4);
    const log = find('.mlb-player-gamelog');
    if (await look(log, 'Game log', 250)) { await sweep(log); gather('Game log', log); }
    // Back up to the line, the page as it was.
    await restore();
    if (hero) { target = hero; showTag('The line'); await wait(250); }
    spot.dataset.on = 'false';
  };

  return {
    /** The walk-through, to its end (or until stopped). */
    async run() {
      frame = requestAnimationFrame(draw);
      try { await script(); }
      catch (error) { if (!(error instanceof Stop)) { stopped = true; cancelAnimationFrame(frame); restore(true); throw error; } }
      finally { if (!stopped) { stopped = true; cancelAnimationFrame(frame); } }
    },
    /** Stop where it is and put the page back at once. */
    stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      if (motion) { motion.resolve(); motion = null; }
      restore(true);
    },
    touch,
  };
}
