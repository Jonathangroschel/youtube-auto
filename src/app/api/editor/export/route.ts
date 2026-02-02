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

const isLocalhostUrl = (value: string) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const IN_FLIGHT_EXPORT_STATUSES = new Set([
  "starting",
  "queued",
  "loading",
  "rendering",
  "encoding",
  "uploading",
]);

const COMPLETE_EXPORT_STATUSES = new Set([
  "complete",
  "completed",
  "success",
  "succeeded",
  "done",
  "rendered",
]);

const ERROR_EXPORT_STATUSES = new Set([
  "error",
  "failed",
  "failure",
  "cancelled",
  "canceled",
]);

const normalizeExportStatus = (value: string | null | undefined) => {
  if (!value) {
    return "idle" as const;
  }
  const normalized = value.toLowerCase();
  if (COMPLETE_EXPORT_STATUSES.has(normalized)) {
    return "complete" as const;
  }
  if (ERROR_EXPORT_STATUSES.has(normalized)) {
    return "error" as const;
  }
  if (IN_FLIGHT_EXPORT_STATUSES.has(normalized)) {
    return normalized;
  }
  if (normalized === "idle") {
    return "idle" as const;
  }
  // Unknown non-terminal statuses should still be treated as in-flight.
  return "rendering" as const;
};

const deriveProjectStatus = ({
  exportStatus,
  hasJobId,
}: {
  exportStatus: string | null | undefined;
  hasJobId: boolean;
}) => {
  if (!hasJobId) return "draft";
  const normalizedStatus = normalizeExportStatus(exportStatus);
  if (normalizedStatus === "complete") return "rendered";
  if (normalizedStatus === "error") return "error";
  return "rendering";
};

type PersistedExportState = {
  jobId: string;
  status: string;
  stage: string;
  progress: number;
  downloadUrl: string | null;
  updatedAt: string;
};

const buildExportState = ({
  jobId,
  status,
  stage,
  progress,
  downloadUrl,
}: {
  jobId: string;
  status: string;
  stage: string;
  progress: number;
  downloadUrl: string | null;
}): PersistedExportState => ({
  jobId,
  status: normalizeExportStatus(status),
  stage,
  progress: clamp(progress, 0, 1),
  downloadUrl,
  updatedAt: new Date().toISOString(),
});

type ExportRequest = {
  state?: {
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
  projectId?: string;
};

const sanitizeExportState = (value: unknown): ExportRequest["state"] | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const state = value as Record<string, any>;
  const snapshotRaw = state.snapshot;
  if (!snapshotRaw || typeof snapshotRaw !== "object") {
    return null;
  }
  const snapshot = snapshotRaw as Record<string, any>;
  const nextSnapshot = {
    ...snapshot,
    selectedClipId: null,
    selectedClipIds: [],
    activeCanvasClipId: null,
    activeAssetId: null,
    currentTime: 0,
  };
  const { export: _exportState, ...stateWithoutExport } = state;
  return {
    ...stateWithoutExport,
    snapshot: nextSnapshot,
  } as unknown as ExportRequest["state"];
};

