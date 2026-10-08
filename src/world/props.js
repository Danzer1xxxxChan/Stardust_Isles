// Procedural low-poly asset library. Every asset is a single merged geometry with vertex colours.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash2, mulberry32 } from '../core/math.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

export function part(geo, color, t = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  geo !== g && geo.dispose();
  if (g.attributes.uv) g.deleteAttribute('uv');
  if (g.attributes.uv1) g.deleteAttribute('uv1');
  _e.set(t.rx || 0, t.ry || 0, t.rz || 0, 'YXZ');
  _q.setFromEuler(_e);
  const s = t.s ?? 1;
  _s.set(t.sx ?? s, t.sy ?? s, t.sz ?? s);
  _p.set(t.x || 0, t.y || 0, t.z || 0);
  _m.compose(_p, _q, _s);
  if (t.jitter) jitter(g, t.jitter, t.seed || 1);
  g.applyMatrix4(_m);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function jitter(g, amt, seed) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const kx = Math.round(x * 1000), ky = Math.round(y * 1000), kz = Math.round(z * 1000);
    p.setXYZ(i,
      x + (hash2(kx, ky + kz * 3, seed) - 0.5) * amt,
      y + (hash2(ky, kz + kx * 5, seed + 1) - 0.5) * amt,
      z + (hash2(kz, kx + ky * 7, seed + 2) - 0.5) * amt);
  }
}

export function build(parts) {
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  g.computeVertexNormals();
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

export const propMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0 });
export const glowMaterial = (color, intensity = 1.6) =>
  new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, emissive: color, emissiveIntensity: intensity, roughness: 0.6 });

const Cyl = (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg);
const Cone = (r, h, seg = 6) => new THREE.ConeGeometry(r, h, seg);
const Ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const Dode = (r) => new THREE.DodecahedronGeometry(r, 0);
const Box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const Sph = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h);
export const prim = { Cyl, Cone, Ico, Dode, Box, Sph };

// ---------- Vegetation ----------
export function oak(seed = 1, leaf = 0x6cae4a) {
  const r = mulberry32(seed);
  const parts = [part(Cyl(0.22, 0.36, 2.6, 6), 0x7a5536, { y: 1.3 })];
  const blobs = 3 + Math.floor(r() * 2);
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + r();
    const c = new THREE.Color(leaf).offsetHSL((r() - 0.5) * 0.03, 0, (r() - 0.5) * 0.08);
    parts.push(part(Ico(1.3 + r() * 0.5, 0), c, { x: Math.cos(a) * 0.9, y: 3.2 + r() * 0.8, z: Math.sin(a) * 0.9, jitter: 0.35, seed: seed + i }));
  }
  parts.push(part(Ico(1.5, 0), leaf, { y: 4.2, jitter: 0.3, seed: seed + 9 }));
  return build(parts);
}

export function pine(seed = 1, leaf = 0x3f7d4a, snow = false, tall = 1) {
  const r = mulberry32(seed);
  const parts = [part(Cyl(0.18, 0.3, 1.6 * tall, 5), 0x6b4a30, { y: 0.8 * tall })];
  const tiers = 3 + (tall > 1.2 ? 1 : 0);
  for (let i = 0; i < tiers; i++) {
    const rad = (1.9 - i * 0.4) * (0.9 + r() * 0.2);
    const y = (1.4 + i * 1.25) * tall;
    parts.push(part(Cone(rad, 2.2 * tall, 7), leaf, { y, ry: r() * 3 }));
    if (snow) parts.push(part(Cone(rad * 0.55, 0.9 * tall, 7), 0xf2f6fa, { y: y + 0.75 * tall, ry: r() * 3 }));
  }
  return build(parts);
}

export function palm(seed = 1) {
  const r = mulberry32(seed);
  const parts = [];
  let x = 0, y = 0, lean = 0.12 + r() * 0.12;
  for (let i = 0; i < 6; i++) {
    parts.push(part(Cyl(0.2 - i * 0.015, 0.24 - i * 0.015, 0.95, 6), i % 2 ? 0x9a7650 : 0x8a6744, { x, y: y + 0.45, rz: -lean * i * 0.4 }));
    x += Math.sin(lean * i * 0.4) * 0.95; y += 0.92;
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    parts.push(part(Box(0.5, 0.08, 2.8), i % 2 ? 0x4f9a3e : 0x5cab47, { x: x + Math.cos(a) * 1.2, y: y - 0.25, z: Math.sin(a) * 1.2, ry: -a + Math.PI / 2, rx: 0.45 }));
  }
  parts.push(part(Ico(0.22), 0x6b4a2a, { x: x + 0.2, y: y - 0.3 }));
  parts.push(part(Ico(0.22), 0x6b4a2a, { x: x - 0.15, y: y - 0.35, z: 0.2 }));
  return build(parts);
}

export function cactus(seed = 1) {
  const r = mulberry32(seed);
  const h = 2 + r() * 1.5;
  const parts = [part(Cyl(0.35, 0.4, h, 7), 0x5b9b56, { y: h / 2 }), part(Sph(0.35, 7, 4), 0x5b9b56, { y: h })];
  const arms = 1 + Math.floor(r() * 2);
  for (let i = 0; i < arms; i++) {
    const side = i ? -1 : 1, ay = 0.8 + r() * 0.8;
    parts.push(part(Cyl(0.22, 0.22, 0.7, 6), 0x5b9b56, { x: side * 0.55, y: ay, rz: Math.PI / 2 }));
    parts.push(part(Cyl(0.22, 0.22, 1.0, 6), 0x5b9b56, { x: side * 0.85, y: ay + 0.45 }));
    parts.push(part(Sph(0.22, 6, 4), 0x5b9b56, { x: side * 0.85, y: ay + 0.95 }));
  }
  parts.push(part(Ico(0.14), 0xf06c9b, { y: h + 0.32 }));
  return build(parts);
}

