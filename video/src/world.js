import * as THREE from 'three';
import { rng, mat, emis, sph, box, cyl, capsule, rbox, canvasTex, glowSprite, makeFigure, setPose, lerp } from './lib.js';

/* =========================================================
   EXTERIOR: night sky, clouds / sea, airliner, fighter, missiles
   ========================================================= */
export function buildExterior() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b1530, 400, 5200);

  // sky dome
  const skyU = { top: { value: new THREE.Color('#03050c') }, hor: { value: new THREE.Color('#1c2c52') }, glow: { value: 0 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: `varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform float glow; varying vec3 vp;
      void main(){ float h = clamp(vp.y*2.2+0.08,0.,1.); vec3 c = mix(hor, top, pow(h,0.6));
        float g = exp(-abs(vp.y)*14.)*glow; c += vec3(1.0,0.45,0.2)*g*0.35;
        gl_FragColor = vec4(c,1.); }`,
  }));
  scene.add(sky);
  // stars
  {
    const r = rng(7), n = 2200, p = new Float32Array(n * 3), c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = r() * Math.PI * 2, ph = Math.acos(r() * 0.95);
      const R = 8000;
      p[i * 3] = Math.sin(ph) * Math.cos(th) * R; p[i * 3 + 1] = Math.cos(ph) * R - 200; p[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * R;
      const b = 0.35 + r() * 0.65; c[i * 3] = b; c[i * 3 + 1] = b; c[i * 3 + 2] = b * 1.1;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false })));
  }
  // moon
  const moon = glowSprite('#cfe0ff', 900, 0.9); moon.position.set(-2600, 1500, -5200); scene.add(moon);
  const moonCore = glowSprite('#ffffff', 160, 1); moonCore.position.copy(moon.position); scene.add(moonCore);

  // cloud / sea floor
  const floorU = { t: { value: 0 }, mode: { value: 0 }, moonDir: { value: new THREE.Vector3(-0.45, 0.25, -0.86).normalize() }, flash: { value: 0 } };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000, 1, 1), new THREE.ShaderMaterial({
    uniforms: { ...floorU, fogColor: { value: new THREE.Color(0x0b1530) } }, transparent: false,
    vertexShader: `varying vec3 wp; void main(){ vec4 w = modelMatrix*vec4(position,1.); wp = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float t; uniform float mode; uniform vec3 moonDir; uniform float flash; uniform vec3 fogColor; varying vec3 wp;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),u.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x), u.y); }
      float fbm(vec2 p){ float s=0., a=0.5; for(int i=0;i<6;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
      void main(){
        vec2 p = wp.xz;
        vec3 col;
        if (mode < 0.5) {
          vec2 q = p*0.0016 + vec2(0., t*0.05);
          float d = fbm(q + fbm(q*1.7)*0.6);
          float hi = fbm(q*3.1 + 4.);
          vec3 dark = vec3(0.06,0.09,0.19), lit = vec3(0.42,0.5,0.72);
          col = mix(dark, lit, smoothstep(0.35, 0.8, d));
          col += vec3(0.20,0.25,0.38)*smoothstep(0.55,0.9,hi)*0.6;
        } else {
          vec2 q = p*0.02 + vec2(t*0.08, t*0.05);
          float w = fbm(q) * 0.6 + fbm(q*3.3 - t*0.2)*0.4;
          col = mix(vec3(0.01,0.02,0.05), vec3(0.05,0.09,0.17), w);
          // moon glitter path
          vec3 v = normalize(cameraPosition - wp);
          vec3 nrm = normalize(vec3((w-0.5)*0.35, 1., (fbm(q*2.+3.)-0.5)*0.35));
          vec3 r = reflect(-v, nrm);
          float s = pow(max(dot(r, moonDir),0.), 260.);
          col += vec3(0.75,0.85,1.0)*s*2.0;
        }
        col += vec3(1.,0.95,0.9)*flash;
        float dist = length(cameraPosition - wp);
        float f = smoothstep(400., 5200., dist);
        gl_FragColor = vec4(mix(col, fogColor, f), 1.);
      }`,
  }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);

  const hemi = new THREE.HemisphereLight(0x9db4ff, 0x0b1020, 1.3); scene.add(hemi);
  const moonL = new THREE.DirectionalLight(0xc8d8ff, 2.2); moonL.position.set(-600, 500, -400); scene.add(moonL);
  const fireL = new THREE.PointLight(0xff7a2a, 0, 400, 1.2); scene.add(fireL);
  const fillL = new THREE.DirectionalLight(0x9fb4e8, 1.4); fillL.position.set(500, 200, 100); scene.add(fillL);

  const airliner = makeAirliner(); scene.add(airliner.g);
  const jet = makeFighter(); scene.add(jet.g);
  const missiles = makeMissiles(); scene.add(missiles.g);

  return { scene, sky: skyU, floor: floorU, airliner, jet, missiles, fireL, moon };
}

/* ---------- geometry helpers for aircraft ---------- */
function foil(t = 0.12, n = 18) {
  // symmetric NACA 00xx: returns closed loop [x(0..1 along chord), y]
  const up = [], lo = [];
  for (let i = 0; i <= n; i++) {
    const x = (1 - Math.cos(Math.PI * i / n)) / 2;
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    up.push([x, yt]); lo.push([x, -yt]);
  }
  return up.concat(lo.reverse().slice(1, -1));
}
// sections: [{ le: Vector3, c: chord, t: thickness, cd: chord dir, td: thickness dir }]
function loft(sections, material) {
  const pos = [], idx = [];
  const F = foil(0.12, 16), n = F.length;
  sections.forEach((sc) => {
    const f = sc.t ? foil(sc.t, 16) : F;
    const cd = sc.cd || new THREE.Vector3(0, 0, -1), td = sc.td || new THREE.Vector3(0, 1, 0);
    for (const [x, y] of f) {
      const v = sc.le.clone().addScaledVector(cd, x * sc.c).addScaledVector(td, y * sc.c);
      pos.push(v.x, v.y, v.z);
    }
  });
  for (let j = 0; j < sections.length - 1; j++) for (let i = 0; i < n; i++) {
    const a = j * n + i, b = j * n + (i + 1) % n, c = (j + 1) * n + i, d = (j + 1) * n + (i + 1) % n;
    idx.push(a, c, b, b, c, d);
  }
  // end caps
  for (const j of [0, sections.length - 1]) {
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < n; i++) { cx += pos[(j * n + i) * 3]; cy += pos[(j * n + i) * 3 + 1]; cz += pos[(j * n + i) * 3 + 2]; }
    const ci = pos.length / 3; pos.push(cx / n, cy / n, cz / n);
    for (let i = 0; i < n; i++) idx.push(ci, j * n + i, j * n + (i + 1) % n);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = material.clone(); m.side = THREE.DoubleSide;
  return new THREE.Mesh(g, m);
}
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const mirrorSecs = (secs) => secs.map((s) => ({ ...s, le: V3(-s.le.x, s.le.y, s.le.z), td: s.td ? V3(-s.td.x, s.td.y, s.td.z) : undefined, cd: s.cd ? V3(-s.cd.x, s.cd.y, s.cd.z) : undefined }));
function lathe(profile, segs, material) {
  // profile: [[r, z]] ; returns mesh with axis along +z
  const g = new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(Math.max(r, 0.0001), z)), segs);
  g.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  return new THREE.Mesh(g, material);
}

