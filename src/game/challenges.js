// Puzzles and challenges: glide ring courses, box puzzle, light mirrors, constellations,
// the spirit fox trail, lost sheep and the canyon foot race.
import * as THREE from 'three';
import { part, build, prim, propMaterial, glowMaterial } from '../world/props.js';
import { groundHeight, highestPoint } from '../world/terrain.js';
import { LAKE, LAKE_ISLANDS, ISLETS } from '../world/layout.js';
import { createAnimal } from '../player/character.js';
import { angleLerp, damp } from '../core/math.js';
import { t as tr } from '../i18n.js';

const { Cyl, Cone, Box, Ico, Sph } = prim;
const G = (x, z, dy = 0) => ({ x, y: groundHeight(x, z) + dy, z });

export class Challenges {
  constructor(game) {
    this.g = game;
    this.activeCourse = null;
    this.race = null;
    this.pendingRace = null;
    this._buildUpdrafts();
    this._buildCourses();
    this._buildBoxPuzzle();
    this._buildMirrors();
    this._buildPedestals();
    this._buildFox();
    this._buildSheep();
  }

  // ---------------- Updrafts ----------------
  _buildUpdrafts() {
    this.drafts = [];
    for (const u of this.g.content.updrafts) this.addUpdraft(u);
  }

