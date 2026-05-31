// AmigaHorse_Web — OFS-ADF builder (v0.0.4-Speedball2, sub-step 4)
//
// Bouwt een minimale Old File System (OFS) Amiga Disk File (ADF) met één
// bestand erin. Doel: BASIC-mode .bas-injection in DF1: zonder hostfs (P-AMH-09).
//
// Werking: kickstart 1.3 / WB 1.3 herkent OFS-volumes met label "BAS",
// AmigaBASIC kan dan `LOAD "DF1:launch.bas"` doen.
//
// **Beperkingen v0.0.4:**
// - Single-block file-size limiet: 488 bytes (1 OFS data-block). Voldoende voor
//   HELLO WORLD-tests; multi-block in v0.0.5.
// - OFS (niet FFS) — KS 1.3 floppy default; FFS-support v0.x.
// - DD-density (Double Density, 880 KB). HD-floppies niet in scope.
//
// Refs: Laurent Clévy "Amiga Disk File", Aminet ADFLib docs.

const SECTOR_SIZE = 512;
const SECTORS = 1760;                         // DD floppy
const TOTAL_BYTES = SECTOR_SIZE * SECTORS;    // 901120 = 880 KB

// OFS block-types
const T_HEADER = 2;
const T_DATA = 8;

// OFS secondary-types
const ST_ROOT = 1;
const ST_FILE = 0xFFFFFFFD;                   // = -3 as u32

// Standard sector-layout voor onze single-file ADF
const BOOT_BLOCK = 0;                         // boot blocks: 0-1 (2 sectoren)
const ROOT_BLOCK = 880;                       // root block: midden van schijf
const BITMAP_BLOCK = 881;
const FILE_HEADER_BLOCK = 882;
const FIRST_DATA_BLOCK = 883;

const OFS_DATA_PER_BLOCK = 488;               // 512 - 24 OFS-data-header
const HASH_TABLE_SIZE = 72;                   // root block hash-tabel grootte

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeU32BE(buf, offset, value) {
  buf[offset]   = (value >>> 24) & 0xff;
  buf[offset+1] = (value >>> 16) & 0xff;
  buf[offset+2] = (value >>> 8)  & 0xff;
  buf[offset+3] =  value         & 0xff;
}

function readU32BE(buf, offset) {
  return ((buf[offset] << 24) | (buf[offset+1] << 16) | (buf[offset+2] << 8) | buf[offset+3]) >>> 0;
}

/**
 * OFS-blok checksum: zero het checksum-veld, sommeer alle 128 u32's mod 2^32,
 * sla -som op. Bij verificatie: som over hele blok = 0.
 */
function computeBlockChecksum(buf, blockStart, checksumOffset) {
  writeU32BE(buf, checksumOffset, 0);
  let sum = 0;
  for (let i = 0; i < SECTOR_SIZE; i += 4) {
    sum = (sum + readU32BE(buf, blockStart + i)) >>> 0;
  }
  writeU32BE(buf, checksumOffset, (0 - sum) >>> 0);
}

/**
 * Bitmap-blok checksum: zelfde sum-mod-2^32, opgeslagen op offset 0 (eerste 4 bytes).
 */
function computeBitmapChecksum(buf, blockStart) {
  writeU32BE(buf, blockStart, 0);
  let sum = 0;
  for (let i = 0; i < SECTOR_SIZE; i += 4) {
    sum = (sum + readU32BE(buf, blockStart + i)) >>> 0;
  }
  writeU32BE(buf, blockStart, (0 - sum) >>> 0);
}

/**
 * Schrijf BCPL/Amiga-string: lengte-byte gevolgd door inhoud. Maximaal `maxLen` bytes.
 */
function writeAmigaString(buf, offset, maxLen, str) {
  const bytes = new TextEncoder().encode(str);
  const len = Math.min(bytes.length, maxLen);
  buf[offset] = len;
  buf.set(bytes.subarray(0, len), offset + 1);
}

/**
 * Amiga case-insensitive name hash. Voor file-naam → root-block hash-tabel-slot.
 */
function amigaHash(name, htSize) {
  let hash = name.length;
  for (let i = 0; i < name.length; i++) {
    let c = name.charCodeAt(i);
    if (c >= 0x61 && c <= 0x7A) c -= 0x20;     // toupper
    hash = ((hash * 13) + c) >>> 0;
    hash = hash & 0x7fffffff;
  }
  return hash % htSize;
}

