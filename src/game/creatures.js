// Ambient wildlife with simple behaviours (wander, flee, circle, perch, surface).
import * as THREE from 'three';
import { createAnimal } from '../player/character.js';
import { groundHeight, waterLevel, regionWeights } from '../world/terrain.js';
import { LAKE, DARK_FOREST, MOUNTAIN, REGIONS } from '../world/layout.js';
import { angleLerp, mulberry32 } from '../core/math.js';
import { t } from '../i18n.js';

const rnd = mulberry32(2024);

// Ground animals can be hit: they get health bars, flee when hurt, and "faint" into starlight
// (respawning at home a while later) instead of dying.
const STATS = {
  sheep: { name: t('绵羊'), hp: 30, radius: 0.6, height: 1.3 },
  deer: { name: t('小鹿'), hp: 45, radius: 0.6, height: 2.2 },
  fox: { name: t('狐狸'), hp: 35, radius: 0.5, height: 1.1 },
  goat: { name: t('山羊'), hp: 50, radius: 0.55, height: 1.5 },
  crab: { name: t('螃蟹'), hp: 15, radius: 0.45, height: 0.5 },
  frog: { name: t('青蛙'), hp: 10, radius: 0.3, height: 0.4 },
  lizard: { name: t('蜥蜴'), hp: 12, radius: 0.3, height: 0.3 },
};
const WILD = {
  sheep: { wander: 10, speed: 0.9 },
  deer: { flee: 14, speed: 1.6, wander: 18 },
  fox: { flee: 9, speed: 2.4, wander: 20 },
  goat: { wander: 8, speed: 1.0 },
  crab: { mode: 'crab', speed: 1.2, wander: 5 },
  frog: { mode: 'hop', wander: 4, speed: 1.2 },
  lizard: { mode: 'dart', wander: 6, speed: 3 },
};

function findSpot(cx, cz, r, ok, tries = 60) {
  for (let i = 0; i < tries; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * r;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (ok(x, z, groundHeight(x, z))) return { x, z };
  }
  return null;
}

export class Creatures {
  constructor(game) {
    this.g = game;
    this.list = [];
    const land = (x, z, h) => h > waterLevel(x, z) + 0.6;
    const add = (kind, n, cx, cz, r, opts = {}) => {
      for (let i = 0; i < n; i++) {
        const s = findSpot(cx, cz, r, opts.ok || land);
        if (!s) continue;
        const obj = createAnimal(kind);
        obj.position.set(s.x, groundHeight(s.x, s.z), s.z);
        obj.rotation.y = rnd() * 6.28;
        game.scene.add(obj);
        this._make(kind, obj, s, opts);
      }
    };
    const pen = game.content.pen;
    add('sheep', 4, pen.x, pen.z, 4, { wander: 3.5, speed: 0.8 });
    add('sheep', 6, -40, 70, 30, { wander: 10, speed: 0.9 });
    add('deer', 5, -190, 60, 60, { flee: 14, speed: 1.6, wander: 18, ok: (x, z, h) => land(x, z, h) && Math.hypot(x - DARK_FOREST.x, z - DARK_FOREST.z) > DARK_FOREST.r });
    add('fox', 3, -160, -20, 50, { flee: 9, speed: 2.4, wander: 20 });
    add('crab', 6, 205, 235, 40, { mode: 'crab', speed: 1.2, wander: 5, ok: (x, z, h) => h > 0.3 && h < 2.2 });
    add('crab', 4, -20, 320, 40, { mode: 'crab', speed: 1.2, wander: 5, ok: (x, z, h) => h > 0.3 && h < 2.2 });
    add('seagull', 4, 230, 260, 30, { mode: 'circle', ok: () => true, range: 45 });
    add('seagull', 2, -10, 330, 20, { mode: 'circle', ok: () => true, range: 45 });
    add('butterfly', 10, 0, 110, 70, { mode: 'flutter', when: 'day', range: 18, dy: 0 });
    add('owl', 3, -230, 30, 70, { mode: 'perch', when: 'night', ok: (x, z, h) => land(x, z, h) && regionWeights(x, z).forest > 0.6, range: 40 });
    add('frog', 5, LAKE.x, LAKE.z, LAKE.r + 8, { mode: 'hop', when: 'rain', ok: (x, z, h) => h > 14.2 && h < 16, wander: 4, range: 20, dy: 0.1 });
    add('goat', 5, MOUNTAIN.x, MOUNTAIN.z, 110, { wander: 6, speed: 1.0, ok: (x, z, h) => h > 20 && h < 70 });
    add('lizard', 5, REGIONS.canyon.x, REGIONS.canyon.z, 90, { mode: 'dart', wander: 6, speed: 3, ok: (x, z, h) => land(x, z, h) && regionWeights(x, z).canyon > 0.6, range: 18, dy: 0.1 });
    // Whale
    const whale = createAnimal('whale');
    whale.position.set(400, -6, 120);
    game.scene.add(whale);
    this.whale = { obj: whale, t: 0, cycle: 40 };
    game.codexLive.push({ id: 'whale', obj: whale, range: 200, dy: 1 });
    // Firefly swarms (night, forest)
    this.swarms = [];
    const swarmGeo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 30; i++) pts.push((rnd() - 0.5) * 6, rnd() * 3 + 0.5, (rnd() - 0.5) * 6);
    swarmGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const swarmMat = new THREE.PointsMaterial({ color: 0xd9ff7a, size: 0.25, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const [x, z] of [[-280, 10], [-292, 18], [-250, -10], [-225, 40], [-200, 70], [-300, -30]]) {
      const p = new THREE.Points(swarmGeo, swarmMat);
      p.position.set(x, groundHeight(x, z), z);
      game.scene.add(p);
      this.swarms.push(p);
      game.codexLive.push({ id: 'firefly', obj: p, range: 25, dy: 1.5 });
    }
  }

