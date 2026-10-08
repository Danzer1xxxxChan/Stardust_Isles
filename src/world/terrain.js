// Terrain height field. rawHeight() is the analytic design; the playable ground is the
// triangulated grid built from it, so groundHeight() matches the rendered mesh exactly.
import { createNoise2D, fbm, smoothstep, lerp, clamp } from '../core/math.js';
import {
  WORLD_HALF, REGIONS, VILLAGE, LAKE, MOUNTAIN, MOUNTAIN_BANDS, RIVER, LANDMARKS, ISLETS, LAKE_ISLANDS, SEA_LEVEL, FLATTEN,
} from './layout.js';

const nA = createNoise2D(1337);
const nB = createNoise2D(4242);
const nC = createNoise2D(99);

export const SEG = 360;
export const CELL = (WORLD_HALF * 2) / SEG;
const N = SEG + 1;
const REGION_KEYS = Object.keys(REGIONS);

function bump(h, x, z, b) {
  const d = Math.hypot(x - b.x, z - b.z);
  if (d >= b.r) return h;
  const t = 1 - d / b.r;
  return Math.max(h, b.h * smoothstep(0, 1, t * 1.6));
}

export function regionWeights(x, z) {
  const w = {};
  let sum = 0;
  for (const k of REGION_KEYS) {
    const r = REGIONS[k];
    const d = Math.hypot(x - r.x, z - r.z);
    let v = smoothstep(r.r, r.r * 0.75, d);
    if (k === 'meadow') v += 0.05;
    w[k] = v;
    sum += v;
  }
  for (const k of REGION_KEYS) w[k] /= sum;
  return w;
}

export function coastFactor(x, z) {
  const d = Math.hypot(x, z);
  const ang = Math.atan2(z, x);
  const cn = fbm(nB, Math.cos(ang) * 1.5 + 3, Math.sin(ang) * 1.5 + 3, 3);
  const coastR = 348 + cn * 45;
  return smoothstep(coastR + 26, coastR - 40, d);
}

export function riverX(z) {
  return RIVER.x + RIVER.amp * Math.sin(z * RIVER.freq);
}

export function rawHeight(x, z) {
  const w = regionWeights(x, z);
  const meadow = 4.5 + fbm(nA, x * 0.011, z * 0.011, 4) * 5.5;
  const forest = 10 + fbm(nA, x * 0.013 + 40, z * 0.013, 4) * 7;
  const cn = fbm(nC, x * 0.016, z * 0.016, 3);
  const canyon = 7 + smoothstep(-0.02, 0.05, cn) * 19 + smoothstep(0.26, 0.32, cn) * 13 + fbm(nA, x * 0.05, z * 0.05, 2) * 1.2;
  const coast = 2.8 + fbm(nA, x * 0.02, z * 0.02, 3) * 2.2;
  const dl = Math.hypot(x - LAKE.x, z - LAKE.z);
  const lake = lerp(6, 21 + fbm(nA, x * 0.03, z * 0.03, 2) * 2.5, smoothstep(50, 72, dl));
  const rm = Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z);
  const am = Math.atan2(z - MOUNTAIN.z, x - MOUNTAIN.x);
  let mountain = 10 + Math.max(0, MOUNTAIN.base - rm) * 0.075 + fbm(nA, x * 0.04, z * 0.04, 2) * 1.2;
  for (const b of MOUNTAIN_BANDS) {
    const rr = b.r + fbm(nB, Math.cos(am) * 2 + b.r, Math.sin(am) * 2, 2) * 8;
    mountain += smoothstep(rr + 1.6, rr - 1.6, rm) * b.h;
  }
  if (rm < MOUNTAIN.summitR) mountain = lerp(mountain, 10 + MOUNTAIN.base * 0.075 + 57 + 0.4, smoothstep(MOUNTAIN.summitR, 8, rm));

  let h = meadow * w.meadow + forest * w.forest + canyon * w.canyon + coast * w.coast + lake * w.lake + mountain * w.mountain;

  // River gorge between the meadow and the canyon.
  const dx = Math.abs(x - riverX(z));
  const riverW = smoothstep(21, 8, dx) * smoothstep(RIVER.start - 20, RIVER.start + 25, z);
  h = lerp(h, -3.5, riverW);

  // Village plateau.
  const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  h = lerp(h, VILLAGE.h, smoothstep(VILLAGE.r + 18, VILLAGE.r, dv));

  // Flatten pads under large structures.
  for (const f of FLATTEN) {
    const df = Math.hypot(x - f.x, z - f.z);
    if (df < f.r + 10) h = lerp(h, f.h, smoothstep(f.r + 10, f.r, df));
  }
  h = bump(h, x, z, LANDMARKS.lookout);
  h = bump(h, x, z, LANDMARKS.observatory);
  for (const b of LAKE_ISLANDS) h = bump(h, x, z, b);

  // Coastline.
  const land = coastFactor(x, z);
  const seabed = -12 + fbm(nC, x * 0.01, z * 0.01, 2) * 3;
  h = lerp(seabed, h, land);
  for (const b of ISLETS) h = bump(h, x, z, b);
  return h;
}

