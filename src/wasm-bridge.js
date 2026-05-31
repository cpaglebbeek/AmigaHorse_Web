// AmigaHorse_Web — wasm-bridge.js (v0.0.3-Flashback, sub-step 3 integratie)
//
// Typed wrapper rondom vAmigaWeb's WASM-exports. Eén centrale module die alle
// vAmiga-calls bundelt, zodat /basic/ en /full/ routes dezelfde API gebruiken.
//
// vAmigaWeb (https://github.com/vAmigaWeb/vAmigaWeb) is GPL-3.0; submodule
// `external/vamigaweb/` pinned commit c3c50d9 (v0.0.2.1).
//
// WASM-artefacten geproduceerd door tools/build-wasm.sh (v0.0.3-Flashback):
//   dist/vendor/vamigaweb/vAmiga.js     (106 KB, Emscripten glue)
//   dist/vendor/vamigaweb/vAmiga.wasm   (8.77 MB, Amiga-emulator binary)
//
// Sub-step 3 = build pipeline werkt, artefacten in dist/. Sub-step 4 = exports
// verifieren + concrete API-mapping. Sub-step 5 = end-to-end BASIC.bas test.
//
// Beschikbare exports uit CMakeLists.txt (~60 _wasm_-functies):
//   - _wasm_loadFile         disk/cart-laden
//   - _wasm_save_workspace   save-state (basis voor warm-snapshot P-AMH-09)
//   - _wasm_load_workspace   restore-state
//   - _wasm_auto_type        keyboard injection (BASIC LOAD/RUN flow)
//   - _wasm_run / _wasm_halt emulator-control
//   - _wasm_pixel_buffer     framebuffer-pointer voor canvas-blit
//   - _wasm_get_sound_buffer_address  AudioWorklet-sink
//   - (volledige lijst: zie external/vamigaweb/CMakeLists.txt EXPORTED_FUNCTIONS)
//
// Géén `mountDH`-export gevonden → sub-step 4 bevestigt fallback: on-the-fly
// ADF-rebuild voor `.bas`-injection via _wasm_loadFile-DH1:-pad.
//
// Zie docs/BASIC_MODE.md voor het complete data-flow per route.

const STATE = {
  vamiga: null,           // ingeladen vAmiga-WASM instantie
  ready: false,
  currentRoute: null,     // 'basic' | 'full'
  warmSnapshotKey: 'basic-env-snapshot',
};

/**
 * Initialiseer vAmiga-WASM. Vereist COOP+COEP-headers voor SharedArrayBuffer.
 *
 * v0.0.3-Flashback: artefacten beschikbaar in dist/vendor/vamigaweb/. Concrete
 * dynamic import + Module()-instantiation komt in sub-step 4 (na export-audit).
 *
 * Nonworker-build (CMakeLists thread_type=nonworker) → géén SharedArrayBuffer
 * verplicht; crossOriginIsolated wordt alleen vereist als we naar worker-mode
 * switchen in v0.0.x+.
 */
export async function init() {
  if (STATE.ready) return STATE.vamiga;

  // TODO sub-step 4: replace stubs met daadwerkelijke dynamic import:
  //   const vamigaModule = await import('/vendor/vamigaweb/vAmiga.js');
  //   STATE.vamiga = await vamigaModule.default({
  //     locateFile: (p) => `/vendor/vamigaweb/${p}`,
  //   });
  //   STATE.vamiga.loadFile  = STATE.vamiga.cwrap('wasm_loadFile', ...)
  //   STATE.vamiga.saveState = STATE.vamiga.cwrap('wasm_save_workspace', ...)
  //   STATE.vamiga.loadState = STATE.vamiga.cwrap('wasm_load_workspace', ...)
  //   STATE.vamiga.autoType  = STATE.vamiga.cwrap('wasm_auto_type', ...)
  //   ...

  STATE.vamiga = {
    start: () => console.warn('[wasm-bridge] STUB vAmiga.start — sub-step 4'),
    stop: () => console.warn('[wasm-bridge] STUB vAmiga.stop'),
    loadKickstart: (_buf) => console.warn('[wasm-bridge] STUB loadKickstart → _wasm_loadFile'),
    loadADF: (_buf, _df) => console.warn('[wasm-bridge] STUB loadADF → _wasm_loadFile'),
    mountDH: (_hostPath) => console.warn('[wasm-bridge] mountDH ontbreekt in vAmigaWeb — fallback ADF-rebuild sub-step 4'),
    saveState: () => new Uint8Array(0),       // → _wasm_save_workspace
    restoreState: (_buf) => console.warn('[wasm-bridge] STUB restoreState → _wasm_load_workspace'),
    injectKey: (_text) => console.warn('[wasm-bridge] STUB injectKey → _wasm_auto_type'),
    injectJoy: (_port, _dx, _dy, _fire) => console.warn('[wasm-bridge] STUB injectJoy → _wasm_joystick'),
  };
  STATE.ready = true;
  return STATE.vamiga;
}

/**
 * Asset-Setup-resultaat in IndexedDB schrijven.
 * Zie src/basic/setup.js voor flow.
 */
export async function storeAsset(storeName, label, blob) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  await tx.objectStore(storeName).put({ label, blob, created: Date.now() });
  await tx.done;
}

/**
 * Asset uit IndexedDB terughalen.
 */
export async function loadAsset(storeName, label) {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  return tx.objectStore(storeName).get(label);
}

/**
 * Check of warm-snapshot bestaat (basic-env-snapshot in amigahorse-states).
 * Gebruikt door /basic/ index.html om redirect naar /basic/setup te besluiten.
 */
export async function hasWarmSnapshot() {
  const snap = await loadAsset('amigahorse-states', STATE.warmSnapshotKey);
  return !!snap;
}

/**
 * Open IndexedDB en zorg dat alle stores bestaan.
 * Schema: 4 object-stores (kickstart / disks / states / config).
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

export { STATE as _state };  // alleen voor debugging
