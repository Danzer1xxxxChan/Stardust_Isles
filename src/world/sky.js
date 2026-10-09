// Sky dome, sun/moon lighting, fog, stars, day/night palette and rain.
import * as THREE from 'three';
import { lerp, smoothstep, mulberry32 } from '../core/math.js';

// time: hours 0..24
const KEYS = [
  { t: 0,  top: 0x0b1030, hor: 0x1c2550, fog: 0x141c3c, sun: 0x4a5a9a, sunI: 0.0, amb: 0.32, hemiG: 0x1a2030 },
  { t: 5,  top: 0x1a2350, hor: 0x41406f, fog: 0x2f3360, sun: 0x8090c0, sunI: 0.0, amb: 0.36, hemiG: 0x252a40 },
  { t: 6.5, top: 0x5a7fc4, hor: 0xffb38a, fog: 0xe7b59a, sun: 0xffb27a, sunI: 1.0, amb: 0.5, hemiG: 0x6a5a48 },
  { t: 9,  top: 0x4f9be8, hor: 0xbfe3ff, fog: 0xbfdcf0, sun: 0xfff1d6, sunI: 2.4, amb: 0.75, hemiG: 0x7a8a5a },
  { t: 16, top: 0x4f9be8, hor: 0xc8e6ff, fog: 0xc6e0f2, sun: 0xfff0d0, sunI: 2.4, amb: 0.75, hemiG: 0x7a8a5a },
  { t: 18.3, top: 0x5a6fb8, hor: 0xff9a6a, fog: 0xe39a80, sun: 0xff9a5a, sunI: 1.2, amb: 0.55, hemiG: 0x6a4a40 },
  { t: 19.6, top: 0x1d2458, hor: 0x5a4a7a, fog: 0x3a3860, sun: 0x7080c0, sunI: 0.0, amb: 0.38, hemiG: 0x252a40 },
  { t: 24, top: 0x0b1030, hor: 0x1c2550, fog: 0x141c3c, sun: 0x4a5a9a, sunI: 0.0, amb: 0.32, hemiG: 0x1a2030 },
];
const ck = (hex) => new THREE.Color(hex);
for (const k of KEYS) for (const p of ['top', 'hor', 'fog', 'sun', 'hemiG']) k[p] = ck(k[p]);

function sample(t) {
  let a = KEYS[0], b = KEYS[1];
  for (let i = 0; i < KEYS.length - 1; i++) if (t >= KEYS[i].t && t <= KEYS[i + 1].t) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  const f = (t - a.t) / Math.max(1e-6, b.t - a.t);
  return { a, b, f };
}

export class Sky {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.uniforms = {
      top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunCol: { value: new THREE.Color() }, night: { value: 0 }, time: { value: 0 }, cover: { value: 0 },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
      fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night; uniform float time; uniform float cover;
        varying vec3 vDir;
        float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
        void main(){
          vec3 d = normalize(vDir);
          float h = clamp(d.y, -0.2, 1.0);
          vec3 c = mix(hor, top, pow(max(h,0.0), 0.55));
          if (h < 0.0) c = hor;
          float s = max(dot(d, sunDir), 0.0);
          float day = 1.0 - night;
          c += sunCol * (pow(s, 900.0) * 6.0 + pow(s, 64.0) * 0.35 + pow(s, 8.0) * 0.18) * day;
          vec3 md = -sunDir;
          float m = max(dot(d, md), 0.0);
          c += vec3(0.85,0.9,1.0) * (smoothstep(0.9993, 0.9996, m) * 1.6 + pow(m, 40.0) * 0.12) * night;
          // Cloud layer: flat plane projection, two drifting fbm layers.
          if (d.y > 0.0) {
            vec2 uv = d.xz / (d.y + 0.12) * 1.6;
            vec2 wind = vec2(time * 0.012, time * 0.006);
            float n = fbm(uv + wind) * 0.75 + fbm(uv * 2.7 - wind * 1.7) * 0.35;
            float cov = mix(0.62, 0.32, cover);
            float dens = smoothstep(cov, cov + 0.28, n);
            float thick = smoothstep(cov, cov + 0.55, n);
            float fade = smoothstep(0.0, 0.18, d.y);
            float toward = pow(s, 6.0);
            vec3 lit = mix(vec3(1.0), sunCol, 0.45) * (0.85 + toward * 0.6);
            vec3 shade = mix(hor, top, 0.35) * 0.75;
            vec3 cc = mix(lit, shade, thick * 0.75);
            cc += sunCol * pow(s, 12.0) * (1.0 - thick) * 1.2 * day;   // silver lining
            cc = mix(cc, vec3(0.13, 0.16, 0.26) + hor * 0.3, night * 0.85);
            cc = mix(cc, vec3(0.55, 0.58, 0.62), cover * 0.55 * day);
            c = mix(c, cc, dens * fade * 0.92);
          }
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), skyMat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    // Stars
    const rnd = mulberry32(42);
    const sp = [];
    for (let i = 0; i < 1600; i++) {
      const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2;
      const y = Math.abs(u) * 0.95 + 0.05, r = Math.sqrt(1 - y * y);
      sp.push(Math.cos(th) * r * 850, y * 850, Math.sin(th) * r * 850);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(sg, this.starMat);
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.35;
    this.sun.shadow.radius = 3;
    this.sun.shadow.blurSamples = 12;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfdcff, 0x7a8a5a, 0.7);
    scene.add(this.hemi);
    scene.fog = new THREE.Fog(0xbfdcf0, 60, 520);
    this.fogNear = 60; this.fogFar = 520;
    this.night = 0;
    this.rain = 0;
    this.rainTarget = 0;
    this.extraFog = 0;
    this._buildRain();
  }

