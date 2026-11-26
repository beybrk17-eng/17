import * as THREE from 'three';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeOut = (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
export const easeIn = (t) => { t = clamp(t); return t * t * t; };
// smooth 1D noise for camera shake
export function noise1(x, seed = 0) {
  const h = (n) => { const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s); };
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
}

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.0, ...opts }));
  }
  return matCache.get(key);
}
export function emis(color, intensity = 1) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) });
}

const G = {
  sphere: new THREE.SphereGeometry(1, 28, 20),
  sphereLo: new THREE.SphereGeometry(1, 16, 12),
  halfSphere: new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 24),
};
export function capsule(r, len, m) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 16), m);
}
export function sph(r, m, lo = false) {
  const s = new THREE.Mesh(lo ? G.sphereLo : G.sphere, m); s.scale.setScalar(r); return s;
}
export function box(w, h, d, m) {
  const b = new THREE.Mesh(G.box, m); b.scale.set(w, h, d); return b;
}
export function cyl(r, h, m) {
  const c = new THREE.Mesh(G.cyl, m); c.scale.set(r, h, r); return c;
}
export function rbox(w, h, d, r, m) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  shape.moveTo(x + r, y); shape.lineTo(x + w - r, y); shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelThickness: Math.min(r, d) * 0.4, bevelSize: Math.min(r, d) * 0.4, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -d / 2);
  return new THREE.Mesh(g, m);
}

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.userData = { canvas: c, ctx, draw };
  return t;
}

