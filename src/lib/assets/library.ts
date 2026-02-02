"use client";

import { createClient } from "@/lib/supabase/client";

export type AssetLibraryKind = "video" | "audio" | "image";

export type AssetLibrarySource =
  | "upload"
  | "autoclip"
  | "external"
  | "stock"
  | "generated";

export type AssetLibraryItem = {
  id: string;
  name: string;
  kind: AssetLibraryKind;
  url: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
  createdAt: number;
  source?: AssetLibrarySource;
  storageBucket?: string;
  storagePath?: string;
  externalUrl?: string;
  mimeType?: string;
};

type AssetRow = {
  id: string;
  name: string;
  kind: AssetLibraryKind;
  source: AssetLibrarySource | null;
  storage_bucket: string | null;
  storage_path: string | null;
  external_url: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  aspect_ratio: number | null;
  created_at: string | null;
};

type UploadAssetMeta = {
  name?: string;
  kind?: AssetLibraryKind;
  source?: AssetLibrarySource;
  duration?: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
};

const ASSET_BUCKET = "user-assets";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const DELETED_ASSETS_KEY = "satura:deleted-assets";
export const DELETED_ASSETS_EVENT = "satura:assets-deleted";

const hasWindow = () => typeof window !== "undefined";
const isAssetDebugEnabled = () => {
  if (!hasWindow()) {
    return false;
  }
  try {
    return (
      window.localStorage?.getItem("assetDebug") === "1" ||
      process.env.NEXT_PUBLIC_ASSET_DEBUG === "1"
    );
  } catch {
    return process.env.NEXT_PUBLIC_ASSET_DEBUG === "1";
  }
};

const assetDebug = (...args: unknown[]) => {
  if (isAssetDebugEnabled()) {
    console.info(...args);
  }
};

const inferKindFromFile = (file: File): AssetLibraryKind => {
  if (file.type.startsWith("audio/")) {
    return "audio";
  }
  if (file.type.startsWith("image/")) {
    return "image";
  }
  return "video";
};

const sanitizeFilename = (value: string) => {
  const trimmed = value.trim() || "asset";
  const sanitized = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
  const collapsed = sanitized.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return collapsed || "asset";
};

const normalizeAssetName = (value: string) => {
  const trimmed = value.slice(0, 120).trim();
  return trimmed.length > 0 ? trimmed : "Untitled asset";
};

const toTimestamp = (value: string | null) => {
  if (!value) {
    return Date.now();
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
};

const normalizeItem = (value: unknown): AssetLibraryItem | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const item = value as Partial<AssetLibraryItem>;
  if (typeof item.id !== "string" || item.id.trim().length === 0) {
    return null;
  }
  const kind =
    item.kind === "video" || item.kind === "audio" || item.kind === "image"
      ? item.kind
      : null;
  if (!kind) {
    return null;
  }
  const url = typeof item.url === "string" ? item.url.trim() : "";
  if (!url) {
    return null;
  }
  return {
    id: item.id,
    name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : "Untitled",
    kind,
    url,
    size: typeof item.size === "number" && Number.isFinite(item.size) ? item.size : 0,
    duration:
      typeof item.duration === "number" && Number.isFinite(item.duration)
        ? item.duration
        : undefined,
    width:
      typeof item.width === "number" && Number.isFinite(item.width)
        ? item.width
        : undefined,
    height:
      typeof item.height === "number" && Number.isFinite(item.height)
        ? item.height
        : undefined,
    aspectRatio:
      typeof item.aspectRatio === "number" && Number.isFinite(item.aspectRatio)
        ? item.aspectRatio
        : undefined,
    createdAt:
      typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
        ? item.createdAt
        : Date.now(),
    source:
      item.source === "upload" ||
      item.source === "autoclip" ||
      item.source === "external" ||
      item.source === "stock" ||
      item.source === "generated"
        ? item.source
        : undefined,
    storageBucket:
      typeof item.storageBucket === "string" && item.storageBucket.trim().length > 0
        ? item.storageBucket
        : undefined,
    storagePath:
      typeof item.storagePath === "string" && item.storagePath.trim().length > 0
        ? item.storagePath
        : undefined,
    externalUrl:
      typeof item.externalUrl === "string" && item.externalUrl.trim().length > 0
        ? item.externalUrl
        : undefined,
    mimeType:
      typeof item.mimeType === "string" && item.mimeType.trim().length > 0
        ? item.mimeType
        : undefined,
  };
};

const dedupeAssets = (items: AssetLibraryItem[]) => {
  const map = new Map<string, AssetLibraryItem>();
  items.forEach((item) => {
    const key = item.id || `${item.kind}:${item.url}`;
    map.set(key, item);
  });
  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
};

const persistedAssetIds = new Set<string>();

const hasFinitePositiveNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const isCloseNumber = (a: number, b: number, tolerance: number) =>
  Math.abs(a - b) <= tolerance;

const rowMatchesUploadMeta = (row: AssetRow, meta?: UploadAssetMeta) => {
  if (!meta) {
    return true;
  }

  const checks: boolean[] = [];

  if (
    hasFinitePositiveNumber(meta.duration) &&
    hasFinitePositiveNumber(row.duration_seconds)
  ) {
    checks.push(
      isCloseNumber(
        row.duration_seconds,
        meta.duration,
        Math.max(0.35, meta.duration * 0.02)
      )
    );
  }

  if (hasFinitePositiveNumber(meta.width) && hasFinitePositiveNumber(row.width)) {
    checks.push(Math.round(row.width) === Math.round(meta.width));
  }

  if (hasFinitePositiveNumber(meta.height) && hasFinitePositiveNumber(row.height)) {
    checks.push(Math.round(row.height) === Math.round(meta.height));
  }

  if (
    hasFinitePositiveNumber(meta.aspectRatio) &&
    hasFinitePositiveNumber(row.aspect_ratio)
  ) {
    checks.push(isCloseNumber(row.aspect_ratio, meta.aspectRatio, 0.02));
  }

  return checks.length === 0 ? true : checks.every(Boolean);
};

const findExistingUploadedAsset = async ({
  supabase,
  userId,
  file,
  name,
  kind,
  meta,
}: {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  file: File;
  name: string;
  kind: AssetLibraryKind;
  meta?: UploadAssetMeta;
}): Promise<AssetLibraryItem | null> => {
  let query = supabase
    .from("assets")
    .select(
      "id,name,kind,source,storage_bucket,storage_path,external_url,mime_type,size_bytes,duration_seconds,width,height,aspect_ratio,created_at"
    )
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("name", name)
    .eq("size_bytes", file.size)
    .order("created_at", { ascending: false })
    .limit(15);

  if (file.type) {
    query = query.eq("mime_type", file.type);
  } else {
    query = query.is("mime_type", null);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    return null;
  }

  const rows = data as AssetRow[];
  const strictMatches = rows.filter((row) => rowMatchesUploadMeta(row, meta));
  const candidates = strictMatches.length > 0 ? strictMatches : rows;
  const signedUrlMap = await fetchSignedUrls(candidates);

  for (const row of candidates) {
    const item = mapRowToItem(row, signedUrlMap);
    if (item) {
      persistedAssetIds.add(item.id);
      return item;
    }
  }

  return null;
};

const fetchSignedUrls = async (rows: AssetRow[]) => {
  const supabase = createClient();
  const byBucket = new Map<string, string[]>();
  rows.forEach((row) => {
    if (!row.storage_bucket || !row.storage_path) {
      return;
    }
    const list = byBucket.get(row.storage_bucket) ?? [];
    list.push(row.storage_path);
    byBucket.set(row.storage_bucket, list);
  });

  const urlMap = new Map<string, string>();
  await Promise.all(
    Array.from(byBucket.entries()).map(async ([bucket, paths]) => {
      if (!paths.length) {
        return;
      }
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
      if (error || !data) {
        return;
      }
      data.forEach((entry) => {
        if (entry.signedUrl) {
          urlMap.set(`${bucket}:${entry.path}`, entry.signedUrl);
        }
      });
    })
  );

  return urlMap;
};

const mapRowToItem = (
  row: AssetRow,
  signedUrlMap: Map<string, string>
): AssetLibraryItem | null => {
  const storageKey =
    row.storage_bucket && row.storage_path
      ? `${row.storage_bucket}:${row.storage_path}`
      : null;
  const resolvedUrl =
    (storageKey ? signedUrlMap.get(storageKey) : null) ||
    row.external_url ||
    "";
  if (!resolvedUrl) {
    return null;
  }
  return normalizeItem({
    id: row.id,
    name: row.name,
    kind: row.kind,
    url: resolvedUrl,
    size: row.size_bytes ?? 0,
    duration: row.duration_seconds ?? undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    aspectRatio: row.aspect_ratio ?? undefined,
    createdAt: toTimestamp(row.created_at),
    source: row.source ?? undefined,
    storageBucket: row.storage_bucket ?? undefined,
    storagePath: row.storage_path ?? undefined,
    externalUrl: row.external_url ?? undefined,
    mimeType: row.mime_type ?? undefined,
  });
};

