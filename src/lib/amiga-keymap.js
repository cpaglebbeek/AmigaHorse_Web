// AmigaHorse_Web — Amiga rawkey-code mapping (v0.0.5-RType, sub-step 5)
//
// ASCII → Amiga raw key-codes voor wasm_key / wasm_schedule_key sequences.
//
// Refs: Amiga Hardware Reference Manual ("Amiga Rom Kernel Manual: Devices",
// keyboard.device sectie), Amiga A500 US-layout. Code-tabel is voor 'usa1'
// layout (default voor KS 1.3 + WB 1.3).
//
// Gebruik:
//   const seq = encodeStringToSequence('LOAD "DF1:launch.bas"\r');
//   for (const ev of seq) {
//     bindings.key(ev.code, ev.pressed);
//     await sleep(ev.delayMs);
//   }

// ---------------------------------------------------------------------------
// Raw key-codes (Amiga keymap, US layout)
// ---------------------------------------------------------------------------

export const RAWKEY = Object.freeze({
  // Numbers (top row): `, 1-0, -, =, \
  BACKQUOTE: 0x00,
  N_1: 0x01,
  N_2: 0x02,
  N_3: 0x03,
  N_4: 0x04,
  N_5: 0x05,
  N_6: 0x06,
  N_7: 0x07,
  N_8: 0x08,
  N_9: 0x09,
  N_0: 0x0A,
  MINUS: 0x0B,
  EQUAL: 0x0C,
  BACKSLASH: 0x0D,

  // Top alpha row: Q W E R T Y U I O P [ ]
  Q: 0x10, W: 0x11, E: 0x12, R: 0x13, T: 0x14, Y: 0x15,
  U: 0x16, I: 0x17, O: 0x18, P: 0x19,
  BRACKET_L: 0x1A,
  BRACKET_R: 0x1B,

  // Home row: A S D F G H J K L ; '
  A: 0x20, S: 0x21, D: 0x22, F: 0x23, G: 0x24, H: 0x25,
  J: 0x26, K: 0x27, L: 0x28,
  SEMICOLON: 0x29,
  QUOTE: 0x2A,

  // Bottom row: \ Z X C V B N M , . /
  BACKSLASH_BOTTOM: 0x30,
  Z: 0x31, X: 0x32, C: 0x33, V: 0x34, B: 0x35, N: 0x36, M: 0x37,
  COMMA: 0x38,
  PERIOD: 0x39,
  SLASH: 0x3A,

  // Control keys
  SPACE: 0x40,
  BACKSPACE: 0x41,
  TAB: 0x42,
  ENTER_NUMPAD: 0x43,
  RETURN: 0x44,
  ESC: 0x45,
  DEL: 0x46,

  // Function keys
  F1: 0x50, F2: 0x51, F3: 0x52, F4: 0x53, F5: 0x54,
  F6: 0x55, F7: 0x56, F8: 0x57, F9: 0x58, F10: 0x59,

  // Modifier keys
  SHIFT_L: 0x60,
  SHIFT_R: 0x61,
  CTRL: 0x63,
  ALT_L: 0x64,
  ALT_R: 0x65,
  AMIGA_L: 0x66,
  AMIGA_R: 0x67,
});

// ---------------------------------------------------------------------------
// ASCII → Amiga key-mapping
// ---------------------------------------------------------------------------

// Lowercase letters → directe rawkey (geen shift)
const LOWERCASE_MAP = {
  'a': RAWKEY.A, 'b': RAWKEY.B, 'c': RAWKEY.C, 'd': RAWKEY.D, 'e': RAWKEY.E,
  'f': RAWKEY.F, 'g': RAWKEY.G, 'h': RAWKEY.H, 'i': RAWKEY.I, 'j': RAWKEY.J,
  'k': RAWKEY.K, 'l': RAWKEY.L, 'm': RAWKEY.M, 'n': RAWKEY.N, 'o': RAWKEY.O,
  'p': RAWKEY.P, 'q': RAWKEY.Q, 'r': RAWKEY.R, 's': RAWKEY.S, 't': RAWKEY.T,
  'u': RAWKEY.U, 'v': RAWKEY.V, 'w': RAWKEY.W, 'x': RAWKEY.X, 'y': RAWKEY.Y,
  'z': RAWKEY.Z,
};

// Digits — directe rawkey
const DIGIT_MAP = {
  '0': RAWKEY.N_0, '1': RAWKEY.N_1, '2': RAWKEY.N_2, '3': RAWKEY.N_3, '4': RAWKEY.N_4,
  '5': RAWKEY.N_5, '6': RAWKEY.N_6, '7': RAWKEY.N_7, '8': RAWKEY.N_8, '9': RAWKEY.N_9,
};

