---
date: 2026-06-01
repo: AmigaHorse_Web
version: 0.0.16-StuntCarRacer
status: open
resume: "verder met AmigaHorse_Web v0.0.16-StuntCarRacer — hard-refresh + Quick BASIC drop sample.bas: canvas moet meteen na 1e drop zichtbaar zijn (geen height=0px race) EN beeld moet NIET scrambled zijn (HPIXELS=912 stride + js_set_display viewport crop). Console-verificatie: [vAmiga→js] js_set_display log + [canvas-renderer] pixel-format gedetecteerd."
---

# AmigaHorse_Web v0.0.16-StuntCarRacer — pixel-protocol & canvas height-race

**Sessie:** Vervolg op v0.0.15-Populous. User: "drop .bas blijft in beeld als ik dan nog een keer klik kan ik nog een .bas uploaden. als ik dat gedaan heb zie ik output in een scherm dat scrambled uit ziet."
**Classificatie:** Geel bugfix (twee JS↔Core protocol-bugs in renderer-laag).
**Bug-trail:** 6e ontdekking in dezelfde debug-sessie (v0.0.11-15 trace + nu v0.0.16).

## Diagnose via ClaudeBug + code-archeologie

Screenshot uit bugcheck-inbox (Z Fold6, 10:36) toonde:
- Dropzone-HTML "Drop je .bas hier" zichtbaar = niet aangetast
- Geen canvas-output naast/onder de dropzone = canvas onzichtbaar of off-screen
- User-rapport "tweede drop = scrambled" wees op een ANDER probleem dat pas zichtbaar werd zodra bug A opgelost was

→ Twee verschillende bugs, gemaskeerd door elkaars symptomen.

## Bug A — Canvas height=0px race in fitToContainer

**Locatie:** `src/lib/canvas-renderer.js:175-182` (v0.0.6-implementatie)

```js
fitToContainer(maxWidth = 800) {
  const ratio = this.lastSize.h / (this.lastSize.w || 1);  // = 0 bij start
  const w = Math.min(maxWidth, window.innerWidth - 32);    // = 800
  const h = Math.round(w * ratio);                          // = 0 !
  this.canvas.style.width = `${w}px`;
  this.canvas.style.height = `${h}px`;                      // = '0px' !
  this.canvas.style.imageRendering = 'pixelated';
}
```

**Aanroep-volgorde in `quick-launch.js:118-119`:**
```js
renderer.start();              // start rAF-loop, eerste _tick komt async
renderer.fitToContainer(800);  // SYNC direct daarna → lastSize nog {0,0}!
```

→ Canvas CSS-height = 0px → onzichtbaar achter dropzone-overlay.

Tweede drop "werkte" omdat lastSize tussen drops gevuld werd door overlevende rAF-ticks (renderer is `running=true` gebleven en tickte gewoon door op de onzichtbare canvas).

## Bug B — Scrambled output (HPIXELS=912 stride mismatch)

**Discovery-stap 1:** vAmigaWeb's eigen renderer (`external/vamigaweb/js/vAmiga_canvas.js:20-33`):

```js
function render_canvas() {
    let pixels = Module._wasm_pixel_buffer() + yOff*(HPIXELS<<2);
    let pixel_buffer = new Uint8Array(Module.HEAPU32.buffer, pixels, HPIXELS*clipped_height<<2);
    image_data.data.set(pixel_buffer);
    ctx.putImageData(image_data, -xOff, 0, xOff, 0, clipped_width, clipped_height);
}
```

**Discovery-stap 2:** `Core/Infrastructure/Constants.h:90`:
```cpp
static const isize HPIXELS = 912;   // 4 * HPOS_CNT
```

**Discovery-stap 3:** main.cpp:181 + main.cpp:1473 — viewport-geometrie callback:
```cpp
EM_ASM({js_set_display($0,$1,$2,$3); scaleVMCanvas();},
       xOff, yOff, clipped_width*TPP, clipped_height);
```

→ Pixel-buffer is **altijd HPIXELS=912 pixels wide**, ongeacht zichtbare resolutie. Het zichtbare window staat op (xOff, yOff) met afmetingen (clipped_width × clipped_height). vAmiga signaleert die geometrie via `js_set_display`-EM_ASM-callback.

**Onze fout (v0.0.6-implementatie):**
```js
const ptr = this.bindings.pixelBuffer();
const bytes = w * h * 4;                                        // ← w = clipped_w !
const heapView = this.Module.HEAPU8.subarray(ptr, ptr + bytes); // mist stride!
this._copyPixels(heapView, this.imageData.data);
this.ctx.putImageData(this.imageData, 0, 0);                    // geen crop
```

We lazen lineair `clipped_w × clipped_h × 4` bytes vanaf de base, alsof de buffer aaneengesloten was met deze breedte. In werkelijkheid is elke "row" 912 pixels lang in de buffer — onze interpretatie sheart het beeld diagonaal.

**Verergerend:** in v0.0.12-ProjectX hadden we `js_set_display` als **no-op** gestub'd om de `ReferenceError` te suppressen (vAmigaWeb laadt zijn eigen `vAmiga_canvas.js` met die functie; wij niet). Daardoor hadden we de viewport-info **niet** beschikbaar — wat het schrijven van een correcte renderer verhinderde.

## Fix v0.0.16-StuntCarRacer

### `src/wasm-bridge.js`

`js_set_display`-stub vervangen door echte capture:

