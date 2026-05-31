// AmigaHorse_Web — Quick BASIC quick-launch flow (v0.0.4-Speedball2, sub-step 4)
//
// Data-flow A uit ARCHITECTURE.md, nu met concrete bindings:
//   1. init() laadt vAmiga.js + WASM
//   2. Check warm-snapshot in IndexedDB → ontbreekt = redirect /basic/setup
//   3. Drop .bas → buildAdfWithBasFile() → ADF Uint8Array
//   4. bindings.restoreStateFromBuffer(warm-snapshot)
//   5. bindings.loadFile('df1.adf', adf, 1)   // drive=1 = DF1:
//   6. bindings.scheduleKey(LOAD-keycodes ...) → "LOAD \"DF1:launch.bas\"<CR>"
//   7. auto-RUN ? scheduleKey(RUN<CR>) : stop in prompt
//   8. bindings.run()
//
// Sub-step 4 implementatie: smoke-test van init() + ADF-bouw werkt; volledige
// keyboard-sequence + warm-snapshot-restore in sub-step 5 met user-assets.

import { init, getBindings, hasWarmSnapshot, loadAsset } from '../wasm-bridge.js';
import { buildAdfWithBasFile, _internal as adfInternal } from '../lib/build-blank-adf.js';

const dropzone = document.getElementById('dropzone');
const status = document.getElementById('status');
const canvas = document.getElementById('emulator');
const autoRunCheckbox = document.getElementById('auto-run');
const smokeTestButton = document.getElementById('smoke-test');

function setStatus(msg, kind = 'info') {
  status.textContent = msg;
  status.style.color =
    kind === 'error' ? 'var(--wb-red)' :
    kind === 'success' ? 'var(--wb-green)' :
    'var(--wb-grey-dark)';
}

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
    setStatus(`Bestand "${file.name}" is geen .bas — alleen AmigaBASIC v0.0.4`, 'error');
    return;
  }
  if (file.size > adfInternal.OFS_DATA_PER_BLOCK) {
    setStatus(
      `Bestand ${file.size} bytes — v0.0.4 limiet ${adfInternal.OFS_DATA_PER_BLOCK} bytes (1 OFS data-block). ` +
      `Multi-block-support komt v0.0.5.`,
      'error',
    );
    return;
  }
  setStatus(`Lezen ${file.name} (${file.size} bytes)...`);
  const basContent = new Uint8Array(await file.arrayBuffer());

  try {
    setStatus('Bouw OFS-ADF met launch.bas in DF1:...');
    const adf = buildAdfWithBasFile(basContent, 'launch.bas', 'BAS');
    setStatus(`ADF gebouwd: ${adf.length} bytes (verwacht 901120) — sub-step 5 zal warm-snapshot restoren + ADF mounten + keys schedulen`, 'success');

    // Sub-step 5 zal:
    //   const bindings = await getBindings();
    //   const snap = await loadAsset('amigahorse-states', 'basic-env-snapshot');
    //   bindings.restoreStateFromBuffer(new Uint8Array(await snap.blob.arrayBuffer()));
    //   bindings.loadFile('basic.adf', adf, 1);
    //   const sequence = encodeAmigaKeyboardString('LOAD "DF1:launch.bas"\r' + (autoRunCheckbox.checked ? 'RUN\r' : ''));
    //   for (const [code, frameDelay] of sequence) bindings.scheduleKey(code, 0, 1, frameDelay);
    //   canvas.style.display = 'block';
    //   bindings.run();
    console.log('[quick-launch] sub-step 4 placeholder: ADF gebouwd', adf.length, 'autoRun=', autoRunCheckbox.checked);
  } catch (err) {
    setStatus(`Fout bij ADF-bouw: ${err.message}`, 'error');
    console.error('[quick-launch] ADF build error', err);
  }
}

// Smoke-test: alleen vAmiga.js + WASM laden zonder iets te doen
async function runSmokeTest() {
  smokeTestButton.disabled = true;
  smokeTestButton.textContent = 'vAmiga module laden...';
  try {
    const state = await init();
    smokeTestButton.textContent = 'OK — Module ready';
    smokeTestButton.style.background = 'var(--wb-green)';
    const bindings = state.bindings;
    console.log('[smoke-test] bindings beschikbaar:', Object.keys(bindings));
    setStatus(
      `vAmiga-Module geladen + ${Object.keys(bindings).length} cwrap-bindings actief (run, halt, loadFile, scheduleKey, save/restoreState, ...).`,
      'success',
    );
  } catch (err) {
    smokeTestButton.textContent = `Fout: ${err.message}`;
    smokeTestButton.style.background = 'var(--wb-red)';
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
