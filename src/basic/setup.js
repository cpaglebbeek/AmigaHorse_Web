// AmigaHorse_Web — BASIC Asset-Setup wizard (v0.0.11-AlienBreed)
//
// v0.0.11 — Root cause bake-flow "undefined error":
//   vAmigaWeb's wasm_loadFile gebruikt FILENAME-EXTENSION als type-discriminator:
//     `.rom_file`     → ROM-branch (mem.loadRom + auto powerOn + run)
//     `.rom_ext_file` → ROM-ext-branch
//     `.adf`/`.dms`/  → load_disk-branch
//     (zie external/vamigaweb/main.cpp:1748,1823)
//   Onze v0.0.5..v0.0.10 stuurde 'kick13.rom' → géén ROM-branch match → Kickstart
//   nooit geflashed → powerOn faalt silent → downstream "undefined".
//   Fix: rename naar 'kick13.rom_file' + diagnostics-pass na elke stage zodat
//   user/dev exact ziet welke stage werkt.

import { init, getBindings, getModule, storeAsset } from '../wasm-bridge.js';
import { encodeStringToSequence, playSequence, RAWKEY } from '../lib/amiga-keymap.js';
import { CanvasRenderer } from '../lib/canvas-renderer.js';
import { scriptedDoubleClick } from '../lib/mouse-input.js';

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
  // Stap 3 (AmigaBASIC binary) is optioneel — AmigaBASIC zit al in WB 1.3 ADF.
  // Enable bake zodra kick + wb beschikbaar zijn.
  elBake.disabled = !(STATE.kick && STATE.wb);
}

