// §19 Path tracing, on demand.
//
// The studio render of §19 is a rasteriser doing its best: image-based light,
// one shadow map, an ambient term standing in for everything light does after
// its first bounce. It looks like a render. What it cannot do is put a little
// of the red front panel onto the white sweep beside it, or darken the inside
// corner of a box because most of the room cannot see into it — and those two
// are most of what makes a photograph look like a photograph.
//
// This follows the light properly instead, one path at a time, averaging frames
// until the noise settles. A few hundred samples on a box this simple, which is
// a few seconds; it refines while you watch and stops when you say.
//
// Loaded by dynamic import, so the 1.5 MB of it is fetched the first time
// somebody presses Refine and never on the way to the first paint.

import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";

/** How many samples before it is worth calling finished. Not a limit — a note. */
export const SETTLED_SAMPLES = 300;

/**
 * Build a path tracer over an existing scene and camera.
 *
 * The scene is the studio scene, unchanged: same geometry, same materials, same
 * environment, same key light. Refining a render must not change what is being
 * rendered, or the button is a different picture rather than a better one.
 */
export async function loadPathTracer({ renderer, scene, camera, environment, size }) {
  // Only the tracer is fetched on demand. three itself is imported at the top,
  // statically: asking for it here as well gave the async chunk its own copy —
  // 200 kB of it, twice in the build, and two sets of classes that would fail
  // every `instanceof` against each other.
  const { PathTracingRenderer, PhysicalPathTracingMaterial, PathTracingSceneGenerator } =
    await import("three-gpu-pathtracer");

  const material = new PhysicalPathTracingMaterial();
  const tracer = new PathTracingRenderer(renderer);
  tracer.camera = camera;
  tracer.material = material;
  tracer.tiles.set(2, 2);              // a frame in four bites, so the tab stays alive
  tracer.setSize(...size);

  scene.updateMatrixWorld(true);
  const { bvh, textures, materials, lights } = new PathTracingSceneGenerator().generate(scene);
  const geometry = bvh.geometry;

  material.bvh.updateFrom(bvh);
  material.attributesArray.updateFrom(
    geometry.attributes.normal,
    geometry.attributes.tangent,
    geometry.attributes.uv,
    geometry.attributes.color);
  material.materialIndexAttribute.updateFrom(geometry.attributes.materialIndex);
  material.textures.setTextures(renderer, 1024, 1024, textures);
  material.materials.updateFrom(materials, textures);
  material.lights.updateFrom(lights);
  material.envMapInfo.updateFrom(environment);
  // Two bounces is not enough for an interior; four is plenty for a box on a
  // sweep, and every extra bounce is paid for on every sample.
  material.bounces = 4;
  material.setDefine("FEATURE_MIS", 1);

  const quad = new FullScreenQuad(new THREE.MeshBasicMaterial({ map: tracer.target.texture }));

  return {
    running: false,
    get samples() { return Math.floor(tracer.samples); },
    get settled() { return tracer.samples >= SETTLED_SAMPLES; },

    update() {
      camera.updateMatrixWorld();
      tracer.update();
      // The target is swapped between frames, so it is read at the last moment
      // rather than held on to.
      quad.material.map = tracer.target.texture;
      const wasAutoClear = renderer.autoClear;
      renderer.autoClear = false;
      quad.render(renderer);
      renderer.autoClear = wasAutoClear;
    },

    reset() { tracer.reset(); },

    setSize(width, height) {
      const ratio = renderer.getPixelRatio();
      tracer.setSize(width * ratio, height * ratio);
      tracer.reset();
    },

    dispose() {
      this.running = false;
      tracer.dispose?.();
      quad.dispose();
      material.dispose();
    },
  };
}
