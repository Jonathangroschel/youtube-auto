import crypto from "crypto";
import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server-client";

export const runtime = "nodejs";

const SUPABASE_BUCKET = "user-assets";

type VariantInputMode =
  | "text"
  | "image"
  | "first-last"
  | "reference-images"
  | "reference-videos"
  | "extend-video"
  | "motion-control";

type DurationFormat = "number" | "suffix" | "string";

type ModelVariantConfig = {
  id: string;
  endpoint: string;
  inputMode: VariantInputMode;
  allowedAspectRatios: readonly string[];
  defaultAspectRatio: string;
  allowedDurations: readonly number[];
  defaultDuration: number;
  durationFormat: DurationFormat;
  allowedResolutions: readonly string[];
  defaultResolution: string;
  promptRequired?: boolean;
  includeGenerateAudio?: boolean;
  includeKeepOriginalSound?: boolean;
  autoFixDefault?: boolean;
  includeDeleteVideo?: boolean;
  allowedModelSnapshots?: readonly string[];
  includeAspectRatio?: boolean;
  includeResolution?: boolean;
  includeDuration?: boolean;
  durationParamName?: "duration" | "num_frames";
  durationMap?: Record<number, number | string>;
  staticInput?: Record<string, unknown>;
  includeKeepAudio?: boolean;
  includeIngredientImageUrls?: boolean;
  maxIngredientImageUrls?: number;
  includeCharacterOrientation?: boolean;
  allowedCharacterOrientations?: readonly string[];
  defaultCharacterOrientation?: "image" | "video";
  includeEndImageUrl?: boolean;
  imageFieldName?: string;
  imageSourceSlotId?: string;
  endImageFieldName?: string;
  requireReferenceInputs?: boolean;
};

