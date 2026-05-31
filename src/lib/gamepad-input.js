// AmigaHorse_Web — Gamepad input bridge (v0.0.8-DefenderOfTheCrown, sub-step 8)
//
// HTML5 Gamepad API → `bindings.joystick("<port><event>")`.
//
// vAmiga's wasm_joystick format (uit main.cpp):
//   String: "<port><event>" met port='1'|'2' en event uit:
//     PULL_UP, PULL_DOWN, PULL_LEFT, PULL_RIGHT
//     PRESS_FIRE
//     RELEASE_X, RELEASE_Y, RELEASE_XY, RELEASE_FIRE
//
// Pattern: poll gamepad-state op rAF, vergelijk met vorige state, stuur events
// alleen bij wijziging. Geen polling-overhead op Amiga-side.
//
// Mapping (standaard gamepad):
//   D-pad / left-stick   → joystick directions
//   Button A (south)     → fire
//   Button Start         → menu (TODO sub-step 9)
//
// Port: standaard port 1 (Amiga-conventie). Tweede gamepad → port 2 in v0.x.

const DEADZONE = 0.3;

export class GamepadInput {
  /**
   * @param {object} bindings — uit getBindings() (heeft .joystick methode)
   * @param {object} opts
   *   .port — '1' of '2' (default '1')
   */
  constructor(bindings, opts = {}) {
    this.bindings = bindings;
    this.port = opts.port || '1';
    this.attached = false;
    this.rafHandle = null;
    // Vorige state om alleen-bij-wijziging events te sturen
    this.last = {
      up: false, down: false, left: false, right: false, fire: false,
    };
  }

  attach() {
    if (this.attached) return;
    if (!('getGamepads' in navigator)) {
      console.warn('[gamepad] Gamepad API niet beschikbaar in deze browser');
      return;
    }
    this.attached = true;
    this._tick();
  }

  detach() {
    this.attached = false;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    // Laat alle knoppen los om sticky-state te voorkomen
    if (this.last.fire) this.bindings.joystick(this.port + 'RELEASE_FIRE');
    if (this.last.up || this.last.down) this.bindings.joystick(this.port + 'RELEASE_Y');
    if (this.last.left || this.last.right) this.bindings.joystick(this.port + 'RELEASE_X');
    this.last = { up: false, down: false, left: false, right: false, fire: false };
  }

  _tick() {
    if (!this.attached) return;

    const pads = navigator.getGamepads();
    let pad = null;
    for (const p of pads) {
      if (p && p.connected) { pad = p; break; }
    }

    if (pad) {
      // D-pad heeft typisch axes 0-1 (lefty-stick) en buttons 12-15 (D-pad up/down/left/right)
      const ax = pad.axes[0] || 0;
      const ay = pad.axes[1] || 0;
      const dpadUp    = (pad.buttons[12] && pad.buttons[12].pressed) || ay < -DEADZONE;
      const dpadDown  = (pad.buttons[13] && pad.buttons[13].pressed) || ay >  DEADZONE;
      const dpadLeft  = (pad.buttons[14] && pad.buttons[14].pressed) || ax < -DEADZONE;
      const dpadRight = (pad.buttons[15] && pad.buttons[15].pressed) || ax >  DEADZONE;
      // Button 0 = south (Xbox A / PlayStation Cross) = primary fire
      const fire = !!(pad.buttons[0] && pad.buttons[0].pressed);

      this._emit('up', dpadUp, 'PULL_UP');
      this._emit('down', dpadDown, 'PULL_DOWN');
      this._emit('left', dpadLeft, 'PULL_LEFT');
      this._emit('right', dpadRight, 'PULL_RIGHT');
      this._emit('fire', fire, 'PRESS_FIRE');

      // Release-events bij Y-axis (up XOR down) en X-axis (left XOR right) overgang naar 0
      const yWasActive = this.last.up || this.last.down;
      const yIsActive = dpadUp || dpadDown;
      if (yWasActive && !yIsActive) this.bindings.joystick(this.port + 'RELEASE_Y');
      const xWasActive = this.last.left || this.last.right;
      const xIsActive = dpadLeft || dpadRight;
      if (xWasActive && !xIsActive) this.bindings.joystick(this.port + 'RELEASE_X');
      if (this.last.fire && !fire) this.bindings.joystick(this.port + 'RELEASE_FIRE');

      this.last = { up: dpadUp, down: dpadDown, left: dpadLeft, right: dpadRight, fire };
    }

    this.rafHandle = requestAnimationFrame(() => this._tick());
  }

  _emit(stateKey, value, eventStr) {
    if (value && !this.last[stateKey]) {
      this.bindings.joystick(this.port + eventStr);
    }
  }
}