export const loadAssetLibrary = async (): Promise<AssetLibraryItem[]> => {
  if (!hasWindow()) {
    return [];
  }
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return [];
  }
  const userId = userData.user.id;
  const { data, error } = await supabase
    .from("assets")
    .select(
      "id,name,kind,source,storage_bucket,storage_path,external_url,mime_type,size_bytes,duration_seconds,width,height,aspect_ratio,created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }
  const signedUrlMap = await fetchSignedUrls(data as AssetRow[]);
  const items = (data as AssetRow[])
    .map((row) => mapRowToItem(row, signedUrlMap))
    .filter((item): item is AssetLibraryItem => Boolean(item));

  items.forEach((item) => {
    if (item.id) {
      persistedAssetIds.add(item.id);
    }
  });

  return dedupeAssets(items);
};

export const uploadAssetFile = async (
  file: File,
  meta?: UploadAssetMeta
): Promise<AssetLibraryItem | null> => {
  if (!hasWindow()) {
    return null;
  }
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error("[assets] auth.getUser error", userError);
  }
  const user = userData?.user;
  if (!user) {
    console.warn("[assets] upload blocked: no authenticated user");
    return null;
  }
  const id = crypto.randomUUID();
  const name = meta?.name?.trim() || file.name || "Uploaded asset";
  const kind = meta?.kind ?? inferKindFromFile(file);
  const existingAsset = await findExistingUploadedAsset({
    supabase,
    userId: user.id,
    file,
    name,
    kind,
    meta,
  });
  if (existingAsset) {
    assetDebug("[assets] upload dedupe hit", {
      userId: user.id,
      assetId: existingAsset.id,
      name,
      kind,
      size: file.size,
    });
    return existingAsset;
  }
  const filename = sanitizeFilename(file.name || `${id}.bin`);
  const storagePath = `${user.id}/assets/${id}/${filename}`;
  assetDebug("[assets] upload start", {
    userId: user.id,
    name,
    kind,
    size: file.size,
    type: file.type,
    storagePath,
  });
  const { error: uploadError } = await supabase.storage
    .from(ASSET_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });
  if (uploadError) {
    console.error("[assets] upload failed", {
      bucket: ASSET_BUCKET,
      storagePath,
      error: uploadError,
    });
    return null;
  }
  assetDebug("[assets] upload complete", { storagePath });
  const insertPayload = {
    id,
    user_id: user.id,
    name,
    kind,
    source: meta?.source ?? "upload",
    storage_bucket: ASSET_BUCKET,
    storage_path: storagePath,
    external_url: null,
    mime_type: file.type || null,
    size_bytes: file.size,
    duration_seconds: meta?.duration ?? null,
    width: meta?.width ?? null,
    height: meta?.height ?? null,
    aspect_ratio: meta?.aspectRatio ?? null,
  };
  const { error: insertError } = await supabase
    .from("assets")
    .insert(insertPayload);
  if (insertError) {
    console.error("[assets] insert failed", insertError);
    return null;
  }
  persistedAssetIds.add(id);
  const { data: signedData, error: signedError } = await supabase.storage
    .from(ASSET_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (signedError) {
    console.error("[assets] createSignedUrl failed", signedError);
  }
  const url = signedData?.signedUrl || "";
  if (!url) {
    console.warn("[assets] signed URL missing", { storagePath });
    return null;
  }
  assetDebug("[assets] upload success", { id, url });
  return {
    id,
    name,
    kind,
    url,
    size: file.size,
    duration: meta?.duration,
    width: meta?.width,
    height: meta?.height,
    aspectRatio: meta?.aspectRatio,
    createdAt: Date.now(),
    source: meta?.source ?? "upload",
    storageBucket: ASSET_BUCKET,
    storagePath,
    mimeType: file.type || undefined,
  };
};

export const createExternalAsset = async (payload: {
  url: string;
  name: string;
  kind: AssetLibraryKind;
  source?: AssetLibrarySource;
  size?: number;
  duration?: number;
  width?: number;
  height?: number;
  aspectRatio?: number;
}): Promise<AssetLibraryItem | null> => {
  if (!hasWindow()) {
    return null;
  }
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user || !payload.url) {
    return null;
  }
  const { data: existing } = await supabase
    .from("assets")
    .select(
      "id,name,kind,source,storage_bucket,storage_path,external_url,mime_type,size_bytes,duration_seconds,width,height,aspect_ratio,created_at"
    )
    .eq("external_url", payload.url)
    .eq("kind", payload.kind)
    .eq("user_id", user.id)
    .limit(1);
  if (existing && existing.length > 0) {
    const signedUrlMap = await fetchSignedUrls(existing as AssetRow[]);
    const item = mapRowToItem(existing[0] as AssetRow, signedUrlMap);
    if (item?.id) {
      persistedAssetIds.add(item.id);
    }
    return item;
  }

  const id = crypto.randomUUID();
  const insertPayload = {
    id,
    user_id: user.id,
    name: payload.name,
    kind: payload.kind,
    source: payload.source ?? "external",
    storage_bucket: null,
    storage_path: null,
    external_url: payload.url,
    mime_type: null,
    size_bytes: payload.size ?? 0,
    duration_seconds: payload.duration ?? null,
    width: payload.width ?? null,
    height: payload.height ?? null,
    aspect_ratio: payload.aspectRatio ?? null,
  };
  const { error } = await supabase.from("assets").insert(insertPayload);
  if (error) {
    return null;
  }
  persistedAssetIds.add(id);
  return normalizeItem({
    id,
    name: payload.name,
    kind: payload.kind,
    url: payload.url,
    size: payload.size ?? 0,
    duration: payload.duration,
    width: payload.width,
    height: payload.height,
    aspectRatio: payload.aspectRatio,
    createdAt: Date.now(),
    source: payload.source ?? "external",
    externalUrl: payload.url,
  });
};

