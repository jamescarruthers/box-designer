// §4 The 3D view: panel solids, render styles, colour modes and a hand-rolled orbit.

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { panelPositions, explodeOffset, panelEdgeLoops } from "../three/panelGeometry.js";
import { driverBody, driverMaterial, placeDriver, driversOn } from "../three/driver.js";
import { panelBevels } from "../model/bevel.js";
import { edgePasses, showsFaces, needsDepth, EDGE_COLOUR } from "../three/edges.js";
import { edgeProxies, pickRadius, hintSize } from "../three/edgePick.js";
import { toThree } from "../three/panelGeometry.js";
import { panelColour, SELECT_EMISSIVE, ACCENT } from "../three/palette.js";

/**
 * §59 How far a hovered panel is lifted, against the 1 a selected one gets.
 *
 * Enough to see which board the pointer is on, not so much that hovering looks
 * like having chosen. The two have to be told apart at a glance, because one
 * of them survives the pointer moving away.
 */
const HOVER_LIFT = 0.34;

/** §59 The colour of an edge that is merely under the pointer. */
const HINT = "#9fb3c8";
import { lineWidthFor, nearFar, sceneRadius } from "../three/lines.js";
import { makeCamera, frameParallel, parallelPlanes, panBy } from "../three/camera.js";
import { makeGizmo, gizmoRect, gizmoNdc, faceOfNormal, viewOf } from "../three/gizmo.js";

/** §4 The two depth comparisons the edge passes use. */
const DEPTH_FUNC = { "less-equal": THREE.LessEqualDepth, greater: THREE.GreaterDepth };

/**
 * §17 Add a body's edges in every pass its style asks for. Shared by the panels
 * and by a port's tube, which is a body of its own.
 *
 * Drawn as screen-space quads rather than GL lines, so they have a width and an
 * antialiased edge. Every material made here is handed back to `state` so its
 * resolution can be kept level with the drawing buffer: a fat line is sized in
 * the shader, and a shader that thinks the canvas is the wrong size draws the
 * wrong width.
 */
function addEdges(state, root, geometryOrPositions, index, style, accent = false) {
  const positions = geometryOrPositions instanceof THREE.BufferGeometry
    ? geometryOrPositions.getAttribute("position").array
    : geometryOrPositions;
  if (!positions?.length) return;

  const eg = new LineSegmentsGeometry();
  eg.setPositions(positions instanceof Float32Array ? positions : new Float32Array(positions));

  for (const pass of edgePasses(style, { accent })) {
    const material = new LineMaterial({
      color: new THREE.Color(pass.accent ? ACCENT : EDGE_COLOUR),
      linewidth: lineWidthFor(state.renderer.getPixelRatio()),
      worldUnits: false,
      depthTest: pass.depthTest,
      depthFunc: DEPTH_FUNC[pass.depthFunc] ?? THREE.LessEqualDepth,
      depthWrite: pass.depthWrite ?? true,
      transparent: true,
      opacity: pass.opacity,
    });
    state.renderer.getDrawingBufferSize(material.resolution);
    state.lineMaterials.push(material);

    const lines = new LineSegments2(eg, material);
    // The faint pass last, so it lies over the shading rather than under.
    lines.renderOrder = pass.name === "hidden" ? 3 : 2;
    lines.userData.offsetOf = index;
    root.add(lines);
  }
}

export const RENDER_STYLES = [
  { id: "shaded", name: "Shaded" },
  { id: "shaded-edges", name: "Shaded + hidden edges" },
  { id: "wireframe", name: "Wireframe" },
  { id: "wireframe-hlr", name: "Wireframe, hidden removed" },
];

// §4 View presets: [azimuth, polar].
/** §51 The field of view a perspective camera uses, and the one a parallel
 *  camera sizes its frustum from so the two frame the box alike. */
export const FOV = 38;

export const VIEW_PRESETS = {
  iso: [-0.72, 1.08], front: [0, Math.PI / 2], top: [0, 0.08], right: [Math.PI / 2, Math.PI / 2],
};

const POLAR_MIN = 0.06, POLAR_MAX = Math.PI - 0.06;

