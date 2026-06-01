// AmigaHorse_Web — Canvas-renderer (v0.0.16-StuntCarRacer)
//
// vAmiga's pixel-buffer-layout (uit external/vamigaweb/js/vAmiga_canvas.js):
// - Texel = u32 (RGBA, byte-order detect bij eerste frame)
// - Volledige textuur = HPIXELS × VPIXELS = 912 × 313 (vol Amiga raster incl.
//   HBLANK + VBLANK + overscan), ONGEACHT zichtbare resolutie
// - Het zichtbare window staat op (xOff, yOff) met dimensies (clipped_w, clipped_h)
// - vAmigaWeb signaleert deze geometrie via EM_ASM `js_set_display(xOff, yOff, w, h)`
//   (zie wasm-bridge.js — gevangen in window.__vamigaViewport)
//
// Correct blit (vAmigaWeb's eigen pattern, vAmiga_canvas.js:20-33):
//   1. ImageData = HPIXELS × clipped_height (volle width, geknipte height)
//   2. Lees HEAPU8 vanaf `pixelBuffer + yOff * HPIXELS * 4`, lengte HPIXELS*ch*4
//   3. putImageData(image_data, -xOff, 0, xOff, 0, clipped_width, clipped_height)
//      ↳ negatief dx + dirty-region = crop tot zichtbaar window
//
// Fout (v0.0.15-Populous): we lazen `clipped_w × clipped_h` lineair vanaf base —
// ontbrekende HPIXELS stride → diagonale shearing → scrambled beeld.

const HPIXELS = 912;   // vol raster (zie Core/Infrastructure/Constants.h)
const VPIXELS = 313;
const BYTES_PER_PIXEL = 4;
const HPIXELS_BYTES = HPIXELS * BYTES_PER_PIXEL;

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

    // ImageData op volle HPIXELS-breedte; height groeit mee met viewport
    this.imageData = null;
    this.lastImgHeight = 0;
    this.rafHandle = null;
    this.running = false;
    this.frameCount = 0;
    this.lastFpsCheck = 0;
    this.fps = 0;
    this.pixelFormat = null;       // 'RGBA' | 'ARGB'
    this.firstFrameRendered = false;
    this.containerMaxWidth = 800;  // gezet door fitToContainer; lazy-applied
  }

  /**
   * Heuristiek: vAmiga zet alpha=0xFF op alle pixels. Detecteer of het in byte-0
   * (ARGB / Mac/iOS-stijl) of byte-3 (RGBA / Canvas2D-stijl) staat.
   */
  _detectPixelFormat(heapView) {
    const stride = Math.max(4, Math.floor(heapView.length / 8 / 4) * 4);
    let rgbaScore = 0;
    let argbScore = 0;
    for (let i = 0; i < heapView.length - 4; i += stride) {
      if (heapView[i + 3] === 0xFF) rgbaScore++;
      if (heapView[i + 0] === 0xFF) argbScore++;
    }
    if (argbScore > rgbaScore) return 'ARGB';
    return 'RGBA';
  }

  /**
   * Kopieer pixel-data van WASM-heap naar ImageData.data, met format-conversie
   * indien nodig.
   */
  _copyPixels(heapView, dst) {
    if (this.pixelFormat === 'ARGB') {
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
      dst.set(heapView);
    }
  }

  /**
   * Update canvas CSS-grootte op basis van huidige viewport. Idempotent.
   * Roept dezelfde berekening aan als oude fitToContainer maar pas NA eerste
   * frame met geldige dimensies → voorkomt height=0px race (v0.0.15-bug).
   */
  _applyCanvasCss(clippedW, clippedH) {
    const ratio = clippedH / (clippedW || 1);
    const w = Math.min(this.containerMaxWidth, window.innerWidth - 32);
    const h = Math.round(w * ratio);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.style.imageRendering = 'pixelated';
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastFpsCheck = performance.now();
    this.frameCount = 0;
    this._tick();
  }

  stop() {
    this.running = false;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  /**
   * Eén frame: CPU step + framebuffer-sync + blit naar canvas.
   */
  _tick() {
    if (!this.running) return;
    const now = performance.now();

    try {
      // Twee calls per frame (vAmigaWeb's do_animation_frame contract):
      this.bindings.execute();          // CPU/chipset stepping (computeFrame)
      this.bindings.drawOneFrame(now);  // framebuffer-sync + js_set_display call

      // Huidige viewport uit window.__vamigaViewport (gezet via EM_ASM callback)
      const vp = window.__vamigaViewport || { xOff: 18, yOff: 32, w: 886, h: 281 };
      const { xOff, yOff, w: clippedW, h: clippedH } = vp;

      if (clippedW <= 0 || clippedH <= 0) {
        // Viewport nog niet gezet of degenereerd — sla deze tick over
        this.rafHandle = requestAnimationFrame(() => this._tick());
        return;
      }

      // Canvas-intern op visible-window grootte
      if (this.canvas.width !== clippedW || this.canvas.height !== clippedH) {
        this.canvas.width = clippedW;
        this.canvas.height = clippedH;
      }

      // ImageData op volle HPIXELS × clippedH (we putImageData-en met crop)
      if (!this.imageData || this.lastImgHeight !== clippedH) {
        this.imageData = this.ctx.createImageData(HPIXELS, clippedH);
        this.lastImgHeight = clippedH;
      }

      // Pixel-buffer: start yOff rijen vóór de visible top
      const ptrBase = this.bindings.pixelBuffer();
      if (ptrBase !== 0) {
        const sourceOffset = ptrBase + yOff * HPIXELS_BYTES;
        const bytesNeeded = HPIXELS * clippedH * BYTES_PER_PIXEL;
        const heapView = this.Module.HEAPU8.subarray(
          sourceOffset,
          sourceOffset + bytesNeeded,
        );

        if (this.pixelFormat === null && heapView.length >= 4) {
          this.pixelFormat = this._detectPixelFormat(heapView);
          console.log(`[canvas-renderer] pixel-format gedetecteerd: ${this.pixelFormat}`);
        }

        this._copyPixels(heapView, this.imageData.data);

        // Crop tot visible: putImageData(data, dx, dy, dirtyX, dirtyY, dirtyW, dirtyH)
        // dx=-xOff schuift de bron-textuur naar links, dirtyX=xOff begint de crop
        // → resultaat: pixel (xOff,0) in bron landt op (0,0) in canvas
        this.ctx.putImageData(this.imageData, -xOff, 0, xOff, 0, clippedW, clippedH);

        // Eerste valide frame: nu kunnen we CSS-grootte zetten zonder height=0
        if (!this.firstFrameRendered) {
          this.firstFrameRendered = true;
          this._applyCanvasCss(clippedW, clippedH);
        }
      }

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
   * Bewaar max-CSS-breedte; daadwerkelijke style wordt pas in _tick() toegepast
   * zodra het eerste frame met geldige dimensies binnen is. Voorkomt v0.0.15-race
   * waarbij height=0px werd gezet voordat lastSize bekend was.
   */
  fitToContainer(maxWidth = 800) {
    this.containerMaxWidth = maxWidth;
    if (this.firstFrameRendered) {
      // Canvas heeft al een frame → meteen toepassen
      const vp = window.__vamigaViewport;
      if (vp && vp.w > 0 && vp.h > 0) {
        this._applyCanvasCss(vp.w, vp.h);
      }
    }
    // Anders: _tick() past het toe na eerste valide frame
  }
}
