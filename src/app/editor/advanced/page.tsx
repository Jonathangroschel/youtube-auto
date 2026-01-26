"use client";

export const dynamic = "force-dynamic";

import {
  useEffect,
  useCallback,
  Suspense,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type ChangeEvent,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import { useSearchParams } from "next/navigation";
import { Magnet, ChevronsLeftRightEllipsis } from "lucide-react";
import { GiphyFetch } from "@giphy/js-fetch-api";
import type { IGif } from "@giphy/js-types";
import {
  deleteAssetById,
  loadAssetLibrary,
  uploadAssetFile,
  type AssetLibraryItem,
} from "@/lib/assets/library";
import { createClient } from "@/lib/supabase/client";

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
  clipTransformMaxScale,
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
  createSubtitleTransform,
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
  noiseDataUrl,
  subtitleStylePresets,
  textFontSizes,
  textPresetGroups,
  toolbarItems,
} from "./data";

import { ToggleSwitch } from "./components/toggle-switch";

import { EditorHeader } from "./components/editor-header";
import { EditorSidebar } from "./components/editor-sidebar";
import {
  audioLaneMaxHeight,
  audioLaneMinHeight,
  audioWaveformMinBarHeight,
  buildAudioPeaksAsync,
  formatStockLabel,
  generateVideoThumbnails,
  getTextRenderStyles,
  getThumbnailCountForWidth,
  getWaveformBarCount,
  getWaveformPeakCount,
  giphyApiKey,
  isAudioFile,
  isOrientationLabel,
  isVideoFile,
  measureTextBounds,
  normalizeTimelineTime,
  normalizeWaveformPeak,
  resolveGiphyAssetImage,
  resolveStockVideoCategory,
  resolveStockVideoOrientationFromMeta,
  resolveStockVideoOrientationFromPath,
  resolveStockVideoPosterPath,
  soundFxBucketName,
  soundFxRootPrefix,
  stockMusicBucketName,
  stockMusicRootPrefix,
  stockVideoBucketName,
  stockVideoRootPrefix,
  systemFontFamilies,
  textResizeMaxFontSize,
  textResizeMinFontSize,
  timelineClipEpsilon,
  waitForIdle,
} from "./page-helpers";
import type {
  AudioWaveformData,
  StockAudioTrack,
  StockVideoItem,
  StockVideoOrientation,
  StockVideoOrientationFilter,
} from "./page-helpers";

type SubtitleLanguageOption = {
  code: string;
  label: string;
  detail: string;
  region: string;
};

type SubtitleSegment = {
  id: string;
  clipId: string;
  text: string;
  startTime: number;
  endTime: number;
  sourceClipId: string | null;
  words?: TimedWord[];
};

type TimedEntry = {
  start?: number;
  end?: number;
  word?: string;
  text?: string;
  speaker?: string;
};

type TimedSegmentEntry = TimedEntry & { words?: unknown };

type TimedWord = {
  start: number;
  end: number;
  word?: string;
  text?: string;
};

type TimedSegment = {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  words?: TimedWord[];
};

type GifDragPayload = {
  url: string;
  title?: string;
  width?: number;
  height?: number;
  size?: number;
};

type ProjectSizeOption = {
  id: string;
  label: string;
  width?: number;
  height?: number;
  aspectRatio?: number | null;
};

type ProjectBackgroundImage = {
  url: string;
  name: string;
  size: number;
  assetId?: string;
};

type EditorProjectState = {
  version: number;
  project: {
    name: string;
    sizeId: string;
    durationMode: "automatic" | "fixed";
    durationSeconds: number;
    backgroundMode: "color" | "image";
    backgroundImage?: ProjectBackgroundImage | null;
    canvasBackground?: string;
    videoBackground?: string;
  };
  snapshot: EditorSnapshot;
};

type ProjectSaveState = "idle" | "saving" | "saved" | "error";

type ExportStatus =
  | "idle"
  | "starting"
  | "queued"
  | "loading"
  | "rendering"
  | "encoding"
  | "uploading"
  | "complete"
  | "error";

type ExportOutput = {
  width: number;
  height: number;
};

type ExportUiState = {
  open: boolean;
  status: ExportStatus;
  stage: string;
  progress: number;
  jobId: string | null;
  downloadUrl: string | null;
  error: string | null;
};

type ExternalAssetPayload = {
  url: string;
  name: string;
  kind: "video" | "audio" | "image";
  source?: "autoclip" | "external" | "upload" | "stock" | "generated";
  size?: number;
  duration?: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
};

const projectSizeOptions: ProjectSizeOption[] = [
  {
    id: "original",
    label: "Original",
    aspectRatio: null,
  },
  {
    id: "9:16",
    label: "Reels / TikTok",
    width: 1080,
    height: 1920,
    aspectRatio: 9 / 16,
  },
  {
    id: "1:1",
    label: "Square",
    width: 1080,
    height: 1080,
    aspectRatio: 1,
  },
  {
    id: "16:9",
    label: "YouTube",
    width: 1920,
    height: 1080,
    aspectRatio: 16 / 9,
  },
  {
    id: "4:5",
    label: "Instagram Portrait",
    width: 1080,
    height: 1350,
    aspectRatio: 4 / 5,
  },
  {
    id: "4:3",
    label: "Classic 4:3",
    width: 1440,
    height: 1080,
    aspectRatio: 4 / 3,
  },
  {
    id: "21:9",
    label: "Cinematic",
    width: 2560,
    height: 1080,
    aspectRatio: 21 / 9,
  },
];

const escapeSubtitleHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });

const buildHighlightedSubtitleHtml = (
  words: Array<{ word?: string; text?: string }>,
  activeIndex: number,
  highlightColor: string
) => {
  const color = highlightColor || "#FDE047";
  return words
    .map((entry, index) => {
      const token = escapeSubtitleHtml(
        String(entry.word ?? entry.text ?? "")
      ).trim();
      if (!token) {
        return "";
      }
      if (index === activeIndex) {
        return `<span style="color: ${color};">${token}</span>`;
      }
      return `<span>${token}</span>`;
    })
    .filter(Boolean)
    .join(" ");
};

const findActiveWordIndex = (
  words: Array<{ start: number; end: number }>,
  time: number,
  epsilon = 0.02
) => {
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    if (time >= word.start - epsilon && time < word.end + epsilon) {
      return i;
    }
  }
  return -1;
};

const buildGifPayload = (gif: IGif): GifDragPayload | null => {
  const assetImage = resolveGiphyAssetImage(gif);
  if (!assetImage) {
    return null;
  }
  return {
    url: assetImage.url,
    width: assetImage.width,
    height: assetImage.height,
    size: assetImage.size,
    title: gif.title?.trim() || "GIF",
  };
};

const subtitleLanguages: SubtitleLanguageOption[] = [
  { code: "en", label: "English", detail: "English (US)", region: "US" },
  { code: "es", label: "Spanish", detail: "Spanish (ES)", region: "ES" },
  { code: "fr", label: "French", detail: "French (FR)", region: "FR" },
  { code: "de", label: "German", detail: "German (DE)", region: "DE" },
  { code: "pt", label: "Portuguese", detail: "Portuguese (BR)", region: "BR" },
];

const mergeAssetsWithLibrary = (
  current: MediaAsset[],
  libraryItems: AssetLibraryItem[]
) => {
  if (!libraryItems.length) {
    return current;
  }
  const merged = new Map<string, MediaAsset>(
    current.map((asset) => [asset.id, asset])
  );
  libraryItems.forEach((item) => {
    const updated: MediaAsset = {
      id: item.id,
      name: item.name,
      kind: item.kind,
      url: item.url,
      size: item.size,
      duration: item.duration,
      width: item.width,
      height: item.height,
      aspectRatio: item.aspectRatio,
      createdAt: item.createdAt,
    };
    const existing = merged.get(item.id);
    merged.set(item.id, existing ? { ...existing, ...updated } : updated);
  });
  return Array.from(merged.values());
};

const ensureEven = (value: number) => {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
};

const consumeDeletedAssetIds = (): string[] => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem("satura:deleted-assets");
    if (!raw) {
      return [];
    }
    window.localStorage.removeItem("satura:deleted-assets");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
};

const DELETED_ASSETS_EVENT = "satura:assets-deleted";

const createExternalAssetSafe = async (
  payload: ExternalAssetPayload
): Promise<AssetLibraryItem | null> => {
  try {
    const mod = (await import("@/lib/assets/library")) as {
      createExternalAsset?: (value: ExternalAssetPayload) => Promise<AssetLibraryItem | null>;
    };
    if (typeof mod.createExternalAsset === "function") {
      return mod.createExternalAsset(payload);
    }
  } catch {
    // Ignore when module export is unavailable.
  }
  return null;
};

