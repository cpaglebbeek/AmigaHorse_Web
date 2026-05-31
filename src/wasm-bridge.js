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
   */
  function loadFile(name, buf, drive) {
    const len = buf.length;
    const ptr = Module._malloc(len);
    if (ptr === 0) throw new Error(`Module._malloc(${len}) faalde`);
    try {
      Module.HEAPU8.set(buf, ptr);
      const namePtr = Module.stringToNewUTF8(name);
      try {
        const resultPtr = Module._wasm_loadFile(namePtr, ptr, len, drive);
        const result = Module.UTF8ToString(resultPtr);
        return result || '';
      } finally {
        Module._free(namePtr);
      }
    } finally {
      Module._free(ptr);
    }
  }

  /**
   * Save current emulator state naar Uint8Array.
   * Implementatie: vAmiga's wasm_save_workspace schrijft naar Emscripten-FS-pad,
   * dan FS.readFile + cleanup.
   */
  function saveStateToBuffer() {
    const path = '/tmp/amigahorse.snap';
    saveWorkspaceRaw(path);
    const buf = Module.FS.readFile(path);
    try { Module.FS.unlink(path); } catch (_) { /* ok */ }
    return new Uint8Array(buf);
  }

  /**
   * Restore state vanuit Uint8Array.
   */
  function restoreStateFromBuffer(buf) {
    const path = '/tmp/amigahorse.snap';
    // Zorg dat /tmp bestaat (Emscripten heeft /tmp default in MEMFS)
    Module.FS.writeFile(path, buf);
    loadWorkspaceRaw(path);
    try { Module.FS.unlink(path); } catch (_) { /* ok */ }
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
