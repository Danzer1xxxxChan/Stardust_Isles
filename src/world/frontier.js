// Far isles streamer: builds terrain / vegetation / colliders for the chunks around the player on demand
// (any distance from the authored island) and unloads chunks that fall out of range.
import * as THREE from 'three';
import { buildTerrainChunk, CH, CHUNK_SIZE } from './terrainMesh.js';
import { SEG, groundHeight, groundNormal, waterLevel, biomeWeights, frontierWeight, touchFrontierCache } from './terrain.js';
import { WORLD_HALF } from './layout.js';
import { library } from './scatter.js';
import * as P from './props.js';
import { hash2, createNoise2D, mulberry32 } from '../core/math.js';

const CORE = SEG / CH;
const isCore = (ci, cj) => ci >= 0 && cj >= 0 && ci < CORE && cj < CORE;
const STEP = 3.2;
const clump = createNoise2D(4711);

const farVegMaterial = P.windify(P.rimify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 }), 0xf0ffd0, 0.2), 'attr');
const farRockMaterial = P.propMaterial;
const farGlowMaterial = P.glowMaterial(0x9a6bff, 1.6);

// Choose what grows at a far-isle sample point.
function pickVeg(x, z, h, ny, w, r, r2, c) {
  if (h < 0.15) return null;
  if (ny < 0.8) return r < 0.04 ? [w.canyon > 0.4 ? 'redrock' : 'rock', 0.6 + r2 * 1.3] : null;
  if (h < 1.1) {
    if ((w.meadow + w.crystal) > 0.4 && r < 0.03) return ['palm', 0.9 + r2 * 0.4];
    if (w.crystal > 0.5 && r > 0.95) return ['crystal', 0.5 + r2 * 0.6];
    return r > 0.985 ? ['rock', 0.4 + r2 * 0.6] : null;
  }
  let roll = r;
  const dens = [
    ['forest', w.forest * (0.14 + Math.max(0, c) * 0.22), () => (r2 < 0.45 ? 'darkpine' : r2 < 0.8 ? 'pine' : 'oak'), 0.9 + r2 * 0.6],
    ['meadow', w.meadow * Math.max(0, c - 0.15) * 0.14, () => (r2 < 0.85 ? 'oak' : 'pine'), 0.85 + r2 * 0.5],
    ['snow', w.snow * (0.03 + Math.max(0, c) * 0.08), () => 'snowpine', 0.8 + r2 * 0.6],
    ['canyon', w.canyon * 0.02, () => (r2 < 0.7 ? 'cactus' : 'deadtree'), 0.8 + r2 * 0.5],
    ['crystal', w.crystal * 0.035, () => (r2 < 0.6 ? 'crystal' : 'palm'), 0.6 + r2 * 0.8],
  ];
  for (const [, d, kind, s] of dens) { if (roll < d) return [kind(), s]; roll -= d; }
  if (roll < 0.012) return [w.canyon > 0.5 ? 'redrock' : 'rock', 0.3 + r2 * 0.8];
  roll -= 0.012;
  if (roll < 0.035 * (w.meadow + w.forest + w.crystal)) return ['bush', 0.7 + r2 * 0.6];
  roll -= 0.035;
  if (w.forest > 0.4 && roll < 0.02) return ['mushroom', 0.8 + r2 * 0.8];
  if (w.meadow > 0.4 && c > 0.25 && roll < 0.12) return [r2 < 0.15 ? 'sunflower' : 'flowers', 0.9 + r2 * 0.4];
  return null;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const _n3 = new THREE.Matrix3();

function mergeInstances(items, lib, withH) {
  let count = 0;
  for (const it of items) count += lib[it.type].variants[it.v].attributes.position.count;
  if (!count) return null;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
  const hh = withH ? new Float32Array(count) : null;
  let o = 0;
  for (const it of items) {
    const def = lib[it.type];
    const g = def.variants[it.v];
    const gp = g.attributes.position.array, gn = g.attributes.normal.array, gc = g.attributes.color.array;
    const n = g.attributes.position.count;
    _q.setFromAxisAngle(_up, it.r);
    _m.compose(_v.set(it.x, it.y, it.z), _q, _s.setScalar(it.s));
    _n3.getNormalMatrix(_m);
    const e = _m.elements, ne = _n3.elements, k = 1 + it.tint;
    for (let i = 0; i < n; i++) {
      const x = gp[i * 3], y = gp[i * 3 + 1], z = gp[i * 3 + 2];
      pos[o * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
      pos[o * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      pos[o * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      const nx = gn[i * 3], ny = gn[i * 3 + 1], nz = gn[i * 3 + 2];
      nor[o * 3] = ne[0] * nx + ne[3] * ny + ne[6] * nz;
      nor[o * 3 + 1] = ne[1] * nx + ne[4] * ny + ne[7] * nz;
      nor[o * 3 + 2] = ne[2] * nx + ne[5] * ny + ne[8] * nz;
      col[o * 3] = gc[i * 3] * k; col[o * 3 + 1] = gc[i * 3 + 1] * k; col[o * 3 + 2] = gc[i * 3 + 2] * k;
      if (hh) hh[o] = def.sway ? Math.max(0, y - 0.25) : 0;
      o++;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (hh) geo.setAttribute('aH', new THREE.BufferAttribute(hh, 1));
  geo.computeBoundingSphere();
  return geo;
}

export class Frontier {
  constructor(scene, colliders) {
    this.scene = scene;
    this.col = colliders;
    this.chunks = new Map();
    this.radius = 6;
    this.vegRadius = 3;
    this.onEnter = null; // (chunk) => void, called when a chunk gets its near-detail (vegetation) built
    this.onLeave = null;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.lib = library();
  }

  setQuality(q) {
    this.radius = { low: 4, medium: 5, high: 6, ultra: 7 }[q] ?? 6;
    this.vegRadius = { low: 2, medium: 3, high: 3, ultra: 4 }[q] ?? 3;
  }

  // Authored-square chunks whose corners reach into the far-isle blend get far-isle vegetation too.
  _coreHasFar(ci, cj) {
    let far = 0;
    for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const x = -WORLD_HALF + (ci + a) * CHUNK_SIZE, z = -WORLD_HALF + (cj + b) * CHUNK_SIZE;
      far = Math.max(far, frontierWeight(x, z));
    }
    return far > 0.6;
  }

  chunkAt(x, z) {
    return [Math.floor((x + WORLD_HALF) / CHUNK_SIZE), Math.floor((z + WORLD_HALF) / CHUNK_SIZE)];
  }

  // Ensures chunks around (px, pz) exist. `budget` is the time slice in ms per frame (at least one job runs).
  update(px, pz, budget = 5, force = false) {
    touchFrontierCache();
    const [pci, pcj] = this.chunkAt(px, pz);
    const R = this.radius;
    const jobs = [];
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      const ci = pci + di, cj = pcj + dj;
      const core = isCore(ci, cj);
      if (core && !this._coreHasFar(ci, cj)) continue;
      const cx = -WORLD_HALF + (ci + 0.5) * CHUNK_SIZE, cz = -WORLD_HALF + (cj + 0.5) * CHUNK_SIZE;
      const d = Math.hypot(cx - px, cz - pz) / CHUNK_SIZE;
      if (d > R + 0.5) continue;
      const lod = core ? 0 : d < 2.2 ? 1 : d < 4.2 ? 2 : 3;
      const veg = d < this.vegRadius + 0.5;
      const key = ci * 65536 + cj;
      const c = this.chunks.get(key);
      if (!c || c.lod !== lod || c.wantVeg !== veg) jobs.push({ key, ci, cj, lod, veg, d, c });
      else c.seen = true;
    }
    jobs.sort((a, b) => a.d - b.d);
    const t0 = performance.now();
    for (const j of jobs) {
      if (!force && performance.now() - t0 > budget && j !== jobs[0]) break;
      this._build(j);
    }
    // Unload far chunks
    for (const [key, c] of this.chunks) {
      const cx = -WORLD_HALF + (c.ci + 0.5) * CHUNK_SIZE, cz = -WORLD_HALF + (c.cj + 0.5) * CHUNK_SIZE;
      if (Math.hypot(cx - px, cz - pz) / CHUNK_SIZE > R + 1.5) this._unload(key, c);
    }
    return jobs.length;
  }

  _build(j) {
    let c = j.c;
    if (!c) {
      c = { ci: j.ci, cj: j.cj, lod: 0, wantVeg: false, terrain: null, veg: [], cols: [], entered: false, data: {} };
      this.chunks.set(j.key, c);
    }
    if (c.lod !== j.lod && j.lod > 0) {
      if (c.terrain) { this.group.remove(c.terrain); c.terrain.geometry.dispose(); }
      c.terrain = buildTerrainChunk(j.ci, j.cj, j.lod);
      c.terrain.castShadow = j.lod === 1;
      this.group.add(c.terrain);
      c.lod = j.lod;
    }
    if (j.veg && !c.wantVeg) this._buildVeg(c);
    else if (!j.veg && c.wantVeg) this._dropVeg(c);
    c.wantVeg = j.veg;
  }

  _buildVeg(c) {
    const lib = this.lib;
    const x0 = -WORLD_HALF + c.ci * CHUNK_SIZE, z0 = -WORLD_HALF + c.cj * CHUNK_SIZE;
    const soft = [], hard = [], glow = [];
    const nrm = { x: 0, y: 1, z: 0 }, w = {};
    const spots = [];
    const gx0 = Math.ceil(x0 / STEP), gz0 = Math.ceil(z0 / STEP);
    for (let gz = gz0; gz * STEP < z0 + CHUNK_SIZE; gz++) for (let gx = gx0; gx * STEP < x0 + CHUNK_SIZE; gx++) {
      const x = gx * STEP + (hash2(gx, gz, 1) - 0.5) * STEP * 0.9;
      const z = gz * STEP + (hash2(gx, gz, 2) - 0.5) * STEP * 0.9;
      if (frontierWeight(x, z) < 0.6) continue;
      const h = groundHeight(x, z);
      if (h < waterLevel(x, z) + 0.15) continue;
      groundNormal(x, z, nrm);
      biomeWeights(x, z, w);
      const r = hash2(gx, gz, 3), r2 = hash2(gx, gz, 4);
      const pick = pickVeg(x, z, h, nrm.y, w, r, r2, clump(x * 0.02, z * 0.02));
      if (!pick) {
        if (nrm.y > 0.85 && h > 1 && r > 0.93) spots.push({ x, y: h, z, w: { ...w } });
        continue;
      }
      const [type, s] = pick;
      const def = lib[type];
      const it = { type, v: Math.floor(hash2(gx, gz, 7) * def.variants.length), x, y: h - (type.includes('rock') ? 0.2 : 0), z, s, r: hash2(gx, gz, 13) * Math.PI * 2, tint: (hash2(gx, gz, 17) - 0.5) * 0.12 };
      (def.glow ? glow : def.sway ? soft : hard).push(it);
      if (def.col) c.cols.push(this.col.addCylinder(x, z, def.col * s, h - 0.5, h + 3 * s));
    }
    const add = (items, mat, withH) => {
      const geo = mergeInstances(items, lib, withH);
      if (!geo) return;
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true; m.receiveShadow = true;
      this.group.add(m);
      c.veg.push(m);
    };
    add(soft, farVegMaterial, true);
    add(hard, farRockMaterial, false);
    add(glow, farGlowMaterial, false);
    c.data.spots = spots;
    c.data.rng = mulberry32((c.ci * 73856093) ^ (c.cj * 19349663));
    if (!c.entered) { c.entered = true; this.onEnter?.(c); }
  }

  _dropVeg(c) {
    for (const m of c.veg) { this.group.remove(m); m.geometry.dispose(); }
    c.veg.length = 0;
    for (const col of c.cols) this.col.removeStatic(col);
    c.cols.length = 0;
  }

  _unload(key, c) {
    this._dropVeg(c);
    if (c.terrain) { this.group.remove(c.terrain); c.terrain.geometry.dispose(); }
    if (c.entered) this.onLeave?.(c);
    this.chunks.delete(key);
  }
}
