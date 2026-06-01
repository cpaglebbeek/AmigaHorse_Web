---
date: 2026-06-01
repo: AmigaHorse_Web
version: 0.0.18-XenonII
status: open
resume: "verder met AmigaHorse_Web v0.0.18-XenonII — hard-refresh + bake (of bestaande snapshot) + Quick BASIC dropzone: canvas moet visueel hoger/breder zijn (PAL fat pixels 2x), muis moet vloeiend volgen (delta-coords) en links-klik / rechts-klik moet werken op Workbench-icons / depth-gadgets."
---

# AmigaHorse_Web v0.0.18-XenonII — muis REL-protocol + button-IDs + PAL aspect

**Sessie:** Vervolg op v0.0.17-LotusEspritTurbo. User: "ziet er beter uit maar scherm te smal en muis niet goed te besturen"
**Classificatie:** Geel bugfix (drie JS↔Core protocol-bugs in input + display).
**Bug-trail:** 8e ontdekking in dezelfde debug-sessie (v0.0.11-18).

## Drie bugs in één fix

### Bug 1 — Muis-coords: REL niet ABS

`main.cpp:1944-1954`:
```cpp
extern "C" void wasm_mouse(int port, int x, int y) {
  wrapper->emu->put(Cmd::MOUSE_MOVE_REL, CoordCmd(port-1, x, y));
}
```

`MOUSE_MOVE_REL` = delta (dx, dy), niet absolute coordinates. Onze v0.0.6
implementatie:
```js
_handleMove(e) {
  const { x, y } = this._toCanvasCoords(e);
  this.bindings.mouse(PORT_MOUSE, x, y);   // ← x, y zijn ABSOLUTE
}
```

→ Elke `mousemove` vertelt vAmiga: "verplaats muis met x pixels rechts, y pixels
omlaag". Bij muis op (200, 150): vAmiga interpreteert dit als delta van +200/+150
**van huidige positie** → totale waanzin.

### Bug 2 — Button-IDs verkeerd

`main.cpp:1956-1968`:
```cpp
if (button_id == 1) → LEFT
if (button_id == 2) → MIDDLE
if (button_id == 3) → RIGHT
```

Onze v0.0.6:
```js
const BTN_LEFT = 0;
const BTN_RIGHT = 1;
```

→ Links-klik (id=0) wordt niet herkend door vAmiga. Rechts-klik (id=1) =
vAmiga LEFT. Geen middle-support.

### Bug 3 — Aspect-ratio: PAL fat pixels

Amiga PAL framebuffer = HPIXELS × VPIXELS = 912 × 313. Visueel display is
NIET vierkant: pixels zijn ~2× zo hoog als breed (Amiga "fat pixels" door
half-interlace-frame).

vAmigaWeb's eigen `scaleVMCanvas()` (`js/vAmiga_canvas.js:62-100`):
```js
var src_width  = clipped_width;
var src_height = clipped_height * 2;       // ← 2× height voor visueel correct
var src_ratio  = src_width / src_height;
src_ratio *= 1.03;                          // ← 3% wider voor PAL pixel-aspect
```

Onze v0.0.16 `_applyCanvasCss`:
```js
const ratio = clippedH / (clippedW || 1);  // ← geen × 2!
```

→ Canvas-aspect-ratio te plat → ziet eruit als "te smal" of "te kort".
Voor PAL hi-res (392 × 248): correcte ratio = 248×2×1.03/392 = 1.30.
Onze (verkeerd): 248/392 = 0.63 — bijna 50% te plat.

## Fix v0.0.18

### `src/lib/mouse-input.js` — Bugs 1 + 2

Button-constanten:
```js
const BTN_LEFT = 1;      // was 0
const BTN_MIDDLE = 2;    // nieuw
const BTN_RIGHT = 3;     // was 1
```

Move-handler met delta:
```js
_handleMove(e) {
  const { x, y } = this._toCanvasCoords(e);
  if (this.lastX === null) {
    this.lastX = x; this.lastY = y; return;
  }
  const dx = x - this.lastX;
  const dy = y - this.lastY;
  this.lastX = x; this.lastY = y;
  if (dx !== 0 || dy !== 0) {
    this.bindings.mouse(PORT_MOUSE, dx, dy);
  }
}
```

Plus `mouseenter`/`mouseleave` listeners voor delta-reset (geen sprong bij
re-entry). Button-handler ondersteunt nu ook middle (e.button === 1).

