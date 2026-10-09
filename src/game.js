// Game orchestrator: owns renderer, world, systems, main loop, campfires, ending.
import * as THREE from 'three';
import { buildWorld } from './world/world.js';
import { groundHeight, waterLevel, regionAt, regionWeights, flattestNear } from './world/terrain.js';
import { DARK_FOREST, REGIONS, WORLD_HALF, VILLAGE, BIOMES } from './world/layout.js';
import { WIND } from './world/props.js';
import { Post, QUALITY } from './render/post.js';
import { Combat } from './game/combat.js';
import { GameState } from './game/state.js';
import { Input } from './core/input.js';
import { Particles } from './core/fx.js';
import { clamp } from './core/math.js';
import { Audio } from './audio/audio.js';
import { Player } from './player/player.js';
import { FollowCamera } from './player/camera.js';
import { Hud } from './ui/hud.js';
import { Dialog } from './ui/dialog.js';
import { Menu, REVEAL_N } from './ui/menu.js';
import { Interactions } from './game/interact.js';
import { Collectibles } from './game/collectibles.js';
import { Npcs } from './game/npcs.js';
import { Challenges } from './game/challenges.js';
import { Fishing } from './game/fishing.js';
import { Photo } from './game/photo.js';
import { Creatures } from './game/creatures.js';
import { AiClient } from './ai/client.js';
import { ABILITY_NAMES, LIGHTHOUSE_COST, SHARD_TOTAL, FEATHER_TOTAL, CODEX } from './game/content.js';
import { t } from './i18n.js';

