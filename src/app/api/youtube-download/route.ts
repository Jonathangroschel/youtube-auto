import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SUPABASE_BUCKET = "youtube-downloads";

// Cobalt API endpoint (free, handles YouTube blocking)
const COBALT_API = "https://api.cobalt.tools/api/json";

type CobaltResponse = {
  status: "stream" | "redirect" | "picker" | "error";
  url?: string;
  urls?: string[];
  text?: string;
  picker?: Array<{ url: string; type: string }>;
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
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
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

export async function POST(request: Request) {
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

  const videoId = extractVideoId(url);
  
  try {
    // Get video title via oEmbed
    const videoInfo = await getVideoInfo(url);
    const title = videoInfo?.title ?? "YouTube video";

    // Call Cobalt API to get download URL
    const cobaltResponse = await fetch(COBALT_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        url,
        vQuality: "1080",
        filenamePattern: "basic",
        isAudioOnly: false,
        disableMetadata: true,
      }),
    });

    if (!cobaltResponse.ok) {
      const errorText = await cobaltResponse.text();
      console.error("Cobalt API error:", cobaltResponse.status, errorText);
      return NextResponse.json(
        { error: `Download service error: ${cobaltResponse.status}` },
        { status: 502 }
      );
    }

    const cobaltData: CobaltResponse = await cobaltResponse.json();

    // Handle different response types
    let downloadUrl: string | null = null;
    
    if (cobaltData.status === "error") {
      return NextResponse.json(
        { error: cobaltData.text || "Unable to process this video." },
        { status: 502 }
      );
    }

    if (cobaltData.status === "stream" || cobaltData.status === "redirect") {
      downloadUrl = cobaltData.url || null;
    } else if (cobaltData.status === "picker" && cobaltData.picker?.length) {
      // Pick the first video option
      const videoOption = cobaltData.picker.find(p => p.type === "video") || cobaltData.picker[0];
      downloadUrl = videoOption?.url || null;
    }

    if (!downloadUrl) {
      return NextResponse.json(
        { error: "No download URL returned from service." },
        { status: 502 }
      );
    }

    // Download the video
    const downloadResponse = await fetch(downloadUrl);
    
    if (!downloadResponse.ok) {
      return NextResponse.json(
        { error: `Failed to download video: ${downloadResponse.status}` },
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

    // Determine extension from content type
    let extension = "mp4";
    if (contentType.includes("webm")) extension = "webm";
    else if (contentType.includes("mp4")) extension = "mp4";

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

    return NextResponse.json({
      title,
      videoId: videoId ?? null,
      downloadUrl,
      assetUrl: publicUrl,
      durationSeconds: null,
      width: null,
      height: null,
      size: fileSize,
      qualityLabel: "1080p",
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
