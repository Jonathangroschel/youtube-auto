import type { CSSProperties } from "react";
import type { IGif } from "@giphy/js-types";

import type { TextClipSettings, TextPreviewLine, TimelineClip } from "./types";

import { frameStepSeconds, laneHeights } from "./constants";
import { clamp } from "./utils";

const parseHexColor = (value: string) => {
  const normalized = value.replace("#", "").trim();
  if (normalized.length === 3) {
    const [r, g, b] = normalized.split("");
    return {
      r: parseInt(`${r}${r}`, 16),
      g: parseInt(`${g}${g}`, 16),
      b: parseInt(`${b}${b}`, 16),
    };
  }
  if (normalized.length === 6) {
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16),
    };
  }
  return null;
};

const toRgba = (value: string, alpha: number) => {
  const rgb = parseHexColor(value);
  if (!rgb) {
    return value;
  }
  const clamped = Math.min(1, Math.max(0, alpha));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamped})`;
};

const timelineThumbnailTargetWidth = 28;
const timelineThumbnailMaxCount = 60;
const audioLaneMinHeight = 32;
const audioLaneMaxHeight = 200;
const audioWaveformMinBars = 24;
const audioWaveformMaxBars = 320;
const audioWaveformMinPeakCount = 200;
const audioWaveformMaxPeakCount = 4000;
const audioWaveformPeaksPerSecond = 60;
const audioWaveformMinBarHeight = 0.03;

const getThumbnailCountForWidth = (width: number) => {
  const normalizedWidth = Math.max(1, width);
  return Math.max(
    1,
    Math.min(
      timelineThumbnailMaxCount,
      Math.ceil(normalizedWidth / timelineThumbnailTargetWidth)
    )
  );
};

const normalizeTimelineTime = (value: number) =>
  Math.round(value * 1000) / 1000;

const timelineClipEpsilon = frameStepSeconds / 2;

const loadVideoForThumbnails = (url: string) =>
  new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement("video");
    const handleLoaded = () => {
      cleanup();
      resolve(video);
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Failed to load video thumbnails."));
    };
    const cleanup = () => {
      video.removeEventListener("loadeddata", handleLoaded);
      video.removeEventListener("error", handleError);
    };
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    video.addEventListener("loadeddata", handleLoaded, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.load();
  });

const seekVideoForThumbnail = (video: HTMLVideoElement, time: number) =>
  new Promise<void>((resolve, reject) => {
    if (!Number.isFinite(time)) {
      resolve();
      return;
    }
    const handleSeeked = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Failed to seek video thumbnail."));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
    };
    video.addEventListener("seeked", handleSeeked, { once: true });
    video.addEventListener("error", handleError, { once: true });
    if (Math.abs(video.currentTime - time) < 0.01) {
      cleanup();
      resolve();
      return;
    }
    video.currentTime = time;
  });

const getWaveformBarCount = (width: number) =>
  clamp(Math.round(width / 6), audioWaveformMinBars, audioWaveformMaxBars);

const getWaveformPeakCount = (duration: number) =>
  clamp(
    Math.floor(
      (Number.isFinite(duration) ? duration : 0) *
        audioWaveformPeaksPerSecond
    ),
    audioWaveformMinPeakCount,
    audioWaveformMaxPeakCount
  );

const normalizeWaveformPeak = (value: number) =>
  Math.min(1, Math.pow(value, 0.7));

const scheduleIdleWork = (cb: (deadline?: IdleDeadline) => void) => {
  if (
    typeof window !== "undefined" &&
    typeof window.requestIdleCallback === "function"
  ) {
    window.requestIdleCallback(cb, { timeout: 200 });
    return;
  }
  setTimeout(() => cb(undefined), 16);
};

const waitForIdle = () =>
  new Promise<void>((resolve) => {
    scheduleIdleWork(() => resolve());
  });

const buildAudioPeaksAsync = (
  buffer: AudioBuffer,
  peakCount: number,
  shouldCancel?: () => boolean
) =>
  new Promise<number[]>((resolve) => {
    if (peakCount <= 0 || buffer.length === 0) {
      resolve([]);
      return;
    }
    const peaks = new Array(peakCount).fill(0);
    const channelCount = buffer.numberOfChannels;
    const channelData = Array.from(
      { length: channelCount },
      (_, index) => buffer.getChannelData(index)
    );
    const samples = buffer.length;
    const samplesPerPeak = Math.max(1, Math.floor(samples / peakCount));
    let index = 0;
    const processChunk = (deadline?: IdleDeadline) => {
      if (shouldCancel?.()) {
        resolve([]);
        return;
      }
      const startTime = performance.now();
      while (index < peakCount) {
        if (shouldCancel?.()) {
          resolve([]);
          return;
        }
        if (deadline) {
          if (deadline.timeRemaining() < 3 && index > 0) {
            break;
          }
        } else if (performance.now() - startTime > 12 && index > 0) {
          break;
        }
        const start = index * samplesPerPeak;
        const end =
          index === peakCount - 1
            ? samples
            : Math.min(samples, start + samplesPerPeak);
        let max = 0;
        for (let channel = 0; channel < channelCount; channel += 1) {
          const data = channelData[channel];
          for (let j = start; j < end; j += 1) {
            const value = Math.abs(data[j]);
            if (value > max) {
              max = value;
            }
          }
        }
        peaks[index] = max;
        index += 1;
      }
      if (index < peakCount) {
        scheduleIdleWork(processChunk);
        return;
      }
      resolve(peaks);
    };
    scheduleIdleWork(processChunk);
  });

const generateVideoThumbnails = async (
  assetUrl: string,
  clip: TimelineClip,
  frameCount: number,
  shouldCancel: () => boolean
) => {
  if (frameCount <= 0) {
    return [];
  }
  const video = await loadVideoForThumbnails(assetUrl);
  const targetHeight = laneHeights.video;
  const aspectRatio =
    video.videoWidth && video.videoHeight
      ? video.videoWidth / video.videoHeight
      : 16 / 9;
  const targetWidth = Math.max(1, Math.round(targetHeight * aspectRatio));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return [];
  }
  const videoDuration = Number.isFinite(video.duration)
    ? video.duration
    : clip.startOffset + clip.duration;
  const clipStart = clip.startOffset;
  const clipEnd = Math.min(clip.startOffset + clip.duration, videoDuration);
  const span = Math.max(0.05, clipEnd - clipStart);
  const safeEnd = Math.max(clipStart, clipEnd - 0.05);
  const frames: string[] = [];
  for (let index = 0; index < frameCount; index += 1) {
    if (shouldCancel()) {
      return [];
    }
    const time = clamp(
      clipStart + (span * (index + 0.5)) / frameCount,
      clipStart,
      safeEnd
    );
    await seekVideoForThumbnail(video, time);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      frames.push(canvas.toDataURL("image/jpeg", 0.72));
    } catch (error) {
      frames.push("");
    }
  }
  video.src = "";
  video.load();
  return frames;
};

let textMeasureContext: CanvasRenderingContext2D | null = null;
const textStagePaddingX = 24; // Matches `px-3` padding on the stage text wrapper.
const systemFontFamilies = new Set(["Georgia", "Times New Roman", "Courier New"]);
const textResizeMinFontSize = 8;
const textResizeMaxFontSize = 240;
const stockMusicBucketName =
  process.env.NEXT_PUBLIC_STOCK_MUSIC_BUCKET ?? "stock-music";
const stockMusicRootPrefix =
  process.env.NEXT_PUBLIC_STOCK_MUSIC_ROOT?.replace(/^\/+|\/+$/g, "") ?? "";
const soundFxBucketName =
  process.env.NEXT_PUBLIC_SOUND_FX_BUCKET ?? stockMusicBucketName;
const soundFxRootPrefix =
  process.env.NEXT_PUBLIC_SOUND_FX_ROOT?.replace(/^\/+|\/+$/g, "") ??
  "sounds fx";
const stockVideoBucketName =
  process.env.NEXT_PUBLIC_STOCK_VIDEO_BUCKET ?? "video-stock-footage";
const stockVideoRootPrefix =
  process.env.NEXT_PUBLIC_STOCK_VIDEO_ROOT?.replace(/^\/+|\/+$/g, "") ?? "";
const stockVideoPosterRootPrefix =
  process.env.NEXT_PUBLIC_STOCK_VIDEO_POSTER_ROOT?.replace(/^\/+|\/+$/g, "") ??
  "";
const giphyApiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? "";
const audioFileExtensions = new Set([
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
  ".flac",
]);
const videoFileExtensions = new Set([
  ".mp4",
  ".mov",
  ".m4v",
  ".webm",
  ".avi",
]);

type AudioWaveformData = {
  key: string;
  peaks: number[];
  duration: number;
  status: "ready" | "error";
};

type StockAudioTrack = {
  id: string;
  name: string;
  category: string;
  url: string;
  path: string;
  size: number;
  duration?: number;
};

type StockVideoOrientation = "horizontal" | "vertical" | "square";

type StockVideoItem = {
  id: string;
  name: string;
  category: string;
  url: string;
  path: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
  orientation?: StockVideoOrientation;
  thumbnailUrl?: string | null;
};

type StockVideoOrientationFilter = "all" | "vertical" | "horizontal";


const isAudioFile = (name: string, mimeType?: string | null) => {
  if (mimeType?.startsWith("audio/")) {
    return true;
  }
  const lower = name.toLowerCase();
  for (const ext of audioFileExtensions) {
    if (lower.endsWith(ext)) {
      return true;
    }
  }
  return false;
};

const isVideoFile = (name: string, mimeType?: string | null) => {
  if (mimeType?.startsWith("video/")) {
    return true;
  }
  const lower = name.toLowerCase();
  for (const ext of videoFileExtensions) {
    if (lower.endsWith(ext)) {
      return true;
    }
  }
  return false;
};

const formatStockLabel = (value: string) => {
  const cleaned = value
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return value;
  }
  return cleaned.replace(/\b\w/g, (match) => match.toUpperCase());
};

const isOrientationLabel = (label: string) =>
  /^(vertical|horizontal|portrait|landscape)$/i.test(label.trim());

const resolveStockVideoOrientationFromPath = (path: string) => {
  const segments = path
    .split("/")
    .map((segment) => segment.toLowerCase())
    .filter(Boolean);
  for (const segment of segments) {
    if (segment.includes("vertical") || segment.includes("portrait")) {
      return "vertical" as const;
    }
    if (segment.includes("horizontal") || segment.includes("landscape")) {
      return "horizontal" as const;
    }
  }
  return null;
};

const resolveStockVideoOrientationFromMeta = (
  width?: number,
  height?: number
) => {
  if (!width || !height) {
    return null;
  }
  if (Math.abs(width - height) <= 2) {
    return "square" as const;
  }
  return width >= height ? ("horizontal" as const) : ("vertical" as const);
};

const resolveStockVideoCategory = (
  path: string,
  orientationHint?: StockVideoOrientation | null
) => {
  if (!path) {
    return "General";
  }
  const segments = path.split("/").filter(Boolean);
  let candidate = segments[segments.length - 1] ?? "";
  if (
    orientationHint &&
    candidate.toLowerCase().includes(orientationHint.toLowerCase())
  ) {
    candidate = segments[segments.length - 2] ?? candidate;
  }
  if (!candidate || isOrientationLabel(candidate)) {
    return "General";
  }
  return formatStockLabel(candidate);
};

const stockVideoPosterExtension =
  process.env.NEXT_PUBLIC_STOCK_VIDEO_POSTER_EXT ?? "jpg";

const resolveStockVideoPosterPath = (path: string) => {
  const normalized = path.replace(/\\/g, "/");
  let relativePath = normalized;
  if (stockVideoRootPrefix && normalized.startsWith(`${stockVideoRootPrefix}/`)) {
    relativePath = normalized.slice(stockVideoRootPrefix.length + 1);
  } else if (!stockVideoRootPrefix) {
    const markers = ["/vertical/", "/horizontal/"];
    const marker = markers.find((item) => normalized.includes(item));
    if (marker && !normalized.startsWith(marker.slice(1))) {
      const markerIndex = normalized.indexOf(marker);
      relativePath = normalized.slice(markerIndex + 1);
    }
  }
  const dotIndex = relativePath.lastIndexOf(".");
  if (dotIndex === -1) {
    return null;
  }
  const posterPath = `${relativePath.slice(0, dotIndex)}.${stockVideoPosterExtension}`;
  if (!stockVideoPosterRootPrefix) {
    return posterPath;
  }
  return `${stockVideoPosterRootPrefix}/${posterPath}`;
};

const parseGiphyNumber = (value?: string | number) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const resolveGiphyPreviewUrl = (gif: IGif) =>
  gif.images.preview_gif?.url ??
  gif.images.fixed_width?.url ??
  gif.images.downsized?.url ??
  gif.images.original?.url ??
  "";

const resolveGiphyAssetImage = (gif: IGif) => {
  const image =
    gif.images.original ??
    gif.images.downsized_medium ??
    gif.images.downsized ??
    gif.images.fixed_width ??
    gif.images.preview_gif;
  if (!image?.url) {
    return null;
  }
  return {
    url: image.url,
    width: parseGiphyNumber(image.width),
    height: parseGiphyNumber(image.height),
    size: parseGiphyNumber(image.size) ?? 0,
  };
};

const resolveFontFamily = (family: string | undefined) => {
  const trimmed = family?.trim();
  if (!trimmed) {
    return "sans-serif";
  }
  const escaped = trimmed.replace(/"/g, '\\"');
  const primary = /\s/.test(trimmed) ? `"${escaped}"` : escaped;
  return `${primary}, system-ui, sans-serif`;
};

const getPresetPreviewFontSize = (line: TextPreviewLine) => {
  const baseSize = line.size;
  const raw = line.text?.trim() ?? "";
  if (!raw) {
    return baseSize;
  }
  const condensed = raw.replace(/\s+/g, "");
  const length = condensed.length;
  if (length <= 10) {
    return baseSize;
  }
  let budget = 12;
  if (baseSize >= 24) {
    budget = 8;
  } else if (baseSize >= 20) {
    budget = 10;
  }
  const isAllCaps = raw === raw.toUpperCase();
  const trackingPenalty = line.className?.includes("tracking-") ? 0.9 : 1;
  const capPenalty = isAllCaps ? 0.92 : 1;
  const scale = clamp(
    (budget / length) * trackingPenalty * capPenalty,
    0.6,
    1
  );
  return Math.max(10, baseSize * scale);
};

const measureTextBounds = (settings: TextClipSettings) => {
  if (!textMeasureContext && typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    textMeasureContext = canvas.getContext("2d");
  }
  const context = textMeasureContext;
  const fontFamily = resolveFontFamily(settings.fontFamily);
  const fontWeight = settings.bold ? 700 : 400;
  const fontStyle = settings.italic ? "italic" : "normal";
  const fontSize = settings.fontSize || 16;
  const lineHeight = settings.lineHeight || 1.2;
  const letterSpacing = settings.letterSpacing || 0;
  const lines = settings.text?.split("\n") ?? [" "];
  if (context) {
    context.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  }
  let maxWidth = 0;
  lines.forEach((line) => {
    const content = line.length > 0 ? line : " ";
    const measured = context?.measureText(content).width ?? fontSize;
    const spacing = letterSpacing * Math.max(0, content.length - 1);
    maxWidth = Math.max(maxWidth, measured + spacing);
  });
  const height = Math.max(1, lines.length) * fontSize * lineHeight;
  const paddingX = settings.backgroundEnabled ? fontSize * 0.9 : 0;
  const paddingY = settings.backgroundEnabled ? fontSize * 0.3 : 0;
  const outline = settings.outlineEnabled ? settings.outlineWidth * 2 : 0;
  return {
    width: Math.max(1, maxWidth + paddingX + outline + textStagePaddingX),
    height: Math.max(1, height + paddingY + outline),
  };
};

const getTextRenderStyles = (settings: TextClipSettings) => {
  const shadowBlur = Number.isFinite(settings.shadowBlur)
    ? settings.shadowBlur
    : 0;
  const shadowOpacity = Number.isFinite(settings.shadowOpacity)
    ? settings.shadowOpacity
    : 30;
  const outlineWidth = Number.isFinite(settings.outlineWidth)
    ? settings.outlineWidth
    : 0;
  const backgroundMode = settings.backgroundStyle ?? "line-block-round";
  const fontWeight = settings.bold ? 700 : 400;
  const shadowEnabled =
    settings.shadowEnabled && shadowBlur > 0 && shadowOpacity > 0;
  const shadowOffset = Math.round(shadowBlur * 0.4);
  const shadowColor = toRgba(
    settings.shadowColor,
    shadowOpacity / 100
  );
  const textShadow = shadowEnabled
    ? `${shadowOffset}px ${shadowOffset}px ${shadowBlur}px ${shadowColor}`
    : "none";
  const resolvedOutlineWidth = settings.outlineEnabled ? outlineWidth : 0;
  const hasOutline = settings.outlineEnabled && resolvedOutlineWidth > 0;
  const isBackgroundEnabled = settings.backgroundEnabled;
  const isBlockBackground =
    backgroundMode === "block" || backgroundMode === "block-rounded";
  const isRoundedBackground =
    backgroundMode === "line-block-round" ||
    backgroundMode === "block-rounded";

  const backgroundStyles: CSSProperties = isBackgroundEnabled
    ? {
        backgroundColor: settings.backgroundColor,
        padding: "0.15em 0.45em",
        borderRadius: isRoundedBackground ? 10 : 0,
        display: isBlockBackground ? "inline-block" : "inline",
        maxWidth: "100%",
        ...(isBlockBackground
          ? {}
          : {
              boxDecorationBreak: "clone",
              WebkitBoxDecorationBreak: "clone",
            }),
      }
    : {};

  const textStyle: CSSProperties = {
    fontFamily: resolveFontFamily(settings.fontFamily),
    fontSize: settings.fontSize,
    fontWeight,
    fontStyle: settings.italic ? "italic" : "normal",
    lineHeight: settings.lineHeight,
    letterSpacing: settings.letterSpacing,
    color: settings.color,
    textShadow,
    textRendering: "geometricPrecision",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    ...(hasOutline
      ? {
          WebkitTextStrokeWidth: resolvedOutlineWidth,
          WebkitTextStrokeColor: settings.outlineColor,
        }
      : {}),
    ...backgroundStyles,
  };

  const containerStyle: CSSProperties = {
    textAlign: settings.align,
  };

  return { containerStyle, textStyle };
};


export {
  toRgba,
  audioLaneMinHeight,
  audioLaneMaxHeight,
  audioWaveformMinBarHeight,
  getThumbnailCountForWidth,
  normalizeTimelineTime,
  timelineClipEpsilon,
  getWaveformBarCount,
  getWaveformPeakCount,
  normalizeWaveformPeak,
  waitForIdle,
  buildAudioPeaksAsync,
  generateVideoThumbnails,
  systemFontFamilies,
  textResizeMinFontSize,
  textResizeMaxFontSize,
  stockMusicBucketName,
  stockMusicRootPrefix,
  soundFxBucketName,
  soundFxRootPrefix,
  stockVideoBucketName,
  stockVideoRootPrefix,
  giphyApiKey,
  isAudioFile,
  isVideoFile,
  formatStockLabel,
  isOrientationLabel,
  resolveStockVideoOrientationFromPath,
  resolveStockVideoOrientationFromMeta,
  resolveStockVideoCategory,
  resolveStockVideoPosterPath,
  resolveGiphyPreviewUrl,
  resolveGiphyAssetImage,
  resolveFontFamily,
  getPresetPreviewFontSize,
  measureTextBounds,
  getTextRenderStyles,
};

export type {
  AudioWaveformData,
  StockAudioTrack,
  StockVideoOrientation,
  StockVideoItem,
  StockVideoOrientationFilter,
};
