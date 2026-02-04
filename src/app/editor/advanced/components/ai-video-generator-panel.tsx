"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  ImageIcon,
  Sparkles,
  Video,
  X,
} from "lucide-react";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { ToggleSwitch } from "./toggle-switch";

type SelectOption = {
  label: string;
  value: string;
};

type UploadSlot = {
  id: string;
  label: string;
  optional?: boolean;
  helperText?: string;
  inputKind?: "image" | "video";
};

export type AiVideoUploadedImage = {
  assetId: string;
  url: string;
  name: string;
  kind?: "image" | "video";
  width?: number;
  height?: number;
  aspectRatio?: number;
};

export type AiVideoUploadContext = {
  modelId: string;
  variantId: string;
  slotId: string;
  mode: "frame" | "ingredient";
};

export type AiVideoGenerateRequest = {
  modelId: string;
  variantId: string;
  prompt: string;
  aspectRatio: string;
  duration: number;
  resolution?: string;
  quality?: string;
  generateAudio: boolean;
  ingredientsMode: "frames" | "ingredients";
  fixedLensEnabled: boolean;
  multiShotEnabled: boolean;
  sceneControlEnabled?: boolean;
  characterOrientation?: "image" | "video";
  frameImages: Record<string, AiVideoUploadedImage | null>;
  ingredientImages: AiVideoUploadedImage[];
};

type ModelVariant = {
  id: string;
  name: string;
  description: string;
  caps: string[];
  durationOptions: SelectOption[];
  aspectOptions: SelectOption[];
  resolutionOptions: SelectOption[];
  qualityOptions?: SelectOption[];
  frameSlots: UploadSlot[];
  implemented?: boolean;
  supportsIngredientsMode?: boolean;
  ingredientsLimit?: number;
  ingredientInputKind?: "image" | "video";
  allowIngredientsAlongsideFrames?: boolean;
  showFixedLensToggle?: boolean;
  showAudioToggle?: boolean;
  showMultiShotToggle?: boolean;
  showDurationControl?: boolean;
  showAspectControl?: boolean;
  showResolutionControl?: boolean;
  showAdvancedSettingsToggle?: boolean;
  showSceneControlToggle?: boolean;
  defaultSceneControlEnabled?: boolean;
  showCharacterOrientationControl?: boolean;
  defaultCharacterOrientation?: "image" | "video";
  audioToggleLabel?: string;
  audioToggleDescription?: string;
  defaultInputMode?: "frames" | "ingredients";
};

type VideoModelConfig = {
  id: string;
  name: string;
  summary: string;
  previewTitle: string;
  previewSubtitle: string;
  variants: ModelVariant[];
  mode?: "create" | "edit" | "motion";
};

export type AiVideoGeneratorPanelProps = {
  promptId?: string;
  prompt: string;
  promptPlaceholder: string;
  onPromptChange: (value: string) => void;
  onEnhancePrompt?: () => void;
  enhanceBusy?: boolean;
  enhanceError?: string | null;
  aspectRatio: string;
  onAspectRatioChange: (value: string) => void;
  duration: number;
  onDurationChange: (value: number) => void;
  generateAudio: boolean;
  onGenerateAudioChange: (value: boolean) => void;
  status: string;
  error?: string | null;
  canGenerate: boolean;
  onGenerate: (request: AiVideoGenerateRequest) => void;
  onUploadImage?: (
    file: File,
    context: AiVideoUploadContext
  ) => Promise<AiVideoUploadedImage>;
  hasGeneratedAsset: boolean;
  onClear?: () => void;
};

const PREVIEW_PLACEHOLDER_SRC = "/placeholders/ai-video-preview.svg";
const LAST_USED_MODEL_STORAGE_KEY = "satura-ai-video-last-model-id";
const GENERATED_VIDEO_EXAMPLES_API = "/api/generated-video-examples?limit=300";
const MODEL_PREVIEW_VIDEO_OVERRIDES: Record<string, string> = {
  "minimax-hailuo":
    "https://eslwirmmwflkmbfqzxxs.supabase.co/storage/v1/object/public/generated-video-examples/video-examples/video.mp4",
  "grok-edit":
    "https://eslwirmmwflkmbfqzxxs.supabase.co/storage/v1/object/public/generated-video-examples/video-examples/FYR3TH6WHCDQS30712GE686VD0.mp4",
  "kling-o3-edit":
    "https://eslwirmmwflkmbfqzxxs.supabase.co/storage/v1/object/public/generated-video-examples/video-examples/video-example-4.mp4",
  "kling-motion-control":
    "https://eslwirmmwflkmbfqzxxs.supabase.co/storage/v1/object/public/generated-video-examples/video-examples/v2-fnf-web-kmc-preset.mp4",
};

const DURATION_OPTIONS_4_8_12: SelectOption[] = [
  { label: "4s", value: "4" },
  { label: "8s", value: "8" },
  { label: "12s", value: "12" },
];

const ASPECT_OPTIONS_T2V: SelectOption[] = [
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
];

const ASPECT_OPTIONS_I2V: SelectOption[] = [
  { label: "Auto", value: "auto" },
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
];

const DURATION_OPTIONS_4_6_8: SelectOption[] = [
  { label: "4s", value: "4" },
  { label: "6s", value: "6" },
  { label: "8s", value: "8" },
];

const DURATION_OPTIONS_5_8_10: SelectOption[] = [
  { label: "5s", value: "5" },
  { label: "8s", value: "8" },
  { label: "10s", value: "10" },
];

const DURATION_OPTIONS_6_10: SelectOption[] = [
  { label: "6s", value: "6" },
  { label: "10s", value: "10" },
];

const DURATION_OPTIONS_4_TO_12: SelectOption[] = [
  { label: "4s", value: "4" },
  { label: "5s", value: "5" },
  { label: "6s", value: "6" },
  { label: "7s", value: "7" },
  { label: "8s", value: "8" },
  { label: "9s", value: "9" },
  { label: "10s", value: "10" },
  { label: "11s", value: "11" },
  { label: "12s", value: "12" },
];

const DURATION_OPTIONS_2_TO_12: SelectOption[] = [
  { label: "2s", value: "2" },
  { label: "3s", value: "3" },
  { label: "4s", value: "4" },
  { label: "5s", value: "5" },
  { label: "6s", value: "6" },
  { label: "7s", value: "7" },
  { label: "8s", value: "8" },
  { label: "9s", value: "9" },
  { label: "10s", value: "10" },
  { label: "11s", value: "11" },
  { label: "12s", value: "12" },
];

const DURATION_OPTIONS_3_TO_10: SelectOption[] = [
  { label: "3s", value: "3" },
  { label: "4s", value: "4" },
  { label: "5s", value: "5" },
  { label: "6s", value: "6" },
  { label: "7s", value: "7" },
  { label: "8s", value: "8" },
  { label: "9s", value: "9" },
  { label: "10s", value: "10" },
];

const DURATION_OPTIONS_5_10: SelectOption[] = [
  { label: "5s", value: "5" },
  { label: "10s", value: "10" },
];

const DURATION_OPTIONS_5_10_15: SelectOption[] = [
  { label: "5s", value: "5" },
  { label: "10s", value: "10" },
  { label: "15s", value: "15" },
];

const DURATION_OPTIONS_1_6_15: SelectOption[] = [
  { label: "1s", value: "1" },
  { label: "6s", value: "6" },
  { label: "15s", value: "15" },
];

const DURATION_OPTIONS_1_TO_15: SelectOption[] = [
  { label: "1s", value: "1" },
  { label: "2s", value: "2" },
  { label: "3s", value: "3" },
  { label: "4s", value: "4" },
  { label: "5s", value: "5" },
  { label: "6s", value: "6" },
  { label: "7s", value: "7" },
  { label: "8s", value: "8" },
  { label: "9s", value: "9" },
  { label: "10s", value: "10" },
  { label: "11s", value: "11" },
  { label: "12s", value: "12" },
  { label: "13s", value: "13" },
  { label: "14s", value: "14" },
  { label: "15s", value: "15" },
];

const ASPECT_OPTIONS_AUTO_16_9_9_16: SelectOption[] = [
  { label: "Auto", value: "auto" },
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
];

const ASPECT_OPTIONS_AUTO_16_9_9_16_1_1: SelectOption[] = [
  { label: "Auto", value: "auto" },
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
  { label: "1:1", value: "1:1" },
];

const ASPECT_OPTIONS_16_9_9_16_1_1: SelectOption[] = [
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
  { label: "1:1", value: "1:1" },
];

const ASPECT_OPTIONS_16_9_9_16_1_1_4_3_3_4: SelectOption[] = [
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
  { label: "1:1", value: "1:1" },
  { label: "4:3", value: "4:3" },
  { label: "3:4", value: "3:4" },
];

const ASPECT_OPTIONS_SEEDANCE: SelectOption[] = [
  { label: "21:9", value: "21:9" },
  { label: "16:9", value: "16:9" },
  { label: "4:3", value: "4:3" },
  { label: "1:1", value: "1:1" },
  { label: "3:4", value: "3:4" },
  { label: "9:16", value: "9:16" },
];

const ASPECT_OPTIONS_SEEDANCE_LITE: SelectOption[] = [
  { label: "21:9", value: "21:9" },
  { label: "16:9", value: "16:9" },
  { label: "4:3", value: "4:3" },
  { label: "1:1", value: "1:1" },
  { label: "3:4", value: "3:4" },
  { label: "9:16", value: "9:16" },
  { label: "9:21", value: "9:21" },
];

const ASPECT_OPTIONS_GROK_T2V: SelectOption[] = [
  { label: "16:9", value: "16:9" },
  { label: "4:3", value: "4:3" },
  { label: "3:2", value: "3:2" },
  { label: "1:1", value: "1:1" },
  { label: "2:3", value: "2:3" },
  { label: "3:4", value: "3:4" },
  { label: "9:16", value: "9:16" },
];

const ASPECT_OPTIONS_GROK_I2V: SelectOption[] = [
  { label: "Auto", value: "auto" },
  ...ASPECT_OPTIONS_GROK_T2V,
];

const RESOLUTION_OPTIONS_480_720_1080: SelectOption[] = [
  { label: "480p", value: "480p" },
  { label: "720p", value: "720p" },
  { label: "1080p", value: "1080p" },
];

const RESOLUTION_OPTIONS_720_1080: SelectOption[] = [
  { label: "720p", value: "720p" },
  { label: "1080p", value: "1080p" },
];

