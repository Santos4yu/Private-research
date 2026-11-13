import {SITE, viaSite} from './slip-share.js';
import {americanOf, decimal, moneyText, odds, startText} from './game-predictor-core.js';
// A moneyline pick or parlay from the Game Predictor as a picture to send
// (Nov 6, the owner, with a sportsbook's parlay screenshot: "a nice copyable
// image the website gives when I do moneyline wither it's a straight or
// parlay"). The site's own card: the kind and the total odds on top, then
// each leg (the game and its time, the team with its logo, its odds and our
// chance), then the amount, what it wins and the payout. 1080 wide, as tall
// as its legs. Phones hand it to the share sheet (Copy, Save, Messages); a
// computer copies it to the clipboard, else it downloads.
// Nov 13, the owner, sharing plays with their community: "I don't want them
// to see a model or anything related or value or nothing just the
// moneylines ... nice and minimalistic". Without an amount the picture is
// the title, the total odds and the legs (game, team, price): no chance, no
// units, no glow, no site name. A saved bet (an amount) keeps its money rows.

const W = 1080, PAD = 72, HEAD = 250, LEG = 196, FOOT = 220, END = 40;
const BG = '#0f1011', INK = '#f4f6f6', MUTED = 'rgba(244,246,246,.56)', FAINT = 'rgba(244,246,246,.32)', HAIR = 'rgba(255,255,255,.09)';
const GOOD = '#3ddc97';

const font = (weight, size) => `${weight} ${size}px ${(typeof document !== 'undefined' && getComputedStyle(document.body).fontFamily) || 'system-ui, sans-serif'}`;
const hex = value => /^[0-9a-f]{6}$/i.test(value || '') ? `#${value}` : null;

function image(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = viaSite(src);
    setTimeout(() => resolve(null), 4000);
  });
}

