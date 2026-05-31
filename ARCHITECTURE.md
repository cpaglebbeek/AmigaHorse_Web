# ARCHITECTURE — AmigaHorse_Web

> WASM-build van AmigaHorse_Core + browser-native UI + IndexedDB-storage. Geen backend.

## Componentendiagram

```
┌───────────────────────────────────────────────────────────────┐
│                      Browser                                   │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 UI-laag (HTML/CSS/JS)                   │   │
│  │  - Landing/onboarding (AROS vs user-Kickstart)          │   │
│  │  - Library (lijst van ADF/HDF + recent)                 │   │
│  │  - Player (canvas + OSD + touch-joystick op mobile)     │   │
│  │  - Settings (compat-mode, audio, gamepad-binding)       │   │
│  └─────────────────────┬───────────────────────────────────┘   │
│                        │ JS ↔ WASM exports                     │
│  ┌─────────────────────▼───────────────────────────────────┐   │
│  │           src/wasm-bridge.js (typed wrapper)            │   │
│  │  - loadKickstart(buf) / loadADF(buf, df)                │   │
│  │  - startEmulation() / pause() / resume() / reset()      │   │
│  │  - saveState() → Uint8Array / loadState(buf)            │   │
│  │  - setJoystick(port, dirs, fire) / setKey(code, down)   │   │
│  │  - getFramebuffer() → Uint8Array (RGBA)                 │   │
│  └─────────────────────┬───────────────────────────────────┘   │
│                        │                                       │
│  ┌─────────────────────▼───────────────────────────────────┐   │
│  │       AmigaHorse_Core (Emscripten WASM-build)           │   │
│  │  - Public API (zie Core README)                         │   │
│  │  - PTHREAD support (SharedArrayBuffer)                  │   │
│  │  - AudioWorklet voor sample-output                      │   │
│  │  - Canvas2D of WebGL voor framebuffer-blit              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                        │                                       │
│                        ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              IndexedDB-stores                            │   │
│  │  - amigahorse-kickstart   (user-uploaded ROMs + AROS)   │   │
│  │  - amigahorse-disks       (ADF/HDF blobs + metadata)    │   │
│  │  - amigahorse-states      (save-states per disk-set)    │   │
│  │  - amigahorse-config      (UI-settings, last-played)    │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

## Data-flow — typische sessie

1. User landt op pagina → JS checkt browser-compat (WASM SIMD + AudioWorklet + crossOriginIsolated headers)
2. Eerste-bezoek → onboarding: "AROS-mode (direct spelen)" vs "Upload eigen Kickstart"
3. Library → user dragt `Turrican.adf` op pagina → File-API leest blob → SHA-256 hash → IndexedDB `amigahorse-disks`
4. Click "Play" → JS init WASM-module → `loadKickstart(...)` → `loadADF(buf, 0)` → `startEmulation()`
5. Emulator-loop in WASM-thread (via SharedArrayBuffer + Atomics)
6. Framebuffer → main-thread → Canvas/WebGL blit @ 50/60Hz
7. Audio-samples → AudioWorklet → AudioContext destination
8. Input:
   - Desktop: Keyboard + Gamepad API → `wasm-bridge.setJoystick/setKey`
   - Mobile: Touch-overlay-joystick (eigen JS-component) → idem
9. Quicksave → `saveState()` → Uint8Array → IndexedDB `amigahorse-states` met disk-hash-key
10. Tab-close → save current state als auto-save

## Browser-compat-matrix (vereist)

| Feature | Firefox | Chrome | Safari | Mobile (Chrome/Safari) | Reden |
|---|---|---|---|---|---|
| WASM | ≥52 | ≥57 | ≥11 | ja | Core-runtime |
| WASM SIMD | ≥89 | ≥91 | ≥16.4 | ≥16.4 (iOS) | Cycle-accurate performance |
| SharedArrayBuffer | ≥79 (+headers) | ≥68 (+headers) | ≥15.2 (+headers) | ja (+headers) | PTHREAD WASM |
| AudioWorklet | ≥76 | ≥66 | ≥14.1 | ≥14.5 (iOS) | Lage-latency audio |
| Gamepad API | ≥21 | ≥35 | ≥10.1 | gedeeltelijk | Optioneel input |
| File-API + IndexedDB | overal ja | overal ja | overal ja | overal ja | Storage |
| crossOriginIsolated (COOP+COEP) | vereist voor SAB | vereist | vereist | vereist | PTHREAD |

**Server-headers vereist** (geen backend-app, alleen static-hosting met juiste headers):
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## Compat-set v0.0.2 (te bewijzen)

Drie iconische Amiga-titels — als deze speelbaar zijn op AROS of user-Kickstart 1.3, is de basis goed:

| Game | Studio | Kickstart-vereiste | Reden voor compat-set |
|---|---|---|---|
| Turrican | Factor 5 | 1.3 (OCS) | Codenaam v0.0.1; cycle-accuracy-bewijs |
| Lemmings | DMA Design | 1.3 (OCS) | Standaard demo-test; muis+keyboard |
| Shadow of the Beast | Psygnosis | 1.3 (OCS) | Parallax-scroller, copper-tricks |

## Niet-scope v0.0.x

- iOS App Store-build (PWA volstaat)
- Multiplayer/netplay
- HDF (harddisk) — alleen ADF in v0.0.x
- CD32/CDTV — later
- WHDLoad-bundles — v0.1.x

## Open vragen v0.0.2

1. **Emscripten-port vs vAmigaWeb-integratie?** vAmigaWeb heeft eigen core (geen WinUAE-derivaat), klaar voor WASM, maar andere API. Eigen WinUAE/FS-UAE Emscripten-port = veel werk maar bron-consistent met X86/Android.
2. **UI-framework?** Vanilla JS (snelste laden, minst deps) vs lichte React/Solid/Svelte (UX-snelheid).
3. **AROS-bundling-strategie?** Static include in WASM-bundle (~3-5 MB groter) vs lazy-load on first-use.
4. **Cross-origin-isolation:** static-host-keuze die COOP+COEP-headers ondersteunt (Cloudflare Pages / Netlify / HC55-nginx-config).
