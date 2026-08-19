// §6.6 True isometric projection, eye front-right-above, each axis
// foreshortened to √(2/3) — not the stretched isometric-drawing convention.

export const ISO_X = Math.SQRT1_2, ISO_Y = Math.sqrt(1 / 6), ISO_Z = Math.sqrt(2 / 3);

export const isoProject = (v) => ({
  x: ISO_X * (v.x + v.y),
  y: ISO_Y * (v.x - v.y) - ISO_Z * v.z,
});

const r6 = (n) => Math.round(n * 1e6) / 1e6;

/**
 * Build from the three visible planes — front y = 0, right x = E.x, top z = E.z.
 * Every panel meeting one of those planes contributes the boundary of its
 * cross-section there, which gives the real joint pattern rather than a bare box.
 */
export function buildIsometric(sol) {
  const { E, panels } = sol;
  const planes = [
    { free: ["x", "z"], fixed: "y", at: 0, test: (b) => b.y[0] === 0 },
    { free: ["y", "z"], fixed: "x", at: E.x, test: (b) => b.x[1] === E.x },
    { free: ["x", "y"], fixed: "z", at: E.z, test: (b) => b.z[1] === E.z },
  ];

  const seen = new Map();
  for (const pl of planes) {
    for (const p of panels) {
      if (!pl.test(p.box)) continue;
      const [a, b] = pl.free;
      const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([ia, ib]) => {
        const v = { [pl.fixed]: pl.at, [a]: p.box[a][ia], [b]: p.box[b][ib] };
        return { x: v.x, y: v.y, z: v.z };
      });
      for (let i = 0; i < 4; i++) addEdge(seen, corners[i], corners[(i + 1) % 4]);
    }
  }

  const segs = [...seen.values()].map(({ u, v }) => ({ a: isoProject(u), b: isoProject(v) }));
  const xs = segs.flatMap((s) => [s.a.x, s.b.x]);
  const ys = segs.flatMap((s) => [s.a.y, s.b.y]);
  const min = { x: Math.min(...xs), y: Math.min(...ys) };
  const ext = { h: Math.max(...xs) - min.x, v: Math.max(...ys) - min.y };

  return {
    view: "iso", ext, arcs: [], hatches: [],
    lines: segs.map((s) => ({
      a: [s.a.x - min.x, s.a.y - min.y],
      b: [s.b.x - min.x, s.b.y - min.y],
      visible: true, kind: "iso",
    })),
  };
}

function addEdge(seen, u, v) {
  const ku = `${r6(u.x)},${r6(u.y)},${r6(u.z)}`;
  const kv = `${r6(v.x)},${r6(v.y)},${r6(v.z)}`;
  if (ku === kv) return;
  const key = ku < kv ? `${ku}|${kv}` : `${kv}|${ku}`;
  if (!seen.has(key)) seen.set(key, { u, v });
}
