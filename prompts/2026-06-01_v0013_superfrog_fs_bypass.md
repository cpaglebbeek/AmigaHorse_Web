---
date: 2026-06-01
repo: AmigaHorse_Web
version: 0.0.13-SuperFrog
status: open
resume: "verder met AmigaHorse_Web v0.0.13-SuperFrog — user-bake-test na FS-bypass: hard-refresh + F12 console + klik Bake; verwacht stage 9 saveStateToBuffer = Uint8Array(~1MB) i.p.v. TypeError"
---

# AmigaHorse_Web v0.0.13-SuperFrog — FS-bypass via wasm_take_user_snapshot

**Sessie:** Vervolg op v0.0.12-ProjectX. User testte → "ik zie een try op een muisklik en daarna cannot read properties of undefined (reading 'readFile')".
**Classificatie:** Geel bugfix (JS↔WASM binding-bug).

## Root cause

`Module.FS` is `undefined` in onze vAmigaWeb-build. Oorzaak: `external/vamigaweb/CMakeLists.txt:54` en `:91`:
```cmake
-sEXPORTED_RUNTIME_METHODS=cwrap,ccall,HEAPU8,HEAPF32
```
**`FS` ontbreekt** in deze export-lijst. Standaard Emscripten exposeert `Module.FS` alleen als expliciet geëxporteerd of `FORCE_FILESYSTEM=1`. vAmigaWeb doet noch.

Onze `wasm-bridge.js:158-175` (v0.0.5+) gebruikte `Module.FS.readFile/writeFile/unlink` voor de save/restore-route → eerste écht-werkende bake-poging crashte met `TypeError: Cannot read properties of undefined (reading 'readFile')` op stage 9.

## Twee oplossingen overwogen

### A. WASM rebuild met FS in exports
- Wijzig CMakeLists regel 54+91: `,FS` toevoegen
- `npm run build:wasm` ~5-10 min
- Submodule-patch noodzakelijk (P-AMH-01 upstream-first → PR naar vAmigaWeb maken op termijn)

### B. FS-vrije route via wasm_take_user_snapshot ← gekozen
- vAmigaWeb biedt al een API die JSON returnt met directe HEAP-pointer (main.cpp:1257-1295)
- Geen rebuild, geen submodule-patch, **direct werkbaar**

Gekozen: **B**. Native API gebruiken in plaats van submodule patchen.

## Fix-detail

### Save (oude → nieuwe route)

```js
// OUD (v0.0.5-v0.0.12)
function saveStateToBuffer() {
  const path = '/tmp/amigahorse.snap';
  saveWorkspaceRaw(path);                  // wasm_save_workspace
  const buf = Module.FS.readFile(path);    // ← undefined.readFile = CRASH
  ...
}

// NIEUW (v0.0.13)
function saveStateToBuffer() {
  const jsonStr = takeUserSnapshotRaw();   // wasm_take_user_snapshot
  const meta = JSON.parse(jsonStr);        // { address, size, width, height }
  const view = Module.HEAPU8.subarray(meta.address, meta.address + meta.size);
  return new Uint8Array(view);             // expliciete copy
}
```

### Restore (oude → nieuwe route)

```js
// OUD
function restoreStateFromBuffer(buf) {
  const path = '/tmp/amigahorse.snap';
  Module.FS.writeFile(path, buf);          // ← undefined.writeFile
  loadWorkspaceRaw(path);
  ...
}

// NIEUW — gebruikt bestaande loadFile met snapshot-branch
function restoreStateFromBuffer(buf) {
  return loadFile('snapshot.snap', buf, 0);
}
```

vAmigaWeb's `_wasm_loadFile` herkent snapshots via `Snapshot::isCompatible(blob,len) && extractSuffix(filename)!="rom"` op main.cpp:1722 → branche match → `wrapper->emu->amiga.loadSnapshot(*file)`. Header-magic-check, dus filename `.snap` is alleen guard tegen ROM-branche.

## Snapshot vs Workspace — bewuste keuze

- **Snapshot:** point-in-time amiga-state (CPU+RAM+chipset+disk-content). Wat wij nodig hebben voor BASIC warm-snapshot.
- **Workspace:** bredere config (incl. drive-paths/mounted-image-references). Vooral relevant voor multi-disk-game-projecten.

Voor warm-snapshot is snapshot voldoende. Voor de Full-mode multi-disk-projecten (v0.0.9 toegevoegd) blijft de workspace-API beschikbaar voor toekomstige uitbreiding.

## Verified (statisch)

- ✓ `node --check src/wasm-bridge.js`
- ✓ Live `dist/chunk-R2QVYZEQ.js` bevat `wasm_take_user_snapshot` (2 hits) + nieuwe saveStateToBuffer-body
- ✓ Live chunks `FS.readFile|FS.writeFile`: 0 hits (oude route volledig weg)
- ✓ Function hoist-order in `bindFunctions` is TDZ-vrij (takeUserSnapshotRaw vóór loadFile vóór saveStateToBuffer vóór restoreStateFromBuffer)
- ✓ main.cpp:1257-1295 wasm_take_user_snapshot JSON-schema geïnspecteerd
- ✓ main.cpp:1722-1745 Snapshot-branche in loadFile geïnspecteerd

## Open na v0.0.13 (resume)

- **User bake-test:** hard-refresh (`Cmd+Shift+R`) → F12 console → klik Bake. Verwacht: stage 9 `→ result: Uint8Array(...)` (snapshot-grootte mogelijk veel kleiner dan workspace — denk: 256KB-1MB i.p.v. multi-MB). Daarna stage 10 storeAsset + redirect naar `/basic/`.
- **Mogelijk nieuwe symptoom:** Quick BASIC drop `.bas` zou nu via nieuwe restoreStateFromBuffer-route lopen. Als snapshot-branch in loadFile niet match (bv. header-magic verschilt door vAmiga-versie), → vAmiga logt "isSnapshot" of error. v0.0.14 als nodig.
- **Mogelijk volgend symptoom (pre-emptief gespot):** main.cpp:2301 gebruikt jQuery `$("#host_fps").html(...)` — als FPS-overlay periodiek triggert → `$ is not defined`. Stub `window.$` in v0.0.14 als gesignaleerd.
- **Architectonisch (v0.0.14+):** `docs/CORE_API_CONTRACT.md` — 2-richtings-contract documenteren + snapshot-vs-workspace beslissingsmatrix.

## Commits in deze sessie

1. `AmigaHorse_Web`: wasm-bridge.js FS-bypass + VERSION + CHANGELOG + dit sessie-MD
2. `Meta_AmigaHorse`: codename-pool update (Super Frog: pool → toegewezen)

## Niet aangeraakt

- `external/vamigaweb/` submodule (P-AMH-01 upstream-first respected)
- `Meta_Master`: clean ✓
