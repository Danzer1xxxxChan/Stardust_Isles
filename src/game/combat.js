// Combat: sword combo / plunge / dodge roll, player health, enemy + wildlife targets, hit feedback
// (hit-stop, flash, sparks, sword trail, shockwaves, damage numbers), health bars and spawning.
import * as THREE from 'three';
import { Enemy, enemyLevelAt } from './enemies.js';
import { groundHeight, groundNormal, waterLevel, frontierWeight, biomeAt } from '../world/terrain.js';
import { VILLAGE, DARK_FOREST, WORLD_HALF } from '../world/layout.js';
import { CHUNK_SIZE } from '../world/terrainMesh.js';
import { clamp } from '../core/math.js';
import { part, build, prim, propMaterial } from '../world/props.js';
import { t as tr } from '../i18n.js';

const $ = (s) => document.querySelector(s);
const SWINGS = {
  atk1: { dur: 0.34, hitAt: 0.42, dmg: 14, arc: 0.3, reach: 2.5, knock: 5 },
  atk2: { dur: 0.34, hitAt: 0.42, dmg: 16, arc: 0.3, reach: 2.5, knock: 6 },
  atk3: { dur: 0.56, hitAt: 0.5, dmg: 26, arc: -1.1, reach: 2.9, knock: 11, heavy: true },
};
const COMBO = ['atk1', 'atk2', 'atk3'];
const FLASH = new THREE.MeshBasicMaterial({ color: 0xffffff });

class SwordTrail {
  constructor(scene) {
    this.N = 18;
    this.base = []; this.tip = []; this.age = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(this.N * 2 * 3);
    this.alpha = new Float32Array(this.N * 2);
    this.side = new Float32Array(this.N * 2);
    for (let i = 0; i < this.N; i++) { this.side[i * 2] = 0; this.side[i * 2 + 1] = 1; }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('side', new THREE.BufferAttribute(this.side, 1));
    const idx = [];
    for (let i = 0; i < this.N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: new THREE.Color(0x8fe4ff) } },
      vertexShader: 'attribute float alpha; attribute float side; varying float vA; varying float vS; void main(){ vA = alpha; vS = side; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uCol; varying float vA; varying float vS; void main(){ float a = vA * smoothstep(0.0, 1.0, vS); vec3 c = mix(uCol, vec3(1.0), vS * vS) * (1.5 + vS * 2.5); gl_FragColor = vec4(c * a, a); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  push(b, t) {
    this.base.unshift(b.clone()); this.tip.unshift(t.clone()); this.age.unshift(0);
    if (this.base.length > this.N) { this.base.pop(); this.tip.pop(); this.age.pop(); }
  }

  update(dt, color) {
    if (color) this.mat.uniforms.uCol.value.set(color);
    for (let i = 0; i < this.age.length; i++) this.age[i] += dt;
    while (this.age.length && this.age[this.age.length - 1] > 0.16) { this.base.pop(); this.tip.pop(); this.age.pop(); }
    const n = this.base.length;
    this.mesh.visible = n > 1;
    for (let i = 0; i < this.N; i++) {
      const k = Math.min(i, n - 1);
      const b = this.base[k], t = this.tip[k];
      if (!b) continue;
      this.pos.set([b.x, b.y, b.z, t.x, t.y, t.z], i * 6);
      const a = i < n ? (1 - this.age[k] / 0.16) * (1 - i / this.N) : 0;
      this.alpha[i * 2] = a; this.alpha[i * 2 + 1] = a;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.alpha.needsUpdate = true;
  }
}

