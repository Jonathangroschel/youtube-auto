import { NextResponse } from "next/server";
import { ApifyClient } from "apify-client";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SUPABASE_BUCKET = "youtube-downloads";

type ApifyResultItem = {
  title?: string;
  videoId?: string;
  duration?: number;
  width?: number;
  height?: number;
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

// Read dataset items with retries
const readDatasetItems = async (
  client: ApifyClient,
  datasetId: string
): Promise<ApifyResultItem[]> => {
  const retries = [0, 1000, 2000, 4000];
  for (const delay of retries) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    const { items } = await client.dataset(datasetId).listItems({ limit: 10 });
    if (Array.isArray(items) && items.length > 0) {
      return items as ApifyResultItem[];
    }
  }
  return [];
};

// Try to get video from key-value store
const tryGetKeyValueStoreVideo = async (
  runId: string,
  apiToken: string
): Promise<{ url: string; contentType: string | null } | null> => {
  const possibleKeys = ["OUTPUT", "video", "VIDEO", "output", "file", "download", "result"];
  
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

  let payload: { url?: string; quality?: string } | null = null;
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
  
  // Map quality names to resolution numbers
  const qualityMap: Record<string, string> = {
    high: "1080",
    medium: "720",
    low: "480",
  };
  const requestedQuality = payload?.quality?.toLowerCase() || "medium";
  const quality = qualityMap[requestedQuality] || "1080";

  try {
    // Get video title via oEmbed first
    const videoInfo = await getVideoInfo(url);
    const title = videoInfo?.title ?? "YouTube video";

    const client = new ApifyClient({ token: apiToken });
    
    // Start the YouTube downloader actor (z4hUd9qNTetQtzEcK)
    // Use start() instead of call() to avoid Vercel timeout issues
    console.log("Starting Apify actor for URL:", url, "Quality:", quality);
    const run = await client.actor("z4hUd9qNTetQtzEcK").start({
      urls: [{ url }],
      quality,
      proxy: { useApifyProxy: true },
    });

    if (!run?.id) {
      return NextResponse.json(
        { error: "Failed to start downloader actor." },
        { status: 502 }
      );
    }

    console.log("Actor run started, ID:", run.id);

    // Poll for completion (max 2 minutes, check every 2 seconds)
    const maxWaitTime = 120000; // 2 minutes
    const pollInterval = 2000; // 2 seconds
    const startTime = Date.now();
    let runStatus = await client.run(run.id).get();

    if (!runStatus) {
      return NextResponse.json(
        { error: "Failed to get actor run status." },
        { status: 502 }
      );
    }

    while (runStatus.status !== "SUCCEEDED" && Date.now() - startTime < maxWaitTime) {
      if (runStatus.status === "FAILED" || runStatus.status === "ABORTED") {
        return NextResponse.json(
          { error: `Actor run ${runStatus.status.toLowerCase()}.` },
          { status: 502 }
        );
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      const updatedStatus = await client.run(run.id).get();
      if (!updatedStatus) {
        return NextResponse.json(
          { error: "Failed to get actor run status during polling." },
          { status: 502 }
        );
      }
      runStatus = updatedStatus;
    }

    if (runStatus.status !== "SUCCEEDED") {
      return NextResponse.json(
        { error: "Actor run timed out or did not complete." },
        { status: 502 }
      );
    }

    if (!runStatus.defaultDatasetId) {
      return NextResponse.json(
        { error: "Downloader did not return dataset results." },
        { status: 502 }
      );
    }

    console.log("Actor run completed, dataset:", runStatus.defaultDatasetId);

    // Get results from dataset
    const items = await readDatasetItems(client, runStatus.defaultDatasetId);
    console.log("Dataset items:", JSON.stringify(items, null, 2));

    let downloadUrl: string | null = null;
    let downloadResponse: Response | null = null;

    // Strategy 1: Check dataset for download URL
    for (const item of items) {
      const itemUrl = findDownloadUrl(item);
      if (itemUrl) {
        const urlWithToken = addApifyToken(itemUrl, apiToken);
        try {
          const response = await fetch(urlWithToken);
          if (response.ok && response.body) {
            downloadUrl = urlWithToken;
            downloadResponse = response;
            console.log("Found download URL in dataset:", downloadUrl);
            break;
          }
        } catch (err) {
          console.error("Failed to fetch from dataset URL:", err);
        }
      }
    }

    // Strategy 2: Check key-value store for video file
    if (!downloadResponse && runStatus.id) {
      console.log("Checking key-value store...");
      const kvResult = await tryGetKeyValueStoreVideo(runStatus.id, apiToken);
      if (kvResult) {
        try {
          const response = await fetch(kvResult.url);
          if (response.ok && response.body) {
            downloadUrl = kvResult.url;
            downloadResponse = response;
            console.log("Found video in key-value store:", downloadUrl);
          }
        } catch (err) {
          console.error("Failed to fetch from KV store:", err);
        }
      }
    }

    if (!downloadResponse || !downloadUrl) {
      // Log what we got for debugging
      console.error("No downloadable video found. Items received:", items);
      return NextResponse.json(
        { error: "No downloadable video URL found in actor results." },
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

    // Determine extension
    let extension = "mp4";
    if (contentType.includes("webm")) extension = "webm";

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
    const firstItem = items[0] || {};

    return NextResponse.json({
      title: getString(firstItem.title) || title,
      videoId: videoId ?? null,
      downloadUrl,
      assetUrl: publicUrl,
      durationSeconds: typeof firstItem.duration === "number" ? firstItem.duration : null,
      width: typeof firstItem.width === "number" ? firstItem.width : null,
      height: typeof firstItem.height === "number" ? firstItem.height : null,
      size: fileSize,
      qualityLabel: getString(firstItem.quality) || quality + "p",
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
