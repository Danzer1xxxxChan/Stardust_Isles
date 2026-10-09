// "Gloom" enemies: models, stats and AI (slime, shade wolf, crystal golem).
import * as THREE from 'three';
import { groundHeight, waterLevel } from '../world/terrain.js';
import { rimify } from '../world/props.js';
import { angleLerp, clamp } from '../core/math.js';
import { t } from '../i18n.js';

export const ENEMY_TYPES = {
  slime: { name: t('蚀影史莱姆'), hp: 40, dmg: 8, speed: 3.4, aggro: 14, radius: 0.7, height: 1.2, coins: 3, reach: 2.8, windup: 0.5 },
  wolf:  { name: t('蚀影狼'),     hp: 70, dmg: 13, speed: 6.6, aggro: 20, radius: 0.8, height: 1.3, coins: 6, reach: 6.0, windup: 0.65 },
  golem: { name: t('晶甲魔像'),   hp: 280, dmg: 26, speed: 2.3, aggro: 17, radius: 1.5, height: 3.6, coins: 30, reach: 4.2, windup: 1.1, elite: true },
};

const PALETTES = {
  meadow: { body: 0x3b2a5a, glow: 0xff4fd8 },
  forest: { body: 0x1f3a33, glow: 0x5dffb0 },
  canyon: { body: 0x4a2418, glow: 0xff8a2a },
  snow:   { body: 0x2a3d5e, glow: 0x7fd8ff },
  crystal:{ body: 0x3a2a66, glow: 0xb48cff },
};

const std = (o) => rimify(new THREE.MeshStandardMaterial(o), 0xd8c8ff, 0.5, 2.4);

function mesh(geo, m, parent, x = 0, y = 0, z = 0) {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  me.castShadow = true;
  parent.add(me);
  return me;
}

function slimeModel(pal) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const skin = std({ color: pal.body, roughness: 0.12, metalness: 0.0, transparent: true, opacity: 0.86, emissive: pal.glow, emissiveIntensity: 0.12 });
  const core = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: pal.glow, emissiveIntensity: 3.2 });
  const eyeM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.4 });
  const pupil = new THREE.MeshStandardMaterial({ color: 0x0a0612 });
  const b = mesh(new THREE.SphereGeometry(0.62, 28, 20), skin, body, 0, 0.55, 0); b.scale.set(1, 0.85, 1);
  mesh(new THREE.SphereGeometry(0.42, 20, 14), skin, body, 0, 0.98, -0.05).scale.set(1, 0.7, 1);
  mesh(new THREE.IcosahedronGeometry(0.2, 1), core, body, 0, 0.6, 0);
  for (const sx of [-1, 1]) {
    mesh(new THREE.SphereGeometry(0.11, 14, 10), eyeM, body, sx * 0.2, 0.78, 0.5).scale.set(0.9, 1.2, 0.5);
    mesh(new THREE.SphereGeometry(0.055, 10, 8), pupil, body, sx * 0.19, 0.76, 0.56);
  }
  root.userData.anim = { body, eyes: eyeM, core };
  return root;
}

