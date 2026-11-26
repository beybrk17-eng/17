import { clamp, ease, easeOut, lerp } from './lib.js';

export const W = 720, H = 1280;

export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); rrPath(ctx, x, y, w, h, r); }
export function rrPath(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function bgPanel(ctx, c1 = '#0b1633', c2 = '#04070f') {
  const g = ctx.createRadialGradient(W / 2, H * 0.42, 50, W / 2, H * 0.45, H * 0.8);
  g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // subtle grid
  ctx.strokeStyle = 'rgba(120,160,255,0.05)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}

function title(ctx, text, y, size = 46, color = '#fff', alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 ${size}px ID`; ctx.letterSpacing = '1px'; ctx.fillText(text, W / 2, y); ctx.restore();
}

function planeIcon(ctx, x, y, ang, s = 1, color = '#fff') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s); ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(22, 0); ctx.quadraticCurveTo(24, -3, 18, -3); ctx.lineTo(4, -3); ctx.lineTo(-6, -18); ctx.lineTo(-11, -18); ctx.lineTo(-5, -3);
  ctx.lineTo(-15, -3); ctx.lineTo(-20, -9); ctx.lineTo(-23, -9); ctx.lineTo(-20, 0); ctx.lineTo(-23, 9); ctx.lineTo(-20, 9); ctx.lineTo(-15, 3);
  ctx.lineTo(-5, 3); ctx.lineTo(-11, 18); ctx.lineTo(-6, 18); ctx.lineTo(4, 3); ctx.lineTo(18, 3); ctx.quadraticCurveTo(24, 3, 22, 0);
  ctx.fill(); ctx.restore();
}

/* ---- Route map with U-turn ---- */
export function drawRoute(ctx, p, T) {
  bgPanel(ctx, '#1436a8', '#0a1a5c');
  title(ctx, 'ROTA DEĞİŞTİ', 300, 50);
  ctx.save(); ctx.globalAlpha = 0.75; ctx.fillStyle = '#9fb7ff'; ctx.font = '700 22px IB'; ctx.textAlign = 'center';
  ctx.fillText('HAVA SAHASI KAPALI', W / 2, 350); ctx.restore();
  const A = { x: 110, y: 760 }, B = { x: 610, y: 760 };
  const arc = (u) => ({ x: lerp(A.x, B.x, u), y: A.y - Math.sin(Math.PI * u) * 260 });
  // planned dotted
  ctx.setLineDash([4, 12]); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineCap = 'round';
  ctx.beginPath(); for (let i = 0; i <= 60; i++) { const q = arc(i / 60); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); } ctx.stroke();
  ctx.setLineDash([]);
  for (const q of [A, B]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q.x, q.y, 9, 0, 7); ctx.fill(); }
  // closed zone over destination half
  const zp = ease(p * 3);
  ctx.save(); ctx.globalAlpha = 0.25 * zp; ctx.fillStyle = '#ff2a3a'; ctx.beginPath(); ctx.arc(B.x - 60, 560, 230 * zp, 0, 7); ctx.fill(); ctx.restore();
  ctx.save(); ctx.globalAlpha = zp; ctx.strokeStyle = '#ff3b4a'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.arc(B.x - 60, 560, 230 * zp, 0, 7); ctx.stroke(); ctx.restore();
  // traveled + U-turn path
  const u0 = 0.46;
  const turnP = clamp((p - 0.15) / 0.75);
  const pts = []; for (let i = 0; i <= 40; i++) pts.push(arc(u0 * i / 40));
  const c = arc(u0);
  const loop = []; for (let i = 0; i <= 40; i++) { const a = -Math.PI / 2 + Math.PI * i / 40 * 1.0; loop.push({ x: c.x + 50 + Math.cos(a) * 50 - 50 + 50 * Math.sin(Math.PI * i / 40) * 0, y: c.y + 50 + Math.sin(a) * 50 }); }
  // simple U: go forward & turn back down-left
  const uPath = []; for (let i = 0; i <= 50; i++) { const a = Math.PI * i / 50; uPath.push({ x: c.x + Math.sin(a) * 70, y: c.y + 70 - Math.cos(a) * 70 }); }
  for (let i = 1; i <= 30; i++) uPath.push({ x: c.x - i * 9, y: c.y + 140 + i * 3 });
  ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 6; ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y));
  const nU = Math.floor(uPath.length * turnP); for (let i = 0; i < nU; i++) ctx.lineTo(uPath[i].x, uPath[i].y); ctx.stroke();
  const cur = nU > 1 ? uPath[nU - 1] : c, prev = nU > 2 ? uPath[nU - 2] : arc(u0 - 0.01);
  planeIcon(ctx, cur.x, cur.y, Math.atan2(cur.y - prev.y, cur.x - prev.x), 1.5, '#fff');
  ctx.font = '800 26px IB'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('GERİ DÖNÜŞ', W / 2, 980);
}

/* ---- Radar: airports closed / home airport hit ---- */
const APTS = [
  { c: 'KRV', x: -170, y: -230 }, { c: 'DLM', x: 190, y: -170 }, { c: 'SNK', x: -230, y: 30 },
  { c: 'TRZ', x: 220, y: 90 }, { c: 'ORD', x: -90, y: 220 }, { c: 'BLK', x: 120, y: 260 },
];
export function drawRadar(ctx, p, T) {
  bgPanel(ctx, '#121d3d', '#04060d');
  title(ctx, 'EN YAKIN HAVALİMANLARI', 250, 40);
  const cx = W / 2, cy = 640;
  ctx.strokeStyle = 'rgba(120,170,255,0.22)'; ctx.lineWidth = 2;
  for (let r = 90; r <= 360; r += 90) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); }
  // sweep
  const a = T * 2.2;
  const g = ctx.createConicGradient ? ctx.createConicGradient(a - 0.8, cx, cy) : null;
  if (g) { g.addColorStop(0, 'rgba(90,150,255,0)'); g.addColorStop(0.12, 'rgba(90,150,255,0.18)'); g.addColorStop(0.125, 'rgba(90,150,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 360, 0, 7); ctx.fill(); }
  APTS.forEach((ap, i) => {
    const x = cx + ap.x, y = cy + ap.y; const on = p > 0.05 + i * 0.07;
    ctx.fillStyle = on ? '#ff3346' : '#4cff9a';
    ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.fill();
    if (on) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5); ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5); ctx.stroke(); }
    ctx.font = '800 22px IB'; ctx.textAlign = 'center'; ctx.fillStyle = on ? '#ff3346' : '#4cff9a'; ctx.fillText(ap.c, x, y + 36);
    ctx.font = '700 13px IB'; if (on) ctx.fillText('KAPALI', x, y + 54);
  });
  // home airport - hit
  const hx = cx - 20, hy = cy + 120; const hit = p > 0.48;
  if (hit) {
    const k = clamp((p - 0.48) / 0.3);
    ctx.save(); ctx.globalAlpha = (1 - k) * 0.9; ctx.fillStyle = '#ffb36b'; ctx.beginPath(); ctx.arc(hx, hy, 20 + k * 160, 0, 7); ctx.fill(); ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.9; ctx.strokeStyle = '#ff3346'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(hx, hy, 34 + Math.sin(T * 12) * 4, 0, 7); ctx.stroke(); ctx.restore();
  }
  ctx.fillStyle = hit ? '#ff3346' : '#ffd34d'; ctx.beginPath(); ctx.arc(hx, hy, 13, 0, 7); ctx.fill();
  ctx.font = '900 26px IK'; ctx.textAlign = 'center'; ctx.fillText('EVX', hx, hy + 44);
  ctx.font = '800 16px IB'; ctx.fillText(hit ? 'VURULDU' : 'DÖNÜŞ NOKTASI', hx, hy + 66);
  // our plane
  planeIcon(ctx, cx + 30, cy - 40, Math.PI * 0.62, 1.4, '#fff');
  // flashing banner
  if (hit && Math.floor(T * 4) % 2 === 0) { ctx.fillStyle = 'rgba(255,40,60,0.12)'; ctx.fillRect(0, 0, W, H); }
}

/* ---- Fuel gauge ---- */
export function drawFuel(ctx, p, T) {
  bgPanel(ctx, '#2a0b10', '#070204');
  title(ctx, 'YAKIT', 330, 54, '#ff4a5a');
  const cx = W / 2, cy = 690, R = 210;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 26; ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke();
  const lvl = lerp(0.24, 0.09, easeOut(p));
  ctx.strokeStyle = '#ff3346'; ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI * 0.8, Math.PI * (0.8 + 1.4 * lvl)); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = '800 28px IB'; ctx.textAlign = 'center';
  ctx.fillText('E', cx + Math.cos(Math.PI * 0.8) * (R + 50), cy + Math.sin(Math.PI * 0.8) * (R + 50));
  ctx.fillText('F', cx + Math.cos(Math.PI * 2.2) * (R + 50), cy + Math.sin(Math.PI * 2.2) * (R + 50));
  const na = Math.PI * (0.8 + 1.4 * lvl) + Math.sin(T * 30) * 0.01;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(na) * (R - 40), cy + Math.sin(na) * (R - 40)); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 7); ctx.fill();
  const blink = Math.floor(T * 3) % 2 === 0;
  ctx.font = '900 92px ID'; ctx.fillStyle = blink ? '#ff3346' : '#ffffff'; ctx.fillText('40 DK', cx, cy + 150);
  ctx.font = '700 22px IB'; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText('KALAN UÇUŞ SÜRESİ', cx, cy + 200);
}

/* ---- Window frame mask (looking out through an airplane window) ---- */
export function drawWindowFrame(ctx, k = 1, tint = '#cdd3de') {
  const ww = 470 * k, wh = 680 * k, x = (W - ww) / 2, y = (H - wh) / 2 - 40;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, H); rrPath(ctx, x, y, ww, wh, 200 * k);
  const wg = ctx.createLinearGradient(0, 0, W, 0); wg.addColorStop(0, '#2b303a'); wg.addColorStop(0.5, '#3a404b'); wg.addColorStop(1, '#262a33');
  ctx.fillStyle = wg; ctx.fill('evenodd');
  // bevel
  const g = ctx.createLinearGradient(0, y, 0, y + wh); g.addColorStop(0, '#8d95a3'); g.addColorStop(1, '#3b414c');
  ctx.lineWidth = 34 * k; ctx.strokeStyle = g; rr(ctx, x - 12, y - 12, ww + 24, wh + 24, 210 * k); ctx.stroke();
  ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; rr(ctx, x, y, ww, wh, 200 * k); ctx.stroke();
  // reflection streak
  ctx.save(); rr(ctx, x, y, ww, wh, 200 * k); ctx.clip();
  const rg = ctx.createLinearGradient(x, y, x + ww, y + wh); rg.addColorStop(0.2, 'rgba(255,255,255,0)'); rg.addColorStop(0.3, 'rgba(255,255,255,0.06)'); rg.addColorStop(0.36, 'rgba(255,255,255,0)');
  ctx.fillStyle = rg; ctx.fillRect(x, y, ww, wh); ctx.restore();
  ctx.restore();
}

/* ---- Simulator caption ---- */
export function drawSimCaption(ctx, p) {
  const a = ease(p * 4);
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; rr(ctx, 150, 170, 420, 128, 18); ctx.fill();
  ctx.textAlign = 'center'; ctx.fillStyle = '#3dff8a'; ctx.font = '800 26px IB'; ctx.fillText('SİMÜLATÖR: 400+ SAAT', W / 2, 222);
  ctx.fillStyle = '#ff4a5a'; ctx.fillText('GERÇEK UÇUŞ: 0', W / 2, 266);
  ctx.restore();
}

/* ---- Choice labels ---- */
export function badge(ctx, x, y, num, text, color, a = 1, pulse = 0) {
  ctx.save(); ctx.globalAlpha = a;
  ctx.font = '900 30px IK'; const tw = ctx.measureText(text).width;
  const w = tw + 84, h = 58; const bx = x - w / 2, by = y - h / 2;
  const s = 1 + pulse * 0.06; ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-x, -y);
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 18;
  ctx.fillStyle = 'rgba(14,16,22,0.88)'; rr(ctx, bx, by, w, h, 12); ctx.fill(); ctx.shadowBlur = 0;
  ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; rr(ctx, bx, by, w, h, 12); ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(bx + 32, y, 17, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '900 22px IK'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(num, bx + 32, y + 1);
  ctx.font = '900 30px IK'; ctx.textAlign = 'left'; ctx.fillText(text, bx + 60, y + 1);
  ctx.restore();
  return { x, y, w, h };
}
export function leader(ctx, x1, y1, x2, y2, color, a = 1) {
  ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x2, y2, 11, 0, 7); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x2, y2, 7, 0, 7); ctx.fill();
  ctx.restore();
}

export function bigText(ctx, text, y, size, a = 1, color = '#fff', font = 'ID') {
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 ${size}px ${font}`;
  ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 22; ctx.fillStyle = color; ctx.fillText(text, W / 2, y);
  ctx.restore();
}

/* ---- Post effects: vignette + grain + flash ---- */
const grains = [];
export function initGrain() {
  for (let i = 0; i < 6; i++) {
    const c = document.createElement('canvas'); c.width = 360; c.height = 640; const g = c.getContext('2d');
    const d = g.createImageData(360, 640);
    for (let j = 0; j < d.data.length; j += 4) { const v = Math.random() * 255; d.data[j] = d.data[j + 1] = d.data[j + 2] = v; d.data[j + 3] = 255; }
    g.putImageData(d, 0, 0); grains.push(c);
  }
}
export function post(ctx, T, opts = {}) {
  const { vignette = 0.75, grain = 0.06, flash = 0, red = 0 } = opts;
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${vignette})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (red > 0) { ctx.fillStyle = `rgba(255,20,30,${red})`; ctx.fillRect(0, 0, W, H); }
  if (grains.length) {
    ctx.save(); ctx.globalAlpha = grain; ctx.globalCompositeOperation = 'overlay';
    ctx.drawImage(grains[Math.floor(T * 24) % grains.length], 0, 0, W, H); ctx.restore();
  }
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${clamp(flash)})`; ctx.fillRect(0, 0, W, H); }
}
