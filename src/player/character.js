// Stylised characters and animals with procedural animation. Used for the player, NPCs, wildlife and the sword.
import * as THREE from 'three';
import { part, build, prim, propMaterial, rimify } from '../world/props.js';

const { Cyl, Cone, Ico, Box, Sph } = prim;
const matCache = new Map();
const mat = (c, o = {}) => {
  const key = c + JSON.stringify(o);
  if (!matCache.has(key)) matCache.set(key, rimify(new THREE.MeshStandardMaterial({ color: c, roughness: o.rough ?? 0.72, metalness: o.metal ?? 0, emissive: o.emissive ?? 0, emissiveIntensity: o.ei ?? 1 }), 0xfff1dc, o.rim ?? 0.32, 2.6));
  return matCache.get(key);
};
const shade = (hex, l) => new THREE.Color(hex).offsetHSL(0, 0, l).getHex();

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
    case 'beanie': g = build([part(Sph(0.39, 16, 10), 0x3f78c9, { y: -0.02, sy: 0.8 }), part(Ico(0.12), 0xffffff, { y: 0.3 })]); break;
    case 'crown': {
      const p = [part(Cyl(0.32, 0.32, 0.22, 10), 0xf2c94c, { y: 0.1 })];
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; p.push(part(Cone(0.08, 0.22, 4), 0xf2c94c, { x: Math.cos(a) * 0.28, y: 0.3, z: Math.sin(a) * 0.28 })); }
      p.push(part(Ico(0.07), 0x7fd8ff, { y: 0.15, z: 0.32 }));
      g = build(p); break;
    }
    case 'chef': g = build([part(Cyl(0.34, 0.32, 0.3, 16), 0xffffff, { y: 0.12 }), part(Sph(0.4, 16, 10), 0xffffff, { y: 0.38, sy: 0.7 })]); break;
    case 'cap': g = build([part(Sph(0.39, 16, 10), 0xd0453a, { y: 0, sy: 0.6 }), part(Box(0.5, 0.05, 0.35), 0xd0453a, { y: -0.05, z: 0.35 })]); break;
    case 'wizard': g = build([part(Cyl(0.55, 0.55, 0.05, 12), 0x3a3a8a, {}), part(Cone(0.33, 1.0, 10), 0x3a3a8a, { y: 0.5, rz: 0.15 }), part(Ico(0.08), 0xf2c94c, { y: 0.55, x: 0.1, z: 0.3 })]); break;
    case 'helmet': g = build([part(Sph(0.4, 16, 10), 0xb9b2a4, { y: 0, sy: 0.75 }), part(Cyl(0.1, 0.1, 0.1, 6), 0xf2c94c, { y: 0.3 })]); break;
    default: return null;
  }
  const m = new THREE.Mesh(g, propMaterial);
  m.castShadow = true;
  return m;
}

// Star-steel short sword. Built pointing down -y from the grip (origin) so it extends the arm.
export function swordGeometry() {
  return build([
    part(Cyl(0.035, 0.04, 0.26, 10), 0x5a3a22, { y: 0.0 }),
    part(Sph(0.055, 12, 8), 0xf2c94c, { y: 0.15 }),
    part(Box(0.34, 0.05, 0.07), 0xf2c94c, { y: -0.15 }),
    part(Sph(0.04, 10, 8), 0x7fd8ff, { y: -0.15, z: 0.04 }),
    part(Box(0.085, 0.86, 0.022), 0xdfe9f5, { y: -0.6 }),
    part(Box(0.03, 0.84, 0.03), 0xb9c8da, { y: -0.6 }),
    part(Cone(0.06, 0.16, 4), 0xdfe9f5, { y: -1.11, rx: Math.PI, ry: Math.PI / 4, sz: 0.4 }),
  ]);
}

export const swordMaterial = (() => {
  const m = rimify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.55, emissive: 0x4fb8ff, emissiveIntensity: 0.0 }), 0xbfe8ff, 0.6, 2.2);
  return m;
})();