const RESOLUTION_OPTIONS_480_580_720: SelectOption[] = [
  { label: "480p", value: "480p" },
  { label: "580p", value: "580p" },
  { label: "720p", value: "720p" },
];

const RESOLUTION_OPTIONS_480_720: SelectOption[] = [
  { label: "480p", value: "480p" },
  { label: "720p", value: "720p" },
];

const QUALITY_OPTIONS_720_1080_4K: SelectOption[] = [
  { label: "720p", value: "720p" },
  { label: "1080p", value: "1080p" },
  { label: "4K", value: "4k" },
];

const START_END_FRAME_SLOTS: UploadSlot[] = [
  { id: "start-frame", label: "Start frame", optional: true, inputKind: "image" },
  { id: "end-frame", label: "End frame", optional: true, inputKind: "image" },
];

const WAN_IMAGE_TO_VIDEO_FRAME_SLOTS: UploadSlot[] = [
  {
    id: "reference",
    label: "First frame",
    helperText: "Required · PNG or JPG",
    inputKind: "image",
  },
  {
    id: "end-frame",
    label: "End frame",
    optional: true,
    helperText: "Optional · PNG or JPG",
    inputKind: "image",
  },
];

const KLING_START_END_FRAME_SLOTS: UploadSlot[] = [
  {
    id: "start-frame",
    label: "Start frame",
    helperText: "Required · PNG or JPG",
    inputKind: "image",
  },
  {
    id: "end-frame",
    label: "End frame",
    optional: true,
    helperText: "Optional · PNG or JPG",
    inputKind: "image",
  },
];

const SOURCE_VIDEO_SLOT: UploadSlot[] = [
  {
    id: "source-video",
    label: "Source video",
    helperText: "Required · MP4, MOV, or WEBM",
    inputKind: "video",
  },
];

const GROK_EDIT_SOURCE_VIDEO_SLOT: UploadSlot[] = [
  {
    id: "source-video",
    label: "Source video",
    helperText: "Required · Up to ~8s · MP4, MOV, or WEBM",
    inputKind: "video",
  },
];

const KLING_EDIT_SOURCE_VIDEO_SLOT: UploadSlot[] = [
  {
    id: "source-video",
    label: "Source video",
    helperText: "Required · 3s-10s · MP4 or MOV",
    inputKind: "video",
  },
];

const MOTION_CONTROL_FRAME_SLOTS: UploadSlot[] = [
  {
    id: "source-video",
    label: "Add motion to copy",
    helperText: "Required · Video duration: 3s-30s",
    inputKind: "video",
  },
  {
    id: "character-image",
    label: "Add your character",
    helperText: "Required · Image with visible face and body",
    inputKind: "image",
  },
];

const AUDIO_TOGGLE_VARIANT_IDS = new Set<string>([
  "veo-3",
  "veo-3-fast",
  "veo-3-1",
  "veo-3-1-fast",
  "veo-3-1-fast-first-last-frame",
  "veo-3-1-reference-to-video",
  "veo-3-1-fast-image-to-video",
  "veo-3-1-fast-extend-video",
  "kling-2-6-pro-text-to-video",
  "kling-2-6-pro-image-to-video",
  "seedance-1-5-pro-text-to-video",
  "kling-o3-pro-video-edit",
  "kling-o3-standard-video-edit",
  "kling-2-6-pro-motion-control",
]);

