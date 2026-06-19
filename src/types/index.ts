export type Sensitivity = 'low' | 'medium' | 'high';

export interface Settings {
  enabled: boolean;
  sensitivity: Sensitivity;
}

export interface DetectorConfig {
  // The area is downsampled to a gridSize x gridSize grid of cells
  gridSize: number;
  // Min opposing change in relative luminance (0..1) for a cell to transition
  luminanceThreshold: number;
  // A transition only counts when the darker of the two frames is below this
  darkLuminanceMax: number;
  windowMs: number;
  // Fraction of cells (0..1) that must flip the same way at once to form an edge
  syncAreaRatio: number;
  // Synchronized edges within windowMs to flag flashing (2 edges = 1 flash)
  edgesForFlash: number;
  redEdgesForFlash: number;
}

export interface AnalysisResult {
  flashing: boolean;
  flashingCellRatio: number;
  // Danger is (also) driven by saturated-red flashing
  red: boolean;
}
