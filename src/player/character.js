// Stylised low-poly characters with procedural animation. Used for the player and NPCs.
import * as THREE from 'three';
import { part, build, prim, propMaterial } from '../world/props.js';

const { Cyl, Cone, Ico, Box, Sph } = prim;
const mat = (c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8 });

export function hatMesh(kind) {
  let g;
  switch (kind) {
    case 'straw': g = build([part(Cyl(0.62, 0.62, 0.06, 12), 0xe8c872, {}), part(Cyl(0.3, 0.36, 0.3, 10), 0xe8c872, { y: 0.17 }), part(Cyl(0.37, 0.37, 0.07, 10), 0xd0453a, { y: 0.06 })]); break;
    case 'flower': {
      const p = [part(new THREE.TorusGeometry(0.34, 0.06, 5, 12), 0x5c9a3e, { rx: Math.PI / 2 })];
      const cols = [0xf17aa6, 0xf7d74a, 0xffffff, 0x9ab8ff];
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; p.push(part(Ico(0.09), cols[i % 4], { x: Math.cos(a) * 0.34, y: 0.05, z: Math.sin(a) * 0.34 })); }
      g = build(p); break;
    }
    case 'pirate': g = build([part(Cyl(0.5, 0.5, 0.08, 3), 0x2b2b2b, { ry: Math.PI / 6, sx: 1.2 }), part(Cyl(0.28, 0.34, 0.38, 8), 0x2b2b2b, { y: 0.2 }), part(Ico(0.07), 0xffffff, { y: 0.22, z: 0.33 })]); break;
    case 'beanie': g = build([part(Sph(0.37, 10, 6), 0x3f78c9, { y: -0.02, sy: 0.8 }), part(Ico(0.12), 0xffffff, { y: 0.3 })]); break;
    case 'crown': {
      const p = [part(Cyl(0.32, 0.32, 0.22, 10), 0xf2c94c, { y: 0.1 })];
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; p.push(part(Cone(0.08, 0.22, 4), 0xf2c94c, { x: Math.cos(a) * 0.28, y: 0.3, z: Math.sin(a) * 0.28 })); }
      p.push(part(Ico(0.07), 0x7fd8ff, { y: 0.15, z: 0.32 }));
      g = build(p); break;
    }
    case 'chef': g = build([part(Cyl(0.32, 0.3, 0.3, 10), 0xffffff, { y: 0.12 }), part(Sph(0.38, 10, 6), 0xffffff, { y: 0.38, sy: 0.7 })]); break;
    case 'cap': g = build([part(Sph(0.36, 10, 6, ), 0xd0453a, { y: 0, sy: 0.6 }), part(Box(0.5, 0.05, 0.35), 0xd0453a, { y: -0.05, z: 0.35 })]); break;
    case 'wizard': g = build([part(Cyl(0.55, 0.55, 0.05, 12), 0x3a3a8a, {}), part(Cone(0.33, 1.0, 10), 0x3a3a8a, { y: 0.5, rz: 0.15 }), part(Ico(0.08), 0xf2c94c, { y: 0.55, x: 0.1, z: 0.3 })]); break;
    case 'helmet': g = build([part(Sph(0.38, 10, 6), 0xb9b2a4, { y: 0, sy: 0.75 }), part(Cyl(0.1, 0.1, 0.1, 6), 0xf2c94c, { y: 0.3 })]); break;
    default: return null;
  }
  const m = new THREE.Mesh(g, propMaterial);
  m.castShadow = true;
  return m;
}

