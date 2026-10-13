// A slip as a picture to share (1080x1350, the size feeds show whole).
// The Slip Analyzer's (drawSlip): the grade on its dial, the headline, the
// chance they all hit, the payout and what it returns, and each pick with its
// tier and chance. The Parlay Builder's (drawCard): the slip card, each pick
// with its line the way the app shows it. Phones hand it to the share sheet;
// elsewhere it downloads.

const W = 1080, H = 1350, PAD = 72;
export const SITE = 'aceprops.xyz';
const INK = '#f4f7f6', MUTED = 'rgba(244,247,246,.58)', FAINT = 'rgba(244,247,246,.34)', HAIR = 'rgba(255,255,255,.1)';
const TIER = {elite: ['#46e39a', 'ELITE'], strong: ['#3cc9b9', 'STRONG'], lean: ['#aeb5b8', 'LEAN'], risky: ['#f6b955', 'RISKY'], fade: ['#ff7b8a', 'FADE']};
const TONE = {A: '#46e39a', B: '#aeb5b8', C: '#f6b955'};

const initials = name => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
const nice = value => (Number.isInteger(value) ? String(value) : Number(value).toFixed(1));
const percent = value => `${value < 0.1 ? (value * 100).toFixed(1) : Math.round(value * 100)}%`;

// Images from other sites load only when they allow it, so the canvas can
// still be saved; anything that fails is drawn without.
function image(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
    setTimeout(() => resolve(null), 4000);
  });
}

