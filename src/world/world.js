// Builds the whole static world and exposes anchors for gameplay content.
import * as THREE from 'three';
import { buildTerrain, groundHeight } from './terrain.js';
import { createTerrain } from './terrainMesh.js';
import { createWater } from './water.js';
import { Sky } from './sky.js';
import { Colliders } from './colliders.js';
import { StructureBuilder, baseY } from './structures.js';
import { scatterWorld } from './scatter.js';
import { resolveContent } from '../game/content.js';

export function buildWorld(scene, renderer) {
  buildTerrain();
  const content = resolveContent();
  const colliders = new Colliders();
  const exclusions = [];
  const codexSpots = [];
  const sky = new Sky(scene, renderer);
  scene.add(createTerrain());
  const water = createWater(scene);
  const sb = new StructureBuilder(scene, colliders, exclusions);
  const A = {};

  // Village
  const V = content.village;
  sb.well(V.well.x, V.well.z);
  for (const h of V.houses) sb.house(h.x, h.z, h.yaw, h);
  sb.stall(V.stall.x, V.stall.z, V.stall.yaw);
  const wm = sb.windmill(V.windmill.x, V.windmill.z);
  A.windmill = { x: wm.x + 2.6, y: wm.top + 1.2, z: wm.z + 1.6 };
  codexSpots.push({ id: 'windmill', x: wm.x, y: wm.y + 8, z: wm.z, big: true });
  const lamps = V.lamps.map(([x, z]) => sb.lampPost(x, z));
  for (const b of V.benches) sb.bench(b.x, b.z, b.yaw);
  exclusions.push({ x: V.well.x, z: V.well.z, r: 40 });
  for (const [x, z, h] of content.pillarCourse) sb.pillar(x, z, h, 1.0);
  const pc = content.pillarCourse[content.pillarCourse.length - 1];
  A.pillarTop = { x: pc[0], y: baseY(pc[0], pc[1], 1) + pc[2] + 1.2, z: pc[1] };
  sb.fenceRing(content.pen.x, content.pen.z, content.pen.r, content.pen.gap, 0.45);
  exclusions.push({ x: content.pen.x, z: content.pen.z, r: content.pen.r + 3 });
  sb.flag(content.lookout.x, content.lookout.z, 0xf2c94c);
  sb.bench(content.lookout.x + 2.5, content.lookout.z + 1, 0.8);
  exclusions.push({ x: content.lookout.x, z: content.lookout.z, r: 6 });
  const dock = sb.dock(content.dock.x, content.dock.z, content.dock.yaw, content.dock.len);
  A.dockEnd = { x: dock.end.x, y: dock.y, z: dock.end.z - 1.5 };
  A.dockMid = { x: dock.end.x - 0.9, y: dock.y, z: dock.end.z - 8 };
  A.dockEndWater = { x: dock.end.x + 4, y: 0, z: dock.end.z + 3 };
  exclusions.push({ x: content.dock.x, z: content.dock.z, r: 6 });

  // Ruins
  const ru = sb.ruins(content.ruins.x, content.ruins.z);
  A.ruins = ru;
  A.ruinsAltar = { x: ru.altar.x, y: ru.altar.y + 1.3, z: ru.altar.z };
  codexSpots.push({ id: 'ruins', x: ru.x, y: ru.y + 2, z: ru.z, big: true });
  // tallest ruins pillar gets a feather: pillars are walkable cylinders at r=10.5
  {
    let best = null;
    for (const c of colliders.query(ru.x, ru.z, 12)) if (c.type === 'cyl' && c.walkable && (!best || c.y1 > best.y1)) best = c;
    A.ruinsPillar = best ? { x: best.x, y: best.y1 + 1.2, z: best.z } : { x: ru.x, y: ru.y + 3, z: ru.z };
  }

  // Forest
  const gt = sb.giantTree(content.giantTree.x, content.giantTree.z);
  A.treeTop = { x: gt.x + 1.5, y: gt.top + 1.2, z: gt.z };
  A.treeTopChest = { x: gt.x - 1.8, y: gt.top, z: gt.z + 1.0 };
  {
    const a = 8 * 0.75, h = 1.0 + 8 * 1.15;
    A.treeMid = { x: gt.x + Math.cos(a) * 3.9, y: gt.y + h + 0.17 + 1.2, z: gt.z + Math.sin(a) * 3.9 };
  }
  codexSpots.push({ id: 'giantTree', x: gt.x, y: gt.y + 10, z: gt.z, big: true });

  // Canyon
  const ar = sb.arch(content.arch.x, content.arch.z, content.arch.yaw);
  codexSpots.push({ id: 'arch', x: ar.x, y: ar.y + 5, z: ar.z, big: true });
  A.arch = ar;
  const hpk = content.hoodooPeak;
  const pkTop = sb.pillar(hpk.x, hpk.z, hpk.h, 1.6, 0xb4613b);
  A.hoodooPeak = { x: hpk.x, y: pkTop + 1.2, z: hpk.z };
  content.hoodoos.forEach((h, i) => {
    const top = sb.pillar(h.x, h.z, h.h, 1.5, 0xa65535);
    A['hoodoo' + (i + 1)] = { x: h.x, y: top + 1.2, z: h.z };
  });

  // Coast
  const sw = sb.shipwreck(content.shipwreck.x, content.shipwreck.z, content.shipwreck.yaw);
  A.wreckBow = { x: sw.bow.x, y: sw.bow.y + 1.2, z: sw.bow.z };
  A.wreckDeck = { x: sw.x, y: sw.y, z: sw.z };
  codexSpots.push({ id: 'shipwreck', x: sw.x, y: sw.y, z: sw.z, big: true });
  const st = content.seaStack;
  const stTop = sb.pillar(st.x, st.z, st.h - groundHeight(st.x, st.z), 1.8, 0x8f8b85);
  A.seaStack = { x: st.x, y: stTop + 1.2, z: st.z };
  const rp = content.riverPillar;
  const rpTop = sb.pillar(rp.x, rp.z, rp.h - groundHeight(rp.x, rp.z), 1.6, 0x9a958e);
  A.riverPillar = { x: rp.x, y: rpTop + 1.2, z: rp.z };

  // Mountain & observatory
  const lh = sb.lighthouse(content.lighthouse.x, content.lighthouse.z);
  codexSpots.push({ id: 'lighthouse', x: lh.x, y: lh.y + 10, z: lh.z, big: true });
  const ob = sb.observatory(content.observatory.x, content.observatory.z);
  codexSpots.push({ id: 'observatory', x: ob.x, y: ob.y + 4, z: ob.z, big: true });

  // Campfires
  const campfires = content.campfires.map((c) => ({ ...c, ...sb.campfire(c.x, c.z) }));

  const scatter = scatterWorld(scene, colliders, exclusions, codexSpots);

  return { content, colliders, sky, water, structures: sb, anchors: A, lighthouse: lh, campfires, codexSpots, lamps, scatter };
}

export function resolveAnchor(item, anchors) {
  if (item.anchor) {
    const a = anchors[item.anchor];
    if (!a) throw new Error('missing anchor ' + item.anchor);
    return { ...item, x: a.x, y: a.y, z: a.z };
  }
  return item;
}
