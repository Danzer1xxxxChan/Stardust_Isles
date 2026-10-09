// Seeded vegetation and rock scattering into grouped InstancedMeshes (grouped spatially so culling works).
import * as THREE from 'three';
import * as P from './props.js';
import { groundHeight, groundNormal, regionWeights, waterLevel, coastFactor, frontierWeight } from './terrain.js';
import { WORLD_HALF, DARK_FOREST } from './layout.js';
import { createNoise2D, hash2, smoothstep } from '../core/math.js';

const GROUP = 150;
const clump = createNoise2D(31337);
const clump2 = createNoise2D(5151);

let LIB = null;
export function library() { return LIB || (LIB = makeLibrary()); }

function makeLibrary() {
  return {
    oak: { sway: true, variants: [P.oak(1), P.oak(2), P.oak(3, 0x7db84f)], col: 0.45, shadow: true, codex: 'oak' },
    pine: { sway: true, variants: [P.pine(1), P.pine(2, 0x3a7546)], col: 0.35, shadow: true, codex: 'pine' },
    darkpine: { sway: true, variants: [P.pine(3, 0x2c5e45, false, 1.5), P.pine(4, 0x2a5540, false, 1.35)], col: 0.4, shadow: true, codex: 'darkpine' },
    snowpine: { sway: true, variants: [P.pine(5, 0x355f4a, true, 1.1), P.pine(6, 0x3a6650, true, 0.9)], col: 0.35, shadow: true, codex: 'snowpine' },
    palm: { sway: true, variants: [P.palm(1), P.palm(2)], col: 0.3, shadow: true, codex: 'palm' },
    cactus: { variants: [P.cactus(1), P.cactus(2), P.cactus(3)], col: 0.45, shadow: true, codex: 'cactus' },
    deadtree: { variants: [P.deadTree(1), P.deadTree(2)], col: 0.25, shadow: true },
    bush: { sway: true, variants: [P.bush(1), P.bush(2, 0x4f8f3e, true)], shadow: true },
    rock: { variants: [P.rock(1), P.rock(2), P.rock(3, 0x8a857e, 0.6)], col: 0.8, shadow: true },
    redrock: { variants: [P.rock(4, 0xb4613b), P.rock(5, 0xa65535, 0.7)], col: 0.8, shadow: true },
    grass: { sway: true, variants: [P.grassTuft(0x7fbf4f), P.grassTuft(0x5f9e45)], shadow: false },
    flowers: { sway: true, variants: [P.flowers(0xf7d74a), P.flowers(0xf17aa6), P.flowers(0x9ab8ff), P.flowers(0xffffff)], shadow: false, codex: 'flower' },
    sunflower: { sway: true, variants: [P.sunflower()], shadow: false, codex: 'sunflower' },
    mushroom: { variants: [P.mushroom(), P.mushroom(0xc77d2e)], shadow: false, codex: 'mushroom' },
    reeds: { sway: true, variants: [P.reeds()], shadow: false, codex: 'reeds' },
    crystal: { variants: [P.crystal(1), P.crystal(2, 0x8fd3ff)], col: 0.5, shadow: true, glow: 0x9a6bff, codex: 'crystal' },
    coral: { variants: [P.coral(1), P.coral(2)], shadow: false, codex: 'coral' },
  };
}

