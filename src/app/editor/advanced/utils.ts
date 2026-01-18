import type {
  ClipTransform,
  FloatingMenuState,
  LaneType,
  MediaAsset,
  MediaKind,
  TextClipSettings,
  TimelineClip,
  TimelineContextMenuState,
  VideoClipSettings,
} from "./types";

import {
  defaultFloatingMenuState,
  defaultTimelineContextMenuState,
  fallbackDuration,
  imageMaxDuration,
} from "./constants";

// Time formatting utilities
export const formatDuration = (seconds?: number) => {
  if (seconds == null || Number.isNaN(seconds)) {
    return "--:--";
  }
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
};

export const formatSpeedLabel = (speed: number) => {
  if (Number.isInteger(speed)) {
    return `${speed}`;
  }
  const trimmed = speed.toFixed(2).replace(/0$/, "");
  return trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
};

export const formatTimelineLabel = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remaining
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
};

export const formatTimeWithTenths = (seconds: number) => {
  const total = Math.max(0, seconds);
  const minutes = Math.floor(total / 60);
  const remaining = total - minutes * 60;
  const remainingText = remaining.toFixed(1).padStart(4, "0");
  return `${minutes.toString().padStart(2, "0")}:${remainingText}`;
};

export const parseTimeInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split(":").map((part) => part.trim());
  const numericParts = parts.map((part) => Number(part));
  if (numericParts.some((part) => Number.isNaN(part))) {
    return null;
  }
  if (numericParts.length === 1) {
    return Math.max(0, numericParts[0]);
  }
  if (numericParts.length === 2) {
    return Math.max(0, numericParts[0] * 60 + numericParts[1]);
  }
  if (numericParts.length === 3) {
    return Math.max(
      0,
      numericParts[0] * 3600 + numericParts[1] * 60 + numericParts[2]
    );
  }
  return null;
};

export const formatSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Math utilities
export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

// Default settings factories
export const createDefaultVideoSettings = (): VideoClipSettings => ({
  speed: 1,
  volume: 100,
  muted: false,
  fadeEnabled: false,
  fadeIn: 0.5,
  fadeOut: 0.5,
  roundCorners: false,
  cornerRadiusLinked: true,
  cornerRadius: 0,
  cornerRadii: {
    topLeft: 0,
    topRight: 0,
    bottomRight: 0,
    bottomLeft: 0,
  },
  opacity: 100,
  rotation: 0,
  flipH: false,
  flipV: false,
  brightness: 0,
  contrast: 0,
  exposure: 0,
  hue: 0,
  saturation: 0,
  sharpen: 0,
  noise: 0,
  blur: 0,
  vignette: 0,
});

export const cloneVideoSettings = (settings: VideoClipSettings): VideoClipSettings => ({
  ...settings,
  cornerRadii: { ...settings.cornerRadii },
});

export const createDefaultTextSettings = (): TextClipSettings => ({
  text: "Title",
  fontFamily: "Roboto",
  fontSize: 48,
  color: "#ffffff",
  bold: true,
  italic: false,
  align: "center",
  letterSpacing: 0,
  lineHeight: 1.1,
  backgroundEnabled: false,
  backgroundColor: "#000000",
  backgroundStyle: "line-block-round",
  outlineEnabled: false,
  outlineColor: "#000000",
  outlineWidth: 3,
  shadowEnabled: false,
  shadowColor: "#000000",
  shadowBlur: 12,
  shadowOpacity: 30,
  boxScaleX: 1,
  boxScaleY: 1,
  wordHighlightEnabled: false,
  wordHighlightColor: "#FDE047",
  autoSize: true,
});

export const cloneTextSettings = (settings: TextClipSettings): TextClipSettings => ({
  ...settings,
});

// Transform utilities
export const createDefaultTransform = (
  assetAspectRatio: number | undefined,
  stageAspectRatio: number
): ClipTransform => {
  const resolvedStageRatio =
    Number.isFinite(stageAspectRatio) && stageAspectRatio > 0
      ? stageAspectRatio
      : 16 / 9;
  const resolvedAssetRatio =
    Number.isFinite(assetAspectRatio) && assetAspectRatio
      ? assetAspectRatio
      : resolvedStageRatio;
  let width = 1;
  let height = 1;
  if (resolvedAssetRatio > resolvedStageRatio) {
    height = resolvedStageRatio / resolvedAssetRatio;
  } else {
    width = resolvedAssetRatio / resolvedStageRatio;
  }
  return {
    x: (1 - width) / 2,
    y: (1 - height) / 2,
    width,
    height,
  };
};

export const createDefaultTextTransform = (stageAspectRatio: number): ClipTransform => {
  const width = 0.6;
  const height = stageAspectRatio > 1.4 ? 0.18 : 0.24;
  return {
    x: (1 - width) / 2,
    y: (1 - height) / 2,
    width,
    height,
  };
};

