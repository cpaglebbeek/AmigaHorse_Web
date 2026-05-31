# AmigaHorse_Web

**Variant 1 (prio 1)** van het [AmigaHorse-ecosysteem](https://github.com/cpaglebbeek/Meta_AmigaHorse): WebAssembly-build van de Amiga-emulator-core, draait volledig in de browser. Geen install, geen backend.

## Status

- **Fase:** v0.0.1 skeleton — geen runnable code, geen WASM-build
- **Codenaam:** Turrican
- **Volgende stap (v0.0.2):** Emscripten-port-keuze (eigen WinUAE/FS-UAE Emscripten-build vs integratie [vAmigaWeb](https://github.com/dirkwhoffmann/vAmigaWeb)) + A500-only-bewijslast (Lemmings, Turrican, Shadow of the Beast op AROS-Kickstart)

## Architectuur

```
Browser
  └─ HTML/CSS/JS UI (vanilla of lichte React)
       ↕  exports
     AmigaHorse_Core WASM-module
       ↕
     IndexedDB (ADF/HDF, save-states, user-Kickstart)
```

Volledige diagram: zie [Meta_AmigaHorse/ARCHITECTURE.md](https://github.com/cpaglebbeek/Meta_AmigaHorse/blob/main/ARCHITECTURE.md).

## Doelplatformen

- **Browsers:** Firefox ≥120, Chrome ≥120, Safari ≥17 (WASM SIMD + AudioWorklet + Gamepad API verplicht)
- **Mobile:** Chrome Android / Safari iOS — touch-overlay-joystick
- **PWA:** Optioneel in v0.x (offline-cache van WASM-bundle + library)

## Distributie

Static hosting. Geen backend. v0.0.x: lokaal getest via `npx serve` of vergelijkbaar. v0.1.x: deploy onder `icthorse.nl/AmigaHorse/` of `horsecloud55.ddns.net/AmigaHorse/`.

## ROM-beleid

Géén Kickstart-binaries in deze repo (zie [P-AMH-05](https://github.com/cpaglebbeek/Meta_AmigaHorse/blob/main/docs/PRINCIPLES.md)).
- **Default:** AROS-Kickstart-replacement (open source, bundled in WASM)
- **User-Kickstart:** File-API upload → IndexedDB (`amigahorse-kickstart` store)
- **Geen download-knoppen** naar Cloanto/eigen-rip-bronnen (anti-piraterij)

## Licentie

AGPL-3.0 — zie [LICENSE](LICENSE).

## Werkprotocol

Zie [CLAUDE.md](CLAUDE.md) en [Meta_AmigaHorse/CLAUDE.md](https://github.com/cpaglebbeek/Meta_AmigaHorse/blob/main/CLAUDE.md).