/* ---------- AIRLINER (wide-body twin) ---------- */
function makeAirliner() {
  const g = new THREE.Group();
  const R = 2.1, Z0 = -24, Z1 = 24.5;
  // fuselage profile: uniform z samples so texture v is linear in z
  const prof = [];
  const N = 140;
  for (let i = 0; i <= N; i++) {
    const z = Z0 + (Z1 - Z0) * i / N;
    let r;
    if (z > 16) { const u = (z - 16) / (Z1 - 16); r = R * Math.sqrt(Math.max(0, 1 - Math.pow(u, 2.2))); }
    else if (z > -11) r = R;
    else { const u = (-11 - z) / (-11 - Z0); r = lerp(R, 0.32, Math.pow(u, 1.25)); }
    prof.push([r, z]);
  }
  // livery texture (u = around, v = along)
  const TW = 1024, TH = 2048;
  const zToY = (z) => (1 - (z - Z0) / (Z1 - Z0)) * TH;
  const phiU = (phi) => phi / (Math.PI * 2) * TW;
  const winZ = []; for (let z = -9.6; z < 14.6; z += 0.53) if (Math.abs(z - 4.3) > 0.5 && Math.abs(z + 2.2) > 0.4 && Math.abs(z - 12.6) > 0.4) winZ.push(z);
  const doors = [15.4, 4.3, -2.2, -10.4];
  const livery = canvasTex(TW, TH, (ctx) => {
    ctx.fillStyle = '#e9ecf1'; ctx.fillRect(0, 0, TW, TH);
    // belly
    const bg = ctx.createLinearGradient(0, 0, TW, 0);
    bg.addColorStop(0, '#9aa3b1'); bg.addColorStop(0.16, '#9aa3b1'); bg.addColorStop(0.2, '#e9ecf1'); bg.addColorStop(0.8, '#e9ecf1'); bg.addColorStop(0.84, '#9aa3b1'); bg.addColorStop(1, '#9aa3b1');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, TW, TH);
    // cheatlines (navy + gold) below windows on both sides
    for (const [u0, dir] of [[phiU(1.70), -1], [phiU(Math.PI * 2 - 1.70), 1]]) {
      ctx.fillStyle = '#1b2a4a'; ctx.fillRect(Math.min(u0, u0 + dir * 22), zToY(18), 22, zToY(-14) - zToY(18));
      ctx.fillStyle = '#d6a53a'; ctx.fillRect(Math.min(u0 + dir * 26, u0 + dir * 34), zToY(17), 8, zToY(-15) - zToY(17));
    }
    // doors
    ctx.strokeStyle = 'rgba(60,70,90,0.55)'; ctx.lineWidth = 2;
    for (const z of doors) for (const phi of [1.95, Math.PI * 2 - 1.95]) ctx.strokeRect(phiU(phi) - 22, zToY(z + 0.5), 44, zToY(z - 0.5) - zToY(z + 0.5));
    // windows
    ctx.fillStyle = '#11151d';
    for (const z of winZ) for (const phi of [1.86, Math.PI * 2 - 1.86]) { ctx.beginPath(); ctx.roundRect(phiU(phi) - 12, zToY(z + 0.13), 24, zToY(z - 0.13) - zToY(z + 0.13), 5); ctx.fill(); }
    // cockpit windows
    ctx.fillStyle = '#0b0e14';
    ctx.beginPath(); ctx.moveTo(phiU(Math.PI - 0.95), zToY(20.2)); ctx.lineTo(phiU(Math.PI + 0.95), zToY(20.2)); ctx.lineTo(phiU(Math.PI + 0.7), zToY(21.5)); ctx.lineTo(phiU(Math.PI - 0.7), zToY(21.5)); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e9ecf1'; for (const d of [-0.32, 0, 0.32]) ctx.fillRect(phiU(Math.PI + d) - 3, zToY(21.6), 6, zToY(20.1) - zToY(21.6));
  });
  livery.wrapS = THREE.RepeatWrapping;
  const emisTex = canvasTex(TW, TH, (ctx) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, TW, TH);
    ctx.fillStyle = '#ffd9a0';
    for (const z of winZ) for (const phi of [1.86, Math.PI * 2 - 1.86]) { ctx.beginPath(); ctx.roundRect(phiU(phi) - 10, zToY(z + 0.11), 20, zToY(z - 0.11) - zToY(z + 0.11), 4); ctx.fill(); }
    ctx.fillStyle = '#3a4a6a';
    ctx.beginPath(); ctx.moveTo(phiU(Math.PI - 0.9), zToY(20.25)); ctx.lineTo(phiU(Math.PI + 0.9), zToY(20.25)); ctx.lineTo(phiU(Math.PI + 0.68), zToY(21.45)); ctx.lineTo(phiU(Math.PI - 0.68), zToY(21.45)); ctx.closePath(); ctx.fill();
  });
  const skin = new THREE.MeshPhysicalMaterial({ map: livery, emissiveMap: emisTex, emissive: '#ffffff', emissiveIntensity: 1.5, roughness: 0.32, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.2 });
  const fus = lathe(prof, 64, skin);
  // upswept tail + slight oval section
  const P = fus.geometry.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const z = P.getZ(i); let y = P.getY(i) * 1.03;
    if (z < -11) y += Math.pow((-11 - z) / 13, 1.6) * 1.55;
    if (z > 16) y -= Math.pow((z - 16) / 8.5, 2) * 0.35;
    P.setY(i, y);
  }
  P.needsUpdate = true; fus.geometry.computeVertexNormals(); g.add(fus);

  const wingM = new THREE.MeshPhysicalMaterial({ color: '#c3c9d3', roughness: 0.38, metalness: 0.2, clearcoat: 0.4 });
  const darkM = mat('#2a2f38', { roughness: 0.5, metalness: 0.3 });
  const navyM = new THREE.MeshPhysicalMaterial({ color: '#17264a', roughness: 0.35, clearcoat: 0.6 });
  const goldM = new THREE.MeshPhysicalMaterial({ color: '#d6a53a', roughness: 0.35, metalness: 0.3, clearcoat: 0.5 });
  const wings = [];
  for (const sgn of [1, -1]) {
    let secs = [
      { le: V3(1.2, -1.25, 7.4), c: 9.2, t: 0.14 },
      { le: V3(6.0, -0.85, 3.9), c: 6.0, t: 0.12 },
      { le: V3(17.2, 0.35, -3.7), c: 2.0, t: 0.1 },
      { le: V3(17.9, 0.8, -4.2), c: 1.75, t: 0.1 },
      { le: V3(18.25, 2.6, -5.0), c: 1.0, t: 0.1, cd: V3(0, 0, -1) },
    ];
    if (sgn < 0) secs = mirrorSecs(secs);
    const w = loft(secs, wingM); const wg = new THREE.Group(); wg.add(w); g.add(wg); wings.push(wg);
    // flap track fairings
    for (const x of [4.5, 8.5, 12.0]) { const ft = capsule(0.13, 1.6, wingM); ft.rotation.x = Math.PI / 2; ft.position.set(sgn * x, -1.05 + x * 0.04, lerp(-1.6, -4.5, (x - 4) / 9)); g.add(ft); }
    // engine
    const eng = new THREE.Group();
    const nac = lathe([[0.62, -3.4], [0.9, -2.9], [1.18, -1.6], [1.32, 0.2], [1.34, 1.2], [1.27, 2.0], [1.16, 2.32], [1.05, 2.36], [0.98, 2.2], [0.97, 1.8]], 40,
      new THREE.MeshPhysicalMaterial({ color: '#dfe3ea', roughness: 0.3, clearcoat: 0.7 }));
    eng.add(nac);
    const lip = lathe([[1.28, 1.95], [1.2, 2.3], [1.06, 2.4], [0.98, 2.25]], 40, mat('#a9b0bb', { roughness: 0.25, metalness: 0.8 })); eng.add(lip);
    const fan = new THREE.Mesh(new THREE.CircleGeometry(0.98, 40), mat('#1a1d23', { roughness: 0.4, metalness: 0.6 })); fan.position.z = 1.8; eng.add(fan);
    for (let i = 0; i < 18; i++) { const bl = box(0.06, 0.85, 0.02, mat('#3a3f48', { metalness: 0.7, roughness: 0.3 })); bl.position.set(Math.cos(i / 18 * 6.28) * 0.5, Math.sin(i / 18 * 6.28) * 0.5, 1.82); bl.rotation.z = i / 18 * 6.28 + Math.PI / 2 + 0.3; eng.add(bl); }
    const spin = lathe([[0.3, 1.8], [0.2, 2.15], [0.0, 2.35]], 24, mat('#e8e8ea', { roughness: 0.3 })); eng.add(spin);
    const cone = lathe([[0.55, -3.3], [0.35, -3.9], [0.0, -4.3]], 24, darkM); eng.add(cone);
    const pylon = loft([{ le: V3(0, 0.9, 1.0), c: 4.6, t: 0.16, td: V3(1, 0, 0) }, { le: V3(0, 1.55, 0.3), c: 4.4, t: 0.16, td: V3(1, 0, 0) }], wingM);
    eng.add(pylon);
    eng.position.set(sgn * 6.3, -2.55, 6.1); g.add(eng);
    if (sgn === 1) g.userData.engR = eng; else g.userData.engL = eng;
    // nav light at wingtip
    const tipX = sgn * 17.9;
    const nl = glowSprite(sgn > 0 ? '#2dff6a' : '#ff2a2a', 4.5, 1); nl.position.set(tipX, 0.8, -4.0); g.add(nl);
    const nlc = sph(0.16, emis(sgn > 0 ? '#4bff7f' : '#ff4b4b', 3)); nlc.position.copy(nl.position); g.add(nlc);
  }
  g.userData.wings = wings;
  // wing-body fairing
  const fair = sph(1, wingM); fair.scale.set(2.25, 1.0, 7.5); fair.position.set(0, -1.55, 2.8); g.add(fair);
  // vertical fin (navy, gold tip)
  const fin = loft([
    { le: V3(0, 1.4, -12.2), c: 8.2, t: 0.12, td: V3(1, 0, 0) },
    { le: V3(0, 6.5, -17.3), c: 4.4, t: 0.11, td: V3(1, 0, 0) },
    { le: V3(0, 10.2, -20.8), c: 2.9, t: 0.1, td: V3(1, 0, 0) },
  ], navyM); g.add(fin);
  const finTip = loft([{ le: V3(0, 9.0, -19.7), c: 3.25, t: 0.115, td: V3(1, 0, 0) }, { le: V3(0, 10.25, -20.85), c: 2.92, t: 0.105, td: V3(1, 0, 0) }], goldM); finTip.scale.setScalar(1.002); g.add(finTip);
  const finStar = new THREE.Mesh(new THREE.CircleGeometry(0.75, 5), goldM); finStar.position.set(0.2, 5.5, -17.7); finStar.rotation.y = Math.PI / 2; g.add(finStar);
  const finStar2 = finStar.clone(); finStar2.position.x = -0.2; finStar2.rotation.y = -Math.PI / 2; g.add(finStar2);
  // horizontal stabilizers
  for (const sgn of [1, -1]) {
    let secs = [{ le: V3(0.6, 1.15, -16.2), c: 4.6, t: 0.1 }, { le: V3(7.6, 1.85, -21.0), c: 1.7, t: 0.09 }];
    if (sgn < 0) secs = mirrorSecs(secs);
    g.add(loft(secs, wingM));
  }
  // APU exhaust
  const apu = cyl(0.18, 0.3, darkM); apu.rotation.x = Math.PI / 2; apu.position.set(0, 1.55, -24.05); g.add(apu);
  // beacon & strobe & logo light
  const beacon = glowSprite('#ff3030', 5, 1); beacon.position.set(0, -R - 0.35, 2); g.add(beacon);
  const beaconTop = glowSprite('#ff3030', 4, 1); beaconTop.position.set(0, R + 0.2, -4); g.add(beaconTop);
  const strobe = glowSprite('#ffffff', 9, 1); strobe.position.set(0, 1.5, -24.3); g.add(strobe);
  const finLight = new THREE.PointLight(0xfff2dd, 2.5, 9, 1.4); finLight.position.set(5, 2.5, -15); g.add(finLight);
  // engine fire
  const fire = new THREE.Group();
  for (let i = 0; i < 6; i++) { const f = glowSprite(i < 2 ? '#fff0b0' : '#ff6a1a', 3 + i * 1.6, 0.9 - i * 0.1); f.position.z = -4.2 - i * 1.6; fire.add(f); }
  fire.visible = false; g.userData.engR.add(fire); g.userData.fire = fire;
  // keep beacon blinking for both lights
  const beaconProxy = { material: { set opacity(v) { beacon.material.opacity = v; beaconTop.material.opacity = v; }, get opacity() { return beacon.material.opacity; } } };
  return { g, beacon: beaconProxy, strobe, fire };
}

