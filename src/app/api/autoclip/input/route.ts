import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabase/server";
import { getSession, updateSessionStatus } from "@/lib/autoclip/session-store";

export const runtime = "nodejs";
export const maxDuration = 300;

const WORKER_URL = process.env.AUTOCLIP_WORKER_URL || "http://localhost:3001";
const WORKER_SECRET = process.env.AUTOCLIP_WORKER_SECRET || "dev-secret";
const BUCKET = "autoclip-files";
const YOUTUBE_DOWNLOADER_STANDBY_URL =
  process.env.APIFY_YOUTUBE_DOWNLOADER_STANDBY_URL ||
  "https://youtube-download-api--youtube-video-downloader.apify.actor";

type ApifyResultItem = {
  title?: string;
  videoId?: string;
  duration?: number;
  width?: number;
  height?: number;
  filename?: string;
  downloadUrl?: string;
  videoUrl?: string;
  fileUrl?: string;
  url?: string;
  quality?: string;
  [key: string]: unknown;
};

const getVideoInfo = async (url: string): Promise<{ title: string } | null> => {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);
    if (response.ok) {
      const data = await response.json();
      return { title: data.title || "YouTube video" };
    }
  } catch {
    // Ignore errors
  }
  return null;
};

const getString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const resolveFormat = (formatValue: unknown, qualityValue: unknown): string => {
  const allowedFormats = new Set([
    "1080",
    "720",
    "480",
    "360",
    "240",
    "144",
    "mp3",
  ]);
  const normalizedFormat =
    typeof formatValue === "string" ? formatValue.trim().toLowerCase() : "";
  if (allowedFormats.has(normalizedFormat)) {
    return normalizedFormat;
  }

  const qualityMap: Record<string, string> = {
    high: "1080",
    medium: "720",
    low: "480",
  };
  const normalizedQuality =
    typeof qualityValue === "string" ? qualityValue.trim().toLowerCase() : "";
  return qualityMap[normalizedQuality] || "1080";
};

const findDownloadUrl = (item: ApifyResultItem): string | null => {
  const urlFields = [
    "downloadUrl",
    "videoUrl",
    "fileUrl",
    "url",
    "video_url",
    "download_url",
    "file_url",
    "streamUrl",
    "stream_url",
    "videoFileUrl",
  ];

  for (const field of urlFields) {
    const value = getString(item[field]);
    if (value && (value.startsWith("http://") || value.startsWith("https://"))) {
      return value;
    }
  }

  return null;
};

const resolveFilename = (value: unknown): string | null => {
  const resolved = getString(value);
  return resolved?.includes("/") ? resolved.split("/").pop() ?? null : resolved;
};

const resolveExtension = (
  downloadUrl: string,
  contentType: string | null,
  filename: string | null
): string => {
  const loweredType = (contentType ?? "").toLowerCase();
  if (loweredType.includes("audio/mpeg") || loweredType.includes("audio/mp3")) {
    return "mp3";
  }
  if (loweredType.includes("audio/")) {
    return "mp3";
  }
  if (loweredType.includes("webm")) {
    return "webm";
  }
  if (loweredType.includes("mp4")) {
    return "mp4";
  }

  const candidate = filename ?? downloadUrl;
  try {
    const pathname = candidate.startsWith("http")
      ? new URL(candidate).pathname
      : candidate;
    const lowerPath = pathname.toLowerCase();
    if (lowerPath.endsWith(".mp3")) {
      return "mp3";
    }
    if (lowerPath.endsWith(".webm")) {
      return "webm";
    }
    if (lowerPath.endsWith(".mp4")) {
      return "mp4";
    }
    if (lowerPath.endsWith(".mov")) {
      return "mov";
    }
  } catch {
    // Ignore malformed URLs and fall back to mp4.
  }
  return "mp4";
};

const normalizeActorItems = (data: unknown): ApifyResultItem[] => {
  if (Array.isArray(data)) {
    return data.filter((item) => item && typeof item === "object") as ApifyResultItem[];
  }
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.items)) {
      return record.items.filter((item) => item && typeof item === "object") as ApifyResultItem[];
    }
    if (record.data && typeof record.data === "object") {
      const nested = record.data as Record<string, unknown>;
      if (Array.isArray(nested.items)) {
        return nested.items.filter((item) => item && typeof item === "object") as ApifyResultItem[];
      }
      return [nested as ApifyResultItem];
    }
    return [record as ApifyResultItem];
  }
  return [];
};

