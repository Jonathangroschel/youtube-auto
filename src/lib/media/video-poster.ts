type CaptureAttemptOptions = {
  crossOrigin?: string;
  seekTimeSeconds: number;
  maxWidth: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const captureWithOptions = (
  url: string,
  options: CaptureAttemptOptions
): Promise<string | null> =>
  new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(null);
      return;
    }

    const video = document.createElement("video");
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, 5000);

    let settled = false;

    const finish = (value: string | null) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    };

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
    };

    const drawFrame = () => {
      try {
        const width = Math.max(
          1,
          Math.round(
            Math.min(options.maxWidth, video.videoWidth || options.maxWidth)
          )
        );
        const height = Math.max(
          1,
          Math.round((width / Math.max(1, video.videoWidth || width)) * (video.videoHeight || width))
        );
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          finish(null);
          return;
        }
        ctx.drawImage(video, 0, 0, width, height);
        finish(canvas.toDataURL("image/jpeg", 0.76));
      } catch {
        finish(null);
      }
    };

    const handleSeeked = () => {
      drawFrame();
    };

    const handleLoadedData = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const seekTarget = duration > 0
        ? clamp(options.seekTimeSeconds, 0, Math.max(0, duration - 0.01))
        : 0;
      if (seekTarget <= 0.01) {
        drawFrame();
        return;
      }
      try {
        video.currentTime = seekTarget;
      } catch {
        drawFrame();
      }
    };

    const handleError = () => {
      finish(null);
    };

    if (options.crossOrigin) {
      video.crossOrigin = options.crossOrigin;
    }
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.addEventListener("loadeddata", handleLoadedData, { once: true });
    video.addEventListener("seeked", handleSeeked, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.src = url;
    video.load();
  });

export const captureVideoPoster = async (
  url: string,
  options?: { seekTimeSeconds?: number; maxWidth?: number }
) => {
  const seekTimeSeconds =
    typeof options?.seekTimeSeconds === "number" && options.seekTimeSeconds >= 0
      ? options.seekTimeSeconds
      : 0.08;
  const maxWidth =
    typeof options?.maxWidth === "number" && options.maxWidth > 0
      ? options.maxWidth
      : 480;

  const firstAttempt = await captureWithOptions(url, {
    crossOrigin: "anonymous",
    seekTimeSeconds,
    maxWidth,
  });
  if (firstAttempt) {
    return firstAttempt;
  }
  return captureWithOptions(url, {
    seekTimeSeconds,
    maxWidth,
  });
};
