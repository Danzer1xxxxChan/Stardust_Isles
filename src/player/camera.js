// Third-person orbit camera with terrain avoidance and a photo (viewfinder) mode.
import * as THREE from 'three';
import { groundHeight } from '../world/terrain.js';
import { clamp, damp } from '../core/math.js';

export class FollowCamera {
  constructor(camera) {
    this.cam = camera;
    this.yaw = Math.PI;
    this.pitch = 0.32;
    this.dist = 8;
    this.wantDist = 8;
    this.target = new THREE.Vector3();
    this.photo = false;
    this.fovBase = 60;
    this.photoFov = 45;
    this.shake = 0;
    this.override = null;
  }

  forward() { return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }; }
  right() { return { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) }; }

  update(dt, focus, input, settings) {
    const sens = 0.0025 * (settings?.sensitivity ?? 1);
    const look = input.look();
    this.yaw -= look.dx * sens;
    this.pitch += look.dy * sens * (settings?.invertY ? -1 : 1);
    this.pitch = clamp(this.pitch, -0.45, 1.25);
    if (this.photo) this.photoFov = clamp(this.photoFov + look.wheel * 4, 15, 70);
    else this.wantDist = clamp(this.wantDist + look.wheel * 0.8, 3.5, 16);

    if (this.override) {
      const o = this.override;
      this.cam.position.lerp(o.pos, 1 - Math.exp(-dt * (o.speed || 2)));
      this.target.lerp(o.look, 1 - Math.exp(-dt * (o.speed || 2)));
      this.cam.lookAt(this.target);
      this.cam.fov = damp(this.cam.fov, o.fov || this.fovBase, 4, dt);
      this.cam.updateProjectionMatrix();
      return;
    }

    const tgt = this.photo ? new THREE.Vector3(focus.x, focus.y + 1.7, focus.z) : new THREE.Vector3(focus.x, focus.y + 1.5, focus.z);
    this.target.x = damp(this.target.x, tgt.x, 14, dt);
    this.target.y = damp(this.target.y, tgt.y, 8, dt);
    this.target.z = damp(this.target.z, tgt.z, 14, dt);
    let want = this.photo ? 0.01 : this.wantDist;
    // Shorten if terrain blocks the view.
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dx = Math.sin(this.yaw) * cp, dy = sp, dz = Math.cos(this.yaw) * cp;
    if (!this.photo) {
      for (let s = 0.15; s <= 1.0; s += 0.08) {
        const d = want * s;
        const x = this.target.x + dx * d, y = this.target.y + dy * d, z = this.target.z + dz * d;
        if (groundHeight(x, z) + 0.35 > y) { want = Math.max(1.2, d - 0.4); break; }
      }
    }
    this.dist = want < this.dist ? damp(this.dist, want, 18, dt) : damp(this.dist, want, 4, dt);
    const p = this.cam.position;
    p.set(this.target.x + dx * this.dist, this.target.y + dy * this.dist, this.target.z + dz * this.dist);
    const g = groundHeight(p.x, p.z) + 0.4;
    if (p.y < g) p.y = g;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2);
      p.x += (Math.random() - 0.5) * this.shake * 0.3;
      p.y += (Math.random() - 0.5) * this.shake * 0.3;
    }
    if (this.photo) {
      this.cam.position.set(this.target.x, this.target.y, this.target.z);
      const look = new THREE.Vector3(this.target.x - dx, this.target.y - dy, this.target.z - dz);
      this.cam.lookAt(look);
    } else this.cam.lookAt(this.target);
    const fov = this.photo ? this.photoFov : this.fovBase;
    if (Math.abs(this.cam.fov - fov) > 0.01) { this.cam.fov = damp(this.cam.fov, fov, 10, dt); this.cam.updateProjectionMatrix(); }
  }
}
