import * as THREE from 'three';
import { createNoise2D, smoothstep, lerp } from '../core/math.js';
import { SEG, CELL, gridHeight, gridNormal, regionWeights, waterLevel } from './terrain.js';
import { WORLD_HALF, VILLAGE } from './layout.js';

const CH = 30;
const tint = createNoise2D(777);

const C = (hex) => new THREE.Color(hex);
const GRASS = {
  meadow: C(0x8cc95a), forest: C(0x4e8a43), canyon: C(0xcf9a5e), coast: C(0xb7cf73), lake: C(0x67b77e), mountain: C(0x86a06a),
};
const SAND = C(0xe9d8a6), SEABED = C(0xb8a67c), DEEP = C(0x5d8a94), ROCK = C(0x8f8b85), RED = C(0xb4613b),
  SNOW = C(0xf3f7fb), DIRT = C(0xb69466);

const tmp = new THREE.Color();
const nrm = [0, 1, 0];

export function terrainColor(x, z, h, ny, out) {
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
  const wl = waterLevel(x, z);
  out.lerp(SAND, smoothstep(wl + 2.6, wl + 1.2, h) * smoothstep(0.6, 0.8, ny));
  if (h < wl) {
    tmp.copy(SEABED).lerp(DEEP, smoothstep(wl - 1, wl - 9, h));
    out.lerp(tmp, smoothstep(wl, wl - 1.5, h));
  }
  return out;
}

export function createTerrain() {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  const chunks = SEG / CH;
  for (let cj = 0; cj < chunks; cj++) {
    for (let ci = 0; ci < chunks; ci++) {
      const n = CH + 1;
      const pos = new Float32Array(n * n * 3);
      const col = new Float32Array(n * n * 3);
      const c = new THREE.Color();
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const gi = ci * CH + i, gj = cj * CH + j;
          const x = -WORLD_HALF + gi * CELL, z = -WORLD_HALF + gj * CELL;
          const h = gridHeight(gi, gj);
          gridNormal(gi, gj, nrm);
          const k = (j * n + i) * 3;
          pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
          terrainColor(x, z, h, nrm[1], c);
          col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
        }
      }
      const idx = [];
      for (let j = 0; j < CH; j++) {
        for (let i = 0; i < CH; i++) {
          const a = j * n + i, b = a + 1, cc = a + n, d = cc + 1;
          idx.push(a, cc, d, a, d, b);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, material);
      m.receiveShadow = true;
      m.castShadow = true;
      group.add(m);
    }
  }
  return group;
}
