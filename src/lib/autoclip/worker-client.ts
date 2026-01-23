/**
 * Client for communicating with the AutoClip worker service.
 * The worker handles video processing (FFmpeg, transcription, rendering)
 * while the main app runs on Vercel.
 */

const WORKER_URL = process.env.AUTOCLIP_WORKER_URL || "http://localhost:3001";
const WORKER_SECRET = process.env.AUTOCLIP_WORKER_SECRET || "dev-secret";

async function workerFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${WORKER_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${WORKER_SECRET}`,
    },
  });
  return response;
}

export interface UploadResult {
  sessionId: string;
  videoKey: string;
  metadata: {
    duration: number;
    width: number | null;
    height: number | null;
    size: number;
  };
}

export interface TranscribeResult {
  segments: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  words: Array<{
    start: number;
    end: number;
    word: string;
  }>;
  text: string;
  language: string;
}

export interface RenderResult {
  outputs: Array<{
    index: number;
    clipKey: string;
    downloadUrl: string;
    filename: string;
  }>;
}

export interface PreviewResult {
  previewUrl: string;
  previewKey: string;
}

/**
 * Upload a video file to the worker
 */
export async function uploadVideo(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("video", file);

  const response = await workerFetch("/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Upload failed");
  }

  return response.json();
}

/**
 * Download a YouTube video
 */
export async function downloadYouTube(url: string): Promise<UploadResult> {
  const response = await workerFetch("/youtube", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "YouTube download failed");
  }

  return response.json();
}

/**
 * Transcribe a video
 */
export async function transcribeVideo(
  sessionId: string,
  videoKey: string,
  language = "en"
): Promise<TranscribeResult> {
  const response = await workerFetch("/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, videoKey, language }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Transcription failed");
  }

  return response.json();
}

/**
 * Render video clips
 */
export async function renderClips(
  sessionId: string,
  videoKey: string,
  clips: Array<{ start: number; end: number; highlightIndex: number }>,
  quality: "high" | "medium" | "low" = "high"
): Promise<RenderResult> {
  const response = await workerFetch("/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, videoKey, clips, quality }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Render failed");
  }

  return response.json();
}

/**
 * Generate a preview clip
 */
export async function generatePreview(
  sessionId: string,
  videoKey: string,
  start: number,
  end: number
): Promise<PreviewResult> {
  const response = await workerFetch("/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, videoKey, start, end }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Preview generation failed");
  }

  return response.json();
}

/**
 * Get a signed download URL for a file
 */
export async function getDownloadUrl(key: string): Promise<string> {
  const response = await workerFetch("/download-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get download URL");
  }

  const data = await response.json();
  return data.url;
}

/**
 * Clean up session files
 */
export async function cleanupSession(sessionId: string): Promise<void> {
  const response = await workerFetch("/cleanup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Cleanup failed");
  }
}

/**
 * Check worker health
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${WORKER_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
