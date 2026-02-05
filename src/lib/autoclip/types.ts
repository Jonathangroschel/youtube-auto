export type AutoClipStatus =
  | "created"
  | "input_ready"
  | "transcribing"
  | "transcribed"
  | "highlights_ready"
  | "awaiting_approval"
  | "approved"
  | "rendering"
  | "complete"
  | "error";

export type AutoClipSourceType = "youtube" | "file";

export type AutoClipInput = {
  sourceType: AutoClipSourceType;
  sourceUrl?: string;
  localPath?: string;
  /** Storage key in Supabase (used by worker) */
  videoKey?: string;
  title?: string;
  originalFilename?: string;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number | null;
  /** Client-reported size before storage verification. */
  originalSizeBytes?: number | null;
};

export type TranscriptWord = {
  start: number;
  end: number;
  text: string;
};

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
  words?: TranscriptWord[];
};

export type TranscriptBundle = {
  language?: string | null;
  segments: TranscriptSegment[];
  raw?: unknown;
};

export type AutoClipHighlight = {
  start: number;
  end: number;
  content: string;
  title?: string;
};

export type AutoClipOutput = {
  filePath: string;
  filename: string;
  highlightIndex?: number;
  publicUrl?: string | null;
};

export type AutoClipPreview = AutoClipOutput & {
  start: number;
  end: number;
};

export type AutoClipOptions = {
  autoApprove: boolean;
  approvalTimeoutMs: number;
  quality: "auto" | "1080" | "720" | "480";
  subtitlesEnabled: boolean;
  fontName: string;
  fontPath?: string | null;
  cropMode: "auto" | "face" | "screen";
};

export type AutoClipSession = {
  id: string;
  status: AutoClipStatus;
  createdAt: string;
  updatedAt: string;
  tempDir: string;
  /** Worker session ID from Railway worker */
  workerSessionId?: string;
  input?: AutoClipInput;
  transcript?: TranscriptBundle;
  highlights?: AutoClipHighlight[];
  approvedHighlightIndexes?: number[];
  removedHighlightIndexes?: number[];
  preview?: AutoClipPreview;
  outputs?: AutoClipOutput[];
  options: AutoClipOptions;
  error?: string | null;
  logs: string[];
};
