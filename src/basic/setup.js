// AmigaHorse_Web — BASIC Asset-Setup wizard (v0.0.5-RType, sub-step 5)
//
// Vier-stap-wizard:
//   1. Upload Kickstart 1.3 ROM    → IndexedDB amigahorse-kickstart/kick13
//   2. Upload Workbench 1.3 ADF    → IndexedDB amigahorse-disks/wb13-master
//   3. Upload AmigaBASIC binary    → IndexedDB amigahorse-kickstart/amigabasic-bin
//   4. Bake warm-snapshot:
//        a. init vAmiga + loadFile kick13 (Kickstart ROM)
//        b. powerOn(1)
//        c. loadFile wb13.adf op df0
//        d. run + wachten op WB-boot (~6-8 sec)
//        e. key sequence om AmigaBASIC te starten (zie BASIC_MODE.md voor timing)
//        f. wachten op BASIC-prompt
//        g. saveStateToBuffer → IndexedDB amigahorse-states/basic-env-snapshot
//        h. redirect naar /basic/
//
// **Status sub-step 5:** Infrastructuur klaar. Live test door gebruiker met
// daadwerkelijke KS 1.3 + WB 1.3 + AmigaBASIC binaries vereist.
// Timing-konstanten zijn educated guesses; sub-step 5+ live tunen.

import { init, getBindings, storeAsset } from '../wasm-bridge.js';
import { encodeStringToSequence, playSequence, RAWKEY } from '../lib/amiga-keymap.js';

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

  try {
    await init();
    const bindings = await getBindings();

    // -- Stap 1: Load Kickstart ROM --
    setStepStatus('step-4', 'Laad Kickstart 1.3 ROM...');
    const kickBuf = new Uint8Array(await STATE.kick.arrayBuffer());
    // vAmiga's load_disk() detecteert het ROM-formaat aan header-bytes.
    // Drive-number is voor ROMs irrelevant; we geven 0xFF als "n/a" indicator.
    // TODO sub-step 5 live: verifieer of dit pad werkt; alternatief = aparte ROM-API
    const kickResult = bindings.loadFile('kick13.rom', kickBuf, 0xFF);
    console.log('[bake] loadFile kick13 →', kickResult);
    await sleep(200);

    // -- Stap 2: Power on --
    setStepStatus('step-4', 'Power on...');
    const powerResult = bindings.powerOn(1);
    console.log('[bake] powerOn →', powerResult);
    await sleep(500);

    // -- Stap 3: Insert WB 1.3 in df0 --
    setStepStatus('step-4', 'Mount Workbench 1.3 ADF in DF0:...');
    const wbBuf = new Uint8Array(await STATE.wb.arrayBuffer());
    const wbResult = bindings.loadFile('wb13.adf', wbBuf, 0);
    console.log('[bake] loadFile wb13 →', wbResult);

    // -- Stap 4: Run emulator + wacht op WB-boot --
    setStepStatus('step-4', 'Start emulatie + wachten op Workbench-boot (~8 sec)...');
    bindings.run();
    await sleep(8000);

    // -- Stap 5: Open AmigaBASIC --
    // WB 1.3 verwacht muis-double-click op AmigaBASIC-icon. Zonder mouse-emulation
    // (komt v0.x): we proberen via CLI met rechter-Amiga + N → "AmigaBASIC<RET>".
    // Alternatief: AmigaBASIC binary moet eerst in C: of via copy/run pad-uitlezing.
    //
    // **Belangrijke aanname:** WB 1.3 disk heeft "AmigaBASIC" bestand op root.
    // Als CLI niet beschikbaar is in een nieuwe WB-sessie, faalt dit stap.
    // Sub-step 5+ live tunen: misschien moet user "Open Shell" eerst via menu.
    setStepStatus('step-4', 'Open CLI + start AmigaBASIC...');
    // Rechter-Amiga + N = WB shortcut "New CLI" in 2.x; in 1.3 niet altijd. Risk-flag.
    // We typen het commando + Return:
    const startSequence = encodeStringToSequence('AmigaBASIC\r');
    await playSequence(bindings, startSequence);
    await sleep(3000);  // wachten tot AmigaBASIC opent

    // -- Stap 6: Save workspace als warm-snapshot --
    setStepStatus('step-4', 'Save warm-snapshot naar IndexedDB...');
    const snap = bindings.saveStateToBuffer();
    if (!snap || snap.length === 0) {
      throw new Error('saveStateToBuffer leverde lege buffer — emulator nog niet ready?');
    }
    await storeAsset('amigahorse-states', 'basic-env-snapshot', new Blob([snap]));
    console.log('[bake] warm-snapshot opgeslagen (', snap.length, ' bytes)');

    setStepStatus('step-4', `OK warm-snapshot ${snap.length} bytes opgeslagen. Doorsturen...`, 'done');
    setTimeout(() => { window.location.href = '/basic/'; }, 1500);
  } catch (err) {
    console.error('[bake]', err);
    setStepStatus('step-4', `Bake mislukt: ${err.message}`, 'error');
    elBake.disabled = false;
  }
}

elBake.addEventListener('click', bakeWarmSnapshot);
