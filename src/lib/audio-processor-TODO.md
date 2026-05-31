# Audio-processor (AudioWorklet) — geparkeerd voor v0.x

> Status: **niet actief** in v0.0.7-ChaosEngine.
> Sub-step 7 gebruikt `ScriptProcessorNode` (deprecated maar werkt zonder COOP+COEP-headers).
> Migratie naar AudioWorklet = v0.x feature-keuze.

## Waarom uitgesteld

AudioWorklet-pipeline runt in audio-thread, los van main-thread (waar vAmiga
WASM draait). Twee opties om samples van WASM → audio-thread te transporteren:

| Optie | Latency | Code-volume | Vereisten |
|---|---|---|---|
| **SharedArrayBuffer ring-buffer** | ~5ms | ~150r | COOP+COEP-headers + (waarschijnlijk) worker-mode vAmiga |
| **postMessage met copy** | ~20ms | ~80r | géén — werkt overal |

Voor v0.0.7 niet de moeite waard tot we (a) worker-mode vAmiga willen, of
(b) latency-issues hebben in production. `ScriptProcessorNode` werkt vandaag
zonder configuratie.

## Migratie-plan (v0.x als nodig)

1. **Optie A — SharedArrayBuffer (best):**
   - Voeg `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` toe aan dev-server (esbuild custom-middleware) + production-host
   - Switch `external/vamigaweb/CMakeLists.txt` `thread_type` naar `"worker"`
   - Rebuild WASM via `npm run build:wasm`
   - Implementeer `audio-processor.js` (AudioWorkletProcessor) met SharedArrayBuffer ring-buffer + Atomics
   - Main-thread vult ring; audio-thread leest
   - Vervang `ScriptProcessorNode` in `audio-setup.js` met `AudioWorkletNode`

2. **Optie B — postMessage (eenvoudiger):**
   - Geen WASM-rebuild nodig
   - Main-thread roept `bindings.copyIntoSoundBuffer()` op 50Hz timer + post-message naar AudioWorklet met sample-arrays
   - AudioWorklet houdt interne buffer + speelt af
   - Hogere latency dan ScriptProcessor (door message-queue) — minder aanbevolen

## Trigger voor migratie

- Latency-klacht van user na live test (huidige ~20-46ms is meestal acceptabel voor retro)
- Worker-mode vAmiga-build nodig voor andere reden (bv. mobile performance)
- Mozilla/Apple kondigt ScriptProcessorNode-removal aan (huidige status: deprecated maar werkend in alle major browsers)

## Stub-bestand (niet geinstalleerd)

```js
// src/lib/audio-processor.js (placeholder voor v0.x)
class VamigaAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = (e) => { /* receive samples */ };
    this.buffer = new Float32Array(BUFFER_SIZE * 2);
  }
  process(_inputs, outputs) {
    // copy from ring-buffer to outputs
    return true;
  }
}
registerProcessor('vamiga-audio', VamigaAudioProcessor);
```
