# ARCHITECTURE — AmigaHorse_Web

> WASM-build van vAmigaWeb-fork (v0.0.2-besluit, in plaats van AmigaHorse_Core voor Web) + twee parallelle routes + IndexedDB-storage. Géén backend.

## Componentendiagram (v0.0.2-CannonFodder)

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser                                 │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │  /  Quick BASIC  │  │  /full  Full     │  │  /basic/setup  │  │
│  │  - Dropzone .bas │  │  - Library       │  │  - Wizard 3-stap│ │
│  │  - Auto-RUN btn  │  │  - Settings      │  │  - Warm-snap   │  │
│  │  - Mini-OSD      │  │  - Player + OSD  │  │    bake (one-  │  │
│  │                  │  │  - Save/load     │  │    time, ~10s) │  │
│  └────────┬─────────┘  └─────────┬────────┘  └────────┬───────┘  │
│           │                       │                    │         │
│           └───────────────┬───────┴────────────────────┘         │
│                           │ src/wasm-bridge.js (typed wrapper)   │
│                           ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │      vAmiga-WASM (via vAmigaWeb-fork, AGPL-3.0)            │  │
│  │  - vAmiga.start(KSimage) / loadADF(buf, df)                │  │
│  │  - saveState() / restoreState(buf)  ← warm-snapshot        │  │
│  │  - mountDH(path)  ← hostfs-injection van .bas              │  │
│  │  - injectKey(code) / injectJoy(port, dx, dy, fire)         │  │
│  │  - AudioWorklet sink + WebGL/Canvas2D framebuffer-blit     │  │
│  │  - SharedArrayBuffer PTHREAD (COOP+COEP-vereist)           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  Emscripten MEMFS                          │  │
│  │  - /dh1/launch.bas      ← per-launch geschreven            │  │
│  │  - /dh0/...             ← (Full mode HDF-mount, v0.0.3)    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                           │                                      │
│                           ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                       IndexedDB                            │  │
│  │  amigahorse-kickstart    (user KS 1.x/2.x/3.x + AmigaBASIC│  │
│  │                            binary, key: sha256-label)      │  │
│  │  amigahorse-disks        (ADF/HDF + WB 1.3 ADF master)     │  │
│  │  amigahorse-states       (incl. `basic-env-snapshot` warm) │  │
│  │  amigahorse-config       (per-route settings + last .bas)  │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Data-flow A — Quick BASIC (P-AMH-09, prio-flow v0.0.2)

```
First-bezoek
   │
   ▼
[1] Check IndexedDB `amigahorse-states` voor `basic-env-snapshot`
   │
   ├── ontbreekt ──► redirect naar /basic/setup
   │                 [setup-1] upload kick13.rom
   │                 [setup-2] upload wb13.adf
   │                 [setup-3] upload AmigaBASIC binary
   │                 [setup-4] bake warm-snapshot (~10 sec eenmalig):
   │                           vAmiga.start(kick13)
   │                           mount wb13.adf op DF0:
   │                           wacht op WB-boot (≈4 sec)
   │                           open AmigaBASIC binary
   │                           wacht op BASIC-prompt
   │                           saveState() → IndexedDB
   │                 redirect terug naar /
   │
   └── aanwezig ──► [2] Drop .bas op dropzone
                    [3] File-API leest .bas → schrijf MEMFS /dh1/launch.bas
                    [4] vAmiga.restoreState(basic-env-snapshot) (~100 ms)
                    [5] vAmiga.mountDH("/dh1") als DH1: op Amiga
                    [6] injectKey('LOAD "DH1:launch.bas"<CR>') (~200 ms)
                    [7] auto-RUN ? injectKey('RUN<CR>') : stop-in-prompt
                    [8] klaar — programma draait (~500 ms warm-cache, ~1.5 sec cold)
```

## Data-flow B — Full configurable (compat-set)

1. User landt op `/full` → JS checkt browser-compat (WASM SIMD + AudioWorklet + COOP+COEP)
2. Eerste-bezoek → onboarding: "AROS-mode (direct spelen)" vs "Upload eigen Kickstart"
3. Library → user dragt `Turrican.adf` op pagina → File-API → SHA-256 hash → IndexedDB `amigahorse-disks`
4. Click "Play" → init WASM-module → `vAmiga.start(KSimage)` → `loadADF(buf, 0)` → emulator-loop start
5. Emulator-loop in WASM-thread (via SharedArrayBuffer + Atomics)
6. Framebuffer → main-thread → Canvas/WebGL blit @ 50/60Hz
7. Audio-samples → AudioWorklet → AudioContext destination
8. Input:
   - Desktop: Keyboard + Gamepad API → `wasm-bridge.injectKey/injectJoy`
   - Mobile: Touch-overlay-joystick → idem
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
- HDF (harddisk) — alleen ADF in v0.0.x (Full mode); virtual hostfs DH1: voor BASIC-mode
- CD32/CDTV — later
- WHDLoad-bundles — v0.1.x
- AmigaBASIC compileren naar `.b` bytecode — alleen interpreted v0.0.x
- BASIC-edit-modus — alleen run (LIST via Full mode mogelijk)
- AMOS / HiSoft / Blitz BASIC — alleen AmigaBASIC v0.0.2 (AMOS v0.0.3+)
- KS 2.x/3.x voor BASIC-mode (AmigaBASIC werkt alleen op KS 1.x, Commodore-bug)

## Open punten v0.0.3 / v0.0.2.x

1. **vAmigaWeb submodule toevoegen** + Emscripten-build-pipeline draaien (live BASIC-test met user-assets)
2. **AmigaHorse_Core coherentie** — Web-Core afsplitsing (vAmiga) vs X86/Android (FS-UAE) heroverwegen
3. **Compat-set Full mode:** Turrican / Lemmings / Shadow of the Beast op AROS waar mogelijk
4. **BASIC-mode breeder:** AMOS-support (eigen runtime); HiSoft BASIC (commercial, user-supplied)
5. **Asset-bundle-zip** — één `.amigahorse-basic-bundle.zip` met named entries i.p.v. 3 file-pickers
6. **Hosting met COOP+COEP** definitief regelen (Cloudflare Pages / Netlify / HC55-nginx-vhost)
