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
  type PointerEvent,
  type WheelEvent,
} from "react";

type MediaKind = "video" | "audio" | "image";

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

const fallbackDuration = 8;
const minClipDuration = 1;
const timelineScaleMin = 6;
const timelineScaleMax = 24;
const snapInterval = 0.5;
const laneGap = 10;
const timelinePadding = 16;
const defaultTimelineHeight = 260;
const minCanvasHeight = 80;
const timelineHandleHeight = 16;
const laneHeights: Record<LaneType, number> = {
  video: 56,
  audio: 40,
  text: 32,
};
const minLayerSize = 80;

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

const toolbarItems = [
  {
    id: "ai",
    label: "AI Tools",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6-4.6-1.9 4.6-1.9L12 3.5Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    id: "script",
    label: "Script",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <rect
          x="5"
          y="3"
          width="14"
          height="18"
          rx="2"
          fill="currentColor"
        />
        <rect x="8" y="7" width="8" height="2" rx="1" fill="white" />
        <rect x="8" y="11" width="6" height="2" rx="1" fill="white" />
      </svg>
    ),
  },
  {
    id: "video",
    label: "Video",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <rect
          x="3"
          y="5"
          width="14"
          height="14"
          rx="3"
          fill="currentColor"
        />
        <path d="M13 12l6-4v8l-6-4Z" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "audio",
    label: "Audio",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M14 5v9.5a3.5 3.5 0 1 1-2-3.15V7.2l8-2V12a3.5 3.5 0 1 1-2-3.15V4.5L14 5Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    id: "image",
    label: "Image",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <rect
          x="3"
          y="5"
          width="18"
          height="14"
          rx="3"
          fill="currentColor"
        />
        <circle cx="9" cy="10" r="2" fill="white" />
        <path d="M6 17l4-4 3 3 3-3 2 4H6Z" fill="white" />
      </svg>
    ),
  },
  {
    id: "subtitles",
    label: "Subtitles",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <rect
          x="3"
          y="5"
          width="18"
          height="14"
          rx="3"
          fill="currentColor"
        />
        <rect x="7" y="14" width="10" height="2" rx="1" fill="white" />
      </svg>
    ),
  },
  {
    id: "text",
    label: "Text",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M6 6h12v2H13v10h-2V8H6V6Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    id: "elements",
    label: "Elements",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <rect x="3" y="4" width="8" height="8" rx="2" fill="currentColor" />
        <rect x="13" y="12" width="8" height="8" rx="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "brand",
    label: "Brand Kit",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M7 4h6a4 4 0 0 1 4 4v6a6 6 0 1 1-10-10Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z"
          fill="currentColor"
        />
        <path
          d="M4.5 12a7.5 7.5 0 0 1 .13-1.35l-2-1.5 2-3.5 2.4.86a7.6 7.6 0 0 1 2.35-1.35L10 2h4l.62 2.66a7.6 7.6 0 0 1 2.35 1.35l2.4-.86 2 3.5-2 1.5A7.5 7.5 0 0 1 19.5 12c0 .46-.04.91-.13 1.35l2 1.5-2 3.5-2.4-.86a7.6 7.6 0 0 1-2.35 1.35L14 22h-4l-.62-2.66a7.6 7.6 0 0 1-2.35-1.35l-2.4.86-2-3.5 2-1.5A7.5 7.5 0 0 1 4.5 12Z"
          fill="currentColor"
        />
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

const backgroundSwatches = [
  "#0B0B0B",
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

const getLaneType = (asset?: MediaAsset | null): LaneType =>
  asset?.kind === "audio" ? "audio" : "video";

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
  const [uploading, setUploading] = useState(false);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [canvasBackground, setCanvasBackground] = useState("#F2F4FA");
  const [timelineHeight, setTimelineHeight] = useState(
    defaultTimelineHeight
  );
  const [timelineScale, setTimelineScale] = useState(12);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>([]);
  const [activeCanvasClipId, setActiveCanvasClipId] = useState<string | null>(
    null
  );
  const [clipTransforms, setClipTransforms] = useState<
    Record<string, ClipTransform>
  >({});
  const [backgroundTransforms, setBackgroundTransforms] = useState<
    Record<string, ClipTransform>
  >({});
  const [clipSettings, setClipSettings] = useState<
    Record<string, VideoClipSettings>
  >({});
  const [videoPanelView, setVideoPanelView] = useState<"edit" | "adjust">(
    "edit"
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
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [mainHeight, setMainHeight] = useState(0);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineTrackRef = useRef<HTMLDivElement | null>(null);
  const visualRefs = useRef(new Map<string, HTMLVideoElement | null>());
  const audioRefs = useRef(new Map<string, HTMLAudioElement | null>());
  const timelinePanRef = useRef<{
    startX: number;
    scrollLeft: number;
    active: boolean;
  }>({ startX: 0, scrollLeft: 0, active: false });
  const fallbackVideoSettings = useMemo(createDefaultVideoSettings, []);
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

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    lanesRef.current = lanes;
  }, [lanes]);

  useEffect(() => {
    setLanes((prev) =>
      prev.filter((lane) => timeline.some((clip) => clip.laneId === lane.id))
    );
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

  const activeToolLabel = useMemo(() => {
    return toolbarItems.find((item) => item.id === activeTool)?.label ?? "Panel";
  }, [activeTool]);

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
      return assets;
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
  const selectedVideoEntry = useMemo(() => {
    if (selectedEntry?.asset.kind === "video") {
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
  const canPlay = Boolean(activeClipEntry || firstClipEntry);
  const hasTimelineClips = timeline.length > 0;
  const showEmptyState = !hasTimelineClips;
  const showVideoPanel = Boolean(selectedVideoEntry && selectedVideoSettings);

  const visualStack = useMemo(() => {
    const visible = timelineLayout.filter(
      (entry) =>
        entry.asset.kind !== "audio" &&
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
    if (event.target !== event.currentTarget) {
      return;
    }
    const track = timelineTrackRef.current;
    if (!track) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
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
    const entry =
      getClipAtTime(nextTime, "visual") ?? getClipAtTime(nextTime, "audio");
    if (entry) {
      const element =
        entry.asset.kind === "audio"
          ? audioRefs.current.get(entry.clip.id)
          : visualRefs.current.get(entry.clip.id);
      const clipTime = clamp(
        nextTime - entry.clip.startTime + entry.clip.startOffset,
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
    setCurrentTime(nextTime);
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
  }, [audioStack, currentTime, isPlaying]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }
    setUploading(true);
    try {
      const newAssets = await Promise.all(
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
    setSelectedClipId(rightClip.id);
    setSelectedClipIds([rightClip.id]);
    setActiveAssetId(clip.assetId);
  };

  const resolveClipTransform = useCallback(
    (clipId: string, asset: MediaAsset) => {
      return (
        clipTransforms[clipId] ??
        createDefaultTransform(asset.aspectRatio, stageAspectRatio)
      );
    },
    [clipTransforms, stageAspectRatio]
  );

  const ensureClipTransform = useCallback(
    (clipId: string, asset: MediaAsset) => {
      const existing = clipTransforms[clipId];
      if (existing) {
        return existing;
      }
      const next = createDefaultTransform(asset.aspectRatio, stageAspectRatio);
      setClipTransforms((prev) => ({ ...prev, [clipId]: next }));
      return next;
    },
    [clipTransforms, stageAspectRatio]
  );

  const updateClipSettings = (
    clipId: string,
    updater: (current: VideoClipSettings) => VideoClipSettings
  ) => {
    setClipSettings((prev) => {
      const current = prev[clipId] ?? createDefaultVideoSettings();
      const next = updater(current);
      return { ...prev, [clipId]: next };
    });
  };

  const handleDeleteSelected = () => {
    if (!selectedClipId) {
      return;
    }
    setTimeline((prev) => {
      const idsToRemove =
        selectedClipIds.length > 0 ? selectedClipIds : [selectedClipId];
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
  };

  const handleDetachAudio = () => {
    if (!selectedVideoEntry) {
      return;
    }
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

  const handleStartTimeCommit = (clip: TimelineClip, value: string) => {
    const nextStart = parseTimeInput(value);
    if (nextStart == null) {
      return;
    }
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
    const asset = assetsRef.current.find((item) => item.id === clip.assetId);
    const assetDuration = getAssetDurationSeconds(asset);
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
    const assetDuration = getAssetDurationSeconds(asset);
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
    setActiveCanvasClipId(null);
    setSelectedClipId(null);
    setSelectedClipIds([]);
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
    const startRect = ensureClipTransform(entry.clip.id, entry.asset);
    setSelectedClipId(entry.clip.id);
    setSelectedClipIds([entry.clip.id]);
    setActiveAssetId(entry.asset.id);
    setActiveCanvasClipId(entry.clip.id);
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
      const deltaSeconds = (event.clientX - trimState.startX) / timelineScale;
      setTimeline((prev) =>
        prev.map((clip) => {
          if (clip.id !== trimState.clipId) {
            return clip;
          }
          const asset = assetsRef.current.find(
            (item) => item.id === clip.assetId
          );
          const assetDuration = getAssetDurationSeconds(asset);
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
    const handleUp = () => setTrimState(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [trimState, timelineScale]);

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
    if (!dragClipState) {
      return;
    }
    const handleMove = (event: MouseEvent) => {
      const dragged = timeline.find((clip) => clip.id === dragClipState.clipId);
      if (!dragged) {
        return;
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
      const rect = stage.getBoundingClientRect();
      const deltaX = (event.clientX - dragTransformState.startX) / rect.width;
      const deltaY = (event.clientY - dragTransformState.startY) / rect.height;
      const next = clampTransformToStage(
        {
          ...dragTransformState.startRect,
          x: dragTransformState.startRect.x + deltaX,
          y: dragTransformState.startRect.y + deltaY,
        },
        { width: rect.width, height: rect.height },
        minLayerSize
      );
      setClipTransforms((prev) => ({
        ...prev,
        [dragTransformState.clipId]: next,
      }));
    };
    const handleUp = () => setDragTransformState(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragTransformState]);

  useEffect(() => {
    if (!resizeTransformState) {
      return;
    }
    const handleMove = (event: globalThis.PointerEvent) => {
      const stage = stageRef.current;
      if (!stage) {
        return;
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
    const handleUp = () => setResizeTransformState(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [resizeTransformState]);

  const handleAssetDragStart = (
    event: DragEvent<HTMLElement>,
    assetId: string
  ) => {
    event.dataTransfer.setData("text/plain", assetId);
    event.dataTransfer.effectAllowed = "copy";
  };

  const handleCanvasDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
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

  const handleTimelineDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
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

  const handleTimelineWheel = (event: WheelEvent<HTMLDivElement>) => {
    const scrollEl = timelineScrollRef.current;
    if (!scrollEl) {
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
      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!selectedClipId) {
        return;
      }
      event.preventDefault();
      setTimeline((prev) => {
        const idsToRemove =
          selectedClipIds.length > 0 ? selectedClipIds : [selectedClipId];
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
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedClipId, selectedClipIds]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      handleTogglePlayback();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleTogglePlayback]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#F2F4FA] text-[#0E121B]">
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
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200"
                type="button"
                aria-label="Undo"
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
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200"
                type="button"
                aria-label="Redo"
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

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-20 flex-col items-center border-r border-gray-200 bg-white py-4 lg:flex">
        <nav className="mt-6 flex flex-1 flex-col items-center gap-3">
          {toolbarItems.map((item) => {
            const isActive = item.id === activeTool;
            return (
              <button
                key={item.id}
                type="button"
                className="flex w-[68px] flex-col items-center gap-1.5 rounded-xl py-2 text-[10px] font-medium text-gray-500 transition-colors"
                onClick={() => setActiveTool(item.id)}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${isActive
                    ? "bg-[#E7EDFF] text-[#335CFF]"
                    : "bg-transparent text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    }`}
                >
                  {item.icon}
                </span>
                <span className={isActive ? "text-[#335CFF]" : undefined}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

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
        ) : (
          <>
            <div className="sticky top-0 z-10 border-b border-gray-100/70 bg-white/95 px-5 py-5 backdrop-blur">
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
                    onChange={(event) => setCanvasBackground(event.target.value)}
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
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto bg-[#F7F8FC]">
              {isAssetLibraryExpanded ? (
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
                                  <svg viewBox="0 0 24 24" className="h-7 w-7">
                                    <path
                                      d="M12 4v10.2a3.2 3.2 0 1 1-2-3.02V7.3l8-2V12a3.2 3.2 0 1 1-2-3.02V4.5L12 4Z"
                                      fill="currentColor"
                                    />
                                  </svg>
                                </div>
                              )}
                              <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                                {formatDuration(asset.duration)}
                              </span>
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
                <div className="space-y-8 px-5 py-5">
                  {["video", "audio", "image"].includes(activeTool) ? (
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
                                      <svg viewBox="0 0 24 24" className="h-8 w-8">
                                        <path
                                          d="M12 4v10.2a3.2 3.2 0 1 1-2-3.02V7.3l8-2V12a3.2 3.2 0 1 1-2-3.02V4.5L12 4Z"
                                          fill="currentColor"
                                        />
                                      </svg>
                                    </div>
                                  )}
                                  <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                                    {formatDuration(asset.duration)}
                                  </span>
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <main
            ref={mainRef}
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          >
            <div className="flex min-h-0 flex-1">
              <div
                ref={stageRef}
                className={`relative flex h-full w-full items-center justify-center overflow-hidden ${dragOverCanvas ? "ring-2 ring-[#335CFF]" : ""
                  }`}
                onPointerDown={handleStagePointerDown}
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
                      const isSelected = activeCanvasClipId === entry.clip.id;
                      const videoSettings =
                        entry.asset.kind === "video"
                          ? clipSettings[entry.clip.id] ?? fallbackVideoSettings
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
                            className={`relative h-full w-full ${isSelected ? "cursor-move" : "cursor-pointer"
                              }`}
                            onPointerDown={(event) =>
                              handleLayerPointerDown(event, entry)
                            }
                          >
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
                            {isSelected && (
                              <div className="pointer-events-none absolute inset-0 border-2 border-[#335CFF] shadow-[0_0_0_1px_rgba(51,92,255,0.35)]" />
                            )}
                            {isSelected && (
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
                      <svg viewBox="0 0 24 24" className="h-10 w-10">
                        <path
                          d="M12 4v10.2a3.2 3.2 0 1 1-2-3.02V7.3l8-2V12a3.2 3.2 0 1 1-2-3.02V4.5L12 4Z"
                          fill="currentColor"
                        />
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
            </div>

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
                                      onMouseDown={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setActiveAssetId(asset.id);
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
                                      <span className="relative z-10 truncate">
                                        {asset.name}
                                      </span>
                                      <span className="relative z-10 text-[10px] text-gray-400">
                                        {formatDuration(clip.duration)}
                                      </span>
                                      <span
                                        className="absolute left-0 top-0 h-full w-2 cursor-col-resize rounded-l-xl bg-black/5"
                                        onMouseDown={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
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
          </main>
        </div>
      </div>
    </div>
  </div>
  );
}
