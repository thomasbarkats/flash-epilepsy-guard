import { DEBUG, DEFAULT_SETTINGS, DETECTOR_CONFIGS, LOG_TITLE, RESCAN_INTERVAL_MS, STORAGE_KEY } from './config/constants';
import { Settings } from './types';
import { MediaElement, findMediaElements, isMonitorable } from './utils/dom.utils';
import { MediaMonitor } from './core/MediaMonitor';

// Discovers media elements, tracks their visibility, and drives one shared
// animation-frame loop that ticks every monitor
class EpilepsyGuard {
  private settings: Settings = DEFAULT_SETTINGS;
  private readonly monitors = new Map<MediaElement, MediaMonitor>();
  private readonly loggedVideos = new WeakSet<Element>();

  private intersectionObserver!: IntersectionObserver;
  private mutationObserver!: MutationObserver;
  private rafId = 0;
  private running = false;
  private lastScanAt = 0;

  async init(): Promise<void> {
    this.settings = await loadSettings();
    this.watchSettings();

    this.intersectionObserver = new IntersectionObserver(
      (entries) => this.onIntersection(entries),
      { threshold: 0.01 },
    );
    this.mutationObserver = new MutationObserver(() => this.scheduleScan());
    this.mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    if (this.settings.enabled) {
      this.start();
    }
    const msg = `${LOG_TITLE}: active (sensitivity: ${this.settings.sensitivity}, enabled: ${this.settings.enabled})`;
    if (DEBUG) {
      console.log(msg);
    } else {
      console.debug(msg);
    }
  }

  private start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.scan();
    this.loop();
  }

  private stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    for (const monitor of this.monitors.values()) {
      monitor.destroy();
    }
    this.monitors.clear();
    this.intersectionObserver.disconnect();
  }

  private loop = (): void => {
    if (!this.running) {
      return;
    }
    // The extension was reloaded/removed: this content script is now orphaned,
    // so stop instead of throwing "context invalidated" on every chrome.* call
    if (!chrome.runtime?.id) {
      this.stop();
      return;
    }
    const now = performance.now();
    if (now - this.lastScanAt > RESCAN_INTERVAL_MS) {
      this.scan();
    }
    for (const monitor of this.monitors.values()) {
      if (monitor.isUnreadable) {
        this.remove(monitor.element);
        continue;
      }
      monitor.tick(now);
    }
    this.rafId = requestAnimationFrame(this.loop);
  };

  private scanScheduled = false;
  private scheduleScan(): void {
    if (this.scanScheduled || !this.running) {
      return;
    }
    this.scanScheduled = true;
    requestAnimationFrame(() => {
      this.scanScheduled = false;
      this.scan();
    });
  }

  private scan(): void {
    this.lastScanAt = performance.now();
    const present = new Set<MediaElement>();
    for (const el of findMediaElements()) {
      if (DEBUG && el instanceof HTMLVideoElement && !this.loggedVideos.has(el)) {
        this.loggedVideos.add(el);
        const r = el.getBoundingClientRect();
        console.log(
          `${LOG_TITLE}: found <video> ${Math.round(r.width)}x${Math.round(r.height)} ` +
          `monitorable=${isMonitorable(el)} paused=${el.paused} rs=${el.readyState} vw=${el.videoWidth}`,
        );
      }
      if (!isMonitorable(el)) {
        continue;
      }
      present.add(el);
      if (!this.monitors.has(el)) {
        this.add(el);
      }
    }
    // Drop monitors whose element left the DOM
    for (const el of this.monitors.keys()) {
      if (!el.isConnected || !present.has(el)) {
        this.remove(el);
      }
    }
  }

  private add(el: MediaElement): void {
    const cfg = DETECTOR_CONFIGS[this.settings.sensitivity];
    this.monitors.set(el, new MediaMonitor(el, cfg));
    this.intersectionObserver.observe(el);
  }

  private remove(el: MediaElement): void {
    const monitor = this.monitors.get(el);
    if (!monitor) {
      return;
    }
    monitor.destroy();
    this.intersectionObserver.unobserve(el);
    this.monitors.delete(el);
  }

  private onIntersection(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      const monitor = this.monitors.get(entry.target as MediaElement);
      if (monitor) {
        monitor.visible = entry.isIntersecting;
      }
    }
  }

  private watchSettings(): void {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[STORAGE_KEY]) {
        return;
      }
      const newValue = (changes[STORAGE_KEY].newValue ?? {}) as Partial<Settings>;
      const next: Settings = { ...DEFAULT_SETTINGS, ...newValue };
      const wasEnabled = this.settings.enabled;
      const sensitivityChanged = next.sensitivity !== this.settings.sensitivity;
      this.settings = next;

      if (!next.enabled) {
        this.stop();
      } else if (!wasEnabled) {
        this.start();
      } else if (sensitivityChanged) {
        // Rebuild monitors with the new detector config
        this.stop();
        this.start();
      }
    });
  }
}

async function loadSettings(): Promise<Settings> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEY] ?? {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const guard = new EpilepsyGuard();
guard.init().catch((err) => console.error(`${LOG_TITLE}: init failed`, err));
