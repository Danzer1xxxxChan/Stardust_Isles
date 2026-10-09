// Persistent game state + save/load (localStorage, wrapped in try/catch).
const KEY = 'stardust-isles-save-v1';

export function defaultData() {
  return {
    version: 1,
    pos: null, yaw: 0,
    time: 8.5, day: 1, playTime: 0,
    shards: [], feathers: [], coins: 0, coinsTaken: [], chests: [],
    abilities: { camera: false, glider: false, lantern: false, rod: false, fins: false, shovel: false, boots: false, compass: false },
    items: { cocoa: 0, mushrooms: 0, fish: {}, fishSold: 0 },
    quests: {},
    flags: {},
    codex: [],
    campfires: [],
    hats: [], hat: null,
    maps: [], dug: [],
    reveal: '',
    met: [],
    farChests: [], farthest: 0,
    ending: false,
    settings: { volume: 0.8, music: 0.5, sensitivity: 1, invertY: false, shadows: true, aiChat: true, quality: 'high' },
  };
}

export class GameState {
  constructor() {
    this.data = defaultData();
    this.listeners = new Set();
  }
  static hasSave() {
    try { return !!localStorage.getItem(KEY); } catch { return false; }
  }
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      const base = defaultData();
      this.data = { ...base, ...d, abilities: { ...base.abilities, ...d.abilities }, items: { ...base.items, ...d.items }, settings: { ...base.settings, ...d.settings } };
      return true;
    } catch { return false; }
  }
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); return true; } catch { return false; }
  }
  reset() {
    const settings = this.data.settings;
    this.data = defaultData();
    this.data.settings = settings;
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type, payload) { for (const fn of this.listeners) fn(type, payload); }

  has(listName, id) { return this.data[listName].includes(id); }
  add(listName, id) {
    if (this.data[listName].includes(id)) return false;
    this.data[listName].push(id);
    this.emit(listName, id);
    return true;
  }
  addCoins(n) { this.data.coins = Math.max(0, this.data.coins + n); this.emit('coins', n); }
  grant(ability) { if (!this.data.abilities[ability]) { this.data.abilities[ability] = true; this.emit('ability', ability); } }
  quest(id) { return this.data.quests[id] || (this.data.quests[id] = { stage: 0 }); }
  flag(k, v) { if (v === undefined) return this.data.flags[k]; this.data.flags[k] = v; this.emit('flag', k); return v; }
}
