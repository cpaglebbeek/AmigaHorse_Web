# Changelog — AmigaHorse_Web

Format: [Keep a Changelog](https://keepachangelog.com/). Codenamen uit pool `Meta_AmigaHorse/CLAUDE.md`.

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
