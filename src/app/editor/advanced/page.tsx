"use client";

export const dynamic = "force-dynamic";

import {
  useDeferredValue,
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
  loadAssetLibrary,
  type AssetLibraryItem,
} from "@/lib/assets/library";
import {
  parseRedditVideoImportPayload,
  parseSplitScreenImportPayload,
  type RedditVideoImportPayloadV1,
  type StreamerVideoImportPayloadV1,
  type SplitScreenImportPayloadV1,
} from "@/lib/editor/imports";

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
import type {
  AiVideoGenerateRequest,
  AiVideoUploadContext,
  AiVideoUploadedImage,
} from "./components/ai-video-generator-panel";
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

type SupabaseClient = ReturnType<
  (typeof import("@/lib/supabase/client"))["createClient"]
>;

let supabaseClientPromise: Promise<SupabaseClient> | null = null;

const getSupabaseClient = async (): Promise<SupabaseClient> => {
  if (!supabaseClientPromise) {
    supabaseClientPromise = import("@/lib/supabase/client").then(
      ({ createClient }) => createClient()
    );
  }
  return supabaseClientPromise;
};

const laneTypePriority: Record<LaneType, number> = {
  text: 0,
  video: 1,
  audio: 2,
};

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

type TranscriptSegment = {
  id: string;
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

type StockAudioDragPayload = {
  payloadType: "stock-audio";
  id: string;
  name: string;
  url: string;
  size: number;
  duration?: number | null;
};

type AiImagePreview = {
  url: string;
  assetId?: string | null;
  name?: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
};

type AiVideoPreview = {
  url: string;
  assetId?: string | null;
  audioAssetId?: string | null;
  name?: string;
  duration?: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
  generateAudio?: boolean;
  splitAudio?: boolean;
};

type AiVideoApiAsset = {
  id?: string;
  url?: string;
  name?: string;
  size?: number;
  duration?: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
  mimeType?: string;
};

type AiVoiceoverVoice = {
  id: string;
  name: string;
  voice: string;
  url: string;
  path: string;
  size: number;
};

type AiVoiceoverPreview = {
  url: string;
  assetId?: string | null;
  name?: string;
  duration?: number;
  voice?: string;
};

type AiBackgroundRemovalPreview = {
  url: string;
  assetId?: string | null;
  clipId?: string | null;
  sourceClipId?: string | null;
  name?: string;
  duration?: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
};

type AiBackgroundRemovalSelection =
  | { state: "empty" }
  | { state: "multi" }
  | { state: "invalid"; clipId: string; label?: string }
  | {
      state: "ready";
      clipId: string;
      label?: string;
      duration: number;
      entry: TimelineLayoutEntry;
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
  subtitleSegments?: SubtitleSegment[];
  export?: ProjectExportState | null;
};

type ProjectSaveState = "idle" | "saving" | "saved" | "error";

type EditorReloadSessionPayload = {
  version: 1;
  savedAt: number;
  projectId: string | null;
  state: EditorProjectState;
};

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

type ProjectExportState = {
  jobId: string | null;
  status: ExportStatus;
  stage: string;
  progress: number;
  downloadUrl: string | null;
  updatedAt: string;
};

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

type UploadAssetMeta = {
  name?: string;
  kind?: "video" | "audio" | "image";
  source?: "upload" | "autoclip" | "external" | "stock" | "generated";
  duration?: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
};

type EditorExportPayload = {
  state?: EditorProjectState | null;
  output?: Partial<ExportOutput> | null;
  preview?: Partial<ExportOutput> | null;
  renderScaleMode?: "css" | "device" | null;
  fonts?: string[] | null;
};

type EditorExportRuntimeApi = {
  waitForReady: () => Promise<void>;
  setTime: (time: number) => Promise<void>;
  getStageSelector: () => string;
};

declare global {
  interface Window {
    __EDITOR_EXPORT__?: EditorExportPayload;
    __EDITOR_EXPORT_API__?: EditorExportRuntimeApi;
  }
}

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

const AI_IMAGE_STORAGE_PREFIX = "satura:ai-image:";
const AI_VOICEOVER_STORAGE_PREFIX = "satura:ai-voiceover:";
const AI_VIDEO_STORAGE_PREFIX = "satura:ai-video:";
const EDITOR_RELOAD_SESSION_KEY = "satura:editor:reload-session:v1";
const TTS_VOICES_BUCKET_NAME =
  process.env.NEXT_PUBLIC_TTS_VOICES_BUCKET ?? "tts-voices";
const TTS_VOICES_ROOT_PREFIX =
  process.env.NEXT_PUBLIC_TTS_VOICES_ROOT?.replace(/^\/+|\/+$/g, "") ?? "";

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

type SubtitleBeatGroup = {
  start: number;
  end: number;
  text: string;
  emphasis: boolean;
  startWordIndex: number;
  endWordIndex: number;
};

const joinSubtitleTokens = (tokens: string[]) => {
  const shouldOmitSpaceBefore = (token: string) => /^[,.;:!?%)\]}]/.test(token) || token.startsWith("'");
  const shouldOmitSpaceAfter = (token: string) => /[(\[{]$/.test(token);
  let out = "";
  tokens.forEach((raw) => {
    const token = raw.trim();
    if (!token) {
      return;
    }
    const needsSpace =
      out.length > 0 &&
      !out.endsWith(" ") &&
      !out.endsWith("\n") &&
      !shouldOmitSpaceBefore(token) &&
      !shouldOmitSpaceAfter(out.slice(-1));
    out += `${needsSpace ? " " : ""}${token}`;
  });
  return out;
};

const tokenizeSubtitleText = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

const buildSyntheticTimedWords = (
  text: string,
  startTime: number,
  endTime: number
): TimedWord[] => {
  const start = Number(startTime);
  const end = Number(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return [];
  }
  const tokens = tokenizeSubtitleText(text);
  if (tokens.length === 0) {
    return [];
  }
  const duration = end - start;
  const perWord = duration / tokens.length;
  if (!Number.isFinite(perWord) || perWord <= 0) {
    return [];
  }
  return tokens.map((token, index) => {
    const wordStart = start + index * perWord;
    const wordEnd = index === tokens.length - 1 ? end : start + (index + 1) * perWord;
    const safeStart = clamp(wordStart, start, end);
    const safeEnd = clamp(Math.max(wordEnd, safeStart + 0.001), start, end);
    return {
      start: safeStart,
      end: safeEnd,
      word: token,
      text: token,
    };
  });
};

const looksLikeEmphasisToken = (token: string) => {
  const trimmed = token.trim();
  if (!trimmed) {
    return false;
  }
  if (/[.!?]+$/.test(trimmed)) {
    return true;
  }
  const lettersOnly = trimmed.replace(/[^A-Za-z]/g, "");
  if (lettersOnly.length >= 3 && lettersOnly.length <= 6 && lettersOnly === lettersOnly.toUpperCase()) {
    return true;
  }
  return false;
};

const buildSubtitleBeatGroups = (
  words: TimedWord[],
  options: {
    minWords: number;
    maxWords: number;
    maxSpanSeconds: number;
    longPauseSeconds: number;
  }
): SubtitleBeatGroup[] => {
  const normalized = (words ?? [])
    .map((word) => ({
      start: Number(word.start),
      end: Number(word.end),
      token: String(word.word ?? word.text ?? "").trim(),
    }))
    .filter(
      (word) =>
        Number.isFinite(word.start) &&
        Number.isFinite(word.end) &&
        word.end > word.start &&
        word.token.length > 0
    )
    .sort((a, b) => a.start - b.start || a.end - b.end);

  if (normalized.length === 0) {
    return [];
  }

  const minWords = Math.max(1, Math.floor(options.minWords));
  const maxWords = Math.max(minWords, Math.floor(options.maxWords));
  const maxSpanSeconds = Math.max(0.1, options.maxSpanSeconds);
  const longPauseSeconds = Math.max(0.05, options.longPauseSeconds);

  type GroupRange = { startIndex: number; endIndex: number };
  const ranges: GroupRange[] = [];

  let i = 0;
  while (i < normalized.length) {
    const startIndex = i;
    let endIndex = i;

    while (endIndex + 1 < normalized.length) {
      const currentCount = endIndex - startIndex + 1;
      if (currentCount >= maxWords) {
        break;
      }
      const current = normalized[endIndex];
      if (/[.!?]+$/.test(current.token)) {
        break;
      }
      const next = normalized[endIndex + 1];
      const gapToNext = next.start - current.end;
      if (gapToNext > longPauseSeconds) {
        break;
      }
      const nextCount = currentCount + 1;
      const nextSpan = next.end - normalized[startIndex].start;
      if (nextCount >= minWords && nextSpan > maxSpanSeconds) {
        break;
      }
      endIndex += 1;
    }

    ranges.push({ startIndex, endIndex });
    i = endIndex + 1;
  }

  // Rebalance non-emphasis 1-word groups to avoid "karaoke" by borrowing from neighbors.
  for (let idx = 0; idx < ranges.length; idx += 1) {
    const range = ranges[idx];
    const size = range.endIndex - range.startIndex + 1;
    if (size !== 1) {
      continue;
    }
    const token = normalized[range.startIndex]?.token ?? "";
    const emphasis = looksLikeEmphasisToken(token);
    if (emphasis) {
      continue;
    }
    const prev = idx > 0 ? ranges[idx - 1] : null;
    if (prev) {
      const prevSize = prev.endIndex - prev.startIndex + 1;
      if (prevSize > minWords) {
        // Move the last word from prev into this range (e.g. 4+1 -> 3+2).
        range.startIndex = prev.endIndex;
        prev.endIndex -= 1;
        continue;
      }
    }
    const next = idx + 1 < ranges.length ? ranges[idx + 1] : null;
    if (next) {
      const nextSize = next.endIndex - next.startIndex + 1;
      if (nextSize < maxWords) {
        // Merge into next range (e.g. 1+3 -> 4).
        next.startIndex = range.startIndex;
        ranges.splice(idx, 1);
        idx -= 1;
      }
    }
  }

  return ranges
    .map((range) => {
      const start = normalized[range.startIndex]?.start ?? 0;
      const end = normalized[range.endIndex]?.end ?? start;
      const tokens = normalized
        .slice(range.startIndex, range.endIndex + 1)
        .map((word) => word.token);
      const text = joinSubtitleTokens(tokens);
      return {
        start,
        end,
        text,
        emphasis: tokens.length === 1 && looksLikeEmphasisToken(tokens[0] ?? ""),
        startWordIndex: range.startIndex,
        endWordIndex: range.endIndex,
      };
    })
    .filter((group) => Boolean(group.text));
};

const computeBeatEnterProgress = (elapsedSeconds: number, enterSeconds: number) => {
  const duration = Math.max(0.01, enterSeconds);
  const t = clamp(elapsedSeconds / duration, 0, 1);
  // Smooth, deterministic, export-friendly "pop in" (Remotion-like, but time-based).
  return 1 - Math.pow(1 - t, 3);
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

const buildStockAudioPayload = (track: StockAudioTrack): StockAudioDragPayload => {
  return {
    payloadType: "stock-audio",
    id: track.id,
    name: track.name,
    url: track.url,
    size: track.size,
    duration: track.duration ?? null,
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

const dedupeMediaAssets = (items: MediaAsset[]) => {
  if (items.length <= 1) {
    return items;
  }
  const seen = new Set<string>();
  const deduped: MediaAsset[] = [];
  items.forEach((asset) => {
    const key = asset.id || `${asset.kind}:${asset.url}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    deduped.push(asset);
  });
  return deduped;
};

const ensureEven = (value: number) => {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded + 1;
};

const parseAspectRatio = (value?: string | null) => {
  if (typeof value !== "string") {
    return undefined;
  }
  const parts = value.split(":").map((part) => Number(part));
  if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) {
    return undefined;
  }
  const [width, height] = parts;
  if (width <= 0 || height <= 0) {
    return undefined;
  }
  return width / height;
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

const isValidEditorProjectState = (
  value: unknown
): value is EditorProjectState => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<EditorProjectState>;
  const snapshot = candidate.snapshot as Partial<EditorSnapshot> | undefined;
  return Boolean(
    snapshot &&
      Array.isArray(snapshot.assets) &&
      Array.isArray(snapshot.timeline) &&
      Array.isArray(snapshot.lanes)
  );
};

const readEditorReloadSessionState = (): {
  projectId: string | null;
  state: EditorProjectState;
} | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(EDITOR_RELOAD_SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<EditorReloadSessionPayload> | null;
    if (!parsed || parsed.version !== 1 || !isValidEditorProjectState(parsed.state)) {
      return null;
    }
    const projectId =
      typeof parsed.projectId === "string" && parsed.projectId.trim().length > 0
        ? parsed.projectId.trim()
        : null;
    return {
      projectId,
      state: parsed.state,
    };
  } catch {
    return null;
  }
};

const persistEditorReloadSessionState = (
  state: EditorProjectState,
  projectId: string | null
) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const payload: EditorReloadSessionPayload = {
      version: 1,
      savedAt: Date.now(),
      projectId,
      state,
    };
    window.sessionStorage.setItem(
      EDITOR_RELOAD_SESSION_KEY,
      JSON.stringify(payload)
    );
  } catch {
    // Ignore quota/storage failures.
  }
};

const clearEditorReloadSessionState = () => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem(EDITOR_RELOAD_SESSION_KEY);
  } catch {
    // Ignore storage failures.
  }
};

const isReloadNavigation = () => {
  if (typeof window === "undefined") {
    return false;
  }
  const navigationEntries = window.performance?.getEntriesByType?.(
    "navigation"
  ) as PerformanceNavigationTiming[] | undefined;
  const navigationType = navigationEntries?.[0]?.type;
  if (navigationType) {
    return navigationType === "reload";
  }
  const legacyNavigation = (
    window.performance as Performance & {
      navigation?: { type?: number };
    }
  )?.navigation;
  return legacyNavigation?.type === 1;
};

const DELETED_ASSETS_EVENT = "satura:assets-deleted";

const isAssetDebugEnabled = () => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return (
      window.localStorage?.getItem("assetDebug") === "1" ||
      process.env.NEXT_PUBLIC_ASSET_DEBUG === "1"
    );
  } catch {
    return process.env.NEXT_PUBLIC_ASSET_DEBUG === "1";
  }
};

const logAssetDebug = (...args: unknown[]) => {
  if (isAssetDebugEnabled()) {
    console.info(...args);
  }
};

const IMPORT_TIMEOUT_MS = 240_000;
const SPLIT_SCREEN_IMPORT_STEP_TIMEOUT_MS = 25_000;
const IMPORT_PAYLOAD_FETCH_MAX_ATTEMPTS = 4;
const IMPORT_PAYLOAD_FETCH_RETRY_DELAY_MS = 300;
const IMPORT_PREPARING_WATCHDOG_MS = 45_000;
const REDDIT_VOICEOVER_TIMEOUT_MS = 90_000;
const REDDIT_VOICEOVER_MAX_ATTEMPTS = 2;
const TRANSCRIPTION_SOURCE_FETCH_TIMEOUT_MS = 45_000;
const TRANSCRIPTION_REQUEST_TIMEOUT_MS = 280_000;
const TRANSCRIPTION_REQUEST_MAX_ATTEMPTS = 3;
const REDDIT_IMAGE_FETCH_TIMEOUT_MS = 10_000;
const IMPORT_SUBTITLE_TIMEOUT_MS = 300_000;

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });

const withPromiseTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    let finished = false;
    const timeoutId = setTimeout(() => {
      if (finished) {
        return;
      }
      finished = true;
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);
    promise
      .then((value) => {
        if (finished) {
          return;
        }
        finished = true;
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        if (finished) {
          return;
        }
        finished = true;
        clearTimeout(timeoutId);
        reject(error);
      });
  });

const splitImportLog = (...args: unknown[]) => {
  console.info("[split-screen][editor]", ...args);
};

const subtitleDebugLog = (...args: unknown[]) => {
  console.info("[subtitles][editor]", ...args);
};

const fetchWithTimeout = async (
  input: string,
  init: RequestInit,
  timeoutMs: number,
  label: string
) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const isTransientErrorMessage = (message: string) =>
  /timed out|timeout|abort|network|failed to fetch|429|5\d\d|temporar|rate limit/i.test(
    message
  );

const createExternalAssetSafe = async (
  payload: ExternalAssetPayload
): Promise<AssetLibraryItem | null> => {
  try {
    const mod = (await import("@/lib/assets/library")) as {
      createExternalAsset?: (value: ExternalAssetPayload) => Promise<AssetLibraryItem | null>;
    };
    if (typeof mod.createExternalAsset === "function") {
      logAssetDebug("[assets] createExternalAsset via library");
      return mod.createExternalAsset(payload);
    }
    console.warn("[assets] createExternalAsset export missing");
  } catch (error) {
    console.error("[assets] createExternalAsset failed", error);
  }
  return null;
};

const deleteAssetByIdSafe = async (assetId: string) => {
  try {
    const mod = (await import("@/lib/assets/library")) as {
      deleteAssetById?: (id: string) => Promise<void>;
    };
    if (typeof mod.deleteAssetById === "function") {
      logAssetDebug("[assets] deleteAssetById via library");
      await mod.deleteAssetById(assetId);
      return;
    }
    console.warn("[assets] deleteAssetById export missing");
  } catch (error) {
    console.error("[assets] deleteAssetById failed", error);
  }
};

const uploadAssetFileSafe = async (
  file: File,
  meta?: UploadAssetMeta
): Promise<AssetLibraryItem | null> => {
  try {
    const mod = (await import("@/lib/assets/library")) as {
      uploadAssetFile?: (file: File, meta?: UploadAssetMeta) => Promise<AssetLibraryItem | null>;
    };
    if (typeof mod.uploadAssetFile === "function") {
      logAssetDebug("[assets] uploadAssetFile via library", {
        name: file.name,
        size: file.size,
        type: file.type,
      });
      return await mod.uploadAssetFile(file, meta);
    }
    console.warn("[assets] uploadAssetFile export missing");
  } catch (error) {
    console.error("[assets] uploadAssetFile failed", error);
  }
  return null;
};

let initialAssetLibraryLoadPromise: Promise<AssetLibraryItem[]> | null = null;

const loadInitialAssetLibrary = () => {
  if (!initialAssetLibraryLoadPromise) {
    initialAssetLibraryLoadPromise = loadAssetLibrary()
      .catch(() => [])
      .finally(() => {
        initialAssetLibraryLoadPromise = null;
      });
  }
  return initialAssetLibraryLoadPromise;
};

const getEditorExportPayload = (): EditorExportPayload | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.__EDITOR_EXPORT__ ?? null;
};

const areSnapGuidesEqual = (
  a: SnapGuides | null,
  b: SnapGuides | null
) => {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  if (a.x.length !== b.x.length || a.y.length !== b.y.length) {
    return false;
  }
  for (let index = 0; index < a.x.length; index += 1) {
    if (a.x[index] !== b.x[index]) {
      return false;
    }
  }
  for (let index = 0; index < a.y.length; index += 1) {
    if (a.y[index] !== b.y[index]) {
      return false;
    }
  }
  return true;
};

function AdvancedEditorContent() {
  const textMinLayerSize = 24;
  const textPresetPreviewCount = 6;
  const gifPreviewCount = 6;
  const gifSearchLimit = 30;
  const gifPreviewIntervalMs = 15000;
  const gifDragType = "application/x-gif-asset";
  const stockAudioDragType = "application/x-stock-audio";
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
  const [aiImagePrompt, setAiImagePrompt] = useState("");
  const [aiImageAspectRatio, setAiImageAspectRatio] = useState("1:1");
  const [aiImageStatus, setAiImageStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [aiImageError, setAiImageError] = useState<string | null>(null);
  const [aiImagePreview, setAiImagePreview] = useState<AiImagePreview | null>(
    null
  );
  const [aiImageSaving, setAiImageSaving] = useState(false);
  const [aiImageMagicLoading, setAiImageMagicLoading] = useState(false);
  const [aiImageMagicError, setAiImageMagicError] = useState<string | null>(null);
  const [aiImageLastPrompt, setAiImageLastPrompt] = useState<string | null>(null);
  const [aiImageLastAspectRatio, setAiImageLastAspectRatio] = useState<
    string | null
  >(null);
  const [aiVideoPrompt, setAiVideoPrompt] = useState("");
  const [aiVideoAspectRatio, setAiVideoAspectRatio] = useState("16:9");
  const [aiVideoDuration, setAiVideoDuration] = useState(8);
  const [aiVideoGenerateAudio, setAiVideoGenerateAudio] = useState(true);
  const [aiVideoSplitAudio, setAiVideoSplitAudio] = useState(true);
  const [aiVideoStatus, setAiVideoStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [aiVideoError, setAiVideoError] = useState<string | null>(null);
  const [aiVideoPreview, setAiVideoPreview] = useState<AiVideoPreview | null>(
    null
  );
  const [aiVideoSaving, setAiVideoSaving] = useState(false);
  const [aiVideoMagicLoading, setAiVideoMagicLoading] = useState(false);
  const [aiVideoMagicError, setAiVideoMagicError] = useState<string | null>(null);
  const [aiVideoLastPrompt, setAiVideoLastPrompt] = useState<string | null>(null);
  const [aiVideoLastAspectRatio, setAiVideoLastAspectRatio] = useState<
    string | null
  >(null);
  const [aiVideoLastDuration, setAiVideoLastDuration] = useState<
    number | null
  >(null);
  const [aiVideoLastGenerateAudio, setAiVideoLastGenerateAudio] = useState<
    boolean | null
  >(null);
  const [aiVideoLastSplitAudio, setAiVideoLastSplitAudio] = useState<
    boolean | null
  >(null);
  const [aiBackgroundRemovalStatus, setAiBackgroundRemovalStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [aiBackgroundRemovalError, setAiBackgroundRemovalError] = useState<
    string | null
  >(null);
  const [aiBackgroundRemovalPreview, setAiBackgroundRemovalPreview] =
    useState<AiBackgroundRemovalPreview | null>(null);
  const [aiBackgroundRemovalSubjectIsPerson, setAiBackgroundRemovalSubjectIsPerson] =
    useState(true);
  const [aiVoiceoverScript, setAiVoiceoverScript] = useState("");
  const [aiVoiceoverSelectedVoice, setAiVoiceoverSelectedVoice] = useState<
    string | null
  >(null);
  const [aiVoiceoverStatus, setAiVoiceoverStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [aiVoiceoverError, setAiVoiceoverError] = useState<string | null>(null);
  const [aiVoiceoverPreview, setAiVoiceoverPreview] =
    useState<AiVoiceoverPreview | null>(null);
  const [aiVoiceoverSaving, setAiVoiceoverSaving] = useState(false);
  const [aiVoiceoverLastScript, setAiVoiceoverLastScript] = useState<
    string | null
  >(null);
  const [aiVoiceoverLastVoice, setAiVoiceoverLastVoice] = useState<
    string | null
  >(null);
  const [aiVoiceoverVoices, setAiVoiceoverVoices] = useState<
    AiVoiceoverVoice[]
  >([]);
  const [aiVoiceoverVoicesStatus, setAiVoiceoverVoicesStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [aiVoiceoverVoicesError, setAiVoiceoverVoicesError] = useState<
    string | null
  >(null);
  const [aiVoiceoverVoicesReloadKey, setAiVoiceoverVoicesReloadKey] =
    useState(0);
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
  const stageSelectionRef = useRef<RangeSelectionState | null>(null);
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
  const deferredAssetSearch = useDeferredValue(assetSearch);
  const deferredStockSearch = useDeferredValue(stockSearch);
  const deferredSoundFxSearch = useDeferredValue(soundFxSearch);
  const deferredStockVideoSearch = useDeferredValue(stockVideoSearch);
  const [exportUi, setExportUi] = useState<ExportUiState>({
    open: false,
    status: "idle",
    stage: "",
    progress: 0,
    jobId: null,
    downloadUrl: null,
    error: null,
  });
  const [exportViewport, setExportViewport] = useState<ExportOutput | null>(() => {
    if (!isExportMode || typeof window === "undefined") {
      return null;
    }
    const payload = getEditorExportPayload();
    const output = payload?.output;
    const nextWidth = Number(output?.width);
    const nextHeight = Number(output?.height);
    if (Number.isFinite(nextWidth) && Number.isFinite(nextHeight)) {
      return {
        width: ensureEven(nextWidth),
        height: ensureEven(nextHeight),
      };
    }
    return null;
  });
  const [exportPreview, setExportPreview] = useState<ExportOutput | null>(() => {
    if (!isExportMode || typeof window === "undefined") {
      return null;
    }
    const payload = getEditorExportPayload();
    const preview = payload?.preview;
    const previewWidth = Number(preview?.width);
    const previewHeight = Number(preview?.height);
    if (Number.isFinite(previewWidth) && Number.isFinite(previewHeight)) {
      return {
        width: ensureEven(previewWidth),
        height: ensureEven(previewHeight),
      };
    }
    return null;
  });
  const [exportScaleMode, setExportScaleMode] = useState<"css" | "device">(() => {
    if (!isExportMode || typeof window === "undefined") {
      return "css";
    }
    const mode = getEditorExportPayload()?.renderScaleMode;
    return mode === "device" ? "device" : "css";
  });
  const exportSubtitleScaleRef = useRef(1);
  const exportPollRef = useRef<number | null>(null);
  const exportPersistedRef = useRef<ProjectExportState | null>(null);
  const exportHydratedRef = useRef(false);
  const aiImageRequestIdRef = useRef(0);
  const aiVideoRequestIdRef = useRef(0);
  const aiVoiceoverRequestIdRef = useRef(0);
  const aiBackgroundRemovalRequestIdRef = useRef(0);
  const aiVoiceoverVoicesLoadIdRef = useRef(0);
  const aiVoiceoverVoicesLoadTimeoutRef = useRef<number | null>(null);
  const exportMediaCacheRef = useRef<Set<string>>(new Set());
  const exportMediaFailedRef = useRef<Set<string>>(new Set());
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
  const projectAssetsSyncRef = useRef<{
    projectId: string | null;
    assetKey: string;
  }>({ projectId: null, assetKey: "" });
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
  const clipTransformsRef = useRef<Record<string, ClipTransform>>(
    clipTransforms
  );
  const [snapGuides, setSnapGuides] = useState<SnapGuides | null>(null);
  const snapGuidesRef = useRef<SnapGuides | null>(snapGuides);
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
  const subtitleStatusRef = useRef(subtitleStatus);
  const subtitleErrorRef = useRef(subtitleError);
  useEffect(() => {
    subtitleStatusRef.current = subtitleStatus;
    subtitleErrorRef.current = subtitleError;
  }, [subtitleError, subtitleStatus]);
  const [subtitleSegments, setSubtitleSegments] = useState<SubtitleSegment[]>(
    []
  );
  const [transcriptStatus, setTranscriptStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>(
    []
  );
  const [subtitleLanguage, setSubtitleLanguage] = useState(
    subtitleLanguages[0]
  );
  const [subtitleSource, setSubtitleSource] = useState<"project" | string>(
    "project"
  );
  const [transcriptSource, setTranscriptSource] = useState<"project" | string>(
    "project"
  );
  const [subtitleActiveTab, setSubtitleActiveTab] = useState<
    "style" | "edit"
  >("style");
  const [subtitleStyleFilter, setSubtitleStyleFilter] = useState("All");
  const defaultSubtitleStyleId =
    subtitleStylePresets.find((preset) => preset.id === "bold-pop")?.id ??
    subtitleStylePresets[0]?.id ??
    null;
  const [subtitleStyleId, setSubtitleStyleId] = useState<string | null>(
    defaultSubtitleStyleId
  );
  const [editorProfile, setEditorProfile] = useState<
    "default" | "reddit" | "split" | "streamer"
  >("default");
  const [subtitleStyleOverrides, setSubtitleStyleOverrides] = useState<
    Record<string, { settings?: Partial<TextClipSettings>; preview?: TextStylePreset["preview"] }>
  >({});
  const [detachedSubtitleIds, setDetachedSubtitleIds] = useState<Set<string>>(
    () => new Set()
  );
  const [subtitleMoveTogether, setSubtitleMoveTogether] = useState(true);
  const pendingSplitScreenSubtitleRef = useRef<{
    mainClipId: string;
    styleId: string;
  } | null>(null);
  const [splitScreenImportOverlayOpen, setSplitScreenImportOverlayOpen] =
    useState(false);
  const [splitScreenImportOverlayStage, setSplitScreenImportOverlayStage] =
    useState<"preparing" | "uploading" | "subtitles" | "finalizing">(
      "preparing"
    );
  const pendingStreamerVideoSubtitleRef = useRef<{
    sourceClipId: string;
    styleId: string;
  } | null>(null);
  const [streamerVideoImportOverlayOpen, setStreamerVideoImportOverlayOpen] =
    useState(false);
  const [
    streamerVideoImportOverlayStage,
    setStreamerVideoImportOverlayStage,
  ] = useState<"preparing" | "uploading" | "subtitles" | "finalizing">(
    "preparing"
  );
  const pendingRedditVideoSubtitleRef = useRef<{
    sourceClipId: string;
    styleId: string;
  } | null>(null);
  const [redditVideoImportOverlayOpen, setRedditVideoImportOverlayOpen] =
    useState(false);
  const [redditVideoImportOverlayStage, setRedditVideoImportOverlayStage] =
    useState<"preparing" | "voiceover" | "subtitles" | "finalizing">(
      "preparing"
    );
  const [redditVideoImportError, setRedditVideoImportError] = useState<string | null>(
    null
  );
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
  const rangeSelectionRef = useRef<RangeSelectionState | null>(null);
  const [dragTransformState, setDragTransformState] =
    useState<TransformDragState | null>(null);
  const [resizeTransformState, setResizeTransformState] =
    useState<TransformResizeState | null>(null);
  const [rotateTransformState, setRotateTransformState] =
    useState<TransformRotateState | null>(null);
  const [dragClipState, setDragClipState] = useState<ClipDragState | null>(
    null
  );
  const [topCreateZoneActive, setTopCreateZoneActive] = useState(false);
  const [dragOverCanvas, setDragOverCanvas] = useState(false);
	  const [dragOverTimeline, setDragOverTimeline] = useState(false);
	  const canvasDragDepthRef = useRef(0);
	  const timelineDragDepthRef = useRef(0);
  const [trimState, setTrimState] = useState<TrimState | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
	  const replaceInputRef = useRef<HTMLInputElement | null>(null);
	  const replaceMediaInputRef = useRef<HTMLInputElement | null>(null);
	  const assetsRef = useRef<MediaAsset[]>([]);
	  const assetCacheRef = useRef<Map<string, MediaAsset>>(new Map());
	  const assetLibraryBootstrappedRef = useRef(false);
	  const timelineRef = useRef<TimelineClip[]>([]);
  const lanesRef = useRef<TimelineLane[]>([]);
  const laneRowsRef = useRef<
    Array<{ id: string; type: LaneType; label: string; height: number }>
  >([]);
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
      const stored = await uploadAssetFileSafe(file, {
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
  const playheadLineRef = useRef<HTMLSpanElement | null>(null);
  const playheadHandleRef = useRef<HTMLButtonElement | null>(null);
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
  const playheadVisualTimeRef = useRef(currentTime);
  const stockDurationCacheRef = useRef<Map<string, number | null>>(new Map());
  const stockAudioMetaLoadingRef = useRef<Set<string>>(new Set());
  const stockMusicLoadTimeoutRef = useRef<number | null>(null);
  const stockMusicLoadIdRef = useRef(0);
  const stockMusicSettledReloadKeyRef = useRef<number | null>(null);
  const soundFxLoadTimeoutRef = useRef<number | null>(null);
  const soundFxLoadIdRef = useRef(0);
  const soundFxSettledReloadKeyRef = useRef<number | null>(null);
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
  const stockVideoSettledReloadKeyRef = useRef<number | null>(null);
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
  const reloadStateSaveTimeoutRef = useRef<number | null>(null);
  const historyThrottleRef = useRef(0);
  const clipboardRef = useRef<ClipboardData | null>(null);
  const dragTransformHistoryRef = useRef(false);
  const resizeTransformHistoryRef = useRef(false);
  const rotateTransformHistoryRef = useRef(false);
  const dragTransformStateRef = useRef<TransformDragState | null>(null);
  const resizeTransformStateRef = useRef<TransformResizeState | null>(null);
  const rotateTransformStateRef = useRef<TransformRotateState | null>(null);
  const clipAssetKindMapRef = useRef<Map<string, MediaKind>>(new Map());
  const visualStackRef = useRef<TimelineLayoutEntry[]>([]);
  const baseBackgroundTransformRef = useRef<ClipTransform | null>(null);
  const selectedTextEntryRef = useRef<TimelineLayoutEntry | null>(null);
  const subtitleClipIdSetRef = useRef<Set<string>>(new Set());
  const resizeTextRectRef = useRef<ClipTransform | null>(null);
  const resizeTextFontRef = useRef<{ clipId: string; fontSize: number } | null>(
    null
  );
  const clipTransformTouchedRef = useRef<Set<string>>(new Set());
  const dragClipHistoryRef = useRef(false);
  const dragClipStateRef = useRef<ClipDragState | null>(null);
  const trimStateRef = useRef<TrimState | null>(null);
  const trimHistoryRef = useRef(false);
  const timelineScaleRef = useRef(timelineScale);
  const timelineDurationRef = useRef(0);
  const topCreateZonePxRef = useRef(0);
  const isTimelineSnappingEnabledRef = useRef(isTimelineSnappingEnabled);
  const subtitleSourceClipMapRef = useRef<Map<string, string[]>>(new Map());
  const timelineSnapGuideRef = useRef<number | null>(null);
  const timelineCollisionGuideRef = useRef<number | null>(null);
  const timelineCollisionActiveRef = useRef(false);
  const timelinePanRef = useRef<{
    startX: number;
    scrollLeft: number;
    active: boolean;
  }>({ startX: 0, scrollLeft: 0, active: false });
  const playbackTimeRef = useRef(currentTime);
  const playbackUiTickRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);
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
  const setSnapGuidesIfChanged = useCallback((nextGuides: SnapGuides | null) => {
    if (areSnapGuidesEqual(snapGuidesRef.current, nextGuides)) {
      return;
    }
    snapGuidesRef.current = nextGuides;
    setSnapGuides(nextGuides);
  }, []);
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
      const durationUpdateThreshold = 0.05;
      const currentAsset = assetsRef.current.find((asset) => asset.id === assetId);
      if (!currentAsset) {
        return;
      }
      const hasWidthChange = currentAsset.width !== width;
      const hasHeightChange = currentAsset.height !== height;
      const hasAspectRatioChange =
        typeof currentAsset.aspectRatio !== "number" ||
        Math.abs(currentAsset.aspectRatio - aspectRatio) > 0.001;
      const hasDurationChange =
        videoDuration != null &&
        (currentAsset.duration == null ||
          Math.abs(currentAsset.duration - videoDuration) > durationUpdateThreshold);
      if (hasWidthChange || hasHeightChange || hasAspectRatioChange || hasDurationChange) {
        setAssets((prev) => {
          const index = prev.findIndex((asset) => asset.id === assetId);
          if (index < 0) {
            return prev;
          }
          const current = prev[index];
          const widthChanged = current.width !== width;
          const heightChanged = current.height !== height;
          const aspectChanged =
            typeof current.aspectRatio !== "number" ||
            Math.abs(current.aspectRatio - aspectRatio) > 0.001;
          const durationChanged =
            videoDuration != null &&
            (current.duration == null ||
              Math.abs(current.duration - videoDuration) > durationUpdateThreshold);
          if (!widthChanged && !heightChanged && !aspectChanged && !durationChanged) {
            return prev;
          }
          const next = [...prev];
          next[index] = {
            ...current,
            width,
            height,
            aspectRatio,
            ...(durationChanged ? { duration: videoDuration } : {}),
          };
          return next;
        });
      }
      // Avoid mutating timeline/transforms during export renders.
      if (isExportMode) {
        return;
      }
      // Also update the clip duration if it was based on fallback duration
      if (videoDuration != null) {
        setTimeline((prev) => {
          const clipIndex = prev.findIndex((clip) => clip.id === clipId);
          if (clipIndex < 0) {
            return prev;
          }
          const clip = prev[clipIndex];
          // Only auto-expand clips that are still using the default fallback
          // duration. This avoids overriding intentionally trimmed imports
          // (like Reddit gameplay clips capped to voiceover length).
          const clipUsesFallbackDuration = Math.abs(clip.duration - 8) <= 0.05;
          if (clipUsesFallbackDuration) {
            const newDuration = Math.max(0, videoDuration - clip.startOffset);
            if (Math.abs(clip.duration - newDuration) > 0.05) {
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
    [isExportMode]
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
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    const element = target as HTMLElement;
    const rootNode = element.getRootNode();
    const widgetHost =
      rootNode instanceof ShadowRoot ? rootNode.host : null;
    return (
      element.tagName === "INPUT" ||
      element.tagName === "TEXTAREA" ||
      element.tagName === "SELECT" ||
      element.tagName === "OPTION" ||
      element.tagName === "BUTTON" ||
      element.tagName === "A" ||
      element.isContentEditable ||
      element.getAttribute("role") === "textbox" ||
      element.getAttribute("role") === "searchbox" ||
      element.getAttribute("role") === "button" ||
      element.getAttribute("role") === "link" ||
      element.getAttribute("role") === "menuitem" ||
      Boolean(element.closest("[contenteditable=\"true\"]")) ||
      Boolean(
        element.closest(
          "button, a[href], [role=\"button\"], [role=\"link\"], [role=\"menuitem\"], [data-ignore-editor-shortcuts=\"true\"]"
        )
      ) ||
      Boolean(element.closest("lemon-slice-widget")) ||
      (widgetHost instanceof HTMLElement &&
        widgetHost.tagName === "LEMON-SLICE-WIDGET")
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
      subtitleSegments,
      export: exportPersistedRef.current,
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
      subtitleSegments,
    ]
  );

  const applyProjectState = useCallback(
    (payload: EditorProjectState) => {
      const snapshot = payload?.snapshot;
      if (snapshot) {
        applySnapshot(snapshot);
      }
      if (Array.isArray(payload?.subtitleSegments)) {
        setSubtitleSegments(payload.subtitleSegments);
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
      const exportState = payload?.export;
      if (exportState && typeof exportState === "object") {
        const nextJobId =
          typeof exportState.jobId === "string" && exportState.jobId.trim().length > 0
            ? exportState.jobId
            : null;
        const stageRaw =
          typeof exportState.stage === "string" ? exportState.stage : "";
        const progressRaw =
          typeof exportState.progress === "number"
            ? clamp(exportState.progress, 0, 1)
            : null;
        const hasSignal =
          Boolean(nextJobId) ||
          (typeof exportState.status === "string" && exportState.status !== "idle") ||
          (typeof progressRaw === "number" && progressRaw > 0) ||
          (typeof stageRaw === "string" && stageRaw.trim().length > 0);
        const nextStatus = normalizeExportStatus({
          value: exportState.status,
          hasSignal,
        });
        const nextProgress =
          typeof progressRaw === "number"
            ? progressRaw
            : nextStatus === "complete"
              ? 1
              : 0;
        const nextStage =
          stageRaw.trim().length > 0
            ? stageRaw
            : nextStatus === "complete"
              ? "Export ready"
              : nextStatus === "error"
                ? "Export failed"
                : hasSignal
                  ? "Exporting"
                  : "";
        const nextDownloadUrl =
          typeof exportState.downloadUrl === "string"
            ? exportState.downloadUrl
            : null;
        const nextExportState: ProjectExportState = {
          jobId: nextJobId,
          status: nextStatus,
          stage: nextStage,
          progress: nextProgress,
          downloadUrl: nextDownloadUrl,
          updatedAt:
            typeof exportState.updatedAt === "string" &&
            exportState.updatedAt.trim().length > 0
              ? exportState.updatedAt
              : new Date().toISOString(),
        };
        exportPersistedRef.current = nextExportState;
        setExportUi((prev) => ({
          ...prev,
          open: false,
          status: nextExportState.status,
          stage: nextExportState.stage,
          progress: nextExportState.progress,
          jobId: nextExportState.jobId,
          downloadUrl: nextExportState.downloadUrl,
          error:
            nextExportState.status === "error"
              ? nextExportState.stage || "Export failed"
              : null,
        }));
      }
      historyRef.current.past = [];
      historyRef.current.future = [];
      syncHistoryState();
    },
    [applySnapshot, syncHistoryState]
  );

  useEffect(() => {
    if (!isExportMode || typeof window === "undefined") {
      exportHydratedRef.current = false;
      setExportScaleMode("css");
      return;
    }
    exportHydratedRef.current = false;
    subtitleCacheReadyRef.current = false;
    exportMediaCacheRef.current.clear();
    exportMediaFailedRef.current.clear();
    let cancelled = false;
    const markHydrated = () => {
      if (cancelled) {
        return;
      }
      exportHydratedRef.current = true;
    };
    const payload = getEditorExportPayload();
    setExportScaleMode(payload?.renderScaleMode === "device" ? "device" : "css");
    if (payload?.output && typeof payload.output === "object") {
      const nextWidth = Number(payload.output.width);
      const nextHeight = Number(payload.output.height);
      if (Number.isFinite(nextWidth) && Number.isFinite(nextHeight)) {
        setExportViewport({
          width: ensureEven(nextWidth),
          height: ensureEven(nextHeight),
        });
      }
    }
    if (payload?.preview && typeof payload.preview === "object") {
      const previewWidth = Number(payload.preview.width);
      const previewHeight = Number(payload.preview.height);
      if (Number.isFinite(previewWidth) && Number.isFinite(previewHeight)) {
        setExportPreview({
          width: ensureEven(previewWidth),
          height: ensureEven(previewHeight),
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
      if (sanitizedSnapshot?.clipTransforms) {
        clipTransformTouchedRef.current = new Set(
          Object.keys(sanitizedSnapshot.clipTransforms)
        );
      }
      setProjectReady(true);
      setProjectStarted(true);
      setIsPlaying(false);
      requestAnimationFrame(() => requestAnimationFrame(markHydrated));
      return () => {
        cancelled = true;
        exportHydratedRef.current = false;
      };
    }
    setProjectReady(true);
    markHydrated();
    return () => {
      cancelled = true;
      exportHydratedRef.current = false;
    };
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
      const supabase = await getSupabaseClient();
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
        return null;
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
      const exportState = exportPersistedRef.current ?? state.export ?? null;
      const mergedState: EditorProjectState = exportState
        ? { ...state, export: exportState }
        : state;
      const exportSignal =
        Boolean(exportState?.jobId) ||
        (typeof exportState?.status === "string" && exportState.status !== "idle");
      const derivedStatus = deriveProjectStatusFromExportStatus({
        status: exportState?.status ?? null,
        hasSignal: exportSignal,
      });
      const { error } = await supabase.from("projects").upsert({
        id: resolvedId,
        user_id: user.id,
        title,
        kind: "editor",
        status: derivedStatus,
        project_state: mergedState,
      });
      if (error) {
        if (notifyNameSave) {
          setProjectSaveState("error");
          saveStatusTimeoutRef.current = window.setTimeout(() => {
            setShowSaveIndicator(false);
          }, 4000);
          projectNameSavePendingRef.current = false;
        }
        return null;
      }
      const assetIds = mergedState.snapshot.assets
        .filter((asset) => asset.kind !== "text")
        .map((asset) => asset.id)
        .filter((assetId): assetId is string => typeof assetId === "string");
      if (assetIds.length) {
        const uniqueAssetIds = Array.from(new Set(assetIds)).sort();
        const assetKey = uniqueAssetIds.join(",");
        const lastSync = projectAssetsSyncRef.current;
        if (lastSync.projectId !== resolvedId || lastSync.assetKey !== assetKey) {
          const response = await fetch("/api/projects/assets", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              projectId: resolvedId,
              assetIds: uniqueAssetIds,
              role: "source",
            }),
          });
          if (response.ok) {
            projectAssetsSyncRef.current = {
              projectId: resolvedId,
              assetKey,
            };
          }
        }
      }
      if (notifyNameSave) {
        setProjectSaveState("saved");
        saveStatusTimeoutRef.current = window.setTimeout(() => {
          setShowSaveIndicator(false);
        }, 2000);
        projectNameSavePendingRef.current = false;
      }
      return resolvedId;
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
	    assets.forEach((asset) => {
	      assetCacheRef.current.set(asset.id, asset);
	    });
	  }, [assets]);

	  useEffect(() => {
	    if (!projectReady) {
	      return;
	    }
	    const assetIds = new Set(assets.map((asset) => asset.id));
	    const missingAssetIds = Array.from(
	      new Set(
	        timeline
	          .map((clip) => clip.assetId)
	          .filter((assetId) => !assetIds.has(assetId))
	      )
	    );
	    if (missingAssetIds.length === 0) {
	      return;
	    }
	    const recoveredAssets = missingAssetIds
	      .map((assetId) => assetCacheRef.current.get(assetId) ?? null)
	      .filter((asset): asset is MediaAsset => Boolean(asset));
	    if (recoveredAssets.length === 0) {
	      splitImportLog("timeline missing assets (cache miss)", {
	        timelineClipCount: timeline.length,
	        assetCount: assets.length,
	        missingAssetIds,
	      });
	      return;
	    }
	    splitImportLog("restoring missing timeline assets from cache", {
	      timelineClipCount: timeline.length,
	      assetCount: assets.length,
	      missingAssetIds,
	      recoveredCount: recoveredAssets.length,
	    });
	    setAssets((prev) => {
	      const existing = new Set(prev.map((asset) => asset.id));
	      const additions = recoveredAssets.filter((asset) => !existing.has(asset.id));
	      if (additions.length === 0) {
	        return prev;
	      }
	      return [...additions, ...prev];
	    });
	  }, [assets, projectReady, timeline]);

  useEffect(() => {
    clipTransformsRef.current = clipTransforms;
  }, [clipTransforms]);

  useEffect(() => {
    snapGuidesRef.current = snapGuides;
  }, [snapGuides]);

  useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);

  useEffect(() => {
    if (isExportMode || typeof window === "undefined") {
      return;
    }
    const draftKey = `${AI_IMAGE_STORAGE_PREFIX}draft`;
    const storageKey = projectId
      ? `${AI_IMAGE_STORAGE_PREFIX}${projectId}`
      : draftKey;
    if (projectId) {
      const existing = window.localStorage.getItem(storageKey);
      if (!existing) {
        const draft = window.localStorage.getItem(draftKey);
        if (draft) {
          window.localStorage.setItem(storageKey, draft);
          window.localStorage.removeItem(draftKey);
        }
      }
    }
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setAiImagePrompt("");
      setAiImageAspectRatio("1:1");
      setAiImagePreview(null);
      setAiImageStatus("idle");
      setAiImageError(null);
      setAiImageSaving(false);
      setAiImageLastPrompt(null);
      setAiImageLastAspectRatio(null);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as {
        prompt?: string;
        aspectRatio?: string;
        preview?: AiImagePreview | null;
        lastPrompt?: string;
        lastAspectRatio?: string;
      };
      setAiImagePrompt(typeof parsed.prompt === "string" ? parsed.prompt : "");
      setAiImageAspectRatio(
        typeof parsed.aspectRatio === "string" ? parsed.aspectRatio : "1:1"
      );
      const preview =
        parsed.preview && typeof parsed.preview === "object"
          ? (parsed.preview as AiImagePreview)
          : null;
      setAiImagePreview(preview);
      setAiImageStatus(preview ? "ready" : "idle");
      setAiImageError(null);
      setAiImageSaving(false);
      setAiImageLastPrompt(
        typeof parsed.lastPrompt === "string" ? parsed.lastPrompt : null
      );
      setAiImageLastAspectRatio(
        typeof parsed.lastAspectRatio === "string"
          ? parsed.lastAspectRatio
          : null
      );
    } catch {
      setAiImagePrompt("");
      setAiImageAspectRatio("1:1");
      setAiImagePreview(null);
      setAiImageStatus("idle");
      setAiImageError(null);
      setAiImageSaving(false);
      setAiImageLastPrompt(null);
      setAiImageLastAspectRatio(null);
    }
  }, [isExportMode, projectId]);

  useEffect(() => {
    if (aiVideoGenerateAudio && !aiVideoSplitAudio) {
      setAiVideoSplitAudio(true);
      return;
    }
    if (!aiVideoGenerateAudio && aiVideoSplitAudio) {
      setAiVideoSplitAudio(false);
    }
  }, [aiVideoGenerateAudio, aiVideoSplitAudio]);

  useEffect(() => {
    if (isExportMode || typeof window === "undefined") {
      return;
    }
    const storageKey = projectId
      ? `${AI_IMAGE_STORAGE_PREFIX}${projectId}`
      : `${AI_IMAGE_STORAGE_PREFIX}draft`;
    const payload = {
      prompt: aiImagePrompt,
      aspectRatio: aiImageAspectRatio,
      preview: aiImagePreview,
      lastPrompt: aiImageLastPrompt,
      lastAspectRatio: aiImageLastAspectRatio,
    };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Ignore storage failures.
    }
  }, [
    aiImageAspectRatio,
    aiImageLastAspectRatio,
    aiImageLastPrompt,
    aiImagePreview,
    aiImagePrompt,
    isExportMode,
    projectId,
  ]);

  useEffect(() => {
    if (!aiImagePreview?.assetId) {
      return;
    }
    if (!assetLibraryReady && !projectReady) {
      return;
    }
    const asset = assets.find((item) => item.id === aiImagePreview.assetId);
    if (!asset) {
      setAiImagePreview(null);
      setAiImageStatus("idle");
      setAiImageLastPrompt(null);
      setAiImageLastAspectRatio(null);
      return;
    }
    const nextPreview: AiImagePreview = {
      url: asset.url,
      assetId: asset.id,
      name: asset.name,
      width: asset.width,
      height: asset.height,
      aspectRatio: asset.aspectRatio,
    };
    const hasDiff =
      aiImagePreview.url !== nextPreview.url ||
      aiImagePreview.name !== nextPreview.name ||
      aiImagePreview.width !== nextPreview.width ||
      aiImagePreview.height !== nextPreview.height ||
      aiImagePreview.aspectRatio !== nextPreview.aspectRatio;
    if (hasDiff) {
      setAiImagePreview(nextPreview);
    }
  }, [aiImagePreview, assetLibraryReady, assets, projectReady]);

  useEffect(() => {
    if (isExportMode || typeof window === "undefined") {
      return;
    }
    const draftKey = `${AI_VOICEOVER_STORAGE_PREFIX}draft`;
    const storageKey = projectId
      ? `${AI_VOICEOVER_STORAGE_PREFIX}${projectId}`
      : draftKey;
    if (projectId) {
      const existing = window.localStorage.getItem(storageKey);
      if (!existing) {
        const draft = window.localStorage.getItem(draftKey);
        if (draft) {
          window.localStorage.setItem(storageKey, draft);
          window.localStorage.removeItem(draftKey);
        }
      }
    }
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setAiVoiceoverScript("");
      setAiVoiceoverSelectedVoice(null);
      setAiVoiceoverPreview(null);
      setAiVoiceoverStatus("idle");
      setAiVoiceoverError(null);
      setAiVoiceoverSaving(false);
      setAiVoiceoverLastScript(null);
      setAiVoiceoverLastVoice(null);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as {
        script?: string;
        voice?: string;
        preview?: AiVoiceoverPreview | null;
        lastScript?: string;
        lastVoice?: string;
      };
      setAiVoiceoverScript(
        typeof parsed.script === "string" ? parsed.script : ""
      );
      setAiVoiceoverSelectedVoice(
        typeof parsed.voice === "string" ? parsed.voice : null
      );
      const preview =
        parsed.preview && typeof parsed.preview === "object"
          ? (parsed.preview as AiVoiceoverPreview)
          : null;
      setAiVoiceoverPreview(preview);
      setAiVoiceoverStatus(preview ? "ready" : "idle");
      setAiVoiceoverError(null);
      setAiVoiceoverSaving(false);
      setAiVoiceoverLastScript(
        typeof parsed.lastScript === "string" ? parsed.lastScript : null
      );
      setAiVoiceoverLastVoice(
        typeof parsed.lastVoice === "string" ? parsed.lastVoice : null
      );
    } catch {
      setAiVoiceoverScript("");
      setAiVoiceoverSelectedVoice(null);
      setAiVoiceoverPreview(null);
      setAiVoiceoverStatus("idle");
      setAiVoiceoverError(null);
      setAiVoiceoverSaving(false);
      setAiVoiceoverLastScript(null);
      setAiVoiceoverLastVoice(null);
    }
  }, [isExportMode, projectId]);

  useEffect(() => {
    if (isExportMode || typeof window === "undefined") {
      return;
    }
    const storageKey = projectId
      ? `${AI_VOICEOVER_STORAGE_PREFIX}${projectId}`
      : `${AI_VOICEOVER_STORAGE_PREFIX}draft`;
    const payload = {
      script: aiVoiceoverScript,
      voice: aiVoiceoverSelectedVoice,
      preview: aiVoiceoverPreview,
      lastScript: aiVoiceoverLastScript,
      lastVoice: aiVoiceoverLastVoice,
    };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Ignore storage failures.
    }
  }, [
    aiVoiceoverLastScript,
    aiVoiceoverLastVoice,
    aiVoiceoverPreview,
    aiVoiceoverScript,
    aiVoiceoverSelectedVoice,
    isExportMode,
    projectId,
  ]);

  useEffect(() => {
    if (!aiVoiceoverPreview?.assetId) {
      return;
    }
    if (!assetLibraryReady && !projectReady) {
      return;
    }
    const asset = assets.find((item) => item.id === aiVoiceoverPreview.assetId);
    if (!asset) {
      setAiVoiceoverPreview(null);
      setAiVoiceoverStatus("idle");
      setAiVoiceoverLastScript(null);
      setAiVoiceoverLastVoice(null);
      return;
    }
    const nextPreview: AiVoiceoverPreview = {
      url: asset.url,
      assetId: asset.id,
      name: asset.name,
      duration: asset.duration,
      voice: aiVoiceoverPreview.voice,
    };
    const hasDiff =
      aiVoiceoverPreview.url !== nextPreview.url ||
      aiVoiceoverPreview.name !== nextPreview.name ||
      aiVoiceoverPreview.duration !== nextPreview.duration;
    if (hasDiff) {
      setAiVoiceoverPreview(nextPreview);
    }
  }, [aiVoiceoverPreview, assetLibraryReady, assets, projectReady]);

  useEffect(() => {
    if (isExportMode || typeof window === "undefined") {
      return;
    }
    const draftKey = `${AI_VIDEO_STORAGE_PREFIX}draft`;
    const storageKey = projectId
      ? `${AI_VIDEO_STORAGE_PREFIX}${projectId}`
      : draftKey;
    if (projectId) {
      const existing = window.localStorage.getItem(storageKey);
      if (!existing) {
        const draft = window.localStorage.getItem(draftKey);
        if (draft) {
          window.localStorage.setItem(storageKey, draft);
          window.localStorage.removeItem(draftKey);
        }
      }
    }
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setAiVideoPrompt("");
      setAiVideoAspectRatio("16:9");
      setAiVideoDuration(8);
      setAiVideoGenerateAudio(true);
      setAiVideoSplitAudio(true);
      setAiVideoPreview(null);
      setAiVideoStatus("idle");
      setAiVideoError(null);
      setAiVideoSaving(false);
      setAiVideoMagicLoading(false);
      setAiVideoMagicError(null);
      setAiVideoLastPrompt(null);
      setAiVideoLastAspectRatio(null);
      setAiVideoLastDuration(null);
      setAiVideoLastGenerateAudio(null);
      setAiVideoLastSplitAudio(null);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as {
        prompt?: string;
        aspectRatio?: string;
        duration?: number;
        generateAudio?: boolean;
        splitAudio?: boolean;
        preview?: AiVideoPreview | null;
        lastPrompt?: string;
        lastAspectRatio?: string;
        lastDuration?: number;
        lastGenerateAudio?: boolean;
        lastSplitAudio?: boolean;
      };
      setAiVideoPrompt(typeof parsed.prompt === "string" ? parsed.prompt : "");
      setAiVideoAspectRatio(
        typeof parsed.aspectRatio === "string" ? parsed.aspectRatio : "16:9"
      );
      setAiVideoDuration(
        typeof parsed.duration === "number" &&
          Number.isFinite(parsed.duration) &&
          parsed.duration > 0
          ? parsed.duration
          : 8
      );
      const generateAudio =
        typeof parsed.generateAudio === "boolean" ? parsed.generateAudio : true;
      setAiVideoGenerateAudio(generateAudio);
      setAiVideoSplitAudio(generateAudio);
      const preview =
        parsed.preview && typeof parsed.preview === "object"
          ? (parsed.preview as AiVideoPreview)
          : null;
      setAiVideoPreview(preview);
      setAiVideoStatus(preview ? "ready" : "idle");
      setAiVideoError(null);
      setAiVideoSaving(false);
      setAiVideoMagicLoading(false);
      setAiVideoMagicError(null);
      setAiVideoLastPrompt(
        typeof parsed.lastPrompt === "string" ? parsed.lastPrompt : null
      );
      setAiVideoLastAspectRatio(
        typeof parsed.lastAspectRatio === "string"
          ? parsed.lastAspectRatio
          : null
      );
      setAiVideoLastDuration(
        typeof parsed.lastDuration === "number" &&
          Number.isFinite(parsed.lastDuration)
          ? parsed.lastDuration
          : null
      );
      setAiVideoLastGenerateAudio(
        typeof parsed.lastGenerateAudio === "boolean"
          ? parsed.lastGenerateAudio
          : null
      );
      setAiVideoLastSplitAudio(
        typeof parsed.lastSplitAudio === "boolean" ? parsed.lastSplitAudio : null
      );
    } catch {
      setAiVideoPrompt("");
      setAiVideoAspectRatio("16:9");
      setAiVideoDuration(8);
      setAiVideoGenerateAudio(true);
      setAiVideoSplitAudio(true);
      setAiVideoPreview(null);
      setAiVideoStatus("idle");
      setAiVideoError(null);
      setAiVideoSaving(false);
      setAiVideoMagicLoading(false);
      setAiVideoMagicError(null);
      setAiVideoLastPrompt(null);
      setAiVideoLastAspectRatio(null);
      setAiVideoLastDuration(null);
      setAiVideoLastGenerateAudio(null);
      setAiVideoLastSplitAudio(null);
    }
  }, [isExportMode, projectId]);

  useEffect(() => {
    if (isExportMode || typeof window === "undefined") {
      return;
    }
    const storageKey = projectId
      ? `${AI_VIDEO_STORAGE_PREFIX}${projectId}`
      : `${AI_VIDEO_STORAGE_PREFIX}draft`;
    const payload = {
      prompt: aiVideoPrompt,
      aspectRatio: aiVideoAspectRatio,
      duration: aiVideoDuration,
      generateAudio: aiVideoGenerateAudio,
      splitAudio: aiVideoSplitAudio,
      preview: aiVideoPreview,
      lastPrompt: aiVideoLastPrompt,
      lastAspectRatio: aiVideoLastAspectRatio,
      lastDuration: aiVideoLastDuration,
      lastGenerateAudio: aiVideoLastGenerateAudio,
      lastSplitAudio: aiVideoLastSplitAudio,
    };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Ignore storage failures.
    }
  }, [
    aiVideoAspectRatio,
    aiVideoDuration,
    aiVideoGenerateAudio,
    aiVideoLastAspectRatio,
    aiVideoLastDuration,
    aiVideoLastGenerateAudio,
    aiVideoLastPrompt,
    aiVideoLastSplitAudio,
    aiVideoPreview,
    aiVideoPrompt,
    aiVideoSplitAudio,
    isExportMode,
    projectId,
  ]);

  useEffect(() => {
    if (!aiVideoPreview?.assetId) {
      return;
    }
    if (!assetLibraryReady && !projectReady) {
      return;
    }
    const asset = assets.find((item) => item.id === aiVideoPreview.assetId);
    if (!asset) {
      setAiVideoPreview(null);
      setAiVideoStatus("idle");
      setAiVideoLastPrompt(null);
      setAiVideoLastAspectRatio(null);
      setAiVideoLastDuration(null);
      setAiVideoLastGenerateAudio(null);
      setAiVideoLastSplitAudio(null);
      return;
    }
    const nextPreview: AiVideoPreview = {
      url: asset.url,
      assetId: asset.id,
      audioAssetId: aiVideoPreview.audioAssetId ?? null,
      name: asset.name,
      duration: asset.duration,
      width: asset.width,
      height: asset.height,
      aspectRatio: asset.aspectRatio,
      generateAudio: aiVideoPreview.generateAudio,
      splitAudio: aiVideoPreview.splitAudio,
    };
    const hasDiff =
      aiVideoPreview.url !== nextPreview.url ||
      aiVideoPreview.name !== nextPreview.name ||
      aiVideoPreview.duration !== nextPreview.duration ||
      aiVideoPreview.width !== nextPreview.width ||
      aiVideoPreview.height !== nextPreview.height ||
      aiVideoPreview.aspectRatio !== nextPreview.aspectRatio;
    if (hasDiff) {
      setAiVideoPreview(nextPreview);
    }
  }, [aiVideoPreview, assetLibraryReady, assets, projectReady]);

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
      let storedAssets = await loadInitialAssetLibrary();
      if (!storedAssets.length && !cancelled) {
        // Supabase auth can be briefly unavailable on first hydration; retry once.
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 650);
        });
        storedAssets = await loadInitialAssetLibrary();
      }
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
      const resolveEditorProfileFromProjectName = (
        value: unknown
      ): "default" | "reddit" | "split" | "streamer" => {
        if (typeof value !== "string") {
          return "default";
        }
        const normalized = value.trim().toLowerCase();
        if (normalized.startsWith("reddit video")) {
          return "reddit";
        }
        if (normalized.startsWith("split screen")) {
          return "split";
        }
        if (normalized.startsWith("streamer video")) {
          return "streamer";
        }
        return "default";
      };
      const queryProjectId = searchParams.get("projectId");
      if (!queryProjectId) {
        if (isReloadNavigation()) {
          const reloadSession = readEditorReloadSessionState();
          if (!cancelled && reloadSession?.state) {
            applyProjectState(reloadSession.state);
            const reloadProjectName = reloadSession.state?.project?.name ?? "";
            setEditorProfile(
              resolveEditorProfileFromProjectName(reloadProjectName)
            );
            if (reloadSession.projectId) {
              setProjectId(reloadSession.projectId);
            }
            setProjectReady(true);
            return;
          }
        } else {
          clearEditorReloadSessionState();
        }
        if (!cancelled) {
          setEditorProfile("default");
        }
      }
      const supabase = await getSupabaseClient();
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        if (!cancelled) {
          setProjectReady(true);
        }
        return;
      }
      const fetchProjectById = async (id: string) => {
        const { data } = await supabase
          .from("projects")
          .select("id,title,project_state,kind,status,output_bucket,output_path")
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

      const libraryItemsPromise = loadInitialAssetLibrary();
      const project = await fetchProjectById(queryProjectId);

      if (!cancelled && project?.project_state) {
        applyProjectState(project.project_state as EditorProjectState);
        const projectStateName =
          project.project_state &&
          typeof project.project_state === "object" &&
          "project" in project.project_state &&
          project.project_state.project &&
          typeof project.project_state.project === "object" &&
          "name" in project.project_state.project
            ? project.project_state.project.name
            : null;
        const profileNameCandidate =
          typeof projectStateName === "string" && projectStateName.trim().length > 0
            ? projectStateName
            : project.title ?? "";
        setEditorProfile(
          resolveEditorProfileFromProjectName(profileNameCandidate)
        );
        const hasPersistedExportState =
          project.project_state &&
          typeof project.project_state === "object" &&
          "export" in project.project_state;
        if (!hasPersistedExportState) {
          const derivedExportState = deriveExportStateFromProjectRow(project);
          if (derivedExportState) {
            exportPersistedRef.current = derivedExportState;
            setExportUi((prev) => ({
              ...prev,
              open: false,
              status: derivedExportState.status,
              stage: derivedExportState.stage,
              progress: derivedExportState.progress,
              jobId: derivedExportState.jobId,
              downloadUrl: derivedExportState.downloadUrl,
              error:
                derivedExportState.status === "error"
                  ? derivedExportState.stage
                  : null,
            }));
          }
        }
        const libraryItems = await libraryItemsPromise;
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
      } else if (!cancelled) {
        setEditorProfile(
          resolveEditorProfileFromProjectName(project?.title ?? "")
        );
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
    if (isExportMode || typeof window === "undefined") {
      return;
    }
    if (!projectReady || !projectStarted) {
      return;
    }
    if (reloadStateSaveTimeoutRef.current) {
      window.clearTimeout(reloadStateSaveTimeoutRef.current);
    }
    reloadStateSaveTimeoutRef.current = window.setTimeout(() => {
      const state = buildProjectState();
      persistEditorReloadSessionState(state, projectIdRef.current);
    }, 350);
    return () => {
      if (reloadStateSaveTimeoutRef.current) {
        window.clearTimeout(reloadStateSaveTimeoutRef.current);
      }
    };
  }, [buildProjectState, isExportMode, projectReady, projectStarted, projectId]);

  useEffect(() => {
    if (isExportMode || typeof window === "undefined") {
      return;
    }
    const persistReloadState = () => {
      if (!projectReady) {
        return;
      }
      const state = buildProjectState();
      persistEditorReloadSessionState(state, projectIdRef.current);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        persistReloadState();
      }
    };
    window.addEventListener("beforeunload", persistReloadState);
    window.addEventListener("pagehide", persistReloadState);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", persistReloadState);
      window.removeEventListener("pagehide", persistReloadState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [buildProjectState, isExportMode, projectReady]);

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
      if (reloadStateSaveTimeoutRef.current) {
        window.clearTimeout(reloadStateSaveTimeoutRef.current);
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
    rangeSelectionRef.current = rangeSelection;
  }, [rangeSelection]);

  useEffect(() => {
    stageSelectionRef.current = stageSelection;
  }, [stageSelection]);

  useEffect(() => {
    dragTransformStateRef.current = dragTransformState;
  }, [dragTransformState]);

  useEffect(() => {
    resizeTransformStateRef.current = resizeTransformState;
  }, [resizeTransformState]);

  useEffect(() => {
    rotateTransformStateRef.current = rotateTransformState;
  }, [rotateTransformState]);

  useEffect(() => {
    trimStateRef.current = trimState;
  }, [trimState]);

  useEffect(() => {
    timelineScaleRef.current = timelineScale;
  }, [timelineScale]);

  useEffect(() => {
    isTimelineSnappingEnabledRef.current = isTimelineSnappingEnabled;
  }, [isTimelineSnappingEnabled]);

  useEffect(() => {
    timelineSnapGuideRef.current = timelineSnapGuide;
  }, [timelineSnapGuide]);

  useEffect(() => {
    timelineCollisionGuideRef.current = timelineCollisionGuide;
  }, [timelineCollisionGuide]);

  useEffect(() => {
    timelineCollisionActiveRef.current = timelineCollisionActive;
  }, [timelineCollisionActive]);

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
    if (isExportMode) {
      return;
    }
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
      // Keep subtitles/text above video, with audio at the bottom.
      next.sort((a, b) => {
        return laneTypePriority[a.type] - laneTypePriority[b.type];
      });
      return next;
    });
  }, [timeline, isExportMode]);

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
    if (isExportMode) {
      return;
    }
    if (activeTool !== "ai" || !hasSupabase) {
      return;
    }
    if (aiVoiceoverVoicesStatus === "ready" && aiVoiceoverVoices.length > 0) {
      return;
    }
    let cancelled = false;
    const loadId = aiVoiceoverVoicesLoadIdRef.current + 1;
    aiVoiceoverVoicesLoadIdRef.current = loadId;
    const loadVoices = async () => {
      setAiVoiceoverVoicesStatus("loading");
      setAiVoiceoverVoicesError(null);
      if (aiVoiceoverVoicesLoadTimeoutRef.current) {
        window.clearTimeout(aiVoiceoverVoicesLoadTimeoutRef.current);
      }
      aiVoiceoverVoicesLoadTimeoutRef.current = window.setTimeout(() => {
        setAiVoiceoverVoicesStatus((current) =>
          current === "loading" ? "error" : current
        );
        setAiVoiceoverVoicesError(
          "Voice previews timed out. Check storage list access."
        );
      }, 15000);
      try {
        const { supabaseBrowser } = await import("@/lib/supabase/browser");
        const bucket = supabaseBrowser.storage.from(TTS_VOICES_BUCKET_NAME);
        const listWithTimeout = async (path: string) => {
          let timeoutId: number | null = null;
          const timeoutPromise = new Promise<{
            data: null;
            error: Error;
          }>((_, reject) => {
            timeoutId = window.setTimeout(() => {
              reject(new Error("Voice preview request timed out."));
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
          return result;
        };
        const voices: AiVoiceoverVoice[] = [];
        const seenPaths = new Set<string>();
        const pushFiles = (
          items: Array<{
            id?: string | null;
            name: string;
            metadata?: { size?: number; mimetype?: string | null } | null;
          }>,
          prefix: string
        ) => {
          items.forEach((item) => {
            const mimeType = item.metadata?.mimetype ?? null;
            if (!isAudioFile(item.name, mimeType)) {
              return;
            }
            const path = prefix ? `${prefix}/${item.name}` : item.name;
            if (seenPaths.has(path)) {
              return;
            }
            const { data } = bucket.getPublicUrl(path);
            if (!data?.publicUrl) {
              return;
            }
            const label = formatStockLabel(item.name);
            seenPaths.add(path);
            voices.push({
              id: path,
              name: label,
              voice: label,
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
        const collectVoices = async (path: string) => {
          const { data, error } = await listWithTimeout(path);
          if (error) {
            throw error;
          }
          const entries = data ?? [];
          const files = entries.filter(isFileEntry);
          if (files.length > 0) {
            pushFiles(files, path);
          }
          const folders = entries.filter((item) => !isFileEntry(item));
          await Promise.all(
            folders.map((folder) => {
              const nextPath = path ? `${path}/${folder.name}` : folder.name;
              return collectVoices(nextPath);
            })
          );
        };
        const prefixCandidates = [TTS_VOICES_ROOT_PREFIX];
        if (!TTS_VOICES_ROOT_PREFIX) {
          prefixCandidates.push(TTS_VOICES_BUCKET_NAME);
        }
        const uniquePrefixes = Array.from(
          new Set(prefixCandidates.map((prefix) => prefix.trim()))
        );
        let lastError: unknown = null;
        for (const prefix of uniquePrefixes) {
          try {
            await collectVoices(prefix);
          } catch (error) {
            lastError = error;
          }
          if (voices.length > 0) {
            break;
          }
        }
        if (voices.length === 0 && lastError) {
          throw lastError;
        }
        if (cancelled || loadId !== aiVoiceoverVoicesLoadIdRef.current) {
          return;
        }
        voices.sort((a, b) => a.name.localeCompare(b.name));
        setAiVoiceoverVoices(voices);
        setAiVoiceoverVoicesStatus("ready");
      } catch (error) {
        if (cancelled || loadId !== aiVoiceoverVoicesLoadIdRef.current) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load voice previews from Supabase.";
        setAiVoiceoverVoicesError(message);
        setAiVoiceoverVoicesStatus("error");
      } finally {
        if (aiVoiceoverVoicesLoadTimeoutRef.current) {
          window.clearTimeout(aiVoiceoverVoicesLoadTimeoutRef.current);
          aiVoiceoverVoicesLoadTimeoutRef.current = null;
        }
      }
    };
    loadVoices();
    return () => {
      if (aiVoiceoverVoicesLoadTimeoutRef.current) {
        window.clearTimeout(aiVoiceoverVoicesLoadTimeoutRef.current);
        aiVoiceoverVoicesLoadTimeoutRef.current = null;
      }
      cancelled = true;
    };
  }, [
    activeTool,
    aiVoiceoverVoices,
    aiVoiceoverVoicesStatus,
    aiVoiceoverVoicesReloadKey,
    hasSupabase,
    isExportMode,
  ]);

  useEffect(() => {
    if (aiVoiceoverVoices.length === 0) {
      return;
    }
    const hasSelection =
      aiVoiceoverSelectedVoice &&
      aiVoiceoverVoices.some(
        (voice) => voice.voice === aiVoiceoverSelectedVoice
      );
    if (!hasSelection) {
      setAiVoiceoverSelectedVoice(aiVoiceoverVoices[0].voice);
    }
  }, [aiVoiceoverSelectedVoice, aiVoiceoverVoices]);

  useEffect(() => {
    if (isExportMode) {
      return;
    }
    if (activeTool !== "audio" || !hasSupabase) {
      return;
    }
    if (stockMusicSettledReloadKeyRef.current === stockMusicReloadKey) {
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
          const { data, error } = await listWithTimeout(path);
          if (error) {
            throw error;
          }
          const entries = data ?? [];
          const files = entries.filter(isFileEntry);
          if (files.length > 0) {
            const label = path
              ? formatStockLabel(path.split("/").pop() ?? "General")
              : "General";
            pushFiles(files, label, path);
          }
          const folders = entries.filter((item) => !isFileEntry(item));
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
        stockMusicSettledReloadKeyRef.current = stockMusicReloadKey;
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
        stockMusicSettledReloadKeyRef.current = stockMusicReloadKey;
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
  }, [activeTool, hasSupabase, isExportMode, stockMusicReloadKey]);

  useEffect(() => {
    if (isExportMode) {
      return;
    }
    if (activeTool !== "audio" || !hasSupabase) {
      return;
    }
    if (soundFxSettledReloadKeyRef.current === soundFxReloadKey) {
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
          const { data, error } = await listWithTimeout(path);
          if (error) {
            throw error;
          }
          const entries = data ?? [];
          const files = entries.filter(isFileEntry);
          if (files.length > 0) {
            const label = path
              ? formatStockLabel(path.split("/").pop() ?? "General")
              : "General";
            pushFiles(files, label, path);
          }
          const folders = entries.filter((item) => !isFileEntry(item));
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
        soundFxSettledReloadKeyRef.current = soundFxReloadKey;
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
        soundFxSettledReloadKeyRef.current = soundFxReloadKey;
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
  }, [activeTool, hasSupabase, isExportMode, soundFxReloadKey]);

  useEffect(() => {
    if (isExportMode) {
      return;
    }
    if (activeTool !== "video" || !hasSupabase) {
      return;
    }
    if (stockVideoSettledReloadKeyRef.current === stockVideoReloadKey) {
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
        type StockVideoListEntry = {
          id?: string | null;
          name: string;
          metadata?: { size?: number; mimetype?: string | null } | null;
        };

        const shouldStop = () =>
          cancelled || loadId !== stockVideoLoadIdRef.current;

        const isAbortLikeError = (error: unknown) => {
          if (!error) {
            return false;
          }
          const anyError = error as { name?: unknown; message?: unknown };
          const name =
            typeof anyError?.name === "string" ? anyError.name.toLowerCase() : "";
          if (name.includes("abort")) {
            return true;
          }
          const message =
            error instanceof Error
              ? error.message
              : typeof anyError?.message === "string"
                ? anyError.message
                : String(error);
          const normalized = message.toLowerCase();
          return normalized.includes("signal is aborted") || normalized.includes("abort");
        };

        const isRetryableFetchError = (error: unknown) => {
          if (!error) {
            return false;
          }
          const anyError = error as { name?: unknown; message?: unknown };
          const name =
            typeof anyError?.name === "string" ? anyError.name.toLowerCase() : "";
          if (name.includes("storageunknownerror")) {
            return true;
          }
          const message =
            error instanceof Error
              ? error.message
              : typeof anyError?.message === "string"
                ? anyError.message
                : String(error);
          const normalized = message.toLowerCase();
          return (
            normalized.includes("failed to fetch") ||
            normalized.includes("network") ||
            normalized.includes("load failed")
          );
        };

        const listWithTimeout = async (
          path: string,
          options?: { limit?: number; offset?: number }
        ) => {
          if (shouldStop()) {
            return { data: null as StockVideoListEntry[] | null, error: null as Error | null };
          }
          const limit = Math.max(1, Math.min(500, options?.limit ?? 200));
          const offset = Math.max(0, options?.offset ?? 0);

          const attempt = async () => {
            let timeoutId: number | null = null;
            const timeoutPromise = new Promise<never>((_, reject) => {
              timeoutId = window.setTimeout(() => {
                reject(new Error("Stock video request timed out."));
              }, 25000);
            });
            try {
              const result = (await Promise.race([
                bucket.list(path, {
                  limit,
                  offset,
                  sortBy: { column: "name", order: "asc" },
                }),
                timeoutPromise,
              ])) as {
                data: StockVideoListEntry[] | null;
                error: Error | null;
              };
              return result;
            } catch (error) {
              return {
                data: null,
                error: error instanceof Error ? error : new Error("Stock video list failed."),
              };
            } finally {
              if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
              }
            }
          };

          let result = await attempt();
          let retryCount = 0;
          while (
            result.error &&
            !shouldStop() &&
            (isAbortLikeError(result.error) || isRetryableFetchError(result.error)) &&
            retryCount < 2
          ) {
            retryCount += 1;
            await new Promise<void>((resolve) =>
              window.setTimeout(resolve, retryCount === 1 ? 350 : 900)
            );
            result = await attempt();
          }

          return result;
        };

        const listAllWithTimeout = async (path: string) => {
          const entries: StockVideoListEntry[] = [];
          const pageLimit = 200;
          let offset = 0;
          while (!shouldStop()) {
            const { data, error } = await listWithTimeout(path, {
              limit: pageLimit,
              offset,
            });
            if (error) {
              return { data: null as StockVideoListEntry[] | null, error };
            }
            const page = data ?? [];
            entries.push(...page);
            if (page.length < pageLimit) {
              break;
            }
            offset += pageLimit;
            // Safety: avoid infinite loops if pagination behaves unexpectedly.
            if (offset > 20000) {
              break;
            }
          }
          return { data: entries, error: null as Error | null };
        };
        const videos: StockVideoItem[] = [];
        const pushFiles = (
          items: StockVideoListEntry[],
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
          if (shouldStop()) {
            return;
          }
          const { data, error } = await listAllWithTimeout(path);
          if (shouldStop()) {
            return;
          }
          if (error) {
            if (isAbortLikeError(error)) {
              // Avoid noisy console errors for aborted requests (often caused by navigation / retries).
              throw new Error("Stock video request was cancelled. Please retry.");
            }
            if (path === stockVideoRootPrefix) {
              throw error;
            }
            // Skip failing subfolders so one transient network/storage failure doesn't blank the library.
            return;
          }
          const entries = data ?? [];
          const files = entries.filter(isFileEntry);
          if (files.length > 0) {
            pushFiles(files, path);
          }
          const folders = entries.filter((item) => !isFileEntry(item));
          for (const folder of folders) {
            if (shouldStop()) {
              return;
            }
            const nextPath = path ? `${path}/${folder.name}` : folder.name;
            // Sequential recursion prevents request floods that can trigger aborted fetches.
            // If you need more speed later, add a small concurrency pool.
            await collectVideos(nextPath);
          }
        };
        await collectVideos(stockVideoRootPrefix);
        if (cancelled || loadId !== stockVideoLoadIdRef.current) {
          return;
        }
        videos.sort((a, b) => a.name.localeCompare(b.name));
        stockVideoSettledReloadKeyRef.current = stockVideoReloadKey;
        setStockVideoItems(videos);
        setStockVideoStatus("ready");
      } catch (error) {
        if (cancelled || loadId !== stockVideoLoadIdRef.current) {
          return;
        }
        const isAbort =
          error instanceof Error &&
          (error.name.toLowerCase().includes("abort") ||
            error.message.toLowerCase().includes("signal is aborted") ||
            error.message.toLowerCase().includes("cancelled"));
        const message = isAbort
          ? "Stock video request was cancelled. Please retry."
          : error instanceof Error
            ? error.message
            : "Unable to load stock videos from Supabase.";
        stockVideoSettledReloadKeyRef.current = stockVideoReloadKey;
        if (!isAbort) {
          console.error("[stock-video] load failed", error);
        }
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
  }, [activeTool, hasSupabase, isExportMode, stockVideoReloadKey]);

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
    if (isExportMode) {
      return;
    }
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
    isExportMode,
  ]);

  useEffect(() => {
    if (isExportMode) {
      return;
    }
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
    isExportMode,
  ]);

  useEffect(() => {
    if (isExportMode) {
      return;
    }
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
  }, [activeTool, gifSearch, gifSearchLimit, giphyFetch, hasGiphy, isExportMode]);

  useEffect(() => {
    if (isExportMode) {
      return;
    }
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
    isExportMode,
  ]);

  useEffect(() => {
    if (isExportMode) {
      return;
    }
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
  }, [activeTool, stickerSearch, gifSearchLimit, giphyFetch, hasGiphy, isExportMode]);

  useEffect(() => {
    const viewport = stageViewportRef.current;
    if (!viewport) {
      return;
    }
    const updateSize = () => {
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      if (width > 0 && height > 0) {
        setStageViewport((prev) =>
          prev.width === width && prev.height === height
            ? prev
            : { width, height }
        );
        return;
      }
      const rect = viewport.getBoundingClientRect();
      setStageViewport((prev) =>
        prev.width === rect.width && prev.height === rect.height
          ? prev
          : { width: rect.width, height: rect.height }
      );
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
      setMainHeight((prev) => (prev === rect.height ? prev : rect.height));
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

  const createClip = useCallback(
    (
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
    },
    []
  );

  const createLaneId = useCallback(
    (
      type: LaneType,
      draft: TimelineLane[],
      options?: { placement?: "top" | "bottom" }
    ) => {
      const lane = { id: crypto.randomUUID(), type };
      const placement = options?.placement ?? "bottom";
      // Lane order: text on top, video in the middle, audio on bottom.
      if (placement === "top") {
        if (type === "text") {
          const firstTextIndex = draft.findIndex((item) => item.type === "text");
          if (firstTextIndex === -1) {
            draft.unshift(lane);
          } else {
            draft.splice(firstTextIndex, 0, lane);
          }
        } else if (type === "video") {
          const firstNonTextIndex = draft.findIndex((item) => item.type !== "text");
          if (firstNonTextIndex === -1) {
            draft.push(lane);
          } else {
            draft.splice(firstNonTextIndex, 0, lane);
          }
        } else {
          const firstAudioIndex = draft.findIndex((item) => item.type === "audio");
          if (firstAudioIndex === -1) {
            draft.push(lane);
          } else {
            draft.splice(firstAudioIndex, 0, lane);
          }
        }
        return lane.id;
      }
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
    },
    []
  );

  const insertLaneAtIndex = useCallback(
    (type: LaneType, draft: TimelineLane[], index: number) => {
      const lane = { id: crypto.randomUUID(), type };
      const safeIndex = Math.max(0, Math.min(index, draft.length));
      draft.splice(safeIndex, 0, lane);
      return lane.id;
    },
    []
  );

  const canInsertLaneBetween = useCallback(
    (laneType: LaneType, beforeType: LaneType, afterType: LaneType) => {
      return (
        laneTypePriority[beforeType] <= laneTypePriority[laneType] &&
        laneTypePriority[laneType] <= laneTypePriority[afterType]
      );
    },
    []
  );

  const sortLanesByType = useCallback((items: TimelineLane[]) => {
    return items
      .map((lane, index) => ({ lane, index }))
      .sort((a, b) => {
        const delta =
          laneTypePriority[a.lane.type] - laneTypePriority[b.lane.type];
        if (delta !== 0) {
          return delta;
        }
        return a.index - b.index;
      })
      .map((entry) => entry.lane);
  }, []);

  useEffect(() => {
    if (isExportMode) {
      return;
    }
    if (lanes.length < 2) {
      return;
    }
    const sorted = sortLanesByType(lanes);
    const isSameOrder = sorted.every((lane, index) => lane.id === lanes[index]?.id);
    if (!isSameOrder) {
      setLanes(sorted);
    }
  }, [lanes, sortLanesByType, isExportMode]);

  const filteredAssets = useMemo(() => {
    const uniqueAssets = dedupeMediaAssets(assets);
    if (assetFilter === "All") {
      return uniqueAssets.filter((asset) => asset.kind !== "text");
    }
    if (assetFilter === "Video") {
      return uniqueAssets.filter((asset) => asset.kind === "video");
    }
    if (assetFilter === "Images") {
      return uniqueAssets.filter((asset) => asset.kind === "image");
    }
    return uniqueAssets.filter((asset) => asset.kind === "audio");
  }, [assets, assetFilter]);

  const viewAllAssets = useMemo(() => {
    const query = deferredAssetSearch.trim().toLowerCase();
    if (!query) {
      return filteredAssets;
    }
    return filteredAssets.filter((asset) =>
      asset.name.toLowerCase().includes(query)
    );
  }, [deferredAssetSearch, filteredAssets]);

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
    const query = deferredStockSearch.trim().toLowerCase();
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
  }, [deferredStockSearch, stockCategory, stockMusic]);

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
    const query = deferredSoundFxSearch.trim().toLowerCase();
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
  }, [deferredSoundFxSearch, soundFxCategory, soundFx]);

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
    const query = deferredStockVideoSearch.trim().toLowerCase();
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
    deferredStockVideoSearch,
    stockVideoCategory,
    stockVideoItems,
    stockVideoOrientation,
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

  const assetById = useMemo(() => {
    const byId = new Map<string, MediaAsset>();
    assets.forEach((asset) => {
      byId.set(asset.id, asset);
    });
    return byId;
  }, [assets]);

  const timelineClips = useMemo(() => {
    return timeline
      .map((clip) => {
        const asset = assetById.get(clip.assetId);
        if (!asset) {
          return null;
        }
        return {
          clip,
          asset,
        };
      })
      .filter(Boolean) as { clip: TimelineClip; asset: MediaAsset }[];
  }, [assetById, timeline]);

  const timelineLayout = useMemo(() => {
    return timelineClips.map((entry) => ({
      ...entry,
      left: entry.clip.startTime ?? 0,
    }));
  }, [timelineClips]);

  const timelineLayoutByClipId = useMemo(() => {
    const byId = new Map<string, TimelineLayoutEntry>();
    timelineLayout.forEach((entry) => {
      byId.set(entry.clip.id, entry);
    });
    return byId;
  }, [timelineLayout]);

  const clipAssetKindMap = useMemo(() => {
    return new Map(
      timelineLayout.map((entry) => [entry.clip.id, entry.asset.kind])
    );
  }, [timelineLayout]);

  useEffect(() => {
    clipAssetKindMapRef.current = clipAssetKindMap;
  }, [clipAssetKindMap]);

  const subtitleClipIdSet = useMemo(() => {
    return new Set(subtitleSegments.map((segment) => segment.clipId));
  }, [subtitleSegments]);

  useEffect(() => {
    subtitleClipIdSetRef.current = subtitleClipIdSet;
  }, [subtitleClipIdSet]);
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

  const buildDragGroup = useCallback(
    (dragGroupIds: string[]) => {
      if (dragGroupIds.length <= 1) {
        return undefined;
      }
      const dragGroupClips = dragGroupIds
        .map((id) => {
          const entry = timelineLayoutByClipId.get(id);
          if (!entry) {
            return null;
          }
          return {
            id,
            startTime: entry.clip.startTime,
            duration: entry.clip.duration,
            laneId: entry.clip.laneId,
          };
        })
        .filter(
          (
            entry
          ): entry is {
            id: string;
            startTime: number;
            duration: number;
            laneId: string;
          } => Boolean(entry)
        );
      if (dragGroupClips.length <= 1) {
        return undefined;
      }
      const dragGroupIdSet = new Set(dragGroupClips.map((entry) => entry.id));
      const attachedSubtitleIds = new Set<string>();
      const attachedSubtitles: Array<{
        id: string;
        startTime: number;
        duration: number;
      }> = [];
      dragGroupClips.forEach((entry) => {
        const attached = subtitleSourceClipMap.get(entry.id);
        if (!attached || attached.length === 0) {
          return;
        }
        attached.forEach((subtitleId) => {
          if (
            dragGroupIdSet.has(subtitleId) ||
            attachedSubtitleIds.has(subtitleId)
          ) {
            return;
          }
          const subtitleEntry = timelineLayoutByClipId.get(subtitleId);
          if (!subtitleEntry) {
            return;
          }
          attachedSubtitleIds.add(subtitleId);
          attachedSubtitles.push({
            id: subtitleId,
            startTime: subtitleEntry.clip.startTime,
            duration: subtitleEntry.clip.duration,
          });
        });
      });
      const startTimes = [
        ...dragGroupClips.map((entry) => entry.startTime),
        ...attachedSubtitles.map((entry) => entry.startTime),
      ];
      const endTimes = [
        ...dragGroupClips.map((entry) => entry.startTime + entry.duration),
        ...attachedSubtitles.map((entry) => entry.startTime + entry.duration),
      ];
      return {
        clips: dragGroupClips,
        minStart: Math.min(...startTimes),
        maxEnd: Math.max(...endTimes),
        attachedSubtitles,
      };
    },
    [subtitleSourceClipMap, timelineLayoutByClipId]
  );

  useEffect(() => {
    subtitleSourceClipMapRef.current = subtitleSourceClipMap;
  }, [subtitleSourceClipMap]);

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
    if (isExportMode) {
      return;
    }
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
      const batchSize = 3;
      let batchedUpdates: Record<string, { key: string; frames: string[] }> = {};
      let batchCount = 0;
      const flushBatch = () => {
        if (batchCount === 0) {
          return;
        }
        const nextBatch = batchedUpdates;
        batchedUpdates = {};
        batchCount = 0;
        setTimelineThumbnails((prev) => ({ ...prev, ...nextBatch }));
      };
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
        await waitForIdle();
        if (cancelled || thumbnailJobRef.current !== jobId) {
          return;
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
        batchedUpdates[entry.clip.id] = {
          key,
          frames: normalizedFrames,
        };
        batchCount += 1;
        if (batchCount >= batchSize) {
          flushBatch();
          await waitForIdle();
        }
      }
      flushBatch();
    };
    void buildThumbnails();
    return () => {
      cancelled = true;
    };
  }, [isExportMode, timelineLayout, timelineScale]);

  useEffect(() => {
    if (isExportMode) {
      return;
    }
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
    const activeFetchControllers = new Set<AbortController>();
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
        let controller: AbortController | null = null;
        try {
          await waitForIdle();
          controller = new AbortController();
          activeFetchControllers.add(controller);
          const response = await fetch(asset.url, { signal: controller.signal });
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
          if (controller) {
            activeFetchControllers.delete(controller);
          }
          audioWaveformLoadingRef.current.delete(asset.id);
        }
      }
    };
    void buildWaveforms();
    return () => {
      cancelled = true;
      activeFetchControllers.forEach((controller) => controller.abort());
      activeFetchControllers.clear();
    };
  }, [getAudioContext, isExportMode, timelineLayout]);

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

  const clipZStride = useMemo(
    () => Math.max(1000, timelineLayout.length + 10),
    [timelineLayout.length]
  );

  const getClipZIndex = useCallback(
    (entry: TimelineLayoutEntry) => {
      const laneIndex = laneIndexMap.get(entry.clip.laneId) ?? 0;
      const laneRank = Math.max(1, lanes.length - laneIndex);
      const orderValue = clipOrder[entry.clip.id];
      const orderRank =
        Number.isFinite(orderValue) && (orderValue as number) > 0
          ? (orderValue as number)
          : 0;
      return laneRank * clipZStride + orderRank + 2;
    },
    [clipOrder, laneIndexMap, lanes.length, clipZStride]
  );

  useEffect(() => {
    if (timelineLayout.length === 0) {
      return;
    }
    if (isExportMode) {
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
    if (isExportMode) {
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
    if (isExportMode) {
      return;
    }
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
  }, [timelineLayout, isExportMode]);


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
  const aiBackgroundRemovalSelection = useMemo<AiBackgroundRemovalSelection>(() => {
    const candidateIds = new Set<string>();
    if (selectedClipIds.length > 0) {
      selectedClipIds.forEach((id) => candidateIds.add(id));
    } else {
      if (activeCanvasClipId) {
        candidateIds.add(activeCanvasClipId);
      }
      if (selectedClipId) {
        candidateIds.add(selectedClipId);
      }
    }
    if (candidateIds.size === 0) {
      return { state: "empty" };
    }
    if (candidateIds.size > 1) {
      return { state: "multi" };
    }
    const [targetId] = Array.from(candidateIds);
    const entry =
      timelineLayout.find((item) => item.clip.id === targetId) ?? null;
    if (!entry) {
      return { state: "empty" };
    }
    if (entry.asset.kind !== "video") {
      return {
        state: "invalid",
        clipId: targetId,
        label: entry.asset.name ?? "Clip",
      };
    }
    return {
      state: "ready",
      clipId: targetId,
      label: entry.asset.name ?? "Clip",
      duration: entry.clip.duration,
      entry,
    };
  }, [activeCanvasClipId, selectedClipId, selectedClipIds, timelineLayout]);
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

  useEffect(() => {
    selectedTextEntryRef.current = selectedTextEntry;
  }, [selectedTextEntry]);
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
  const deferredSubtitleSegmentsForSidebar = useDeferredValue(
    subtitleSegmentsWithClipTimes
  );
  const deferredTranscriptSegmentsForSidebar = useDeferredValue(
    transcriptSegments
  );

	  // Direct DOM manipulation for subtitle rendering - bypasses React entirely during playback
	  // This is how professional video players render subtitles for smooth performance
	  const activeSubtitleIndexRef = useRef<number>(-1);
	  const lastRenderedSubtitleIdRef = useRef<string | null>(null);
	  const activeSubtitleWordIndexRef = useRef<number>(-1);
	  const activeSubtitleBeatIndexRef = useRef<number>(-1);
	  const activeSubtitleBeatAnimationDoneRef = useRef<boolean>(false);
	  const lastSubtitleBeatLocalTimeRef = useRef<number>(-1);
	  const lastSubtitleEffectModeRef = useRef<"none" | "beat">("none");
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
      if (a.left !== b.left) {
        return a.left - b.left;
      }
      return a.clip.id.localeCompare(b.clip.id);
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

  useEffect(() => {
    visualStackRef.current = visualStack;
  }, [visualStack]);


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
    effectWords: TimedWord[];
    effectWordsSource: "segment" | "synthetic" | "none";
    beatEnabled: boolean;
    beatGroups: SubtitleBeatGroup[] | null;
    beatAnimate: boolean;
    beatEnterSeconds: number;
  }>>(new Map());
  const subtitleCacheReadyRef = useRef(false);
  
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
	        effectWords: TimedWord[];
	        effectWordsSource: "segment" | "synthetic" | "none";
	        beatEnabled: boolean;
	        beatGroups: SubtitleBeatGroup[] | null;
	        beatAnimate: boolean;
	        beatEnterSeconds: number;
	      }
	    >();
    const aspectRatio = stageAspectRatioRef.current || 16 / 9;
    
	    subtitleSegments.forEach(segment => {
	      const settings = textSettings[segment.clipId] ?? fallbackTextSettings;
	      const transform = clipTransforms[segment.clipId] ?? createSubtitleTransform(aspectRatio);
	      const effectiveText =
	        typeof settings.text === "string" && settings.text.trim().length > 0
	          ? settings.text
	          : segment.text;
	      // Beat mode is the default subtitle render mode; users opt out via `subtitleBeatEnabled: false`.
	      const beatEnabled = settings.subtitleBeatEnabled !== false;
	      const beatMinWords =
	        typeof settings.subtitleBeatMinWords === "number" && Number.isFinite(settings.subtitleBeatMinWords)
	          ? clamp(settings.subtitleBeatMinWords, 1, 6)
	          : 2;
	      const beatMaxWords =
	        typeof settings.subtitleBeatMaxWords === "number" && Number.isFinite(settings.subtitleBeatMaxWords)
	          ? clamp(settings.subtitleBeatMaxWords, beatMinWords, 8)
	          : Math.max(beatMinWords, 2);
	      const beatMaxSpanSeconds =
	        typeof settings.subtitleBeatMaxSpanSeconds === "number" &&
	        Number.isFinite(settings.subtitleBeatMaxSpanSeconds)
	          ? clamp(settings.subtitleBeatMaxSpanSeconds, 0.2, 3)
          : 1.2;
	      const beatLongPauseSeconds =
	        typeof settings.subtitleBeatLongPauseSeconds === "number" &&
	        Number.isFinite(settings.subtitleBeatLongPauseSeconds)
	          ? clamp(settings.subtitleBeatLongPauseSeconds, 0.05, 2)
	          : 0.25;

	      const wordHighlightEnabled = Boolean(settings.wordHighlightEnabled);
	      const wantsWordEffects = beatEnabled || wordHighlightEnabled;
	      const hasSegmentWords = Array.isArray(segment.words) && segment.words.length > 0;
	      const effectWords = hasSegmentWords
	        ? (segment.words as TimedWord[])
	        : wantsWordEffects
	          ? buildSyntheticTimedWords(effectiveText, segment.startTime, segment.endTime)
	          : [];
	      const effectWordsSource: "segment" | "synthetic" | "none" = hasSegmentWords
	        ? "segment"
	        : effectWords.length > 0
	          ? "synthetic"
	          : "none";
	      const beatGroups =
	        beatEnabled && effectWords.length > 0
	          ? buildSubtitleBeatGroups(effectWords, {
	              minWords: beatMinWords,
	              maxWords: beatMaxWords,
	              maxSpanSeconds: beatMaxSpanSeconds,
	              longPauseSeconds: beatLongPauseSeconds,
	            })
	          : null;
      const beatAnimate =
        beatEnabled
          ? settings.subtitleBeatAnimate !== false
          : false;
      const beatEnterSeconds =
        typeof settings.subtitleBeatEnterSeconds === "number" &&
        Number.isFinite(settings.subtitleBeatEnterSeconds)
          ? clamp(settings.subtitleBeatEnterSeconds, 0.05, 0.8)
          : 0.17;
	      cache.set(segment.clipId, {
	        text: effectiveText,
	        styles: getTextRenderStyles(settings),
	        transform,
	        wordHighlightEnabled,
	        wordHighlightColor: settings.wordHighlightColor ?? "#FDE047",
	        effectWords,
	        effectWordsSource,
	        beatEnabled,
	        beatGroups,
	        beatAnimate,
	        beatEnterSeconds,
	      });
	    });
    
    subtitleStyleCacheRef.current = cache;
    subtitleCacheReadyRef.current = true;
    
	    // Reset tracking refs when subtitle data changes to avoid stale matches
	    activeSubtitleIndexRef.current = -1;
	    lastRenderedSubtitleIdRef.current = null;
	    activeSubtitleWordIndexRef.current = -1;
	    activeSubtitleBeatIndexRef.current = -1;
	    activeSubtitleBeatAnimationDoneRef.current = false;
	    lastSubtitleBeatLocalTimeRef.current = -1;
	    lastSubtitleEffectModeRef.current = "none";
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
			        activeSubtitleBeatIndexRef.current = -1;
			        activeSubtitleBeatAnimationDoneRef.current = false;
			        lastSubtitleBeatLocalTimeRef.current = -1;
			        if (lastSubtitleEffectModeRef.current === "beat") {
			          if (textEl && textEl.style) {
			            textEl.style.transform = "";
			            textEl.style.opacity = "1";
			          }
			          lastSubtitleEffectModeRef.current = "none";
			        }
	        return;
	      }
      const { segment } = entry;
	      const cached = subtitleStyleCacheRef.current.get(segment.clipId);
	      if (!cached) {
	        activeSubtitleWordIndexRef.current = -1;
	        activeSubtitleBeatIndexRef.current = -1;
	        activeSubtitleBeatAnimationDoneRef.current = false;
	        lastSubtitleBeatLocalTimeRef.current = -1;
	        if (lastSubtitleEffectModeRef.current === "beat") {
	          textEl.style.transform = "";
	          textEl.style.opacity = "1";
	          lastSubtitleEffectModeRef.current = "none";
	        }
        return;
      }
	      const words = cached.effectWords ?? segment.words ?? [];

	      const canBeat =
	        cached.beatEnabled &&
	        Array.isArray(cached.beatGroups) &&
	        cached.beatGroups.length > 0 &&
        words.length > 0;

	      if (canBeat) {
	        const epsilon = 0.005;
	        const offset = entry.startTime - segment.startTime;
	        const localTime = offset ? time - offset : time;
	        const groups = cached.beatGroups as SubtitleBeatGroup[];
	        const previousLocalTime = lastSubtitleBeatLocalTimeRef.current;
	        if (
	          Number.isFinite(previousLocalTime) &&
	          previousLocalTime >= 0 &&
	          localTime < previousLocalTime - epsilon
	        ) {
	          // Scrubbed/jumped backwards within the same subtitle: re-enable deterministic animation.
	          activeSubtitleBeatAnimationDoneRef.current = false;
	        }
	        lastSubtitleBeatLocalTimeRef.current = localTime;

	        const lastBeatIndex = activeSubtitleBeatIndexRef.current;
	        let nextBeatIndex =
	          Number.isFinite(lastBeatIndex) && lastBeatIndex >= 0
	            ? lastBeatIndex
	            : 0;
	        if (nextBeatIndex >= groups.length) {
	          nextBeatIndex = 0;
	        }

	        const currentStart = groups[nextBeatIndex]?.start ?? 0;
	        if (localTime < currentStart - epsilon) {
	          // Time moved backwards (seek/scrub) - binary search for the last group that has started.
	          let low = 0;
	          let high = groups.length - 1;
	          let best = 0;
	          while (low <= high) {
	            const mid = (low + high) >> 1;
	            if (localTime >= groups[mid].start - epsilon) {
	              best = mid;
	              low = mid + 1;
	            } else {
	              high = mid - 1;
	            }
	          }
	          nextBeatIndex = best;
	        } else {
	          // Forward playback: advance from the current index.
	          while (
	            nextBeatIndex + 1 < groups.length &&
	            localTime >= groups[nextBeatIndex + 1].start - epsilon
	          ) {
	            nextBeatIndex += 1;
	          }
	        }

	        const nextGroup = groups[nextBeatIndex];
	        const nextText = nextGroup?.text ?? cached.text;
	        const beatChanged =
	          force || nextBeatIndex !== activeSubtitleBeatIndexRef.current;
	        const canBeatWordHighlight =
	          cached.wordHighlightEnabled &&
	          cached.effectWordsSource === "segment" &&
	          words.length > 0 &&
	          Boolean(nextGroup);
	        let beatWordAbsoluteIndex = -1;
	        let beatWordRelativeIndex = -1;
	        if (canBeatWordHighlight && nextGroup) {
	          const activeWordIdx = findActiveWordIndex(words, localTime);
	          if (
	            activeWordIdx >= nextGroup.startWordIndex &&
	            activeWordIdx <= nextGroup.endWordIndex
	          ) {
	            beatWordAbsoluteIndex = activeWordIdx;
	            beatWordRelativeIndex = activeWordIdx - nextGroup.startWordIndex;
	          }
	        }
	        const beatWordChanged =
	          beatWordAbsoluteIndex !== activeSubtitleWordIndexRef.current;

	        if (beatChanged) {
	          activeSubtitleBeatIndexRef.current = nextBeatIndex;
	          activeSubtitleBeatAnimationDoneRef.current = false;
	        }

	        if (canBeatWordHighlight && nextGroup) {
	          if (beatChanged || force || beatWordChanged) {
	            const groupWords = words.slice(
	              nextGroup.startWordIndex,
	              nextGroup.endWordIndex + 1
	            );
	            textEl.innerHTML = buildHighlightedSubtitleHtml(
	              groupWords,
	              beatWordRelativeIndex,
	              cached.wordHighlightColor
	            );
	            activeSubtitleWordIndexRef.current = beatWordAbsoluteIndex;
	          }
	        } else {
	          activeSubtitleWordIndexRef.current = -1;
	          if (beatChanged || force) {
	            textEl.textContent = nextText;
	          }
	        }

		        if (cached.beatAnimate) {
		          const enterSeconds = cached.beatEnterSeconds;
		          const beatStart = nextGroup?.start ?? localTime;
		          const beatEnd = nextGroup?.end ?? beatStart + enterSeconds;
		          const beatDuration = Math.max(0.01, beatEnd - beatStart);
		          const fastBeat = beatDuration < 0.3;
		          const elapsed = Math.max(0, localTime - beatStart);
		          if (
		            !force &&
		            !beatChanged &&
		            !beatWordChanged &&
		            activeSubtitleBeatAnimationDoneRef.current &&
		            elapsed >= enterSeconds
		          ) {
		            // Animation has settled and time is still moving forward; avoid per-frame DOM writes.
		            return;
		          }
		          const progress = computeBeatEnterProgress(elapsed, enterSeconds);
		          const translateFrom = nextGroup?.emphasis
		            ? fastBeat
		              ? 8
		              : 12
		            : fastBeat
		              ? 5
		              : 9;
		          const scaleFrom = nextGroup?.emphasis
		            ? fastBeat
		              ? 0.98
		              : 0.95
		            : fastBeat
		              ? 0.992
		              : 0.975;
		          const opacityFrom = fastBeat ? 0.9 : 0.84;
		          const baseTranslateY = translateFrom * (1 - progress);
		          const scale = scaleFrom + (1 - scaleFrom) * progress;
		          const opacity = opacityFrom + (1 - opacityFrom) * progress;
		          const translateY = Math.round(baseTranslateY * 100) / 100;
		          const roundedScale = Math.round(scale * 10000) / 10000;
		          const roundedOpacity = Math.round(opacity * 1000) / 1000;
		          textEl.style.transform = `translate3d(0, ${translateY}px, 0) scale(${roundedScale})`;
		          textEl.style.opacity = String(roundedOpacity);
		          lastSubtitleEffectModeRef.current = "beat";
		          if (elapsed >= enterSeconds) {
		            activeSubtitleBeatAnimationDoneRef.current = true;
		          }
		        } else if (lastSubtitleEffectModeRef.current === "beat") {
		          textEl.style.transform = "";
		          textEl.style.opacity = "1";
		          activeSubtitleBeatAnimationDoneRef.current = false;
		          lastSubtitleBeatLocalTimeRef.current = -1;
	          lastSubtitleEffectModeRef.current = "none";
	        }
	        return;
	      }

	      if (lastSubtitleEffectModeRef.current === "beat") {
	        textEl.style.transform = "";
	        textEl.style.opacity = "1";
	        lastSubtitleEffectModeRef.current = "none";
	      }
	      activeSubtitleBeatIndexRef.current = -1;
	      activeSubtitleBeatAnimationDoneRef.current = false;
	      lastSubtitleBeatLocalTimeRef.current = -1;

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
      const epsilon = 0.02;
      const offset = entry.startTime - segment.startTime;
      const localTime = offset ? time - offset : time;
      const nextIndex = findActiveWordIndex(words, localTime, epsilon);
      if (!force && nextIndex === activeSubtitleWordIndexRef.current) {
        return;
      }
      activeSubtitleWordIndexRef.current = nextIndex;
      textEl.innerHTML = buildHighlightedSubtitleHtml(words, nextIndex, cached.wordHighlightColor);
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
	      activeSubtitleBeatIndexRef.current = -1;
	      activeSubtitleBeatAnimationDoneRef.current = false;
	      lastSubtitleBeatLocalTimeRef.current = -1;
	      if (lastSubtitleEffectModeRef.current === "beat") {
	        textEl.style.transform = "";
	        textEl.style.opacity = "1";
	        lastSubtitleEffectModeRef.current = "none";
	      }
      return;
    }
    
    const cached = subtitleStyleCacheRef.current.get(clipId);
	    if (!cached) {
	      overlay.style.opacity = '0';
	      overlay.style.visibility = 'hidden';
	      overlay.style.pointerEvents = 'none';
	      delete overlay.dataset.clipId;
	      activeSubtitleWordIndexRef.current = -1;
	      activeSubtitleBeatIndexRef.current = -1;
	      activeSubtitleBeatAnimationDoneRef.current = false;
	      lastSubtitleBeatLocalTimeRef.current = -1;
	      if (lastSubtitleEffectModeRef.current === "beat") {
	        textEl.style.transform = "";
	        textEl.style.opacity = "1";
	        lastSubtitleEffectModeRef.current = "none";
	      }
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
    const exportScale =
      isExportMode && exportScaleMode === "device"
        ? exportSubtitleScaleRef.current
        : 1;
    const scaleTextShadow = (shadow: string, scale: number) => {
      if (!shadow || shadow === "none" || scale === 1) {
        return shadow || "none";
      }
      const trimmed = shadow.trim();
      const match = trimmed.match(
        /^(-?\d*\.?\d+)px\s+(-?\d*\.?\d+)px\s+(-?\d*\.?\d+)px\s+(.+)$/
      );
      if (!match) {
        return shadow;
      }
      const [, x, y, blur, color] = match;
      const nextX = Number(x) * scale;
      const nextY = Number(y) * scale;
      const nextBlur = Number(blur) * scale;
      return `${nextX}px ${nextY}px ${nextBlur}px ${color}`;
    };
    const fontSize =
      typeof s.fontSize === "number"
        ? `${s.fontSize * exportScale}px`
        : (s.fontSize as string || "");
    const letterSpacing =
      typeof s.letterSpacing === "number"
        ? `${s.letterSpacing * exportScale}px`
        : (s.letterSpacing as string || "");
    const textShadowBase = (s.textShadow as string) || "none";
    const textShadow =
      exportScale !== 1
        ? scaleTextShadow(textShadowBase, exportScale)
        : textShadowBase;
    textEl.style.fontFamily = (s.fontFamily as string) || "";
    textEl.style.fontSize = fontSize;
    textEl.style.fontWeight = String(s.fontWeight || "");
    textEl.style.fontStyle = (s.fontStyle as string) || "";
    textEl.style.lineHeight = String(s.lineHeight || "");
    textEl.style.letterSpacing = letterSpacing;
    textEl.style.color = (s.color as string) || "";
    textEl.style.textShadow = textShadow;
    textEl.style.textAlign = (s.textAlign as string) || "center";
    if (s.WebkitTextStrokeWidth) {
      (textEl.style as unknown as Record<string, unknown>).webkitTextStrokeWidth =
        typeof s.WebkitTextStrokeWidth === "number"
          ? `${s.WebkitTextStrokeWidth * exportScale}px`
          : s.WebkitTextStrokeWidth;
      (textEl.style as unknown as Record<string, unknown>).webkitTextStrokeColor =
        (s.WebkitTextStrokeColor as string) || "";
    } else {
      (textEl.style as unknown as Record<string, unknown>).webkitTextStrokeWidth = "";
      (textEl.style as unknown as Record<string, unknown>).webkitTextStrokeColor = "";
    }
    // Background styles
    if (s.backgroundColor) {
      textEl.style.backgroundColor = s.backgroundColor as string;
      textEl.style.padding = s.padding as string || '';
      textEl.style.borderRadius =
        typeof s.borderRadius === "number"
          ? `${s.borderRadius * exportScale}px`
          : (s.borderRadius as string || "");
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
  }, [exportScaleMode, isExportMode, updateSubtitleWordHighlight]);

  const refreshSubtitleRender = useCallback(() => {
    if (!subtitleCacheReadyRef.current) {
      return;
    }
    const clipId = lastRenderedSubtitleIdRef.current;
    if (!clipId) {
      return;
    }
    let entry: { segment: SubtitleSegment; startTime: number } | null = null;
    const activeIdx = activeSubtitleIndexRef.current;
    if (activeIdx >= 0 && activeIdx < sortedSubtitleClips.length) {
      entry = sortedSubtitleClips[activeIdx];
    } else {
      entry =
        sortedSubtitleClips.find(
          (item) => item.segment.clipId === clipId
        ) ?? null;
    }
    updateSubtitleDOM(clipId, entry, playbackTimeRef.current);
  }, [sortedSubtitleClips, updateSubtitleDOM]);

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
	          activeSubtitleBeatIndexRef.current = -1;
	          activeSubtitleBeatAnimationDoneRef.current = false;
	          lastSubtitleBeatLocalTimeRef.current = -1;
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
	        activeSubtitleBeatIndexRef.current = -1;
	        activeSubtitleBeatAnimationDoneRef.current = false;
	        lastSubtitleBeatLocalTimeRef.current = -1;
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
	    activeSubtitleBeatIndexRef.current = -1;
	    activeSubtitleBeatAnimationDoneRef.current = false;
	    lastSubtitleBeatLocalTimeRef.current = -1;
	    lastSubtitleEffectModeRef.current = "none";
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
	  const subtitleUiFrameSecondsRef = useRef(1 / 30);

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

  useEffect(() => {
    if (!isExportMode || exportScaleMode === "css") {
      const prevScale = exportSubtitleScaleRef.current;
      exportSubtitleScaleRef.current = 1;
      if (prevScale !== 1) {
        refreshSubtitleRender();
      }
      return;
    }
    const previewWidth = exportPreview?.width ?? 0;
    const previewHeight = exportPreview?.height ?? 0;
    if (
      previewWidth > 0 &&
      previewHeight > 0 &&
      stageDisplay.width > 0 &&
      stageDisplay.height > 0
    ) {
      const nextScale = Math.min(
        stageDisplay.width / previewWidth,
        stageDisplay.height / previewHeight
      );
      const resolvedScale =
        Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1;
      const prevScale = exportSubtitleScaleRef.current;
      exportSubtitleScaleRef.current = resolvedScale;
      if (Math.abs(prevScale - resolvedScale) > 0.001) {
        refreshSubtitleRender();
      }
      return;
    }
    const prevScale = exportSubtitleScaleRef.current;
    exportSubtitleScaleRef.current = 1;
    if (prevScale !== 1) {
      refreshSubtitleRender();
    }
  }, [
    exportPreview?.height,
    exportPreview?.width,
    exportScaleMode,
    isExportMode,
    refreshSubtitleRender,
    stageDisplay.height,
    stageDisplay.width,
  ]);

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
    baseBackgroundTransformRef.current = baseBackgroundTransform;
  }, [baseBackgroundTransform]);

  useEffect(() => {
    if (timelineClips.length === 0) {
      return;
    }
    if (isExportMode) {
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
  }, [
    timelineClips,
    stageAspectRatio,
    stageSize.height,
    stageSize.width,
    isExportMode,
  ]);

  useEffect(() => {
    if (timelineLayout.length === 0) {
      return;
    }
    if (isExportMode) {
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
    isExportMode,
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

  const originalExportSize = useMemo<ExportOutput | null>(() => {
    if (projectSizeId !== "original") {
      return null;
    }
    const visuals = timelineLayout
      .map((entry) => entry.asset)
      .filter((asset) => asset.kind === "video" || asset.kind === "image");
    if (visuals.length === 0) {
      return null;
    }
    const candidates = visuals.filter((asset) => {
      const width = asset.width ?? 0;
      const height = asset.height ?? 0;
      return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
    });
    if (candidates.length === 0) {
      return null;
    }
    const targetAspect =
      Number.isFinite(projectAspectRatio) && projectAspectRatio > 0
        ? projectAspectRatio
        : null;
    const tolerance = 0.02;
    const matching = targetAspect
      ? candidates.filter((asset) => {
          const width = asset.width ?? 0;
          const height = asset.height ?? 1;
          const ratio = width / height;
          return Math.abs(ratio - targetAspect) <= tolerance;
        })
      : candidates;
    const pool = matching.length > 0 ? matching : candidates;
    const best = pool.reduce((current, asset) => {
      const currentArea = (current.width ?? 0) * (current.height ?? 0);
      const area = (asset.width ?? 0) * (asset.height ?? 0);
      return area > currentArea ? asset : current;
    });
    return {
      width: ensureEven(best.width ?? 0),
      height: ensureEven(best.height ?? 0),
    };
  }, [projectAspectRatio, projectSizeId, timelineLayout]);

  const exportDimensions = useMemo<ExportOutput>(() => {
    if (resolvedProjectSize?.width && resolvedProjectSize?.height) {
      return {
        width: ensureEven(resolvedProjectSize.width),
        height: ensureEven(resolvedProjectSize.height),
      };
    }
    if (originalExportSize) {
      return originalExportSize;
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
  }, [
    originalExportSize,
    projectAspectRatio,
    resolvedProjectSize?.height,
    resolvedProjectSize?.width,
  ]);

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
          if (exportScaleMode === "device") {
            if (!exportPreview?.width || !exportPreview?.height) {
              await waitFrame();
              continue;
            }
            const nextScale = Math.min(
              rect.width / exportPreview.width,
              rect.height / exportPreview.height
            );
            const resolvedScale =
              Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1;
            const prevScale = exportSubtitleScaleRef.current;
            exportSubtitleScaleRef.current = resolvedScale;
            if (Math.abs(prevScale - resolvedScale) > 0.001) {
              refreshSubtitleRender();
            }
            return;
          }
          const prevScale = exportSubtitleScaleRef.current;
          exportSubtitleScaleRef.current = 1;
          if (prevScale !== 1) {
            refreshSubtitleRender();
          }
          return;
        }
      }
      await waitFrame();
    }
  }, [
    exportPreview?.height,
    exportPreview?.width,
    exportScaleMode,
    refreshSubtitleRender,
  ]);

  const waitForExportSubtitles = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }
    const start = performance.now();
    const waitFrame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    while (performance.now() - start < 15000) {
      if (subtitleCacheReadyRef.current) {
        return;
      }
      await waitFrame();
    }
  }, []);

  const waitForExportState = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }
    const start = performance.now();
    const waitFrame = () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    while (performance.now() - start < 15000) {
      if (exportHydratedRef.current) {
        return;
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
    const extractBackgroundUrls = (value: string) => {
      const urls: string[] = [];
      if (!value || value === "none") {
        return urls;
      }
      const regex = /url\((['"]?)(.*?)\1\)/g;
      let match = regex.exec(value);
      while (match) {
        const url = match[2];
        if (url) {
          urls.push(url);
        }
        match = regex.exec(value);
      }
      return urls;
    };
    const backgroundUrls = new Set<string>();
    const backgroundElements = Array.from(
      stage.querySelectorAll<HTMLElement>("[style*='background-image']")
    );
    backgroundElements.forEach((element) => {
      extractBackgroundUrls(element.style.backgroundImage).forEach((url) =>
        backgroundUrls.add(url)
      );
    });
    const withTimeout = (promise: Promise<void>, label: string) =>
      new Promise<boolean>((resolve) => {
        let done = false;
        const timeoutId = window.setTimeout(() => {
          if (!done) {
            console.warn(`[export] media timeout: ${label}`);
            done = true;
            resolve(false);
          }
        }, 8000);
        promise
          .then(() => {
            if (done) {
              return;
            }
            done = true;
            window.clearTimeout(timeoutId);
            resolve(true);
          })
          .catch(() => {
            if (done) {
              return;
            }
            done = true;
            window.clearTimeout(timeoutId);
            resolve(false);
          });
      });
    await Promise.all(
      images.map((img) =>
        withTimeout(
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          }),
          img.currentSrc || img.src || "image"
        )
      )
    );
    const cachedBackgrounds = exportMediaCacheRef.current;
    await Promise.all(
      Array.from(backgroundUrls)
        .filter((url) => !cachedBackgrounds.has(url))
        .map((url) =>
          withTimeout(
            new Promise<void>((resolve) => {
              const image = new Image();
              const done = () => {
                cachedBackgrounds.add(url);
                resolve();
              };
              image.addEventListener("load", done, { once: true });
              image.addEventListener("error", done, { once: true });
              image.src = url;
              if (image.complete) {
                done();
              }
            }),
            url
          )
        )
    );
    const failedMedia = exportMediaFailedRef.current;
    await Promise.all(
      videos.map(async (video) => {
        const label = video.currentSrc || video.src || "video";
        if (failedMedia.has(label)) {
          return;
        }
        const ok = await withTimeout(
          new Promise<void>((resolve, reject) => {
            if (video.readyState >= 2 && !video.seeking) {
              resolve();
              return;
            }
            const done = () => resolve();
            const fail = () => reject(new Error("video error"));
            video.addEventListener("loadeddata", done, { once: true });
            video.addEventListener("canplay", done, { once: true });
            video.addEventListener("seeked", done, { once: true });
            video.addEventListener("error", fail, { once: true });
          }),
          label
        );
        if (!ok) {
          failedMedia.add(label);
          console.warn(`[export] skipping further waits for ${label}`);
        }
      })
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
    const payload = getEditorExportPayload();
    const fonts = Array.isArray(payload?.fonts) ? payload.fonts : [];
    window.__EDITOR_EXPORT_API__ = {
      waitForReady: async () => {
        await waitForExportStage();
        await waitForExportState();
        await waitForExportSubtitles();
        await waitForExportFonts(fonts);
        await waitForExportMedia();
      },
      setTime: async (time: number) => {
        setIsPlaying(false);
        setCurrentTime(time);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        );
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        await waitForExportMedia();
        updateSubtitleForTimeRef.current(time);
      },
      getStageSelector: () => "[data-export-stage]",
    };
    return () => {
      delete window.__EDITOR_EXPORT_API__;
    };
  }, [
    isExportMode,
    waitForExportFonts,
    waitForExportMedia,
    waitForExportState,
    waitForExportStage,
    waitForExportSubtitles,
  ]);

  const buildExportState = useCallback(() => {
    const state = buildProjectState();
    const stateWithoutExport = { ...state };
    delete (stateWithoutExport as { export?: ProjectExportState | null }).export;
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
      ...stateWithoutExport,
      snapshot,
    };
  }, [buildProjectState]);

  const ALL_EXPORT_STATUSES: ExportStatus[] = [
    "idle",
    "starting",
    "queued",
    "loading",
    "rendering",
    "encoding",
    "uploading",
    "complete",
    "error",
  ];
  const EXPORT_STATUS_SET = new Set<ExportStatus>(ALL_EXPORT_STATUSES);
  const EXPORT_IN_FLIGHT_SET = new Set<ExportStatus>([
    "starting",
    "queued",
    "loading",
    "rendering",
    "encoding",
    "uploading",
  ]);

  const COMPLETE_EXPORT_STATUSES = new Set([
    "complete",
    "completed",
    "success",
    "succeeded",
    "done",
    "rendered",
  ]);

  const ERROR_EXPORT_STATUSES = new Set([
    "error",
    "failed",
    "failure",
    "cancelled",
    "canceled",
  ]);

  const isExportInFlightStatus = (status: ExportStatus) =>
    EXPORT_IN_FLIGHT_SET.has(status);

  const normalizeExportStatus = ({
    value,
    hasSignal,
  }: {
    value: unknown;
    hasSignal: boolean;
  }): ExportStatus => {
    if (typeof value !== "string") {
      return hasSignal ? "rendering" : "idle";
    }
    const normalized = value.toLowerCase();
    if (COMPLETE_EXPORT_STATUSES.has(normalized)) {
      return "complete";
    }
    if (ERROR_EXPORT_STATUSES.has(normalized)) {
      return "error";
    }
    if (EXPORT_STATUS_SET.has(normalized as ExportStatus)) {
      return normalized as ExportStatus;
    }
    if (normalized === "idle") {
      return hasSignal ? "rendering" : "idle";
    }
    // Unknown non-terminal statuses should still be treated as in-flight.
    return hasSignal ? "rendering" : "idle";
  };

  const deriveProjectStatusFromExportStatus = ({
    status,
    hasSignal,
  }: {
    status: ExportStatus | null;
    hasSignal: boolean;
  }) => {
    if (!status && !hasSignal) return "draft";
    if (status === "complete") return "rendered";
    if (status === "error") return "error";
    if (status === "idle") return hasSignal ? "rendering" : "draft";
    if (status && isExportInFlightStatus(status)) return "rendering";
    return hasSignal ? "rendering" : "draft";
  };

  const parseExportJobIdFromPath = (value: string | null | undefined) => {
    if (!value) {
      return null;
    }
    const match = value.match(/exports\/([^/]+)\/export\.mp4$/);
    return match?.[1] ?? null;
  };

  const deriveExportStateFromProjectRow = (project: {
    status?: string | null;
    output_path?: string | null;
    output_bucket?: string | null;
  }): ProjectExportState | null => {
    const status =
      typeof project.status === "string" ? project.status : "";
    const hasOutput = Boolean(project.output_bucket && project.output_path);
    const jobId = parseExportJobIdFromPath(project.output_path ?? null);

    if (hasOutput || status === "rendered") {
      return {
        jobId,
        status: "complete",
        stage: "Export ready",
        progress: 1,
        downloadUrl: null,
        updatedAt: new Date().toISOString(),
      };
    }
    if (status === "rendering") {
      return {
        jobId,
        status: "rendering",
        stage: "Rendering",
        progress: 0,
        downloadUrl: null,
        updatedAt: new Date().toISOString(),
      };
    }
    if (status === "error" || status === "failed") {
      return {
        jobId,
        status: "error",
        stage: "Export failed",
        progress: 0,
        downloadUrl: null,
        updatedAt: new Date().toISOString(),
      };
    }
    return null;
  };

  const persistExportUiState = (next: ExportUiState) => {
    const jobId = typeof next.jobId === "string" && next.jobId.trim().length > 0
      ? next.jobId
      : null;
    const hasSignal =
      Boolean(jobId) ||
      (typeof next.status === "string" && next.status !== "idle");
    const status = normalizeExportStatus({ value: next.status, hasSignal });
    if (!jobId && status === "idle") {
      exportPersistedRef.current = null;
      return;
    }
    exportPersistedRef.current = {
      jobId,
      status,
      stage: typeof next.stage === "string" ? next.stage : "",
      progress:
        typeof next.progress === "number" ? clamp(next.progress, 0, 1) : 0,
      downloadUrl:
        typeof next.downloadUrl === "string" ? next.downloadUrl : null,
      updatedAt: new Date().toISOString(),
    };
  };

  const updateExportUi = useCallback(
    (updater: ExportUiState | ((prev: ExportUiState) => ExportUiState)) => {
      setExportUi((prev) => {
        const next =
          typeof updater === "function" ? updater(prev) : updater;
        persistExportUiState(next);
        return next;
      });
    },
    []
  );

  const stopExportPolling = useCallback(() => {
    if (exportPollRef.current) {
      window.clearInterval(exportPollRef.current);
      exportPollRef.current = null;
    }
  }, []);

  const triggerExportDownload = useCallback(
    async (url: string) => {
      if (typeof document === "undefined") {
        return;
      }
      const safeName = (projectName || "export")
        .trim()
        .replace(/[^a-zA-Z0-9-_]+/g, "-")
        .replace(/-+/g, "-");
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Download failed.");
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = `${safeName || "export"}.mp4`;
        anchor.rel = "noreferrer";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      } catch {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    [projectName]
  );

  const buildExportStatusUrl = (jobId: string) => {
    const params = new URLSearchParams({ jobId });
    const projectId = projectIdRef.current;
    if (projectId) {
      params.set("projectId", projectId);
    }
    return `/api/editor/export/status?${params.toString()}`;
  };

  const fetchExportStatus = useCallback(
    async (jobId: string) => {
      const response = await fetch(buildExportStatusUrl(jobId));
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Export status check failed.");
      }
      const normalizedStatus = normalizeExportStatus({
        value: payload?.status,
        hasSignal: true,
      });
      updateExportUi((prev) => ({
        ...prev,
        status: normalizedStatus,
        stage: typeof payload?.stage === "string" ? payload.stage : prev.stage,
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
      return normalizedStatus;
    },
    [updateExportUi]
  );

  const startExportPolling = useCallback(
    (jobId: string) => {
      stopExportPolling();
      exportPollRef.current = window.setInterval(async () => {
        try {
          const status = await fetchExportStatus(jobId);
          if (status === "complete" || status === "error") {
            stopExportPolling();
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Export failed.";
          updateExportUi((prev) => ({
            ...prev,
            status: "error",
            stage: "Export failed",
            error: message,
          }));
          stopExportPolling();
        }
      }, 1000);
    },
    [fetchExportStatus, stopExportPolling, updateExportUi]
  );

	  const handleStartExport = useCallback(async () => {
	    if (timeline.length === 0 || isExportInFlightStatus(exportUi.status)) {
	      return;
	    }
	    const exportState = buildExportState();
    const blobAssets =
      exportState.snapshot?.assets?.filter(
        (asset) => typeof asset.url === "string" && asset.url.startsWith("blob:")
      ) ?? [];
    if (blobAssets.length > 0) {
      updateExportUi({
        open: true,
        status: "error",
        stage: "Upload required",
        progress: 0,
        jobId: null,
        downloadUrl: null,
        error:
          "Some assets are still local. Please re-upload or wait for uploads to finish before exporting.",
      });
      return;
    }
    const baseState = buildProjectState();
    const resolvedProjectId =
      (await saveProjectState(baseState).catch(() => null)) ??
      projectIdRef.current;

    updateExportUi({
      open: true,
      status: "starting",
      stage: "Preparing export",
      progress: 0,
      jobId: null,
      downloadUrl: null,
      error: null,
    });
	    try {
	      const previewSize =
	        stageDisplay.width > 0 && stageDisplay.height > 0
	          ? stageDisplay
	          : exportDimensions;
	      const previewWidth = ensureEven(previewSize.width);
	      const previewHeight = ensureEven(previewSize.height);
	      const payload = resolvedProjectId
	        ? {
	            projectId: resolvedProjectId,
	            output: exportDimensions,
	            preview: {
	              width: previewWidth,
	              height: previewHeight,
	            },
	            fps: 30,
	            duration: projectDuration,
	            fonts: exportFonts,
	            name: projectName,
	          }
	        : {
	            state: exportState,
	            output: exportDimensions,
	            preview: {
	              width: previewWidth,
	              height: previewHeight,
	            },
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
	        const requestId =
	          typeof data?.requestId === "string" ? data.requestId.trim() : "";
	        const baseError = data?.error || "Export failed.";
	        throw new Error(
	          requestId ? `${baseError} (requestId: ${requestId})` : baseError
	        );
	      }
      const nextJobId =
        typeof data?.jobId === "string"
          ? data.jobId
          : typeof data?.id === "string"
            ? data.id
            : null;
      if (!nextJobId) {
        throw new Error(data?.error || "Export did not return a job id.");
      }
      const normalizedStatus = normalizeExportStatus({
        value: data?.status,
        hasSignal: true,
      });
      const stageRaw = typeof data?.stage === "string" ? data.stage : "";
      const nextStage =
        stageRaw.trim().length > 0
          ? stageRaw
          : normalizedStatus === "complete"
            ? "Export ready"
            : normalizedStatus === "error"
              ? "Export failed"
              : "Exporting";
      const nextProgress =
        typeof data?.progress === "number"
          ? clamp(data.progress, 0, 1)
          : normalizedStatus === "complete"
            ? 1
            : 0;
      updateExportUi((prev) => ({
        ...prev,
        status: normalizedStatus,
        stage: nextStage,
        progress: nextProgress,
        jobId: nextJobId,
        downloadUrl:
          typeof data?.downloadUrl === "string" ? data.downloadUrl : null,
      }));
      startExportPolling(nextJobId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Export failed.";
      updateExportUi((prev) => ({
        ...prev,
        status: "error",
        stage: "Export failed",
        error: message,
      }));
    }
  }, [
    buildExportState,
    buildProjectState,
    exportDimensions,
    exportFonts,
    exportUi.status,
    projectDuration,
    projectName,
    saveProjectState,
    stageDisplay.height,
    stageDisplay.width,
    startExportPolling,
    timeline.length,
    updateExportUi,
  ]);

  useEffect(() => {
    return () => {
      stopExportPolling();
    };
  }, [stopExportPolling]);

  useEffect(() => {
    if (isExportMode) {
      return;
    }
    const jobId = exportUi.jobId;
    if (!jobId) {
      return;
    }
    if (isExportInFlightStatus(exportUi.status)) {
      if (!exportPollRef.current) {
        startExportPolling(jobId);
      }
      return;
    }
    if (exportUi.status === "complete" && !exportUi.downloadUrl) {
      fetchExportStatus(jobId).catch(() => {});
    }
  }, [
    exportUi.downloadUrl,
    exportUi.jobId,
    exportUi.status,
    fetchExportStatus,
    isExportMode,
    startExportPolling,
  ]);

  const exportProgressPercent = Math.round(
    clamp(exportUi.progress, 0, 1) * 100
  );
  const exportInFlight = isExportInFlightStatus(exportUi.status);
  const exportHasDownload =
    exportUi.status === "complete" &&
    Boolean(exportUi.jobId || exportUi.downloadUrl);
  const exportDisabled =
    timeline.length === 0 && !exportHasDownload && !exportInFlight;
  const exportLabel = exportHasDownload
    ? "Download"
    : exportInFlight
      ? "Rendering..."
      : exportUi.status === "error"
        ? "Export failed"
        : "Export";

  const handleExportButtonClick = useCallback(async () => {
    if (exportHasDownload) {
      let downloadUrl = exportUi.downloadUrl;
      if (!downloadUrl && exportUi.jobId) {
        try {
          await fetchExportStatus(exportUi.jobId);
        } catch {
          // Ignore and fall back to opening the overlay.
        }
        downloadUrl = exportPersistedRef.current?.downloadUrl ?? downloadUrl;
      }
      if (downloadUrl) {
        triggerExportDownload(downloadUrl);
        return;
      }
      updateExportUi((prev) => ({ ...prev, open: true }));
      if (exportUi.jobId) {
        fetchExportStatus(exportUi.jobId).catch(() => {});
      }
      return;
    }
    if (exportUi.status === "error") {
      updateExportUi((prev) => ({ ...prev, open: true }));
      return;
    }
    if (exportInFlight) {
      updateExportUi((prev) => ({ ...prev, open: true }));
      if (exportUi.jobId) {
        fetchExportStatus(exportUi.jobId).catch(() => {});
      }
      return;
    }
    handleStartExport();
  }, [
    exportHasDownload,
    exportInFlight,
    exportUi.downloadUrl,
    exportUi.jobId,
    exportUi.status,
    fetchExportStatus,
    handleStartExport,
    triggerExportDownload,
    updateExportUi,
  ]);

  const timelineSpan = useMemo(
    () => Math.max(contentTimelineTotal, projectDuration),
    [contentTimelineTotal, projectDuration]
  );

  const timelineDuration = useMemo(() => {
    return Math.max(10, Math.ceil(timelineSpan + 1));
  }, [timelineSpan]);

  useEffect(() => {
    timelineDurationRef.current = timelineDuration;
  }, [timelineDuration]);
  const clampedCurrentTime = clamp(currentTime, 0, timelineDuration);
  const playheadLeftAbsolutePx =
    clampedCurrentTime * timelineScale + timelinePadding;
  const playheadLeftContentPx = playheadLeftAbsolutePx - timelinePadding;
  const playheadContentTransform = `translate3d(${playheadLeftContentPx}px, 0, 0) translateX(-50%)`;
  const playheadAbsoluteTransform = `translate3d(${playheadLeftAbsolutePx}px, 0, 0) translateX(-50%)`;
  const playheadOverlayZIndex = 2147483647;

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
        startTime: 0,
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
          startTime: entry.clip.startTime,
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

  const transcriptSourceOptions = subtitleSourceOptions;

  useEffect(() => {
    if (
      transcriptSource !== "project" &&
      !transcriptSourceOptions.some((option) => option.id === transcriptSource)
    ) {
      setTranscriptSource("project");
    }
  }, [transcriptSource, transcriptSourceOptions]);

  const transcriptSourceClipIds = useMemo(() => {
    return new Set(
      transcriptSourceOptions
        .filter((option) => option.id !== "project")
        .map((option) => option.id)
    );
  }, [transcriptSourceOptions]);

  useEffect(() => {
    const nextSegments = transcriptSegments.filter(
      (segment) =>
        segment.sourceClipId == null ||
        transcriptSourceClipIds.has(segment.sourceClipId)
    );
    if (nextSegments.length === transcriptSegments.length) {
      return;
    }
    setTranscriptSegments(nextSegments);
    if (nextSegments.length === 0) {
      setTranscriptStatus("idle");
    }
  }, [transcriptSegments, transcriptSourceClipIds]);

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
      const resolved: TextClipSettings = {
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
      if (editorProfile === "reddit") {
        resolved.wordHighlightEnabled = true;
      }
      return resolved;
    },
    [
      editorProfile,
      subtitleBaseSettings,
      subtitleStyleId,
      resolvedSubtitleStylePresets,
    ]
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
            ? (() => {
                const existingWords = segment.words;
                if (!existingWords || existingWords.length === 0) {
                  return { ...segment, text, words: undefined };
                }
                const tokens = text
                  .trim()
                  .split(/\s+/)
                  .map((token) => token.trim())
                  .filter(Boolean);
                if (tokens.length !== existingWords.length) {
                  return { ...segment, text, words: undefined };
                }
                const nextWords = existingWords.map((word, index) => ({
                  start: word.start,
                  end: word.end,
                  word: tokens[index],
                }));
                return { ...segment, text, words: nextWords };
              })()
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

  const ensureSubtitleTextLane = useCallback((laneId: string) => {
    setLanes((prev) => {
      if (prev.some((lane) => lane.id === laneId)) {
        return prev;
      }
      const next = [...prev];
      const lane: TimelineLane = { id: laneId, type: "text" };
      const firstNonTextIndex = next.findIndex((item) => item.type !== "text");
      if (firstNonTextIndex === -1) {
        next.push(lane);
      } else {
        next.splice(firstNonTextIndex, 0, lane);
      }
      return next;
    });
  }, []);

  const resolveSubtitleLaneId = useCallback(() => {
    const laneSnapshot = lanesRef.current;
    const currentLane = subtitleLaneIdRef.current
      ? laneSnapshot.find((lane) => lane.id === subtitleLaneIdRef.current)
      : null;
    if (currentLane?.type === "text") {
      return currentLane.id;
    }
    const existingTextLaneId =
      laneSnapshot.find((lane) => lane.type === "text")?.id ?? null;
    if (existingTextLaneId) {
      subtitleLaneIdRef.current = existingTextLaneId;
      return existingTextLaneId;
    }
    const newLaneId = crypto.randomUUID();
    subtitleLaneIdRef.current = newLaneId;
    return newLaneId;
  }, []);

  const handleSubtitleAddLine = useCallback((options?: {
    startTime?: number;
    endTime?: number;
    text?: string;
  }) => {
    pushHistory();
    const laneId = resolveSubtitleLaneId();
    ensureSubtitleTextLane(laneId);
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
    createClip,
    ensureSubtitleTextLane,
    isPlaying,
    pushHistory,
    resolveSubtitleLaneId,
    resolveSubtitleSettings,
    stageAspectRatio,
    subtitleSegments,
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

  const transcribeSourceEntries = useCallback(
	    async (
	      sourceEntries: Array<{ clip: TimelineClip; asset: MediaAsset }>
	    ): Promise<TranscriptSegment[]> => {
	      const sortedSources = [...sourceEntries].sort(
	        (a, b) => a.clip.startTime - b.clip.startTime
	      );
	      subtitleDebugLog("transcription run start", {
	        sourceCount: sortedSources.length,
	        language: subtitleLanguage?.code ?? "auto",
	      });
	      type TranscriptionSource = { file: File } | { url: string };
	      type TranscriptionTrace = {
	        clipId: string;
	        assetId: string;
	        chunkIndex: number;
	        chunkCount: number;
	      };
	      const parseTranscriptionErrorMessage = (
	        responseStatus: number,
	        rawMessage: string
	      ) => {
	        if (!rawMessage) {
	          return `Unable to generate subtitles for this clip (${responseStatus}).`;
	        }
	        try {
	          const parsed = JSON.parse(rawMessage) as { error?: unknown };
	          if (typeof parsed?.error === "string" && parsed.error.trim().length > 0) {
	            return parsed.error.trim();
	          }
	        } catch {
	          // Keep raw text fallback.
	        }
	        return rawMessage;
	      };
	      const requestTranscription = async (
	        source: TranscriptionSource,
	        options: {
	          model: string;
	          responseFormat: string;
	          includeTimestampGranularities: boolean;
	          chunkingStrategy?: string;
	        },
	        trace?: TranscriptionTrace
	      ) => {
	        let lastError: Error | null = null;
	        for (
	          let attempt = 1;
	          attempt <= TRANSCRIPTION_REQUEST_MAX_ATTEMPTS;
          attempt += 1
        ) {
          try {
            const formData = new FormData();
            if ("file" in source) {
              formData.append("file", source.file);
            } else {
              formData.append("url", source.url);
            }
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
	            const response = await fetchWithTimeout(
	              "/api/transcriptions",
	              {
	                method: "POST",
	                body: formData,
              },
	              TRANSCRIPTION_REQUEST_TIMEOUT_MS,
	              "Subtitle transcription"
	            );
	            if (!response.ok) {
	              const rawMessage = await response.text().catch(() => "");
	              const message = parseTranscriptionErrorMessage(
	                response.status,
	                rawMessage
	              );
	              subtitleDebugLog("transcription request failed", {
	                clipId: trace?.clipId ?? null,
	                assetId: trace?.assetId ?? null,
	                chunkIndex: trace?.chunkIndex ?? null,
	                chunkCount: trace?.chunkCount ?? null,
	                sourceKind: "file" in source ? "file" : "url",
	                model: options.model,
	                attempt,
	                status: response.status,
	                error: message,
	              });
	              throw new Error(message);
	            }
	            const payload = await response.json();
	            subtitleDebugLog("transcription request succeeded", {
	              clipId: trace?.clipId ?? null,
	              assetId: trace?.assetId ?? null,
	              chunkIndex: trace?.chunkIndex ?? null,
	              chunkCount: trace?.chunkCount ?? null,
	              sourceKind: "file" in source ? "file" : "url",
	              model: options.model,
	              attempt,
	              segmentCount: Array.isArray(payload?.segments)
	                ? payload.segments.length
	                : 0,
	              wordCount: Array.isArray(payload?.words) ? payload.words.length : 0,
	            });
	            return payload;
	          } catch (error) {
	            const normalized =
	              error instanceof Error
	                ? error
	                : new Error("Unable to generate subtitles for this clip.");
	            lastError = normalized;
	            const willRetry =
	              attempt < TRANSCRIPTION_REQUEST_MAX_ATTEMPTS &&
	              isTransientErrorMessage(normalized.message);
	            subtitleDebugLog("transcription request error", {
	              clipId: trace?.clipId ?? null,
	              assetId: trace?.assetId ?? null,
	              chunkIndex: trace?.chunkIndex ?? null,
	              chunkCount: trace?.chunkCount ?? null,
	              model: options.model,
	              attempt,
	              willRetry,
	              error: normalized.message,
	            });
	            if (
	              attempt >= TRANSCRIPTION_REQUEST_MAX_ATTEMPTS ||
	              !isTransientErrorMessage(normalized.message)
	            ) {
              throw normalized;
            }
            await delay(attempt === 1 ? 800 : 1400);
          }
        }
        throw lastError ?? new Error("Unable to generate subtitles for this clip.");
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
	        source: TranscriptionSource,
	        options: {
	          model: string;
	          responseFormat: string;
	          includeTimestampGranularities: boolean;
	          chunkingStrategy?: string;
	        },
	        allowFallback = true,
	        trace?: TranscriptionTrace
	      ) => {
	        try {
	          return await requestTranscription(source, options, trace);
	        } catch (error) {
	          const message = error instanceof Error ? error.message : "";
	          if (
	            options.includeTimestampGranularities &&
	            /timestamp|granularit/i.test(message)
	          ) {
	            subtitleDebugLog("retrying transcription without timestamp granularity", {
	              clipId: trace?.clipId ?? null,
	              assetId: trace?.assetId ?? null,
	              chunkIndex: trace?.chunkIndex ?? null,
	              chunkCount: trace?.chunkCount ?? null,
	              model: options.model,
	            });
	            return requestTranscriptionWithRetry(
	              source,
	              {
	                ...options,
	                includeTimestampGranularities: false,
	              },
	              allowFallback,
	              trace
	            );
	          }
	          if (
	            /internal_error|internal server error/i.test(message) ||
	            isTransientErrorMessage(message)
	          ) {
	            try {
	              subtitleDebugLog("retrying transcription after transient error", {
	                clipId: trace?.clipId ?? null,
	                assetId: trace?.assetId ?? null,
	                chunkIndex: trace?.chunkIndex ?? null,
	                chunkCount: trace?.chunkCount ?? null,
	                model: options.model,
	                error: message,
	              });
	              await new Promise((resolve) => window.setTimeout(resolve, 800));
	              return await requestTranscription(source, options, trace);
	            } catch (retryError) {
	              if (allowFallback && options.model !== fallbackTranscription.model) {
	                subtitleDebugLog("switching to fallback transcription model", {
	                  clipId: trace?.clipId ?? null,
	                  assetId: trace?.assetId ?? null,
	                  chunkIndex: trace?.chunkIndex ?? null,
	                  chunkCount: trace?.chunkCount ?? null,
	                  fromModel: options.model,
	                  toModel: fallbackTranscription.model,
	                });
	                return requestTranscriptionWithRetry(
	                  source,
	                  fallbackTranscription,
	                  false,
	                  trace
	                );
	              }
	              throw retryError;
	            }
	          }
	          if (allowFallback && options.model !== fallbackTranscription.model) {
	            subtitleDebugLog("falling back to whisper transcription model", {
	              clipId: trace?.clipId ?? null,
	              assetId: trace?.assetId ?? null,
	              chunkIndex: trace?.chunkIndex ?? null,
	              chunkCount: trace?.chunkCount ?? null,
	              fromModel: options.model,
	              toModel: fallbackTranscription.model,
	            });
	            return requestTranscriptionWithRetry(
	              source,
	              fallbackTranscription,
	              false,
	              trace
	            );
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
      type TranscriptionChunk =
        | {
            file: File;
            chunkStartOffset: number;
            chunkEndOffset: number;
          }
        | {
            remoteUrl: string;
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
        extractAudio: boolean,
        remoteUrl?: string
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
            if (extractAudio && remoteUrl) {
              const fallbackAssetDuration =
                Number.isFinite(resolvedAssetDuration) &&
                resolvedAssetDuration > 0
                  ? resolvedAssetDuration
                  : clipStartOffset +
                    Math.max(1, clipDuration * playbackRate);
              const fallbackClipAssetDuration = Math.min(
                clipDuration * playbackRate,
                Math.max(0, fallbackAssetDuration - clipStartOffset)
              );
              const fallbackClipEndOffset =
                clipStartOffset + fallbackClipAssetDuration;
              return {
                chunks: [
                  {
                    remoteUrl,
                    chunkStartOffset: 0,
                    chunkEndOffset: fallbackAssetDuration,
                  },
                ],
                assetDuration: fallbackAssetDuration,
                clipEndOffset: fallbackClipEndOffset,
              };
            }
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
      const nextSegments: TranscriptSegment[] = [];
      const fetchSourceBlob = async (url: string, assetName: string) => {
        let lastError: Error | null = null;
        for (let attempt = 1; attempt <= 2; attempt += 1) {
          try {
            const response = await fetchWithTimeout(
              url,
              { method: "GET" },
              TRANSCRIPTION_SOURCE_FETCH_TIMEOUT_MS,
              `Loading media for ${assetName}`
            );
            if (!response.ok) {
              throw new Error(
                `Unable to read media for subtitle generation (${response.status}).`
              );
            }
            return response.blob();
          } catch (error) {
            const normalized =
              error instanceof Error
                ? error
                : new Error("Unable to read media for subtitle generation.");
            lastError = normalized;
            if (attempt >= 2 || !isTransientErrorMessage(normalized.message)) {
              throw normalized;
            }
            await delay(600);
          }
        }
        throw lastError ?? new Error("Unable to read media for subtitle generation.");
      };
	      for (const entry of sortedSources) {
	        subtitleDebugLog("clip transcription start", {
	          clipId: entry.clip.id,
	          assetId: entry.asset.id,
	          assetKind: entry.asset.kind,
	          clipDuration: entry.clip.duration,
	        });
	        const blob = await fetchSourceBlob(
	          entry.asset.url,
	          entry.asset.name || "clip"
	        );
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
	          entry.asset.kind === "video",
	          entry.asset.url
	        );
	        subtitleDebugLog("clip chunks prepared", {
	          clipId: entry.clip.id,
	          assetId: entry.asset.id,
	          chunkCount: chunks.length,
	          usesRemoteSource: chunks.some((chunk) => "remoteUrl" in chunk),
	        });
	        const clipSegments: TimedSegment[] = [];
	        for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
	          const chunk = chunks[chunkIndex];
	          const trace: TranscriptionTrace = {
	            clipId: entry.clip.id,
	            assetId: entry.asset.id,
	            chunkIndex: chunkIndex + 1,
	            chunkCount: chunks.length,
	          };
	          const source: TranscriptionSource =
	            "file" in chunk ? { file: chunk.file } : { url: chunk.remoteUrl };
	          let data = await requestTranscriptionWithRetry(
	            source,
	            primaryTranscription,
	            true,
	            trace
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
	              source,
	              fallbackTranscription,
	              false,
	              trace
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
	          subtitleDebugLog("chunk transcription computed", {
	            clipId: entry.clip.id,
	            assetId: entry.asset.id,
	            chunkIndex: trace.chunkIndex,
	            chunkCount: trace.chunkCount,
	            segmentCount: normalizedSegments.length,
	            wordCount: normalizedWords.length,
	          });
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
	        subtitleDebugLog("clip transcription complete", {
	          clipId: entry.clip.id,
	          assetId: entry.asset.id,
	          segmentCount: clipSegments.length,
	        });
	        clipSegments.sort((a, b) => a.start - b.start);
	        clipSegments.forEach((segment) => {
          const rawText = String(segment.text ?? "").trim();
          if (!rawText) {
            return;
          }
          const cleanedText = rawText
            .replace(/^(?:speaker|spk)\s*\d+[:\\-]\\s*/i, "")
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
          nextSegments.push({
            id: crypto.randomUUID(),
            text: cleanedText,
            startTime: timelineStart,
            endTime: timelineEnd,
            sourceClipId: entry.clip.id,
            words: wordEntries && wordEntries.length > 0 ? wordEntries : undefined,
	          });
	        });
	      }
	      const sortedSegments = nextSegments.sort((a, b) => a.startTime - b.startTime);
	      subtitleDebugLog("transcription run complete", {
	        outputSegmentCount: sortedSegments.length,
	      });
	      return sortedSegments;
	    },
    [
      buildSubtitleSegmentsFromWords,
      clipSettings,
      getAudioContext,
      splitSubtitleSegmentsByText,
      subtitleLanguage,
    ]
  );

	  const handleGenerateSubtitles = useCallback(async () => {
	    if (subtitleStatus === "loading") {
	      subtitleDebugLog("subtitle generation skipped: already loading");
	      return;
	    }
	    const existingSubtitleClipIdsAtStart = new Set(
	      subtitleSegments.map((segment) => segment.clipId)
	    );
	    const nonSubtitleClipsAtStart = timelineRef.current
	      .filter((clip) => !existingSubtitleClipIdsAtStart.has(clip.id))
	      .map((clip) => ({ ...clip }));
	    const nonSubtitleAssetsAtStart = Array.from(
	      new Set(nonSubtitleClipsAtStart.map((clip) => clip.assetId))
	    )
	      .map(
	        (assetId) =>
	          assetCacheRef.current.get(assetId) ??
	          assetsRef.current.find((asset) => asset.id === assetId) ??
	          null
	      )
	      .filter((asset): asset is MediaAsset => Boolean(asset));
	    const sourceEntries =
	      subtitleSource === "project"
	        ? subtitleSourceClips
        : subtitleSourceClips.filter(
            (entry) => entry.clip.id === subtitleSource
	          );
	    subtitleDebugLog("subtitle generation start", {
	      source: subtitleSource,
	      sourceCount: sourceEntries.length,
	    });
	    if (sourceEntries.length === 0) {
	      setSubtitleStatus("error");
	      setSubtitleError("Add an audio or video clip to transcribe.");
	      subtitleDebugLog("subtitle generation failed: no source entries");
	      return;
	    }
	    setSubtitleStatus("loading");
	    setSubtitleError(null);
	    pushHistory();
	    try {
	      const transcriptEntries = await transcribeSourceEntries(sourceEntries);
	      subtitleDebugLog("subtitle transcript entries resolved", {
	        segmentCount: transcriptEntries.length,
	      });
	      const laneId = resolveSubtitleLaneId();
	      ensureSubtitleTextLane(laneId);
      const nextAssets: MediaAsset[] = [];
      const nextClips: TimelineClip[] = [];
      const nextTextSettings: Record<string, TextClipSettings> = {};
      const nextClipTransforms: Record<string, ClipTransform> = {};
      const nextSegments: SubtitleSegment[] = [];
      // Pre-compute the subtitle transform once for all clips (same position/size)
      const subtitleTransform = createSubtitleTransform(stageAspectRatio);
      transcriptEntries.forEach((segment) => {
        const asset = {
          ...createTextAsset("Subtitle"),
          duration: Math.max(0.01, segment.endTime - segment.startTime),
        };
        const clip = createClip(asset.id, laneId, segment.startTime, asset);
        nextAssets.push(asset);
        nextClips.push(clip);
        nextTextSettings[clip.id] = resolveSubtitleSettings(segment.text);
        nextClipTransforms[clip.id] = subtitleTransform;
        nextSegments.push({
          id: segment.id,
          clipId: clip.id,
          text: segment.text,
          startTime: segment.startTime,
          endTime: segment.endTime,
          sourceClipId: segment.sourceClipId,
          words: segment.words,
	        });
	      });
	      setAssets((prev) => {
	        const existing = new Set(prev.map((asset) => asset.id));
	        const additions: MediaAsset[] = [];
	        nonSubtitleAssetsAtStart.forEach((asset) => {
	          if (existing.has(asset.id)) {
	            return;
	          }
	          existing.add(asset.id);
	          additions.push(asset);
	        });
	        nextAssets.forEach((asset) => {
	          if (existing.has(asset.id)) {
	            return;
	          }
	          existing.add(asset.id);
	          additions.push(asset);
	        });
	        if (additions.length === 0) {
	          return prev;
	        }
	        return [...additions, ...prev];
	      });
	      setTimeline((prev) => {
	        const byId = new Map(prev.map((clip) => [clip.id, clip]));
	        let recoveredNonSubtitleClipCount = 0;
	        nonSubtitleClipsAtStart.forEach((clip) => {
	          if (byId.has(clip.id)) {
	            return;
	          }
	          byId.set(clip.id, clip);
	          recoveredNonSubtitleClipCount += 1;
	        });
	        const baseline = Array.from(byId.values());
	        const filtered = baseline.filter(
	          (clip) => !existingSubtitleClipIdsAtStart.has(clip.id)
	        );
	        const nextTimeline = [...filtered, ...nextClips];
	        const kindByAssetId = new Map<string, MediaKind>(
	          assetsRef.current.map((asset) => [asset.id, asset.kind])
	        );
	        nonSubtitleAssetsAtStart.forEach((asset) => {
	          kindByAssetId.set(asset.id, asset.kind);
	        });
	        nextAssets.forEach((asset) => {
	          kindByAssetId.set(asset.id, asset.kind);
	        });
		        let videoClipCount = 0;
		        let textClipCount = 0;
	        let audioClipCount = 0;
	        let missingAssetClipCount = 0;
	        const missingAssetIds: string[] = [];
	        nextTimeline.forEach((clip) => {
	          const kind = kindByAssetId.get(clip.assetId);
	          if (kind === "video") {
	            videoClipCount += 1;
	            return;
          }
          if (kind === "text") {
            textClipCount += 1;
            return;
          }
	          if (kind === "audio") {
	            audioClipCount += 1;
	            return;
	          }
	          missingAssetClipCount += 1;
	          missingAssetIds.push(clip.assetId);
	        });
		        subtitleDebugLog(
		          `subtitle timeline merge counts before=${prev.length} baseline=${baseline.length} after=${nextTimeline.length} recoveredNonSubtitle=${recoveredNonSubtitleClipCount} videos=${videoClipCount} text=${textClipCount} audio=${audioClipCount} missing=${missingAssetClipCount}`
		        );
	        if (missingAssetIds.length > 0) {
	          subtitleDebugLog("subtitle timeline merge missing asset ids", {
	            missingAssetIds: Array.from(new Set(missingAssetIds)),
	          });
	        }
	        return nextTimeline;
	      });
	      setTextSettings((prev) => {
	        const next = { ...prev };
	        existingSubtitleClipIdsAtStart.forEach((clipId) => {
	          delete next[clipId];
	        });
	        return { ...next, ...nextTextSettings };
	      });
	      setClipTransforms((prev) => {
	        const next = { ...prev };
	        existingSubtitleClipIdsAtStart.forEach((clipId) => {
	          delete next[clipId];
	        });
	        return { ...next, ...nextClipTransforms };
	      });
	      setSubtitleSegments(
	        nextSegments.sort((a, b) => a.startTime - b.startTime)
	      );
	      setSubtitleActiveTab("style");
	      setSubtitleStatus("ready");
	      subtitleDebugLog("subtitle generation complete", {
	        outputClipCount: nextClips.length,
	        outputSegmentCount: nextSegments.length,
	      });
	    } catch (error) {
	      const message =
	        error instanceof Error ? error.message : "Subtitle generation failed.";
	      subtitleDebugLog("subtitle generation error", {
	        error: message,
	      });
	      setSubtitleStatus("error");
	      setSubtitleError(message);
	    }
  }, [
    createClip,
    ensureSubtitleTextLane,
    pushHistory,
    resolveSubtitleLaneId,
    resolveSubtitleSettings,
    stageAspectRatio,
    subtitleSegments,
    subtitleSource,
    subtitleSourceClips,
    subtitleStatus,
    transcribeSourceEntries,
  ]);

  useEffect(() => {
    const pending = pendingSplitScreenSubtitleRef.current;
    if (!pending) {
      return;
    }
    if (subtitleStatus === "loading") {
      return;
    }
    if (subtitleStyleId !== pending.styleId) {
      return;
    }
    if (subtitleSource !== pending.mainClipId) {
      return;
    }
    if (!subtitleSourceClips.some((entry) => entry.clip.id === pending.mainClipId)) {
      return;
    }
	    pendingSplitScreenSubtitleRef.current = null;
	    setSplitScreenImportOverlayStage("subtitles");
	    setSplitScreenImportOverlayOpen(true);
	    splitImportLog("split subtitle generation triggered", {
	      mainClipId: pending.mainClipId,
	      styleId: pending.styleId,
	    });
	    withPromiseTimeout(
	      handleGenerateSubtitles(),
	      IMPORT_SUBTITLE_TIMEOUT_MS,
	      "Subtitle generation"
	    )
	      .catch((error) => {
	        if (subtitleStatusRef.current === "error") {
	          return;
	        }
	        splitImportLog("split subtitle generation failed", {
	          error:
	            error instanceof Error ? error.message : "Subtitle generation failed.",
	        });
	        setSubtitleStatus("error");
	        setSubtitleError(
	          error instanceof Error ? error.message : "Subtitle generation failed."
	        );
	      })
	      .finally(() => {
	        setSplitScreenImportOverlayStage("finalizing");
	        splitImportLog("split subtitle generation finalized", {
	          subtitleStatus: subtitleStatusRef.current,
	        });
	        requestAnimationFrame(() => {
	          if (subtitleStatusRef.current === "error") {
	            return;
	          }
	          setSplitScreenImportOverlayOpen(false);
        });
      });
  }, [
    handleGenerateSubtitles,
    subtitleSource,
    subtitleSourceClips,
    subtitleStatus,
    subtitleStyleId,
  ]);

  useEffect(() => {
    const pending = pendingStreamerVideoSubtitleRef.current;
    if (!pending) {
      return;
    }
    if (subtitleStatus === "loading") {
      return;
    }
    if (subtitleStyleId !== pending.styleId) {
      return;
    }
    if (subtitleSource !== pending.sourceClipId) {
      return;
    }
    if (
      !subtitleSourceClips.some(
        (entry) => entry.clip.id === pending.sourceClipId
      )
    ) {
      return;
    }
    pendingStreamerVideoSubtitleRef.current = null;
    setStreamerVideoImportOverlayStage("subtitles");
    setStreamerVideoImportOverlayOpen(true);
    withPromiseTimeout(
      handleGenerateSubtitles(),
      IMPORT_SUBTITLE_TIMEOUT_MS,
      "Subtitle generation"
    )
      .catch((error) => {
        if (subtitleStatusRef.current === "error") {
          return;
        }
        setSubtitleStatus("error");
        setSubtitleError(
          error instanceof Error ? error.message : "Subtitle generation failed."
        );
      })
      .finally(() => {
        setStreamerVideoImportOverlayStage("finalizing");
        requestAnimationFrame(() => {
          if (subtitleStatusRef.current === "error") {
            return;
          }
          setStreamerVideoImportOverlayOpen(false);
        });
      });
  }, [
    handleGenerateSubtitles,
    subtitleSource,
    subtitleSourceClips,
    subtitleStatus,
    subtitleStyleId,
  ]);

  useEffect(() => {
    const pending = pendingRedditVideoSubtitleRef.current;
    if (!pending) {
      return;
    }
    if (subtitleStatus === "loading") {
      return;
    }
    if (subtitleStyleId !== pending.styleId) {
      return;
    }
    if (subtitleSource !== pending.sourceClipId) {
      return;
    }
    if (!subtitleSourceClips.some((entry) => entry.clip.id === pending.sourceClipId)) {
      return;
    }
    pendingRedditVideoSubtitleRef.current = null;
    setRedditVideoImportOverlayStage("subtitles");
    setRedditVideoImportOverlayOpen(true);
    withPromiseTimeout(
      handleGenerateSubtitles(),
      IMPORT_SUBTITLE_TIMEOUT_MS,
      "Subtitle generation"
    )
      .catch((error) => {
        if (subtitleStatusRef.current === "error") {
          return;
        }
        setSubtitleStatus("error");
        setSubtitleError(
          error instanceof Error ? error.message : "Subtitle generation failed."
        );
      })
      .finally(() => {
        setRedditVideoImportOverlayStage("finalizing");
        requestAnimationFrame(() => {
          if (subtitleStatusRef.current === "error") {
            return;
          }
          setRedditVideoImportOverlayOpen(false);
        });
      });
  }, [
    handleGenerateSubtitles,
    subtitleSource,
    subtitleSourceClips,
    subtitleStatus,
    subtitleStyleId,
  ]);

  const handleGenerateTranscript = useCallback(async () => {
    if (transcriptStatus === "loading") {
      return;
    }
    const sourceEntries =
      transcriptSource === "project"
        ? subtitleSourceClips
        : subtitleSourceClips.filter(
            (entry) => entry.clip.id === transcriptSource
          );
    if (sourceEntries.length === 0) {
      setTranscriptStatus("error");
      setTranscriptError("Add an audio or video clip to transcribe.");
      return;
    }
    setTranscriptStatus("loading");
    setTranscriptError(null);
    try {
      const transcriptEntries = await transcribeSourceEntries(sourceEntries);
      setTranscriptSegments(transcriptEntries);
      setTranscriptStatus("ready");
    } catch (error) {
      setTranscriptStatus("error");
      setTranscriptError(
        error instanceof Error
          ? error.message
          : "Transcript generation failed."
      );
    }
  }, [
    transcriptSource,
    transcriptStatus,
    transcribeSourceEntries,
    subtitleSourceClips,
  ]);

  const handleClearTranscript = useCallback(
    (sourceId: string) => {
      const nextSegments =
        sourceId === "project"
          ? []
          : transcriptSegments.filter((segment) => segment.sourceClipId !== sourceId);
      setTranscriptSegments(nextSegments);
      setTranscriptStatus(nextSegments.length === 0 ? "idle" : "ready");
      setTranscriptError(null);
    },
    [transcriptSegments]
  );

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

  const resolveTopCreateZonePx = useCallback(
    (rows: Array<{ height: number }>) => {
      if (rows.length === 0) {
        return 0;
      }
      const topHeight = rows[0].height;
      return Math.min(24, Math.max(10, Math.round(topHeight * 0.2)));
    },
    []
  );

  const resolveTopInsertIndex = useCallback(
    (laneType: LaneType, rows: Array<{ type: LaneType }>) => {
      if (rows.length === 0) {
        return 0;
      }
      if (laneType === "text") {
        const firstText = rows.findIndex((row) => row.type === "text");
        return firstText === -1 ? 0 : firstText;
      }
      if (laneType === "video") {
        const firstNonText = rows.findIndex((row) => row.type !== "text");
        return firstNonText === -1 ? rows.length : firstNonText;
      }
      const firstAudio = rows.findIndex((row) => row.type === "audio");
      return firstAudio === -1 ? rows.length : firstAudio;
    },
    []
  );

  const resolveBottomInsertIndex = useCallback(
    (laneType: LaneType, rows: Array<{ type: LaneType }>) => {
      if (rows.length === 0) {
        return 0;
      }
      if (laneType === "text") {
        const firstNonText = rows.findIndex((row) => row.type !== "text");
        return firstNonText === -1 ? rows.length : firstNonText;
      }
      if (laneType === "video") {
        const firstAudio = rows.findIndex((row) => row.type === "audio");
        return firstAudio === -1 ? rows.length : firstAudio;
      }
      return rows.length;
    },
    []
  );

  const resolveInsertTopPx = useCallback(
    (rows: Array<{ height: number }>, index: number) => {
      const clampedIndex = Math.max(0, Math.min(index, rows.length));
      let top = 0;
      for (let i = 0; i < clampedIndex; i += 1) {
        top += rows[i].height + laneGap;
      }
      return top;
    },
    []
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

  const topCreateZonePx = useMemo(
    () => resolveTopCreateZonePx(laneRows),
    [laneRows, resolveTopCreateZonePx]
  );

  useEffect(() => {
    laneRowsRef.current = laneRows;
  }, [laneRows]);

  useEffect(() => {
    topCreateZonePxRef.current = topCreateZonePx;
  }, [topCreateZonePx]);

  const lastAudioLaneId = useMemo(() => {
    for (let index = laneRows.length - 1; index >= 0; index -= 1) {
      if (laneRows[index].type === "audio") {
        return laneRows[index].id;
      }
    }
    return null;
  }, [laneRows]);

  const dragPreview = useMemo(() => {
    if (!dragClipState || dragClipState.pendingLaneInsert) {
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

  const pendingInsertPreview = useMemo(() => {
    if (!dragClipState?.pendingLaneInsert) {
      return null;
    }
    const clip = timeline.find((item) => item.id === dragClipState.clipId);
    if (!clip) {
      return null;
    }
    const { type, index } = dragClipState.pendingLaneInsert;
    const laneHeight = getLaneHeight(type);
    const laneTop = resolveInsertTopPx(laneRows, index);
    const laneClipInsetY =
      type === "video" ? 0 : Math.max(4, Math.round(laneHeight * 0.12));
    const laneClipHeight =
      type === "video"
        ? laneHeight
        : Math.max(18, laneHeight - laneClipInsetY * 2);
    return {
      laneTop,
      laneHeight,
      clipTop: laneTop + laneClipInsetY,
      clipHeight: laneClipHeight,
      startTime: dragClipState.previewTime ?? clip.startTime,
      duration: clip.duration,
      type,
    };
  }, [dragClipState, getLaneHeight, laneRows, resolveInsertTopPx, timeline]);

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

  const handleScrubTo = useCallback(
    (clientX: number) => {
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
    },
    [handleScrubToTime, timelineDuration, timelineScale]
  );

  const handlePlayheadPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
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
        setIsPlaying(false);
      }
      handleScrubTo(event.clientX);
    },
    [handleScrubTo, isPlaying]
  );

  // Direct DOM updates keep the playhead smooth without forcing React re-renders.
  const updatePlayheadDom = useCallback(
    (time: number) => {
      const clamped = clamp(time, 0, timelineDuration);
      const absoluteLeft = clamped * timelineScale + timelinePadding;
      const contentLeft = absoluteLeft - timelinePadding;
      const contentTransform = `translate3d(${contentLeft}px, 0, 0) translateX(-50%)`;
      const absoluteTransform = `translate3d(${absoluteLeft}px, 0, 0) translateX(-50%)`;
      if (playheadLineRef.current) {
        playheadLineRef.current.style.transform = contentTransform;
      }
      if (playheadHandleRef.current) {
        playheadHandleRef.current.style.transform = absoluteTransform;
      }
    },
    [timelineDuration, timelineScale]
	  );

	  const subtitlePlaybackAudioEntryRef = useRef<TimelineLayoutEntry | null>(null);
	  const subtitlePlaybackVisualEntryRef = useRef<TimelineLayoutEntry | null>(null);

	  const getSubtitlePlaybackTime = useCallback(
	    (time: number) => {
	      const within = (entry: TimelineLayoutEntry | null) =>
	        Boolean(
	          entry &&
	            time >= entry.left - timelineClipEpsilon &&
	            time < entry.left + entry.clip.duration + timelineClipEpsilon
	        );

	      let audioEntry = subtitlePlaybackAudioEntryRef.current;
	      if (!within(audioEntry)) {
	        audioEntry = getClipAtTime(time, "audio");
	        subtitlePlaybackAudioEntryRef.current = audioEntry;
	      }

	      const entry = audioEntry ?? (() => {
	        let visualEntry = subtitlePlaybackVisualEntryRef.current;
	        if (!within(visualEntry)) {
	          visualEntry = getClipAtTime(time, "visual");
	          subtitlePlaybackVisualEntryRef.current = visualEntry;
	        }
	        return visualEntry;
	      })();

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
	    subtitlePlaybackAudioEntryRef.current = null;
	    subtitlePlaybackVisualEntryRef.current = null;
	    playbackStartTimeRef.current = startTime;
	    playbackUiTickRef.current = last;
	    playheadVisualTimeRef.current = startTime;
	    updatePlayheadDom(startTime);

    const tick = (timestamp: number) => {
	      const deltaSeconds = (timestamp - last) / 1000;
	      last = timestamp;
	      const rawNext = playbackTimeRef.current + deltaSeconds;
	      const subtitleTime = getSubtitlePlaybackTime(rawNext);
	      // Drive timeline time from media time for subtitle-perfect sync.
	      const next = subtitleTime;
	      if (next >= projectDuration) {
	        playbackTimeRef.current = projectDuration;
	        playheadVisualTimeRef.current = projectDuration;
        updatePlayheadDom(projectDuration);
        startTransition(() => {
          setCurrentTime(projectDuration);
        });
        setIsPlaying(false);
        // Final subtitle update at end
        updateSubtitleForTimeRef.current(projectDuration);
        return;
      }
      playbackTimeRef.current = next;
      const smoothing = 1 - Math.exp(-deltaSeconds * 18);
      const visualPrev = playheadVisualTimeRef.current;
      const jumpThreshold = frameStepSeconds * 6;
      const visualNext =
        Math.abs(next - visualPrev) > jumpThreshold
          ? next
          : visualPrev + (next - visualPrev) * smoothing;
      playheadVisualTimeRef.current = visualNext;
      updatePlayheadDom(visualNext);

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
  }, [
    getSubtitlePlaybackTime,
    isPlaying,
    projectDuration,
    startTransition,
    updatePlayheadDom,
  ]);

  useEffect(() => {
    if (!isPlaying) {
      playbackTimeRef.current = currentTime;
    }
  }, [currentTime, isPlaying]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      updatePlayheadDom(currentTime);
      playheadVisualTimeRef.current = currentTime;
    }
  }, [currentTime, isPlaying, updatePlayheadDom]);

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
    const canPlayListeners: Array<{
      element: HTMLVideoElement;
      listener: () => void;
    }> = [];
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
              if (!isPlayingRef.current || !element.paused) {
                return;
              }
              const playPromise = element.play();
              if (playPromise) {
                playPromise.catch(() => {});
              }
            };
            canPlayListeners.push({ element, listener: handleCanPlay });
            element.addEventListener("canplay", handleCanPlay, {
              once: true,
            });
          }
        }
      } else {
        element.pause();
      }
    });
    return () => {
      canPlayListeners.forEach(({ element, listener }) => {
        element.removeEventListener("canplay", listener);
      });
    };
  }, [visualStack, isPlaying, clipSettings, fallbackVideoSettings]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    const preview = previewAudioRef.current;
    if (preview && !preview.paused) {
      preview.pause();
    }
    setIsPreviewPlaying((prev) => (prev ? false : prev));
  }, [isPlaying]);

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
        const fileInfo = { name: file.name, size: file.size, type: file.type };
        try {
          const kind = inferMediaKind(file);
          const uploadKind: "video" | "audio" | "image" =
            kind === "text" ? "video" : kind;
          logAssetDebug("[assets] prepare upload", {
            ...fileInfo,
            kind,
            uploadKind,
          });
          const previewUrl = URL.createObjectURL(file);
          const meta = await getMediaMeta(kind, previewUrl);
          URL.revokeObjectURL(previewUrl);
          const resolvedAspectRatio =
            meta.aspectRatio ??
            (meta.width && meta.height ? meta.width / meta.height : undefined);
          const stored = await uploadAssetFileSafe(file, {
            name: file.name || "Uploaded asset",
            kind: uploadKind,
            source: "upload",
            duration: meta.duration,
            width: meta.width,
            height: meta.height,
            aspectRatio: resolvedAspectRatio,
          });
          if (!stored) {
            console.warn("[assets] upload returned null", fileInfo);
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
          logAssetDebug("[assets] upload success", {
            ...fileInfo,
            assetId: asset.id,
          });
          return asset;
        } catch (error) {
          console.error("[assets] upload failed", fileInfo, error);
          return null;
        }
      })
    );
    const filtered = uploaded.filter((item): item is MediaAsset => Boolean(item));
    logAssetDebug("[assets] upload batch complete", {
      total: files.length,
      success: filtered.length,
    });
    return filtered;
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

    const topCreateZonePx = resolveTopCreateZonePx(rows);
    const wantsTopLane =
      offsetY < 0 ||
      (laneType !== "audio" && topCreateZonePx > 0 && offsetY <= topCreateZonePx);

    if (wantsTopLane) {
      // Dragging above all lanes or into top create zone - create new lane at top of section
      laneId = createLaneId(laneType, draftLanes, { placement: "top" });
    } else if (offsetY > totalHeight + laneGap) {
      // Dragging below all lanes - create new lane (will be positioned correctly)
      laneId = createLaneId(laneType, draftLanes);
    } else {
      // Find which lane we're hovering over
      const gapCreatePadding = Math.min(8, Math.max(4, Math.round(laneGap * 0.45)));
      for (let i = 0; i < rows.length; i++) {
        const lane = rows[i];
        const laneTop = cursor;
        const laneVisualBottom = cursor + lane.height;
        const laneBottom = cursor + lane.height + laneGap;
        const gapCenter = laneVisualBottom + laneGap / 2;
        const inGapZone =
          i < rows.length - 1 &&
          Math.abs(offsetY - gapCenter) <= gapCreatePadding;

        if (inGapZone) {
          const nextLane = rows[i + 1];
          if (canInsertLaneBetween(laneType, lane.type, nextLane.type)) {
            laneId = insertLaneAtIndex(laneType, draftLanes, i + 1);
            foundLaneIndex = -1;
            break;
          }
        }

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
    logAssetDebug("[assets] handleDroppedFiles", {
      count: files.length,
      target: options.target,
    });
    setUploading(true);
    try {
      const newAssets = await buildAssetsFromFiles(files);
      if (newAssets.length === 0) {
        return;
      }
      setIsBackgroundSelected(false);
      pushHistory();
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
    logAssetDebug("[assets] handleFiles", { count: files.length });
    setUploading(true);
    try {
      const newAssets = await buildAssetsFromFiles(files);
      if (newAssets.length === 0) {
        return;
      }
      setIsBackgroundSelected(false);
      pushHistory();
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

  const handleTogglePlayback = useCallback(() => {
    if (!activeClipEntry) {
      if (firstClipEntry) {
        const nextStartTime = firstClipEntry.clip.startTime;
        playbackTimeRef.current = nextStartTime;
        playheadVisualTimeRef.current = nextStartTime;
        setCurrentTime(nextStartTime);
        setSelectedClipId(firstClipEntry.clip.id);
        setSelectedClipIds([firstClipEntry.clip.id]);
        setActiveAssetId(firstClipEntry.asset.id);
        setIsPlaying(true);
      }
      return;
    }
    setIsPlaying((prev) => !prev);
  }, [activeClipEntry, firstClipEntry]);

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
  }, [createClip, createLaneId, pushHistory]);

  const addClipAtPosition = (
    assetId: string,
    laneId: string,
    startTime: number,
    assetOverride?: MediaAsset,
    options?: { skipHistory?: boolean }
  ) => {
    setIsBackgroundSelected(false);
    if (!options?.skipHistory) {
      pushHistory();
    }
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

  const handleAiVoiceoverPreviewToggle = useCallback(
    (voice: AiVoiceoverVoice) => {
      if (!voice?.url) {
        return;
      }
      const audio = previewAudioRef.current ?? new Audio();
      previewAudioRef.current = audio;
      audio.volume = 0.9;
      if (previewTrackId === voice.id) {
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
      audio.src = voice.url;
      audio.onended = () => {
        setIsPreviewPlaying(false);
      };
      setPreviewTrackId(voice.id);
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
    [addToTimeline, createClip, createLaneId, pushHistory]
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
    [addToTimeline, createLaneId, pushHistory]
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
    [addToTimeline, createLaneId, pushHistory]
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
    [addToTimeline, createClip, createLaneId, pushHistory]
  );

	  const applySplitScreenImport = useCallback(
	    async (payload: SplitScreenImportPayloadV1) => {
	      if (!payload?.mainVideo?.url || !payload?.backgroundVideo?.url) {
	        splitImportLog("apply aborted: missing required URLs", payload);
	        return;
	      }
	      const importStartedAt = Date.now();
	      splitImportLog("apply start", {
	        layout: payload.layout,
	        mainVideoName: payload.mainVideo.name,
	        hasMainAssetId:
	          typeof payload.mainVideo.assetId === "string" &&
	          payload.mainVideo.assetId.trim().length > 0,
	        backgroundVideoName: payload.backgroundVideo.name,
	      });

	      setSplitScreenImportOverlayStage("preparing");
	      setSplitScreenImportOverlayOpen(true);
	      splitImportLog("overlay stage -> preparing");
	      setIsBackgroundSelected(false);
	      setEditorProfile("split");
	      pushHistory();
	      pendingSplitScreenSubtitleRef.current = null;
	      pendingStreamerVideoSubtitleRef.current = null;
	      pendingRedditVideoSubtitleRef.current = null;
	      subtitleLaneIdRef.current = null;

	      let resolvedMainUrl = payload.mainVideo.url;
	      let resolvedMainName =
	        typeof payload.mainVideo.name === "string" &&
	        payload.mainVideo.name.trim().length > 0
	          ? payload.mainVideo.name.trim()
	          : "Main video";
	      let resolvedMainAssetId =
	        typeof payload.mainVideo.assetId === "string" &&
	        payload.mainVideo.assetId.trim().length > 0
	          ? payload.mainVideo.assetId.trim()
	          : null;

	      const persistMainVideoIfNeeded = async (): Promise<
	        | {
	            url: string;
	            name: string;
	            assetId: string;
	            meta: Awaited<ReturnType<typeof getMediaMeta>>;
	          }
	        | null
	      > => {
	        if (
	          !resolvedMainUrl.startsWith("blob:") &&
	          !resolvedMainUrl.startsWith("data:")
	        ) {
	          splitImportLog("source video already persisted; skipping blob upload");
	          return null;
	        }
	        setSplitScreenImportOverlayStage("uploading");
	        splitImportLog("overlay stage -> uploading");
	        try {
	          const meta = await getMediaMeta("video", resolvedMainUrl);
	          const response = await fetch(resolvedMainUrl);
	          const blob = await response.blob();
	          const mimeType =
	            typeof blob.type === "string" && blob.type.trim().length > 0
	              ? blob.type
	              : "video/mp4";
	          const extension = mimeType.toLowerCase().includes("webm")
	            ? "webm"
	            : mimeType.toLowerCase().includes("quicktime")
	              ? "mov"
	              : "mp4";
	          const safeBase =
	            resolvedMainName
	              .trim()
	              .replace(/[^a-zA-Z0-9-_]+/g, "-")
	              .replace(/-+/g, "-")
	              .replace(/^-+|-+$/g, "") || "video";
	          const file = new File([blob], `${safeBase}.${extension}`, {
	            type: mimeType,
	          });
	          const resolvedAspectRatio =
	            meta.aspectRatio ??
	            (meta.width && meta.height ? meta.width / meta.height : undefined);
	          const stored = await uploadAssetFileSafe(file, {
	            name: resolvedMainName,
	            kind: "video",
	            source: "upload",
	            duration: meta.duration,
	            width: meta.width,
	            height: meta.height,
	            aspectRatio: resolvedAspectRatio,
	          });
		          if (!stored?.url || !stored.id) {
		            splitImportLog("blob upload returned empty asset");
		            return null;
		          }
		          splitImportLog("blob upload success", {
		            storedAssetId: stored.id,
		            storedName: stored.name,
		          });
		          return {
		            url: stored.url,
		            name: stored.name || resolvedMainName,
		            assetId: stored.id,
		            meta,
	          };
	        } catch (error) {
	          console.error("[split-screen] failed to persist main video", error);
	          return null;
	        } finally {
	          setSplitScreenImportOverlayStage("preparing");
	        }
	      };

	      const getVideoMetaSafe = async (url: string, label: string) => {
	        try {
	          return await withPromiseTimeout(
	            getMediaMeta("video", url),
	            SPLIT_SCREEN_IMPORT_STEP_TIMEOUT_MS,
	            label
	          );
	        } catch (error) {
	          console.warn("[split-screen] video metadata fallback", {
	            label,
	            url,
	            error,
	          });
	          return {} as Awaited<ReturnType<typeof getMediaMeta>>;
	        }
	      };

		      const persistedMain = await withPromiseTimeout(
		        persistMainVideoIfNeeded(),
		        SPLIT_SCREEN_IMPORT_STEP_TIMEOUT_MS,
		        "Preparing split-screen source video"
		      ).catch((error) => {
		        console.warn("[split-screen] source video persist fallback", error);
		        return null;
		      });
	      splitImportLog("source video persistence resolved", {
	        usedPersistedAsset: Boolean(persistedMain?.assetId),
	      });
	      let mainMeta: Awaited<ReturnType<typeof getMediaMeta>>;
	      if (persistedMain) {
	        resolvedMainUrl = persistedMain.url;
	        resolvedMainName = persistedMain.name;
	        resolvedMainAssetId = persistedMain.assetId;
	        mainMeta = persistedMain.meta;
	      } else {
	        mainMeta = await getVideoMetaSafe(
	          resolvedMainUrl,
	          "Reading source video metadata"
	        );
	      }

	      // Split screen is primarily used for vertical short-form output.
	      setProjectSizeId("9:16");
	      const nextProjectName = `Split Screen - ${resolvedMainName || "Project"}`.trim();
	      setProjectName(nextProjectName);

      // Ensure this import starts a fresh editor project instead of overwriting an
      // existing `projectId` (common when the editor route is cached).
      projectIdRef.current = null;
      setProjectId(null);
      exportPersistedRef.current = null;
      setExportUi({
        open: false,
        status: "idle",
        stage: "",
        progress: 0,
        jobId: null,
        downloadUrl: null,
        error: null,
      });

		      const backgroundMeta = await getVideoMetaSafe(
		        payload.backgroundVideo.url,
		        "Reading background video metadata"
		      );
	      splitImportLog("metadata resolved", {
	        mainDuration:
	          typeof mainMeta.duration === "number" &&
	          Number.isFinite(mainMeta.duration)
	            ? mainMeta.duration
	            : null,
	        backgroundDuration:
	          typeof backgroundMeta.duration === "number" &&
	          Number.isFinite(backgroundMeta.duration)
	            ? backgroundMeta.duration
	            : null,
	      });

      const mainWidth =
        typeof mainMeta.width === "number" && Number.isFinite(mainMeta.width)
          ? mainMeta.width
          : undefined;
      const mainHeight =
        typeof mainMeta.height === "number" && Number.isFinite(mainMeta.height)
          ? mainMeta.height
          : undefined;
      const mainDuration =
        typeof mainMeta.duration === "number" && Number.isFinite(mainMeta.duration)
          ? mainMeta.duration
          : undefined;
      const mainAspectRatio =
        mainWidth && mainHeight ? mainWidth / mainHeight : undefined;

	      const mainAssetId = resolvedMainAssetId ?? crypto.randomUUID();

	      const mainAsset: MediaAsset = {
	        id: mainAssetId,
	        name: resolvedMainName,
	        kind: "video",
	        url: resolvedMainUrl,
	        size: 0,
	        duration: mainDuration,
	        width: mainWidth,
	        height: mainHeight,
        aspectRatio: mainAspectRatio,
        createdAt: Date.now(),
      };

      const bgWidth =
        typeof backgroundMeta.width === "number" && Number.isFinite(backgroundMeta.width)
          ? backgroundMeta.width
          : undefined;
      const bgHeight =
        typeof backgroundMeta.height === "number" && Number.isFinite(backgroundMeta.height)
          ? backgroundMeta.height
          : undefined;
      const bgDuration =
        typeof backgroundMeta.duration === "number" && Number.isFinite(backgroundMeta.duration)
          ? backgroundMeta.duration
          : undefined;
      const bgAspectRatio = bgWidth && bgHeight ? bgWidth / bgHeight : undefined;

	      const bgLibraryAsset = await withPromiseTimeout(
	        createExternalAssetSafe({
          url: payload.backgroundVideo.url,
          name: payload.backgroundVideo.name?.trim() || "Gameplay footage",
          kind: "video",
          source: "stock",
          duration: bgDuration,
          width: bgWidth,
          height: bgHeight,
          aspectRatio: bgAspectRatio,
        }),
        SPLIT_SCREEN_IMPORT_STEP_TIMEOUT_MS,
        "Saving background video asset"
	      ).catch((error) => {
	        console.warn("[split-screen] background asset save fallback", error);
	        return null;
	      });
	      splitImportLog("background asset resolved", {
	        persistedToLibrary: Boolean(bgLibraryAsset?.id),
	        backgroundAssetId: bgLibraryAsset?.id ?? null,
	      });

      const backgroundAsset: MediaAsset = {
        id: bgLibraryAsset?.id ?? crypto.randomUUID(),
        name: payload.backgroundVideo.name?.trim() || "Gameplay footage",
        kind: "video",
        url: bgLibraryAsset?.url ?? payload.backgroundVideo.url,
        size: 0,
        duration: bgDuration,
        width: bgWidth,
        height: bgHeight,
        aspectRatio: bgAspectRatio,
        createdAt: Date.now(),
      };

      const existingMain = assetsRef.current.find((asset) => asset.id === mainAsset.id);
      const existingBg = assetsRef.current.find((asset) => asset.id === backgroundAsset.id);
      const resolvedMainAsset = existingMain ?? mainAsset;
      const resolvedBgAsset = existingBg ?? backgroundAsset;

      const nextLanes: TimelineLane[] = [];
      const bgLaneId = createLaneId("video", nextLanes, { placement: "top" });
      const mainLaneId = createLaneId("video", nextLanes);

      const mainClip: TimelineClip = {
        id: crypto.randomUUID(),
        assetId: resolvedMainAsset.id,
        duration: Math.max(0.01, getAssetDurationSeconds(resolvedMainAsset)),
        startOffset: 0,
        startTime: 0,
        laneId: mainLaneId,
      };

      const targetDuration = mainClip.duration;
      const bgBaseDuration = Math.max(
        0.01,
        bgDuration ?? getAssetDurationSeconds(resolvedBgAsset) ?? targetDuration
      );
	      const bgClips: TimelineClip[] = [];
	      let cursor = 0;
      while (cursor < targetDuration - timelineClipEpsilon) {
        const remaining = targetDuration - cursor;
        const duration = Math.max(0.01, Math.min(bgBaseDuration, remaining));
        bgClips.push({
          id: crypto.randomUUID(),
          assetId: resolvedBgAsset.id,
          duration,
          startOffset: 0,
          startTime: cursor,
          laneId: bgLaneId,
        });
        cursor += duration;
        if (bgClips.length > 200) {
          break;
	      }
	      splitImportLog("timeline composition computed", {
	        mainClipDuration: mainClip.duration,
	        backgroundClipCount: bgClips.length,
	        targetDuration,
	      });
      }

      const mainTransform: ClipTransform =
        payload.layout === "side-by-side"
          ? { x: 0.5, y: 0, width: 0.5, height: 1 }
          : { x: 0, y: 0.5, width: 1, height: 0.5 };
      const bgTransform: ClipTransform =
        payload.layout === "side-by-side"
          ? { x: 0, y: 0, width: 0.5, height: 1 }
          : { x: 0, y: 0, width: 1, height: 0.5 };

      // Treat as a fresh editor composition (do not append to an existing timeline).
      setLanes(nextLanes);
      setAssets((prev) => {
        const next = [...prev];
        if (!next.some((asset) => asset.id === resolvedBgAsset.id)) {
          next.unshift(resolvedBgAsset);
        }
        if (!next.some((asset) => asset.id === resolvedMainAsset.id)) {
          next.unshift(resolvedMainAsset);
        }
        return next;
      });
      setTimeline([...bgClips, mainClip]);
      setClipTransforms(() => {
        const next: Record<string, ClipTransform> = {
          [mainClip.id]: mainTransform,
        };
        bgClips.forEach((clip) => {
          next[clip.id] = bgTransform;
        });
        return next;
      });
      // Prevent automatic "fit to stage" adjustments from overwriting our split layout
      // when video metadata loads.
      clipTransformTouchedRef.current = new Set([
        mainClip.id,
        ...bgClips.map((clip) => clip.id),
      ]);
      setBackgroundTransforms({});
      setClipSettings(() => {
        const next: Record<string, VideoClipSettings> = {};
        bgClips.forEach((clip) => {
          next[clip.id] = {
            ...createDefaultVideoSettings(),
            muted: true,
            volume: 0,
          };
        });
        return next;
      });
      setTextSettings({});
      setSubtitleSegments([]);
      subtitleLaneIdRef.current = null;
      setDetachedSubtitleIds(new Set());
      setSubtitleStatus("idle");
      setSubtitleError(null);
      setTranscriptSegments([]);
      setTranscriptStatus("idle");
      setTranscriptError(null);
      setTimelineThumbnails({});
      setAudioWaveforms({});
      setClipOrder({});
      setCurrentTime(0);
      setActiveAssetId(resolvedMainAsset.id);
      setActiveCanvasClipId(mainClip.id);
	      setSelectedClipId(mainClip.id);
	      setSelectedClipIds([mainClip.id]);
	      splitImportLog("timeline committed", {
	        mainClipId: mainClip.id,
	        mainAssetId: resolvedMainAsset.id,
	        backgroundAssetId: resolvedBgAsset.id,
	      });

      const desiredStyleId = payload.subtitles?.styleId;
      if (typeof desiredStyleId === "string" && desiredStyleId.trim().length > 0) {
        setSubtitleStyleId(desiredStyleId.trim());
      }
      setSubtitleSource(mainClip.id);
      setTranscriptSource(mainClip.id);

	      if (
	        payload.subtitles?.autoGenerate &&
	        typeof desiredStyleId === "string" &&
	        desiredStyleId.trim().length > 0
	      ) {
	        setSplitScreenImportOverlayStage("subtitles");
	        splitImportLog("overlay stage -> subtitles", {
	          styleId: desiredStyleId.trim(),
	        });
	        pendingSplitScreenSubtitleRef.current = {
	          mainClipId: mainClip.id,
	          styleId: desiredStyleId.trim(),
	        };
	      } else {
	        setSplitScreenImportOverlayStage("finalizing");
	        splitImportLog("overlay stage -> finalizing (no auto subtitles)");
	        requestAnimationFrame(() => setSplitScreenImportOverlayOpen(false));
	      }
	      splitImportLog("apply complete", {
	        durationMs: Date.now() - importStartedAt,
	      });
	    },
	    [createLaneId, pushHistory]
	  );

  const applyStreamerVideoImport = useCallback(
    async (payload: StreamerVideoImportPayloadV1) => {
      const hasMainUrl =
        typeof payload?.mainVideo?.url === "string" &&
        payload.mainVideo.url.trim().length > 0;
      const hasMainAssetId =
        typeof payload?.mainVideo?.assetId === "string" &&
        payload.mainVideo.assetId.trim().length > 0;
      const titleTextRaw =
        typeof payload?.titleText === "string" ? payload.titleText.trim() : "";
      if (!titleTextRaw || (!hasMainUrl && !hasMainAssetId)) {
        return;
      }

	      setStreamerVideoImportOverlayStage("preparing");
	      setStreamerVideoImportOverlayOpen(true);
	      setIsBackgroundSelected(false);
	      setEditorProfile("streamer");
	      pushHistory();
	      pendingSplitScreenSubtitleRef.current = null;
	      pendingStreamerVideoSubtitleRef.current = null;
	      pendingRedditVideoSubtitleRef.current = null;
	      subtitleLaneIdRef.current = null;

      let resolvedMainUrl =
        typeof payload.mainVideo.url === "string" ? payload.mainVideo.url.trim() : "";
      let resolvedMainName =
        typeof payload.mainVideo.name === "string" &&
        payload.mainVideo.name.trim().length > 0
          ? payload.mainVideo.name.trim()
          : "Main video";
      let resolvedMainAssetId =
        typeof payload.mainVideo.assetId === "string" &&
        payload.mainVideo.assetId.trim().length > 0
          ? payload.mainVideo.assetId.trim()
          : null;

      const resolveUserAssetUrl = async (assetId: string) => {
        const supabase = await getSupabaseClient();
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) {
          throw new Error("Please sign in to access your uploaded video.");
        }
        const { data, error } = await supabase
          .from("assets")
          .select(
            "id,name,kind,storage_bucket,storage_path,external_url,mime_type,size_bytes,duration_seconds,width,height,aspect_ratio,created_at"
          )
          .eq("id", assetId)
          .eq("user_id", user.id)
          .limit(1);
        if (error) {
          throw new Error("Unable to load your uploaded video.");
        }
        const row = data?.[0] as
          | {
              id: string;
              name: string | null;
              kind: string | null;
              storage_bucket: string | null;
              storage_path: string | null;
              external_url: string | null;
            }
          | undefined;
        if (!row) {
          throw new Error("Uploaded video not found. Please upload again.");
        }
        const name =
          typeof row.name === "string" && row.name.trim().length > 0
            ? row.name.trim()
            : resolvedMainName;
        const storageBucket =
          typeof row.storage_bucket === "string" && row.storage_bucket.trim().length > 0
            ? row.storage_bucket.trim()
            : "";
        const storagePath =
          typeof row.storage_path === "string" && row.storage_path.trim().length > 0
            ? row.storage_path.trim()
            : "";
        if (storageBucket && storagePath) {
          const { data: signedData, error: signedError } = await supabase.storage
            .from(storageBucket)
            .createSignedUrl(storagePath, 60 * 60);
          if (signedError || !signedData?.signedUrl) {
            throw new Error("Unable to access your uploaded video.");
          }
          return { url: signedData.signedUrl, name };
        }
        const externalUrl =
          typeof row.external_url === "string" ? row.external_url.trim() : "";
        if (externalUrl) {
          return { url: externalUrl, name };
        }
        throw new Error("Unable to access your uploaded video.");
      };

      if (!resolvedMainUrl && resolvedMainAssetId) {
        const resolved = await resolveUserAssetUrl(resolvedMainAssetId);
        resolvedMainUrl = resolved.url;
        resolvedMainName = resolved.name || resolvedMainName;
      }

      const persistMainVideoIfNeeded = async (): Promise<
        | {
            url: string;
            name: string;
            assetId: string;
            meta: Awaited<ReturnType<typeof getMediaMeta>>;
          }
        | null
      > => {
        if (
          !resolvedMainUrl.startsWith("blob:") &&
          !resolvedMainUrl.startsWith("data:")
        ) {
          return null;
        }
        setStreamerVideoImportOverlayStage("uploading");
        try {
          const meta = await getMediaMeta("video", resolvedMainUrl);
          const response = await fetch(resolvedMainUrl);
          const blob = await response.blob();
          const mimeType =
            typeof blob.type === "string" && blob.type.trim().length > 0
              ? blob.type
              : "video/mp4";
          const extension = mimeType.toLowerCase().includes("webm")
            ? "webm"
            : mimeType.toLowerCase().includes("quicktime")
              ? "mov"
              : "mp4";
          const safeBase =
            resolvedMainName
              .trim()
              .replace(/[^a-zA-Z0-9-_]+/g, "-")
              .replace(/-+/g, "-")
              .replace(/^-+|-+$/g, "") || "video";
          const file = new File([blob], `${safeBase}.${extension}`, {
            type: mimeType,
          });
          const resolvedAspectRatio =
            meta.aspectRatio ??
            (meta.width && meta.height ? meta.width / meta.height : undefined);
          const stored = await uploadAssetFileSafe(file, {
            name: resolvedMainName,
            kind: "video",
            source: "upload",
            duration: meta.duration,
            width: meta.width,
            height: meta.height,
            aspectRatio: resolvedAspectRatio,
          });
          if (!stored?.url || !stored.id) {
            return null;
          }
          return {
            url: stored.url,
            name: stored.name || resolvedMainName,
            assetId: stored.id,
            meta,
          };
        } catch (error) {
          console.error("[streamer-video] failed to persist main video", error);
          return null;
        } finally {
          setStreamerVideoImportOverlayStage("preparing");
        }
      };

      const persistedMain = await persistMainVideoIfNeeded();
      let mainMeta: Awaited<ReturnType<typeof getMediaMeta>>;
      if (persistedMain) {
        resolvedMainUrl = persistedMain.url;
        resolvedMainName = persistedMain.name;
        resolvedMainAssetId = persistedMain.assetId;
        mainMeta = persistedMain.meta;
      } else {
        mainMeta = await getMediaMeta("video", resolvedMainUrl);
      }

      // Streamer videos are primarily used for vertical short-form output.
      setProjectSizeId("9:16");
      const nextProjectName = `Streamer Video - ${resolvedMainName || "Project"}`.trim();
      setProjectName(nextProjectName);

      // Ensure this import starts a fresh editor project instead of overwriting an
      // existing `projectId` (common when the editor route is cached).
      projectIdRef.current = null;
      setProjectId(null);
      exportPersistedRef.current = null;
      setExportUi({
        open: false,
        status: "idle",
        stage: "",
        progress: 0,
        jobId: null,
        downloadUrl: null,
        error: null,
      });

      const mainWidth =
        typeof mainMeta.width === "number" && Number.isFinite(mainMeta.width)
          ? mainMeta.width
          : undefined;
      const mainHeight =
        typeof mainMeta.height === "number" && Number.isFinite(mainMeta.height)
          ? mainMeta.height
          : undefined;
      const mainDuration =
        typeof mainMeta.duration === "number" && Number.isFinite(mainMeta.duration)
          ? mainMeta.duration
          : undefined;
      const mainAspectRatio =
        mainWidth && mainHeight ? mainWidth / mainHeight : undefined;

      const mainAssetId = resolvedMainAssetId ?? crypto.randomUUID();
      const mainAsset: MediaAsset = {
        id: mainAssetId,
        name: resolvedMainName,
        kind: "video",
        url: resolvedMainUrl,
        size: 0,
        duration: mainDuration,
        width: mainWidth,
        height: mainHeight,
        aspectRatio: mainAspectRatio,
        createdAt: Date.now(),
      };

      const resolvedMainAsset =
        assetsRef.current.find((asset) => asset.id === mainAsset.id) ?? mainAsset;

      const nextLanes: TimelineLane[] = [];
      const mainLaneId = createLaneId("video", nextLanes);
      const bgLaneId = createLaneId("video", nextLanes);
      const titleLaneId = createLaneId("text", nextLanes, { placement: "top" });

      const mainClip: TimelineClip = {
        id: crypto.randomUUID(),
        assetId: resolvedMainAsset.id,
        duration: Math.max(0.01, getAssetDurationSeconds(resolvedMainAsset)),
        startOffset: 0,
        startTime: 0,
        laneId: mainLaneId,
      };

      const backgroundClip: TimelineClip = {
        id: crypto.randomUUID(),
        assetId: resolvedMainAsset.id,
        duration: mainClip.duration,
        startOffset: 0,
        startTime: 0,
        laneId: bgLaneId,
      };

      const stageRatio = 9 / 16;
      const resolvedAssetRatio = mainAspectRatio ?? stageRatio;

      const coverTransform: ClipTransform = (() => {
        const safeStage = stageRatio > 0 ? stageRatio : 16 / 9;
        const safeAsset = resolvedAssetRatio > 0 ? resolvedAssetRatio : safeStage;
        if (safeAsset > safeStage) {
          const width = safeAsset / safeStage;
          return {
            x: (1 - width) / 2,
            y: 0,
            width,
            height: 1,
          };
        }
        const height = safeStage / safeAsset;
        return {
          x: 0,
          y: (1 - height) / 2,
          width: 1,
          height,
        };
      })();

      const containTransform: ClipTransform = createDefaultTransform(
        resolvedAssetRatio,
        stageRatio
      );

      const titleText = titleTextRaw;
      const titleAsset: MediaAsset = {
        ...createTextAsset("Title"),
        duration: mainClip.duration,
      };
      const titleClip: TimelineClip = {
        id: crypto.randomUUID(),
        assetId: titleAsset.id,
        duration: mainClip.duration,
        startOffset: 0,
        startTime: 0,
        laneId: titleLaneId,
      };
      const titleTransform: ClipTransform = {
        x: 0.05,
        y: 0.04,
        width: 0.9,
        height: 0.22,
      };
      const titleSettings: TextClipSettings = {
        ...createDefaultTextSettings(),
        text: titleText,
        fontFamily: "Poppins",
        fontSize: 16,
        align: "center",
        outlineEnabled: false,
        shadowEnabled: false,
      };

      // Treat as a fresh editor composition (do not append to an existing timeline).
      setLanes(nextLanes);
      setAssets((prev) => {
        const next = [...prev];
        if (!next.some((asset) => asset.id === titleAsset.id)) {
          next.unshift(titleAsset);
        }
        if (!next.some((asset) => asset.id === resolvedMainAsset.id)) {
          next.unshift(resolvedMainAsset);
        }
        return next;
      });
      setTimeline([backgroundClip, mainClip, titleClip]);
      setClipTransforms(() => ({
        [backgroundClip.id]: coverTransform,
        [mainClip.id]: containTransform,
        [titleClip.id]: titleTransform,
      }));
      clipTransformTouchedRef.current = new Set([
        backgroundClip.id,
        mainClip.id,
        titleClip.id,
      ]);
      setBackgroundTransforms({});
      setClipSettings(() => ({
        [backgroundClip.id]: {
          ...createDefaultVideoSettings(),
          muted: true,
          volume: 0,
          blur: 80,
          brightness: -20,
          exposure: -10,
          saturation: -10,
          vignette: 20,
        },
        [mainClip.id]: createDefaultVideoSettings(),
      }));
	      setTextSettings(() => ({
	        [titleClip.id]: titleSettings,
	      }));
	      setSubtitleSegments([]);
	      subtitleLaneIdRef.current = null;
	      setDetachedSubtitleIds(new Set());
	      setSubtitleStatus("idle");
      setSubtitleError(null);
      setTranscriptSegments([]);
      setTranscriptStatus("idle");
      setTranscriptError(null);
      setTimelineThumbnails({});
      setAudioWaveforms({});
      setClipOrder({});
      setCurrentTime(0);
      setActiveAssetId(resolvedMainAsset.id);
      setActiveCanvasClipId(mainClip.id);
      setSelectedClipId(mainClip.id);
      setSelectedClipIds([mainClip.id]);

      const desiredStyleId = payload.subtitles?.styleId;
      if (typeof desiredStyleId === "string" && desiredStyleId.trim().length > 0) {
        setSubtitleStyleId(desiredStyleId.trim());
      }
      setSubtitleSource(mainClip.id);
      setTranscriptSource(mainClip.id);

      if (
        payload.subtitles?.autoGenerate &&
        typeof desiredStyleId === "string" &&
        desiredStyleId.trim().length > 0
      ) {
        setStreamerVideoImportOverlayStage("subtitles");
        pendingStreamerVideoSubtitleRef.current = {
          sourceClipId: mainClip.id,
          styleId: desiredStyleId.trim(),
        };
      } else {
        setStreamerVideoImportOverlayStage("finalizing");
        requestAnimationFrame(() => setStreamerVideoImportOverlayOpen(false));
      }
    },
    [createLaneId, pushHistory]
  );

  const applyRedditVideoImport = useCallback(
    async (payload: RedditVideoImportPayloadV1) => {
      if (!payload?.gameplay?.url || !payload?.script) {
        return;
      }

	      setRedditVideoImportOverlayStage("preparing");
	      setRedditVideoImportOverlayOpen(true);
	      setIsBackgroundSelected(false);
	      setEditorProfile("reddit");
	      pushHistory();
	      pendingSplitScreenSubtitleRef.current = null;
	      pendingStreamerVideoSubtitleRef.current = null;
	      pendingRedditVideoSubtitleRef.current = null;
	      subtitleLaneIdRef.current = null;

      const safeTitle =
        typeof payload.post?.title === "string" && payload.post.title.trim().length > 0
          ? payload.post.title.trim()
          : "Reddit video";

      // Reddit videos are primarily vertical short-form output.
      setProjectSizeId("9:16");
      setProjectName(`Reddit Video - ${safeTitle}`);

      // Ensure this import starts a fresh editor project instead of overwriting an
      // existing `projectId` (common when the editor route is cached).
      projectIdRef.current = null;
      setProjectId(null);
      exportPersistedRef.current = null;
      setExportUi({
        open: false,
        status: "idle",
        stage: "",
        progress: 0,
        jobId: null,
        downloadUrl: null,
        error: null,
      });
      // Temporarily pause autosave while the new Reddit project is being assembled.
      setProjectStarted(false);
      // Start from a clean composition so imported Reddit clips never append to
      // whatever was previously open in the editor.
      setLanes([]);
      setTimeline([]);
      setClipTransforms({});
      setBackgroundTransforms({});
      setClipSettings({});
      setTextSettings({});
      setSubtitleSegments([]);
      setDetachedSubtitleIds(new Set());
      setSubtitleStatus("idle");
      setSubtitleError(null);
      setTranscriptSegments([]);
      setTranscriptStatus("idle");
      setTranscriptError(null);
      setTimelineThumbnails({});
      setAudioWaveforms({});
      setClipOrder({});
      setCurrentTime(0);
      setActiveAssetId(null);
      setActiveCanvasClipId(null);
      setSelectedClipId(null);
      setSelectedClipIds([]);

      const generateVoiceoverUrl = async (text: string, voice: string) => {
        let lastError: Error | null = null;
        for (
          let attempt = 1;
          attempt <= REDDIT_VOICEOVER_MAX_ATTEMPTS;
          attempt += 1
        ) {
          try {
            const response = await fetchWithTimeout(
              "/api/ai-voiceover",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, voice }),
              },
              REDDIT_VOICEOVER_TIMEOUT_MS,
              "Voiceover generation"
            );
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
              const message =
                typeof data?.error === "string" && data.error.length > 0
                  ? data.error
                  : `Voiceover generation failed (${response.status}).`;
              throw new Error(message);
            }
            const audioEntry = data?.audio ?? null;
            const audioUrl =
              typeof audioEntry?.url === "string"
                ? audioEntry.url
                : typeof data?.audio_url === "string"
                  ? data.audio_url
                  : typeof data?.audioUrl === "string"
                    ? data.audioUrl
                    : typeof data?.audio === "string"
                      ? data.audio
                      : null;
            if (!audioUrl) {
              throw new Error("Voiceover generation returned no audio.");
            }
            return audioUrl;
          } catch (error) {
            const normalized =
              error instanceof Error
                ? error
                : new Error("Voiceover generation failed.");
            lastError = normalized;
            if (
              attempt >= REDDIT_VOICEOVER_MAX_ATTEMPTS ||
              !isTransientErrorMessage(normalized.message)
            ) {
              throw normalized;
            }
            await delay(attempt === 1 ? 900 : 1600);
          }
        }
        throw lastError ?? new Error("Voiceover generation failed.");
      };

      const createGeneratedVoiceAsset = async (options: {
        url: string;
        script: string;
        voice: string;
      }): Promise<MediaAsset> => {
        const existing = assetsRef.current.find(
          (asset) => asset.kind === "audio" && asset.url === options.url
        );
        if (existing) {
          return existing;
        }
        const trimmedScript = options.script.trim() || "Voiceover";
        const shortScript =
          trimmedScript.length > 60
            ? `${trimmedScript.slice(0, 57)}...`
            : trimmedScript;
        const voiceLabel = options.voice.trim() || "AI";
        const name = `Voiceover - ${voiceLabel} - ${shortScript}`;
        const meta = await getMediaMeta("audio", options.url);
        const libraryAsset = await createExternalAssetSafe({
          url: options.url,
          name,
          kind: "audio",
          source: "generated",
          duration: meta.duration,
        });
        return {
          id: libraryAsset?.id ?? crypto.randomUUID(),
          name,
          kind: "audio",
          url: libraryAsset?.url ?? options.url,
          size: libraryAsset?.size ?? 0,
          duration: meta.duration,
          createdAt: Date.now(),
        };
      };

      const renderElementToPngFile = async (
        node: HTMLElement,
        options?: { scale?: number; fileName?: string }
      ) => {
        const scale = Math.max(1, Math.min(4, options?.scale ?? 2));
        const rect = node.getBoundingClientRect();
        const width = Math.max(1, Math.ceil(rect.width));
        const height = Math.max(1, Math.ceil(rect.height));

        const clone = node.cloneNode(true) as HTMLElement;
        const srcElements = Array.from(node.querySelectorAll("*"));
        const cloneElements = Array.from(clone.querySelectorAll("*"));

        const applyInlineStyles = (source: Element, target: Element) => {
          if (!(source instanceof Element) || !(target instanceof Element)) {
            return;
          }
          const computed = window.getComputedStyle(source);
          const style: string[] = [];
          for (let i = 0; i < computed.length; i += 1) {
            const prop = computed[i];
            const value = computed.getPropertyValue(prop);
            if (!value) {
              continue;
            }
            style.push(`${prop}:${value};`);
          }
          (target as HTMLElement).setAttribute(
            "style",
            `${(target as HTMLElement).getAttribute("style") ?? ""};${style.join("")}`
          );
        };

        applyInlineStyles(node, clone);
        srcElements.forEach((element, index) => {
          const target = cloneElements[index];
          if (target) {
            applyInlineStyles(element, target);
          }
        });

        const wrapper = document.createElement("div");
        wrapper.appendChild(clone);

        const makeXhtmlSafe = (markup: string) => {
          // `foreignObject` content is parsed as XML/XHTML. Browsers serialize void
          // elements like `<img>` without a closing slash in HTML mode, which
          // breaks SVG XML parsing and causes image rendering to fail.
          return markup.replace(/<img\b([^>]*)>/gi, (match, attrs) => {
            if (match.trimEnd().endsWith("/>")) {
              return match;
            }
            return `<img${attrs} />`;
          });
        };

        const serializedMarkup = makeXhtmlSafe(wrapper.innerHTML);
        const svg = [
          `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
          `<foreignObject width="100%" height="100%">`,
          `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;">`,
          serializedMarkup,
          `</div>`,
          `</foreignObject>`,
          `</svg>`,
        ].join("");

        const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
        const svgUrl = URL.createObjectURL(svgBlob);
        try {
          const img = new Image();
          img.decoding = "async";
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Failed to render intro card."));
            img.src = svgUrl;
          });

          const canvas = document.createElement("canvas");
          canvas.width = width * scale;
          canvas.height = height * scale;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            throw new Error("Canvas unavailable.");
          }
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0);

          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (result) => {
                if (result) {
                  resolve(result);
                } else {
                  reject(new Error("Failed to export intro card image."));
                }
              },
              "image/png",
              0.92
            );
          });

          return new File([blob], options?.fileName ?? "reddit-intro-card.png", {
            type: "image/png",
          });
        } finally {
          URL.revokeObjectURL(svgUrl);
        }
      };

      const createIntroCardAsset = async () => {
        const avatarUrl = payload.post.avatarUrl;
        const username = payload.post.username;
        const likes = payload.post.likes;
        const comments = payload.post.comments;
        const title = payload.post.title;
        const darkMode = payload.post.darkMode;

        const escapeHtml = (value: string) =>
          value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

        const normalizeUrl = (value: string) => {
          const trimmed = value.trim();
          if (!trimmed) {
            return "";
          }
          if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
            return trimmed;
          }
          try {
            return new URL(trimmed, window.location.href).toString();
          } catch {
            return trimmed;
          }
        };

        const resolveImageDataUrl = async (url: string) => {
          const normalized = normalizeUrl(url);
          if (!normalized) {
            return "";
          }
          if (normalized.startsWith("data:") || normalized.startsWith("blob:")) {
            return normalized;
          }
          try {
            const response = await fetchWithTimeout(
              normalized,
              { method: "GET" },
              REDDIT_IMAGE_FETCH_TIMEOUT_MS,
              "Loading Reddit intro image"
            );
            if (!response.ok) {
              return normalized;
            }
            const blob = await response.blob();
            return await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolve(
                  typeof reader.result === "string" ? reader.result : normalized
                );
              reader.onerror = () => reject(new Error("Failed to read image data."));
              reader.readAsDataURL(blob);
            });
          } catch {
            return normalized;
          }
        };

        const fallbackAvatarUrl = await resolveImageDataUrl(
          new URL(
            "/reddit-default-pfp/0qoqln2f5bu71.webp",
            window.location.href
          ).toString()
        );

        const avatarCandidateUrl = await resolveImageDataUrl(avatarUrl);
        const resolvedAvatarUrl = (() => {
          if (!avatarCandidateUrl) {
            return fallbackAvatarUrl;
          }
          if (
            avatarCandidateUrl.startsWith("data:") ||
            avatarCandidateUrl.startsWith("blob:")
          ) {
            return avatarCandidateUrl;
          }
          try {
            const origin = new URL(avatarCandidateUrl).origin;
            if (origin !== window.location.origin) {
              return fallbackAvatarUrl || avatarCandidateUrl;
            }
          } catch {
            // Ignore URL parsing failures; keep candidate.
          }
          return avatarCandidateUrl;
        })();

        const resolvedAwardsUrl = await resolveImageDataUrl(
          new URL("/awards.png", window.location.href).toString()
        );

        const safeUsername = escapeHtml(username);
        const safeLikes = escapeHtml(likes);
        const safeComments = escapeHtml(comments);
        const safeTitle = escapeHtml(title);

        const renderIntroCardFallbackToPngFile = async (options: {
          width: number;
          height: number;
          fileName: string;
          avatarUrl: string;
          awardsUrl?: string;
          username: string;
          title: string;
          likes: string;
          comments: string;
          darkMode: boolean;
        }) => {
          const scale = 2;
          const width = Math.max(1, Math.round(options.width));
          let height = Math.max(1, Math.round(options.height));

          const padding = 16;
          const avatarSize = 40;
          const avatarX = padding;
          const avatarY = padding;
          const iconSize = 16;
          const awardsHeight = 16;
          const awardsX = avatarX + avatarSize + 8;
          const awardsY = avatarY + 24;
          const titleFont =
            "500 16px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
          const titleLineHeight = 20;
          const titleMaxWidth = Math.max(1, width - padding * 2);

          const wrapText = (
            context: CanvasRenderingContext2D,
            value: string,
            maxWidth: number
          ) => {
            const normalized = value.replace(/\s+/g, " ").trim();
            if (!normalized) {
              return [];
            }
            const words = normalized.split(" ").filter(Boolean);
            const lines: string[] = [];
            let current = "";
            words.forEach((word) => {
              const candidate = current ? `${current} ${word}` : word;
              if (context.measureText(candidate).width <= maxWidth || !current) {
                current = candidate;
                return;
              }
              lines.push(current);
              current = word;
            });
            if (current) {
              lines.push(current);
            }
            return lines;
          };

          const measureCanvas = document.createElement("canvas");
          const measureCtx = measureCanvas.getContext("2d");
          if (!measureCtx) {
            throw new Error("Canvas unavailable.");
          }
          measureCtx.font = titleFont;
          const headerBottom = options.awardsUrl
            ? Math.max(avatarY + avatarSize, awardsY + awardsHeight)
            : avatarY + avatarSize;
          const titleY = headerBottom + 16;
          const titleLines = wrapText(measureCtx, options.title, titleMaxWidth);
          const requiredHeight = Math.ceil(
            titleY + titleLines.length * titleLineHeight + 18 + iconSize + padding
          );
          height = Math.max(height, requiredHeight);

          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            throw new Error("Canvas unavailable.");
          }
          ctx.scale(scale, scale);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          const borderColor = options.darkMode ? null : "#e5e7eb"; // gray-200
          const cardBg = options.darkMode ? "#000000" : "#ffffff";
          const primaryText = options.darkMode ? "#ffffff" : "#000000";
          const secondaryText = options.darkMode ? "#ADADAD" : "#adadad";
          const iconStroke = options.darkMode ? "#575757" : "#adadad";

          const drawRoundedRectPath = (
            x: number,
            y: number,
            w: number,
            h: number,
            r: number
          ) => {
            const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + w - radius, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
            ctx.lineTo(x + w, y + h - radius);
            ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
            ctx.lineTo(x + radius, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
          };

          const loadImage = async (src: string) => {
            const img = new Image();
            img.decoding = "async";
            img.crossOrigin = "anonymous";
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error("Failed to load image."));
              img.src = src;
            });
            try {
              await img.decode();
            } catch {
              // Ignore decode errors; image may still be drawable.
            }
            return img;
          };

          drawRoundedRectPath(0, 0, width, height, 12);
          ctx.fillStyle = cardBg;
          ctx.fill();
          if (borderColor) {
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          let avatarImage: HTMLImageElement | null = null;
          try {
            avatarImage = options.avatarUrl ? await loadImage(options.avatarUrl) : null;
          } catch {
            avatarImage = null;
          }
          ctx.save();
          ctx.beginPath();
          ctx.arc(
            avatarX + avatarSize / 2,
            avatarY + avatarSize / 2,
            avatarSize / 2,
            0,
            Math.PI * 2
          );
          ctx.closePath();
          ctx.clip();
          if (avatarImage) {
            ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
          } else {
            ctx.fillStyle = "#d1d5db";
            ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
          }
          ctx.restore();

          const usernameX = avatarX + avatarSize + 8;
          const usernameY = avatarY + 6;
          ctx.fillStyle = primaryText;
          ctx.textBaseline = "top";
          ctx.font =
            "600 16px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";
          const usernameText = options.username || "reddit-user";
          ctx.fillText(usernameText, usernameX, usernameY);

          const usernameWidth = ctx.measureText(usernameText).width;
          const badgeSize = 14;
          const badgeX = usernameX + usernameWidth + 8;
          const badgeY = usernameY + 6;
          ctx.fillStyle = "rgb(25, 165, 252)";
          ctx.beginPath();
          ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          ctx.moveTo(badgeX + badgeSize * 0.28, badgeY + badgeSize * 0.55);
          ctx.lineTo(badgeX + badgeSize * 0.45, badgeY + badgeSize * 0.7);
          ctx.lineTo(badgeX + badgeSize * 0.75, badgeY + badgeSize * 0.35);
          ctx.stroke();

          let awardsImage: HTMLImageElement | null = null;
          if (options.awardsUrl) {
            try {
              awardsImage = await loadImage(options.awardsUrl);
            } catch {
              awardsImage = null;
            }
          }
          if (awardsImage) {
            const aspect =
              awardsImage.naturalHeight > 0
                ? awardsImage.naturalWidth / awardsImage.naturalHeight
                : 1;
            const awardsWidth = Math.max(1, Math.round(awardsHeight * aspect));
            ctx.drawImage(awardsImage, awardsX, awardsY, awardsWidth, awardsHeight);
          }

          const titleX = padding;
          ctx.fillStyle = primaryText;
          ctx.font = titleFont;
          titleLines.forEach((line, i) => {
            ctx.fillText(line, titleX, titleY + i * titleLineHeight);
          });

          const bottomY = height - padding - iconSize / 2;
          ctx.strokeStyle = iconStroke;
          ctx.lineWidth = 1.6;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.fillStyle = secondaryText;
          ctx.textBaseline = "middle";
          ctx.font =
            "400 14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial";

          let cursorX = padding;

          const drawHeart = (x: number, y: number, size: number) => {
            const topCurveHeight = size * 0.32;
            ctx.beginPath();
            ctx.moveTo(x + size / 2, y + size);
            ctx.bezierCurveTo(
              x + size / 2,
              y + size - topCurveHeight,
              x,
              y + size - topCurveHeight,
              x,
              y + size / 2
            );
            ctx.bezierCurveTo(x, y + topCurveHeight, x + size / 4, y, x + size / 2, y + topCurveHeight);
            ctx.bezierCurveTo(
              x + (size * 3) / 4,
              y,
              x + size,
              y + topCurveHeight,
              x + size,
              y + size / 2
            );
            ctx.bezierCurveTo(
              x + size,
              y + size - topCurveHeight,
              x + size / 2,
              y + size - topCurveHeight,
              x + size / 2,
              y + size
            );
            ctx.closePath();
            ctx.stroke();
          };

          const drawComment = (x: number, y: number, size: number) => {
            const r = Math.max(2, size * 0.18);
            const w = size;
            const h = Math.max(10, size * 0.78);
            const tailW = Math.max(4, size * 0.22);
            const tailH = Math.max(3, size * 0.18);
            const bodyY = y + (size - h) / 2;
            drawRoundedRectPath(x, bodyY, w, h, r);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + w * 0.28, bodyY + h);
            ctx.lineTo(x + w * 0.28 + tailW, bodyY + h);
            ctx.lineTo(x + w * 0.28 + tailW * 0.4, bodyY + h + tailH);
            ctx.closePath();
            ctx.stroke();
          };

          const drawShare = (x: number, y: number, size: number) => {
            const centerY = y + size / 2;
            ctx.beginPath();
            ctx.moveTo(x + size * 0.5, y + size * 0.05);
            ctx.lineTo(x + size * 0.5, y + size * 0.78);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + size * 0.3, y + size * 0.25);
            ctx.lineTo(x + size * 0.5, y + size * 0.05);
            ctx.lineTo(x + size * 0.7, y + size * 0.25);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x + size * 0.2, centerY + size * 0.2);
            ctx.lineTo(x + size * 0.2, y + size * 0.95);
            ctx.lineTo(x + size * 0.8, y + size * 0.95);
            ctx.lineTo(x + size * 0.8, centerY + size * 0.2);
            ctx.stroke();
          };

          drawHeart(cursorX, bottomY - iconSize / 2, iconSize);
          cursorX += iconSize + 6;
          const likesText = options.likes || "0";
          ctx.fillText(likesText, cursorX, bottomY);
          cursorX += ctx.measureText(likesText).width + 12;

          drawComment(cursorX, bottomY - iconSize / 2, iconSize);
          cursorX += iconSize + 6;
          const commentsText = options.comments || "0";
          ctx.fillText(commentsText, cursorX, bottomY);

          const shareText = "share";
          const shareTextWidth = ctx.measureText(shareText).width;
          const shareTotalWidth = iconSize + 6 + shareTextWidth;
          const shareX = Math.max(padding, width - padding - shareTotalWidth);
          drawShare(shareX, bottomY - iconSize / 2, iconSize);
          ctx.fillText(shareText, shareX + iconSize + 6, bottomY);

          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (result) => {
                if (result) {
                  resolve(result);
                } else {
                  reject(new Error("Failed to export intro card image."));
                }
              },
              "image/png",
              0.92
            );
          });

          return new File([blob], options.fileName, {
            type: "image/png",
          });
        };

        const container = document.createElement("div");
        container.style.position = "fixed";
        container.style.left = "-10000px";
        container.style.top = "-10000px";
        container.style.zIndex = "0";
        container.style.pointerEvents = "none";
        container.style.opacity = "0";

        const cardBg = darkMode ? "bg-black" : "bg-[#1a1c1e]";
        const borderColor = darkMode ? "border-transparent" : "border-[rgba(255,255,255,0.08)]";
        const textPrimary = darkMode ? "text-white" : "text-black";
        const iconText = darkMode ? "text-[#ADADAD]" : "text-[#adadad]";
        const stroke = darkMode ? "#575757" : "#adadad";

        container.innerHTML = `
	          <div
	            id="reddit-card"
	            class="${cardBg} ${borderColor} max-w-xs select-none overflow-hidden border p-4"
	            style="border-radius:12px;transform:scale(1);transform-origin:left top;"
		          >
	            <div class="flex flex-col">
	              <div class="flex items-center">
	                <div class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full">
	                  <img alt="Profile Picture" class="w-full rounded-full" draggable="false" crossorigin="anonymous" src="${resolvedAvatarUrl}" />
	                </div>
	                <div class="ml-2 flex items-center">
	                  <span class="${textPrimary} font-semibold">${safeUsername}</span>
	                  <svg aria-hidden="true" viewBox="0 0 24 24" class="ml-1 h-5 w-5" fill="currentColor" style="color: rgb(25, 165, 252);">
	                    <path d="M10.007 2.10377C8.60544 1.65006 7.08181 2.28116 6.41156 3.59306L5.60578 5.17023C5.51004 5.35763 5.35763 5.51004 5.17023 5.60578L3.59306 6.41156C2.28116 7.08181 1.65006 8.60544 2.10377 10.007L2.64923 11.692C2.71404 11.8922 2.71404 12.1078 2.64923 12.308L2.10377 13.993C1.65006 15.3946 2.28116 16.9182 3.59306 17.5885L5.17023 18.3942C5.35763 18.49 5.51004 18.6424 5.60578 18.8298L6.41156 20.407C7.08181 21.7189 8.60544 22.35 10.007 21.8963L11.692 21.3508C11.8922 21.286 12.1078 21.286 12.308 21.3508L13.993 21.8963C15.3946 22.35 16.9182 21.7189 17.5885 20.407L18.3942 18.8298C18.49 18.6424 18.6424 18.49 18.8298 18.3942L20.407 17.5885C21.7189 16.9182 22.35 15.3946 21.8963 13.993L21.3508 12.308C21.286 12.1078 21.286 11.8922 21.3508 11.692L21.8963 10.007C22.35 8.60544 21.7189 7.08181 20.407 6.41156L18.8298 5.60578C18.6424 5.51004 18.49 5.35763 18.3942 5.17023L17.5885 3.59306C16.9182 2.28116 15.3946 1.65006 13.993 2.10377L12.308 2.64923C12.1078 2.71403 11.8922 2.71404 11.692 2.64923L10.007 2.10377ZM6.75977 11.7573L8.17399 10.343L11.0024 13.1715L16.6593 7.51465L18.0735 8.92886L11.0024 15.9999L6.75977 11.7573Z"></path>
	                  </svg>
	                </div>
	              </div>
              <div class="ml-[48px] -mt-4">
                <img alt="Achievements" class="block h-4 w-auto" draggable="false" crossorigin="anonymous" src="${resolvedAwardsUrl}" />
              </div>
	            </div>
	            <div class="mb-2 mt-3 text-left font-medium">
	              <p class="${textPrimary}" style="white-space:pre-wrap;word-break:break-word;line-height:1.25;">${safeTitle}</p>
	            </div>
	            <div class="mt-3 flex items-center justify-between">
	              <div class="flex items-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heart scale-x-[-1] transform" aria-hidden="true">
                  <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"></path>
                </svg>
	                <span class="ml-1 text-sm font-normal ${iconText}">${safeLikes}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle scale-x-[-1] transform" aria-hidden="true">
                  <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"></path>
                </svg>
	                <span class="ml-1 mt-[0.2px] text-sm font-normal ${iconText}">${safeComments}</span>
	              </div>
	              <div class="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-share" aria-hidden="true">
                  <path d="M12 2v13"></path>
                  <path d="m16 6-4-4-4 4"></path>
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                </svg>
                <span class="ml-1 text-sm font-normal ${iconText}">share</span>
	              </div>
            </div>
          </div>
        `;

        document.body.appendChild(container);
        try {
          if (document.fonts?.ready) {
            await document.fonts.ready;
          }
          const images = Array.from(container.querySelectorAll("img"));
          await Promise.all(
            images.map(async (img) => {
              try {
                await (img as HTMLImageElement).decode();
              } catch {
                // Ignore decode errors (e.g., CORS). Rendering may still succeed.
              }
            })
          );
          const card = container.querySelector<HTMLElement>("#reddit-card");
          if (!card) {
            throw new Error("Intro card element missing.");
          }
          const file = await (async () => {
            try {
              return await renderElementToPngFile(card, {
                scale: 2,
                fileName: "reddit-intro-card.png",
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : "";
              const isTaintedCanvasError =
                (error instanceof DOMException && error.name === "SecurityError") ||
                /tainted canvases|tainted canvas/i.test(message);
              if (!isTaintedCanvasError) {
                console.warn(
                  "[reddit-video] intro card DOM render failed, using fallback",
                  error
                );
              }
              const rect = card.getBoundingClientRect();
              const fallbackWidth = Math.max(
                1,
                Math.ceil(card.offsetWidth || rect.width || 0)
              );
              const fallbackHeight = Math.max(
                1,
                Math.ceil(card.offsetHeight || rect.height || 0)
              );
              return await renderIntroCardFallbackToPngFile({
                width: fallbackWidth,
                height: fallbackHeight,
                fileName: "reddit-intro-card.png",
                avatarUrl: resolvedAvatarUrl,
                awardsUrl: resolvedAwardsUrl,
                username,
                title: introText || title,
                likes,
                comments,
                darkMode,
              });
            }
          })();
          const meta = await (async () => {
            const objectUrl = URL.createObjectURL(file);
            try {
              return await getMediaMeta("image", objectUrl);
            } finally {
              URL.revokeObjectURL(objectUrl);
            }
          })();
          const libraryAsset = await uploadAssetFileSafe(file, {
            name: "Reddit intro card",
            kind: "image",
            source: "generated",
            width: meta.width,
            height: meta.height,
            aspectRatio: meta.aspectRatio,
          });
          if (!libraryAsset) {
            console.warn(
              "[reddit-video] intro card upload failed, using local blob URL"
            );
            const fallbackUrl = URL.createObjectURL(file);
            return {
              id: crypto.randomUUID(),
              name: "Reddit intro card",
              kind: "image" as const,
              url: fallbackUrl,
              size: file.size,
              width: meta.width,
              height: meta.height,
              aspectRatio: meta.aspectRatio,
              createdAt: Date.now(),
            } satisfies MediaAsset;
          }
          return {
            id: libraryAsset.id,
            name: libraryAsset.name,
            kind: "image" as const,
            url: libraryAsset.url,
            size: libraryAsset.size,
            width: libraryAsset.width,
            height: libraryAsset.height,
            aspectRatio: libraryAsset.aspectRatio,
            createdAt: libraryAsset.createdAt,
          } satisfies MediaAsset;
        } finally {
          container.remove();
        }
      };

      setRedditVideoImportOverlayStage("voiceover");

      const introVoice = payload.audio?.introVoice?.trim() || null;
      const scriptVoice = payload.audio?.scriptVoice?.trim() || "";
      if (!scriptVoice) {
        throw new Error("Script voice is required.");
      }

      const introText =
        typeof payload.post?.title === "string" ? payload.post.title.trim() : "";
      const rawScriptText = payload.script.trim();
	      const stripIntroFromScript = (scriptValue: string, introValue: string) => {
	        const scriptTrimmed = scriptValue.trimStart();
	        const introTrimmed = introValue.trim();
	        if (!scriptTrimmed || !introTrimmed) {
	          return scriptValue.trim();
	        }

	        const introCandidates = Array.from(
	          new Set(
	            [
	              introTrimmed,
	              introTrimmed.replace(/^[\"'“”‘’]+|[\"'“”‘’]+$/g, "").trim(),
	              introTrimmed.replace(/[.?!]+$/g, "").trim(),
	              introTrimmed
	                .replace(/[.?!]+$/g, "")
	                .replace(/^[\"'“”‘’]+|[\"'“”‘’]+$/g, "")
	                .trim(),
	            ].filter((value) => value.length > 0)
	          )
	        );

	        const stripPrefixes = (value: string) => {
	          let next = value.trimStart();
	          next = next.replace(
	            /^(?:title|reddit title|post title|intro|hook)\s*[:\\-–—]+\\s*/i,
	            ""
	          );
	          next = next.replace(/^[\"'“”‘’]+/, "");
	          return next;
	        };

	        const candidate = stripPrefixes(scriptTrimmed);
	        const lowerCandidate = candidate.toLowerCase();

	        for (const introCandidate of introCandidates) {
	          const lowerIntro = introCandidate.toLowerCase();
	          if (!lowerCandidate.startsWith(lowerIntro)) {
	            continue;
	          }
	          const remainder = candidate
	            .slice(introCandidate.length)
	            .replace(/^[\"'“”‘’\\s:—–-]+/, "")
	            .trimStart();
	          return remainder.length > 0 ? remainder : scriptTrimmed;
	        }

	        return scriptTrimmed;
	      };
      const scriptText =
        introVoice && introText
          ? stripIntroFromScript(rawScriptText, introText)
          : rawScriptText;

      const [introAudioUrl, scriptAudioUrl] = await Promise.all([
        introVoice && introText ? generateVoiceoverUrl(introText, introVoice) : Promise.resolve(null),
        generateVoiceoverUrl(scriptText, scriptVoice),
      ]);

      const [introVoiceAsset, scriptVoiceAsset] = await Promise.all([
        introAudioUrl && introVoice
          ? createGeneratedVoiceAsset({
              url: introAudioUrl,
              script: introText,
              voice: introVoice,
            })
          : Promise.resolve(null),
        createGeneratedVoiceAsset({
          url: scriptAudioUrl,
          script: scriptText,
          voice: scriptVoice,
        }),
      ]);

      const introAudioDuration = introVoiceAsset
        ? Math.max(0.01, getAssetDurationSeconds(introVoiceAsset))
        : 0;
      const minIntroSeconds =
        typeof payload.timing?.introSeconds === "number" && Number.isFinite(payload.timing.introSeconds)
          ? Math.max(0, payload.timing.introSeconds)
          : 3;
      const showIntroCardRequested = Boolean(payload.post?.showIntroCard);
      let introCardAsset: MediaAsset | null = null;
      if (showIntroCardRequested) {
        try {
          introCardAsset = await createIntroCardAsset();
        } catch (error) {
          console.warn(
            "[reddit-video] intro card render failed, continuing without it",
            error
          );
          introCardAsset = null;
        }
      }
      const showIntroCard = Boolean(introCardAsset);
      const introOffsetSeconds = Math.max(
        showIntroCard ? minIntroSeconds : 0,
        introAudioDuration
      );
      const introCardDurationSeconds = showIntroCard
        ? Math.max(0.01, introOffsetSeconds)
        : 0;

      const resolveGameplayUrl = async (url: string) => {
        if (!url) {
          return url;
        }
        try {
          const parsed = new URL(url);
          const match = parsed.pathname.match(
            /\/storage\/v1\/object\/sign\/([^/]+)\/(.+)/
          );
          if (!match) {
            return url;
          }
          const bucket = decodeURIComponent(match[1] ?? "");
          const storagePath = decodeURIComponent(match[2] ?? "");
          if (!bucket || !storagePath) {
            return url;
          }
          if (bucket !== "gameplay-footage") {
            return url;
          }
          const response = await fetchWithTimeout(
            `/api/gameplay-footage/sign?path=${encodeURIComponent(storagePath)}`,
            { method: "GET" },
            REDDIT_IMAGE_FETCH_TIMEOUT_MS,
            "Refreshing gameplay URL"
          );
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            return url;
          }
          const resolvedUrl =
            typeof data?.url === "string"
              ? data.url
              : typeof data?.signedUrl === "string"
                ? data.signedUrl
                : "";
          return resolvedUrl || url;
        } catch {
          return url;
        }
      };

      const gameplayUrl = await resolveGameplayUrl(payload.gameplay.url);
      const gameplayMeta = await getMediaMeta("video", gameplayUrl);
      const gameplayWidth =
        typeof gameplayMeta.width === "number" && Number.isFinite(gameplayMeta.width)
          ? gameplayMeta.width
          : undefined;
      const gameplayHeight =
        typeof gameplayMeta.height === "number" && Number.isFinite(gameplayMeta.height)
          ? gameplayMeta.height
          : undefined;
      const gameplayDuration =
        typeof gameplayMeta.duration === "number" && Number.isFinite(gameplayMeta.duration)
          ? gameplayMeta.duration
          : undefined;
      const gameplayAspectRatio =
        gameplayWidth && gameplayHeight ? gameplayWidth / gameplayHeight : undefined;

      const gameplayLibraryAsset = await createExternalAssetSafe({
        url: gameplayUrl,
        name: payload.gameplay.name?.trim() || "Gameplay footage",
        kind: "video",
        source: "stock",
        duration: gameplayDuration,
        width: gameplayWidth,
        height: gameplayHeight,
        aspectRatio: gameplayAspectRatio,
      });

      const gameplayAsset: MediaAsset = {
        id: gameplayLibraryAsset?.id ?? crypto.randomUUID(),
        name: payload.gameplay.name?.trim() || "Gameplay footage",
        kind: "video",
        url: gameplayLibraryAsset?.url ?? gameplayUrl,
        size: 0,
        duration: gameplayDuration,
        width: gameplayWidth,
        height: gameplayHeight,
        aspectRatio: gameplayAspectRatio,
        createdAt: Date.now(),
      };

      const music = payload.audio?.backgroundMusic ?? null;
      const musicUrl = typeof music?.url === "string" ? music.url.trim() : "";
      const musicName = typeof music?.name === "string" ? music.name.trim() : "";
      const musicVolume =
        typeof music?.volume === "number" && Number.isFinite(music.volume)
          ? Math.min(100, Math.max(0, music.volume))
          : 25;

      const musicAsset = musicUrl
        ? await (async (): Promise<MediaAsset> => {
            const meta = await getMediaMeta("audio", musicUrl);
            const libraryAsset = await createExternalAssetSafe({
              url: musicUrl,
              name: musicName || "Background music",
              kind: "audio",
              source: "stock",
              duration: meta.duration,
            });
            return {
              id: libraryAsset?.id ?? crypto.randomUUID(),
              name: musicName || "Background music",
              kind: "audio",
              url: libraryAsset?.url ?? musicUrl,
              size: libraryAsset?.size ?? 0,
              duration: meta.duration,
              createdAt: Date.now(),
            };
          })()
        : null;

      // `introCardAsset`, `showIntroCard`, and `introCardDurationSeconds` already resolved above.

      const nextLanes: TimelineLane[] = [];
      const introCardLaneId = showIntroCard
        ? createLaneId("video", nextLanes, { placement: "top" })
        : null;
      const gameplayLaneId = createLaneId("video", nextLanes);

      const introVoiceLaneId = introVoiceAsset ? createLaneId("audio", nextLanes) : null;
      const scriptVoiceLaneId = createLaneId("audio", nextLanes);
      const musicLaneId = musicAsset ? createLaneId("audio", nextLanes) : null;

      const introCardClip: TimelineClip | null =
        introCardAsset && introCardLaneId
          ? {
              id: crypto.randomUUID(),
              assetId: introCardAsset.id,
              duration: Math.max(0.01, introCardDurationSeconds),
              startOffset: 0,
              startTime: 0,
              laneId: introCardLaneId,
            }
          : null;

      const introVoiceClip: TimelineClip | null =
        introVoiceAsset && introVoiceLaneId
          ? {
              id: crypto.randomUUID(),
              assetId: introVoiceAsset.id,
              duration: Math.max(0.01, getAssetDurationSeconds(introVoiceAsset)),
              startOffset: 0,
              startTime: 0,
              laneId: introVoiceLaneId,
            }
          : null;

      const scriptVoiceClip: TimelineClip = {
        id: crypto.randomUUID(),
        assetId: scriptVoiceAsset.id,
        duration: Math.max(0.01, getAssetDurationSeconds(scriptVoiceAsset)),
        startOffset: 0,
        startTime: introOffsetSeconds,
        laneId: scriptVoiceLaneId,
      };

      // Use the actual voiceover end as the authoritative timeline end.
      const timelineEndSeconds = Math.max(
        0.5,
        scriptVoiceClip.startTime + scriptVoiceClip.duration
      );

      const gameplayBaseDuration = Math.max(
        0.01,
        gameplayDuration ?? getAssetDurationSeconds(gameplayAsset) ?? timelineEndSeconds
      );
      const gameplayClips: TimelineClip[] = [];
      let cursor = 0;
      while (cursor < timelineEndSeconds - timelineClipEpsilon) {
        const remaining = timelineEndSeconds - cursor;
        const duration = Math.max(0.01, Math.min(gameplayBaseDuration, remaining));
        gameplayClips.push({
          id: crypto.randomUUID(),
          assetId: gameplayAsset.id,
          duration,
          startOffset: 0,
          startTime: cursor,
          laneId: gameplayLaneId,
        });
        cursor += duration;
        if (gameplayClips.length > 400) {
          break;
        }
      }

      const musicClips: TimelineClip[] = [];
      if (musicAsset && musicLaneId) {
        const base = Math.max(
          0.01,
          musicAsset.duration ?? getAssetDurationSeconds(musicAsset) ?? timelineEndSeconds
        );
        let musicCursor = 0;
        while (musicCursor < timelineEndSeconds - timelineClipEpsilon) {
          const remaining = timelineEndSeconds - musicCursor;
          const duration = Math.max(0.01, Math.min(base, remaining));
          musicClips.push({
            id: crypto.randomUUID(),
            assetId: musicAsset.id,
            duration,
            startOffset: 0,
            startTime: musicCursor,
            laneId: musicLaneId,
          });
          musicCursor += duration;
          if (musicClips.length > 500) {
            break;
          }
        }
      }

      const clampClipToTimelineEnd = (clip: TimelineClip): TimelineClip | null => {
        const remaining = timelineEndSeconds - clip.startTime;
        if (remaining <= timelineClipEpsilon) {
          return null;
        }
        if (clip.duration <= remaining + timelineClipEpsilon) {
          return clip;
        }
        return {
          ...clip,
          duration: Math.max(0.01, remaining),
        };
      };
      const normalizedGameplayClips = gameplayClips
        .map(clampClipToTimelineEnd)
        .filter((clip): clip is TimelineClip => clip !== null);
      const normalizedMusicClips = musicClips
        .map(clampClipToTimelineEnd)
        .filter((clip): clip is TimelineClip => clip !== null);

      const stageAspectRatio = 9 / 16;
      const gameplayTransform: ClipTransform = { x: 0, y: 0, width: 1, height: 1 };
      const introTransform: ClipTransform | null =
        introCardClip
          ? (() => {
              const base = createDefaultTransform(introCardAsset?.aspectRatio, stageAspectRatio);
              // Make the card much larger by default while keeping it anchored near the top.
              const targetWidth = 0.9;
              const scale = Math.max(
                0.05,
                targetWidth / Math.max(0.001, base.width)
              );
              let width = clamp(base.width * scale, 0.01, 1);
              let height = clamp(base.height * scale, 0.01, 1);
              const maxHeight = 0.34;
              if (height > maxHeight) {
                const shrink = maxHeight / height;
                width = clamp(width * shrink, 0.01, 1);
                height = maxHeight;
              }
              const x = clamp(0.5 - width / 2, 0, Math.max(0, 1 - width));
              const desiredTop = 0.09;
              const y = clamp(desiredTop, 0, Math.max(0, 1 - height));
              return { x, y, width, height };
            })()
          : null;

      setLanes(nextLanes);
      setAssets((prev) => {
        const next = [...prev];
        const addIfMissing = (asset: MediaAsset | null) => {
          if (!asset) {
            return;
          }
          if (next.some((existing) => existing.id === asset.id)) {
            return;
          }
          next.unshift(asset);
        };
        addIfMissing(musicAsset);
        addIfMissing(scriptVoiceAsset);
        addIfMissing(introVoiceAsset);
        addIfMissing(introCardAsset);
        addIfMissing(gameplayAsset);
        return next;
      });
      setTimeline([
        ...normalizedGameplayClips,
        ...(introCardClip ? [introCardClip] : []),
        ...(introVoiceClip ? [introVoiceClip] : []),
        scriptVoiceClip,
        ...normalizedMusicClips,
      ]);
      setClipTransforms(() => {
        const next: Record<string, ClipTransform> = {};
        normalizedGameplayClips.forEach((clip) => {
          next[clip.id] = gameplayTransform;
        });
        if (introCardClip && introTransform) {
          next[introCardClip.id] = introTransform;
        }
        return next;
      });
      clipTransformTouchedRef.current = new Set([
        ...normalizedGameplayClips.map((clip) => clip.id),
        ...(introCardClip ? [introCardClip.id] : []),
      ]);
      setBackgroundTransforms({});
      setClipSettings(() => {
        const next: Record<string, VideoClipSettings> = {};
        normalizedGameplayClips.forEach((clip) => {
          next[clip.id] = {
            ...createDefaultVideoSettings(),
            muted: true,
            volume: 0,
          };
        });
        if (introCardClip) {
          next[introCardClip.id] = createDefaultVideoSettings();
        }
        if (introVoiceClip) {
          next[introVoiceClip.id] = createDefaultVideoSettings();
        }
        next[scriptVoiceClip.id] = createDefaultVideoSettings();
        normalizedMusicClips.forEach((clip) => {
          next[clip.id] = {
            ...createDefaultVideoSettings(),
            volume: musicVolume,
          };
        });
        return next;
      });

	      setTextSettings({});
	      setSubtitleSegments([]);
	      subtitleLaneIdRef.current = null;
	      setDetachedSubtitleIds(new Set());
	      setSubtitleStatus("idle");
      setSubtitleError(null);
      setTranscriptSegments([]);
      setTranscriptStatus("idle");
      setTranscriptError(null);
      setTimelineThumbnails({});
      setAudioWaveforms({});
      setClipOrder({});
      setCurrentTime(0);

      setActiveAssetId(gameplayAsset.id);
      setActiveCanvasClipId(normalizedGameplayClips[0]?.id ?? null);
      setSelectedClipId(normalizedGameplayClips[0]?.id ?? null);
      setSelectedClipIds(
        normalizedGameplayClips[0]?.id ? [normalizedGameplayClips[0].id] : []
      );

      const desiredStyleId = payload.subtitles?.styleId;
      if (typeof desiredStyleId === "string" && desiredStyleId.trim().length > 0) {
        setSubtitleStyleId(desiredStyleId.trim());
      }
      setSubtitleSource(scriptVoiceClip.id);
      setTranscriptSource(scriptVoiceClip.id);

      if (typeof desiredStyleId === "string" && desiredStyleId.trim().length > 0) {
        pendingRedditVideoSubtitleRef.current = {
          sourceClipId: scriptVoiceClip.id,
          styleId: desiredStyleId.trim(),
        };
        setRedditVideoImportOverlayStage("subtitles");
      } else {
        setRedditVideoImportOverlayStage("finalizing");
        requestAnimationFrame(() => setRedditVideoImportOverlayOpen(false));
      }
    },
    [createLaneId, pushHistory]
  );

  const applySplitScreenImportRef = useRef(applySplitScreenImport);
  const applyStreamerVideoImportRef = useRef(applyStreamerVideoImport);
  const applyRedditVideoImportRef = useRef(applyRedditVideoImport);

  useEffect(() => {
    applySplitScreenImportRef.current = applySplitScreenImport;
  }, [applySplitScreenImport]);

  useEffect(() => {
    applyStreamerVideoImportRef.current = applyStreamerVideoImport;
  }, [applyStreamerVideoImport]);

  useEffect(() => {
    applyRedditVideoImportRef.current = applyRedditVideoImport;
  }, [applyRedditVideoImport]);

  const importQuery = searchParams.get("import");
  const importTs = searchParams.get("ts") ?? "";
  const importPayloadId =
    typeof searchParams.get("payloadId") === "string"
      ? searchParams.get("payloadId")?.trim() ?? ""
      : "";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const shouldAttemptImport = importQuery === "splitscreen";

    if (!shouldAttemptImport) {
      return;
    }

    setSubtitleStatus("idle");
    setSubtitleError(null);
    setSplitScreenImportOverlayStage("preparing");
    setSplitScreenImportOverlayOpen(true);
    splitImportLog("import effect start", {
      payloadId: importPayloadId,
      ts: importTs,
    });

    const clearImportQuery = () => {
      if (importQuery !== "splitscreen") {
        return;
      }
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("import");
        url.searchParams.delete("ts");
        url.searchParams.delete("payloadId");
        const query = url.searchParams.toString();
        const nextUrl = `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
        window.history.replaceState({}, "", nextUrl);
      } catch {
        // Ignore URL failures.
      }
    };

    if (!importPayloadId) {
      console.warn("[split-screen] import requested but payloadId missing");
      setSplitScreenImportOverlayOpen(false);
      clearImportQuery();
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        let payloadEnvelope: unknown = null;
        for (let attempt = 1; attempt <= IMPORT_PAYLOAD_FETCH_MAX_ATTEMPTS; attempt += 1) {
          splitImportLog("payload fetch attempt", {
            payloadId: importPayloadId,
            attempt,
            maxAttempts: IMPORT_PAYLOAD_FETCH_MAX_ATTEMPTS,
          });
          const response = await fetch(
            `/api/editor/import-payload?type=splitscreen&id=${encodeURIComponent(importPayloadId)}`,
            { cache: "no-store" }
          );
          const data = await response.json().catch(() => ({}));
          splitImportLog("payload fetch response", {
            payloadId: importPayloadId,
            attempt,
            status: response.status,
            ok: response.ok,
            error: typeof data?.error === "string" ? data.error : null,
          });
          if (response.ok) {
            payloadEnvelope = data?.payload ?? null;
            break;
          }
          const resolvedError =
            typeof data?.error === "string" && data.error
              ? data.error
              : "Split-screen payload could not be loaded.";
          if (
            response.status === 404 &&
            attempt < IMPORT_PAYLOAD_FETCH_MAX_ATTEMPTS
          ) {
            await delay(IMPORT_PAYLOAD_FETCH_RETRY_DELAY_MS * attempt);
            continue;
          }
          throw new Error(resolvedError);
        }
        if (!payloadEnvelope) {
          splitImportLog("payload fetch exhausted without envelope", {
            payloadId: importPayloadId,
          });
          throw new Error("Split-screen payload could not be loaded.");
        }
        const payload = parseSplitScreenImportPayload(
          JSON.stringify(payloadEnvelope)
        );
        if (!payload) {
          throw new Error("Split-screen payload is invalid.");
        }
        if (cancelled) {
          splitImportLog("import run cancelled before apply");
          return;
        }
        splitImportLog("applying payload", {
          payloadId: importPayloadId,
          layout: payload.layout,
          autoGenerateSubtitles: Boolean(payload.subtitles?.autoGenerate),
          subtitleStyleId: payload.subtitles?.styleId ?? null,
        });
        await withPromiseTimeout(
          applySplitScreenImportRef.current(payload),
          IMPORT_TIMEOUT_MS,
          "Split-screen import"
        );
        splitImportLog("apply promise resolved");
      } catch (error) {
        console.error("[split-screen] import failed", error);
        if (!cancelled) {
          setSubtitleStatus("error");
          setSubtitleError(
            error instanceof Error
              ? error.message
              : "Split-screen import failed."
          );
          setSplitScreenImportOverlayStage("finalizing");
          setSplitScreenImportOverlayOpen(true);
        }
      } finally {
        if (!cancelled) {
          clearImportQuery();
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    importPayloadId,
    importQuery,
    importTs,
  ]);

  useEffect(() => {
    splitImportLog("overlay state update", {
      open: splitScreenImportOverlayOpen,
      stage: splitScreenImportOverlayStage,
      subtitleStatus,
      subtitleError: subtitleError ?? null,
    });
  }, [
    splitScreenImportOverlayOpen,
    splitScreenImportOverlayStage,
    subtitleError,
    subtitleStatus,
  ]);

	  useEffect(() => {
	    if (!splitScreenImportOverlayOpen) {
	      return;
	    }
	    if (splitScreenImportOverlayStage !== "finalizing") {
	      return;
	    }
	    if (subtitleStatus === "loading" || subtitleStatus === "error") {
	      return;
	    }
	    splitImportLog("finalizing overlay auto-close armed", {
	      subtitleStatus,
	    });
	    const timeoutId = window.setTimeout(() => {
	      const currentStatus = subtitleStatusRef.current;
	      if (currentStatus === "loading" || currentStatus === "error") {
	        splitImportLog("finalizing overlay auto-close skipped", {
	          subtitleStatus: currentStatus,
	        });
	        return;
	      }
	      splitImportLog("finalizing overlay auto-close executed", {
	        subtitleStatus: currentStatus,
	      });
	      setSplitScreenImportOverlayOpen(false);
	    }, 180);
	    return () => {
	      window.clearTimeout(timeoutId);
	    };
	  }, [
	    splitScreenImportOverlayOpen,
	    splitScreenImportOverlayStage,
	    subtitleStatus,
	  ]);

	  useEffect(() => {
	    if (!splitScreenImportOverlayOpen) {
	      return;
	    }
	    if (subtitleStatus === "error") {
	      return;
	    }
	    if (
	      splitScreenImportOverlayStage === "finalizing" &&
	      subtitleStatus !== "loading"
	    ) {
	      splitImportLog("watchdog skipped", {
	        stage: splitScreenImportOverlayStage,
	        subtitleStatus,
	      });
	      return;
	    }
	    splitImportLog("watchdog armed", {
	      stage: splitScreenImportOverlayStage,
	      timeoutMs: IMPORT_PREPARING_WATCHDOG_MS,
    });
    const timeoutId = window.setTimeout(() => {
      splitImportLog("watchdog timeout reached", {
        stage: splitScreenImportOverlayStage,
        subtitleStatus,
      });
      setSubtitleStatus("error");
      setSubtitleError(
        "Split-screen import is taking longer than expected. Check [split-screen][editor] logs in the console."
      );
      setSplitScreenImportOverlayStage("finalizing");
    }, IMPORT_PREPARING_WATCHDOG_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    splitScreenImportOverlayOpen,
    splitScreenImportOverlayStage,
    subtitleStatus,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const shouldAttemptImport = importQuery === "streamer-video";

    if (!shouldAttemptImport) {
      return;
    }

    setStreamerVideoImportOverlayStage("preparing");
    setStreamerVideoImportOverlayOpen(true);

    const clearImportQuery = () => {
      if (importQuery !== "streamer-video") {
        return;
      }
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("import");
        url.searchParams.delete("ts");
        url.searchParams.delete("assetId");
        url.searchParams.delete("assetName");
        url.searchParams.delete("titleText");
        url.searchParams.delete("subtitleStyleId");
        url.searchParams.delete("autoSubtitles");
        const query = url.searchParams.toString();
        const nextUrl = `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
        window.history.replaceState({}, "", nextUrl);
      } catch {
        // Ignore URL failures.
      }
    };

    const assetId =
      typeof searchParams.get("assetId") === "string"
        ? searchParams.get("assetId")?.trim() ?? ""
        : "";
    const assetName =
      typeof searchParams.get("assetName") === "string"
        ? searchParams.get("assetName")?.trim() ?? ""
        : "";
    const titleText =
      typeof searchParams.get("titleText") === "string"
        ? searchParams.get("titleText")?.trim() ?? ""
        : "";
    const subtitleStyleIdRaw =
      typeof searchParams.get("subtitleStyleId") === "string"
        ? searchParams.get("subtitleStyleId")?.trim() ?? ""
        : "";
    const autoSubtitlesRaw =
      typeof searchParams.get("autoSubtitles") === "string"
        ? searchParams.get("autoSubtitles")?.trim().toLowerCase() ?? ""
        : "";
    const autoSubtitles = (() => {
      if (["0", "false", "no", "off"].includes(autoSubtitlesRaw)) {
        return false;
      }
      if (["1", "true", "yes", "on"].includes(autoSubtitlesRaw)) {
        return true;
      }
      return true;
    })();

    if (!assetId || !titleText) {
      console.warn("[streamer-video] import requested but params missing", {
        assetId: Boolean(assetId),
        titleText: Boolean(titleText),
      });
      setStreamerVideoImportOverlayOpen(false);
      clearImportQuery();
      return;
    }

    const payload: StreamerVideoImportPayloadV1 = {
      version: 1,
      mainVideo: {
        url: undefined,
        name: assetName || "Main video",
        assetId,
      },
      titleText,
      subtitles: {
        autoGenerate: autoSubtitles,
        styleId: subtitleStyleIdRaw ? subtitleStyleIdRaw : null,
      },
    };

    const run = async () => {
      try {
        console.info("[streamer-video] applying import", payload);
        await withPromiseTimeout(
          applyStreamerVideoImportRef.current(payload),
          IMPORT_TIMEOUT_MS,
          "Streamer video import"
        );
      } catch (error) {
        console.error("[streamer-video] import failed", error);
        setStreamerVideoImportOverlayOpen(false);
      } finally {
        clearImportQuery();
      }
    };

    void run();
  }, [importQuery, importTs, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const shouldAttemptImport = importQuery === "reddit-video";

    if (!shouldAttemptImport) {
      return;
    }

    setRedditVideoImportOverlayStage("preparing");
    setRedditVideoImportOverlayOpen(true);
    setRedditVideoImportError(null);

    const clearImportQuery = () => {
      if (importQuery !== "reddit-video") {
        return;
      }
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("import");
        url.searchParams.delete("ts");
        url.searchParams.delete("payloadId");
        const query = url.searchParams.toString();
        const nextUrl = `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
        window.history.replaceState({}, "", nextUrl);
      } catch {
        // Ignore URL failures.
      }
    };

    if (!importPayloadId) {
      console.warn("[reddit-video] import requested but payloadId missing");
      setRedditVideoImportOverlayOpen(false);
      clearImportQuery();
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        let payloadEnvelope: unknown = null;
        for (let attempt = 1; attempt <= IMPORT_PAYLOAD_FETCH_MAX_ATTEMPTS; attempt += 1) {
          const response = await fetch(
            `/api/editor/import-payload?type=reddit-video&id=${encodeURIComponent(importPayloadId)}`,
            { cache: "no-store" }
          );
          const data = await response.json().catch(() => ({}));
          if (response.ok) {
            payloadEnvelope = data?.payload ?? null;
            break;
          }
          const resolvedError =
            typeof data?.error === "string" && data.error
              ? data.error
              : "Reddit payload could not be loaded.";
          if (
            response.status === 404 &&
            attempt < IMPORT_PAYLOAD_FETCH_MAX_ATTEMPTS
          ) {
            await delay(IMPORT_PAYLOAD_FETCH_RETRY_DELAY_MS * attempt);
            continue;
          }
          throw new Error(resolvedError);
        }
        if (!payloadEnvelope) {
          throw new Error("Reddit payload could not be loaded.");
        }
        const payload = parseRedditVideoImportPayload(
          JSON.stringify(payloadEnvelope)
        );
        if (!payload) {
          throw new Error("Reddit payload is invalid.");
        }
        if (cancelled) {
          return;
        }
        console.info("[reddit-video] applying import", payload);
        await withPromiseTimeout(
          applyRedditVideoImportRef.current(payload),
          IMPORT_TIMEOUT_MS,
          "Reddit video import"
        );
      } catch (error) {
        console.error("[reddit-video] import failed", error);
        if (!cancelled) {
          setRedditVideoImportOverlayStage("finalizing");
          setRedditVideoImportError(
            error instanceof Error ? error.message : "Reddit video import failed."
          );
        }
      } finally {
        if (!cancelled) {
          clearImportQuery();
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [importPayloadId, importQuery, importTs]);

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

  const ensureStockAudioAsset = useCallback(
    async (payload: StockAudioDragPayload): Promise<MediaAsset> => {
      const existing = assetsRef.current.find(
        (asset) => asset.kind === "audio" && asset.url === payload.url
      );
      if (existing) {
        return existing;
      }
      let resolvedDuration =
        typeof payload.duration === "number" && Number.isFinite(payload.duration)
          ? payload.duration
          : undefined;
      if (resolvedDuration == null) {
        if (stockDurationCacheRef.current.has(payload.id)) {
          const cached = stockDurationCacheRef.current.get(payload.id);
          resolvedDuration = cached ?? undefined;
        } else {
          const meta = await getMediaMeta("audio", payload.url);
          resolvedDuration = meta.duration;
          stockDurationCacheRef.current.set(payload.id, meta.duration ?? null);
        }
      }
      const libraryAsset = await createExternalAssetSafe({
        url: payload.url,
        name: payload.name,
        kind: "audio",
        source: "stock",
        size: payload.size,
        duration: resolvedDuration ?? undefined,
      });
      const audioAsset: MediaAsset = {
        id: libraryAsset?.id ?? crypto.randomUUID(),
        name: payload.name,
        kind: "audio",
        url: libraryAsset?.url ?? payload.url,
        size: payload.size,
        duration: resolvedDuration ?? undefined,
        createdAt: Date.now(),
      };
      setAssets((prev) => [audioAsset, ...prev]);
      return audioAsset;
    },
    [setAssets]
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
      setIsBackgroundSelected(false);
      pushHistory();
      const audioAsset = await ensureStockAudioAsset(
        buildStockAudioPayload(track)
      );
      const nextLanes = [...lanesRef.current];
      const laneId = createLaneId("audio", nextLanes);
      const clip = createClip(audioAsset.id, laneId, 0, audioAsset);
      setLanes(nextLanes);
      setTimeline((prev) => [...prev, clip]);
      setActiveAssetId(audioAsset.id);
    },
    [addToTimeline, createClip, createLaneId, ensureStockAudioAsset, pushHistory]
  );

  const handleStockAudioDrop = async (
    payload: StockAudioDragPayload,
    target: "canvas" | "timeline",
    event?: DragEvent<HTMLDivElement>
  ) => {
    const existing = assetsRef.current.find(
      (asset) => asset.kind === "audio" && asset.url === payload.url
    );
    if (existing) {
      if (target === "timeline" && event) {
        addAssetToTimelineFromDrop(existing, event);
      } else {
        addToTimeline(existing.id);
      }
      return;
    }
    setIsBackgroundSelected(false);
    pushHistory();
    const audioAsset = await ensureStockAudioAsset(payload);
    if (target === "timeline" && event) {
      addAssetToTimelineFromDrop(audioAsset, event, { skipHistory: true });
      setActiveAssetId(audioAsset.id);
      return;
    }
    const nextLanes = [...lanesRef.current];
    const laneId = createLaneId("audio", nextLanes);
    const clip = createClip(audioAsset.id, laneId, 0, audioAsset);
    setLanes(nextLanes);
    setTimeline((prev) => [...prev, clip]);
    setActiveAssetId(audioAsset.id);
  };

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
    [addToTimeline, createClip, createGifMediaAsset, createLaneId, pushHistory]
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
    [addToTimeline, createClip, createLaneId, pushHistory]
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

  const handleAiVoiceoverVoicesRetry = useCallback(() => {
    setAiVoiceoverVoicesStatus("idle");
    setAiVoiceoverVoicesError(null);
    setAiVoiceoverVoices([]);
    setAiVoiceoverVoicesReloadKey((prev) => prev + 1);
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
      const currentTextSettings =
        textSettingsRef.current[clipId] ?? createDefaultTextSettings();
      const previewNextSettings = updater(currentTextSettings);
      const isSubtitleClip = subtitleSegments.some(
        (segment) => segment.clipId === clipId
      );
      if (
        isSubtitleClip &&
        typeof previewNextSettings.text === "string" &&
        previewNextSettings.text !== currentTextSettings.text
      ) {
        setSubtitleSegments((segments) =>
          segments.map((segment) =>
            segment.clipId === clipId
              ? { ...segment, text: previewNextSettings.text, words: undefined }
              : segment
          )
        );
      }
      setTextSettings((prev) => {
        const current = prev[clipId] ?? createDefaultTextSettings();
        const next = updater(current);
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
    const nextTimeline = timeline.filter(
      (clip) => !idsToRemove.includes(clip.id)
    );
    if (nextTimeline.length === timeline.length) {
      return;
    }
    setTimeline(nextTimeline);
    const nextSelected = nextTimeline[0] ?? null;
    setSelectedClipId(nextSelected?.id ?? null);
    setSelectedClipIds(nextSelected ? [nextSelected.id] : []);
    setActiveAssetId(nextSelected?.assetId ?? null);
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
  }, [pushHistory, selectedClipId, selectedClipIds, subtitleSegments, timeline]);

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
      deleteAssetByIdSafe(assetId).catch(() => {});
      if (asset.url.startsWith("blob:")) {
        URL.revokeObjectURL(asset.url);
      }
    },
    [
      activeAssetId,
      deleteAssetByIdSafe,
      projectBackgroundImage?.assetId,
      pushHistory,
      selectedClipId,
      selectedClipIds,
      subtitleSegments,
      timeline,
    ]
  );

  const createGeneratedImageAsset = useCallback(
    async (payload: {
      url: string;
      prompt: string;
      width?: number;
      height?: number;
    }): Promise<MediaAsset> => {
      const existing = assetsRef.current.find(
        (asset) => asset.kind === "image" && asset.url === payload.url
      );
      if (existing) {
        return existing;
      }
      const trimmedPrompt = payload.prompt.trim() || "AI Image";
      const shortPrompt =
        trimmedPrompt.length > 60
          ? `${trimmedPrompt.slice(0, 57)}...`
          : trimmedPrompt;
      const name = `AI Image - ${shortPrompt}`;
      const meta =
        Number.isFinite(payload.width) && Number.isFinite(payload.height)
          ? {
              width: payload.width,
              height: payload.height,
              aspectRatio:
                payload.width && payload.height
                  ? payload.width / payload.height
                  : undefined,
            }
          : await getMediaMeta("image", payload.url);
      const libraryAsset = await createExternalAssetSafe({
        url: payload.url,
        name,
        kind: "image",
        source: "generated",
        size: 0,
        width: meta.width,
        height: meta.height,
        aspectRatio: meta.aspectRatio,
      });
      return {
        id: libraryAsset?.id ?? crypto.randomUUID(),
        name,
        kind: "image",
        url: libraryAsset?.url ?? payload.url,
        size: libraryAsset?.size ?? 0,
        width: meta.width,
        height: meta.height,
        aspectRatio: meta.aspectRatio,
        createdAt: Date.now(),
      };
    },
    []
  );

  const handleAiImageImprovePrompt = useCallback(async () => {
    const trimmedPrompt = aiImagePrompt.trim();
    if (!trimmedPrompt) {
      setAiImageMagicError("Add a prompt to improve.");
      return;
    }
    setAiImageMagicError(null);
    setAiImageMagicLoading(true);
    try {
      const response = await fetch("/api/ai-image/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmedPrompt }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data?.error === "string" && data.error.length > 0
            ? data.error
            : "Prompt enhancement failed.";
        setAiImageMagicError(message);
        return;
      }
      if (typeof data?.prompt === "string") {
        setAiImagePrompt(data.prompt);
      }
    } catch (error) {
      setAiImageMagicError("Prompt enhancement failed.");
    } finally {
      setAiImageMagicLoading(false);
    }
  }, [aiImagePrompt]);

  const handleAiImageGenerate = useCallback(async () => {
    const trimmedPrompt = aiImagePrompt.trim();
    if (!trimmedPrompt) {
      setAiImageError("Enter a prompt to generate an image.");
      return;
    }
    const requestId = aiImageRequestIdRef.current + 1;
    aiImageRequestIdRef.current = requestId;
    setAiImageError(null);
    setAiImageMagicError(null);
    setAiImageStatus("loading");
    setAiImageSaving(false);
    try {
      const response = await fetch("/api/ai-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          aspectRatio: aiImageAspectRatio,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data?.error === "string" && data.error.length > 0
            ? data.error
            : "Image generation failed.";
        setAiImageStatus("error");
        setAiImageError(message);
        return;
      }
      const imageEntry = Array.isArray(data?.images)
        ? data.images[0]
        : data?.image ?? null;
      const imageUrl =
        typeof imageEntry?.url === "string" ? imageEntry.url : null;
      if (!imageUrl) {
        setAiImageStatus("error");
        setAiImageError("Image generation returned no image.");
        return;
      }
      if (aiImageRequestIdRef.current !== requestId) {
        return;
      }
      setAiImageStatus("ready");
      setAiImageLastPrompt(trimmedPrompt);
      setAiImageLastAspectRatio(aiImageAspectRatio);
      setAiImagePreview({
        url: imageUrl,
        name: "Generated image",
      });
      setAiImageSaving(true);
      const generatedAsset = await createGeneratedImageAsset({
        url: imageUrl,
        prompt: trimmedPrompt,
        width:
          typeof imageEntry?.width === "number" ? imageEntry.width : undefined,
        height:
          typeof imageEntry?.height === "number" ? imageEntry.height : undefined,
      });
      if (aiImageRequestIdRef.current !== requestId) {
        return;
      }
      setAiImageSaving(false);
      setAiImagePreview({
        url: generatedAsset.url,
        assetId: generatedAsset.id,
        name: generatedAsset.name,
        width: generatedAsset.width,
        height: generatedAsset.height,
        aspectRatio: generatedAsset.aspectRatio,
      });
      setAssets((prev) => {
        if (prev.some((asset) => asset.id === generatedAsset.id)) {
          return prev;
        }
        return [generatedAsset, ...prev];
      });
      setActiveAssetId(generatedAsset.id);
    } catch (error) {
      if (aiImageRequestIdRef.current !== requestId) {
        return;
      }
      setAiImageStatus("error");
      setAiImageError("Image generation failed.");
      setAiImageSaving(false);
    }
  }, [aiImageAspectRatio, aiImagePrompt, createGeneratedImageAsset]);

  const handleAiImageAddToTimeline = useCallback(() => {
    if (!aiImagePreview?.assetId) {
      return;
    }
    addToTimeline(aiImagePreview.assetId);
  }, [addToTimeline, aiImagePreview?.assetId]);

  const handleAiImageClear = useCallback(() => {
    if (aiImagePreview?.assetId) {
      handleDeleteAsset(aiImagePreview.assetId);
    }
    setAiImagePreview(null);
    setAiImageError(null);
    setAiImageMagicError(null);
    setAiImageMagicLoading(false);
    setAiImageStatus("idle");
    setAiImageSaving(false);
    setAiImageLastPrompt(null);
    setAiImageLastAspectRatio(null);
  }, [aiImagePreview?.assetId, handleDeleteAsset]);

  const createGeneratedVideoAsset = useCallback(
    async (payload: {
      url: string;
      prompt: string;
      duration: number;
      aspectRatio: string;
    }): Promise<MediaAsset> => {
      const trimmedPrompt = payload.prompt.trim() || "AI Video";
      const shortPrompt =
        trimmedPrompt.length > 60
          ? `${trimmedPrompt.slice(0, 57)}...`
          : trimmedPrompt;
      const name = `AI Video - ${shortPrompt}`;
      const meta = await getMediaMeta("video", payload.url);
      const resolvedDuration =
        Number.isFinite(meta.duration) && meta.duration ? meta.duration : payload.duration;
      const resolvedAspectRatio =
        meta.aspectRatio ?? parseAspectRatio(payload.aspectRatio);
      const libraryAsset = await createExternalAssetSafe({
        url: payload.url,
        name,
        kind: "video",
        source: "generated",
        duration: resolvedDuration,
        width: meta.width,
        height: meta.height,
        aspectRatio: resolvedAspectRatio,
      });
      if (!libraryAsset) {
        throw new Error("Unable to save generated video to Assets.");
      }
      return {
        id: libraryAsset.id,
        name: libraryAsset.name || name,
        kind: "video",
        url: libraryAsset.url,
        size: libraryAsset.size ?? 0,
        duration: libraryAsset.duration ?? resolvedDuration,
        width: libraryAsset.width ?? meta.width,
        height: libraryAsset.height ?? meta.height,
        aspectRatio: libraryAsset.aspectRatio ?? resolvedAspectRatio,
        createdAt: libraryAsset.createdAt ?? Date.now(),
      };
    },
    []
  );

  const createGeneratedVideoAudioAsset = useCallback(
    async (payload: {
      url: string;
      name: string;
      duration?: number;
    }): Promise<MediaAsset> => {
      const libraryAsset = await createExternalAssetSafe({
        url: payload.url,
        name: payload.name,
        kind: "audio",
        source: "generated",
        duration: payload.duration,
      });
      if (!libraryAsset) {
        throw new Error("Unable to save generated audio to Assets.");
      }
      return {
        id: libraryAsset.id,
        name: libraryAsset.name || payload.name,
        kind: "audio",
        url: libraryAsset.url,
        size: libraryAsset.size ?? 0,
        duration: libraryAsset.duration ?? payload.duration,
        createdAt: libraryAsset.createdAt ?? Date.now(),
      };
    },
    []
  );

  const handleAiVideoUploadImage = useCallback(
    async (
      file: File,
      _context: AiVideoUploadContext
    ): Promise<AiVideoUploadedImage> => {
      const mime = file.type.toLowerCase();
      const isImage = mime.startsWith("image/");
      const isVideo = mime.startsWith("video/");
      if (!isImage && !isVideo) {
        throw new Error("Upload an image or video file.");
      }

      let objectUrl: string | null = null;
      let meta: {
        width?: number;
        height?: number;
        duration?: number;
        aspectRatio?: number;
      } = {};

      try {
        objectUrl = URL.createObjectURL(file);
        meta = await getMediaMeta(isImage ? "image" : "video", objectUrl);
      } catch {
        meta = {};
      } finally {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      }

      const libraryAsset = await uploadAssetFileSafe(file, {
        name: file.name,
        kind: isImage ? "image" : "video",
        source: "upload",
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
        aspectRatio: meta.aspectRatio,
      });

      if (!libraryAsset) {
        throw new Error("Unable to upload file.");
      }

      const nextAsset: MediaAsset = {
        id: libraryAsset.id,
        name: libraryAsset.name || file.name || "Uploaded media",
        kind: isImage ? "image" : "video",
        url: libraryAsset.url,
        size: libraryAsset.size ?? file.size ?? 0,
        duration: libraryAsset.duration ?? meta.duration,
        width: libraryAsset.width ?? meta.width,
        height: libraryAsset.height ?? meta.height,
        aspectRatio: libraryAsset.aspectRatio ?? meta.aspectRatio,
        createdAt: libraryAsset.createdAt ?? Date.now(),
      };

      setAssets((prev) => {
        if (prev.some((asset) => asset.id === nextAsset.id)) {
          return prev;
        }
        return [nextAsset, ...prev];
      });
      setActiveAssetId(nextAsset.id);

      return {
        assetId: nextAsset.id,
        url: nextAsset.url,
        name: nextAsset.name,
        kind: isImage ? "image" : "video",
        width: nextAsset.width,
        height: nextAsset.height,
        aspectRatio: nextAsset.aspectRatio,
      };
    },
    []
  );

  const handleAiVideoImprovePrompt = useCallback(async () => {
    const trimmedPrompt = aiVideoPrompt.trim();
    if (!trimmedPrompt) {
      setAiVideoMagicError("Add a prompt to improve.");
      return;
    }
    setAiVideoMagicError(null);
    setAiVideoMagicLoading(true);
    try {
      const response = await fetch("/api/ai-video/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmedPrompt }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data?.error === "string" && data.error.length > 0
            ? data.error
            : "Prompt enhancement failed.";
        setAiVideoMagicError(message);
        return;
      }
      if (typeof data?.prompt === "string") {
        setAiVideoPrompt(data.prompt);
      }
    } catch (error) {
      setAiVideoMagicError("Prompt enhancement failed.");
    } finally {
      setAiVideoMagicLoading(false);
    }
  }, [aiVideoPrompt]);

  const handleAiVideoGenerate = useCallback(
    async (request?: AiVideoGenerateRequest) => {
      const trimmedPrompt = (request?.prompt ?? aiVideoPrompt).trim();
      const modelVariant =
        typeof request?.variantId === "string" && request.variantId.trim().length > 0
          ? request.variantId
          : "sora-2-text-to-video";
      const promptOptionalVariants = new Set([
        "kling-2-6-pro-motion-control",
      ]);
      const promptRequired = !promptOptionalVariants.has(modelVariant);
      if (promptRequired && !trimmedPrompt) {
        setAiVideoError("Enter a prompt to generate a video.");
        return;
      }

      const resolvedAspectRatio =
        typeof request?.aspectRatio === "string" &&
        request.aspectRatio.trim().length > 0
          ? request.aspectRatio
          : aiVideoAspectRatio === "9:16"
            ? "9:16"
            : "16:9";
      const resolvedDurationCandidate =
        typeof request?.duration === "number" &&
        Number.isFinite(request.duration) &&
        request.duration > 0
          ? request.duration
          : typeof aiVideoDuration === "number" &&
              Number.isFinite(aiVideoDuration) &&
              aiVideoDuration > 0
            ? aiVideoDuration
            : 8;
      const resolvedDuration = Math.max(1, Math.round(resolvedDurationCandidate));
      const resolvedGenerateAudio =
        typeof request?.generateAudio === "boolean"
          ? request.generateAudio
          : aiVideoGenerateAudio;
      const shouldSplitAudio = resolvedGenerateAudio && aiVideoSplitAudio;

      const resolution =
        typeof request?.resolution === "string" && request.resolution.trim().length > 0
          ? request.resolution
          : "720p";
      const frameImages = request?.frameImages ?? {};
      const ingredientImages = request?.ingredientImages ?? [];
      const referenceImage = frameImages.reference;
      const imageUrl =
        typeof referenceImage?.url === "string" && referenceImage.url.length > 0
          ? referenceImage.url
          : null;

      const requestId = aiVideoRequestIdRef.current + 1;
      aiVideoRequestIdRef.current = requestId;
      setAiVideoError(null);
      setAiVideoMagicError(null);
      setAiVideoStatus("loading");
      setAiVideoSaving(false);
      setAiVideoPreview(null);

      try {
        const response = await fetch("/api/ai-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: trimmedPrompt,
            aspectRatio: resolvedAspectRatio,
            duration: resolvedDuration,
            generateAudio: resolvedGenerateAudio,
            modelVariant,
            resolution,
            characterOrientation: request?.characterOrientation,
            ingredientsMode: request?.ingredientsMode ?? "frames",
            frameImages,
            ingredientImages: ingredientImages.map((item) => item.url),
            imageUrl,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            typeof data?.error === "string" && data.error.length > 0
              ? data.error
              : "Video generation failed.";
          setAiVideoStatus("error");
          setAiVideoError(message);
          return;
        }

        const videoEntry = data?.video ?? null;
        const videoUrl =
          typeof videoEntry?.url === "string"
            ? videoEntry.url
            : typeof data?.video_url === "string"
              ? data.video_url
              : typeof data?.videoUrl === "string"
                ? data.videoUrl
                : typeof data?.video === "string"
                  ? data.video
                  : null;
        if (!videoUrl) {
          setAiVideoStatus("error");
          setAiVideoError("Video generation returned no video.");
          return;
        }
        if (aiVideoRequestIdRef.current !== requestId) {
          return;
        }

        setAiVideoStatus("ready");
        setAiVideoLastPrompt(trimmedPrompt);
        setAiVideoLastAspectRatio(resolvedAspectRatio);
        setAiVideoLastDuration(resolvedDuration);
        setAiVideoLastGenerateAudio(resolvedGenerateAudio);
        setAiVideoPreview({
          url: videoUrl,
          name: "Generated video",
          duration: resolvedDuration,
          generateAudio: resolvedGenerateAudio,
          splitAudio: shouldSplitAudio,
        });

        setAiVideoSaving(true);

        const apiAsset =
          data?.asset && typeof data.asset === "object"
            ? (data.asset as AiVideoApiAsset)
            : null;

        const generatedAsset: MediaAsset =
          typeof apiAsset?.id === "string" &&
          typeof apiAsset?.url === "string" &&
          apiAsset.url.length > 0
            ? {
                id: apiAsset.id,
                name: apiAsset.name || "Generated video",
                kind: "video",
                url: apiAsset.url,
                size:
                  typeof apiAsset.size === "number" && Number.isFinite(apiAsset.size)
                    ? apiAsset.size
                    : 0,
                duration:
                  typeof apiAsset.duration === "number" &&
                  Number.isFinite(apiAsset.duration)
                    ? apiAsset.duration
                    : resolvedDuration,
                width:
                  typeof apiAsset.width === "number" && Number.isFinite(apiAsset.width)
                    ? apiAsset.width
                    : undefined,
                height:
                  typeof apiAsset.height === "number" &&
                  Number.isFinite(apiAsset.height)
                    ? apiAsset.height
                    : undefined,
                aspectRatio:
                  typeof apiAsset.aspectRatio === "number" &&
                  Number.isFinite(apiAsset.aspectRatio)
                    ? apiAsset.aspectRatio
                    : parseAspectRatio(resolvedAspectRatio),
                createdAt: Date.now(),
              }
            : await createGeneratedVideoAsset({
                url: videoUrl,
                prompt: trimmedPrompt,
                duration: resolvedDuration,
                aspectRatio: resolvedAspectRatio,
              });

        if (aiVideoRequestIdRef.current !== requestId) {
          return;
        }

        let audioAsset: MediaAsset | null = null;
        let audioClip: TimelineClip | null = null;
        let actualSplitAudio = false;
        if (shouldSplitAudio) {
          try {
            audioAsset = await createGeneratedVideoAudioAsset({
              url: generatedAsset.url,
              name: `${generatedAsset.name} (audio)`,
              duration: generatedAsset.duration,
            });
            actualSplitAudio = true;
          } catch {
            setAiVideoError(
              "Audio track couldn't be saved to Assets. The video was added without audio."
            );
          }
        }

        setAiVideoSaving(false);
        setAiVideoLastSplitAudio(actualSplitAudio);
        const nextLanes = [...lanesRef.current];
        const startTime = resolveSnappedStartTime(playbackTimeRef.current);
        const videoLaneId = createLaneId("video", nextLanes);
        const videoClip = createClip(
          generatedAsset.id,
          videoLaneId,
          startTime,
          generatedAsset
        );
        if (actualSplitAudio && audioAsset) {
          const audioLaneId = createLaneId("audio", nextLanes);
          audioClip = {
            id: crypto.randomUUID(),
            assetId: audioAsset.id,
            duration: videoClip.duration,
            startOffset: videoClip.startOffset,
            startTime: videoClip.startTime,
            laneId: audioLaneId,
          };
        }
        const nextPreview: AiVideoPreview = {
          url: generatedAsset.url,
          assetId: generatedAsset.id,
          audioAssetId: audioAsset?.id ?? null,
          name: generatedAsset.name,
          duration: generatedAsset.duration,
          width: generatedAsset.width,
          height: generatedAsset.height,
          aspectRatio: generatedAsset.aspectRatio,
          generateAudio: resolvedGenerateAudio,
          splitAudio: actualSplitAudio,
        };
        setAiVideoPreview(nextPreview);
        setIsBackgroundSelected(false);
        pushHistory();
        setLanes(nextLanes);
        setTimeline((prev) =>
          audioClip ? [...prev, videoClip, audioClip] : [...prev, videoClip]
        );
        if (actualSplitAudio) {
          setClipSettings((prev) => ({
            ...prev,
            [videoClip.id]: {
              ...createDefaultVideoSettings(),
              muted: true,
            },
          }));
        }
        setAssets((prev) => {
          const existing = new Set(prev.map((asset) => asset.id));
          const additions: MediaAsset[] = [];
          if (!existing.has(generatedAsset.id)) {
            additions.push(generatedAsset);
          }
          if (audioAsset && !existing.has(audioAsset.id)) {
            additions.push(audioAsset);
          }
          return additions.length > 0 ? [...additions, ...prev] : prev;
        });
        setActiveAssetId(generatedAsset.id);
      } catch (error) {
        if (aiVideoRequestIdRef.current !== requestId) {
          return;
        }
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Video generation failed.";
        setAiVideoStatus("error");
        setAiVideoError(message);
        setAiVideoPreview(null);
        setAiVideoSaving(false);
      }
    },
    [
      aiVideoAspectRatio,
      aiVideoDuration,
      aiVideoGenerateAudio,
      aiVideoPrompt,
      aiVideoSplitAudio,
      createClip,
      createGeneratedVideoAudioAsset,
      createGeneratedVideoAsset,
      createLaneId,
      pushHistory,
    ]
  );

  const handleAiVideoClear = useCallback(() => {
    const idsToDelete = [aiVideoPreview?.assetId, aiVideoPreview?.audioAssetId].filter(
      (id): id is string => typeof id === "string"
    );
    if (idsToDelete.length > 0) {
      pushHistory();
      pruneAssetsById(idsToDelete);
      idsToDelete.forEach((id) => {
        deleteAssetByIdSafe(id).catch(() => {});
        const asset = assetsRef.current.find((item) => item.id === id);
        if (asset?.url.startsWith("blob:")) {
          URL.revokeObjectURL(asset.url);
        }
      });
    }
    setAiVideoPreview(null);
    setAiVideoError(null);
    setAiVideoMagicError(null);
    setAiVideoMagicLoading(false);
    setAiVideoStatus("idle");
    setAiVideoSaving(false);
    setAiVideoLastPrompt(null);
    setAiVideoLastAspectRatio(null);
    setAiVideoLastDuration(null);
    setAiVideoLastGenerateAudio(null);
    setAiVideoLastSplitAudio(null);
  }, [
    aiVideoPreview?.assetId,
    aiVideoPreview?.audioAssetId,
    deleteAssetByIdSafe,
    pruneAssetsById,
    pushHistory,
  ]);

  const createBackgroundRemovedAsset = useCallback(
    async (payload: {
      url: string;
      sourceName?: string;
      durationHint?: number;
      aspectRatioHint?: number;
    }): Promise<MediaAsset> => {
      const existing = assetsRef.current.find(
        (asset) => asset.kind === "video" && asset.url === payload.url
      );
      if (existing) {
        return existing;
      }
      const baseName = payload.sourceName?.trim() || "Clip";
      const name = `Background Removed - ${baseName}`;
      const meta = await getMediaMeta("video", payload.url);
      const resolvedDuration =
        Number.isFinite(meta.duration) && meta.duration
          ? meta.duration
          : payload.durationHint;
      const resolvedAspectRatio = meta.aspectRatio ?? payload.aspectRatioHint;
      const libraryAsset = await createExternalAssetSafe({
        url: payload.url,
        name,
        kind: "video",
        source: "generated",
        duration: resolvedDuration,
        width: meta.width,
        height: meta.height,
        aspectRatio: resolvedAspectRatio,
      });
      return {
        id: libraryAsset?.id ?? crypto.randomUUID(),
        name: libraryAsset?.name || name,
        kind: "video",
        url: libraryAsset?.url ?? payload.url,
        size: libraryAsset?.size ?? 0,
        duration: libraryAsset?.duration ?? resolvedDuration,
        width: libraryAsset?.width ?? meta.width,
        height: libraryAsset?.height ?? meta.height,
        aspectRatio: libraryAsset?.aspectRatio ?? resolvedAspectRatio,
        createdAt: libraryAsset?.createdAt ?? Date.now(),
      };
    },
    []
  );

  const handleAiBackgroundRemoval = useCallback(async () => {
    if (aiBackgroundRemovalSelection.state === "empty") {
      setAiBackgroundRemovalError("Select a clip.");
      return;
    }
    if (aiBackgroundRemovalSelection.state === "multi") {
      setAiBackgroundRemovalError("Select one clip.");
      return;
    }
    if (aiBackgroundRemovalSelection.state !== "ready") {
      setAiBackgroundRemovalError("Select a video clip.");
      return;
    }

    const entry = aiBackgroundRemovalSelection.entry;
    const sourceUrl =
      typeof entry.asset.url === "string" ? entry.asset.url.trim() : "";
    if (!sourceUrl) {
      setAiBackgroundRemovalError("Selected clip has no source URL.");
      return;
    }

    const requestId = aiBackgroundRemovalRequestIdRef.current + 1;
    aiBackgroundRemovalRequestIdRef.current = requestId;
    setAiBackgroundRemovalError(null);
    setAiBackgroundRemovalStatus("loading");
    try {
      const response = await fetch("/api/ai-background-removal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: sourceUrl,
          subjectIsPerson: aiBackgroundRemovalSubjectIsPerson,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data?.error === "string" && data.error.length > 0
            ? data.error
            : "Background removal failed.";
        setAiBackgroundRemovalStatus("error");
        setAiBackgroundRemovalError(message);
        return;
      }
      const videoEntry = data?.video ?? data?.output?.video ?? null;
      const videoArray = Array.isArray(videoEntry) ? videoEntry : null;
      const outputUrl =
        typeof videoEntry?.url === "string"
          ? videoEntry.url
          : typeof videoArray?.[0]?.url === "string"
            ? videoArray[0].url
          : typeof data?.video_url === "string"
            ? data.video_url
            : typeof data?.videoUrl === "string"
              ? data.videoUrl
              : typeof data?.video === "string"
                ? data.video
                : null;
      if (!outputUrl) {
        setAiBackgroundRemovalStatus("error");
        setAiBackgroundRemovalError("Background removal returned no video.");
        return;
      }
      if (aiBackgroundRemovalRequestIdRef.current !== requestId) {
        return;
      }
      const generatedAsset = await createBackgroundRemovedAsset({
        url: outputUrl,
        sourceName: entry.asset.name,
        durationHint: entry.asset.duration ?? entry.clip.duration,
        aspectRatioHint: entry.asset.aspectRatio,
      });
      if (aiBackgroundRemovalRequestIdRef.current !== requestId) {
        return;
      }
      const nextLanes = [...lanesRef.current];
      const laneId = createLaneId("video", nextLanes, { placement: "top" });
      const newClip: TimelineClip = {
        id: crypto.randomUUID(),
        assetId: generatedAsset.id,
        duration: entry.clip.duration,
        startOffset: entry.clip.startOffset,
        startTime: entry.clip.startTime,
        laneId,
      };
      const sourceSettings = clipSettingsRef.current[entry.clip.id];
      const sourceTransform = clipTransforms[entry.clip.id];
      setAiBackgroundRemovalPreview({
        url: generatedAsset.url,
        assetId: generatedAsset.id,
        clipId: newClip.id,
        sourceClipId: entry.clip.id,
        name: generatedAsset.name,
        duration: generatedAsset.duration,
        width: generatedAsset.width,
        height: generatedAsset.height,
        aspectRatio: generatedAsset.aspectRatio,
      });
      setAiBackgroundRemovalStatus("ready");
      setIsBackgroundSelected(false);
      pushHistory();
      setLanes(nextLanes);
      setTimeline((prev) => [...prev, newClip]);
      if (sourceSettings) {
        setClipSettings((prev) => ({
          ...prev,
          [newClip.id]: cloneVideoSettings(sourceSettings),
        }));
      }
      if (sourceTransform) {
        setClipTransforms((prev) => ({
          ...prev,
          [newClip.id]: { ...sourceTransform },
        }));
      }
      setAssets((prev) => {
        if (prev.some((asset) => asset.id === generatedAsset.id)) {
          return prev;
        }
        return [generatedAsset, ...prev];
      });
      setSelectedClipIds([newClip.id]);
      setSelectedClipId(newClip.id);
      setActiveCanvasClipId(newClip.id);
      setActiveAssetId(generatedAsset.id);
    } catch (error) {
      if (aiBackgroundRemovalRequestIdRef.current !== requestId) {
        return;
      }
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Background removal failed.";
      setAiBackgroundRemovalStatus("error");
      setAiBackgroundRemovalError(message);
    }
  }, [
    aiBackgroundRemovalSelection,
    aiBackgroundRemovalSubjectIsPerson,
    clipTransforms,
    createBackgroundRemovedAsset,
    createLaneId,
    pushHistory,
  ]);

  const createGeneratedVoiceoverAsset = useCallback(
    async (payload: {
      url: string;
      script: string;
      voice: string;
    }): Promise<MediaAsset> => {
      const existing = assetsRef.current.find(
        (asset) => asset.kind === "audio" && asset.url === payload.url
      );
      if (existing) {
        return existing;
      }
      const trimmedScript = payload.script.trim() || "Voiceover";
      const shortScript =
        trimmedScript.length > 60
          ? `${trimmedScript.slice(0, 57)}...`
          : trimmedScript;
      const voiceLabel = payload.voice.trim() || "AI";
      const name = `Voiceover - ${voiceLabel} - ${shortScript}`;
      const meta = await getMediaMeta("audio", payload.url);
      const libraryAsset = await createExternalAssetSafe({
        url: payload.url,
        name,
        kind: "audio",
        source: "generated",
        duration: meta.duration,
      });
      return {
        id: libraryAsset?.id ?? crypto.randomUUID(),
        name,
        kind: "audio",
        url: libraryAsset?.url ?? payload.url,
        size: libraryAsset?.size ?? 0,
        duration: meta.duration,
        createdAt: Date.now(),
      };
    },
    []
  );

  const handleAiVoiceoverGenerate = useCallback(async () => {
    const trimmedScript = aiVoiceoverScript.trim();
    if (!trimmedScript) {
      setAiVoiceoverError("Enter a script to generate a voiceover.");
      return;
    }
    const resolvedVoice =
      aiVoiceoverSelectedVoice?.trim() ||
      aiVoiceoverVoices[0]?.voice?.trim() ||
      "";
    if (!resolvedVoice) {
      setAiVoiceoverError("Select a voice to continue.");
      return;
    }
    const requestId = aiVoiceoverRequestIdRef.current + 1;
    aiVoiceoverRequestIdRef.current = requestId;
    setAiVoiceoverError(null);
    setAiVoiceoverStatus("loading");
    setAiVoiceoverSaving(false);
    setAiVoiceoverPreview(null);
    try {
      const response = await fetch("/api/ai-voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmedScript,
          voice: resolvedVoice,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message =
          typeof data?.error === "string" && data.error.length > 0
            ? data.error
            : "Voiceover generation failed.";
        setAiVoiceoverStatus("error");
        setAiVoiceoverError(message);
        return;
      }
      const audioEntry = data?.audio ?? null;
      const audioUrl =
        typeof audioEntry?.url === "string"
          ? audioEntry.url
          : typeof data?.audio_url === "string"
            ? data.audio_url
            : typeof data?.audioUrl === "string"
              ? data.audioUrl
              : typeof data?.audio === "string"
                ? data.audio
                : null;
      if (!audioUrl) {
        setAiVoiceoverStatus("error");
        setAiVoiceoverError("Voiceover generation returned no audio.");
        return;
      }
      if (aiVoiceoverRequestIdRef.current !== requestId) {
        return;
      }
      setAiVoiceoverStatus("ready");
      setAiVoiceoverLastScript(trimmedScript);
      setAiVoiceoverLastVoice(resolvedVoice);
      setAiVoiceoverPreview({
        url: audioUrl,
        name: "Generated voiceover",
        voice: resolvedVoice,
      });
      setAiVoiceoverSaving(true);
      const generatedAsset = await createGeneratedVoiceoverAsset({
        url: audioUrl,
        script: trimmedScript,
        voice: resolvedVoice,
      });
      if (aiVoiceoverRequestIdRef.current !== requestId) {
        return;
      }
      setAiVoiceoverSaving(false);
      setAiVoiceoverPreview({
        url: generatedAsset.url,
        assetId: generatedAsset.id,
        name: generatedAsset.name,
        duration: generatedAsset.duration,
        voice: resolvedVoice,
      });
      setAssets((prev) => {
        if (prev.some((asset) => asset.id === generatedAsset.id)) {
          return prev;
        }
        return [generatedAsset, ...prev];
      });
      setActiveAssetId(generatedAsset.id);
    } catch (error) {
      if (aiVoiceoverRequestIdRef.current !== requestId) {
        return;
      }
      setAiVoiceoverStatus("error");
      setAiVoiceoverError("Voiceover generation failed.");
      setAiVoiceoverSaving(false);
    }
  }, [
    aiVoiceoverScript,
    aiVoiceoverSelectedVoice,
    aiVoiceoverVoices,
    createGeneratedVoiceoverAsset,
  ]);

  const handleAiVoiceoverAddToTimeline = useCallback(() => {
    if (!aiVoiceoverPreview?.assetId) {
      return;
    }
    addToTimeline(aiVoiceoverPreview.assetId);
  }, [addToTimeline, aiVoiceoverPreview?.assetId]);

  const handleAiVoiceoverClear = useCallback(() => {
    if (aiVoiceoverPreview?.assetId) {
      handleDeleteAsset(aiVoiceoverPreview.assetId);
    }
    setAiVoiceoverPreview(null);
    setAiVoiceoverError(null);
    setAiVoiceoverStatus("idle");
    setAiVoiceoverSaving(false);
    setAiVoiceoverLastScript(null);
    setAiVoiceoverLastVoice(null);
  }, [aiVoiceoverPreview?.assetId, handleDeleteAsset]);

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
  }, [
    createLaneId,
    pushHistory,
    selectedVideoEntry,
    timelineLayout,
    updateClipSettings,
  ]);

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
        const previewUrl = URL.createObjectURL(file);
        const meta = await getMediaMeta("video", previewUrl);
        URL.revokeObjectURL(previewUrl);
        const resolvedAspectRatio =
          meta.aspectRatio ??
          (meta.width && meta.height ? meta.width / meta.height : undefined);
        const stored = await uploadAssetFileSafe(file, {
          name: file.name || "Replacement video",
          kind: "video",
          source: "upload",
          duration: meta.duration,
          width: meta.width,
          height: meta.height,
          aspectRatio: resolvedAspectRatio,
        });
        if (!stored) {
          console.error("[assets] replace video upload failed");
          return;
        }
        const newAsset: MediaAsset = {
          id: stored.id,
          name: stored.name,
          kind: "video",
          url: stored.url,
          size: stored.size,
          duration: stored.duration,
          width: stored.width,
          height: stored.height,
          aspectRatio: stored.aspectRatio,
          createdAt: stored.createdAt,
        };
        setAssets((prev) => [newAsset, ...prev]);
        const playbackRate = getClipPlaybackRate(selectedVideoEntry.clip.id);
        const maxDuration = getAssetDurationSeconds(newAsset) / playbackRate;
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
      const kind = inferMediaKind(file);
      const assetKind: "video" | "audio" | "image" =
        kind === "text" ? "video" : kind;
      const previewUrl = URL.createObjectURL(file);
      const meta = await getMediaMeta(assetKind, previewUrl);
      URL.revokeObjectURL(previewUrl);
      const resolvedAspectRatio =
        meta.aspectRatio ??
        (meta.width && meta.height ? meta.width / meta.height : undefined);
      const stored = await uploadAssetFileSafe(file, {
        name: file.name || "Replacement asset",
        kind: assetKind,
        source: "upload",
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
        aspectRatio: resolvedAspectRatio,
      });
      if (!stored) {
        console.error("[assets] replace asset upload failed");
        return;
      }
      const newAsset: MediaAsset = {
        id: stored.id,
        name: stored.name,
        kind: assetKind,
        url: stored.url,
        size: stored.size,
        duration: stored.duration,
        width: stored.width,
        height: stored.height,
        aspectRatio: stored.aspectRatio,
        createdAt: stored.createdAt,
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
    const setSnapGuide = (nextGuide: number | null) => {
      if (timelineSnapGuideRef.current === nextGuide) {
        return;
      }
      timelineSnapGuideRef.current = nextGuide;
      setTimelineSnapGuide(nextGuide);
    };
    const handleMove = (event: MouseEvent) => {
      const activeTrimState = trimStateRef.current;
      if (!activeTrimState) {
        return;
      }
      if (!trimHistoryRef.current) {
        pushHistory();
        trimHistoryRef.current = true;
      }
      const timelineItems = timelineRef.current;
      const clip = timelineItems.find((item) => item.id === activeTrimState.clipId);
      if (!clip) {
        return;
      }
      const currentTimelineScale = Math.max(timelineScaleRef.current, 0.0001);
      const deltaSeconds =
        (event.clientX - activeTrimState.startX) / currentTimelineScale;
      const snapThresholdSeconds = snapThresholdPx / currentTimelineScale;
      const frameThresholdSeconds = frameStepSeconds;
      const candidateEdges: number[] = [0, timelineDurationRef.current];
      timelineItems.forEach((timelineClip) => {
        if (timelineClip.id === activeTrimState.clipId) {
          return;
        }
        candidateEdges.push(
          timelineClip.startTime,
          timelineClip.startTime + timelineClip.duration
        );
      });
      const asset = assetsRef.current.find(
        (item) => item.id === clip.assetId
      );
      const assetDuration = getAssetMaxDurationSeconds(asset);
      const playbackRate = getClipPlaybackRate(clip.id);
      let nextClip: Partial<TimelineClip> | null = null;
      let snapGuide: number | null = null;
      if (activeTrimState.edge === "end") {
        const maxDuration =
          (assetDuration - activeTrimState.startOffset) / playbackRate;
        const rawDuration = clamp(
          activeTrimState.startDuration + deltaSeconds,
          minClipDuration,
          maxDuration
        );
        let targetEdge = activeTrimState.startTime + rawDuration;
        if (!event.altKey && isTimelineSnappingEnabledRef.current) {
          targetEdge = Math.round(targetEdge / snapInterval) * snapInterval;
          let bestDistance = snapThresholdSeconds + 1;
          let bestEdge: number | null = null;
          candidateEdges.forEach((edge) => {
            const distance = Math.abs(
              activeTrimState.startTime + rawDuration - edge
            );
            if (distance < bestDistance) {
              bestDistance = distance;
              bestEdge = edge;
            }
          });
          if (bestEdge !== null && bestDistance <= snapThresholdSeconds) {
            targetEdge = bestEdge;
            snapGuide = bestEdge;
          } else {
            let frameDistance = frameThresholdSeconds + 1;
            let frameEdge: number | null = null;
            candidateEdges.forEach((edge) => {
              const distance = Math.abs(
                activeTrimState.startTime + rawDuration - edge
              );
              if (distance < frameDistance) {
                frameDistance = distance;
                frameEdge = edge;
              }
            });
            if (frameEdge !== null && frameDistance <= frameThresholdSeconds) {
              targetEdge = frameEdge;
              snapGuide = frameEdge;
            }
          }
        }
        const clampedEdge = clamp(
          targetEdge,
          activeTrimState.startTime + minClipDuration,
          activeTrimState.startTime + maxDuration
        );
        const nextDuration = clamp(
          clampedEdge - activeTrimState.startTime,
          minClipDuration,
          maxDuration
        );
        nextClip = { duration: nextDuration };
      } else {
        const nextStartTime = clamp(
          activeTrimState.startTime + deltaSeconds,
          0,
          activeTrimState.startTime +
            activeTrimState.startDuration -
            minClipDuration
        );
        let snappedStartTime = nextStartTime;
        if (!event.altKey && isTimelineSnappingEnabledRef.current) {
          snappedStartTime =
            Math.round(nextStartTime / snapInterval) * snapInterval;
          let bestDistance = snapThresholdSeconds + 1;
          let bestEdge: number | null = null;
          candidateEdges.forEach((edge) => {
            const distance = Math.abs(nextStartTime - edge);
            if (distance < bestDistance) {
              bestDistance = distance;
              bestEdge = edge;
            }
          });
          if (bestEdge !== null && bestDistance <= snapThresholdSeconds) {
            snappedStartTime = bestEdge;
            snapGuide = bestEdge;
          } else {
            let frameDistance = frameThresholdSeconds + 1;
            let frameEdge: number | null = null;
            candidateEdges.forEach((edge) => {
              const distance = Math.abs(nextStartTime - edge);
              if (distance < frameDistance) {
                frameDistance = distance;
                frameEdge = edge;
              }
            });
            if (frameEdge !== null && frameDistance <= frameThresholdSeconds) {
              snappedStartTime = frameEdge;
              snapGuide = frameEdge;
            }
          }
        }
        snappedStartTime = clamp(
          snappedStartTime,
          0,
          activeTrimState.startTime +
            activeTrimState.startDuration -
            minClipDuration
        );
        const appliedDelta = snappedStartTime - activeTrimState.startTime;
        const maxStartOffset = Math.max(
          0,
          assetDuration - minClipDuration * playbackRate
        );
        const nextStartOffset = clamp(
          activeTrimState.startOffset + appliedDelta * playbackRate,
          0,
          maxStartOffset
        );
        const maxDuration =
          (assetDuration - nextStartOffset) / playbackRate;
        const nextDuration = clamp(
          activeTrimState.startDuration - appliedDelta,
          minClipDuration,
          maxDuration
        );
        nextClip = {
          startTime: snappedStartTime,
          startOffset: nextStartOffset,
          duration: nextDuration,
        };
      }
      setSnapGuide(snapGuide);
      if (nextClip) {
        setTimeline((prev) =>
          prev.map((entry) =>
            entry.id === activeTrimState.clipId ? { ...entry, ...nextClip } : entry
          )
        );
      }
    };
    const handleUp = () => {
      setTrimState(null);
      trimHistoryRef.current = false;
      setSnapGuide(null);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [
    getClipPlaybackRate,
    pushHistory,
    trimState,
  ]);

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

  const isRangeSelecting = rangeSelection !== null;

  useEffect(() => {
    if (!isRangeSelecting) {
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
      const currentSelection = rangeSelectionRef.current;
      if (!currentSelection) {
        setRangeSelection(null);
        return;
      }
      const deltaX = Math.abs(currentSelection.currentX - currentSelection.startX);
      const deltaY = Math.abs(currentSelection.currentY - currentSelection.startY);
      if (deltaX < 4 && deltaY < 4) {
        if (isPlaying) {
          handleTogglePlayback();
        }
        handleScrubTo(currentSelection.currentX);
        setRangeSelection(null);
        return;
      }
      const nextIds = getSelectionIds(currentSelection);
      setSelectedClipIds(nextIds);
      setSelectedClipId(nextIds[0] ?? null);
      const nextEntry = timelineLayout.find(
        (entry) => entry.clip.id === nextIds[0]
      );
      setActiveAssetId(nextEntry?.asset.id ?? null);
      setRangeSelection(null);
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
    isRangeSelecting,
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

  const isStageSelecting = stageSelection !== null;

  useEffect(() => {
    if (!isStageSelecting) {
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
      const currentSelection = stageSelectionRef.current;
      if (!currentSelection) {
        setStageSelection(null);
        return;
      }
      const deltaX = Math.abs(currentSelection.currentX - currentSelection.startX);
      const deltaY = Math.abs(currentSelection.currentY - currentSelection.startY);
      if (deltaX < 4 && deltaY < 4) {
        if (!currentSelection.additive) {
          setSelectedClipIds([]);
          setSelectedClipId(null);
          setActiveCanvasClipId(null);
          setActiveAssetId(null);
          setIsBackgroundSelected(true);
        }
        setStageSelection(null);
        return;
      }
      const nextIds = getStageSelectionIds(currentSelection);
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
      setStageSelection(null);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [isStageSelecting, getStageSelectionIds, visualStack]);

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
    let frameId: number | null = null;
    let queuedEvent: MouseEvent | null = null;
    const commitDragState = (nextState: ClipDragState) => {
      dragClipStateRef.current = nextState;
      setDragClipState((prev) => {
        if (!prev) {
          return prev;
        }
        const samePreviewTime =
          prev.previewTime === nextState.previewTime ||
          (prev.previewTime !== undefined &&
            nextState.previewTime !== undefined &&
            Math.abs(prev.previewTime - nextState.previewTime) <
              timelineClipEpsilon);
        const samePendingLaneInsert =
          prev.pendingLaneInsert?.type === nextState.pendingLaneInsert?.type &&
          prev.pendingLaneInsert?.index === nextState.pendingLaneInsert?.index;
        if (
          prev.clipId === nextState.clipId &&
          prev.targetLaneId === nextState.targetLaneId &&
          prev.previewLaneId === nextState.previewLaneId &&
          samePreviewTime &&
          samePendingLaneInsert
        ) {
          return prev;
        }
        return nextState;
      });
    };
    const updateSnapGuide = (nextGuide: number | null) => {
      if (timelineSnapGuideRef.current === nextGuide) {
        return;
      }
      timelineSnapGuideRef.current = nextGuide;
      setTimelineSnapGuide(nextGuide);
    };
    const updateCollisionGuide = (nextGuide: number | null) => {
      if (timelineCollisionGuideRef.current === nextGuide) {
        return;
      }
      timelineCollisionGuideRef.current = nextGuide;
      setTimelineCollisionGuide(nextGuide);
    };
    const updateCollisionActive = (nextActive: boolean) => {
      if (timelineCollisionActiveRef.current === nextActive) {
        return;
      }
      timelineCollisionActiveRef.current = nextActive;
      setTimelineCollisionActive(nextActive);
    };
    const processMove = (event: MouseEvent) => {
      const activeDragState = dragClipStateRef.current;
      if (!activeDragState) {
        return;
      }
      let resolvedDragState = activeDragState;
      if (
        !resolvedDragState.group &&
        resolvedDragState.pendingGroupClipIds &&
        resolvedDragState.pendingGroupClipIds.length > 1
      ) {
        const computedGroup = buildDragGroup(resolvedDragState.pendingGroupClipIds);
        resolvedDragState = {
          ...resolvedDragState,
          group: computedGroup,
          pendingGroupClipIds: undefined,
        };
        commitDragState(resolvedDragState);
      }
      const timelineItems = timelineRef.current;
      const dragged = timelineItems.find(
        (clip) => clip.id === resolvedDragState.clipId
      );
      if (!dragged) {
        return;
      }
      const dragGroup = resolvedDragState.group;
      const dragGroupIds = dragGroup
        ? new Set(dragGroup.clips.map((entry) => entry.id))
        : null;
      if (!dragClipHistoryRef.current) {
        pushHistory();
        dragClipHistoryRef.current = true;
      }
      const asset = assetsRef.current.find(
        (item) => item.id === dragged.assetId
      );
      const track = timelineTrackRef.current;
      const currentTimelineScale = Math.max(timelineScaleRef.current, 0.0001);
      const deltaSeconds =
        (event.clientX - resolvedDragState.startX) / currentTimelineScale;
      const rawTime = resolvedDragState.startLeft + deltaSeconds;
      const dragDirection = Math.sign(deltaSeconds);
      const snapThresholdSeconds = snapThresholdPx / currentTimelineScale;
      const frameThresholdSeconds = frameStepSeconds;
      let targetTime = rawTime;
      let snapGuide: number | null = null;
      const candidateEdges: number[] = [0];
      timelineItems.forEach((clip) => {
        if (clip.id === dragged.id) {
          return;
        }
        if (dragGroupIds && dragGroupIds.has(clip.id)) {
          return;
        }
        candidateEdges.push(clip.startTime, clip.startTime + clip.duration);
      });
      if (!event.altKey && isTimelineSnappingEnabledRef.current) {
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
      const maxStart = Math.max(0, timelineDurationRef.current + 10);
      let liveTime = clamp(normalizeTimelineTime(targetTime), 0, maxStart);
      if (event.altKey || !isTimelineSnappingEnabledRef.current) {
        liveTime = clamp(normalizeTimelineTime(rawTime), 0, maxStart);
        snapGuide = null;
      }
      if (dragGroup && dragGroup.clips.length > 1) {
        const delta = liveTime - resolvedDragState.startLeft;
        const minDelta = -dragGroup.minStart;
        const maxDelta = maxStart - dragGroup.maxEnd;
        const clampedDelta = clamp(delta, minDelta, maxDelta);
        const previewTime = resolvedDragState.startLeft + clampedDelta;
        const nextDragState = {
          ...resolvedDragState,
          previewTime,
          previewLaneId: resolvedDragState.startLaneId,
          targetLaneId: resolvedDragState.startLaneId,
        };
        commitDragState(nextDragState);
        updateSnapGuide(snapGuide);
        updateCollisionGuide(null);
        updateCollisionActive(false);
        const previousPreviewTime =
          resolvedDragState.previewTime ?? resolvedDragState.startLeft;
        if (
          Math.abs(previewTime - previousPreviewTime) < timelineClipEpsilon
        ) {
          return;
        }
        const groupStartMap = new Map(
          dragGroup.clips.map((entry) => [entry.id, entry.startTime])
        );
        const subtitleStartMap = new Map(
          dragGroup.attachedSubtitles.map((entry) => [
            entry.id,
            entry.startTime,
          ])
        );
        setTimeline((prev) =>
          prev.map((clip) => {
            const groupStart = groupStartMap.get(clip.id);
            if (groupStart !== undefined) {
              const nextStart = Math.max(
                0,
                normalizeTimelineTime(groupStart + clampedDelta)
              );
              if (Math.abs(nextStart - clip.startTime) < timelineClipEpsilon) {
                return clip;
              }
              return { ...clip, startTime: nextStart };
            }
            const subtitleStart = subtitleStartMap.get(clip.id);
            if (subtitleStart !== undefined) {
              const nextStart = Math.max(
                0,
                normalizeTimelineTime(subtitleStart + clampedDelta)
              );
              if (Math.abs(nextStart - clip.startTime) < timelineClipEpsilon) {
                return clip;
              }
              return { ...clip, startTime: nextStart };
            }
            return clip;
          })
        );
        return;
      }
      let targetLaneId =
        resolvedDragState.targetLaneId ?? resolvedDragState.startLaneId;
      const createdLaneId = resolvedDragState.createdLaneId;
      const assetLaneType = asset ? getLaneType(asset) : null;
      let pendingLaneInsert: { type: LaneType; index: number } | null = null;
      if (track) {
        const rect = track.getBoundingClientRect();
        const offsetY = event.clientY - rect.top - timelinePadding;
        const wantsTopLane =
          offsetY < 0 ||
          (assetLaneType !== "audio" &&
            topCreateZonePxRef.current > 0 &&
            offsetY <= topCreateZonePxRef.current);
        let cursor = 0;
        let foundLaneId: string | null = null;
        let foundLaneIndex = -1;
        const rows = laneRowsRef.current;
        if (rows.length > 0) {
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

          const topInsertIndex = assetLaneType
            ? resolveTopInsertIndex(assetLaneType, rows)
            : 0;
          const bottomInsertIndex = assetLaneType
            ? resolveBottomInsertIndex(assetLaneType, rows)
            : rows.length;

          if (wantsTopLane && assetLaneType) {
            // Dragging above all lanes or into top create zone
            pendingLaneInsert = { type: assetLaneType, index: topInsertIndex };
          } else if (offsetY > totalHeight + laneGap && assetLaneType) {
            // Dragging below all lanes - create new lane
            pendingLaneInsert = { type: assetLaneType, index: bottomInsertIndex };
          } else {
            // Find which lane we're hovering over
            // Use an expanded gap zone so inserting between lanes feels effortless.
            const gapCreatePadding = Math.min(
              8,
              Math.max(4, Math.round(laneGap * 0.45))
            );
            let wantsNewLane = false;
            let insertLaneIndex: number | null = null;
            
            for (let i = 0; i < rows.length; i++) {
              const lane = rows[i];
              const laneTop = cursor;
              const laneVisualBottom = cursor + lane.height;
              const laneHitBottom = cursor + lane.height + laneGap;
              const gapCenter = laneVisualBottom + laneGap / 2;
              
              // Check if we're in the expanded "create new lane" zone
              if (
                Math.abs(offsetY - gapCenter) <= gapCreatePadding &&
                i < rows.length - 1
              ) {
                const nextLane = rows[i + 1];
                if (
                  assetLaneType &&
                  canInsertLaneBetween(assetLaneType, lane.type, nextLane.type)
                ) {
                  wantsNewLane = true;
                  insertLaneIndex = i + 1;
                } else {
                  // Lane type mismatch - don't create, just use current
                  foundLaneId = lane.id;
                  foundLaneIndex = i;
                  wantsNewLane = false;
                }
                break;
              }

              if (offsetY >= laneTop && offsetY <= laneHitBottom) {
                foundLaneId = lane.id;
                foundLaneIndex = i;
                break;
              }
              cursor += lane.height + laneGap;
            }
            
            // Create new lane if user dragged into gap zone
            if (wantsNewLane && assetLaneType) {
              pendingLaneInsert = {
                type: assetLaneType,
                index: insertLaneIndex ?? bottomInsertIndex,
              };
            }
            
            // Check if we're in the gap between video section and audio section
            // This is where users drag to create a new video lane
            if (
              !pendingLaneInsert &&
              !foundLaneId &&
              assetLaneType !== "audio" &&
              audioSectionStart > 0
            ) {
              if (offsetY >= videoSectionEnd && offsetY < audioSectionStart) {
                // In the gap - create new video/text lane
                pendingLaneInsert = {
                  type: assetLaneType!,
                  index: bottomInsertIndex,
                };
              }
            }
          }
        }
        // Check lane type compatibility - enforce lane ordering rules
        // Audio lanes stay at bottom, video/text lanes stay above audio
        if (!pendingLaneInsert && foundLaneId && foundLaneIndex >= 0 && assetLaneType) {
          const rows = laneRowsRef.current;
          const foundLane = rows[foundLaneIndex];
          if (foundLane && foundLane.type !== assetLaneType) {
            // Lane type mismatch - find nearest compatible lane respecting ordering rules
            let compatibleLaneId: string | null = null;
            
            if (assetLaneType === "audio") {
              // Audio clips can only go to audio lanes (at bottom) - search below only
              for (let i = foundLaneIndex + 1; i < rows.length; i++) {
                if (rows[i].type === "audio") {
                  compatibleLaneId = rows[i].id;
                  break;
                }
              }
            } else {
              // Video/text clips stay above audio - search above only, never into audio section
              for (let i = foundLaneIndex - 1; i >= 0; i--) {
                if (rows[i].type === assetLaneType) {
                  compatibleLaneId = rows[i].id;
                  break;
                }
              }
              // If no exact match found above, find any non-audio lane above
              if (!compatibleLaneId) {
                for (let i = foundLaneIndex - 1; i >= 0; i--) {
                  if (rows[i].type !== "audio") {
                    // For video, accept video lanes; for text, accept text lanes
                    if (rows[i].type === assetLaneType) {
                      compatibleLaneId = rows[i].id;
                      break;
                    }
                  }
                }
              }
            }
            
            // If no compatible lane found, create a new one (will be inserted at correct position)
            if (!compatibleLaneId) {
              pendingLaneInsert = {
                type: assetLaneType,
                index:
                  assetLaneType === "audio"
                    ? resolveTopInsertIndex(assetLaneType, rows)
                    : resolveBottomInsertIndex(assetLaneType, rows),
              };
            }
            
            if (compatibleLaneId) {
              foundLaneId = compatibleLaneId;
            } else {
              foundLaneId = null;
              foundLaneIndex = -1;
            }
          }
        }
        setTopCreateZoneActive(wantsTopLane);
        if (!pendingLaneInsert && foundLaneId) {
          targetLaneId = foundLaneId;
        }
        if (pendingLaneInsert) {
          targetLaneId = resolvedDragState.startLaneId;
        }
      }
      const resolveNonOverlappingStart = (
        startTime: number,
        duration: number,
        laneId: string,
        direction: number
      ) => {
        const occupied = timelineItems
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
        const previousPreviewTime =
          typeof resolvedDragState.previewTime === "number"
            ? resolvedDragState.previewTime
            : null;
        let previousPoint: number | null = null;
        let nextPoint: number | null = null;
        points.forEach((point) => {
          if (point <= startTime + timelineClipEpsilon) {
            previousPoint = point;
          }
          if (nextPoint === null && point >= startTime - timelineClipEpsilon) {
            nextPoint = point;
          }
        });
        if (previousPoint === null) {
          previousPoint = points[0] ?? startTime;
        }
        if (nextPoint === null) {
          nextPoint = points[points.length - 1] ?? startTime;
        }
        let candidate = previousPoint;
        const previousDistance = Math.abs(startTime - previousPoint);
        const nextDistance = Math.abs(nextPoint - startTime);
        if (nextDistance < previousDistance - timelineClipEpsilon) {
          candidate = nextPoint;
        } else if (
          Math.abs(nextDistance - previousDistance) <= timelineClipEpsilon
        ) {
          if (direction > 0) {
            candidate = nextPoint;
          } else if (direction < 0) {
            candidate = previousPoint;
          } else if (previousPreviewTime !== null) {
            const previousCandidateDistance = Math.abs(
              previousPreviewTime - previousPoint
            );
            const nextCandidateDistance = Math.abs(
              previousPreviewTime - nextPoint
            );
            candidate =
              nextCandidateDistance < previousCandidateDistance
                ? nextPoint
                : previousPoint;
          } else {
            candidate = nextPoint;
          }
        }
        if (previousPreviewTime !== null) {
          const hasPreviousInsertionPoint = points.some(
            (point) =>
              Math.abs(point - previousPreviewTime) < timelineClipEpsilon
          );
          if (
            hasPreviousInsertionPoint &&
            Math.abs(candidate - previousPreviewTime) >= timelineClipEpsilon
          ) {
            const switchThreshold = Math.max(
              frameStepSeconds,
              timelineClipEpsilon * 1.5
            );
            const candidateDistance = Math.abs(candidate - startTime);
            const previousCandidateDistance = Math.abs(
              previousPreviewTime - startTime
            );
            if (
              candidateDistance + switchThreshold >=
              previousCandidateDistance
            ) {
              candidate = previousPreviewTime;
            }
          }
        }
        return {
          start: clamp(candidate, 0, maxStart),
          collision: true,
        };
      };
      const isPendingInsert = Boolean(pendingLaneInsert);
      const resolved = isPendingInsert
        ? { start: liveTime, collision: false }
        : resolveNonOverlappingStart(
            liveTime,
            dragged.duration,
            targetLaneId,
            dragDirection
          );
      const nextDragState = {
        ...resolvedDragState,
        targetLaneId,
        createdLaneId,
        previewTime: resolved.start,
        previewLaneId: isPendingInsert ? undefined : targetLaneId,
        pendingLaneInsert: pendingLaneInsert ?? undefined,
      };
      commitDragState(nextDragState);
      if (resolved.collision && !isPendingInsert) {
        updateCollisionGuide(resolved.start);
        updateCollisionActive(true);
      } else {
        updateCollisionGuide(null);
        updateCollisionActive(false);
      }
      updateSnapGuide(snapGuide);
      if (!isPendingInsert) {
        const attachedSubtitleIds = subtitleSourceClipMapRef.current.get(
          dragged.id
        );
        setTimeline((prev) => {
          const current = prev.find((clip) => clip.id === dragged.id);
          if (!current) {
            return prev;
          }
          const currentStart = current.startTime;
          const previewStart = resolved.start;
          const delta = previewStart - currentStart;
          const hasLaneChange = current.laneId !== targetLaneId;
          if (!hasLaneChange && Math.abs(delta) < timelineClipEpsilon) {
            return prev;
          }
          const shouldShiftSubtitles =
            attachedSubtitleIds && attachedSubtitleIds.length > 0;
          const attachedSet = shouldShiftSubtitles
            ? new Set(attachedSubtitleIds)
            : null;
          return prev.map((clip) => {
            if (clip.id === dragged.id) {
              if (
                clip.laneId === targetLaneId &&
                Math.abs(clip.startTime - previewStart) < timelineClipEpsilon
              ) {
                return clip;
              }
              return {
                ...clip,
                startTime: previewStart,
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
      }
    };
    const flushQueuedMove = () => {
      if (!queuedEvent) {
        return;
      }
      const event = queuedEvent;
      queuedEvent = null;
      processMove(event);
    };
    const scheduleQueuedMove = () => {
      if (frameId !== null) {
        return;
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        flushQueuedMove();
        if (queuedEvent) {
          scheduleQueuedMove();
        }
      });
    };
    const handleMove = (event: MouseEvent) => {
      queuedEvent = event;
      scheduleQueuedMove();
    };
    const handleUp = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
      flushQueuedMove();
      const dragState = dragClipStateRef.current;
      if (!dragState) {
        return;
      }
      if (dragState.group && dragState.group.clips.length > 1) {
        dragClipHistoryRef.current = false;
        updateSnapGuide(null);
        updateCollisionGuide(null);
        updateCollisionActive(false);
        setTopCreateZoneActive(false);
        setDragClipState(null);
        dragClipStateRef.current = null;
        return;
      }
      let resolvedTargetLaneId =
        dragState.previewLaneId ??
        dragState.targetLaneId ??
        dragState.startLaneId;
      if (dragState.pendingLaneInsert) {
        const nextLanes = [...lanesRef.current];
        resolvedTargetLaneId = insertLaneAtIndex(
          dragState.pendingLaneInsert.type,
          nextLanes,
          dragState.pendingLaneInsert.index
        );
        setLanes(nextLanes);
      }
      setTimeline((prev) => {
        const dragged = prev.find((clip) => clip.id === dragState.clipId);
        if (!dragged) {
          return prev;
        }
        const resolvedStart = clamp(
          normalizeTimelineTime(dragState.previewTime ?? dragged.startTime),
          0,
          Math.max(0, timelineDurationRef.current + 10)
        );
        const laneClips = prev
          .filter(
            (clip) =>
              clip.laneId === resolvedTargetLaneId || clip.id === dragged.id
          )
          .map((clip) =>
            clip.id === dragged.id
              ? {
                  ...clip,
                  laneId: resolvedTargetLaneId,
                  startTime: resolvedStart,
                }
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
          if (!subtitleSourceClipMapRef.current.has(clipId)) {
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
            const attached = subtitleSourceClipMapRef.current.get(sourceId);
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
                laneId: resolvedTargetLaneId,
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
      updateSnapGuide(null);
      updateCollisionGuide(null);
      updateCollisionActive(false);
      setTopCreateZoneActive(false);
      setDragClipState(null);
      dragClipStateRef.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
        frameId = null;
      }
      queuedEvent = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [
    dragClipState,
    pushHistory,
    buildDragGroup,
    canInsertLaneBetween,
    insertLaneAtIndex,
    resolveTopInsertIndex,
    resolveBottomInsertIndex,
  ]);

  useEffect(() => {
    if (!dragClipState) {
      setTopCreateZoneActive(false);
    }
  }, [dragClipState]);

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
      const activeDragState = dragTransformStateRef.current;
      if (!activeDragState) {
        return;
      }
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      if (!dragTransformHistoryRef.current) {
        pushHistory();
        dragTransformHistoryRef.current = true;
      }
      const rect = stage.getBoundingClientRect();
      const deltaX = (event.clientX - activeDragState.startX) / rect.width;
      const deltaY = (event.clientY - activeDragState.startY) / rect.height;
      const draftRect = {
        ...activeDragState.startRect,
        x: activeDragState.startRect.x + deltaX,
        y: activeDragState.startRect.y + deltaY,
      };
      const clipWidthPx = draftRect.width * rect.width;
      const clipHeightPx = draftRect.height * rect.height;
      const proposedLeftPx = draftRect.x * rect.width;
      const proposedTopPx = draftRect.y * rect.height;
      const stageLinesX = [0, rect.width / 2, rect.width];
      const stageLinesY = [0, rect.height / 2, rect.height];
      const backgroundLinesX: number[] = [];
      const backgroundLinesY: number[] = [];
      const backgroundTransform = baseBackgroundTransformRef.current;
      if (backgroundTransform) {
        const bgLeft = backgroundTransform.x * rect.width;
        const bgTop = backgroundTransform.y * rect.height;
        const bgWidth = backgroundTransform.width * rect.width;
        const bgHeight = backgroundTransform.height * rect.height;
        backgroundLinesX.push(bgLeft, bgLeft + bgWidth / 2, bgLeft + bgWidth);
        backgroundLinesY.push(bgTop, bgTop + bgHeight / 2, bgTop + bgHeight);
      }
      // Add snap lines from other visible clips
      const otherClipLinesX: number[] = [];
      const otherClipLinesY: number[] = [];
      visualStackRef.current.forEach((entry) => {
        if (entry.clip.id === activeDragState.clipId) {
          return; // Skip the clip being dragged
        }
        const otherTransform = clipTransformsRef.current[entry.clip.id];
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
        setSnapGuidesIfChanged({
          x: snappedX.guide ? [snappedX.guide] : [],
          y: snappedY.guide ? [snappedY.guide] : [],
        });
      } else {
        setSnapGuidesIfChanged(null);
      }
      const minSize = getClipMinSize(activeDragState.clipId);
      const allowOverflow =
        clipAssetKindMapRef.current.get(activeDragState.clipId) !== "text";
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
        groupTransforms.has(activeDragState.clipId);
      if (isSubtitleGroupDrag && groupTransforms) {
        const deltaX = next.x - activeDragState.startRect.x;
        const deltaY = next.y - activeDragState.startRect.y;
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
              clipAssetKindMapRef.current.get(clipId) !== "text";
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
        clipTransformTouchedRef.current.add(activeDragState.clipId);
        setClipTransforms((prev) => ({
          ...prev,
          [activeDragState.clipId]: next,
        }));
      }
    };
    const handleUp = () => {
      setDragTransformState(null);
      setSnapGuidesIfChanged(null);
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
    pushHistory,
    getClipMinSize,
    setSnapGuidesIfChanged,
  ]);

  useEffect(() => {
    if (!resizeTransformState) {
      return;
    }
    const handleMove = (event: globalThis.PointerEvent) => {
      const activeResizeState = resizeTransformStateRef.current;
      if (!activeResizeState) {
        return;
      }
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      if (!resizeTransformHistoryRef.current) {
        pushHistory();
        resizeTransformHistoryRef.current = true;
      }
      const rect = stage.getBoundingClientRect();
      const deltaX = (event.clientX - activeResizeState.startX) / rect.width;
      const deltaY =
        (event.clientY - activeResizeState.startY) / rect.height;
      const handle = activeResizeState.handle;
      const isTextClip =
        clipAssetKindMapRef.current.get(activeResizeState.clipId) === "text";
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
        activeResizeState.aspectRatio ||
        activeResizeState.startRect.width /
        activeResizeState.startRect.height ||
        1;
      let next: ClipTransform;

      if (keepAspect) {
        if (hasHorizontal && hasVertical) {
          const rawWidth =
            activeResizeState.startRect.width +
            (handle.includes("e") ? deltaX : -deltaX);
          const rawHeight =
            activeResizeState.startRect.height +
            (handle.includes("s") ? deltaY : -deltaY);
          const scaleX = rawWidth / activeResizeState.startRect.width;
          const scaleY = rawHeight / activeResizeState.startRect.height;
          const scale = Math.max(scaleX, scaleY);
          const width = activeResizeState.startRect.width * scale;
          const height = width / ratio;
          next = {
            x: handle.includes("w")
              ? activeResizeState.startRect.x +
              (activeResizeState.startRect.width - width)
              : activeResizeState.startRect.x,
            y: handle.includes("n")
              ? activeResizeState.startRect.y +
              (activeResizeState.startRect.height - height)
              : activeResizeState.startRect.y,
            width,
            height,
          };
        } else if (hasHorizontal) {
          const rawWidth =
            activeResizeState.startRect.width +
            (handle.includes("e") ? deltaX : -deltaX);
          const width = rawWidth;
          const height = width / ratio;
          const centerY =
            activeResizeState.startRect.y +
            activeResizeState.startRect.height / 2;
          next = {
            x: handle.includes("w")
              ? activeResizeState.startRect.x +
              (activeResizeState.startRect.width - width)
              : activeResizeState.startRect.x,
            y: centerY - height / 2,
            width,
            height,
          };
        } else {
          const rawHeight =
            activeResizeState.startRect.height +
            (handle.includes("s") ? deltaY : -deltaY);
          const height = rawHeight;
          const width = height * ratio;
          const centerX =
            activeResizeState.startRect.x +
            activeResizeState.startRect.width / 2;
          next = {
            x: centerX - width / 2,
            y: handle.includes("n")
              ? activeResizeState.startRect.y +
              (activeResizeState.startRect.height - height)
              : activeResizeState.startRect.y,
            width,
            height,
          };
        }
      } else {
        let { x, y, width, height } = activeResizeState.startRect;
        if (handle.includes("e")) {
          width = activeResizeState.startRect.width + deltaX;
        }
        if (handle.includes("w")) {
          width = activeResizeState.startRect.width - deltaX;
          x = activeResizeState.startRect.x + deltaX;
        }
        if (handle.includes("s")) {
          height = activeResizeState.startRect.height + deltaY;
        }
        if (handle.includes("n")) {
          height = activeResizeState.startRect.height - deltaY;
          y = activeResizeState.startRect.y + deltaY;
        }
        next = { x, y, width, height };
      }

      // Apply snapping during resize
      const stageLinesX = [0, rect.width / 2, rect.width];
      const stageLinesY = [0, rect.height / 2, rect.height];
      const otherClipLinesX: number[] = [];
      const otherClipLinesY: number[] = [];
      visualStackRef.current.forEach((entry) => {
        if (entry.clip.id === activeResizeState.clipId) {
          return;
        }
        const otherTransform = clipTransformsRef.current[entry.clip.id];
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
        setSnapGuidesIfChanged({
          x: snappedGuideX !== null ? [snappedGuideX] : [],
          y: snappedGuideY !== null ? [snappedGuideY] : [],
        });
      } else {
        setSnapGuidesIfChanged(null);
      }

      const minSize = getClipMinSize(activeResizeState.clipId);
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
        resizeGroupTransforms.has(activeResizeState.clipId);
      if (isTextClip && hasHorizontal && hasVertical) {
        const resizeFont = resizeTextFontRef.current;
        if (resizeFont && resizeFont.clipId === activeResizeState.clipId) {
          const startWidth = activeResizeState.startRect.width;
          const startHeight = activeResizeState.startRect.height;
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
                groupFonts.get(activeResizeState.clipId) ??
                resizeFont.fontSize;
              const activeFontSize = clamp(
                activeBase * scale,
                textResizeMinFontSize,
                textResizeMaxFontSize
              );
              if (selectedTextEntryRef.current?.clip.id === activeResizeState.clipId) {
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
                const current = prev[activeResizeState.clipId];
                if (!current) {
                  return prev;
                }
                if (Math.abs(current.fontSize - nextFontSize) < 0.1) {
                  return prev;
                }
                return {
                  ...prev,
                  [activeResizeState.clipId]: {
                    ...current,
                    fontSize: nextFontSize,
                  },
                };
              });
              if (selectedTextEntryRef.current?.clip.id === activeResizeState.clipId) {
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
        const deltaX = clamped.x - activeResizeState.startRect.x;
        const deltaY = clamped.y - activeResizeState.startRect.y;
        const deltaWidth = clamped.width - activeResizeState.startRect.width;
        const deltaHeight = clamped.height - activeResizeState.startRect.height;
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
              clipAssetKindMapRef.current.get(clipId) !== "text";
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
        clipTransformTouchedRef.current.add(activeResizeState.clipId);
        setClipTransforms((prev) => ({
          ...prev,
          [activeResizeState.clipId]: clamped,
        }));
      }
    };
    const handleUp = () => {
      const activeResizeState = resizeTransformStateRef.current;
      if (!activeResizeState) {
        return;
      }
      const clipId = activeResizeState.clipId;
      const isTextClip = clipAssetKindMapRef.current.get(clipId) === "text";
      const isSubtitleClip = subtitleClipIdSetRef.current.has(clipId);
      if (isTextClip && !isSubtitleClip) {
        const stage = stageRef.current;
        const settings =
          textSettingsRef.current[clipId] ?? fallbackTextSettings;
        if (stage) {
          const rect = stage.getBoundingClientRect();
          const target =
            resizeTextRectRef.current ??
            activeResizeState.startRect;
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
      setSnapGuidesIfChanged(null);
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
    fallbackTextSettings,
    setSnapGuidesIfChanged,
  ]);

  // Rotation effect
  useEffect(() => {
    if (!rotateTransformState) {
      return;
    }
    const handleMove = (event: globalThis.PointerEvent) => {
      const activeRotateState = rotateTransformStateRef.current;
      if (!activeRotateState) {
        return;
      }
      if (!rotateTransformHistoryRef.current) {
        pushHistory();
        rotateTransformHistoryRef.current = true;
      }
      // Calculate angle from center to current mouse position
      const dx = event.clientX - activeRotateState.centerX;
      const dy = event.clientY - activeRotateState.centerY;
      const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);
      // Calculate angle from center to start position
      const startDx = activeRotateState.startX - activeRotateState.centerX;
      const startDy = activeRotateState.startY - activeRotateState.centerY;
      const startAngle = Math.atan2(startDy, startDx) * (180 / Math.PI);
      // Calculate rotation delta
      let deltaRotation = currentAngle - startAngle;
      // Normalize to -180 to 180
      while (deltaRotation > 180) deltaRotation -= 360;
      while (deltaRotation < -180) deltaRotation += 360;
      // Calculate new rotation
      let newRotation = activeRotateState.startRotation + deltaRotation;
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
        rotateGroupTransforms.has(activeRotateState.clipId);
      if (isSubtitleGroupRotate && rotateGroupTransforms) {
        const delta = newRotation - activeRotateState.startRotation;
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
        clipTransformTouchedRef.current.add(activeRotateState.clipId);
        setClipTransforms((prev) => {
          const current = prev[activeRotateState.clipId];
          if (!current) {
            return prev;
          }
          return {
            ...prev,
            [activeRotateState.clipId]: {
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
        payloadType?: string;
      } & Partial<GifDragPayload>;
      const payload = parsed.payload ?? parsed;
      if (!payload || typeof payload.url !== "string") {
        return null;
      }
      if (
        typeof (payload as { payloadType?: string }).payloadType === "string" &&
        (payload as { payloadType?: string }).payloadType !== "gif"
      ) {
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

  const parseStockAudioDragPayload = (
    raw: string
  ): StockAudioDragPayload | null => {
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as {
        payload?: Partial<StockAudioDragPayload>;
      } & Partial<StockAudioDragPayload>;
      const payload = parsed.payload ?? parsed;
      if (!payload || payload.payloadType !== "stock-audio") {
        return null;
      }
      if (typeof payload.url !== "string" || typeof payload.name !== "string") {
        return null;
      }
      if (typeof payload.id !== "string") {
        return null;
      }
      const size =
        typeof payload.size === "number" && Number.isFinite(payload.size)
          ? payload.size
          : 0;
      const duration =
        typeof payload.duration === "number" && Number.isFinite(payload.duration)
          ? payload.duration
          : payload.duration === null
            ? null
            : undefined;
      return {
        payloadType: "stock-audio",
        id: payload.id,
        name: payload.name,
        url: payload.url,
        size,
        duration,
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

  const handleStockAudioDragStart = useCallback(
    (event: DragEvent<HTMLElement>, track: StockAudioTrack) => {
      const payload = buildStockAudioPayload(track);
      const encoded = JSON.stringify(payload);
      event.dataTransfer.setData(stockAudioDragType, encoded);
      event.dataTransfer.setData("text/plain", encoded);
      event.dataTransfer.effectAllowed = "copy";
    },
    [stockAudioDragType]
  );

  const resetCanvasDragState = useCallback(() => {
    canvasDragDepthRef.current = 0;
    setDragOverCanvas(false);
  }, []);

  const resetTimelineDragState = useCallback(() => {
    timelineDragDepthRef.current = 0;
    setDragOverTimeline(false);
  }, []);

  const handleCanvasDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      canvasDragDepthRef.current += 1;
      setDragOverCanvas(true);
    },
    []
  );

  const handleCanvasDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragOverCanvas(true);
    },
    []
  );

  const handleCanvasDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const nextDepth = Math.max(0, canvasDragDepthRef.current - 1);
      canvasDragDepthRef.current = nextDepth;
      if (nextDepth === 0) {
        setDragOverCanvas(false);
      }
    },
    []
  );

  const handleTimelineDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      timelineDragDepthRef.current += 1;
      setDragOverTimeline(true);
    },
    []
  );

  const handleTimelineDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragOverTimeline(true);
    },
    []
  );

  const handleTimelineDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const nextDepth = Math.max(0, timelineDragDepthRef.current - 1);
      timelineDragDepthRef.current = nextDepth;
      if (nextDepth === 0) {
        setDragOverTimeline(false);
      }
    },
    []
  );

  const addAssetToTimelineFromDrop = (
    asset: MediaAsset,
    event: DragEvent<HTMLDivElement>,
    options?: { skipHistory?: boolean }
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
    const laneId = resolveDropLaneId(laneType, offsetY, nextLanes);
    setLanes(nextLanes);
    const startTime = offsetX / timelineScale;
    addClipAtPosition(asset.id, laneId, startTime, asset, options);
  };

  const handleCanvasDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    try {
      const droppedFiles = Array.from(event.dataTransfer.files ?? []);
      if (droppedFiles.length > 0) {
        await handleDroppedFiles(droppedFiles, { target: "canvas" });
        return;
      }
      const stockAudioPayload =
        parseStockAudioDragPayload(event.dataTransfer.getData(stockAudioDragType)) ??
        parseStockAudioDragPayload(event.dataTransfer.getData("text/plain"));
      if (stockAudioPayload) {
        await handleStockAudioDrop(stockAudioPayload, "canvas");
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
    } finally {
      resetCanvasDragState();
    }
  };

  const handleTimelineDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    try {
      const droppedFiles = Array.from(event.dataTransfer.files ?? []);
      if (droppedFiles.length > 0) {
        await handleDroppedFiles(droppedFiles, { target: "timeline", event });
        return;
      }
      const stockAudioPayload =
        parseStockAudioDragPayload(event.dataTransfer.getData(stockAudioDragType)) ??
        parseStockAudioDragPayload(event.dataTransfer.getData("text/plain"));
      if (stockAudioPayload) {
        await handleStockAudioDrop(stockAudioPayload, "timeline", event);
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
    } finally {
      resetTimelineDragState();
    }
  };

  useEffect(() => {
    const clearDragOverlays = () => {
      resetCanvasDragState();
      resetTimelineDragState();
    };
    window.addEventListener("dragend", clearDragOverlays);
    window.addEventListener("drop", clearDragOverlays);
    return () => {
      window.removeEventListener("dragend", clearDragOverlays);
      window.removeEventListener("drop", clearDragOverlays);
    };
  }, [resetCanvasDragState, resetTimelineDragState]);

  const handleTimelineWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement> | globalThis.WheelEvent) => {
      const scrollEl = timelineScrollRef.current;
      if (!scrollEl) {
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        if (event.cancelable) {
          event.preventDefault();
        }
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
      if (event.cancelable) {
        event.preventDefault();
      }
    },
    [timelineDuration, timelineScale]
  );

  useEffect(() => {
    const scrollEl = timelineScrollRef.current;
    if (!scrollEl) {
      return;
    }
    const handleNativeWheel = (event: globalThis.WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      if (event.cancelable) {
        event.preventDefault();
      }
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
    if (!event.shiftKey) {
      setSelectedClipIds([]);
      setSelectedClipId(null);
      setActiveCanvasClipId(null);
      setActiveAssetId(null);
      setIsBackgroundSelected(false);
      closeFloatingMenu();
      closeTimelineContextMenu();
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
  }, [handleScrubTo, isScrubbing]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
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
  }, []);

  const renderToolRail = () => (
    <aside className="hidden w-20 flex-col items-center border-r border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] lg:flex">
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
            ? "group relative flex h-[60px] w-[60px] cursor-pointer select-none flex-col items-center justify-center font-medium text-[#6a47ff] active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(106,71,255,0.24)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1012]"
            : "group relative flex h-[60px] w-[60px] cursor-pointer select-none flex-col items-center justify-center font-normal text-[#898a8b] hover:text-[#898a8b] hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(106,71,255,0.24)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1012]";
          const iconWrapperClassName = isActive
            ? "relative w-9 h-9 rounded-xl flex justify-center items-center bg-[rgba(106,71,255,0.1)]"
            : "relative w-9 h-9 rounded-xl flex justify-center items-center bg-transparent group-hover:bg-[rgba(255,255,255,0.03)]";
          const iconClassName = isActive
            ? "text-[#6a47ff]"
            : "text-[#5e636e] group-hover:text-[#5e636e]";

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
    handleStockAudioDragStart,
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
    subtitleSegments: deferredSubtitleSegmentsForSidebar,
    subtitleSource,
    subtitleSourceOptions,
    subtitleStatus,
    subtitleStyleFilter,
    subtitleStyleId,
    subtitleStylePresets: resolvedSubtitleStylePresets,
    detachedSubtitleIds,
    subtitleMoveTogether,
    transcriptSegments: deferredTranscriptSegmentsForSidebar,
    transcriptSource,
    transcriptSourceOptions,
    transcriptStatus,
    transcriptError,
    projectAspectRatio,
    projectBackgroundImage,
    projectBackgroundMode,
    projectDurationMode,
    projectDurationSeconds,
    projectSizeId,
    projectSizeOptions,
    applySubtitleStyle,
    handleGenerateSubtitles,
    handleGenerateTranscript,
    handleClearTranscript,
    handleSubtitleAddLine,
    handleSubtitlePreview,
    handleSubtitleDelete,
    handleSubtitleDeleteAll,
    handleSubtitleDetachToggle,
    handleSubtitleShiftAll,
    handleSubtitleStyleUpdate,
    handleSubtitleTextUpdate,
    setSubtitleMoveTogether,
    setTranscriptSource,
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
    aiImagePrompt,
    setAiImagePrompt,
    aiImageAspectRatio,
    setAiImageAspectRatio,
    aiImageStatus,
    aiImageError,
    aiImagePreview,
    aiImageSaving,
    aiImageMagicLoading,
    aiImageMagicError,
    aiImageLastPrompt,
    aiImageLastAspectRatio,
    handleAiImageGenerate,
    handleAiImageImprovePrompt,
    handleAiImageClear,
    handleAiImageAddToTimeline,
    aiVideoPrompt,
    setAiVideoPrompt,
    aiVideoAspectRatio,
    setAiVideoAspectRatio,
    aiVideoDuration,
    setAiVideoDuration,
    aiVideoGenerateAudio,
    setAiVideoGenerateAudio,
    setAiVideoSplitAudio,
    aiVideoStatus,
    aiVideoError,
    aiVideoPreview,
    aiVideoMagicLoading,
    aiVideoMagicError,
    handleAiVideoGenerate,
    handleAiVideoImprovePrompt,
    handleAiVideoUploadImage,
    handleAiVideoClear,
    aiBackgroundRemovalStatus,
    aiBackgroundRemovalError,
    aiBackgroundRemovalPreview,
    aiBackgroundRemovalSubjectIsPerson,
    setAiBackgroundRemovalSubjectIsPerson,
    aiBackgroundRemovalSelection,
    handleAiBackgroundRemoval,
    aiVoiceoverScript,
    setAiVoiceoverScript,
    aiVoiceoverSelectedVoice,
    setAiVoiceoverSelectedVoice,
    aiVoiceoverVoices,
    aiVoiceoverVoicesStatus,
    aiVoiceoverVoicesError,
    aiVoiceoverStatus,
    aiVoiceoverError,
    aiVoiceoverPreview,
    aiVoiceoverSaving,
    aiVoiceoverLastScript,
    aiVoiceoverLastVoice,
    handleAiVoiceoverGenerate,
    handleAiVoiceoverAddToTimeline,
    handleAiVoiceoverClear,
    handleAiVoiceoverPreviewToggle,
    handleAiVoiceoverVoicesRetry,
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
          className={`relative overflow-visible ${dragOverCanvas ? "ring-2 ring-[#9aed00]" : ""
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
          onDragEnter={handleCanvasDragEnter}
          onDragOver={handleCanvasDragOver}
          onDragLeave={handleCanvasDragLeave}
          onDrop={handleCanvasDrop}
        >
          <div className="relative flex h-full w-full items-center justify-center">
            <div
              className="relative flex h-full w-full items-center justify-center overflow-hidden"
              style={isExportMode ? { backgroundColor: canvasBackground } : undefined}
            >
              {!isExportMode && (
                <div
                  className="pointer-events-none absolute inset-0 border border-[rgba(255,255,255,0.06)] rounded-xl"
                  style={{ 
                    backgroundColor: "#1a1c1e",
                    backgroundImage: "radial-gradient(ellipse at center, rgba(106, 71, 255, 0.08) 0%, transparent 70%)"
                  }}
                />
              )}
              {dragOverCanvas && (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-[#0e1012]/90 backdrop-blur-sm border-2 border-dashed border-[#6a47ff]">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[rgba(106,71,255,0.15)]">
                      <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#6a47ff]">
                        <path d="M12 4v10m0 0-4-4m4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-[#6a47ff]">Drop to add to timeline</span>
                  </div>
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
                <div className="relative z-10 flex flex-col items-center gap-4 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[rgba(106,71,255,0.1)] border border-[rgba(106,71,255,0.2)]">
                    {showUploadingState ? (
                      <svg className="h-6 w-6 text-[#6a47ff] animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-6 w-6 text-[#6a47ff]">
                        <path d="M12 16V4m0 0L8 8m4-4 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-base font-medium text-[#f7f7f8]">
                      {showUploadingState ? "Uploading..." : "Drop your first clip"}
                    </h2>
                    <p className="text-sm text-[#5e636e]">
                      {showUploadingState ? "Adding media to timeline" : "or click to browse"}
                    </p>
                  </div>
                  {!showUploadingState && (
                    <button
                      type="button"
                      className="rounded-lg bg-[#6a47ff] px-4 py-2 text-sm font-medium text-white hover:bg-[#5c24f7] transition-colors"
                      onClick={handleUploadClick}
                    >
                      Upload media
                    </button>
                  )}
                </div>
              ) : visualStack.length > 0 ? (
                <div className="relative z-10 h-full w-full">
                  {visualStack.map((entry) => {
                    const transform = resolveClipTransform(
                      entry.clip.id,
                      entry.asset
                    );
                    const isActive = activeCanvasClipId === entry.clip.id;
                    const isRedditIntroCard =
                      entry.asset.kind === "image" &&
                      /reddit intro card/i.test(entry.asset.name);
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
                    const clipZ = getClipZIndex(entry);
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
                                ...(isRedditIntroCard
                                  ? {
                                      borderRadius: "14px",
                                      boxShadow:
                                        "0 18px 40px rgba(0,0,0,0.35)",
                                    }
                                  : null),
                                // GPU acceleration hints for smooth playback
                                contain: isRedditIntroCard
                                  ? 'layout style'
                                  : 'strict',
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
                                    className={`h-full w-full ${
                                      isRedditIntroCard
                                        ? "object-contain"
                                        : "object-cover"
                                    }`}
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
                                    preload="metadata"
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
	                      zIndex: 100000,
	                      opacity: 0,
	                      visibility: 'hidden',
	                      pointerEvents: 'none',
	                      willChange: 'opacity, transform',
	                      contain: 'layout paint style',
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
	                            willChange: 'transform, opacity',
	                            backfaceVisibility: 'hidden',
	                          }}
	                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeAsset?.kind === "audio" ? (
                <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-4">
                  <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[#E7EDFF] text-[#9aed00]">
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
                  <p className="text-sm text-[#898a8b]">Audio preview ready</p>
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
                    className="absolute rounded-lg border border-dashed border-[#9aed00] bg-[#9aed00]/10"
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
                        className="absolute top-0 bottom-0 w-px bg-[#9aed00]/70"
                        style={{ left: `${line}px` }}
                      />
                    ))}
                    {snapGuides.y.map((line) => (
                      <div
                        key={`snap-y-${line}`}
                        className="absolute left-0 right-0 h-px bg-[#9aed00]/70"
                        style={{ top: `${line}px` }}
                      />
                    ))}
                  </div>
                )}
              {visualStack.length > 0 && (
                <div className="relative h-full w-full">
                  {visualStack.map((entry) => {
                    const transform = resolveClipTransform(
                      entry.clip.id,
                      entry.asset
                    );
                    const isSelected = selectedClipIdsSet.has(entry.clip.id);
                    const isActive = activeCanvasClipId === entry.clip.id;
                    if (!isSelected && !isActive) {
                      return null;
                    }
                    const clipZ = getClipZIndex(entry);
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
                          <div className="pointer-events-none absolute inset-0 border-2 border-[#9aed00] shadow-[0_0_0_1px_rgba(154,237,0,0.35)]" />
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
                                className="text-[#8F9199] hover:text-[#9aed00] transition-colors"
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
                              className="pointer-events-none absolute left-1/2 -translate-x-1/2 w-px bg-[#9aed00]/40"
                              style={{
                                top: "-12px",
                                height: "12px",
                              }}
                            />
                            {transformHandles.map((handle) => (
                              <button
                                key={`${entry.clip.id}-${handle.id}-overlay`}
                                type="button"
                                className={`pointer-events-auto absolute border border-[#9aed00] bg-[#1a1c1e] shadow-sm ${handle.className} ${handle.cursor} ${
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
                          <div className="pointer-events-none absolute inset-0 border-2 border-[#9aed00] shadow-[0_0_0_1px_rgba(154,237,0,0.35)]" />
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
                                className="text-[#8F9199] hover:text-[#9aed00] transition-colors"
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
                              className="pointer-events-none absolute left-1/2 -translate-x-1/2 w-px bg-[#9aed00]/40"
                              style={{
                                top: "-12px",
                                height: "12px",
                              }}
                            />
                            {transformHandles.map((handle) => (
                              <button
                                key={`${selectedSubtitleEntry.clip.id}-${handle.id}-subtitle`}
                                type="button"
                                className={`pointer-events-auto absolute border border-[#9aed00] bg-[#1a1c1e] shadow-sm ${handle.className} ${handle.cursor} ${
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
              <div className="h-6 w-px bg-[rgba(255,255,255,0.05)]" />
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
              <div className="h-6 w-px bg-[rgba(255,255,255,0.05)]" />
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
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)]/70 bg-[#1a1c1e] text-[#898a8b] transition hover:bg-[rgba(255,255,255,0.03)] hover:text-[#f7f7f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(154,237,0,0.24)]"
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
                    <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-[rgba(255,255,255,0.08)]/90" />
                    <div
                      className="pointer-events-none absolute left-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-[#9aed00]"
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
                    className="h-7 w-14 rounded-lg border border-transparent bg-[rgba(255,255,255,0.03)] px-2 text-right text-xs font-semibold text-[#898a8b]"
                  />
                </div>
                <div className="flex items-center justify-between text-xs font-semibold text-[#898a8b]">
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
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5e636e]">
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
                            ? "bg-[rgba(154,237,0,0.1)] text-[#9aed00] shadow-[inset_0_0_0_1px_rgba(154,237,0,0.25)]"
                            : "bg-[rgba(255,255,255,0.03)] text-[#898a8b] hover:bg-[rgba(255,255,255,0.05)]"
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
                        ? "bg-[rgba(255,255,255,0.03)] text-[#898a8b] hover:bg-[rgba(255,255,255,0.05)]"
                        : "bg-[rgba(154,237,0,0.1)] text-[#9aed00] shadow-[inset_0_0_0_1px_rgba(154,237,0,0.25)]"
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
                  <div className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.08)]/70 bg-[rgba(255,255,255,0.03)]/70 px-3 py-2 text-xs text-[#898a8b]">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e636e]">
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
                        className="w-16 rounded-md border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] px-2 py-1 text-xs font-semibold text-[#f7f7f8]"
                      />
                      <span className="text-xs text-[#5e636e]">x</span>
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
                          <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#898a8b]">
                            <path d="M13 10a5 5 0 0 1-10 0c0-3.5 5-9 5-9s5 5.5 5 9" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="truncate">Opacity</span>
                        </span>
                        <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#5e636e]">
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
                          <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#898a8b]">
                            <path d="M12.2 13a.8.8 0 1 0 1.6 0zM13 9h-.8zM7 3v.8zm-4-.8a.8.8 0 1 0 0 1.6zM14 13V9h-1.6v4zM7 2.2H3v1.6h4zM13.8 9A6.8 6.8 0 0 0 7 2.2v1.6c2.9 0 5.2 2.3 5.2 5.2z" fill="currentColor" />
                          </svg>
                          <span className="truncate">Round Corners</span>
                        </span>
                        <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#5e636e]">
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
                          <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#898a8b]">
                            <path d="M10 5.3a2 2 0 1 0 4 0 2 2 0 0 0-4 0m0 0H2.7m3.3 5.4a2 2 0 1 0-4 0 2 2 0 0 0 4 0m0 0h7.3" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          </svg>
                          <span className="truncate">Adjust</span>
                        </span>
                      </button>
                      <div className="my-1 h-px bg-[rgba(255,255,255,0.05)]" />
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
                      <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#898a8b]">
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
                      <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#898a8b]">
                        <path d="m1 10.3 6.4 3.5a2 2 0 0 0 1.9 0l6.4-3.5M1 6.6l6.4 3.1a2.3 2.3 0 0 0 2.1 0l6.4-3.1" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="truncate">Order</span>
                    </span>
                    <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#5e636e]">
                      <path d="m6 12 4-4-4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <div className="my-1 h-px bg-[rgba(255,255,255,0.05)]" />
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
                      <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#898a8b]">
                        <path d="M8 2.7a6 6 0 1 0 0 12 6 6 0 0 0 0-12m0 0V1.3m0 4v3.3m2 0H8m2-7.3H6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="truncate">Adjust Timing</span>
                    </span>
                    <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#5e636e]">
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
                          <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#898a8b]">
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
                          <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#898a8b]">
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
                        <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#898a8b]">
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
                        <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#898a8b]">
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
                        <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#898a8b]">
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
                        <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#898a8b]">
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
                          <span className="text-xs font-semibold text-[#898a8b]">Opacity</span>
                          <input
                            readOnly
                            value={`${floatingVideoSettings.opacity}%`}
                            className="h-7 w-14 rounded-lg border border-transparent bg-[rgba(255,255,255,0.03)] px-2 text-right text-xs font-semibold text-[#898a8b]"
                          />
                        </div>
                        <div className="relative">
                          <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-[rgba(255,255,255,0.08)]/90" />
                          <div
                            className="pointer-events-none absolute left-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-[#9aed00]"
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
                      <div className="text-xs text-[#898a8b]">Opacity controls are available for video clips.</div>
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
                        <span className="text-xs font-semibold text-[#898a8b]">Round Corners</span>
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
                      <div className="text-xs text-[#898a8b]">Corner controls are available for video clips.</div>
                    )}
                  </div>
                )}
                {floatingMenu.showTiming && (
                  <div
                    className={`absolute top-2 ${floatingSubmenuClass} space-y-3 p-3 ${floaterSurfaceClass}`}
                    style={{ width: floaterSubmenuWidth }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#898a8b]">Duration</span>
                      <input
                        key={`${floatingMenuEntry.clip.id}-duration-${floatingMenuEntry.clip.duration}`}
                        defaultValue={formatTimeWithTenths(floatingMenuEntry.clip.duration)}
                        onBlur={(event) =>
                          handleDurationCommit(
                            floatingMenuEntry.clip,
                            event.target.value
                          )
                        }
                        className="h-7 w-20 rounded-lg border border-[rgba(255,255,255,0.08)]/70 bg-[#1a1c1e] px-2 text-right text-xs font-semibold text-[#f7f7f8]"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#898a8b]">Start</span>
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
                          className="h-7 w-20 rounded-lg border border-[rgba(255,255,255,0.08)]/70 bg-[#1a1c1e] px-2 text-right text-xs font-semibold text-[#f7f7f8]"
                        />
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)]/70 bg-[#1a1c1e] text-[#898a8b] transition hover:bg-[rgba(255,255,255,0.03)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(154,237,0,0.24)]"
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
                      <span className="text-xs font-semibold text-[#898a8b]">End</span>
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
                          className="h-7 w-20 rounded-lg border border-[rgba(255,255,255,0.08)]/70 bg-[#1a1c1e] px-2 text-right text-xs font-semibold text-[#f7f7f8]"
                        />
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)]/70 bg-[#1a1c1e] text-[#898a8b] transition hover:bg-[rgba(255,255,255,0.03)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(154,237,0,0.24)]"
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
      className="group flex min-w-0 flex-col border-t border-[rgba(255,255,255,0.08)] bg-[#1a1c1e]"
      style={{ height: `${timelineHeight}px` }}
    >
      <div
        className={`group relative flex cursor-row-resize items-center justify-center bg-[#1a1c1e] touch-none ${isResizingTimeline
          ? "border-b border-[#9aed00]"
          : "border-b border-[rgba(255,255,255,0.06)]"
          }`}
        style={{ height: `${timelineHandleHeight}px` }}
        onPointerDown={handleTimelineResizeStart}
        aria-label="Resize timeline"
      >
        <span
          className={`h-0.5 w-16 rounded-full transition ${isResizingTimeline
            ? "bg-[#9aed00] opacity-100"
            : "bg-[rgba(255,255,255,0.14)] opacity-0 group-hover:opacity-100 group-hover:bg-[#94A3B8]"
            }`}
        />
        {isResizingTimeline && (
          <span className="absolute left-0 right-0 top-0 h-0.5 bg-[#9aed00]" />
        )}
      </div>
      <div
        className="flex h-14 items-center px-3"
        onMouseDown={(event) => {
          const target = event.target as HTMLElement | null;
          if (
            target?.closest(
              'button, input, select, textarea, [role="button"]'
            )
          ) {
            return;
          }
          setSelectedClipIds([]);
          setSelectedClipId(null);
          setActiveCanvasClipId(null);
          setActiveAssetId(null);
          setIsBackgroundSelected(false);
          closeFloatingMenu();
          closeTimelineContextMenu();
        }}
      >
        <div className="flex flex-1 items-center gap-2">
          <button
            className="flex items-center gap-2 rounded-lg bg-[rgba(255,255,255,0.05)] px-3 py-2 text-xs font-semibold text-[#f7f7f8] disabled:cursor-not-allowed disabled:opacity-60"
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
                  ? "border-[rgba(154,237,0,0.3)] bg-[rgba(154,237,0,0.1)] text-[#9aed00]"
                  : "border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] text-[#898a8b] hover:bg-[rgba(255,255,255,0.03)]"
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
              className="flex h-5 w-5 items-center justify-center rounded-full text-[#5e636e] transition hover:bg-[rgba(255,255,255,0.05)] hover:text-[#898a8b]"
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
              className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] text-[#f7f7f8]"
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
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] text-[#f7f7f8]"
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
              className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] text-[#f7f7f8]"
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
              className="flex h-5 w-5 items-center justify-center rounded-full text-[#5e636e] transition hover:bg-[rgba(255,255,255,0.05)] hover:text-[#898a8b]"
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
          <div className="absolute left-full ml-2 flex items-center gap-1 text-xs font-medium text-[#898a8b]">
            <span className="min-w-[48px]">
              {formatTimelineLabel(currentTime)}
            </span>
            <span>/</span>
            <span>{formatTimelineLabel(timelineDuration)}</span>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-end gap-2">
          <button
            className="rounded-lg bg-[rgba(255,255,255,0.05)] px-3 py-2 text-xs font-semibold text-[#f7f7f8]"
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
              className="w-full accent-[#9aed00]"
              aria-label="Timeline zoom"
            />
          </div>
          <button
            className="rounded-lg bg-[rgba(255,255,255,0.05)] px-3 py-2 text-xs font-semibold text-[#f7f7f8]"
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
            className="rounded-lg bg-[rgba(255,255,255,0.05)] px-3 py-2 text-xs font-semibold text-[#f7f7f8]"
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
            className="relative h-6 text-[11px] text-[#5e636e]"
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
            className={`relative isolate mt-2 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[linear-gradient(90deg,_rgba(148,163,184,0.15)_1px,_transparent_1px)] p-4 transition ${dragOverTimeline ? "ring-2 ring-[#9aed00]" : ""
              }`}
            style={{
              backgroundSize: `${timelineScale * tickStep}px 100%`,
              minHeight: `${trackMinHeight}px`,
            }}
            onPointerDown={handleTimelineSelectStart}
            onDragEnter={handleTimelineDragEnter}
            onDragOver={handleTimelineDragOver}
            onDragLeave={handleTimelineDragLeave}
            onDrop={handleTimelineDrop}
          >
            {dragOverTimeline && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-[#1a1c1e]/80 text-sm font-semibold text-[#9aed00]">
                Drop to add to timeline
              </div>
            )}
            {dragClipState && topCreateZoneActive && topCreateZonePx > 0 && (
              <div
                className="pointer-events-none absolute left-0 right-0 top-0 z-30"
                style={{ height: `${topCreateZonePx}px` }}
              >
                <div className="absolute inset-0 rounded-t-2xl bg-[#9aed00]/8" />
                <div className="absolute left-0 right-0 bottom-0 h-px bg-[#9aed00]/40" />
              </div>
            )}
            {pendingInsertPreview && (
              <div
                className="pointer-events-none absolute left-0 right-0 z-30"
                style={{
                  top: `${pendingInsertPreview.laneTop}px`,
                  height: `${pendingInsertPreview.laneHeight}px`,
                }}
              >
                <div className="absolute left-0 right-0 top-0 h-px bg-[#9aed00]/35" />
                <div className="absolute left-0 right-0 bottom-0 h-px bg-[#9aed00]/25" />
                <div
                  className="absolute rounded-sm border-2 border-dashed border-[rgba(154,237,0,0.4)] bg-[#9aed00]/10"
                  style={{
                    left: `${pendingInsertPreview.startTime * timelineScale}px`,
                    width: `${pendingInsertPreview.duration * timelineScale}px`,
                    top: `${pendingInsertPreview.clipTop - pendingInsertPreview.laneTop}px`,
                    height: `${pendingInsertPreview.clipHeight}px`,
                  }}
                />
              </div>
            )}
            {rangeSelection && (
              <div
                className="pointer-events-none absolute z-30 rounded-lg border border-[#6a47ff] bg-[#6a47ff]/25 shadow-[0_0_0_1px_rgba(106,71,255,0.6)]"
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
            {timelineLayout.length === 0 ? (
              <button
                type="button"
                data-testid="@editor/timeline/add-media-button"
                className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-full border border-dashed border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] px-4 py-2 text-sm font-semibold text-[#898a8b] shadow-sm"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={handleUploadClick}
              >
                <span className="text-lg text-[#5e636e]">＋</span>
                Add media to this project
              </button>
            ) : (
              <>
                <div
                  className="relative z-0 flex flex-col"
                  style={{ gap: `${laneGap}px` }}
                >
                  {timelineLaneRows}
                  <span
                    ref={playheadLineRef}
                    className="pointer-events-none absolute left-0 top-0 bottom-0 w-[2px] bg-[#9aed00]"
                    style={{
                      transform: playheadContentTransform,
                      willChange: isPlaying ? "transform" : "auto",
                      zIndex: 50,
                    }}
                    aria-hidden="true"
                  />
                </div>
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ zIndex: playheadOverlayZIndex }}
                >
                  {timelineSnapGuide !== null && (
                    <div
                      className="absolute top-4 bottom-4 w-px bg-[#ffbe4c]/90 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]"
                      style={{
                        left: `${timelineSnapGuide * timelineScale + timelinePadding}px`,
                      }}
                    />
                  )}
                  {timelineCollisionGuide !== null && (
                    <div
                      className="absolute top-4 bottom-4 w-px border-l border-dashed border-[#ffbe4c]/90"
                      style={{
                        left: `${timelineCollisionGuide * timelineScale + timelinePadding}px`,
                      }}
                    />
                  )}
                  <button
                    type="button"
                    aria-label="Drag playhead"
                    ref={playheadHandleRef}
                    className="pointer-events-auto absolute left-0 top-4 bottom-4 w-6 cursor-ew-resize border-0 bg-transparent p-0 focus:outline-none"
                    style={{
                      transform: playheadAbsoluteTransform,
                      willChange: isPlaying ? "transform" : "auto",
                    }}
                    onPointerDown={handlePlayheadPointerDown}
                  >
                    <span className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-[#9aed00] shadow-[0_0_0_2px_rgba(255,255,255,0.85)]" />
                  </button>
                </div>
              </>
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
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16" className="text-[#898a8b]">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5.413 5.413 8 8m1.647 1.653 3.686 3.68m-7.919-2.747a2 2 0 1 0-2.828 2.828 2 2 0 0 0 2.828-2.828m0 0 7.92-7.92m-7.92 7.92zM6 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0" />
                  </svg>
                  <span>Split Element</span>
                </div>
              </button>

              {/* Divider */}
              <div className="mx-3 my-1.5 h-px bg-[rgba(255,255,255,0.05)]" />

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
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16" className="text-[#898a8b]">
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
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16" className="text-[#898a8b]">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13.594 9.45A5.632 5.632 0 0 0 3.135 5.83m10.459 3.62 1.442-1.563M13.594 9.45l-1.635-1.508M2.442 7.85a5.631 5.631 0 0 0 10.46 3.616M2.443 7.85 1 9.413M2.442 7.85l1.635 1.508" />
                      </svg>
                      <span>Replace Media</span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 16 16" className="text-[#5e636e]">
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
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16" className="text-[#898a8b]">
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
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16" className="text-[#898a8b]">
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
              <div className="mx-3 my-1.5 h-px bg-[rgba(255,255,255,0.05)]" />

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
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16" className="text-[#898a8b]">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 12.667V4.295c0-.574.367-1.084.912-1.265l5.333-1.778A1.333 1.333 0 0 1 14 2.517v8.817m0 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0m-8 1.333a2 2 0 1 1-4 0 2 2 0 0 1 4 0" />
                      </svg>
                      <span>Audio</span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 16 16" className="text-[#5e636e]">
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
                            <svg viewBox="0 0 16 16" className="h-4 w-4 text-[#898a8b]">
                              <path d="m8.9 11.8-1.4 1.4a3.3 3.3 0 0 1-4.7-4.7l1.4-1.4M7.1 4.2l1.4-1.4a3.3 3.3 0 0 1 4.7 4.7l-1.4 1.4M9.9 6.1 6.1 9.9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span>Detach Audio</span>
                          </div>
                        </button>
                      )}
                      {timelineContextMenuEntry.asset.kind === "video" && (
                        <div className="mx-3 my-1.5 h-px bg-[rgba(255,255,255,0.05)]" />
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
                            <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#898a8b]">
                              <path d="M12 6.1 7.6 9H5a3 3 0 0 0-3 3v0a3 3 0 0 0 3 3h2.6l4.4 3.6V6.1zM18.1 4.9a8.8 8.8 0 0 1 0 14.2M15.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#898a8b]">
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
              <div className="mx-3 my-1.5 h-px bg-[rgba(255,255,255,0.05)]" />

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
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16" className="text-[#898a8b]">
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
          className="relative overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#1a1c1e]/70"
          style={{ height: `${lane.height}px` }}
        >
          <div className="absolute left-2 top-2 text-[10px] uppercase tracking-[0.12em] text-[#5e636e]">
            {lane.label}
          </div>
          {dragPreview && dragPreview.laneId === lane.id && (
            <div
              className="pointer-events-none absolute rounded-sm border-2 border-dashed border-[#ffbe4c]/90 bg-[rgba(255,190,76,0.2)]"
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
            const fallbackPreviewCount =
              lane.type === "video" && asset.kind === "video" && !hasThumbnailFrames
                ? Math.min(thumbnailCount, 8)
                : thumbnailCount;
            const clipBorderClass = isSelected
              ? "border-[#9aed00]"
              : "border-transparent";
            const collisionHighlight =
              isDragging && timelineCollisionActive
                ? "shadow-[0_0_0_2px_rgba(251,191,36,0.65)]"
                : "";
            const dragLiftClass = isDragging ? "z-30 -translate-y-1" : "";
            const dragLiftShadow = isDragging
              ? "shadow-[0_18px_30px_rgba(0,0,0,0.5)] cursor-grabbing"
              : "";
            const clipTransitionClass = isDragging ? "transition-none" : "transition";
            const clipBackgroundClass =
              lane.type === "text"
                ? isSubtitleClip
                  ? "bg-[#CAA7FC]"
                  : "bg-[#F8FAFF]"
                : "bg-[#1a1c1e]";
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
                  className={`group relative flex h-full w-full overflow-hidden rounded-sm border-0 ${clipBackgroundClass} p-0 text-left text-[10px] font-semibold shadow-sm ${clipTransitionClass} ${isDragging ? "opacity-70" : ""} ${collisionHighlight} ${dragLiftShadow}`}
                  data-timeline-clip="true"
                  onContextMenu={(event) =>
                    handleTimelineClipContextMenu(event, clip, asset)
                  }
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setActiveAssetId((prev) => (prev === asset.id ? prev : asset.id));
                    if (asset.kind === "text") {
                      setActiveTool((prev) => (prev === "text" ? prev : "text"));
                    }
                    if (event.shiftKey) {
                      if (selectedClipIdsSet.has(clip.id)) {
                        const next = selectedClipIds.filter(
                          (id) => id !== clip.id
                        );
                        setSelectedClipIds(next);
                        setSelectedClipId(next[0] ?? null);
                      } else {
                        const next = [...selectedClipIds, clip.id];
                        setSelectedClipIds(next);
                        setSelectedClipId(clip.id);
                      }
                      return;
                    }
                    const preserveGroupSelection =
                      selectedClipIdsSet.has(clip.id) &&
                      selectedClipIds.length > 1;
                    if (!preserveGroupSelection) {
                      const alreadySingleSelection =
                        selectedClipIds.length === 1 &&
                        selectedClipIds[0] === clip.id;
                      if (!alreadySingleSelection) {
                        setSelectedClipIds([clip.id]);
                      }
                      setSelectedClipId((prev) => (prev === clip.id ? prev : clip.id));
                    } else {
                      setSelectedClipId((prev) => (prev === clip.id ? prev : clip.id));
                    }
                    dragClipHistoryRef.current = false;
                    const dragGroupIds = preserveGroupSelection
                      ? [...selectedClipIds]
                      : [clip.id];
                    const nextDragState = {
                      clipId: clip.id,
                      startX: event.clientX,
                      startLeft: left,
                      startLaneId: clip.laneId,
                      previewTime: left,
                      previewLaneId: clip.laneId,
                      pendingGroupClipIds:
                        dragGroupIds.length > 1 ? dragGroupIds : undefined,
                      pendingLaneInsert: undefined,
                    };
                    dragClipStateRef.current = nextDragState;
                    setDragClipState(nextDragState);
                    setTopCreateZoneActive(false);
                  }}
                >
                  {lane.type === "video" && (
                    <div
                      className="absolute inset-0 grid h-full w-full"
                      style={{
                        gridTemplateColumns: `repeat(${fallbackPreviewCount}, minmax(0, 1fr))`,
                      }}
                    >
                      {Array.from({ length: fallbackPreviewCount }, (_, index) => {
                        const frameTime = clamp(
                          clip.startOffset +
                            (clip.duration * (index + 0.5)) /
                              Math.max(1, fallbackPreviewCount),
                          clip.startOffset,
                          clip.startOffset + clip.duration - 0.05
                        );
                        return (
                          <div
                            key={`${clip.id}-thumb-${index}`}
                            className="relative h-full w-full overflow-hidden border-r border-[rgba(255,255,255,0.1)] bg-[#1a1c1e] last:border-r-0"
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
                            ) : asset.kind === "video" ? (
                              <video
                                src={asset.url}
                                className="h-full w-full object-cover"
                                muted
                                playsInline
                                preload="auto"
                                disablePictureInPicture
                                tabIndex={-1}
                                onLoadedData={(event) => {
                                  const target = event.currentTarget;
                                  const safeEnd = Math.max(
                                    clip.startOffset,
                                    (Number.isFinite(target.duration)
                                      ? target.duration
                                      : clip.startOffset + clip.duration) - 0.05
                                  );
                                  const seekTime = clamp(
                                    frameTime,
                                    clip.startOffset,
                                    safeEnd
                                  );
                                  if (Math.abs(target.currentTime - seekTime) < 0.02) {
                                    return;
                                  }
                                  try {
                                    target.currentTime = seekTime;
                                  } catch {
                                    // Keep default frame when seek isn't available yet.
                                  }
                                }}
                              />
                            ) : (
                              <div className="h-full w-full bg-[linear-gradient(120deg,#e2e8f0_0%,#f8fafc_50%,#e2e8f0_100%)]" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {lane.type === "audio" && (
                    <div className="absolute inset-0 bg-[rgba(154,237,0,0.1)]" />
                  )}
                  {lane.type === "audio" && (
                    <div className="absolute inset-0 px-2 py-2">
                      <span className="pointer-events-none absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 bg-[rgba(154,237,0,0.4)]" />
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
                  isResizingAudioLane ? "bg-[#9aed00]" : "bg-[rgba(255,255,255,0.14)]/80"
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
    selectedClipIds,
    selectedClipIdsSet,
    timelineCollisionActive,
    timelineLayout,
    timelineScale,
    timelineThumbnails,
  ]);

  const resolvedExportViewport = exportViewport ?? exportDimensions;
  const exportPreviewViewport = exportPreview ?? resolvedExportViewport;
  const exportScale =
    exportPreviewViewport.width > 0 && exportPreviewViewport.height > 0
      ? Math.min(
          resolvedExportViewport.width / exportPreviewViewport.width,
          resolvedExportViewport.height / exportPreviewViewport.height
        )
      : 1;
  const useCssExportScale = exportScaleMode !== "device";
  const exportContainerViewport = useCssExportScale
    ? resolvedExportViewport
    : exportPreviewViewport;

  if (isExportMode) {
    return (
      <div
        className="flex items-center justify-center overflow-hidden bg-black"
        style={{
          width: `${exportContainerViewport.width}px`,
          height: `${exportContainerViewport.height}px`,
        }}
      >
        <main ref={mainRef} className="flex h-full w-full items-center justify-center">
          <div
            style={{
              width: `${exportPreviewViewport.width}px`,
              height: `${exportPreviewViewport.height}px`,
              transform:
                useCssExportScale && exportScale !== 1
                  ? `scale(${exportScale})`
                  : undefined,
              transformOrigin:
                useCssExportScale && exportScale !== 1
                  ? "top left"
                  : undefined,
            }}
          >
            {renderStage()}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#0e1012] text-[#f7f7f8]">
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
        onExport={handleExportButtonClick}
        exportDisabled={exportDisabled}
        exportBusy={exportInFlight}
        exportLabel={exportLabel}
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
	      {splitScreenImportOverlayOpen && (
	        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#1a1c1e]/70 px-4 backdrop-blur-sm">
	          <div className="w-full max-w-md rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
	            <div className="flex items-start gap-4">
	              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E7EDFF] text-[#9aed00]">
	                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(154,237,0,0.25)] border-t-[#9aed00]" />
	              </div>
	              <div className="min-w-0 flex-1">
	                <h3 className="text-lg font-semibold text-[#f7f7f8]">
	                  Preparing your split-screen project
	                </h3>
		                <p className="mt-1 text-sm text-[#898a8b]">
		                  {subtitleStatus === "error"
		                    ? "Subtitle generation failed."
		                    : splitScreenImportOverlayStage === "uploading"
		                      ? "Uploading your video to the cloud..."
		                      : splitScreenImportOverlayStage === "preparing"
		                        ? "Building the split layout..."
		                        : splitScreenImportOverlayStage === "subtitles"
		                          ? "Generating subtitles..."
		                          : "Finalizing editor timeline..."}
		                </p>
	              </div>
	            </div>
	            <div className="mt-6 space-y-3 text-sm">
	              <div className="flex items-center gap-3">
	                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E7EDFF] text-[#9aed00]">
		                  {splitScreenImportOverlayStage === "preparing" ||
		                  splitScreenImportOverlayStage === "uploading" ? (
		                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[rgba(154,237,0,0.25)] border-t-[#9aed00]" />
		                  ) : (
	                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
	                      <path
	                        d="M20 6 9 17l-5-5"
	                        stroke="currentColor"
	                        strokeWidth="2"
	                        strokeLinecap="round"
	                        strokeLinejoin="round"
	                      />
	                    </svg>
	                  )}
	                </div>
	                <span className="text-[#f7f7f8]">Create split-screen layout</span>
	              </div>
		              <div className="flex items-center gap-3">
		                <div
		                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
		                    subtitleStatus === "error"
		                      ? "bg-[rgba(231,41,48,0.1)] text-[#e72930]"
		                      : "bg-[#E7EDFF] text-[#9aed00]"
		                  }`}
		                >
		                  {subtitleStatus === "error" ? (
		                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
		                      <path
		                        d="M18 6 6 18M6 6l12 12"
		                        stroke="currentColor"
		                        strokeWidth="2"
		                        strokeLinecap="round"
		                        strokeLinejoin="round"
		                      />
		                    </svg>
		                  ) : splitScreenImportOverlayStage === "subtitles" ? (
		                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[rgba(154,237,0,0.25)] border-t-[#9aed00]" />
		                  ) : splitScreenImportOverlayStage === "finalizing" ? (
		                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
		                      <path
	                        d="M20 6 9 17l-5-5"
	                        stroke="currentColor"
	                        strokeWidth="2"
	                        strokeLinecap="round"
	                        strokeLinejoin="round"
	                      />
	                    </svg>
	                  ) : (
	                    <div className="h-3.5 w-3.5 rounded-full border-2 border-[rgba(154,237,0,0.25)]" />
	                  )}
	                </div>
	                <span className="text-[#f7f7f8]">Generate subtitles</span>
	              </div>
	              <div className="flex items-center gap-3">
	                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E7EDFF] text-[#9aed00]">
	                  {splitScreenImportOverlayStage === "finalizing" ? (
	                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[rgba(154,237,0,0.25)] border-t-[#9aed00]" />
	                  ) : (
	                    <div className="h-3.5 w-3.5 rounded-full border-2 border-[rgba(154,237,0,0.25)]" />
	                  )}
	                </div>
	                <span className="text-[#f7f7f8]">Finalize timeline</span>
	              </div>
		              {subtitleStatus === "error" && subtitleError ? (
		                <div className="mt-4 rounded-2xl border border-[rgba(231,41,48,0.2)] bg-[rgba(231,41,48,0.1)] px-4 py-3 text-sm text-[#e72930]">
		                  {subtitleError}
		                </div>
		              ) : null}
		              {subtitleStatus === "error" ? (
		                <div className="mt-4">
		                  <button
		                    type="button"
		                    className="w-full rounded-full bg-[#9aed00] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(51,92,255,0.28)] transition hover:brightness-105"
		                    onClick={() => setSplitScreenImportOverlayOpen(false)}
		                  >
		                    Continue to editor
		                  </button>
		                </div>
		              ) : null}
		            </div>
			          </div>
			        </div>
			      )}
	      {streamerVideoImportOverlayOpen && (
	        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#1a1c1e]/70 px-4 backdrop-blur-sm">
	          <div className="w-full max-w-md rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
	            <div className="flex items-start gap-4">
	              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E7EDFF] text-[#9aed00]">
	                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(154,237,0,0.25)] border-t-[#9aed00]" />
	              </div>
	              <div className="min-w-0 flex-1">
	                <h3 className="text-lg font-semibold text-[#f7f7f8]">
	                  Preparing your streamer video
	                </h3>
	                <p className="mt-1 text-sm text-[#898a8b]">
	                  {subtitleStatus === "error"
	                    ? "Subtitle generation failed."
	                    : streamerVideoImportOverlayStage === "uploading"
	                      ? "Uploading your video to the cloud..."
	                      : streamerVideoImportOverlayStage === "preparing"
	                        ? "Building the blur layout..."
	                        : streamerVideoImportOverlayStage === "subtitles"
	                          ? "Generating subtitles..."
	                          : "Finalizing editor timeline..."}
	                </p>
	              </div>
	            </div>
	            <div className="mt-6 space-y-3 text-sm">
	              <div className="flex items-center gap-3">
	                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E7EDFF] text-[#9aed00]">
	                  {streamerVideoImportOverlayStage === "preparing" ||
	                  streamerVideoImportOverlayStage === "uploading" ? (
	                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[rgba(154,237,0,0.25)] border-t-[#9aed00]" />
	                  ) : (
	                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
	                      <path
	                        d="M20 6 9 17l-5-5"
	                        stroke="currentColor"
	                        strokeWidth="2"
	                        strokeLinecap="round"
	                        strokeLinejoin="round"
	                      />
	                    </svg>
	                  )}
	                </div>
	                <span className="text-[#f7f7f8]">Create blur layout</span>
	              </div>
	              <div className="flex items-center gap-3">
	                <div
	                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
	                    subtitleStatus === "error"
	                      ? "bg-[rgba(231,41,48,0.1)] text-[#e72930]"
	                      : "bg-[#E7EDFF] text-[#9aed00]"
	                  }`}
	                >
	                  {subtitleStatus === "error" ? (
	                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
	                      <path
	                        d="M18 6 6 18M6 6l12 12"
	                        stroke="currentColor"
	                        strokeWidth="2"
	                        strokeLinecap="round"
	                        strokeLinejoin="round"
	                      />
	                    </svg>
	                  ) : streamerVideoImportOverlayStage === "subtitles" ? (
	                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[rgba(154,237,0,0.25)] border-t-[#9aed00]" />
	                  ) : streamerVideoImportOverlayStage === "finalizing" ? (
	                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
	                      <path
	                        d="M20 6 9 17l-5-5"
	                        stroke="currentColor"
	                        strokeWidth="2"
	                        strokeLinecap="round"
	                        strokeLinejoin="round"
	                      />
	                    </svg>
	                  ) : (
	                    <div className="h-3.5 w-3.5 rounded-full border-2 border-[rgba(154,237,0,0.25)]" />
	                  )}
	                </div>
	                <span className="text-[#f7f7f8]">Generate subtitles</span>
	              </div>
	              <div className="flex items-center gap-3">
	                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E7EDFF] text-[#9aed00]">
	                  {streamerVideoImportOverlayStage === "finalizing" ? (
	                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[rgba(154,237,0,0.25)] border-t-[#9aed00]" />
	                  ) : (
	                    <div className="h-3.5 w-3.5 rounded-full border-2 border-[rgba(154,237,0,0.25)]" />
	                  )}
	                </div>
	                <span className="text-[#f7f7f8]">Finalize timeline</span>
	              </div>
	              {subtitleStatus === "error" && subtitleError ? (
	                <div className="mt-4 rounded-2xl border border-[rgba(231,41,48,0.2)] bg-[rgba(231,41,48,0.1)] px-4 py-3 text-sm text-[#e72930]">
	                  {subtitleError}
	                </div>
	              ) : null}
	              {subtitleStatus === "error" ? (
	                <div className="mt-4">
	                  <button
	                    type="button"
	                    className="w-full rounded-full bg-[#9aed00] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(51,92,255,0.28)] transition hover:brightness-105"
	                    onClick={() => setStreamerVideoImportOverlayOpen(false)}
	                  >
	                    Continue to editor
	                  </button>
	                </div>
	              ) : null}
	            </div>
	          </div>
	        </div>
	      )}
		      {redditVideoImportOverlayOpen && (
		        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#1a1c1e]/70 px-4 backdrop-blur-sm">
		          <div className="w-full max-w-md rounded-3xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
		            <div className="flex items-start gap-4">
		              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E7EDFF] text-[#9aed00]">
		                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(154,237,0,0.25)] border-t-[#9aed00]" />
		              </div>
		              <div className="min-w-0 flex-1">
		                <h3 className="text-lg font-semibold text-[#f7f7f8]">
		                  Preparing your Reddit video
		                </h3>
		                <p className="mt-1 text-sm text-[#898a8b]">
		                  {redditVideoImportError
		                    ? "Reddit video import failed."
		                    : subtitleStatus === "error"
		                      ? "Subtitle generation failed."
		                      : redditVideoImportOverlayStage === "preparing"
		                        ? "Setting up your project..."
		                        : redditVideoImportOverlayStage === "voiceover"
		                          ? "Generating voiceover and building your timeline..."
		                          : redditVideoImportOverlayStage === "subtitles"
		                            ? "Generating subtitles..."
		                            : "Finalizing editor timeline..."}
		                </p>
		              </div>
		            </div>
		            <div className="mt-6 space-y-3 text-sm">
		              <div className="flex items-center gap-3">
		                <div
		                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
		                    redditVideoImportError
		                      ? "bg-[rgba(231,41,48,0.1)] text-[#e72930]"
		                      : "bg-[#E7EDFF] text-[#9aed00]"
		                  }`}
		                >
		                  {redditVideoImportError ? (
		                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
		                      <path
		                        d="M18 6 6 18M6 6l12 12"
		                        stroke="currentColor"
		                        strokeWidth="2"
		                        strokeLinecap="round"
		                        strokeLinejoin="round"
		                      />
		                    </svg>
		                  ) : redditVideoImportOverlayStage === "preparing" ||
		                      redditVideoImportOverlayStage === "voiceover" ? (
		                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[rgba(154,237,0,0.25)] border-t-[#9aed00]" />
		                  ) : (
		                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
		                      <path
		                        d="M20 6 9 17l-5-5"
		                        stroke="currentColor"
		                        strokeWidth="2"
		                        strokeLinecap="round"
		                        strokeLinejoin="round"
		                      />
		                    </svg>
		                  )}
		                </div>
		                <span className="text-[#f7f7f8]">
		                  Generate voiceover &amp; build timeline
		                </span>
		              </div>
		              <div className="flex items-center gap-3">
		                <div
		                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
		                    subtitleStatus === "error"
		                      ? "bg-[rgba(231,41,48,0.1)] text-[#e72930]"
		                      : "bg-[#E7EDFF] text-[#9aed00]"
		                  }`}
		                >
		                  {subtitleStatus === "error" ? (
		                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
		                      <path
		                        d="M18 6 6 18M6 6l12 12"
		                        stroke="currentColor"
		                        strokeWidth="2"
		                        strokeLinecap="round"
		                        strokeLinejoin="round"
		                      />
		                    </svg>
		                  ) : redditVideoImportOverlayStage === "subtitles" ? (
		                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[rgba(154,237,0,0.25)] border-t-[#9aed00]" />
		                  ) : redditVideoImportOverlayStage === "finalizing" ? (
		                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
		                      <path
		                        d="M20 6 9 17l-5-5"
		                        stroke="currentColor"
		                        strokeWidth="2"
		                        strokeLinecap="round"
		                        strokeLinejoin="round"
		                      />
		                    </svg>
		                  ) : (
		                    <div className="h-3.5 w-3.5 rounded-full border-2 border-[rgba(154,237,0,0.25)]" />
		                  )}
		                </div>
		                <span className="text-[#f7f7f8]">Generate subtitles</span>
		              </div>
		              <div className="flex items-center gap-3">
		                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E7EDFF] text-[#9aed00]">
		                  {redditVideoImportOverlayStage === "finalizing" &&
		                  !redditVideoImportError &&
		                  subtitleStatus !== "error" ? (
		                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[rgba(154,237,0,0.25)] border-t-[#9aed00]" />
		                  ) : (
		                    <div className="h-3.5 w-3.5 rounded-full border-2 border-[rgba(154,237,0,0.25)]" />
		                  )}
		                </div>
		                <span className="text-[#f7f7f8]">Finalize timeline</span>
		              </div>
		              {redditVideoImportError ? (
		                <div className="mt-4 rounded-2xl border border-[rgba(231,41,48,0.2)] bg-[rgba(231,41,48,0.1)] px-4 py-3 text-sm text-[#e72930]">
		                  {redditVideoImportError}
		                </div>
		              ) : subtitleStatus === "error" && subtitleError ? (
		                <div className="mt-4 rounded-2xl border border-[rgba(231,41,48,0.2)] bg-[rgba(231,41,48,0.1)] px-4 py-3 text-sm text-[#e72930]">
		                  {subtitleError}
		                </div>
		              ) : null}
		              {redditVideoImportError || subtitleStatus === "error" ? (
		                <div className="mt-4">
		                  <button
		                    type="button"
		                    className="w-full rounded-full bg-[#9aed00] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(51,92,255,0.28)] transition hover:brightness-105"
		                    onClick={() => setRedditVideoImportOverlayOpen(false)}
		                  >
		                    Continue to editor
		                  </button>
		                </div>
		              ) : null}
		            </div>
		          </div>
		        </div>
		      )}
		      {exportUi.open && (
		        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
		          <div className="w-full max-w-md rounded-3xl bg-[#1a1c1e] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
		            <div className="flex items-start justify-between gap-4">
		              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E7EDFF] text-[#9aed00]">
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
                  <h3 className="text-lg font-semibold text-[#f7f7f8]">
                    {exportUi.status === "complete"
                      ? "Export ready"
                      : exportUi.status === "error"
                        ? "Export failed"
                        : "Exporting"}
                  </h3>
                  <p className="text-sm text-[#898a8b]">
                    {exportUi.stage || "Preparing export..."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#898a8b] transition hover:bg-[rgba(255,255,255,0.03)]"
                onClick={() => setExportUi((prev) => ({ ...prev, open: false }))}
              >
                Close
              </button>
            </div>
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-[#5e636e]">
                <span>Progress</span>
                <span className="text-[#898a8b]">{exportProgressPercent}%</span>
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
                <div
                  className={`h-full transition-all duration-500 ease-out ${
                    exportUi.status === "error"
                      ? "bg-[rgba(231,41,48,0.1)]0"
                      : "bg-[#9aed00]"
                  }`}
                  style={{ width: `${exportProgressPercent}%` }}
                />
              </div>
              {exportUi.error && (
                <p className="mt-3 text-sm text-[#e72930]">{exportUi.error}</p>
              )}
            </div>
            <div className="mt-6 flex items-center gap-3">
              {exportUi.status === "complete" && exportUi.downloadUrl ? (
                <button
                  type="button"
                  className="flex-1 rounded-full bg-[#9aed00] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(51,92,255,0.28)] transition hover:brightness-105"
                  onClick={() => triggerExportDownload(exportUi.downloadUrl!)}
                >
                  Download MP4
                </button>
              ) : exportUi.status === "error" ? (
                <button
                  type="button"
                  className="flex-1 rounded-full bg-[#9aed00] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(51,92,255,0.28)] transition hover:brightness-105"
                  onClick={handleStartExport}
                >
                  Try again
                </button>
              ) : (
                <button
                  type="button"
                  className="flex-1 cursor-wait rounded-full bg-[#5e636e] px-4 py-2.5 text-sm font-semibold text-white"
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
      fallback={<div className="h-screen w-full bg-[#0e1012]" />}
    >
      <AdvancedEditorContent />
    </Suspense>
  );
}
