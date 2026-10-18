// The phone dock follows the scroll: it tucks away as you scroll down the
// page and comes back as soon as you scroll up a little, so it's there when
// you reach for it and out of the way while you read. It always shows near
// the top and at the very bottom of the page.
// A little travel in one direction is needed before it moves, so small
// jitters (and iOS momentum settling) don't make it twitch.
const TOP = 24;      // within this of the top, it always shows
const HIDE_AFTER = 16;  // scrolled down this far in one go, it hides
const SHOW_AFTER = 36;  // scrolled up this far in one go, it shows

/**
 * The dock's next state from the last one and where the page is now.
 * `state` is {hidden, y, travel} (travel: how far the page has moved in its
 * current direction, + down / - up); `bottom` is the furthest it can scroll.
 */
export function dockState(state, scrollY, bottom = Infinity) {
  const y = Math.max(0, Number(scrollY) || 0);
  const last = state || {hidden: false, y, travel: 0};
  const delta = y - last.y;
  const turned = delta !== 0 && Math.sign(delta) !== Math.sign(last.travel);
  const travel = turned ? delta : last.travel + delta;
  let hidden = last.hidden;
  if (y <= TOP || y >= bottom - 4) hidden = false;
  else if (travel >= HIDE_AFTER) hidden = true;
  else if (travel <= -SHOW_AFTER) hidden = false;
  return {hidden, y, travel};
}

// ---------------------------------------------------------------- the dock's tabs

// Four sections and More. The admin picks them (site_controls.py dockTabs);
// a section someone can't open (switched off for members, or for them) is
// replaced in its own slot by the next in this line that they can, so the
// dock never shows a gap. My Slip opens the Pick Builder panel.
export const DOCK_SIZE = 4;
export const DOCK_DEFAULT = ['finder', 'research', 'v2', 'saved'];
export const DOCK_FILL = ['finder', 'research', 'v2', 'saved', 'slip', 'bot', 'moves', 'builder', 'sheets', 'promos', 'nrfi', 'slate', 'community'];
// Each section's dock label and icon (DockIcons.jsx).
export const DOCK_ITEMS = {
  finder: {label: 'Finder', icon: 'finder'}, research: {label: 'Research', icon: 'research'}, v2: {label: 'Props', icon: 'props'},
  saved: {label: 'My Slip', icon: 'slip'}, slip: {label: 'Analyzer', icon: 'analyzer'}, bot: {label: 'Assistant', icon: 'assistant'},
  moves: {label: 'Moves', icon: 'moves'}, builder: {label: 'Builder', icon: 'builder'}, sheets: {label: 'Sheets', icon: 'sheets'},
  promos: {label: 'Promos', icon: 'promos'}, nrfi: {label: 'NRFI', icon: 'nrfi'}, slate: {label: 'Tools', icon: 'tools'},
  community: {label: 'Community', icon: 'community'},
};

/**
 * The dock's sections for one person: the admin's choice (`chosen`, in
 * order) with each one they can't open (`allowed(tab)` false) swapped in
 * place for the next they can, topped up to DOCK_SIZE the same way.
 */
export function dockTabs(chosen, allowed = () => true, size = DOCK_SIZE) {
  const list = Array.isArray(chosen) && chosen.length ? chosen : DOCK_DEFAULT;
  const picked = list.filter((key, index) => DOCK_FILL.includes(key) && list.indexOf(key) === index).slice(0, size);
  const spare = DOCK_FILL.filter(key => !picked.includes(key) && allowed(key));
  const out = picked.map(key => (allowed(key) ? key : spare.shift())).filter(Boolean);
  while (out.length < size && spare.length) out.push(spare.shift());
  return out;
}
