"use client";

import type { IGif } from "@giphy/js-types";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import {
  AudioLines,
  ImageIcon,
  Mic,
  Play,
  Sparkles,
  Upload,
  Video as VideoIcon,
  type LucideIcon,
} from "lucide-react";

import { panelButtonClass, panelCardClass, speedPresets } from "../constants";

import {
  backgroundSwatches,
  mediaFilters,
  subtitleStyleFilters,
  tiktokTextBackgroundSwatches,
  textFontFamilies,
  textLetterSpacingOptions,
  textLineHeightOptions,
  textPresetTags,
  textStylePresets,
} from "../data";

import {
  clamp,
  formatDuration,
  formatSize,
  formatTimelineLabel,
  formatTimeWithTenths,
  parseTimeInput,
} from "../utils";

import {
  getPresetPreviewFontSize,
  getTextRenderStyles,
  resolveFontFamily,
  resolveGiphyPreviewUrl,
  soundFxRootPrefix,
  stockMusicRootPrefix,
  stockVideoRootPrefix,
  toRgba,
  type StockAudioTrack,
  type StockVideoItem,
} from "../page-helpers";

import type {
  MediaAsset,
  TextClipSettings,
  TextPresetGroup,
  TimelineClip,
  VideoClipSettings,
} from "../types";

import { GiphyLogo } from "./giphy-logo";
import { SliderField } from "./slider-field";
import { StockVideoCard } from "./stock-video-card";
import { ToggleSwitch } from "./toggle-switch";

type EditorSidebarProps = {
  updateClipSettings: (
    clipId: string,
    updater: (current: VideoClipSettings) => VideoClipSettings
  ) => void;
  updateTextSettings: (
    clipId: string,
    updater: (current: TextClipSettings) => TextClipSettings
  ) => void;
  selectedClipId: string | null;
  selectedClipIds?: string[];
  handleSubtitlePreview: (segment: SubtitleSegmentEntry) => void;
  setActiveTool: (tool: string) => void;
  aiBackgroundRemovalStatus?: "idle" | "loading" | "ready" | "error";
  aiBackgroundRemovalError?: string | null;
  aiBackgroundRemovalPreview?: AiBackgroundRemovalPreview | null;
  aiBackgroundRemovalSubjectIsPerson?: boolean;
  setAiBackgroundRemovalSubjectIsPerson?: (value: boolean) => void;
  aiBackgroundRemovalSelection?: AiBackgroundRemovalSelection | null;
  handleAiBackgroundRemoval?: () => void;
} & Record<string, any>;

type SubtitleSegmentEntry = {
  id: string;
  clipId: string;
  text: string;
  startTime: number;
  endTime: number;
  sourceClipId?: string | null;
  clip?: TimelineClip;
};

type AiToolInputKind = "prompt" | "dropzone";
type AiToolOutputKind = "grid" | "list" | "waveform" | "preview";

type AiToolConfig = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  inputLabel: string;
  inputPlaceholder: string;
  inputKind: AiToolInputKind;
  actionLabel: string;
  outputLabel: string;
  outputHint: string;
  outputKind: AiToolOutputKind;
  chipLabel?: string;
  chips?: string[];
};

type AiBackgroundRemovalSelection = {
  state: "empty" | "multi" | "invalid" | "ready";
  clipId?: string | null;
  label?: string | null;
  duration?: number | null;
};

type AiBackgroundRemovalPreview = {
  url?: string | null;
  assetId?: string | null;
  clipId?: string | null;
  sourceClipId?: string | null;
  name?: string | null;
  duration?: number | null;
};

type LemonSliceWidgetElement = HTMLElement & {
  sendMessage?: (message: string) => Promise<void> | void;
};

const aiToolConfigs: AiToolConfig[] = [
  {
    id: "transcription",
    title: "Transcription",
    description: "Turn audio or video into timed captions and transcripts.",
    icon: AudioLines,
    gradient: "from-emerald-50 to-teal-100",
    inputLabel: "Upload media",
    inputPlaceholder: "Drop audio or video files here",
    inputKind: "dropzone",
    actionLabel: "Generate Transcript",
    outputLabel: "Transcript",
    outputHint: "Captions and timestamps appear here.",
    outputKind: "list",
  },
  {
    id: "ai-image",
    title: "Image",
    description: "Create visuals from text prompts.",
    icon: ImageIcon,
    gradient: "from-amber-50 to-orange-100",
    inputLabel: "Prompt",
    inputPlaceholder: "Describe the image you want to create...",
    inputKind: "prompt",
    actionLabel: "Generate Image",
    outputLabel: "Generated Image",
    outputHint: "Generated images show up here.",
    outputKind: "grid",
  },
  {
    id: "ai-voiceover",
    title: "Voiceover",
    description: "Turn scripts into natural voiceovers.",
    icon: Mic,
    gradient: "from-sky-50 to-blue-100",
    inputLabel: "Script",
    inputPlaceholder: "Paste or write the voiceover script...",
    inputKind: "prompt",
    actionLabel: "Generate Voiceover",
    outputLabel: "Voiceover Preview",
    outputHint: "Generated voiceovers appear here.",
    outputKind: "waveform",
  },
  {
    id: "ai-video",
    title: "Video",
    description: "Generate short clips from a prompt.",
    icon: VideoIcon,
    gradient: "from-violet-50 to-fuchsia-100",
    inputLabel: "Scene prompt",
    inputPlaceholder: "Describe the scene, motion, and mood...",
    inputKind: "prompt",
    actionLabel: "Generate Video",
    outputLabel: "Generated Clip",
    outputHint: "Clips are added to your timeline automatically.",
    outputKind: "preview",
  },
  {
    id: "ai-background-removal",
    title: "Background Removal",
    description: "Remove the background from a selected clip.",
    icon: Sparkles,
    gradient: "from-lime-50 to-green-100",
    inputLabel: "Clip",
    inputPlaceholder: "Select a clip on the timeline",
    inputKind: "dropzone",
    actionLabel: "Remove Background",
    outputLabel: "Result",
    outputHint: "The new clip is added to your timeline.",
    outputKind: "preview",
  },
  {
    id: "ai-deven",
    title: "AI Deven",
    description: "YouTube expert for hooks, titles, scripts, and strategy.",
    icon: Play,
    gradient: "from-red-50 to-rose-100",
    inputLabel: "Ask AI Deven",
    inputPlaceholder: "Ask about hooks, titles, pacing, or thumbnails...",
    inputKind: "prompt",
    actionLabel: "Open AI Deven",
    outputLabel: "Insights",
    outputHint: "AI Deven replies in the chat widget below.",
    outputKind: "list",
    chipLabel: "Quick prompts",
    chips: ["Hooks", "Titles", "Thumbnails", "Retention"],
  },
];

const aiWaveformHeights = [8, 14, 10, 18, 12, 20, 11, 16, 9, 15];
const aiListWidths = [92, 78, 64];
const aiImageAspectRatioOptions = [
  { value: "1:1", label: "1:1 - Square" },
  { value: "16:9", label: "16:9 - YouTube / Widescreen" },
  { value: "21:9", label: "21:9 - Cinematic" },
  { value: "4:3", label: "4:3 - Classic" },
  { value: "3:2", label: "3:2 - Photo" },
  { value: "2:3", label: "2:3 - Portrait Photo" },
  { value: "3:4", label: "3:4 - Poster" },
  { value: "9:16", label: "9:16 - Reels / TikTok" },
  { value: "9:21", label: "9:21 - Stories" },
];

const aiVideoAspectRatioOptions = [
  { value: "16:9", label: "16:9 - Widescreen" },
  { value: "9:16", label: "9:16 - Vertical" },
];

const aiVideoDurationOptions = [
  { value: 4, label: "4s" },
  { value: 6, label: "6s" },
  { value: 8, label: "8s" },
];

const lemonSliceWidgetScriptSrc =
  "https://unpkg.com/@lemonsliceai/lemon-slice-widget";
const lemonSliceWidgetScriptId = "lemon-slice-widget-script";