const VIDEO_MODELS: VideoModelConfig[] = [
  {
    id: "sora-2",
    name: "OpenAI Sora 2",
    summary: "State-of-the-art cinematic video generation",
    previewTitle: "NARRATIVE MOTION",
    previewSubtitle: "OpenAI Sora 2",
    variants: [
      {
        id: "sora-2-text-to-video",
        name: "Sora 2 · Text to Video",
        description: "Generate dynamic clips with audio from text prompts.",
        caps: ["720p", "4s-12s", "Audio"],
        durationOptions: DURATION_OPTIONS_4_8_12,
        aspectOptions: ASPECT_OPTIONS_T2V,
        resolutionOptions: [{ label: "720p", value: "720p" }],
        frameSlots: [],
        implemented: true,
        showAudioToggle: true,
      },
      {
        id: "sora-2-image-to-video",
        name: "Sora 2 · Image to Video",
        description: "Animate a still image into a dynamic video with audio.",
        caps: ["Auto/720p", "4s-12s", "Image first frame"],
        durationOptions: DURATION_OPTIONS_4_8_12,
        aspectOptions: ASPECT_OPTIONS_I2V,
        resolutionOptions: [
          { label: "Auto", value: "auto" },
          { label: "720p", value: "720p" },
        ],
        frameSlots: [
          {
            id: "reference",
            label: "First frame",
            helperText: "Required · PNG or JPG",
          },
        ],
        implemented: true,
        showAudioToggle: true,
      },
      {
        id: "sora-2-pro-text-to-video",
        name: "Sora 2 Pro · Text to Video",
        description: "Higher resolution text-to-video for premium quality clips.",
        caps: ["720p-1080p", "4s-12s", "Audio"],
        durationOptions: DURATION_OPTIONS_4_8_12,
        aspectOptions: ASPECT_OPTIONS_T2V,
        resolutionOptions: [
          { label: "720p", value: "720p" },
          { label: "1080p", value: "1080p" },
        ],
        frameSlots: [],
        implemented: true,
        showAudioToggle: true,
      },
      {
        id: "sora-2-pro-image-to-video",
        name: "Sora 2 Pro · Image to Video",
        description: "Higher quality image-to-video with optional auto sizing.",
        caps: ["Auto/720p/1080p", "4s-12s", "Image first frame"],
        durationOptions: DURATION_OPTIONS_4_8_12,
        aspectOptions: ASPECT_OPTIONS_I2V,
        resolutionOptions: [
          { label: "Auto", value: "auto" },
          { label: "720p", value: "720p" },
          { label: "1080p", value: "1080p" },
        ],
        frameSlots: [
          {
            id: "reference",
            label: "First frame",
            helperText: "Required · PNG or JPG",
          },
        ],
        implemented: true,
        showAudioToggle: true,
      },
    ],
  },
  {
    id: "google-veo",
    name: "Google Veo",
    summary: "Precision video with sound control",
    previewTitle: "DIRECTOR CONTROL",
    previewSubtitle: "Google Veo 3.1",
    variants: [
      {
        id: "veo-3-1-fast",
        name: "Google Veo 3.1 Fast",
        description: "Faster generation with slightly lower quality.",
        caps: ["720p-1080p", "Audio", "8s"],
        durationOptions: DURATION_OPTIONS_4_6_8,
        aspectOptions: ASPECT_OPTIONS_T2V,
        resolutionOptions: [
          { label: "720p", value: "720p" },
          { label: "1080p", value: "1080p" },
          { label: "4K", value: "4k" },
        ],
        qualityOptions: QUALITY_OPTIONS_720_1080_4K,
        frameSlots: [],
        implemented: true,
        showAudioToggle: true,
      },
      {
        id: "veo-3-1",
        name: "Google Veo 3.1",
        description: "High-quality cinematic video generation.",
        caps: ["720p-1080p", "Audio", "8s"],
        durationOptions: DURATION_OPTIONS_4_6_8,
        aspectOptions: ASPECT_OPTIONS_T2V,
        resolutionOptions: [
          { label: "720p", value: "720p" },
          { label: "1080p", value: "1080p" },
          { label: "4K", value: "4k" },
        ],
        qualityOptions: QUALITY_OPTIONS_720_1080_4K,
        frameSlots: [],
        implemented: true,
        showAudioToggle: true,
      },
      {
        id: "veo-3-fast",
        name: "Google Veo 3 Fast",
        description: "Faster generation with slightly lower quality.",
        caps: ["720p", "Audio", "8s"],
        durationOptions: DURATION_OPTIONS_4_6_8,
        aspectOptions: ASPECT_OPTIONS_T2V,
        resolutionOptions: [{ label: "720p", value: "720p" }],
        frameSlots: [],
        implemented: true,
        showAudioToggle: true,
      },
      {
        id: "veo-3",
        name: "Google Veo 3",
        description: "High-quality cinematic video generation.",
        caps: ["720p", "Audio", "8s"],
        durationOptions: DURATION_OPTIONS_4_6_8,
        aspectOptions: ASPECT_OPTIONS_T2V,
        resolutionOptions: RESOLUTION_OPTIONS_720_1080,
        qualityOptions: QUALITY_OPTIONS_720_1080_4K,
        frameSlots: [],
        implemented: true,
        showAudioToggle: true,
      },
      {
        id: "veo-3-1-fast-image-to-video",
        name: "Veo 3.1 Fast Image to Video",
        description: "Animate one input image with Veo 3.1 Fast.",
        caps: ["Auto/16:9/9:16", "4s-8s", "Audio"],
        durationOptions: DURATION_OPTIONS_4_6_8,
        aspectOptions: ASPECT_OPTIONS_AUTO_16_9_9_16,
        resolutionOptions: [
          { label: "720p", value: "720p" },
          { label: "1080p", value: "1080p" },
          { label: "4K", value: "4k" },
        ],
        qualityOptions: QUALITY_OPTIONS_720_1080_4K,
        frameSlots: [
          {
            id: "reference",
            label: "Reference image",
            helperText: "Required · PNG, JPG or WEBP",
            inputKind: "image",
          },
        ],
        implemented: true,
        showAudioToggle: true,
      },
      {
        id: "veo-3-1-reference-to-video",
        name: "Veo 3.1 Reference to Video",
        description: "Generate from multiple reference images.",
        caps: ["16:9/9:16", "8s", "Up to 3 refs"],
        durationOptions: [{ label: "8s", value: "8" }],
        aspectOptions: ASPECT_OPTIONS_T2V,
        resolutionOptions: [
          { label: "720p", value: "720p" },
          { label: "1080p", value: "1080p" },
          { label: "4K", value: "4k" },
        ],
        qualityOptions: QUALITY_OPTIONS_720_1080_4K,
        frameSlots: [],
        implemented: true,
        supportsIngredientsMode: true,
        ingredientsLimit: 3,
        defaultInputMode: "ingredients",
        showAudioToggle: true,
      },
      {
        id: "veo-3-1-fast-first-last-frame",
        name: "Veo 3.1 Fast First/Last Frame",
        description: "Generate from explicit first and last frames.",
        caps: ["Auto/16:9/9:16", "4s-8s", "Audio"],
        durationOptions: DURATION_OPTIONS_4_6_8,
        aspectOptions: ASPECT_OPTIONS_AUTO_16_9_9_16,
        resolutionOptions: [
          { label: "720p", value: "720p" },
          { label: "1080p", value: "1080p" },
          { label: "4K", value: "4k" },
        ],
        qualityOptions: QUALITY_OPTIONS_720_1080_4K,
        frameSlots: [
          {
            id: "start-frame",
            label: "First frame",
            helperText: "Required · PNG, JPG or WEBP",
            inputKind: "image",
          },
          {
            id: "end-frame",
            label: "Last frame",
            helperText: "Required · PNG, JPG or WEBP",
            inputKind: "image",
          },
        ],
        implemented: true,
        showAudioToggle: true,
      },
      {
        id: "veo-3-1-fast-extend-video",
        name: "Veo 3.1 Fast Extend Video",
        description: "Extend an existing Veo clip up to 30s.",
        caps: ["Auto/16:9/9:16", "7s", "Audio"],
        durationOptions: [{ label: "7s", value: "7" }],
        aspectOptions: ASPECT_OPTIONS_AUTO_16_9_9_16,
        resolutionOptions: [{ label: "720p", value: "720p" }],
        frameSlots: GROK_EDIT_SOURCE_VIDEO_SLOT,
        implemented: true,
        showAudioToggle: true,
      },
    ],
  },
  {
    id: "wan",
    name: "Wan",
    summary: "Camera-controlled video with sound",
    previewTitle: "CAMERA CHOREOGRAPHY",
    previewSubtitle: "Wan 2.6",
    variants: [
      {
        id: "wan-2-6-text-to-video",
        name: "Wan 2.6 Text to Video",
        description: "High-fidelity text-to-video with longer durations.",
        caps: ["720p-1080p", "5s-15s", "Multi-shot"],
        durationOptions: DURATION_OPTIONS_5_10_15,
        aspectOptions: ASPECT_OPTIONS_16_9_9_16_1_1_4_3_3_4,
        resolutionOptions: RESOLUTION_OPTIONS_720_1080,
        frameSlots: [],
        implemented: true,
      },
      {
        id: "wan-2-6-image-to-video",
        name: "Wan 2.6 Image to Video",
        description: "Animate a single image with Wan 2.6 motion quality.",
        caps: ["720p-1080p", "5s-15s", "Image-guided"],
        durationOptions: DURATION_OPTIONS_5_10_15,
        aspectOptions: ASPECT_OPTIONS_16_9_9_16_1_1_4_3_3_4,
        resolutionOptions: RESOLUTION_OPTIONS_720_1080,
        frameSlots: [
          {
            id: "reference",
            label: "First frame",
            helperText: "Required · PNG or JPG",
            inputKind: "image",
          },
        ],
        implemented: true,
      },
      {
        id: "wan-2-6-reference-to-video",
        name: "Wan 2.6 Reference to Video",
        description: "Generate from up to 3 reference videos for consistency.",
        caps: ["720p-1080p", "5s-10s", "1-3 reference videos"],
        durationOptions: DURATION_OPTIONS_5_10,
        aspectOptions: ASPECT_OPTIONS_16_9_9_16_1_1_4_3_3_4,
        resolutionOptions: RESOLUTION_OPTIONS_720_1080,
        frameSlots: [],
        implemented: true,
        supportsIngredientsMode: true,
        ingredientsLimit: 3,
        ingredientInputKind: "video",
        defaultInputMode: "ingredients",
      },
      {
        id: "wan-2-5-text-to-video",
        name: "Wan 2.5 Text to Video",
        description: "Wan 2.5 text model for cinematic prompt following.",
        caps: ["480p-1080p", "5s-10s"],
        durationOptions: DURATION_OPTIONS_5_10,
        aspectOptions: ASPECT_OPTIONS_16_9_9_16_1_1,
        resolutionOptions: RESOLUTION_OPTIONS_480_720_1080,
        frameSlots: [],
        implemented: true,
      },
      {
        id: "wan-2-5-image-to-video",
        name: "Wan 2.5 Image to Video",
        description: "Image-to-video generation with Wan 2.5.",
        caps: ["480p-1080p", "5s-10s", "Image-guided"],
        durationOptions: DURATION_OPTIONS_5_10,
        aspectOptions: ASPECT_OPTIONS_T2V,
        resolutionOptions: RESOLUTION_OPTIONS_480_720_1080,
        frameSlots: [
          {
            id: "reference",
            label: "First frame",
            helperText: "Required · PNG or JPG",
            inputKind: "image",
          },
        ],
        implemented: true,
      },
      {
        id: "wan-2-2-a14b-text-to-video-lora",
        name: "Wan 2.2 A14B Text to Video",
        description: "High-quality Wan 2.2 text generation with LoRA support.",
        caps: ["480p-720p", "5s-10s", "Regular acceleration"],
        durationOptions: DURATION_OPTIONS_5_8_10,
        aspectOptions: ASPECT_OPTIONS_16_9_9_16_1_1,
        resolutionOptions: RESOLUTION_OPTIONS_480_580_720,
        frameSlots: [],
        implemented: true,
      },
      {
        id: "wan-2-2-a14b-image-to-video-lora",
        name: "Wan 2.2 A14B Image to Video",
        description: "Image-guided Wan 2.2 generation with optional end frame.",
        caps: ["480p-720p", "5s-10s", "Optional end frame"],
        durationOptions: DURATION_OPTIONS_5_8_10,
        aspectOptions: ASPECT_OPTIONS_AUTO_16_9_9_16_1_1,
        resolutionOptions: RESOLUTION_OPTIONS_480_580_720,
        frameSlots: WAN_IMAGE_TO_VIDEO_FRAME_SLOTS,
        implemented: true,
      },
      {
        id: "wan-2-2-5b-fast-wan",
        name: "Wan 2.2 5B FastWan",
        description: "Lower-latency Wan 2.2 model optimized for 5-second clips.",
        caps: ["480p-720p", "5s", "Fast"],
        durationOptions: [{ label: "5s", value: "5" }],
        aspectOptions: ASPECT_OPTIONS_16_9_9_16_1_1,
        resolutionOptions: RESOLUTION_OPTIONS_480_580_720,
        frameSlots: [],
        implemented: true,
      },
    ],
  },
  {
    id: "kling",
    name: "Kling",
    summary: "Perfect motion with advanced control",
    previewTitle: "KINETIC CINEMA",
    previewSubtitle: "Kling 2.6",
    variants: [
      {
        id: "kling-2-6-pro-text-to-video",
        name: "Kling 2.6 Pro Text to Video",
        description: "Cinematic text-to-video with native audio generation.",
        caps: ["5s-10s", "16:9/9:16/1:1", "Audio"],
        durationOptions: DURATION_OPTIONS_5_10,
        aspectOptions: ASPECT_OPTIONS_16_9_9_16_1_1,
        resolutionOptions: [{ label: "Auto", value: "auto" }],
        frameSlots: [],
        implemented: true,
        showAudioToggle: true,
      },
      {
        id: "kling-2-6-pro-image-to-video",
        name: "Kling 2.6 Pro Image to Video",
        description: "Animate a start image with optional end frame and audio.",
        caps: ["5s-10s", "Start/end frame", "Audio"],
        durationOptions: DURATION_OPTIONS_5_10,
        aspectOptions: ASPECT_OPTIONS_16_9_9_16_1_1,
        resolutionOptions: [{ label: "Auto", value: "auto" }],
        frameSlots: KLING_START_END_FRAME_SLOTS,
        implemented: true,
        showAudioToggle: true,
      },
      {
        id: "kling-2-5-turbo-pro-text-to-video",
        name: "Kling 2.5 Turbo Pro",
        description: "Top-tier Kling text-to-video prompt precision.",
        caps: ["5s-10s", "16:9/9:16/1:1"],
        durationOptions: DURATION_OPTIONS_5_10,
        aspectOptions: ASPECT_OPTIONS_16_9_9_16_1_1,
        resolutionOptions: [{ label: "Auto", value: "auto" }],
        frameSlots: [],
        implemented: true,
        showAudioToggle: false,
      },
      {
        id: "kling-2-1-master-text-to-video",
        name: "Kling 2.1 Master",
        description: "Premium Kling 2.1 text-to-video generation.",
        caps: ["5s-10s", "16:9/9:16/1:1"],
        durationOptions: DURATION_OPTIONS_5_10,
        aspectOptions: ASPECT_OPTIONS_16_9_9_16_1_1,
        resolutionOptions: [{ label: "Auto", value: "auto" }],
        frameSlots: [],
        implemented: true,
        showAudioToggle: false,
      },
      {
        id: "kling-o1-first-last-frame-to-video",
        name: "Kling O1 First/Last Frame",
        description: "Transition from start frame to end frame with text guidance.",
        caps: ["3s-10s", "Start/end frame"],
        durationOptions: DURATION_OPTIONS_3_TO_10,
        aspectOptions: ASPECT_OPTIONS_16_9_9_16_1_1,
        resolutionOptions: [{ label: "Auto", value: "auto" }],
        frameSlots: KLING_START_END_FRAME_SLOTS,
        implemented: true,
        showAudioToggle: false,
      },
      {
        id: "kling-o1-reference-to-video",
        name: "Kling O1 Reference to Video",
        description: "Reference-aware generation from images/elements prompts.",
        caps: ["3s-10s", "Image references", "16:9/9:16/1:1"],
        durationOptions: DURATION_OPTIONS_3_TO_10,
        aspectOptions: ASPECT_OPTIONS_16_9_9_16_1_1,
        resolutionOptions: [{ label: "Auto", value: "auto" }],
        frameSlots: [
          {
            id: "reference",
            label: "Primary reference",
            optional: true,
            helperText: "PNG, JPG or WEBP",
            inputKind: "image",
          },
        ],
        implemented: true,
        supportsIngredientsMode: true,
        ingredientsLimit: 7,
        showAudioToggle: false,
      },
    ],
  },
  {
    id: "minimax-hailuo",
    name: "Minimax Hailuo",
    summary: "VFX-ready and cost-efficient generation",
    previewTitle: "DYNAMIC VFX",
    previewSubtitle: "Minimax Hailuo 2.3",
    variants: [
      {
        id: "minimax-hailuo-02-standard-text-to-video",
        name: "Hailuo 02 Standard",
        description: "MiniMax Hailuo 02 standard text-to-video.",
        caps: ["Text to video", "6s/10s"],
        durationOptions: DURATION_OPTIONS_6_10,
        aspectOptions: [{ label: "Auto", value: "auto" }],
        resolutionOptions: [{ label: "Auto", value: "auto" }],
        frameSlots: [],
        implemented: true,
      },
      {
        id: "minimax-hailuo-02-pro-text-to-video",
        name: "Hailuo 02 Pro",
        description: "MiniMax Hailuo 02 pro text-to-video at 1080p tier.",
        caps: ["Text to video", "1080p tier"],
        durationOptions: [{ label: "Default", value: "6" }],
        aspectOptions: [{ label: "Auto", value: "auto" }],
        resolutionOptions: [{ label: "Auto", value: "auto" }],
        frameSlots: [],
        implemented: true,
      },
      {
        id: "minimax-hailuo-2-3-standard-text-to-video",
        name: "Hailuo 2.3 Standard",
        description: "MiniMax Hailuo 2.3 standard text-to-video.",
        caps: ["Text to video", "6s/10s"],
        durationOptions: DURATION_OPTIONS_6_10,
        aspectOptions: [{ label: "Auto", value: "auto" }],
        resolutionOptions: [{ label: "Auto", value: "auto" }],
        frameSlots: [],
        implemented: true,
      },
      {
        id: "minimax-hailuo-2-3-pro-text-to-video",
        name: "Hailuo 2.3 Pro",
        description: "MiniMax Hailuo 2.3 pro text-to-video at 1080p tier.",
        caps: ["Text to video", "1080p tier"],
        durationOptions: [{ label: "Default", value: "6" }],
        aspectOptions: [{ label: "Auto", value: "auto" }],
        resolutionOptions: [{ label: "Auto", value: "auto" }],
        frameSlots: [],
        implemented: true,
      },
      {
        id: "minimax-hailuo-2-3-fast-pro-image-to-video",
        name: "Hailuo 2.3 Fast Pro I2V",
        description: "Fast image-to-video generation with Hailuo 2.3.",
        caps: ["Image to video", "1080p tier"],
        durationOptions: [{ label: "Default", value: "6" }],
        aspectOptions: [{ label: "Auto", value: "auto" }],
        resolutionOptions: [{ label: "Auto", value: "auto" }],
        frameSlots: [
          {
            id: "reference",
            label: "Input image",
            helperText: "Required · PNG, JPG or WEBP",
            inputKind: "image",
          },
        ],
        implemented: true,
      },
    ],
  },
  {
    id: "seedance",
    name: "Seedance",
    summary: "Cinematic, multi-shot video creation",
    previewTitle: "CINEMATIC CUTS",
    previewSubtitle: "Seedance 1.5 Pro",
    variants: [
      {
        id: "seedance-1-5-pro-text-to-video",
        name: "Seedance 1.5 Pro",
        description: "Bytedance Seedance 1.5 Pro text-to-video.",
        caps: ["480p-1080p", "4s-12s", "Audio toggle"],
        durationOptions: DURATION_OPTIONS_4_TO_12,
        aspectOptions: ASPECT_OPTIONS_SEEDANCE,
        resolutionOptions: RESOLUTION_OPTIONS_480_720_1080,
        frameSlots: [],
        implemented: true,
        showAudioToggle: true,
      },
      {
        id: "seedance-v1-pro-fast-text-to-video",
        name: "Seedance 1.0 Pro Fast",
        description: "Lower-cost fast Seedance text-to-video.",
        caps: ["480p-1080p", "2s-12s", "Fast"],
        durationOptions: DURATION_OPTIONS_2_TO_12,
        aspectOptions: ASPECT_OPTIONS_SEEDANCE,
        resolutionOptions: RESOLUTION_OPTIONS_480_720_1080,
        frameSlots: [],
        implemented: true,
      },
      {
        id: "seedance-v1-lite-text-to-video",
        name: "Seedance 1.0 Lite",
        description: "Lightweight Seedance text-to-video endpoint.",
        caps: ["480p-1080p", "2s-12s", "Lite"],
        durationOptions: DURATION_OPTIONS_2_TO_12,
        aspectOptions: ASPECT_OPTIONS_SEEDANCE_LITE,
        resolutionOptions: RESOLUTION_OPTIONS_480_720_1080,
        frameSlots: [],
        implemented: true,
      },
    ],
  },
  {
    id: "grok-imagine",
    name: "Grok Imagine",
    summary: "Perfect motion with advanced control",
    previewTitle: "STYLE LOCK",
    previewSubtitle: "Grok Imagine",
    variants: [
      {
        id: "grok-imagine-video-text-to-video",
        name: "Grok Imagine Video",
        description: "Generate video from text with Grok Imagine Video.",
        caps: ["480p/720p", "1s-15s", "Text to video"],
        durationOptions: DURATION_OPTIONS_1_TO_15,
        aspectOptions: ASPECT_OPTIONS_GROK_T2V,
        resolutionOptions: RESOLUTION_OPTIONS_480_720,
        frameSlots: [],
        implemented: true,
      },
      {
        id: "grok-imagine-video-image-to-video",
        name: "Grok Imagine Image to Video",
        description: "Generate video from an input image and text prompt.",
        caps: ["480p/720p", "1s-15s", "Image to video"],
        durationOptions: DURATION_OPTIONS_1_TO_15,
        aspectOptions: ASPECT_OPTIONS_GROK_I2V,
        resolutionOptions: RESOLUTION_OPTIONS_480_720,
        frameSlots: [
          {
            id: "reference",
            label: "Input image",
            helperText: "Required · PNG, JPG or WEBP",
            inputKind: "image",
          },
        ],
        implemented: true,
      },
    ],
  },
  {
    id: "grok-edit",
    name: "Grok Edit",
    summary: "Transform existing clips with prompt-driven edits",
    previewTitle: "VIDEO EDIT",
    previewSubtitle: "Grok Imagine Edit",
    mode: "edit",
    variants: [
      {
        id: "grok-imagine-video-edit-video",
        name: "Grok Imagine Edit",
        description: "Edit a reference video using text instructions.",
        caps: ["Video edit", "Auto/480p/720p", "Up to ~8s source"],
        durationOptions: [{ label: "Auto", value: "6" }],
        aspectOptions: [{ label: "Auto", value: "auto" }],
        resolutionOptions: [
          { label: "Auto", value: "auto" },
          { label: "480p", value: "480p" },
          { label: "720p", value: "720p" },
        ],
        frameSlots: GROK_EDIT_SOURCE_VIDEO_SLOT,
        implemented: true,
        showDurationControl: false,
        showAspectControl: false,
        showResolutionControl: true,
      },
    ],
  },
  {
    id: "kling-o3-edit",
    name: "Kling O3 Edit",
    summary: "High-end reference video editing with optional style inputs",
    previewTitle: "VIDEO EDIT",
    previewSubtitle: "Kling O3",
    mode: "edit",
    variants: [
      {
        id: "kling-o3-pro-video-edit",
        name: "Kling O3 Edit Pro",
        description: "Premium Kling O3 video editing with optional image references.",
        caps: ["Video edit", "Pro", "Keep source audio"],
        durationOptions: [{ label: "Auto", value: "6" }],
        aspectOptions: [{ label: "Auto", value: "auto" }],
        resolutionOptions: [{ label: "Auto", value: "auto" }],
        frameSlots: KLING_EDIT_SOURCE_VIDEO_SLOT,
        implemented: true,
        supportsIngredientsMode: true,
        allowIngredientsAlongsideFrames: true,
        ingredientsLimit: 4,
        ingredientInputKind: "image",
        showAudioToggle: true,
        audioToggleLabel: "Keep Source Audio",
        audioToggleDescription: "Preserve original audio from the uploaded source video.",
        showDurationControl: false,
        showAspectControl: false,
        showResolutionControl: false,
      },
      {
        id: "kling-o3-standard-video-edit",
        name: "Kling O3 Edit Standard",
        description: "Standard Kling O3 video editing with optional image references.",
        caps: ["Video edit", "Standard", "Keep source audio"],
        durationOptions: [{ label: "Auto", value: "6" }],
        aspectOptions: [{ label: "Auto", value: "auto" }],
        resolutionOptions: [{ label: "Auto", value: "auto" }],
        frameSlots: SOURCE_VIDEO_SLOT,
        implemented: true,
        supportsIngredientsMode: true,
        allowIngredientsAlongsideFrames: true,
        ingredientsLimit: 4,
        ingredientInputKind: "image",
        showAudioToggle: true,
        audioToggleLabel: "Keep Source Audio",
        audioToggleDescription: "Preserve original audio from the uploaded source video.",
        showDurationControl: false,
        showAspectControl: false,
        showResolutionControl: false,
      },
    ],
  },
  {
    id: "kling-motion-control",
    name: "Kling Motion Control",
    summary: "Transfer motion from video onto your character image",
    previewTitle: "MOTION CONTROL",
    previewSubtitle: "Kling 2.6 Motion Control",
    mode: "motion",
    variants: [
      {
        id: "kling-2-6-pro-motion-control",
        name: "Kling 2.6 Motion Control Pro",
        description: "Control motion with a video reference plus a character image.",
        caps: ["Pro", "Image + video required", "Keep original sound"],
        durationOptions: [{ label: "Auto", value: "6" }],
        aspectOptions: [{ label: "Auto", value: "auto" }],
        resolutionOptions: [{ label: "Auto", value: "auto" }],
        frameSlots: MOTION_CONTROL_FRAME_SLOTS,
        implemented: true,
        showDurationControl: false,
        showAspectControl: false,
        showResolutionControl: false,
        showAudioToggle: true,
        audioToggleLabel: "Keep Original Sound",
        audioToggleDescription:
          "Preserve original sound from the motion reference video.",
        showAdvancedSettingsToggle: true,
        showSceneControlToggle: true,
        defaultSceneControlEnabled: true,
        showCharacterOrientationControl: true,
        defaultCharacterOrientation: "video",
      },
    ],
  },
];

