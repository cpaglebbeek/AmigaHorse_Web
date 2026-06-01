// AmigaHorse_Web — wasm-bridge.js (v0.0.4-Speedball2, sub-step 4)
//
// Concrete cwrap-bindings rondom vAmigaWeb's WASM-exports + IndexedDB-helpers
// + workspace save/restore (via Emscripten-FS pad).
//
// vAmigaWeb (https://github.com/vAmigaWeb/vAmigaWeb) is GPL-3.0; submodule
// `external/vamigaweb/` pinned commit c3c50d9 (v0.0.2.1).
//
// WASM-artefacten geproduceerd door tools/build-wasm.sh:
//   dist/vendor/vamigaweb/vAmiga.js     (106 KB Emscripten glue, classic-mode)
//   dist/vendor/vamigaweb/vAmiga.wasm   (8.77 MB Amiga-emulator binary)
//
// Loading-strategie: vAmiga.js is een classic-Emscripten-script (NIET ES-module).
// We pre-zetten window.Module met locateFile, injecteren <script src=vAmiga.js>,
// en wachten op Module.onRuntimeInitialized voordat we cwrap-bindings opstellen.
//
// Beschikbare cwrap-functies (uit main.cpp + EXPORTED_FUNCTIONS):
//   loadFile(name, buf, drive)       const char*  -- name + u8*buf + len + drive_number
//   run()                            void          -- start emulatie
//   halt()                           void          -- pauze
//   reset()                          void          -- soft reset
//   powerOn(on)                      const char*  -- 0=off, 1=on
//   scheduleKey(c1, c2, pressed, delay) void       -- keyboard scheduling
//   key(code, pressed)               void          -- direct key event
//   saveWorkspace(path)              char*         -- save-state naar FS-path
//   loadWorkspace(path)              void          -- restore-state vanaf FS-path
//   configure(option, value)         const char*  -- runtime config tweaks
//
// Workspace-flow (P-AMH-04):
//   1. saveStateToBuffer() = wasm_save_workspace('/tmp/snap.vamiga') + FS.readFile
//   2. restoreStateFromBuffer(buf) = FS.writeFile('/tmp/snap.vamiga', buf) + wasm_load_workspace
//
// BASIC-injection (P-AMH-09, geen mountDH):
//   on-the-fly OFS-ADF met launch.bas → wasm_loadFile(buf, df=1) → DF1: in Amiga
//   keyboard sequence: `LOAD "DF1:launch.bas"<CR>` + auto-RUN ? `RUN<CR>` : geen
//   keyboard codes via src/lib/amiga-keymap.js (sub-step 5)

const VAMIGA_BASE = '/vendor/vamigaweb';
const SCRIPT_URL = `${VAMIGA_BASE}/vAmiga.js`;

const STATE = {
  module: null,           // Emscripten Module instance (na onRuntimeInitialized)
  ready: false,
  bindings: null,         // { loadFile, run, halt, ... } na bindFunctions()
  loadPromise: null,      // gedeelde init()-promise (idempotent)
  warmSnapshotKey: 'basic-env-snapshot',
};

/**
 * Initialiseer vAmiga-WASM. Idempotent: meerdere calls geven dezelfde instance.
 *
 * Verwacht dat dist/vendor/vamigaweb/vAmiga.{js,wasm} bestaat (gegenereerd door
 * tools/build-wasm.sh, zie external/README.md).
 */
export function init() {
  if (STATE.ready) return Promise.resolve(STATE);
  if (STATE.loadPromise) return STATE.loadPromise;

  STATE.loadPromise = new Promise((resolve, reject) => {
    // Voorkom dubbele Module-globals
    if (window.Module && !window.Module._isAmigaHorseStub) {
      reject(new Error('window.Module al gezet door iets anders'));
      return;
    }

    // v0.0.12-ProjectX — JS-callbacks die vAmigaWeb via EM_ASM aanroept.
    // Originele vAmigaWeb laadt js/vAmiga_canvas.js met deze functies + jQuery.
    // Wij gebruiken eigen CanvasRenderer (rAF + pixelBuffer cwrap) dus stubben:
    //   js_set_display(xOff, yOff, w, h)  — viewport-geometrie callback (main.cpp:181,1473)
    //   scaleVMCanvas()                   — DOM-resize-call uit zelfde EM_ASM
    // No-op is veilig: onze renderer leest renderWidth/Height direct via cwrap.
    if (typeof window.js_set_display === 'undefined') {
      window.js_set_display = (xOff, yOff, w, h) => {
        console.debug('[vAmiga→js] js_set_display(stub):', { xOff, yOff, w, h });
      };
    }
    if (typeof window.scaleVMCanvas === 'undefined') {
      window.scaleVMCanvas = () => { /* no-op; eigen renderer doet sizing */ };
    }

    window.Module = {
      _isAmigaHorseStub: true,
      locateFile: (p) => `${VAMIGA_BASE}/${p}`,
      onRuntimeInitialized: () => {
        STATE.module = window.Module;
        STATE.bindings = bindFunctions(window.Module);
        STATE.ready = true;
        resolve(STATE);
      },
      onAbort: (reason) => {
        reject(new Error(`vAmiga onAbort: ${reason}`));
      },
      print: (msg) => console.log('[vAmiga]', msg),
      printErr: (msg) => console.warn('[vAmiga:err]', msg),
    };

    const s = document.createElement('script');
    s.src = SCRIPT_URL;
    s.onerror = () => reject(new Error(`Kan ${SCRIPT_URL} niet laden — heb je 'npm run build:wasm' gedraaid?`));
    document.head.appendChild(s);
  });

  return STATE.loadPromise;
}