/* ---------- FIGHTER JET ---------- */
function makeFighter() {
  const g = new THREE.Group();
  const skin = new THREE.MeshPhysicalMaterial({ color: '#7a8492', roughness: 0.55, metalness: 0.25, clearcoat: 0.25 });
  const skin2 = new THREE.MeshPhysicalMaterial({ color: '#5d6672', roughness: 0.6, metalness: 0.25 });
  const dark = mat('#22262d', { roughness: 0.45, metalness: 0.5 });
  // fuselage
  const prof = [];
  for (let i = 0; i <= 80; i++) {
    const z = -7.6 + 16.2 * i / 80; let r;
    if (z > 4.2) { const u = (z - 4.2) / 4.4; r = 0.88 * Math.pow(Math.max(0, 1 - u), 0.75); }
    else if (z > -5.5) r = 0.88 + Math.sin((z + 5.5) / 9.7 * Math.PI) * 0.12;
    else r = lerp(0.88, 0.62, (-5.5 - z) / 2.1);
    prof.push([r, z]);
  }
  const fus = lathe(prof, 40, skin);
  const P = fus.geometry.attributes.position;
  for (let i = 0; i < P.count; i++) { const y = P.getY(i); P.setY(i, y * (y < 0 ? 0.72 : 0.85)); P.setX(i, P.getX(i) * 1.08); }
  P.needsUpdate = true; fus.geometry.computeVertexNormals(); g.add(fus);
  // radome tint
  const nose = lathe([[0.5, 6.4], [0.25, 7.8], [0.0, 8.6]], 24, skin2); nose.scale.set(1.08, 0.82, 1); g.add(nose);
  // chin intake
  const intake = loft([{ le: V3(0, -0.55, 3.0), c: 5.5, t: 0.36, td: V3(1, 0, 0) }, { le: V3(0, -0.95, 2.6), c: 5.0, t: 0.32, td: V3(1, 0, 0) }], skin2); g.add(intake);
  const intakeMouth = box(1.05, 0.42, 0.05, dark); intakeMouth.position.set(0, -0.78, 3.0); g.add(intakeMouth);
  // nozzle
  const noz = lathe([[0.66, -7.4], [0.6, -8.3], [0.52, -8.6], [0.48, -8.3]], 28, mat('#3a3330', { roughness: 0.35, metalness: 0.8 })); g.add(noz);
  const burner = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), emis('#ff8a3a', 2.2)); burner.position.z = -8.25; burner.rotation.y = Math.PI; g.add(burner);
  const engineGlow = glowSprite('#ff9a4a', 2.6, 0.7); engineGlow.position.set(0, 0, -8.7); g.add(engineGlow);
  // wings (cropped delta)
  for (const sgn of [1, -1]) {
    let ws = [{ le: V3(0.7, -0.05, 2.4), c: 6.2, t: 0.05 }, { le: V3(5.2, -0.15, -2.6), c: 1.4, t: 0.045 }];
    let lerx = [{ le: V3(0.55, 0.05, 5.6), c: 3.4, t: 0.04 }, { le: V3(0.9, 0.0, 2.6), c: 0.6, t: 0.04 }];
    let hs = [{ le: V3(0.75, 0.0, -4.9), c: 2.6, t: 0.05 }, { le: V3(3.2, -0.1, -6.5), c: 1.0, t: 0.05 }];
    if (sgn < 0) { ws = mirrorSecs(ws); lerx = mirrorSecs(lerx); hs = mirrorSecs(hs); }
    g.add(loft(ws, skin), loft(lerx, skin), loft(hs, skin));
    // wingtip missile
    const mis = new THREE.Group();
    const body = cyl(0.08, 2.6, mat('#e8e8ea', { roughness: 0.4 })); body.rotation.x = Math.PI / 2; mis.add(body);
    const seeker = sph(0.08, dark); seeker.position.z = 1.3; mis.add(seeker);
    for (let i = 0; i < 4; i++) { const fn = box(0.01, 0.28, 0.3, mat('#d8d8da')); fn.position.z = -1.1; fn.rotation.z = i * Math.PI / 2; fn.position.x = Math.cos(i * Math.PI / 2 + Math.PI / 2) * 0.12; fn.position.y = Math.sin(i * Math.PI / 2 + Math.PI / 2) * 0.12; mis.add(fn); }
    mis.position.set(sgn * 5.35, -0.15, -1.8); g.add(mis);
    const nl = glowSprite(sgn > 0 ? '#2dff6a' : '#ff2a2a', 1.4, 0.9); nl.position.set(sgn * 5.25, 0.0, -2.9); g.add(nl);
  }
  // vertical tail
  g.add(loft([{ le: V3(0, 0.55, -3.4), c: 3.6, t: 0.06, td: V3(1, 0, 0) }, { le: V3(0, 3.5, -6.3), c: 1.3, t: 0.05, td: V3(1, 0, 0) }], skin));
  const tailMark = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24), mat('#3b4552')); tailMark.position.set(0.12, 2.0, -5.2); tailMark.rotation.y = Math.PI / 2; g.add(tailMark);
  // canopy + frame
  const canopy = sph(1, new THREE.MeshPhysicalMaterial({ color: '#8fa6c8', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, clearcoat: 1 }));
  canopy.scale.set(0.55, 0.55, 1.85); canopy.position.set(0, 0.62, 3.0); g.add(canopy);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 8, 24, Math.PI), dark); frame.position.set(0, 0.62, 2.1); g.add(frame);
  const sill = box(1.12, 0.06, 3.6, dark); sill.position.set(0, 0.62, 3.0); g.add(sill);
  // pilot
  const pilot = new THREE.Group();
  const helmet = sph(0.3, mat('#e4e6ea', { roughness: 0.35 })); pilot.add(helmet);
  const visor = sph(1, new THREE.MeshPhysicalMaterial({ color: '#2a2310', roughness: 0.05, metalness: 0.9 })); visor.scale.set(0.25, 0.16, 0.16); visor.position.set(0, -0.02, 0.17); pilot.add(visor);
  const mask = sph(0.09, mat('#4a5048')); mask.position.set(0, -0.15, 0.22); pilot.add(mask);
  const torso = capsule(0.26, 0.25, mat('#5b6440')); torso.position.y = -0.55; pilot.add(torso);
  pilot.position.set(0, 0.82, 3.0); g.add(pilot);
  const hud = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.22), new THREE.MeshBasicMaterial({ color: new THREE.Color('#4cffb0').multiplyScalar(0.6), transparent: true, opacity: 0.35 })); hud.position.set(0, 0.85, 4.15); g.add(hud);
  const arm = new THREE.Group(); arm.position.set(0.25, -0.25, 0.0);
  const a1 = capsule(0.08, 0.38, mat('#5b6440')); a1.rotation.z = -1.2; a1.position.set(0.2, 0, 0); arm.add(a1);
  const glove = sph(0.09, mat('#1d1f22')); glove.position.set(0.42, 0.1, 0); arm.add(glove);
  pilot.add(arm);
  const paperTex = canvasTex(512, 360, (ctx, w, h) => {
    ctx.fillStyle = '#f4efe2'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 2; for (let y = 60; y < h; y += 44) { ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(w - 20, y); ctx.stroke(); }
    ctx.fillStyle = '#16181c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 118px IK'; ctx.save(); ctx.translate(w / 2, h * 0.33); ctx.rotate(-0.03); ctx.fillText('KIYIYA', 0, 0); ctx.restore();
    ctx.font = '900 104px IK'; ctx.save(); ctx.translate(w / 2, h * 0.7); ctx.rotate(0.02); ctx.fillText('GİTMEYİN', 0, 0); ctx.restore();
  });
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.63), new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.9, side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.1, emissiveMap: paperTex }));
  paper.position.set(0.47, 0.95, 3.05); paper.rotation.y = Math.PI / 2; g.add(paper);
  g.userData.canopyLight = new THREE.PointLight(0x9fc0ff, 1.0, 6, 1.2); g.userData.canopyLight.position.set(1.4, 1.4, 3.4); g.add(g.userData.canopyLight);
  return { g, pilot, arm, paper, paperTex, helmet };
}

