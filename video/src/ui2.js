// Redesigned motion-graphics screens (map, radar, fuel) – HUD style
import { clamp, ease, easeOut, lerp, rng } from './lib.js';
import { W, H, rr } from './ui.js';

const C = { bg0: '#03060d', bg1: '#0a1426', cyan: '#62d4ff', red: '#ff3b4e', amber: '#ffb020', white: '#f3f6fb', dim: 'rgba(170,200,255,0.45)' };

function glow(ctx, color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
function noGlow(ctx) { ctx.shadowBlur = 0; }

function backdrop(ctx, T, accent = C.cyan, warm = false) {
  const g = ctx.createRadialGradient(W / 2, H * 0.46, 40, W / 2, H * 0.5, H * 0.75);
  g.addColorStop(0, warm ? '#1d0a10' : C.bg1); g.addColorStop(1, C.bg0);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // dot grid
  ctx.fillStyle = warm ? 'rgba(255,90,100,0.07)' : 'rgba(120,180,255,0.07)';
  for (let y = 20; y < H; y += 32) for (let x = 20; x < W; x += 32) ctx.fillRect(x, y, 2, 2);
  // scanline drift
  const sy = (T * 90) % H;
  const sg = ctx.createLinearGradient(0, sy - 60, 0, sy);
  sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(1, warm ? 'rgba(255,80,90,0.05)' : 'rgba(120,200,255,0.05)');
  ctx.fillStyle = sg; ctx.fillRect(0, sy - 60, W, 60);
  // HUD corner brackets
  ctx.strokeStyle = warm ? 'rgba(255,90,100,0.55)' : 'rgba(98,212,255,0.55)'; ctx.lineWidth = 3;
  const m = 34, L = 46;
  for (const [x, y, sx, sy2] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x, y + sy2 * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); ctx.stroke();
  }
}

function header(ctx, kicker, titleTxt, T, warm = false, a = 1) {
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // live chip
  const blink = Math.floor(T * 2) % 2 === 0;
  ctx.font = '700 17px IB'; ctx.letterSpacing = '3px';
  const kw = ctx.measureText(kicker).width + 56;
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; rr(ctx, W / 2 - kw / 2, 150, kw, 38, 19); ctx.fill();
  ctx.strokeStyle = warm ? 'rgba(255,80,90,0.5)' : 'rgba(98,212,255,0.4)'; ctx.lineWidth = 1.5; rr(ctx, W / 2 - kw / 2, 150, kw, 38, 19); ctx.stroke();
  ctx.fillStyle = blink ? C.red : 'rgba(255,59,78,0.35)'; ctx.beginPath(); ctx.arc(W / 2 - kw / 2 + 22, 169, 6, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(230,240,255,0.85)'; ctx.fillText(kicker, W / 2 + 10, 170);
  ctx.letterSpacing = '0px';
  ctx.font = '900 54px ID'; glow(ctx, warm ? 'rgba(255,60,80,0.6)' : 'rgba(98,212,255,0.45)', 24); ctx.fillStyle = C.white;
  ctx.fillText(titleTxt, W / 2, 238); noGlow(ctx);
  ctx.restore();
}

function chip(ctx, x, y, text, color, filled = true, size = 15) {
  ctx.save(); ctx.font = `800 ${size}px IB`; ctx.letterSpacing = '1.5px'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 20, h = size + 13;
  if (filled) { ctx.fillStyle = color; rr(ctx, x - w / 2, y - h / 2, w, h, 6); ctx.fill(); ctx.fillStyle = '#fff'; }
  else { ctx.strokeStyle = color; ctx.lineWidth = 2; rr(ctx, x - w / 2, y - h / 2, w, h, 6); ctx.stroke(); ctx.fillStyle = color; }
  ctx.fillText(text, x, y + 1); ctx.restore();
}

export function planeGlyph(ctx, x, y, ang, s = 1, color = '#fff') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s); ctx.fillStyle = color;
  glow(ctx, color, 14);
  ctx.beginPath();
  ctx.moveTo(22, 0); ctx.quadraticCurveTo(24, -3, 18, -3); ctx.lineTo(4, -3); ctx.lineTo(-6, -18); ctx.lineTo(-11, -18); ctx.lineTo(-5, -3);
  ctx.lineTo(-15, -3); ctx.lineTo(-20, -9); ctx.lineTo(-23, -9); ctx.lineTo(-20, 0); ctx.lineTo(-23, 9); ctx.lineTo(-20, 9); ctx.lineTo(-15, 3);
  ctx.lineTo(-5, 3); ctx.lineTo(-11, 18); ctx.lineTo(-6, 18); ctx.lineTo(4, 3); ctx.lineTo(18, 3); ctx.quadraticCurveTo(24, 3, 22, 0);
  ctx.fill(); ctx.restore();
}

