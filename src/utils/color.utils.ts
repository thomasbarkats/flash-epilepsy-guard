// Relative luminance (WCAG / Rec.709), normalised to 0..1

// sRGB -> linear lookup over the 0..255 byte range, to avoid a pow() per pixel
const SRGB_TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(r: number, g: number, b: number): number {
  return (
    0.2126 * SRGB_TO_LINEAR[r] +
    0.7152 * SRGB_TO_LINEAR[g] +
    0.0722 * SRGB_TO_LINEAR[b]
  );
}

// Saturated-red flashing is treated as especially hazardous by WCAG / Harding
export interface Chromaticity {
  saturatedRed: boolean;
  u: number;
  v: number;
}

// WCAG 2.2's working red-flash definition uses linear sRGB converted to CIE
// 1976 UCS: a saturated-red state has R / (R + G + B) >= 0.8.
export function chromaticity(r8: number, g8: number, b8: number): Chromaticity {
  const r = SRGB_TO_LINEAR[r8];
  const g = SRGB_TO_LINEAR[g8];
  const b = SRGB_TO_LINEAR[b8];
  const sum = r + g + b;
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
  const z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b;
  const denominator = x + 15 * y + 3 * z;
  return {
    saturatedRed: sum > 0 && r / sum >= 0.8,
    u: denominator > 0 ? (4 * x) / denominator : 0,
    v: denominator > 0 ? (9 * y) / denominator : 0,
  };
}
