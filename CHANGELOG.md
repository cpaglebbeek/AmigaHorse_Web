# Changelog — AmigaHorse_Web

Format: [Keep a Changelog](https://keepachangelog.com/). Codenamen uit pool `Meta_AmigaHorse/CLAUDE.md`.

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
