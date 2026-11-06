// A slip as a picture to share (1080x1350, the size feeds show whole): the
// slip card, each pick with its line the way the app shows it -- the Parlay
// Builder's and the Slip Analyzer's alike. Phones hand it to the share
// sheet; elsewhere it downloads.

const W = 1080, H = 1350, PAD = 72;
export const SITE = 'aceprops.xyz';
const INK = '#f4f7f6', MUTED = 'rgba(244,247,246,.58)', FAINT = 'rgba(244,247,246,.34)';
// A grade's colour, as on every page: A green, B grey, C amber, D and F red.
const GRADE_TONE = {A: '#46e39a', B: '#b4b4b4', C: '#f6b955'};

const initials = name => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
const nice = value => (Number.isInteger(value) ? String(value) : Number(value).toFixed(1));

// A canvas can only be saved when what's drawn on it is this site's own, and
// the leagues' image hosts don't allow it otherwise -- so their headshots and
// logos come through api/mlb-logo.py (?src=). Anything that fails is drawn without.
export const viaSite = src => {
  try {
    const url = new URL(src, location.href);
    return url.origin === location.origin || url.protocol === 'data:' ? src : `/api/mlb-logo?src=${encodeURIComponent(url.href)}`;
  } catch { return src; }
};
function image(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = viaSite(src);
    setTimeout(() => resolve(null), 8000);
  });
}

function fit(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
  return `${cut}…`;
}

// ---------------------------------------------------------------- the slip card

// Each stat as the apps print it on a pick ("SOG", "PRA", "REC YDS"), keyed
// without spaces or case; anything else is shown as written.
const SHORT = {
  points: 'PTS', rebounds: 'REB', assists: 'AST', ptsrebsasts: 'PRA', ptsrebs: 'PR', ptsasts: 'PA', rebsasts: 'RA',
  '3ptmade': '3PM', '3ptattempted': '3PA', blksstls: 'BLK+STL', blockedshots: 'BLK', steals: 'STL', turnovers: 'TO',
  fgmade: 'FGM', fgattempted: 'FGA', freethrowsmade: 'FTM', fantasyscore: 'FPTS', doubledouble: 'DBL-DBL',
  hits: 'HITS', runs: 'RUNS', rbis: 'RBI', hitsrunsrbis: 'H+R+RBI', totalbases: 'TB', homeruns: 'HR', singles: '1B',
  doubles: '2B', walks: 'BB', hitterstrikeouts: 'K', stolenbases: 'SB', hitterfantasyscore: 'FPTS', pitcherstrikeouts: 'K',
  pitchingouts: 'OUTS', hitsallowed: 'H ALLOWED', earnedrunsallowed: 'ER', walksallowed: 'BB ALLOWED',
  pitchesthrown: 'PITCHES', pitcherfantasyscore: 'FPTS', '1stinningrunsallowed': '1ST INN RUNS',
  passyards: 'PASS YDS', passtds: 'PASS TD', passattempts: 'PASS ATT', passcompletions: 'COMP', passints: 'INT',
  rushyards: 'RUSH YDS', rushattempts: 'RUSH ATT', receptions: 'REC', receivingyards: 'REC YDS', rushrecyds: 'RUSH+REC',
  passrushyds: 'PASS+RUSH', rushrectds: 'RUSH+REC TD', longestreception: 'LONG REC', longestrush: 'LONG RUSH',
  kickingpoints: 'KICK PTS', totaltackles: 'TACKLES', sacks: 'SACKS',
  goals: 'GOALS', shotsongoal: 'SOG', powerplaypoints: 'PPP', goaliesaves: 'SAVES', goalsagainst: 'GA', faceoffswon: 'FOW',
  timeonice: 'TOI', shots: 'SHOTS', shotsontarget: 'SOT', goalassist: 'G+A', passesattempted: 'PASSES', tackles: 'TACKLES',
  clearances: 'CLR', fouls: 'FOULS', shotsassisted: 'SHOTS AST',
};
export const statShort = stat => SHORT[String(stat || '').toLowerCase().replace(/[^a-z0-9]/g, '')] || String(stat || '').toUpperCase();
const SPORT = {nfl: 'NFL', nba: 'NBA', wnba: 'WNBA', mlb: 'MLB', nhl: 'NHL', soccer: 'Soccer'};

// An up or down arrow, drawn (no font has to have it).
function arrow(ctx, x, y, size, up) {
  const tip = up ? y - size / 2 : y + size / 2, tail = up ? y + size / 2 : y - size / 2, head = size * 0.42;
  ctx.beginPath(); ctx.moveTo(x, tail); ctx.lineTo(x, tip);
  ctx.moveTo(x - head, tip + (up ? head : -head)); ctx.lineTo(x, tip); ctx.lineTo(x + head, tip + (up ? head : -head));
  ctx.stroke();
}