/**
 * Bind alle relevante wasm_*-functies via cwrap.
 * Buffer-passing functies (loadFile / workspace) hebben handmatige _malloc + HEAPU8.set.
 */
function bindFunctions(Module) {
  const cwrap = Module.cwrap;

  // Emulator control
  const run = cwrap('wasm_run', 'void', []);
  const halt = cwrap('wasm_halt', 'void', []);
  const reset = cwrap('wasm_reset', 'void', []);
  const powerOn = cwrap('wasm_power_on', 'string', ['number']);
  const scheduleKey = cwrap('wasm_schedule_key', 'void', ['number', 'number', 'number', 'number']);
  const key = cwrap('wasm_key', 'void', ['number', 'number']);
  const configure = cwrap('wasm_configure', 'string', ['string', 'string']);
  const saveWorkspaceRaw = cwrap('wasm_save_workspace', 'string', ['string']);
  const loadWorkspaceRaw = cwrap('wasm_load_workspace', 'void', ['string']);

  // Render (sub-step 6)
  const drawOneFrame = cwrap('wasm_draw_one_frame', 'number', ['number']);
  const execute = cwrap('wasm_execute', 'void', []);
  const pixelBuffer = cwrap('wasm_pixel_buffer', 'number', []);
  const renderWidth = cwrap('wasm_get_render_width', 'number', []);
  const renderHeight = cwrap('wasm_get_render_height', 'number', []);
  const frameInfo = cwrap('wasm_frame_info', 'number', []);

  // Mouse (sub-step 6)
  const mouse = cwrap('wasm_mouse', 'void', ['number', 'number', 'number']);
  const mouseButton = cwrap('wasm_mouse_button', 'void', ['number', 'number', 'number']);

  // Joystick (sub-step 8) — vAmiga verwacht string "<port><event>"
  // events: PULL_UP/DOWN/LEFT/RIGHT, PRESS_FIRE, RELEASE_X/Y/XY/FIRE
  const joystick = cwrap('wasm_joystick', 'void', ['string']);

  // Snapshot (v0.0.13-SuperFrog — FS-bypass)
  // wasm_take_user_snapshot returnt JSON-string met directe HEAP-pointer:
  //   { "address": <u8*>, "size": <bytes>, "width": <px>, "height": <px> }
  // wasm_delete_user_snapshot vrijwaart de allocation tussen takes.
  const takeUserSnapshotRaw = cwrap('wasm_take_user_snapshot', 'string', []);
  const deleteUserSnapshotRaw = cwrap('wasm_delete_user_snapshot', 'void', []);

  // Audio (sub-step 6 skelet; echte sink sub-step 7)
  const setSampleRate = cwrap('wasm_set_sample_rate', 'void', ['number']);
  const updateAudio = cwrap('wasm_update_audio', 'void', ['number']);
  const leftChannelBuffer = cwrap('wasm_leftChannelBuffer', 'number', []);
  const rightChannelBuffer = cwrap('wasm_rightChannelBuffer', 'number', []);
  const getSoundBufferAddress = cwrap('wasm_get_sound_buffer_address', 'number', []);
  const copyIntoSoundBuffer = cwrap('wasm_copy_into_sound_buffer', 'number', []);

  /**
   * wasm_loadFile(name, u8*buf, long len, u8 drive_number) → const char*
   * Buffer geheugen-allocatie in HEAPU8 + free na call.
   * Voor name (string) + return (string): cwrap doet conversie. Alleen buf
   * (u8*) wordt handmatig gealloceerd. vAmigaWeb's CMakeLists exporteert
   * cwrap/ccall/HEAPU8/HEAPF32 (geen stringToNewUTF8/UTF8ToString direct).
   */
  const _loadFileRaw = cwrap('wasm_loadFile', 'string', ['string', 'number', 'number', 'number']);
  function loadFile(name, buf, drive) {
    const len = buf.length;
    const ptr = Module._malloc(len);
    if (ptr === 0) throw new Error(`Module._malloc(${len}) faalde`);
    try {
      Module.HEAPU8.set(buf, ptr);
      return _loadFileRaw(name, ptr, len, drive) || '';
    } finally {
      Module._free(ptr);
    }
  }

  /**
   * Save current emulator state naar Uint8Array.
   *
   * v0.0.13-SuperFrog: FS-bypass. vAmigaWeb's WASM exports cwrap/ccall/HEAPU8/
   * HEAPF32 maar NIET FS (zie external/vamigaweb/CMakeLists.txt:54,91) — eerdere
   * implementatie via wasm_save_workspace + Module.FS.readFile crashte met
   * "Cannot read properties of undefined (reading 'readFile')".
   *
   * Nieuwe route: wasm_take_user_snapshot() → JSON met HEAP-pointer → subarray-
   * copy naar nieuw Uint8Array.
   */
  function saveStateToBuffer() {
    const jsonStr = takeUserSnapshotRaw();
    if (!jsonStr) throw new Error('wasm_take_user_snapshot returnde lege string');
    let meta;
    try {
      meta = JSON.parse(jsonStr);
    } catch (_) {
      throw new Error(`take_user_snapshot JSON-parse failed: ${jsonStr.slice(0, 100)}`);
    }
    if (meta.error) throw new Error(`take_user_snapshot: ${meta.error}`);
    const { address, size } = meta;
    if (!address || !size) {
      throw new Error(`take_user_snapshot leverde geen address/size (got ${jsonStr.slice(0, 200)})`);
    }
    // HEAPU8.subarray = view (no-copy); we kopiëren expliciet voor levensduur
    // (HEAP kan re-allocaten bij volgende WASM-call → view wordt dan corrupt).
    const view = Module.HEAPU8.subarray(address, address + size);
    const buf = new Uint8Array(view);
    return buf;
  }

  /**
   * Restore state vanuit Uint8Array.
   *
   * v0.0.13-SuperFrog: FS-bypass via loadFile snapshot-branch.
   * vAmigaWeb's _wasm_loadFile herkent snapshots via Snapshot::isCompatible(blob,len)
   * mits extension != "rom" (main.cpp:1722). Wij geven '.snap'-extension →
   * eerste branch-match → amiga.loadSnapshot() zonder FS.
   *
   * Drive-number is irrelevant in de snapshot-branch (gebruikt alleen in disk/HD-branches).
   */
  function restoreStateFromBuffer(buf) {
    const result = loadFile('snapshot.snap', buf, 0);
    // Snapshot-branch return-value is "" bij success (geen rom/rom_ext string).
    return result;
  }

  return {
    // Emulator control
    run, halt, reset, powerOn, configure,
    // Input — keyboard
    key, scheduleKey,
    // Input — mouse (sub-step 6)
    mouse, mouseButton,
    // Input — joystick (sub-step 8)
    joystick,
    // I/O
    loadFile,
    // State
    saveStateToBuffer, restoreStateFromBuffer,
    // Render (sub-step 6)
    drawOneFrame, execute, pixelBuffer, renderWidth, renderHeight, frameInfo,
    // Audio (sub-step 6 skelet, sink in sub-step 7)
    setSampleRate, updateAudio, leftChannelBuffer, rightChannelBuffer,
    getSoundBufferAddress, copyIntoSoundBuffer,
  };
}

/**
 * Convenience: roep init() en geef bindings terug.
 */
export async function getBindings() {
  const state = await init();
  return state.bindings;
}

/**
 * Convenience: geef de Emscripten Module instance terug (voor HEAP-access in renderer).
 */
export async function getModule() {
  const state = await init();
  return state.module;
}

// ---------------------------------------------------------------------------
// IndexedDB-helpers (asset-storage, blijft buiten vAmiga-Module)
// ---------------------------------------------------------------------------

/**
 * Asset in IndexedDB schrijven.
 */
export async function storeAsset(storeName, label, blob) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put({ label, blob, created: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Asset uit IndexedDB ophalen.
 */
export async function loadAsset(storeName, label) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(label);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Check of warm-snapshot bestaat.
 */
export async function hasWarmSnapshot() {
  const snap = await loadAsset('amigahorse-states', STATE.warmSnapshotKey);
  return !!snap;
}

/**
 * Open IndexedDB en zorg dat alle stores bestaan.
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('amigahorse', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      ['amigahorse-kickstart', 'amigahorse-disks', 'amigahorse-states', 'amigahorse-config']
        .forEach((name) => {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'label' });
          }
        });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export { STATE as _state };  // debugging-toegang
