# CLAUDE.md — AmigaHorse_Web

> Web/WASM-variant van AmigaHorse. **Prio 1.** Verwijst naar `Meta_AmigaHorse/CLAUDE.md` voor codenaam-pool + per-file-license-review en naar `Meta_Master/CLAUDE.md` voor globale regels.

## Rol van deze repo

WebAssembly-build van AmigaHorse_Core + browser-UI + IndexedDB-storage. Geen backend, geen install.

## Codenaam

v0.0.1 = **Turrican**. Volgende codenamen via pool in `Meta_AmigaHorse/CLAUDE.md` — niet hier dupliceren.

## Feature & Bugfix Protocol (Color-Coded)

**Nieuwe Feature:**
- **Groen** — UI-tweak, geen WASM-rebuild → +0.0.1
- **Oranje** — Nieuwe export uit Core / nieuwe IndexedDB-store → +0.1.0
- **Rood** — Architectuurwijziging (vAmigaWeb ↔ eigen-Emscripten switch, save-state-formaat-bump) → +1.0.0

**Bugfix:**
- **Groen** — UI/CSS, runtime-config
- **Geel** — JS ↔ WASM binding-bug, save-state-corruptie binnen een sessie
- **Rood** — Cycle-accuracy-regressie, save-state-formaat-corruptie cross-version

**Root Cause Analysis (verplicht bij elke bugfix):** Functioneel / Technisch / Architectonisch.

## Versioning Mandate

Elke functionele/technische wijziging → versie bumpen in `VERSION` (semver + codenaam: `0.0.1-Turrican`). Geen build zonder bump.

## WhatIf Protocol

Zie `Meta_Master/CLAUDE.md`. Hier specifiek: wijziging in Core-WASM-exports raakt JS-binding-laag; vóór elke Core-submodule-bump impact op `src/wasm-bridge.js` benoemen.

## Build (vanaf v0.0.2)

```bash
# Voorzien (nog niet geïmplementeerd):
# emcc -O3 -sUSE_PTHREADS -sINITIAL_MEMORY=256MB ...
# Output: dist/amigahorse.wasm + dist/amigahorse.js
```

## Testen

- Lokaal: `npx serve dist/` (vereist HTTPS voor AudioWorklet/SharedArrayBuffer headers in v0.x)
- Compat-set v0.0.2: Turrican (Factor 5), Lemmings (DMA Design), Shadow of the Beast (Psygnosis) — alle drie op AROS-Kickstart waar mogelijk; documenteren welke werken vs welke 1.3-Kickstart vereisen.

## ROM-handling

User-Kickstart upload via File-API → IndexedDB `amigahorse-kickstart` store. Eerste-boot-flow:
1. Check `amigahorse-kickstart` → leeg → AROS-mode actief (banner tonen)
2. Optie "Upload eigen Kickstart" → File-API → SHA-256 → opslaan met label (`kick13.rom`, `kick205.rom`, `kick31.rom`)
3. Per game/disk kunnen kiezen welke Kickstart te gebruiken

## Sessie-MD's

`prompts/YYYY-MM-DD_<slug>.md` met frontmatter (`date`, `repo`, `status`, `resume`).