export function deadTree(seed = 1) {
  const r = mulberry32(seed);
  const parts = [part(Cyl(0.12, 0.25, 2.8, 5), 0x8a6a4c, { y: 1.4, rz: (r() - 0.5) * 0.2 })];
  for (let i = 0; i < 3; i++) {
    const a = r() * 6.28;
    parts.push(part(Cyl(0.05, 0.1, 1.3, 4), 0x8a6a4c, { x: Math.cos(a) * 0.4, y: 2 + i * 0.3, z: Math.sin(a) * 0.4, rx: Math.sin(a) * 0.8, rz: -Math.cos(a) * 0.8 }));
  }
  return build(parts);
}

export function bush(seed = 1, color = 0x5e9e45, berries = false) {
  const r = mulberry32(seed);
  const parts = [];
  for (let i = 0; i < 3; i++) parts.push(part(Ico(0.6 + r() * 0.3), new THREE.Color(color).offsetHSL(0, 0, (r() - 0.5) * 0.08), { x: (r() - 0.5) * 0.8, y: 0.45, z: (r() - 0.5) * 0.8, jitter: 0.2, seed: seed + i }));
  if (berries) for (let i = 0; i < 5; i++) parts.push(part(Ico(0.09), 0xd8344a, { x: (r() - 0.5) * 1.2, y: 0.6 + r() * 0.4, z: (r() - 0.5) * 1.2 }));
  return build(parts);
}

export function rock(seed = 1, color = 0x9a958e, flat = 1) {
  return build([part(Dode(1), color, { sy: 0.7 * flat, jitter: 0.45, seed })]);
}

export function grassTuft(color = 0x7fbf4f) {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    parts.push(part(Cone(0.07, 0.6, 3), new THREE.Color(color).offsetHSL(0, 0, (i % 2) * 0.05), { x: Math.cos(a) * 0.12, y: 0.28, z: Math.sin(a) * 0.12, rx: Math.sin(a) * 0.25, rz: -Math.cos(a) * 0.25 }));
  }
  return build(parts);
}

export function flowers(color = 0xf7d74a) {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.25, z = (i % 2) * 0.2;
    parts.push(part(Cyl(0.02, 0.02, 0.45, 3), 0x4e8a3a, { x, y: 0.22, z }));
    parts.push(part(Ico(0.11), color, { x, y: 0.48, z, sy: 0.6 }));
    parts.push(part(Ico(0.05), 0xffffff, { x, y: 0.52, z }));
  }
  return build(parts);
}

export function sunflower() {
  return build([
    part(Cyl(0.04, 0.05, 1.6, 4), 0x4e8a3a, { y: 0.8 }),
    part(Cyl(0.32, 0.32, 0.06, 10), 0xf5c518, { y: 1.65, rx: 1.2 }),
    part(Cyl(0.15, 0.15, 0.08, 8), 0x6b3f1d, { y: 1.67, z: 0.03, rx: 1.2 }),
    part(Box(0.4, 0.04, 0.15), 0x4e8a3a, { y: 0.8, x: 0.2, rz: 0.3 }),
  ]);
}

export function mushroom(cap = 0xd8433b) {
  return build([
    part(Cyl(0.08, 0.1, 0.35, 6), 0xf2e8d5, { y: 0.17 }),
    part(Sph(0.24, 7, 4), cap, { y: 0.36, sy: 0.6 }),
    part(Ico(0.04), 0xffffff, { y: 0.47, x: 0.08 }),
    part(Ico(0.04), 0xffffff, { y: 0.45, x: -0.1, z: 0.05 }),
  ]);
}

export function reeds() {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const x = (Math.sin(i * 2.4)) * 0.3, z = Math.cos(i * 1.7) * 0.3;
    parts.push(part(Cyl(0.025, 0.03, 1.4, 3), 0x7a9a4a, { x, y: 0.7, z, rz: (i - 2) * 0.06 }));
    if (i % 2 === 0) parts.push(part(Cyl(0.06, 0.06, 0.3, 5), 0x6b4a2a, { x, y: 1.35, z }));
  }
  return build(parts);
}

export function crystal(seed = 1, color = 0xb48cff) {
  const r = mulberry32(seed);
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const h = 0.8 + r() * 1.4;
    parts.push(part(Cone(0.28, h, 5), color, { x: (r() - 0.5) * 0.8, y: h / 2, z: (r() - 0.5) * 0.8, rx: (r() - 0.5) * 0.6, rz: (r() - 0.5) * 0.6 }));
  }
  return build(parts);
}

export function coral(seed = 1) {
  const r = mulberry32(seed);
  const cols = [0xff7f7f, 0xffa95e, 0xd36bd6];
  const parts = [];
  for (let i = 0; i < 4; i++) parts.push(part(Cyl(0.06, 0.12, 0.9, 5), cols[i % 3], { x: (r() - 0.5) * 0.6, y: 0.4, z: (r() - 0.5) * 0.6, rx: (r() - 0.5) * 0.7, rz: (r() - 0.5) * 0.7 }));
  return build(parts);
}

export function shell() {
  return build([
    part(Cone(0.32, 0.18, 8), 0xffc2c7, { y: 0.09 }),
    part(Cone(0.18, 0.12, 8), 0xffe4e1, { y: 0.2 }),
  ]);
}
