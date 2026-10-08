// Functional test: drives the real game with simulated keyboard input and checks state.
import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.argv[2] || 'http://localhost:5199/';
const out = 'tools/out';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('console', (m) => { if (['error'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}\n${e.stack}`));
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => !document.querySelector('.buttons').hidden, null, { timeout: 240000 });
await page.click('#btn-new');
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.__game; g.state.data.settings.shadows = false; g.applySettings(); g.renderer.setPixelRatio(1); });

const results = [];
const check = (name, ok, info = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`); };
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = async (ms) => {
  // Wait in *game* time so slow software rendering does not break timing-sensitive checks.
  const t0 = await page.evaluate(() => window.__game.clock);
  const deadline = Date.now() + ms * 12 + 2000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(Math.min(60, ms));
    const t = await page.evaluate(() => window.__game.clock);
    if (t - t0 >= ms / 1000) return;
  }
};
const tp = (x, z, yaw = 0, y) => ev(([x, z, yaw, y]) => { const g = window.__game; g.player.teleport(x, y ?? undefined, z); g.player.yaw = yaw; g.cam.yaw = yaw + Math.PI; }, [x, z, yaw, y ?? null]);
const key = async (k, ms = 80) => { await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); };
const finishDialog = async (maxSteps = 40) => {
  for (let i = 0; i < maxSteps; i++) {
    const active = await ev(() => window.__game.dialog.active);
    if (!active) return true;
    await key('Space', 40);
    await wait(120);
  }
  return false;
};
const S = () => ev(() => { const g = window.__game, d = g.state.data, p = g.player; return { shards: d.shards, feathers: d.feathers, met: d.met, ab: d.abilities, codex: d.codex, mode: p.mode, pos: { x: p.pos.x, y: p.pos.y, z: p.pos.z }, coins: d.coins, time: d.time, ending: d.ending }; });

