// AmigaHorse_Web — Full mode library (v0.0.2-CannonFodder, stub)
//
// v0.0.2 = skelet. v0.0.3:
//   - Library lijst uit IndexedDB amigahorse-disks
//   - Player: vAmiga.start + loadADF + render-loop
//   - Settings: Kickstart-keuze, audio, gamepad-binding
//   - Save-states beheer
//   - Compat-set (Turrican / Lemmings / Shadow of the Beast)

import { init, storeAsset, loadAsset } from '../wasm-bridge.js';

const dropzone = document.getElementById('dropzone-full');
const list = document.getElementById('library-list');

async function refreshLibrary() {
  // TODO v0.0.3: iterate IndexedDB amigahorse-disks
  list.innerHTML = '<li><em>Library leeg (v0.0.2 skeleton)</em></li>';
}

async function handleDiskFile(file) {
  const ext = file.name.toLowerCase().split('.').pop();
  if (!['adf', 'hdf'].includes(ext)) {
    alert(`Bestand "${file.name}" is geen .adf of .hdf`);
    return;
  }
  await storeAsset('amigahorse-disks', file.name, file);
  console.log('[full/library] Opgeslagen', file.name);
  refreshLibrary();
}

dropzone.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.adf,.hdf';
  input.onchange = () => input.files[0] && handleDiskFile(input.files[0]);
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
  if (file) handleDiskFile(file);
});

(async function boot() {
  try {
    await init();
  } catch (err) {
    console.warn('[full/library] WASM-init faalde (verwacht v0.0.2):', err.message);
  }
  refreshLibrary();
})();
