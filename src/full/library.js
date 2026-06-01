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
import { SaveStateManager, SAVE_STATE_SLOTS } from '../lib/save-state-manager.js';
import { insertDiskInDrive, DRIVES } from '../lib/disk-swap.js';

const dropzone = document.getElementById('dropzone-full');
const listEl = document.getElementById('library-list');
const canvas = document.getElementById('emulator');
const statusEl = document.getElementById('status');
const kickstartUpload = document.getElementById('upload-kick-full');

let renderer = null;
let mouseInput = null;
let audioSetup = null;
let gamepadInput = null;
let saveStateManager = null;
let currentDiskKey = null;

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
    const driveButtons = DRIVES.map((d) =>
      `<button data-label="${escapeAttr(disk.label)}" data-drive="${d.num}" class="drive-btn">${d.label}</button>`,
    ).join(' ');
    li.innerHTML = `
      <strong>${escapeHtml(disk.label)}</strong>
      <small>(${sizeKb} KB)</small>
      <br>
      <button data-label="${escapeAttr(disk.label)}" class="play-btn">▶ Boot (DF0:)</button>
      <span style="margin-left:0.5rem;">Insert: ${driveButtons}</span>
    `;
    listEl.appendChild(li);
  }
  for (const btn of listEl.querySelectorAll('.play-btn')) {
    btn.addEventListener('click', () => playDisk(btn.dataset.label));
  }
  for (const btn of listEl.querySelectorAll('.drive-btn')) {
    btn.addEventListener('click', () => insertDisk(btn.dataset.label, Number(btn.dataset.drive)));
  }
}

async function insertDisk(label, drive) {
  try {
    if (!saveStateManager) {
      setStatus('Start eerst een spel via "Boot (DF0:)" voordat je een schijf wisselt', 'error');
      return;
    }
    const bindings = await getBindings();
    const diskAsset = await loadAsset('amigahorse-disks', label);
    await insertDiskInDrive(bindings, diskAsset.blob, label, drive);
    setStatus(`${label} → DF${drive}:`, 'success');
  } catch (err) {
    console.error('[full/library] insertDisk error:', err);
    setStatus(`Insert mislukt: ${err.message}`, 'error');
  }
}

async function quicksave(slot) {
  try {
    if (!saveStateManager || !currentDiskKey) {
      setStatus('Start eerst een spel voordat je kunt saven', 'error');
      return;
    }
    const meta = await saveStateManager.save(currentDiskKey, slot);
    setStatus(`Saved slot ${slot} (${Math.round(meta.size / 1024)} KB)`, 'success');
  } catch (err) {
    console.error('[full/library] quicksave error:', err);
    setStatus(`Save mislukt: ${err.message}`, 'error');
  }
}

async function quickload(slot) {
  try {
    if (!saveStateManager || !currentDiskKey) {
      setStatus('Start eerst een spel voordat je kunt loaden', 'error');
      return;
    }
    const loaded = await saveStateManager.load(currentDiskKey, slot);
    if (loaded) {
      setStatus(`Loaded slot ${slot}`, 'success');
    } else {
      setStatus(`Slot ${slot} is leeg`, 'error');
    }
  } catch (err) {
    console.error('[full/library] quickload error:', err);
    setStatus(`Load mislukt: ${err.message}`, 'error');
  }
}

// Wire save/load buttons
function wireSaveStateUI() {
  for (let s = 1; s <= SAVE_STATE_SLOTS; s++) {
    const saveBtn = document.getElementById(`save-${s}`);
    const loadBtn = document.getElementById(`load-${s}`);
    if (saveBtn) saveBtn.addEventListener('click', () => quicksave(s));
    if (loadBtn) loadBtn.addEventListener('click', () => quickload(s));
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

    // Initialiseer save-state-manager met disk-hash
    if (!saveStateManager) saveStateManager = new SaveStateManager(bindings);
    currentDiskKey = await saveStateManager.hashDisk(diskBuf);
    console.log('[full/library] disk-key:', currentDiskKey);

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
wireSaveStateUI();
setStatus('Library klaar — drop een ADF/HDF of klik Boot');
