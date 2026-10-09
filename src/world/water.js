// Stylised water: Fresnel sky reflection, sun glints, depth-tinted body colour, shoreline foam and
// gentle waves. The sea follows the player (near detail grid + far plane) so it never ends.
import * as THREE from 'three';
import { LAKE } from './layout.js';
import { groundHeight } from './terrain.js';

const SHARED = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunCol: { value: new THREE.Color(1, 1, 1) },
  uSunI: { value: 1 },
  uSkyTop: { value: new THREE.Color(0x4f9be8) },
  uSkyHor: { value: new THREE.Color(0xbfe3ff) },
  uAmb: { value: 0.7 },
  uFogCol: { value: new THREE.Color() },
  uFogNear: { value: 60 },
  uFogFar: { value: 520 },
  uNight: { value: 0 },
};

const vert = `
  uniform float uTime; uniform float uLevel;
  attribute float aDepth;
  varying vec3 vW; varying float vDepth;
  float wave(vec2 p){ return sin(p.x * 0.15 + uTime * 1.3) * 0.16 + cos(p.y * 0.12 + uTime * 1.1) * 0.16 + sin((p.x + p.y) * 0.31 - uTime * 1.9) * 0.05; }
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.0);
    float calm = smoothstep(0.0, 3.0, aDepth);
    w.y += wave(w.xz) * (0.35 + 0.65 * calm);
    vW = w.xyz; vDepth = aDepth;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const frag = `
  uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uSunI; uniform vec3 uSkyTop; uniform vec3 uSkyHor;
  uniform float uAmb; uniform vec3 uFogCol; uniform float uFogNear; uniform float uFogFar; uniform float uNight;
  uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uHole;
  varying vec3 vW; varying float vDepth;
  float h21(vec2 p){ p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
  float hgt(vec2 p){
    float t = uTime;
  #ifdef LOW
    return vn(p * 0.5 + vec2(t * 0.35, t * 0.2)) * 0.8;
  #else
    return vn(p * 0.35 + vec2(t * 0.35, t * 0.2)) * 0.5 + vn(p * 0.9 - vec2(t * 0.25, -t * 0.4)) * 0.3 + vn(p * 2.3 + vec2(t * 0.6, t * 0.5)) * 0.12;
  #endif
  }
  void main(){
    if (uHole.z > 0.0 && abs(vW.x - uHole.x) < uHole.z && abs(vW.z - uHole.y) < uHole.z) discard;
    vec2 p = vW.xz;
    float e = 0.15;
    float h0 = hgt(p);
    vec3 n = normalize(vec3((h0 - hgt(p + vec2(e, 0.0))) * 2.2, 1.0, (h0 - hgt(p + vec2(0.0, e))) * 2.2));
    vec3 V = normalize(cameraPosition - vW);
    float dist = length(cameraPosition - vW);
    n = normalize(mix(n, vec3(0.0, 1.0, 0.0), smoothstep(60.0, 400.0, dist) * 0.8));
    float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
    vec3 R = reflect(-V, n);
    vec3 sky = mix(uSkyHor, uSkyTop, pow(clamp(R.y, 0.0, 1.0), 0.6));
    float depth = max(vDepth, 0.0);
    vec3 body = mix(uShallow, uDeep, smoothstep(0.3, 9.0, depth));
    float ndl = max(dot(n, uSunDir), 0.0);
    body *= uAmb * 0.9 + ndl * uSunI * 0.22;
    // sub-surface glow on wave flanks facing the sun
    body += uShallow * pow(max(dot(V, -uSunDir) * 0.5 + 0.5, 0.0), 4.0) * (h0 - 0.35) * 0.6 * uSunI * 0.2;
    vec3 col = mix(body, sky, fres * 0.85);
    float spec = pow(max(dot(R, uSunDir), 0.0), 380.0) * 2.2 + pow(max(dot(R, uSunDir), 0.0), 40.0) * 0.12;
    col += uSunCol * spec * uSunI * (1.0 - uNight * 0.6);
    // moon glints at night
    col += vec3(0.6, 0.7, 1.0) * pow(max(dot(R, -uSunDir), 0.0), 200.0) * uNight * 2.0;
    // shoreline foam: animated bands that roll in towards the beach
    float shore = smoothstep(0.32, 0.0, depth);
    float bands = smoothstep(0.6, 0.95, sin(depth * 11.0 - uTime * 2.2 + vn(p * 0.6) * 4.0) * 0.5 + 0.5) * smoothstep(0.9, 0.15, depth) * 0.6;
    float foamN = vn(p * 3.0 + uTime * 0.4);
    float foam = clamp(shore * (0.45 + foamN * 0.55) + bands * foamN, 0.0, 1.0) * 0.85;
    // crest foam in open water
    foam += smoothstep(0.78, 0.92, h0) * 0.25 * smoothstep(2.0, 6.0, depth);
    col = mix(col, vec3(0.92, 0.96, 1.0) * min(1.1, uAmb * 0.8 + uSunI * 0.18), clamp(foam, 0.0, 1.0));
    float alpha = mix(0.32, 0.94, smoothstep(0.0, 3.5, depth));
    alpha = max(alpha, fres);
    alpha = max(alpha, foam);
    float fogF = smoothstep(uFogNear, uFogFar, dist);
    col = min(col, vec3(3.0));
    col = mix(col, uFogCol, fogF);
    alpha = mix(alpha, 1.0, fogF);
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

function waterMaterial(shallow, deep) {
  return new THREE.ShaderMaterial({
    uniforms: { ...SHARED, uShallow: { value: new THREE.Color(shallow) }, uDeep: { value: new THREE.Color(deep) }, uLevel: { value: 0 }, uHole: { value: new THREE.Vector3(0, 0, 0) } },
    vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: true,
  });
}

function gridPlane(size, seg) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
  g.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
  return g;
}

function fillDepth(mesh, level) {
  const pos = mesh.geometry.attributes.position, d = mesh.geometry.attributes.aDepth;
  const ox = mesh.position.x, oz = mesh.position.z;
  for (let i = 0; i < pos.count; i++) d.array[i] = level - groundHeight(pos.getX(i) + ox, pos.getZ(i) + oz);
  d.needsUpdate = true;
}

export function createWater(scene) {
  const near = new THREE.Mesh(gridPlane(320, 160), waterMaterial(0x46d2c8, 0x0e4f7a));
  near.position.y = -0.05;
  near.renderOrder = 1;
  near.frustumCulled = false;
  scene.add(near);
  const far = new THREE.Mesh(gridPlane(3600, 90), waterMaterial(0x46d2c8, 0x0e4f7a));
  far.position.y = -0.12;
  far.renderOrder = 2;
  far.frustumCulled = false;
  scene.add(far);
  const lake = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r + 14, 96).rotateX(-Math.PI / 2), waterMaterial(0x5fe0d4, 0x1b6f8a));
  lake.geometry.setAttribute('aDepth', new THREE.BufferAttribute(new Float32Array(lake.geometry.attributes.position.count), 1));
  lake.position.set(LAKE.x, LAKE.level - 0.05, LAKE.z);
  lake.renderOrder = 1;
  scene.add(lake);
  fillDepth(lake, LAKE.level);
  const nearC = { x: NaN, z: NaN }, farC = { x: NaN, z: NaN };

  return {
    meshes: [near, far, lake],
    setQuality(q) {
      for (const m of [near, far, lake]) {
        if (q === 'low') m.material.defines.LOW = 1; else delete m.material.defines.LOW;
        m.material.needsUpdate = true;
      }
    },
    // focus: point the water grid follows (the player); sky: Sky for lighting; fog: scene.fog
    update(t, focus, sky, fog) {
      SHARED.uTime.value = t;
      if (focus) {
        const sx = Math.round(focus.x / 24) * 24, sz = Math.round(focus.z / 24) * 24;
        if (sx !== nearC.x || sz !== nearC.z) { nearC.x = sx; nearC.z = sz; near.position.x = sx; near.position.z = sz; fillDepth(near, 0); far.material.uniforms.uHole.value.set(sx, sz, 158); }
        const fx = Math.round(focus.x / 200) * 200, fz = Math.round(focus.z / 200) * 200;
        if (fx !== farC.x || fz !== farC.z) { farC.x = fx; farC.z = fz; far.position.x = fx; far.position.z = fz; fillDepth(far, 0); }
      }
      if (sky) {
        const u = sky.uniforms;
        SHARED.uSunDir.value.copy(u.sunDir.value);
        SHARED.uSunCol.value.copy(u.sunCol.value);
        SHARED.uSunI.value = sky.sunIntensity ?? 1;
        SHARED.uSkyTop.value.copy(u.top.value);
        SHARED.uSkyHor.value.copy(u.hor.value);
        SHARED.uAmb.value = sky.hemi.intensity;
        SHARED.uNight.value = sky.night;
      }
      if (fog) { SHARED.uFogCol.value.copy(fog.color); SHARED.uFogNear.value = fog.near; SHARED.uFogFar.value = fog.far; }
    },
  };
}
