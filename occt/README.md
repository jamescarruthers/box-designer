# The OpenCASCADE kernel

`occt-box.wasm` is a trimmed OCCT build carrying only the modules this app uses.
It is committed rather than built on demand: the build needs Docker and takes
around fifteen minutes, which does not belong in a page load or in CI.

|  | full prebuilt | this build |
|---|---|---|
| wasm | 48 MB | 9.3 MB |
| gzipped | 13.2 MB | 3.5 MB |

§11 of `claude.md` put a custom build near 2.4 MB compressed. The gap is mostly
`BRepMesh` and the boolean operations, which are wanted for the triangles the
3D view needs and for the cutouts of §10.

## Rebuilding

```sh
dockerd &                 # if no daemon is running
./tools/build-occt.sh     # reads occt/box-designer.yml, writes occt-box.*
```

Two things the build needs that are easy to miss. Emscripten fetches ports over
HTTPS, so the agent proxy's CA has to reach the container — `tools/build-occt.sh`
mounts it. And `-sUSE_FREETYPE=0` matters twice over: no font symbols are bound,
so it is dead weight, and leaving it on makes the build fetch the FreeType port
and fail behind a TLS-intercepting proxy.

## Threading

Built with `-pthread` and a pool of 4, so `occt-box.worker.js` ships alongside.
That needs cross-origin isolation, which needs COOP/COEP headers.

The worker is a browser worker. Under Node it fails, because this package is
`"type": "module"` and the worker's Node branch calls `require`. Node-side tests
therefore run against the full prebuilt `opencascade.js` package, which exposes
the same API — the adapter in `src/occt/` takes the kernel as an argument
precisely so both work.