export function createCharacter(opts = {}) {
  const c = {
    body: opts.body ?? 0x3f8fd8, skin: opts.skin ?? 0xffd7b0, scarf: opts.scarf ?? 0xe94e3c,
    legs: opts.legs ?? 0x2d3a5a, hair: opts.hair ?? 0x4a3020, pack: opts.pack ?? 0xb5874f,
    boots: opts.boots ?? 0x5a3a22, eyes: opts.eyes ?? 0x3a2a1a,
  };
  const s = opts.scale ?? 1;
  const root = new THREE.Group();
  const rig = new THREE.Group();
  rig.scale.setScalar(s);
  root.add(rig);
  const M = (geo, color, parent, x = 0, y = 0, z = 0, o) => {
    const m = new THREE.Mesh(geo, mat(color, o));
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const S = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
  const hips = new THREE.Group(); hips.position.y = 0.72; rig.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  // Body: tunic with a flared hem, belt and buckle.
  M(new THREE.CapsuleGeometry(0.31, 0.36, 8, 20), c.body, torso, 0, 0.3, 0);
  M(new THREE.CylinderGeometry(0.33, 0.37, 0.2, 20, 1, true), shade(c.body, -0.06), torso, 0, 0.02, 0).material.side = THREE.DoubleSide;
  M(new THREE.TorusGeometry(0.315, 0.035, 8, 28), 0x4a3424, torso, 0, 0.14, 0).rotation.x = Math.PI / 2;
  M(new THREE.BoxGeometry(0.1, 0.08, 0.04), 0xf2c94c, torso, 0, 0.14, 0.33, { metal: 0.6, rough: 0.35 });
  if (opts.skirt) M(new THREE.ConeGeometry(0.5, 0.58, 20, 1, true), c.body, torso, 0, 0.04, 0).material.side = THREE.DoubleSide;
  // Head
  const head = new THREE.Group(); head.position.y = 0.94; torso.add(head);
  M(S(0.36, 28, 20), c.skin, head, 0, 0.05, 0);
  M(S(0.075, 12, 10), c.skin, head, -0.35, 0.03, 0).scale.set(0.6, 1, 1);
  M(S(0.075, 12, 10), c.skin, head, 0.35, 0.03, 0).scale.set(0.6, 1, 1);
  if (opts.hairStyle !== 'bald') {
    const hm = M(new THREE.SphereGeometry(0.385, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), c.hair, head, 0, 0.08, -0.02);
    hm.rotation.x = -0.28;
    // Bangs and side locks
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.32;
      const b = M(new THREE.ConeGeometry(0.09, 0.26, 10), c.hair, head, Math.sin(a) * 0.3, 0.26, Math.cos(a) * 0.3);
      b.rotation.set(Math.PI - 0.5, a, 0);
    }
    M(S(0.12, 12, 10), c.hair, head, -0.3, 0.02, -0.08).scale.set(0.7, 1.4, 1);
    M(S(0.12, 12, 10), c.hair, head, 0.3, 0.02, -0.08).scale.set(0.7, 1.4, 1);
    M(S(0.3, 16, 12), c.hair, head, 0, 0.0, -0.13).scale.set(1.1, 1.05, 0.9);
  }
  if (opts.beard) M(S(0.26, 16, 12), opts.beard, head, 0, -0.18, 0.16).scale.set(1, 0.9, 0.8);
  // Face: eyes with iris + catch-light, brows, nose, mouth, blush.
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eg = new THREE.Group(); eg.position.set(sx * 0.13, 0.06, 0.305); head.add(eg);
    M(S(0.072, 14, 10), 0xffffff, eg).scale.set(1, 1.15, 0.45);
    M(S(0.05, 12, 10), c.eyes, eg, 0, -0.005, 0.022).scale.set(1, 1.2, 0.5);
    M(S(0.018, 8, 6), 0xffffff, eg, sx * -0.015, 0.025, 0.045, { emissive: 0xffffff, ei: 0.6 });
    eyes.push(eg);
    const brow = M(new THREE.BoxGeometry(0.11, 0.022, 0.03), opts.hairStyle === 'bald' ? 0x6b5a4a : shade(c.hair, -0.05), head, sx * 0.13, 0.17, 0.32);
    brow.rotation.z = sx * -0.12;
  }
  M(S(0.03, 10, 8), shade(c.skin, -0.06), head, 0, -0.02, 0.36);
  const mouth = M(new THREE.TorusGeometry(0.04, 0.011, 6, 14, Math.PI), 0x9a3a3a, head, 0, -0.09, 0.335);
  mouth.rotation.z = Math.PI;
  M(S(0.055, 10, 8), 0xff9a8a, head, -0.22, -0.04, 0.27, { rim: 0 }).scale.set(1, 0.6, 0.4);
  M(S(0.055, 10, 8), 0xff9a8a, head, 0.22, -0.04, 0.27, { rim: 0 }).scale.set(1, 0.6, 0.4);
  if (opts.glasses) {
    M(new THREE.TorusGeometry(0.085, 0.014, 8, 20), 0x333333, head, -0.13, 0.06, 0.345, { metal: 0.6 });
    M(new THREE.TorusGeometry(0.085, 0.014, 8, 20), 0x333333, head, 0.13, 0.06, 0.345, { metal: 0.6 });
    M(new THREE.BoxGeometry(0.08, 0.015, 0.015), 0x333333, head, 0, 0.07, 0.35);
  }
  const hatSlot = new THREE.Group(); hatSlot.position.y = 0.36; head.add(hatSlot);
  // Scarf
  const scarf = new THREE.Group(); scarf.position.y = 0.68; torso.add(scarf);
  M(new THREE.TorusGeometry(0.27, 0.095, 10, 24), c.scarf, scarf).rotation.x = Math.PI / 2;
  const tail = M(new THREE.BoxGeometry(0.17, 0.05, 0.52, 1, 1, 4), c.scarf, scarf, 0.12, 0, -0.42);
  tail.geometry.translate(0, 0, 0.1);
  M(new THREE.BoxGeometry(0.19, 0.06, 0.06), shade(c.scarf, -0.1), tail, 0, 0, -0.17);
  // Backpack with bedroll and straps
  if (opts.pack !== false) {
    M(new THREE.BoxGeometry(0.46, 0.5, 0.25, 2, 2, 2), c.pack, torso, 0, 0.36, -0.34);
    M(new THREE.BoxGeometry(0.48, 0.16, 0.27), shade(c.pack, -0.08), torso, 0, 0.55, -0.34);
    M(new THREE.CylinderGeometry(0.1, 0.1, 0.56, 14), 0xc9b48a, torso, 0, 0.68, -0.36).rotation.z = Math.PI / 2;
    for (const sx of [-1, 1]) M(new THREE.BoxGeometry(0.06, 0.62, 0.04), 0x4a3424, torso, sx * 0.17, 0.38, 0.29).rotation.x = -0.12;
  }
  // Sheathed sword across the back (player only)
  let sheathed = null;
  if (opts.sword) {
    sheathed = new THREE.Group();
    const sm = new THREE.Mesh(swordGeometry(), swordMaterial);
    sm.castShadow = true;
    sheathed.add(sm);
    sheathed.position.set(0.18, 0.95, -0.5);
    sheathed.rotation.set(0.15, 0, 2.5);
    torso.add(sheathed);
  }
  // Arms & legs
  const limb = (len, r, color, parent, x, y) => {
    const g = new THREE.Group(); g.position.set(x, y, 0); parent.add(g);
    M(new THREE.CapsuleGeometry(r, len, 6, 12), color, g, 0, -len / 2 - r * 0.5, 0);
    return g;
  };
  const armL = limb(0.32, 0.1, c.body, torso, -0.4, 0.56);
  const armR = limb(0.32, 0.1, c.body, torso, 0.4, 0.56);
  const glove = opts.gloves ?? c.skin;
  for (const a of [armL, armR]) {
    M(new THREE.TorusGeometry(0.1, 0.03, 8, 16), shade(c.body, -0.08), a, 0, -0.4, 0).rotation.x = Math.PI / 2;
    M(S(0.105, 14, 10), glove, a, 0, -0.52, 0);
  }
  const legL = limb(0.3, 0.12, c.legs, hips, -0.16, 0.0);
  const legR = limb(0.3, 0.12, c.legs, hips, 0.16, 0.0);
  for (const l of [legL, legR]) {
    M(new THREE.CapsuleGeometry(0.115, 0.12, 6, 12), c.boots, l, 0, -0.5, 0.03).scale.set(1.05, 0.8, 1.25);
    M(new THREE.CylinderGeometry(0.135, 0.135, 0.045, 14), 0x2a1d14, l, 0, -0.6, 0.06).scale.set(1, 1, 1.45);
  }
  // Sword in hand (shown while fighting)
  const sword = new THREE.Group();
  const swm = new THREE.Mesh(swordGeometry(), swordMaterial);
  swm.castShadow = true;
  sword.add(swm);
  sword.position.set(0, -0.53, 0.02);
  sword.visible = false;
  armR.add(sword);
  const swordTip = new THREE.Object3D(); swordTip.position.set(0, -1.18, 0); sword.add(swordTip);
  const swordBase = new THREE.Object3D(); swordBase.position.set(0, -0.2, 0); sword.add(swordBase);

  // Glider (hidden until used)
  const glider = new THREE.Group();
  const gm = new THREE.Mesh(build([
    part(Cone(1.6, 0.5, 4), 0xf2c94c, { ry: Math.PI / 4, sx: 1.4, sz: 0.7, y: 0.25 }),
    part(Cone(1.45, 0.42, 4), 0xd0453a, { ry: Math.PI / 4, sx: 1.4, sz: 0.7, y: 0.22, s: 0.55 }),
    part(Cyl(0.03, 0.03, 1.4, 6), 0x7a5536, { y: -0.45 }),
  ]), propMaterial);
  gm.castShadow = true;
  glider.add(gm);
  glider.position.y = 2.35;
  glider.visible = false;
  rig.add(glider);

  // Lantern
  const lantern = new THREE.Group();
  const lm = new THREE.Mesh(build([part(Box(0.18, 0.24, 0.18), 0xffe7a3, {}), part(Cone(0.14, 0.1, 4), 0x3b3b3b, { y: 0.17, ry: Math.PI / 4 })]),
    new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffc85a, emissiveIntensity: 2.5 }));
  lantern.add(lm);
  lantern.position.set(0, -0.55, 0.12);
  armL.add(lantern);
  lantern.visible = false;

  // Fishing rod
  const rod = new THREE.Group();
  const rm = new THREE.Mesh(build([part(Cyl(0.02, 0.035, 2.4, 6), 0x7a5536, { y: 1.1 })]), propMaterial);
  rod.add(rm);
  rod.position.set(0, -0.5, 0.05);
  rod.rotation.x = 1.1;
  armR.add(rod);
  rod.visible = false;

  let hat = null;
  const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
  const api = {
    root, rig, head, torso, hips, armL, armR, legL, legR, glider, lantern, rod, tail, sword, sheathed, swordTip, swordBase,
    phase: 0, blink: 2,
    setHat(kind) {
      if (hat) { hatSlot.remove(hat); hat = null; }
      if (kind) { hat = hatMesh(kind); if (hat) hatSlot.add(hat); }
    },
    setArmed(on) { sword.visible = on; if (sheathed) sheathed.visible = !on; },
    // pose: { mode, speed, t, dt, atk: { kind, k } }
    animate(p) {
      const { mode, speed = 0, dt, t } = p;
      this.phase += dt * (speed > 0.2 ? 3 + speed * 1.15 : 0);
      const ph = this.phase;
      const k = Math.min(1, dt * 14);
      const L = (obj, prop, v) => { obj.rotation[prop] += (v - obj.rotation[prop]) * k; };
      let hipsY = 0.72, lean = 0, aL = 0, aR = 0, lL = 0, lR = 0, aLz = 0.1, aRz = -0.1, headX = 0, twist = 0, spin = 0;
      glider.visible = mode === 'glide';
      switch (mode) {
        case 'walk': {
          const sw = Math.min(1, speed / 7) * 0.9;
          lL = Math.sin(ph) * sw; lR = -lL; aL = -lL * 0.8; aR = -lR * 0.8;
          hipsY = 0.72 + Math.abs(Math.cos(ph)) * 0.06 * sw;
          lean = Math.min(0.25, speed * 0.02);
          twist = Math.sin(ph) * 0.12 * sw;
          break;
        }
        case 'air': lL = -0.6; lR = 0.3; aL = -2.4; aR = -2.4; aLz = 0.6; aRz = -0.6; break;
        case 'glide': aL = -3.0; aR = -3.0; aLz = 0.15; aRz = -0.15; lL = 0.25; lR = 0.35; lean = 0.25; break;
        case 'climb': {
          const cc = Math.sin(t * 7) * (speed > 0.1 ? 1 : 0);
          aL = -2.6 + cc * 0.5; aR = -2.6 - cc * 0.5; lL = -0.6 - cc * 0.4; lR = -0.6 + cc * 0.4; lean = -0.2; break;
        }
        case 'slide': aL = -1.2; aR = -1.2; aLz = 0.9; aRz = -0.9; lL = 0.4; lR = -0.2; lean = -0.3; break;
        case 'swim': {
          const cc = Math.sin(t * 5);
          aL = -2.2 + cc; aR = -2.2 - cc; lL = 0.4 + cc * 0.4; lR = 0.4 - cc * 0.4; lean = 1.1; hipsY = 0.9; break;
        }
        case 'fish': aR = -0.9; aL = -0.5; break;
        case 'wave': aR = -2.6 + Math.sin(t * 8) * 0.3; aRz = -0.4; break;
        case 'sit': lL = -1.5; lR = -1.5; hipsY = 0.45; aL = -0.3; aR = -0.3; break;
        case 'cheer': aL = -2.9; aR = -2.9; aLz = 0.4 + Math.sin(t * 10) * 0.2; aRz = -0.4 - Math.sin(t * 10) * 0.2; hipsY = 0.72 + Math.abs(Math.sin(t * 6)) * 0.25; break;
        case 'hurt': lean = -0.35; aL = -0.6; aR = -0.6; aLz = 0.7; aRz = -0.7; headX = -0.3; break;
        case 'down': lean = -1.4; hipsY = 0.35; aL = -2.5; aR = -2.5; lL = -0.3; lR = -0.2; break;
        default: {
          const br = Math.sin(t * 2) * 0.03;
          hipsY = 0.72 + br * 0.3; aL = br; aR = -br; headX = Math.sin(t * 0.7) * 0.05;
        }
      }
      hips.position.y += (hipsY - hips.position.y) * k;
      L(torso, 'x', lean);
      L(torso, 'y', twist);
      L(armL, 'x', aL); L(armR, 'x', aR); L(armL, 'z', aLz); L(armR, 'z', aRz);
      L(legL, 'x', lL); L(legR, 'x', lR);
      L(head, 'x', headX);
      // Attack / roll overlays are applied directly (no smoothing) so swings stay snappy.
      const atk = p.atk;
      if (atk) {
        const e = ease(atk.k);
        switch (atk.kind) {
          case 'atk1': armR.rotation.set(-1.45, 0, 1.75 - e * 3.1); torso.rotation.y = 0.55 - e * 1.1; armL.rotation.set(-0.6, 0, 0.5); lean = 0.15; break;
          case 'atk2': armR.rotation.set(-1.65 + e * 0.5, 0, -1.4 + e * 3.0); torso.rotation.y = -0.5 + e * 1.0; armL.rotation.set(-0.4, 0, 0.7); break;
          case 'atk3': armR.rotation.set(-1.5, 0, 1.5); armL.rotation.set(-1.5, 0, -1.5); spin = e * Math.PI * 2; legL.rotation.x = 0.4; legR.rotation.x = -0.4; break;
          case 'plunge': armR.rotation.set(-2.9 + e * 2.3, 0, 0.1); armL.rotation.set(-2.6 + e * 2.0, 0, -0.2); legL.rotation.x = -0.9; legR.rotation.x = -0.4; break;
          case 'roll': spin = 0; torso.rotation.x = 0; hips.position.y = 0.45; rig.rotation.x = e * Math.PI * 2; armL.rotation.set(-1.2, 0, 0.3); armR.rotation.set(-1.2, 0, -0.3); legL.rotation.x = -1.4; legR.rotation.x = -1.4; break;
          default: break;
        }
        if (atk.kind !== 'roll') rig.rotation.x = 0;
        rig.rotation.y = spin;
        torso.rotation.x = lean;
        // Roll pivots around the hips rather than the feet.
        const th = rig.rotation.x, py = 0.7 * s;
        rig.position.set(0, py - py * Math.cos(th), -py * Math.sin(th));
      } else {
        const wrap = (a) => a - Math.round(a / (Math.PI * 2)) * Math.PI * 2;
        rig.rotation.x = wrap(rig.rotation.x); rig.rotation.y = wrap(rig.rotation.y);
        rig.rotation.x += (0 - rig.rotation.x) * k; rig.rotation.y += (0 - rig.rotation.y) * k;
        rig.position.multiplyScalar(1 - k);
      }
      tail.rotation.x = 0.3 + Math.sin(t * 6) * 0.15 + Math.min(0.8, speed * 0.06);
      tail.rotation.y = Math.sin(t * 3.3) * 0.2;
      // Blink
      this.blink -= dt;
      const closed = this.blink < 0.12;
      for (const e of eyes) e.scale.y = closed ? 0.12 : 1;
      if (this.blink < 0) this.blink = 2 + Math.random() * 3;
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

// Glossy black eye with a catch-light.
const eye = (x, y, z, r = 0.05, dir = 1) => [
  part(Sph(r, 12, 8), 0x161616, { x, y, z }),
  part(Sph(r * 0.35, 8, 6), 0xffffff, { x: x + r * 0.25 * dir, y: y + r * 0.35, z: z + r * 0.6 }),
];

export function createAnimal(kind) {
  let g; const legs = [];
  const addLegs = (grp, pts, h, r, color, hoof) => {
    for (const [x, z] of pts) {
      const lg = new THREE.Group(); lg.position.set(x, h, z);
      const ps = [part(Cyl(r * 0.8, r * 1.15, h, 10), color, { y: -h / 2 })];
      if (hoof) ps.push(part(Cyl(r * 0.95, r * 1.05, h * 0.12, 10), hoof, { y: -h + h * 0.06 }));
      const m = new THREE.Mesh(build(ps), propMaterial);
      m.castShadow = true; lg.add(m); grp.add(lg); legs.push(lg);
    }
  };
  switch (kind) {
    case 'sheep': {
      const p = [];
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4, rr = 0.22 + (i % 3) * 0.05;
        p.push(part(Ico(0.3 + (i % 2) * 0.06, 1), 0xf6f3ea, { x: Math.cos(a) * rr, y: 0.86 + Math.sin(i * 1.7) * 0.12, z: (i / 13 - 0.5) * 0.85, round: true, jitter: 0.05, seed: i }));
      }
      p.push(part(Sph(0.2, 14, 10), 0x3a3330, { y: 0.98, z: 0.62, sz: 1.3 }));
      p.push(part(Ico(0.17, 1), 0xf6f3ea, { y: 1.13, z: 0.56, round: true }));
      p.push(part(Sph(0.08, 10, 8), 0x3a3330, { x: 0.2, y: 1.0, z: 0.56, sx: 1.6, sz: 0.6, ry: -0.3 }), part(Sph(0.08, 10, 8), 0x3a3330, { x: -0.2, y: 1.0, z: 0.56, sx: 1.6, sz: 0.6, ry: 0.3 }));
      p.push(...eye(0.1, 1.03, 0.82, 0.035), ...eye(-0.1, 1.03, 0.82, 0.035, -1));
      p.push(part(Sph(0.05, 8, 6), 0xd9a0a0, { y: 0.92, z: 0.87 }));
      g = animalGroup(p); addLegs(g, [[-0.2, -0.28], [0.2, -0.28], [-0.2, 0.28], [0.2, 0.28]], 0.6, 0.065, 0x3a3330, 0x221c1a); break;
    }
    case 'fox': case 'spiritfox': {
      const body = kind === 'fox' ? 0xe8742c : 0x9fe6ff;
      const dark = kind === 'fox' ? 0x3a2a20 : 0xd9f6ff;
      g = animalGroup([
        part(Sph(0.24, 16, 12), body, { y: 0.58, sz: 1.9 }),
        part(Sph(0.17, 14, 10), 0xffffff, { y: 0.52, z: 0.25, sz: 1.2 }),
        part(Sph(0.2, 16, 12), body, { y: 0.8, z: 0.5, sx: 1.05 }),
        part(Cone(0.09, 0.26, 12), 0xffffff, { y: 0.75, z: 0.72, rx: Math.PI / 2 }),
        part(Sph(0.035, 8, 6), 0x161616, { y: 0.75, z: 0.86 }),
        ...eye(-0.09, 0.86, 0.66, 0.035, -1), ...eye(0.09, 0.86, 0.66, 0.035),
        part(Cone(0.08, 0.22, 10), body, { x: -0.11, y: 1.04, z: 0.47, rz: 0.15 }), part(Cone(0.08, 0.22, 10), body, { x: 0.11, y: 1.04, z: 0.47, rz: -0.15 }),
        part(Cone(0.05, 0.14, 8), dark, { x: -0.11, y: 1.1, z: 0.48, rz: 0.15 }), part(Cone(0.05, 0.14, 8), dark, { x: 0.11, y: 1.1, z: 0.48, rz: -0.15 }),
        part(Sph(0.17, 14, 10), body, { y: 0.66, z: -0.68, sz: 2.4, rx: -0.5 }), part(Sph(0.1, 12, 8), 0xffffff, { y: 0.86, z: -1.08, sz: 1.6, rx: -0.5 }),
      ]);
      addLegs(g, [[-0.12, -0.26], [0.12, -0.26], [-0.12, 0.26], [0.12, 0.26]], 0.42, 0.045, dark); break;
    }
    case 'deer': {
      const coat = 0xa8703e;
      const p = [
        part(Sph(0.3, 18, 12), coat, { y: 1.2, sz: 1.9 }),
        part(Sph(0.2, 14, 10), 0xe9d6b8, { y: 1.08, z: 0.1, sz: 1.8, sx: 1.2 }),
        part(Cyl(0.11, 0.16, 0.62, 12), coat, { y: 1.55, z: 0.55, rx: 0.45 }),
        part(Sph(0.15, 14, 10), coat, { y: 1.86, z: 0.72, sz: 1.5 }),
        part(Sph(0.06, 8, 6), 0x161616, { y: 1.82, z: 0.94 }),
        ...eye(-0.1, 1.9, 0.8, 0.032, -1), ...eye(0.1, 1.9, 0.8, 0.032),
        part(Sph(0.06, 10, 8), coat, { x: -0.15, y: 1.98, z: 0.66, sx: 0.5, sy: 1.6, rz: 0.9 }), part(Sph(0.06, 10, 8), coat, { x: 0.15, y: 1.98, z: 0.66, sx: 0.5, sy: 1.6, rz: -0.9 }),
        part(Sph(0.08, 10, 8), 0xffffff, { y: 1.32, z: -0.58 }),
      ];
      for (const sx of [-1, 1]) {
        p.push(part(Cyl(0.022, 0.03, 0.42, 6), 0xe6d6b8, { x: sx * 0.09, y: 2.15, z: 0.66, rz: -sx * 0.35 }));
        p.push(part(Cyl(0.018, 0.022, 0.22, 6), 0xe6d6b8, { x: sx * 0.2, y: 2.32, z: 0.72, rz: -sx * 0.9, rx: 0.3 }));
        p.push(part(Cyl(0.016, 0.02, 0.2, 6), 0xe6d6b8, { x: sx * 0.15, y: 2.38, z: 0.6, rz: -sx * 0.2, rx: -0.5 }));
      }
      g = animalGroup(p);
      addLegs(g, [[-0.16, -0.38], [0.16, -0.38], [-0.16, 0.38], [0.16, 0.38]], 0.95, 0.05, 0x7a5232, 0x2a1d14); break;
    }
    case 'crab': {
      g = animalGroup([
        part(Sph(0.3, 16, 10), 0xe0453a, { y: 0.2, sy: 0.5, sx: 1.2 }),
        part(Sph(0.11, 12, 8), 0xe0453a, { x: -0.4, y: 0.25, z: 0.22, sx: 1.4 }), part(Sph(0.11, 12, 8), 0xe0453a, { x: 0.4, y: 0.25, z: 0.22, sx: 1.4 }),
        part(Cone(0.06, 0.14, 8), 0xf06a5a, { x: -0.52, y: 0.27, z: 0.3, rx: Math.PI / 2, rz: 0.4 }), part(Cone(0.06, 0.14, 8), 0xf06a5a, { x: 0.52, y: 0.27, z: 0.3, rx: Math.PI / 2, rz: -0.4 }),
        part(Cyl(0.015, 0.015, 0.15, 6), 0x222222, { x: -0.08, y: 0.36, z: 0.18 }), part(Cyl(0.015, 0.015, 0.15, 6), 0x222222, { x: 0.08, y: 0.36, z: 0.18 }),
        part(Sph(0.035, 8, 6), 0x161616, { x: -0.08, y: 0.45, z: 0.18 }), part(Sph(0.035, 8, 6), 0x161616, { x: 0.08, y: 0.45, z: 0.18 }),
        ...[-1, 1].flatMap((sx) => [0, 1, 2].map((i) => part(Cyl(0.02, 0.02, 0.3, 5), 0xc23a30, { x: sx * 0.33, y: 0.12, z: -0.12 + i * 0.12, rz: sx * 1.0 }))),
      ]); break;
    }
    case 'seagull': {
      g = animalGroup([
        part(Sph(0.2, 14, 10), 0xffffff, { sz: 1.8 }), part(Sph(0.11, 12, 8), 0xffffff, { y: 0.08, z: 0.34 }),
        part(Cone(0.04, 0.16, 8), 0xf2b134, { y: 0.06, z: 0.5, rx: Math.PI / 2 }),
        part(Sph(0.025, 6, 4), 0x161616, { x: -0.07, y: 0.12, z: 0.4 }), part(Sph(0.025, 6, 4), 0x161616, { x: 0.07, y: 0.12, z: 0.4 }),
        part(Box(0.16, 0.03, 0.2), 0x9aa4ae, { z: -0.38 }),
      ]);
      const wingG = (side) => { const w = new THREE.Group(); const m = new THREE.Mesh(build([part(Box(0.7, 0.03, 0.3), 0xdde3ea, { x: side * 0.35 }), part(Box(0.25, 0.035, 0.28), 0x5a6068, { x: side * 0.6 })]), propMaterial); w.add(m); g.add(w); legs.push(w); };
      wingG(-1); wingG(1); break;
    }
    case 'owl': {
      g = animalGroup([
        part(Sph(0.3, 16, 12), 0x8a6a4c, { y: 0.35, sy: 1.2 }), part(Sph(0.22, 14, 10), 0xd9c4a0, { y: 0.3, z: 0.12, sy: 1.1 }),
        part(Sph(0.1, 12, 8), 0xf0e6d0, { x: -0.1, y: 0.5, z: 0.22 }), part(Sph(0.1, 12, 8), 0xf0e6d0, { x: 0.1, y: 0.5, z: 0.22 }),
        ...eye(-0.1, 0.5, 0.3, 0.05, -1), ...eye(0.1, 0.5, 0.3, 0.05),
        part(Cone(0.04, 0.1, 8), 0xf2b134, { y: 0.42, z: 0.31, rx: Math.PI / 2 + 0.4 }),
        part(Cone(0.06, 0.15, 8), 0x8a6a4c, { x: -0.15, y: 0.72 }), part(Cone(0.06, 0.15, 8), 0x8a6a4c, { x: 0.15, y: 0.72 }),
      ]); break;
    }
    case 'frog': {
      g = animalGroup([
        part(Sph(0.2, 14, 10), 0x5cb84a, { y: 0.15, sy: 0.7 }), part(Sph(0.14, 12, 8), 0xd8e8a0, { y: 0.1, z: 0.06, sy: 0.5 }),
        part(Sph(0.07, 10, 8), 0x5cb84a, { x: -0.09, y: 0.27, z: 0.1 }), part(Sph(0.07, 10, 8), 0x5cb84a, { x: 0.09, y: 0.27, z: 0.1 }),
        ...eye(-0.1, 0.29, 0.14, 0.04, -1), ...eye(0.1, 0.29, 0.14, 0.04),
        part(Sph(0.07, 10, 8), 0x4ea03e, { x: -0.18, y: 0.07, z: -0.05, sz: 1.6 }), part(Sph(0.07, 10, 8), 0x4ea03e, { x: 0.18, y: 0.07, z: -0.05, sz: 1.6 }),
      ]); break;
    }
    case 'goat': {
      const coat = 0xf2efe6;
      g = animalGroup([
        part(Sph(0.28, 16, 12), coat, { y: 0.92, sz: 1.75 }),
        part(Sph(0.17, 14, 10), coat, { y: 1.25, z: 0.55, sz: 1.35 }),
        part(Cone(0.045, 0.36, 8), 0x8a7f74, { x: -0.09, y: 1.46, z: 0.42, rx: -0.75 }), part(Cone(0.045, 0.36, 8), 0x8a7f74, { x: 0.09, y: 1.46, z: 0.42, rx: -0.75 }),
        part(Sph(0.07, 10, 8), coat, { x: -0.18, y: 1.28, z: 0.5, sx: 1.6, sz: 0.6 }), part(Sph(0.07, 10, 8), coat, { x: 0.18, y: 1.28, z: 0.5, sx: 1.6, sz: 0.6 }),
        ...eye(-0.1, 1.32, 0.71, 0.03, -1), ...eye(0.1, 1.32, 0.71, 0.03),
        part(Cone(0.06, 0.2, 8), 0xdcd6c8, { y: 1.0, z: 0.7, rx: Math.PI }),
        part(Sph(0.05, 8, 6), 0xd9b0a0, { y: 1.18, z: 0.77 }),
      ]);
      addLegs(g, [[-0.15, -0.32], [0.15, -0.32], [-0.15, 0.32], [0.15, 0.32]], 0.65, 0.055, 0xdcd6c8, 0x4a4038); break;
    }
    case 'lizard': {
      g = animalGroup([
        part(Sph(0.09, 12, 8), 0x4fb08a, { y: 0.06, sz: 3.2 }), part(Cone(0.05, 0.45, 10), 0x4fb08a, { y: 0.06, z: -0.45, rx: -Math.PI / 2 }),
        part(Sph(0.07, 12, 8), 0x5fc29a, { y: 0.08, z: 0.32, sz: 1.4 }),
        ...eye(-0.05, 0.12, 0.36, 0.022, -1), ...eye(0.05, 0.12, 0.36, 0.022),
        ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => part(Cyl(0.015, 0.015, 0.14, 5), 0x3f9a76, { x: sx * 0.1, y: 0.04, z: sz * 0.14, rz: sx * 1.2 }))),
      ]); break;
    }
    case 'butterfly': {
      g = new THREE.Group();
      const col = [0xf7a1c4, 0xf7d74a, 0x9ab8ff][Math.floor(Math.random() * 3)];
      for (const side of [-1, 1]) {
        const w = new THREE.Group();
        const m = new THREE.Mesh(build([part(Sph(0.11, 10, 6), col, { x: side * 0.11, sy: 0.08, sz: 0.85 }), part(Sph(0.07, 10, 6), shade(col, -0.1), { x: side * 0.09, z: -0.1, sy: 0.08 })]), propMaterial);
        w.add(m); g.add(w); legs.push(w);
      }
      break;
    }
    case 'whale': {
      g = animalGroup([part(Sph(2.2, 20, 14), 0x3d5a80, { sz: 2.6, sy: 0.8 }), part(Box(3, 0.2, 1.2), 0x3d5a80, { z: -5.8, y: 0.3 }), part(Sph(1.6, 16, 10), 0xd7e3ef, { y: -0.9, sz: 2.2, sy: 0.4 }), ...eye(-1.5, 0.2, 3.6, 0.18, -1), ...eye(1.5, 0.2, 3.6, 0.18)]); break;
    }
    case 'cat': {
      g = animalGroup([
        part(Sph(0.17, 14, 10), 0xf2a65a, { y: 0.36, sz: 1.9 }),
        part(Sph(0.17, 14, 10), 0xf2a65a, { y: 0.56, z: 0.34 }),
        part(Cone(0.07, 0.15, 8), 0xf2a65a, { x: -0.09, y: 0.73, z: 0.33 }), part(Cone(0.07, 0.15, 8), 0xf2a65a, { x: 0.09, y: 0.73, z: 0.33 }),
        ...eye(-0.07, 0.6, 0.48, 0.03, -1), ...eye(0.07, 0.6, 0.48, 0.03),
        part(Sph(0.025, 6, 4), 0xd97a7a, { y: 0.54, z: 0.51 }),
        part(Cyl(0.035, 0.045, 0.5, 8), 0xf2a65a, { y: 0.6, z: -0.4, rx: -0.6 }),
      ]);
      addLegs(g, [[-0.1, -0.2], [0.1, -0.2], [-0.1, 0.2], [0.1, 0.2]], 0.22, 0.04, 0xf2a65a); break;
    }
    default: g = animalGroup([part(Ico(0.3), 0xff00ff, {})]);
  }
  g.userData.legs = legs;
  return g;
}
