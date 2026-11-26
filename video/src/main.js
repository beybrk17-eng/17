import * as THREE from 'three';
import { clamp, lerp, ease, easeOut, easeIn, noise1, setPose, setEyes, rng } from './lib.js';
import { buildExterior, buildCabin, buildCockpit, buildRoom, drawSeatbelt, drawPFD, drawSimScreen, ROW } from './world.js';
import * as UI from './ui.js';
import { makePost } from './post.js';
import * as UI2 from './ui2.js';

const { W, H } = UI;
const glc = document.getElementById('gl');
const uic = document.getElementById('ui');
const ctx = uic.getContext('2d');
export const RW = 1080, RH = 1920, SCALE = RW / W;
const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const cam = new THREE.PerspectiveCamera(45, W / H, 0.05, 20000);
let EXT, CAB, CKP, ROOM, POST, FOCUS = 2;

export const DURATION = 93;

/* ---------- helpers ---------- */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function shake(T, amp, freq = 9) {
  return V(noise1(T * freq, 1) * amp, noise1(T * freq, 2) * amp, noise1(T * freq, 3) * amp * 0.5);
}
function place(from, to, look1, look2, p, fov = 45, shk = null) {
  cam.fov = fov; cam.updateProjectionMatrix();
  cam.position.lerpVectors(from, to, p);
  if (shk) cam.position.add(shk);
  const l = look2 ? look1.clone().lerp(look2, p) : look1;
  cam.lookAt(l); FOCUS = cam.position.distanceTo(l);
}
function project(v) {
  const p = v.clone().project(cam);
  return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H, behind: p.z > 1 };
}

/* ---------- per-set resets ---------- */
const PLANE_Y = 300;
function resetExt(T) {
  const A = EXT.airliner;
  A.g.position.set(0, PLANE_Y, 0); A.g.rotation.set(0, 0, 0);
  A.g.position.y += Math.sin(T * 0.7) * 0.6;
  A.g.rotation.z = Math.sin(T * 0.5) * 0.015;
  A.beacon.material.opacity = (T % 1.2) < 0.15 ? 1 : 0.05;
  A.strobe.material.opacity = (T % 1.5) < 0.06 ? 1 : 0.0;
  A.fire.visible = false;
  EXT.floor.t.value = T; EXT.floor.mode.value = 0; EXT.floor.flash.value = 0;
  EXT.sky.glow.value = 0;
  EXT.jet.g.visible = false; EXT.jet.g.position.set(-32, PLANE_Y + 2, -200); EXT.jet.g.rotation.set(0, 0, 0);
  EXT.jet.pilot.rotation.set(0, 0, 0); EXT.jet.arm.rotation.set(0, 0, 0); EXT.jet.paper.visible = false;
  EXT.missiles.g.rotation.y = 0; EXT.missiles.g.position.set(0, 0, 0); EXT.missiles.update(-1);
  EXT.fireL.intensity = 0;
  EXT.scene.fog.near = 400; EXT.scene.fog.far = 5200;
}
const MISSILE_T0 = 18.9;
function missiles(T, rotY) {
  EXT.missiles.g.rotation.y = rotY;
  const t = T - MISSILE_T0;
  EXT.missiles.update(t, T < 23.4 ? 1 : 99);
  EXT.sky.glow.value = clamp((T - 21) / 6) * 0.6;
}

