# CLAUDE.md — AmigaHorse_Web

> Web/WASM-variant van AmigaHorse. **Prio 1.** Verwijst naar `Meta_AmigaHorse/CLAUDE.md` voor codenaam-pool + per-file-license-review en naar `Meta_Master/CLAUDE.md` voor globale regels.

## Rol van deze repo

WebAssembly-build van AmigaHorse_Core + browser-UI + IndexedDB-storage. Geen backend, geen install.

## Codenaam

v0.0.1 = **Turrican**. v0.0.2 = **Cannon Fodder**. Volgende codenamen via pool in `Meta_AmigaHorse/CLAUDE.md` — niet hier dupliceren.

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

## Build (vanaf v0.0.2.x — vereist vAmigaWeb submodule eerst)

```bash
# v0.0.2: scaffold, geen WASM-build yet
# v0.0.2.x: na 'git submodule add ... external/vamigaweb':
npm install
npm run build:wasm   # emcc-pipeline op vAmiga-fork (~5-10 min)
npm run build:web    # esbuild bundelt src/ → dist/
npm run dev          # esbuild --serve op localhost:8000 (met COOP+COEP)
```

## Testen

- Lokaal: `npm run dev` start dev-server met COOP+COEP-headers (vereist voor SharedArrayBuffer)
- **Quick BASIC** v0.0.2.x: eigen `.bas` testen (HELLO WORLD, sprite-demo, eenvoudige game)
- **Full mode** compat-set v0.0.3: Turrican (Factor 5), Lemmings (DMA Design), Shadow of the Beast (Psygnosis) — alle drie op AROS-Kickstart waar mogelijk; documenteer welke 1.3-Kickstart vereisen

## Asset-handling (P-AMH-05 strikt)

**Drie user-supplied assets** (eenmalig via `/basic/setup`-wizard):

| Asset | Bron | IndexedDB-locatie | Label |
|---|---|---|---|
| Kickstart 1.3 ROM (~256 KB) | Cloanto Amiga Forever / eigen rip | `amigahorse-kickstart` | `kick13` |
| Workbench 1.3 ADF (880 KB) | idem | `amigahorse-disks` | `wb13-master` |
| AmigaBASIC binary (~100 KB, in WB 1.3 ADF) | idem | `amigahorse-kickstart` | `amigabasic-bin` |
| AROS-fallback (v0.0.3+) | Bundled in WASM | n.v.t. | `aros-default` |

Eerste-bezoek-flow:
1. Check `amigahorse-states` voor `basic-env-snapshot`
2. Ontbreekt → redirect `/basic/setup` (3 file-pickers + warm-snapshot-bake)
3. Aanwezig → direct naar dropzone op `/`

Géén download-knoppen naar Cloanto. Géén binaries in git.

## BASIC-mode (zie `docs/BASIC_MODE.md`)

Centraal principe: P-AMH-09 (Meta_AmigaHorse/docs/PRINCIPLES.md). Quick-launch via warm-snapshot + hostfs-injection. Auto-RUN default, toggle voor LIST/edit.

## Routes

| Route | Bestand | Rol |
|---|---|---|
| `/` | `src/basic/index.html` | Quick BASIC dropzone (default landing als setup voltooid) |
| `/basic/setup` | `src/basic/setup.html` | Asset-Setup-wizard |
| `/full` | `src/full/index.html` | Full configurable mode |

## Sessie-MD's

`prompts/YYYY-MM-DD_<slug>.md` met frontmatter (`date`, `repo`, `status`, `resume`).
