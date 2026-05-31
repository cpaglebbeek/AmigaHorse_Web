# AmigaHorse_Web

**Variant 1 (prio 1)** van het [AmigaHorse-ecosysteem](https://github.com/cpaglebbeek/Meta_AmigaHorse): WebAssembly-build van een Amiga-emulator, draait volledig in de browser. Geen install, geen backend.

## Status

- **Fase:** v0.0.2 scaffold — vAmigaWeb-basis besloten, twee routes opgezet, géén WASM-build yet
- **Codenaam:** Cannon Fodder
- **Volgende stap (v0.0.2.x → v0.0.3):** vAmigaWeb submodule toevoegen, Emscripten-build draaien, BASIC-Env-Setup-wizard live testen met user-Kickstart 1.3 + WB 1.3 ADF + AmigaBASIC binary, daarna compat-set Turrican/Lemmings/Shadow of the Beast in Full mode bewijzen

## Twee modi (P-AMH-09)

| Route | Doel | Eerste klik tot RUN |
|---|---|---|
| `/` **Quick BASIC** | Drop een zelfgeschreven `.bas` → meteen draaien | ~1-2 sec (warm cache) |
| `/full` **Full configurable** | Disk-management, settings, compat-set, save-states | n.v.t. (normale emulator-flow) |
| `/basic/setup` | Eenmalige Asset-Setup-wizard (KS 1.3 + WB 1.3 ADF + AmigaBASIC binary → IndexedDB → warm-snapshot bake) | one-time ~10 sec |

## Architectuur

```
Browser
  ├─ /                Quick BASIC route   (drag .bas → auto-RUN)
  ├─ /full            Full configurable   (library + player)
  └─ /basic/setup     Asset-Setup wizard  (eenmalig)
            ↕  src/wasm-bridge.js
     vAmiga-WASM (via vAmigaWeb-fork)
            ↕
     IndexedDB (kickstart / disks / states-inc-warm-basic / config)
            ↕
     Emscripten MEMFS  →  vAmiga DH1: mount  (hostfs-injection)
```

Volledige diagram + data-flow: zie [Meta_AmigaHorse/ARCHITECTURE.md](https://github.com/cpaglebbeek/Meta_AmigaHorse/blob/main/ARCHITECTURE.md) en [`docs/BASIC_MODE.md`](docs/BASIC_MODE.md).

## Core-basis (besloten v0.0.2)

[vAmigaWeb](https://github.com/vAmigaWeb/vAmigaWeb) als basis. GPL-3.0 → AGPL-3.0 upgrade is legaal. A500 + OCS + Kickstart 1.3 = exact de sweet-spot voor AmigaBASIC (Microsoft 1985-1989, werkt **niet** op KS 2.0+; bekende Commodore-incompatibility). Coherentie met AmigaHorse_Core (FS-UAE/WinUAE-stack) wordt heroverwogen in v0.0.3.

## Doelplatformen

- **Browsers:** Firefox ≥120, Chrome ≥120, Safari ≥17 (WASM SIMD + AudioWorklet + Gamepad API verplicht)
- **Mobile:** Chrome Android / Safari iOS — touch-overlay-joystick (Full mode); Quick BASIC ook touch-vriendelijk
- **PWA:** Optioneel in v0.x (offline-cache van WASM-bundle + library)

## Distributie

Static hosting met COOP+COEP-headers (`Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`, vereist voor SharedArrayBuffer-PTHREAD). v0.0.x: lokaal getest via `npx serve --cors` of `vite`. v0.1.x: deploy onder `icthorse.nl/AmigaHorse/` of `horsecloud55.ddns.net/AmigaHorse/`.

## ROM-beleid (P-AMH-05 — strikt)

Géén Kickstart- of AmigaBASIC-binaries in deze repo. Alles user-supplied.

- **AROS-Kickstart fallback:** open source, bundled in WASM (voor Full mode demos zonder eigen ROM)
- **User-Kickstart 1.x/2.x/3.x:** File-API upload → IndexedDB `amigahorse-kickstart` store
- **User-AmigaBASIC binary:** File-API upload via `/basic/setup`-wizard → IndexedDB `amigahorse-kickstart` store (label `amigabasic-bin`)
- **User-Workbench 1.3 ADF:** idem, `amigahorse-disks` store met label `wb13-master`
- **Geen download-knoppen** naar Cloanto/eigen-rip-bronnen (anti-piraterij); wel link naar legale bron in setup-wizard

## Licentie

AGPL-3.0 — zie [LICENSE](LICENSE).

## Werkprotocol

Zie [CLAUDE.md](CLAUDE.md) en [Meta_AmigaHorse/CLAUDE.md](https://github.com/cpaglebbeek/Meta_AmigaHorse/blob/main/CLAUDE.md).