export async function POST(request: Request) {
  const requestId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  try {
    const body = (await request.json().catch(() => null)) as ExportRequest | null;
    if (!body) {
      return NextResponse.json({ error: "Missing export payload." }, { status: 400 });
    }
    const requestOrigin = new URL(request.url).origin;
    const renderUrl =
      process.env.EDITOR_RENDER_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      requestOrigin;

    if (!isLocalhostUrl(WORKER_URL) && isLocalhostUrl(renderUrl)) {
      return NextResponse.json(
        {
          error:
            "Export worker cannot reach your local render URL. Set EDITOR_RENDER_URL to a publicly reachable URL (or run the worker locally by setting AUTOCLIP_WORKER_URL to http://localhost:3001).",
          requestId,
        },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const projectId =
      typeof body.projectId === "string" && body.projectId.trim().length > 0
        ? body.projectId.trim()
        : null;

    let resolvedState: ExportRequest["state"] | null =
      body.state && body.state.snapshot ? (body.state as ExportRequest["state"]) : null;
    let persistBaseState: Record<string, any> | null =
      body.state && typeof body.state === "object" ? (body.state as Record<string, any>) : null;

    if (!resolvedState) {
      if (!projectId) {
        return NextResponse.json(
          { error: "Missing project state." },
          { status: 400 }
        );
      }
      const { data: projectRow, error: projectError } = await supabaseServer
        .from("projects")
        .select("id,kind,project_state")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (projectError) {
        return NextResponse.json(
          { error: projectError.message || "Failed to load project state." },
          { status: 500 }
        );
      }
      if (!projectRow || projectRow.kind !== "editor") {
        return NextResponse.json({ error: "Project not found." }, { status: 404 });
      }
      const rawState = (projectRow as any).project_state;
      let parsedState: unknown = rawState;
      if (typeof rawState === "string") {
        try {
          parsedState = JSON.parse(rawState);
        } catch {
          return NextResponse.json(
            { error: "Failed to parse project state." },
            { status: 500 }
          );
        }
      }
      if (parsedState && typeof parsedState === "object") {
        persistBaseState = parsedState as Record<string, any>;
      }
      const sanitized = sanitizeExportState(parsedState);
      if (!sanitized) {
        return NextResponse.json(
          { error: "Project state is invalid or missing snapshot." },
          { status: 400 }
        );
      }
      resolvedState = sanitized;
    } else {
      resolvedState = sanitizeExportState(resolvedState) ?? resolvedState;
    }

    if (!resolvedState || !resolvedState.snapshot) {
      return NextResponse.json({ error: "Missing project state." }, { status: 400 });
    }
    if (!Array.isArray((resolvedState.snapshot as any).assets)) {
      return NextResponse.json(
        { error: "Project state snapshot assets missing." },
        { status: 400 }
      );
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

    const assetIds = (resolvedState.snapshot.assets || [])
      .map((asset) => asset.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const assetRows = assetIds.length
      ? await supabaseServer
          .from("assets")
          .select("id,storage_bucket,storage_path,external_url")
          .eq("user_id", user.id)
          .in("id", assetIds)
      : {
          data: [] as Array<{
            id: string;
            storage_bucket: string | null;
            storage_path: string | null;
            external_url: string | null;
          }>,
        };

    const rows = assetRows.data ?? [];
    const assetMap = new Map(rows.map((row) => [row.id, row]));
    const signedUrlCache = new Map<string, string>();
    const supabaseStorageMatch = (value: string) => {
      try {
        const url = new URL(value);
        const match = url.pathname.match(
          /^\/storage\/v1\/object\/(public|sign)\/([^/]+)\/(.+)$/
        );
        if (!match) {
          return null;
        }
        const bucket = match[2];
        const path = decodeURIComponent(match[3]);
        return { bucket, path };
      } catch {
        return null;
      }
    };
    const resolveSupabaseStorageUrl = async (value: string) => {
      const match = supabaseStorageMatch(value);
      if (!match) {
        return null;
      }
      const cacheKey = `${match.bucket}:${match.path}`;
      const cached = signedUrlCache.get(cacheKey);
      if (cached) {
        return cached;
      }
      const { data } = await supabaseServer.storage
        .from(match.bucket)
        .createSignedUrl(match.path, 60 * 60 * 6);
      const signedUrl = data?.signedUrl ?? null;
      if (signedUrl) {
        signedUrlCache.set(cacheKey, signedUrl);
      }
      return signedUrl;
    };

    const resolveAssetUrl = async (asset: { id: string; url: string }) => {
      const row = assetMap.get(asset.id);
      if (!row) {
        if (asset.url) {
          const signed = await resolveSupabaseStorageUrl(asset.url);
          if (signed) {
            return signed;
          }
        }
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
        const signed = await resolveSupabaseStorageUrl(row.external_url);
        if (signed) {
          return signed;
        }
        return row.external_url;
      }
      return asset.url;
    };

    const hydratedAssets = await Promise.all(
      resolvedState.snapshot.assets.map(async (asset) => ({
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
      ...resolvedState,
      snapshot: {
        ...resolvedState.snapshot,
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
    if (hydratedState.project?.backgroundImage?.url) {
      const signed = await resolveSupabaseStorageUrl(
        hydratedState.project.backgroundImage.url
      );
      if (signed) {
        hydratedState.project.backgroundImage = {
          ...hydratedState.project.backgroundImage,
          url: signed,
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
        renderUrl,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error || "Failed to start export.", requestId },
        { status: response.status }
      );
    }

    const nextJobId =
      typeof payload?.jobId === "string"
        ? payload.jobId
        : typeof payload?.id === "string"
          ? payload.id
          : null;

    if (projectId && nextJobId) {
      const { data: existingProject } = await supabaseServer
        .from("projects")
        .select("id,user_id,kind,title,project_state")
        .eq("id", projectId)
        .maybeSingle();

      const ownedByUser =
        !existingProject || existingProject.user_id === user.id;
      const isEditorProject =
        !existingProject || existingProject.kind === "editor";

      if (ownedByUser && isEditorProject) {
        const exportStatus =
          typeof payload?.status === "string" ? payload.status : "queued";
        const exportStage =
          typeof payload?.stage === "string" ? payload.stage : "Queued";
        const exportProgress =
          typeof payload?.progress === "number" ? payload.progress : 0;
        const exportDownloadUrl =
          typeof payload?.downloadUrl === "string" ? payload.downloadUrl : null;
        const exportState = buildExportState({
          jobId: nextJobId,
          status: exportStatus,
          stage: exportStage,
          progress: exportProgress,
          downloadUrl: exportDownloadUrl,
        });
        const baseState = persistBaseState ?? {};
        const mergedState = {
          ...baseState,
          export: exportState,
        };
        const titleFromState =
          typeof (baseState as any)?.project?.name === "string"
            ? (baseState as any).project.name.trim()
            : "";
        const resolvedTitle =
          titleFromState ||
          (typeof existingProject?.title === "string"
            ? existingProject.title
            : "") ||
          "Untitled Project";

        await supabaseServer.from("projects").upsert({
          id: projectId,
          user_id: user.id,
          kind: "editor",
          title: resolvedTitle,
          status: deriveProjectStatus({
            exportStatus,
            hasJobId: true,
          }),
          project_state: mergedState,
        });
      }
    }

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed.";
    console.error("[api/editor/export]", { requestId }, error);
    const looksLikeWorkerFetchIssue =
      message.includes("fetch failed") ||
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND") ||
      message.includes("ETIMEDOUT") ||
      message.includes("EAI_AGAIN");
    if (looksLikeWorkerFetchIssue) {
      return NextResponse.json(
        {
          error:
            "Unable to reach the export worker. Check AUTOCLIP_WORKER_URL and network access from the app to the worker.",
          requestId,
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: message, requestId }, { status: 500 });
  }
}