const DEFAULT_VARIANT_SELECTION: Record<string, string> = VIDEO_MODELS.reduce<
  Record<string, string>
>((accumulator, model) => {
  const firstVariant = model.variants[0]?.id;
  if (firstVariant) {
    accumulator[model.id] = firstVariant;
  }
  return accumulator;
}, {});

const selectMediaFile = (
  files: FileList | null,
  inputKind: "image" | "video"
): File | null => {
  if (!files || files.length === 0) {
    return null;
  }
  const first = Array.from(files).find((file) =>
    inputKind === "video"
      ? file.type.toLowerCase().startsWith("video/")
      : file.type.toLowerCase().startsWith("image/")
  );
  return first ?? null;
};

const InfoChip = ({ label }: { label: string }) => {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-[var(--satura-white-10)] px-1.5 py-0.5 text-[10px] text-[var(--satura-font-secondary)]">
      <span className="h-3 w-3 rounded-[3px] border border-[var(--satura-white-24)] bg-[var(--satura-white-5)]" />
      <span>{label}</span>
    </span>
  );
};

const SelectField = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (next: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(() => {
    return options.find((option) => option.value === value) ?? options[0];
  }, [options, value]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  if (!selected) {
    return null;
  }

  return (
    <div
      ref={rootRef}
      className={`relative grid gap-1 rounded-xl border border-[var(--satura-divider-secondary)] bg-[var(--satura-surface-subtle)] px-2.5 py-2 text-left ${
        isOpen ? "z-50" : "z-10"
      }`}
    >
      <span className="px-0.5 text-[11px] font-medium text-[var(--satura-font-secondary)]">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex items-center justify-between rounded-lg border border-[var(--satura-divider-secondary)] bg-[var(--satura-surface-tertiary)] px-2.5 py-2 text-[13px] font-semibold text-[var(--satura-font-primary)] transition hover:border-[var(--satura-brand-primary-20)]"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{selected.label}</span>
        <ChevronDown
          className={`h-4 w-4 text-[var(--satura-font-secondary)] transition ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[60] rounded-xl border border-[var(--satura-divider-secondary)] bg-[var(--satura-surface-secondary)] p-1 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]">
          <div role="listbox" aria-label={label} className="space-y-1">
            {options.map((option) => {
              const isSelected = option.value === selected.value;
              return (
                <button
                  key={`${label}-${option.value}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[12px] transition ${
                    isSelected
                      ? "bg-[var(--satura-white-10)] text-[var(--satura-font-primary)]"
                      : "text-[var(--satura-font-secondary)] hover:bg-[var(--satura-white-5)] hover:text-[var(--satura-font-primary)]"
                  }`}
                >
                  <span>{option.label}</span>
                  <Check
                    className={`h-3.5 w-3.5 ${
                      isSelected ? "text-[var(--satura-font-brand)]" : "opacity-0"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const UploadFrameCard = ({
  slot,
  value,
  busy,
  onUpload,
  onClear,
}: {
  slot: UploadSlot;
  value: AiVideoUploadedImage | null;
  busy: boolean;
  onUpload: (file: File) => Promise<void>;
  onClear: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputKind = slot.inputKind ?? "image";
  const acceptValue =
    inputKind === "video"
      ? "video/mp4,video/quicktime,video/webm,video/*"
      : "image/png,image/jpeg,image/webp,image/*";

  const handleFile = useCallback(
    async (file: File | null) => {
      if (!file) {
        return;
      }
      await onUpload(file);
    },
    [onUpload]
  );

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (busy) {
      return;
    }
    const file = selectMediaFile(event.dataTransfer.files, inputKind);
    void handleFile(file);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!busy) {
      setIsDragging(true);
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (busy) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div
      role="button"
      tabIndex={busy ? -1 : 0}
      aria-disabled={busy}
      onKeyDown={handleKeyDown}
      onClick={() => {
        if (!busy) {
          inputRef.current?.click();
        }
      }}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`group relative grid h-full min-h-[116px] place-items-center rounded-xl border border-dashed px-3 py-4 text-center transition ${
        isDragging
          ? "border-[var(--satura-brand-primary-40)] bg-[var(--satura-white-5)]"
          : "border-[var(--satura-divider-primary)] bg-[var(--satura-surface-secondary)] hover:border-[var(--satura-brand-primary-30)] hover:bg-[var(--satura-surface-tertiary)]"
      } ${busy ? "cursor-default" : "cursor-pointer"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptValue}
        className="hidden"
        onChange={(event) => {
          const file = selectMediaFile(event.target.files, inputKind);
          event.currentTarget.value = "";
          void handleFile(file);
        }}
      />
      {value ? (
        <>
          <div className="absolute inset-0 overflow-hidden rounded-xl">
            {inputKind === "video" ? (
              <video
                src={value.url}
                className="h-full w-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              <img
                src={value.url}
                alt={value.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.68)_100%)]" />
          </div>
          <div className="relative z-10 flex w-full items-end justify-between gap-2 rounded-lg bg-[rgba(0,0,0,0.42)] px-2 py-1.5 text-left">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-white">{slot.label}</p>
              <p className="truncate text-[10px] text-[var(--satura-white-80)]">{value.name}</p>
            </div>
            <button
              type="button"
              className="rounded-md border border-[var(--satura-white-24)] bg-[rgba(0,0,0,0.35)] p-1 text-white transition hover:bg-[rgba(0,0,0,0.5)]"
              onClick={(event) => {
                event.stopPropagation();
                onClear();
              }}
              aria-label={`Clear ${slot.label}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--satura-divider-secondary)] bg-[var(--satura-surface-tertiary)] text-[var(--satura-font-primary)] shadow-[inset_0_-2px_0_rgba(20,1,8,0.24),0_6px_16px_rgba(0,0,0,0.25)]">
            {inputKind === "video" ? (
              <Video className="h-4 w-4" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
          </div>
          <p className="text-[12px] font-medium text-[var(--satura-font-primary)]">{slot.label}</p>
          <p className="text-[11px] text-[var(--satura-font-secondary)]">
            {slot.optional ? "Optional · Drop or click" : slot.helperText ?? "Drop or click"}
          </p>
        </div>
      )}
      {busy ? (
        <span className="absolute right-2 top-2 rounded-full bg-[rgba(0,0,0,0.65)] px-2 py-0.5 text-[10px] font-semibold text-white">
          Uploading
        </span>
      ) : null}
    </div>
  );
};

const IngredientsDropzone = ({
  items,
  limit,
  busy,
  inputKind = "image",
  onUpload,
  onRemove,
}: {
  items: AiVideoUploadedImage[];
  limit: number;
  busy: boolean;
  inputKind?: "image" | "video";
  onUpload: (files: File[]) => Promise<void>;
  onRemove: (index: number) => void;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const acceptValue =
    inputKind === "video"
      ? "video/mp4,video/quicktime,video/webm,video/*"
      : "image/png,image/jpeg,image/webp,image/*";

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) {
        return;
      }
      const matchedFiles = Array.from(files).filter((file) =>
        inputKind === "video"
          ? file.type.toLowerCase().startsWith("video/")
          : file.type.toLowerCase().startsWith("image/")
      );
      if (matchedFiles.length === 0) {
        return;
      }
      await onUpload(matchedFiles);
    },
    [inputKind, onUpload]
  );

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          if (!busy) {
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!busy) {
            setIsDragging(true);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) {
            setIsDragging(true);
          }
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (busy) {
            return;
          }
          void handleFiles(event.dataTransfer.files);
        }}
        className={`grid min-h-[120px] w-full place-items-center rounded-xl border border-dashed px-4 py-5 text-center transition ${
          isDragging
            ? "border-[var(--satura-brand-primary-40)] bg-[var(--satura-white-5)]"
            : "border-[var(--satura-divider-primary)] bg-[var(--satura-surface-secondary)] hover:border-[var(--satura-brand-primary-30)] hover:bg-[var(--satura-surface-tertiary)]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptValue}
          multiple
          className="hidden"
          onChange={(event) => {
            const files = event.target.files;
            event.currentTarget.value = "";
            void handleFiles(files);
          }}
        />
        <div className="space-y-2">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--satura-divider-secondary)] bg-[var(--satura-surface-tertiary)] shadow-[inset_0_-2px_0_rgba(20,1,8,0.24),0_6px_16px_rgba(0,0,0,0.25)]">
            {inputKind === "video" ? (
              <Video className="h-4 w-4 text-[var(--satura-font-primary)]" />
            ) : (
              <ImageIcon className="h-4 w-4 text-[var(--satura-font-primary)]" />
            )}
          </div>
          <p className="text-[12px] font-medium text-[var(--satura-font-primary)]">
            Drop or upload ingredients ({items.length}/{limit})
          </p>
          <p className="text-[11px] text-[var(--satura-font-secondary)]">
            {inputKind === "video" ? "MP4, MOV or WEBM" : "PNG, JPG or WEBP"}
          </p>
        </div>
      </button>
      {items.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {items.map((item, index) => (
            <div
              key={`${item.assetId}-${index}`}
              className="relative overflow-hidden rounded-lg border border-[var(--satura-divider-secondary)]"
            >
              {inputKind === "video" || item.kind === "video" ? (
                <video
                  src={item.url}
                  className="h-20 w-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img
                  src={item.url}
                  alt={item.name}
                  className="h-20 w-full object-cover"
                  loading="lazy"
                />
              )}
              <button
                type="button"
                className="absolute right-1 top-1 rounded-md border border-[var(--satura-white-24)] bg-[rgba(0,0,0,0.5)] p-1 text-white transition hover:bg-[rgba(0,0,0,0.65)]"
                onClick={() => onRemove(index)}
                aria-label={`Remove ingredient ${index + 1}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {busy ? (
        <p className="text-[11px] text-[var(--satura-font-secondary)]">Uploading ingredient...</p>
      ) : null}
    </div>
  );
};