let passengerSleep = [];
function resetCab(T) {
  const C = CAB;
  setPose(C.hero, 'sit');
  C.hero.g.position.set(C.heroPos.x, 0.36, C.heroPos.z + 0.02); C.hero.g.rotation.set(0, Math.PI, 0);
  C.hero.head.rotation.set(0.05, 0, 0); C.hero.setEyeMode('open'); setEyes(C.hero, 1, 1);
  C.hero.browL.rotation.z = 0; C.hero.browR.rotation.z = 0; C.hero.browL.position.y = 0.105; C.hero.browR.position.y = 0.105;
  C.hero.mouth.scale.set(0.022, 0.008, 0.012);
  C.hero.body.rotation.set(0, 0, 0);
  C.girl.head.rotation.set(0.1, -0.5, 0.25); C.girl.setEyeMode('closed'); C.girl.armL.rotation.set(-0.55, 0, -0.08); C.girl.armR.rotation.set(-0.55, 0, 0.08);
  C.girl.mouth.scale.set(0.022, 0.008, 0.012);
  C.passengers.forEach((f, i) => { f.setEyeMode('closed'); f.head.rotation.set(passengerSleep[i].x, passengerSleep[i].y, passengerSleep[i].z); f.g.visible = true; });
  C.steward.g.visible = false; C.steward.g.rotation.set(0, 0, 0); setPose(C.steward, 'stand');
  C.door.position.x = 0; C.doorL.intensity = 0;
  C.lights.red.intensity = 0; C.lights.pl1.intensity = 2.2; C.lights.pl2.intensity = 2.0; C.lights.hemi.intensity = 0.55; C.lights.winL.intensity = 0; C.lights.read.intensity = 2.2;
  C.stripM.color.setRGB(1.6, 1.75, 2.0);
  setSeatbelt(T >= 11.42 ? 1 : 0);
  C.scene.fog.near = 6; C.scene.fog.far = 19;
}
function wake(level = 1, T = 0) {
  const r = rng(5);
  CAB.passengers.forEach((f, i) => {
    f.setEyeMode('open');
    f.head.rotation.set(-0.05 + r() * 0.1, (r() - 0.5) * 0.6 * level, (r() - 0.5) * 0.1);
  });
  CAB.girl.setEyeMode('open'); CAB.girl.head.rotation.set(-0.15, -0.6, 0.05);
}
let sbState = -1;
function setSeatbelt(on) {
  if (on === sbState) return; sbState = on;
  const t = CAB.sbTex; drawSeatbelt(t.userData.ctx, 256, 128, on); t.needsUpdate = true;
}
function alarm(T, k = 1) {
  const f = (Math.sin(T * 7) * 0.5 + 0.5);
  CAB.lights.red.intensity = (1.5 + f * 4.5) * k;
  const flick = noise1(T * 14, 4) > 0.8 ? 0.25 : 1;
  CAB.lights.pl1.intensity = lerp(2.2, 0.9, k) * flick;
  CAB.lights.pl2.intensity = lerp(2.0, 0.6, k);
  CAB.lights.hemi.intensity = lerp(0.55, 0.4, k);
  CAB.stripM.color.setRGB(lerp(1.6, 2.6 * (0.5 + 0.5 * f), k), lerp(1.75, 0.15, k), lerp(2.0, 0.2, k));
}
function hideNear(p, r) { CAB.passengers.forEach(f => { if (f.g.position.distanceTo(p) < r) f.g.visible = false; }); }
function doorOpen(k) { CAB.door.position.x = lerp(0, 1.0, ease(k)); CAB.doorL.intensity = 3 * ease(k); }

/* ---------- SHOTS ---------- */
// each: [start, end, set, fn(lt, p, T) -> {ui?, post?, filter?}]
const HP = () => CAB.heroPos;
const heroHead = () => V(HP().x, 1.67, HP().z + 0.02);

