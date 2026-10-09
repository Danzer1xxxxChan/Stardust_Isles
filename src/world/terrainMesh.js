// Terrain rendering: vertex-coloured chunks with smooth normals, skirts (so LOD seams never show) and a
// shader that adds world-space detail (grass mottling, dirt speckles, rock strata, underwater caustics).
import * as THREE from 'three';
import { createNoise2D, smoothstep } from '../core/math.js';
import { SEG, CELL, FCH, gridHeight, gridNormal, regionWeights, waterLevel, frontierWeight, biomeWeights } from './terrain.js';
import { WORLD_HALF, VILLAGE } from './layout.js';
import { WIND } from './props.js';

export const CH = FCH;
export const CHUNK_SIZE = CH * CELL;
const tint = createNoise2D(777);

const C = (hex) => new THREE.Color(hex);
const GRASS = {
  meadow: C(0x8cc95a), forest: C(0x4e8a43), canyon: C(0xcf9a5e), coast: C(0xb7cf73), lake: C(0x67b77e), mountain: C(0x86a06a),
};
const FAR_GRASS = { meadow: C(0x88c75a), forest: C(0x467f42), canyon: C(0xc98f55), snow: C(0xa7b79d), crystal: C(0x7cc4a4) };
const SAND = C(0xe9d8a6), SEABED = C(0xb8a67c), DEEP = C(0x5d8a94), ROCK = C(0x8f8b85), RED = C(0xb4613b),
  SNOW = C(0xf3f7fb), DIRT = C(0xb69466), PEARL = C(0xe8def5);

const tmp = new THREE.Color();
const tmp2 = new THREE.Color();
const nrm = [0, 1, 0];
const bw = {};

function shoreAndSea(x, z, h, ny, out, sand = SAND) {
  const wl = waterLevel(x, z);
  out.lerp(sand, smoothstep(wl + 2.6, wl + 1.2, h) * smoothstep(0.6, 0.8, ny));
  if (h < wl) {
    tmp.copy(SEABED).lerp(DEEP, smoothstep(wl - 1, wl - 9, h));
    out.lerp(tmp, smoothstep(wl, wl - 1.5, h));
  }
}

function coreColor(x, z, h, ny, out) {
  const w = regionWeights(x, z);
  out.setRGB(0, 0, 0);
  for (const k in GRASS) {
    out.r += GRASS[k].r * w[k]; out.g += GRASS[k].g * w[k]; out.b += GRASS[k].b * w[k];
  }
  const v = tint(x * 0.03, z * 0.03) * 0.07 + tint(x * 0.2, z * 0.2) * 0.03;
  out.offsetHSL(0, 0, v);
  const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  if (dv < VILLAGE.r + 6) out.lerp(DIRT, smoothstep(VILLAGE.r + 6, VILLAGE.r - 10, dv) * (0.35 + tint(x * 0.08, z * 0.08) * 0.3));
  tmp.copy(ROCK).lerp(RED, Math.min(1, w.canyon * 1.4));
  out.lerp(tmp, smoothstep(0.8, 0.62, ny));
  out.lerp(SNOW, smoothstep(47, 55, h) * smoothstep(0.5, 0.7, ny));
  shoreAndSea(x, z, h, ny, out);
  return out;
}

function farColor(x, z, h, ny, out) {
  const w = biomeWeights(x, z, bw);
  out.setRGB(0, 0, 0);
  for (const k in FAR_GRASS) {
    out.r += FAR_GRASS[k].r * w[k]; out.g += FAR_GRASS[k].g * w[k]; out.b += FAR_GRASS[k].b * w[k];
  }
  out.offsetHSL(0, 0, tint(x * 0.03, z * 0.03) * 0.07 + tint(x * 0.2, z * 0.2) * 0.03);
  tmp.copy(ROCK).lerp(RED, Math.min(1, w.canyon * 1.4));
  out.lerp(tmp, smoothstep(0.8, 0.62, ny));
  out.lerp(SNOW, w.snow * smoothstep(6, 14, h) * smoothstep(0.55, 0.75, ny));
  tmp2.copy(SAND).lerp(PEARL, w.crystal);
  shoreAndSea(x, z, h, ny, out, tmp2);
  return out;
}

export function terrainColor(x, z, h, ny, out) {
  const fw = frontierWeight(x, z);
  if (fw <= 0) return coreColor(x, z, h, ny, out);
  if (fw >= 1) return farColor(x, z, h, ny, out);
  coreColor(x, z, h, ny, out);
  const r = out.r, g = out.g, b = out.b;
  farColor(x, z, h, ny, out);
  out.setRGB(r + (out.r - r) * fw, g + (out.g - g) * fw, b + (out.b - b) * fw);
  return out;
}