export const AiVideoGeneratorPanel = ({
  promptId,
  prompt,
  promptPlaceholder,
  onPromptChange,
  onEnhancePrompt,
  enhanceBusy = false,
  enhanceError = null,
  aspectRatio,
  onAspectRatioChange,
  duration,
  onDurationChange,
  generateAudio,
  onGenerateAudioChange,
  status,
  error = null,
  canGenerate,
  onGenerate,
  onUploadImage,
  hasGeneratedAsset,
  onClear,
}: AiVideoGeneratorPanelProps) => {
  const [panelTab, setPanelTab] = useState<"create" | "edit" | "motion">("create");
  const [activeModelId, setActiveModelId] = useState<string>(
    VIDEO_MODELS[0]?.id ?? ""
  );
  const [hasLoadedLastModel, setHasLoadedLastModel] = useState(false);
  const [ingredientsMode, setIngredientsMode] = useState<"frames" | "ingredients">(
    "frames"
  );
  const [fixedLensEnabled, setFixedLensEnabled] = useState(false);
  const [multiShotEnabled, setMultiShotEnabled] = useState(false);
  const [selectedVariantByModel, setSelectedVariantByModel] = useState<Record<string, string>>(
    DEFAULT_VARIANT_SELECTION
  );
  const [uiAspectRatio, setUiAspectRatio] = useState(aspectRatio);
  const [uiDuration, setUiDuration] = useState(`${duration}`);
  const [uiResolution, setUiResolution] = useState("720p");
  const [uiQuality, setUiQuality] = useState("1080p");
  const [generatedExampleVideos, setGeneratedExampleVideos] = useState<string[]>([]);
  const [frameUploadsByVariant, setFrameUploadsByVariant] = useState<
    Record<string, Record<string, AiVideoUploadedImage | null>>
  >({});
  const [ingredientUploadsByVariant, setIngredientUploadsByVariant] = useState<
    Record<string, AiVideoUploadedImage[]>
  >({});
  const [uploadBusyByKey, setUploadBusyByKey] = useState<Record<string, boolean>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [advancedSettingsOpenByVariant, setAdvancedSettingsOpenByVariant] = useState<
    Record<string, boolean>
  >({});
  const [sceneControlEnabledByVariant, setSceneControlEnabledByVariant] = useState<
    Record<string, boolean>
  >({});
  const [characterOrientationByVariant, setCharacterOrientationByVariant] = useState<
    Record<string, "image" | "video">
  >({});

  const visibleModels = useMemo(
    () => VIDEO_MODELS.filter((model) => (model.mode ?? "create") === panelTab),
    [panelTab]
  );

  const activeModel = useMemo(
    () => {
      const fallbackModel = visibleModels[0] ?? VIDEO_MODELS[0];
      return visibleModels.find((model) => model.id === activeModelId) ?? fallbackModel;
    },
    [activeModelId, visibleModels]
  );

  const activeVariantId = selectedVariantByModel[activeModel.id];
  const activeVariant =
    activeModel.variants.find((variant) => variant.id === activeVariantId) ??
    activeModel.variants[0];

  const previewTitle = activeModel.previewTitle;
  const previewSubtitle = activeVariant?.name ?? activeModel.previewSubtitle;
  const previewVideoByModelId = useMemo(() => {
    const mapping = new Map<string, string>();
    const usedUrls = new Set<string>();

    Object.entries(MODEL_PREVIEW_VIDEO_OVERRIDES).forEach(([modelId, url]) => {
      if (!url) {
        return;
      }
      mapping.set(modelId, url);
      usedUrls.add(url);
    });

    const availableUrls = generatedExampleVideos.filter(
      (url) => url.length > 0 && !usedUrls.has(url)
    );

    let cursor = 0;
    visibleModels.forEach((model) => {
      if (mapping.has(model.id)) {
        return;
      }
      const nextUrl = availableUrls[cursor];
      if (!nextUrl) {
        return;
      }
      mapping.set(model.id, nextUrl);
      usedUrls.add(nextUrl);
      cursor += 1;
    });

    return mapping;
  }, [generatedExampleVideos, visibleModels]);
  const activeModelPreviewVideo = previewVideoByModelId.get(activeModel.id) ?? "";
  const videosToPreload = useMemo(() => {
    const urls = new Set<string>();
    previewVideoByModelId.forEach((url) => {
      if (url) {
        urls.add(url);
      }
    });
    return Array.from(urls);
  }, [previewVideoByModelId]);

  const durationOptions = activeVariant?.durationOptions ?? DURATION_OPTIONS_4_8_12;
  const aspectOptions = activeVariant?.aspectOptions ?? ASPECT_OPTIONS_T2V;
  const resolutionOptions = activeVariant?.resolutionOptions ?? [{ label: "720p", value: "720p" }];
  const qualityOptions = activeVariant?.qualityOptions ?? [];
  const frameSlots = activeVariant?.frameSlots ?? [];
  const isVariantImplemented = activeVariant?.implemented !== false;
  const supportsIngredientsMode = Boolean(activeVariant?.supportsIngredientsMode);
  const allowIngredientsAlongsideFrames = Boolean(
    activeVariant?.allowIngredientsAlongsideFrames
  );
  const ingredientsLimit = activeVariant?.ingredientsLimit ?? 3;
  const ingredientInputKind = activeVariant?.ingredientInputKind ?? "image";
  const showFixedLensToggle = Boolean(activeVariant?.showFixedLensToggle);
  const showMultiShotToggle = Boolean(activeVariant?.showMultiShotToggle);
  const showAudioToggle = AUDIO_TOGGLE_VARIANT_IDS.has(activeVariant.id);
  const audioToggleLabel = activeVariant?.audioToggleLabel ?? "Audio";
  const audioToggleDescription =
    activeVariant?.audioToggleDescription ??
    "Include generated audio with the rendered clip.";
  const showDurationControl = activeVariant?.showDurationControl ?? true;
  const showAspectControl = activeVariant?.showAspectControl ?? true;
  const showResolutionControl = activeVariant?.showResolutionControl ?? true;
  const showAdvancedSettingsToggle = Boolean(activeVariant?.showAdvancedSettingsToggle);
  const showSceneControlToggle = Boolean(activeVariant?.showSceneControlToggle);
  const showCharacterOrientationControl = Boolean(
    activeVariant?.showCharacterOrientationControl
  );
  const advancedSettingsOpen =
    advancedSettingsOpenByVariant[activeVariant.id] ?? false;
  const sceneControlEnabled =
    sceneControlEnabledByVariant[activeVariant.id] ??
    (activeVariant?.defaultSceneControlEnabled ?? false);
  const characterOrientation =
    characterOrientationByVariant[activeVariant.id] ??
    (activeVariant?.defaultCharacterOrientation ?? "video");
  const promptInputPlaceholder =
    panelTab === "motion"
      ? "Describe the character or scene details. Motion is controlled by your reference video."
      : panelTab === "edit"
      ? allowIngredientsAlongsideFrames
        ? "Describe the visual change (e.g. \"Change the background to tropical island\"). Use @Video1 for source and @Image1..@Image4 for references."
        : "Describe the visual change you want (e.g. \"Make it nighttime\" or \"Colorize the video\")."
      : promptPlaceholder;

  const activeFrameUploads = frameUploadsByVariant[activeVariant.id] ?? {};
  const activeIngredientUploads = ingredientUploadsByVariant[activeVariant.id] ?? [];

  const isUploadingAny = useMemo(
    () => Object.values(uploadBusyByKey).some(Boolean),
    [uploadBusyByKey]
  );

  const missingRequiredSlots = useMemo(() => {
    return frameSlots.filter(
      (slot) => !slot.optional && !activeFrameUploads[slot.id]
    );
  }, [activeFrameUploads, frameSlots]);
  const missingRequiredIngredients =
    supportsIngredientsMode &&
    !allowIngredientsAlongsideFrames &&
    ingredientsMode === "ingredients" &&
    activeIngredientUploads.length === 0;
  const missingRequiredSlotsMessage =
    activeVariant.id === "kling-2-6-pro-motion-control" && missingRequiredSlots.length > 0
      ? "Upload a motion reference video and a character image to generate."
      : `Upload ${missingRequiredSlots.map((slot) => slot.label).join(", ")} to generate.`;

  const isGenerateDisabled =
    !canGenerate ||
    !isVariantImplemented ||
    status === "loading" ||
    isUploadingAny ||
    missingRequiredSlots.length > 0 ||
    missingRequiredIngredients;

  useEffect(() => {
    try {
      const storedModelId = window.localStorage.getItem(LAST_USED_MODEL_STORAGE_KEY);
      if (storedModelId && VIDEO_MODELS.some((model) => model.id === storedModelId)) {
        setActiveModelId(storedModelId);
      }
    } catch {
      // Ignore localStorage read errors.
    } finally {
      setHasLoadedLastModel(true);
    }
  }, []);

  useEffect(() => {
    if (visibleModels.length === 0) {
      return;
    }
    if (!visibleModels.some((model) => model.id === activeModelId)) {
      setActiveModelId(visibleModels[0]!.id);
    }
  }, [activeModelId, visibleModels]);

  useEffect(() => {
    if (!hasLoadedLastModel) {
      return;
    }
    try {
      window.localStorage.setItem(LAST_USED_MODEL_STORAGE_KEY, activeModelId);
    } catch {
      // Ignore localStorage write errors.
    }
  }, [activeModelId, hasLoadedLastModel]);

  useEffect(() => {
    setUiAspectRatio(aspectRatio);
  }, [aspectRatio]);

  useEffect(() => {
    setUiDuration(`${duration}`);
  }, [duration]);

  useEffect(() => {
    const abortController = new AbortController();

    const loadGeneratedExamples = async () => {
      try {
        const response = await fetch(GENERATED_VIDEO_EXAMPLES_API, {
          cache: "force-cache",
          signal: abortController.signal,
        });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as {
          items?: Array<{ publicUrl?: unknown }>;
        };
        const urls = (payload.items ?? [])
          .map((item) => (typeof item.publicUrl === "string" ? item.publicUrl : ""))
          .filter((value) => value.length > 0);
        setGeneratedExampleVideos(urls);
      } catch {
        // Ignore fetch errors and fall back to static placeholders.
      }
    };

    loadGeneratedExamples();
    return () => abortController.abort();
  }, []);

  useEffect(() => {
    if (!durationOptions.some((option) => option.value === uiDuration)) {
      const fallbackDuration = durationOptions[0]?.value;
      if (fallbackDuration) {
        setUiDuration(fallbackDuration);
        const parsed = Number(fallbackDuration);
        if (Number.isFinite(parsed)) {
          onDurationChange(parsed);
        }
      }
    }

    if (!aspectOptions.some((option) => option.value === uiAspectRatio)) {
      const fallbackAspect = aspectOptions[0]?.value;
      if (fallbackAspect) {
        setUiAspectRatio(fallbackAspect);
        onAspectRatioChange(fallbackAspect);
      }
    }

    if (!resolutionOptions.some((option) => option.value === uiResolution)) {
      const fallbackResolution = resolutionOptions[0]?.value;
      if (fallbackResolution) {
        setUiResolution(fallbackResolution);
      }
    }

    if (qualityOptions.length > 0 && !qualityOptions.some((option) => option.value === uiQuality)) {
      setUiQuality(qualityOptions[0]!.value);
    }

    if (supportsIngredientsMode && allowIngredientsAlongsideFrames) {
      setIngredientsMode("frames");
    } else if (supportsIngredientsMode && activeVariant.defaultInputMode) {
      setIngredientsMode(activeVariant.defaultInputMode);
    } else if (!supportsIngredientsMode) {
      setIngredientsMode("frames");
    }

    if (!selectedVariantByModel[activeModel.id]) {
      const firstVariant = activeModel.variants[0]?.id;
      if (!firstVariant) {
        return;
      }
      setSelectedVariantByModel((current) => ({
        ...current,
        [activeModel.id]: firstVariant,
      }));
    }
  }, [
    activeModel.id,
    activeModel.variants,
    aspectOptions,
    durationOptions,
    onAspectRatioChange,
    onDurationChange,
    resolutionOptions,
    selectedVariantByModel,
    supportsIngredientsMode,
    allowIngredientsAlongsideFrames,
    activeVariant.defaultInputMode,
    qualityOptions,
    uiQuality,
    uiAspectRatio,
    uiDuration,
    uiResolution,
  ]);

  const setUploadBusy = useCallback((key: string, busy: boolean) => {
    setUploadBusyByKey((current) => {
      if (busy) {
        if (current[key]) {
          return current;
        }
        return {
          ...current,
          [key]: true,
        };
      }
      if (!current[key]) {
        return current;
      }
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const handleDurationChange = useCallback(
    (next: string) => {
      setUiDuration(next);
      const numericDuration = Number(next);
      if (Number.isFinite(numericDuration)) {
        onDurationChange(numericDuration);
      }
    },
    [onDurationChange]
  );

  const handleAspectRatioChange = useCallback(
    (next: string) => {
      setUiAspectRatio(next);
      onAspectRatioChange(next);
    },
    [onAspectRatioChange]
  );

  const uploadSlotImage = useCallback(
    async (slotId: string, file: File) => {
      if (!onUploadImage) {
        setUploadError("Media uploads are not available right now.");
        return;
      }

      const busyKey = `frame:${activeVariant.id}:${slotId}`;
      setUploadBusy(busyKey, true);
      try {
        const uploaded = await onUploadImage(file, {
          modelId: activeModel.id,
          variantId: activeVariant.id,
          slotId,
          mode: "frame",
        });
        setFrameUploadsByVariant((current) => ({
          ...current,
          [activeVariant.id]: {
            ...(current[activeVariant.id] ?? {}),
            [slotId]: uploaded,
          },
        }));
        setUploadError(null);
      } catch (uploadErrorValue) {
        const message =
          uploadErrorValue instanceof Error && uploadErrorValue.message
            ? uploadErrorValue.message
            : "Upload failed.";
        setUploadError(message);
      } finally {
        setUploadBusy(busyKey, false);
      }
    },
    [activeModel.id, activeVariant.id, onUploadImage, setUploadBusy]
  );

  const clearSlotImage = useCallback((slotId: string) => {
    setFrameUploadsByVariant((current) => {
      const previousForVariant = current[activeVariant.id] ?? {};
      if (!previousForVariant[slotId]) {
        return current;
      }
      return {
        ...current,
        [activeVariant.id]: {
          ...previousForVariant,
          [slotId]: null,
        },
      };
    });
  }, [activeVariant.id]);

  const uploadIngredientImages = useCallback(
    async (files: File[]) => {
      if (!onUploadImage) {
        setUploadError("Media uploads are not available right now.");
        return;
      }
      const busyKey = `ingredients:${activeVariant.id}`;
      setUploadBusy(busyKey, true);
      try {
        const currentItems = ingredientUploadsByVariant[activeVariant.id] ?? [];
        const remainingSlots = Math.max(0, ingredientsLimit - currentItems.length);
        if (remainingSlots <= 0) {
          setUploadError(`You can upload up to ${ingredientsLimit} ingredients.`);
          return;
        }

        const uploads: AiVideoUploadedImage[] = [];
        for (const file of files.slice(0, remainingSlots)) {
          const uploaded = await onUploadImage(file, {
            modelId: activeModel.id,
            variantId: activeVariant.id,
            slotId: `ingredient-${currentItems.length + uploads.length + 1}`,
            mode: "ingredient",
          });
          uploads.push(uploaded);
        }

        if (uploads.length > 0) {
          setIngredientUploadsByVariant((current) => ({
            ...current,
            [activeVariant.id]: [...(current[activeVariant.id] ?? []), ...uploads],
          }));
          setUploadError(null);
        }
      } catch (uploadErrorValue) {
        const message =
          uploadErrorValue instanceof Error && uploadErrorValue.message
            ? uploadErrorValue.message
            : "Ingredient upload failed.";
        setUploadError(message);
      } finally {
        setUploadBusy(busyKey, false);
      }
    },
    [
      activeModel.id,
      activeVariant.id,
      ingredientUploadsByVariant,
      ingredientsLimit,
      onUploadImage,
      setUploadBusy,
    ]
  );

  const removeIngredient = useCallback((index: number) => {
    setIngredientUploadsByVariant((current) => {
      const previous = current[activeVariant.id] ?? [];
      if (!previous[index]) {
        return current;
      }
      return {
        ...current,
        [activeVariant.id]: previous.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  }, [activeVariant.id]);

  const handleGenerateClick = useCallback(() => {
    const numericDuration = Number(uiDuration);
    const resolvedDuration = Number.isFinite(numericDuration)
      ? numericDuration
      : duration;
    onGenerate({
      modelId: activeModel.id,
      variantId: activeVariant.id,
      prompt,
      aspectRatio: uiAspectRatio,
      duration: resolvedDuration,
      resolution: uiResolution,
      quality: qualityOptions.length > 0 ? uiQuality : undefined,
      generateAudio,
      ingredientsMode,
      fixedLensEnabled,
      multiShotEnabled,
      sceneControlEnabled,
      characterOrientation: showCharacterOrientationControl
        ? characterOrientation
        : undefined,
      frameImages: activeFrameUploads,
      ingredientImages: activeIngredientUploads,
    });
  }, [
    activeFrameUploads,
    activeIngredientUploads,
    activeModel.id,
    activeVariant.id,
    duration,
    fixedLensEnabled,
    generateAudio,
    ingredientsMode,
    qualityOptions.length,
    sceneControlEnabled,
    showCharacterOrientationControl,
    characterOrientation,
    multiShotEnabled,
    onGenerate,
    prompt,
    uiAspectRatio,
    uiDuration,
    uiQuality,
    uiResolution,
  ]);

  return (
    <div className="space-y-3">
      <div aria-hidden="true" className="h-0 w-0 overflow-hidden opacity-0">
        {videosToPreload.map((url) => (
          <video key={`preload-${url}`} src={url} preload="auto" muted playsInline />
        ))}
      </div>

      <nav className="grid auto-cols-min grid-flow-col gap-3 px-1 pt-1">
        {[
          { id: "create", label: "Create Video" },
          { id: "edit", label: "Edit Video" },
          { id: "motion", label: "Motion Control" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() =>
              setPanelTab(tab.id as "create" | "edit" | "motion")
            }
            className={`h-9 whitespace-nowrap border-b-2 text-[12px] font-medium transition ${
              panelTab === tab.id
                ? "border-[var(--satura-font-primary)] text-[var(--satura-font-primary)]"
                : "border-transparent text-[var(--satura-font-secondary)] hover:text-[var(--satura-font-primary)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="space-y-3 rounded-2xl border border-[var(--satura-separator-card)] bg-[var(--satura-surface-secondary)] p-3 shadow-[0_14px_40px_-24px_rgba(0,0,0,0.8)]">
          <figure className="relative overflow-hidden rounded-xl border border-[var(--satura-divider-secondary)] bg-[var(--satura-surface-tertiary)]">
            {activeModelPreviewVideo ? (
              <video
                src={activeModelPreviewVideo}
                className="h-[138px] w-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
              />
            ) : (
              <Image
                src={PREVIEW_PLACEHOLDER_SRC}
                alt={`${activeModel.name} preview placeholder`}
                width={960}
                height={420}
                className="h-[138px] w-full object-cover"
              />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[rgba(0,0,0,0.62)]" />
            <figcaption className="absolute inset-x-0 bottom-0 z-10 px-3 pb-2.5">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--satura-font-brand)]">
                {previewTitle}
              </p>
              <p className="truncate text-[11px] text-[var(--satura-white-80)]">{previewSubtitle}</p>
            </figcaption>
          </figure>

          {visibleModels.length > 1 ? (
            <div className="rounded-2xl border border-[var(--satura-divider-secondary)] bg-[var(--satura-surface-secondary)] p-2">
              {visibleModels.map((model) => {
                const isActive = model.id === activeModel.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setActiveModelId(model.id)}
                    className={`mb-1 flex w-full items-center gap-2 rounded-xl p-2 text-left transition last:mb-0 ${
                      isActive ? "bg-[var(--satura-white-5)]" : "hover:bg-[var(--satura-white-5)]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-[var(--satura-font-primary)]">
                        {model.name}
                      </p>
                      <p className="truncate text-[11px] text-[var(--satura-font-secondary)]">
                        {model.summary}
                      </p>
                    </div>
                    {isActive ? (
                      <Check className="h-4 w-4 text-[var(--satura-font-brand)]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[var(--satura-font-secondary)]" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : null}

          {activeModel.variants.length > 1 ? (
            <div className="rounded-2xl border border-[var(--satura-divider-secondary)] bg-[var(--satura-surface-secondary)] p-2">
              {activeModel.variants.map((variant) => {
                const isActive = activeVariant.id === variant.id;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() =>
                      setSelectedVariantByModel((current) => ({
                        ...current,
                        [activeModel.id]: variant.id,
                      }))
                    }
                    className={`mb-1 flex w-full items-start gap-2 rounded-xl p-2 text-left transition last:mb-0 ${
                      isActive ? "bg-[var(--satura-white-5)]" : "hover:bg-[var(--satura-white-5)]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-[var(--satura-font-primary)]">
                        {variant.name}
                      </p>
                      <p className="truncate text-[11px] text-[var(--satura-font-secondary)]">
                        {variant.description}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {variant.caps.map((cap) => (
                          <InfoChip key={`${variant.id}-${cap}`} label={cap} />
                        ))}
                      </div>
                    </div>
                    {isActive ? (
                      <Check className="mt-0.5 h-4 w-4 text-[var(--satura-font-brand)]" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {supportsIngredientsMode && !allowIngredientsAlongsideFrames ? (
            <div className="inline-flex w-full rounded-xl bg-[var(--satura-surface-tertiary)] p-1">
              <button
                type="button"
                onClick={() => setIngredientsMode("frames")}
                className={`flex-1 rounded-lg px-2 py-2 text-[12px] font-medium transition ${
                  ingredientsMode === "frames"
                    ? "bg-[var(--satura-white-10)] text-[var(--satura-font-primary)]"
                    : "text-[var(--satura-font-secondary)] hover:text-[var(--satura-font-primary)]"
                }`}
              >
                Frames
              </button>
              <button
                type="button"
                onClick={() => setIngredientsMode("ingredients")}
                className={`flex-1 rounded-lg px-2 py-2 text-[12px] font-medium transition ${
                  ingredientsMode === "ingredients"
                    ? "bg-[var(--satura-white-10)] text-[var(--satura-font-primary)]"
                    : "text-[var(--satura-font-secondary)] hover:text-[var(--satura-font-primary)]"
                }`}
              >
                Ingredients
              </button>
            </div>
          ) : null}

          {(
            !supportsIngredientsMode ||
            ingredientsMode === "frames" ||
            allowIngredientsAlongsideFrames
          ) && frameSlots.length > 0 ? (
            <div className={`grid gap-2 ${frameSlots.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {frameSlots.map((slot) => {
                const slotValue = activeFrameUploads[slot.id] ?? null;
                const slotBusy =
                  uploadBusyByKey[`frame:${activeVariant.id}:${slot.id}`] === true;
                return (
                  <UploadFrameCard
                    key={`${activeVariant.id}-${slot.id}`}
                    slot={slot}
                    value={slotValue}
                    busy={slotBusy}
                    onUpload={(file) => uploadSlotImage(slot.id, file)}
                    onClear={() => clearSlotImage(slot.id)}
                  />
                );
              })}
            </div>
          ) : null}

          {(supportsIngredientsMode && ingredientsMode === "ingredients") ||
          allowIngredientsAlongsideFrames ? (
            <IngredientsDropzone
              items={activeIngredientUploads}
              limit={ingredientsLimit}
              busy={uploadBusyByKey[`ingredients:${activeVariant.id}`] === true}
              inputKind={ingredientInputKind}
              onUpload={uploadIngredientImages}
              onRemove={removeIngredient}
            />
          ) : null}

          <label className="block rounded-xl border border-[var(--satura-divider-secondary)] bg-[var(--satura-surface-subtle)] px-3 py-2">
            <span className="text-[12px] font-medium text-[var(--satura-font-secondary)]">Prompt</span>
            <textarea
              id={promptId}
              rows={4}
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              placeholder={promptInputPlaceholder}
              className="mt-1 h-[90px] w-full resize-none border-none bg-transparent text-[13px] leading-[1.4] text-[var(--satura-font-primary)] placeholder:text-[var(--satura-font-secondary)] outline-none ring-0 focus:border-transparent focus:outline-none focus:ring-0 focus:shadow-none focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              if (typeof onEnhancePrompt === "function") {
                onEnhancePrompt();
              }
            }}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
              enhanceBusy
                ? "cursor-wait border-[var(--satura-divider-secondary)] bg-[var(--satura-white-5)] text-[var(--satura-font-secondary)]"
                : "border-[var(--satura-divider-secondary)] bg-[var(--satura-surface-tertiary)] text-[var(--satura-font-primary)] hover:border-[var(--satura-brand-primary-30)] hover:text-[var(--satura-font-brand)]"
            }`}
            disabled={enhanceBusy || typeof onEnhancePrompt !== "function"}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {enhanceBusy ? "Enhancing..." : "Magic Prompt"}
          </button>

          {enhanceError ? (
            <p className="text-[11px] font-medium text-[var(--satura-error)]">{enhanceError}</p>
          ) : null}

          {uploadError ? (
            <p className="text-[11px] font-medium text-[var(--satura-error)]">{uploadError}</p>
          ) : null}

          {missingRequiredSlots.length > 0 ? (
            <p className="text-[11px] text-[var(--satura-font-secondary)]">
              {missingRequiredSlotsMessage}
            </p>
          ) : null}
          {missingRequiredIngredients ? (
            <p className="text-[11px] text-[var(--satura-font-secondary)]">
              Upload at least one ingredient {ingredientInputKind === "video" ? "video" : "image"} to generate.
            </p>
          ) : null}
          {!isVariantImplemented ? (
            <p className="text-[11px] text-[var(--satura-font-secondary)]">
              Reference UI enabled. Generation wiring for this model comes next.
            </p>
          ) : null}

          <div className="grid gap-2 overflow-visible sm:grid-cols-2">
            {showDurationControl ? (
              <SelectField
                label="Duration"
                value={uiDuration}
                options={durationOptions}
                onChange={handleDurationChange}
              />
            ) : null}
            {showAspectControl ? (
              <SelectField
                label="Aspect Ratio"
                value={uiAspectRatio}
                options={aspectOptions}
                onChange={handleAspectRatioChange}
              />
            ) : null}
            {showResolutionControl ? (
              <SelectField
                label="Resolution"
                value={uiResolution}
                options={resolutionOptions}
                onChange={setUiResolution}
              />
            ) : null}
            {qualityOptions.length > 0 ? (
              <SelectField
                label="Quality"
                value={uiQuality}
                options={qualityOptions}
                onChange={setUiQuality}
              />
            ) : null}
          </div>

          {showAdvancedSettingsToggle ? (
            <div className="rounded-xl border border-[var(--satura-divider-secondary)] bg-[var(--satura-surface-subtle)] px-3 py-2">
              <button
                type="button"
                onClick={() =>
                  setAdvancedSettingsOpenByVariant((current) => ({
                    ...current,
                    [activeVariant.id]: !advancedSettingsOpen,
                  }))
                }
                className="flex w-full items-center justify-between text-left"
                aria-expanded={advancedSettingsOpen}
              >
                <span className="text-[13px] font-medium text-[var(--satura-font-primary)]">
                  Advanced settings
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-[var(--satura-font-secondary)] transition ${
                    advancedSettingsOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {advancedSettingsOpen ? (
                <div className="mt-2 space-y-2">
                  {showSceneControlToggle ? (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--satura-divider-secondary)] bg-[var(--satura-surface-primary)] px-3 py-2">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-[12px] font-medium text-[var(--satura-font-primary)]">
                          Scene control mode
                        </p>
                        <p className="text-[11px] text-[var(--satura-font-secondary)]">
                          Tune orientation behavior for complex motion vs camera moves.
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={sceneControlEnabled}
                        onChange={(next) =>
                          setSceneControlEnabledByVariant((current) => ({
                            ...current,
                            [activeVariant.id]: next,
                          }))
                        }
                        ariaLabel="Scene control mode"
                      />
                    </div>
                  ) : null}

                  {showCharacterOrientationControl && sceneControlEnabled ? (
                    <div className="space-y-2 rounded-lg border border-[var(--satura-divider-secondary)] bg-[var(--satura-surface-primary)] px-3 py-2">
                      <p className="text-[12px] font-medium text-[var(--satura-font-primary)]">
                        Character orientation
                      </p>
                      <div className="inline-flex w-full rounded-lg bg-[var(--satura-surface-tertiary)] p-1">
                        {[
                          { id: "video", label: "Video" },
                          { id: "image", label: "Image" },
                        ].map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() =>
                              setCharacterOrientationByVariant((current) => ({
                                ...current,
                                [activeVariant.id]: option.id as "image" | "video",
                              }))
                            }
                            className={`flex-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition ${
                              characterOrientation === option.id
                                ? "bg-[var(--satura-white-10)] text-[var(--satura-font-primary)]"
                                : "text-[var(--satura-font-secondary)] hover:text-[var(--satura-font-primary)]"
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-[var(--satura-font-secondary)]">
                        Video = better for complex motion. Image = better for camera movement.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {showFixedLensToggle ? (
            <div className="flex items-center justify-between rounded-xl border border-[var(--satura-divider-secondary)] bg-[var(--satura-surface-subtle)] px-3 py-2">
              <div className="space-y-0.5">
                <p className="text-[13px] font-medium text-[var(--satura-font-primary)]">Fixed Lens</p>
                <p className="text-[11px] text-[var(--satura-font-secondary)]">
                  Keep lens behavior stable across shots.
                </p>
              </div>
              <ToggleSwitch
                checked={fixedLensEnabled}
                onChange={setFixedLensEnabled}
                ariaLabel="Fixed lens"
              />
            </div>
          ) : null}

          {showMultiShotToggle ? (
            <div className="flex items-center justify-between rounded-xl border border-[var(--satura-divider-secondary)] bg-[var(--satura-surface-subtle)] px-3 py-2">
              <div className="space-y-0.5">
                <p className="text-[13px] font-medium text-[var(--satura-font-primary)]">Multi-shot mode</p>
                <p className="text-[11px] text-[var(--satura-font-secondary)]">
                  Stitch multiple camera beats into one generation.
                </p>
              </div>
              <ToggleSwitch
                checked={multiShotEnabled}
                onChange={setMultiShotEnabled}
                ariaLabel="Multi-shot mode"
              />
            </div>
          ) : null}

          {showAudioToggle ? (
            <div className="flex items-center justify-between rounded-xl border border-[var(--satura-divider-secondary)] bg-[var(--satura-surface-subtle)] px-3 py-2">
              <div className="space-y-0.5">
                <p className="text-[13px] font-medium text-[var(--satura-font-primary)]">
                  {audioToggleLabel}
                </p>
                <p className="text-[11px] text-[var(--satura-font-secondary)]">
                  {audioToggleDescription}
                </p>
              </div>
              <ToggleSwitch
                checked={generateAudio}
                onChange={onGenerateAudioChange}
                ariaLabel={audioToggleLabel}
              />
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleGenerateClick}
            disabled={isGenerateDisabled}
            className={`flex w-full items-center justify-center rounded-xl px-4 py-3 text-[14px] font-semibold transition ${
              isGenerateDisabled
                ? "cursor-not-allowed bg-[var(--satura-white-10)] text-[var(--satura-font-disabled)]"
                : "bg-[radial-gradient(circle_at_top,var(--satura-brand-primary)_0%,var(--satura-brand-primary-500)_72%)] text-black shadow-[inset_0_-3px_rgba(0,0,0,0.35)] hover:brightness-95"
            }`}
          >
            {status === "loading" ? "Generating..." : "Generate"}
          </button>

          {error ? <p className="text-[11px] font-medium text-[var(--satura-error)]">{error}</p> : null}
          {status === "loading" ? (
            <p className="text-[11px] text-[var(--satura-font-secondary)]">
              This can take 2-5 minutes to generate.
            </p>
          ) : null}
          {hasGeneratedAsset && onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="w-full rounded-lg border border-[var(--satura-divider-secondary)] bg-[var(--satura-surface-secondary)] px-3 py-2 text-[12px] font-semibold text-[var(--satura-font-secondary)] transition hover:bg-[var(--satura-surface-tertiary)] hover:text-[var(--satura-font-primary)]"
            >
              Clear
            </button>
          ) : null}
        </div>
    </div>
  );
};