export const EditorSidebar = memo((props: EditorSidebarProps) => {
  const {
    activeAssetId,
    activeTool,
    activeToolLabel,
    contentAspectRatio,
    contentTimelineTotal,
    applySubtitleStyle,
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
    handleGenerateSubtitles,
    handleGenerateTranscript,
    handleClearTranscript,
    handleReplaceVideo,
    handleSetEndAtPlayhead,
    handleSetStartAtPlayhead,
    handleStartTimeCommit,
    handleSubtitleAddLine,
    handleSubtitlePreview,
    handleSubtitleDelete,
    handleSubtitleDeleteAll,
    handleSubtitleDetachToggle,
    handleSubtitleShiftAll,
    handleSubtitleStyleUpdate,
    handleSubtitleTextUpdate,
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
    handleProjectBackgroundImageChange,
    handleProjectBackgroundImageClear,
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
    setActiveTool,
    setAssetFilter,
    setAssetSearch,
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
    setProjectBackgroundMode,
    setProjectDurationMode,
    setProjectDurationSeconds,
    setProjectSizeId,
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
    setSubtitleActiveTab,
    setSubtitleLanguage,
    setSubtitleSource,
    setSubtitleStyleFilter,
    setSubtitleMoveTogether,
    setTranscriptSource,
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
    subtitleLanguageOptions,
    subtitleSegments,
    subtitleSource,
    subtitleSourceOptions,
    subtitleStatus,
    subtitleStyleFilter,
    subtitleStyleId,
    subtitleStylePresets,
    detachedSubtitleIds,
    subtitleMoveTogether,
    transcriptSegments: transcriptSegmentsRaw,
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
  } = props;

  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const rowMenuRef = useRef<HTMLDivElement | null>(null);
  const settingsSizeButtonRef = useRef<HTMLButtonElement | null>(null);
  const settingsSizeMenuRef = useRef<HTMLDivElement | null>(null);
  const backgroundImageInputRef = useRef<HTMLInputElement | null>(null);
  const lemonSliceWidgetRef = useRef<LemonSliceWidgetElement | null>(null);
  const aiDevenActivationRef = useRef<"idle" | "loading" | "ready">("idle");
  const transcriptCopyTimeoutRef = useRef<number | null>(null);
  const [subtitleProgress, setSubtitleProgress] = useState(0);
  const [subtitleSettingsOpen, setSubtitleSettingsOpen] = useState(false);
  const [settingsSizeOpen, setSettingsSizeOpen] = useState(false);
  const [durationDraft, setDurationDraft] = useState(() =>
    formatTimeWithTenths(projectDurationSeconds ?? 0)
  );
  const [isDurationEditing, setIsDurationEditing] = useState(false);
  const [backgroundHexDraft, setBackgroundHexDraft] = useState(videoBackground);
  const [activeAiToolId, setActiveAiToolId] = useState<string | null>(null);
  const [aiDevenStatus, setAiDevenStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [isAiTranscriptSourceOpen, setIsAiTranscriptSourceOpen] = useState(false);
  const [includeAiTranscriptTimestamps, setIncludeAiTranscriptTimestamps] =
    useState(true);
  const [isTranscriptCopied, setIsTranscriptCopied] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [transcriptHasEdits, setTranscriptHasEdits] = useState(false);
  const [subtitleRowMenu, setSubtitleRowMenu] = useState<{
    open: boolean;
    segmentId: string | null;
    x: number;
    y: number;
  }>({
    open: false,
    segmentId: null,
    x: 0,
    y: 0,
  });
  const [showSubtitleTimings, setShowSubtitleTimings] = useState(false);
  const [shiftTimingsOpen, setShiftTimingsOpen] = useState(false);
  const [shiftSeconds, setShiftSeconds] = useState("0.0");
  const [subtitleStyleEditorOpen, setSubtitleStyleEditorOpen] = useState(false);
  const [subtitleStyleEditorId, setSubtitleStyleEditorId] = useState<string | null>(
    null
  );
  const [subtitleStyleDraft, setSubtitleStyleDraft] = useState<TextClipSettings | null>(
    null
  );
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeLocation, setYoutubeLocation] = useState("US");
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [tiktokError, setTiktokError] = useState<string | null>(null);
  const [tiktokLoading, setTiktokLoading] = useState(false);
  const [isAssetGridSmUp, setIsAssetGridSmUp] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return window.matchMedia("(min-width: 640px)").matches;
  });
  const downloadLoader = (
    <div className="flex items-center justify-center py-6">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-2 border-gray-200/70" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#5E81AC] border-r-[#5E81AC]" />
      </div>
      <span className="sr-only">Downloading...</span>
    </div>
  );

  const loadLemonSliceWidget = useCallback(async () => {
    if (typeof window === "undefined") {
      return false;
    }
    if (window.customElements?.get("lemon-slice-widget")) {
      return true;
    }
    const existingScript = document.getElementById(
      lemonSliceWidgetScriptId
    ) as HTMLScriptElement | null;
    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        return true;
      }
      const loaded = await new Promise<boolean>((resolve) => {
        const handleLoad = () => {
          existingScript.dataset.loaded = "true";
          resolve(true);
        };
        const handleError = () => resolve(false);
        existingScript.addEventListener("load", handleLoad, { once: true });
        existingScript.addEventListener("error", handleError, { once: true });
      });
      if (!loaded) {
        return false;
      }
    } else {
      const loaded = await new Promise<boolean>((resolve) => {
        const script = document.createElement("script");
        script.id = lemonSliceWidgetScriptId;
        script.type = "module";
        script.src = lemonSliceWidgetScriptSrc;
        script.addEventListener(
          "load",
          () => {
            script.dataset.loaded = "true";
            resolve(true);
          },
          { once: true }
        );
        script.addEventListener(
          "error",
          () => {
            resolve(false);
          },
          { once: true }
        );
        document.body.appendChild(script);
      });
      if (!loaded) {
        return false;
      }
    }
    if (window.customElements?.get("lemon-slice-widget")) {
      return true;
    }
    if (window.customElements?.whenDefined) {
      await window.customElements.whenDefined("lemon-slice-widget");
    }
    return Boolean(window.customElements?.get("lemon-slice-widget"));
  }, []);

  const handleAiDevenActivate = useCallback(async () => {
    if (aiDevenActivationRef.current === "loading") {
      return;
    }
    if (aiDevenActivationRef.current === "ready") {
      const widget = lemonSliceWidgetRef.current;
      if (widget && typeof widget.sendMessage === "function") {
        try {
          await widget.sendMessage("hey");
        } catch {
          // Ignore activation errors; the widget can still be used manually.
        }
      }
      setAiDevenStatus("ready");
      return;
    }
    aiDevenActivationRef.current = "loading";
    setAiDevenStatus("loading");
    const loaded = await loadLemonSliceWidget();
    if (!loaded) {
      aiDevenActivationRef.current = "idle";
      setAiDevenStatus("error");
      return;
    }
    aiDevenActivationRef.current = "ready";
    setAiDevenStatus("ready");
    const widget = lemonSliceWidgetRef.current;
    if (widget && typeof widget.sendMessage === "function") {
      try {
        await widget.sendMessage("hey");
      } catch {
        // Ignore activation errors; the widget can still be used manually.
      }
    }
  }, [loadLemonSliceWidget]);

  const handleYoutubeSubmit = async () => {
    if (typeof handleAddYoutubeVideo !== "function") {
      return;
    }
    const trimmedUrl = youtubeUrl.trim();
    if (!trimmedUrl) {
      setYoutubeError("Paste a YouTube link.");
      return;
    }
    setYoutubeError(null);
    setYoutubeLoading(true);
    try {
      const location = youtubeLocation.trim().toUpperCase();
      await handleAddYoutubeVideo({
        url: trimmedUrl,
        location: location.length > 0 ? location : undefined,
      });
      setYoutubeUrl("");
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Unable to download video.";
      setYoutubeError(message);
    } finally {
      setYoutubeLoading(false);
    }
  };

  const handleTiktokSubmit = async () => {
    if (typeof handleAddTiktokVideo !== "function") {
      return;
    }
    const trimmedUrl = tiktokUrl.trim();
    if (!trimmedUrl) {
      setTiktokError("Paste a TikTok link.");
      return;
    }
    setTiktokError(null);
    setTiktokLoading(true);
    try {
      await handleAddTiktokVideo({
        url: trimmedUrl,
      });
      setTiktokUrl("");
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Unable to download video.";
      setTiktokError(message);
    } finally {
      setTiktokLoading(false);
    }
  };


  useEffect(() => {
    if (subtitleStatus !== "loading") {
      setSubtitleProgress(0);
      return;
    }
    setSubtitleProgress(0.12);
    const interval = window.setInterval(() => {
      setSubtitleProgress((prev) => {
        const next = prev + (1 - prev) * 0.16;
        return next > 0.95 ? 0.95 : next;
      });
    }, 240);
    return () => window.clearInterval(interval);
  }, [subtitleStatus]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (subtitleSettingsOpen) {
        const menu = settingsMenuRef.current;
        const button = settingsButtonRef.current;
        if (menu?.contains(target) || button?.contains(target)) {
          return;
        }
        setSubtitleSettingsOpen(false);
      }
      if (subtitleRowMenu.open) {
        const menu = rowMenuRef.current;
        if (menu?.contains(target)) {
          return;
        }
        setSubtitleRowMenu((prev) =>
          prev.open
            ? { ...prev, open: false, segmentId: null }
            : prev
        );
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [subtitleRowMenu.open, subtitleSettingsOpen]);

  useEffect(() => {
    if (!settingsSizeOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const menu = settingsSizeMenuRef.current;
      const button = settingsSizeButtonRef.current;
      if (menu?.contains(target) || button?.contains(target)) {
        return;
      }
      setSettingsSizeOpen(false);
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [settingsSizeOpen]);

  useEffect(() => {
    if (isDurationEditing) {
      return;
    }
    const nextValue = Number.isFinite(projectDurationSeconds)
      ? projectDurationSeconds
      : 0;
    setDurationDraft(formatTimeWithTenths(nextValue));
  }, [isDurationEditing, projectDurationSeconds]);

  useEffect(() => {
    setBackgroundHexDraft(videoBackground);
  }, [videoBackground]);

  useEffect(() => {
    if (activeTool !== "ai") {
      setActiveAiToolId(null);
    }
  }, [activeTool]);

  useEffect(() => {
    if (activeAiToolId !== "ai-deven") {
      return;
    }
    void handleAiDevenActivate();
  }, [activeAiToolId, handleAiDevenActivate]);

  useEffect(() => {
    return () => {
      if (transcriptCopyTimeoutRef.current) {
        window.clearTimeout(transcriptCopyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mediaQuery = window.matchMedia("(min-width: 640px)");
    const handleChange = () => setIsAssetGridSmUp(mediaQuery.matches);
    handleChange();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const openSubtitleRowMenu = (
    event: ReactMouseEvent<HTMLButtonElement>,
    segmentId: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 200;
    const menuHeight = 150;
    const nextX = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12);
    const nextY = Math.min(rect.bottom + 8, window.innerHeight - menuHeight - 12);
    setSubtitleSettingsOpen(false);
    setSubtitleRowMenu({
      open: true,
      segmentId,
      x: Math.max(12, nextX),
      y: Math.max(12, nextY),
    });
  };

  const handleShiftSubmit = () => {
    const value = Number(shiftSeconds);
    if (!Number.isFinite(value)) {
      return;
    }
    handleSubtitleShiftAll(value);
    setShiftTimingsOpen(false);
  };

  const subtitleStyleSampleText = "The quick brown";
  const recentStylePreset =
    subtitleStylePresets.find(
      (preset: { id: string }) => preset.id === subtitleStyleId
    ) ?? subtitleStylePresets[0];
  const recentStylePreview = useMemo(() => {
    if (!recentStylePreset) {
      return null;
    }
    const previewSettings: TextClipSettings = {
      ...fallbackTextSettings,
      ...recentStylePreset.settings,
      fontFamily: recentStylePreset.preview?.fontFamily ?? "Inter",
      fontSize: recentStylePreset.preview?.fontSize ?? 22,
      bold: recentStylePreset.preview?.bold ?? true,
      italic: recentStylePreset.preview?.italic ?? false,
      text: recentStylePreset.preview?.text ?? "Recent style",
      align: "center",
    };
    return getTextRenderStyles(previewSettings);
  }, [fallbackTextSettings, recentStylePreset]);
  const subtitleStyleDraftPreview = useMemo(() => {
    if (!subtitleStyleDraft) {
      return null;
    }
    return getTextRenderStyles({
      ...subtitleStyleDraft,
      align: "center",
    });
  }, [subtitleStyleDraft]);
  const subtitleStyleEditorPreset = useMemo(() => {
    if (!subtitleStyleEditorId) {
      return null;
    }
    return (
      subtitleStylePresets.find(
        (preset: { id: string }) => preset.id === subtitleStyleEditorId
      ) ?? null
    );
  }, [subtitleStyleEditorId, subtitleStylePresets]);

  const buildSubtitleStyleDraft = (preset: typeof subtitleStylePresets[number]) => {
    const baseDraft = {
      ...fallbackTextSettings,
      ...preset.settings,
      text: subtitleStyleSampleText,
      fontFamily: preset.preview?.fontFamily ?? fallbackTextSettings.fontFamily,
      fontSize: preset.preview?.fontSize ?? fallbackTextSettings.fontSize,
      bold: preset.preview?.bold ?? fallbackTextSettings.bold,
      italic: preset.preview?.italic ?? fallbackTextSettings.italic,
      align: "center",
    };
    const beatEnabled = (baseDraft as any)?.subtitleBeatEnabled !== false;
    const beatMinWords =
      typeof (baseDraft as any)?.subtitleBeatMinWords === "number" &&
      Number.isFinite((baseDraft as any).subtitleBeatMinWords)
        ? Math.max(1, Math.floor((baseDraft as any).subtitleBeatMinWords))
        : 2;
    const beatMaxWords =
      typeof (baseDraft as any)?.subtitleBeatMaxWords === "number" &&
      Number.isFinite((baseDraft as any).subtitleBeatMaxWords)
        ? Math.max(beatMinWords, Math.floor((baseDraft as any).subtitleBeatMaxWords))
        : Math.max(beatMinWords, 2);
    const beatMaxSpanSeconds =
      typeof (baseDraft as any)?.subtitleBeatMaxSpanSeconds === "number" &&
      Number.isFinite((baseDraft as any).subtitleBeatMaxSpanSeconds)
        ? (baseDraft as any).subtitleBeatMaxSpanSeconds
        : 1.2;
    const beatLongPauseSeconds =
      typeof (baseDraft as any)?.subtitleBeatLongPauseSeconds === "number" &&
      Number.isFinite((baseDraft as any).subtitleBeatLongPauseSeconds)
        ? (baseDraft as any).subtitleBeatLongPauseSeconds
        : 0.25;
    const beatEnterSeconds =
      typeof (baseDraft as any)?.subtitleBeatEnterSeconds === "number" &&
      Number.isFinite((baseDraft as any).subtitleBeatEnterSeconds)
        ? (baseDraft as any).subtitleBeatEnterSeconds
        : 0.17;
    return {
      ...baseDraft,
      subtitleBeatEnabled: beatEnabled,
      subtitleBeatMinWords: beatMinWords,
      subtitleBeatMaxWords: beatMaxWords,
      subtitleBeatMaxSpanSeconds: beatMaxSpanSeconds,
      subtitleBeatLongPauseSeconds: beatLongPauseSeconds,
      subtitleBeatAnimate: (baseDraft as any)?.subtitleBeatAnimate !== false,
      subtitleBeatEnterSeconds: beatEnterSeconds,
    };
  };

  const updateSubtitleStyleDraft = (nextDraft: TextClipSettings) => {
    setSubtitleStyleDraft(nextDraft);
    if (!subtitleStyleEditorId) {
      return;
    }
    const { text: _text, autoSize: _autoSize, ...settings } = nextDraft;
    handleSubtitleStyleUpdate(subtitleStyleEditorId, settings, {
      fontFamily: nextDraft.fontFamily,
      fontSize: nextDraft.fontSize,
      bold: nextDraft.bold,
      italic: nextDraft.italic,
      text:
        subtitleStyleEditorPreset?.preview?.text ??
        subtitleStyleEditorPreset?.name ??
        "Style",
    });
  };

  const openSubtitleStyleEditor = (
    preset: typeof subtitleStylePresets[number]
  ) => {
    setSubtitleStyleEditorId(preset.id);
    setSubtitleStyleDraft(buildSubtitleStyleDraft(preset));
    setSubtitleStyleEditorOpen(true);
  };

  const closeSubtitleStyleEditor = () => {
    setSubtitleStyleEditorOpen(false);
    setSubtitleStyleEditorId(null);
    setSubtitleStyleDraft(null);
  };

  const handleSubtitleStyleSelect = (
    preset: typeof subtitleStylePresets[number]
  ) => {
    applySubtitleStyle(preset.id);
  };

  const handleSubtitleStyleKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    preset: typeof subtitleStylePresets[number]
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSubtitleStyleSelect(preset);
    }
  };

  const activeSubtitleMenuSegment = subtitleRowMenu.segmentId
    ? subtitleSegments.find(
        (segment: { id: string }) => segment.id === subtitleRowMenu.segmentId
      ) ?? null
    : null;
  const selectedSubtitleClipId = useMemo(() => {
    if (!selectedClipId) {
      return null;
    }
    return subtitleSegments.some(
      (segment: { clipId: string }) => segment.clipId === selectedClipId
    )
      ? selectedClipId
      : null;
  }, [selectedClipId, subtitleSegments]);
  const groupToggleChecked = selectedSubtitleClipId
    ? subtitleMoveTogether &&
      !detachedSubtitleIds?.has(selectedSubtitleClipId)
    : subtitleMoveTogether;
  const handleGroupToggle = (next: boolean) => {
    if (selectedSubtitleClipId) {
      if (!subtitleMoveTogether) {
        setSubtitleMoveTogether(true);
      }
      const isDetached = detachedSubtitleIds?.has(selectedSubtitleClipId);
      if (next && isDetached) {
        handleSubtitleDetachToggle(selectedSubtitleClipId);
      } else if (!next && !isDetached) {
        handleSubtitleDetachToggle(selectedSubtitleClipId);
      }
      return;
    }
    setSubtitleMoveTogether(next);
  };

  const isSelectedSubtitleClip = useMemo(() => {
    if (!selectedTextEntry) {
      return false;
    }
    return subtitleSegments.some(
      (segment: { clipId: string }) => segment.clipId === selectedTextEntry.clip.id
    );
  }, [selectedTextEntry, subtitleSegments]);

  const formatAspectRatioLabel = useCallback((ratio?: number | null) => {
    if (!Number.isFinite(ratio) || (ratio ?? 0) <= 0) {
      return "--";
    }
    const candidates = [
      { label: "9:16", value: 9 / 16 },
      { label: "16:9", value: 16 / 9 },
      { label: "1:1", value: 1 },
      { label: "4:5", value: 4 / 5 },
      { label: "5:4", value: 5 / 4 },
      { label: "3:4", value: 3 / 4 },
      { label: "4:3", value: 4 / 3 },
      { label: "3:2", value: 3 / 2 },
      { label: "2:3", value: 2 / 3 },
      { label: "21:9", value: 21 / 9 },
      { label: "9:21", value: 9 / 21 },
    ];
    const ratioValue = ratio ?? 0;
    const best = candidates.reduce((winner, candidate) => {
      return Math.abs(candidate.value - ratioValue) <
        Math.abs(winner.value - ratioValue)
        ? candidate
        : winner;
    });
    if (Math.abs(best.value - ratioValue) < 0.02) {
      return best.label;
    }
    if (ratioValue >= 1) {
      return `${ratioValue.toFixed(2)}:1`;
    }
    return `1:${(1 / ratioValue).toFixed(2)}`;
  }, []);

  const resolvedProjectSize = useMemo(() => {
    if (!Array.isArray(projectSizeOptions) || projectSizeOptions.length === 0) {
      return null;
    }
    return (
      projectSizeOptions.find((option: { id: string }) => option.id === projectSizeId) ??
      projectSizeOptions[0]
    );
  }, [projectSizeId, projectSizeOptions]);

  const selectedSizeRatioLabel = useMemo(() => {
    if (!resolvedProjectSize) {
      return formatAspectRatioLabel(contentAspectRatio);
    }
    if (resolvedProjectSize.id === "original") {
      return formatAspectRatioLabel(contentAspectRatio);
    }
    return formatAspectRatioLabel(resolvedProjectSize.aspectRatio ?? projectAspectRatio);
  }, [
    contentAspectRatio,
    formatAspectRatioLabel,
    projectAspectRatio,
    resolvedProjectSize,
  ]);

  const isFixedDurationShort = useMemo(() => {
    if (projectDurationMode !== "fixed") {
      return false;
    }
    if (!Number.isFinite(projectDurationSeconds) || projectDurationSeconds <= 0) {
      return false;
    }
    return projectDurationSeconds < contentTimelineTotal - 0.05;
  }, [contentTimelineTotal, projectDurationMode, projectDurationSeconds]);
  const isBackgroundColorMode = projectBackgroundMode === "color";
  const isBackgroundImageMode = projectBackgroundMode === "image";

  const normalizeHexColor = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const normalized = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized)) {
      return normalized.toUpperCase();
    }
    return null;
  }, []);

  const commitDurationDraft = useCallback(
    (value: string) => {
      const parsed = parseTimeInput(value);
      if (parsed == null) {
        const fallback = Number.isFinite(projectDurationSeconds)
          ? projectDurationSeconds
          : 0;
        setDurationDraft(formatTimeWithTenths(fallback));
        return;
      }
      const next = Math.max(0.1, parsed);
      setProjectDurationSeconds(next);
      setDurationDraft(formatTimeWithTenths(next));
    },
    [projectDurationSeconds, setProjectDurationSeconds]
  );

  const handleDurationModeChange = useCallback(
    (mode: "automatic" | "fixed") => {
      if (mode === "fixed") {
        const currentValue =
          Number.isFinite(projectDurationSeconds) && projectDurationSeconds > 0
            ? projectDurationSeconds
            : Math.max(1, contentTimelineTotal);
        setProjectDurationSeconds(currentValue);
        setDurationDraft(formatTimeWithTenths(currentValue));
      }
      setProjectDurationMode(mode);
    },
    [
      contentTimelineTotal,
      projectDurationSeconds,
      setProjectDurationMode,
      setProjectDurationSeconds,
    ]
  );

  const isAudioTool = activeTool === "audio";
  const isAiTool = activeTool === "ai";
  const isSettingsTool = activeTool === "settings";
  const hidePrimaryUploadHeader =
    isAssetLibraryExpanded && (activeTool === "video" || activeTool === "image");
  const useAudioLibraryLayout = isAudioTool && !isAssetLibraryExpanded;
  const assetGridRowLimit = 3;
  const assetGridColumnCount = isAssetGridSmUp ? 3 : 2;
  const assetGridLimit = assetGridRowLimit * assetGridColumnCount;
  const visibleAssetGridItems = useMemo(() => {
    if (filteredAssets.length <= assetGridLimit) {
      return filteredAssets;
    }
    const capped = filteredAssets.slice(0, assetGridLimit);
    if (
      !activeAssetId ||
      capped.some((asset: MediaAsset) => asset.id === activeAssetId)
    ) {
      return capped;
    }
    const activeAsset = filteredAssets.find(
      (asset: MediaAsset) => asset.id === activeAssetId
    );
    if (!activeAsset) {
      return capped;
    }
    const next = capped.slice(0, Math.max(0, capped.length - 1));
    next.push(activeAsset);
    return next;
  }, [activeAssetId, assetGridLimit, filteredAssets]);
  const activeAiTool = useMemo(
    () => aiToolConfigs.find((tool) => tool.id === activeAiToolId) ?? null,
    [activeAiToolId]
  );
  const ActiveAiToolIcon = activeAiTool?.icon ?? null;
  const isAiDevenActive = activeAiTool?.id === "ai-deven";
  const activeAiToolInputId = activeAiTool
    ? `ai-tool-${activeAiTool.id}-input`
    : null;
  const resolvedAiImagePrompt =
    typeof aiImagePrompt === "string" ? aiImagePrompt : "";
  const resolvedAiImageAspectRatio =
    typeof aiImageAspectRatio === "string" ? aiImageAspectRatio : "1:1";
  const resolvedAiImageStatus =
    typeof aiImageStatus === "string" ? aiImageStatus : "idle";
  const resolvedAiImagePreview =
    aiImagePreview && typeof aiImagePreview === "object" ? aiImagePreview : null;
  const resolvedAiImageAssetId =
    typeof resolvedAiImagePreview?.assetId === "string"
      ? resolvedAiImagePreview.assetId
      : null;
  const resolvedAiImagePreviewUrl =
    typeof resolvedAiImagePreview?.url === "string"
      ? resolvedAiImagePreview.url
      : null;
  const isAiImageMagicDisabled =
    aiImageMagicLoading || resolvedAiImagePrompt.trim().length === 0;
  const aiImageMagicButtonClass = aiImageMagicLoading
    ? "cursor-wait bg-gray-100 text-gray-400"
    : isAiImageMagicDisabled
      ? "cursor-not-allowed bg-gray-100 text-gray-400"
      : "bg-white text-gray-600 hover:bg-gray-50";
  const canGenerateAiImage =
    resolvedAiImagePrompt.trim().length > 0 &&
    resolvedAiImageStatus !== "loading";
  const resolvedAiVideoPrompt =
    typeof aiVideoPrompt === "string" ? aiVideoPrompt : "";
  const resolvedAiVideoAspectRatio =
    typeof aiVideoAspectRatio === "string" ? aiVideoAspectRatio : "16:9";
  const resolvedAiVideoDuration =
    typeof aiVideoDuration === "number" &&
    Number.isFinite(aiVideoDuration) &&
    [4, 6, 8].includes(aiVideoDuration)
      ? aiVideoDuration
      : 8;
  const resolvedAiVideoGenerateAudio =
    typeof aiVideoGenerateAudio === "boolean" ? aiVideoGenerateAudio : true;
  const resolvedAiVideoStatus =
    typeof aiVideoStatus === "string" ? aiVideoStatus : "idle";
  const resolvedAiVideoPreview =
    aiVideoPreview && typeof aiVideoPreview === "object" ? aiVideoPreview : null;
  const resolvedAiVideoAssetId =
    typeof resolvedAiVideoPreview?.assetId === "string"
      ? resolvedAiVideoPreview.assetId
      : null;
  const isAiVideoMagicDisabled =
    aiVideoMagicLoading || resolvedAiVideoPrompt.trim().length === 0;
  const aiVideoMagicButtonClass = aiVideoMagicLoading
    ? "cursor-wait bg-gray-100 text-gray-400"
    : isAiVideoMagicDisabled
      ? "cursor-not-allowed bg-gray-100 text-gray-400"
      : "bg-white text-gray-600 hover:bg-gray-50";
  const canGenerateAiVideo =
    resolvedAiVideoPrompt.trim().length > 0 &&
    resolvedAiVideoStatus !== "loading";
  const resolvedAiBackgroundRemovalStatus =
    typeof aiBackgroundRemovalStatus === "string" ? aiBackgroundRemovalStatus : "idle";
  const resolvedAiBackgroundRemovalError =
    typeof aiBackgroundRemovalError === "string" ? aiBackgroundRemovalError : null;
  const emptyBackgroundRemovalSelection: AiBackgroundRemovalSelection = {
    state: "empty",
  };
  const resolvedAiBackgroundRemovalSelection: AiBackgroundRemovalSelection =
    aiBackgroundRemovalSelection && typeof aiBackgroundRemovalSelection === "object"
      ? aiBackgroundRemovalSelection
      : emptyBackgroundRemovalSelection;
  const resolvedAiBackgroundRemovalPreview =
    aiBackgroundRemovalPreview && typeof aiBackgroundRemovalPreview === "object"
      ? (aiBackgroundRemovalPreview as AiBackgroundRemovalPreview)
      : null;
  const resolvedAiBackgroundRemovalSubjectIsPerson =
    typeof aiBackgroundRemovalSubjectIsPerson === "boolean"
      ? aiBackgroundRemovalSubjectIsPerson
      : true;
  const backgroundRemovalDuration =
    typeof resolvedAiBackgroundRemovalSelection.duration === "number" &&
    Number.isFinite(resolvedAiBackgroundRemovalSelection.duration)
      ? resolvedAiBackgroundRemovalSelection.duration
      : null;
  const backgroundRemovalSelectionMessage =
    resolvedAiBackgroundRemovalSelection.state === "multi"
      ? "Select one clip."
      : resolvedAiBackgroundRemovalSelection.state === "invalid"
        ? "Select a video clip."
        : "Select a clip.";
  const canRemoveBackground =
    resolvedAiBackgroundRemovalSelection.state === "ready" &&
    resolvedAiBackgroundRemovalStatus !== "loading";
  const showBackgroundRemovalAdded =
    resolvedAiBackgroundRemovalStatus === "ready" &&
    typeof resolvedAiBackgroundRemovalSelection.clipId === "string" &&
    (resolvedAiBackgroundRemovalPreview?.clipId ===
      resolvedAiBackgroundRemovalSelection.clipId ||
      resolvedAiBackgroundRemovalPreview?.sourceClipId ===
        resolvedAiBackgroundRemovalSelection.clipId);
  const resolvedAiVoiceoverScript =
    typeof aiVoiceoverScript === "string" ? aiVoiceoverScript : "";
  const resolvedAiVoiceoverStatus =
    typeof aiVoiceoverStatus === "string" ? aiVoiceoverStatus : "idle";
  const resolvedAiVoiceoverPreview =
    aiVoiceoverPreview && typeof aiVoiceoverPreview === "object"
      ? aiVoiceoverPreview
      : null;
  const resolvedAiVoiceoverAssetId =
    typeof resolvedAiVoiceoverPreview?.assetId === "string"
      ? resolvedAiVoiceoverPreview.assetId
      : null;
  const resolvedAiVoiceoverPreviewUrl =
    typeof resolvedAiVoiceoverPreview?.url === "string"
      ? resolvedAiVoiceoverPreview.url
      : null;
  const resolvedAiVoiceoverSelectedVoice =
    typeof aiVoiceoverSelectedVoice === "string" ? aiVoiceoverSelectedVoice : "";
  const resolvedAiVoiceoverVoices = Array.isArray(aiVoiceoverVoices)
    ? aiVoiceoverVoices
    : [];
  const canGenerateAiVoiceover =
    resolvedAiVoiceoverScript.trim().length > 0 &&
    resolvedAiVoiceoverStatus !== "loading" &&
    (resolvedAiVoiceoverSelectedVoice.length > 0 ||
      resolvedAiVoiceoverVoices.length > 0);
  const aiTranscriptSegments = useMemo(() => {
    if (!Array.isArray(transcriptSegmentsRaw) || transcriptSegmentsRaw.length === 0) {
      return [];
    }
    if (transcriptSource === "project") {
      return [...transcriptSegmentsRaw].sort(
        (a, b) => a.startTime - b.startTime || a.endTime - b.endTime
      );
    }
    return transcriptSegmentsRaw
      .filter((segment) => segment.sourceClipId === transcriptSource)
      .sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime);
  }, [transcriptSegmentsRaw, transcriptSource]);
  const transcriptSourceStartTime = useMemo(() => {
    if (transcriptSource === "project") {
      return 0;
    }
    const sourceOption = transcriptSourceOptions?.find(
      (option: any) => option.id === transcriptSource
    );
    const start = Number(sourceOption?.startTime);
    return Number.isFinite(start) ? start : 0;
  }, [transcriptSource, transcriptSourceOptions]);
  const generatedTranscriptText = useMemo(() => {
    if (aiTranscriptSegments.length === 0) {
      return "";
    }
    return aiTranscriptSegments
      .map((segment) => {
        const text = segment.text?.trim();
        if (!text) {
          return "";
        }
        if (!includeAiTranscriptTimestamps) {
          return text;
        }
        const timestamp = formatTimelineLabel(
          Math.max(0, segment.startTime - transcriptSourceStartTime)
        );
        return `[${timestamp}] ${text}`;
      })
      .filter(Boolean)
      .join("\n");
  }, [
    includeAiTranscriptTimestamps,
    aiTranscriptSegments,
    transcriptSourceStartTime,
  ]);
  const transcriptFileName = useMemo(() => {
    const sourceOption = transcriptSourceOptions?.find(
      (option: any) => option.id === transcriptSource
    );
    const baseLabel =
      typeof sourceOption?.label === "string" ? sourceOption.label : "transcript";
    const safeLabel = baseLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const dateTag = new Date().toISOString().slice(0, 10);
    return `${safeLabel || "transcript"}-${dateTag}.txt`;
  }, [transcriptSource, transcriptSourceOptions]);
  const resolvedTranscriptSource = useMemo(() => {
    if (
      !Array.isArray(transcriptSourceOptions) ||
      transcriptSourceOptions.length === 0
    ) {
      return {
        id: "project",
        label: "Full project",
        duration: 0,
        kind: "project",
      };
    }
    return (
      transcriptSourceOptions.find(
        (option: any) => option.id === transcriptSource
      ) ?? transcriptSourceOptions[0]
    );
  }, [transcriptSource, transcriptSourceOptions]);
  useEffect(() => {
    if (transcriptStatus === "loading") {
      return;
    }
    if (!generatedTranscriptText) {
      setTranscriptDraft("");
      setTranscriptHasEdits(false);
      return;
    }
    if (!transcriptHasEdits) {
      setTranscriptDraft(generatedTranscriptText);
    }
  }, [generatedTranscriptText, transcriptHasEdits, transcriptStatus]);
  useEffect(() => {
    setTranscriptHasEdits(false);
    setTranscriptDraft(generatedTranscriptText);
  }, [transcriptSource]);
  const handleCopyTranscript = useCallback(async () => {
    if (!transcriptDraft.trim()) {
      return;
    }
    try {
      await navigator.clipboard.writeText(transcriptDraft);
      setIsTranscriptCopied(true);
      if (transcriptCopyTimeoutRef.current) {
        window.clearTimeout(transcriptCopyTimeoutRef.current);
      }
      transcriptCopyTimeoutRef.current = window.setTimeout(() => {
        setIsTranscriptCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy transcript", error);
    }
  }, [transcriptDraft]);

  const handleDownloadTranscript = useCallback(() => {
    if (!transcriptDraft.trim()) {
      return;
    }
    const blob = new Blob([transcriptDraft], {
      type: "text/plain;charset=utf-8",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = transcriptFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
  }, [transcriptDraft, transcriptFileName]);
  const handleResetTranscriptDraft = useCallback(() => {
    setTranscriptDraft(generatedTranscriptText);
    setTranscriptHasEdits(false);
  }, [generatedTranscriptText]);
  const handleGenerateTranscriptClick = useCallback(() => {
    setTranscriptHasEdits(false);
    setTranscriptDraft("");
    handleGenerateTranscript();
  }, [handleGenerateTranscript]);
  const [isSubtitleSourceOpen, setIsSubtitleSourceOpen] = useState(false);
  const [isSubtitleLanguageOpen, setIsSubtitleLanguageOpen] = useState(false);
  const resolvedSubtitleSource = useMemo(() => {
    if (!Array.isArray(subtitleSourceOptions) || subtitleSourceOptions.length === 0) {
      return {
        id: "project",
        label: "Full project",
        duration: 0,
        kind: "project",
      };
    }
    return (
      subtitleSourceOptions.find((option: any) => option.id === subtitleSource) ??
      subtitleSourceOptions[0]
    );
  }, [subtitleSource, subtitleSourceOptions]);
  const filteredSubtitleStyles = useMemo(() => {
    const styles = subtitleStylePresets as Array<
      typeof subtitleStylePresets[number] & { category?: string }
    >;
    if (subtitleStyleFilter === "All") {
      return styles;
    }
    return styles.filter((style) => style.category === subtitleStyleFilter);
  }, [subtitleStyleFilter, subtitleStylePresets]);
  const hasSubtitleResults = subtitleSegments?.length > 0;
  const currentStyleBeatEnabled = Boolean(
    (recentStylePreset as any)?.settings?.subtitleBeatEnabled !== false
  );
  const currentBeatMinWords =
    typeof (recentStylePreset as any)?.settings?.subtitleBeatMinWords === "number" &&
    Number.isFinite((recentStylePreset as any).settings.subtitleBeatMinWords)
      ? Math.max(1, Math.floor((recentStylePreset as any).settings.subtitleBeatMinWords))
      : 2;
  const currentBeatMaxWords =
    typeof (recentStylePreset as any)?.settings?.subtitleBeatMaxWords === "number" &&
    Number.isFinite((recentStylePreset as any).settings.subtitleBeatMaxWords)
      ? Math.max(currentBeatMinWords, Math.floor((recentStylePreset as any).settings.subtitleBeatMaxWords))
      : Math.max(currentBeatMinWords, 2);
  const currentBeatMaxSpanSeconds =
    typeof (recentStylePreset as any)?.settings?.subtitleBeatMaxSpanSeconds === "number" &&
    Number.isFinite((recentStylePreset as any).settings.subtitleBeatMaxSpanSeconds)
      ? (recentStylePreset as any).settings.subtitleBeatMaxSpanSeconds
      : 1.2;
  const currentBeatLongPauseSeconds =
    typeof (recentStylePreset as any)?.settings?.subtitleBeatLongPauseSeconds === "number" &&
    Number.isFinite((recentStylePreset as any).settings.subtitleBeatLongPauseSeconds)
      ? (recentStylePreset as any).settings.subtitleBeatLongPauseSeconds
      : 0.25;
  const currentBeatAnimate = (recentStylePreset as any)?.settings?.subtitleBeatAnimate !== false;
  const currentBeatEnterSeconds =
    typeof (recentStylePreset as any)?.settings?.subtitleBeatEnterSeconds === "number" &&
    Number.isFinite((recentStylePreset as any).settings.subtitleBeatEnterSeconds)
      ? (recentStylePreset as any).settings.subtitleBeatEnterSeconds
      : 0.17;

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
        {!isAudioTool &&
          !hidePrimaryUploadHeader &&
          !(isStockVideoExpanded && activeTool === "video") &&
          !(isGifLibraryExpanded &&
            (activeTool === "image" || activeTool === "elements")) &&
          !(isStickerLibraryExpanded && activeTool === "elements") && (
          <div
            className={`sticky top-0 z-10 border-b border-gray-100/70 bg-white/95 backdrop-blur ${activeTool === "text" || activeTool === "settings" ? "px-6 py-6" : "px-5 py-5"
              }`}
          >
            {activeTool === "settings" ? (
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold tracking-[-0.01em] text-gray-900">
                  Settings
                </h2>
                <p className="text-xs font-medium text-gray-500">
                  Project-wide controls
                </p>
              </div>
            ) : activeTool === "subtitles" ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-[-0.01em] text-gray-900">
                      Subtitles
                    </h2>
                  </div>
                  <div id="subtitles-extra-header-root" />
                </div>
                {hasSubtitleResults && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                      <span>Group</span>
                      <ToggleSwitch
                        checked={groupToggleChecked}
                        onChange={handleGroupToggle}
                        ariaLabel="Toggle subtitle group"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <button
                          ref={settingsButtonRef}
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50"
                          aria-label="Subtitle settings"
                          aria-expanded={subtitleSettingsOpen}
                          data-testid="@editor/subtitles/settings-cog"
                          onClick={() => {
                            setSubtitleRowMenu((prev) =>
                              prev.open
                                ? { ...prev, open: false, segmentId: null }
                                : prev
                            );
                            setSubtitleSettingsOpen((prev) => !prev);
                          }}
                        >
                          <svg viewBox="0 0 16 16" className="h-4 w-4">
                            <path
                              d="M10 5.333a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm0 0H2.667M6 10.667a2 2 0 1 0-4 0 2 2 0 0 0 4 0Zm0 0h7.333"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                        {subtitleSettingsOpen && (
                          <div
                            ref={settingsMenuRef}
                            data-testid="@context-menu/container/editor/subtitles/settings-dropdown"
                            className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-gray-100 bg-white p-2 shadow-[0_16px_30px_rgba(15,23,42,0.12)]"
                          >
                            <button
                              type="button"
                              data-testid="@editor/subtitles/settings-cog/shift-all"
                              className="relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                              onClick={() => {
                                setShiftSeconds("0.0");
                                setShiftTimingsOpen(true);
                                setSubtitleSettingsOpen(false);
                              }}
                            >
                              <svg
                                viewBox="0 0 16 16"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M13 9H7a4 4 0 0 1-4-4V3m10 6-3-3m3 3-3 3" />
                              </svg>
                              Shift all timings
                            </button>
                            <div className="my-1 h-px bg-gray-100" />
                            <button
                              type="button"
                              data-testid="@editor/subtitles/settings-cog/timings"
                              className="relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                              onClick={() => {
                                setShowSubtitleTimings((prev) => !prev);
                                setSubtitleActiveTab("edit");
                                setSubtitleSettingsOpen(false);
                              }}
                            >
                              <svg
                                viewBox="0 0 16 16"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M8 2.667a6 6 0 1 0 0 12 6 6 0 0 0 0-12m0 0V1.334m0 4v3.333m2 0H8m2-7.333H6" />
                              </svg>
                              {showSubtitleTimings ? "Hide timings" : "Show timings"}
                            </button>
                            <div className="my-1 h-px bg-gray-100" />
                            <button
                              type="button"
                              data-testid="@editor/subtitles/settings-cog/delete-all"
                              className="relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                              onClick={() => {
                                handleSubtitleDeleteAll();
                                setSubtitleSettingsOpen(false);
                              }}
                            >
                              <svg
                                viewBox="0 0 16 16"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M6.4 7.2V12m3.2-4.8V12M1.6 4h12.8m-1.6 0-.694 9.714A1.6 1.6 0 0 1 11.31 15.2H4.69a1.6 1.6 0 0 1-1.596-1.486L2.4 4m3.2 0V1.6a.8.8 0 0 1 .8-.8h3.2a.8.8 0 0 1 .8.8V4" />
                              </svg>
                              Delete all
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="relative inline-flex h-10 items-center justify-center rounded-xl bg-gray-50 p-1">
                        <span
                          className="pointer-events-none absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-sm transition-all"
                          style={{
                            left:
                              subtitleActiveTab === "style"
                                ? "4px"
                                : "calc(50% + 2px)",
                          }}
                        />
                        <button
                          type="button"
                          className={`relative z-10 inline-flex h-8 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                            subtitleActiveTab === "style"
                              ? "text-gray-900"
                              : "text-gray-400 hover:text-gray-600"
                          }`}
                          onClick={() => setSubtitleActiveTab("style")}
                        >
                          <svg viewBox="0 0 16 16" className="h-4 w-4">
                            <path
                              d="M13.25 10.105h-2.917c-.724 0-1.166.487-1.166 1.243 0 .829.583 1.04.583 1.877C9.75 14.31 8.987 15 8 15c-3.866 0-7-2.661-7-6.696C1 4.27 4.134 1 8 1s7 3.27 7 7.304c0 1.046-.583 1.826-1.75 1.8Z"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.2"
                              strokeLinecap="round"
                            />
                            <path
                              d="M3.75 9.75a.5.5 0 1 1 1 0 .5.5 0 0 1-1 0Zm0-3.5a.5.5 0 1 1 1 0 .5.5 0 0 1-1 0Zm3-2a.5.5 0 1 1 1 0 .5.5 0 0 1-1 0Zm3.5 1a.5.5 0 1 1 1 0 .5.5 0 0 1-1 0Z"
                              fill="currentColor"
                            />
                          </svg>
                          Style
                        </button>
                        <button
                          type="button"
                          className={`relative z-10 inline-flex h-8 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
                            subtitleActiveTab === "edit"
                              ? "text-gray-900"
                              : "text-gray-400 hover:text-gray-600"
                          }`}
                          onClick={() => setSubtitleActiveTab("edit")}
                        >
                          <svg viewBox="0 0 16 16" className="h-4 w-4">
                            <path
                              d="M8 2.77v10m0-10L5 1.25m3 1.52 3-1.52M8 12.77l-3 1.98m3-1.98 3 1.98m-5-7h4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : activeTool === "text" ? (
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
                      onClick={() => {
                        if (isSelectedSubtitleClip) {
                          setActiveTool("subtitles");
                          return;
                        }
                        setTextPanelView("library");
                      }}
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
                {!hidePrimaryUploadHeader && (
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
                    {!isAiTool && (
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
                    )}
                  </>
                )}
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
                          {
                            setProjectBackgroundMode("color");
                            setVideoBackground(event.target.value);
                          }
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
                          onClick={() => {
                            setProjectBackgroundMode("color");
                            setVideoBackground(swatch);
                          }}
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
          className={`flex-1 min-h-0 overflow-y-auto ${activeTool === "text" || isSettingsTool || activeTool === "ai"
            ? "bg-white"
            : isAudioTool
              ? "bg-gray-50"
              : "bg-[#F7F8FC]"
            }`}
        >
          {isStickerLibraryExpanded && activeTool === "elements" ? (
            <div className="flex min-h-full flex-col">
              <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-5 py-5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200"
                      aria-label="Go back"
                      onClick={() => setIsStickerLibraryExpanded(false)}
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
                      Stickers
                    </h2>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium text-gray-500">
                    <span>Powered by</span>
                    <GiphyLogo className="h-3 w-auto" />
                  </div>
                </div>
                <div className="mt-4">
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
                      className="h-10 w-full rounded-lg border border-gray-100 bg-white pl-9 pr-9 text-sm font-medium text-gray-700 placeholder:text-gray-400 focus:border-[#335CFF] focus:outline-none"
                      placeholder="Search for stickers"
                      value={stickerSearch}
                      onChange={(event) =>
                        setStickerSearch(event.target.value)
                      }
                    />
                    {stickerSearch.trim() && (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100"
                        onClick={() => setStickerSearch("")}
                        aria-label="Clear search"
                      >
                        <svg viewBox="0 0 16 16" className="h-3 w-3">
                          <path
                            d="M12 4 4 12M4 4l8 8"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-1 px-5 py-5">
                {!hasGiphy ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                    Add a GIPHY API key to enable stickers.
                  </div>
                ) : (stickerGridStatus === "idle" ||
                  stickerGridStatus === "loading") &&
                  stickerGridItems.length === 0 ? (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-3">
                    {Array.from({ length: gifPreviewCount }).map((_, index) => (
                      <div
                        key={`sticker-skeleton-${index}`}
                        className="h-24 rounded-xl bg-gray-100/80 animate-pulse"
                      />
                    ))}
                  </div>
                ) : stickerGridStatus === "error" ? (
                  <div className="rounded-2xl border border-dashed border-red-200 bg-red-50/40 px-4 py-5 text-center text-sm text-red-600">
                    <p>{stickerGridError ?? "Unable to load stickers."}</p>
                    {stickerSearch.trim().length === 0 && (
                      <button
                        type="button"
                        className="mt-3 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-200"
                        onClick={handleStickerTrendingRetry}
                      >
                        Retry
                      </button>
                    )}
                  </div>
                ) : stickerGridItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                    {stickerSearch.trim()
                      ? "No stickers match your search."
                      : "No stickers available right now."}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-3">
                    {stickerGridItems.map((sticker: IGif) => {
                      const previewUrl = resolveGiphyPreviewUrl(sticker);
                      const title = sticker.title?.trim() || "Sticker";
                      return (
                        <button
                          key={sticker.id}
                          type="button"
                          className="group relative h-24 w-full overflow-hidden rounded-xl border border-gray-200 transition hover:border-gray-300"
                          onClick={() => handleAddSticker(sticker)}
                          draggable
                          onDragStart={(event) =>
                            handleGifDragStart(event, sticker)
                          }
                          aria-label={`Add ${title}`}
                        >
                          {previewUrl ? (
                            <img
                              src={previewUrl}
                              alt={`Preview of sticker ${title}`}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs font-semibold text-gray-400">
                              Sticker
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : isGifLibraryExpanded &&
          (activeTool === "image" || activeTool === "elements") ? (
            <div className="flex min-h-full flex-col">
              <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-5 py-5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200"
                      aria-label="Go back"
                      onClick={() => setIsGifLibraryExpanded(false)}
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
                      GIFs
                    </h2>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium text-gray-500">
                    <span>Powered by</span>
                    <GiphyLogo className="h-3 w-auto" />
                  </div>
                </div>
                <div className="mt-4">
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
                      className="h-10 w-full rounded-lg border border-gray-100 bg-white pl-9 pr-9 text-sm font-medium text-gray-700 placeholder:text-gray-400 focus:border-[#335CFF] focus:outline-none"
                      placeholder="Search for GIFs"
                      value={gifSearch}
                      onChange={(event) => setGifSearch(event.target.value)}
                    />
                    {gifSearch.trim() && (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100"
                        onClick={() => setGifSearch("")}
                        aria-label="Clear search"
                      >
                        <svg viewBox="0 0 16 16" className="h-3 w-3">
                          <path
                            d="M12 4 4 12M4 4l8 8"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-1 px-5 py-5">
                {!hasGiphy ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                    Add a GIPHY API key to enable GIF search.
                  </div>
                ) : (gifGridStatus === "idle" ||
                  gifGridStatus === "loading") &&
                  gifGridItems.length === 0 ? (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-3">
                    {Array.from({ length: gifPreviewCount }).map((_, index) => (
                      <div
                        key={`gif-skeleton-${index}`}
                        className="h-24 rounded-xl bg-gray-100/80 animate-pulse"
                      />
                    ))}
                  </div>
                ) : gifGridStatus === "error" ? (
                  <div className="rounded-2xl border border-dashed border-red-200 bg-red-50/40 px-4 py-5 text-center text-sm text-red-600">
                    <p>{gifGridError ?? "Unable to load GIFs."}</p>
                    {gifSearch.trim().length === 0 && (
                      <button
                        type="button"
                        className="mt-3 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-200"
                        onClick={handleGifTrendingRetry}
                      >
                        Retry
                      </button>
                    )}
                  </div>
                ) : gifGridItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                    {gifSearch.trim()
                      ? "No GIFs match your search."
                      : "No GIFs available right now."}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-3">
                    {gifGridItems.map((gif: IGif) => {
                      const previewUrl = resolveGiphyPreviewUrl(gif);
                      const title = gif.title?.trim() || "GIF";
                      return (
                        <button
                          key={gif.id}
                          type="button"
                          className="group relative h-24 w-full overflow-hidden rounded-xl border border-gray-200 transition hover:border-gray-300"
                          onClick={() => handleAddGif(gif)}
                          draggable
                          onDragStart={(event) => handleGifDragStart(event, gif)}
                          aria-label={`Add ${title}`}
                        >
                          {previewUrl ? (
                            <img
                              src={previewUrl}
                              alt={`Preview of gif ${title}`}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs font-semibold text-gray-400">
                              GIF
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : isAssetLibraryExpanded &&
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
                    {viewAllAssets.map((asset: MediaAsset) => (
                      <div
                        key={asset.id}
                        className="group relative flex flex-col gap-2"
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
                        <button
                          type="button"
                          className="pointer-events-none absolute right-2 top-2 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-gray-500 opacity-0 shadow-sm transition group-hover:pointer-events-auto group-hover:opacity-100 hover:bg-white hover:text-gray-700"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleDeleteAsset(asset.id);
                          }}
                          aria-label={`Delete ${asset.name}`}
                        >
                          <svg viewBox="0 0 16 16" className="h-3 w-3">
                            <path
                              d="M12 4 4 12M4 4l8 8"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
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
                  {visibleStockVideoTags.map((category: string) => (
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
                        setShowAllStockVideoTags((prev: boolean) => !prev)
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
                    {groupedStockVideos.map(
                      (group: { category: string; videos: StockVideoItem[] }) => (
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
          ) : activeTool === "settings" ? (
            <div className="flex min-h-full flex-col bg-white">
              <div className="flex-1 px-6">
                <div className="border-b border-gray-100 py-6">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
                    Size
                  </h4>
                  <div className="relative mt-3" data-testid="@editor/settings/size">
                    <button
                      ref={settingsSizeButtonRef}
                      type="button"
                      className="flex h-11 w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30"
                      onClick={() => setSettingsSizeOpen((prev) => !prev)}
                      aria-expanded={settingsSizeOpen}
                    >
                      <div
                        className="flex min-w-0 items-center gap-2"
                        data-testid="@editor/settings/video-size"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          fill="none"
                          viewBox="0 0 16 16"
                          className="overflow-visible text-gray-500"
                        >
                          <rect
                            width="8"
                            height="14"
                            x="4"
                            y="1"
                            stroke="currentColor"
                            strokeLinecap="round"
                            rx="1"
                          />
                        </svg>
                        <span className="truncate">
                          {resolvedProjectSize?.label ?? "Original"}
                        </span>
                        <span className="text-xs font-semibold text-gray-400">
                          ({selectedSizeRatioLabel})
                        </span>
                      </div>
                      <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-500">
                        <path
                          d="m4 6 4 4 4-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    {settingsSizeOpen && (
                      <div
                        ref={settingsSizeMenuRef}
                        className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-gray-100 bg-white p-1 shadow-[0_16px_30px_rgba(15,23,42,0.12)]"
                      >
                        {(projectSizeOptions ?? []).map((option: any) => {
                          const ratioLabel =
                            option.id === "original"
                              ? formatAspectRatioLabel(contentAspectRatio)
                              : formatAspectRatioLabel(
                                  option.aspectRatio ?? projectAspectRatio
                                );
                          const isSelected = option.id === projectSizeId;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition ${
                                isSelected
                                  ? "bg-[#EEF2FF] text-[#335CFF]"
                                  : "text-gray-700 hover:bg-gray-50"
                              }`}
                              onClick={() => {
                                setProjectSizeId(option.id);
                                setSettingsSizeOpen(false);
                              }}
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="truncate">{option.label}</span>
                                <span className="text-xs text-gray-400">
                                  ({ratioLabel})
                                </span>
                              </div>
                              {option.width && option.height && (
                                <span className="text-[11px] font-semibold text-gray-400">
                                  {option.width}x{option.height}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    Pick the frame size you want to export.
                  </p>
                </div>

                <div className="border-b border-gray-100 py-6">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
                    Background
                  </h4>
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <input
                          type="radio"
                          name="project-background"
                          value="color"
                          checked={isBackgroundColorMode}
                          onChange={() => setProjectBackgroundMode("color")}
                        />
                        <span>Color</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          data-testid="@editor/color-hex-input"
                          type="text"
                          value={backgroundHexDraft}
                          disabled={!isBackgroundColorMode}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setBackgroundHexDraft(nextValue);
                            const normalized = normalizeHexColor(nextValue);
                            if (normalized) {
                              setVideoBackground(normalized);
                            }
                          }}
                          onBlur={() => {
                            const normalized = normalizeHexColor(backgroundHexDraft);
                            if (normalized) {
                              setVideoBackground(normalized);
                              setBackgroundHexDraft(normalized);
                              return;
                            }
                            setBackgroundHexDraft(videoBackground);
                          }}
                          className="h-10 w-28 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 disabled:cursor-not-allowed disabled:bg-gray-50"
                        />
                        <input
                          data-testid="@editor/color-picker-btn"
                          type="color"
                          value={videoBackground}
                          disabled={!isBackgroundColorMode}
                          onChange={(event) => {
                            setVideoBackground(event.target.value);
                            setBackgroundHexDraft(event.target.value);
                          }}
                          className="h-10 w-10 cursor-pointer rounded-lg border border-gray-200 bg-white"
                        />
                      </div>
                    </div>
                    <div className="h-px bg-gray-100" />
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <input
                          type="radio"
                          name="project-background"
                          value="image"
                          checked={isBackgroundImageMode}
                          onChange={() => setProjectBackgroundMode("image")}
                        />
                        <span>Image</span>
                      </label>
                      <div
                        className={`rounded-xl border px-3 py-3 ${
                          isBackgroundImageMode
                            ? "border-gray-200 bg-gray-50"
                            : "border-gray-100 bg-gray-50/70 opacity-70"
                        }`}
                      >
                        {projectBackgroundImage ? (
                          <div className="flex items-center gap-3">
                            <div
                              className="h-12 w-12 rounded-lg bg-cover bg-center"
                              style={{
                                backgroundImage: `url(${projectBackgroundImage.url})`,
                              }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-semibold text-gray-700">
                                {projectBackgroundImage.name}
                              </div>
                              <div className="text-[11px] text-gray-400">
                                {formatSize(projectBackgroundImage.size)}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-gray-300 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => backgroundImageInputRef.current?.click()}
                              disabled={!isBackgroundImageMode}
                            >
                              Replace
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-gray-300 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={handleProjectBackgroundImageClear}
                              disabled={!isBackgroundImageMode}
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-gray-400"
                            onClick={() => {
                              setProjectBackgroundMode("image");
                              backgroundImageInputRef.current?.click();
                            }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="18"
                              height="16"
                              fill="none"
                              viewBox="0 0 16 16"
                            >
                              <path
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13.5h-.005a4.001 4.001 0 1 1 .13-7.998 4.002 4.002 0 1 1 7.716 2.117A3.001 3.001 0 0 1 12 13.5h-1M8 8l-2.5 2.5M8 8l2.5 2.5M8 8v5.6"
                              />
                            </svg>
                            Upload
                          </button>
                        )}
                        <input
                          ref={backgroundImageInputRef}
                          accept="image/*,.jpg,.jpeg,.png,.webp"
                          type="file"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            if (file) {
                              handleProjectBackgroundImageChange(file);
                              setProjectBackgroundMode("image");
                            }
                            if (event.target.value) {
                              event.target.value = "";
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-b border-gray-100 py-6">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
                    Duration
                  </h4>
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <label
                        className="flex items-center gap-2 text-sm font-semibold text-gray-700"
                        data-testid="@project-settings/automatic-project-duration-button"
                      >
                        <input
                          type="radio"
                          name="project-duration"
                          value="automatic"
                          checked={projectDurationMode === "automatic"}
                          onChange={() => handleDurationModeChange("automatic")}
                        />
                        <span>Automatic</span>
                      </label>
                      <span className="text-xs font-semibold text-gray-400">
                        {formatTimeWithTenths(contentTimelineTotal ?? 0)}
                      </span>
                    </div>
                    <div className="h-px bg-gray-100" />
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <input
                          type="radio"
                          name="project-duration"
                          value="fixed"
                          checked={projectDurationMode === "fixed"}
                          onChange={() => handleDurationModeChange("fixed")}
                        />
                        <span>Fixed</span>
                      </label>
                      <input
                        type="text"
                        value={durationDraft}
                        disabled={projectDurationMode !== "fixed"}
                        onFocus={() => setIsDurationEditing(true)}
                        onBlur={() => {
                          setIsDurationEditing(false);
                          commitDurationDraft(durationDraft);
                        }}
                        onChange={(event) => setDurationDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            setIsDurationEditing(false);
                            commitDurationDraft(durationDraft);
                          }
                        }}
                        className="h-10 w-24 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 disabled:cursor-not-allowed disabled:bg-gray-50"
                      />
                    </div>
                    {isFixedDurationShort && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                        Some clips extend beyond this duration.
                        <button
                          type="button"
                          className="ml-2 font-semibold text-amber-800 underline"
                          onClick={() => {
                            const next = Math.max(1, contentTimelineTotal);
                            setProjectDurationSeconds(next);
                            setDurationDraft(formatTimeWithTenths(next));
                          }}
                        >
                          Set to timeline length
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                
              </div>
            </div>
          ) : activeTool === "subtitles" ? (
            <div className="flex min-h-full flex-col bg-white">
              {subtitleStatus === "loading" ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="h-2 w-44 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#5B6CFF] via-[#7B89FF] to-[#5B6CFF] transition-[width] duration-300 ease-out"
                      style={{ width: `${Math.max(8, subtitleProgress * 100)}%` }}
                    />
                  </div>
                  <h3 className="mt-6 text-lg font-semibold text-gray-900">
                    Generating Subtitles...
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    ...go and grab yourself a snack, this could take a minute or two.
                  </p>
                </div>
              ) : !hasSubtitleResults ? (
                <div className="flex flex-1 flex-col px-6 py-6">
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                      <div className="text-sm font-semibold text-gray-900">
                        What do you want to transcribe?
                      </div>
                      <div className="relative">
                        <button
                          type="button"
                          className="flex h-10 w-full items-center justify-between rounded-lg border border-transparent bg-gray-50 px-3 text-sm font-semibold text-gray-800 shadow-sm transition focus:border-[#5B6CFF] focus:outline-none"
                          onClick={() =>
                            setIsSubtitleSourceOpen((prev) => !prev)
                          }
                          aria-expanded={isSubtitleSourceOpen}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate">
                              {resolvedSubtitleSource.label}
                            </span>
                            <span className="text-xs font-semibold text-gray-400">
                              {resolvedSubtitleSource.duration
                                ? formatDuration(resolvedSubtitleSource.duration)
                                : "--:--"}
                            </span>
                          </div>
                          <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-500">
                            <path
                              d="M5 10.936 8 14l3-3.064m0-5.872L8 2 5 5.064"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                        {isSubtitleSourceOpen && (
                          <div className="absolute z-20 mt-2 w-full rounded-lg border border-gray-100 bg-white py-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
                            {subtitleSourceOptions.map((option: any) => (
                              <button
                                key={option.id}
                                type="button"
                                className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                                onClick={() => {
                                  setSubtitleSource(option.id);
                                  setIsSubtitleSourceOpen(false);
                                }}
                              >
                                <span className="truncate">{option.label}</span>
                                <span className="text-xs text-gray-400">
                                  {option.duration
                                    ? formatDuration(option.duration)
                                    : "--:--"}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="text-sm font-semibold text-gray-900">
                        What language is being spoken?
                      </div>
                      <div className="relative">
                        <button
                          type="button"
                          className="flex h-10 w-full items-center justify-between rounded-lg border border-transparent bg-gray-50 px-3 text-sm font-semibold text-gray-800 shadow-sm transition focus:border-[#5B6CFF] focus:outline-none"
                          onClick={() =>
                            setIsSubtitleLanguageOpen((prev) => !prev)
                          }
                          aria-expanded={isSubtitleLanguageOpen}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate">
                              {subtitleLanguage?.label ?? "English"}
                            </span>
                            <span className="text-xs font-semibold text-gray-400">
                              {subtitleLanguage?.detail ?? "English (US)"}
                            </span>
                            <span className="flex h-6 w-8 items-center justify-center rounded-md bg-gray-200 text-[11px] font-semibold text-gray-700">
                              {subtitleLanguage?.region ?? "US"}
                            </span>
                          </div>
                          <svg viewBox="0 0 16 16" className="h-4 w-4 text-gray-500">
                            <path
                              d="M5 10.936 8 14l3-3.064m0-5.872L8 2 5 5.064"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                        {isSubtitleLanguageOpen && (
                          <div className="absolute z-20 mt-2 w-full rounded-lg border border-gray-100 bg-white py-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
                            {subtitleLanguageOptions.map((option: any) => (
                              <button
                                key={option.code}
                                type="button"
                                className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                                onClick={() => {
                                  setSubtitleLanguage(option);
                                  setIsSubtitleLanguageOpen(false);
                                }}
                              >
                                <span className="truncate">{option.label}</span>
                                <span className="text-xs text-gray-400">
                                  {option.detail}
                                </span>
                                <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                                  {option.region}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {subtitleError && (
                      <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                        {subtitleError}
                      </div>
                    )}

                    <button
                      type="button"
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#5B6CFF] px-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(91,108,255,0.28)] transition hover:bg-[#4B5BEE]"
                      onClick={handleGenerateSubtitles}
                    >
                      <svg viewBox="0 0 17 16" className="h-4 w-4">
                        <path
                          d="M4.43848 11L12.4385 11M6.43848 9L8.43848 4.00004C8.43848 4.00004 10.2087 8.4749 10.4385 9M7.07317 7.73063H9.81833M3.98393 14H12.893C14.5039 14 15.4385 13.0991 15.4385 11.6V4.4C15.4385 2.90094 14.5039 2 12.893 2H3.98393C2.3731 2 1.43848 2.90094 1.43848 4.4V11.6C1.43848 13.0991 2.3731 14 3.98393 14Z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Add Subtitles with AI
                    </button>

                    <div className="-mx-6 border-b border-gray-100" />

                    <div className="flex flex-col gap-3">
                      <div className="text-sm font-semibold text-gray-900">
                        More Options
                      </div>
                      <button
                        type="button"
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                        onClick={handleSubtitleAddLine}
                      >
                        <svg viewBox="0 0 16 16" className="h-4 w-4">
                          <path
                            d="M4 7h4.5m-1 2.5H12M10.5 7H12M4 9.5h1.5M3.545 13h8.91C13.86 13 15 11.88 15 10.5v-5C15 4.12 13.86 3 12.454 3H3.545C2.14 3 1 4.12 1 5.5v5C1 11.88 2.14 13 3.545 13"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Transcribe Manually
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  {subtitleActiveTab === "style" && !subtitleStyleEditorOpen && (
                    <div className="border-b border-gray-100 px-6 py-3">
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {subtitleStyleFilters.map((filter) => (
                          <button
                            key={filter}
                            type="button"
                            className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold transition ${
                              subtitleStyleFilter === filter
                                ? "bg-gray-100 text-gray-900"
                                : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                            }`}
                            onClick={() => setSubtitleStyleFilter(filter)}
                          >
                            {filter}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {subtitleActiveTab === "style" ? (
                    subtitleStyleEditorOpen && subtitleStyleDraft ? (
                      <div className="flex min-h-0 flex-1 flex-col">
                        <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30 focus-visible:ring-offset-2"
                              aria-label="Back to styles"
                              onClick={closeSubtitleStyleEditor}
                            >
                              <svg viewBox="0 0 16 16" className="h-4 w-4">
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
                              <h3 className="text-base font-semibold text-gray-900">
                                Edit style
                              </h3>
                              <p className="text-xs text-gray-500">
                                {subtitleStyleEditorPreset?.name ?? "Style"}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
                          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                              Preview
                            </div>
                            <div className="mt-2 flex h-20 items-center justify-center rounded-lg bg-gradient-to-br from-slate-500/70 via-slate-600/70 to-slate-700/70 px-2 text-center">
                              <span
                                className="max-h-12 overflow-hidden text-center text-xs font-semibold leading-snug"
                                style={subtitleStyleDraftPreview?.textStyle}
                              >
                                {subtitleStyleSampleText}
                              </span>
                            </div>
                          </div>

                          <div className="grid gap-4">
                            <div className="space-y-2">
                              <label className="text-xs font-semibold text-gray-600">
                                Font
                              </label>
                              <select
                                value={subtitleStyleDraft.fontFamily}
                                onChange={(event) =>
                                  updateSubtitleStyleDraft({
                                    ...subtitleStyleDraft,
                                    fontFamily: event.target.value,
                                  })
                                }
                                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 shadow-sm focus:border-[#5B6CFF] focus:outline-none"
                              >
                                {textFontFamilies.map((family) => (
                                  <option key={family} value={family}>
                                    {family}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <SliderField
                              label="Font size"
                              value={subtitleStyleDraft.fontSize}
                              min={16}
                              max={72}
                              step={1}
                              onChange={(value) =>
                                updateSubtitleStyleDraft({
                                  ...subtitleStyleDraft,
                                  fontSize: value,
                                })
                              }
                            />

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                aria-pressed={subtitleStyleDraft.bold}
                                className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold transition ${
                                  subtitleStyleDraft.bold
                                    ? "border-[#5B6CFF] bg-[#EEF2FF] text-[#335CFF]"
                                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                }`}
                                onClick={() =>
                                  updateSubtitleStyleDraft({
                                    ...subtitleStyleDraft,
                                    bold: !subtitleStyleDraft.bold,
                                  })
                                }
                              >
                                B
                              </button>
                              <button
                                type="button"
                                aria-pressed={subtitleStyleDraft.italic}
                                className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold italic transition ${
                                  subtitleStyleDraft.italic
                                    ? "border-[#5B6CFF] bg-[#EEF2FF] text-[#335CFF]"
                                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                }`}
                                onClick={() =>
                                  updateSubtitleStyleDraft({
                                    ...subtitleStyleDraft,
                                    italic: !subtitleStyleDraft.italic,
                                  })
                                }
                              >
                                I
                              </button>
                              <div className="ml-auto flex items-center gap-2">
                                <span className="text-xs font-semibold text-gray-600">
                                  Text color
                                </span>
                                <input
                                  type="color"
                                  value={subtitleStyleDraft.color}
                                  onChange={(event) =>
                                    updateSubtitleStyleDraft({
                                      ...subtitleStyleDraft,
                                      color: event.target.value,
                                    })
                                  }
                                  className="h-8 w-12 rounded-md border border-gray-200 bg-white"
                                />
                              </div>
                            </div>

                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-700">
                                  Outline
                                </span>
                                <ToggleSwitch
                                  checked={subtitleStyleDraft.outlineEnabled}
                                  onChange={(next) =>
                                    updateSubtitleStyleDraft({
                                      ...subtitleStyleDraft,
                                      outlineEnabled: next,
                                    })
                                  }
                                  ariaLabel="Toggle subtitle outline"
                                />
                              </div>
                              {subtitleStyleDraft.outlineEnabled && (
                                <div className="mt-3 space-y-3">
                                  <SliderField
                                    label="Outline width"
                                    value={subtitleStyleDraft.outlineWidth}
                                    min={1}
                                    max={8}
                                    step={0.5}
                                    onChange={(value) =>
                                      updateSubtitleStyleDraft({
                                        ...subtitleStyleDraft,
                                        outlineWidth: value,
                                      })
                                    }
                                  />
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-600">
                                      Outline color
                                    </span>
                                    <input
                                      type="color"
                                      value={subtitleStyleDraft.outlineColor}
                                      onChange={(event) =>
                                        updateSubtitleStyleDraft({
                                          ...subtitleStyleDraft,
                                          outlineColor: event.target.value,
                                        })
                                      }
                                      className="h-8 w-12 rounded-md border border-gray-200 bg-white"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-700">
                                  Shadow
                                </span>
                                <ToggleSwitch
                                  checked={subtitleStyleDraft.shadowEnabled}
                                  onChange={(next) =>
                                    updateSubtitleStyleDraft({
                                      ...subtitleStyleDraft,
                                      shadowEnabled: next,
                                    })
                                  }
                                  ariaLabel="Toggle subtitle shadow"
                                />
                              </div>
                              {subtitleStyleDraft.shadowEnabled && (
                                <div className="mt-3 space-y-3">
                                  <SliderField
                                    label="Shadow blur"
                                    value={subtitleStyleDraft.shadowBlur}
                                    min={2}
                                    max={24}
                                    step={1}
                                    onChange={(value) =>
                                      updateSubtitleStyleDraft({
                                        ...subtitleStyleDraft,
                                        shadowBlur: value,
                                      })
                                    }
                                  />
                                  <SliderField
                                    label="Shadow opacity"
                                    value={subtitleStyleDraft.shadowOpacity}
                                    min={10}
                                    max={100}
                                    step={5}
                                    valueLabel={`${subtitleStyleDraft.shadowOpacity}%`}
                                    onChange={(value) =>
                                      updateSubtitleStyleDraft({
                                        ...subtitleStyleDraft,
                                        shadowOpacity: value,
                                      })
                                    }
                                  />
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-600">
                                      Shadow color
                                    </span>
                                    <input
                                      type="color"
                                      value={subtitleStyleDraft.shadowColor}
                                      onChange={(event) =>
                                        updateSubtitleStyleDraft({
                                          ...subtitleStyleDraft,
                                          shadowColor: event.target.value,
                                        })
                                      }
                                      className="h-8 w-12 rounded-md border border-gray-200 bg-white"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <span className="text-xs font-semibold text-gray-700">
                                    Beat mode
                                  </span>
                                  <p className="mt-0.5 text-[11px] text-gray-500">
                                    Defaults to 2-word beats with export-safe pop animation.
                                  </p>
                                </div>
                                <ToggleSwitch
                                  checked={Boolean(subtitleStyleDraft.subtitleBeatEnabled)}
                                  onChange={(next) => {
                                    if (!next) {
                                      updateSubtitleStyleDraft({
                                        ...subtitleStyleDraft,
                                        subtitleBeatEnabled: false,
                                      });
                                      return;
                                    }
                                    const minWords =
                                      typeof subtitleStyleDraft.subtitleBeatMinWords === "number" &&
                                      Number.isFinite(subtitleStyleDraft.subtitleBeatMinWords)
                                        ? Math.max(1, Math.floor(subtitleStyleDraft.subtitleBeatMinWords))
                                        : 2;
                                    const maxWords =
                                      typeof subtitleStyleDraft.subtitleBeatMaxWords === "number" &&
                                      Number.isFinite(subtitleStyleDraft.subtitleBeatMaxWords)
                                        ? Math.max(minWords, Math.floor(subtitleStyleDraft.subtitleBeatMaxWords))
                                        : Math.max(minWords, 2);
                                    updateSubtitleStyleDraft({
                                      ...subtitleStyleDraft,
                                      subtitleBeatEnabled: true,
                                      subtitleBeatMinWords: minWords,
                                      subtitleBeatMaxWords: maxWords,
                                      subtitleBeatMaxSpanSeconds:
                                        typeof subtitleStyleDraft.subtitleBeatMaxSpanSeconds === "number" &&
                                        Number.isFinite(subtitleStyleDraft.subtitleBeatMaxSpanSeconds)
                                          ? subtitleStyleDraft.subtitleBeatMaxSpanSeconds
                                          : 1.2,
                                      subtitleBeatLongPauseSeconds:
                                        typeof subtitleStyleDraft.subtitleBeatLongPauseSeconds === "number" &&
                                        Number.isFinite(subtitleStyleDraft.subtitleBeatLongPauseSeconds)
                                          ? subtitleStyleDraft.subtitleBeatLongPauseSeconds
                                          : 0.25,
                                      subtitleBeatAnimate:
                                        subtitleStyleDraft.subtitleBeatAnimate !== false,
                                      subtitleBeatEnterSeconds:
                                        typeof subtitleStyleDraft.subtitleBeatEnterSeconds === "number" &&
                                        Number.isFinite(subtitleStyleDraft.subtitleBeatEnterSeconds)
                                          ? subtitleStyleDraft.subtitleBeatEnterSeconds
                                          : 0.17,
                                    });
                                  }}
                                  ariaLabel="Toggle beat mode"
                                />
                              </div>
                              {subtitleStyleDraft.subtitleBeatEnabled && (
                                <div className="mt-3 space-y-3">
                                  <div className="grid grid-cols-2 gap-3">
                                    <SliderField
                                      label="Min words"
                                      value={
                                        typeof subtitleStyleDraft.subtitleBeatMinWords === "number" &&
                                        Number.isFinite(subtitleStyleDraft.subtitleBeatMinWords)
                                          ? Math.max(1, Math.floor(subtitleStyleDraft.subtitleBeatMinWords))
                                          : 2
                                      }
                                      min={1}
                                      max={6}
                                      step={1}
                                      onChange={(value) => {
                                        const nextMin = Math.max(1, Math.floor(value));
                                        const currentMax =
                                          typeof subtitleStyleDraft.subtitleBeatMaxWords === "number" &&
                                          Number.isFinite(subtitleStyleDraft.subtitleBeatMaxWords)
                                            ? Math.floor(subtitleStyleDraft.subtitleBeatMaxWords)
                                            : 2;
                                        updateSubtitleStyleDraft({
                                          ...subtitleStyleDraft,
                                          subtitleBeatMinWords: nextMin,
                                          subtitleBeatMaxWords: Math.max(nextMin, currentMax),
                                        });
                                      }}
                                    />
                                    <SliderField
                                      label="Max words"
                                      value={
                                        typeof subtitleStyleDraft.subtitleBeatMaxWords === "number" &&
                                        Number.isFinite(subtitleStyleDraft.subtitleBeatMaxWords)
                                          ? Math.max(1, Math.floor(subtitleStyleDraft.subtitleBeatMaxWords))
                                          : 2
                                      }
                                      min={
                                        typeof subtitleStyleDraft.subtitleBeatMinWords === "number" &&
                                        Number.isFinite(subtitleStyleDraft.subtitleBeatMinWords)
                                          ? Math.max(1, Math.floor(subtitleStyleDraft.subtitleBeatMinWords))
                                          : 2
                                      }
                                      max={8}
                                      step={1}
                                      onChange={(value) =>
                                        updateSubtitleStyleDraft({
                                          ...subtitleStyleDraft,
                                          subtitleBeatMaxWords: Math.max(1, Math.floor(value)),
                                        })
                                      }
                                    />
                                  </div>

                                  <SliderField
                                    label="Max span"
                                    value={
                                      typeof subtitleStyleDraft.subtitleBeatMaxSpanSeconds === "number" &&
                                      Number.isFinite(subtitleStyleDraft.subtitleBeatMaxSpanSeconds)
                                        ? subtitleStyleDraft.subtitleBeatMaxSpanSeconds
                                        : 1.2
                                    }
                                    min={0.2}
                                    max={3}
                                    step={0.05}
                                    valueLabel={`${(
                                      typeof subtitleStyleDraft.subtitleBeatMaxSpanSeconds === "number" &&
                                      Number.isFinite(subtitleStyleDraft.subtitleBeatMaxSpanSeconds)
                                        ? subtitleStyleDraft.subtitleBeatMaxSpanSeconds
                                        : 1.2
                                    ).toFixed(2)}s`}
                                    onChange={(value) =>
                                      updateSubtitleStyleDraft({
                                        ...subtitleStyleDraft,
                                        subtitleBeatMaxSpanSeconds: value,
                                      })
                                    }
                                  />

                                  <SliderField
                                    label="Pause break"
                                    value={
                                      typeof subtitleStyleDraft.subtitleBeatLongPauseSeconds === "number" &&
                                      Number.isFinite(subtitleStyleDraft.subtitleBeatLongPauseSeconds)
                                        ? subtitleStyleDraft.subtitleBeatLongPauseSeconds
                                        : 0.25
                                    }
                                    min={0.05}
                                    max={0.8}
                                    step={0.01}
                                    valueLabel={`${(
                                      typeof subtitleStyleDraft.subtitleBeatLongPauseSeconds === "number" &&
                                      Number.isFinite(subtitleStyleDraft.subtitleBeatLongPauseSeconds)
                                        ? subtitleStyleDraft.subtitleBeatLongPauseSeconds
                                        : 0.25
                                    ).toFixed(2)}s`}
                                    onChange={(value) =>
                                      updateSubtitleStyleDraft({
                                        ...subtitleStyleDraft,
                                        subtitleBeatLongPauseSeconds: value,
                                      })
                                    }
                                  />

                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-600">
                                      Pop animation
                                    </span>
                                    <ToggleSwitch
                                      checked={subtitleStyleDraft.subtitleBeatAnimate !== false}
                                      onChange={(next) =>
                                        updateSubtitleStyleDraft({
                                          ...subtitleStyleDraft,
                                          subtitleBeatAnimate: next,
                                        })
                                      }
                                      ariaLabel="Toggle beat animation"
                                    />
                                  </div>

                                  {subtitleStyleDraft.subtitleBeatAnimate !== false && (
                                    <SliderField
                                      label="Pop duration"
                                      value={
                                        typeof subtitleStyleDraft.subtitleBeatEnterSeconds === "number" &&
                                        Number.isFinite(subtitleStyleDraft.subtitleBeatEnterSeconds)
                                          ? subtitleStyleDraft.subtitleBeatEnterSeconds
                                          : 0.17
                                      }
                                      min={0.05}
                                      max={0.6}
                                      step={0.01}
                                      valueLabel={`${(
                                        typeof subtitleStyleDraft.subtitleBeatEnterSeconds === "number" &&
                                        Number.isFinite(subtitleStyleDraft.subtitleBeatEnterSeconds)
                                          ? subtitleStyleDraft.subtitleBeatEnterSeconds
                                          : 0.17
                                      ).toFixed(2)}s`}
                                      onChange={(value) =>
                                        updateSubtitleStyleDraft({
                                          ...subtitleStyleDraft,
                                          subtitleBeatEnterSeconds: value,
                                        })
                                      }
                                    />
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <span className="text-xs font-semibold text-gray-700">
                                    Word highlight
                                  </span>
                                  <p className="mt-0.5 text-[11px] text-gray-500">
                                    Highlight spoken words in real-time for any font.
                                  </p>
                                </div>
                                <ToggleSwitch
                                  checked={Boolean(subtitleStyleDraft.wordHighlightEnabled)}
                                  onChange={(next) =>
                                    updateSubtitleStyleDraft({
                                      ...subtitleStyleDraft,
                                      wordHighlightEnabled: next,
                                      wordHighlightColor:
                                        subtitleStyleDraft.wordHighlightColor || "#FDE047",
                                    })
                                  }
                                  ariaLabel="Toggle word highlight"
                                />
                              </div>
                              {subtitleStyleDraft.wordHighlightEnabled && (
                                <div className="mt-3 flex items-center justify-between">
                                  <span className="text-xs font-semibold text-gray-600">
                                    Highlight color
                                  </span>
                                  <input
                                    type="color"
                                    value={subtitleStyleDraft.wordHighlightColor || "#FDE047"}
                                    onChange={(event) =>
                                      updateSubtitleStyleDraft({
                                        ...subtitleStyleDraft,
                                        wordHighlightColor: event.target.value,
                                      })
                                    }
                                    className="h-8 w-12 rounded-md border border-gray-200 bg-white"
                                  />
                                </div>
                              )}
                            </div>

                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-gray-700">
                                  Background
                                </span>
                                <ToggleSwitch
                                  checked={subtitleStyleDraft.backgroundEnabled}
                                  onChange={(next) =>
                                    updateSubtitleStyleDraft({
                                      ...subtitleStyleDraft,
                                      backgroundEnabled: next,
                                    })
                                  }
                                  ariaLabel="Toggle subtitle background"
                                />
                              </div>
                              {subtitleStyleDraft.backgroundEnabled && (
                                <div className="mt-3 space-y-3">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                                        subtitleStyleDraft.backgroundStyle ===
                                        "line-block-round"
                                          ? "border-[#5B6CFF] bg-[#EEF2FF] text-[#335CFF]"
                                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                      }`}
                                      onClick={() =>
                                        updateSubtitleStyleDraft({
                                          ...subtitleStyleDraft,
                                          backgroundStyle: "line-block-round",
                                        })
                                      }
                                    >
                                      Line
                                    </button>
                                    <button
                                      type="button"
                                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                                        subtitleStyleDraft.backgroundStyle ===
                                        "block-rounded"
                                          ? "border-[#5B6CFF] bg-[#EEF2FF] text-[#335CFF]"
                                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                      }`}
                                      onClick={() =>
                                        updateSubtitleStyleDraft({
                                          ...subtitleStyleDraft,
                                          backgroundStyle: "block-rounded",
                                        })
                                      }
                                    >
                                      Block
                                    </button>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-600">
                                      Background color
                                    </span>
                                    <input
                                      type="color"
                                      value={subtitleStyleDraft.backgroundColor}
                                      onChange={(event) =>
                                        updateSubtitleStyleDraft({
                                          ...subtitleStyleDraft,
                                          backgroundColor: event.target.value,
                                        })
                                      }
                                      className="h-8 w-12 rounded-md border border-gray-200 bg-white"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                                      TikTok colors
                                    </span>
                                    <div className="flex flex-wrap gap-2">
                                      {tiktokTextBackgroundSwatches.map((swatch) => (
                                        <button
                                          key={swatch}
                                          type="button"
                                          className={`h-6 w-6 rounded-full border transition ${
                                            subtitleStyleDraft.backgroundColor.toLowerCase() === swatch.toLowerCase()
                                              ? "border-[#335CFF] ring-2 ring-[#335CFF]/20"
                                              : "border-gray-200"
                                          }`}
                                          style={{ backgroundColor: swatch }}
                                          onClick={() =>
                                            updateSubtitleStyleDraft({
                                              ...subtitleStyleDraft,
                                              backgroundColor: swatch,
                                            })
                                          }
                                          aria-label={`Set subtitle background to ${swatch}`}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto px-6 py-4">
                        <div className="space-y-4">
                          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                                  Selected style
                                </div>
                                <div className="text-sm font-semibold text-gray-900">
                                  {recentStylePreset?.name ?? "Style"}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-gray-600 transition hover:bg-gray-50"
                                onClick={() => {
                                  if (recentStylePreset) {
                                    openSubtitleStyleEditor(recentStylePreset);
                                  }
                                }}
                              >
                                Edit
                              </button>
                            </div>
                            <div className="relative h-24 bg-gradient-to-br from-slate-500/70 via-slate-600/70 to-slate-700/70">
                              <div className="flex h-full items-center justify-center px-3 text-center text-white">
                                <span
                                  className="max-h-12 overflow-hidden text-xs font-semibold leading-snug"
                                  style={recentStylePreview?.textStyle}
                                >
                                  {recentStylePreset?.preview?.text ??
                                    subtitleStyleSampleText}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                                  Beat mode
                                </div>
                                <div className="text-xs font-semibold text-gray-700">
                                  {currentBeatMinWords}–{currentBeatMaxWords} words per beat
                                </div>
                              </div>
                              <ToggleSwitch
                                checked={currentStyleBeatEnabled}
                                onChange={(next) => {
                                  if (!subtitleStyleId) {
                                    return;
                                  }
                                  if (!next) {
                                    handleSubtitleStyleUpdate(subtitleStyleId, {
                                      subtitleBeatEnabled: false,
                                    });
                                    return;
                                  }
                                  handleSubtitleStyleUpdate(subtitleStyleId, {
                                    subtitleBeatEnabled: true,
                                    subtitleBeatMinWords: currentBeatMinWords,
                                    subtitleBeatMaxWords: currentBeatMaxWords,
                                    subtitleBeatMaxSpanSeconds: currentBeatMaxSpanSeconds,
                                    subtitleBeatLongPauseSeconds: currentBeatLongPauseSeconds,
                                    subtitleBeatAnimate: currentBeatAnimate,
                                    subtitleBeatEnterSeconds: currentBeatEnterSeconds,
                                  });
                                }}
                                ariaLabel="Toggle beat mode"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {filteredSubtitleStyles.map((preset) => {
                              const previewSettings: TextClipSettings = {
                                ...fallbackTextSettings,
                                ...preset.settings,
                                fontFamily:
                                  preset.preview?.fontFamily ?? "Inter",
                                fontSize: preset.preview?.fontSize ?? 22,
                                bold: preset.preview?.bold ?? true,
                                italic: preset.preview?.italic ?? false,
                                text: preset.preview?.text ?? "Everything and I love",
                                align: "center",
                              };
                              const previewStyles = getTextRenderStyles(
                                previewSettings
                              );
                              const isSelected = subtitleStyleId === preset.id;
                              return (
                                <div
                                  key={preset.id}
                                  role="button"
                                  tabIndex={0}
                                  className={`group cursor-pointer overflow-hidden rounded-xl border text-left shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30 ${
                                    isSelected
                                      ? "border-[#5B6CFF] ring-1 ring-[#5B6CFF]/30"
                                      : "border-gray-200 hover:border-gray-300"
                                  }`}
                                  onClick={() => handleSubtitleStyleSelect(preset)}
                                  onKeyDown={(event) =>
                                    handleSubtitleStyleKeyDown(event, preset)
                                  }
                                >
                                  <div className="relative flex h-20 items-center justify-center bg-gradient-to-br from-slate-500/70 via-slate-600/70 to-slate-700/70">
                                    <span
                                      className="max-h-10 overflow-hidden text-center text-xs font-semibold leading-snug"
                                      style={previewStyles.textStyle}
                                    >
                                      {preset.preview?.text ?? "Sample"}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between px-3 py-2">
                                    <span
                                      className={`text-sm font-medium ${
                                        isSelected ? "text-[#5B6CFF]" : "text-gray-700"
                                      }`}
                                    >
                                      {preset.name}
                                    </span>
                                    <button
                                      type="button"
                                      className="rounded-md bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600 opacity-0 transition group-hover:opacity-100"
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        openSubtitleStyleEditor(preset);
                                      }}
                                    >
                                      Edit
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex-1 overflow-y-auto px-6 py-4">
                      <div className="space-y-3">
                        {subtitleSegments.map((segment: SubtitleSegmentEntry) => {
                          const clip = segment.clip ?? null;
                          const startTime = clip
                            ? clip.startTime
                            : segment.startTime;
                          const endTime = clip
                            ? clip.startTime + clip.duration
                            : segment.endTime;
                          const isDetached = detachedSubtitleIds?.has(
                            segment.clipId
                          );
                          const isSelected = selectedClipId === segment.clipId;
                          const rowBaseClass = isDetached
                            ? "border-amber-200 bg-amber-50/50"
                            : "border-gray-100 bg-white";
                          const rowSelectedClass = isSelected
                            ? isDetached
                              ? "border-[#5B6CFF] ring-2 ring-[#5B6CFF]/10"
                              : "border-[#5B6CFF] bg-[#EEF2FF]/60 shadow-[0_12px_24px_rgba(91,108,255,0.12)]"
                            : "";
                          const handlePreview = () => {
                            handleSubtitlePreview(segment);
                          };
                          return (
                            <div
                              key={segment.id}
                              className={`rounded-xl border px-3 py-3 shadow-sm transition ${rowBaseClass} ${rowSelectedClass}`}
                              onClick={handlePreview}
                            >
                              <div className="grid grid-cols-[1fr_auto] gap-3">
                                <textarea
                                  value={segment.text}
                                  onChange={(event) =>
                                    handleSubtitleTextUpdate(
                                      segment.id,
                                      event.target.value
                                    )
                                  }
                                  onFocus={handlePreview}
                                  rows={2}
                                  className="min-h-[52px] w-full resize-none rounded-lg border border-transparent bg-transparent text-sm font-medium text-gray-700 outline-none focus:border-[#5B6CFF] focus:bg-white"
                                />
                                <div className="flex flex-col items-end gap-2">
                                  {showSubtitleTimings && clip && (
                                    <div className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50/70 p-2">
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          className="flex h-7 items-center gap-1 rounded-md bg-white px-2 text-[10px] font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50"
                                          onClick={() =>
                                            handleSetStartAtPlayhead(clip)
                                          }
                                        >
                                          <svg
                                            viewBox="0 0 16 16"
                                            className="h-3 w-3"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.3"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          >
                                            <path d="M8 2.667a6 6 0 1 0 0 12 6 6 0 0 0 0-12m0 0V1.334m0 4v3.333m2 0H8m2-7.333H6" />
                                          </svg>
                                          In
                                        </button>
                                        <input
                                          key={`${segment.id}-start-${startTime}`}
                                          defaultValue={formatTimeWithTenths(
                                            startTime
                                          )}
                                          onBlur={(event) =>
                                            handleStartTimeCommit(
                                              clip,
                                              event.target.value
                                            )
                                          }
                                          className="h-7 w-24 rounded-md border border-gray-200 bg-white px-2 text-right text-[11px] font-semibold text-gray-700 shadow-sm"
                                        />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          className="flex h-7 items-center gap-1 rounded-md bg-white px-2 text-[10px] font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50"
                                          onClick={() =>
                                            handleSetEndAtPlayhead(clip)
                                          }
                                        >
                                          <svg
                                            viewBox="0 0 16 16"
                                            className="h-3 w-3"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.3"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          >
                                            <path d="M8 2.667a6 6 0 1 0 0 12 6 6 0 0 0 0-12m0 0V1.334m0 4v3.333m2 0H8m2-7.333H6" />
                                          </svg>
                                          Out
                                        </button>
                                        <input
                                          key={`${segment.id}-end-${endTime}`}
                                          defaultValue={formatTimeWithTenths(
                                            endTime
                                          )}
                                          onBlur={(event) =>
                                            handleEndTimeCommit(
                                              clip,
                                              event.target.value
                                            )
                                          }
                                          className="h-7 w-24 rounded-md border border-gray-200 bg-white px-2 text-right text-[11px] font-semibold text-gray-700 shadow-sm"
                                        />
                                      </div>
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-100 bg-white text-gray-400 shadow-sm transition hover:text-gray-600"
                                    onClick={(event) =>
                                      openSubtitleRowMenu(
                                        event,
                                        segment.id
                                      )
                                    }
                                  >
                                    <svg viewBox="0 0 16 16" className="h-4 w-4">
                                      <path
                                        d="M8 6.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5M8 12a1.25 1.25 0 1 1 0 2.5A1.25 1.25 0 0 1 8 12M8 1.5A1.25 1.25 0 1 1 8 4a1.25 1.25 0 0 1 0-2.5"
                                        fill="currentColor"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                        onClick={handleSubtitleAddLine}
                      >
                        <svg viewBox="0 0 16 16" className="h-4 w-4">
                          <path
                            d="M3 8h10M8 3v10"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Add New Subtitles Line
                      </button>
                    </div>
                  )}
                </div>
              )}
              {subtitleRowMenu.open && activeSubtitleMenuSegment && (
                <div
                  ref={rowMenuRef}
                  data-testid="@context-menu/container"
                  className="fixed z-50"
                  style={{
                    left: `${subtitleRowMenu.x}px`,
                    top: `${subtitleRowMenu.y}px`,
                  }}
                >
                  <div className="w-48 rounded-xl border border-gray-100 bg-white p-2 shadow-[0_16px_30px_rgba(15,23,42,0.12)]">
                    <button
                      type="button"
                      data-testid="@editor/subtitles/subtitles-editor/row/options/delete"
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      onClick={() => {
                        handleSubtitleDelete(activeSubtitleMenuSegment.id);
                        setSubtitleRowMenu((prev) => ({
                          ...prev,
                          open: false,
                          segmentId: null,
                        }));
                      }}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6.4 7.2V12m3.2-4.8V12M1.6 4h12.8m-1.6 0-.694 9.714A1.6 1.6 0 0 1 11.31 15.2H4.69a1.6 1.6 0 0 1-1.596-1.486L2.4 4m3.2 0V1.6a.8.8 0 0 1 .8-.8h3.2a.8.8 0 0 1 .8.8V4" />
                      </svg>
                      Delete
                    </button>
                    <button
                      type="button"
                      data-testid="@editor/subtitles/settings-cog/timings"
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      onClick={() => {
                        setShowSubtitleTimings((prev) => !prev);
                        setSubtitleActiveTab("edit");
                        setSubtitleRowMenu((prev) => ({
                          ...prev,
                          open: false,
                          segmentId: null,
                        }));
                      }}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M8 2.667a6 6 0 1 0 0 12 6 6 0 0 0 0-12m0 0V1.334m0 4v3.333m2 0H8m2-7.333H6" />
                      </svg>
                      {showSubtitleTimings ? "Hide timings" : "Show timings"}
                    </button>
                  </div>
                </div>
              )}
              {shiftTimingsOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
                  onClick={() => setShiftTimingsOpen(false)}
                >
                  <div
                    className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.25)]"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <h2 className="text-lg font-semibold text-gray-900">
                      Shift all subtitles
                    </h2>
                    <div className="mt-4 space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                        Seconds
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={shiftSeconds}
                        onChange={(event) => setShiftSeconds(event.target.value)}
                        className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 shadow-sm focus:border-[#5B6CFF] focus:outline-none"
                      />
                      <p className="text-xs text-gray-500">
                        Enter a negative number to shift subtitles forward
                        (eg. -0.5).
                      </p>
                    </div>
                    <div className="mt-5 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-[#5B6CFF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4B5BEE]"
                        onClick={handleShiftSubmit}
                      >
                        Shift
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                        onClick={() => setShiftTimingsOpen(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
                    {visibleTextPresetGroups.map((group: TextPresetGroup) => {
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
                            {textFontSizeOptions.map((size: number) => (
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
                              setTextPanelBold((prev: boolean) => {
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
                              setTextPanelItalic((prev: boolean) => {
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
                            setTextPanelSpacingOpen((prev: boolean) => !prev)
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
                          setTextPanelStylesOpen((prev: boolean) => !prev)
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
                                <div className="mt-3">
                                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                                    TikTok background colors
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {tiktokTextBackgroundSwatches.map((swatch) => (
                                      <button
                                        key={swatch}
                                        type="button"
                                        className={`h-6 w-6 rounded-full border transition ${
                                          textPanelBackgroundColor.toLowerCase() === swatch.toLowerCase()
                                            ? "border-[#335CFF] ring-2 ring-[#335CFF]/20"
                                            : "border-gray-200"
                                        }`}
                                        style={{ backgroundColor: swatch }}
                                        onClick={() => {
                                          setTextPanelStylePresetId(null);
                                          setTextPanelBackgroundColor(swatch);
                                          if (selectedTextEntry) {
                                            updateTextSettings(
                                              selectedTextEntry.clip.id,
                                              (current) => ({
                                                ...current,
                                                backgroundColor: swatch,
                                              })
                                            );
                                          }
                                        }}
                                        aria-label={`Set text background to ${swatch}`}
                                      />
                                    ))}
                                  </div>
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
                                        (prev: boolean) => !prev
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
                        {visibleAssetGridItems.map((asset: MediaAsset) => (
                          <div
                            key={asset.id}
                            className="group relative space-y-2"
                          >
                            <button
                              type="button"
                              className={`relative h-24 w-full overflow-hidden rounded-2xl border transition ${asset.id === activeAssetId
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
                            <button
                              type="button"
                              className="pointer-events-none absolute right-2 top-2 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-gray-500 opacity-0 shadow-sm transition group-hover:pointer-events-auto group-hover:opacity-100 hover:bg-white hover:text-gray-700"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleDeleteAsset(asset.id);
                              }}
                              aria-label={`Delete ${asset.name}`}
                            >
                              <svg viewBox="0 0 16 16" className="h-3 w-3">
                                <path
                                  d="M12 4 4 12M4 4l8 8"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
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

                  {activeTool === "audio" && (
                    <div className="space-y-6">
                      <div className="flex flex-col rounded-2xl border border-gray-100 bg-white shadow-[0_12px_26px_rgba(15,23,42,0.08)]">
                        <div className="rounded-t-2xl border-b border-gray-50 bg-white px-6 py-6 transition-shadow duration-200">
                          <div className="flex flex-col gap-6">
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EEF2FF]">
                                <svg viewBox="0 0 24 24" className="h-4 w-4">
                                  <path
                                    d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
                                    fill="#335CFF"
                                  />
                                  <path
                                    fill="url(#sound_fx_header_b)"
                                    fillOpacity="0.2"
                                    d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
                                  />
                                  <path
                                    fill="#fff"
                                    d="M13 16.507V8.893a1 1 0 0 1 .876-.992l2.248-.28A1 1 0 0 0 17 6.627V5.1a1 1 0 0 0-1.085-.996l-2.912.247a2 2 0 0 0-1.83 2.057l.24 7.456a3 3 0 1 0 1.586 2.724l.001-.073z"
                                  />
                                  <defs>
                                    <linearGradient
                                      id="sound_fx_header_b"
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
                                Sound Effects
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
                                  value={soundFxSearch}
                                  onChange={(event) =>
                                    setSoundFxSearch(event.target.value)
                                  }
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className={`inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold transition ${soundFxCategory === "All"
                                  ? "bg-[#335CFF] text-white shadow-[0_6px_16px_rgba(51,92,255,0.25)]"
                                  : "bg-[#EEF2FF] text-[#335CFF] hover:bg-[#E0E7FF]"
                                  }`}
                                onClick={() => setSoundFxCategory("All")}
                              >
                                All
                              </button>
                              {visibleSoundFxTags.map((category: string) => (
                                <button
                                  key={category}
                                  type="button"
                                  className={`inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold transition ${soundFxCategory === category
                                    ? "bg-[#335CFF] text-white shadow-[0_6px_16px_rgba(51,92,255,0.25)]"
                                    : "bg-[#EEF2FF] text-[#335CFF] hover:bg-[#E0E7FF]"
                                    }`}
                                  onClick={() => setSoundFxCategory(category)}
                                >
                                  {category}
                                </button>
                              ))}
                              {hasMoreSoundFxTags && (
                                <button
                                  type="button"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF2FF] text-[#335CFF] transition hover:bg-[#E0E7FF]"
                                  onClick={() =>
                                    setShowAllSoundFxTags((prev: boolean) => !prev)
                                  }
                                  aria-label={
                                    showAllSoundFxTags
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
                              Connect Supabase to load sound effects.
                            </div>
                          ) : soundFxStatus === "loading" ||
                            soundFxStatus === "idle" ? (
                            <div className="space-y-3">
                              {Array.from({ length: 4 }).map((_, index) => (
                                <div
                                  key={`sound-fx-skeleton-${index}`}
                                  className="h-16 rounded-2xl bg-gray-100/80 animate-pulse"
                                />
                              ))}
                            </div>
                          ) : soundFxStatus === "error" ? (
                            <div className="rounded-2xl border border-dashed border-red-200 bg-red-50/40 px-4 py-5 text-center text-sm text-red-600">
                              <p>{soundFxError ?? "Unable to load sound effects."}</p>
                              <button
                                type="button"
                                className="mt-3 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-200"
                                onClick={handleSoundFxRetry}
                              >
                                Retry
                              </button>
                            </div>
                          ) : groupedSoundFx.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                              {soundFxSearch.trim()
                                ? "No tracks match your search."
                                : soundFxRootPrefix
                                  ? `No sound effects found under "${soundFxRootPrefix}".`
                                  : "No sound effects found."}
                            </div>
                          ) : (
                            <div className="space-y-8">
                              {groupedSoundFx.map(
                                (group: { category: string; tracks: StockAudioTrack[] }) => (
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
                                          className="group flex cursor-grab items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.08)] transition hover:border-[#DDE3FF] hover:shadow-[0_12px_24px_rgba(15,23,42,0.12)] active:cursor-grabbing"
                                          onMouseEnter={() =>
                                            requestStockAudioDuration(track)
                                          }
                                          draggable
                                          onDragStart={(event) =>
                                            handleStockAudioDragStart(event, track)
                                          }
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
                                              onFocus={() =>
                                                requestStockAudioDuration(track)
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

                      <div className="flex flex-col rounded-2xl border border-gray-100 bg-white shadow-[0_12px_26px_rgba(15,23,42,0.08)]">
                        <div className="rounded-t-2xl border-b border-gray-50 bg-white px-6 py-6 transition-shadow duration-200">
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
                              {visibleStockTags.map((category: string) => (
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
                                    setShowAllStockTags((prev: boolean) => !prev)
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
                              {groupedStockMusic.map(
                                (group: { category: string; tracks: StockAudioTrack[] }) => (
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
                                          className="group flex cursor-grab items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.08)] transition hover:border-[#DDE3FF] hover:shadow-[0_12px_24px_rgba(15,23,42,0.12)] active:cursor-grabbing"
                                          onMouseEnter={() =>
                                            requestStockAudioDuration(track)
                                          }
                                          draggable
                                          onDragStart={(event) =>
                                            handleStockAudioDragStart(event, track)
                                          }
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
                                              onFocus={() =>
                                                requestStockAudioDuration(track)
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
                    </div>
                  )}

                  {activeTool === "image" && (
                    <div className="rounded-2xl border border-white/70 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GiphyLogo className="h-4 w-auto" />
                          <h3 className="text-sm font-semibold text-gray-900">
                            GIFs
                          </h3>
                        </div>
                        <button
                          className="flex items-center gap-1 text-xs font-semibold text-gray-500 transition hover:text-gray-700"
                          type="button"
                          onClick={() => {
                            setIsAssetLibraryExpanded(false);
                            setIsGifLibraryExpanded(true);
                          }}
                        >
                          View All
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
                        {!hasGiphy ? (
                          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                            Add a GIPHY API key to enable GIFs.
                          </div>
                        ) : (gifTrendingStatus === "idle" ||
                          gifTrendingStatus === "loading") &&
                          gifPreviewItems.length === 0 ? (
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-3">
                            {Array.from({ length: gifPreviewCount }).map(
                              (_, index) => (
                                <div
                                  key={`gif-preview-skeleton-${index}`}
                                  className="h-24 rounded-xl bg-gray-100/80 animate-pulse"
                                />
                              )
                            )}
                          </div>
                        ) : gifTrendingStatus === "error" ? (
                          <div className="rounded-2xl border border-dashed border-red-200 bg-red-50/40 px-4 py-5 text-center text-sm text-red-600">
                            <p>{gifTrendingError ?? "Unable to load GIFs."}</p>
                            <button
                              type="button"
                              className="mt-3 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-200"
                              onClick={handleGifTrendingRetry}
                            >
                              Retry
                            </button>
                          </div>
                        ) : gifPreviewItems.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                            No GIFs available right now.
                          </div>
                        ) : (
                          <div className="grid h-[384px] grid-cols-2 gap-3 auto-rows-[0px] grid-rows-3 md:h-[142px] md:grid-cols-4 md:grid-rows-1 lg:h-[180px] lg:grid-cols-3 lg:grid-rows-2">
                            {gifPreviewItems.map((gif: IGif) => {
                              const previewUrl = resolveGiphyPreviewUrl(gif);
                              const title = gif.title?.trim() || "GIF";
                              return (
                                <button
                                  key={gif.id}
                                  type="button"
                                  className="group relative h-full w-full overflow-hidden rounded-xl border border-gray-200 transition hover:border-gray-300"
                                  onClick={() => handleAddGif(gif)}
                                  draggable
                                  onDragStart={(event) =>
                                    handleGifDragStart(event, gif)
                                  }
                                  aria-label={`Add ${title}`}
                                >
                                  {previewUrl ? (
                                    <img
                                      src={previewUrl}
                                      alt={`Preview of gif ${title}`}
                                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs font-semibold text-gray-400">
                                      GIF
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTool === "video" && (
                    <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                      {youtubeLoading ? (
                        downloadLoader
                      ) : (
                        <>
                          <div className="flex items-start gap-3">
                            <div>
                              <h3 className="text-sm font-semibold text-[#2E3440]">
                                YouTube Downloader
                              </h3>
                              <p className="mt-1 text-xs text-[#7A8699]">
                                Paste a link to download.
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 space-y-3">
                            <div className="relative">
                              <input
                                className="h-10 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#2E3440] placeholder:text-[#94A3B8] focus:border-[#5E81AC] focus:outline-none focus:ring-1 focus:ring-[#5E81AC]/30"
                                placeholder="https://youtube.com/watch?v=..."
                                value={youtubeUrl}
                                onChange={(event) => {
                                  setYoutubeUrl(event.target.value);
                                  setYoutubeError(null);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    handleYoutubeSubmit();
                                  }
                                }}
                                aria-label="YouTube link"
                                disabled={youtubeLoading}
                              />
                            </div>
                            <div className="flex items-center justify-end">
                              <button
                                type="button"
                                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${youtubeLoading
                                  ? "cursor-not-allowed bg-[#D8DEE9] text-[#64748B]"
                                  : "bg-[#5E81AC] text-white hover:bg-[#4E74A0]"
                                  }`}
                                onClick={handleYoutubeSubmit}
                                disabled={youtubeLoading}
                              >
                                {youtubeLoading ? "Downloading..." : "Download"}
                              </button>
                            </div>
                            {youtubeError && (
                              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                                {youtubeError}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {activeTool === "video" && (
                    <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                      {tiktokLoading ? (
                        downloadLoader
                      ) : (
                        <>
                          <div className="flex items-start gap-3">
                            <div>
                              <h3 className="text-sm font-semibold text-[#2E3440]">
                                TikTok Downloader
                              </h3>
                              <p className="mt-1 text-xs text-[#7A8699]">
                                Paste a link to download.
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 space-y-3">
                            <div className="relative">
                              <input
                                className="h-10 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#2E3440] placeholder:text-[#94A3B8] focus:border-[#5E81AC] focus:outline-none focus:ring-1 focus:ring-[#5E81AC]/30"
                                placeholder="https://www.tiktok.com/@..."
                                value={tiktokUrl}
                                onChange={(event) => {
                                  setTiktokUrl(event.target.value);
                                  setTiktokError(null);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    handleTiktokSubmit();
                                  }
                                }}
                                aria-label="TikTok link"
                                disabled={tiktokLoading}
                              />
                            </div>
                            <div className="flex items-center justify-end">
                              <button
                                type="button"
                                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${tiktokLoading
                                  ? "cursor-not-allowed bg-[#D8DEE9] text-[#64748B]"
                                  : "bg-[#5E81AC] text-white hover:bg-[#4E74A0]"
                                  }`}
                                onClick={handleTiktokSubmit}
                                disabled={tiktokLoading}
                              >
                                {tiktokLoading ? "Downloading..." : "Download"}
                              </button>
                            </div>
                            {tiktokError && (
                              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                                {tiktokError}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

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
                            {previewStockVideos.map((video: StockVideoItem) => {
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
              ) : activeTool === "elements" ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/70 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GiphyLogo className="h-4 w-auto" />
                        <h3 className="text-sm font-semibold text-gray-900">
                          GIFs
                        </h3>
                      </div>
                      <button
                        className="flex items-center gap-1 text-xs font-semibold text-gray-500 transition hover:text-gray-700"
                        type="button"
                        onClick={() => {
                          setIsAssetLibraryExpanded(false);
                          setIsGifLibraryExpanded(true);
                        }}
                      >
                        View All
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
                      {!hasGiphy ? (
                        <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                          Add a GIPHY API key to enable GIFs.
                        </div>
                      ) : (gifTrendingStatus === "idle" ||
                        gifTrendingStatus === "loading") &&
                        gifPreviewItems.length === 0 ? (
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-3">
                          {Array.from({ length: gifPreviewCount }).map(
                            (_, index) => (
                              <div
                                key={`gif-preview-skeleton-${index}`}
                                className="h-24 rounded-xl bg-gray-100/80 animate-pulse"
                              />
                            )
                          )}
                        </div>
                      ) : gifTrendingStatus === "error" ? (
                        <div className="rounded-2xl border border-dashed border-red-200 bg-red-50/40 px-4 py-5 text-center text-sm text-red-600">
                          <p>{gifTrendingError ?? "Unable to load GIFs."}</p>
                          <button
                            type="button"
                            className="mt-3 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-200"
                            onClick={handleGifTrendingRetry}
                          >
                            Retry
                          </button>
                        </div>
                      ) : gifPreviewItems.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                          No GIFs available right now.
                        </div>
                      ) : (
                        <div className="grid h-[384px] grid-cols-2 gap-3 auto-rows-[0px] grid-rows-3 md:h-[142px] md:grid-cols-4 md:grid-rows-1 lg:h-[180px] lg:grid-cols-3 lg:grid-rows-2">
                          {gifPreviewItems.map((gif: IGif) => {
                            const previewUrl = resolveGiphyPreviewUrl(gif);
                            const title = gif.title?.trim() || "GIF";
                            return (
                              <button
                                key={gif.id}
                                type="button"
                                className="group relative h-full w-full overflow-hidden rounded-xl border border-gray-200 transition hover:border-gray-300"
                                onClick={() => handleAddGif(gif)}
                                draggable
                                onDragStart={(event) =>
                                  handleGifDragStart(event, gif)
                                }
                                aria-label={`Add ${title}`}
                              >
                                {previewUrl ? (
                                  <img
                                    src={previewUrl}
                                    alt={`Preview of gif ${title}`}
                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs font-semibold text-gray-400">
                                    GIF
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GiphyLogo className="h-4 w-auto" />
                        <h3 className="text-sm font-semibold text-gray-900">
                          Stickers
                        </h3>
                      </div>
                      <button
                        className="flex items-center gap-1 text-xs font-semibold text-gray-500 transition hover:text-gray-700"
                        type="button"
                        onClick={() => setIsStickerLibraryExpanded(true)}
                      >
                        View All
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
                      {!hasGiphy ? (
                        <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                          Add a GIPHY API key to enable stickers.
                        </div>
                      ) : (stickerTrendingStatus === "idle" ||
                        stickerTrendingStatus === "loading") &&
                        stickerPreviewItems.length === 0 ? (
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-3">
                          {Array.from({ length: gifPreviewCount }).map(
                            (_, index) => (
                              <div
                                key={`sticker-preview-skeleton-${index}`}
                                className="h-24 rounded-xl bg-gray-100/80 animate-pulse"
                              />
                            )
                          )}
                        </div>
                      ) : stickerTrendingStatus === "error" ? (
                        <div className="rounded-2xl border border-dashed border-red-200 bg-red-50/40 px-4 py-5 text-center text-sm text-red-600">
                          <p>
                            {stickerTrendingError ??
                              "Unable to load stickers."}
                          </p>
                          <button
                            type="button"
                            className="mt-3 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-200"
                            onClick={handleStickerTrendingRetry}
                          >
                            Retry
                          </button>
                        </div>
                      ) : stickerPreviewItems.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                          No stickers available right now.
                        </div>
                      ) : (
                        <div className="grid h-[384px] grid-cols-2 gap-3 auto-rows-[0px] grid-rows-3 md:h-[142px] md:grid-cols-4 md:grid-rows-1 lg:h-[180px] lg:grid-cols-3 lg:grid-rows-2">
                          {stickerPreviewItems.map((sticker: IGif) => {
                            const previewUrl = resolveGiphyPreviewUrl(sticker);
                            const title = sticker.title?.trim() || "Sticker";
                            return (
                              <button
                                key={sticker.id}
                                type="button"
                                className="group relative h-full w-full overflow-hidden rounded-xl border border-gray-200 transition hover:border-gray-300"
                                onClick={() => handleAddSticker(sticker)}
                                draggable
                                onDragStart={(event) =>
                                  handleGifDragStart(event, sticker)
                                }
                                aria-label={`Add ${title}`}
                              >
                                {previewUrl ? (
                                  <img
                                    src={previewUrl}
                                    alt={`Preview of sticker ${title}`}
                                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs font-semibold text-gray-400">
                                    Sticker
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : activeTool === "ai" ? (
                <div className="space-y-4">
                  {activeAiTool ? (
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30 focus-visible:ring-offset-2"
                          type="button"
                          aria-label="Back to AI tools"
                          onClick={() => setActiveAiToolId(null)}
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
                        <div className="flex-1 space-y-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {activeAiTool.title}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {activeAiTool.description}
                          </p>
                        </div>
                        <div
                          className={`relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${activeAiTool.gradient}`}
                        >
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-lg shadow-[0_8px_16px_rgba(15,23,42,0.12)] ${
                              isAiDevenActive ? "bg-[#FF0033]" : "bg-white"
                            }`}
                          >
                            {ActiveAiToolIcon && (
                              <ActiveAiToolIcon
                                className={`h-4 w-4 ${
                                  isAiDevenActive ? "text-white" : "text-[#1a1240]"
                                }`}
                                {...(isAiDevenActive
                                  ? { fill: "currentColor", stroke: "none" }
                                  : {})}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                      {activeAiTool.id === "ai-deven" ? (
                        <div className="space-y-4">
                          <div className="rounded-2xl border border-white/70 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                                AI Deven
                              </p>
                              {aiDevenStatus === "error" ? (
                                <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-600">
                                  Offline
                                </span>
                              ) : aiDevenStatus === "ready" ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-600">
                                  Ready
                                </span>
                              ) : (
                                <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-600">
                                  Connecting
                                </span>
                              )}
                            </div>
                            <div className="relative mt-3 rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-3 py-3">
                              <div
                                className={`flex min-h-[480px] items-center justify-center ${
                                  aiDevenStatus === "error" ? "hidden" : ""
                                }`}
                              >
                                <lemon-slice-widget
                                  ref={lemonSliceWidgetRef}
                                  agent-id="agent_d69498ddf579cb6c"
                                  inline
                                  custom-minimized-width="200"
                                  custom-minimized-height="300"
                                  custom-active-width="320"
                                  custom-active-height="480"
                                  video-button-color-opacity="0.15"
                                  show-minimize-button="false"
                                  initial-state="minimized"
                                />
                              </div>
                              {aiDevenStatus !== "ready" &&
                                aiDevenStatus !== "error" && (
                                  <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-white/70 text-xs font-semibold text-gray-500">
                                    <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
                                    Connecting AI Deven...
                                  </div>
                                )}
                              {aiDevenStatus === "error" && (
                                <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-4 py-8 text-center text-xs font-semibold text-rose-500">
                                  <p>Unable to load AI Deven right now.</p>
                                  <button
                                    type="button"
                                    className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-200"
                                    onClick={handleAiDevenActivate}
                                  >
                                    Retry
                                  </button>
                                </div>
                              )}
                            </div>
                            <p className="mt-2 text-[11px] text-gray-400">
                              Ask about hooks, titles, retention, thumbnails, or script polish.
                            </p>
                          </div>
                        </div>
                      ) : activeAiTool.id === "transcription" ? (
                        <div className="space-y-4">
                          <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm">
                            <div className="flex flex-col gap-2">
                              <div className="text-sm font-semibold text-gray-900">
                                What do you want to transcribe?
                              </div>
                              <div className="relative">
                                <button
                                  type="button"
                                  className="flex h-10 w-full items-center justify-between rounded-lg border border-transparent bg-gray-50 px-3 text-sm font-semibold text-gray-800 shadow-sm transition focus:border-[#5B6CFF] focus:outline-none"
                                  onClick={() =>
                                    setIsAiTranscriptSourceOpen((prev) => !prev)
                                  }
                                  aria-expanded={isAiTranscriptSourceOpen}
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span className="truncate">
                                      {resolvedTranscriptSource.label}
                                    </span>
                                    <span className="text-xs font-semibold text-gray-400">
                                      {resolvedTranscriptSource.duration
                                        ? formatDuration(
                                            resolvedTranscriptSource.duration
                                          )
                                        : "--:--"}
                                    </span>
                                  </div>
                                  <svg
                                    viewBox="0 0 16 16"
                                    className="h-4 w-4 text-gray-500"
                                  >
                                    <path
                                      d="M5 10.936 8 14l3-3.064m0-5.872L8 2 5 5.064"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="1.4"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </button>
                                {isAiTranscriptSourceOpen && (
                                  <div className="absolute z-20 mt-2 w-full rounded-lg border border-gray-100 bg-white py-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
                                    {transcriptSourceOptions.map((option: any) => (
                                      <button
                                        key={option.id}
                                        type="button"
                                        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                                        onClick={() => {
                                          setTranscriptSource(option.id);
                                          setIsAiTranscriptSourceOpen(false);
                                        }}
                                      >
                                        <span className="truncate">
                                          {option.label}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                          {option.duration
                                            ? formatDuration(option.duration)
                                            : "--:--"}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">
                                  Include timestamps
                                </p>
                                <p className="text-xs text-gray-400">
                                  Add timecodes to each line.
                                </p>
                              </div>
                              <ToggleSwitch
                                checked={includeAiTranscriptTimestamps}
                                onChange={setIncludeAiTranscriptTimestamps}
                                ariaLabel="Include timestamps in transcript"
                              />
                            </div>
                            {transcriptError && (
                              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                                {transcriptError}
                              </div>
                            )}
                            <button
                              type="button"
                              className={`mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(51,92,255,0.3)] transition ${
                                transcriptStatus === "loading"
                                  ? "cursor-not-allowed bg-gray-300 shadow-none"
                                  : "bg-[#335CFF] hover:bg-[#274BFF]"
                              }`}
                              onClick={handleGenerateTranscriptClick}
                              disabled={transcriptStatus === "loading"}
                            >
                              {transcriptStatus === "loading"
                                ? "Generating Transcript..."
                                : "Generate Transcript"}
                            </button>
                          </div>
                          <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-gray-900">
                                    Transcript
                                  </p>
                                  {transcriptHasEdits && (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                      Edited
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400">
                                  {aiTranscriptSegments.length} lines
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {transcriptHasEdits && (
                                  <button
                                    type="button"
                                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                                    onClick={handleResetTranscriptDraft}
                                  >
                                    Reset
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                    transcriptDraft.trim()
                                      ? "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                      : "cursor-not-allowed border-gray-100 bg-gray-100 text-gray-400"
                                  }`}
                                  onClick={handleCopyTranscript}
                                  disabled={!transcriptDraft.trim()}
                                >
                                  {isTranscriptCopied ? "Copied" : "Copy"}
                                </button>
                                <button
                                  type="button"
                                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                    transcriptDraft.trim()
                                      ? "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                                      : "cursor-not-allowed border-gray-100 bg-gray-100 text-gray-400"
                                  }`}
                                  onClick={handleDownloadTranscript}
                                  disabled={!transcriptDraft.trim()}
                                >
                                  Download
                                </button>
                                <button
                                  type="button"
                                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                    aiTranscriptSegments.length > 0 ||
                                    transcriptDraft.trim()
                                      ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                                      : "cursor-not-allowed border-gray-100 bg-gray-100 text-gray-400"
                                  }`}
                                  onClick={() =>
                                    handleClearTranscript(transcriptSource)
                                  }
                                  disabled={
                                    aiTranscriptSegments.length === 0 &&
                                    !transcriptDraft.trim()
                                  }
                                >
                                  Clear
                                </button>
                              </div>
                            </div>
                            <div className="mt-3 max-h-[280px] overflow-y-auto rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-3">
                              {transcriptStatus === "loading" ? (
                                <div className="flex items-center justify-center gap-2 py-8 text-sm font-medium text-gray-500">
                                  <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
                                  Generating transcript...
                                </div>
                              ) : aiTranscriptSegments.length > 0 || transcriptHasEdits ? (
                                <textarea
                                  value={transcriptDraft}
                                  onChange={(event) => {
                                    setTranscriptDraft(event.target.value);
                                    setTranscriptHasEdits(true);
                                  }}
                                  rows={10}
                                  disabled={transcriptStatus === "loading"}
                                  placeholder="Edit transcript..."
                                  className="min-h-[220px] w-full resize-none bg-transparent text-xs leading-relaxed text-gray-700 placeholder:text-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                                />
                              ) : (
                                <p className="text-xs text-gray-400">
                                  Generate a transcript to see the text here.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : activeAiTool.id === "ai-image" ? (
                        <div className="space-y-4">
                          <div className="rounded-2xl border border-white/70 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                            <div className="flex items-center justify-between">
                              <label
                                htmlFor={activeAiToolInputId ?? undefined}
                                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400"
                              >
                                {activeAiTool.inputLabel}
                              </label>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className={`flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-[10px] font-semibold transition ${aiImageMagicButtonClass}`}
                                  onClick={() => {
                                    if (typeof handleAiImageImprovePrompt === "function") {
                                      handleAiImageImprovePrompt();
                                    }
                                  }}
                                  disabled={isAiImageMagicDisabled}
                                >
                                  <Sparkles className="h-3 w-3" />
                                  {aiImageMagicLoading ? "Enhancing" : "Magic"}
                                </button>
                              </div>
                            </div>
                            <textarea
                              id={activeAiToolInputId ?? undefined}
                              placeholder={activeAiTool.inputPlaceholder}
                              rows={4}
                              value={resolvedAiImagePrompt}
                              onChange={(event) => {
                                if (typeof setAiImagePrompt === "function") {
                                  setAiImagePrompt(event.target.value);
                                }
                              }}
                              className="mt-3 min-h-[110px] w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:border-[#5B6CFF] focus:outline-none"
                            />
                            {aiImageMagicError && (
                              <p className="mt-2 text-[11px] font-semibold text-rose-500">
                                {aiImageMagicError}
                              </p>
                            )}
                            <div className="mt-4">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                                Aspect Ratio
                              </p>
                              <p className="mt-1 text-[11px] text-gray-400">
                                Choose the format that matches where you'll use it.
                              </p>
                              <div className="mt-2">
                                <label className="sr-only" htmlFor="ai-image-aspect">
                                  Aspect ratio
                                </label>
                                <select
                                  id="ai-image-aspect"
                                  value={resolvedAiImageAspectRatio}
                                  onChange={(event) => {
                                    if (typeof setAiImageAspectRatio === "function") {
                                      setAiImageAspectRatio(event.target.value);
                                    }
                                  }}
                                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 focus:border-[#5B6CFF] focus:outline-none"
                                >
                                  {aiImageAspectRatioOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <button
                              type="button"
                              className={`mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(51,92,255,0.3)] transition ${
                                resolvedAiImageStatus === "loading" || !canGenerateAiImage
                                  ? "cursor-not-allowed bg-gray-300 shadow-none"
                                  : "bg-[#335CFF] hover:bg-[#274BFF]"
                              }`}
                              onClick={() => {
                                if (typeof handleAiImageGenerate === "function") {
                                  handleAiImageGenerate();
                                }
                              }}
                              disabled={resolvedAiImageStatus === "loading" || !canGenerateAiImage}
                            >
                              {resolvedAiImageStatus === "loading"
                                ? "Generating Image..."
                                : activeAiTool.actionLabel}
                            </button>
                          </div>
                          <div className="rounded-2xl border border-white/70 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                                {activeAiTool.outputLabel}
                              </p>
                              {aiImageSaving ? (
                                <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-600">
                                  Saving
                                </span>
                              ) : resolvedAiImageAssetId ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-600">
                                  Saved to Assets
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-3 rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-3 py-3">
                              {resolvedAiImageStatus === "loading" ? (
                                <div className="flex min-h-[140px] items-center justify-center gap-2 text-xs font-semibold text-gray-400">
                                  <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
                                  Generating image...
                                </div>
                              ) : resolvedAiImagePreviewUrl ? (
                                <div
                                  className="group flex w-full items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-white p-2 shadow-[0_6px_12px_rgba(15,23,42,0.06)]"
                                  draggable={Boolean(resolvedAiImageAssetId)}
                                  onDragStart={(event) => {
                                    if (
                                      resolvedAiImageAssetId &&
                                      typeof handleAssetDragStart === "function"
                                    ) {
                                      handleAssetDragStart(event, resolvedAiImageAssetId);
                                    }
                                  }}
                                >
                                  <img
                                    src={resolvedAiImagePreviewUrl}
                                    alt={resolvedAiImagePreview?.name ?? "Generated preview"}
                                    className="max-h-48 w-full rounded-md object-contain"
                                  />
                                </div>
                              ) : (
                                <div className="flex min-h-[140px] items-center justify-center text-xs font-semibold text-gray-400">
                                  Generate an image to see it here.
                                </div>
                              )}
                            </div>
                            {aiImageError && (
                              <p className="mt-2 text-[11px] font-semibold text-rose-500">
                                {aiImageError}
                              </p>
                            )}
                            {resolvedAiImagePreviewUrl && (
                              <div className="mt-3 flex items-center gap-2">
                                <button
                                  type="button"
                                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                                    resolvedAiImageAssetId
                                      ? "bg-[#335CFF] text-white hover:bg-[#274BFF]"
                                      : "cursor-not-allowed bg-gray-200 text-gray-500"
                                  }`}
                                  onClick={() => {
                                    if (typeof handleAiImageAddToTimeline === "function") {
                                      handleAiImageAddToTimeline();
                                    }
                                  }}
                                  disabled={!resolvedAiImageAssetId}
                                >
                                  Add to timeline
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
                                  onClick={() => {
                                    if (typeof handleAiImageClear === "function") {
                                      handleAiImageClear();
                                    }
                                  }}
                                >
                                  Clear
                                </button>
                              </div>
                            )}
                            {resolvedAiImagePreviewUrl ? (
                              <p className="mt-2 text-[11px] text-gray-400">
                                Drag onto the timeline or click Add to timeline. Clear removes it from Assets.
                              </p>
                            ) : null}
                            {aiImageLastPrompt && (
                              <p className="mt-2 text-[10px] text-gray-400">
                                Last prompt: {aiImageLastPrompt}
                                {aiImageLastAspectRatio
                                  ? ` · ${aiImageLastAspectRatio}`
                                  : ""}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : activeAiTool.id === "ai-video" ? (
                        <div className="space-y-4">
                          <div className="rounded-2xl border border-white/70 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                            <div className="flex items-center justify-between">
                              <label
                                htmlFor={activeAiToolInputId ?? undefined}
                                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400"
                              >
                                {activeAiTool.inputLabel}
                              </label>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className={`flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-[10px] font-semibold transition ${aiVideoMagicButtonClass}`}
                                  onClick={() => {
                                    if (typeof handleAiVideoImprovePrompt === "function") {
                                      handleAiVideoImprovePrompt();
                                    }
                                  }}
                                  disabled={isAiVideoMagicDisabled}
                                >
                                  <Sparkles className="h-3 w-3" />
                                  {aiVideoMagicLoading ? "Enhancing" : "Magic"}
                                </button>
                              </div>
                            </div>
                            <textarea
                              id={activeAiToolInputId ?? undefined}
                              placeholder={activeAiTool.inputPlaceholder}
                              rows={4}
                              value={resolvedAiVideoPrompt}
                              onChange={(event) => {
                                if (typeof setAiVideoPrompt === "function") {
                                  setAiVideoPrompt(event.target.value);
                                }
                              }}
                              className="mt-3 min-h-[110px] w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:border-[#5B6CFF] focus:outline-none"
                            />
                            {aiVideoMagicError && (
                              <p className="mt-2 text-[11px] font-semibold text-rose-500">
                                {aiVideoMagicError}
                              </p>
                            )}
                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                                  Aspect Ratio
                                </p>
                                <label className="sr-only" htmlFor="ai-video-aspect">
                                  Aspect ratio
                                </label>
                                <select
                                  id="ai-video-aspect"
                                  value={resolvedAiVideoAspectRatio}
                                  onChange={(event) => {
                                    if (typeof setAiVideoAspectRatio === "function") {
                                      setAiVideoAspectRatio(event.target.value);
                                    }
                                  }}
                                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 focus:border-[#5B6CFF] focus:outline-none"
                                >
                                  {aiVideoAspectRatioOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                                  Duration
                                </p>
                                <label className="sr-only" htmlFor="ai-video-duration">
                                  Duration
                                </label>
                                <select
                                  id="ai-video-duration"
                                  value={resolvedAiVideoDuration}
                                  onChange={(event) => {
                                    const nextValue = Number(event.target.value);
                                    if (
                                      typeof setAiVideoDuration === "function" &&
                                      Number.isFinite(nextValue)
                                    ) {
                                      setAiVideoDuration(nextValue);
                                    }
                                  }}
                                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 focus:border-[#5B6CFF] focus:outline-none"
                                >
                                  {aiVideoDurationOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="mt-4 space-y-3">
                              <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">
                                    Generate audio
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    Include audio with the clip.
                                  </p>
                                </div>
                                <ToggleSwitch
                                  checked={resolvedAiVideoGenerateAudio}
                                  onChange={(next) => {
                                    if (typeof setAiVideoGenerateAudio === "function") {
                                      setAiVideoGenerateAudio(next);
                                    }
                                    if (typeof setAiVideoSplitAudio === "function") {
                                      setAiVideoSplitAudio(next);
                                    }
                                  }}
                                  ariaLabel="Generate audio with video"
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              className={`mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(51,92,255,0.3)] transition ${
                                resolvedAiVideoStatus === "loading" || !canGenerateAiVideo
                                  ? "cursor-not-allowed bg-gray-300 shadow-none"
                                  : "bg-[#335CFF] hover:bg-[#274BFF]"
                              }`}
                              onClick={() => {
                                if (typeof handleAiVideoGenerate === "function") {
                                  handleAiVideoGenerate();
                                }
                              }}
                              disabled={resolvedAiVideoStatus === "loading" || !canGenerateAiVideo}
                            >
                              {resolvedAiVideoStatus === "loading"
                                ? "Generating Video..."
                                : activeAiTool.actionLabel}
                            </button>
                            {aiVideoError && (
                              <p className="mt-2 text-[11px] font-semibold text-rose-500">
                                {aiVideoError}
                              </p>
                            )}
                            {resolvedAiVideoStatus === "loading" && (
                              <p className="mt-2 text-[11px] font-semibold text-gray-400">
                                This can take 2-5 minutes to generate.
                              </p>
                            )}
                            {resolvedAiVideoAssetId && (
                              <div className="mt-3 flex items-center gap-2">
                                <button
                                  type="button"
                                  className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
                                  onClick={() => {
                                    if (typeof handleAiVideoClear === "function") {
                                      handleAiVideoClear();
                                    }
                                  }}
                                >
                                  Clear
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : activeAiTool.id === "ai-background-removal" ? (
                        <div className="space-y-3">
                          <div className="rounded-2xl border border-white/70 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                                Clip
                              </p>
                              {resolvedAiBackgroundRemovalStatus === "loading" ? (
                                <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-600">
                                  Working
                                </span>
                              ) : showBackgroundRemovalAdded ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-600">
                                  Added
                                </span>
                              ) : null}
                            </div>
                            {resolvedAiBackgroundRemovalSelection.state === "ready" ? (
                              <div className="mt-3 rounded-xl border border-gray-100 bg-white px-3 py-2">
                                <p className="truncate text-xs font-semibold text-gray-900">
                                  {resolvedAiBackgroundRemovalSelection.label ?? "Selected clip"}
                                </p>
                                {backgroundRemovalDuration !== null && (
                                  <p className="text-[10px] text-gray-400">
                                    {formatDuration(backgroundRemovalDuration)}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="mt-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-xs font-semibold text-gray-400">
                                {backgroundRemovalSelectionMessage}
                              </div>
                            )}
                            <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                              <p className="text-sm font-semibold text-gray-900">
                                Subject is person
                              </p>
                              <ToggleSwitch
                                checked={resolvedAiBackgroundRemovalSubjectIsPerson}
                                onChange={(next) => {
                                  if (
                                    typeof setAiBackgroundRemovalSubjectIsPerson ===
                                    "function"
                                  ) {
                                    setAiBackgroundRemovalSubjectIsPerson(next);
                                  }
                                }}
                                ariaLabel="Subject is person"
                              />
                            </div>
                            {resolvedAiBackgroundRemovalError && (
                              <p className="mt-2 text-[11px] font-semibold text-rose-500">
                                {resolvedAiBackgroundRemovalError}
                              </p>
                            )}
                            <button
                              type="button"
                              className={`mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(51,92,255,0.3)] transition ${
                                resolvedAiBackgroundRemovalStatus === "loading" ||
                                !canRemoveBackground
                                  ? "cursor-not-allowed bg-gray-300 shadow-none"
                                  : "bg-[#335CFF] hover:bg-[#274BFF]"
                              }`}
                              onClick={() => {
                                if (typeof handleAiBackgroundRemoval === "function") {
                                  handleAiBackgroundRemoval();
                                }
                              }}
                              disabled={
                                resolvedAiBackgroundRemovalStatus === "loading" ||
                                !canRemoveBackground
                              }
                            >
                              {resolvedAiBackgroundRemovalStatus === "loading"
                                ? "Removing Background..."
                                : activeAiTool.actionLabel}
                            </button>
                          </div>
                        </div>
                      ) : activeAiTool.id === "ai-voiceover" ? (
                        <div className="space-y-4">
                          <div className="rounded-2xl border border-white/70 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                            <div className="flex items-center justify-between">
                              <label
                                htmlFor={activeAiToolInputId ?? undefined}
                                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400"
                              >
                                {activeAiTool.inputLabel}
                              </label>
                              <span className="text-[10px] font-semibold text-gray-400">
                                Input
                              </span>
                            </div>
                            <textarea
                              id={activeAiToolInputId ?? undefined}
                              placeholder={activeAiTool.inputPlaceholder}
                              rows={4}
                              value={resolvedAiVoiceoverScript}
                              onChange={(event) => {
                                if (typeof setAiVoiceoverScript === "function") {
                                  setAiVoiceoverScript(event.target.value);
                                }
                              }}
                              className="mt-3 min-h-[110px] w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:border-[#5B6CFF] focus:outline-none"
                            />
                            <div className="mt-4">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                                  Voice
                                </p>
                                <span className="text-[10px] font-semibold text-gray-400">
                                  {resolvedAiVoiceoverSelectedVoice
                                    ? `Selected: ${resolvedAiVoiceoverSelectedVoice}`
                                    : "Select a voice"}
                                </span>
                              </div>
                              <div className="mt-2">
                                {!hasSupabase ? (
                                  <div className="rounded-xl border border-dashed border-gray-200 px-4 py-4 text-center text-xs text-gray-400">
                                    Connect Supabase to load voice previews.
                                  </div>
                                ) : aiVoiceoverVoicesStatus === "loading" ||
                                  aiVoiceoverVoicesStatus === "idle" ? (
                                  <div className="space-y-2">
                                    {Array.from({ length: 4 }).map((_, index) => (
                                      <div
                                        key={`voice-skeleton-${index}`}
                                        className="h-12 rounded-xl bg-gray-100/80 animate-pulse"
                                      />
                                    ))}
                                  </div>
                                ) : aiVoiceoverVoicesStatus === "error" ? (
                                  <div className="rounded-xl border border-dashed border-red-200 bg-red-50/40 px-4 py-4 text-center text-xs text-red-600">
                                    <p>
                                      {aiVoiceoverVoicesError ??
                                        "Unable to load voice previews."}
                                    </p>
                                    <button
                                      type="button"
                                      className="mt-3 rounded-full bg-red-100 px-3 py-1 text-[11px] font-semibold text-red-700 transition hover:bg-red-200"
                                      onClick={() => {
                                        if (typeof handleAiVoiceoverVoicesRetry === "function") {
                                          handleAiVoiceoverVoicesRetry();
                                        }
                                      }}
                                    >
                                      Retry
                                    </button>
                                  </div>
                                ) : resolvedAiVoiceoverVoices.length === 0 ? (
                                  <div className="rounded-xl border border-dashed border-gray-200 px-4 py-4 text-center text-xs text-gray-400">
                                    No voice previews found.
                                  </div>
                                ) : (
                                  <div className="grid gap-2">
                                    {resolvedAiVoiceoverVoices.map((voice: any) => {
                                      const isSelected =
                                        voice.voice === resolvedAiVoiceoverSelectedVoice;
                                      const isPlaying =
                                        previewTrackId === voice.id && isPreviewPlaying;
                                      return (
                                        <div
                                          key={voice.id}
                                          className={`group flex items-center justify-between rounded-xl border px-3 py-2 transition ${
                                            isSelected
                                              ? "border-[#335CFF] bg-[#EEF2FF]"
                                              : "border-gray-200 bg-white hover:border-[#DDE3FF]"
                                          }`}
                                        >
                                          <button
                                            type="button"
                                            className="flex-1 text-left"
                                            onClick={() => {
                                              if (
                                                typeof setAiVoiceoverSelectedVoice ===
                                                "function"
                                              ) {
                                                setAiVoiceoverSelectedVoice(voice.voice);
                                              }
                                            }}
                                            aria-pressed={isSelected}
                                          >
                                            <div className="truncate text-sm font-semibold text-gray-900">
                                              {voice.name}
                                            </div>
                                          </button>
                                          <button
                                            type="button"
                                            className={`ml-3 flex h-9 w-9 items-center justify-center rounded-full border text-[#335CFF] transition ${
                                              isPlaying
                                                ? "border-[#335CFF] bg-white shadow-[0_6px_14px_rgba(51,92,255,0.2)]"
                                                : "border-gray-200 bg-white hover:border-[#C7D2FE]"
                                            }`}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              if (
                                                typeof handleAiVoiceoverPreviewToggle ===
                                                "function"
                                              ) {
                                                handleAiVoiceoverPreviewToggle(voice);
                                              }
                                            }}
                                            aria-label={
                                              isPlaying
                                                ? "Pause voice preview"
                                                : "Play voice preview"
                                            }
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
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              className={`mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(51,92,255,0.3)] transition ${
                                resolvedAiVoiceoverStatus === "loading" || !canGenerateAiVoiceover
                                  ? "cursor-not-allowed bg-gray-300 shadow-none"
                                  : "bg-[#335CFF] hover:bg-[#274BFF]"
                              }`}
                              onClick={() => {
                                if (typeof handleAiVoiceoverGenerate === "function") {
                                  handleAiVoiceoverGenerate();
                                }
                              }}
                              disabled={
                                resolvedAiVoiceoverStatus === "loading" ||
                                !canGenerateAiVoiceover
                              }
                            >
                              {resolvedAiVoiceoverStatus === "loading"
                                ? "Generating Voiceover..."
                                : activeAiTool.actionLabel}
                            </button>
                          </div>
                          <div className="rounded-2xl border border-white/70 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                                {activeAiTool.outputLabel}
                              </p>
                              {aiVoiceoverSaving ? (
                                <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-600">
                                  Saving
                                </span>
                              ) : resolvedAiVoiceoverAssetId ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-600">
                                  Saved to Assets
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-3 rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-3 py-3">
                              {resolvedAiVoiceoverStatus === "loading" ? (
                                <div className="flex min-h-[140px] items-center justify-center gap-2 text-xs font-semibold text-gray-400">
                                  <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
                                  Generating voiceover...
                                </div>
                              ) : resolvedAiVoiceoverPreviewUrl ? (
                                <div
                                  className="rounded-lg border border-gray-100 bg-white p-3 shadow-[0_6px_12px_rgba(15,23,42,0.06)]"
                                  draggable={Boolean(resolvedAiVoiceoverAssetId)}
                                  onDragStart={(event) => {
                                    if (
                                      resolvedAiVoiceoverAssetId &&
                                      typeof handleAssetDragStart === "function"
                                    ) {
                                      handleAssetDragStart(
                                        event,
                                        resolvedAiVoiceoverAssetId
                                      );
                                    }
                                  }}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="truncate text-xs font-semibold text-gray-700">
                                        {resolvedAiVoiceoverPreview?.name ??
                                          "Generated voiceover"}
                                      </p>
                                      <p className="text-[10px] text-gray-400">
                                        {resolvedAiVoiceoverPreview?.voice
                                          ? `Voice: ${resolvedAiVoiceoverPreview.voice}`
                                          : "Voiceover"}
                                        {typeof resolvedAiVoiceoverPreview?.duration ===
                                        "number"
                                          ? ` · ${formatDuration(
                                              resolvedAiVoiceoverPreview.duration
                                            )}`
                                          : ""}
                                      </p>
                                    </div>
                                  </div>
                                  <audio
                                    controls
                                    preload="metadata"
                                    src={resolvedAiVoiceoverPreviewUrl}
                                    className="mt-2 w-full"
                                  />
                                </div>
                              ) : (
                                <div className="flex min-h-[140px] items-center justify-center text-xs font-semibold text-gray-400">
                                  Generate a voiceover to hear it here.
                                </div>
                              )}
                            </div>
                            {aiVoiceoverError && (
                              <p className="mt-2 text-[11px] font-semibold text-rose-500">
                                {aiVoiceoverError}
                              </p>
                            )}
                            {resolvedAiVoiceoverPreviewUrl && (
                              <div className="mt-3 flex items-center gap-2">
                                <button
                                  type="button"
                                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                                    resolvedAiVoiceoverAssetId
                                      ? "bg-[#335CFF] text-white hover:bg-[#274BFF]"
                                      : "cursor-not-allowed bg-gray-200 text-gray-500"
                                  }`}
                                  onClick={() => {
                                    if (
                                      typeof handleAiVoiceoverAddToTimeline === "function"
                                    ) {
                                      handleAiVoiceoverAddToTimeline();
                                    }
                                  }}
                                  disabled={!resolvedAiVoiceoverAssetId}
                                >
                                  Add to timeline
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
                                  onClick={() => {
                                    if (typeof handleAiVoiceoverClear === "function") {
                                      handleAiVoiceoverClear();
                                    }
                                  }}
                                >
                                  Clear
                                </button>
                              </div>
                            )}
                            {resolvedAiVoiceoverPreviewUrl ? (
                              <p className="mt-2 text-[11px] text-gray-400">
                                Drag onto the timeline or click Add to timeline. Clear removes it
                                from Assets.
                              </p>
                            ) : null}
                            {aiVoiceoverLastScript && (
                              <p className="mt-2 text-[10px] text-gray-400">
                                Last script: {aiVoiceoverLastScript}
                                {aiVoiceoverLastVoice ? ` · ${aiVoiceoverLastVoice}` : ""}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="rounded-2xl border border-white/70 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                            <div className="flex items-center justify-between">
                              <label
                                htmlFor={
                                  activeAiTool.inputKind === "prompt"
                                    ? activeAiToolInputId ?? undefined
                                    : undefined
                                }
                                className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400"
                              >
                                {activeAiTool.inputLabel}
                              </label>
                              <span className="text-[10px] font-semibold text-gray-400">
                                Input
                              </span>
                            </div>
                            {activeAiTool.inputKind === "dropzone" ? (
                              <button
                                type="button"
                                className="mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-3 py-6 text-center transition hover:border-gray-300 hover:bg-gray-50"
                                aria-label={activeAiTool.inputPlaceholder}
                              >
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                                  <Upload className="h-5 w-5 text-[#1a1240]" />
                                </span>
                                <span className="text-xs font-semibold text-gray-700">
                                  Drop files to upload
                                </span>
                                <span className="text-[11px] text-gray-400">
                                  {activeAiTool.inputPlaceholder}
                                </span>
                              </button>
                            ) : (
                              <textarea
                                id={activeAiToolInputId ?? undefined}
                                placeholder={activeAiTool.inputPlaceholder}
                                rows={4}
                                className="mt-3 min-h-[110px] w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 placeholder:text-gray-400 focus:border-[#5B6CFF] focus:outline-none"
                              />
                            )}
                            {activeAiTool.chips && (
                              <div className="mt-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                                  {activeAiTool.chipLabel}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {activeAiTool.chips.map((chip) => (
                                    <button
                                      key={chip}
                                      type="button"
                                      className="rounded-full bg-[#EEF2FF] px-3 py-1.5 text-[11px] font-semibold text-[#335CFF] transition hover:bg-[#E0E7FF]"
                                    >
                                      {chip}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            <button
                              type="button"
                              className="mt-4 w-full rounded-xl bg-[#335CFF] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(51,92,255,0.3)] transition hover:bg-[#274BFF]"
                            >
                              {activeAiTool.actionLabel}
                            </button>
                          </div>
                          <div className="rounded-2xl border border-white/70 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                                {activeAiTool.outputLabel}
                              </p>
                              <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-500">
                                Preview
                              </span>
                            </div>
                            <div className="mt-3 rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-3 py-3">
                              {activeAiTool.outputKind === "grid" ? (
                                <div className="grid grid-cols-2 gap-2">
                                  {Array.from({ length: 4 }).map((_, index) => (
                                    <div
                                      key={`ai-grid-${index}`}
                                      className="aspect-[4/3] rounded-lg border border-gray-100 bg-white shadow-[0_6px_12px_rgba(15,23,42,0.06)]"
                                    />
                                  ))}
                                </div>
                              ) : activeAiTool.outputKind === "preview" ? (
                                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gradient-to-br from-gray-100 to-gray-200">
                                  <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-400">
                                    Preview
                                  </div>
                                </div>
                              ) : activeAiTool.outputKind === "waveform" ? (
                                <div className="flex h-16 items-end gap-1">
                                  {aiWaveformHeights.map((height, index) => (
                                    <div
                                      key={`ai-wave-${index}`}
                                      className="w-2 rounded-full bg-[#CBD5F5]"
                                      style={{ height: `${height}px` }}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {aiListWidths.map((width, index) => (
                                    <div
                                      key={`ai-line-${index}`}
                                      className="h-2 rounded-full bg-[#E2E8F0]"
                                      style={{ width: `${width}%` }}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                            <p className="mt-2 text-[11px] text-gray-400">
                              {activeAiTool.outputHint}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {aiToolConfigs.map((tool) => {
                        const Icon = tool.icon;
                        const isAiDevenCard = tool.id === "ai-deven";
                        return (
                          <button
                            key={tool.id}
                            type="button"
                            className="group flex flex-col rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30 focus-visible:ring-offset-2"
                            onClick={() => setActiveAiToolId(tool.id)}
                            aria-label={`Open ${tool.title}`}
                          >
                            <div
                              className={`relative flex h-24 items-center justify-center rounded-xl bg-gradient-to-br ${tool.gradient}`}
                            >
                              <div
                                className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg ${
                                  isAiDevenCard ? "bg-[#FF0033]" : "bg-white"
                                }`}
                              >
                                <Icon
                                  className={`h-5 w-5 ${
                                    isAiDevenCard ? "text-white" : "text-[#1a1240]"
                                  }`}
                                  {...(isAiDevenCard
                                    ? { fill: "currentColor", stroke: "none" }
                                    : {})}
                                />
                              </div>
                            </div>
                            <p className="mt-3 text-sm font-semibold text-gray-900">
                              {tool.title}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
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
  
});

EditorSidebar.displayName = "EditorSidebar";
