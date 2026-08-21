// §19 The rendered view: the box as a photograph of itself.
//
// Its own canvas and its own scene rather than another style on the 3D view,
// because almost nothing is shared. There are no edges to draw, the camera
// wants a different framing, the materials are physical rather than flat, and
// the whole thing stands on a floor instead of floating at the origin.
//
// Two levels of it. The studio view is real time: image-based light from the
// environment of §19, a soft key with a shadow map, filmic tone mapping. Refine
// hands the same scene to a path tracer, which follows the light properly —
// bounce, colour bleed off the sweep and between the panels, contact shadow
// that tightens where the box meets the floor — and refines while you watch.
//
// The path tracer is imported only when it is asked for. It is a megabyte and a
// half of code that most visits will never need, and the app has to open on a
// slow connection with a 3D view already on the screen.

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { panelPositions } from "../three/panelGeometry.js";
import { panelBevels } from "../model/bevel.js";
import {
  equirectStudio, sweepProfile, sweepShade, framing, surfaceOf, lampDirection,
  RIG, SWEEP, EXPOSURE,
} from "../three/studio.js";
import { loadPathTracer } from "../render/pathtrace.js";

const POLAR_MIN = 0.12, POLAR_MAX = Math.PI / 2 - 0.02;   // never below the floor

/** The environment, as a texture three can light with. */
function environmentTexture() {
  const { data, width, height } = equirectStudio();
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace;         // it is already linear
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/**
 * A geometry with a colour at every vertex, whether it needs one or not.
 *
 * The path tracer merges the whole scene into a single geometry, and an
 * attribute that some of the parts have and others do not comes out of that
 * merge as nonsense: bands of environment showing through the floor, coloured
 * streaks across the backdrop, light arriving from nowhere. The sweep carries a
 * real gradient (§19); everything else carries white, and the merge is uniform.
 */
export function withColour(geometry, shade) {
  const count = geometry.getAttribute("position").count;
  if (!geometry.getAttribute("color")) {
    const colour = new Float32Array(count * 3).fill(shade ?? 1);
    geometry.setAttribute("color", new THREE.BufferAttribute(colour, 3));
  }
  return geometry;
}

/**
 * The sweep: one profile, extruded sideways, with no seam anywhere in it.
 *
 * Split across its width as well as along its profile, because the falloff of
 * §19 is carried in the vertex colours and a quad two vertices wide can only
 * hold two values of it. Twenty-four columns is enough that the gradient is
 * smooth and few enough that the whole backdrop is still a rounding error next
 * to the box.
 */
function sweepMesh({ radius, floorRun, wallRise, width, back }, diagonal) {
  const profile = sweepProfile(radius, floorRun, wallRise, back);
  const columns = 24;
  const half = width / 2;
  const position = [], colour = [];

  const push = (row, col) => {
    const [z, y] = profile[row];
    const x = -half + (width * col) / columns;
    position.push(x, y, z);
    // Distance from the middle of the box, in box diagonals — which is what
    // `sweepShade` is anchored to, so the pool of light is around the box
    // rather than smeared over a sheet the size of a room.
    const shade = sweepShade(Math.hypot(x, y, z) / diagonal);
    colour.push(shade, shade, shade);
  };

  for (let i = 0; i < profile.length - 1; i++) {
    for (let c = 0; c < columns; c++) {
      // Two triangles a cell, wound so the lit side faces the camera.
      push(i, c); push(i, c + 1); push(i + 1, c + 1);
      push(i, c); push(i + 1, c + 1); push(i + 1, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(position), 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colour), 3));
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: new THREE.Color(SWEEP.colour), vertexColors: true, roughness: 0.95, metalness: 0,
  }));
  mesh.receiveShadow = true;
  return mesh;
}

