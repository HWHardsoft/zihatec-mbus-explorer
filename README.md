# Zihatec M-BUS Explorer 0.7 – real libmbus WebAssembly

This package includes the **real, GitHub Actions-built libmbus WebAssembly decoder** (artifact `libmbus-wasm-tested.zip`, upstream commit recorded in `wasm/libmbus-commit.txt`). It retains the existing Zihatec JavaScript fallback.

## Launch

Upload the full contents of this directory **into the root** of your `zihatec-mbus-explorer` GitHub repository, keeping the `wasm/` folder. Or locally run `python -m http.server 8000` and open `http://localhost:8000` in a Web Serial-compatible browser.

Files `wasm/libmbus.js`, `wasm/libmbus.wasm`, and `wasm/libmbus-commit.txt` must remain in `wasm/`. The main page automatically attempts to load WASM on startup; use **Info → Decoder** to confirm `libmbus WebAssembly` and the short commit hash. If it instead says `Zihatec JavaScript`, the WASM loader did not start; inspect browser developer console/network requests and verify published files, then refresh the page bypassing cache.

The compiled decoder handles complete wired M-Bus long frames; reading, scanning, FCB, write address, and write baud-rate continue to use the existing Web Serial JS code. Unit scaling from libmbus XML is applied to recognized numeric factors (e.g. raw 1932 at 1e-2 °C becomes 19.32 °C). The original integer is retained as raw data in the record.

## Validation

`node tests/libmbus-wasm-test.cjs` tests the real libmbus WASM against a valid temperature telegram and checksum-invalid frames. `node tests/smoke-test.cjs` tests JS fallback.

Real devices and Firefox Web Serial cannot be hardware-tested here. This is a beta; compare values to LorusFree before trusting measurements or modifying device configuration. Some vendor-specific records may remain undecoded or ambiguous.

## Provenance and licensing

`wasm/libmbus.js` and `wasm/libmbus.wasm` were built from rscada/libmbus. See `wasm/libmbus-commit.txt`, `wasm/LIBMBUS-LICENSE.txt`, and `wasm/LIBMBUS-COPYING.txt`. libmbus is BSD-3-Clause. `wasm/bridge.c` adapts a full frame into libmbus XML output. No MBusinoLib is included.

The files in `tests/browser-wasm.html` are for developer testing and can be omitted from public deployment.