/* ---------- landmass for the map (procedural) ---------- */
let landCanvas = null;
function land() {
  if (landCanvas) return landCanvas;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const r = rng(31);
  const blob = (cx, cy, R, n = 90, rough = 0.28) => {
    const ph = [r() * 6, r() * 6, r() * 6];
    g.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2;
      const k = 1 + rough * (Math.sin(a * 3 + ph[0]) * 0.5 + Math.sin(a * 7 + ph[1]) * 0.3 + Math.sin(a * 13 + ph[2]) * 0.2);
      const x = cx + Math.cos(a) * R * k * 1.15, y = cy + Math.sin(a) * R * k;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
  };
  const shapes = [[40, 560, 190], [-20, 820, 160], [690, 470, 170], [760, 760, 210], [600, 1010, 120], [140, 1060, 110]];
  g.fillStyle = '#0f1d36'; g.strokeStyle = 'rgba(98,212,255,0.35)'; g.lineWidth = 2;
  for (const [x, y, R] of shapes) { blob(x, y, R); g.fill(); g.stroke(); }
  // city lights
  for (let i = 0; i < 260; i++) {
    const [x, y, R] = shapes[Math.floor(r() * shapes.length)];
    const a = r() * 6.28, d = Math.sqrt(r()) * R * 0.85;
    g.fillStyle = `rgba(255,210,140,${0.25 + r() * 0.5})`; g.fillRect(x + Math.cos(a) * d * 1.1, y + Math.sin(a) * d, 2, 2);
  }
  landCanvas = c; return c;
}

/* ---------- ROUTE: airspace closed, U-turn ---------- */
export function drawRoute(ctx, p, T) {
  backdrop(ctx, T);
  ctx.drawImage(land(), 0, 0);
  header(ctx, 'ROTA GÜNCELLEMESİ', 'GERİ DÖNÜYORUZ', T);
  const A = { x: 120, y: 860 }, B = { x: 600, y: 600 };
  const ctrl = { x: 300, y: 520 };
  const bez = (u) => ({ x: (1 - u) ** 2 * A.x + 2 * (1 - u) * u * ctrl.x + u * u * B.x, y: (1 - u) ** 2 * A.y + 2 * (1 - u) * u * ctrl.y + u * u * B.y });
  // closed airspace (hatched)
  const zp = easeOut(p * 2.5);
  ctx.save();
  ctx.beginPath(); ctx.arc(520, 610, 190 * zp, 0, 7); ctx.clip();
  ctx.fillStyle = 'rgba(255,59,78,0.12)'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,59,78,0.35)'; ctx.lineWidth = 3;
  for (let i = -H; i < W + H; i += 22) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke(); }
  ctx.restore();
  ctx.save(); ctx.strokeStyle = C.red; ctx.lineWidth = 3; glow(ctx, C.red, 16); ctx.setLineDash([12, 8]);
  ctx.beginPath(); ctx.arc(520, 610, 190 * zp, 0, 7); ctx.stroke(); ctx.restore();
  if (zp > 0.6) chip(ctx, 520, 610 - 190 - 4, 'KAPALI HAVA SAHASI', C.red, true, 15);
  // planned route
  ctx.save(); ctx.setLineDash([3, 10]); ctx.lineCap = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); for (let i = 0; i <= 60; i++) { const q = bez(i / 60); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); } ctx.stroke(); ctx.restore();
  for (const [q, code] of [[A, 'KALKIŞ'], [B, 'VARIŞ']]) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q.x, q.y, 8, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y, 16, 0, 7); ctx.stroke();
    ctx.font = '800 15px IB'; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.textAlign = 'center'; ctx.fillText(code, q.x, q.y + 38);
  }
  // flown path + U-turn
  const u0 = 0.52, c = bez(u0);
  const path = []; for (let i = 0; i <= 40; i++) path.push(bez(u0 * i / 40));
  const tangent = Math.atan2(bez(u0 + 0.01).y - c.y, bez(u0 + 0.01).x - c.x);
  const R = 62, nx = Math.cos(tangent - Math.PI / 2), ny = Math.sin(tangent - Math.PI / 2);
  const cc = { x: c.x + nx * R, y: c.y + ny * R };
  const a0 = Math.atan2(c.y - cc.y, c.x - cc.x);
  const turn = []; for (let i = 1; i <= 50; i++) { const a = a0 + Math.PI * i / 50 * -1; turn.push({ x: cc.x + Math.cos(a) * R, y: cc.y + Math.sin(a) * R }); }
  const end = turn[turn.length - 1];
  for (let i = 1; i <= 30; i++) turn.push({ x: end.x - Math.cos(tangent) * i * 7, y: end.y - Math.sin(tangent) * i * 7 });
  const k = easeOut(clamp((p - 0.12) / 0.8));
  const n = Math.max(1, Math.floor(turn.length * k));
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = C.amber; ctx.lineWidth = 6; glow(ctx, C.amber, 18);
  ctx.beginPath(); path.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); for (let i = 0; i < n; i++) ctx.lineTo(turn[i].x, turn[i].y); ctx.stroke(); ctx.restore();
  const cur = turn[n - 1], prev = turn[Math.max(0, n - 2)];
  const ang = n > 1 ? Math.atan2(cur.y - prev.y, cur.x - prev.x) : tangent;
  planeGlyph(ctx, cur.x, cur.y, ang, 1.6, '#ffffff');
  // telemetry strip
  ctx.save(); ctx.fillStyle = 'rgba(8,14,28,0.85)'; rr(ctx, 70, 1060, W - 140, 86, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(98,212,255,0.3)'; ctx.lineWidth = 1.5; rr(ctx, 70, 1060, W - 140, 86, 16); ctx.stroke();
  ctx.textAlign = 'center';
  const cols = [['İRTİFA', '36.000 FT'], ['HIZ', '870 KM/S'], ['YÖN', `${String(Math.round(lerp(78, 258, k))).padStart(3, '0')}°`]];
  cols.forEach(([l, v], i) => { const x = 70 + (W - 140) * (i + 0.5) / 3; ctx.font = '700 13px IB'; ctx.fillStyle = C.dim; ctx.fillText(l, x, 1092); ctx.font = '900 24px IK'; ctx.fillStyle = '#fff'; ctx.fillText(v, x, 1124); });
  ctx.restore();
}

