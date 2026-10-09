// Heads-up display: counters, clock, stamina ring, prompts, toasts, banners, compass.
import * as THREE from 'three';
import { SHARD_TOTAL, FEATHER_TOTAL } from '../game/content.js';
import { t } from '../i18n.js';

const $ = (s) => document.querySelector(s);

export class Hud {
  constructor() {
    this.root = $('#hud');
    this.shard = $('#c-shard b'); this.feather = $('#c-feather b'); this.coin = $('#c-coin b');
    $('#c-shard i').textContent = '/' + SHARD_TOTAL;
    $('#c-feather i').textContent = '/' + FEATHER_TOTAL;
    this.clockText = $('#clock-text'); this.clockIcon = $('#clock-icon'); this.weather = $('#weather');
    this.stamina = $('#stamina'); this.staminaFg = $('#stamina-fg');
    this.prompt = $('#prompt'); this.promptText = $('#prompt span');
    this.region = $('#region-banner');
    this.toasts = $('#toasts');
    this.big = $('#big-banner');
    this.compass = $('#compass'); this.compassArrow = $('#compass-arrow'); this.compassDist = $('#compass-dist');
    this.race = $('#race-hud'); this.raceTitle = $('#race-title'); this.raceTime = $('#race-time');
    this.keysHint = $('#keys-hint');
    this.toolsHint = $('#tools-hint');
    this.vignette = $('#dark-vignette');
    this._last = {};
    this._regionTimer = null;
    this._bigTimer = null;
    this._v = new THREE.Vector3();
    const circ = 2 * Math.PI * 22;
    this.staminaFg.style.strokeDasharray = circ;
    this.circ = circ;
  }

  show(v) { this.root.hidden = !v; }

  pop(el) { el.parentElement.classList.add('pop'); setTimeout(() => el.parentElement.classList.remove('pop'), 200); }

  update(game) {
    const d = game.state.data;
    const set = (k, el, v) => { if (this._last[k] !== v) { if (this._last[k] !== undefined) this.pop(el); this._last[k] = v; el.textContent = v; } };
    set('s', this.shard, d.shards.length);
    set('f', this.feather, d.feathers.length);
    set('c', this.coin, d.coins);
    const h = Math.floor(d.time), m = Math.floor((d.time - h) * 60);
    const ct = t('第{0}天 {1}:{2}', [d.day, String(h).padStart(2, '0'), String(Math.floor(m / 10) * 10).padStart(2, '0')]);
    if (this._last.clock !== ct) { this._last.clock = ct; this.clockText.textContent = ct; }
    const icon = game.sky.night > 0.5 ? '🌙' : (d.time < 7 || d.time > 18 ? '🌅' : '☀️');
    if (this._last.icon !== icon) { this._last.icon = icon; this.clockIcon.textContent = icon; }
    const w = game.sky.rainTarget > 0 ? '🌧️' : '';
    if (this._last.w !== w) { this._last.w = w; this.weather.textContent = w; }

    // Stamina ring near the player
    const p = game.player;
    const frac = p.stamina / p.maxStamina;
    const showSt = frac < 0.999 || p.mode === 'climb';
    this.stamina.hidden = !showSt;
    if (showSt) {
      this._v.set(p.pos.x, p.pos.y + 1.9, p.pos.z).project(game.camera);
      const x = (this._v.x * 0.5 + 0.5) * innerWidth + 46, y = (-this._v.y * 0.5 + 0.5) * innerHeight;
      this.stamina.style.left = x + 'px'; this.stamina.style.top = y + 'px';
      this.staminaFg.style.strokeDashoffset = this.circ * (1 - frac);
      this.stamina.classList.toggle('low', frac < 0.25);
    }
  }

  setPrompt(text) {
    if (this._last.prompt === text) return;
    this._last.prompt = text;
    this.prompt.hidden = !text;
    if (text) this.promptText.textContent = text;
  }

  toast(text, ms = 2600) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 600);
  }

  banner(t1, t2 = '', ms = 2600) {
    this.big.querySelector('.t1').textContent = t1;
    this.big.querySelector('.t2').textContent = t2;
    this.big.classList.add('show');
    clearTimeout(this._bigTimer);
    this._bigTimer = setTimeout(() => this.big.classList.remove('show'), ms);
  }

  showRegion(name) {
    this.region.textContent = name;
    this.region.classList.add('show');
    clearTimeout(this._regionTimer);
    this._regionTimer = setTimeout(() => this.region.classList.remove('show'), 2600);
  }

  setCompass(angle, dist) {
    if (angle === null) { this.compass.hidden = true; return; }
    this.compass.hidden = false;
    this.compassArrow.style.transform = `rotate(${angle - Math.PI / 2}rad)`;
    this.compassDist.textContent = t('{0} 米', [Math.round(dist)]);
  }

  setRace(title, time) {
    if (title === null) { this.race.hidden = true; return; }
    this.race.hidden = false;
    this.raceTitle.textContent = title;
    this.raceTime.textContent = time;
  }

  setDarkness(v) { this.vignette.style.opacity = v; }
  setToolsHint(t) { if (this._last.tools !== t) { this._last.tools = t; this.toolsHint.textContent = t; } }
}
