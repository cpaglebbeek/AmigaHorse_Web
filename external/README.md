# external/

> Upstream-afhankelijkheden als git-submodules. Niet in `dist/`-build; gebouwd naar WASM en gelinkt vanuit `src/wasm-bridge.js`.

## vAmigaWeb (gepland, v0.0.2.x)

**Bron:** [dirkwhoffmann/vAmigaWeb](https://github.com/dirkwhoffmann/vAmigaWeb) (GPL-3.0)
**Licentie-pad:** GPL-3.0 → AGPL-3.0 upgrade legaal via "or later"-clausule
**Toevoegen:**

```bash
cd /Users/christian/Documents/Gemini_Projects/AmigaHorse_Web
git submodule add https://github.com/dirkwhoffmann/vAmigaWeb.git external/vamigaweb
git commit -m "Add vAmigaWeb v<tag> als submodule voor Web-core (v0.0.2.x)"
git push
```

Pin op laatste **release-tag** (geen floating main). Bij tag-update: per-file-license-audit conform `Meta_AmigaHorse/CLAUDE.md` (vAmigaWeb bevat vAmiga-core uit eigen GPL-3.0 project + WebGL/AudioWorklet glue).

## vAmiga (transitive)

vAmigaWeb gebruikt [dirkwhoffmann/vAmiga](https://github.com/dirkwhoffmann/vAmiga) als upstream-emulator (C++). Wordt automatisch meegeklond als sub-submodule of als source-include — zie vAmigaWeb-README bij toevoegen.

## Waarom geen direct vAmiga?

vAmigaWeb wraps vAmiga met de Emscripten/WebAssembly-glue + AudioWorklet + WebGL framebuffer-blit + dropbox/google-drive-helpers. Die glue is voor ons hergebruikbaar; we hoeven niet zelf vAmiga te emscripten-porteren.

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
