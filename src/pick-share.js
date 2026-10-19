import {SITE} from './slip-share.js';
// A Krazy Bot pick as a picture to share (1080x1350, the size feeds show
// whole): the player, the line, our chance, his last ten games against the
// line, his hit rates and the matchup. Phones hand it to the share sheet;
// elsewhere it downloads.

const W = 1080, H = 1350, PAD = 72;
const UP = '#00d68f', DOWN = '#f87171', INK = '#f4f7f6', MUTED = 'rgba(244,247,246,.55)', FAINT = 'rgba(244,247,246,.32)';
const HAIR = 'rgba(255,255,255,.1)';

const nice = value => Number.isInteger(value) ? String(value) : value.toFixed(1);
const initials = name => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();

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

function round(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function fit(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
  return `${cut}…`;
}

export async function drawPick(pick) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const font = (typeof document !== 'undefined' && getComputedStyle(document.body).fontFamily) || 'system-ui, sans-serif';
  const set = (size, weight = 600) => { ctx.font = `${weight} ${size}px ${font}`; };
  const report = pick.report || {};
  const under = pick.side === 'UNDER';

  const [photo, logo, opponentLogo, mark] = await Promise.all([image(pick.headshot), image(pick.teamLogo), image(pick.opponentLogo), image('/brand/propscout-logo.png')]);

  // Background: deep navy with a soft glow behind the player.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1a1a1a'); bg.addColorStop(1, '#0b0d0e');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 250, 20, W / 2, 250, 520);
  glow.addColorStop(0, 'rgba(130,130,130,.18)'); glow.addColorStop(1, 'rgba(130,130,130,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, 800);

  // Header: the wordmark and the game time.
  if (mark) ctx.drawImage(mark, PAD, 55, 220, 42);
  set(26, 600); ctx.fillStyle = MUTED; ctx.textAlign = 'right';
  ctx.fillText([String(pick.sport || '').toUpperCase(), pick.time].filter(Boolean).join(' · '), W - PAD, 92);

  // The player.
  const cx = W / 2, cy = 260, r = 112;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const face = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  face.addColorStop(0, '#323232'); face.addColorStop(1, '#1a1a1a');
  ctx.fillStyle = face; ctx.fill(); ctx.clip();
  if (photo) {
    const scale = Math.max((r * 2) / photo.width, (r * 2) / photo.height);
    ctx.drawImage(photo, cx - photo.width * scale / 2, cy - r, photo.width * scale, photo.height * scale);
  } else {
    set(76, 700); ctx.fillStyle = 'rgba(244,247,246,.7)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(initials(pick.player), cx, cy + 4); ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
  ctx.lineWidth = 4; ctx.strokeStyle = UP; ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, Math.PI * 2); ctx.stroke();
  if (logo) {
    ctx.fillStyle = '#181818'; ctx.beginPath(); ctx.arc(cx + r * .72, cy + r * .72, 40, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = HAIR; ctx.lineWidth = 2; ctx.stroke();
    ctx.drawImage(logo, cx + r * .72 - 26, cy + r * .72 - 26, 52, 52);
  }

  ctx.textAlign = 'center';
  set(64, 800); ctx.fillStyle = '#fff';
  ctx.fillText(fit(ctx, pick.player, W - PAD * 2), cx, 460);
  const game = [pick.team, pick.opponent && `${pick.home === false ? '@' : 'vs'} ${pick.opponent}`].filter(Boolean).join(' ');
  set(30, 500); ctx.fillStyle = MUTED;
  if (opponentLogo && game) {
    const width = ctx.measureText(game).width;
    ctx.fillText(game, cx - 22, 508);
    ctx.drawImage(opponentLogo, cx - 22 + width / 2 + 10, 482, 34, 34);
  } else if (game) ctx.fillText(game, cx, 508);

  // The pick and our chance.
  const boxY = 556, boxH = 168;
  round(ctx, PAD, boxY, W - PAD * 2, boxH, 28);
  ctx.fillStyle = 'rgba(255,255,255,.045)'; ctx.fill();
  ctx.strokeStyle = HAIR; ctx.lineWidth = 2; ctx.stroke();
  const tone = under ? DOWN : UP;
  set(28, 800);
  const sideText = under ? 'UNDER' : 'OVER';
  const sideW = ctx.measureText(sideText).width + 40;
  round(ctx, PAD + 36, boxY + 38, sideW, 48, 12);
  ctx.fillStyle = under ? 'rgba(248,113,113,.16)' : 'rgba(0,214,143,.16)'; ctx.fill();
  ctx.fillStyle = tone; ctx.textAlign = 'left'; ctx.fillText(sideText, PAD + 56, boxY + 73);
  set(64, 800); ctx.fillStyle = '#fff';
  ctx.fillText(nice(pick.line), PAD + 36, boxY + 144);
  const lineW = ctx.measureText(nice(pick.line)).width;
  set(32, 600); ctx.fillStyle = INK;
  ctx.fillText(fit(ctx, pick.stat || '', 470 - lineW), PAD + 52 + lineW, boxY + 142);
  ctx.textAlign = 'right';
  set(84, 800); ctx.fillStyle = '#fff';
  ctx.fillText(`${Math.round(pick.chance * 100)}%`, W - PAD - 36, boxY + 110);
  set(22, 700); ctx.fillStyle = MUTED;
  ctx.fillText(pick.tier ? `TO HIT · ${pick.tier.toUpperCase()}` : pick.grade ? `TO HIT · GRADE ${pick.grade}` : 'TO HIT', W - PAD - 36, boxY + 146);

  // His last ten games against the line.
  const last = pick.last || [];
  const chartY = 790, chartH = 210;
  ctx.textAlign = 'left'; set(24, 700); ctx.fillStyle = MUTED;
  ctx.fillText(`LAST ${last.length}`, PAD, chartY);
  const decided = last.filter(item => item.hit != null), won = decided.filter(item => item.hit).length;
  ctx.textAlign = 'right'; ctx.fillStyle = won / (decided.length || 1) >= .5 ? UP : DOWN;
  ctx.fillText(`${won}/${decided.length} ${under ? 'UNDER' : 'OVER'}`, W - PAD, chartY);
  if (last.length) {
    const values = last.map(item => item.value);
    const top = Math.max(...values, pick.line * 1.4, 1) * 1.1;
    const base = pick.line >= 5 ? Math.floor(Math.min(...values, pick.line) * .6) : 0;
    const plotTop = chartY + 36, plotBottom = chartY + 36 + chartH;
    const y = value => plotBottom - (value - base) / (top - base) * chartH;
    const slot = (W - PAD * 2) / last.length, barW = Math.min(56, slot - 14);
    // The line first, so the numbers sit on top of it.
    ctx.setLineDash([10, 8]); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(PAD, y(pick.line)); ctx.lineTo(W - PAD, y(pick.line)); ctx.stroke(); ctx.setLineDash([]);
    last.forEach((item, index) => {
      const x = PAD + slot * index + (slot - barW) / 2, barTop = Math.min(y(item.value), plotBottom - 6);
      ctx.beginPath();
      ctx.roundRect(x, barTop, barW, plotBottom - barTop, [8, 8, 0, 0]);
      ctx.fillStyle = item.hit == null ? 'rgba(255,255,255,.3)' : item.hit ? UP : 'rgba(248,113,113,.75)';
      ctx.fill();
      set(22, 700); ctx.textAlign = 'center';
      ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.strokeStyle = '#131313';
      ctx.strokeText(nice(item.value), x + barW / 2, barTop - 10);
      ctx.fillStyle = INK; ctx.fillText(nice(item.value), x + barW / 2, barTop - 10);
      set(18, 500); ctx.fillStyle = FAINT;
      ctx.fillText(fit(ctx, String(item.label || ''), slot - 4), x + barW / 2, plotBottom + 30);
    });
  }

  // Hit rates over each window.
  const rings = (report.rings || []).slice(0, 5);
  const ringY = 1150;
  rings.forEach((ring, index) => {
    const slot = (W - PAD * 2) / rings.length, x = PAD + slot * index + slot / 2;
    ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.beginPath(); ctx.arc(x, ringY, 54, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = ring.rate >= .6 ? UP : ring.rate < .45 ? DOWN : 'rgba(244,247,246,.6)';
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, ringY, 54, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(ring.rate, .001)); ctx.stroke();
    ctx.lineCap = 'butt';
    set(30, 800); ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(ring.rate * 100)}%`, x, ringY + 11);
    set(22, 700); ctx.fillStyle = INK;
    ctx.fillText(fit(ctx, ring.label, slot - 10), x, ringY + 94);
    set(20, 500); ctx.fillStyle = FAINT;
    ctx.fillText(`${ring.won}/${ring.games}`, x, ringY + 120);
  });

  // The matchup, when there's a grade for it: the Slip Analyzer's case first.
  const rating = pick.case || pick.rating;
  set(22, 600); ctx.textAlign = 'center'; ctx.fillStyle = MUTED;
  if (pick.case) ctx.fillText(fit(ctx, `${pick.case.label} (${pick.case.score})${pick.case.facts[0] ? ` · ${pick.case.facts[0].text}` : ''}`, W - PAD * 2), cx, H - 34);
  else if (rating) ctx.fillText(fit(ctx, `${rating.label} matchup (${rating.score})${rating.versus ? ` vs ${rating.versus}` : ''}`, W - PAD * 2), cx, H - 34);
  else if (pick.matchup?.text) ctx.fillText(fit(ctx, pick.matchup.text, W - PAD * 2), cx, H - 34);
  // Where it came from, so anyone who sees it can find the site: the top
  // right, beside the wordmark (the foot carries the matchup).
  ctx.save(); ctx.font = `800 26px ${(typeof document !== 'undefined' && getComputedStyle(document.body).fontFamily) || 'system-ui, sans-serif'}`;
  ctx.fillStyle = '#828282'; ctx.textAlign = 'right'; ctx.fillText(SITE, W - PAD, 132); ctx.restore();

  return canvas;
}

export async function sharePick(pick) {
  const canvas = await drawPick(pick);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;
  const name = `${String(pick.player || 'pick').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${pick.side === 'UNDER' ? 'under' : 'over'}-${pick.line}.png`;
  const file = new File([blob], name, {type: 'image/png'});
  const text = `${pick.player} ${pick.side === 'UNDER' ? 'Under' : 'Over'} ${nice(pick.line)} ${pick.stat || ''}`.trim();
  if (navigator.canShare?.({files: [file]})) {
    try { await navigator.share({files: [file], title: text, text: `${text} · ${SITE}`}); return; }
    catch (error) { if (error?.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), {href: url, download: name});
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
