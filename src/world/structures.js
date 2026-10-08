// Unique hand-placed structures. Each returns a mesh/group and registers colliders + scatter exclusions.
import * as THREE from 'three';
import { part, build, prim, propMaterial, glowMaterial } from './props.js';
import { groundHeight } from './terrain.js';
import { mulberry32 } from '../core/math.js';

const { Cyl, Cone, Ico, Dode, Box, Sph } = prim;

export function baseY(x, z, r = 2) {
  let m = groundHeight(x, z);
  for (let a = 0; a < 6; a++) m = Math.min(m, groundHeight(x + Math.cos(a) * r, z + Math.sin(a) * r));
  return m;
}

function place(mesh, x, y, z, yaw = 0) {
  mesh.position.set(x, y, z);
  mesh.rotation.y = yaw;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export class StructureBuilder {
  constructor(scene, colliders, exclusions) {
    this.scene = scene;
    this.col = colliders;
    this.excl = exclusions;
    this.animated = [];
  }

  add(geo, x, y, z, yaw = 0, mat = propMaterial) {
    const m = place(new THREE.Mesh(geo, mat), x, y, z, yaw);
    this.scene.add(m);
    return m;
  }

  exclude(x, z, r) { this.excl.push({ x, z, r }); }

  house(x, z, yaw, opts = {}) {
    const w = opts.w || 6, d = opts.d || 5, wh = opts.wallH || 3.2;
    const wall = opts.wall || 0xf3e3c3, roof = opts.roof || 0xc8553d;
    const y = baseY(x, z, Math.max(w, d) / 2);
    const parts = [
      part(Box(w + 0.4, 0.5, d + 0.4), 0x9b938a, { y: 0.25 }),
      part(Box(w, wh, d), wall, { y: 0.5 + wh / 2 }),
      part(Cyl(0.0001, Math.hypot(w, d) * 0.62, 2.4, 4), roof, { y: 0.5 + wh + 1.2, ry: Math.PI / 4, sz: d / w }),
      part(Box(1.1, 1.9, 0.12), 0x7a4b2a, { y: 1.45, z: d / 2 + 0.05 }),
      part(Box(0.9, 0.9, 0.1), 0x9fd3f0, { x: -w / 2 + 1.2, y: 2.2, z: d / 2 + 0.05 }),
      part(Box(0.9, 0.9, 0.1), 0x9fd3f0, { x: w / 2 - 1.2, y: 2.2, z: d / 2 + 0.05 }),
      part(Box(0.6, 1.6, 0.6), 0x8a7f74, { x: w / 4, y: 0.5 + wh + 1.6, z: -d / 6 }),
    ];
    if (opts.flowerBox) parts.push(part(Box(1.1, 0.25, 0.3), 0x7a4b2a, { x: -w / 2 + 1.2, y: 1.65, z: d / 2 + 0.2 }), part(Box(1, 0.2, 0.2), 0xf17aa6, { x: -w / 2 + 1.2, y: 1.85, z: d / 2 + 0.2 }));
    const m = this.add(build(parts), x, y, z, yaw);
    this.col.addBox(x, z, w / 2 + 0.1, d / 2 + 0.1, y, y + 0.5 + wh + 2.4, yaw, { walkable: false });
    this.exclude(x, z, Math.max(w, d) * 0.8 + 1);
    return m;
  }

  windmill(x, z) {
    const y = baseY(x, z, 3.4);
    const parts = [
      part(Cyl(3.4, 3.4, 5, 10), 0xd9c7a3, { y: 2.5 }),
      part(Cyl(3.6, 3.6, 0.3, 10), 0x7a5536, { y: 5.0 }),
      part(Cyl(1.6, 2.1, 7, 8), 0xf0e6d2, { y: 8.5 }),
      part(Cone(2.0, 2.4, 8), 0xa74a35, { y: 13.2 }),
      part(Box(1.1, 1.9, 0.2), 0x7a4b2a, { y: 1.0, z: 3.38 }),
    ];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      parts.push(part(Cyl(0.06, 0.06, 0.9, 4), 0x7a5536, { x: Math.cos(a) * 3.5, y: 5.6, z: Math.sin(a) * 3.5 }));
    }
    this.add(build(parts), x, y, z);
    const blades = new THREE.Group();
    const bp = [part(Cyl(0.35, 0.35, 0.8, 8), 0x7a5536, { rx: Math.PI / 2 })];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      bp.push(part(Box(0.25, 5.2, 0.1), 0x7a5536, { x: Math.cos(a) * 2.6, y: Math.sin(a) * 2.6, rz: a - Math.PI / 2 }));
      bp.push(part(Box(1.1, 4.0, 0.06), 0xf7f1e3, { x: Math.cos(a) * 3 + Math.cos(a + Math.PI / 2) * 0.6, y: Math.sin(a) * 3 + Math.sin(a + Math.PI / 2) * 0.6, z: 0.08, rz: a - Math.PI / 2 }));
    }
    const bm = new THREE.Mesh(build(bp), propMaterial);
    bm.castShadow = true;
    blades.add(bm);
    blades.position.set(x, y + 11, z + 2.4);
    this.scene.add(blades);
    this.animated.push((dt) => { bm.rotation.z += dt * 0.6; });
    this.col.addCylinder(x, z, 3.5, y, y + 5.15, { walkable: true });
    this.col.addCylinder(x, z, 2.1, y + 5.15, y + 14, {});
    // Crate staircase up to the balcony.
    const steps = [[5.4, 0, 1.1], [6.6, 1.3, 2.2], [6.2, 3.0, 3.3], [4.8, 4.4, 4.3]];
    for (const [dx, dz, h] of steps) this.crate(x + dx, z + dz, y, h);
    this.exclude(x, z, 9);
    return { x, y, z, top: y + 5.15 };
  }

  crate(x, z, y0, top, size = 1.2) {
    const h = top - y0;
    const g = build([
      part(Box(size, h, size), 0xb5874f, { y: h / 2 }),
      part(Box(size + 0.04, 0.12, size + 0.04), 0x8a6238, { y: h - 0.06 }),
      part(Box(size + 0.04, 0.12, size + 0.04), 0x8a6238, { y: 0.06 }),
    ]);
    this.add(g, x, y0, z);
    this.col.addBox(x, z, size / 2, size / 2, y0, top, 0, { walkable: true });
  }

  stall(x, z, yaw) {
    const y = baseY(x, z, 2.5);
    const parts = [part(Box(3.6, 1.0, 1.4), 0xa8713f, { y: 0.5 })];
    for (const [px, pz] of [[-1.7, -0.6], [1.7, -0.6], [-1.7, 1.2], [1.7, 1.2]]) parts.push(part(Cyl(0.08, 0.08, 2.8, 5), 0x7a5536, { x: px, y: 1.4, z: pz }));
    for (let i = 0; i < 6; i++) parts.push(part(Box(0.62, 0.08, 2.4), i % 2 ? 0xffffff : 0x4aa3df, { x: -1.55 + i * 0.62, y: 2.85, z: 0.3, rx: -0.25 }));
    parts.push(part(Ico(0.25), 0xe0453a, { x: -1, y: 1.2, z: -0.2 }), part(Ico(0.25), 0xf2b134, { x: -0.4, y: 1.2, z: -0.3 }), part(Box(0.5, 0.4, 0.4), 0x8a6238, { x: 0.8, y: 1.2 }));
    this.add(build(parts), x, y, z, yaw);
    this.col.addBox(x, z, 1.9, 0.8, y, y + 1.0, yaw, { walkable: true });
    this.exclude(x, z, 4);
  }

  well(x, z) {
    const y = baseY(x, z, 1.5);
    const parts = [part(Cyl(1.3, 1.4, 1.0, 10), 0x9b938a, { y: 0.5 }), part(Cyl(1.05, 1.05, 0.05, 10), 0x3d7ea6, { y: 0.85 })];
    parts.push(part(Cyl(0.08, 0.08, 2.2, 4), 0x7a5536, { x: -1.1, y: 1.6 }), part(Cyl(0.08, 0.08, 2.2, 4), 0x7a5536, { x: 1.1, y: 1.6 }));
    parts.push(part(Cyl(0.0001, 1.6, 0.8, 4), 0xc8553d, { y: 3.0, ry: Math.PI / 4, sz: 0.6 }));
    this.add(build(parts), x, y, z);
    this.col.addCylinder(x, z, 1.4, y, y + 1.0, { walkable: true });
    this.exclude(x, z, 3);
  }

  lampPost(x, z) {
    const y = groundHeight(x, z);
    this.add(build([part(Cyl(0.08, 0.1, 2.6, 5), 0x3b3b3b, { y: 1.3 }), part(Box(0.4, 0.1, 0.4), 0x3b3b3b, { y: 2.65 })]), x, y, z);
    const lamp = new THREE.Mesh(build([part(Box(0.3, 0.35, 0.3), 0xffe7a3, { y: 2.45 })]), glowMaterial(0xffc85a, 0.2));
    place(lamp, x, y, z);
    this.scene.add(lamp);
    this.col.addCylinder(x, z, 0.15, y, y + 2.7);
    return lamp;
  }

  fenceRing(cx, cz, r, gapAngle = 0, gap = 0.5) {
    const n = Math.floor((Math.PI * 2 * r) / 2.2);
    const parts = [];
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      let da = Math.abs(((a - gapAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      pts.push({ a, skip: da < gap });
    }
    const y0 = groundHeight(cx, cz);
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[i + 1];
      if (p.skip || q.skip) continue;
      const x1 = cx + Math.cos(p.a) * r, z1 = cz + Math.sin(p.a) * r;
      const x2 = cx + Math.cos(q.a) * r, z2 = cz + Math.sin(q.a) * r;
      const y1 = groundHeight(x1, z1) - y0, y2 = groundHeight(x2, z2) - y0;
      const mx = (x1 + x2) / 2 - cx, mz = (z1 + z2) / 2 - cz, len = Math.hypot(x2 - x1, z2 - z1);
      const yaw = -Math.atan2(z2 - z1, x2 - x1);
      parts.push(part(Box(0.15, 1.1, 0.15), 0x8a6238, { x: x1 - cx, y: y1 + 0.55, z: z1 - cz }));
      parts.push(part(Box(len, 0.1, 0.08), 0xa8713f, { x: mx, y: (y1 + y2) / 2 + 0.85, z: mz, ry: yaw }));
      parts.push(part(Box(len, 0.1, 0.08), 0xa8713f, { x: mx, y: (y1 + y2) / 2 + 0.45, z: mz, ry: yaw }));
      this.col.addBox(cx + mx, cz + mz, len / 2, 0.12, y0 + Math.min(y1, y2), y0 + Math.max(y1, y2) + 1.0, yaw, { walkable: false });
    }
    this.add(build(parts), cx, y0, cz);
  }

  campfire(x, z) {
    const y = groundHeight(x, z);
    const parts = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      parts.push(part(Dode(0.28), 0x8f8b85, { x: Math.cos(a) * 0.85, y: 0.12, z: Math.sin(a) * 0.85, jitter: 0.1, seed: i }));
    }
    for (let i = 0; i < 3; i++) parts.push(part(Cyl(0.1, 0.12, 1.2, 5), 0x6b4a2a, { y: 0.2, ry: (i / 3) * Math.PI, rz: Math.PI / 2 - 0.25 }));
    parts.push(part(Cyl(0.25, 0.28, 1.8, 6), 0x7a5536, { x: 2.0, y: 0.25, rz: Math.PI / 2, ry: 0.4 }));
    this.add(build(parts), x, y, z);
    const fire = new THREE.Mesh(build([
      part(Cone(0.45, 1.1, 5), 0xff8a2a, { y: 0.6 }),
      part(Cone(0.25, 0.8, 5), 0xffe066, { y: 0.55, x: 0.05 }),
    ]), glowMaterial(0xff7a1a, 2.2));
    place(fire, x, y, z);
    fire.castShadow = false;
    fire.visible = false;
    this.scene.add(fire);
    this.animated.push((dt, t) => {
      if (!fire.visible) return;
      fire.scale.set(1 + Math.sin(t * 13 + x) * 0.08, 1 + Math.sin(t * 9.3 + z) * 0.15, 1 + Math.cos(t * 11 + x) * 0.08);
      fire.rotation.y += dt * 2;
    });
    this.exclude(x, z, 3.5);
    return { x, y, z, fire };
  }

  lighthouse(x, z) {
    const y = baseY(x, z, 4);
    const parts = [part(Cyl(4.6, 5, 1.2, 12), 0x9b938a, { y: 0.6 })];
    for (let i = 0; i < 6; i++) parts.push(part(Cyl(3.4 - (i + 1) * 0.15, 3.4 - i * 0.15, 2.4, 12), i % 2 ? 0xd9443a : 0xf7f3ea, { y: 1.2 + i * 2.4 + 1.2 }));
    const top = 1.2 + 6 * 2.4;
    parts.push(part(Cyl(3.3, 3.3, 0.4, 12), 0x3b3b3b, { y: top + 0.2 }));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      parts.push(part(Cyl(0.05, 0.05, 1.0, 4), 0x3b3b3b, { x: Math.cos(a) * 3.2, y: top + 0.9, z: Math.sin(a) * 3.2 }));
    }
    parts.push(part(Cyl(1.9, 1.9, 2.6, 10), 0xcfe8f5, { y: top + 1.7 }));
    parts.push(part(Cone(2.3, 2.0, 10), 0xd9443a, { y: top + 4.0 }));
    parts.push(part(Sph(0.35), 0xf2c94c, { y: top + 5.2 }));
    parts.push(part(Box(1.4, 2.4, 0.3), 0x5a3a22, { y: 2.4, z: 3.25 }));
    this.add(build(parts), x, y, z);
    const lamp = new THREE.Mesh(build([part(Ico(1.0, 1), 0xfff3b0, { y: top + 1.7 })]), glowMaterial(0xffe28a, 0.15));
    place(lamp, x, y, z);
    lamp.castShadow = false;
    this.scene.add(lamp);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 9, 140, 16, 1, true).translate(0, 70, 0).rotateZ(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    beam.position.set(x, y + top + 1.7, z);
    beam.visible = false;
    this.scene.add(beam);
    this.animated.push((dt) => { if (beam.visible) beam.rotation.y += dt * 0.5; });
    this.col.addCylinder(x, z, 4.8, y, y + 1.2, { walkable: true });
    this.col.addCylinder(x, z, 3.4, y + 1.2, y + top + 6);
    this.exclude(x, z, 10);
    return { x, y, z, lamp, beam, door: { x, z: z + 4.4, y: y + 1.2 } };
  }

  observatory(x, z) {
    const y = baseY(x, z, 5);
    const parts = [
      part(Cyl(4.4, 4.6, 0.6, 12), 0x9b938a, { y: 0.3 }),
      part(Cyl(3.6, 3.6, 4.2, 12), 0xe8e2d6, { y: 2.7 }),
      part(Sph(3.8, 12, 6), 0x5b6fa8, { y: 4.8, sy: 0.85 }),
      part(Box(0.9, 4.2, 0.2), 0x2f3b63, { y: 6.2, z: 2.4, rx: -0.5 }),
      part(Cyl(0.35, 0.45, 4.2, 8), 0xc9a54a, { y: 7.2, z: 1.9, rx: -0.9 }),
      part(Box(1.2, 2.0, 0.2), 0x5a3a22, { y: 1.6, z: 3.55 }),
    ];
    this.add(build(parts), x, y, z);
    this.col.addCylinder(x, z, 3.8, y, y + 8.5);
    this.exclude(x, z, 14);
    return { x, y, z };
  }

  ruins(x, z) {
    const y = baseY(x, z, 8);
    const r = mulberry32(5);
    const parts = [part(Box(15.2, 0.4, 15.2), 0xb9b2a4, { y: 0.2 })];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const h = 1.5 + r() * 4;
      parts.push(part(Cyl(0.55, 0.65, h, 8), 0xcfc6b4, { x: Math.cos(a) * 10.5, y: h / 2, z: Math.sin(a) * 10.5 }));
      this.col.addCylinder(x + Math.cos(a) * 10.5, z + Math.sin(a) * 10.5, 0.65, y, y + h, { walkable: true });
      if (r() > 0.5) parts.push(part(Box(1.6, 0.5, 0.8), 0xcfc6b4, { x: Math.cos(a) * 12.3, y: 0.25, z: Math.sin(a) * 12.3, ry: r() * 3, rz: 0.2 }));
    }
    parts.push(part(Box(2.4, 1.2, 2.4), 0xa49c8c, { z: -10.5, y: 0.6 }));
    this.add(build(parts), x, y, z);
    this.col.addBox(x, z, 7.6, 7.6, y - 2, y + 0.4, 0, { walkable: true });
    this.col.addBox(x, z - 10.5, 1.2, 1.2, y, y + 1.2, 0, { walkable: true });
    this.exclude(x, z, 15);
    return { x, y: y + 0.4, z, altar: { x, z: z - 10.5, y: y + 1.2 } };
  }

  shipwreck(x, z, yaw) {
    const y = groundHeight(x, z);
    const parts = [];
    for (let i = 0; i < 7; i++) {
      const t = i / 6 - 0.5;
      const w = 4.2 * (1 - Math.abs(t) * 0.9);
      parts.push(part(Box(w, 2.6, 2.1), i % 2 ? 0x6b4a2a : 0x7a5536, { z: t * 13, y: 1.0 }));
    }
    parts.push(part(Box(3.6, 0.2, 11), 0x9a7650, { y: 2.4 }));
    parts.push(part(Cyl(0.18, 0.24, 9, 6), 0x6b4a2a, { y: 6.5, z: -1, rz: 0.15 }));
    parts.push(part(Box(0.15, 3.2, 4), 0xe9e1cf, { y: 7.5, z: -1, x: 0.6, rz: 0.15, ry: 0.2 }));
    parts.push(part(Box(2.6, 1.2, 3), 0x7a5536, { z: 5, y: 3.0 }));
    const g = build(parts);
    const m = this.add(g, x, y - 0.6, z, yaw);
    m.rotation.z = 0.12;
    this.col.addBox(x, z, 1.8, 6.4, y - 1, y + 1.85, yaw, { walkable: true });
    const bx = x + Math.sin(yaw) * 5, bz = z + Math.cos(yaw) * 5;
    this.col.addBox(bx, bz, 1.3, 1.5, y - 1, y + 3.0, yaw, { walkable: true });
    this.exclude(x, z, 9);
    return { x, y: y + 1.85, z, bow: { x: bx, z: bz, y: y + 3.0 } };
  }

  arch(x, z, yaw) {
    const y = groundHeight(x, z);
    const g = build([
      part(new THREE.TorusGeometry(7, 1.8, 6, 12, Math.PI), 0xb4613b, { y: 0, jitter: 0.6, seed: 3 }),
      part(Dode(2.4), 0xa65535, { x: -7, y: 0.5, jitter: 0.5, seed: 4 }),
      part(Dode(2.4), 0xa65535, { x: 7, y: 0.5, jitter: 0.5, seed: 5 }),
    ]);
    this.add(g, x, y, z, yaw);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    this.col.addCylinder(x + 7 * c, z - 7 * s, 2.2, y - 2, y + 6);
    this.col.addCylinder(x - 7 * c, z + 7 * s, 2.2, y - 2, y + 6);
    this.exclude(x, z, 11);
    return { x, y, z };
  }

  giantTree(x, z) {
    const y = baseY(x, z, 3);
    const parts = [part(Cyl(2.2, 3.4, 20, 9), 0x6b4a30, { y: 10, jitter: 0.3, seed: 11 })];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      parts.push(part(Cyl(0.3, 0.9, 5, 5), 0x6b4a30, { x: Math.cos(a) * 3.2, y: 0.6, z: Math.sin(a) * 3.2, rx: Math.sin(a) * 1.2, rz: -Math.cos(a) * 1.2 }));
    }
    const r = mulberry32(17);
    for (let i = 0; i < 9; i++) {
      const a = r() * Math.PI * 2, d = 3 + r() * 6;
      parts.push(part(Ico(4 + r() * 2.5, 0), new THREE.Color(0x3f7d3a).offsetHSL(0, 0, (r() - 0.5) * 0.08), { x: Math.cos(a) * d, y: 21 + r() * 4, z: Math.sin(a) * d, jitter: 1.2, seed: 20 + i }));
    }
    this.add(build(parts), x, y, z);
    this.col.addCylinder(x, z, 3.0, y - 1, y + 19.5);
    // Spiral of bracket-fungus shelves.
    const shelf = [];
    const steps = 15;
    for (let i = 0; i < steps; i++) {
      const a = i * 0.75, h = 1.0 + i * 1.15, rr = 3.9;
      const sx = x + Math.cos(a) * rr, sz = z + Math.sin(a) * rr;
      shelf.push(part(Cyl(1.25, 1.0, 0.35, 8), i % 3 === 0 ? 0xe0a85a : 0xd99a4a, { x: Math.cos(a) * rr, y: h, z: Math.sin(a) * rr, sz: 0.85 }));
      this.col.addCylinder(sx, sz, 1.2, y + h - 0.35, y + h + 0.17, { walkable: true });
    }
    const topY = 1.0 + steps * 1.15 + 0.6;
    shelf.push(part(Cyl(4.2, 3.6, 0.6, 10), 0x7a5536, { y: topY }));
    this.col.addCylinder(x, z, 4.2, y + topY - 0.6, y + topY + 0.3, { walkable: true });
    this.add(build(shelf), x, y, z);
    this.exclude(x, z, 12);
    return { x, y, z, top: y + topY + 0.3 };
  }

  dock(x, z, yaw, len = 18) {
    const y = 1.6;
    const parts = [];
    for (let i = 0; i < len / 1.2; i++) parts.push(part(Box(3, 0.18, 1.1), i % 2 ? 0xa8713f : 0x9a6a3a, { z: i * 1.2, y: 0 }));
    for (let i = 0; i < len / 3; i++) for (const sx of [-1.4, 1.4]) parts.push(part(Cyl(0.15, 0.15, 6, 5), 0x6b4a2a, { x: sx, z: i * 3, y: -2.9 }));
    const g = build(parts);
    this.add(g, x, y, z, yaw);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const mid = len / 2 - 0.6;
    this.col.addBox(x + s * mid, z + c * mid, 1.5, len / 2, y - 6, y + 0.09, yaw, { walkable: true });
    return { x, z, y: y + 0.09, end: { x: x + s * (len - 1), z: z + c * (len - 1) } };
  }

  flag(x, z, color = 0xe94e3c) {
    const y = groundHeight(x, z);
    const g = build([part(Cyl(0.06, 0.08, 5, 5), 0xdddddd, { y: 2.5 })]);
    this.add(g, x, y, z);
    const f = new THREE.Mesh(build([part(Box(1.6, 1.0, 0.04), color, { x: 0.8 })]), propMaterial);
    f.position.set(x, y + 4.4, z);
    this.scene.add(f);
    this.animated.push((dt, t) => { f.rotation.y = Math.sin(t * 2.1 + x) * 0.35; });
    this.col.addCylinder(x, z, 0.1, y, y + 5);
  }

  bench(x, z, yaw) {
    const y = groundHeight(x, z);
    this.add(build([
      part(Box(2, 0.12, 0.6), 0xa8713f, { y: 0.5 }),
      part(Box(2, 0.5, 0.1), 0xa8713f, { y: 0.85, z: -0.28 }),
      part(Box(0.1, 0.5, 0.5), 0x5a3a22, { x: -0.85, y: 0.25 }),
      part(Box(0.1, 0.5, 0.5), 0x5a3a22, { x: 0.85, y: 0.25 }),
    ]), x, y, z, yaw);
    this.col.addBox(x, z, 1.0, 0.3, y, y + 0.56, yaw, { walkable: true });
  }

  signpost(x, z, yaw) {
    const y = groundHeight(x, z);
    this.add(build([
      part(Cyl(0.08, 0.1, 2.2, 5), 0x7a5536, { y: 1.1 }),
      part(Box(1.3, 0.35, 0.08), 0xc9a26b, { y: 1.85, x: 0.4 }),
      part(Box(1.1, 0.35, 0.08), 0xc9a26b, { y: 1.4, x: -0.35, ry: 0.4 }),
    ]), x, y, z, yaw);
    this.col.addCylinder(x, z, 0.12, y, y + 2.2);
  }

  pillar(x, z, height, r = 1.3, color = 0xcfc6b4) {
    const y = baseY(x, z, r);
    this.add(build([part(Cyl(r, r * 1.1, height, 8), color, { y: height / 2, jitter: 0.08, seed: Math.floor(x * 7 + z) })]), x, y, z);
    this.col.addCylinder(x, z, r, y - 1, y + height, { walkable: true });
    this.exclude(x, z, r + 1);
    return y + height;
  }

  plank(x, y, z, yaw, len = 4, w = 1.4) {
    this.add(build([part(Box(w, 0.25, len), 0xa8713f, {}), part(Box(w + 0.1, 0.1, 0.2), 0x7a5536, { y: 0.1, z: len / 2 - 0.2 }), part(Box(w + 0.1, 0.1, 0.2), 0x7a5536, { y: 0.1, z: -len / 2 + 0.2 })]), x, y, z, yaw);
    this.col.addBox(x, z, w / 2, len / 2, y - 0.4, y + 0.125, yaw, { walkable: true });
  }
}
