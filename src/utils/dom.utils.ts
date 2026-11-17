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

// Most images are static and must not be sampled. YouTube's desktop hover
// preview is an animated WebP at i.ytimg.com/an_webp/<video-id>/..., not a
// <video> or GIF. The activity tracker later suspends a false positive if the
// image does not actually change.
function isAnimatedImage(el: HTMLImageElement): boolean {
  const source = el.currentSrc || el.src;
  try {
    const url = new URL(source, document.baseURI);
    return /\.(?:gif|apng)$/i.test(url.pathname) ||
      (url.hostname.endsWith('ytimg.com') && /\/an_webp\//.test(url.pathname));
  } catch {
    return false;
  }
}

export function hasDecodableFrame(el: MediaElement): boolean {
  if (el instanceof HTMLVideoElement) {
    // readyState >= HAVE_CURRENT_DATA, and actually playing
    return el.readyState >= 2 && el.videoWidth > 0 && !el.paused && !el.ended;
  }
  return el.complete && el.naturalWidth > 0;
}