const NOISE_GLSL = `
  float tHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float tNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(tHash(i), tHash(i + vec2(1,0)), f.x), mix(tHash(i + vec2(0,1)), tHash(i + vec2(1,1)), f.x), f.y); }
`;

function makeTerrainMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = WIND.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWN; uniform float uTime;\n' + NOISE_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 p = vWPos.xz;
          float n1 = tNoise(p * 0.18), n2 = tNoise(p * 0.9), n3 = tNoise(p * 4.3);
          float slope = 1.0 - smoothstep(0.62, 0.86, vWN.y);
          // grass mottling and fine speckle
          vec3 c = diffuseColor.rgb;
          c *= 0.9 + n1 * 0.16 + (n2 - 0.5) * 0.08 + (n3 - 0.5) * 0.06;
          // dry patches / lush patches
          c = mix(c, c * vec3(1.08, 1.02, 0.86), smoothstep(0.62, 0.8, n1) * (1.0 - slope) * 0.6);
          // rock strata on slopes
          float strata = sin(vWPos.y * 2.6 + n1 * 3.0 + n2 * 1.2) * 0.5 + 0.5;
          c *= mix(1.0, 0.82 + strata * 0.3, slope);
          // underwater caustics in the sea shallows
          float depth = -vWPos.y;
          if (depth > 0.05 && depth < 9.0 && vWPos.y < 0.0) {
            vec2 q = p * 0.55;
            float ca = sin(q.x * 2.1 + uTime * 1.3 + sin(q.y * 1.7 + uTime)) * sin(q.y * 2.3 - uTime * 1.1 + sin(q.x * 1.3 - uTime * 0.7));
            ca = pow(abs(ca), 3.0);
            c += vec3(0.55, 0.75, 0.8) * ca * 0.45 * smoothstep(9.0, 0.5, depth);
          }
          diffuseColor.rgb = c;
        }`);
  };
  m.customProgramCacheKey = () => 'terrain-v2';
  return m;
}

export const terrainMaterial = makeTerrainMaterial();

// Builds one terrain chunk (grid chunk indices ci, cj; any integers) with vertex stride `step`.
export function buildTerrainChunk(ci, cj, step = 1) {
  const cells = CH / step, n = cells + 1;
  const verts = n * n + n * 4;
  const pos = new Float32Array(verts * 3);
  const col = new Float32Array(verts * 3);
  const nor = new Float32Array(verts * 3);
  const c = new THREE.Color();
  const put = (k, gi, gj, dy) => {
    const x = -WORLD_HALF + gi * CELL, z = -WORLD_HALF + gj * CELL;
    const h = gridHeight(gi, gj);
    gridNormal(gi, gj, nrm);
    pos[k * 3] = x; pos[k * 3 + 1] = h - dy; pos[k * 3 + 2] = z;
    nor[k * 3] = nrm[0]; nor[k * 3 + 1] = nrm[1]; nor[k * 3 + 2] = nrm[2];
    terrainColor(x, z, h, nrm[1], c);
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
  };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) put(j * n + i, ci * CH + i * step, cj * CH + j * step, 0);
  const idx = [];
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const a = j * n + i, b = a + 1, cc = a + n, d = cc + 1;
      idx.push(a, cc, d, a, d, b);
    }
  }
  // Skirts: a 3 m curtain hanging below every edge hides cracks between chunks of different LOD.
  let k = n * n;
  const edges = [
    (t) => [t, 0], (t) => [cells, t], (t) => [cells - t, cells], (t) => [0, cells - t],
  ];
  for (const e of edges) {
    const start = k;
    for (let t = 0; t < n; t++) {
      const [i, j] = e(t);
      put(k++, ci * CH + i * step, cj * CH + j * step, 3);
    }
    for (let t = 0; t < cells; t++) {
      const [i0, j0] = e(t), [i1, j1] = e(t + 1);
      const top0 = j0 * n + i0, top1 = j1 * n + i1, bot0 = start + t, bot1 = start + t + 1;
      idx.push(top0, bot1, bot0, top0, top1, bot1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, terrainMaterial);
  m.receiveShadow = true;
  m.castShadow = true;
  return m;
}

export function createTerrain() {
  const group = new THREE.Group();
  const chunks = SEG / CH;
  for (let cj = 0; cj < chunks; cj++) for (let ci = 0; ci < chunks; ci++) group.add(buildTerrainChunk(ci, cj, 1));
  return group;
}
