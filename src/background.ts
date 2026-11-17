import { STORAGE_KEY } from './config/constants';
import { loadSettings, parseSettings } from './settings';
import type { Settings } from './types';
import { t } from './utils/i18n';

// Background service worker. Interaction lives in the popup; here we just keep
// the toolbar badge in sync with the stored settings

async function setSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
}

function updateBadge(enabled: boolean): void {
  chrome.action.setBadgeText({ text: enabled ? t('badgeOn') : t('badgeOff') });
  chrome.action.setBadgeBackgroundColor({ color: enabled ? '#1aa260' : '#9aa0a6' });
}

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await loadSettings();
  await setSettings(settings); // persist defaults on first install
  updateBadge(settings.enabled);
});

chrome.runtime.onStartup.addListener(async () => {
  updateBadge((await loadSettings()).enabled);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    updateBadge(parseSettings(changes[STORAGE_KEY].newValue).enabled);
  }
});
