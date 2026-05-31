// AmigaHorse_Web — Quick BASIC quick-launch flow (v0.0.2-CannonFodder, stub)
//
// Implementeert Data-flow A uit ARCHITECTURE.md:
//   1. Check warm-snapshot → ontbreekt = redirect /basic/setup.html
//   2. Drop .bas → MEMFS:/dh1/launch.bas
//   3. restoreState(warm-snapshot)
//   4. mountDH('/dh1')
//   5. injectKey('LOAD "DH1:launch.bas"<CR>')
//   6. auto-RUN ? injectKey('RUN<CR>') : stop in prompt

import { init, hasWarmSnapshot, loadAsset, _state } from '../wasm-bridge.js';

const dropzone = document.getElementById('dropzone');
const status = document.getElementById('status');
const canvas = document.getElementById('emulator');
const autoRunCheckbox = document.getElementById('auto-run');

function setStatus(msg, kind = 'info') {
  status.textContent = msg;
  status.style.color =
    kind === 'error' ? 'var(--wb-red)' :
    kind === 'success' ? 'var(--wb-green)' :
    'var(--wb-grey-dark)';
}

async function bootCheck() {
  setStatus('Controleer asset-status…');
  const hasSnap = await hasWarmSnapshot();
  if (!hasSnap) {
    setStatus('Asset-Setup nog niet voltooid. Doorsturen…', 'error');
    setTimeout(() => { window.location.href = './setup.html'; }, 1200);
    return false;
  }
  try {
    await init();
    setStatus('Klaar — drop een .bas');
    return true;
  } catch (err) {
    setStatus(err.message, 'error');
    return false;
  }
}

async function handleBasFile(file) {
  if (!file.name.toLowerCase().endsWith('.bas')) {
    setStatus(`Bestand "${file.name}" is geen .bas — alleen AmigaBASIC-bestanden v0.0.2`, 'error');
    return;
  }
  setStatus(`Lezen ${file.name} (${file.size} bytes)…`);
  const buf = new Uint8Array(await file.arrayBuffer());

  // TODO v0.0.2.x — werkelijke uitvoer:
  //   1. STATE.vamiga.fsWriteFile('/dh1/launch.bas', buf)
  //   2. const snap = await loadAsset('amigahorse-states', 'basic-env-snapshot')
  //      STATE.vamiga.restoreState(new Uint8Array(await snap.blob.arrayBuffer()))
  //   3. STATE.vamiga.mountDH('/dh1')
  //   4. STATE.vamiga.injectKey('LOAD "DH1:launch.bas"\r')
  //   5. if (autoRunCheckbox.checked) STATE.vamiga.injectKey('RUN\r')
  //   6. canvas.style.display = 'block'; start render-loop
  console.log('[quick-launch] STUB: launching .bas', file.name, buf.length, 'autoRun=', autoRunCheckbox.checked);
  setStatus(`STUB: ${file.name} zou nu starten. v0.0.2.x activeert vAmiga.`, 'success');
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

bootCheck();
