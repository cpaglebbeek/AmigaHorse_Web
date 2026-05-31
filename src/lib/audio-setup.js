// AmigaHorse_Web — Audio sink (v0.0.7-ChaosEngine, sub-step 7)
//
// ScriptProcessorNode-based audio sink. Deprecated maar werkt zonder
// COOP+COEP-headers / SharedArrayBuffer / worker-mode. Latency ~10-20ms,
// voldoende voor retro-emulatie.
//
// Pipeline:
//   1. setSampleRate(ctx.sampleRate) → vAmiga genereert in dezelfde rate
//   2. ScriptProcessorNode buffer-size 2048 samples (~46ms @ 44.1kHz)
//   3. onaudioprocess:
//        a. bindings.copyIntoSoundBuffer() → vAmiga vult interne float-buffer
//        b. Read L+R pointers + length samples uit HEAPF32
//        c. Kopieer naar output-buffer (stereo)
//   4. node.connect(ctx.destination) → speakers
//
// Chrome auto-blockt AudioContext tot user-gesture; aanroeper roept
// `resume()` aan vanaf click-handler.
//
// **Later (v0.x):** AudioWorklet + SharedArrayBuffer ring-buffer voor lagere
// latency. Vereist COOP+COEP-headers + (mogelijk) worker-mode vAmiga build.
// Zie `audio-processor-TODO.md` voor het migratie-plan.

const BUFFER_SIZE = 2048;          // ScriptProcessor sample-buffer (power of 2)

export class AudioSetup {
  /**
   * @param {object} bindings — uit getBindings()
   * @param {object} Module   — uit getModule(), nodig voor HEAPF32-access
   */
  constructor(bindings, Module) {
    this.bindings = bindings;
    this.Module = Module;
    this.ctx = null;
    this.node = null;
    this.initialized = false;
    this.muted = false;
    this.underrunCount = 0;
    this.lastUnderrunLog = 0;
  }

  /**
   * Initialiseer AudioContext + ScriptProcessorNode + connect naar speakers.
   * Idempotent. Moet aangeroepen vanaf user-gesture (Chrome auto-blockt anders),
   * of caller doet `resume()` na eerste click.
   */
  async init() {
    if (this.initialized) return;
    if (!this.Module) {
      console.warn('[audio-setup] Module ontbreekt, audio niet geactiveerd');
      return;
    }
    try {
      this.ctx = new AudioContext();
      const sampleRate = this.ctx.sampleRate;
      this.bindings.setSampleRate(sampleRate);

      // ScriptProcessorNode: 0 inputs, 2 outputs (stereo)
      this.node = this.ctx.createScriptProcessor(BUFFER_SIZE, 0, 2);
      this.node.onaudioprocess = (e) => this._process(e);
      this.node.connect(this.ctx.destination);

      console.log(`[audio-setup] sink actief: ScriptProcessorNode @ ${sampleRate}Hz, buffer ${BUFFER_SIZE}`);
      this.initialized = true;
    } catch (err) {
      console.warn('[audio-setup] init faalde:', err.message);
    }
  }

  /**
   * onaudioprocess callback: vul output-channels met vAmiga-samples.
   */
  _process(e) {
    if (this.muted) {
      this._fillSilence(e.outputBuffer);
      return;
    }

    const outLeft = e.outputBuffer.getChannelData(0);
    const outRight = e.outputBuffer.getChannelData(1);
    const samples = outLeft.length;   // = BUFFER_SIZE

    try {
      // Vraag vAmiga om buffer te vullen met `samples` nieuwe samples
      this.bindings.copyIntoSoundBuffer();

      const leftPtr = this.bindings.leftChannelBuffer();
      const rightPtr = this.bindings.rightChannelBuffer();

      if (leftPtr === 0 || rightPtr === 0) {
        // vAmiga heeft (nog) geen geldige buffer → stilte
        this._fillSilence(e.outputBuffer);
        return;
      }

      // HEAPF32-view op vAmiga's float-buffers.
      // Pointer is byte-offset in HEAPU8; HEAPF32 uses index = bytePtr / 4
      const leftIdx = leftPtr >> 2;
      const rightIdx = rightPtr >> 2;
      const heap = this.Module.HEAPF32;

      // Copy + clamp [-1, 1] (defensief tegen vAmiga-bug)
      for (let i = 0; i < samples; i++) {
        const l = heap[leftIdx + i] || 0;
        const r = heap[rightIdx + i] || 0;
        outLeft[i] = Math.max(-1, Math.min(1, l));
        outRight[i] = Math.max(-1, Math.min(1, r));
      }
    } catch (err) {
      this.underrunCount++;
      const now = performance.now();
      if (now - this.lastUnderrunLog > 5000) {
        console.warn(`[audio-setup] underrun ${this.underrunCount}x: ${err.message}`);
        this.lastUnderrunLog = now;
      }
      this._fillSilence(e.outputBuffer);
    }
  }

  _fillSilence(outputBuffer) {
    for (let ch = 0; ch < outputBuffer.numberOfChannels; ch++) {
      const data = outputBuffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) data[i] = 0;
    }
  }

  /**
   * Resume audio-context (vereist na user-gesture in Chrome).
   */
  async resume() {
    if (this.ctx && this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
        console.log('[audio-setup] context resumed');
      } catch (err) {
        console.warn('[audio-setup] resume faalde:', err.message);
      }
    }
  }

  async suspend() {
    if (this.ctx && this.ctx.state === 'running') {
      await this.ctx.suspend();
    }
  }

  mute() { this.muted = true; }
  unmute() { this.muted = false; }
}