export default function Viewport({ derived, style, colourByFace, explode, parallel = false, selected, onSelect, hovered, onHover, hidden, camera, solids, onContext, drivers = true }) {
  const host = useRef(null);
  const gl = useRef(null);

  // §51 Read at mount and on every change: the camera is built once and then
  // swapped in place, so the effect that builds the scene must not depend on it.
  const parallelRef = useRef(parallel);
  parallelRef.current = parallel;

  // The renderer, scene and camera outlive every re-render, so the camera
  // survives a switch to another mode.
  useEffect(() => {
    const el = host.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x14181d, 1);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // §51 Held on the state rather than in a closure: the projection can be
    // switched, and a camera captured by `render` would go on being the one
    // that was built at mount.
    let camera = makeCamera(parallelRef.current, FOV);
    const target = new THREE.Vector3();
    const sph = { az: VIEW_PRESETS.iso[0], pol: VIEW_PRESETS.iso[1], dist: 900 };

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(1, 1.4, 0.9);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9fb6cc, 0.35);
    fill.position.set(-1, -0.4, -0.8);
    scene.add(fill);

    const root = new THREE.Group();
    scene.add(root);

    // §61 The orientation cube, in its own scene with its own camera, drawn
    // into a corner of the same canvas after the box.
    const gizmo = makeGizmo();

    const state = { renderer, scene, camera, target, sph, root, picks: [], raf: 0, needs: true,
      // §58 The edges: invisible proxies to hit, and the key under the
      // pointer. Kept on `state` so the pointer handlers, which are installed
      // once, can see the current set without being rebuilt.
      edgeProxies: [], edgeHover: null,
      // §59 What the pointer is over, and the panel materials to lift for it.
      faceHover: null, hovered: null, panelMats: [], onHover: null,
      // §17 Every fat-line material in the scene. They are sized in the shader
      // from a resolution they are told, so a resize has to tell them.
      lineMaterials: [], radius: 1,
      // §61 The cube and where it is drawn, in CSS pixels from the bottom left.
      gizmo, gizmoRect: gizmoRect(1, 1) };
    gl.current = state;

    const place = () => {
      const cam = state.camera;
      const p = new THREE.Vector3(
        sph.dist * Math.sin(sph.pol) * Math.sin(sph.az),
        sph.dist * Math.cos(sph.pol),
        sph.dist * Math.sin(sph.pol) * Math.cos(sph.az));
      cam.position.copy(p.add(target));
      cam.lookAt(target);

      // §17 The depth planes follow the camera. Left at 1 and 100000 the buffer
      // spends its precision on empty space, and two surfaces a millimetre
      // apart — a panel and the edge drawn along it — cannot be told apart.
      const reach = state.radius + target.length();
      const { near, far } = cam.isOrthographicCamera
        ? parallelPlanes(sph.dist, reach) : nearFar(sph.dist, reach);
      if (cam.isOrthographicCamera) {
        frameParallel(cam, sph.dist, (state.width || 1) / (state.height || 1), FOV);
      }
      if (near !== cam.near || far !== cam.far || cam.isOrthographicCamera) {
        cam.near = near;
        cam.far = far;
        cam.updateProjectionMatrix();
      }
    };
    state.place = place;

    const render = () => {
      state.raf = 0;
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;                     // skip while the viewport is hidden
      // In CSS pixels, against what was last set. `domElement.width` is in
      // device pixels and never equals this on a 2x display, so the old test
      // resized on every single frame.
      if (state.width !== w || state.height !== h) {
        state.width = w;
        state.height = h;
        renderer.setSize(w, h, false);
        if (!state.camera.isOrthographicCamera) state.camera.aspect = w / h;
        state.camera.updateProjectionMatrix();
      }
      // Cheap, and the alternative is a line that keeps its old width until
      // something else happens to rebuild the scene.
      const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
      for (const m of state.lineMaterials) {
        if (!m.resolution.equals(buffer)) m.resolution.copy(buffer);
      }
      place();
      renderer.render(scene, state.camera);

      // §61 The cube, over the box in the bottom right. Its camera copies the
      // orbit's angles and nothing else, so it turns as the box turns and never
      // zooms or pans away.
      const rect = gizmoRect(w, h);
      state.gizmoRect = rect;
      gizmo.place(sph.az, sph.pol);
      renderer.autoClear = false;
      renderer.setScissorTest(true);
      renderer.setViewport(rect.x, rect.y, rect.w, rect.h);
      renderer.setScissor(rect.x, rect.y, rect.w, rect.h);
      renderer.clearDepth();
      renderer.render(gizmo.scene, gizmo.camera);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, w, h);
      renderer.autoClear = true;
    };
    state.render = render;
    const invalidate = () => { if (!state.raf) state.raf = requestAnimationFrame(render); };
    state.invalidate = invalidate;

    // --- hand-rolled orbit: drag to orbit, shift-drag to pan, wheel to zoom.
    let drag = null;
    const down = (e) => {
      // §58 The left button turns the box and picks what is under it; the right
      // one opens a menu and nothing else. Without this a right-click also
      // selected the panel behind the menu — and a second right-click on the
      // same face closed the inspector it had just opened.
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey, moved: 0 };
      el.setPointerCapture?.(e.pointerId);
    };
    const rayAt = (e) => {
      const r = el.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1), state.camera);
      return ray;
    };
    /** §61 The face of the orientation cube under the pointer, or null. */
    const gizmoFaceAt = (e) => {
      const r = el.getBoundingClientRect();
      const ndc = gizmoNdc(e.clientX - r.left, e.clientY - r.top, state.gizmoRect, r.height);
      if (!ndc) return null;
      ray.setFromCamera(new THREE.Vector2(ndc[0], ndc[1]), gizmo.camera);
      const hit = ray.intersectObject(gizmo.cube, false)[0];
      if (!hit?.face) return null;
      return faceOfNormal([hit.face.normal.x, hit.face.normal.y, hit.face.normal.z]);
    };
    /** The edge the pointer is over, whatever any tool thinks of it. */
    const edgeAt = (e) => {
      if (!state.edgeProxies.length) return null;
      const hit = rayAt(e).intersectObjects(state.edgeProxies, false)[0];
      return hit ? hit.object.userData.edgeKey : null;
    };
    /**
     * §59 Light the panel under the pointer, in place.
     *
     * Selection wins: a panel that is both selected and hovered is selected,
     * and lifting it further would say the pointer had done something.
     */
    state.paintHover = () => {
      const lit = state.faceHover ?? state.hovered;
      for (let i = 0; i < state.panelMats.length; i++) {
        const mat = state.panelMats[i];
        if (!mat) continue;
        const level = state.selected === i ? 1 : i === lit ? HOVER_LIFT : 0;
        if (mat.emissiveIntensity === level) continue;
        mat.emissive.set(level ? SELECT_EMISSIVE : 0x000000);
        mat.emissiveIntensity = level;
      }
    };

    /** The panel under the pointer, or null. */
    const panelAt = (e) => {
      const hit = rayAt(e).intersectObjects(state.picks, false)[0];
      return hit ? hit.object.userData.index : null;
    };
    const move = (e) => {
      if (!drag) {
        // §59 Highlight what is under the pointer — which is what a right-click
        // would act on, edge before face. An edge that never shows itself is a
        // menu nobody knows to open.
        // §61 Over the cube, nothing on the box is hovered and the cursor
        // says a click will do something.
        const onGizmo = gizmoFaceAt(e) != null;
        el.style.cursor = onGizmo ? "pointer" : "";
        const key = onGizmo ? null : edgeAt(e);
        const index = key == null && !onGizmo ? panelAt(e) : null;
        if (key !== state.edgeHover) { state.edgeHover = key; state.drawEdgeHint?.(); invalidate(); }
        if (index !== state.faceHover) { state.faceHover = index; state.paintHover?.(); invalidate(); }
        state.onHover?.(key ? { kind: "edge", key } : index != null ? { kind: "panel", index } : null);
        return;
      }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.pan) {
        // §55 The same pan the rendered view does, from the same rule.
        panBy(state.camera, sph.dist, dx, dy, target);
      } else {
        sph.az -= dx * 0.007;
        sph.pol = Math.min(POLAR_MAX, Math.max(POLAR_MIN, sph.pol - dy * 0.007));
      }
      invalidate();
    };
    const up = (e) => {
      if (drag && drag.moved < 4) pick(e);
      drag = null;
    };
    const wheel = (e) => {
      e.preventDefault();
      sph.dist = Math.max(20, Math.min(200000, sph.dist * Math.exp(e.deltaY * 0.0012)));
      invalidate();
    };
    const ray = new THREE.Raycaster();
    // §60 A left-click selects the panel under it. Edges are the right button's
    // business (§58): the armed edge tool that used to take the click here is
    // gone, along with the mode it put the pointer into.
    const pick = (e) => {
      // §61 A click on the cube turns the box to that face and selects nothing.
      const face = gizmoFaceAt(e);
      if (face) {
        const [az, pol] = viewOf(face, { polarMin: POLAR_MIN, polarMax: POLAR_MAX });
        sph.az = az;
        sph.pol = pol;
        invalidate();
        return;
      }
      const hit = rayAt(e).intersectObjects(state.picks, false)[0];
      state.onSelect?.(hit ? hit.object.userData.index : null);
    };

    /**
     * §58 A right-click asks what is here. The edge wins a tie, as it does for
     * a left-click: it is the smaller target and the panel behind it is always
     * one more click away.
     */
    const context = (e) => {
      e.preventDefault();
      if (!state.onContext) return;
      const key = edgeAt(e);
      if (key) { state.onContext({ kind: "edge", key }, { x: e.clientX, y: e.clientY }); return; }
      const hit = rayAt(e).intersectObjects(state.picks, false)[0];
      state.onContext(hit ? { kind: "panel", index: hit.object.userData.index } : null,
        { x: e.clientX, y: e.clientY });
    };
    const leave = () => {
      if (state.edgeHover != null) { state.edgeHover = null; state.drawEdgeHint?.(); invalidate(); }
      if (state.faceHover != null) { state.faceHover = null; state.paintHover?.(); invalidate(); }
      state.onHover?.(null);
    };
    el.addEventListener("pointerleave", leave);
    el.addEventListener("contextmenu", context);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    const ro = new ResizeObserver(invalidate);
    ro.observe(el);

    return () => {
      ro.disconnect();
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("contextmenu", context);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      cancelAnimationFrame(state.raf);
      gizmo.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      gl.current = null;
    };
  }, []);

  /**
   * §58 The edge layer: an invisible proxy on every edge, so a right-click can
   * hit one, and a line on whichever one the pointer is over.
   *
   * Its own effect, because it changes on a different rhythm from the panels —
   * turning the box must not rebuild the proxies.
   */
  useEffect(() => {
    const state = gl.current;
    if (!state) return;

    for (const m of state.edgeProxies) state.scene.remove(m);
    state.edgeProxies = [];
    if (state.edgeHint) { state.scene.remove(state.edgeHint); state.edgeHint = null; }
    state.edgeHover = null;

    const { sol } = derived;
    const r = pickRadius(sol.E);
    const byKey = new Map();
    for (const proxy of edgeProxies(sol.env, sol.E, r)) {
      byKey.set(proxy.key, proxy);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(...proxy.size),
        // Invisible, but still hit: three raycasts an object whatever its
        // material says, and only skips it if the object itself is not there.
        new THREE.MeshBasicMaterial({ visible: false }));
      mesh.position.set(...proxy.centre);
      mesh.userData.edgeKey = proxy.key;
      state.scene.add(mesh);
      state.edgeProxies.push(mesh);
    }

    // Redrawn on every hover change rather than rebuilt: one bar, six faces.
    state.drawEdgeHint = () => {
      if (state.edgeHint) { state.scene.remove(state.edgeHint); state.edgeHint = null; }
      const proxy = state.edgeHover ? byKey.get(state.edgeHover) : null;
      if (!proxy) return;
      // §59 A quiet grey: the hint says "this is the edge you are on, and a
      // right-click can do something with it".
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(...hintSize(proxy, r)),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(HINT), transparent: true,
          opacity: 0.55,
          // Over the box rather than in it: the edge being offered is the point,
          // and half of it disappearing behind a panel would only confuse.
          depthTest: false,
        }));
      bar.position.set(...proxy.centre);
      bar.renderOrder = 5;
      state.scene.add(bar);
      state.edgeHint = bar;
    };
    state.drawEdgeHint();
    state.needs = true;
  }, [derived]);

  // Rebuild the panels whenever the box, the styling or the selection changes.
  useEffect(() => {
    const state = gl.current;
    if (!state) return;
    state.onSelect = onSelect;
    const { root } = state;
    // Down the tree rather than across it: a driver (§22) is a mesh inside a
    // group, and a loop that only frees what is directly under the root frees
    // the group and leaks the driver. `remove` rather than `pop`, so nothing is
    // left naming a parent it is no longer in.
    for (const c of [...root.children]) {
      root.remove(c);
      c.traverse?.((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    }
    state.picks = [];
    state.panelMats = [];
    state.selected = selected;
    state.lineMaterials = [];
    // Exploding the box moves panels away from its centre, so the far plane
    // has to know about it as well as the box's own size.
    state.radius = sceneRadius(derived.sol.E, explode);

    const { sol, edges, owners, specFor } = derived;
    const E = sol.E;

    sol.panels.forEach((panel, index) => {
      const bevels = panelBevels(index, panel, edges, owners);
      // The kernel's triangles when it has them, the ring stack otherwise.
      const positions = solids?.[index]?.positions ?? panelPositions(panel, bevels, E).positions;
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geom.computeVertexNormals();

      // Material colouring is per panel: a Valchromat cladding reads differently
      // from the birch carcass behind it.
      const colour = colourByFace ? panelColour(panel) : specFor(panel).colour;
      const isSel = selected === index;

      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colour),
        flatShading: true,
        roughness: 0.82, metalness: 0.02,
        // Selection must not recolour the panel — that destroys what the
        // colouring is for. Lift the emissive instead.
        emissive: new THREE.Color(isSel ? SELECT_EMISSIVE : 0x000000),
        emissiveIntensity: isSel ? 1 : 0,
        // §17 A hair further away than it really is, so the edge drawn along a
        // face wins the depth test along its whole length instead of stippling
        // in and out of the shading it lies on.
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
        transparent: style === "shaded-edges",
        opacity: style === "shaded-edges" ? 0.94 : 1,
        depthWrite: true,
      });

      // Rendered even when the faces are not shown: hidden edges need
      // something to be hidden by, and that something is the depth buffer.
      const showFaces = showsFaces(style);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.userData.index = index;
      // §59 Kept by index so hovering can lift one panel's emissive in place.
      // Rebuilding every mesh because the pointer crossed a face is a remesh
      // per mouse move, and the cut list's own hover was doing exactly that.
      state.panelMats[index] = mat;
      if (!showFaces) { mat.colorWrite = false; }
      mesh.visible = showFaces || needsDepth(style);
      root.add(mesh);
      state.picks.push(mesh);

      // The kernel supplies real B-Rep edges; EdgesGeometry can only infer them
      // from dihedral angle, which loses the tangent boundary at every fillet.
      // §12 Port tubes: separate bodies, coloured and exploded with their panel.
      for (const tube of solids?.[index]?.tubes ?? []) {
        const tg = new THREE.BufferGeometry();
        tg.setAttribute("position", new THREE.BufferAttribute(tube.positions, 3));
        tg.computeVertexNormals();
        const tm = new THREE.Mesh(tg, mat.clone());
        tm.userData.offsetOf = index;
        tm.visible = showFaces || needsDepth(style);   // depth, for the same reason
        root.add(tm);
        // And its edges, or the tube is invisible in both wireframe styles —
        // where its faces are drawn into the depth buffer and nowhere else.
        if (tube.edges) addEdges(state, root, tube.edges.positions, index, style);
      }

      const kernelEdges = solids?.[index]?.edges;
      const edgeGeometry = () => {
        const g = new THREE.BufferGeometry();
        if (kernelEdges) {
          g.setAttribute("position", new THREE.BufferAttribute(kernelEdges.positions, 3));
          return g;
        }
        // The ring stack: creases by angle, plus the loops EdgesGeometry cannot
        // see because a fillet meets its flat face tangentially.
        const creases = new THREE.EdgesGeometry(geom, 24).getAttribute("position").array;
        const loops = panelEdgeLoops(panel, bevels, E);
        const merged = new Float32Array(creases.length + loops.length);
        merged.set(creases, 0);
        merged.set(loops, creases.length);
        g.setAttribute("position", new THREE.BufferAttribute(merged, 3));
        return g;
      };

      // §59 Selection accents the outline; hover no longer does. Accenting a
      // hovered panel's edges meant rebuilding every mesh in the box each time
      // the pointer crossed a face — and the lift on the face itself says the
      // same thing more quietly, which is what a hover should say.
      if (edgePasses(style, { accent: isSel }).length) {
        addEdges(state, root, edgeGeometry(), index, style, isSel);
      }
    });

    // §22 The drivers, one group each so the explode pass below can move them
    // with their panel without overwriting where on it they sit.
    if (drivers && showsFaces(style)) {
      const material = driverMaterial();
      for (const { fitting, panel } of driversOn(derived.fittings, derived.fittingPanels)) {
        const index = sol.panels.indexOf(panel);
        if (index < 0) continue;
        const group = new THREE.Group();
        group.userData.offsetOf = index;
        group.add(placeDriver(new THREE.Mesh(driverBody(fitting), material.clone()), fitting, panel, E));
        root.add(group);
      }
      material.dispose();
    }

    // Explode.
    const amount = explode;
    for (const child of root.children) {
      const i = child.userData.index ?? child.userData.offsetOf;
      if (i == null) continue;
      const [x, y, z] = explodeOffset(sol.panels[i], amount);
      child.position.set(x, y, z);
    }

    state.invalidate?.();
    // §59 The hover the pointer or the cut list had, put back on the panels the
    // rebuild has just replaced.
    state.paintHover?.();
  }, [derived, style, colourByFace, explode, selected, onSelect, solids, drivers]);

  /**
   * §59 Hover, on its own effect and without a rebuild.
   *
   * `hovered` comes from the cut list and `faceHover` from the pointer, and
   * both used to be in the panel-rebuilding effect's dependencies — so running
   * a mouse across the box, or down the cut list, remeshed every panel in it.
   */
  useEffect(() => {
    const state = gl.current;
    if (!state) return;
    state.hovered = hovered ?? null;
    state.paintHover?.();
    state.invalidate?.();
  }, [hovered]);

  // §59 Reported on its own too: what the pointer is over changes far more
  // often than what the box is.
  useEffect(() => { if (gl.current) gl.current.onHover = onHover; }, [onHover]);

  // §51 Swap the projection without touching anything else: the orbit, the
  // target and the scene are all where they were, so the box does not move —
  // only the rays change.
  useEffect(() => {
    const state = gl.current;
    if (!state || Boolean(state.camera.isOrthographicCamera) === Boolean(parallel)) return;
    state.camera = makeCamera(parallel, FOV);
    state.place?.();
    state.invalidate?.();
  }, [parallel]);

  // Fit the camera when the box size changes.
  const sizeKey = `${derived.sol.E.x}|${derived.sol.E.y}|${derived.sol.E.z}`;
  useEffect(() => {
    const state = gl.current;
    if (!state) return;
    const E = derived.sol.E;
    state.radius = sceneRadius(E);
    state.sph.dist = 2.7 * Math.max(E.x, E.y, E.z);
    state.target.set(0, 0, 0);
    state.invalidate?.();
  }, [sizeKey]);

  // View presets, driven from the chips. The nonce lets the same preset re-fire.
  useEffect(() => {
    const state = gl.current;
    if (!state || !camera?.preset) return;
    const [az, pol] = VIEW_PRESETS[camera.preset] ?? VIEW_PRESETS.iso;
    const E = derived.sol.E;
    state.sph.az = az;
    state.sph.pol = Math.min(POLAR_MAX, Math.max(POLAR_MIN, pol));
    state.sph.dist = 2.7 * Math.max(E.x, E.y, E.z);
    state.target.set(0, 0, 0);
    state.invalidate?.();
  }, [camera?.preset, camera?.nonce]);

  // §58 The right-click callback, kept current on its own: the menu it opens
  // closes and reopens far more often than the box changes.
  useEffect(() => { if (gl.current) gl.current.onContext = onContext; }, [onContext]);

  // Re-render when the viewport comes back from hidden.
  useEffect(() => { if (!hidden) gl.current?.invalidate?.(); }, [hidden]);

  return <div className="viewport" ref={host} />;
}
