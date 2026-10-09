// Shards, feathers, coins, chests, glowing mushrooms and treasure dig spots.
import * as THREE from 'three';
import { part, build, prim, propMaterial } from '../world/props.js';
import { resolveAnchor } from '../world/world.js';
import { groundHeight } from '../world/terrain.js';
import { SHARD_TOTAL, LIGHTHOUSE_COST, HATS } from './content.js';
import { t as tr } from '../i18n.js';

const { Cyl, Cone, Box, Ico } = prim;

function starGeometry() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.22 : 0.5, a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 1 });
  g.center();
  return g;
}

function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,240,170,1)'); gr.addColorStop(0.3, 'rgba(255,220,120,0.5)'); gr.addColorStop(1, 'rgba(255,200,80,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Collectibles {
  constructor(game) {
    this.g = game;
    const { scene, state, content, world } = game;
    const A = world.anchors;
    this.items = [];
    const starGeo = starGeometry();
    const starMat = new THREE.MeshStandardMaterial({ color: 0xffd84a, emissive: 0xffb81c, emissiveIntensity: 1.2, roughness: 0.3, metalness: 0.2 });
    const halo = new THREE.SpriteMaterial({ map: haloTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const featherGeo = build([
      part(Cone(0.18, 1.0, 6), 0xffe08a, { sx: 0.5, sz: 0.12, y: 0.1 }),
      part(Cyl(0.02, 0.02, 1.1, 4), 0xc99a2e, { y: 0 }),
    ]);
    const featherMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffc23a, emissiveIntensity: 0.9, flatShading: true });

    const makeShard = (def) => {
      const grp = new THREE.Group();
      const m = new THREE.Mesh(starGeo, starMat);
      m.castShadow = true;
      grp.add(m);
      const sp = new THREE.Sprite(halo); sp.scale.setScalar(2.4); grp.add(sp);
      grp.position.set(def.x, def.y, def.z);
      scene.add(grp);
      return grp;
    };
    // Shards
    for (const raw of content.shards) {
      if (raw.reward || !raw.x && !raw.anchor) {
        if (!raw.hidden) continue;
      }
      const def = raw.anchor ? resolveAnchor(raw, A) : raw;
      const it = { kind: 'shard', id: def.id, def, mesh: null, night: !!def.night, hidden: !!def.hidden };
      if (def.x !== undefined) { it.mesh = makeShard(def); }
      this.items.push(it);
    }
    this._makeShard = makeShard;
    // Feathers
    for (const raw of content.feathers) {
      if (raw.reward) continue;
      const def = raw.anchor ? resolveAnchor(raw, A) : raw;
      const grp = new THREE.Group();
      const m = new THREE.Mesh(featherGeo, featherMat); m.rotation.z = 0.4; m.castShadow = true; grp.add(m);
      const sp = new THREE.Sprite(halo); sp.scale.setScalar(1.6); grp.add(sp);
      grp.position.set(def.x, def.y, def.z);
      scene.add(grp);
      this.items.push({ kind: 'feather', id: def.id, def, mesh: grp });
    }
    // Coins (instanced shells)
    const shellGeo = build([part(Cone(0.32, 0.16, 8), 0xffb3c1, { rx: Math.PI / 2 }), part(Cone(0.2, 0.1, 8), 0xffe4e1, { rx: Math.PI / 2, z: 0.05 })]);
    const shellMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xff8fa8, emissiveIntensity: 0.35, flatShading: true });
    this.coins = content.coins.filter((c) => !state.data.coinsTaken.includes(c.id)).map((c) => ({ ...c, alive: true }));
    this.coinMesh = new THREE.InstancedMesh(shellGeo, shellMat, Math.max(1, this.coins.length));
    this.coinMesh.frustumCulled = false;
    scene.add(this.coinMesh);
    this._dummy = new THREE.Object3D();

    // Chests
    this.chests = [];
    for (const raw of content.chests) {
      const def = raw.anchor ? resolveAnchor(raw, A) : raw;
      const opened = state.data.chests.includes(def.id);
      const grp = new THREE.Group();
      const base = new THREE.Mesh(build([part(Box(1.1, 0.6, 0.75), 0x9a6a3a, { y: 0.3 }), part(Box(1.14, 0.1, 0.79), 0xd9a03a, { y: 0.5 }), part(Box(0.15, 0.2, 0.05), 0xd9a03a, { y: 0.45, z: 0.4 })]), propMaterial);
      const lid = new THREE.Group(); lid.position.set(0, 0.6, -0.375);
      const lm = new THREE.Mesh(build([part(Box(1.1, 0.3, 0.75), 0x8a5a2e, { y: 0.15, z: 0.375 }), part(Box(1.14, 0.08, 0.79), 0xd9a03a, { y: 0.28, z: 0.375 })]), propMaterial);
      lid.add(lm);
      base.castShadow = lm.castShadow = true;
      grp.add(base, lid);
      const y = def.y ?? groundHeight(def.x, def.z);
      grp.position.set(def.x, y, def.z);
      grp.rotation.y = Math.atan2(-def.x, -def.z);
      if (opened) lid.rotation.x = -1.9;
      scene.add(grp);
      const ch = { def, grp, lid, opened };
      this.chests.push(ch);
      game.interact.add({
        pos: { x: def.x, y, z: def.z }, radius: 2.2,
        label: () => (ch.opened ? null : tr('打开宝箱')),
        action: () => this.openChest(ch),
      });
      game.world.colliders.addBox(def.x, def.z, 0.55, 0.4, y, y + 0.9, grp.rotation.y, { walkable: true });
    }

    // Glow mushrooms
    const gmGeo = build([part(Cyl(0.06, 0.08, 0.3, 5), 0xd9f6ff, { y: 0.15 }), part(prim.Sph(0.2, 7, 4), 0x6ff7ff, { y: 0.32, sy: 0.6 })]);
    const gmMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0x3fe0ff, emissiveIntensity: 1.6 });
    this.glow = content.glowMushrooms.filter((m) => !state.data.flags['gm_' + m.id]).map((m) => {
      const mesh = new THREE.Mesh(gmGeo, gmMat); mesh.position.set(m.x, m.y, m.z); mesh.scale.setScalar(1.6); scene.add(mesh);
      return { ...m, mesh, alive: true };
    });

    // Dig spots
    for (const dg of content.digs) {
      game.interact.add({
        pos: { x: dg.x, y: dg.y, z: dg.z }, radius: 3.5, priority: -1,
        label: () => {
          const d = state.data;
          if (d.dug.includes(dg.id) || !d.maps.includes(dg.map)) return null;
          return d.abilities.shovel ? tr('挖掘') : null;
        },
        action: async () => {
          state.add('dug', dg.id);
          game.audio.play('dig');
          game.fx.emit(dg.x, dg.y + 0.3, dg.z, 30, { color: 0x9a7650, speed: 4, gravity: 9, size: 0.4 });
          game.player.animOverride = 'cheer';
          await game.wait(0.6);
          game.player.animOverride = null;
          this.spawnShard(dg.id, { x: dg.x, y: dg.y + 1.4, z: dg.z });
          game.hud.toast(tr('挖到宝藏了！'));
        },
      });
    }
    // Re-spawn any hidden shards that were revealed earlier but not collected.
    for (const it of this.items) if (it.kind === 'shard' && it.hidden && state.data.flags['spawn_' + it.id] && !state.has('shards', it.id)) {
      const p = state.data.flags['spawn_' + it.id];
      this.spawnShard(it.id, p, true);
    }
    this.syncVisibility();
  }

  syncVisibility() {
    const d = this.g.state.data;
    for (const it of this.items) {
      if (!it.mesh) continue;
      const taken = it.kind === 'shard' ? d.shards.includes(it.id) : d.feathers.includes(it.id);
      it.taken = taken;
      it.mesh.visible = !taken && !(it.night && this.g.sky.night < 0.5);
    }
  }

  spawnShard(id, pos, silent = false) {
    let it = this.items.find((i) => i.id === id && i.kind === 'shard');
    if (!it) { it = { kind: 'shard', id, def: { id } }; this.items.push(it); }
    if (this.g.state.has('shards', id)) return;
    it.def = { ...it.def, ...pos };
    if (it.mesh) this.g.scene.remove(it.mesh);
    it.mesh = this._makeShard(it.def);
    it.hidden = false;
    it.taken = false;
    this.g.state.data.flags['spawn_' + id] = { x: pos.x, y: pos.y, z: pos.z };
    if (!silent) {
      this.g.audio.play('star');
      this.g.fx.emit(pos.x, pos.y, pos.z, 50, { color: 0xffe066, speed: 6, gravity: 1, life: 1.4 });
    }
  }

  // Grant a shard directly (quest rewards), with a flourish at the given position.
  awardShard(id, at) {
    if (this.g.state.has('shards', id)) return false;
    const p = at || this.g.player.pos;
    this.g.fx.emit(p.x, p.y + 1.5, p.z, 60, { color: 0xffe066, speed: 6, gravity: 1, life: 1.4 });
    this.collectShard(id);
    return true;
  }

  collectShard(id) {
    const g = this.g, s = g.state;
    if (!s.add('shards', id)) return;
    const n = s.data.shards.length;
    g.audio.play('shard');
    g.hud.banner(tr('获得星屑！'), `${n} / ${SHARD_TOTAL}`);
    if (n === 3 && !s.data.abilities.glider) setTimeout(() => g.hud.toast(tr('已经有 3 颗星屑了，回村里找艾拉奶奶吧！'), 4000), 2600);
    if (n === LIGHTHOUSE_COST) setTimeout(() => g.hud.toast(tr('星屑够了！去霜顶雪山顶点亮灯塔吧！'), 5000), 2600);
    if (n === SHARD_TOTAL && !s.data.hats.includes('crown')) {
      s.add('hats', 'crown');
      setTimeout(() => g.hud.banner(tr('全部星屑收集完成！'), tr('获得了「星之王冠」，去菜单的装扮里戴上吧'), 4500), 3000);
    }
    s.save();
  }

  collectFeather(id) {
    const g = this.g, s = g.state;
    if (!s.add('feathers', id)) return;
    g.audio.play('feather');
    g.player.stamina = g.player.maxStamina;
    g.hud.banner(tr('获得金羽毛！'), tr('体力上限提升 · {0} / 15', [s.data.feathers.length]));
    s.save();
  }

  async openChest(ch) {
    const g = this.g, s = g.state, r = ch.def.reward;
    ch.opened = true;
    s.add('chests', ch.def.id);
    g.audio.play('chest');
    const t0 = performance.now();
    await new Promise((res) => {
      const tick = () => { const k = Math.min(1, (performance.now() - t0) / 400); ch.lid.rotation.x = -1.9 * k; k < 1 ? requestAnimationFrame(tick) : res(); };
      tick();
    });
    const p = ch.grp.position;
    g.fx.emit(p.x, p.y + 0.8, p.z, 40, { color: 0xffd84a, speed: 4, gravity: 3 });
    if (r.coins) { s.addCoins(r.coins); g.hud.banner(tr('获得 {0} 枚贝壳币', [r.coins]), ''); g.audio.play('coin'); }
    if (r.hat) { s.add('hats', r.hat); g.hud.banner(tr('获得帽子：{0}', [HATS[r.hat]]), tr('在菜单的「装扮」里可以戴上')); }
    if (r.map) {
      s.add('maps', r.map);
      const dg = g.content.digs.find((d) => d.map === r.map);
      g.hud.banner(tr('获得藏宝图！'), s.data.abilities.shovel ? tr('去地图上标记的地方挖宝吧') : tr('需要一把铲子才能挖宝（阿贝的店里有卖）'), 4000);
      setTimeout(() => g.hud.toast(dg.clue, 6000), 1500);
    }
    s.save();
  }

  update(dt, t) {
    const g = this.g, p = g.player.pos, d = g.state.data;
    const cy = p.y + 0.9;
    const night = g.sky.night > 0.5;
    for (const it of this.items) {
      if (!it.mesh || it.taken) continue;
      const vis = !(it.night && !night);
      it.mesh.visible = vis;
      if (!vis) continue;
      const m = it.mesh;
      m.children[0].rotation.y += dt * 2;
      m.position.y = it.def.y + Math.sin(t * 2 + it.def.x) * 0.15;
      const dx = m.position.x - p.x, dy = m.position.y - cy, dz = m.position.z - p.z;
      if (dx * dx + dz * dz < 2.6 && Math.abs(dy) < 1.8) {
        it.taken = true;
        m.visible = false;
        g.fx.emit(m.position.x, m.position.y, m.position.z, 40, { color: it.kind === 'shard' ? 0xffe066 : 0xffc23a, speed: 5, gravity: 1 });
        if (it.kind === 'shard') this.collectShard(it.id); else this.collectFeather(it.id);
      } else if (Math.random() < dt * 2) {
        g.fx.emit(m.position.x, m.position.y, m.position.z, 1, { color: 0xfff2a8, speed: 0.6, gravity: -0.5, size: 0.25, spread: 1.2 });
      }
    }
    // Coins
    const dm = this._dummy;
    let k = 0;
    for (const c of this.coins) {
      if (!c.alive) continue;
      const dx = c.x - p.x, dz = c.z - p.z, dy = c.y - cy;
      if (dx * dx + dz * dz < 2.0 && Math.abs(dy) < 1.6) {
        c.alive = false;
        d.coinsTaken.push(c.id);
        g.state.addCoins(1);
        g.audio.play('coin');
        g.fx.emit(c.x, c.y, c.z, 8, { color: 0xffb3c1, speed: 2.5, size: 0.25 });
        continue;
      }
      dm.position.set(c.x, c.y + Math.sin(t * 3 + c.x) * 0.1, c.z);
      dm.rotation.set(0, t * 2 + c.z, 0);
      dm.updateMatrix();
      this.coinMesh.setMatrixAt(k++, dm.matrix);
    }
    this.coinMesh.count = k;
    this.coinMesh.instanceMatrix.needsUpdate = true;
    // Glow mushrooms (auto pickup)
    for (const m of this.glow) {
      if (!m.alive) continue;
      m.mesh.rotation.y += dt;
      if (Math.hypot(m.x - p.x, m.z - p.z) < 1.6) {
        m.alive = false; m.mesh.visible = false;
        d.flags['gm_' + m.id] = true;
        d.items.mushrooms++;
        g.audio.play('feather');
        g.fx.emit(m.x, m.y + 0.4, m.z, 20, { color: 0x6ff7ff, speed: 3 });
        g.hud.toast(tr('发光蘑菇 {0}/5', [d.items.mushrooms]));
      }
    }
    // Sparkle hint near dig spots when you own the map
    for (const dg of g.content.digs) {
      if (!d.maps.includes(dg.map) || d.dug.includes(dg.id)) continue;
      if (Math.hypot(dg.x - p.x, dg.z - p.z) < 14 && Math.random() < dt * 4) g.fx.emit(dg.x, dg.y + 0.2, dg.z, 1, { color: 0xfff2a8, speed: 1, size: 0.3, spread: 1.5, gravity: -1 });
    }
  }

  // Nearest uncollected, currently-obtainable world shard (for the compass).
  nearestShard(p) {
    let best = null, bd = Infinity;
    for (const it of this.items) {
      if (it.kind !== 'shard' || !it.mesh || it.taken || !it.mesh.visible) continue;
      const d = Math.hypot(it.def.x - p.x, it.def.z - p.z);
      if (d < bd) { bd = d; best = it; }
    }
    return best ? { x: best.def.x, z: best.def.z, d: bd } : null;
  }
}
