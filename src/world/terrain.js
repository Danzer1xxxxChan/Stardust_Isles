// Terrain height field. worldHeight() is the analytic design (authored island + endless far isles); the playable ground is the
// triangulated grid built from it, so groundHeight() matches the rendered mesh exactly.
import { createNoise2D, fbm, smoothstep, lerp, clamp } from '../core/math.js';
import {
  WORLD_HALF, REGIONS, VILLAGE, LAKE, MOUNTAIN, MOUNTAIN_BANDS, RIVER, LANDMARKS, ISLETS, LAKE_ISLANDS, SEA_LEVEL, FLATTEN,
  FRONTIER, CAUSEWAYS, BIOMES,
} from './layout.js';

const nA = createNoise2D(1337);
const nB = createNoise2D(4242);
const nC = createNoise2D(99);
const nF = createNoise2D(8081);
const nG = createNoise2D(6262);
const nT = createNoise2D(1717);
const nM = createNoise2D(2929);
const BIOME_KEYS = Object.keys(BIOMES);

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

export function coreHeight(x, z) {
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
  return h;
}

// ---- Far isles ----
export function frontierWeight(x, z) {
  return smoothstep(FRONTIER.start, FRONTIER.full, Math.hypot(x, z));
}

// Smooth biome weights from two low-frequency climate fields.
export function biomeWeights(x, z, out = {}) {
  const bt = fbm(nT, x * 0.0011 + 11, z * 0.0011, 2), bm = fbm(nM, x * 0.0013, z * 0.0013 + 7, 2);
  let sum = 0;
  for (const k of BIOME_KEYS) {
    const b = BIOMES[k];
    const d2 = (bt - b.bt) ** 2 + (bm - b.bm) ** 2;
    const w = Math.exp(-d2 * 22);
    out[k] = w; sum += w;
  }
  for (const k of BIOME_KEYS) out[k] /= sum;
  return out;
}

export function biomeAt(x, z) {
  const w = biomeWeights(x, z);
  let best = 'meadow', bw = -1;
  for (const k of BIOME_KEYS) if (w[k] > bw) { bw = w[k]; best = k; }
  return best;
}

const _bw = {};
// "Land-ness" of the far isles: > 0 is land, slightly < 0 wadeable shallows, << 0 deep channels.
export function frontierLand(x, z) {
  const r = Math.hypot(x, z);
  const c = fbm(nF, x * 0.0024, z * 0.0024, 3);
  const d = fbm(nG, x * 0.011, z * 0.011, 3);
  return c * 1.5 + d * 0.32 + 0.06 - (1 - smoothstep(FRONTIER.landFrom, FRONTIER.landFull, r)) * 0.7;
}

export function frontierHeight(x, z) {
  const land = frontierLand(x, z);
  if (land < 0) {
    let h = lerp(0.4, -0.45, smoothstep(0, -0.06, land));
    h -= smoothstep(-0.12, -0.3, land) * 0.5;
    h -= smoothstep(-0.38, -0.7, land) * 7.5;
    return h;
  }
  const w = biomeWeights(x, z, _bw);
  const t = smoothstep(0, 0.65, land);
  const n1 = fbm(nG, x * 0.03 + 5, z * 0.03, 2);
  let h = 0;
  h += w.meadow * (t * 9 + n1 * 1.6 * t);
  h += w.forest * (t * 13 + n1 * 2.5 * t);
  if (w.canyon > 0.01) {
    const base = t * 26 + n1 * 2;
    const step = 6.5, k = base / step, f = k - Math.floor(k);
    h += w.canyon * ((Math.floor(k) + smoothstep(0.55, 0.9, f)) * step);
  }
  if (w.snow > 0.01) {
    const ridge = 1 - Math.abs(fbm(nF, x * 0.012 + 3, z * 0.012 - 9, 3));
    h += w.snow * (t * 26 + ridge * ridge * 16 * t);
  }
  h += w.crystal * (t * 5 + n1 * 1.2 * t);
  return 0.4 + h + smoothstep(0, 0.05, land) * 0.3;
}