function makeMissiles() {
  const g = new THREE.Group();
  const r = rng(42);
  const list = [];
  for (let i = 0; i < 14; i++) {
    const x0 = i === 0 ? 120 : (r() - 0.5) * 2400, z0 = i === 0 ? -2600 : -2000 - r() * 1400;
    const h = 1200 + r() * 1400, bend = (r() - 0.5) * 1200;
    const pts = [];
    for (let k = 0; k <= 40; k++) { const u = k / 40; pts.push(new THREE.Vector3(x0 + bend * u * u, -60 + h * u, z0 + bend * 0.3 * u)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 80, 6 + r() * 5, 6, false);
    // vertex colors: fade toward tail
    const cnt = geo.attributes.position.count, col = new Float32Array(cnt * 3);
    const seg = 81, rad = 7;
    for (let v = 0; v < cnt; v++) { const u = Math.floor(v / rad) / (seg - 1); const b = 0.15 + 0.85 * u; col[v * 3] = 1.0 * b; col[v * 3 + 1] = 0.72 * b; col[v * 3 + 2] = 0.45 * b; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    m.geometry.setDrawRange(0, 0);
    const head = glowSprite('#ffd7a0', 160, 1); head.visible = false;
    g.add(m, head);
    list.push({ m, head, curve, start: i === 0 ? 0 : 0.6 + r() * 2.2, speed: 0.22 + r() * 0.12, total: geo.index.count });
  }
  // update(t): t seconds since launch sequence start; n = how many allowed
  const update = (t, n = 99) => {
    list.forEach((o, i) => {
      const lt = t - o.start;
      if (i >= n || lt <= 0) { o.m.geometry.setDrawRange(0, 0); o.head.visible = false; return; }
      const u = Math.min(1, lt * o.speed);
      const c = Math.floor(o.total * u / 6) * 6;
      o.m.geometry.setDrawRange(0, c);
      o.head.visible = u < 1; o.head.position.copy(o.curve.getPoint(u));
    });
  };
  return { g, update, list };
}

/* =========================================================
   CABIN
   ========================================================= */
export const ROW = 0.88;
export function buildCabin() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05070d');
  scene.fog = new THREE.Fog(0x060a14, 5, 17);
  const rows = 16;
  const len = rows * ROW + 6;
  const zFront = -4; // bulkhead plane
  const R = 2.15;

  const shell = new THREE.Mesh(new THREE.CylinderGeometry(R, R, len, 40, 1, true), mat('#c9cfdb', { side: THREE.BackSide, roughness: 0.8 }));
  shell.rotation.x = Math.PI / 2; shell.position.set(0, 1.1, zFront + len / 2); scene.add(shell);
  const floor = box(4.4, 0.05, len, mat('#2c3f73', { roughness: 0.95 })); floor.position.set(0, 0, zFront + len / 2); scene.add(floor);
  const aisle = box(0.62, 0.052, len, mat('#24345f', { roughness: 0.95 })); aisle.position.set(0, 0.002, zFront + len / 2); scene.add(aisle);
  // floor path lights
  for (let i = 0; i < rows + 4; i++) for (const s of [-1, 1]) { const l = box(0.04, 0.02, 0.12, emis('#fff2c8', 2.0)); l.position.set(s * 0.33, 0.04, zFront + 0.6 + i * ROW); scene.add(l); }
  // overhead bins
  for (const s of [-1, 1]) {
    const bin = box(1.05, 0.52, len - 1, mat('#e3e6ec', { roughness: 0.6 })); bin.position.set(s * 1.45, 2.25, zFront + len / 2); bin.rotation.z = s * 0.18; scene.add(bin);
    const lip = box(0.06, 0.06, len - 1, mat('#9aa3b3')); lip.position.set(s * 0.95, 2.0, zFront + len / 2); scene.add(lip);
  }
  // ceiling light strips
  const stripM = emis('#cfe0ff', 1.0); stripM.userData.base = 2.2;
  for (const s of [-1, 1]) { const l = box(0.06, 0.03, len - 1, stripM); l.position.set(s * 0.82, 2.63, zFront + len / 2); scene.add(l); }
  const ceil = box(1.4, 0.05, len, mat('#dfe3ea')); ceil.position.set(0, 2.78, zFront + len / 2); scene.add(ceil);
  // windows
  const winTex = canvasTex(64, 96, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b1a3a'); g.addColorStop(0.6, '#13284f'); g.addColorStop(1, '#050a18');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  const winM = new THREE.MeshBasicMaterial({ map: winTex });
  const winFrameM = mat('#f0f2f5', { roughness: 0.5 });
  const windows = [];
  for (let i = 0; i < rows + 2; i++) for (const s of [-1, 1]) {
    const z = zFront + 1.2 + i * ROW;
    const fr = rbox(0.38, 0.52, 0.06, 0.15, winFrameM); fr.position.set(s * 2.0, 1.32, z); fr.rotation.y = -s * Math.PI / 2; fr.rotation.z = s * 0.12; scene.add(fr);
    const w = rbox(0.27, 0.4, 0.02, 0.12, winM); w.position.set(s * 1.97, 1.32, z); w.rotation.y = -s * Math.PI / 2; w.rotation.z = s * 0.12; scene.add(w);
    windows.push(w);
  }
  // front bulkhead with cockpit door
  const bulk = box(4.4, 3.2, 0.12, mat('#d7dce4', { roughness: 0.7 })); bulk.position.set(0, 1.5, zFront); scene.add(bulk);
  const doorHole = box(0.9, 2.05, 0.14, emis('#fff4dc', 0.95)); doorHole.position.set(0, 1.03, zFront - 0.02); scene.add(doorHole);
  const door = box(0.92, 2.07, 0.1, mat('#b9c0cc', { roughness: 0.5 })); door.position.set(0, 1.03, zFront + 0.1); scene.add(door);
  const handle = box(0.08, 0.04, 0.06, mat('#555')); handle.position.set(0.32, 1.0, 0.06); door.add(handle);
  const exitSign = box(0.5, 0.18, 0.04, emis('#38ff8a', 2.4)); exitSign.position.set(-1.2, 2.55, zFront + 0.1); scene.add(exitSign);
  // seatbelt sign panel (per row, overhead) - one detailed for close-up at hero row
  const sbTex = canvasTex(256, 128, (ctx, w, h) => drawSeatbelt(ctx, w, h, 0)); sbTex.center.set(0.5, 0.5); sbTex.rotation = -Math.PI / 2;
  // seats (instanced parts)
  const seatX = [-1.55, -1.03, -0.51, 0.51, 1.03, 1.55];
  const nSeats = rows * 6;
  const fabric = mat('#22325a', { roughness: 0.92 });
  const cover = mat('#e9ecf2', { roughness: 0.8 });
  const baseI = new THREE.InstancedMesh(new THREE.BoxGeometry(0.48, 0.14, 0.5), fabric, nSeats);
  const backI = new THREE.InstancedMesh(new THREE.BoxGeometry(0.48, 0.86, 0.13), fabric, nSeats);
  const headI = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.2, 0.15), cover, nSeats);
  const screenI = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.17, 0.02), emis('#16264a', 1), nSeats);
  const armI = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.06, 0.45), mat('#3a3f4a'), rows * 8);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  let k = 0, ka = 0;
  const seatPos = (row, col) => new THREE.Vector3(seatX[col], 0, zFront + 1.4 + row * ROW);
  for (let rI = 0; rI < rows; rI++) {
    for (let c = 0; c < 6; c++) {
      const p = seatPos(rI, c);
      m4.compose(new THREE.Vector3(p.x, 0.42, p.z), q.identity(), one); baseI.setMatrixAt(k, m4);
      e.set(-0.12, 0, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(p.x, 0.86, p.z + 0.27), q, one); backI.setMatrixAt(k, m4);
      m4.compose(new THREE.Vector3(p.x, 1.24, p.z + 0.31), q, one); headI.setMatrixAt(k, m4);
      m4.compose(new THREE.Vector3(p.x, 1.0, p.z + 0.36), q, one); screenI.setMatrixAt(k, m4); // seen from row behind
      k++;
    }
    for (const ax of [-1.81, -1.29, -0.77, -0.25, 0.25, 0.77, 1.29, 1.81]) { m4.compose(new THREE.Vector3(ax, 0.62, zFront + 1.4 + rI * ROW + 0.02), q.identity(), one); armI.setMatrixAt(ka++, m4); }
  }
  scene.add(baseI, backI, headI, screenI, armI);
  // (screens face the row behind: rotate whole set not needed; boxes are symmetric)

  // passengers
  const r = rng(11);
  const tops = ['#2f3a4f', '#4a3236', '#34453f', '#4b4536', '#3a3a40', '#5a2f38', '#2c3854', '#4c525c'];
  const hats = [null, null, 'cap', 'beanie', 'hair', 'hair', null];
  const hatCols = ['#7a2a2a', '#2b4f7a', '#8f7a45', '#3c5a3c', '#5e4530', '#4a3a5a', '#2a1d17', '#1e1e1e'];
  const HERO_ROW = 6, HERO_COL = 0, GIRL_COL = 1;
  const passengers = [];
  for (let rI = 0; rI < rows; rI++) for (let c = 0; c < 6; c++) {
    if (rI === HERO_ROW && (c === HERO_COL || c === GIRL_COL)) continue;
    if (r() < 0.12) continue;
    const f = makeFigure({ top: tops[Math.floor(r() * tops.length)], pants: r() < 0.5 ? '#4b6aa6' : '#3a3f4a', hat: hats[Math.floor(r() * hats.length)], hatColor: hatCols[Math.floor(r() * hatCols.length)], eyes: 'closed', seed: rI * 7 + c, scale: 0.95 + r() * 0.1 });
    const p = seatPos(rI, c); f.g.position.set(p.x, 0.36, p.z + 0.02); f.g.rotation.y = Math.PI;
    f.head.rotation.x = 0.2 + r() * 0.25; f.head.rotation.z = (r() - 0.5) * 0.5;
    scene.add(f.g); passengers.push(f);
  }
  const hero = makeFigure({ top: '#2b2f38', pants: '#4b6aa6', hat: 'beanie', hatColor: '#e3a92b', vest: '#ff6a12', mask: true, brows: true, seed: 99 });
  const hp = seatPos(HERO_ROW, HERO_COL); hero.g.position.set(hp.x, 0.36, hp.z + 0.02); hero.g.rotation.y = Math.PI; scene.add(hero.g);
  const girl = makeFigure({ top: '#ff7eb0', pants: '#7a8bd6', pigtails: true, brows: true, seed: 5, scale: 0.72 });
  const gp = seatPos(HERO_ROW, GIRL_COL); girl.g.position.set(gp.x, 0.36 + 0.05, gp.z + 0.06); girl.g.rotation.y = Math.PI; scene.add(girl.g);
  const steward = makeFigure({ top: '#1d2a4d', pants: '#1d2a4d', hat: 'pillbox', hatColor: '#c0392b', brows: true, seated: false, seed: 3 });
  steward.g.position.set(0, 0, zFront + 0.9); steward.g.rotation.y = Math.PI; scene.add(steward.g);
  // scarf for steward
  const scarf = sph(0.12, mat('#c0392b')); scarf.scale.set(0.16, 0.07, 0.12); scarf.position.set(0, 1.1, 0.16); steward.body.add(scarf);

  // overhead panel close-up object at hero row
  const panel = new THREE.Group();
  const pnl = box(0.9, 0.06, 0.5, mat('#e7eaf0')); panel.add(pnl);
  const sbMat = new THREE.MeshBasicMaterial({ map: sbTex, color: new THREE.Color(1.8, 1.8, 1.8) });
  const sb = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.3), sbMat); sb.rotation.x = Math.PI / 2; sb.position.set(0, -0.032, 0.08); panel.add(sb);
  for (const sx of [-0.3, -0.15]) { const rl = cyl(0.04, 0.03, mat('#cfd4dc', { roughness: 0.3 })); rl.position.set(sx, -0.04, -0.08); panel.add(rl); }
  const spk = cyl(0.05, 0.01, mat('#2a2d33')); spk.position.set(0.3, -0.035, -0.1); panel.add(spk);
  panel.position.set(-1.25, 1.9, hp.z - 0.3); panel.rotation.z = -0.18; scene.add(panel);

  // lights
  const hemi = new THREE.HemisphereLight(0x7d93c4, 0x0a0e18, 0.55); scene.add(hemi);
  // cold moonlight coming through the left windows
  const key = new THREE.DirectionalLight(0x93b2ff, 1.6); key.position.set(-6, 2.6, 1.5); key.target.position.set(0, 1, hp.z); scene.add(key, key.target);
  const pl1 = new THREE.PointLight(0xbfd2ff, 2.2, 7, 1.6); pl1.position.set(0, 2.5, hp.z + 1); scene.add(pl1);
  const pl2 = new THREE.PointLight(0xbfd2ff, 2.0, 8, 1.6); pl2.position.set(0, 2.5, hp.z - 4); scene.add(pl2);
  const red = new THREE.PointLight(0xff2433, 0, 9, 1.4); red.position.set(0.6, 2.3, hp.z - 1.5); scene.add(red);
  // warm reading light above the hero
  const read = new THREE.SpotLight(0xffc98f, 2.2, 5, 0.5, 0.8, 1.2); read.position.set(hp.x + 0.35, 2.45, hp.z - 0.6);
  read.target.position.set(hp.x, 1.3, hp.z - 0.1); scene.add(read, read.target);
  const doorL = new THREE.PointLight(0xfff1d6, 0, 10, 1.4); doorL.position.set(0, 1.3, zFront + 0.6); scene.add(doorL);
  const winL = new THREE.PointLight(0x9fb8ff, 0, 3, 1.5); winL.position.set(-1.8, 1.4, hp.z); scene.add(winL);

  return {
    scene, hero, girl, steward, passengers, door, doorHole, doorL, panel, sbTex, windows, winTex,
    lights: { hemi, key, pl1, pl2, red, winL, read }, stripM, zFront, heroPos: hp, girlPos: gp, seatPos,
    exitSign,
  };
}

