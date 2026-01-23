export type AssetLibraryKind = "video" | "audio" | "image";

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
  source?: "upload" | "autoclip" | "external";
};

const ASSET_LIBRARY_KEY = "satura:asset-library";

const hasWindow = () => typeof window !== "undefined";

const generateId = () => {
  if (hasWindow() && typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `asset_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const normalizeItem = (value: unknown): AssetLibraryItem | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const item = value as Partial<AssetLibraryItem>;
  const id = typeof item.id === "string" && item.id.trim() ? item.id : generateId();
  const name = typeof item.name === "string" && item.name.trim() ? item.name.trim() : "Untitled";
  const url = typeof item.url === "string" && item.url.trim() ? item.url.trim() : "";
  const kind = item.kind === "video" || item.kind === "audio" || item.kind === "image"
    ? item.kind
    : null;
  const createdAt =
    typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
      ? item.createdAt
      : Date.now();
  const size =
    typeof item.size === "number" && Number.isFinite(item.size) ? item.size : 0;

  if (!url || !kind) {
    return null;
  }

  return {
    id,
    name,
    kind,
    url,
    size,
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
    createdAt,
    source:
      item.source === "upload" || item.source === "autoclip" || item.source === "external"
        ? item.source
        : undefined,
  };
};

const dedupeAssets = (items: AssetLibraryItem[]) => {
  const map = new Map<string, AssetLibraryItem>();
  items.forEach((item) => {
    const key = `${item.kind}:${item.url}`;
    map.set(key, item);
  });
  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
};

export const loadAssetLibrary = (): AssetLibraryItem[] => {
  if (!hasWindow()) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(ASSET_LIBRARY_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return dedupeAssets(
      parsed
        .map((entry) => normalizeItem(entry))
        .filter((entry): entry is AssetLibraryItem => Boolean(entry))
    );
  } catch {
    return [];
  }
};

export const saveAssetLibrary = (items: AssetLibraryItem[]) => {
  if (!hasWindow()) {
    return;
  }
  try {
    window.localStorage.setItem(
      ASSET_LIBRARY_KEY,
      JSON.stringify(dedupeAssets(items))
    );
  } catch {
    // Ignore storage failures.
  }
};

export const addAssetsToLibrary = (incoming: AssetLibraryItem[]) => {
  if (!incoming.length) {
    return loadAssetLibrary();
  }
  const existing = loadAssetLibrary();
  const merged = dedupeAssets([
    ...existing,
    ...incoming
      .map((entry) => normalizeItem(entry))
      .filter((entry): entry is AssetLibraryItem => Boolean(entry)),
  ]);
  saveAssetLibrary(merged);
  return merged;
};

export const buildAssetLibraryItem = (
  item: Omit<AssetLibraryItem, "id" | "createdAt"> &
    Partial<Pick<AssetLibraryItem, "id" | "createdAt">>
): AssetLibraryItem | null =>
  normalizeItem({
    ...item,
    id: item.id ?? generateId(),
    createdAt: item.createdAt ?? Date.now(),
  });