const MODEL_VARIANTS: Record<string, ModelVariantConfig> = {
  "sora-2-text-to-video": {
    id: "sora-2-text-to-video",
    endpoint: "https://fal.run/fal-ai/sora-2/text-to-video",
    inputMode: "text",
    allowedAspectRatios: ["16:9", "9:16"],
    defaultAspectRatio: "16:9",
    allowedDurations: [4, 8, 12],
    defaultDuration: 4,
    durationFormat: "number",
    allowedResolutions: ["720p"],
    defaultResolution: "720p",
    includeDeleteVideo: true,
    allowedModelSnapshots: [
      "sora-2",
      "sora-2-2025-12-08",
      "sora-2-2025-10-06",
    ],
  },
  "sora-2-image-to-video": {
    id: "sora-2-image-to-video",
    endpoint: "https://fal.run/fal-ai/sora-2/image-to-video",
    inputMode: "image",
    allowedAspectRatios: ["auto", "16:9", "9:16"],
    defaultAspectRatio: "auto",
    allowedDurations: [4, 8, 12],
    defaultDuration: 4,
    durationFormat: "number",
    allowedResolutions: ["auto", "720p"],
    defaultResolution: "auto",
    includeDeleteVideo: true,
    allowedModelSnapshots: [
      "sora-2",
      "sora-2-2025-12-08",
      "sora-2-2025-10-06",
    ],
  },
  "sora-2-pro-text-to-video": {
    id: "sora-2-pro-text-to-video",
    endpoint: "https://fal.run/fal-ai/sora-2/text-to-video/pro",
    inputMode: "text",
    allowedAspectRatios: ["16:9", "9:16"],
    defaultAspectRatio: "16:9",
    allowedDurations: [4, 8, 12],
    defaultDuration: 4,
    durationFormat: "number",
    allowedResolutions: ["720p", "1080p"],
    defaultResolution: "1080p",
    includeDeleteVideo: true,
  },
  "sora-2-pro-image-to-video": {
    id: "sora-2-pro-image-to-video",
    endpoint: "https://fal.run/fal-ai/sora-2/image-to-video/pro",
    inputMode: "image",
    allowedAspectRatios: ["auto", "16:9", "9:16"],
    defaultAspectRatio: "auto",
    allowedDurations: [4, 8, 12],
    defaultDuration: 4,
    durationFormat: "number",
    allowedResolutions: ["auto", "720p", "1080p"],
    defaultResolution: "auto",
    includeDeleteVideo: true,
  },
  "veo-3": {
    id: "veo-3",
    endpoint: "https://fal.run/fal-ai/veo3",
    inputMode: "text",
    allowedAspectRatios: ["16:9", "9:16"],
    defaultAspectRatio: "16:9",
    allowedDurations: [4, 6, 8],
    defaultDuration: 8,
    durationFormat: "suffix",
    allowedResolutions: ["720p", "1080p"],
    defaultResolution: "720p",
    includeGenerateAudio: true,
    autoFixDefault: true,
  },
  "veo-3-fast": {
    id: "veo-3-fast",
    endpoint: "https://fal.run/fal-ai/veo3/fast",
    inputMode: "text",
    allowedAspectRatios: ["16:9", "9:16"],
    defaultAspectRatio: "16:9",
    allowedDurations: [4, 6, 8],
    defaultDuration: 8,
    durationFormat: "suffix",
    allowedResolutions: ["720p", "1080p"],
    defaultResolution: "720p",
    includeGenerateAudio: true,
    autoFixDefault: true,
  },
  "veo-3-1": {
    id: "veo-3-1",
    endpoint: "https://fal.run/fal-ai/veo3.1",
    inputMode: "text",
    allowedAspectRatios: ["16:9", "9:16"],
    defaultAspectRatio: "16:9",
    allowedDurations: [4, 6, 8],
    defaultDuration: 8,
    durationFormat: "suffix",
    allowedResolutions: ["720p", "1080p", "4k"],
    defaultResolution: "720p",
    includeGenerateAudio: true,
    autoFixDefault: true,
  },
  "veo-3-1-fast": {
    id: "veo-3-1-fast",
    endpoint: "https://fal.run/fal-ai/veo3.1/fast",
    inputMode: "text",
    allowedAspectRatios: ["16:9", "9:16"],
    defaultAspectRatio: "16:9",
    allowedDurations: [4, 6, 8],
    defaultDuration: 8,
    durationFormat: "suffix",
    allowedResolutions: ["720p", "1080p", "4k"],
    defaultResolution: "720p",
    includeGenerateAudio: true,
    autoFixDefault: true,
  },
  "veo-3-1-fast-first-last-frame": {
    id: "veo-3-1-fast-first-last-frame",
    endpoint: "https://fal.run/fal-ai/veo3.1/fast/first-last-frame-to-video",
    inputMode: "first-last",
    allowedAspectRatios: ["auto", "16:9", "9:16"],
    defaultAspectRatio: "auto",
    allowedDurations: [4, 6, 8],
    defaultDuration: 8,
    durationFormat: "suffix",
    allowedResolutions: ["720p", "1080p", "4k"],
    defaultResolution: "720p",
    includeGenerateAudio: true,
    autoFixDefault: false,
  },
  "veo-3-1-reference-to-video": {
    id: "veo-3-1-reference-to-video",
    endpoint: "https://fal.run/fal-ai/veo3.1/reference-to-video",
    inputMode: "reference-images",
    allowedAspectRatios: ["16:9", "9:16"],
    defaultAspectRatio: "16:9",
    allowedDurations: [8],
    defaultDuration: 8,
    durationFormat: "suffix",
    allowedResolutions: ["720p", "1080p", "4k"],
    defaultResolution: "720p",
    includeGenerateAudio: true,
    autoFixDefault: false,
  },
  "veo-3-1-fast-image-to-video": {
    id: "veo-3-1-fast-image-to-video",
    endpoint: "https://fal.run/fal-ai/veo3.1/fast/image-to-video",
    inputMode: "image",
    allowedAspectRatios: ["auto", "16:9", "9:16"],
    defaultAspectRatio: "auto",
    allowedDurations: [4, 6, 8],
    defaultDuration: 8,
    durationFormat: "suffix",
    allowedResolutions: ["720p", "1080p", "4k"],
    defaultResolution: "720p",
    includeGenerateAudio: true,
    autoFixDefault: false,
  },
  "veo-3-1-fast-extend-video": {
    id: "veo-3-1-fast-extend-video",
    endpoint: "https://fal.run/fal-ai/veo3.1/fast/extend-video",
    inputMode: "extend-video",
    allowedAspectRatios: ["auto", "16:9", "9:16"],
    defaultAspectRatio: "auto",
    allowedDurations: [7],
    defaultDuration: 7,
    durationFormat: "suffix",
    allowedResolutions: ["720p"],
    defaultResolution: "720p",
    includeGenerateAudio: true,
    autoFixDefault: false,
  },
  "kling-2-1-master-text-to-video": {
    id: "kling-2-1-master-text-to-video",
    endpoint: "https://fal.run/fal-ai/kling-video/v2.1/master/text-to-video",
    inputMode: "text",
    allowedAspectRatios: ["16:9", "9:16", "1:1"],
    defaultAspectRatio: "16:9",
    allowedDurations: [5, 10],
    defaultDuration: 5,
    durationFormat: "string",
    allowedResolutions: ["auto"],
    defaultResolution: "auto",
    includeResolution: false,
  },
  "kling-2-5-turbo-pro-text-to-video": {
    id: "kling-2-5-turbo-pro-text-to-video",
    endpoint: "https://fal.run/fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    inputMode: "text",
    allowedAspectRatios: ["16:9", "9:16", "1:1"],
    defaultAspectRatio: "16:9",
    allowedDurations: [5, 10],
    defaultDuration: 5,
    durationFormat: "string",
    allowedResolutions: ["auto"],
    defaultResolution: "auto",
    includeResolution: false,
  },
  "kling-2-6-pro-text-to-video": {
    id: "kling-2-6-pro-text-to-video",
    endpoint: "https://fal.run/fal-ai/kling-video/v2.6/pro/text-to-video",
    inputMode: "text",
    allowedAspectRatios: ["16:9", "9:16", "1:1"],
    defaultAspectRatio: "16:9",
    allowedDurations: [5, 10],
    defaultDuration: 5,
    durationFormat: "string",
    allowedResolutions: ["auto"],
    defaultResolution: "auto",
    includeResolution: false,
    includeGenerateAudio: true,
  },
  "kling-2-6-pro-image-to-video": {
    id: "kling-2-6-pro-image-to-video",
    endpoint: "https://fal.run/fal-ai/kling-video/v2.6/pro/image-to-video",
    inputMode: "image",
    allowedAspectRatios: ["16:9", "9:16", "1:1"],
    defaultAspectRatio: "16:9",
    allowedDurations: [5, 10],
    defaultDuration: 5,
    durationFormat: "string",
    allowedResolutions: ["auto"],
    defaultResolution: "auto",
    includeAspectRatio: false,
    includeResolution: false,
    includeGenerateAudio: true,
    includeEndImageUrl: true,
    imageFieldName: "start_image_url",
    imageSourceSlotId: "start-frame",
    endImageFieldName: "end_image_url",
  },
  "kling-2-6-pro-motion-control": {
    id: "kling-2-6-pro-motion-control",
    endpoint: "https://fal.run/fal-ai/kling-video/v2.6/pro/motion-control",
    inputMode: "motion-control",
    allowedAspectRatios: ["auto"],
    defaultAspectRatio: "auto",
    allowedDurations: [6],
    defaultDuration: 6,
    durationFormat: "string",
    allowedResolutions: ["auto"],
    defaultResolution: "auto",
    includeAspectRatio: false,
    includeDuration: false,
    includeResolution: false,
    includeKeepOriginalSound: true,
    includeCharacterOrientation: true,
    allowedCharacterOrientations: ["image", "video"],
    defaultCharacterOrientation: "video",
  },
  "kling-o1-first-last-frame-to-video": {
    id: "kling-o1-first-last-frame-to-video",
    endpoint: "https://fal.run/fal-ai/kling-video/o1/image-to-video",
    inputMode: "image",
    allowedAspectRatios: ["16:9", "9:16", "1:1"],
    defaultAspectRatio: "16:9",
    allowedDurations: [3, 4, 5, 6, 7, 8, 9, 10],
    defaultDuration: 5,
    durationFormat: "string",
    allowedResolutions: ["auto"],
    defaultResolution: "auto",
    includeAspectRatio: false,
    includeResolution: false,
    includeEndImageUrl: true,
    imageFieldName: "start_image_url",
    imageSourceSlotId: "start-frame",
    endImageFieldName: "end_image_url",
  },
  "kling-o1-reference-to-video": {
    id: "kling-o1-reference-to-video",
    endpoint: "https://fal.run/fal-ai/kling-video/o1/reference-to-video",
    inputMode: "reference-images",
    allowedAspectRatios: ["16:9", "9:16", "1:1"],
    defaultAspectRatio: "16:9",
    allowedDurations: [3, 4, 5, 6, 7, 8, 9, 10],
    defaultDuration: 5,
    durationFormat: "string",
    allowedResolutions: ["auto"],
    defaultResolution: "auto",
    includeResolution: false,
    requireReferenceInputs: false,
  },
  "minimax-hailuo-02-standard-text-to-video": {
    id: "minimax-hailuo-02-standard-text-to-video",
    endpoint: "https://fal.run/fal-ai/minimax/hailuo-02/standard/text-to-video",
    inputMode: "text",
    allowedAspectRatios: ["auto"],
    defaultAspectRatio: "auto",
    allowedDurations: [6, 10],
    defaultDuration: 6,
    durationFormat: "string",
    allowedResolutions: ["auto"],
    defaultResolution: "auto",
    includeAspectRatio: false,
    includeResolution: false,
    staticInput: {
      prompt_optimizer: true,
    },
  },
  "minimax-hailuo-02-pro-text-to-video": {
    id: "minimax-hailuo-02-pro-text-to-video",
    endpoint: "https://fal.run/fal-ai/minimax/hailuo-02/pro/text-to-video",
    inputMode: "text",
    allowedAspectRatios: ["auto"],
    defaultAspectRatio: "auto",
    allowedDurations: [6],
    defaultDuration: 6,
    durationFormat: "string",
    allowedResolutions: ["auto"],
    defaultResolution: "auto",
    includeAspectRatio: false,
    includeResolution: false,
    includeDuration: false,
    staticInput: {
      prompt_optimizer: true,
    },
  },
  "minimax-hailuo-2-3-standard-text-to-video": {
    id: "minimax-hailuo-2-3-standard-text-to-video",
    endpoint: "https://fal.run/fal-ai/minimax/hailuo-2.3/standard/text-to-video",
    inputMode: "text",
    allowedAspectRatios: ["auto"],
    defaultAspectRatio: "auto",
    allowedDurations: [6, 10],
    defaultDuration: 6,
    durationFormat: "string",
    allowedResolutions: ["auto"],
    defaultResolution: "auto",
    includeAspectRatio: false,
    includeResolution: false,
    staticInput: {
      prompt_optimizer: true,
    },
  },
  "minimax-hailuo-2-3-pro-text-to-video": {
    id: "minimax-hailuo-2-3-pro-text-to-video",
    endpoint: "https://fal.run/fal-ai/minimax/hailuo-2.3/pro/text-to-video",
    inputMode: "text",
    allowedAspectRatios: ["auto"],
    defaultAspectRatio: "auto",
    allowedDurations: [6],
    defaultDuration: 6,
    durationFormat: "string",
    allowedResolutions: ["auto"],
    defaultResolution: "auto",
    includeAspectRatio: false,
    includeResolution: false,
    includeDuration: false,
    staticInput: {
      prompt_optimizer: true,
    },
  },
  "minimax-hailuo-2-3-fast-pro-image-to-video": {
    id: "minimax-hailuo-2-3-fast-pro-image-to-video",
    endpoint: "https://fal.run/fal-ai/minimax/hailuo-2.3-fast/pro/image-to-video",
    inputMode: "image",
    allowedAspectRatios: ["auto"],
    defaultAspectRatio: "auto",
    allowedDurations: [6],
    defaultDuration: 6,
    durationFormat: "string",
    allowedResolutions: ["auto"],
    defaultResolution: "auto",
    includeAspectRatio: false,
    includeResolution: false,
    includeDuration: false,
    staticInput: {
      prompt_optimizer: true,
    },
  },
  "seedance-1-5-pro-text-to-video": {
    id: "seedance-1-5-pro-text-to-video",
    endpoint: "https://fal.run/fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
    inputMode: "text",
    allowedAspectRatios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultAspectRatio: "16:9",
    allowedDurations: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    defaultDuration: 5,
    durationFormat: "string",
    allowedResolutions: ["480p", "720p", "1080p"],
    defaultResolution: "720p",
    includeGenerateAudio: true,
    staticInput: {
      enable_safety_checker: true,
    },
  },
  "seedance-v1-pro-fast-text-to-video": {
    id: "seedance-v1-pro-fast-text-to-video",
    endpoint: "https://fal.run/fal-ai/bytedance/seedance/v1/pro/fast/text-to-video",
    inputMode: "text",
    allowedAspectRatios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultAspectRatio: "16:9",
    allowedDurations: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    defaultDuration: 5,
    durationFormat: "string",
    allowedResolutions: ["480p", "720p", "1080p"],
    defaultResolution: "1080p",
    staticInput: {
      enable_safety_checker: true,
    },
  },
  "seedance-v1-lite-text-to-video": {
    id: "seedance-v1-lite-text-to-video",
    endpoint: "https://fal.run/fal-ai/bytedance/seedance/v1/lite/text-to-video",
    inputMode: "text",
    allowedAspectRatios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16", "9:21"],
    defaultAspectRatio: "16:9",
    allowedDurations: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    defaultDuration: 5,
    durationFormat: "string",
    allowedResolutions: ["480p", "720p", "1080p"],
    defaultResolution: "720p",
    staticInput: {
      enable_safety_checker: true,
    },
  },
  "grok-imagine-video-text-to-video": {
    id: "grok-imagine-video-text-to-video",
    endpoint: "https://fal.run/xai/grok-imagine-video/text-to-video",
    inputMode: "text",
    allowedAspectRatios: ["16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16"],
    defaultAspectRatio: "16:9",
    allowedDurations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    defaultDuration: 6,
    durationFormat: "number",
    allowedResolutions: ["480p", "720p"],
    defaultResolution: "720p",
  },
  "grok-imagine-video-image-to-video": {
    id: "grok-imagine-video-image-to-video",
    endpoint: "https://fal.run/xai/grok-imagine-video/image-to-video",
    inputMode: "image",
    allowedAspectRatios: [
      "auto",
      "16:9",
      "4:3",
      "3:2",
      "1:1",
      "2:3",
      "3:4",
      "9:16",
    ],
    defaultAspectRatio: "auto",
    allowedDurations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    defaultDuration: 6,
    durationFormat: "number",
    allowedResolutions: ["480p", "720p"],
    defaultResolution: "720p",
  },
  "grok-imagine-video-edit-video": {
    id: "grok-imagine-video-edit-video",
    endpoint: "https://fal.run/xai/grok-imagine-video/edit-video",
    inputMode: "extend-video",
    allowedAspectRatios: ["auto"],
    defaultAspectRatio: "auto",
    allowedDurations: [6],
    defaultDuration: 6,
    durationFormat: "number",
    allowedResolutions: ["auto", "480p", "720p"],
    defaultResolution: "auto",
    includeAspectRatio: false,
    includeDuration: false,
  },
  "kling-o3-pro-video-edit": {
    id: "kling-o3-pro-video-edit",
    endpoint: "https://fal.run/fal-ai/kling-video/o3/pro/video-to-video/edit",
    inputMode: "extend-video",
    allowedAspectRatios: ["auto"],
    defaultAspectRatio: "auto",
    allowedDurations: [6],
    defaultDuration: 6,
    durationFormat: "string",
    allowedResolutions: ["auto"],
    defaultResolution: "auto",
    includeAspectRatio: false,
    includeDuration: false,
    includeResolution: false,
    includeKeepAudio: true,
    includeIngredientImageUrls: true,
    maxIngredientImageUrls: 4,
    staticInput: {
      shot_type: "customize",
    },
  },
  "kling-o3-standard-video-edit": {
    id: "kling-o3-standard-video-edit",
    endpoint: "https://fal.run/fal-ai/kling-video/o3/standard/video-to-video/edit",
    inputMode: "extend-video",
    allowedAspectRatios: ["auto"],
    defaultAspectRatio: "auto",
    allowedDurations: [6],
    defaultDuration: 6,
    durationFormat: "string",
    allowedResolutions: ["auto"],
    defaultResolution: "auto",
    includeAspectRatio: false,
    includeDuration: false,
    includeResolution: false,
    includeKeepAudio: true,
    includeIngredientImageUrls: true,
    maxIngredientImageUrls: 4,
    staticInput: {
      shot_type: "customize",
    },
  },
  "wan-2-2-a14b-text-to-video-lora": {
    id: "wan-2-2-a14b-text-to-video-lora",
    endpoint: "https://fal.run/fal-ai/wan/v2.2-a14b/text-to-video/lora",
    inputMode: "text",
    allowedAspectRatios: ["16:9", "9:16", "1:1"],
    defaultAspectRatio: "16:9",
    allowedDurations: [5, 8, 10],
    defaultDuration: 5,
    durationFormat: "number",
    durationParamName: "num_frames",
    durationMap: {
      5: 81,
      8: 129,
      10: 161,
    },
    allowedResolutions: ["480p", "580p", "720p"],
    defaultResolution: "720p",
    staticInput: {
      acceleration: "regular",
      frames_per_second: 16,
    },
  },
  "wan-2-2-5b-fast-wan": {
    id: "wan-2-2-5b-fast-wan",
    endpoint: "https://fal.run/fal-ai/wan/v2.2-5b/text-to-video/fast-wan",
    inputMode: "text",
    allowedAspectRatios: ["16:9", "9:16", "1:1"],
    defaultAspectRatio: "16:9",
    allowedDurations: [5],
    defaultDuration: 5,
    durationFormat: "number",
    durationParamName: "num_frames",
    durationMap: {
      5: 121,
    },
    allowedResolutions: ["480p", "580p", "720p"],
    defaultResolution: "720p",
    staticInput: {
      frames_per_second: 24,
    },
  },
  "wan-2-2-a14b-image-to-video-lora": {
    id: "wan-2-2-a14b-image-to-video-lora",
    endpoint: "https://fal.run/fal-ai/wan/v2.2-a14b/image-to-video/lora",
    inputMode: "image",
    allowedAspectRatios: ["auto", "16:9", "9:16", "1:1"],
    defaultAspectRatio: "auto",
    allowedDurations: [5, 8, 10],
    defaultDuration: 5,
    durationFormat: "number",
    durationParamName: "num_frames",
    durationMap: {
      5: 81,
      8: 129,
      10: 161,
    },
    allowedResolutions: ["480p", "580p", "720p"],
    defaultResolution: "720p",
    includeEndImageUrl: true,
    staticInput: {
      acceleration: "regular",
      frames_per_second: 16,
    },
  },
  "wan-2-5-text-to-video": {
    id: "wan-2-5-text-to-video",
    endpoint: "https://fal.run/fal-ai/wan-25-preview/text-to-video",
    inputMode: "text",
    allowedAspectRatios: ["16:9", "9:16", "1:1"],
    defaultAspectRatio: "16:9",
    allowedDurations: [5, 10],
    defaultDuration: 5,
    durationFormat: "string",
    allowedResolutions: ["480p", "720p", "1080p"],
    defaultResolution: "1080p",
    staticInput: {
      enable_prompt_expansion: true,
      enable_safety_checker: true,
    },
  },
  "wan-2-5-image-to-video": {
    id: "wan-2-5-image-to-video",
    endpoint: "https://fal.run/fal-ai/wan-25-preview/image-to-video",
    inputMode: "image",
    allowedAspectRatios: ["16:9", "9:16", "1:1"],
    defaultAspectRatio: "16:9",
    allowedDurations: [5, 10],
    defaultDuration: 5,
    durationFormat: "string",
    allowedResolutions: ["480p", "720p", "1080p"],
    defaultResolution: "1080p",
    includeAspectRatio: false,
    staticInput: {
      enable_prompt_expansion: true,
      enable_safety_checker: true,
    },
  },
  "wan-2-6-text-to-video": {
    id: "wan-2-6-text-to-video",
    endpoint: "https://fal.run/wan/v2.6/text-to-video",
    inputMode: "text",
    allowedAspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    defaultAspectRatio: "16:9",
    allowedDurations: [5, 10, 15],
    defaultDuration: 5,
    durationFormat: "string",
    allowedResolutions: ["720p", "1080p"],
    defaultResolution: "1080p",
    staticInput: {
      enable_prompt_expansion: true,
      multi_shots: true,
      enable_safety_checker: true,
    },
  },
  "wan-2-6-image-to-video": {
    id: "wan-2-6-image-to-video",
    endpoint: "https://fal.run/wan/v2.6/image-to-video",
    inputMode: "image",
    allowedAspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    defaultAspectRatio: "16:9",
    allowedDurations: [5, 10, 15],
    defaultDuration: 5,
    durationFormat: "string",
    allowedResolutions: ["720p", "1080p"],
    defaultResolution: "1080p",
    includeAspectRatio: false,
    staticInput: {
      enable_prompt_expansion: true,
      multi_shots: false,
      enable_safety_checker: true,
    },
  },
  "wan-2-6-reference-to-video": {
    id: "wan-2-6-reference-to-video",
    endpoint: "https://fal.run/wan/v2.6/reference-to-video",
    inputMode: "reference-videos",
    allowedAspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    defaultAspectRatio: "16:9",
    allowedDurations: [5, 10],
    defaultDuration: 5,
    durationFormat: "string",
    allowedResolutions: ["720p", "1080p"],
    defaultResolution: "1080p",
    staticInput: {
      enable_prompt_expansion: true,
      multi_shots: true,
      enable_safety_checker: true,
    },
  },
};

