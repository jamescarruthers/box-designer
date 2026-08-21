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

/**
 * What the sample cap starts at. The view offers it; nothing enforces it here.
 *
 * Low on purpose: a tenth of the work the old 300 was, and under
 * `DENOISE_UNTIL`, so the frame it stops on is still being filtered on its way
 * to the screen and comes out soft rather than grainy. Anyone who wants the
 * noise properly averaged out types a bigger number into the box and the
 * render carries on from where it got to rather than starting over.
 */
export const START_SAMPLES = 30;

/**
 * Below this many samples the frame is denoised on its way to the screen.
 *
 * A bilateral filter over the accumulated image: it costs one full-screen pass
 * and it is the difference between "grainy for the first twenty seconds" and
 * "soft at first, then sharp". Above it the average has done the job and
 * filtering would only take detail away.
 */
export const DENOISE_UNTIL = 80;

/**
 * The most pixels to trace, whatever the display's pixel ratio says.
 *
 * A phone reports a ratio of 3, so a full-screen canvas asks for something like
 * eleven megapixels — of path tracing, on a phone. It traces below this and the
 * result is scaled up to fill the canvas: softer, and the alternative is not a
 * sharper picture but a browser that gives up on the tab.
 */
export const TRACE_PIXEL_CAP = 2_200_000;

/** The size to trace at, in device pixels, for a canvas this big. */
export function traceSize(cssWidth, cssHeight, pixelRatio = 1) {
  const ratio = Math.min(Math.max(pixelRatio, 1), 2);
  let width = Math.max(1, Math.round(cssWidth * ratio));
  let height = Math.max(1, Math.round(cssHeight * ratio));
  const pixels = width * height;
  if (pixels > TRACE_PIXEL_CAP) {
    // Rounded down, both sides: rounding up can land a few hundred pixels over
    // the cap, and a cap that is exceeded is a guideline.
    const shrink = Math.sqrt(TRACE_PIXEL_CAP / pixels);
    width = Math.max(1, Math.floor(width * shrink));
    height = Math.max(1, Math.floor(height * shrink));
  }
  return [width, height];
}

/**
 * How many pieces to trace a frame in.
 *
 * Every tile is one draw call the GPU cannot be interrupted during, so a big
 * frame is split to keep each one short enough that the tab stays answerable —
 * and a small one is not, because a part-drawn frame is visible while it is
 * being drawn and looks like a fault.
 */
export const tilesFor = ([width, height]) => (width * height > 500_000 ? 2 : 1);

/**
 * Whether a render that has taken `samples` has reached the cap it was given.
 *
 * The `> 0` is the whole of it. Zero means no cap, and a cap of zero compared
 * with `>=` is a cap that has always already been reached — a render that stops
 * on its first frame and reports itself finished.
 */
export const capReached = (samples, maxSamples) => maxSamples > 0 && samples >= maxSamples;

/**
 * Build a path tracer over an existing scene and camera.
 *
 * The scene is the studio scene, unchanged: same geometry, same materials, same
 * environment, same key light. Refining a render must not change what is being
 * rendered, or the button is a different picture rather than a better one.
 */
