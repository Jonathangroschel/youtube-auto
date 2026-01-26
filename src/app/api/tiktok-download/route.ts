import { NextResponse } from "next/server";
import crypto from "crypto";
import { ApifyClient } from "apify-client";
import { supabaseServer } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server-client";

export const runtime = "nodejs";

const SUPABASE_BUCKET = "user-assets";
const TIKTOK_ACTOR_ID = "cheapget/tiktok-video-downloader";
const DEFAULT_TIKTOK_QUALITY = "high";

const sanitizeFilename = (value: string) => {
  const trimmed = value.trim() || "asset";
  const sanitized = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  const collapsed = sanitized.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return collapsed || "asset";
};

const buildStoragePath = (userId: string, assetId: string, filename: string) =>
  `${userId}/assets/${assetId}/${sanitizeFilename(filename)}`;

// Upload video buffer to Supabase storage
const uploadToSupabase = async (
  buffer: ArrayBuffer,
  path: string,
  contentType: string
): Promise<string | null> => {
  const { error } = await supabaseServer.storage
    .from(SUPABASE_BUCKET)
    .upload(path, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error("Supabase upload error:", error);
    return null;
  }

  return path;
};

type TikTokVideoInfo = {
  width?: number;
  height?: number;
  duration?: number | string;
  downloadAddr?: string;
  playAddr?: string;
};

type TikTokResultItem = Record<string, unknown> & {
  videoTitle?: string;
  videoUrl?: string;
  videoUrlNoWatermark?: string;
  videoFileUrl?: string;
  downloadUrl?: string;
  video_url?: string;
  title?: string;
  duration?: number | string;
  width?: number;
  height?: number;
  filesize_kb?: number;
  desc?: string;
  description?: string;
  text?: string;
  authorUsername?: string;
  authorNickname?: string;
  video?: TikTokVideoInfo;
};

const normalizeNumber = (value: unknown) => {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
};

const normalizeDurationSeconds = (value: unknown) => {
  const parsed = normalizeNumber(value);
  if (parsed == null) {
    return null;
  }
  return parsed > 1000 ? parsed / 1000 : parsed;
};

const getString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const resolveTikTokVideoUrl = (item: TikTokResultItem) => {
  const candidates = [
    item.video_url,
    item.videoFileUrl,
    item.videoUrl,
    item.videoUrlNoWatermark,
    item.downloadUrl,
  ];
  for (const candidate of candidates) {
    const resolved = getString(candidate);
    if (resolved) {
      return resolved;
    }
  }
  const video = item.video;
  if (video && typeof video === "object") {
    const downloadAddr = getString(video.downloadAddr);
    if (downloadAddr) {
      return downloadAddr;
    }
    const playAddr = getString(video.playAddr);
    if (playAddr) {
      return playAddr;
    }
  }
  const extraKeys = [
    "videoFile",
    "videoFileUrl",
    "videoUrlWithWatermark",
    "playUrl",
    "url",
  ];
  for (const key of extraKeys) {
    const resolved = getString(item[key]);
    if (resolved) {
      return resolved;
    }
  }
  return null;
};

const resolveTikTokTitle = (item: TikTokResultItem) => {
  return (
    getString(item.title) ??
    getString(item.videoTitle) ??
    getString(item.desc) ??
    getString(item.description) ??
    getString(item.text) ??
    "TikTok video"
  );
};

const resolveExtension = (url: string, contentType: string | null) => {
  const loweredType = (contentType ?? "").toLowerCase();
  if (loweredType.includes("webm")) {
    return "webm";
  }
  if (loweredType.includes("mp4")) {
    return "mp4";
  }
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith(".webm")) {
      return "webm";
    }
    if (pathname.endsWith(".mp4")) {
      return "mp4";
    }
    if (pathname.endsWith(".mov")) {
      return "mov";
    }
  } catch {
    // Ignore malformed URLs and fall back to mp4.
  }
  return "mp4";
};

