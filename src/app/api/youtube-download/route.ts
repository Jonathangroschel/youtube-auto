import { NextResponse } from "next/server";
import { ApifyClient } from "apify-client";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

type YoutubeFormat = {
  url?: string;
  width?: number;
  height?: number;
  bitrate?: number;
  mimeType?: string;
  audioQuality?: string;
  qualityLabel?: string;
  quality?: string;
  contentLength?: string | number;
  approxDurationMs?: string | number;
};

type YoutubeVideoInfo = {
  title?: string;
  lengthSeconds?: string | number;
  formats?: YoutubeFormat[];
  adaptiveFormats?: YoutubeFormat[];
};

type YoutubeResultItem = {
  status?: string;
  videoId?: string;
  videoInfo?: YoutubeVideoInfo;
  videoFileUrl?: string;
  downloadUrl?: string;
  videoUrl?: string;
  url?: string;
};

const normalizeNumber = (value: unknown) => {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
};

const isVideoFormat = (format: YoutubeFormat) => {
  if (format.width && format.height) {
    return true;
  }
  if (typeof format.mimeType === "string") {
    return format.mimeType.includes("video");
  }
  return false;
};

const hasAudioTrack = (format: YoutubeFormat) => {
  if (typeof format.audioQuality === "string") {
    return true;
  }
  if (typeof format.mimeType === "string") {
    return format.mimeType.includes("audio");
  }
  return false;
};

const maxPreferredHeight = 1080;

const isMp4Format = (format: YoutubeFormat) =>
  typeof format.mimeType === "string" && format.mimeType.includes("mp4");

const buildFormatCandidates = (
  formats: YoutubeFormat[],
  adaptiveFormats: YoutubeFormat[]
) => {
  const all = [...formats, ...adaptiveFormats].filter((format) => {
    return (
      isVideoFormat(format) &&
      typeof format.url === "string" &&
      format.url.length > 0
    );
  });
  const withAudio = all.filter((format) => hasAudioTrack(format));
  const withoutAudio = all.filter((format) => !hasAudioTrack(format));
  const sortByPreference = (items: YoutubeFormat[]) =>
    [...items].sort((a, b) => {
      const aHeight = a.height ?? 0;
      const bHeight = b.height ?? 0;
      const aOver = aHeight > maxPreferredHeight;
      const bOver = bHeight > maxPreferredHeight;
      if (aOver !== bOver) {
        return aOver ? 1 : -1;
      }
      if (aHeight !== bHeight) {
        return bHeight - aHeight;
      }
      const aMp4 = isMp4Format(a);
      const bMp4 = isMp4Format(b);
      if (aMp4 !== bMp4) {
        return aMp4 ? -1 : 1;
      }
      const aSize =
        normalizeNumber(a.contentLength) ?? Number.POSITIVE_INFINITY;
      const bSize =
        normalizeNumber(b.contentLength) ?? Number.POSITIVE_INFINITY;
      if (aSize !== bSize) {
        return aSize - bSize;
      }
      return (b.bitrate ?? 0) - (a.bitrate ?? 0);
    });
  return [...sortByPreference(withAudio), ...sortByPreference(withoutAudio)];
};

const resolveExtension = (
  format?: YoutubeFormat | null,
  contentType?: string | null
) => {
  const resolvedType = contentType ?? format?.mimeType ?? "";
  const lowered = resolvedType.toLowerCase();
  if (lowered.includes("webm")) {
    return "webm";
  }
  if (lowered.includes("mp4")) {
    return "mp4";
  }
  const mimeType = format?.mimeType ?? "";
  if (mimeType.includes("webm")) {
    return "webm";
  }
  return "mp4";
};

const readDatasetItem = async (
  client: ApifyClient,
  datasetId: string
) => {
  const retries = [0, 400, 900];
  for (const delay of retries) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    const { items } = await client.dataset(datasetId).listItems({ limit: 1 });
    if (Array.isArray(items) && items.length > 0) {
      return items[0] as YoutubeResultItem;
    }
  }
  return null;
};

const getString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

// Check for pre-stored video URLs (Apify storage or other CDN)
const resolveStoredVideoUrl = (item: YoutubeResultItem): string | null => {
  const candidates = [
    item.videoFileUrl,
    item.downloadUrl,
    item.videoUrl,
    item.url,
  ];
  for (const candidate of candidates) {
    const resolved = getString(candidate);
    if (resolved) {
      return resolved;
    }
  }
  return null;
};

// Try to get video from key-value store
const tryGetKeyValueStoreVideo = async (
  client: ApifyClient,
  runId: string,
  apiToken: string
): Promise<{ url: string; contentType: string | null } | null> => {
  const possibleKeys = ["OUTPUT", "video", "VIDEO", "output", "file", "download"];
  
  for (const key of possibleKeys) {
    try {
      const kvStoreUrl = `https://api.apify.com/v2/actor-runs/${runId}/key-value-store/records/${key}?token=${apiToken}`;
      const headResponse = await fetch(kvStoreUrl, { method: "HEAD" });
      if (headResponse.ok) {
        const contentType = headResponse.headers.get("content-type");
        if (contentType?.includes("video") || contentType?.includes("octet-stream")) {
          return { url: kvStoreUrl, contentType };
        }
      }
    } catch {
      continue;
    }
  }
  return null;
};

const SUPABASE_BUCKET = "youtube-downloads";

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