export function scatterWorld(scene, colliders, exclusions, codexRegistry) {
  const lib = library();
  const buckets = new Map();
  const nrm = { x: 0, y: 1, z: 0 };

  const excluded = (x, z, pad = 0) => {
    for (const e of exclusions) if (Math.hypot(x - e.x, z - e.z) < e.r + pad) return true;
    return false;
  };

  const put = (type, x, z, scale, seed, yOff = 0) => {
    const def = lib[type];
    const v = Math.floor(hash2(seed, 7) * def.variants.length);
    const gi = Math.floor((x + WORLD_HALF) / GROUP), gj = Math.floor((z + WORLD_HALF) / GROUP);
    const key = `${type}|${v}|${gi}|${gj}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { type, v, items: [] }));
    const y = groundHeight(x, z) + yOff;
    b.items.push({ x, y, z, s: scale, r: hash2(seed, 13) * Math.PI * 2, tint: (hash2(seed, 17) - 0.5) * 0.12 });
    if (def.col) colliders.addCylinder(x, z, def.col * scale, y - 0.5, y + 3 * scale);
    if (def.codex && codexRegistry && hash2(seed, 23) < 0.08) codexRegistry.push({ id: def.codex, x, y: y + 1.5 * scale, z });
  };

  const STEP = 3.2;
  let seed = 0;
  for (let z = -WORLD_HALF + 4; z < WORLD_HALF - 4; z += STEP) {
    for (let x = -WORLD_HALF + 4; x < WORLD_HALF - 4; x += STEP) {
      seed++;
      const jx = x + (hash2(seed, 1) - 0.5) * STEP * 0.9;
      const jz = z + (hash2(seed, 2) - 0.5) * STEP * 0.9;
      if (frontierWeight(jx, jz) >= 0.6) continue; // far-isle vegetation is streamed by frontier.js
      const h = groundHeight(jx, jz);
      const wl = waterLevel(jx, jz);
      const r = hash2(seed, 3);
      const r2 = hash2(seed, 4);
      if (h < wl - 0.3) {
        if (h > wl - 6 && h < wl - 1.2 && wl === 0 && r < 0.02) put('coral', jx, jz, 0.8 + r2 * 0.8, seed);
        continue;
      }
      groundNormal(jx, jz, nrm);
      const w = regionWeights(jx, jz);
      const shore = h < wl + 1.6;
      const steep = nrm.y < 0.8;
      if (excluded(jx, jz, 1.5)) continue;
      const c1 = clump(jx * 0.02, jz * 0.02);
      const c2 = clump2(jx * 0.05, jz * 0.05);

      if (shore) {
        if (wl > 0 && r < 0.12 && h < wl + 0.8) put('reeds', jx, jz, 0.9 + r2 * 0.5, seed);
        else if (w.coast + w.meadow > 0.5 && r < 0.02 && h > wl + 0.4 && coastFactor(jx, jz) > 0.2) put('palm', jx, jz, 0.9 + r2 * 0.4, seed);
        else if (r > 0.985) put('rock', jx, jz, 0.4 + r2 * 0.8, seed);
        continue;
      }
      if (steep) {
        if (r < 0.03) put(w.canyon > 0.4 ? 'redrock' : 'rock', jx, jz, 0.6 + r2 * 1.2, seed, -0.2);
        continue;
      }
      const snowy = h > 47;
      // Trees.
      const forestDens = w.forest * (0.16 + Math.max(0, c1) * 0.18);
      const meadowDens = w.meadow * Math.max(0, c1 - 0.25) * 0.12;
      const lakeDens = w.lake * (0.03 + Math.max(0, c2) * 0.06);
      const mtnDens = w.mountain * (0.02 + Math.max(0, c1) * 0.06);
      const coastDens = w.coast * 0.012;
      const canyonDens = w.canyon * 0.012;
      let roll = r;
      if (roll < forestDens) {
        const dark = Math.hypot(jx - DARK_FOREST.x, jz - DARK_FOREST.z) < DARK_FOREST.r + 10;
        put(dark || r2 < 0.55 ? 'darkpine' : 'oak', jx, jz, 0.9 + r2 * 0.6, seed); continue;
      }
      roll -= forestDens;
      if (roll < meadowDens) { put(r2 < 0.8 ? 'oak' : 'pine', jx, jz, 0.8 + r2 * 0.5, seed); continue; }
      roll -= meadowDens;
      if (roll < lakeDens) { put('pine', jx, jz, 0.8 + r2 * 0.5, seed); continue; }
      roll -= lakeDens;
      if (roll < mtnDens) { put(snowy ? 'snowpine' : 'pine', jx, jz, 0.8 + r2 * 0.5, seed); continue; }
      roll -= mtnDens;
      if (roll < coastDens) { put('palm', jx, jz, 0.9 + r2 * 0.4, seed); continue; }
      roll -= coastDens;
      if (roll < canyonDens) { put(r2 < 0.7 ? 'cactus' : 'deadtree', jx, jz, 0.8 + r2 * 0.5, seed); continue; }
      roll -= canyonDens;
      // Small stuff.
      if (roll < 0.012) { put(w.canyon > 0.5 ? 'redrock' : 'rock', jx, jz, 0.3 + r2 * 0.7, seed, -0.1); continue; }
      roll -= 0.012;
      if (roll < 0.03 * (w.meadow + w.forest + w.lake) && !snowy) { put('bush', jx, jz, 0.7 + r2 * 0.6, seed); continue; }
      roll -= 0.03;
      if (w.forest > 0.4 && roll < 0.025) { put('mushroom', jx, jz, 0.8 + r2 * 0.8, seed); continue; }
      if (w.lake > 0.5 && roll < 0.012) { put('crystal', jx, jz, 0.6 + r2 * 0.8, seed); continue; }
      if (w.meadow > 0.5 && c2 > 0.35 && roll < 0.25) { put(r2 < 0.15 ? 'sunflower' : 'flowers', jx, jz, 0.9 + r2 * 0.4, seed); continue; }
      if (!snowy && w.canyon < 0.5 && roll < 0.5 * (1 - w.canyon)) put('grass', jx, jz, 0.8 + r2 * 0.7, seed);
    }
  }

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const glowMats = {};
  const meshes = [];
  for (const b of buckets.values()) {
    const def = lib[b.type];
    let mat = def.sway ? P.vegMaterial : P.propMaterial;
    if (def.glow) mat = glowMats[b.type] || (glowMats[b.type] = P.glowMaterial(def.glow, 1.6));
    const im = new THREE.InstancedMesh(def.variants[b.v], mat, b.items.length);
    b.items.forEach((it, i) => {
      dummy.position.set(it.x, it.y, it.z);
      dummy.rotation.set(0, it.r, 0);
      dummy.scale.setScalar(it.s);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      color.setRGB(1 + it.tint, 1 + it.tint, 1 + it.tint);
      im.setColorAt(i, color);
    });
    im.castShadow = def.shadow;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    im.userData.kind = b.type;
    scene.add(im);
    meshes.push(im);
  }
  return { meshes, lib };
}
