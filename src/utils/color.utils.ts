// Relative luminance (WCAG / Rec.709), normalised to 0..1

// sRGB -> linear lookup over the 0..255 byte range, to avoid a pow() per pixel
const SRGB_TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR[i] = c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(r: number, g: number, b: number): number {
  return (
    0.2126 * SRGB_TO_LINEAR[r] +
    0.7152 * SRGB_TO_LINEAR[g] +
    0.0722 * SRGB_TO_LINEAR[b]
  );
}

// Saturated-red flashing is treated as especially hazardous by WCAG / Harding
export function isSaturatedRed(r: number, g: number, b: number): boolean {
  return r >= 128 && r - g >= 80 && r - b >= 80;
}