// Non-shift symbols — directe rawkey
const SYMBOL_MAP = {
  '`': RAWKEY.BACKQUOTE,
  '-': RAWKEY.MINUS,
  '=': RAWKEY.EQUAL,
  '\\': RAWKEY.BACKSLASH,
  '[': RAWKEY.BRACKET_L,
  ']': RAWKEY.BRACKET_R,
  ';': RAWKEY.SEMICOLON,
  '\'': RAWKEY.QUOTE,
  ',': RAWKEY.COMMA,
  '.': RAWKEY.PERIOD,
  '/': RAWKEY.SLASH,
  ' ': RAWKEY.SPACE,
  '\t': RAWKEY.TAB,
  '\r': RAWKEY.RETURN,
  '\n': RAWKEY.RETURN,
};

// Shifted symbols — SHIFT + rawkey
const SHIFTED_SYMBOL_MAP = {
  '~': RAWKEY.BACKQUOTE,
  '!': RAWKEY.N_1,
  '@': RAWKEY.N_2,
  '"': RAWKEY.N_2,   // op Amiga US-keymap is "" SHIFT+2 (zoals oude typmachine)
  '#': RAWKEY.N_3,
  '$': RAWKEY.N_4,
  '%': RAWKEY.N_5,
  '^': RAWKEY.N_6,
  '&': RAWKEY.N_7,
  '*': RAWKEY.N_8,
  '(': RAWKEY.N_9,
  ')': RAWKEY.N_0,
  '_': RAWKEY.MINUS,
  '+': RAWKEY.EQUAL,
  '|': RAWKEY.BACKSLASH,
  '{': RAWKEY.BRACKET_L,
  '}': RAWKEY.BRACKET_R,
  ':': RAWKEY.SEMICOLON,
  '<': RAWKEY.COMMA,
  '>': RAWKEY.PERIOD,
  '?': RAWKEY.SLASH,
};

/**
 * Convert ASCII-char → { code, needsShift } of null als char niet mapt.
 */
function asciiToRawKey(ch) {
  if (ch in LOWERCASE_MAP) return { code: LOWERCASE_MAP[ch], needsShift: false };
  if (ch in DIGIT_MAP)     return { code: DIGIT_MAP[ch], needsShift: false };
  if (ch in SYMBOL_MAP)    return { code: SYMBOL_MAP[ch], needsShift: false };
  if (ch in SHIFTED_SYMBOL_MAP) return { code: SHIFTED_SYMBOL_MAP[ch], needsShift: true };
  // Uppercase: SHIFT + lowercase
  const lower = ch.toLowerCase();
  if (lower in LOWERCASE_MAP) return { code: LOWERCASE_MAP[lower], needsShift: true };
  return null;
}

/**
 * Encode een string naar Amiga key-event sequence.
 *
 * Returns: Array<{ code, pressed, delayMs }>
 *   code     = Amiga rawkey
 *   pressed  = 1 (down) of 0 (up)
 *   delayMs  = ms voor we de volgende event sturen (typing-rate)
 *
 * Default typing-rate: ~50ms per char (volstaat voor BASIC-prompt zonder verlies).
 *
 * @param {string} str — ASCII-string
 * @param {object} opts
 *   .charDelayMs — delay tussen chars (default 50)
 *   .keyDelayMs  — delay tussen press en release (default 20)
 */
export function encodeStringToSequence(str, opts = {}) {
  const { charDelayMs = 50, keyDelayMs = 20 } = opts;
  const seq = [];
  let shiftActive = false;

  for (const ch of str) {
    const mapping = asciiToRawKey(ch);
    if (!mapping) {
      console.warn(`[amiga-keymap] geen mapping voor "${ch}" (0x${ch.charCodeAt(0).toString(16)})`);
      continue;
    }

    // Manage SHIFT-state. Druk shift in als nodig, laat los als niet meer.
    if (mapping.needsShift && !shiftActive) {
      seq.push({ code: RAWKEY.SHIFT_L, pressed: 1, delayMs: keyDelayMs });
      shiftActive = true;
    } else if (!mapping.needsShift && shiftActive) {
      seq.push({ code: RAWKEY.SHIFT_L, pressed: 0, delayMs: keyDelayMs });
      shiftActive = false;
    }

    // Character key down + up
    seq.push({ code: mapping.code, pressed: 1, delayMs: keyDelayMs });
    seq.push({ code: mapping.code, pressed: 0, delayMs: charDelayMs });
  }

  // Laat eventuele blijvende shift los
  if (shiftActive) {
    seq.push({ code: RAWKEY.SHIFT_L, pressed: 0, delayMs: keyDelayMs });
  }

  return seq;
}

/**
 * Play een key-sequence door bindings.key() te roepen met de juiste delays.
 *
 * @param {object} bindings — uit getBindings() (heeft .key methode)
 * @param {Array} seq       — uit encodeStringToSequence
 */
export async function playSequence(bindings, seq) {
  for (const ev of seq) {
    bindings.key(ev.code, ev.pressed);
    await new Promise((resolve) => setTimeout(resolve, ev.delayMs));
  }
}

// Exports voor testing
export const _internal = { LOWERCASE_MAP, DIGIT_MAP, SYMBOL_MAP, SHIFTED_SYMBOL_MAP, asciiToRawKey };
