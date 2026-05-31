// AmigaHorse_Web — Mouse input bridge (v0.0.6-Apidya, sub-step 6)
//
// DOM mouse-events → vAmiga's `wasm_mouse(port, x, y)` + `wasm_mouse_button(port, btnId, pressed)`.
//
// vAmiga mouse-port: 1 = mouse op port 1 (default Amiga-muis), 2 = port 2 (joy).
// Button-IDs: 0 = left, 1 = right, 2 = middle (vAmiga-conventie te verifieren).
//
// Coordinate scaling: vAmiga verwacht pixel-coördinaten relatief aan emulator-
// framebuffer (typisch 320×256). Wij berekenen op basis van canvas-bounding-rect
// + native dimensies (canvas.width/height).

const PORT_MOUSE = 1;
const BTN_LEFT = 0;
const BTN_RIGHT = 1;

export class MouseInput {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} bindings  — uit getBindings()
   */
  constructor(canvas, bindings) {
    this.canvas = canvas;
    this.bindings = bindings;
    this.attached = false;
    this._onMove = (e) => this._handleMove(e);
    this._onDown = (e) => this._handleDown(e);
    this._onUp = (e) => this._handleUp(e);
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

  _handleMove(e) {
    const { x, y } = this._toCanvasCoords(e);
    this.bindings.mouse(PORT_MOUSE, x, y);
  }

  _handleDown(e) {
    e.preventDefault();
    const btn = e.button === 2 ? BTN_RIGHT : BTN_LEFT;
    this.bindings.mouseButton(PORT_MOUSE, btn, 1);
  }

  _handleUp(e) {
    e.preventDefault();
    const btn = e.button === 2 ? BTN_RIGHT : BTN_LEFT;
    this.bindings.mouseButton(PORT_MOUSE, btn, 0);
  }
}

/**
 * Helper voor scripted mouse-events (gebruikt in bake-flow voor WB-icon-double-click).
 *
 * @param {object} bindings
 * @param {number} x   — emulator-coord
 * @param {number} y   — emulator-coord
 * @param {object} opts
 *   .delayMs       — sleep tussen click-events (default 80ms)
 */
export async function scriptedDoubleClick(bindings, x, y, opts = {}) {
  const { delayMs = 80 } = opts;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  bindings.mouse(PORT_MOUSE, x, y);
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
  bindings.mouse(PORT_MOUSE, x, y);
  await sleep(delayMs);
  bindings.mouseButton(PORT_MOUSE, BTN_LEFT, 1);
  await sleep(delayMs);
  bindings.mouseButton(PORT_MOUSE, BTN_LEFT, 0);
}
