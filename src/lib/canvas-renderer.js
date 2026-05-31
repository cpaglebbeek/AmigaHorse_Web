// AmigaHorse_Web — Canvas-renderer (v0.0.6-Apidya, sub-step 6)
//
// Render-loop voor vAmiga-framebuffer → HTML5 Canvas2D via ImageData.
//
// vAmiga's pixel-buffer layout (uit `wasm_pixel_buffer()` → `Texel*`):
// - Texel = u32 (ARGB of RGBA, te detecteren op runtime)
// - Width × Height pixels in row-major
// - Standaard Amiga OCS: ~320×256 (PAL) of 320×200 (NTSC)
// - High-res / interlace verdubbelt dims
//
// Loop-pattern:
//   requestAnimationFrame → wasm_draw_one_frame(performance.now())
//     → wasm_pixel_buffer() → HEAPU8.subarray → ImageData → putImageData
//
// vAmiga draait nominaal op 50Hz (PAL) of 60Hz (NTSC). Browser
// requestAnimationFrame is meestal 60Hz; we draaien gewoon zo snel mogelijk en
// vAmiga interne timing zorgt voor frame-rate-consistency.

export class CanvasRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} bindings — uit getBindings() (wasm-bridge.js)
   * @param {object} Module   — Emscripten Module (voor HEAP-access)
   */
  constructor(canvas, bindings, Module) {
    this.canvas = canvas;
    this.bindings = bindings;
    this.Module = Module;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('Canvas 2D-context niet beschikbaar');

    this.imageData = null;     // herzien zodra eerste frame size bekend is
    this.lastSize = { w: 0, h: 0 };
    this.rafHandle = null;
    this.running = false;
    this.frameCount = 0;
    this.lastFpsCheck = 0;
    this.fps = 0;
  }

  /**
   * Start de render-loop. Idempotent: tweede call wordt genegeerd.
   */
  start() {
    if (this.running) return;
    this.running = true;
    this.lastFpsCheck = performance.now();
    this.frameCount = 0;
    this._tick();
  }

  /**
   * Stop de render-loop.
   */
  stop() {
    this.running = false;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  /**
   * Eén frame: laat emulator stappen + blit framebuffer naar canvas.
   */
  _tick() {
    if (!this.running) return;
    const now = performance.now();

    try {
      // Emulator-step: laat vAmiga één frame berekenen
      this.bindings.drawOneFrame(now);

      // Lees framebuffer-dimensies (kan wijzigen bij resolution-switch)
      const w = this.bindings.renderWidth();
      const h = this.bindings.renderHeight();
      if (w > 0 && h > 0) {
        // Resize canvas + ImageData als afmetingen veranderd
        if (w !== this.lastSize.w || h !== this.lastSize.h) {
          this.canvas.width = w;
          this.canvas.height = h;
          this.imageData = this.ctx.createImageData(w, h);
          this.lastSize = { w, h };
        }

        // Kopieer pixel-buffer uit WASM-heap naar ImageData.data
        const ptr = this.bindings.pixelBuffer();
        if (ptr !== 0) {
          // Texel = u32 = 4 bytes. Layout aanname: little-endian RGBA (= Canvas2D
          // default voor ImageData op zowat alle hardware). Als vAmiga ARGB
          // schrijft (Mac/iOS-style), zien we kleurkanaal-swap → fix in v0.0.7.
          const bytes = w * h * 4;
          const heapView = this.Module.HEAPU8.subarray(ptr, ptr + bytes);
          this.imageData.data.set(heapView);
          this.ctx.putImageData(this.imageData, 0, 0);
        }
      }

      // FPS-counter (update elke seconde)
      this.frameCount++;
      if (now - this.lastFpsCheck >= 1000) {
        this.fps = this.frameCount;
        this.frameCount = 0;
        this.lastFpsCheck = now;
      }
    } catch (err) {
      console.error('[canvas-renderer] tick error:', err);
      this.stop();
      return;
    }

    this.rafHandle = requestAnimationFrame(() => this._tick());
  }

  /**
   * Resize handler: roep aan als window-size verandert om CSS-grootte aan te passen.
   * (Pixel-data blijft op native vAmiga-resolutie; we scalen via CSS.)
   */
  fitToContainer(maxWidth = 800) {
    const ratio = this.lastSize.h / (this.lastSize.w || 1);
    const w = Math.min(maxWidth, window.innerWidth - 32);
    const h = Math.round(w * ratio);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.style.imageRendering = 'pixelated';
  }
}
