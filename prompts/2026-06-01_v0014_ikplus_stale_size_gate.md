---
date: 2026-06-01
repo: AmigaHorse_Web
version: 0.0.14-IKPlus
status: open
resume: "verder met AmigaHorse_Web v0.0.14-IKPlus — Quick BASIC drop-test post-bake: .bas tot ~34 KB moet nu worden geaccepteerd (was foutief geblokt op 488 bytes met verouderde v0.0.6/0.0.7 melding)"
---

# AmigaHorse_Web v0.0.14-IKPlus — stale size-gate Quick BASIC

**Sessie:** Vervolg op v0.0.13-SuperFrog. User signaleerde stale UI-tekst: "v 0.0.6 limit 486 bytes. multi block support komt 0.0.7" (overgenomen citaat — werkelijke string was 488 bytes).
**Classificatie:** Geel bugfix (stale UI-text + foutieve size-gate).

## Root cause

In `src/basic/quick-launch.js` `handleBasFile()` regel 60:
```js
if (file.size > adfInternal.OFS_DATA_PER_BLOCK) {   // = 488 bytes = single OFS-block
  setStatus(`... v0.0.6 limiet ... Multi-block-support komt v0.0.7.`, 'error');
  return;
}
```

Sinds **v0.0.8-DefenderOfTheCrown** (sub-step 8, commit `bb3916c`) ondersteunt `src/lib/build-blank-adf.js` multi-block file-chains via `MAX_DATA_BLOCK_PTRS = 72` data-block-pointers in het file-header → effectieve `MAX_FILE_SIZE = 488 × 72 = 35136 bytes` (~34 KB).

`build-blank-adf.js` exporteert `MAX_FILE_SIZE` via `_internal`. **Maar de caller (quick-launch.js) is nooit ge-update** — bleef de single-block-constant `OFS_DATA_PER_BLOCK` gebruiken én de oude versie-belofte-tekst weergeven.

## Fix

```js
// quick-launch.js handleBasFile() — v0.0.14
if (file.size > adfInternal.MAX_FILE_SIZE) {
  setStatus(
    `Bestand ${file.size} bytes — limiet ${adfInternal.MAX_FILE_SIZE} bytes ` +
    `(~${Math.floor(adfInternal.MAX_FILE_SIZE / 1024)} KB, ` +
    `${adfInternal.MAX_DATA_BLOCK_PTRS} OFS data-blocks × ${adfInternal.OFS_DATA_PER_BLOCK} bytes). ` +
    `Voor grotere programma's: splits in meerdere .bas-files via CHAIN of MERGE.`,
    'error',
  );
  return;
}
```

Plus de eerdere check-melding "alleen AmigaBASIC v0.0.6" → "alleen AmigaBASIC ondersteund" (versie-onafhankelijk).

## Verified (statisch)

- ✓ `node --check src/basic/quick-launch.js`
- ✓ Live bundle (esbuild watch): 0 hits voor "v0.0.6 limiet" en "komt v0.0.7"
- ✓ Live bundle: `_internal.MAX_FILE_SIZE` referentie + nieuwe foutmelding aanwezig
- ✓ `_internal`-export in `build-blank-adf.js:277-294` bevat `MAX_FILE_SIZE`, `MAX_DATA_BLOCK_PTRS`, `OFS_DATA_PER_BLOCK`

## Open na v0.0.14 (resume)

- **User drop-test:** post-bake → drop een realistisch .bas (bv. 2-10 KB) → moet doorlopen naar load (was: geblokt). Bij succes: groene status "Programma draait!" of "Geladen in BASIC-prompt".
- **Architectonisch (v0.0.15+):** Overweeg dedicated `src/lib/limits.js` met semantische constants. Voorkomt herhaling "API-change zonder caller-update".
- **Mogelijk volgend symptoom:** als drop slaagt maar BASIC `LOAD "DF1:launch.bas"` faalt op multi-block-files → bug in `build-blank-adf.js` multi-block-chain (sub-step 8 had alleen Node smoke-test, geen browser-load-test).

## Commits in deze sessie

1. `AmigaHorse_Web`: quick-launch.js fix + VERSION + CHANGELOG + dit sessie-MD
2. `Meta_AmigaHorse`: codename-pool update (IK+: pool → toegewezen)

## Niet aangeraakt

- `src/lib/build-blank-adf.js` (al correct sinds v0.0.8; alleen caller was stale)
- `Meta_Master`: clean ✓