function AdvancedEditorContent() {
  const textMinLayerSize = 24;
  const textPresetPreviewCount = 6;
  const gifPreviewCount = 6;
  const gifSearchLimit = 30;
  const gifPreviewIntervalMs = 15000;
  const gifDragType = "application/x-gif-asset";
  const searchParams = useSearchParams();
  const isExportMode = searchParams.get("export") === "1";
  const [activeTool, setActiveTool] = useState("video");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineClip[]>([]);
  const [lanes, setLanes] = useState<TimelineLane[]>([]);
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("All");
  const [isAssetLibraryExpanded, setIsAssetLibraryExpanded] = useState(false);
  const [assetLibraryReady, setAssetLibraryReady] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [isGifLibraryExpanded, setIsGifLibraryExpanded] = useState(false);
  const [isStickerLibraryExpanded, setIsStickerLibraryExpanded] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [gifTrending, setGifTrending] = useState<IGif[]>([]);
  const [gifTrendingStatus, setGifTrendingStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [gifTrendingError, setGifTrendingError] = useState<string | null>(null);
  const [gifMemeResults, setGifMemeResults] = useState<IGif[]>([]);
  const [gifMemeStatus, setGifMemeStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [gifPreviewIndex, setGifPreviewIndex] = useState(0);
  const [gifSearchResults, setGifSearchResults] = useState<IGif[]>([]);
  const [gifSearchStatus, setGifSearchStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [gifSearchError, setGifSearchError] = useState<string | null>(null);
  const [stickerSearch, setStickerSearch] = useState("");
  const [stickerTrending, setStickerTrending] = useState<IGif[]>([]);
  const [stickerTrendingStatus, setStickerTrendingStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [stickerTrendingError, setStickerTrendingError] = useState<
    string | null
  >(null);
  const [stickerSearchResults, setStickerSearchResults] = useState<IGif[]>([]);
  const [stickerSearchStatus, setStickerSearchStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [stickerSearchError, setStickerSearchError] = useState<string | null>(
    null
  );
  const [stockSearch, setStockSearch] = useState("");
  const [stockCategory, setStockCategory] = useState("All");
  const [stockMusic, setStockMusic] = useState<StockAudioTrack[]>([]);
  const [stockMusicStatus, setStockMusicStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [stockMusicError, setStockMusicError] = useState<string | null>(null);
  const [stockMusicReloadKey, setStockMusicReloadKey] = useState(0);
  const [soundFxSearch, setSoundFxSearch] = useState("");
  const [soundFxCategory, setSoundFxCategory] = useState("All");
  const [soundFx, setSoundFx] = useState<StockAudioTrack[]>([]);
  const [soundFxStatus, setSoundFxStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [soundFxError, setSoundFxError] = useState<string | null>(null);
  const [soundFxReloadKey, setSoundFxReloadKey] = useState(0);
  const [showAllSoundFxTags, setShowAllSoundFxTags] = useState(false);
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
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectReady, setProjectReady] = useState(false);
  const [projectSaveState, setProjectSaveState] =
    useState<ProjectSaveState>("idle");
  const [showSaveIndicator, setShowSaveIndicator] = useState(false);
  const [projectStarted, setProjectStarted] = useState(false);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [projectSizeId, setProjectSizeId] = useState("original");
  const [projectDurationMode, setProjectDurationMode] = useState<
    "automatic" | "fixed"
  >("automatic");
  const [projectDurationSeconds, setProjectDurationSeconds] = useState(10);
  const [projectBackgroundMode, setProjectBackgroundMode] = useState<
    "color" | "image"
  >("color");
  const [projectBackgroundImage, setProjectBackgroundImage] =
    useState<ProjectBackgroundImage | null>(null);
  const [exportUi, setExportUi] = useState<ExportUiState>({
    open: false,
    status: "idle",
    stage: "",
    progress: 0,
    jobId: null,
    downloadUrl: null,
    error: null,
  });
  const [exportViewport, setExportViewport] = useState<ExportOutput | null>(
    null
  );
  const [exportAutoDownloaded, setExportAutoDownloaded] = useState(false);
  const exportPollRef = useRef<number | null>(null);
  const resolvedProjectSize = useMemo(
    () =>
      projectSizeOptions.find((option) => option.id === projectSizeId) ??
      projectSizeOptions[0],
    [projectSizeId]
  );
  const projectAspectRatioOverride = resolvedProjectSize?.aspectRatio ?? null;
  const projectBackgroundUrlRef = useRef<string | null>(null);
  const projectNameRef = useRef(projectName);
  const projectNameSavePendingRef = useRef(false);
  const saveStatusTimeoutRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [canvasBackground, setCanvasBackground] = useState("#f2f3fa");
  const [videoBackground, setVideoBackground] = useState("#000000");
  const [isBackgroundSelected, setIsBackgroundSelected] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState(
    defaultTimelineHeight
  );
  const [audioLaneHeight, setAudioLaneHeight] = useState(
    laneHeights.audio
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
  const [audioWaveforms, setAudioWaveforms] = useState<
    Record<string, AudioWaveformData>
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
  const clipSettingsRef = useRef(clipSettings);
  clipSettingsRef.current = clipSettings;
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
  const [subtitleStatus, setSubtitleStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [subtitleError, setSubtitleError] = useState<string | null>(null);
  const [subtitleSegments, setSubtitleSegments] = useState<SubtitleSegment[]>(
    []
  );
  const [subtitleLanguage, setSubtitleLanguage] = useState(
    subtitleLanguages[0]
  );
  const [subtitleSource, setSubtitleSource] = useState<"project" | string>(
    "project"
  );
  const [subtitleActiveTab, setSubtitleActiveTab] = useState<
    "style" | "edit"
  >("style");
  const [subtitleStyleFilter, setSubtitleStyleFilter] = useState("All");
  const defaultSubtitleStyleId =
    subtitleStylePresets.find((preset) => preset.id === "clean-cut")?.id ??
    subtitleStylePresets[0]?.id ??
    null;
  const [subtitleStyleId, setSubtitleStyleId] = useState<string | null>(
    defaultSubtitleStyleId
  );
  const [subtitleStyleOverrides, setSubtitleStyleOverrides] = useState<
    Record<string, { settings?: Partial<TextClipSettings>; preview?: TextStylePreset["preview"] }>
  >({});
  const [detachedSubtitleIds, setDetachedSubtitleIds] = useState<Set<string>>(
    () => new Set()
  );
  const [subtitleMoveTogether, setSubtitleMoveTogether] = useState(true);
  const [, startTransition] = useTransition();
  const textPanelTextAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const stageTextEditorRef = useRef<HTMLTextAreaElement | null>(null);
  const [editingTextClipId, setEditingTextClipId] = useState<string | null>(
    null
  );
  const [timelineResizeState, setTimelineResizeState] = useState<{
    startY: number;
    startHeight: number;
  } | null>(null);
  const [audioLaneResizeState, setAudioLaneResizeState] = useState<{
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
  const assetLibraryBootstrappedRef = useRef(false);
  const lanesRef = useRef<TimelineLane[]>([]);
  const subtitleLaneIdRef = useRef<string | null>(null);
  const subtitleGroupTransformsRef = useRef<Map<string, ClipTransform> | null>(
    null
  );
  const subtitleResizeGroupTransformsRef = useRef<Map<string, ClipTransform> | null>(
    null
  );
  const subtitleResizeFontMapRef = useRef<Map<string, number> | null>(null);
  const subtitleRotateGroupTransformsRef = useRef<Map<string, ClipTransform> | null>(
    null
  );
  const textSettingsRef = useRef<Record<string, TextClipSettings>>({});
  const handleProjectBackgroundImageChange = useCallback(
    async (file: File | null) => {
      if (!file) {
        setProjectBackgroundImage(null);
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      const meta = await getMediaMeta("image", previewUrl);
      URL.revokeObjectURL(previewUrl);
      const stored = await uploadAssetFile(file, {
        name: file.name || "Background image",
        kind: "image",
        source: "upload",
        width: meta.width,
        height: meta.height,
        aspectRatio: meta.aspectRatio,
      });
      if (!stored) {
        return;
      }
      setProjectBackgroundImage({
        url: stored.url,
        name: stored.name,
        size: stored.size,
        assetId: stored.id,
      });
      setAssets((prev) => mergeAssetsWithLibrary(prev, [stored]));
    },
    []
  );
  const handleProjectBackgroundImageClear = useCallback(() => {
    setProjectBackgroundImage(null);
  }, []);
  useEffect(() => {
    const nextUrl = projectBackgroundImage?.url ?? null;
    if (
      projectBackgroundUrlRef.current &&
      projectBackgroundUrlRef.current !== nextUrl &&
      projectBackgroundUrlRef.current.startsWith("blob:")
    ) {
      URL.revokeObjectURL(projectBackgroundUrlRef.current);
    }
    projectBackgroundUrlRef.current = nextUrl;
  }, [projectBackgroundImage?.url]);
  useEffect(() => {
    return () => {
      if (
        projectBackgroundUrlRef.current &&
        projectBackgroundUrlRef.current.startsWith("blob:")
      ) {
        URL.revokeObjectURL(projectBackgroundUrlRef.current);
      }
    };
  }, []);
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
  const audioWaveformsRef = useRef(audioWaveforms);
  const audioWaveformJobRef = useRef(0);
  const audioWaveformLoadingRef = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const scrubPointerIdRef = useRef<number | null>(null);
  const scrubPointerTargetRef = useRef<HTMLElement | null>(null);
  const visualRefs = useRef(new Map<string, HTMLVideoElement | null>());
  const audioRefs = useRef(new Map<string, HTMLAudioElement | null>());
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const stockDurationCacheRef = useRef<Map<string, number | null>>(new Map());
  const stockAudioMetaLoadingRef = useRef<Set<string>>(new Set());
  const stockMusicLoadTimeoutRef = useRef<number | null>(null);
  const stockMusicLoadIdRef = useRef(0);
  const soundFxLoadTimeoutRef = useRef<number | null>(null);
  const soundFxLoadIdRef = useRef(0);
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
  const projectIdRef = useRef<string | null>(null);
  const projectSaveTimeoutRef = useRef<number | null>(null);
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
  const playbackTimeRef = useRef(currentTime);
  const playbackUiTickRef = useRef(0);
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
  const getClipPlaybackRate = useCallback(
    (clipId: string) => {
      const settings = clipSettingsRef.current[clipId] ?? fallbackVideoSettings;
      return clamp(settings.speed, 0.1, 4);
    },
    [fallbackVideoSettings]
  );
  const resolveClipAssetTime = useCallback(
    (clip: TimelineClip, time: number) => {
      const playbackRate = getClipPlaybackRate(clip.id);
      const timelineOffset = time - clip.startTime;
      const assetStart = clip.startOffset;
      const assetEnd = assetStart + clip.duration * playbackRate;
      return clamp(
        assetStart + timelineOffset * playbackRate,
        assetStart,
        assetEnd
      );
    },
    [getClipPlaybackRate]
  );
  const resolveTimelineTimeFromAssetTime = useCallback(
    (clip: TimelineClip, assetTime: number) => {
      const playbackRate = getClipPlaybackRate(clip.id);
      const timelineStart = clip.startTime;
      const timelineEnd = clip.startTime + clip.duration;
      const timelineTime =
        timelineStart + (assetTime - clip.startOffset) / playbackRate;
      return clamp(timelineTime, timelineStart, timelineEnd);
    },
    [getClipPlaybackRate]
  );
  const subtitleBaseSettings = useMemo(() => {
    const base = createDefaultTextSettings();
    return {
      ...base,
      text: "",
      fontFamily: "Inter",
      fontSize: 40,
      lineHeight: 1.2,
      shadowEnabled: true,
      shadowBlur: 10,
      shadowOpacity: 30,
    };
  }, []);
  const resolvedSubtitleStylePresets = useMemo(() => {
    if (!subtitleStyleOverrides || Object.keys(subtitleStyleOverrides).length === 0) {
      return subtitleStylePresets;
    }
    return subtitleStylePresets.map((preset) => {
      const override = subtitleStyleOverrides[preset.id];
      if (!override) {
        return preset;
      }
      return {
        ...preset,
        settings: {
          ...preset.settings,
          ...override.settings,
        },
        preview: {
          ...preset.preview,
          ...override.preview,
        },
      };
    });
  }, [subtitleStyleOverrides]);
  const hasSupabase =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const hasGiphy = Boolean(giphyApiKey);
  const giphyFetch = useMemo(
    () => (hasGiphy ? new GiphyFetch(giphyApiKey) : null),
    [hasGiphy, giphyApiKey]
  );

  useEffect(() => {
    timelineThumbnailsRef.current = timelineThumbnails;
  }, [timelineThumbnails]);

  useEffect(() => {
    audioWaveformsRef.current = audioWaveforms;
  }, [audioWaveforms]);

  const getAudioContext = useCallback(() => {
    if (audioContextRef.current) {
      return audioContextRef.current;
    }
    const AudioContextConstructor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextConstructor) {
      return null;
    }
    audioContextRef.current = new AudioContextConstructor();
    return audioContextRef.current;
  }, []);

  const updateVideoMetaFromElement = useCallback(
    (clipId: string, assetId: string, element: HTMLVideoElement | null) => {
      if (!element) {
        return;
      }
      const width = element.videoWidth;
      const height = element.videoHeight;
      const videoDuration = Number.isFinite(element.duration) ? element.duration : null;
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
        // Check if we need to update duration (only if current duration is missing or fallback)
        const shouldUpdateDuration = videoDuration != null && 
          (current.duration == null || current.duration === 8);
        if (
          current.width === width &&
          current.height === height &&
          current.aspectRatio === aspectRatio &&
          !shouldUpdateDuration
        ) {
          return prev;
        }
        const next = [...prev];
        next[index] = {
          ...current,
          width,
          height,
          aspectRatio,
          ...(shouldUpdateDuration ? { duration: videoDuration } : {}),
        };
        return next;
      });
      // Also update the clip duration if it was based on fallback duration
      if (videoDuration != null) {
        setTimeline((prev) => {
          const clipIndex = prev.findIndex((clip) => clip.id === clipId);
          if (clipIndex < 0) {
            return prev;
          }
          const clip = prev[clipIndex];
          const asset = assetsRef.current.find((a) => a.id === assetId);
          // Only update if current clip duration seems to be using fallback (8 seconds or less)
          // and the video is actually longer
          if (asset?.duration == null || asset.duration <= 8) {
            const newDuration = Math.max(0, videoDuration - clip.startOffset);
            if (Math.abs(clip.duration - newDuration) > 0.1) {
              const next = [...prev];
              next[clipIndex] = {
                ...clip,
                duration: newDuration,
              };
              return next;
            }
          }
          return prev;
        });
      }
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

  // PERFORMANCE: Cache ref callbacks to prevent React from re-registering refs on every render
  // This is critical for blob URL videos which are expensive to re-initialize
  const videoRefCallbacksRef = useRef<Map<string, (node: HTMLVideoElement | null) => void>>(new Map());
  
  const registerVideoRef = useCallback(
    (clipId: string, assetId: string) => {
      // Return cached callback if it exists for this clipId
      const existing = videoRefCallbacksRef.current.get(clipId);
      if (existing) {
        return existing;
      }
      
      // Create and cache new callback
      const callback = (node: HTMLVideoElement | null) => {
        if (node) {
          visualRefs.current.set(clipId, node);
          updateVideoMetaFromElement(clipId, assetId, node);
        } else {
          visualRefs.current.delete(clipId);
          // Clean up cached callback when element unmounts
          videoRefCallbacksRef.current.delete(clipId);
        }
      };
      videoRefCallbacksRef.current.set(clipId, callback);
      return callback;
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
    const snapshotTime = playbackTimeRef.current;
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
      currentTime: snapshotTime,
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

  const pruneAssetsById = useCallback(
    (assetIds: string[]) => {
      const ids = assetIds.filter((id) => typeof id === "string");
      if (!ids.length) {
        return;
      }
      const assetIdSet = new Set(ids);
      const clipIdsForAssets = timeline
        .filter((clip) => assetIdSet.has(clip.assetId))
        .map((clip) => clip.id);
      if (!clipIdsForAssets.length) {
        setAssets((prev) => prev.filter((asset) => !assetIdSet.has(asset.id)));
        if (projectBackgroundImage?.assetId && assetIdSet.has(projectBackgroundImage.assetId)) {
          setProjectBackgroundImage(null);
        }
        return;
      }
      const subtitleClipIdsToRemove = new Set<string>();
      const sourceIdsToRemove = new Set(clipIdsForAssets);
      subtitleSegments.forEach((segment) => {
        if (segment.sourceClipId && sourceIdsToRemove.has(segment.sourceClipId)) {
          subtitleClipIdsToRemove.add(segment.clipId);
        }
        if (sourceIdsToRemove.has(segment.clipId)) {
          subtitleClipIdsToRemove.add(segment.clipId);
        }
      });
      const idsToRemove = new Set([
        ...clipIdsForAssets,
        ...subtitleClipIdsToRemove,
      ]);
      const nextTimeline = timeline.filter((clip) => !idsToRemove.has(clip.id));
      const nextAssets = assetsRef.current.filter(
        (item) => !assetIdSet.has(item.id)
      );
      const selectedIds =
        selectedClipIds.length > 0
          ? selectedClipIds
          : selectedClipId
            ? [selectedClipId]
            : [];
      const remainingSelection = selectedIds.filter(
        (id) => !idsToRemove.has(id)
      );
      const nextSelectedId =
        remainingSelection[0] ?? nextTimeline[0]?.id ?? null;
      const nextSelectedIds =
        remainingSelection.length > 0
          ? remainingSelection
          : nextSelectedId
            ? [nextSelectedId]
            : [];
      const nextActiveAssetId = nextSelectedId
        ? nextTimeline.find((clip) => clip.id === nextSelectedId)?.assetId ??
          null
        : assetIdSet.has(activeAssetId ?? "")
          ? nextAssets[0]?.id ?? null
          : activeAssetId;
      setTimeline(nextTimeline);
      setSelectedClipId(nextSelectedId);
      setSelectedClipIds(nextSelectedIds);
      setActiveAssetId(nextActiveAssetId);
      setSubtitleSegments((prev) =>
        prev.filter((segment) => !subtitleClipIdsToRemove.has(segment.clipId))
      );
      setTextSettings((prev) => {
        const next = { ...prev };
        idsToRemove.forEach((id) => {
          delete next[id];
        });
        return next;
      });
      setClipTransforms((prev) => {
        const next = { ...prev };
        idsToRemove.forEach((id) => {
          delete next[id];
        });
        return next;
      });
      setDetachedSubtitleIds((prev) => {
        if (prev.size === 0) {
          return prev;
        }
        const next = new Set(prev);
        idsToRemove.forEach((id) => next.delete(id));
        return next;
      });
      setAssets(nextAssets);
      if (projectBackgroundImage?.assetId && assetIdSet.has(projectBackgroundImage.assetId)) {
        setProjectBackgroundImage(null);
      }
      historyRef.current.past = [];
      historyRef.current.future = [];
      syncHistoryState();
    },
    [
      activeAssetId,
      projectBackgroundImage?.assetId,
      selectedClipId,
      selectedClipIds,
      subtitleSegments,
      syncHistoryState,
      timeline,
    ]
  );

  const buildProjectState = useCallback<() => EditorProjectState>(
    () => ({
      version: 1,
      project: {
        name: projectName,
        sizeId: projectSizeId,
        durationMode: projectDurationMode,
        durationSeconds: projectDurationSeconds,
        backgroundMode: projectBackgroundMode,
        backgroundImage: projectBackgroundImage ?? null,
        canvasBackground,
        videoBackground,
      },
      snapshot: createSnapshot(),
    }),
    [
      projectName,
      projectSizeId,
      projectDurationMode,
      projectDurationSeconds,
      projectBackgroundMode,
      projectBackgroundImage,
      canvasBackground,
      videoBackground,
      createSnapshot,
    ]
  );

  const applyProjectState = useCallback(
    (payload: EditorProjectState) => {
      const snapshot = payload?.snapshot;
      if (snapshot) {
        applySnapshot(snapshot);
      }
      const project = payload?.project;
      if (project) {
        if (typeof project.name === "string") {
          setProjectName(project.name);
        }
        if (typeof project.sizeId === "string") {
          setProjectSizeId(project.sizeId);
        }
        if (project.durationMode === "automatic" || project.durationMode === "fixed") {
          setProjectDurationMode(project.durationMode);
        }
        if (typeof project.durationSeconds === "number") {
          setProjectDurationSeconds(project.durationSeconds);
        }
        if (project.backgroundMode === "color" || project.backgroundMode === "image") {
          setProjectBackgroundMode(project.backgroundMode);
        }
        if (
          project.backgroundImage &&
          typeof project.backgroundImage.url === "string"
        ) {
          setProjectBackgroundImage(project.backgroundImage);
        } else {
          setProjectBackgroundImage(null);
        }
        if (typeof project.canvasBackground === "string") {
          setCanvasBackground(project.canvasBackground);
        }
        if (typeof project.videoBackground === "string") {
          setVideoBackground(project.videoBackground);
        }
      }
      historyRef.current.past = [];
      historyRef.current.future = [];
      syncHistoryState();
    },
    [applySnapshot, syncHistoryState]
  );

  useEffect(() => {
    if (!isExportMode || typeof window === "undefined") {
      return;
    }
    const payload = (window as any).__EDITOR_EXPORT__;
    if (payload?.output && typeof payload.output === "object") {
      const nextWidth = Number(payload.output.width);
      const nextHeight = Number(payload.output.height);
      if (Number.isFinite(nextWidth) && Number.isFinite(nextHeight)) {
        setExportViewport({
          width: Math.max(2, Math.round(nextWidth)),
          height: Math.max(2, Math.round(nextHeight)),
        });
      }
    }
    if (payload?.state) {
      const sanitizedSnapshot = payload.state.snapshot
        ? {
            ...payload.state.snapshot,
            selectedClipId: null,
            selectedClipIds: [],
            activeCanvasClipId: null,
            activeAssetId: null,
            currentTime: 0,
          }
        : null;
      const sanitizedState = sanitizedSnapshot
        ? {
            ...payload.state,
            snapshot: sanitizedSnapshot,
          }
        : payload.state;
      applyProjectState(sanitizedState as EditorProjectState);
      setProjectReady(true);
      setProjectStarted(true);
      setIsPlaying(false);
      return;
    }
    setProjectReady(true);
  }, [applyProjectState, isExportMode]);

  const handleProjectNameCommit = useCallback((value: string) => {
    if (saveStatusTimeoutRef.current) {
      window.clearTimeout(saveStatusTimeoutRef.current);
      saveStatusTimeoutRef.current = null;
    }
    const nextName = value;
    const nextNormalized = nextName.trim();
    const currentNormalized = projectNameRef.current.trim();
    setProjectName(nextName);
    if (nextNormalized === currentNormalized) {
      return;
    }
    projectNameSavePendingRef.current = true;
    setProjectSaveState("idle");
    setShowSaveIndicator(true);
  }, []);

  const saveProjectState = useCallback(
    async (state: EditorProjectState) => {
      const notifyNameSave = projectNameSavePendingRef.current;
      if (notifyNameSave && saveStatusTimeoutRef.current) {
        window.clearTimeout(saveStatusTimeoutRef.current);
        saveStatusTimeoutRef.current = null;
      }
      if (notifyNameSave) {
        setProjectSaveState("saving");
      }
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        if (notifyNameSave) {
          setProjectSaveState("error");
          saveStatusTimeoutRef.current = window.setTimeout(() => {
            setShowSaveIndicator(false);
          }, 4000);
          projectNameSavePendingRef.current = false;
        }
        return;
      }
      let resolvedId = projectIdRef.current;
      if (!resolvedId) {
        resolvedId = crypto.randomUUID();
        projectIdRef.current = resolvedId;
        setProjectId(resolvedId);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("editor:lastProjectId", resolvedId);
        }
      }
      const title = state.project.name.trim() || "Untitled Project";
      const { error } = await supabase.from("projects").upsert({
        id: resolvedId,
        user_id: user.id,
        title,
        kind: "editor",
        status: "draft",
        project_state: state,
      });
      if (error) {
        if (notifyNameSave) {
          setProjectSaveState("error");
          saveStatusTimeoutRef.current = window.setTimeout(() => {
            setShowSaveIndicator(false);
          }, 4000);
          projectNameSavePendingRef.current = false;
        }
        return;
      }
      const assetIds = state.snapshot.assets
        .filter((asset) => asset.kind !== "text")
        .map((asset) => asset.id)
        .filter((assetId): assetId is string => typeof assetId === "string");
      if (assetIds.length) {
        const payload = assetIds.map((assetId) => ({
          project_id: resolvedId,
          asset_id: assetId,
          role: "source",
        }));
        await supabase
          .from("project_assets")
          .upsert(payload, { onConflict: "project_id,asset_id" });
      }
      if (notifyNameSave) {
        setProjectSaveState("saved");
        saveStatusTimeoutRef.current = window.setTimeout(() => {
          setShowSaveIndicator(false);
        }, 2000);
        projectNameSavePendingRef.current = false;
      }
    },
    []
  );

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
    projectNameRef.current = projectName;
  }, [projectName]);

  useEffect(() => {
    if (isExportMode) {
      setAssetLibraryReady(true);
      return;
    }
    if (assetLibraryBootstrappedRef.current) {
      return;
    }
    assetLibraryBootstrappedRef.current = true;
    let cancelled = false;
    const loadLibrary = async () => {
      const storedAssets = await loadAssetLibrary();
      if (cancelled) {
        return;
      }
      if (storedAssets.length) {
        setAssets((prev) => mergeAssetsWithLibrary(prev, storedAssets));
      }
      setAssetLibraryReady(true);
    };
    loadLibrary().catch(() => {
      if (!cancelled) {
        setAssetLibraryReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isExportMode]);

  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  useEffect(() => {
    if (isExportMode) {
      setProjectReady(true);
      return;
    }
    let cancelled = false;
    const loadProject = async () => {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        if (!cancelled) {
          setProjectReady(true);
        }
        return;
      }
      const queryProjectId = searchParams.get("projectId");
      const fetchProjectById = async (id: string) => {
        const { data } = await supabase
          .from("projects")
          .select("id,title,project_state,kind")
          .eq("id", id)
          .eq("kind", "editor")
          .limit(1);
        return data?.[0] ?? null;
      };

      if (!queryProjectId) {
        if (!cancelled) {
          setProjectReady(true);
        }
        return;
      }

      const project = await fetchProjectById(queryProjectId);

      if (!cancelled && project?.project_state) {
        applyProjectState(project.project_state as EditorProjectState);
        const libraryItems = await loadAssetLibrary();
        if (!cancelled && libraryItems.length) {
          setAssets((prev) => mergeAssetsWithLibrary(prev, libraryItems));
        }
        setProjectId(project.id);
        if (
          typeof project.title === "string" &&
          !project.project_state?.project?.name
        ) {
          setProjectName(project.title);
        }
      }

      if (!cancelled) {
        setProjectReady(true);
      }
    };

    loadProject().catch(() => {
      if (!cancelled) {
        setProjectReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [applyProjectState, isExportMode, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleDeletedAssets = () => {
      const deletedIds = consumeDeletedAssetIds();
      if (deletedIds.length) {
        pruneAssetsById(deletedIds);
      }
    };
    handleDeletedAssets();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "satura:deleted-assets") {
        handleDeletedAssets();
      }
    };
    const handleImmediateDelete = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!Array.isArray(detail)) {
        return;
      }
      const ids = detail.filter((id): id is string => typeof id === "string");
      if (ids.length) {
        pruneAssetsById(ids);
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(DELETED_ASSETS_EVENT, handleImmediateDelete);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(DELETED_ASSETS_EVENT, handleImmediateDelete);
    };
  }, [pruneAssetsById]);

  useEffect(() => {
    if (!projectStarted && timeline.length > 0) {
      setProjectStarted(true);
    }
  }, [projectStarted, timeline.length]);

  useEffect(() => {
    if (!projectStarted && projectId) {
      setProjectStarted(true);
    }
  }, [projectId, projectStarted]);

  useEffect(() => {
    if (isExportMode) {
      return;
    }
    if (!projectReady || !projectStarted) {
      return;
    }
    if (projectSaveTimeoutRef.current) {
      window.clearTimeout(projectSaveTimeoutRef.current);
    }
    projectSaveTimeoutRef.current = window.setTimeout(() => {
      const state = buildProjectState();
      saveProjectState(state).catch(() => {});
    }, 1500);
    return () => {
      if (projectSaveTimeoutRef.current) {
        window.clearTimeout(projectSaveTimeoutRef.current);
      }
    };
  }, [buildProjectState, isExportMode, projectReady, projectStarted, saveProjectState]);

  useEffect(() => {
    return () => {
      if (saveStatusTimeoutRef.current) {
        window.clearTimeout(saveStatusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!projectBackgroundImage?.assetId) {
      return;
    }
    const match = assetsRef.current.find(
      (asset) => asset.id === projectBackgroundImage.assetId
    );
    if (!match) {
      return;
    }
    if (match.url === projectBackgroundImage.url) {
      return;
    }
    setProjectBackgroundImage({
      url: match.url,
      name: match.name,
      size: match.size,
      assetId: match.id,
    });
  }, [projectBackgroundImage?.assetId, projectBackgroundImage?.url, assets]);

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
    if (activeTool !== "audio" || !hasSupabase) {
      return;
    }
    let cancelled = false;
    const loadId = soundFxLoadIdRef.current + 1;
    soundFxLoadIdRef.current = loadId;
    const loadSoundFx = async () => {
      setSoundFxStatus("loading");
      setSoundFxError(null);
      if (soundFxLoadTimeoutRef.current) {
        window.clearTimeout(soundFxLoadTimeoutRef.current);
      }
      soundFxLoadTimeoutRef.current = window.setTimeout(() => {
        setSoundFxStatus((current) =>
          current === "loading" ? "error" : current
        );
        setSoundFxError(
          "Sound effects request timed out. Check storage list access."
        );
      }, 15000);
      try {
        const { supabaseBrowser } = await import("@/lib/supabase/browser");
        const bucket = supabaseBrowser.storage.from(soundFxBucketName);
        console.log("[sound-fx] bucket", {
          bucket: soundFxBucketName,
          root: soundFxRootPrefix || "(root)",
        });
        const listWithTimeout = async (path: string) => {
          let timeoutId: number | null = null;
          const timeoutPromise = new Promise<{
            data: null;
            error: Error;
          }>((_, reject) => {
            timeoutId = window.setTimeout(() => {
              reject(new Error("Sound effects request timed out."));
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
            console.error("[sound-fx] list error", path, result.error);
          } else {
            console.log("[sound-fx] list ok", path, {
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
          console.log("[sound-fx] collect", path || "(root)");
          const { data, error } = await listWithTimeout(path);
          if (error) {
            throw error;
          }
          const entries = data ?? [];
          const files = entries.filter(isFileEntry);
          console.log("[sound-fx] entries", path || "(root)", {
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
              "[sound-fx] folders",
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
        await collectTracks(soundFxRootPrefix);
        if (cancelled || loadId !== soundFxLoadIdRef.current) {
          return;
        }
        tracks.sort((a, b) => a.name.localeCompare(b.name));
        console.log("[sound-fx] tracks", tracks.length);
        setSoundFx(tracks);
        setSoundFxStatus("ready");
      } catch (error) {
        if (cancelled || loadId !== soundFxLoadIdRef.current) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load sound effects from Supabase.";
        console.error("[sound-fx] load failed", error);
        setSoundFxError(message);
        setSoundFxStatus("error");
      } finally {
        if (soundFxLoadTimeoutRef.current) {
          window.clearTimeout(soundFxLoadTimeoutRef.current);
          soundFxLoadTimeoutRef.current = null;
        }
      }
    };
    loadSoundFx();
    return () => {
      if (soundFxLoadTimeoutRef.current) {
        window.clearTimeout(soundFxLoadTimeoutRef.current);
        soundFxLoadTimeoutRef.current = null;
      }
      cancelled = true;
    };
  }, [activeTool, hasSupabase, soundFxReloadKey]);

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
      }, 30000);
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
            }, 20000);
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
            const posterPath = resolveStockVideoPosterPath(path);
            const posterUrl = posterPath
              ? bucket.getPublicUrl(posterPath).data.publicUrl
              : null;
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
              thumbnailUrl: posterUrl ?? null,
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
    if (activeTool !== "image") {
      setIsGifLibraryExpanded(false);
    }
    if (activeTool !== "elements") {
      setIsStickerLibraryExpanded(false);
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
      setIsGifLibraryExpanded(false);
    }
  }, [isStockVideoExpanded]);

  useEffect(() => {
    if (isGifLibraryExpanded) {
      setIsAssetLibraryExpanded(false);
      setIsStockVideoExpanded(false);
    }
  }, [isGifLibraryExpanded]);

  useEffect(() => {
    if (isStickerLibraryExpanded) {
      setIsAssetLibraryExpanded(false);
      setIsStockVideoExpanded(false);
      setIsGifLibraryExpanded(false);
    }
  }, [isStickerLibraryExpanded]);

  useEffect(() => {
    if (activeTool !== "image" || !giphyFetch || !hasGiphy) {
      return;
    }
    if (gifTrendingStatus !== "idle" || gifTrending.length > 0) {
      return;
    }
    setGifTrendingStatus("loading");
    setGifTrendingError(null);
    giphyFetch
      .trending({ limit: Math.max(gifPreviewCount, gifSearchLimit) })
      .then((result) => {
        const data = result.data ?? [];
        setGifTrending(data);
        setGifTrendingStatus("ready");
      })
      .catch((error) => {
        console.error("[giphy] trending error", error);
        setGifTrendingError("Unable to load GIFs.");
        setGifTrendingStatus("error");
      });
  }, [
    activeTool,
    gifPreviewCount,
    gifSearchLimit,
    gifTrending.length,
    gifTrendingStatus,
    giphyFetch,
    hasGiphy,
  ]);

  useEffect(() => {
    if (activeTool !== "image" || !giphyFetch || !hasGiphy) {
      return;
    }
    if (gifMemeStatus !== "idle" || gifMemeResults.length > 0) {
      return;
    }
    setGifMemeStatus("loading");
    giphyFetch
      .search("meme", { limit: Math.max(gifPreviewCount * 4, 24) })
      .then((result) => {
        const data = result.data ?? [];
        setGifMemeResults(data);
        setGifMemeStatus("ready");
      })
      .catch((error) => {
        console.error("[giphy] meme search error", error);
        setGifMemeStatus("error");
      });
  }, [
    activeTool,
    gifMemeResults.length,
    gifMemeStatus,
    gifPreviewCount,
    giphyFetch,
    hasGiphy,
  ]);

  useEffect(() => {
    if (activeTool !== "image" || !giphyFetch || !hasGiphy) {
      return;
    }
    const query = gifSearch.trim();
    if (!query) {
      setGifSearchResults([]);
      setGifSearchStatus("idle");
      setGifSearchError(null);
      return;
    }
    let cancelled = false;
    setGifSearchStatus("loading");
    setGifSearchError(null);
    const timeoutId = window.setTimeout(() => {
      giphyFetch
        .search(query, { limit: gifSearchLimit })
        .then((result) => {
          if (cancelled) {
            return;
          }
          const data = result.data ?? [];
          setGifSearchResults(data);
          setGifSearchStatus("ready");
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }
          console.error("[giphy] search error", error);
          setGifSearchError("Unable to search GIFs.");
          setGifSearchStatus("error");
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeTool, gifSearch, gifSearchLimit, giphyFetch, hasGiphy]);

  useEffect(() => {
    if (activeTool !== "elements" || !giphyFetch || !hasGiphy) {
      return;
    }
    if (stickerTrendingStatus !== "idle" || stickerTrending.length > 0) {
      return;
    }
    setStickerTrendingStatus("loading");
    setStickerTrendingError(null);
    giphyFetch
      .trending({
        limit: Math.max(gifPreviewCount, gifSearchLimit),
        type: "stickers",
      })
      .then((result) => {
        const data = result.data ?? [];
        setStickerTrending(data);
        setStickerTrendingStatus("ready");
      })
      .catch((error) => {
        console.error("[giphy] sticker trending error", error);
        setStickerTrendingError("Unable to load stickers.");
        setStickerTrendingStatus("error");
      });
  }, [
    activeTool,
    gifPreviewCount,
    gifSearchLimit,
    giphyFetch,
    hasGiphy,
    stickerTrending.length,
    stickerTrendingStatus,
  ]);

  useEffect(() => {
    if (activeTool !== "elements" || !giphyFetch || !hasGiphy) {
      return;
    }
    const query = stickerSearch.trim();
    if (!query) {
      setStickerSearchResults([]);
      setStickerSearchStatus("idle");
      setStickerSearchError(null);
      return;
    }
    let cancelled = false;
    setStickerSearchStatus("loading");
    setStickerSearchError(null);
    const timeoutId = window.setTimeout(() => {
      giphyFetch
        .search(query, { limit: gifSearchLimit, type: "stickers" })
        .then((result) => {
          if (cancelled) {
            return;
          }
          const data = result.data ?? [];
          setStickerSearchResults(data);
          setStickerSearchStatus("ready");
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }
          console.error("[giphy] sticker search error", error);
          setStickerSearchError("Unable to search stickers.");
          setStickerSearchStatus("error");
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeTool, stickerSearch, gifSearchLimit, giphyFetch, hasGiphy]);

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

  const resolveSnappedStartTime = (startTime: number) => {
    const safeStart = Number.isFinite(startTime) ? startTime : 0;
    const clampedStart = Math.max(0, safeStart);
    if (clampedStart < snapInterval) {
      return 0;
    }
    return Math.round(clampedStart / snapInterval) * snapInterval;
  };

  const addTextClip = useCallback(
    (settings: TextClipSettings, label: string, startTime?: number) => {
      const fallbackTime = playbackTimeRef.current;
      setIsBackgroundSelected(false);
      pushHistory();
      const asset = createTextAsset(label);
      const nextLanes = [...lanesRef.current];
      const laneId = createLaneId("text", nextLanes);
      const resolvedStart = resolveSnappedStartTime(
        startTime ?? fallbackTime
      );
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
    [pushHistory]
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
    // Lane order: text on top, video in the middle, audio on bottom.
    if (type === "text") {
      const firstNonTextIndex = draft.findIndex((item) => item.type !== "text");
      if (firstNonTextIndex === -1) {
        draft.push(lane);
      } else {
        draft.splice(firstNonTextIndex, 0, lane);
      }
    } else if (type === "video") {
      const firstAudioIndex = draft.findIndex((item) => item.type === "audio");
      if (firstAudioIndex === -1) {
        draft.push(lane);
      } else {
        draft.splice(firstAudioIndex, 0, lane);
      }
    } else {
      draft.push(lane);
    }
    return lane.id;
  };

  const sortLanesByType = useCallback((items: TimelineLane[]) => {
    const priority: Record<LaneType, number> = {
      text: 0,
      video: 1,
      audio: 2,
    };
    return items
      .map((lane, index) => ({ lane, index }))
      .sort((a, b) => {
        const delta = priority[a.lane.type] - priority[b.lane.type];
        if (delta !== 0) {
          return delta;
        }
        return a.index - b.index;
      })
      .map((entry) => entry.lane);
  }, []);

  useEffect(() => {
    if (lanes.length < 2) {
      return;
    }
    const sorted = sortLanesByType(lanes);
    const isSameOrder = sorted.every((lane, index) => lane.id === lanes[index]?.id);
    if (!isSameOrder) {
      setLanes(sorted);
    }
  }, [lanes, sortLanesByType]);

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

  const gifPreviewPool = useMemo(
    () => (gifMemeResults.length > 0 ? gifMemeResults : gifTrending),
    [gifMemeResults, gifTrending]
  );

  const gifPreviewItems = useMemo(() => {
    const pool = gifPreviewPool;
    if (pool.length <= gifPreviewCount) {
      return pool;
    }
    const start = gifPreviewIndex % pool.length;
    return Array.from({ length: gifPreviewCount }, (_, index) =>
      pool[(start + index) % pool.length]
    );
  }, [gifPreviewCount, gifPreviewIndex, gifPreviewPool]);

  const stickerPreviewItems = useMemo(
    () => stickerTrending.slice(0, gifPreviewCount),
    [gifPreviewCount, stickerTrending]
  );

  const stickerGridItems = useMemo(() => {
    const query = stickerSearch.trim();
    return query ? stickerSearchResults : stickerTrending;
  }, [stickerSearch, stickerSearchResults, stickerTrending]);

  const stickerGridStatus =
    stickerSearch.trim().length > 0
      ? stickerSearchStatus
      : stickerTrendingStatus;
  const stickerGridError =
    stickerSearch.trim().length > 0
      ? stickerSearchError
      : stickerTrendingError;

  const gifGridItems = useMemo(() => {
    const query = gifSearch.trim();
    return query ? gifSearchResults : gifTrending;
  }, [gifSearch, gifSearchResults, gifTrending]);

  const gifGridStatus =
    gifSearch.trim().length > 0 ? gifSearchStatus : gifTrendingStatus;
  const gifGridError =
    gifSearch.trim().length > 0 ? gifSearchError : gifTrendingError;

  useEffect(() => {
    setGifPreviewIndex(0);
  }, [gifPreviewPool.length]);

  useEffect(() => {
    if (!hasGiphy || activeTool !== "image" || isGifLibraryExpanded) {
      return;
    }
    const poolLength = gifPreviewPool.length;
    if (poolLength <= 1) {
      return;
    }
    const intervalId = window.setInterval(() => {
      setGifPreviewIndex(
        (prev) => (prev + gifPreviewCount) % poolLength
      );
    }, gifPreviewIntervalMs);
    return () => window.clearInterval(intervalId);
  }, [
    activeTool,
    gifPreviewIntervalMs,
    gifPreviewPool.length,
    hasGiphy,
    isGifLibraryExpanded,
  ]);

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

  const soundFxCategories = useMemo(() => {
    const categories = Array.from(
      new Set(soundFx.map((track) => track.category))
    ).sort((a, b) => a.localeCompare(b));
    return ["All", ...categories];
  }, [soundFx]);

  const filteredSoundFx = useMemo(() => {
    const query = soundFxSearch.trim().toLowerCase();
    return soundFx.filter((track) => {
      const matchesCategory =
        soundFxCategory === "All" || track.category === soundFxCategory;
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
  }, [soundFxCategory, soundFx, soundFxSearch]);

  const groupedSoundFx = useMemo(() => {
    const groupMap = new Map<string, StockAudioTrack[]>();
    filteredSoundFx.forEach((track) => {
      if (!groupMap.has(track.category)) {
        groupMap.set(track.category, []);
      }
      groupMap.get(track.category)?.push(track);
    });
    const order =
      soundFxCategory === "All"
        ? soundFxCategories.slice(1)
        : [soundFxCategory];
    return order
      .filter((category) => groupMap.has(category))
      .map((category) => ({
        category,
        tracks: groupMap.get(category) ?? [],
      }));
  }, [filteredSoundFx, soundFxCategories, soundFxCategory]);

  const soundFxTagCandidates = soundFxCategories.slice(1);
  const maxSoundFxTagCount = 4;
  const visibleSoundFxTags = showAllSoundFxTags
    ? soundFxTagCandidates
    : soundFxTagCandidates.slice(0, maxSoundFxTagCount);
  const hasMoreSoundFxTags = soundFxTagCandidates.length > maxSoundFxTagCount;

  useEffect(() => {
    if (
      soundFxCategory !== "All" &&
      !soundFxCategories.includes(soundFxCategory)
    ) {
      setSoundFxCategory("All");
    }
  }, [soundFxCategories, soundFxCategory]);

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

  const subtitleClipIdSet = useMemo(() => {
    return new Set(subtitleSegments.map((segment) => segment.clipId));
  }, [subtitleSegments]);
  const subtitleSourceClipMap = useMemo(() => {
    const map = new Map<string, string[]>();
    subtitleSegments.forEach((segment) => {
      if (!segment.sourceClipId) {
        return;
      }
      const existing = map.get(segment.sourceClipId);
      if (existing) {
        existing.push(segment.clipId);
      } else {
        map.set(segment.sourceClipId, [segment.clipId]);
      }
    });
    return map;
  }, [subtitleSegments]);

  const visualTimelineEntries = useMemo(() => {
    return timelineLayout.filter((entry) => entry.asset.kind !== "audio");
  }, [timelineLayout]);

  const visualEntries = useMemo(() => {
    if (subtitleClipIdSet.size === 0) {
      return visualTimelineEntries;
    }
    return visualTimelineEntries.filter(
      (entry) => !subtitleClipIdSet.has(entry.clip.id)
    );
  }, [visualTimelineEntries, subtitleClipIdSet]);

  const audioEntries = useMemo(() => {
    return timelineLayout.filter((entry) => entry.asset.kind === "audio");
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

  useEffect(() => {
    const audioEntries = timelineLayout.filter(
      (entry) => entry.asset.kind === "audio"
    );
    const validIds = new Set(audioEntries.map((entry) => entry.asset.id));
    setAudioWaveforms((prev) => {
      let changed = false;
      const next: Record<string, AudioWaveformData> = {};
      Object.entries(prev).forEach(([id, value]) => {
        if (validIds.has(id)) {
          next[id] = value;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    if (audioEntries.length === 0) {
      return;
    }
    let cancelled = false;
    const jobId = (audioWaveformJobRef.current += 1);
    const buildWaveforms = async () => {
      for (const entry of audioEntries) {
        if (cancelled || audioWaveformJobRef.current !== jobId) {
          return;
        }
        const asset = entry.asset;
        const key = `${asset.url}:${asset.duration ?? "0"}`;
        const existing = audioWaveformsRef.current[asset.id];
        if (existing && existing.key === key) {
          continue;
        }
        if (audioWaveformLoadingRef.current.has(asset.id)) {
          continue;
        }
        audioWaveformLoadingRef.current.add(asset.id);
        try {
          await waitForIdle();
          const response = await fetch(asset.url);
          if (!response.ok) {
            throw new Error("Failed to load audio.");
          }
          const buffer = await response.arrayBuffer();
          const audioContext = getAudioContext();
          if (!audioContext) {
            throw new Error("Audio context unavailable.");
          }
          await waitForIdle();
          const audioBuffer = await audioContext.decodeAudioData(buffer);
          const peakCount = getWaveformPeakCount(audioBuffer.duration);
          await waitForIdle();
          const peaks = await buildAudioPeaksAsync(
            audioBuffer,
            peakCount,
            () => cancelled || audioWaveformJobRef.current !== jobId
          );
          if (cancelled || audioWaveformJobRef.current !== jobId) {
            return;
          }
          setAudioWaveforms((prev) => ({
            ...prev,
            [asset.id]: {
              key,
              peaks,
              duration: audioBuffer.duration,
              status: "ready",
            },
          }));
        } catch (error) {
          if (cancelled || audioWaveformJobRef.current !== jobId) {
            return;
          }
          setAudioWaveforms((prev) => ({
            ...prev,
            [asset.id]: {
              key,
              peaks: [],
              duration: asset.duration ?? 0,
              status: "error",
            },
          }));
        } finally {
          audioWaveformLoadingRef.current.delete(asset.id);
        }
      }
    };
    void buildWaveforms();
    return () => {
      cancelled = true;
    };
  }, [getAudioContext, timelineLayout]);

  const getAudioClipWaveformBars = useCallback(
    (clip: TimelineClip, asset: MediaAsset, width: number) => {
      const barCount = getWaveformBarCount(width);
      const cached = audioWaveforms[asset.id];
      if (!cached || cached.status !== "ready" || cached.peaks.length === 0) {
        return getWaveformBars(clip.id, barCount);
      }
      const duration =
        cached.duration > 0
          ? cached.duration
          : getAssetDurationSeconds(asset);
      if (!duration || duration <= 0) {
        return getWaveformBars(clip.id, barCount);
      }
      const startRatio = clamp(clip.startOffset / duration, 0, 1);
      const endRatio = clamp(
        (clip.startOffset + clip.duration) / duration,
        0,
        1
      );
      const startIndex = Math.floor(startRatio * cached.peaks.length);
      const endIndex = Math.max(
        startIndex + 1,
        Math.ceil(endRatio * cached.peaks.length)
      );
      if (startIndex >= cached.peaks.length) {
        return getWaveformBars(clip.id, barCount);
      }
      const boundedEndIndex = Math.min(
        endIndex,
        cached.peaks.length
      );
      const span = boundedEndIndex - startIndex;
      if (span <= 0) {
        return getWaveformBars(clip.id, barCount);
      }
      const bars = new Array(barCount);
      for (let i = 0; i < barCount; i += 1) {
        const sliceStart =
          startIndex + Math.floor((span * i) / barCount);
        const sliceEnd =
          startIndex +
          Math.floor((span * (i + 1)) / barCount);
        const safeEnd = Math.min(
          boundedEndIndex,
          Math.max(sliceStart + 1, sliceEnd)
        );
        let max = 0;
        for (let j = sliceStart; j < safeEnd; j += 1) {
          const value = cached.peaks[j] ?? 0;
          if (value > max) {
            max = value;
          }
        }
        const normalized = normalizeWaveformPeak(max);
        bars[i] = Math.max(audioWaveformMinBarHeight, normalized);
      }
      return bars;
    },
    [audioWaveforms]
  );

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
      const entries =
        kind === "audio"
          ? audioEntries
          : isPlaying
            ? visualEntries
            : visualTimelineEntries;
      const candidates = entries.filter(
        (entry) =>
          time >= entry.left && time < entry.left + entry.clip.duration
      );
      const pickTop = (items: TimelineLayoutEntry[]) =>
        items.reduce((top, entry) => {
          const entryIndex = laneIndexMap.get(entry.clip.laneId) ?? 0;
          const topIndex = laneIndexMap.get(top.clip.laneId) ?? 0;
          if (entryIndex !== topIndex) {
            return entryIndex < topIndex ? entry : top;
          }
          const entryOrder = clipOrder[entry.clip.id] ?? 0;
          const topOrder = clipOrder[top.clip.id] ?? 0;
          return entryOrder >= topOrder ? entry : top;
        });
      if (candidates.length > 0) {
        return pickTop(candidates);
      }
      let nearest: TimelineLayoutEntry | null = null;
      let bestDistance = timelineClipEpsilon + 1;
      entries.forEach((entry) => {
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
    [
      audioEntries,
      clipOrder,
      isPlaying,
      laneIndexMap,
      visualEntries,
      visualTimelineEntries,
    ]
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
  const selectedSubtitleEntry = useMemo(() => {
    if (!selectedEntry || !subtitleClipIdSet.has(selectedEntry.clip.id)) {
      return null;
    }
    return selectedEntry;
  }, [selectedEntry, subtitleClipIdSet]);
  const subtitleSelectionVisible = useMemo(() => {
    if (!selectedSubtitleEntry) {
      return false;
    }
    const start = selectedSubtitleEntry.clip.startTime;
    const end = start + selectedSubtitleEntry.clip.duration;
    return (
      currentTime + timelineClipEpsilon >= start &&
      currentTime - timelineClipEpsilon <= end
    );
  }, [currentTime, selectedSubtitleEntry, timelineClipEpsilon]);
  const selectedSubtitleTransform = useMemo(() => {
    if (!selectedSubtitleEntry) {
      return null;
    }
    const aspectRatio = stageAspectRatioRef.current || 16 / 9;
    return (
      clipTransforms[selectedSubtitleEntry.clip.id] ??
      createSubtitleTransform(aspectRatio)
    );
  }, [clipTransforms, selectedSubtitleEntry]);
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
  const showUploadingState = showEmptyState && uploading;
  const showVideoPanel =
    activeTool === "video" &&
    Boolean(selectedVideoEntry && selectedVideoSettings);
  const showAudioPanel =
    activeTool !== "settings" &&
    Boolean(selectedAudioEntry && selectedAudioSettings);
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

  useEffect(() => {
    setDetachedSubtitleIds((prev) => {
      if (subtitleSegments.length === 0) {
        return prev.size === 0 ? prev : new Set();
      }
      const validIds = new Set(subtitleSegments.map((segment) => segment.clipId));
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      if (!changed && next.size === prev.size) {
        return prev;
      }
      return next;
    });
  }, [subtitleSegments]);

  // Build a sorted list of subtitle clips with their actual timeline positions
  // This uses the clip's real startTime/duration from the timeline, not cached segment times
  const sortedSubtitleClips = useMemo(() => {
    if (subtitleSegments.length === 0) {
      return [];
    }
    const clipMap = new Map(timeline.map((clip) => [clip.id, clip]));
    return subtitleSegments
      .map((segment) => {
        const clip = clipMap.get(segment.clipId);
        if (!clip) return null;
        return {
          segment,
          clip,
          startTime: clip.startTime,
          endTime: clip.startTime + clip.duration,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => a.startTime - b.startTime);
  }, [subtitleSegments, timeline]);

  // Subtitle segments with times synced to actual clip positions
  // This is used for display in the sidebar to show accurate timestamps
  const subtitleSegmentsWithClipTimes = useMemo(() => {
    if (subtitleSegments.length === 0) {
      return subtitleSegments;
    }
    const clipMap = new Map(timeline.map((clip) => [clip.id, clip]));
    return subtitleSegments.map((segment) => {
      const clip = clipMap.get(segment.clipId);
      if (!clip) return segment;
      return {
        ...segment,
        clip,
        startTime: clip.startTime,
        endTime: clip.startTime + clip.duration,
      };
    });
  }, [subtitleSegments, timeline]);

  // Direct DOM manipulation for subtitle rendering - bypasses React entirely during playback
  // This is how professional video players render subtitles for smooth performance
  const activeSubtitleIndexRef = useRef<number>(-1);
  const lastRenderedSubtitleIdRef = useRef<string | null>(null);
  const activeSubtitleWordIndexRef = useRef<number>(-1);
  const subtitleOverlayRef = useRef<HTMLDivElement>(null);
  const subtitleTextRef = useRef<HTMLSpanElement>(null);

  // Helper to compute visible clips - used by both stable and live visual stacks
  const computeVisibleClips = useCallback((entries: typeof visualEntries, time: number) => {
    const visible = entries.filter(
      (entry) =>
        time + timelineClipEpsilon >= entry.left &&
        time - timelineClipEpsilon <= entry.left + entry.clip.duration
    );
    return visible.sort((a, b) => {
      const aIndex = laneIndexMap.get(a.clip.laneId) ?? 0;
      const bIndex = laneIndexMap.get(b.clip.laneId) ?? 0;
      if (aIndex !== bIndex) {
        return bIndex - aIndex;
      }
      const aOrder = clipOrder[a.clip.id] ?? 0;
      const bOrder = clipOrder[b.clip.id] ?? 0;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      return a.left - b.left;
    });
  }, [laneIndexMap, clipOrder]);

  // PERFORMANCE OPTIMIZATION: During playback, we use a "stable" visual stack
  // that only updates when clips actually change visibility (enter/exit)
  // This prevents React from re-rendering the entire canvas at 60fps
  const stableVisualStackRef = useRef<typeof visualEntries>([]);
  const stableVisualStackIdsRef = useRef<string>('');
  
  const visualStack = useMemo(() => {
    const visible = computeVisibleClips(visualEntries, currentTime);
    
    // During playback, only update if the SET of visible clips changed
    // This prevents re-renders when clips are just playing, not changing visibility
    const newIds = visible.map(e => e.clip.id).join(',');
    if (isPlaying && stableVisualStackIdsRef.current === newIds && stableVisualStackRef.current.length > 0) {
      return stableVisualStackRef.current;
    }
    
    // Cache for next comparison
    stableVisualStackRef.current = visible;
    stableVisualStackIdsRef.current = newIds;
    return visible;
  }, [visualEntries, currentTime, computeVisibleClips, isPlaying]);


  // Same optimization for audio stack
  const stableAudioStackRef = useRef<typeof audioEntries>([]);
  const stableAudioStackIdsRef = useRef<string>('');

  const audioStack = useMemo(() => {
    const visible = audioEntries.filter(
      (entry) =>
        currentTime + timelineClipEpsilon >= entry.left &&
        currentTime - timelineClipEpsilon <= entry.left + entry.clip.duration
    );
    const sorted = visible.sort((a, b) => {
      const aIndex = laneIndexMap.get(a.clip.laneId) ?? 0;
      const bIndex = laneIndexMap.get(b.clip.laneId) ?? 0;
      if (aIndex === bIndex) {
        return a.left - b.left;
      }
      return aIndex - bIndex;
    });
    
    // During playback, only update if the SET of visible clips changed
    const newIds = sorted
      .map(
        (entry) =>
          `${entry.clip.id}:${entry.clip.startTime}:${entry.clip.duration}:${entry.clip.startOffset ?? 0}`
      )
      .join(",");
    if (isPlaying && stableAudioStackIdsRef.current === newIds && stableAudioStackRef.current.length > 0) {
      return stableAudioStackRef.current;
    }
    
    stableAudioStackRef.current = sorted;
    stableAudioStackIdsRef.current = newIds;
    return sorted;
  }, [audioEntries, currentTime, laneIndexMap, isPlaying]);

  const timelineLayoutMap = useMemo(() => {
    return new Map(timelineLayout.map((entry) => [entry.clip.id, entry]));
  }, [timelineLayout]);

  // Cache for pre-computed subtitle styles - avoids recomputing on every frame
  const subtitleStyleCacheRef = useRef<Map<string, { 
    text: string; 
    styles: ReturnType<typeof getTextRenderStyles>;
    transform: ClipTransform;
    wordHighlightEnabled: boolean;
    wordHighlightColor: string;
  }>>(new Map());
  
  // Pre-compute styles for all subtitles when they change
  useEffect(() => {
    const cache = new Map<
      string,
      {
        text: string;
        styles: ReturnType<typeof getTextRenderStyles>;
        transform: ClipTransform;
        wordHighlightEnabled: boolean;
        wordHighlightColor: string;
      }
    >();
    const aspectRatio = stageAspectRatioRef.current || 16 / 9;
    
    subtitleSegments.forEach(segment => {
      const settings = textSettings[segment.clipId] ?? fallbackTextSettings;
      const transform = clipTransforms[segment.clipId] ?? createSubtitleTransform(aspectRatio);
      cache.set(segment.clipId, {
        text: settings.text ?? segment.text,
        styles: getTextRenderStyles(settings),
        transform,
        wordHighlightEnabled: Boolean(settings.wordHighlightEnabled),
        wordHighlightColor: settings.wordHighlightColor ?? "#FDE047",
      });
    });
    
    subtitleStyleCacheRef.current = cache;
    
    // Reset tracking refs when subtitle data changes to avoid stale matches
    activeSubtitleIndexRef.current = -1;
    lastRenderedSubtitleIdRef.current = null;
    activeSubtitleWordIndexRef.current = -1;
    if (!isPlaying) {
      updateSubtitleForTimeRef.current(playbackTimeRef.current);
    }
  }, [subtitleSegments, textSettings, fallbackTextSettings, clipTransforms, isPlaying]);

  // Ultra-lightweight DOM update - just reads from cache
  // Uses direct property assignment for maximum performance during playback
  const updateSubtitleWordHighlight = useCallback(
    (
      entry: { segment: SubtitleSegment; startTime: number } | null,
      time: number,
      force: boolean
    ) => {
      const textEl = subtitleTextRef.current;
      if (!entry || !textEl) {
        activeSubtitleWordIndexRef.current = -1;
        return;
      }
      const { segment } = entry;
      const cached = subtitleStyleCacheRef.current.get(segment.clipId);
      if (!cached) {
        activeSubtitleWordIndexRef.current = -1;
        return;
      }
      const words = segment.words ?? [];
      const canHighlight =
        cached.wordHighlightEnabled &&
        words.length > 0 &&
        !cached.text.includes("\n");
      if (!canHighlight) {
        if (force) {
          textEl.textContent = cached.text;
        }
        activeSubtitleWordIndexRef.current = -1;
        return;
      }
      const offset = entry.startTime - segment.startTime;
      const timedWords = offset
        ? words.map((word) => ({
            start: word.start + offset,
            end: word.end + offset,
          }))
        : words;
      const nextIndex = findActiveWordIndex(timedWords, time);
      if (!force && nextIndex === activeSubtitleWordIndexRef.current) {
        return;
      }
      activeSubtitleWordIndexRef.current = nextIndex;
      textEl.innerHTML = buildHighlightedSubtitleHtml(
        words,
        nextIndex,
        cached.wordHighlightColor
      );
    },
    []
  );

  const updateSubtitleDOM = useCallback(
    (
      clipId: string | null,
      entry?: { segment: SubtitleSegment; startTime: number } | null,
      time?: number
    ) => {
    const overlay = subtitleOverlayRef.current;
    const textEl = subtitleTextRef.current;
    if (!overlay || !textEl) return;
    
    if (!clipId) {
      overlay.style.opacity = '0';
      overlay.style.visibility = 'hidden';
      overlay.style.pointerEvents = 'none';
      delete overlay.dataset.clipId;
      activeSubtitleWordIndexRef.current = -1;
      return;
    }
    
    const cached = subtitleStyleCacheRef.current.get(clipId);
    if (!cached) {
      overlay.style.opacity = '0';
      overlay.style.visibility = 'hidden';
      overlay.style.pointerEvents = 'none';
      delete overlay.dataset.clipId;
      activeSubtitleWordIndexRef.current = -1;
      return;
    }
    
    // Apply position using direct property assignment (faster than cssText)
    overlay.style.left = `${cached.transform.x * 100}%`;
    overlay.style.top = `${cached.transform.y * 100}%`;
    overlay.style.width = `${cached.transform.width * 100}%`;
    overlay.style.height = `${cached.transform.height * 100}%`;
    overlay.style.opacity = '1';
    overlay.style.visibility = 'visible';
    overlay.style.pointerEvents = 'auto';
    overlay.dataset.clipId = clipId;
    
    // Apply text styles efficiently
    const s = cached.styles.textStyle;
    textEl.style.fontFamily = s.fontFamily as string || '';
    textEl.style.fontSize = typeof s.fontSize === 'number' ? `${s.fontSize}px` : (s.fontSize as string || '');
    textEl.style.fontWeight = String(s.fontWeight || '');
    textEl.style.fontStyle = s.fontStyle as string || '';
    textEl.style.lineHeight = String(s.lineHeight || '');
    textEl.style.letterSpacing = typeof s.letterSpacing === 'number' ? `${s.letterSpacing}px` : (s.letterSpacing as string || '');
    textEl.style.color = s.color as string || '';
    textEl.style.textShadow = s.textShadow as string || 'none';
    textEl.style.textAlign = s.textAlign as string || 'center';
    if (s.WebkitTextStrokeWidth) {
      (textEl.style as unknown as Record<string, unknown>).webkitTextStrokeWidth = typeof s.WebkitTextStrokeWidth === 'number' ? `${s.WebkitTextStrokeWidth}px` : s.WebkitTextStrokeWidth;
      (textEl.style as unknown as Record<string, unknown>).webkitTextStrokeColor = s.WebkitTextStrokeColor as string || '';
    } else {
      (textEl.style as unknown as Record<string, unknown>).webkitTextStrokeWidth = '';
      (textEl.style as unknown as Record<string, unknown>).webkitTextStrokeColor = '';
    }
    // Background styles
    if (s.backgroundColor) {
      textEl.style.backgroundColor = s.backgroundColor as string;
      textEl.style.padding = s.padding as string || '';
      textEl.style.borderRadius = typeof s.borderRadius === 'number' ? `${s.borderRadius}px` : (s.borderRadius as string || '');
    } else {
      textEl.style.backgroundColor = '';
      textEl.style.padding = '';
      textEl.style.borderRadius = '';
    }
    if (entry && typeof time === "number") {
      updateSubtitleWordHighlight(entry, time, true);
    } else {
      textEl.textContent = cached.text;
      activeSubtitleWordIndexRef.current = -1;
    }
  }, [updateSubtitleWordHighlight]);

  // Binary search for finding active subtitle - optimized for sequential playback
  // Uses cache for O(1) sequential access, falls back to O(log n) binary search
  const findActiveSubtitleIndex = useCallback((time: number): number => {
    const clips = sortedSubtitleClips;
    if (clips.length === 0) return -1;
    
    // Small epsilon to handle floating-point edge cases
    const epsilon = 0.005;
    
    // Check cache first (O(1) for sequential playback - most common case)
    const lastIdx = activeSubtitleIndexRef.current;
    if (lastIdx >= 0 && lastIdx < clips.length) {
      const entry = clips[lastIdx];
      // Check if still in current subtitle
      if (time >= entry.startTime - epsilon && time < entry.endTime + epsilon) {
        return lastIdx;
      }
      // Check next subtitle (forward playback)
      if (lastIdx + 1 < clips.length) {
        const next = clips[lastIdx + 1];
        if (time >= next.startTime - epsilon && time < next.endTime + epsilon) {
          return lastIdx + 1;
        }
      }
      // Check previous subtitle (reverse scrubbing)
      if (lastIdx > 0) {
        const prev = clips[lastIdx - 1];
        if (time >= prev.startTime - epsilon && time < prev.endTime + epsilon) {
          return lastIdx - 1;
        }
      }
    }
    
    // Binary search O(log n) - for seeking or when cache misses
    let low = 0, high = clips.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const entry = clips[mid];
      if (time < entry.startTime - epsilon) {
        high = mid - 1;
      } else if (time >= entry.endTime + epsilon) {
        low = mid + 1;
      } else {
        // Found a subtitle that contains this time
        return mid;
      }
    }
    return -1;
  }, [sortedSubtitleClips]);

  // Ref-based subtitle updater for use in the main playback loop
  // This allows subtitle updates to be called from the RAF loop without recreating it
  const updateSubtitleForTimeRef = useRef<(time: number) => void>(() => {});
  
  useEffect(() => {
    updateSubtitleForTimeRef.current = (time: number) => {
      if (sortedSubtitleClips.length === 0) {
        if (lastRenderedSubtitleIdRef.current !== null) {
          activeSubtitleIndexRef.current = -1;
          lastRenderedSubtitleIdRef.current = null;
          activeSubtitleWordIndexRef.current = -1;
          updateSubtitleDOM(null);
        }
        return;
      }
      
      const idx = findActiveSubtitleIndex(time);
      const entry = idx >= 0 ? sortedSubtitleClips[idx] : null;
      const newId = entry?.segment.clipId ?? null;
      
      if (newId !== lastRenderedSubtitleIdRef.current) {
        activeSubtitleIndexRef.current = idx;
        lastRenderedSubtitleIdRef.current = newId;
        activeSubtitleWordIndexRef.current = -1;
        updateSubtitleDOM(newId, entry ?? null, time);
        return;
      }
      if (entry) {
        updateSubtitleWordHighlight(entry, time, false);
      }
    };
  }, [
    sortedSubtitleClips,
    findActiveSubtitleIndex,
    updateSubtitleDOM,
    updateSubtitleWordHighlight,
  ]);
  
  // Force subtitle update when subtitle data changes (clips moved, edited, etc.)
  // This ensures subtitles stay in sync after timeline edits
  useEffect(() => {
    // Reset cached state to force re-evaluation
    activeSubtitleIndexRef.current = -1;
    lastRenderedSubtitleIdRef.current = null;
    activeSubtitleWordIndexRef.current = -1;
    // Update with current time
    updateSubtitleForTimeRef.current(playbackTimeRef.current);
  }, [sortedSubtitleClips]);
  
  // Update subtitles when paused/scrubbing (via currentTime changes)
  useEffect(() => {
    if (!isPlaying) {
      updateSubtitleForTimeRef.current(currentTime);
    }
  }, [currentTime, isPlaying]);

  const wasPlayingRef = useRef(false);
  const timelineJumpRef = useRef(false);
  const lastTimelineTimeRef = useRef(currentTime);
  // UI update cadence during playback.
  const subtitleUiFrameSecondsRef = useRef(1 / 60);

  useEffect(() => {
    if (isPlaying) {
      timelineJumpRef.current = false;
      lastTimelineTimeRef.current = currentTime;
      return;
    }
    const delta = Math.abs(currentTime - lastTimelineTimeRef.current);
    timelineJumpRef.current = delta > frameStepSeconds * 3;
    lastTimelineTimeRef.current = currentTime;
  }, [currentTime, isPlaying]);

  const contentAspectRatio = useMemo<number>(() => {
    const visuals = timelineLayout.filter(
      (entry) => entry.asset.kind === "video" || entry.asset.kind === "image"
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

  const projectAspectRatio = useMemo<number>(() => {
    if (
      Number.isFinite(projectAspectRatioOverride) &&
      (projectAspectRatioOverride ?? 0) > 0
    ) {
      return projectAspectRatioOverride ?? 16 / 9;
    }
    return contentAspectRatio;
  }, [contentAspectRatio, projectAspectRatioOverride]);

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

  const resolveBackgroundTransform = useCallback(() => {
    return { x: 0, y: 0, width: 1, height: 1 };
  }, []);

  const baseBackgroundTransform = useMemo(() => {
    if (!baseVisualEntry) {
      return null;
    }
    return resolveBackgroundTransform();
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

  const contentTimelineTotal = useMemo(() => {
    return timeline.reduce(
      (max, clip) =>
        Math.max(max, (clip.startTime ?? 0) + clip.duration),
      0
    );
  }, [timeline]);

  const projectDuration = useMemo(() => {
    if (
      projectDurationMode === "fixed" &&
      Number.isFinite(projectDurationSeconds) &&
      projectDurationSeconds > 0
    ) {
      return projectDurationSeconds;
    }
    return contentTimelineTotal;
  }, [contentTimelineTotal, projectDurationMode, projectDurationSeconds]);

  const exportFonts = useMemo(() => {
    const fonts = new Set<string>();
    if (fallbackTextSettings.fontFamily) {
      fonts.add(fallbackTextSettings.fontFamily);
    }
    if (subtitleBaseSettings.fontFamily) {
      fonts.add(subtitleBaseSettings.fontFamily);
    }
    Object.values(textSettings).forEach((settings) => {
      if (settings?.fontFamily) {
        fonts.add(settings.fontFamily);
      }
    });
    const activeSubtitleStyle =
      resolvedSubtitleStylePresets.find((preset) => preset.id === subtitleStyleId) ??
      null;
    if (activeSubtitleStyle?.preview?.fontFamily) {
      fonts.add(activeSubtitleStyle.preview.fontFamily);
    }
    return Array.from(fonts).filter(Boolean);
  }, [
    fallbackTextSettings.fontFamily,
    subtitleBaseSettings.fontFamily,
    resolvedSubtitleStylePresets,
    subtitleStyleId,
    textSettings,
  ]);

  const exportDimensions = useMemo<ExportOutput>(() => {
    if (resolvedProjectSize?.width && resolvedProjectSize?.height) {
      return {
        width: ensureEven(resolvedProjectSize.width),
        height: ensureEven(resolvedProjectSize.height),
      };
    }
    const ratio = Number.isFinite(projectAspectRatio) && projectAspectRatio > 0
      ? projectAspectRatio
      : 16 / 9;
    if (ratio >= 1) {
      const width = 1920;
      return {
        width: ensureEven(width),
        height: ensureEven(width / ratio),
      };
    }
    const height = 1920;
    return {
      width: ensureEven(height * ratio),
      height: ensureEven(height),
    };
  }, [projectAspectRatio, resolvedProjectSize?.height, resolvedProjectSize?.width]);

  const waitForExportStage = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }
    const start = performance.now();
    const waitFrame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    while (performance.now() - start < 15000) {
      const stage = stageRef.current;
      if (stage) {
        const rect = stage.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return;
        }
      }
      await waitFrame();
    }
  }, []);

  const waitForExportMedia = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const images = Array.from(stage.querySelectorAll("img"));
    const videos = Array.from(stage.querySelectorAll("video"));
    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          })
      )
    );
    await Promise.all(
      videos.map(
        (video) =>
          new Promise<void>((resolve) => {
            if (video.readyState >= 2 && !video.seeking) {
              resolve();
              return;
            }
            const done = () => resolve();
            video.addEventListener("loadeddata", done, { once: true });
            video.addEventListener("seeked", done, { once: true });
            video.addEventListener("error", done, { once: true });
          })
      )
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  }, []);

  const waitForExportFonts = useCallback(
    async (fonts: string[]) => {
      if (typeof document === "undefined") {
        return;
      }
      const unique = Array.from(
        new Set(
          fonts
            .map((font) => (typeof font === "string" ? font.trim() : ""))
            .filter(Boolean)
        )
      );
      await Promise.all(unique.map((font) => loadFontFamily(font)));
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
    },
    [loadFontFamily]
  );

  useEffect(() => {
    if (!isExportMode || typeof window === "undefined") {
      return;
    }
    const payload = (window as any).__EDITOR_EXPORT__;
    const fonts = Array.isArray(payload?.fonts) ? payload.fonts : [];
    (window as any).__EDITOR_EXPORT_API__ = {
      waitForReady: async () => {
        await waitForExportStage();
        await waitForExportFonts(fonts);
        await waitForExportMedia();
      },
      setTime: async (time: number) => {
        setIsPlaying(false);
        setCurrentTime(time);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve())
        );
        await waitForExportMedia();
      },
      getStageSelector: () => "[data-export-stage]",
    };
    return () => {
      delete (window as any).__EDITOR_EXPORT_API__;
    };
  }, [
    isExportMode,
    waitForExportFonts,
    waitForExportMedia,
    waitForExportStage,
  ]);

  const buildExportState = useCallback(() => {
    const state = buildProjectState();
    const snapshot = state.snapshot
      ? {
          ...state.snapshot,
          selectedClipId: null,
          selectedClipIds: [],
          activeCanvasClipId: null,
          activeAssetId: null,
          currentTime: 0,
        }
      : state.snapshot;
    return {
      ...state,
      snapshot,
    };
  }, [buildProjectState]);

  const stopExportPolling = useCallback(() => {
    if (exportPollRef.current) {
      window.clearInterval(exportPollRef.current);
      exportPollRef.current = null;
    }
  }, []);

  const triggerExportDownload = useCallback(
    (url: string) => {
      if (typeof document === "undefined") {
        return;
      }
      const safeName = (projectName || "export")
        .trim()
        .replace(/[^a-zA-Z0-9-_]+/g, "-")
        .replace(/-+/g, "-");
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${safeName || "export"}.mp4`;
      anchor.rel = "noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    },
    [projectName]
  );

  const startExportPolling = useCallback(
    (jobId: string) => {
      stopExportPolling();
      exportPollRef.current = window.setInterval(async () => {
        try {
          const response = await fetch(
            `/api/editor/export/status?jobId=${jobId}`
          );
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload?.error || "Export status check failed.");
          }
          setExportUi((prev) => ({
            ...prev,
            status: payload?.status ?? prev.status,
            stage: payload?.stage ?? prev.stage,
            progress:
              typeof payload?.progress === "number"
                ? clamp(payload.progress, 0, 1)
                : prev.progress,
            downloadUrl:
              typeof payload?.downloadUrl === "string"
                ? payload.downloadUrl
                : prev.downloadUrl,
            error:
              typeof payload?.error === "string" ? payload.error : prev.error,
          }));
          if (payload?.status === "complete" || payload?.status === "error") {
            stopExportPolling();
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Export failed.";
          setExportUi((prev) => ({
            ...prev,
            status: "error",
            stage: "Export failed",
            error: message,
          }));
          stopExportPolling();
        }
      }, 1000);
    },
    [stopExportPolling]
  );

  const handleStartExport = useCallback(async () => {
    if (
      timeline.length === 0 ||
      exportUi.status === "starting" ||
      exportUi.status === "queued" ||
      exportUi.status === "loading" ||
      exportUi.status === "rendering" ||
      exportUi.status === "encoding" ||
      exportUi.status === "uploading"
    ) {
      return;
    }
    setExportAutoDownloaded(false);
    setExportUi({
      open: true,
      status: "starting",
      stage: "Preparing export",
      progress: 0,
      jobId: null,
      downloadUrl: null,
      error: null,
    });
    try {
      const payload = {
        state: buildExportState(),
        output: exportDimensions,
        fps: 30,
        duration: projectDuration,
        fonts: exportFonts,
        name: projectName,
      };
      const response = await fetch("/api/editor/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Export failed.");
      }
      const nextJobId =
        typeof data?.jobId === "string"
          ? data.jobId
          : typeof data?.id === "string"
            ? data.id
            : null;
      setExportUi((prev) => ({
        ...prev,
        status: data?.status ?? "queued",
        stage: data?.stage ?? "Queued",
        progress:
          typeof data?.progress === "number"
            ? clamp(data.progress, 0, 1)
            : 0,
        jobId: nextJobId,
        downloadUrl:
          typeof data?.downloadUrl === "string" ? data.downloadUrl : null,
      }));
      if (nextJobId) {
        startExportPolling(nextJobId);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Export failed.";
      setExportUi((prev) => ({
        ...prev,
        status: "error",
        stage: "Export failed",
        error: message,
      }));
    }
  }, [
    buildExportState,
    exportDimensions,
    exportFonts,
    exportUi.status,
    projectDuration,
    projectName,
    startExportPolling,
    timeline.length,
  ]);

  useEffect(() => {
    return () => {
      stopExportPolling();
    };
  }, [stopExportPolling]);

  useEffect(() => {
    if (
      exportUi.status !== "complete" ||
      !exportUi.downloadUrl ||
      exportAutoDownloaded
    ) {
      return;
    }
    triggerExportDownload(exportUi.downloadUrl);
    setExportAutoDownloaded(true);
  }, [exportAutoDownloaded, exportUi.downloadUrl, exportUi.status, triggerExportDownload]);

  const exportProgressPercent = Math.round(
    clamp(exportUi.progress, 0, 1) * 100
  );
  const exportInFlight =
    exportUi.status === "starting" ||
    exportUi.status === "queued" ||
    exportUi.status === "loading" ||
    exportUi.status === "rendering" ||
    exportUi.status === "encoding" ||
    exportUi.status === "uploading";
  const exportDisabled = exportInFlight || timeline.length === 0;

  const timelineSpan = useMemo(
    () => Math.max(contentTimelineTotal, projectDuration),
    [contentTimelineTotal, projectDuration]
  );

  const timelineDuration = useMemo(() => {
    return Math.max(10, Math.ceil(timelineSpan + 1));
  }, [timelineSpan]);

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

  const subtitleSourceOptions = useMemo(() => {
    const options = [
      {
        id: "project",
        label: "Full project",
        duration: projectDuration,
        kind: "project",
      },
    ];
    timelineClips
      .filter(
        (entry) =>
          entry.asset.kind === "audio" || entry.asset.kind === "video"
      )
      .sort((a, b) => a.clip.startTime - b.clip.startTime)
      .forEach((entry, index) => {
        options.push({
          id: entry.clip.id,
          label: entry.asset.name || `Clip ${index + 1}`,
          duration: entry.clip.duration,
          kind: entry.asset.kind,
        });
      });
    return options;
  }, [projectDuration, timelineClips]);

  useEffect(() => {
    if (
      subtitleSource !== "project" &&
      !subtitleSourceOptions.some((option) => option.id === subtitleSource)
    ) {
      setSubtitleSource("project");
    }
  }, [subtitleSource, subtitleSourceOptions]);

  const subtitleSourceClips = useMemo(() => {
    return timelineClips.filter(
      (entry) =>
        entry.asset.kind === "audio" || entry.asset.kind === "video"
    );
  }, [timelineClips]);
  const buildSubtitleSegmentsFromText = useCallback(
    (text: string, duration: number, clipStartOffset: number) => {
      const cleaned = text.trim();
      if (!cleaned) {
        return [];
      }
      const words = cleaned.split(/\s+/).filter(Boolean);
      if (words.length === 0 || duration <= 0) {
        return [];
      }
      const maxChars = 42;
      const chunks: string[] = [];
      let current = "";
      words.forEach((word) => {
        const next = current ? `${current} ${word}` : word;
        if (next.length > maxChars && current) {
          chunks.push(current);
          current = word;
        } else {
          current = next;
        }
      });
      if (current) {
        chunks.push(current);
      }
      const chunkWordCounts = chunks.map((chunk) => chunk.split(/\s+/).length);
      const totalWords = chunkWordCounts.reduce((sum, count) => sum + count, 0);
      if (totalWords === 0) {
        return [];
      }
      let cursor = 0;
      return chunks.map((chunk, index) => {
        const portion = chunkWordCounts[index] / totalWords;
        const segmentDuration = duration * portion;
        const start = cursor;
        const end = index === chunks.length - 1 ? duration : cursor + segmentDuration;
        cursor = end;
        return {
          start: clipStartOffset + start,
          end: clipStartOffset + end,
          text: chunk,
        };
      });
    },
    []
  );

  const buildSubtitleSegmentsFromWords = useCallback(
    (
      words: Array<{ start: number; end: number; word?: string; text?: string }>
    ) => {
      const segments: Array<{
        start: number;
        end: number;
        text: string;
        words?: TimedWord[];
      }> = [];
      
      // Lightning-fast subtitles that match exact speech timing
      // NO artificial duration extensions - subtitles end exactly when words end
      const maxChars = 35;           // Short lines for quick reading
      const maxWords = 5;            // Few words per subtitle for fast turnover
      const maxDuration = 2.0;       // Max time before forcing a break
      const naturalPauseGap = 0.12;  // Detect natural pauses quickly
      const longPauseGap = 0.25;     // Clear break between phrases
      
      let current: typeof words = [];
      let currentText = "";
      let segmentStart = 0;
      
      const flush = () => {
        if (current.length === 0) {
          return;
        }
        const start = current[0]?.start ?? segmentStart;
        const end = current[current.length - 1]?.end ?? start;
        const text = currentText.trim();
        
        // Use EXACT word timings - no artificial extension
        // This ensures subtitles change at the precise moment speech changes
        if (text && end > start) {
          segments.push({
            start,
            end,
            text,
            words: current.map((entry) => ({
              start: entry.start,
              end: entry.end,
              word: entry.word,
              text: entry.text,
            })),
          });
        }
        current = [];
        currentText = "";
      };
      
      // Detect speech rate to adaptively adjust parameters
      let totalWordsWithTiming = 0;
      let totalDuration = 0;
      words.forEach((entry, i) => {
        if (Number.isFinite(entry.start) && Number.isFinite(entry.end) && entry.end > entry.start) {
          totalWordsWithTiming++;
          totalDuration += entry.end - entry.start;
        }
      });
      const avgWordDuration = totalWordsWithTiming > 0 ? totalDuration / totalWordsWithTiming : 0.3;
      
      // Detect speech speed: fast < 200ms, very fast < 150ms per word
      const isVeryFastSpeech = avgWordDuration < 0.15;
      const isFastSpeech = avgWordDuration < 0.20;
      
      // Aggressive breaking for fast speech - fewer words per subtitle
      const effectiveMaxWords = isVeryFastSpeech ? 3 : isFastSpeech ? 4 : maxWords;
      const effectiveMaxDuration = isVeryFastSpeech ? 1.2 : isFastSpeech ? 1.5 : maxDuration;
      const effectiveMaxChars = isVeryFastSpeech ? 25 : isFastSpeech ? 30 : maxChars;
      
      words.forEach((entry, index) => {
        const token = (entry.word ?? entry.text ?? "").trim();
        if (!token) {
          return;
        }
        
        const last = current[current.length - 1];
        const gap = last && Number.isFinite(entry.start) && Number.isFinite(last.end)
          ? entry.start - last.end
          : 0;
        
        // Break on pauses (speech breaks)
        if (last && gap > longPauseGap) {
          flush();
          segmentStart = entry.start;
        }
        
        const nextText = currentText ? `${currentText} ${token}` : token;
        const wordCount = current.length + 1;
        const currentDuration = last 
          ? (entry.end - (current[0]?.start ?? entry.start))
          : 0;
        
        // Check if we should break based on various criteria
        const shouldBreak = 
          // Character limit exceeded (adaptive for speech speed)
          (currentText && nextText.length > effectiveMaxChars) ||
          // Word count limit (fewer words for fast speech)
          (wordCount > effectiveMaxWords) ||
          // Duration limit (shorter for fast speech)
          (currentDuration > effectiveMaxDuration) ||
          // Natural pause with content
          (gap > naturalPauseGap && current.length >= 1);
        
        // Punctuation that suggests end of thought
        const endsPunctuation = /[.!?,;:]$/.test(token);
        const endsClause = /[,;:]$/.test(token);
        
        if (shouldBreak && currentText) {
          flush();
          segmentStart = entry.start;
          current.push(entry);
          currentText = token;
          // If this word also ends a sentence, flush it too
          if (endsPunctuation && !endsClause) {
            flush();
          }
          return;
        }
        
        current.push(entry);
        currentText = nextText;
        
        // End of sentence - flush for natural subtitle breaks
        if (endsPunctuation && !endsClause && current.length >= 2) {
          flush();
        }
      });
      
      flush();
      
      // For fast speech, don't merge - keep subtitles short and responsive
      // Only merge for normal speech when gaps are truly negligible
      if (isFastSpeech || isVeryFastSpeech) {
        // No merging for fast speech - return segments as-is
        return segments;
      }
      
      // Light merging only for normal speech
      const merged: typeof segments = [];
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const prev = merged[merged.length - 1];
        
        // Only merge if gap is tiny and result is still short
        const shouldMerge = 
          prev &&
          seg.start - prev.end < 0.03 && // 30ms gap max
          prev.text.split(' ').length <= 2 &&
          (prev.text + " " + seg.text).length <= effectiveMaxChars &&
          seg.end - prev.start <= effectiveMaxDuration;
          
        if (shouldMerge) {
          prev.end = seg.end;
          prev.text = prev.text + " " + seg.text;
        } else {
          merged.push({ ...seg });
        }
      }
      
      return merged;
    },
    []
  );

  const splitSubtitleSegmentsByText = useCallback(
    (segments: TimedSegment[]) => {
      return segments.flatMap((segment) => {
        const duration = Math.max(0, segment.end - segment.start);
        const splits = buildSubtitleSegmentsFromText(
          segment.text,
          duration,
          segment.start
        );
        if (splits.length === 0) {
          return [];
        }
        return splits.map((entry) => ({ ...entry, speaker: segment.speaker }));
      });
    },
    [buildSubtitleSegmentsFromText]
  );

  const resolveSubtitleSettings = useCallback(
    (text: string) => {
      const style =
        resolvedSubtitleStylePresets.find((preset) => preset.id === subtitleStyleId) ??
        null;
      const preview = style?.preview;
      return {
        ...subtitleBaseSettings,
        ...style?.settings,
        fontFamily: preview?.fontFamily ?? subtitleBaseSettings.fontFamily,
        fontSize: preview?.fontSize ?? subtitleBaseSettings.fontSize,
        bold: preview?.bold ?? subtitleBaseSettings.bold,
        italic: preview?.italic ?? subtitleBaseSettings.italic,
        text,
        // Disable auto-size for subtitles - we use a fixed transform that
        // accommodates multi-line wrapped text. Auto-size would shrink the
        // box to single-line height since measureTextBounds doesn't account
        // for CSS text wrapping.
        autoSize: false,
      };
    },
    [subtitleBaseSettings, subtitleStyleId, resolvedSubtitleStylePresets]
  );

  const resolveSubtitleStyleTargets = useCallback(
    (targetClipId: string | null) => {
      if (subtitleSegments.length === 0) {
        return [];
      }
      const selectedSubtitleClipId =
        targetClipId && subtitleClipIdSet.has(targetClipId) ? targetClipId : null;
      if (!selectedSubtitleClipId) {
        return subtitleSegments.map((segment) => segment.clipId);
      }
      if (!subtitleMoveTogether) {
        return [selectedSubtitleClipId];
      }
      const targetSegment = subtitleSegments.find(
        (segment) => segment.clipId === selectedSubtitleClipId
      );
      if (!targetSegment || detachedSubtitleIds.has(selectedSubtitleClipId)) {
        return [selectedSubtitleClipId];
      }
      const targetSourceId = targetSegment.sourceClipId;
      const grouped = subtitleSegments.filter((segment) => {
        if (detachedSubtitleIds.has(segment.clipId)) {
          return false;
        }
        if (targetSourceId) {
          return segment.sourceClipId === targetSourceId;
        }
        return segment.clipId === selectedSubtitleClipId;
      });
      if (grouped.length === 0) {
        return [selectedSubtitleClipId];
      }
      return grouped.map((segment) => segment.clipId);
    },
    [
      subtitleSegments,
      subtitleClipIdSet,
      subtitleMoveTogether,
      detachedSubtitleIds,
    ]
  );

  const applySubtitleStyle = useCallback(
    (styleId: string) => {
      setSubtitleStyleId(styleId);
      const style = resolvedSubtitleStylePresets.find(
        (preset) => preset.id === styleId
      );
      const targetClipIds = resolveSubtitleStyleTargets(selectedClipId);
      if (!style || targetClipIds.length === 0) {
        return;
      }
      const preview = style.preview;
      setTextSettings((prev) => {
        const next = { ...prev };
        targetClipIds.forEach((clipId) => {
          const current = next[clipId] ?? subtitleBaseSettings;
          next[clipId] = {
            ...current,
            ...style.settings,
            fontFamily: preview?.fontFamily ?? current.fontFamily,
            fontSize: preview?.fontSize ?? current.fontSize,
            bold: preview?.bold ?? current.bold,
            italic: preview?.italic ?? current.italic,
            // Keep autoSize disabled for subtitles
            autoSize: false,
          };
        });
        return next;
      });
    },
    [
      resolveSubtitleStyleTargets,
      selectedClipId,
      subtitleBaseSettings,
      resolvedSubtitleStylePresets,
    ]
  );

  const handleSubtitleStyleUpdate = useCallback(
    (
      styleId: string,
      settings: Partial<TextClipSettings>,
      preview?: TextStylePreset["preview"]
    ) => {
      setSubtitleStyleOverrides((prev) => {
        const current = prev[styleId];
        return {
          ...prev,
          [styleId]: {
            settings: {
              ...(current?.settings ?? {}),
              ...settings,
            },
            preview: {
              ...(current?.preview ?? {}),
              ...(preview ?? {}),
            },
          },
        };
      });
      const targetClipIds = resolveSubtitleStyleTargets(selectedClipId);
      if (styleId !== subtitleStyleId || targetClipIds.length === 0) {
        return;
      }
      setTextSettings((prev) => {
        const next = { ...prev };
        targetClipIds.forEach((clipId) => {
          const current = next[clipId] ?? subtitleBaseSettings;
          next[clipId] = {
            ...current,
            ...settings,
            autoSize: false,
          };
        });
        return next;
      });
    },
    [
      resolveSubtitleStyleTargets,
      selectedClipId,
      subtitleStyleId,
      subtitleBaseSettings,
    ]
  );

  const handleSubtitleTextUpdate = useCallback(
    (segmentId: string, text: string) => {
      setSubtitleSegments((prev) =>
        prev.map((segment) =>
          segment.id === segmentId
            ? { ...segment, text, words: undefined }
            : segment
        )
      );
      const target = subtitleSegments.find(
        (segment) => segment.id === segmentId
      );
      if (!target) {
        return;
      }
      setTextSettings((prev) => {
        const current = prev[target.clipId] ?? subtitleBaseSettings;
        return {
          ...prev,
          [target.clipId]: {
            ...current,
            text,
          },
        };
      });
    },
    [subtitleSegments, subtitleBaseSettings]
  );

  const handleSubtitlePreview = useCallback(
    (segment: { clipId: string; startTime: number; clip?: TimelineClip }) => {
      const baseStart = segment.clip?.startTime ?? segment.startTime;
      const safeStart = Number.isFinite(baseStart) ? Math.max(0, baseStart) : 0;
      if (isPlaying) {
        setIsPlaying(false);
      }
      setCurrentTime(safeStart);
      setSelectedClipId(segment.clipId);
      setSelectedClipIds([segment.clipId]);
      setActiveCanvasClipId(segment.clipId);
    },
    [isPlaying]
  );

  const handleSubtitleAddLine = useCallback((options?: {
    startTime?: number;
    endTime?: number;
    text?: string;
  }) => {
    pushHistory();
    const nextLanes = [...lanesRef.current];
    const laneId =
      subtitleLaneIdRef.current &&
      nextLanes.some((lane) => lane.id === subtitleLaneIdRef.current)
        ? subtitleLaneIdRef.current
        : createLaneId("text", nextLanes);
    subtitleLaneIdRef.current = laneId;
    const lastSegment = subtitleSegments[subtitleSegments.length - 1];
    const fallbackTime = playbackTimeRef.current;
    const explicitStart = options?.startTime;
    const explicitEnd = options?.endTime;
    const baseStart = Number.isFinite(explicitStart)
      ? Math.max(0, explicitStart as number)
      : lastSegment
        ? lastSegment.endTime + 0.2
        : fallbackTime;
    const defaultDuration = 2.4;
    const baseEnd = Number.isFinite(explicitEnd)
      ? (explicitEnd as number)
      : baseStart + defaultDuration;
    const duration = Math.max(minClipDuration, baseEnd - baseStart);
    const subtitleText = options?.text ?? "";
    const asset = {
      ...createTextAsset("Subtitle"),
      duration,
    };
    const clip = createClip(asset.id, laneId, baseStart, asset);
    const segment: SubtitleSegment = {
      id: crypto.randomUUID(),
      clipId: clip.id,
      text: subtitleText,
      startTime: baseStart,
      endTime: baseStart + duration,
      sourceClipId: null,
      words: undefined,
    };
    setLanes(nextLanes);
    setAssets((prev) => [asset, ...prev]);
    setTimeline((prev) => [...prev, clip]);
    setTextSettings((prev) => ({
      ...prev,
      [clip.id]: resolveSubtitleSettings(subtitleText),
    }));
    // Set the proper subtitle transform (bottom, wider, taller for multi-line)
    setClipTransforms((prev) => ({
      ...prev,
      [clip.id]: createSubtitleTransform(stageAspectRatio),
    }));
    setSubtitleSegments((prev) => [...prev, segment]);
    setSubtitleActiveTab("edit");
    if (isPlaying) {
      setIsPlaying(false);
    }
    setSelectedClipId(clip.id);
    setSelectedClipIds([clip.id]);
    setActiveCanvasClipId(clip.id);
    setCurrentTime(baseStart);
  }, [
    resolveSubtitleSettings,
    subtitleSegments,
    pushHistory,
    stageAspectRatio,
    isPlaying,
  ]);

  const handleSubtitleDelete = useCallback(
    (segmentId: string) => {
      const target = subtitleSegments.find((segment) => segment.id === segmentId);
      if (!target) {
        return;
      }
      pushHistory();
      setSubtitleSegments((prev) =>
        prev.filter((segment) => segment.id !== segmentId)
      );
      setTimeline((prev) => prev.filter((clip) => clip.id !== target.clipId));
      setTextSettings((prev) => {
        if (!prev[target.clipId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[target.clipId];
        return next;
      });
      setClipTransforms((prev) => {
        if (!prev[target.clipId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[target.clipId];
        return next;
      });
      setDetachedSubtitleIds((prev) => {
        if (!prev.has(target.clipId)) {
          return prev;
        }
        const next = new Set(prev);
        next.delete(target.clipId);
        return next;
      });
      if (selectedClipId === target.clipId) {
        setSelectedClipId(null);
        setSelectedClipIds([]);
        setActiveAssetId(null);
        setActiveCanvasClipId(null);
      }
    },
    [pushHistory, selectedClipId, subtitleSegments]
  );

  const handleSubtitleDetachToggle = useCallback((clipId: string) => {
    setDetachedSubtitleIds((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }
      return next;
    });
  }, []);

  const handleSubtitleDeleteAll = useCallback(() => {
    if (subtitleSegments.length === 0) {
      return;
    }
    pushHistory();
    const idsToRemove = new Set(subtitleSegments.map((segment) => segment.clipId));
    setSubtitleSegments([]);
    setTimeline((prev) => prev.filter((clip) => !idsToRemove.has(clip.id)));
    setTextSettings((prev) => {
      const next = { ...prev };
      idsToRemove.forEach((id) => {
        delete next[id];
      });
      return next;
    });
    setClipTransforms((prev) => {
      const next = { ...prev };
      idsToRemove.forEach((id) => {
        delete next[id];
      });
      return next;
    });
    setDetachedSubtitleIds(new Set());
    if (selectedClipId && idsToRemove.has(selectedClipId)) {
      setSelectedClipId(null);
      setSelectedClipIds([]);
      setActiveAssetId(null);
      setActiveCanvasClipId(null);
    }
  }, [pushHistory, selectedClipId, subtitleSegments]);

  const handleSubtitleShiftAll = useCallback(
    (offsetSeconds: number) => {
      if (!Number.isFinite(offsetSeconds) || subtitleSegments.length === 0) {
        return;
      }
      pushHistory();
      const idsToShift = new Set(subtitleSegments.map((segment) => segment.clipId));
      setTimeline((prev) =>
        prev.map((clip) => {
          if (!idsToShift.has(clip.id)) {
            return clip;
          }
          return {
            ...clip,
            startTime: Math.max(0, clip.startTime + offsetSeconds),
          };
        })
      );
      setSubtitleSegments((prev) =>
        prev.map((segment) => {
          if (!idsToShift.has(segment.clipId)) {
            return segment;
          }
          const nextStart = Math.max(0, segment.startTime + offsetSeconds);
          const nextEnd = Math.max(0, segment.endTime + offsetSeconds);
          const nextWords = segment.words?.map((word) => {
            const start = Math.max(0, word.start + offsetSeconds);
            const end = Math.max(0, word.end + offsetSeconds);
            return {
              ...word,
              start,
              end: Math.max(start, end),
            };
          });
          return {
            ...segment,
            startTime: nextStart,
            endTime: Math.max(nextStart, nextEnd),
            words: nextWords,
          };
        })
      );
    },
    [pushHistory, subtitleSegments]
  );

  const handleGenerateSubtitles = useCallback(async () => {
    if (subtitleStatus === "loading") {
      return;
    }
    const sourceEntries =
      subtitleSource === "project"
        ? subtitleSourceClips
        : subtitleSourceClips.filter(
            (entry) => entry.clip.id === subtitleSource
          );
    if (sourceEntries.length === 0) {
      setSubtitleStatus("error");
      setSubtitleError("Add an audio or video clip to transcribe.");
      return;
    }
    setSubtitleStatus("loading");
    setSubtitleError(null);
    pushHistory();
    try {
      const nextLanes = [...lanesRef.current];
      const laneId =
        subtitleLaneIdRef.current &&
        nextLanes.some((lane) => lane.id === subtitleLaneIdRef.current)
          ? subtitleLaneIdRef.current
          : createLaneId("text", nextLanes);
      subtitleLaneIdRef.current = laneId;
      const existingSubtitleClipIds = new Set(
        subtitleSegments.map((segment) => segment.clipId)
      );
      const nextAssets: MediaAsset[] = [];
      const nextClips: TimelineClip[] = [];
      const nextTextSettings: Record<string, TextClipSettings> = {};
      const nextClipTransforms: Record<string, ClipTransform> = {};
      const nextSegments: SubtitleSegment[] = [];
      // Pre-compute the subtitle transform once for all clips (same position/size)
      const subtitleTransform = createSubtitleTransform(stageAspectRatio);
      const sortedSources = [...sourceEntries].sort(
        (a, b) => a.clip.startTime - b.clip.startTime
      );
      const requestTranscription = async (
        file: File,
        options: {
          model: string;
          responseFormat: string;
          includeTimestampGranularities: boolean;
          chunkingStrategy?: string;
        }
      ) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("model", options.model);
        formData.append("response_format", options.responseFormat);
        if (options.chunkingStrategy) {
          formData.append("chunking_strategy", options.chunkingStrategy);
        }
        if (options.includeTimestampGranularities) {
          formData.append("timestamp_granularities[]", "segment");
          formData.append("timestamp_granularities[]", "word");
        }
        if (subtitleLanguage?.code) {
          formData.append("language", subtitleLanguage.code);
        }
        const response = await fetch("/api/transcriptions", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          const message = await response.text();
          throw new Error(
            message || "Unable to generate subtitles for this clip."
          );
        }
        return response.json();
      };
      const primaryTranscription = {
        model: "gpt-4o-transcribe-diarize",
        responseFormat: "diarized_json",
        includeTimestampGranularities: true,
        chunkingStrategy: "auto",
      };
      const fallbackTranscription = {
        model: "whisper-1",
        responseFormat: "verbose_json",
        includeTimestampGranularities: true,
      };
      const requestTranscriptionWithRetry = async (
        file: File,
        options: {
          model: string;
          responseFormat: string;
          includeTimestampGranularities: boolean;
          chunkingStrategy?: string;
        }
      ) => {
        try {
          return await requestTranscription(file, options);
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (
            options.includeTimestampGranularities &&
            /timestamp|granularit/i.test(message)
          ) {
            return requestTranscription(file, {
              ...options,
              includeTimestampGranularities: false,
            });
          }
          if (/internal_error|internal server error/i.test(message)) {
            try {
              await new Promise((resolve) => window.setTimeout(resolve, 800));
              return await requestTranscription(file, options);
            } catch (retryError) {
              if (options.model !== fallbackTranscription.model) {
                return requestTranscription(file, fallbackTranscription);
              }
              throw retryError;
            }
          }
          throw error;
        }
      };
      const normalizeWordEntries = (entries: TimedEntry[]): TimedWord[] =>
        entries
          .map((entry) => ({
            start: Number(entry.start),
            end: Number(entry.end),
            word: typeof entry.word === "string" ? entry.word : undefined,
            text: typeof entry.text === "string" ? entry.text : undefined,
          }))
          .filter(
            (entry) =>
              Number.isFinite(entry.start) &&
              Number.isFinite(entry.end) &&
              entry.end > entry.start &&
              Boolean(entry.word || entry.text)
          )
          .sort((a, b) => a.start - b.start || a.end - b.end);
      const normalizeSegmentEntries = (
        entries: TimedEntry[]
      ): TimedSegment[] =>
        entries
          .map((entry) => ({
            start: Number(entry.start),
            end: Number(entry.end),
            text: String(entry.text ?? "").trim(),
            speaker:
              typeof entry.speaker === "string" && entry.speaker.trim()
                ? entry.speaker.trim()
                : undefined,
          }))
          .filter(
            (entry) =>
              Number.isFinite(entry.start) &&
              Number.isFinite(entry.end) &&
              entry.end > entry.start &&
              entry.text.length > 0
          )
          .sort((a, b) => a.start - b.start || a.end - b.end);
      const extractWordsFromSegments = (entries: TimedEntry[]) => {
        const extracted: TimedEntry[] = [];
        entries.forEach((entry) => {
          const words = (entry as TimedSegmentEntry).words;
          if (!Array.isArray(words)) {
            return;
          }
          words.forEach((word) => {
            if (word && typeof word === "object") {
              const typed = word as TimedEntry;
              extracted.push({
                start: typed.start,
                end: typed.end,
                word: typed.word,
                text: typed.text,
              });
            }
          });
        });
        return extracted;
      };
      // Keep chunks under Vercel's function payload limit (~4.5 MB).
      const MAX_TRANSCRIPTION_BYTES = 4_000_000;
      type TranscriptionChunk = {
        file: File;
        chunkStartOffset: number;
        chunkEndOffset: number;
      };
      const encodeWavChunk = (
        buffer: AudioBuffer,
        startSample: number,
        endSample: number
      ) => {
        const channels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const frameCount = Math.max(0, endSample - startSample);
        const bytesPerSample = 2;
        const blockAlign = channels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = frameCount * blockAlign;
        const arrayBuffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(arrayBuffer);
        const writeString = (offset: number, value: string) => {
          for (let i = 0; i < value.length; i += 1) {
            view.setUint8(offset + i, value.charCodeAt(i));
          }
        };
        writeString(0, "RIFF");
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, "WAVE");
        writeString(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, channels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, 16, true);
        writeString(36, "data");
        view.setUint32(40, dataSize, true);
        let offset = 44;
        const channelData = Array.from({ length: channels }, (_, index) =>
          buffer.getChannelData(index)
        );
        for (let i = 0; i < frameCount; i += 1) {
          for (let channel = 0; channel < channels; channel += 1) {
            const sample = channelData[channel][startSample + i] ?? 0;
            const clamped = Math.max(-1, Math.min(1, sample));
            const int16 =
              clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
            view.setInt16(offset, int16, true);
            offset += 2;
          }
        }
        return new Blob([arrayBuffer], { type: "audio/wav" });
      };
      const buildTranscriptionChunks = async (
        blob: Blob,
        assetName: string,
        clipStartOffset: number,
        clipDuration: number,
        playbackRate: number,
        assetDuration: number,
        extractAudio: boolean
      ): Promise<{
        chunks: TranscriptionChunk[];
        assetDuration: number;
        clipEndOffset: number;
      }> => {
        const shouldDecode = extractAudio || blob.size > MAX_TRANSCRIPTION_BYTES;
        let resolvedAssetDuration =
          Number.isFinite(assetDuration) && assetDuration > 0
            ? assetDuration
            : 0;
        let audioBuffer: AudioBuffer | null = null;
        if (shouldDecode) {
          const audioContext = getAudioContext();
          if (!audioContext) {
            throw new Error("Audio context unavailable for transcription.");
          }
          try {
            const buffer = await blob.arrayBuffer();
            audioBuffer = await audioContext.decodeAudioData(buffer);
            resolvedAssetDuration = audioBuffer.duration;
          } catch (error) {
            throw new Error(
              extractAudio
                ? "Unable to extract audio from this file. Try a different clip or format."
                : "This file is too large and could not be decoded. Try a shorter clip or an audio-only file."
            );
          }
        }
        if (!resolvedAssetDuration) {
          resolvedAssetDuration = clipStartOffset + clipDuration * playbackRate;
        }
        const clipAssetDuration = Math.min(
          clipDuration * playbackRate,
          Math.max(0, resolvedAssetDuration - clipStartOffset)
        );
        const clipEndOffset = clipStartOffset + clipAssetDuration;
        const baseName = assetName.replace(/\.[^/.]+$/, "").trim() || "audio";
        if (!audioBuffer) {
          return {
            chunks: [
              {
                file: new File([blob], `${baseName}.wav`, {
                  type: blob.type || "audio/wav",
                }),
                chunkStartOffset: 0,
                chunkEndOffset: resolvedAssetDuration,
              },
            ],
            assetDuration: resolvedAssetDuration,
            clipEndOffset,
          };
        }
        const bytesPerSecond =
          audioBuffer.sampleRate * audioBuffer.numberOfChannels * 2;
        const startSample = Math.max(
          0,
          Math.floor(clipStartOffset * audioBuffer.sampleRate)
        );
        const endSample = Math.min(
          audioBuffer.length,
          Math.ceil(clipEndOffset * audioBuffer.sampleRate)
        );
        const clipBytes = Math.max(
          0,
          (endSample - startSample) * audioBuffer.numberOfChannels * 2
        );
        const needsChunking = clipBytes + 44 > MAX_TRANSCRIPTION_BYTES;
        if (!needsChunking) {
          const chunkBlob = encodeWavChunk(
            audioBuffer,
            startSample,
            endSample
          );
          return {
            chunks: [
              {
                file: new File([chunkBlob], `${baseName}.wav`, {
                  type: "audio/wav",
                }),
                chunkStartOffset: clipStartOffset,
                chunkEndOffset: clipEndOffset,
              },
            ],
            assetDuration: resolvedAssetDuration,
            clipEndOffset,
          };
        }
        const maxChunkDuration = Math.max(
          5,
          Math.floor((MAX_TRANSCRIPTION_BYTES - 44) / bytesPerSecond)
        );
        const chunkSamples = Math.max(
          1,
          Math.floor(maxChunkDuration * audioBuffer.sampleRate)
        );
        const chunks: TranscriptionChunk[] = [];
        let cursor = startSample;
        let index = 0;
        while (cursor < endSample) {
          const nextCursor = Math.min(endSample, cursor + chunkSamples);
          const chunkBlob = encodeWavChunk(audioBuffer, cursor, nextCursor);
          const chunkStartOffset = cursor / audioBuffer.sampleRate;
          const chunkEndOffset = nextCursor / audioBuffer.sampleRate;
          index += 1;
          chunks.push({
            file: new File([chunkBlob], `${baseName}-chunk-${index}.wav`, {
              type: "audio/wav",
            }),
            chunkStartOffset,
            chunkEndOffset,
          });
          cursor = nextCursor;
        }
        return { chunks, assetDuration: resolvedAssetDuration, clipEndOffset };
      };
      for (const entry of sortedSources) {
        const blob = await fetch(entry.asset.url).then((res) => res.blob());
        const clipStartOffset = entry.clip.startOffset ?? 0;
        const speedSetting = clipSettings[entry.clip.id]?.speed ?? 1;
        const playbackRate = clamp(speedSetting, 0.1, 4);
        const assetDuration = getAssetDurationSeconds(entry.asset);
        const { chunks, clipEndOffset } = await buildTranscriptionChunks(
          blob,
          entry.asset.name || "transcription",
          clipStartOffset,
          entry.clip.duration,
          playbackRate,
          assetDuration,
          entry.asset.kind === "video"
        );
        const clipSegments: TimedSegment[] = [];
        for (const chunk of chunks) {
          let data = await requestTranscriptionWithRetry(
            chunk.file,
            primaryTranscription
          );
          let segments: TimedEntry[] = Array.isArray(data?.segments)
            ? (data.segments as TimedEntry[])
            : [];
          let words: TimedEntry[] = Array.isArray(data?.words)
            ? (data.words as TimedEntry[])
            : [];
          let normalizedSegments = normalizeSegmentEntries(segments).map(
            (segment) => ({
              ...segment,
              start: segment.start + chunk.chunkStartOffset,
              end: segment.end + chunk.chunkStartOffset,
            })
          );
          let normalizedWords = normalizeWordEntries(words).map((word) => ({
            ...word,
            start: word.start + chunk.chunkStartOffset,
            end: word.end + chunk.chunkStartOffset,
          }));
          if (normalizedWords.length === 0 && segments.length > 0) {
            const extractedWords = normalizeWordEntries(
              extractWordsFromSegments(segments)
            ).map((word) => ({
              ...word,
              start: word.start + chunk.chunkStartOffset,
              end: word.end + chunk.chunkStartOffset,
            }));
            if (extractedWords.length > 0) {
              normalizedWords = extractedWords;
            }
          }
          if (normalizedSegments.length === 0 && normalizedWords.length === 0) {
            data = await requestTranscriptionWithRetry(
              chunk.file,
              fallbackTranscription
            );
            segments = Array.isArray(data?.segments)
              ? (data.segments as TimedEntry[])
              : [];
            words = Array.isArray(data?.words)
              ? (data.words as TimedEntry[])
              : [];
            normalizedSegments = normalizeSegmentEntries(segments).map(
              (segment) => ({
                ...segment,
                start: segment.start + chunk.chunkStartOffset,
                end: segment.end + chunk.chunkStartOffset,
              })
            );
            normalizedWords = normalizeWordEntries(words).map((word) => ({
              ...word,
              start: word.start + chunk.chunkStartOffset,
              end: word.end + chunk.chunkStartOffset,
            }));
            if (normalizedWords.length === 0 && segments.length > 0) {
              const extractedWords = normalizeWordEntries(
                extractWordsFromSegments(segments)
              ).map((word) => ({
                ...word,
                start: word.start + chunk.chunkStartOffset,
                end: word.end + chunk.chunkStartOffset,
              }));
              if (extractedWords.length > 0) {
                normalizedWords = extractedWords;
              }
            }
          }
          if (normalizedSegments.length === 0 && normalizedWords.length === 0) {
            throw new Error(
              "Transcription did not return timestamps. Try another model or check API response."
            );
          }
          // Word-level timestamps are more precise for subtitle alignment
          // Prefer them over segment-level timestamps when available
          const wordSegments =
            normalizedWords.length > 0
              ? buildSubtitleSegmentsFromWords(normalizedWords)
              : [];
          const segmentSplits =
            normalizedSegments.length > 0
              ? splitSubtitleSegmentsByText(normalizedSegments)
              : [];
          // Priority: word-level > segment splits > raw segments
          // Word-level gives precise alignment with speech
          const computedSegments: TimedSegment[] =
            wordSegments.length > 0
              ? wordSegments
              : segmentSplits.length > 0
                ? segmentSplits
                : normalizedSegments;
          if (computedSegments.length === 0) {
            continue;
          }
          clipSegments.push(...computedSegments);
        }
        clipSegments.sort((a, b) => a.start - b.start);
        clipSegments.forEach((segment) => {
          const rawText = String(segment.text ?? "").trim();
          if (!rawText) {
            return;
          }
          const cleanedText = rawText
            .replace(/^(?:speaker|spk)\s*\d+[:\-]\s*/i, "")
            .trim();
          if (!cleanedText) {
            return;
          }
          const start = Math.max(segment.start, clipStartOffset);
          const end = Math.min(segment.end, clipEndOffset);
          if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
            return;
          }
          const timelineStart =
            entry.clip.startTime + (start - clipStartOffset) / playbackRate;
          const timelineEnd =
            entry.clip.startTime + (end - clipStartOffset) / playbackRate;
          const wordEntries = segment.words
            ? segment.words
                .map((word) => {
                  const rawStart = clamp(
                    Number(word.start),
                    clipStartOffset,
                    clipEndOffset
                  );
                  const rawEnd = clamp(
                    Number(word.end),
                    clipStartOffset,
                    clipEndOffset
                  );
                  if (
                    !Number.isFinite(rawStart) ||
                    !Number.isFinite(rawEnd) ||
                    rawEnd <= rawStart
                  ) {
                    return null;
                  }
                  return {
                    start:
                      entry.clip.startTime +
                      (rawStart - clipStartOffset) / playbackRate,
                    end:
                      entry.clip.startTime +
                      (rawEnd - clipStartOffset) / playbackRate,
                    word: word.word,
                    text: word.text,
                  };
                })
                .filter(
                  (
                    word
                  ): word is {
                    start: number;
                    end: number;
                    word: string | undefined;
                    text: string | undefined;
                  } => word !== null
                )
            : undefined;
          const asset = {
            ...createTextAsset("Subtitle"),
            duration: Math.max(0.01, timelineEnd - timelineStart),
          };
          const clip = createClip(asset.id, laneId, timelineStart, asset);
          nextAssets.push(asset);
          nextClips.push(clip);
          nextTextSettings[clip.id] = resolveSubtitleSettings(cleanedText);
          nextClipTransforms[clip.id] = subtitleTransform;
          nextSegments.push({
            id: crypto.randomUUID(),
            clipId: clip.id,
            text: cleanedText,
            startTime: timelineStart,
            endTime: timelineEnd,
            sourceClipId: entry.clip.id,
            words: wordEntries && wordEntries.length > 0 ? wordEntries : undefined,
          });
        });
      }
      setLanes(nextLanes);
      setAssets((prev) => [...nextAssets, ...prev]);
      setTimeline((prev) => {
        const filtered = prev.filter(
          (clip) => !existingSubtitleClipIds.has(clip.id)
        );
        return [...filtered, ...nextClips];
      });
      setTextSettings((prev) => {
        const next = { ...prev };
        existingSubtitleClipIds.forEach((clipId) => {
          delete next[clipId];
        });
        return { ...next, ...nextTextSettings };
      });
      setClipTransforms((prev) => {
        const next = { ...prev };
        existingSubtitleClipIds.forEach((clipId) => {
          delete next[clipId];
        });
        return { ...next, ...nextClipTransforms };
      });
      setSubtitleSegments(
        nextSegments.sort((a, b) => a.startTime - b.startTime)
      );
      setSubtitleActiveTab("style");
      setSubtitleStatus("ready");
    } catch (error) {
      setSubtitleStatus("error");
      setSubtitleError(
        error instanceof Error ? error.message : "Subtitle generation failed."
      );
    }
  }, [
    buildSubtitleSegmentsFromWords,
    clipSettings,
    subtitleLanguage,
    subtitleSegments,
    subtitleSource,
    subtitleSourceClips,
    subtitleStatus,
    resolveSubtitleSettings,
    splitSubtitleSegmentsByText,
    getAudioContext,
    pushHistory,
    stageAspectRatio,
  ]);

  const tickLabelStride = useMemo(() => {
    const minLabelPx = timelineDuration <= 60 ? 32 : 56;
    const pxPerTick = timelineScale * tickStep;
    if (pxPerTick <= 0) {
      return 1;
    }
    return Math.max(1, Math.ceil(minLabelPx / pxPerTick));
  }, [timelineDuration, timelineScale, tickStep]);

  const getLaneHeight = useCallback(
    (type: LaneType) =>
      type === "audio" ? audioLaneHeight : laneHeights[type],
    [audioLaneHeight]
  );

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
        height: getLaneHeight(lane.type),
      };
    });
  }, [getLaneHeight, lanes]);

  const lastAudioLaneId = useMemo(() => {
    for (let index = laneRows.length - 1; index >= 0; index -= 1) {
      if (laneRows[index].type === "audio") {
        return laneRows[index].id;
      }
    }
    return null;
  }, [laneRows]);

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
  const isResizingAudioLane = Boolean(audioLaneResizeState);

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

    const firstRate = getClipPlaybackRate(firstClip.id);
    const secondRate = getClipPlaybackRate(secondClip.id);
    if (Math.abs(firstRate - secondRate) > 0.001) {
      return null;
    }

    // Must be continuous in source media (second clip starts where first ends in source)
    const expectedOffset = firstClip.startOffset + firstClip.duration * firstRate;
    if (Math.abs(secondClip.startOffset - expectedOffset) > 0.01) {
      return null;
    }

    return { first: firstClip, second: secondClip };
  }, [
    clipSettings,
    getClipPlaybackRate,
    selectedClipIds,
    selectedClipIdsSet,
    timelineLayout,
  ]);

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

  const handleAudioLaneResizeStart = (
    event: PointerEvent<HTMLDivElement>
  ) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setAudioLaneResizeState({
      startY: event.clientY,
      startHeight: audioLaneHeight,
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
      const clipTime = resolveClipAssetTime(entry.clip, clampedTime);
        if (element) {
          element.currentTime = clipTime;
        }
        setSelectedClipId(entry.clip.id);
        setSelectedClipIds([entry.clip.id]);
        setActiveAssetId(entry.asset.id);
      }
      setCurrentTime(clampedTime);
    },
    [getClipAtTime, resolveClipAssetTime, timelineDuration]
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

  const getSubtitlePlaybackTime = useCallback(
    (time: number) => {
      const audioEntry = getClipAtTime(time, "audio");
      const visualEntry = getClipAtTime(time, "visual");
      const entry = audioEntry ?? visualEntry;
      if (!entry || entry.asset.kind === "image") {
        return time;
      }
      const element =
        entry.asset.kind === "audio"
          ? audioRefs.current.get(entry.clip.id)
          : visualRefs.current.get(entry.clip.id);
      if (!element || !Number.isFinite(element.currentTime)) {
        return time;
      }
      return resolveTimelineTimeFromAssetTime(entry.clip, element.currentTime);
    },
    [getClipAtTime, resolveTimelineTimeFromAssetTime]
  );

  // Main playback RAF loop - CRITICAL: do NOT include currentTime in dependencies
  // The loop uses playbackTimeRef internally and including currentTime would cause
  // the effect to restart every UI update, breaking smooth playback
  const playbackStartTimeRef = useRef(currentTime);
  
  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    let frameId = 0;
    let last = performance.now();
    // Capture the current time at the moment playback starts
    // This uses the ref which is kept in sync when not playing
    const startTime = playbackTimeRef.current;
    playbackStartTimeRef.current = startTime;
    playbackUiTickRef.current = last;
    
    const tick = (timestamp: number) => {
      const deltaSeconds = (timestamp - last) / 1000;
      last = timestamp;
      const rawNext = playbackTimeRef.current + deltaSeconds;
      const subtitleTime = getSubtitlePlaybackTime(rawNext);
      const drift = subtitleTime - rawNext;
      const next =
        Math.abs(drift) > 0.045
          ? subtitleTime
          : rawNext + drift * 0.2;
      if (next >= projectDuration) {
        playbackTimeRef.current = projectDuration;
        startTransition(() => {
          setCurrentTime(projectDuration);
        });
        setIsPlaying(false);
        // Final subtitle update at end
        updateSubtitleForTimeRef.current(projectDuration);
        return;
      }
      playbackTimeRef.current = next;
      
      // Update subtitles every frame for perfect sync
      updateSubtitleForTimeRef.current(next);
      
      const shouldUpdateUi =
        timestamp - playbackUiTickRef.current >=
        subtitleUiFrameSecondsRef.current * 1000;
      if (shouldUpdateUi) {
        playbackUiTickRef.current = timestamp;
        startTransition(() => {
          setCurrentTime(next);
        });
      }
      frameId = window.requestAnimationFrame(tick);
    };
    // Initial subtitle update
    updateSubtitleForTimeRef.current(getSubtitlePlaybackTime(startTime));
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [getSubtitlePlaybackTime, isPlaying, projectDuration, startTransition]);

  useEffect(() => {
    if (!isPlaying) {
      playbackTimeRef.current = currentTime;
    }
  }, [currentTime, isPlaying]);

  // Initial sync when playback starts - seeks all visible clips to correct position
  // Uses playbackTimeRef which is kept in sync with currentTime when not playing
  useEffect(() => {
    if (!isPlaying || wasPlayingRef.current) {
      wasPlayingRef.current = isPlaying;
      return;
    }
    // Use the ref value for time - it's always in sync
    const time = playbackTimeRef.current;
    visualStack.forEach((entry) => {
      if (entry.asset.kind !== "video") {
        return;
      }
      const element = visualRefs.current.get(entry.clip.id);
      if (!element) {
        return;
      }
      const clipTime = resolveClipAssetTime(entry.clip, time);
      element.currentTime = clipTime;
    });
    audioStack.forEach((entry) => {
      const element = audioRefs.current.get(entry.clip.id);
      if (!element) {
        return;
      }
      const clipTime = resolveClipAssetTime(entry.clip, time);
      element.currentTime = clipTime;
    });
    wasPlayingRef.current = true;
  }, [audioStack, isPlaying, resolveClipAssetTime, visualStack]);

  // Video playback control effect - handles play/pause state changes
  // Includes readyState check for blob URLs which need time to buffer
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
      element.playbackRate = clamp(settings.speed, 0.1, 4);
      element.muted = settings.muted;
      
      if (isPlaying) {
        if (element.paused) {
          // Check if video is ready to play (important for blob URLs)
          // readyState 3 = HAVE_FUTURE_DATA, 4 = HAVE_ENOUGH_DATA
          if (element.readyState >= 3) {
            const playPromise = element.play();
            if (playPromise) {
              playPromise.catch(() => setIsPlaying(false));
            }
          } else {
            // Video not ready - wait for canplay event
            const handleCanPlay = () => {
              element.removeEventListener('canplay', handleCanPlay);
              if (isPlaying && element.paused) {
                const playPromise = element.play();
                if (playPromise) {
                  playPromise.catch(() => {});
                }
              }
            };
            element.addEventListener('canplay', handleCanPlay, { once: true });
          }
        }
      } else {
        element.pause();
      }
    });
  }, [visualStack, isPlaying, clipSettings, fallbackVideoSettings]);

  // Track last volume set per clip to avoid redundant updates
  const lastVolumeRef = useRef<Map<string, number>>(new Map());
  
  // Video seeking effect - only runs when not playing or on specific updates
  // Separated from volume to reduce overhead during playback
  useEffect(() => {
    // Skip during playback unless there's a jump - video elements play on their own
    if (isPlaying && !timelineJumpRef.current) {
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
      
      const clipTime = resolveClipAssetTime(entry.clip, currentTime);
      
      if (Math.abs(element.currentTime - clipTime) > 0.05) {
        element.currentTime = clipTime;
      }
    });
    
    // Reset jump flag after processing
    if (timelineJumpRef.current) {
      timelineJumpRef.current = false;
    }
  }, [currentTime, isPlaying, resolveClipAssetTime, visualStack]);

  // Ref to track clips with active fades for RAF-based volume updates
  const activeFadeClipsRef = useRef<Set<string>>(new Set());
  
  // Check which clips have fades enabled
  useEffect(() => {
    const fadeClips = new Set<string>();
    visualStack.forEach((entry) => {
      if (entry.asset.kind !== "video") return;
      const settings = clipSettings[entry.clip.id] ?? fallbackVideoSettings;
      if (settings.fadeEnabled && (settings.fadeIn > 0 || settings.fadeOut > 0)) {
        fadeClips.add(entry.clip.id);
      }
    });
    activeFadeClipsRef.current = fadeClips;
  }, [visualStack, clipSettings, fallbackVideoSettings]);

  // Video volume effect - separate RAF loop for fade updates during playback
  // This avoids React effect overhead for smooth fades
  useEffect(() => {
    if (!isPlaying) {
      // When not playing, set volumes directly via effect
      visualStack.forEach((entry) => {
        if (entry.asset.kind !== "video") return;
        const element = visualRefs.current.get(entry.clip.id);
        if (!element) return;
        const settings = clipSettings[entry.clip.id] ?? fallbackVideoSettings;
        const targetVolume = settings.muted ? 0 : clamp(settings.volume / 100, 0, 1);
        if (Math.abs(element.volume - targetVolume) > 0.01) {
          element.volume = targetVolume;
        }
      });
      return;
    }
    
    // During playback, use RAF for smooth fade updates
    let frameId = 0;
    const hasFades = activeFadeClipsRef.current.size > 0;
    
    if (!hasFades) {
      // No fades - just set volumes once
      visualStack.forEach((entry) => {
        if (entry.asset.kind !== "video") return;
        const element = visualRefs.current.get(entry.clip.id);
        if (!element) return;
        const settings = clipSettingsRef.current[entry.clip.id] ?? fallbackVideoSettings;
        element.volume = settings.muted ? 0 : clamp(settings.volume / 100, 0, 1);
      });
      return;
    }
    
    // RAF loop for fade updates
    const updateVolumes = () => {
      const time = playbackTimeRef.current;
      visualStack.forEach((entry) => {
        if (entry.asset.kind !== "video") return;
        const element = visualRefs.current.get(entry.clip.id);
        if (!element) return;
        
        const settings = clipSettingsRef.current[entry.clip.id] ?? fallbackVideoSettings;
        const baseVolume = clamp(settings.volume / 100, 0, 1);
        
        let fadeGain = 1;
        if (settings.fadeEnabled) {
          const localTime = clamp(time - entry.clip.startTime, 0, entry.clip.duration);
          const fadeIn = settings.fadeIn > 0 ? settings.fadeIn : 0;
          const fadeOut = settings.fadeOut > 0 ? settings.fadeOut : 0;
          const fadeInGain = fadeIn > 0 ? clamp(localTime / fadeIn, 0, 1) : 1;
          const fadeOutGain = fadeOut > 0 ? clamp((entry.clip.duration - localTime) / fadeOut, 0, 1) : 1;
          fadeGain = Math.min(fadeInGain, fadeOutGain);
        }
        
        const targetVolume = settings.muted ? 0 : baseVolume * fadeGain;
        const lastVolume = lastVolumeRef.current.get(entry.clip.id) ?? -1;
        
        if (Math.abs(targetVolume - lastVolume) > 0.005) {
          element.volume = targetVolume;
          lastVolumeRef.current.set(entry.clip.id, targetVolume);
        }
      });
      frameId = requestAnimationFrame(updateVolumes);
    };
    
    frameId = requestAnimationFrame(updateVolumes);
    return () => cancelAnimationFrame(frameId);
  }, [visualStack, isPlaying, clipSettings, fallbackVideoSettings]);

  // Audio playback control effect - handles play/pause state changes
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
          const playPromise = element.play();
          if (playPromise) {
            playPromise.catch(() => setIsPlaying(false));
          }
        }
      } else {
        element.pause();
      }
    });
  }, [audioStack, isPlaying, clipSettings, fallbackVideoSettings]);

  // Audio seeking effect - only runs when not playing or on jumps
  // During playback, audio elements run on their own
  useEffect(() => {
    // Skip during playback unless there's a jump
    if (isPlaying && !timelineJumpRef.current) {
      return;
    }
    
    audioStack.forEach((entry) => {
      const element = audioRefs.current.get(entry.clip.id);
      if (!element) {
        return;
      }
      const clipTime = resolveClipAssetTime(entry.clip, currentTime);
      
      if (Math.abs(element.currentTime - clipTime) > 0.05) {
        element.currentTime = clipTime;
      }
    });
  }, [audioStack, currentTime, isPlaying, resolveClipAssetTime]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const buildAssetsFromFiles = async (files: File[]) => {
    const uploaded = await Promise.all(
      files.map(async (file) => {
        const kind = inferMediaKind(file);
        const uploadKind: "video" | "audio" | "image" =
          kind === "text" ? "video" : kind;
        const previewUrl = URL.createObjectURL(file);
        const meta = await getMediaMeta(kind, previewUrl);
        URL.revokeObjectURL(previewUrl);
        const resolvedAspectRatio =
          meta.aspectRatio ??
          (meta.width && meta.height ? meta.width / meta.height : undefined);
        const stored = await uploadAssetFile(file, {
          name: file.name || "Uploaded asset",
          kind: uploadKind,
          source: "upload",
          duration: meta.duration,
          width: meta.width,
          height: meta.height,
          aspectRatio: resolvedAspectRatio,
        });
        if (!stored) {
          return null;
        }
        const asset: MediaAsset = {
          id: stored.id,
          name: stored.name,
          kind,
          url: stored.url,
          size: stored.size,
          duration: stored.duration,
          width: stored.width,
          height: stored.height,
          aspectRatio: stored.aspectRatio,
          createdAt: stored.createdAt,
        };
        return asset;
      })
    );
    return uploaded.filter((item): item is MediaAsset => Boolean(item));
  };

  const resolveDropLaneId = (
    laneType: LaneType,
    offsetY: number,
    draftLanes: TimelineLane[]
  ) => {
    const rows = draftLanes.map((lane) => ({
      id: lane.id,
      type: lane.type,
      height: getLaneHeight(lane.type),
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
        const startTime = resolveSnappedStartTime(
          baseStartTime + index * snapInterval
        );
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

  const addToTimeline = useCallback((assetId: string) => {
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
  }, [pushHistory]);

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
      resolveSnappedStartTime(startTime),
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

  const applyStockAudioDuration = useCallback(
    (trackId: string, duration: number | null) => {
      stockDurationCacheRef.current.set(trackId, duration);
      if (duration == null) {
        return;
      }
      setStockMusic((prev) => {
        if (!prev.some((track) => track.id === trackId && track.duration == null)) {
          return prev;
        }
        return prev.map((track) =>
          track.id === trackId && track.duration == null
            ? { ...track, duration }
            : track
        );
      });
      setSoundFx((prev) => {
        if (!prev.some((track) => track.id === trackId && track.duration == null)) {
          return prev;
        }
        return prev.map((track) =>
          track.id === trackId && track.duration == null
            ? { ...track, duration }
            : track
        );
      });
    },
    []
  );

  const requestStockAudioDuration = useCallback(
    async (track: StockAudioTrack) => {
      if (track.duration != null) {
        return;
      }
      if (stockDurationCacheRef.current.has(track.id)) {
        const cached = stockDurationCacheRef.current.get(track.id) ?? null;
        applyStockAudioDuration(track.id, cached);
        return;
      }
      if (stockAudioMetaLoadingRef.current.has(track.id)) {
        return;
      }
      stockAudioMetaLoadingRef.current.add(track.id);
      try {
        const meta = await getMediaMeta("audio", track.url);
        const duration =
          meta.duration != null && Number.isFinite(meta.duration)
            ? Math.max(0, meta.duration)
            : null;
        applyStockAudioDuration(track.id, duration);
      } finally {
        stockAudioMetaLoadingRef.current.delete(track.id);
      }
    },
    [applyStockAudioDuration]
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
      audio.onloadedmetadata = () => {
        const duration = Number.isFinite(audio.duration)
          ? Math.max(0, audio.duration)
          : null;
        applyStockAudioDuration(track.id, duration);
      };
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
    [applyStockAudioDuration, previewTrackId]
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
      const libraryAsset = await createExternalAssetSafe({
        url: video.url,
        name: video.name,
        kind: "video",
        source: "stock",
        size: video.size,
        duration: resolvedDuration ?? undefined,
        width: resolvedWidth,
        height: resolvedHeight,
        aspectRatio,
      });
      const videoAsset: MediaAsset = {
        id: libraryAsset?.id ?? crypto.randomUUID(),
        name: video.name,
        kind: "video",
        url: libraryAsset?.url ?? video.url,
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

  const handleAddYoutubeVideo = useCallback(
    async ({
      url,
      startSeconds,
      endSeconds,
      location,
    }: {
      url: string;
      startSeconds?: number | null;
      endSeconds?: number | null;
      location?: string;
    }) => {
      const response = await fetch("/api/youtube-download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          location,
          format: "1080",
        }),
      });

      let payload: Record<string, unknown> | null = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to download video.";
        throw new Error(message);
      }

      const downloadUrl =
        typeof payload?.downloadUrl === "string" ? payload.downloadUrl : "";
      const assetUrl =
        typeof payload?.assetUrl === "string" && payload.assetUrl.length > 0
          ? payload.assetUrl
          : downloadUrl;
      if (!assetUrl) {
        throw new Error("No downloadable format found.");
      }
      const assetId =
        typeof payload?.assetId === "string" && payload.assetId.length > 0
          ? payload.assetId
          : null;

      const title =
        typeof payload?.title === "string" && payload.title.trim().length > 0
          ? payload.title.trim()
          : "YouTube video";
      const durationSeconds =
        typeof payload?.durationSeconds === "number" &&
        Number.isFinite(payload.durationSeconds)
          ? payload.durationSeconds
          : undefined;
      const width =
        typeof payload?.width === "number" && Number.isFinite(payload.width)
          ? payload.width
          : undefined;
      const height =
        typeof payload?.height === "number" && Number.isFinite(payload.height)
          ? payload.height
          : undefined;
      const size =
        typeof payload?.size === "number" && Number.isFinite(payload.size)
          ? payload.size
          : 0;

      const existing = assetId
        ? assetsRef.current.find((asset) => asset.id === assetId)
        : assetsRef.current.find(
            (asset) => asset.kind === "video" && asset.url === assetUrl
          );
      if (existing) {
        addToTimeline(existing.id);
        return;
      }

      setIsBackgroundSelected(false);
      pushHistory();
      const aspectRatio =
        width && height ? width / height : undefined;
      const videoAsset: MediaAsset = {
        id: assetId ?? crypto.randomUUID(),
        name: title,
        kind: "video",
        url: assetUrl,
        size,
        duration: durationSeconds ?? undefined,
        width,
        height,
        aspectRatio,
        createdAt: Date.now(),
      };
      const nextLanes = [...lanesRef.current];
      const laneId = createLaneId("video", nextLanes);
      const resolvedStartOffset =
        typeof startSeconds === "number" && Number.isFinite(startSeconds)
          ? Math.max(0, startSeconds)
          : 0;
      const resolvedEndSeconds =
        typeof endSeconds === "number" && Number.isFinite(endSeconds)
          ? Math.max(0, endSeconds)
          : null;
      const baseDuration = getAssetDurationSeconds(videoAsset);
      const adjustedStartOffset =
        resolvedStartOffset >= baseDuration ? 0 : resolvedStartOffset;
      let clipDuration = Math.max(0, baseDuration - adjustedStartOffset);
      if (
        resolvedEndSeconds != null &&
        resolvedEndSeconds > adjustedStartOffset
      ) {
        clipDuration = Math.min(
          clipDuration,
          resolvedEndSeconds - adjustedStartOffset
        );
      }
      if (clipDuration <= 0) {
        clipDuration = baseDuration;
      }
      const clip = {
        id: crypto.randomUUID(),
        assetId: videoAsset.id,
        duration: clipDuration,
        startOffset: adjustedStartOffset,
        startTime: 0,
        laneId,
      };
      setLanes(nextLanes);
      setAssets((prev) => [videoAsset, ...prev]);
      setTimeline((prev) => [...prev, clip]);
      setActiveAssetId(videoAsset.id);
    },
    [addToTimeline, pushHistory]
  );

  const handleAddTiktokVideo = useCallback(
    async ({
      url,
      startSeconds,
      endSeconds,
    }: {
      url: string;
      startSeconds?: number | null;
      endSeconds?: number | null;
    }) => {
      const response = await fetch("/api/tiktok-download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      let payload: Record<string, unknown> | null = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const message =
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to download video.";
        throw new Error(message);
      }

      const downloadUrl =
        typeof payload?.downloadUrl === "string" ? payload.downloadUrl : "";
      const assetUrl =
        typeof payload?.assetUrl === "string" && payload.assetUrl.length > 0
          ? payload.assetUrl
          : downloadUrl;
      if (!assetUrl) {
        throw new Error("No downloadable format found.");
      }
      const assetId =
        typeof payload?.assetId === "string" && payload.assetId.length > 0
          ? payload.assetId
          : null;

      const title =
        typeof payload?.title === "string" && payload.title.trim().length > 0
          ? payload.title.trim()
          : "TikTok video";
      const durationSeconds =
        typeof payload?.durationSeconds === "number" &&
        Number.isFinite(payload.durationSeconds)
          ? payload.durationSeconds
          : undefined;
      const width =
        typeof payload?.width === "number" && Number.isFinite(payload.width)
          ? payload.width
          : undefined;
      const height =
        typeof payload?.height === "number" && Number.isFinite(payload.height)
          ? payload.height
          : undefined;
      const size =
        typeof payload?.size === "number" && Number.isFinite(payload.size)
          ? payload.size
          : 0;

      const existing = assetId
        ? assetsRef.current.find((asset) => asset.id === assetId)
        : assetsRef.current.find(
            (asset) => asset.kind === "video" && asset.url === assetUrl
          );
      if (existing) {
        addToTimeline(existing.id);
        return;
      }

      setIsBackgroundSelected(false);
      pushHistory();
      const aspectRatio =
        width && height ? width / height : undefined;
      const videoAsset: MediaAsset = {
        id: assetId ?? crypto.randomUUID(),
        name: title,
        kind: "video",
        url: assetUrl,
        size,
        duration: durationSeconds ?? undefined,
        width,
        height,
        aspectRatio,
        createdAt: Date.now(),
      };
      const nextLanes = [...lanesRef.current];
      const laneId = createLaneId("video", nextLanes);
      const resolvedStartOffset =
        typeof startSeconds === "number" && Number.isFinite(startSeconds)
          ? Math.max(0, startSeconds)
          : 0;
      const resolvedEndSeconds =
        typeof endSeconds === "number" && Number.isFinite(endSeconds)
          ? Math.max(0, endSeconds)
          : null;
      const baseDuration = getAssetDurationSeconds(videoAsset);
      const adjustedStartOffset =
        resolvedStartOffset >= baseDuration ? 0 : resolvedStartOffset;
      let clipDuration = Math.max(0, baseDuration - adjustedStartOffset);
      if (
        resolvedEndSeconds != null &&
        resolvedEndSeconds > adjustedStartOffset
      ) {
        clipDuration = Math.min(
          clipDuration,
          resolvedEndSeconds - adjustedStartOffset
        );
      }
      if (clipDuration <= 0) {
        clipDuration = baseDuration;
      }
      const clip = {
        id: crypto.randomUUID(),
        assetId: videoAsset.id,
        duration: clipDuration,
        startOffset: adjustedStartOffset,
        startTime: 0,
        laneId,
      };
      setLanes(nextLanes);
      setAssets((prev) => [videoAsset, ...prev]);
      setTimeline((prev) => [...prev, clip]);
      setActiveAssetId(videoAsset.id);
    },
    [addToTimeline, pushHistory]
  );

  const handleAddExternalVideo = useCallback(
    async ({
      url,
      name,
      source = "external",
    }: {
      url: string;
      name?: string;
      source?: "external" | "autoclip" | "upload" | "stock" | "generated";
    }) => {
      if (!url) {
        return;
      }
      const existing = assetsRef.current.find(
        (asset) => asset.kind === "video" && asset.url === url
      );
      if (existing) {
        addToTimeline(existing.id);
        return;
      }
      const meta = await getMediaMeta("video", url);
      const durationSeconds =
        typeof meta.duration === "number" && Number.isFinite(meta.duration)
          ? meta.duration
          : undefined;
      const width =
        typeof meta.width === "number" && Number.isFinite(meta.width)
          ? meta.width
          : undefined;
      const height =
        typeof meta.height === "number" && Number.isFinite(meta.height)
          ? meta.height
          : undefined;
      setIsBackgroundSelected(false);
      pushHistory();
      const aspectRatio =
        width && height ? width / height : undefined;
      const libraryAsset = await createExternalAssetSafe({
        url,
        name: name?.trim() || "Imported video",
        kind: "video",
        source,
        duration: durationSeconds ?? undefined,
        width,
        height,
        aspectRatio,
      });
      const videoAsset: MediaAsset = {
        id: libraryAsset?.id ?? crypto.randomUUID(),
        name: name?.trim() || "Imported video",
        kind: "video",
        url: libraryAsset?.url ?? url,
        size: 0,
        duration: durationSeconds ?? undefined,
        width,
        height,
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

  useEffect(() => {
    if (!assetLibraryReady) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const storedList = window.localStorage.getItem("autoclip:assets");
    const storedSingle = window.localStorage.getItem("autoclip:asset");
    if (!storedList && !storedSingle) {
      return;
    }
    window.localStorage.removeItem("autoclip:assets");
    window.localStorage.removeItem("autoclip:asset");

    const parsePayload = (value: unknown) => {
      if (!value || typeof value !== "object") {
        return null;
      }
      const payload = value as {
        url?: string;
        name?: string;
        source?: "autoclip" | "external" | "upload" | "stock" | "generated";
      };
      const assetUrl =
        typeof payload.url === "string" ? payload.url : "";
      if (!assetUrl) {
        return null;
      }
      const source =
        payload.source === "autoclip" ||
        payload.source === "external" ||
        payload.source === "upload" ||
        payload.source === "stock" ||
        payload.source === "generated"
          ? payload.source
          : undefined;
      return {
        url: assetUrl,
        name:
          typeof payload.name === "string" && payload.name.trim().length > 0
            ? payload.name
            : "AutoClip Highlight",
        source,
      };
    };

    const assets: Array<{
      url: string;
      name: string;
      source?: "autoclip" | "external" | "upload" | "stock" | "generated";
    }> = [];
    if (storedList) {
      try {
        const parsed = JSON.parse(storedList);
        if (Array.isArray(parsed)) {
          parsed.forEach((item) => {
            const payload = parsePayload(item);
            if (payload) {
              assets.push(payload);
            }
          });
        }
      } catch {
        // Ignore parse errors.
      }
    }
    if (!assets.length && storedSingle) {
      try {
        const parsed = JSON.parse(storedSingle);
        const payload = parsePayload(parsed);
        if (payload) {
          assets.push(payload);
        }
      } catch {
        // Ignore parse errors.
      }
    }
    assets.forEach((payload) => {
      handleAddExternalVideo(payload).catch(() => {});
    });
  }, [assetLibraryReady, handleAddExternalVideo]);

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
      const libraryAsset = await createExternalAssetSafe({
        url: track.url,
        name: track.name,
        kind: "audio",
        source: "stock",
        size: track.size,
        duration: resolvedDuration ?? undefined,
      });
      const audioAsset: MediaAsset = {
        id: libraryAsset?.id ?? crypto.randomUUID(),
        name: track.name,
        kind: "audio",
        url: libraryAsset?.url ?? track.url,
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

  const createGifMediaAsset = useCallback(
    async (payload: GifDragPayload): Promise<MediaAsset> => {
      const aspectRatio =
        payload.width && payload.height
          ? payload.width / payload.height
          : undefined;
      const libraryAsset = await createExternalAssetSafe({
        url: payload.url,
        name: payload.title?.trim() || "GIF",
        kind: "image",
        source: "external",
        size: payload.size ?? 0,
        width: payload.width,
        height: payload.height,
        aspectRatio,
      });
      return {
        id: libraryAsset?.id ?? crypto.randomUUID(),
        name: payload.title?.trim() || "GIF",
        kind: "image",
        url: libraryAsset?.url ?? payload.url,
        size: payload.size ?? 0,
        width: payload.width,
        height: payload.height,
        aspectRatio,
        createdAt: Date.now(),
      };
    },
    []
  );

  const handleAddGif = useCallback(
    async (gif: IGif) => {
      const payload = buildGifPayload(gif);
      if (!payload) {
        return;
      }
      const existing = assetsRef.current.find(
        (asset) => asset.kind === "image" && asset.url === payload.url
      );
      if (existing) {
        addToTimeline(existing.id);
        return;
      }
      setIsBackgroundSelected(false);
      pushHistory();
      const gifAsset = await createGifMediaAsset(payload);
      const nextLanes = [...lanesRef.current];
      const laneId = createLaneId("video", nextLanes);
      const clip = createClip(gifAsset.id, laneId, 0, gifAsset);
      setLanes(nextLanes);
      setAssets((prev) => [gifAsset, ...prev]);
      setTimeline((prev) => [...prev, clip]);
      setActiveAssetId(gifAsset.id);
    },
    [addToTimeline, createClip, createGifMediaAsset, pushHistory]
  );

  const handleAddSticker = useCallback(
    async (sticker: IGif) => {
      const assetImage = resolveGiphyAssetImage(sticker);
      if (!assetImage) {
        return;
      }
      const existing = assetsRef.current.find(
        (asset) => asset.kind === "image" && asset.url === assetImage.url
      );
      if (existing) {
        addToTimeline(existing.id);
        return;
      }
      setIsBackgroundSelected(false);
      pushHistory();
      const name = sticker.title?.trim() || "Sticker";
      const aspectRatio =
        assetImage.width && assetImage.height
          ? assetImage.width / assetImage.height
          : undefined;
      const libraryAsset = await createExternalAssetSafe({
        url: assetImage.url,
        name,
        kind: "image",
        source: "external",
        size: assetImage.size,
        width: assetImage.width,
        height: assetImage.height,
        aspectRatio,
      });
      const stickerAsset: MediaAsset = {
        id: libraryAsset?.id ?? crypto.randomUUID(),
        name,
        kind: "image",
        url: libraryAsset?.url ?? assetImage.url,
        size: assetImage.size,
        width: assetImage.width,
        height: assetImage.height,
        aspectRatio,
        createdAt: Date.now(),
      };
      const nextLanes = [...lanesRef.current];
      const laneId = createLaneId("video", nextLanes);
      const clip = createClip(stickerAsset.id, laneId, 0, stickerAsset);
      setLanes(nextLanes);
      setAssets((prev) => [stickerAsset, ...prev]);
      setTimeline((prev) => [...prev, clip]);
      setActiveAssetId(stickerAsset.id);
    },
    [addToTimeline, createClip, pushHistory]
  );

  const handleGifTrendingRetry = useCallback(() => {
    setGifTrending([]);
    setGifTrendingError(null);
    setGifTrendingStatus("idle");
    setGifMemeResults([]);
    setGifMemeStatus("idle");
    setGifPreviewIndex(0);
  }, []);

  const handleStickerTrendingRetry = useCallback(() => {
    setStickerTrending([]);
    setStickerTrendingError(null);
    setStickerTrendingStatus("idle");
  }, []);

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

  const handleSoundFxRetry = useCallback(() => {
    setSoundFxStatus("idle");
    setSoundFxError(null);
    setSoundFx([]);
    setSoundFxReloadKey((prev) => prev + 1);
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
    const playbackRate = getClipPlaybackRate(clip.id);
    const leftClip: TimelineClip = {
      ...clip,
      duration: splitPoint,
    };
    const rightClip: TimelineClip = {
      ...clip,
      id: crypto.randomUUID(),
      duration: clip.duration - splitPoint,
      startOffset: clip.startOffset + splitPoint * playbackRate,
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

  const updateClipSettings = useCallback(
    (clipId: string, updater: (current: VideoClipSettings) => VideoClipSettings) => {
      pushHistoryThrottled();
      setClipSettings((prev) => {
        const current = prev[clipId] ?? createDefaultVideoSettings();
        const next = updater(current);
        return { ...prev, [clipId]: next };
      });
    },
    [pushHistoryThrottled]
  );

  const updateTextSettings = useCallback(
    (clipId: string, updater: (current: TextClipSettings) => TextClipSettings) => {
      pushHistoryThrottled();
      setTextSettings((prev) => {
        const current = prev[clipId] ?? createDefaultTextSettings();
        const next = updater(current);
        const isSubtitleClip = subtitleSegments.some(
          (segment) => segment.clipId === clipId
        );
        if (
          isSubtitleClip &&
          typeof next.text === "string" &&
          next.text !== current.text
        ) {
          setSubtitleSegments((segments) =>
            segments.map((segment) =>
              segment.clipId === clipId
                ? { ...segment, text: next.text, words: undefined }
                : segment
            )
          );
        }
        if (!isSubtitleClip || !subtitleMoveTogether) {
          return { ...prev, [clipId]: next };
        }
        const targetSegment = subtitleSegments.find(
          (segment) => segment.clipId === clipId
        );
        if (!targetSegment || detachedSubtitleIds.has(clipId)) {
          return { ...prev, [clipId]: next };
        }
        const targetSourceId = targetSegment.sourceClipId;
        const groupIds = subtitleSegments
          .filter((segment) => !detachedSubtitleIds.has(segment.clipId))
          .filter((segment) =>
            targetSourceId
              ? segment.sourceClipId === targetSourceId
              : segment.clipId === clipId
          )
          .map((segment) => segment.clipId);
        if (groupIds.length <= 1) {
          return { ...prev, [clipId]: next };
        }
        const nextState = { ...prev };
        groupIds.forEach((id) => {
          const existing = prev[id] ?? createDefaultTextSettings();
          if (id === clipId) {
            nextState[id] = {
              ...next,
              autoSize: false,
            };
            return;
          }
          nextState[id] = {
            ...existing,
            ...next,
            text: existing.text,
            autoSize: false,
          };
        });
        return nextState;
      });
    },
    [
      pushHistoryThrottled,
      subtitleMoveTogether,
      subtitleSegments,
      detachedSubtitleIds,
    ]
  );

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

  const handleDeleteSelected = useCallback(() => {
    if (!selectedClipId && selectedClipIds.length === 0) {
      return;
    }
    pushHistory();
    const baseIds =
      selectedClipIds.length > 0
        ? selectedClipIds
        : selectedClipId
          ? [selectedClipId]
          : [];
    if (baseIds.length === 0) {
      return;
    }
    const subtitleClipIdsToRemove = new Set<string>();
    const sourceIdsToRemove = new Set(baseIds);
    subtitleSegments.forEach((segment) => {
      if (segment.sourceClipId && sourceIdsToRemove.has(segment.sourceClipId)) {
        subtitleClipIdsToRemove.add(segment.clipId);
      }
      if (sourceIdsToRemove.has(segment.clipId)) {
        subtitleClipIdsToRemove.add(segment.clipId);
      }
    });
    const idsToRemove = Array.from(
      new Set([...baseIds, ...subtitleClipIdsToRemove])
    );
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
    setSubtitleSegments((prev) =>
      prev.filter((segment) => !subtitleClipIdsToRemove.has(segment.clipId))
    );
    setTextSettings((prev) => {
      const next = { ...prev };
      idsToRemove.forEach((id) => {
        delete next[id];
      });
      return next;
    });
    setClipTransforms((prev) => {
      const next = { ...prev };
      idsToRemove.forEach((id) => {
        delete next[id];
      });
      return next;
    });
    setDetachedSubtitleIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }
      const next = new Set(prev);
      idsToRemove.forEach((id) => next.delete(id));
      return next;
    });
  }, [pushHistory, selectedClipId, selectedClipIds, subtitleSegments]);

  const handleDeleteAsset = useCallback(
    (assetId: string) => {
      const asset = assetsRef.current.find((item) => item.id === assetId);
      if (!asset) {
        return;
      }
      pushHistory();
      const clipIdsForAsset = timeline
        .filter((clip) => clip.assetId === assetId)
        .map((clip) => clip.id);
      const subtitleClipIdsToRemove = new Set<string>();
      const sourceIdsToRemove = new Set(clipIdsForAsset);
      subtitleSegments.forEach((segment) => {
        if (segment.sourceClipId && sourceIdsToRemove.has(segment.sourceClipId)) {
          subtitleClipIdsToRemove.add(segment.clipId);
        }
        if (sourceIdsToRemove.has(segment.clipId)) {
          subtitleClipIdsToRemove.add(segment.clipId);
        }
      });
      const idsToRemove = new Set([
        ...clipIdsForAsset,
        ...subtitleClipIdsToRemove,
      ]);
      const nextTimeline = timeline.filter((clip) => !idsToRemove.has(clip.id));
      const nextAssets = assetsRef.current.filter(
        (item) => item.id !== assetId
      );
      const selectedIds =
        selectedClipIds.length > 0
          ? selectedClipIds
          : selectedClipId
            ? [selectedClipId]
            : [];
      const remainingSelection = selectedIds.filter(
        (id) => !idsToRemove.has(id)
      );
      const nextSelectedId =
        remainingSelection[0] ?? nextTimeline[0]?.id ?? null;
      const nextSelectedIds =
        remainingSelection.length > 0
          ? remainingSelection
          : nextSelectedId
            ? [nextSelectedId]
            : [];
      const nextActiveAssetId = nextSelectedId
        ? nextTimeline.find((clip) => clip.id === nextSelectedId)?.assetId ??
          null
        : activeAssetId === assetId
          ? nextAssets[0]?.id ?? null
          : activeAssetId;
      setTimeline(nextTimeline);
      setSelectedClipId(nextSelectedId);
      setSelectedClipIds(nextSelectedIds);
      setActiveAssetId(nextActiveAssetId);
      setSubtitleSegments((prev) =>
        prev.filter((segment) => !subtitleClipIdsToRemove.has(segment.clipId))
      );
      setTextSettings((prev) => {
        const next = { ...prev };
        idsToRemove.forEach((id) => {
          delete next[id];
        });
        return next;
      });
      setClipTransforms((prev) => {
        const next = { ...prev };
        idsToRemove.forEach((id) => {
          delete next[id];
        });
        return next;
      });
      setDetachedSubtitleIds((prev) => {
        if (prev.size === 0) {
          return prev;
        }
        const next = new Set(prev);
        idsToRemove.forEach((id) => next.delete(id));
        return next;
      });
      setAssets(nextAssets);
      if (projectBackgroundImage?.assetId === assetId) {
        setProjectBackgroundImage(null);
      }
      deleteAssetById(assetId).catch(() => {});
      if (asset.url.startsWith("blob:")) {
        URL.revokeObjectURL(asset.url);
      }
    },
    [
      activeAssetId,
      deleteAssetById,
      projectBackgroundImage?.assetId,
      pushHistory,
      selectedClipId,
      selectedClipIds,
      subtitleSegments,
      timeline,
    ]
  );

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

  const handleDetachAudio = useCallback(() => {
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
  }, [pushHistory, selectedVideoEntry, timelineLayout, updateClipSettings]);

  const handleReplaceVideo = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
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
      const playbackRate = getClipPlaybackRate(selectedVideoEntry.clip.id);
      const maxDuration =
        getAssetDurationSeconds(newAsset) / playbackRate;
      setTimeline((prev) =>
        prev.map((clip) => {
          if (clip.id !== selectedVideoEntry.clip.id) {
            return clip;
          }
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
    },
    [getClipPlaybackRate, pushHistory, selectedVideoEntry]
  );

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
      const playbackRate = getClipPlaybackRate(selectedEntry.clip.id);
      const maxDuration =
        getAssetMaxDurationSeconds(newAsset) / playbackRate;
      setTimeline((prev) =>
        prev.map((clip) => {
          if (clip.id !== selectedEntry.clip.id) {
            return clip;
          }
          // Keep the same duration, but cap it if new asset is shorter
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
    const playbackRate = getClipPlaybackRate(clip.id);
    const maxDuration = Math.max(
      0,
      (assetDuration - clip.startOffset) / playbackRate
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

  const handleStartTimeCommit = useCallback(
    (clip: TimelineClip, value: string) => {
      const nextStart = parseTimeInput(value);
      if (nextStart == null) {
        return;
      }
      pushHistory();
      const targetStart = Math.max(0, nextStart);
      const delta = targetStart - clip.startTime;
      const attachedSubtitleIds = subtitleSourceClipMap.get(clip.id);
      const attachedSet = attachedSubtitleIds
        ? new Set(attachedSubtitleIds)
        : null;
      setTimeline((prev) =>
        prev.map((item) => {
          if (item.id === clip.id) {
            return { ...item, startTime: targetStart };
          }
          if (
            attachedSet &&
            attachedSet.has(item.id) &&
            Math.abs(delta) >= timelineClipEpsilon
          ) {
            return { ...item, startTime: Math.max(0, item.startTime + delta) };
          }
          return item;
        })
      );
      if (subtitleClipIdSet.has(clip.id) && delta !== 0) {
        setSubtitleSegments((prev) =>
          prev.map((segment) => {
            if (segment.clipId !== clip.id) {
              return segment;
            }
            const nextWords = segment.words?.map((word) => {
              const start = Math.max(0, word.start + delta);
              const end = Math.max(0, word.end + delta);
              return {
                ...word,
                start,
                end: Math.max(start, end),
              };
            });
            return {
              ...segment,
              words: nextWords,
            };
          })
        );
      }
    },
    [pushHistory, subtitleClipIdSet, subtitleSourceClipMap]
  );

  const handleEndTimeCommit = useCallback(
    (clip: TimelineClip, value: string) => {
      const nextEnd = parseTimeInput(value);
      if (nextEnd == null) {
        return;
      }
      pushHistory();
      const asset = assetsRef.current.find((item) => item.id === clip.assetId);
      const assetDuration = getAssetMaxDurationSeconds(asset);
      const playbackRate = getClipPlaybackRate(clip.id);
      const maxDuration = Math.max(
        0,
        (assetDuration - clip.startOffset) / playbackRate
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
    },
    [getClipPlaybackRate, minClipDuration, pushHistory]
  );

  const handleSetStartAtPlayhead = useCallback(
    (clip: TimelineClip) => {
      const time = playbackTimeRef.current;
      const targetStart = Math.max(0, time);
      const delta = targetStart - clip.startTime;
      const attachedSubtitleIds = subtitleSourceClipMap.get(clip.id);
      const attachedSet = attachedSubtitleIds
        ? new Set(attachedSubtitleIds)
        : null;
      pushHistory();
      setTimeline((prev) =>
        prev.map((item) => {
          if (item.id === clip.id) {
            return { ...item, startTime: targetStart };
          }
          if (
            attachedSet &&
            attachedSet.has(item.id) &&
            Math.abs(delta) >= timelineClipEpsilon
          ) {
            return { ...item, startTime: Math.max(0, item.startTime + delta) };
          }
          return item;
        })
      );
    },
    [pushHistory, subtitleSourceClipMap]
  );

  const handleSetEndAtPlayhead = useCallback(
    (clip: TimelineClip) => {
      const time = playbackTimeRef.current;
      const asset = assetsRef.current.find((item) => item.id === clip.assetId);
      const assetDuration = getAssetMaxDurationSeconds(asset);
      const playbackRate = getClipPlaybackRate(clip.id);
      const maxDuration = Math.max(
        0,
        (assetDuration - clip.startOffset) / playbackRate
      );
      pushHistory();
      setTimeline((prev) =>
        prev.map((item) => {
          if (item.id !== clip.id) {
            return item;
          }
          const nextDuration = clamp(
            time - item.startTime,
            minClipDuration,
            maxDuration
          );
          return { ...item, duration: nextDuration };
        })
      );
    },
    [getClipPlaybackRate, minClipDuration, pushHistory]
  );

  // PERFORMANCE: Memoized video styles cache to avoid recalculating on every render
  const videoStylesCacheRef = useRef<Map<string, ReturnType<typeof computeVideoStyles>>>(new Map());
  
  const computeVideoStyles = useCallback((settings: VideoClipSettings) => {
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
  }, []);

  // Get video styles with caching - avoids recalculation during playback
  const getVideoStyles = useCallback((clipId: string, settings: VideoClipSettings) => {
    // Create a cache key from settings that affect visual output
    const cacheKey = `${clipId}:${settings.roundCorners}:${settings.cornerRadius}:${settings.cornerRadiusLinked}:${settings.brightness}:${settings.contrast}:${settings.exposure}:${settings.saturation}:${settings.hue}:${settings.blur}:${settings.opacity}:${settings.flipH}:${settings.flipV}:${settings.rotation}:${settings.noise}:${settings.vignette}`;
    
    const cached = videoStylesCacheRef.current.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    const styles = computeVideoStyles(settings);
    videoStylesCacheRef.current.set(cacheKey, styles);
    
    // Limit cache size to prevent memory leaks
    if (videoStylesCacheRef.current.size > 100) {
      const firstKey = videoStylesCacheRef.current.keys().next().value;
      if (firstKey) videoStylesCacheRef.current.delete(firstKey);
    }
    
    return styles;
  }, [computeVideoStyles]);

  const getSubtitleDragGroup = useCallback(
    (clipId: string) => {
      if (!subtitleMoveTogether) {
        return null;
      }
      const targetSegment = subtitleSegments.find(
        (segment) => segment.clipId === clipId
      );
      if (!targetSegment || detachedSubtitleIds.has(clipId)) {
        return null;
      }
      const targetSourceId = targetSegment.sourceClipId;
      const groupTransforms = new Map<string, ClipTransform>();
      subtitleSegments.forEach((segment) => {
        if (detachedSubtitleIds.has(segment.clipId)) {
          return;
        }
        if (targetSourceId) {
          if (segment.sourceClipId !== targetSourceId) {
            return;
          }
        } else if (segment.clipId !== clipId) {
          return;
        }
        const segmentEntry = timelineLayout.find(
          (item) => item.clip.id === segment.clipId
        );
        if (!segmentEntry) {
          return;
        }
        groupTransforms.set(
          segment.clipId,
          ensureClipTransform(segment.clipId, segmentEntry.asset)
        );
      });
      return groupTransforms.size > 0 ? groupTransforms : null;
    },
    [
      subtitleMoveTogether,
      subtitleSegments,
      detachedSubtitleIds,
      timelineLayout,
      ensureClipTransform,
    ]
  );

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
    const isSubtitleClip =
      entry.asset.kind === "text" && subtitleClipIdSet.has(entry.clip.id);
    subtitleGroupTransformsRef.current = isSubtitleClip
      ? getSubtitleDragGroup(entry.clip.id)
      : null;
    setDragTransformState({
      clipId: entry.clip.id,
      startX: event.clientX,
      startY: event.clientY,
      startRect,
    });
  };

  const handleSubtitleOverlayPointerDown = (
    event: PointerEvent<HTMLDivElement>
  ) => {
    if (event.button !== 0) {
      return;
    }
    const overlay = subtitleOverlayRef.current;
    const clipId = overlay?.dataset.clipId ?? lastRenderedSubtitleIdRef.current;
    if (!clipId) {
      return;
    }
    const entry = timelineLayoutMap.get(clipId);
    if (!entry) {
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
    setActiveTool("subtitles");
    subtitleGroupTransformsRef.current = getSubtitleDragGroup(entry.clip.id);
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
      const isSubtitleClip = subtitleClipIdSet.has(entry.clip.id);
      if (isSubtitleClip) {
        const group = getSubtitleDragGroup(entry.clip.id);
        subtitleResizeGroupTransformsRef.current = group;
        if (group) {
          const fontMap = new Map<string, number>();
          group.forEach((_transform, clipId) => {
            const groupSettings =
              textSettingsRef.current[clipId] ?? fallbackTextSettings;
            fontMap.set(clipId, groupSettings.fontSize);
          });
          subtitleResizeFontMapRef.current = fontMap;
        } else {
          subtitleResizeFontMapRef.current = null;
        }
      } else {
        subtitleResizeGroupTransformsRef.current = null;
        subtitleResizeFontMapRef.current = null;
      }
    } else {
      resizeTextFontRef.current = null;
      subtitleResizeGroupTransformsRef.current = null;
      subtitleResizeFontMapRef.current = null;
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
    const isSubtitleClip =
      entry.asset.kind === "text" && subtitleClipIdSet.has(entry.clip.id);
    subtitleRotateGroupTransformsRef.current = isSubtitleClip
      ? getSubtitleDragGroup(entry.clip.id)
      : null;
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
          const playbackRate = getClipPlaybackRate(clip.id);
          if (trimState.edge === "end") {
            const nextDuration = clamp(
              trimState.startDuration + deltaSeconds,
              minClipDuration,
              (assetDuration - trimState.startOffset) / playbackRate
            );
            return { ...clip, duration: nextDuration };
          }
          const nextStartTime = clamp(
            trimState.startTime + deltaSeconds,
            0,
            trimState.startTime + trimState.startDuration - minClipDuration
          );
          const appliedDelta = nextStartTime - trimState.startTime;
          const maxStartOffset = Math.max(
            0,
            assetDuration - minClipDuration * playbackRate
          );
          const nextStartOffset = clamp(
            trimState.startOffset + appliedDelta * playbackRate,
            0,
            maxStartOffset
          );
          const maxDuration =
            (assetDuration - nextStartOffset) / playbackRate;
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
  }, [getClipPlaybackRate, minClipDuration, pushHistory, timelineScale, trimState]);

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
    if (!audioLaneResizeState) {
      return;
    }
    const handleMove = (event: globalThis.PointerEvent) => {
      const delta = event.clientY - audioLaneResizeState.startY;
      const nextHeight = clamp(
        audioLaneResizeState.startHeight + delta,
        audioLaneMinHeight,
        audioLaneMaxHeight
      );
      setAudioLaneHeight(nextHeight);
    };
    const handleUp = () => setAudioLaneResizeState(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [audioLaneResizeState]);

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
      const attachedSubtitleIds = subtitleSourceClipMap.get(dragged.id);
      setTimeline((prev) => {
        const current = prev.find((clip) => clip.id === dragged.id);
        const currentStart = current?.startTime ?? dragged.startTime;
        const delta = liveTime - currentStart;
        const shouldShiftSubtitles =
          attachedSubtitleIds && attachedSubtitleIds.length > 0;
        const attachedSet = shouldShiftSubtitles
          ? new Set(attachedSubtitleIds)
          : null;
        return prev.map((clip) => {
          if (clip.id === dragged.id) {
            return {
              ...clip,
              startTime: liveTime,
              laneId: targetLaneId,
            };
          }
          if (
            attachedSet &&
            attachedSet.has(clip.id) &&
            Math.abs(delta) >= timelineClipEpsilon
          ) {
            return {
              ...clip,
              startTime: Math.max(0, clip.startTime + delta),
            };
          }
          return clip;
        });
      });
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
        const sourceDeltas = new Map<string, number>();
        updatedStarts.forEach((nextStart, clipId) => {
          if (!subtitleSourceClipMap.has(clipId)) {
            return;
          }
          const original = prev.find((clip) => clip.id === clipId);
          if (!original) {
            return;
          }
          const delta = nextStart - original.startTime;
          if (Math.abs(delta) < timelineClipEpsilon) {
            return;
          }
          sourceDeltas.set(clipId, delta);
        });
        const subtitleDeltas = new Map<string, number>();
        if (sourceDeltas.size > 0) {
          sourceDeltas.forEach((delta, sourceId) => {
            const attached = subtitleSourceClipMap.get(sourceId);
            if (!attached || attached.length === 0) {
              return;
            }
            attached.forEach((subtitleId) => {
              subtitleDeltas.set(subtitleId, delta);
            });
          });
        }
        return prev.map((clip) => {
          const nextStart = updatedStarts.get(clip.id);
          if (nextStart !== undefined) {
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
          }
          const subtitleDelta = subtitleDeltas.get(clip.id);
          if (
            subtitleDelta !== undefined &&
            Math.abs(subtitleDelta) >= timelineClipEpsilon
          ) {
            return {
              ...clip,
              startTime: Math.max(0, clip.startTime + subtitleDelta),
            };
          }
          return clip;
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
    subtitleSourceClipMap,
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
      const minSize = getClipMinSize(dragTransformState.clipId);
      const allowOverflow =
        clipAssetKindMap.get(dragTransformState.clipId) !== "text";
      const clampOptions = allowOverflow
        ? {
            allowOverflow: true,
            maxScale: clipTransformMaxScale,
            minVisiblePx: minSize,
          }
        : undefined;
      const next = clampTransformToStage(
        {
          ...draftRect,
          x: snappedX.value / rect.width,
          y: snappedY.value / rect.height,
        },
        { width: rect.width, height: rect.height },
        minSize,
        clampOptions
      );
      const groupTransforms = subtitleGroupTransformsRef.current;
      const isSubtitleGroupDrag =
        groupTransforms &&
        groupTransforms.has(dragTransformState.clipId);
      if (isSubtitleGroupDrag && groupTransforms) {
        const deltaX = next.x - dragTransformState.startRect.x;
        const deltaY = next.y - dragTransformState.startRect.y;
        setClipTransforms((prev) => {
          const nextTransforms = { ...prev };
          groupTransforms.forEach((startTransform, clipId) => {
            const draftGroupRect = {
              ...startTransform,
              x: startTransform.x + deltaX,
              y: startTransform.y + deltaY,
            };
            const groupMinSize = getClipMinSize(clipId);
            const groupAllowOverflow =
              clipAssetKindMap.get(clipId) !== "text";
            const groupClampOptions = groupAllowOverflow
              ? {
                  allowOverflow: true,
                  maxScale: clipTransformMaxScale,
                  minVisiblePx: groupMinSize,
                }
              : undefined;
            const clamped = clampTransformToStage(
              draftGroupRect,
              { width: rect.width, height: rect.height },
              groupMinSize,
              groupClampOptions
            );
            clipTransformTouchedRef.current.add(clipId);
            nextTransforms[clipId] = clamped;
          });
          return nextTransforms;
        });
      } else {
        clipTransformTouchedRef.current.add(dragTransformState.clipId);
        setClipTransforms((prev) => ({
          ...prev,
          [dragTransformState.clipId]: next,
        }));
      }
    };
    const handleUp = () => {
      setDragTransformState(null);
      setSnapGuides(null);
      dragTransformHistoryRef.current = false;
      subtitleGroupTransformsRef.current = null;
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
    clipAssetKindMap,
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

      const minSize = getClipMinSize(resizeTransformState.clipId);
      const clampOptions = !isTextClip
        ? {
            allowOverflow: true,
            maxScale: clipTransformMaxScale,
            minVisiblePx: minSize,
          }
        : undefined;
      const clamped = clampTransformToStage(
        next,
        { width: rect.width, height: rect.height },
        minSize,
        clampOptions
      );
      const resizeGroupTransforms = subtitleResizeGroupTransformsRef.current;
      const isSubtitleGroupResize =
        resizeGroupTransforms &&
        resizeGroupTransforms.has(resizeTransformState.clipId);
      if (isTextClip && hasHorizontal && hasVertical) {
        const resizeFont = resizeTextFontRef.current;
        if (resizeFont && resizeFont.clipId === resizeTransformState.clipId) {
          const startWidth = resizeTransformState.startRect.width;
          const startHeight = resizeTransformState.startRect.height;
          const widthRatio = startWidth > 0 ? clamped.width / startWidth : 1;
          const heightRatio = startHeight > 0 ? clamped.height / startHeight : 1;
          const scale = Math.sqrt(widthRatio * heightRatio);
          if (Number.isFinite(scale) && scale > 0) {
            const groupFonts = subtitleResizeFontMapRef.current;
            if (isSubtitleGroupResize && groupFonts) {
              setTextSettings((prev) => {
                let changed = false;
                const nextState = { ...prev };
                groupFonts.forEach((baseSize, clipId) => {
                  const current = prev[clipId];
                  if (!current) {
                    return;
                  }
                  const nextFontSize = clamp(
                    baseSize * scale,
                    textResizeMinFontSize,
                    textResizeMaxFontSize
                  );
                  if (Math.abs(current.fontSize - nextFontSize) < 0.1) {
                    return;
                  }
                  nextState[clipId] = {
                    ...current,
                    fontSize: nextFontSize,
                  };
                  changed = true;
                });
                return changed ? nextState : prev;
              });
              const activeBase =
                groupFonts.get(resizeTransformState.clipId) ??
                resizeFont.fontSize;
              const activeFontSize = clamp(
                activeBase * scale,
                textResizeMinFontSize,
                textResizeMaxFontSize
              );
              if (selectedTextEntry?.clip.id === resizeTransformState.clipId) {
                setTextPanelFontSizeDisplay((prev) =>
                  Math.abs(prev - activeFontSize) < 0.1 ? prev : activeFontSize
                );
              }
            } else {
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
      }
      if (isTextClip) {
        resizeTextRectRef.current = clamped;
      }
      if (isSubtitleGroupResize && resizeGroupTransforms) {
        const deltaX = clamped.x - resizeTransformState.startRect.x;
        const deltaY = clamped.y - resizeTransformState.startRect.y;
        const deltaWidth = clamped.width - resizeTransformState.startRect.width;
        const deltaHeight = clamped.height - resizeTransformState.startRect.height;
        setClipTransforms((prev) => {
          const nextTransforms = { ...prev };
          resizeGroupTransforms.forEach((startTransform, clipId) => {
            const draftGroupRect = {
              ...startTransform,
              x: startTransform.x + deltaX,
              y: startTransform.y + deltaY,
              width: startTransform.width + deltaWidth,
              height: startTransform.height + deltaHeight,
            };
            const groupMinSize = getClipMinSize(clipId);
            const groupAllowOverflow =
              clipAssetKindMap.get(clipId) !== "text";
            const groupClampOptions = groupAllowOverflow
              ? {
                  allowOverflow: true,
                  maxScale: clipTransformMaxScale,
                  minVisiblePx: groupMinSize,
                }
              : undefined;
            const groupClamped = clampTransformToStage(
              draftGroupRect,
              { width: rect.width, height: rect.height },
              groupMinSize,
              groupClampOptions
            );
            clipTransformTouchedRef.current.add(clipId);
            nextTransforms[clipId] = groupClamped;
          });
          return nextTransforms;
        });
      } else {
        clipTransformTouchedRef.current.add(resizeTransformState.clipId);
        setClipTransforms((prev) => ({
          ...prev,
          [resizeTransformState.clipId]: clamped,
        }));
      }
    };
    const handleUp = () => {
      const clipId = resizeTransformState.clipId;
      const isTextClip = clipAssetKindMap.get(clipId) === "text";
      const isSubtitleClip = subtitleClipIdSet.has(clipId);
      if (isTextClip && !isSubtitleClip) {
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
      subtitleResizeGroupTransformsRef.current = null;
      subtitleResizeFontMapRef.current = null;
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
    subtitleClipIdSet,
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
      const rotateGroupTransforms = subtitleRotateGroupTransformsRef.current;
      const isSubtitleGroupRotate =
        rotateGroupTransforms &&
        rotateGroupTransforms.has(rotateTransformState.clipId);
      if (isSubtitleGroupRotate && rotateGroupTransforms) {
        const delta = newRotation - rotateTransformState.startRotation;
        setClipTransforms((prev) => {
          const nextTransforms = { ...prev };
          rotateGroupTransforms.forEach((startTransform, clipId) => {
            const current = prev[clipId] ?? startTransform;
            nextTransforms[clipId] = {
              ...current,
              rotation: (startTransform.rotation ?? 0) + delta,
            };
            clipTransformTouchedRef.current.add(clipId);
          });
          return nextTransforms;
        });
      } else {
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
      }
    };
    const handleUp = () => {
      setRotateTransformState(null);
      rotateTransformHistoryRef.current = false;
      subtitleRotateGroupTransformsRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [rotateTransformState, pushHistory]);

  const handleAssetDragStart = useCallback(
    (event: DragEvent<HTMLElement>, assetId: string) => {
      event.dataTransfer.setData("text/plain", assetId);
      event.dataTransfer.effectAllowed = "copy";
    },
    []
  );

  const parseGifDragPayload = (raw: string): GifDragPayload | null => {
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as {
        payload?: Partial<GifDragPayload>;
      } & Partial<GifDragPayload>;
      const payload = parsed.payload ?? parsed;
      if (!payload || typeof payload.url !== "string") {
        return null;
      }
      return {
        url: payload.url,
        title: typeof payload.title === "string" ? payload.title : undefined,
        width:
          typeof payload.width === "number" && Number.isFinite(payload.width)
            ? payload.width
            : undefined,
        height:
          typeof payload.height === "number" && Number.isFinite(payload.height)
            ? payload.height
            : undefined,
        size:
          typeof payload.size === "number" && Number.isFinite(payload.size)
            ? payload.size
            : undefined,
      };
    } catch {
      return null;
    }
  };

  const handleGifDragStart = useCallback(
    (event: DragEvent<HTMLElement>, gif: IGif) => {
      const payload = buildGifPayload(gif);
      if (!payload) {
        return;
      }
      const encoded = JSON.stringify(payload);
      event.dataTransfer.setData(gifDragType, encoded);
      event.dataTransfer.setData("text/plain", encoded);
      event.dataTransfer.effectAllowed = "copy";
    },
    [gifDragType]
  );

  const addAssetToTimelineFromDrop = (
    asset: MediaAsset,
    event: DragEvent<HTMLDivElement>
  ) => {
    const track = timelineTrackRef.current;
    if (!track) {
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
    addClipAtPosition(asset.id, laneId, startTime, asset);
  };

  const handleCanvasDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files ?? []);
    if (droppedFiles.length > 0) {
      setDragOverCanvas(false);
      await handleDroppedFiles(droppedFiles, { target: "canvas" });
      return;
    }
    const gifPayload =
      parseGifDragPayload(event.dataTransfer.getData(gifDragType)) ??
      parseGifDragPayload(event.dataTransfer.getData("text/plain"));
    if (gifPayload) {
      const existing = assetsRef.current.find(
        (asset) => asset.kind === "image" && asset.url === gifPayload.url
      );
      if (existing) {
        addToTimeline(existing.id);
        setDragOverCanvas(false);
        return;
      }
      setIsBackgroundSelected(false);
      pushHistory();
      const gifAsset = await createGifMediaAsset(gifPayload);
      const nextLanes = [...lanesRef.current];
      const laneId = createLaneId("video", nextLanes);
      const clip = createClip(gifAsset.id, laneId, 0, gifAsset);
      setLanes(nextLanes);
      setAssets((prev) => [gifAsset, ...prev]);
      setTimeline((prev) => [...prev, clip]);
      setActiveAssetId(gifAsset.id);
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
      setDragOverTimeline(false);
      await handleDroppedFiles(droppedFiles, { target: "timeline", event });
      return;
    }
    const gifPayload =
      parseGifDragPayload(event.dataTransfer.getData(gifDragType)) ??
      parseGifDragPayload(event.dataTransfer.getData("text/plain"));
    if (gifPayload) {
      const existing = assetsRef.current.find(
        (asset) => asset.kind === "image" && asset.url === gifPayload.url
      );
      const gifAsset = existing ?? (await createGifMediaAsset(gifPayload));
      if (!existing) {
        setAssets((prev) => [gifAsset, ...prev]);
      }
      addAssetToTimelineFromDrop(gifAsset, event);
      setDragOverTimeline(false);
      return;
    }
    const assetId = event.dataTransfer.getData("text/plain");
    if (assetId) {
      const assetExists = assetsRef.current.some(
        (asset) => asset.id === assetId
      );
      if (assetExists) {
        const asset = assetsRef.current.find((item) => item.id === assetId);
        if (!asset) {
          return;
        }
        addAssetToTimelineFromDrop(asset, event);
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

  const sidebarProps = {
    activeAssetId,
    activeTool,
    activeToolLabel,
    contentAspectRatio,
    contentTimelineTotal,
    addTextClip,
    addToTimeline,
    assetFilter,
    assetSearch,
    expandedTextGroupId,
    fallbackTextSettings,
    filteredAssets,
    filteredStockVideos,
    gifGridError,
    gifGridItems,
    gifGridStatus,
    gifPreviewCount,
    gifPreviewItems,
    gifSearch,
    gifTrendingError,
    gifTrendingStatus,
    groupedSoundFx,
    groupedStockMusic,
    groupedStockVideos,
    handleAddGif,
    handleAddSticker,
    handleAddStockAudio,
    handleAddStockVideo,
    handleAddYoutubeVideo,
    handleAddTiktokVideo,
    handleAssetDragStart,
    handleGifDragStart,
    handleDeleteSelected,
    handleDeleteAsset,
    handleDetachAudio,
    handleEndTimeCommit,
    handleGifTrendingRetry,
    handleReplaceVideo,
    handleSetEndAtPlayhead,
    handleSetStartAtPlayhead,
    handleStartTimeCommit,
    handleStickerTrendingRetry,
    handleSoundFxRetry,
    handleStockMusicRetry,
    handleStockPreviewToggle,
    handleStockVideoPreviewStart,
    handleStockVideoPreviewStop,
    handleStockVideoRetry,
    handleTextPresetSelect,
    handleTextStylePresetSelect,
    handleUploadClick,
    hasGiphy,
    hasMoreSoundFxTags,
    hasMoreStockTags,
    hasMoreStockVideoTags,
    hasMoreStockVideos,
    hasSupabase,
    isAssetLibraryExpanded,
    isBackgroundSelected,
    isGifLibraryExpanded,
    isPreviewPlaying,
    isStickerLibraryExpanded,
    isStockVideoExpanded,
    previewStockVideoCount,
    previewStockVideos,
    previewTrackId,
    registerStockVideoPreview,
    replaceInputRef,
    requestStockAudioDuration,
    requestStockVideoMeta,
    selectedAudioEntry,
    selectedAudioSettings,
    selectedClipId,
    selectedTextEntry,
    selectedVideoEntry,
    selectedVideoSettings,
    setActiveCanvasClipId,
    setAssetFilter,
    setAssetSearch,
    setActiveTool,
    setExpandedTextGroupId,
    setGifSearch,
    setIsAssetLibraryExpanded,
    setIsGifLibraryExpanded,
    setIsStickerLibraryExpanded,
    setIsStockVideoExpanded,
    setSelectedClipId,
    setSelectedClipIds,
    setShowAllSoundFxTags,
    setShowAllStockTags,
    setShowAllStockVideoTags,
    setStickerSearch,
    setSoundFxCategory,
    setSoundFxSearch,
    setStockCategory,
    setStockSearch,
    setStockVideoCategory,
    setStockVideoOrientation,
    setStockVideoSearch,
    setSubtitleActiveTab,
    setSubtitleLanguage,
    setSubtitleSource,
    setSubtitleStyleFilter,
    setProjectBackgroundMode,
    setProjectDurationMode,
    setProjectDurationSeconds,
    setProjectSizeId,
    handleProjectBackgroundImageChange,
    handleProjectBackgroundImageClear,
    setTextPanelAlign,
    setTextPanelBackgroundColor,
    setTextPanelBackgroundEnabled,
    setTextPanelBackgroundStyle,
    setTextPanelBold,
    setTextPanelColor,
    setTextPanelDraft,
    setTextPanelEnd,
    setTextPanelFontFamily,
    setTextPanelFontSize,
    setTextPanelFontSizeDisplay,
    setTextPanelItalic,
    setTextPanelLetterSpacing,
    setTextPanelLineHeight,
    setTextPanelOutlineColor,
    setTextPanelOutlineEnabled,
    setTextPanelOutlineWidth,
    setTextPanelPreset,
    setTextPanelShadowAdvancedOpen,
    setTextPanelShadowBlur,
    setTextPanelShadowColor,
    setTextPanelShadowEnabled,
    setTextPanelShadowOpacity,
    setTextPanelSpacingOpen,
    setTextPanelStart,
    setTextPanelStylePresetId,
    setTextPanelStylesOpen,
    setTextPanelTag,
    setTextPanelView,
    setVideoBackground,
    setVideoPanelView,
    showAllSoundFxTags,
    showAllStockTags,
    showAllStockVideoTags,
    showAudioPanel,
    showVideoPanel,
    stickerGridError,
    stickerGridItems,
    stickerGridStatus,
    stickerPreviewItems,
    stickerSearch,
    stickerTrendingError,
    stickerTrendingStatus,
    soundFxCategory,
    soundFxError,
    soundFxSearch,
    soundFxStatus,
    stockCategory,
    stockMusicError,
    stockMusicStatus,
    stockSearch,
    stockVideoCategory,
    stockVideoError,
    stockVideoOrientation,
    stockVideoSearch,
    stockVideoStatus,
    subtitleActiveTab,
    subtitleError,
    subtitleLanguage,
    subtitleLanguageOptions: subtitleLanguages,
    subtitleSegments: subtitleSegmentsWithClipTimes,
    subtitleSource,
    subtitleSourceOptions,
    subtitleStatus,
    subtitleStyleFilter,
    subtitleStyleId,
    subtitleStylePresets: resolvedSubtitleStylePresets,
    detachedSubtitleIds,
    subtitleMoveTogether,
    projectAspectRatio,
    projectBackgroundImage,
    projectBackgroundMode,
    projectDurationMode,
    projectDurationSeconds,
    projectSizeId,
    projectSizeOptions,
    applySubtitleStyle,
    handleGenerateSubtitles,
    handleSubtitleAddLine,
    handleSubtitlePreview,
    handleSubtitleDelete,
    handleSubtitleDeleteAll,
    handleSubtitleDetachToggle,
    handleSubtitleShiftAll,
    handleSubtitleStyleUpdate,
    handleSubtitleTextUpdate,
    setSubtitleMoveTogether,
    textFontSizeDisplay,
    textFontSizeOptions,
    textPanelAlign,
    textPanelBackgroundColor,
    textPanelBackgroundEnabled,
    textPanelBackgroundStyle,
    textPanelBold,
    textPanelColor,
    textPanelDraft,
    textPanelEnd,
    textPanelFontFamily,
    textPanelFontSize,
    textPanelItalic,
    textPanelLetterSpacing,
    textPanelLineHeight,
    textPanelOutlineColor,
    textPanelOutlineEnabled,
    textPanelOutlineWidth,
    textPanelPreset,
    textPanelShadowAdvancedOpen,
    textPanelShadowBlur,
    textPanelShadowColor,
    textPanelShadowEnabled,
    textPanelShadowOpacity,
    textPanelSpacingOpen,
    textPanelStart,
    textPanelStylePresetId,
    textPanelStylesOpen,
    textPanelTag,
    textPanelTextAreaRef,
    textPanelView,
    textPresetPreviewCount,
    updateClipSettings,
    updateTextSettings,
    uploading,
    videoBackground,
    videoPanelView,
    viewAllAssets,
    visibleSoundFxTags,
    visibleStockTags,
    visibleStockVideoTags,
    visibleTextPresetGroups,
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
          data-export-stage
          className={`relative overflow-visible ${dragOverCanvas ? "ring-2 ring-[#335CFF]" : ""
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
          <div className="relative flex h-full w-full items-center justify-center">
            <div
              className="relative flex h-full w-full items-center justify-center overflow-hidden"
              style={isExportMode ? { backgroundColor: canvasBackground } : undefined}
            >
              {!isExportMode && (
                <div
                  className="pointer-events-none absolute inset-0 border border-gray-200 shadow-sm"
                  style={{ backgroundColor: "#f2f3fa" }}
                />
              )}
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
                    backgroundImage:
                      projectBackgroundMode === "image" &&
                      projectBackgroundImage?.url
                        ? `url(${projectBackgroundImage.url})`
                        : undefined,
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "cover",
                    zIndex: 1,
                  }}
                />
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
                      {showUploadingState ? "Uploading clip" : "Drop your first clip"}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {showUploadingState
                        ? "Hang tight while we add your media."
                        : "Upload media to preview it here"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
                      showUploadingState
                        ? "cursor-wait bg-[#9DB5FF]"
                        : "bg-[#335CFF]"
                    }`}
                    onClick={handleUploadClick}
                    disabled={showUploadingState}
                  >
                    {showUploadingState ? "Uploading..." : "Upload media"}
                  </button>
                </div>
              ) : visualStack.length > 0 ? (
                <div className="relative z-10 h-full w-full">
                  {visualStack.map((entry, index) => {
                    const transform = resolveClipTransform(
                      entry.clip.id,
                      entry.asset
                    );
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
                      ? getVideoStyles(entry.clip.id, videoSettings)
                      : null;
                    const noiseLevel = videoSettings?.noise ?? 0;
                    const vignetteLevel = videoSettings?.vignette ?? 0;
                    const clipZ = index + 2;
                    const clipRotation = transform.rotation ?? 0;
                    // ALWAYS skip rendering subtitle clips - they're shown via subtitle overlay system
                    // This prevents double-rendering both during playback AND when paused
                    const isSubtitleClip = subtitleClipIdSet.has(entry.clip.id);
                    if (isSubtitleClip) {
                      return null;
                    }
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
                          transform: clipRotation
                            ? `rotate(${clipRotation}deg)`
                            : undefined,
                          transformOrigin: "center center",
                        }}
                      >
                        <div
                          className={`relative h-full w-full ${
                            isActive
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
                              <div
                                className="w-full"
                                style={textRenderStyles?.containerStyle}
                              >
                                {isEditingText ? (
                                  <textarea
                                    ref={stageTextEditorRef}
                                    value={resolvedTextValue}
                                    onChange={(event) => {
                                      const value = event.target.value;
                                      if (
                                        selectedTextEntry?.clip.id ===
                                        entry.clip.id
                                      ) {
                                        setTextPanelDraft(value);
                                      }
                                      updateTextSettings(
                                        entry.clip.id,
                                        (current) => ({
                                          ...current,
                                          text: value,
                                        })
                                      );
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
                                    onPointerDown={(event) =>
                                      event.stopPropagation()
                                    }
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
                              style={{
                                ...videoStyles?.frameStyle,
                                // GPU acceleration hints for smooth playback
                                contain: 'strict',
                                willChange: isPlaying ? 'contents' : 'auto',
                              }}
                            >
                              <div
                                className="absolute inset-0"
                                style={{
                                  ...videoStyles?.mediaStyle,
                                  // Force GPU layer for video
                                  backfaceVisibility: 'hidden',
                                }}
                              >
                                {entry.asset.kind === "image" ? (
                                  <img
                                    src={entry.asset.url}
                                    alt={entry.asset.name}
                                    className="h-full w-full object-cover"
                                    draggable={false}
                                    loading="eager"
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
                                    preload="auto"
                                    // Disable browser features that add overhead for blob URLs
                                    disablePictureInPicture
                                    onLoadedMetadata={(event) =>
                                      updateVideoMetaFromElement(
                                        entry.clip.id,
                                        entry.asset.id,
                                        event.currentTarget
                                      )
                                    }
                                    draggable={false}
                                    style={{
                                      // Force hardware acceleration for video element
                                      transform: 'translateZ(0)',
                                    }}
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
                        </div>
                      </div>
                    );
                  })}
                  {/* Direct DOM subtitle overlay - always rendered, updated via refs */}
                  {/* This approach bypasses React re-renders for smooth subtitle display */}
                  <div
                    ref={subtitleOverlayRef}
                    className="cursor-grab"
                    style={{
                      position: 'absolute',
                      zIndex: 999,
                      opacity: 0,
                      visibility: 'hidden',
                      pointerEvents: 'none',
                      willChange: 'opacity, transform',
                      contain: 'layout style',
                    }}
                    onPointerDown={handleSubtitleOverlayPointerDown}
                  >
                    <div 
                      className="flex items-end justify-center px-3"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        paddingBottom: '8%',
                      }}
                    >
                      <div className="w-full text-center">
                        <span
                          ref={subtitleTextRef}
                          className="inline-block max-w-full"
                          style={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            textRendering: 'geometricPrecision',
                          }}
                        />
                      </div>
                    </div>
                  </div>
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
                          <feBlend
                            in="SourceGraphic"
                            in2="BackgroundImageFix"
                            result="shape"
                          />
                          <feColorMatrix
                            in="SourceAlpha"
                            result="hardAlpha"
                            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                          />
                          <feOffset dy="0.5" />
                          <feComposite
                            in2="hardAlpha"
                            k2="-1"
                            k3="1"
                            operator="arithmetic"
                          />
                          <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.1 0" />
                          <feBlend
                            in2="shape"
                            result="effect1_innerShadow_22531_1167"
                          />
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
                          <feBlend
                            in2="BackgroundImageFix"
                            result="effect1_dropShadow_22531_1167"
                          />
                          <feBlend
                            in="SourceGraphic"
                            in2="effect1_dropShadow_22531_1167"
                            result="shape"
                          />
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
            </div>
            <div className="pointer-events-none absolute inset-0 z-20 overflow-visible">
              {stageSelection && stageSelectionStyle && (
                <div className="pointer-events-none absolute inset-0">
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
              {snapGuides &&
                (snapGuides.x.length > 0 || snapGuides.y.length > 0) && (
                  <div className="pointer-events-none absolute inset-0">
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
              {visualStack.length > 0 && (
                <div className="relative h-full w-full">
                  {visualStack.map((entry, index) => {
                    const transform = resolveClipTransform(
                      entry.clip.id,
                      entry.asset
                    );
                    const isSelected = selectedClipIdsSet.has(entry.clip.id);
                    const isActive = activeCanvasClipId === entry.clip.id;
                    if (!isSelected && !isActive) {
                      return null;
                    }
                    const clipZ = index + 2;
                    const clipRotation = transform.rotation ?? 0;
                    return (
                      <div
                        key={`${entry.clip.id}-overlay`}
                        className="absolute"
                        style={{
                          left: `${transform.x * 100}%`,
                          top: `${transform.y * 100}%`,
                          width: `${transform.width * 100}%`,
                          height: `${transform.height * 100}%`,
                          zIndex: clipZ,
                          transform: clipRotation
                            ? `rotate(${clipRotation}deg)`
                            : undefined,
                          transformOrigin: "center center",
                        }}
                      >
                        {isSelected && (
                          <div className="pointer-events-none absolute inset-0 border-2 border-[#335CFF] shadow-[0_0_0_1px_rgba(51,92,255,0.35)]" />
                        )}
                        {isActive && (
                          <div className="absolute inset-0">
                            <button
                              type="button"
                              className="pointer-events-auto absolute left-1/2 -translate-x-1/2 flex items-center justify-center cursor-grab active:cursor-grabbing"
                              style={{
                                top: "-28px",
                                width: "20px",
                                height: "20px",
                                touchAction: "none",
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
                            <div
                              className="pointer-events-none absolute left-1/2 -translate-x-1/2 w-px bg-[#335CFF]/40"
                              style={{
                                top: "-12px",
                                height: "12px",
                              }}
                            />
                            {transformHandles.map((handle) => (
                              <button
                                key={`${entry.clip.id}-${handle.id}-overlay`}
                                type="button"
                                className={`pointer-events-auto absolute border border-[#335CFF] bg-white shadow-sm ${handle.className} ${handle.cursor} ${
                                  handle.isCorner
                                    ? "h-3 w-3 rounded-full"
                                    : handle.id === "n" || handle.id === "s"
                                      ? "h-1.5 w-8 rounded-full"
                                      : "h-8 w-1.5 rounded-full"
                                }`}
                                onPointerDown={(event) =>
                                  handleResizeStart(event, entry, handle.id)
                                }
                                aria-label={`Resize ${handle.id}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {subtitleSelectionVisible &&
                    selectedSubtitleEntry &&
                    selectedSubtitleTransform && (
                      <div
                        className="absolute"
                        style={{
                          left: `${selectedSubtitleTransform.x * 100}%`,
                          top: `${selectedSubtitleTransform.y * 100}%`,
                          width: `${selectedSubtitleTransform.width * 100}%`,
                          height: `${selectedSubtitleTransform.height * 100}%`,
                          zIndex: 30,
                          transform:
                            selectedSubtitleTransform.rotation &&
                              selectedSubtitleTransform.rotation !== 0
                              ? `rotate(${selectedSubtitleTransform.rotation}deg)`
                              : undefined,
                          transformOrigin: "center center",
                        }}
                      >
                        {selectedClipIdsSet.has(
                          selectedSubtitleEntry.clip.id
                        ) && (
                          <div className="pointer-events-none absolute inset-0 border-2 border-[#335CFF] shadow-[0_0_0_1px_rgba(51,92,255,0.35)]" />
                        )}
                        {activeCanvasClipId === selectedSubtitleEntry.clip.id && (
                          <div className="absolute inset-0">
                            <button
                              type="button"
                              className="pointer-events-auto absolute left-1/2 -translate-x-1/2 flex items-center justify-center cursor-grab active:cursor-grabbing"
                              style={{
                                top: "-28px",
                                width: "20px",
                                height: "20px",
                                touchAction: "none",
                              }}
                              onPointerDown={(event) =>
                                handleRotateStart(event, selectedSubtitleEntry)
                              }
                              aria-label="Rotate subtitle"
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
                            <div
                              className="pointer-events-none absolute left-1/2 -translate-x-1/2 w-px bg-[#335CFF]/40"
                              style={{
                                top: "-12px",
                                height: "12px",
                              }}
                            />
                            {transformHandles.map((handle) => (
                              <button
                                key={`${selectedSubtitleEntry.clip.id}-${handle.id}-subtitle`}
                                type="button"
                                className={`pointer-events-auto absolute border border-[#335CFF] bg-white shadow-sm ${handle.className} ${handle.cursor} ${
                                  handle.isCorner
                                    ? "h-3 w-3 rounded-full"
                                    : handle.id === "n" || handle.id === "s"
                                      ? "h-1.5 w-8 rounded-full"
                                      : "h-8 w-1.5 rounded-full"
                                }`}
                                onPointerDown={(event) =>
                                  handleResizeStart(
                                    event,
                                    selectedSubtitleEntry,
                                    handle.id
                                  )
                                }
                                aria-label={`Resize subtitle ${handle.id}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>
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
                {timelineLaneRows}
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

  const timelineLaneRows = useMemo(() => {
    return laneRows.map((lane) => {
      const laneClips = timelineLayout
        .filter((entry) => entry.clip.laneId === lane.id)
        .sort((a, b) => a.left - b.left);
      const laneClipInsetY =
        lane.type === "video" ? 0 : Math.max(4, Math.round(lane.height * 0.12));
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
            const width = Math.max(1, clip.duration * timelineScale);
            const isSelected = selectedClipIdsSet.has(clip.id);
            const isDragging = dragClipState?.clipId === clip.id;
            const isSubtitleClip = subtitleClipIdSet.has(clip.id);
            const waveform =
              lane.type === "audio"
                ? getAudioClipWaveformBars(clip, asset, width)
                : null;
            const waveformHeight =
              lane.type === "audio" ? Math.max(8, laneClipHeight - 6) : 0;
            const waveformColumns = waveform?.length ?? 0;
            const thumbnailCount =
              lane.type === "video" ? getThumbnailCountForWidth(width) : 0;
            const thumbnailFrames = timelineThumbnails[clip.id]?.frames ?? [];
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
            const dragLiftClass = isDragging ? "z-30 -translate-y-1" : "";
            const dragLiftShadow = isDragging
              ? "shadow-[0_18px_30px_rgba(15,23,42,0.25)] cursor-grabbing"
              : "";
            const clipBackgroundClass =
              lane.type === "text"
                ? isSubtitleClip
                  ? "bg-[#CAA7FC]"
                  : "bg-[#F8FAFF]"
                : "bg-white";
            const trimHandleClass = isSubtitleClip ? "bg-[#CAA7FC]" : "bg-black/5";
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
                  className={`group relative flex h-full w-full overflow-hidden rounded-sm border-0 ${clipBackgroundClass} p-0 text-left text-[10px] font-semibold shadow-sm transition ${isDragging ? "opacity-70" : ""} ${collisionHighlight} ${dragLiftShadow}`}
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
                          const next = prev.filter((id) => id !== clip.id);
                          setSelectedClipId(next[0] ?? null);
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
                      {Array.from({ length: thumbnailCount }, (_, index) => {
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
                            ) : hasThumbnailFrames && thumbnailFrames[index] ? (
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
                                  const target = event.currentTarget;
                                  if (
                                    Math.abs(
                                      target.currentTime - frameTime
                                    ) < 0.02
                                  ) {
                                    return;
                                  }
                                  try {
                                    target.currentTime = frameTime;
                                  } catch (error) {
                                    console.warn(
                                      "Failed to load thumbnail frame.",
                                      error
                                    );
                                  }
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {lane.type === "audio" && (
                    <div className="absolute inset-0 bg-[#EEF2FF]" />
                  )}
                  {lane.type === "audio" && (
                    <div className="absolute inset-0 px-2 py-2">
                      <span className="pointer-events-none absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 bg-[#A5B4FC]/60" />
                      <div
                        className="grid h-full w-full items-center gap-[2px]"
                        style={
                          waveformColumns > 0
                            ? {
                                gridTemplateColumns: `repeat(${waveformColumns}, minmax(0, 1fr))`,
                              }
                            : undefined
                        }
                      >
                        {waveform?.map((value, index) => (
                          <span
                            key={`${clip.id}-wave-${index}`}
                            className="relative mx-auto w-full max-w-[4px] rounded-full bg-[#6E86FF]"
                            style={{
                              height: `${Math.max(
                                1,
                                Math.round(value * waveformHeight)
                              )}px`,
                              opacity: 0.75,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div
                    className={`pointer-events-none absolute inset-0 rounded-sm border-4 transition ${clipBorderClass}`}
                  />
                  {!isSubtitleClip && (
                    <span className="absolute bottom-1 right-1 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      {formatDuration(clip.duration)}
                    </span>
                  )}
                  <span
                    className={`absolute left-0 top-0 h-full w-2 cursor-col-resize rounded-l-sm ${trimHandleClass}`}
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
                    className={`absolute right-0 top-0 h-full w-2 cursor-col-resize rounded-r-sm ${trimHandleClass}`}
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
          {lane.id === lastAudioLaneId && (
            <div
              className="absolute left-2 right-2 bottom-1 flex h-3 cursor-row-resize items-center justify-center opacity-70 hover:opacity-100"
              onPointerDown={handleAudioLaneResizeStart}
              aria-label="Resize audio lanes"
            >
              <span
                className={`h-0.5 w-16 rounded-full transition ${
                  isResizingAudioLane ? "bg-[#335CFF]" : "bg-gray-300/80"
                }`}
              />
            </div>
          )}
        </div>
      );
    });
  }, [
    dragClipState,
    dragPreview,
    getAudioClipWaveformBars,
    getThumbnailCountForWidth,
    handleAudioLaneResizeStart,
    handleTimelineClipContextMenu,
    isResizingAudioLane,
    laneRows,
    lastAudioLaneId,
    selectedClipIdsSet,
    timelineCollisionActive,
    timelineLayout,
    timelineScale,
    timelineThumbnails,
  ]);

  const resolvedExportViewport = exportViewport ?? exportDimensions;

  if (isExportMode) {
    return (
      <div
        className="flex items-center justify-center overflow-hidden bg-black"
        style={{
          width: `${resolvedExportViewport.width}px`,
          height: `${resolvedExportViewport.height}px`,
        }}
      >
        <main ref={mainRef} className="flex h-full w-full">
          {renderStage()}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#F2F4FA] text-[#0E121B]">
      <EditorHeader
        projectName={projectName}
        onProjectNameChange={handleProjectNameCommit}
        projectSaveState={projectSaveState}
        projectStarted={projectStarted}
        showSaveIndicator={showSaveIndicator}
        canUndo={historyState.canUndo}
        canRedo={historyState.canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onExport={handleStartExport}
        exportDisabled={exportDisabled}
        exportBusy={exportInFlight}
      />
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
        <EditorSidebar {...sidebarProps} />
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
      {exportUi.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.2)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E7EDFF] text-[#335CFF]">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                    <path
                      d="M12 4v10m0 0-4-4m4 4 4-4M5 18h14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {exportUi.status === "complete"
                      ? "Export ready"
                      : exportUi.status === "error"
                        ? "Export failed"
                        : "Exporting"}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {exportUi.stage || "Preparing export..."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gray-500 transition hover:bg-gray-50"
                onClick={() => setExportUi((prev) => ({ ...prev, open: false }))}
              >
                Close
              </button>
            </div>
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-gray-400">
                <span>Progress</span>
                <span className="text-gray-600">{exportProgressPercent}%</span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full transition-all duration-500 ease-out ${
                    exportUi.status === "error"
                      ? "bg-rose-500"
                      : "bg-[#335CFF]"
                  }`}
                  style={{ width: `${exportProgressPercent}%` }}
                />
              </div>
              {exportUi.error && (
                <p className="mt-3 text-sm text-rose-600">{exportUi.error}</p>
              )}
            </div>
            <div className="mt-6 flex items-center gap-3">
              {exportUi.status === "complete" && exportUi.downloadUrl ? (
                <button
                  type="button"
                  className="flex-1 rounded-full bg-[#335CFF] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(51,92,255,0.28)] transition hover:brightness-105"
                  onClick={() => triggerExportDownload(exportUi.downloadUrl!)}
                >
                  Download MP4
                </button>
              ) : exportUi.status === "error" ? (
                <button
                  type="button"
                  className="flex-1 rounded-full bg-[#335CFF] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(51,92,255,0.28)] transition hover:brightness-105"
                  onClick={handleStartExport}
                >
                  Try again
                </button>
              ) : (
                <button
                  type="button"
                  className="flex-1 cursor-wait rounded-full bg-[#9DB5FF] px-4 py-2.5 text-sm font-semibold text-white"
                  disabled
                >
                  Exporting...
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdvancedEditorPage() {
  return (
    <Suspense
      fallback={<div className="h-screen w-full bg-[#F2F4FA]" />}
    >
      <AdvancedEditorContent />
    </Suspense>
  );
}
