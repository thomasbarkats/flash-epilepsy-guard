import { AnalysisResult, DetectorConfig } from '../types';
import { EDGE_WINDOW_MS } from '../config/constants';
import { SampledFrame } from './FrameSampler';

// Detects *coherent* flashing rather than mere busy-ness. A real seizure-risk
// flash makes a large area brighten and darken together, in rhythm; incoherent
// motion (e.g. moving objects, specular glints) makes cells change at different
// times and in different directions, which is what produced false positives.
//
// Per frame we tally cells that just completed an opposing luminance transition,
// split by direction. When enough of them flip the same way within a short
// window we record a synchronized "edge" (alternating up/down). Counting those
// edges over windowMs gives the flash rate; 2 edges = 1 flash.

// Tracks synchronized edges for one signal (luminance, or saturated red)
interface EdgeTracker {
  // Same-direction transition mass accumulated over the current EDGE_WINDOW_MS
  up: number;
  down: number;
  accStart: number;
  // Direction (+1/-1/0) of the last recorded edge, to enforce alternation
  lastEdgeDir: number;
  edgeTimes: number[];
}

function newEdgeTracker(): EdgeTracker {
  return { up: 0, down: 0, accStart: 0, lastEdgeDir: 0, edgeTimes: [] };
}

export class FlashDetector {
  private readonly cfg: DetectorConfig;
  private readonly cellCount: number;
  // Cells that must flip the same way at once to count as one synchronized edge
  private readonly syncThreshold: number;

  // Per-cell luminance state. lastDir is the direction of the last significant
  // change, so only opposing transitions (real reversals) are counted
  private readonly lastExtreme: Float32Array;
  private readonly lastDir: Int8Array;
  private readonly redState: Uint8Array;
  private readonly redInitialized: Uint8Array;
  private readonly redU: Float32Array;
  private readonly redV: Float32Array;

  private readonly lum = newEdgeTracker();
  private readonly red = newEdgeTracker();

  constructor(cfg: DetectorConfig) {
    this.cfg = cfg;
    this.cellCount = cfg.gridSize * cfg.gridSize;
    this.syncThreshold = Math.max(1, Math.round(cfg.syncAreaRatio * this.cellCount));
    this.lastExtreme = new Float32Array(this.cellCount).fill(-1);
    this.lastDir = new Int8Array(this.cellCount);
    this.redState = new Uint8Array(this.cellCount);
    this.redInitialized = new Uint8Array(this.cellCount);
    this.redU = new Float32Array(this.cellCount);
    this.redV = new Float32Array(this.cellCount);
  }

  // Drop accumulated edges (keeps per-cell state primed). Used after warm-up so
  // load-time transitions don't count
  reset(): void {
    for (const t of [this.lum, this.red]) {
      t.up = 0;
      t.down = 0;
      t.accStart = 0;
      t.lastEdgeDir = 0;
      t.edgeTimes.length = 0;
    }
  }

  push(frame: SampledFrame, now: number): AnalysisResult {
    const { luminanceThreshold, darkLuminanceMax, windowMs, edgesForFlash, redEdgesForFlash } = this.cfg;

    let lumUp = 0;
    let lumDown = 0;
    let redUp = 0;
    let redDown = 0;

    for (let i = 0; i < this.cellCount; i++) {
      const lum = frame.luminance[i];
      const extreme = this.lastExtreme[i];
      if (extreme < 0) {
        this.lastExtreme[i] = lum; // first sample for this cell
      } else {
        const diff = lum - extreme;
        if (Math.abs(diff) >= luminanceThreshold && Math.min(lum, extreme) <= darkLuminanceMax) {
          const dir = diff > 0 ? 1 : -1;
          // The first significant transition starts a potential flash train.
          // Subsequent edges must alternate direction, as required for flashes.
          if (this.lastDir[i] === 0 || dir !== this.lastDir[i]) {
            if (dir > 0) {
              lumUp++;
            } else {
              lumDown++;
            }
          }
          this.lastDir[i] = dir;
          this.lastExtreme[i] = lum;
        }
      }

      const red = frame.red[i];
      if (!this.redInitialized[i]) {
        this.redInitialized[i] = 1;
        this.redState[i] = red;
        this.redU[i] = frame.chromaU[i];
        this.redV[i] = frame.chromaV[i];
        continue;
      }
      const chromaDistance = Math.hypot(frame.chromaU[i] - this.redU[i], frame.chromaV[i] - this.redV[i]);
      if (red !== this.redState[i] && chromaDistance > 0.2) {
        if (red) {
          redUp++;
        } else {
          redDown++;
        }
        this.redState[i] = red;
        this.redU[i] = frame.chromaU[i];
        this.redV[i] = frame.chromaV[i];
      } else if (this.redState[i] === 0) {
        // Preserve the immediately preceding non-red state as the reference
        // for a later transition into saturated red.
        this.redU[i] = frame.chromaU[i];
        this.redV[i] = frame.chromaV[i];
      }
    }

    this.track(this.lum, lumUp, lumDown, now);
    this.track(this.red, redUp, redDown, now);

    const cutoff = now - windowMs;
    const lumFlash = prune(this.lum.edgeTimes, cutoff) >= edgesForFlash;
    const redFlash = prune(this.red.edgeTimes, cutoff) >= redEdgesForFlash;

    return {
      flashing: lumFlash || redFlash,
      flashingCellRatio: Math.max(lumUp, lumDown) / this.cellCount,
      red: redFlash,
    };
  }

  // Accumulate this frame's same-direction transitions and, once enough pile up
  // within EDGE_WINDOW_MS, record an alternating synchronized edge
  private track(t: EdgeTracker, up: number, down: number, now: number): void {
    if (now - t.accStart > EDGE_WINDOW_MS) {
      t.up = 0;
      t.down = 0;
      t.accStart = now;
    }
    t.up += up;
    t.down += down;

    if (t.up >= this.syncThreshold && t.lastEdgeDir !== 1) {
      this.recordEdge(t, 1, now);
    } else if (t.down >= this.syncThreshold && t.lastEdgeDir !== -1) {
      this.recordEdge(t, -1, now);
    }
  }

  private recordEdge(t: EdgeTracker, dir: number, now: number): void {
    t.edgeTimes.push(now);
    t.lastEdgeDir = dir;
    t.up = 0;
    t.down = 0;
    t.accStart = now;
  }
}

function prune(timestamps: number[], cutoff: number): number {
  let drop = 0;
  while (drop < timestamps.length && timestamps[drop] < cutoff) {
    drop++;
  }
  if (drop > 0) {
    timestamps.splice(0, drop);
  }
  return timestamps.length;
}
