// AmigaHorse_Web — esbuild config (v0.0.2-CannonFodder, stub)
//
// Bundelt src/ → dist/ als ES-modules.
// Drie HTML-routes worden naar dist/ gekopieerd; JS wordt gesplitst per route.
//
// COOP+COEP-headers worden door dev-server gezet (--servedir=dist).
// In productie regelt de static host (Cloudflare Pages / Netlify / HC55-nginx-vhost) deze headers.

import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

// HTML-routes die we 1-op-1 kopiëren naar dist/
const HTML_ROUTES = [
  ['src/index.html', 'dist/index.html'],
  ['src/basic/index.html', 'dist/basic/index.html'],
  ['src/basic/setup.html', 'dist/basic/setup.html'],
  ['src/full/index.html', 'dist/full/index.html'],
];

// JS-entrypoints per route
export const entryPoints = {
  'wasm-bridge': join(SRC, 'wasm-bridge.js'),
  'basic/quick-launch': join(SRC, 'basic/quick-launch.js'),
  'basic/setup': join(SRC, 'basic/setup.js'),
  'full/library': join(SRC, 'full/library.js'),
};

// esbuild options (gebruikt door npm script via --config=esbuild.config.mjs argv)
export default {
  entryPoints,
  outdir: DIST,
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  splitting: true,
  sourcemap: true,
  loader: { '.css': 'text', '.html': 'copy' },
  // Plugins TODO v0.0.2.x:
  //   1. Kopieer HTML-routes naar dist/
  //   2. Inject wasm-bridge naar elke route via <script type="module">
  //   3. Embed COOP+COEP-headers in dev-server (esbuild-server-headers-plugin of custom middleware)
};

// Lokaal helper voor HTML-copy (gebruikt buiten esbuild om):
export function copyHtmlRoutes() {
  for (const [src, dst] of HTML_ROUTES) {
    const dstAbs = join(ROOT, dst);
    if (!existsSync(dirname(dstAbs))) mkdirSync(dirname(dstAbs), { recursive: true });
    copyFileSync(join(ROOT, src), dstAbs);
  }
  console.log(`Copied ${HTML_ROUTES.length} HTML routes naar dist/`);
}
