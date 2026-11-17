import { DEFAULT_SETTINGS, STORAGE_KEY } from './config/constants';
import type { Sensitivity, Settings } from './types';

const SENSITIVITIES: readonly Sensitivity[] = ['low', 'medium', 'high'];

function isSensitivity(value: unknown): value is Sensitivity {
  return typeof value === 'string' && SENSITIVITIES.includes(value as Sensitivity);
}

// chrome.storage is user-controlled persistence. Validate it before it reaches
// the rest of the extension so settings always retain their declared shape.
export function parseSettings(value: unknown): Settings {
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_SETTINGS;
  }
  const candidate = value as Record<string, unknown>;
  return {
    enabled: typeof candidate.enabled === 'boolean' ? candidate.enabled : DEFAULT_SETTINGS.enabled,
    sensitivity: isSensitivity(candidate.sensitivity) ? candidate.sensitivity : DEFAULT_SETTINGS.sensitivity,
  };
}

export async function loadSettings(): Promise<Settings> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return parseSettings(stored[STORAGE_KEY]);
  } catch {
    return DEFAULT_SETTINGS;
  }
}
