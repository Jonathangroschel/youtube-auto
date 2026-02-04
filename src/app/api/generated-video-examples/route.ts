import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const revalidate = 3600;

const BUCKET = "generated-video-examples";
const PAGE_SIZE = 1000;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

type StorageListEntry = {
  name?: string | null;
  id?: string | null;
  metadata?: Record<string, unknown> | null | "";
};

const isVideoPath = (value: string) => {
  const lower = value.toLowerCase();
  return (
    lower.endsWith(".mp4") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".m4v") ||
    lower.endsWith(".webm")
  );
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawLimit = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
  const safeLimit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(rawLimit)))
    : DEFAULT_LIMIT;

  const items: Array<{ name: string; path: string; publicUrl: string }> = [];
  const folderQueue: string[] = [""];
  const seenPrefixes = new Set<string>();

  while (folderQueue.length > 0 && items.length < safeLimit) {
    const currentPrefix = folderQueue.shift() ?? "";
    if (seenPrefixes.has(currentPrefix)) {
      continue;
    }
    seenPrefixes.add(currentPrefix);

    let offset = 0;
    while (items.length < safeLimit) {
      const { data, error } = await supabaseServer.storage.from(BUCKET).list(currentPrefix, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

      if (error) {
        return NextResponse.json(
          { error: "Failed to list generated video examples." },
          { status: 502 }
        );
      }

      const entries = (Array.isArray(data) ? data : []) as StorageListEntry[];
      if (entries.length === 0) {
        break;
      }

      for (const entry of entries) {
        if (items.length >= safeLimit) {
          break;
        }

        const name = typeof entry.name === "string" ? entry.name : "";
        if (!name) {
          continue;
        }

        const path = currentPrefix ? `${currentPrefix}/${name}` : name;
        if (isVideoPath(path)) {
          const { data: publicData } = supabaseServer.storage.from(BUCKET).getPublicUrl(path);
          items.push({
            name,
            path,
            publicUrl: publicData.publicUrl,
          });
          continue;
        }

        const looksLikeFolder = entry.id == null && (entry.metadata == null || entry.metadata === "");
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

  items.sort((a, b) => a.path.localeCompare(b.path));
  return NextResponse.json({ items });
}
