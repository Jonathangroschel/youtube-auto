export type MediaKind = "video" | "audio" | "image" | "text";

export type MediaAsset = {
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

export type AssetFilter = "All" | "Video" | "Images" | "Audio";

export type TimelineClip = {
  id: string;
  assetId: string;
  duration: number;
  startOffset: number;
  startTime: number;
  laneId: string;
};

export type LaneType = "video" | "audio" | "text";

export type TimelineLane = {
  id: string;
  type: LaneType;
};

export type TimelineLayoutEntry = {
  clip: TimelineClip;
  asset: MediaAsset;
  left: number;
};

export type ClipDragState = {
  clipId: string;
  startX: number;
  startLeft: number;
  startLaneId: string;
  targetLaneId?: string;
  createdLaneId?: string;
  previewTime?: number;
  previewLaneId?: string;
};

export type TrimEdge = "start" | "end";

export type TrimState = {
  clipId: string;
  edge: TrimEdge;
  startX: number;
  startDuration: number;
  startOffset: number;
  startTime: number;
};

export type ClipTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
};

export type CornerRadii = {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
};

export type VideoClipSettings = {
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

export type TextAlign = "left" | "center" | "right";

export type TextBackgroundStyle =
  | "line-block-hard"
  | "line-block-round"
  | "block"
  | "block-rounded";

export type TextClipSettings = {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  align: TextAlign;
  letterSpacing: number;
  lineHeight: number;
  backgroundEnabled: boolean;
  backgroundColor: string;
  backgroundStyle: TextBackgroundStyle;
  outlineEnabled: boolean;
  outlineColor: string;
  outlineWidth: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOpacity: number;
  boxScaleX?: number;
  boxScaleY?: number;
  autoSize?: boolean;
  wordHighlightEnabled?: boolean;
  wordHighlightColor?: string;
};

export type TransformHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export type TransformDragState = {
  clipId: string;
  startX: number;
  startY: number;
  startRect: ClipTransform;
};

export type TransformResizeState = {
  clipId: string;
  handle: TransformHandle;
  startX: number;
  startY: number;
  startRect: ClipTransform;
  aspectRatio: number;
};

export type TransformRotateState = {
  clipId: string;
  startX: number;
  startY: number;
  startRotation: number;
  centerX: number;
  centerY: number;
};

export type RangeSelectionState = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  trackRect: DOMRect;
  additive: boolean;
  originSelection: string[];
};

export type FloatingMenuState = {
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

export type TimelineContextMenuState = {
  open: boolean;
  x: number;
  y: number;
  clipId: string | null;
  showReplaceMedia: boolean;
  showAudio: boolean;
};

export type SnapGuides = {
  x: number[];
  y: number[];
};

export type EditorSnapshot = {
  assets: MediaAsset[];
  timeline: TimelineClip[];
  lanes: TimelineLane[];
  clipTransforms: Record<string, ClipTransform>;
  backgroundTransforms: Record<string, ClipTransform>;
  clipSettings: Record<string, VideoClipSettings>;
  textSettings: Record<string, TextClipSettings>;
  clipOrder: Record<string, number>;
  canvasBackground: string;
  videoBackground: string;
  currentTime: number;
  selectedClipId: string | null;
  selectedClipIds: string[];
  activeAssetId: string | null;
  activeCanvasClipId: string | null;
};

export type ClipboardData = {
  clips: TimelineClip[];
  clipSettings: Record<string, VideoClipSettings>;
  textSettings: Record<string, TextClipSettings>;
  clipTransforms: Record<string, ClipTransform>;
};

export type KeyboardShortcutState = {
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

export type TextPresetTag = "All" | "Simple" | "Title";
export type TextPresetCategory = Exclude<TextPresetTag, "All">;
export type TextPanelView = "library" | "edit";

export type TextPreviewLine = {
  text: string;
  size: number;
  weight?: number;
  fontFamily?: string;
  className?: string;
};

export type TextPreset = {
  id: string;
  name: string;
  category: TextPresetCategory;
  preview: TextPreviewLine[];
  editText: string;
  editFontSize: number;
  editFontFamily?: string;
};

export type TextStylePreset = {
  id: string;
  name: string;
  settings: Partial<TextClipSettings>;
  preview?: {
    text?: string;
    fontFamily?: string;
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
  };
};

export type TextPresetGroup = {
  id: string;
  label: string;
  category: TextPresetCategory;
  presets: TextPreset[];
};
