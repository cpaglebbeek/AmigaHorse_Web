// AmigaHorse_Web — BASIC Asset-Setup wizard (v0.0.2-CannonFodder, stub)
//
// Vier-stap-wizard. Schrijft user-supplied assets naar IndexedDB
// en bakt eenmalig een warm-snapshot van Amiga-in-BASIC-prompt.
//
// Per P-AMH-05: assets blijven lokaal in browser, géén git-binaries.

import { init, storeAsset } from '../wasm-bridge.js';

const STATE = {
  kick: null,
  wb: null,
  basic: null,
};

const elKick = document.getElementById('upload-kick');
const elWb = document.getElementById('upload-wb');
const elBasic = document.getElementById('upload-basic');
const elBake = document.getElementById('bake-button');

function markStep(stepId, status) {
  const el = document.getElementById(stepId);
  el.classList.remove('is-done', 'is-error');
  if (status === 'done') el.classList.add('is-done');
  if (status === 'error') el.classList.add('is-error');
}

function setStepStatus(stepId, msg, status = 'info') {
  const el = document.querySelector(`#${stepId} .step-status`);
  el.textContent = msg;
  markStep(stepId, status);
}

function maybeEnableBake() {
  elBake.disabled = !(STATE.kick && STATE.wb && STATE.basic);
}

async function handleUpload(file, expectedSize, storeName, label, stepId) {
  if (expectedSize && Math.abs(file.size - expectedSize) > expectedSize * 0.05) {
    setStepStatus(stepId, `Onverwacht ${file.size} bytes (verwacht ±${expectedSize}). Doorgaan op eigen risico.`, 'error');
  }
  await storeAsset(storeName, label, file);
  setStepStatus(stepId, `✓ ${file.name} opgeslagen (${file.size} bytes)`, 'done');
  return file;
}

elKick.addEventListener('change', async () => {
  const f = elKick.files[0]; if (!f) return;
  STATE.kick = await handleUpload(f, 262144, 'amigahorse-kickstart', 'kick13', 'step-1');
  maybeEnableBake();
});

elWb.addEventListener('change', async () => {
  const f = elWb.files[0]; if (!f) return;
  STATE.wb = await handleUpload(f, 901120, 'amigahorse-disks', 'wb13-master', 'step-2');
  maybeEnableBake();
});

elBasic.addEventListener('change', async () => {
  const f = elBasic.files[0]; if (!f) return;
  STATE.basic = await handleUpload(f, 0, 'amigahorse-kickstart', 'amigabasic-bin', 'step-3');
  maybeEnableBake();
});

elBake.addEventListener('click', async () => {
  elBake.disabled = true;
  setStepStatus('step-4', 'Bake gestart… (eenmalig ~10 sec)');

  try {
    await init();

    // TODO v0.0.2.x — echte bake-flow:
    //   1. vAmiga.start(kick13-buf)
    //   2. vAmiga.loadADF(wb13-buf, df=0)
    //   3. Wait ~4 sec voor Workbench-boot
    //   4. vAmiga.injectMouseDoubleClick op AmigaBASIC-icon  (of injectKey-flow)
    //   5. Wait voor BASIC-prompt detect (canvas-OCR of timing-based)
    //   6. const snap = vAmiga.saveState()
    //   7. await storeAsset('amigahorse-states', 'basic-env-snapshot', new Blob([snap]))

    console.warn('[setup] STUB: warm-snapshot bake nog niet geïmplementeerd');
    setStepStatus('step-4', 'STUB: bake komt in v0.0.2.x na vAmigaWeb submodule add. Klaar voor test op /basic/.', 'done');
    setTimeout(() => { window.location.href = '/basic/'; }, 2000);
  } catch (err) {
    setStepStatus('step-4', `Bake mislukt: ${err.message}`, 'error');
    elBake.disabled = false;
  }
});