const DEFAULT_VARIANT_ID = "sora-2-text-to-video";

type UploadEntry = { url?: string | null } | null;

type IncomingPayload = {
  prompt?: string;
  aspectRatio?: string;
  duration?: number | string;
  generateAudio?: boolean;
  modelVariant?: string;
  resolution?: string;
  modelSnapshot?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  characterOrientation?: string;
  frameImages?: Record<string, UploadEntry>;
  ingredientImages?: string[];
};

const sanitizeFilename = (value: string) => {
  const trimmed = value.trim() || "asset";
  const sanitized = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  const collapsed = sanitized.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return collapsed || "asset";
};

const buildStoragePath = (userId: string, assetId: string, filename: string) =>
  `${userId}/assets/${assetId}/${sanitizeFilename(filename)}`;

const normalizeDuration = (
  value: number | string | undefined,
  allowedDurations: readonly number[],
  fallback: number
) => {
  let candidate = fallback;
  if (typeof value === "number" && Number.isFinite(value)) {
    candidate = Math.round(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.replace(/s$/i, "").trim(), 10);
    if (Number.isFinite(parsed)) {
      candidate = parsed;
    }
  }
  return allowedDurations.includes(candidate) ? candidate : fallback;
};

const normalizeSelectValue = (
  value: string | undefined,
  allowed: readonly string[],
  fallback: string
) => {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return allowed.includes(trimmed) ? trimmed : fallback;
};