export const addAssetsToLibrary = async (
  incoming: AssetLibraryItem[]
): Promise<AssetLibraryItem[]> => {
  const normalized = incoming
    .map((item) => normalizeItem(item))
    .filter((item): item is AssetLibraryItem => Boolean(item));
  const pending = normalized.filter((item) => !persistedAssetIds.has(item.id));
  if (!pending.length) {
    return dedupeAssets(normalized);
  }
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return dedupeAssets(normalized);
  }
  const payload = pending
    .map((item) => {
      const storageBucket =
        item.storageBucket ?? (item.externalUrl ? null : ASSET_BUCKET);
      const storagePath = item.storagePath ?? null;
      const externalUrl = item.externalUrl ?? null;
      if (!storagePath && !externalUrl) {
        return null;
      }
      return {
        id: item.id,
        user_id: user.id,
        name: item.name,
        kind: item.kind,
        source: item.source ?? "external",
        storage_bucket: storageBucket,
        storage_path: storagePath,
        external_url: externalUrl,
        mime_type: item.mimeType ?? null,
        size_bytes: item.size,
        duration_seconds: item.duration ?? null,
        width: item.width ?? null,
        height: item.height ?? null,
        aspect_ratio: item.aspectRatio ?? null,
      };
    })
    .filter(Boolean);

  if (payload.length) {
    const { error } = await supabase.from("assets").upsert(payload);
    if (!error) {
      payload.forEach((entry) => {
        if (entry?.id) {
          persistedAssetIds.add(entry.id);
        }
      });
    }
  }

  return loadAssetLibrary();
};

export const deleteAssetById = async (assetId: string): Promise<void> => {
  if (!hasWindow()) {
    return;
  }
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return;
  }
  const { data } = await supabase
    .from("assets")
    .select("storage_bucket,storage_path")
    .eq("id", assetId)
    .eq("user_id", user.id)
    .limit(1);
  const row = data?.[0] ?? null;
  if (row?.storage_bucket && row?.storage_path) {
    await supabase.storage
      .from(row.storage_bucket)
      .remove([row.storage_path]);
  }
  await supabase.from("assets").delete().eq("id", assetId).eq("user_id", user.id);
  persistedAssetIds.delete(assetId);
  try {
    const raw = window.localStorage.getItem(DELETED_ASSETS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    const unique = new Set<string>(list.filter((id) => typeof id === "string"));
    unique.add(assetId);
    window.localStorage.setItem(
      DELETED_ASSETS_KEY,
      JSON.stringify(Array.from(unique))
    );
  } catch {
    // Ignore storage failures.
  }
  try {
    window.dispatchEvent(
      new CustomEvent(DELETED_ASSETS_EVENT, { detail: [assetId] })
    );
  } catch {
    // Ignore dispatch failures.
  }
};

export const renameAssetById = async (
  assetId: string,
  name: string
): Promise<{ id: string; name: string } | null> => {
  if (!hasWindow()) {
    return null;
  }
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return null;
  }
  const nextName = normalizeAssetName(name);
  const { data, error } = await supabase
    .from("assets")
    .update({ name: nextName })
    .eq("id", assetId)
    .eq("user_id", user.id)
    .select("id,name")
    .maybeSingle();

  if (error || !data?.id || typeof data.name !== "string") {
    return null;
  }

  return {
    id: data.id,
    name: normalizeAssetName(data.name),
  };
};

export const consumeDeletedAssetIds = (): string[] => {
  if (!hasWindow()) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(DELETED_ASSETS_KEY);
    if (!raw) {
      return [];
    }
    window.localStorage.removeItem(DELETED_ASSETS_KEY);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
};

export const buildAssetLibraryItem = (
  item: Omit<AssetLibraryItem, "id" | "createdAt" | "url"> &
    Partial<Pick<AssetLibraryItem, "id" | "createdAt" | "url">>
): AssetLibraryItem | null =>
  normalizeItem({
    ...item,
    id: item.id ?? crypto.randomUUID(),
    createdAt: item.createdAt ?? Date.now(),
    url: item.url ?? item.externalUrl ?? "",
  });
