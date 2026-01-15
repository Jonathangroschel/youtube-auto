import type { FloatingMenuState, LaneType, TimelineContextMenuState, TransformHandle } from "./types";

// Timing and duration constants
export const fallbackDuration = 8;
export const minClipDuration = 1;
export const timelineScaleMin = 0.02;
export const timelineScaleMax = 24;
export const snapInterval = 0.5;
export const frameStepSeconds = 1 / 30;
export const maxHistoryEntries = 100;

// Dimension constants
export const laneGap = 10;
export const timelinePadding = 16;
export const defaultTimelineHeight = 260;
export const minCanvasHeight = 80;
export const timelineHandleHeight = 16;
export const minLayerSize = 80;
export const snapThresholdPx = 8;

export const laneHeights: Record<LaneType, number> = {
  video: 56,
  audio: 40,
  text: 32,
};

// Transform handles configuration
export const transformHandles: Array<{
  id: TransformHandle;
  className: string;
  cursor: string;
}> = [
  {
    id: "nw",
    className: "left-0 top-0 translate-x-1/2 translate-y-1/2",
    cursor: "cursor-nwse-resize",
  },
  {
    id: "n",
    className: "left-1/2 top-0 -translate-x-1/2 translate-y-1/2",
    cursor: "cursor-ns-resize",
  },
  {
    id: "ne",
    className: "right-0 top-0 -translate-x-1/2 translate-y-1/2",
    cursor: "cursor-nesw-resize",
  },
  {
    id: "e",
    className: "right-0 top-1/2 -translate-x-1/2 -translate-y-1/2",
    cursor: "cursor-ew-resize",
  },
  {
    id: "se",
    className: "right-0 bottom-0 -translate-x-1/2 -translate-y-1/2",
    cursor: "cursor-nwse-resize",
  },
  {
    id: "s",
    className: "left-1/2 bottom-0 -translate-x-1/2 -translate-y-1/2",
    cursor: "cursor-ns-resize",
  },
  {
    id: "sw",
    className: "left-0 bottom-0 translate-x-1/2 -translate-y-1/2",
    cursor: "cursor-nesw-resize",
  },
  {
    id: "w",
    className: "left-0 top-1/2 translate-x-1/2 -translate-y-1/2",
    cursor: "cursor-ew-resize",
  },
];

// Speed presets
export const speedPresets = [0.5, 1, 1.5, 2];

// CSS class strings
export const panelCardClass =
  "rounded-xl border border-gray-200/70 bg-white px-4 py-4 shadow-[0_8px_18px_rgba(15,23,42,0.06)]";
export const panelButtonClass =
  "flex w-full items-center gap-2 rounded-xl border border-gray-200/70 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-[0_6px_14px_rgba(15,23,42,0.05)] transition hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30 focus-visible:ring-offset-2";
export const floaterSurfaceClass =
  "rounded-2xl border border-white/80 bg-white/95 shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur";
export const floaterButtonClass =
  "flex h-9 w-9 items-center justify-center rounded-xl text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30";
export const floaterPillClass =
  "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30";
export const floaterMenuItemClass =
  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30";

// Floating menu dimensions
export const floaterMenuWidth = 180;
export const floaterSubmenuWidth = 200;
export const floaterPanelWidth = 240;

// Default floating menu state
export const defaultFloatingMenuState: FloatingMenuState = {
  open: false,
  x: 0,
  y: 0,
  clipId: null,
  showMore: false,
  showOrder: false,
  showVolume: false,
  showSpeed: false,
  showOpacity: false,
  showCorners: false,
  showTiming: false,
};

// Image/text duration constants
export const imageMaxDuration = 3600;
export const defaultTextDuration = 5;

// Default timeline context menu state
export const defaultTimelineContextMenuState: TimelineContextMenuState = {
  open: false,
  x: 0,
  y: 0,
  clipId: null,
  showReplaceMedia: false,
  showAudio: false,
};

// Timeline context menu dimensions
export const timelineContextMenuWidth = 200;