  addUpdraft(u) {
    const base = groundHeight(u.x, u.z);
    u.base = Math.max(base, 0);
    const h = u.top - u.base + 4;
    const geo = new THREE.CylinderGeometry(u.r, u.r * 0.8, h, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0xcff6ff, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(u.x, u.base + h / 2, u.z);
    this.g.scene.add(m);
    u.mesh = m;
    this.drafts.push(u);
    this.g.player.updrafts.push(u);
  }

  // ---------------- Ring courses ----------------
  _buildCourses() {
    const g = this.g;
    const defs = [
      { id: 'ring_canyon1', name: tr('峡谷光环 · 北'), start: highestPoint(212, -67, 10), to: { x: 262, z: 10 }, n: 6 },
      { id: 'ring_canyon2', name: tr('峡谷光环 · 东'), start: highestPoint(298, -15, 10), to: { x: 225, z: 50 }, n: 6 },
      { id: 'ring_coast', name: tr('海岸光环'), start: g.content.mesaS, to: { x: ISLETS[0].x, z: ISLETS[0].z }, n: 7 },
    ];
    this.courses = defs.map((d) => this._makeCourse(d));
  }

  _makeCourse(def) {
    const g = this.g;
    const s = def.start;
    const dx = def.to.x - s.x, dz = def.to.z - s.z, L = Math.hypot(dx, dz);
    const ux = dx / L, uz = dz / L;
    const spacing = Math.min(26, (L - 6) / def.n);
    const rings = [];
    let y = s.y + 2.5;
    for (let i = 1; i <= def.n; i++) {
      const x = s.x + ux * spacing * i, z = s.z + uz * spacing * i;
      let gmax = 0;
      for (let k = 0; k <= 6; k++) { const t = k / 6; gmax = Math.max(gmax, groundHeight(x - ux * spacing * (1 - t), z - uz * spacing * (1 - t))); }
      let ry = y - spacing * 0.22;
      if (ry < gmax + 4.5) {
        ry = gmax + 7;
        const mx = x - ux * spacing * 0.55, mz = z - uz * spacing * 0.55;
        this.addUpdraft({ x: mx, z: mz, r: 3.5, top: ry + 3, course: def.id });
      }
      rings.push({ x, y: ry, z, passed: false });
      y = ry;
    }
    // Totem at the start
    const tx = s.x - ux * 2.5, tz = s.z - uz * 2.5;
    const ty = groundHeight(tx, tz);
    const totem = new THREE.Mesh(build([
      part(Cyl(0.18, 0.22, 2.6, 6), 0x7a5536, { y: 1.3 }),
      part(Box(1.4, 0.12, 0.12), 0x7a5536, { y: 2.5 }),
      part(Cone(0.18, 0.35, 6), 0xf2c94c, { x: -0.55, y: 2.2 }),
      part(Cone(0.18, 0.35, 6), 0x7fd8ff, { x: 0, y: 2.15 }),
      part(Cone(0.18, 0.35, 6), 0xf2c94c, { x: 0.55, y: 2.2 }),
    ]), propMaterial);
    totem.position.set(tx, ty, tz);
    totem.rotation.y = Math.atan2(ux, uz);
    totem.castShadow = true;
    g.scene.add(totem);
    g.world.colliders.addCylinder(tx, tz, 0.3, ty, ty + 2.6);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x9ff3ff, emissive: 0x3fd0ff, emissiveIntensity: 1.4, transparent: true, opacity: 0.85 });
    const ringGeo = new THREE.TorusGeometry(2.8, 0.22, 6, 24);
    for (const r of rings) {
      r.mesh = new THREE.Mesh(ringGeo, ringMat.clone());
      r.mesh.position.set(r.x, r.y, r.z);
      r.mesh.rotation.y = Math.atan2(ux, uz);
      r.mesh.visible = false;
      g.scene.add(r.mesh);
    }
    const dist = spacing * def.n;
    const course = { ...def, rings, ux, uz, limit: Math.ceil(dist / 9 + 10), totem: { x: tx, y: ty, z: tz } };
    g.interact.add({
      pos: { x: tx, y: ty, z: tz }, radius: 3,
      label: () => (this.activeCourse ? null : (g.state.has('shards', def.id) ? tr('敲响风铃（再挑战一次）') : tr('敲响风铃'))),
      action: async () => this.startCourse(course),
    });
    return course;
  }

  async startCourse(c) {
    const g = this.g;
    if (!g.state.data.abilities.glider) { g.hud.toast(tr('光环飘在半空中……需要滑翔翼才能穿过它们。')); return; }
    this.activeCourse = c;
    c.next = 0;
    c.time = c.limit;
    for (const r of c.rings) { r.passed = false; r.mesh.visible = true; r.mesh.material.color.set(0x9ff3ff); r.prevSide = null; }
    g.audio.play('ring');
    g.audio.setMood('tense');
    g.hud.toast(tr('在时间内按顺序穿过所有光环！'));
  }

  _endCourse(win) {
    const g = this.g, c = this.activeCourse;
    this.activeCourse = null;
    g.hud.setRace(null);
    g.audio.setMood(g.moodNow());
    for (const r of c.rings) r.mesh.visible = false;
    if (win) {
      g.audio.play('fanfare');
      const last = c.rings[c.rings.length - 1];
      if (!g.collect.awardShard(c.id, last)) g.hud.banner(tr('挑战成功！'), '');
    } else {
      g.audio.play('fail');
      g.hud.toast(tr('时间到了……回到风铃柱再试一次吧。'));
    }
  }

  _updateCourse(dt) {
    const c = this.activeCourse;
    if (!c) return;
    const g = this.g, p = g.player.pos;
    c.time -= dt;
    g.hud.setRace(`${c.name} · ${c.next}/${c.rings.length}`, c.time.toFixed(1));
    const r = c.rings[c.next];
    const cx = p.x - r.x, cy = p.y + 0.9 - r.y, cz = p.z - r.z;
    const side = cx * c.ux + cz * c.uz;
    const lat = Math.hypot(cx - side * c.ux, cy, cz - side * c.uz);
    if (r.prevSide !== null && r.prevSide < 0 && side >= 0 && lat < 3.4) {
      r.passed = true;
      r.mesh.material.color.set(0xffe066);
      g.audio.play('ring');
      g.fx.emit(r.x, r.y, r.z, 30, { color: 0x9ff3ff, speed: 5, gravity: 0 });
      c.next++;
      if (c.next >= c.rings.length) { this._endCourse(true); return; }
    }
    r.prevSide = side;
    for (const rr of c.rings) if (rr.mesh.visible) rr.mesh.rotation.z += dt * (rr === r ? 1.5 : 0.3);
    if (c.time <= 0) this._endCourse(false);
  }

  // ---------------- Box puzzle (ruins) ----------------
  _buildBoxPuzzle() {
    const g = this.g, ru = g.world.anchors.ruins;
    const CELL = 2.4, N = 6;
    const cell = (i, j) => ({ x: ru.x + (i - 2.5) * CELL, z: ru.z + (j - 2.5) * CELL });
    const P = (this.puzzle = { CELL, N, cell, boxes: [], plates: [[4, 1], [1, 4]], walls: [[3, 1], [1, 3]], solved: !!g.state.flag('ruins_solved') });
    const y0 = ru.y;
    for (const [i, j] of P.walls) {
      const c = cell(i, j);
      const m = new THREE.Mesh(build([part(Box(CELL, 1.2, CELL), 0xa49c8c, { y: 0.6, jitter: 0.05, seed: i * 7 + j })]), propMaterial);
      m.position.set(c.x, y0, c.z); m.castShadow = m.receiveShadow = true; g.scene.add(m);
      g.world.colliders.addBox(c.x, c.z, CELL / 2, CELL / 2, y0, y0 + 1.2, 0, { walkable: true });
    }
    P.plateMeshes = P.plates.map(([i, j]) => {
      const c = cell(i, j);
      const m = new THREE.Mesh(build([part(Cyl(1.0, 1.0, 0.12, 12), 0xffffff, { y: 0.06 })]), new THREE.MeshStandardMaterial({ color: 0x8fb3c9, emissive: 0x3fa0ff, emissiveIntensity: 0.1 }));
      m.position.set(c.x, y0, c.z); g.scene.add(m);
      return m;
    });
    const start = P.solved ? P.plates : [[2, 2], [3, 3]];
    for (const [i, j] of start) {
      const c = cell(i, j);
      const mesh = new THREE.Mesh(build([
        part(Box(2.0, 1.6, 2.0), 0xc9b48a, { y: 0.8 }),
        part(Box(2.06, 0.14, 2.06), 0x8a7f74, { y: 1.55 }),
        part(Box(0.7, 0.7, 2.08), 0xd9a03a, { y: 0.8 }),
      ]), propMaterial);
      mesh.position.set(c.x, y0, c.z); mesh.castShadow = mesh.receiveShadow = true; g.scene.add(mesh);
      const col = g.world.colliders.addBox(c.x, c.z, 1.0, 1.0, y0, y0 + 1.6, 0, { walkable: true, dynamic: true });
      P.boxes.push({ i, j, mesh, col, start: [i, j], anim: null, push: 0 });
    }
    P.y0 = y0;
    g.interact.add({
      pos: { x: ru.altar.x, y: ru.altar.y - 1, z: ru.altar.z + 1.6 }, radius: 2.6,
      label: () => (P.solved ? null : tr('重置石箱')),
      action: async () => { this._resetBoxes(); g.audio.play('push'); g.hud.toast(tr('石箱回到了原位。')); },
    });
    this._checkPlates(true);
  }

  _resetBoxes() {
    const P = this.puzzle;
    for (const b of P.boxes) { [b.i, b.j] = b.start; const c = P.cell(b.i, b.j); b.mesh.position.x = b.col.x = c.x; b.mesh.position.z = b.col.z = c.z; b.anim = null; }
    this._checkPlates(true);
  }

  _checkPlates(silent) {
    const P = this.puzzle, g = this.g;
    let all = true;
    P.plates.forEach(([i, j], k) => {
      const on = P.boxes.some((b) => b.i === i && b.j === j);
      const m = P.plateMeshes[k].material;
      if (on && m.emissiveIntensity < 1 && !silent) g.audio.play('plate');
      m.emissiveIntensity = on ? 1.6 : 0.1;
      all = all && on;
    });
    if (all && !P.solved) {
      P.solved = true;
      g.state.flag('ruins_solved', true);
      g.audio.play('fanfare');
      g.hud.toast(tr('遗迹的祭坛亮了起来！'));
      g.collect.spawnShard('ruins_puzzle', g.world.anchors.ruinsAltar);
    }
  }

  _updateBoxes(dt) {
    const P = this.puzzle, g = this.g, pl = g.player;
    if (P.solved) return;
    const pp = pl.pos;
    if (Math.hypot(pp.x - g.world.anchors.ruins.x, pp.z - g.world.anchors.ruins.z) > 16) return;
    for (const b of P.boxes) {
      if (b.anim) {
        b.anim.t += dt / 0.3;
        const t = Math.min(1, b.anim.t);
        const x = b.anim.fx + (b.anim.tx - b.anim.fx) * t, z = b.anim.fz + (b.anim.tz - b.anim.fz) * t;
        b.mesh.position.x = b.col.x = x; b.mesh.position.z = b.col.z = z;
        if (t >= 1) { b.anim = null; this._checkPlates(false); }
        continue;
      }
      if (pl.mode !== 'ground' || Math.abs(pp.y - P.y0) > 0.6) { b.push = 0; continue; }
      const vx = pl.vel.x, vz = pl.vel.z;
      const sp = Math.hypot(vx, vz);
      if (sp < 1.5) { b.push = 0; continue; }
      const dx = b.mesh.position.x - pp.x, dz = b.mesh.position.z - pp.z;
      let di = 0, dj = 0;
      if (Math.abs(vx) > Math.abs(vz) * 1.5 && Math.abs(dz) < 0.9 && Math.abs(dx) < 1.6 && Math.sign(dx) === Math.sign(vx)) di = Math.sign(vx);
      else if (Math.abs(vz) > Math.abs(vx) * 1.5 && Math.abs(dx) < 0.9 && Math.abs(dz) < 1.6 && Math.sign(dz) === Math.sign(vz)) dj = Math.sign(vz);
      if (!di && !dj) { b.push = 0; continue; }
      b.push += dt;
      if (b.push < 0.3) continue;
      b.push = 0;
      const ni = b.i + di, nj = b.j + dj;
      const blocked = ni < 0 || nj < 0 || ni >= P.N || nj >= P.N || P.walls.some(([i, j]) => i === ni && j === nj) || P.boxes.some((o) => o !== b && o.i === ni && o.j === nj);
      if (blocked) continue;
      const from = P.cell(b.i, b.j), to = P.cell(ni, nj);
      b.i = ni; b.j = nj;
      b.anim = { t: 0, fx: from.x, fz: from.z, tx: to.x, tz: to.z };
      g.audio.play('push');
      g.fx.emit(from.x, P.y0 + 0.2, from.z, 10, { color: 0xc9b48a, speed: 2, size: 0.5, gravity: 1 });
    }
  }

  // ---------------- Mirror puzzles (lake) ----------------
  _buildMirrors() {
    const g = this.g;
    const L = LAKE, I = LAKE_ISLANDS;
    const node = (id, x, z, kind) => ({ id, kind, ...G(x, z, 0) });
    const sets = [
      {
        id: 'mirror1',
        nodes: [node('S', L.x, L.z + 62, 'source'), node('A', I[2].x, I[2].z, 'mirror'), node('B', I[3].x, I[3].z, 'mirror'), node('T', L.x - 64, L.z + 4, 'target')],
        src: 'A',
        opts: { A: ['B', 'D:north', 'D:east', 'D:west'], B: ['D:south', 'T', 'A', 'D:north'] },
      },
      {
        id: 'mirror2',
        nodes: [node('S', L.x - 4, L.z - 63, 'source'), node('C', I[0].x, I[0].z, 'mirror'), node('D', I[1].x, I[1].z, 'mirror'), node('E', L.x + 64, L.z - 2, 'mirror'), node('T', L.x + 46, L.z + 44, 'target')],
        src: 'C',
        opts: { C: ['D:west', 'D', 'D:south', 'D:north'], D: ['C', 'D:south', 'E', 'D:north'], E: ['D:north', 'D', 'D:east', 'T'] },
      },
    ];
    this.mirrorSets = [];
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const s of sets) {
      const solved = g.state.has('shards', s.id) || g.state.flag(s.id + '_solved');
      const set = { ...s, sel: {}, beams: [], solved };
      const byId = (id) => set.nodes.find((n) => n.id === id);
      for (const n of set.nodes) {
        n.headY = n.y + 1.8;
        let mesh;
        if (n.kind === 'source') mesh = new THREE.Mesh(build([part(Cyl(0.5, 0.7, 1.2, 6), 0x9b938a, { y: 0.6 }), part(Ico(0.45), 0xfff1a8, { y: 1.8 })]), glowMaterial(0xffd84a, 0.9));
        else if (n.kind === 'target') mesh = new THREE.Mesh(build([part(Cyl(0.5, 0.7, 1.2, 6), 0x9b938a, { y: 0.6 }), part(Ico(0.6, 1), 0xb48cff, { y: 1.9 })]), glowMaterial(0x9a6bff, solved ? 2 : 0.1));
        else {
          mesh = new THREE.Group();
          const stand = new THREE.Mesh(build([part(Cyl(0.15, 0.4, 1.4, 6), 0x7a5536, { y: 0.7 })]), propMaterial);
          const disc = new THREE.Mesh(build([part(Cyl(0.75, 0.75, 0.08, 16), 0xdfe9f2, { rx: Math.PI / 2 }), part(Cyl(0.85, 0.85, 0.06, 16), 0xc9a54a, { rx: Math.PI / 2, z: -0.05 })]), new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.2 }));
          disc.position.y = 1.8;
          mesh.add(stand, disc);
          n.disc = disc;
          set.sel[n.id] = solved ? set.opts[n.id].findIndex((o) => !o.startsWith('D:') && this._isSolution(set, n.id, o)) : 0;
          if (set.sel[n.id] < 0) set.sel[n.id] = 0;
          g.interact.add({
            pos: { x: n.x, y: n.y, z: n.z }, radius: 2.4,
            label: () => (set.solved ? null : tr('转动镜子')),
            action: async () => { set.sel[n.id] = (set.sel[n.id] + 1) % set.opts[n.id].length; g.audio.play('mirror'); this._traceMirrors(set); },
          });
        }
        mesh.position.set(n.x, n.y, n.z);
        mesh.traverse?.((o) => { o.castShadow = true; });
        g.scene.add(mesh);
        n.mesh = mesh;
        g.world.colliders.addCylinder(n.x, n.z, 0.5, n.y, n.y + 2.2);
      }
      for (let i = 0; i < 8; i++) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 6, 1, true).rotateX(Math.PI / 2), beamMat);
        b.visible = false; g.scene.add(b); set.beams.push(b);
      }
      set.byId = byId;
      this.mirrorSets.push(set);
      this._traceMirrors(set, true);
    }
  }

  _isSolution(set, nodeId, opt) {
    // The hard-coded solutions: mirror1 A->B, B->T ; mirror2 C->D, D->E, E->T
    const sol = { mirror1: { A: 'B', B: 'T' }, mirror2: { C: 'D', D: 'E', E: 'T' } };
    return sol[set.id][nodeId] === opt;
  }

  _dirOf(set, from, opt) {
    if (opt.startsWith('D:')) {
      const d = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[opt.slice(2)];
      return { dx: d[0], dz: d[1], to: null };
    }
    const t = set.byId(opt);
    const dx = t.x - from.x, dz = t.z - from.z, l = Math.hypot(dx, dz);
    return { dx: dx / l, dz: dz / l, to: t };
  }

  _traceMirrors(set, silent = false) {
    const g = this.g;
    let cur = set.nodes.find((n) => n.kind === 'source');
    let next = set.byId(set.src);
    let seg = 0;
    const visited = new Set();
    let lit = false;
    const placeBeam = (a, bx, by, bz) => {
      const b = set.beams[seg++]; if (!b) return;
      const ax = a.x, ay = a.headY, az = a.z;
      const len = Math.hypot(bx - ax, by - ay, bz - az);
      b.visible = true;
      b.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
      b.scale.set(1, 1, len);
      b.lookAt(bx, by, bz);
    };
    for (let k = 0; k < 8; k++) {
      if (!next) break;
      placeBeam(cur, next.x, next.headY, next.z);
      if (next.kind === 'target') { lit = true; break; }
      if (visited.has(next.id)) break;
      visited.add(next.id);
      const opt = set.opts[next.id][set.sel[next.id]];
      const d = this._dirOf(set, next, opt);
      if (next.disc) next.disc.rotation.y = Math.atan2(d.dx, d.dz) + (cur ? Math.atan2(cur.x - next.x, cur.z - next.z) - Math.atan2(d.dx, d.dz) : 0) / 2;
      if (!d.to) { placeBeam(next, next.x + d.dx * 45, next.headY, next.z + d.dz * 45); break; }
      cur = next; next = d.to;
    }
    for (let i = seg; i < set.beams.length; i++) set.beams[i].visible = false;
    const tgt = set.nodes.find((n) => n.kind === 'target');
    tgt.mesh.material.emissiveIntensity = lit ? 2.2 : 0.1;
    if (lit && !set.solved) {
      set.solved = true;
      g.state.flag(set.id + '_solved', true);
      if (!silent) {
        g.audio.play('fanfare');
        g.hud.toast(tr('光束点亮了水晶！'));
        this.g.collect.awardShard(set.id, { x: tgt.x, y: tgt.y + 2, z: tgt.z });
      }
    }
  }

  // ---------------- Constellation pedestals ----------------
  _buildPedestals() {
    const g = this.g;
    const names = { swan: tr('天鹅座'), hunter: tr('猎户座'), dipper: tr('北斗七星') };
    const order = ['swan', 'hunter', 'dipper'];
    this.ped = { seq: [], list: [] };
    for (const pd of g.content.pedestals) {
      const y = groundHeight(pd.x, pd.z);
      const top = new THREE.Mesh(build([part(Ico(0.45, 0), 0xdfe9ff, { y: 1.75 })]), glowMaterial(0x8fb8ff, 0.1));
      const base = new THREE.Mesh(build([part(Cyl(0.8, 1.0, 1.3, 8), 0x9b938a, { y: 0.65 }), part(Cyl(0.9, 0.9, 0.15, 8), 0x7a7268, { y: 1.35 })]), propMaterial);
      base.castShadow = true;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 120, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      beam.position.y = 62; beam.visible = false;
      const grp = new THREE.Group(); grp.add(base, top, beam); grp.position.set(pd.x, y, pd.z); g.scene.add(grp);
      g.world.colliders.addCylinder(pd.x, pd.z, 0.9, y, y + 1.4, { walkable: true });
      const P = { ...pd, y, top, beam, on: false };
      this.ped.list.push(P);
      g.interact.add({
        pos: { x: pd.x, y, z: pd.z }, radius: 2.4,
        label: () => (g.state.has('shards', 'stars') ? null : tr('触摸石台（{0}）', [names[pd.id]])),
        action: async () => {
          if (g.sky.night < 0.5) { g.hud.toast(tr('石台上刻着{0}。白天它没有任何反应。', [names[pd.id]])); return; }
          if (P.on) return;
          const want = order[this.ped.seq.length];
          if (pd.id !== want) {
            g.audio.play('fail');
            g.hud.toast(tr('星光熄灭了……顺序好像不对。'));
            this.ped.seq = [];
            for (const q of this.ped.list) { q.on = false; q.top.material.emissiveIntensity = 0.1; q.beam.visible = false; }
            return;
          }
          P.on = true; this.ped.seq.push(pd.id);
          P.top.material.emissiveIntensity = 2.4; P.beam.visible = true;
          g.audio.play('star');
          if (this.ped.seq.length === 3) {
            g.hud.toast(tr('三道星光连成了一线！'));
            const ob = g.content.observatory;
            await g.wait(0.8);
            g.collect.awardShard('stars', { x: ob.x, y: groundHeight(ob.x, ob.z) + 9, z: ob.z });
          }
        },
      });
    }
  }

  // ---------------- Spirit fox ----------------
  _buildFox() {
    const g = this.g;
    const trail = g.content.foxTrail;
    this.fox = { obj: createAnimal('spiritfox'), i: 0, moving: false, done: !!g.state.flag('fox_done'), t: 0 };
    const f = this.fox;
    f.obj.position.set(trail[0].x, trail[0].y, trail[0].z);
    f.obj.visible = !f.done;
    g.scene.add(f.obj);
    g.codexLive.push({ id: 'spiritfox', obj: f.obj });
  }

  _updateFox(dt, t) {
    const f = this.fox, g = this.g;
    if (f.done) return;
    const trail = g.content.foxTrail, p = g.player.pos, o = f.obj;
    if (Math.random() < dt * 6) g.fx.emit(o.position.x, o.position.y + 0.6, o.position.z, 1, { color: 0x9fe6ff, speed: 0.5, gravity: -0.5, size: 0.3 });
    if (!f.moving) {
      o.position.y = groundHeight(o.position.x, o.position.z);
      const d = Math.hypot(p.x - o.position.x, p.z - o.position.z);
      if (d < 7) {
        if (f.i >= trail.length - 1) {
          f.done = true; g.state.flag('fox_done', true);
          g.fx.emit(o.position.x, o.position.y + 0.5, o.position.z, 40, { color: 0x9fe6ff, speed: 4 });
          o.visible = false;
          g.hud.toast(tr('星光狐消失了，它留下了什么东西……'));
          g.collect.spawnShard('fox', { x: o.position.x, y: o.position.y + 1.3, z: o.position.z });
          return;
        }
        f.moving = true; f.i++;
      } else {
        o.rotation.y = angleLerp(o.rotation.y, Math.atan2(p.x - o.position.x, p.z - o.position.z), dt * 3);
      }
      return;
    }
    const tgt = trail[f.i];
    const dx = tgt.x - o.position.x, dz = tgt.z - o.position.z, d = Math.hypot(dx, dz);
    if (d < 0.5) { f.moving = false; return; }
    const sp = 8.5 * dt;
    o.position.x += (dx / d) * Math.min(sp, d);
    o.position.z += (dz / d) * Math.min(sp, d);
    o.position.y = groundHeight(o.position.x, o.position.z);
    o.rotation.y = Math.atan2(dx, dz);
    for (const [k, l] of (o.userData.legs || []).entries()) l.rotation.x = Math.sin(t * 18 + k * Math.PI) * 0.7;
  }

  // ---------------- Lost sheep ----------------
  _buildSheep() {
    const g = this.g;
    const q = g.state.quest('mia');
    q.penned = q.penned || [];
    const pen = g.content.pen;
    this.sheep = g.content.lostSheep.map((pos, i) => {
      const obj = createAnimal('sheep');
      const penned = q.penned.includes(i);
      const a = i * 2.1;
      const home = penned ? { x: pen.x + Math.cos(a) * 3, z: pen.z + Math.sin(a) * 3 } : { x: pos.x, z: pos.z };
      obj.position.set(home.x, groundHeight(home.x, home.z), home.z);
      g.scene.add(obj);
      const s = { i, obj, penned, following: false, home };
      g.interact.add({
        pos: obj.position, radius: 2.4,
        label: () => (s.penned || s.following ? null : tr('带上走失的羊')),
        action: async () => { s.following = true; g.audio.play('sheep'); g.hud.toast(tr('羊跟在你身后了，把它带回米娅的羊圈吧。')); },
      });
      return s;
    });
  }

  _updateSheep(dt, t) {
    const g = this.g, p = g.player.pos, pen = g.content.pen;
    let k = 0;
    for (const s of this.sheep) {
      const o = s.obj;
      if (s.following) {
        k++;
        const back = 2.5 + k * 1.6;
        const tx = p.x - Math.sin(g.player.yaw) * back, tz = p.z - Math.cos(g.player.yaw) * back;
        const dx = tx - o.position.x, dz = tz - o.position.z, d = Math.hypot(dx, dz);
        if (d > 45) { o.position.x = tx; o.position.z = tz; }
        else if (d > 0.6) {
          const sp = Math.min(d * 2.2, 11) * dt;
          o.position.x += (dx / d) * sp; o.position.z += (dz / d) * sp;
          o.rotation.y = angleLerp(o.rotation.y, Math.atan2(dx, dz), dt * 6);
          for (const [i, l] of (o.userData.legs || []).entries()) l.rotation.x = Math.sin(t * 14 + i * Math.PI) * 0.6;
        }
        o.position.y = Math.max(groundHeight(o.position.x, o.position.z), 0);
        if (Math.hypot(o.position.x - pen.x, o.position.z - pen.z) < pen.r - 1) {
          s.following = false; s.penned = true;
          const q = g.state.quest('mia');
          if (!q.penned.includes(s.i)) q.penned.push(s.i);
          g.audio.play('sheep');
          g.hud.toast(tr('羊回到了羊圈（{0}/3）', [q.penned.length]));
          if (q.penned.length === 3) g.hud.toast(tr('三只羊都回来了！去告诉米娅吧。'), 4000);
          g.state.save();
        }
      } else if (s.penned) {
        o.rotation.y += Math.sin(t * 0.5 + s.i) * dt * 0.5;
      }
    }
  }

  // ---------------- Foot race with Tiao ----------------
  startRace(npc) { this.pendingRace = npc; }

  async _runRace(npc) {
    const g = this.g;
    const arch = g.world.anchors.arch;
    const start = { x: npc.pos.x, z: npc.pos.z };
    const pl = g.player;
    this.race = { npc, start, t: 0, phase: 'count' };
    g.audio.setMood('tense');
    for (const n of ['3', '2', '1']) { g.hud.banner(n, tr('目标：红石拱门'), 900); g.audio.play('tick'); await g.wait(1); }
    g.hud.banner(tr('出发！'), '', 800); g.audio.play('go');
    this.race.phase = 'run';
    this.race.t = 0;
  }

  _updateRace(dt, t) {
    const R = this.race, g = this.g;
    if (!R) {
      if (this.pendingRace && !g.busy()) { const n = this.pendingRace; this.pendingRace = null; this._runRace(n); }
      return;
    }
    if (R.phase !== 'run') return;
    R.t += dt;
    const arch = g.world.anchors.arch, n = R.npc;
    g.hud.setRace(tr('峡谷赛跑'), R.t.toFixed(1));
    const dx = arch.x - n.pos.x, dz = arch.z - n.pos.z, d = Math.hypot(dx, dz);
    const sp = 9.0 * dt;
    if (d > 2) {
      n.pos.x += (dx / d) * sp; n.pos.z += (dz / d) * sp;
      n.pos.y = Math.max(0, groundHeight(n.pos.x, n.pos.z));
      n.override = 'walk'; n.animSpeed = 9;
      n.ch.root.rotation.y = Math.atan2(dx, dz);
    }
    const pd = Math.hypot(arch.x - g.player.pos.x, arch.z - g.player.pos.z);
    const finish = async (win) => {
      R.phase = 'done';
      g.hud.setRace(null);
      g.audio.setMood(g.moodNow());
      n.animSpeed = 0;
      n.override = win ? 'idle' : 'cheer';
      if (win) {
        g.audio.play('fanfare');
        g.hud.toast(tr('你赢了！用时 {0} 秒', [R.t.toFixed(1)]));
        if (g.collect.awardShard('race', g.player.pos)) {
          g.state.add('hats', 'cap');
          setTimeout(() => g.hud.toast(tr('跳跳把他的跑步帽送给了你！')), 2500);
        }
      } else {
        g.audio.play('fail');
        g.hud.toast(tr('跳跳：「哈哈，我赢啦！不服再来！」'));
      }
      await g.wait(3);
      const back = R.start;
      n.pos.set(back.x, groundHeight(back.x, back.z), back.z);
      n.override = null;
      this.race = null;
    };
    if (pd < 7) finish(true);
    else if (d < 3) finish(false);
  }

  busy() { return !!(this.race && this.race.phase === 'count'); }

  update(dt, t) {
    this._updateCourse(dt);
    this._updateBoxes(dt);
    this._updateFox(dt, t);
    this._updateSheep(dt, t);
    this._updateRace(dt, t);
    for (const u of this.drafts) {
      u.mesh.rotation.y += dt * 1.5;
      if (Math.random() < dt * 10) this.g.fx.emit(u.x + (Math.random() - 0.5) * u.r * 1.6, u.base + Math.random() * 3, u.z + (Math.random() - 0.5) * u.r * 1.6, 1, { color: 0xffffff, speed: 0.3, gravity: -9, size: 0.35, life: 1.6 });
    }
  }
}
