import { MIN_ELEMENT_SIZE } from '../config/constants';

export type MediaElement = HTMLVideoElement | HTMLImageElement;

export function findMediaElements(root: ParentNode = document): MediaElement[] {
  return Array.from(root.querySelectorAll<MediaElement>('video, img'));
}

// Right type and large enough to be worth analysing
export function isMonitorable(el: Element): el is MediaElement {
  if (el instanceof HTMLImageElement) {
    if (!isAnimatedImage(el)) {
      return false;
    }
  } else if (!(el instanceof HTMLVideoElement)) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width >= MIN_ELEMENT_SIZE && rect.height >= MIN_ELEMENT_SIZE;
}

// Only animated images can flash. We key off the GIF extension: photos,
// thumbnails and map tiles are JPEG/PNG/(static) WebP and must not be sampled
function isAnimatedImage(el: HTMLImageElement): boolean {
  return /\.gif(\?|#|$)/i.test(el.currentSrc || el.src);
}

// z-index of the nearest ancestor that sets one (the element's stacking
// context), or 0. The overlay sits just above this, so it covers the element
// without masking higher-stacked site UI such as menus and dropdowns
export function contextZIndex(el: Element): number {
  let node: Element | null = el;
  while (node) {
    const z = parseInt(getComputedStyle(node).zIndex, 10);
    if (!Number.isNaN(z)) {
      return z;
    }
    node = node.parentElement;
  }
  return 0;
}

export function hasDecodableFrame(el: MediaElement): boolean {
  if (el instanceof HTMLVideoElement) {
    // readyState >= HAVE_CURRENT_DATA, and actually playing
    return el.readyState >= 2 && el.videoWidth > 0 && !el.paused && !el.ended;
  }
  return el.complete && el.naturalWidth > 0;
}
