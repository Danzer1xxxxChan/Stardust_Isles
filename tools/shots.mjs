// Scripted screenshots for visual checks.
// Usage: node tools/shots.mjs <url> <shots.json>
// shots.json: [{ "name": "x", "x": 0, "z": 0, "yaw": 0, "time": 12, "pitch": 0.25, "wait": 2500, "js": "g => ..." }]
import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.argv[2] || 'http://localhost:8090/';
const shots = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const out = 'tools/out';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}\n${e.stack}`));
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => !document.querySelector('.buttons').hidden, null, { timeout: 240000 });
await page.click('#btn-new');
await page.waitForTimeout(3000);
for (const s of shots) {
  const r = await page.evaluate(([s]) => {
    const g = window.__game;
    if (s.x !== undefined) { g.player.teleport(s.x, s.y ?? undefined, s.z); g.player.yaw = s.yaw ?? 0; g.cam.yaw = (s.yaw ?? 0) + Math.PI; }
    if (s.pitch !== undefined) g.cam.pitch = s.pitch;
    if (s.dist !== undefined) g.cam.wantDist = s.dist;
    if (s.time !== undefined) g.state.data.time = s.time;
    if (s.js) return String((new Function('g', s.js))(g));
    return '';
  }, [s]);
  await page.waitForTimeout(s.wait ?? 2500);
  if (s.after) await page.evaluate(([code]) => (new Function('g', code))(window.__game), [s.after]);
  if (s.afterWait) await page.waitForTimeout(s.afterWait);
  const info = await page.evaluate(() => { const g = window.__game, p = g.player.pos; return `pos=${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)} mode=${g.player.mode} hp=${g.combat.hp.toFixed(0)} enemies=${g.combat.enemies.length} chunks=${g.world.frontier.chunks.size}`; });
  if (!s.noshot) await page.screenshot({ path: `${out}/s-${s.name}.png` });
  console.log(s.name, r, info);
}
console.log('--- logs (' + logs.length + ') ---');
for (const l of logs.slice(0, 30)) console.log(l);
await browser.close();
