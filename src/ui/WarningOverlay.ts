import { t } from '../utils/i18n';

const OVERLAY_CLASS = 'epileprev-overlay';
const STYLE_ID = 'epileprev-style';

// Sizes scale with --m (the element's smaller dimension, set from JS) but stay
// bounded by clamp(), so the overlay reads well from thumbnails to full screen
const CSS = `
.${OVERLAY_CLASS} {
  --m: 200px;
  position: fixed;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(4px, calc(var(--m) * 0.03), 14px);
  box-sizing: border-box;
  padding: clamp(6px, calc(var(--m) * 0.05), 20px);
  text-align: center;
  color: #fff;
  background: #0b0b0f;
  border: 2px solid #ffb020;
  border-radius: 6px;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  overflow: hidden;
  animation: epileprev-fade 120ms ease-out;
}
@keyframes epileprev-fade { from { opacity: 0; } to { opacity: 1; } }
.${OVERLAY_CLASS}__icon { font-size: clamp(20px, calc(var(--m) * 0.22), 72px); line-height: 1; color: #ffb020; }
.${OVERLAY_CLASS}__title { font-size: clamp(13px, calc(var(--m) * 0.07), 24px); font-weight: 700; }
.${OVERLAY_CLASS}__text { font-size: clamp(11px, calc(var(--m) * 0.045), 16px); max-width: 95%; opacity: 0.85; }
.${OVERLAY_CLASS}__hint { font-size: clamp(9px, calc(var(--m) * 0.035), 13px); max-width: 95%; opacity: 0.6; font-style: italic; }
.${OVERLAY_CLASS}__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: clamp(4px, calc(var(--m) * 0.03), 12px);
  margin-top: 4px;
}
.${OVERLAY_CLASS}__btn {
  padding: clamp(4px, calc(var(--m) * 0.02), 8px) clamp(8px, calc(var(--m) * 0.05), 18px);
  font-size: clamp(12px, calc(var(--m) * 0.04), 15px);
  font-family: inherit;
  color: #0b0b0f;
  background: #ffb020;
  border: 0;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
}
.${OVERLAY_CLASS}__btn:hover { background: #ffc24d; }
.${OVERLAY_CLASS}__btn--emergency {
  color: #ff6b6b;
  background: transparent;
  border: 1px solid #ff6b6b;
}
.${OVERLAY_CLASS}__btn--emergency:hover { color: #fff; background: #ff5252; border-color: #ff5252; }
.${OVERLAY_CLASS}--compact { gap: 4px; }
.${OVERLAY_CLASS}--compact .${OVERLAY_CLASS}__text,
.${OVERLAY_CLASS}--compact .${OVERLAY_CLASS}__hint,
.${OVERLAY_CLASS}--compact .${OVERLAY_CLASS}__title,
.${OVERLAY_CLASS}--compact .${OVERLAY_CLASS}__actions { display: none; }
`;

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export class WarningOverlay {
  private readonly onReveal: () => void;
  // The DOM node is built lazily on first show: most monitored elements never
  // flash, so we avoid creating a detached <div> per monitor
  private el?: HTMLDivElement;
  private visible = false;

  constructor(onReveal: () => void) {
    this.onReveal = onReveal;
  }

  show(rect: Rect, zIndex: number): void {
    const el = this.build();
    if (!this.visible) {
      el.style.zIndex = String(zIndex);
      document.body.appendChild(el);
      this.visible = true;
    }
    this.position(rect);
  }

  position(rect: Rect): void {
    if (!this.visible || !this.el) {
      return;
    }
    const el = this.el;
    el.style.top = `${rect.top}px`;
    el.style.left = `${rect.left}px`;
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
    el.style.setProperty('--m', `${Math.min(rect.width, rect.height)}px`);
    // Too small for anything but the icon
    const compact = rect.width < 160 || rect.height < 120;
    el.classList.toggle(`${OVERLAY_CLASS}--compact`, compact);
  }

  hide(): void {
    if (this.visible && this.el) {
      this.el.remove();
      this.visible = false;
    }
  }

  get isVisible(): boolean {
    return this.visible;
  }

  private build(): HTMLDivElement {
    if (this.el) {
      return this.el;
    }
    ensureStyles();
    const el = document.createElement('div');
    el.className = OVERLAY_CLASS;
    el.setAttribute('role', 'alert');
    el.innerHTML = `
      <div class="${OVERLAY_CLASS}__icon" aria-hidden="true">&#9888;</div>
      <div class="${OVERLAY_CLASS}__title">${t('overlayTitle')}</div>
      <div class="${OVERLAY_CLASS}__text">${t('overlayText')}</div>
      <div class="${OVERLAY_CLASS}__hint">${t('overlayHint')}</div>
      <div class="${OVERLAY_CLASS}__actions">
        <a class="${OVERLAY_CLASS}__btn ${OVERLAY_CLASS}__btn--emergency" href="${t('firstAidUrl')}" target="_blank" rel="noopener noreferrer">${t('firstAidButton')}</a>
        <button type="button" class="${OVERLAY_CLASS}__btn">${t('showAnyway')}</button>
      </div>
    `;
    el.querySelector('button')!.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onReveal();
    });
    this.el = el;
    return el;
  }
}

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  (document.head ?? document.documentElement).appendChild(style);
}