const requestStandbyItems = async (
  standbyUrl: string,
  url: string,
  format: string
): Promise<{ items: ApifyResultItem[]; error?: string }> => {
  const actorResponse = await fetch(standbyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, format }),
  });

  if (!actorResponse.ok) {
    let errorDetail = `Downloader request failed (${actorResponse.status}).`;
    try {
      const errorPayload = await actorResponse.json();
      errorDetail =
        getString((errorPayload as Record<string, unknown>)?.error) ||
        getString((errorPayload as Record<string, unknown>)?.message) ||
        getString((errorPayload as Record<string, unknown>)?.detail) ||
        errorDetail;
    } catch {
      // Ignore JSON parse errors and fall back to status message.
    }
    return { items: [], error: errorDetail };
  }

  let actorPayload: unknown = null;
  try {
    actorPayload = await actorResponse.json();
  } catch {
    return { items: [], error: "Downloader response was not valid JSON." };
  }

  const items = normalizeActorItems(actorPayload);
  if (items.length === 0) {
    return { items: [], error: "Downloader returned no results." };
  }

  return { items };
};

const fetchDownloadBuffer = async (
  downloadUrl: string
): Promise<{ buffer: ArrayBuffer; contentType: string | null } | null> => {
  const retries = [0, 800, 1600, 2600];
  for (const delay of retries) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    let response: Response | null = null;
    try {
      response = await fetch(downloadUrl);
    } catch (error) {
      console.warn("Download fetch failed:", error);
      continue;
    }
    if (!response.ok || !response.body) {
      continue;
    }
    const contentLength = response.headers.get("content-length");
    if (contentLength === "0") {
      continue;
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) {
      continue;
    }
    return { buffer, contentType: response.headers.get("content-type") };
  }
  return null;
};

const addApifyToken = (videoUrl: string, apiToken: string): string => {
  try {
    const parsedUrl = new URL(videoUrl);
    if (
      parsedUrl.hostname.endsWith("apify.com") &&
      !parsedUrl.searchParams.has("token")
    ) {
      parsedUrl.searchParams.set("token", apiToken);
      return parsedUrl.toString();
    }
  } catch {
    // Ignore malformed URLs
  }
  return videoUrl;
};

