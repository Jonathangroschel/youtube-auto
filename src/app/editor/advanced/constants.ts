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
export const clipTransformMaxScale = 4;
export const snapThresholdPx = 8;

export const laneHeights: Record<LaneType, number> = {
  video: 56,
  audio: 40,
  text: 32,
};

// Transform handles configuration
// isCorner: true = proportional scaling (maintains aspect ratio)
// isCorner: false = edge handles for non-proportional cropping
export const transformHandles: Array<{
  id: TransformHandle;
  className: string;
  cursor: string;
  isCorner: boolean;
}> = [
  {
    id: "nw",
    className: "left-0 top-0 translate-x-1/2 translate-y-1/2",
    cursor: "cursor-nwse-resize",
    isCorner: true,
  },
  {
    id: "n",
    className: "left-1/2 top-0 -translate-x-1/2 translate-y-1/2",
    cursor: "cursor-ns-resize",
    isCorner: false,
  },
  {
    id: "ne",
    className: "right-0 top-0 -translate-x-1/2 translate-y-1/2",
    cursor: "cursor-nesw-resize",
    isCorner: true,
  },
  {
    id: "e",
    className: "right-0 top-1/2 -translate-x-1/2 -translate-y-1/2",
    cursor: "cursor-ew-resize",
    isCorner: false,
  },
  {
    id: "se",
    className: "right-0 bottom-0 -translate-x-1/2 -translate-y-1/2",
    cursor: "cursor-nwse-resize",
    isCorner: true,
  },
  {
    id: "s",
    className: "left-1/2 bottom-0 -translate-x-1/2 -translate-y-1/2",
    cursor: "cursor-ns-resize",
    isCorner: false,
  },
  {
    id: "sw",
    className: "left-0 bottom-0 translate-x-1/2 -translate-y-1/2",
    cursor: "cursor-nesw-resize",
    isCorner: true,
  },
  {
    id: "w",
    className: "left-0 top-1/2 translate-x-1/2 -translate-y-1/2",
    cursor: "cursor-ew-resize",
    isCorner: false,
  },
];

// Speed presets
export const speedPresets = [0.5, 1, 1.5, 2];

// CSS class strings - Satura Design System (Dark Theme)
// Primary accent: #9aed00 (neon green), Secondary accent: #6a47ff (purple)
export const panelCardClass =
  "rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] px-4 py-4 shadow-[rgba(0,0,0,0.35)_1px_2px_8px_0px]";
export const panelButtonClass =
  "flex w-full items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] px-4 py-3 text-sm font-semibold text-[#f7f7f8] shadow-[rgba(0,0,0,0.35)_1px_2px_8px_0px] transition hover:border-[rgba(255,255,255,0.14)] hover:bg-[#252729] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(106,71,255,0.4)]";
export const floaterSurfaceClass =
  "rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1a1c1e] shadow-[rgba(0,0,0,0.35)_1px_2px_8px_0px]";
export const floaterButtonClass =
  "flex h-9 w-9 items-center justify-center rounded-lg text-[#898a8b] transition hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(106,71,255,0.4)]";
export const floaterPillClass =
  "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#898a8b] transition hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f7f7f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(106,71,255,0.4)]";
export const floaterMenuItemClass =
  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-[#f7f7f8] transition hover:bg-[rgba(255,255,255,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(106,71,255,0.4)]";

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
