# Changelog — AmigaHorse_Web

Format: [Keep a Changelog](https://keepachangelog.com/). Codenamen uit pool `Meta_AmigaHorse/CLAUDE.md`.

## [0.0.4-Speedball2] — 2026-05-31 (v0.0.2.x sub-step 4: cwrap-bindings + ADF-builder + dev-pipeline)

> Concrete JS-wiring naar vAmiga-WASM + pure-JS OFS-ADF-builder voor BASIC-injection + esbuild dev-server. Géén live-test yet (sub-step 5).
> Codenaam **Speedball 2** (Bitmap Brothers 1990, action-sports — fitting infrastructuur-acceleratie).
> Kleur **Groen +0.0.1** (JS-wiring zonder architectuurwijziging; Oranje +0.1.0 spaar ik voor sub-step 5 wanneer warm-snapshot daadwerkelijk werkt).

### Added
- **`src/wasm-bridge.js` herschreven** met concrete bindings:
  - `init()` Promise-based, idempotent, classic-script-load met `Module.onRuntimeInitialized`-callback
  - `bindFunctions()` → 8 cwrap-bindings: `run`, `halt`, `reset`, `powerOn`, `configure`, `key`, `scheduleKey`, `loadFile`
  - `loadFile(name, buf, drive)` met handmatige `_malloc` + `HEAPU8.set` + `_free` voor u8*-passing
  - `saveStateToBuffer()` / `restoreStateFromBuffer(buf)` — wrappers rond `wasm_save_workspace` + Emscripten-FS-pad
  - IndexedDB-helpers (`storeAsset`, `loadAsset`, `hasWarmSnapshot`) — Promise-vorm
- **`src/lib/build-blank-adf.js` nieuw** — pure-JS OFS-ADF-builder voor BASIC-injection:
  - `buildAdfWithBasFile(basContent, fileName, volumeLabel)` → 901120-byte ADF Uint8Array
  - Boot block + Root block (sec 880) + Bitmap (sec 881) + File-header (sec 882) + Data-block (sec 883)
  - Correcte OFS-checksums (sum mod 2^32, negated)
  - Amiga-string-encoding (length-prefix BCPL-stijl) + amigaHash voor dir-hash-tabel
  - Limiet v0.0.4: 488 bytes (1 OFS data-block) — voldoende voor HELLO WORLD
- **`esbuild.config.mjs` herschreven** met dev-server modus:
  - `npm run dev` → context.serve op :8000 + watch op src/
  - `npm run build` → één-shot productie-bundle (minified)
  - HTML-routes worden ge-copy-ed bij elk run; vendor/vamigaweb/ check + warning bij ontbreken
  - 5 entry-points (wasm-bridge, build-blank-adf, quick-launch, setup, library)
- **`package.json` scripts** bijgewerkt:
  - `dev` / `build` → `node esbuild.config.mjs [--dev]`
  - `build:all` → `build:wasm + build` (one-shot full pipeline)
- **Smoke-test-knop op `/basic/`** — drukt `init()` af en toont aantal beschikbare cwrap-bindings. Bewijs van leven vóór sub-step 5 live test.
- **`src/basic/quick-launch.js`** gebruikt nu echte API: `init`, `getBindings`, `hasWarmSnapshot`, `buildAdfWithBasFile`. Toont ADF-byte-count bij `.bas`-drop (sub-step 5 voegt restore + loadFile + scheduleKey toe).

### Decided
- Loading-strategie: **classic Emscripten Module + onRuntimeInitialized-callback** (geen `-sMODULARIZE` switch in CMakeLists). Werkt direct met onze pinned vAmigaWeb-commit.
- ADF-builder is bewust apart van vAmigaWeb-vendor-code (P-AMH-09: BASIC als first-class use-case; eigen JS-tool).
- Multi-block file-support (>488 bytes) uitgesteld naar v0.0.5 — eerst end-to-end bewijzen met klein bestandje.
- COOP+COEP-headers in dev-server **nog niet geactiveerd** (esbuild's serve-API biedt geen direct headers-API; sub-step 5 voegt eigen middleware-laag toe als nodig — voor nonworker-mode niet kritiek).

### Verified
- `node --check` op alle JS-files passt: wasm-bridge, build-blank-adf, quick-launch, setup, library, esbuild.config.mjs
- ADF-builder structuur volgens Laurent Clévy's ADF-spec + Aminet ADFLib refs: SECTOR_SIZE=512, SECTORS=1760, ROOT_BLOCK=880, OFS data-payload=488 bytes/block

### Not yet (sub-step 5)
- Live test van smoke-test in browser (vereist `npm install` + `npm run dev`)
- Volledige BASIC-flow end-to-end met user-supplied KS 1.3 + WB 1.3 + AmigaBASIC binary
- Warm-snapshot-bake-flow in `src/basic/setup.js` (vereist sequenced boot + AmigaBASIC-launch)
- AmigaKeyboard rawkey-codes mapping (`src/lib/amiga-keymap.js`) voor scheduleKey
- Multi-block ADF-builder voor files >488 bytes
- COOP+COEP-headers in dev-server (alleen als worker-mode in v0.x)

## [0.0.3-Flashback] — 2026-05-31 (v0.0.2.x sub-step 3: WASM-build werkt, eerste artefact)

> Eerste echte WASM-build → "Geen build zonder bump" → VERSION-bump 0.0.2-CannonFodder → 0.0.3-Flashback.
> Codenaam: **Flashback** (Delphine Software 1992, rotoscope-action — "flash"compile + retro-doorbraak).
> Kleur: **Groen +0.0.1** (pipeline-uitvoer van eerder genomen v0.0.2-besluit; geen nieuwe architectuur).

### Added
- **vAmigaWeb WASM-build werkend** via `tools/build-wasm.sh`
  - `dist/vendor/vamigaweb/vAmiga.js`   (106 KB Emscripten glue)
  - `dist/vendor/vamigaweb/vAmiga.wasm` (8.77 MB Amiga-emulator binary)
- `tools/build-wasm.sh`: idempotente pipeline (emsdk source + cmake configure + cmake build + copy naar dist/)
- `package.json` `build:wasm` script wijst nu naar werkende pipeline (`bash tools/build-wasm.sh`)
- `.gitignore` uitgebreid met vAmigaWeb-build-uitvoer-artefacten in submodule (`vAmiga.html/js/wasm`, `sw.js`)

### Changed
- `src/wasm-bridge.js`: stubs nu gelabeld met concrete export-naam uit CMakeLists EXPORTED_FUNCTIONS (`_wasm_loadFile`, `_wasm_save_workspace`, `_wasm_load_workspace`, `_wasm_auto_type`, `_wasm_joystick`). Echte `cwrap`-binding komt in sub-step 4.
- `src/wasm-bridge.js`: `crossOriginIsolated` is geen hard-requirement meer (nonworker-build vereist géén SharedArrayBuffer); check verplaatst naar enkel-bij-worker-mode

### Verified
- emcc 5.0.7 + cmake 4.3.3 + C++20: vAmigaWeb compileert clean op macOS arm64 (Darwin 25.3.0)
- Build-tijd warm-cache: ~1 minuut; cold-cache (eerste sysroot-libs): ~3-4 min
- Build-dir: 92 MB (incl. intermediates; alleen 8.87 MB output-artefacten relevant voor runtime)
- Géén `_wasm_mountDH` of vergelijkbare hostfs-export → bevestigt fallback-strategie sub-step 4: on-the-fly ADF-rebuild bij `.bas`-injection

### Decided (concretisering sub-step 4)
- vAmigaWeb gebruikt `_wasm_loadFile` voor disk/cart-import (ondersteunt ADF, ROM, etc.). BASIC-mode-flow: bouw on-the-fly leeg ADF met FFS-volume `BAS`, schrijf `launch.bas` erin, geef aan `_wasm_loadFile` met df-target. Geen native hostfs-koppeling nodig.
- vAmigaWeb-thread-mode = **nonworker** (default). Geen COOP+COEP-headers verplicht voor v0.0.3. Voordeel: deploy-vriendelijk (icthorse.nl static-hosting werkt zonder header-tweaks). Switch naar worker-mode = v0.x feature-keuze.

### Not yet (v0.0.2.x sub-steps 4-5)
- Sub-step 4: dynamic import van `dist/vendor/vamigaweb/vAmiga.js` + Module()-instantiation + cwrap-bindings voor de ~10 essentiele functies
- Sub-step 5: warm-snapshot-bake (via `_wasm_save_workspace`) + ADF-rebuild voor `.bas`-injection + e2e HELLO WORLD-test

## [0.0.2.2] — 2026-05-31 (v0.0.2.x sub-step 2: Emscripten install)

### Added
- **Emscripten SDK 5.0.7** geïnstalleerd op `~/Documents/Gemini_Projects/emsdk` (1.8 GB, buiten alle git-repos)
  - Bundled node 22.16.0 + python 3.13.3 + wasm-binaries commit `6cd98e86d`
  - `emcc --version` geverifieerd werkend
- `tools/emscripten-env.sh` — sourceable helper-wrapper voor on-demand emsdk-PATH in build-shell (géén `.zshrc`-aanpassing; emsdk-env-vars alleen in huidige shell sessie)
  - Versie-pin gedocumenteerd in script-header (5.0.7 + commit-hash + bundled tool-versies)
  - Update-protocol in commentaar (bij emsdk-bump: pin updaten + vAmigaWeb-rebuild)

### Decided
- Pin op **emsdk 5.0.7** voor v0.0.2.2 — bij elke bump bewust cross-emcc-versie-regressies checken (vAmigaWeb-build draait dan opnieuw)
- Géén shell-rc-modificatie (P-AGT: scope-bewuste sessie-isolatie); source on-demand

### Not yet (v0.0.2.x sub-steps 3-5)
- WASM-build van `external/vamigaweb/Core/` via `source tools/emscripten-env.sh && cd external/vamigaweb && cmake -B build && cmake --build build` (sub-step 3)
- `vAmiga.mountDH`-API verifieren in vAmigaWeb-sources (sub-step 4)
- Warm-snapshot-bake live test + end-to-end `HELLO WORLD.bas` (sub-step 5)

## [0.0.2.1] — 2026-05-31 (v0.0.2.x sub-step 1: submodule add)

### Added
- **`external/vamigaweb`** als git-submodule, pinned commit `c3c50d9` (vAmigaWeb v4-merge 2026-05-28, GPL-3.0)
- `.gitmodules` toegevoegd

### Fixed
- URL-correctie: `dirkwhoffmann/vAmigaWeb` → `vAmigaWeb/vAmigaWeb` in 7 docs/code-bestanden (foute aanname v0.0.2; werkelijke owner is org `vAmigaWeb`, niet user `dirkwhoffmann`)

### Changed
- `external/README.md` aangepast (URL + pinning op commit i.p.v. release-tag; vAmigaWeb heeft géén releases)
- `Meta_AmigaHorse/docs/DEPENDENCIES.md` vAmigaWeb-licentie van "GPL-3.0 (TBC)" → "GPL-3.0 (geverifieerd 31-05)"; vAmiga 3-tier sub-licentie toegevoegd

### Verified
- vAmigaWeb LICENSE = **GPL-3.0** (header `GNU GENERAL PUBLIC LICENSE Version 3`)
- vAmiga (in `Core/`) = 3-tier: GPL-3.0+ app / MPL-2.0 Core Emulator / MIT Moira-CPU — alle AGPL-3.0-compat
- vAmigaWeb heeft **géén git-submodules** (vAmiga vendored in `Core/`-directory); géén transitive risk
- Lokale clone: 15 MB inclusief `.git/`

### Added (P-AMH-07 baseline)
- `Meta_AmigaHorse/docs/UPSTREAM_AUDIT.md` aangemaakt met baseline-entry voor vAmigaWeb (subcomponent-tabel + risico's + roadmap)

### Not yet (v0.0.2.x sub-steps 2-5)
- Emscripten installeren (~/Documents/Gemini_Projects/emsdk)
- WASM-build draaien (`emcc` op `external/vamigaweb/Core/`)
- `vAmiga.mountDH`-API verifieren in vAmigaWeb-sources
- Warm-snapshot-bake live testen met user-supplied assets
- End-to-end test met `HELLO WORLD.bas`

## [0.0.2-CannonFodder] — 2026-05-31

### Added (Oranje — nieuwe Core-binding + nieuwe route + nieuwe IndexedDB-stores)
- **Quick BASIC mode** (`/`) — drag-drop `.bas` → warm-snapshot restore → hostfs-inject → simulated `LOAD/RUN` → ~1-2 sec running (P-AMH-09)
- **Full configurable mode** (`/full`) — library + settings + player-skelet
- **Asset-Setup-wizard** (`/basic/setup`) — 3 file-pickers (KS 1.3 + WB 1.3 ADF + AmigaBASIC binary) → IndexedDB → one-time warm-snapshot bake
- **vAmigaWeb als Core-basis besloten** (in plaats van eigen FS-UAE/WinUAE Emscripten-port); zie `external/README.md` voor submodule-instructie
- `src/` scaffold: `index.html` router-landing, `wasm-bridge.js` (vAmiga-WASM wrapper stub), `basic/` + `full/` routes, esbuild-pipeline
- `docs/BASIC_MODE.md` — flow + AmigaBASIC-historie + bekende KS-2.0+-incompatibility + asset-bundle-vereisten
- `DESIGN_TOKENS.md` — Amiga-stijl (Topaz font, Workbench-grijs/blauw, breakpoints)
- `package.json` + `esbuild.config.mjs` (vanilla JS + esbuild, geen React)
- IndexedDB-stores definitief: `amigahorse-kickstart` / `amigahorse-disks` / `amigahorse-states` / `amigahorse-config` (zie ARCHITECTURE)

### Decided (op WhatIf v0.0.2-akkoord)
- BASIC-scope = AmigaBASIC only v0.0.2 (AMOS/HiSoft v0.0.3+)
- Auto-RUN default + toggle "stop in BASIC-prompt"
- File-injection via hostfs (vAmiga `mountDH` ↔ Emscripten MEMFS)
- 3 file-pickers in setup-wizard; bundle-zip v0.0.3
- Twee routes (deelbare URLs)
- Warm-snapshot one-time + cache
- Core-keuze coherentie met X86/Android heroverwegen v0.0.3

### Not yet
- vAmigaWeb submodule nog niet toegevoegd in repo (planned next commit / v0.0.2.1; instructie in `external/README.md`)
- Géén actual WASM-build (vereist eerst submodule + Emscripten-install)
- Géén compat-set bewijs (Turrican/Lemmings/ShadowOfTheBeast) — v0.0.3

## [0.0.1-Turrican] — 2026-05-31

### Added
- Eerste skeleton via `newp "AmigaHorse"` — Web-variant gemarkeerd als **prio 1** door gebruiker
- README.md met scope (browser-only, geen backend, AROS-fallback)
- CLAUDE.md met build-skelet + ROM-handling-flow + color-coded protocol
- ARCHITECTURE.md met JS ↔ WASM ↔ IndexedDB diagram + browser-compat-matrix
- LICENSE AGPL-3.0
- VERSION + CHANGELOG + .gitignore

### Not yet
- Geen WASM-build, geen Emscripten-config, geen src/ code
- Geen package.json (UI-framework-keuze in v0.0.2)
- Géén Kickstart bundled (AROS-bundling komt in v0.0.2)