/* ---------- RADAR: every airport closed, home airport hit ---------- */
const APTS = [
  { c: 'KRV', a: -2.2, d: 260 }, { c: 'DLM', a: -0.9, d: 300 }, { c: 'SNK', a: 2.9, d: 220 },
  { c: 'TRZ', a: 0.35, d: 250 }, { c: 'ORD', a: 1.9, d: 290 }, { c: 'BLK', a: 1.05, d: 170 },
];
export function drawRadar(ctx, p, T) {
  backdrop(ctx, T);
  header(ctx, 'ACİL DURUM', 'İNECEK YER YOK', T);
  const cx = W / 2, cy = 680, RM = 300;
  // scope
  const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, RM);
  sg.addColorStop(0, 'rgba(30,70,120,0.35)'); sg.addColorStop(1, 'rgba(10,25,50,0.15)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, RM, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(98,212,255,0.22)'; ctx.lineWidth = 1.5;
  for (let r = 75; r <= RM; r += 75) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(cx - RM, cy); ctx.lineTo(cx + RM, cy); ctx.moveTo(cx, cy - RM); ctx.lineTo(cx, cy + RM); ctx.stroke();
  ctx.font = '700 12px IB'; ctx.fillStyle = C.dim; ctx.textAlign = 'left';
  [50, 100, 150, 200].forEach((nm, i) => ctx.fillText(`${nm} NM`, cx + 6, cy - 75 * (i + 1) + 14));
  ctx.strokeStyle = 'rgba(98,212,255,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, RM, 0, 7); ctx.stroke();
  // sweep with trail
  const sa = T * 2.4;
  for (let i = 0; i < 24; i++) {
    const a = sa - i * 0.035;
    ctx.strokeStyle = `rgba(98,212,255,${0.32 * (1 - i / 24)})`; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * RM, cy + Math.sin(a) * RM); ctx.stroke();
  }
  // airports
  APTS.forEach((ap, i) => {
    const x = cx + Math.cos(ap.a) * ap.d, y = cy + Math.sin(ap.a) * ap.d;
    const off = p > 0.08 + i * 0.065;
    const col = off ? C.red : '#43f59a';
    ctx.save(); glow(ctx, col, 14); ctx.strokeStyle = col; ctx.lineWidth = 3;
    ctx.strokeRect(x - 9, y - 9, 18, 18);
    if (off) { ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke(); }
    noGlow(ctx);
    ctx.font = '900 20px IK'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(ap.c, x, y - 22);
    ctx.restore();
    if (off) chip(ctx, x, y + 30, 'KAPALI', C.red, true, 12);
  });
  // home airport
  const hx = cx - 30, hy = cy + 110, hit = p > 0.5;
  if (hit) {
    const k = clamp((p - 0.5) / 0.35);
    ctx.save(); ctx.globalAlpha = 1 - k; const eg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 40 + k * 200);
    eg.addColorStop(0, 'rgba(255,220,160,0.95)'); eg.addColorStop(0.4, 'rgba(255,90,40,0.6)'); eg.addColorStop(1, 'rgba(255,40,40,0)');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(hx, hy, 40 + k * 200, 0, 7); ctx.fill(); ctx.restore();
    ctx.save(); ctx.strokeStyle = C.red; glow(ctx, C.red, 20); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(hx, hy, 30 + Math.sin(T * 14) * 4, 0, 7); ctx.stroke(); ctx.restore();
  }
  ctx.save(); const hc = hit ? C.red : C.amber; glow(ctx, hc, 18); ctx.fillStyle = hc; ctx.beginPath(); ctx.arc(hx, hy, 11, 0, 7); ctx.fill(); ctx.restore();
  ctx.font = '900 24px IK'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('EVX', hx, hy - 26);
  chip(ctx, hx, hy + 36, hit ? 'VURULDU' : 'DÖNÜŞ NOKTASI', hit ? C.red : C.amber, true, 15);
  planeGlyph(ctx, cx + 10, cy - 30, -Math.PI * 0.6, 1.5, '#fff');
  // status bar
  const closed = APTS.filter((_, i) => p > 0.08 + i * 0.065).length + (hit ? 1 : 0);
  ctx.save(); ctx.fillStyle = 'rgba(8,14,28,0.85)'; rr(ctx, 110, 1060, W - 220, 70, 35); ctx.fill();
  ctx.font = '900 24px IK'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = closed >= 7 ? C.red : '#fff';
  ctx.fillText(`KAPALI HAVALİMANI: ${closed} / 7`, W / 2, 1096); ctx.restore();
  if (hit && Math.floor(T * 5) % 2 === 0) { ctx.fillStyle = 'rgba(255,40,60,0.08)'; ctx.fillRect(0, 0, W, H); }
}