const SHOTS = [
  // 0 HOOK – exterior wide, push in
  [0, 2.42, 'ext', (lt, p, T) => {
    resetExt(T);
    place(V(-95, 288, 120), V(-62, 293, 78), V(0, PLANE_Y, 0), V(0, PLANE_Y + 1, 5), easeOut(p), 42);
    return { post: { flash: clamp(1 - lt * 3) } };
  }],
  // 1 hero awake among sleepers
  [2.42, 5.75, 'cab', (lt, p, T) => {
    resetCab(T); hideNear(V(HP().x, 0.36, HP().z - ROW), 0.3); hideNear(V(HP().x + 0.52, 0.36, HP().z - ROW), 0.3);
    CAB.hero.head.rotation.set(0.05, 0.25 + Math.sin(T) * 0.05, 0);
    CAB.lights.winL.intensity = 0.5;
    const h = heroHead();
    place(V(h.x + 0.55, 1.8, h.z - 1.9), V(h.x + 0.3, 1.76, h.z - 1.45), h.clone().add(V(0.15, -0.12, 0)), h.clone().add(V(0.05, -0.05, 0)), ease(p), 44);
  }],
  // 2 exterior tracking with moon
  [5.75, 8.75, 'ext', (lt, p, T) => {
    resetExt(T);
    place(V(70, 312, -40), V(64, 311, -20), V(-10, PLANE_Y + 6, 30), null, p, 48, shake(T, 0.3, 1.5));
  }],
  // 3 aisle wide, sleeping cabin
  [8.75, 11.38, 'cab', (lt, p, T) => {
    resetCab(T);
    place(V(0.05, 2.3, 12.4), V(0.0, 2.25, 10.6), V(0, 1.2, -4), null, ease(p), 50);
  }],
  // 4 seatbelt sign + speaker
  [11.38, 14.05, 'cab', (lt, p, T) => {
    resetCab(T);
    hideNear(V(-1.55, 0.36, HP().z + ROW), 0.3); hideNear(V(-1.03, 0.36, HP().z + ROW), 0.3);
    const pz = CAB.panel.position;
    place(V(pz.x + 0.75, pz.y - 0.55, pz.z + 0.25), V(pz.x + 0.55, pz.y - 0.42, pz.z + 0.2), V(pz.x, pz.y - 0.03, pz.z + 0.05), null, ease(p), 34);
    return { post: { vignette: 0.85 } };
  }],
  // 5 hero reacts: "hava sahası kapatıldı"
  [14.05, 16.9, 'cab', (lt, p, T) => {
    resetCab(T); hideNear(V(HP().x, 0.36, HP().z - ROW), 0.3); hideNear(V(HP().x + 0.52, 0.36, HP().z - ROW), 0.3);
    const k = ease((T - 15.4) / 0.35);
    setEyes(CAB.hero, 1 + k * 0.35, 1 + k * 0.4);
    CAB.hero.browL.position.y = CAB.hero.browR.position.y = 0.105 + k * 0.03;
    CAB.hero.browL.rotation.z = -0.25 * k; CAB.hero.browR.rotation.z = 0.25 * k;
    CAB.hero.mouth.scale.set(0.022 - k * 0.006, 0.008 + k * 0.014, 0.012);
    CAB.hero.head.rotation.set(0.0, 0.12 * (1 - k), 0);
    const h = heroHead();
    place(V(h.x + 0.1, 1.74, h.z - 1.45), V(h.x + 0.05, 1.72, h.z - 1.12), h.clone().add(V(0, -0.04, 0)), null, ease(p), 40, shake(T, 0.004, 3));
  }],
  // 6 through the window: horizon, first lights rising
  [16.9, 21.05, 'ext', (lt, p, T) => {
    resetExt(T); missiles(T, Math.PI / 2);
    place(V(-1.7, PLANE_Y + 0.8, 4.2), V(-2.0, PLANE_Y + 0.75, 4.2), V(-300, PLANE_Y - 22, -20), V(-300, PLANE_Y + 4, -10), ease(p), 52);
    return { ui: () => UI.drawWindowFrame(ctx, 1) };
  }],
  // 7 behind the plane: one missile, then ten
  [21.05, 24.6, 'ext', (lt, p, T) => {
    resetExt(T); missiles(T, Math.PI);
    place(V(16, PLANE_Y + 14, -78), V(12, PLANE_Y + 13, -66), V(0, PLANE_Y + 70, 400), null, p, 52, shake(T, 0.2, 2));
  }],
  // 8 telephoto on missiles: "bunlar yıldız değil... füze"
  [24.6, 27.12, 'ext', (lt, p, T) => {
    resetExt(T); missiles(T, Math.PI);
    EXT.missiles.g.updateMatrixWorld(true);
    const tgt = V(0, 0, 0); let n = 0;
    EXT.missiles.list.forEach(m => { if (m.head.visible) { const v = new THREE.Vector3(); m.head.getWorldPosition(v); tgt.add(v); n++; } });
    if (n) tgt.multiplyScalar(1 / n); else tgt.set(0, 900, 3000);
    tgt.y -= 150;
    const punch = T > 26.35 ? ease((T - 26.35) / 0.25) : 0;
    place(V(0, PLANE_Y + 6, 10), V(0, PLANE_Y + 6, 10), tgt, null, p, lerp(lerp(40, 32, p), 22, punch), shake(T, 0.08 + punch * 0.4, 6));
    return { post: { red: punch * 0.12 * (0.6 + 0.4 * Math.sin(T * 20)) } };
  }],
  // 9 hard bank turn
  [27.12, 28.98, 'ext', (lt, p, T) => {
    resetExt(T); missiles(T, Math.PI);
    const b = ease(p * 1.3);
    EXT.airliner.g.rotation.z = -0.55 * b; EXT.airliner.g.rotation.y = 0.25 * b;
    place(V(-30, PLANE_Y - 6, -55), V(-26, PLANE_Y - 4, -48), V(0, PLANE_Y + 4, 10), null, p, 46, shake(T, 0.5, 4));
  }],
  // 10 route map U-turn
  [28.98, 30.14, 'ui', (lt, p, T) => ({ ui: () => UI2.drawRoute(ctx, clamp(lt / 1.1), T), post: { vignette: 0.5 } })],
  // 11 hero turns to window
  [30.14, 31.62, 'cab', (lt, p, T) => {
    resetCab(T); hideNear(V(HP().x, 0.36, HP().z - ROW), 0.3); hideNear(V(HP().x + 0.52, 0.36, HP().z - ROW), 0.3);
    CAB.hero.head.rotation.set(0, lerp(0, 1.05, easeOut((lt - 0.25) / 0.6)), 0);
    CAB.lights.winL.intensity = 0.6;
    const h = heroHead();
    place(V(h.x + 0.45, 1.78, h.z - 1.75), V(h.x + 0.32, 1.76, h.z - 1.45), h.clone().add(V(0.05, -0.08, 0)), null, ease(p), 42);
  }],
  // 12 window: fighter slides in next to the wing
  [31.62, 34.83, 'ext', (lt, p, T) => {
    resetExt(T); missiles(T, Math.PI / 2);
    const J = EXT.jet; J.g.visible = true;
    const k = easeOut(clamp(lt / 2.4));
    J.g.position.set(lerp(-26, -30, k), PLANE_Y + 2.5 + Math.sin(T * 1.3) * 0.25, lerp(-70, 4, k));
    J.g.rotation.z = Math.sin(T * 0.9) * 0.03;
    place(V(-1.8, PLANE_Y + 0.8, 4.4), V(-1.9, PLANE_Y + 0.8, 4.4), V(-60, PLANE_Y - 4, -12), V(-60, PLANE_Y - 2, 6), ease(p), 56);
    return { ui: () => UI.drawWindowFrame(ctx, 1) };
  }],
  // 13 jet canopy: pilot looks at you, raises paper
  [34.83, 37.82, 'ext', (lt, p, T) => {
    resetExt(T); missiles(T, Math.PI / 2);
    const J = EXT.jet; J.g.visible = true; J.g.position.set(-30, PLANE_Y + 2.5 + Math.sin(T * 1.3) * 0.25, 4);
    J.pilot.rotation.y = lerp(0.2, 1.35, easeOut(lt / 0.9));
    const raise = easeOut((T - 36.05) / 0.7);
    J.paper.visible = raise > 0.01;
    J.arm.rotation.z = lerp(-0.6, 0.9, raise);
    J.paper.position.y = lerp(0.3, 1.05, raise); J.paper.rotation.z = lerp(0.5, 0.04, raise);
    const c = J.g.position.clone().add(V(0, 0.95, 3.0));
    place(V(-2.0, PLANE_Y + 0.8, 4.0), V(-2.0, PLANE_Y + 0.8, 4.0), c, null, p, lerp(9, 7.5, p), shake(T, 0.02, 3));
  }],
  // 14 paper close-up: KIYIYA GİTMEYİN
  [37.82, 41.15, 'ext', (lt, p, T) => {
    resetExt(T);
    const J = EXT.jet; J.g.visible = true; J.g.position.set(-30, PLANE_Y + 2.5 + Math.sin(T * 1.3) * 0.25, 4);
    J.pilot.rotation.y = 1.35; J.arm.rotation.z = 0.9; J.paper.visible = true; J.paper.position.y = 1.05; J.paper.rotation.z = 0.04 + Math.sin(T * 2) * 0.02;
    J.g.updateMatrixWorld(true);
    const pp = new THREE.Vector3(); J.paper.getWorldPosition(pp);
    const punch = T > 39.75 ? easeOut((T - 39.75) / 0.4) : 0;
    place(V(-2.0, PLANE_Y + 0.8, 4.0), V(-2.0, PLANE_Y + 0.8, 4.0), pp, null, p, lerp(lerp(6.0, 5.2, p), 4.6, punch), shake(T, 0.012, 3));
    return { post: { vignette: 0.85 } };
  }],
  // 15 jet peels away into darkness
  [41.15, 43.45, 'ext', (lt, p, T) => {
    resetExt(T);
    const J = EXT.jet; J.g.visible = true;
    const k = easeIn(clamp(lt / 2.0));
    J.g.position.set(-30 - k * 260, PLANE_Y + 2.5 + k * 120, 4 + k * 320);
    J.g.rotation.set(-0.25 * k, 0.5 * k, 0.9 * Math.min(1, lt * 1.4));
    place(V(22, PLANE_Y + 9, -52), V(20, PLANE_Y + 9, -45), V(-20, PLANE_Y + 6, 30), V(-60, PLANE_Y + 30, 90), ease(p), 50);
  }],
  // 16 cabin goes red, captain speaks again
  [43.45, 46.15, 'cab', (lt, p, T) => {
    resetCab(T); wake(1, T); alarm(T, ease(lt / 0.6));
    place(V(0.0, 2.25, 9.8), V(0.0, 2.2, 8.6), V(-0.3, 1.3, 0), null, ease(p), 50, shake(T, 0.01, 4));
  }],
  // 17 radar: airports closed, home airport hit
  [46.15, 48.82, 'ui', (lt, p, T) => ({ ui: () => UI2.drawRadar(ctx, clamp(lt / 2.6), T), post: { vignette: 0.5 } })],
  // 18 fuel 40 min
  [48.82, 50.33, 'ui', (lt, p, T) => ({ ui: () => UI2.drawFuel(ctx, clamp(lt / 1.4), T), post: { vignette: 0.5 } })],
  // 19 descending toward the dark sea
  [50.33, 52.3, 'ext', (lt, p, T) => {
    resetExt(T); EXT.floor.mode.value = 1;
    EXT.airliner.g.position.y = lerp(150, 128, p); EXT.airliner.g.rotation.x = 0.07;
    EXT.scene.fog.near = 150; EXT.scene.fog.far = 2600;
    place(V(-36, 118, 70), V(-30, 121, 52), V(0, 134, 0), null, ease(p), 46);
  }],
  // 20 the girl grabs your hand
  [52.3, 54.47, 'cab', (lt, p, T) => {
    resetCab(T); wake(1, T); alarm(T, 0.8); hideNear(V(HP().x, 0.36, HP().z - ROW), 0.3); hideNear(V(HP().x + 0.52, 0.36, HP().z - ROW), 0.3);
    const g = CAB.girl, h = CAB.hero;
    g.head.rotation.set(-0.35, -0.45, 0.05);
    const reach = easeOut(lt / 0.6);
    g.armR.rotation.set(-0.95 * reach - 0.4, 0, 0.75 * reach);
    h.armL.rotation.set(-0.85, 0, -0.35);
    h.head.rotation.set(0.15, -0.55, 0);
    const k = ease((T - 53.55) / 0.3);
    g.mouth.scale.set(0.02, 0.008 + 0.02 * k, 0.012);
    const c = V(HP().x + 0.28, 1.25, HP().z);
    place(V(c.x + 0.35, 1.7, c.z - 1.9), V(c.x + 0.25, 1.65, c.z - 1.6), c, c.clone().add(V(0, 0.15, 0)), ease(p), 40, shake(T, 0.004, 3));
  }],
  // 21 cockpit door opens, stewardess rushes out
  [54.47, 56.3, 'cab', (lt, p, T) => {
    resetCab(T); wake(1, T); alarm(T, 0.8);
    doorOpen(lt / 0.5);
    const S = CAB.steward; S.g.visible = lt > 0.35; S.g.rotation.y = 0;
    const run = clamp((lt - 0.35) / 1.4);
    S.g.position.set(0, Math.abs(Math.sin(T * 12)) * 0.04, CAB.zFront + 0.4 + run * 2.6);
    S.legL.rotation.x = Math.sin(T * 12) * 0.6; S.legR.rotation.x = -Math.sin(T * 12) * 0.6;
    S.armL.rotation.x = -Math.sin(T * 12) * 0.5; S.armR.rotation.x = Math.sin(T * 12) * 0.5;
    place(V(0.15, 1.6, 7.5), V(0.12, 1.6, 6.6), V(0, 1.2, CAB.zFront), null, ease(p), 44, shake(T, 0.008, 4));
  }],
  // 22 cockpit: co-pilot passed out, captain alone
  [56.3, 60.3, 'ckp', (lt, p, T) => {
    const C = CKP; C.sea.t.value = T;
    const w = Math.floor(T * 3) % 2; C.warn.forEach(m => m.visible = !!w); C.red.intensity = 0.5 + w * 1.3;
    C.screens.forEach((tex, i) => { drawPFD(tex.userData.ctx, 256, 256, i % 2, T); tex.needsUpdate = true; });
    C.captain.armL.rotation.set(-1.25 + Math.sin(T * 9) * 0.03, 0, 0.1); C.captain.armR.rotation.set(-1.25 + Math.sin(T * 9 + 1) * 0.03, 0, -0.1);
    C.captain.head.rotation.set(0, Math.sin(T * 0.8) * 0.15, 0);
    const push = ease((T - 57.8) / 1.2);
    C.copilot.g.updateMatrixWorld(true); C.captain.g.updateMatrixWorld(true);
    const ch = new THREE.Vector3(), kh = new THREE.Vector3();
    C.copilot.head.getWorldPosition(ch); C.captain.head.getWorldPosition(kh);
    if (T < 57.8) place(ch.clone().add(V(-0.45, 0.1, -1.05)), ch.clone().add(V(-0.35, 0.06, -0.85)), ch.clone().add(V(0, -0.1, 0)), null, ease(lt / 1.5), 54, shake(T, 0.006, 3));
    else place(kh.clone().add(V(0.55, 0.05, -1.15)), kh.clone().add(V(0.42, 0.04, -0.9)), kh.clone().add(V(0.05, -0.2, 0)), null, push, 56, shake(T, 0.008, 3));
    return { post: { red: 0.04 * w } };
  }],
  // 23 stewardess asks the cabin
  [60.3, 63.33, 'cab', (lt, p, T) => {
    resetCab(T); wake(1, T); alarm(T, 0.7); doorOpen(1);
    const S = CAB.steward; S.g.visible = true; S.g.rotation.y = 0; S.g.position.set(0, 0, CAB.zFront + 3.0);
    S.armL.rotation.set(-0.3, 0, -0.5 - Math.sin(T * 3) * 0.1); S.armR.rotation.set(-0.3, 0, 0.5 + Math.sin(T * 3) * 0.1);
    S.mouth.scale.set(0.02, 0.008 + Math.abs(Math.sin(T * 9)) * 0.016, 0.012);
    S.browL.rotation.z = -0.25; S.browR.rotation.z = 0.25;
    CAB.passengers.forEach(f => { const d = f.g.position.z - S.g.position.z; if (d > 0) f.head.rotation.set(-0.05, Math.atan2(f.g.position.x, d) * 0.6, 0); });
    const sh = V(0, 1.68, CAB.zFront + 3.0);
    place(V(0.0, 2.05, CAB.zFront + 6.2), V(0.0, 2.0, CAB.zFront + 5.4), sh.clone().add(V(0, -0.15, 0)), null, ease(p), 40, shake(T, 0.006, 3));
  }],
  // 24 nobody moves (reverse wide)
  [63.33, 64.72, 'cab', (lt, p, T) => {
    resetCab(T); wake(0.2, T); alarm(T, 0.5); doorOpen(1);
    CAB.passengers.forEach(f => f.head.rotation.set(-0.08, 0, 0));
    CAB.girl.head.rotation.set(-0.1, 0, 0);
    CAB.hero.head.rotation.set(-0.05, 0, 0);
    place(V(-0.05, 2.15, CAB.zFront + 1.0), V(-0.05, 2.12, CAB.zFront + 1.3), V(0, 1.2, 12), null, p, 52);
    return { post: { vignette: 0.85 } };
  }],
  // 25 hero: "but you know"
  [64.72, 65.98, 'cab', (lt, p, T) => {
    resetCab(T); wake(1, T); alarm(T, 0.5); hideNear(V(HP().x, 0.36, HP().z - ROW), 0.3); hideNear(V(HP().x + 0.52, 0.36, HP().z - ROW), 0.3);
    CAB.hero.browL.rotation.z = 0.3; CAB.hero.browR.rotation.z = -0.3; CAB.hero.browL.position.y = CAB.hero.browR.position.y = 0.09;
    CAB.hero.head.rotation.set(-0.05, -0.15, 0);
    const h = heroHead();
    place(V(h.x + 0.06, 1.74, h.z - 1.6), V(h.x + 0.03, 1.72, h.z - 1.3), h.clone().add(V(0, -0.05, 0)), null, ease(p), 44);
  }],
  // 26 flashback: simulator at home
  [65.98, 68.27, 'room', (lt, p, T) => {
    const R = ROOM; drawSimScreen(R.monTex.userData.ctx, 512, 288, T); R.monTex.needsUpdate = true;
    R.hero.armL.rotation.set(-1.1 + Math.sin(T * 1.4) * 0.05, 0, 0.25); R.hero.armR.rotation.set(-1.1 + Math.sin(T * 1.4) * 0.05, 0, -0.25);
    R.yoke.rotation.z = Math.sin(T * 1.4) * 0.12;
    place(V(1.25, 1.95, 1.7), V(1.0, 1.85, 1.35), V(0, 1.4, -1.0), null, ease(p), 46);
    return { grade: { saturation: 0.3, contrast: 1.15, vignette: 0.75, grain: 0.1, tint: [1.0, 0.86, 0.66, 0.6], bloom: 0.7 }, ui: () => UI.drawSimCaption(ctx, lt / 2.2) };
  }],
  // 27 trembling hands: never touched a real plane
  [68.27, 70.42, 'cab', (lt, p, T) => {
    resetCab(T); wake(1, T); alarm(T, 0.6); hideNear(V(HP().x, 0.36, HP().z - ROW), 0.3);
    doorOpen(1);
    hideNear(V(HP().x, 0.36, HP().z - ROW), 0.3); hideNear(V(HP().x + 0.52, 0.36, HP().z - ROW), 0.3);
    const hh = CAB.hero; hh.head.rotation.set(0.32 + Math.sin(T * 30) * 0.008, -0.1, 0);
    hh.browL.rotation.z = -0.2; hh.browR.rotation.z = 0.2; hh.browL.position.y = hh.browR.position.y = 0.12;
    const tr = Math.sin(T * 38) * 0.03; hh.armL.rotation.set(-0.95 + tr, 0, 0.15); hh.armR.rotation.set(-0.95 - tr, 0, -0.15);
    const h = heroHead();
    place(V(h.x + 0.55, 1.62, h.z - 1.25), V(h.x + 0.42, 1.6, h.z - 1.0), h.clone().add(V(0, -0.25, 0)), null, ease(p), 46, shake(T, 0.004, 3));
  }],
  // 28 CHOICE
  [70.42, DURATION, 'cab', (lt, p, T) => {
    resetCab(T); wake(1, T); alarm(T, 0.75); doorOpen(1);
    const h = CAB.hero; setPose(h, 'stand');
    h.g.position.set(-0.05, 0, HP().z - 0.3); h.g.rotation.y = Math.PI;
    h.head.rotation.set(0, 0.15 * Math.sin(T * 0.6), 0);
    h.armL.rotation.set(0.05, 0, -0.12 + Math.sin(T * 1.5) * 0.02); h.armR.rotation.set(0.05, 0, 0.12);
    CAB.girl.head.rotation.set(-0.45, 0.6, 0.05);
    CAB.girl.armR.rotation.set(-1.2, 0, 0.5);
    for (let k = 0; k < 4; k++) { hideNear(V(0.51, 0.36, HP().z + k * ROW), 0.3); hideNear(V(-0.51, 0.36, HP().z + k * ROW), 0.3); }
    const orbit = Math.sin(lt * 0.25) * 0.08;
    const from = V(0.3 + orbit, 2.5, HP().z + 1.9), to = V(0.22 + orbit, 2.42, HP().z + 1.45);
    place(from, to, V(-0.15, 1.05, CAB.zFront + 1.0), null, ease(clamp(lt / 8)), 52);
    cam.updateMatrixWorld();
    const door = project(V(0, 1.3, CAB.zFront + 0.05));
    const seat = project(V(CAB.girlPos.x, 1.05, CAB.girlPos.z));
    return {
      ui: () => {
        // countdown
        const left = Math.max(0, 40 * 60 - (T - 70.42));
        const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(Math.floor(left % 60)).padStart(2, '0');
        const ca = ease((T - 70.42) / 0.4);
        ctx.save(); ctx.globalAlpha = ca * 0.85; ctx.fillStyle = '#0b0d12'; UI.rr(ctx, 255, 88, 210, 64, 14); ctx.fill(); ctx.restore();
        UI.bigText(ctx, `${mm}:${ss}`, 121, 44, ca, '#ff4a5a', 'IK');
        UI.bigText(ctx, 'İKİ SEÇENEK', 205, 66, ease((T - 71.45) / 0.35));
        const a1 = ease((T - 72.4) / 0.3), a2 = ease((T - 75.42) / 0.3);
        const pulse1 = T > 78.8 ? Math.max(0, Math.sin((T - 78.8) * 3.2)) : (T < 75.4 ? Math.max(0, Math.sin((T - 72.4) * 5)) * 0.5 : 0);
        const pulse2 = T > 78.8 ? Math.max(0, -Math.sin((T - 78.8) * 3.2)) : (T > 75.4 ? Math.max(0, Math.sin((T - 75.4) * 5)) * 0.5 : 0);
        const b1 = { x: 470, y: 360 }, b2 = { x: 205, y: 880 };
        if (a1 > 0) { UI.leader(ctx, b1.x - 60, b1.y + 29, door.x, door.y, '#e8344a', a1); UI.badge(ctx, b1.x, b1.y, '1', 'KOKPİTE GİT', '#e8344a', a1, pulse1); }
        if (a2 > 0) { UI.leader(ctx, b2.x, b2.y - 29, seat.x, seat.y, '#2f6bff', a2); UI.badge(ctx, b2.x, b2.y, '2', 'KOLTUĞUNDA KAL', '#2f6bff', a2, pulse2); }
        const cta = ease((T - 80.2) / 0.4);
        if (cta > 0) {
          ctx.save(); ctx.globalAlpha = cta; ctx.fillStyle = 'rgba(10,12,18,0.82)'; UI.rr(ctx, 110, 1100, 500, 70, 35); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = '900 28px IK'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💬 YORUMA 1 YA DA 2 YAZ', W / 2, 1136); ctx.restore();
        }
        const end = ease((T - 84.3) / 0.5);
        if (end > 0) {
          UI.bigText(ctx, "BÖLÜM 2'Yİ", 960, 50, end);
          UI.bigText(ctx, 'YORUMLAR BELİRLEYECEK', 1018, 40, end, '#ffd34d');
        }
      },
      post: { vignette: 0.8 },
    };
  }],
];

