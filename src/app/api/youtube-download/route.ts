import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SUPABASE_BUCKET = "youtube-downloads";
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

// Upload video buffer to Supabase storage
const uploadToSupabase = async (
  buffer: ArrayBuffer,
  fileName: string,
  contentType: string
): Promise<string | null> => {
  const { data, error } = await supabaseServer.storage
    .from(SUPABASE_BUCKET)
    .upload(fileName, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error("Supabase upload error:", error);
    return null;
  }

  const { data: publicUrlData } = supabaseServer.storage
    .from(SUPABASE_BUCKET)
    .getPublicUrl(data.path);

  return publicUrlData.publicUrl;
};

// Extract video ID from YouTube URL
const extractVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// Get video info using oEmbed (free, no auth needed)
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

// Find download URL from actor result
const findDownloadUrl = (item: ApifyResultItem): string | null => {
  // Check common field names for download URL
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

// Add token to Apify URLs if needed
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

  let payload: { url?: string; quality?: string; format?: string } | null = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const url = typeof payload?.url === "string" ? payload.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "Missing url." }, { status: 400 });
  }

  const videoId = extractVideoId(url);
  const requestedFormat = resolveFormat(payload?.format, payload?.quality);

  try {
    // Get video title via oEmbed first
    const videoInfo = await getVideoInfo(url);
    const title = videoInfo?.title ?? "YouTube video";

    const standbyUrl = new URL(YOUTUBE_DOWNLOADER_STANDBY_URL);
    if (!standbyUrl.searchParams.has("token")) {
      standbyUrl.searchParams.set("token", apiToken);
    }

    console.log("Calling YouTube downloader standby actor:", standbyUrl.origin);

    const videoFormatOrder = ["1080", "720", "480", "360", "240", "144"];
    const formatCandidates =
      requestedFormat === "mp3"
        ? ["mp3"]
        : (() => {
            const startIndex = videoFormatOrder.indexOf(requestedFormat);
            return startIndex >= 0
              ? videoFormatOrder.slice(startIndex)
              : videoFormatOrder;
          })();

    let downloadUrl: string | null = null;
    let downloadResponse: Response | null = null;
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

      // Check actor response for download URL
      for (const item of result.items) {
        const itemUrl = findDownloadUrl(item);
        if (itemUrl) {
          const urlWithToken = addApifyToken(itemUrl, apiToken);
          try {
            const response = await fetch(urlWithToken);
            if (response.ok && response.body) {
              downloadUrl = urlWithToken;
              downloadResponse = response;
              items = result.items;
              resolvedFormat = candidateFormat;
              console.log("Found download URL in actor response:", downloadUrl);
              break;
            }
          } catch (err) {
            console.error("Failed to fetch from actor URL:", err);
          }
        }
      }

      if (downloadResponse && downloadUrl) {
        break;
      }

      lastError = "No downloadable video URL found in actor results.";
    }

    if (!downloadResponse || !downloadUrl || items.length === 0) {
      // Log what we got for debugging
      if (items.length > 0) {
        console.error("No downloadable video found. Items received:", items);
      }
      return NextResponse.json(
        { error: lastError },
        { status: 502 }
      );
    }

    const contentType = downloadResponse.headers.get("content-type") || "video/mp4";
    const videoBuffer = await downloadResponse.arrayBuffer();
    const fileSize = videoBuffer.byteLength;

    if (fileSize === 0) {
      return NextResponse.json(
        { error: "Downloaded video file is empty." },
        { status: 502 }
      );
    }

    const firstItem = items[0] || {};
    const resolvedFilename = resolveFilename(firstItem.filename);
    const extension = resolveExtension(downloadUrl, contentType, resolvedFilename);

    // Upload to Supabase
    const baseName = videoId ? `yt-${videoId}` : `yt-${Date.now()}`;
    const fileName = `${baseName}-${Date.now()}.${extension}`;

    const publicUrl = await uploadToSupabase(videoBuffer, fileName, contentType);

    if (!publicUrl) {
      return NextResponse.json(
        { error: "Failed to upload video to storage." },
        { status: 502 }
      );
    }

    // Get metadata from first item if available

    return NextResponse.json({
      title: getString(firstItem.title) || title,
      videoId: videoId ?? null,
      downloadUrl,
      assetUrl: publicUrl,
      durationSeconds: typeof firstItem.duration === "number" ? firstItem.duration : null,
      width: typeof firstItem.width === "number" ? firstItem.width : null,
      height: typeof firstItem.height === "number" ? firstItem.height : null,
      size: fileSize,
      qualityLabel:
        getString(firstItem.quality) ||
        (resolvedFormat === "mp3" ? "mp3" : `${resolvedFormat}p`),
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Unable to download video.";
    console.error("YouTube download error:", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