const getErrorMessageFromResponse = async (response: Response) => {
  try {
    const payload = await response.json();
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : typeof payload?.message === "string"
          ? payload.message
          : "";
    if (message) {
      return message;
    }
    return JSON.stringify(payload).slice(0, 2000);
  } catch {
    return response.text();
  }
};

const resolveExtension = (contentType: string, sourceUrl: string) => {
  const loweredType = contentType.toLowerCase();
  if (loweredType.includes("video/mp4")) {
    return "mp4";
  }
  if (loweredType.includes("video/quicktime")) {
    return "mov";
  }
  if (loweredType.includes("video/webm")) {
    return "webm";
  }

  try {
    const pathname = new URL(sourceUrl).pathname.toLowerCase();
    if (pathname.endsWith(".mov")) {
      return "mov";
    }
    if (pathname.endsWith(".webm")) {
      return "webm";
    }
    if (pathname.endsWith(".mp4")) {
      return "mp4";
    }
  } catch {
    // Ignore malformed URLs and fall back to mp4.
  }

  return "mp4";
};

const toFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const buildAssetName = (prompt: string) => {
  const trimmed = prompt.trim() || "AI Video";
  const shortened = trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
  return `AI Video - ${shortened}`;
};

const asUrl = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const getFrameUploadUrl = (
  frameImages: IncomingPayload["frameImages"],
  key: string
): string | null => {
  const entry = frameImages?.[key];
  if (!entry || typeof entry !== "object") {
    return null;
  }
  return asUrl(entry.url);
};