// Subtitle-specific transform: wider, taller, positioned at bottom of screen
// Ensures two-line subtitles render fully without manual resizing
export const createSubtitleTransform = (stageAspectRatio: number): ClipTransform => {
  // Wide enough for long sentences, positioned at bottom
  const width = 0.95;
  // Height sufficient for 3-4 lines of text at typical subtitle sizes
  // This ensures wrapped text always has room to display
  // Taller for portrait videos where text needs more vertical space
  const height = stageAspectRatio > 1.4 ? 0.30 : 0.40;
  // Position at bottom with small padding (3% from bottom)
  const bottomPadding = 0.03;
  return {
    x: (1 - width) / 2,
    y: 1 - height - bottomPadding,
    width,
    height,
  };
};

export const clampTransformToStage = (
  rect: ClipTransform,
  stage: { width: number; height: number },
  minSizePx: number,
  options?: {
    allowOverflow?: boolean;
    maxScale?: number;
    minVisiblePx?: number;
  }
) => {
  const minWidth = Math.min(0.9, minSizePx / stage.width);
  const minHeight = Math.min(0.9, minSizePx / stage.height);
  const allowOverflow = options?.allowOverflow ?? false;
  const maxScale = options?.maxScale ?? 1;
  const maxWidth = Math.max(minWidth, allowOverflow ? maxScale : 1);
  const maxHeight = Math.max(minHeight, allowOverflow ? maxScale : 1);
  const width = clamp(rect.width, minWidth, maxWidth);
  const height = clamp(rect.height, minHeight, maxHeight);
  if (!allowOverflow) {
    const x = clamp(rect.x, 0, 1 - width);
    const y = clamp(rect.y, 0, 1 - height);
    return {
      x,
      y,
      width,
      height,
    };
  }
  const minVisiblePx = options?.minVisiblePx ?? minSizePx;
  const minVisibleWidth = Math.min(width, minVisiblePx / stage.width);
  const minVisibleHeight = Math.min(height, minVisiblePx / stage.height);
  const minX = -width + minVisibleWidth;
  const maxX = 1 - minVisibleWidth;
  const minY = -height + minVisibleHeight;
  const maxY = 1 - minVisibleHeight;
  const x = clamp(rect.x, minX, maxX);
  const y = clamp(rect.y, minY, maxY);
  return {
    x,
    y,
    width,
    height,
  };
};

// Asset utilities
export const getAssetDurationSeconds = (asset?: MediaAsset | null) =>
  asset?.duration ?? fallbackDuration;

export const getAssetMaxDurationSeconds = (asset?: MediaAsset | null) =>
  asset?.kind === "image" || asset?.kind === "text"
    ? imageMaxDuration
    : getAssetDurationSeconds(asset);

export const getLaneType = (asset?: MediaAsset | null): LaneType => {
  if (asset?.kind === "audio") {
    return "audio";
  }
  if (asset?.kind === "text") {
    return "text";
  }
  return "video";
};

export const getLaneEndTime = (laneId: string, clips: TimelineClip[]) =>
  clips.reduce(
    (max, clip) =>
      clip.laneId === laneId
        ? Math.max(max, clip.startTime + clip.duration)
        : max,
    0
  );

export const getWaveformBars = (seed: string, count: number) => {
  const values: number[] = [];
  let accumulator = 0;
  for (let index = 0; index < seed.length; index += 1) {
    accumulator += seed.charCodeAt(index);
  }
  for (let i = 0; i < count; i += 1) {
    const value = Math.abs(Math.sin(accumulator + i * 1.7));
    values.push(0.2 + value * 0.8);
  }
  return values;
};

export const inferMediaKind = (file: File): MediaKind => {
  if (file.type.startsWith("video/")) {
    return "video";
  }
  if (file.type.startsWith("audio/")) {
    return "audio";
  }
  if (file.type.startsWith("image/")) {
    return "image";
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["mp3", "wav", "m4a", "aac"].includes(extension)) {
    return "audio";
  }
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(extension)) {
    return "image";
  }
  return "video";
};

// Floating menu utilities
export const closeFloatingMenuState = (
  menu: FloatingMenuState
): FloatingMenuState =>
  menu.open
    ? {
        ...menu,
        open: false,
        showMore: false,
        showOrder: false,
        showVolume: false,
        showSpeed: false,
        showOpacity: false,
        showCorners: false,
        showTiming: false,
        clipId: null,
      }
    : menu;

export const createFloatingMenuState = (
  clipId: string,
  x: number,
  y: number
): FloatingMenuState => ({
  ...defaultFloatingMenuState,
  open: true,
  x,
  y,
  clipId,
});

// Timeline context menu utilities
export const closeTimelineContextMenuState = (
  menu: TimelineContextMenuState
): TimelineContextMenuState =>
  menu.open
    ? {
        ...menu,
        open: false,
        showReplaceMedia: false,
        showAudio: false,
        clipId: null,
      }
    : menu;

export const createTimelineContextMenuState = (
  clipId: string,
  x: number,
  y: number
): TimelineContextMenuState => ({
  ...defaultTimelineContextMenuState,
  open: true,
  x,
  y,
  clipId,
});