/* ---------- render ---------- */
function shotAt(T) {
  for (const s of SHOTS) if (T >= s[0] && T < s[1]) return s;
  return SHOTS[SHOTS.length - 1];
}
function renderAt(T) {
  const s = shotAt(T);
  const lt = T - s[0], p = clamp(lt / (s[1] - s[0]));
  const res = s[3](lt, p, T) || {};
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, RW, RH);
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  const po = res.post || {};
  if (s[2] === 'ui') {
    renderer.setClearColor(0x000000); renderer.clear();
    if (res.ui) res.ui();
    UI.post(ctx, T, { vignette: po.vignette ?? 0.5, grain: 0.05, flash: po.flash || 0, red: po.red || 0 });
    return;
  }
  const set = { ext: EXT, cab: CAB, ckp: CKP, room: ROOM }[s[2]];
  if (s[2] === 'ext') { cam.near = 0.3; cam.far = 20000; } else { cam.near = 0.03; cam.far = 80; }
  cam.updateProjectionMatrix();
  if (s[2] === 'cab') autoHide();
  const g = { ...(res.grade || {}) };
  if (s[2] !== 'ext' && g.dof === undefined && FOCUS < 12) g.dof = { focus: FOCUS, aperture: 0.0045, maxblur: 0.0065 };
  if (po.vignette != null && g.vignette == null) g.vignette = po.vignette * 0.75;
  if (po.flash) g.flash = po.flash;
  if (po.red) g.tint = [1.0, 0.35, 0.35, clamp(po.red * 4)];
  POST.render(set.scene, cam, T, g);
  if (res.ui) res.ui();
}
// hide passengers whose heads would block the lens
const _hp = new THREE.Vector3(), _dir = new THREE.Vector3(), _to = new THREE.Vector3();
function autoHide() {
  cam.updateMatrixWorld(); cam.getWorldDirection(_dir);
  for (const f of CAB.passengers) {
    if (!f.g.visible) continue;
    f.head.getWorldPosition(_hp);
    _to.subVectors(_hp, cam.position); const d = _to.length(); const along = _to.dot(_dir);
    if (along > -0.2 && d < 0.95) f.g.visible = false;
  }
}