export default function RenderView({ derived, design, solids, hidden }) {
  const host = useRef(null);
  const gl = useRef(null);
  const [trace, setTrace] = useState({ status: "off" });

  // The renderer and scene outlive a re-render, so turning the box does not
  // rebuild it and refining survives a repaint.
  useEffect(() => {
    const el = host.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x14181d, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = EXPOSURE;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 1, 100000);
    const target = new THREE.Vector3();
    const sph = { az: -0.68, pol: 1.16, dist: 1200 };

    const equirect = environmentTexture();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(equirect).texture;

    const box = new THREE.Group();
    scene.add(box);

    // §19 The studio: sweep and lamps in one group, which turns with the view.
    // The backdrop is then always behind the box and the light always falls the
    // same way across it, so every angle of the box is the same photograph of
    // it rather than a different one taken in the same room.
    const stage = new THREE.Group();
    scene.add(stage);
    // The sweep goes in its own group inside the stage. Rebuilding the scene
    // empties the sweep; the lamps are in the stage beside it and stay put —
    // emptying the group they were in left the box lit by nothing but the sky,
    // which looks like flat lighting and a missing shadow rather than like
    // three lights that are no longer in the scene.
    const sweep = new THREE.Group();
    stage.add(sweep);

    const lights = {};
    for (const [name, lamp] of Object.entries(RIG)) {
      const light = new THREE.DirectionalLight(new THREE.Color(lamp.colour), lamp.intensity);
      if (lamp.casts) {
        light.castShadow = true;
        light.shadow.mapSize.set(2048, 2048);
        light.shadow.bias = -0.0008;
        // Wide enough to read as a soft box rather than as a hard sun. The
        // blur is in map texels, so it has to grow with the map.
        light.shadow.radius = 5;
      }
      stage.add(light);
      stage.add(light.target);
      lights[name] = light;
    }

    const state = {
      renderer, scene, camera, target, sph, box, stage, sweep, lights, equirect, pmrem,
      raf: 0, tracer: null, onTrace: null,
    };
    gl.current = state;

    const place = () => {
      camera.position.set(
        sph.dist * Math.sin(sph.pol) * Math.sin(sph.az),
        sph.dist * Math.cos(sph.pol),
        sph.dist * Math.sin(sph.pol) * Math.cos(sph.az)).add(target);
      camera.lookAt(target);
      camera.near = Math.max(1, (sph.dist - state.radius) * 0.6);
      camera.far = (sph.dist + state.radius) * 4;
      camera.updateProjectionMatrix();

      // The studio follows the camera round. A rotation about y by the camera's
      // own azimuth puts the sweep's wall exactly opposite the lens, which is
      // where a backdrop goes.
      if (state.stage.rotation.y !== sph.az) {
        state.stage.rotation.y = sph.az;
        state.stage.updateMatrixWorld(true);
        // The tracer holds the scene as one baked, world-space tree, so a stage
        // that has moved is a scene it no longer knows. Refitting is cheap on a
        // scene this size and the alternative is a backdrop left behind.
        state.tracer?.sceneMoved();
      }
    };

    const render = () => {
      state.raf = 0;
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      // Against the size last set, in CSS pixels. `domElement.width` is in
      // *device* pixels, so comparing the two was never equal on any display
      // with a pixel ratio above 1 — every frame resized, every frame reset the
      // path tracer, and the trace never got past its first sample. On a phone,
      // where the ratio is 3, that is the picture flashing on and off and only
      // ever a tile or two of it arriving.
      if (state.width !== w || state.height !== h) {
        state.width = w;
        state.height = h;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        state.tracer?.setSize(w, h);
      }
      place();

      // While the path tracer is running it owns the canvas: it is the same
      // scene and the same camera, followed further.
      if (state.tracer?.running) {
        state.tracer.update();
        state.onTrace?.(state.tracer.samples);
        state.raf = requestAnimationFrame(render);
        return;
      }
      renderer.render(scene, camera);
    };
    state.render = render;
    const invalidate = () => { if (!state.raf) state.raf = requestAnimationFrame(render); };
    state.invalidate = invalidate;
    // A moved camera invalidates every sample taken so far — the path tracer
    // averages frames, and averaging two different pictures is a smear.
    state.moved = () => { state.tracer?.reset(); invalidate(); };

    let drag = null;
    const down = (e) => { drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture?.(e.pointerId); };
    const move = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag = { x: e.clientX, y: e.clientY };
      sph.az -= dx * 0.006;
      sph.pol = Math.min(POLAR_MAX, Math.max(POLAR_MIN, sph.pol - dy * 0.006));
      state.moved();
    };
    const up = (e) => { drag = null; el.releasePointerCapture?.(e.pointerId); };
    const wheel = (e) => {
      e.preventDefault();
      sph.dist = Math.max(state.radius * 0.6, Math.min(state.radius * 20, sph.dist * (1 + Math.sign(e.deltaY) * 0.1)));
      state.moved();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });

    const observer = new ResizeObserver(() => state.moved());
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(state.raf);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      state.tracer?.dispose();
      pmrem.dispose();
      equirect.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      gl.current = null;
    };
  }, []);

  // Rebuild the box and its stage whenever the design changes.
  useEffect(() => {
    const state = gl.current;
    if (!state) return;
    const { sol, edges, owners, specFor } = derived;
    const E = sol.E;

    for (const group of [state.box, state.sweep]) {
      // `remove`, not `children.pop()`: popping the array leaves every child
      // still claiming this group as its parent, so anything that later asks
      // "am I in the scene?" is told yes by an object nothing will draw.
      for (const c of [...group.children]) {
        group.remove(c);
        c.geometry?.dispose?.();
        c.material?.dispose?.();
      }
    }

    sol.panels.forEach((panel, index) => {
      const positions = solids?.[index]?.positions
        ?? panelPositions(panel, panelBevels(index, panel, edges, owners), E).positions;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      withColour(geometry);

      const spec = specFor(panel);
      // Always the material's colour, never the face colouring: the face
      // colours are a way of reading the joinery, and this view is a
      // photograph of a box somebody is going to make out of a real sheet.
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(spec.colour),
        vertexColors: true,               // white, so the colour is the sheet's
        ...surfaceOf(spec),
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      state.box.add(mesh);

      for (const tube of solids?.[index]?.tubes ?? []) {
        const tg = new THREE.BufferGeometry();
        tg.setAttribute("position", new THREE.BufferAttribute(tube.positions, 3));
        tg.computeVertexNormals();
        withColour(tg);
        const tm = new THREE.Mesh(tg, material.clone());
        tm.castShadow = true;
        tm.receiveShadow = true;
        state.box.add(tm);
      }
    });

    // On the floor rather than through it: the geometry is centred on the box's
    // middle, and a photograph of a box hovering is a photograph of a mistake.
    state.box.position.set(0, E.z / 2, 0);

    const view = framing(E);
    state.radius = Math.hypot(E.x, E.y, E.z);
    state.sweep.add(sweepMesh(view.sweep, state.radius));
    state.target.set(...view.target);
    if (!state.framed) {
      state.sph.dist = view.distance;
      state.sph.az = view.azimuth;
      state.sph.pol = view.polar;
      state.framed = true;
    }

    // Every lamp aimed at the middle of the box, from its own angle.
    const throwDistance = state.radius * 3;
    for (const [name, lamp] of Object.entries(RIG)) {
      const light = state.lights[name];
      const [lx, ly, lz] = lampDirection(lamp);
      light.position.set(lx * throwDistance, ly * throwDistance, lz * throwDistance);
      light.target.position.set(0, E.z / 2, 0);
      light.target.updateMatrixWorld();
      if (!lamp.casts) continue;
      // Fitted to the box *and the shadow it throws*, which is the part that
      // gets forgotten: a box as tall as this one, lit from 27° up, lays a
      // shadow longer than itself across the floor, and a map fitted to the box
      // alone cuts it off within a few centimetres of where it starts —
      // which looks exactly like no shadow at all.
      const reach = E.z / Math.max(0.2, Math.tan(lamp.elevation));
      const extent = state.radius * 1.2 + reach;
      Object.assign(light.shadow.camera, {
        left: -extent, right: extent, top: extent, bottom: -extent,
        near: throwDistance * 0.25, far: throwDistance * 2.2,
      });
      light.shadow.camera.updateProjectionMatrix();
    }

    // The scene changed, so anything the tracer had accumulated is of a box
    // that no longer exists.
    if (state.tracer) { state.tracer.dispose(); state.tracer = null; setTrace({ status: "off" }); }
    state.moved?.();
  }, [derived, solids]);

  useEffect(() => { if (!hidden) gl.current?.invalidate?.(); }, [hidden]);

  const refine = async () => {
    const state = gl.current;
    if (!state) return;
    if (state.tracer?.running) {                 // a second press stops it
      state.tracer.running = false;
      setTrace({ status: "paused", samples: state.tracer.samples });
      state.invalidate();
      return;
    }
    setTrace({ status: "loading" });
    try {
      const tracer = state.tracer ?? await loadPathTracer({
        renderer: state.renderer, scene: state.scene, camera: state.camera,
        environment: state.equirect,
        size: [state.width ?? host.current.clientWidth, state.height ?? host.current.clientHeight],
      });
      state.tracer = tracer;
      tracer.running = true;
      const scale = tracer.scaleOf(state.width, state.height);
      state.onTrace = (samples) => setTrace({ status: "tracing", samples, scale });
      setTrace({ status: "tracing", samples: 0, scale });
      state.invalidate();
    } catch (error) {
      console.error("Path tracing is not available:", error);
      setTrace({ status: "failed", error });
    }
  };

  const save = () => {
    const state = gl.current;
    if (!state) return;
    if (!state.tracer?.running) state.render();
    const a = document.createElement("a");
    a.href = state.renderer.domElement.toDataURL("image/png");
    a.download = `${(design?.title ?? "box").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-render.png`;
    a.click();
  };

  return (
    <div className="render-mode">
      <div className="viewport render-canvas" ref={host} />
      <div className="chips render-chips">
        <div className="chip-group">
          <button type="button" onClick={refine}>
            {trace.status === "tracing" ? "Stop" : "Refine"}
          </button>
          <button type="button" onClick={save}>Save PNG</button>
        </div>
      </div>
      <div className="render-state">{traceNote(trace)}</div>
    </div>
  );
}

function traceNote(trace) {
  if (trace.status === "loading") return "fetching the path tracer…";
  if (trace.status === "tracing") {
    // The scale only when it is not 1: a soft render nobody was told about
    // reads as a broken one.
    const at = trace.scale && trace.scale < 0.98 ? ` · ${Math.round(trace.scale * 100)}% scale` : "";
    return `path traced, ${trace.samples} sample${trace.samples === 1 ? "" : "s"}${at}`;
  }
  if (trace.status === "paused") return `path traced, ${trace.samples} samples — stopped`;
  if (trace.status === "failed") {
    return `${trace.error?.message ?? "the path tracer would not start"} — showing the studio render`;
  }
  return "studio render · Refine to path trace it";
}
