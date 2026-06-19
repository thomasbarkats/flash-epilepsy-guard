import { DetectorConfig, Sensitivity, Settings } from '../types';

export const LOG_TITLE = "Epilep'rev";

// Temporary: logs monitor/taint/trigger events to the console for diagnosis
export const DEBUG = false;

// Per-element grace period when sampling starts: load/layout transients (tiles,
// fade-ins, reflow) briefly look like synchronized flashing, so we prime state
// but suppress detection during this window
export const WARMUP_MS = 600;

export const STORAGE_KEY = 'epileprev:settings';

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  sensitivity: 'medium',
};

// Smaller elements (CSS px, either side) are ignored: low risk, wasted CPU.
// Kept low enough to still cover video thumbnails that play on hover
export const MIN_ELEMENT_SIZE = 64;

// Hysteresis: keep the overlay up this long after flashing stops, so it does
// not flicker on brief lulls
export const OVERLAY_COOLDOWN_MS = 1500;

// An <img> unchanged for this long is treated as static (not a GIF) and dropped
export const STATIC_IMAGE_TIMEOUT_MS = 4000;

// Safety-net rescan period, to catch elements shown/resized without a DOM
// mutation (e.g. YouTube's hover-preview player, hidden then sized on hover)
export const RESCAN_INTERVAL_MS = 500;

// A single flash edge may span a couple of sampled frames; transitions are
// accumulated over this window before deciding whether they were synchronized
export const EDGE_WINDOW_MS = 60;

// WCAG general flash threshold: >=10% relative luminance change with the darker
// image below 0.80, >3 times/s, over >=25% of the area. We require those cells
// to flip *in sync* (the edgesForFlash count: 6 edges = 3 flashes/s), which is
// what separates real flashing from incoherent motion (e.g. moving objects)
const BASE_CONFIG: DetectorConfig = {
  gridSize: 20,
  luminanceThreshold: 0.1,
  darkLuminanceMax: 0.8,
  windowMs: 1000,
  syncAreaRatio: 0.22,
  edgesForFlash: 6,
  redEdgesForFlash: 6,
};

// "high" reacts to weaker/smaller/slower flashing (more protective, more false
// positives); "low" only triggers on strong, large, fast flashing
export const DETECTOR_CONFIGS: Record<Sensitivity, DetectorConfig> = {
  low: {
    ...BASE_CONFIG,
    luminanceThreshold: 0.15,
    syncAreaRatio: 0.3,
    edgesForFlash: 8,
    redEdgesForFlash: 8,
  },
  medium: {
    ...BASE_CONFIG,
  },
  high: {
    ...BASE_CONFIG,
    luminanceThreshold: 0.08,
    syncAreaRatio: 0.15,
    edgesForFlash: 4,
    redEdgesForFlash: 4,
  },
};
