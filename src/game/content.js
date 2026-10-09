// All placed gameplay content. Positions adapt to the generated terrain via helpers.
import { groundHeight, highestPoint, flattestNear, riverX, waterLevel } from '../world/terrain.js';
import { LANDMARKS, LAKE, LAKE_ISLANDS, ISLETS, MOUNTAIN, CAMPFIRES, VILLAGE, DARK_FOREST } from '../world/layout.js';
import { t } from '../i18n.js';

export const SHARD_TOTAL = 30;
export const FEATHER_TOTAL = 15;
export const LIGHTHOUSE_COST = 20;

const at = (x, z, dy = 1.2) => ({ x, y: groundHeight(x, z) + dy, z });
const polar = (cx, cz, r, a) => [cx + Math.cos(a) * r, cz + Math.sin(a) * r];

function shoreOut(x, z, dx, dz, depth) {
  const l = Math.hypot(dx, dz); dx /= l; dz /= l;
  for (let i = 0; i < 500; i++) {
    x += dx; z += dz;
    if (groundHeight(x, z) < depth) return { x, z };
  }
  return { x, z };
}

export function resolveContent() {
  const C = {};
  // ---------- Village ----------
  const V = VILLAGE;
  C.village = {
    well: { x: V.x, z: V.z },
    houses: [
      { id: 'aila', x: -20, z: 130, yaw: Math.atan2(20, 20), roof: 0xc8553d, flowerBox: true },
      { id: 'pip', x: 22, z: 131, yaw: Math.atan2(-22, 19), roof: 0x4a7fc1, w: 6.5 },
      { id: 'h3', x: -29, z: 160, yaw: Math.PI / 2 + 0.25, roof: 0x6aa84f, flowerBox: true },
      { id: 'h4', x: 29, z: 160, yaw: -Math.PI / 2 - 0.2, roof: 0xd9a03a },
      { id: 'h5', x: -10, z: 180, yaw: Math.PI, roof: 0x9c5bb5, w: 5, d: 4.5 },
    ],
    stall: { x: 9, z: 141, yaw: 0 },
    windmill: { x: -36, z: 108 },
    lamps: [[-10, 140], [10, 160], [-14, 162], [14, 126], [0, 170], [-30, 140], [30, 145]],
    benches: [{ x: 6, z: 156, yaw: Math.PI }, { x: -7, z: 157, yaw: Math.PI + 0.3 }],
  };
  C.pillarCourse = [[44, 128, 1.4], [46.5, 125.5, 2.8], [49.5, 124, 4.2], [52.5, 125.5, 5.6], [54.5, 128.5, 7.0]];
  C.pen = { x: LANDMARKS.pen.x, z: LANDMARKS.pen.z, r: 7, gap: Math.atan2(55, 70) };
  C.lookout = { x: LANDMARKS.lookout.x, z: LANDMARKS.lookout.z };
  const dockStart = shoreOut(-10, 150, 0, 1, 0.8);
  C.dock = { x: dockStart.x, z: dockStart.z - 3, yaw: 0, len: 18 };
  C.ruins = { x: LANDMARKS.ruins.x, z: LANDMARKS.ruins.z };
  C.giantTree = { x: LANDMARKS.giantTree.x, z: LANDMARKS.giantTree.z };
  C.observatory = { x: LANDMARKS.observatory.x, z: LANDMARKS.observatory.z };
  C.arch = { x: LANDMARKS.arch.x, z: LANDMARKS.arch.z, yaw: 0.6 };
  const wreck = shoreOut(205, 228, 0.75, 0.66, -0.6);
  C.shipwreck = { x: wreck.x, z: wreck.z, yaw: 0.9 };
  const stack = shoreOut(wreck.x, wreck.z, 0.2, 1, -2.5);
  C.seaStack = { x: stack.x, z: stack.z, h: 9 };
  C.riverPillar = { x: riverX(20), z: 20, h: 8 };
  C.lighthouse = { x: -6, z: -242 };
  C.campfires = CAMPFIRES.map((c) => { const f = flattestNear(c.x, c.z, 10, 1); return { ...c, x: f.x, z: f.z }; });

  // Canyon hoodoos (tall rock pillars) south of the arch.
  C.mesaS = highestPoint(255, 92, 12);
  C.hoodooPeak = { x: 252, z: 77, h: Math.max(8, C.mesaS.y - 6 - groundHeight(252, 77)) };
  C.hoodoos = [{ x: 262, z: 70, h: 12 }, { x: 255, z: 65, h: 18 }];

  // ---------- Shards ----------
  const S = [];
  const shard = (id, pos, extra = {}) => S.push({ id, ...pos, ...extra });
  const pc = C.pillarCourse[C.pillarCourse.length - 1];
  shard('windmill', null, { anchor: 'windmill' });
  shard('pillars', { x: pc[0], y: groundHeight(pc[0], pc[1]) + pc[2] + 1.2, z: pc[1] }, { anchor: 'pillarTop' });
  shard('giant_tree', null, { anchor: 'treeTop' });
  shard('fox', null, { hidden: true });
  shard('firefly', at(-292, 18, 1.4), { night: true });
  shard('kuku', null, { reward: true });
  shard('mia', null, { reward: true });
  const eMesa = highestPoint(300, -15, 15);
  shard('mesa_top', { x: eMesa.x, y: eMesa.y + 1.2, z: eMesa.z });
  shard('ring_canyon1', null, { reward: true });
  shard('ring_canyon2', null, { reward: true });
  shard('race', null, { reward: true });
  shard('hoodoo', null, { anchor: 'hoodooPeak' });
  shard('ring_coast', null, { reward: true });
  shard('shipwreck', null, { anchor: 'wreckBow' });
  shard('hai_fish', null, { reward: true });
  shard('golden_fish', null, { reward: true });
  shard('mirror1', null, { reward: true });
  shard('mirror2', null, { reward: true });
  shard('lake_island', at(LAKE_ISLANDS[3].x, LAKE_ISLANDS[3].z, 1.3));
  shard('stars', null, { reward: true });
  shard('mtn_ledge', at(-6, -235 - 74, 1.3));
  shard('summit', at(12, -246, 1.3));
  shard('pip1', null, { reward: true });
  shard('pip2', null, { reward: true });
  shard('pip3', null, { reward: true });
  shard('ruins_puzzle', null, { anchor: 'ruinsAltar', hidden: true });
  shard('dig1', null, { hidden: true });
  shard('dig2', null, { hidden: true });
  shard('dig3', null, { hidden: true });
  C.shards = S;

  // ---------- Feathers ----------
  C.feathers = [
    { id: 'f_village', ...at(-27, 124, 1.0) },
    { id: 'f_ruins', anchor: 'ruinsPillar' },
    { id: 'f_tree', anchor: 'treeMid' },
    { id: 'f_dark', ...at(-306, -18, 1.2) },
    { id: 'f_mesaW', ...(() => { const p = highestPoint(195, -57, 10); return { x: p.x + 3, y: groundHeight(p.x + 3, p.z) + 1.2, z: p.z }; })() },
    { id: 'f_hoodoo', anchor: 'hoodoo2' },
    { id: 'f_isletSW', ...at(ISLETS[2].x + 4, ISLETS[2].z, 1.2) },
    { id: 'f_stack', anchor: 'seaStack' },
    { id: 'f_lakeisl', ...at(LAKE_ISLANDS[1].x, LAKE_ISLANDS[1].z, 1.2) },
    { id: 'f_lakerim', ...(() => { const p = highestPoint(-190, -222, 18); return { x: p.x, y: p.y + 1.2, z: p.z }; })() },
    { id: 'f_band1', ...at(-62, -235 + 82, 1.2) },
    { id: 'f_band2', ...at(64, -235 - 18, 1.2) },
    { id: 'f_band3', ...at(-38, -235 - 22, 1.2) },
    { id: 'f_feng', reward: true },
    { id: 'f_river', anchor: 'riverPillar' },
  ];

  // ---------- Chests ----------
  C.chests = [
    { id: 'c_ruins', ...at(-131, 262, 0), reward: { coins: 30 } },
    { id: 'c_tree', anchor: 'treeTopChest', reward: { hat: 'wizard' } },
    { id: 'c_dark', ...at(-252, -32, 0), reward: { map: 'map3' } },
    { id: 'c_mesaW', ...(() => { const p = highestPoint(195, -57, 10); return { x: p.x - 2, y: groundHeight(p.x - 2, p.z + 2), z: p.z + 2 }; })(), reward: { map: 'map1' } },
    { id: 'c_hoodoo', ...at(266, 64, 0), reward: { coins: 40 } },
    { id: 'c_wreck', anchor: 'wreckDeck', reward: { hat: 'pirate' } },
    { id: 'c_isletSW', ...at(ISLETS[2].x - 3, ISLETS[2].z + 2, 0), reward: { map: 'map2' } },
    { id: 'c_lakeisl', ...at(LAKE_ISLANDS[2].x, LAKE_ISLANDS[2].z, 0), reward: { coins: 40 } },
    { id: 'c_band3', ...at(42, -235 + 6, 0), reward: { hat: 'beanie' } },
    { id: 'c_islet', ...at(ISLETS[0].x - 4, ISLETS[0].z + 3, 0), reward: { coins: 50 } },
  ];

  // ---------- Treasure maps / dig spots ----------
  C.digs = [
    { id: 'dig1', map: 'map1', ...at(222, 78, 0), clue: t('藏宝图上画着一座红色的石拱门，拱门西南方向不远处画着一个叉。') },
    { id: 'dig2', map: 'map2', ...at(196, 236, 0), clue: t('地图上是一片沙滩和一艘歪倒的船，叉画在船的西北方、营火附近的沙地上。') },
    { id: 'dig3', map: 'map3', ...at(122, -126, 0), clue: t('地图上画着一座圆顶的观星台，叉在它的东北方，靠近一块平地。') },
  ];

  // ---------- Coin trails ----------
  const trails = [
    [[0, 160], [0, 176], [10, 186]],
    [[12, 140], [40, 122], [60, 102], [70, 92]],
    [[-20, 140], [-50, 120], [-66, 103]],
    [[-40, 150], [-90, 140], [-140, 110], [-165, 60], [-170, 30]],
    [[-5, 190], [-10, 240], [-10, 320]],
    [[-60, 200], [-100, 235]],
    [[-170, 20], [-150, -40], [-130, -100], [-125, -135]],
    [[-160, -165], [-145, -195], [-170, -220], [-210, -218]],
    [[60, 40], [80, -40], [70, -90], [55, -95]],
    [[150, -20], [180, -10], [205, 20], [230, 55]],
    [[190, 200], [210, 230], [235, 220], [250, 205]],
    [[140, 140], [175, 180], [195, 215]],
    [[60, -120], [95, -135]],
    [[-20, -130], [-45, -140], [-70, -170]],
    [[20, -150], [50, -170], [62, -200]],
    [[-25, -275], [5, -290], [30, -280]],
  ];
  const coins = [];
  let ci = 0;
  for (const t of trails) {
    for (let k = 0; k < t.length - 1; k++) {
      const [x1, z1] = t[k], [x2, z2] = t[k + 1];
      const len = Math.hypot(x2 - x1, z2 - z1);
      const n = Math.max(1, Math.floor(len / 5));
      for (let i = 0; i < n; i++) {
        const x = x1 + ((x2 - x1) * i) / n, z = z1 + ((z2 - z1) * i) / n;
        const h = groundHeight(x, z);
        if (h < waterLevel(x, z) + 0.2) continue;
        coins.push({ id: 'k' + ci++, x, y: h + 1.0, z });
      }
    }
  }
  // Rings of coins around a few landmarks
  const ringCoins = (cx, cz, r, n, dy = 1) => { for (let i = 0; i < n; i++) { const [x, z] = polar(cx, cz, r, (i / n) * Math.PI * 2); const h = groundHeight(x, z); if (h > waterLevel(x, z) + 0.2) coins.push({ id: 'k' + ci++, x, y: h + dy, z }); } };
  ringCoins(LANDMARKS.lookout.x, LANDMARKS.lookout.z, 6, 10);
  ringCoins(LANDMARKS.ruins.x, LANDMARKS.ruins.z, 13, 14);
  ringCoins(LAKE.x, LAKE.z, LAKE.r + 14, 26);
  ringCoins(MOUNTAIN.x, MOUNTAIN.z, 104, 24);
  ringCoins(MOUNTAIN.x, MOUNTAIN.z, 72, 18);
  ringCoins(DARK_FOREST.x, DARK_FOREST.z, 40, 14);
  ringCoins(C.arch.x, C.arch.z, 14, 10);
  C.coins = coins;

  // ---------- NPC spots ----------
  C.npcs = {
    aila: { x: -4, z: 145, yaw: 0.4 },
    pip: { x: 17, z: 136, yaw: -0.6 },
    abe: { x: 9, z: 139.2, yaw: Math.PI },
    mia: { x: C.pen.x + Math.cos(C.pen.gap) * 9, z: C.pen.z + Math.sin(C.pen.gap) * 9, yaw: C.pen.gap + Math.PI },
    hai: { anchor: 'dockMid' },
    kuku: { x: C.campfires.find((c) => c.id === 'forest').x - 5, z: C.campfires.find((c) => c.id === 'forest').z - 3, yaw: 1 },
    tiao: { x: C.campfires.find((c) => c.id === 'canyon').x + 4, z: C.campfires.find((c) => c.id === 'canyon').z + 2, yaw: -1 },
    hoshino: { x: LANDMARKS.observatory.x - 2, z: LANDMARKS.observatory.z + 7, yaw: 0 },
    feng: { x: 8, z: -235 + 108, yaw: Math.PI },
  };

  // ---------- Lost sheep ----------
  C.lostSheep = [at(96, 128, 0), at(-150, 205, 0), at(-140, 150, 0)];

  // ---------- Fox trail (outer forest) ----------
  C.foxTrail = [[-150, 62], [-168, 40], [-192, 22], [-205, -10], [-190, -40], [-178, -62]].map(([x, z]) => at(x, z, 0));

  // ---------- Glow mushrooms (dark forest) ----------
  C.glowMushrooms = [[-250, 20], [-280, -30], [-300, 40], [-240, -50], [-320, 0]].map(([x, z], i) => ({ id: 'gm' + i, ...at(x, z, 0) }));

  // ---------- Star pedestals ----------
  C.pedestals = ['swan', 'hunter', 'dipper'].map((k, i) => {
    const a = -Math.PI / 2 + (i - 1) * 0.9;
    const [x, z] = polar(LANDMARKS.observatory.x, LANDMARKS.observatory.z, 10, a + Math.PI);
    return { id: k, x, z };
  });

  // ---------- Fishing spots ----------
  C.fishing = [
    { id: 'sea', kind: 'sea', anchor: 'dockEndWater' },
    { id: 'sea2', kind: 'sea', ...shoreOut(215, 215, 1, 0, -1.5) },
    { id: 'lake', kind: 'lake', x: LAKE.x + 40, z: LAKE.z + 30 },
    { id: 'river', kind: 'river', x: riverX(-30), z: -30 },
  ];

  // ---------- Updrafts (also used by ring courses) ----------
  C.updrafts = [
    { x: C.seaStack.x - 5, z: C.seaStack.z, r: 3.5, top: 16 },
    { x: 232, z: 72, r: 3.5, top: 34 },
    { x: riverX(92) - 4, z: 92, r: 4.5, top: 25 },
  ];
  return C;
}

