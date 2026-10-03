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