export function drawSeatbelt(ctx, w, h, on) {
  ctx.fillStyle = '#121419'; ctx.fillRect(0, 0, w, h);
  const cells = [[w * 0.27, 'belt'], [w * 0.73, 'phone']];
  for (const [cx, kind] of cells) {
    const lit = on && kind === 'belt';
    ctx.fillStyle = lit ? '#2a2108' : '#1b1e24'; ctx.beginPath(); ctx.roundRect(cx - 52, 14, 104, h - 28, 12); ctx.fill();
    const c = lit ? '#ffe3a0' : '#3b3f47';
    ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (kind === 'belt') {
      ctx.beginPath(); ctx.arc(cx, 36, 10, 0, 7); ctx.fill();                       // head
      ctx.beginPath(); ctx.moveTo(cx, 50); ctx.lineTo(cx, 82); ctx.lineTo(cx + 16, 82); ctx.lineTo(cx + 18, 104); ctx.stroke(); // seated body
      ctx.beginPath(); ctx.moveTo(cx - 20, 70); ctx.lineTo(cx + 22, 70); ctx.stroke();       // belt
      ctx.fillRect(cx - 7, 64, 14, 12);
    } else {
      ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(cx - 14, 34, 28, 54, 5); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, 64, 34, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 24, 40); ctx.lineTo(cx + 24, 88); ctx.stroke();
    }
  }
}

