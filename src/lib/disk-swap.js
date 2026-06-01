// AmigaHorse_Web — Disk-swap helpers (v0.0.9-FrontierEliteII, sub-step 9)
//
// Multi-disk-projecten: laat user kiezen welke drive (DF0..DF3) voor een
// gekozen ADF. Standaard Amiga heeft 4 floppy-drives.
//
// Gebruik:
//   import { insertDiskInDrive, DRIVES } from '../lib/disk-swap.js';
//   await insertDiskInDrive(bindings, diskBlob, label, 1);  // → DF1:

export const DRIVES = [
  { num: 0, label: 'DF0' },
  { num: 1, label: 'DF1' },
  { num: 2, label: 'DF2' },
  { num: 3, label: 'DF3' },
];

/**
 * Mount een ADF/HDF in opgegeven drive.
 *
 * @param {object} bindings — uit getBindings()
 * @param {Blob} diskBlob   — uit IndexedDB amigahorse-disks
 * @param {string} fileName — voor logging + vAmiga-API
 * @param {number} drive    — 0..3
 * @returns {Promise<string>} — return-value van wasm_loadFile (status/error-msg)
 */
export async function insertDiskInDrive(bindings, diskBlob, fileName, drive) {
  if (drive < 0 || drive > 3) {
    throw new RangeError(`drive moet 0..3 zijn (DF0..DF3), kreeg ${drive}`);
  }
  const buf = new Uint8Array(await diskBlob.arrayBuffer());
  const result = bindings.loadFile(fileName, buf, drive);
  console.log(`[disk-swap] ${fileName} → DF${drive}: result="${result}"`);
  return result || '';
}
