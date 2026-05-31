# external/

> Upstream-afhankelijkheden als git-submodules. Niet in `dist/`-build; gebouwd naar WASM en gelinkt vanuit `src/wasm-bridge.js`.

## vAmigaWeb (toegevoegd v0.0.2.1, 2026-05-31)

**Bron:** [vAmigaWeb/vAmigaWeb](https://github.com/vAmigaWeb/vAmigaWeb) (GPL-3.0)
**Pinned commit:** `c3c50d9` (2026-05-28, vAmigaWeb v4-merge)
**Licentie-pad:** GPL-3.0 → AGPL-3.0 upgrade legaal via "or later"-clausule (GPL-3.0 §14)
**Audit:** zie `Meta_AmigaHorse/docs/UPSTREAM_AUDIT.md` baseline-entry 1

**Géén releases / tags beschikbaar bij upstream** — gepind op commit. Open suggestie voor upstream-PR (P-AMH-01): "release-tags toevoegen bij elke v4/v5-milestone".

**Update protocol:**

```bash
cd /Users/christian/Documents/Gemini_Projects/AmigaHorse_Web/external/vamigaweb
git fetch
git log <pinned>..origin/main --oneline    # bekijk wijzigingen
git checkout <new-commit>
cd ..
git add external/vamigaweb
git commit -m "Bump vAmigaWeb to <new-commit> + audit-update"
```

Bij elke bump: per-file-license-audit conform `Meta_AmigaHorse/CLAUDE.md` (vAmigaWeb bevat vAmiga-core gevendored in `Core/`-directory + WebGL/AudioWorklet glue).

## vAmiga (vendored in vAmigaWeb/Core/)

[dirkwhoffmann/vAmiga](https://github.com/dirkwhoffmann/vAmiga) zit **niet als sub-submodule**, maar is vendored als source-tree in `external/vamigaweb/Core/`. Géén transitive submodule risico.

3-tier licentie binnen vAmiga:
- vAmiga-app: GPL-3.0-or-later (niet vendored — alleen Mac-app, irrelevant voor Web)
- Core Emulator (CPU, Custom, Floppy, FileSystems, …): MPL-2.0
- Moira (68k CPU): MIT

Alle drie AGPL-3.0-compat.

## Waarom geen direct vAmiga?

vAmigaWeb wraps vAmiga met de Emscripten/WebAssembly-glue + AudioWorklet + WebGL framebuffer-blit. Die glue is voor ons hergebruikbaar; we hoeven niet zelf vAmiga te emscripten-porteren.

We forken **vAmigaWeb** (niet upstream) zodra we eigen patches nodig hebben voor:
- BASIC-mode hostfs-injection (`mountDH` API te verifieren)
- Asset-Setup-wizard integratie
- Twee-routes-architectuur (BASIC vs Full)
- Eigen UI-tokens (Workbench 1.3 stijl)

Conform P-AMH-01 (Upstream first): patches gaan eerst als PR naar dirkwhoffmann.

## Build-pipeline (v0.0.2.x)

```bash
# 1. Submodule kloon
git submodule update --init --recursive

# 2. Emscripten installeren (eenmalig, lokaal)
cd ~/Documents/Gemini_Projects
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk && ./emsdk install latest && ./emsdk activate latest
source ./emsdk_env.sh

# 3. WASM-build
cd /Users/christian/Documents/Gemini_Projects/AmigaHorse_Web/external/vamigaweb
# Follow upstream BUILD.md (cmake + emcc)
# Output: build/amigahorse-vamiga.wasm + amigahorse-vamiga.js

# 4. Bundle met onze UI
cd /Users/christian/Documents/Gemini_Projects/AmigaHorse_Web
npm install && npm run build
# Output: dist/ (incl. vAmiga WASM bundled)
```

## Géén binaries in git

vAmigaWeb-source via submodule = OK. Gegenereerde WASM-binaries (`*.wasm`) horen in `.gitignore` (zie root). Releases distribueren we via GitHub Releases of CDN, niet via git.