// ---------- Static data ----------
export const CODEX = [
  // creatures
  { id: 'sheep', cat: t('动物'), name: t('绵羊'), desc: t('草原上最常见的居民，毛茸茸的，喜欢成群结队。') },
  { id: 'cat', cat: t('动物'), name: t('团子'), desc: t('村里的橘猫，整天在艾拉奶奶家门口晒太阳。') },
  { id: 'fox', cat: t('动物'), name: t('赤狐'), desc: t('森林里机灵的小狐狸，总在你靠近时跑开。') },
  { id: 'spiritfox', cat: t('动物'), name: t('星光狐'), desc: t('浑身泛着微光的狐狸，据说会把人引向星屑。') },
  { id: 'deer', cat: t('动物'), name: t('梅花鹿'), desc: t('胆小的森林居民，一有动静就会跑远。') },
  { id: 'crab', cat: t('动物'), name: t('寄居蟹'), desc: t('在沙滩上横着走的小家伙。') },
  { id: 'seagull', cat: t('动物'), name: t('海鸥'), desc: t('在海岸上空盘旋，时不时发出嘎嘎的叫声。') },
  { id: 'butterfly', cat: t('动物'), name: t('花蝴蝶'), desc: t('白天在花丛中飞舞。') },
  { id: 'owl', cat: t('动物'), name: t('夜枭'), desc: t('只在夜晚的森林里出现，眼睛像两盏小灯。') },
  { id: 'frog', cat: t('动物'), name: t('雨蛙'), desc: t('下雨天会出现在水晶湖边呱呱叫。') },
  { id: 'goat', cat: t('动物'), name: t('岩羊'), desc: t('雪山悬崖上的攀岩高手。') },
  { id: 'lizard', cat: t('动物'), name: t('红岩蜥'), desc: t('在峡谷的岩石上晒太阳。') },
  { id: 'whale', cat: t('动物'), name: t('座头鲸'), desc: t('偶尔在东边的海面上浮起换气，非常罕见。') },
  { id: 'firefly', cat: t('动物'), name: t('萤火虫'), desc: t('夜晚迷雾森林里的点点亮光。') },
  // plants
  { id: 'oak', cat: t('植物'), name: t('橡树'), desc: t('草原和森林边缘的阔叶树。') },
  { id: 'pine', cat: t('植物'), name: t('松树'), desc: t('耐寒的针叶树，长在湖边和山脚。') },
  { id: 'darkpine', cat: t('植物'), name: t('雾松'), desc: t('迷雾森林里高大的深色松树。') },
  { id: 'snowpine', cat: t('植物'), name: t('雪松'), desc: t('枝头挂着积雪的松树，只长在雪山高处。') },
  { id: 'palm', cat: t('植物'), name: t('椰子树'), desc: t('海边的标志，树顶挂着椰子。') },
  { id: 'cactus', cat: t('植物'), name: t('仙人掌'), desc: t('峡谷里的耐旱植物，有时会开粉色的花。') },
  { id: 'flower', cat: t('植物'), name: t('野花'), desc: t('草原上五颜六色的小花。') },
  { id: 'sunflower', cat: t('植物'), name: t('向日葵'), desc: t('总是朝着太阳的方向。') },
  { id: 'mushroom', cat: t('植物'), name: t('红蘑菇'), desc: t('森林地面上的蘑菇，别乱吃。') },
  { id: 'reeds', cat: t('植物'), name: t('芦苇'), desc: t('湖边浅水里的植物。') },
  { id: 'crystal', cat: t('植物'), name: t('湖晶'), desc: t('水晶湖周围自然生长的发光晶体。') },
  // landmarks
  { id: 'windmill', cat: t('地标'), name: t('老风车'), desc: t('村庄的标志，阳台上能看到整片草原。') },
  { id: 'lighthouse', cat: t('地标'), name: t('星屑灯塔'), desc: t('雪山顶上熄灭的灯塔，群岛的守护者。') },
  { id: 'observatory', cat: t('地标'), name: t('星野天文台'), desc: t('星野先生观测星空的地方。') },
  { id: 'ruins', cat: t('地标'), name: t('古代遗迹'), desc: t('不知是谁留下的石柱和地砖。') },
  { id: 'shipwreck', cat: t('地标'), name: t('沉船'), desc: t('很久以前搁浅在海岸边的帆船。') },
  { id: 'arch', cat: t('地标'), name: t('红石拱门'), desc: t('峡谷里被风雕刻出的天然拱门。') },
  { id: 'giantTree', cat: t('地标'), name: t('千年古树'), desc: t('森林里最古老的树，树干上长满了蘑菇台阶。') },
  // fish
  { id: 'bass', cat: t('鱼类'), name: t('海鲈鱼'), desc: t('码头边最常见的鱼。'), fish: true },
  { id: 'mackerel', cat: t('鱼类'), name: t('青花鱼'), desc: t('游得很快的海鱼。'), fish: true },
  { id: 'puffer', cat: t('鱼类'), name: t('河豚'), desc: t('被钓上来就会鼓成一个球。'), fish: true },
  { id: 'golden', cat: t('鱼类'), name: t('金鳞鱼'), desc: t('传说中的鱼，鳞片像星屑一样闪光。'), fish: true },
  { id: 'lanternfish', cat: t('鱼类'), name: t('灯笼鱼'), desc: t('只在夜里浮上来的发光小鱼。'), fish: true },
  { id: 'trout', cat: t('鱼类'), name: t('虹鳟'), desc: t('水晶湖里的冷水鱼。'), fish: true },
  { id: 'crystalcarp', cat: t('鱼类'), name: t('水晶鲤'), desc: t('身体半透明的鲤鱼，只在水晶湖里有。'), fish: true },
  { id: 'salmon', cat: t('鱼类'), name: t('鲑鱼'), desc: t('在河里逆流而上的鱼。'), fish: true },
  { id: 'catfish', cat: t('鱼类'), name: t('鲶鱼'), desc: t('长着胡子的河底大鱼。'), fish: true },
];

