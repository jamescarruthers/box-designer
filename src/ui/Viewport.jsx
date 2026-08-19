// §4 The 3D view: panel solids, render styles, colour modes and a hand-rolled orbit.

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { panelPositions, explodeOffset, panelEdgeLoops } from "../three/panelGeometry.js";
import { panelBevels } from "../model/bevel.js";
import { panelColour, SELECT_EMISSIVE, ACCENT } from "../three/palette.js";

export const RENDER_STYLES = [
  { id: "shaded", name: "Shaded" },
  { id: "shaded-edges", name: "Shaded + hidden edges" },
  { id: "wireframe", name: "Wireframe" },
  { id: "wireframe-hlr", name: "Wireframe, hidden removed" },
];

// §4 View presets: [azimuth, polar].
export const VIEW_PRESETS = {
  iso: [-0.72, 1.08], front: [0, Math.PI / 2], top: [0, 0.08], right: [Math.PI / 2, Math.PI / 2],
};

const POLAR_MIN = 0.06, POLAR_MAX = Math.PI - 0.06;

export default function Viewport({ derived, style, colourByFace, explode, selected, onSelect, hovered, hidden, camera, solids }) {
  const host = useRef(null);
  const gl = useRef(null);

  // The renderer, scene and camera outlive every re-render, so the camera
  // survives a switch to another mode.
  useEffect(() => {
    const el = host.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x14181d, 1);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 1, 100000);
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

    const state = { renderer, scene, camera, target, sph, root, picks: [], raf: 0, needs: true };
    gl.current = state;

    const place = () => {
      const p = new THREE.Vector3(
        sph.dist * Math.sin(sph.pol) * Math.sin(sph.az),
        sph.dist * Math.cos(sph.pol),
        sph.dist * Math.sin(sph.pol) * Math.cos(sph.az));
      camera.position.copy(p.add(target));
      camera.lookAt(target);
    };
    state.place = place;

    const render = () => {
      state.raf = 0;
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;                     // skip while the viewport is hidden
      if (renderer.domElement.width !== w || renderer.domElement.height !== h) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      place();
      renderer.render(scene, camera);
    };
    state.render = render;
    const invalidate = () => { if (!state.raf) state.raf = requestAnimationFrame(render); };
    state.invalidate = invalidate;

    // --- hand-rolled orbit: drag to orbit, shift-drag to pan, wheel to zoom.
    let drag = null;
    const down = (e) => {
      drag = { x: e.clientX, y: e.clientY, pan: e.shiftKey, moved: 0 };
      el.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.pan) {
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
        const k = sph.dist * 0.0016;
        target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
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
    const pick = (e) => {
      const r = el.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObjects(state.picks, false)[0];
      state.onSelect?.(hit ? hit.object.userData.index : null);
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    const ro = new ResizeObserver(invalidate);
    ro.observe(el);

    return () => {
      ro.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      cancelAnimationFrame(state.raf);
      renderer.dispose();
      el.removeChild(renderer.domElement);
      gl.current = null;
    };
  }, []);

  // Rebuild the panels whenever the box, the styling or the selection changes.
  useEffect(() => {
    const state = gl.current;
    if (!state) return;
    state.onSelect = onSelect;
    const { root } = state;
    while (root.children.length) {
      const c = root.children.pop();
      c.geometry?.dispose?.();
      c.material?.dispose?.();
    }
    state.picks = [];

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
      const isSel = selected === index, isHov = hovered === index;

      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colour),
        flatShading: true,
        roughness: 0.82, metalness: 0.02,
        // Selection must not recolour the panel — that destroys what the
        // colouring is for. Lift the emissive instead.
        emissive: new THREE.Color(isSel ? SELECT_EMISSIVE : 0x000000),
        emissiveIntensity: isSel ? 1 : 0,
        transparent: style === "shaded-edges",
        opacity: style === "shaded-edges" ? 0.94 : 1,
        depthWrite: true,
      });

      const showFaces = style !== "wireframe";
      const mesh = new THREE.Mesh(geom, mat);
      mesh.userData.index = index;
      if (style === "wireframe-hlr") { mat.colorWrite = false; }
      mesh.visible = showFaces;
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
        tm.visible = showFaces;
        root.add(tm);
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

      if (style !== "shaded") {
        const eg = edgeGeometry();
        const lm = new THREE.LineBasicMaterial({
          color: new THREE.Color(isSel || isHov ? ACCENT : "#c6d2de"),
          depthTest: style === "wireframe-hlr",
          transparent: true,
          opacity: isSel || isHov ? 1 : 0.85,
        });
        const lines = new THREE.LineSegments(eg, lm);
        lines.renderOrder = 2;
        root.add(lines);
        lines.userData.offsetOf = index;
      } else if (isSel || isHov) {
        const eg = edgeGeometry();
        const lines = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: new THREE.Color(ACCENT), depthTest: false }));
        lines.renderOrder = 2;
        root.add(lines);
        lines.userData.offsetOf = index;
      }
    });

    // Explode.
    const amount = explode;
    for (const child of root.children) {
      const i = child.userData.index ?? child.userData.offsetOf;
      if (i == null) continue;
      const [x, y, z] = explodeOffset(sol.panels[i], amount);
      child.position.set(x, y, z);
    }

    state.invalidate?.();
  }, [derived, style, colourByFace, explode, selected, hovered, onSelect, solids]);

  // Fit the camera when the box size changes.
  const sizeKey = `${derived.sol.E.x}|${derived.sol.E.y}|${derived.sol.E.z}`;
  useEffect(() => {
    const state = gl.current;
    if (!state) return;
    const E = derived.sol.E;
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

  // Re-render when the viewport comes back from hidden.
  useEffect(() => { if (!hidden) gl.current?.invalidate?.(); }, [hidden]);

  return <div className="viewport" ref={host} />;
}