export function glowSprite(color = '#ffffff', size = 1, opacity = 1) {
  const tex = canvasTex(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  const m = new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const s = new THREE.Sprite(m); s.scale.setScalar(size); return s;
}

/* ---------------- Toy figure ---------------- */
const SKIN = '#ecebe7';
export function makeFigure(o = {}) {
  const {
    top = '#3d4a63', pants = '#4b6aa6', hat = null, hatColor = '#c0392b', eyes = 'open',
    scale = 1, mask = false, vest = null, brows = false, pigtails = false, seated = true, seed = 1,
  } = o;
  const r = rng(seed);
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const topM = mat(top), pantsM = mat(pants), skinM = mat(SKIN, { roughness: 0.45 });
  const blackM = mat('#0c0d10', { roughness: 0.3 });

  // pelvis / torso
  const torso = capsule(0.23, 0.32, topM); torso.position.y = 0.86; body.add(torso);
  torso.scale.set(1, 1, 0.82);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.07, 10, 24), topM);
  collar.rotation.x = Math.PI / 2; collar.position.y = 1.13; body.add(collar);
  if (vest) {
    const v = capsule(0.245, 0.22, mat(vest)); v.position.y = 0.9; v.scale.set(1, 1, 0.84); body.add(v);
    // reflective stripe
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 24, 1, true), mat('#d9dde3', { roughness: 0.2, metalness: 0.3 }));
    st.position.y = 0.88; st.scale.z = 0.86; body.add(st);
  }
  // hoodie strings
  for (const sx of [-0.05, 0.05]) { const s = box(0.012, 0.12, 0.012, mat('#e8e8e8')); s.position.set(sx, 1.02, 0.205); body.add(s); }

  if (mask) {
    const mg = new THREE.Group();
    const face = sph(0.1, mat('#2b2f36', { roughness: 0.5 })); face.scale.set(0.11, 0.09, 0.06); mg.add(face);
    const f1 = cyl(0.045, 0.07, mat('#5c6470', { roughness: 0.4 })); f1.rotation.x = Math.PI / 2; f1.position.set(0, -0.02, 0.07); mg.add(f1);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 24, Math.PI), mat('#22252b'));
    strap.position.set(0, 0.03, -0.02); strap.rotation.z = 0; mg.add(strap);
    mg.position.set(0, 0.98, 0.2); body.add(mg);
  }

  // head
  const head = new THREE.Group(); head.position.y = 1.43; body.add(head);
  const skull = sph(0.27, skinM); skull.scale.set(0.27, 0.29, 0.26); head.add(skull);
  const eyeL = new THREE.Group(), eyeR = new THREE.Group();
  const mkEye = (grp, x) => {
    grp.position.set(x, 0.02, 0.235);
    const closed = box(0.075, 0.014, 0.02, blackM); closed.rotation.z = x > 0 ? -0.15 : 0.15; grp.add(closed);
    const xg = new THREE.Group();
    for (const a of [0.7, -0.7]) { const l = box(0.08, 0.016, 0.02, blackM); l.rotation.z = a; xg.add(l); }
    grp.add(xg);
    const og = new THREE.Group();
    const e = sph(1, blackM); e.scale.set(0.042, 0.058, 0.02); og.add(e);
    const hl = sph(1, emis('#ffffff', 1)); hl.scale.setScalar(0.013); hl.position.set(0.012, 0.02, 0.015); og.add(hl);
    grp.add(og);
    grp.userData = { pupil: e, closed, x: xg, open: og };
    head.add(grp);
  };
  mkEye(eyeL, -0.085); mkEye(eyeR, 0.085);
  // aim eyes slightly to surface
  eyeL.rotation.y = -0.33; eyeR.rotation.y = 0.33;
  let browL = null, browR = null;
  if (brows) {
    browL = box(0.07, 0.013, 0.02, blackM); browR = box(0.07, 0.013, 0.02, blackM);
    browL.position.set(-0.085, 0.105, 0.228); browR.position.set(0.085, 0.105, 0.228);
    browL.rotation.y = -0.33; browR.rotation.y = 0.33; head.add(browL, browR);
  }
  const mouth = sph(1, blackM); mouth.scale.set(0.022, 0.008, 0.012); mouth.position.set(0, -0.1, 0.25); head.add(mouth);

  // hats
  if (hat === 'beanie') {
    const hm = mat(hatColor, { roughness: 0.85 });
    const cap = new THREE.Mesh(G.halfSphere, hm); cap.scale.set(0.285, 0.27, 0.275); cap.position.y = 0.05; head.add(cap);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.272, 0.05, 10, 32), hm); rim.rotation.x = Math.PI / 2; rim.position.y = 0.07; rim.scale.set(1, 0.96, 1); head.add(rim);
    const pom = sph(0.07, hm); pom.position.y = 0.33; head.add(pom);
  } else if (hat === 'cap') {
    const hm = mat(hatColor, { roughness: 0.7 });
    const cap = new THREE.Mesh(G.halfSphere, hm); cap.scale.set(0.28, 0.2, 0.275); cap.position.y = 0.08; head.add(cap);
    const brim = cyl(1, 1, hm); brim.scale.set(0.17, 0.018, 0.14); brim.position.set(0, 0.085, 0.28); head.add(brim);
    const btn = sph(0.025, hm); btn.position.y = 0.285; head.add(btn);
  } else if (hat === 'pilot') {
    const top_ = cyl(1, 1, mat('#f3f3f3')); top_.scale.set(0.3, 0.09, 0.3); top_.position.y = 0.25; head.add(top_);
    const band = cyl(1, 1, mat('#15171c')); band.scale.set(0.265, 0.08, 0.265); band.position.y = 0.17; head.add(band);
    const brim = cyl(1, 1, mat('#0d0e11', { roughness: 0.25 })); brim.scale.set(0.15, 0.015, 0.13); brim.position.set(0, 0.14, 0.27); head.add(brim);
    const badge = sph(0.03, mat('#d4a93a', { metalness: 0.6, roughness: 0.3 })); badge.position.set(0, 0.2, 0.27); head.add(badge);
  } else if (hat === 'pillbox') {
    const p = cyl(1, 1, mat(hatColor)); p.scale.set(0.16, 0.09, 0.16); p.position.set(0.05, 0.27, 0.02); p.rotation.z = -0.2; head.add(p);
    const bun = sph(0.1, mat('#2a1d17')); bun.position.set(0, 0.08, -0.25); head.add(bun);
  } else if (hat === 'hair') {
    const hm = mat(hatColor, { roughness: 0.8 });
    const hcap = new THREE.Mesh(G.halfSphere, hm); hcap.scale.set(0.285, 0.25, 0.28); hcap.position.y = 0.04; hcap.rotation.x = -0.25; head.add(hcap);
  }
  if (pigtails) {
    const hm = mat('#3a2418', { roughness: 0.8 });
    const hcap = new THREE.Mesh(G.halfSphere, hm); hcap.scale.set(0.285, 0.25, 0.28); hcap.position.y = 0.04; hcap.rotation.x = -0.3; head.add(hcap);
    for (const sx of [-1, 1]) { const p = sph(0.1, hm); p.position.set(sx * 0.29, 0.05, -0.05); head.add(p); const t = sph(0.03, mat('#ff4f8b')); t.position.set(sx * 0.24, 0.07, -0.04); head.add(t); }
  }

  // arms: pivot at shoulder
  const mkArm = (sx) => {
    const piv = new THREE.Group(); piv.position.set(sx * 0.27, 1.06, 0);
    const up = capsule(0.075, 0.26, topM); up.position.y = -0.17; piv.add(up);
    const hand = sph(0.075, skinM); hand.position.y = -0.38; piv.add(hand);
    piv.userData.hand = hand;
    body.add(piv); return piv;
  };
  const armL = mkArm(-1), armR = mkArm(1);
  // legs
  const mkLeg = (sx) => {
    const piv = new THREE.Group(); piv.position.set(sx * 0.12, 0.55, 0);
    const thigh = capsule(0.095, 0.3, pantsM); thigh.position.y = -0.2; piv.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.4; piv.add(knee);
    const shin = capsule(0.085, 0.28, pantsM); shin.position.y = -0.18; knee.add(shin);
    const shoe = sph(1, mat('#f2f2f2', { roughness: 0.5 })); shoe.scale.set(0.1, 0.07, 0.15); shoe.position.set(0, -0.37, 0.05); knee.add(shoe);
    piv.userData.knee = knee; body.add(piv); return piv;
  };
  const legL = mkLeg(-1), legR = mkLeg(1);

  const fig = { g, body, head, eyeL, eyeR, browL, browR, mouth, armL, armR, legL, legR, torso };
  fig.setEyeMode = (m) => { for (const e of [eyeL, eyeR]) { e.userData.closed.visible = m === 'closed'; e.userData.x.visible = m === 'x'; e.userData.open.visible = m === 'open'; } };
  fig.setEyeMode(eyes);
  setPose(fig, seated ? 'sit' : 'stand');
  g.scale.setScalar(scale);
  // random tiny variation
  head.rotation.z = (r() - 0.5) * 0.08;
  return fig;
}

export function setPose(f, pose) {
  if (pose === 'sit') {
    f.body.position.y = -0.1;
    for (const l of [f.legL, f.legR]) { l.rotation.x = -Math.PI / 2 + 0.05; l.userData.knee.rotation.x = Math.PI / 2 - 0.05; }
    f.armL.rotation.set(-0.55, 0, -0.08); f.armR.rotation.set(-0.55, 0, 0.08);
  } else {
    f.body.position.y = 0.4;
    for (const l of [f.legL, f.legR]) { l.rotation.x = 0; l.userData.knee.rotation.x = 0; }
    f.armL.rotation.set(0.05, 0, -0.1); f.armR.rotation.set(0.05, 0, 0.1);
  }
}

export function setEyes(f, sx, sy) { // scale eyes (fear = bigger)
  for (const e of [f.eyeL, f.eyeR]) if (e.userData.pupil) e.userData.pupil.scale.set(0.042 * sx, 0.058 * sy, 0.02);
}
