// Camera mode: frame creatures, plants and landmarks to register them in the codex.
import * as THREE from 'three';
import { groundHeight } from '../world/terrain.js';
import { CODEX } from './content.js';
import { t } from '../i18n.js';

const $ = (s) => document.querySelector(s);

export class Photo {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.vf = $('#viewfinder');
    this.flash = $('#flash');
    this._v = new THREE.Vector3();
  }

  toggle() {
    const g = this.g;
    if (!g.state.data.abilities.camera) return;
    this.active = !this.active;
    g.cam.photo = this.active;
    this.vf.hidden = !this.active;
    g.player.frozen = this.active;
    g.player.char.root.visible = !this.active;
    g.hud.setPrompt(null);
    g.audio.play(this.active ? 'open' : 'close');
  }

  update() {
    const g = this.g;
    if (!this.active) return;
    if (g.input.hit('KeyC', 'Escape')) { this.toggle(); return; }
    if (g.input.clicked || g.input.hit('Space')) this.snap();
  }

  visible(x, y, z, maxDist) {
    const cam = this.g.camera;
    const v = this._v.set(x, y, z).sub(cam.position);
    const d = v.length();
    if (d > maxDist || d < 0.5) return false;
    v.normalize();
    const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
    const ang = Math.acos(Math.min(1, v.dot(fwd)));
    const half = THREE.MathUtils.degToRad(cam.fov / 2) * 0.85;
    if (ang > half) return false;
    // Terrain occlusion
    const steps = Math.ceil(d / 2);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const px = cam.position.x + (x - cam.position.x) * t, py = cam.position.y + (y - cam.position.y) * t, pz = cam.position.z + (z - cam.position.z) * t;
      if (groundHeight(px, pz) > py + 0.3) return false;
    }
    // Size check: require the subject to not be tiny in frame.
    const zoom = 60 / cam.fov;
    return d < maxDist * Math.min(1.6, 0.55 + zoom * 0.45);
  }

  snap() {
    const g = this.g, d = g.state.data;
    g.audio.play('shutter');
    this.flash.style.transition = 'none'; this.flash.style.opacity = 0.85;
    requestAnimationFrame(() => { this.flash.style.transition = 'opacity .35s'; this.flash.style.opacity = 0; });
    const found = new Set();
    for (const s of g.world.codexSpots) if (!found.has(s.id) && this.visible(s.x, s.y, s.z, s.big ? 220 : 40)) found.add(s.id);
    for (const c of g.codexLive) {
      if (found.has(c.id) || !c.obj.visible) continue;
      const p = c.obj.position;
      if (this.visible(p.x, p.y + (c.dy ?? 0.6), p.z, c.range || 35)) found.add(c.id);
    }
    const fresh = [...found].filter((id) => !d.codex.includes(id));
    for (const id of fresh) g.state.add('codex', id);
    if (fresh.length) {
      g.audio.play('feather');
      const names = fresh.map((id) => CODEX.find((c) => c.id === id)?.name || id).join(t('、'));
      g.hud.toast(t('图鉴新增：{0}（{1}/{2}）', [names, d.codex.length, CODEX.length]), 3500);
      g.state.save();
    } else if (found.size) {
      g.hud.toast(t('这些都已经登记过了。'));
    } else g.hud.toast(t('没拍到什么特别的东西。靠近一点，对准目标试试。'));
  }
}
