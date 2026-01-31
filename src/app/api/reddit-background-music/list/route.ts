import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MUSIC_BUCKET = process.env.NEXT_PUBLIC_REDDIT_MUSIC_BUCKET ?? "reddit-background-music";
const DEFAULT_ROOT =
  process.env.NEXT_PUBLIC_REDDIT_MUSIC_ROOT?.replace(/^\/+|\/+$/g, "") ?? "";

const DEFAULT_LIMIT = 2000;
const MAX_LIMIT = 5000;
const PAGE_SIZE = 1000;

const audioExtensions = [
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
  ".flac",
  ".opus",
];

const isAudioPath = (value: string) => {
  const lower = value.toLowerCase();
  return audioExtensions.some((ext) => lower.endsWith(ext));
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const formatLabel = (value: string) => {
  const cleaned = value
    .replace(/\.[^/.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return value;
  }
  return cleaned.replace(/\b\w/g, (match) => match.toUpperCase());
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
  const overridePrefix = (searchParams.get("prefix") ?? "").replace(/^\/+|\/+$/g, "");

  const safeLimit =
    typeof limit === "number" && Number.isFinite(limit)
      ? Math.floor(limit)
      : DEFAULT_LIMIT;
  const root = overridePrefix || DEFAULT_ROOT;

  const items: Array<{
    id: string;
    name: string;
    url: string;
    path: string;
    size: number;
  }> = [];

  const folderQueue: string[] = [root];
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
        .from(MUSIC_BUCKET)
        .list(currentPrefix, {
          limit: PAGE_SIZE,
          offset,
          sortBy: { column: "name", order: "asc" },
        });

      if (error) {
        return NextResponse.json(
          { error: "Failed to list background music." },
          { status: 502 }
        );
      }

      const entries = Array.isArray(data) ? data : [];
      if (entries.length === 0) {
        break;
      }

      for (const entry of entries) {
        if (items.length >= safeLimit) {
          break;
        }
        if (!isRecord(entry)) {
          continue;
        }
        const nameValue = entry.name;
        if (typeof nameValue !== "string" || nameValue.length === 0) {
          continue;
        }

        const path = currentPrefix
          ? `${currentPrefix}/${nameValue}`
          : nameValue;
        if (isAudioPath(path)) {
          const { data: publicData } = supabaseServer.storage
            .from(MUSIC_BUCKET)
            .getPublicUrl(path);
          const url = publicData?.publicUrl ?? "";
          if (!url) {
            continue;
          }
          const metadataValue = entry.metadata;
          const sizeValue =
            isRecord(metadataValue) &&
            typeof metadataValue.size === "number" &&
            Number.isFinite(metadataValue.size)
              ? metadataValue.size
              : 0;
          items.push({
            id: path,
            name: formatLabel(nameValue),
            url,
            path,
            size: sizeValue,
          });
          continue;
        }

        const idValue = entry.id;
        const metadataValue = entry.metadata;
        const looksLikeFolder =
          idValue == null &&
          (metadataValue == null ||
            (typeof metadataValue === "string" && metadataValue === ""));
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

  items.sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ items });
}
