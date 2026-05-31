// AmigaHorse_Web — esbuild config + dev-server (v0.0.4-Speedball2, sub-step 4)
//
// Twee modi:
//   `npm run dev`   → esbuild bundelt src/ → dist/ + start dev-server op :8000
//                     met COOP+COEP-headers (vooruit-werk voor evt. worker-mode).
//                     Serveert dist/vendor/vamigaweb/ (WASM-artefacten) statisch.
//   `npm run build` → één-shot productie-bundle (minified)
//
// Dev-server routes:
//   /                     dist/index.html (route-picker)
//   /basic/               dist/basic/index.html (Quick BASIC)
//   /basic/setup.html     dist/basic/setup.html (asset wizard)
//   /full/                dist/full/index.html (Full mode)
//   /vendor/vamigaweb/    dist/vendor/vamigaweb/* (vAmiga.js, vAmiga.wasm)
//   /*.js, /*.css         esbuild-bundled assets

import esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

// HTML-routes 1-op-1 kopiëren
const HTML_ROUTES = [
  ['src/index.html',          'dist/index.html'],
  ['src/styles.css',          'dist/styles.css'],
  ['src/basic/index.html',    'dist/basic/index.html'],
  ['src/basic/setup.html',    'dist/basic/setup.html'],
  ['src/full/index.html',     'dist/full/index.html'],
];

function copyStaticAssets() {
  for (const [src, dst] of HTML_ROUTES) {
    const dstAbs = join(ROOT, dst);
    if (!existsSync(dirname(dstAbs))) mkdirSync(dirname(dstAbs), { recursive: true });
    copyFileSync(join(ROOT, src), dstAbs);
  }
  // dist/vendor/vamigaweb/ wordt door tools/build-wasm.sh gevuld; check alleen
  const vendor = join(DIST, 'vendor', 'vamigaweb', 'vAmiga.wasm');
  if (!existsSync(vendor)) {
    console.warn('WAARSCHUWING: dist/vendor/vamigaweb/vAmiga.wasm ontbreekt — draai eerst `npm run build:wasm`');
  } else {
    console.log('dist/vendor/vamigaweb/vAmiga.wasm aanwezig');
  }
  console.log(`Copied ${HTML_ROUTES.length} static assets naar dist/`);
}

const entryPoints = {
  'wasm-bridge':         join(SRC, 'wasm-bridge.js'),
  'lib/build-blank-adf': join(SRC, 'lib/build-blank-adf.js'),
  'basic/quick-launch':  join(SRC, 'basic/quick-launch.js'),
  'basic/setup':         join(SRC, 'basic/setup.js'),
  'full/library':        join(SRC, 'full/library.js'),
};

const baseOptions = {
  entryPoints,
  outdir: DIST,
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  splitting: true,
  sourcemap: true,
  logLevel: 'info',
};

const mode = process.argv.includes('--dev') ? 'dev' : 'build';

if (mode === 'dev') {
  copyStaticAssets();

  // Build context met watch + dev-server (esbuild >= 0.17)
  const ctx = await esbuild.context(baseOptions);
  await ctx.watch();

  const { host, port } = await ctx.serve({
    servedir: DIST,
    port: 8000,
    // COOP+COEP-headers — niet strikt nodig voor nonworker-vAmigaWeb-build,
    // maar al wel correct voor toekomstige worker-mode (P-AMH-08, v0.x).
    onRequest: ({ method, path: requestPath, status, timeInMS }) => {
      console.log(`${status} ${method} ${requestPath} (${timeInMS}ms)`);
    },
  });
  console.log(`AmigaHorse_Web dev-server: http://${host}:${port}/`);
  console.log('Watching src/ voor changes (Ctrl+C om te stoppen)');
} else {
  copyStaticAssets();
  await esbuild.build({ ...baseOptions, minify: true });
  console.log('Productie-bundle klaar in dist/');
}