  _make(kind, obj, home, opts) {
    const c = { kind, obj, home: { x: home.x, z: home.z }, r: opts.wander ?? 12, speed: opts.speed ?? 1.5, t: rnd() * 5, target: null, mode: opts.mode || 'wander', when: opts.when, phase: rnd() * 10, flee: opts.flee };
    const st = STATS[kind];
    if (st && c.mode !== 'perch') {
      Object.assign(c, { name: st.name, maxHp: st.hp, hp: st.hp, radius: st.radius, height: st.height, level: 1, hostile: false, alive: true, targetable: true, fleeT: 0, lastHit: -99, kx: 0, kz: 0 });
      c.onHit = (dmg, dir, info) => this._hit(c, dmg, dir, info);
    }
    c.codex = { id: opts.codex || kind, obj, range: opts.range, dy: opts.dy };
    this.list.push(c);
    this.g.codexLive.push(c.codex);
    return c;
  }

  // Wildlife on the far isles (spawned/despawned with their chunk).
  spawnWild(kind, x, z, tag) {
    const h = groundHeight(x, z);
    if (h < waterLevel(x, z) + 0.4) return null;
    const obj = createAnimal(kind);
    obj.position.set(x, h, z);
    obj.rotation.y = rnd() * 6.28;
    this.g.scene.add(obj);
    const c = this._make(kind, obj, { x, z }, WILD[kind] || {});
    c.tag = tag;
    return c;
  }