/* =========================================================
   COCKPIT
   ========================================================= */
export function buildCockpit() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#060a14');
  scene.fog = new THREE.Fog(0x070b16, 30, 600);
  const wall = mat('#3a404b', { roughness: 0.7 });
  const dark = mat('#1b1e24', { roughness: 0.6 });
  // outside: horizon + sea
  const seaU = { t: { value: 0 } };
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShaderMaterial({
    uniforms: seaU, vertexShader: `varying vec2 vu; void main(){ vu = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float t; varying vec2 vu; float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),u.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x), u.y); }
      void main(){ vec2 p = vu*0.03 + vec2(0., t*2.); float w = n(p)*0.6+n(p*3.1)*0.4; vec3 c = mix(vec3(0.01,0.02,0.05), vec3(0.06,0.1,0.2), w);
        float d = length(vu)/2000.; c = mix(c, vec3(0.08,0.12,0.24), smoothstep(0.05, 0.6, d)); gl_FragColor = vec4(c,1.); }`,
  }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -60; scene.add(sea);
  const skyM = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vp; void main(){ vp=normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 vp; void main(){ float h = clamp(vp.y*3.+0.05,0.,1.); vec3 c = mix(vec3(0.1,0.15,0.3), vec3(0.01,0.02,0.05), pow(h,0.5));
      c += vec3(1.,0.5,0.25)*exp(-abs(vp.y)*30.)*0.25; gl_FragColor=vec4(c,1.); }`,
  }));
  scene.add(skyM);
  // cockpit shell
  const floor = box(3.4, 0.05, 4, dark); floor.position.set(0, 0, 0); scene.add(floor);
  const ceil = box(3.4, 0.05, 4, wall); ceil.position.set(0, 2.25, 0); scene.add(ceil);
  for (const s of [-1, 1]) { const w = box(0.05, 2.3, 4, wall); w.position.set(s * 1.7, 1.1, 0); scene.add(w); }
  // windshield frame (front at z = -2)
  const fz = -1.9;
  const frameTop = box(3.4, 0.7, 0.1, wall); frameTop.position.set(0, 2.0, fz); scene.add(frameTop);
  const frameBot = box(3.4, 0.25, 0.1, wall); frameBot.position.set(0, 1.12, fz); scene.add(frameBot);
  for (const x of [-1.55, -0.03, 1.55]) { const p = box(0.14, 0.6, 0.1, wall); p.position.set(x, 1.55, fz); scene.add(p); }
  // dashboard
  const dash = box(3.2, 0.5, 0.9, dark); dash.position.set(0, 1.0, fz + 0.5); dash.rotation.x = -0.35; scene.add(dash);
  const pedestal = box(0.5, 0.8, 1.2, dark); pedestal.position.set(0, 0.5, fz + 1.4); scene.add(pedestal);
  const screens = [];
  const scrTex = (kind) => canvasTex(256, 256, (ctx, w, h) => drawPFD(ctx, w, h, kind, 0));
  [-1.15, -0.4, 0.4, 1.15].forEach((x, i) => {
    const tex = scrTex(i % 2);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.42), new THREE.MeshBasicMaterial({ map: tex }));
    s.position.set(x, 1.15, fz + 0.62); s.rotation.x = -0.35 - Math.PI * 0 ; s.rotation.x = -0.6; s.position.y = 1.2;
    s.lookAt(x, 1.5, 3); scene.add(s); screens.push(tex);
  });
  // warning lights
  const warn = [];
  for (const x of [-0.7, 0.7]) { const w = box(0.14, 0.06, 0.04, emis('#ff2020', 1.5)); w.position.set(x, 1.48, fz + 0.18); scene.add(w); warn.push(w); }
  // thrust levers
  for (const x of [-0.08, 0.08]) { const l = box(0.04, 0.25, 0.04, mat('#aaa')); l.position.set(x, 1.0, fz + 1.2); l.rotation.x = 0.4; scene.add(l); }
  // seats
  const seatM = mat('#2a2e36', { roughness: 0.8 });
  for (const s of [-1, 1]) {
    const b = box(0.6, 0.15, 0.6, seatM); b.position.set(s * 0.72, 0.5, 0.2); scene.add(b);
    const bk = box(0.6, 1.0, 0.15, seatM); bk.position.set(s * 0.72, 1.05, 0.55); bk.rotation.x = 0.1; scene.add(bk);
  }
  const captain = makeFigure({ top: '#f3f3f3', pants: '#1c1f26', hat: 'pilot', brows: true, seed: 21 });
  captain.g.position.set(-0.72, 0.45, 0.25); captain.g.rotation.y = Math.PI; scene.add(captain.g);
  captain.armL.rotation.set(-1.25, 0, 0.1); captain.armR.rotation.set(-1.25, 0, -0.1);
  // captain tie & epaulettes
  const tie = box(0.06, 0.25, 0.02, mat('#141821')); tie.position.set(0, 0.95, 0.205); captain.body.add(tie);
  const copilot = makeFigure({ top: '#f3f3f3', pants: '#1c1f26', hat: null, eyes: 'x', seed: 22 });
  copilot.g.position.set(0.72, 0.45, 0.25); copilot.g.rotation.y = Math.PI; scene.add(copilot.g);
  copilot.body.rotation.x = 0.35; copilot.body.rotation.z = 0.35; copilot.head.rotation.set(0.35, 0.2, 0.6);
  copilot.armL.rotation.set(0.1, 0, -0.1); copilot.armR.rotation.set(0.2, 0, 0.4);
  const capHat = makeFigure; // noop to keep tree-shake quiet
  const yoke = new THREE.Group(); const yk = box(0.4, 0.06, 0.06, mat('#222')); yoke.add(yk); yoke.position.set(-0.72, 1.0, -0.2); scene.add(yoke);

  const hemi = new THREE.HemisphereLight(0x9fb4e0, 0x101318, 0.9); scene.add(hemi);
  const ckKey = new THREE.DirectionalLight(0xbcd2ff, 1.3); ckKey.position.set(0.5, 1.5, -3); scene.add(ckKey);
  const red = new THREE.PointLight(0xff2a2a, 6, 6, 1.2); red.position.set(0, 2.15, -1.6); scene.add(red);
  const scr = new THREE.PointLight(0x7fd0ff, 2.2, 4, 1.4); scr.position.set(0, 1.3, -1.0); scene.add(scr);
  const back = new THREE.PointLight(0xdfe8ff, 1.2, 6, 1.4); back.position.set(0, 1.8, 2.2); scene.add(back);
  return { scene, captain, copilot, screens, warn, red, sea: seaU, yoke };
}

export function drawPFD(ctx, w, h, kind, t) {
  ctx.fillStyle = '#050608'; ctx.fillRect(0, 0, w, h);
  if (kind === 0) {
    // attitude: banked horizon
    ctx.save(); ctx.beginPath(); ctx.rect(20, 20, w - 40, h - 40); ctx.clip();
    ctx.translate(w / 2, h / 2 + 18 + Math.sin(t * 2) * 6); ctx.rotate(0.22 + Math.sin(t * 1.3) * 0.06);
    ctx.fillStyle = '#2f7ad6'; ctx.fillRect(-300, -300, 600, 300); ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-300, 0, 600, 300);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-300, 0); ctx.lineTo(300, 0); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(70, h / 2); ctx.lineTo(110, h / 2); ctx.lineTo(128, h / 2 + 14); ctx.lineTo(146, h / 2); ctx.lineTo(186, h / 2); ctx.stroke();
  } else {
    ctx.fillStyle = '#ff3030'; ctx.font = '900 34px IK'; ctx.textAlign = 'center';
    ctx.fillText('FUEL', w / 2, 70);
    ctx.font = '900 64px IK'; ctx.fillText('0:40', w / 2, 145);
    ctx.fillStyle = (Math.floor(t * 3) % 2) ? '#ff3030' : '#601010'; ctx.fillRect(40, 180, w - 80, 40);
    ctx.fillStyle = '#000'; ctx.font = '900 26px IK'; ctx.fillText('LOW FUEL', w / 2, 210);
  }
}

/* =========================================================
   FLASHBACK ROOM (simulator at home)
   ========================================================= */
export function buildRoom() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a0b10');
  const floor = box(8, 0.05, 8, mat('#3b3126', { roughness: 0.9 })); scene.add(floor);
  const wall = box(8, 4, 0.1, mat('#2a2f3a', { roughness: 0.9 })); wall.position.set(0, 2, -1.6); scene.add(wall);
  const desk = box(2.2, 0.08, 0.9, mat('#1b1c20')); desk.position.set(0, 0.95, -0.9); scene.add(desk);
  for (const x of [-1.0, 1.0]) { const l = box(0.06, 0.95, 0.06, mat('#111')); l.position.set(x, 0.47, -0.9); scene.add(l); }
  const monTex = canvasTex(512, 288, (ctx, w, h) => drawSimScreen(ctx, w, h, 0));
  const mon = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.84), new THREE.MeshBasicMaterial({ map: monTex }));
  mon.position.set(0, 1.55, -1.05); scene.add(mon);
  const bezel = box(1.58, 0.92, 0.04, mat('#0c0c0e')); bezel.position.set(0, 1.55, -1.08); scene.add(bezel);
  const yoke = new THREE.Group();
  const yb = box(0.5, 0.06, 0.06, mat('#222')); yoke.add(yb);
  for (const s of [-1, 1]) { const h = box(0.06, 0.18, 0.06, mat('#222')); h.position.set(s * 0.25, 0.08, 0); yoke.add(h); }
  yoke.position.set(0, 1.12, -0.6); scene.add(yoke);
  const chair = box(0.7, 1.1, 0.15, mat('#b3241f', { roughness: 0.6 })); chair.position.set(0, 1.0, 0.55); scene.add(chair);
  const hero = makeFigure({ top: '#2b2f38', pants: '#4b6aa6', hat: 'beanie', hatColor: '#e3a92b', vest: null, seed: 99, brows: true });
  hero.g.position.set(0, 0.45, 0.2); hero.g.rotation.y = Math.PI; scene.add(hero.g);
  hero.armL.rotation.set(-1.1, 0, 0.25); hero.armR.rotation.set(-1.1, 0, -0.25);
  const seat = box(0.7, 0.12, 0.6, mat('#b3241f')); seat.position.set(0, 0.45, 0.25); scene.add(seat);
  const hemi = new THREE.HemisphereLight(0x8aa0d0, 0x100c08, 0.6); scene.add(hemi);
  const monL = new THREE.PointLight(0x9fc4ff, 8, 5, 1.5); monL.position.set(0, 1.5, -0.6); scene.add(monL);
  const lamp = new THREE.PointLight(0xffb070, 3, 6, 1.5); lamp.position.set(1.5, 2.2, 0.5); scene.add(lamp);
  return { scene, monTex, hero, yoke };
}

export function drawSimScreen(ctx, w, h, t) {
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5aa7ff'); g.addColorStop(0.55, '#cfe6ff'); g.addColorStop(0.551, '#3a6b3a'); g.addColorStop(1, '#22401f');
  ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(Math.sin(t * 1.4) * 0.12); ctx.translate(-w / 2, -h / 2);
  ctx.fillStyle = g; ctx.fillRect(-100, -100, w + 200, h + 200);
  // runway
  ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.moveTo(w / 2 - 8, h * 0.56); ctx.lineTo(w / 2 + 8, h * 0.56); ctx.lineTo(w / 2 + 120, h + 40); ctx.lineTo(w / 2 - 120, h + 40); ctx.fill();
  ctx.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { const y = h * 0.6 + i * 22 + (t * 60 % 22); const s = (y - h * 0.56) / (h * 0.44); ctx.fillRect(w / 2 - 2 * s - 1, y, 4 * s + 2, 10 * s + 2); }
  ctx.restore();
  ctx.strokeStyle = '#3dff8a'; ctx.lineWidth = 3; ctx.font = '700 20px IB'; ctx.fillStyle = '#3dff8a';
  ctx.beginPath(); ctx.moveTo(w / 2 - 40, h / 2); ctx.lineTo(w / 2 - 12, h / 2); ctx.moveTo(w / 2 + 12, h / 2); ctx.lineTo(w / 2 + 40, h / 2); ctx.stroke();
  ctx.fillText('ALT 1200', 20, 30); ctx.fillText('SPD 145', w - 110, 30);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(w - 150, h - 36, 140, 26); ctx.fillStyle = '#fff'; ctx.font = '700 16px IB'; ctx.fillText('FLIGHT SIM', w - 140, h - 17);
}
