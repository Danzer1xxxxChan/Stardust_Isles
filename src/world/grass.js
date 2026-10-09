// Dense wind-blown grass around the player: tiles of instanced blades, coloured from the terrain,
// swaying in the shared wind and bending away from the character. Rebuilt tile-by-tile as you move.
import * as THREE from 'three';
import { groundHeight, groundNormal, waterLevel, regionWeights, frontierWeight, biomeWeights, CELL } from './terrain.js';
import { terrainColor } from './terrainMesh.js';
import { VILLAGE } from './layout.js';
import { WIND } from './props.js';
import { hash2, smoothstep } from '../core/math.js';

const TILE = 24;

function bladeGeometry() {
  // 3 segments + tip, slightly curved forward.
  const w = [0.05, 0.042, 0.028, 0];
  const ys = [0, 0.36, 0.7, 1];
  const pos = [], col = [], nor = [], idx = [];
  for (let k = 0; k < 4; k++) {
    const bend = ys[k] * ys[k] * 0.18;
    if (k < 3) { pos.push(-w[k], ys[k], bend, w[k], ys[k], bend); } else pos.push(0, ys[k], bend);
    const shade = 0.68 + ys[k] * 0.5;
    const n = k < 3 ? 2 : 1;
    for (let q = 0; q < n; q++) { col.push(shade, shade, shade); nor.push(0, 1, 0.25); }
  }
  // quads between rows: row k verts 2k, 2k+1
  for (let k = 0; k < 2; k++) { const a = k * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  idx.push(4, 5, 6);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

const bw = {};
function grassMask(x, z, h, ny) {
  if (ny < 0.8) return 0;
  const wl = waterLevel(x, z);
  if (h < wl + 0.35) return 0;
  const shore = smoothstep(wl + 0.35, wl + 1.8, h);
  const fw = frontierWeight(x, z);
  let core = 0, far = 0;
  if (fw < 1) {
    const w = regionWeights(x, z);
    core = w.meadow + w.forest * 0.75 + w.lake * 0.9 + w.coast * 0.45 + w.mountain * 0.7 * smoothstep(42, 30, h) + w.canyon * 0.06;
    const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
    core *= 0.08 + 0.92 * smoothstep(VILLAGE.r - 10, VILLAGE.r + 6, dv);
  }
  if (fw > 0) {
    const w = biomeWeights(x, z, bw);
    far = w.meadow + w.forest * 0.75 + w.crystal * 0.55 + w.canyon * 0.08 + w.snow * 0.7 * smoothstep(12, 5, h);
  }
  return (core + (far - core) * fw) * shore;
}

export class Grass {
  constructor(scene, colliders) {
    this.scene = scene;
    this.col = colliders;
    this.geo = bladeGeometry();
    this.uPlayer = { value: new THREE.Vector3(0, -999, 0) };
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uWindTime = WIND.uTime; sh.uniforms.uWindDir = WIND.uDir; sh.uniforms.uWindStr = WIND.uStrength;
      sh.uniforms.uPlayer = this.uPlayer;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWindTime; uniform vec2 uWindDir; uniform float uWindStr; uniform vec3 uPlayer;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          {
            vec3 base = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            float hh = position.y;
            float ph = dot(base.xz, vec2(0.21, 0.13)) + uWindTime * 2.1;
            float gust = 0.55 + 0.45 * sin(dot(base.xz, uWindDir) * 0.045 - uWindTime * 1.3);
            float sway = (sin(ph) * 0.5 + sin(ph * 2.7 + 1.3) * 0.2 + 0.35) * gust * uWindStr * 0.32 * hh * hh;
            // local-space push: convert world wind into the instance frame via the inverse of its rotation
            mat3 rot = mat3(instanceMatrix);
            vec3 wl = transpose(rot) * vec3(uWindDir.x, 0.0, uWindDir.y);
            transformed.xz += wl.xz * sway / max(length(rot[0]), 0.001) * 1.0;
            vec2 away = base.xz - uPlayer.xz;
            float dp = length(away);
            float push = smoothstep(1.5, 0.2, dp) * step(abs(base.y - uPlayer.y), 1.6);
            vec3 pl = transpose(rot) * vec3(normalize(away + 1e-4).x, 0.0, normalize(away + 1e-4).y);
            transformed.xz += pl.xz * push * hh * 0.75 / max(length(rot[0]), 0.001);
            transformed.y -= (push * 0.45 + abs(sway) * 0.2) * hh;
          }`);
      // Both faces of a blade share the same (upward) normal so back faces are not black.
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize(vNormal);');
    };
    this.mat = mat;
    this.tiles = new Map();
    this.pool = [];
    this.rings = 3;
    this.density = 5;
    this.enabled = true;
    this._color = new THREE.Color();
    this._n = { x: 0, y: 1, z: 0 };
  }

  setQuality(q) {
    this.rings = { low: 1, medium: 2, high: 3, ultra: 3 }[q] ?? 3;
    this.density = { low: 3, medium: 5, high: 7, ultra: 9 }[q] ?? 7;
    this.enabled = q !== 'low';
    for (const t of this.tiles.values()) this._release(t);
    this.tiles.clear();
  }

  _acquire(n) {
    let m = this.pool.find((p) => p.instanceMatrix.count >= n);
    if (m) this.pool.splice(this.pool.indexOf(m), 1);
    else {
      m = new THREE.InstancedMesh(this.geo, this.mat, Math.max(n, 512));
      m.receiveShadow = true;
      m.castShadow = false;
      m.frustumCulled = true;
      m.setColorAt(0, this._color.set(1, 1, 1));
    }
    this.scene.add(m);
    return m;
  }

  _release(t) {
    this.scene.remove(t.mesh);
    this.pool.push(t.mesh);
  }

  _buildTile(ti, tj, ring) {
    const x0 = ti * TILE, z0 = tj * TILE;
    const dens = this.density * (ring <= 1 ? 1 : ring === 2 ? 0.5 : 0.25);
    const n = Math.floor(TILE * TILE * dens);
    const mesh = this._acquire(n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const colCache = new Map();
    let k = 0;
    const seed = (ti * 92821) ^ (tj * 68917);
    for (let i = 0; i < n; i++) {
      const x = x0 + hash2(i, seed, 1) * TILE, z = z0 + hash2(i, seed, 2) * TILE;
      const h = groundHeight(x, z);
      groundNormal(x, z, this._n);
      const mask = grassMask(x, z, h, this._n.y);
      if (hash2(i, seed, 3) > mask) continue;
      let blocked = false;
      for (const c of this.col.query(x, z, 0)) {
        if (c.y0 > h + 0.6 || c.y1 < h) continue;
        if (c.type === 'cyl' ? Math.hypot(x - c.x, z - c.z) < c.r + 0.1 : (() => { const dx = x - c.x, dz = z - c.z; const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos; return Math.abs(lx) < c.hx + 0.1 && Math.abs(lz) < c.hz + 0.1; })()) { blocked = true; break; }
      }
      if (blocked) continue;
      const gi = Math.round(x / CELL), gj = Math.round(z / CELL), ck = gi * 100003 + gj;
      let base = colCache.get(ck);
      if (!base) { base = terrainColor(gi * CELL, gj * CELL, h, this._n.y, new THREE.Color()); colCache.set(ck, base); }
      const r = hash2(i, seed, 4), r2 = hash2(i, seed, 5);
      e.set((r2 - 0.5) * 0.3, r * Math.PI * 2, (hash2(i, seed, 6) - 0.5) * 0.3);
      q.setFromEuler(e);
      const hgt = 0.32 + r2 * 0.42 * (0.6 + mask * 0.4);
      m4.compose(v.set(x, h - 0.03, z), q, s.set(1 + r * 0.5, hgt, 1));
      mesh.setMatrixAt(k, m4);
      this._color.copy(base).offsetHSL((r - 0.5) * 0.03, 0.06, 0.04 + (r2 - 0.5) * 0.08);
      mesh.setColorAt(k, this._color);
      k++;
    }
    mesh.count = k;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(x0 + TILE / 2, groundHeight(x0 + TILE / 2, z0 + TILE / 2), z0 + TILE / 2), TILE * 0.75 + 6);
    return { mesh, ring };
  }

  update(p, budget = 3) {
    this.uPlayer.value.copy(p);
    if (!this.enabled) return;
    const pti = Math.floor(p.x / TILE), ptj = Math.floor(p.z / TILE);
    const R = this.rings;
    const want = new Map();
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      const ring = Math.max(Math.abs(di), Math.abs(dj));
      want.set((pti + di) * 65536 + (ptj + dj), { ti: pti + di, tj: ptj + dj, ring });
    }
    for (const [key, t] of this.tiles) {
      const w = want.get(key);
      if (!w || (w.ring <= 1) !== (t.ring <= 1) || (w.ring === 2) !== (t.ring === 2)) { this._release(t); this.tiles.delete(key); }
    }
    const todo = [...want.entries()].filter(([k]) => !this.tiles.has(k)).sort((a, b) => a[1].ring - b[1].ring);
    const t0 = performance.now();
    for (const [key, w] of todo) {
      if (performance.now() - t0 > budget && w.ring > 0) break;
      this.tiles.set(key, this._buildTile(w.ti, w.tj, w.ring));
    }
  }
}
