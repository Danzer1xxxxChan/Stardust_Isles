import { buildTerrain, groundHeight, groundNormal, regionAt, highestPoint, waterLevel } from '../src/world/terrain.js';
import * as L from '../src/world/layout.js';
const t0 = Date.now(); buildTerrain(); console.log('build ms', Date.now() - t0);
const p = (name, x, z) => { const n = groundNormal(x, z); console.log(name.padEnd(14), x, z, 'h=', groundHeight(x, z).toFixed(1), 'ny=', n.y.toFixed(2), regionAt(x, z), 'water', waterLevel(x,z)); };
for (const [k, r] of Object.entries(L.REGIONS)) p(k, r.x, r.z);
for (const [k, r] of Object.entries(L.LANDMARKS)) p(k, r.x, r.z);
for (const c of L.CAMPFIRES) p('fire:' + c.id, c.x, c.z);
L.ISLETS.forEach((b, i) => p('islet' + i, b.x, b.z));
L.LAKE_ISLANDS.forEach((b, i) => p('lakeisl' + i, b.x, b.z));
console.log('summit', highestPoint(0, -235, 30));
console.log('canyon high', highestPoint(235, -30, 120));
// mountain radial profile north->south
let s = ''; for (let r = 180; r >= 0; r -= 6) s += groundHeight(0, -235 + r).toFixed(0) + ' '; console.log('mtn profile S', s);
s = ''; for (let x = 60; x <= 180; x += 6) s += groundHeight(x, 60).toFixed(0) + ' '; console.log('river @z60', s);
// ascii map
const chars = ' .:-=+*#%@';
for (let z = -440; z <= 440; z += 20) { let line = ''; for (let x = -440; x <= 440; x += 10) { const h = groundHeight(x, z); line += h < 0 ? (h < -3 ? '~' : '-') : (h > 60 ? '^' : chars[Math.min(9, Math.floor(h / 6))] ); } console.log(line); }
// candidate searches
const hp = (n, x, z, r) => { const h = highestPoint(x, z, r); console.log(n, h.x, h.z, h.y.toFixed(1)); };
hp('canyonN', 250, -90, 50); hp('canyonS', 230, 60, 40); hp('canyonE', 320, -20, 40); hp('canyonW', 170, -60, 30);
hp('coastCliff', 260, 170, 40); hp('lakeRim', -190, -150, 90);
const shore = (x, z, dx, dz) => { let px = x, pz = z; for (let i = 0; i < 400; i++) { const nx = px + dx, nz = pz + dz; if (groundHeight(nx, nz) < 0.4) return [px.toFixed(0), pz.toFixed(0), groundHeight(px, pz).toFixed(1)]; px = nx; pz = nz; } return null; };
console.log('shore S from village', shore(-10, 150, 0, 1));
console.log('shore SE from coast', shore(190, 215, 0.7, 0.7));
console.log('shore E from coast', shore(190, 215, 1, 0));
console.log('shore S from coast', shore(190, 215, 0, 1));
console.log('shore SW from ruins', shore(-115, 245, -0.6, 0.8));
console.log('river z for x', [ -100, -60, 0, 60, 120, 200, 280].map(z => z + ':' + (118 + 12*Math.sin(z*0.018)).toFixed(0)).join(' '));