export function createCharacter(opts = {}) {
  const c = {
    body: opts.body ?? 0x3f8fd8, skin: opts.skin ?? 0xffd7b0, scarf: opts.scarf ?? 0xe94e3c,
    legs: opts.legs ?? 0x2d3a5a, hair: opts.hair ?? 0x4a3020, pack: opts.pack ?? 0xb5874f,
  };
  const s = opts.scale ?? 1;
  const root = new THREE.Group();
  const rig = new THREE.Group();
  rig.scale.setScalar(s);
  root.add(rig);
  const meshes = [];
  const M = (geo, color, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    meshes.push(m);
    return m;
  };
  const hips = new THREE.Group(); hips.position.y = 0.72; rig.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  M(new THREE.CapsuleGeometry(0.33, 0.35, 4, 8), c.body, torso, 0, 0.28, 0);
  if (opts.skirt) M(new THREE.ConeGeometry(0.48, 0.55, 8), c.body, torso, 0, 0.05, 0);
  const head = new THREE.Group(); head.position.y = 0.92; torso.add(head);
  M(new THREE.SphereGeometry(0.36, 12, 8), c.skin, head, 0, 0.05, 0);
  if (opts.hairStyle !== 'bald') {
    const hairM = M(new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), c.hair, head, 0, 0.08, -0.02);
    hairM.rotation.x = -0.25;
  }
  if (opts.beard) M(new THREE.SphereGeometry(0.26, 8, 6), opts.beard, head, 0, -0.18, 0.16);
  M(new THREE.SphereGeometry(0.05, 6, 4), 0x222222, head, -0.13, 0.06, 0.32);
  M(new THREE.SphereGeometry(0.05, 6, 4), 0x222222, head, 0.13, 0.06, 0.32);
  M(new THREE.SphereGeometry(0.055, 6, 4), 0xff9a8a, head, -0.22, -0.04, 0.27);
  M(new THREE.SphereGeometry(0.055, 6, 4), 0xff9a8a, head, 0.22, -0.04, 0.27);
  if (opts.glasses) { M(new THREE.TorusGeometry(0.08, 0.015, 4, 10), 0x333333, head, -0.13, 0.06, 0.34); M(new THREE.TorusGeometry(0.08, 0.015, 4, 10), 0x333333, head, 0.13, 0.06, 0.34); }
  const hatSlot = new THREE.Group(); hatSlot.position.y = 0.36; head.add(hatSlot);
  // scarf
  const scarf = new THREE.Group(); scarf.position.y = 0.66; torso.add(scarf);
  M(new THREE.TorusGeometry(0.27, 0.09, 5, 10), c.scarf, scarf).rotation.x = Math.PI / 2;
  const tail = M(new THREE.BoxGeometry(0.16, 0.05, 0.5), c.scarf, scarf, 0.12, 0, -0.42);
  tail.geometry.translate(0, 0, 0.1);
  // backpack
  if (opts.pack !== false) M(new THREE.BoxGeometry(0.45, 0.5, 0.25), c.pack, torso, 0, 0.35, -0.33);
  // arms & legs
  const limb = (len, r, color, parent, x, y) => {
    const g = new THREE.Group(); g.position.set(x, y, 0); parent.add(g);
    const m = M(new THREE.CapsuleGeometry(r, len, 3, 6), color, g, 0, -len / 2 - r * 0.5, 0);
    return g;
  };
  const armL = limb(0.32, 0.1, c.body, torso, -0.4, 0.55);
  const armR = limb(0.32, 0.1, c.body, torso, 0.4, 0.55);
  M(new THREE.SphereGeometry(0.1, 6, 4), c.skin, armL, 0, -0.5, 0);
  M(new THREE.SphereGeometry(0.1, 6, 4), c.skin, armR, 0, -0.5, 0);
  const legL = limb(0.3, 0.12, c.legs, hips, -0.16, 0.0);
  const legR = limb(0.3, 0.12, c.legs, hips, 0.16, 0.0);
  M(new THREE.BoxGeometry(0.2, 0.12, 0.3), 0x5a3a22, legL, 0, -0.56, 0.05);
  M(new THREE.BoxGeometry(0.2, 0.12, 0.3), 0x5a3a22, legR, 0, -0.56, 0.05);

  // Glider (hidden until used)
  const glider = new THREE.Group();
  const gm = new THREE.Mesh(build([
    part(Cone(1.6, 0.5, 4), 0xf2c94c, { ry: Math.PI / 4, sx: 1.4, sz: 0.7, y: 0.25 }),
    part(Cyl(0.03, 0.03, 1.4, 4), 0x7a5536, { y: -0.45 }),
  ]), propMaterial);
  gm.castShadow = true;
  glider.add(gm);
  glider.position.y = 2.35;
  glider.visible = false;
  rig.add(glider);

  // Lantern
  const lantern = new THREE.Group();
  const lm = new THREE.Mesh(build([part(Box(0.18, 0.24, 0.18), 0xffe7a3, {}), part(Cone(0.14, 0.1, 4), 0x3b3b3b, { y: 0.17, ry: Math.PI / 4 })]),
    new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffc85a, emissiveIntensity: 1.5 }));
  lantern.add(lm);
  lantern.position.set(0, -0.55, 0.12);
  armL.add(lantern);
  lantern.visible = false;

  // Fishing rod
  const rod = new THREE.Group();
  const rm = new THREE.Mesh(build([part(Cyl(0.02, 0.035, 2.4, 4), 0x7a5536, { y: 1.1 })]), propMaterial);
  rod.add(rm);
  rod.position.set(0, -0.5, 0.05);
  rod.rotation.x = 1.1;
  armR.add(rod);
  rod.visible = false;

  let hat = null;
  const api = {
    root, rig, head, torso, hips, armL, armR, legL, legR, glider, lantern, rod, tail,
    phase: 0, blink: 0,
    setHat(kind) {
      if (hat) { hatSlot.remove(hat); hat = null; }
      if (kind) { hat = hatMesh(kind); if (hat) hatSlot.add(hat); }
    },
    // pose: { mode, speed, t, dt, vy }
    animate(p) {
      const { mode, speed = 0, dt, t } = p;
      this.phase += dt * (speed > 0.2 ? 3 + speed * 1.15 : 0);
      const ph = this.phase;
      const k = Math.min(1, dt * 14);
      const L = (obj, prop, v) => { obj.rotation[prop] += (v - obj.rotation[prop]) * k; };
      let hipsY = 0.72, lean = 0, aL = 0, aR = 0, lL = 0, lR = 0, aLz = 0.1, aRz = -0.1, headX = 0;
      glider.visible = mode === 'glide';
      switch (mode) {
        case 'walk': {
          const sw = Math.min(1, speed / 7) * 0.9;
          lL = Math.sin(ph) * sw; lR = -lL; aL = -lL * 0.8; aR = -lR * 0.8;
          hipsY = 0.72 + Math.abs(Math.cos(ph)) * 0.06 * sw;
          lean = Math.min(0.25, speed * 0.02);
          break;
        }
        case 'air': lL = -0.6; lR = 0.3; aL = -2.4; aR = -2.4; aLz = 0.6; aRz = -0.6; break;
        case 'glide': aL = -3.0; aR = -3.0; aLz = 0.15; aRz = -0.15; lL = 0.25; lR = 0.35; lean = 0.25; break;
        case 'climb': {
          const c = Math.sin(t * 7) * (speed > 0.1 ? 1 : 0);
          aL = -2.6 + c * 0.5; aR = -2.6 - c * 0.5; lL = -0.6 - c * 0.4; lR = -0.6 + c * 0.4; lean = -0.2; break;
        }
        case 'slide': aL = -1.2; aR = -1.2; aLz = 0.9; aRz = -0.9; lL = 0.4; lR = -0.2; lean = -0.3; break;
        case 'swim': {
          const c = Math.sin(t * 5);
          aL = -2.2 + c; aR = -2.2 - c; lL = 0.4 + c * 0.4; lR = 0.4 - c * 0.4; lean = 1.1; hipsY = 0.9; break;
        }
        case 'fish': aR = -0.9; aL = -0.5; break;
        case 'wave': aR = -2.6 + Math.sin(t * 8) * 0.3; aRz = -0.4; break;
        case 'sit': lL = -1.5; lR = -1.5; hipsY = 0.45; aL = -0.3; aR = -0.3; break;
        case 'cheer': aL = -2.9; aR = -2.9; aLz = 0.4 + Math.sin(t * 10) * 0.2; aRz = -0.4 - Math.sin(t * 10) * 0.2; hipsY = 0.72 + Math.abs(Math.sin(t * 6)) * 0.25; break;
        default: {
          const br = Math.sin(t * 2) * 0.03;
          hipsY = 0.72 + br * 0.3; aL = br; aR = -br; headX = Math.sin(t * 0.7) * 0.05;
        }
      }
      hips.position.y += (hipsY - hips.position.y) * k;
      L(torso, 'x', lean);
      L(armL, 'x', aL); L(armR, 'x', aR); L(armL, 'z', aLz); L(armR, 'z', aRz);
      L(legL, 'x', lL); L(legR, 'x', lR);
      L(head, 'x', headX);
      tail.rotation.x = 0.3 + Math.sin(t * 6) * 0.15 + Math.min(0.8, speed * 0.06);
      tail.rotation.y = Math.sin(t * 3.3) * 0.2;
    },
  };
  return api;
}

