// Pause menu: map (with fast travel), quests, collection, codex, wardrobe, settings.
import { CODEX, HATS, ABILITY_NAMES, SHARD_TOTAL, FEATHER_TOTAL } from '../game/content.js';
import { questList } from '../game/quests.js';
import { WORLD_HALF, REGIONS } from '../world/layout.js';
import { groundHeight, waterLevel, SEG } from '../world/terrain.js';
import { terrainColor } from '../world/terrainMesh.js';
import * as THREE from 'three';

const $ = (s, r = document) => r.querySelector(s);
const TABS = [['map', '地图'], ['quests', '任务'], ['collect', '收集'], ['codex', '图鉴'], ['wardrobe', '装扮'], ['settings', '设置']];
export const REVEAL_N = 64;

export function buildMapImage(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const col = new THREE.Color();
  const step = (WORLD_HALF * 2) / size;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = -WORLD_HALF + (i + 0.5) * step, z = -WORLD_HALF + (j + 0.5) * step;
      const h = groundHeight(x, z), wl = waterLevel(x, z);
      if (h < wl) {
        const dpt = Math.min(1, (wl - h) / 12);
        col.setRGB(0.38 - dpt * 0.2, 0.72 - dpt * 0.25, 0.85 - dpt * 0.15);
      } else {
        const hn = groundHeight(x - step, z - step);
        terrainColor(x, z, h, 0.9, col);
        col.convertLinearToSRGB();
        const shade = Math.max(-0.25, Math.min(0.25, (h - hn) * 0.05));
        col.offsetHSL(0, 0, shade);
        if (h > wl && h < wl + 0.6) col.lerp(new THREE.Color(0.95, 0.93, 0.8), 0.4);
      }
      const k = (j * size + i) * 4;
      img.data[k] = col.r * 255; img.data[k + 1] = col.g * 255; img.data[k + 2] = col.b * 255; img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export class Menu {
  constructor(game) {
    this.game = game;
    this.el = $('#menu');
    this.tabsEl = $('.tabs', this.el);
    this.body = $('.tab-body', this.el);
    this.tab = 'map';
    this.open_ = false;
    this.mapImg = null;
    for (const [id, name] of TABS) {
      const t = document.createElement('div');
      t.className = 'tab';
      t.textContent = name;
      t.dataset.id = id;
      t.onclick = () => { this.game.audio.play('click'); this.show(id); };
      this.tabsEl.appendChild(t);
    }
  }

  get isOpen() { return this.open_; }

  open(tab = this.tab, opts = {}) {
    this.open_ = true;
    this.travelOnly = !!opts.travel;
    this.el.hidden = false;
    this.game.input.unlock();
    this.game.audio.play('open');
    this.show(tab);
  }

  close() {
    this.open_ = false;
    this.el.hidden = true;
    this.game.audio.play('close');
    this.game.state.save();
  }

  show(id) {
    this.tab = id;
    [...this.tabsEl.children].forEach((t) => t.classList.toggle('active', t.dataset.id === id));
    this.body.innerHTML = '';
    this['_' + id]();
  }

  _map() {
    const g = this.game, d = g.state.data;
    if (!this.mapImg) this.mapImg = buildMapImage(256);
    const wrap = document.createElement('div'); wrap.className = 'map-wrap';
    const cv = document.createElement('canvas'); cv.width = cv.height = 640;
    const side = document.createElement('div'); side.className = 'map-side';
    wrap.append(cv, side);
    this.body.appendChild(wrap);
    const ctx = cv.getContext('2d');
    const W = 640, toC = (x, z) => [((x + WORLD_HALF) / (WORLD_HALF * 2)) * W, ((z + WORLD_HALF) / (WORLD_HALF * 2)) * W];
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.mapImg, 0, 0, W, W);
    // fog of war
    const rev = d.reveal;
    const cell = W / REVEAL_N;
    ctx.fillStyle = 'rgba(235, 228, 210, 0.92)';
    for (let j = 0; j < REVEAL_N; j++) for (let i = 0; i < REVEAL_N; i++) if (rev[j * REVEAL_N + i] !== '1') ctx.fillRect(i * cell - 0.5, j * cell - 0.5, cell + 1, cell + 1);
    const seen = (x, z) => { const i = Math.floor(((x + WORLD_HALF) / (WORLD_HALF * 2)) * REVEAL_N), j = Math.floor(((z + WORLD_HALF) / (WORLD_HALF * 2)) * REVEAL_N); return rev[j * REVEAL_N + i] === '1'; };
    ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    for (const r of Object.values(REGIONS)) {
      if (!seen(r.x, r.z)) continue;
      const [cx, cz] = toC(r.x, r.z);
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 3;
      ctx.strokeText(r.name, cx, cz); ctx.fillText(r.name, cx, cz);
    }
    // treasure map circles
    for (const dg of g.content.digs) {
      if (!d.maps.includes(dg.map) || d.dug.includes(dg.id)) continue;
      const [cx, cz] = toC(dg.x + 9, dg.z - 6);
      ctx.strokeStyle = '#d0453a'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.arc(cx, cz, 22, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#d0453a'; ctx.fillText('✕', cx, cz + 5);
    }
    // NPCs met
    ctx.font = '18px sans-serif';
    for (const n of g.npcs.list) {
      if (!d.met.includes(n.id)) continue;
      const [cx, cz] = toC(n.pos.x, n.pos.z);
      ctx.fillText('💬', cx, cz + 6);
    }
    // lighthouse
    { const [cx, cz] = toC(g.world.lighthouse.x, g.world.lighthouse.z); ctx.fillText('🗼', cx, cz + 6); }
    // campfires
    this._fireHit = [];
    for (const c of g.world.campfires) {
      const lit = d.campfires.includes(c.id);
      if (!lit && !seen(c.x, c.z)) continue;
      const [cx, cz] = toC(c.x, c.z);
      ctx.beginPath(); ctx.arc(cx, cz, 11, 0, Math.PI * 2);
      ctx.fillStyle = lit ? '#ff9a3c' : '#9a9a9a'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.font = '13px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('🔥', cx, cz + 5);
      if (lit) this._fireHit.push({ c, cx, cz });
    }
    // player
    const [px, pz] = toC(g.player.pos.x, g.player.pos.z);
    ctx.save(); ctx.translate(px, pz); ctx.rotate(-g.player.yaw + Math.PI);
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 9); ctx.lineTo(0, 4); ctx.lineTo(-8, 9); ctx.closePath();
    ctx.fillStyle = '#e94e3c'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();

    const canTravel = g.canTravel();
    side.innerHTML = `<div class="sec">图例</div>
      <div>🔥 营火：${canTravel ? '<b>点击已点亮的营火快速旅行</b>' : '现在不能快速旅行'}</div>
      <div>💬 认识的居民</div><div>🗼 星屑灯塔</div><div style="color:#d0453a">✕ 藏宝图标记</div>
      <div class="sec">已点亮营火 ${d.campfires.length}/${g.world.campfires.length}</div>
      <div>${g.world.campfires.filter((c) => d.campfires.includes(c.id)).map((c) => c.name).join('<br>') || '还没有点亮任何营火。走到营火旁按 E 点亮。'}</div>`;
    cv.onclick = (e) => {
      if (!canTravel) return;
      const r = cv.getBoundingClientRect();
      const mx = ((e.clientX - r.left) / r.width) * W, my = ((e.clientY - r.top) / r.height) * W;
      for (const f of this._fireHit) {
        if (Math.hypot(mx - f.cx, my - f.cz) < 16) { this.close(); g.fastTravel(f.c); return; }
      }
    };
  }

  _quests() {
    const list = questList(this.game.state, this.game.content);
    list.sort((a, b) => (a.done - b.done) || (b.main ? 1 : 0) - (a.main ? 1 : 0));
    this.body.innerHTML = list.map((q) => `<div class="quest ${q.done ? 'done' : ''}"><div class="t">${q.done ? '✔ ' : ''}${q.title}</div><div class="d">${q.desc}</div></div>`).join('');
  }

  _collect() {
    const d = this.game.state.data;
    const ab = Object.entries(ABILITY_NAMES).map(([k, n]) => `<div class="card ${d.abilities[k] ? '' : 'locked'}"><div class="t">${d.abilities[k] ? n : '？？？'}</div></div>`).join('');
    const fishN = Object.values(d.items.fish).reduce((a, b) => a + b, 0);
    const mins = Math.floor(d.playTime / 60);
    this.body.innerHTML = `
      <div class="sec">进度</div>
      <div class="stat"><span>⭐ 星屑</span><b>${d.shards.length} / ${SHARD_TOTAL}</b></div>
      <div class="stat"><span>🪶 金羽毛（体力上限）</span><b>${d.feathers.length} / ${FEATHER_TOTAL}</b></div>
      <div class="stat"><span>🐚 贝壳币</span><b>${d.coins}</b></div>
      <div class="stat"><span>📖 图鉴</span><b>${d.codex.length} / ${CODEX.length}</b></div>
      <div class="stat"><span>🔥 营火</span><b>${d.campfires.length} / ${this.game.world.campfires.length}</b></div>
      <div class="stat"><span>🎣 钓到的鱼</span><b>${fishN}</b></div>
      <div class="stat"><span>📦 打开的宝箱</span><b>${d.chests.length} / ${this.game.content.chests.length}</b></div>
      <div class="stat"><span>⏱ 游戏时间</span><b>${mins} 分钟</b></div>
      <div class="sec">道具</div><div class="grid">${ab}</div>
      <div class="sec">背包</div>
      <div class="grid">
        <div class="card"><div class="t">☕ 热可可 × ${d.items.cocoa}</div></div>
        <div class="card"><div class="t">🍄 发光蘑菇 × ${d.items.mushrooms}</div></div>
        ${Object.entries(d.items.fish).map(([k, v]) => `<div class="card"><div class="t">🐟 ${CODEX.find((c) => c.id === k)?.name || k} × ${v}</div></div>`).join('')}
        ${d.maps.map((m) => `<div class="card"><div class="t">🗺️ 藏宝图</div><div class="d">${this.game.content.digs.find((x) => x.map === m)?.clue || ''}</div></div>`).join('')}
      </div>`;
  }

  _codex() {
    const d = this.game.state.data;
    const cats = [...new Set(CODEX.map((c) => c.cat))];
    this.body.innerHTML = `<div style="color:#8a7c68">按 C 打开相机，对准目标点击拍照即可登记。鱼类需要钓上来才会登记。已登记 ${d.codex.length} / ${CODEX.length}</div>` +
      cats.map((cat) => `<div class="sec">${cat}</div><div class="grid">${CODEX.filter((c) => c.cat === cat).map((c) => {
        const got = d.codex.includes(c.id);
        return `<div class="card ${got ? '' : 'locked'}"><div class="t">${got ? c.name : '？？？'}</div><div class="d">${got ? c.desc : (c.fish ? '用钓竿钓上来' : '用相机拍下来')}</div></div>`;
      }).join('')}</div>`).join('');
  }

  _wardrobe() {
    const d = this.game.state.data;
    const owned = ['__none', ...d.hats];
    this.body.innerHTML = `<div style="color:#8a7c68">点击切换帽子。帽子可以在商店买到，或者藏在宝箱里。已收集 ${d.hats.length} / ${Object.keys(HATS).length}</div><div class="grid" style="margin-top:12px"></div>`;
    const grid = $('.grid', this.body);
    for (const h of owned) {
      const el = document.createElement('div');
      el.className = 'card clickable' + ((d.hat || '__none') === h ? ' sel' : '');
      el.style.pointerEvents = 'auto';
      el.innerHTML = `<div class="t">${h === '__none' ? '不戴帽子' : HATS[h]}</div>`;
      el.onclick = () => { d.hat = h === '__none' ? null : h; this.game.player.char.setHat(d.hat); this.game.audio.play('click'); this.show('wardrobe'); };
      grid.appendChild(el);
    }
    for (const h of Object.keys(HATS)) if (!d.hats.includes(h)) {
      const el = document.createElement('div'); el.className = 'card locked'; el.innerHTML = '<div class="t">？？？</div>'; grid.appendChild(el);
    }
  }

  _settings() {
    const g = this.game, s = g.state.data.settings;
    this.body.innerHTML = `
      <div class="row"><label>音效音量</label><input type="range" min="0" max="1" step="0.05" id="s-vol" value="${s.volume}"></div>
      <div class="row"><label>音乐音量</label><input type="range" min="0" max="1" step="0.05" id="s-music" value="${s.music}"></div>
      <div class="row"><label>鼠标灵敏度</label><input type="range" min="0.3" max="2.5" step="0.1" id="s-sens" value="${s.sensitivity}"></div>
      <div class="row"><label>反转 Y 轴</label><input type="checkbox" id="s-inv" ${s.invertY ? 'checked' : ''}></div>
      <div class="row"><label>阴影</label><input type="checkbox" id="s-shadow" ${s.shadows ? 'checked' : ''}><span style="color:#8a7c68;font-size:13px">关闭可以提升帧率</span></div>
      <div class="row"><label>AI 闲聊</label><input type="checkbox" id="s-ai" ${s.aiChat ? 'checked' : ''}><span style="color:#8a7c68;font-size:13px">${g.ai.available ? '已连接：和居民对话时可以选择“随便聊聊”' : '服务器未配置 API Key，此功能不可用'}</span></div>
      <div class="sec">操作说明</div>
      <div class="d" style="line-height:1.9;color:#8a7c68">
        WASD / 方向键 移动 · 鼠标 转动视角（点击画面锁定，或按住右键拖动）· 滚轮 缩放<br>
        空格 跳跃；在空中再按一次：二段跳（弹跳靴）或展开滑翔翼（按住保持滑翔）<br>
        朝着陡坡移动就会攀爬，消耗体力；体力用完会滑下来。收集金羽毛可以提升体力上限<br>
        Shift 冲刺 · E 互动 · C 相机 · Tab / M 菜单和地图
      </div>
      <div class="row" style="margin-top:20px"><button class="btn ghost" id="s-save">保存游戏</button><button class="btn ghost" id="s-title">保存并返回标题</button></div>`;
    const bind = (id, fn) => { const el = $(id, this.body); el.style.pointerEvents = 'auto'; el.oninput = el.onchange = () => fn(el); };
    bind('#s-vol', (el) => { s.volume = +el.value; g.applySettings(); });
    bind('#s-music', (el) => { s.music = +el.value; g.applySettings(); });
    bind('#s-sens', (el) => { s.sensitivity = +el.value; });
    bind('#s-inv', (el) => { s.invertY = el.checked; });
    bind('#s-shadow', (el) => { s.shadows = el.checked; g.applySettings(); });
    bind('#s-ai', (el) => { s.aiChat = el.checked; });
    const sv = $('#s-save', this.body); sv.style.pointerEvents = 'auto'; sv.onclick = () => { g.state.save(); g.hud.toast('已保存'); };
    const tt = $('#s-title', this.body); tt.style.pointerEvents = 'auto'; tt.onclick = () => { g.state.save(); location.reload(); };
  }
}
