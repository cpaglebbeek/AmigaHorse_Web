// AmigaHorse_Web — Audio setup (v0.0.6-Apidya, sub-step 6, skelet)
//
// **Status v0.0.6:** alleen sample-rate-init + AudioContext-reserve. De
// werkelijke audio-sink (AudioWorklet of polling via main-thread) komt in
// sub-step 7. Reden: AudioWorklet met low-latency vereist SharedArrayBuffer
// → COOP+COEP-headers → ofwel worker-mode-vAmiga build, ofwel
// alternatieve sample-shipping (postMessage met latency).
//
// Voor nu: silent canvas (geen audio). Bewust geparkeerd om sub-step 6 op
// canvas+mouse te focussen.
//
// Sub-step 7 schets:
//   1. Bepaal vAmiga's sample-rate (typisch 44100 of 48000)
//   2. wasm_set_sample_rate(rate)
//   3. AudioContext + AudioWorkletNode
//   4. Loop (timer of ScriptProcessor-pollback): wasm_update_audio →
//      wasm_leftChannelBuffer / wasm_rightChannelBuffer pointers →
//      HEAPU8/HEAPF32 copy → AudioWorklet ring-buffer →
//      audio-thread leest + speelt af

const DEFAULT_SAMPLE_RATE = 44100;

export class AudioSetup {
  /**
   * @param {object} bindings — uit getBindings()
   */
  constructor(bindings) {
    this.bindings = bindings;
    this.ctx = null;
    this.initialized = false;
  }

  /**
   * Initialiseer AudioContext + zet vAmiga sample-rate.
   * Moet aangeroepen vanaf user-gesture (Chrome auto-blockt anders).
   */
  async init() {
    if (this.initialized) return;
    try {
      this.ctx = new AudioContext({ sampleRate: DEFAULT_SAMPLE_RATE });
      this.bindings.setSampleRate(this.ctx.sampleRate);
      // TODO sub-step 7: addModule audio-processor.js + AudioWorkletNode + connect
      console.log(`[audio-setup] context ready (rate=${this.ctx.sampleRate}); sink in sub-step 7`);
      this.initialized = true;
    } catch (err) {
      console.warn('[audio-setup] init faalde:', err.message);
    }
  }

  /**
   * Suspend audio (bv. bij pauze).
   */
  async suspend() {
    if (this.ctx && this.ctx.state === 'running') {
      await this.ctx.suspend();
    }
  }

  async resume() {
    if (this.ctx && this.ctx.state !== 'running') {
      await this.ctx.resume();
    }
  }
}
