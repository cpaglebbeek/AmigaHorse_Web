// AmigaHorse_Web — wasm-bridge.js (v0.0.2-CannonFodder, stub)
//
// Typed wrapper rondom vAmigaWeb's WASM-exports. Eén centrale module die alle
// vAmiga-calls bundelt, zodat /basic/ en /full/ routes dezelfde API gebruiken.
//
// vAmigaWeb (https://github.com/vAmigaWeb/vAmigaWeb) is GPL-3.0; toegevoegd
// als git-submodule in external/vamigaweb/ in v0.0.2.x. Tot dan: stubs hieronder.
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
 * TODO v0.0.2.x:
 *   - dynamic import van '../external/vamigaweb/build/amigahorse-vamiga.js'
 *   - check crossOriginIsolated, WASM-SIMD support
 *   - mount Emscripten MEMFS op /dh1 voor hostfs-injection
 */
export async function init() {
  if (STATE.ready) return STATE.vamiga;

  if (!crossOriginIsolated) {
    throw new Error(
      'COOP+COEP-headers ontbreken — SharedArrayBuffer niet beschikbaar. ' +
      'Host dient Cross-Origin-Opener-Policy: same-origin en ' +
      'Cross-Origin-Embedder-Policy: require-corp te zetten.'
    );
  }

  // STUB — wordt vervangen bij v0.0.2.x na vAmigaWeb submodule add
  STATE.vamiga = {
    start: () => console.warn('[wasm-bridge] STUB vAmiga.start'),
    stop: () => console.warn('[wasm-bridge] STUB vAmiga.stop'),
    loadKickstart: (_buf) => console.warn('[wasm-bridge] STUB loadKickstart'),
    loadADF: (_buf, _df) => console.warn('[wasm-bridge] STUB loadADF'),
    mountDH: (_hostPath) => console.warn('[wasm-bridge] STUB mountDH — te verifieren in vAmigaWeb-API'),
    saveState: () => new Uint8Array(0),
    restoreState: (_buf) => console.warn('[wasm-bridge] STUB restoreState'),
    injectKey: (_text) => console.warn('[wasm-bridge] STUB injectKey'),
    injectJoy: (_port, _dx, _dy, _fire) => console.warn('[wasm-bridge] STUB injectJoy'),
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
