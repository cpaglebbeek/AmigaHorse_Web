---
date: 2026-06-01
repo: AmigaHorse_Web
version: 0.0.17-LotusEspritTurbo
status: open
resume: "verder met AmigaHorse_Web v0.0.17-LotusEspritTurbo — re-bake en kijk of bake-canvas Workbench daadwerkelijk boot (disk-twirl → grijs WB1.3-scherm → AmigaBASIC). Snapshot moet nu AmigaBASIC-prompt-state bevatten i.p.v. Kickstart-insert-disk. Quick BASIC drop sample.bas erna moet echte BASIC-output tonen."
---

# AmigaHorse_Web v0.0.17-LotusEspritTurbo — bake mist hard-reset na disk-mount

**Sessie:** Vervolg op v0.0.16-StuntCarRacer. User: "scherm is kixstart logo. hij laad daarna geen amiga basic?"
**Classificatie:** Geel bugfix (bake-flow timing/protocol-volgorde, JS↔Core).
**Bug-trail:** 7e ontdekking in dezelfde debug-sessie (v0.0.11-17).

## Visuele bewijslast

| Tijd | Versie | Beeld op canvas | Wat het toonde |
|---|---|---|---|
| 11:01 | v0.0.16 1e drop | Striped patroon (scrambled) | Bug B (HPIXELS-stride) zichtbaar tijdens boot-noise |
| 11:14 | v0.0.16 2e drop | Kickstart insert-disk (gescrambled) | Snapshot-restore = Kickstart-prompt |
| 12:19 | v0.0.16 re-bake | Kickstart insert-disk (crisp) | Renderer-fix bevestigd; ECHT inhoud is K1.3-prompt |

Conclusie na 12:19: v0.0.16 renderer-fix valide, maar warm-snapshot bevat verkeerde state.

## Root cause

`setup.js` bake-volgorde:

```js
// Stage 2: loadFile('kick13.rom_file', kickBuf, 0xFF)
//   → main.cpp:1812-1813: ROM-branch doet auto powerOn(1) + run() ← !
// Stage 3: powerOn(1)
//   → ensure-on no-op
// Stage 4: loadFile('wb13.adf', wbBuf, 0)
//   → disk-branch: mounts WB1.3 in DF0:
// (Stage 5-6: renderer start, run() no-op)
// await sleep(8000)
```

Tussen stage 2 en stage 4: Amiga is reeds **powered on en running**. Kickstart 1.3 vindt geen disk in DF0 → toont "insert Workbench disk"-prompt. Daarna komt stage 4 met disk-mount, maar Kickstart 1.3:
- Detecteert **niet dynamisch** disk-insert events na initial boot
- Blijft hangen op insert-prompt totdat reset of disk-eject/insert-cycle

Bake-snapshot wordt 8 sec later genomen → bevat Kickstart-prompt-state met disk wel in DF0 maar Kickstart toont nog steeds insert-prompt. Snapshot is geldig maar useless.

## Fix v0.0.17

`src/basic/setup.js` — nieuwe stage tussen 4 en 5:

```js
// v0.0.17-LotusEspritTurbo — hard-reset zodat Kickstart DF0 opnieuw scant.
setStepStatus('step-4', 'Hard-reset zodat Kickstart DF0 opnieuw scant...');
stage('4b.reset (re-scan DF0)', () => bindings.reset());
await sleep(500);
```

Plus: sleep 8 → 12 sec (WB1.3 boot van 880KB OFS ADF duurt typisch 8-15 sec in emulator).
Plus: validatie op wbResult (warn als non-empty).

`bindings.reset()` is gebonden aan `wasm_reset` (cwrap, wasm-bridge.js:124) → main.cpp:1900-1903 → `hardReset()`. Full reset, alle drives behouden hun ingevoegde disks → re-boot pakt DF0 = WB1.3 → boot animatie → Workbench grey screen.

## Verified (statisch)

- ✓ `node --check src/basic/setup.js`
- ✓ `wasm_reset` = `hardReset()` bevestigd in main.cpp:1900-1903
- ✓ Reset-cwrap bestaat al sinds v0.0.6 (wasm-bridge.js:124)
- ✓ Volgorde-fix matcht vAmigaWeb's eigen demo-flow (disk laden → reset → wait boot)

## Open na v0.0.17 (resume)

- **User re-bake test:**
  - bake-canvas moet eerst Kickstart insert-disk tonen (kort, vóór reset)
  - daarna reset-flicker (kort zwart of geel screen)
  - daarna disk-twirl (~3 sec)
  - daarna grijs WB 1.3 met menu bar
  - daarna `AmigaBASIC<RET>` typing → AmigaBASIC-window open
  - snapshot genomen op dat moment ✓
- **Quick BASIC drop na re-bake:** sample.bas moet écht BASIC-output tonen
- **Mogelijk volgend:** 12 sec nog te kort → verleng naar 15 sec
- **Mogelijk volgend:** `AmigaBASIC<RET>` typing werkt alleen vanuit Shell, niet vanuit Workbench-icon-mode → muis-double-click op icon is fallback
- **Audio:** zou nu ook moeten werken (CPU stept correct + valide snapshot)
- **Architectonisch (v0.0.18+):** `docs/CORE_API_CONTRACT.md` — bake-flow protocol documenteren:
  - ROM-branch doet auto powerOn+run (niet uitschakelbaar)
  - Disk-mount na ROM-flash vereist hardReset() voor Kickstart-boot
  - Timing-grenzen: WB boot 8-15 sec, AmigaBASIC start 1-3 sec

## Bug-trail summary (v0.0.10 → v0.0.17, één debug-sessie)

| Versie | Codenaam | Bug | Fix |
|---|---|---|---|
| v0.0.11 | Alien Breed | Kickstart-flash silent fail door `.rom` vs `.rom_file` extension | filename-rename + 10-stage diagnostics |
| v0.0.12 | Project-X | `ReferenceError: js_set_display` (EM_ASM-callback) | window-stubs (later v0.0.16 vervangen) |
| v0.0.13 | Super Frog | `Module.FS` undefined → readFile crash | FS-bypass via wasm_take_user_snapshot HEAP-pointer |
| v0.0.14 | IK+ | Stale size-gate 488 bytes vs werkelijke 35136 | Caller-update naar MAX_FILE_SIZE |
| v0.0.15 | Populous | Geen scherm-output: render-loop miste wasm_execute() | execute() vóór drawOneFrame() |
| v0.0.16 | Stunt Car Racer | (A) canvas height=0px race + (B) HPIXELS=912 stride mismatch | viewport-capture + stride-correcte read + lazy fitToContainer |
| v0.0.17 | Lotus Esprit Turbo | Bake-snapshot bevatte Kickstart-prompt: disk in DF0 ná powerOn → K1.3 detecteert niet dynamisch | hardReset() na disk-mount + 12 sec wait |

## Commits in deze sessie

1. `AmigaHorse_Web`: setup.js (reset-stage + extended sleep + validatie) + VERSION + CHANGELOG + sessie-MD
2. `Meta_AmigaHorse`: codename-pool (Lotus Esprit Turbo toegewezen)

## Niet aangeraakt

- `canvas-renderer.js` + `wasm-bridge.js` — v0.0.16 fix blijft staan
- `quick-launch.js` — als bake nu wel een geldige snapshot maakt, werkt Quick BASIC out-of-the-box
