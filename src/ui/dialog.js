import { t } from '../i18n.js';
// Typewriter dialog box with choices and optional free-text chat input.
const $ = (s, r = document) => r.querySelector(s);

export class Dialog {
  constructor(audio) {
    this.audio = audio;
    this.el = $('#dialog');
    this.nameEl = $('.name', this.el);
    this.textEl = $('.text', this.el);
    this.choicesEl = $('.choices', this.el);
    this.nextEl = $('.next', this.el);
    this.chatEl = $('.chat', this.el);
    this.inputEl = $('input', this.chatEl);
    this.active = false;
    this._resolve = null;
    this._typing = null;
    this._choice = -1;
    this.voice = 500;
    addEventListener('keydown', (e) => this._key(e));
    this.el.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('choice') || e.target.tagName === 'INPUT') return;
      this._advance();
    });
  }

  open(voice = 500) { this.active = true; this.voice = voice; this.el.hidden = false; }
  close() { this.active = false; this.el.hidden = true; this.closedAt = performance.now(); }

  _key(e) {
    if (!this.active) return;
    if (this.chatEl.hidden === false) {
      if (e.code === 'Enter') { e.preventDefault(); const v = this.inputEl.value.trim(); this.inputEl.value = ''; this._finish(v || null); }
      else if (e.code === 'Escape') { e.preventDefault(); this._finish(null); }
      return;
    }
    if (this._choice >= 0) {
      const n = this.choicesEl.children.length;
      if (['ArrowUp', 'KeyW'].includes(e.code)) { this._select((this._choice - 1 + n) % n); e.preventDefault(); }
      else if (['ArrowDown', 'KeyS'].includes(e.code)) { this._select((this._choice + 1) % n); e.preventDefault(); }
      else if (['Space', 'KeyE', 'Enter'].includes(e.code)) { e.preventDefault(); if (!this._typing) this._finish(this._choice); else this._completeTyping(); }
      return;
    }
    if (['Space', 'KeyE', 'Enter'].includes(e.code)) { e.preventDefault(); this._advance(); }
  }

  _advance() {
    if (this._typing) { this._completeTyping(); return; }
    if (this._choice >= 0) return;
    this._finish(true);
  }

  _finish(v) {
    const r = this._resolve;
    this._resolve = null;
    this._choice = -1;
    this.choicesEl.innerHTML = '';
    this.chatEl.hidden = true;
    if (r) { this.audio?.play('click'); r(v); }
  }

  _type(text) {
    this.textEl.textContent = '';
    this.nextEl.hidden = true;
    let i = 0;
    return new Promise((done) => {
      const step = () => {
        if (!this._typing) return;
        i += 1;
        this.textEl.textContent = text.slice(0, i);
        if (i % 2 === 0 && text[i - 1] !== ' ') this.audio?.play('blip', this.voice);
        if (i >= text.length) { this._typing = null; this.nextEl.hidden = false; done(); return; }
        this._typing.timer = setTimeout(step, /[，。！？…、.,!?]/.test(text[i - 1]) ? 110 : 28);
      };
      this._typing = { text, done, timer: setTimeout(step, 30) };
    });
  }

  _completeTyping() {
    if (!this._typing) return;
    clearTimeout(this._typing.timer);
    const { text, done } = this._typing;
    this._typing = null;
    this.textEl.textContent = text;
    this.nextEl.hidden = this._choice >= 0;
    done();
  }

  say(name, text) {
    this.nameEl.textContent = name;
    this.nameEl.hidden = !name;
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._type(text);
    });
  }

  choose(name, text, options) {
    this.nameEl.textContent = name;
    this.nameEl.hidden = !name;
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._choice = 0;
      this._type(text).then(() => { this.nextEl.hidden = true; });
      this.choicesEl.innerHTML = '';
      options.forEach((o, i) => {
        const d = document.createElement('div');
        d.className = 'choice';
        d.textContent = o;
        d.style.pointerEvents = 'auto';
        d.onmouseenter = () => this._select(i);
        d.onclick = () => this._finish(i);
        this.choicesEl.appendChild(d);
      });
      this._select(0);
    });
  }

  _select(i) {
    this._choice = i;
    [...this.choicesEl.children].forEach((c, k) => c.classList.toggle('sel', k === i));
  }

  chat(name, prompt) {
    this.nameEl.textContent = name;
    this.textEl.textContent = prompt;
    this.nextEl.hidden = true;
    this.chatEl.hidden = false;
    setTimeout(() => this.inputEl.focus(), 30);
    return new Promise((resolve) => { this._resolve = resolve; });
  }

  thinking(name) {
    this.nameEl.textContent = name;
    this.textEl.innerHTML = t('<span class="thinking">（思考中…）</span>');
    this.nextEl.hidden = true;
  }
}