/**
 * Huidige tijd → Amiga dagen-sinds-1978 + minuten + ticks (1/50 sec).
 */
function nowAsAmigaDate() {
  const ms = Date.now() - Date.UTC(1978, 0, 1);
  const days = Math.floor(ms / 86400000);
  const remainingMs = ms - days * 86400000;
  const mins = Math.floor(remainingMs / 60000);
  const ticks = Math.floor((remainingMs - mins * 60000) / 20);
  return { days, mins, ticks };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Bouwt een 880 KB OFS-ADF met één bestand erin.
 *
 * @param {Uint8Array} basContent — bestandsinhoud (max 488 bytes v0.0.4)
 * @param {string} fileName       — bestandsnaam, default "launch.bas"
 * @param {string} volumeLabel    — volume-label, default "BAS"
 * @returns {Uint8Array} — 901120 bytes, klaar voor wasm_loadFile met drive=1
 */
export function buildAdfWithBasFile(basContent, fileName = 'launch.bas', volumeLabel = 'BAS') {
  if (!(basContent instanceof Uint8Array)) {
    throw new TypeError('basContent moet Uint8Array zijn');
  }
  if (basContent.length > OFS_DATA_PER_BLOCK) {
    throw new RangeError(
      `BASIC-bestand max ${OFS_DATA_PER_BLOCK} bytes in v0.0.4 ` +
      `(single-block-limiet). Kreeg: ${basContent.length}. ` +
      `Multi-block-support komt v0.0.5.`,
    );
  }
  if (fileName.length > 30) {
    throw new RangeError(`fileName max 30 chars (Amiga-limiet); kreeg ${fileName.length}`);
  }
  if (volumeLabel.length > 30) {
    throw new RangeError(`volumeLabel max 30 chars; kreeg ${volumeLabel.length}`);
  }

  const adf = new Uint8Array(TOTAL_BYTES);
  const date = nowAsAmigaDate();

  // -- Boot block (sectoren 0-1) --
  // Minimaal "DOS\0" magic + root-block-pointer. Niet bootable; OS leest alleen
  // de magic + root-pointer voor mount.
  adf[0] = 0x44; adf[1] = 0x4F; adf[2] = 0x53; adf[3] = 0x00;  // "DOS\0"
  writeU32BE(adf, 8, ROOT_BLOCK);
  // Boot checksum offset 4 — we laten 'm 0 (niet bootable, OS accepteert toch)

  // -- Root block (sector 880) --
  {
    const off = ROOT_BLOCK * SECTOR_SIZE;
    writeU32BE(adf, off + 0x000, T_HEADER);
    // 0x004: header_key = 0 (root special)
    // 0x008: high_seq = 0
    writeU32BE(adf, off + 0x00C, HASH_TABLE_SIZE);
    // 0x010: r1 = 0
    // 0x014: checksum (later)
    // 0x018: start van hash-table (72 entries × 4 bytes = 288 bytes)
    const fileHashSlot = amigaHash(fileName, HASH_TABLE_SIZE);
    writeU32BE(adf, off + 0x018 + fileHashSlot * 4, FILE_HEADER_BLOCK);
    // 0x138: bitmap_flag = 0xFFFFFFFF (bitmap is valid)
    writeU32BE(adf, off + 0x138, 0xFFFFFFFF);
    // 0x13C: bitmap pointers (25 × 4 = 100 bytes). Eerste = BITMAP_BLOCK.
    writeU32BE(adf, off + 0x13C, BITMAP_BLOCK);
    // 0x1A0: bitmap-extension = 0 (alles past in 1 bitmap-block)
    // 0x1A4-0x1AF: laatste wijziging dir (days/mins/ticks)
    writeU32BE(adf, off + 0x1A4, date.days);
    writeU32BE(adf, off + 0x1A8, date.mins);
    writeU32BE(adf, off + 0x1AC, date.ticks);
    // 0x1B0: volume-name length + name (max 30 + 1)
    writeAmigaString(adf, off + 0x1B0, 30, volumeLabel);
    // 0x1D8-0x1E3: laatste-disk-modificatie date (days/mins/ticks)
    writeU32BE(adf, off + 0x1D8, date.days);
    writeU32BE(adf, off + 0x1DC, date.mins);
    writeU32BE(adf, off + 0x1E0, date.ticks);
    // 0x1E4-0x1EF: creation date (days/mins/ticks)
    writeU32BE(adf, off + 0x1E4, date.days);
    writeU32BE(adf, off + 0x1E8, date.mins);
    writeU32BE(adf, off + 0x1EC, date.ticks);
    // 0x1F0: nextSameHash = 0
    // 0x1F4: parent = 0
    // 0x1F8: extension = 0
    writeU32BE(adf, off + 0x1FC, ST_ROOT);
    computeBlockChecksum(adf, off, off + 0x014);
  }

  // -- Bitmap block (sector 881) --
  // Bit-mapping: bit=1 → free, bit=0 → used. Bitmap covert sectoren 2..1759
  // (boot block 0-1 NIET in bitmap; staan altijd "used").
  {
    const off = BITMAP_BLOCK * SECTOR_SIZE;
    // Eerst alle bits op 1 (free), behalve checksum-positie (0x000-0x003)
    for (let i = 4; i < SECTOR_SIZE; i++) adf[off + i] = 0xFF;

    const markUsed = (sector) => {
      const bitIdx = sector - 2;                  // bitmap-bit 0 = sector 2
      const byteIdx = Math.floor(bitIdx / 8);
      const bitInByte = bitIdx % 8;
      adf[off + 4 + byteIdx] &= ~(1 << bitInByte);
    };
    markUsed(ROOT_BLOCK);
    markUsed(BITMAP_BLOCK);
    markUsed(FILE_HEADER_BLOCK);
    markUsed(FIRST_DATA_BLOCK);
    computeBitmapChecksum(adf, off);
  }

  // -- File header block (sector 882) --
  {
    const off = FILE_HEADER_BLOCK * SECTOR_SIZE;
    writeU32BE(adf, off + 0x000, T_HEADER);
    writeU32BE(adf, off + 0x004, FILE_HEADER_BLOCK);    // header_key = own
    writeU32BE(adf, off + 0x008, 1);                     // num data blocks
    // 0x00C: data_size in header = 0
    writeU32BE(adf, off + 0x010, FIRST_DATA_BLOCK);     // first_data_block
    // 0x014: checksum (later)
    // 0x018-0x12F: data-block-pointer array (72 × 4 = 288 bytes, reverse order, [71] = first)
    writeU32BE(adf, off + 0x018 + 71 * 4, FIRST_DATA_BLOCK);
    // 0x130: unused
    // 0x134-0x13F: UID/GID/protect = 0
    writeU32BE(adf, off + 0x140, basContent.length);    // byte-size
    // 0x144: comment length = 0
    // 0x1A0-0x1AB: date (days/mins/ticks)
    writeU32BE(adf, off + 0x1A0, date.days);
    writeU32BE(adf, off + 0x1A4, date.mins);
    writeU32BE(adf, off + 0x1A8, date.ticks);
    // 0x1AC: filename length + name (max 30+1)
    writeAmigaString(adf, off + 0x1AC, 30, fileName);
    // 0x1D4: hash-chain = 0
    writeU32BE(adf, off + 0x1D8, ROOT_BLOCK);            // parent
    // 0x1DC: extension = 0
    writeU32BE(adf, off + 0x1FC, ST_FILE);
    computeBlockChecksum(adf, off, off + 0x014);
  }

  // -- Data block (sector 883, OFS-format) --
  {
    const off = FIRST_DATA_BLOCK * SECTOR_SIZE;
    writeU32BE(adf, off + 0x000, T_DATA);
    writeU32BE(adf, off + 0x004, FILE_HEADER_BLOCK);    // header_key
    writeU32BE(adf, off + 0x008, 1);                     // seq number
    writeU32BE(adf, off + 0x00C, basContent.length);    // data size
    writeU32BE(adf, off + 0x010, 0);                     // next data block = 0 (last)
    // 0x014: checksum (later)
    // 0x018-0x1FF: 488 bytes data-payload
    adf.set(basContent, off + 24);
    computeBlockChecksum(adf, off, off + 0x014);
  }

  return adf;
}

// Exports voor testing/debug
export const _internal = {
  SECTOR_SIZE,
  SECTORS,
  TOTAL_BYTES,
  OFS_DATA_PER_BLOCK,
  BOOT_BLOCK,
  ROOT_BLOCK,
  BITMAP_BLOCK,
  FILE_HEADER_BLOCK,
  FIRST_DATA_BLOCK,
  amigaHash,
  nowAsAmigaDate,
  writeU32BE,
  readU32BE,
};