/**
 * A slip as a card: the app's logo, the kind of entry and the grade at the
 * top, then each pick a row (photo, name, team · position · league) with its
 * line the way the app shows it -- an arrow, the number and the stat, a
 * goblin or demon when it has one. `legs` are {player, team, position,
 * sport, headshot, teamLogo, side, line, stat, modifier}; `kind` is the
 * header's words ("3-pick Power"), `source` the page it came from, `tagline`
 * the line beneath the card.
 */
export async function drawCard({legs, letter, kind, appLogo = '/prizepicks/logo.png', source = 'PARLAY BUILDER',
  tagline = 'Built from Elite and Strong picks, graded on matchup, form and news'}) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const font = (typeof document !== 'undefined' && getComputedStyle(document.body).fontFamily) || 'system-ui, sans-serif';
  const set = (size, weight = 600) => { ctx.font = `${weight} ${size}px ${font}`; };
  const GREEN = '#46e39a', CARD = '#111111', ROW = '#191919', LINE = '#353535';
  const n = legs.length;
  const [mark, logo, goblin, demon, ...pictures] = await Promise.all([image('/brand/propscout-logo.png'), image(appLogo),
    image('/prizepicks/goblin.png'), image('/prizepicks/demon.png'), ...legs.flatMap(leg => [image(leg.headshot), image(leg.teamLogo)])]);

  // Background, a green glow behind the card.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#191919'); bg.addColorStop(1, '#090b0c');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, 620);
  glow.addColorStop(0, 'rgba(130,130,130,.16)'); glow.addColorStop(1, 'rgba(130,130,130,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  if (mark) ctx.drawImage(mark, PAD, 55, 220, 42);
  set(24, 800); ctx.fillStyle = MUTED; ctx.textAlign = 'right';
  ctx.fillText(source, W - PAD, 90);

  // The card's size: rows as tall as fit, the whole card centered.
  const x0 = PAD - 8, cardW = W - x0 * 2, inset = 30, headH = 118, gap = 14;
  const rowH = Math.max(104, Math.min(168, (H - 300 - headH - inset * 2 - gap * (n - 1)) / n));
  const cardH = headH + n * rowH + gap * (n - 1) + inset;
  const y0 = Math.max(140, (H - cardH) / 2 - 10);
  ctx.beginPath(); ctx.roundRect(x0, y0, cardW, cardH, 44);
  ctx.fillStyle = CARD; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = LINE; ctx.stroke();
  const left = x0 + inset, right = x0 + cardW - inset;

  // Header: the app's logo, the kind of entry ("3-pick Power"), the grade.
  if (logo) { ctx.save(); ctx.beginPath(); ctx.roundRect(left, y0 + 32, 56, 56, 14); ctx.clip(); ctx.drawImage(logo, left, y0 + 32, 56, 56); ctx.restore(); }
  set(26, 800);
  const chip = letter ? `Grade ${letter}` : 'Graded A+ to F', chipW = ctx.measureText(chip).width + 40;
  set(40, 800); ctx.fillStyle = INK; ctx.textAlign = 'left';
  const titleX = left + (logo ? 76 : 0);
  ctx.fillText(fit(ctx, kind || `${n}-pick slip`, right - chipW - 24 - titleX), titleX, y0 + 74);
  set(26, 800);
  const tone = letter ? GRADE_TONE[letter[0]] || '#ff7b8a' : GREEN;
  ctx.beginPath(); ctx.roundRect(right - chipW, y0 + 36, chipW, 50, 25);
  ctx.fillStyle = `${tone}29`; ctx.fill();
  ctx.fillStyle = tone; ctx.textAlign = 'center'; ctx.fillText(chip, right - chipW / 2, y0 + 70);
  const dashed = y => { ctx.save(); ctx.setLineDash([10, 9]); ctx.lineWidth = 2; ctx.strokeStyle = LINE;
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke(); ctx.restore(); };
  dashed(y0 + headH - 8);

  // The line boxes, one width for all (the widest one's), so they line up.
  const big = Math.round(Math.min(48, rowH * 0.34)), small = Math.round(Math.min(26, rowH * 0.19));
  const iconW = big * 0.95, arrowW = big * 0.62;
  const icons = legs.map(leg => (leg.modifier === 'goblin' ? goblin : leg.modifier === 'demon' ? demon : null));
  const tops = legs.map((leg, index) => { set(big, 800); return (icons[index] ? iconW + 12 : 0) + arrowW + 12 + ctx.measureText(nice(leg.line)).width; });
  set(small, 700);
  const boxW = Math.max(150, ...legs.map((leg, index) => Math.max(tops[index], Math.min(ctx.measureText(statShort(leg.stat)).width, 260)) + 48));

  // Each pick.
  legs.forEach((leg, index) => {
    const y = y0 + headH + index * (rowH + gap), mid = y + rowH / 2;
    ctx.beginPath(); ctx.roundRect(left, y, right - left, rowH, 26);
    ctx.fillStyle = ROW; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#2a2a2a'; ctx.stroke();
    // The photo, initials only without one, the team's logo on its corner.
    const r = Math.round(rowH * 0.31), px = left + 26 + r;
    const [photo, team] = [pictures[index * 2], pictures[index * 2 + 1]];
    ctx.save(); ctx.beginPath(); ctx.arc(px, mid, r, 0, Math.PI * 2); ctx.fillStyle = '#2a2a2a'; ctx.fill(); ctx.clip();
    if (photo) {
      const scale = Math.max((r * 2) / photo.width, (r * 2) / photo.height);
      ctx.drawImage(photo, px - photo.width * scale / 2, mid - r, photo.width * scale, photo.height * scale);
    } else {
      set(Math.round(r * 0.72), 800); ctx.fillStyle = MUTED; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(initials(leg.player), px, mid + 2); ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
    if (team) {
      const br = Math.round(r * 0.42), bx = px + r * 0.72, by = mid + r * 0.72;
      ctx.beginPath(); ctx.arc(bx, by, br + 3, 0, Math.PI * 2); ctx.fillStyle = CARD; ctx.fill();
      ctx.drawImage(team, bx - br * 0.8, by - br * 0.8, br * 1.6, br * 1.6);
    }
    // The line box, the way the app shows it: [goblin/demon] arrow number, the stat beneath.
    const number = nice(leg.line), icon = icons[index], topW = tops[index], statText = statShort(leg.stat);
    const boxH = rowH - 30, bx = right - 16 - boxW, by = y + 15;
    ctx.beginPath(); ctx.roundRect(bx, by, boxW, boxH, 22);
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#464646'; ctx.stroke();
    let cx = bx + (boxW - topW) / 2;
    const lineY = by + boxH * 0.47;
    if (icon) { ctx.drawImage(icon, cx, lineY - iconW * 0.62, iconW, iconW); cx += iconW + 12; }
    ctx.lineWidth = Math.max(3, big * 0.085); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
    arrow(ctx, cx + arrowW / 2, lineY - big * 0.3, big * 0.62, leg.side !== 'UNDER');
    set(big, 800); ctx.fillStyle = INK; ctx.textAlign = 'left';
    ctx.fillText(number, cx + arrowW + 12, lineY);
    set(small, 700); ctx.fillStyle = MUTED; ctx.textAlign = 'center';
    ctx.fillText(fit(ctx, statText, boxW - 24), bx + boxW / 2, by + boxH * 0.84);
    // The name and team · position · league, in the room that's left.
    const textX = px + r + 26, room = bx - textX - 18;
    ctx.textAlign = 'left';
    set(Math.round(Math.min(40, rowH * 0.28)), 800); ctx.fillStyle = '#fff';
    ctx.fillText(fit(ctx, leg.player || '', room), textX, mid - 4);
    set(Math.round(Math.min(27, rowH * 0.19)), 600); ctx.fillStyle = MUTED;
    ctx.fillText(fit(ctx, [leg.team, leg.position, SPORT[leg.sport]].filter(Boolean).join(' · '), room), textX, mid + rowH * 0.24);
  });


  set(22, 600); ctx.fillStyle = FAINT; ctx.textAlign = 'center';
  ctx.fillText(tagline, W / 2, H - 64);
  set(26, 800); ctx.fillStyle = '#828282';
  ctx.fillText(SITE, W / 2, H - 26);
  return canvas;
}

/** The slip card to the share sheet on a phone, a download elsewhere. */
export async function shareCard(options) {
  const canvas = await drawCard(options);
  await sharePicture(canvas, `parlay-${String(options.letter || 'slip').replace('+', '-plus').toLowerCase()}.png`);
}

async function sharePicture(canvas, name) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;
  const file = new File([blob], name, {type: 'image/png'});
  if (navigator.canShare?.({files: [file]})) {
    // The picture alone: with words alongside it, the share sheet's Copy copies the words instead.
    try { await navigator.share({files: [file]}); return; }
    catch (error) { if (error?.name === 'AbortError') return; }
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
}
