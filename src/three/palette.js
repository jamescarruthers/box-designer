// §4 Colour modes. Hue is the axis, light against dark is which end.

export const FACE_COLOUR = {
  left: "#74c47c", right: "#2f8a52",     // x, green
  front: "#5fadd8", back: "#2c6c91",     // y, blue
  top: "#ac8bd8", bottom: "#6c4fa2",     // z, violet
};

export const LAYER_LIGHTNESS = { cladding: [0.02, 0.09], shell: [0, 0], doubler: [-0.05, -0.13], lagging: [-0.1, -0.2] };

export const SELECT_EMISSIVE = 0x5f2110;
export const ACCENT = "#e8703a";

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
  const [h, s, l] = hexToHsl(FACE_COLOUR[panel.face]);
  const shifts = LAYER_LIGHTNESS[panel.layer] ?? [0, 0];
  // The lighter end of each axis takes the smaller shift.
  const lighter = ["left", "front", "top"].includes(panel.face);
  return hslToHex(h, s, l + (lighter ? shifts[0] : shifts[1]));
}

export function swatch(panel, colourByFace, materialColour) {
  return colourByFace ? panelColour(panel) : materialColour;
}
