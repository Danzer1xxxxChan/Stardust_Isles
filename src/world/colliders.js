// Static + dynamic collision shapes. Cylinders and yaw-rotated boxes; tops can be walkable.

const CELL = 12;

export class Colliders {
  constructor() {
    this.grid = new Map();
    this.dynamic = new Set();
    this._seen = new Set();
    this._out = [];
  }

  _key(i, j) { return i * 100003 + j; }

  _insert(c) {
    const r = c.bound;
    const i0 = Math.floor((c.x - r) / CELL), i1 = Math.floor((c.x + r) / CELL);
    const j0 = Math.floor((c.z - r) / CELL), j1 = Math.floor((c.z + r) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = this._key(i, j);
      let list = this.grid.get(k);
      if (!list) this.grid.set(k, (list = []));
      list.push(c);
    }
  }

  // Cylinder from y0 to y1. walkable: top can be stood on.
  addCylinder(x, z, r, y0, y1, opts = {}) {
    const c = { type: 'cyl', x, z, r, y0, y1, bound: r, walkable: !!opts.walkable, tag: opts.tag, enabled: true };
    opts.dynamic ? this.dynamic.add(c) : this._insert(c);
    return c;
  }

  // Box with half extents hx, hz rotated by yaw around Y.
  addBox(x, z, hx, hz, y0, y1, yaw = 0, opts = {}) {
    const c = {
      type: 'box', x, z, hx, hz, y0, y1, yaw, cos: Math.cos(yaw), sin: Math.sin(yaw),
      bound: Math.hypot(hx, hz), walkable: opts.walkable !== false, tag: opts.tag, enabled: true,
    };
    opts.dynamic ? this.dynamic.add(c) : this._insert(c);
    return c;
  }

  setYaw(c, yaw) { c.yaw = yaw; c.cos = Math.cos(yaw); c.sin = Math.sin(yaw); }

  remove(c) { c.enabled = false; this.dynamic.delete(c); }

  // Fully unregisters a static shape (used when far-isle chunks stream out).
  removeStatic(c) {
    c.enabled = false;
    const r = c.bound;
    const i0 = Math.floor((c.x - r) / CELL), i1 = Math.floor((c.x + r) / CELL);
    const j0 = Math.floor((c.z - r) / CELL), j1 = Math.floor((c.z + r) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = this._key(i, j), list = this.grid.get(k);
      if (!list) continue;
      const at = list.indexOf(c);
      if (at >= 0) list.splice(at, 1);
      if (!list.length) this.grid.delete(k);
    }
  }

  query(x, z, r) {
    const out = this._out; out.length = 0;
    const seen = this._seen; seen.clear();
    const i0 = Math.floor((x - r) / CELL), i1 = Math.floor((x + r) / CELL);
    const j0 = Math.floor((z - r) / CELL), j1 = Math.floor((z + r) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const list = this.grid.get(this._key(i, j));
      if (!list) continue;
      for (const c of list) {
        if (!c.enabled || seen.has(c)) continue;
        seen.add(c);
        if (Math.abs(c.x - x) < c.bound + r && Math.abs(c.z - z) < c.bound + r) out.push(c);
      }
    }
    for (const c of this.dynamic) if (c.enabled && Math.abs(c.x - x) < c.bound + r && Math.abs(c.z - z) < c.bound + r) out.push(c);
    return out;
  }

  // Local coords of point in box frame.
  static local(c, x, z) {
    const dx = x - c.x, dz = z - c.z;
    return [dx * c.cos - dz * c.sin, dx * c.sin + dz * c.cos];
  }

  // Highest walkable top under (x,z) at or below maxY.
  supportHeight(x, z, r, maxY) {
    let best = -Infinity;
    for (const c of this.query(x, z, r)) {
      if (!c.walkable || c.y1 > maxY) continue;
      let inside;
      if (c.type === 'cyl') inside = Math.hypot(x - c.x, z - c.z) < c.r + r * 0.5;
      else {
        const [lx, lz] = Colliders.local(c, x, z);
        inside = Math.abs(lx) < c.hx + r * 0.5 && Math.abs(lz) < c.hz + r * 0.5;
      }
      if (inside && c.y1 > best) best = c.y1;
    }
    return best;
  }

  // Push a vertical capsule (feet y, height h, radius r) out of overlapping shapes. Mutates pos.
  resolve(pos, r, h) {
    let hit = false;
    for (const c of this.query(pos.x, pos.z, r)) {
      if (pos.y >= c.y1 - 0.05 || pos.y + h <= c.y0) continue;
      if (c.type === 'cyl') {
        const dx = pos.x - c.x, dz = pos.z - c.z;
        const d = Math.hypot(dx, dz), min = c.r + r;
        if (d < min) {
          const nx = d > 1e-5 ? dx / d : 1, nz = d > 1e-5 ? dz / d : 0;
          pos.x = c.x + nx * min; pos.z = c.z + nz * min;
          hit = true;
        }
      } else {
        const [lx, lz] = Colliders.local(c, pos.x, pos.z);
        const cx = Math.max(-c.hx, Math.min(c.hx, lx)), cz = Math.max(-c.hz, Math.min(c.hz, lz));
        let dx = lx - cx, dz = lz - cz;
        let d = Math.hypot(dx, dz);
        let nlx, nlz;
        if (d < 1e-5) {
          // Inside: push out along the shallowest axis.
          const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz);
          if (px < pz) { nlx = Math.sign(lx) || 1; nlz = 0; d = -px; } else { nlx = 0; nlz = Math.sign(lz) || 1; d = -pz; }
        } else { nlx = dx / d; nlz = dz / d; }
        if (d < r) {
          const push = r - d;
          const plx = lx + nlx * push, plz = lz + nlz * push;
          pos.x = c.x + plx * c.cos + plz * c.sin;
          pos.z = c.z - plx * c.sin + plz * c.cos;
          hit = true;
        }
      }
    }
    return hit;
  }
}
