#!/usr/bin/env sh
# Build the trimmed OpenCASCADE bundle. See occt/box-designer.yml.
#
# The emscripten port fetcher goes out over HTTPS, so the agent proxy's CA has
# to reach the container or the fetch fails on a self-signed chain.
set -e
CA=${CA_BUNDLE:-/root/.ccr/ca-bundle.crt}
IMAGE=donalffons/opencascade.js:2.0.0-beta.b5ff984
exec docker run --rm \
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
