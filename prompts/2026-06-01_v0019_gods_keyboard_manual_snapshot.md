---
date: 2026-06-01
repo: AmigaHorse_Web
version: 0.0.19-Gods
status: open
resume: "verder met AmigaHorse_Web v0.0.19-Gods — re-bake via manual-flow: Start bake → 12s wachten → muis-dubbelklik Workbench1.3 → muis-dubbelklik Shell → keyboard 'AmigaBasic'<RET> → AmigaBASIC opent → klik Snapshot now → redirect naar /basic/ → drop sample.bas werkt"
---

# AmigaHorse_Web v0.0.19-Gods — live keyboard + manual snapshot-now flow

**Sessie:** Vervolg op v0.0.18-XenonII. User: "als ik shell open zie ik verder niets" + "ik heb 2 disks gemount maar als ik klik op bas gebeurt er niets" (later: corrigeerde naar "opent venster maar leeg" = normaal gedrag).
**Classificatie:** Oranje feature (nieuwe input-component + bake-flow herontwerp).
**Bug-trail:** 9e iteratie in dezelfde debug-sessie (v0.0.11-19).

## Root cause

Twee samenhangende issues:

### Issue 1 — Geen live keyboard handler

`mouse-input.js` bestond sinds v0.0.6 (al was muis-protocol broken tot v0.0.18). Maar er was **nooit** een KeyboardInput voor user-typing. `wasm_key`-cwrap bestond wel (sinds v0.0.6) maar werd alleen via `playSequence` aangeroepen voor scripted typing in setup.js.

Gevolg: user opent Shell in Workbench → typt op fysiek toetsenbord → toetsen gaan naar **browser**, niet naar vAmiga → Shell krijgt geen input → kan niet `AmigaBasic` typen.

### Issue 2 — Scripted bake-flow onbetrouwbaar

setup.js v0.0.11-17 deed:
- Stage 7: `playSequence('AmigaBASIC\r')` — werkt alleen als user in Shell-prompt staat
- Stage 8: `scriptedDoubleClick(270, 100)` — gokje op AmigaBASIC-icon-coord

Beide stages werkten niet:
- WB 1.3 boot landt op **Workbench-desktop**, niet in Shell → keyboard typing nutteloos
- AmigaBASIC zit **niet** op WB-desktop maar in Workbench1.3-disk-window → 2x dubbelklik nodig (eerst disk, dan Shell of AmigaBasic-icon)
- Coordinaat (270, 100) is in upper-left van scherm, niet waar enige relevant icoon staat
- v0.0.11-17: muis-protocol sowieso broken (delta ipv abs) → scriptedDoubleClick deed sowieso niets correct

## Fix v0.0.19 — Manual checkpoint pattern

### Nieuwe component: `src/lib/keyboard-input.js`

```js
export class KeyboardInput {
  constructor(target, bindings) { ... }
  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }
  _handleKey(e, pressed) {
    if (isBrowserReservedShortcut(e)) return;
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const amigaCode = CODE_TO_RAWKEY[e.code];
    if (amigaCode === undefined) return;
    e.preventDefault();
    if (pressed && this.pressedKeys.has(amigaCode)) return;  // dedupe repeat
    this.pressedKeys[pressed ? 'add' : 'delete'](amigaCode);
    this.bindings.key(amigaCode, pressed);
  }
  _releaseAll() { /* op blur — geen sticky keys */ }
}
```

`CODE_TO_RAWKEY` mappt browser-`KeyboardEvent.code` (US-physical-position, layout-onafhankelijk) → Amiga rawkey uit `amiga-keymap.js`. 50+ keys gemapped.

### Bake-flow herontwerp

`setup.js` stages 7+8 weg. Nieuwe flow:

```
Stage 1-4b: init → ROM → powerOn → disk → reset (zoals v0.0.17)
Stage 5: renderer + MouseInput + KeyboardInput attached op bake-canvas
Stage 6: run
sleep(12s) — WB boot
elSnapshot.disabled = false   ← Snapshot-knop wordt actief

[User navigeert handmatig:]
  - Dubbelklik Workbench1.3-disk → opent window
  - Dubbelklik Shell → opent CLI
  - Type "AmigaBasic" + Enter → AmigaBASIC opent
  - Klik "Snapshot now"

Stage 9 (button-handler): saveStateToBuffer
Stage 10 (button-handler): storeAsset → redirect /basic/
```

### Setup.html

```html
<button id="bake-button" disabled>Start bake</button>
<button id="snapshot-button" disabled>Snapshot now</button>
```

Plus instructie-paragraaf met stap-voor-stap.

### Quick-launch ook keyboard

`quick-launch.js`: ook `KeyboardInput` attached → user kan met BASIC-programma interageren post-RUN (INPUT-statements, error-correctie, MENU-keuzes).

## Verified (statisch)

- ✓ `node --check` op alle 3 gewijzigde + 1 nieuw bestand
- ✓ `wasm_key(int code, int pressed)` body main.cpp:924 bevestigd
- ✓ Live bundle `dist/chunk-KJGJEPEV.js`: `KeyboardInput` + `CODE_TO_RAWKEY` aanwezig
- ✓ Live `dist/basic/setup.html`: Snapshot-now-button aanwezig

## Open na v0.0.19 (resume)

- User re-bake test:
  - 12 sec na klik Bake → Snapshot-knop actief
  - Manuele navigatie WB → Shell → AmigaBasic → Snapshot
  - Quick-launch drop sample.bas → echte BASIC-output
- Touchscreen-keyboard (Z-Fold)
- Speciale toetsen (Help, Right-Amiga) op-screen
- `docs/PRINCIPLES.md` P-AMH-10: manual warm-snapshot pattern

## Bug-trail summary (v0.0.10 → v0.0.19, één debug-sessie)

| Versie | Codenaam | Bug | Fix |
|---|---|---|---|
| v0.0.11 | Alien Breed | ROM-flash filename | `.rom` → `.rom_file` |
| v0.0.12 | Project-X | EM_ASM-callback missing | stubs |
| v0.0.13 | Super Frog | Module.FS undefined | FS-bypass |
| v0.0.14 | IK+ | Stale size-gate | MAX_FILE_SIZE |
| v0.0.15 | Populous | Frame-step ontbrak | execute() |
| v0.0.16 | Stunt Car Racer | HPIXELS-stride + height=0px | viewport-capture |
| v0.0.17 | Lotus Esprit Turbo | Bake-snapshot Kickstart-only | hardReset() |
| v0.0.18 | Xenon 2 Megablast | Muis REL + button-IDs + aspect | track delta, BTN 1/3, ×2×1.03 |
| v0.0.19 | Gods | Geen keyboard + auto-bake onbetrouwbaar | KeyboardInput + manual-checkpoint |

9 versies in één sessie. Eerste 8 = Geel binding-bug, v0.0.19 = Oranje feature (nieuwe component + flow-herontwerp).

## Commits

1. `AmigaHorse_Web`: keyboard-input.js (nieuw) + setup.js (manual flow) + quick-launch.js (keyboard attach) + setup.html (knop) + VERSION + CHANGELOG + sessie-MD
2. `Meta_AmigaHorse`: codename-pool (Gods toegewezen)