const readDatasetItem = async (client: ApifyClient, datasetId: string) => {
  const retries = [0, 400, 900];
  for (const delay of retries) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    const { items } = await client.dataset(datasetId).listItems({ limit: 1 });
    if (Array.isArray(items) && items.length > 0) {
      return items[0] as TikTokResultItem;
    }
  }
  return null;
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: { url?: string } | null = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const url = typeof payload?.url === "string" ? payload.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "Missing url." }, { status: 400 });
  }

  try {
    const client = new ApifyClient({ token: apiToken });
    const qualityCandidates = Array.from(
      new Set([DEFAULT_TIKTOK_QUALITY, "medium", "low"])
    );
    let item: TikTokResultItem | null = null;
    let videoUrl: string | null = null;
    let downloadBuffer: ArrayBuffer | null = null;
    let downloadContentType: string | null = null;
    let lastError = "Downloader returned no results.";

    for (const candidate of qualityCandidates) {
      const run = await client.actor(TIKTOK_ACTOR_ID).call({
        video_url: url,
        video_quality: candidate,
      });

      if (!run?.defaultDatasetId) {
        lastError = "Downloader did not return dataset results.";
        continue;
      }

      item = await readDatasetItem(client, run.defaultDatasetId);
      if (!item) {
        lastError = "Downloader returned no results.";
        continue;
      }

      videoUrl = resolveTikTokVideoUrl(item);
      if (!videoUrl) {
        lastError = "No downloadable video file found.";
        continue;
      }

      try {
        const parsedUrl = new URL(videoUrl);
        if (
          parsedUrl.hostname.endsWith("apify.com") &&
          !parsedUrl.searchParams.has("token")
        ) {
          parsedUrl.searchParams.set("token", apiToken);
          videoUrl = parsedUrl.toString();
        }
      } catch {
        // Ignore malformed URLs and attempt to fetch as-is.
      }

      const downloadResult = await fetchDownloadBuffer(videoUrl);
      if (downloadResult) {
        downloadBuffer = downloadResult.buffer;
        downloadContentType = downloadResult.contentType;
        break;
      }

      lastError = "Unable to download video file.";
    }

    if (!item || !videoUrl || !downloadBuffer) {
      return NextResponse.json({ error: lastError }, { status: 502 });
    }

    const contentType = downloadContentType || "video/mp4";
    const extension = resolveExtension(videoUrl, contentType);
    
    // Download video to buffer
    const videoBuffer = downloadBuffer;
    const fileSize = videoBuffer.byteLength;

    // Upload to Supabase
    const fileName = `tt-${Date.now()}.${extension}`;
    const assetId = crypto.randomUUID();
    const storagePath = buildStoragePath(user.id, assetId, fileName);
    const storedPath = await uploadToSupabase(
      videoBuffer,
      storagePath,
      contentType
    );

    if (!storedPath) {
      return NextResponse.json(
        { error: "Failed to upload video to storage." },
        { status: 502 }
      );
    }

    const width =
      normalizeNumber(item.video?.width) ??
      normalizeNumber(item.width) ??
      normalizeNumber(item.videoWidth) ??
      null;
    const height =
      normalizeNumber(item.video?.height) ??
      normalizeNumber(item.height) ??
      normalizeNumber(item.videoHeight) ??
      null;
    const durationSeconds =
      normalizeDurationSeconds(item.video?.duration) ??
      normalizeDurationSeconds(item.duration) ??
      normalizeDurationSeconds(item.videoDuration) ??
      null;

    const aspectRatio =
      width && height ? width / height : null;

    const { error: insertError } = await supabaseServer.from("assets").insert({
      id: assetId,
      user_id: user.id,
      name: resolveTikTokTitle(item),
      kind: "video",
      source: "external",
      storage_bucket: SUPABASE_BUCKET,
      storage_path: storedPath,
      external_url: null,
      mime_type: contentType,
      size_bytes: fileSize,
      duration_seconds: durationSeconds,
      width,
      height,
      aspect_ratio: aspectRatio,
    });

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to save asset metadata." },
        { status: 502 }
      );
    }

    const { data: signedData } = await supabaseServer.storage
      .from(SUPABASE_BUCKET)
      .createSignedUrl(storedPath, 60 * 60);
    const assetUrl = signedData?.signedUrl || "";
    if (!assetUrl) {
      return NextResponse.json(
        { error: "Failed to generate asset URL." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      title: resolveTikTokTitle(item),
      downloadUrl: videoUrl,
      assetId,
      assetUrl,
      durationSeconds,
      width,
      height,
      size: fileSize,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Unable to download video.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
