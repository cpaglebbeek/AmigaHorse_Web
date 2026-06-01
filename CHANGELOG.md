# Changelog — AmigaHorse_Web

Format: [Keep a Changelog](https://keepachangelog.com/). Codenamen uit pool `Meta_AmigaHorse/CLAUDE.md`.

## [0.0.17-LotusEspritTurbo] — 2026-06-01 (bugfix: bake mounted disk maar Kickstart re-scande DF0 niet → reset toegevoegd)

> Codenaam **Lotus Esprit Turbo** (Magnetic Fields / Gremlin 1990 — race-game met "reset+go" restart-mechanic). **Geel bugfix** (bake-flow timing-volgorde, JS↔Core protocol).

### Fixed
- **Bake-snapshot bevatte alleen Kickstart-prompt, geen Workbench.** Root cause: ROM-flash in `loadFile('kick13.rom_file')` doet **auto-powerOn+run** (main.cpp:1812-1813). Daarna toont Kickstart 1.3 de "insert Workbench disk"-prompt. Pas vervolgens mount setup.js de WB1.3 ADF in DF0:. Kickstart blijft op de prompt hangen — disk-insert-event post-boot wordt door K1.3 niet altijd dynamisch herkend zonder reset. Symptoom (zichtbaar dankzij v0.0.16 renderer-fix): re-bake-canvas toonde "AMIGA ROM V1.3" + hand-met-floppy ("insert disk"-icoon) zowel tijdens bake-wait áls na Quick-Launch-restore.
- Fix: `bindings.reset()` (= `hardReset()` in main.cpp:1900-1903) na stage 4 disk-mount. Kickstart herstart, DF0 bevat nu al de WB-ADF → boot vanaf WB.

### Changed
- `src/basic/setup.js`:
  - Nieuwe stage `4b.reset (re-scan DF0)` direct na stage 4 (loadFile WB)
  - Sleep verhoogd van 8 → 12 seconden (WB 1.3 first-time boot van emulated 880KB OFS-disk duurt typisch 8-15 sec)
  - Validatie toegevoegd op wbResult: warn als non-empty (disk-branch success returnt `""`)
- Status-message aangepast naar "~12 sec" zodat user weet wat te verwachten

### RCA (drie-niveaus per CLAUDE.md)
- **Functioneel:** Bake voltooide zonder error maar warm-snapshot bevatte verkeerde state (Kickstart-prompt ipv AmigaBASIC). Pas zichtbaar nadat v0.0.16-renderer-fix het beeld correct rendert.
- **Technisch:** Order-of-operations: ROM-flash → auto-powerOn+run → Kickstart toont insert-disk → daarna pas disk geïnsert in DF0. Kickstart 1.3 polled niet dynamisch op disk-insert na powerOn → blijft op prompt. hardReset() forceert herboot waarbij DF0 al disk heeft.
- **Architectonisch:** vAmigaWeb's `wasm_loadFile`-ROM-branch combineert "flash ROM" + "powerOn" + "run" in één call — handig voor end-user maar problematisch voor scripted bake-flows waar disk ná ROM gemount wordt. Alternatief had geweest: ROM-branch zonder auto-run, of `wasm_load_disk_before_rom`-API. Geen van beide bestaat → reset-after-disk is de pragmatische workaround. Toe te voegen aan `docs/CORE_API_CONTRACT.md`.

### Verified (statisch)
- ✓ `node --check src/basic/setup.js`
- ✓ `wasm_reset()` definitie main.cpp:1900-1903 → `hardReset()` (full reset)
- ✓ Reset-binding bestond al sinds v0.0.6 (wasm-bridge.js:124 `cwrap('wasm_reset', 'void', [])`)

### Te verifieren door user
- Re-bake `/basic/setup.html` → bake-canvas moet nu tonen:
  - Eerst: Kickstart insert-disk (kort, vóór reset)
  - Dan: reset-flicker
  - Dan: disk-twirl boot-animatie (~3 sec)
  - Dan: WB 1.3 grijs scherm met menu bar
  - Dan: AmigaBASIC-window open na keyboard `AmigaBASIC<RET>` (of na muis-double-click)
- Console-logs: `[bake] 4b.reset (re-scan DF0)` stage zichtbaar
- Na bake → Quick BASIC drop sample.bas → canvas toont **echte AmigaBASIC-output**, niet meer Kickstart-prompt

### Open na v0.0.17
- Mogelijk volgend: 12 sec is nog te kort → verleng naar 15 of meer
- Mogelijk volgend: `AmigaBASIC<RET>` typing-sequence triggert niet (Workbench CLI vs Shell verschil) → muis-double-click stage 8 wordt dan de fallback
- Audio nu zou ook moeten werken (CPU stept correct, snapshot is geldig)
- `docs/CORE_API_CONTRACT.md` (v0.0.18+) — bake-flow protocol formaal documenteren

## [0.0.16-StuntCarRacer] — 2026-06-01 (bugfix: scrambled output + canvas height=0px race)

> Codenaam **Stunt Car Racer** (Geoff Crammond / MicroProse 1989, beruchte ramp-jumps — "ontspoord beeld dat weer rechtgetrokken wordt"). **Geel bugfix** (twee JS↔Core binding-bugs in CanvasRenderer).

### Fixed
- **Bug A — Canvas onzichtbaar na 1e drop:** `canvas-renderer.js` `fitToContainer()` werd door `quick-launch.js:119` direct na `start()` aangeroepen, vóór het eerste tick had gelopen. `lastSize` was nog `{w:0, h:0}` → ratio=0 → `canvas.style.height = '0px'` → canvas heeft géén zichtbare hoogte. Symptoom: na 1e drop bleef dropzone overlay zichtbaar (canvas eronder = onzichtbaar). 2e drop "werkte" omdat lastSize inmiddels gevuld was door overlevende ticks.
- **Bug B — Scrambled output:** vAmiga's pixel-buffer is **altijd HPIXELS=912 wide** (vol Amiga-raster incl. HBLANK/VBLANK/overscan), ongeacht zichtbaar window. Wij lazen `clipped_w × clipped_h` lineair vanaf base-pointer → ontbrekende stride → diagonale shearing. Symptoom: zodra canvas wél zichtbaar werd (2e drop), bevatte het een totaal vervormd beeld.
- **Root mechanisme**: vAmigaWeb signaleert het zichtbare window via `js_set_display(xOff, yOff, w, h)` EM_ASM callback (main.cpp:181,1473). Wij hadden die in v0.0.12-ProjectX gestub'd als no-op om de `ReferenceError` te suppressen — daardoor wist onze renderer niet welk gedeelte van de 912×313 textuur te tonen.

### Changed
- `src/wasm-bridge.js`: `js_set_display`-stub vervangen door echte capture in `window.__vamigaViewport = {xOff, yOff, w, h, dirty}`. Defaults uit vAmigaWeb's eigen `vAmiga_canvas.js` (xOff=18, yOff=32, w=886, h=281) tot eerste C++-call het overschrijft.
- `src/lib/canvas-renderer.js`: volledige rewrite van blit-logica (~50 regels) — leest pixel-buffer met **stride = HPIXELS × 4 bytes/row**, vanaf `pixelBuffer + yOff*HPIXELS*4`, voor `HPIXELS × clipped_h` aan bytes. Crop tot visible window via `putImageData(image_data, -xOff, 0, xOff, 0, clipped_w, clipped_h)` — exact het pattern uit vAmigaWeb's eigen `render_canvas()` (`js/vAmiga_canvas.js:20-33`).
- `canvas-renderer.js` `fitToContainer()`: lazy — bewaart `containerMaxWidth`, past CSS pas toe ná `firstFrameRendered=true` flag. Voorkomt height=0 race definitief.
- HPIXELS/VPIXELS als module-constants (912/313) — komt uit `Core/Infrastructure/Constants.h`.

### RCA (drie-niveaus per CLAUDE.md)
- **Functioneel:** Eerste .bas-drop = onzichtbare canvas (dropzone-tekst bleef). Tweede drop = canvas zichtbaar maar scrambled. Beide bugs sloegen verschillende lagen aan maar manifesteerden gelijktijdig.
- **Technisch:** Twee onafhankelijke JS↔Core-protocol-faults: (1) timing-aanname over `lastSize` in `fitToContainer`; (2) verkeerde aanname dat pixel-buffer = `renderWidth × renderHeight` (in werkelijkheid altijd HPIXELS-wide, en `wasm_get_render_width` = clipped_width, dat is window-size niet stride).
- **Architectonisch:** vAmigaWeb's pixel-protocol vereist 5 informatiestukken (HPIXELS-stride, pixelBuffer-base, xOff, yOff, clipped_w, clipped_h) waarvan alleen 2 via cwrap (`pixelBuffer`, `renderWidth/Height`) — de rest komt **alleen** via EM_ASM-callback. Stubben van die callback = protocol-breaking. `docs/CORE_API_CONTRACT.md` (geplanned v0.0.16+) moet expliciet vermelden: js_set_display is NIET optioneel als je eigen renderer schrijft.

### Verified (statisch)
- ✓ `node --check src/lib/canvas-renderer.js` + `src/wasm-bridge.js`
- ✓ vAmigaWeb HPIXELS-constante bevestigd: `Core/Infrastructure/Constants.h:90` (`static const isize HPIXELS = 912;`)
- ✓ vAmigaWeb's `render_canvas()` reference pattern in `js/vAmiga_canvas.js:20-33` gevolgd: zelfde offset-berekening, zelfde putImageData-crop-args
- ✓ EM_ASM call site main.cpp:181,1473 stuurt `(xOff, yOff, clipped_width*TPP, clipped_height)` — TPP=1 in onze build dus 1:1

### Te verifieren door user
- Hard-refresh + Quick BASIC drop sample.bas:
  - 1e drop al direct zichtbaar canvas met juiste afmetingen (geen height=0)
  - Beeld is **niet scrambled**: tekst Workbench/BASIC leesbaar, geen diagonale shearing
  - Console: `[vAmiga→js] js_set_display: {xOff, yOff, w, h}` verschijnt binnen ~1 sec
  - Console: `[canvas-renderer] pixel-format gedetecteerd: RGBA` of `ARGB`

### Open na v0.0.16
- Bake-flow visueel: bake-canvas zou nu ook correct moeten renderen tijdens 8-sec WB-boot
- Audio (v0.0.7 ScriptProcessorNode) moet ook werken zodra emulator stept
- Dropzone-UX: na succesvolle 1e drop zou dropzone-tekst kunnen wijzigen naar "Drop een andere .bas om te vervangen" (lage prio)
- `docs/CORE_API_CONTRACT.md` (architectuur, v0.0.17+) — pixel-protocol formaal documenteren

## [0.0.15-Populous] — 2026-06-01 (bugfix: render-loop miste wasm_execute() — leeg/bevroren canvas)

> Codenaam **Populous** (Bullfrog 1989, god-game — fitting "creator-zonder-tijd-stepping zou een lege wereld maken"). **Geel bugfix** (frame-step contract met Core ontbrak).

### Fixed
- **Geen scherm-output na bake-success + Quick BASIC drop.** Root cause: vAmigaWeb vereist **twee** WASM-calls per browser-frame (zie `external/vamigaweb/js/vAmiga_ui.js:1947` + `:1976`):
  1. `wasm_execute()` → `emu->emu->computeFrame()` — CPU/chipset/disk-IO stepping
  2. `wasm_draw_one_frame(now)` → framebuffer-sync + dimensies + warping-handling
- Onze `CanvasRenderer._tick()` (sub-step 6) riep **alleen** `drawOneFrame` aan → emulator rustte stil → framebuffer bevroren op moment-van-snapshot (of leeg bij nieuwe boot).
- `src/lib/canvas-renderer.js`: `this.bindings.execute()` toegevoegd vóór `drawOneFrame(now)` in `_tick`. Cwrap-binding voor `execute` was al beschikbaar sinds v0.0.6 maar werd nooit aangeroepen.

### RCA (drie-niveaus per CLAUDE.md)
- **Functioneel:** User-bake voltooid + sample.bas geaccepteerd + status "Programma draait!" zichtbaar, maar canvas bleef leeg.
- **Technisch:** vAmigaWeb's frame-protocol is **niet self-documenting** — geen comment in main.cpp dat `wasm_execute` per frame moet worden aangeroepen. Achter te halen via reverse-engineering van hun `vAmiga_ui.js:do_animation_frame()`. Onze v0.0.6-implementatie ging er ten onrechte van uit dat `wasm_draw_one_frame` ook stepping deed.
- **Architectonisch:** `docs/CORE_API_CONTRACT.md` (v0.0.16+) moet de frame-loop-volgorde expliciet documenteren: `execute → drawOneFrame → optional pixelBuffer read`.

### Verified (statisch)
- ✓ `node --check src/lib/canvas-renderer.js`
- ✓ Live bundle `dist/chunk-KGJD65ML.js`: `this.bindings.execute(); this.bindings.drawOneFrame(now);` zichtbaar
- ✓ Volgorde correct (execute vóór drawOneFrame, zoals vAmigaWeb's eigen do_animation_frame)
- ✓ vAmigaWeb main.cpp:392 `wasm_execute` body bevestigd: `emu->emu->computeFrame() + counter++`

### Te verifieren door user
- Hard-refresh + post-bake → Quick BASIC drop sample.bas → canvas moet nu **bewegen** (Workbench-icons of BASIC-prompt zichtbaar)
- FPS-teller in console: `[canvas-renderer] pixel-format gedetecteerd: RGBA/ARGB` zou nu binnen ~1 sec moeten verschijnen (eerste frame data)
- Mogelijk volgend: bake-flow zelf renderde ook al canvas; als `bake-canvas` nu wel beweegt → bake werkt visueel ook + 8-sec WB-boot-wait is daadwerkelijk visueel zichtbaar

### Niet-fix (v0.0.16+)
- `docs/CORE_API_CONTRACT.md` — frame-loop-volgorde + alle cwrap+EM_ASM-contracten documenteren
- Audio-sink kan in zelfde tick optimisatie krijgen (sub-step 7 ScriptProcessorNode pull is async, geen wijziging nodig)

## [0.0.14-IKPlus] — 2026-06-01 (bugfix: stale size-gate Quick BASIC weigert valide multi-block .bas)

> Codenaam **IK+** (Archer Maclean 1988 Amiga port — fitting "knock out the stale gate"). **Geel bugfix** (stale UI-text + foutieve size-gate).

### Fixed
- `src/basic/quick-launch.js` `handleBasFile()` size-gate gebruikte nog `adfInternal.OFS_DATA_PER_BLOCK` (488 bytes = single OFS data-block, oude v0.0.6-grens). Sinds **v0.0.8-DefenderOfTheCrown** ondersteunt `build-blank-adf.js` multi-block-chains tot `MAX_FILE_SIZE = 35136` bytes (~34 KB, 72 OFS data-blocks). Valide .bas-files >488 bytes werden ten onrechte geweigerd met verouderde melding "v0.0.6 limiet ... Multi-block-support komt v0.0.7".
- Gate-check vervangen door `adfInternal.MAX_FILE_SIZE`.
- Foutmelding herschreven met actuele cijfers + suggestie (CHAIN/MERGE voor grotere programma's i.p.v. fout versie-belofte).
- Tussentekst "alleen AmigaBASIC v0.0.6" → "alleen AmigaBASIC ondersteund" (versie-referentie verwijderd, geldt ook in toekomst).

### RCA (drie-niveaus per CLAUDE.md)
- **Functioneel:** User die een realistisch BASIC-programma (>488 bytes) drop kreeg een foutmelding die suggereerde dat de feature nog moest komen — feature was er al sinds v0.0.8.
- **Technisch:** Sub-step 8 (v0.0.8) breidde de ADF-builder uit naar multi-block maar de **consumer** (quick-launch.js) bleef de single-block-constant gebruiken. Klassieke "API-change zonder caller-update".
- **Architectonisch:** Géén gedeelde "limits"-module met centrale `MAX_FILE_SIZE`-export en assertion bij caller-zijde. Voor v0.0.15+: overweeg `src/lib/limits.js` met semantische namen i.p.v. `_internal`-via-ADF-builder.

### Verified (statisch)
- ✓ `node --check src/basic/quick-launch.js`
- ✓ Live bundle: 0 hits voor "v0.0.6 limiet" en "komt v0.0.7"
- ✓ Live bundle: nieuwe `_internal.MAX_FILE_SIZE`-referentie aanwezig + nieuwe foutmelding tekst zichtbaar
- ✓ `_internal` export bevestigd `MAX_FILE_SIZE = 35136` + `MAX_DATA_BLOCK_PTRS = 72` + `OFS_DATA_PER_BLOCK = 488`

### Niet-fix
- Géén nieuwe `limits.js`-module aangemaakt (out-of-scope deze Geel bugfix; gemarkeerd voor v0.0.15+)
- Géén tests toegevoegd (geen bestaande test-suite voor quick-launch)

## [0.0.13-SuperFrog] — 2026-06-01 (bugfix: FS-bypass voor save/restore-state via wasm_take_user_snapshot)

> Codenaam **Super Frog** (Team17 1993, platformer — fitting "frozen-frame snapshot" en "leap over the FS-puddle"). **Geel bugfix** (JS↔WASM binding-bug, vervolg op v0.0.12-ProjectX).

### Fixed
- **`TypeError: Cannot read properties of undefined (reading 'readFile')`** in stage 9 (`saveStateToBuffer`) na muis-double-click. Root cause: `Module.FS` is `undefined` omdat vAmigaWeb's `external/vamigaweb/CMakeLists.txt:54,91` exporteert alleen `cwrap,ccall,HEAPU8,HEAPF32` — **`FS` ontbreekt** in `EXPORTED_RUNTIME_METHODS`.
- `src/wasm-bridge.js` `saveStateToBuffer()` herschreven: nieuwe route via `wasm_take_user_snapshot()` (main.cpp:1257) die JSON returnt met directe HEAP-pointer `{"address": <u8*>, "size": <bytes>, "width": <px>, "height": <px>}` → `Module.HEAPU8.subarray(address, address+size)` → `new Uint8Array(view)` (expliciete copy ivm HEAP-realloc-risico).
- `src/wasm-bridge.js` `restoreStateFromBuffer()` herschreven: gebruikt nu `loadFile('snapshot.snap', buf, 0)` — vAmigaWeb's `_wasm_loadFile` (main.cpp:1722) herkent snapshots via `Snapshot::isCompatible(blob,len) && extractSuffix(filename)!="rom"` → directe `amiga.loadSnapshot()`-call, géén FS.
- Twee nieuwe cwrap-bindings: `takeUserSnapshotRaw` + `deleteUserSnapshotRaw` (cleanup tussen takes).

### Removed
- `Module.FS.readFile()` + `Module.FS.writeFile()` + `Module.FS.unlink()` calls (all 4 instances) volledig verwijderd uit save/restore-pad.
- Dependency op `wasm_save_workspace` / `wasm_load_workspace` voor warm-snapshot-route geëlimineerd (cwrap-bindings blijven beschikbaar voor toekomstig workspace-gebruik, maar niet meer in default save-pad).

### RCA (drie-niveaus per CLAUDE.md)
- **Functioneel:** Bake-flow strandde op stage 9 met TypeError nadat de muis-double-click was uitgevoerd; warm-snapshot werd nooit opgeslagen, redirect naar `/basic/` triggerde niet.
- **Technisch:** Onze `saveStateToBuffer`-implementatie (sub-step 5) ging er ten onrechte van uit dat Emscripten's `Module.FS` standaard beschikbaar was. vAmigaWeb's CMakeLists bewust beperkt de runtime-exports voor binary-size. Defensieve check `if (!Module.FS) throw` was nooit ingebouwd. De alternatieve `wasm_take_user_snapshot`-API gaf vanaf v0.0.2 al een FS-vrije route — die was over het hoofd gezien.
- **Architectonisch:** Save-state-formaat-keuze (snapshot vs workspace) is nu impliciet anders dan eerder gepland. Snapshot = single point-in-time amiga-state (incl. CPU+mem+chipset), workspace = bredere config (incl. mounted disk-paths). Voor BASIC warm-snapshot is snapshot voldoende (we hebben mounted-disk-state niet nodig na restore). `docs/CORE_API_CONTRACT.md` (v0.0.14+) moet beide routes documenteren + wanneer welke kiezen.

### Verified (statisch — geen browser-test door agent)
- esbuild watch-rebuild bevestigd: `dist/chunk-R2QVYZEQ.js` bevat `wasm_take_user_snapshot` (2 hits) + nieuwe `saveStateToBuffer`-body; **0 hits** voor `FS.readFile|FS.writeFile` in alle live chunks
- `node --check src/wasm-bridge.js` ✓
- vAmigaWeb main.cpp:1257-1295 `wasm_take_user_snapshot` returnt JSON-schema bevestigd
- vAmigaWeb main.cpp:1722-1745 Snapshot-loadFile-branch bevestigd (extension `≠ "rom"`-guard match via `.snap`-naam)
- Function hoist-order in `bindFunctions`: `takeUserSnapshotRaw` (regel 144) → `loadFile` (163) → `saveStateToBuffer` (186) → `restoreStateFromBuffer` (217) — TDZ-vrij

### Te verifieren door user
- F12 → Console open + hard-refresh (`Cmd+Shift+R`) vóór bake-klik
- Verwacht: stage 9 `→ result: Uint8Array(~1MB)` (was: TypeError)
- Snapshot-JSON in console (vAmigaWeb's stdout via Module.print): `wasm_pull_user_snapshot_file` + `data header bytes= ...` + `return => {"address":..., "size":..., "width":..., "height":...}`
- Daarna stage 10 `storeAsset-snapshot` → redirect naar `/basic/`
- Bij Quick BASIC drop `.bas` post-bake: nieuwe `restoreStateFromBuffer` via `loadFile('snapshot.snap', buf, 0)` te valideren (snapshot-branch in `_wasm_loadFile` herkent header-magic onafhankelijk van filename mits extension ≠ rom)

## [0.0.12-ProjectX] — 2026-06-01 (bugfix: ontbrekende JS-callbacks voor vAmigaWeb EM_ASM)

> Codenaam **Project-X** (Team17 1992, shoot-em-up tegen alien-waves — fitting voor "ontbrekende callbacks" die golfgewijs uit vAmigaWeb's EM_ASM schieten). **Geel bugfix** (JS↔WASM binding-bug, vervolg op v0.0.11-AlienBreed).

### Fixed
- **`ReferenceError: js_set_display is not defined`** tijdens bake-flow (user-reported na v0.0.11). Root cause: vAmigaWeb roept via `EM_ASM` twee JS-callbacks aan die alleen in hun eigen `external/vamigaweb/js/vAmiga_canvas.js` gedefinieerd staan (met jQuery + `<canvas id="canvas">`-aanname). Wij laden die niet — eigen `CanvasRenderer` werkt anders (rAF + `wasm_pixel_buffer` cwrap).
  - `external/vamigaweb/main.cpp:181` en `:1473`: `EM_ASM({js_set_display($0,$1,$2,$3); scaleVMCanvas();}, ...)` — getriggerd bij viewport-geometrie-update (PAL/NTSC-detect, mode-change). v0.0.11-fix activeerde de ROM-flash → boot → viewport-tracking → callback-crash.
- `src/wasm-bridge.js` `init()`: 2 no-op stubs op `window` toegevoegd vóór `<script src=vAmiga.js>` injectie:
  - `window.js_set_display(xOff, yOff, w, h)` — `console.debug` log, geen render-actie (renderer leest dimensies direct via `wasm_get_render_width/height`)
  - `window.scaleVMCanvas()` — pure no-op (DOM-sizing in onze renderer via `fitToContainer`)
- Stubs alleen gezet als nog niet bestaand (`typeof === 'undefined'`-guard) → conflictvrij bij host-page-override.

### RCA (drie-niveaus per CLAUDE.md)
- **Functioneel:** Bake-flow strandde direct na ROM-flash; user kreeg `ReferenceError`. Dit was alleen zichtbaar nadat v0.0.11 de ROM-branch correct activeerde — eerder werd de viewport-callback nooit gehit omdat het board nooit aan stond.
- **Technisch:** vAmigaWeb gaat ervan uit dat hun `js/vAmiga_canvas.js` (+ jQuery + DOM-element `canvas`) is geladen. Wij integreren alleen `vAmiga.js`/`vAmiga.wasm` als headless emulator-core en bouwen eigen render-pipeline. `EM_ASM`-call-sites in main.cpp zijn níet defensief gewrapt zoals `send_message_to_js` (regel 589: `if typeof === 'undefined' return`); ze gooien `ReferenceError`.
- **Architectonisch:** Onze JS↔WASM-laag heeft géén expliciete inventaris van **JS-callbacks die vAmigaWeb-WASM verwacht**. Dit type fout cascadeert naarmate méér code-paden van vAmiga-Core worden geactiveerd. Toe te voegen aan `docs/CORE_API_CONTRACT.md` (v0.0.13+): twee-richtingen contract — (a) cwrap-exports JS→WASM, (b) globale JS-functies WASM→JS via EM_ASM.

### Verified (statisch — geen browser-test door agent)
- esbuild watch-rebuild bevestigd: `dist/chunk-4SFFG4OR.js` bevat live stubs (3 hits voor `js_set_display`)
- `node --check src/wasm-bridge.js` ✓
- vAmigaWeb main.cpp:181,1473 zijn de **enige** twee EM_ASM-sites die `js_set_display` aanroepen (geverifieerd via `grep -n js_set_display external/vamigaweb/main.cpp`)
- Andere EM_ASM-callbacks (`message_handler` op regel 587/599, `use_ntsc_pixel` op 714) zijn defensief gewrapt of globale variabelen — geen crash

### Te verifieren door user
- F12 → Console open vóór bake-klik
- Verwacht: stage 2 → `result: "rom"` ✓, stage 3 → `result: ""` ✓, daarna **`[vAmiga→js] js_set_display(stub): {xOff, yOff, w, h}` debug-regel(s)** zichtbaar zonder crash
- Bake-flow loopt door naar stage 9 saveStateToBuffer ≥ 1MB
- Bij nieuwe failure: stuur exacte stage + stack-trace

## [0.0.11-AlienBreed] — 2026-06-01 (bugfix: bake-flow ROM-flash + diagnostics-pass)

> Codenaam **Alien Breed** (Team17 1991, silent threat in dark corridors — fitting voor een silent extension-mismatch bug die door 6 sub-steps onopgemerkt bleef). **Geel bugfix** (JS↔WASM binding-bug).

### Fixed
- **Root cause "undefined error bij start" (v0.0.10 open debug-punt):** vAmigaWeb's `wasm_loadFile` (zie `external/vamigaweb/main.cpp:1748,1823`) gebruikt **filename-extension als type-discriminator** — `.rom_file` voor ROMs, `.rom_ext_file` voor ext-ROMs, anders disk/snapshot/HDF. Onze `setup.js` stuurde `'kick13.rom'` → géén branch-match → Kickstart nooit geflashed → downstream silent fail (powerOn op niet-gereed board, lege save-state, TypeError op undefined property).
- `src/basic/setup.js:104` (now diagnostics-wrapped): filename `'kick13.rom'` → `'kick13.rom_file'`. Drive-number `0xFF` blijft (ROM-branch gebruikt `drive_number` niet, alleen disk-branches op regel 1560-1583).

### Added (diagnostics-pass)
- `bakeWarmSnapshot()` wrapt nu **elke stage** in een `stage(label, fn)` helper met `console.group` + `console.time` + result-log + fail-handler met stack-trace.
- 10 genummerde stages: `1.init-vamiga` → `1.get-bindings` → `2.loadFile-kick` → `3.powerOn(1)` → `4.loadFile-wb` → `5.get-module` → `6.run` → `7.playSequence-AmigaBASIC` → `8.scriptedDoubleClick` → `9.saveStateToBuffer` → `10.storeAsset-snapshot`.
- Sanity-check op stage 2 result: warning als `loadFile` niet `"rom"` returnt (main.cpp:1794+1820 conventie).
- Sanity-check op stage 3 result: warning bij non-empty error-string uit `wasm_power_on` (main.cpp:2205 conventie).
- Header-bytes van kick-buffer + size + WB-buffer-size in console (forensic-trail).

### RCA (drie-niveaus per CLAUDE.md)
- **Functioneel:** Asset-Setup wizard liep stilzwijgend dood op stap 4; user kreeg generieke "undefined error" zonder stage-attribution.
- **Technisch:** `wasm-bridge.js:35` docstring claimde `load_disk()` doet "auto-detect file-type". Dat klopt voor disks + snapshots + HDF, maar **niet voor ROMs** — die vereisen `.rom_file` of `.rom_ext_file` extension. Verkeerde aanname uit sub-step 4-implementatie.
- **Architectonisch:** Géén filename-naming-contract gedocumenteerd tussen JS-laag en Core. Bij vAmigaWeb-submodule-bump kan dit silent regressen. Toe te voegen aan `docs/CORE_API_CONTRACT.md` in sub-step 11+ (niet nu — buiten scope deze bugfix).

### Verified (statisch — geen browser-test door agent)
- `node --check src/basic/setup.js` ✓
- vAmigaWeb main.cpp:1748 verifieert `extractSuffix(filename)=="rom_file"` branch-match
- vAmigaWeb main.cpp:1542-1548 `extractSuffix` returnt substring na laatste `.`
- Drive-number ongebruikt in ROM-branch (regel 1748-1820), alleen in disk-branches (regel 1560-1583)

### Te verifieren door user
- F12 → Console open vóór bake-button-klik
- Verwacht: alle 10 stages groene check-marks; stage 2 result = `"rom"`; warm-snapshot ≥ 1MB
- Bij failure: exacte stage + stack-trace nu zichtbaar voor v0.0.12-fix

## [0.0.10-Hunter] — 2026-06-01 (docs: AmigaBASIC-source-guide)

> Codenaam **Hunter** (Activision 1991, open-world Amiga adventure — fitting "where to find = hunt"). Groen +0.0.1.

### Added
- **`src/where-to-get-amigabasic.html`** — eigenstandige info-pagina met legale bronnen (Cloanto Amiga Forever, eigen rip, tweedehands) + per-wizard-stap-uitleg + extract-tools (xdftool / ADFOpus / adf.io) + sub-step-10-roadmap
- Link vanuit `/basic/setup.html` (in compat-banner) + `/basic/index.html` (nav-sectie)
- `esbuild.config.mjs` HTML_ROUTES uitgebreid

### Verified
- Dev-server :5173 serveert `/where-to-get-amigabasic.html` (4894b)
- Links vanuit setup.html + basic/index.html correct gerendered
- H1/H2-structuur valid

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
