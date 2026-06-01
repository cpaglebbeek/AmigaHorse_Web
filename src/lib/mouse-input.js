// AmigaHorse_Web — Mouse input bridge (v0.0.18-XenonII)
//
// DOM mouse-events → vAmiga's `wasm_mouse(port, dx, dy)` + `wasm_mouse_button(port, btnId, pressed)`.
//
// **PROTOCOL (uit main.cpp:1944-1968, bevestigd v0.0.18):**
// - `wasm_mouse(port, x, y)` → `Cmd::MOUSE_MOVE_REL` met (x, y) als **DELTA** (dx, dy)!
//   NIET absolute coords zoals v0.0.6 t/m v0.0.17 deed. Absolute waardes interpreteerde
//   vAmiga als monsterlijke sprongen → muis onbruikbaar.
// - `wasm_mouse_button(port, button_id, pressed)`:
//     button_id == 1 → LEFT (NIET 0 zoals v0.0.6 t/m v0.0.17!)
//     button_id == 2 → MIDDLE
//     button_id == 3 → RIGHT (NIET 1!)
//   Browser MouseEvent.button: 0=left, 1=middle, 2=right.
//
// vAmiga mouse-port: 1 = port 1 (default), 2 = port 2.

const PORT_MOUSE = 1;
const BTN_LEFT = 1;     // vAmiga-conventie (main.cpp:1958)
const BTN_MIDDLE = 2;   // vAmiga-conventie (main.cpp:1961)
const BTN_RIGHT = 3;    // vAmiga-conventie (main.cpp:1964)

export class MouseInput {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} bindings  — uit getBindings()
   */
  constructor(canvas, bindings) {
    this.canvas = canvas;
    this.bindings = bindings;
    this.attached = false;
    // v0.0.18: track laatste positie voor delta-berekening (MOUSE_MOVE_REL)
    this.lastX = null;
    this.lastY = null;
    this._onMove = (e) => this._handleMove(e);
    this._onDown = (e) => this._handleDown(e);
    this._onUp = (e) => this._handleUp(e);
    this._onEnter = (e) => this._handleEnter(e);  // reset delta-tracking
    this._onLeave = () => { this.lastX = null; this.lastY = null; };
    this._onContextMenu = (e) => e.preventDefault();  // rechter-knop niet → browser-menu
  }

  /**
   * Attach event-listeners. Idempotent.
   */
  attach() {
    if (this.attached) return;
    this.canvas.addEventListener('mousemove', this._onMove);
    this.canvas.addEventListener('mousedown', this._onDown);
    this.canvas.addEventListener('mouseup', this._onUp);
    this.canvas.addEventListener('mouseenter', this._onEnter);
    this.canvas.addEventListener('mouseleave', this._onLeave);
    this.canvas.addEventListener('contextmenu', this._onContextMenu);
    // Tab kwijt → buttons "release" om sticky-state te voorkomen
    window.addEventListener('blur', this._onBlurRelease);
    this.attached = true;
  }

  detach() {
    if (!this.attached) return;
    this.canvas.removeEventListener('mousemove', this._onMove);
    this.canvas.removeEventListener('mousedown', this._onDown);
    this.canvas.removeEventListener('mouseup', this._onUp);
    this.canvas.removeEventListener('mouseenter', this._onEnter);
    this.canvas.removeEventListener('mouseleave', this._onLeave);
    this.canvas.removeEventListener('contextmenu', this._onContextMenu);
    window.removeEventListener('blur', this._onBlurRelease);
    this.attached = false;
  }

  _onBlurRelease = () => {
    // Sticky-prevention: alle knoppen los
    this.bindings.mouseButton(PORT_MOUSE, BTN_LEFT, 0);
    this.bindings.mouseButton(PORT_MOUSE, BTN_RIGHT, 0);
  };

  _toCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    return { x, y };
  }

  _handleEnter(e) {
    // Eerste positie na entry: log + initial delta = 0 (geen sprong)
    const { x, y } = this._toCanvasCoords(e);
    this.lastX = x;
    this.lastY = y;
  }

  _handleMove(e) {
    const { x, y } = this._toCanvasCoords(e);
    if (this.lastX === null) {
      // Eerste move zonder voorafgaande enter — init zonder delta
      this.lastX = x;
      this.lastY = y;
      return;
    }
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    this.lastX = x;
    this.lastY = y;
    if (dx !== 0 || dy !== 0) {
      this.bindings.mouse(PORT_MOUSE, dx, dy);
    }
  }

  _handleDown(e) {
    e.preventDefault();
    // Browser MouseEvent.button: 0=left, 1=middle, 2=right
    const btn = e.button === 2 ? BTN_RIGHT : e.button === 1 ? BTN_MIDDLE : BTN_LEFT;
    this.bindings.mouseButton(PORT_MOUSE, btn, 1);
  }

  _handleUp(e) {
    e.preventDefault();
    const btn = e.button === 2 ? BTN_RIGHT : e.button === 1 ? BTN_MIDDLE : BTN_LEFT;
    this.bindings.mouseButton(PORT_MOUSE, btn, 0);
  }
}

/**
 * v0.0.18: vAmiga heeft alleen MOUSE_MOVE_REL → om naar absolute (x, y) te gaan
 * eerst grote negatieve delta naar (0,0) corner parken, dan delta naar target.
 */
async function moveToAbsolute(bindings, x, y, sleepFn, delayMs) {
  bindings.mouse(PORT_MOUSE, -9999, -9999);  // park top-left
  await sleepFn(delayMs);
  bindings.mouse(PORT_MOUSE, x, y);           // delta van (0,0) = target
}

/**
 * Helper voor scripted mouse-events (gebruikt in bake-flow voor WB-icon-double-click).
 *
 * @param {object} bindings
 * @param {number} x   — absolute emulator-coord (vAmiga heeft alleen delta-API, wij parken eerst)
 * @param {number} y   — absolute emulator-coord
 * @param {object} opts
 *   .delayMs       — sleep tussen click-events (default 80ms)
 */
export async function scriptedDoubleClick(bindings, x, y, opts = {}) {
  const { delayMs = 80 } = opts;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await moveToAbsolute(bindings, x, y, sleep, delayMs);
  await sleep(delayMs);
  bindings.mouseButton(PORT_MOUSE, BTN_LEFT, 1);
  await sleep(delayMs);
  bindings.mouseButton(PORT_MOUSE, BTN_LEFT, 0);
  await sleep(delayMs);
  bindings.mouseButton(PORT_MOUSE, BTN_LEFT, 1);
  await sleep(delayMs);
  bindings.mouseButton(PORT_MOUSE, BTN_LEFT, 0);
}

/**
 * Helper voor één scripted click.
 */
export async function scriptedClick(bindings, x, y, opts = {}) {
  const { delayMs = 80 } = opts;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await moveToAbsolute(bindings, x, y, sleep, delayMs);
  await sleep(delayMs);
  bindings.mouseButton(PORT_MOUSE, BTN_LEFT, 1);
  await sleep(delayMs);
  bindings.mouseButton(PORT_MOUSE, BTN_LEFT, 0);
}