// ---------- Animals ----------
function animalGroup(parts) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(build(parts), propMaterial);
  m.castShadow = true;
  g.add(m);
  return g;
}

export function createAnimal(kind) {
  let g; const legs = [];
  const addLegs = (grp, pts, h, r, color) => {
    for (const [x, z] of pts) {
      const lg = new THREE.Group(); lg.position.set(x, h, z);
      const m = new THREE.Mesh(build([part(Cyl(r, r, h, 5), color, { y: -h / 2 })]), propMaterial);
      m.castShadow = true; lg.add(m); grp.add(lg); legs.push(lg);
    }
  };
  switch (kind) {
    case 'sheep': {
      const p = [];
      for (let i = 0; i < 7; i++) p.push(part(Ico(0.38), 0xf6f3ea, { x: (i % 3 - 1) * 0.3, y: 0.85 + (i % 2) * 0.12, z: (Math.floor(i / 3) - 1) * 0.35, jitter: 0.1, seed: i }));
      p.push(part(Box(0.32, 0.36, 0.42), 0x3a3330, { y: 0.95, z: 0.65 }), part(Box(0.12, 0.06, 0.2), 0x3a3330, { x: 0.22, y: 1.02, z: 0.6, rz: -0.4 }), part(Box(0.12, 0.06, 0.2), 0x3a3330, { x: -0.22, y: 1.02, z: 0.6, rz: 0.4 }));
      g = animalGroup(p); addLegs(g, [[-0.22, -0.3], [0.22, -0.3], [-0.22, 0.3], [0.22, 0.3]], 0.6, 0.07, 0x3a3330); break;
    }
    case 'fox': case 'spiritfox': {
      const body = kind === 'fox' ? 0xe8742c : 0x9fe6ff;
      g = animalGroup([
        part(Box(0.4, 0.38, 0.8), body, { y: 0.55 }), part(Box(0.36, 0.34, 0.36), body, { y: 0.78, z: 0.5 }),
        part(Cone(0.12, 0.3, 4), body, { x: -0.12, y: 1.05, z: 0.5 }), part(Cone(0.12, 0.3, 4), body, { x: 0.12, y: 1.05, z: 0.5 }),
        part(Cone(0.1, 0.25, 4), 0xffffff, { y: 0.72, z: 0.78, rx: Math.PI / 2 }),
        part(Cone(0.16, 0.8, 5), body, { y: 0.7, z: -0.75, rx: -1.9 }), part(Cone(0.1, 0.2, 5), 0xffffff, { y: 0.88, z: -1.1, rx: -1.9 }),
      ]);
      addLegs(g, [[-0.13, -0.28], [0.13, -0.28], [-0.13, 0.28], [0.13, 0.28]], 0.4, 0.05, kind === 'fox' ? 0x3a2a20 : 0xd9f6ff); break;
    }
    case 'deer': {
      g = animalGroup([
        part(Box(0.5, 0.5, 1.1), 0xa8703e, { y: 1.15 }), part(Box(0.28, 0.6, 0.28), 0xa8703e, { y: 1.55, z: 0.55, rx: 0.4 }),
        part(Box(0.3, 0.3, 0.45), 0xa8703e, { y: 1.85, z: 0.72 }), part(Cyl(0.03, 0.03, 0.5, 3), 0xe6d6b8, { x: -0.12, y: 2.2, z: 0.65, rz: 0.4 }), part(Cyl(0.03, 0.03, 0.5, 3), 0xe6d6b8, { x: 0.12, y: 2.2, z: 0.65, rz: -0.4 }),
        part(Ico(0.1), 0xffffff, { y: 1.3, z: -0.58 }),
      ]);
      addLegs(g, [[-0.18, -0.4], [0.18, -0.4], [-0.18, 0.4], [0.18, 0.4]], 0.9, 0.06, 0x7a5232); break;
    }
    case 'crab': {
      g = animalGroup([
        part(Sph(0.3, 8, 5), 0xe0453a, { y: 0.2, sy: 0.5 }), part(Ico(0.12), 0xe0453a, { x: -0.35, y: 0.25, z: 0.2 }), part(Ico(0.12), 0xe0453a, { x: 0.35, y: 0.25, z: 0.2 }),
        part(Cyl(0.02, 0.02, 0.15, 3), 0x222222, { x: -0.08, y: 0.38, z: 0.15 }), part(Cyl(0.02, 0.02, 0.15, 3), 0x222222, { x: 0.08, y: 0.38, z: 0.15 }),
      ]); break;
    }
    case 'seagull': {
      g = animalGroup([part(Sph(0.2, 8, 5), 0xffffff, { sz: 1.8 }), part(Cone(0.05, 0.15, 4), 0xf2b134, { z: 0.42, rx: Math.PI / 2 })]);
      const wingG = (side) => { const w = new THREE.Group(); const m = new THREE.Mesh(build([part(Box(0.7, 0.03, 0.3), 0xdde3ea, { x: side * 0.35 })]), propMaterial); w.add(m); g.add(w); legs.push(w); };
      wingG(-1); wingG(1); break;
    }
    case 'owl': {
      g = animalGroup([
        part(Sph(0.3, 8, 6), 0x8a6a4c, { y: 0.35, sy: 1.2 }), part(Ico(0.08), 0xfff2a8, { x: -0.1, y: 0.5, z: 0.25 }), part(Ico(0.08), 0xfff2a8, { x: 0.1, y: 0.5, z: 0.25 }),
        part(Cone(0.05, 0.12, 4), 0xf2b134, { y: 0.42, z: 0.29, rx: Math.PI / 2 }), part(Cone(0.07, 0.15, 4), 0x8a6a4c, { x: -0.15, y: 0.72 }), part(Cone(0.07, 0.15, 4), 0x8a6a4c, { x: 0.15, y: 0.72 }),
      ]); break;
    }
    case 'frog': {
      g = animalGroup([part(Sph(0.2, 8, 5), 0x5cb84a, { y: 0.15, sy: 0.7 }), part(Ico(0.07), 0xffffff, { x: -0.09, y: 0.28, z: 0.1 }), part(Ico(0.07), 0xffffff, { x: 0.09, y: 0.28, z: 0.1 })]); break;
    }
    case 'goat': {
      g = animalGroup([
        part(Box(0.45, 0.5, 0.9), 0xf2efe6, { y: 0.9 }), part(Box(0.3, 0.32, 0.4), 0xf2efe6, { y: 1.25, z: 0.55 }),
        part(Cone(0.06, 0.35, 4), 0x8a7f74, { x: -0.1, y: 1.5, z: 0.45, rx: -0.6 }), part(Cone(0.06, 0.35, 4), 0x8a7f74, { x: 0.1, y: 1.5, z: 0.45, rx: -0.6 }),
        part(Cone(0.06, 0.2, 4), 0xdcd6c8, { y: 1.0, z: 0.75, rx: Math.PI }),
      ]);
      addLegs(g, [[-0.15, -0.32], [0.15, -0.32], [-0.15, 0.32], [0.15, 0.32]], 0.65, 0.06, 0xdcd6c8); break;
    }
    case 'lizard': {
      g = animalGroup([part(Box(0.16, 0.08, 0.5), 0x4fb08a, { y: 0.05 }), part(Cone(0.06, 0.4, 4), 0x4fb08a, { y: 0.05, z: -0.42, rx: -Math.PI / 2 }), part(Box(0.12, 0.07, 0.15), 0x4fb08a, { y: 0.06, z: 0.3 })]); break;
    }
    case 'butterfly': {
      g = new THREE.Group();
      const col = [0xf7a1c4, 0xf7d74a, 0x9ab8ff][Math.floor(Math.random() * 3)];
      for (const side of [-1, 1]) {
        const w = new THREE.Group();
        const m = new THREE.Mesh(build([part(Box(0.22, 0.01, 0.18), col, { x: side * 0.11 })]), propMaterial);
        w.add(m); g.add(w); legs.push(w);
      }
      break;
    }
    case 'whale': {
      g = animalGroup([part(Sph(2.2, 10, 8), 0x3d5a80, { sz: 2.6, sy: 0.8 }), part(Box(3, 0.2, 1.2), 0x3d5a80, { z: -5.8, y: 0.3 }), part(Sph(1.6, 8, 6), 0xd7e3ef, { y: -0.9, sz: 2.2, sy: 0.4 })]); break;
    }
    case 'cat': {
      g = animalGroup([
        part(Box(0.3, 0.3, 0.6), 0xf2a65a, { y: 0.35 }), part(Box(0.32, 0.28, 0.3), 0xf2a65a, { y: 0.55, z: 0.35 }),
        part(Cone(0.08, 0.16, 4), 0xf2a65a, { x: -0.09, y: 0.75, z: 0.35 }), part(Cone(0.08, 0.16, 4), 0xf2a65a, { x: 0.09, y: 0.75, z: 0.35 }),
        part(Cyl(0.04, 0.04, 0.5, 4), 0xf2a65a, { y: 0.6, z: -0.4, rx: -0.6 }),
      ]);
      addLegs(g, [[-0.1, -0.2], [0.1, -0.2], [-0.1, 0.2], [0.1, 0.2]], 0.22, 0.04, 0xf2a65a); break;
    }
    default: g = animalGroup([part(Ico(0.3), 0xff00ff, {})]);
  }
  g.userData.legs = legs;
  return g;
}
