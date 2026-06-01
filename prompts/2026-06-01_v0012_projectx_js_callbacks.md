---
date: 2026-06-01
repo: AmigaHorse_Web
version: 0.0.12-ProjectX
status: open
resume: "verder met AmigaHorse_Web v0.0.12-ProjectX — user-bake-test in browser na js_set_display stub-fix: F12 console open, klik Bake; verwacht 10 groene stages + 1+ '[vAmiga→js] js_set_display(stub)' debug-regels, géén ReferenceError, warm-snapshot ≥1MB"
---

# AmigaHorse_Web v0.0.12-ProjectX — JS-callback stubs (js_set_display + scaleVMCanvas)

**Sessie:** Vervolg op v0.0.11-AlienBreed. User testte in browser → "bake mislukt: js_set_display is not defined".
**Classificatie:** Geel bugfix (JS↔WASM binding-bug).

## Root cause

vAmigaWeb roept via `EM_ASM` op `external/vamigaweb/main.cpp:181` en `:1473`:
```cpp
EM_ASM({js_set_display($0,$1,$2,$3); scaleVMCanvas();},
       xOff, yOff, clipped_width*TPP, clipped_height);
```

Beide globale JS-functies (`js_set_display`, `scaleVMCanvas`) staan in vAmigaWeb's eigen `external/vamigaweb/js/vAmiga_canvas.js` met dependencies op jQuery + `<canvas id="canvas">`-DOM-aanname. Wij laden dat script niet (eigen `CanvasRenderer` met rAF + pixel-buffer cwrap, zonder jQuery).

In tegenstelling tot `message_handler` (defensief gewrapt op regel 589: `if typeof === 'undefined' return`) zijn deze twee callbacks **niet** defensief in C++ — `EM_ASM` gooit `ReferenceError`.

## Waarom dit pas in v0.0.11 zichtbaar werd

v0.0.10 stond stil op stage 2 (Kickstart-flash mismatch). Met v0.0.11 wordt de ROM wel geflashed → emulator power-on → core start boot → eerste viewport-geometrie wordt berekend → `EM_ASM(js_set_display)` → undefined.

Sequence:
1. v0.0.11 stage 2: `loadFile('kick13.rom_file')` → ROM-branch → `mem.loadRom` → `powerOn` → `run`
2. Core boot → PAL/NTSC-detect of viewport-tracking → main.cpp:181 of :1473 → EM_ASM
3. `ReferenceError: js_set_display is not defined` → bubble naar onze `bakeWarmSnapshot()` catch
4. v0.0.11 diagnostics: stack-trace zichtbaar in console (✓ diagnostics-pass werkte zoals bedoeld)

## Fix

`src/wasm-bridge.js` `init()` Promise-body, vóór `<script src=vAmiga.js>` injectie:

```js
if (typeof window.js_set_display === 'undefined') {
  window.js_set_display = (xOff, yOff, w, h) => {
    console.debug('[vAmiga→js] js_set_display(stub):', { xOff, yOff, w, h });
  };
}
if (typeof window.scaleVMCanvas === 'undefined') {
  window.scaleVMCanvas = () => { /* no-op */ };
}
```

**Waarom no-op safe:**
- `js_set_display` zou xOff/yOff/width/height aan de canvas geven; ons `CanvasRenderer` (`src/lib/canvas-renderer.js`) leest `bindings.renderWidth()` / `renderHeight()` rechtstreeks uit WASM via cwrap. Geometrie-info uit deze callback is redundant.
- `scaleVMCanvas` doet DOM-sizing met jQuery + `$("#canvas")`; ons `fitToContainer()` doet hetzelfde met vanilla JS + ons eigen canvas-element ID.
- `typeof === 'undefined'`-guard zorgt dat een host-page-override (toekomstig: echte handler) niet wordt overschreven.

## Verified (statisch)

- ✓ `node --check src/wasm-bridge.js` impliciet via esbuild rebuild
- ✓ Live `chunk-4SFFG4OR.js` bevat stubs (3 hits voor `js_set_display`)
- ✓ `grep js_set_display external/vamigaweb/main.cpp` toont **alleen** regel 181 + 1473 — geen andere call-sites te verwachten
- ✓ Andere EM_ASM-callbacks geïnventariseerd; de rest is óf defensief-gewrapt óf globale variabele óf jQuery (komt later — `$("#host_fps")` op regel 2301 alleen bij FPS-display, niet bake-kritiek)
- ✗ Browser-test = user-resume-trigger

## Open na v0.0.12 (resume)

- **User bake-test:** F12 → Console → klik Bake. Verwacht: 10 stages + 1+ regel `[vAmiga→js] js_set_display(stub): {...}` zonder rode error.
- **Mogelijk nieuwe symptoom:** als jQuery-call `$("#host_fps").html(...)` (main.cpp:2301) wordt geraakt → "$ is not defined" → fix in v0.0.13 met nog een stub (`window.$ = () => ({ html: () => {} })` minimal). Niet pre-emptief omdat de FPS-overlay alleen periodiek triggert.
- **Architectonisch (v0.0.13+):** `docs/CORE_API_CONTRACT.md` met 2-richtings-inventaris (cwrap-exports + EM_ASM-callbacks).

## Commits in deze sessie

1. `AmigaHorse_Web`: wasm-bridge.js stubs + VERSION + CHANGELOG + dit sessie-MD
2. `Meta_AmigaHorse`: codename-pool update (Project-X: pool → toegewezen)

## Niet aangeraakt

- `Meta_Master`: clean ✓ (parallelle QBE-sessie eerder gepushed)