export async function loadPathTracer({ renderer, scene, camera, environment, size }) {
  // `size` is in CSS pixels; what is traced is decided here.
  // Only the tracer is fetched on demand. three itself is imported at the top,
  // statically: asking for it here as well gave the async chunk its own copy —
  // 200 kB of it, twice in the build, and two sets of classes that would fail
  // every `instanceof` against each other.
  const { PathTracingRenderer, PhysicalPathTracingMaterial, DynamicPathTracingSceneGenerator,
    DenoiseMaterial } = await import("three-gpu-pathtracer");

  const material = new PhysicalPathTracingMaterial();
  const tracer = new PathTracingRenderer(renderer);
  tracer.camera = camera;
  tracer.material = material;
  const traced = traceSize(...size, renderer.getPixelRatio());
  const tiles = tilesFor(traced);
  tracer.tiles.set(tiles, tiles);
  tracer.setSize(...traced);

  // The studio turns with the camera (§19), so the scene moves whenever the
  // view does and the tracer's baked, world-space copy of it has to be made
  // again.
  //
  // `generate()` a second time *refits* the tree rather than rebuilding it,
  // which is the cheap path and the wrong one here: refitting assumes the
  // geometry moved a little, and a backdrop that has swung thirty degrees round
  // the subject is not a little. It comes back with bands of environment
  // showing through the floor and light arriving from nowhere. `reset()` first,
  // and it builds a new tree — milliseconds, on a scene this size.
  const generator = new DynamicPathTracingSceneGenerator(scene);

  const absorb = ({ rebuild = false } = {}) => {
    scene.updateMatrixWorld(true);
    if (rebuild) generator.reset();
    const { bvh, textures, materials, lights } = generator.generate();
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
  };

  absorb();
  material.envMapInfo.updateFrom(environment);
  // Two bounces is not enough for an interior; four is plenty for a box on a
  // sweep, and every extra bounce is paid for on every sample.
  material.bounces = 4;
  material.setDefine("FEATURE_MIS", 1);

  // Stable noise: the same sequence every time from a given camera, so a
  // stopped render is the same picture twice rather than two draws of it.
  tracer.stableNoise = true;

  const plain = new FullScreenQuad(new THREE.MeshBasicMaterial({ map: tracer.target.texture }));
  const smoothed = new FullScreenQuad(new DenoiseMaterial());

  return {
    running: false,
    get samples() { return Math.floor(tracer.samples); },

    /**
     * The cap the view asked for. Zero is no cap: it refines until stopped.
     */
    maxSamples: 0,

    /** Whether it has taken every sample it was asked for. */
    get done() { return capReached(tracer.samples, this.maxSamples); },

    /** Whether there is an accumulated image worth showing. */
    get hasImage() { return tracer.samples > 0; },

    update() {
      if (this.done) return this.present();
      camera.updateMatrixWorld();
      tracer.update();
      this.present();
    },

    /**
     * Put the accumulated image on the screen without taking another sample.
     *
     * This is what a stopped render is: the picture stays up. Rendering the
     * scene again instead would throw away the minutes somebody had just spent
     * watching it converge, which is what pressing Stop used to do.
     */
    present() {
      // The target is swapped between frames, so it is read at the last moment
      // rather than held on to.
      const soft = tracer.samples < DENOISE_UNTIL;
      const quad = soft ? smoothed : plain;
      quad.material.map = tracer.target.texture;
      if (soft) {
        // Wound back as the average takes over, so the picture sharpens rather
        // than staying soft and then snapping.
        const strength = 1 - tracer.samples / DENOISE_UNTIL;
        quad.material.sigma = 1 + 4 * strength;
        quad.material.threshold = 0.01 + 0.05 * strength;
      }
      const wasAutoClear = renderer.autoClear;
      renderer.autoClear = false;
      quad.render(renderer);
      renderer.autoClear = wasAutoClear;
    },

    reset() { tracer.reset(); },

    /**
     * The scene has moved under it. Refit, and start the average again — the
     * samples taken so far are of a room that has since turned round.
     */
    sceneMoved() {
      absorb({ rebuild: true });
      tracer.reset();
    },

    /** CSS pixels in; the cap and the pixel ratio are applied here. */
    setSize(width, height) {
      const next = traceSize(width, height, renderer.getPixelRatio());
      if (next[0] === tracer.target.width && next[1] === tracer.target.height) return;
      const t = tilesFor(next);
      tracer.tiles.set(t, t);
      tracer.setSize(...next);
      tracer.reset();
    },

    /** What fraction of the canvas's own resolution is being traced. */
    scaleOf(width, height) {
      const ratio = Math.min(Math.max(renderer.getPixelRatio(), 1), 2);
      return tracer.target.width / Math.max(1, width * ratio);
    },

    dispose() {
      this.running = false;
      tracer.dispose?.();
      plain.dispose();
      smoothed.dispose();
      material.dispose();
    },
  };
}
