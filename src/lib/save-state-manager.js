// AmigaHorse_Web — Save-state slot-manager (v0.0.9-FrontierEliteII, sub-step 9)
//
// Slot-based save-states per disk-hash:
//   - Disk-key = eerste 16 hex chars van SHA-256(disk-bytes) → 64-bit-uniqueness
//   - IndexedDB key = `${diskKey}:${slot}` in 'amigahorse-states' store
//   - 4 slots per disk (kan uitgebreid worden via SLOTS_PER_DISK)
//
// API:
//   const mgr = new SaveStateManager(bindings);
//   const diskKey = await mgr.hashDisk(diskBuf);
//   await mgr.save(diskKey, 1);            // snapshot huidige emulator-state
//   await mgr.load(diskKey, 1);            // restore vanaf slot 1
//   const slots = await mgr.listSlots(diskKey);  // [{slot, timestamp, size}, ...]
//
// Note: `basic-env-snapshot` blijft een aparte fixed key (geen slot-overlap).

import { storeAsset, loadAsset } from '../wasm-bridge.js';

const SLOTS_PER_DISK = 4;
const STORE = 'amigahorse-states';

export class SaveStateManager {
  /**
   * @param {object} bindings — uit getBindings(), heeft saveStateToBuffer/restoreStateFromBuffer
   */
  constructor(bindings) {
    this.bindings = bindings;
  }

  /**
   * SHA-256 van disk-bytes → eerste 16 hex chars (64-bit-uniek).
   *
   * @param {Uint8Array} diskBuf
   * @returns {Promise<string>}
   */
  async hashDisk(diskBuf) {
    const hashBuf = await crypto.subtle.digest('SHA-256', diskBuf);
    const bytes = new Uint8Array(hashBuf);
    return Array.from(bytes.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Save huidige emulator-state naar slot.
   *
   * @param {string} diskKey
   * @param {number} slot — 1..SLOTS_PER_DISK
   */
  async save(diskKey, slot) {
    if (slot < 1 || slot > SLOTS_PER_DISK) {
      throw new RangeError(`slot moet 1..${SLOTS_PER_DISK} zijn, kreeg ${slot}`);
    }
    const buf = this.bindings.saveStateToBuffer();
    if (!buf || buf.length === 0) {
      throw new Error('saveStateToBuffer leverde lege buffer — emulator ready?');
    }
    const label = `${diskKey}:${slot}`;
    await storeAsset(STORE, label, new Blob([buf]));
    return { slot, size: buf.length, timestamp: Date.now() };
  }

  /**
   * Restore state vanaf slot.
   *
   * @param {string} diskKey
   * @param {number} slot
   * @returns {Promise<boolean>} — true als geladen, false als slot leeg
   */
  async load(diskKey, slot) {
    const label = `${diskKey}:${slot}`;
    const asset = await loadAsset(STORE, label);
    if (!asset) return false;
    const buf = new Uint8Array(await asset.blob.arrayBuffer());
    this.bindings.restoreStateFromBuffer(buf);
    return true;
  }

  /**
   * Lijst van slots-met-data voor een disk.
   *
   * @param {string} diskKey
   * @returns {Promise<Array<{slot, timestamp, size}>>}
   */
  async listSlots(diskKey) {
    const result = [];
    for (let s = 1; s <= SLOTS_PER_DISK; s++) {
      const label = `${diskKey}:${s}`;
      const asset = await loadAsset(STORE, label);
      if (asset) {
        result.push({
          slot: s,
          timestamp: asset.created || 0,
          size: asset.blob ? asset.blob.size : 0,
        });
      }
    }
    return result;
  }
}

export const SAVE_STATE_SLOTS = SLOTS_PER_DISK;