  _buildRain() {
    const n = 2500;
    const pos = new Float32Array(n * 6);
    this.rainSeeds = new Float32Array(n * 3);
    const r = mulberry32(7);
    for (let i = 0; i < n; i++) { this.rainSeeds[i * 3] = r() * 60 - 30; this.rainSeeds[i * 3 + 1] = r() * 30; this.rainSeeds[i * 3 + 2] = r() * 60 - 30; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaac4dd, transparent: true, opacity: 0.0, depthWrite: false }));
    this.rainLines.frustumCulled = false;
    this.scene.add(this.rainLines);
  }

  update(dt, hours, focus, camPos, elapsed) {
    const { a, b, f } = sample(hours);
    const u = this.uniforms;
    u.top.value.copy(a.top).lerp(b.top, f);
    u.hor.value.copy(a.hor).lerp(b.hor, f);
    const fogC = a.fog.clone().lerp(b.fog, f);
    const sunC = a.sun.clone().lerp(b.sun, f);
    let sunI = lerp(a.sunI, b.sunI, f);
    let amb = lerp(a.amb, b.amb, f);
    // Sun path: rises in the east (+x) at 6, sets west at 18.
    const ang = ((hours - 6) / 12) * Math.PI;
    const dir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), -0.35).normalize();
    this.night = smoothstep(18.8, 20, hours) + smoothstep(6, 5, hours);
    this.night = Math.min(1, this.night);
    u.sunDir.value.copy(dir);
    u.sunCol.value.copy(sunC);
    u.night.value = this.night;

    // Rain darkens and greys everything.
    this.rain += (this.rainTarget - this.rain) * Math.min(1, dt * 0.3);
    const grey = new THREE.Color(0x8a96a3);
    u.top.value.lerp(grey, this.rain * 0.6);
    u.hor.value.lerp(grey, this.rain * 0.5);
    fogC.lerp(grey.clone().multiplyScalar(lerp(1, 0.35, this.night)), this.rain * 0.6);
    sunI *= 1 - this.rain * 0.65;

    const lightDir = this.night > 0.5 ? dir.clone().negate() : dir.clone();
    if (lightDir.y < 0.15) lightDir.y = 0.15;
    lightDir.normalize();
    const moonI = this.night * 0.55;
    this.sun.intensity = Math.max(sunI, moonI);
    this.sunIntensity = sunI;
    u.time.value = elapsed;
    u.cover.value = this.rain;
    this.sun.color.copy(this.night > 0.5 ? new THREE.Color(0x9fb4ff) : sunC);
    this.sun.position.copy(focus).addScaledVector(lightDir, 200);
    this.sun.target.position.copy(focus);
    this.hemi.intensity = amb;
    this.hemi.color.copy(u.top.value).lerp(new THREE.Color(0xffffff), 0.35);
    this.hemi.groundColor.copy(a.hemiG).lerp(b.hemiG, f);

    this.scene.fog.color.copy(fogC);
    u.hor.value.lerp(fogC, 0.85);
    const near = lerp(this.fogNear, 10, this.extraFog) * (1 - this.rain * 0.4);
    const far = lerp(this.fogFar, 70, this.extraFog) * (1 - this.rain * 0.45);
    this.scene.fog.near = near;
    this.scene.fog.far = far;
    this.dome.position.copy(camPos);
    this.stars.position.copy(camPos);
    this.stars.rotation.y = elapsed * 0.005;
    this.starMat.opacity = this.night * (1 - this.rain);

    // Rain particles
    const ro = this.rain;
    this.rainLines.material.opacity = ro * 0.55;
    this.rainLines.visible = ro > 0.02;
    if (this.rainLines.visible) {
      const p = this.rainLines.geometry.attributes.position.array;
      const s = this.rainSeeds;
      const n = s.length / 3;
      for (let i = 0; i < n; i++) {
        const y = ((s[i * 3 + 1] - elapsed * 28) % 30 + 30) % 30;
        const x = camPos.x + s[i * 3], z = camPos.z + s[i * 3 + 2];
        const yy = camPos.y - 10 + y;
        p[i * 6] = x; p[i * 6 + 1] = yy; p[i * 6 + 2] = z;
        p[i * 6 + 3] = x + 0.08; p[i * 6 + 4] = yy + 0.9; p[i * 6 + 5] = z;
      }
      this.rainLines.geometry.attributes.position.needsUpdate = true;
    }
  }
}