const fetchYoutubeStream = async (url: string) =>
  fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.youtube.com/",
      Origin: "https://www.youtube.com",
      Range: "bytes=0-",
    },
  });

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

  let payload: { url?: string; location?: string } | null = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const url =
    typeof payload?.url === "string" ? payload.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "Missing url." }, { status: 400 });
  }

  const fallbackLocation = process.env.APIFY_DEFAULT_LOCATION ?? "US";
  const locationInput =
    typeof payload?.location === "string" && payload.location.trim().length > 0
      ? payload.location
      : fallbackLocation;
  const location = locationInput.trim().toUpperCase();

  try {
    const client = new ApifyClient({ token: apiToken });
    const run = await client
      .actor("thenetaji/youtube-video-downloader-advanced")
      .call({
        urls: [{ url }],
        location,
        downloadVideo: true, // Request the actor to download and store the video
      });

    if (!run?.defaultDatasetId) {
      return NextResponse.json(
        { error: "Downloader did not return dataset results." },
        { status: 502 }
      );
    }

    const item = await readDatasetItem(client, run.defaultDatasetId);
    if (!item) {
      return NextResponse.json(
        { error: "Downloader returned no results." },
        { status: 502 }
      );
    }

    const status =
      typeof item.status === "string" ? item.status.toLowerCase() : null;
    const videoInfo =
      item.videoInfo ?? (item as { data?: YoutubeResultItem }).data?.videoInfo ?? {};
    const hasVideoInfo = Object.keys(videoInfo).length > 0;
    if (status && status !== "success" && !hasVideoInfo) {
      return NextResponse.json(
        { error: "Unable to download this video." },
        { status: 502 }
      );
    }

    const durationSeconds =
      normalizeNumber(videoInfo.lengthSeconds) ??
      null;

    // Strategy 1: Check if the actor returned a stored video URL (Apify storage)
    let downloadResponse: Response | null = null;
    let finalVideoUrl: string | null = null;
    let selectedFormat: YoutubeFormat | null = null;

    const storedUrl = resolveStoredVideoUrl(item);
    if (storedUrl) {
      const urlWithToken = addApifyToken(storedUrl, apiToken);
      try {
        const response = await fetch(urlWithToken);
        if (response.ok && response.body) {
          downloadResponse = response;
          finalVideoUrl = urlWithToken;
        }
      } catch {
        // Continue to other strategies
      }
    }

    // Strategy 2: Check key-value store for stored video file
    if (!downloadResponse && run.id) {
      const kvResult = await tryGetKeyValueStoreVideo(client, run.id, apiToken);
      if (kvResult) {
        try {
          const response = await fetch(kvResult.url);
          if (response.ok && response.body) {
            downloadResponse = response;
            finalVideoUrl = kvResult.url;
          }
        } catch {
          // Continue to next strategy
        }
      }
    }

    // Strategy 3: Try direct YouTube URLs (may not work on cloud servers)
    if (!downloadResponse) {
      const formats = Array.isArray(videoInfo.formats) ? videoInfo.formats : [];
      const adaptiveFormats = Array.isArray(videoInfo.adaptiveFormats)
        ? videoInfo.adaptiveFormats
        : [];

      const candidates = buildFormatCandidates(formats, adaptiveFormats);
      
      let lastStatus: number | null = null;
      for (const format of candidates) {
        const formatUrl = format.url;
        if (!formatUrl) {
          continue;
        }
        try {
          const response = await fetchYoutubeStream(formatUrl);
          lastStatus = response.status;
          if (!response.ok || !response.body) {
            continue;
          }
          selectedFormat = format;
          downloadResponse = response;
          finalVideoUrl = formatUrl;
          break;
        } catch {
          continue;
        }
      }

      if (!downloadResponse) {
        const suffix = lastStatus ? ` (status ${lastStatus})` : "";
        return NextResponse.json(
          { error: `Unable to download video file${suffix}. YouTube blocks cloud server IPs.` },
          { status: 502 }
        );
      }
    }

    if (!downloadResponse) {
      return NextResponse.json(
        { error: "Unable to download video file." },
        { status: 502 }
      );
    }

    const contentType = downloadResponse.headers.get("content-type") || "video/mp4";
    const extension = resolveExtension(selectedFormat, contentType);
    
    // Download video to buffer
    const videoBuffer = await downloadResponse.arrayBuffer();
    const fileSize = videoBuffer.byteLength;
    
    if (fileSize === 0) {
      return NextResponse.json(
        { error: "Downloaded video file is empty." },
        { status: 502 }
      );
    }

    // Upload to Supabase
    const baseName = item.videoId ? `yt-${item.videoId}` : `yt-${Date.now()}`;
    const fileName = `${baseName}-${Date.now()}.${extension}`;
    
    const publicUrl = await uploadToSupabase(videoBuffer, fileName, contentType);
    
    if (!publicUrl) {
      return NextResponse.json(
        { error: "Failed to upload video to storage." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      title: videoInfo.title ?? "YouTube video",
      videoId: item.videoId ?? null,
      downloadUrl: finalVideoUrl,
      assetUrl: publicUrl,
      durationSeconds: durationSeconds ?? null,
      width: selectedFormat?.width ?? null,
      height: selectedFormat?.height ?? null,
      size: fileSize,
      qualityLabel: selectedFormat?.qualityLabel ?? selectedFormat?.quality ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Unable to download video.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
