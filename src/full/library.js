// AmigaHorse_Web — Full mode library + player (v0.0.8-DefenderOfTheCrown, sub-step 8)
//
// Library: IndexedDB amigahorse-disks store toont alle ADF/HDF-files. Drag-drop
// voegt toe. Click "Play" mount + boot.
//
// Player: canvas-renderer + mouse-input + audio + gamepad-input — alles aan.

import { init, getBindings, getModule, storeAsset, loadAsset } from '../wasm-bridge.js';
import { CanvasRenderer } from '../lib/canvas-renderer.js';
import { MouseInput } from '../lib/mouse-input.js';
import { AudioSetup } from '../lib/audio-setup.js';
import { GamepadInput } from '../lib/gamepad-input.js';

const dropzone = document.getElementById('dropzone-full');
const listEl = document.getElementById('library-list');
const canvas = document.getElementById('emulator');
const statusEl = document.getElementById('status');
const kickstartUpload = document.getElementById('upload-kick-full');

let renderer = null;
let mouseInput = null;
let audioSetup = null;
let gamepadInput = null;

function setStatus(msg, kind = 'info') {
  if (!statusEl) { console.log('[full]', msg); return; }
  statusEl.textContent = msg;
  statusEl.style.color =
    kind === 'error' ? 'var(--wb-red)' :
    kind === 'success' ? 'var(--wb-green)' :
    'var(--wb-grey-dark)';
}

async function listIndexedDBStore(storeName) {
  // Klein helper om alle entries uit een object-store op te halen
  const items = [];
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('amigahorse', 1);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) { resolve([]); return; }
      const tx = db.transaction(storeName, 'readonly');
      const cur = tx.objectStore(storeName).openCursor();
      cur.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          items.push(cursor.value);
          cursor.continue();
        } else {
          resolve(items);
        }
      };
      cur.onerror = () => reject(cur.error);
    };
    req.onerror = () => reject(req.error);
  });
}

async function refreshLibrary() {
  if (!listEl) return;
  const disks = await listIndexedDBStore('amigahorse-disks');
  if (disks.length === 0) {
    listEl.innerHTML = '<li><em>Library leeg — drop een ADF/HDF</em></li>';
    return;
  }
  listEl.innerHTML = '';
  for (const disk of disks) {
    const li = document.createElement('li');
    const sizeKb = disk.blob ? Math.round(disk.blob.size / 1024) : '?';
    li.innerHTML = `
      <strong>${escapeHtml(disk.label)}</strong>
      <small>(${sizeKb} KB)</small>
      <button data-label="${escapeAttr(disk.label)}" class="play-btn">▶ Play</button>
    `;
    listEl.appendChild(li);
  }
  for (const btn of listEl.querySelectorAll('.play-btn')) {
    btn.addEventListener('click', () => playDisk(btn.dataset.label));
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

async function handleDiskFile(file) {
  const ext = file.name.toLowerCase().split('.').pop();
  if (!['adf', 'hdf'].includes(ext)) {
    setStatus(`Bestand "${file.name}" is geen .adf/.hdf`, 'error');
    return;
  }
  setStatus(`Opslaan ${file.name} (${file.size} bytes)...`);
  await storeAsset('amigahorse-disks', file.name, file);
  setStatus(`Opgeslagen ${file.name}`, 'success');
  refreshLibrary();
}

async function playDisk(label) {
  try {
    setStatus('Init vAmiga-Module...');
    await init();
    const bindings = await getBindings();
    const Module = await getModule();

    // Kickstart laden — eerst proberen kick13, anders prompt
    let kickAsset = await loadAsset('amigahorse-kickstart', 'kick13');
    if (!kickAsset) {
      setStatus('Geen Kickstart geladen — upload eerst kick13.rom (Asset-Setup)', 'error');
      return;
    }
    const kickBuf = new Uint8Array(await kickAsset.blob.arrayBuffer());
    bindings.loadFile('kick13.rom', kickBuf, 0xFF);
    bindings.powerOn(1);
    await new Promise((r) => setTimeout(r, 200));

    // Disk laden
    setStatus(`Mount ${label} in DF0:...`);
    const diskAsset = await loadAsset('amigahorse-disks', label);
    const diskBuf = new Uint8Array(await diskAsset.blob.arrayBuffer());
    bindings.loadFile(label, diskBuf, 0);

    // Renderer + input
    canvas.style.display = 'block';
    if (!renderer) renderer = new CanvasRenderer(canvas, bindings, Module);
    if (!mouseInput) { mouseInput = new MouseInput(canvas, bindings); mouseInput.attach(); }
    if (!audioSetup) {
      audioSetup = new AudioSetup(bindings, Module);
      await audioSetup.init();
      await audioSetup.resume();
    }
    if (!gamepadInput) { gamepadInput = new GamepadInput(bindings); gamepadInput.attach(); }
    renderer.start();
    renderer.fitToContainer(800);

    bindings.run();
    setStatus(`${label} draait — toetsenbord/muis/gamepad-input actief`, 'success');
  } catch (err) {
    console.error('[full/library] playDisk error:', err);
    setStatus(`Fout: ${err.message}`, 'error');
  }
}

// Drag-drop wiring
if (dropzone) {
  dropzone.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.adf,.hdf';
    input.onchange = () => input.files[0] && handleDiskFile(input.files[0]);
    input.click();
  });
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('is-active'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-active'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-active');
    const file = e.dataTransfer.files[0];
    if (file) handleDiskFile(file);
  });
}

// Kickstart-upload (zodat user kick13.rom kan toevoegen zonder /basic/setup flow)
if (kickstartUpload) {
  kickstartUpload.addEventListener('change', async () => {
    const file = kickstartUpload.files[0];
    if (!file) return;
    await storeAsset('amigahorse-kickstart', 'kick13', file);
    setStatus(`Kickstart geladen (${file.size} bytes)`, 'success');
  });
}

// Audio-resume bij eerste click
document.body.addEventListener('click', async () => {
  if (audioSetup) await audioSetup.resume();
}, { once: true });

refreshLibrary();
setStatus('Library klaar — drop een ADF/HDF of klik Play');