function wolfModel(pal) {
  const root = new THREE.Group();
  const fur = std({ color: pal.body, roughness: 0.65 });
  const dark = std({ color: 0x120f1c, roughness: 0.7 });
  const glow = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: pal.glow, emissiveIntensity: 2.4 });
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff3a6a, emissiveIntensity: 2.0 });
  const body = new THREE.Group(); body.position.y = 0.85; root.add(body);
  mesh(new THREE.SphereGeometry(0.34, 20, 14), fur, body, 0, 0, 0).scale.set(1, 0.95, 2.0);
  mesh(new THREE.SphereGeometry(0.36, 18, 12), dark, body, 0, 0.12, 0.38).scale.set(1.05, 1.0, 1.0);
  for (let i = 0; i < 5; i++) {
    const sp = mesh(new THREE.ConeGeometry(0.07, 0.36, 8), i % 2 ? glow : dark, body, 0, 0.36 - i * 0.02, 0.4 - i * 0.2);
    sp.rotation.x = -0.6;
  }
  const head = new THREE.Group(); head.position.set(0, 0.28, 0.82); body.add(head);
  mesh(new THREE.SphereGeometry(0.24, 18, 14), fur, head).scale.set(1, 0.95, 1.15);
  mesh(new THREE.ConeGeometry(0.13, 0.36, 14), fur, head, 0, -0.06, 0.3).rotation.x = Math.PI / 2;
  mesh(new THREE.SphereGeometry(0.05, 8, 6), dark, head, 0, -0.05, 0.48);
  for (const sx of [-1, 1]) {
    mesh(new THREE.ConeGeometry(0.08, 0.24, 10), dark, head, sx * 0.13, 0.22, -0.02).rotation.z = -sx * 0.25;
    mesh(new THREE.SphereGeometry(0.045, 10, 8), eyeM, head, sx * 0.11, 0.06, 0.2).scale.set(1.3, 0.7, 0.6);
  }
  const tail = new THREE.Group(); tail.position.set(0, 0.1, -0.66); body.add(tail);
  mesh(new THREE.ConeGeometry(0.12, 0.7, 12), dark, tail, 0, 0, -0.3).rotation.x = -Math.PI / 2 - 0.4;
  const legs = [];
  for (const [x, z] of [[-0.18, 0.45], [0.18, 0.45], [-0.18, -0.45], [0.18, -0.45]]) {
    const lg = new THREE.Group(); lg.position.set(x, -0.08, z); body.add(lg);
    mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.72, 10), fur, lg, 0, -0.36, 0);
    mesh(new THREE.SphereGeometry(0.08, 10, 8), dark, lg, 0, -0.74, 0.04).scale.set(1, 0.6, 1.4);
    legs.push(lg);
  }
  root.userData.anim = { body, head, tail, legs, eyes: eyeM, glow };
  return root;
}

function golemModel(pal) {
  const root = new THREE.Group();
  const rock = std({ color: 0x5d5866, roughness: 0.92, flatShading: true });
  const rock2 = std({ color: 0x4a4652, roughness: 0.95, flatShading: true });
  const crystal = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, emissive: pal.glow, emissiveIntensity: 2.2, roughness: 0.2, metalness: 0.1 });
  const body = new THREE.Group(); body.position.y = 1.9; root.add(body);
  mesh(new THREE.DodecahedronGeometry(1.05, 0), rock, body).scale.set(1.15, 1, 0.9);
  mesh(new THREE.DodecahedronGeometry(0.55, 0), rock2, body, 0, 1.05, 0.15);
  mesh(new THREE.OctahedronGeometry(0.32, 0), crystal, body, 0, 0.1, 0.82);
  for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(0.07, 8, 6), crystal, body, sx * 0.18, 1.1, 0.62);
  for (let i = 0; i < 6; i++) {
    const c = mesh(new THREE.ConeGeometry(0.18 + (i % 2) * 0.08, 0.9 + (i % 3) * 0.3, 6), crystal, body, (i - 2.5) * 0.32, 0.75 + (i % 2) * 0.2, -0.55);
    c.rotation.set(-0.5, 0, (i - 2.5) * 0.25);
  }
  const arms = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(sx * 1.25, 0.45, 0); body.add(a);
    mesh(new THREE.DodecahedronGeometry(0.45, 0), rock2, a, 0, -0.35, 0);
    mesh(new THREE.DodecahedronGeometry(0.62, 0), rock, a, 0, -1.15, 0.1);
    mesh(new THREE.ConeGeometry(0.12, 0.5, 6), crystal, a, sx * 0.25, -0.1, -0.1).rotation.z = -sx * 0.8;
    arms.push(a);
  }
  const legs = [];
  for (const sx of [-1, 1]) {
    const l = new THREE.Group(); l.position.set(sx * 0.55, -0.8, 0); body.add(l);
    mesh(new THREE.DodecahedronGeometry(0.5, 0), rock2, l, 0, -0.55, 0);
    legs.push(l);
  }
  root.userData.anim = { body, arms, legs, glow: crystal };
  return root;
}

const MODELS = { slime: slimeModel, wolf: wolfModel, golem: golemModel };

const ringGeo = new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2);
const discGeo = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);

