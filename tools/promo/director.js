// Promo-video director, injected into the running game page.
// 1) Virtualises time (rAF, setTimeout/Interval, performance.now, CSS animations) so every captured
//    frame advances the game by exactly 1/FPS regardless of how long rendering + capture take.
// 2) Runs a shot list: each shot sets up the world, drives the camera / player input per frame and
//    draws captions. The recorder calls __promo.frame(i) once per output frame and screenshots.
(() => {
  const FPS = 30, DT = 1 / FPS;
  let LANG = 'zh';
  try { if (localStorage.getItem('stardust-isles-lang') === 'en') LANG = 'en'; } catch { /* ignore */ }
  // English captions / cards (the Chinese ones live on each shot).
  const EN = {
    title: { card: { logo: 'Stardust Isles', en: 'AN ISLAND ADVENTURE', line: '', small: '' } },
    dialog: ['GAMEPLAY · STORY', 'Meet the Islanders, Take on Quests', 'Nine residents, each with their own story and requests'],
    shard: ['GAMEPLAY · COLLECT', 'Gather Stardust, Unlock Abilities', '30 shards · 15 golden feathers · 8 abilities'],
    climb: ['GAMEPLAY · EXPLORE', 'Scale the Cliffs', 'Walk into any steep slope to climb - mind your stamina'],
    glide: ['GAMEPLAY · EXPLORE', 'Ride the Wind', 'Leap from the heights and soar across the valley'],
    photo: ['GAMEPLAY · FIELD GUIDE', 'Capture the Isles on Camera', '41 plants, creatures and landmarks to record'],
    travel: ['GAMEPLAY · TRAVEL', 'Light Campfires, Fast Travel', 'A fog-of-war map · 7 campfires'],
    timelapse: ['WORLD · TIME', 'Day, Night and Dynamic Weather', 'Some creatures and puzzles only appear at night or in the rain'],
    far: ['NEW · ENDLESS WORLD', 'The Endless Far Isles', 'Generated as you explore · the farther you go, the greater the danger and the reward'],
    snow: ['FAR ISLES · BIOMES', 'Frost · Forest · Redrock · Crystal · Meadow', 'Five biomes, each with its own ecology'],
    canyon: ['FAR ISLES · BIOMES', 'Redrock Badlands', ''],
    combo: ['NEW · COMBAT', 'Three-Hit Combos', 'Hit-stop · flashes · sword trails · damage numbers'],
    wolf: ['NEW · COMBAT', 'Dodge Roll', 'Read the tell, roll through with i-frames, then strike back'],
    golem: ['NEW · ELITE', 'Crystal Golem', 'Red-circle slam warnings · leap up for a plunge attack'],
    chest: ['NEW · REWARDS', 'Far-Isle Chests and Loot', 'Defeat the gloom, crack open chests, bring the spoils home'],
    ending: { card: { logo: 'Stardust Isles', en: 'AN ISLAND ADVENTURE', line: 'Gather stardust · Relight the lighthouse · Head for the endless horizon', small: 'Every model, tune and effect is generated in code, in real time' } },
  };
  // ---------------- Virtual time ----------------
  let vt = performance.now();
  const rafQ = [];
  let timers = [], tid = 1;
  window.requestAnimationFrame = (cb) => { rafQ.push(cb); return rafQ.length; };
  window.cancelAnimationFrame = () => {};
  performance.now = () => vt;
  window.setTimeout = (fn, ms = 0, ...a) => { const id = tid++; timers.push({ id, at: vt + (+ms || 0), fn, a }); return id; };
  window.setInterval = (fn, ms = 0, ...a) => { const id = tid++; timers.push({ id, at: vt + (+ms || 0), fn, a, every: Math.max(1, +ms || 1) }); return id; };
  window.clearTimeout = window.clearInterval = (id) => { timers = timers.filter((t) => t.id !== id); };
  function step(dt = DT) {
    vt += dt * 1000;
    for (let guard = 0; guard < 2000; guard++) {
      timers.sort((a, b) => a.at - b.at);
      const t = timers[0];
      if (!t || t.at > vt) break;
      if (t.every) t.at += t.every; else timers.shift();
      try { t.fn(...t.a); } catch (e) { console.error(e); }
    }
    for (const cb of rafQ.splice(0)) { try { cb(vt); } catch (e) { console.error(e); } }
    for (const an of document.getAnimations()) {
      try { if (an.playState === 'running') an.pause(); an.currentTime = (an.currentTime || 0) + dt * 1000; } catch { /* finished */ }
    }
  }
  window.__step = step;

  // ---------------- Overlay ----------------
  const css = document.createElement('style');
  css.textContent = `
    #keys-hint, #tools-hint { display: none !important; }
    body.cine #hud, body.cine #toasts, body.cine #bars, body.cine #dmg-layer, body.cine #region-banner { display: none !important; }
    body.nobanner #big-banner, body.nobanner #region-banner, body.nobanner #toasts { display: none !important; }
    #region-banner { display: none !important; }
    #pv-cap.tr { left: auto; right: 84px; bottom: auto !important; top: 120px; text-align: right; }
    #pv-cap.tr .tag { justify-content: flex-end; }
    #pv-bar1, #pv-bar2 { position: fixed; left: 0; right: 0; height: 0; background: #000; z-index: 40; }
    #pv-bar1 { top: 0; } #pv-bar2 { bottom: 0; }
    #pv-black { position: fixed; inset: 0; background: #000; opacity: 0; z-index: 60; pointer-events: none; }
    #pv-flash { position: fixed; inset: 0; background: #fff; opacity: 0; z-index: 59; pointer-events: none; }
    #pv-cap { position: fixed; left: 84px; bottom: 96px; z-index: 50; color: #fff; pointer-events: none; }
    #pv-cap .tag { font-size: 18px; letter-spacing: 6px; color: #ffd86a; font-weight: 700; display: flex; align-items: center; gap: 14px; text-shadow: 0 2px 8px rgba(0,0,0,.6); }
    #pv-cap .tag::before { content: ''; width: 46px; height: 3px; background: linear-gradient(90deg, #ffd86a, rgba(255,216,106,0)); border-radius: 2px; }
    #pv-cap .ttl { font-size: 54px; font-weight: 900; letter-spacing: 6px; margin-top: 8px; text-shadow: 0 4px 22px rgba(0,0,0,.65), 0 0 2px rgba(0,0,0,.8); }
    #pv-cap .sub { font-size: 24px; margin-top: 10px; opacity: .92; letter-spacing: 2px; text-shadow: 0 2px 10px rgba(0,0,0,.7); }
    #pv-card { position: fixed; inset: 0; z-index: 55; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; pointer-events: none; opacity: 0; }
    #pv-card .logo { font-size: 150px; font-weight: 900; letter-spacing: 26px; background: linear-gradient(180deg, #fff6d0 10%, #ffd86a 55%, #f2a93b 95%); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 6px 30px rgba(255, 190, 80, .55)) drop-shadow(0 2px 4px rgba(0,0,0,.6)); }
    #pv-card .en { font-size: 30px; letter-spacing: 22px; margin-top: 6px; opacity: .9; text-shadow: 0 2px 12px rgba(0,0,0,.7); }
    #pv-card .line { font-size: 28px; letter-spacing: 6px; margin-top: 34px; text-shadow: 0 2px 12px rgba(0,0,0,.8); }
    body.pv-en #pv-cap .ttl { letter-spacing: 1px; font-size: 52px; }
    body.pv-en #pv-cap .tag { letter-spacing: 4px; }
    body.pv-en #pv-card .logo { letter-spacing: 6px; font-size: 140px; }
    body.pv-en #pv-card .en { letter-spacing: 14px; font-size: 26px; }
    body.pv-en #pv-card .line { letter-spacing: 2px; font-size: 27px; }
    body.pv-en #pv-card .small { letter-spacing: 1px; }
    #pv-card .small { font-size: 20px; letter-spacing: 4px; margin-top: 18px; opacity: .8; text-shadow: 0 2px 10px rgba(0,0,0,.8); }
  `;
  document.head.appendChild(css);
  document.body.classList.toggle('pv-en', LANG === 'en');
  const mk = (id, html = '') => { const e = document.createElement('div'); e.id = id; e.innerHTML = html; document.body.appendChild(e); return e; };
  const bar1 = mk('pv-bar1'), bar2 = mk('pv-bar2'), black = mk('pv-black'), flash = mk('pv-flash');
  const cap = mk('pv-cap', '<div class="tag"></div><div class="ttl"></div><div class="sub"></div>');
  const card = mk('pv-card', '<div class="logo"></div><div class="en"></div><div class="line"></div><div class="small"></div>');

  const g = window.__game;
  const V = (x, y, z) => new g.camera.position.constructor(x, y, z);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);

  // ---------------- Helpers ----------------
  const I = g.input;
  const hold = (...codes) => { for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft']) I.down.delete(c); for (const c of codes) if (c) I.down.add(c); };
  const press = (code) => { dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true })); dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true })); };
  const cine = (pos, look, fov = 50) => { g.cam.override = { pos, look, speed: 1e5, fov }; g.camera.fov = fov; g.camera.updateProjectionMatrix(); };
  const follow = (yaw, pitch, dist) => { g.cam.override = null; if (yaw !== undefined) g.cam.yaw = yaw; if (pitch !== undefined) g.cam.pitch = pitch; if (dist !== undefined) { g.cam.wantDist = dist; g.cam.dist = dist; } };
  window.__gh = (x, z) => g.player.floorAt(x, z, 1e9).h;
  const tp = (x, z, yaw = 0, y) => { g.player.teleport(x, y ?? undefined, z); g.player.yaw = yaw; g.player.char.root.rotation.y = yaw; };
  const clearEnemies = () => { for (const e of g.combat.enemies) e.dispose(); g.combat.enemies.length = 0; };
  const yieldMicro = async () => { for (let k = 0; k < 6; k++) await null; };
  const tick = async () => { step(); await yieldMicro(); };
  const SETTLE = async (n = 20) => { g.world.frontier.update(g.player.pos.x, g.player.pos.z, 0, true); g.world.grass.update(g.player.pos, 1e9); for (let i = 0; i < n; i++) await tick(); };
  const FINISH = async () => { for (let i = 0; i < 600 && (g.dialog.active || g.interact.running); i++) { press('Space'); await tick(); await tick(); } };
  const resetPlayer = () => {
    hold(); g.player.frozen = false; g.player.animOverride = null; g.player.char.root.visible = true; g.player.atkPose = null;
    g.combat.swing = null; g.combat.dodge = null; g.combat.plunge = false; g.combat.hp = g.combat.maxHp; g.combat.invuln = 0;
    if (g.photo.active) g.photo.toggle();
    if (g.menu.isOpen) g.menu.close();
  };
  const fwd = (yaw) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
  const P = () => g.player.pos;
  const d = g.state.data;

  // Progression the showcase needs (abilities, lit campfires, revealed map).
  d.abilities.camera = true; d.abilities.lantern = true; d.abilities.fins = true;
  d.feathers = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'];
  for (const c of g.world.campfires) if (!d.campfires.includes(c.id)) { d.campfires.push(c.id); c.fire.visible = true; }
  d.reveal = '1'.repeat(d.reveal.length); g._reveal = d.reveal.split('');
  g.state.save = () => true; // never overwrite a real save while filming
  g.hud.keysHint.hidden = true;

  // ---------------- Shots ----------------
  // Each: { name, dur, fade: [in, out] seconds, hud, bars (letterbox), cap: [tag, title, sub], setup(), update(t, k) }
  const S = [];
  const anchors = () => g.world.anchors;

  // 1. Title flyover at sunrise
  S.push({
    name: 'title', dur: 7.5, fade: [1.0, 0.5], hud: false, bars: true, nobanner: true,
    card: { logo: '星屑群岛', en: 'STARDUST ISLES', line: '', small: '', at: [1.6, 6.4] },
    fog: [180, 1300],
    async setup() { tp(40, 60, 0); g.player.char.root.visible = false; d.time = 7.4; await SETTLE(10); },
    update(t) {
      d.time = 7.4 + t * 0.05;
      const k = ease(t / 7.5);
      cine(V(lerp(230, 110, k), lerp(110, 80, k), lerp(330, 220, k)), V(lerp(20, 0, k), 30, lerp(-80, -190, k)), 50);
    },
  });

  // 2. Talking to Aila (dialog + quest)
  S.push({
    name: 'dialog', dur: 9.5, fade: [0.5, 0.4], hud: true, nobanner: true, capPos: 'tr',
    cap: ['玩法 · 剧情', '与居民对话，接下委托', '9 位居民，各有各的故事与任务'],
    async setup() {
      resetPlayer();
      const n = g.npcs.get('aila');
      this.n = n;
      const a = 0.5, x = n.pos.x + Math.sin(a) * 2.3, z = n.pos.z + Math.cos(a) * 2.3;
      tp(x, z, a + Math.PI);
      g.cam.yaw = a;
      d.time = 9.2; await SETTLE(15);
    },
    update(t) {
      const n = this.n, p = P();
      const yaw = Math.atan2(n.pos.x - p.x, n.pos.z - p.z);
      const f = fwd(yaw), r = { x: f.z, z: -f.x };
      const push = ease(clamp(t / 9.5, 0, 1)) * 0.6;
      cine(V(p.x - f.x * (2.2 - push) - r.x * 1.6, p.y + 1.9, p.z - f.z * (2.2 - push) - r.z * 1.6), V(n.pos.x - r.x * 0.3, n.pos.y + 1.25, n.pos.z - r.z * 0.3), 42);
      const at = (s) => Math.abs(t - s) < DT / 2;
      if (at(0.4)) I._pending.add('KeyE');
      if (LANG === 'en' ? at(3.8) || at(7.4) : at(3.1) || at(6.0)) press('Space');
    },
  });

  // 3. Shard pickup + ability unlock
  S.push({
    name: 'shard', dur: 6, fade: [0.3, 0.4], hud: true,
    cap: ['玩法 · 收集', '收集星屑，解锁新能力', '30 颗星屑 · 15 根金羽毛 · 8 种能力'],
    async setup() {
      await FINISH();
      resetPlayer();
      const wm = anchors().windmill;
      const c = g.world.content.village.windmill;
      const out = Math.atan2(wm.x - c.x, wm.z - c.z);
      this.out = out;
      const tan = { x: Math.cos(out), z: -Math.sin(out) };
      this.tan = tan;
      tp(wm.x - tan.x * 1.0, wm.z - tan.z * 1.0, Math.atan2(tan.x, tan.z), wm.y - 1.2);
      d.time = 10; g.world.grass.update(g.player.pos, 1e9);
      this.wm = wm;
    },
    update(t) {
      const p = P();
      if (t < 0.25) { g.cam.yaw = Math.atan2(-this.tan.x, -this.tan.z); hold('KeyW'); } else hold();
      if (t > 0.35) { const o2 = fwd(this.out + 0.35); g.player.yaw = Math.atan2(o2.x, o2.z); }
      if (Math.abs(t - 0.8) < DT / 2) g.player.animOverride = 'cheer';
      if (Math.abs(t - 3.0) < DT / 2) { g.player.animOverride = null; g.grantAbility('glider'); }
      const o = fwd(this.out + 0.35 - t * 0.05);
      cine(V(p.x + o.x * 4.6, p.y + 1.3, p.z + o.z * 4.6), V(p.x, p.y + 1.1, p.z), 45);
    },
  });

  // 4. Climb a cliff
  S.push({
    name: 'climb', dur: 4.5, fade: [0.3, 0], hud: true, nobanner: true,
    cap: ['玩法 · 探索', '攀爬峭壁', '朝陡坡走就会攀爬，消耗体力'],
    async setup() { resetPlayer(); tp(0, -104, Math.PI); follow(0, 0.1, 7); d.time = 13; g.player.stamina = g.player.maxStamina; await SETTLE(10); },
    update(t) {
      hold('KeyW');
      g.cam.yaw = 0;
      const p = P();
      cine(V(p.x + 6.5, p.y + 1.2, p.z + 3.5), V(p.x, p.y + 1.4, p.z - 0.5), 50);
    },
  });

  // 5. Glide across the river
  S.push({
    name: 'glide', dur: 6.5, fade: [0, 0.4], hud: true, nobanner: true,
    cap: ['玩法 · 探索', '乘风滑翔', '从高处一跃而下，飞越整条河谷'],
    async setup() { resetPlayer(); const lk = g.world.content.lookout; tp(lk.x + 6, lk.z, Math.PI / 2); g.cam.yaw = Math.PI / 2 + Math.PI; d.time = 14; await SETTLE(10); },
    update(t) {
      g.cam.yaw = Math.PI / 2 + Math.PI;
      if (t < 0.2) hold('KeyW');
      else if (t < 0.25) { hold('KeyW'); I._pending.add('Space'); }
      else if (t < 0.6) hold('KeyW');
      else if (t < 0.65) { hold('KeyW', 'Space'); I._pending.add('Space'); }
      else hold('KeyW', 'Space');
      const p = P(), k = t / 6.5;
      cine(V(p.x - 7 + k * 3, p.y + 2.8, p.z + 6.5 - k * 2), V(p.x + 3, p.y, p.z), 55);
    },
  });

  // 6. Photo mode -> codex
  S.push({
    name: 'photo', dur: 4.5, fade: [0.3, 0.3], hud: true,
    cap: ['玩法 · 图鉴', '用相机记录群岛', '41 种动植物与地标等你拍下'],
    async setup() {
      resetPlayer();
      const c = g.content.pen;
      const x = c.x + 3, z = c.z + 13;
      tp(x, z, 0);
      const dx = c.x - x, dz = c.z - z;
      g.cam.override = null; g.cam.yaw = Math.atan2(-dx, -dz); g.cam.pitch = 0.18;
      d.time = 10.5; await SETTLE(10);
      // Stage the pen's sheep in frame so the shot is deterministic whatever happened earlier.
      const sheep = g.creatures.list.filter((cr) => cr.kind === 'sheep' && cr.alive !== false).sort((a, b) => Math.hypot(a.obj.position.x - c.x, a.obj.position.z - c.z) - Math.hypot(b.obj.position.x - c.x, b.obj.position.z - c.z)).slice(0, 3);
      sheep.forEach((cr, i) => {
        const sx = c.x + (i - 1) * 1.6, sz = c.z + 1.5 - Math.abs(i - 1) * 0.8;
        cr.obj.position.set(sx, window.__gh(sx, sz), sz);
        cr.obj.rotation.y = Math.atan2(x - sx, z - sz) + (i - 1) * 0.5;
        cr.target = null; cr.t = 99; cr.fleeT = 0;
      });
      g.photo.toggle();
      this.base = g.cam.yaw;
    },
    update(t) {
      g.cam.yaw = this.base + Math.sin(t * 0.8) * 0.03;
      g.cam.photoFov = lerp(50, 30, ease(clamp(t / 2, 0, 1)));
      if (Math.abs(t - 2.4) < DT / 2) g.photo.snap();
    },
  });

  // 7. Map + fast travel
  S.push({
    name: 'travel', dur: 8.5, fade: [0.3, 0.4], hud: true, capPos: 'tr',
    cap: ['玩法 · 旅行', '点亮营火，地图快速旅行', '带战争迷雾的地图 · 7 处营火'],
    async setup() {
      resetPlayer();
      tp(22 + 2.5, 172 + 2.5, Math.PI); follow(0, 0.3, 7); d.time = 11; await SETTLE(10);
      g.menu.open('map');
    },
    update(t) {
      if (Math.abs(t - 2.6) < DT / 2) {
        const fire = g.menu._fireHit.find((f) => f.c.id === 'canyon');
        const cv = document.querySelector('.map-wrap canvas');
        const r = cv.getBoundingClientRect();
        cv.onclick({ clientX: r.left + (fire.cx / 640) * r.width, clientY: r.top + (fire.cz / 640) * r.height });
      }
      if (t > 4.2 && !g.menu.isOpen) { follow(); g.cam.pitch = 0.28; }
      if (t > 5) { const c = g.world.campfires.find((x) => x.id === 'canyon'); g.cam.yaw += DT * 0.25; }
    },
  });

  // 8. Day / night / weather time-lapse
  S.push({
    name: 'timelapse', dur: 7.5, fade: [0.4, 0.5], hud: false, bars: true, fog: [120, 900],
    cap: ['世界 · 时间', '昼夜循环与动态天气', '有些动物和谜题只在夜晚或雨天出现'],
    async setup() { resetPlayer(); tp(0, 150, 0); g.player.char.root.visible = false; await SETTLE(10); },
    update(t) {
      d.time = 15.2 + t * 0.85;
      g.sky.rainTarget = t < 2.5 ? 1 : 0;
      g.sky.rain = clamp(t < 2.5 ? 0.85 : 0.85 - (t - 2.5) * 0.6, 0, 1);
      const a = 2.2 + t * 0.03;
      cine(V(Math.cos(a) * 75, 24, 150 + Math.sin(a) * 75), V(0, 16, 150), 55);
    },
  });

  // 9. Far isles reveal
  S.push({
    name: 'far', dur: 8.5, fade: [0.5, 0.3], hud: false, bars: true, nobanner: true, fog: [200, 1300],
    cap: ['v0.2 · 无限地图', '无限延伸的远方群岛', '走出海岸，世界按需生成 · 离家越远，越危险也越丰厚'],
    async setup() { resetPlayer(); g.sky.rain = g.sky.rainTarget = 0; g.player.char.root.visible = false; this.a = -0.5; tp(Math.cos(this.a) * 360, Math.sin(this.a) * 360, 0); d.time = 16; await SETTLE(15); },
    update(t) {
      const k = ease(t / 8.5), a = this.a;
      const r = lerp(330, 640, k);
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      tp(cx, cz, 0);
      g.player.char.root.visible = false;
      const h = lerp(26, 70, k);
      const look = lerp(r + 120, r + 380, k);
      cine(V(cx, h, cz), V(Math.cos(a + 0.05) * look, lerp(6, 4, k), Math.sin(a + 0.05) * look), 55);
      d.time = 16 + t * 0.05;
    },
  });

  // 10. Biomes: frost isles
  S.push({
    name: 'snow', dur: 4.5, fade: [0.3, 0.25], hud: false, bars: true, nobanner: true,
    cap: ['远方群岛 · 群系', '霜原 · 林海 · 赤岩 · 晶滩 · 草原', '五种群系，各有各的生态'],
    async setup() { resetPlayer(); tp(-120, -664, 0.4); g.cam.yaw = 0.4 + Math.PI; d.time = 12.5; await SETTLE(15); },
    update(t) {
      hold('KeyW'); g.cam.yaw = 0.4 + Math.PI;
      const p = P();
      const f = fwd(0.4); cine(V(p.x + f.x * 7.5 + f.z * 2.5, p.y + 3.2, p.z + f.z * 7.5 - f.x * 2.5), V(p.x, p.y + 1.0, p.z), 50);
    },
  });

  // 11. Biomes: red canyon flyby
  S.push({
    name: 'canyon', dur: 3.5, fade: [0.25, 0.3], hud: false, bars: true, nobanner: true, fog: [150, 1100],
    cap: ['远方群岛 · 群系', '赤岩荒地', ''],
    async setup() { resetPlayer(); tp(378, 529, 0); g.player.char.root.visible = false; d.time = 16.6; await SETTLE(15); },
    update(t) {
      tp(378 + t * 6, 529 - t * 4, 0); g.player.char.root.visible = false;
      cine(V(340 + t * 8, 36, 470 - t * 3), V(410, 18, 580), 52);
    },
  });

  // 12. Combat: combo on slimes
  const combatSpot = { x: -647, z: -59 };
  S.push({
    name: 'combo', dur: 6.5, fade: [0.3, 0], hud: true,
    cap: ['v0.2 · 战斗', '三段连击', '顿帧 · 闪白 · 刀光 · 伤害数字'],
    async setup() {
      resetPlayer(); clearEnemies();
      tp(combatSpot.x, combatSpot.z, 0); g.cam.yaw = Math.PI; d.time = 15.5; await SETTLE(12); clearEnemies();
      const p = P();
      for (const [dx, dz] of [[-1.6, 3.2], [0.2, 3.6], [1.8, 3.0], [0.5, 6.5]]) { const e = g.combat.spawn('slime', p.x + dx, p.z + dz, 6, 'crystal', 'pv'); e.state = 'chase'; e.t = 1.5; }
    },
    update(t) {
      const p = P();
      const presses = [0.35, 0.7, 1.05, 2.0, 2.35, 2.7, 3.7, 4.05, 4.4, 5.3, 5.65, 6.0];
      if (presses.some((s) => Math.abs(t - s) < DT / 2)) I._pending.add('KeyJ');
      g.combat.hp = Math.max(g.combat.hp, 60);
      const a = Math.PI + 0.6 + t * 0.06, o = fwd(a);
      cine(V(p.x + o.x * 6.2, p.y + 3.4, p.z + o.z * 6.2), V(p.x, p.y + 1.0, p.z + 1.5), 50);
    },
  });

  // 13. Combat: shade wolves, dodge roll
  S.push({
    name: 'wolf', dur: 6.5, fade: [0, 0], hud: true,
    cap: ['v0.2 · 战斗', '翻滚闪避', '看准预警，无敌帧躲开攻击再反击'],
    async setup() {
      resetPlayer(); clearEnemies();
      tp(combatSpot.x + 30, combatSpot.z + 10, 0); d.time = 15.7; await SETTLE(8); clearEnemies();
      const p = P();
      this.w = [g.combat.spawn('wolf', p.x - 3, p.z + 8, 3, 'forest', 'pv'), g.combat.spawn('wolf', p.x + 4, p.z + 9, 3, 'forest', 'pv')];
      for (const w of this.w) { w.state = 'chase'; w.t = 0.6; }
      this.lastRoll = -9; this.lastAtk = -9;
    },
    update(t) {
      const p = P();
      const ws = this.w.filter((w) => w.alive);
      const threat = ws.find((w) => w.state === 'windup' && w.t < 0.22);
      if (threat && t - this.lastRoll > 1.0 && g.player.stamina > 1) {
        const dx = threat.pos.x - p.x, dz = threat.pos.z - p.z;
        g.cam.yaw = Math.atan2(-dx, -dz);
        hold('KeyD'); press('KeyQ'); this.lastRoll = t;
      } else if (t - this.lastRoll > 0.45) {
        hold();
        const near = ws.find((w) => Math.hypot(w.pos.x - p.x, w.pos.z - p.z) < 3.2);
        if (near && t - this.lastAtk > 0.34) { I._pending.add('KeyJ'); this.lastAtk = t; }
      }
      g.combat.hp = Math.max(g.combat.hp, 50);
      const tw = ws[0] || this.w[0];
      if (!this.cdir) this.cdir = { x: 0, z: 1 };
      const ddx = tw.pos.x - p.x, ddz = tw.pos.z - p.z, dl = Math.hypot(ddx, ddz) || 1;
      this.cdir.x += (ddx / dl - this.cdir.x) * 0.04; this.cdir.z += (ddz / dl - this.cdir.z) * 0.04;
      const cl = Math.hypot(this.cdir.x, this.cdir.z) || 1, cx = this.cdir.x / cl, cz = this.cdir.z / cl;
      cine(V(p.x - cx * 6 + cz * 2.5, p.y + 3.4, p.z - cz * 6 - cx * 2.5), V(p.x + cx * 2.5, p.y + 0.9, p.z + cz * 2.5), 52);
    },
  });

  // 14. Combat: crystal golem, telegraph + plunge
  S.push({
    name: 'golem', dur: 8.5, fade: [0, 0.3], hud: true,
    cap: ['v0.2 · 精英', '晶甲魔像', '红圈预警砸地 · 跳起来一记下落重击'],
    async setup() {
      resetPlayer(); clearEnemies();
      tp(combatSpot.x - 25, combatSpot.z + 20, 0); d.time = 16; await SETTLE(8); clearEnemies();
      const p = P();
      this.e = g.combat.spawn('golem', p.x, p.z + 6, 4, 'crystal', 'pv');
      this.e.hp = this.e.maxHp = 150; this.e.state = 'chase'; this.e.t = 0.2;
      this.phase = 0; this.lastAtk = -9; this.rolled = -9;
    },
    update(t) {
      const p = P(), e = this.e;
      g.combat.hp = Math.max(g.combat.hp, 60);
      const dx = e.pos.x - p.x, dz = e.pos.z - p.z, dist = Math.hypot(dx, dz);
      g.cam.yaw = Math.atan2(-dx, -dz); // W = toward the golem
      if (e.alive) {
        if (e.state === 'windup' && e.t < 0.45 && t - this.rolled > 1.2) { hold('KeyS'); press('KeyQ'); this.rolled = t; }
        else if (e.state === 'recover' && g.player.mode === 'ground' && dist < 4.5 && this.phase === 0) { hold(); I._pending.add('Space'); this.phase = 1; this.jumpT = t; }
        else if (this.phase === 1 && t - this.jumpT > 0.32) { I._pending.add('KeyJ'); this.phase = 2; }
        else if (this.phase === 2 && g.player.mode === 'ground' && !g.combat.plunge) { this.phase = 3; }
        else if (this.phase === 3 && dist < 3.6 && t - this.lastAtk > 0.34) { hold(); I._pending.add('KeyJ'); this.lastAtk = t; }
        else if (t - this.rolled > 0.5 && this.phase !== 1 && this.phase !== 2) hold(dist > 3.2 ? 'KeyW' : undefined);
        if (this.phase === 3 && e.state === 'windup') this.phase = 0;
      } else hold();
      const a = -0.9 + t * 0.05, o = fwd(a);
      const c = { x: (e.pos.x + p.x) / 2, z: (e.pos.z + p.z) / 2 };
      cine(V(c.x + o.x * 8.5, p.y + 4.6, c.z + o.z * 8.5), V(c.x, p.y + 1.6, c.z), 52);
    },
  });

  // 15. Far-isle chest + loot
  S.push({
    name: 'chest', dur: 4.5, fade: [0.25, 0.4], hud: true,
    cap: ['v0.2 · 奖励', '远方宝箱与掉落', '击败蚀影、打开宝箱，带着收获回家'],
    async setup() {
      resetPlayer(); clearEnemies();
      tp(combatSpot.x + 8, combatSpot.z - 15, 0); d.time = 16.4; await SETTLE(8);
      const p = P();
      const y = window.__gh(p.x, p.z + 2);
      g.combat._addChest('pvchest' + Math.random(), p.x, y, p.z + 2, 4, 'pv');
      g.combat.chests[g.combat.chests.length - 1].m.rotation.y = Math.PI;
      g.combat.hp = 55;
    },
    update(t) {
      const p = P();
      if (Math.abs(t - 1.2) < DT / 2) I._pending.add('KeyE');
      cine(V(p.x + 4.8, p.y + 2.6, p.z - 1.2), V(p.x, p.y + 0.8, p.z + 1.4), 45);
    },
  });

  // 16. Night + lighthouse ending
  S.push({
    name: 'ending', dur: 10, fade: [0.6, 1.4], hud: false, bars: true, fog: [150, 1100],
    card: { logo: '星屑群岛', en: 'STARDUST ISLES', line: '收集星屑 · 点亮灯塔 · 走向无尽的远方', small: '所有模型、音乐与特效均由代码实时生成', at: [3.0, 99] },
    async setup() {
      resetPlayer(); clearEnemies();
      const lh = g.world.lighthouse;
      this.lh = lh;
      tp(lh.door.x, lh.door.z + 3, Math.PI); g.player.char.root.visible = false;
      lh.lamp.material.emissiveIntensity = 3; lh.beam.visible = true; lh.beam.material.opacity = 0.06;
      d.time = 20.8; await SETTLE(10);
    },
    update(t) {
      const lh = this.lh, top = lh.y + 16.8, a = 0.9 + t * 0.06;
      d.time = 20.8 + t * 0.02;
      cine(V(lh.x + Math.cos(a) * 95, top + 14 - t * 0.8, lh.z + Math.sin(a) * 95), V(lh.x, top - 6, lh.z), 50);
    },
  });

  // ---------------- Timeline ----------------
  let start = 0;
  for (const s of S) { s.f0 = Math.round(start * FPS); s.frames = Math.round(s.dur * FPS); start += s.dur; }
  const total = S.reduce((a, s) => a + s.frames, 0);
  let cur = null;

  window.__promo = {
    total, fps: FPS,
    timeline: S.map((s) => ({ name: s.name, start: s.f0 / FPS, dur: s.dur })),
    async frame(i) {
      const s = S.find((x) => i >= x.f0 && i < x.f0 + x.frames);
      if (!s) return { done: true };
      if (cur !== s) {
        cur = s;
        document.body.classList.toggle('cine', !s.hud);
        document.body.classList.toggle('nobanner', !!s.nobanner);
        g.sky.fogNear = s.fog ? s.fog[0] : 60; g.sky.fogFar = s.fog ? s.fog[1] : 520;
        cap.className = s.capPos || '';
        await s.setup();
      }
      const t = (i - s.f0) / FPS;
      s.update(t);
      await tick();
      // Overlays (after the step so they match the rendered frame)
      const barH = s.bars ? 64 : 0;
      bar1.style.height = bar2.style.height = barH + 'px';
      const fi = s.fade[0], fo = s.fade[1];
      let b = 0;
      if (fi > 0) b = Math.max(b, 1 - clamp(t / fi, 0, 1));
      if (fo > 0) b = Math.max(b, clamp((t - (s.dur - fo)) / fo, 0, 1));
      black.style.opacity = b;
      const capText = LANG === 'en' && Array.isArray(EN[s.name]) ? EN[s.name] : s.cap;
      if (capText) {
        cap.querySelector('.tag').textContent = capText[0];
        cap.querySelector('.ttl').textContent = capText[1];
        cap.querySelector('.sub').textContent = capText[2];
        const ca = ss(0.25, 0.75, t) * (1 - ss(s.dur - 0.6, s.dur - 0.15, t));
        cap.style.opacity = ca;
        cap.style.transform = `translateX(${(1 - ss(0.25, 0.9, t)) * -40}px)`;
        cap.style.bottom = (barH + 40) + 'px';
        if (s.capPos === 'tr') cap.style.transform = `translateX(${(1 - ss(0.25, 0.9, t)) * 40}px)`;
      } else cap.style.opacity = 0;
      if (s.card) {
        const [a0, a1] = s.card.at;
        const c = LANG === 'en' && EN[s.name]?.card ? EN[s.name].card : s.card;
        card.querySelector('.logo').textContent = c.logo;
        card.querySelector('.en').textContent = c.en;
        card.querySelector('.line').textContent = c.line;
        card.querySelector('.small').textContent = c.small;
        card.style.opacity = ss(a0, a0 + 1.2, t) * (1 - ss(a1 - 0.8, a1, t));
        card.style.transform = `scale(${1.06 - 0.06 * ss(a0, a0 + 2.5, t)})`;
      } else card.style.opacity = 0;
      // Quick white flash on the cut into combat
      flash.style.opacity = s.name === 'combo' ? Math.max(0, 0.7 - t * 3) : 0;
      const pp = g.player.pos;
      return { shot: s.name, t, dbg: `mode=${g.player.mode} pos=${pp.x.toFixed(1)},${pp.y.toFixed(1)},${pp.z.toFixed(1)} st=${g.player.stamina.toFixed(1)} en=${I.enabled} dlg=${g.dialog.active} frz=${g.player.frozen} axis=${JSON.stringify(I.axis())} clock=${g.clock.toFixed(2)} hs=${g.hitstop} menu=${g.menu.isOpen} photo=${g.photo.active} busy=${!!g.busy()}` };
    },
  };
})();
