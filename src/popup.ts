import { DEFAULT_SETTINGS, STORAGE_KEY } from './config/constants';
import { Sensitivity, Settings } from './types';
import { t } from './utils/i18n';

// Slider stop 0 is "off"; stops 1..3 map to these sensitivities
const ORDER: Sensitivity[] = ['low', 'medium', 'high'];
const LABEL_KEYS = ['levelOff', 'levelLow', 'levelMedium', 'levelHigh'];

async function load(): Promise<Settings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEY] ?? {}) };
}

function toIndex(s: Settings): number {
  return s.enabled ? ORDER.indexOf(s.sensitivity) + 1 : 0;
}

// Off keeps the previous sensitivity so re-enabling restores the same level
function toSettings(index: number, prev: Settings): Settings {
  return index === 0
    ? { ...prev, enabled: false }
    : { enabled: true, sensitivity: ORDER[index - 1] };
}

async function main(): Promise<void> {
  document.getElementById('subtitle')!.textContent = t('appSubtitle');
  document.getElementById('heading')!.textContent = t('popupHeading');
  const stops = Array.from(document.querySelectorAll<HTMLElement>('.stop'));
  const labels = Array.from(document.querySelectorAll<HTMLElement>('.labels span'));
  labels.forEach((el, i) => (el.textContent = t(LABEL_KEYS[i])));

  const fill = document.getElementById('fill')!;
  let settings = await load();

  const reflect = (index: number): void => {
    fill.style.width = `${index * 25}%`;
    stops.forEach((el, i) => {
      el.classList.toggle('filled', i <= index);
      el.classList.toggle('active', i === index);
    });
    labels.forEach((el, i) => el.classList.toggle('active', i === index));
    document.body.classList.toggle('disabled', index === 0);
  };
  reflect(toIndex(settings));

  const select = async (index: number): Promise<void> => {
    settings = toSettings(index, settings);
    reflect(index);
    await chrome.storage.local.set({ [STORAGE_KEY]: settings });
  };

  stops.forEach((el, i) => el.addEventListener('click', () => select(i)));
  labels.forEach((el, i) => el.addEventListener('click', () => select(i)));
}

main();
