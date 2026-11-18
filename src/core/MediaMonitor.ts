import { DEBUG, LOG_TITLE, OVERLAY_COOLDOWN_MS, STATIC_IMAGE_TIMEOUT_MS, WARMUP_MS } from '../config/constants';
import { FrameSampler } from './FrameSampler';
import { FlashDetector } from './FlashDetector';
import { hasDecodableFrame } from '../utils/dom.utils';
import { WarningOverlay } from '../ui/WarningOverlay';
import type { MediaElement } from '../utils/dom.utils';
import type { Rect } from '../ui/WarningOverlay';
import type { DetectorConfig } from '../types';

// Owns the full detection pipeline for one media element: sampling, flash
// detection, and the warning overlay with its show/hide hysteresis
export class MediaMonitor {
  // YouTube may replace the <img> node between preview loops. Keep a bounded,
  // short-lived record outside a single monitor so a replacement cannot expose
  // an animation that has already been classified as dangerous.
  private static readonly latchedImageKeys = new Map<string, number>();
  private static readonly imageLatchTtlMs = 15_000;

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
  // User clicked "show anyway": suppress the overlay until flashing stops, or
  // until the current media is replaced.
  private revealed = false;
  // Animated images (including YouTube hover previews) commonly loop. Once one
  // is dangerous, a short quiet interval between loops must not reveal it again.
  // A shared, bounded latch preserves this state across DOM replacements.
  private dangerLatched = false;
  // For <img>: when we last saw any change, used to suspend static images
  private lastChangeAt = 0;
  private lastLumSnapshot = -1;
  private suspended = false;
  private imageSource = '';
  // When sampling started (reset when the element leaves the viewport), for warm-up
  private sampleStartedAt = 0;
  private taintLogged = false;
  private sampledLogged = false;
  // A video can be presented by the browser more often than it decodes a new
  // frame. Sampling the same media time twice cannot improve detection.
  private lastSampledVideoTime = Number.NaN;

  constructor(element: MediaElement, cfg: DetectorConfig) {
    this.element = element;
    this.cfg = cfg;
    this.sampler = new FrameSampler(cfg.gridSize);
    if (element instanceof HTMLImageElement) {
      this.imageSource = element.currentSrc || element.src;
      this.dangerLatched = MediaMonitor.hasLatchedImage(this.imageSource);
    }
    this.overlay = new WarningOverlay(() => {
      this.revealed = true;
      if (this.element instanceof HTMLImageElement) {
        MediaMonitor.clearImageLatch(this.element.currentSrc || this.element.src);
      }
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

    if (this.element instanceof HTMLImageElement && this.dangerLatched) {
      MediaMonitor.latchImage(this.element.currentSrc || this.element.src);
    }

    if (this.element instanceof HTMLVideoElement) {
      if (this.element.currentTime === this.lastSampledVideoTime) {
        this.updateOverlay(now);
        return;
      }
      this.lastSampledVideoTime = this.element.currentTime;
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
      if (this.element instanceof HTMLImageElement) {
        this.dangerLatched = true;
        MediaMonitor.latchImage(this.element.currentSrc || this.element.src);
      }
    } else if (now - this.lastFlashAt > OVERLAY_COOLDOWN_MS) {
      // Flashing has fully stopped; re-arm the overlay for next time
      if (!this.dangerLatched) {
        this.revealed = false;
      }
    }

    this.updateOverlay(now);
  }

  private updateOverlay(now: number): void {
    const active = !this.revealed && (
      this.dangerLatched || now - this.lastFlashAt <= OVERLAY_COOLDOWN_MS
    );
    if (active && this.visible) {
      this.overlay.show(this.rect());
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

  // A rescan detects source replacement even when no child-list mutation fired.
  refresh(): void {
    if (!(this.element instanceof HTMLImageElement)) {
      return;
    }
    const source = this.element.currentSrc || this.element.src;
    if (source === this.imageSource) {
      return;
    }
    this.imageSource = source;
    this.suspended = false;
    this.lastChangeAt = 0;
    this.lastLumSnapshot = -1;
    if (MediaMonitor.hasLatchedImage(source)) {
      this.dangerLatched = true;
      MediaMonitor.latchImage(source);
      // Do not expose a looping animation just because its image node or its
      // signed source URL was refreshed.
      return;
    }
    this.lastFlashAt = Number.NEGATIVE_INFINITY;
    this.dangerLatched = false;
    this.revealed = false;
    this.detector?.reset();
  }

  destroy(): void {
    this.overlay.hide();
  }

  private static latchImage(source: string): void {
    const key = imageKey(source);
    if (!key) {
      return;
    }
    MediaMonitor.pruneImageLatches();
    MediaMonitor.latchedImageKeys.set(key, performance.now());
  }

  private static hasLatchedImage(source: string): boolean {
    const key = imageKey(source);
    if (!key) {
      return false;
    }
    MediaMonitor.pruneImageLatches();
    if (!MediaMonitor.latchedImageKeys.has(key)) {
      return false;
    }
    // An active replacement keeps its record alive; abandoned entries expire.
    MediaMonitor.latchedImageKeys.set(key, performance.now());
    return true;
  }

  private static clearImageLatch(source: string): void {
    const key = imageKey(source);
    if (key) {
      MediaMonitor.latchedImageKeys.delete(key);
    }
  }

  private static pruneImageLatches(): void {
    const cutoff = performance.now() - MediaMonitor.imageLatchTtlMs;
    for (const [key, seenAt] of MediaMonitor.latchedImageKeys) {
      if (seenAt < cutoff) {
        MediaMonitor.latchedImageKeys.delete(key);
      }
    }
  }
}

function imageKey(source: string): string | undefined {
  try {
    const url = new URL(source, document.baseURI);
    if (url.hostname.endsWith('ytimg.com')) {
      const match = url.pathname.match(/\/an_webp\/([^/]+)\//);
      if (match) {
        return `youtube:${match[1]}`;
      }
    }
    // Query parameters often rotate while an animated image is replayed.
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}
