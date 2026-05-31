#!/usr/bin/env bash
# AmigaHorse_Web — Emscripten environment loader (v0.0.2.2)
#
# Source this file in each shell sessie waarin je een WASM-build doet.
# Géén permanente .zshrc-aanpassing: emsdk-env-vars worden alleen in de
# huidige shell gezet.
#
# Gebruik:
#     source tools/emscripten-env.sh
#     emcc --version
#     # ... build commando's ...
#
# Geïnstalleerde versie (gepind v0.0.2.2):
#   emsdk     = 5.0.7  (commit 263db4cffa6f9fc2ec514a70abac81362ea41849)
#   node      = 22.16.0 (bundled)
#   python    = 3.13.3  (bundled)
#   wasm-bin  = 6cd98e86d7749ff98b82b7f2ae78eb4f01942788
#
# Update-protocol: bij emsdk-bump (toekomstige sub-step) →
#     cd ~/Documents/Gemini_Projects/emsdk && git pull && ./emsdk install <version>
#     vAmigaWeb-build opnieuw draaien → check op cross-emcc-versie-regressies →
#     update deze pin in commentaar + CHANGELOG-entry.

EMSDK_PATH="${HOME}/Documents/Gemini_Projects/emsdk"

if [[ ! -d "${EMSDK_PATH}" ]]; then
    echo "ERROR: emsdk niet gevonden op ${EMSDK_PATH}" >&2
    echo "Installeer met:" >&2
    echo "  cd ~/Documents/Gemini_Projects && git clone https://github.com/emscripten-core/emsdk.git" >&2
    echo "  cd emsdk && ./emsdk install 5.0.7 && ./emsdk activate 5.0.7" >&2
    return 1 2>/dev/null || exit 1
fi

# emsdk_env.sh schrijft naar stdout — laten we sanity-output onderdrukken
# tenzij user expliciet AMIGAHORSE_VERBOSE_EMSDK=1 zet.
if [[ -n "${AMIGAHORSE_VERBOSE_EMSDK}" ]]; then
    # shellcheck source=/dev/null
    source "${EMSDK_PATH}/emsdk_env.sh"
else
    # shellcheck source=/dev/null
    source "${EMSDK_PATH}/emsdk_env.sh" >/dev/null 2>&1
fi

# Bevestig dat het werkt
if command -v emcc >/dev/null 2>&1; then
    emcc_version="$(emcc --version 2>/dev/null | head -1 | awk '{print $(NF-1)}')"
    echo "Emscripten ${emcc_version} actief in deze shell (AmigaHorse_Web v0.0.2.2-pin: 5.0.7)"
else
    echo "WAARSCHUWING: emcc niet beschikbaar na sourcing emsdk_env.sh" >&2
    return 1 2>/dev/null || exit 1
fi
