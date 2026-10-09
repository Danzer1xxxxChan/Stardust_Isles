// Pause menu: map (with fast travel), quests, collection, codex, wardrobe, settings.
import { CODEX, HATS, ABILITY_NAMES, SHARD_TOTAL, FEATHER_TOTAL } from '../game/content.js';
import { questList } from '../game/quests.js';
import { WORLD_HALF, REGIONS } from '../world/layout.js';
import { QUALITY } from '../render/post.js';
import { groundHeight, waterLevel, SEG } from '../world/terrain.js';
import { terrainColor } from '../world/terrainMesh.js';
import * as THREE from 'three';
import { t, LANG, LANGS, setLang } from '../i18n.js';

const $ = (s, r = document) => r.querySelector(s);
const TABS = [['map', t('地图')], ['quests', t('任务')], ['collect', t('收集')], ['codex', t('图鉴')], ['wardrobe', t('装扮')], ['settings', t('设置')]];
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
    // player (clamped to the map edge when out on the far isles)
    let [px, pz] = toC(g.player.pos.x, g.player.pos.z);
    const offMap = px < 0 || pz < 0 || px > W || pz > W;
    px = Math.max(12, Math.min(W - 12, px)); pz = Math.max(12, Math.min(W - 12, pz));
    ctx.save(); ctx.translate(px, pz); ctx.rotate(-g.player.yaw + Math.PI);
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 9); ctx.lineTo(0, 4); ctx.lineTo(-8, 9); ctx.closePath();
    ctx.fillStyle = '#e94e3c'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();

    const canTravel = g.canTravel();
    const far = `<div class="sec">${t('远方群岛')}</div><div>${offMap ? t('你在地图之外：距离群岛中心 <b>{0} 米</b>', [Math.round(Math.hypot(g.player.pos.x, g.player.pos.z))]) : t('走出海岸，沿着沙洲栈道就能到达。')}<br>${t('最远到过 {0} 米', [Math.round(d.farthest || 0)])}</div>`;
    side.innerHTML = `<div class="sec">${t('图例')}</div>
      <div>🔥 ${t('营火：')}${canTravel ? `<b>${t('点击已点亮的营火快速旅行')}</b>` : t('现在不能快速旅行')}</div>
      <div>💬 ${t('认识的居民')}</div><div>🗼 ${t('星屑灯塔')}</div><div style="color:#d0453a">✕ ${t('藏宝图标记')}</div>
      <div class="sec">${t('已点亮营火 {0}/{1}', [d.campfires.length, g.world.campfires.length])}</div>
      <div>${g.world.campfires.filter((c) => d.campfires.includes(c.id)).map((c) => c.name).join('<br>') || t('还没有点亮任何营火。走到营火旁按 E 点亮。')}</div>${far}`;
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
    const ab = Object.entries(ABILITY_NAMES).map(([k, n]) => `<div class="card ${d.abilities[k] ? '' : 'locked'}"><div class="t">${d.abilities[k] ? n : t('？？？')}</div></div>`).join('');
    const fishN = Object.values(d.items.fish).reduce((a, b) => a + b, 0);
    const mins = Math.floor(d.playTime / 60);
    const stat = (label, val) => `<div class="stat"><span>${label}</span><b>${val}</b></div>`;
    const fish = Object.entries(d.items.fish).map(([k, v]) => `<div class="card"><div class="t">🐟 ${CODEX.find((c) => c.id === k)?.name || k} × ${v}</div></div>`).join('');
    const maps = d.maps.map((m) => `<div class="card"><div class="t">🗺️ ${t('藏宝图')}</div><div class="d">${this.game.content.digs.find((x) => x.map === m)?.clue || ''}</div></div>`).join('');
    this.body.innerHTML = `
      <div class="sec">${t('进度')}</div>
      ${stat('⭐ ' + t('星屑'), `${d.shards.length} / ${SHARD_TOTAL}`)}
      ${stat('🪶 ' + t('金羽毛（体力上限）'), `${d.feathers.length} / ${FEATHER_TOTAL}`)}
      ${stat('🐚 ' + t('贝壳币'), d.coins)}
      ${stat('📖 ' + t('图鉴'), `${d.codex.length} / ${CODEX.length}`)}
      ${stat('🔥 ' + t('营火'), `${d.campfires.length} / ${this.game.world.campfires.length}`)}
      ${stat('🎣 ' + t('钓到的鱼'), fishN)}
      ${stat('📦 ' + t('打开的宝箱'), `${d.chests.length} / ${this.game.content.chests.length}`)}
      ${stat('⏱ ' + t('游戏时间'), t('{0} 分钟', [mins]))}
      <div class="sec">${t('道具')}</div><div class="grid">${ab}</div>
      <div class="sec">${t('背包')}</div>
      <div class="grid">
        <div class="card"><div class="t">☕ ${t('热可可')} × ${d.items.cocoa}</div></div>
        <div class="card"><div class="t">🍄 ${t('发光蘑菇')} × ${d.items.mushrooms}</div></div>
        ${fish}
        ${maps}
      </div>`;
  }

  _codex() {
    const d = this.game.state.data;
    const cats = [...new Set(CODEX.map((c) => c.cat))];
    this.body.innerHTML = `<div style="color:#8a7c68">${t('按 C 打开相机，对准目标点击拍照即可登记。鱼类需要钓上来才会登记。已登记 {0} / {1}', [d.codex.length, CODEX.length])}</div>` +
      cats.map((cat) => `<div class="sec">${cat}</div><div class="grid">${CODEX.filter((c) => c.cat === cat).map((c) => {
        const got = d.codex.includes(c.id);
        return `<div class="card ${got ? '' : 'locked'}"><div class="t">${got ? c.name : t('？？？')}</div><div class="d">${got ? c.desc : (c.fish ? t('用钓竿钓上来') : t('用相机拍下来'))}</div></div>`;
      }).join('')}</div>`).join('');
  }

  _wardrobe() {
    const d = this.game.state.data;
    const owned = ['__none', ...d.hats];
    this.body.innerHTML = `<div style="color:#8a7c68">${t('点击切换帽子。帽子可以在商店买到，或者藏在宝箱里。已收集 {0} / {1}', [d.hats.length, Object.keys(HATS).length])}</div><div class="grid" style="margin-top:12px"></div>`;
    const grid = $('.grid', this.body);
    for (const h of owned) {
      const el = document.createElement('div');
      el.className = 'card clickable' + ((d.hat || '__none') === h ? ' sel' : '');
      el.style.pointerEvents = 'auto';
      el.innerHTML = `<div class="t">${h === '__none' ? t('不戴帽子') : HATS[h]}</div>`;
      el.onclick = () => { d.hat = h === '__none' ? null : h; this.game.player.char.setHat(d.hat); this.game.audio.play('click'); this.show('wardrobe'); };
      grid.appendChild(el);
    }
    for (const h of Object.keys(HATS)) if (!d.hats.includes(h)) {
      const el = document.createElement('div'); el.className = 'card locked'; el.innerHTML = `<div class="t">${t('？？？')}</div>`; grid.appendChild(el);
    }
  }

  _settings() {
    const g = this.game, s = g.state.data.settings;
    const help = ['WASD / 方向键 移动 · 鼠标 转动视角（点击画面锁定，或按住右键拖动）· 滚轮 缩放',
      '空格 跳跃；在空中再按一次：二段跳（弹跳靴）或展开滑翔翼（按住保持滑翔）',
      '朝着陡坡移动就会攀爬，消耗体力；体力用完会滑下来。收集金羽毛可以提升体力上限',
      'Shift 冲刺 · E 互动 · C 相机 · Tab / M 菜单和地图',
      '左键 / J 攻击（连按打出三段连击，空中按下是下落重击）· Q 翻滚闪避（有无敌时间，消耗体力）',
      '走出主岛的海岸（沙洲栈道、游泳或滑翔）就是无限延伸的远方群岛：越远越危险，宝箱也越丰厚'].map((x) => t(x)).join('<br>');
    const note = (x) => `<span style="color:#8a7c68;font-size:13px">${x}</span>`;
    this.body.innerHTML = `
      <div class="row"><label>${t('语言 / Language')}</label><select id="s-lang">${Object.entries(LANGS).map(([k, n]) => `<option value="${k}" ${LANG === k ? 'selected' : ''}>${n}</option>`).join('')}</select>${note(t('切换后会保存并重新载入'))}</div>
      <div class="row"><label>${t('音效音量')}</label><input type="range" min="0" max="1" step="0.05" id="s-vol" value="${s.volume}"></div>
      <div class="row"><label>${t('音乐音量')}</label><input type="range" min="0" max="1" step="0.05" id="s-music" value="${s.music}"></div>
      <div class="row"><label>${t('鼠标灵敏度')}</label><input type="range" min="0.3" max="2.5" step="0.1" id="s-sens" value="${s.sensitivity}"></div>
      <div class="row"><label>${t('反转 Y 轴')}</label><input type="checkbox" id="s-inv" ${s.invertY ? 'checked' : ''}></div>
      <div class="row"><label>${t('画质')}</label><select id="s-quality">${Object.entries(QUALITY).map(([k, q]) => `<option value="${k}" ${s.quality === k ? 'selected' : ''}>${q.label}</option>`).join('')}</select>${note(t('高：泛光、柔和阴影、茂密草地 · 极致：再加环境光遮蔽'))}</div>
      <div class="row"><label>${t('阴影')}</label><input type="checkbox" id="s-shadow" ${s.shadows ? 'checked' : ''}>${note(t('关闭可以提升帧率'))}</div>
      <div class="row"><label>${t('AI 闲聊')}</label><input type="checkbox" id="s-ai" ${s.aiChat ? 'checked' : ''}>${note(g.ai.available ? t('已连接：和居民对话时可以选择“随便聊聊”') : t('服务器未配置 API Key，此功能不可用'))}</div>
      <div class="sec">${t('操作说明')}</div>
      <div class="d" style="line-height:1.9;color:#8a7c68">${help}</div>
      <div class="row" style="margin-top:20px"><button class="btn ghost" id="s-save">${t('保存游戏')}</button><button class="btn ghost" id="s-title">${t('保存并返回标题')}</button></div>`;
    const bind = (id, fn) => { const el = $(id, this.body); el.style.pointerEvents = 'auto'; el.oninput = el.onchange = () => fn(el); };
    bind('#s-lang', (el) => { if (el.value !== LANG) { g.state.save(); setLang(el.value); location.reload(); } });
    bind('#s-vol', (el) => { s.volume = +el.value; g.applySettings(); });
    bind('#s-music', (el) => { s.music = +el.value; g.applySettings(); });
    bind('#s-sens', (el) => { s.sensitivity = +el.value; });
    bind('#s-inv', (el) => { s.invertY = el.checked; });
    bind('#s-shadow', (el) => { s.shadows = el.checked; g.applySettings(); });
    bind('#s-quality', (el) => { s.quality = el.value; g.applySettings(); });
    bind('#s-ai', (el) => { s.aiChat = el.checked; });
    const sv = $('#s-save', this.body); sv.style.pointerEvents = 'auto'; sv.onclick = () => { g.state.save(); g.hud.toast(t('已保存')); };
    const tt = $('#s-title', this.body); tt.style.pointerEvents = 'auto'; tt.onclick = () => { g.state.save(); location.reload(); };
  }
}