  despawnTag(tag) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      if (c.tag !== tag) continue;
      this.g.scene.remove(c.obj);
      const k = this.g.codexLive.indexOf(c.codex);
      if (k >= 0) this.g.codexLive.splice(k, 1);
      this.list.splice(i, 1);
    }
  }

  targets() {
    const out = [];
    for (const c of this.list) if (c.targetable && c.alive && c.obj.visible) out.push(c);
    return out;
  }

  _hit(c, dmg, dir, info) {
    const g = this.g;
    c.hp -= dmg;
    c.lastHit = g.clock;
    c.fleeT = 6;
    c.kx += dir.x * (info.knock ?? 5) * 1.3; c.kz += dir.z * (info.knock ?? 5) * 1.3;
    if (c.kind === 'sheep') g.audio.play('sheep');
    if (c.hp <= 0) {
      c.alive = false;
      c.obj.visible = false;
      c.respawnT = c.tag ? Infinity : 45;
      const p = c.obj.position;
      g.fx.emit(p.x, p.y + c.height * 0.5, p.z, 40, { color: 0xfff2a8, speed: 4, gravity: -2.5, size: 0.4, life: 1.3 });
      g.fx.emit(p.x, p.y + c.height * 0.5, p.z, 16, { color: 0xffffff, speed: 2, gravity: -4, size: 0.6, life: 1.0 });
    }
  }

  update(dt, t) {
    const g = this.g, p = g.player.pos;
    const night = g.sky.night > 0.5, rain = g.sky.rain > 0.4;
    for (const c of this.list) {
      const o = c.obj;
      if (c.targetable && !c.alive) {
        c.respawnT -= dt;
        if (c.respawnT <= 0) {
          c.alive = true; c.hp = c.maxHp; c.fleeT = 0;
          o.position.set(c.home.x, groundHeight(c.home.x, c.home.z), c.home.z);
        } else { o.visible = false; continue; }
      }
      const vis = c.when === 'day' ? !night && !rain : c.when === 'night' ? night : c.when === 'rain' ? rain : true;
      o.visible = vis;
      if (!vis) continue;
      const dp = Math.hypot(p.x - o.position.x, p.z - o.position.z);
      if (dp > 220) continue;
      c.t -= dt;
      const legs = o.userData.legs || [];
      switch (c.mode) {
        case 'circle': {
          c.phase += dt * 0.4;
          const r = 14 + Math.sin(c.phase * 0.3) * 4;
          o.position.set(c.home.x + Math.cos(c.phase) * r, 14 + Math.sin(c.phase * 0.7) * 3, c.home.z + Math.sin(c.phase) * r);
          o.rotation.y = -c.phase;
          o.rotation.z = 0.3;
          legs.forEach((w, i) => { w.rotation.z = Math.sin(t * 8) * 0.5 * (i ? -1 : 1); });
          continue;
        }
        case 'flutter': {
          c.phase += dt;
          o.position.set(c.home.x + Math.sin(c.phase * 0.7) * 4, groundHeight(c.home.x, c.home.z) + 1.2 + Math.sin(c.phase * 2.3) * 0.6, c.home.z + Math.cos(c.phase * 0.5) * 4);
          o.rotation.y = c.phase;
          legs.forEach((w, i) => { w.rotation.z = Math.sin(t * 25 + c.phase) * 0.9 * (i ? -1 : 1); });
          continue;
        }
        case 'perch': {
          o.position.y = groundHeight(c.home.x, c.home.z) + 4.5;
          o.rotation.y = angleLerp(o.rotation.y, Math.atan2(p.x - o.position.x, p.z - o.position.z), dt);
          continue;
        }
        default: break;
      }
      // Ground wanderers
      let speed = c.speed;
      if (c.targetable) {
        if (c.fleeT > 0) c.fleeT -= dt;
        if (Math.abs(c.kx) + Math.abs(c.kz) > 0.05) {
          const nx = o.position.x + c.kx * dt, nz = o.position.z + c.kz * dt;
          if (groundHeight(nx, nz) > waterLevel(nx, nz) + 0.1) { o.position.x = nx; o.position.z = nz; }
          c.kx *= Math.max(0, 1 - dt * 6); c.kz *= Math.max(0, 1 - dt * 6);
        }
        if (c.hp < c.maxHp && c.fleeT <= 0 && g.clock - c.lastHit > 20) c.hp = c.maxHp;
      }
      if ((c.flee && dp < c.flee) || c.fleeT > 0) {
        const ax = o.position.x - p.x, az = o.position.z - p.z, l = Math.hypot(ax, az) || 1;
        c.target = { x: o.position.x + (ax / l) * 10, z: o.position.z + (az / l) * 10 };
        speed = Math.max(c.speed * 4, c.fleeT > 0 ? 5.5 : 0);
        c.t = 2;
      } else if (c.t <= 0 || !c.target) {
        c.t = 2 + rnd() * 5;
        if (rnd() < 0.5) c.target = null;
        else {
          const a = rnd() * 6.28, d = rnd() * c.r;
          c.target = { x: c.home.x + Math.cos(a) * d, z: c.home.z + Math.sin(a) * d };
        }
      }
      let moving = false;
      if (c.target) {
        const dx = c.target.x - o.position.x, dz = c.target.z - o.position.z, d = Math.hypot(dx, dz);
        if (d > 0.3) {
          const nx = o.position.x + (dx / d) * speed * dt, nz = o.position.z + (dz / d) * speed * dt;
          const h = groundHeight(nx, nz);
          if (h > waterLevel(nx, nz) + 0.2 || c.mode === 'crab') {
            o.position.x = nx; o.position.z = nz;
            moving = true;
            const face = Math.atan2(dx, dz) + (c.mode === 'crab' ? Math.PI / 2 : 0);
            o.rotation.y = angleLerp(o.rotation.y, face, Math.min(1, dt * 5));
          } else c.target = null;
        } else c.target = null;
      }
      let y = groundHeight(o.position.x, o.position.z);
      if (c.mode === 'hop' && moving) y += Math.abs(Math.sin(t * 8 + c.phase)) * 0.4;
      o.position.y = y;
      legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(t * speed * 5 + i * Math.PI) * 0.6 : 0; });
    }
    // Whale surfaces periodically
    const w = this.whale;
    w.t += dt;
    const k = (w.t % w.cycle) / w.cycle;
    if (k < 0.01 && !w.moved) {
      const a = rnd() * 1.4 - 0.2;
      w.obj.position.x = Math.cos(a) * 395; w.obj.position.z = Math.sin(a) * 395;
      w.obj.rotation.y = rnd() * 6.28;
      w.moved = true;
    } else if (k > 0.5) w.moved = false;
    const surf = k > 0.1 && k < 0.35 ? Math.sin(((k - 0.1) / 0.25) * Math.PI) : 0;
    w.obj.position.y = -6 + surf * 6.2;
    w.obj.visible = surf > 0.05;
    if (surf > 0.9 && Math.random() < dt * 4) g.fx.emit(w.obj.position.x, 2, w.obj.position.z, 6, { color: 0xffffff, speed: 6, gravity: 8, size: 0.6, up: 2 });
    for (const s of this.swarms) {
      s.visible = night;
      if (night) { s.rotation.y += dt * 0.3; s.position.y += Math.sin(t + s.position.x) * dt * 0.2; }
    }
  }
}
