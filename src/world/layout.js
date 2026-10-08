// Hand-placed world layout. x = east, z = south (north is -z). Heights are derived in terrain.js.

export const WORLD_HALF = 450;
export const SEA_LEVEL = 0;

export const REGIONS = {
  meadow:   { name: '晨风草原', x: 0,    z: 140,  r: 230 },
  forest:   { name: '迷雾森林', x: -240, z: 10,   r: 170 },
  canyon:   { name: '红岩峡谷', x: 235,  z: -30,  r: 170 },
  coast:    { name: '珊瑚海岸', x: 190,  z: 215,  r: 140 },
  lake:     { name: '水晶湖',   x: -190, z: -150, r: 110 },
  mountain: { name: '霜顶雪山', x: 0,    z: -235, r: 165 },
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
  lookout:     { x: 70,   z: 92,   r: 28, h: 21, name: '瞭望丘' },
  observatory: { x: 108,  z: -142, r: 22, h: 8,  name: '星野天文台' },
  ruins:       { x: -115, z: 245,  name: '古代遗迹' },
  shipwreck:   { x: 285,  z: 285,  name: '搁浅的沉船' },
  arch:        { x: 230,  z: 55,   name: '红石拱门' },
  giantTree:   { x: -175, z: 95,   name: '千年古树' },
  dock:        { x: -10,  z: 318,  name: '渔夫码头' },
  pen:         { x: -70,  z: 95,   name: '羊圈' },
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
  { id: 'village',  x: 22,   z: 172, name: '村庄营火' },
  { id: 'forest',   x: -170, z: 30,  name: '森林营火' },
  { id: 'canyon',   x: 180,  z: -10, name: '峡谷营火' },
  { id: 'coast',    x: 195,  z: 215, name: '海岸营火' },
  { id: 'lake',     x: -125, z: -135, name: '湖畔营火' },
  { id: 'mountain', x: 55,   z: -95, name: '山脚营火' },
  { id: 'summit',   x: 12,   z: -228, name: '峰顶营火' },
];