try {
  // 1. Talk to Aila
  const aila = await ev(() => { const n = window.__game.npcs.get('aila'); return { x: n.pos.x, z: n.pos.z }; });
  await tp(aila.x, aila.z + 2, Math.PI);
  await wait(400);
  await key('KeyE');
  await wait(300);
  const opened = await ev(() => window.__game.dialog.active);
  const closed = await finishDialog();
  let s = await S();
  check('talk to Aila', opened && closed && s.met.includes('aila'), JSON.stringify({ opened, closed }));
  await page.screenshot({ path: `${out}/f-aila.png` });

  // 2. Pip gives the camera
  const pip = await ev(() => { const n = window.__game.npcs.get('pip'); return { x: n.pos.x, z: n.pos.z }; });
  await tp(pip.x + 1.5, pip.z + 1.5, -2.3);
  await wait(400);
  await key('KeyE'); await wait(300); await finishDialog();
  s = await S();
  check('Pip gives camera', s.ab.camera);

  // 3. Windmill shard via the crate staircase (teleport onto balcony)
  const wm = await ev(() => window.__game.world.anchors.windmill);
  await tp(wm.x, wm.z, 0, wm.y - 1.2);
  await wait(800);
  s = await S();
  check('windmill shard pickup', s.shards.includes('windmill'), `shards=${s.shards.length}`);

  // 4. Walking
  await tp(0, 160, Math.PI);
  await wait(300);
  const p0 = (await S()).pos;
  await page.keyboard.down('KeyW'); await wait(2000); await page.keyboard.up('KeyW');
  const p1 = (await S()).pos;
  const walked = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  check('walk ~7m/s', walked > 8 && walked < 20, `dist=${walked.toFixed(1)}`);

  // 5. Jump
  await page.keyboard.down('Space'); await wait(250);
  s = await S();
  await page.keyboard.up('Space');
  check('jump', s.mode === 'air' && s.pos.y > p1.y + 0.5, `mode=${s.mode} dy=${(s.pos.y - p1.y).toFixed(2)}`);
  await wait(1000);

  // 6. Glide from the lookout across the river
  await ev(() => window.__game.state.grant('glider'));
  const lk = await ev(() => window.__game.content.lookout);
  await tp(lk.x + 6, lk.z, Math.PI / 2);
  await wait(400);
  const g0 = (await S()).pos;
  await page.keyboard.down('KeyW');
  await key('Space', 100); await wait(350);
  await page.keyboard.down('Space');
  await wait(400);
  const midMode = (await S()).mode;
  await wait(3600);
  await page.keyboard.up('Space'); await page.keyboard.up('KeyW');
  const g1 = (await S()).pos;
  check('glide', midMode === 'glide' && g1.x - g0.x > 30, `mode=${midMode} dx=${(g1.x - g0.x).toFixed(1)} y=${g1.y.toFixed(1)}`);
  await page.screenshot({ path: `${out}/f-glide.png` });
  await wait(2500);

  // 7. Climb the first mountain cliff band (south side)
  await ev(() => { const g = window.__game; g.state.data.feathers.push('t1', 't2'); g.player.stamina = g.player.maxStamina; });
  let start = null;
  for (let z = -100; z > -140; z -= 1) {
    const v = await ev((z) => { const { groundNormal } = window.__terrain || {}; return null; }, z);
    break;
  }
  await tp(0, -104, Math.PI);
  await wait(300);
  const c0 = (await S()).pos;
  await page.keyboard.down('KeyW'); await wait(1500);
  const cMid = await S();
  await wait(3500); await page.keyboard.up('KeyW');
  const c1 = (await S()).pos;
  check('climb cliff', c1.y - c0.y > 6, `y ${c0.y.toFixed(1)} -> ${c1.y.toFixed(1)} midMode=${cMid.mode}`);
  await page.screenshot({ path: `${out}/f-climb.png` });

  // 8. Cold water respawn without fins
  await tp(0, 160, 0);
  await page.keyboard.down('KeyW'); await wait(200); await page.keyboard.up('KeyW');
  await wait(800);
  await ev(() => { const p = window.__game.player; p.pos.set(-10, -1.2, 360); });
  await wait(400);
  const sw = (await S()).mode;
  await wait(2500);
  s = await S();
  check('cold water respawns', sw === 'swim' && s.pos.z < 340, `mode=${sw} z=${s.pos.z.toFixed(1)}`);

  // 9. Swim with fins in the lake
  await ev(() => window.__game.state.grant('fins'));
  await tp(-190, -150, 0, 12.5);
  await wait(400);
  await page.keyboard.down('KeyW'); await wait(2500); await page.keyboard.up('KeyW');
  s = await S();
  check('swim with fins', s.mode === 'swim' && Math.abs(s.pos.y - 12.95) < 0.3, `mode=${s.mode} y=${s.pos.y.toFixed(2)}`);

  // 10. Menu & map
  await tp(0, 160, 0);
  await wait(300);
  await key('Tab'); await wait(500);
  const menuOpen = await ev(() => window.__game.menu.isOpen);
  await page.screenshot({ path: `${out}/f-menu-map.png` });
  for (const t of ['quests', 'collect', 'codex', 'wardrobe', 'settings']) { await ev((t) => window.__game.menu.show(t), t); await wait(150); }
  await page.screenshot({ path: `${out}/f-menu-settings.png` });
  await ev(() => window.__game.menu.show('quests')); await wait(150);
  await page.screenshot({ path: `${out}/f-menu-quests.png` });
  await key('Tab'); await wait(400);
  check('menu open/close', menuOpen && !(await ev(() => window.__game.menu.isOpen)));

  // 11. Photo of the windmill
  await ev(() => { const g = window.__game, w = g.content.village.windmill; g.player.teleport(w.x + 20, undefined, w.z + 20); const yaw = Math.atan2(w.x - g.player.pos.x, w.z - g.player.pos.z); g.player.yaw = yaw; g.cam.yaw = yaw + Math.PI; g.cam.pitch = -0.15; });
  await wait(500);
  await key('KeyC'); await wait(600);
  const photoOn = await ev(() => window.__game.photo.active);
  await page.mouse.click(640, 360); await wait(400);
  await page.screenshot({ path: `${out}/f-photo.png` });
  await key('KeyC'); await wait(300);
  s = await S();
  check('photo registers windmill', photoOn && s.codex.includes('windmill'), JSON.stringify(s.codex));

  // 12. Ring course (simulate passing through rings)
  const course = await ev(() => { const c = window.__game.challenges.courses[0]; return { totem: c.totem, rings: c.rings.map((r) => ({ x: r.x, y: r.y, z: r.z })), ux: c.ux, uz: c.uz }; });
  await tp(course.totem.x + 1, course.totem.z + 1, 0);
  await wait(400);
  await key('KeyE'); await wait(300);
  const active = await ev(() => !!window.__game.challenges.activeCourse);
  await ev(() => { window.__game.player.frozen = true; });
  for (const r of course.rings) {
    await ev(([r, ux, uz]) => { const p = window.__game.player.pos; p.set(r.x - ux * 2, r.y - 0.9, r.z - uz * 2); }, [r, course.ux, course.uz]); await wait(150);
    await ev(([r, ux, uz]) => { const p = window.__game.player.pos; p.set(r.x + ux * 1, r.y - 0.9, r.z + uz * 1); }, [r, course.ux, course.uz]); await wait(150);
  }
  await ev(() => { window.__game.player.frozen = false; });
  await wait(500);
  s = await S();
  check('ring course', active && s.shards.includes('ring_canyon1'), `active=${active}`);
  const courseInfo = await ev(() => window.__game.challenges.courses.map((c) => ({ id: c.id, start: [c.start.x, c.start.y.toFixed(1), c.start.z], rings: c.rings.map((r) => r.y.toFixed(1)).join(','), limit: c.limit })));
  results.push('      courses: ' + JSON.stringify(courseInfo));

  // 13. Box puzzle push
  const box = await ev(() => { const b = window.__game.challenges.puzzle.boxes[0]; return { x: b.mesh.position.x, z: b.mesh.position.z, y: window.__game.challenges.puzzle.y0, i: b.i, j: b.j }; });
  await tp(box.x - 1.6, box.z, Math.PI / 2, box.y);
  await ev(() => { window.__game.cam.yaw = 0; });
  await wait(300);
  await page.keyboard.down('KeyD'); await wait(1200); await page.keyboard.up('KeyD');
  await wait(400);
  const box2 = await ev(() => { const b = window.__game.challenges.puzzle.boxes[0]; return { i: b.i, j: b.j }; });
  check('push box', box2.i > box.i, `from ${box.i},${box.j} to ${box2.i},${box2.j}`);

  // 14. Mirror puzzle logic
  await ev(() => { const ch = window.__game.challenges, set = ch.mirrorSets[0]; set.sel.A = 0; set.sel.B = 1; ch._traceMirrors(set); });
  await wait(300);
  s = await S();
  check('mirror puzzle 1', s.shards.includes('mirror1'));
  await ev(() => { const ch = window.__game.challenges, set = ch.mirrorSets[1]; set.sel.C = 1; set.sel.D = 2; set.sel.E = 3; ch._traceMirrors(set); });
  await wait(300);
  s = await S();
  check('mirror puzzle 2', s.shards.includes('mirror2'));

  // 15. Fishing at the dock
  await ev(() => window.__game.state.grant('rod'));
  const dock = await ev(() => window.__game.world.anchors.dockEnd);
  await tp(dock.x, dock.z, 0, dock.y);
  await wait(400);
  const lbl = await ev(() => window.__game.interact.current && window.__game.hud._last.prompt);
  await key('KeyE'); await wait(300);
  const fishing = await ev(() => window.__game.fishing.active);
  let caught = false;
  for (let i = 0; i < 400 && fishing; i++) {
    const st = await ev(() => {
      const ui = document.querySelector('#fishing');
      const title = ui.querySelector('.fish-title').textContent;
      const bar = ui.querySelector('.bar');
      if (bar.hidden) return { title };
      const m = window.__game.fishing.mg;
      if (!m) return { title };
      let nx = m.x + m.dir * m.speed * 0.1;
      if (nx > 1) nx = 2 - nx; else if (nx < 0) nx = -nx;
      const inZ = (v) => v >= m.zx + 0.02 && v <= m.zx + m.width - 0.02;
      return { title, inZone: inZ(m.x) && inZ(nx) };
    });
    if (st.title.includes('咬钩')) { await key('KeyE', 30); }
    else if (st.inZone) { await key('KeyE', 30); await wait(60); }
    if (!(await ev(() => window.__game.fishing.active))) { caught = true; break; }
    await wait(25);
  }
  s = await S();
  const fishKinds = s.codex.filter((c) => ['bass', 'mackerel', 'puffer', 'golden', 'lanternfish'].includes(c));
  check('fishing', fishing && fishKinds.length > 0, `prompt=${lbl} kinds=${fishKinds}`);

  // 16. Campfire rest to night
  const fire = await ev(() => window.__game.world.campfires.find((c) => c.id === 'village'));
  await tp(fire.x + 1.5, fire.z + 1.5, 0);
  await wait(400);
  await key('KeyE'); await wait(500);
  for (let i = 0; i < 3; i++) { await key('ArrowDown', 40); await wait(80); }
  await key('Space'); await wait(2500);
  s = await S();
  check('rest at campfire', Math.abs(s.time - 22) < 0.3, `time=${s.time.toFixed(2)}`);
  await page.screenshot({ path: `${out}/f-night-village.png` });

  // 17. Ending
  await ev(() => { const d = window.__game.state.data; while (d.shards.length < 20) d.shards.push('test' + d.shards.length); });
  const door = await ev(() => window.__game.world.lighthouse.door);
  await tp(door.x, door.z + 1, Math.PI, door.y);
  await wait(500);
  await key('KeyE');
  await wait(14000);
  await page.screenshot({ path: `${out}/f-ending.png` });
  const btn = await page.$('#end-continue');
  if (btn) await btn.click();
  await wait(500);
  s = await S();
  check('ending', s.ending);

  // 18. Save / continue
  await ev(() => { const g = window.__game; g.state.data.pos = { x: g.player.pos.x, y: g.player.pos.y, z: g.player.pos.z }; g.state.save(); });
  const before = await S();
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('.buttons').hidden, null, { timeout: 240000 });
  const hasCont = await ev(() => !document.querySelector('#btn-continue').hidden);
  await page.click('#btn-continue');
  await page.waitForTimeout(2500);
  s = await S();
  check('save/continue', hasCont && s.shards.length === before.shards.length && Math.abs(s.pos.x - before.pos.x) < 1 && s.ending, `shards=${s.shards.length}`);
} catch (e) {
  results.push('EXCEPTION ' + e.message + '\n' + e.stack);
}
console.log(results.join('\n'));
console.log('--- page errors (' + logs.length + ') ---');
for (const l of logs.slice(0, 30)) console.log(l);
await browser.close();
