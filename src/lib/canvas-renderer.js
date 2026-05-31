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
    // Pixel-format-detect (sub-step 7): vAmiga schrijft alpha=0xFF op alle pixels;
    // we kijken bij eerste valide frame of byte-0 of byte-3 == 0xFF om RGBA vs ARGB
    // te onderscheiden. `null` = nog niet bepaald.
    this.pixelFormat = null;   // 'RGBA' | 'ARGB' | null
  }

  /**
   * Heuristiek: vAmiga zet alpha=0xFF op alle pixels. Detecteer of het in byte-0
   * (ARGB / Mac/iOS-stijl) of byte-3 (RGBA / Canvas2D-stijl) staat.
   *
   * Test op meerdere pixels om noise te vermijden.
   */
  _detectPixelFormat(heapView) {
    // Sample 8 pixels verspreid over de buffer
    const stride = Math.max(4, Math.floor(heapView.length / 8 / 4) * 4);
    let rgbaScore = 0;
    let argbScore = 0;
    for (let i = 0; i < heapView.length - 4; i += stride) {
      if (heapView[i + 3] === 0xFF) rgbaScore++;
      if (heapView[i + 0] === 0xFF) argbScore++;
    }
    if (argbScore > rgbaScore) return 'ARGB';
    return 'RGBA';   // default (Canvas2D-conventie + onbeslist)
  }

  /**
   * Kopieer pixel-data van WASM-heap naar ImageData.data, met format-conversie
   * indien nodig.
   */
  _copyPixels(heapView, dst) {
    if (this.pixelFormat === 'ARGB') {
      // ARGB → RGBA: shift bytes [A,R,G,B] → [R,G,B,A]
      for (let i = 0; i < heapView.length; i += 4) {
        const a = heapView[i];
        const r = heapView[i + 1];
        const g = heapView[i + 2];
        const b = heapView[i + 3];
        dst[i]     = r;
        dst[i + 1] = g;
        dst[i + 2] = b;
        dst[i + 3] = a;
      }
    } else {
      // RGBA direct
      dst.set(heapView);
    }
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
          // Texel = u32 = 4 bytes per pixel.
          const bytes = w * h * 4;
          const heapView = this.Module.HEAPU8.subarray(ptr, ptr + bytes);

          // Sub-step 7: pixel-format-auto-detect bij eerste frame
          if (this.pixelFormat === null && heapView.length >= 4) {
            this.pixelFormat = this._detectPixelFormat(heapView);
            console.log(`[canvas-renderer] pixel-format gedetecteerd: ${this.pixelFormat}`);
          }

          this._copyPixels(heapView, this.imageData.data);
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
