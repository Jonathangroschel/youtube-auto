import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const GAMEPLAY_BUCKET = "gameplay-footage";
const THUMBNAIL_FOLDER_PREFIX = "thumbnails";
const DEFAULT_LIMIT = 2000;
const MAX_LIMIT = 5000;
const PAGE_SIZE = 1000;
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;
const SQUARE_TOLERANCE_PX = 2;

const isVideoPath = (value: string) => {
  const lower = value.toLowerCase();
  return (
    lower.endsWith(".mp4") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".m4v") ||
    lower.endsWith(".webm")
  );
};

const stripFileExtension = (value: string) => value.replace(/\.[^./]+$/, "");

const thumbnailPathCandidatesForVideo = (videoPath: string) => {
  const stem = stripFileExtension(videoPath).replace(/^\/+/, "");
  return [
    `${THUMBNAIL_FOLDER_PREFIX}/${stem}.jpg`,
    `${THUMBNAIL_FOLDER_PREFIX}/${stem}.jpeg`,
    `${THUMBNAIL_FOLDER_PREFIX}/${stem}.webp`,
    `${THUMBNAIL_FOLDER_PREFIX}/${stem}.png`,
  ];
};

const parseFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

const extractVideoDimensions = (
  metadata: unknown
): { width: number; height: number } | null => {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  const record = metadata as Record<string, unknown>;
  const width =
    parseFiniteNumber(record.width) ??
    parseFiniteNumber(record.videoWidth) ??
    parseFiniteNumber(record.frameWidth) ??
    parseFiniteNumber(record.resolution_width) ??
    parseFiniteNumber(record.resolutionWidth);
  const height =
    parseFiniteNumber(record.height) ??
    parseFiniteNumber(record.videoHeight) ??
    parseFiniteNumber(record.frameHeight) ??
    parseFiniteNumber(record.resolution_height) ??
    parseFiniteNumber(record.resolutionHeight);
  if (!width || !height) {
    return null;
  }
  return { width, height };
};

const isClearlyNonVertical = (width: number, height: number) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return false;
  }
  if (Math.abs(width - height) <= SQUARE_TOLERANCE_PX) {
    return true;
  }
  return width > height + SQUARE_TOLERANCE_PX;
};

