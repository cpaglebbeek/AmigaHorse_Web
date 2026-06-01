---
date: 2026-06-01
repo: AmigaHorse_Web
version: 0.0.15-Populous
status: open
resume: "verder met AmigaHorse_Web v0.0.15-Populous — hard-refresh + Quick BASIC drop test: canvas moet nu BEWEGEN (was leeg/bevroren door missing wasm_execute() in renderer-loop)"
---

# AmigaHorse_Web v0.0.15-Populous — render-loop miste wasm_execute()

**Sessie:** Vervolg op v0.0.14-IKPlus. User: "sample .bas werkt. nog geen scherm output?"
**Classificatie:** Geel bugfix (frame-step contract met Core ontbrak).

## Root cause

vAmigaWeb's eigen JS-laag in `external/vamigaweb/js/vAmiga_ui.js:1943-1994`:
```js
function do_animation_frame() {
  if (!is_worker_built) {
    Module._wasm_execute();              // ← 1. CPU stepping
  } else {
    Module._wasm_worker_run();
    let current_rendered_frame_id = Module._wasm_frame_info();
  }
  let behind = Module._wasm_draw_one_frame(now);  // ← 2. framebuffer
  requestAnimationFrame(do_animation_frame);
}
```

`wasm_execute()` op main.cpp:392:
```cpp
extern "C" void wasm_execute() {
  emu->emu->computeFrame();  // ← DIT is de CPU/chipset/disk-IO step
  executed_since_last_host_frame++;
  ...
}
```

`wasm_draw_one_frame(now)` op main.cpp:402 doet WEL `emu->emu->update()` maar **geen computeFrame** in de normale path — die zit alleen in de warping-fallback (`emu->emu->computeFrame()` in lijn 432).

## Onze fout

`src/lib/canvas-renderer.js:_tick()` (sub-step 6):
```js
this.bindings.drawOneFrame(now);  // alleen dit, GEEN execute()
```

Resultaat: emulator was correct geinitialiseerd (ROM geflashed, board powered, snapshot restored), maar **CPU stond stil**. Framebuffer = laatste bevroren state (snapshot moment) of leeg bij verse boot.

## Fix

`src/lib/canvas-renderer.js` `_tick()` body:
```js
// v0.0.15-Populous
this.bindings.execute();          // CPU computeFrame
this.bindings.drawOneFrame(now);  // framebuffer-sync
```

Cwrap-binding `execute` bestond al sinds v0.0.6 (regel 111 wasm-bridge.js: `const execute = cwrap('wasm_execute', 'void', []);`) — werd alleen nooit aangeroepen.

## Verified (statisch)

- ✓ `node --check src/lib/canvas-renderer.js`
- ✓ Live bundle `dist/chunk-KGJD65ML.js`: `this.bindings.execute(); this.bindings.drawOneFrame(now);` zichtbaar
- ✓ vAmigaWeb main.cpp:392 `wasm_execute` body bevestigd
- ✓ Volgorde execute → drawOneFrame matcht vAmigaWeb's eigen do_animation_frame

## Open na v0.0.15 (resume)

- **User Quick BASIC drop-test:** hard-refresh → drop sample.bas → canvas moet **bewegen** (Workbench-prompt of BASIC-OK-prompt zichtbaar)
- **Bake-flow visueel:** bake-canvas in setup.html zou nu ook moeten bewegen tijdens 8-sec WB-boot-wait (sub-step 4 in bake-flow)
- **Mogelijk volgend symptoom:** als canvas wel beweegt maar pixel-format scheef (R en B geswapt) → pixel-format-detect (sub-step 7) heeft mogelijk verkeerde sample-pixels → v0.0.16 met meer robuuste detectie
- **Mogelijk volgend symptoom:** audio nog steeds stil. Audio-sink (v0.0.7 ScriptProcessorNode) leest HEAPF32 via `wasm_copy_into_sound_buffer` — als die nul-buffer returneert tot CPU stept, was dat consistente fix. Nu zou audio ook moeten werken.
- **Architectonisch (v0.0.16+):** `docs/CORE_API_CONTRACT.md` — frame-loop-volgorde + cwrap+EM_ASM-contracten formaal documenteren. Voorkomt herhaling van "X-call vergeten in pipeline"-bugs (precedent: v0.0.11 filename-extension, v0.0.13 FS-bypass, v0.0.15 frame-step).

## Bug-trail summary (v0.0.10 → v0.0.15, één debug-sessie)

| Versie | Codenaam | Bug | Fix |
|---|---|---|---|
| v0.0.11 | Alien Breed | Kickstart-flash silent fail door `.rom` vs `.rom_file` extension | filename-rename + 10-stage diagnostics |
| v0.0.12 | Project-X | `ReferenceError: js_set_display is not defined` (EM_ASM-callback) | window-stubs voor js_set_display + scaleVMCanvas |
| v0.0.13 | Super Frog | `Module.FS` undefined → `readFile` crash | FS-bypass via wasm_take_user_snapshot HEAP-pointer |
| v0.0.14 | IK+ | Stale size-gate 488 bytes vs werkelijke 35136 | Caller-update naar MAX_FILE_SIZE |
| v0.0.15 | Populous | Geen scherm-output: render-loop miste wasm_execute() | execute() vóór drawOneFrame() |

Alle 5 zijn JS↔Core-binding bugs (Geel). Architecturaal patroon: vAmigaWeb's protocol-contracten zijn niet self-documenting, vereisen reverse-engineering van vAmiga_ui.js + main.cpp. Mitigatie: `docs/CORE_API_CONTRACT.md` v0.0.16+.

## Commits in deze sessie

1. `AmigaHorse_Web`: canvas-renderer.js fix + VERSION + CHANGELOG + dit sessie-MD
2. `Meta_AmigaHorse`: codename-pool update (Populous: pool → toegewezen, laatste in dat segment)

## Niet aangeraakt

- `src/wasm-bridge.js` (execute-binding bestond al)
- `Meta_Master`: clean ✓
