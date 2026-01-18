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

    const candidates = buildFormatCandidates(formats, adaptiveFormats);
    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "No downloadable video format found." },
        { status: 502 }
      );
    }

    let selected: YoutubeFormat | null = null;
    let downloadResponse: Response | null = null;
    let lastStatus: number | null = null;
    for (const format of candidates) {
      const url = format.url;
      if (!url) {
        continue;
      }
      try {
        const response = await fetchYoutubeStream(url);
        lastStatus = response.status;
        if (!response.ok || !response.body) {
          continue;
        }
        selected = format;
        downloadResponse = response;
        break;
      } catch {
        continue;
      }
    }

    if (!selected || !downloadResponse) {
      const suffix = lastStatus ? ` (status ${lastStatus})` : "";
      return NextResponse.json(
        { error: `Unable to download video file${suffix}.` },
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

    const extension = resolveExtension(
      selected,
      downloadResponse.headers.get("content-type")
    );
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