type StorageListEntry = {
  name?: string | null;
  id?: string | null;
  metadata?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawLimit = searchParams.get("limit");
  const limit = rawLimit
    ? Math.max(1, Math.min(MAX_LIMIT, Number(rawLimit)))
    : DEFAULT_LIMIT;
  const prefix = (searchParams.get("prefix") ?? "").replace(/^\/+|\/+$/g, "");

  const safeLimit =
    typeof limit === "number" && Number.isFinite(limit)
      ? Math.floor(limit)
      : DEFAULT_LIMIT;
  const orientation = (searchParams.get("orientation") ?? "").trim().toLowerCase();
  const verticalOnly = orientation === "vertical" || orientation === "portrait";

  const items: Array<{
    name: string;
    path: string;
    createdAt: string | null;
    updatedAt: string | null;
    metadata: unknown | null;
    width: number | null;
    height: number | null;
  }> = [];

  const folderQueue: string[] = [prefix];
  const seenPrefixes = new Set<string>();

  while (folderQueue.length > 0 && items.length < safeLimit) {
    const currentPrefix = folderQueue.shift() ?? "";
    if (seenPrefixes.has(currentPrefix)) {
      continue;
    }
    seenPrefixes.add(currentPrefix);

    let offset = 0;
    while (items.length < safeLimit) {
      const { data, error } = await supabaseServer.storage
        .from(GAMEPLAY_BUCKET)
        .list(currentPrefix, {
          limit: PAGE_SIZE,
          offset,
          sortBy: { column: "name", order: "asc" },
        });

      if (error) {
        return NextResponse.json(
          { error: "Failed to list gameplay footage." },
          { status: 502 }
        );
      }

      const entries: StorageListEntry[] = Array.isArray(data)
        ? (data as StorageListEntry[])
        : [];
      if (entries.length === 0) {
        break;
      }

      for (const entry of entries) {
        if (items.length >= safeLimit) {
          break;
        }
        const name = typeof entry.name === "string" ? entry.name : "";
        if (name.length === 0) {
          continue;
        }

        const path = currentPrefix ? `${currentPrefix}/${name}` : name;
        if (isVideoPath(path)) {
          const metadata = entry.metadata ?? null;
          const dimensions = extractVideoDimensions(metadata);
          if (
            verticalOnly &&
            dimensions &&
            isClearlyNonVertical(dimensions.width, dimensions.height)
          ) {
            continue;
          }
          items.push({
            name,
            path,
            createdAt: typeof entry.created_at === "string" ? entry.created_at : null,
            updatedAt: typeof entry.updated_at === "string" ? entry.updated_at : null,
            metadata,
            width: dimensions?.width ?? null,
            height: dimensions?.height ?? null,
          });
          continue;
        }

        const looksLikeFolder =
          entry.id == null && (entry.metadata == null || entry.metadata === "");
        if (looksLikeFolder) {
          folderQueue.push(path);
        }
      }

      if (entries.length < PAGE_SIZE) {
        break;
      }
      offset += PAGE_SIZE;
    }
  }

  const itemsWithPublicUrl = items.map((entry) => {
    return entry.path;
  });

  const urlByPath = new Map<string, string>();
  for (let offset = 0; offset < itemsWithPublicUrl.length; offset += PAGE_SIZE) {
    const batch = itemsWithPublicUrl.slice(offset, offset + PAGE_SIZE);
    const { data, error } = await supabaseServer.storage
      .from(GAMEPLAY_BUCKET)
      .createSignedUrls(batch, SIGNED_URL_TTL_SECONDS);
    if (error) {
      return NextResponse.json(
        { error: "Failed to sign gameplay footage URLs." },
        { status: 502 }
      );
    }
    (data ?? []).forEach((entry) => {
      if (entry?.path && entry?.signedUrl) {
        urlByPath.set(entry.path, entry.signedUrl);
      }
    });
  }

  const thumbnailCandidatesByVideoPath = new Map<string, string[]>();
  const allThumbnailCandidatePaths: string[] = [];
  const seenThumbnailCandidatePaths = new Set<string>();
  items.forEach((entry) => {
    const candidates = thumbnailPathCandidatesForVideo(entry.path);
    thumbnailCandidatesByVideoPath.set(entry.path, candidates);
    candidates.forEach((candidatePath) => {
      if (seenThumbnailCandidatePaths.has(candidatePath)) {
        return;
      }
      seenThumbnailCandidatePaths.add(candidatePath);
      allThumbnailCandidatePaths.push(candidatePath);
    });
  });

  const thumbnailUrlByPath = new Map<string, string>();
  for (let offset = 0; offset < allThumbnailCandidatePaths.length; offset += PAGE_SIZE) {
    const batch = allThumbnailCandidatePaths.slice(offset, offset + PAGE_SIZE);
    const { data, error } = await supabaseServer.storage
      .from(GAMEPLAY_BUCKET)
      .createSignedUrls(batch, SIGNED_URL_TTL_SECONDS);
    if (error) {
      return NextResponse.json(
        { error: "Failed to sign gameplay thumbnail URLs." },
        { status: 502 }
      );
    }
    (data ?? []).forEach((entry) => {
      if (
        entry?.path &&
        typeof entry.signedUrl === "string" &&
        entry.signedUrl.length > 0
      ) {
        thumbnailUrlByPath.set(entry.path, entry.signedUrl);
      }
    });
  }

  const resolvedItems = items
    .map((entry) => {
      const signedUrl = urlByPath.get(entry.path) ?? "";
      const thumbnailCandidates = thumbnailCandidatesByVideoPath.get(entry.path) ?? [];
      let thumbnailUrl: string | null = null;
      for (const thumbnailPath of thumbnailCandidates) {
        const resolved = thumbnailUrlByPath.get(thumbnailPath);
        if (typeof resolved === "string" && resolved.length > 0) {
          thumbnailUrl = resolved;
          break;
        }
      }
      const { data: publicData } = supabaseServer.storage
        .from(GAMEPLAY_BUCKET)
        .getPublicUrl(entry.path);
      const fallbackUrl = publicData.publicUrl;
      return {
        ...entry,
        publicUrl: signedUrl || fallbackUrl,
        thumbnailUrl,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  return NextResponse.json(
    { items: resolvedItems },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