/* ---------- FUEL: EICAS style ---------- */
export function drawFuel(ctx, p, T) {
  backdrop(ctx, T, C.red, true);
  header(ctx, 'YAKIT UYARISI', 'KIRK DAKİKA', T, true);
  const blink = Math.floor(T * 3) % 2 === 0;
  // panel
  const px = 90, py = 340, pw = W - 180, ph = 620;
  ctx.save(); ctx.fillStyle = 'rgba(6,8,12,0.9)'; rr(ctx, px, py, pw, ph, 22); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2; rr(ctx, px, py, pw, ph, 22); ctx.stroke(); ctx.restore();
  // tanks
  const lvl = lerp(0.2, 0.1, easeOut(p));
  [['SOL', px + 120], ['SAĞ', px + pw - 120]].forEach(([lab, x]) => {
    const ty = py + 70, th = 360, tw = 90;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; rr(ctx, x - tw / 2, ty, tw, th, 10); ctx.stroke();
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - tw / 2, ty + th * i / 4); ctx.lineTo(x - tw / 2 + 16, ty + th * i / 4); ctx.stroke(); }
    const fh = th * lvl;
    ctx.save(); glow(ctx, C.red, 22); ctx.fillStyle = blink ? C.red : '#b3202e'; rr(ctx, x - tw / 2 + 6, ty + th - fh - 6 + 6, tw - 12, fh - 6, 6); ctx.fill(); ctx.restore();
    ctx.font = '800 16px IB'; ctx.fillStyle = C.dim; ctx.textAlign = 'center'; ctx.fillText(lab, x, ty + th + 34);
  });
  // center readout
  ctx.textAlign = 'center';
  ctx.font = '700 15px IB'; ctx.fillStyle = C.dim; ctx.fillText('KALAN SÜRE', W / 2, py + 170);
  const secs = 40 * 60 - Math.floor(p * 6);
  ctx.save(); glow(ctx, 'rgba(255,59,78,0.8)', 26); ctx.font = '900 84px IK'; ctx.fillStyle = blink ? C.red : '#fff';
  ctx.fillText(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, W / 2, py + 250); ctx.restore();
  ctx.font = '700 15px IB'; ctx.fillStyle = C.dim; ctx.fillText('YAKIT', W / 2, py + 330);
  ctx.font = '900 34px IK'; ctx.fillStyle = '#fff'; ctx.fillText(`${Math.round(lerp(4800, 4650, p)).toLocaleString('tr-TR')} KG`, W / 2, py + 372);
  // caution box
  ctx.save(); ctx.fillStyle = blink ? C.amber : 'rgba(255,176,32,0.25)'; rr(ctx, W / 2 - 170, py + ph - 130, 340, 74, 12); ctx.fill();
  ctx.font = '900 30px IK'; ctx.fillStyle = blink ? '#1a1000' : C.amber; ctx.fillText('DÜŞÜK YAKIT', W / 2, py + ph - 82); ctx.restore();
}
