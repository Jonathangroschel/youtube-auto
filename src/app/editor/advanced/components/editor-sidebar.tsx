"use client";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { panelButtonClass, panelCardClass, speedPresets } from "../constants";

import {
  backgroundSwatches,
  mediaFilters,
  subtitleStylePresets,
  subtitleStyleFilters,
  textFontFamilies,
  textLetterSpacingOptions,
  textLineHeightOptions,
  textPresetTags,
  textStylePresets,
} from "../data";

import { clamp, formatDuration, formatSize, formatTimeWithTenths } from "../utils";

import {
  getPresetPreviewFontSize,
  getTextRenderStyles,
  resolveFontFamily,
  resolveGiphyPreviewUrl,
  stockMusicRootPrefix,
  stockVideoRootPrefix,
  toRgba,
} from "../page-helpers";

import type { TextClipSettings } from "../types";

import { GiphyLogo } from "./giphy-logo";
import { SliderField } from "./slider-field";
import { StockVideoCard } from "./stock-video-card";
import { ToggleSwitch } from "./toggle-switch";

type EditorSidebarProps = Record<string, any>;

export const EditorSidebar = memo((props: EditorSidebarProps) => {
  const {
    activeAssetId,
    activeTool,
    activeToolLabel,
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
    groupedStockMusic,
    groupedStockVideos,
    handleAddGif,
    handleAddSticker,
    handleAddStockAudio,
    handleAddStockVideo,
    handleAssetDragStart,
    handleDeleteSelected,
    handleDetachAudio,
    handleEndTimeCommit,
    handleGifTrendingRetry,
    handleGenerateSubtitles,
    handleReplaceVideo,
    handleSetEndAtPlayhead,
    handleSetStartAtPlayhead,
    handleStartTimeCommit,
    handleSubtitleAddLine,
    handleSubtitleDelete,
    handleSubtitleDeleteAll,
    handleSubtitleDetachToggle,
    handleSubtitleShiftAll,
    handleSubtitleTextUpdate,
    handleStickerTrendingRetry,
    handleStockMusicRetry,
    handleStockPreviewToggle,
    handleStockVideoPreviewStart,
    handleStockVideoPreviewStop,
    handleStockVideoRetry,
    handleTextPresetSelect,
    handleTextStylePresetSelect,
    handleUploadClick,
    hasGiphy,
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
    selectedTextEntry,
    selectedVideoEntry,
    selectedVideoSettings,
    setActiveCanvasClipId,
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
    setShowAllStockTags,
    setShowAllStockVideoTags,
    setStickerSearch,
    setStockCategory,
    setStockSearch,
    setStockVideoCategory,
    setStockVideoOrientation,
    setStockVideoSearch,
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
    setVideoBackground,
    setVideoPanelView,
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
    detachedSubtitleIds,
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
    visibleStockTags,
    visibleStockVideoTags,
    visibleTextPresetGroups,
  } = props;

  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const rowMenuRef = useRef<HTMLDivElement | null>(null);
  const [subtitleProgress, setSubtitleProgress] = useState(0);
  const [subtitleSettingsOpen, setSubtitleSettingsOpen] = useState(false);
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

  const recentStylePreset =
    subtitleStylePresets.find((preset) => preset.id === subtitleStyleId) ??
    subtitleStylePresets[0];
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

  const activeSubtitleMenuSegment = subtitleRowMenu.segmentId
    ? subtitleSegments.find(
        (segment: { id: string }) => segment.id === subtitleRowMenu.segmentId
      ) ?? null
    : null;
  const isSubtitleMenuDetached = activeSubtitleMenuSegment
    ? detachedSubtitleIds?.has(activeSubtitleMenuSegment.clipId)
    : false;


  const isAudioTool = activeTool === "audio";
  const useAudioLibraryLayout = isAudioTool && !isAssetLibraryExpanded;
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
  }, [subtitleStyleFilter]);
  const hasSubtitleResults = subtitleSegments?.length > 0;

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
          !(isStockVideoExpanded && activeTool === "video") &&
          !(isGifLibraryExpanded && activeTool === "image") &&
          !(isStickerLibraryExpanded && activeTool === "elements") && (
          <div
            className={`sticky top-0 z-10 border-b border-gray-100/70 bg-white/95 backdrop-blur ${activeTool === "text" ? "px-6 py-6" : "px-5 py-5"
              }`}
          >
            {activeTool === "subtitles" ? (
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
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-gray-100 text-[10px] font-semibold text-gray-600">
                        {subtitleLanguage?.region ?? "US"}
                      </span>
                      <span className="text-sm font-semibold">
                        {subtitleLanguage?.label ?? "English"}
                      </span>
                      <svg viewBox="0 0 16 16" className="h-3 w-3 text-gray-400">
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
                            className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-gray-100 bg-white p-2 shadow-[0_16px_30px_rgba(15,23,42,0.12)]"
                          >
                            <button
                              type="button"
                              data-testid="@editor/subtitles/settings-cog/shift-all"
                              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
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
                              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
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
                              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
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
                    {stickerGridItems.map((sticker) => {
                      const previewUrl = resolveGiphyPreviewUrl(sticker);
                      const title = sticker.title?.trim() || "Sticker";
                      return (
                        <button
                          key={sticker.id}
                          type="button"
                          className="group relative h-24 w-full overflow-hidden rounded-xl border border-gray-200 transition hover:border-gray-300"
                          onClick={() => handleAddSticker(sticker)}
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
          ) : isGifLibraryExpanded && activeTool === "image" ? (
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
                    {gifGridItems.map((gif) => {
                      const previewUrl = resolveGiphyPreviewUrl(gif);
                      const title = gif.title?.trim() || "GIF";
                      return (
                        <button
                          key={gif.id}
                          type="button"
                          className="group relative h-24 w-full overflow-hidden rounded-xl border border-gray-200 transition hover:border-gray-300"
                          onClick={() => handleAddGif(gif)}
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
                    ...go and grab yourself a snack, or continue editing this project.
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
                <div className="flex flex-1 flex-col">
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
                  {subtitleActiveTab === "style" ? (
                    <div className="flex-1 px-6 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-[0_16px_28px_rgba(15,23,42,0.12)]">
                          <div className="relative h-20 overflow-hidden rounded-t-xl bg-gradient-to-br from-slate-400/80 via-slate-500/70 to-slate-700/70">
                            <div className="absolute left-2 top-2 z-10 flex items-center gap-1">
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-gray-500 shadow-sm">
                                <svg viewBox="0 0 12 12" className="h-3.5 w-3.5">
                                  <path
                                    d="M6 3V6L7.5 7.5M11 6C11 8.76142 8.76142 11 6 11C3.23858 11 1 8.76142 1 6C1 3.23858 3.23858 1 6 1C8.76142 1 11 3.23858 11 6Z"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </div>
                            </div>
                            <div className="flex h-full items-center justify-center px-2 text-center text-white">
                              <span
                                className="max-h-10 overflow-hidden text-xs font-semibold leading-snug"
                                style={recentStylePreview?.textStyle}
                              >
                                {recentStylePreset?.preview?.text ?? "Recent style"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between px-3 py-2">
                            <span className="text-sm font-medium text-gray-700">
                              Recent style
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-md bg-[#5B6CFF] px-2 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#4B5BEE]"
                              >
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20">
                                  <svg viewBox="0 0 8 12" className="h-3 w-3">
                                    <path
                                      d="M4.941 5.4h2.588c.364 0 .59.336.406.602L3.935 11.802c-.243.352-.876.206-.876-.202V6.6H.471c-.364 0-.59-.336-.406-.602L4.065.198c.243-.352.876-.206.876.202V5.4Z"
                                      fill="currentColor"
                                    />
                                  </svg>
                                </span>
                                Save
                              </button>
                              <button
                                type="button"
                                className="rounded-md bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600 transition hover:bg-gray-200"
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        </div>
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
                            <button
                              key={preset.id}
                              type="button"
                              className={`group overflow-hidden rounded-xl border text-left shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 ${
                                isSelected
                                  ? "border-[#5B6CFF] ring-1 ring-[#5B6CFF]/30"
                                  : "border-gray-200 hover:border-gray-300"
                              }`}
                              onClick={() => applySubtitleStyle(preset.id)}
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
                                <span className="rounded-md bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600 opacity-0 transition group-hover:opacity-100">
                                  Edit
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 px-6 py-4">
                      <div className="space-y-3">
                        {subtitleSegments.map((segment) => {
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
                          return (
                            <div
                              key={segment.id}
                              className={`rounded-xl border px-3 py-3 shadow-sm transition ${
                                isDetached
                                  ? "border-amber-200 bg-amber-50/50"
                                  : "border-gray-100 bg-white"
                              }`}
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
                                  rows={2}
                                  className="min-h-[52px] w-full resize-none rounded-lg border border-transparent bg-transparent text-sm font-medium text-gray-700 outline-none focus:border-[#5B6CFF] focus:bg-white"
                                />
                                <div className="flex flex-col items-end gap-2">
                                  {showSubtitleTimings && clip && (
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          className="flex h-7 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-[11px] font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50"
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
                                          className="h-7 w-20 rounded-md border border-gray-200 bg-white px-2 text-right text-[11px] font-semibold text-gray-700 shadow-sm"
                                        />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          className="flex h-7 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-[11px] font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50"
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
                                          className="h-7 w-20 rounded-md border border-gray-200 bg-white px-2 text-right text-[11px] font-semibold text-gray-700 shadow-sm"
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
                      data-testid="@editor/subtitles/subtitles-editor/row/options/style-scope-toggle"
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      onClick={() => {
                        if (activeSubtitleMenuSegment?.clipId) {
                          handleSubtitleDetachToggle(
                            activeSubtitleMenuSegment.clipId
                          );
                        }
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
                        <path d="m8.943 11.771-1.414 1.414a3.333 3.333 0 0 1-4.714-4.714l1.414-1.414M7.057 4.23l1.414-1.414a3.333 3.333 0 0 1 4.714 4.714l-1.414 1.414" />
                      </svg>
                      {isSubtitleMenuDetached ? "Attach" : "Detach"}
                    </button>
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

                  {activeTool === "audio" && (
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
                                        onMouseEnter={() =>
                                          requestStockAudioDuration(track)
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
                            {gifPreviewItems.map((gif) => {
                              const previewUrl = resolveGiphyPreviewUrl(gif);
                              const title = gif.title?.trim() || "GIF";
                              return (
                                <button
                                  key={gif.id}
                                  type="button"
                                  className="group relative h-full w-full overflow-hidden rounded-xl border border-gray-200 transition hover:border-gray-300"
                                  onClick={() => handleAddGif(gif)}
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
              ) : activeTool === "elements" ? (
                <div className="space-y-4">
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
                          {stickerPreviewItems.map((sticker) => {
                            const previewUrl = resolveGiphyPreviewUrl(sticker);
                            const title = sticker.title?.trim() || "Sticker";
                            return (
                              <button
                                key={sticker.id}
                                type="button"
                                className="group relative h-full w-full overflow-hidden rounded-xl border border-gray-200 transition hover:border-gray-300"
                                onClick={() => handleAddSticker(sticker)}
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
