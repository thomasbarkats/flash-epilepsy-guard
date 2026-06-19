// Reads from _locales/<browser-lang>/messages.json, falling back to en.
// Guarded: throws "context invalidated" if the extension was reloaded
export function t(key: string, substitutions?: string | string[]): string {
  try {
    return chrome.i18n.getMessage(key, substitutions);
  } catch {
    return '';
  }
}