async function init() {
  await document.fonts.load('900 40px IK'); await document.fonts.load('900 40px ID'); await document.fonts.load('700 20px IB');
  EXT = buildExterior(); CAB = buildCabin(); CKP = buildCockpit(); ROOM = buildRoom();
  passengerSleep = CAB.passengers.map(f => ({ x: f.head.rotation.x, y: f.head.rotation.y, z: f.head.rotation.z }));
  // stagger missile launches: first alone, then the barrage
  const r = rng(9);
  EXT.missiles.list.forEach((m, i) => { m.start = i === 0 ? 0 : 4.4 + i * 0.18 + r() * 0.5; });
  UI.initGrain();
  POST = makePost(renderer, W, H);
  for (const st of [EXT, CAB, CKP, ROOM]) { st.scene.environment = POST.envTex; }
  EXT.scene.environmentIntensity = 0.12; CAB.scene.environmentIntensity = 0.12; CKP.scene.environmentIntensity = 0.1; ROOM.scene.environmentIntensity = 0.1;
  // warm-up compile
  for (const sc of [EXT.scene, CAB.scene, CKP.scene, ROOM.scene]) renderer.compile(sc, cam);
  window.renderAt = (T) => { renderAt(T); return true; };
  window.DURATION = DURATION;
  window.ready = true;
}
init();
