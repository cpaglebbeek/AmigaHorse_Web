#!/usr/bin/env bash
# AmigaHorse_Web — WASM-build script voor vAmigaWeb (v0.0.3-Flashback, sub-step 3)
#
# Pipeline:
#   1. Source emsdk-env (gepind 5.0.7)
#   2. cmake configure external/vamigaweb (alleen eerste keer of bij CMakeLists-wijziging)
#   3. cmake build (incremental)
#   4. Copy vAmiga.js + vAmiga.wasm naar dist/vendor/vamigaweb/
#
# Idempotent — bij herhaalde run rebuilds alleen wat nodig is.
#
# Output (in dist/vendor/vamigaweb/):
#   - vAmiga.js          ~106 KB Emscripten glue (loadable via dynamic import)
#   - vAmiga.wasm        ~8.77 MB WASM-module (Amiga-emulator binary)
#
# Niet gekopieerd (we gebruiken eigen UI):
#   - vAmiga.html        upstream shell HTML
#   - sw.js              upstream service-worker (eventueel later overnemen)
#
# Build-config (uit external/vamigaweb/CMakeLists.txt):
#   - C++20, -O3 -flto, wasm-exceptions (legacy off)
#   - INITIAL_MEMORY=320MB, MAXIMUM=4GB, growth=1
#   - -lidbfs.js          (IDBFS al beschikbaar voor IndexedDB-FS-persistence)
#   - -sUSE_ZLIB=1
#   - thread_type=nonworker (default; geen SharedArrayBuffer-vereiste)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
VAMIGA_DIR="${REPO_DIR}/external/vamigaweb"
BUILD_DIR="${VAMIGA_DIR}/build"
DIST_DIR="${REPO_DIR}/dist/vendor/vamigaweb"

# Stap 1: Emscripten activeren
# shellcheck source=./emscripten-env.sh
source "${SCRIPT_DIR}/emscripten-env.sh"

# Stap 2: cmake configure (alleen als build-dir nog niet bestaat of CMakeCache mist)
if [[ ! -f "${BUILD_DIR}/CMakeCache.txt" ]]; then
    echo ">>> cmake configure (eerste keer)..."
    cd "${VAMIGA_DIR}"
    emcmake cmake -B build -DCMAKE_BUILD_TYPE=Release
fi

# Stap 3: cmake build
echo ">>> cmake --build (incremental)..."
cd "${VAMIGA_DIR}"
cmake --build build -j 8

# Stap 4: Copy artefacten naar dist/vendor/vamigaweb/
echo ">>> kopieren vAmiga.js + vAmiga.wasm naar dist/vendor/vamigaweb/"
mkdir -p "${DIST_DIR}"
cp "${BUILD_DIR}/vAmiga.js" "${DIST_DIR}/"
cp "${BUILD_DIR}/vAmiga.wasm" "${DIST_DIR}/"

# Bevestig
js_size=$(stat -f%z "${DIST_DIR}/vAmiga.js" 2>/dev/null || stat -c%s "${DIST_DIR}/vAmiga.js")
wasm_size=$(stat -f%z "${DIST_DIR}/vAmiga.wasm" 2>/dev/null || stat -c%s "${DIST_DIR}/vAmiga.wasm")
echo ""
echo "=== WASM-build klaar ==="
echo "  dist/vendor/vamigaweb/vAmiga.js    ${js_size} bytes"
echo "  dist/vendor/vamigaweb/vAmiga.wasm  ${wasm_size} bytes"
echo ""
echo "Volgende stap: sub-step 4 — verifieer welke exports + hostfs-API beschikbaar zijn"
echo "  (zie src/wasm-bridge.js voor integration-stubs)"
