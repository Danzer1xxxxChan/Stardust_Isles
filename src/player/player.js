// Player controller: walk, sprint, jump, double jump, glide, climb (stamina), slide, swim.
import * as THREE from 'three';
import { createCharacter } from './character.js';
import { groundHeight, groundNormal, waterLevel } from '../world/terrain.js';
import { angleLerp, damp, clamp } from '../core/math.js';

const GRAVITY = 26;
const STEEP = 0.62;
const WALK = 7, SPRINT = 10.5, CLIMB = 2.6, GLIDE_FALL = 2.4, GLIDE_SPEED = 10.5;

export class Player {
  constructor(scene, colliders, state) {
    this.state = state;
    this.col = colliders;
    this.char = createCharacter();
    scene.add(this.char.root);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.mode = 'ground';
    this.radius = 0.38;
    this.height = 1.7;
    this.stamina = this.maxStamina;
    this.lastSafe = new THREE.Vector3();
    this.safeTimer = 0;
    this.cold = 0;
    this.jumps = 0;
    this.frozen = false;
    this.animOverride = null;
    this.onEvent = () => {};
    this.restrict = null;
    this.updrafts = [];
    this.time = 0;
    this.stepPhase = 0;
    this.airTime = 0;
    this._n = { x: 0, y: 1, z: 0 };
    this.lanternOn = false;
  }

  get maxStamina() { return 4.5 + this.state.data.feathers.length * 1.1; }

  teleport(x, y, z) {
    this.pos.set(x, y ?? groundHeight(x, z), z);
    this.vel.set(0, 0, 0);
    this.mode = 'ground';
    this.lastSafe.copy(this.pos);
    this.char.root.position.copy(this.pos);
  }

  floorAt(x, z, maxY) {
    const t = groundHeight(x, z);
    const s = this.col.supportHeight(x, z, this.radius, maxY);
    return s > t ? { h: s, terrain: false } : { h: t, terrain: true };
  }

  steepAt(x, z) { return groundNormal(x, z, this._n).y < STEEP; }

  respawn(reason) {
    this.onEvent('respawn', reason);
    this.teleport(this.lastSafe.x, this.lastSafe.y, this.lastSafe.z);
    this.cold = 0;
    this.stamina = this.maxStamina;
  }

