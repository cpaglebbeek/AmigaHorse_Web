---
date: 2026-06-01
repo: AmigaHorse_Web
version: 0.0.11-AlienBreed
status: open
resume: "verder met AmigaHorse_Web v0.0.11-AlienBreed — user-bake-test in browser: F12 console open vóór bake-klik; verwacht 10 groene stages + stage-2 result='rom' + warm-snapshot ≥1MB"
---

# AmigaHorse_Web v0.0.11-AlienBreed — bake-flow ROM-flash fix + diagnostics-pass

**Sessie:** Vervolg op v0.0.10-Hunter OEU "undefined error bij start" debug-punt.
**Trigger:** User `verder met amigahorse` → keuze B (fix + diagnostics).
**Classificatie:** Geel bugfix (JS↔WASM binding-bug).

## Root cause (statisch bewezen)

`external/vamigaweb/main.cpp:1748`:
```cpp
if(file_still_unprocessed && extractSuffix(filename)=="rom_file")
```

vAmigaWeb's `_wasm_loadFile` gebruikt filename-extension als **type-discriminator**:
- `.rom_file` → ROM-branch (loadRom + auto powerOn + auto run, regel 1772-1813)
- `.rom_ext_file` → ROM-ext-branch (regel 1823)
- `.adf` / disk-formaten → load_disk + swapDisk in df0-df3 (regel 1559-1583)
- `.hdf` / `.hdz` → harde-schijf-branches (regel 1595-1719)

Ons `setup.js:104` stuurde `'kick13.rom'` → `extractSuffix` returnt `"rom"` → match met geen enkele branche → fall-through naar `return ""` op regel 1881 → **Kickstart wordt nooit naar `wrapper->emu->mem` geflashed**.

## Cascade-effect (was zichtbaar als "undefined error")

| Stage | Code | Effect zonder ROM |
|---|---|---|
| `loadFile('kick13.rom', ..., 0xFF)` | branch-mismatch | returnt `""`, geen flash |
| `powerOn(1)` | `wrapper->emu->powerOn()` | throwt `AppError` ("CHIP_RAM" / "ROM_MISSING"), gevangen, error-string in return |
| `loadFile('wb13.adf', ..., 0)` | disk-branch werkt | disk in df0, maar zonder ROM = niets boot |
| `run()` | emulator-loop | idle (geen CPU-instructies om uit te voeren) |
| `playSequence('AmigaBASIC\r')` | keys → vacuum | niets gebeurt |
| `saveStateToBuffer()` | `wasm_save_workspace` op leeg board | lege/null buffer of FS.readFile faalt met `ENOENT` |
| → throw met TypeError op `undefined.length` ergens downstream | de "undefined error" die user zag |

## Fix (1 regel + diagnostics-wrapper)

`src/basic/setup.js`:
```js
- bindings.loadFile('kick13.rom',      kickBuf, 0xFF)
+ bindings.loadFile('kick13.rom_file', kickBuf, 0xFF)
```

Drive `0xFF` blijft want ROM-branch (main.cpp:1748-1820) gebruikt `drive_number` niet, alleen disk-branches (regel 1560-1583).

## Diagnostics-pass (zodat volgende fail expliciet stage-attribuut)

Alle 10 bake-stages wrapt nu in `stage(label, fn)` helper:
- `console.group(label)` + `console.time(label)` voor visuele groepering
- `→ result:` log met return-waarde
- `✗ FAIL:` met stack-trace bij exception
- Sanity-checks:
  - Stage 2: warning als `loadFile` ≠ `"rom"` (zou de fix onbewezen maken)
  - Stage 3: warning als `powerOn` non-empty (= error-string)
- Header-bytes kick-buffer + WB-size in console voor forensic-trail
- Verbeterde catch-handler met `err.stack` + `err.message || err` fallback

## Verified (statisch, géén browser-test door agent)

- ✓ `node --check src/basic/setup.js`
- ✓ vAmigaWeb main.cpp:1748 extension-match verified
- ✓ vAmigaWeb main.cpp:1542-1548 `extractSuffix` logic verified
- ✓ Drive 0xFF ongebruikt in ROM-branch
- ✓ ROM-branch return = `"rom"` letterlijk (regel 1794+1820) → sanity-check klopt
- ✗ Browser-test = user-actie (resume-trigger)

## Open na v0.0.11

- **User bake-test:** F12 → Console open → klik Bake → verwacht 10 groene stages + stage-2 `→ result: "rom"` + warm-snapshot ≥ ~1MB. Bij falen: exacte stage + stack uit console → v0.0.12-fix.
- **Architectonisch (v0.0.12+):** `docs/CORE_API_CONTRACT.md` — documenteer filename-extension-discriminator + andere Core-conventies; safeguard tegen silent regressies bij submodule-bumps.
- **Bonus-vraag bij positief bake-resultaat:** Quick BASIC drop `.bas` end-to-end testen → indien werkend → versie-bump **0.1.0-`<codename>`** (Oranje, BASIC-mode bewezen e2e).

## Commits in deze sessie

1. `AmigaHorse_Web`: setup.js fix + diagnostics + VERSION + CHANGELOG + dit sessie-MD
2. `Meta_AmigaHorse`: codename-pool update (Alien Breed: pool → toegewezen)

## Niet aangeraakt

- `Meta_Master/SHARED_INFRASTRUCTURE.md` modified-state was van parallelle QuickBasicEmulator-sessie (port-reserveringen `qbe-runner` :4001 + `qbe-vnc` :5901-5999 voor v1.0.0-Kemeny F1/F2). Niet committen vanuit deze sessie.
