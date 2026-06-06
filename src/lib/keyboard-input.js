// AmigaHorse_Web — Live keyboard input bridge (v0.0.19-Gods)
//
// DOM keydown/keyup events → vAmiga's `wasm_key(code, pressed)`.
//
// **Probleem v0.0.6 t/m v0.0.18:** Geen live keyboard handler — alleen
// `playSequence` voor scripted typing. User kon Shell openen maar niet typen.
//
// **Protocol:** `wasm_key(code, pressed)` (main.cpp:924) — `code` is Amiga
// rawkey (zie amiga-keymap.js RAWKEY), `pressed` is 1 (down) of 0 (up).
//
// **Mapping:** Browser `KeyboardEvent.code` (US-layout physical position) →
// Amiga rawkey. We gebruiken `code` (niet `key`) zodat layout-onafhankelijk:
// een gebruiker met NL/DE keyboard krijgt nog steeds de juiste Amiga-key.

import { RAWKEY } from './amiga-keymap.js';

// Browser KeyboardEvent.code → Amiga rawkey
// (US-layout physical positions; layout-onafhankelijk)
const CODE_TO_RAWKEY = {
  // Letters
  KeyA: RAWKEY.A, KeyB: RAWKEY.B, KeyC: RAWKEY.C, KeyD: RAWKEY.D,
  KeyE: RAWKEY.E, KeyF: RAWKEY.F, KeyG: RAWKEY.G, KeyH: RAWKEY.H,
  KeyI: RAWKEY.I, KeyJ: RAWKEY.J, KeyK: RAWKEY.K, KeyL: RAWKEY.L,
  KeyM: RAWKEY.M, KeyN: RAWKEY.N, KeyO: RAWKEY.O, KeyP: RAWKEY.P,
  KeyQ: RAWKEY.Q, KeyR: RAWKEY.R, KeyS: RAWKEY.S, KeyT: RAWKEY.T,
  KeyU: RAWKEY.U, KeyV: RAWKEY.V, KeyW: RAWKEY.W, KeyX: RAWKEY.X,
  KeyY: RAWKEY.Y, KeyZ: RAWKEY.Z,

  // Digits (top row)
  Digit0: RAWKEY.N_0, Digit1: RAWKEY.N_1, Digit2: RAWKEY.N_2,
  Digit3: RAWKEY.N_3, Digit4: RAWKEY.N_4, Digit5: RAWKEY.N_5,
  Digit6: RAWKEY.N_6, Digit7: RAWKEY.N_7, Digit8: RAWKEY.N_8,
  Digit9: RAWKEY.N_9,

  // Symbols (US-layout positions)
  Backquote: RAWKEY.BACKQUOTE,
  Minus: RAWKEY.MINUS,
  Equal: RAWKEY.EQUAL,
  Backslash: RAWKEY.BACKSLASH,
  BracketLeft: RAWKEY.BRACKET_L,
  BracketRight: RAWKEY.BRACKET_R,
  Semicolon: RAWKEY.SEMICOLON,
  Quote: RAWKEY.QUOTE,
  Comma: RAWKEY.COMMA,
  Period: RAWKEY.PERIOD,
  Slash: RAWKEY.SLASH,

  // Control / whitespace
  Space: RAWKEY.SPACE,
  Backspace: RAWKEY.BACKSPACE,
  Tab: RAWKEY.TAB,
  Enter: RAWKEY.RETURN,
  NumpadEnter: RAWKEY.ENTER_NUMPAD,
  Escape: RAWKEY.ESC,
  Delete: RAWKEY.DEL,

  // Function keys
  F1: RAWKEY.F1, F2: RAWKEY.F2, F3: RAWKEY.F3, F4: RAWKEY.F4, F5: RAWKEY.F5,
  F6: RAWKEY.F6, F7: RAWKEY.F7, F8: RAWKEY.F8, F9: RAWKEY.F9, F10: RAWKEY.F10,

  // Modifiers
  ShiftLeft: RAWKEY.SHIFT_L,
  ShiftRight: RAWKEY.SHIFT_R,
  ControlLeft: RAWKEY.CTRL,
  ControlRight: RAWKEY.CTRL,
  AltLeft: RAWKEY.ALT_L,
  AltRight: RAWKEY.ALT_R,
  MetaLeft: RAWKEY.AMIGA_L,    // Cmd/Win → Amiga-key
  MetaRight: RAWKEY.AMIGA_R,
};

// Browser-shortcuts die we niet willen onderscheppen (open dev-tools, reload, etc.)
// F12, Ctrl+R, Ctrl+Shift+I/J, Cmd+R/Q, etc. blijven naar browser gaan.
function isBrowserReservedShortcut(e) {
  if (e.code === 'F12') return true;
  if ((e.ctrlKey || e.metaKey) && ['KeyR', 'KeyL', 'KeyT', 'KeyW', 'KeyQ', 'KeyN'].includes(e.code)) return true;
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['KeyI', 'KeyJ', 'KeyC'].includes(e.code)) return true;
  return false;
}

export class KeyboardInput {
  /**
   * @param {HTMLElement} target — canvas of window. Events worden op deze element gehookt.
   * @param {object} bindings   — uit getBindings()
   */
  constructor(target, bindings) {
    this.target = target;
    this.bindings = bindings;
    this.attached = false;
    this.pressedKeys = new Set();   // dedupe + cleanup-on-blur
    this._onKeyDown = (e) => this._handleKey(e, 1);
    this._onKeyUp = (e) => this._handleKey(e, 0);
    this._onBlur = () => this._releaseAll();
  }

  attach() {
    if (this.attached) return;
    // Window-level zodat keyboard altijd werkt zonder canvas-focus.
    // Canvas-focus management (tabindex) is omslachtig + niet betrouwbaar.
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    this.attached = true;
  }

  detach() {
    if (!this.attached) return;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this._releaseAll();
    this.attached = false;
  }

  /**
   * Release alle ingedrukte toetsen (bv. bij tab-switch).
   */
  _releaseAll() {
    for (const code of this.pressedKeys) {
      this.bindings.key(code, 0);
    }
    this.pressedKeys.clear();
  }

  _handleKey(e, pressed) {
    if (isBrowserReservedShortcut(e)) return;

    // Tijdens .bas-drop of input-field-typing willen we de keystroke NIET
    // naar vAmiga sturen. Detecteer: focus op input, textarea, [contenteditable].
    const t = document.activeElement;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
      return;
    }

    const amigaCode = CODE_TO_RAWKEY[e.code];
    if (amigaCode === undefined) {
      // Onbekende toets — log voor debug (eenmaal per session voldoende)
      return;
    }
    e.preventDefault();

    if (pressed) {
      // Dedupe: vermijd repeat-events meerdere keren "down" sturen
      if (this.pressedKeys.has(amigaCode)) return;
      this.pressedKeys.add(amigaCode);
    } else {
      this.pressedKeys.delete(amigaCode);
    }
    this.bindings.key(amigaCode, pressed);
  }
}