const getIngredientUrls = (
  payload: IncomingPayload,
  fallbackSlotId?: string
): string[] => {
  const fromPayload = Array.isArray(payload.ingredientImages)
    ? payload.ingredientImages
        .map((value) => asUrl(value))
        .filter((value): value is string => Boolean(value))
    : [];

  if (fromPayload.length > 0) {
    return fromPayload;
  }

  if (!fallbackSlotId) {
    return [];
  }

  const fallbackReference = getFrameUploadUrl(payload.frameImages, fallbackSlotId);
  return fallbackReference ? [fallbackReference] : [];
};

export async function POST(request: Request) {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing FAL_KEY." }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: IncomingPayload = {};
  try {
    payload = (await request.json()) as IncomingPayload;
  } catch {
    payload = {};
  }

  const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";

  const variantId =
    typeof payload.modelVariant === "string" && payload.modelVariant.trim().length > 0
      ? payload.modelVariant.trim()
      : DEFAULT_VARIANT_ID;
  const variant = MODEL_VARIANTS[variantId];
  if (!variant) {
    return NextResponse.json(
      {
        error: "Unsupported model variant.",
        supportedVariants: Object.keys(MODEL_VARIANTS),
      },
      { status: 400 }
    );
  }

  if (variant.promptRequired !== false && !prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }

  const aspectRatio = normalizeSelectValue(
    payload.aspectRatio,
    variant.allowedAspectRatios,
    variant.defaultAspectRatio
  );
  const duration = normalizeDuration(
    payload.duration,
    variant.allowedDurations,
    variant.defaultDuration
  );
  const resolution = normalizeSelectValue(
    payload.resolution,
    variant.allowedResolutions,
    variant.defaultResolution
  );
  const generateAudio =
    typeof payload.generateAudio === "boolean" ? payload.generateAudio : true;

  const durationValueFromMap = variant.durationMap?.[duration];
  const formattedDuration =
    durationValueFromMap ??
    (variant.durationFormat === "suffix"
      ? `${duration}s`
      : variant.durationFormat === "string"
        ? `${duration}`
        : duration);

  const falInput: Record<string, unknown> = {};
  if (prompt) {
    falInput.prompt = prompt;
  }
  if (variant.includeAspectRatio !== false) {
    falInput.aspect_ratio = aspectRatio;
  }
  if (variant.includeDuration !== false) {
    falInput[variant.durationParamName ?? "duration"] = formattedDuration;
  }
  if (variant.includeResolution !== false) {
    falInput.resolution = resolution;
  }
  if (variant.staticInput) {
    Object.assign(falInput, variant.staticInput);
  }

  if (variant.includeGenerateAudio) {
    falInput.generate_audio = generateAudio;
  }
  if (variant.includeKeepOriginalSound) {
    falInput.keep_original_sound = generateAudio;
  }
  if (variant.includeKeepAudio) {
    falInput.keep_audio = generateAudio;
  }
  if (variant.includeCharacterOrientation) {
    const normalizedOrientation = normalizeSelectValue(
      payload.characterOrientation,
      variant.allowedCharacterOrientations ?? ["video", "image"],
      variant.defaultCharacterOrientation ?? "video"
    );
    falInput.character_orientation = normalizedOrientation;
  }
  if (typeof variant.autoFixDefault === "boolean") {
    falInput.auto_fix = variant.autoFixDefault;
  }
  if (variant.includeDeleteVideo) {
    falInput.delete_video = true;
  }

  if (variant.allowedModelSnapshots?.length) {
    const modelSnapshot = asUrl(payload.modelSnapshot);
    if (modelSnapshot && variant.allowedModelSnapshots.includes(modelSnapshot)) {
      falInput.model = modelSnapshot;
    }
  }

  if (variant.inputMode === "image") {
    const imageSourceSlotId = variant.imageSourceSlotId ?? "reference";
    const imageFieldName = variant.imageFieldName ?? "image_url";
    const imageUrl =
      asUrl(payload.imageUrl) ?? getFrameUploadUrl(payload.frameImages, imageSourceSlotId);
    if (!imageUrl) {
      return NextResponse.json(
        { error: "This model requires a reference image." },
        { status: 400 }
      );
    }
    falInput[imageFieldName] = imageUrl;
    if (variant.includeEndImageUrl) {
      const endImageUrl = getFrameUploadUrl(payload.frameImages, "end-frame");
      if (endImageUrl) {
        falInput[variant.endImageFieldName ?? "end_image_url"] = endImageUrl;
      }
    }
  }

  if (variant.inputMode === "first-last") {
    const firstFrameUrl = getFrameUploadUrl(payload.frameImages, "start-frame");
    const lastFrameUrl = getFrameUploadUrl(payload.frameImages, "end-frame");
    if (!firstFrameUrl || !lastFrameUrl) {
      return NextResponse.json(
        { error: "This model requires both first and last frame images." },
        { status: 400 }
      );
    }
    falInput.first_frame_url = firstFrameUrl;
    falInput.last_frame_url = lastFrameUrl;
  }

  if (variant.inputMode === "reference-images") {
    const imageUrls = getIngredientUrls(payload, "reference");
    if (imageUrls.length === 0 && variant.requireReferenceInputs !== false) {
      return NextResponse.json(
        { error: "This model requires at least one ingredient/reference image." },
        { status: 400 }
      );
    }
    if (imageUrls.length > 0) {
      falInput.image_urls = imageUrls;
    }
  }

  if (variant.inputMode === "reference-videos") {
    const videoUrls = getIngredientUrls(payload).slice(0, 3);
    if (videoUrls.length === 0) {
      return NextResponse.json(
        { error: "This model requires at least one reference video." },
        { status: 400 }
      );
    }
    falInput.video_urls = videoUrls;
  }

  if (variant.inputMode === "extend-video") {
    const videoUrl =
      asUrl(payload.videoUrl) ?? getFrameUploadUrl(payload.frameImages, "source-video");
    if (!videoUrl) {
      return NextResponse.json(
        { error: "This model requires a source video." },
        { status: 400 }
      );
    }
    falInput.video_url = videoUrl;
    if (variant.includeIngredientImageUrls) {
      const imageUrls = getIngredientUrls(payload).slice(
        0,
        variant.maxIngredientImageUrls ?? 4
      );
      if (imageUrls.length > 0) {
        falInput.image_urls = imageUrls;
      }
    }
  }

  if (variant.inputMode === "motion-control") {
    const motionVideoUrl =
      asUrl(payload.videoUrl) ?? getFrameUploadUrl(payload.frameImages, "source-video");
    const characterImageUrl =
      asUrl(payload.imageUrl) ??
      getFrameUploadUrl(payload.frameImages, variant.imageSourceSlotId ?? "character-image");

    if (!motionVideoUrl) {
      return NextResponse.json(
        { error: "This model requires a motion reference video." },
        { status: 400 }
      );
    }
    if (!characterImageUrl) {
      return NextResponse.json(
        { error: "This model requires a character image." },
        { status: 400 }
      );
    }

    falInput.video_url = motionVideoUrl;
    falInput.image_url = characterImageUrl;
  }

  const falResponse = await fetch(variant.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(falInput),
  });

  if (!falResponse.ok) {
    const message = await getErrorMessageFromResponse(falResponse);
    return NextResponse.json(
      { error: message || "Video generation failed." },
      { status: falResponse.status }
    );
  }

  const falData = (await falResponse.json()) as Record<string, unknown>;
  const falVideo =
    falData.video && typeof falData.video === "object"
      ? (falData.video as Record<string, unknown>)
      : null;
  const generatedVideoUrl =
    asUrl(falVideo?.url) ??
    asUrl(falData.video_url) ??
    asUrl(falData.videoUrl) ??
    asUrl(falData.video);

  if (!generatedVideoUrl) {
    return NextResponse.json(
      { error: "Video generation returned no video URL." },
      { status: 502 }
    );
  }

  const generatedVideoResponse = await fetch(generatedVideoUrl);
  if (!generatedVideoResponse.ok || !generatedVideoResponse.body) {
    return NextResponse.json(
      { error: "Generated video could not be downloaded." },
      { status: 502 }
    );
  }

  const videoBuffer = await generatedVideoResponse.arrayBuffer();
  if (videoBuffer.byteLength === 0) {
    return NextResponse.json(
      { error: "Generated video is empty." },
      { status: 502 }
    );
  }

  const contentType =
    generatedVideoResponse.headers.get("content-type") || "video/mp4";
  const extension = resolveExtension(contentType, generatedVideoUrl);
  const assetId = crypto.randomUUID();
  const assetName = buildAssetName(prompt);
  const filename = `ai-video-${Date.now()}.${extension}`;
  const storagePath = buildStoragePath(user.id, assetId, filename);

  const { error: uploadError } = await supabaseServer.storage
    .from(SUPABASE_BUCKET)
    .upload(storagePath, videoBuffer, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: "Failed to upload generated video to storage." },
      { status: 502 }
    );
  }

  const width =
    toFiniteNumber(falVideo?.width) ?? toFiniteNumber(falData.width) ?? null;
  const height =
    toFiniteNumber(falVideo?.height) ?? toFiniteNumber(falData.height) ?? null;
  const aspectRatioValue = width && height ? width / height : null;

  const { error: insertError } = await supabaseServer.from("assets").insert({
    id: assetId,
    user_id: user.id,
    name: assetName,
    kind: "video",
    source: "generated",
    storage_bucket: SUPABASE_BUCKET,
    storage_path: storagePath,
    external_url: null,
    mime_type: contentType,
    size_bytes: videoBuffer.byteLength,
    duration_seconds: duration,
    width,
    height,
    aspect_ratio: aspectRatioValue,
  });

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to save generated video metadata." },
      { status: 502 }
    );
  }

  const { data: signedData, error: signedError } = await supabaseServer.storage
    .from(SUPABASE_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json(
      { error: "Failed to create generated video URL." },
      { status: 502 }
    );
  }

  const persistedVideoUrl = signedData.signedUrl;

  return NextResponse.json({
    ...falData,
    video: {
      ...(falVideo ?? {}),
      url: persistedVideoUrl,
      content_type: contentType,
    },
    video_url: persistedVideoUrl,
    asset: {
      id: assetId,
      url: persistedVideoUrl,
      name: assetName,
      size: videoBuffer.byteLength,
      duration,
      width: width ?? undefined,
      height: height ?? undefined,
      aspectRatio: aspectRatioValue ?? undefined,
      mimeType: contentType,
    },
  });
}
