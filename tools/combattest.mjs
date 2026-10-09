// Combat functional test: swings, damage, enemy AI hitting the player, dodge, wildlife, death/respawn.
import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.argv[2] || 'http://localhost:8090/';
const out = 'tools/out';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}\n${e.stack}`));
page.on('console', (m) => { if (m.type() === 'error') logs.push('error: ' + m.text()); });
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => !document.querySelector('.buttons').hidden, null, { timeout: 240000 });
await page.click('#btn-new');
await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.__game; g.applyQuality('low'); g.state.data.settings.quality = 'low'; });
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = async (ms) => {
  const t0 = await ev(() => window.__game.clock);
  const deadline = Date.now() + ms * 15 + 3000;
  while (Date.now() < deadline) { await page.waitForTimeout(Math.min(50, ms)); if ((await ev(() => window.__game.clock)) - t0 >= ms / 1000) return; }
};
const key = async (k, ms = 60) => { await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); };
const results = [];
const check = (n, ok, info = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${n} ${info}`);
try {
  // Setup: open field south-west of the village, daytime.
  await ev(() => { const g = window.__game; g.state.data.time = 11; g.player.teleport(-40, undefined, 200); g.player.yaw = 0; g.cam.yaw = Math.PI; });
  await wait(300);
  // 1. Combo on a slime
  const e0 = await ev(() => { const g = window.__game, p = g.player.pos; const e = g.combat.spawn('slime', p.x, p.z + 2.2, 1, 'meadow', 'test'); e.state = 'hurt'; e.t = 5; return { hp: e.hp, coins: g.state.data.coins }; });
  await key('KeyJ'); await wait(200); await key('KeyJ'); await wait(200);
  await page.screenshot({ path: `${out}/c-swing.png` });
  await key('KeyJ'); await wait(700);
  const e1 = await ev(() => { const g = window.__game; const e = g.combat.enemies.find((x) => x.tag === 'test'); return { hp: e ? e.hp : null, alive: e ? e.alive : false, coins: g.state.data.coins, n: g.combat.enemies.length }; });
  check('combo damages / kills slime', e1.hp === null || e1.hp < e0.hp, JSON.stringify({ e0, e1 }));
  check('kill reward coins', !e1.alive ? e1.coins > e0.coins : true, `coins ${e0.coins} -> ${e1.coins}`);
  // 2. Wolf attacks the player
  await ev(() => { const g = window.__game, p = g.player.pos; g.combat.spawn('wolf', p.x + 5, p.z + 5, 2, 'forest', 'test2'); });
  let hp0 = await ev(() => window.__game.combat.hp);
  for (let i = 0; i < 40; i++) { await wait(150); if ((await ev(() => window.__game.combat.hp)) < hp0) break; }
  const hp1 = await ev(() => window.__game.combat.hp);
  check('wolf hurts player', hp1 < hp0, `hp ${hp0} -> ${hp1}`);
  await page.screenshot({ path: `${out}/c-wolf.png` });
  // 3. Dodge roll moves the player and grants i-frames
  await wait(800);
  const d0 = await ev(() => { const p = window.__game.player.pos; return { x: p.x, z: p.z }; });
  await page.keyboard.down('KeyD'); await key('KeyQ'); await wait(150);
  const inv = await ev(() => window.__game.combat.invuln > 0 || !!window.__game.combat.dodge);
  await wait(400); await page.keyboard.up('KeyD');
  const d1 = await ev(() => { const p = window.__game.player.pos; return { x: p.x, z: p.z }; });
  check('dodge roll', Math.hypot(d1.x - d0.x, d1.z - d0.z) > 2 && inv, `moved ${Math.hypot(d1.x - d0.x, d1.z - d0.z).toFixed(1)} inv=${inv}`);
  // Clear wolves
  await ev(() => { const g = window.__game; for (const e of g.combat.enemies) e.dispose(); g.combat.enemies.length = 0; g.combat.hp = g.combat.maxHp; });
  // 4. Golem telegraph
  await ev(() => { const g = window.__game, p = g.player.pos; g.combat.spawn('golem', p.x, p.z + 3.5, 3, 'canyon', 'test3'); g.player.yaw = 0; g.cam.yaw = Math.PI; });
  let tele = false;
  for (let i = 0; i < 30 && !tele; i++) { await wait(100); tele = await ev(() => window.__game.combat.enemies.some((e) => e.kind === 'golem' && e.state === 'windup')); }
  await wait(500);
  await page.screenshot({ path: `${out}/c-golem.png` });
  check('golem winds up a slam', tele);
  await ev(() => { const g = window.__game; for (const e of g.combat.enemies) e.dispose(); g.combat.enemies.length = 0; g.combat.hp = g.combat.maxHp; });
  // 5. Wildlife: hit a sheep
  const sh = await ev(() => { const g = window.__game; const c = g.creatures.list.find((c) => c.kind === 'sheep' && c.targetable); g.player.teleport(c.obj.position.x, undefined, c.obj.position.z - 1.8); g.player.yaw = 0; g.cam.yaw = Math.PI; c.t = 99; c.target = null; return { hp: c.hp }; });
  await wait(100);
  await key('KeyJ'); await wait(500);
  const sh1 = await ev(() => { const g = window.__game; const c = g.creatures.list.find((c) => c.kind === 'sheep' && c.lastHit > 0); return c ? { hp: c.hp, flee: c.fleeT } : null; });
  check('sheep takes damage and flees', sh1 && sh1.hp < sh.hp && sh1.flee > 0, JSON.stringify(sh1));
  await page.screenshot({ path: `${out}/c-sheep.png` });
  // 6. Plunge attack
  await ev(() => { const g = window.__game, x = g.player.pos.x + 10, z = g.player.pos.z; g.player.teleport(x, undefined, z); const e = g.combat.spawn('slime', x, z + 1, 1, 'meadow', 'test4'); e.state = 'hurt'; e.t = 5; g.player.pos.y += 6; g.player.mode = 'air'; });
  await wait(100); await key('KeyJ'); await wait(900);
  const pl = await ev(() => { const g = window.__game; const e = g.combat.enemies.find((x) => x.tag === 'test4'); return { hp: e ? e.hp : null, max: e ? e.maxHp : null, plunge: g.combat.plunge }; });
  check('plunge attack hits', pl.hp === null || pl.hp < pl.max, JSON.stringify(pl));
  // 7. Death and respawn at a campfire
  await ev(() => { const g = window.__game; for (const e of g.combat.enemies) e.dispose(); g.combat.enemies.length = 0; g.state.addCoins(40); g.combat.hp = 5; g.combat.invuln = 0; g.combat.hurtPlayer(50, { x: g.player.pos.x + 1, y: 0, z: g.player.pos.z }); });
  await wait(4500);
  const dd = await ev(() => { const g = window.__game, p = g.player.pos; return { alive: g.combat.playerAlive, hp: g.combat.hp, d: Math.hypot(p.x - 22, p.z - 172) }; });
  check('death -> respawn at campfire', dd.alive && dd.hp > 50 && dd.d < 12, JSON.stringify(dd));
  // 8. Far isles: walk out along the east causeway, chunks + spawns appear
  await ev(() => { const g = window.__game; const a = -0.5; g.player.teleport(Math.cos(a) * 600, undefined, Math.sin(a) * 600); });
  await wait(3000);
  const far = await ev(() => { const g = window.__game, p = g.player.pos; return { y: p.y, chunks: g.world.frontier.chunks.size, enemies: g.combat.enemies.length, region: g._regionCur }; });
  check('far isles stream in', far.chunks > 5, JSON.stringify(far));
} catch (e) { results.push('ERROR ' + e.stack); }
console.log(results.join('\n'));
console.log('--- logs (' + logs.length + ') ---');
for (const l of logs.slice(0, 20)) console.log(l);
await browser.close();
