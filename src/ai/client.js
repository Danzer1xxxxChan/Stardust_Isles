// Optional LLM small-talk with residents. The server owns the personas and the API key;
// the client only sends the NPC id, recent history and a game-state summary used for hints.
import { objectiveSummary } from '../game/quests.js';
import { regionAt } from '../world/terrain.js';
import { REGIONS } from '../world/layout.js';
import { ABILITY_NAMES } from '../game/content.js';
import { t, LANG } from '../i18n.js';

export class AiClient {
  constructor(game) {
    this.g = game;
    this.available = false;
    fetch('/api/status').then((r) => (r.ok ? r.json() : null)).then((j) => { this.available = !!j?.ai; }).catch(() => {});
  }

  enabled() { return this.available && this.g.state.data.settings.aiChat; }

  context() {
    const g = this.g, d = g.state.data;
    const region = regionAt(g.player.pos.x, g.player.pos.z);
    return {
      shards: d.shards.length,
      feathers: d.feathers.length,
      coins: d.coins,
      time: t('{0}点', [Math.floor(d.time)]),
      night: g.sky.night > 0.5,
      region: REGIONS[region]?.name || t('海上'),
      abilities: Object.entries(d.abilities).filter(([, v]) => v).map(([k]) => ABILITY_NAMES[k]),
      objectives: objectiveSummary(g.state, g.content),
      ending: d.ending,
    };
  }

  async chat(npc, history, message) {
    try {
      const r = await fetch('/api/npc-chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ npc: npc.id, history, message, context: this.context(), lang: LANG }),
      });
      const j = await r.json();
      return j.reply || '……';
    } catch {
      return t('（对方好像没听清你在说什么。）');
    }
  }
}
