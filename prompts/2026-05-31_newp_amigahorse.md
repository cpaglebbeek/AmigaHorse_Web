---
date: 2026-05-31
repo: AmigaHorse_Web
status: open
resume: "verder met AmigaHorse_Web v0.0.2 — Emscripten-port-keuze (eigen WinUAE/FS-UAE WASM vs vAmigaWeb-integratie) + compat-set Turrican/Lemmings/ShadowOfTheBeast"
---

# Sessie 2026-05-31 — newp AmigaHorse_Web (prio 1)

**Agent:** Claude Opus 4.7 (1M context)
**Repo:** AmigaHorse_Web (`cpaglebbeek/AmigaHorse_Web`)
**Branche:** main
**Codenaam:** Turrican
**Cross-repo werk:** Meta_AmigaHorse, AmigaHorse_Core

---

## Opdracht

Gebruiker startte `newp "AmigaHorse"` met 4 targets (Web/x86/Android/SteamDeck), basis WinUAE. In prompt 2 expliciet: **"webversie als 1e"** → Web krijgt prio 1 + topcodenaam Turrican.

## Skeleton-inhoud v0.0.1

- README + CLAUDE + ARCHITECTURE + VERSION + CHANGELOG + .gitignore + LICENSE (AGPL-3.0)
- Géén WASM-build, géén Emscripten-config, géén src/ code, géén package.json

## Beslissingen v0.0.1

- Scope: Browser-only (Firefox/Chrome/Safari ≥17, mobile inbegrepen)
- ROM: AROS-fallback + File-API user-upload → IndexedDB
- Compat-set v0.0.2: Turrican, Lemmings, Shadow of the Beast
- Static-hosting + COOP/COEP-headers (geen backend)

## Open vragen v0.0.2 (eerste agenda)

1. Eigen Emscripten-port (FS-UAE/WinUAE → WASM) vs [vAmigaWeb](https://github.com/dirkwhoffmann/vAmigaWeb) als basis
2. UI-framework: vanilla JS vs React/Solid/Svelte
3. AROS-bundling: static-include vs lazy-load
4. Hosting-keuze met COOP+COEP-headers (Cloudflare Pages / Netlify / HC55-nginx)

## Trigger voor /checkresume

"verder met AmigaHorse_Web v0.0.2 — Emscripten-port-keuze + compat-set bewijzen"
