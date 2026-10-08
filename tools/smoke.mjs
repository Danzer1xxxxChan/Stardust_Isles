// Headless smoke test: loads the game, starts a new run, teleports around and screenshots.
// Usage: node tools/smoke.mjs [url] [scenario]
import { chromium } from 'playwright';
import fs from 'node:fs';

const url = process.argv[2] || 'http://localhost:5199/';
const scenario = process.argv[3] || 'tour';
const out = 'tools/out';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}\n${e.stack}`));
const t0 = Date.now();
await page.goto(url);
try {
  await page.waitForFunction(() => !document.querySelector('.buttons').hidden || document.querySelector('#loading').textContent.includes('失败'), null, { timeout: 240000 });
} catch (e) { logs.push('load timeout'); }
console.log('loaded in', ((Date.now() - t0) / 1000).toFixed(1), 's');
await page.screenshot({ path: `${out}/00-title.png` });
await page.click('#btn-new');
await page.waitForTimeout(4000);
await page.screenshot({ path: `${out}/01-start.png` });

const shot = async (name, x, z, yaw, time, extra = '') => {
  await page.evaluate(([x, z, yaw, time, extra]) => {
    const g = window.__game;
    g.player.teleport(x, undefined, z);
    g.player.yaw = yaw;
    g.cam.yaw = yaw + Math.PI;
    g.cam.pitch = 0.25;
    g.state.data.time = time;
    if (extra) (new Function('g', extra))(g);
  }, [x, z, yaw, time, extra]);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${name}.png` });
};

if (scenario === 'tour') {
  await shot('02-village', 0, 175, Math.PI, 10);
  await shot('03-windmill', -28, 120, -2.4, 11);
  await shot('04-forest', -200, 40, -1.8, 12);
  await shot('05-canyon', 200, 0, 1.6, 13);
  await shot('06-coast', 200, 225, 1.0, 16);
  await shot('07-lake', -140, -140, -1.6, 9);
  await shot('08-mountain', 0, -120, Math.PI, 12);
  await shot('09-summit', 10, -232, Math.PI, 15);
  await shot('10-night-forest', -235, 10, -1.6, 22, "g.state.data.abilities.lantern = true;");
  await shot('11-ruins', -115, 262, Math.PI, 10);
  await shot('12-sunset-coast', -10, 320, 0, 18.3);
}
const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 3000) requestAnimationFrame(f); else res(n / 3); }; f(); }));
console.log('fps (software GL)', fps.toFixed(1));
const info = await page.evaluate(() => { const r = window.__game.renderer.info; return { calls: r.render.calls, tris: r.render.triangles, geos: r.memory.geometries }; });
console.log('render info', JSON.stringify(info));
console.log('--- logs (' + logs.length + ') ---');
for (const l of logs.slice(0, 40)) console.log(l);
await browser.close();