const ABILITY_TEXT = {
  camera: t('按 C 拍照，登记图鉴'),
  glider: t('在空中再按一次空格展开，按住保持滑翔'),
  lantern: t('可以走进漆黑的迷雾森林深处了'),
  rod: t('在有涟漪的水面附近按 E 钓鱼'),
  fins: t('现在可以在水里游泳了，按住 Shift 游得更快'),
  shovel: t('在藏宝图标记的地点按 E 挖宝'),
  boots: t('在空中再按一次空格可以二段跳'),
  compass: t('右上角会指向最近的星屑'),
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.setSize(innerWidth, innerHeight);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1600);
    this.post = new Post(r, this.scene, this.camera);
    this.hitstop = 0;
    this.state = new GameState();
    this.input = new Input(canvas);
    this.audio = new Audio();
    this.hud = new Hud();
    this.dialog = new Dialog(this.audio);
    this.cam = new FollowCamera(this.camera);
    this.codexLive = [];
    this.clock = 0;
    this.running = false;
    this.cutscene = false;
    this._frameWaiters = [];
    this._timers = { slow: 0, save: 0, weather: 150 };
    this._regionCur = null; this._regionCand = null; this._regionT = 0;
    this._toastGate = {};
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
      this.post.resize();
    });
  }

  // ---------- Loading ----------
  async load(onProgress) {
    const step = async (p) => { onProgress(p); await new Promise((res) => setTimeout(res, 16)); };
    await step(5);
    this.world = buildWorld(this.scene, this.renderer);
    this.content = this.world.content;
    this.sky = this.world.sky;
    await step(70);
    this.fx = new Particles(this.scene);
    this.interact = new Interactions(this);
    this.player = new Player(this.scene, this.world.colliders, this.state);
    this.player.onEvent = (e, a) => this.onPlayerEvent(e, a);
    this.player.restrict = (p, check) => this.restrict(p, check);
    this.player.char.root.visible = false;
    this.lanternLight = new THREE.PointLight(0xffc477, 0, 26, 1.4);
    this.scene.add(this.lanternLight);
    await step(85);
    this.titleAngle = 0;
    this.camera.position.set(60, 60, 260);
    this.camera.lookAt(0, 10, 120);
    this.sky.update(0.016, 8.5, new THREE.Vector3(0, 0, 150), this.camera.position, 0);
    this.applyQuality(this.state.data.settings.quality);
    try { const s = JSON.parse(localStorage.getItem('stardust-isles-save-v1') || '{}').settings; if (s?.quality) this.applyQuality(s.quality); } catch { /* ignore */ }
    this.renderer.compile(this.scene, this.camera);
    await step(100);
    requestAnimationFrame((t) => { this._last = t; this._tick(t); });
  }

  // ---------- Start (after the title screen) ----------
  start(isNew) {
    if (isNew) this.state.reset(); else this.state.load();
    const d = this.state.data;
    if (isNew) d.campfires.push('village');
    this.collect = new Collectibles(this);
    this.npcs = new Npcs(this);
    this.challenges = new Challenges(this);
    this.fishing = new Fishing(this);
    this.photo = new Photo(this);
    this.creatures = new Creatures(this);
    this.combat = new Combat(this);
    this.menu = new Menu(this);
    this.ai = new AiClient(this);
    this._setupCampfires();
    this._setupLighthouse();
    if (!d.reveal || d.reveal.length !== REVEAL_N * REVEAL_N) d.reveal = '0'.repeat(REVEAL_N * REVEAL_N);
    this._reveal = d.reveal.split('');
    this.player.char.root.visible = true;
    this.player.char.setHat(d.hat);
    if (d.pos) {
      this.player.teleport(d.pos.x, d.pos.y, d.pos.z);
      this.player.yaw = d.yaw || 0;
    } else {
      this.player.teleport(4, groundHeight(4, 168), 168);
      this.player.yaw = Math.PI;
    }
    this.cam.yaw = this.player.yaw + Math.PI;
    this.cam.target.set(this.player.pos.x, this.player.pos.y + 1.5, this.player.pos.z);
    this.world.frontier.update(this.player.pos.x, this.player.pos.z, 0, true);
    this.applySettings();
    this.hud.show(true);
    this.running = true;
    this.collect.syncVisibility();
    if (d.ending) { this.world.lighthouse.lamp.material.emissiveIntensity = 3; this.world.lighthouse.beam.visible = true; }
    if (isNew) {
      this.hud.banner(t('星屑群岛'), t('流星雨过后的第一个早晨'), 3500);
      setTimeout(() => this.hud.toast(t('前面那位老奶奶好像有话要说。走到她身边按 E。'), 5000), 3800);
    } else this.hud.toast(t('欢迎回来！'));
  }

  applySettings() {
    const s = this.state.data.settings;
    this.audio.setVolumes(s.volume, s.music);
    if (this._quality !== s.quality) this.applyQuality(s.quality);
    this.renderer.shadowMap.enabled = s.shadows;
    this.world.sky.sun.castShadow = s.shadows;
    this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  // Graphics preset: post-processing, shadow resolution, grass density, far-isle view distance.
  applyQuality(q) {
    if (!QUALITY[q]) q = 'high';
    this._quality = q;
    this.post.setQuality(q, this.world?.sky.sun);
    this.world?.grass.setQuality(q);
    this.world?.frontier.setQuality(q);
    this.world?.water.setQuality(q);
  }

  busyForCombat() { return this.dialog.active || this.cutscene || this.menu?.isOpen || this.fishing?.active; }

  // ---------- Helpers used by systems ----------
  wait(s) { return new Promise((res) => setTimeout(res, s * 1000)); }
  frame() { return new Promise((res) => this._frameWaiters.push(res)); }
  busy() { return this.dialog.active || this.fishing?.active || this.photo?.active || this.cutscene || this.menu?.isOpen || this.challenges?.busy(); }
  canTravel() { return !(this.dialog.active || this.fishing?.active || this.cutscene || this.challenges?.activeCourse || this.challenges?.race); }
  moodNow() { return this.combat?.inCombat ? 'tense' : this.sky.rainTarget > 0 ? 'rain' : this.sky.night > 0.5 ? 'night' : 'day'; }

  toastOnce(key, text, gap = 5) {
    const now = this.clock;
    if (this._toastGate[key] && now - this._toastGate[key] < gap) return;
    this._toastGate[key] = now;
    this.hud.toast(text);
  }

  beginDialog(npc) {
    this.player.frozen = true;
    this.dialog.open(npc.voice || 500);
  }

  endDialog() {
    this.dialog.close();
    this.player.frozen = false;
  }

  grantAbility(key) {
    this.state.grant(key);
    this.audio.play('ability');
    this.hud.banner(t('获得 {0}！', [ABILITY_NAMES[key]]), ABILITY_TEXT[key] || '', 4000);
    this.state.save();
  }

  async fade(on) {
    const f = document.querySelector('#fade');
    f.style.opacity = on ? 1 : 0;
    await this.wait(0.65);
  }

  async fastTravel(c, force = false) {
    if (!force && !this.canTravel()) return;
    await this.fade(true);
    const spot = flattestNear(c.x + 2.5, c.z + 2.5, 3, 0.5);
    this.player.teleport(spot.x, spot.y, spot.z);
    this.player.yaw = Math.atan2(c.x - spot.x, c.z - spot.z);
    this.cam.yaw = this.player.yaw + Math.PI;
    this.cam.target.set(spot.x, spot.y + 1.5, spot.z);
    this.world.frontier.update(spot.x, spot.z, 0, true);
    await this.fade(false);
    if (!force) this.hud.toast(t('来到了 {0}', [c.name]));
  }

  async restUntil(h) {
    const d = this.state.data;
    await this.fade(true);
    if (h <= d.time) d.day++;
    d.time = h;
    this.player.stamina = this.player.maxStamina;
    this.combat.hp = this.combat.maxHp;
    this.sky.rain = this.sky.rainTarget = 0;
    this.collect.syncVisibility();
    await this.wait(0.3);
    await this.fade(false);
    this.hud.toast(t('休息得很好，精神饱满！'));
    this.state.save();
  }

  _setupCampfires() {
    const d = this.state.data;
    for (const c of this.world.campfires) {
      c.fire.visible = d.campfires.includes(c.id);
      this.interact.add({
        pos: { x: c.x, y: c.y, z: c.z }, radius: 3.2,
        label: () => (d.campfires.includes(c.id) ? t('营火（休息 / 快速旅行）') : t('点亮营火')),
        action: async () => {
          if (!d.campfires.includes(c.id)) {
            this.state.add('campfires', c.id);
            c.fire.visible = true;
            this.audio.play('fire');
            this.fx.emit(c.x, c.y + 0.8, c.z, 40, { color: 0xffa040, speed: 4, gravity: -2 });
            this.hud.banner(t('点亮了 {0}', [c.name]), t('可以在地图上快速旅行到这里，也可以在营火旁休息'));
            this.state.save();
            await this.wait(0.8);
          }
          this.beginDialog({ voice: 300 });
          const i = await this.dialog.choose(c.name, t('火光暖洋洋的。要做什么？'), [t('休息到早晨（6:00）'), t('休息到中午（12:00）'), t('休息到黄昏（18:00）'), t('休息到深夜（22:00）'), t('打开地图（快速旅行）'), t('离开')]);
          this.endDialog();
          if (i < 4) await this.restUntil([6, 12, 18, 22][i]);
          else if (i === 4) this.menu.open('map');
        },
      });
    }
  }

  _setupLighthouse() {
    const lh = this.world.lighthouse, d = this.state.data;
    this.interact.add({
      pos: { x: lh.door.x, y: lh.door.y, z: lh.door.z }, radius: 3, height: 4,
      label: () => (d.ending ? null : d.shards.length >= LIGHTHOUSE_COST ? t('点亮灯塔') : t('灯塔的大门（星屑 {0}/{1}）', [d.shards.length, LIGHTHOUSE_COST])),
      action: async () => {
        if (d.shards.length < LIGHTHOUSE_COST) {
          this.hud.toast(t('门上有一个星形的凹槽，还需要 {0} 颗星屑才能打开。', [LIGHTHOUSE_COST - d.shards.length]), 4000);
          return;
        }
        await this.ending();
      },
    });
  }

  async ending() {
    const lh = this.world.lighthouse, d = this.state.data;
    this.cutscene = true;
    this.player.frozen = true;
    this.hud.show(false);
    this.input.unlock();
    this.audio.setMood('ending');
    await this.fade(true);
    d.time = 20.6;
    const top = lh.y + 16.8;
    let ang = 0.6;
    const ov = (this.cam.override = { pos: new THREE.Vector3(), look: new THREE.Vector3(lh.x, top, lh.z), speed: 1.5, fov: 55 });
    this._cutsceneTick = (dt) => { ang += dt * 0.12; ov.pos.set(lh.x + Math.cos(ang) * 46, top + 10, lh.z + Math.sin(ang) * 46); };
    this._cutsceneTick(0);
    this.camera.position.copy(ov.pos);
    await this.fade(false);
    await this.wait(2);
    for (let i = 0; i <= 30; i++) { lh.lamp.material.emissiveIntensity = (i / 30) * 3; await this.wait(0.05); }
    lh.beam.visible = true;
    this.audio.play('fanfare');
    for (let i = 0; i < 6; i++) setTimeout(() => this.fx.emit(lh.x, top + 2, lh.z, 80, { color: 0xffe066, speed: 12, gravity: 2, life: 2.2, size: 0.8 }), i * 300);
    this.hud.show(true);
    this.hud.banner(t('灯塔重新亮起来了！'), t('光芒再次照亮了星屑群岛'), 5000);
    this.hud.show(false);
    document.querySelector('#hud').hidden = true;
    await this.wait(6);
    const el = document.querySelector('#ending');
    const mins = Math.floor(d.playTime / 60);
    const stat = (label, val) => `<div class="stat"><span>${label}</span><b>${val}</b></div>`;
    el.innerHTML = `<div class="ending-box"><h1>${t('星屑群岛')}</h1>
      <p>${t('灯塔的光芒扫过海面，艾拉奶奶站在村口，久久地望着雪山顶。')}<br>${t('谢谢你，旅人。群岛的夜晚再也不会迷路了。')}</p>
      ${stat('⭐ ' + t('星屑'), `${d.shards.length} / ${SHARD_TOTAL}`)}
      ${stat('🪶 ' + t('金羽毛'), `${d.feathers.length} / ${FEATHER_TOTAL}`)}
      ${stat('📖 ' + t('图鉴'), `${d.codex.length} / ${CODEX.length}`)}
      ${stat('⏱ ' + t('游戏时间'), t('{0} 分钟', [mins]))}
      <p style="font-size:14px;opacity:.75">${t('还有没找到的星屑？群岛一直在这里等你。')}</p>
      <button class="btn" id="end-continue">${t('继续探索')}</button></div>`;
    el.hidden = false;
    await new Promise((res) => { document.querySelector('#end-continue').onclick = res; });
    el.hidden = true;
    d.ending = true;
    this.cam.override = null;
    this._cutsceneTick = null;
    this.cutscene = false;
    this.player.frozen = false;
    this.hud.show(true);
    this.audio.setMood(this.moodNow());
    this.state.save();
  }

  // ---------- Player events / zones ----------
  onPlayerEvent(e, a) {
    const p = this.player.pos, A = this.audio;
    switch (e) {
      case 'jump': A.play('jump'); break;
      case 'djump': A.play('djump'); this.fx.emit(p.x, p.y + 0.2, p.z, 14, { color: 0xffffff, speed: 3, gravity: 0, size: 0.4 }); break;
      case 'land':
        A.play('land', a);
        if (a > 7) this.fx.emit(p.x, p.y + 0.1, p.z, Math.min(30, a * 1.2), { color: 0xd8c8a8, speed: 3, gravity: 2, size: 0.5, up: 0.4 });
        if (a > 22) this.cam.shake = 0.6;
        this.combat?.onLand();
        break;
      case 'splash': A.play('splash'); this.fx.emit(p.x, waterLevel(p.x, p.z) + 0.2, p.z, 30, { color: 0xdff6ff, speed: 5, gravity: 9, size: 0.45, up: 1.5 }); break;
      case 'step': A.play('step', a); break;
      case 'climbstep': A.play('climbstep'); break;
      case 'stroke': A.play('stroke'); break;
      case 'glide': A.play('glide'); break;
      case 'grab': A.play('grab'); break;
      case 'exhausted': A.play('exhausted'); this.toastOnce('exhaust', t('体力耗尽了！收集金羽毛可以提升体力上限。'), 8); break;
      case 'respawn':
        if (a === 'cold') this.toastOnce('cold', this.state.data.abilities.fins ? '' : t('水太冷了！没有脚蹼的话没法游泳。'), 3);
        { const f = document.querySelector('#fade'); f.style.transition = 'none'; f.style.opacity = 0.8; requestAnimationFrame(() => { f.style.transition = 'opacity .6s'; f.style.opacity = 0; }); }
        break;
      default: break;
    }
  }

  restrict(p, check) {
    if (this.state.data.abilities.lantern) return true;
    const df = DARK_FOREST;
    const d = Math.hypot(p.x - df.x, p.z - df.z);
    const limit = df.r - 24;
    if (d < limit) {
      if (check) return false;
      const k = limit / Math.max(d, 0.01);
      p.x = df.x + (p.x - df.x) * k; p.z = df.z + (p.z - df.z) * k;
      this.toastOnce('dark', t('太黑了，前面什么都看不见……也许需要一盏提灯。'), 5);
    }
    return true;
  }

  // ---------- Main loop ----------
  _tick(now) {
    requestAnimationFrame((t) => this._tick(t));
    const dt = Math.min(0.1, Math.max(0.001, (now - this._last) / 1000));
    this._last = now;
    this.input.beginFrame();
    this.clock += dt;
    const waiters = this._frameWaiters;
    this._frameWaiters = [];
    for (const w of waiters) w(dt);
    WIND.uTime.value = this.clock;
    if (this.running) this.update(dt); else this._titleUpdate(dt);
    this.post.render(dt, this.clock);
  }

  _titleUpdate(dt) {
    this.titleAngle += dt * 0.04;
    const a = this.titleAngle;
    this.camera.position.set(Math.cos(a) * 140, 70, 120 + Math.sin(a) * 140);
    this.camera.lookAt(0, 8, 90);
    const focus = new THREE.Vector3(0, 0, 120);
    this.sky.update(dt, 17.4, focus, this.camera.position, this.clock);
    this.world.water.update(this.clock, focus, this.sky, this.scene.fog);
    for (const f of this.world.structures.animated) f(dt, this.clock);
  }

  update(dt) {
    const d = this.state.data, I = this.input;
    // Menu / camera / pause toggles (one branch per frame so a key never toggles twice).
    if (this.menu.isOpen) {
      if (I.hit('Tab', 'Escape') || (I.hit('KeyM') && this.menu.tab === 'map')) this.menu.close();
    } else if (this.photo.active) {
      this.photo.update();
    } else if (!this.busy()) {
      if (I.hit('Tab')) this.menu.open(this.menu.tab);
      else if (I.hit('KeyM')) this.menu.open('map');
      else if (I.hit('Escape')) this.menu.open(this.menu.tab);
      else if (I.hit('KeyC')) {
        if (d.abilities.camera) this.photo.toggle(); else this.toastOnce('nocam', t('还没有相机。村里的皮普博士也许能帮忙。'));
      }
    }
    I.enabled = !(this.dialog.active || this.menu.isOpen || this.fishing.active || this.cutscene);
    I.wantLock = !this.menu.isOpen && !this.dialog.active && !this.cutscene;
    if (this.menu.isOpen) { this.hud.update(this); return; }

    if (!this.dialog.active && !this.cutscene) {
      d.time += dt / 20;
      if (d.time >= 24) { d.time -= 24; d.day++; }
    }
    d.playTime += dt;
    if (d.playTime > 180 && !this._keysHidden) { this._keysHidden = true; this.hud.keysHint.hidden = true; }

    // Hit-stop: gameplay time nearly freezes for a few frames on impact; camera and FX keep running.
    let gdt = dt;
    if (this.hitstop > 0) { this.hitstop -= dt; gdt = dt * 0.06; }
    const steps = Math.ceil(gdt / (1 / 60));
    for (let k = 0; k < steps; k++) this.player.update(gdt / steps, I, this.cam, k === 0);
    if (this._cutsceneTick) this._cutsceneTick(dt);
    this.cam.update(dt, this.player.pos, I, d.settings);
    this.sky.update(dt, d.time, this.player.pos, this.camera.position, this.clock);
    this.world.water.update(this.clock, this.player.pos, this.sky, this.scene.fog);
    this.world.frontier.update(this.player.pos.x, this.player.pos.z, 4);
    this.world.grass.update(this.player.pos, 3);
    this.world.ambient.update(this.clock, this.camera.position, this.sky);
    for (const f of this.world.structures.animated) f(dt, this.clock);
    this.collect.update(dt, this.clock);
    this.npcs.update(dt, this.clock);
    this.challenges.update(dt, this.clock);
    this.fishing.update(dt, this.clock);
    this.creatures.update(gdt, this.clock);
    this.combat.update(gdt, dt);
    this.fx.update(dt);
    this.interact.update();
    this._zones(dt);
    this._slowUpdate(dt);
    this.hud.update(this);
  }

  _zones(dt) {
    const p = this.player.pos, d = this.state.data;
    const df = DARK_FOREST;
    const dist = Math.hypot(p.x - df.x, p.z - df.z);
    const depth = clamp((df.r + 10 - dist) / 45, 0, 1);
    const night = this.sky.night;
    const lantern = d.abilities.lantern;
    this.hud.setDarkness(lantern ? depth * 0.3 + night * 0.15 : depth * 0.85);
    this.sky.extraFog += (depth * 0.65 - this.sky.extraFog) * Math.min(1, dt * 2);
    const lampOn = lantern && (night > 0.3 || depth > 0.15);
    this.player.lanternOn = lampOn;
    this.lanternLight.intensity += ((lampOn ? 28 : 0) - this.lanternLight.intensity) * Math.min(1, dt * 4);
    this.lanternLight.position.set(p.x, p.y + 2.2, p.z);
    // Tools hint
    const pl = this.player, ab = d.abilities;
    let hint = '';
    if (pl.mode === 'air' && ab.glider) hint = ab.boots && pl.jumps < 2 ? t('空格 二段跳') : t('空格 展开滑翔翼（按住）');
    else if (pl.mode === 'glide') hint = t('松开空格 收起滑翔翼 · S 减速');
    else if (pl.mode === 'climb') hint = t('空格 向上蹬（消耗体力）· S 向下爬');
    else if (pl.mode === 'swim' && !ab.fins) hint = t('水太冷了！快上岸');
    else hint = [ab.camera ? t('C 相机') : '', t('Tab 菜单'), t('M 地图')].filter(Boolean).join(' · ');
    this.hud.setToolsHint(hint);
    // Compass
    if (ab.compass) {
      const s = this.collect.nearestShard(p);
      if (s) {
        const f = this.cam.forward(), r = this.cam.right();
        const dx = s.x - p.x, dz = s.z - p.z;
        this.hud.setCompass(Math.atan2(dx * r.x + dz * r.z, dx * f.x + dz * f.z), s.d);
      } else this.hud.setCompass(null);
    }
  }

  _slowUpdate(dt) {
    const T = this._timers, d = this.state.data, p = this.player.pos;
    T.slow -= dt; T.save -= dt; T.weather -= dt;
    if (T.slow <= 0) {
      T.slow = 0.5;
      // Region banner
      const reg = regionAt(p.x, p.z);
      if (reg !== this._regionCur) {
        if (reg === this._regionCand) { this._regionT += 0.5; } else { this._regionCand = reg; this._regionT = 0; }
        if (this._regionT >= 1) {
          this._regionCur = reg;
          const far = reg.startsWith('far:');
          const name = REGIONS[reg]?.name || (far ? t('远方群岛 · {0}', [BIOMES[reg.slice(4)].name]) : reg === 'farsea' ? t('无尽之海') : null);
          if (name) this.hud.showRegion(name);
          if (far && !this.state.flag('farVisited')) {
            this.state.flag('farVisited', true);
            this.hud.banner(t('远方群岛'), t('离家越远，蚀影越强，宝藏也越丰厚。'), 4500);
          }
        }
      }
      const r0 = Math.hypot(p.x, p.z);
      if (r0 > d.farthest) d.farthest = r0;
      // Map reveal
      const cells = REVEAL_N, cs = (WORLD_HALF * 2) / cells, rr = 75;
      const i0 = Math.floor((p.x - rr + WORLD_HALF) / cs), i1 = Math.floor((p.x + rr + WORLD_HALF) / cs);
      const j0 = Math.floor((p.z - rr + WORLD_HALF) / cs), j1 = Math.floor((p.z + rr + WORLD_HALF) / cs);
      let changed = false;
      for (let j = Math.max(0, j0); j <= Math.min(cells - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(cells - 1, i1); i++) {
        const cx = -WORLD_HALF + (i + 0.5) * cs, cz = -WORLD_HALF + (j + 0.5) * cs;
        if (Math.hypot(cx - p.x, cz - p.z) < rr && this._reveal[j * cells + i] !== '1') { this._reveal[j * cells + i] = '1'; changed = true; }
      }
      if (changed) d.reveal = this._reveal.join('');
      // Music mood
      if (!this.challenges.activeCourse && !this.challenges.race && !this.cutscene) this.audio.setMood(this.moodNow());
      // Ambience
      let sea = 0;
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; if (groundHeight(p.x + Math.cos(a) * 30, p.z + Math.sin(a) * 30) < 0) sea++; }
      const w = regionWeights(p.x, p.z);
      this.audio.updateAmbience(0.5, { sea: sea / 8, wind: clamp((p.y - 15) / 50, 0, 1), rain: this.sky.rain, night: this.sky.night, birds: (1 - this.sky.night) * (w.meadow + w.forest + w.lake) * 0.5 });
      // Lamps glow at night
      for (const l of this.world.lamps) l.material.emissiveIntensity = 0.2 + this.sky.night * 2.2;
    }
    if (T.weather <= 0) {
      if (this.sky.rainTarget > 0) { this.sky.rainTarget = 0; T.weather = 200 + Math.random() * 200; }
      else if (Math.random() < 0.4) { this.sky.rainTarget = 1; T.weather = 70 + Math.random() * 60; this.hud.toast(t('下雨了……雨天会有特别的动物出现。')); }
      else T.weather = 120 + Math.random() * 120;
    }
    if (T.save <= 0) {
      T.save = 20;
      d.pos = { x: p.x, y: p.y, z: p.z };
      d.yaw = this.player.yaw;
      if (this.player.mode === 'ground') this.state.save();
    }
  }
}
