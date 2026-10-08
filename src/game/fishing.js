// Fishing: cast at ripple spots, react to the bite, then a 3-hit timing minigame.
import * as THREE from 'three';
import { resolveAnchor } from '../world/world.js';
import { FISH, CODEX } from './content.js';

const $ = (s) => document.querySelector(s);

export class Fishing {
  constructor(game) {
    this.g = game;
    this.active = false;
    this.ui = $('#fishing');
    this.spots = game.content.fishing.map((s) => {
      const def = s.anchor ? resolveAnchor(s, game.world.anchors) : s;
      const level = def.kind === 'lake' ? 14 : 0;
      const rip = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.9, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }));
      rip.position.set(def.x, level + 0.12, def.z);
      game.scene.add(rip);
      const spot = { ...def, level, rip };
      game.interact.add({
        pos: { x: def.x, y: level, z: def.z }, radius: 8, height: 6, priority: 1,
        label: () => (game.state.data.abilities.rod && game.player.mode === 'ground' ? '钓鱼' : null),
        action: () => this.fish(spot),
      });
      return spot;
    });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff }));
    this.line.visible = false;
    this.bobber = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe0453a }));
    this.bobber.visible = false;
    game.scene.add(this.line, this.bobber);
  }

  update(dt, t) {
    for (const s of this.spots) {
      const k = (t * 0.6 + s.x) % 1;
      s.rip.scale.setScalar(1 + k * 2.5);
      s.rip.material.opacity = 0.6 * (1 - k);
    }
    if (this.line.visible) {
      const tip = new THREE.Vector3();
      this.g.player.char.rod.children[0].localToWorld(tip.set(0, 2.3, 0));
      const p = this.line.geometry.attributes.position;
      p.setXYZ(0, tip.x, tip.y, tip.z);
      p.setXYZ(1, this.bobber.position.x, this.bobber.position.y, this.bobber.position.z);
      p.needsUpdate = true;
    }
  }

  pick(kind) {
    const night = this.g.sky.night > 0.5;
    const pool = FISH[kind].filter((f) => !f.night || night);
    let sum = pool.reduce((a, f) => a + f.w, 0), r = Math.random() * sum;
    for (const f of pool) { r -= f.w; if (r <= 0) return f; }
    return pool[0];
  }

  async fish(spot) {
    const g = this.g, pl = g.player;
    this.active = true;
    pl.frozen = true;
    pl.animOverride = 'fish';
    pl.yaw = Math.atan2(spot.x - pl.pos.x, spot.z - pl.pos.z);
    pl.char.rod.visible = true;
    this.bobber.position.set(spot.x + (Math.random() - 0.5) * 2, spot.level + 0.1, spot.z + (Math.random() - 0.5) * 2);
    this.bobber.visible = true; this.line.visible = true;
    g.audio.play('splash');
    this.ui.hidden = false;
    $('.bar', this.ui).hidden = true;
    $('.fish-title', this.ui).textContent = '等待鱼儿上钩……';
    $('.fish-hint', this.ui).textContent = '按 E 收竿';
    let result = 'cancel';
    try {
      const wait = 1.8 + Math.random() * 3.5;
      let t = 0;
      while (t < wait) {
        const dt = await g.frame();
        t += dt;
        this.bobber.position.y = spot.level + 0.1 + Math.sin(t * 3) * 0.05;
        if (g.input.hit('KeyE', 'Escape')) throw new Error('cancel');
      }
      g.audio.play('bite');
      $('.fish-title', this.ui).textContent = '！！！ 咬钩了！';
      $('.fish-hint', this.ui).textContent = '快按 E！';
      this.bobber.position.y = spot.level - 0.2;
      t = 0;
      let hooked = false;
      while (t < 1.1) {
        const dt = await g.frame();
        t += dt;
        if (g.input.hit('KeyE', 'Space')) { hooked = true; break; }
      }
      if (!hooked) { result = 'miss'; throw new Error('miss'); }
      const fish = this.pick(spot.kind);
      const ok = await this.minigame(fish);
      if (!ok) { result = 'escape'; throw new Error('escape'); }
      result = 'catch';
      this.caught(fish);
    } catch (e) {
      if (result === 'miss') g.hud.toast('鱼跑掉了……下次要快一点按 E。');
      if (result === 'escape') { g.audio.play('fail'); g.hud.toast('线断了，鱼逃走了！'); }
    }
    this.ui.hidden = true;
    this.bobber.visible = false; this.line.visible = false;
    pl.char.rod.visible = false;
    pl.animOverride = null;
    pl.frozen = false;
    this.active = false;
  }

  async minigame(fish) {
    const g = this.g;
    const bar = $('.bar', this.ui), zone = $('.zone', this.ui), cur = $('.cursor', this.ui);
    bar.hidden = false;
    $('.fish-title', this.ui).textContent = '收线！';
    let hits = 0, misses = 0;
    const width = 0.42 - fish.diff * 0.38;
    const speed = 0.8 + fish.diff * 1.6;
    let x = 0, dir = 1;
    let zx = Math.random() * (1 - width);
    const show = () => {
      zone.style.left = zx * 100 + '%'; zone.style.width = width * 100 + '%';
      $('.fish-hint', this.ui).textContent = `指针在绿色区域时按 E · 成功 ${hits}/3 · 失误 ${misses}/2`;
    };
    show();
    while (hits < 3 && misses < 2) {
      const dt = await g.frame();
      x += dir * speed * dt * (1 + hits * 0.25);
      if (x > 1) { x = 1; dir = -1; } else if (x < 0) { x = 0; dir = 1; }
      cur.style.left = `calc(${x * 100}% - 3px)`;
      this.mg = { x, dir, zx, width, speed: speed * (1 + hits * 0.25) };
      if (g.input.hit('KeyE', 'Space')) {
        if (x >= zx && x <= zx + width) { hits++; g.audio.play('reel', hits); zx = Math.random() * (1 - width); }
        else { misses++; g.audio.play('exhausted'); }
        show();
      }
    }
    this.mg = null;
    return hits >= 3;
  }

  caught(fish) {
    const g = this.g, d = g.state.data;
    const info = CODEX.find((c) => c.id === fish.id);
    d.items.fish[fish.id] = (d.items.fish[fish.id] || 0) + 1;
    const isNew = g.state.add('codex', fish.id);
    g.audio.play('fanfare');
    g.hud.banner(`钓到了 ${info.name}！`, isNew ? '图鉴新增一条' : info.desc, 3000);
    g.fx.emit(this.bobber.position.x, this.bobber.position.y + 0.5, this.bobber.position.z, 30, { color: 0x9fd3ff, speed: 4, gravity: 6 });
    if (fish.id === 'golden') {
      setTimeout(() => {
        g.hud.toast('金鳞鱼的嘴里衔着一颗星屑！');
        g.collect.awardShard('golden_fish');
      }, 1800);
    }
    g.state.save();
  }
}
