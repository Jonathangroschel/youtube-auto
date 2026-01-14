import type { MediaKind } from "../types";

export type MediaMetadata = {
  duration?: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
};

export const getMediaMeta = (kind: MediaKind, url: string) =>
  new Promise<MediaMetadata>((resolve) => {
    if (kind === "text") {
      resolve({});
      return;
    }
    if (kind === "image") {
      const image = new Image();
      image.onload = () => {
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        resolve({
          width,
          height,
          aspectRatio: width && height ? width / height : undefined,
        });
      };
      image.onerror = () => resolve({});
      image.src = url;
      return;
    }
    const element = document.createElement(
      kind === "video" ? "video" : "audio"
    );
    element.preload = "metadata";
    let resolved = false;
    const finalize = (payload: MediaMetadata) => {
      if (resolved) {
        return;
      }
      resolved = true;
      element.onloadedmetadata = null;
      element.onerror = null;
      element.onabort = null;
      resolve(payload);
    };
    const timeoutId = window.setTimeout(() => {
      finalize({});
    }, 8000);
    element.onloadedmetadata = () => {
      window.clearTimeout(timeoutId);
      if (kind === "video") {
        const video = element as HTMLVideoElement;
        const width = video.videoWidth;
        const height = video.videoHeight;
        finalize({
          duration: element.duration,
          width,
          height,
          aspectRatio: width && height ? width / height : undefined,
        });
        return;
      }
      finalize({ duration: element.duration });
    };
    element.onerror = () => {
      window.clearTimeout(timeoutId);
      finalize({});
    };
    element.onabort = () => {
      window.clearTimeout(timeoutId);
      finalize({});
    };
    element.src = url;
    element.load();
  });
