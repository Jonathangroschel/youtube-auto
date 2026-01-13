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

type MediaKind = "video" | "audio" | "image" | "text";

type MediaAsset = {
  id: string;
  name: string;
  kind: MediaKind;
  url: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
  createdAt: number;
};

type AssetFilter = "All" | "Video" | "Images" | "Audio";

type TimelineClip = {
  id: string;
  assetId: string;
  duration: number;
  startOffset: number;
  startTime: number;
  laneId: string;
};

type LaneType = "video" | "audio" | "text";

type TimelineLane = {
  id: string;
  type: LaneType;
};

type TimelineLayoutEntry = {
  clip: TimelineClip;
  asset: MediaAsset;
  left: number;
};

type ClipDragState = {
  clipId: string;
  startX: number;
  startLeft: number;
  startLaneId: string;
  targetLaneId?: string;
  createdLaneId?: string;
};

type TrimEdge = "start" | "end";

type TrimState = {
  clipId: string;
  edge: TrimEdge;
  startX: number;
  startDuration: number;
  startOffset: number;
  startTime: number;
};

type ClipTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CornerRadii = {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
};

type VideoClipSettings = {
  speed: number;
  volume: number;
  muted: boolean;
  fadeEnabled: boolean;
  fadeIn: number;
  fadeOut: number;
  roundCorners: boolean;
  cornerRadiusLinked: boolean;
  cornerRadius: number;
  cornerRadii: CornerRadii;
  opacity: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  brightness: number;
  contrast: number;
  exposure: number;
  hue: number;
  saturation: number;
  sharpen: number;
  noise: number;
  blur: number;
  vignette: number;
};

type TextClipSettings = {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  align: TextAlign;
  letterSpacing: number;
  lineHeight: number;
};

type TransformHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

type TransformDragState = {
  clipId: string;
  startX: number;
  startY: number;
  startRect: ClipTransform;
};

type TransformResizeState = {
  clipId: string;
  handle: TransformHandle;
  startX: number;
  startY: number;
  startRect: ClipTransform;
  aspectRatio: number;
};

type RangeSelectionState = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  trackRect: DOMRect;
  additive: boolean;
  originSelection: string[];
};

type FloatingMenuState = {
  open: boolean;
  x: number;
  y: number;
  clipId: string | null;
  showMore: boolean;
  showOrder: boolean;
  showVolume: boolean;
  showSpeed: boolean;
  showOpacity: boolean;
  showCorners: boolean;
  showTiming: boolean;
};

type SnapGuides = {
  x: number[];
  y: number[];
};

type EditorSnapshot = {
  assets: MediaAsset[];
  timeline: TimelineClip[];
  lanes: TimelineLane[];
  clipTransforms: Record<string, ClipTransform>;
  backgroundTransforms: Record<string, ClipTransform>;
  clipSettings: Record<string, VideoClipSettings>;
  textSettings: Record<string, TextClipSettings>;
  clipOrder: Record<string, number>;
  canvasBackground: string;
  currentTime: number;
  selectedClipId: string | null;
  selectedClipIds: string[];
  activeAssetId: string | null;
  activeCanvasClipId: string | null;
};

type ClipboardData = {
  clips: TimelineClip[];
  clipSettings: Record<string, VideoClipSettings>;
  textSettings: Record<string, TextClipSettings>;
  clipTransforms: Record<string, ClipTransform>;
};

type KeyboardShortcutState = {
  currentTime: number;
  timelineDuration: number;
  handleCopySelection: () => boolean;
  handleDeleteSelected: () => void;
  handleDuplicateClip: () => void;
  handlePasteSelection: (offsetSeconds?: number) => void;
  handleRedo: () => void;
  handleSelectAll: () => void;
  handleSplitClip: () => void;
  handleTogglePlayback: () => void;
  handleUndo: () => void;
  isEditableTarget: (target: EventTarget | null) => boolean;
};

type TextPresetTag = "All" | "Simple" | "Title";
type TextPresetCategory = Exclude<TextPresetTag, "All">;
type TextPanelView = "library" | "edit";
type TextAlign = "left" | "center" | "right";

type TextPreviewLine = {
  text: string;
  size: number;
  weight?: number;
  fontFamily?: string;
  className?: string;
};

type TextPreset = {
  id: string;
  name: string;
  category: TextPresetCategory;
  preview: TextPreviewLine[];
  editText: string;
  editFontSize: number;
  editFontFamily?: string;
};

type TextPresetGroup = {
  id: string;
  label: string;
  category: TextPresetCategory;
  presets: TextPreset[];
};

const fallbackDuration = 8;
const minClipDuration = 1;
const timelineScaleMin = 0.02;
const timelineScaleMax = 24;
const snapInterval = 0.5;
const laneGap = 10;
const timelinePadding = 16;
const defaultTimelineHeight = 260;
const minCanvasHeight = 80;
const timelineHandleHeight = 16;
const frameStepSeconds = 1 / 30;
const laneHeights: Record<LaneType, number> = {
  video: 56,
  audio: 40,
  text: 32,
};
const minLayerSize = 80;
const snapThresholdPx = 8;
const maxHistoryEntries = 100;