async function handleUpload(file, expectedSize, storeName, label, stepId) {
  if (expectedSize && Math.abs(file.size - expectedSize) > expectedSize * 0.05) {
    setStepStatus(stepId, `Onverwacht ${file.size} bytes (verwacht ±${expectedSize}). Doorgaan op eigen risico.`, 'error');
  }
  await storeAsset(storeName, label, file);
  setStepStatus(stepId, `OK ${file.name} opgeslagen (${file.size} bytes)`, 'done');
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Bake-flow: boot Amiga + start AmigaBASIC + freeze als warm-snapshot.
 *
 * Timing-konstanten zijn educated guesses. Sub-step 5+ live tunen.
 */
async function bakeWarmSnapshot() {
  elBake.disabled = true;
  setStepStatus('step-4', 'Init vAmiga-WASM-module...');

  // Diagnostics-pass v0.0.11: per-stage logger zodat downstream "undefined"
  // niet meer silent doorslipt. Elke stage logt START + END + waarde.
  const stage = (label, fn) => {
    console.group(`[bake] ${label}`);
    console.time(`[bake] ${label}`);
    try {
      const result = fn();
      if (result instanceof Promise) {
        return result.then((v) => {
          console.log(`→ result:`, v);
          console.timeEnd(`[bake] ${label}`);
          console.groupEnd();
          return v;
        }).catch((e) => {
          console.error(`✗ FAIL:`, e);
          console.timeEnd(`[bake] ${label}`);
          console.groupEnd();
          throw e;
        });
      }
      console.log(`→ result:`, result);
      console.timeEnd(`[bake] ${label}`);
      console.groupEnd();
      return result;
    } catch (e) {
      console.error(`✗ FAIL:`, e);
      console.timeEnd(`[bake] ${label}`);
      console.groupEnd();
      throw e;
    }
  };

  try {
    await stage('1.init-vamiga', () => init());
    const bindings = await stage('1.get-bindings', () => getBindings());

    // -- Stap 1: Load Kickstart ROM --
    // CRITICAL v0.0.11: filename MOET '.rom_file' suffix hebben anders skipt
    // vAmigaWeb (main.cpp:1748) de ROM-branch en flasht de Kickstart nooit.
    setStepStatus('step-4', 'Laad Kickstart 1.3 ROM...');
    const kickBuf = new Uint8Array(await STATE.kick.arrayBuffer());
    console.log('[bake] kick-buffer:', kickBuf.length, 'bytes, header:',
      Array.from(kickBuf.slice(0, 4)).map((b) => b.toString(16).padStart(2, '0')).join(' '));
    const kickResult = stage('2.loadFile-kick (kick13.rom_file, drive=0xFF)',
      () => bindings.loadFile('kick13.rom_file', kickBuf, 0xFF));
    if (kickResult !== 'rom') {
      // ROM-branch returnt letterlijk "rom" (main.cpp:1794+1820). Andere waarden
      // = niet geflashed → verderop fout. Eerder waarschuwen.
      console.warn(`[bake] WARN: loadFile kick returned "${kickResult}" — verwacht "rom". Fix waarschijnlijk niet geslaagd.`);
    }
    await sleep(200);

    // -- Stap 2: Power on --
    // NB: main.cpp:1812-1813 doet powerOn+run AUTOMATISCH na ROM-flash, dus dit
    // is sinds v0.0.11 strikt redundant. We laten het staan als "ensure-on"-no-op.
    setStepStatus('step-4', 'Power on (ensure)...');
    const powerResult = stage('3.powerOn(1)', () => bindings.powerOn(1));
    if (powerResult && powerResult !== '') {
      console.warn(`[bake] WARN: powerOn returned non-empty "${powerResult}" — mogelijk error-string.`);
    }
    await sleep(500);

    // -- Stap 3: Insert WB 1.3 in df0 --
    setStepStatus('step-4', 'Mount Workbench 1.3 ADF in DF0:...');
    const wbBuf = new Uint8Array(await STATE.wb.arrayBuffer());
    console.log('[bake] wb-buffer:', wbBuf.length, 'bytes');
    const wbResult = stage('4.loadFile-wb (wb13.adf, drive=0)',
      () => bindings.loadFile('wb13.adf', wbBuf, 0));
    console.log('[bake] wb load returned:', JSON.stringify(wbResult));

    // -- Stap 4: Start canvas-renderer + wacht op WB-boot --
    setStepStatus('step-4', 'Start canvas-renderer + wachten op Workbench-boot (~8 sec)...');
    const bakeCanvas = document.getElementById('bake-canvas');
    let bakeRenderer = null;
    if (bakeCanvas) {
      const Module = await stage('5.get-module', () => getModule());
      bakeRenderer = new CanvasRenderer(bakeCanvas, bindings, Module);
      bakeCanvas.style.display = 'block';
      bakeRenderer.start();
      bakeRenderer.fitToContainer(640);
      console.log('[bake] renderer started');
    }
    // run() is no-op als ROM-branch al powerOn+run deed, maar veilig.
    stage('6.run', () => bindings.run());
    await sleep(8000);

    // -- Stap 5: Open AmigaBASIC --
    setStepStatus('step-4', 'Try 1: CLI-typing "AmigaBASIC<RET>"...');
    const startSequence = encodeStringToSequence('AmigaBASIC\r');
    await stage('7.playSequence-AmigaBASIC',
      () => playSequence(bindings, startSequence));
    await sleep(2000);

    setStepStatus('step-4', 'Try 2: muis-double-click op AmigaBASIC-icon (270, 100)...');
    await stage('8.scriptedDoubleClick(270,100)',
      () => scriptedDoubleClick(bindings, 270, 100));
    await sleep(3000);

    // -- Stap 6: Save workspace als warm-snapshot --
    setStepStatus('step-4', 'Save warm-snapshot naar IndexedDB...');
    const snap = stage('9.saveStateToBuffer', () => bindings.saveStateToBuffer());
    if (!snap || snap.length === 0) {
      throw new Error('saveStateToBuffer leverde lege buffer — emulator nog niet ready of ROM-flash gefaald (zie stage 2 logregel)');
    }
    await stage('10.storeAsset-snapshot',
      () => storeAsset('amigahorse-states', 'basic-env-snapshot', new Blob([snap])));
    console.log('[bake] warm-snapshot opgeslagen (', snap.length, ' bytes)');

    if (bakeRenderer) bakeRenderer.stop();
    setStepStatus('step-4', `OK warm-snapshot ${snap.length} bytes opgeslagen. Doorsturen...`, 'done');
    setTimeout(() => { window.location.href = '/basic/'; }, 1500);
  } catch (err) {
    console.error('[bake] BAKE-FLOW MISLUKT:', err);
    console.error('[bake] stack:', err.stack);
    setStepStatus('step-4', `Bake mislukt: ${err.message || err}`, 'error');
    elBake.disabled = false;
  }
}

elBake.addEventListener('click', bakeWarmSnapshot);
