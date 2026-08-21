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
  equirectStudio, sweepProfile, framing, surfaceOf, lampDirection, KEY, EXPOSURE,
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

/** The sweep: one profile, extruded sideways, with no seam anywhere in it. */
function sweepMesh({ radius, floorRun, wallRise, width, back }) {
  const profile = sweepProfile(radius, floorRun, wallRise, back);
  const half = width / 2;
  const position = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const [z0, y0] = profile[i], [z1, y1] = profile[i + 1];
    // Two triangles a step, wound so the lit side faces the camera.
    position.push(
      -half, y0, z0, half, y0, z0, half, y1, z1,
      -half, y0, z0, half, y1, z1, -half, y1, z1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(position), 3));
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: new THREE.Color("#d8d8d6"), roughness: 0.94, metalness: 0,
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
    const stage = new THREE.Group();
    scene.add(stage);

    const key = new THREE.DirectionalLight(0xfff4e8, 2.6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0008;
    key.shadow.radius = 3;
    scene.add(key);
    scene.add(key.target);

    const state = {
      renderer, scene, camera, target, sph, box, stage, key, equirect, pmrem,
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

    for (const group of [state.box, state.stage]) {
      while (group.children.length) {
        const c = group.children.pop();
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

      const spec = specFor(panel);
      // Always the material's colour, never the face colouring: the face
      // colours are a way of reading the joinery, and this view is a
      // photograph of a box somebody is going to make out of a real sheet.
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(spec.colour),
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
    state.stage.add(sweepMesh(view.sweep));
    state.target.set(...view.target);
    if (!state.framed) {
      state.sph.dist = view.distance;
      state.sph.az = view.azimuth;
      state.sph.pol = view.polar;
      state.framed = true;
    }

    const [kx, ky, kz] = lampDirection(KEY);
    const throwDistance = state.radius * 3;
    state.key.position.set(kx * throwDistance, ky * throwDistance, kz * throwDistance);
    state.key.target.position.set(0, E.z / 2, 0);
    state.key.target.updateMatrixWorld();
    // Fitted to the box and the floor around it. Wider than that and the map's
    // resolution goes on empty sweep; narrower and the shadow is cut off where
    // it lands.
    const extent = state.radius * 1.3;
    Object.assign(state.key.shadow.camera, {
      left: -extent, right: extent, top: extent, bottom: -extent,
      near: throwDistance * 0.25, far: throwDistance * 2.2,
    });
    state.key.shadow.camera.updateProjectionMatrix();

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
