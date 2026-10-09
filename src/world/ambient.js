// Ambient atmosphere particles around the camera: drifting pollen / dust motes by day, blinking
// fireflies at night, snow flurries on the frost isles. Purely cosmetic, one draw call.
import * as THREE from 'three';
import { groundHeight, biomeWeights, frontierWeight, regionWeights } from './terrain.js';
import { mulberry32 } from '../core/math.js';

const N = 420, BOX = 36;

export class Ambient {
  constructor(scene) {
    const r = mulberry32(99);
    this.seed = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) { this.seed[i * 4] = r() * BOX; this.seed[i * 4 + 1] = r() * 14; this.seed[i * 4 + 2] = r() * BOX; this.seed[i * 4 + 3] = r(); }
    this.pos = new Float32Array(N * 3);
    this.alpha = new Float32Array(N);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: new THREE.Color() }, uSize: { value: 1 } },
      vertexShader: 'attribute float alpha; varying float vA; uniform float uSize; void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize * 180.0 / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(uCol * (0.5 + a * 1.5), a * vA); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.mode = 'day';
    this._w = {};
  }

  update(t, cam, sky) {
    const night = sky.night, rain = sky.rain;
    const cx = cam.x, cz = cam.z;
    // Mood: snow on the frost isles, fireflies at night, warm motes by day.
    const fw = frontierWeight(cx, cz);
    const snowy = fw > 0.5 ? biomeWeights(cx, cz, this._w).snow > 0.5 : groundHeight(cx, cz) > 45;
    const mode = snowy ? 'snow' : night > 0.5 ? 'firefly' : 'day';
    const green = fw > 0.5 ? 1 : (() => { const w = regionWeights(cx, cz); return w.meadow + w.forest + w.lake; })();
    const col = this.mat.uniforms.uCol.value;
    let strength;
    if (mode === 'snow') { col.setRGB(0.9, 0.95, 1.0); this.mat.uniforms.uSize.value = 0.7; strength = 0.6; }
    else if (mode === 'firefly') { col.setRGB(0.75, 1.0, 0.35); this.mat.uniforms.uSize.value = 0.9; strength = (1 - rain) * Math.min(1, green); }
    else { col.setRGB(1.0, 0.92, 0.7); this.mat.uniforms.uSize.value = 0.35; strength = 0.35 * (1 - rain) * Math.min(1, 0.3 + green); }
    const fall = mode === 'snow' ? 1.6 : 0;
    for (let i = 0; i < N; i++) {
      const s0 = this.seed[i * 4], s1 = this.seed[i * 4 + 1], s2 = this.seed[i * 4 + 2], s3 = this.seed[i * 4 + 3];
      const ph = t * (0.2 + s3 * 0.3) + s3 * 40;
      let x = ((s0 + Math.sin(ph) * 2 + t * 0.4 - cx) % BOX + BOX) % BOX + cx - BOX / 2;
      let z = ((s2 + Math.cos(ph * 0.8) * 2 + t * 0.25 - cz) % BOX + BOX) % BOX + cz - BOX / 2;
      const gy = groundHeight(x, z);
      const yy = mode === 'snow' ? (((s1 - t * fall) % 14) + 14) % 14 : s1 * (mode === 'firefly' ? 0.25 : 0.5) + Math.sin(ph * 1.3) * 0.6;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = gy + 0.3 + yy; this.pos[i * 3 + 2] = z;
      let a = strength;
      if (mode === 'firefly') a *= Math.max(0, Math.sin(t * (1.5 + s3 * 2) + s3 * 30)) ** 3;
      const dx = x - cx, dz = z - cz;
      a *= Math.max(0, 1 - Math.hypot(dx, dz) / (BOX * 0.5));
      this.alpha[i] = a;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.alpha.needsUpdate = true;
  }
}