function fit(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/**
 * The picture. `score` is slip-check.js scoreEntry's, `legs` the graded
 * legs, `headline` and `kind` the card's own words ("Elite parlay",
 * "PrizePicks · 3-Pick Power Play"), `side` names a side in the app's words.
 */
export async function drawSlip({score, legs, headline, kind, side = leg => (leg.side === 'UNDER' ? 'Less' : 'More')}) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const font = (typeof document !== 'undefined' && getComputedStyle(document.body).fontFamily) || 'system-ui, sans-serif';
  const set = (size, weight = 600) => { ctx.font = `${weight} ${size}px ${font}`; };
  const tone = TONE[score.letter?.[0]] || '#ff7b8a';
  const [mark, ...photos] = await Promise.all([image('/brand/ace-props-wordmark.png'), ...legs.map(leg => image(leg.row?.headshot))]);

  // Background: deep navy, the grade's color glowing behind the dial.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#161b1e'); bg.addColorStop(1, '#0b0d0e');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 300, 30, W / 2, 300, 560);
  glow.addColorStop(0, `${tone}55`); glow.addColorStop(1, `${tone}00`);
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, 860);

  // Header: the wordmark and what this is.
  if (mark) ctx.drawImage(mark, PAD, 44, 168, 64);
  set(24, 800); ctx.fillStyle = MUTED; ctx.textAlign = 'right';
  ctx.fillText('SLIP ANALYZER', W - PAD, 90);

  // The dial: a faint track, an arc to the score, the letter inside.
  const cx = W / 2, cy = 300, r = 138;
  ctx.lineWidth = 22; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,.07)';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  const arc = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  arc.addColorStop(0, '#ffffff'); arc.addColorStop(0.35, tone); arc.addColorStop(1, tone);
  ctx.strokeStyle = arc;
  const fill = Math.max(0.02, Math.min(1, (score.score || 0) / 100));
  ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2 * 0.9999); ctx.stroke();
  ctx.textAlign = 'center';
  set(132, 800); ctx.fillStyle = tone;
  ctx.fillText(score.letter || '–', cx, cy + 40);
  set(20, 800); ctx.fillStyle = FAINT;
  ctx.fillText('PARLAY GRADE', cx, cy + 84);

  // The headline and the kind of slip.
  set(66, 800); ctx.fillStyle = '#fff';
  ctx.fillText(fit(ctx, headline || 'Graded parlay', W - PAD * 2), cx, 540);
  set(26, 700); ctx.fillStyle = MUTED;
  ctx.fillText(fit(ctx, String(kind || '').toUpperCase(), W - PAD * 2), cx, 586);

  // Three numbers: the chance they all hit, the payout, what it returns.
  const figures = [[percent(score.chance), 'TO HIT'], score.multiplier ? [`${nice(score.multiplier)}x`, 'PAYS'] : null,
    score.value != null ? [`$${score.value.toFixed(2)}`, 'PER $1'] : null].filter(Boolean);
  const gap = 18, boxW = (W - PAD * 2 - gap * (figures.length - 1)) / figures.length, boxY = 622, boxH = 126;
  figures.forEach(([value, label], index) => {
    const x = PAD + index * (boxW + gap);
    ctx.beginPath(); ctx.roundRect(x, boxY, boxW, boxH, 24);
    ctx.fillStyle = 'rgba(255,255,255,.045)'; ctx.fill();
    ctx.strokeStyle = HAIR; ctx.lineWidth = 2; ctx.stroke();
    set(50, 800); ctx.fillStyle = index === 0 ? tone : '#fff'; ctx.textAlign = 'center';
    ctx.fillText(value, x + boxW / 2, boxY + 66);
    set(19, 800); ctx.fillStyle = FAINT;
    ctx.fillText(label, x + boxW / 2, boxY + 102);
  });

  // Each pick: photo in its tier's ring, the line, the tier and the chance.
  const top = 786, bottom = H - 96;
  const rowGap = 12, rowH = Math.min(104, (bottom - top - rowGap * (legs.length - 1)) / legs.length);
  legs.forEach((leg, index) => {
    const y = top + index * (rowH + rowGap);
    const [color, word] = TIER[leg.grade?.tier] || ['#61696d', 'NO GRADE'];
    ctx.beginPath(); ctx.roundRect(PAD, y, W - PAD * 2, rowH, 20);
    ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fill();
    const pr = Math.min(34, rowH / 2 - 10), px = PAD + 30 + pr, py = y + rowH / 2;
    ctx.save();
    ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fillStyle = '#20262c'; ctx.fill(); ctx.clip();
    const photo = photos[index];
    if (photo) {
      const scale = Math.max((pr * 2) / photo.width, (pr * 2) / photo.height);
      ctx.drawImage(photo, px - photo.width * scale / 2, py - pr, photo.width * scale, photo.height * scale);
    } else {
      set(Math.round(pr * 0.8), 800); ctx.fillStyle = MUTED; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(initials(leg.row?.player || leg.player), px, py + 2); ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
    ctx.lineWidth = 4; ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(px, py, pr + 3, 0, Math.PI * 2); ctx.stroke();
    // Right side first, so the name knows how much room it has.
    set(38, 800); ctx.fillStyle = INK; ctx.textAlign = 'right';
    const chance = leg.grade ? percent(leg.grade.chance) : '–';
    ctx.fillText(chance, W - PAD - 26, py + 14);
    const chanceW = ctx.measureText(chance).width;
    set(18, 800);
    const chipW = ctx.measureText(word).width + 26, chipX = W - PAD - 26 - chanceW - 22 - chipW;
    ctx.beginPath(); ctx.roundRect(chipX, py - 18, chipW, 36, 18);
    ctx.fillStyle = `${color}26`; ctx.fill();
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.fillText(word, chipX + chipW / 2, py + 6);
    const textX = px + pr + 24, room = chipX - textX - 18;
    ctx.textAlign = 'left';
    set(rowH < 84 ? 28 : 32, 800); ctx.fillStyle = '#fff';
    ctx.fillText(fit(ctx, leg.row?.player || leg.player || '', room), textX, py - 4);
    set(rowH < 84 ? 21 : 23, 600); ctx.fillStyle = MUTED;
    ctx.fillText(fit(ctx, `${side(leg)} ${nice(leg.line)} ${leg.stat || ''}`.trim(), room), textX, py + 28);
  });

  // Footer.
  set(22, 600); ctx.fillStyle = FAINT; ctx.textAlign = 'center';
  ctx.fillText('Every pick graded on its matchup, recent games and the news', cx, H - 64);
  // Where it came from, so anyone who sees it can find the site.
  set(26, 800); ctx.fillStyle = '#00f58a';
  ctx.fillText(SITE, cx, H - 26);
  return canvas;
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
 * A built slip as the card it was built on: the app and the grade at the
 * top, each pick a row (photo, name, team · position · league) with its line
 * the way the app shows it -- an arrow, the number and the stat, a goblin
 * or demon when it has one -- and the kind of play and what it pays at the
 * foot. `legs` are {player, team, position, sport, headshot, teamLogo, side,
 * line, stat, modifier}.
 */
export async function drawCard({legs, letter, play = 'power', payout, app = 'PrizePicks', appLogo = '/prizepicks/logo.png'}) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const font = (typeof document !== 'undefined' && getComputedStyle(document.body).fontFamily) || 'system-ui, sans-serif';
  const set = (size, weight = 600) => { ctx.font = `${weight} ${size}px ${font}`; };
  const GREEN = '#46e39a', CARD = '#0e1114', ROW = '#151a1d', LINE = '#2d363d';
  const n = legs.length;
  const [mark, logo, goblin, demon, ...pictures] = await Promise.all([image('/brand/ace-props-wordmark.png'), image(appLogo),
    image('/prizepicks/goblin.png'), image('/prizepicks/demon.png'), ...legs.flatMap(leg => [image(leg.headshot), image(leg.teamLogo)])]);

  // Background, a green glow behind the card.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#141a1d'); bg.addColorStop(1, '#090b0c');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, 620);
  glow.addColorStop(0, 'rgba(0,245,138,.16)'); glow.addColorStop(1, 'rgba(0,245,138,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  if (mark) ctx.drawImage(mark, PAD, 44, 168, 64);
  set(24, 800); ctx.fillStyle = MUTED; ctx.textAlign = 'right';
  ctx.fillText('PARLAY BUILDER', W - PAD, 90);

  // The card's size: rows as tall as fit, the whole card centered.
  const x0 = PAD - 8, cardW = W - x0 * 2, inset = 30, headH = 118, footH = 104, gap = 14;
  const rowH = Math.max(104, Math.min(168, (H - 300 - headH - footH - inset * 2 - gap * (n - 1)) / n));
  const cardH = headH + n * rowH + gap * (n - 1) + inset + footH;
  const y0 = Math.max(140, (H - cardH) / 2 - 10);
  ctx.beginPath(); ctx.roundRect(x0, y0, cardW, cardH, 44);
  ctx.fillStyle = CARD; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = LINE; ctx.stroke();
  const left = x0 + inset, right = x0 + cardW - inset;

  // Header: the app, "Your slip", the grade.
  if (logo) { ctx.save(); ctx.beginPath(); ctx.roundRect(left, y0 + 32, 56, 56, 14); ctx.clip(); ctx.drawImage(logo, left, y0 + 32, 56, 56); ctx.restore(); }
  set(46, 800); ctx.fillStyle = INK; ctx.textAlign = 'left';
  ctx.fillText('Your slip', left + (logo ? 76 : 0), y0 + 76);
  set(26, 800);
  const chip = letter ? `Grade ${letter}` : 'Graded A+ to F', chipW = ctx.measureText(chip).width + 40;
  ctx.beginPath(); ctx.roundRect(right - chipW, y0 + 36, chipW, 50, 25);
  ctx.fillStyle = 'rgba(70,227,154,.16)'; ctx.fill();
  ctx.fillStyle = GREEN; ctx.textAlign = 'center'; ctx.fillText(chip, right - chipW / 2, y0 + 70);
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
    ctx.fillStyle = ROW; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#232b30'; ctx.stroke();
    // The photo, initials only without one, the team's logo on its corner.
    const r = Math.round(rowH * 0.31), px = left + 26 + r;
    const [photo, team] = [pictures[index * 2], pictures[index * 2 + 1]];
    ctx.save(); ctx.beginPath(); ctx.arc(px, mid, r, 0, Math.PI * 2); ctx.fillStyle = '#232b30'; ctx.fill(); ctx.clip();
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
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#3d474e'; ctx.stroke();
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

  // Foot: the kind of play and what it pays.
  const footY = y0 + headH + n * rowH + gap * (n - 1) + inset;
  dashed(footY);
  set(32, 700); ctx.fillStyle = FAINT; ctx.textAlign = 'left';
  ctx.fillText(`${n}-pick ${play === 'flex' ? 'Flex' : 'Power'}`, left + 4, footY + 66);
  set(46, 800); ctx.fillStyle = INK; ctx.textAlign = 'right';
  ctx.fillText(payout ? `Pays ${nice(payout)}x` : app, right - 4, footY + 70);

  set(22, 600); ctx.fillStyle = FAINT; ctx.textAlign = 'center';
  ctx.fillText('Built from Elite and Strong picks, graded on matchup, form and news', W / 2, H - 64);
  set(26, 800); ctx.fillStyle = '#00f58a';
  ctx.fillText(SITE, W / 2, H - 26);
  return canvas;
}

/** The slip card to the share sheet on a phone, a download elsewhere. */
export async function shareCard(options) {
  const canvas = await drawCard(options);
  await sharePicture(canvas, `parlay-${String(options.letter || 'slip').replace('+', '-plus').toLowerCase()}.png`, 'My parlay');
}

/** The picture to the share sheet on a phone, a download elsewhere. */
export async function shareSlip(options) {
  const canvas = await drawSlip(options);
  await sharePicture(canvas, `parlay-${String(options.score.letter || 'grade').replace('+', '-plus').toLowerCase()}.png`, options.headline || 'My parlay');
}

async function sharePicture(canvas, name, title) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;
  const file = new File([blob], name, {type: 'image/png'});
  if (navigator.canShare?.({files: [file]})) {
    try { await navigator.share({files: [file], title, text: `Graded on ${SITE}`}); return; }
    catch (error) { if (error?.name === 'AbortError') return; }
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
}
