// Proximity interactions: nearest valid target shows a prompt; E triggers its (async) action.
export class Interactions {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.current = null;
    this.running = false;
  }

  add(it) { this.list.push(it); return it; }
  remove(it) { const i = this.list.indexOf(it); if (i >= 0) this.list.splice(i, 1); }

  update() {
    const g = this.game;
    if (this.running || g.busy()) { g.hud.setPrompt(null); this.current = null; return; }
    const p = g.player.pos;
    let best = null, bd = Infinity;
    for (const it of this.list) {
      if (it.enabled === false) continue;
      const q = typeof it.pos === 'function' ? it.pos() : it.pos;
      const dx = q.x - p.x, dz = q.z - p.z, dy = (q.y ?? p.y) - p.y;
      const d = Math.hypot(dx, dz);
      if (d > (it.radius || 2.5) || Math.abs(dy) > (it.height || 3)) continue;
      const label = it.label();
      if (!label) continue;
      const score = d - (it.priority || 0);
      if (score < bd) { bd = score; best = { it, label }; }
    }
    this.current = best?.it || null;
    g.hud.setPrompt(best ? best.label : null);
    if (best && g.input.wasPressed('KeyE') && performance.now() - (g.dialog.closedAt || 0) > 250) this.run(best.it);
  }

  async run(it) {
    this.running = true;
    try { await it.action(); } catch (e) { console.error(e); }
    this.running = false;
  }
}
