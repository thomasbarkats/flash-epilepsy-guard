import { DetectorConfig } from '../types';
import { DEBUG, LOG_TITLE, OVERLAY_COOLDOWN_MS, STATIC_IMAGE_TIMEOUT_MS, WARMUP_MS } from '../config/constants';
import { MediaElement, contextZIndex, hasDecodableFrame } from '../utils/dom.utils';
import { FrameSampler } from './FrameSampler';
import { FlashDetector } from './FlashDetector';
import { Rect, WarningOverlay } from '../ui/WarningOverlay';

// Owns the full detection pipeline for one media element: sampling, flash
// detection, and the warning overlay with its show/hide hysteresis
export class MediaMonitor {
  readonly element: MediaElement;
  private readonly cfg: DetectorConfig;
  private readonly sampler: FrameSampler;
  // Built on first sample, so off-screen monitors hold no per-cell state
  private detector?: FlashDetector;
  private readonly overlay: WarningOverlay;

  // Element is in the viewport (set by the owning IntersectionObserver)
  visible = false;

  // Timestamp of the last frame flagged as flashing; drives overlay cooldown.
  // -Infinity means "never", so the cooldown isn't satisfied at page start
  private lastFlashAt = Number.NEGATIVE_INFINITY;
  // User clicked "show anyway": suppress the overlay until flashing fully stops
  private revealed = false;
  // For <img>: when we last saw any change, used to suspend static images
  private lastChangeAt = 0;
  private lastLumSnapshot = -1;
  private suspended = false;
  // When sampling started (reset when the element leaves the viewport), for warm-up
  private sampleStartedAt = 0;
  private taintLogged = false;
  private sampledLogged = false;

  constructor(element: MediaElement, cfg: DetectorConfig) {
    this.element = element;
    this.cfg = cfg;
    this.sampler = new FrameSampler(cfg.gridSize);
    this.overlay = new WarningOverlay(() => {
      this.revealed = true;
      this.overlay.hide();
    });
  }

  get isUnreadable(): boolean {
    return this.sampler.isUnreadable;
  }

  // Called once per animation frame by the owning guard
  tick(now: number): void {
    if (!this.visible || this.suspended || !hasDecodableFrame(this.element)) {
      // Re-warm after the element was out of view, since off-screen content
      // may have changed without being sampled
      if (!this.visible) {
        this.sampleStartedAt = 0;
      }
      this.updateOverlay(now);
      return;
    }

    const frame = this.sampler.sample(this.element);
    if (!frame) {
      if (DEBUG && this.sampler.isUnreadable && !this.taintLogged) {
        this.taintLogged = true;
        console.log(`${LOG_TITLE}: unreadable (tainted)`, this.element);
      }
      // Tainted or transient failure; overlay logic still runs for cooldown
      this.updateOverlay(now);
      return;
    }

    if (DEBUG && !this.sampledLogged && this.element instanceof HTMLVideoElement) {
      this.sampledLogged = true;
      const r = this.element.getBoundingClientRect();
      console.log(`${LOG_TITLE}: video sampled ${Math.round(r.width)}x${Math.round(r.height)}`, this.element);
    }

    this.trackImageActivity(frame.luminance, now);

    if (!this.detector) {
      this.detector = new FlashDetector(this.cfg);
    }
    const result = this.detector.push(frame, now);

    if (this.sampleStartedAt === 0) {
      this.sampleStartedAt = now;
    }
    if (now - this.sampleStartedAt < WARMUP_MS) {
      // Prime per-cell state but drop load-time edges
      this.detector.reset();
      this.updateOverlay(now);
      return;
    }

    if (result.flashing) {
      if (DEBUG && now - this.lastFlashAt > OVERLAY_COOLDOWN_MS) {
        console.log(`${LOG_TITLE}: flash detected`, this.element, result);
      }
      this.lastFlashAt = now;
    } else if (now - this.lastFlashAt > OVERLAY_COOLDOWN_MS) {
      // Flashing has fully stopped; re-arm the overlay for next time
      this.revealed = false;
    }

    this.updateOverlay(now);
  }

  private updateOverlay(now: number): void {
    const active = !this.revealed && now - this.lastFlashAt <= OVERLAY_COOLDOWN_MS;
    if (active && this.visible) {
      // z-index only matters on first append; skip the recompute afterwards
      const z = this.overlay.isVisible ? 0 : contextZIndex(this.element) + 1;
      this.overlay.show(this.rect(), z);
    } else {
      this.overlay.hide();
    }
  }

  // Suspend monitoring of <img> that haven't changed for a while (static, not GIF)
  private trackImageActivity(luminance: Float32Array, now: number): void {
    if (!(this.element instanceof HTMLImageElement)) {
      return;
    }
    // Cheap whole-frame average as a change signal
    let sum = 0;
    for (let i = 0; i < luminance.length; i++) {
      sum += luminance[i];
    }
    const avg = sum / luminance.length;
    if (this.lastLumSnapshot < 0 || Math.abs(avg - this.lastLumSnapshot) > 0.002) {
      this.lastChangeAt = now;
      this.lastLumSnapshot = avg;
    } else if (now - this.lastChangeAt > STATIC_IMAGE_TIMEOUT_MS) {
      this.suspended = true;
    }
  }

  private rect(): Rect {
    const r = this.element.getBoundingClientRect();
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }

  // Reactivate a previously static <img> (e.g. its src changed)
  resume(): void {
    this.suspended = false;
    this.lastChangeAt = 0;
    this.lastLumSnapshot = -1;
  }

  destroy(): void {
    this.overlay.hide();
  }
}
