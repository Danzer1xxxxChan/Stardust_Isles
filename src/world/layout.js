import { t } from '../i18n.js';
// Hand-placed world layout. x = east, z = south (north is -z). Heights are derived in terrain.js.

export const WORLD_HALF = 450;
export const SEA_LEVEL = 0;

export const REGIONS = {
  meadow:   { name: t('晨风草原'), x: 0,    z: 140,  r: 230 },
  forest:   { name: t('迷雾森林'), x: -240, z: 10,   r: 170 },
  canyon:   { name: t('红岩峡谷'), x: 235,  z: -30,  r: 170 },
  coast:    { name: t('珊瑚海岸'), x: 190,  z: 215,  r: 140 },
  lake:     { name: t('水晶湖'),   x: -190, z: -150, r: 110 },
  mountain: { name: t('霜顶雪山'), x: 0,    z: -235, r: 165 },
};

export const VILLAGE = { x: 0, z: 150, r: 42, h: 5.5 };
export const LAKE = { x: -190, z: -150, r: 60, level: 14 };
export const DARK_FOREST = { x: -265, z: 0, r: 80 };
export const MOUNTAIN = { x: 0, z: -235, summitR: 20, base: 150 };
export const MOUNTAIN_BANDS = [
  { r: 120, h: 8 },
  { r: 88, h: 12 },
  { r: 58, h: 15 },
  { r: 32, h: 22 },
];
export const RIVER = { x: 118, amp: 12, freq: 0.018, start: -135 };

export const LANDMARKS = {
  lookout:     { x: 70,   z: 92,   r: 28, h: 21, name: t('瞭望丘') },
  observatory: { x: 108,  z: -142, r: 22, h: 8,  name: t('星野天文台') },
  ruins:       { x: -115, z: 245,  name: t('古代遗迹') },
  shipwreck:   { x: 285,  z: 285,  name: t('搁浅的沉船') },
  arch:        { x: 230,  z: 55,   name: t('红石拱门') },
  giantTree:   { x: -175, z: 95,   name: t('千年古树') },
  dock:        { x: -10,  z: 318,  name: t('渔夫码头') },
  pen:         { x: -70,  z: 95,   name: t('羊圈') },
};

export const FLATTEN = [
  { x: -115, z: 245, r: 14, h: 4.4 },
];

export const ISLETS = [
  { x: 372, z: 168, r: 26, h: 7 },
  { x: 318, z: 372, r: 30, h: 6 },
  { x: -300, z: 335, r: 24, h: 6 },
];

export const LAKE_ISLANDS = [
  { x: -215, z: -165, r: 12, h: 17 },
  { x: -165, z: -175, r: 10, h: 16.6 },
  { x: -185, z: -120, r: 11, h: 16.8 },
  { x: -220, z: -125, r: 8,  h: 16.4 },
];

export const CAMPFIRES = [
  { id: 'village',  x: 22,   z: 172, name: t('村庄营火') },
  { id: 'forest',   x: -170, z: 30,  name: t('森林营火') },
  { id: 'canyon',   x: 180,  z: -10, name: t('峡谷营火') },
  { id: 'coast',    x: 195,  z: 215, name: t('海岸营火') },
  { id: 'lake',     x: -125, z: -135, name: t('湖畔营火') },
  { id: 'mountain', x: 55,   z: -95, name: t('山脚营火') },
  { id: 'summit',   x: 12,   z: -228, name: t('峰顶营火') },
];

// ---- Far isles (procedural, unbounded) ----
// The authored island is untouched inside FRONTIER.start; beyond it the world blends into
// endless procedurally generated isles that stream in around the player.
export const FRONTIER = { start: 425, full: 520, landFrom: 470, landFull: 660 };
// Sandbar causeways (angle in radians, x = cos, z = sin) that let you walk out to the far isles.
export const CAUSEWAYS = [-0.5, Math.PI + 0.15, -2.25];
export const BIOMES = {
  meadow:  { name: t('翠屿草原'), bt: 0.0,   bm: -0.05 },
  forest:  { name: t('雾隐林海'), bt: -0.1,  bm: 0.35 },
  canyon:  { name: t('赤岩荒地'), bt: 0.4,   bm: -0.3 },
  snow:    { name: t('霜原'),     bt: -0.45, bm: -0.2 },
  crystal: { name: t('晶辉海滩'), bt: 0.35,  bm: 0.35 },
};
