import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server-client";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const WORKER_URL = process.env.AUTOCLIP_WORKER_URL || "http://localhost:3001";
const WORKER_SECRET = process.env.AUTOCLIP_WORKER_SECRET || "dev-secret";

const workerFetch = (endpoint: string, options: RequestInit = {}) =>
  fetch(`${WORKER_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${WORKER_SECRET}`,
    },
  });

type ExportRequest = {
  state: {
    version: number;
    project: {
      name: string;
      sizeId: string;
      durationMode: "automatic" | "fixed";
      durationSeconds: number;
      backgroundMode: "color" | "image";
      backgroundImage?: {
        url: string;
        name: string;
        size: number;
        assetId?: string;
      } | null;
      canvasBackground?: string;
      videoBackground?: string;
    };
    snapshot: {
      assets: Array<{
        id: string;
        kind: string;
        url: string;
      }>;
    };
  };
  output: { width: number; height: number };
  preview?: { width: number; height: number };
  fps?: number;
  duration?: number;
  fonts?: string[];
  name?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ExportRequest | null;
  if (!body?.state || !body.state.snapshot) {
    return NextResponse.json({ error: "Missing project state." }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const outputWidth = Number(body.output?.width);
  const outputHeight = Number(body.output?.height);
  if (!Number.isFinite(outputWidth) || !Number.isFinite(outputHeight)) {
    return NextResponse.json({ error: "Invalid output size." }, { status: 400 });
  }

  const fps = Number(body.fps ?? 30);
  const duration = Number(body.duration ?? 0);

  if (!Number.isFinite(fps) || fps <= 0 || fps > 60) {
    return NextResponse.json({ error: "Invalid fps." }, { status: 400 });
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    return NextResponse.json({ error: "Invalid duration." }, { status: 400 });
  }

  const assetIds = (body.state.snapshot.assets || [])
    .map((asset) => asset.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const assetRows = assetIds.length
    ? await supabaseServer
        .from("assets")
        .select("id,storage_bucket,storage_path,external_url")
        .eq("user_id", user.id)
        .in("id", assetIds)
    : { data: [] as Array<{ id: string; storage_bucket: string | null; storage_path: string | null; external_url: string | null }> };

  const rows = assetRows.data ?? [];
  const assetMap = new Map(rows.map((row) => [row.id, row]));
  const signedUrlCache = new Map<string, string>();

  const resolveAssetUrl = async (asset: { id: string; url: string }) => {
    const row = assetMap.get(asset.id);
    if (!row) {
      return asset.url;
    }
    if (row.storage_bucket && row.storage_path) {
      const key = `${row.storage_bucket}:${row.storage_path}`;
      const cached = signedUrlCache.get(key);
      if (cached) {
        return cached;
      }
      const { data } = await supabaseServer.storage
        .from(row.storage_bucket)
        .createSignedUrl(row.storage_path, 60 * 60 * 6);
      const signedUrl = data?.signedUrl;
      if (signedUrl) {
        signedUrlCache.set(key, signedUrl);
        return signedUrl;
      }
    }
    if (row.external_url) {
      return row.external_url;
    }
    return asset.url;
  };

  const hydratedAssets = await Promise.all(
    body.state.snapshot.assets.map(async (asset) => ({
      ...asset,
      url: await resolveAssetUrl(asset),
    }))
  );

  const missingUploads = hydratedAssets.filter(
    (asset) => typeof asset.url === "string" && asset.url.startsWith("blob:")
  );
  if (missingUploads.length > 0) {
    return NextResponse.json(
      {
        error:
          "Some assets are not uploaded yet. Please wait for uploads to finish and try again.",
      },
      { status: 400 }
    );
  }

  const hydratedState = {
    ...body.state,
    snapshot: {
      ...body.state.snapshot,
      assets: hydratedAssets,
    },
  };

  if (hydratedState.project?.backgroundImage?.assetId) {
    const backgroundAsset = hydratedAssets.find(
      (asset) => asset.id === hydratedState.project?.backgroundImage?.assetId
    );
    if (backgroundAsset && hydratedState.project.backgroundImage) {
      hydratedState.project.backgroundImage = {
        ...hydratedState.project.backgroundImage,
        url: backgroundAsset.url,
      };
    }
  }

  const response = await workerFetch("/editor-export/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      state: hydratedState,
      output: {
        width: outputWidth,
        height: outputHeight,
      },
      preview:
        body.preview &&
        Number.isFinite(body.preview.width) &&
        Number.isFinite(body.preview.height)
          ? {
              width: Math.max(2, Math.round(body.preview.width)),
              height: Math.max(2, Math.round(body.preview.height)),
            }
          : undefined,
      fps,
      duration,
      fonts: Array.isArray(body.fonts) ? body.fonts : [],
      name: body.name,
      requestedBy: user.id,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json(
      { error: payload?.error || "Failed to start export." },
      { status: response.status }
    );
  }

  return NextResponse.json(payload);
}
