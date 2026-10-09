// Post-processing pipeline and graphics presets.
// HDR scene -> (GTAO) -> bloom -> colour grade / vignette / grain -> tone map + sRGB -> (SMAA).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { t } from '../i18n.js';

export const QUALITY = {
  low:    { label: t('低'),   post: false, ao: false, msaa: 0, smaa: false, shadow: 1024, pr: 1.0 },
  medium: { label: t('中'),   post: true,  ao: false, msaa: 0, smaa: true,  shadow: 2048, pr: 1.25 },
  high:   { label: t('高'),   post: true,  ao: false, msaa: 4, smaa: false, shadow: 4096, pr: 1.5 },
  ultra:  { label: t('极致'), post: true,  ao: true,  msaa: 4, smaa: false, shadow: 4096, pr: 2.0 },
};

// GTAO renders its own depth/normal pass; billboards and additive effects must not occlude there,
// otherwise every glow sprite casts a dark square of "ambient occlusion" behind it.
class CleanGTAOPass extends GTAOPass {
  _overrideVisibility() {
    super._overrideVisibility();
    const cache = this._visibilityCache;
    this.scene.traverse((o) => {
      const m = o.material;
      if (o.visible && (o.isSprite || (m && !Array.isArray(m) && m.transparent && !m.depthWrite))) { cache.push(o); o.visible = false; }
    });
  }
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.32 }, uSat: { value: 1.12 },
    uLift: { value: new THREE.Vector3(0.006, 0.010, 0.022) }, uGain: { value: new THREE.Vector3(1.03, 1.0, 0.96) },
    uCA: { value: 0.0016 }, uGrain: { value: 0.018 }, uHurt: { value: 0 }, uFlash: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uVignette; uniform float uSat; uniform vec3 uLift; uniform vec3 uGain;
    uniform float uCA; uniform float uGrain; uniform float uHurt; uniform float uFlash;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * r2 * uCA * 8.0;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv - off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv + off).b;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat);
      col = col * uGain + uLift * (1.0 - smoothstep(0.0, 0.6, l));
      float vig = smoothstep(0.85, 0.2, r2 * (1.0 + uVignette * 2.0));
      col *= mix(1.0, vig, uVignette * 1.6);
      col = mix(col, col * vec3(1.4, 0.35, 0.3), uHurt * smoothstep(0.05, 0.5, r2));
      col += vec3(1.0, 0.95, 0.85) * uFlash;
      col += (h(vUv * 917.0 + fract(uTime) * 31.0) - 0.5) * uGrain * (0.4 + l);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.quality = 'high';
    this.composer = null;
    this.hurt = 0; this.flash = 0;
  }

  setQuality(q, shadowLight) {
    const Q = QUALITY[q] || QUALITY.high;
    this.quality = q;
    const r = this.renderer;
    r.setPixelRatio(Math.min(devicePixelRatio, Q.pr));
    if (shadowLight) {
      shadowLight.shadow.mapSize.set(Q.shadow, Q.shadow);
      shadowLight.shadow.map?.dispose(); shadowLight.shadow.map = null;
    }
    this.composer?.dispose?.();
    this.composer = null;
    if (!Q.post) return;
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: Q.msaa });
    const comp = new EffectComposer(r, rt);
    comp.setPixelRatio(r.getPixelRatio());
    comp.setSize(innerWidth, innerHeight);
    comp.addPass(new RenderPass(this.scene, this.camera));
    if (Q.ao) {
      const ao = new CleanGTAOPass(this.scene, this.camera, innerWidth, innerHeight);
      ao.blendIntensity = 0.85;
      ao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.2, thickness: 1.5, scale: 1.0, samples: 12 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      comp.addPass(ao);
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.5, 1.5);
    comp.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    comp.addPass(this.grade);
    comp.addPass(new OutputPass());
    if (Q.smaa) comp.addPass(new SMAAPass());
    this.composer = comp;
  }

  resize() {
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(innerWidth, innerHeight);
  }

  render(dt, t) {
    this.hurt = Math.max(0, this.hurt - dt * 1.6);
    this.flash = Math.max(0, this.flash - dt * 4);
    if (!this.composer) { this.renderer.render(this.scene, this.camera); return; }
    const u = this.grade.uniforms;
    u.uTime.value = t; u.uHurt.value = this.hurt; u.uFlash.value = this.flash;
    this.composer.render(dt);
  }
}
