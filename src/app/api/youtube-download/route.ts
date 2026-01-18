import { createWriteStream } from "fs";
import { mkdir, stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

import { NextResponse } from "next/server";
import { ApifyClient } from "apify-client";

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

const selectBestFormat = (
  formats: YoutubeFormat[],
  options?: { requireAudio?: boolean }
) => {
  const candidates = formats.filter((format) => {
    if (!isVideoFormat(format)) {
      return false;
    }
    if (typeof format.url !== "string" || format.url.length === 0) {
      return false;
    }
    if (options?.requireAudio && !hasAudioTrack(format)) {
      return false;
    }
    return true;
  });
  if (candidates.length === 0) {
    return null;
  }
  const sorted = [...candidates].sort((a, b) => {
    const widthDiff = (b.width ?? 0) - (a.width ?? 0);
    if (widthDiff !== 0) {
      return widthDiff;
    }
    const heightDiff = (b.height ?? 0) - (a.height ?? 0);
    if (heightDiff !== 0) {
      return heightDiff;
    }
    return (b.bitrate ?? 0) - (a.bitrate ?? 0);
  });
  return sorted[0];
};

const resolveExtension = (format?: YoutubeFormat | null) => {
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
    const formats = Array.isArray(videoInfo.formats) ? videoInfo.formats : [];
    const adaptiveFormats = Array.isArray(videoInfo.adaptiveFormats)
      ? videoInfo.adaptiveFormats
      : [];

    const selected =
      selectBestFormat(formats, { requireAudio: true }) ??
      selectBestFormat(formats) ??
      selectBestFormat(adaptiveFormats, { requireAudio: true }) ??
      selectBestFormat(adaptiveFormats);

    if (!selected?.url) {
      return NextResponse.json(
        { error: "No downloadable video format found." },
        { status: 502 }
      );
    }

    const durationSeconds =
      normalizeNumber(videoInfo.lengthSeconds) ??
      (normalizeNumber(selected.approxDurationMs)
        ? (normalizeNumber(selected.approxDurationMs) as number) / 1000
        : null);
    const size =
      normalizeNumber(selected.contentLength) != null
        ? Math.max(0, normalizeNumber(selected.contentLength) as number)
        : 0;

    const extension = resolveExtension(selected);
    const downloadResponse = await fetch(selected.url);
    if (!downloadResponse.ok || !downloadResponse.body) {
      return NextResponse.json(
        { error: "Unable to download video file." },
        { status: 502 }
      );
    }
    const downloadsDir = path.join(
      process.cwd(),
      "public",
      "youtube-cache"
    );
    await mkdir(downloadsDir, { recursive: true });
    const baseName = item.videoId ? `yt-${item.videoId}` : `yt-${Date.now()}`;
    const fileName = `${baseName}-${Date.now()}.${extension}`;
    const filePath = path.join(downloadsDir, fileName);
    const nodeStream = Readable.fromWeb(downloadResponse.body as any);
    await pipeline(nodeStream, createWriteStream(filePath));
    const fileStats = await stat(filePath);
    const fileSize =
      Number(downloadResponse.headers.get("content-length")) ||
      fileStats.size ||
      size;

    return NextResponse.json({
      title: videoInfo.title ?? "YouTube video",
      videoId: item.videoId ?? null,
      downloadUrl: selected.url,
      assetUrl: `/youtube-cache/${fileName}`,
      durationSeconds: durationSeconds ?? null,
      width: selected.width ?? null,
      height: selected.height ?? null,
      size: fileSize,
      qualityLabel: selected.qualityLabel ?? selected.quality ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Unable to download video.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