// ---- Grid ----
let heights = null;
let normals = null;

export function buildTerrain() {
  heights = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    const z = -WORLD_HALF + j * CELL;
    for (let i = 0; i < N; i++) {
      const x = -WORLD_HALF + i * CELL;
      heights[j * N + i] = rawHeight(x, z);
    }
  }
  normals = new Float32Array(N * N * 3);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const hl = heights[j * N + Math.max(0, i - 1)], hr = heights[j * N + Math.min(N - 1, i + 1)];
      const hd = heights[Math.max(0, j - 1) * N + i], hu = heights[Math.min(N - 1, j + 1) * N + i];
      let nx = hl - hr, ny = 2 * CELL, nz = hd - hu;
      const l = Math.hypot(nx, ny, nz);
      normals[(j * N + i) * 3] = nx / l;
      normals[(j * N + i) * 3 + 1] = ny / l;
      normals[(j * N + i) * 3 + 2] = nz / l;
    }
  }
  return { heights, normals, N, CELL };
}

export function gridHeight(i, j) {
  return heights[clamp(j, 0, SEG) * N + clamp(i, 0, SEG)];
}
export function gridNormal(i, j, out = [0, 1, 0]) {
  const k = (clamp(j, 0, SEG) * N + clamp(i, 0, SEG)) * 3;
  out[0] = normals[k]; out[1] = normals[k + 1]; out[2] = normals[k + 2];
  return out;
}

// Exact height of the rendered triangle under (x, z). Quads are split along the 00-11 diagonal.
export function groundHeight(x, z) {
  const gx = clamp((x + WORLD_HALF) / CELL, 0, SEG - 1e-4);
  const gz = clamp((z + WORLD_HALF) / CELL, 0, SEG - 1e-4);
  const i = Math.floor(gx), j = Math.floor(gz);
  const fx = gx - i, fz = gz - j;
  const h00 = heights[j * N + i], h10 = heights[j * N + i + 1];
  const h01 = heights[(j + 1) * N + i], h11 = heights[(j + 1) * N + i + 1];
  if (fz > fx) return h00 + (h11 - h01) * fx + (h01 - h00) * fz;
  return h00 + (h10 - h00) * fx + (h11 - h10) * fz;
}

// Face normal of the triangle under (x, z).
export function groundNormal(x, z, out = { x: 0, y: 1, z: 0 }) {
  const gx = clamp((x + WORLD_HALF) / CELL, 0, SEG - 1e-4);
  const gz = clamp((z + WORLD_HALF) / CELL, 0, SEG - 1e-4);
  const i = Math.floor(gx), j = Math.floor(gz);
  const fx = gx - i, fz = gz - j;
  const h00 = heights[j * N + i], h10 = heights[j * N + i + 1];
  const h01 = heights[(j + 1) * N + i], h11 = heights[(j + 1) * N + i + 1];
  let dhdx, dhdz;
  if (fz > fx) { dhdx = (h11 - h01) / CELL; dhdz = (h01 - h00) / CELL; }
  else { dhdx = (h10 - h00) / CELL; dhdz = (h11 - h10) / CELL; }
  const l = Math.hypot(dhdx, 1, dhdz);
  out.x = -dhdx / l; out.y = 1 / l; out.z = -dhdz / l;
  return out;
}

export function waterLevel(x, z) {
  if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 8) return LAKE.level;
  return SEA_LEVEL;
}

export function regionAt(x, z) {
  const w = regionWeights(x, z);
  let best = 'meadow', bw = -1;
  for (const k of REGION_KEYS) if (w[k] > bw) { bw = w[k]; best = k; }
  if (coastFactor(x, z) < 0.5 && best !== 'coast') {
    const h = groundHeight(x, z);
    if (h < 0) return 'sea';
  }
  return best;
}

export function isInWorld(x, z) {
  return Math.abs(x) < WORLD_HALF - 4 && Math.abs(z) < WORLD_HALF - 4;
}

// Content-placement helpers that adapt to the generated terrain.
export function highestPoint(cx, cz, r, step = CELL) {
  let best = { x: cx, z: cz, y: -Infinity };
  for (let z = cz - r; z <= cz + r; z += step) {
    for (let x = cx - r; x <= cx + r; x += step) {
      if (Math.hypot(x - cx, z - cz) > r) continue;
      const y = groundHeight(x, z);
      if (y > best.y) best = { x, z, y };
    }
  }
  return best;
}

export function flattestNear(cx, cz, r, minY = 0.5) {
  let best = null, bs = -1;
  const n = { x: 0, y: 1, z: 0 };
  for (let z = cz - r; z <= cz + r; z += CELL) {
    for (let x = cx - r; x <= cx + r; x += CELL) {
      const y = groundHeight(x, z);
      if (y < minY) continue;
      groundNormal(x, z, n);
      const score = n.y - Math.hypot(x - cx, z - cz) / (r * 20);
      if (score > bs) { bs = score; best = { x, z, y }; }
    }
  }
  return best || { x: cx, z: cz, y: groundHeight(cx, cz) };
}