Scripted helpers (`scriptedClick`, `scriptedDoubleClick`) gebruiken nieuwe
`moveToAbsolute()`:
```js
async function moveToAbsolute(bindings, x, y, sleepFn, delayMs) {
  bindings.mouse(PORT_MOUSE, -9999, -9999);  // park top-left
  await sleepFn(delayMs);
  bindings.mouse(PORT_MOUSE, x, y);           // delta van (0,0) = target
}
```

vAmiga clamps op viewport-bounds → -9999/-9999 = (0,0). Daarna delta = target
land op (target_x, target_y).

### `src/lib/canvas-renderer.js` — Bug 3

```js
_applyCanvasCss(clippedW, clippedH) {
  const PAL_ASPECT_BOOST = 1.03;
  const effectiveH = clippedH * 2 * PAL_ASPECT_BOOST;
  const ratio = effectiveH / (clippedW || 1);
  const w = Math.min(this.containerMaxWidth, window.innerWidth - 32);
  const h = Math.round(w * ratio);
  this.canvas.style.width = `${w}px`;
  this.canvas.style.height = `${h}px`;
  this.canvas.style.imageRendering = 'pixelated';
}
```

Resultaat: 800px-brede canvas wordt nu ~1040px hoog (was ~506px). Visueel
Amiga-aspect correct.

## Verified (statisch)

- ✓ `node --check src/lib/mouse-input.js` + `src/lib/canvas-renderer.js`
- ✓ `wasm_mouse` body main.cpp:1944-1954 → `MOUSE_MOVE_REL` bevestigd
- ✓ `wasm_mouse_button` body main.cpp:1956-1968 → button_id ∈ {1,2,3} bevestigd
- ✓ `scaleVMCanvas` formule js/vAmiga_canvas.js:62-100 → src_height = clipped_height*2, src_ratio*=1.03
- ✓ Live bundle `dist/chunk-WAG2AZ5Y.js`: `BTN_LEFT = 1`, `PAL_ASPECT_BOOST`, `moveToAbsolute` aanwezig

## Open na v0.0.18 (resume)

- User hard-refresh test:
  - Canvas duidelijk hoger/proportioneler dan v0.0.17
  - Muis volgt vloeiend (geen sprongen)
  - Links-klik werkt op Workbench-icons / AmigaBASIC-menu's
  - Rechts-klik opent Amiga Workbench-menu (depth-gadget)
- Mogelijk: muis-snelheid lijkt te traag/snel → vAmiga heeft mouse-speed-multiplier
- Touchscreen (Z-Fold): touch-events → Pointer Events API mapping
- Joystick (port 2) test
- `docs/CORE_API_CONTRACT.md` (v0.0.19+) — input-protocol formaal

## Bug-trail summary (v0.0.10 → v0.0.18, één debug-sessie)

| Versie | Codenaam | Bug | Fix |
|---|---|---|---|
| v0.0.11 | Alien Breed | ROM-flash filename extension | `.rom` → `.rom_file` |
| v0.0.12 | Project-X | EM_ASM-callback missing | js_set_display + scaleVMCanvas stubs |
| v0.0.13 | Super Frog | Module.FS undefined | FS-bypass via take_user_snapshot |
| v0.0.14 | IK+ | Stale size-gate | MAX_FILE_SIZE 488 → 35136 |
| v0.0.15 | Populous | Frame-step ontbrak | execute() vóór drawOneFrame() |
| v0.0.16 | Stunt Car Racer | HPIXELS-stride + height=0px race | viewport-capture + stride-read + lazy CSS |
| v0.0.17 | Lotus Esprit Turbo | Bake-snapshot Kickstart-only | hardReset() na disk-mount |
| v0.0.18 | Xenon 2 Megablast | (1) REL coords + (2) button-IDs + (3) PAL aspect | track lastX/Y, BTN 1/2/3, ×2×1.03 |

8 versies in één debug-sessie. Allemaal JS↔Core binding-bugs (Geel). v0.0.18
maakt v0.0.12 zelf-corrigerend (stub nu echte capture in v0.0.16, plus nu ook
juiste input-protocol).

## Commits in deze sessie

1. `AmigaHorse_Web`: mouse-input.js (REL+IDs+scripted helpers) + canvas-renderer.js (aspect) + VERSION + CHANGELOG + sessie-MD
2. `Meta_AmigaHorse`: codename-pool (Xenon 2 Megablast toegewezen)

## Niet aangeraakt

- `setup.js` — v0.0.17 reset-flow blijft
- `quick-launch.js` — geen wijzigingen
- `wasm-bridge.js` — viewport-capture (v0.0.16) blijft; mouseButton/mouse cwrap-bindings ongewijzigd