export class Enemy {
  constructor(game, kind, x, z, level = 1, biome = 'meadow') {
    const def = ENEMY_TYPES[kind];
    this.g = game; this.kind = kind; this.def = def;
    this.level = level;
    this.maxHp = Math.round(def.hp * (1 + (level - 1) * 0.35));
    this.hp = this.maxHp;
    this.dmg = Math.round(def.dmg * (1 + (level - 1) * 0.2));
    this.name = def.name; this.radius = def.radius; this.height = def.height;
    this.hostile = true; this.alive = true; this.elite = !!def.elite;
    this.obj = MODELS[kind](PALETTES[biome] || PALETTES.meadow);
    this.obj.position.set(x, groundHeight(x, z), z);
    this.obj.rotation.y = Math.random() * 6.28;
    this.pos = this.obj.position;
    this.home = { x, z };
    this.state = 'idle'; this.t = Math.random() * 3; this.k = 0;
    this.vel = new THREE.Vector3();
    this.atkDir = new THREE.Vector3();
    this.hitDone = false;
    this.seenT = 0;
    this.lastHit = -99;
    this.wander = null;
    this.phase = Math.random() * 10;
    this.anim = this.obj.userData.anim;
    game.scene.add(this.obj);
    if (kind === 'golem') {
      this.tele = new THREE.Group();
      const m1 = new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 });
      const m2 = new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4 });
      this.teleRing = new THREE.Mesh(ringGeo, m1); this.teleFill = new THREE.Mesh(discGeo, m2);
      this.tele.add(this.teleRing, this.teleFill); this.tele.visible = false;
      game.scene.add(this.tele);
    }
  }

  get aggroed() { return this.alive && (this.state === 'chase' || this.state === 'windup' || this.state === 'attack' || this.state === 'recover' || this.state === 'hurt'); }

  dispose() {
    this.g.scene.remove(this.obj);
    if (this.tele) this.g.scene.remove(this.tele);
  }

  // Called by Combat when the player hits this enemy.
  onHit(dmg, dir, info) {
    this.hp -= dmg;
    this.lastHit = this.g.clock;
    const kb = (info.knock ?? 6) * (this.elite ? 0.25 : 1);
    this.vel.x += dir.x * kb; this.vel.z += dir.z * kb;
    if (this.hp <= 0) { this.die(); return; }
    if (!this.elite || info.heavy) { if (this.state !== 'attack' || !this.elite) { this.state = 'hurt'; this.t = this.elite ? 0.35 : 0.28; } }
    if (this.state === 'idle') this.state = 'chase';
    if (this.tele && this.state === 'hurt') this.tele.visible = false;
  }

  die() {
    this.alive = false;
    this.state = 'dead';
    this.t = 0.7;
    if (this.tele) this.tele.visible = false;
  }

  update(dt) {
    const g = this.g, P = g.player, pp = P.pos, o = this.obj, A = this.anim;
    this.phase += dt;
    if (this.state === 'dead') {
      this.t -= dt;
      const s = Math.max(0.01, this.t / 0.7);
      o.scale.setScalar(this.kind === 'slime' ? s : 0.4 + s * 0.6);
      o.position.y += dt * (this.kind === 'slime' ? -0.5 : 0.6);
      o.rotation.y += dt * 4;
      return this.t > 0;
    }
    const dx = pp.x - o.position.x, dz = pp.z - o.position.z;
    const d = Math.hypot(dx, dz);
    const def = this.def;
    const playerOk = g.combat.playerAlive && !g.busyForCombat();
    this.t -= dt;
    let move = 0, faceTo = null;
    switch (this.state) {
      case 'idle': {
        if (playerOk && d < def.aggro && Math.abs(pp.y - o.position.y) < 8) { this.state = 'chase'; g.audio.play(this.kind === 'wolf' ? 'growl' : 'gloom'); break; }
        if (this.t <= 0) { this.t = 2 + Math.random() * 4; const a = Math.random() * 6.28, r = Math.random() * 8; this.wander = Math.random() < 0.6 ? { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r } : null; }
        if (this.wander) {
          const wx = this.wander.x - o.position.x, wz = this.wander.z - o.position.z;
          if (Math.hypot(wx, wz) > 0.5) { move = def.speed * 0.3; faceTo = Math.atan2(wx, wz); } else this.wander = null;
        }
        break;
      }
      case 'chase': {
        const fromHome = Math.hypot(o.position.x - this.home.x, o.position.z - this.home.z);
        if (!playerOk || d > def.aggro * 2.4 || fromHome > 70) { this.state = 'idle'; this.wander = { x: this.home.x, z: this.home.z }; this.t = 6; break; }
        faceTo = Math.atan2(dx, dz);
        if (d < def.reach && this.t <= 0) { this.state = 'windup'; this.t = def.windup; this.atkDir.set(dx / (d || 1), 0, dz / (d || 1)); g.audio.play(this.kind === 'golem' ? 'golemCharge' : 'windup'); break; }
        if (this.kind === 'wolf' && d < 4) move = -def.speed * 0.25; // circle in, keep a little distance
        else move = d > this.radius + 1.1 ? def.speed : 0;
        break;
      }
      case 'windup': {
        faceTo = Math.atan2(dx, dz);
        if (this.kind !== 'golem') this.atkDir.set(dx / (d || 1), 0, dz / (d || 1));
        if (this.t <= 0) {
          this.state = 'attack'; this.hitDone = false;
          if (this.kind === 'slime') { this.t = 0.5; this.vel.set(this.atkDir.x * 8.5, 0, this.atkDir.z * 8.5); }
          else if (this.kind === 'wolf') { this.t = 0.38; this.vel.set(this.atkDir.x * 15, 0, this.atkDir.z * 15); g.audio.play('bite'); }
          else { this.t = 0.5; this._slam(); }
        }
        break;
      }
      case 'attack': {
        if (this.kind !== 'golem' && !this.hitDone && d < this.radius + 0.75 && Math.abs(pp.y - o.position.y) < 1.6) {
          this.hitDone = true;
          g.combat.hurtPlayer(this.dmg, o.position, this.kind === 'wolf' ? 9 : 7);
        }
        if (this.t <= 0) { this.state = 'recover'; this.t = this.kind === 'golem' ? 1.4 : 0.7 + Math.random() * 0.6; }
        break;
      }
      case 'recover': if (this.t <= 0) { this.state = 'chase'; this.t = 0.4 + Math.random() * 0.8; } break;
      case 'hurt': if (this.t <= 0) { this.state = 'chase'; this.t = 0.5; } break;
      default: break;
    }
    if (faceTo !== null) o.rotation.y = angleLerp(o.rotation.y, faceTo, Math.min(1, dt * (this.state === 'windup' ? 3 : 7)));
    // Integrate movement + knockback
    const fwdX = Math.sin(o.rotation.y), fwdZ = Math.cos(o.rotation.y);
    let vx = this.vel.x + fwdX * move, vz = this.vel.z + fwdZ * move;
    if (this.kind === 'wolf' && this.state === 'chase' && d < 4.5) { vx += -fwdZ * def.speed * 0.5 * Math.sign(Math.sin(this.phase * 0.7)); vz += fwdX * def.speed * 0.5 * Math.sign(Math.sin(this.phase * 0.7)); }
    const nx = o.position.x + vx * dt, nz = o.position.z + vz * dt;
    const nh = groundHeight(nx, nz);
    if (nh > waterLevel(nx, nz) - 0.5 && nh - groundHeight(o.position.x, o.position.z) < 1.2) { o.position.x = nx; o.position.z = nz; }
    else { this.vel.set(0, 0, 0); this.wander = null; }
    g.world.colliders.resolve(o.position, this.radius * 0.7, this.height);
    const damp = this.state === 'attack' ? 1.5 : 7;
    this.vel.x *= Math.max(0, 1 - dt * damp); this.vel.z *= Math.max(0, 1 - dt * damp);
    let y = groundHeight(o.position.x, o.position.z);
    // Animation
    if (this.kind === 'slime') {
      const hopping = move > 0.5 || this.state === 'attack';
      const ph = (this.phase * (this.state === 'attack' ? 0 : 2.6)) % 1;
      let sq = 1, hop = 0;
      if (this.state === 'windup') sq = 0.65 + Math.sin(this.phase * 40) * 0.03;
      else if (this.state === 'attack') { const k = 1 - this.t / 0.5; hop = Math.sin(Math.min(1, k) * Math.PI) * 1.5; sq = 1.25; }
      else if (hopping) { hop = Math.sin(ph * Math.PI) * 0.45; sq = 1 + Math.sin(ph * Math.PI) * 0.18 - (ph < 0.1 ? 0.2 : 0); }
      else sq = 1 + Math.sin(this.phase * 3) * 0.04;
      A.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
      y += hop;
      A.core.emissiveIntensity = this.state === 'windup' ? 6 : 3.2;
    } else if (this.kind === 'wolf') {
      const sp = Math.hypot(vx, vz);
      const run = Math.min(1, sp / 6);
      A.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.phase * (6 + sp * 1.2) + (i % 2 ? Math.PI : 0) + (i > 1 ? 0.6 : 0)) * 0.7 * run; });
      A.body.position.y = 0.85 + Math.abs(Math.sin(this.phase * (6 + sp))) * 0.06 * run - (this.state === 'windup' ? 0.22 : 0);
      A.body.rotation.x = this.state === 'windup' ? 0.15 : this.state === 'attack' ? -0.2 : 0;
      A.tail.rotation.y = Math.sin(this.phase * 6) * 0.4;
      A.eyes.emissiveIntensity = this.state === 'windup' ? 5 + Math.sin(this.phase * 50) * 2 : 2;
      A.head.rotation.x = this.state === 'idle' ? Math.sin(this.phase) * 0.1 + 0.15 : -0.05;
    } else {
      const sp = Math.hypot(vx, vz);
      A.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.phase * 3 + i * Math.PI) * 0.35 * Math.min(1, sp / 2); });
      A.body.position.y = 1.9 + Math.abs(Math.sin(this.phase * 3)) * 0.08 * Math.min(1, sp / 2);
      const wind = this.state === 'windup' ? 1 - Math.max(0, this.t) / this.def.windup : 0;
      const slam = this.state === 'attack' ? 1 : 0;
      A.arms.forEach((a) => { a.rotation.x = this.state === 'windup' ? -2.6 * wind : slam ? 0.4 : Math.sin(this.phase * 1.5) * 0.15; });
      A.glow.emissiveIntensity = this.state === 'windup' ? 2.5 + wind * 5 : 2.2;
      if (this.tele) {
        this.tele.visible = this.state === 'windup';
        if (this.tele.visible) {
          const cx = o.position.x + this.atkDir.x * 1.5, cz = o.position.z + this.atkDir.z * 1.5;
          this.tele.position.set(cx, groundHeight(cx, cz) + 0.15, cz);
          this.teleRing.scale.setScalar(4.2);
          this.teleFill.scale.setScalar(Math.max(0.05, wind) * 4.2);
        }
      }
    }
    o.position.y = y;
    // Separation from the player
    if (P.mode !== 'swim' && d < this.radius + 0.45 && Math.abs(pp.y - y) < 1.5) {
      const push = (this.radius + 0.45 - d);
      pp.x += (dx / (d || 1)) * push; pp.z += (dz / (d || 1)) * push;
    }
    return true;
  }

  _slam() {
    const g = this.g, o = this.obj;
    const cx = o.position.x + this.atkDir.x * 1.5, cz = o.position.z + this.atkDir.z * 1.5;
    const cy = groundHeight(cx, cz);
    g.combat.shockwave(cx, cy, cz, 4.6, 0xff9a6a);
    g.fx.emit(cx, cy + 0.3, cz, 50, { color: 0xb9a48a, speed: 7, gravity: 9, size: 0.7, up: 1.2, life: 1 });
    g.audio.play('slam');
    const pp = g.player.pos;
    if (Math.hypot(pp.x - cx, pp.z - cz) < 4.4 && pp.y < cy + 1.3) g.combat.hurtPlayer(this.dmg, { x: cx, y: cy, z: cz }, 14);
    g.cam.shake = Math.max(g.cam.shake, Math.hypot(pp.x - cx, pp.z - cz) < 20 ? 0.9 : 0);
  }
}

export function enemyLevelAt(x, z) {
  return clamp(1 + Math.floor(Math.max(0, Math.hypot(x, z) - 460) / 260), 1, 30);
}