export class Combat {
  constructor(game) {
    this.g = game;
    this.enemies = [];
    this.hp = this.maxHp;
    this.playerAlive = true;
    this.invuln = 0;
    this.lastHurt = -99;
    this.armedT = 0;
    this.swing = null;
    this.queued = false;
    this.comboStep = 0;
    this.comboT = 0;
    this.dodge = null;
    this.plunge = false;
    this.trail = new SwordTrail(game.scene);
    this.rings = [];
    this.orbs = [];
    this.flashes = [];
    this.chests = [];
    this.nightT = 2;
    this.inCombat = false;
    this._v1 = new THREE.Vector3(); this._v2 = new THREE.Vector3(); this._v3 = new THREE.Vector3();
    // UI
    this.hpFill = $('#hp-fill'); this.hpGhost = $('#hp-ghost'); this.hpText = $('#hp-text');
    this.barLayer = $('#bars'); this.dmgLayer = $('#dmg-layer');
    this.barPool = []; this.dmgNums = [];
    this._ghost = 1;
    this.ringGeo = new THREE.RingGeometry(0.82, 1, 64).rotateX(-Math.PI / 2);
    const orbC = document.createElement('canvas'); orbC.width = orbC.height = 64;
    const x = orbC.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(140,255,170,0.9)'); gr.addColorStop(1, 'rgba(80,255,140,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    this.orbMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(orbC), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    this.chestGeo = build([
      part(prim.Box(1.1, 0.6, 0.75), 0x4a3a5a, { y: 0.3 }), part(prim.Box(1.14, 0.1, 0.79), 0x9fd3ff, { y: 0.5 }),
      part(prim.Box(1.1, 0.3, 0.75), 0x3a2a4a, { y: 0.75 }), part(prim.Box(1.14, 0.08, 0.79), 0x9fd3ff, { y: 0.88 }), part(prim.Box(0.15, 0.2, 0.05), 0xf2c94c, { y: 0.62, z: 0.4 }),
    ]);
    // Wire up streaming far isles
    const fr = game.world.frontier;
    fr.onEnter = (c) => this._chunkEnter(c);
    fr.onLeave = (c) => this._chunkLeave(c);
  }

  get maxHp() { return 100 + this.g.state.data.feathers.length * 6; }
  get dmgMult() { return 1 + this.g.state.data.shards.length * 0.045; }

  // ---------- Targets ----------
  targets() {
    const out = [];
    for (const e of this.enemies) if (e.alive) out.push(e);
    for (const c of this.g.creatures.targets()) out.push(c);
    return out;
  }

  // ---------- Per frame ----------
  update(dt, rdt) {
    const g = this.g, I = g.input, P = g.player, d = g.state.data;
    const canAct = this.playerAlive && !g.busy() && !P.frozen;
    this.invuln = Math.max(0, this.invuln - dt);
    this.armedT = Math.max(0, this.armedT - dt);
    // Input
    if (canAct) {
      const atk = I.wasPressed('KeyJ') || I.attackClick;
      if (I.wasPressed('KeyQ')) this._startDodge();
      if (atk) {
        if ((P.mode === 'air' || P.mode === 'glide') && P.pos.y - groundHeight(P.pos.x, P.pos.z) > 1.6 && !this.plunge) this._startPlunge();
        else if (P.mode === 'ground' && !this.dodge) {
          if (!this.swing) this._startSwing(COMBO[this.comboT > 0 ? this.comboStep : 0]);
          else if (this.swing.t / this.swing.dur > 0.3) this.queued = true;
        }
      }
    }
    // Swing progression
    if (this.swing) {
      const s = this.swing;
      s.t += dt;
      const k = s.t / s.dur;
      if (!s.hit && k >= s.def.hitAt) { s.hit = true; this._resolveSwing(s); }
      P.atkPose = { kind: s.kind, k: Math.min(1, k) };
      if (k >= 1) {
        const idx = COMBO.indexOf(s.kind);
        this.swing = null;
        P.moveScale = 1;
        if (this.queued && idx < 2 && P.mode === 'ground') { this.queued = false; this._startSwing(COMBO[idx + 1]); }
        else { this.queued = false; this.comboStep = idx >= 2 ? 0 : idx + 1; this.comboT = idx >= 2 ? 0 : 0.45; P.atkPose = null; }
      }
      if (P.mode !== 'ground' && this.swing) { this.swing = null; P.atkPose = null; P.moveScale = 1; }
    } else if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.comboStep = 0; }
    if (this.dodge) {
      this.dodge.t += dt;
      P.atkPose = { kind: 'roll', k: this.dodge.t / this.dodge.dur };
      if (this.dodge.t >= this.dodge.dur) { this.dodge = null; P.atkPose = null; }
    }
    if (this.plunge) {
      P.atkPose = { kind: 'plunge', k: 0.15 };
      if (P.mode === 'swim' || P.mode === 'climb') { this.plunge = false; P.atkPose = null; }
    }
    P.char.setArmed(this.armedT > 0 || !!this.swing || this.plunge);
    // Trail
    const swinging = (this.swing && this.swing.t / this.swing.dur > 0.08 && this.swing.t / this.swing.dur < 0.9) || this.plunge;
    if (swinging) {
      P.char.swordBase.getWorldPosition(this._v1); P.char.swordTip.getWorldPosition(this._v2);
      this.trail.push(this._v1, this._v2);
    }
    this.trail.update(rdt, this.swing?.kind === 'atk3' ? 0xffd86a : 0x8fe4ff);
    // Regen
    if (this.playerAlive && g.clock - this.lastHurt > 5 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + dt * (this.inCombat ? 2 : 7));
    // Enemies
    let combat = false;
    const pp = P.pos;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const dd = Math.hypot(e.pos.x - pp.x, e.pos.z - pp.z);
      if (dd > 170 && e.alive) { e.obj.visible = dd < 400; continue; }
      e.obj.visible = true;
      const keep = e.update(dt);
      if (e.aggroed && dd < 45) combat = true;
      if (!keep) { e.dispose(); this.enemies.splice(i, 1); }
    }
    this.inCombat = combat;
    this._effects(dt, rdt);
    this._nightSpawns(dt);
    this._chestsUpdate();
    this._ui(dt);
  }

  // ---------- Player actions ----------
  _aimDir() {
    const g = this.g, P = g.player, ax = g.input.axis();
    const f = g.cam.forward(), r = g.cam.right();
    let mx = f.x * ax.y + r.x * ax.x, mz = f.z * ax.y + r.z * ax.x;
    const l = Math.hypot(mx, mz);
    if (l > 0.1) return { x: mx / l, z: mz / l };
    return { x: Math.sin(P.yaw), z: Math.cos(P.yaw) };
  }

  _startSwing(kind) {
    const g = this.g, P = g.player;
    const def = SWINGS[kind];
    this.swing = { kind, def, dur: def.dur, t: 0, hit: false };
    this.armedT = 4;
    P.moveScale = 0.12;
    // Soft lock-on: turn toward the best target in front.
    const aim = this._aimDir();
    let best = null, bs = Infinity;
    for (const t of this.targets()) {
      const dx = t.obj.position.x - P.pos.x, dz = t.obj.position.z - P.pos.z, d = Math.hypot(dx, dz);
      if (d > 6 + t.radius || Math.abs(t.obj.position.y - P.pos.y) > 3) continue;
      const dot = (dx * aim.x + dz * aim.z) / (d || 1);
      if (dot < 0.2 && d > 2) continue;
      const score = d - dot * 2 - (t.hostile ? 1.5 : 0);
      if (score < bs) { bs = score; best = { dx, dz, d, t }; }
    }
    let dir = aim;
    if (best) dir = { x: best.dx / (best.d || 1), z: best.dz / (best.d || 1) };
    P.yaw = Math.atan2(dir.x, dir.z);
    P.char.root.rotation.y = P.yaw;
    const lunge = best ? clamp(best.d - best.t.radius - 1.2, 0, 3) * 7 : 3.5;
    P.dash = { vx: dir.x * lunge, vz: dir.z * lunge, t: 0.12 };
    g.audio.play('swing', kind === 'atk3' ? 1 : 0);
  }

  _startPlunge() {
    const g = this.g, P = g.player;
    this.plunge = true;
    this.armedT = 4;
    P.vel.y = -34; P.vel.x *= 0.2; P.vel.z *= 0.2;
    if (P.mode === 'glide') P.mode = 'air';
    g.audio.play('swing', 1);
  }

  _startDodge() {
    const g = this.g, P = g.player;
    if (this.dodge || P.mode !== 'ground' || P.stamina < 0.8) return;
    const ax = g.input.axis();
    let dir = this._aimDir();
    if (Math.hypot(ax.x, ax.y) < 0.1) dir = { x: -Math.sin(P.yaw), z: -Math.cos(P.yaw) };
    this.swing = null; this.queued = false; P.moveScale = 1;
    this.dodge = { t: 0, dur: 0.42 };
    this.invuln = Math.max(this.invuln, 0.34);
    P.stamina -= 0.9;
    P.yaw = Math.atan2(dir.x, dir.z);
    P.dash = { vx: dir.x * 13, vz: dir.z * 13, t: 0.36 };
    g.audio.play('dodge');
    g.fx.emit(P.pos.x, P.pos.y + 0.2, P.pos.z, 10, { color: 0xd8c8a8, speed: 2.5, gravity: 1, size: 0.5, up: 0.3 });
  }

  // Called from the game's 'land' player event.
  onLand() {
    if (!this.plunge) return;
    const g = this.g, P = g.player;
    this.plunge = false;
    P.atkPose = null;
    const p = P.pos;
    this.shockwave(p.x, p.y, p.z, 4.2, 0x8fe4ff);
    g.fx.emit(p.x, p.y + 0.3, p.z, 50, { color: 0x9fe8ff, speed: 8, gravity: 6, size: 0.55, up: 1.0 });
    g.fx.emit(p.x, p.y + 0.2, p.z, 30, { color: 0xd8c8a8, speed: 5, gravity: 8, size: 0.7, up: 0.8 });
    g.cam.shake = 0.8;
    g.audio.play('slam');
    for (const t of this.targets()) {
      const dx = t.obj.position.x - p.x, dz = t.obj.position.z - p.z, dd = Math.hypot(dx, dz);
      if (dd > 4.0 + t.radius || Math.abs(t.obj.position.y - p.y) > 2.5) continue;
      this._damage(t, 30, { x: dx / (dd || 1), z: dz / (dd || 1) }, { knock: 12, heavy: true });
    }
    this.hitstop(0.08);
  }

  _resolveSwing(s) {
    const g = this.g, P = g.player, p = P.pos;
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    let hits = 0;
    for (const t of this.targets()) {
      const dx = t.obj.position.x - p.x, dz = t.obj.position.z - p.z, dd = Math.hypot(dx, dz);
      if (dd > s.def.reach + t.radius || Math.abs(t.obj.position.y - p.y) > 2.2) continue;
      const dot = (dx * fx + dz * fz) / (dd || 1);
      if (dot < s.def.arc && dd > t.radius + 0.4) continue;
      this._damage(t, s.def.dmg, { x: dx / (dd || 1), z: dz / (dd || 1) }, s.def);
      hits++;
    }
    if (hits) this.hitstop(s.kind === 'atk3' ? 0.09 : 0.055);
  }

  _damage(t, base, dir, info) {
    const g = this.g;
    const crit = Math.random() < 0.15;
    const dmg = Math.max(1, Math.round(base * this.dmgMult * (0.9 + Math.random() * 0.2) * (crit ? 1.8 : 1)));
    const wasAlive = t.alive;
    t.onHit(dmg, dir, info);
    const hp = t.obj.position;
    const hy = hp.y + t.height * 0.6;
    g.fx.emit(hp.x, hy, hp.z, crit ? 26 : 14, { color: crit ? 0xffe27a : 0xbff0ff, speed: crit ? 9 : 6, gravity: 6, size: 0.32, life: 0.45 });
    g.fx.emit(hp.x, hy, hp.z, 6, { color: 0xffffff, speed: 2, gravity: 0, size: 0.9, life: 0.18 });
    this.flash(t.obj);
    this.number(hp.x, hy + 0.6, hp.z, dmg, crit ? 'crit' : 'hit');
    g.cam.shake = Math.max(g.cam.shake, crit ? 0.45 : 0.25);
    g.audio.play(crit ? 'crit' : 'hit');
    if (crit) g.post.flash = 0.08;
    if (wasAlive && !t.alive) this._killed(t);
  }

  _killed(t) {
    const g = this.g, p = t.obj.position;
    if (t instanceof Enemy) {
      const coins = t.def.coins * t.level + Math.floor(Math.random() * 3);
      g.state.addCoins(coins);
      this.number(p.x, p.y + t.height + 0.6, p.z, `+${coins} 🐚`, 'coin');
      g.fx.emit(p.x, p.y + t.height * 0.5, p.z, 60, { color: 0xb48cff, speed: 6, gravity: -1.5, size: 0.5, life: 1.2 });
      g.fx.emit(p.x, p.y + t.height * 0.5, p.z, 30, { color: 0xffffff, speed: 3, gravity: -3, size: 0.35, life: 1.4 });
      g.audio.play('enemyDie');
      if (Math.random() < (t.elite ? 1 : 0.3)) this._dropOrb(p.x, p.y + 1, p.z, t.elite ? 40 : 15);
      if (t.elite) { g.hud.toast(tr('击败了 Lv.{0} {1}！', [t.level, t.name])); this.hitstop(0.15); }
    } else {
      g.state.addCoins(1);
      this.number(p.x, p.y + t.height + 0.4, p.z, '+1 🐚', 'coin');
      g.audio.play('poof');
    }
  }

  hitstop(s) { this.g.hitstop = Math.max(this.g.hitstop || 0, s); }

  flash(obj) {
    const list = [];
    obj.traverse((m) => { if (m.isMesh && !m.userData.flashing) { m.userData.flashing = true; list.push([m, m.material]); m.material = FLASH; } });
    if (list.length) this.flashes.push({ list, t: 0.075 });
  }

  hurtPlayer(dmg, from, knock = 6) {
    const g = this.g, P = g.player;
    if (!this.playerAlive || g.cutscene) return;
    if (this.invuln > 0) {
      if (this.dodge) { this.number(P.pos.x, P.pos.y + 2.2, P.pos.z, tr('闪避'), 'dodge'); g.audio.play('perfect'); }
      return;
    }
    this.hp -= dmg;
    this.lastHurt = g.clock;
    this.invuln = 0.6;
    this.swing = null; this.queued = false; P.moveScale = 1;
    const dx = P.pos.x - from.x, dz = P.pos.z - from.z, l = Math.hypot(dx, dz) || 1;
    P.dash = { vx: (dx / l) * knock, vz: (dz / l) * knock, t: 0.18 };
    P.hurtT = 0.32;
    g.post.hurt = 1;
    g.cam.shake = Math.max(g.cam.shake, 0.55);
    g.audio.play('hurt');
    this.number(P.pos.x, P.pos.y + 2.2, P.pos.z, dmg, 'player');
    g.fx.emit(P.pos.x, P.pos.y + 1.1, P.pos.z, 16, { color: 0xff6a6a, speed: 5, gravity: 6, size: 0.35, life: 0.5 });
    if (this.hp <= 0) this._die();
  }

  async _die() {
    const g = this.g, P = g.player, d = g.state.data;
    this.hp = 0;
    this.playerAlive = false;
    this.swing = null; this.dodge = null; this.plunge = false;
    P.frozen = true; P.animOverride = 'down'; P.atkPose = null;
    g.audio.play('die');
    g.hud.banner(tr('你倒下了……'), tr('星光会指引你回到营火旁'), 2400);
    await g.wait(2.2);
    await g.fade(true);
    const lit = g.world.campfires.filter((c) => d.campfires.includes(c.id));
    let best = lit[0] || g.world.campfires[0], bd = Infinity;
    for (const c of lit) { const dd = Math.hypot(c.x - P.pos.x, c.z - P.pos.z); if (dd < bd) { bd = dd; best = c; } }
    const lost = Math.min(d.coins, Math.min(50, Math.max(5, Math.floor(d.coins * 0.1))));
    g.state.addCoins(-lost);
    for (const e of this.enemies) if (e.alive) { e.state = 'idle'; e.hp = e.maxHp; }
    P.animOverride = null;
    await g.fastTravel(best, true);
    this.hp = this.maxHp;
    this.playerAlive = true;
    P.frozen = false;
    g.hud.toast(tr('在{0}醒来了。{1}', [best.name, lost ? tr('遗失了 {0} 枚贝壳币。', [lost]) : '']), 4000);
  }

  // ---------- Effects ----------
  shockwave(x, y, z, r, color) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, y + 0.2, z);
    this.g.scene.add(m);
    this.rings.push({ m, t: 0, dur: 0.4, r });
  }

  _dropOrb(x, y, z, heal) {
    const s = new THREE.Sprite(this.orbMat);
    s.scale.setScalar(0.9);
    s.position.set(x, y, z);
    this.g.scene.add(s);
    this.orbs.push({ s, heal, t: 0, vy: 4 });
  }

  _effects(dt, rdt) {
    const g = this.g, pp = g.player.pos;
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += rdt;
      const k = r.t / r.dur;
      r.m.scale.setScalar(0.3 + k * r.r);
      r.m.material.opacity = 1 - k;
      if (k >= 1) { g.scene.remove(r.m); r.m.material.dispose(); this.rings.splice(i, 1); }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t -= rdt;
      if (f.t <= 0) { for (const [m, mat] of f.list) { m.material = mat; m.userData.flashing = false; } this.flashes.splice(i, 1); }
    }
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i], s = o.s;
      o.t += dt;
      const gy = groundHeight(s.position.x, s.position.z) + 0.8;
      o.vy -= 9 * dt; s.position.y = Math.max(gy, s.position.y + o.vy * dt);
      if (s.position.y <= gy) o.vy = Math.abs(o.vy) * 0.4;
      s.scale.setScalar(0.8 + Math.sin(o.t * 6) * 0.12);
      const dx = pp.x - s.position.x, dy = pp.y + 1 - s.position.y, dz = pp.z - s.position.z, d = Math.hypot(dx, dy, dz);
      if (d < 5 && this.playerAlive) { const sp = Math.min(d, dt * (6 + (5 - d) * 4)); s.position.x += (dx / d) * sp; s.position.y += (dy / d) * sp; s.position.z += (dz / d) * sp; }
      if (d < 0.9 && this.playerAlive) {
        this.hp = Math.min(this.maxHp, this.hp + o.heal);
        this.number(pp.x, pp.y + 2.2, pp.z, `+${o.heal}`, 'heal');
        g.audio.play('heal');
        g.fx.emit(pp.x, pp.y + 1, pp.z, 20, { color: 0x8dffb0, speed: 2.5, gravity: -3, size: 0.4, life: 0.9 });
        g.scene.remove(s); this.orbs.splice(i, 1);
      } else if (o.t > 25) { g.scene.remove(s); this.orbs.splice(i, 1); }
    }
  }

  // ---------- Spawning ----------
  spawn(kind, x, z, level, biome, tag) {
    const e = new Enemy(this.g, kind, x, z, level, biome);
    e.tag = tag;
    this.enemies.push(e);
    return e;
  }

  _chunkEnter(c) {
    const rng = c.data.rng, spots = c.data.spots || [];
    const cx = -WORLD_HALF + (c.ci + 0.5) * CHUNK_SIZE, cz = -WORLD_HALF + (c.cj + 0.5) * CHUNK_SIZE;
    c.data.tag = `${c.ci},${c.cj}`;
    if (!spots.length || frontierWeight(cx, cz) < 0.85) return;
    const lvl = enemyLevelAt(cx, cz);
    const g = this.g;
    const take = () => spots.splice(Math.floor(rng() * spots.length), 1)[0];
    // Gloom packs
    const groups = rng() < 0.45 ? (rng() < 0.25 ? 2 : 1) : 0;
    for (let k = 0; k < groups && spots.length; k++) {
      const s = take();
      const biome = biomeAt(s.x, s.z);
      const r = rng();
      if ((r < 0.16 && lvl >= 2) || (r < 0.08 && ['canyon', 'crystal', 'snow'].includes(biome))) this.spawn('golem', s.x, s.z, lvl + 1, biome, c.data.tag);
      else if (r < 0.55 && biome !== 'crystal') { const n = 1 + Math.floor(rng() * 2.5); for (let i = 0; i < n; i++) this.spawn('wolf', s.x + (rng() - 0.5) * 6, s.z + (rng() - 0.5) * 6, lvl, biome, c.data.tag); }
      else { const n = 2 + Math.floor(rng() * 2); for (let i = 0; i < n; i++) this.spawn('slime', s.x + (rng() - 0.5) * 7, s.z + (rng() - 0.5) * 7, lvl, biome, c.data.tag); }
    }
    // Wildlife
    if (spots.length && rng() < 0.6) {
      const s = take();
      const biome = biomeAt(s.x, s.z);
      const kinds = { meadow: ['sheep', 'deer'], forest: ['deer', 'fox'], snow: ['goat'], canyon: ['lizard', 'goat'], crystal: ['crab', 'frog'] }[biome] || ['sheep'];
      const kind = kinds[Math.floor(rng() * kinds.length)];
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) g.creatures.spawnWild(kind, s.x + (rng() - 0.5) * 8, s.z + (rng() - 0.5) * 8, c.data.tag);
    }
    // Far-isle treasure chest
    if (spots.length && rng() < 0.16) {
      const s = take();
      const id = `fc${c.ci},${c.cj}`;
      if (!g.state.data.farChests.includes(id)) this._addChest(id, s.x, s.y, s.z, lvl, c.data.tag);
    }
  }

  _chunkLeave(c) {
    const tag = c.data.tag;
    if (!tag) return;
    for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].tag === tag) { this.enemies[i].dispose(); this.enemies.splice(i, 1); }
    this.g.creatures.despawnTag(tag);
    for (let i = this.chests.length - 1; i >= 0; i--) if (this.chests[i].tag === tag) this._removeChest(this.chests[i]);
  }

  _addChest(id, x, y, z, lvl, tag) {
    const g = this.g;
    const m = new THREE.Mesh(this.chestGeo, propMaterial);
    m.position.set(x, y, z); m.rotation.y = Math.random() * 6.28; m.castShadow = true;
    g.scene.add(m);
    const light = new THREE.Sprite(this.orbMat); light.scale.setScalar(2.2); light.position.set(x, y + 1, z); light.material = this.orbMat.clone(); light.material.color.set(0x9fd3ff);
    g.scene.add(light);
    const ch = { id, m, light, tag, lvl };
    ch.it = g.interact.add({
      pos: { x, y, z }, radius: 2.4,
      label: () => (this.enemies.some((e) => e.alive && e.aggroed && Math.hypot(e.pos.x - x, e.pos.z - z) < 25) ? null : tr('打开远方宝箱')),
      action: async () => {
        const coins = (25 + Math.floor(Math.random() * 30)) * lvl;
        g.state.addCoins(coins);
        g.state.data.farChests.push(id);
        g.audio.play('chest');
        g.fx.emit(x, y + 1, z, 50, { color: 0x9fd3ff, speed: 5, gravity: 3, size: 0.45, life: 1.2 });
        this.number(x, y + 1.6, z, `+${coins} 🐚`, 'coin');
        if (Math.random() < 0.5) this._dropOrb(x, y + 1.4, z, 30);
        g.hud.toast(tr('远方宝箱里有 {0} 枚贝壳币！', [coins]));
        this._removeChest(ch);
        g.state.save();
      },
    });
    this.chests.push(ch);
  }

  _removeChest(ch) {
    const g = this.g;
    g.scene.remove(ch.m); g.scene.remove(ch.light);
    g.interact.remove(ch.it);
    this.chests.splice(this.chests.indexOf(ch), 1);
  }

  _chestsUpdate() {
    for (const ch of this.chests) ch.light.material.opacity = 0.55 + Math.sin(this.g.clock * 3 + ch.m.position.x) * 0.25;
  }

  _nightSpawns(dt) {
    const g = this.g, p = g.player.pos;
    this.nightT -= dt;
    if (this.nightT > 0) return;
    this.nightT = 2.5;
    const night = g.sky.night;
    const nightOnes = this.enemies.filter((e) => e.tag === 'night');
    if (night < 0.3) { for (const e of nightOnes) if (e.alive && !e.aggroed) e.die(); return; }
    if (night < 0.8 || nightOnes.length >= 3 || frontierWeight(p.x, p.z) > 0.3) return;
    if (Math.hypot(p.x - VILLAGE.x, p.z - VILLAGE.z) < VILLAGE.r + 55) return;
    const n = { x: 0, y: 1, z: 0 };
    for (let tries = 0; tries < 8; tries++) {
      const a = Math.random() * 6.28, r = 32 + Math.random() * 22;
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      const h = groundHeight(x, z);
      if (h < waterLevel(x, z) + 0.5) continue;
      if (groundNormal(x, z, n).y < 0.85) continue;
      if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r + 40) continue;
      if (Math.hypot(x - DARK_FOREST.x, z - DARK_FOREST.z) < DARK_FOREST.r - 20 && !g.state.data.abilities.lantern) continue;
      this.spawn('slime', x, z, 1, 'meadow', 'night');
      break;
    }
  }

  // ---------- UI ----------
  number(x, y, z, val, kind) {
    const el = document.createElement('div');
    el.className = 'dmg ' + kind;
    el.textContent = val;
    this.dmgLayer.appendChild(el);
    this.dmgNums.push({ el, x: x + (Math.random() - 0.5) * 0.6, y, z, t: 0, vx: (Math.random() - 0.5) * 30 });
  }

  _ui(dt) {
    const g = this.g, cam = g.camera, v = this._v3;
    // Player HP bar
    const frac = clamp(this.hp / this.maxHp, 0, 1);
    this._ghost = Math.max(frac, this._ghost - dt * 0.35);
    this.hpFill.style.width = (frac * 100).toFixed(1) + '%';
    this.hpGhost.style.width = (this._ghost * 100).toFixed(1) + '%';
    this.hpText.textContent = `${Math.ceil(this.hp)} / ${this.maxHp}`;
    $('#hp-wrap').classList.toggle('low', frac < 0.3);
    // Damage numbers
    for (let i = this.dmgNums.length - 1; i >= 0; i--) {
      const n = this.dmgNums[i];
      n.t += dt;
      v.set(n.x, n.y + n.t * 1.4, n.z).project(cam);
      if (v.z > 1 || n.t > 0.95) { n.el.remove(); this.dmgNums.splice(i, 1); continue; }
      const sx = (v.x * 0.5 + 0.5) * innerWidth + n.vx * n.t, sy = (-v.y * 0.5 + 0.5) * innerHeight;
      const pop = n.t < 0.12 ? 1.4 - n.t * 3 : 1;
      n.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%) scale(${pop})`;
      n.el.style.opacity = n.t > 0.6 ? 1 - (n.t - 0.6) / 0.35 : 1;
    }
    // Health bars above targets
    const pp = g.player.pos;
    const show = [];
    if (!g.photo?.active) {
      for (const t of this.targets()) {
        const p = t.obj.position;
        const dd = Math.hypot(p.x - pp.x, p.z - pp.z);
        const recent = g.clock - (t.lastHit ?? -99) < 6;
        if (!(t.hostile ? dd < (t.elite ? 40 : 26) : (recent && dd < 30) || dd < 5)) continue;
        if (!t.hostile && !recent && t.hp >= t.maxHp && dd >= 5) continue;
        v.set(p.x, p.y + t.height + 0.55, p.z).project(cam);
        if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) continue;
        show.push({ t, x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, dd });
      }
    }
    show.sort((a, b) => a.dd - b.dd);
    while (this.barPool.length < Math.min(show.length, 14)) {
      const el = document.createElement('div');
      el.className = 'tbar';
      el.innerHTML = '<div class="tname"></div><div class="ttrack"><div class="tghost"></div><div class="tfill"></div></div>';
      this.barLayer.appendChild(el);
      this.barPool.push({ el, name: el.querySelector('.tname'), fill: el.querySelector('.tfill'), ghost: el.querySelector('.tghost'), key: null, g: 1 });
    }
    for (let i = 0; i < this.barPool.length; i++) {
      const b = this.barPool[i], s = show[i];
      if (!s) { b.el.style.display = 'none'; b.key = null; continue; }
      const t = s.t, f = clamp(t.hp / t.maxHp, 0, 1);
      if (b.key !== t) { b.key = t; b.g = f; b.name.textContent = `${t.hostile ? `Lv.${t.level} ` : ''}${t.name}`; b.el.className = 'tbar ' + (t.hostile ? (t.elite ? 'elite' : 'enemy') : 'animal'); }
      b.g = Math.max(f, b.g - dt * 0.6);
      b.el.style.display = '';
      const sc = clamp(1.25 - s.dd / 40, 0.65, 1.1);
      b.el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%) scale(${sc})`;
      b.fill.style.width = (f * 100).toFixed(1) + '%';
      b.ghost.style.width = (b.g * 100).toFixed(1) + '%';
    }
  }
}