function fit(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/** The legs' combined price: {dec, american}. */
export function combined(legs) {
  const dec = (legs || []).reduce((total, leg) => total * (decimal(leg.price) || NaN), 1);
  return Number.isFinite(dec) && dec > 1 ? {dec, american: americanOf(dec)} : null;
}

/** The card's words, worked out apart from the drawing (tested): its title, total odds and the money rows. */
export function cardText({legs, stake}) {
  const count = (legs || []).length;
  const price = combined(legs);
  const title = count > 1 ? `${count}-Pick Parlay` : 'Moneyline';
  const win = price ? (stake > 0 ? stake * (price.dec - 1) : price.dec - 1) : null;
  const money = stake > 0
    ? [['Amount', moneyText(stake)], ['To win', win != null ? moneyText(win) : '—'], ['Payout', win != null ? moneyText(stake + win) : '—']]
    : [];
  // A straight pick's price is on its leg; a parlay's total sits on top.
  return {title, odds: count > 1 && price ? odds(price.american) : null, pays: price ? `${price.dec.toFixed(2)}x` : null, money};
}

export async function drawMoneyline({legs, stake}) {
  const text = cardText({legs, stake});
  const H = HEAD + legs.length * LEG + (text.money.length ? FOOT : END);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const logos = await Promise.all(legs.map(leg => image(leg.team?.logo)));

  // The page: plain dark.
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);

  // The kind, and a parlay's total odds on the right.
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK; ctx.font = font(800, 54); ctx.textAlign = 'left';
  ctx.fillText(text.title, PAD, 132);
  if (text.odds) { ctx.textAlign = 'right'; ctx.font = font(850, 58); ctx.fillText(text.odds.replace('-', '−'), W - PAD, 132); }
  ctx.fillStyle = HAIR; ctx.fillRect(PAD, HEAD - 34, W - 2 * PAD, 2);

  // Each leg: the game and its time, then the team and its odds.
  legs.forEach((leg, index) => {
    const top = HEAD + index * LEG;
    const home = leg.home ? leg.team : leg.opponent, away = leg.home ? leg.opponent : leg.team;
    const name = team => [...new Set([team?.abbr, team?.short].filter(Boolean))].join(' ');
    ctx.textAlign = 'left'; ctx.fillStyle = MUTED; ctx.font = font(600, 29);
    ctx.fillText(fit(ctx, `${name(away)} @ ${name(home)} · ${startText(leg.startsAt)}`, W - 2 * PAD), PAD, top + 34);
    const logo = logos[index], size = 76, y = top + 62;
    if (logo) ctx.drawImage(logo, PAD, y, size, size);
    else {
      ctx.fillStyle = hex(leg.team?.color) || 'rgba(255,255,255,.12)';
      ctx.beginPath(); ctx.arc(PAD + size / 2, y + size / 2, size / 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = INK; ctx.font = font(800, 26); ctx.textAlign = 'center'; ctx.fillText(leg.team?.abbr || '', PAD + size / 2, y + size / 2 + 9);
    }
    ctx.textAlign = 'right'; ctx.fillStyle = INK; ctx.font = font(850, 46);
    const priceText = odds(leg.price).replace('-', '−');
    ctx.fillText(priceText, W - PAD, y + 50);
    const right = ctx.measureText(priceText).width;
    ctx.textAlign = 'left'; ctx.fillStyle = INK; ctx.font = font(800, 46);
    const team = fit(ctx, leg.team?.short || leg.team?.abbr || '', W - 2 * PAD - size - 28 - right - 60);
    ctx.fillText(team, PAD + size + 26, y + 50);
    if (legs.length > 1) { ctx.fillStyle = MUTED; ctx.font = font(600, 28); ctx.fillText('Moneyline', PAD + size + 26, y + 90); }
    if (index < legs.length - 1) { ctx.fillStyle = HAIR; ctx.fillRect(PAD + size + 26, top + LEG - 14, W - 2 * PAD - size - 26, 2); }
  });

  // A saved bet: amount and what it wins, the payout big; the site small.
  if (!text.money.length) return canvas;
  const foot = HEAD + legs.length * LEG + 6;
  ctx.fillStyle = HAIR; ctx.fillRect(PAD, foot - 6, W - 2 * PAD, 2);
  const columns = text.money, width = (W - 2 * PAD) / columns.length;
  columns.forEach(([label, value], index) => {
    const x = PAD + index * width;
    ctx.textAlign = 'left'; ctx.fillStyle = MUTED; ctx.font = font(650, 27); ctx.fillText(label, x, foot + 56);
    ctx.fillStyle = index === columns.length - 1 ? GOOD : INK; ctx.font = font(850, index === columns.length - 1 ? 50 : 42);
    ctx.fillText(fit(ctx, value, width - 16), x, foot + 116);
  });
  ctx.textAlign = 'right'; ctx.fillStyle = FAINT; ctx.font = font(750, 24); ctx.fillText(SITE, W - PAD, H - 34);
  return canvas;
}

const fileName = legs => `${legs.length > 1 ? `${legs.length}-pick-parlay` : 'moneyline'}-${legs.map(leg => leg.team?.abbr || '').join('-').toLowerCase()}.png`;

/** The picture made ahead (the press-and-hold menu shows it, then copies or saves it): {blob, name, url}, or null. */
export async function pictureOf(options) {
  const canvas = await drawMoneyline(options);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  return blob ? {blob, name: fileName(options.legs), url: URL.createObjectURL(blob)} : null;
}

/** Copy a made picture: true when the clipboard took it. */
export async function copyPicture(picture) {
  if (!picture || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
  try { await navigator.clipboard.write([new ClipboardItem({'image/png': picture.blob})]); return true; }
  catch { return false; }
}

/** Save a made picture: a phone's share sheet (its Save Image puts it in Photos), else a download. 'shared' | 'saved' | null. */
export async function savePicture(picture) {
  if (!picture) return null;
  const file = new File([picture.blob], picture.name, {type: 'image/png'});
  const phone = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (phone && navigator.canShare?.({files: [file]})) {
    try { await navigator.share({files: [file]}); return 'shared'; }
    catch (error) { if (error?.name === 'AbortError') return null; }
  }
  const link = Object.assign(document.createElement('a'), {href: picture.url, download: picture.name});
  document.body.append(link); link.click(); link.remove();
  return 'saved';
}

/** The card to the share sheet on a phone; copied on a computer, else downloaded. 'shared' | 'copied' | 'saved' | null. */
export async function shareMoneyline(options) {
  const canvas = await drawMoneyline(options);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return null;
  const name = fileName(options.legs);
  const file = new File([blob], name, {type: 'image/png'});
  const phone = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (phone && navigator.canShare?.({files: [file]})) {
    // The picture alone: with words alongside it, the share sheet's Copy copies the words instead.
    try { await navigator.share({files: [file]}); return 'shared'; }
    catch (error) { if (error?.name === 'AbortError') return null; }
  }
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    try { await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]); return 'copied'; }
    catch { /* falls through to a download */ }
  }
  const link = Object.assign(document.createElement('a'), {href: URL.createObjectURL(blob), download: name});
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  return 'saved';
}
