#!/usr/bin/env bash
set -euo pipefail
# Requires emcc, git, internet access; builds upstream at pinned SHA if given.
ROOT="$(cd "$(dirname "$0")" && pwd)"
DEPS="${DEPS_DIR:-$ROOT/_deps}"
mkdir -p "$DEPS"
if [[ ! -d "$DEPS/libmbus/.git" ]]; then git clone https://github.com/rscada/libmbus.git "$DEPS/libmbus"; fi
(
 cd "$DEPS/libmbus"
 git fetch --tags
 git checkout --detach "${LIBMBUS_REF:-master}"
 git rev-parse HEAD > "$ROOT/libmbus-commit.txt"
 echo "libmbus commit: $(cat "$ROOT/libmbus-commit.txt")"
)
# Only native data/protocol components; do not link serial or TCP transports.
emcc -O2 -I"$DEPS/libmbus/mbus" \
 "$ROOT/bridge.c" \
 "$DEPS/libmbus/mbus/mbus-protocol.c" \
 "$DEPS/libmbus/mbus/mbus-protocol-aux.c" \
 -lm \
 -s WASM=1 -s MODULARIZE=1 -s ENVIRONMENT=web,node -s EXPORT_NAME=createLibmbusModule \
 -s ALLOW_MEMORY_GROWTH=1 -s FILESYSTEM=0 \
 -s 'EXPORTED_FUNCTIONS=["_zihatec_mbus_xml","_malloc","_free"]' \
 -s 'EXPORTED_RUNTIME_METHODS=["ccall"]' \
 -o "$ROOT/libmbus.js"
echo "Built libmbus.js + libmbus.wasm. Verify before release."
