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
import { panelPositions, explodeOffset } from "../three/panelGeometry.js";
import { explodedBounds } from "../model/explode.js";
import { AXES } from "../model/constants.js";
import { panelBevels } from "../model/bevel.js";
import { slug } from "./file.js";
import {
  equirectStudio, sweepProfile, sweepShade, framing, surfaceOf, lampDirection,
  RIG, SWEEP, EXPOSURE,
} from "../three/studio.js";
import { loadPathTracer, START_SAMPLES } from "../render/pathtrace.js";
import { driverBody, driverMaterial, placeDriver, driversOn } from "../three/driver.js";
import { boardMaps, boxUV, textureFor, TINT_ONE } from "../three/texture.js";
import { makeCamera, frameParallel, parallelPlanes, panBy } from "../three/camera.js";
import ViewMenu from "./ViewMenu.jsx";

const POLAR_MIN = 0.12, POLAR_MAX = Math.PI / 2 - 0.02;   // never below the floor

/** §51 The field a perspective camera renders at, and the field a parallel one
 *  is framed from so that switching between them does not jump. */
const FOV = 35;

/**
 * How finely the sweep is divided: along the curve, and across the width.
 *
 * The curve carries the whole silhouette of the backdrop, so it gets plenty;
 * the width carries only the gradient, which is smooth to begin with. Sixty-one
 * by twenty-five is four thousand triangles — nothing beside the box, and one
 * of the few places where more of them is straightforwardly better.
 */
const SWEEP_STEPS = 60, SWEEP_COLUMNS = 24;

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
 * An **indexed** grid, which is the whole reason the curve looks like a curve.
 * Built as loose triangles every vertex belongs to exactly one of them, so
 * `computeVertexNormals` has nothing to average and hands back the flat normal
 * of each face — a smooth quarter-round then reads as a flight of shallow
 * steps, which is what "the ramp is not smooth" looks like. Shared vertices
 * average across the faces that meet there, and the shading is continuous.
 *
 * Split across its width as well as along its profile, because the falloff of
 * §19 is carried in the vertex colours and a quad two vertices wide can only
 * hold two values of it.
 */
function sweepMesh({ radius, floorRun, wallRise, width, back }, diagonal) {
  const profile = sweepProfile(radius, floorRun, wallRise, back, SWEEP_STEPS);
  const columns = SWEEP_COLUMNS;
  const half = width / 2;
  const position = [], colour = [], index = [];

  for (let row = 0; row < profile.length; row++) {
    const [z, y] = profile[row];
    for (let col = 0; col <= columns; col++) {
      const x = -half + (width * col) / columns;
      position.push(x, y, z);
      // Distance from the middle of the box, in box diagonals — which is what
      // `sweepShade` is anchored to, so the pool of light is around the box
      // rather than smeared over a sheet the size of a room.
      const shade = sweepShade(Math.hypot(x, y, z) / diagonal);
      colour.push(shade, shade, shade);
    }
  }

  const at = (row, col) => row * (columns + 1) + col;
  for (let row = 0; row < profile.length - 1; row++) {
    for (let col = 0; col < columns; col++) {
      // Wound so the lit side faces the camera.
      index.push(at(row, col), at(row, col + 1), at(row + 1, col + 1));
      index.push(at(row, col), at(row + 1, col + 1), at(row + 1, col));
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(position), 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colour), 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: new THREE.Color(SWEEP.colour), vertexColors: true, roughness: 0.95, metalness: 0,
  }));
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * §39 The board texture, built once and shared by every panel cut from that
 * sheet — it is one sheet, and generating a 512² field per panel would be the
 * same numbers over again at six times the cost.
 */
function boardTexture(cache, materialId) {
  const recipe = textureFor(materialId);
  if (!recipe) return null;
  if (cache.has(materialId)) return cache.get(materialId);

  const { size, tint, bump, rough } = boardMaps(recipe);
  const make = (data, colourSpace) => {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    // None of the three is a colour: the tint is a multiplier, the others are
    // a height and a roughness. Decoding them as sRGB would bend all three.
    t.colorSpace = colourSpace;
    t.needsUpdate = true;
    return t;
  };
  const maps = {
    map: make(tint, THREE.NoColorSpace),
    bumpMap: make(bump, THREE.NoColorSpace),
    roughnessMap: make(rough, THREE.NoColorSpace),
    bumpScale: recipe.bump,
    mm: recipe.mm,
  };
  cache.set(materialId, maps);
  return maps;
}