export async function POST(request: Request) {
  const apiToken =
    process.env.APIFY_API_TOKEN ||
    process.env.APIFY_TOKEN ||
    process.env.APIFY_KEY;

  if (!apiToken) {
    return NextResponse.json(
      { error: "Missing APIFY_API_TOKEN." },
      { status: 500 }
    );
  }

  let payload:
    | { sessionId?: string; url?: string; quality?: string; format?: string }
    | null = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const sessionId =
    typeof payload?.sessionId === "string" ? payload.sessionId.trim() : "";
  const url = typeof payload?.url === "string" ? payload.url.trim() : "";
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }
  if (!url) {
    return NextResponse.json({ error: "Missing url." }, { status: 400 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const requestedFormat = resolveFormat(payload?.format, payload?.quality);
  if (requestedFormat === "mp3") {
    return NextResponse.json(
      { error: "Audio-only downloads are not supported for AutoClip." },
      { status: 400 }
    );
  }

  try {
    const videoInfo = await getVideoInfo(url);
    const standbyUrl = new URL(YOUTUBE_DOWNLOADER_STANDBY_URL);
    if (!standbyUrl.searchParams.has("token")) {
      standbyUrl.searchParams.set("token", apiToken);
    }

    const videoFormatOrder = ["1080", "720", "480", "360", "240", "144"];
    const formatCandidates = (() => {
      const startIndex = videoFormatOrder.indexOf(requestedFormat);
      return startIndex >= 0
        ? videoFormatOrder.slice(startIndex)
        : videoFormatOrder;
    })();

    let downloadUrl: string | null = null;
    let downloadBuffer: ArrayBuffer | null = null;
    let downloadContentType: string | null = null;
    let items: ApifyResultItem[] = [];
    let resolvedFormat = requestedFormat;
    let lastError = "Downloader returned no results.";

    for (const candidateFormat of formatCandidates) {
      const result = await requestStandbyItems(
        standbyUrl.toString(),
        url,
        candidateFormat
      );
      if (!result.items.length) {
        if (result.error) {
          lastError = result.error;
        }
        continue;
      }

      for (const item of result.items) {
        const itemUrl = findDownloadUrl(item);
        if (itemUrl) {
          const urlWithToken = addApifyToken(itemUrl, apiToken);
          const downloadResult = await fetchDownloadBuffer(urlWithToken);
          if (downloadResult) {
            downloadUrl = urlWithToken;
            downloadBuffer = downloadResult.buffer;
            downloadContentType = downloadResult.contentType;
            items = result.items;
            resolvedFormat = candidateFormat;
            break;
          }
        }
      }

      if (downloadBuffer && downloadUrl) {
        break;
      }

      lastError = "No downloadable video URL found in actor results.";
    }

    if (!downloadBuffer || !downloadUrl || items.length === 0) {
      if (items.length > 0) {
        console.error("No downloadable video found. Items received:", items);
      }
      return NextResponse.json({ error: lastError }, { status: 502 });
    }

    const contentType = downloadContentType || "video/mp4";
    const fileSize = downloadBuffer.byteLength;
    if (fileSize === 0) {
      return NextResponse.json(
        { error: "Downloaded video file is empty." },
        { status: 502 }
      );
    }

    const firstItem = items[0] || {};
    const resolvedFilename = resolveFilename(firstItem.filename);
    const extension = resolveExtension(downloadUrl, contentType, resolvedFilename);
    const workerSessionId = crypto.randomUUID().slice(0, 8);
    const videoKey = `sessions/${workerSessionId}/input.${extension}`;

    const { error } = await supabaseServer.storage
      .from(BUCKET)
      .upload(videoKey, downloadBuffer, {
        contentType,
        upsert: true,
      });
    if (error) {
      return NextResponse.json(
        { error: "Failed to upload video to storage." },
        { status: 502 }
      );
    }

    let duration =
      typeof firstItem.duration === "number" ? firstItem.duration : null;
    let width = typeof firstItem.width === "number" ? firstItem.width : null;
    let height = typeof firstItem.height === "number" ? firstItem.height : null;

    if (duration == null || width == null || height == null) {
      try {
        const response = await fetch(`${WORKER_URL}/metadata`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${WORKER_SECRET}`,
          },
          body: JSON.stringify({
            sessionId: workerSessionId,
            videoKey,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          const metadata = data.metadata || {};
          if (typeof metadata.duration === "number") {
            duration = metadata.duration;
          }
          if (typeof metadata.width === "number") {
            width = metadata.width;
          }
          if (typeof metadata.height === "number") {
            height = metadata.height;
          }
        }
      } catch {
        // Metadata fetch is optional, continue without it.
      }
    }

    const title =
      getString(firstItem.title) ||
      videoInfo?.title ||
      "YouTube video";

    session.workerSessionId = workerSessionId;
    session.input = {
      sourceType: "youtube",
      sourceUrl: url,
      videoKey,
      title,
      originalFilename: resolvedFilename || undefined,
      durationSeconds: duration,
      width,
      height,
      sizeBytes: fileSize,
    };
    session.transcript = undefined;
    session.highlights = undefined;
    session.preview = undefined;
    session.outputs = undefined;
    session.approvedHighlightIndexes = [];
    session.removedHighlightIndexes = [];
    session.error = null;

    await updateSessionStatus(
      session,
      "input_ready",
      "YouTube video downloaded."
    );

    return NextResponse.json({
      sessionId: session.id,
      input: session.input,
      qualityLabel:
        getString(firstItem.quality) ||
        (resolvedFormat === "mp3" ? "mp3" : `${resolvedFormat}p`),
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Unable to download video.";
    session.status = "error";
    session.error = message;
    await updateSessionStatus(session, "error", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
