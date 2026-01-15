"use client";

import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import { Magnet, ChevronsLeftRightEllipsis } from "lucide-react";

import type {
  AssetFilter,
  ClipboardData,
  ClipDragState,
  ClipTransform,
  EditorSnapshot,
  FloatingMenuState,
  KeyboardShortcutState,
  LaneType,
  MediaAsset,
  MediaKind,
  RangeSelectionState,
  SnapGuides,
  TextAlign,
  TextBackgroundStyle,
  TextClipSettings,
  TextPanelView,
  TextPreset,
  TextPresetGroup,
  TextPresetTag,
  TextPreviewLine,
  TextStylePreset,
  TimelineClip,
  TimelineContextMenuState,
  TimelineLane,
  TimelineLayoutEntry,
  TransformDragState,
  TransformHandle,
  TransformResizeState,
  TransformRotateState,
  TrimState,
  VideoClipSettings,
} from "./types";

import {
  defaultFloatingMenuState,
  defaultTextDuration,
  defaultTimelineContextMenuState,
  defaultTimelineHeight,
  floaterButtonClass,
  floaterMenuItemClass,
  floaterMenuWidth,
  floaterPanelWidth,
  floaterPillClass,
  floaterSubmenuWidth,
  floaterSurfaceClass,
  frameStepSeconds,
  laneGap,
  laneHeights,
  maxHistoryEntries,
  minCanvasHeight,
  minClipDuration,
  minLayerSize,
  panelButtonClass,
  panelCardClass,
  snapInterval,
  snapThresholdPx,
  speedPresets,
  timelineContextMenuWidth,
  timelineHandleHeight,
  timelinePadding,
  timelineScaleMax,
  timelineScaleMin,
  transformHandles,
} from "./constants";

import {
  clamp,
  clampTransformToStage,
  cloneTextSettings,
  cloneVideoSettings,
  closeFloatingMenuState,
  closeTimelineContextMenuState,
  createDefaultTextSettings,
  createDefaultTextTransform,
  createDefaultTransform,
  createDefaultVideoSettings,
  createFloatingMenuState,
  createTimelineContextMenuState,
  formatDuration,
  formatSize,
  formatSpeedLabel,
  formatTimelineLabel,
  formatTimeWithTenths,
  getAssetDurationSeconds,
  getAssetMaxDurationSeconds,
  getLaneEndTime,
  getLaneType,
  getWaveformBars,
  inferMediaKind,
  parseTimeInput,
} from "./utils";

import { getMediaMeta } from "./utils/media";

import {
  backgroundSwatches,
  mediaFilters,
  noiseDataUrl,
  textFontFamilies,
  textFontSizes,
  textLetterSpacingOptions,
  textLineHeightOptions,
  textPresetGroups,
  textPresetTags,
  textStylePresets,
  toolbarItems,
} from "./data";

import { SliderField } from "./components/slider-field";
import { ToggleSwitch } from "./components/toggle-switch";

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
const stockVideoBucketName =
  process.env.NEXT_PUBLIC_STOCK_VIDEO_BUCKET ?? "video-stock-footage";
const stockVideoRootPrefix =
  process.env.NEXT_PUBLIC_STOCK_VIDEO_ROOT?.replace(/^\/+|\/+$/g, "") ?? "";
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

type StockVideoCardProps = {
  video: StockVideoItem;
  durationLabel: string;
  priority?: boolean;
  onAdd: (video: StockVideoItem) => void;
  onPreviewStart: (id: string) => void;
  onPreviewStop: (id: string) => void;
  onRequestMeta?: (video: StockVideoItem) => void;
  registerPreviewRef: (id: string) => (node: HTMLVideoElement | null) => void;
};

const StockVideoCard = ({
  video,
  durationLabel,
  priority = false,
  onAdd,
  onPreviewStart,
  onPreviewStop,
  onRequestMeta,
  registerPreviewRef,
}: StockVideoCardProps) => {
  const [shouldLoad, setShouldLoad] = useState(priority);
  const [hasFrame, setHasFrame] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const cardRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (priority) {
      setShouldLoad(true);
      return;
    }
    if (shouldLoad) {
      return;
    }
    const target = cardRef.current;
    if (!target) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [priority, shouldLoad]);

  useEffect(() => {
    if (!isHovering || !shouldLoad) {
      return;
    }
    onPreviewStart(video.id);
    return () => onPreviewStop(video.id);
  }, [isHovering, onPreviewStart, onPreviewStop, shouldLoad, video.id]);

  const handleHoverStart = () => {
    setShouldLoad(true);
    setIsHovering(true);
    onRequestMeta?.(video);
  };

  const handleHoverEnd = () => {
    setIsHovering(false);
  };

  return (
    <div className="space-y-2">
      <button
        ref={cardRef}
        type="button"
        className="group relative h-24 w-full overflow-hidden rounded-2xl border border-gray-200"
        onClick={() => onAdd(video)}
        onMouseEnter={handleHoverStart}
        onMouseLeave={handleHoverEnd}
        onFocus={handleHoverStart}
        onBlur={handleHoverEnd}
        aria-label={`Add ${video.name}`}
      >
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">
            <svg viewBox="0 0 16 16" className="h-5 w-5" aria-hidden="true">
              <path
                d="M3 2.5h10a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Zm0 2.2v6.6a.6.6 0 0 0 .6.6h8.8a.6.6 0 0 0 .6-.6V4.7a.6.6 0 0 0-.6-.6H3.6a.6.6 0 0 0-.6.6Zm3.1 1.2 4.8 2.6-4.8 2.6V5.9Z"
                fill="currentColor"
              />
            </svg>
          </div>
        )}
        <video
          ref={registerPreviewRef(video.id)}
          src={shouldLoad ? video.url : undefined}
          poster={video.thumbnailUrl ?? undefined}
          className={`absolute inset-0 h-full w-full object-cover transition duration-200 ${hasFrame ? "opacity-100" : "opacity-0"
            }`}
          muted
          loop
          playsInline
          preload={shouldLoad ? "metadata" : "none"}
          onLoadedMetadata={(event) => {
            if (!shouldLoad) {
              return;
            }
            const target = event.currentTarget;
            if (!Number.isFinite(target.duration)) {
              return;
            }
            try {
              target.currentTime = Math.min(0.05, target.duration || 0);
            } catch (error) {}
          }}
          onLoadedData={() => setHasFrame(true)}
        />
        <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
          {durationLabel}
        </span>
      </button>
    </div>
  );
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

export default function AdvancedEditorPage() {
  const textMinLayerSize = 24;
  const textPresetPreviewCount = 6;
  const [activeTool, setActiveTool] = useState("video");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineClip[]>([]);
  const [lanes, setLanes] = useState<TimelineLane[]>([]);
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("All");
  const [isAssetLibraryExpanded, setIsAssetLibraryExpanded] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [stockCategory, setStockCategory] = useState("All");
  const [stockMusic, setStockMusic] = useState<StockAudioTrack[]>([]);
  const [stockMusicStatus, setStockMusicStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [stockMusicError, setStockMusicError] = useState<string | null>(null);
  const [stockMusicReloadKey, setStockMusicReloadKey] = useState(0);
  const [showAllStockTags, setShowAllStockTags] = useState(false);
  const [stockVideoSearch, setStockVideoSearch] = useState("");
  const [stockVideoCategory, setStockVideoCategory] = useState("All");
  const [stockVideoOrientation, setStockVideoOrientation] =
    useState<StockVideoOrientationFilter>("all");
  const [stockVideoItems, setStockVideoItems] = useState<StockVideoItem[]>([]);
  const [stockVideoStatus, setStockVideoStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [stockVideoError, setStockVideoError] = useState<string | null>(null);
  const [stockVideoReloadKey, setStockVideoReloadKey] = useState(0);
  const [showAllStockVideoTags, setShowAllStockVideoTags] = useState(false);
  const [isStockVideoExpanded, setIsStockVideoExpanded] = useState(false);
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [stageSelection, setStageSelection] =
    useState<RangeSelectionState | null>(null);
  const [uploading, setUploading] = useState(false);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [canvasBackground, setCanvasBackground] = useState("#f2f3fa");
  const [videoBackground, setVideoBackground] = useState("#000000");
  const [isBackgroundSelected, setIsBackgroundSelected] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState(
    defaultTimelineHeight
  );
  const [timelineScale, setTimelineScale] = useState(12);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isTimelineSnappingEnabled, setIsTimelineSnappingEnabled] =
    useState(true);
  const [timelineSnapGuide, setTimelineSnapGuide] = useState<number | null>(
    null
  );
  const [timelineCollisionGuide, setTimelineCollisionGuide] = useState<
    number | null
  >(null);
  const [timelineCollisionActive, setTimelineCollisionActive] =
    useState(false);
  const [timelineThumbnails, setTimelineThumbnails] = useState<
    Record<string, { key: string; frames: string[] }>
  >({});
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [clipOrder, setClipOrder] = useState<Record<string, number>>({});
  const [activeCanvasClipId, setActiveCanvasClipId] = useState<string | null>(
    null
  );
  const [floatingMenu, setFloatingMenu] = useState<FloatingMenuState>(
    defaultFloatingMenuState
  );
  const [timelineContextMenu, setTimelineContextMenu] = useState<TimelineContextMenuState>(
    defaultTimelineContextMenuState
  );
  const [clipTransforms, setClipTransforms] = useState<
    Record<string, ClipTransform>
  >({});
  const [snapGuides, setSnapGuides] = useState<SnapGuides | null>(null);
  const [historyState, setHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });
  const [backgroundTransforms, setBackgroundTransforms] = useState<
    Record<string, ClipTransform>
  >({});
  const [clipSettings, setClipSettings] = useState<
    Record<string, VideoClipSettings>
  >({});
  const [textSettings, setTextSettings] = useState<
    Record<string, TextClipSettings>
  >({});
  const [videoPanelView, setVideoPanelView] = useState<"edit" | "adjust">(
    "edit"
  );
  const defaultTextPanelSettings = createDefaultTextSettings();
  const [textPanelView, setTextPanelView] =
    useState<TextPanelView>("library");
  const [textPanelTag, setTextPanelTag] =
    useState<TextPresetTag>("All");
  const [expandedTextGroupId, setExpandedTextGroupId] = useState<string | null>(
    null
  );
  const [textPanelPreset, setTextPanelPreset] = useState<TextPreset | null>(
    null
  );
  const [textPanelDraft, setTextPanelDraft] = useState(
    defaultTextPanelSettings.text
  );
  const [textPanelFontFamily, setTextPanelFontFamily] = useState(
    defaultTextPanelSettings.fontFamily
  );
  const [textPanelFontSize, setTextPanelFontSize] = useState(
    defaultTextPanelSettings.fontSize
  );
  const [textPanelFontSizeDisplay, setTextPanelFontSizeDisplay] = useState(
    defaultTextPanelSettings.fontSize
  );
  const [textPanelColor, setTextPanelColor] = useState(
    defaultTextPanelSettings.color
  );
  const [textPanelBold, setTextPanelBold] = useState(
    defaultTextPanelSettings.bold
  );
  const [textPanelItalic, setTextPanelItalic] = useState(
    defaultTextPanelSettings.italic
  );
  const [textPanelAlign, setTextPanelAlign] = useState<TextAlign>(
    defaultTextPanelSettings.align
  );
  const [textPanelLetterSpacing, setTextPanelLetterSpacing] = useState(
    defaultTextPanelSettings.letterSpacing
  );
  const [textPanelLineHeight, setTextPanelLineHeight] = useState(
    defaultTextPanelSettings.lineHeight
  );
  const [textPanelBackgroundEnabled, setTextPanelBackgroundEnabled] = useState(
    defaultTextPanelSettings.backgroundEnabled
  );
  const [textPanelBackgroundColor, setTextPanelBackgroundColor] = useState(
    defaultTextPanelSettings.backgroundColor
  );
  const [textPanelBackgroundStyle, setTextPanelBackgroundStyle] =
    useState<TextBackgroundStyle>(
      defaultTextPanelSettings.backgroundStyle
    );
  const [textPanelOutlineEnabled, setTextPanelOutlineEnabled] = useState(
    defaultTextPanelSettings.outlineEnabled
  );
  const [textPanelOutlineColor, setTextPanelOutlineColor] = useState(
    defaultTextPanelSettings.outlineColor
  );
  const [textPanelOutlineWidth, setTextPanelOutlineWidth] = useState(
    defaultTextPanelSettings.outlineWidth
  );
  const [textPanelShadowEnabled, setTextPanelShadowEnabled] = useState(
    defaultTextPanelSettings.shadowEnabled
  );
  const [textPanelShadowColor, setTextPanelShadowColor] = useState(
    defaultTextPanelSettings.shadowColor
  );
  const [textPanelShadowBlur, setTextPanelShadowBlur] = useState(
    defaultTextPanelSettings.shadowBlur
  );
  const [textPanelShadowOpacity, setTextPanelShadowOpacity] = useState(
    defaultTextPanelSettings.shadowOpacity
  );
  const [fontLoadTick, setFontLoadTick] = useState(0);
  const [textPanelSpacingOpen, setTextPanelSpacingOpen] = useState(false);
  const [textPanelStylesOpen, setTextPanelStylesOpen] = useState(true);
  const [textPanelStylePresetId, setTextPanelStylePresetId] = useState<
    string | null
  >(null);
  const [textPanelShadowAdvancedOpen, setTextPanelShadowAdvancedOpen] =
    useState(false);
  const [textPanelStart, setTextPanelStart] = useState("00:00.0");
  const [textPanelEnd, setTextPanelEnd] = useState("00:05.0");
  const textPanelTextAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const stageTextEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const [editingTextClipId, setEditingTextClipId] = useState<string | null>(
    null
  );
  const [timelineResizeState, setTimelineResizeState] = useState<{
    startY: number;
    startHeight: number;
  } | null>(null);
  const [rangeSelection, setRangeSelection] =
    useState<RangeSelectionState | null>(null);
  const [dragTransformState, setDragTransformState] =
    useState<TransformDragState | null>(null);
  const [resizeTransformState, setResizeTransformState] =
    useState<TransformResizeState | null>(null);
  const [rotateTransformState, setRotateTransformState] =
    useState<TransformRotateState | null>(null);
  const [dragClipState, setDragClipState] = useState<ClipDragState | null>(
    null
  );
  const [dragOverCanvas, setDragOverCanvas] = useState(false);
  const [dragOverTimeline, setDragOverTimeline] = useState(false);
  const [trimState, setTrimState] = useState<TrimState | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const replaceMediaInputRef = useRef<HTMLInputElement | null>(null);
  const assetsRef = useRef<MediaAsset[]>([]);
  const lanesRef = useRef<TimelineLane[]>([]);
  const textSettingsRef = useRef<Record<string, TextClipSettings>>({});
  const loadedFontFamiliesRef = useRef<Set<string>>(new Set());
  const loadingFontFamiliesRef = useRef<Map<string, Promise<void>>>(new Map());
  const fontStylesheetPromisesRef = useRef<Map<string, Promise<void>>>(new Map());
  const stageAspectRatioRef = useRef(16 / 9);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stageViewportRef = useRef<HTMLDivElement | null>(null);
  const floatingMenuRef = useRef<HTMLDivElement | null>(null);
  const timelineContextMenuRef = useRef<HTMLDivElement | null>(null);
  const [stageViewport, setStageViewport] = useState({ width: 0, height: 0 });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [mainHeight, setMainHeight] = useState(0);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineTrackRef = useRef<HTMLDivElement | null>(null);
  const timelineThumbnailsRef = useRef<
    Record<string, { key: string; frames: string[] }>
  >({});
  const thumbnailJobRef = useRef(0);
  const scrubPointerIdRef = useRef<number | null>(null);
  const scrubPointerTargetRef = useRef<HTMLElement | null>(null);
  const visualRefs = useRef(new Map<string, HTMLVideoElement | null>());
  const audioRefs = useRef(new Map<string, HTMLAudioElement | null>());
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const stockDurationCacheRef = useRef<Map<string, number | null>>(new Map());
  const stockMusicLoadTimeoutRef = useRef<number | null>(null);
  const stockMusicLoadIdRef = useRef(0);
  const stockVideoMetaCacheRef = useRef<
    Map<
      string,
      {
        duration: number | null;
        width?: number;
        height?: number;
        orientation?: StockVideoOrientation | null;
      }
    >
  >(new Map());
  const stockVideoMetaLoadingRef = useRef<Set<string>>(new Set());
  const stockVideoLoadTimeoutRef = useRef<number | null>(null);
  const stockVideoLoadIdRef = useRef(0);
  const stockVideoPreviewRefs = useRef<Map<string, HTMLVideoElement | null>>(
    new Map()
  );
  const historyRef = useRef<{
    past: EditorSnapshot[];
    future: EditorSnapshot[];
    locked: boolean;
  }>({ past: [], future: [], locked: false });
  const historyThrottleRef = useRef(0);
  const clipboardRef = useRef<ClipboardData | null>(null);
  const dragTransformHistoryRef = useRef(false);
  const resizeTransformHistoryRef = useRef(false);
  const rotateTransformHistoryRef = useRef(false);
  const resizeTextRectRef = useRef<ClipTransform | null>(null);
  const resizeTextFontRef = useRef<{ clipId: string; fontSize: number } | null>(
    null
  );
  const clipTransformTouchedRef = useRef<Set<string>>(new Set());
  const dragClipHistoryRef = useRef(false);
  const dragClipStateRef = useRef<ClipDragState | null>(null);
  const trimHistoryRef = useRef(false);
  const timelinePanRef = useRef<{
    startX: number;
    scrollLeft: number;
    active: boolean;
  }>({ startX: 0, scrollLeft: 0, active: false });
  const keyboardEffectDeps = useRef<number[]>(
    Array.from({ length: 12 }, () => 0)
  );
  const keyboardStateRef = useRef<KeyboardShortcutState>({
    currentTime: 0,
    timelineDuration: 0,
    handleCopySelection: () => false,
    handleDeleteSelected: () => {},
    handleDuplicateClip: () => {},
    handlePasteSelection: () => {},
    handleRedo: () => {},
    handleSelectAll: () => {},
    handleSplitClip: () => {},
    handleTogglePlayback: () => {},
    handleUndo: () => {},
    isEditableTarget: () => false,
  });
  const fallbackVideoSettings = useMemo(createDefaultVideoSettings, []);
  const fallbackTextSettings = useMemo(createDefaultTextSettings, []);
  const hasSupabase =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  useEffect(() => {
    timelineThumbnailsRef.current = timelineThumbnails;
  }, [timelineThumbnails]);

  const updateVideoMetaFromElement = useCallback(
    (clipId: string, assetId: string, element: HTMLVideoElement | null) => {
      if (!element) {
        return;
      }
      const width = element.videoWidth;
      const height = element.videoHeight;
      if (!width || !height) {
        return;
      }
      const aspectRatio = width / height;
      setAssets((prev) => {
        const index = prev.findIndex((asset) => asset.id === assetId);
        if (index < 0) {
          return prev;
        }
        const current = prev[index];
        if (
          current.width === width &&
          current.height === height &&
          current.aspectRatio === aspectRatio
        ) {
          return prev;
        }
        const next = [...prev];
        next[index] = {
          ...current,
          width,
          height,
          aspectRatio,
        };
        return next;
      });
      if (clipTransformTouchedRef.current.has(clipId)) {
        return;
      }
      const stageRatio = stageAspectRatioRef.current || 16 / 9;
      setClipTransforms((prev) => {
        const current = prev[clipId];
        if (!current) {
          return prev;
        }
        const nextTransform = createDefaultTransform(
          aspectRatio,
          stageRatio
        );
        if (
          Math.abs(current.width - nextTransform.width) < 0.001 &&
          Math.abs(current.height - nextTransform.height) < 0.001 &&
          Math.abs(current.x - nextTransform.x) < 0.001 &&
          Math.abs(current.y - nextTransform.y) < 0.001
        ) {
          return prev;
        }
        return {
          ...prev,
          [clipId]: nextTransform,
        };
      });
      setBackgroundTransforms((prev) => {
        const current = prev[clipId];
        if (!current) {
          return prev;
        }
        const nextTransform = createDefaultTransform(
          aspectRatio,
          stageRatio
        );
        if (
          Math.abs(current.width - nextTransform.width) < 0.001 &&
          Math.abs(current.height - nextTransform.height) < 0.001 &&
          Math.abs(current.x - nextTransform.x) < 0.001 &&
          Math.abs(current.y - nextTransform.y) < 0.001
        ) {
          return prev;
        }
        return {
          ...prev,
          [clipId]: nextTransform,
        };
      });
    },
    []
  );

  const registerVideoRef = useCallback(
    (clipId: string, assetId: string) => (node: HTMLVideoElement | null) => {
      if (node) {
        visualRefs.current.set(clipId, node);
        updateVideoMetaFromElement(clipId, assetId, node);
      } else {
        visualRefs.current.delete(clipId);
      }
    },
    [updateVideoMetaFromElement]
  );

  const registerAudioRef = useCallback(
    (clipId: string) => (node: HTMLAudioElement | null) => {
      if (node) {
        audioRefs.current.set(clipId, node);
      } else {
        audioRefs.current.delete(clipId);
      }
    },
    []
  );

  const selectedClipIdsSet = useMemo(
    () => new Set(selectedClipIds),
    [selectedClipIds]
  );
  const textFontSizeDisplay = useMemo(
    () => Math.round(textPanelFontSizeDisplay),
    [textPanelFontSizeDisplay]
  );
  const textFontSizeOptions = useMemo(() => {
    if (textFontSizes.includes(textFontSizeDisplay)) {
      return textFontSizes;
    }
    return [textFontSizeDisplay, ...textFontSizes];
  }, [textFontSizeDisplay]);

  const ensureFontStylesheet = useCallback((fontFamily: string) => {
    if (typeof document === "undefined") {
      return Promise.resolve();
    }
    const family = fontFamily.trim();
    if (!family || systemFontFamilies.has(family)) {
      return Promise.resolve();
    }
    const linkId = `font-${family.toLowerCase().replace(/\s+/g, "-")}`;
    const existing = document.getElementById(linkId);
    if (existing) {
      return fontStylesheetPromisesRef.current.get(family) ?? Promise.resolve();
    }
    const encoded = encodeURIComponent(family).replace(/%20/g, "+");
    const link = document.createElement("link");
    const promise = new Promise<void>((resolve) => {
      link.onload = () => resolve();
      link.onerror = () => resolve();
    });
    fontStylesheetPromisesRef.current.set(family, promise);
    link.id = linkId;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;500;600;700;800&display=swap`;
    document.head.appendChild(link);
    return promise;
  }, []);

  const loadFontFamily = useCallback((fontFamily: string) => {
    if (typeof document === "undefined" || !document.fonts) {
      return Promise.resolve();
    }
    const family = fontFamily.trim();
    if (!family) {
      return Promise.resolve();
    }
    if (loadedFontFamiliesRef.current.has(family)) {
      return Promise.resolve();
    }
    const pending = loadingFontFamiliesRef.current.get(family);
    if (pending) {
      return pending;
    }
    const loadPromise = ensureFontStylesheet(family)
      .then(() => document.fonts.load(`16px "${family.replace(/"/g, '\\"')}"`))
      .then(() => {
        loadedFontFamiliesRef.current.add(family);
        setFontLoadTick(Date.now());
      })
      .catch(() => {})
      .finally(() => {
        loadingFontFamiliesRef.current.delete(family);
      });
    loadingFontFamiliesRef.current.set(family, loadPromise);
    return loadPromise;
  }, [ensureFontStylesheet]);

  const isEditableTarget = useCallback((target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    if (!element) {
      return false;
    }
    return (
      element.tagName === "INPUT" ||
      element.tagName === "TEXTAREA" ||
      element.isContentEditable
    );
  }, []);

  const createSnapshot = useCallback<() => EditorSnapshot>(() => {
    const clonedClipSettings: Record<string, VideoClipSettings> = {};
    Object.entries(clipSettings).forEach(([id, settings]) => {
      clonedClipSettings[id] = cloneVideoSettings(settings);
    });
    const clonedTextSettings: Record<string, TextClipSettings> = {};
    Object.entries(textSettings).forEach(([id, settings]) => {
      clonedTextSettings[id] = cloneTextSettings(settings);
    });
    const clonedClipTransforms: Record<string, ClipTransform> = {};
    Object.entries(clipTransforms).forEach(([id, rect]) => {
      clonedClipTransforms[id] = { ...rect };
    });
    const clonedBackgroundTransforms: Record<string, ClipTransform> = {};
    Object.entries(backgroundTransforms).forEach(([id, rect]) => {
      clonedBackgroundTransforms[id] = { ...rect };
    });
    return {
      assets: assets.map((asset) => ({ ...asset })),
      timeline: timeline.map((clip) => ({ ...clip })),
      lanes: lanes.map((lane) => ({ ...lane })),
      clipTransforms: clonedClipTransforms,
      backgroundTransforms: clonedBackgroundTransforms,
      clipSettings: clonedClipSettings,
      textSettings: clonedTextSettings,
      clipOrder: { ...clipOrder },
      canvasBackground,
      videoBackground,
      currentTime,
      selectedClipId,
      selectedClipIds: [...selectedClipIds],
      activeAssetId,
      activeCanvasClipId,
    };
  }, [
    assets,
    timeline,
    lanes,
    clipTransforms,
    backgroundTransforms,
    clipSettings,
    textSettings,
    clipOrder,
    canvasBackground,
    videoBackground,
    currentTime,
    selectedClipId,
    selectedClipIds,
    activeAssetId,
    activeCanvasClipId,
  ]);

  const syncHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: historyRef.current.past.length > 0,
      canRedo: historyRef.current.future.length > 0,
    });
  }, []);

  const pushHistory = useCallback(() => {
    if (historyRef.current.locked) {
      return;
    }
    const snapshot = createSnapshot();
    historyRef.current.past = [
      ...historyRef.current.past.slice(-maxHistoryEntries + 1),
      snapshot,
    ];
    historyRef.current.future = [];
    syncHistoryState();
  }, [createSnapshot, syncHistoryState]);

  const pushHistoryThrottled = useCallback(() => {
    const now = Date.now();
    if (now - historyThrottleRef.current < 350) {
      return;
    }
    historyThrottleRef.current = now;
    pushHistory();
  }, [pushHistory]);

  const applySnapshot = useCallback((snapshot: EditorSnapshot) => {
    historyRef.current.locked = true;
    setAssets(snapshot.assets);
    setTimeline(snapshot.timeline);
    setLanes(snapshot.lanes);
    setClipTransforms(snapshot.clipTransforms);
    setBackgroundTransforms(snapshot.backgroundTransforms);
    setClipSettings(snapshot.clipSettings);
    setTextSettings(snapshot.textSettings);
    setClipOrder(snapshot.clipOrder);
    setCanvasBackground(snapshot.canvasBackground);
    setVideoBackground(snapshot.videoBackground);
    setCurrentTime(snapshot.currentTime);
    setSelectedClipId(snapshot.selectedClipId);
    setSelectedClipIds(snapshot.selectedClipIds);
    setActiveAssetId(snapshot.activeAssetId);
    setActiveCanvasClipId(snapshot.activeCanvasClipId);
    setIsBackgroundSelected(false);
    historyRef.current.locked = false;
  }, []);

  const handleUndo = useCallback(() => {
    const history = historyRef.current;
    if (history.past.length === 0) {
      return;
    }
    const snapshot = history.past[history.past.length - 1];
    const current = createSnapshot();
    history.past = history.past.slice(0, -1);
    history.future = [current, ...history.future];
    applySnapshot(snapshot);
    syncHistoryState();
  }, [applySnapshot, createSnapshot, syncHistoryState]);

  const handleRedo = useCallback(() => {
    const history = historyRef.current;
    if (history.future.length === 0) {
      return;
    }
    const snapshot = history.future[0];
    const current = createSnapshot();
    history.future = history.future.slice(1);
    history.past = [...history.past, current].slice(-maxHistoryEntries);
    applySnapshot(snapshot);
    syncHistoryState();
  }, [applySnapshot, createSnapshot, syncHistoryState]);

  useEffect(() => {
    if (selectedClipId || selectedClipIds.length > 0) {
      setIsBackgroundSelected(false);
    }
  }, [selectedClipId, selectedClipIds.length]);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    lanesRef.current = lanes;
  }, [lanes]);

  useEffect(() => {
    textSettingsRef.current = textSettings;
  }, [textSettings]);

  useEffect(() => {
    dragClipStateRef.current = dragClipState;
  }, [dragClipState]);

  useEffect(() => {
    if (textPanelFontFamily) {
      loadFontFamily(textPanelFontFamily);
    }
  }, [textPanelFontFamily, loadFontFamily]);

  useEffect(() => {
    Object.values(textSettings).forEach((settings) => {
      if (settings?.fontFamily) {
        loadFontFamily(settings.fontFamily);
      }
    });
  }, [textSettings, loadFontFamily]);

  useEffect(() => {
    setLanes((prev) => {
      const laneIdsInUse = new Set(timeline.map((clip) => clip.laneId));
      const next = prev.filter((lane) => laneIdsInUse.has(lane.id));
      timeline.forEach((clip) => {
        if (next.some((lane) => lane.id === clip.laneId)) {
          return;
        }
        const asset = assetsRef.current.find(
          (item) => item.id === clip.assetId
        );
        next.push({ id: clip.laneId, type: getLaneType(asset) });
      });
      // Sort lanes to enforce ordering: video first, then text, then audio at bottom
      next.sort((a, b) => {
        const order: Record<string, number> = { video: 0, text: 1, audio: 2 };
        return (order[a.type] ?? 0) - (order[b.type] ?? 0);
      });
      return next;
    });
  }, [timeline]);

  useEffect(() => {
    return () => {
      assetsRef.current.forEach((asset) => URL.revokeObjectURL(asset.url));
    };
  }, []);

  useEffect(() => {
    return () => {
      previewAudioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (activeTool === "audio") {
      setAssetFilter("Audio");
    } else if (activeTool === "image") {
      setAssetFilter("Images");
    } else {
      setAssetFilter("All");
    }
  }, [activeTool]);

  useEffect(() => {
    if (activeTool === "audio") {
      return;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
    setIsPreviewPlaying(false);
  }, [activeTool]);

  useEffect(() => {
    if (activeTool !== "audio" || !hasSupabase) {
      return;
    }
    let cancelled = false;
    const loadId = stockMusicLoadIdRef.current + 1;
    stockMusicLoadIdRef.current = loadId;
    const loadStockMusic = async () => {
      setStockMusicStatus("loading");
      setStockMusicError(null);
      if (stockMusicLoadTimeoutRef.current) {
        window.clearTimeout(stockMusicLoadTimeoutRef.current);
      }
      stockMusicLoadTimeoutRef.current = window.setTimeout(() => {
        setStockMusicStatus((current) =>
          current === "loading" ? "error" : current
        );
        setStockMusicError(
          "Stock music request timed out. Check storage list access."
        );
      }, 15000);
      try {
        const { supabaseBrowser } = await import("@/lib/supabase/browser");
        const bucket = supabaseBrowser.storage.from(stockMusicBucketName);
        console.log("[stock-music] bucket", {
          bucket: stockMusicBucketName,
          root: stockMusicRootPrefix || "(root)",
        });
        const listWithTimeout = async (path: string) => {
          let timeoutId: number | null = null;
          const timeoutPromise = new Promise<{
            data: null;
            error: Error;
          }>((_, reject) => {
            timeoutId = window.setTimeout(() => {
              reject(new Error("Stock music request timed out."));
            }, 10000);
          });
          const result = (await Promise.race([
            bucket.list(path, {
              limit: 1000,
              sortBy: { column: "name", order: "asc" },
            }),
            timeoutPromise,
          ])) as {
            data: Array<{
              id?: string | null;
              name: string;
              metadata?: { size?: number; mimetype?: string | null } | null;
            }> | null;
            error: Error | null;
          };
          if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
          }
          if (result.error) {
            console.error("[stock-music] list error", path, result.error);
          } else {
            console.log("[stock-music] list ok", path, {
              count: result.data?.length ?? 0,
            });
          }
          return result;
        };
        const tracks: StockAudioTrack[] = [];
        const pushFiles = (
          items: Array<{
            id?: string | null;
            name: string;
            metadata?: { size?: number; mimetype?: string | null } | null;
          }>,
          category: string,
          prefix: string
        ) => {
          items.forEach((item) => {
            const mimeType = item.metadata?.mimetype ?? null;
            if (!isAudioFile(item.name, mimeType)) {
              return;
            }
            const path = prefix ? `${prefix}/${item.name}` : item.name;
            const { data } = bucket.getPublicUrl(path);
            if (!data?.publicUrl) {
              return;
            }
            tracks.push({
              id: path,
              name: formatStockLabel(item.name),
              category,
              url: data.publicUrl,
              path,
              size: Number(item.metadata?.size ?? 0),
            });
          });
        };
        const isFileEntry = (item: {
          id?: string | null;
          name: string;
          metadata?: { size?: number; mimetype?: string | null } | null;
        }) =>
          Boolean(item.id) ||
          Boolean(item.metadata) ||
          isAudioFile(item.name, item.metadata?.mimetype ?? null);
        const collectTracks = async (path: string) => {
          console.log("[stock-music] collect", path || "(root)");
          const { data, error } = await listWithTimeout(path);
          if (error) {
            throw error;
          }
          const entries = data ?? [];
          const files = entries.filter(isFileEntry);
          console.log("[stock-music] entries", path || "(root)", {
            entries: entries.length,
            files: files.length,
          });
          if (files.length > 0) {
            const label = path
              ? formatStockLabel(path.split("/").pop() ?? "General")
              : "General";
            pushFiles(files, label, path);
          }
          const folders = entries.filter((item) => !isFileEntry(item));
          if (folders.length > 0) {
            console.log(
              "[stock-music] folders",
              path || "(root)",
              folders.map((folder) => folder.name)
            );
          }
          await Promise.all(
            folders.map((folder) => {
              const nextPath = path ? `${path}/${folder.name}` : folder.name;
              return collectTracks(nextPath);
            })
          );
        };
        await collectTracks(stockMusicRootPrefix);
        if (cancelled || loadId !== stockMusicLoadIdRef.current) {
          return;
        }
        tracks.sort((a, b) => a.name.localeCompare(b.name));
        console.log("[stock-music] tracks", tracks.length);
        setStockMusic(tracks);
        setStockMusicStatus("ready");
      } catch (error) {
        if (cancelled || loadId !== stockMusicLoadIdRef.current) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load stock music from Supabase.";
        console.error("[stock-music] load failed", error);
        setStockMusicError(message);
        setStockMusicStatus("error");
      } finally {
        if (stockMusicLoadTimeoutRef.current) {
          window.clearTimeout(stockMusicLoadTimeoutRef.current);
          stockMusicLoadTimeoutRef.current = null;
        }
      }
    };
    loadStockMusic();
    return () => {
      if (stockMusicLoadTimeoutRef.current) {
        window.clearTimeout(stockMusicLoadTimeoutRef.current);
        stockMusicLoadTimeoutRef.current = null;
      }
      cancelled = true;
    };
  }, [activeTool, hasSupabase, stockMusicReloadKey]);

  useEffect(() => {
    if (stockMusic.length === 0) {
      return;
    }
    let cancelled = false;
    const loadDurations = async () => {
      const pending = stockMusic.filter(
        (track) =>
          track.duration == null &&
          !stockDurationCacheRef.current.has(track.id)
      );
      if (pending.length === 0) {
        return;
      }
      const updates = new Map<string, number>();
      const concurrency = Math.min(6, pending.length);
      const queue = [...pending];
      const workers = Array.from({ length: concurrency }, () =>
        (async () => {
          while (queue.length > 0) {
            const track = queue.shift();
            if (!track) {
              return;
            }
            const meta = await getMediaMeta("audio", track.url);
            const duration =
              meta.duration != null ? Math.max(0, meta.duration) : null;
            stockDurationCacheRef.current.set(track.id, duration);
            if (duration != null) {
              updates.set(track.id, duration);
            }
            if (cancelled) {
              return;
            }
          }
        })()
      );
      await Promise.all(workers);
      if (cancelled || updates.size === 0) {
        return;
      }
      setStockMusic((prev) =>
        prev.map((track) => {
          const nextDuration = updates.get(track.id);
          if (nextDuration == null) {
            return track;
          }
          return { ...track, duration: nextDuration };
        })
      );
    };
    loadDurations();
    return () => {
      cancelled = true;
    };
  }, [stockMusic]);

  useEffect(() => {
    if (activeTool !== "video" || !hasSupabase) {
      return;
    }
    let cancelled = false;
    const loadId = stockVideoLoadIdRef.current + 1;
    stockVideoLoadIdRef.current = loadId;
    const loadStockVideos = async () => {
      setStockVideoStatus("loading");
      setStockVideoError(null);
      if (stockVideoLoadTimeoutRef.current) {
        window.clearTimeout(stockVideoLoadTimeoutRef.current);
      }
      stockVideoLoadTimeoutRef.current = window.setTimeout(() => {
        setStockVideoStatus((current) =>
          current === "loading" ? "error" : current
        );
        setStockVideoError(
          "Stock video request timed out. Check storage list access."
        );
      }, 15000);
      try {
        const { supabaseBrowser } = await import("@/lib/supabase/browser");
        const bucket = supabaseBrowser.storage.from(stockVideoBucketName);
        console.log("[stock-video] bucket", {
          bucket: stockVideoBucketName,
          root: stockVideoRootPrefix || "(root)",
        });
        const listWithTimeout = async (path: string) => {
          let timeoutId: number | null = null;
          const timeoutPromise = new Promise<{
            data: null;
            error: Error;
          }>((_, reject) => {
            timeoutId = window.setTimeout(() => {
              reject(new Error("Stock video request timed out."));
            }, 10000);
          });
          const result = (await Promise.race([
            bucket.list(path, {
              limit: 1000,
              sortBy: { column: "name", order: "asc" },
            }),
            timeoutPromise,
          ])) as {
            data: Array<{
              id?: string | null;
              name: string;
              metadata?: { size?: number; mimetype?: string | null } | null;
            }> | null;
            error: Error | null;
          };
          if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
          }
          if (result.error) {
            console.error("[stock-video] list error", path, result.error);
          } else {
            console.log("[stock-video] list ok", path, {
              count: result.data?.length ?? 0,
            });
          }
          return result;
        };
        const videos: StockVideoItem[] = [];
        const pushFiles = (
          items: Array<{
            id?: string | null;
            name: string;
            metadata?: { size?: number; mimetype?: string | null } | null;
          }>,
          prefix: string
        ) => {
          const prefixOrientation = resolveStockVideoOrientationFromPath(prefix);
          const category = resolveStockVideoCategory(prefix, prefixOrientation);
          items.forEach((item) => {
            const mimeType = item.metadata?.mimetype ?? null;
            if (!isVideoFile(item.name, mimeType)) {
              return;
            }
            const path = prefix ? `${prefix}/${item.name}` : item.name;
            const { data } = bucket.getPublicUrl(path);
            if (!data?.publicUrl) {
              return;
            }
            const fileOrientation =
              resolveStockVideoOrientationFromPath(path) ?? prefixOrientation;
            videos.push({
              id: path,
              name: formatStockLabel(item.name),
              category,
              url: data.publicUrl,
              path,
              size: Number(item.metadata?.size ?? 0),
              orientation: fileOrientation ?? undefined,
            });
          });
        };
        const isFileEntry = (item: {
          id?: string | null;
          name: string;
          metadata?: { size?: number; mimetype?: string | null } | null;
        }) =>
          Boolean(item.id) ||
          Boolean(item.metadata) ||
          isVideoFile(item.name, item.metadata?.mimetype ?? null);
        const collectVideos = async (path: string) => {
          console.log("[stock-video] collect", path || "(root)");
          const { data, error } = await listWithTimeout(path);
          if (error) {
            throw error;
          }
          const entries = data ?? [];
          const files = entries.filter(isFileEntry);
          console.log("[stock-video] entries", path || "(root)", {
            entries: entries.length,
            files: files.length,
          });
          if (files.length > 0) {
            pushFiles(files, path);
          }
          const folders = entries.filter((item) => !isFileEntry(item));
          if (folders.length > 0) {
            console.log(
              "[stock-video] folders",
              path || "(root)",
              folders.map((folder) => folder.name)
            );
          }
          await Promise.all(
            folders.map((folder) => {
              const nextPath = path ? `${path}/${folder.name}` : folder.name;
              return collectVideos(nextPath);
            })
          );
        };
        await collectVideos(stockVideoRootPrefix);
        if (cancelled || loadId !== stockVideoLoadIdRef.current) {
          return;
        }
        videos.sort((a, b) => a.name.localeCompare(b.name));
        console.log("[stock-video] videos", videos.length);
        setStockVideoItems(videos);
        setStockVideoStatus("ready");
      } catch (error) {
        if (cancelled || loadId !== stockVideoLoadIdRef.current) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load stock videos from Supabase.";
        console.error("[stock-video] load failed", error);
        setStockVideoError(message);
        setStockVideoStatus("error");
      } finally {
        if (stockVideoLoadTimeoutRef.current) {
          window.clearTimeout(stockVideoLoadTimeoutRef.current);
          stockVideoLoadTimeoutRef.current = null;
        }
      }
    };
    loadStockVideos();
    return () => {
      if (stockVideoLoadTimeoutRef.current) {
        window.clearTimeout(stockVideoLoadTimeoutRef.current);
        stockVideoLoadTimeoutRef.current = null;
      }
      cancelled = true;
    };
  }, [activeTool, hasSupabase, stockVideoReloadKey]);

  useEffect(() => {
    if (!["video", "audio", "image"].includes(activeTool)) {
      setIsAssetLibraryExpanded(false);
    }
    if (activeTool !== "video") {
      setIsStockVideoExpanded(false);
    }
    if (activeTool !== "text") {
      setTextPanelView("library");
      setEditingTextClipId(null);
    }
  }, [activeTool]);

  useEffect(() => {
    if (isStockVideoExpanded) {
      setIsAssetLibraryExpanded(false);
    }
  }, [isStockVideoExpanded]);

  useEffect(() => {
    const viewport = stageViewportRef.current;
    if (!viewport) {
      return;
    }
    const updateSize = () => {
      const rect = viewport.getBoundingClientRect();
      setStageViewport({ width: rect.width, height: rect.height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) {
      return;
    }
    const updateSize = () => {
      const rect = main.getBoundingClientRect();
      setMainHeight(rect.height);
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(main);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!floatingMenu.open) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && floatingMenuRef.current?.contains(target)) {
        return;
      }
      setFloatingMenu(closeFloatingMenuState);
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [floatingMenu.open]);

  useEffect(() => {
    if (!floatingMenu.open) {
      return;
    }
    const stage = stageRef.current;
    const menu = floatingMenuRef.current;
    if (!stage || !menu) {
      return;
    }
    const stageRect = stage.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const maxX = Math.max(8, stageRect.width - menuRect.width - 8);
    const maxY = Math.max(8, stageRect.height - menuRect.height - 8);
    const nextX = clamp(floatingMenu.x, 8, maxX);
    const nextY = clamp(floatingMenu.y, 8, maxY);
    if (nextX !== floatingMenu.x || nextY !== floatingMenu.y) {
      setFloatingMenu((prev) => ({ ...prev, x: nextX, y: nextY }));
    }
  }, [
    floatingMenu.open,
    floatingMenu.showMore,
    floatingMenu.showOrder,
    floatingMenu.showVolume,
    floatingMenu.showSpeed,
    floatingMenu.showOpacity,
    floatingMenu.showCorners,
    floatingMenu.showTiming,
    floatingMenu.x,
    floatingMenu.y,
  ]);

  // Timeline context menu click-outside detection
  useEffect(() => {
    if (!timelineContextMenu.open) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && timelineContextMenuRef.current?.contains(target)) {
        return;
      }
      setTimelineContextMenu(closeTimelineContextMenuState);
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [timelineContextMenu.open]);

  // Timeline context menu position adjustment (viewport coordinates)
  useEffect(() => {
    if (!timelineContextMenu.open || typeof window === "undefined") {
      return;
    }
    const menu = timelineContextMenuRef.current;
    if (!menu) {
      return;
    }
    const menuRect = menu.getBoundingClientRect();
    
    // Clamp to viewport bounds
    const maxX = Math.max(8, window.innerWidth - menuRect.width - 8);
    const maxY = Math.max(8, window.innerHeight - menuRect.height - 8);
    
    const nextX = clamp(timelineContextMenu.x, 8, maxX);
    const nextY = clamp(timelineContextMenu.y, 8, maxY);
    
    if (nextX !== timelineContextMenu.x || nextY !== timelineContextMenu.y) {
      setTimelineContextMenu((prev) => ({ ...prev, x: nextX, y: nextY }));
    }
  }, [
    timelineContextMenu.open,
    timelineContextMenu.showReplaceMedia,
    timelineContextMenu.showAudio,
    timelineContextMenu.x,
    timelineContextMenu.y,
  ]);

  const activeToolLabel = useMemo(() => {
    return toolbarItems.find((item) => item.id === activeTool)?.label ?? "Panel";
  }, [activeTool]);

  const visibleTextPresetGroups = useMemo(() => {
    if (expandedTextGroupId) {
      return textPresetGroups.filter((group) => group.id === expandedTextGroupId);
    }
    if (textPanelTag === "All") {
      return textPresetGroups;
    }
    return textPresetGroups.filter(
      (group) => group.category === textPanelTag
    );
  }, [textPanelTag, expandedTextGroupId]);

  useEffect(() => {
    if (activeTool !== "text" || textPanelView !== "library") {
      return;
    }
    const families = new Set<string>();
    visibleTextPresetGroups.forEach((group) => {
      group.presets.forEach((preset) => {
        preset.preview.forEach((line) => {
          if (line.fontFamily) {
            families.add(line.fontFamily);
          }
        });
      });
    });
    families.forEach((family) => loadFontFamily(family));
  }, [activeTool, textPanelView, visibleTextPresetGroups, loadFontFamily]);

  const createTextAsset = (label: string): MediaAsset => ({
    id: crypto.randomUUID(),
    name: label,
    kind: "text",
    url: "",
    size: 0,
    duration: defaultTextDuration,
    createdAt: Date.now(),
  });

  const addTextClip = useCallback(
    (settings: TextClipSettings, label: string, startTime?: number) => {
      setIsBackgroundSelected(false);
      pushHistory();
      const asset = createTextAsset(label);
      const nextLanes = [...lanesRef.current];
      const laneId = createLaneId("text", nextLanes);
      const resolvedStart =
        startTime ?? Math.max(0, Math.round(currentTime / snapInterval) * snapInterval);
      const clip = createClip(asset.id, laneId, resolvedStart, asset);
      setLanes(nextLanes);
      setAssets((prev) => [asset, ...prev]);
      setTimeline((prev) => [...prev, clip]);
      setTextSettings((prev) => ({ ...prev, [clip.id]: settings }));
      setSelectedClipId(clip.id);
      setSelectedClipIds([clip.id]);
      setActiveCanvasClipId(clip.id);
      setActiveAssetId(asset.id);
      setActiveTool("text");
    },
    [currentTime, pushHistory]
  );

  const handleTextPresetSelect = useCallback(
    (preset: TextPreset) => {
      const base = createDefaultTextSettings();
      const nextSettings: TextClipSettings = {
        ...base,
        text: preset.editText,
        fontFamily: preset.editFontFamily ?? base.fontFamily,
        fontSize: preset.editFontSize,
      };
      setTextPanelPreset(preset);
      setTextPanelStylePresetId(null);
      setTextPanelDraft(nextSettings.text);
      setTextPanelFontFamily(nextSettings.fontFamily);
      setTextPanelFontSize(nextSettings.fontSize);
      setTextPanelFontSizeDisplay(nextSettings.fontSize);
      setTextPanelColor(nextSettings.color);
      setTextPanelBold(nextSettings.bold);
      setTextPanelItalic(nextSettings.italic);
      setTextPanelAlign(nextSettings.align);
      setTextPanelLetterSpacing(nextSettings.letterSpacing);
      setTextPanelLineHeight(nextSettings.lineHeight);
      setTextPanelBackgroundEnabled(nextSettings.backgroundEnabled);
      setTextPanelBackgroundColor(nextSettings.backgroundColor);
      setTextPanelBackgroundStyle(nextSettings.backgroundStyle);
      setTextPanelOutlineEnabled(nextSettings.outlineEnabled);
      setTextPanelOutlineColor(nextSettings.outlineColor);
      setTextPanelOutlineWidth(nextSettings.outlineWidth);
      setTextPanelShadowEnabled(nextSettings.shadowEnabled);
      setTextPanelShadowColor(nextSettings.shadowColor);
      setTextPanelShadowBlur(nextSettings.shadowBlur);
      setTextPanelShadowOpacity(nextSettings.shadowOpacity);
      setTextPanelView("edit");
      addTextClip(nextSettings, preset.name);
    },
    [addTextClip]
  );

  const createClip = (
    assetId: string,
    laneId: string,
    startTime: number,
    assetOverride?: MediaAsset
  ): TimelineClip => {
    const asset =
      assetOverride ?? assetsRef.current.find((item) => item.id === assetId);
    const duration = getAssetDurationSeconds(asset);
    return {
      id: crypto.randomUUID(),
      assetId,
      duration,
      startOffset: 0,
      startTime,
      laneId,
    };
  };

  const createLaneId = (type: LaneType, draft: TimelineLane[]) => {
    const lane = { id: crypto.randomUUID(), type };
    // Maintain lane order: video lanes at top, text lanes in middle, audio lanes at bottom
    if (type === "audio") {
      // Audio always goes at the end (bottom)
      draft.push(lane);
    } else if (type === "text") {
      // Text goes before audio lanes
      const firstAudioIndex = draft.findIndex((l) => l.type === "audio");
      if (firstAudioIndex === -1) {
        draft.push(lane);
      } else {
        draft.splice(firstAudioIndex, 0, lane);
      }
    } else {
      // Video goes before text and audio lanes
      const firstNonVideoIndex = draft.findIndex((l) => l.type === "text" || l.type === "audio");
      if (firstNonVideoIndex === -1) {
        draft.push(lane);
      } else {
        draft.splice(firstNonVideoIndex, 0, lane);
      }
    }
    return lane.id;
  };

  const filteredAssets = useMemo(() => {
    if (assetFilter === "All") {
      return assets.filter((asset) => asset.kind !== "text");
    }
    if (assetFilter === "Video") {
      return assets.filter((asset) => asset.kind === "video");
    }
    if (assetFilter === "Images") {
      return assets.filter((asset) => asset.kind === "image");
    }
    return assets.filter((asset) => asset.kind === "audio");
  }, [assets, assetFilter]);

  const viewAllAssets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase();
    if (!query) {
      return filteredAssets;
    }
    return filteredAssets.filter((asset) =>
      asset.name.toLowerCase().includes(query)
    );
  }, [assetSearch, filteredAssets]);

  const stockCategories = useMemo(() => {
    const categories = Array.from(
      new Set(stockMusic.map((track) => track.category))
    ).sort((a, b) => a.localeCompare(b));
    return ["All", ...categories];
  }, [stockMusic]);

  const filteredStockMusic = useMemo(() => {
    const query = stockSearch.trim().toLowerCase();
    return stockMusic.filter((track) => {
      const matchesCategory =
        stockCategory === "All" || track.category === stockCategory;
      if (!matchesCategory) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        track.name.toLowerCase().includes(query) ||
        track.category.toLowerCase().includes(query)
      );
    });
  }, [stockCategory, stockMusic, stockSearch]);

  const groupedStockMusic = useMemo(() => {
    const groupMap = new Map<string, StockAudioTrack[]>();
    filteredStockMusic.forEach((track) => {
      if (!groupMap.has(track.category)) {
        groupMap.set(track.category, []);
      }
      groupMap.get(track.category)?.push(track);
    });
    const order =
      stockCategory === "All"
        ? stockCategories.slice(1)
        : [stockCategory];
    return order
      .filter((category) => groupMap.has(category))
      .map((category) => ({
        category,
        tracks: groupMap.get(category) ?? [],
      }));
  }, [filteredStockMusic, stockCategories, stockCategory]);

  const stockTagCandidates = stockCategories.slice(1);
  const maxStockTagCount = 4;
  const visibleStockTags = showAllStockTags
    ? stockTagCandidates
    : stockTagCandidates.slice(0, maxStockTagCount);
  const hasMoreStockTags = stockTagCandidates.length > maxStockTagCount;

  useEffect(() => {
    if (stockCategory !== "All" && !stockCategories.includes(stockCategory)) {
      setStockCategory("All");
    }
  }, [stockCategories, stockCategory]);

  const stockVideoCategories = useMemo(() => {
    const categories = Array.from(
      new Set(stockVideoItems.map((item) => item.category))
    )
      .filter((category) => !isOrientationLabel(category))
      .sort((a, b) => a.localeCompare(b));
    return ["All", ...categories];
  }, [stockVideoItems]);

  const filteredStockVideos = useMemo(() => {
    const query = stockVideoSearch.trim().toLowerCase();
    return stockVideoItems.filter((item) => {
      const matchesCategory =
        stockVideoCategory === "All" || item.category === stockVideoCategory;
      if (!matchesCategory) {
        return false;
      }
      if (stockVideoOrientation !== "all") {
        const orientation =
          item.orientation ??
          resolveStockVideoOrientationFromPath(item.path);
        if (orientation !== stockVideoOrientation) {
          return false;
        }
      }
      if (!query) {
        return true;
      }
      return (
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
      );
    });
  }, [
    stockVideoCategory,
    stockVideoItems,
    stockVideoOrientation,
    stockVideoSearch,
  ]);

  const groupedStockVideos = useMemo(() => {
    const groupMap = new Map<string, StockVideoItem[]>();
    filteredStockVideos.forEach((item) => {
      if (!groupMap.has(item.category)) {
        groupMap.set(item.category, []);
      }
      groupMap.get(item.category)?.push(item);
    });
    const order =
      stockVideoCategory === "All"
        ? stockVideoCategories.slice(1)
        : [stockVideoCategory];
    return order
      .filter((category) => groupMap.has(category))
      .map((category) => ({
        category,
        videos: groupMap.get(category) ?? [],
      }));
  }, [filteredStockVideos, stockVideoCategories, stockVideoCategory]);

  const stockVideoTagCandidates = stockVideoCategories.slice(1);
  const maxStockVideoTagCount = 4;
  const visibleStockVideoTags = showAllStockVideoTags
    ? stockVideoTagCandidates
    : stockVideoTagCandidates.slice(0, maxStockVideoTagCount);
  const hasMoreStockVideoTags =
    stockVideoTagCandidates.length > maxStockVideoTagCount;
  const previewStockVideoCount = 6;
  const previewStockVideos = useMemo(
    () => filteredStockVideos.slice(0, previewStockVideoCount),
    [filteredStockVideos]
  );
  const hasMoreStockVideos = filteredStockVideos.length > previewStockVideoCount;

  useEffect(() => {
    if (
      stockVideoCategory !== "All" &&
      !stockVideoCategories.includes(stockVideoCategory)
    ) {
      setStockVideoCategory("All");
    }
  }, [stockVideoCategories, stockVideoCategory]);

  const timelineClips = useMemo(() => {
    return timeline
      .map((clip) => {
        const asset = assets.find((item) => item.id === clip.assetId);
        if (!asset) {
          return null;
        }
        return {
          clip,
          asset,
        };
      })
      .filter(Boolean) as { clip: TimelineClip; asset: MediaAsset }[];
  }, [assets, timeline]);

  const timelineLayout = useMemo(() => {
    return timelineClips.map((entry) => ({
      ...entry,
      left: entry.clip.startTime ?? 0,
    }));
  }, [timelineClips]);

  const clipAssetKindMap = useMemo(() => {
    return new Map(
      timelineLayout.map((entry) => [entry.clip.id, entry.asset.kind])
    );
  }, [timelineLayout]);

  useEffect(() => {
    const videoEntries = timelineLayout.filter(
      (entry) => entry.asset.kind === "video"
    );
    const validIds = new Set(videoEntries.map((entry) => entry.clip.id));
    setTimelineThumbnails((prev) => {
      let changed = false;
      const next: Record<string, { key: string; frames: string[] }> = {};
      Object.entries(prev).forEach(([id, value]) => {
        if (validIds.has(id)) {
          next[id] = value;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    if (videoEntries.length === 0) {
      return;
    }
    let cancelled = false;
    const jobId = (thumbnailJobRef.current += 1);
    const buildThumbnails = async () => {
      for (const entry of videoEntries) {
        if (cancelled || thumbnailJobRef.current !== jobId) {
          return;
        }
        const width = Math.max(
          1,
          Math.round(entry.clip.duration * timelineScale)
        );
        const frameCount = getThumbnailCountForWidth(width);
        const key = `${entry.asset.url}:${entry.clip.startOffset}:${entry.clip.duration}:${frameCount}`;
        const existing = timelineThumbnailsRef.current[entry.clip.id];
        if (
          existing &&
          existing.key === key &&
          existing.frames.length === frameCount
        ) {
          continue;
        }
        let frames: string[] = [];
        try {
          frames = await generateVideoThumbnails(
            entry.asset.url,
            entry.clip,
            frameCount,
            () => cancelled || thumbnailJobRef.current !== jobId
          );
        } catch (error) {
          frames = Array.from({ length: frameCount }, () => "");
        }
        if (cancelled || thumbnailJobRef.current !== jobId) {
          return;
        }
        const normalizedFrames =
          frames.length === frameCount
            ? frames
            : Array.from({ length: frameCount }, (_, index) =>
                frames[index] ?? ""
              );
        setTimelineThumbnails((prev) => ({
          ...prev,
          [entry.clip.id]: {
            key,
            frames: normalizedFrames,
          },
        }));
      }
    };
    void buildThumbnails();
    return () => {
      cancelled = true;
    };
  }, [timelineLayout, timelineScale]);

  const getClipMinSize = useCallback(
    (clipId: string) => {
      const kind = clipAssetKindMap.get(clipId);
      return kind === "text" ? textMinLayerSize : minLayerSize;
    },
    [clipAssetKindMap, textMinLayerSize]
  );

  const laneIndexMap = useMemo(() => {
    return new Map(lanes.map((lane, index) => [lane.id, index]));
  }, [lanes]);

  useEffect(() => {
    if (timelineLayout.length === 0) {
      return;
    }
    setClipSettings((prev) => {
      let changed = false;
      const next = { ...prev };
      timelineLayout.forEach((entry) => {
        if (entry.asset.kind !== "video") {
          return;
        }
        if (next[entry.clip.id]) {
          return;
        }
        next[entry.clip.id] = createDefaultVideoSettings();
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [timelineLayout]);

  useEffect(() => {
    if (timelineLayout.length === 0) {
      return;
    }
    setTextSettings((prev) => {
      let changed = false;
      const next = { ...prev };
      timelineLayout.forEach((entry) => {
        if (entry.asset.kind !== "text") {
          return;
        }
        if (next[entry.clip.id]) {
          return;
        }
        next[entry.clip.id] = createDefaultTextSettings();
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [timelineLayout]);

  useEffect(() => {
    setClipOrder((prev) => {
      const validIds = new Set(timelineLayout.map((entry) => entry.clip.id));
      const existing = Object.entries(prev)
        .filter(([id]) => validIds.has(id))
        .sort((a, b) => a[1] - b[1]);
      const next: Record<string, number> = {};
      existing.forEach(([id], index) => {
        next[id] = index;
      });
      let order = existing.length;
      timelineLayout.forEach((entry) => {
        if (next[entry.clip.id] !== undefined) {
          return;
        }
        next[entry.clip.id] = order;
        order += 1;
      });
      const prevIds = Object.keys(prev).filter((id) => validIds.has(id));
      if (prevIds.length === Object.keys(next).length) {
        const unchanged = Object.entries(next).every(
          ([id, value]) => prev[id] === value
        );
        if (unchanged) {
          return prev;
        }
      }
      return next;
    });
  }, [timelineLayout]);


  const getClipAtTime = useCallback(
    (time: number, kind: "visual" | "audio") => {
      const candidates = timelineLayout.filter((entry) => {
        const isAudio = entry.asset.kind === "audio";
        if (kind === "visual" && isAudio) {
          return false;
        }
        if (kind === "audio" && !isAudio) {
          return false;
        }
        return time >= entry.left && time < entry.left + entry.clip.duration;
      });
      const pickTop = (items: TimelineLayoutEntry[]) =>
        items.reduce((top, entry) => {
          const entryIndex = laneIndexMap.get(entry.clip.laneId) ?? 0;
          const topIndex = laneIndexMap.get(top.clip.laneId) ?? 0;
          return entryIndex >= topIndex ? entry : top;
        });
      if (candidates.length > 0) {
        return pickTop(candidates);
      }
      let nearest: TimelineLayoutEntry | null = null;
      let bestDistance = timelineClipEpsilon + 1;
      timelineLayout.forEach((entry) => {
        const isAudio = entry.asset.kind === "audio";
        if (kind === "visual" && isAudio) {
          return;
        }
        if (kind === "audio" && !isAudio) {
          return;
        }
        const startDistance = Math.abs(entry.left - time);
        if (startDistance <= timelineClipEpsilon && startDistance < bestDistance) {
          bestDistance = startDistance;
          nearest = entry;
        }
        const endDistance = Math.abs(
          entry.left + entry.clip.duration - time
        );
        if (endDistance <= timelineClipEpsilon && endDistance < bestDistance) {
          bestDistance = endDistance;
          nearest = entry;
        }
      });
      return nearest;
    },
    [timelineLayout, laneIndexMap]
  );

  const firstClipEntry = useMemo(() => {
    if (timelineLayout.length === 0) {
      return null;
    }
    return timelineLayout.reduce((first, entry) =>
      entry.left < first.left ? entry : first
    );
  }, [timelineLayout]);

  const visualClipEntry = useMemo(
    () => getClipAtTime(currentTime, "visual"),
    [currentTime, getClipAtTime]
  );

  const audioClipEntry = useMemo(
    () => getClipAtTime(currentTime, "audio"),
    [currentTime, getClipAtTime]
  );

  const activeClipEntry = visualClipEntry ?? audioClipEntry;
  const activeAsset = activeClipEntry?.asset ?? null;
  const selectedEntry = useMemo(() => {
    const id = activeCanvasClipId ?? selectedClipId;
    if (!id) {
      return null;
    }
    return timelineLayout.find((entry) => entry.clip.id === id) ?? null;
  }, [activeCanvasClipId, selectedClipId, timelineLayout]);
  const floatingMenuEntry = useMemo(() => {
    if (!floatingMenu.clipId) {
      return null;
    }
    return (
      timelineLayout.find((entry) => entry.clip.id === floatingMenu.clipId) ??
      null
    );
  }, [floatingMenu.clipId, timelineLayout]);
  const timelineContextMenuEntry = useMemo(() => {
    if (!timelineContextMenu.clipId) {
      return null;
    }
    return (
      timelineLayout.find((entry) => entry.clip.id === timelineContextMenu.clipId) ??
      null
    );
  }, [timelineContextMenu.clipId, timelineLayout]);
  const timelineContextMenuSettings = useMemo(() => {
    if (!timelineContextMenuEntry || (timelineContextMenuEntry.asset.kind !== "video" && timelineContextMenuEntry.asset.kind !== "audio")) {
      return null;
    }
    return clipSettings[timelineContextMenuEntry.clip.id] ?? fallbackVideoSettings;
  }, [clipSettings, fallbackVideoSettings, timelineContextMenuEntry]);
  const selectedVideoEntry = useMemo(() => {
    if (selectedEntry?.asset.kind === "video") {
      return selectedEntry;
    }
    return null;
  }, [selectedEntry]);
  const selectedAudioEntry = useMemo(() => {
    if (selectedEntry?.asset.kind === "audio") {
      return selectedEntry;
    }
    return null;
  }, [selectedEntry]);
  const selectedTextEntry = useMemo(() => {
    if (selectedEntry?.asset.kind === "text") {
      return selectedEntry;
    }
    return null;
  }, [selectedEntry]);
  const selectedVideoSettings = useMemo(() => {
    if (!selectedVideoEntry) {
      return null;
    }
    return clipSettings[selectedVideoEntry.clip.id] ?? fallbackVideoSettings;
  }, [clipSettings, fallbackVideoSettings, selectedVideoEntry]);
  const selectedAudioSettings = useMemo(() => {
    if (!selectedAudioEntry) {
      return null;
    }
    return clipSettings[selectedAudioEntry.clip.id] ?? fallbackVideoSettings;
  }, [clipSettings, fallbackVideoSettings, selectedAudioEntry]);
  const selectedTextSettings = useMemo(() => {
    if (!selectedTextEntry) {
      return null;
    }
    return textSettings[selectedTextEntry.clip.id] ?? fallbackTextSettings;
  }, [fallbackTextSettings, selectedTextEntry, textSettings]);
  const floatingVideoSettings = useMemo(() => {
    if (!floatingMenuEntry || floatingMenuEntry.asset.kind !== "video") {
      return null;
    }
    return clipSettings[floatingMenuEntry.clip.id] ?? fallbackVideoSettings;
  }, [clipSettings, fallbackVideoSettings, floatingMenuEntry]);

  useEffect(() => {
    if (!selectedVideoEntry) {
      setVideoPanelView("edit");
      return;
    }
    setClipSettings((prev) => {
      if (prev[selectedVideoEntry.clip.id]) {
        return prev;
      }
      return {
        ...prev,
        [selectedVideoEntry.clip.id]: createDefaultVideoSettings(),
      };
    });
  }, [selectedVideoEntry]);

  useEffect(() => {
    if (!selectedAudioEntry) {
      return;
    }
    setClipSettings((prev) => {
      if (prev[selectedAudioEntry.clip.id]) {
        return prev;
      }
      return {
        ...prev,
        [selectedAudioEntry.clip.id]: createDefaultVideoSettings(),
      };
    });
  }, [selectedAudioEntry]);

  useEffect(() => {
    if (!selectedTextEntry) {
      return;
    }
    setTextSettings((prev) => {
      if (prev[selectedTextEntry.clip.id]) {
        return prev;
      }
      return {
        ...prev,
        [selectedTextEntry.clip.id]: createDefaultTextSettings(),
      };
    });
  }, [selectedTextEntry]);

  useEffect(() => {
    if (!selectedTextEntry || !selectedTextSettings) {
      if (activeTool === "text") {
        setTextPanelView("library");
      }
      return;
    }
    if (activeTool === "text") {
      setTextPanelView("edit");
    }
    setTextPanelPreset(null);
    setTextPanelDraft(selectedTextSettings.text);
    setTextPanelFontFamily(selectedTextSettings.fontFamily);
    setTextPanelFontSizeDisplay(selectedTextSettings.fontSize);
    if (resizeTransformState?.clipId !== selectedTextEntry.clip.id) {
      setTextPanelFontSize(selectedTextSettings.fontSize);
    }
    setTextPanelColor(selectedTextSettings.color);
    setTextPanelBold(selectedTextSettings.bold);
    setTextPanelItalic(selectedTextSettings.italic);
    setTextPanelAlign(selectedTextSettings.align);
    setTextPanelLetterSpacing(selectedTextSettings.letterSpacing);
    setTextPanelLineHeight(selectedTextSettings.lineHeight);
    setTextPanelBackgroundEnabled(selectedTextSettings.backgroundEnabled);
    setTextPanelBackgroundColor(selectedTextSettings.backgroundColor);
    setTextPanelBackgroundStyle(selectedTextSettings.backgroundStyle);
    setTextPanelOutlineEnabled(selectedTextSettings.outlineEnabled);
    setTextPanelOutlineColor(selectedTextSettings.outlineColor);
    setTextPanelOutlineWidth(selectedTextSettings.outlineWidth);
    setTextPanelShadowEnabled(selectedTextSettings.shadowEnabled);
    setTextPanelShadowColor(selectedTextSettings.shadowColor);
    setTextPanelShadowBlur(selectedTextSettings.shadowBlur);
    setTextPanelShadowOpacity(selectedTextSettings.shadowOpacity);
    setTextPanelStylePresetId(null);
    setTextPanelStart(formatTimeWithTenths(selectedTextEntry.clip.startTime));
    setTextPanelEnd(
      formatTimeWithTenths(
        selectedTextEntry.clip.startTime + selectedTextEntry.clip.duration
      )
    );
  }, [activeTool, selectedTextEntry, selectedTextSettings, resizeTransformState]);

  useEffect(() => {
    if (textPanelView === "library") {
      setTextPanelSpacingOpen(false);
      setTextPanelShadowAdvancedOpen(false);
    }
  }, [textPanelView]);

  useEffect(() => {
    if (!editingTextClipId) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      stageTextEditorRef.current?.focus();
      stageTextEditorRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [editingTextClipId]);

  useEffect(() => {
    if (!editingTextClipId) {
      return;
    }
    if (!selectedTextEntry || selectedTextEntry.clip.id !== editingTextClipId) {
      setEditingTextClipId(null);
    }
  }, [editingTextClipId, selectedTextEntry]);

  useEffect(() => {
    if (!floatingMenu.clipId) {
      return;
    }
    const exists = timelineLayout.some(
      (entry) => entry.clip.id === floatingMenu.clipId
    );
    if (!exists) {
      setFloatingMenu(closeFloatingMenuState);
    }
  }, [floatingMenu.clipId, timelineLayout]);

  useEffect(() => {
    if (!timelineContextMenu.clipId) {
      return;
    }
    const exists = timelineLayout.some(
      (entry) => entry.clip.id === timelineContextMenu.clipId
    );
    if (!exists) {
      setTimelineContextMenu(closeTimelineContextMenuState);
    }
  }, [timelineContextMenu.clipId, timelineLayout]);
  const canPlay = Boolean(activeClipEntry || firstClipEntry);
  const hasTimelineClips = timeline.length > 0;
  const showEmptyState = !hasTimelineClips;
  const showVideoPanel = Boolean(selectedVideoEntry && selectedVideoSettings);
  const showAudioPanel = Boolean(selectedAudioEntry && selectedAudioSettings);
  const floatingSubmenuSide = useMemo(() => {
    if (!stageSize.width) {
      return "right";
    }
    const totalWidth =
      floaterMenuWidth + floaterSubmenuWidth + 8;
    return floatingMenu.x + totalWidth > stageSize.width - 8
      ? "left"
      : "right";
  }, [floatingMenu.x, stageSize.width]);
  const floatingSubmenuClass =
    floatingSubmenuSide === "left" ? "right-full mr-2" : "left-full ml-2";
  const timelineContextSubmenuSide = useMemo(() => {
    if (typeof window === "undefined") {
      return "right";
    }
    const totalWidth = timelineContextMenuWidth + floaterSubmenuWidth + 8;
    return timelineContextMenu.x + totalWidth > window.innerWidth - 8
      ? "left"
      : "right";
  }, [timelineContextMenu.x]);
  const timelineContextSubmenuClass =
    timelineContextSubmenuSide === "left" ? "right-full mr-2" : "left-full ml-2";
  const stageSelectionStyle = useMemo(() => {
    if (!stageSelection) {
      return null;
    }
    const { trackRect, startX, currentX, startY, currentY } = stageSelection;
    const left = clamp(
      Math.min(startX, currentX) - trackRect.left,
      0,
      trackRect.width
    );
    const top = clamp(
      Math.min(startY, currentY) - trackRect.top,
      0,
      trackRect.height
    );
    const right = clamp(
      Math.max(startX, currentX) - trackRect.left,
      0,
      trackRect.width
    );
    const bottom = clamp(
      Math.max(startY, currentY) - trackRect.top,
      0,
      trackRect.height
    );
    return {
      left,
      top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
  }, [stageSelection]);

  const visualStack = useMemo(() => {
    const visible = timelineLayout.filter(
      (entry) =>
        entry.asset.kind !== "audio" &&
        currentTime + timelineClipEpsilon >= entry.left &&
        currentTime - timelineClipEpsilon <= entry.left + entry.clip.duration
    );
    return visible.sort((a, b) => {
      const aOrder = clipOrder[a.clip.id] ?? 0;
      const bOrder = clipOrder[b.clip.id] ?? 0;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      const aIndex = laneIndexMap.get(a.clip.laneId) ?? 0;
      const bIndex = laneIndexMap.get(b.clip.laneId) ?? 0;
      if (aIndex === bIndex) {
        return a.left - b.left;
      }
      return aIndex - bIndex;
    });
  }, [timelineLayout, currentTime, laneIndexMap, clipOrder]);


  const audioStack = useMemo(() => {
    const visible = timelineLayout.filter(
      (entry) =>
        entry.asset.kind === "audio" &&
        currentTime + timelineClipEpsilon >= entry.left &&
        currentTime - timelineClipEpsilon <= entry.left + entry.clip.duration
    );
    return visible.sort((a, b) => {
      const aIndex = laneIndexMap.get(a.clip.laneId) ?? 0;
      const bIndex = laneIndexMap.get(b.clip.laneId) ?? 0;
      if (aIndex === bIndex) {
        return a.left - b.left;
      }
      return aIndex - bIndex;
    });
  }, [timelineLayout, currentTime, laneIndexMap]);

  const wasPlayingRef = useRef(false);

  const projectAspectRatio = useMemo<number>(() => {
    const visuals = timelineLayout.filter(
      (entry) => entry.asset.kind !== "audio"
    );
    if (visuals.length === 0) {
      return 16 / 9;
    }
    const sorted = [...visuals].sort((a, b) => {
      const aIndex = laneIndexMap.get(a.clip.laneId) ?? 0;
      const bIndex = laneIndexMap.get(b.clip.laneId) ?? 0;
      if (aIndex === bIndex) {
        return a.left - b.left;
      }
      return aIndex - bIndex;
    });
    return sorted[0].asset.aspectRatio ?? 16 / 9;
  }, [timelineLayout, laneIndexMap]);

  const stageDisplay = useMemo(() => {
    if (stageViewport.width === 0 || stageViewport.height === 0) {
      return { width: 0, height: 0 };
    }
    if (!Number.isFinite(projectAspectRatio) || projectAspectRatio <= 0) {
      return {
        width: stageViewport.width,
        height: stageViewport.height,
      };
    }
    const viewportRatio = stageViewport.width / stageViewport.height;
    if (viewportRatio > projectAspectRatio) {
      const height = stageViewport.height;
      return { width: height * projectAspectRatio, height };
    }
    const width = stageViewport.width;
    return { width, height: width / projectAspectRatio };
  }, [projectAspectRatio, stageViewport.height, stageViewport.width]);

  useEffect(() => {
    if (stageDisplay.width === 0 || stageDisplay.height === 0) {
      return;
    }
    setStageSize((prev) => {
      if (
        Math.abs(prev.width - stageDisplay.width) < 0.5 &&
        Math.abs(prev.height - stageDisplay.height) < 0.5
      ) {
        return prev;
      }
      return {
        width: stageDisplay.width,
        height: stageDisplay.height,
      };
    });
  }, [stageDisplay.height, stageDisplay.width]);

  const stageAspectRatio = useMemo<number>(() => {
    if (stageSize.width > 0 && stageSize.height > 0) {
      return stageSize.width / stageSize.height;
    }
    return projectAspectRatio;
  }, [stageSize, projectAspectRatio]);

  useEffect(() => {
    stageAspectRatioRef.current = stageAspectRatio;
  }, [stageAspectRatio]);

  const baseVisualEntry = useMemo(() => {
    if (visualClipEntry && visualClipEntry.asset.kind !== "audio") {
      return visualClipEntry;
    }
    const visuals = timelineLayout.filter(
      (entry) => entry.asset.kind !== "audio"
    );
    if (visuals.length === 0) {
      return null;
    }
    return visuals.reduce((first, entry) =>
      entry.left < first.left ? entry : first
    );
  }, [timelineLayout, visualClipEntry]);

  const resolveBackgroundTransform = useCallback(
    (clipId: string, asset: MediaAsset) => {
      return (
        backgroundTransforms[clipId] ??
        createDefaultTransform(asset.aspectRatio, stageAspectRatio)
      );
    },
    [backgroundTransforms, stageAspectRatio]
  );

  const baseBackgroundTransform = useMemo(() => {
    if (!baseVisualEntry) {
      return null;
    }
    return resolveBackgroundTransform(
      baseVisualEntry.clip.id,
      baseVisualEntry.asset
    );
  }, [baseVisualEntry, resolveBackgroundTransform]);

  useEffect(() => {
    if (timelineClips.length === 0) {
      return;
    }
    if (stageSize.width === 0 || stageSize.height === 0) {
      return;
    }
    setBackgroundTransforms((prev) => {
      let changed = false;
      const next = { ...prev };
      timelineClips.forEach(({ clip, asset }) => {
        if (asset.kind === "audio" || next[clip.id]) {
          return;
        }
        next[clip.id] = createDefaultTransform(
          asset.aspectRatio,
          stageAspectRatio
        );
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [timelineClips, stageAspectRatio]);

  useEffect(() => {
    if (timelineLayout.length === 0) {
      return;
    }
    if (stageSize.width === 0 || stageSize.height === 0) {
      return;
    }
    setClipTransforms((prev) => {
      let changed = false;
      const next = { ...prev };
      timelineLayout.forEach((entry) => {
        if (entry.asset.kind !== "text") {
          return;
        }
        if (
          resizeTransformState?.clipId === entry.clip.id ||
          dragTransformState?.clipId === entry.clip.id
        ) {
          return;
        }
        const settings = textSettings[entry.clip.id] ?? fallbackTextSettings;
        if (settings.autoSize === false) {
          return;
        }
        const bounds = measureTextBounds(settings);
        const scaleXValue = settings.boxScaleX ?? 1;
        const scaleX = Number.isFinite(scaleXValue)
          ? Math.max(0.1, scaleXValue)
          : 1;
        const scaleYValue = settings.boxScaleY ?? 1;
        const scaleY = Number.isFinite(scaleYValue)
          ? Math.max(0.1, scaleYValue)
          : 1;
        const width = clamp(
          (bounds.width * scaleX) / stageSize.width,
          0.02,
          1
        );
        const height = clamp(
          (bounds.height * scaleY) / stageSize.height,
          0.02,
          1
        );
        const base =
          prev[entry.clip.id] ?? createDefaultTextTransform(stageAspectRatio);
        const centerX = base.x + base.width / 2;
        const centerY = base.y + base.height / 2;
        const fitted = clampTransformToStage(
          {
            x: centerX - width / 2,
            y: centerY - height / 2,
            width,
            height,
          },
          { width: stageSize.width, height: stageSize.height },
          textMinLayerSize
        );
        const current = prev[entry.clip.id];
        if (
          !current ||
          Math.abs(current.width - fitted.width) > 0.002 ||
          Math.abs(current.height - fitted.height) > 0.002 ||
          Math.abs(current.x - fitted.x) > 0.002 ||
          Math.abs(current.y - fitted.y) > 0.002
        ) {
          next[entry.clip.id] = fitted;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [
    dragTransformState,
    fallbackTextSettings,
    resizeTransformState,
    stageAspectRatio,
    stageSize.height,
    stageSize.width,
    textSettings,
    fontLoadTick,
    textMinLayerSize,
    timelineLayout,
  ]);

  const timelineTotal = useMemo(() => {
    return timeline.reduce(
      (max, clip) =>
        Math.max(max, (clip.startTime ?? 0) + clip.duration),
      0
    );
  }, [timeline]);

  const timelineDuration = useMemo(() => {
    return Math.max(10, Math.ceil(timelineTotal + 1));
  }, [timelineTotal]);

  const tickStep = useMemo(() => {
    if (timelineDuration <= 60) {
      return 5;
    }
    if (timelineDuration <= 300) {
      return 10;
    }
    if (timelineDuration <= 600) {
      return 30;
    }
    if (timelineDuration <= 3600) {
      return 60;
    }
    if (timelineDuration <= 7200) {
      return 300;
    }
    return 600;
  }, [timelineDuration]);

  const tickLabelStride = useMemo(() => {
    const minLabelPx = timelineDuration <= 60 ? 32 : 56;
    const pxPerTick = timelineScale * tickStep;
    if (pxPerTick <= 0) {
      return 1;
    }
    return Math.max(1, Math.ceil(minLabelPx / pxPerTick));
  }, [timelineDuration, timelineScale, tickStep]);

  const laneRows = useMemo(() => {
    const counts: Record<LaneType, number> = {
      video: 0,
      audio: 0,
      text: 0,
    };
    return lanes.map((lane) => {
      counts[lane.type] += 1;
      const baseLabel =
        lane.type.charAt(0).toUpperCase() + lane.type.slice(1);
      const label =
        counts[lane.type] === 1
          ? baseLabel
          : `${baseLabel} ${counts[lane.type]}`;
      return {
        id: lane.id,
        type: lane.type,
        label,
        height: laneHeights[lane.type],
      };
    });
  }, [lanes]);

  const dragPreview = useMemo(() => {
    if (!dragClipState) {
      return null;
    }
    const clip = timeline.find((item) => item.id === dragClipState.clipId);
    if (!clip) {
      return null;
    }
    return {
      laneId:
        dragClipState.previewLaneId ??
        dragClipState.targetLaneId ??
        dragClipState.startLaneId,
      startTime: dragClipState.previewTime ?? clip.startTime,
      duration: clip.duration,
    };
  }, [dragClipState, timeline]);

  const laneBounds = useMemo(() => {
    const bounds = new Map<string, { top: number; bottom: number }>();
    let cursor = 0;
    laneRows.forEach((lane) => {
      bounds.set(lane.id, { top: cursor, bottom: cursor + lane.height });
      cursor += lane.height + laneGap;
    });
    return bounds;
  }, [laneRows]);

  const lanesHeight = useMemo(() => {
    if (laneRows.length === 0) {
      return 0;
    }
    const total = laneRows.reduce((sum, lane) => sum + lane.height, 0);
    return total + (laneRows.length - 1) * laneGap;
  }, [laneRows]);

  const trackMinHeight = useMemo(() => {
    if (laneRows.length === 0) {
      return 120;
    }
    return lanesHeight + 80;
  }, [laneRows.length, lanesHeight]);

  const timelineMinHeight = useMemo(() => 160, []);

  const timelineMaxHeight = useMemo(() => {
    if (!mainHeight) {
      return Math.max(timelineMinHeight, timelineHeight);
    }
    return Math.max(timelineMinHeight, mainHeight - minCanvasHeight);
  }, [mainHeight, timelineHeight, timelineMinHeight]);

  const isResizingTimeline = Boolean(timelineResizeState);

  // Dynamic frame step based on zoom level - larger steps when zoomed out, precise frames when zoomed in
  const dynamicFrameStep = useMemo(() => {
    // Target: each click moves roughly 30-50 pixels worth of time on the timeline
    const targetPixels = 40;
    const rawStep = targetPixels / timelineScale;

    // Snap to intuitive increments for better UX
    if (rawStep <= frameStepSeconds * 1.5) return frameStepSeconds; // Single frame (~0.033s)
    if (rawStep <= 0.08) return frameStepSeconds * 2; // 2 frames
    if (rawStep <= 0.15) return 0.1;   // ~3 frames
    if (rawStep <= 0.35) return 0.25;  // Quarter second
    if (rawStep <= 0.75) return 0.5;   // Half second
    if (rawStep <= 1.5) return 1;      // 1 second
    if (rawStep <= 3) return 2;        // 2 seconds
    if (rawStep <= 7) return 5;        // 5 seconds
    return 10;                         // 10 seconds for very zoomed out
  }, [timelineScale]);

  // Format the step for display in tooltips
  const frameStepLabel = useMemo(() => {
    if (dynamicFrameStep <= frameStepSeconds * 1.5) return "1 frame";
    if (dynamicFrameStep <= frameStepSeconds * 2.5) return "2 frames";
    if (dynamicFrameStep < 0.2) return `${Math.round(dynamicFrameStep * 30)} frames`;
    if (dynamicFrameStep < 1) return `${dynamicFrameStep}s`;
    return `${dynamicFrameStep}s`;
  }, [dynamicFrameStep]);

  const selectedRange = useMemo(() => {
    if (selectedClipIds.length === 0) {
      return null;
    }
    const selectedEntries = timelineLayout.filter((entry) =>
      selectedClipIdsSet.has(entry.clip.id)
    );
    if (selectedEntries.length === 0) {
      return null;
    }
    const start = Math.min(
      ...selectedEntries.map((entry) => entry.left ?? 0)
    );
    const end = Math.max(
      ...selectedEntries.map((entry) => entry.left + entry.clip.duration)
    );
    return { start, end };
  }, [selectedClipIds, selectedClipIdsSet, timelineLayout]);

  const selectionRangeLabel = useMemo(() => {
    if (!selectedRange) {
      return null;
    }
    return `${formatTimelineLabel(selectedRange.start)} - ${formatTimelineLabel(
      selectedRange.end
    )}`;
  }, [selectedRange]);

  // Check if selected clips can be fused (adjacent clips from same source that form continuous video)
  const fusableClips = useMemo(() => {
    if (selectedClipIds.length < 2) {
      return null;
    }
    // Get selected clip entries sorted by their position on timeline
    const selectedEntries = timelineLayout
      .filter((entry) => selectedClipIdsSet.has(entry.clip.id))
      .sort((a, b) => a.left - b.left);

    if (selectedEntries.length !== 2) {
      return null; // Only support fusing exactly 2 clips for now
    }

    const [first, second] = selectedEntries;
    const firstClip = first.clip;
    const secondClip = second.clip;

    // Must be from the same asset
    if (firstClip.assetId !== secondClip.assetId) {
      return null;
    }

    // Must be on the same lane
    if (firstClip.laneId !== secondClip.laneId) {
      return null;
    }

    // Must be adjacent on the timeline (within small tolerance for floating point)
    const gap = Math.abs(second.left - (first.left + firstClip.duration));
    if (gap > 0.01) {
      return null;
    }

    // Must be continuous in source media (second clip starts where first ends in source)
    const expectedOffset = firstClip.startOffset + firstClip.duration;
    if (Math.abs(secondClip.startOffset - expectedOffset) > 0.01) {
      return null;
    }

    return { first: firstClip, second: secondClip };
  }, [selectedClipIds, selectedClipIdsSet, timelineLayout]);

  const canFuseClips = fusableClips !== null;

  const handleFitTimeline = useCallback(() => {
    const scrollEl = timelineScrollRef.current;
    if (!scrollEl) {
      return;
    }
    const availableWidth = Math.max(
      120,
      scrollEl.clientWidth - timelinePadding * 2
    );
    const nextScale = clamp(
      availableWidth / Math.max(1, timelineDuration),
      timelineScaleMin,
      timelineScaleMax
    );
    setTimelineScale(nextScale);
    scrollEl.scrollLeft = 0;
  }, [timelineDuration]);

  const handleTimelineResizeStart = (
    event: PointerEvent<HTMLDivElement>
  ) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setTimelineResizeState({
      startY: event.clientY,
      startHeight: timelineHeight,
    });
  };

  const getSelectionIds = useCallback(
    (selection: RangeSelectionState) => {
      const { trackRect, startX, currentX, startY, currentY } = selection;
      const maxX = timelineDuration * timelineScale;
      const selectionLeft = clamp(
        Math.min(startX, currentX) - trackRect.left - timelinePadding,
        0,
        maxX
      );
      const selectionRight = clamp(
        Math.max(startX, currentX) - trackRect.left - timelinePadding,
        0,
        maxX
      );
      const selectionTop = clamp(
        Math.min(startY, currentY) - trackRect.top - timelinePadding,
        0,
        lanesHeight
      );
      const selectionBottom = clamp(
        Math.max(startY, currentY) - trackRect.top - timelinePadding,
        0,
        lanesHeight
      );
      if (selectionRight <= selectionLeft || selectionBottom <= selectionTop) {
        return selection.additive ? selection.originSelection : [];
      }
      const selected = timelineLayout
        .filter((entry) => {
          const bounds = laneBounds.get(entry.clip.laneId);
          if (!bounds) {
            return false;
          }
          const intersectsY =
            selectionBottom >= bounds.top && selectionTop <= bounds.bottom;
          if (!intersectsY) {
            return false;
          }
          const clipLeft = entry.left * timelineScale;
          const clipRight = clipLeft + entry.clip.duration * timelineScale;
          return clipRight >= selectionLeft && clipLeft <= selectionRight;
        })
        .map((entry) => entry.clip.id);
      if (!selection.additive) {
        return selected;
      }
      return Array.from(new Set([...selection.originSelection, ...selected]));
    },
    [
      laneBounds,
      lanesHeight,
      timelineDuration,
      timelineLayout,
      timelineScale,
    ]
  );

  const handleTimelineSelectStart = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-timeline-clip="true"]')) {
      return;
    }
    const track = timelineTrackRef.current;
    if (!track) {
      return;
    }
    event.preventDefault();
    const rect = track.getBoundingClientRect();
    setRangeSelection({
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      trackRect: rect,
      additive: event.shiftKey,
      originSelection: event.shiftKey ? selectedClipIds : [],
    });
  };

  const handleDownloadSelection = () => {
    if (!selectedRange) {
      return;
    }
    const payload = {
      start: selectedRange.start,
      end: selectedRange.end,
      clips: selectedClipIds,
    };
    console.log("Download selection", payload);
  };

  const handleScrubToTime = useCallback(
    (nextTime: number) => {
      const clampedTime = clamp(nextTime, 0, timelineDuration);
      const entry =
        getClipAtTime(clampedTime, "visual") ??
        getClipAtTime(clampedTime, "audio");
      if (entry) {
        const element =
          entry.asset.kind === "audio"
            ? audioRefs.current.get(entry.clip.id)
            : visualRefs.current.get(entry.clip.id);
        const clipTime = clamp(
          clampedTime - entry.clip.startTime + entry.clip.startOffset,
          entry.clip.startOffset,
          entry.clip.startOffset + entry.clip.duration
        );
        if (element) {
          element.currentTime = clipTime;
        }
        setSelectedClipId(entry.clip.id);
        setSelectedClipIds([entry.clip.id]);
        setActiveAssetId(entry.asset.id);
      }
      setCurrentTime(clampedTime);
    },
    [getClipAtTime, timelineDuration]
  );

  const handleScrubTo = (clientX: number) => {
    const track = timelineTrackRef.current;
    if (!track) {
      return;
    }
    const rect = track.getBoundingClientRect();
    const rawX = clientX - rect.left - timelinePadding;
    const maxX = timelineDuration * timelineScale;
    const clampedX = clamp(rawX, 0, maxX);
    const nextTime = clampedX / timelineScale;
    handleScrubToTime(nextTime);
  };

  const handlePlayheadPointerDown = (
    event: PointerEvent<HTMLButtonElement>
  ) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    scrubPointerIdRef.current = event.pointerId;
    scrubPointerTargetRef.current = event.currentTarget;
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setIsScrubbing(true);
    if (isPlaying) {
      handleTogglePlayback();
    }
    handleScrubTo(event.clientX);
  };

  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    let frameId = 0;
    let last = performance.now();
    const tick = (timestamp: number) => {
      const deltaSeconds = (timestamp - last) / 1000;
      last = timestamp;
      setCurrentTime((prev) => {
        const next = prev + deltaSeconds;
        if (next >= timelineTotal) {
          setIsPlaying(false);
          return timelineTotal;
        }
        return next;
      });
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [isPlaying, timelineTotal]);

  useEffect(() => {
    if (!isPlaying || wasPlayingRef.current) {
      wasPlayingRef.current = isPlaying;
      return;
    }
    visualStack.forEach((entry) => {
      if (entry.asset.kind !== "video") {
        return;
      }
      const element = visualRefs.current.get(entry.clip.id);
      if (!element) {
        return;
      }
      const clipTime = clamp(
        currentTime - entry.clip.startTime + entry.clip.startOffset,
        entry.clip.startOffset,
        entry.clip.startOffset + entry.clip.duration
      );
      element.currentTime = clipTime;
    });
    audioStack.forEach((entry) => {
      const element = audioRefs.current.get(entry.clip.id);
      if (!element) {
        return;
      }
      const clipTime = clamp(
        currentTime - entry.clip.startTime + entry.clip.startOffset,
        entry.clip.startOffset,
        entry.clip.startOffset + entry.clip.duration
      );
      element.currentTime = clipTime;
    });
    wasPlayingRef.current = true;
  }, [isPlaying, visualStack, audioStack, currentTime]);

  useEffect(() => {
    const visibleIds = new Set(visualStack.map((entry) => entry.clip.id));
    visualRefs.current.forEach((element, clipId) => {
      if (!element || visibleIds.has(clipId)) {
        return;
      }
      element.pause();
    });
    visualStack.forEach((entry) => {
      if (entry.asset.kind !== "video") {
        return;
      }
      const element = visualRefs.current.get(entry.clip.id);
      if (!element) {
        return;
      }
      const settings = clipSettings[entry.clip.id] ?? fallbackVideoSettings;
      const baseVolume = clamp(settings.volume / 100, 0, 1);
      const localTime = clamp(
        currentTime - entry.clip.startTime,
        0,
        entry.clip.duration
      );
      let fadeGain = 1;
      if (settings.fadeEnabled) {
        const fadeIn = settings.fadeIn > 0 ? settings.fadeIn : 0;
        const fadeOut = settings.fadeOut > 0 ? settings.fadeOut : 0;
        const fadeInGain =
          fadeIn > 0 ? clamp(localTime / fadeIn, 0, 1) : 1;
        const fadeOutGain =
          fadeOut > 0
            ? clamp((entry.clip.duration - localTime) / fadeOut, 0, 1)
            : 1;
        fadeGain = Math.min(fadeInGain, fadeOutGain);
      }
      element.playbackRate = clamp(settings.speed, 0.1, 4);
      element.muted = settings.muted;
      element.volume = settings.muted ? 0 : baseVolume * fadeGain;
      if (isPlaying) {
        if (element.paused) {
          const clipTime = clamp(
            currentTime - entry.clip.startTime + entry.clip.startOffset,
            entry.clip.startOffset,
            entry.clip.startOffset + entry.clip.duration
          );
          if (Math.abs(element.currentTime - clipTime) > 0.05) {
            element.currentTime = clipTime;
          }
          const playPromise = element.play();
          if (playPromise) {
            playPromise.catch(() => setIsPlaying(false));
          }
        }
      } else {
        element.pause();
      }
      if (!isPlaying) {
        const clipTime = clamp(
          currentTime - entry.clip.startTime + entry.clip.startOffset,
          entry.clip.startOffset,
          entry.clip.startOffset + entry.clip.duration
        );
        if (Math.abs(element.currentTime - clipTime) > 0.05) {
          element.currentTime = clipTime;
        }
      }
    });
  }, [visualStack, currentTime, isPlaying, clipSettings, fallbackVideoSettings]);

  useEffect(() => {
    const visibleIds = new Set(audioStack.map((entry) => entry.clip.id));
    audioRefs.current.forEach((element, clipId) => {
      if (!element || visibleIds.has(clipId)) {
        return;
      }
      element.pause();
    });
    audioStack.forEach((entry) => {
      const element = audioRefs.current.get(entry.clip.id);
      if (!element) {
        return;
      }
      const settings = clipSettings[entry.clip.id] ?? fallbackVideoSettings;
      const baseVolume = clamp(settings.volume / 100, 0, 1);
      element.muted = settings.muted;
      element.volume = settings.muted ? 0 : baseVolume;
      if (isPlaying) {
        if (element.paused) {
          const clipTime = clamp(
            currentTime - entry.clip.startTime + entry.clip.startOffset,
            entry.clip.startOffset,
            entry.clip.startOffset + entry.clip.duration
          );
          if (Math.abs(element.currentTime - clipTime) > 0.05) {
            element.currentTime = clipTime;
          }
          const playPromise = element.play();
          if (playPromise) {
            playPromise.catch(() => setIsPlaying(false));
          }
        }
      } else {
        element.pause();
      }
      if (!isPlaying) {
        const clipTime = clamp(
          currentTime - entry.clip.startTime + entry.clip.startOffset,
          entry.clip.startOffset,
          entry.clip.startOffset + entry.clip.duration
        );
        if (Math.abs(element.currentTime - clipTime) > 0.05) {
          element.currentTime = clipTime;
        }
      }
    });
  }, [audioStack, currentTime, isPlaying, clipSettings, fallbackVideoSettings]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const buildAssetsFromFiles = async (files: File[]) =>
    Promise.all(
      files.map(async (file) => {
        const kind = inferMediaKind(file);
        const url = URL.createObjectURL(file);
        const meta = await getMediaMeta(kind, url);
        const resolvedAspectRatio =
          meta.aspectRatio ??
          (meta.width && meta.height ? meta.width / meta.height : undefined);
        return {
          id: crypto.randomUUID(),
          name: file.name,
          kind,
          url,
          size: file.size,
          duration: meta.duration,
          width: meta.width,
          height: meta.height,
          aspectRatio: resolvedAspectRatio,
          createdAt: Date.now(),
        };
      })
    );

  const resolveDropLaneId = (
    laneType: LaneType,
    offsetY: number,
    draftLanes: TimelineLane[]
  ) => {
    const rows = draftLanes.map((lane) => ({
      id: lane.id,
      type: lane.type,
      height: laneHeights[lane.type],
    }));
    if (rows.length === 0) {
      return createLaneId(laneType, draftLanes);
    }
    let laneId: string | null = null;
    let foundLaneIndex = -1;
    let cursor = 0;
    
    // Calculate section boundaries
    let videoSectionEnd = 0;
    let audioSectionStart = -1;
    let sectionCursor = 0;
    for (let i = 0; i < rows.length; i++) {
      const lane = rows[i];
      if (lane.type !== "audio") {
        videoSectionEnd = sectionCursor + lane.height + laneGap;
      } else if (audioSectionStart === -1) {
        audioSectionStart = sectionCursor;
      }
      sectionCursor += lane.height + laneGap;
    }
    const totalHeight = sectionCursor - laneGap;

    if (offsetY < 0) {
      // Dragging above all lanes - create new lane
      laneId = createLaneId(laneType, draftLanes);
    } else if (offsetY > totalHeight + laneGap) {
      // Dragging below all lanes - create new lane (will be positioned correctly)
      laneId = createLaneId(laneType, draftLanes);
    } else {
      // Find which lane we're hovering over
      for (let i = 0; i < rows.length; i++) {
        const lane = rows[i];
        const laneTop = cursor;
        const laneBottom = cursor + lane.height + laneGap;
        if (offsetY >= laneTop && offsetY <= laneBottom) {
          laneId = lane.id;
          foundLaneIndex = i;
          break;
        }
        cursor += lane.height + laneGap;
      }
      
      // Check if in gap between video and audio section
      if (!laneId && laneType !== "audio" && audioSectionStart > 0) {
        if (offsetY >= videoSectionEnd && offsetY < audioSectionStart) {
          laneId = createLaneId(laneType, draftLanes);
        }
      }
    }
    // Check lane type compatibility - enforce lane ordering rules
    // Audio lanes stay at bottom, video/text lanes stay above audio
    if (laneId && foundLaneIndex >= 0) {
      const foundLane = rows[foundLaneIndex];
      if (foundLane && foundLane.type !== laneType) {
        // Lane type mismatch - create new lane in correct position
        let compatibleLaneId: string | null = null;
        
        if (laneType === "audio") {
          // Audio clips can only go to audio lanes (at bottom) - search below
          for (let i = foundLaneIndex + 1; i < rows.length; i++) {
            if (rows[i].type === "audio") {
              compatibleLaneId = rows[i].id;
              break;
            }
          }
        }
        // For video/text on audio lane, just create new lane
        
        // If no compatible lane found, create a new one (will be inserted at correct position)
        if (!compatibleLaneId) {
          compatibleLaneId = createLaneId(laneType, draftLanes);
        }
        
        laneId = compatibleLaneId;
      }
    }
    if (!laneId) {
      laneId = createLaneId(laneType, draftLanes);
    }
    return laneId;
  };

  const handleDroppedFiles = async (
    files: File[],
    options: { target: "canvas" | "timeline"; event?: DragEvent<HTMLDivElement> }
  ) => {
    if (files.length === 0) {
      return;
    }
    setIsBackgroundSelected(false);
    pushHistory();
    setUploading(true);
    try {
      const newAssets = await buildAssetsFromFiles(files);
      const nextLanes = [...lanesRef.current];
      const newClips: TimelineClip[] = [];
      let baseStartTime = currentTime;
      let offsetY = 0;
      if (options.target === "timeline" && options.event) {
        const track = timelineTrackRef.current;
        if (track) {
          const rect = track.getBoundingClientRect();
          const offsetX =
            options.event.clientX - rect.left - timelinePadding;
          offsetY = options.event.clientY - rect.top - timelinePadding;
          baseStartTime = offsetX / timelineScale;
        }
      }
      newAssets.forEach((asset, index) => {
        const laneType = getLaneType(asset);
        const laneId =
          options.target === "timeline"
            ? resolveDropLaneId(laneType, offsetY, nextLanes)
            : createLaneId(laneType, nextLanes);
        const startTime = baseStartTime + index * snapInterval;
        newClips.push(createClip(asset.id, laneId, startTime, asset));
      });
      setLanes(nextLanes);
      setAssets((prev) => [...newAssets, ...prev]);
      setActiveAssetId((prev) => newAssets[0]?.id ?? prev ?? null);
      setTimeline((prev) => [...prev, ...newClips]);
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }
    setIsBackgroundSelected(false);
    pushHistory();
    setUploading(true);
    try {
      const newAssets = await buildAssetsFromFiles(files);
      const nextLanes = [...lanesRef.current];
      const newClips = newAssets.map((asset) => {
        const laneType = getLaneType(asset);
        const laneId = createLaneId(laneType, nextLanes);
        return createClip(asset.id, laneId, 0, asset);
      });
      setLanes(nextLanes);
      setAssets((prev) => [...newAssets, ...prev]);
      setActiveAssetId((prev) => newAssets[0]?.id ?? prev ?? null);
      setTimeline((prev) => [...prev, ...newClips]);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleTogglePlayback = () => {
    if (!activeClipEntry) {
      if (firstClipEntry) {
        setCurrentTime(firstClipEntry.clip.startTime);
        setSelectedClipId(firstClipEntry.clip.id);
        setSelectedClipIds([firstClipEntry.clip.id]);
        setActiveAssetId(firstClipEntry.asset.id);
        setIsPlaying(true);
      }
      return;
    }
    setIsPlaying((prev) => !prev);
  };

  const addToTimeline = (assetId: string) => {
    const asset = assetsRef.current.find((item) => item.id === assetId);
    if (!asset) {
      return;
    }
    setIsBackgroundSelected(false);
    pushHistory();
    const laneType = getLaneType(asset);
    const nextLanes = [...lanesRef.current];
    const laneId = createLaneId(laneType, nextLanes);
    setLanes(nextLanes);
    setTimeline((prev) => {
      const clip = createClip(assetId, laneId, 0, asset);
      return [...prev, clip];
    });
    setActiveAssetId(assetId);
  };

  const addClipAtPosition = (
    assetId: string,
    laneId: string,
    startTime: number,
    assetOverride?: MediaAsset
  ) => {
    setIsBackgroundSelected(false);
    pushHistory();
    const clip = createClip(
      assetId,
      laneId,
      Math.max(0, Math.round(startTime / snapInterval) * snapInterval),
      assetOverride
    );
    setTimeline((prev) => [...prev, clip]);
    setActiveAssetId(assetId);
  };

  const registerStockVideoPreview = useCallback(
    (id: string) => (node: HTMLVideoElement | null) => {
      if (node) {
        stockVideoPreviewRefs.current.set(id, node);
      } else {
        stockVideoPreviewRefs.current.delete(id);
      }
    },
    []
  );

  const handleStockVideoPreviewStart = useCallback((id: string) => {
    const target = stockVideoPreviewRefs.current.get(id);
    if (!target) {
      return;
    }
    const resetPreview = (video: HTMLVideoElement | null) => {
      if (!video || !video.src) {
        return;
      }
      video.pause();
      try {
        video.currentTime = 0;
      } catch (error) {}
    };
    stockVideoPreviewRefs.current.forEach((video, key) => {
      if (!video || key === id) {
        return;
      }
      resetPreview(video);
    });
    if (target.src) {
      try {
        target.currentTime = 0;
      } catch (error) {}
    }
    const playPromise = target.play();
    if (playPromise) {
      playPromise.catch(() => {});
    }
  }, []);

  const handleStockVideoPreviewStop = useCallback((id: string) => {
    const target = stockVideoPreviewRefs.current.get(id);
    if (!target) {
      return;
    }
    target.pause();
    if (!target.src) {
      return;
    }
    try {
      target.currentTime = 0;
    } catch (error) {}
  }, []);

  const requestStockVideoMeta = useCallback(async (video: StockVideoItem) => {
    const cached = stockVideoMetaCacheRef.current.get(video.id);
    if (cached) {
      const patch: Partial<StockVideoItem> = {};
      if (video.duration == null && cached.duration != null) {
        patch.duration = cached.duration;
      }
      if (!video.width && cached.width) {
        patch.width = cached.width;
      }
      if (!video.height && cached.height) {
        patch.height = cached.height;
      }
      if (!video.orientation && cached.orientation) {
        patch.orientation = cached.orientation;
      }
      if (Object.keys(patch).length > 0) {
        setStockVideoItems((prev) =>
          prev.map((item) =>
            item.id === video.id ? { ...item, ...patch } : item
          )
        );
      }
      return;
    }
    if (stockVideoMetaLoadingRef.current.has(video.id)) {
      return;
    }
    stockVideoMetaLoadingRef.current.add(video.id);
    try {
      const meta = await getMediaMeta("video", video.url);
      const duration =
        typeof meta.duration === "number" && Number.isFinite(meta.duration)
          ? Math.max(0, meta.duration)
          : null;
      const orientation =
        resolveStockVideoOrientationFromMeta(meta.width, meta.height) ??
        resolveStockVideoOrientationFromPath(video.path);
      stockVideoMetaCacheRef.current.set(video.id, {
        duration,
        width: meta.width,
        height: meta.height,
        orientation: orientation ?? null,
      });
      const patch: Partial<StockVideoItem> = {};
      if (duration != null) {
        patch.duration = duration;
      }
      if (meta.width) {
        patch.width = meta.width;
      }
      if (meta.height) {
        patch.height = meta.height;
      }
      if (orientation && !video.orientation) {
        patch.orientation = orientation;
      }
      if (Object.keys(patch).length > 0) {
        setStockVideoItems((prev) =>
          prev.map((item) =>
            item.id === video.id ? { ...item, ...patch } : item
          )
        );
      }
    } finally {
      stockVideoMetaLoadingRef.current.delete(video.id);
    }
  }, []);

  const handleStockPreviewToggle = useCallback(
    (track: StockAudioTrack) => {
      const audio = previewAudioRef.current ?? new Audio();
      previewAudioRef.current = audio;
      audio.volume = 0.9;
      if (previewTrackId === track.id) {
        if (audio.paused) {
          const playPromise = audio.play();
          if (playPromise) {
            playPromise
              .then(() => setIsPreviewPlaying(true))
              .catch(() => setIsPreviewPlaying(false));
          }
        } else {
          audio.pause();
          setIsPreviewPlaying(false);
        }
        return;
      }
      audio.pause();
      setIsPreviewPlaying(false);
      audio.currentTime = 0;
      audio.src = track.url;
      audio.onended = () => {
        setIsPreviewPlaying(false);
      };
      setPreviewTrackId(track.id);
      const playPromise = audio.play();
      if (playPromise) {
        playPromise
          .then(() => setIsPreviewPlaying(true))
          .catch(() => setIsPreviewPlaying(false));
      }
    },
    [previewTrackId]
  );

  const handleAddStockVideo = useCallback(
    async (video: StockVideoItem) => {
      const existing = assetsRef.current.find(
        (asset) => asset.kind === "video" && asset.url === video.url
      );
      if (existing) {
        addToTimeline(existing.id);
        return;
      }
      let resolvedDuration = video.duration;
      let resolvedWidth = video.width;
      let resolvedHeight = video.height;
      if (resolvedDuration == null || !resolvedWidth || !resolvedHeight) {
        const cached = stockVideoMetaCacheRef.current.get(video.id);
        if (cached) {
          resolvedDuration = cached.duration ?? resolvedDuration;
          resolvedWidth = cached.width ?? resolvedWidth;
          resolvedHeight = cached.height ?? resolvedHeight;
        } else {
          const meta = await getMediaMeta("video", video.url);
          if (
            typeof meta.duration === "number" &&
            Number.isFinite(meta.duration)
          ) {
            resolvedDuration = meta.duration;
          }
          resolvedWidth = meta.width ?? resolvedWidth;
          resolvedHeight = meta.height ?? resolvedHeight;
          stockVideoMetaCacheRef.current.set(video.id, {
            duration:
              typeof meta.duration === "number" &&
              Number.isFinite(meta.duration)
                ? meta.duration
                : null,
            width: meta.width,
            height: meta.height,
            orientation:
              resolveStockVideoOrientationFromMeta(meta.width, meta.height) ??
              null,
          });
        }
      }
      setIsBackgroundSelected(false);
      pushHistory();
      const aspectRatio =
        resolvedWidth && resolvedHeight
          ? resolvedWidth / resolvedHeight
          : undefined;
      const videoAsset: MediaAsset = {
        id: crypto.randomUUID(),
        name: video.name,
        kind: "video",
        url: video.url,
        size: video.size,
        duration: resolvedDuration ?? undefined,
        width: resolvedWidth,
        height: resolvedHeight,
        aspectRatio,
        createdAt: Date.now(),
      };
      const nextLanes = [...lanesRef.current];
      const laneId = createLaneId("video", nextLanes);
      const clip = createClip(videoAsset.id, laneId, 0, videoAsset);
      setLanes(nextLanes);
      setAssets((prev) => [videoAsset, ...prev]);
      setTimeline((prev) => [...prev, clip]);
      setActiveAssetId(videoAsset.id);
    },
    [addToTimeline, createClip, pushHistory]
  );

  const handleAddStockAudio = useCallback(
    async (track: StockAudioTrack) => {
      const existing = assetsRef.current.find(
        (asset) => asset.kind === "audio" && asset.url === track.url
      );
      if (existing) {
        addToTimeline(existing.id);
        return;
      }
      let resolvedDuration = track.duration;
      if (resolvedDuration == null) {
        if (stockDurationCacheRef.current.has(track.id)) {
          const cached = stockDurationCacheRef.current.get(track.id);
          resolvedDuration = cached ?? undefined;
        } else {
          const meta = await getMediaMeta("audio", track.url);
          resolvedDuration = meta.duration;
          stockDurationCacheRef.current.set(track.id, meta.duration ?? null);
        }
      }
      setIsBackgroundSelected(false);
      pushHistory();
      const audioAsset: MediaAsset = {
        id: crypto.randomUUID(),
        name: track.name,
        kind: "audio",
        url: track.url,
        size: track.size,
        duration: resolvedDuration ?? undefined,
        createdAt: Date.now(),
      };
      const nextLanes = [...lanesRef.current];
      const laneId = createLaneId("audio", nextLanes);
      const clip = createClip(audioAsset.id, laneId, 0, audioAsset);
      setLanes(nextLanes);
      setAssets((prev) => [audioAsset, ...prev]);
      setTimeline((prev) => [...prev, clip]);
      setActiveAssetId(audioAsset.id);
    },
    [addToTimeline, createClip, pushHistory]
  );

  const handleStockVideoRetry = useCallback(() => {
    setStockVideoStatus("idle");
    setStockVideoError(null);
    setStockVideoItems([]);
    setStockVideoReloadKey((prev) => prev + 1);
  }, []);

  const handleStockMusicRetry = useCallback(() => {
    setStockMusicStatus("idle");
    setStockMusicError(null);
    setStockMusic([]);
    setStockMusicReloadKey((prev) => prev + 1);
  }, []);

  const handleSplitClip = () => {
    const layoutEntry =
      (selectedClipId &&
        timelineLayout.find((entry) => entry.clip.id === selectedClipId)) ||
      timelineLayout.find(
        (entry) =>
          currentTime >= entry.left &&
          currentTime <= entry.left + entry.clip.duration
      );
    if (!layoutEntry) {
      return;
    }
    pushHistory();
    const { clip, left } = layoutEntry;
    const splitPoint = currentTime - left;
    if (
      splitPoint < minClipDuration ||
      splitPoint > clip.duration - minClipDuration
    ) {
      return;
    }
    const leftClip: TimelineClip = {
      ...clip,
      duration: splitPoint,
    };
    const rightClip: TimelineClip = {
      ...clip,
      id: crypto.randomUUID(),
      duration: clip.duration - splitPoint,
      startOffset: clip.startOffset + splitPoint,
      startTime: clip.startTime + splitPoint,
    };
    setTimeline((prev) => {
      const index = prev.findIndex((item) => item.id === clip.id);
      if (index === -1) {
        return prev;
      }
      return [
        ...prev.slice(0, index),
        leftClip,
        rightClip,
        ...prev.slice(index + 1),
      ];
    });
    setClipSettings((prev) => {
      const existing = prev[clip.id];
      if (!existing) {
        return prev;
      }
      return {
        ...prev,
        [rightClip.id]: cloneVideoSettings(existing),
      };
    });
    setTextSettings((prev) => {
      const existing = prev[clip.id];
      if (!existing) {
        return prev;
      }
      return {
        ...prev,
        [rightClip.id]: cloneTextSettings(existing),
      };
    });
    setSelectedClipId(rightClip.id);
    setSelectedClipIds([rightClip.id]);
    setActiveAssetId(clip.assetId);
  };

  const handleFuseClips = () => {
    if (!fusableClips) {
      return;
    }
    pushHistory();
    const { first, second } = fusableClips;

    // Create the fused clip - keep the first clip's id, extend duration
    const fusedClip: TimelineClip = {
      ...first,
      duration: first.duration + second.duration,
    };

    // Update timeline: replace first clip with fused, remove second
    setTimeline((prev) => {
      const firstIndex = prev.findIndex((item) => item.id === first.id);
      const secondIndex = prev.findIndex((item) => item.id === second.id);
      if (firstIndex === -1 || secondIndex === -1) {
        return prev;
      }
      // Remove both clips and add the fused one at the first position
      const filtered = prev.filter(
        (item) => item.id !== first.id && item.id !== second.id
      );
      return [...filtered.slice(0, firstIndex), fusedClip, ...filtered.slice(firstIndex)];
    });

    // Clean up settings for the removed second clip
    setClipSettings((prev) => {
      const next = { ...prev };
      delete next[second.id];
      return next;
    });
    setTextSettings((prev) => {
      const next = { ...prev };
      delete next[second.id];
      return next;
    });
    setClipTransforms((prev) => {
      const next = { ...prev };
      delete next[second.id];
      return next;
    });

    // Select the fused clip
    setSelectedClipId(fusedClip.id);
    setSelectedClipIds([fusedClip.id]);
    setActiveAssetId(fusedClip.assetId);
  };

  const resolveClipTransform = useCallback(
    (clipId: string, asset: MediaAsset) => {
      if (clipTransforms[clipId]) {
        return clipTransforms[clipId];
      }
      if (asset.kind === "text") {
        return createDefaultTextTransform(stageAspectRatio);
      }
      return createDefaultTransform(asset.aspectRatio, stageAspectRatio);
    },
    [clipTransforms, stageAspectRatio]
  );

  const getStageSelectionIds = useCallback(
    (selection: RangeSelectionState) => {
      const { trackRect, startX, currentX, startY, currentY } = selection;
      const selectionLeft = clamp(
        Math.min(startX, currentX) - trackRect.left,
        0,
        trackRect.width
      );
      const selectionRight = clamp(
        Math.max(startX, currentX) - trackRect.left,
        0,
        trackRect.width
      );
      const selectionTop = clamp(
        Math.min(startY, currentY) - trackRect.top,
        0,
        trackRect.height
      );
      const selectionBottom = clamp(
        Math.max(startY, currentY) - trackRect.top,
        0,
        trackRect.height
      );
      if (
        selectionRight <= selectionLeft ||
        selectionBottom <= selectionTop
      ) {
        return selection.additive ? selection.originSelection : [];
      }
      const selected = visualStack
        .filter((entry) => {
          const transform = resolveClipTransform(entry.clip.id, entry.asset);
          const clipLeft = transform.x * trackRect.width;
          const clipTop = transform.y * trackRect.height;
          const clipRight = clipLeft + transform.width * trackRect.width;
          const clipBottom = clipTop + transform.height * trackRect.height;
          return (
            clipRight >= selectionLeft &&
            clipLeft <= selectionRight &&
            clipBottom >= selectionTop &&
            clipTop <= selectionBottom
          );
        })
        .map((entry) => entry.clip.id);
      if (!selection.additive) {
        return selected;
      }
      return Array.from(new Set([...selection.originSelection, ...selected]));
    },
    [resolveClipTransform, visualStack]
  );

  const ensureClipTransform = useCallback(
    (clipId: string, asset: MediaAsset) => {
      const existing = clipTransforms[clipId];
      if (existing) {
        return existing;
      }
      const next =
        asset.kind === "text"
          ? createDefaultTextTransform(stageAspectRatio)
          : createDefaultTransform(asset.aspectRatio, stageAspectRatio);
      setClipTransforms((prev) => ({ ...prev, [clipId]: next }));
      return next;
    },
    [clipTransforms, stageAspectRatio]
  );

  const updateClipSettings = (
    clipId: string,
    updater: (current: VideoClipSettings) => VideoClipSettings
  ) => {
    pushHistoryThrottled();
    setClipSettings((prev) => {
      const current = prev[clipId] ?? createDefaultVideoSettings();
      const next = updater(current);
      return { ...prev, [clipId]: next };
    });
  };

  const updateTextSettings = (
    clipId: string,
    updater: (current: TextClipSettings) => TextClipSettings
  ) => {
    pushHistoryThrottled();
    setTextSettings((prev) => {
      const current = prev[clipId] ?? createDefaultTextSettings();
      const next = updater(current);
      return { ...prev, [clipId]: next };
    });
  };

  const handleTextStylePresetSelect = useCallback(
    (preset: TextStylePreset) => {
      const nextSettings: TextClipSettings = {
        text: textPanelDraft,
        fontFamily: textPanelFontFamily,
        fontSize: textPanelFontSize,
        color: textPanelColor,
        bold: textPanelBold,
        italic: textPanelItalic,
        align: textPanelAlign,
        letterSpacing: textPanelLetterSpacing,
        lineHeight: textPanelLineHeight,
        backgroundEnabled: textPanelBackgroundEnabled,
        backgroundColor: textPanelBackgroundColor,
        backgroundStyle: textPanelBackgroundStyle,
        outlineEnabled: textPanelOutlineEnabled,
        outlineColor: textPanelOutlineColor,
        outlineWidth: textPanelOutlineWidth,
        shadowEnabled: textPanelShadowEnabled,
        shadowColor: textPanelShadowColor,
        shadowBlur: textPanelShadowBlur,
        shadowOpacity: textPanelShadowOpacity,
        ...preset.settings,
      };

      setTextPanelStylePresetId(preset.id);
      setTextPanelColor(nextSettings.color);
      setTextPanelBackgroundEnabled(nextSettings.backgroundEnabled);
      setTextPanelBackgroundColor(nextSettings.backgroundColor);
      setTextPanelBackgroundStyle(nextSettings.backgroundStyle);
      setTextPanelOutlineEnabled(nextSettings.outlineEnabled);
      setTextPanelOutlineColor(nextSettings.outlineColor);
      setTextPanelOutlineWidth(nextSettings.outlineWidth);
      setTextPanelShadowEnabled(nextSettings.shadowEnabled);
      setTextPanelShadowColor(nextSettings.shadowColor);
      setTextPanelShadowBlur(nextSettings.shadowBlur);
      setTextPanelShadowOpacity(nextSettings.shadowOpacity);

      if (selectedTextEntry) {
        updateTextSettings(selectedTextEntry.clip.id, (current) => ({
          ...current,
          ...preset.settings,
        }));
      }
    },
    [
      selectedTextEntry,
      textPanelAlign,
      textPanelBackgroundColor,
      textPanelBackgroundEnabled,
      textPanelBackgroundStyle,
      textPanelBold,
      textPanelColor,
      textPanelDraft,
      textPanelFontFamily,
      textPanelFontSize,
      textPanelItalic,
      textPanelLetterSpacing,
      textPanelLineHeight,
      textPanelOutlineColor,
      textPanelOutlineEnabled,
      textPanelOutlineWidth,
      textPanelShadowBlur,
      textPanelShadowColor,
      textPanelShadowEnabled,
      textPanelShadowOpacity,
      updateTextSettings,
    ]
  );

  const closeFloatingMenu = useCallback(() => {
    setFloatingMenu(closeFloatingMenuState);
  }, []);

  const closeTimelineContextMenu = useCallback(() => {
    setTimelineContextMenu(closeTimelineContextMenuState);
  }, []);

  const handleTextLayerDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>, entry: TimelineLayoutEntry) => {
      event.preventDefault();
      event.stopPropagation();
      closeFloatingMenu();
      setSelectedClipId(entry.clip.id);
      setSelectedClipIds([entry.clip.id]);
      setActiveAssetId(entry.asset.id);
      setActiveCanvasClipId(entry.clip.id);
      setActiveTool("text");
      setTextPanelView("edit");
      setDragTransformState(null);
      setResizeTransformState(null);
      setEditingTextClipId(entry.clip.id);
    },
    [closeFloatingMenu]
  );

  const handleClipContextMenu = (
    event: ReactMouseEvent<HTMLDivElement>,
    entry: TimelineLayoutEntry
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const rect = stage.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    const y = clamp(event.clientY - rect.top, 0, rect.height);
    setSelectedClipId(entry.clip.id);
    setSelectedClipIds([entry.clip.id]);
    setActiveAssetId(entry.asset.id);
    setActiveCanvasClipId(entry.clip.id);
    if (entry.asset.kind === "text") {
      setActiveTool("text");
    }
    closeTimelineContextMenu();
    setFloatingMenu(createFloatingMenuState(entry.clip.id, x, y));
  };

  const handleTimelineClipContextMenu = (
    event: ReactMouseEvent<HTMLButtonElement>,
    clip: TimelineClip,
    asset: MediaAsset
  ) => {
    event.preventDefault();
    event.stopPropagation();
    
    // Use fixed positioning (viewport coordinates) so menu can extend above scroll area
    const menuWidth = timelineContextMenuWidth;
    // Menu height varies by asset type:
    // - Video: Split, Copy, Replace, Audio, Delete = ~260px
    // - Audio: Split, Copy, Replace, Audio, Delete = ~260px
    // - Image: Split, Copy, Replace, Delete = ~208px
    // - Text: Split, Copy, Delete = ~156px
    let menuHeight = 156; // Base: Split, Copy, Delete
    if (asset.kind === "video" || asset.kind === "audio") {
      menuHeight = 260;
    } else if (asset.kind === "image") {
      menuHeight = 208;
    }
    
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1920;
    
    // X position in viewport
    let x = event.clientX;
    
    // Adjust x if menu would overflow to the right of viewport
    if (x + menuWidth > viewportWidth - 8) {
      x = Math.max(8, x - menuWidth);
    }
    
    // Y position: place menu ABOVE the click point (bottom of menu at cursor)
    let y = event.clientY - menuHeight;
    
    // If menu would go above the viewport, open downward instead
    if (y < 8) {
      y = event.clientY + 8;
    }
    
    setSelectedClipId(clip.id);
    setSelectedClipIds([clip.id]);
    setActiveAssetId(asset.id);
    if (asset.kind === "text") {
      setActiveTool("text");
    }
    closeFloatingMenu();
    setTimelineContextMenu(createTimelineContextMenuState(clip.id, x, y));
  };

  const handleReorderClip = useCallback(
    (clipId: string, direction: "forward" | "backward" | "front" | "back") => {
      pushHistory();
      setClipOrder((prev) => {
        const visualIds = timelineLayout
          .filter((entry) => entry.asset.kind !== "audio")
          .map((entry) => entry.clip.id);
        if (!visualIds.includes(clipId)) {
          return prev;
        }
        const ordered = visualIds
          .map((id) => [id, prev[id] ?? 0] as const)
          .sort((a, b) => a[1] - b[1]);
        const index = ordered.findIndex(([id]) => id === clipId);
        if (index < 0) {
          return prev;
        }
        let targetIndex = index;
        if (direction === "front") {
          targetIndex = ordered.length - 1;
        } else if (direction === "back") {
          targetIndex = 0;
        } else if (direction === "forward") {
          targetIndex = Math.min(ordered.length - 1, index + 1);
        } else {
          targetIndex = Math.max(0, index - 1);
        }
        if (targetIndex === index) {
          return prev;
        }
        const [item] = ordered.splice(index, 1);
        ordered.splice(targetIndex, 0, item);
        const next = { ...prev };
        ordered.forEach(([id], order) => {
          next[id] = order;
        });
        return next;
      });
    },
    [timelineLayout, pushHistory]
  );

  const resolveSelectedClipIds = () => {
    if (selectedClipIds.length > 0) {
      return Array.from(new Set(selectedClipIds));
    }
    return selectedClipId ? [selectedClipId] : [];
  };

  const collectSelectedClips = () => {
    const ids = resolveSelectedClipIds();
    if (ids.length === 0) {
      return [];
    }
    const selected = new Set(ids);
    return timeline.filter((clip) => selected.has(clip.id));
  };

  const createClipCopies = (
    sourceClips: TimelineClip[],
    sourceSettings: Record<string, VideoClipSettings>,
    sourceTextSettings: Record<string, TextClipSettings>,
    sourceTransforms: Record<string, ClipTransform>,
    offsetSeconds: number,
    options?: { createNewLanes?: boolean }
  ) => {
    const laneMap: Record<string, string> = {};
    const nextLanes = [...lanesRef.current];
    const shouldCreateNewLanes = options?.createNewLanes ?? false;
    const resolveLaneId = (clip: TimelineClip) => {
      if (laneMap[clip.laneId]) {
        return laneMap[clip.laneId];
      }
      const asset = assetsRef.current.find((item) => item.id === clip.assetId);
      const laneType = getLaneType(asset);
      if (!shouldCreateNewLanes) {
        const existingLane = nextLanes.find((lane) => lane.id === clip.laneId);
        if (existingLane && existingLane.type === laneType) {
          laneMap[clip.laneId] = clip.laneId;
          return clip.laneId;
        }
      }
      const newLaneId = createLaneId(laneType, nextLanes);
      laneMap[clip.laneId] = newLaneId;
      return newLaneId;
    };
    const idMap: Record<string, string> = {};
    const newClips = sourceClips.map((clip) => {
      const nextId = crypto.randomUUID();
      idMap[clip.id] = nextId;
      const laneId = resolveLaneId(clip);
      const startTime = Math.max(
        0,
        Math.round((clip.startTime + offsetSeconds) / snapInterval) *
          snapInterval
      );
      return {
        ...clip,
        id: nextId,
        laneId,
        startTime,
      };
    });
    const nextSettings: Record<string, VideoClipSettings> = {};
    Object.entries(sourceSettings).forEach(([id, settings]) => {
      const nextId = idMap[id];
      if (nextId) {
        nextSettings[nextId] = cloneVideoSettings(settings);
      }
    });
    const nextTextSettings: Record<string, TextClipSettings> = {};
    Object.entries(sourceTextSettings).forEach(([id, settings]) => {
      const nextId = idMap[id];
      if (nextId) {
        nextTextSettings[nextId] = cloneTextSettings(settings);
      }
    });
    const nextTransforms: Record<string, ClipTransform> = {};
    Object.entries(sourceTransforms).forEach(([id, transform]) => {
      const nextId = idMap[id];
      if (nextId) {
        nextTransforms[nextId] = { ...transform };
      }
    });
    return { newClips, nextSettings, nextTextSettings, nextTransforms, nextLanes };
  };

  const applyCopiedClips = (payload: {
    newClips: TimelineClip[];
    nextSettings: Record<string, VideoClipSettings>;
    nextTextSettings: Record<string, TextClipSettings>;
    nextTransforms: Record<string, ClipTransform>;
    nextLanes: TimelineLane[];
  }) => {
    if (payload.newClips.length === 0) {
      return;
    }
    if (payload.nextLanes.length !== lanesRef.current.length) {
      setLanes(payload.nextLanes);
    }
    setTimeline((prev) => [...prev, ...payload.newClips]);
    if (Object.keys(payload.nextSettings).length > 0) {
      setClipSettings((prev) => ({
        ...prev,
        ...payload.nextSettings,
      }));
    }
    if (Object.keys(payload.nextTextSettings).length > 0) {
      setTextSettings((prev) => ({
        ...prev,
        ...payload.nextTextSettings,
      }));
    }
    if (Object.keys(payload.nextTransforms).length > 0) {
      setClipTransforms((prev) => ({
        ...prev,
        ...payload.nextTransforms,
      }));
    }
    const newIds = payload.newClips.map((clip) => clip.id);
    setSelectedClipIds(newIds);
    setSelectedClipId(newIds[0] ?? null);
    const firstVisual = payload.newClips.find((clip) => {
      const asset = assetsRef.current.find((item) => item.id === clip.assetId);
      return asset?.kind !== "audio";
    });
    setActiveCanvasClipId(firstVisual?.id ?? null);
    setActiveAssetId(
      firstVisual?.assetId ?? payload.newClips[0]?.assetId ?? null
    );
  };

  const handleCopySelection = () => {
    const selection = collectSelectedClips();
    if (selection.length === 0) {
      return false;
    }
    const nextSettings: Record<string, VideoClipSettings> = {};
    const nextTextSettings: Record<string, TextClipSettings> = {};
    const nextTransforms: Record<string, ClipTransform> = {};
    selection.forEach((clip) => {
      const settings = clipSettings[clip.id];
      if (settings) {
        nextSettings[clip.id] = cloneVideoSettings(settings);
      }
      const textSetting = textSettings[clip.id];
      if (textSetting) {
        nextTextSettings[clip.id] = cloneTextSettings(textSetting);
      }
      const transform = clipTransforms[clip.id];
      if (transform) {
        nextTransforms[clip.id] = { ...transform };
      }
    });
    clipboardRef.current = {
      clips: selection.map((clip) => ({ ...clip })),
      clipSettings: nextSettings,
      textSettings: nextTextSettings,
      clipTransforms: nextTransforms,
    };
    return true;
  };

  const handlePasteSelection = (offsetSeconds?: number) => {
    const clipboard = clipboardRef.current;
    if (!clipboard || clipboard.clips.length === 0) {
      return;
    }
    const minStart = Math.min(
      ...clipboard.clips.map((clip) => clip.startTime)
    );
    const offset = offsetSeconds ?? currentTime - minStart;
    const payload = createClipCopies(
      clipboard.clips,
      clipboard.clipSettings,
      clipboard.textSettings,
      clipboard.clipTransforms,
      offset,
      { createNewLanes: true }
    );
    if (payload.newClips.length === 0) {
      return;
    }
    pushHistory();
    setIsBackgroundSelected(false);
    applyCopiedClips(payload);
  };

  const handleDuplicateClip = () => {
    const selection = collectSelectedClips();
    if (selection.length === 0) {
      return;
    }
    const nextSettings: Record<string, VideoClipSettings> = {};
    const nextTextSettings: Record<string, TextClipSettings> = {};
    const nextTransforms: Record<string, ClipTransform> = {};
    selection.forEach((clip) => {
      const settings = clipSettings[clip.id];
      if (settings) {
        nextSettings[clip.id] = cloneVideoSettings(settings);
      }
      const textSetting = textSettings[clip.id];
      if (textSetting) {
        nextTextSettings[clip.id] = cloneTextSettings(textSetting);
      }
      const transform = clipTransforms[clip.id];
      if (transform) {
        nextTransforms[clip.id] = { ...transform };
      }
    });
    const payload = createClipCopies(
      selection,
      nextSettings,
      nextTextSettings,
      nextTransforms,
      snapInterval
    );
    if (payload.newClips.length === 0) {
      return;
    }
    pushHistory();
    setIsBackgroundSelected(false);
    applyCopiedClips(payload);
  };

  const handleSelectAll = () => {
    if (timeline.length === 0) {
      return;
    }
    const ids = timeline.map((clip) => clip.id);
    setSelectedClipIds(ids);
    setSelectedClipId(ids[0] ?? null);
    const firstVisual = timelineLayout.find(
      (entry) => entry.asset.kind !== "audio"
    );
    setActiveCanvasClipId(firstVisual?.clip.id ?? null);
    setActiveAssetId(firstVisual?.asset.id ?? null);
    setIsBackgroundSelected(false);
  };

  const handleDeleteSelected = () => {
    if (!selectedClipId && selectedClipIds.length === 0) {
      return;
    }
    pushHistory();
    const idsToRemove =
      selectedClipIds.length > 0
        ? selectedClipIds
        : selectedClipId
          ? [selectedClipId]
          : [];
    setTimeline((prev) => {
      const next = prev.filter((clip) => !idsToRemove.includes(clip.id));
      if (next.length === prev.length) {
        return prev;
      }
      const nextSelected = next[0] ?? null;
      setSelectedClipId(nextSelected?.id ?? null);
      setSelectedClipIds(nextSelected ? [nextSelected.id] : []);
      setActiveAssetId(nextSelected?.assetId ?? null);
      return next;
    });
    setTextSettings((prev) => {
      const next = { ...prev };
      idsToRemove.forEach((id) => {
        delete next[id];
      });
      return next;
    });
  };

  keyboardStateRef.current = {
    currentTime,
    timelineDuration,
    handleCopySelection,
    handleDeleteSelected,
    handleDuplicateClip,
    handlePasteSelection,
    handleRedo,
    handleSelectAll,
    handleSplitClip,
    handleTogglePlayback,
    handleUndo,
    isEditableTarget,
  };

  const handleDetachAudio = () => {
    if (!selectedVideoEntry) {
      return;
    }
    pushHistory();
    updateClipSettings(selectedVideoEntry.clip.id, (current) => ({
      ...current,
      muted: true,
    }));
    const exists = timelineLayout.some(
      (entry) =>
        entry.asset.kind === "audio" &&
        entry.asset.url === selectedVideoEntry.asset.url &&
        entry.clip.startTime === selectedVideoEntry.clip.startTime &&
        entry.clip.startOffset === selectedVideoEntry.clip.startOffset &&
        entry.clip.duration === selectedVideoEntry.clip.duration
    );
    if (exists) {
      return;
    }
    const audioAsset: MediaAsset = {
      id: crypto.randomUUID(),
      name: `${selectedVideoEntry.asset.name} (audio)`,
      kind: "audio",
      url: selectedVideoEntry.asset.url,
      size: selectedVideoEntry.asset.size,
      duration: selectedVideoEntry.asset.duration,
      createdAt: Date.now(),
    };
    const nextLanes = [...lanesRef.current];
    const laneId = createLaneId("audio", nextLanes);
    const audioClip: TimelineClip = {
      id: crypto.randomUUID(),
      assetId: audioAsset.id,
      duration: selectedVideoEntry.clip.duration,
      startOffset: selectedVideoEntry.clip.startOffset,
      startTime: selectedVideoEntry.clip.startTime,
      laneId,
    };
    setLanes(nextLanes);
    setAssets((prev) => [audioAsset, ...prev]);
    setTimeline((prev) => [...prev, audioClip]);
  };

  const handleReplaceVideo = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length || !selectedVideoEntry) {
      event.target.value = "";
      return;
    }
    const file = files[0];
    if (!file) {
      event.target.value = "";
      return;
    }
    pushHistory();
    setUploading(true);
    try {
      const url = URL.createObjectURL(file);
      const meta = await getMediaMeta("video", url);
      const resolvedAspectRatio =
        meta.aspectRatio ??
        (meta.width && meta.height ? meta.width / meta.height : undefined);
      const newAsset: MediaAsset = {
        id: crypto.randomUUID(),
        name: file.name,
        kind: "video",
        url,
        size: file.size,
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
        aspectRatio: resolvedAspectRatio,
        createdAt: Date.now(),
      };
      setAssets((prev) => [newAsset, ...prev]);
      setTimeline((prev) =>
        prev.map((clip) => {
          if (clip.id !== selectedVideoEntry.clip.id) {
            return clip;
          }
          const nextDuration = Math.min(
            clip.duration,
            getAssetDurationSeconds(newAsset)
          );
          return {
            ...clip,
            assetId: newAsset.id,
            duration: nextDuration,
            startOffset: 0,
          };
        })
      );
      setActiveAssetId(newAsset.id);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleReplaceMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length || !selectedEntry) {
      event.target.value = "";
      return;
    }
    const file = files[0];
    if (!file) {
      event.target.value = "";
      return;
    }
    pushHistory();
    setUploading(true);
    try {
      const url = URL.createObjectURL(file);
      const kind = inferMediaKind(file);
      const meta = await getMediaMeta(kind, url);
      const resolvedAspectRatio =
        meta.aspectRatio ??
        (meta.width && meta.height ? meta.width / meta.height : undefined);
      const newAsset: MediaAsset = {
        id: crypto.randomUUID(),
        name: file.name,
        kind,
        url,
        size: file.size,
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
        aspectRatio: resolvedAspectRatio,
        createdAt: Date.now(),
      };
      setAssets((prev) => [newAsset, ...prev]);
      
      // Replace the clip's asset while keeping position and timing
      setTimeline((prev) =>
        prev.map((clip) => {
          if (clip.id !== selectedEntry.clip.id) {
            return clip;
          }
          // Keep the same duration, but cap it if new asset is shorter
          const maxDuration = getAssetMaxDurationSeconds(newAsset);
          const nextDuration = Math.min(clip.duration, maxDuration);
          return {
            ...clip,
            assetId: newAsset.id,
            duration: nextDuration,
            startOffset: 0,
          };
        })
      );
      setActiveAssetId(newAsset.id);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleDurationCommit = (clip: TimelineClip, value: string) => {
    const nextDuration = parseTimeInput(value);
    if (nextDuration == null) {
      return;
    }
    pushHistory();
    const asset = assetsRef.current.find((item) => item.id === clip.assetId);
    const assetDuration = getAssetMaxDurationSeconds(asset);
    const maxDuration = Math.max(
      minClipDuration,
      assetDuration - clip.startOffset
    );
    setTimeline((prev) =>
      prev.map((item) =>
        item.id === clip.id
          ? {
              ...item,
              duration: clamp(nextDuration, minClipDuration, maxDuration),
            }
          : item
      )
    );
  };

  const handleStartTimeCommit = (clip: TimelineClip, value: string) => {
    const nextStart = parseTimeInput(value);
    if (nextStart == null) {
      return;
    }
    pushHistory();
    setTimeline((prev) =>
      prev.map((item) =>
        item.id === clip.id
          ? { ...item, startTime: Math.max(0, nextStart) }
          : item
      )
    );
  };

  const handleEndTimeCommit = (clip: TimelineClip, value: string) => {
    const nextEnd = parseTimeInput(value);
    if (nextEnd == null) {
      return;
    }
    pushHistory();
    const asset = assetsRef.current.find((item) => item.id === clip.assetId);
    const assetDuration = getAssetMaxDurationSeconds(asset);
    const maxDuration = Math.max(
      minClipDuration,
      assetDuration - clip.startOffset
    );
    setTimeline((prev) =>
      prev.map((item) => {
        if (item.id !== clip.id) {
          return item;
        }
        const nextDuration = clamp(
          nextEnd - item.startTime,
          minClipDuration,
          maxDuration
        );
        return { ...item, duration: nextDuration };
      })
    );
  };

  const handleSetStartAtPlayhead = (clip: TimelineClip) => {
    pushHistory();
    setTimeline((prev) =>
      prev.map((item) =>
        item.id === clip.id
          ? { ...item, startTime: Math.max(0, currentTime) }
          : item
      )
    );
  };

  const handleSetEndAtPlayhead = (clip: TimelineClip) => {
    const asset = assetsRef.current.find((item) => item.id === clip.assetId);
    const assetDuration = getAssetMaxDurationSeconds(asset);
    const maxDuration = Math.max(
      minClipDuration,
      assetDuration - clip.startOffset
    );
    pushHistory();
    setTimeline((prev) =>
      prev.map((item) => {
        if (item.id !== clip.id) {
          return item;
        }
        const nextDuration = clamp(
          currentTime - item.startTime,
          minClipDuration,
          maxDuration
        );
        return { ...item, duration: nextDuration };
      })
    );
  };

  const getVideoStyles = (settings: VideoClipSettings) => {
    const radius = settings.roundCorners
      ? settings.cornerRadiusLinked
        ? {
          topLeft: settings.cornerRadius,
          topRight: settings.cornerRadius,
          bottomRight: settings.cornerRadius,
          bottomLeft: settings.cornerRadius,
        }
        : settings.cornerRadii
      : {
        topLeft: 0,
        topRight: 0,
        bottomRight: 0,
        bottomLeft: 0,
      };
    const borderRadius = `${radius.topLeft}px ${radius.topRight}px ${radius.bottomRight}px ${radius.bottomLeft}px`;
    const brightnessFactor = clamp(
      (1 + settings.brightness / 100) * (1 + settings.exposure / 100),
      0,
      3
    );
    const contrastFactor = clamp(
      1 + (settings.contrast + settings.sharpen * 0.6) / 100,
      0,
      3
    );
    const saturationFactor = clamp(1 + settings.saturation / 100, 0, 3);
    const blurPx = (settings.blur / 100) * 8;
    const filter = `brightness(${brightnessFactor}) contrast(${contrastFactor}) saturate(${saturationFactor}) hue-rotate(${settings.hue}deg) blur(${blurPx}px)`;
    const transformParts = [];
    if (settings.flipH) {
      transformParts.push("scaleX(-1)");
    }
    if (settings.flipV) {
      transformParts.push("scaleY(-1)");
    }
    if (settings.rotation) {
      transformParts.push(`rotate(${settings.rotation}deg)`);
    }
    const transform = transformParts.join(" ");
    return {
      frameStyle: {
        borderRadius,
        opacity: settings.opacity / 100,
      } as CSSProperties,
      mediaStyle: {
        transform: transform || undefined,
        filter,
        transformOrigin: "center",
      } as CSSProperties,
      noiseStyle: {
        backgroundImage: `url(${noiseDataUrl})`,
        backgroundSize: "120px 120px",
        opacity: settings.noise / 100,
      } as CSSProperties,
      vignetteStyle: {
        opacity: settings.vignette / 100,
      } as CSSProperties,
    };
  };

  const handleStagePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    event.preventDefault();
    closeFloatingMenu();
    setEditingTextClipId(null);
    setIsBackgroundSelected(false);
    const rect = stage.getBoundingClientRect();
    setStageSelection({
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      trackRect: rect,
      additive: event.shiftKey,
      originSelection: event.shiftKey ? selectedClipIds : [],
    });
  };

  const handleLayerPointerDown = (
    event: PointerEvent<HTMLDivElement>,
    entry: TimelineLayoutEntry
  ) => {
    if (event.button !== 0) {
      return;
    }
    if (editingTextClipId === entry.clip.id) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    closeFloatingMenu();
    setEditingTextClipId(null);
    setIsBackgroundSelected(false);
    dragTransformHistoryRef.current = false;
    const startRect = ensureClipTransform(entry.clip.id, entry.asset);
    setSelectedClipId(entry.clip.id);
    setSelectedClipIds([entry.clip.id]);
    setActiveAssetId(entry.asset.id);
    setActiveCanvasClipId(entry.clip.id);
    if (entry.asset.kind === "text") {
      setActiveTool("text");
    }
    setDragTransformState({
      clipId: entry.clip.id,
      startX: event.clientX,
      startY: event.clientY,
      startRect,
    });
  };

  const handleResizeStart = (
    event: PointerEvent<HTMLButtonElement>,
    entry: TimelineLayoutEntry,
    handle: TransformHandle
  ) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    closeFloatingMenu();
    setIsBackgroundSelected(false);
    resizeTransformHistoryRef.current = false;
    resizeTextRectRef.current = null;
    const startRect = ensureClipTransform(entry.clip.id, entry.asset);
    if (entry.asset.kind === "text") {
      const settings = textSettings[entry.clip.id] ?? fallbackTextSettings;
      resizeTextFontRef.current = {
        clipId: entry.clip.id,
        fontSize: settings.fontSize,
      };
    } else {
      resizeTextFontRef.current = null;
    }
    const ratioFromRect =
      startRect.height > 0 ? startRect.width / startRect.height : 0;
    const ratioFromAsset =
      entry.asset.aspectRatio && stageAspectRatio
        ? entry.asset.aspectRatio / stageAspectRatio
        : 1;
    const ratio =
      Number.isFinite(ratioFromRect) && ratioFromRect > 0
        ? ratioFromRect
        : ratioFromAsset;
    setSelectedClipId(entry.clip.id);
    setSelectedClipIds([entry.clip.id]);
    setActiveAssetId(entry.asset.id);
    setActiveCanvasClipId(entry.clip.id);
    setDragTransformState(null);
    setResizeTransformState({
      clipId: entry.clip.id,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      startRect,
      aspectRatio: ratio,
    });
  };

  const handleRotateStart = (
    event: PointerEvent<HTMLButtonElement>,
    entry: TimelineLayoutEntry
  ) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    closeFloatingMenu();
    setIsBackgroundSelected(false);
    rotateTransformHistoryRef.current = false;
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const rect = stage.getBoundingClientRect();
    const transform = ensureClipTransform(entry.clip.id, entry.asset);
    // Calculate center of the element in screen coordinates
    const centerX = rect.left + (transform.x + transform.width / 2) * rect.width;
    const centerY = rect.top + (transform.y + transform.height / 2) * rect.height;
    const startRotation = transform.rotation ?? 0;
    setSelectedClipId(entry.clip.id);
    setSelectedClipIds([entry.clip.id]);
    setActiveAssetId(entry.asset.id);
    setActiveCanvasClipId(entry.clip.id);
    setDragTransformState(null);
    setResizeTransformState(null);
    setRotateTransformState({
      clipId: entry.clip.id,
      startX: event.clientX,
      startY: event.clientY,
      startRotation,
      centerX,
      centerY,
    });
  };

  useEffect(() => {
    if (!trimState) {
      return;
    }
    const handleMove = (event: MouseEvent) => {
      if (!trimHistoryRef.current) {
        pushHistory();
        trimHistoryRef.current = true;
      }
      const deltaSeconds = (event.clientX - trimState.startX) / timelineScale;
      setTimeline((prev) =>
        prev.map((clip) => {
          if (clip.id !== trimState.clipId) {
            return clip;
          }
          const asset = assetsRef.current.find(
            (item) => item.id === clip.assetId
          );
          const assetDuration = getAssetMaxDurationSeconds(asset);
          if (trimState.edge === "end") {
            const nextDuration = clamp(
              trimState.startDuration + deltaSeconds,
              minClipDuration,
              assetDuration - trimState.startOffset
            );
            return { ...clip, duration: nextDuration };
          }
          const nextStartTime = clamp(
            trimState.startTime + deltaSeconds,
            0,
            trimState.startTime + trimState.startDuration - minClipDuration
          );
          const appliedDelta = nextStartTime - trimState.startTime;
          const nextStartOffset = clamp(
            trimState.startOffset + appliedDelta,
            0,
            assetDuration - minClipDuration
          );
          const maxDuration = assetDuration - nextStartOffset;
          const nextDuration = clamp(
            trimState.startDuration - appliedDelta,
            minClipDuration,
            maxDuration
          );
          return {
            ...clip,
            startTime: nextStartTime,
            startOffset: nextStartOffset,
            duration: nextDuration,
          };
        })
      );
    };
    const handleUp = () => {
      setTrimState(null);
      trimHistoryRef.current = false;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [trimState, timelineScale, pushHistory]);

  useEffect(() => {
    setTimelineHeight((prev) =>
      clamp(prev, timelineMinHeight, timelineMaxHeight)
    );
  }, [timelineMinHeight, timelineMaxHeight]);

  useEffect(() => {
    if (!timelineResizeState) {
      return;
    }
    const handleMove = (event: globalThis.PointerEvent) => {
      const delta = timelineResizeState.startY - event.clientY;
      const nextHeight = clamp(
        timelineResizeState.startHeight + delta,
        timelineMinHeight,
        timelineMaxHeight
      );
      setTimelineHeight(nextHeight);
    };
    const handleUp = () => setTimelineResizeState(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [timelineResizeState, timelineMinHeight, timelineMaxHeight]);

  useEffect(() => {
    if (!rangeSelection) {
      return;
    }
    const handleMove = (event: globalThis.PointerEvent) => {
      setRangeSelection((prev) =>
        prev
          ? {
            ...prev,
            currentX: event.clientX,
            currentY: event.clientY,
          }
          : prev
      );
    };
    const handleUp = () => {
      setRangeSelection((prev) => {
        if (!prev) {
          return prev;
        }
        const deltaX = Math.abs(prev.currentX - prev.startX);
        const deltaY = Math.abs(prev.currentY - prev.startY);
        if (deltaX < 4 && deltaY < 4) {
          if (isPlaying) {
            handleTogglePlayback();
          }
          handleScrubTo(prev.currentX);
          return null;
        }
        const nextIds = getSelectionIds(prev);
        setSelectedClipIds(nextIds);
        setSelectedClipId(nextIds[0] ?? null);
        const nextEntry = timelineLayout.find(
          (entry) => entry.clip.id === nextIds[0]
        );
        setActiveAssetId(nextEntry?.asset.id ?? null);
        return null;
      });
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [
    rangeSelection,
    getSelectionIds,
    timelineLayout,
    handleScrubTo,
    handleTogglePlayback,
    isPlaying,
  ]);

  useEffect(() => {
    if (!rangeSelection) {
      return;
    }
    const deltaX = Math.abs(rangeSelection.currentX - rangeSelection.startX);
    const deltaY = Math.abs(rangeSelection.currentY - rangeSelection.startY);
    if (deltaX < 4 && deltaY < 4) {
      return;
    }
    const nextIds = getSelectionIds(rangeSelection);
    setSelectedClipIds(nextIds);
    setSelectedClipId(nextIds[0] ?? null);
    const nextEntry = timelineLayout.find(
      (entry) => entry.clip.id === nextIds[0]
    );
    setActiveAssetId(nextEntry?.asset.id ?? null);
  }, [rangeSelection, getSelectionIds, timelineLayout]);

  useEffect(() => {
    if (!stageSelection) {
      return;
    }
    const handleMove = (event: globalThis.PointerEvent) => {
      setStageSelection((prev) =>
        prev
          ? {
            ...prev,
            currentX: event.clientX,
            currentY: event.clientY,
          }
          : prev
      );
    };
    const handleUp = () => {
      setStageSelection((prev) => {
        if (!prev) {
          return prev;
        }
        const deltaX = Math.abs(prev.currentX - prev.startX);
        const deltaY = Math.abs(prev.currentY - prev.startY);
        if (deltaX < 4 && deltaY < 4) {
          if (!prev.additive) {
            setSelectedClipIds([]);
            setSelectedClipId(null);
            setActiveCanvasClipId(null);
            setActiveAssetId(null);
            setIsBackgroundSelected(true);
          }
          return null;
        }
        const nextIds = getStageSelectionIds(prev);
        setSelectedClipIds(nextIds);
        if (nextIds.length === 1) {
          setSelectedClipId(nextIds[0]);
          setActiveCanvasClipId(nextIds[0]);
          const entry = visualStack.find(
            (item) => item.clip.id === nextIds[0]
          );
          setActiveAssetId(entry?.asset.id ?? null);
        } else {
          setSelectedClipId(null);
          setActiveCanvasClipId(null);
          setActiveAssetId(null);
        }
        setIsBackgroundSelected(false);
        return null;
      });
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [stageSelection, getStageSelectionIds, visualStack]);

  useEffect(() => {
    if (!stageSelection) {
      return;
    }
    const deltaX = Math.abs(stageSelection.currentX - stageSelection.startX);
    const deltaY = Math.abs(stageSelection.currentY - stageSelection.startY);
    if (deltaX < 4 && deltaY < 4) {
      return;
    }
    const nextIds = getStageSelectionIds(stageSelection);
    setSelectedClipIds(nextIds);
    if (nextIds.length === 1) {
      setSelectedClipId(nextIds[0]);
      setActiveCanvasClipId(nextIds[0]);
      const entry = visualStack.find((item) => item.clip.id === nextIds[0]);
      setActiveAssetId(entry?.asset.id ?? null);
    } else {
      setSelectedClipId(null);
      setActiveCanvasClipId(null);
    }
  }, [stageSelection, getStageSelectionIds, visualStack]);

  useEffect(() => {
    if (!dragClipState) {
      return;
    }
    const handleMove = (event: MouseEvent) => {
      const dragged = timeline.find((clip) => clip.id === dragClipState.clipId);
      if (!dragged) {
        return;
      }
      if (!dragClipHistoryRef.current) {
        pushHistory();
        dragClipHistoryRef.current = true;
      }
      const asset = assetsRef.current.find(
        (item) => item.id === dragged.assetId
      );
      const track = timelineTrackRef.current;
      const deltaSeconds =
        (event.clientX - dragClipState.startX) / timelineScale;
      const rawTime = dragClipState.startLeft + deltaSeconds;
      const dragDirection = Math.sign(deltaSeconds);
      const snapThresholdSeconds = snapThresholdPx / timelineScale;
      const frameThresholdSeconds = frameStepSeconds;
      let targetTime = rawTime;
      let snapGuide: number | null = null;
      const candidateEdges: number[] = [0];
      timeline.forEach((clip) => {
        if (clip.id === dragged.id) {
          return;
        }
        candidateEdges.push(clip.startTime, clip.startTime + clip.duration);
      });
      if (!event.altKey && isTimelineSnappingEnabled) {
        const gridTime = Math.round(rawTime / snapInterval) * snapInterval;
        targetTime = gridTime;
        let bestDistance = snapThresholdSeconds + 1;
        let bestTime: number | null = null;
        let bestGuide: number | null = null;
        candidateEdges.forEach((edge) => {
          const startCandidate = edge;
          const endCandidate = edge - dragged.duration;
          const startDistance = Math.abs(rawTime - startCandidate);
          if (startDistance < bestDistance) {
            bestDistance = startDistance;
            bestTime = startCandidate;
            bestGuide = edge;
          }
          const endDistance = Math.abs(rawTime - endCandidate);
          if (endDistance < bestDistance) {
            bestDistance = endDistance;
            bestTime = endCandidate;
            bestGuide = edge;
          }
        });
        if (bestTime !== null && bestDistance <= snapThresholdSeconds) {
          targetTime = bestTime;
          snapGuide = bestGuide;
        }
        if (snapGuide === null) {
          let frameDistance = frameThresholdSeconds + 1;
          let frameTime: number | null = null;
          let frameGuide: number | null = null;
          candidateEdges.forEach((edge) => {
            const startDistance = Math.abs(rawTime - edge);
            if (startDistance < frameDistance) {
              frameDistance = startDistance;
              frameTime = edge;
              frameGuide = edge;
            }
            const endDistance = Math.abs(
              rawTime - (edge - dragged.duration)
            );
            if (endDistance < frameDistance) {
              frameDistance = endDistance;
              frameTime = edge - dragged.duration;
              frameGuide = edge;
            }
          });
          if (frameTime !== null && frameDistance <= frameThresholdSeconds) {
            targetTime = frameTime;
            snapGuide = frameGuide;
          }
        }
      }
      const maxStart = Math.max(0, timelineDuration + 10);
      let liveTime = clamp(normalizeTimelineTime(targetTime), 0, maxStart);
      if (event.altKey || !isTimelineSnappingEnabled) {
        liveTime = clamp(normalizeTimelineTime(rawTime), 0, maxStart);
        snapGuide = null;
      }
      let targetLaneId = dragClipState.targetLaneId ?? dragClipState.startLaneId;
      let createdLaneId = dragClipState.createdLaneId;
      const assetLaneType = asset ? getLaneType(asset) : null;
      if (track) {
        const rect = track.getBoundingClientRect();
        const offsetY = event.clientY - rect.top - timelinePadding;
        let cursor = 0;
        let foundLaneId: string | null = null;
        let foundLaneIndex = -1;
        if (laneRows.length > 0) {
          // Calculate section boundaries
          let videoSectionEnd = 0;
          let audioSectionStart = -1;
          let sectionCursor = 0;
          for (let i = 0; i < laneRows.length; i++) {
            const lane = laneRows[i];
            if (lane.type !== "audio") {
              videoSectionEnd = sectionCursor + lane.height + laneGap;
            } else if (audioSectionStart === -1) {
              audioSectionStart = sectionCursor;
            }
            sectionCursor += lane.height + laneGap;
          }
          const totalHeight = sectionCursor - laneGap;

          if (offsetY < 0) {
            // Dragging above all lanes - create new lane at top of appropriate section
            if (!createdLaneId && assetLaneType) {
              const nextLanes = [...lanesRef.current];
              createdLaneId = createLaneId(assetLaneType, nextLanes);
              setLanes(nextLanes);
            }
            foundLaneId = createdLaneId ?? null;
          } else if (offsetY > totalHeight + laneGap) {
            // Dragging below all lanes - create new lane
            if (!createdLaneId && assetLaneType) {
              const nextLanes = [...lanesRef.current];
              createdLaneId = createLaneId(assetLaneType, nextLanes);
              setLanes(nextLanes);
            }
            foundLaneId = createdLaneId ?? null;
          } else {
            // Find which lane we're hovering over
            // Use reduced hit area - bottom 50% of gap triggers "create new lane"
            const gapThreshold = 0.5; // Top 50% of gap belongs to lane, bottom 50% creates new lane
            let wantsNewLane = false;
            
            for (let i = 0; i < laneRows.length; i++) {
              const lane = laneRows[i];
              const laneTop = cursor;
              const laneVisualBottom = cursor + lane.height;
              const laneHitBottom = cursor + lane.height + laneGap;
              const gapSplit = laneVisualBottom + laneGap * gapThreshold;
              
              if (offsetY >= laneTop && offsetY <= laneHitBottom) {
                // Check if we're in the "create new lane" zone (bottom part of gap)
                if (offsetY > gapSplit && i < laneRows.length - 1) {
                  // In the bottom portion of the gap - user wants to create new lane
                  wantsNewLane = true;
                  // But only if the next lane is the same type (otherwise we're crossing into different section)
                  const nextLane = laneRows[i + 1];
                  if (nextLane.type !== assetLaneType) {
                    // Next lane is different type - don't create, just use current
                    foundLaneId = lane.id;
                    foundLaneIndex = i;
                    wantsNewLane = false;
                  }
                } else {
                  foundLaneId = lane.id;
                  foundLaneIndex = i;
                }
                break;
              }
              cursor += lane.height + laneGap;
            }
            
            // Create new lane if user dragged into gap zone
            if (wantsNewLane && assetLaneType) {
              if (!createdLaneId) {
                const nextLanes = [...lanesRef.current];
                createdLaneId = createLaneId(assetLaneType, nextLanes);
                setLanes(nextLanes);
              }
              foundLaneId = createdLaneId;
            }
            
            // Check if we're in the gap between video section and audio section
            // This is where users drag to create a new video lane
            if (!foundLaneId && assetLaneType !== "audio" && audioSectionStart > 0) {
              if (offsetY >= videoSectionEnd && offsetY < audioSectionStart) {
                // In the gap - create new video/text lane
                if (!createdLaneId) {
                  const nextLanes = [...lanesRef.current];
                  createdLaneId = createLaneId(assetLaneType!, nextLanes);
                  setLanes(nextLanes);
                }
                foundLaneId = createdLaneId;
              }
            }
          }
        }
        // Check lane type compatibility - enforce lane ordering rules
        // Audio lanes stay at bottom, video/text lanes stay above audio
        if (foundLaneId && foundLaneIndex >= 0 && assetLaneType) {
          const foundLane = laneRows[foundLaneIndex];
          if (foundLane && foundLane.type !== assetLaneType) {
            // Lane type mismatch - find nearest compatible lane respecting ordering rules
            let compatibleLaneId: string | null = null;
            
            if (assetLaneType === "audio") {
              // Audio clips can only go to audio lanes (at bottom) - search below only
              for (let i = foundLaneIndex + 1; i < laneRows.length; i++) {
                if (laneRows[i].type === "audio") {
                  compatibleLaneId = laneRows[i].id;
                  break;
                }
              }
            } else {
              // Video/text clips stay above audio - search above only, never into audio section
              for (let i = foundLaneIndex - 1; i >= 0; i--) {
                if (laneRows[i].type === assetLaneType) {
                  compatibleLaneId = laneRows[i].id;
                  break;
                }
              }
              // If no exact match found above, find any non-audio lane above
              if (!compatibleLaneId) {
                for (let i = foundLaneIndex - 1; i >= 0; i--) {
                  if (laneRows[i].type !== "audio") {
                    // For video, accept video lanes; for text, accept text lanes
                    if (laneRows[i].type === assetLaneType) {
                      compatibleLaneId = laneRows[i].id;
                      break;
                    }
                  }
                }
              }
            }
            
            // If no compatible lane found, create a new one (will be inserted at correct position)
            if (!compatibleLaneId) {
              if (!createdLaneId) {
                const nextLanes = [...lanesRef.current];
                createdLaneId = createLaneId(assetLaneType, nextLanes);
                setLanes(nextLanes);
              }
              compatibleLaneId = createdLaneId;
            }
            
            foundLaneId = compatibleLaneId;
          }
        }
        if (foundLaneId) {
          targetLaneId = foundLaneId;
        }
      }
      const resolveNonOverlappingStart = (
        startTime: number,
        duration: number,
        laneId: string,
        direction: number
      ) => {
        const occupied = timeline
          .filter(
            (clip) => clip.laneId === laneId && clip.id !== dragged.id
          )
          .map((clip) => ({
            start: clip.startTime,
            end: clip.startTime + clip.duration,
          }))
          .sort((a, b) => a.start - b.start);
        if (occupied.length === 0) {
          return { start: startTime, collision: false };
        }
        const dragEnd = startTime + duration;
        const overlaps = occupied.some(
          (slot) =>
            startTime < slot.end - timelineClipEpsilon &&
            dragEnd > slot.start + timelineClipEpsilon
        );
        if (!overlaps) {
          return { start: startTime, collision: false };
        }
        const insertionPoints = new Set<number>([0]);
        let cursor = 0;
        occupied.forEach((slot) => {
          insertionPoints.add(slot.start);
          insertionPoints.add(slot.end);
          cursor = Math.max(cursor, slot.end);
        });
        insertionPoints.add(cursor);
        const points = Array.from(insertionPoints).sort((a, b) => a - b);
        const forwardPoints = points.filter(
          (point) => point >= startTime - timelineClipEpsilon
        );
        const backwardPoints = points.filter(
          (point) => point <= startTime + timelineClipEpsilon
        );
        let candidate = startTime;
        if (direction > 0 && forwardPoints.length > 0) {
          candidate = forwardPoints[0];
        } else if (direction < 0 && backwardPoints.length > 0) {
          candidate = backwardPoints[backwardPoints.length - 1];
        } else {
          let bestDistance = Number.POSITIVE_INFINITY;
          points.forEach((point) => {
            const distance = Math.abs(point - startTime);
            if (distance < bestDistance) {
              bestDistance = distance;
              candidate = point;
            }
          });
        }
        return {
          start: clamp(candidate, 0, maxStart),
          collision: true,
        };
      };
      const resolved = resolveNonOverlappingStart(
        liveTime,
        dragged.duration,
        targetLaneId,
        dragDirection
      );
      const nextDragState = {
        ...dragClipState,
        targetLaneId,
        createdLaneId,
        previewTime: resolved.start,
        previewLaneId: targetLaneId,
      };
      dragClipStateRef.current = nextDragState;
      setDragClipState((prev) => (prev ? nextDragState : prev));
      if (resolved.collision) {
        setTimelineCollisionGuide(resolved.start);
        setTimelineCollisionActive(true);
      } else if (timelineCollisionGuide !== null) {
        setTimelineCollisionGuide(null);
        setTimelineCollisionActive(false);
      }
      if (snapGuide !== null) {
        setTimelineSnapGuide(snapGuide);
      } else if (timelineSnapGuide !== null) {
        setTimelineSnapGuide(null);
      }
      setTimeline((prev) =>
        prev.map((clip) =>
          clip.id === dragged.id
            ? {
              ...clip,
              startTime: liveTime,
              laneId: targetLaneId,
            }
            : clip
        )
      );
    };
    const handleUp = () => {
      const dragState = dragClipStateRef.current;
      if (!dragState) {
        return;
      }
      setTimeline((prev) => {
        const dragged = prev.find((clip) => clip.id === dragState.clipId);
        if (!dragged) {
          return prev;
        }
        const targetLaneId =
          dragState.previewLaneId ??
          dragState.targetLaneId ??
          dragState.startLaneId;
        const resolvedStart = clamp(
          normalizeTimelineTime(dragState.previewTime ?? dragged.startTime),
          0,
          Math.max(0, timelineDuration + 10)
        );
        const laneClips = prev
          .filter(
            (clip) => clip.laneId === targetLaneId || clip.id === dragged.id
          )
          .map((clip) =>
            clip.id === dragged.id
              ? { ...clip, laneId: targetLaneId, startTime: resolvedStart }
              : { ...clip }
          )
          .sort((a, b) => {
            if (a.startTime !== b.startTime) {
              return a.startTime - b.startTime;
            }
            if (a.id === dragged.id) {
              return -1;
            }
            if (b.id === dragged.id) {
              return 1;
            }
            return 0;
          });
        let cursor = 0;
        const updatedStarts = new Map<string, number>();
        laneClips.forEach((clip) => {
          let nextStart = clip.startTime;
          if (nextStart < cursor - timelineClipEpsilon) {
            nextStart = cursor;
          }
          nextStart = normalizeTimelineTime(Math.max(0, nextStart));
          updatedStarts.set(clip.id, nextStart);
          cursor = nextStart + clip.duration;
        });
        return prev.map((clip) => {
          if (clip.laneId !== targetLaneId && clip.id !== dragged.id) {
            return clip;
          }
          const nextStart = updatedStarts.get(clip.id);
          if (nextStart === undefined) {
            return clip;
          }
          if (clip.id === dragged.id) {
            return {
              ...clip,
              laneId: targetLaneId,
              startTime: nextStart,
            };
          }
          if (Math.abs(clip.startTime - nextStart) < timelineClipEpsilon) {
            return clip;
          }
          return { ...clip, startTime: nextStart };
        });
      });
      dragClipHistoryRef.current = false;
      setTimelineSnapGuide(null);
      setTimelineCollisionGuide(null);
      setTimelineCollisionActive(false);
      setDragClipState(null);
      dragClipStateRef.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [
    dragClipState,
    pushHistory,
    timeline,
    timelineScale,
    timelineDuration,
    laneRows,
    isTimelineSnappingEnabled,
    timelineSnapGuide,
    timelineCollisionGuide,
  ]);

  useEffect(() => {
    if (!activeCanvasClipId) {
      return;
    }
    const stillExists = timeline.some((clip) => clip.id === activeCanvasClipId);
    if (!stillExists) {
      setActiveCanvasClipId(null);
    }
  }, [activeCanvasClipId, timeline]);

  useEffect(() => {
    if (!dragTransformState) {
      return;
    }
    const handleMove = (event: globalThis.PointerEvent) => {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      if (!dragTransformHistoryRef.current) {
        pushHistory();
        dragTransformHistoryRef.current = true;
      }
      const rect = stage.getBoundingClientRect();
      const deltaX = (event.clientX - dragTransformState.startX) / rect.width;
      const deltaY = (event.clientY - dragTransformState.startY) / rect.height;
      const draftRect = {
        ...dragTransformState.startRect,
        x: dragTransformState.startRect.x + deltaX,
        y: dragTransformState.startRect.y + deltaY,
      };
      const clipWidthPx = draftRect.width * rect.width;
      const clipHeightPx = draftRect.height * rect.height;
      const proposedLeftPx = draftRect.x * rect.width;
      const proposedTopPx = draftRect.y * rect.height;
      const stageLinesX = [0, rect.width / 2, rect.width];
      const stageLinesY = [0, rect.height / 2, rect.height];
      const backgroundLinesX: number[] = [];
      const backgroundLinesY: number[] = [];
      if (baseBackgroundTransform) {
        const bgLeft = baseBackgroundTransform.x * rect.width;
        const bgTop = baseBackgroundTransform.y * rect.height;
        const bgWidth = baseBackgroundTransform.width * rect.width;
        const bgHeight = baseBackgroundTransform.height * rect.height;
        backgroundLinesX.push(bgLeft, bgLeft + bgWidth / 2, bgLeft + bgWidth);
        backgroundLinesY.push(bgTop, bgTop + bgHeight / 2, bgTop + bgHeight);
      }
      // Add snap lines from other visible clips
      const otherClipLinesX: number[] = [];
      const otherClipLinesY: number[] = [];
      visualStack.forEach((entry) => {
        if (entry.clip.id === dragTransformState.clipId) {
          return; // Skip the clip being dragged
        }
        const otherTransform = clipTransforms[entry.clip.id];
        if (!otherTransform) {
          return;
        }
        const otherLeft = otherTransform.x * rect.width;
        const otherTop = otherTransform.y * rect.height;
        const otherWidth = otherTransform.width * rect.width;
        const otherHeight = otherTransform.height * rect.height;
        // Add edges and center of other clips
        otherClipLinesX.push(otherLeft, otherLeft + otherWidth / 2, otherLeft + otherWidth);
        otherClipLinesY.push(otherTop, otherTop + otherHeight / 2, otherTop + otherHeight);
      });
      const xLines = Array.from(new Set([...stageLinesX, ...backgroundLinesX, ...otherClipLinesX]));
      const yLines = Array.from(new Set([...stageLinesY, ...backgroundLinesY, ...otherClipLinesY]));
      const snapAxis = (
        startPx: number,
        sizePx: number,
        lines: number[]
      ) => {
        const edges = [startPx, startPx + sizePx / 2, startPx + sizePx];
        let bestOffset = 0;
        let bestLine: number | null = null;
        let bestDistance = snapThresholdPx + 1;
        lines.forEach((line) => {
          edges.forEach((edge) => {
            const distance = line - edge;
            const abs = Math.abs(distance);
            if (abs <= snapThresholdPx && abs < bestDistance) {
              bestDistance = abs;
              bestOffset = distance;
              bestLine = line;
            }
          });
        });
        return {
          value: startPx + bestOffset,
          guide: bestLine,
        };
      };
      const snappedX = snapAxis(proposedLeftPx, clipWidthPx, xLines);
      const snappedY = snapAxis(proposedTopPx, clipHeightPx, yLines);
      if (snappedX.guide || snappedY.guide) {
        setSnapGuides({
          x: snappedX.guide ? [snappedX.guide] : [],
          y: snappedY.guide ? [snappedY.guide] : [],
        });
      } else if (snapGuides) {
        setSnapGuides(null);
      }
      const next = clampTransformToStage(
        {
          ...draftRect,
          x: snappedX.value / rect.width,
          y: snappedY.value / rect.height,
        },
        { width: rect.width, height: rect.height },
        getClipMinSize(dragTransformState.clipId)
      );
      clipTransformTouchedRef.current.add(dragTransformState.clipId);
      setClipTransforms((prev) => ({
        ...prev,
        [dragTransformState.clipId]: next,
      }));
    };
    const handleUp = () => {
      setDragTransformState(null);
      setSnapGuides(null);
      dragTransformHistoryRef.current = false;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [
    dragTransformState,
    baseBackgroundTransform,
    snapGuides,
    pushHistory,
    getClipMinSize,
    visualStack,
    clipTransforms,
  ]);

  useEffect(() => {
    if (!resizeTransformState) {
      return;
    }
    const handleMove = (event: globalThis.PointerEvent) => {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      if (!resizeTransformHistoryRef.current) {
        pushHistory();
        resizeTransformHistoryRef.current = true;
      }
      const rect = stage.getBoundingClientRect();
      const deltaX = (event.clientX - resizeTransformState.startX) / rect.width;
      const deltaY =
        (event.clientY - resizeTransformState.startY) / rect.height;
      const handle = resizeTransformState.handle;
      const isTextClip =
        clipAssetKindMap.get(resizeTransformState.clipId) === "text";
      const hasHorizontal = handle.includes("w") || handle.includes("e");
      const hasVertical = handle.includes("n") || handle.includes("s");
      const isCornerHandle = hasHorizontal && hasVertical;
      // Corner handles: maintain aspect ratio by default (shift to free resize)
      // Edge handles: free resize by default (shift to maintain aspect ratio)
      // Text clips: always free resize by default (shift to maintain aspect)
      const keepAspect = isTextClip
        ? event.shiftKey
        : isCornerHandle
          ? !event.shiftKey
          : event.shiftKey;
      const ratio =
        resizeTransformState.aspectRatio ||
        resizeTransformState.startRect.width /
        resizeTransformState.startRect.height ||
        1;
      let next: ClipTransform;

      if (keepAspect) {
        if (hasHorizontal && hasVertical) {
          const rawWidth =
            resizeTransformState.startRect.width +
            (handle.includes("e") ? deltaX : -deltaX);
          const rawHeight =
            resizeTransformState.startRect.height +
            (handle.includes("s") ? deltaY : -deltaY);
          const scaleX = rawWidth / resizeTransformState.startRect.width;
          const scaleY = rawHeight / resizeTransformState.startRect.height;
          const scale = Math.max(scaleX, scaleY);
          const width = resizeTransformState.startRect.width * scale;
          const height = width / ratio;
          next = {
            x: handle.includes("w")
              ? resizeTransformState.startRect.x +
              (resizeTransformState.startRect.width - width)
              : resizeTransformState.startRect.x,
            y: handle.includes("n")
              ? resizeTransformState.startRect.y +
              (resizeTransformState.startRect.height - height)
              : resizeTransformState.startRect.y,
            width,
            height,
          };
        } else if (hasHorizontal) {
          const rawWidth =
            resizeTransformState.startRect.width +
            (handle.includes("e") ? deltaX : -deltaX);
          const width = rawWidth;
          const height = width / ratio;
          const centerY =
            resizeTransformState.startRect.y +
            resizeTransformState.startRect.height / 2;
          next = {
            x: handle.includes("w")
              ? resizeTransformState.startRect.x +
              (resizeTransformState.startRect.width - width)
              : resizeTransformState.startRect.x,
            y: centerY - height / 2,
            width,
            height,
          };
        } else {
          const rawHeight =
            resizeTransformState.startRect.height +
            (handle.includes("s") ? deltaY : -deltaY);
          const height = rawHeight;
          const width = height * ratio;
          const centerX =
            resizeTransformState.startRect.x +
            resizeTransformState.startRect.width / 2;
          next = {
            x: centerX - width / 2,
            y: handle.includes("n")
              ? resizeTransformState.startRect.y +
              (resizeTransformState.startRect.height - height)
              : resizeTransformState.startRect.y,
            width,
            height,
          };
        }
      } else {
        let { x, y, width, height } = resizeTransformState.startRect;
        if (handle.includes("e")) {
          width = resizeTransformState.startRect.width + deltaX;
        }
        if (handle.includes("w")) {
          width = resizeTransformState.startRect.width - deltaX;
          x = resizeTransformState.startRect.x + deltaX;
        }
        if (handle.includes("s")) {
          height = resizeTransformState.startRect.height + deltaY;
        }
        if (handle.includes("n")) {
          height = resizeTransformState.startRect.height - deltaY;
          y = resizeTransformState.startRect.y + deltaY;
        }
        next = { x, y, width, height };
      }

      // Apply snapping during resize
      const stageLinesX = [0, rect.width / 2, rect.width];
      const stageLinesY = [0, rect.height / 2, rect.height];
      const otherClipLinesX: number[] = [];
      const otherClipLinesY: number[] = [];
      visualStack.forEach((entry) => {
        if (entry.clip.id === resizeTransformState.clipId) {
          return;
        }
        const otherTransform = clipTransforms[entry.clip.id];
        if (!otherTransform) {
          return;
        }
        const otherLeft = otherTransform.x * rect.width;
        const otherTop = otherTransform.y * rect.height;
        const otherWidth = otherTransform.width * rect.width;
        const otherHeight = otherTransform.height * rect.height;
        otherClipLinesX.push(otherLeft, otherLeft + otherWidth / 2, otherLeft + otherWidth);
        otherClipLinesY.push(otherTop, otherTop + otherHeight / 2, otherTop + otherHeight);
      });
      const xLines = Array.from(new Set([...stageLinesX, ...otherClipLinesX]));
      const yLines = Array.from(new Set([...stageLinesY, ...otherClipLinesY]));

      // Snap the edges being resized
      const snapEdge = (edgePx: number, lines: number[]) => {
        let bestOffset = 0;
        let bestLine: number | null = null;
        let bestDistance = snapThresholdPx + 1;
        lines.forEach((line) => {
          const distance = line - edgePx;
          const abs = Math.abs(distance);
          if (abs <= snapThresholdPx && abs < bestDistance) {
            bestDistance = abs;
            bestOffset = distance;
            bestLine = line;
          }
        });
        return { offset: bestOffset, guide: bestLine };
      };

      let snappedGuideX: number | null = null;
      let snappedGuideY: number | null = null;

      // Snap right edge when resizing from east
      if (handle.includes("e")) {
        const rightEdgePx = (next.x + next.width) * rect.width;
        const snap = snapEdge(rightEdgePx, xLines);
        if (snap.guide !== null) {
          next.width = snap.guide / rect.width - next.x;
          snappedGuideX = snap.guide;
        }
      }
      // Snap left edge when resizing from west
      if (handle.includes("w")) {
        const leftEdgePx = next.x * rect.width;
        const snap = snapEdge(leftEdgePx, xLines);
        if (snap.guide !== null) {
          const rightEdge = next.x + next.width;
          next.x = snap.guide / rect.width;
          next.width = rightEdge - next.x;
          snappedGuideX = snap.guide;
        }
      }
      // Snap bottom edge when resizing from south
      if (handle.includes("s")) {
        const bottomEdgePx = (next.y + next.height) * rect.height;
        const snap = snapEdge(bottomEdgePx, yLines);
        if (snap.guide !== null) {
          next.height = snap.guide / rect.height - next.y;
          snappedGuideY = snap.guide;
        }
      }
      // Snap top edge when resizing from north
      if (handle.includes("n")) {
        const topEdgePx = next.y * rect.height;
        const snap = snapEdge(topEdgePx, yLines);
        if (snap.guide !== null) {
          const bottomEdge = next.y + next.height;
          next.y = snap.guide / rect.height;
          next.height = bottomEdge - next.y;
          snappedGuideY = snap.guide;
        }
      }

      if (snappedGuideX !== null || snappedGuideY !== null) {
        setSnapGuides({
          x: snappedGuideX !== null ? [snappedGuideX] : [],
          y: snappedGuideY !== null ? [snappedGuideY] : [],
        });
      } else {
        setSnapGuides(null);
      }

      const clamped = clampTransformToStage(
        next,
        { width: rect.width, height: rect.height },
        getClipMinSize(resizeTransformState.clipId)
      );
      clipTransformTouchedRef.current.add(resizeTransformState.clipId);
      if (isTextClip && hasHorizontal && hasVertical) {
        const resizeFont = resizeTextFontRef.current;
        if (resizeFont && resizeFont.clipId === resizeTransformState.clipId) {
          const startWidth = resizeTransformState.startRect.width;
          const startHeight = resizeTransformState.startRect.height;
          const widthRatio = startWidth > 0 ? clamped.width / startWidth : 1;
          const heightRatio = startHeight > 0 ? clamped.height / startHeight : 1;
          const scale = Math.sqrt(widthRatio * heightRatio);
          if (Number.isFinite(scale) && scale > 0) {
            const nextFontSize = clamp(
              resizeFont.fontSize * scale,
              textResizeMinFontSize,
              textResizeMaxFontSize
            );
            setTextSettings((prev) => {
              const current = prev[resizeTransformState.clipId];
              if (!current) {
                return prev;
              }
              if (Math.abs(current.fontSize - nextFontSize) < 0.1) {
                return prev;
              }
              return {
                ...prev,
                [resizeTransformState.clipId]: {
                  ...current,
                  fontSize: nextFontSize,
                },
              };
            });
            if (selectedTextEntry?.clip.id === resizeTransformState.clipId) {
              setTextPanelFontSizeDisplay((prev) =>
                Math.abs(prev - nextFontSize) < 0.1 ? prev : nextFontSize
              );
            }
          }
        }
      }
      if (isTextClip) {
        resizeTextRectRef.current = clamped;
      }
      setClipTransforms((prev) => ({
        ...prev,
        [resizeTransformState.clipId]: clamped,
      }));
    };
    const handleUp = () => {
      const clipId = resizeTransformState.clipId;
      const isTextClip = clipAssetKindMap.get(clipId) === "text";
      if (isTextClip) {
        const stage = stageRef.current;
        const settings =
          textSettingsRef.current[clipId] ?? fallbackTextSettings;
        if (stage) {
          const rect = stage.getBoundingClientRect();
          const target =
            resizeTextRectRef.current ??
            resizeTransformState.startRect;
          const bounds = measureTextBounds(settings);
          const widthPx = target.width * rect.width;
          const heightPx = target.height * rect.height;
          const nextScaleX =
            bounds.width > 0
              ? clamp(widthPx / bounds.width, 0.1, 10)
              : 1;
          const nextScaleY =
            bounds.height > 0
              ? clamp(heightPx / bounds.height, 0.1, 10)
              : 1;
          setTextSettings((prev) => {
            const current = prev[clipId] ?? settings;
            if (
              current.boxScaleX === nextScaleX &&
              current.boxScaleY === nextScaleY &&
              current.autoSize !== false
            ) {
              return prev;
            }
            return {
              ...prev,
              [clipId]: {
                ...current,
                autoSize: true,
                boxScaleX: nextScaleX,
                boxScaleY: nextScaleY,
              },
            };
          });
        }
      }
      setResizeTransformState(null);
      setSnapGuides(null);
      resizeTextRectRef.current = null;
      resizeTextFontRef.current = null;
      resizeTransformHistoryRef.current = false;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [
    resizeTransformState,
    pushHistory,
    getClipMinSize,
    clipAssetKindMap,
    fallbackTextSettings,
    selectedTextEntry,
    visualStack,
    clipTransforms,
  ]);

  // Rotation effect
  useEffect(() => {
    if (!rotateTransformState) {
      return;
    }
    const handleMove = (event: globalThis.PointerEvent) => {
      if (!rotateTransformHistoryRef.current) {
        pushHistory();
        rotateTransformHistoryRef.current = true;
      }
      // Calculate angle from center to current mouse position
      const dx = event.clientX - rotateTransformState.centerX;
      const dy = event.clientY - rotateTransformState.centerY;
      const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);
      // Calculate angle from center to start position
      const startDx = rotateTransformState.startX - rotateTransformState.centerX;
      const startDy = rotateTransformState.startY - rotateTransformState.centerY;
      const startAngle = Math.atan2(startDy, startDx) * (180 / Math.PI);
      // Calculate rotation delta
      let deltaRotation = currentAngle - startAngle;
      // Normalize to -180 to 180
      while (deltaRotation > 180) deltaRotation -= 360;
      while (deltaRotation < -180) deltaRotation += 360;
      // Calculate new rotation
      let newRotation = rotateTransformState.startRotation + deltaRotation;
      // Snap to 0, 90, 180, -90 degrees when within 5 degrees
      const snapAngles = [0, 90, 180, -180, -90, 270, -270];
      for (const snapAngle of snapAngles) {
        if (Math.abs(newRotation - snapAngle) < 5) {
          newRotation = snapAngle === 270 ? -90 : snapAngle === -270 ? 90 : snapAngle;
          break;
        }
      }
      // Normalize to -180 to 180
      while (newRotation > 180) newRotation -= 360;
      while (newRotation < -180) newRotation += 360;
      clipTransformTouchedRef.current.add(rotateTransformState.clipId);
      setClipTransforms((prev) => {
        const current = prev[rotateTransformState.clipId];
        if (!current) {
          return prev;
        }
        return {
          ...prev,
          [rotateTransformState.clipId]: {
            ...current,
            rotation: newRotation,
          },
        };
      });
    };
    const handleUp = () => {
      setRotateTransformState(null);
      rotateTransformHistoryRef.current = false;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [rotateTransformState, pushHistory]);

  const handleAssetDragStart = (
    event: DragEvent<HTMLElement>,
    assetId: string
  ) => {
    event.dataTransfer.setData("text/plain", assetId);
    event.dataTransfer.effectAllowed = "copy";
  };

  const handleCanvasDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files ?? []);
    if (droppedFiles.length > 0) {
      await handleDroppedFiles(droppedFiles, { target: "canvas" });
      setDragOverCanvas(false);
      return;
    }
    const assetId = event.dataTransfer.getData("text/plain");
    if (assetId) {
      const assetExists = assetsRef.current.some(
        (asset) => asset.id === assetId
      );
      if (assetExists) {
        addToTimeline(assetId);
      }
    }
    setDragOverCanvas(false);
  };

  const handleTimelineDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files ?? []);
    if (droppedFiles.length > 0) {
      await handleDroppedFiles(droppedFiles, { target: "timeline", event });
      setDragOverTimeline(false);
      return;
    }
    const assetId = event.dataTransfer.getData("text/plain");
    if (assetId) {
      const assetExists = assetsRef.current.some(
        (asset) => asset.id === assetId
      );
      const track = timelineTrackRef.current;
      if (assetExists && track) {
        const asset = assetsRef.current.find((item) => item.id === assetId);
        if (!asset) {
          return;
        }
        const laneType = getLaneType(asset);
        const nextLanes = [...lanesRef.current];
        const rect = track.getBoundingClientRect();
        const offsetX = event.clientX - rect.left - timelinePadding;
        const offsetY = event.clientY - rect.top - timelinePadding;
        let laneId: string | null = null;
        let foundLaneIndex = -1;
        let cursor = 0;
        if (laneRows.length > 0) {
          // Calculate section boundaries for proper lane ordering
          let videoSectionEnd = 0;
          let audioSectionStart = -1;
          let sectionCursor = 0;
          for (let i = 0; i < laneRows.length; i++) {
            const lane = laneRows[i];
            if (lane.type !== "audio") {
              videoSectionEnd = sectionCursor + lane.height + laneGap;
            } else if (audioSectionStart === -1) {
              audioSectionStart = sectionCursor;
            }
            sectionCursor += lane.height + laneGap;
          }
          const totalHeight = sectionCursor - laneGap;

          if (offsetY < 0) {
            // Dragging above all lanes - create new lane
            laneId = createLaneId(laneType, nextLanes);
          } else if (offsetY > totalHeight + laneGap) {
            // Dragging below all lanes - create new lane (will be positioned correctly)
            laneId = createLaneId(laneType, nextLanes);
          } else {
            // Find which lane we're hovering over
            for (let i = 0; i < laneRows.length; i++) {
              const lane = laneRows[i];
              const laneTop = cursor;
              const laneBottom = cursor + lane.height + laneGap;
              if (offsetY >= laneTop && offsetY <= laneBottom) {
                laneId = lane.id;
                foundLaneIndex = i;
                break;
              }
              cursor += lane.height + laneGap;
            }
            
            // Check if in gap between video and audio section
            if (!laneId && laneType !== "audio" && audioSectionStart > 0) {
              if (offsetY >= videoSectionEnd && offsetY < audioSectionStart) {
                laneId = createLaneId(laneType, nextLanes);
              }
            }
          }
        }
        // Check lane type compatibility - enforce lane ordering rules
        // Audio lanes stay at bottom, video/text lanes stay above audio
        if (laneId && foundLaneIndex >= 0) {
          const foundLane = laneRows[foundLaneIndex];
          if (foundLane && foundLane.type !== laneType) {
            // Lane type mismatch - find compatible lane or create new one
            let compatibleLaneId: string | null = null;
            
            if (laneType === "audio") {
              // Audio clips can only go to audio lanes (at bottom) - search below only
              for (let i = foundLaneIndex + 1; i < laneRows.length; i++) {
                if (laneRows[i].type === "audio") {
                  compatibleLaneId = laneRows[i].id;
                  break;
                }
              }
            } else {
              // Video/text dragged onto audio - create new lane above audio
              // Don't search for existing, just create new (user wants new track)
            }
            
            // If no compatible lane found, create a new one (will be inserted at correct position)
            if (!compatibleLaneId) {
              compatibleLaneId = createLaneId(laneType, nextLanes);
            }
            
            laneId = compatibleLaneId;
          }
        }
        if (!laneId) {
          laneId = createLaneId(laneType, nextLanes);
        }
        setLanes(nextLanes);
        const startTime = offsetX / timelineScale;
        addClipAtPosition(assetId, laneId, startTime, asset);
      }
    }
    setDragOverTimeline(false);
  };

  const handleTimelineWheel = (
    event: ReactWheelEvent<HTMLDivElement> | globalThis.WheelEvent
  ) => {
    const scrollEl = timelineScrollRef.current;
    if (!scrollEl) {
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const rect = scrollEl.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const contentX = scrollEl.scrollLeft + offsetX - timelinePadding;
      const timeAtCursor = clamp(contentX / timelineScale, 0, timelineDuration);
      const zoomIntensity = 0.0025;
      const zoomFactor = Math.exp(-event.deltaY * zoomIntensity);
      const nextScale = clamp(
        timelineScale * zoomFactor,
        timelineScaleMin,
        timelineScaleMax
      );
      if (nextScale !== timelineScale) {
        setTimelineScale(nextScale);
        const nextScrollLeft =
          timeAtCursor * nextScale - offsetX + timelinePadding;
        scrollEl.scrollLeft = Math.max(0, nextScrollLeft);
      }
      return;
    }
    const { deltaX, deltaY } = event;
    if (
      scrollEl.scrollHeight > scrollEl.clientHeight &&
      Math.abs(deltaY) >= Math.abs(deltaX)
    ) {
      return;
    }
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return;
    }
    scrollEl.scrollLeft += deltaY;
    event.preventDefault();
  };

  useEffect(() => {
    const scrollEl = timelineScrollRef.current;
    if (!scrollEl) {
      return;
    }
    const handleNativeWheel = (event: globalThis.WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      handleTimelineWheel(event);
    };
    scrollEl.addEventListener("wheel", handleNativeWheel, {
      passive: false,
    });
    return () => {
      scrollEl.removeEventListener("wheel", handleNativeWheel);
    };
  }, [handleTimelineWheel]);

  const handleTimelinePanStart = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    if (event.target !== event.currentTarget) {
      return;
    }
    const scrollEl = timelineScrollRef.current;
    if (!scrollEl) {
      return;
    }
    timelinePanRef.current = {
      startX: event.clientX,
      scrollLeft: scrollEl.scrollLeft,
      active: true,
    };
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleTimelinePanMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!timelinePanRef.current.active || !timelineScrollRef.current) {
      return;
    }
    const delta = event.clientX - timelinePanRef.current.startX;
    timelineScrollRef.current.scrollLeft =
      timelinePanRef.current.scrollLeft - delta;
    event.preventDefault();
  };

  const handleTimelinePanEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (!timelinePanRef.current.active) {
      return;
    }
    timelinePanRef.current.active = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  useEffect(() => {
    if (!isScrubbing) {
      return;
    }
    const handleMove = (event: globalThis.PointerEvent) => {
      if (
        scrubPointerIdRef.current !== null &&
        event.pointerId !== scrubPointerIdRef.current
      ) {
        return;
      }
      handleScrubTo(event.clientX);
    };
    const handleUp = (event?: globalThis.PointerEvent) => {
      if (
        scrubPointerIdRef.current !== null &&
        event &&
        event.pointerId !== scrubPointerIdRef.current
      ) {
        return;
      }
      const target = scrubPointerTargetRef.current;
      const pointerId = scrubPointerIdRef.current;
      if (
        target &&
        pointerId !== null &&
        target.hasPointerCapture?.(pointerId)
      ) {
        target.releasePointerCapture(pointerId);
      }
      scrubPointerIdRef.current = null;
      scrubPointerTargetRef.current = null;
      setIsScrubbing(false);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [isScrubbing, timelineDuration, timelineScale, getClipAtTime]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const {
        currentTime: currentTimeRef,
        timelineDuration: timelineDurationRef,
        handleCopySelection: handleCopy,
        handleDeleteSelected: handleDelete,
        handleDuplicateClip: handleDuplicate,
        handlePasteSelection: handlePaste,
        handleRedo: redo,
        handleSelectAll: selectAll,
        handleSplitClip: splitClip,
        handleTogglePlayback: togglePlayback,
        handleUndo: undo,
        isEditableTarget: isEditable,
      } = keyboardStateRef.current;
      if (isEditable(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      const modKey = event.metaKey || event.ctrlKey;

      if (modKey) {
        if (key === "z") {
          event.preventDefault();
          if (event.shiftKey) {
            redo();
          } else {
            undo();
          }
          return;
        }
        if (key === "y") {
          event.preventDefault();
          redo();
          return;
        }
        if (key === "c") {
          event.preventDefault();
          handleCopy();
          return;
        }
        if (key === "x") {
          event.preventDefault();
          if (handleCopy()) {
            handleDelete();
          }
          return;
        }
        if (key === "v") {
          event.preventDefault();
          handlePaste();
          return;
        }
        if (key === "d") {
          event.preventDefault();
          handleDuplicate();
          return;
        }
        if (key === "a") {
          event.preventDefault();
          selectAll();
          return;
        }
        if (key === "=" || key === "+") {
          event.preventDefault();
          setTimelineScale((prev) =>
            clamp(prev + 2, timelineScaleMin, timelineScaleMax)
          );
          return;
        }
        if (key === "-" || key === "_") {
          event.preventDefault();
          setTimelineScale((prev) =>
            clamp(prev - 2, timelineScaleMin, timelineScaleMax)
          );
        }
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        togglePlayback();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        handleDelete();
        return;
      }

      if (key === "s") {
        event.preventDefault();
        splitClip();
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const step = event.shiftKey ? 1 : 0.1;
        const nextTime =
          event.key === "ArrowRight"
            ? currentTimeRef + step
            : currentTimeRef - step;
        setCurrentTime(clamp(nextTime, 0, timelineDurationRef));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, keyboardEffectDeps.current);

  const renderHeader = () => {
    const undoDisabled = !historyState.canUndo;
    const redoDisabled = !historyState.canRedo;
    return (
      <header className="min-h-16 border-b border-gray-200 bg-white px-5 py-2">
        <div className="flex w-full items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#C7D2FE] bg-white text-[12px] font-semibold text-[#335CFF]"
              type="button"
              aria-label="Home"
            >
              YA
            </button>
            <div className="flex h-10 items-center gap-2 rounded-full bg-gray-100/80 px-3.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                Project
              </span>
              <label htmlFor="project-name-input" className="sr-only">
                Project name
              </label>
              <input
                id="project-name-input"
                className="w-44 bg-transparent text-[15px] font-semibold text-gray-900 outline-none"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
              />
            </div>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200"
              type="button"
              aria-label="Project options"
            >
              <svg viewBox="0 0 16 16" className="h-4.5 w-4.5">
                <path
                  d="M6.75 8a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0M12 8a1.25 1.25 0 1 1 2.5 0A1.25 1.25 0 0 1 12 8M1.5 8A1.25 1.25 0 1 1 4 8a1.25 1.25 0 0 1-2.5 0"
                  fill="currentColor"
                />
              </svg>
            </button>
            <div className="hidden h-6 w-px bg-gray-200 md:block" />
            <div className="flex items-center gap-1">
              <button
                className={`flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 transition ${
                  undoDisabled
                    ? "cursor-not-allowed text-gray-300"
                    : "text-gray-500 hover:bg-gray-200"
                }`}
                type="button"
                aria-label="Undo"
                disabled={undoDisabled}
                onClick={handleUndo}
              >
                <svg viewBox="0 0 16 16" className="h-4.5 w-4.5">
                  <path
                    d="M3 8h7a3 3 0 0 1 3 3M3 8l3 3M3 8l3-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                className={`flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 transition ${
                  redoDisabled
                    ? "cursor-not-allowed text-gray-300"
                    : "text-gray-500 hover:bg-gray-200"
                }`}
                type="button"
                aria-label="Redo"
                disabled={redoDisabled}
                onClick={handleRedo}
              >
                <svg viewBox="0 0 16 16" className="h-4.5 w-4.5">
                  <path
                    d="M13 8H6a3 3 0 0 0-3 3m10-3-3 3m3-3-3-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex items-center justify-end">
            <button
              className="h-10 rounded-full bg-[#335CFF] px-5 text-sm font-semibold text-white shadow-[0_8px_16px_rgba(51,92,255,0.22)]"
              type="button"
            >
              Export
            </button>
          </div>
        </div>
      </header>
    );
  };

  const renderToolRail = () => (
    <aside className="hidden w-20 flex-col items-center border-r border-gray-200 bg-white lg:flex">
      <nav
        className="md:m-auto flex gap-3 p-4 md:gap-4 lg:mt-2 lg:w-full lg:flex-col lg:items-center lg:p-0"
        style={
          {
            "--subtitles-scale-subtitle-icon": "scale(1)",
            "--subtitles-current-hidden": "hidden",
            "--subtitles-current-percentage": "0",
            "--subtitles-current-percentage-diff": "0",
            "--subtitles-indicator-fill": "#5666f5",
          } as CSSProperties
        }
      >
        {toolbarItems.map((item) => {
          const isActive = item.id === activeTool;
          const itemClassName = isActive
            ? "group w-[60px] h-[60px] relative cursor-pointer flex flex-col justify-center items-center select-none font-medium text-blue-600 active"
            : "group w-[60px] h-[60px] relative cursor-pointer flex flex-col justify-center items-center select-none font-normal text-gray-600 hover:text-gray-600 hover:no-underline";
          const iconWrapperClassName = isActive
            ? "relative w-9 h-9 rounded-xl flex justify-center items-center bg-light-blue"
            : "relative w-9 h-9 rounded-xl flex justify-center items-center bg-transparent group-hover:bg-gray-500/10";
          const iconClassName = isActive
            ? "text-primary"
            : "text-gray-200 group-hover:text-gray-300";

          return (
            <button
              key={item.id}
              type="button"
              className={itemClassName}
              data-testid={item.testId}
              aria-current={isActive ? "page" : undefined}
              aria-disabled={false}
              draggable={false}
              onClick={() => setActiveTool(item.id)}
            >
              <div className={iconWrapperClassName}>
                {item.icon(iconClassName)}
              </div>
              <span className="mt-1 whitespace-nowrap text-xxs font-medium">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );

  const renderSidebar = () => {
    const isAudioTool = activeTool === "audio";
    const useAudioLibraryLayout = isAudioTool && !isAssetLibraryExpanded;

    return (
      <aside className="hidden h-full w-[360px] flex-col border-r border-gray-200 bg-white lg:flex">
      {showVideoPanel && selectedVideoEntry && selectedVideoSettings ? (
        <div className="flex h-full flex-col">
          {/* Minimal Header */}
          <div className="border-b border-gray-100/80 bg-white/80 px-4 py-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30 focus-visible:ring-offset-2"
                type="button"
                aria-label="Back"
                onClick={() => {
                  setSelectedClipId(null);
                  setSelectedClipIds([]);
                  setActiveCanvasClipId(null);
                }}
              >
                <svg viewBox="0 0 16 16" className="h-5 w-5">
                  <path d="M10 4 6 8l4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.01em] text-gray-900">
                  Edit Video
                </h2>
                <p className="max-w-[200px] truncate text-[11px] font-medium text-gray-400">
                  {selectedVideoEntry.asset.name}
                </p>
              </div>
            </div>

            {/* Edit / Adjust Tabs */}
            <div className="mt-4 flex gap-1 rounded-full bg-gray-100 p-1">
              <button
                className={`flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30 focus-visible:ring-offset-2 ${videoPanelView === "edit"
                  ? "bg-white text-[#335CFF] shadow-[0_4px_12px_rgba(15,23,42,0.12)]"
                  : "text-gray-500 hover:text-gray-700"
                  }`}
                type="button"
                onClick={() => setVideoPanelView("edit")}
              >
                <svg
                  viewBox="0 0 16 16"
                  className={`h-4 w-4 ${videoPanelView === "edit" ? "text-[#335CFF]" : "text-gray-500"}`}
                >
                  <path
                    d="M11.5 2.5l2 2-8 8-2.5.5.5-2.5 8-8z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Edit
              </button>
              <button
                className={`flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30 focus-visible:ring-offset-2 ${videoPanelView === "adjust"
                  ? "bg-white text-[#335CFF] shadow-[0_4px_12px_rgba(15,23,42,0.12)]"
                  : "text-gray-500 hover:text-gray-700"
                  }`}
                type="button"
                onClick={() => setVideoPanelView("adjust")}
              >
                <svg
                  viewBox="0 0 16 16"
                  className={`h-4 w-4 ${videoPanelView === "adjust" ? "text-[#335CFF]" : "text-gray-500"}`}
                >
                  <path d="M10 5.3a2 2 0 1 0 4 0 2 2 0 0 0-4 0m0 0H2.7m3.3 5.4a2 2 0 1 0-4 0 2 2 0 0 0 4 0m0 0h7.3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                Adjust
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {videoPanelView === "edit" ? (
              <>
                {/* Replace Button */}
                <button
                  className={`${panelButtonClass} justify-between`}
                  type="button"
                  onClick={() => replaceInputRef.current?.click()}
                >
                  <span className="flex items-center gap-2">
                    <svg viewBox="0 0 16 16" className="h-5 w-5 text-gray-500">
                      <path d="m2 9 2.4 2.5A4.9 4.9 0 0 0 8 13a5 5 0 0 0 4-2M2 9v2.8M2 9h2.8M14 7l-2.4-2.5A4.9 4.9 0 0 0 8 3a5 5 0 0 0-4 2M14 7V4.2M14 7h-2.8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Replace
                  </span>
                  <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-400">
                    <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <input
                  ref={replaceInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleReplaceVideo}
                />

                {/* Speed Control */}
                <div className={panelCardClass}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Speed</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {speedPresets.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${selectedVideoSettings.speed === preset
                            ? "bg-[#EEF2FF] text-[#335CFF] shadow-[inset_0_0_0_1px_rgba(51,92,255,0.25)]"
                            : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            }`}
                          onClick={() =>
                            updateClipSettings(selectedVideoEntry.clip.id, (current) => ({
                              ...current,
                              speed: preset,
                            }))
                          }
                        >
                          {preset}x
                        </button>
                      ))}
                      <button
                        type="button"
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${!speedPresets.includes(selectedVideoSettings.speed)
                          ? "bg-[#EEF2FF] text-[#335CFF] shadow-[inset_0_0_0_1px_rgba(51,92,255,0.25)]"
                          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                          }`}
                        onClick={() =>
                          updateClipSettings(selectedVideoEntry.clip.id, (current) => ({
                            ...current,
                            speed: speedPresets.includes(current.speed) ? 1.25 : current.speed,
                          }))
                        }
                      >
                        Custom
                      </button>
                    </div>
                  </div>
                  {!speedPresets.includes(selectedVideoSettings.speed) && (
                    <div className="mt-3 flex items-center justify-between rounded-lg border border-gray-200/70 bg-gray-50/70 px-3 py-2 text-xs text-gray-500">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                        Custom
                      </span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0.1}
                          max={4}
                          step={0.05}
                          value={selectedVideoSettings.speed}
                          onChange={(event) =>
                            updateClipSettings(selectedVideoEntry.clip.id, (current) => ({
                              ...current,
                              speed: clamp(Number(event.target.value), 0.1, 4),
                            }))
                          }
                          className="w-16 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700"
                        />
                        <span className="text-xs text-gray-400">x</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Volume Control */}
                <div className={panelCardClass}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateClipSettings(selectedVideoEntry.clip.id, (current) => ({
                            ...current,
                            muted: !current.muted,
                          }))
                        }
                        className="rounded-full p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30 focus-visible:ring-offset-2"
                        aria-label={selectedVideoSettings.muted ? "Unmute" : "Mute"}
                      >
                        {selectedVideoSettings.muted ? (
                          <svg viewBox="0 0 24 24" className="h-5 w-5">
                            <path d="M6 9h4l5-4v14l-5-4H6zM19 9l-4 4m0-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" className="h-5 w-5">
                            <path d="M12 6.1 7.6 9H5a3 3 0 0 0-3 3v0a3 3 0 0 0 3 3h2.6l4.4 3.6V6.1zM18.1 4.9a8.8 8.8 0 0 1 0 14.2M15.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                      <span className="text-sm font-semibold text-gray-700">Volume</span>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                      {selectedVideoSettings.muted ? 0 : selectedVideoSettings.volume}%
                    </span>
                  </div>
                  <div className="relative mt-3 h-4">
                    <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-gray-200/80" />
                    <div
                      className="pointer-events-none absolute left-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-[#5B6CFF]"
                      style={{
                        width: `${selectedVideoSettings.muted ? 0 : selectedVideoSettings.volume}%`,
                      }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={selectedVideoSettings.muted ? 0 : selectedVideoSettings.volume}
                      onChange={(event) =>
                        updateClipSettings(selectedVideoEntry.clip.id, (current) => ({
                          ...current,
                          volume: clamp(Number(event.target.value), 0, 100),
                          muted: clamp(Number(event.target.value), 0, 100) === 0,
                        }))
                      }
                      className="refined-slider relative z-10 h-4 w-full cursor-pointer appearance-none bg-transparent"
                      aria-label="Volume"
                    />
                  </div>
                </div>

                {/* Fade Audio In/Out */}
                <div className={panelCardClass}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg viewBox="0 0 16 16" className="h-5 w-5 text-gray-500">
                        <path d="M6.2 14V7.6M10 14V5M14 14V2M2 14V10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                      <span className="text-sm font-semibold text-gray-700">Fade Audio In/Out</span>
                    </div>
                    <ToggleSwitch
                      checked={selectedVideoSettings.fadeEnabled}
                      onChange={(next) =>
                        updateClipSettings(selectedVideoEntry.clip.id, (current) => ({
                          ...current,
                          fadeEnabled: next,
                        }))
                      }
                      ariaLabel="Toggle audio fade"
                    />
                  </div>
                  {selectedVideoSettings.fadeEnabled && (
                    <div className="mt-4 space-y-3">
                      <SliderField
                        label="Fade In"
                        value={selectedVideoSettings.fadeIn}
                        min={0}
                        max={5}
                        step={0.1}
                        valueLabel={`${selectedVideoSettings.fadeIn.toFixed(1)}s`}
                        onChange={(value) =>
                          updateClipSettings(selectedVideoEntry.clip.id, (current) => ({
                            ...current,
                            fadeIn: value,
                          }))
                        }
                      />
                      <SliderField
                        label="Fade Out"
                        value={selectedVideoSettings.fadeOut}
                        min={0}
                        max={5}
                        step={0.1}
                        valueLabel={`${selectedVideoSettings.fadeOut.toFixed(1)}s`}
                        onChange={(value) =>
                          updateClipSettings(selectedVideoEntry.clip.id, (current) => ({
                            ...current,
                            fadeOut: value,
                          }))
                        }
                      />
                    </div>
                  )}
                </div>

                <div className={`${panelCardClass} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                      <svg viewBox="0 0 16 16" className="h-4 w-4">
                        <path
                          d="M12.2 13a.8.8 0 1 0 1.6 0zM13 9h-.8zM7 3v.8zm-4-.8a.8.8 0 1 0 0 1.6zM14 13V9h-1.6v4zM7 2.2H3v1.6h4zM13.8 9A6.8 6.8 0 0 0 7 2.2v1.6c2.9 0 5.2 2.3 5.2 5.2z"
                          fill="currentColor"
                        />
                      </svg>
                      Round Corners
                    </div>
                    <ToggleSwitch
                      checked={selectedVideoSettings.roundCorners}
                      onChange={(next) =>
                        updateClipSettings(selectedVideoEntry.clip.id, (
                          current
                        ) => ({ ...current, roundCorners: next }))
                      }
                      ariaLabel="Toggle rounded corners"
                    />
                  </div>
                  {selectedVideoSettings.roundCorners && (
                    <div className="space-y-3">
                      <button
                        type="button"
                        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${selectedVideoSettings.cornerRadiusLinked
                          ? "border-[#C7D2FE] bg-[#EEF2FF] text-[#335CFF]"
                          : "border-gray-200/70 bg-gray-50 text-gray-500 hover:bg-white"
                          }`}
                        onClick={() =>
                          updateClipSettings(
                            selectedVideoEntry.clip.id,
                            (current) => {
                              const nextLinked = !current.cornerRadiusLinked;
                              return {
                                ...current,
                                cornerRadiusLinked: nextLinked,
                                cornerRadius: nextLinked
                                  ? current.cornerRadii.topLeft
                                  : current.cornerRadius,
                                cornerRadii: nextLinked
                                  ? current.cornerRadii
                                  : {
                                    topLeft: current.cornerRadius,
                                    topRight: current.cornerRadius,
                                    bottomRight: current.cornerRadius,
                                    bottomLeft: current.cornerRadius,
                                  },
                              };
                            }
                          )
                        }
                      >
                        <svg viewBox="0 0 16 16" className="h-4 w-4">
                          <path
                            d="m8.9 11.8-1.4 1.4a3.3 3.3 0 0 1-4.7-4.7l1.4-1.4M7.1 4.2l1.4-1.4a3.3 3.3 0 0 1 4.7 4.7l-1.4 1.4M9.9 6.1 6.1 9.9"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {selectedVideoSettings.cornerRadiusLinked
                          ? "Corners linked"
                          : "Corners unlinked"}
                      </button>
                      {selectedVideoSettings.cornerRadiusLinked ? (
                        <div className="flex items-center justify-between rounded-lg border border-gray-200/70 bg-gray-50/70 px-3 py-2 text-xs text-gray-500">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                            Radius
                          </span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={120}
                              value={selectedVideoSettings.cornerRadius}
                              onChange={(event) =>
                                updateClipSettings(
                                  selectedVideoEntry.clip.id,
                                  (current) => ({
                                    ...current,
                                    cornerRadius: clamp(
                                      Number(event.target.value),
                                      0,
                                      120
                                    ),
                                  })
                                )
                              }
                              className="w-16 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700"
                            />
                            <span className="text-xs text-gray-400">px</span>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                          {(
                            [
                              ["topLeft", "Top Left"],
                              ["topRight", "Top Right"],
                              ["bottomLeft", "Bottom Left"],
                              ["bottomRight", "Bottom Right"],
                            ] as const
                          ).map(([key, label]) => (
                            <label
                              key={key}
                              className="flex items-center justify-between gap-2 rounded-lg border border-gray-200/70 bg-gray-50/70 px-2.5 py-1.5"
                            >
                              <span className="text-[11px] font-medium text-gray-500">{label}</span>
                              <input
                                type="number"
                                min={0}
                                max={120}
                                value={selectedVideoSettings.cornerRadii[key]}
                                onChange={(event) =>
                                  updateClipSettings(
                                    selectedVideoEntry.clip.id,
                                    (current) => ({
                                      ...current,
                                      cornerRadii: {
                                        ...current.cornerRadii,
                                        [key]: clamp(
                                          Number(event.target.value),
                                          0,
                                          120
                                        ),
                                      },
                                    })
                                  )
                                }
                                className="w-12 bg-transparent text-right text-xs font-semibold text-gray-700 outline-none"
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className={panelCardClass}>
                  <SliderField
                    label="Opacity"
                    value={selectedVideoSettings.opacity}
                    min={0}
                    max={100}
                    step={1}
                    valueLabel={`${selectedVideoSettings.opacity}%`}
                    onChange={(value) =>
                      updateClipSettings(selectedVideoEntry.clip.id, (
                        current
                      ) => ({ ...current, opacity: value }))
                    }
                  />
                </div>

                <div className={`${panelCardClass} space-y-3`}>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200/70 bg-gray-50/70 px-3 py-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        className="h-4 w-4 text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                      >
                        <path
                          d="M15 13H1L9 3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M15 13c0-4.273-2.413-8.004-6-10"
                          strokeDasharray="1 3"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span>Rotation</span>
                    </div>
                    <div className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-semibold text-gray-700 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]">
                      <input
                        type="number"
                        min={-180}
                        max={180}
                        step={1}
                        value={selectedVideoSettings.rotation}
                        onChange={(event) =>
                          updateClipSettings(selectedVideoEntry.clip.id, (
                            current
                          ) => ({
                            ...current,
                            rotation: clamp(
                              Number(event.target.value),
                              -180,
                              180
                            ),
                          }))
                        }
                        className="w-10 bg-transparent text-right text-xs font-semibold text-gray-700 outline-none"
                      />
                      <span className="text-[11px] text-gray-400">&deg;</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      aria-label="Flip video horizontally"
                      className={`flex flex-1 items-center justify-center rounded-lg border px-3 py-2 text-gray-600 transition ${selectedVideoSettings.flipH
                        ? "border-[#C7D2FE] bg-[#EEF2FF] text-[#335CFF] shadow-[0_4px_12px_rgba(51,92,255,0.18)]"
                        : "border-gray-200/70 bg-white hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      onClick={() =>
                        updateClipSettings(selectedVideoEntry.clip.id, (
                          current
                        ) => ({ ...current, flipH: !current.flipH }))
                      }
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        className="h-5 w-5"
                        fill="none"
                      >
                        <path
                          fill="currentColor"
                          d="M8.75 13.333a.75.75 0 0 0-1.5 0zM7.25 14a.75.75 0 0 0 1.5 0zm1.5-4.667a.75.75 0 1 0-1.5 0zm-1.5 1.334a.75.75 0 0 0 1.5 0zm1.5-5.334a.75.75 0 0 0-1.5 0zm-1.5 1.334a.75.75 0 0 0 1.5 0zM8.75 2a.75.75 0 0 0-1.5 0zm-1.5.667a.75.75 0 0 0 1.5 0zM14 9.27h.75zm-1.326.808.39-.64zm0-4.156-.39-.64zM14 6.73h-.75zm-3.41.462.39.64zm0 1.616-.39.64zM2 6.73h.75zm1.326-.808-.39.64zm0 4.156.39.64zM2 9.27h-.75zm3.41-.462-.39-.64zm0-1.616.39-.64zm1.84 6.141V14h1.5v-.667zm0-4v1.334h1.5V9.333zm0-4v1.334h1.5V5.333zM7.25 2v.667h1.5V2zm3.73 5.832 2.084-1.27-.78-1.28-2.085 1.27zm2.27-1.102v2.54h1.5V6.73zm-.186 2.708-2.084-1.27-.78 1.28 2.083 1.27zm.186-.168c0 .091-.042.144-.082.168a.1.1 0 0 1-.052.017.1.1 0 0 1-.052-.017l-.78 1.28c1.15.702 2.466-.217 2.466-1.448zm-.186-2.708a.1.1 0 0 1 .052-.017q.018-.001.052.017c.04.025.082.077.082.168h1.5c0-1.23-1.316-2.15-2.467-1.449zm-2.865-.01c-1.069.65-1.069 2.245 0 2.897l.78-1.281c-.044-.027-.082-.082-.082-.168s.038-.14.083-.168zM5.02 8.167l-2.084 1.27.78 1.28 2.085-1.27zM2.75 9.27V6.73h-1.5v2.54zm.186-2.708 2.084 1.27.78-1.28-2.083-1.27zm-.186.168c0-.091.042-.144.082-.168a.1.1 0 0 1 .052-.017c.01 0 .027.001.052.017l.78-1.28C2.567 4.58 1.25 5.498 1.25 6.73zm.186 2.708a.1.1 0 0 1-.052.017.1.1 0 0 1-.052-.017c-.04-.025-.082-.077-.082-.168h-1.5c0 1.23 1.316 2.15 2.467 1.449zm2.865.01c1.069-.65 1.069-2.245 0-2.897l-.78 1.281c.044-.027.082-.082.082-.168s-.038.14-.083.168z"
                        />
                      </svg>
                      <span className="sr-only">Flip H</span>
                    </button>
                    <button
                      type="button"
                      aria-label="Flip video vertically"
                      className={`flex flex-1 items-center justify-center rounded-lg border px-3 py-2 text-gray-600 transition ${selectedVideoSettings.flipV
                        ? "border-[#C7D2FE] bg-[#EEF2FF] text-[#335CFF] shadow-[0_4px_12px_rgba(51,92,255,0.18)]"
                        : "border-gray-200/70 bg-white hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      onClick={() =>
                        updateClipSettings(selectedVideoEntry.clip.id, (
                          current
                        ) => ({ ...current, flipV: !current.flipV }))
                      }
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      >
                        <path d="M2.667 8H2m4.667 0H5.333m5.334 0H9.333M14 8h-.667M6.73 14h2.54c.719 0 1.168-.737.808-1.326l-1.27-2.085C8.45 10 7.551 10 7.192 10.59l-1.27 2.085c-.36.59.09 1.326.808 1.326ZM9.27 2H6.73c-.719 0-1.168.737-.808 1.326l1.27 2.085C7.55 6 8.449 6 8.808 5.41l1.27-2.085C10.439 2.736 9.989 2 9.27 2Z" />
                      </svg>
                      <span className="sr-only">Flip V</span>
                    </button>
                  </div>
                </div>

                <button
                  className={`${panelButtonClass} justify-center`}
                  type="button"
                  onClick={handleDetachAudio}
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4">
                    <path
                      d="m8.9 11.8-1.4 1.4a3.3 3.3 0 0 1-4.7-4.7l1.4-1.4M7.1 4.2l1.4-1.4a3.3 3.3 0 0 1 4.7 4.7l-1.4 1.4M9.9 6.1 6.1 9.9"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Detach Audio
                </button>

                <button
                  className="flex w-full items-center justify-center rounded-xl border border-red-200/80 bg-white px-4 py-3 text-sm font-semibold text-red-600 shadow-[0_6px_16px_rgba(239,68,68,0.12)] transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:ring-offset-2"
                  type="button"
                  onClick={handleDeleteSelected}
                >
                  Delete
                </button>
              </>
            ) : (
              <>
                <div className={`${panelCardClass} space-y-3`}>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                    Color Correction
                  </span>
                  <SliderField
                    label="Brightness"
                    value={selectedVideoSettings.brightness}
                    min={-100}
                    max={100}
                    step={1}
                    onChange={(value) =>
                      updateClipSettings(selectedVideoEntry.clip.id, (
                        current
                      ) => ({ ...current, brightness: value }))
                    }
                  />
                  <SliderField
                    label="Contrast"
                    value={selectedVideoSettings.contrast}
                    min={-100}
                    max={100}
                    step={1}
                    onChange={(value) =>
                      updateClipSettings(selectedVideoEntry.clip.id, (
                        current
                      ) => ({ ...current, contrast: value }))
                    }
                  />
                  <SliderField
                    label="Exposure"
                    value={selectedVideoSettings.exposure}
                    min={-100}
                    max={100}
                    step={1}
                    onChange={(value) =>
                      updateClipSettings(selectedVideoEntry.clip.id, (
                        current
                      ) => ({ ...current, exposure: value }))
                    }
                  />
                  <SliderField
                    label="Hue"
                    value={selectedVideoSettings.hue}
                    min={-180}
                    max={180}
                    step={1}
                    onChange={(value) =>
                      updateClipSettings(selectedVideoEntry.clip.id, (
                        current
                      ) => ({ ...current, hue: value }))
                    }
                  />
                  <SliderField
                    label="Saturation"
                    value={selectedVideoSettings.saturation}
                    min={-100}
                    max={100}
                    step={1}
                    onChange={(value) =>
                      updateClipSettings(selectedVideoEntry.clip.id, (
                        current
                      ) => ({ ...current, saturation: value }))
                    }
                  />
                </div>

                <div className={`${panelCardClass} space-y-3`}>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                    Effects
                  </span>
                  <SliderField
                    label="Sharpen"
                    value={selectedVideoSettings.sharpen}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(value) =>
                      updateClipSettings(selectedVideoEntry.clip.id, (
                        current
                      ) => ({ ...current, sharpen: value }))
                    }
                  />
                  <SliderField
                    label="Noise"
                    value={selectedVideoSettings.noise}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(value) =>
                      updateClipSettings(selectedVideoEntry.clip.id, (
                        current
                      ) => ({ ...current, noise: value }))
                    }
                  />
                  <SliderField
                    label="Blur"
                    value={selectedVideoSettings.blur}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(value) =>
                      updateClipSettings(selectedVideoEntry.clip.id, (
                        current
                      ) => ({ ...current, blur: value }))
                    }
                  />
                  <SliderField
                    label="Vignette"
                    value={selectedVideoSettings.vignette}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(value) =>
                      updateClipSettings(selectedVideoEntry.clip.id, (
                        current
                      ) => ({ ...current, vignette: value }))
                    }
                  />
                </div>

                <button
                  className="w-full rounded-xl border border-[#D6DCFF] bg-[#EEF2FF] px-4 py-3 text-sm font-semibold text-[#335CFF] shadow-[0_6px_16px_rgba(51,92,255,0.18)] transition hover:bg-[#E4E9FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30 focus-visible:ring-offset-2"
                  type="button"
                  onClick={() =>
                    updateClipSettings(selectedVideoEntry.clip.id, (
                      current
                    ) => ({
                      ...current,
                      brightness: 0,
                      contrast: 0,
                      exposure: 0,
                      hue: 0,
                      saturation: 0,
                      sharpen: 0,
                      noise: 0,
                      blur: 0,
                      vignette: 0,
                    }))
                  }
                >
                  Reset All
                </button>
              </>
            )}
          </div>
        </div>
      ) : showAudioPanel && selectedAudioEntry && selectedAudioSettings ? (
        <div className="flex h-full flex-col">
          <div className="border-b border-gray-100/80 bg-white/80 px-4 py-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30 focus-visible:ring-offset-2"
                type="button"
                aria-label="Back"
                onClick={() => {
                  setSelectedClipId(null);
                  setSelectedClipIds([]);
                  setActiveCanvasClipId(null);
                }}
              >
                <svg viewBox="0 0 16 16" className="h-5 w-5">
                  <path d="M10 4 6 8l4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div>
                <h2 className="text-lg font-semibold tracking-[-0.01em] text-gray-900">
                  Edit Audio
                </h2>
                <p className="max-w-[200px] truncate text-[11px] font-medium text-gray-400">
                  {selectedAudioEntry.asset.name}
                </p>
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className={panelCardClass}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Volume</span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                  {selectedAudioSettings.volume}%
                </span>
              </div>
              <div className="relative mt-3 h-4">
                <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-gray-200/80" />
                <div
                  className="pointer-events-none absolute left-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-[#5B6CFF]"
                  style={{ width: `${selectedAudioSettings.volume}%` }}
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={selectedAudioSettings.volume}
                  onChange={(event) =>
                    updateClipSettings(selectedAudioEntry.clip.id, (current) => ({
                      ...current,
                      volume: clamp(Number(event.target.value), 0, 100),
                    }))
                  }
                  className="refined-slider relative z-10 h-4 w-full cursor-pointer appearance-none bg-transparent"
                  aria-label="Volume"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {!isAudioTool && !(isStockVideoExpanded && activeTool === "video") && (
            <div
              className={`sticky top-0 z-10 border-b border-gray-100/70 bg-white/95 backdrop-blur ${activeTool === "text" ? "px-6 py-6" : "px-5 py-5"
                }`}
            >
              {activeTool === "text" ? (
                <div className="flex flex-col gap-4">
                  {textPanelView === "library" ? (
                    <>
                      <h2 className="text-lg font-semibold tracking-[-0.01em] text-gray-900">
                        Text
                      </h2>
                      <div className="flex flex-wrap gap-1.5">
                        {textPresetTags.map((tag) => {
                          const isActive = textPanelTag === tag;
                          return (
                            <button
                              key={tag}
                              type="button"
                              data-selected={isActive}
                              className={`inline-flex h-8 select-none items-center rounded-full px-3 py-2 text-xs font-semibold transition ${isActive
                                ? "bg-[#335CFF] text-white shadow-[0_6px_16px_rgba(51,92,255,0.25)]"
                                : "bg-[#EEF2FF] text-[#335CFF] hover:bg-[#E0E7FF]"
                                }`}
                              onClick={() => {
                                setTextPanelTag(tag);
                                setExpandedTextGroupId(null);
                              }}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30 focus-visible:ring-offset-2"
                        type="button"
                        aria-label="Go back"
                        onClick={() => setTextPanelView("library")}
                      >
                        <svg viewBox="0 0 16 16" className="h-5 w-5">
                          <path
                            d="M10 4 6 8l4 4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <div>
                        <h2 className="text-lg font-semibold tracking-[-0.01em] text-gray-900">
                          Edit Text
                        </h2>
                        <p className="max-w-[200px] truncate text-[11px] font-medium text-gray-400">
                          {textPanelPreset?.name ??
                            selectedTextEntry?.asset.name ??
                            "Text"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold tracking-[-0.01em] text-[#111827]">
                        {activeToolLabel}
                      </h2>
                      {!hasSupabase && (
                        <p className="text-xs font-medium text-gray-500">
                          Uploads stay in this browser session
                        </p>
                      )}
                    </div>
                    {uploading && (
                      <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[11px] font-semibold text-[#335CFF]">
                        Uploading
                      </span>
                    )}
                  </div>
                  <div className="mt-5">
                    <button
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-transparent bg-[#F3F4F8] px-4 py-3 text-sm font-semibold text-gray-700 shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition hover:bg-[#ECEFF6]"
                      type="button"
                      onClick={handleUploadClick}
                    >
                      <svg viewBox="0 0 16 16" className="h-4 w-4">
                        <path
                          d="M14 11v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2m6-1V2m0 0L5 5m3-3 3 3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Upload
                    </button>
                  </div>
                  {isBackgroundSelected && (
                    <div className="mt-5 rounded-2xl border border-gray-100 bg-[#F8FAFF] px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                            Video Background
                          </h3>
                          <p className="text-[11px] text-gray-400">Behind video content</p>
                        </div>
                        <input
                          type="color"
                          aria-label="Video background color"
                          value={videoBackground}
                          onChange={(event) =>
                            setVideoBackground(event.target.value)
                          }
                          className="h-7 w-7 cursor-pointer rounded-full border border-gray-200 bg-transparent"
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {backgroundSwatches.map((swatch) => (
                          <button
                            key={swatch}
                            type="button"
                            className={`h-6 w-6 rounded-full border transition ${videoBackground.toLowerCase() === swatch.toLowerCase()
                              ? "border-[#335CFF] ring-2 ring-[#335CFF]/20"
                              : "border-gray-200"
                              }`}
                            style={{ backgroundColor: swatch }}
                            onClick={() => setVideoBackground(swatch)}
                            aria-label={`Set video background to ${swatch}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div
            className={`flex-1 min-h-0 overflow-y-auto ${activeTool === "text"
              ? "bg-white"
              : isAudioTool
                ? "bg-gray-50"
                : "bg-[#F7F8FC]"
              }`}
          >
            {isAssetLibraryExpanded &&
            ["video", "audio", "image"].includes(activeTool) ? (
              <div className="flex min-h-full flex-col">
                <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-5 py-5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200"
                      aria-label="Go back"
                      onClick={() => setIsAssetLibraryExpanded(false)}
                    >
                      <svg viewBox="0 0 16 16" className="h-4 w-4">
                        <path
                          d="M10 4 6 8l4 4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Asset Library
                    </h2>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <svg viewBox="0 0 16 16" className="h-4 w-4">
                          <path
                            d="m14 14-2.9-2.9m1.567-3.767A5.333 5.333 0 1 1 2 7.333a5.333 5.333 0 0 1 10.667 0"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <input
                        className="h-10 w-full rounded-lg border border-gray-100 bg-white pl-9 pr-3 text-sm font-medium text-gray-700 placeholder:text-gray-400 focus:border-[#335CFF] focus:outline-none"
                        placeholder="Search..."
                        value={assetSearch}
                        onChange={(event) => setAssetSearch(event.target.value)}
                      />
                    </div>
                    <button
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                      type="button"
                      onClick={handleUploadClick}
                    >
                      <svg viewBox="0 0 16 16" className="h-4 w-4">
                        <path
                          d="M14 11v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2m6-1V2m0 0L5 5m3-3 3 3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Upload
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {mediaFilters.map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition ${assetFilter === filter
                          ? "bg-[#335CFF] text-white shadow-[0_6px_16px_rgba(51,92,255,0.25)]"
                          : "bg-[#EEF2FF] text-[#335CFF] hover:bg-[#E0E7FF]"
                          }`}
                        onClick={() => setAssetFilter(filter)}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 px-5 py-5">
                  {viewAllAssets.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                      {assetSearch.trim()
                        ? "No results match your search."
                        : "Upload media to build your library."}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {viewAllAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="group flex flex-col gap-2"
                        >
                          <button
                            type="button"
                            className={`relative h-24 w-full overflow-hidden rounded-xl border transition ${asset.id === activeAssetId
                              ? "border-[#335CFF] shadow-[0_10px_22px_rgba(51,92,255,0.2)]"
                              : "border-gray-200 hover:border-gray-300"
                              }`}
                            onClick={() => addToTimeline(asset.id)}
                            draggable
                            onDragStart={(event) =>
                              handleAssetDragStart(event, asset.id)
                            }
                          >
                            {asset.kind === "image" && (
                              <img
                                src={asset.url}
                                alt={asset.name}
                                className="h-full w-full object-cover"
                              />
                            )}
                            {asset.kind === "video" && (
                              <video
                                src={asset.url}
                                className="h-full w-full object-cover"
                                muted
                                playsInline
                              />
                            )}
                            {asset.kind === "audio" && (
                              <div className="flex h-full w-full items-center justify-center bg-[#EEF2FF] text-[#335CFF]">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="24"
                                  height="24"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  className="h-7 w-7 text-primary"
                                  aria-hidden="true"
                                >
                                  <g filter="url(#audio_svg__a)">
                                    <path
                                      fill="currentColor"
                                      d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
                                    />
                                    <path
                                      fill="url(#audio_svg__b)"
                                      fillOpacity="0.2"
                                      d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
                                    />
                                  </g>
                                  <g filter="url(#audio_svg__c)">
                                    <path
                                      fill="#fff"
                                      d="M13 16.507V8.893a1 1 0 0 1 .876-.992l2.248-.28A1 1 0 0 0 17 6.627V5.1a1 1 0 0 0-1.085-.996l-2.912.247a2 2 0 0 0-1.83 2.057l.24 7.456a3 3 0 1 0 1.586 2.724l.001-.073z"
                                    />
                                  </g>
                                  <defs>
                                    <filter
                                      id="audio_svg__a"
                                      width="24"
                                      height="24"
                                      x="0"
                                      y="0"
                                      colorInterpolationFilters="sRGB"
                                      filterUnits="userSpaceOnUse"
                                    >
                                      <feFlood floodOpacity="0" result="BackgroundImageFix" />
                                      <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                                      <feColorMatrix
                                        in="SourceAlpha"
                                        result="hardAlpha"
                                        values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                                      />
                                      <feOffset dy="0.5" />
                                      <feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
                                      <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.1 0" />
                                      <feBlend in2="shape" result="effect1_innerShadow_22531_1167" />
                                    </filter>
                                    <filter
                                      id="audio_svg__c"
                                      width="14"
                                      height="19.411"
                                      x="5"
                                      y="3.1"
                                      colorInterpolationFilters="sRGB"
                                      filterUnits="userSpaceOnUse"
                                    >
                                      <feFlood floodOpacity="0" result="BackgroundImageFix" />
                                      <feColorMatrix
                                        in="SourceAlpha"
                                        result="hardAlpha"
                                        values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                                      />
                                      <feOffset dy="1" />
                                      <feGaussianBlur stdDeviation="1" />
                                      <feComposite in2="hardAlpha" operator="out" />
                                      <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
                                      <feBlend in2="BackgroundImageFix" result="effect1_dropShadow_22531_1167" />
                                      <feBlend in="SourceGraphic" in2="effect1_dropShadow_22531_1167" result="shape" />
                                    </filter>
                                    <linearGradient
                                      id="audio_svg__b"
                                      x1="12"
                                      x2="12"
                                      y1="0"
                                      y2="24"
                                      gradientUnits="userSpaceOnUse"
                                    >
                                      <stop stopColor="#fff" />
                                      <stop offset="1" stopColor="#fff" stopOpacity="0" />
                                    </linearGradient>
                                  </defs>
                                </svg>
                              </div>
                            )}
                            {asset.kind !== "image" && (
                              <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                                {formatDuration(asset.duration)}
                              </span>
                            )}
                          </button>
                          <button type="button" className="text-left">
                            <div className="truncate text-xs font-medium text-gray-700">
                              {asset.name}
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : isStockVideoExpanded && activeTool === "video" ? (
              <div className="flex min-h-full flex-col">
                <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-5 py-5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200"
                        aria-label="Go back"
                        onClick={() => setIsStockVideoExpanded(false)}
                      >
                        <svg viewBox="0 0 16 16" className="h-4 w-4">
                          <path
                            d="M10 4 6 8l4 4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <h2 className="text-lg font-semibold text-gray-900">
                        Stock Videos
                      </h2>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <svg viewBox="0 0 16 16" className="h-4 w-4">
                          <path
                            d="m14 14-2.9-2.9m1.567-3.767A5.333 5.333 0 1 1 2 7.333a5.333 5.333 0 0 1 10.667 0"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <input
                        className="h-10 w-full rounded-lg border border-gray-100 bg-white pl-9 pr-3 text-sm font-medium text-gray-700 placeholder:text-gray-400 focus:border-[#335CFF] focus:outline-none"
                        placeholder="Search..."
                        value={stockVideoSearch}
                        onChange={(event) =>
                          setStockVideoSearch(event.target.value)
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { value: "all", label: "All" },
                          { value: "vertical", label: "Vertical" },
                          { value: "horizontal", label: "Horizontal" },
                        ] as const
                      ).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition ${stockVideoOrientation === option.value
                            ? "bg-[#335CFF] text-white shadow-[0_6px_16px_rgba(51,92,255,0.25)]"
                            : "bg-[#EEF2FF] text-[#335CFF] hover:bg-[#E0E7FF]"
                            }`}
                          onClick={() => setStockVideoOrientation(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition ${stockVideoCategory === "All"
                        ? "bg-[#335CFF] text-white shadow-[0_6px_16px_rgba(51,92,255,0.25)]"
                        : "bg-[#EEF2FF] text-[#335CFF] hover:bg-[#E0E7FF]"
                        }`}
                      onClick={() => setStockVideoCategory("All")}
                    >
                      All
                    </button>
                    {visibleStockVideoTags.map((category) => (
                      <button
                        key={category}
                        type="button"
                        className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition ${stockVideoCategory === category
                          ? "bg-[#335CFF] text-white shadow-[0_6px_16px_rgba(51,92,255,0.25)]"
                          : "bg-[#EEF2FF] text-[#335CFF] hover:bg-[#E0E7FF]"
                          }`}
                        onClick={() => setStockVideoCategory(category)}
                      >
                        {category}
                      </button>
                    ))}
                    {hasMoreStockVideoTags && (
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF2FF] text-[#335CFF] transition hover:bg-[#E0E7FF]"
                        onClick={() =>
                          setShowAllStockVideoTags((prev) => !prev)
                        }
                        aria-label={
                          showAllStockVideoTags
                            ? "Show fewer categories"
                            : "Show more categories"
                        }
                      >
                        <svg viewBox="0 0 16 16" className="h-4 w-4">
                          <path
                            d="M6.75 8a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0M12 8a1.25 1.25 0 1 1 2.5 0A1.25 1.25 0 0 1 12 8M1.5 8A1.25 1.25 0 1 1 4 8a1.25 1.25 0 0 1-2.5 0"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 px-5 py-5">
                  {!hasSupabase ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                      Connect Supabase to load stock videos.
                    </div>
                  ) : stockVideoStatus === "loading" ||
                    stockVideoStatus === "idle" ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {Array.from({
                        length: previewStockVideoCount,
                      }).map((_, index) => (
                        <div
                          key={`stock-video-expanded-skeleton-${index}`}
                          className="h-24 rounded-2xl bg-gray-100/80 animate-pulse"
                        />
                      ))}
                    </div>
                  ) : stockVideoStatus === "error" ? (
                    <div className="rounded-2xl border border-dashed border-red-200 bg-red-50/40 px-4 py-5 text-center text-sm text-red-600">
                      <p>{stockVideoError ?? "Unable to load stock videos."}</p>
                      <button
                        type="button"
                        className="mt-3 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-200"
                        onClick={handleStockVideoRetry}
                      >
                        Retry
                      </button>
                    </div>
                  ) : groupedStockVideos.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                      {stockVideoSearch.trim()
                        ? "No videos match your search."
                        : stockVideoRootPrefix
                          ? `No stock videos found under "${stockVideoRootPrefix}".`
                          : "No stock videos found."}
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {groupedStockVideos.map((group) => (
                        <div key={group.category} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-900">
                              {group.category}
                            </h3>
                          </div>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {group.videos.map((video) => {
                              const durationLabel =
                                video.duration != null
                                  ? formatDuration(video.duration)
                                  : "--:--";
                              return (
                                <StockVideoCard
                                  key={video.id}
                                  video={video}
                                  durationLabel={durationLabel}
                                  onAdd={handleAddStockVideo}
                                  onPreviewStart={handleStockVideoPreviewStart}
                                  onPreviewStop={handleStockVideoPreviewStop}
                                  onRequestMeta={requestStockVideoMeta}
                                  registerPreviewRef={registerStockVideoPreview}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                className={
                  activeTool === "text"
                    ? "space-y-8 px-6 py-6"
                    : useAudioLibraryLayout
                      ? "flex h-full min-h-0 flex-col gap-6 px-6 py-6"
                      : "space-y-8 px-5 py-5"
                }
              >
                {activeTool === "text" ? (
                  textPanelView === "library" ? (
                    <div className="space-y-12">
                      {visibleTextPresetGroups.map((group) => {
                        const isExpanded = expandedTextGroupId === group.id;
                        const canExpand =
                          group.presets.length > textPresetPreviewCount;
                        const visiblePresets = isExpanded
                          ? group.presets
                          : group.presets.slice(0, textPresetPreviewCount);
                        return (
                          <div key={group.id}>
                            <div className="mb-3 flex items-center justify-between">
                              <h3 className="text-md font-semibold text-gray-900">
                                {group.label}
                              </h3>
                              {canExpand && (
                                <button
                                  type="button"
                                  className="flex items-center gap-1 text-xs font-semibold text-gray-500 transition hover:text-gray-700"
                                  onClick={() => {
                                    if (isExpanded) {
                                      setExpandedTextGroupId(null);
                                      return;
                                    }
                                    setExpandedTextGroupId(group.id);
                                    setTextPanelTag(group.category);
                                  }}
                                >
                                  {isExpanded ? "Show less" : "View All"}
                                  <svg
                                    viewBox="0 0 16 16"
                                    className={`h-4 w-4 transition ${isExpanded ? "rotate-180" : ""}`}
                                  >
                                    <path
                                      d="m6 12 4-4-4-4"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="1.4"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </button>
                              )}
                            </div>
                            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-3 auto-rows-[120px] sm:auto-rows-[130px] lg:auto-rows-[84px]">
                              {visiblePresets.map((preset) => (
                                <button
                                  key={preset.id}
                                  type="button"
                                  className="h-full text-left"
                                  onClick={() => handleTextPresetSelect(preset)}
                                >
                                  <div className="flex h-full flex-col items-center justify-center gap-1 overflow-hidden rounded-[10px] bg-[#F7F7F8] px-3 text-center text-gray-900 transition hover:bg-[#EFF0F2] hover:text-gray-700">
                                    {preset.preview.map((line, lineIndex) => (
                                      <span
                                        key={`${preset.id}-${lineIndex}`}
                                        className={`block max-w-full leading-none ${line.className ?? ""}`}
                                        style={{
                                          fontSize: getPresetPreviewFontSize(line),
                                          fontFamily: resolveFontFamily(line.fontFamily),
                                          fontWeight: line.weight,
                                        }}
                                      >
                                        {line.text}
                                      </span>
                                    ))}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <div className="rounded-lg border border-transparent bg-gray-50 p-4">
                          <textarea
                            ref={textPanelTextAreaRef}
                            className="w-full resize-none bg-transparent text-sm font-medium text-gray-900 focus-visible:outline-none"
                            rows={4}
                            value={textPanelDraft}
                            onChange={(event) => {
                              const value = event.target.value;
                              setTextPanelDraft(value);
                              if (selectedTextEntry) {
                                updateTextSettings(
                                  selectedTextEntry.clip.id,
                                  (current) => ({
                                    ...current,
                                    text: value,
                                  })
                                );
                              }
                            }}
                            placeholder="Your Text"
                            style={{
                              fontFamily: resolveFontFamily(textPanelFontFamily),
                              fontSize: textPanelFontSize,
                              fontWeight: textPanelBold ? 700 : 400,
                              fontStyle: textPanelItalic ? "italic" : "normal",
                              textAlign: textPanelAlign,
                              lineHeight: textPanelLineHeight,
                              letterSpacing: textPanelLetterSpacing,
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-700">
                          Style
                        </h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <select
                              className="h-10 w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 focus:border-[#335CFF] focus:outline-none"
                              value={textPanelFontFamily}
                              onChange={(event) => {
                                const value = event.target.value;
                                setTextPanelFontFamily(value);
                                if (selectedTextEntry) {
                                  updateTextSettings(
                                    selectedTextEntry.clip.id,
                                    (current) => ({
                                      ...current,
                                      fontFamily: value,
                                    })
                                  );
                                }
                              }}
                              style={{
                                fontFamily: resolveFontFamily(textPanelFontFamily),
                              }}
                            >
                              {textFontFamilies.map((font) => (
                                <option key={font} value={font}>
                                  {font}
                                </option>
                              ))}
                            </select>
                            <svg
                              viewBox="0 0 16 16"
                              className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400"
                            >
                              <path
                                d="m4 6 4 4 4-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          <div className="relative w-24">
                            <select
                              className="h-10 w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 focus:border-[#335CFF] focus:outline-none"
                              value={textFontSizeDisplay}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                setTextPanelFontSize(value);
                                setTextPanelFontSizeDisplay(value);
                                if (selectedTextEntry) {
                                  updateTextSettings(
                                    selectedTextEntry.clip.id,
                                    (current) => ({
                                      ...current,
                                      fontSize: value,
                                    })
                                  );
                                }
                              }}
                            >
                              {textFontSizeOptions.map((size) => (
                                <option key={size} value={size}>
                                  {size}px
                                </option>
                              ))}
                            </select>
                            <svg
                              viewBox="0 0 16 16"
                              className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400"
                            >
                              <path
                                d="m4 6 4 4 4-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
                            <button
                              type="button"
                              aria-pressed={textPanelBold}
                              className={`flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition ${textPanelBold
                                ? "bg-[#EEF2FF] text-[#335CFF]"
                                : "hover:bg-gray-50"
                                }`}
                              onClick={() => {
                                setTextPanelBold((prev) => {
                                  const next = !prev;
                                  if (selectedTextEntry) {
                                    updateTextSettings(
                                      selectedTextEntry.clip.id,
                                      (current) => ({
                                        ...current,
                                        bold: next,
                                      })
                                    );
                                  }
                                  return next;
                                });
                              }}
                            >
                              <svg viewBox="0 0 16 16" className="h-4 w-4">
                                <path
                                  d="M4 8V3h4.5A2.5 2.5 0 0 1 11 5.5v0A2.5 2.5 0 0 1 8.5 8zm0 0v5h5.5a2.5 2.5 0 0 0 2.5-2.5v0A2.5 2.5 0 0 0 9.5 8z"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              aria-pressed={textPanelItalic}
                              className={`flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition ${textPanelItalic
                                ? "bg-[#EEF2FF] text-[#335CFF]"
                                : "hover:bg-gray-50"
                                }`}
                              onClick={() => {
                                setTextPanelItalic((prev) => {
                                  const next = !prev;
                                  if (selectedTextEntry) {
                                    updateTextSettings(
                                      selectedTextEntry.clip.id,
                                      (current) => ({
                                        ...current,
                                        italic: next,
                                      })
                                    );
                                  }
                                  return next;
                                });
                              }}
                            >
                              <svg viewBox="0 0 16 16" className="h-4 w-4">
                                <path
                                  d="M6 3h6M4 13h6M9 3 7 13"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.3"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </button>
                          </div>
                          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
                            <button
                              type="button"
                              aria-pressed={textPanelAlign === "left"}
                              className={`flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition ${textPanelAlign === "left"
                                ? "bg-[#EEF2FF] text-[#335CFF]"
                                : "hover:bg-gray-50"
                                }`}
                              onClick={() => {
                                setTextPanelAlign("left");
                                if (selectedTextEntry) {
                                  updateTextSettings(
                                    selectedTextEntry.clip.id,
                                    (current) => ({
                                      ...current,
                                      align: "left",
                                    })
                                  );
                                }
                              }}
                            >
                              <svg viewBox="0 0 16 16" className="h-4 w-4">
                                <path
                                  d="M2 3h12M2 6.75h8m-8 3.5h11M2 14h6"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              aria-pressed={textPanelAlign === "center"}
                              className={`flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition ${textPanelAlign === "center"
                                ? "bg-[#EEF2FF] text-[#335CFF]"
                                : "hover:bg-gray-50"
                                }`}
                              onClick={() => {
                                setTextPanelAlign("center");
                                if (selectedTextEntry) {
                                  updateTextSettings(
                                    selectedTextEntry.clip.id,
                                    (current) => ({
                                      ...current,
                                      align: "center",
                                    })
                                  );
                                }
                              }}
                            >
                              <svg viewBox="0 0 16 16" className="h-4 w-4">
                                <path
                                  d="M2 3h12M4 6.333h8M2.5 9.667h11M5 13h6"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              aria-pressed={textPanelAlign === "right"}
                              className={`flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition ${textPanelAlign === "right"
                                ? "bg-[#EEF2FF] text-[#335CFF]"
                                : "hover:bg-gray-50"
                                }`}
                              onClick={() => {
                                setTextPanelAlign("right");
                                if (selectedTextEntry) {
                                  updateTextSettings(
                                    selectedTextEntry.clip.id,
                                    (current) => ({
                                      ...current,
                                      align: "right",
                                    })
                                  );
                                }
                              }}
                            >
                              <svg viewBox="0 0 16 16" className="h-4 w-4">
                                <path
                                  d="M2 3h12M6 6.333h8M3 9.667h11M8 13h6"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </div>
                          <button
                            type="button"
                            className="ml-auto flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
                            aria-expanded={textPanelSpacingOpen}
                            onClick={() =>
                              setTextPanelSpacingOpen((prev) => !prev)
                            }
                          >
                            <svg viewBox="0 0 16 16" className="h-4 w-4">
                              <path
                                d="M15 11H9m6-3H9m6-3H9m-6 9 2-2m-2 2-2-2m2 2V2m0 0L1 4m2-2 2 2"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            <svg viewBox="0 0 16 16" className="h-4 w-4">
                              <path
                                d="m4 6 4 4 4-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        </div>
                        {textPanelSpacingOpen && (
                          <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600 shadow-sm">
                            <label className="flex flex-col gap-1">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                                Letter Spacing
                              </span>
                              <select
                                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700 focus:border-[#335CFF] focus:outline-none"
                                value={textPanelLetterSpacing}
                                onChange={(event) => {
                                  const value = Number(event.target.value);
                                  setTextPanelLetterSpacing(value);
                                  if (selectedTextEntry) {
                                    updateTextSettings(
                                      selectedTextEntry.clip.id,
                                      (current) => ({
                                        ...current,
                                        letterSpacing: value,
                                      })
                                    );
                                  }
                                }}
                              >
                                {textLetterSpacingOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}px
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                                Line Height
                              </span>
                              <select
                                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700 focus:border-[#335CFF] focus:outline-none"
                                value={textPanelLineHeight}
                                onChange={(event) => {
                                  const value = Number(event.target.value);
                                  setTextPanelLineHeight(value);
                                  if (selectedTextEntry) {
                                    updateTextSettings(
                                      selectedTextEntry.clip.id,
                                      (current) => ({
                                        ...current,
                                        lineHeight: value,
                                      })
                                    );
                                  }
                                }}
                              >
                                {textLineHeightOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}x
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between text-left"
                          onClick={() =>
                            setTextPanelStylesOpen((prev) => !prev)
                          }
                          aria-expanded={textPanelStylesOpen}
                        >
                          <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                            <svg viewBox="0 0 16 16" className="h-4 w-4">
                              <path
                                d="M8 2.91V1M2.91 8H1m2.95-4.05-.9-.9m9 .9.9-.9M8 15v-1.91M15 8h-1.91m-.14 4.95-.9-.9m-9 .9.9-.9M11.182 8a3.182 3.182 0 1 1-6.364 0 3.182 3.182 0 0 1 6.364 0"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            Styles
                          </span>
                          <svg
                            viewBox="0 0 16 16"
                            className={`h-4 w-4 text-gray-400 transition ${textPanelStylesOpen ? "rotate-180" : ""}`}
                          >
                            <path
                              d="m4 6 4 4 4-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                        {textPanelStylesOpen && (
                          <div className="mt-4 space-y-6">
                            <div>
                              <h3 className="text-md font-semibold text-gray-900">
                                Presets
                              </h3>
                              <div className="mt-3 grid grid-cols-3 gap-3 auto-rows-[96px]">
                                {textStylePresets.map((preset) => {
                                  const previewSettings: TextClipSettings = {
                                    ...fallbackTextSettings,
                                    ...preset.settings,
                                    fontFamily:
                                      preset.preview?.fontFamily ??
                                      "Roboto",
                                    fontSize:
                                      preset.preview?.fontSize ??
                                      28,
                                    bold:
                                      preset.preview?.bold ??
                                      true,
                                    italic:
                                      preset.preview?.italic ??
                                      false,
                                  };
                                  const previewText =
                                    preset.preview?.text ?? "Abc";
                                  const previewStyles = getTextRenderStyles({
                                    ...previewSettings,
                                    text: previewText,
                                    align: "center",
                                    lineHeight: 1,
                                  });
                                  const shadowBlur = Number.isFinite(
                                    previewSettings.shadowBlur
                                  )
                                    ? previewSettings.shadowBlur
                                    : 0;
                                  const shadowOpacity = Number.isFinite(
                                    previewSettings.shadowOpacity
                                  )
                                    ? previewSettings.shadowOpacity
                                    : 0;
                                  const shadowEnabled =
                                    previewSettings.shadowEnabled &&
                                    shadowBlur > 0 &&
                                    shadowOpacity > 0;
                                  const previewShadowBlur = clamp(
                                    shadowBlur,
                                    0,
                                    18
                                  );
                                  const shadowOffset = Math.round(
                                    previewShadowBlur * 0.3
                                  );
                                  const shadowColor = toRgba(
                                    previewSettings.shadowColor,
                                    shadowOpacity / 100
                                  );
                                  const outlineWidth = previewSettings.outlineEnabled
                                    ? previewSettings.outlineWidth
                                    : 0;
                                  const isBackgroundPreview =
                                    previewSettings.backgroundEnabled;
                                  const showSvg = !isBackgroundPreview;
                                  const showLabel = isBackgroundPreview;
                                  const svgFontSize = clamp(
                                    (previewSettings.fontSize / 28) * 32,
                                    22,
                                    40
                                  );
                                  const svgFontWeight = previewSettings.bold
                                    ? 800
                                    : 500;
                                  const previewLabelStyle: CSSProperties = {
                                    ...previewStyles.textStyle,
                                    textShadow: "none",
                                    WebkitTextStrokeWidth: 0,
                                    color: previewSettings.color,
                                    whiteSpace: "nowrap",
                                    wordBreak: "normal",
                                    lineHeight: 1,
                                  };
                                  const isActive =
                                    textPanelStylePresetId === preset.id;
                                  return (
                                    <button
                                      key={preset.id}
                                      type="button"
                                      className="h-full text-left"
                                      onClick={() =>
                                        handleTextStylePresetSelect(preset)
                                      }
                                      aria-pressed={isActive}
                                    >
                                      <div
                                        className={`group relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[14px] border border-[#EEF1F6] bg-white text-gray-900 shadow-[0_14px_30px_rgba(15,23,42,0.08)] transition hover:border-[#E2E8F0] hover:shadow-[0_18px_36px_rgba(15,23,42,0.12)] hover:text-gray-700 ${isActive
                                          ? "ring-2 ring-[#5B6CFF]/30"
                                          : ""
                                          }`}
                                      >
                                        <div className="relative flex h-full w-full items-center justify-center px-3 text-center">
                                          {showLabel && (
                                            <span
                                              className="relative z-10 leading-none"
                                              style={previewLabelStyle}
                                            >
                                              {previewText}
                                            </span>
                                          )}
                                          {showSvg && (
                                            <svg
                                              className="pointer-events-none absolute inset-0"
                                              viewBox="0 0 100 100"
                                              preserveAspectRatio="xMidYMid meet"
                                              style={{
                                                filter: shadowEnabled
                                                  ? `drop-shadow(${shadowOffset}px ${shadowOffset}px ${previewShadowBlur}px ${shadowColor})`
                                                  : "none",
                                              }}
                                            >
                                              {outlineWidth > 0 && (
                                                <text
                                                  x="50"
                                                  y="50"
                                                  fontFamily={resolveFontFamily(
                                                    previewSettings.fontFamily
                                                  )}
                                                  fontWeight={svgFontWeight}
                                                  fontSize={svgFontSize}
                                                  dominantBaseline="middle"
                                                  textAnchor="middle"
                                                  fill="none"
                                                  stroke={previewSettings.outlineColor}
                                                  strokeWidth={Math.max(
                                                    1,
                                                    outlineWidth * 1.1
                                                  )}
                                                  strokeLinejoin="round"
                                                  strokeLinecap="round"
                                                >
                                                  {previewText}
                                                </text>
                                              )}
                                              <text
                                                x="50"
                                                y="50"
                                                fontFamily={resolveFontFamily(
                                                  previewSettings.fontFamily
                                                )}
                                                fontWeight={svgFontWeight}
                                                fontSize={svgFontSize}
                                                dominantBaseline="middle"
                                                textAnchor="middle"
                                                fill={previewSettings.color}
                                              >
                                                {previewText}
                                              </text>
                                            </svg>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div>
                              <h3 className="text-md font-semibold text-gray-900">
                                Customize
                              </h3>
                              <div className="mt-3 space-y-4">
                                <div className="flex items-center justify-between rounded-xl border border-gray-200/70 bg-white px-3 py-2.5 shadow-sm">
                                  <span className="text-xs font-semibold text-gray-600">
                                    Text Color
                                  </span>
                                  <label className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm">
                                    <input
                                      type="color"
                                      aria-label="Text color"
                                      value={textPanelColor}
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        setTextPanelStylePresetId(null);
                                        setTextPanelColor(value);
                                        if (selectedTextEntry) {
                                          updateTextSettings(
                                            selectedTextEntry.clip.id,
                                            (current) => ({
                                              ...current,
                                              color: value,
                                            })
                                          );
                                        }
                                      }}
                                      className="h-5 w-5 cursor-pointer rounded-full border border-gray-200"
                                    />
                                  </label>
                                </div>

                                <div className="rounded-xl border border-gray-200/70 bg-white px-3 py-3 shadow-sm">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-xs font-semibold text-gray-600">
                                        Background
                                      </div>
                                      <div className="text-[10px] text-gray-400">
                                        Highlight blocks behind text
                                      </div>
                                    </div>
                                    <ToggleSwitch
                                      checked={textPanelBackgroundEnabled}
                                      onChange={(next) => {
                                        setTextPanelStylePresetId(null);
                                        setTextPanelBackgroundEnabled(next);
                                        if (selectedTextEntry) {
                                          updateTextSettings(
                                            selectedTextEntry.clip.id,
                                            (current) => ({
                                              ...current,
                                              backgroundEnabled: next,
                                            })
                                          );
                                        }
                                      }}
                                      ariaLabel="Toggle text background"
                                    />
                                  </div>
                                  <div
                                    className={`mt-3 flex items-center gap-3 ${textPanelBackgroundEnabled
                                      ? ""
                                      : "pointer-events-none opacity-40"
                                      }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        aria-pressed={
                                          textPanelBackgroundStyle ===
                                          "line-block-hard"
                                        }
                                        onClick={() => {
                                          setTextPanelStylePresetId(null);
                                          setTextPanelBackgroundStyle(
                                            "line-block-hard"
                                          );
                                          if (selectedTextEntry) {
                                            updateTextSettings(
                                              selectedTextEntry.clip.id,
                                              (current) => ({
                                                ...current,
                                                backgroundStyle: "line-block-hard",
                                              })
                                            );
                                          }
                                        }}
                                        className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${textPanelBackgroundStyle ===
                                          "line-block-hard"
                                          ? "border-[#335CFF] bg-[#EEF2FF] text-[#335CFF]"
                                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                          }`}
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          width="20"
                                          height="20"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          className="h-5 w-5"
                                        >
                                          <path
                                            fill="currentColor"
                                            d="M2 5h20v6H2zm3 8h14v6H5z"
                                          />
                                        </svg>
                                      </button>
                                      <button
                                        type="button"
                                        aria-pressed={
                                          textPanelBackgroundStyle ===
                                          "line-block-round"
                                        }
                                        onClick={() => {
                                          setTextPanelStylePresetId(null);
                                          setTextPanelBackgroundStyle(
                                            "line-block-round"
                                          );
                                          if (selectedTextEntry) {
                                            updateTextSettings(
                                              selectedTextEntry.clip.id,
                                              (current) => ({
                                                ...current,
                                                backgroundStyle: "line-block-round",
                                              })
                                            );
                                          }
                                        }}
                                        className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${textPanelBackgroundStyle ===
                                          "line-block-round"
                                          ? "border-[#335CFF] bg-[#EEF2FF] text-[#335CFF]"
                                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                          }`}
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          width="20"
                                          height="20"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          className="h-5 w-5"
                                        >
                                          <path
                                            fill="currentColor"
                                            d="M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"
                                          />
                                        </svg>
                                      </button>
                                      <button
                                        type="button"
                                        aria-pressed={
                                          textPanelBackgroundStyle === "block"
                                        }
                                        onClick={() => {
                                          setTextPanelStylePresetId(null);
                                          setTextPanelBackgroundStyle("block");
                                          if (selectedTextEntry) {
                                            updateTextSettings(
                                              selectedTextEntry.clip.id,
                                              (current) => ({
                                                ...current,
                                                backgroundStyle: "block",
                                              })
                                            );
                                          }
                                        }}
                                        className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${textPanelBackgroundStyle === "block"
                                          ? "border-[#335CFF] bg-[#EEF2FF] text-[#335CFF]"
                                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                          }`}
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          width="20"
                                          height="20"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          className="h-5 w-5"
                                        >
                                          <path
                                            fill="currentColor"
                                            d="M2 5h20v14H2z"
                                          />
                                        </svg>
                                      </button>
                                      <button
                                        type="button"
                                        aria-pressed={
                                          textPanelBackgroundStyle ===
                                          "block-rounded"
                                        }
                                        onClick={() => {
                                          setTextPanelStylePresetId(null);
                                          setTextPanelBackgroundStyle(
                                            "block-rounded"
                                          );
                                          if (selectedTextEntry) {
                                            updateTextSettings(
                                              selectedTextEntry.clip.id,
                                              (current) => ({
                                                ...current,
                                                backgroundStyle: "block-rounded",
                                              })
                                            );
                                          }
                                        }}
                                        className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${textPanelBackgroundStyle ===
                                          "block-rounded"
                                          ? "border-[#335CFF] bg-[#EEF2FF] text-[#335CFF]"
                                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                          }`}
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          width="20"
                                          height="20"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          className="h-5 w-5"
                                        >
                                          <path
                                            fill="currentColor"
                                            d="M2 9a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"
                                          />
                                        </svg>
                                      </button>
                                    </div>
                                    <label className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm">
                                      <input
                                        type="color"
                                        aria-label="Background color"
                                        value={textPanelBackgroundColor}
                                        onChange={(event) => {
                                          const value = event.target.value;
                                          setTextPanelStylePresetId(null);
                                          setTextPanelBackgroundColor(value);
                                          if (selectedTextEntry) {
                                            updateTextSettings(
                                              selectedTextEntry.clip.id,
                                              (current) => ({
                                                ...current,
                                                backgroundColor: value,
                                              })
                                            );
                                          }
                                        }}
                                        className="h-5 w-5 cursor-pointer rounded-full border border-gray-200"
                                      />
                                    </label>
                                  </div>
                                </div>

                                <div className="rounded-xl border border-gray-200/70 bg-white px-3 py-3 shadow-sm">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-xs font-semibold text-gray-600">
                                        Text Outline
                                      </div>
                                      <div className="text-[10px] text-gray-400">
                                        Add stroke for contrast
                                      </div>
                                    </div>
                                    <ToggleSwitch
                                      checked={textPanelOutlineEnabled}
                                      onChange={(next) => {
                                        setTextPanelStylePresetId(null);
                                        setTextPanelOutlineEnabled(next);
                                        if (selectedTextEntry) {
                                          updateTextSettings(
                                            selectedTextEntry.clip.id,
                                            (current) => ({
                                              ...current,
                                              outlineEnabled: next,
                                            })
                                          );
                                        }
                                      }}
                                      ariaLabel="Toggle outline"
                                    />
                                  </div>
                                  <div
                                    className={`mt-3 flex items-center gap-3 ${textPanelOutlineEnabled
                                      ? ""
                                      : "pointer-events-none opacity-40"
                                      }`}
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="14"
                                      height="13"
                                      fill="none"
                                      className="text-gray-500"
                                    >
                                      <path
                                        fill="currentColor"
                                        d="m.99 11.304.707.707L13.01.697l-.707-.707z"
                                      />
                                    </svg>
                                    <div className="relative flex-1">
                                      <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-gray-200/80" />
                                      <div
                                        className="pointer-events-none absolute left-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-[#5B6CFF]"
                                        style={{
                                          width: `${(textPanelOutlineWidth / 20) * 100}%`,
                                        }}
                                      />
                                      <input
                                        type="range"
                                        min={0}
                                        max={20}
                                        step={1}
                                        value={textPanelOutlineWidth}
                                        onChange={(event) => {
                                          const value = Number(
                                            event.target.value
                                          );
                                          setTextPanelStylePresetId(null);
                                          setTextPanelOutlineWidth(value);
                                          if (selectedTextEntry) {
                                            updateTextSettings(
                                              selectedTextEntry.clip.id,
                                              (current) => ({
                                                ...current,
                                                outlineWidth: value,
                                              })
                                            );
                                          }
                                        }}
                                        className="refined-slider relative z-10 h-4 w-full cursor-pointer appearance-none bg-transparent"
                                        aria-label="Outline size"
                                      />
                                    </div>
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="16"
                                      height="16"
                                      fill="none"
                                      className="text-gray-500"
                                    >
                                      <path
                                        fill="currentColor"
                                        d="m.575 11.889 3.536 3.535L15.425 4.111 11.889.575z"
                                      />
                                    </svg>
                                    <input
                                      readOnly
                                      value={textPanelOutlineWidth}
                                      className="h-7 w-12 rounded-lg border border-transparent bg-gray-50 px-2 text-right text-xs font-semibold text-gray-600"
                                    />
                                    <label className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm">
                                      <input
                                        type="color"
                                        aria-label="Outline color"
                                        value={textPanelOutlineColor}
                                        onChange={(event) => {
                                          const value = event.target.value;
                                          setTextPanelStylePresetId(null);
                                          setTextPanelOutlineColor(value);
                                          if (selectedTextEntry) {
                                            updateTextSettings(
                                              selectedTextEntry.clip.id,
                                              (current) => ({
                                                ...current,
                                                outlineColor: value,
                                              })
                                            );
                                          }
                                        }}
                                        className="h-5 w-5 cursor-pointer rounded-full border border-gray-200"
                                      />
                                    </label>
                                  </div>
                                </div>

                                <div className="rounded-xl border border-gray-200/70 bg-white px-3 py-3 shadow-sm">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-xs font-semibold text-gray-600">
                                        Text Shadow
                                      </div>
                                      <div className="text-[10px] text-gray-400">
                                        Soft depth for readability
                                      </div>
                                    </div>
                                    <ToggleSwitch
                                      checked={textPanelShadowEnabled}
                                      onChange={(next) => {
                                        setTextPanelStylePresetId(null);
                                        setTextPanelShadowEnabled(next);
                                        if (!next) {
                                          setTextPanelShadowAdvancedOpen(false);
                                        }
                                        if (selectedTextEntry) {
                                          updateTextSettings(
                                            selectedTextEntry.clip.id,
                                            (current) => ({
                                              ...current,
                                              shadowEnabled: next,
                                            })
                                          );
                                        }
                                      }}
                                      ariaLabel="Toggle shadow"
                                    />
                                  </div>
                                  <div
                                    className={`mt-3 flex items-center gap-3 ${textPanelShadowEnabled
                                      ? ""
                                      : "pointer-events-none opacity-40"
                                      }`}
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="13"
                                      height="13"
                                      fill="none"
                                      className="text-gray-500"
                                    >
                                      <circle cx="6" cy="7" r="6" fill="currentColor" />
                                      <circle cx="7" cy="6" r="5.5" fill="#fff" stroke="currentColor" />
                                    </svg>
                                    <div className="relative flex-1">
                                      <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-gray-200/80" />
                                      <div
                                        className="pointer-events-none absolute left-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-[#5B6CFF]"
                                        style={{
                                          width: `${(textPanelShadowBlur / 30) * 100}%`,
                                        }}
                                      />
                                      <input
                                        type="range"
                                        min={0}
                                        max={30}
                                        step={1}
                                        value={textPanelShadowBlur}
                                        onChange={(event) => {
                                          const value = Number(
                                            event.target.value
                                          );
                                          setTextPanelStylePresetId(null);
                                          setTextPanelShadowBlur(value);
                                          if (selectedTextEntry) {
                                            updateTextSettings(
                                              selectedTextEntry.clip.id,
                                              (current) => ({
                                                ...current,
                                                shadowBlur: value,
                                              })
                                            );
                                          }
                                        }}
                                        className="refined-slider relative z-10 h-4 w-full cursor-pointer appearance-none bg-transparent"
                                        aria-label="Shadow blur"
                                      />
                                    </div>
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="16"
                                      height="16"
                                      fill="none"
                                      className="text-gray-500"
                                    >
                                      <circle cx="6" cy="10" r="5.5" fill="#fff" stroke="currentColor" />
                                      <path
                                        stroke="currentColor"
                                        d="m3.68 14.973 6.594-6.594M2.26 13.722l6.233-6.233m-7.45 4.779 9.231-9.231M.479 10.16l7.124-7.123m-1.776 12.46 5.661-5.661"
                                      />
                                      <circle cx="10" cy="6" r="5.5" fill="#fff" stroke="currentColor" />
                                    </svg>
                                    <button
                                      type="button"
                                      aria-label="Shadow advanced settings"
                                      onClick={() =>
                                        setTextPanelShadowAdvancedOpen(
                                          (prev) => !prev
                                        )
                                      }
                                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="16"
                                        height="16"
                                        fill="none"
                                        viewBox="0 0 16 16"
                                        className="h-4 w-4"
                                      >
                                        <path
                                          fill="currentColor"
                                          d="M6.75 8a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0M12 8a1.25 1.25 0 1 1 2.5 0A1.25 1.25 0 0 1 12 8M1.5 8A1.25 1.25 0 1 1 4 8a1.25 1.25 0 0 1-2.5 0"
                                        />
                                      </svg>
                                    </button>
                                    <label className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm">
                                      <input
                                        type="color"
                                        aria-label="Shadow color"
                                        value={textPanelShadowColor}
                                        onChange={(event) => {
                                          const value = event.target.value;
                                          setTextPanelStylePresetId(null);
                                          setTextPanelShadowColor(value);
                                          if (selectedTextEntry) {
                                            updateTextSettings(
                                              selectedTextEntry.clip.id,
                                              (current) => ({
                                                ...current,
                                                shadowColor: value,
                                              })
                                            );
                                          }
                                        }}
                                        className="h-5 w-5 cursor-pointer rounded-full border border-gray-200"
                                      />
                                    </label>
                                  </div>
                                  {textPanelShadowEnabled &&
                                    textPanelShadowAdvancedOpen && (
                                    <div className="mt-3">
                                      <SliderField
                                        label="Shadow Opacity"
                                        value={textPanelShadowOpacity}
                                        min={0}
                                        max={100}
                                        step={1}
                                        onChange={(value) => {
                                          setTextPanelStylePresetId(null);
                                          setTextPanelShadowOpacity(value);
                                          if (selectedTextEntry) {
                                            updateTextSettings(
                                              selectedTextEntry.clip.id,
                                              (current) => ({
                                                ...current,
                                                shadowOpacity: value,
                                              })
                                            );
                                          }
                                        }}
                                        valueLabel={`${textPanelShadowOpacity}%`}
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-gray-200/70 bg-white p-3">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                          Timing
                        </span>
                        <div className="mt-3 space-y-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200/70 bg-white text-gray-500 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30 focus-visible:ring-offset-2"
                              aria-label="Set start time"
                              onClick={() => {
                                if (!selectedTextEntry) {
                                  return;
                                }
                                handleSetStartAtPlayhead(selectedTextEntry.clip);
                              }}
                            >
                              <svg viewBox="0 0 16 16" className="h-4 w-4">
                                <path
                                  d="M8 2.7a6 6 0 1 0 0 12 6 6 0 0 0 0-12m0 0V1.3m0 4v3.3m2 0H8m2-7.3H6"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                            <div className="flex flex-1 flex-col">
                              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                                Start
                              </span>
                              <input
                                value={textPanelStart}
                                onChange={(event) =>
                                  setTextPanelStart(event.target.value)
                                }
                                onBlur={() => {
                                  if (selectedTextEntry) {
                                    handleStartTimeCommit(
                                      selectedTextEntry.clip,
                                      textPanelStart
                                    );
                                  }
                                }}
                                className="rounded-lg border border-gray-200/70 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex flex-1 flex-col">
                              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                                End
                              </span>
                              <input
                                value={textPanelEnd}
                                onChange={(event) =>
                                  setTextPanelEnd(event.target.value)
                                }
                                onBlur={() => {
                                  if (selectedTextEntry) {
                                    handleEndTimeCommit(
                                      selectedTextEntry.clip,
                                      textPanelEnd
                                    );
                                  }
                                }}
                                className="rounded-lg border border-gray-200/70 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700"
                              />
                            </div>
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200/70 bg-white text-gray-500 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30 focus-visible:ring-offset-2"
                              aria-label="Set end time"
                              onClick={() => {
                                if (!selectedTextEntry) {
                                  return;
                                }
                                handleSetEndAtPlayhead(selectedTextEntry.clip);
                              }}
                            >
                              <svg viewBox="0 0 16 16" className="h-4 w-4">
                                <path
                                  d="M8 2.7a6 6 0 1 0 0 12 6 6 0 0 0 0-12m0 0V1.3m0 4v3.3m2 0H8m2-7.3H6"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="flex w-full items-center justify-center rounded-xl border border-red-200/80 bg-white px-4 py-3 text-sm font-semibold text-red-600 shadow-[0_6px_16px_rgba(239,68,68,0.12)] transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:ring-offset-2"
                        onClick={() => {
                          handleDeleteSelected();
                          setTextPanelPreset(null);
                          setTextPanelView("library");
                        }}
                      >
                        Delete Text
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#EEF2FF] px-3 py-2.5 text-sm font-semibold text-[#335CFF] transition hover:bg-[#E0E7FF]"
                        onClick={() => {
                          const nextSettings: TextClipSettings = {
                            text: "New Text",
                            fontFamily: textPanelFontFamily,
                            fontSize: textPanelFontSize,
                            color: textPanelColor,
                            bold: textPanelBold,
                            italic: textPanelItalic,
                            align: textPanelAlign,
                            letterSpacing: textPanelLetterSpacing,
                            lineHeight: textPanelLineHeight,
                            backgroundEnabled: textPanelBackgroundEnabled,
                            backgroundColor: textPanelBackgroundColor,
                            backgroundStyle: textPanelBackgroundStyle,
                            outlineEnabled: textPanelOutlineEnabled,
                            outlineColor: textPanelOutlineColor,
                            outlineWidth: textPanelOutlineWidth,
                            shadowEnabled: textPanelShadowEnabled,
                            shadowColor: textPanelShadowColor,
                            shadowBlur: textPanelShadowBlur,
                            shadowOpacity: textPanelShadowOpacity,
                            autoSize: true,
                          };
                          setTextPanelPreset(null);
                          addTextClip(nextSettings, "Text");
                        }}
                      >
                        <svg viewBox="0 0 16 16" className="h-4 w-4">
                          <path
                            d="M3 8h10M8 3v10"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Add Another Text Box
                      </button>
                    </div>
                  )
                ) : ["video", "audio", "image"].includes(activeTool) ? (
                  <>
                    {activeTool === "audio" && (
                      <div className="flex flex-col rounded-2xl border border-gray-100 bg-white shadow-[0_12px_26px_rgba(15,23,42,0.08)]">
                        <div className="border-b border-gray-50 bg-white px-6 py-6 transition-shadow duration-200">
                          <div className="flex flex-col gap-6">
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EEF2FF]">
                                <svg viewBox="0 0 24 24" className="h-4 w-4">
                                  <path
                                    d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
                                    fill="#335CFF"
                                  />
                                  <path
                                    fill="url(#audio_header_b)"
                                    fillOpacity="0.2"
                                    d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
                                  />
                                  <path
                                    fill="#fff"
                                    d="M13 16.507V8.893a1 1 0 0 1 .876-.992l2.248-.28A1 1 0 0 0 17 6.627V5.1a1 1 0 0 0-1.085-.996l-2.912.247a2 2 0 0 0-1.83 2.057l.24 7.456a3 3 0 1 0 1.586 2.724l.001-.073z"
                                  />
                                  <defs>
                                    <linearGradient
                                      id="audio_header_b"
                                      x1="12"
                                      x2="12"
                                      y1="0"
                                      y2="24"
                                      gradientUnits="userSpaceOnUse"
                                    >
                                      <stop stopColor="#fff" />
                                      <stop offset="1" stopColor="#fff" stopOpacity="0" />
                                    </linearGradient>
                                  </defs>
                                </svg>
                              </div>
                              <h2 className="text-lg font-semibold text-gray-900">
                                Stock Music
                              </h2>
                            </div>
                            <div className="flex w-full flex-col gap-2">
                              <div className="relative">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                  <svg viewBox="0 0 16 16" className="h-4 w-4">
                                    <path
                                      d="m14 14-2.9-2.9m1.567-3.767A5.333 5.333 0 1 1 2 7.333a5.333 5.333 0 0 1 10.667 0"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="1.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </span>
                                <input
                                  className="h-10 w-full rounded-lg border border-gray-100 bg-white pl-9 pr-3 text-sm font-medium text-gray-700 placeholder:text-gray-400 focus:border-[#335CFF] focus:outline-none"
                                  placeholder="Search..."
                                  value={stockSearch}
                                  onChange={(event) =>
                                    setStockSearch(event.target.value)
                                  }
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className={`inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold transition ${stockCategory === "All"
                                  ? "bg-[#335CFF] text-white shadow-[0_6px_16px_rgba(51,92,255,0.25)]"
                                  : "bg-[#EEF2FF] text-[#335CFF] hover:bg-[#E0E7FF]"
                                  }`}
                                onClick={() => setStockCategory("All")}
                              >
                                All
                              </button>
                              {visibleStockTags.map((category) => (
                                <button
                                  key={category}
                                  type="button"
                                  className={`inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold transition ${stockCategory === category
                                    ? "bg-[#335CFF] text-white shadow-[0_6px_16px_rgba(51,92,255,0.25)]"
                                    : "bg-[#EEF2FF] text-[#335CFF] hover:bg-[#E0E7FF]"
                                    }`}
                                  onClick={() => setStockCategory(category)}
                                >
                                  {category}
                                </button>
                              ))}
                              {hasMoreStockTags && (
                                <button
                                  type="button"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF2FF] text-[#335CFF] transition hover:bg-[#E0E7FF]"
                                  onClick={() =>
                                    setShowAllStockTags((prev) => !prev)
                                  }
                                  aria-label={
                                    showAllStockTags
                                      ? "Show fewer categories"
                                      : "Show more categories"
                                  }
                                >
                                  <svg viewBox="0 0 16 16" className="h-4 w-4">
                                    <path
                                      d="M6.75 8a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0M12 8a1.25 1.25 0 1 1 2.5 0A1.25 1.25 0 0 1 12 8M1.5 8A1.25 1.25 0 1 1 4 8a1.25 1.25 0 0 1-2.5 0"
                                      fill="currentColor"
                                    />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="px-6 pb-6 pt-5">
                          {!hasSupabase ? (
                            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                              Connect Supabase to load stock music.
                            </div>
                          ) : stockMusicStatus === "loading" ||
                            stockMusicStatus === "idle" ? (
                            <div className="space-y-3">
                              {Array.from({ length: 4 }).map((_, index) => (
                                <div
                                  key={`stock-skeleton-${index}`}
                                  className="h-16 rounded-2xl bg-gray-100/80 animate-pulse"
                                />
                              ))}
                            </div>
                          ) : stockMusicStatus === "error" ? (
                            <div className="rounded-2xl border border-dashed border-red-200 bg-red-50/40 px-4 py-5 text-center text-sm text-red-600">
                              <p>{stockMusicError ?? "Unable to load stock music."}</p>
                              <button
                                type="button"
                                className="mt-3 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-200"
                                onClick={handleStockMusicRetry}
                              >
                                Retry
                              </button>
                            </div>
                          ) : groupedStockMusic.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                              {stockSearch.trim()
                                ? "No tracks match your search."
                                : stockMusicRootPrefix
                                  ? `No stock music found under "${stockMusicRootPrefix}".`
                                  : "No stock music found."}
                            </div>
                          ) : (
                            <div className="space-y-8">
                              {groupedStockMusic.map((group) => (
                                <div key={group.category} className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-gray-900">
                                      {group.category}
                                    </h3>
                                  </div>
                                  <div className="space-y-3">
                                    {group.tracks.map((track) => {
                                      const isActive =
                                        previewTrackId === track.id;
                                      const isPlaying =
                                        isActive && isPreviewPlaying;
                                      const durationLabel =
                                        track.duration != null
                                          ? formatDuration(track.duration)
                                          : "--:--";
                                      return (
                                        <div
                                          key={track.id}
                                          className="group flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.08)] transition hover:border-[#DDE3FF] hover:shadow-[0_12px_24px_rgba(15,23,42,0.12)]"
                                        >
                                          <div className="flex min-w-0 flex-1 items-center gap-3">
                                            <button
                                              type="button"
                                              className={`relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white text-[#335CFF] shadow-[0_8px_16px_rgba(15,23,42,0.12)] transition ${isPlaying
                                                ? "ring-2 ring-[#335CFF]/30"
                                                : "hover:shadow-[0_10px_18px_rgba(15,23,42,0.16)]"
                                                }`}
                                              onClick={() =>
                                                handleStockPreviewToggle(track)
                                              }
                                              aria-label={
                                                isPlaying
                                                  ? "Pause preview"
                                                  : "Play preview"
                                              }
                                            >
                                              <span
                                                className={`absolute inset-0 rounded-full bg-gradient-to-br from-white via-[#E0E7FF] to-[#C7D2FE] transition ${isPlaying ? "opacity-100" : "opacity-80"
                                                  }`}
                                              />
                                              <span
                                                className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-sm transition ${isPlaying
                                                  ? "bg-[#335CFF] text-white"
                                                  : "bg-white text-gray-700"
                                                  }`}
                                              >
                                                {isPlaying ? (
                                                  <svg viewBox="0 0 16 16" className="h-4 w-4">
                                                    <path
                                                      d="M5.2 3.5h2.1v9H5.2zm3.5 0h2.1v9H8.7z"
                                                      fill="currentColor"
                                                    />
                                                  </svg>
                                                ) : (
                                                  <svg viewBox="0 0 16 16" className="h-4 w-4">
                                                    <path
                                                      d="M3 1.91a.5.5 0 0 1 .768-.421l9.57 6.09a.5.5 0 0 1 0 .843l-9.57 6.089A.5.5 0 0 1 3 14.089z"
                                                      fill="currentColor"
                                                    />
                                                  </svg>
                                                )}
                                              </span>
                                            </button>
                                            <div className="min-w-0 flex-1">
                                              <div className="truncate text-sm font-semibold text-gray-900">
                                                {track.name}
                                              </div>
                                              <div className="text-xs font-medium text-gray-400">
                                                {durationLabel}
                                              </div>
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#335CFF] text-white shadow-[0_8px_18px_rgba(51,92,255,0.25)] transition hover:bg-[#2E52E6]"
                                            onClick={() =>
                                              handleAddStockAudio(track)
                                            }
                                            aria-label={`Add ${track.name}`}
                                          >
                                            <svg viewBox="0 0 16 16" className="h-4 w-4">
                                              <path
                                                d="M3 8h10M8 3v10"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                              />
                                            </svg>
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="rounded-2xl border border-white/70 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900">
                            Asset Library
                          </h3>
                          <button
                            type="button"
                            className="flex h-6 w-6 items-center justify-center rounded-md bg-[#EEF2FF] text-[#335CFF]"
                            onClick={handleUploadClick}
                            aria-label="Upload media"
                          >
                            <svg viewBox="0 0 16 16" className="h-4 w-4">
                              <path
                                d="M3 8h10M8 3v10"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        </div>
                        <button
                          className="flex items-center gap-1 text-xs font-semibold text-gray-500 transition hover:text-gray-700"
                          type="button"
                          onClick={() => {
                            setIsStockVideoExpanded(false);
                            setIsAssetLibraryExpanded(true);
                          }}
                        >
                          View all
                          <svg viewBox="0 0 16 16" className="h-3 w-3">
                            <path
                              d="m6 12 4-4-4-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {mediaFilters.map((filter) => (
                          <button
                            key={filter}
                            type="button"
                            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition ${assetFilter === filter
                              ? "bg-[#EEF2FF] text-[#335CFF]"
                              : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                              }`}
                            onClick={() => setAssetFilter(filter)}
                          >
                            {filter}
                          </button>
                        ))}
                      </div>
                      {filteredAssets.length === 0 ? (
                        <div className="mt-6 rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                          Upload media to build your library.
                        </div>
                      ) : (
                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {filteredAssets.map((asset) => (
                            <div key={asset.id} className="space-y-2">
                              <button
                                type="button"
                                className={`group relative h-24 w-full overflow-hidden rounded-2xl border transition ${asset.id === activeAssetId
                                  ? "border-[#335CFF] shadow-[0_10px_22px_rgba(51,92,255,0.2)]"
                                  : "border-gray-200 hover:border-gray-300"
                                  }`}
                                onClick={() => addToTimeline(asset.id)}
                                draggable
                                onDragStart={(event) =>
                                  handleAssetDragStart(event, asset.id)
                                }
                              >
                                {asset.kind === "image" && (
                                  <img
                                    src={asset.url}
                                    alt={asset.name}
                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                                  />
                                )}
                                {asset.kind === "video" && (
                                  <video
                                    src={asset.url}
                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                                    muted
                                    playsInline
                                  />
                                )}
                                {asset.kind === "audio" && (
                                <div className="flex h-full w-full items-center justify-center bg-[#EEF2FF] text-[#335CFF]">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    className="h-8 w-8 text-primary"
                                    aria-hidden="true"
                                  >
                                    <g filter="url(#audio_svg__a)">
                                      <path
                                        fill="currentColor"
                                        d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
                                      />
                                      <path
                                        fill="url(#audio_svg__b)"
                                        fillOpacity="0.2"
                                        d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
                                      />
                                    </g>
                                    <g filter="url(#audio_svg__c)">
                                      <path
                                        fill="#fff"
                                        d="M13 16.507V8.893a1 1 0 0 1 .876-.992l2.248-.28A1 1 0 0 0 17 6.627V5.1a1 1 0 0 0-1.085-.996l-2.912.247a2 2 0 0 0-1.83 2.057l.24 7.456a3 3 0 1 0 1.586 2.724l.001-.073z"
                                      />
                                    </g>
                                    <defs>
                                      <filter
                                        id="audio_svg__a"
                                        width="24"
                                        height="24"
                                        x="0"
                                        y="0"
                                        colorInterpolationFilters="sRGB"
                                        filterUnits="userSpaceOnUse"
                                      >
                                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                                        <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                                        <feColorMatrix
                                          in="SourceAlpha"
                                          result="hardAlpha"
                                          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                                        />
                                        <feOffset dy="0.5" />
                                        <feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
                                        <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.1 0" />
                                        <feBlend in2="shape" result="effect1_innerShadow_22531_1167" />
                                      </filter>
                                      <filter
                                        id="audio_svg__c"
                                        width="14"
                                        height="19.411"
                                        x="5"
                                        y="3.1"
                                        colorInterpolationFilters="sRGB"
                                        filterUnits="userSpaceOnUse"
                                      >
                                        <feFlood floodOpacity="0" result="BackgroundImageFix" />
                                        <feColorMatrix
                                          in="SourceAlpha"
                                          result="hardAlpha"
                                          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                                        />
                                        <feOffset dy="1" />
                                        <feGaussianBlur stdDeviation="1" />
                                        <feComposite in2="hardAlpha" operator="out" />
                                        <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
                                        <feBlend in2="BackgroundImageFix" result="effect1_dropShadow_22531_1167" />
                                        <feBlend in="SourceGraphic" in2="effect1_dropShadow_22531_1167" result="shape" />
                                      </filter>
                                      <linearGradient
                                        id="audio_svg__b"
                                        x1="12"
                                        x2="12"
                                        y1="0"
                                        y2="24"
                                        gradientUnits="userSpaceOnUse"
                                      >
                                        <stop stopColor="#fff" />
                                        <stop offset="1" stopColor="#fff" stopOpacity="0" />
                                      </linearGradient>
                                    </defs>
                                  </svg>
                                </div>
                                )}
                                {asset.kind !== "image" && (
                                  <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                                    {formatDuration(asset.duration)}
                                  </span>
                                )}
                              </button>
                              <div className="flex items-center justify-between text-[11px] text-gray-500">
                                <span className="truncate font-medium text-gray-700">
                                  {asset.name}
                                </span>
                                <span>{formatSize(asset.size)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {activeTool === "video" && (
                      <div className="rounded-2xl border border-white/70 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-900">
                            Stock Videos
                          </h3>
                          <button
                            className="flex items-center gap-1 text-xs font-semibold text-gray-500 transition hover:text-gray-700"
                            type="button"
                            aria-label={
                              hasMoreStockVideos
                                ? "View all stock videos"
                                : "Browse stock videos"
                            }
                            onClick={() => {
                              setIsAssetLibraryExpanded(false);
                              setIsStockVideoExpanded(true);
                            }}
                          >
                            View all
                            <svg viewBox="0 0 16 16" className="h-3 w-3">
                              <path
                                d="m6 12 4-4-4-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        </div>
                        <div className="mt-3">
                          {!hasSupabase ? (
                            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                              Connect Supabase to load stock videos.
                            </div>
                          ) : stockVideoStatus === "loading" ||
                            stockVideoStatus === "idle" ? (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                              {Array.from({
                                length: previewStockVideoCount,
                              }).map((_, index) => (
                                <div
                                  key={`stock-video-skeleton-${index}`}
                                  className="h-24 rounded-2xl bg-gray-100/80 animate-pulse"
                                />
                              ))}
                            </div>
                          ) : stockVideoStatus === "error" ? (
                            <div className="rounded-2xl border border-dashed border-red-200 bg-red-50/40 px-4 py-5 text-center text-sm text-red-600">
                              <p>{stockVideoError ?? "Unable to load stock videos."}</p>
                              <button
                                type="button"
                                className="mt-3 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-200"
                                onClick={handleStockVideoRetry}
                              >
                                Retry
                              </button>
                            </div>
                          ) : filteredStockVideos.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                              {stockVideoSearch.trim()
                                ? "No videos match your search."
                                : stockVideoRootPrefix
                                  ? `No stock videos found under "${stockVideoRootPrefix}".`
                                  : "No stock videos found."}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                              {previewStockVideos.map((video) => {
                                const durationLabel =
                                  video.duration != null
                                    ? formatDuration(video.duration)
                                    : "--:--";
                                return (
                                  <StockVideoCard
                                    key={video.id}
                                    video={video}
                                    durationLabel={durationLabel}
                                    priority
                                    onAdd={handleAddStockVideo}
                                    onPreviewStart={handleStockVideoPreviewStart}
                                    onPreviewStop={handleStockVideoPreviewStop}
                                    onRequestMeta={requestStockVideoMeta}
                                    registerPreviewRef={registerStockVideoPreview}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                    {activeToolLabel} tools are coming next.
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
      </aside>
    );
  };

  const handleViewportClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    // Only deselect if clicking directly on the viewport (not on the stage or its children)
    if (event.target === event.currentTarget) {
      setSelectedClipIds([]);
      setSelectedClipId(null);
      setActiveCanvasClipId(null);
      setActiveAssetId(null);
      setIsBackgroundSelected(false);
      closeFloatingMenu();
    }
  };

  const renderStage = () => (
    <div className="flex min-h-0 flex-1">
      <div
        ref={stageViewportRef}
        className="relative flex h-full w-full items-center justify-center"
        onClick={handleViewportClick}
      >
        <div
          ref={stageRef}
          className={`relative flex items-center justify-center overflow-hidden ${dragOverCanvas ? "ring-2 ring-[#335CFF]" : ""
            }`}
          style={{
            width: stageDisplay.width ? `${stageDisplay.width}px` : "100%",
            height: stageDisplay.height ? `${stageDisplay.height}px` : "100%",
          }}
          onPointerDown={handleStagePointerDown}
          onContextMenu={(event) => {
            event.preventDefault();
            closeFloatingMenu();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOverCanvas(true);
          }}
          onDragLeave={() => setDragOverCanvas(false)}
          onDrop={handleCanvasDrop}
        >
          <div
            className="pointer-events-none absolute inset-0 border border-gray-200 shadow-sm"
            style={{ backgroundColor: "#f2f3fa" }}
          />
          {dragOverCanvas && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/80 text-sm font-semibold text-[#335CFF]">
              Drop to add to timeline
            </div>
          )}
          {baseBackgroundTransform && (
            <div
              className="pointer-events-none absolute"
              style={{
                left: `${baseBackgroundTransform.x * 100}%`,
                top: `${baseBackgroundTransform.y * 100}%`,
                width: `${baseBackgroundTransform.width * 100}%`,
                height: `${baseBackgroundTransform.height * 100}%`,
                backgroundColor: videoBackground,
                zIndex: 1,
              }}
            />
          )}
          {stageSelection && stageSelectionStyle && (
            <div className="pointer-events-none absolute inset-0 z-20">
              <div
                className="absolute rounded-lg border border-dashed border-[#5B6CFF] bg-[#5B6CFF]/10"
                style={{
                  left: stageSelectionStyle.left,
                  top: stageSelectionStyle.top,
                  width: stageSelectionStyle.width,
                  height: stageSelectionStyle.height,
                }}
              />
            </div>
          )}
          {snapGuides && (snapGuides.x.length > 0 || snapGuides.y.length > 0) && (
            <div className="pointer-events-none absolute inset-0 z-20">
              {snapGuides.x.map((line) => (
                <div
                  key={`snap-x-${line}`}
                  className="absolute top-0 bottom-0 w-px bg-[#5B6CFF]/70"
                  style={{ left: `${line}px` }}
                />
              ))}
              {snapGuides.y.map((line) => (
                <div
                  key={`snap-y-${line}`}
                  className="absolute left-0 right-0 h-px bg-[#5B6CFF]/70"
                  style={{ top: `${line}px` }}
                />
              ))}
            </div>
          )}
          {showEmptyState ? (
          <div className="relative z-10 flex flex-col items-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E7EDFF] text-[#335CFF]">
              <svg viewBox="0 0 24 24" className="h-8 w-8">
                <path
                  d="M12 4v10m0 0-4-4m4 4 4-4M5 18h14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                Drop your first clip
              </h2>
              <p className="text-sm text-gray-500">
                Upload media to preview it here
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg bg-[#335CFF] px-4 py-2 text-sm font-semibold text-white"
              onClick={handleUploadClick}
            >
              Upload media
            </button>
          </div>
        ) : visualStack.length > 0 ? (
          <div className="relative z-10 h-full w-full">
            {visualStack.map((entry, index) => {
              const transform = resolveClipTransform(
                entry.clip.id,
                entry.asset
              );
              const isSelected = selectedClipIdsSet.has(entry.clip.id);
              const isActive = activeCanvasClipId === entry.clip.id;
              const videoSettings =
                entry.asset.kind === "video"
                  ? clipSettings[entry.clip.id] ?? fallbackVideoSettings
                  : null;
              const textClipSettings =
                entry.asset.kind === "text"
                  ? textSettings[entry.clip.id] ?? fallbackTextSettings
                  : null;
              const textRenderStyles = textClipSettings
                ? getTextRenderStyles(textClipSettings)
                : null;
              const isEditingText = editingTextClipId === entry.clip.id;
              const resolvedTextValue =
                textClipSettings?.text ?? entry.asset.name;
              const videoStyles = videoSettings
                ? getVideoStyles(videoSettings)
                : null;
              const noiseLevel = videoSettings?.noise ?? 0;
              const vignetteLevel = videoSettings?.vignette ?? 0;
              const clipZ = index + 2;
              const clipRotation = transform.rotation ?? 0;
              return (
                <div
                  key={entry.clip.id}
                  className="absolute"
                  style={{
                    left: `${transform.x * 100}%`,
                    top: `${transform.y * 100}%`,
                    width: `${transform.width * 100}%`,
                    height: `${transform.height * 100}%`,
                    zIndex: clipZ,
                    transform: clipRotation ? `rotate(${clipRotation}deg)` : undefined,
                    transformOrigin: 'center center',
                  }}
                >
                  <div
                    className={`relative h-full w-full ${isActive
                      ? "cursor-move"
                      : entry.asset.kind === "text"
                        ? "cursor-text"
                        : "cursor-pointer"
                      }`}
                    onPointerDown={(event) =>
                      handleLayerPointerDown(event, entry)
                    }
                    onContextMenu={(event) =>
                      handleClipContextMenu(event, entry)
                    }
                    onDoubleClick={(event) => {
                      if (entry.asset.kind !== "text") {
                        return;
                      }
                      handleTextLayerDoubleClick(event, entry);
                    }}
                  >
                    {entry.asset.kind === "text" ? (
                      <div className="absolute inset-0 flex items-center justify-center overflow-hidden px-3">
                        <div className="w-full" style={textRenderStyles?.containerStyle}>
                          {isEditingText ? (
                            <textarea
                              ref={stageTextEditorRef}
                              value={resolvedTextValue}
                              onChange={(event) => {
                                const value = event.target.value;
                                if (selectedTextEntry?.clip.id === entry.clip.id) {
                                  setTextPanelDraft(value);
                                }
                                updateTextSettings(entry.clip.id, (current) => ({
                                  ...current,
                                  text: value,
                                }));
                              }}
                              onBlur={() => setEditingTextClipId(null)}
                              onKeyDown={(event) => {
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  setEditingTextClipId(null);
                                }
                                if (
                                  (event.metaKey || event.ctrlKey) &&
                                  event.key === "Enter"
                                ) {
                                  event.preventDefault();
                                  setEditingTextClipId(null);
                                }
                              }}
                              onPointerDown={(event) => event.stopPropagation()}
                              className="h-full w-full resize-none bg-transparent text-sm font-medium focus-visible:outline-none"
                              style={{
                                ...textRenderStyles?.textStyle,
                                backgroundColor: "transparent",
                                padding: 0,
                                borderRadius: 0,
                                display: "block",
                                textShadow: "none",
                                WebkitTextStrokeWidth: 0,
                                textAlign: textClipSettings?.align,
                              }}
                            />
                          ) : (
                            <span
                              className="max-w-full"
                              style={textRenderStyles?.textStyle}
                            >
                              {resolvedTextValue}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div
                        className="absolute inset-0 overflow-hidden"
                        style={videoStyles?.frameStyle}
                      >
                        <div
                          className="absolute inset-0"
                          style={videoStyles?.mediaStyle}
                        >
                          {entry.asset.kind === "image" ? (
                            <img
                              src={entry.asset.url}
                              alt={entry.asset.name}
                              className="h-full w-full object-cover"
                              draggable={false}
                            />
                          ) : (
                            <video
                              key={entry.clip.id}
                              ref={registerVideoRef(
                                entry.clip.id,
                                entry.asset.id
                              )}
                              src={entry.asset.url}
                              className="h-full w-full object-cover"
                              playsInline
                              preload="metadata"
                              onLoadedMetadata={(event) =>
                                updateVideoMetaFromElement(
                                  entry.clip.id,
                                  entry.asset.id,
                                  event.currentTarget
                                )
                              }
                              draggable={false}
                            />
                          )}
                        </div>
                        {videoStyles && noiseLevel > 0 && (
                          <div
                            className="pointer-events-none absolute inset-0 mix-blend-soft-light"
                            style={videoStyles.noiseStyle}
                          />
                        )}
                        {videoStyles && vignetteLevel > 0 && (
                          <div
                            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0)_55%,_rgba(0,0,0,0.6)_100%)]"
                            style={videoStyles.vignetteStyle}
                          />
                        )}
                      </div>
                    )}
                    {isSelected && (
                      <div className="pointer-events-none absolute inset-0 border-2 border-[#335CFF] shadow-[0_0_0_1px_rgba(51,92,255,0.35)]" />
                    )}
                    {isActive && (
                      <div className="absolute inset-0">
                        {/* Rotation handle */}
                        <button
                          type="button"
                          className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center cursor-grab active:cursor-grabbing"
                          style={{
                            top: '-28px',
                            width: '20px',
                            height: '20px',
                            touchAction: 'none',
                          }}
                          onPointerDown={(event) =>
                            handleRotateStart(event, entry)
                          }
                          aria-label="Rotate"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            fill="none"
                            viewBox="0 0 24 24"
                            className="text-[#8F9199] hover:text-[#335CFF] transition-colors"
                          >
                            <path
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M20.87 13.274A8.958 8.958 0 0 0 4.232 7.516m16.638 5.758 2.294-2.488m-2.294 2.488-2.6-2.399m-15.14-.149a8.959 8.959 0 0 0 16.64 5.753M3.13 10.726.836 13.214m2.294-2.488 2.6 2.399"
                            />
                          </svg>
                        </button>
                        {/* Connecting line from rotation handle to top edge */}
                        <div
                          className="absolute left-1/2 -translate-x-1/2 w-px bg-[#335CFF]/40"
                          style={{
                            top: '-12px',
                            height: '12px',
                          }}
                        />
                        {/* Resize handles */}
                        {transformHandles.map((handle) => (
                          <button
                            key={`${entry.clip.id}-${handle.id}`}
                            type="button"
                            className={`absolute border border-[#335CFF] bg-white shadow-sm ${handle.className} ${handle.cursor} ${
                              handle.isCorner
                                ? 'h-3 w-3 rounded-full'
                                : handle.id === 'n' || handle.id === 's'
                                  ? 'h-1.5 w-8 rounded-full'
                                  : 'h-8 w-1.5 rounded-full'
                            }`}
                            onPointerDown={(event) =>
                              handleResizeStart(
                                event,
                                entry,
                                handle.id
                              )
                            }
                            aria-label={`Resize ${handle.id}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : activeAsset?.kind === "audio" ? (
          <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[#E7EDFF] text-[#335CFF]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="none"
                viewBox="0 0 24 24"
                className="h-10 w-10 text-primary"
                aria-hidden="true"
              >
                <g filter="url(#audio_svg__a)">
                  <path
                    fill="currentColor"
                    d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
                  />
                  <path
                    fill="url(#audio_svg__b)"
                    fillOpacity="0.2"
                    d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
                  />
                </g>
                <g filter="url(#audio_svg__c)">
                  <path
                    fill="#fff"
                    d="M13 16.507V8.893a1 1 0 0 1 .876-.992l2.248-.28A1 1 0 0 0 17 6.627V5.1a1 1 0 0 0-1.085-.996l-2.912.247a2 2 0 0 0-1.83 2.057l.24 7.456a3 3 0 1 0 1.586 2.724l.001-.073z"
                  />
                </g>
                <defs>
                  <filter
                    id="audio_svg__a"
                    width="24"
                    height="24"
                    x="0"
                    y="0"
                    colorInterpolationFilters="sRGB"
                    filterUnits="userSpaceOnUse"
                  >
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                    <feColorMatrix
                      in="SourceAlpha"
                      result="hardAlpha"
                      values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                    />
                    <feOffset dy="0.5" />
                    <feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
                    <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.1 0" />
                    <feBlend in2="shape" result="effect1_innerShadow_22531_1167" />
                  </filter>
                  <filter
                    id="audio_svg__c"
                    width="14"
                    height="19.411"
                    x="5"
                    y="3.1"
                    colorInterpolationFilters="sRGB"
                    filterUnits="userSpaceOnUse"
                  >
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feColorMatrix
                      in="SourceAlpha"
                      result="hardAlpha"
                      values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                    />
                    <feOffset dy="1" />
                    <feGaussianBlur stdDeviation="1" />
                    <feComposite in2="hardAlpha" operator="out" />
                    <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
                    <feBlend in2="BackgroundImageFix" result="effect1_dropShadow_22531_1167" />
                    <feBlend in="SourceGraphic" in2="effect1_dropShadow_22531_1167" result="shape" />
                  </filter>
                  <linearGradient
                    id="audio_svg__b"
                    x1="12"
                    x2="12"
                    y1="0"
                    y2="24"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#fff" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <p className="text-sm text-gray-500">Audio preview ready</p>
          </div>
        ) : null}
        {audioStack.length > 0 && (
          <div className="absolute inset-0 pointer-events-none opacity-0">
            {audioStack.map((entry) => {
              return (
                <audio
                  key={entry.clip.id}
                  ref={registerAudioRef(entry.clip.id)}
                  src={entry.asset.url}
                />
              );
            })}
          </div>
        )}
        {floatingMenu.open && floatingMenuEntry && (
          <div
            ref={floatingMenuRef}
            className="absolute z-30 flex flex-col items-start gap-2"
            style={{ left: floatingMenu.x, top: floatingMenu.y }}
            onPointerDown={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div className={`flex items-center gap-2 p-1 ${floaterSurfaceClass}`}>
              <button
                type="button"
                className={`${floaterPillClass} ${floatingVideoSettings ? "" : "cursor-not-allowed opacity-50"}`}
                onClick={() => {
                  if (!floatingVideoSettings) {
                    return;
                  }
                  setFloatingMenu((prev) => ({
                    ...prev,
                    showVolume: !prev.showVolume,
                    showSpeed: false,
                    showMore: false,
                    showOrder: false,
                    showOpacity: false,
                    showCorners: false,
                    showTiming: false,
                  }));
                }}
                aria-expanded={floatingMenu.showVolume}
                aria-label="Volume options"
                disabled={!floatingVideoSettings}
              >
                {floatingVideoSettings?.muted ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4">
                    <path d="M6 9h4l5-4v14l-5-4H6zM19 9l-4 4m0-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-4 w-4">
                    <path d="M12 6.1 7.6 9H5a3 3 0 0 0-3 3v0a3 3 0 0 0 3 3h2.6l4.4 3.6V6.1zM18.1 4.9a8.8 8.8 0 0 1 0 14.2M15.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                <span>
                  {floatingVideoSettings
                    ? floatingVideoSettings.muted
                      ? "Muted"
                      : `${floatingVideoSettings.volume}%`
                    : "Volume"}
                </span>
              </button>
              <div className="h-6 w-px bg-gray-100" />
              <button
                type="button"
                className={`${floaterPillClass} ${floatingVideoSettings ? "" : "cursor-not-allowed opacity-50"}`}
                onClick={() => {
                  if (!floatingVideoSettings) {
                    return;
                  }
                  setFloatingMenu((prev) => ({
                    ...prev,
                    showSpeed: !prev.showSpeed,
                    showVolume: false,
                    showMore: false,
                    showOrder: false,
                    showOpacity: false,
                    showCorners: false,
                    showTiming: false,
                  }));
                }}
                aria-expanded={floatingMenu.showSpeed}
                aria-label="Speed options"
                disabled={!floatingVideoSettings}
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4">
                  <path d="m9.1 10.2 1.6-1.6M1 11.1a7.1 7.1 0 1 1 14.2 0m-5.8.1a1.3 1.3 0 1 1-2.6 0 1.3 1.3 0 0 1 2.6 0Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
                </svg>
                <span>
                  {floatingVideoSettings
                    ? `${formatSpeedLabel(floatingVideoSettings.speed)}x`
                    : "Speed"}
                </span>
              </button>
              <div className="h-6 w-px bg-gray-100" />
              <button
                type="button"
                className={floaterButtonClass}
                onClick={() =>
                  setFloatingMenu((prev) => ({
                    ...prev,
                    showMore: !prev.showMore,
                    showOrder: false,
                    showVolume: false,
                    showSpeed: false,
                    showOpacity: false,
                    showCorners: false,
                    showTiming: false,
                  }))
                }
                aria-label="Show more actions"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4">
                  <path
                    d="M6.75 8a1.25 1.25 0 1 1 2.5 0 1.25 1.25 0 0 1-2.5 0M12 8a1.25 1.25 0 1 1 2.5 0A1.25 1.25 0 0 1 12 8M1.5 8A1.25 1.25 0 1 1 4 8a1.25 1.25 0 0 1-2.5 0"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
            {floatingMenu.showVolume && floatingVideoSettings && (
              <div
                className={`mt-2 space-y-3 p-3 ${floaterSurfaceClass}`}
                style={{ width: floaterPanelWidth }}
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200/70 bg-white text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30"
                    onClick={() =>
                      updateClipSettings(floatingMenuEntry.clip.id, (current) => ({
                        ...current,
                        muted: !current.muted,
                      }))
                    }
                    aria-label={floatingVideoSettings.muted ? "Unmute" : "Mute"}
                  >
                    {floatingVideoSettings.muted ? (
                      <svg viewBox="0 0 24 24" className="h-4 w-4">
                        <path d="M6 9h4l5-4v14l-5-4H6zM19 9l-4 4m0-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-4 w-4">
                        <path d="M12 6.1 7.6 9H5a3 3 0 0 0-3 3v0a3 3 0 0 0 3 3h2.6l4.4 3.6V6.1zM18.1 4.9a8.8 8.8 0 0 1 0 14.2M15.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <div className="relative flex-1">
                    <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-gray-200/90" />
                    <div
                      className="pointer-events-none absolute left-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-[#5B6CFF]"
                      style={{
                        width: `${floatingVideoSettings.muted ? 0 : floatingVideoSettings.volume}%`,
                      }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={floatingVideoSettings.muted ? 0 : floatingVideoSettings.volume}
                      onChange={(event) =>
                        updateClipSettings(floatingMenuEntry.clip.id, (current) => ({
                          ...current,
                          volume: clamp(Number(event.target.value), 0, 100),
                          muted: clamp(Number(event.target.value), 0, 100) === 0,
                        }))
                      }
                      className="refined-slider relative z-10 h-5 w-full cursor-pointer appearance-none bg-transparent"
                      aria-label="Volume"
                    />
                  </div>
                  <input
                    readOnly
                    value={`${floatingVideoSettings.muted ? 0 : floatingVideoSettings.volume}%`}
                    className="h-7 w-14 rounded-lg border border-transparent bg-gray-50 px-2 text-right text-xs font-semibold text-gray-600"
                  />
                </div>
                <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
                  <span>Fade Audio In/Out</span>
                  <ToggleSwitch
                    checked={floatingVideoSettings.fadeEnabled}
                    onChange={(next) =>
                      updateClipSettings(floatingMenuEntry.clip.id, (current) => ({
                        ...current,
                        fadeEnabled: next,
                      }))
                    }
                    ariaLabel="Toggle audio fade"
                  />
                </div>
              </div>
            )}
            {floatingMenu.showSpeed && floatingVideoSettings && (
              <div
                className={`mt-2 space-y-3 p-3 ${floaterSurfaceClass}`}
                style={{ width: floaterPanelWidth }}
              >
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
                  Speed
                </span>
                <div className="flex flex-wrap gap-2">
                  {speedPresets.map((preset) => {
                    const isActive = floatingVideoSettings.speed === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          isActive
                            ? "bg-[#EEF2FF] text-[#335CFF] shadow-[inset_0_0_0_1px_rgba(51,92,255,0.25)]"
                            : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                        }`}
                        onClick={() =>
                          updateClipSettings(floatingMenuEntry.clip.id, (current) => ({
                            ...current,
                            speed: preset,
                          }))
                        }
                        aria-pressed={isActive}
                      >
                        {formatSpeedLabel(preset)}x
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      speedPresets.includes(floatingVideoSettings.speed)
                        ? "bg-gray-50 text-gray-600 hover:bg-gray-100"
                        : "bg-[#EEF2FF] text-[#335CFF] shadow-[inset_0_0_0_1px_rgba(51,92,255,0.25)]"
                    }`}
                    onClick={() =>
                      updateClipSettings(floatingMenuEntry.clip.id, (current) => ({
                        ...current,
                        speed: speedPresets.includes(current.speed) ? 1.25 : current.speed,
                      }))
                    }
                  >
                    Custom
                  </button>
                </div>
                {!speedPresets.includes(floatingVideoSettings.speed) && (
                  <div className="flex items-center justify-between rounded-lg border border-gray-200/70 bg-gray-50/70 px-3 py-2 text-xs text-gray-500">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                      Custom
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0.1}
                        max={4}
                        step={0.05}
                        value={floatingVideoSettings.speed}
                        onChange={(event) =>
                          updateClipSettings(floatingMenuEntry.clip.id, (current) => ({
                            ...current,
                            speed: clamp(Number(event.target.value), 0.1, 4),
                          }))
                        }
                        className="w-16 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700"
                      />
                      <span className="text-xs text-gray-400">x</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {floatingMenu.showMore && (
              <div className="relative">
                <div
                  className={`p-2 ${floaterSurfaceClass}`}
                  style={{ width: floaterMenuWidth }}
                >
                  {floatingVideoSettings && (
                    <>
                      <button
                        type="button"
                        className={floaterMenuItemClass}
                        onClick={() => {
                          setFloatingMenu((prev) => ({
                            ...prev,
                            showMore: true,
                            showOpacity: !prev.showOpacity,
                            showCorners: false,
                            showTiming: false,
                            showOrder: false,
                          }));
                        }}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-500">
                            <path d="M13 10a5 5 0 0 1-10 0c0-3.5 5-9 5-9s5 5.5 5 9" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="truncate">Opacity</span>
                        </span>
                        <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-400">
                          <path d="m6 12 4-4-4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={floaterMenuItemClass}
                        onClick={() => {
                          setFloatingMenu((prev) => ({
                            ...prev,
                            showMore: true,
                            showCorners: !prev.showCorners,
                            showOpacity: false,
                            showTiming: false,
                            showOrder: false,
                          }));
                        }}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-500">
                            <path d="M12.2 13a.8.8 0 1 0 1.6 0zM13 9h-.8zM7 3v.8zm-4-.8a.8.8 0 1 0 0 1.6zM14 13V9h-1.6v4zM7 2.2H3v1.6h4zM13.8 9A6.8 6.8 0 0 0 7 2.2v1.6c2.9 0 5.2 2.3 5.2 5.2z" fill="currentColor" />
                          </svg>
                          <span className="truncate">Round Corners</span>
                        </span>
                        <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-400">
                          <path d="m6 12 4-4-4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={floaterMenuItemClass}
                        onClick={() => {
                          setVideoPanelView("adjust");
                          closeFloatingMenu();
                        }}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-500">
                            <path d="M10 5.3a2 2 0 1 0 4 0 2 2 0 0 0-4 0m0 0H2.7m3.3 5.4a2 2 0 1 0-4 0 2 2 0 0 0 4 0m0 0h7.3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          </svg>
                          <span className="truncate">Adjust</span>
                        </span>
                      </button>
                      <div className="my-1 h-px bg-gray-100" />
                    </>
                  )}
                  <button
                    type="button"
                    className={floaterMenuItemClass}
                    onClick={() => {
                      handleDuplicateClip();
                      closeFloatingMenu();
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-500">
                        <path d="M11 5V2a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3m1-7h7a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6c0-.6.4-1 1-1z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="truncate">Copy</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={floaterMenuItemClass}
                    onClick={() =>
                      setFloatingMenu((prev) => ({
                        ...prev,
                        showOrder: !prev.showOrder,
                        showMore: true,
                        showOpacity: false,
                        showCorners: false,
                        showTiming: false,
                      }))
                    }
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-500">
                        <path d="m1 10.3 6.4 3.5a2 2 0 0 0 1.9 0l6.4-3.5M1 6.6l6.4 3.1a2.3 2.3 0 0 0 2.1 0l6.4-3.1" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="truncate">Order</span>
                    </span>
                    <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-400">
                      <path d="m6 12 4-4-4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <div className="my-1 h-px bg-gray-100" />
                  <button
                    type="button"
                    className={floaterMenuItemClass}
                    onClick={() => {
                      setFloatingMenu((prev) => ({
                        ...prev,
                        showMore: true,
                        showTiming: !prev.showTiming,
                        showOpacity: false,
                        showCorners: false,
                        showOrder: false,
                      }));
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-500">
                        <path d="M8 2.7a6 6 0 1 0 0 12 6 6 0 0 0 0-12m0 0V1.3m0 4v3.3m2 0H8m2-7.3H6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="truncate">Adjust Timing</span>
                    </span>
                    <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-400">
                      <path d="m6 12 4-4-4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {floatingVideoSettings && (
                    <>
                      <button
                        type="button"
                        className={floaterMenuItemClass}
                        onClick={() => {
                          replaceInputRef.current?.click();
                          closeFloatingMenu();
                        }}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-500">
                            <path d="m2 9 2.4 2.5A4.9 4.9 0 0 0 8 13a5 5 0 0 0 4-2M2 9v2.8M2 9h2.8M14 7l-2.4-2.5A4.9 4.9 0 0 0 8 3a5 5 0 0 0-4 2M14 7V4.2M14 7h-2.8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="truncate">Replace Video</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={floaterMenuItemClass}
                        onClick={() => {
                          handleDetachAudio();
                          closeFloatingMenu();
                        }}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-500">
                            <path d="m8.9 11.8-1.4 1.4a3.3 3.3 0 0 1-4.7-4.7l1.4-1.4M7.1 4.2l1.4-1.4a3.3 3.3 0 0 1 4.7 4.7l-1.4 1.4M9.9 6.1 6.1 9.9" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="truncate">Detach Audio</span>
                        </span>
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className={`${floaterMenuItemClass} text-red-600 hover:bg-red-50`}
                    onClick={() => {
                      handleDeleteSelected();
                      closeFloatingMenu();
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <svg viewBox="0 0 16 16" className="h-4 w-4">
                        <path d="M6.4 7.2V12m3.2-4.8V12M1.6 4h12.8m-12 0 .7 9.7A1.6 1.6 0 0 0 4.7 15.2h6.6a1.6 1.6 0 0 0 1.6-1.5L13.6 4m-3.2 0V1.6a.8.8 0 0 0-.8-.8H6.4a.8.8 0 0 0-.8.8V4" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="truncate">Delete</span>
                    </span>
                  </button>
                </div>
                {floatingMenu.showOrder && (
                  <div
                    className={`absolute top-2 ${floatingSubmenuClass} p-2 ${floaterSurfaceClass}`}
                    style={{ width: floaterSubmenuWidth }}
                  >
                    <button
                      type="button"
                      className={floaterMenuItemClass}
                      onClick={() => {
                        handleReorderClip(floatingMenuEntry.clip.id, "front");
                        closeFloatingMenu();
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-500">
                          <path d="M1 15.8h14M3 7.8h10M13.3 8v3M13 11.2H3M2.8 11V8M8 1l-3 3m3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="truncate">Bring to Front</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={floaterMenuItemClass}
                      onClick={() => {
                        handleReorderClip(floatingMenuEntry.clip.id, "forward");
                        closeFloatingMenu();
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-500">
                          <path d="M3 9.8h10M13.3 10v3M13 13.2H3M2.8 13V10M8 2l-3 3m3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="truncate">Bring Forward</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={floaterMenuItemClass}
                      onClick={() => {
                        handleReorderClip(floatingMenuEntry.clip.id, "backward");
                        closeFloatingMenu();
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-500">
                          <path d="M13 6.2H3M2.8 6V3M3 2.8h10M13.3 3v3M8 15l-3-3m3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="truncate">Send Backward</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={floaterMenuItemClass}
                      onClick={() => {
                        handleReorderClip(floatingMenuEntry.clip.id, "back");
                        closeFloatingMenu();
                      }}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-500">
                          <path d="M15 1.2H1M13 8.2H3M2.8 8V5M3 4.8h10M13.3 5v3M8 15l-3-3m3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="truncate">Send to Back</span>
                      </span>
                    </button>
                  </div>
                )}
                {floatingMenu.showOpacity && (
                  <div
                    className={`absolute top-2 ${floatingSubmenuClass} p-3 ${floaterSurfaceClass}`}
                    style={{ width: floaterSubmenuWidth }}
                  >
                    {floatingVideoSettings ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-600">Opacity</span>
                          <input
                            readOnly
                            value={`${floatingVideoSettings.opacity}%`}
                            className="h-7 w-14 rounded-lg border border-transparent bg-gray-50 px-2 text-right text-xs font-semibold text-gray-600"
                          />
                        </div>
                        <div className="relative">
                          <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-gray-200/90" />
                          <div
                            className="pointer-events-none absolute left-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-[#5B6CFF]"
                            style={{ width: `${floatingVideoSettings.opacity}%` }}
                          />
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={floatingVideoSettings.opacity}
                            onChange={(event) =>
                              updateClipSettings(floatingMenuEntry.clip.id, (current) => ({
                                ...current,
                                opacity: clamp(Number(event.target.value), 0, 100),
                              }))
                            }
                            className="refined-slider relative z-10 h-5 w-full cursor-pointer appearance-none bg-transparent"
                            aria-label="Opacity"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">Opacity controls are available for video clips.</div>
                    )}
                  </div>
                )}
                {floatingMenu.showCorners && (
                  <div
                    className={`absolute top-2 ${floatingSubmenuClass} p-3 ${floaterSurfaceClass}`}
                    style={{ width: floaterSubmenuWidth }}
                  >
                    {floatingVideoSettings ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-gray-600">Round Corners</span>
                        <ToggleSwitch
                          checked={floatingVideoSettings.roundCorners}
                          onChange={(next) =>
                            updateClipSettings(floatingMenuEntry.clip.id, (current) => {
                              if (!next) {
                                return { ...current, roundCorners: false };
                              }
                              const baseRadius =
                                current.cornerRadius > 0
                                  ? current.cornerRadius
                                  : 18;
                              return {
                                ...current,
                                roundCorners: true,
                                cornerRadius: current.cornerRadiusLinked
                                  ? baseRadius
                                  : current.cornerRadius,
                                cornerRadii: {
                                  topLeft: current.cornerRadii.topLeft || baseRadius,
                                  topRight: current.cornerRadii.topRight || baseRadius,
                                  bottomRight: current.cornerRadii.bottomRight || baseRadius,
                                  bottomLeft: current.cornerRadii.bottomLeft || baseRadius,
                                },
                              };
                            })
                          }
                          ariaLabel="Toggle rounded corners"
                        />
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">Corner controls are available for video clips.</div>
                    )}
                  </div>
                )}
                {floatingMenu.showTiming && (
                  <div
                    className={`absolute top-2 ${floatingSubmenuClass} space-y-3 p-3 ${floaterSurfaceClass}`}
                    style={{ width: floaterSubmenuWidth }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-600">Duration</span>
                      <input
                        key={`${floatingMenuEntry.clip.id}-duration-${floatingMenuEntry.clip.duration}`}
                        defaultValue={formatTimeWithTenths(floatingMenuEntry.clip.duration)}
                        onBlur={(event) =>
                          handleDurationCommit(
                            floatingMenuEntry.clip,
                            event.target.value
                          )
                        }
                        className="h-7 w-20 rounded-lg border border-gray-200/70 bg-white px-2 text-right text-xs font-semibold text-gray-700"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-600">Start</span>
                      <div className="flex items-center gap-2">
                        <input
                          key={`${floatingMenuEntry.clip.id}-start-${floatingMenuEntry.clip.startTime}`}
                          defaultValue={formatTimeWithTenths(
                            floatingMenuEntry.clip.startTime
                          )}
                          onBlur={(event) =>
                            handleStartTimeCommit(
                              floatingMenuEntry.clip,
                              event.target.value
                            )
                          }
                          className="h-7 w-20 rounded-lg border border-gray-200/70 bg-white px-2 text-right text-xs font-semibold text-gray-700"
                        />
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200/70 bg-white text-gray-500 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30"
                          aria-label="Set start to playhead"
                          onClick={() =>
                            handleSetStartAtPlayhead(floatingMenuEntry.clip)
                          }
                        >
                          <svg viewBox="0 0 16 16" className="h-4 w-4">
                            <path
                              d="M8 2.7a6 6 0 1 0 0 12 6 6 0 0 0 0-12m0 0V1.3m0 4v3.3m2 0H8m2-7.3H6"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-600">End</span>
                      <div className="flex items-center gap-2">
                        <input
                          key={`${floatingMenuEntry.clip.id}-end-${floatingMenuEntry.clip.startTime}-${floatingMenuEntry.clip.duration}`}
                          defaultValue={formatTimeWithTenths(
                            floatingMenuEntry.clip.startTime +
                              floatingMenuEntry.clip.duration
                          )}
                          onBlur={(event) =>
                            handleEndTimeCommit(
                              floatingMenuEntry.clip,
                              event.target.value
                            )
                          }
                          className="h-7 w-20 rounded-lg border border-gray-200/70 bg-white px-2 text-right text-xs font-semibold text-gray-700"
                        />
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200/70 bg-white text-gray-500 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30"
                          aria-label="Set end to playhead"
                          onClick={() =>
                            handleSetEndAtPlayhead(floatingMenuEntry.clip)
                          }
                        >
                          <svg viewBox="0 0 16 16" className="h-4 w-4">
                            <path
                              d="M8 2.7a6 6 0 1 0 0 12 6 6 0 0 0 0-12m0 0V1.3m0 4v3.3m2 0H8m2-7.3H6"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );

  const renderTimeline = () => (
    <div
      className="group flex min-w-0 flex-col border-t border-gray-200 bg-white"
      style={{ height: `${timelineHeight}px` }}
    >
      <div
        className={`group relative flex cursor-row-resize items-center justify-center bg-white touch-none ${isResizingTimeline
          ? "border-b border-[#335CFF]"
          : "border-b border-gray-100"
          }`}
        style={{ height: `${timelineHandleHeight}px` }}
        onPointerDown={handleTimelineResizeStart}
        aria-label="Resize timeline"
      >
        <span
          className={`h-0.5 w-16 rounded-full transition ${isResizingTimeline
            ? "bg-[#335CFF] opacity-100"
            : "bg-gray-300 opacity-0 group-hover:opacity-100 group-hover:bg-[#94A3B8]"
            }`}
        />
        {isResizingTimeline && (
          <span className="absolute left-0 right-0 top-0 h-0.5 bg-[#335CFF]" />
        )}
      </div>
      <div className="flex h-14 items-center px-3">
        <div className="flex flex-1 items-center gap-2">
          <button
            className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={handleSplitClip}
            disabled={timeline.length === 0}
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4">
              <path
                d="M5.413 5.413 8 8m1.647 1.653 3.686 3.68m-7.919-2.747a2 2 0 1 0-2.828 2.828 2 2 0 0 0 2.828-2.828m0 0 7.92-7.92M6 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden lg:block">Split</span>
          </button>
          {selectedClipIds.length > 0 && (
            <button
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                isTimelineSnappingEnabled
                  ? "border-[#335CFF]/30 bg-[#EEF2FF] text-[#335CFF]"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
              type="button"
              aria-pressed={isTimelineSnappingEnabled}
              aria-label="Toggle magnet snapping"
              title="Toggle magnet snapping (hold Alt to bypass)"
              onClick={() =>
                setIsTimelineSnappingEnabled((prev) => !prev)
              }
            >
              <Magnet className="h-4 w-4" />
              <span className="hidden lg:block">Magnet</span>
            </button>
          )}
          {canFuseClips && (
            <button
              className="flex items-center gap-2 rounded-lg border border-[#10B981]/30 bg-[#ECFDF5] px-3 py-2 text-xs font-semibold text-[#10B981] transition hover:bg-[#D1FAE5]"
              type="button"
              aria-label="Fuse clips"
              title="Fuse selected clips into one continuous clip"
              onClick={handleFuseClips}
            >
              <ChevronsLeftRightEllipsis className="h-4 w-4" />
              <span className="hidden lg:block">Fuse</span>
            </button>
          )}
        </div>
        <div className="relative flex items-center">
          <div className="flex items-center gap-0.5">
            {/* Jump to clip start */}
            <button
              className="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              type="button"
              aria-label="Jump to clip start"
              title="Jump to clip start"
              onClick={() => {
                if (isPlaying) {
                  setIsPlaying(false);
                }
                const selectedClip = selectedClipId
                  ? timeline.find((c) => c.id === selectedClipId)
                  : null;
                const targetTime = selectedClip ? selectedClip.startTime : 0;
                handleScrubToTime(targetTime);
              }}
            >
              <svg viewBox="0 0 16 16" className="h-2.5 w-2.5">
                <path
                  d="M2 3v10M4 8l6-5v10z"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {/* Frame back */}
            <button
              className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-700"
              type="button"
              aria-label="Step back"
              title={`Step back (${frameStepLabel})`}
              onClick={() => {
                if (isPlaying) {
                  setIsPlaying(false);
                }
                handleScrubToTime(currentTime - dynamicFrameStep);
              }}
            >
              <svg viewBox="0 0 16 16" className="h-3 w-3">
                <path
                  d="M14 12.913a.5.5 0 0 1-.826.38L7.443 8.38a.5.5 0 0 1 0-.76l5.731-4.912a.5.5 0 0 1 .826.38zM7 12.913a.5.5 0 0 1-.825.38L.443 8.38a.5.5 0 0 1 0-.76l5.732-4.913a.5.5 0 0 1 .825.38z"
                  fill="currentColor"
                />
              </svg>
            </button>
            {/* Play/Pause */}
            <button
              className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-900"
              type="button"
              aria-label="Play"
              onClick={handleTogglePlayback}
              disabled={!canPlay}
            >
              {isPlaying ? (
                <svg viewBox="0 0 16 16" className="h-5 w-5">
                  <path d="M5 3h2.5v10H5zM9 3h2.5v10H9z" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" className="h-5 w-5">
                  <path
                    d="M3 1.91a.5.5 0 0 1 .768-.421l9.57 6.09a.5.5 0 0 1 0 .843l-9.57 6.089A.5.5 0 0 1 3 14.089z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </button>
            {/* Frame forward */}
            <button
              className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-700"
              type="button"
              aria-label="Step forward"
              title={`Step forward (${frameStepLabel})`}
              onClick={() => {
                if (isPlaying) {
                  setIsPlaying(false);
                }
                handleScrubToTime(currentTime + dynamicFrameStep);
              }}
            >
              <svg viewBox="0 0 16 16" className="h-3 w-3">
                <path
                  d="M2 3.087a.5.5 0 0 1 .825-.38L8.557 7.62a.5.5 0 0 1 0 .76l-5.732 4.913a.5.5 0 0 1-.825-.38zM9 3.087a.5.5 0 0 1 .825-.38l5.732 4.913a.5.5 0 0 1 0 .76l-5.732 4.913a.5.5 0 0 1-.825-.38z"
                  fill="currentColor"
                />
              </svg>
            </button>
            {/* Jump to clip end */}
            <button
              className="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              type="button"
              aria-label="Jump to clip end"
              title="Jump to clip end"
              onClick={() => {
                if (isPlaying) {
                  setIsPlaying(false);
                }
                const selectedClip = selectedClipId
                  ? timeline.find((c) => c.id === selectedClipId)
                  : null;
                const targetTime = selectedClip
                  ? selectedClip.startTime + selectedClip.duration
                  : timelineDuration;
                handleScrubToTime(targetTime);
              }}
            >
              <svg viewBox="0 0 16 16" className="h-2.5 w-2.5">
                <path
                  d="M14 3v10M12 8l-6-5v10z"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div className="absolute left-full ml-2 flex items-center gap-1 text-xs font-medium text-gray-500">
            <span className="min-w-[48px]">
              {formatTimelineLabel(currentTime)}
            </span>
            <span>/</span>
            <span>{formatTimelineLabel(timelineDuration)}</span>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-end gap-2">
          <button
            className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700"
            type="button"
            aria-label="Zoom out"
            onClick={() =>
              setTimelineScale((value) =>
                clamp(value - 2, timelineScaleMin, timelineScaleMax)
              )
            }
          >
            -
          </button>
          <div className="hidden w-24 sm:block">
            <input
              type="range"
              min={timelineScaleMin}
              max={timelineScaleMax}
              step={0.02}
              value={timelineScale}
              onChange={(event) =>
                setTimelineScale(Number(event.target.value))
              }
              className="w-full accent-[#335CFF]"
              aria-label="Timeline zoom"
            />
          </div>
          <button
            className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700"
            type="button"
            aria-label="Zoom in"
            onClick={() =>
              setTimelineScale((value) =>
                clamp(value + 2, timelineScaleMin, timelineScaleMax)
              )
            }
          >
            +
          </button>
          <button
            className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700"
            type="button"
            onClick={handleFitTimeline}
          >
            Fit
          </button>
        </div>
      </div>

      <div
        className="relative w-full min-w-0 flex-1 overflow-x-auto overflow-y-auto overscroll-x-contain overscroll-y-contain px-4 pb-5"
        ref={timelineScrollRef}
        onWheel={handleTimelineWheel}
        onPointerDown={handleTimelinePanStart}
        onPointerMove={handleTimelinePanMove}
        onPointerUp={handleTimelinePanEnd}
        onPointerCancel={handleTimelinePanEnd}
      >
        <div
          className="relative"
          style={{
            minWidth: `${timelineDuration * timelineScale + timelinePadding * 2}px`,
          }}
        >
          <div
            className="relative h-6 text-[11px] text-gray-400"
            style={{ paddingLeft: `${timelinePadding}px` }}
            onMouseDown={(event) => {
              event.preventDefault();
              setIsScrubbing(true);
              if (isPlaying) {
                handleTogglePlayback();
              }
              handleScrubTo(event.clientX);
            }}
          >
            {Array.from(
              { length: Math.floor(timelineDuration / tickStep) + 1 },
              (_, index) => {
                const tick = index * tickStep;
                if (index % tickLabelStride !== 0) {
                  return null;
                }
                return (
                  <span
                    key={`tick-${tick}`}
                    className="absolute top-0"
                    style={{ left: `${tick * timelineScale}px` }}
                  >
                    {timelineDuration <= 60
                      ? `${tick}s`
                      : formatTimelineLabel(tick)}
                  </span>
                );
              }
            )}
          </div>
          <div
            ref={timelineTrackRef}
            className={`relative mt-2 rounded-2xl border border-gray-200 bg-[linear-gradient(90deg,_rgba(148,163,184,0.15)_1px,_transparent_1px)] p-4 transition ${dragOverTimeline ? "ring-2 ring-[#335CFF]" : ""
              }`}
            style={{
              backgroundSize: `${timelineScale * tickStep}px 100%`,
              minHeight: `${trackMinHeight}px`,
            }}
            onPointerDown={handleTimelineSelectStart}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOverTimeline(true);
            }}
            onDragLeave={() => setDragOverTimeline(false)}
            onDrop={handleTimelineDrop}
          >
            {dragOverTimeline && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/80 text-sm font-semibold text-[#335CFF]">
                Drop to add to timeline
              </div>
            )}
            {rangeSelection && (
              <div
                className="pointer-events-none absolute z-30 rounded-lg border border-[#2DD4BF] bg-[#2DD4BF]/25 shadow-[0_0_0_1px_rgba(45,212,191,0.6)]"
                style={{
                  left: `${clamp(
                    Math.min(
                      rangeSelection.startX,
                      rangeSelection.currentX
                    ) -
                    rangeSelection.trackRect.left -
                    timelinePadding,
                    0,
                    timelineDuration * timelineScale
                  ) + timelinePadding}px`,
                  top: `${clamp(
                    Math.min(
                      rangeSelection.startY,
                      rangeSelection.currentY
                    ) -
                    rangeSelection.trackRect.top -
                    timelinePadding,
                    0,
                    lanesHeight
                  ) + timelinePadding}px`,
                  width: `${Math.max(
                    1,
                    clamp(
                      Math.max(
                        rangeSelection.startX,
                        rangeSelection.currentX
                      ) -
                      rangeSelection.trackRect.left -
                      timelinePadding,
                      0,
                      timelineDuration * timelineScale
                    ) -
                    clamp(
                      Math.min(
                        rangeSelection.startX,
                        rangeSelection.currentX
                      ) -
                      rangeSelection.trackRect.left -
                      timelinePadding,
                      0,
                      timelineDuration * timelineScale
                    )
                  )}px`,
                  height: `${Math.max(
                    1,
                    clamp(
                      Math.max(
                        rangeSelection.startY,
                        rangeSelection.currentY
                      ) -
                      rangeSelection.trackRect.top -
                      timelinePadding,
                      0,
                      lanesHeight
                    ) -
                    clamp(
                      Math.min(
                        rangeSelection.startY,
                        rangeSelection.currentY
                      ) -
                      rangeSelection.trackRect.top -
                      timelinePadding,
                      0,
                      lanesHeight
                    )
                  )}px`,
                }}
              />
            )}
            {timelineSnapGuide !== null && (
              <div
                className="pointer-events-none absolute top-4 bottom-4 w-px bg-amber-400/90 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]"
                style={{
                  left: `${timelineSnapGuide * timelineScale + timelinePadding}px`,
                }}
              />
            )}
            {timelineCollisionGuide !== null && (
              <div
                className="pointer-events-none absolute top-4 bottom-4 w-px border-l border-dashed border-amber-300/90"
                style={{
                  left: `${timelineCollisionGuide * timelineScale + timelinePadding}px`,
                }}
              />
            )}
            {timelineLayout.length > 0 && (
              <button
                type="button"
                aria-label="Drag playhead"
                className="absolute top-4 bottom-4 w-6 -translate-x-1/2 cursor-ew-resize border-0 bg-transparent p-0 focus:outline-none"
                style={{
                  left: `${clamp(
                    currentTime,
                    0,
                    timelineDuration
                  ) * timelineScale + timelinePadding}px`,
                }}
                onPointerDown={handlePlayheadPointerDown}
              >
                <span className="absolute left-1/2 h-full w-px -translate-x-1/2 bg-[#335CFF]" />
                <span className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-[#335CFF] shadow-[0_0_0_2px_rgba(255,255,255,0.85)]" />
              </button>
            )}
            {timelineLayout.length === 0 ? (
              <button
                type="button"
                data-testid="@editor/timeline/add-media-button"
                className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-full border border-dashed border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-500 shadow-sm"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={handleUploadClick}
              >
                <span className="text-lg text-gray-400">＋</span>
                Add media to this project
              </button>
            ) : (
              <div
                className="relative flex flex-col"
                style={{ gap: `${laneGap}px` }}
              >
                {laneRows.map((lane) => {
                  const laneClips = timelineLayout
                    .filter((entry) => entry.clip.laneId === lane.id)
                    .sort((a, b) => a.left - b.left);
                  const laneClipInsetY =
                    lane.type === "video"
                      ? 0
                      : Math.max(4, Math.round(lane.height * 0.12));
                  const laneClipHeight =
                    lane.type === "video"
                      ? lane.height
                      : Math.max(18, lane.height - laneClipInsetY * 2);
                  return (
                    <div
                      key={lane.id}
                      className="relative overflow-hidden rounded-xl border border-gray-100 bg-white/70"
                      style={{ height: `${lane.height}px` }}
                    >
                      <div className="absolute left-2 top-2 text-[10px] uppercase tracking-[0.12em] text-gray-400">
                        {lane.label}
                      </div>
                      {dragPreview && dragPreview.laneId === lane.id && (
                        <div
                          className="pointer-events-none absolute rounded-sm border-2 border-dashed border-amber-300/90 bg-amber-100/30"
                          style={{
                            left: `${dragPreview.startTime * timelineScale}px`,
                            width: `${dragPreview.duration * timelineScale}px`,
                            top: `${laneClipInsetY}px`,
                            height: `${laneClipHeight}px`,
                          }}
                        />
                      )}
                      {laneClips.map(({ clip, asset, left }) => {
                        const width = Math.max(
                          1,
                          clip.duration * timelineScale
                        );
                        const isSelected =
                          selectedClipIdsSet.has(clip.id);
                        const isDragging =
                          dragClipState?.clipId === clip.id;
                        const waveform = getWaveformBars(clip.id, 24);
                        const thumbnailCount =
                          lane.type === "video"
                            ? getThumbnailCountForWidth(width)
                            : 0;
                        const thumbnailFrames =
                          timelineThumbnails[clip.id]?.frames ?? [];
                        const hasThumbnailFrames =
                          asset.kind === "video" &&
                          thumbnailFrames.length === thumbnailCount &&
                          thumbnailFrames.some((frame) => Boolean(frame));
                        const clipBorderClass = isSelected
                          ? "border-[#335CFF]"
                          : "border-transparent";
                        const collisionHighlight =
                          isDragging && timelineCollisionActive
                            ? "shadow-[0_0_0_2px_rgba(251,191,36,0.65)]"
                            : "";
                        const dragLiftClass = isDragging
                          ? "z-30 -translate-y-1"
                          : "";
                        const dragLiftShadow = isDragging
                          ? "shadow-[0_18px_30px_rgba(15,23,42,0.25)] cursor-grabbing"
                          : "";
                        return (
                          <div
                            key={clip.id}
                            className={`absolute ${dragLiftClass}`}
                            style={{
                              left: `${left * timelineScale}px`,
                              width,
                              top: `${laneClipInsetY}px`,
                              height: `${laneClipHeight}px`,
                            }}
                          >
                            <button
                              type="button"
                              className={`group relative flex h-full w-full overflow-hidden rounded-sm border-0 bg-white p-0 text-left text-[10px] font-semibold shadow-sm transition ${isDragging ? "opacity-70" : ""
                                } ${collisionHighlight} ${dragLiftShadow}`}
                              data-timeline-clip="true"
                              onContextMenu={(event) =>
                                handleTimelineClipContextMenu(event, clip, asset)
                              }
                              onMouseDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setActiveAssetId(asset.id);
                                if (asset.kind === "text") {
                                  setActiveTool("text");
                                }
                                if (event.shiftKey) {
                                  setSelectedClipIds((prev) => {
                                    if (prev.includes(clip.id)) {
                                      const next = prev.filter(
                                        (id) => id !== clip.id
                                      );
                                      setSelectedClipId(
                                        next[0] ?? null
                                      );
                                      return next;
                                    }
                                    const next = [...prev, clip.id];
                                    setSelectedClipId(clip.id);
                                    return next;
                                  });
                                  return;
                                }
                                setSelectedClipIds([clip.id]);
                                setSelectedClipId(clip.id);
                                dragClipHistoryRef.current = false;
                                const nextDragState = {
                                  clipId: clip.id,
                                  startX: event.clientX,
                                  startLeft: left,
                                  startLaneId: clip.laneId,
                                  previewTime: left,
                                  previewLaneId: clip.laneId,
                                };
                                dragClipStateRef.current = nextDragState;
                                setDragClipState(nextDragState);
                              }}
                            >
                              {lane.type === "video" && (
                                <div
                                  className="absolute inset-0 grid h-full w-full"
                                  style={{
                                    gridTemplateColumns: `repeat(${thumbnailCount}, minmax(0, 1fr))`,
                                  }}
                                >
                                  {Array.from(
                                    { length: thumbnailCount },
                                    (_, index) => {
                                      const frameTime = clamp(
                                        clip.startOffset +
                                          (clip.duration * (index + 0.5)) /
                                            Math.max(1, thumbnailCount),
                                        clip.startOffset,
                                        clip.startOffset + clip.duration - 0.05
                                      );
                                      return (
                                        <div
                                          key={`${clip.id}-thumb-${index}`}
                                          className="relative h-full w-full overflow-hidden border-r border-white/30 bg-slate-100 last:border-r-0"
                                        >
                                          {asset.kind === "image" ? (
                                            <img
                                              src={asset.url}
                                              alt={asset.name}
                                              className="h-full w-full object-cover"
                                              draggable={false}
                                            />
                                          ) : hasThumbnailFrames &&
                                            thumbnailFrames[index] ? (
                                            <img
                                              src={thumbnailFrames[index]}
                                              alt={`${asset.name} frame ${index + 1}`}
                                              className="h-full w-full object-cover"
                                              draggable={false}
                                            />
                                          ) : (
                                            <video
                                              src={asset.url}
                                              className="h-full w-full object-cover"
                                              muted
                                              playsInline
                                              preload="auto"
                                              tabIndex={-1}
                                              onLoadedData={(event) => {
                                                const target =
                                                  event.currentTarget;
                                                if (
                                                  Math.abs(
                                                    target.currentTime -
                                                      frameTime
                                                  ) > 0.01
                                                ) {
                                                  target.currentTime =
                                                    frameTime;
                                                }
                                              }}
                                            />
                                          )}
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              )}
                              {lane.type === "audio" && (
                                <div className="absolute inset-0 bg-[#EEF2FF]" />
                              )}
                              {lane.type === "text" && (
                                <div className="absolute inset-0 bg-[#F8FAFF]" />
                              )}
                              {lane.type === "audio" && (
                                <div className="absolute inset-0 flex items-end gap-[2px] px-2 py-2">
                                  {waveform.map((value, index) => (
                                    <span
                                      key={`${clip.id}-wave-${index}`}
                                      className="w-1 rounded-full bg-[#7C93FF]"
                                      style={{
                                        height: `${Math.round(
                                          value * (lane.height - 12)
                                        )}px`,
                                        opacity: 0.65,
                                      }}
                                    />
                                  ))}
                                </div>
                              )}
                              <div
                                className={`pointer-events-none absolute inset-0 rounded-sm border-4 transition ${clipBorderClass}`}
                              />
                              <span className="absolute bottom-1 right-1 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                                {formatDuration(clip.duration)}
                              </span>
                              <span
                                className="absolute left-0 top-0 h-full w-2 cursor-col-resize rounded-l-sm bg-black/5"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  trimHistoryRef.current = false;
                                  setTrimState({
                                    clipId: clip.id,
                                    edge: "start",
                                    startX: event.clientX,
                                    startDuration: clip.duration,
                                    startOffset: clip.startOffset,
                                    startTime: clip.startTime,
                                  });
                                }}
                              />
                              <span
                                className="absolute right-0 top-0 h-full w-2 cursor-col-resize rounded-r-sm bg-black/5"
                                onMouseDown={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  trimHistoryRef.current = false;
                                  setTrimState({
                                    clipId: clip.id,
                                    edge: "end",
                                    startX: event.clientX,
                                    startDuration: clip.duration,
                                    startOffset: clip.startOffset,
                                    startTime: clip.startTime,
                                  });
                                }}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {/* Timeline Context Menu - fixed positioning to allow extending above scroll area */}
        {timelineContextMenu.open && timelineContextMenuEntry && (
          <div
            ref={timelineContextMenuRef}
            className="fixed z-50"
            style={{ left: timelineContextMenu.x, top: timelineContextMenu.y }}
            onPointerDown={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div
              className={`flex flex-col py-2 ${floaterSurfaceClass}`}
              style={{ width: `${timelineContextMenuWidth}px` }}
            >
              {/* Split Element */}
              <button
                type="button"
                className={floaterMenuItemClass}
                onClick={() => {
                  handleSplitClip();
                  closeTimelineContextMenu();
                }}
              >
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16" className="text-gray-500">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5.413 5.413 8 8m1.647 1.653 3.686 3.68m-7.919-2.747a2 2 0 1 0-2.828 2.828 2 2 0 0 0 2.828-2.828m0 0 7.92-7.92m-7.92 7.92zM6 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0" />
                  </svg>
                  <span>Split Element</span>
                </div>
              </button>

              {/* Divider */}
              <div className="mx-3 my-1.5 h-px bg-gray-100" />

              {/* Copy */}
              <button
                type="button"
                className={floaterMenuItemClass}
                onClick={() => {
                  handleCopySelection();
                  closeTimelineContextMenu();
                }}
              >
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16" className="text-gray-500">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5V2a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3m.997-6h8.005c.553 0 .998.448.998 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6c0-.552.445-1 .997-1" />
                  </svg>
                  <span>Copy</span>
                </div>
              </button>

              {/* Replace Media - only for video/image/audio */}
              {(timelineContextMenuEntry.asset.kind === "video" || 
                timelineContextMenuEntry.asset.kind === "image" || 
                timelineContextMenuEntry.asset.kind === "audio") && (
                <div className="relative">
                  <button
                    type="button"
                    className={floaterMenuItemClass}
                    onClick={() =>
                      setTimelineContextMenu((prev) => ({
                        ...prev,
                        showReplaceMedia: !prev.showReplaceMedia,
                        showAudio: false,
                      }))
                    }
                  >
                    <div className="flex items-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16" className="text-gray-500">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.594 9.45A5.632 5.632 0 0 0 3.135 5.83m10.459 3.62 1.442-1.563M13.594 9.45l-1.635-1.508M2.442 7.85a5.631 5.631 0 0 0 10.46 3.616M2.443 7.85 1 9.413M2.442 7.85l1.635 1.508" />
                      </svg>
                      <span>Replace Media</span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 16 16" className="text-gray-400">
                      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m6 12 4-4-4-4" />
                    </svg>
                  </button>
                  {timelineContextMenu.showReplaceMedia && (
                    <div
                      className={`absolute top-0 ${timelineContextSubmenuClass} py-2 ${floaterSurfaceClass}`}
                      style={{ width: `${floaterSubmenuWidth}px` }}
                    >
                      <button
                        type="button"
                        className={floaterMenuItemClass}
                        onClick={() => {
                          setActiveTool("media");
                          setIsStockVideoExpanded(false);
                          setIsAssetLibraryExpanded(true);
                          closeTimelineContextMenu();
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16" className="text-gray-500">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2 4.5A2.5 2.5 0 0 1 4.5 2h7A2.5 2.5 0 0 1 14 4.5v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 11.5v-7z" />
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m2 11 3.5-3.5L8 10l2.5-2.5L14 11" />
                            <circle cx="5.5" cy="5.5" r="1" fill="currentColor" />
                          </svg>
                          <span>From Library</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        className={floaterMenuItemClass}
                        onClick={() => {
                          replaceMediaInputRef.current?.click();
                          closeTimelineContextMenu();
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16" className="text-gray-500">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M14 11v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2m6-1V2m0 0L5 5m3-3 3 3" />
                          </svg>
                          <span>Upload New</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Divider */}
              <div className="mx-3 my-1.5 h-px bg-gray-100" />

              {/* Audio - only for video/audio clips */}
              {(timelineContextMenuEntry.asset.kind === "video" || 
                timelineContextMenuEntry.asset.kind === "audio") && (
                <div className="relative">
                  <button
                    type="button"
                    className={floaterMenuItemClass}
                    onClick={() =>
                      setTimelineContextMenu((prev) => ({
                        ...prev,
                        showAudio: !prev.showAudio,
                        showReplaceMedia: false,
                      }))
                    }
                  >
                    <div className="flex items-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16" className="text-gray-500">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 12.667V4.295c0-.574.367-1.084.912-1.265l5.333-1.778A1.333 1.333 0 0 1 14 2.517v8.817m0 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0m-8 1.333a2 2 0 1 1-4 0 2 2 0 0 1 4 0" />
                      </svg>
                      <span>Audio</span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 16 16" className="text-gray-400">
                      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m6 12 4-4-4-4" />
                    </svg>
                  </button>
                  {timelineContextMenu.showAudio && (
                    <div
                      className={`absolute top-0 ${timelineContextSubmenuClass} py-2 ${floaterSurfaceClass}`}
                      style={{ width: `${floaterSubmenuWidth}px` }}
                    >
                      {timelineContextMenuEntry.asset.kind === "video" && (
                        <button
                          type="button"
                          className={floaterMenuItemClass}
                          onClick={() => {
                            handleDetachAudio();
                            closeTimelineContextMenu();
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-500">
                              <path d="m8.9 11.8-1.4 1.4a3.3 3.3 0 0 1-4.7-4.7l1.4-1.4M7.1 4.2l1.4-1.4a3.3 3.3 0 0 1 4.7 4.7l-1.4 1.4M9.9 6.1 6.1 9.9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span>Detach Audio</span>
                          </div>
                        </button>
                      )}
                      {timelineContextMenuEntry.asset.kind === "video" && (
                        <div className="mx-3 my-1.5 h-px bg-gray-100" />
                      )}
                      <button
                        type="button"
                        className={floaterMenuItemClass}
                        onClick={() => {
                          if (timelineContextMenuSettings) {
                            updateClipSettings(timelineContextMenuEntry.clip.id, (current) => ({
                              ...current,
                              muted: !current.muted,
                            }));
                          }
                          closeTimelineContextMenu();
                        }}
                      >
                        <div className="flex items-center gap-3">
                          {timelineContextMenuSettings?.muted ? (
                            <svg viewBox="0 0 24 24" className="h-4 w-4 text-gray-500">
                              <path d="M12 6.1 7.6 9H5a3 3 0 0 0-3 3v0a3 3 0 0 0 3 3h2.6l4.4 3.6V6.1zM18.1 4.9a8.8 8.8 0 0 1 0 14.2M15.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" className="h-4 w-4 text-gray-500">
                              <path d="M6 9h4l5-4v14l-5-4H6zM19 9l-4 4m0-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                          <span>{timelineContextMenuSettings?.muted ? "Unmute Audio" : "Mute Audio"}</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Divider before delete */}
              <div className="mx-3 my-1.5 h-px bg-gray-100" />

              {/* Delete */}
              <button
                type="button"
                className={floaterMenuItemClass}
                onClick={() => {
                  handleDeleteSelected();
                  closeTimelineContextMenu();
                }}
              >
                <div className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16" className="text-gray-500">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6.4 7.2V12zm3.2 0V12zM1.6 4h12.8zm12 0-.694 9.714A1.6 1.6 0 0 1 11.31 15.2H4.69a1.6 1.6 0 0 1-1.596-1.486L2.4 4zm-3.2 0V1.6a.8.8 0 0 0-.8-.8H6.4a.8.8 0 0 0-.8.8V4z" />
                  </svg>
                  <span>Delete</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#F2F4FA] text-[#0E121B]">
      {renderHeader()}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />
      <input
        ref={replaceMediaInputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        className="hidden"
        onChange={handleReplaceMedia}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {renderToolRail()}
        {renderSidebar()}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <main
              ref={mainRef}
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            >
              {renderStage()}
              {renderTimeline()}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