export const FISH = {
  sea: [{ id: 'bass', w: 45, diff: 0.3, price: 8 }, { id: 'mackerel', w: 35, diff: 0.4, price: 10 }, { id: 'puffer', w: 14, diff: 0.55, price: 18 }, { id: 'golden', w: 6, diff: 0.75, price: 60 }, { id: 'lanternfish', w: 25, diff: 0.5, price: 20, night: true }],
  lake: [{ id: 'trout', w: 65, diff: 0.4, price: 12 }, { id: 'crystalcarp', w: 35, diff: 0.6, price: 25 }],
  river: [{ id: 'salmon', w: 60, diff: 0.45, price: 14 }, { id: 'catfish', w: 40, diff: 0.5, price: 16 }],
};

export const SHOP = [
  { id: 'shovel', name: t('小铁铲'), price: 60, desc: t('能在藏宝图标记的地方挖宝。'), ability: 'shovel' },
  { id: 'boots', name: t('弹跳靴'), price: 150, desc: t('在空中再按一次空格可以二段跳。'), ability: 'boots' },
  { id: 'compass', name: t('星屑罗盘'), price: 120, desc: t('指向最近的、还没找到的星屑。'), ability: 'compass' },
  { id: 'cocoa', name: t('热可可'), price: 15, desc: t('暖暖的一杯，适合送给怕冷的人。'), item: 'cocoa' },
  { id: 'straw', name: t('草帽'), price: 30, desc: t('夏天必备。'), hat: 'straw' },
  { id: 'flower', name: t('花环'), price: 50, desc: t('用草原上的野花编的。'), hat: 'flower' },
  { id: 'chef', name: t('厨师帽'), price: 80, desc: t('戴上它感觉自己会做饭了。'), hat: 'chef' },
];

export const HATS = {
  straw: t('草帽'), flower: t('花环'), chef: t('厨师帽'), pirate: t('海盗帽'), wizard: t('巫师帽'), beanie: t('毛线帽'), cap: t('跑步帽'), crown: t('星之王冠'),
};

export const ABILITY_NAMES = {
  camera: t('相机'), glider: t('滑翔翼'), lantern: t('提灯'), rod: t('钓竿'), fins: t('脚蹼'), shovel: t('小铁铲'), boots: t('弹跳靴'), compass: t('星屑罗盘'),
};
