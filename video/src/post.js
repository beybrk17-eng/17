import * as THREE from 'three';
import { EffectComposer } from '../node_modules/three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../node_modules/three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../node_modules/three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from '../node_modules/three/examples/jsm/postprocessing/BokehPass.js';
import { OutputPass } from '../node_modules/three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from '../node_modules/three/examples/jsm/postprocessing/ShaderPass.js';
import { RoomEnvironment } from '../node_modules/three/examples/jsm/environments/RoomEnvironment.js';

// Cinematic grade in display space: contrast, split toning, vignette, chromatic aberration, grain
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 },
    contrast: { value: 1.08 }, saturation: { value: 1.0 }, exposure: { value: 1.0 },
    shadowTint: { value: new THREE.Color(0.0, 0.035, 0.06) }, highTint: { value: new THREE.Color(0.04, 0.02, -0.02) },
    vignette: { value: 0.55 }, ca: { value: 0.0018 }, grain: { value: 0.045 }, lift: { value: 0.012 },
    flash: { value: 0 }, tint: { value: new THREE.Vector4(1, 0.1, 0.1, 0) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, contrast, saturation, exposure, vignette, ca, grain, lift, flash;
    uniform vec3 shadowTint, highTint; uniform vec4 tint; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + time*13.17) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float r2 = dot(d,d);
      vec3 c;
      c.r = texture2D(tDiffuse, vUv - d*ca*(1.+r2*4.)).r;
      c.g = texture2D(tDiffuse, vUv).g;
      c.b = texture2D(tDiffuse, vUv + d*ca*(1.+r2*4.)).b;
      c *= exposure;
      float l = dot(c, vec3(0.2126,0.7152,0.0722));
      c = mix(vec3(l), c, saturation);
      c = (c - 0.5) * contrast + 0.5;
      c += shadowTint * (1. - smoothstep(0., 0.5, l)) + highTint * smoothstep(0.45, 1., l);
      c = c * (1. - lift) + lift;
      c = mix(c, c * tint.rgb + tint.rgb*0.06, tint.a);
      float v = smoothstep(0.85, 0.18, length(d * vec2(0.85, 1.0)) );
      c *= mix(1. - vignette, 1., v);
      c += (h(vUv*1000.) - 0.5) * grain;
      c = mix(c, vec3(1.), flash);
      gl_FragColor = vec4(clamp(c,0.,1.), 1.);
    }`,
};

export function makePost(renderer, W, H) {
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(1); composer.setSize(W, H);
  const rp = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  const bokeh = new BokehPass(new THREE.Scene(), new THREE.PerspectiveCamera(), { focus: 1.5, aperture: 0.004, maxblur: 0.006 });
  const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.7, 0.55, 0.78);
  const out = new OutputPass();
  const grade = new ShaderPass(GradeShader);
  composer.addPass(rp); composer.addPass(bokeh); composer.addPass(bloom); composer.addPass(out); composer.addPass(grade);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const defaults = { dof: null, bloom: 0.55, bloomRadius: 0.5, threshold: 1.05, contrast: 1.08, saturation: 1.0, exposure: 1.0, vignette: 0.55, ca: 0.0018, grain: 0.045, flash: 0, tint: null };
  function render(scene, camera, T, o = {}) {
    o = { ...defaults, ...o };
    rp.scene = scene; rp.camera = camera;
    bokeh.enabled = !!o.dof;
    if (o.dof) {
      bokeh.scene = scene; bokeh.camera = camera;
      bokeh.uniforms.focus.value = o.dof.focus; bokeh.uniforms.aperture.value = o.dof.aperture ?? 0.006; bokeh.uniforms.maxblur.value = o.dof.maxblur ?? 0.008;
      bokeh.uniforms.nearClip.value = camera.near; bokeh.uniforms.farClip.value = camera.far; bokeh.uniforms.aspect.value = camera.aspect;
    }
    bloom.strength = o.bloom; bloom.radius = o.bloomRadius; bloom.threshold = o.threshold;
    const u = grade.uniforms;
    u.time.value = T; u.contrast.value = o.contrast; u.saturation.value = o.saturation; u.exposure.value = o.exposure;
    u.vignette.value = o.vignette; u.ca.value = o.ca; u.grain.value = o.grain; u.flash.value = o.flash;
    if (o.tint) u.tint.value.set(o.tint[0], o.tint[1], o.tint[2], o.tint[3]); else u.tint.value.w = 0;
    composer.render();
  }
  return { render, envTex };
}
