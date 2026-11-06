# Zihatec M-BUS Explorer 0.7 – libmbus build candidate

This is the blue Zihatec UI release candidate with an **integration path for the real rscada/libmbus C library**. The published ZIP **does not contain precompiled libmbus WASM**. Until built and installed the working Zihatec JavaScript decoder continues running. No claim of a successful WASM build is made.

## Easiest workflow: GitHub Actions

1. Create a public GitHub repository (e.g. `zihatec-mbus-explorer`) and upload the CONTENTS of this directory, including the hidden `.github/workflows` folder.
2. In **Actions**, run **Build and test real libmbus WebAssembly** using **Run workflow**. Network access and Emscripten are provided by GitHub's Ubuntu runner.
3. If the build and REAL WASM decoder test succeed, download the artifact `libmbus-wasm-tested` from the action. It contains `libmbus.js`, `libmbus.wasm`, the source commit and upstream licenses.
4. Place all artifact files in the **wasm/** folder alongside `bridge.c` and `build.sh`. Commit these generated files to the same repository and publish the repository via GitHub Pages.
5. Check the Explorer decoder indication for `libmbus WebAssembly` and confirm the ELV meter yields the expected records; compare with LorusFree before a public release.

`wasm/build.sh` is provided to build locally with Emscripten and Git network access too. Set `LIBMBUS_REF=<reviewed commit SHA>` for reproducible version pinning. libmbus has a BSD-style license; preserve the license and attribution from upstream.

## Architecture

- Web Serial, meter scan, FCB, multi-frame handling and configuration commands: unchanged from 0.7-blue.
- `decoder-api.js`: stable adapter. It consumes real libmbus XML with `DataRecord` and keeps the JavaScript fallback.
- `wasm/bridge.c`: runs `mbus_parse`, `mbus_frame_verify` and `mbus_frame_xml` and converts libmbus ISO-8859-1 XML bytes to UTF-8 for JavaScript.
- `tests/libmbus-wasm-test.cjs`: loads the *actual* compiled WASM and asserts a valid synthetic measurement and checksum rejection. It will fail if compiler/bridge/decoder is broken.
- `wasm-loader.js`: loads the module at runtime only if available; the active decoder is shown in the UI.

## Caveats

- This local environment does not provide Emscripten or access to clone upstream and therefore the WASM output could not be created or verified here. The GitHub Actions workflow is likewise unexecuted until uploaded to GitHub.
- Check the synthetic-data test against upstream actual output. No real ELV/LorusFree comparison has happened for the native backend yet.
- Existing service write commands are left untouched; continue testing only on isolated bus devices.
- No references to MBusino are included.

Original library: https://github.com/rscada/libmbus (BSD-3-Clause).
