// A graded slip as a picture to share (1080x1350, the size feeds show
// whole): the grade on its dial, the headline, the chance they all hit, the
// payout and what it returns, and each pick with its tier and chance.
// Phones hand it to the share sheet; elsewhere it downloads.

const W = 1080, H = 1350, PAD = 72;
const INK = '#ecf2f9', MUTED = 'rgba(236,242,249,.58)', FAINT = 'rgba(236,242,249,.34)', HAIR = 'rgba(255,255,255,.1)';
const TIER = {elite: ['#46e39a', 'ELITE'], strong: ['#3cc9b9', 'STRONG'], lean: ['#6aa8ff', 'LEAN'], risky: ['#f6b955', 'RISKY'], fade: ['#ff7b8a', 'FADE']};
const TONE = {A: '#46e39a', B: '#6aa8ff', C: '#f6b955'};

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
  const [mark, ...photos] = await Promise.all([image('/icons/krazy-data-wordmark.png'), ...legs.map(leg => image(leg.row?.headshot))]);

  // Background: deep navy, the grade's color glowing behind the dial.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0d1527'); bg.addColorStop(1, '#070a12');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 300, 30, W / 2, 300, 560);
  glow.addColorStop(0, `${tone}55`); glow.addColorStop(1, `${tone}00`);
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, 860);

  // Header: the wordmark and what this is.
  if (mark) ctx.drawImage(mark, PAD, 64, 203, 36);
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
    const [color, word] = TIER[leg.grade?.tier] || ['#5b6673', 'NO GRADE'];
    ctx.beginPath(); ctx.roundRect(PAD, y, W - PAD * 2, rowH, 20);
    ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fill();
    const pr = Math.min(34, rowH / 2 - 10), px = PAD + 30 + pr, py = y + rowH / 2;
    ctx.save();
    ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fillStyle = '#1b2230'; ctx.fill(); ctx.clip();
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
  ctx.fillText('Every pick graded on its matchup, recent games and the news', cx, H - 44);
  return canvas;
}

/** The picture to the share sheet on a phone, a download elsewhere. */
export async function shareSlip(options) {
  const canvas = await drawSlip(options);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;
  const name = `parlay-${String(options.score.letter || 'grade').replace('+', '-plus').toLowerCase()}.png`;
  const file = new File([blob], name, {type: 'image/png'});
  if (navigator.canShare?.({files: [file]})) {
    try { await navigator.share({files: [file], title: options.headline || 'My parlay'}); return; }
    catch (error) { if (error?.name === 'AbortError') return; }
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
}
