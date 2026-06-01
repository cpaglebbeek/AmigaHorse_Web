# Changelog — AmigaHorse_Web

Format: [Keep a Changelog](https://keepachangelog.com/). Codenamen uit pool `Meta_AmigaHorse/CLAUDE.md`.

## [0.0.9-FrontierEliteII] — 2026-06-01 (sub-step 9: save-state-slots + multi-disk-swap)

> Codenaam **Frontier: Elite II** (David Braben 1993, iconic infinite-universe save-state-systeem). Kleur **Groen +0.0.1**.

### Added
- **`src/lib/save-state-manager.js`** (~110r) — `SaveStateManager` class
  - 4 slots per disk-hash (uitbreidbaar via `SLOTS_PER_DISK`)
  - Disk-key = eerste 16 hex chars van SHA-256(disk-bytes) → 64-bit-uniek via `crypto.subtle.digest`
  - `save(diskKey, slot)`, `load(diskKey, slot)`, `listSlots(diskKey)`, `hashDisk(buf)`
  - IndexedDB-label-format `${diskKey}:${slot}` in bestaande `amigahorse-states`-store (`basic-env-snapshot` ongemoeid)
- **`src/lib/disk-swap.js`** (~50r) — multi-disk-helpers
  - `insertDiskInDrive(bindings, blob, fileName, drive)` voor DF0..DF3
  - `DRIVES` constant met 4-drive metadata
- **`src/full/library.js`** uitgebreid
  - "Boot (DF0:)" hoofd-knop per disk → loadDisk + powerOn + renderer
  - "Insert: DF0 DF1 DF2 DF3" knoppen per disk → mount in drive zonder reset
  - `quicksave(slot)` + `quickload(slot)` met disk-key-binding bij Boot
  - `wireSaveStateUI` koppelt save-1..4 + load-1..4 buttons
- **`src/full/index.html`** save-state-controls sectie met 8 buttons (Save/Load 1-4)
- **`esbuild.config.mjs`** entry-points: save-state-manager + disk-swap erbij

### Verified
- `node --check` op 13 JS-files OK
- `npm run build` 46ms minified
- Dev-server :5173: `/`, `/basic/`, `/full/` (2125b — uitgebreid), `vendor WASM` 8.77 MB allemaal 200
- `dist/full/index.html` bevat `save-state-controls` + `save-1` + `load-1` (HTML correct gecopy-ed naar dist/)

### Decided
- Disk-key = 64-bit hash (16 hex chars) — voldoende uniek voor user-libraries van ~hundreds disks
- 4 slots default; uitbreidbaar zonder DB-migratie (label-format is flexibel)
- `basic-env-snapshot` blijft aparte fixed key (geen slot-overlap met game-states)

### Not yet (sub-step 10 of v0.1.0)
- Mouse-coords WB-icon-tunen (vereist user-screenshot)
- iOS PWA (manifest.json + service-worker)
- Compat-set Turrican/Lemmings/SOTB benchmark
- AudioWorklet-migratie
- Save-state-thumbnail (framebuffer-snap bij save)
- Auto-save bij tab-close
- Save-state-export/import (.vamigastate file-download)

## [0.0.8-DefenderOfTheCrown] — 2026-06-01 (sub-step 8: multi-block ADF + Full mode + Gamepad)

> Codenaam **Defender of the Crown** (Cinemaware 1986, eerste echt "cinematic" Amiga-experience — fitting Full mode arrival).
> Kleur **Groen +0.0.1**. Oranje +0.1.0 spaar ik tot user e2e-bewijs.

### Added
- **`src/lib/build-blank-adf.js` multi-block-support**
  - File-size limiet 488 bytes → **35 136 bytes (~34 KB)** = 72 OFS data-blocks
  - OFS data-block-chain: per block seq# + next-pointer; bitmap markeert alle gebruikte blocks; file-header data-block-pointer-array in reverse order
  - Constants `MAX_DATA_BLOCK_PTRS=72` + `MAX_FILE_SIZE=35136` ge-export
  - **Node smoke-test:** 2000-byte content → 5 chained blocks met juiste seq/next sequencing, totaal-ADF 901 120 bytes, boot-magic `DOS\0` correct
- **`src/lib/gamepad-input.js`** (~110r) — `GamepadInput` class
  - HTML5 Gamepad API polling op `requestAnimationFrame`
  - D-pad / left-stick → `PULL_UP/DOWN/LEFT/RIGHT` events
  - Button 0 (south) = `PRESS_FIRE`
  - Vorige-state-tracking voor `RELEASE_X/Y/FIRE` bij overgang naar neutraal
  - Deadzone 0.3 voor analoge sticks
  - Auto-release bij detach (sticky-prevention)
- **`src/wasm-bridge.js`** nieuwe `joystick` cwrap-binding — string `"<port><event>"`
- **`src/full/library.js`** uitgebreid van skeleton → werkende library + player
  - `listIndexedDBStore('amigahorse-disks')` toont alle entries
  - "Play" button per disk → loadFile + powerOn + renderer.start + alle inputs
  - Kickstart-upload (`#upload-kick-full`) zodat Full mode standalone werkt zonder /basic/setup
  - Audio-resume-on-gesture
  - `escapeHtml/escapeAttr` voor user-input safety
- **`src/full/index.html`** uitgebreid met kickstart-upload + status-element + canvas (320×256, hidden tot Play)
- **`src/basic/quick-launch.js`** GamepadInput attached bij `.bas`-drop

### Verified
- `node --check` op 11 JS-files OK
- `npm run build` 31ms minified
- Dev-server :5173 alle routes 200
- Multi-block ADF Node-smoke-test: 5 chained blocks correct (seq 1-5, next-pointers 884→885→886→887→0)
- Bundle-size: quick-launch 3.7 KB + full/library 3.5 KB (shared chunks)

### Decided
- ADF-limiet 34 KB voldoende voor v0.0.8 (typische BASIC-programma's <10 KB). Extension-block voor >34 KB = v0.x
- Gamepad polling via rAF (geen polling-events overshoot)
- Full mode hergebruikt Quick BASIC's renderer/mouse/audio/gamepad classes — single source

### Not yet (sub-step 9 of v0.1.0)
- Mouse-coords WB-icon-tunen (vereist user screenshot van WB-boot)
- Save-state-synchronisatie Quick BASIC ↔ Full mode
- Compat-set Turrican/Lemmings/SOTB benchmark
- AudioWorklet-migratie (alleen als latency-klacht)
- Multi-disk projecten (DF0+DF1+DF2 swap)
- iOS PWA-modus

## [0.0.7-ChaosEngine] — 2026-06-01 (sub-step 7: audio-sink + pixel-format-auto-detect)

> Codenaam **Chaos Engine** (Bitmap Brothers 1993, atmosferische audio + complex render-engine — fitting audio-pipeline + pixel-handling).
> Kleur **Groen +0.0.1** (nieuwe pipeline-laag binnen bestaande architectuur). Oranje +0.1.0 spaar ik tot user e2e-bewijs.

### Added
- **`src/lib/audio-setup.js` werkende sink** (uitgebreid van skelet)
  - `ScriptProcessorNode` buffer-size 2048 samples (~46ms @ 44.1kHz)
  - `onaudioprocess`-callback: `bindings.copyIntoSoundBuffer()` → lees L+R float-pointers uit HEAPF32 → kopieer naar stereo output met `[-1, 1]`-clamp
  - `resume()` / `suspend()` / `mute()` / `unmute()` API
  - Underrun-detection met 5s log-rate-limit
  - Silence-fill bij fouten (geen audio-glitch-crashes)
- **`src/lib/canvas-renderer.js` pixel-format-auto-detect**
  - `_detectPixelFormat(heapView)` heuristiek: vAmiga zet alpha=0xFF op alle pixels; we sampelen 8 verspreide pixels en kijken of `0xFF` in byte-0 (ARGB) of byte-3 (RGBA) staat
  - `_copyPixels(heapView, dst)` doet `data.set()` voor RGBA-direct of byte-shuffle voor ARGB→RGBA
  - Detectie bij eerste valide frame; console.log toont gedetecteerd formaat
- **`src/basic/quick-launch.js` audio-resume-on-gesture**
  - `document.body.addEventListener('click', ..., { once: true })` resume't audio bij eerste click (Chrome auto-block-policy)
  - `.bas`-drop = user-gesture → direct `audioSetup.resume()` na init
- **`src/lib/audio-processor-TODO.md`** placeholder voor v0.x AudioWorklet-migratie
  - Migratie-plan: Optie A (SharedArrayBuffer + COOP+COEP, ~5ms latency, ~150r) vs Optie B (postMessage, ~20ms, ~80r)
  - Trigger voor migratie: latency-klacht, worker-mode-nodig, of browser deprecation-notice

### Changed
- `AudioSetup` constructor signature: `new AudioSetup(bindings, Module)` (was `bindings` only) — Module nodig voor HEAPF32-access
- `src/basic/quick-launch.js` aangepast voor 2-arg constructor

### Verified
- `node --check` op 10 JS-files OK
- `npm run build` 30ms minified
- Dev-server :5173 alle routes 200
- Bundle bevat `ScriptProcessor` + `onaudioprocess` + `HEAPF32` (audio-pipeline ge-link)
- Bundle-size quick-launch: 6.6 KB → 9.2 KB (audio + pixel-detect logic erbij)

### Decided
- **ScriptProcessorNode** boven AudioWorklet voor v0.0.7 — werkt zonder COOP+COEP-headers / SharedArrayBuffer / worker-mode. Latency ~46ms acceptabel voor retro. AudioWorklet → v0.x als nodig
- Pixel-detect via alpha-byte-positie: simpel + werkt voor vAmiga (alpha altijd 0xFF). Eerste detect bij frame ≥1 valide pixel-buffer
- Audio-context-unlock via `once: true` body-click listener — robuust pattern voor Chrome

### Not yet (sub-step 8 of v0.1.0+)
- AudioWorklet migratie (alleen als latency-issue ontstaat)
- Mouse-coords WB-icon-tunen (vereist live test)
- Multi-block ADF >488 bytes
- Full mode rendering
- Gamepad-API
- Save-state synchronisatie tussen Quick BASIC en Full mode

## [0.0.6-Apidya] — 2026-06-01 (sub-step 6: canvas-render + mouse-emulation + audio-skelet)

> Codenaam **Apidya** (Kaiko 1992, shoot-em-up bekend om state-of-the-art Amiga graphics — fitting render-pipeline).
> Kleur **Groen +0.0.1** (nieuwe bindings + render-loop, geen architectuurwijziging). Oranje +0.1.0 spaar ik tot user e2e-bewijs.

### Added
- **`src/lib/canvas-renderer.js`** (~120r) — `CanvasRenderer` class met `requestAnimationFrame`-loop
  - `start()` / `stop()` idempotent
  - Per tick: `drawOneFrame(now)` → `pixelBuffer()` → HEAPU8.subarray → ImageData → putImageData
  - Auto-resize canvas + ImageData bij resolution-switch
  - `fitToContainer(maxWidth)` voor CSS-pixel-scaling met `image-rendering: pixelated`
  - FPS-counter
- **`src/lib/mouse-input.js`** (~110r) — `MouseInput` class
  - DOM mousemove/down/up/contextmenu → `bindings.mouse(port, x, y)` + `bindings.mouseButton(port, btn, pressed)`
  - Coordinate-scaling via `getBoundingClientRect` + canvas native dims
  - `blur`-handler om sticky-buttons te voorkomen
  - Helpers `scriptedClick` + `scriptedDoubleClick` voor bake-flow (WB-icon-double-click)
- **`src/lib/audio-setup.js`** (~60r, skelet) — `AudioSetup` class
  - `init()` reserveert AudioContext + roept `bindings.setSampleRate(rate)`
  - TODO sub-step 7: AudioWorklet / ScriptProcessor sink koppelen
- **`src/wasm-bridge.js`** uitgebreid met 14 nieuwe cwrap-bindings:
  - Render: `drawOneFrame`, `execute`, `pixelBuffer`, `renderWidth`, `renderHeight`, `frameInfo`
  - Mouse: `mouse`, `mouseButton`
  - Audio: `setSampleRate`, `updateAudio`, `leftChannelBuffer`, `rightChannelBuffer`, `getSoundBufferAddress`, `copyIntoSoundBuffer`
- **`src/wasm-bridge.js` nieuwe export** `getModule()` voor HEAP-access door renderer
- **`src/basic/quick-launch.js`** wire alle drie: renderer.start + mouseInput.attach + audioSetup.init bij `.bas`-drop
- **`src/basic/setup.js`** bake-flow uitgebreid:
  - Canvas-renderer toont WB-boot live tijdens bake
  - Twee-pad start AmigaBASIC: (1) CLI-typing `AmigaBASIC<RET>`, (2) scripted mouse-double-click op (270, 100) — beide proberen
- **`src/basic/setup.html`** `<canvas id="bake-canvas">` toegevoegd (320×256, hidden tot bake start)

### Verified
- `node --check` op 10 JS-files OK
- `npm run build` produceert minified dist/ in 26ms
- Dev-server :5173 serves alle routes 200
- Bundle bevat nieuwe classes (CanvasRenderer/MouseInput/AudioSetup + drawOneFrame/pixelBuffer/renderWidth verified via grep)
- Bundle-size redelijk: quick-launch 6.6 KB (was 4.9 KB), setup 4.8 KB (was 4.2 KB)

### Signaturen geverifieerd in main.cpp
- `wasm_mouse(int port, int x, int y)` — port=1 typisch
- `wasm_mouse_button(int port, int button_id, int pressed)` — btn 0=left, 1=right
- `wasm_pixel_buffer() → Texel*` (= u32 ARGB/RGBA per pixel)
- `wasm_get_render_width/height() → int`
- `wasm_draw_one_frame(double now) → int`
- `wasm_set_sample_rate(unsigned)`
- `wasm_get_sound_buffer_address() → float*` + L/R-channel-buffer pointers

### Aanname (te verifieren live)
- Pixel-format: little-endian RGBA (Canvas2D-conventie). Als vAmiga ARGB schrijft (Mac-style): kleurkanaal-swap nodig → sub-step 6.1 fix
- Mouse-port 1 voor Amiga-muis
- WB 1.3 AmigaBASIC-icon op coords (270, 100) — educated guess; live tunen

### Not yet (sub-step 7)
- Audio-sink (AudioWorklet of polling ScriptProcessor) — vereist beslissing over SharedArrayBuffer / COOP+COEP / postMessage-pattern
- Pixel-format-auto-detect (RGBA vs ARGB)
- Mouse-coords WB-icon-tuning op basis van eerste live bake
- Full mode rendering (alleen Quick BASIC heeft render-loop nu)
- Gamepad-API
- Multi-block ADF >488 bytes

## [0.0.5-RType] — 2026-06-01 (v0.0.2.x sub-step 5: amiga-keymap + bake-flow + full BASIC-flow, dev-server bewezen)

> Codenaam **R-Type** (Irem 1989, side-scrolling shooter port — fitting "key-TYPE" + iconic Amiga title).
> Kleur **Groen +0.0.1** (JS-wiring + dev-server-proof, géén live AmigaBASIC-test door mij — vereist user-supplied binaries).
> Oranje +0.1.0 spaar ik voor wanneer warm-snapshot daadwerkelijk wordt opgeslagen + restored door jou.

### Added
- **`src/lib/amiga-keymap.js`** — ASCII → Amiga rawkey-code mapping
  - `RAWKEY`-constants voor alle US-layout keys (A-Z, 0-9, modifiers, function-keys)
  - `encodeStringToSequence(str, opts)` → Array<{ code, pressed, delayMs }> met automatisch SHIFT-state-management
  - `playSequence(bindings, seq)` → await-loop met setTimeout-delays voor typing
  - Default typing-rate 50ms/char (volstaat voor BASIC-prompt zonder dropped chars)
- **`src/basic/setup.js` bake-flow** geïmplementeerd
  - Stap 1-6: init → loadFile kick → powerOn → loadFile WB df0 → run → wait boot → type "AmigaBASIC\r" → wait → saveStateToBuffer → IndexedDB
  - TODO-markers voor sub-step 6+ tuning (timing, mouse-emulation, CLI-launch-alternative)
- **`src/basic/quick-launch.js` volledige flow** geïmplementeerd
  - Drop .bas → buildAdfWithBasFile → restoreStateFromBuffer (warm-snapshot) → loadFile DF1: → playSequence("LOAD ...") → auto-RUN ? "RUN" : stop → bindings.run()
- **`docs/BASIC_MODE.md`** uitgebreid met "Hoe te testen"-sectie
  - 5 stappen (build → smoke-test → asset-setup → bake → BASIC-test)
  - Verwachte failure-punten v0.0.5 + tuning-hints (CLI-launch, save-timing, ROM-drive-number)
  - Bekende beperkingen (canvas leeg in v0.0.5, geen audio yet)
- **Dev-server poort verandererd 8000 → 5173** (Vite-conventie)
  - Reden: Christian heeft SSH-tunnel naar HC55 op localhost:8000
  - Configureerbaar via `PORT=5174 npm run dev`

### Verified
- `npm install` clean (esbuild 0.20.2 geïnstalleerd)
- `node esbuild.config.mjs --dev` start op :5173 binnen 5 sec
- 8 routes serven 200 incl. `/vendor/vamigaweb/vAmiga.wasm` (8.77 MB, `Content-Type: application/wasm`)
- esbuild splitting werkt (chunks correct geresolved via import-graph)
- `node --check` op alle 7 JS-files OK
- `npm run build` produceert minified dist/

### Decided
- Typing-rate 50ms/char default in `playSequence` — wijzig via `opts.charDelayMs`
- Bake-flow gebruikt CLI-launch via type `AmigaBASIC\r` (geen mouse-emulation v0.0.5)
- BASIC-quick-launch toont canvas-element maar framebuffer-rendering pas v0.0.6

### Not yet (sub-step 6+)
- Canvas-framebuffer-render-loop (vAmiga's `wasm_pixel_buffer` + `wasm_draw_one_frame` koppelen aan `<canvas>` via WebGL of Canvas2D)
- Audio via AudioWorklet + `wasm_get_sound_buffer_address`
- Mouse-emulation (`wasm_mouse` + `wasm_mouse_button`) voor WB-icon-click-launch (alternatief voor CLI-typing)
- Multi-block OFS-files (>488 bytes)
- Compat-set Full mode: Turrican / Lemmings / Shadow of the Beast
- COOP+COEP-headers in dev-server (alleen als worker-mode ooit)
- AMOS / HiSoft / Blitz BASIC

## [0.0.4-Speedball2] — 2026-05-31 (v0.0.2.x sub-step 4: cwrap-bindings + ADF-builder + dev-pipeline)

> Concrete JS-wiring naar vAmiga-WASM + pure-JS OFS-ADF-builder voor BASIC-injection + esbuild dev-server. Géén live-test yet (sub-step 5).
> Codenaam **Speedball 2** (Bitmap Brothers 1990, action-sports — fitting infrastructuur-acceleratie).
> Kleur **Groen +0.0.1** (JS-wiring zonder architectuurwijziging; Oranje +0.1.0 spaar ik voor sub-step 5 wanneer warm-snapshot daadwerkelijk werkt).

### Added
- **`src/wasm-bridge.js` herschreven** met concrete bindings:
  - `init()` Promise-based, idempotent, classic-script-load met `Module.onRuntimeInitialized`-callback
  - `bindFunctions()` → 8 cwrap-bindings: `run`, `halt`, `reset`, `powerOn`, `configure`, `key`, `scheduleKey`, `loadFile`
  - `loadFile(name, buf, drive)` met handmatige `_malloc` + `HEAPU8.set` + `_free` voor u8*-passing
  - `saveStateToBuffer()` / `restoreStateFromBuffer(buf)` — wrappers rond `wasm_save_workspace` + Emscripten-FS-pad
  - IndexedDB-helpers (`storeAsset`, `loadAsset`, `hasWarmSnapshot`) — Promise-vorm
- **`src/lib/build-blank-adf.js` nieuw** — pure-JS OFS-ADF-builder voor BASIC-injection:
  - `buildAdfWithBasFile(basContent, fileName, volumeLabel)` → 901120-byte ADF Uint8Array
  - Boot block + Root block (sec 880) + Bitmap (sec 881) + File-header (sec 882) + Data-block (sec 883)
  - Correcte OFS-checksums (sum mod 2^32, negated)
  - Amiga-string-encoding (length-prefix BCPL-stijl) + amigaHash voor dir-hash-tabel
  - Limiet v0.0.4: 488 bytes (1 OFS data-block) — voldoende voor HELLO WORLD
- **`esbuild.config.mjs` herschreven** met dev-server modus:
  - `npm run dev` → context.serve op :8000 + watch op src/
  - `npm run build` → één-shot productie-bundle (minified)
  - HTML-routes worden ge-copy-ed bij elk run; vendor/vamigaweb/ check + warning bij ontbreken
  - 5 entry-points (wasm-bridge, build-blank-adf, quick-launch, setup, library)
- **`package.json` scripts** bijgewerkt:
  - `dev` / `build` → `node esbuild.config.mjs [--dev]`
  - `build:all` → `build:wasm + build` (one-shot full pipeline)
- **Smoke-test-knop op `/basic/`** — drukt `init()` af en toont aantal beschikbare cwrap-bindings. Bewijs van leven vóór sub-step 5 live test.
- **`src/basic/quick-launch.js`** gebruikt nu echte API: `init`, `getBindings`, `hasWarmSnapshot`, `buildAdfWithBasFile`. Toont ADF-byte-count bij `.bas`-drop (sub-step 5 voegt restore + loadFile + scheduleKey toe).

### Decided
- Loading-strategie: **classic Emscripten Module + onRuntimeInitialized-callback** (geen `-sMODULARIZE` switch in CMakeLists). Werkt direct met onze pinned vAmigaWeb-commit.
- ADF-builder is bewust apart van vAmigaWeb-vendor-code (P-AMH-09: BASIC als first-class use-case; eigen JS-tool).
- Multi-block file-support (>488 bytes) uitgesteld naar v0.0.5 — eerst end-to-end bewijzen met klein bestandje.
- COOP+COEP-headers in dev-server **nog niet geactiveerd** (esbuild's serve-API biedt geen direct headers-API; sub-step 5 voegt eigen middleware-laag toe als nodig — voor nonworker-mode niet kritiek).

### Verified
- `node --check` op alle JS-files passt: wasm-bridge, build-blank-adf, quick-launch, setup, library, esbuild.config.mjs
- ADF-builder structuur volgens Laurent Clévy's ADF-spec + Aminet ADFLib refs: SECTOR_SIZE=512, SECTORS=1760, ROOT_BLOCK=880, OFS data-payload=488 bytes/block

### Not yet (sub-step 5)
- Live test van smoke-test in browser (vereist `npm install` + `npm run dev`)
- Volledige BASIC-flow end-to-end met user-supplied KS 1.3 + WB 1.3 + AmigaBASIC binary
- Warm-snapshot-bake-flow in `src/basic/setup.js` (vereist sequenced boot + AmigaBASIC-launch)
- AmigaKeyboard rawkey-codes mapping (`src/lib/amiga-keymap.js`) voor scheduleKey
- Multi-block ADF-builder voor files >488 bytes
- COOP+COEP-headers in dev-server (alleen als worker-mode in v0.x)

## [0.0.3-Flashback] — 2026-05-31 (v0.0.2.x sub-step 3: WASM-build werkt, eerste artefact)

> Eerste echte WASM-build → "Geen build zonder bump" → VERSION-bump 0.0.2-CannonFodder → 0.0.3-Flashback.
> Codenaam: **Flashback** (Delphine Software 1992, rotoscope-action — "flash"compile + retro-doorbraak).
> Kleur: **Groen +0.0.1** (pipeline-uitvoer van eerder genomen v0.0.2-besluit; geen nieuwe architectuur).

### Added
- **vAmigaWeb WASM-build werkend** via `tools/build-wasm.sh`
  - `dist/vendor/vamigaweb/vAmiga.js`   (106 KB Emscripten glue)
  - `dist/vendor/vamigaweb/vAmiga.wasm` (8.77 MB Amiga-emulator binary)
- `tools/build-wasm.sh`: idempotente pipeline (emsdk source + cmake configure + cmake build + copy naar dist/)
- `package.json` `build:wasm` script wijst nu naar werkende pipeline (`bash tools/build-wasm.sh`)
- `.gitignore` uitgebreid met vAmigaWeb-build-uitvoer-artefacten in submodule (`vAmiga.html/js/wasm`, `sw.js`)

### Changed
- `src/wasm-bridge.js`: stubs nu gelabeld met concrete export-naam uit CMakeLists EXPORTED_FUNCTIONS (`_wasm_loadFile`, `_wasm_save_workspace`, `_wasm_load_workspace`, `_wasm_auto_type`, `_wasm_joystick`). Echte `cwrap`-binding komt in sub-step 4.
- `src/wasm-bridge.js`: `crossOriginIsolated` is geen hard-requirement meer (nonworker-build vereist géén SharedArrayBuffer); check verplaatst naar enkel-bij-worker-mode

### Verified
- emcc 5.0.7 + cmake 4.3.3 + C++20: vAmigaWeb compileert clean op macOS arm64 (Darwin 25.3.0)
- Build-tijd warm-cache: ~1 minuut; cold-cache (eerste sysroot-libs): ~3-4 min
- Build-dir: 92 MB (incl. intermediates; alleen 8.87 MB output-artefacten relevant voor runtime)
- Géén `_wasm_mountDH` of vergelijkbare hostfs-export → bevestigt fallback-strategie sub-step 4: on-the-fly ADF-rebuild bij `.bas`-injection

### Decided (concretisering sub-step 4)
- vAmigaWeb gebruikt `_wasm_loadFile` voor disk/cart-import (ondersteunt ADF, ROM, etc.). BASIC-mode-flow: bouw on-the-fly leeg ADF met FFS-volume `BAS`, schrijf `launch.bas` erin, geef aan `_wasm_loadFile` met df-target. Geen native hostfs-koppeling nodig.
- vAmigaWeb-thread-mode = **nonworker** (default). Geen COOP+COEP-headers verplicht voor v0.0.3. Voordeel: deploy-vriendelijk (icthorse.nl static-hosting werkt zonder header-tweaks). Switch naar worker-mode = v0.x feature-keuze.

### Not yet (v0.0.2.x sub-steps 4-5)
- Sub-step 4: dynamic import van `dist/vendor/vamigaweb/vAmiga.js` + Module()-instantiation + cwrap-bindings voor de ~10 essentiele functies
- Sub-step 5: warm-snapshot-bake (via `_wasm_save_workspace`) + ADF-rebuild voor `.bas`-injection + e2e HELLO WORLD-test

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