  update(dt, input, cam, edges = true) {
    this.time += dt;
    const ab = this.state.data.abilities;
    const max = this.maxStamina;
    if (this.frozen) {
      this.vel.set(0, 0, 0);
      this.char.animate({ mode: this.animOverride || 'idle', speed: 0, dt, t: this.time });
      this._syncModel(dt);
      return;
    }
    const ax = input.axis();
    const f = cam.forward(), r = cam.right();
    let mx = f.x * ax.y + r.x * ax.x, mz = f.z * ax.y + r.z * ax.x;
    const mlen = Math.hypot(mx, mz);
    const jumpPressed = edges && input.wasPressed('Space');
    const jumpHeld = input.isDown('Space');
    const sprint = input.isDown('ShiftLeft', 'ShiftRight');
    const p = this.pos, v = this.vel;
    const wl = waterLevel(p.x, p.z);
    let animMode = 'idle';
    let animSpeed = 0;

    switch (this.mode) {
      case 'ground': {
        const depth = wl - p.y;
        const wade = depth > 0.3 ? 0.6 : 1;
        const sp = (sprint ? SPRINT : WALK) * wade;
        v.x = damp(v.x, mx * sp, 12, dt);
        v.z = damp(v.z, mz * sp, 12, dt);
        let nx = p.x + v.x * dt, nz = p.z + v.z * dt;
        const ahead = this.floorAt(nx, nz, p.y + 0.6);
        if (ahead.terrain && ahead.h > p.y + 0.04 && this.steepAt(nx, nz)) {
          if (mlen > 0.1 && this.stamina > 0.05) { this.mode = 'climb'; this.onEvent('grab'); break; }
          nx = p.x; nz = p.z; v.x = 0; v.z = 0;
        }
        p.x = nx; p.z = nz;
        this.col.resolve(p, this.radius, this.height);
        const fl = this.floorAt(p.x, p.z, p.y + 0.6);
        if (fl.h < p.y - 0.65) { this.mode = 'air'; v.y = 0; this.jumps = 1; this.airTime = 0; break; }
        p.y = fl.h;
        v.y = 0;
        if (fl.terrain && this.steepAt(p.x, p.z)) { this.mode = 'slide'; break; }
        if (mlen > 0.1) this.yaw = angleLerp(this.yaw, Math.atan2(mx, mz), Math.min(1, dt * 12));
        this.stamina = Math.min(max, this.stamina + dt * 3);
        animSpeed = Math.hypot(v.x, v.z);
        animMode = animSpeed > 0.4 ? 'walk' : 'idle';
        this.stepPhase += animSpeed * dt;
        if (this.stepPhase > 1.6) { this.stepPhase = 0; this.onEvent('step', depth > 0.2 ? 'water' : 'ground'); }
        if (jumpPressed) {
          v.y = 9.2; this.mode = 'air'; this.jumps = 1; this.airTime = 0;
          this.onEvent('jump');
        }
        if (depth > 1.15) { this.mode = 'swim'; this.onEvent('splash'); }
        this.safeTimer += dt;
        if (this.safeTimer > 0.5 && depth < 0.1 && !this.steepAt(p.x, p.z)) {
          this.safeTimer = 0;
          if (!this.restrict || this.restrict(p, true) !== false) this.lastSafe.copy(p);
        }
        break;
      }
      case 'air':
      case 'glide': {
        this.airTime += dt;
        if (this.mode === 'air') {
          const g = v.y > 0 && jumpHeld ? GRAVITY * 0.62 : GRAVITY;
          v.y -= g * dt;
          const sp = sprint ? SPRINT : WALK;
          v.x = damp(v.x, mx * sp, mlen > 0.1 ? 5 : 1.5, dt);
          v.z = damp(v.z, mz * sp, mlen > 0.1 ? 5 : 1.5, dt);
          if (mlen > 0.1) this.yaw = angleLerp(this.yaw, Math.atan2(mx, mz), Math.min(1, dt * 8));
          if (jumpPressed) {
            if (ab.boots && this.jumps < 2) { v.y = 8.6; this.jumps = 2; this.onEvent('djump'); }
            else if (ab.glider) { this.mode = 'glide'; this.onEvent('glide'); }
          }
          animMode = 'air';
        } else {
          if (!jumpHeld) { this.mode = 'air'; break; }
          let lift = -GLIDE_FALL;
          for (const u of this.updrafts) if (Math.hypot(p.x - u.x, p.z - u.z) < u.r && p.y < u.top) lift = 7.5;
          if (v.y > lift) v.y = Math.max(lift, v.y - GRAVITY * dt);
          else v.y = damp(v.y, lift, lift > 0 ? 3 : 6, dt);
          if (mlen > 0.1) this.yaw = angleLerp(this.yaw, Math.atan2(mx, mz), Math.min(1, dt * 2.6));
          const back = ax.y < -0.5 ? 0.55 : 1;
          v.x = damp(v.x, Math.sin(this.yaw) * GLIDE_SPEED * back, 3, dt);
          v.z = damp(v.z, Math.cos(this.yaw) * GLIDE_SPEED * back, 3, dt);
          animMode = 'glide';
        }
        let nx = p.x + v.x * dt, nz = p.z + v.z * dt;
        const t = groundHeight(nx, nz);
        if (t > p.y + 0.3) {
          if (this.steepAt(nx, nz)) {
            if (mlen > 0.1 && this.stamina > 0.05) { this.mode = 'climb'; v.set(0, 0, 0); this.onEvent('grab'); break; }
            nx = p.x; nz = p.z; v.x = 0; v.z = 0;
          }
        }
        p.x = nx; p.z = nz;
        p.y += v.y * dt;
        this.col.resolve(p, this.radius, this.height);
        const fl = this.floorAt(p.x, p.z, p.y + (v.y <= 0 ? 0.35 : 0.05));
        if (p.y <= fl.h) {
          if (v.y <= 0) {
            const impact = -v.y;
            p.y = fl.h; v.y = 0;
            if (fl.terrain && this.steepAt(p.x, p.z)) {
              this.mode = mlen > 0.1 && this.stamina > 0.05 ? 'climb' : 'slide';
            } else this.mode = 'ground';
            this.onEvent('land', impact);
            this.jumps = 0;
          } else p.y = fl.h;
        }
        if (this.mode !== 'ground' && p.y < wl - 1.15) { this.mode = 'swim'; v.y = 0; this.onEvent('splash'); }
        break;
      }
      case 'climb': {
        const n = groundNormal(p.x, p.z, this._n);
        const fl = this.floorAt(p.x, p.z, p.y + 0.3);
        if (n.y >= STEEP || !fl.terrain) { this.mode = 'ground'; break; }
        const hl = Math.hypot(n.x, n.z);
        const ux = -n.x / hl, uz = -n.z / hl;
        const grad = hl / n.y;
        const rx = -uz, rz = ux;
        const up = ax.y, lat = ax.x;
        let dx = ux * (up * CLIMB / grad) + rx * (lat * CLIMB * 0.8);
        let dz = uz * (up * CLIMB / grad) + rz * (lat * CLIMB * 0.8);
        const nx = p.x + dx * dt, nz = p.z + dz * dt;
        const moving = Math.abs(up) + Math.abs(lat) > 0.1;
        p.x = nx; p.z = nz;
        const before = p.y;
        p.y = groundHeight(p.x, p.z);
        this.col.resolve(p, this.radius, this.height);
        this.stamina -= dt * (moving ? 1 : 0.35);
        this.yaw = angleLerp(this.yaw, Math.atan2(ux, uz), Math.min(1, dt * 10));
        animMode = 'climb';
        animSpeed = moving ? 1 : 0;
        if (moving && Math.abs(p.y - before) > 0) { this.stepPhase += dt; if (this.stepPhase > 0.35) { this.stepPhase = 0; this.onEvent('climbstep'); } }
        if (this.stamina <= 0) { this.stamina = 0; this.mode = 'slide'; this.onEvent('exhausted'); break; }
        if (jumpPressed && this.stamina > 0.6) {
          this.stamina -= 1.2;
          v.set(ux * 1.2, 7.5, uz * 1.2);
          this.mode = 'air'; this.jumps = 2; this.airTime = 0;
          this.onEvent('jump');
        }
        if (p.y < wl - 1.15) { this.mode = 'swim'; }
        break;
      }
      case 'slide': {
        const n = groundNormal(p.x, p.z, this._n);
        if (n.y >= STEEP) { this.mode = 'ground'; break; }
        const hl = Math.hypot(n.x, n.z) || 1;
        const dx = n.x / hl, dz = n.z / hl;
        v.x = damp(v.x, dx * 8, 4, dt);
        v.z = damp(v.z, dz * 8, 4, dt);
        p.x += v.x * dt; p.z += v.z * dt;
        this.col.resolve(p, this.radius, this.height);
        const fl = this.floorAt(p.x, p.z, p.y + 0.6);
        if (fl.h < p.y - 0.8) { this.mode = 'air'; v.y = 0; break; }
        p.y = fl.h;
        animMode = 'slide';
        const into = mlen > 0.1 && (mx * -dx + mz * -dz) > 0.3;
        if (into && this.stamina > 0.5) this.mode = 'climb';
        if (p.y < wl - 1.15) { this.mode = 'swim'; this.onEvent('splash'); }
        break;
      }
      case 'swim': {
        const fins = ab.fins;
        const sp = (fins ? (sprint ? 8 : 6) : 3.2);
        v.x = damp(v.x, mx * sp, 4, dt);
        v.z = damp(v.z, mz * sp, 4, dt);
        let nx = p.x + v.x * dt, nz = p.z + v.z * dt;
        const t = groundHeight(nx, nz);
        const wln = waterLevel(nx, nz);
        if (t > wln - 1.1) {
          if (this.steepAt(nx, nz) && t > wln - 0.2) {
            if (mlen > 0.1 && this.stamina > 0.05) { p.x = nx; p.z = nz; p.y = t; this.mode = 'climb'; break; }
            nx = p.x; nz = p.z;
          } else { p.x = nx; p.z = nz; p.y = Math.max(t, wln - 1.05); this.mode = 'ground'; break; }
        }
        p.x = nx; p.z = nz;
        this.col.resolve(p, this.radius, this.height);
        p.y = wln - 1.05 + Math.sin(this.time * 2.2) * 0.06;
        if (mlen > 0.1) this.yaw = angleLerp(this.yaw, Math.atan2(mx, mz), Math.min(1, dt * 6));
        animMode = 'swim';
        animSpeed = Math.hypot(v.x, v.z);
        this.stamina = Math.min(max, this.stamina + dt);
        if (!fins) {
          this.cold += dt;
          if (this.cold > 1.5) { this.respawn('cold'); return; }
        } else this.cold = 0;
        this.stepPhase += animSpeed * dt;
        if (this.stepPhase > 2.2) { this.stepPhase = 0; this.onEvent('stroke'); }
        break;
      }
    }
    if (this.mode !== 'swim') this.cold = 0;
    // World bounds
    const lim = 440;
    p.x = clamp(p.x, -lim, lim);
    p.z = clamp(p.z, -lim, lim);
    if (this.restrict) this.restrict(p, false);
    if (this.animOverride) animMode = this.animOverride;
    this.char.animate({ mode: animMode, speed: animSpeed, dt, t: this.time });
    this._syncModel(dt);
  }

  _syncModel(dt) {
    const root = this.char.root;
    root.position.copy(this.pos);
    root.rotation.y = angleLerp(root.rotation.y, this.yaw, Math.min(1, dt * 20));
    this.char.lantern.visible = this.lanternOn;
  }
}