```js
window.__vamigaViewport = { xOff: 18, yOff: 32, w: 886, h: 281, dirty: true };
window.js_set_display = (xOff, yOff, w, h) => {
  if (h % 2 !== 0) h++;   // even-height enforce (vAmigaWeb doet dat ook l40)
  window.__vamigaViewport = { xOff, yOff, w, h, dirty: true };
  console.debug('[vAmiga→js] js_set_display:', window.__vamigaViewport);
};
```

Defaults uit vAmigaWeb's eigen `vAmiga_canvas.js:5-8` (HBLANK_MIN=18, yOff=32, etc.).

### `src/lib/canvas-renderer.js`

Volledige rewrite van blit-logica:

```js
const HPIXELS = 912;
const HPIXELS_BYTES = HPIXELS * 4;

_tick() {
  this.bindings.execute();
  this.bindings.drawOneFrame(now);
  const { xOff, yOff, w: clippedW, h: clippedH } = window.__vamigaViewport;

  if (this.canvas.width !== clippedW) {
    this.canvas.width = clippedW;
    this.canvas.height = clippedH;
  }
  if (!this.imageData || this.lastImgHeight !== clippedH) {
    this.imageData = this.ctx.createImageData(HPIXELS, clippedH);
    this.lastImgHeight = clippedH;
  }

  const ptrBase = this.bindings.pixelBuffer();
  const sourceOffset = ptrBase + yOff * HPIXELS_BYTES;
  const bytesNeeded = HPIXELS * clippedH * 4;
  const heapView = this.Module.HEAPU8.subarray(sourceOffset, sourceOffset + bytesNeeded);
  this._copyPixels(heapView, this.imageData.data);
  this.ctx.putImageData(this.imageData, -xOff, 0, xOff, 0, clippedW, clippedH);

  if (!this.firstFrameRendered) {
    this.firstFrameRendered = true;
    this._applyCanvasCss(clippedW, clippedH);  // CSS pas NU, niet eerder
  }
}
```

**fitToContainer fix:**
```js
fitToContainer(maxWidth = 800) {
  this.containerMaxWidth = maxWidth;
  if (this.firstFrameRendered) { /* meteen toepassen */ }
  // anders: _tick() doet het na eerste valide frame
}
```

## Verified (statisch)

- ✓ `node --check src/lib/canvas-renderer.js`
- ✓ `node --check src/wasm-bridge.js`
- ✓ HPIXELS=912 bevestigd in `Core/Infrastructure/Constants.h:90`
- ✓ Pattern 1:1 overgenomen uit `external/vamigaweb/js/vAmiga_canvas.js:20-33` (render_canvas)
- ✓ js_set_display call-site main.cpp:181,1473 levert `(xOff, yOff, clipped_width*TPP, clipped_height)` met TPP=1

## Open na v0.0.16 (resume)

- **User hard-refresh test:** drop sample.bas → canvas direct zichtbaar (geen height=0) + niet scrambled
- **Console-verificatie:**
  - `[vAmiga→js] js_set_display: {xOff: <n>, yOff: <n>, w: <n>, h: <n>}` (binnen ~1 sec na drop)
  - `[canvas-renderer] pixel-format gedetecteerd: RGBA` of `ARGB`
- **Audio:** ScriptProcessorNode (v0.0.7) zou nu ook moeten werken — CPU stept en audio-sink kan HEAPF32 vullen
- **Dropzone-UX (lage prio):** na succesvolle 1e drop dropzone-tekst wijzigen naar "Drop een andere .bas om te vervangen"
- **Architectonisch (v0.0.17+):** `docs/CORE_API_CONTRACT.md` — pixel-protocol formeel documenteren:
  - HPIXELS=912 stride (vol raster)
  - js_set_display = verplicht, niet optioneel
  - putImageData-crop-pattern voor visible window
  - Frame-loop volgorde: execute → drawOneFrame → pixelBuffer read

## Bug-trail summary (v0.0.10 → v0.0.16, één debug-sessie)

| Versie | Codenaam | Bug | Fix |
|---|---|---|---|
| v0.0.11 | Alien Breed | Kickstart-flash silent fail door `.rom` vs `.rom_file` extension | filename-rename + 10-stage diagnostics |
| v0.0.12 | Project-X | `ReferenceError: js_set_display is not defined` (EM_ASM-callback) | window-stubs voor js_set_display + scaleVMCanvas |
| v0.0.13 | Super Frog | `Module.FS` undefined → `readFile` crash | FS-bypass via wasm_take_user_snapshot HEAP-pointer |
| v0.0.14 | IK+ | Stale size-gate 488 bytes vs werkelijke 35136 | Caller-update naar MAX_FILE_SIZE |
| v0.0.15 | Populous | Geen scherm-output: render-loop miste wasm_execute() | execute() vóór drawOneFrame() |
| v0.0.16 | Stunt Car Racer | (A) canvas height=0px race + (B) HPIXELS=912 stride mismatch + scrambled output | viewport-capture via js_set_display + stride-correcte read + putImageData crop + lazy fitToContainer |

Alle 6 zijn JS↔Core-binding bugs (Geel). v0.0.16 is bijzonder omdat de v0.0.12-fix (js_set_display stub) een v0.0.16-bug **introduceerde** — protocol-breaking stub-keuze.

## Commits in deze sessie

1. `AmigaHorse_Web`: wasm-bridge.js (echte js_set_display) + canvas-renderer.js (rewrite) + VERSION + CHANGELOG + dit sessie-MD
2. `Meta_AmigaHorse`: codename-pool update (Stunt Car Racer toegewezen)

## Niet aangeraakt

- `src/basic/quick-launch.js`: blijft als-is; `fitToContainer(800)`-aanroep is nu safe (lazy)
- `external/vamigaweb/`: read-only submodule, alleen geraadpleegd