/**
 * §19 The rendered view.
 *
 * `camera` is where the view was left last time and `onCamera` is how it says
 * where it has got to. The mode is unmounted when it is not on screen — a
 * second WebGL context and an environment prefilter are not things to keep
 * warm for a view nobody is looking at — so without this, coming back to it
 * would throw away whatever angle had been set up. It is its own camera, not
 * the 3D view's: the two are different views of the same box and each keeps
 * its own.
 */
export default function RenderView({ derived, design, solids, hidden, camera: kept, onCamera,
  drivers = true, onDrivers, explode = 0, onExplode, parallel = false, onParallel }) {
  const host = useRef(null);
  const gl = useRef(null);
  // Read once, on mount: the view restores where it was left and then owns its
  // own camera. Held in refs so the scene is not rebuilt every time the app
  // above it re-renders.
  const keptRef = useRef(kept);
  const onCameraRef = useRef(onCamera);
  onCameraRef.current = onCamera;
  // §51 Read at mount and swapped in place afterwards, so the effect that
  // builds the scene does not depend on which projection is on.
  const parallelRef = useRef(parallel);
  parallelRef.current = parallel;
  const [trace, setTrace] = useState({ status: "off" });
  // §55 Whether the view has been dragged off the box. Only so the way back can
  // be offered: a camera pointing at nothing, with no button that says so, is a
  // view somebody has to reload the page to escape.
  const [panned, setPanned] = useState(false);
  // §19 How far to refine before stopping. A render is finished when it stops
  // getting better, and that is a judgement about the picture rather than a
  // number the app can know — so it is offered rather than decided.
  const [maxSamples, setMaxSamples] = useState(START_SAMPLES);

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
    let camera = makeCamera(parallelRef.current, FOV);
    const target = new THREE.Vector3();
    // §55 What the camera is looking at, in two parts: where the box is, and
    // where the person has dragged the view to. The scene is rebuilt whenever
    // the design or the explode changes and the aim is recomputed with it, so a
    // pan written straight into the target would be wiped by the next keystroke
    // in the sidebar. Kept apart, it survives.
    const aim = new THREE.Vector3();
    const pan = new THREE.Vector3();
    const sph = { az: -0.68, pol: 1.02, dist: 1200 };

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
      renderer, scene, camera, target, aim, pan, sph, box, stage, sweep, lights, equirect, pmrem,
      onPanned: setPanned,
      raf: 0, tracer: null, onTrace: null, kept: keptRef.current, onCamera: onCameraRef.current,
      // §39 One board texture per sheet, kept across rebuilds: the design
      // changes far more often than the material does.
      textures: new Map(),
    };
    gl.current = state;

    const place = () => {
      const cam = state.camera;
      cam.position.set(
        sph.dist * Math.sin(sph.pol) * Math.sin(sph.az),
        sph.dist * Math.cos(sph.pol),
        sph.dist * Math.sin(sph.pol) * Math.cos(sph.az)).add(target);
      cam.lookAt(target);
      if (cam.isOrthographicCamera) {
        // §51 Framed on what the perspective camera saw, and with depth planes
        // that may sit behind the eye — parallel rays do not care where along
        // them the camera is, only what gets clipped.
        frameParallel(cam, sph.dist, (state.width || 1) / (state.height || 1), FOV);
        const { near, far } = parallelPlanes(sph.dist, state.radius);
        cam.near = near;
        cam.far = far;
      } else {
        cam.near = Math.max(1, (sph.dist - state.radius) * 0.6);
        cam.far = (sph.dist + state.radius) * 4;
      }
      cam.updateProjectionMatrix();

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
        if (!state.camera.isOrthographicCamera) state.camera.aspect = w / h;
        state.tracer?.setSize(w, h);
      }
      place();

      // While the path tracer is running it owns the canvas: it is the same
      // scene and the same camera, followed further.
      if (state.tracer?.running) {
        state.tracer.update();
        state.onTrace?.(state.tracer.samples, state.tracer.done);
        if (state.tracer.done) {
          // Every sample it was asked for. Stop taking them; keep the picture.
          state.tracer.running = false;
          state.tracer.held = true;
          return;
        }
        state.raf = requestAnimationFrame(render);
        return;
      }
      // A stopped render is held, not discarded: the picture somebody watched
      // converge stays up until they move the view.
      if (state.tracer?.held && state.tracer.hasImage) return state.tracer.present();
      renderer.render(scene, state.camera);
    };
    state.render = render;
    const invalidate = () => { if (!state.raf) state.raf = requestAnimationFrame(render); };
    state.invalidate = invalidate;
    // A moved camera invalidates every sample taken so far — the path tracer
    // averages frames, and averaging two different pictures is a smear.
    //
    // A trace that was still running picks up again from the new angle. One
    // that had been stopped and held is let go of here, and only here: turning
    // the box is the moment somebody has finished with that picture.
    // Reported on the way out as well as as it moves, so the mode can be left
    // at any moment and come back to the same angle.
    state.report = () => state.onCamera?.({
      azimuth: sph.az, polar: sph.pol, distance: sph.dist,
      pan: [pan.x, pan.y, pan.z],
    });

    /** Look at the box again, from wherever the view has been dragged to. */
    state.retarget = () => { target.copy(aim).add(pan); };

    state.moved = () => {
      if (state.tracer?.held) {
        state.tracer.held = false;
        state.onHeldReleased?.();
      }
      state.tracer?.reset();
      state.report();
      invalidate();
    };

    // §55 Drag to turn, shift-drag or middle-drag to pan, wheel to zoom — the
    // same hand as §4's 3D view, because they are two views of one box and a
    // pointer that means different things in each is a pointer you have to
    // remember. Which it is is settled on the way down: a shift let go of
    // halfway through a drag should not turn a pan into a pirouette.
    let drag = null;
    const down = (e) => {
      drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey || e.button === 1 };
      el.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag = { ...drag, x: e.clientX, y: e.clientY };
      if (drag.pan) {
        // Across the screen, whichever way the camera happens to be facing:
        // its own right and up, scaled so a pixel drags the same distance of
        // box however far back the camera is standing.
        panBy(state.camera, sph.dist, dx, dy, pan);
        state.retarget();
        state.onPanned?.(pan.length() > 1e-6);
      } else {
        sph.az -= dx * 0.006;
        sph.pol = Math.min(POLAR_MAX, Math.max(POLAR_MIN, sph.pol - dy * 0.006));
      }
      state.moved();
    };
    const up = (e) => { drag = null; el.releasePointerCapture?.(e.pointerId); };
    const wheel = (e) => {
      e.preventDefault();
      sph.dist = Math.max(state.radius * 0.6, Math.min(state.radius * 20, sph.dist * (1 + Math.sign(e.deltaY) * 0.1)));
      state.moved();
    };
    const noAuxScroll = (e) => { if (e.button === 1) e.preventDefault(); };
    el.addEventListener("auxclick", noAuxScroll);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });

    const observer = new ResizeObserver(() => state.moved());
    observer.observe(el);

    return () => {
      state.report();
      observer.disconnect();
      cancelAnimationFrame(state.raf);
      el.removeEventListener("auxclick", noAuxScroll);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      state.tracer?.dispose();
      for (const maps of state.textures.values())
        for (const m of [maps.map, maps.bumpMap, maps.roughnessMap]) m.dispose();
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
      const colour = new THREE.Color(spec.colour);
      // §39 The texture, where the sheet has one. Its tint averages TINT_ONE
      // rather than white, so the colour is divided back up by exactly that —
      // in the linear working space the Color is already in, which is the only
      // place the arithmetic is the arithmetic.
      const texture = boardTexture(state.textures, spec.materialId);
      if (texture) {
        geometry.setAttribute("uv", new THREE.BufferAttribute(
          boxUV(positions, geometry.getAttribute("normal").array, texture.mm), 2));
        colour.multiplyScalar(255 / TINT_ONE);
      }
      const material = new THREE.MeshStandardMaterial({
        color: colour,
        vertexColors: true,               // white, so the colour is the sheet's
        ...surfaceOf(spec),
        ...(texture
          ? { map: texture.map, bumpMap: texture.bumpMap, bumpScale: texture.bumpScale,
              roughnessMap: texture.roughnessMap }
          : {}),
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // §51 Exploded as it is placed rather than moved afterwards: the studio,
      // the shadows and the path tracer all read the scene as it stands, and a
      // panel moved after they were fitted is a panel none of them knows about.
      mesh.position.set(...explodeOffset(panel, explode));
      state.box.add(mesh);

      for (const tube of solids?.[index]?.tubes ?? []) {
        const tg = new THREE.BufferGeometry();
        tg.setAttribute("position", new THREE.BufferAttribute(tube.positions, 3));
        tg.computeVertexNormals();
        withColour(tg);
        const tm = new THREE.Mesh(tg, material.clone());
        tm.castShadow = true;
        tm.receiveShadow = true;
        tm.position.set(...explodeOffset(panel, explode));
        state.box.add(tm);
      }
    });

    // §22 The drivers. The whole point of the rendered view is that it looks
    // like the thing being made, and the thing being made is a speaker — a box
    // with a round hole in it is a box with a round hole in it.
    if (drivers) {
      for (const { fitting, panel } of driversOn(derived.fittings, derived.fittingPanels)) {
        const mesh = new THREE.Mesh(driverBody(fitting), driverMaterial());
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // A driver goes with the panel it is bolted to, in a group of its own so
        // that where it sits on that panel is not overwritten by the explode.
        const group = new THREE.Group();
        group.position.set(...explodeOffset(panel, explode));
        group.add(placeDriver(mesh, fitting, panel, E));
        state.box.add(group);
      }
    }

    // On the floor rather than through it: the geometry is centred on the box's
    // middle, and a photograph of a box hovering is a photograph of a mistake.
    //
    // §54 What stands on the floor is the *lowest piece*, which once the box is
    // exploded is not its underside. The bottom panels move down along their own
    // normals — the bottom cladding by 1.5× the amount asked for — and the floor
    // does not go with them, so an exploded box was half sunk into it. The
    // assembly is lifted by however far its lowest piece has dropped, and the
    // camera and the lamps are aimed that much higher so it stays in frame.
    const bounds = explodedBounds(sol.panels, explode);
    const sink = Math.min(0, bounds.z[0]);
    const stand = E.z / 2 - sink;
    state.box.position.set(0, stand, 0);

    const view = framing(E);
    // §51 An exploded box reaches further than the box does, and the sweep
    // behind it and the shadow map over it are both fitted to this.
    state.radius = Math.hypot(E.x, E.y, E.z) + explode * 2;
    state.sweep.add(sweepMesh(view.sweep, state.radius));

    // §55 The camera looks at the middle of the thing on the stand, measured
    // rather than assumed. §19 aimed a little below the middle of the *box*,
    // which flatters a box and says nothing about an assembly that has come
    // apart: the pieces spread both ways, a box clad on one face spreads
    // lopsidedly, and the picture slid out of frame as the slider moved. The
    // middle of what is actually there is the one point that is right for all
    // of them. `mid` is in model coordinates, so it goes through the same
    // mapping the geometry did (§4: x right, z up, y back and negated) and up
    // by the same stand.
    const mid = Object.fromEntries(AXES.map((b) => [b, (bounds[b][0] + bounds[b][1]) / 2]));
    state.aim.set(mid.x - E.x / 2, mid.z - E.z / 2 + stand, -(mid.y - E.y / 2));
    if (!state.framed) {
      // Where it was left, if it has been here before; the framing of §19 if
      // this is the first time.
      const from = state.kept ?? view;
      state.sph.dist = from.distance ?? view.distance;
      state.sph.az = from.azimuth ?? view.azimuth;
      state.sph.pol = from.polar ?? view.polar;
      // §55 And whatever it had been panned to, which is as much a part of
      // where the view was left as the angle is.
      if (Array.isArray(from.pan)) state.pan.set(...from.pan);
      state.framed = true;
    }
    state.retarget();
    state.onPanned?.(state.pan.length() > 1e-6);

    // Every lamp aimed at the middle of the box, from its own angle. §55 The
    // same middle the camera looks at, and not the panned target: dragging the
    // view across the box is a change of viewpoint, not of the lighting.
    const throwDistance = state.radius * 3;
    for (const [name, lamp] of Object.entries(RIG)) {
      const light = state.lights[name];
      const [lx, ly, lz] = lampDirection(lamp);
      light.position.set(lx * throwDistance, ly * throwDistance, lz * throwDistance);
      light.target.position.copy(state.aim);
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
  }, [derived, solids, drivers, explode]);

  // §51 Swap the projection in place. The tracer goes with it: a different
  // projection is a different picture, not a better one, and the samples it had
  // taken are of the other.
  useEffect(() => {
    const state = gl.current;
    if (!state || Boolean(state.camera.isOrthographicCamera) === Boolean(parallel)) return;
    state.camera = makeCamera(parallel, FOV);
    if (state.tracer) { state.tracer.dispose(); state.tracer = null; setTrace({ status: "off" }); }
    state.moved?.();
  }, [parallel]);

  useEffect(() => { if (!hidden) gl.current?.invalidate?.(); }, [hidden]);

  // Raising the cap on a render that has already stopped sets it going again;
  // lowering it below where it has got to stops it where it is.
  useEffect(() => {
    const state = gl.current;
    if (!state?.tracer) return;
    state.tracer.maxSamples = maxSamples;
    if (state.tracer.done || !state.tracer.held) return;
    state.tracer.running = true;
    state.tracer.held = false;
    state.invalidate();
  }, [maxSamples]);

  const refine = async () => {
    const state = gl.current;
    if (!state) return;
    if (state.tracer?.running) {                 // a second press stops it
      state.tracer.running = false;
      state.tracer.held = true;                  // and the picture stays up
      setTrace({ status: "held", samples: state.tracer.samples });
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
      tracer.maxSamples = maxSamples;
      tracer.running = true;
      tracer.held = false;
      const scale = tracer.scaleOf(state.width, state.height);
      state.onTrace = (samples, done) =>
        setTrace({ status: done ? "done" : "tracing", samples, scale });
      state.onHeldReleased = () => setTrace({ status: "off" });
      setTrace({ status: "tracing", samples: 0, scale });
      state.invalidate();
    } catch (error) {
      console.error("Path tracing is not available:", error);
      setTrace({ status: "failed", error });
    }
  };

  /** §55 Back to the middle of the box, leaving the angle and the zoom alone. */
  const recentre = () => {
    const state = gl.current;
    if (!state) return;
    state.pan.set(0, 0, 0);
    state.retarget();
    setPanned(false);
    state.moved();
  };

  const save = () => {
    const state = gl.current;
    if (!state) return;
    if (!state.tracer?.running) state.render();
    const a = document.createElement("a");
    a.href = state.renderer.domElement.toDataURL("image/png");
    a.download = `${slug(design?.title ?? "box")}-render.png`;
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
        {/* §51 A photograph of a box is a box seen from somewhere, and the far
            end is smaller than the near one. A parallel picture is the box
            itself — worth having where the picture is what gets judged.
            §60 In the same menu the 3D view keeps it in. */}
        {onDrivers || onParallel ? (
          <ViewMenu parallel={parallel} onParallel={onParallel} drivers={drivers} onDrivers={onDrivers} />
        ) : null}
        {onExplode ? (
          <div className="chip-group explode">
            <label htmlFor="render-explode">Explode</label>
            <input id="render-explode" type="range" min="0" max="120" value={explode}
              onChange={(e) => onExplode(Number(e.target.value))} />
            <output>{explode}</output>
          </div>
        ) : null}
        {/* §55 Shift-drag or middle-drag moves the box about the frame. The
            button is the way back, and the way anybody finds out the pan is
            there at all. */}
        <div className="chip-group">
          <button type="button" disabled={!panned}
            title="Shift-drag or middle-drag the picture to pan; this puts it back"
            onClick={recentre}>Recentre</button>
        </div>
        <div className="chip-group samples">
          <label htmlFor="max-samples">Samples</label>
          <input id="max-samples" type="number" min="1" max="5000" step="1" value={maxSamples}
            onChange={(e) => setMaxSamples(Math.max(1, Number(e.target.value) || 1))} />
        </div>
      </div>
      <div className="render-state">{traceNote(trace)}</div>
    </div>
  );
}

export function traceNote(trace) {
  if (trace.status === "loading") return "fetching the path tracer…";
  if (trace.status === "tracing") {
    // The scale only when it is not 1: a soft render nobody was told about
    // reads as a broken one.
    const at = trace.scale && trace.scale < 0.98 ? ` · ${Math.round(trace.scale * 100)}% scale` : "";
    return `path traced, ${trace.samples} sample${trace.samples === 1 ? "" : "s"}${at}`;
  }
  if (trace.status === "held") return `path traced, ${trace.samples} samples — stopped, turn the view to go back`;
  if (trace.status === "done") return `path traced, ${trace.samples} samples — done`;
  if (trace.status === "failed") {
    return `${trace.error?.message ?? "the path tracer would not start"} — showing the studio render`;
  }
  return "studio render · Refine to path trace it";
}
