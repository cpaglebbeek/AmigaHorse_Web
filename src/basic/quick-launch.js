// AmigaHorse_Web — Quick BASIC quick-launch flow (v0.0.6-Apidya, sub-step 6)
//
// Volledige flow + nu canvas-render + mouse + audio-setup:
//   1. init() laadt vAmiga.js + WASM
//   2. Check warm-snapshot in IndexedDB → ontbreekt = redirect /basic/setup
//   3. Drop .bas → buildAdfWithBasFile() → ADF Uint8Array
//   4. bindings.restoreStateFromBuffer(warm-snapshot)
//   5. bindings.loadFile('basic.adf', adf, 1) → DF1: in Amiga
//   6. playSequence('LOAD "DF1:launch.bas"<CR>')
//   7. auto-RUN ? playSequence('RUN<CR>') : stop in prompt
//   8. Start canvas-renderer + mouse-input + audio
//   9. bindings.run()

import { init, getBindings, getModule, hasWarmSnapshot, loadAsset } from '../wasm-bridge.js';
import { buildAdfWithBasFile, _internal as adfInternal } from '../lib/build-blank-adf.js';
import { encodeStringToSequence, playSequence } from '../lib/amiga-keymap.js';
import { CanvasRenderer } from '../lib/canvas-renderer.js';
import { MouseInput } from '../lib/mouse-input.js';
import { AudioSetup } from '../lib/audio-setup.js';
import { GamepadInput } from '../lib/gamepad-input.js';

const dropzone = document.getElementById('dropzone');
const status = document.getElementById('status');
const canvas = document.getElementById('emulator');
const autoRunCheckbox = document.getElementById('auto-run');
const smokeTestButton = document.getElementById('smoke-test');

let renderer = null;
let mouseInput = null;
let audioSetup = null;
let gamepadInput = null;

function setStatus(msg, kind = 'info') {
  status.textContent = msg;
  status.style.color =
    kind === 'error' ? 'var(--wb-red)' :
    kind === 'success' ? 'var(--wb-green)' :
    'var(--wb-grey-dark)';
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function bootCheck() {
  setStatus('Controleer asset-status...');
  const hasSnap = await hasWarmSnapshot();
  if (!hasSnap) {
    setStatus('Asset-Setup nog niet voltooid. Doorsturen...', 'error');
    setTimeout(() => { window.location.href = './setup.html'; }, 1200);
    return false;
  }
  setStatus('Warm-snapshot gevonden. Klaar — drop een .bas');
  return true;
}

async function handleBasFile(file) {
  if (!file.name.toLowerCase().endsWith('.bas')) {
    setStatus(`Bestand "${file.name}" is geen .bas — alleen AmigaBASIC v0.0.6`, 'error');
    return;
  }
  if (file.size > adfInternal.OFS_DATA_PER_BLOCK) {
    setStatus(
      `Bestand ${file.size} bytes — v0.0.6 limiet ${adfInternal.OFS_DATA_PER_BLOCK} bytes ` +
      `(1 OFS data-block). Multi-block-support komt v0.0.7.`,
      'error',
    );
    return;
  }

  try {
    setStatus(`Lezen ${file.name} (${file.size} bytes)...`);
    const basContent = new Uint8Array(await file.arrayBuffer());

    setStatus('Bouw OFS-ADF met launch.bas...');
    const adf = buildAdfWithBasFile(basContent, 'launch.bas', 'BAS');

    setStatus('Init vAmiga-Module...');
    const bindings = await getBindings();
    const Module = await getModule();

    // Init audio (sub-step 7: ScriptProcessorNode sink)
    if (!audioSetup) {
      audioSetup = new AudioSetup(bindings, Module);
      await audioSetup.init();
      // Chrome blockt audio tot user-gesture: drop = gesture → resume direct.
      await audioSetup.resume();
    }

    setStatus('Restore warm-snapshot (BASIC-prompt-state)...');
    const snapAsset = await loadAsset('amigahorse-states', 'basic-env-snapshot');
    if (!snapAsset) {
      setStatus('Warm-snapshot weg uit IndexedDB. Redirect naar setup...', 'error');
      setTimeout(() => { window.location.href = './setup.html'; }, 1500);
      return;
    }
    const snapBuf = new Uint8Array(await snapAsset.blob.arrayBuffer());
    bindings.restoreStateFromBuffer(snapBuf);
    await sleep(200);

    setStatus(`Mount ADF (${adf.length} bytes) in DF1:...`);
    const loadResult = bindings.loadFile('basic.adf', adf, 1);
    console.log('[quick-launch] loadFile DF1: →', loadResult);

    // Start render-loop + mouse-input + gamepad
    canvas.style.display = 'block';
    if (!renderer) {
      renderer = new CanvasRenderer(canvas, bindings, Module);
    }
    if (!mouseInput) {
      mouseInput = new MouseInput(canvas, bindings);
      mouseInput.attach();
    }
    if (!gamepadInput) {
      gamepadInput = new GamepadInput(bindings);
      gamepadInput.attach();
    }
    renderer.start();
    renderer.fitToContainer(800);

    setStatus('Type LOAD "DF1:launch.bas" + RUN...');
    const autoRun = autoRunCheckbox.checked;
    const cmd = autoRun
      ? 'LOAD "DF1:launch.bas"\rRUN\r'
      : 'LOAD "DF1:launch.bas"\r';
    const seq = encodeStringToSequence(cmd);
    await playSequence(bindings, seq);

    bindings.run();
    setStatus(autoRun ? 'Programma draait!' : 'Geladen in BASIC-prompt. Type RUN.', 'success');
  } catch (err) {
    console.error('[quick-launch]', err);
    setStatus(`Fout: ${err.message}`, 'error');
  }
}

// Auto-resume audio bij eerste click ergens op de pagina (Chrome policy).
// `once: true` — runs maar één keer.
document.body.addEventListener('click', async () => {
  if (audioSetup) await audioSetup.resume();
}, { once: true });

async function runSmokeTest() {
  smokeTestButton.disabled = true;
  smokeTestButton.textContent = 'vAmiga module laden...';
  try {
    const state = await init();
    smokeTestButton.textContent = 'OK — Module ready';
    smokeTestButton.style.background = 'var(--wb-green)';
    smokeTestButton.style.color = 'white';
    const bindings = state.bindings;
    console.log('[smoke-test] bindings:', Object.keys(bindings));
    setStatus(
      `vAmiga-Module geladen + ${Object.keys(bindings).length} cwrap-bindings actief ` +
      `(run, halt, reset, powerOn, configure, key, scheduleKey, mouse, mouseButton, ` +
      `loadFile, save/restoreState, drawOneFrame, pixelBuffer, renderWidth/Height, ` +
      `frameInfo, setSampleRate, ...)`,
      'success',
    );
  } catch (err) {
    smokeTestButton.textContent = `Fout: ${err.message}`;
    smokeTestButton.style.background = 'var(--wb-red)';
    smokeTestButton.style.color = 'white';
    smokeTestButton.disabled = false;
    setStatus(err.message, 'error');
    console.error('[smoke-test]', err);
  }
}

// Drag-drop wiring
dropzone.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.bas';
  input.onchange = () => input.files[0] && handleBasFile(input.files[0]);
  input.click();
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('is-active');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('is-active');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('is-active');
  const file = e.dataTransfer.files[0];
  if (file) handleBasFile(file);
});

if (smokeTestButton) {
  smokeTestButton.addEventListener('click', runSmokeTest);
}

bootCheck();
