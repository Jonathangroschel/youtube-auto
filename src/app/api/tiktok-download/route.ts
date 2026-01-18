import { createWriteStream } from "fs";
import { mkdir, stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

import { NextResponse } from "next/server";
import { ApifyClient } from "apify-client";

export const runtime = "nodejs";

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
    const run = await client.actor("S7Wmy78pIjTe01iEq").call({
      urls: [url],
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

    let videoUrl = resolveTikTokVideoUrl(item);
    if (!videoUrl) {
      return NextResponse.json(
        { error: "No downloadable video file found." },
        { status: 502 }
      );
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

    const downloadResponse = await fetch(videoUrl);
    if (!downloadResponse.ok || !downloadResponse.body) {
      return NextResponse.json(
        { error: "Unable to download video file." },
        { status: 502 }
      );
    }

    const extension = resolveExtension(
      videoUrl,
      downloadResponse.headers.get("content-type")
    );
    const downloadsDir = path.join(
      process.cwd(),
      "public",
      "tiktok-cache"
    );
    await mkdir(downloadsDir, { recursive: true });
    const fileName = `tt-${Date.now()}.${extension}`;
    const filePath = path.join(downloadsDir, fileName);
    const nodeStream = Readable.fromWeb(downloadResponse.body as any);
    await pipeline(nodeStream, createWriteStream(filePath));
    const fileStats = await stat(filePath);
    const fileSize =
      Number(downloadResponse.headers.get("content-length")) ||
      fileStats.size ||
      0;

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

    return NextResponse.json({
      title: resolveTikTokTitle(item),
      downloadUrl: videoUrl,
      assetUrl: `/tiktok-cache/${fileName}`,
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
