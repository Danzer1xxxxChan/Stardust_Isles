// Keyboard + mouse input. Edges are latched per frame (beginFrame) so async game flows that
// resume after the frame's synchronous update still see the same "pressed" snapshot.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this._pending = new Set();
    this.mouseDX = 0; this.mouseDY = 0; this.wheel = 0; this.clicked = false; this.attackClick = false; this._atk = false;
    this._dx = 0; this._dy = 0; this._wheel = 0; this._click = false;
    this.enabled = true;
    this.locked = false;
    this.wantLock = true;
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this._pending.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this._click = true;
      if (e.button === 0 && this.locked) this._atk = true;
      if (this.wantLock && !this.locked && e.button === 0) canvas.requestPointerLock?.()?.catch?.(() => {});
    });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    addEventListener('mousemove', (e) => {
      if (this.locked || (e.buttons & 2)) { this._dx += e.movementX; this._dy += e.movementY; }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this._wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  }

  beginFrame() {
    this.pressed = this._pending;
    this._pending = new Set();
    this.mouseDX = this._dx; this.mouseDY = this._dy; this.wheel = this._wheel; this.clicked = this._click;
    this.attackClick = this.enabled && this._atk;
    this._dx = 0; this._dy = 0; this._wheel = 0; this._click = false; this._atk = false;
  }

  isDown(...codes) { return this.enabled && codes.some((c) => this.down.has(c)); }
  wasPressed(...codes) { return this.enabled && codes.some((c) => this.pressed.has(c)); }
  // Edge check that ignores `enabled` (UI and minigames while gameplay input is frozen).
  hit(...codes) { return codes.some((c) => this.pressed.has(c)); }

  axis() {
    if (!this.enabled) return { x: 0, y: 0 };
    let x = 0, y = 0;
    if (this.down.has('KeyW') || this.down.has('ArrowUp')) y += 1;
    if (this.down.has('KeyS') || this.down.has('ArrowDown')) y -= 1;
    if (this.down.has('KeyA') || this.down.has('ArrowLeft')) x -= 1;
    if (this.down.has('KeyD') || this.down.has('ArrowRight')) x += 1;
    const l = Math.hypot(x, y);
    return l > 1 ? { x: x / l, y: y / l } : { x, y };
  }

  look() { return this.enabled ? { dx: this.mouseDX, dy: this.mouseDY, wheel: this.wheel } : { dx: 0, dy: 0, wheel: 0 }; }

  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
}