// The full designed world: authored island blended into the far isles, plus islets and causeways.
export function worldHeight(x, z) {
  const w = frontierWeight(x, z);
  let h = w >= 1 ? frontierHeight(x, z) : w <= 0 ? coreHeight(x, z) : lerp(coreHeight(x, z), frontierHeight(x, z), w);
  for (const b of ISLETS) h = bump(h, x, z, b);
  const r = Math.hypot(x, z);
  if (r > 300 && r < 900) {
    for (const a of CAUSEWAYS) {
      const ca = Math.cos(a), sa = Math.sin(a);
      const along = x * ca + z * sa;
      if (along < 300) continue;
      const side = Math.abs(-x * sa + z * ca + Math.sin(along * 0.03) * 6);
      if (side > 9) continue;
      const top = 0.35 + fbm(nG, x * 0.08, z * 0.08, 2) * 0.12;
      const k = smoothstep(9, 4, side) * smoothstep(300, 330, along) * smoothstep(900, 820, along);
      if (h < top) h = lerp(h, top, k);
    }
  }
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
      heights[j * N + i] = worldHeight(x, z);
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

// Global vertex grid: index (i, j) sits at (-WORLD_HALF + i*CELL, -WORLD_HALF + j*CELL) and is unbounded.
// Inside the authored square the heights come from the prebuilt grid; outside they are computed
// lazily per FCH x FCH chunk and cached, so far-isle chunks stream in wherever the player goes.
export const FCH = 30;
const fcache = new Map();
let ftick = 0;

function fchunk(ci, cj) {
  const key = ci * 65536 + cj;
  const c = fcache.get(key);
  if (c) { c.t = ftick; return c.h; }
  const h = new Float32Array(FCH * FCH);
  for (let j = 0; j < FCH; j++) {
    const z = -WORLD_HALF + (cj * FCH + j) * CELL;
    for (let i = 0; i < FCH; i++) h[j * FCH + i] = worldHeight(-WORLD_HALF + (ci * FCH + i) * CELL, z);
  }
  fcache.set(key, { h, t: ftick });
  if (fcache.size > 2000) for (const [k, v] of fcache) if (ftick - v.t > 600) fcache.delete(k);
  return h;
}

// Ticked once per frame; chunks untouched for a while are evicted from the height cache.
export function touchFrontierCache() { ftick++; }

export function vertexHeight(i, j) {
  if (i >= 0 && j >= 0 && i <= SEG && j <= SEG) return heights[j * N + i];
  const ci = Math.floor(i / FCH), cj = Math.floor(j / FCH);
  return fchunk(ci, cj)[(j - cj * FCH) * FCH + (i - ci * FCH)];
}

export function gridHeight(i, j) {
  return vertexHeight(i, j);
}
export function gridNormal(i, j, out = [0, 1, 0]) {
  if (i > 0 && j > 0 && i < SEG && j < SEG) {
    const k = (j * N + i) * 3;
    out[0] = normals[k]; out[1] = normals[k + 1]; out[2] = normals[k + 2];
    return out;
  }
  const nx = vertexHeight(i - 1, j) - vertexHeight(i + 1, j), ny = 2 * CELL, nz = vertexHeight(i, j - 1) - vertexHeight(i, j + 1);
  const l = Math.hypot(nx, ny, nz);
  out[0] = nx / l; out[1] = ny / l; out[2] = nz / l;
  return out;
}

function cellHeights(x, z, o) {
  const gx = (x + WORLD_HALF) / CELL, gz = (z + WORLD_HALF) / CELL;
  const i = Math.floor(gx), j = Math.floor(gz);
  o.fx = gx - i; o.fz = gz - j;
  if (i >= 0 && j >= 0 && i < SEG && j < SEG) {
    const k = j * N + i;
    o.h00 = heights[k]; o.h10 = heights[k + 1]; o.h01 = heights[k + N]; o.h11 = heights[k + N + 1];
  } else {
    o.h00 = vertexHeight(i, j); o.h10 = vertexHeight(i + 1, j); o.h01 = vertexHeight(i, j + 1); o.h11 = vertexHeight(i + 1, j + 1);
  }
  return o;
}
const _c = { fx: 0, fz: 0, h00: 0, h10: 0, h01: 0, h11: 0 };

// Exact height of the rendered triangle under (x, z). Quads are split along the 00-11 diagonal.
export function groundHeight(x, z) {
  const { fx, fz, h00, h10, h01, h11 } = cellHeights(x, z, _c);
  if (fz > fx) return h00 + (h11 - h01) * fx + (h01 - h00) * fz;
  return h00 + (h10 - h00) * fx + (h11 - h10) * fz;
}

// Face normal of the triangle under (x, z).
export function groundNormal(x, z, out = { x: 0, y: 1, z: 0 }) {
  const { fx, fz, h00, h10, h01, h11 } = cellHeights(x, z, _c);
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
  if (frontierWeight(x, z) > 0.5) return groundHeight(x, z) < -0.6 ? 'farsea' : 'far:' + biomeAt(x, z);
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
