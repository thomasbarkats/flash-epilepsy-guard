import { chromaticity, relativeLuminance } from '../utils/color.utils';
import type { MediaElement } from '../utils/dom.utils';

export interface SampledFrame {
  // Per cell, length gridSize*gridSize. red[i] is 1 for a saturated-red cell
  luminance: Float32Array;
  red: Uint8Array;
  chromaU: Float32Array;
  chromaV: Float32Array;
}

// Downsamples a media element to a grid canvas and reads back per-cell stats.
// drawImage downscaling box-filters each cell for free. A cross-origin/DRM
// source taints the canvas so getImageData throws; we detect that once and
// give up on the element rather than retry every frame.
// The canvas and buffers are allocated lazily on first sample, so monitors for
// off-screen elements (never sampled) stay cheap
export class FrameSampler {
  private readonly grid: number;
  private ctx?: CanvasRenderingContext2D;
  private luminance?: Float32Array;
  private red?: Uint8Array;
  private chromaU?: Float32Array;
  private chromaV?: Float32Array;
  private tainted = false;

  constructor(gridSize: number) {
    this.grid = gridSize;
  }

  get isUnreadable(): boolean {
    return this.tainted;
  }

  // Returns null on a tainted/failed read. The buffers are reused across calls
  sample(el: MediaElement): SampledFrame | null {
    if (this.tainted) {
      return null;
    }
    try {
      const ctx = this.context();
      ctx.drawImage(el, 0, 0, this.grid, this.grid);
      const { data } = ctx.getImageData(0, 0, this.grid, this.grid);
      const luminance = this.luminance!;
      const red = this.red!;
      const chromaU = this.chromaU!;
      const chromaV = this.chromaV!;
      for (let i = 0, p = 0; i < luminance.length; i++, p += 4) {
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        luminance[i] = relativeLuminance(r, g, b);
        const color = chromaticity(r, g, b);
        red[i] = color.saturatedRed ? 1 : 0;
        chromaU[i] = color.u;
        chromaV[i] = color.v;
      }
      return { luminance, red, chromaU, chromaV };
    } catch {
      // SecurityError from a tainted canvas
      this.tainted = true;
      return null;
    }
  }

  private context(): CanvasRenderingContext2D {
    if (this.ctx) {
      return this.ctx;
    }
    const canvas = document.createElement('canvas');
    canvas.width = this.grid;
    canvas.height = this.grid;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error("Epilep'rev: 2D canvas context unavailable");
    }
    this.luminance = new Float32Array(this.grid * this.grid);
    this.red = new Uint8Array(this.grid * this.grid);
    this.chromaU = new Float32Array(this.grid * this.grid);
    this.chromaV = new Float32Array(this.grid * this.grid);
    this.ctx = ctx;
    return ctx;
  }
}
