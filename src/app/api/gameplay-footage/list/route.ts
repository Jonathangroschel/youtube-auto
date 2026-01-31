import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const GAMEPLAY_BUCKET = "gameplay-footage";
const DEFAULT_LIMIT = 2000;
const MAX_LIMIT = 5000;
const PAGE_SIZE = 1000;
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;

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

  const items: Array<{
    name: string;
    path: string;
    createdAt: string | null;
    updatedAt: string | null;
    metadata: unknown | null;
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

      const entries = Array.isArray(data) ? data : [];
      if (entries.length === 0) {
        break;
      }

      for (const entry of entries) {
        if (items.length >= safeLimit) {
          break;
        }
        if (typeof (entry as any)?.name !== "string" || (entry as any).name.length === 0) {
          continue;
        }

        const path = currentPrefix ? `${currentPrefix}/${(entry as any).name}` : (entry as any).name;
        if (isVideoPath(path)) {
          items.push({
            name: (entry as any).name,
            path,
            createdAt: typeof (entry as any)?.created_at === "string" ? (entry as any).created_at : null,
            updatedAt: typeof (entry as any)?.updated_at === "string" ? (entry as any).updated_at : null,
            metadata: (entry as any)?.metadata ?? null,
          });
          continue;
        }

        const looksLikeFolder =
          (entry as any)?.id == null && ((entry as any)?.metadata == null || (entry as any)?.metadata === "");
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

  const resolvedItems = items
    .map((entry) => {
      const signedUrl = urlByPath.get(entry.path) ?? "";
      const { data: publicData } = supabaseServer.storage
        .from(GAMEPLAY_BUCKET)
        .getPublicUrl(entry.path);
      const fallbackUrl = publicData.publicUrl;
      return {
        ...entry,
        publicUrl: signedUrl || fallbackUrl,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  return NextResponse.json({ items: resolvedItems });
}
