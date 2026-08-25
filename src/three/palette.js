// §4 Colour modes. Hue is the axis, light against dark is which end.

export const FACE_COLOUR = {
  left: "#74c47c", right: "#2f8a52",     // x, green
  front: "#5fadd8", back: "#2c6c91",     // y, blue
  top: "#ac8bd8", bottom: "#6c4fa2",     // z, violet
};

export const LAYER_LIGHTNESS = { cladding: [0.02, 0.09], shell: [0, 0], doubler: [-0.05, -0.13], lagging: [-0.1, -0.2] };

/**
 * §35 The lining is not a shade of the face it lines.
 *
 * Every other layer is the face's own hue moved up or down in lightness, which
 * is right for boards: a clad front and the carcass behind it are the same
 * face at two depths, and reading them as one thing is the point. A lining is
 * not that. It is a different material doing a different job, and drawn as
 * "the front, darker" it was told from the front carcass only by how much
 * light happened to be falling on each.
 *
 * So it leaves the hue axis altogether: a warm grey, which is what felt and
 * wadding actually look like and which nothing else on the box is near — the
 * six face colours are all green, blue or violet at a fair saturation. The
 * face still shifts its lightness a little, so a lined left and a lined right
 * are not identical either.
 */
export const LAGGING_COLOUR = "#8d8377";

export const SELECT_EMISSIVE = 0x5f2110;
export const ACCENT = "#e8703a";

/**
 * §45 Rebates, wherever a part is drawn flat.
 *
 * A different colour from the cutouts on purpose: a cutout goes through the
 * board and a rebate does not, and on a template that is the one distinction
 * worth being able to make across the room. Cyan against the orange, which no
 * common colour blindness confuses with it.
 */
export const REBATE = "#3fb6c4";

export function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

const hue2rgb = (p, q, t) => {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
};

export function hslToHex(h, s, l) {
  l = Math.min(1, Math.max(0, l));
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
  }
  const to = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * The face colour, shifted in lightness by layer, so a clad front and the shell
 * behind it read as the same face at different depths.
 */
export function panelColour(panel) {
  // The lighter end of each axis takes the smaller shift.
  const lighter = ["left", "front", "top"].includes(panel.face);
  if (panel.layer === "lagging") {
    const [h, s, l] = hexToHsl(LAGGING_COLOUR);
    return hslToHex(h, s, l + (lighter ? 0.05 : -0.05));
  }
  const [h, s, l] = hexToHsl(FACE_COLOUR[panel.face]);
  const shifts = LAYER_LIGHTNESS[panel.layer] ?? [0, 0];
  return hslToHex(h, s, l + (lighter ? shifts[0] : shifts[1]));
}

export function swatch(panel, colourByFace, materialColour) {
  return colourByFace ? panelColour(panel) : materialColour;
}
