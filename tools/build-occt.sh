#!/usr/bin/env sh
# Build the trimmed OpenCASCADE bundle. See occt/box-designer.yml.
#
# The emscripten port fetcher goes out over HTTPS, so the agent proxy's CA has
# to reach the container or the fetch fails on a self-signed chain.
set -e
CA=${CA_BUNDLE:-/root/.ccr/ca-bundle.crt}
IMAGE=donalffons/opencascade.js:2.0.0-beta.b5ff984
docker run --rm \
  -v "$PWD/occt":/src \
  ${CA:+-v "$CA":/ca.crt:ro} \
  -e SSL_CERT_FILE=/ca.crt \
  -e REQUESTS_CA_BUNDLE=/ca.crt \
  -e NODE_EXTRA_CA_CERTS=/ca.crt \
  -e HTTPS_PROXY="${HTTPS_PROXY:-}" \
  -e https_proxy="${HTTPS_PROXY:-}" \
  --network host \
  -u "$(id -u):$(id -g)" \
  "$IMAGE" box-designer.yml

# The artefacts are served as plain files from public/occt/ rather than pulled
# through the bundler. The pthread worker resolves `./occt-box.js` relative to
# its own URL, so a hashed filename would break it.
mkdir -p public/occt
mv -f occt/occt-box.js occt/occt-box.wasm occt/occt-box.worker.js public/occt/
mv -f occt/occt-box.d.ts occt/occt-box.d.ts 2>/dev/null || true

# The threaded build spawns its pthread workers as classic workers, but the
# worker file it generates uses `import()`. Only a module worker can. Patching
# here rather than by hand so a rebuild does not silently undo it.
OUT=public/occt/occt-box.js
if grep -q 'new Worker(pthreadMainJs)' "$OUT"; then
  sed -i 's|new Worker(pthreadMainJs)|new Worker(pthreadMainJs,{type:"module"})|g' "$OUT"
  echo "patched $OUT: pthread workers are module workers"
fi
