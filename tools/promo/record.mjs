// Records the promo video frame-by-frame with GPU Chromium (ANGLE/Vulkan).
// Usage: node tools/promo/record.mjs [url] [--preview] [--width 1920 --height 1080] [--quality ultra]
//   --preview: render every frame but only save ~3 stills per shot (fast framing check).
//   --lang en: record the English version (UI, dialogue and captions) into tools/out/promo-en.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const url = args.find((a) => a.startsWith('http')) || 'http://localhost:8090/';
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const preview = args.includes('--preview');
const lang = opt('lang', 'zh');
const W = +opt('width', 1920), H = +opt('height', 1080), quality = opt('quality', 'ultra');
const outDir = opt('out', lang === 'en' ? 'tools/out/promo-en' : 'tools/out/promo');
const frameDir = path.join(outDir, preview ? 'preview' : 'frames');
fs.rmSync(frameDir, { recursive: true, force: true });
fs.mkdirSync(frameDir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-background-timer-throttling'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') logs.push('error: ' + m.text()); });
await page.goto(url);
await page.evaluate((lang) => { localStorage.clear(); if (lang !== 'zh') localStorage.setItem('stardust-isles-lang', lang); }, lang);
await page.reload();
await page.waitForFunction(() => !document.querySelector('.buttons').hidden, null, { timeout: 240000 });
await page.click('#btn-new');
await page.waitForTimeout(1500);
const renderer = await page.evaluate((q) => {
  const g = window.__game;
  g.state.data.settings.quality = q; g.state.data.settings.shadows = true; g.applySettings();
  const gl = g.renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info');
  return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?';
}, quality);
console.log('renderer:', renderer);
await page.addScriptTag({ content: fs.readFileSync(new URL('./director.js', import.meta.url), 'utf8') });
const { total, timeline, fps } = await page.evaluate(() => ({ total: window.__promo.total, timeline: window.__promo.timeline, fps: window.__promo.fps }));
fs.writeFileSync(path.join(outDir, 'timeline.json'), JSON.stringify({ fps, total, timeline }, null, 1));
console.log(`frames: ${total} (${(total / fps).toFixed(1)} s)`);

const keep = new Set();
if (preview) for (const s of timeline) for (const k of [0.15, 0.5, 0.85]) keep.add(Math.round((s.start + s.dur * k) * fps));
const t0 = Date.now();
for (let i = 0; i < total; i++) {
  const r = await page.evaluate((i) => window.__promo.frame(i), i);
  if (!preview || keep.has(i)) {
    const name = preview ? `${String(i).padStart(5, '0')}-${r.shot}.jpg` : `${String(i).padStart(5, '0')}.jpg`;
    await page.screenshot({ path: path.join(frameDir, name), type: 'jpeg', quality: 93 });
    if (preview) console.log(i, r.shot, r.t.toFixed(2), r.dbg);
  }
  if (i % 150 === 0) console.log(`frame ${i}/${total} ${r.shot} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
console.log('--- logs (' + logs.length + ') ---');
for (const l of logs.slice(0, 30)) console.log(l);
await browser.close();