const transformHandles: Array<{
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

const speedPresets = [0.5, 1, 1.5, 2];
const panelCardClass =
  "rounded-xl border border-gray-200/70 bg-white px-4 py-4 shadow-[0_8px_18px_rgba(15,23,42,0.06)]";
const panelButtonClass =
  "flex w-full items-center gap-2 rounded-xl border border-gray-200/70 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-[0_6px_14px_rgba(15,23,42,0.05)] transition hover:border-gray-300 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30 focus-visible:ring-offset-2";
const floaterSurfaceClass =
  "rounded-2xl border border-white/80 bg-white/95 shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur";
const floaterButtonClass =
  "flex h-9 w-9 items-center justify-center rounded-xl text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30";
const floaterPillClass =
  "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30";
const floaterMenuItemClass =
  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30";
const floaterMenuWidth = 180;
const floaterSubmenuWidth = 200;
const floaterPanelWidth = 240;
const defaultFloatingMenuState: FloatingMenuState = {
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

const closeFloatingMenuState = (
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

const createFloatingMenuState = (
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

const toolbarItems = [
  {
    id: "ai",
    label: "AI Tools",
    testId: "@editor/ai-tools",
    icon: (className: string) => (
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <g filter="url(#filter0_i_9578_4468)">
          <path
            d="M8 17.6C8 14.2397 8 12.5595 8.65396 11.2761C9.2292 10.1471 10.1471 9.2292 11.2761 8.65396C12.5595 8 14.2397 8 17.6 8H22.4C25.7603 8 27.4405 8 28.7239 8.65396C29.8529 9.2292 30.7708 10.1471 31.346 11.2761C32 12.5595 32 14.2397 32 17.6V22.4C32 25.7603 32 27.4405 31.346 28.7239C30.7708 29.8529 29.8529 30.7708 28.7239 31.346C27.4405 32 25.7603 32 22.4 32H17.6C14.2397 32 12.5595 32 11.2761 31.346C10.1471 30.7708 9.2292 29.8529 8.65396 28.7239C8 27.4405 8 25.7603 8 22.4V17.6Z"
            fill="currentColor"
          />
          <path
            d="M8 17.6C8 14.2397 8 12.5595 8.65396 11.2761C9.2292 10.1471 10.1471 9.2292 11.2761 8.65396C12.5595 8 14.2397 8 17.6 8H22.4C25.7603 8 27.4405 8 28.7239 8.65396C29.8529 9.2292 30.7708 10.1471 31.346 11.2761C32 12.5595 32 14.2397 32 17.6V22.4C32 25.7603 32 27.4405 31.346 28.7239C30.7708 29.8529 29.8529 30.7708 28.7239 31.346C27.4405 32 25.7603 32 22.4 32H17.6C14.2397 32 12.5595 32 11.2761 31.346C10.1471 30.7708 9.2292 29.8529 8.65396 28.7239C8 27.4405 8 25.7603 8 22.4V17.6Z"
            fill="currentColor"
          />
        </g>
        <path
          d="M27 19.9993C27.0016 20.2045 26.9392 20.405 26.8216 20.5731C26.8075 20.5932 26.7927 20.6127 26.7773 20.6315C26.5516 20.9079 26.1646 20.953 25.8125 21.0106C24.9426 21.153 23.2261 21.5305 22.3773 22.3794C21.5389 23.218 21.1606 24.9034 21.0143 25.7825C20.9524 26.1546 20.902 26.5673 20.6011 26.7948C20.5906 26.8028 20.5799 26.8105 20.569 26.8181C20.4014 26.9347 20.2021 26.9972 19.9979 26.9972C19.7937 26.9972 19.5944 26.9347 19.4267 26.8181C19.4159 26.8106 19.4053 26.8029 19.3948 26.795C19.0937 26.5675 19.0433 26.1545 18.9814 25.7822C18.8352 24.903 18.457 23.2174 17.6184 22.3788C16.7798 21.5402 15.0942 21.162 14.215 21.0158C13.8427 20.9539 13.4297 20.9035 13.2022 20.6024C13.1943 20.5919 13.1866 20.5813 13.1791 20.5705C13.0625 20.4028 13 20.2035 13 19.9993C13 19.7951 13.0625 19.5958 13.1791 19.4282C13.1866 19.4174 13.1943 19.4067 13.2022 19.3963C13.4297 19.0952 13.8427 19.0448 14.215 18.9829C15.0942 18.8367 16.7798 18.4585 17.6184 17.6199C18.457 16.7813 18.8352 15.0957 18.9814 14.2164C19.0433 13.8442 19.0937 13.4312 19.3948 13.2037C19.4053 13.1958 19.4159 13.1881 19.4267 13.1805C19.5944 13.064 19.7937 13.0015 19.9979 13.0015C20.2021 13.0015 20.4014 13.064 20.569 13.1805C20.5799 13.1881 20.5907 13.1959 20.6012 13.2039C20.902 13.4314 20.9525 13.844 21.0143 14.216C21.1606 15.0952 21.5391 16.7812 22.378 17.6199C23.2267 18.4684 24.9426 18.8457 25.8124 18.988C26.1646 19.0457 26.5516 19.0908 26.7774 19.3672C26.7928 19.3861 26.8075 19.4055 26.8216 19.4256C26.9392 19.5936 27.0016 19.7942 27 19.9993Z"
          fill="white"
        />
        <defs>
          <filter
            id="filter0_i_9578_4468"
            x="8"
            y="8"
            width="24"
            height="24"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend
              mode="normal"
              in="SourceGraphic"
              in2="BackgroundImageFix"
              result="shape"
            />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feOffset dy="0.5" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.1 0"
            />
            <feBlend mode="normal" in2="shape" result="effect1_innerShadow_9578_4468" />
          </filter>
          <linearGradient
            id="paint0_linear_9578_4468"
            x1="32"
            y1="6.84337"
            x2="-22.8133"
            y2="30.5853"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0.339453" stopColor="#001BFF" />
            <stop offset="0.704477" stopColor="#9779FF" />
            <stop offset="1" stopColor="#E3CEFF" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
  {
    id: "video",
    label: "Video",
    testId: "@editor/media",
    icon: (className: string) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
        className={className}
        aria-hidden="true"
      >
        <g fillRule="evenodd" clipRule="evenodd" filter="url(#video_svg__a)">
          <path
            fill="currentColor"
            d="M9.601 0c-3.36 0-5.04 0-6.324.654A6 6 0 0 0 .654 3.276C0 4.56.001 6.24.001 9.601v4.8c0 3.36.001 5.04.655 6.323a6 6 0 0 0 2.622 2.622C4.562 24 6.242 24 9.602 24H14.4c3.36 0 5.04 0 6.324-.654a6 6 0 0 0 2.622-2.622C24 19.44 24 17.76 24 14.4V9.6c0-3.36 0-5.04-.654-6.324A6 6 0 0 0 20.725.654C19.44 0 17.76 0 14.4 0z"
          />
          <path
            fill="url(#video_svg__b)"
            fillOpacity="0.2"
            d="M9.601 0c-3.36 0-5.04 0-6.324.654A6 6 0 0 0 .654 3.276C0 4.56.001 6.24.001 9.601v4.8c0 3.36.001 5.04.655 6.323a6 6 0 0 0 2.622 2.622C4.562 24 6.242 24 9.602 24H14.4c3.36 0 5.04 0 6.324-.654a6 6 0 0 0 2.622-2.622C24 19.44 24 17.76 24 14.4V9.6c0-3.36 0-5.04-.654-6.324A6 6 0 0 0 20.725.654C19.44 0 17.76 0 14.4 0z"
          />
        </g>
        <g filter="url(#video_svg__c)">
          <path
            fill="#fff"
            d="M16 12.8c0 .44 0 .66.058.862.05.179.135.347.247.495.127.167.303.299.655.563l.48.36c.824.618 1.236.927 1.58.92a1 1 0 0 0 .767-.383C20 15.345 20 14.83 20 13.8v-3.6c0-1.03 0-1.545-.213-1.816A1 1 0 0 0 19.021 8c-.345-.007-.757.302-1.581.92l-.48.36c-.352.264-.528.396-.655.563a1.5 1.5 0 0 0-.247.495C16 10.54 16 10.76 16 11.2z"
          />
        </g>
        <g filter="url(#video_svg__d)">
          <path
            fill="#fff"
            d="M5 10.2c0-1.12 0-1.68.218-2.108a2 2 0 0 1 .874-.874C6.52 7 7.08 7 8.2 7h3.6c1.12 0 1.68 0 2.108.218a2 2 0 0 1 .874.874C15 8.52 15 9.08 15 10.2v3.6c0 1.12 0 1.68-.218 2.108a2 2 0 0 1-.874.874C13.48 17 12.92 17 11.8 17H8.2c-1.12 0-1.68 0-2.108-.218a2 2 0 0 1-.874-.874C5 15.48 5 14.92 5 13.8z"
          />
        </g>
        <defs>
          <filter
            id="video_svg__a"
            width="24"
            height="24"
            x="0.001"
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
            <feBlend in2="shape" result="effect1_innerShadow_22531_1628" />
          </filter>
          <filter
            id="video_svg__c"
            width="8"
            height="12"
            x="14"
            y="7"
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
            <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
            <feBlend
              in2="BackgroundImageFix"
              mode="multiply"
              result="effect1_dropShadow_22531_1628"
            />
            <feBlend in="SourceGraphic" in2="effect1_dropShadow_22531_1628" result="shape" />
          </filter>
          <filter
            id="video_svg__d"
            width="14"
            height="14"
            x="3"
            y="6"
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
            <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
            <feBlend
              in2="BackgroundImageFix"
              mode="multiply"
              result="effect1_dropShadow_22531_1628"
            />
            <feBlend in="SourceGraphic" in2="effect1_dropShadow_22531_1628" result="shape" />
          </filter>
          <linearGradient
            id="video_svg__b"
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
    ),
  },
  {
    id: "audio",
    label: "Audio",
    testId: "@editor/audio",
    icon: (className: string) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
        className={className}
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
    ),
  },
  {
    id: "image",
    label: "Image",
    testId: "@editor/image",
    icon: (className: string) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
        className={className}
        aria-hidden="true"
      >
        <g filter="url(#images_svg__a)">
          <path
            fill="currentColor"
            d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
          />
          <path
            fill="url(#images_svg__b)"
            fillOpacity="0.2"
            d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
          />
        </g>
        <g filter="url(#images_svg__c)">
          <path fill="#fff" d="M16.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5" />
        </g>
        <g filter="url(#images_svg__d)">
          <path
            fill="#fff"
            d="M8.543 19c-2.1 0-3.15 0-3.695-.432a2 2 0 0 1-.759-1.551c-.006-.696.639-1.524 1.928-3.182l1.089-1.4c.645-.83.968-1.244 1.36-1.393a1.5 1.5 0 0 1 1.068 0c.392.149.715.564 1.36 1.394l1.745 2.243c.26.334.39.5.52.607a1.5 1.5 0 0 0 1.861.031c.134-.102.27-.264.54-.589.262-.314.393-.472.524-.573a1.5 1.5 0 0 1 1.832 0c.13.101.266.264.537.588.682.819 1.023 1.228 1.142 1.534a2 2 0 0 1-1.227 2.619c-.31.104-.828.104-1.862.104z"
          />
        </g>
        <defs>
          <filter
            id="images_svg__a"
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
            <feBlend in2="shape" result="effect1_innerShadow_22531_760" />
          </filter>
          <filter
            id="images_svg__c"
            width="9"
            height="9"
            x="12"
            y="4"
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
            <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
            <feBlend in2="BackgroundImageFix" mode="multiply" result="effect1_dropShadow_22531_760" />
            <feBlend in="SourceGraphic" in2="effect1_dropShadow_22531_760" result="shape" />
          </filter>
          <filter
            id="images_svg__d"
            width="19.641"
            height="12.057"
            x="2.089"
            y="9.943"
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
            <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
            <feBlend in2="BackgroundImageFix" mode="multiply" result="effect1_dropShadow_22531_760" />
            <feBlend in="SourceGraphic" in2="effect1_dropShadow_22531_760" result="shape" />
          </filter>
          <linearGradient
            id="images_svg__b"
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
    ),
  },
  {
    id: "subtitles",
    label: "Subtitles",
    testId: "@editor/subtitles",
    icon: (className: string) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
        className={className}
        aria-hidden="true"
      >
        <g filter="url(#subtitles_svg__a)">
          <path
            fill="currentColor"
            d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
          />
          <path
            fill="url(#subtitles_svg__b)"
            fillOpacity="0.2"
            d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
          />
        </g>
        <g filter="url(#subtitles_svg__c)">
          <rect width="16" height="3" x="4" y="17" fill="#fff" rx="1.5" />
        </g>
        <defs>
          <filter
            id="subtitles_svg__a"
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
            <feBlend in2="shape" result="effect1_innerShadow_22531_369" />
          </filter>
          <filter
            id="subtitles_svg__c"
            width="20"
            height="7"
            x="2"
            y="16"
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
            <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
            <feBlend in2="BackgroundImageFix" mode="multiply" result="effect1_dropShadow_22531_369" />
            <feBlend in="SourceGraphic" in2="effect1_dropShadow_22531_369" result="shape" />
          </filter>
          <linearGradient
            id="subtitles_svg__b"
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
    ),
  },
  {
    id: "text",
    label: "Text",
    testId: "@editor/text",
    icon: (className: string) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="none"
        viewBox="0 0 24 24"
        className={className}
        aria-hidden="true"
      >
        <g filter="url(#text_svg__a)">
          <path
            fill="currentColor"
            d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
          />
          <path
            fill="url(#text_svg__b)"
            fillOpacity="0.2"
            d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v4.8c0 3.36 0 5.04-.654 6.324a6 6 0 0 1-2.622 2.622C19.44 24 17.76 24 14.4 24H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
          />
        </g>
        <g filter="url(#text_svg__c)">
          <path
            fill="#fff"
            d="M6 7.5A1.5 1.5 0 0 0 7.5 9h3v7.5a1.5 1.5 0 0 0 3 0V9h3a1.5 1.5 0 0 0 0-3h-9A1.5 1.5 0 0 0 6 7.5"
          />
        </g>
        <defs>
          <filter
            id="text_svg__a"
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
            <feBlend in2="shape" result="effect1_innerShadow_22531_113" />
          </filter>
          <filter
            id="text_svg__c"
            width="16"
            height="16"
            x="4"
            y="5"
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
            <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
            <feBlend in2="BackgroundImageFix" mode="multiply" result="effect1_dropShadow_22531_113" />
            <feBlend in="SourceGraphic" in2="effect1_dropShadow_22531_113" result="shape" />
          </filter>
          <linearGradient
            id="text_svg__b"
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
    ),
  },
  {
    id: "elements",
    label: "Elements",
    testId: "@editor/elements",
    icon: (className: string) => (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="25"
        fill="none"
        viewBox="0 0 24 25"
        className={className}
        aria-hidden="true"
      >
        <g filter="url(#elements_svg__a)">
          <path
            fill="currentColor"
            d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v3.424c0 1.467 0 2.2-.166 2.891a6 6 0 0 1-.718 1.735c-.371.605-.89 1.124-1.928 2.162l-1.376 1.376c-1.038 1.038-1.557 1.557-2.162 1.928a6 6 0 0 1-1.735.718c-.69.166-1.424.166-2.891.166H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
          />
          <path
            fill="url(#elements_svg__b)"
            fillOpacity="0.2"
            d="M0 9.6c0-3.36 0-5.04.654-6.324A6 6 0 0 1 3.276.654C4.56 0 6.24 0 9.6 0h4.8c3.36 0 5.04 0 6.324.654a6 6 0 0 1 2.622 2.622C24 4.56 24 6.24 24 9.6v3.424c0 1.467 0 2.2-.166 2.891a6 6 0 0 1-.718 1.735c-.371.605-.89 1.124-1.928 2.162l-1.376 1.376c-1.038 1.038-1.557 1.557-2.162 1.928a6 6 0 0 1-1.735.718c-.69.166-1.424.166-2.891.166H9.6c-3.36 0-5.04 0-6.324-.654a6 6 0 0 1-2.622-2.622C0 19.44 0 17.76 0 14.4z"
          />
        </g>
        <g filter="url(#elements_svg__c)">
          <path
            fill="#fff"
            d="M18.365 14H15.92c-.672 0-1.008 0-1.265.13a1.2 1.2 0 0 0-.524.525C14 14.912 14 15.248 14 15.92v2.445c0 1.454 0 2.18.288 2.517a1.2 1.2 0 0 0 1.006.417c.441-.035.955-.549 1.984-1.577l2.444-2.444c1.028-1.028 1.542-1.542 1.577-1.984a1.2 1.2 0 0 0-.417-1.007C20.546 14 19.82 14 18.365 14"
          />
        </g>
        <defs>
          <filter
            id="elements_svg__a"
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
            <feBlend in2="shape" result="effect1_innerShadow_22531_673" />
          </filter>
          <filter
            id="elements_svg__c"
            width="11.303"
            height="11.303"
            x="12"
            y="13"
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
            <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
            <feBlend in2="BackgroundImageFix" mode="multiply" result="effect1_dropShadow_22531_673" />
            <feBlend in="SourceGraphic" in2="effect1_dropShadow_22531_673" result="shape" />
          </filter>
          <linearGradient
            id="elements_svg__b"
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
    ),
  },
  {
    id: "settings",
    label: "Settings",
    testId: "@editor/settings",
    icon: (className: string) => (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <g filter="url(#filter0_i_23453_9291)">
          <path
            d="M0 9.6C0 6.23969 0 4.55953 0.653961 3.27606C1.2292 2.14708 2.14708 1.2292 3.27606 0.653961C4.55953 0 6.23969 0 9.6 0H14.4C17.7603 0 19.4405 0 20.7239 0.653961C21.8529 1.2292 22.7708 2.14708 23.346 3.27606C24 4.55953 24 6.23969 24 9.6V14.4C24 17.7603 24 19.4405 23.346 20.7239C22.7708 21.8529 21.8529 22.7708 20.7239 23.346C19.4405 24 17.7603 24 14.4 24H9.6C6.23969 24 4.55953 24 3.27606 23.346C2.14708 22.7708 1.2292 21.8529 0.653961 20.7239C0 19.4405 0 17.7603 0 14.4V9.6Z"
            fill="currentColor"
          />
          <path
            d="M0 9.6C0 6.23969 0 4.55953 0.653961 3.27606C1.2292 2.14708 2.14708 1.2292 3.27606 0.653961C4.55953 0 6.23969 0 9.6 0H14.4C17.7603 0 19.4405 0 20.7239 0.653961C21.8529 1.2292 22.7708 2.14708 23.346 3.27606C24 4.55953 24 6.23969 24 9.6V14.4C24 17.7603 24 19.4405 23.346 20.7239C22.7708 21.8529 21.8529 22.7708 20.7239 23.346C19.4405 24 17.7603 24 14.4 24H9.6C6.23969 24 4.55953 24 3.27606 23.346C2.14708 22.7708 1.2292 21.8529 0.653961 20.7239C0 19.4405 0 17.7603 0 14.4V9.6Z"
            fill="url(#paint0_linear_23453_9291)"
            fillOpacity="0.2"
          />
        </g>
        <g filter="url(#filter1_d_23453_9291)">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M8.76684 6.16526C9.94469 5.52696 10.5336 5.20781 11.1597 5.0829C11.7137 4.97237 12.2863 4.97237 12.8403 5.0829C13.4664 5.20781 14.0553 5.52696 15.2332 6.16526L15.2332 6.16526L15.7668 6.45447C16.9447 7.09277 17.5336 7.41192 17.9619 7.85842C18.3409 8.25348 18.6272 8.71889 18.8022 9.22448C19 9.79589 19 10.4342 19 11.7108V12.2892C19 13.5658 19 14.2041 18.8022 14.7755C18.6272 15.2811 18.3409 15.7465 17.9619 16.1416C17.5336 16.5881 16.9447 16.9072 15.7668 17.5455L15.2332 17.8347L15.2331 17.8348C14.0553 18.473 13.4664 18.7922 12.8403 18.9171C12.2863 19.0276 11.7137 19.0276 11.1597 18.9171C10.5336 18.7922 9.9447 18.473 8.76686 17.8348L8.76684 17.8347L8.23316 17.5455C7.05531 16.9072 6.46638 16.5881 6.03807 16.1416C5.6591 15.7465 5.37282 15.2811 5.1978 14.7755C5 14.2041 5 13.5658 5 12.2892V11.7108C5 10.4342 5 9.79589 5.1978 9.22448C5.37282 8.71889 5.6591 8.25348 6.03807 7.85842C6.46638 7.41192 7.05531 7.09277 8.23316 6.45447L8.76684 6.16526ZM12 14C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14Z"
            fill="white"
          />
        </g>
        <defs>
          <filter
            id="filter0_i_23453_9291"
            x="0"
            y="0"
            width="24"
            height="24"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feOffset dy="0.5" />
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.1 0" />
            <feBlend mode="normal" in2="shape" result="effect1_innerShadow_23453_9291" />
          </filter>
          <filter
            id="filter1_d_23453_9291"
            x="3"
            y="4"
            width="18"
            height="18"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feColorMatrix
              in="SourceAlpha"
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
              result="hardAlpha"
            />
            <feOffset dy="1" />
            <feGaussianBlur stdDeviation="1" />
            <feComposite in2="hardAlpha" operator="out" />
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_23453_9291" />
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_23453_9291" result="shape" />
          </filter>
          <linearGradient
            id="paint0_linear_23453_9291"
            x1="12"
            y1="0"
            x2="12"
            y2="24"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="white" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    ),
  },
];

const mediaFilters: AssetFilter[] = ["All", "Video", "Images", "Audio"];

const stockVideos = [
  {
    id: "stock-1",
    title: "Morning skyline",
    duration: "0:08",
    image:
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "stock-2",
    title: "City rush",
    duration: "0:12",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "stock-3",
    title: "Studio light",
    duration: "0:10",
    image:
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "stock-4",
    title: "Abstract loop",
    duration: "0:07",
    image:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=80",
  },
];

const textPresetTags: TextPresetTag[] = ["All", "Simple", "Title"];

const textPresetGroups: TextPresetGroup[] = [
  {
    id: "simple",
    label: "Simple",
    category: "Simple",
    presets: [
      {
        id: "simple-title",
        name: "Title",
        category: "Simple",
        preview: [{ text: "Title", size: 22, weight: 600, fontFamily: "Space Grotesk" }],
        editText: "Title",
        editFontSize: 48,
        editFontFamily: "Space Grotesk",
      },
      {
        id: "simple-basic",
        name: "Simple",
        category: "Simple",
        preview: [{ text: "Simple", size: 16, fontFamily: "Montserrat" }],
        editText: "Simple",
        editFontSize: 32,
        editFontFamily: "Montserrat",
      },
      {
        id: "simple-cursive",
        name: "Cursive",
        category: "Simple",
        preview: [{ text: "Cursive", size: 24, fontFamily: "Pacifico" }],
        editText: "Cursive",
        editFontSize: 40,
        editFontFamily: "Pacifico",
      },
      {
        id: "simple-serif",
        name: "Serif",
        category: "Simple",
        preview: [{ text: "Serif", size: 20, fontFamily: "Playfair Display" }],
        editText: "Serif",
        editFontSize: 36,
        editFontFamily: "Playfair Display",
      },
      {
        id: "simple-typewriter",
        name: "Typewriter",
        category: "Simple",
        preview: [
          {
            text: "Typewriter",
            size: 13,
            fontFamily: "Space Mono",
          },
        ],
        editText: "Typewriter",
        editFontSize: 28,
        editFontFamily: "Space Mono",
      },
      {
        id: "simple-bold",
        name: "Bold",
        category: "Simple",
        preview: [
          { text: "bold", size: 24, weight: 700, fontFamily: "Bebas Neue" },
        ],
        editText: "bold",
        editFontSize: 44,
        editFontFamily: "Bebas Neue",
      },
    ],
  },
  {
    id: "title",
    label: "Title",
    category: "Title",
    presets: [
      {
        id: "title-traditional",
        name: "Traditional",
        category: "Title",
        preview: [
          { text: "bold", size: 28, weight: 700, fontFamily: "Playfair Display" },
          { text: "Traditional", size: 12, className: "uppercase tracking-[0.14em]" },
        ],
        editText: "bold\nTraditional",
        editFontSize: 46,
        editFontFamily: "Playfair Display",
      },
      {
        id: "title-editorial",
        name: "Editorial",
        category: "Title",
        preview: [
          { text: "Editorial", size: 21, weight: 600, fontFamily: "Merriweather" },
          { text: "Classic", size: 12, className: "uppercase tracking-[0.12em]" },
        ],
        editText: "Editorial\nClassic",
        editFontSize: 42,
        editFontFamily: "Merriweather",
      },
      {
        id: "title-modern",
        name: "Modern",
        category: "Title",
        preview: [
          { text: "Modern", size: 20, weight: 600, fontFamily: "Space Grotesk" },
          { text: "Bauhaus", size: 12, className: "uppercase tracking-[0.12em]" },
        ],
        editText: "Modern\nBauhaus",
        editFontSize: 40,
        editFontFamily: "Space Grotesk",
      },
      {
        id: "title-elegant",
        name: "Elegant",
        category: "Title",
        preview: [
          { text: "Elegant", size: 20, weight: 500, fontFamily: "Lora" },
          { text: "Light", size: 12, className: "uppercase tracking-[0.12em]" },
        ],
        editText: "Elegant\nLight",
        editFontSize: 40,
        editFontFamily: "Lora",
      },
      {
        id: "title-signature",
        name: "Signature",
        category: "Title",
        preview: [
          { text: "Signature", size: 18, fontFamily: "Pacifico" },
          { text: "INDUSTRIAL", size: 18, weight: 700, className: "tracking-[0.08em]" },
        ],
        editText: "Signature\nINDUSTRIAL",
        editFontSize: 38,
        editFontFamily: "Pacifico",
      },
      {
        id: "title-reliable",
        name: "Reliable",
        category: "Title",
        preview: [
          { text: "RELIABLE", size: 16, weight: 600, className: "tracking-[0.12em]", fontFamily: "Oswald" },
          {
            text: "Typewriter",
            size: 8,
            fontFamily: "Space Mono",
          },
        ],
        editText: "RELIABLE\nTypewriter",
        editFontSize: 34,
        editFontFamily: "Oswald",
      },
    ],
  },
];

const textFontFamilies = [
  "Roboto",
  "Inter",
  "Space Grotesk",
  "Montserrat",
  "Oswald",
  "Bebas Neue",
  "Playfair Display",
  "Merriweather",
  "Lora",
  "Pacifico",
  "Space Mono",
  "Georgia",
  "Times New Roman",
  "Courier New",
];

const textFontSizes = [12, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64];
const textLetterSpacingOptions = [0, 0.5, 1, 1.5, 2, 3];
const textLineHeightOptions = [1, 1.1, 1.25, 1.4, 1.6];

const backgroundSwatches = [
  "#0A0A0A",
  "#1F2937",
  "#111827",
  "#0F172A",
  "#F2F4FA",
  "#F8FAFC",
  "#FFFFFF",
];

const noiseDataUrl =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='80' height='80' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E";

const formatDuration = (seconds?: number) => {
  if (seconds == null || Number.isNaN(seconds)) {
    return "--:--";
  }
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
};

const formatSpeedLabel = (speed: number) => {
  if (Number.isInteger(speed)) {
    return `${speed}`;
  }
  const trimmed = speed.toFixed(2).replace(/0$/, "");
  return trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
};

const formatTimelineLabel = (seconds: number) => {
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

const formatTimeWithTenths = (seconds: number) => {
  const total = Math.max(0, seconds);
  const minutes = Math.floor(total / 60);
  const remaining = total - minutes * 60;
  const remainingText = remaining.toFixed(1).padStart(4, "0");
  return `${minutes.toString().padStart(2, "0")}:${remainingText}`;
};

const parseTimeInput = (value: string) => {
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

const formatSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const createDefaultVideoSettings = (): VideoClipSettings => ({
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

const cloneVideoSettings = (settings: VideoClipSettings): VideoClipSettings => ({
  ...settings,
  cornerRadii: { ...settings.cornerRadii },
});

const createDefaultTextSettings = (): TextClipSettings => ({
  text: "Title",
  fontFamily: "Roboto",
  fontSize: 48,
  color: "#ffffff",
  bold: true,
  italic: false,
  align: "center",
  letterSpacing: 0,
  lineHeight: 1.1,
});

const cloneTextSettings = (settings: TextClipSettings): TextClipSettings => ({
  ...settings,
});

const createDefaultTransform = (
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

const createDefaultTextTransform = (stageAspectRatio: number): ClipTransform => {
  const width = 0.6;
  const height = stageAspectRatio > 1.4 ? 0.18 : 0.24;
  return {
    x: (1 - width) / 2,
    y: (1 - height) / 2,
    width,
    height,
  };
};

type SliderFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  valueLabel?: string;
};

const SliderField = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  valueLabel,
}: SliderFieldProps) => {
  const percentage = ((value - min) / (max - min)) * 100;
  const normalized = Number.isFinite(percentage)
    ? Math.min(100, Math.max(0, percentage))
    : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600">{label}</span>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
          {valueLabel ?? value}
        </span>
      </div>
      <div className="relative h-4">
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-gray-200/80" />
        <div
          className="pointer-events-none absolute left-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-[#5B6CFF]"
          style={{ width: `${normalized}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="refined-slider relative z-10 h-4 w-full cursor-pointer appearance-none bg-transparent"
          aria-label={label}
        />
      </div>
    </div>
  );
};

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
};

const ToggleSwitch = ({ checked, onChange, ariaLabel }: ToggleSwitchProps) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/40 focus-visible:ring-offset-2 ${checked ? "bg-[#5B6CFF]" : "bg-gray-200"
        }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-[0_2px_6px_rgba(15,23,42,0.2)] transition-transform ${checked ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
      />
    </button>
  );
};

const clampTransformToStage = (
  rect: ClipTransform,
  stage: { width: number; height: number },
  minSizePx: number
) => {
  const minWidth = Math.min(0.9, minSizePx / stage.width);
  const minHeight = Math.min(0.9, minSizePx / stage.height);
  const width = clamp(rect.width, minWidth, 1);
  const height = clamp(rect.height, minHeight, 1);
  const x = clamp(rect.x, 0, 1 - width);
  const y = clamp(rect.y, 0, 1 - height);
  return {
    x,
    y,
    width,
    height,
  };
};

const getAssetDurationSeconds = (asset?: MediaAsset | null) =>
  asset?.duration ?? fallbackDuration;

const imageMaxDuration = 3600;
const defaultTextDuration = 5;

const getAssetMaxDurationSeconds = (asset?: MediaAsset | null) =>
  asset?.kind === "image" || asset?.kind === "text"
    ? imageMaxDuration
    : getAssetDurationSeconds(asset);

const getLaneType = (asset?: MediaAsset | null): LaneType => {
  if (asset?.kind === "audio") {
    return "audio";
  }
  if (asset?.kind === "text") {
    return "text";
  }
  return "video";
};

const getLaneEndTime = (laneId: string, clips: TimelineClip[]) =>
  clips.reduce(
    (max, clip) =>
      clip.laneId === laneId
        ? Math.max(max, clip.startTime + clip.duration)
        : max,
    0
  );

const getWaveformBars = (seed: string, count: number) => {
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

const inferMediaKind = (file: File): MediaKind => {
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

const getMediaMeta = (kind: MediaKind, url: string) =>
  new Promise<{
    duration?: number;
    width?: number;
    height?: number;
    aspectRatio?: number;
  }>((resolve) => {
    if (kind === "text") {
      resolve({});
      return;
    }
    if (kind === "image") {
      const image = new Image();
      image.onload = () => {
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        resolve({
          width,
          height,
          aspectRatio: width && height ? width / height : undefined,
        });
      };
      image.onerror = () => resolve({});
      image.src = url;
      return;
    }
    const element = document.createElement(
      kind === "video" ? "video" : "audio"
    );
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      if (kind === "video") {
        const video = element as HTMLVideoElement;
        const width = video.videoWidth;
        const height = video.videoHeight;
        resolve({
          duration: element.duration,
          width,
          height,
          aspectRatio: width && height ? width / height : undefined,
        });
        return;
      }
      resolve({ duration: element.duration });
    };
    element.onerror = () => resolve({});
    element.src = url;
  });

export default function AdvancedEditorPage() {
  const [activeTool, setActiveTool] = useState("video");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineClip[]>([]);
  const [lanes, setLanes] = useState<TimelineLane[]>([]);
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("All");
  const [isAssetLibraryExpanded, setIsAssetLibraryExpanded] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [stageSelection, setStageSelection] =
    useState<RangeSelectionState | null>(null);
  const [uploading, setUploading] = useState(false);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [canvasBackground, setCanvasBackground] = useState("#0A0A0A");
  const [isBackgroundSelected, setIsBackgroundSelected] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState(
    defaultTimelineHeight
  );
  const [timelineScale, setTimelineScale] = useState(12);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [clipOrder, setClipOrder] = useState<Record<string, number>>({});
  const [activeCanvasClipId, setActiveCanvasClipId] = useState<string | null>(
    null
  );
  const [floatingMenu, setFloatingMenu] = useState<FloatingMenuState>(
    defaultFloatingMenuState
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
  const [textPanelSpacingOpen, setTextPanelSpacingOpen] = useState(false);
  const [textPanelStart, setTextPanelStart] = useState("00:00.0");
  const [textPanelEnd, setTextPanelEnd] = useState("00:05.0");
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
  const [dragClipState, setDragClipState] = useState<ClipDragState | null>(
    null
  );
  const [dragOverCanvas, setDragOverCanvas] = useState(false);
  const [dragOverTimeline, setDragOverTimeline] = useState(false);
  const [trimState, setTrimState] = useState<TrimState | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const assetsRef = useRef<MediaAsset[]>([]);
  const lanesRef = useRef<TimelineLane[]>([]);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const floatingMenuRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [mainHeight, setMainHeight] = useState(0);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineTrackRef = useRef<HTMLDivElement | null>(null);
  const visualRefs = useRef(new Map<string, HTMLVideoElement | null>());
  const audioRefs = useRef(new Map<string, HTMLAudioElement | null>());
  const historyRef = useRef<{
    past: EditorSnapshot[];
    future: EditorSnapshot[];
    locked: boolean;
  }>({ past: [], future: [], locked: false });
  const historyThrottleRef = useRef(0);
  const clipboardRef = useRef<ClipboardData | null>(null);
  const dragTransformHistoryRef = useRef(false);
  const resizeTransformHistoryRef = useRef(false);
  const dragClipHistoryRef = useRef(false);
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

  const registerVideoRef = useCallback(
    (clipId: string) => (node: HTMLVideoElement | null) => {
      if (node) {
        visualRefs.current.set(clipId, node);
      } else {
        visualRefs.current.delete(clipId);
      }
    },
    []
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
      return next;
    });
  }, [timeline]);

  useEffect(() => {
    return () => {
      assetsRef.current.forEach((asset) => URL.revokeObjectURL(asset.url));
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
    if (!["video", "audio", "image"].includes(activeTool)) {
      setIsAssetLibraryExpanded(false);
    }
    if (activeTool !== "text") {
      setTextPanelView("library");
    }
  }, [activeTool]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const updateSize = () => {
      const rect = stage.getBoundingClientRect();
      setStageSize({ width: rect.width, height: rect.height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
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

  const activeToolLabel = useMemo(() => {
    return toolbarItems.find((item) => item.id === activeTool)?.label ?? "Panel";
  }, [activeTool]);

  const visibleTextPresetGroups = useMemo(() => {
    if (textPanelTag === "All") {
      return textPresetGroups;
    }
    return textPresetGroups.filter(
      (group) => group.category === textPanelTag
    );
  }, [textPanelTag]);

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
      setTextPanelDraft(nextSettings.text);
      setTextPanelFontFamily(nextSettings.fontFamily);
      setTextPanelFontSize(nextSettings.fontSize);
      setTextPanelColor(nextSettings.color);
      setTextPanelBold(nextSettings.bold);
      setTextPanelItalic(nextSettings.italic);
      setTextPanelAlign(nextSettings.align);
      setTextPanelLetterSpacing(nextSettings.letterSpacing);
      setTextPanelLineHeight(nextSettings.lineHeight);
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
    draft.push(lane);
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
      if (candidates.length === 0) {
        return null;
      }
      return candidates.reduce((top, entry) => {
        const entryIndex = laneIndexMap.get(entry.clip.laneId) ?? 0;
        const topIndex = laneIndexMap.get(top.clip.laneId) ?? 0;
        return entryIndex >= topIndex ? entry : top;
      });
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
    setActiveTool("text");
    setTextPanelView("edit");
    setTextPanelPreset(null);
    setTextPanelDraft(selectedTextSettings.text);
    setTextPanelFontFamily(selectedTextSettings.fontFamily);
    setTextPanelFontSize(selectedTextSettings.fontSize);
    setTextPanelColor(selectedTextSettings.color);
    setTextPanelBold(selectedTextSettings.bold);
    setTextPanelItalic(selectedTextSettings.italic);
    setTextPanelAlign(selectedTextSettings.align);
    setTextPanelLetterSpacing(selectedTextSettings.letterSpacing);
    setTextPanelLineHeight(selectedTextSettings.lineHeight);
    setTextPanelStart(formatTimeWithTenths(selectedTextEntry.clip.startTime));
    setTextPanelEnd(
      formatTimeWithTenths(
        selectedTextEntry.clip.startTime + selectedTextEntry.clip.duration
      )
    );
  }, [activeTool, selectedTextEntry, selectedTextSettings]);

  useEffect(() => {
    if (textPanelView === "library") {
      setTextPanelSpacingOpen(false);
    }
  }, [textPanelView]);

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
        currentTime >= entry.left &&
        currentTime <= entry.left + entry.clip.duration
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
        currentTime >= entry.left &&
        currentTime <= entry.left + entry.clip.duration
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

  const masterEntry = useMemo(() => {
    if (activeClipEntry) {
      return activeClipEntry;
    }
    if (visualStack.length > 0) {
      return visualStack[visualStack.length - 1];
    }
    if (audioStack.length > 0) {
      return audioStack[0];
    }
    return null;
  }, [activeClipEntry, visualStack, audioStack]);

  const wasPlayingRef = useRef(false);

  const projectAspectRatio = useMemo(() => {
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

  const stageAspectRatio = useMemo(() => {
    if (stageSize.width > 0 && stageSize.height > 0) {
      return stageSize.width / stageSize.height;
    }
    return projectAspectRatio;
  }, [stageSize, projectAspectRatio]);

  const baseVisualEntry = useMemo(() => {
    const visuals = timelineLayout.filter(
      (entry) => entry.asset.kind !== "audio"
    );
    if (visuals.length === 0) {
      return null;
    }
    return visuals.reduce((first, entry) =>
      entry.left < first.left ? entry : first
    );
  }, [timelineLayout]);

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

  useEffect(() => {
    if (!isPlaying) {
      wasPlayingRef.current = false;
      return;
    }
    if (!masterEntry) {
      return;
    }
    const element =
      masterEntry.asset.kind === "audio"
        ? audioRefs.current.get(masterEntry.clip.id)
        : visualRefs.current.get(masterEntry.clip.id);
    if (!element) {
      return;
    }
    const clipTime = clamp(
      currentTime - masterEntry.clip.startTime + masterEntry.clip.startOffset,
      masterEntry.clip.startOffset,
      masterEntry.clip.startOffset + masterEntry.clip.duration
    );
    if (Math.abs(element.currentTime - clipTime) > 0.05) {
      element.currentTime = clipTime;
    }
    const handleTimeUpdate = () => {
      const timelineTime =
        masterEntry.clip.startTime +
        (element.currentTime - masterEntry.clip.startOffset);
      setCurrentTime(timelineTime);
      if (timelineTime >= timelineTotal) {
        setIsPlaying(false);
      }
    };
    element.addEventListener("timeupdate", handleTimeUpdate);
    if (element.paused) {
      const playPromise = element.play();
      if (playPromise) {
        playPromise.catch(() => setIsPlaying(false));
      }
    }
    return () => {
      element.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [isPlaying, masterEntry, timelineTotal]);

  useEffect(() => {
    if (!isPlaying || masterEntry) {
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
  }, [isPlaying, masterEntry, timelineTotal]);

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
        return {
          id: crypto.randomUUID(),
          name: file.name,
          kind,
          url,
          size: file.size,
          duration: meta.duration,
          width: meta.width,
          height: meta.height,
          aspectRatio: meta.aspectRatio,
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
    let cursor = 0;
    if (offsetY < 0) {
      laneId = rows[0].id;
    } else {
      const totalHeight =
        rows.reduce((sum, lane) => sum + lane.height, 0) +
        Math.max(0, rows.length - 1) * laneGap;
      if (offsetY > totalHeight + laneGap) {
        laneId = createLaneId(laneType, draftLanes);
      } else {
        for (const lane of rows) {
          const laneTop = cursor;
          const laneBottom = cursor + lane.height + laneGap;
          if (offsetY >= laneTop && offsetY <= laneBottom) {
            laneId = lane.id;
            break;
          }
          cursor += lane.height + laneGap;
        }
      }
    }
    if (!laneId) {
      laneId = createLaneId(laneType, draftLanes);
    }
    const laneMeta = draftLanes.find((lane) => lane.id === laneId);
    if (laneMeta && laneMeta.type !== laneType) {
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

  const closeFloatingMenu = useCallback(() => {
    setFloatingMenu(closeFloatingMenuState);
  }, []);

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
    setFloatingMenu(createFloatingMenuState(entry.clip.id, x, y));
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
      const newAsset: MediaAsset = {
        id: crypto.randomUUID(),
        name: file.name,
        kind: "video",
        url,
        size: file.size,
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
        aspectRatio: meta.aspectRatio,
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
    event.preventDefault();
    event.stopPropagation();
    closeFloatingMenu();
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
    const startRect = ensureClipTransform(entry.clip.id, entry.asset);
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
      const snappedTime = Math.round(rawTime / snapInterval) * snapInterval;
      const maxStart = Math.max(0, timelineDuration + 10);
      const targetTime = clamp(snappedTime, 0, maxStart);
      let targetLaneId = dragClipState.targetLaneId ?? dragClipState.startLaneId;
      let createdLaneId = dragClipState.createdLaneId;
      if (track) {
        const rect = track.getBoundingClientRect();
        const offsetY = event.clientY - rect.top - timelinePadding;
        let cursor = 0;
        let foundLaneId: string | null = null;
        if (laneRows.length > 0) {
          if (offsetY < 0) {
            foundLaneId = laneRows[0].id;
          } else {
            const totalHeight =
              laneRows.reduce((sum, lane) => sum + lane.height, 0) +
              Math.max(0, laneRows.length - 1) * laneGap;
            if (offsetY > totalHeight + laneGap && asset) {
              const laneType = getLaneType(asset);
              if (!createdLaneId) {
                const nextLanes = [...lanesRef.current];
                createdLaneId = createLaneId(laneType, nextLanes);
                setLanes(nextLanes);
              }
              foundLaneId = createdLaneId;
            } else {
              for (const lane of laneRows) {
                const laneTop = cursor;
                const laneBottom = cursor + lane.height + laneGap;
                if (offsetY >= laneTop && offsetY <= laneBottom) {
                  foundLaneId = lane.id;
                  break;
                }
                cursor += lane.height + laneGap;
              }
            }
          }
        }
        if (foundLaneId) {
          targetLaneId = foundLaneId;
        }
      }
      if (
        targetLaneId !== dragClipState.targetLaneId ||
        createdLaneId !== dragClipState.createdLaneId
      ) {
        setDragClipState((prev) =>
          prev
            ? {
              ...prev,
              targetLaneId,
              createdLaneId,
            }
            : prev
        );
      }
      setTimeline((prev) =>
        prev.map((clip) =>
          clip.id === dragged.id
            ? {
              ...clip,
              startTime: targetTime,
              laneId: targetLaneId,
            }
            : clip
        )
      );
    };
    const handleUp = () => {
      setTimeline((prev) => {
        const dragged = prev.find((clip) => clip.id === dragClipState.clipId);
        if (!dragged) {
          return prev;
        }
        const targetLaneId =
          dragClipState.targetLaneId ?? dragClipState.startLaneId;
        const remaining = prev.filter(
          (clip) => clip.id !== dragClipState.clipId
        );
        const shouldAppend =
          targetLaneId !== dragClipState.startLaneId &&
          targetLaneId !== dragClipState.createdLaneId;
        const appendedStart = getLaneEndTime(targetLaneId, remaining);
        return [
          ...remaining,
          {
            ...dragged,
            laneId: targetLaneId,
            startTime: shouldAppend ? appendedStart : dragged.startTime,
          },
        ];
      });
      dragClipHistoryRef.current = false;
      setDragClipState(null);
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
      const xLines = Array.from(new Set([...stageLinesX, ...backgroundLinesX]));
      const yLines = Array.from(new Set([...stageLinesY, ...backgroundLinesY]));
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
        minLayerSize
      );
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
  }, [dragTransformState, baseBackgroundTransform, snapGuides, pushHistory]);

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
      const hasHorizontal = handle.includes("w") || handle.includes("e");
      const hasVertical = handle.includes("n") || handle.includes("s");
      const keepAspect = !event.shiftKey;
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

      const clamped = clampTransformToStage(
        next,
        { width: rect.width, height: rect.height },
        minLayerSize
      );
      setClipTransforms((prev) => ({
        ...prev,
        [resizeTransformState.clipId]: clamped,
      }));
    };
    const handleUp = () => {
      setResizeTransformState(null);
      resizeTransformHistoryRef.current = false;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [resizeTransformState, pushHistory]);

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
        let cursor = 0;
        if (laneRows.length > 0) {
          if (offsetY < 0) {
            laneId = laneRows[0].id;
          } else {
            const totalHeight = lanesHeight;
            if (offsetY > totalHeight + laneGap) {
              laneId = createLaneId(laneType, nextLanes);
            } else {
              for (const lane of laneRows) {
                const laneTop = cursor;
                const laneBottom = cursor + lane.height + laneGap;
                if (offsetY >= laneTop && offsetY <= laneBottom) {
                  laneId = lane.id;
                  break;
                }
                cursor += lane.height + laneGap;
              }
            }
          }
        }
        if (!laneId) {
          laneId = createLaneId(laneType, nextLanes);
        }
        const laneMeta = lanesRef.current.find((lane) => lane.id === laneId);
        if (laneMeta && laneMeta.type !== laneType) {
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
    const handleMove = (event: MouseEvent) => {
      handleScrubTo(event.clientX);
    };
    const handleUp = () => setIsScrubbing(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
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

  const renderSidebar = () => (
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
                      {selectedVideoSettings.volume}%
                    </span>
                  </div>
                  <div className="relative mt-3 h-4">
                    <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-gray-200/80" />
                    <div
                      className="pointer-events-none absolute left-0 top-1/2 h-[6px] -translate-y-1/2 rounded-full bg-[#5B6CFF]"
                      style={{ width: `${selectedVideoSettings.volume}%` }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={selectedVideoSettings.volume}
                      onChange={(event) =>
                        updateClipSettings(selectedVideoEntry.clip.id, (current) => ({
                          ...current,
                          volume: clamp(Number(event.target.value), 0, 100),
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
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                      Rotation
                    </span>
                    <div className="flex items-center gap-1 rounded-lg border border-gray-200/70 bg-gray-50/70 px-2 py-1">
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
                        className="w-14 bg-transparent text-right text-xs font-semibold text-gray-700 outline-none"
                      />
                      <span className="text-[11px] text-gray-400">deg</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${selectedVideoSettings.flipH
                        ? "border-[#C7D2FE] bg-[#EEF2FF] text-[#335CFF] shadow-[0_4px_12px_rgba(51,92,255,0.18)]"
                        : "border-gray-200/70 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      onClick={() =>
                        updateClipSettings(selectedVideoEntry.clip.id, (
                          current
                        ) => ({ ...current, flipH: !current.flipH }))
                      }
                    >
                      Flip H
                    </button>
                    <button
                      type="button"
                      className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${selectedVideoSettings.flipV
                        ? "border-[#C7D2FE] bg-[#EEF2FF] text-[#335CFF] shadow-[0_4px_12px_rgba(51,92,255,0.18)]"
                        : "border-gray-200/70 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      onClick={() =>
                        updateClipSettings(selectedVideoEntry.clip.id, (
                          current
                        ) => ({ ...current, flipV: !current.flipV }))
                      }
                    >
                      Flip V
                    </button>
                  </div>
                </div>

                <div className={`${panelCardClass} space-y-3`}>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                    Timing
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200/70 bg-white text-gray-500 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30 focus-visible:ring-offset-2"
                      aria-label="Set start time to playhead"
                      onClick={() =>
                        handleSetStartAtPlayhead(selectedVideoEntry.clip)
                      }
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
                        key={`${selectedVideoEntry.clip.id}-start-${selectedVideoEntry.clip.startTime}`}
                        defaultValue={formatTimeWithTenths(
                          selectedVideoEntry.clip.startTime
                        )}
                        onBlur={(event) =>
                          handleStartTimeCommit(
                            selectedVideoEntry.clip,
                            event.target.value
                          )
                        }
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
                        key={`${selectedVideoEntry.clip.id}-end-${selectedVideoEntry.clip.startTime}-${selectedVideoEntry.clip.duration}`}
                        defaultValue={formatTimeWithTenths(
                          selectedVideoEntry.clip.startTime +
                          selectedVideoEntry.clip.duration
                        )}
                        onBlur={(event) =>
                          handleEndTimeCommit(
                            selectedVideoEntry.clip,
                            event.target.value
                          )
                        }
                        className="rounded-lg border border-gray-200/70 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700"
                      />
                    </div>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200/70 bg-white text-gray-500 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFF]/30 focus-visible:ring-offset-2"
                      aria-label="Set end time to playhead"
                      onClick={() =>
                        handleSetEndAtPlayhead(selectedVideoEntry.clip)
                      }
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
                            onClick={() => setTextPanelTag(tag)}
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
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*,audio/*,image/*"
                  multiple
                  className="hidden"
                  onChange={handleFiles}
                />
                {isBackgroundSelected && (
                  <div className="mt-5 rounded-2xl border border-gray-100 bg-[#F8FAFF] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                          Background
                        </h3>
                        <p className="text-[11px] text-gray-400">Behind clips</p>
                      </div>
                      <input
                        type="color"
                        aria-label="Background color"
                        value={canvasBackground}
                        onChange={(event) =>
                          setCanvasBackground(event.target.value)
                        }
                        className="h-7 w-7 cursor-pointer rounded-full border border-gray-200 bg-transparent"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {backgroundSwatches.map((swatch) => (
                        <button
                          key={swatch}
                          type="button"
                          className={`h-6 w-6 rounded-full border transition ${canvasBackground.toLowerCase() === swatch.toLowerCase()
                            ? "border-[#335CFF] ring-2 ring-[#335CFF]/20"
                            : "border-gray-200"
                            }`}
                          style={{ backgroundColor: swatch }}
                          onClick={() => setCanvasBackground(swatch)}
                          aria-label={`Set background to ${swatch}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div
            className={`flex-1 min-h-0 overflow-y-auto ${activeTool === "text" ? "bg-white" : "bg-[#F7F8FC]"
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
            ) : (
              <div
                className={
                  activeTool === "text"
                    ? "space-y-8 px-6 py-6"
                    : "space-y-8 px-5 py-5"
                }
              >
                {activeTool === "text" ? (
                  textPanelView === "library" ? (
                    <div className="space-y-12">
                      {visibleTextPresetGroups.map((group) => (
                        <div key={group.id}>
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-md font-semibold text-gray-900">
                              {group.label}
                            </h3>
                            <button
                              type="button"
                              className="flex items-center gap-1 text-xs font-semibold text-gray-500 transition hover:text-gray-700"
                            >
                              View All
                              <svg viewBox="0 0 16 16" className="h-4 w-4">
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
                          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-3 auto-rows-[120px] sm:auto-rows-[130px] lg:auto-rows-[84px]">
                            {group.presets.map((preset) => (
                              <button
                                key={preset.id}
                                type="button"
                                className="h-full text-left"
                                onClick={() => handleTextPresetSelect(preset)}
                              >
                                <div className="flex h-full flex-col items-center justify-center gap-1 rounded-[10px] bg-[#F7F7F8] text-gray-900 transition hover:bg-[#EFF0F2] hover:text-gray-700">
                                  {preset.preview.map((line, lineIndex) => (
                                    <span
                                      key={`${preset.id}-${lineIndex}`}
                                      className={`leading-none ${line.className ?? ""}`}
                                      style={{
                                        fontSize: line.size,
                                        fontFamily: line.fontFamily,
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
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <div className="rounded-lg border border-transparent bg-gray-50 p-4">
                          <textarea
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
                              fontFamily: textPanelFontFamily,
                              fontSize: textPanelFontSize,
                              fontWeight: textPanelBold ? 600 : 400,
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
                              style={{ fontFamily: textPanelFontFamily }}
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
                              value={textPanelFontSize}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                setTextPanelFontSize(value);
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
                              {textFontSizes.map((size) => (
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
                          <label className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm">
                            <input
                              type="color"
                              aria-label="Text color"
                              value={textPanelColor}
                              onChange={(event) => {
                                const value = event.target.value;
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
                              className="h-6 w-6 cursor-pointer rounded-full border border-gray-200"
                            />
                          </label>
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

                      <button
                        type="button"
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
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
                      </button>

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
                          onClick={() => setIsAssetLibraryExpanded(true)}
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
                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {stockVideos.map((stock) => (
                            <div key={stock.id} className="space-y-2">
                              <div className="relative h-24 overflow-hidden rounded-2xl border border-gray-200">
                                <img
                                  src={stock.image}
                                  alt={stock.title}
                                  className="h-full w-full object-cover"
                                />
                                <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                                  {stock.duration}
                                </span>
                              </div>
                              <div className="text-[11px] font-medium text-gray-700">
                                {stock.title}
                              </div>
                            </div>
                          ))}
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

  const renderStage = () => (
    <div className="flex min-h-0 flex-1">
      <div
        ref={stageRef}
        className={`relative flex h-full w-full items-center justify-center overflow-hidden ${dragOverCanvas ? "ring-2 ring-[#335CFF]" : ""
          }`}
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
        <div className="pointer-events-none absolute inset-0 border border-gray-200 bg-[#F2F4FA] shadow-sm" />
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
              backgroundColor: canvasBackground,
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
              const videoStyles = videoSettings
                ? getVideoStyles(videoSettings)
                : null;
              const noiseLevel = videoSettings?.noise ?? 0;
              const vignetteLevel = videoSettings?.vignette ?? 0;
              const clipZ = index + 2;
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
                  }}
                >
                  <div
                    className={`relative h-full w-full ${isActive ? "cursor-move" : "cursor-pointer"
                      }`}
                    onPointerDown={(event) =>
                      handleLayerPointerDown(event, entry)
                    }
                    onContextMenu={(event) =>
                      handleClipContextMenu(event, entry)
                    }
                  >
                    {entry.asset.kind === "text" ? (
                      <div className="absolute inset-0 flex items-center justify-center overflow-hidden px-3">
                        <div
                          className="w-full"
                          style={{
                            fontFamily: textClipSettings?.fontFamily,
                            fontSize: textClipSettings?.fontSize,
                            fontWeight: textClipSettings?.bold ? 600 : 400,
                            fontStyle: textClipSettings?.italic
                              ? "italic"
                              : "normal",
                            textAlign: textClipSettings?.align,
                            color: textClipSettings?.color,
                            lineHeight: textClipSettings?.lineHeight,
                            letterSpacing: textClipSettings?.letterSpacing,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {textClipSettings?.text ?? entry.asset.name}
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
                              ref={registerVideoRef(entry.clip.id)}
                              src={entry.asset.url}
                              className="h-full w-full object-cover"
                              playsInline
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
                        {transformHandles.map((handle) => (
                          <button
                            key={`${entry.clip.id}-${handle.id}`}
                            type="button"
                            className={`absolute h-3 w-3 rounded-full border border-[#335CFF] bg-white shadow-sm ${handle.className} ${handle.cursor}`}
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
            <div className="absolute bottom-6 right-6 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm">
              {formatDuration(activeClipEntry?.clip.duration)}
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
                      style={{ width: `${floatingVideoSettings.volume}%` }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={floatingVideoSettings.volume}
                      onChange={(event) =>
                        updateClipSettings(floatingMenuEntry.clip.id, (current) => ({
                          ...current,
                          volume: clamp(Number(event.target.value), 0, 100),
                        }))
                      }
                      className="refined-slider relative z-10 h-5 w-full cursor-pointer appearance-none bg-transparent"
                      aria-label="Volume"
                    />
                  </div>
                  <input
                    readOnly
                    value={`${floatingVideoSettings.volume}%`}
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
          <button
            className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={handleDownloadSelection}
            disabled={!selectedRange}
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4">
              <path
                d="M13.5 10.5V12a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-1.5M8 2v7m0 0 2.5-2.5M8 9 5.5 6.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden lg:block">Download</span>
            {selectionRangeLabel && (
              <span className="hidden text-[11px] font-medium text-gray-500 sm:block">
                ({selectionRangeLabel})
              </span>
            )}
          </button>
        </div>
        <div className="relative flex items-center">
          <div className="flex items-center gap-1">
            <button
              className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-700"
              type="button"
              aria-label="Skip back"
              onClick={() => {
                if (isPlaying) {
                  setIsPlaying(false);
                }
                handleScrubToTime(currentTime - frameStepSeconds);
              }}
            >
              <svg viewBox="0 0 16 16" className="h-3 w-3">
                <path
                  d="M14 12.913a.5.5 0 0 1-.826.38L7.443 8.38a.5.5 0 0 1 0-.76l5.731-4.912a.5.5 0 0 1 .826.38zM7 12.913a.5.5 0 0 1-.825.38L.443 8.38a.5.5 0 0 1 0-.76l5.732-4.913a.5.5 0 0 1 .825.38z"
                  fill="currentColor"
                />
              </svg>
            </button>
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
            <button
              className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-700"
              type="button"
              aria-label="Skip forward"
              onClick={() => {
                if (isPlaying) {
                  setIsPlaying(false);
                }
                handleScrubToTime(currentTime + frameStepSeconds);
              }}
            >
              <svg viewBox="0 0 16 16" className="h-3 w-3">
                <path
                  d="M2 3.087a.5.5 0 0 1 .825-.38L8.557 7.62a.5.5 0 0 1 0 .76l-5.732 4.913a.5.5 0 0 1-.825-.38zM9 3.087a.5.5 0 0 1 .825-.38l5.732 4.913a.5.5 0 0 1 0 .76l-5.732 4.913a.5.5 0 0 1-.825-.38z"
                  fill="currentColor"
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
        className="w-full min-w-0 flex-1 overflow-x-auto overflow-y-auto overscroll-x-contain overscroll-y-contain px-4 pb-5"
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
                className="pointer-events-none absolute rounded-lg border border-[#335CFF] bg-[#335CFF]/10"
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
            {timelineLayout.length > 0 && (
              <div
                className="pointer-events-none absolute top-4 bottom-4 w-px bg-[#335CFF]"
                style={{
                  left: `${clamp(
                    currentTime,
                    0,
                    timelineDuration
                  ) * timelineScale + timelinePadding}px`,
                }}
              >
                <span className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-[#335CFF]" />
              </div>
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
                  return (
                    <div
                      key={lane.id}
                      className="relative overflow-hidden rounded-xl border border-gray-100 bg-white/70"
                      style={{ height: `${lane.height}px` }}
                    >
                      <div className="absolute left-2 top-2 text-[10px] uppercase tracking-[0.12em] text-gray-400">
                        {lane.label}
                      </div>
                      {laneClips.map(({ clip, asset, left }) => {
                        const width = Math.max(
                          1,
                          Math.round(clip.duration * timelineScale)
                        );
                        const isSelected =
                          selectedClipIdsSet.has(clip.id);
                        const isDragging =
                          dragClipState?.clipId === clip.id;
                        const waveform = getWaveformBars(clip.id, 24);
                        const textPreview =
                          textSettings[clip.id]?.text ?? asset.name;
                        const textPreviewLine =
                          textPreview.split("\n")[0]?.trim() || "Text";
                        return (
                          <div
                            key={clip.id}
                            className="absolute top-1/2 -translate-y-1/2"
                            style={{
                              left: `${left * timelineScale}px`,
                              width,
                            }}
                          >
                            <button
                              type="button"
                              className={`group relative flex h-full w-full flex-col justify-between overflow-hidden rounded-xl border px-3 py-2 text-left text-xs font-semibold shadow-sm transition ${isSelected
                                ? "border-[#335CFF] bg-[#EEF2FF] text-[#335CFF]"
                                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                                } ${isDragging ? "opacity-70" : ""}`}
                              data-timeline-clip="true"
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
                                setDragClipState({
                                  clipId: clip.id,
                                  startX: event.clientX,
                                  startLeft: left,
                                  startLaneId: clip.laneId,
                                });
                              }}
                            >
                              {lane.type === "video" && (
                                <div className="absolute inset-0">
                                  {asset.kind === "image" ? (
                                    <img
                                      src={asset.url}
                                      alt={asset.name}
                                      className="h-full w-full object-cover opacity-80"
                                    />
                                  ) : (
                                    <video
                                      src={asset.url}
                                      className="h-full w-full object-cover opacity-70"
                                      muted
                                      playsInline
                                      preload="metadata"
                                    />
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-white/30 to-white/80" />
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
                              <span
                                className={`relative z-10 truncate ${
                                  lane.type === "text"
                                    ? "text-[11px] font-semibold"
                                    : ""
                                }`}
                                style={
                                  lane.type === "text"
                                    ? {
                                        fontFamily:
                                          textSettings[clip.id]?.fontFamily,
                                      }
                                    : undefined
                                }
                              >
                                {lane.type === "text"
                                  ? textPreviewLine
                                  : asset.name}
                              </span>
                              <span className="relative z-10 text-[10px] text-gray-400">
                                {formatDuration(clip.duration)}
                              </span>
                              <span
                                className="absolute left-0 top-0 h-full w-2 cursor-col-resize rounded-l-xl bg-black/5"
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
                                className="absolute right-0 top-0 h-full w-2 cursor-col-resize rounded-r-xl bg-black/5"
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
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#F2F4FA] text-[#0E121B]">
      {renderHeader()}

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
